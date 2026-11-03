#!/usr/bin/env bash
set -euo pipefail
cd /workspace/ComicStudiesLabApp
export PANEL_MODEL_DIR=/workspace/panel-models
export EASYOCR_MODULE_PATH=/workspace/comicstudies-setup
export OMP_NUM_THREADS=2
export MKL_NUM_THREADS=2
if [ -d /workspace/panel-system/bin ]; then export PATH="/workspace/panel-system/bin:$PATH"; fi
exec /workspace/comicstudies-env/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --limit-concurrency 64 --timeout-keep-alive 5
