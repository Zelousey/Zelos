"""Same finishing as scripts/minds/portraits.py, for an already cut-out RGBA PNG."""
import sys
import numpy as np
from PIL import Image, ImageFilter, ImageOps

rng = np.random.default_rng(7)
EXP = {"alexander": 1.15}


def look(gray, exp=1.08):
    g = np.asarray(ImageOps.autocontrast(gray, cutoff=0.5), dtype=np.float32) / 255.0
    g = 0.5 + (g - 0.5) * 1.05
    g = np.clip(g, 0, 1) ** exp
    g = g + rng.normal(0, 0.03, g.shape)
    return Image.fromarray((np.clip(g, 0, 1) * 255).astype(np.uint8), "L")


fid, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
cut = Image.open(src).convert("RGBA")
alpha = cut.split()[3]
# drop the dark JPEG fringe, then soften the edge
alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.0))
up = 3
big = cut.resize((cut.width * up, cut.height * up), Image.LANCZOS)
alpha = alpha.resize(big.size, Image.LANCZOS)
gray = look(big.convert("L"), EXP.get(fid, 1.08))
x0, y0, x1, y1 = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
pad = int((y1 - y0) * 0.04)
box = (max(0, x0 - pad), max(0, y0 - pad), min(big.width, x1 + pad), big.height)
la = Image.merge("LA", (gray, alpha)).crop(box)
short = pad - (y0 - box[1])
if short > 0:
    tall = Image.new("LA", (la.width, la.height + short), (0, 0))
    tall.paste(la, (0, short))
    la = tall
scale = 900 / la.height
la = la.resize((int(la.width * scale), 900), Image.LANCZOS)
la.convert("RGBA").save(out, quality=84, method=6)
print(fid, la.size)
