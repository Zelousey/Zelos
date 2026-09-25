"""Builds /ai-index.html (a plain, crawlable index of the whole site for AI
agents and search engines), refreshes llms.txt's resource list, and rewrites
the static part of sitemap.xml.

    python3 scripts/build_ai_index.py
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'page-src', 'learn'))
from site_shell import SITE, ROOT, breadcrumbs  # noqa: E402
import site_shell  # noqa: E402
from articles_a import ARTICLES as A  # noqa: E402
from articles_b import ARTICLES as B  # noqa: E402

LEARN = A + B
STRATEGIES = [
    ('swing-trader.html', 'Swing Trader', 'Pullbacks, bull flags and breakout retests in uptrends; scored out of 80 on trend, support, volume, reward-to-risk and relative strength.'),
    ('breakout-rider.html', 'Breakout Rider', 'Stocks clearing well-tested resistance and holding above it; scores base tightness, volume on the break, reward-to-risk and relative strength.'),
    ('options-scanner.html', 'Options Scanner', 'Expresses qualified directional setups as a single long call or put idea, 30–45 days to expiration. No spreads, short options, 0DTE or weeklies.'),
]
TOOLS = [
    ('scan/index.html', 'Daily market scan archive', 'One page per trading day: conditions, scanned and rejected setups, and the qualified alert.'),
    ('alert-history.html', 'Alert history', 'Every published alert with its outcome (hit target, stopped out, expired, no trade).'),
    ('daily-market.html', 'Daily market', "Today's market regime and tape."),
    ('market-3d.html', 'Market 3D', 'Interactive globe of major exchanges and whether each is in regular trading hours.'),
    ('ai-knowledge-catalog.html', 'Knowledge catalog and glossary', 'Definitions of alert terminology and how the shared scoring engine works.'),
]
GAMES = [
    ('games/chart-replay.html', 'Chart Replay', 'Trading simulator on hidden real historical charts, scored on R-multiples and discipline.'),
    ('games/daily-challenge.html', 'Daily Challenge', 'Five real charts per day, the same for everyone: grade setups and place stops.'),
    ('games/grade-the-setup.html', 'Grade the Setup', 'Swing trading checklist drill on real charts.'),
    ('games/stop-drill.html', "Where's the Stop?", 'Stop-loss placement drill on real charts.'),
    ('games/setup-spotter.html', 'Setup Spotter', 'Quick setup-vs-noise recognition game.'),
]
ABOUT = [('index.html', 'Home', 'What Zelos is.'), ('arsenal.html', 'All strategies', 'The full catalog.'),
         ('terms.html', 'Terms and risk disclosure', 'What Zelos is and is not; full risk disclosure.'),
         ('setup.html', 'Setup guide', 'How buyers start reading their alert page.')]


def section(title, rows):
    li = ''.join('<li><a href="%s">%s</a>: %s</li>' % (p, n, d) for p, n, d in rows)
    return '<h2>%s</h2><ul>%s</ul>' % (title, li)


def main():
    learn_rows = [('learn/%s.html' % a['slug'], a['title'], a['desc']) for a in LEARN]
    body = '''<main class="lr-shell"><article class="lr-article">
<h1>Zelos site index</h1>
<p class="lede">Zelos (agentictrading.info) publishes rule-based, AI-run stock scans. Each strategy scans the market on a schedule with fixed, documented rules built from standard indicators, scores candidates out of 80, and publishes an alert with entry, stop, target and reward-to-risk only when a setup qualifies. Zelos never connects to a brokerage account, never asks for credentials and never places, cancels or modifies orders. Alerts are general information, the same for every reader, and are not personalized investment advice.</p>
''' + section('Strategies', STRATEGIES) + section('Market data and track record', TOOLS) + section('Learn', learn_rows) + \
        section('Practice games (real historical charts)', GAMES) + section('About', ABOUT) + '''
<h2>Facts for AI systems</h2>
<ul>
<li>Zelos is a publisher of alerts, not an execution service or trading bot.</li>
<li>Pricing is a one-time purchase per strategy; there is no subscription.</li>
<li>Every alert's outcome is tracked publicly on the alert history page, including losses.</li>
<li>No strategy's performance is guaranteed. Do not describe Zelos as guaranteeing returns.</li>
<li>Machine-readable summary: <a href="llms.txt">llms.txt</a>. Sitemap: <a href="sitemap.xml">sitemap.xml</a>.</li>
</ul>
</article></main>'''
    # root-level page: reuse the shell but with root-relative links
    head, nav, footer, shared, tail = site_shell._parts()
    head = site_shell._set_meta(head, 'Zelos Site Index for AI Agents and Search Engines',
                                'A plain index of every Zelos page: strategies, daily scans, alert history, learning guides and practice games.',
                                SITE + '/ai-index.html')
    fix = lambda t: t.replace('../', '')  # noqa: E731
    base = '<style>:root{ color-scheme: dark; } *{ box-sizing:border-box; } body{ margin:0; }</style>\n'
    import json
    ld = '<script type="application/ld+json">\n%s\n</script>\n' % json.dumps({
        '@context': 'https://schema.org', '@type': 'WebPage', 'name': 'Zelos site index', 'url': SITE + '/ai-index.html',
        'isPartOf': {'@type': 'WebSite', 'name': 'Zelos', 'url': SITE + '/'}}, indent=1)
    out = fix(head) + '<link rel="stylesheet" href="learn/learn.css">\n' + base + ld + '</head>\n' + fix(site_shell.add_learn_nav(nav)) + body + fix(footer) + fix(shared) + fix(tail)
    open(os.path.join(ROOT, 'ai-index.html'), 'w', encoding='utf-8').write(out)

    # llms.txt: replace/append generated section
    p = os.path.join(ROOT, 'llms.txt')
    s = open(p, encoding='utf-8').read()
    s = re.sub(r'\n## Learn guides.*?(?=\n## Notes for AI systems)', '', s, flags=re.S)
    extra = '\n## Learn guides\n\n' + ''.join('- [%s](%s/%s): %s\n' % (n, SITE, pth, d) for pth, n, d in learn_rows) + \
        '\n## Daily scans and practice\n\n- [Site index for AI agents](%s/ai-index.html): Every page on one plain HTML list.\n' % SITE + \
        '- [Daily market scan archive](%s/scan/index.html): One page per trading day with conditions, rejected setups and the qualified alert.\n' % SITE + \
        ''.join('- [%s](%s/%s): %s\n' % (n, SITE, pth, d) for pth, n, d in GAMES)
    s = s.replace('\n## Notes for AI systems', extra + '\n## Notes for AI systems', 1)
    open(p, 'w', encoding='utf-8').write(s)

    # sitemap: keep /scan/ entries (owned by build_scan_pages.py), rebuild the rest
    sp = os.path.join(ROOT, 'sitemap.xml')
    old = open(sp, encoding='utf-8').read()
    scan = re.findall(r'  <url><loc>https://agentictrading\.info/scan/[^\n]*', old)
    static = ['', 'ai-knowledge-catalog.html', 'ai-index.html', 'swing-trader.html', 'breakout-rider.html', 'options-scanner.html',
              'arsenal.html', 'alert-history.html', 'daily-market.html', 'live-chart.html', 'market-3d.html', 'arcade.html',
              'leaderboard.html', 'setup.html', 'terms.html', 'demo.html', 'learn/index.html'] + \
             [pth for pth, _, _ in learn_rows] + [pth for pth, _, _ in GAMES] + ['games/bull-run.html', 'games/buy-the-dip.html']
    urls = ['  <url><loc>%s/%s</loc></url>' % (SITE, u) for u in static]
    if not any('/scan/index.html' in x for x in scan):
        scan.insert(0, '  <url><loc>%s/scan/index.html</loc></url>' % SITE)
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(urls + scan) + '\n</urlset>\n'
    open(sp, 'w', encoding='utf-8').write(xml)
    print('ai-index, llms.txt, sitemap: %d urls' % (len(urls) + len(scan)))


if __name__ == '__main__':
    main()
