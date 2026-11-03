# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS web
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; npm ci --strict-ssl=true
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    PANEL_DATA_DIR=/data PANEL_MODEL_DIR=/opt/panel-models EASYOCR_MODULE_PATH=/opt/easyocr \
    HF_HUB_OFFLINE=1 OMP_NUM_THREADS=2 MKL_NUM_THREADS=2
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends espeak-ng ffmpeg libcairo2 libgomp1 ca-certificates \
    && rm -rf /var/lib/apt/lists/* && useradd --create-home panel \
    && mkdir -p /data /opt/panel-models /opt/easyocr && chown panel:panel /data /opt/panel-models /opt/easyocr
COPY backend/requirements.txt backend/requirements.txt
RUN --mount=type=secret,id=ca_bundle \
    if [ -f /run/secrets/ca_bundle ]; then export PIP_CERT=/run/secrets/ca_bundle; fi; \
    pip install --no-cache-dir torch==2.5.1+cpu torchvision==0.20.1+cpu --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r backend/requirements.txt
COPY scripts/download_models.py scripts/models.json scripts/
RUN --mount=type=secret,id=ca_bundle \
    if [ -f /run/secrets/ca_bundle ]; then export SSL_CERT_FILE=/run/secrets/ca_bundle; fi; \
    python scripts/download_models.py && python -c "import easyocr; easyocr.Reader(['en'], gpu=False, verbose=False)" \
    && chown -R panel:panel /opt/panel-models /opt/easyocr
COPY --chown=panel:panel backend/ backend/
COPY --from=web --chown=panel:panel /build/frontend/dist frontend/dist
USER panel
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('PORT', '8000') + '/api/health',timeout=4)"
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000} --limit-concurrency 64 --timeout-keep-alive 5"]
