"""Draws the home page's "$10,000 Practice Account" preview: a real candlestick
chart (NVDA's latest 48 daily bars from data/game-charts.json) with volume, a
20-day average, a price axis and a trading-screen frame, as inline SVG.

    python3 scripts/build_home_promo.py

It replaces whatever sits between the PROMO-CHART markers in index.html, so
it can be re-run whenever the chart data is refreshed.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYM, NAME, BARS = 'NVDA', 'NVIDIA', 48
W, H = 560, 250            # chart area (inside the card's SVG)
PAD_L, PAD_R, PAD_T = 8, 58, 14
PRICE_B, VOL_T, VOL_B = 178, 192, 238
UP, DOWN = '#3ecb7c', '#e0483f'


def main():
    rows = json.load(open(os.path.join(ROOT, 'data', 'game-charts.json')))['symbols'][SYM]
    closes = [r[4] for r in rows]
    sma = [sum(closes[i - 19:i + 1]) / 20 if i >= 19 else None for i in range(len(closes))]
    rows, sma = rows[-BARS:], sma[-BARS:]
    lo = min(min(r[3] for r in rows), min(v for v in sma if v)) * 0.995
    hi = max(max(r[2] for r in rows), max(v for v in sma if v)) * 1.005
    vmax = max(r[5] for r in rows)
    bw = (W - PAD_L - PAD_R) / BARS

    def X(i): return PAD_L + (i + 0.5) * bw
    def Y(p): return PAD_T + (hi - p) / (hi - lo) * (PRICE_B - PAD_T)

    out = []
    # grid + price axis
    step = nice((hi - lo) / 4)
    g = (int(lo / step) + 1) * step
    while g < hi:
        y = Y(g)
        out.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" class="pg"/>' % (PAD_L, y, W - PAD_R, y))
        out.append('<text x="%d" y="%.1f" class="pa">%d</text>' % (W - PAD_R + 8, y + 3.5, g))
        g += step
    # volume
    for i, r in enumerate(rows):
        h = r[5] / vmax * (VOL_B - VOL_T)
        col = UP if r[4] >= r[1] else DOWN
        out.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" opacity="0.32"/>' % (X(i) - bw * 0.34, VOL_B - h, bw * 0.68, h, col))
    # 20-day average
    pts = ' '.join('%.1f,%.1f' % (X(i), Y(v)) for i, v in enumerate(sma) if v)
    out.append('<polyline points="%s" fill="none" stroke="#4a86ff" stroke-width="1.6" opacity="0.9"/>' % pts)
    # candles
    for i, r in enumerate(rows):
        o, h, l, c = r[1], r[2], r[3], r[4]
        col = UP if c >= o else DOWN
        top, bot = Y(max(o, c)), Y(min(o, c))
        out.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1"/>' % (X(i), Y(h), X(i), Y(l), col))
        out.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" rx="0.6"/>' % (X(i) - bw * 0.34, top, bw * 0.68, max(1, bot - top), col))
    # last price line + tag
    last, prev = rows[-1][4], rows[-2][4]
    ly, lcol = Y(last), (UP if last >= prev else DOWN)
    out.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="%s" stroke-dasharray="2 3" opacity="0.7"/>' % (PAD_L, ly, W - PAD_R, ly, lcol))
    out.append('<rect x="%d" y="%.1f" width="54" height="16" rx="2" fill="%s"/>' % (W - PAD_R + 2, ly - 8, lcol))
    out.append('<text x="%d" y="%.1f" class="pt">%.2f</text>' % (W - PAD_R + 7, ly + 4, last))
    # legend
    out.append('<text x="%d" y="10" class="pl"><tspan fill="#4a86ff">&#8212; SMA 20</tspan><tspan dx="10" fill="#8a8f98">Vol</tspan></text>' % (PAD_L + 2))

    chg, pct = last - prev, (last / prev - 1) * 100
    head = ('<div class="ppc-head"><div><b class="ppc-sym">%s</b><span class="ppc-name">%s</span></div>'
            '<div class="ppc-quote"><b>%.2f</b><span class="%s">%s%.2f (%s%.2f%%)</span></div></div>'
            '<div class="ppc-tfs"><span>5m</span><span>15m</span><span>1H</span><span class="on">D</span><span>W</span>'
            '<span class="ppc-live"><i></i>Live</span></div>') % (
        SYM, NAME, last, 'up' if chg >= 0 else 'dn', '+' if chg >= 0 else '', chg, '+' if chg >= 0 else '', pct)
    svg = ('<svg viewBox="0 0 %d %d" class="ppc-chart" role="img" aria-label="%s daily candlestick chart with volume and 20-day average">'
           '<style>.pg{stroke:rgba(127,127,127,0.16);stroke-width:1}.pa{font:500 10px \'IBM Plex Mono\',monospace;fill:#8a8f98}'
           '.pt{font:700 10px \'IBM Plex Mono\',monospace;fill:#fff}.pl{font:500 9.5px \'IBM Plex Mono\',monospace}</style>%s</svg>') % (
        W, H, NAME, ''.join(out))
    block = head + svg

    p = os.path.join(ROOT, 'index.html')
    src = open(p, encoding='utf-8').read()
    new, n = re.subn(r'(<!-- PROMO-CHART -->).*?(<!-- /PROMO-CHART -->)', lambda m: m.group(1) + block + m.group(2), src, flags=re.S)
    if not n:
        raise SystemExit('PROMO-CHART markers not found in index.html')
    open(p, 'w', encoding='utf-8').write(new)
    print('home promo chart: %s %d bars, last %.2f' % (SYM, BARS, last))


def nice(raw):
    import math
    p = 10 ** math.floor(math.log10(raw))
    f = raw / p
    return (1 if f < 1.5 else 2 if f < 3 else 5 if f < 7 else 10) * p


if __name__ == '__main__':
    main()
