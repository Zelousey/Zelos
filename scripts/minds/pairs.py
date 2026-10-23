"""Head-to-head art: two cut-out portraits side by side that melt into each other where they
meet (the owner's reference image): a wavy seam, a soft blend across it, and horizontal
liquid streaks smeared through the middle."""
import sys
import numpy as np
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
PAIRS = {"alexander-napoleon": ("alexander", "napoleon"), "edison-tesla": ("edison", "tesla")}
W, H, FACE = 1600, 1000, 920
rng = np.random.default_rng(3)


def place(fid, cx):
    im = Image.open(f"{SRC}/{fid}.webp").convert("RGBA")
    s = FACE / im.height
    im = im.resize((int(im.width * s), FACE), Image.LANCZOS)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer.paste(im, (int(cx - im.width / 2), H - FACE), im)
    a = np.asarray(layer, dtype=np.float32) / 255.0
    a[..., :3] *= a[..., 3:4]  # premultiplied
    return a


def smooth_noise(n, scale, amp):
    pts = rng.normal(0, 1, n // scale + 3)
    x = np.arange(n) / scale
    i = np.floor(x).astype(int)
    f = x - i
    f = f * f * (3 - 2 * f)
    return amp * (pts[i] * (1 - f) + pts[i + 1] * f)


for pid, (a_id, b_id) in PAIRS.items():
    L, R = place(a_id, W * 0.405), place(b_id, W * 0.595)
    ys = np.arange(H)
    seam = W / 2 + smooth_noise(H, 90, 28) + smooth_noise(H, 23, 9)
    xs = np.arange(W)[None, :]
    t = np.clip((xs - seam[:, None]) / 90 + 0.5, 0, 1)
    t = t * t * (3 - 2 * t)
    # where only one face has pixels, keep that face whole
    aL, aR = L[..., 3], R[..., 3]
    t = np.where(aR < 0.05, 0, np.where(aL < 0.05, 1, t))
    out = L * (1 - t[..., None]) + R * t[..., None]
    # liquid streaks: shift rows sideways, strongest at the seam
    shift = smooth_noise(H, 16, 22) + smooth_noise(H, 45, 14)
    # only inside the figures (never smeared out into the red), strongest at the seam
    from scipy.ndimage import gaussian_filter
    inside = gaussian_filter(np.maximum(aL, aR) ** 4, 6)
    band = np.exp(-((xs - seam[:, None]) / 95.0) ** 2) * inside
    src_x = np.clip((xs - shift[:, None] * band).round().astype(int), 0, W - 1)
    out = out[ys[:, None], src_x]
    rgb = np.where(out[..., 3:4] > 1e-4, out[..., :3] / np.maximum(out[..., 3:4], 1e-4), 0)
    img = np.concatenate([rgb, out[..., 3:4]], axis=-1)
    Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), "RGBA").save(f"{OUT}/pair-{pid}.webp", quality=84, method=6)
    print(pid)
