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
