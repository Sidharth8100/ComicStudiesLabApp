# Publish Panel on Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Sidharth8100/ComicStudiesLabApp)

This publishes the complete application—frontend, PDF processing, visual casting and neural speech—at one HTTPS address. GitHub Pages and an additional API domain are optional.

## Create the service

1. Open **Deploy to Render** above, sign into your Render account, and authorize access to `Sidharth8100/ComicStudiesLabApp` if prompted.
2. Review the Blueprint from `main`. It creates one `panel-comic-reader` Docker service on the **Pro** plan, with a persistent **10 GB disk**. Review the recurring hosting and disk price shown by Render before deploying. The full local ML stack was tested with 4 GB RAM; a small free web-service instance is not suitable for all models.
3. Deploy the Blueprint. The first image build installs CPU dependencies and downloads checksum-verified model weights. Wait until Render reports the service **Live**, then open the HTTPS address from its dashboard. Render chooses the available hostname; this repository does not assume one.

No TTS key, external AI subscription, trial, GitHub Actions secret, custom domain or separate database is required. The service reads the hosting-assigned `PORT`. Uploaded comics, SQLite data and audio caches persist at `/data`; model weights stay in the image. A single instance and worker are deliberate because the queue and database are local.

The same-origin frontend uses relative `/api` requests. Leave `VITE_API_URL` and `PANEL_ALLOWED_ORIGINS` unset for this deployment. The Blueprint explicitly disables the experimental paid vision adapter.

## Verify the public deployment

Open `<your HTTPS address>/api/health`. Expected fields include:

```json
{
  "status": "ok",
  "speech": true,
  "speechEngine": "kokoro",
  "castingEngine": "openclip",
  "voiceCount": 28,
  "emotionCount": 13,
  "sentimentEngine": "vader"
}
```

Then open **Actions → Verify hosted Panel → Run workflow** in this GitHub repository. Enter the exact HTTPS origin shown in the Render dashboard. The default check synthesizes eight voices in all 13 expression styles; select the full matrix to check all 28 × 13 combinations. These requests use the server's CPU and can take several minutes.

The workflow checks real PDF uploads, OCR, character continuity, editable casting, private-library isolation, rendered images and actual neural WAV output. Chromium then exercises discovery, the physical reader, narration auto-advance, uploaded dialogue, accessible reading preferences and phone-width layout. The browser test uses a fresh private library and removes its synthetic books. Validation reports and failure screenshots appear in the workflow's `hosted-validation` artifact. A successful local container check does not replace this public-site check.

From an environment with the verification dependencies installed, the API check can also be run directly:

```bash
python scripts/verify_deployment.py \
  --base-url https://YOUR_ACTUAL_HOSTNAME \
  --same-origin \
  --full-matrix \
  --report /tmp/panel-public-validation.json
```

`--same-origin` does not require a separate frontend CORS allowlist. For a split frontend/backend deployment, omit it and supply `--origin https://YOUR_FRONTEND_ORIGIN` instead.

## Updates and storage

Push changes to `main`. Render's `checksPass` trigger waits for repository checks before automatically deploying subsequent updates. The optional Pages workflow stays skipped until `PANEL_PAGES_ENABLED=true` is set, so an unconfigured Pages site does not block the Render release.

Use the same HTTPS hostname when reading: the private library key is stored in the browser under that origin. Download transcripts and retain the browser profile; this application has no account recovery or cross-device login. Configure persistent-disk backups in the hosting dashboard and verify restoration before relying on it as your only copy of a comic. Do not scale to multiple instances without migrating SQLite and the job queue to shared infrastructure.

A process restart should retain books, cast edits and narration because `/data` is persistent. Verify that manually in the hosting dashboard after the first upload. The public validation workflow does not restart a live service.

## If deployment fails

- **Build:** inspect the first failed Docker layer. Package/model downloads need outbound network access, and model checksum verification must remain enabled.
- **Health check:** inspect service logs and confirm the supplied `PORT`, `/api/health` readiness and the selected service memory.
- **Speech reports eSpeak:** check that Kokoro weights finished downloading to `/opt/panel-models` during the image build.
- **Library disappears after restart:** confirm the Blueprint's disk is mounted at `/data`; do not use an ephemeral free instance for durable uploads.
- **Render waits on GitHub checks:** inspect **Verify Panel** in Actions. Pages publishing is optional and disabled by default.
- **Public validation cannot connect:** wait for the host to become Live and use its exact HTTPS origin, without an API suffix or repository subpath.

Creating the service requires your hosting account and billing connection. Native Git push access in the development environment does not grant access to that account or to GitHub administration settings. Never paste a hosting API key into a GitHub issue, commit or chat.
