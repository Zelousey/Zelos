"""The website's top menu, written into every page that has one (owner 2026-11-14: the website
introduces Zelos; practising happens in the app, reached through one big "Open Practice" button).

    python3 scripts/site_nav.py      # then: python3 scripts/stamp_assets.py

The website keeps what is useful on its own (Learn, Training Ground, the strategy pages,
Leaderboards, About). Things that only work inside the app (Trade War, battles, squads, your
account and trading) are reached through Open Practice, and News and Community open their pages
in the app. Edit NAV below and re-run; pages one folder deep get ../ links automatically.
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIRS = ['', 'learn', 'games', 'practice', 'real', 'scan']
APP = 'app/'

# (label, link) or (label, [(label, link, note) | None for a divider])
NAV = [
    ('Learn', 'learn/index.html'),
    ('Training Ground', [
        ('Training Ground', 'arcade.html', 'Every training game'),
        ('Chart Replay', 'games/chart-replay.html', 'Trade a hidden chart bar by bar'),
        ('Grade the Setup', 'games/grade-the-setup.html', 'Run the checklist on real charts'),
        ('Daily Challenge', 'games/daily-challenge.html', 'Five charts, same for everyone'),
    ]),
    ('Strategies', [
        ('Swing Trader', 'swing-trader.html', 'Pullbacks in an uptrend'),
        ('Breakout Rider', 'breakout-rider.html', 'Clears resistance and holds'),
        ('Options Scanner', 'options-scanner.html', 'Long calls/puts setups'),
        None,
        ('Alerts', 'alert-history.html', 'Every alert, archived'),
        ('Daily Market', 'daily-market.html', "Today's regime &amp; tape"),
        ('Live Chart', 'live-chart.html', 'Full interactive chart'),
        ('Market 3D', 'market-3d.html', 'Global markets on a live globe'),
        None,
        ('Real Trade Journal', 'real/index.html', 'Log and track your real trades'),
        ('Full Arsenal', 'arsenal.html', 'Everything you own'),
    ]),
    ('News', APP + 'news'),
    ('Community', APP + 'communities'),
    ('Leaderboards', 'leaderboard.html'),
    ('About', 'index.html#about'),
]

# which top item a page belongs to (for the highlighted link)
SECTION = [
    (r'^learn/', 'Learn'),
    (r'^(arcade\.html|games/)', 'Training Ground'),
    (r'^(swing-trader|breakout-rider|options-scanner|alert-history|daily-market|live-chart|market-3d|arsenal|alert)\.html|^real/|^scan/', 'Strategies'),
    (r'^leaderboard\.html', 'Leaderboards'),
]


def _section(rel):
    for pat, name in SECTION:
        if re.search(pat, rel):
            return name
    return None


def desktop(p, active):
    out = ['<div class="nav-primary" id="navPrimary">']
    for label, target in NAV:
        on = label == active
        if isinstance(target, str):
            cur = ' is-active" aria-current="page' if on else ''
            out.append('      <a class="nav-link%s" href="%s%s">%s</a>' % (cur, p, target, label))
            continue
        out.append('      <div class="nav-drop">')
        out.append('        <button class="nav-drop-btn%s" type="button" aria-haspopup="true" aria-expanded="false">%s <span class="nav-drop-caret">&#9662;</span></button>' % (' is-active' if on else '', label))
        out.append('        <div class="nav-drop-panel" hidden>')
        for item in target:
            if item is None:
                out.append('          <hr>')
            else:
                out.append('          <a href="%s%s">%s<small>%s</small></a>' % (p, item[1], item[0], item[2]))
        out.append('        </div>')
        out.append('      </div>')
    out.append('    </div>')
    return '\n'.join(out)


def mobile(p):
    out = ['<div class="nav-mobile-panel" id="navMobilePanel">',
           '      <a class="nav-mobile-practice" href="%s%s">Open Practice &rarr;</a>' % (p, APP),
           '      <a href="%sindex.html">Home</a>' % p]
    for label, target in NAV:
        if isinstance(target, str):
            out.append('      <a href="%s%s">%s</a>' % (p, target, label))
    for label, target in NAV:
        if isinstance(target, list):
            out.append('      <div class="nav-mobile-label">%s</div>' % label)
            out.extend('      <a href="%s%s">%s</a>' % (p, i[1], i[0]) for i in target if i)
    out.append('    </div>')
    return '\n'.join(out)


def _block(src, start_tag):
    """(start, end) of the <div> that opens with start_tag, matching nested divs."""
    i = src.find(start_tag)
    if i < 0:
        return None
    depth, j = 0, i
    for m in re.finditer(r'<div\b|</div>', src[i:]):
        depth += 1 if m.group() != '</div>' else -1
        if depth == 0:
            return i, i + m.end()
    return None


def rewrite(src, rel):
    p = '../' * rel.count('/')
    b = _block(src, '<div class="nav-primary" id="navPrimary">')
    if not b:
        return src
    src = src[:b[0]] + desktop(p, _section(rel)) + src[b[1]:]
    b = _block(src, '<div class="nav-mobile-panel" id="navMobilePanel">')
    if b:
        src = src[:b[0]] + mobile(p) + src[b[1]:]
    # the Open Practice button, always in view (also on phones, next to the menu button)
    src = re.sub(r'\s*<a class="nav-practice"[^>]*>.*?</a>', '', src)
    src = src.replace('<button class="nav-hamburger"', '<a class="nav-practice" href="%s%s">Open Practice</a>\n      <button class="nav-hamburger"' % (p, APP), 1)
    return src


def main():
    n = 0
    for d in DIRS:
        folder = os.path.join(ROOT, d)
        for name in sorted(os.listdir(folder)):
            if not name.endswith('.html'):
                continue
            rel = (d + '/' if d else '') + name
            path = os.path.join(folder, name)
            src = open(path, encoding='utf-8').read()
            out = rewrite(src, rel)
            if out != src:
                open(path, 'w', encoding='utf-8').write(out)
                n += 1
    print('menus updated:', n)


if __name__ == '__main__':
    main()
