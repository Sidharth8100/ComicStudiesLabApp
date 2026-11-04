"""Ephemeral full-stack demo. No persistent volumes or paid AI APIs.

Build frontend/dist first, then run: modal deploy deploy/modal_app.py
Compute can use an account's free allowance; this is not an unlimited-free plan.
"""

from pathlib import Path
import sys

import modal

ROOT = Path(__file__).resolve().parents[1]
if not (ROOT / "frontend/dist/index.html").is_file():
    raise RuntimeError("Build the frontend first: npm ci --prefix frontend && npm run build --prefix frontend")

app = modal.App("panel-comic-demo")
image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("espeak-ng", "ffmpeg", "libcairo2", "libgomp1", "ca-certificates")
    .env({
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONUNBUFFERED": "1",
        "PANEL_DATA_DIR": "/tmp/panel-library",
        "PANEL_MODEL_DIR": "/opt/panel-models",
        "PANEL_EPHEMERAL_STORAGE": "1",
        "PANEL_USE_EXTERNAL_VISION": "0",
        "EASYOCR_MODULE_PATH": "/opt/easyocr",
        "HF_HUB_OFFLINE": "1",
        "OMP_NUM_THREADS": "2",
        "MKL_NUM_THREADS": "2",
    })
    .pip_install(
        "torch==2.5.1+cpu", "torchvision==0.20.1+cpu",
        index_url="https://download.pytorch.org/whl/cpu",
    )
    .pip_install_from_requirements(str(ROOT / "backend/requirements.txt"))
    .add_local_file(ROOT / "scripts/download_models.py", "/app/scripts/download_models.py", copy=True)
    .add_local_file(ROOT / "scripts/models.json", "/app/scripts/models.json", copy=True)
    .run_commands(
        "mkdir -p /opt/panel-models /opt/easyocr",
        "python /app/scripts/download_models.py",
        "python -c \"import easyocr; easyocr.Reader(['en'], gpu=False, verbose=False)\"",
    )
    .add_local_dir(ROOT / "backend", "/app/backend", copy=True, ignore=["__pycache__", "*.pyc"])
    .add_local_dir(ROOT / "frontend/dist", "/app/frontend/dist", copy=True)
    .workdir("/app")
)


@app.function(
    image=image,
    cpu=2,
    memory=4096,
    min_containers=0,
    max_containers=1,
    scaledown_window=60,
    timeout=600,
    # Send only this small entrypoint; application files are explicitly in image.
    serialized=True,
    include_source=False,
)
@modal.concurrent(max_inputs=16)
@modal.asgi_app()
def web():
    # Imports execute in the remote image, not in the lightweight deployment CLI.
    sys.path.insert(0, "/app")
    from backend.main import app as application
    return application
