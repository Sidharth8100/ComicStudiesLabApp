"""Offline sentiment and dialogue expression using VADER plus affect cues."""

import re
from functools import lru_cache
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer


@lru_cache(maxsize=1)
def analyzer():
    return SentimentIntensityAnalyzer()


def analyze_sentiment(text):
    scores = analyzer().polarity_scores(text)
    lower = text.lower()
    # Negation is also handled by VADER; avoid treating a negated emotion word
    # ("not angry") as an instruction to act angry.
    words = re.findall(r"[a-z']+", lower)
    active = " ".join(
        w
        for i, w in enumerate(words)
        if not any(
            n in ("not", "isnt", "isn't", "never") for n in words[max(0, i - 2) : i]
        )
    )
    if any(x in lower for x in ["yeah right", "as if!", "great, just great"]):
        label = "sarcastic"
    elif any(x in lower for x in ["whisper", "shh", "be quiet", "keep quiet"]):
        label = "whispering"
    elif any(
        x in active for x in ["afraid", "terrified", "scared", "frightened", "panic"]
    ):
        label = "fearful"
    elif any(x in active for x in ["angry", "furious", "hate", "rage"]) or any(
        x in lower for x in ["stop!", "get out!"]
    ):
        label = "angry"
    elif ("?" in text and "!" in text) or any(
        x in lower for x in ["what on earth", "oh wow", "unbelievable"]
    ):
        label = "surprised"
    elif any(
        x in active
        for x in ["sad", "alone", "sorry", "goodbye", "grief", "heartbroken", "lost"]
    ):
        label = "sad"
    elif any(x in lower for x in ["we can", "i believe", "there is hope", "i hope"]):
        label = "hopeful"
    elif any(
        x in lower for x in ["i've got this", "trust me", "i know what", "count on me"]
    ):
        label = "confident"
    elif any(x in active for x in ["breathe", "relax", "peaceful", "calm"]):
        label = "calm"
    elif scores["compound"] <= -0.45:
        label = "sad" if scores["neg"] < 0.65 else "angry"
    elif "!" in text:
        label = "excited"
    elif scores["compound"] >= 0.4:
        label = "joyful"
    elif any(x in active for x in ["danger", "careful", "hurry", "watch out"]):
        label = "tense"
    else:
        label = "neutral"
    strength = min(1.0, abs(scores["compound"]) + 0.1 * min(text.count("!"), 3))
    return {
        "emotion": label,
        "valence": round(scores["compound"], 3),
        "positive": round(scores["pos"], 3),
        "negative": round(scores["neg"], 3),
        "intensity": round(strength, 3),
        "method": "vader+affect-cues",
    }


def emotion(text):
    return analyze_sentiment(text)["emotion"]
