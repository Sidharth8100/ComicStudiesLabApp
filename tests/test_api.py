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
