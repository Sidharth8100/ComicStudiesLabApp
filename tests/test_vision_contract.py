"""Provider contract tests use mocked responses; no paid/live API is contacted."""

import json
import httpx
import pytest
from backend import main as backend


def response_client(monkeypatch, payload, status=200):
    class Client:
        def __init__(self, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def post(self, url, **kwargs):
            assert url == "https://api.openai.com/v1/chat/completions"
            assert kwargs["json"]["response_format"] == {"type": "json_object"}
            return httpx.Response(
                status,
                json={"choices": [{"message": {"content": json.dumps(payload)}}]},
                request=httpx.Request("POST", url),
            )

    monkeypatch.setenv("PANEL_VISION_KEY", "mocked-provider-test-marker")
    monkeypatch.setattr(backend.httpx, "Client", Client)


def test_unconfigured_vision_does_not_contact_a_provider(monkeypatch, tmp_path):
    monkeypatch.delenv("PANEL_VISION_KEY", raising=False)
    assert backend.vision_lines(tmp_path / "missing.png", []) is None


def test_vision_maps_recurring_characters_and_voice_attributes(monkeypatch, tmp_path):
    image = tmp_path / "page.png"
    image.write_bytes(b"test-image-sent-only-to-mock")
    cast = [
        backend.character("NARRATOR", "Narrator"),
        backend.character("CHAR-01", "Nova", 1),
    ]
    payload = {
        "characters": [
            {
                "id": "CHAR-01",
                "name": "Nova",
                "voice": "deep",
                "age": "adult",
                "presentation": "feminine",
                "appearance": "Orange jacket",
            }
        ],
        "lines": [
            {
                "text": "We can do this!",
                "character": "CHAR-01",
                "emotion": "excited",
                "box": [0.1, 0.2, 0.7, 0.4],
            }
        ],
    }
    response_client(monkeypatch, payload)
    lines = backend.vision_lines(image, cast)
    assert len(cast) == 2 and cast[1]["id"] == "CHAR-01"
    assert cast[1]["voice"] == "bright" and cast[1]["appearance"] == "Orange jacket"
    assert lines[0]["character"] == "CHAR-01" and lines[0]["emotion"] == "excited"
    assert lines[0]["box"] == [0.1, 0.2, 0.7, 0.4]
    payload["characters"][0]["appearance"] = "Same orange jacket, new panel"
    backend.vision_lines(image, cast)
    assert len(cast) == 2 and cast[1]["id"] == "CHAR-01"


def test_vision_unknown_metadata_is_safely_normalized(monkeypatch, tmp_path):
    image = tmp_path / "page.png"
    image.write_bytes(b"mocked-image")
    cast = [backend.character("NARRATOR", "Narrator")]
    response_client(
        monkeypatch,
        {
            "characters": [{"id": "invalid", "name": "Ignore me"}],
            "lines": [
                {
                    "text": "A caption.",
                    "character": "missing",
                    "emotion": "invalid",
                    "box": [-1, 2],
                }
            ],
        },
    )
    line = backend.vision_lines(image, cast)[0]
    assert line["character"] == "NARRATOR" and line["emotion"] == "neutral"
    assert line["box"] == [0, 0, 1, 1] and len(cast) == 1


def test_vision_provider_failure_is_reported_to_the_fallback_caller(
    monkeypatch, tmp_path
):
    image = tmp_path / "page.png"
    image.write_bytes(b"mocked-image")
    response_client(monkeypatch, {}, status=503)
    with pytest.raises(httpx.HTTPStatusError):
        backend.vision_lines(image, [backend.character("NARRATOR", "Narrator")])
