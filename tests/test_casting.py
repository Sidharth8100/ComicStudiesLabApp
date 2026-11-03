import numpy as np
import pytest
from backend.casting import CharacterRegistry, role_cues
from backend.voice_catalog import VOICES, allocate_voice
from backend.sentiment import analyze_sentiment, emotion


def narrator():
    return {"id": "NARRATOR", "name": "Narrator", "voice": "warm"}


def test_catalog_has_28_distinct_neural_voices():
    assert len(VOICES) == 28
    assert len({v["neural"] for v in VOICES.values()}) == 28
    assert all(v["language"] in ("en-us", "en-gb") for v in VOICES.values())


def test_voice_design_uses_age_and_presentation_without_reusing_a_voice():
    cast = [narrator()]
    old = allocate_voice(cast, {"age": "older adult", "presentation": "masculine"})
    assert (
        VOICES[old]["age"] == "older adult"
        and VOICES[old]["presentation"] == "masculine"
    )
    cast.append({"id": "CHAR-01", "name": "Grandpa", "voice": old})
    young = allocate_voice(cast, {"age": "child", "presentation": "feminine"})
    assert (
        VOICES[young]["presentation"] == "feminine"
        and VOICES[young]["tone"] == "bright"
    )
    assert young not in {c["voice"] for c in cast}
    assert role_cues("Grandfather") == {
        "age": "older adult",
        "presentation": "masculine",
    }


def test_visual_identity_keeps_one_voice_across_pages_even_when_cues_change():
    cast = [narrator()]
    r = CharacterRegistry(cast)
    first = np.array([1.0, 0.0, 0.0])
    same = np.array([0.999, 0.02, 0.0])
    same /= np.linalg.norm(same)
    code, _ = r.assign_vector(
        first, {"age": "adult", "presentation": "masculine"}, quality=0.1
    )
    assigned = cast[-1]["voice"]
    repeat, _ = r.assign_vector(
        same, {"age": "child", "presentation": "feminine"}, quality=0.1
    )
    assert repeat == code and len(cast) == 2
    assert cast[-1]["voice"] == assigned and cast[-1]["age"] == "adult"
    other, _ = r.assign_vector(
        np.array([0.0, 0.0, 1.0]), {"kind": "robot"}, quality=0.2
    )
    assert other != code and len({c["voice"] for c in cast}) == 3
    assert cast[-1]["voice"] == "electric"


def test_explicit_named_character_is_stable_without_visual_models():
    cast = [narrator()]
    r = CharacterRegistry(cast)
    code, _ = r.assign_vector(None, {}, name="Grandpa")
    repeated, _ = r.assign_vector(None, {}, name="Grandpa")
    assert code == repeated and len(cast) == 2
    assert cast[-1]["presentation"] == "masculine" and cast[-1]["age"] == "older adult"


def test_background_and_ambiguous_matches_remain_unassigned():
    cast = [narrator()]
    r = CharacterRegistry(cast)
    assert r.assign_vector(np.array([1.0, 0.0]), {}, quality=-0.1)[0] == "NARRATOR"
    a, _ = r.assign_vector(np.array([1.0, 0.0]), {}, name="One")
    b, _ = r.assign_vector(np.array([0.999, 0.04]), {}, name="Two")
    assert a != b
    assert r.assign_vector(np.array([1.0, 0.0]), {}, quality=0.1)[0] == "NARRATOR"


@pytest.mark.parametrize(
    "text,expected",
    [
        ("I am terrified.", "fearful"),
        ("I am furious!", "angry"),
        ("I am alone and heartbroken.", "sad"),
        ("Shh, keep quiet.", "whispering"),
        ("We can bring back the light.", "hopeful"),
        ("What?!", "surprised"),
        ("I love this wonderful place.", "joyful"),
        ("Yeah right, as if!", "sarcastic"),
        ("Take a breath and relax.", "calm"),
        ("I've got this. Trust me.", "confident"),
    ],
)
def test_sentiment_and_affect_produce_expressive_styles(text, expected):
    result = analyze_sentiment(text)
    assert result["emotion"] == expected
    assert -1 <= result["valence"] <= 1 and 0 <= result["intensity"] <= 1
    assert result["method"] == "vader+affect-cues"


def test_negation_does_not_treat_not_angry_as_anger():
    assert emotion("I am not angry.") != "angry"
    assert analyze_sentiment("This is wonderful!")["valence"] > 0
    assert analyze_sentiment("This is terrible.")["valence"] < 0


def test_real_openclip_tracks_original_comic_characters_across_pages():
    import cv2, cairosvg
    from backend.casting import MODEL_PATH, PageGeometry
    from backend.sample import artwork

    if not MODEL_PATH.exists():
        pytest.skip("OpenCLIP weights are not cached in this runner")
    images = [
        cv2.imdecode(
            np.frombuffer(cairosvg.svg2png(bytestring=artwork(i).encode()), np.uint8),
            cv2.IMREAD_COLOR,
        )
        for i in (1, 2)
    ]
    cast = [narrator()]
    registry = CharacterRegistry(cast)
    nova, _ = registry.assign(PageGeometry(images[0]), [0.08, 0.06, 0.55, 0.11])
    echo, _ = registry.assign(PageGeometry(images[0]), [0.12, 0.59, 0.62, 0.65])
    nova_again, _ = registry.assign(PageGeometry(images[1]), [0.08, 0.06, 0.6, 0.11])
    assert nova != "NARRATOR" and echo != "NARRATOR"
    assert nova == nova_again and nova != echo
    assert len({c["voice"] for c in cast}) == len(cast)


def test_frontend_voice_catalog_matches_backend():
    import json
    from pathlib import Path

    ui = json.loads(
        (Path(__file__).parents[1] / "frontend/src/voices.json").read_text()
    )
    assert ui == VOICES


def test_first_appearance_anchor_is_not_forgotten_on_later_pages():
    cast = [narrator()]
    r = CharacterRegistry(cast)
    anchor = np.array([1.0, 0.0, 0.0])
    code, _ = r.assign_vector(anchor, {}, name="Nova")
    for n in range(12):
        pose = np.array([0.8, float(n + 1) / 20, 0.2])
        pose /= np.linalg.norm(pose)
        r._observe(code, pose)
    assert np.array_equal(r.records[code][0], anchor)
    assert len(r.records[code]) == 5
    assert r.assign_vector(anchor, {}, quality=0.1)[0] == code
