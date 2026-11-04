"""Exercise a running deployment using synthetic comics and a temporary private library.

Never reads an existing user's library. Optional container restart requires the
explicit panel.validation=true label. Test credentials are never printed or saved.
"""

import argparse
import hashlib
import io
import json
from pathlib import Path
import secrets
import subprocess
import time
from urllib.parse import urlparse

import cv2
import fitz
import httpx
import numpy as np
import soundfile as sf


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--report", default="/tmp/panel-deployment-report.json")
    parser.add_argument("--docker-container")
    parser.add_argument("--origin", default="https://sidharth8100.github.io")
    parser.add_argument(
        "--same-origin",
        action="store_true",
        help="Validate a full-stack site without requiring a separate CORS origin",
    )
    parser.add_argument(
        "--full-matrix",
        action="store_true",
        help="Synthesize all 28 voices in all 13 expression styles",
    )
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    results = []
    book_ids = []
    auth = {"Authorization": "Bearer " + secrets.token_hex(32)}
    other = {"Authorization": "Bearer " + secrets.token_hex(32)}
    docker = ["docker", "--host=unix:///var/run/docker.sock"]

    def check(name, condition):
        if not condition:
            raise AssertionError(name)
        results.append({"check": name, "status": "passed"})
        print("PASS", name, flush=True)

    def wait_ready(client, book_id):
        until = time.monotonic() + 180
        while time.monotonic() < until:
            b = client.get(base + "/api/books/" + book_id, headers=auth).json()
            if b["status"] == "ready":
                return b
            if b["status"] == "error":
                raise AssertionError("PDF analysis failed")
            time.sleep(0.3)
        raise AssertionError("PDF analysis timeout")

    def upload(client, blob, name):
        r = client.post(
            base + "/api/books",
            headers=auth,
            files={"file": (name, blob, "application/pdf")},
        )
        check(name + " accepted asynchronously", r.status_code == 202)
        book_id = r.json()["id"]
        book_ids.append(book_id)
        return wait_ready(client, book_id)

    try:
        with httpx.Client(timeout=120) as c:
            h = c.get(base + "/api/health")
            check(
                "health and local neural engine",
                h.status_code == 200
                and h.json()["speechEngine"] == "kokoro"
                and h.json()["speech"],
            )
            check("frontend document served", c.get(base + "/").status_code == 200)
            profiles = c.get(base + "/api/voices").json()
            styles = c.get(base + "/api/emotions").json()
            check(
                "28 distinct voice profiles",
                len(profiles) == 28
                and len({v["neural"] for v in profiles.values()}) == 28,
            )
            check("13 available expression styles", len(styles) == 13)
            check(
                "local visual casting engine is present",
                h.json().get("castingEngine") == "openclip",
            )
            check(
                "library requires authorization",
                c.get(base + "/api/books").status_code == 401,
            )
            cors_checks = [("https://untrusted.invalid", False)]
            if not args.same_origin:
                cors_checks.insert(0, (args.origin, True))
            for origin, expected in cors_checks:
                r = c.options(
                    base + "/api/books",
                    headers={
                        "Origin": origin,
                        "Access-Control-Request-Method": "POST",
                        "Access-Control-Request-Headers": "authorization,content-type",
                    },
                )
                check(
                    "CORS "
                    + (
                        "allows configured origin"
                        if expected
                        else "denies unconfigured origin"
                    ),
                    r.status_code == 200
                    and r.headers.get("access-control-allow-origin") == origin
                    if expected
                    else r.status_code in (400, 405)
                    and "access-control-allow-origin" not in r.headers,
                )
            bad = c.post(
                base + "/api/books",
                headers=auth,
                files={"file": ("invalid.pdf", b"not a PDF", "application/pdf")},
            )
            check("invalid PDF rejected", bad.status_code == 400)
            with fitz.open() as d:
                for text in [
                    "Ada: Welcome to the city!",
                    "Ada: We can bring back the light.",
                ]:
                    d.new_page().insert_text((40, 60), text)
                native = d.tobytes()
            b = upload(c, native, "deployment-native.pdf")
            bid = b["id"]
            root = base + "/api/books/" + bid
            check("native PDF page count", b["pageCount"] == 2 and len(b["pages"]) == 2)
            ids = [p["lines"][0]["character"] for p in b["pages"]]
            check(
                "named character continuity across pages",
                ids[0] == ids[1] and ids[0] != "NARRATOR",
            )
            check(
                "native dialogue extracted",
                b["pages"][0]["lines"][0]["text"] == "Welcome to the city!",
            )
            for suffix in [
                "",
                "/pages/0",
                "/speech/" + b["pages"][0]["lines"][0]["id"],
            ]:
                check(
                    "cross-library access denied " + (suffix or "metadata"),
                    c.get(root + suffix, headers=other).status_code == 404,
                )
            img = c.get(root + "/pages/0", headers=auth)
            check(
                "rendered PNG and safe response headers",
                img.status_code == 200
                and img.content.startswith(b"\x89PNG")
                and img.headers.get("x-content-type-options") == "nosniff",
            )
            new = {
                "name": "Comet",
                "voice": "electric",
                "age": "teen",
                "presentation": "unspecified",
                "appearance": "Blue jacket",
            }
            r = c.post(root + "/characters", headers=auth, json=new)
            check(
                "new character creation",
                r.status_code == 200 and r.json()["characters"][-1]["name"] == "Comet",
            )
            code = ids[0]
            line = b["pages"][0]["lines"][0]
            line_id = line["id"]
            clip_hashes = set()
            matrix_voices = (
                list(profiles)
                if args.full_matrix
                else [
                    "warm",
                    "bright",
                    "deep",
                    "soft",
                    "electric",
                    "santa",
                    "liam",
                    "isabella",
                ]
            )
            for voice in matrix_voices:
                current = c.get(root, headers=auth).json()
                holder = next(
                    (
                        character
                        for character in current["characters"]
                        if character["voice"] == voice
                    ),
                    None,
                )
                active_code = holder["id"] if holder else code
                edit = {
                    "name": "Ada",
                    "voice": voice,
                    "age": "adult",
                    "presentation": "unspecified",
                    "appearance": "Synthetic validation character",
                }
                check(
                    "save voice " + voice,
                    c.patch(
                        root + "/characters/" + active_code, headers=auth, json=edit
                    ).status_code
                    == 200,
                )
                for emotion in styles:
                    patch = {
                        "text": "A whole new world awaits!",
                        "character": active_code,
                        "emotion": emotion,
                    }
                    r = c.patch(root + "/lines/" + line_id, headers=auth, json=patch)
                    check(f"save expression {voice}/{emotion}", r.status_code == 200)
                    wave = c.get(root + "/speech/" + line_id, headers=auth)
                    check(
                        f"generate WAV {voice}/{emotion}",
                        wave.status_code == 200 and wave.content.startswith(b"RIFF"),
                    )
                    audio, rate = sf.read(io.BytesIO(wave.content))
                    check(
                        f"audible neural audio {voice}/{emotion}",
                        rate == 24000
                        and len(audio) > 0.2 * rate
                        and np.max(np.abs(audio)) > 0.01,
                    )
                    clip_hashes.add(hashlib.sha256(wave.content).hexdigest())
            check(
                "different voice/expression settings produce different audio",
                len(clip_hashes) == len(matrix_voices) * len(styles),
            )
            repeat = c.get(root + "/speech/" + line_id, headers=auth)
            check(
                "unchanged narration uses stable cached output",
                repeat.content == wave.content,
            )
            image = np.full((240, 900, 3), 255, dtype=np.uint8)
            cv2.putText(
                image,
                "HELLO COMICS",
                (30, 140),
                cv2.FONT_HERSHEY_SIMPLEX,
                2.2,
                (0, 0, 0),
                4,
                cv2.LINE_AA,
            )
            ok, png = cv2.imencode(".png", image)
            assert ok
            with fitz.open() as d:
                p = d.new_page(width=675, height=180)
                p.insert_image(p.rect, stream=png.tobytes())
                scanned = d.tobytes()
            scan = upload(c, scanned, "deployment-scanned.pdf")
            text = " ".join(
                l["text"] for p in scan["pages"] for l in p["lines"]
            ).upper()
            check(
                "scanned PDF OCR runs inside the production image",
                "HELLO" in text and "COMICS" in text,
            )
            if args.docker_container:
                labels = json.loads(
                    subprocess.check_output(
                        docker
                        + [
                            "inspect",
                            args.docker_container,
                            "--format",
                            "{{json .Config.Labels}}",
                        ],
                        text=True,
                    )
                )
                if labels.get("panel.validation") != "true":
                    raise RuntimeError("Refusing to restart an unlabeled container")
                subprocess.run(
                    docker + ["restart", args.docker_container],
                    check=True,
                    stdout=subprocess.DEVNULL,
                )
                until = time.monotonic() + 60
                while time.monotonic() < until:
                    try:
                        if c.get(base + "/api/health").status_code == 200:
                            break
                    except httpx.HTTPError:
                        pass
                    time.sleep(0.5)
                restored = c.get(root, headers=auth)
                check(
                    "uploaded book survives process restart",
                    restored.status_code == 200
                    and restored.json()["status"] == "ready",
                )
                restored = restored.json()
                check(
                    "cast and edited dialogue survive restart",
                    next(x for x in restored["characters"] if x["id"] == active_code)[
                        "voice"
                    ]
                    == matrix_voices[-1]
                    and restored["pages"][0]["lines"][0]["emotion"] == styles[-1],
                )
                check(
                    "cached speech survives process restart",
                    c.get(root + "/speech/" + line_id, headers=auth).content
                    == repeat.content,
                )
            for book_id in book_ids[:]:
                r = c.delete(base + "/api/books/" + book_id, headers=auth)
                check(
                    "test comic deletion removes API access",
                    r.status_code == 204
                    and c.get(base + "/api/books/" + book_id, headers=auth).status_code
                    == 404,
                )
                book_ids.remove(book_id)
            check(
                "temporary library is empty after cleanup",
                c.get(base + "/api/books", headers=auth).json() == [],
            )
    except Exception as e:
        results.append(
            {"check": "validation stopped", "status": "failed", "detail": str(e)[:300]}
        )
        raise
    finally:
        # Failed public checks must not leave completed synthetic uploads behind.
        if book_ids:
            with httpx.Client(timeout=30) as cleanup_client:
                for book_id in book_ids[:]:
                    try:
                        deleted = cleanup_client.delete(
                            base + "/api/books/" + book_id, headers=auth
                        )
                        if deleted.status_code in (204, 404):
                            book_ids.remove(book_id)
                        else:
                            results.append(
                                {
                                    "check": "temporary comic cleanup",
                                    "status": "failed",
                                    "detail": f"HTTP {deleted.status_code}",
                                }
                            )
                    except httpx.HTTPError:
                        results.append(
                            {
                                "check": "temporary comic cleanup",
                                "status": "failed",
                                "detail": "Host unreachable during cleanup",
                            }
                        )
        remote = urlparse(base).hostname not in ("127.0.0.1", "localhost")
        report = {
            "target": base,
            "scope": "local production container"
            if urlparse(base).hostname in ("127.0.0.1", "localhost")
            else "remote deployment",
            "checks": results,
            "passed": sum(r["status"] == "passed" for r in results),
            "failed": sum(r["status"] == "failed" for r in results),
            "not_run": [
                "Live external vision provider: no configured credential",
                *(
                    []
                    if remote
                    else ["Public hosting: this run targeted a local service"]
                ),
                *(
                    []
                    if args.docker_container
                    else ["Process restart persistence: no labeled test container supplied"]
                ),
            ],
        }
        path = Path(args.report)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(report, indent=2) + "\n")
    print("Deployment checks passed:", len(results))


if __name__ == "__main__":
    main()
