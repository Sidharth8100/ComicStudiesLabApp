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
