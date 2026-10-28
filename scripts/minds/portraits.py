"""Hall of Minds portraits, v2: head-and-shoulders crops with headroom, background removed,
high-contrast black and white with film grain and soft edges (the owner's reference look)."""
import sys
import numpy as np
from PIL import Image, ImageFilter, ImageOps
from rembg import new_session, remove

RAW, OUT = sys.argv[1], sys.argv[2]  # argv[3]: Real-ESRGAN weights (for UPSCALE), argv[4]: only these ids
BOX = {  # (left, top, right, bottom) as fractions of the source image
    "aristotle": ("Aristotle_Altemps_Inv8575_jpg.jpg", (0.0, 0.0, 1.0, 0.78)),
    "caesar": ("Gaius_Iulius_Caesar_Vatican_Museum_jpg.jpg", (0.0, 0.0, 1.0, 0.62)),
    "napoleon": ("Jacques_Louis_David_The_Emperor_Napoleon_in_His_St.jpg", (0.18, 0.04, 0.82, 0.42)),
    "franklin": ("Joseph_Siffrein_Duplessis_Benjamin_Franklin_Google.jpg", (0.0, 0.02, 1.0, 0.9)),
    "tesla": ("Tesla_circa_1890_jpeg.jpg", (0.0, 0.0, 1.0, 0.85)),
    "edison": ("Thomas_Edison2_jpg.jpg", (0.2, 0.0, 0.93, 0.62)),
    "alexander": ("Alexander_the_Great_IAM_inv1138T_n2.jpg", (0.0, 0.0, 1.0, 0.84)),  # 2026-10-28: sharper source (owner)
    "livermore": ("livermore.jpg", (0.04, 0.02, 0.96, 0.86)),
    "dow": ("dow.jpg", (0.0, 0.0, 1.0, 1.0)),
    "newton": ("newton.jpg", (0.14, 0.0, 0.86, 0.62)),
    "morgan": ("morgan.jpg", (0.0, 0.0, 1.0, 0.62)),
}
sess = new_session("u2net_human_seg")
sess_general = new_session("isnet-general-use")
GENERAL = {"livermore", "alexander"}  # the people-model left newspaper background on him; a marble head isn't a "person"
UPSCALE = {"dow"}  # owner 2026-10-28: the only free photo is 234x300; enlarge 4x first (Real-ESRGAN x4plus via spandrel, weights path in argv[3])
EXP = {"alexander": 1.35, "dow": 1.45}  # darker mid-tones: bright marble / a blown-out face shouldn't clip
SOFT = {"dow"}  # the source is already high-contrast: no extra contrast
HAIR: dict[str, int] = {}  # owner 2026-10-24: the hair filter cut a chunk out of Newton's hair; the plain cut-out is cleaner
TIGHT = {"newton", "edison", "dow"}  # owner 2026-10-23: a little black came off their sides (dow: a light fringe on his hair)
rng = np.random.default_rng(7)


def look(gray, exp=1.08, soft=False):
    """Punchy black and white: stretch, an S-curve, then fine grain."""
    g = np.asarray(ImageOps.autocontrast(gray, cutoff=0 if soft else 1.5), dtype=np.float32) / 255.0
    g = 0.5 + (g - 0.5) * (0.9 if soft else 1.18)
    g = np.clip(g, 0, 1) ** exp
    g = g + rng.normal(0, 0.035, g.shape)
    return Image.fromarray((np.clip(g, 0, 1) * 255).astype(np.uint8), "L")


def upscale(im):
    import torch
    from spandrel import ModelLoader
    m = ModelLoader().load_from_file(sys.argv[3]).eval()
    x = torch.from_numpy(np.asarray(im, dtype=np.float32) / 255.0).permute(2, 0, 1)[None]
    with torch.no_grad():
        y = m(x)[0].clamp(0, 1).permute(1, 2, 0).numpy()
    return Image.fromarray((y * 255).round().astype(np.uint8))


ONLY = set(sys.argv[4].split(",")) if len(sys.argv) > 4 else None  # e.g. "alexander,dow"
for fid, (f, (l, t, r, b)) in BOX.items():
    if ONLY and fid not in ONLY:
        continue
    im = Image.open(f"{RAW}/{f}").convert("RGB")
    w, h = im.size
    im = im.crop((int(l * w), int(t * h), int(r * w), int(b * h)))
    if fid in UPSCALE:
        im = upscale(im)
    cut = remove(im, session=sess_general if fid in GENERAL else sess)
    alpha = cut.split()[3]
    if fid in TIGHT:  # dark smudges left on the edge: drop the half-transparent fringe, pull the edge in
        alpha = alpha.point(lambda v: 0 if v < 150 else min(255, int((v - 150) * 2.5))).filter(ImageFilter.MinFilter(5))
    if fid in HAIR:  # light hair on a dark painted background: around the hair keep only the light strands
        core = np.asarray(alpha.filter(ImageFilter.MinFilter(61))) > 200
        light = cut.convert("L").filter(ImageFilter.GaussianBlur(2)).point(lambda v: 255 if v > HAIR[fid] else 0)
        light = np.asarray(light.filter(ImageFilter.MaxFilter(51)).filter(ImageFilter.MinFilter(41))) > 0  # fill the hair's dark strands
        band = ~core
        band[int(band.shape[0] * 0.6):] = False  # the coat below is dark on dark: leave it alone
        a = np.asarray(alpha).copy()
        a[band & ~light] = 0
        alpha = Image.fromarray(a)
    alpha = alpha.filter(ImageFilter.GaussianBlur(1.2))
    gray = look(cut.convert("L"), EXP.get(fid, 1.08), fid in SOFT)
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
