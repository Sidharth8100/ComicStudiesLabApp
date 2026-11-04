# Temporary-upload demo with a free compute allowance

The app can run with **ephemeral uploads**: PDFs, the SQLite library, cast edits and generated audio live only in the active server container. They disappear when that container is recycled. There is no persistent volume, paid TTS API or paid vision API.

The prepared option is **Modal**, using CPU inference, 4 GB RAM, one container at most, zero minimum containers and an idle scale-down window of 60 seconds. The entire frontend and API share one HTTPS address. Kokoro, OpenCLIP, OCR and sentiment remain enabled; the models are built into the image and do not need a persistent data volume.

This is **free within the compute allowance available to your account**, not unlimited free hosting. Check [Modal's current pricing](https://modal.com/pricing) and your account's billing conditions before deploying. Image builds, inference and active server time can consume the allowance. The one-container setting limits concurrency; it is not a monthly spending cap. Do not enable paid top-ups or assume usage beyond the included allowance is free.

## Deploy from GitHub

1. Create or sign into a [Modal account](https://modal.com/). Verify that its included compute allowance covers the demo you intend to run.
2. Create a Modal token for the intended workspace. Store its values as **`MODAL_TOKEN_ID`** and **`MODAL_TOKEN_SECRET`** in this repository's **Settings → Secrets and variables → Actions**. Keep both out of code, issue comments and chat.
3. Open **Actions → Deploy temporary comic demo → Run workflow**. The workflow builds the frontend and runs the pinned deployment SDK. Its successful output supplies the real HTTPS endpoint; no hostname is assumed here.
4. Open that endpoint and import a test comic. The import dialog and library display the temporary-storage notice. `/api/health` should report `storage: "temporary"`, `speechEngine: "kokoro"` and `castingEngine: "openclip"`.
5. Run **Verify hosted Panel** with the endpoint to check the actual public deployment. Leave the full voice matrix off for an initial check: even the smaller check generates 104 clips and consumes compute. The workflow only deletes its own synthetic test books.

The deployment workflow is manual. Pushing unrelated commits does not continually rebuild the demo or spend its compute allowance.

## Deploy from your own terminal

This alternative avoids adding deployment tokens to GitHub. In the repository, using Python 3.12 and Node 22:

```bash
npm ci --prefix frontend
npm run build --prefix frontend
python -m venv .hosting-env
.hosting-env/bin/pip install -r deploy/modal-requirements.txt
.hosting-env/bin/modal setup
.hosting-env/bin/modal deploy deploy/modal_app.py
```

The setup command connects your own account through Modal's supported authentication flow. The remote image installs and verifies model weights. It is not necessary to install the backend's ML packages in the deployment CLI environment.

## What “temporary” means

- A comic can remain available across page refreshes while the same server container is active. This is a stateful reading session on **ephemeral storage**, not an independent stateless request for every page.
- Inactivity, redeployment or platform recycling can remove all uploaded comics and edits. Idle shutdown timing is controlled by the platform, not an exact deletion timer.
- Everyone keeps their original PDF. This mode provides neither backups nor permanent library recovery. A browser's saved key and bookmarks cannot recover files after the container disappears.
- A visit after scale-down starts a fresh container and may involve a cold start. The next user must reimport a PDF if the old container was removed.
- A single container keeps a PDF's pages, character registry and assigned voices together while it is active. Adding replicas would require a shared store or a different architecture.
- Closing a browser tab is not an immediate deletion request. The existing comic-delete control remains available for immediate deletion of a finished comic.

## Other “free” options

GitHub Pages and static hosting can publish the current frontend, but cannot run its Python PDF/ML backend. A completely browser-only version could eliminate backend compute charges, but would require moving the processing pipeline into the browser and would use each reader's device resources.

A small free web-service instance is not enough RAM for the full local ML stack merely because the uploaded files are temporary. Hugging Face's current [Spaces documentation](https://huggingface.co/docs/hub/spaces-overview) also states that creating a new Docker Space requires a paid plan, despite CPU Basic having no hourly hardware charge; do not treat that as an unconditional free Docker-hosting route.

The Render Blueprint remains available for a durable library. It is a **paid** alternative and is not used by this temporary demo workflow.

## Validation status

The same backend and frontend are already exercised by local integration tests. The Modal definition can be inspected and imported using the pinned SDK, but a successful import is not a remote image build or a live deployment. Publishing and verifying this option requires a connected Modal account and an actual endpoint. No such deployment should be claimed until those steps succeed.
