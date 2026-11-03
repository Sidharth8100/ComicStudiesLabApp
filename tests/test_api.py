import os
from pathlib import Path
import tempfile
import time
import fitz
import pytest
from fastapi.testclient import TestClient

os.environ["PANEL_DATA_DIR"] = tempfile.mkdtemp(prefix="panel-tests-")
from backend.main import app, DATA

client = TestClient(app)
AUTH = {"Authorization": "Bearer " + "a" * 64}
OTHER = {"Authorization": "Bearer " + "b" * 64}


def pdf_bytes(text="Ada: Hello from the uploaded comic!", pages=1):
    with fitz.open() as d:
        for _ in range(pages):
            d.new_page().insert_text((40, 60), text)
        return d.tobytes()


def upload(data=None):
    return client.post(
        "/api/books",
        headers=AUTH,
        files={"file": ("test.pdf", data or pdf_bytes(), "application/pdf")},
    )


def ready(book_id):
    for _ in range(600):
        b = client.get(f"/api/books/{book_id}", headers=AUTH).json()
        if b["status"] in ("ready", "error"):
            return b
        time.sleep(0.05)
    pytest.fail("Processing did not finish")


def test_health_and_auth():
    assert client.get("/api/health").json()["status"] == "ok"
    assert client.get("/api/books").status_code == 401
    assert (
        client.get("/api/books", headers={"Authorization": "Bearer x"}).status_code
        == 401
    )


def test_invalid_pdf_is_cleaned_up():
    before = set(DATA.iterdir())
    assert upload(b"not a PDF").status_code == 400
    assert set(DATA.iterdir()) == before


def test_page_limit():
    assert upload(pdf_bytes(pages=101)).status_code == 400


def test_password_protected_pdf():
    with fitz.open(stream=pdf_bytes(), filetype="pdf") as d:
        encrypted = d.tobytes(
            encryption=fitz.PDF_ENCRYPT_AES_256, owner_pw="owner", user_pw="secret"
        )
    assert upload(encrypted).status_code == 400


def test_native_pdf_roundtrip_and_access_control():
    r = upload()
    assert r.status_code == 202
    b = ready(r.json()["id"])
    assert b["status"] == "ready"
    assert b["pages"][0]["lines"][0]["text"] == "Hello from the uploaded comic!"
    assert any(c["name"] == "Ada" for c in b["characters"])
    url = f"/api/books/{b['id']}"
    assert client.get(url, headers=OTHER).status_code == 404
    assert client.get(url + "/pages/0", headers=OTHER).status_code == 404
    assert (
        client.get(url + "/pages/0", headers=AUTH).headers["content-type"]
        == "image/png"
    )
    assert client.get(url + "/pages/-1", headers=AUTH).status_code == 404
    assert client.get(url + "/pages/999", headers=AUTH).status_code == 404
    assert client.post(url + "/retry", headers=AUTH).status_code == 409
    assert client.delete(url, headers=AUTH).status_code == 204
    assert client.get(url, headers=AUTH).status_code == 404
