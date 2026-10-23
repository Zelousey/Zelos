"""Hall of Minds portraits, v2: head-and-shoulders crops with headroom, background removed,
high-contrast black and white with film grain and soft edges (the owner's reference look)."""
import sys
import numpy as np
from PIL import Image, ImageFilter, ImageOps
from rembg import new_session, remove

RAW, OUT = sys.argv[1], sys.argv[2]
BOX = {  # (left, top, right, bottom) as fractions of the source image
    "aristotle": ("Aristotle_Altemps_Inv8575_jpg.jpg", (0.0, 0.0, 1.0, 0.78)),
    "caesar": ("Gaius_Iulius_Caesar_Vatican_Museum_jpg.jpg", (0.0, 0.0, 1.0, 0.62)),
    "napoleon": ("Jacques_Louis_David_The_Emperor_Napoleon_in_His_St.jpg", (0.18, 0.04, 0.82, 0.42)),
    "franklin": ("Joseph_Siffrein_Duplessis_Benjamin_Franklin_Google.jpg", (0.0, 0.02, 1.0, 0.9)),
    "tesla": ("Tesla_circa_1890_jpeg.jpg", (0.0, 0.0, 1.0, 0.85)),
    "edison": ("Thomas_Edison2_jpg.jpg", (0.2, 0.0, 1.0, 0.62)),
    "alexander": ("Alexander1256.jpg", (0.02, 0.0, 0.66, 0.36)),
}
sess = new_session("u2net_human_seg")
rng = np.random.default_rng(7)


def look(gray):
    """Punchy black and white: stretch, an S-curve, then fine grain."""
    g = np.asarray(ImageOps.autocontrast(gray, cutoff=1.5), dtype=np.float32) / 255.0
    g = 0.5 + (g - 0.5) * 1.18
    g = np.clip(g, 0, 1) ** 1.08
    g = g + rng.normal(0, 0.035, g.shape)
    return Image.fromarray((np.clip(g, 0, 1) * 255).astype(np.uint8), "L")


for fid, (f, (l, t, r, b)) in BOX.items():
    im = Image.open(f"{RAW}/{f}").convert("RGB")
    w, h = im.size
    im = im.crop((int(l * w), int(t * h), int(r * w), int(b * h)))
    cut = remove(im, session=sess)
    alpha = cut.split()[3].filter(ImageFilter.GaussianBlur(1.2))
    gray = look(cut.convert("L"))
    x0, y0, x1, y1 = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
    pad = int((y1 - y0) * 0.04)
    box = (max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), im.height)  # keep the bottom edge (cut by the card)
    la = Image.merge("LA", (gray, alpha)).crop(box)
    short = pad - (y0 - box[1])  # the head touches the top of the source: add the missing headroom
    if short > 0:
        tall = Image.new("LA", (la.width, la.height + short), (0, 0))
        tall.paste(la, (0, short))
        la = tall
    scale = 900 / la.height
    la = la.resize((int(la.width * scale), 900), Image.LANCZOS)
    la.convert("RGBA").save(f"{OUT}/{fid}.webp", quality=84, method=6)
    print(fid, la.size, "top headroom px", int((y0 - box[1]) * scale))
