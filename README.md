# Panel — stories beyond the page

An accessible comic library and PDF reader, with physical page turning, editable character casting, expressive local neural narration and a synchronized transcript. Built on the original Comic Studies Lab research notebooks, which are preserved unchanged.

## What works

- Import a PDF (up to 40 MB / 100 pages), track processing and resume from your last page.
- Turn physical-looking pages with drag, swipe, buttons, keyboard arrows or a page slider. Single-page and reduced-motion modes are available.
- Extract native PDF text, with CPU EasyOCR for scanned pages. Assign stable character codes and edit speaker assignments, dialogue and emotions.
- Narrate with **Kokoro**, a local open-source neural TTS model: no paid speech API, free-trial dependency or per-character fees. Five preset character voices, adjustable playback speed/volume, and speed/pitch cues for excitement, surprise, sadness, anger and whispering. eSpeak NG is the fallback.
- Optional vision-assisted character continuity uses a separately configured vision provider. Local OCR works without it.
- Edit cast names, voices, fictional age/presentation cues and appearance notes; add missed characters. Export the transcript as plain text.
- Paper, midnight and high-contrast themes; larger transcript text, extra spacing, keyboard navigation and focus mode. Preferences and reading position persist in the browser.
- Explore **After the Light**, an original four-page illustrated demo. A static frontend can open the demo with browser speech even without the backend.

## Run the whole application

Requirements: Docker with BuildKit and approximately 3 GB of available memory. Model download and image installation need Internet access during the initial build. Narration and OCR run locally afterward.

```bash
docker compose up --build
```

The Compose port is bound to loopback port 8000. The frontend and API are served together. Persistent library files and SQLite state live in the `panel-library` volume. Open the address locally in your browser; this repository does not create a public tunnel.

In the managed Codex environment:

```bash
bash scripts/setup-cloud.sh
bash scripts/start-cloud.sh
```

The setup script prepares `/workspace/comicstudies-env`, builds the UI, verifies/downloads Kokoro weights and caches OCR weights. It uses the existing checkout and does not create worktrees. The startup script binds to loopback for development. Active server processes must be restarted in fresh tasks.

For separate frontend development, run `npm run dev --prefix frontend` alongside the backend. Vite proxies `/api` to loopback port 8000. Backend changes require a server restart (or `uvicorn --reload` during local development).

## Character recognition: important distinction

The default local pipeline finds PDF text or OCR boxes, infers emotion using text cues, uses explicit `Name: dialogue` labels where present, and proposes tentative speaker matches from nearby colour/position signatures. This does **not** reliably identify characters, infer their ages or genders, or understand complex balloon-tail geometry. Uncertain matches are visibly marked for review. OCR reading order can need correction in complicated panels.

For stronger automatic visual understanding, set `PANEL_VISION_KEY` securely on the backend and optionally `PANEL_VISION_MODEL` (default `gpt-4o-mini`). The server sends rendered pages and the current cast to the configured OpenAI vision endpoint. The provider proposes consistent character codes, dialogue, emotion, age/presentation and appearance notes. These remain editable suggestions. **This optional analysis can incur provider charges; it is not used for TTS.** Without it, the offline extraction pipeline still runs. No provider key is shipped, and the vision path has not been tested against a live account in this environment.

The neural speech model is not emotion-conditioned: expression is implemented through punctuation, voice choice, speaking speed, pitch and amplitude. It does not clone uploaded voices or guarantee actor-quality emotional performance.

## Deployment

### Full stack on Render

`render.yaml` defines a Docker web service with a persistent 10 GB disk. Connect this repository in a Render account and create a Blueprint. This requires a hosting account and billing for the configured plan; no hosting credential is bundled. The production image downloads and verifies models during build, runs as an unprivileged user, and exposes `/api/health` for readiness. A single worker is required because the durable job state currently uses in-process workers and SQLite.

Model weights are retained in the image, while user data persists under `/data`. Set `PANEL_VISION_KEY` only if you want external vision analysis. Configure the hosting platform's domain and HTTPS normally.

### Frontend on GitHub Pages

`.github/workflows/pages.yml` builds and deploys the frontend on pushes to `main`. GitHub Pages must be enabled for the repository with **GitHub Actions** as the publishing source. A workflow token alone cannot enable Pages on an unconfigured repository.

For full functionality, set the repository Actions variable `PANEL_API_URL` to your backend's HTTPS origin. Set backend `PANEL_ALLOWED_ORIGINS` to the exact Pages origin (for example, `https://sidharth8100.github.io`). With no backend URL, Pages provides the authored sample and browser narration; uploads require the backend.

Deployment configuration is not evidence of a live deployment. Check Actions and the hosting service before sharing a public URL.

## Privacy and operational limits

This is a capability-key personal-library prototype, not an account-based production service. A random 256-bit library key stays in browser local storage; API authorization checks protect book metadata, images, edits and audio. Clearing browser storage loses library access. There is no login, account recovery or cross-device synchronization. Anyone who obtains the key can access that library, so production HTTPS and protection against script injection are essential.

Uploaded PDFs, rendered pages, dialogue and audio are stored on the server. The optional vision provider receives page images only when explicitly configured. Deleting a finished comic removes its database record and directory. Processing jobs must finish before deletion. Interrupted jobs can be retried after a restart.

Limits: 20 books per library, two active uploads per key, eight active jobs globally and 500 books per instance. Two worker threads process jobs. These quotas are not a substitute for authentication, rate limiting, a durable external queue, storage monitoring and abuse controls before opening an unrestricted public service. No credentials are included in committed files.

## Validation

```bash
python -m pytest -q tests
npm ci --prefix frontend
npm run build --prefix frontend
python scripts/make_test_pdf.py
# Start the backend, then in another terminal:
npm run test:e2e --prefix frontend
```

The browser tests cover a real upload, edited transcript, physical page turns, cast voice edits, keyboard navigation, mobile overflow, narration controls and automated WCAG A/AA checks of the library and reader. API tests cover invalid/encrypted PDFs, page limits, ownership isolation, image retrieval, editable casting, speech WAV generation and scanned-image OCR when cached models are available. Automated accessibility checks do not replace testing with screen readers and disabled readers.

Local Chromium defaults to `/usr/bin/chromium`. Set `CHROMIUM_PATH` to override it. CI installs Playwright's Chromium. Failed browser tests save screenshots and accessibility context in `frontend/test-results/`.

## Project map

- `frontend/src/App.tsx` — library, reader, cast studio, import flow and accessibility controls.
- `frontend/src/styles.css` — responsive editorial interface and reading themes.
- `backend/main.py` — private library API, PDF extraction, OCR and optional vision analysis.
- `backend/speech.py` — neural voice synthesis and expressive prosody.
- `backend/sample.py` — original procedural comic illustrations and sample dialogue.
- `scripts/models.json` — official neural model URLs and pinned SHA-256 digests.
- `tests/`, `frontend/e2e/` — API, browser and accessibility integration tests.

See [THIRD_PARTY.md](THIRD_PARTY.md) for design references, attribution and dependency licenses. In particular, the open-source PyMuPDF edition has AGPL obligations; review these before proprietary redistribution.
