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
    "alexander-aristotle": ("ferris.img", (0, 0.32, 1, 0.95), 700),  # Ferris: Aristotle teaching the young Alexander
    "alexander-knot": ("gordian.img", (0, 0, 1, 1), 1000),  # Berthelemy: the sword and the knot
    "alexander-issus": ("mosaic.img", (0.015, 0.03, 0.985, 0.95), 1200),  # the Alexander Mosaic, without its border
    "alexander-charge": ("mosaic.img", (0.07, 0.28, 0.37, 0.6), 640),  # its left side: Alexander charging
    "alexander-granicus": ("granique.img", (0, 0, 1, 1), 1100),  # Le Brun: the crossing of the Granicus
    "aristotle-athens": ("athens.img", (0.06, 0.12, 0.94, 0.98), 1100),  # Raphael's School of Athens
    "aristotle-plato": ("athens.img", (0.36, 0.42, 0.66, 0.74), 800),  # its middle: Plato and Aristotle
    "aristotle-homer": ("rembrandt.img", (0.12, 0.14, 0.95, 0.78), 900),  # Rembrandt: Aristotle with a bust of Homer
    "aristotle-achilles": ("achilles.img", (0, 0, 1, 1), 1000),  # David: Achilles reaches for his sword
    "aristotle-swallow": ("naumann.img", (0.3, 0.5, 0.98, 0.86), 900),  # Naumann's plate: the barn swallow
    "franklin-almanack": ("poor.img", (0.05, 0.02, 0.97, 0.98), 600),  # Poor Richard, 1739
    "franklin-virtues": ("virtues.img", (0.03, 0.02, 0.97, 0.62), 800),  # his chart of the 13 virtues
    "franklin-lightning": ("west.img", (0, 0, 1, 0.8), 800),  # West: Franklin drawing electricity from the sky
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
