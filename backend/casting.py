"""Free, offline visual casting with conservative cross-page identity tracking.

OpenCLIP embeddings describe fictional appearance, not biometric identity. Speech
balloon geometry proposes crops; ambiguous matches and demographic-like voice
cues remain editable proposals. Voices are allocated once, never per page.
"""

from pathlib import Path
import os
import threading
import re
import cv2
import numpy as np
from backend.voice_catalog import allocate_voice

MODEL_PATH = (
    Path(os.getenv("PANEL_MODEL_DIR", "/workspace/panel-models"))
    / "clip-vit-b32-laion400m.pt"
)
MODEL = None
MODEL_LOCK = threading.RLock()
PROMPTS = {
    "kind": {
        "person": "a cartoon illustration of a human head",
        "robot": "a cartoon robot face and body",
        "animal": "a comic book illustration of an animal character",
        "background": "an empty city skyline with buildings and no characters",
    },
    "age": {
        "child": "a young child character in a comic illustration",
        "teen": "a teenage character in a comic illustration",
        "adult": "an adult character in a comic illustration",
        "older adult": "an elderly character in a comic illustration",
    },
    "presentation": {
        "masculine": "a masculine male character in a comic illustration",
        "feminine": "a feminine female character in a comic illustration",
        "unspecified": "an androgynous character in a comic illustration",
    },
    "clothing": {
        c: f"a comic character wearing {c} clothing"
        for c in [
            "black",
            "white",
            "red",
            "orange",
            "yellow",
            "green",
            "blue",
            "purple",
            "grey",
        ]
    },
    "hair": {
        "dark hair": "a comic character with black or dark hair",
        "light hair": "a comic character with blond or light hair",
        "red hair": "a comic character with red hair",
        "grey hair": "a comic character with grey or white hair",
        "bald": "a bald comic character",
    },
}


def visual_available():
    return MODEL_PATH.is_file()


class VisualEncoder:
    def __init__(self):
        import torch
        import open_clip

        self.torch = torch
        self.model, _, self.preprocess = open_clip.create_model_and_transforms(
            "ViT-B-32-quickgelu", pretrained=str(MODEL_PATH), device="cpu"
        )
        self.model.eval()
        self.groups = {}
        self.labels = []
        offset = 0
        for group, values in PROMPTS.items():
            self.groups[group] = (offset, list(values))
            self.labels.extend(values.values())
            offset += len(values)
        self.background_offset = len(self.labels)
        self.labels.extend(
            [
                "an empty city skyline with buildings and no characters",
                "a forest landscape with trees and no characters",
                "only lettering and speech balloons on a blank page",
                "empty scenery with no people or animals",
            ]
        )
        tokens = open_clip.get_tokenizer("ViT-B-32-quickgelu")(self.labels)
        with torch.inference_mode():
            text = self.model.encode_text(tokens).float()
            self.text = (text / text.norm(dim=-1, keepdim=True)).numpy()

    def encode(self, crops):
        from PIL import Image

        batch = self.torch.stack(
            [
                self.preprocess(Image.fromarray(cv2.cvtColor(c, cv2.COLOR_BGR2RGB)))
                for c in crops
            ]
        )
        with self.torch.inference_mode():
            vectors = self.model.encode_image(batch).float()
            vectors = vectors / vectors.norm(dim=-1, keepdim=True)
        return vectors.numpy()

    def describe(self, vector):
        similarities = self.text @ vector
        attrs = {}
        certainty = {}
        for group, (offset, labels) in self.groups.items():
            scores = similarities[offset : offset + len(labels)]
            order = np.argsort(scores)[::-1]
            margin = float(scores[order[0]] - scores[order[1]])
            attrs[group] = labels[int(order[0])]
            certainty[group] = round(margin, 3)
            if group in ("age", "presentation") and margin < 0.018:
                attrs[group] = "unspecified"
        if attrs["kind"] != "person":
            attrs["age"] = attrs["presentation"] = "unspecified"
        attrs["appearance"] = (
            f"{attrs['kind'].title()}; {attrs['clothing']} clothing"
            + (f"; {attrs['hair']}" if attrs["kind"] == "person" else "")
        )
        attrs["attribute_confidence"] = certainty
        kind_offset, _ = self.groups["kind"]
        # Penalize scenery-heavy/edge-only crops. The strongest complete
        # character crop wins instead of a sliver of a face against a skyline.
        character_score = float(
            np.max(similarities[kind_offset : kind_offset + 3])
            - 0.75 * np.max(similarities[self.background_offset :])
        )
        return attrs, character_score


def encoder():
    global MODEL
    with MODEL_LOCK:
        if MODEL is None:
            MODEL = VisualEncoder()
        return MODEL


def role_cues(name):
    """Explicit fictional speaker labels can be stronger than an ambiguous crop."""
    n = name.lower()
    result = {}
    if re.search(r"\b(grandpa|grandfather|old man)\b", n):
        result.update(age="older adult", presentation="masculine")
    elif re.search(r"\b(grandma|grandmother|old woman)\b", n):
        result.update(age="older adult", presentation="feminine")
    elif re.search(r"\b(dad|father|papa|man|uncle)\b", n):
        result.update(age="adult", presentation="masculine")
    elif re.search(r"\b(mom|mum|mother|mama|woman|aunt)\b", n):
        result.update(age="adult", presentation="feminine")
    elif re.search(r"\b(boy|son)\b", n):
        result.update(age="child", presentation="masculine")
    elif re.search(r"\b(girl|daughter)\b", n):
        result.update(age="child", presentation="feminine")
    elif "robot" in n:
        result.update(kind="robot")
    return result


class PageGeometry:
    def __init__(self, image):
        self.image = image
        self.h, self.w = image.shape[:2]
        grey = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        _, white = cv2.threshold(grey, 220, 255, cv2.THRESH_BINARY)
        self.contours, _ = cv2.findContours(
            white, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE
        )

    def crops(self, box):
        x0, y0, x1, y1 = box
        cx = (x0 + x1) * self.w / 2
        tail_y = y1 * self.h
        text_area = max(1, (x1 - x0) * self.w * (y1 - y0) * self.h)
        balloons = []
        for contour in self.contours:
            area = cv2.contourArea(contour)
            if (
                text_area * 1.1 < area < self.w * self.h * 0.3
                and cv2.pointPolygonTest(
                    contour, (float(cx), float((y0 + y1) * self.h / 2)), False
                )
                >= 0
            ):
                balloons.append(contour)
        if balloons:
            contour = min(balloons, key=cv2.contourArea)
            bottom = contour[:, 0, :][np.argmax(contour[:, 0, 1])]
            cx, tail_y = float(bottom[0]), float(bottom[1])
        # Three crop proposals allow an off-centre balloon tail. CLIP rejects
        # pure lettering/background; no face detector trained only on photos is used.
        crops = []
        for dx in [0, -0.17, 0.17]:
            centre = cx + dx * self.w
            left = max(0, int(centre - 0.17 * self.w))
            right = min(self.w, int(centre + 0.17 * self.w))
            top = max(0, int(tail_y + 0.01 * self.h))
            bottom = min(self.h, int(tail_y + 0.39 * self.h))
            crop = self.image[top:bottom, left:right]
            if crop.size and min(crop.shape[:2]) > 30 and float(crop.std()) > 25:
                crops.append(crop)
        return crops


class CharacterRegistry:
    """One registry spans every page in a comic; a matched identity keeps its voice."""

    def __init__(self, cast):
        self.cast = cast
        self.records = {}

    def assign_vector(self, vector, attributes, name=None, quality=1.0):
        if name:
            existing = next(
                (c for c in self.cast if c["name"].casefold() == name.casefold()), None
            )
            if existing:
                if vector is not None:
                    self._observe(existing["id"], vector)
                return existing["id"], "text label"
        matches = []
        if vector is not None:
            for code, record in self.records.items():
                known = next(c for c in self.cast if c["id"] == code)
                if name and not known["name"].startswith("Character "):
                    continue
                similarity = max(float(np.dot(vector, v)) for v in record[-5:])
                matches.append((similarity, code))
        matches.sort(reverse=True)
        if (
            matches
            and matches[0][0] >= 0.9
            and (len(matches) == 1 or matches[0][0] - matches[1][0] >= 0.025)
        ):
            code = matches[0][1]
            self._observe(code, vector)
            character = next(c for c in self.cast if c["id"] == code)
            if name and character["name"].startswith("Character "):
                character["name"] = name
            # Do not change this character's voice, age or presentation on later pages.
            return code, "visual match · reviewable"
        if not name and (
            vector is None or quality < 0.005 or attributes.get("kind") == "background"
        ):
            return "NARRATOR", "unassigned"
        if not name and matches and matches[0][0] > 0.84:
            return "NARRATOR", "ambiguous visual match · assign in cast studio"
        if len(self.cast) >= 24:
            return "NARRATOR", "cast limit · assign in cast studio"
        visual_attributes = {} if attributes.get("kind") == "background" else attributes
        attrs = {**visual_attributes, **role_cues(name or "")}
        code = next(
            f"CHAR-{i:02d}"
            for i in range(1, 100)
            if all(c["id"] != f"CHAR-{i:02d}" for c in self.cast)
        )
        voice = allocate_voice(self.cast, attrs)
        self.cast.append(
            {
                "id": code,
                "name": name or f"Character {len(self.cast):02d}",
                "voice": voice,
                "age": attrs.get("age", "unspecified"),
                "presentation": attrs.get("presentation", "unspecified"),
                "appearance": attrs.get("appearance", ""),
                "kind": attrs.get("kind", "person"),
                "attribute_confidence": attrs.get("attribute_confidence", {}),
                "confidence": "text label" if name else "local visual proposal",
                "voice_assignment": "allocated once per identity",
            }
        )
        if vector is not None:
            self._observe(code, vector)
        return code, "text label" if name else "local visual proposal"

    def _observe(self, code, vector):
        self.records.setdefault(code, []).append(vector)
        # Keep the first appearance as an anchor, even after a long scene or
        # costume sequence; recent poses add coverage without forgetting it.
        gallery = self.records[code]
        self.records[code] = (
            gallery if len(gallery) <= 5 else [gallery[0], *gallery[-4:]]
        )

    def assign(self, geometry, box, name=None):
        if name:
            existing = next(
                (c for c in self.cast if c["name"].casefold() == name.casefold()), None
            )
            if existing:
                return existing["id"], "text label"
        if not visual_available():
            return self.assign_vector(None, {}, name=name, quality=0.0)
        crops = geometry.crops(box)
        if not crops:
            return self.assign_vector(None, {}, name=name, quality=0.0)
        with MODEL_LOCK:
            enc = encoder()
            vectors = enc.encode(crops)
            descriptions = [enc.describe(v) for v in vectors]
        index = max(range(len(crops)), key=lambda i: descriptions[i][1])
        attrs, quality = descriptions[index]
        return self.assign_vector(vectors[index], attrs, name=name, quality=quality)
