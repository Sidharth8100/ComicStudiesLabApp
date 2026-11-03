#!/usr/bin/env bash
set -euo pipefail
cd /workspace/ComicStudiesLabApp
python -m venv /workspace/comicstudies-env
P=/workspace/comicstudies-env/bin/python
"$P" -m pip install torch==2.5.1+cpu torchvision==0.20.1+cpu --index-url https://download.pytorch.org/whl/cpu
"$P" -m pip install -r backend/requirements.txt jupyterlab==4.4.10 ipykernel==6.30.1
npm ci --prefix frontend
npm run build --prefix frontend
PANEL_MODEL_DIR=/workspace/panel-models "$P" scripts/download_models.py
EASYOCR_MODULE_PATH=/workspace/comicstudies-setup "$P" -c "import easyocr; easyocr.Reader(['en'],gpu=False,verbose=False)"
"$P" -m pip check
