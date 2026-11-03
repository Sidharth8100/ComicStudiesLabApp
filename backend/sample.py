"""Original procedural comic artwork. No copyrighted sample books or external assets."""

import html
from pathlib import Path
import random
import time
import uuid
import cairosvg
import fitz


def city(seed=5, y=750, color="#141e35"):
    rng = random.Random(seed)
    result = []
    for x in range(-20, 950, 43):
        h = rng.randint(100, 390)
        w = rng.randint(30, 60)
        result.append(
            f'<rect x="{x}" y="{y - h}" width="{w}" height="{h}" fill="{color}"/>'
        )
        if rng.random() > 0.7:
            result.append(
                f'<path d="M{x + 15} {y - h}v-65" stroke="{color}" stroke-width="3"/>'
            )
        for wy in range(y - h + 15, y - 15, 26):
            for wx in range(x + 7, x + w - 5, 13):
                if rng.random() > 0.4:
                    result.append(
                        f'<rect x="{wx}" y="{wy}" width="4" height="9" fill="{rng.choice(["#ffc78c", "#ad81cb", "#4ca6a6"])}" opacity=".65"/>'
                    )
    return "".join(result)


def nova(x=460, y=560, scale=1):
    return f"""<g transform="translate({x} {y}) scale({scale})">
    <path d="M-95 170 Q-85 70 -45 48L44 48Q105 83 117 170Z" fill="#d86235" stroke="#111c2c" stroke-width="5"/>
    <path d="M-44 48L-10 90 10 90 44 48 63 160H-65Z" fill="#132f3f"/>
    <path d="M-40 48L-14 77 8 87 36 48V4H-33Z" fill="#d99873" stroke="#152338" stroke-width="4"/>
    <path d="M-55-46Q-42-108 21-100Q73-91 67-27L49 20Q16 65-27 29Z" fill="#ecb48d" stroke="#162338" stroke-width="5"/>
    <path d="M-59-27Q-83-97-24-123Q40-143 73-83L56-14 38-75Q-4-31-55-40L-59 26-77 37Z" fill="#14202e" stroke="#111925" stroke-width="5"/>
    <path d="M-53-75Q-29-111 22-112M-65-41Q-60-68-42-84" fill="none" stroke="#406172" stroke-width="7"/>
    <path d="M-28-12l19-1M19-15l18-2M0-3l-7 22 12 1M-8 34q16 6 27-6" fill="none" stroke="#382b35" stroke-width="4"/>
    <path d="M-81 95l35 11M68 92l26 14M-70 125l-7 42" fill="none" stroke="#ffb478" stroke-width="5"/>
    <circle cx="40" cy="17" r="4" fill="#57e5d1"/><path d="M-12 91l8 68" stroke="#efc386" stroke-width="3"/></g>"""


def echo(x=150, y=680, scale=1):
    return f"""<g transform="translate({x} {y}) scale({scale})"><path d="M-49 24L-60 100 52 100 44 24" fill="#8db5b5" stroke="#101f32" stroke-width="5"/><rect x="-53" y="-58" width="105" height="86" rx="22" fill="#c3d9cf" stroke="#122435" stroke-width="6"/><rect x="-42" y="-37" width="84" height="43" rx="16" fill="#143442"/><circle cx="-20" cy="-17" r="7" fill="#b9f663"/><circle cx="20" cy="-17" r="7" fill="#b9f663"/><path d="M0-59v-27" stroke="#1a3645" stroke-width="6"/><circle cx="0" cy="-89" r="7" fill="#e99f56"/><path d="M-30 55H27M-14 69H13" stroke="#4c7c86" stroke-width="7"/><path d="M-56 43l-30 39M49 42l29 34" stroke="#96b8b6" stroke-width="17"/></g>"""


def bubble(text, x, y, width=350):
    words = text.split()
    lines = []
    cur = ""
    for w in words:
        if len(cur + " " + w) > int(width / 12):
            lines.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    if cur:
        lines.append(cur)
    height = 28 * len(lines) + 40
    return (
        f'<g><rect x="{x}" y="{y}" width="{width}" height="{height}" rx="24" fill="#fffaf0" stroke="#162434" stroke-width="4"/><path d="M{x + width * 0.55} {y + height - 2}l-20 32 52-32" fill="#fffaf0" stroke="#162434" stroke-width="4"/>'
        + "".join(
            f'<text x="{x + width / 2}" y="{y + 33 + i * 28}" text-anchor="middle" fill="#182435" font-family="sans-serif" font-weight="700" font-size="22">{html.escape(l)}</text>'
            for i, l in enumerate(lines)
        )
        + "</g>"
    )


def artwork(page=0):
    defs = """<defs><linearGradient id="sky" x2=".2" y2="1"><stop stop-color="#202943"/><stop offset=".45" stop-color="#b16c91"/><stop offset="1" stop-color="#ffb86e"/></linearGradient><linearGradient id="sunset" x2="0" y2="1"><stop stop-color="#da7e67"/><stop offset="1" stop-color="#f4c98d"/></linearGradient><pattern id="dots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="#101e2b" opacity=".18"/></pattern></defs>"""
    if page == 0:
        content = f"""<rect width="900" height="1200" fill="url(#sky)"/><circle cx="630" cy="460" r="190" fill="#f8c084" opacity=".9"/><path d="M0 425L900 145M0 500L900 220" stroke="#e9c0b3" stroke-width="3" opacity=".3"/>{city(5, 900, "#35405b")}{city(8, 1090, "#15283b")}
        <text x="56" y="70" font-size="21" fill="#ffe9cd" font-family="sans-serif" letter-spacing="9">A PANEL ORIGINAL · ISSUE 001</text>
        <g fill="#fff0d6" font-family="sans-serif" font-weight="900" font-size="139" letter-spacing="-7"><text x="48" y="220">AFTER</text><text x="48" y="345">THE LIGHT</text></g>
        {nova(515, 805, 2.2)}{echo(195, 970, 1.35)}
        <rect y="1114" width="900" height="86" fill="#122c35"/><text x="48" y="1166" font-size="23" fill="#faeacd" font-family="sans-serif" letter-spacing="4">SOME STORIES BEGIN AT THE END.</text><rect width="900" height="1200" fill="url(#dots)"/>"""
    else:
        dialogues = [
            [],
            [
                ("The city forgot how to dream.", 50, 62, 510),
                ("Maybe it just needs someone to remind it.", 90, 700, 530),
            ],
            [
                ("Do you really think we can bring it back?", 50, 65, 540),
                ("One small light can change everything!", 100, 680, 540),
            ],
            [
                ("There. Can you see it?", 50, 60, 470),
                ("I can. And this time, we are not alone.", 80, 700, 600),
            ],
        ]
        content = f'<rect width="900" height="1200" fill="#f8edda"/><rect x="22" y="22" width="856" height="570" fill="url(#sky)" stroke="#172736" stroke-width="7"/><circle cx="680" cy="300" r="140" fill="#f3b386"/>{city(9 + page, 580, "#263348")}<rect x="22" y="620" width="856" height="548" fill="url(#sunset)" stroke="#172736" stroke-width="7"/>'
        content += (
            nova(520, 470, 1.15)
            + echo(730, 500, 0.8)
            + city(page, 1160, "#283a47")
            + nova(640, 1000, 1.3)
            + echo(220, 1000, 1.05)
        )
        if page == 3:
            content += '<path d="M445 1020Q460 840 480 970T520 950" fill="none" stroke="#cfff9e" stroke-width="13"/><circle cx="478" cy="947" r="26" fill="#cfff9e" opacity=".7"/>'
        for text, x, y, w in dialogues[page]:
            content += bubble(text, x, y, w)
        content += f'<text x="850" y="1191" text-anchor="end" font-family="sans-serif" font-size="16" fill="#172736">AFTER THE LIGHT / {page:02d}</text>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">{defs}{content}</svg>'


def make_demo(data: Path, book_id: str):
    folder = data / book_id
    folder.mkdir()
    dialogues = [
        [("Narrator", "Some stories begin at the end.", "neutral")],
        [
            ("Nova", "The city forgot how to dream.", "sad"),
            ("Echo", "Maybe it just needs someone to remind it.", "neutral"),
        ],
        [
            ("Nova", "Do you really think we can bring it back?", "surprised"),
            ("Echo", "One small light can change everything!", "excited"),
        ],
        [
            ("Nova", "There. Can you see it?", "whispering"),
            ("Echo", "I can. And this time, we are not alone.", "excited"),
        ],
    ]
    ids = {"Narrator": "NARRATOR", "Nova": "CHAR-01", "Echo": "CHAR-02"}
    pages = []
    pdf = fitz.open()
    for i in range(4):
        png = cairosvg.svg2png(bytestring=artwork(i).encode())
        (folder / f"page-{i}.png").write_bytes(png)
        p = pdf.new_page(width=675, height=900)
        p.insert_image(p.rect, stream=png)
        pages.append(
            {
                "index": i,
                "width": 900,
                "height": 1200,
                "lines": [
                    {
                        "id": uuid.uuid4().hex,
                        "text": text,
                        "character": ids[name],
                        "emotion": emo,
                        "box": [0.05, 0.05 + j * 0.53, 0.8, 0.25 + j * 0.53],
                        "confidence": 1.0,
                        "assignment": "authored",
                    }
                    for j, (name, text, emo) in enumerate(dialogues[i])
                ],
            }
        )
    pdf.save(folder / "source.pdf")
    pdf.close()
    from backend.main import character

    return {
        "id": book_id,
        "title": "After the Light",
        "created": time.time(),
        "status": "ready",
        "progress": 100,
        "pageCount": 4,
        "pages": pages,
        "characters": [
            character("NARRATOR", "Narrator", 0, confidence="authored"),
            character(
                "CHAR-01",
                "Nova",
                1,
                appearance="Dark hair, terracotta jacket, turquoise earring",
                age="adult",
                presentation="feminine",
                confidence="authored",
            ),
            character(
                "CHAR-02",
                "Echo",
                4,
                appearance="Small silver robot, luminous green eyes",
                confidence="authored",
            ),
        ],
        "engine": "authored",
        "demo": True,
        "notice": None,
    }


if __name__ == "__main__":
    out = Path(__file__).resolve().parents[1] / "frontend/public"
    out.mkdir(exist_ok=True)
    for i in range(4):
        (out / f"comic-{i}.svg").write_text(artwork(i))
