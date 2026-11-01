"""Makes the War map's land shapes (webapp/src/features/war/mapShapes.ts).

    python3 -I scripts/gen_war_map.py

One island in the sea, cut into the 10 sector territories (a Voronoi split from one seed point per
sector), with wobbly shared borders so it reads like a map. Two layouts: wide (computers) and tall
(phones). Deterministic: the same output every run. Re-run it only to change the shapes.
"""
import math
import os

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "webapp", "src", "features", "war", "mapShapes.ts")

LAYOUTS = {
    "wide": {
        "w": 1000, "h": 640, "c": (500, 330), "rx": 440, "ry": 270,
        "seeds": {"tech": (250, 185), "comms": (500, 160), "health": (750, 195),
                  "consumer": (165, 350), "finance": (390, 335), "energy": (615, 345), "industrials": (840, 365),
                  "realestate": (290, 505), "materials": (515, 520), "utilities": (735, 495)},
        "isles": [(70, 120, 22), (950, 140, 16), (930, 560, 26), (60, 560, 14), (880, 610, 10), (150, 610, 18)],
    },
    "tall": {
        "w": 600, "h": 940, "c": (300, 470), "rx": 270, "ry": 430,
        "seeds": {"tech": (190, 150), "comms": (415, 165), "health": (160, 325), "consumer": (430, 335),
                  "finance": (200, 490), "energy": (420, 500), "industrials": (175, 655), "realestate": (425, 665),
                  "materials": (215, 815), "utilities": (405, 810)},
        "isles": [(40, 70, 14), (565, 80, 12), (555, 880, 18), (45, 890, 12)],
    },
}


def noise(a, k):
    """A smooth, repeatable wobble around the coast."""
    return (0.06 * math.sin(3 * a + k) + 0.04 * math.sin(7 * a + 2 * k) + 0.025 * math.sin(13 * a + 3 * k) + 0.015 * math.sin(23 * a + k))


def island(cx, cy, rx, ry, k=1.3, n=180):
    return [(cx + rx * (1 + noise(2 * math.pi * i / n, k)) * math.cos(2 * math.pi * i / n),
             cy + ry * (1 + noise(2 * math.pi * i / n, k)) * math.sin(2 * math.pi * i / n)) for i in range(n)]


def clip(poly, a, b, c):
    """Keep the part of poly where a*x + b*y <= c (Sutherland-Hodgman)."""
    out = []
    for i in range(len(poly)):
        p, q = poly[i], poly[(i + 1) % len(poly)]
        fp, fq = a * p[0] + b * p[1] - c, a * q[0] + b * q[1] - c
        if fp <= 0:
            out.append(p)
        if (fp < 0 < fq) or (fq < 0 < fp):
            t = fp / (fp - fq)
            out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out


def key(p):
    return (round(p[0], 1), round(p[1], 1))


def wobble_edge(p, q, depth=4):
    """Points between p and q (exclusive), the same for both neighbours whichever way they walk it."""
    flip = key(p) > key(q)
    a, b = (key(q), key(p)) if flip else (key(p), key(q))  # rounded, so both neighbours start from the same numbers

    def mid(a, b, d):
        if d == 0:
            return []
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        ln = math.hypot(b[0] - a[0], b[1] - a[1])
        h = math.sin(a[0] * 12.9898 + a[1] * 78.233 + b[0] * 37.719 + b[1] * 4.581) * 43758.5453
        off = (h - math.floor(h) - 0.5) * ln * 0.28
        nx, ny = -(b[1] - a[1]) / (ln or 1), (b[0] - a[0]) / (ln or 1)
        m = (mx + nx * off, my + ny * off)
        return mid(a, m, d - 1) + [m] + mid(m, b, d - 1)

    pts = mid(a, b, depth) if math.hypot(b[0] - a[0], b[1] - a[1]) > 14 else []
    return list(reversed(pts)) if flip else pts


def on_coast(p, coast):
    return any(math.hypot(p[0] - c[0], p[1] - c[1]) < 0.6 for c in coast)


def centroid(poly):
    a = cx = cy = 0.0
    for i in range(len(poly)):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % len(poly)]
        f = x0 * y1 - x1 * y0
        a += f
        cx += (x0 + x1) * f
        cy += (y0 + y1) * f
    a *= 0.5
    return (cx / (6 * a), cy / (6 * a))


def path(pts):
    return "M" + "L".join("%.1f,%.1f" % p for p in pts) + "Z"


def build(L):
    coast = island(L["c"][0], L["c"][1], L["rx"], L["ry"])
    seeds = L["seeds"]
    cells = {}
    for sid, s in seeds.items():
        poly = list(coast)
        for oid, o in seeds.items():
            if oid != sid:
                a, b = o[0] - s[0], o[1] - s[1]
                poly = clip(poly, a, b, (o[0] ** 2 + o[1] ** 2 - s[0] ** 2 - s[1] ** 2) / 2)
        out = []
        for i in range(len(poly)):
            p, q = poly[i], poly[(i + 1) % len(poly)]
            out.append(p)
            m = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
            if not (on_coast(p, coast) and on_coast(q, coast)) or math.hypot(q[0] - p[0], q[1] - p[1]) > 12:
                if not (on_coast(m, coast)):
                    out += wobble_edge(p, q)
        cx, cy = centroid(poly)
        cells[sid] = {"d": path(out), "x": round(cx, 1), "y": round(cy, 1)}
    isles = []
    for i, (x, y, r) in enumerate(L["isles"]):
        isles.append(path(island(x, y, r, r * 0.7, k=i * 2.1 + 0.4, n=40)))
    return {"w": L["w"], "h": L["h"], "coast": path(coast), "cells": cells, "isles": isles}


def main():
    lines = ["/** Generated by scripts/gen_war_map.py: the War map's land shapes. Don't edit by hand. */",
             "export type MapShape = { w: number; h: number; coast: string; isles: string[]; cells: Record<string, { d: string; x: number; y: number }> };"]
    for name, L in LAYOUTS.items():
        b = build(L)
        lines.append("export const %s: MapShape = {" % name.upper())
        lines.append("  w: %d," % b["w"])
        lines.append("  h: %d," % b["h"])
        lines.append("  coast: '%s'," % b["coast"])
        lines.append("  isles: [%s]," % ", ".join("'%s'" % d for d in b["isles"]))
        lines.append("  cells: {")
        for sid, c in b["cells"].items():
            lines.append("    %s: { x: %s, y: %s, d: '%s' }," % (sid, c["x"], c["y"], c["d"]))
        lines.append("  },")
        lines.append("};")
    with open(OUT, "w") as f:
        f.write("\n".join(lines) + "\n")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
