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
