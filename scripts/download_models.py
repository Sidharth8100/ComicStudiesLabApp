"""Download official release assets with TLS and pinned SHA-256 integrity checks."""

import hashlib
import json
import os
from pathlib import Path
import urllib.request

root = Path(__file__).resolve().parents[1]
out = Path(os.getenv("PANEL_MODEL_DIR", "/workspace/panel-models"))
out.mkdir(parents=True, exist_ok=True)
manifest = json.loads((root / "scripts/models.json").read_text())
for filename, info in manifest.items():
    dest = out / filename

    def digest(p):
        h = hashlib.sha256()
        with p.open("rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""):
                h.update(chunk)
        return h.hexdigest()

    if dest.exists() and digest(dest) == info["sha256"]:
        print(f"Verified {filename}")
        continue
    temp = dest.with_suffix(".download")
    with urllib.request.urlopen(info["url"], timeout=120) as r, temp.open("wb") as f:
        while chunk := r.read(1024 * 1024):
            f.write(chunk)
    if digest(temp) != info["sha256"]:
        temp.unlink()
        raise RuntimeError(f"Integrity check failed for {filename}")
    temp.replace(dest)
    print(f"Downloaded and verified {filename}")
