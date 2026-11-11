"""Owner-supplied portraits (2026-11-10): remove a baked-in transparency checkerboard (0 / 30 grey, 54px squares) from a JPEG.
Usage: python3 -I scripts/minds/decheck.py IN.jpg OUT.png ; then scripts/minds/finish.py ID OUT.png webapp/public/minds/ID.webp
Usage: decheck.py IN OUT_PNG [bottom_open]"""
import sys
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage as ndi

src = Image.open(sys.argv[1]).convert("RGB")
rgb = np.asarray(src)
g = np.asarray(src.convert("L")).astype(np.float32)
H, W = g.shape
P = 54

def phase(line):
    t = np.where(np.diff((line > 15).astype(int)) != 0)[0]
    return (t[0] + 1) % P

px, py = phase(g[2]), phase(g[:, 2])
first = 30.0 if g[2, 2] > 15 else 0.0
yy, xx = np.mgrid[0:H, 0:W]
cell = (((xx - px) // P) + ((yy - py) // P)) % 2
c0 = ((((2 - px) // P) + ((2 - py) // P)) % 2)
E = np.where(cell == c0, first, 30.0 - first)

# background candidate: matches the expected checker shade and is locally flat, and colourless
sat = rgb.max(2).astype(np.float32) - rgb.min(2)
loc = ndi.uniform_filter(g, 5)
var = ndi.uniform_filter(g * g, 5) - loc * loc
cand = (np.abs(g - E) < 9) & (var < 40) & (sat < 14)
# edges between squares are blurry in JPEG: allow pixels within 3px of a square boundary if dark
edge = (np.minimum((xx - px) % P, P - (xx - px) % P) < 3) | (np.minimum((yy - py) % P, P - (yy - py) % P) < 3)
cand |= edge & (g < 36) & (sat < 14) & (var < 300)
lab, n = ndi.label(cand)
seeds = set(np.unique(lab[0])) | set(np.unique(lab[:, 0])) | set(np.unique(lab[:, -1]))
if len(sys.argv) > 3:
    seeds |= set(np.unique(lab[-1]))
seeds.discard(0)
bg = np.isin(lab, list(seeds))
bg = ndi.binary_opening(bg, iterations=1)

# refine with GrabCut
mask = np.full((H, W), cv2.GC_PR_FGD, np.uint8)
mask[bg] = cv2.GC_BGD
mask[ndi.binary_dilation(bg, iterations=4) & ~bg] = cv2.GC_PR_BGD
core = ~ndi.binary_dilation(bg, iterations=10)
mask[core] = cv2.GC_FGD
bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
cv2.grabCut(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), mask, None, bgd, fgd, 4, cv2.GC_INIT_WITH_MASK)
fg = (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)
fg = ndi.binary_fill_holes(fg)
lab2, n2 = ndi.label(fg)
if n2 > 1:
    sizes = ndi.sum(fg, lab2, range(1, n2 + 1))
    fg = np.isin(lab2, [i + 1 for i, s in enumerate(sizes) if s > 0.02 * fg.sum()])
alpha = (fg * 255).astype(np.uint8)
out = np.dstack([rgb, alpha])
Image.fromarray(out, "RGBA").save(sys.argv[2])
print(sys.argv[1], "bg fraction", round(1 - fg.mean(), 3))
