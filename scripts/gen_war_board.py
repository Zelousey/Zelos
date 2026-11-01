"""Makes the War board from the owner's reference artwork (2026-11-01: "copy the reference image
exactly, then we edit from there").

    python3 -I scripts/gen_war_board.py <reference.jpg>

Writes into webapp/src/features/war/board/:
  board.jpg            the artwork (1206 x 817)
  m-<sector>.png       each territory's exact shape (white = the territory), for recolouring by owner
  e-<sector>.png       a soft glow along each territory's edge, for the owner's border
  boardShapes.ts       rough outlines (tap targets) and label spots, in artwork pixels

Each territory in the art has its own colour. A rough outline (traced by hand below) says roughly
where each one is; every land pixel near a border then goes to whichever nearby territory's average
colour it matches best, so the shapes follow the art's real borders.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "webapp", "src", "features", "war", "board")

# Rough outlines traced on a 2x enlargement cropped at (400, 200); converted to art pixels below.
# Which sector each painted territory stands for (the art's real-company labels are covered).
ROUGH = {
    "tech": [(80, 290), (130, 180), (350, 130), (540, 180), (560, 300), (520, 380), (400, 400), (200, 410), (100, 400)],
    "utilities": [(540, 160), (800, 100), (1000, 140), (1060, 200), (1090, 300), (1050, 390), (880, 450), (720, 420), (600, 370), (520, 380), (560, 300)],
    "comms": [(1060, 200), (1150, 170), (1320, 140), (1460, 180), (1530, 280), (1550, 360), (1440, 420), (1290, 440), (1180, 390), (1050, 390), (1090, 300)],
    "consumer": [(100, 400), (200, 410), (400, 400), (520, 380), (540, 460), (500, 640), (400, 680), (220, 680), (100, 640), (80, 520)],
    "materials": [(520, 380), (600, 370), (720, 420), (880, 450), (870, 620), (900, 700), (700, 740), (620, 720), (500, 640), (540, 460)],
    "industrials": [(880, 450), (1050, 390), (1180, 390), (1290, 440), (1290, 560), (1240, 620), (1200, 700), (1090, 740), (900, 700), (870, 620)],
    "health": [(1290, 440), (1440, 420), (1560, 450), (1700, 560), (1780, 650), (1740, 780), (1640, 820), (1560, 800), (1420, 700), (1210, 690), (1240, 620), (1290, 560)],
    "finance": [(220, 680), (400, 680), (500, 640), (620, 720), (640, 880), (690, 960), (560, 1010), (420, 1000), (300, 860), (220, 720)],
    "energy": [(620, 720), (700, 740), (900, 700), (1090, 740), (1080, 900), (1140, 1000), (1040, 1060), (880, 1100), (720, 1050), (690, 960), (640, 880)],
    "realestate": [(1090, 740), (1200, 700), (1420, 700), (1560, 800), (1580, 880), (1520, 1000), (1360, 1040), (1160, 1040), (1140, 1000), (1080, 900)],
}
# Where the art's own label (logo, ticker, sector) sits: our label covers it.
LABEL = {"tech": (328, 247), "utilities": (585, 232), "comms": (815, 247), "consumer": (365, 367), "materials": (530, 362),
         "industrials": (732, 369), "health": (902, 410), "finance": (405, 497), "energy": (615, 520), "realestate": (817, 512)}


def art(p):
    return ((p[0] + 400) / 2, (p[1] + 200) / 2)


def alpha(m):
    """White with the shape as transparency (CSS masks read the alpha channel)."""
    out = Image.new("LA", m.size, 255)
    out.putalpha(m)
    return out


def main(src):
    os.makedirs(OUT, exist_ok=True)
    im = Image.open(src).convert("RGB")
    W, H = im.size
    im.save(os.path.join(OUT, "board.jpg"), quality=92)
    soft = np.asarray(im.filter(ImageFilter.GaussianBlur(3)), dtype=np.float32)
    lum = soft.mean(axis=2)
    ids = list(ROUGH)
    polys = {k: [art(p) for p in v] for k, v in ROUGH.items()}
    rough = {}
    for k, pts in polys.items():
        m = Image.new("L", (W, H), 0)
        ImageDraw.Draw(m).polygon(pts, fill=255)
        rough[k] = np.asarray(m) > 0
    # each territory's typical colour, from well inside its rough outline (away from labels)
    core = {}
    for k in ids:
        inner = np.asarray(Image.fromarray(rough[k].astype(np.uint8) * 255).filter(ImageFilter.MinFilter(31))) > 0
        lx, ly = LABEL[k]
        yy, xx = np.mgrid[0:H, 0:W]
        inner &= (abs(xx - lx) > 45) | (abs(yy - ly) > 45)
        core[k] = np.median(soft[inner], axis=0)
    # near borders: the nearby territory whose colour fits best
    near = {k: np.asarray(Image.fromarray(rough[k].astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(41))) > 0 for k in ids}
    cost = np.full((len(ids), H, W), np.inf, dtype=np.float32)
    for i, k in enumerate(ids):
        d = np.sqrt(((soft - core[k]) ** 2).sum(axis=2))
        d = np.where(rough[k], d * 0.8, d)  # a small pull towards the hand outline
        cost[i] = np.where(near[k], d, np.inf)
    best = cost.argmin(axis=0)
    land = np.isfinite(cost.min(axis=0)) & (lum > 34)  # the dark sea stays out
    own = [(best == i) & land for i in range(len(ids))]
    for i, k in enumerate(ids):
        # fill the holes the art's dark shadows and cities leave, without taking a neighbour's land
        m = Image.fromarray(own[i].astype(np.uint8) * 255).filter(ImageFilter.ModeFilter(9))
        closed = np.asarray(m.filter(ImageFilter.MaxFilter(31)).filter(ImageFilter.MinFilter(31))) > 0
        others = np.zeros_like(closed)
        for j in range(len(ids)):
            if j != i:
                others |= own[j]
        m = Image.fromarray((closed & ~others).astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(1.2))
        alpha(m).save(os.path.join(OUT, "m-%s.png" % k), optimize=True)
        edge = np.asarray(m.filter(ImageFilter.MaxFilter(5))).astype(np.int16) - np.asarray(m.filter(ImageFilter.MinFilter(5))).astype(np.int16)
        e = Image.fromarray(np.clip(edge * 2, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.5))
        alpha(e).save(os.path.join(OUT, "e-%s.png" % k), optimize=True)
    lines = ["/** Generated by scripts/gen_war_board.py from the owner's reference art. Don't edit by hand. */",
             "export const BOARD = { w: %d, h: %d };" % (W, H),
             "/** Rough outline (tap target) and the label spot of each territory, in art pixels. */",
             "export const SPOTS: Record<string, { pts: string; x: number; y: number }> = {"]
    for k in ids:
        lines.append("  %s: { x: %d, y: %d, pts: '%s' }," % (k, LABEL[k][0], LABEL[k][1], " ".join("%d,%d" % p for p in polys[k])))
    lines.append("};")
    with open(os.path.join(OUT, "boardShapes.ts"), "w") as f:
        f.write("\n".join(lines) + "\n")
    print("wrote", OUT)


if __name__ == "__main__":
    main(sys.argv[1])
