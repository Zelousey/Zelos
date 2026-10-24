"""Hall of Minds scroll-lesson pictures (owner 2026-10-23): public-domain paintings from Wikimedia
Commons, toned red and black to match the cards. Raw downloads stay out of the repo.

    python3 scripts/minds/lesson_images.py RAW_DIR webapp/public/minds/lessons
"""
import os
import sys

from PIL import Image, ImageEnhance, ImageOps

RAW, OUT = sys.argv[1], sys.argv[2]
# out name: (raw file, crop box as fractions (left, top, right, bottom), width)
JOBS = {
    "napoleon-alps": ("img1.jpg", (0, 0, 1, 1), 900),
    "napoleon-study": ("img4.jpg", (0, 0, 1, 1), 900),
    "napoleon-austerlitz": ("img2.jpg", (0, 0, 1, 1), 1100),
    "napoleon-names": ("img1.jpg", (0, 0.83, 0.55, 1), 900),  # the names David carved into the rocks
    "napoleon-arcole": ("arcole.jpg", (0, 0, 1, 1), 900),
}


def tone(im):
    g = ImageOps.autocontrast(im.convert("L"), cutoff=1)
    g = ImageEnhance.Contrast(g).enhance(1.25)
    return ImageOps.colorize(g, black="#140303", mid="#b3170f", white="#fff3ee", midpoint=110)


for name, (raw, (l, t, r, b), width) in JOBS.items():
    path = os.path.join(RAW, raw)
    if not os.path.exists(path):
        print("skip", name, "(no", raw + ")")
        continue
    im = Image.open(path)
    w, h = im.size
    im = tone(im.crop((round(l * w), round(t * h), round(r * w), round(b * h))))
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, name + ".webp"), quality=78, method=6)
    print(name, im.size)
