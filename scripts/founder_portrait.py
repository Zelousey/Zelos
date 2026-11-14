"""Founder portrait for the homepage, Hall of Minds style (owner 2026-11-14): denoise, 2x, BiRefNet-portrait
cut-out, black and white on Hall of Minds red. Needs: pip install "rembg[cpu]" opencv-python-headless
    python3 scripts/founder_portrait.py PHOTO.jpg images/founder.webp"""
import sys, numpy as np, cv2
from PIL import Image, ImageFilter, ImageOps
from rembg import new_session, remove
src, out = sys.argv[1], sys.argv[2]
bgr = cv2.imread(src)
# clean the grain first (it's a dark, compressed photo), then enlarge 2x and sharpen a little
bgr = cv2.fastNlMeansDenoisingColored(bgr, None, 7, 7, 7, 21)
bgr = cv2.resize(bgr, None, fx=2, fy=2, interpolation=cv2.INTER_LANCZOS4)
bgr = cv2.bilateralFilter(bgr, 7, 30, 7)
im = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)).filter(ImageFilter.UnsharpMask(radius=2.2, percent=40, threshold=4))
alpha = remove(Image.open(src).convert('RGB'), session=new_session('birefnet-portrait'), only_mask=True).resize(im.size, Image.LANCZOS)
alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
g = np.asarray(ImageOps.autocontrast(im.convert('L'), cutoff=1.0), dtype=np.float32) / 255.0
g = np.clip(0.5 + (g - 0.5) * 1.12, 0, 1) ** 0.92   # punchy black and white like the Hall of Minds, no added grain
gray = Image.fromarray((g * 255).astype(np.uint8), 'L')
x0, y0, x1, y1 = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
W, H = 960, 1200
card = Image.new('RGB', (W, H), (211, 32, 20))
# fit the person: height to 82% of the card, bottom edge cut by the card like the minds portraits
person = Image.merge('LA', (gray, alpha)).crop((x0, y0, x1, im.height)).convert('RGBA')
s = (H * 0.82) / person.height
person = person.resize((int(person.width * s), int(person.height * s)), Image.LANCZOS)
card.paste(person, ((W - person.width) // 2, H - person.height), person)
# a soft shade toward the edges, as on the minds cards
yy, xx = np.mgrid[0:H, 0:W]
v = 1 - 0.28 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H * 0.45) / (H * 0.75)) ** 2)
arr = np.asarray(card, dtype=np.float32) * np.clip(v, 0.6, 1)[..., None]
Image.fromarray(arr.clip(0, 255).astype(np.uint8)).save(out, 'WEBP', quality=86, method=6)
print(person.size)
