"""Panel: private PDF library, durable analysis jobs and expressive offline narration."""

from __future__ import annotations
import base64
import hashlib
import json
import logging
import os
from pathlib import Path
import re
import shutil
import sqlite3
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

import cv2
import fitz
import httpx
import numpy as np
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from backend.speech import synthesize, neural_available
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
DATA = Path(os.getenv("PANEL_DATA_DIR", ROOT / ".data"))
DATA.mkdir(parents=True, exist_ok=True)
DB = DATA / "panel.sqlite3"
MAX_BYTES = 40 * 1024 * 1024
MAX_PAGES = 100
POOL = ThreadPoolExecutor(max_workers=2)
LOCK = threading.RLock()
OCR_LOCK = threading.Lock()
READER = None
LOG = logging.getLogger("panel")
VOICES = {
    "warm": {
        "name": "Atlas",
        "description": "Warm · grounded",
        "voice": "en-us",
        "pitch": 38,
        "rate": 155,
    },
    "bright": {
        "name": "Juniper",
        "description": "Bright · youthful",
        "voice": "en-us+f3",
        "pitch": 62,
        "rate": 170,
    },
    "deep": {
        "name": "Orion",
        "description": "Deep · measured",
        "voice": "en-gb+m3",
        "pitch": 25,
        "rate": 140,
    },
    "soft": {
        "name": "Sage",
        "description": "Soft · reflective",
        "voice": "en-gb+f2",
        "pitch": 48,
        "rate": 145,
    },
    "electric": {
        "name": "Echo",
        "description": "Crisp · animated",
        "voice": "en-us+m4",
        "pitch": 65,
        "rate": 175,
    },
}
EMOTIONS = {
    "neutral": (0, 0),
    "excited": (13, 23),
    "angry": (-6, 15),
    "sad": (-10, -25),
    "whispering": (-5, -30),
    "surprised": (18, 10),
}


def connect():
    c = sqlite3.connect(DB, timeout=20)
    c.row_factory = sqlite3.Row
    return c


with connect() as c:
    c.execute(
        "CREATE TABLE IF NOT EXISTS books (id TEXT PRIMARY KEY, owner TEXT NOT NULL, body TEXT NOT NULL)"
    )
    # Workers are ephemeral; interrupted jobs must not poll forever after a restart.
    for r in c.execute("SELECT id,body FROM books").fetchall():
        b = json.loads(r["body"])
        if b["status"] in ("queued", "processing"):
            b.update(
                status="error", error="Processing was interrupted. Retry to continue."
            )
            c.execute("UPDATE books SET body=? WHERE id=?", (json.dumps(b), r["id"]))

app = FastAPI(
    title="Panel API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
allowed_origins = [
    s.strip() for s in os.getenv("PANEL_ALLOWED_ORIGINS", "").split(",") if s.strip()
]
if allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )


@app.middleware("http")
async def response_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    if request.url.path.startswith("/api"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response


def owner(authorization: str | None):
    if not authorization or not re.fullmatch(r"Bearer [a-f0-9]{64}", authorization):
        raise HTTPException(401, "A library access key is required.")
    return hashlib.sha256(authorization.encode()).hexdigest()


def save(b, who=None):
    with LOCK, connect() as c:
        if who:
            c.execute("INSERT INTO books VALUES (?,?,?)", (b["id"], who, json.dumps(b)))
        else:
            c.execute("UPDATE books SET body=? WHERE id=?", (json.dumps(b), b["id"]))


def get_book(book_id, who=None):
    if not re.fullmatch(r"[a-f0-9]{32}", book_id):
        raise HTTPException(404, "Comic not found.")
    with connect() as c:
        r = c.execute("SELECT * FROM books WHERE id=?", (book_id,)).fetchone()
    if not r or (who and r["owner"] != who):
        raise HTTPException(404, "Comic not found.")
    return json.loads(r["body"])


def emotion(text):
    t = text.lower()
    if any(w in t for w in ["afraid", "sorry", "lost", "alone", "goodbye"]):
        return "sad"
    if any(w in t for w in ["quiet", "whisper", "shh"]):
        return "whispering"
    if any(w in t for w in ["stop!", "hate", "never!", "get out"]):
        return "angry"
    if "?" in t and "!" in t:
        return "surprised"
    if "!" in t:
        return "excited"
    return "neutral"


def character(code, name, index=0, **extra):
    return {
        "id": code,
        "name": name,
        "voice": list(VOICES)[index % len(VOICES)],
        "appearance": "",
        "age": "unspecified",
        "presentation": "unspecified",
        "confidence": "needs review",
        **extra,
    }


def local_lines(page, png, cast, signatures):
    """Extract native text or OCR; conservative, reviewable visual speaker proposals."""
    blocks = page.get_text("blocks", sort=True)
    w, h = page.rect.width, page.rect.height
    items = [
        (b[4].strip(), [b[0] / w, b[1] / h, b[2] / w, b[3] / h], 1.0)
        for b in blocks
        if b[6] == 0 and b[4].strip()
    ]
    image = cv2.imread(str(png))
    if not items:
        global READER
        with OCR_LOCK:
            if READER is None:
                import easyocr

                cache = os.getenv(
                    "EASYOCR_MODULE_PATH", "/workspace/comicstudies-setup"
                )
                kwargs = (
                    {"model_storage_directory": str(Path(cache) / "model")}
                    if Path(cache, "model").exists()
                    else {}
                )
                READER = easyocr.Reader(["en"], gpu=False, verbose=False, **kwargs)
            results = READER.readtext(image, paragraph=False)
        ih, iw = image.shape[:2]
        items = [
            (
                txt,
                [
                    float(box[0][0]) / iw,
                    float(box[0][1]) / ih,
                    float(box[2][0]) / iw,
                    float(box[2][1]) / ih,
                ],
                float(prob),
            )
            for box, txt, prob in results
            if prob >= 0.25
        ]
        items.sort(key=lambda r: (round(r[1][1] * 12), r[1][0]))
    lines = []
    for txt, box, confidence in items[:160]:
        txt = txt[:1500]
        named = re.match(r"^([A-Z][A-Za-z .-]{1,24}):\s*(.+)", txt, flags=re.S)
        code = "NARRATOR"
        method = "unassigned"
        if named:
            name, txt = named.groups()
            found = next((x for x in cast if x["name"].lower() == name.lower()), None)
            if not found:
                code = f"CHAR-{len(cast):02d}"
                cast.append(
                    character(code, name, len(cast) - 1, confidence="text label")
                )
            else:
                code = found["id"]
            method = "text label"
        elif image is not None and len(txt) > 4:
            # Compare local appearance beneath a balloon; this is a proposal, not face recognition.
            ih, iw = image.shape[:2]
            x0 = max(0, int((box[0] - 0.08) * iw))
            x1 = min(iw, int((box[2] + 0.08) * iw))
            y0 = min(ih - 1, int(box[3] * ih))
            y1 = min(ih, int((box[3] + 0.23) * ih))
            crop = image[y0:y1, x0:x1]
            if crop.size and float(crop.std()) > 45:
                hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
                hist = cv2.calcHist(
                    [hsv], [0, 1], None, [12, 4], [0, 180, 0, 256]
                ).flatten()
                hist /= max(float(np.linalg.norm(hist)), 1e-9)
                scores = [float(np.dot(hist, s[1])) for s in signatures]
                if scores and max(scores) > 0.92:
                    code = signatures[int(np.argmax(scores))][0]
                elif len(signatures) < 8:
                    code = f"CHAR-{len(cast):02d}"
                    cast.append(
                        character(
                            code,
                            f"Character {len(cast):02d}",
                            len(cast) - 1,
                            appearance="Local colour/position match; confirm speaker.",
                            confidence="tentative visual match",
                        )
                    )
                    signatures.append((code, hist))
                method = (
                    "tentative visual match" if code != "NARRATOR" else "unassigned"
                )
        lines.append(
            {
                "id": uuid.uuid4().hex,
                "text": txt,
                "character": code,
                "emotion": emotion(txt),
                "box": box,
                "confidence": round(confidence, 3),
                "assignment": method,
            }
        )
    return lines


def vision_lines(png, cast):
    """Optional vision-assisted character continuity. Never pretend local heuristics are a VLM."""
    key = os.getenv("PANEL_VISION_KEY")
    if not key:
        return None
    prompt = (
        """Analyze this comic page. Read dialogue in panel reading order. Track recurring fictional characters using the supplied cast. Return ONLY a JSON object {"characters":[{"id":"CHAR-01","name":"name or descriptive label","appearance":"visible clothing/hair/style","age":"child|teen|adult|older adult|unspecified","presentation":"masculine|feminine|androgynous|unspecified","voice":"warm|bright|deep|soft|electric"}],"lines":[{"text":"exact visible dialogue","character":"CHAR-01 or NARRATOR","emotion":"neutral|excited|angry|sad|whispering|surprised","box":[x0,y0,x1,y1]}]}. Coordinates normalized 0..1. Include captions and sound effects as NARRATOR. Do not invent dialogue or identify real people. Age and presentation are tentative fictional voice design cues, not facts; use unspecified when unclear. Existing cast: """
        + json.dumps(cast)
    )
    with httpx.Client(timeout=100) as client:
        r = client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={
                "model": os.getenv("PANEL_VISION_MODEL", "gpt-4o-mini"),
                "response_format": {"type": "json_object"},
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": "data:image/png;base64,"
                                    + base64.b64encode(png.read_bytes()).decode()
                                },
                            },
                        ],
                    }
                ],
                "max_tokens": 5000,
            },
        )
        r.raise_for_status()
        data = json.loads(r.json()["choices"][0]["message"]["content"])
    known = {c["id"]: c for c in cast}
    for c in data.get("characters", [])[:16]:
        code = str(c.get("id", ""))
        if not re.fullmatch(r"CHAR-\d{2}", code):
            continue
        known[code] = character(
            code,
            str(c.get("name", code))[:60],
            appearance=str(c.get("appearance", ""))[:300],
            age=str(c.get("age", "unspecified"))[:30],
            presentation=str(c.get("presentation", "unspecified"))[:30],
            voice=c.get("voice") if c.get("voice") in VOICES else "warm",
            confidence="vision proposal",
        )
    cast[:] = list(known.values())
    lines = []
    for l in data.get("lines", [])[:160]:
        text = str(l.get("text", "")).strip()[:1500]
        if not text:
            continue
        box = l.get("box", [0, 0, 1, 1])
        if (
            not isinstance(box, list)
            or len(box) != 4
            or not all(isinstance(v, (float, int)) and 0 <= v <= 1 for v in box)
        ):
            box = [0, 0, 1, 1]
        lines.append(
            {
                "id": uuid.uuid4().hex,
                "text": text,
                "character": l.get("character")
                if l.get("character") in known
                else "NARRATOR",
                "emotion": l.get("emotion")
                if l.get("emotion") in EMOTIONS
                else "neutral",
                "box": box,
                "confidence": None,
                "assignment": "vision proposal",
            }
        )
    return lines


def analyze(book_id):
    try:
        b = get_book(book_id)
        b.update(status="processing", progress=2, error=None)
        save(b)
        cast = [character("NARRATOR", "Narrator", confidence="default")]
        signatures = []
        pages = []
        with fitz.open(DATA / book_id / "source.pdf") as doc:
            for i, p in enumerate(doc):
                png = DATA / book_id / f"page-{i}.png"
                pix = p.get_pixmap(
                    matrix=fitz.Matrix(
                        min(1600 / p.rect.width, 2.5), min(1600 / p.rect.width, 2.5)
                    ),
                    alpha=False,
                )
                pix.save(png)
                lines = None
                if os.getenv("PANEL_VISION_KEY"):
                    try:
                        lines = vision_lines(png, cast)
                    except Exception:
                        LOG.warning(
                            "Vision provider failed; falling back to local extraction"
                        )
                        b["notice"] = (
                            "Vision analysis was unavailable. Local OCR and tentative cast proposals were used."
                        )
                if lines is None:
                    lines = local_lines(p, png, cast, signatures)
                pages.append(
                    {
                        "index": i,
                        "width": pix.width,
                        "height": pix.height,
                        "lines": lines,
                    }
                )
                b.update(
                    progress=round((i + 1) / len(doc) * 100),
                    pages=pages,
                    characters=cast,
                )
                save(b)
        b.update(
            status="ready",
            pages=pages,
            characters=cast,
            progress=100,
            engine="vision"
            if os.getenv("PANEL_VISION_KEY") and not b.get("notice")
            else "local",
        )
        save(b)
    except Exception as exc:
        LOG.exception("Comic processing failed: %s", type(exc).__name__)
        b = get_book(book_id)
        b.update(
            status="error",
            error="Could not process this PDF. Verify that it contains readable pages, then retry.",
        )
        save(b)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "speech": neural_available()
        or bool(shutil.which("espeak-ng") or shutil.which("espeak")),
        "speechEngine": "kokoro" if neural_available() else "espeak",
        "vision": bool(os.getenv("PANEL_VISION_KEY")),
    }


@app.get("/api/voices")
def voices():
    return VOICES


@app.get("/api/books")
def books(authorization: str | None = Header(default=None)):
    who = owner(authorization)
    with connect() as c:
        rows = c.execute(
            "SELECT body FROM books WHERE owner=? ORDER BY rowid DESC", (who,)
        ).fetchall()
    return [json.loads(r["body"]) for r in rows]


async def store_pdf(file, who):
    with LOCK, connect() as c:
        rows = [
            json.loads(r["body"])
            for r in c.execute(
                "SELECT body FROM books WHERE owner=?", (who,)
            ).fetchall()
        ]
        if len(rows) >= 20:
            raise HTTPException(
                429,
                "Your library is full (20 comics). Delete a comic before uploading another.",
            )
        if sum(b["status"] in ("queued", "processing") for b in rows) >= 2:
            raise HTTPException(
                429, "Two comics are already processing. Wait for one to finish."
            )
        total = c.execute("SELECT COUNT(*) FROM books").fetchone()[0]
        active = sum(
            json.loads(r["body"])["status"] in ("queued", "processing")
            for r in c.execute("SELECT body FROM books")
        )
        if active >= 8:
            raise HTTPException(
                503,
                "The server is processing several stories. Please try again shortly.",
            )
        if total >= 500:
            raise HTTPException(503, "This instance is at capacity.")
    book_id = uuid.uuid4().hex
    folder = DATA / book_id
    folder.mkdir()
    try:
        size = 0
        with (folder / "source.pdf").open("wb") as f:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_BYTES:
                    raise HTTPException(413, "Choose a PDF smaller than 40 MB.")
                f.write(chunk)
        try:
            with fitz.open(folder / "source.pdf") as doc:
                if not doc.is_pdf:
                    raise HTTPException(400, "Please upload a PDF file.")
                if doc.is_encrypted:
                    raise HTTPException(400, "Unlock this PDF before uploading it.")
                if len(doc) < 1 or len(doc) > MAX_PAGES:
                    raise HTTPException(400, "PDFs must contain 1–100 pages.")
                if any(
                    p.rect.width <= 0
                    or p.rect.height <= 0
                    or p.rect.width > 10000
                    or p.rect.height > 10000
                    or p.rect.height / p.rect.width > 5
                    for p in doc
                ):
                    raise HTTPException(
                        400, "This PDF has unsupported page dimensions."
                    )
                count = len(doc)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(400, "This file is not a readable PDF.")
        name = Path(file.filename or "Untitled comic.pdf").stem[:100]
        b = {
            "id": book_id,
            "title": name,
            "created": time.time(),
            "status": "queued",
            "progress": 0,
            "pageCount": count,
            "pages": [],
            "characters": [],
            "notice": None,
            "demo": False,
        }
        save(b, who)
        POOL.submit(analyze, book_id)
        return b
    except Exception:
        shutil.rmtree(folder, ignore_errors=True)
        raise
    finally:
        await file.close()


@app.post("/api/books", status_code=202)
async def upload(
    file: UploadFile = File(...), authorization: str | None = Header(default=None)
):
    return await store_pdf(file, owner(authorization))


@app.get("/api/books/{book_id}")
def book(book_id: str, authorization: str | None = Header(default=None)):
    return get_book(book_id, owner(authorization))


@app.post("/api/books/{book_id}/retry", status_code=202)
def retry(book_id: str, authorization: str | None = Header(default=None)):
    with LOCK:
        b = get_book(book_id, owner(authorization))
        if b["status"] != "error":
            raise HTTPException(409, "Only failed jobs can be retried.")
        b.update(status="queued", progress=0, error=None)
        save(b)
        POOL.submit(analyze, book_id)
    return b


@app.delete("/api/books/{book_id}", status_code=204)
def delete(book_id: str, authorization: str | None = Header(default=None)):
    with LOCK:
        b = get_book(book_id, owner(authorization))
        if b["status"] in ("processing", "queued"):
            raise HTTPException(409, "Wait for processing to finish before deleting.")
        with connect() as c:
            c.execute("DELETE FROM books WHERE id=?", (book_id,))
        shutil.rmtree(DATA / book_id, ignore_errors=True)


@app.get("/api/books/{book_id}/pages/{index}")
def page_image(
    book_id: str, index: int, authorization: str | None = Header(default=None)
):
    b = get_book(book_id, owner(authorization))
    if index < 0 or index >= len(b["pages"]):
        raise HTTPException(404, "Page not ready.")
    return FileResponse(
        DATA / book_id / f"page-{index}.png",
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=86400"},
    )


class CastEdit(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    voice: str
    age: str = Field(default="unspecified", max_length=30)
    presentation: str = Field(default="unspecified", max_length=30)
    appearance: str = Field(default="", max_length=300)
