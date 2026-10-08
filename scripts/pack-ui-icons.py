"""Pack every in-game picture into one sheet plus a frame JSON.

Same layout as Arrow's spritesheet.json: each name has a frame {x, y, w, h}.
Loose originals are copied to art/icon-sources/ first (not shipped). The
browser-tab favicon stays its own file, because a tab icon cannot be a slice.

The tap hand is a two-frame gif. Both frames sit on the sheet, and
animations.tap-hand tells the page how long to hold each one.
"""
import json
import shutil
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
SRC = ROOT / "art" / "icon-sources"
PAD = 2
MAX_W = 1024

# Edge length on the sheet. Chosen from the largest on-screen size, about 3x.
LOOSE = {
    "arrow-left": ("arrow-left.png", 128),
    "arrow-right": ("arrow-right.png", 128),
    "cart": ("cart.png", 160),
    "coin": ("coin.png", 128),
}


def backup() -> None:
    SRC.mkdir(parents=True, exist_ok=True)
    names = [
        "arrow-left.png",
        "arrow-right.png",
        "cart.png",
        "Coin.png",
        "crown.svg",
        "tap-to-play.gif",
        "ui-icons.png",
        "ui-icons.json",
    ]
    for name in names:
        src = PUBLIC / name
        dest = SRC / ("ui-icons-prev.png" if name == "ui-icons.png" else "ui-icons-prev.json" if name == "ui-icons.json" else name)
        if src.exists() and not dest.exists():
            shutil.copy2(src, dest)


def crop_prev(name: str) -> Image.Image:
    sheet = Image.open(SRC / "ui-icons-prev.png").convert("RGBA")
    meta = json.loads((SRC / "ui-icons-prev.json").read_text(encoding="utf-8"))
    f = meta["frames"][name]["frame"]
    return sheet.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))


def resized(path: Path, edge: int, trim: bool = False) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    if trim:
        box = im.getchannel("A").getbbox()
        if box:
            x0, y0, x1, y1 = box
            side = max(x1 - x0, y1 - y0)
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            half = side / 2 + 2
            x0 = int(round(cx - half))
            y0 = int(round(cy - half))
            side_px = int(round(half * 2))
            cropped = Image.new("RGBA", (side_px, side_px), (0, 0, 0, 0))
            src = im.crop((max(0, x0), max(0, y0), min(im.width, x0 + side_px), min(im.height, y0 + side_px)))
            cropped.paste(src, (max(0, -x0), max(0, -y0)))
            im = cropped
    return im.resize((edge, edge), Image.Resampling.LANCZOS)


def gif_frames(path: Path, edge: int) -> tuple[list[Image.Image], list[int]]:
    im = Image.open(path)
    frames: list[Image.Image] = []
    durations: list[int] = []
    for i in range(im.n_frames):
        im.seek(i)
        frames.append(im.convert("RGBA").resize((edge, edge), Image.Resampling.LANCZOS))
        durations.append(int(im.info.get("duration") or 500))
    return frames, durations


def shelf(images: list[tuple[str, Image.Image]]) -> tuple[dict, Image.Image]:
    ordered = sorted(images, key=lambda item: item[1].height, reverse=True)
    x = y = PAD
    row_h = 0
    width = 0
    frames: dict[str, tuple[int, int, int, int]] = {}
    for name, im in ordered:
        if x > PAD and x + im.width + PAD > MAX_W:
            y += row_h + PAD
            x = PAD
            row_h = 0
        frames[name] = (x, y, im.width, im.height)
        x += im.width + PAD
        row_h = max(row_h, im.height)
        width = max(width, x)
    height = y + row_h + PAD
    sheet = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for name, im in images:
        fx, fy, _, _ = frames[name]
        sheet.paste(im, (fx, fy), im)
    return frames, sheet


def main() -> None:
    backup()
    subprocess.run(["node", "scripts/raster-crown.mjs"], cwd=ROOT, check=True)

    images: list[tuple[str, Image.Image]] = []
    for name in ("lock-icon", "settings-gear", "stats-icon", "sparkle-star"):
        images.append((name, crop_prev(name)))
    for name, (filename, edge) in LOOSE.items():
        images.append((name, resized(SRC / filename, edge, trim=name == "coin")))
    images.append(("crown", Image.open(SRC / "crown.png").convert("RGBA")))
    hands, durations = gif_frames(SRC / "tap-to-play.gif", 320)
    for i, frame in enumerate(hands):
        images.append((f"tap-hand-{i}", frame))

    frames, sheet = shelf(images)
    out_png = PUBLIC / "ui-icons.png"
    sheet.save(out_png, optimize=True, compress_level=9)

    def entry(name: str) -> dict:
        fx, fy, fw, fh = frames[name]
        return {
            "frame": {"x": fx, "y": fy, "w": fw, "h": fh},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": fw, "h": fh},
            "sourceSize": {"w": fw, "h": fh},
        }

    data = {
        "frames": {name: entry(name) for name, _ in images},
        "animations": {
            "tap-hand": {
                "frames": [f"tap-hand-{i}" for i in range(len(hands))],
                "durations": durations,
            }
        },
        "meta": {
            "app": "scripts/pack-ui-icons.py",
            "version": "1.0",
            "image": "ui-icons.png",
            "format": "RGBA8888",
            "size": {"w": sheet.width, "h": sheet.height},
            "scale": 1,
        },
    }
    (PUBLIC / "ui-icons.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out_png} ({out_png.stat().st_size} bytes) {sheet.size}")


if __name__ == "__main__":
    main()
