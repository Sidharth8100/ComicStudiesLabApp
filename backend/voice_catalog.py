"""Distinct, free Kokoro English voices and editable fictional casting cues."""

# The five original API identifiers remain compatible with existing libraries.
_SPECS = [
    ("warm", "Atlas", "am_michael", "masculine", "adult", "warm"),
    ("bright", "Juniper", "af_heart", "feminine", "teen", "bright"),
    ("deep", "Orion", "bm_george", "masculine", "older adult", "deep"),
    ("soft", "Sage", "bf_emma", "feminine", "adult", "soft"),
    ("electric", "Echo", "am_echo", "unspecified", "unspecified", "robotic"),
    ("alloy", "Alloy", "af_alloy", "feminine", "adult", "steady"),
    ("aoede", "Aoede", "af_aoede", "feminine", "adult", "expressive"),
    ("bella", "Bella", "af_bella", "feminine", "adult", "warm"),
    ("jessica", "Jessica", "af_jessica", "feminine", "adult", "bright"),
    ("kore", "Kore", "af_kore", "feminine", "adult", "deep"),
    ("nicole", "Nicole", "af_nicole", "feminine", "adult", "soft"),
    ("nova", "Nova", "af_nova", "feminine", "teen", "bright"),
    ("river", "River", "af_river", "unspecified", "adult", "steady"),
    ("sarah", "Sarah", "af_sarah", "feminine", "adult", "warm"),
    ("sky", "Sky", "af_sky", "feminine", "teen", "bright"),
    ("adam", "Adam", "am_adam", "masculine", "adult", "deep"),
    ("eric", "Eric", "am_eric", "masculine", "adult", "steady"),
    ("fenrir", "Fenrir", "am_fenrir", "masculine", "adult", "deep"),
    ("liam", "Liam", "am_liam", "masculine", "teen", "bright"),
    ("onyx", "Onyx", "am_onyx", "masculine", "adult", "deep"),
    ("puck", "Puck", "am_puck", "masculine", "teen", "bright"),
    ("santa", "Santa", "am_santa", "masculine", "older adult", "warm"),
    ("alice", "Alice", "bf_alice", "feminine", "adult", "steady"),
    ("isabella", "Isabella", "bf_isabella", "feminine", "adult", "soft"),
    ("lily", "Lily", "bf_lily", "feminine", "teen", "bright"),
    ("daniel", "Daniel", "bm_daniel", "masculine", "adult", "warm"),
    ("fable", "Fable", "bm_fable", "masculine", "older adult", "expressive"),
    ("lewis", "Lewis", "bm_lewis", "masculine", "adult", "deep"),
]
VOICES = {}
for code, name, neural, presentation, age, tone in _SPECS:
    VOICES[code] = {
        "name": name,
        "neural": neural,
        "description": f"{tone.title()} · {age if age != 'unspecified' else 'animated'}",
        "presentation": presentation,
        "age": age,
        "tone": tone,
        "language": "en-gb" if neural[0] == "b" else "en-us",
        "voice": ("en-gb" if neural[0] == "b" else "en-us")
        + ("+f3" if presentation == "feminine" else "+m3"),
        "pitch": 32 if tone == "deep" else 64 if tone == "bright" else 48,
        "rate": 145 if tone in ("deep", "soft") else 165,
    }

# These are transparent prosody controls, not a claim of an emotion-trained model.
PROSODY = {
    "neutral": (1.0, 1.0, 1.0),
    "excited": (1.12, 1.045, 1.05),
    "angry": (1.08, 0.975, 1.08),
    "sad": (0.88, 0.965, 0.9),
    "whispering": (0.9, 0.985, 0.6),
    "surprised": (1.06, 1.065, 1.0),
    "joyful": (1.07, 1.035, 1.0),
    "fearful": (1.09, 1.045, 0.9),
    "hopeful": (1.02, 1.02, 1.0),
    "sarcastic": (0.94, 0.985, 1.0),
    "calm": (0.91, 0.985, 0.85),
    "confident": (0.98, 0.98, 1.05),
    "tense": (1.06, 1.015, 0.95),
}
EMOTIONS = {
    name: (round((pitch - 1) * 100), round((speed - 1) * 165))
    for name, (speed, pitch, volume) in PROSODY.items()
}


def allocate_voice(cast, attributes=None):
    """Allocate once per identity; automatic casting never reuses an occupied voice."""
    attrs = attributes or {}
    used = {VOICES[c["voice"]]["neural"] for c in cast if c.get("voice") in VOICES}
    candidates = [(key, v) for key, v in VOICES.items() if v["neural"] not in used]
    if not candidates:
        raise ValueError("The distinct voice pool is full")

    def score(item):
        key, v = item
        points = 0
        if attrs.get("kind") == "robot":
            points += 20 if v["tone"] == "robotic" else -3
        presentation = attrs.get("presentation", "unspecified")
        age = attrs.get("age", "unspecified")
        if presentation != "unspecified":
            points += (
                8
                if v["presentation"] == presentation
                else -5
                if v["presentation"] != "unspecified"
                else 0
            )
        if age != "unspecified":
            target = "teen" if age == "child" else age
            points += 5 if v["age"] == target else 0
            if age == "older adult" and v["tone"] in ("deep", "warm"):
                points += 2
            if age == "child" and v["tone"] == "bright":
                points += 2
        return points

    return max(candidates, key=score)[0]
