"""Makes the War board from the owner's reference artwork (2026-11-01: "copy the reference image
exactly, then we edit from there").

    python3 -I scripts/gen_war_board.py <reference.jpg>

Writes into webapp/src/features/war/board/:
  board.jpg            the artwork (1206 x 817)
  boardShapes.ts       each territory's shape and the border lines between territories (and the sea),
                       as vector paths in artwork pixels, plus where each label sits

One territory map (every land pixel belongs to exactly one territory) is traced into border lines;
each line is shared by the two sides it separates, so neighbours always meet on the same line, with
no gaps or overlaps. Territory shapes are rings of those same lines.

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


def tidy(lab, ids):
    """Smooth the territory map and keep only each territory's main piece: the one under its label
    (stray specks go to the sea)."""
    for _ in range(2):
        lab = np.asarray(Image.fromarray(lab).filter(ImageFilter.ModeFilter(7)))
    out = np.zeros_like(lab)
    for v, k in enumerate(ids, start=1):
        arr = ((lab == v) * 255).astype(np.uint8)
        ys, xs = np.nonzero(arr)
        if not len(ys):
            continue
        lx, ly = LABEL[k]
        n = int(np.argmin((xs - lx) ** 2 + (ys - ly) ** 2))  # the territory's pixel nearest its label
        work = Image.fromarray(arr).copy()  # a copy Pillow can write to
        ImageDraw.floodfill(work, (int(xs[n]), int(ys[n])), 128)
        out[np.asarray(work) == 128] = v
    for v in range(1, len(ids) + 1):
        # holes inside a territory (dark art around labels, specks) that nobody else holds become its land
        outside = Image.fromarray(((out != v) * 255).astype(np.uint8)).copy()
        ImageDraw.floodfill(outside, (0, 0), 128)
        out[(np.asarray(outside) == 255) & (out == 0)] = v
    return out


def trace(lab):
    """[(a, b, points, closed)]: the lines along pixel edges between different labels, split where
    three or more meet, then simplified and smoothed (end points kept, so lines still meet)."""
    H, W = lab.shape
    P = np.zeros((H + 2, W + 2), dtype=np.int16)
    P[1:-1, 1:-1] = lab
    adj = {}

    def add(p, q, pair):
        adj.setdefault(p, []).append((q, pair))
        adj.setdefault(q, []).append((p, pair))
    hy, hx = np.nonzero(P[:-1, 1:-1] != P[1:, 1:-1])   # between pixel rows y-1 and y (corner row y)
    for y, x in zip(hy.tolist(), hx.tolist()):
        add((x, y), (x + 1, y), tuple(sorted((int(P[y, x + 1]), int(P[y + 1, x + 1])))))
    vy, vx = np.nonzero(P[1:-1, :-1] != P[1:-1, 1:])   # between pixel columns x-1 and x (corner column x)
    for y, x in zip(vy.tolist(), vx.tolist()):
        add((x, y), (x, y + 1), tuple(sorted((int(P[y + 1, x]), int(P[y + 1, x + 1])))))

    def junction(c):
        x, y = c
        return len(adj[c]) != 2 or len({int(P[y, x]), int(P[y, x + 1]), int(P[y + 1, x]), int(P[y + 1, x + 1])}) >= 3
    seen = set()
    out = []

    def walk(c0, c1, pair):
        pts = [c0, c1]
        seen.add(frozenset((c0, c1)))
        prev, cur = c0, c1
        while not junction(cur) and cur != c0:
            nxt = [q for q, _ in adj[cur] if q != prev][0]
            seen.add(frozenset((cur, nxt)))
            prev, cur = cur, nxt
            pts.append(cur)
        return pts
    for c in adj:
        if junction(c):
            for q, pair in adj[c]:
                if frozenset((c, q)) not in seen:
                    out.append((pair[0], pair[1], walk(c, q, pair), False))
    for c in adj:  # loops with no junction (a territory surrounded by one other, or an island)
        for q, pair in adj[c]:
            if frozenset((c, q)) not in seen:
                pts = walk(c, q, pair)
                out.append((pair[0], pair[1], pts, True))
    return [(a, b, smooth(simplify(pts, 0.9), closed), closed) for a, b, pts, closed in out if len(pts) >= 2]


def simplify(pts, tol):
    """Douglas-Peucker: drop points within tol of the line through their neighbours."""
    if len(pts) <= 2:
        return pts
    arr = np.asarray(pts, float)
    a, b = arr[0], arr[-1]
    ab = b - a
    L = np.hypot(*ab)
    rel = arr[1:-1] - a
    d = np.hypot(rel[:, 0], rel[:, 1]) if L == 0 else np.abs(ab[0] * rel[:, 1] - ab[1] * rel[:, 0]) / L
    idx = int(np.argmax(d)) + 1
    if d[idx - 1] <= tol:
        return [pts[0], pts[-1]]
    return simplify(pts[:idx + 1], tol)[:-1] + simplify(pts[idx:], tol)


def smooth(pts, closed, rounds=2):
    """Chaikin corner cutting: rounds off pixel steps; a line's two end points never move."""
    pts = [tuple(map(float, p)) for p in pts]
    for _ in range(rounds):
        if len(pts) < 3:
            break
        if closed:
            ring = pts[:-1] if pts[0] == pts[-1] else pts
            new = []
            for i in range(len(ring)):
                p, q = ring[i], ring[(i + 1) % len(ring)]
                new += [(0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]), (0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1])]
            pts = new + [new[0]]
        else:
            new = [pts[0]]
            for i in range(len(pts) - 1):
                p, q = pts[i], pts[i + 1]
                new += [(0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]), (0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1])]
            new.append(pts[-1])
            pts = new
    return pts


def rings(parts):
    """Join a territory's border lines end to end into closed rings."""
    out, open_ = [], []
    for pts, closed in parts:
        (out if closed else open_).append(list(pts))
    k = lambda p: (round(p[0], 3), round(p[1], 3))  # noqa: E731
    while open_:
        ring = open_.pop()
        while k(ring[-1]) != k(ring[0]):
            for i, c in enumerate(open_):
                if k(c[0]) == k(ring[-1]):
                    ring += c[1:]
                elif k(c[-1]) == k(ring[-1]):
                    ring += list(reversed(c))[1:]
                else:
                    continue
                open_.pop(i)
                break
            else:
                break  # couldn't close it: leave it as it is
        out.append(ring)
    return out


def path(pts, closed):
    d = "M" + "L".join("%.1f,%.1f" % p for p in pts)
    return d + ("Z" if closed else "")


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
    lab = np.zeros((H, W), dtype=np.uint8)  # 0 = sea, i + 1 = territory i
    for i in range(len(ids)):
        # fill the holes the art's dark shadows and cities leave, without taking a neighbour's land
        m = Image.fromarray(own[i].astype(np.uint8) * 255).filter(ImageFilter.ModeFilter(9))
        closed = np.asarray(m.filter(ImageFilter.MaxFilter(31)).filter(ImageFilter.MinFilter(31))) > 0
        others = np.zeros_like(closed)
        for j in range(len(ids)):
            if j != i:
                others |= own[j]
        lab[(closed & ~others) & (lab == 0)] = i + 1
    lab = tidy(lab, ids)
    chains = trace(lab)
    regions = {k: [] for k in ids}
    borders = []
    for a, b, pts, closed_loop in chains:
        names = ["sea" if v == 0 else ids[v - 1] for v in (a, b)]
        borders.append((names[0], names[1], pts, closed_loop))
        for v in (a, b):
            if v:
                regions[ids[v - 1]].append((pts, closed_loop))
    lines = ["/** Generated by scripts/gen_war_board.py from the owner's reference art. Don't edit by hand. */",
             "export const BOARD = { w: %d, h: %d };" % (W, H),
             "/** Where each territory's label sits, in art pixels. */",
             "export const SPOTS: Record<string, { x: number; y: number }> = {"]
    for k in ids:
        lines.append("  %s: { x: %d, y: %d }," % (k, LABEL[k][0], LABEL[k][1]))
    lines += ["};", "/** Each territory's shape: rings of the shared border lines below (fill-rule evenodd). */",
              "export const REGIONS: Record<string, string> = {"]
    for k in ids:
        lines.append("  %s: '%s'," % (k, " ".join(path(r, True) for r in rings(regions[k]))))
    lines += ["};", "/** The border lines: each separates territory a from b ('sea' for the coast). */",
              "export const BORDERS: { a: string; b: string; d: string }[] = ["]
    for a, b, pts, closed_loop in borders:
        lines.append("  { a: '%s', b: '%s', d: '%s' }," % (a, b, path(pts, closed_loop)))
    lines.append("];")
    with open(os.path.join(OUT, "boardShapes.ts"), "w") as f:
        f.write("\n".join(lines) + "\n")
    print("wrote", OUT)


if __name__ == "__main__":
    main(sys.argv[1])
