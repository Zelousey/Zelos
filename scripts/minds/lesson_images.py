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
    "caesar-rubicon": ("boulanger.jpg", (0, 0.04, 1, 0.96), 900),  # Boulanger: Caesar halts at the river
    "caesar-crossing": ("fouquet.jpg", (0.12, 0.06, 0.81, 0.59), 800),  # Fouquet's miniature, without the page
    "caesar-book": ("ms012.jpg", (0.52, 0.04, 0.98, 0.62), 800),  # one page of a 15th-century copy
    "caesar-writing": ("ms.jpg", (0.1, 0.3, 0.46, 0.86), 600),  # 1783 frontispiece: Caesar writing
    "caesar-alesia": ("royer.jpg", (0, 0, 1, 1), 1100),
    "caesar-senate": ("gerome.jpg", (0, 0, 1, 1), 1000),
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
