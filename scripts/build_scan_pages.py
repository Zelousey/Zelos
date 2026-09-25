"""Builds the public daily "Zelos Market Scan" pages in /scan/.

One static, crawlable page per trading day that has alert data:

    /scan/2026-09-24.html   "September 24, 2026 — Zelos Market Scan"
    /scan/index.html        archive of every day
    sitemap.xml             /scan/ URLs merged in

Data comes from the public, read-only Firestore `alerts` collection (the
same data alert.html and alert-history.html read in the browser), so this
needs no credentials. See docs/data-model.md, including the optional
`scanStats` block that fills the "stocks scanned / rejected" sections.

    python3 scripts/build_scan_pages.py                      # fetch from Firestore
    python3 scripts/build_scan_pages.py --from-json f.json   # offline / testing
    python3 scripts/build_scan_pages.py --min-age-hours 8    # hold back same-day alerts

It runs every weekday evening from .github/workflows/scan-pages.yml, after
the close, so paying subscribers still get each alert first in the morning.
"""
import argparse
import datetime as dt
import html
import json
import os
import re
import sys
import urllib.request
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from site_shell import render, breadcrumbs, SITE, ROOT  # noqa: E402

PROJECT = 'leaderboard-agentictrading'
ET = ZoneInfo('America/New_York')
STRAT = {
    'swing-trader': ('Swing Trader', 'swing-trader.html'),
    'breakout-rider': ('Breakout Rider', 'breakout-rider.html'),
    'options-scanner': ('Options Scanner', 'options-scanner.html'),
}
RESULT = {'hit-target': 'Hit target', 'stopped-out': 'Stopped out', 'open': 'Still open',
          'expired': 'Expired', 'no-trade': 'No trade triggered'}
HEAD = ('<link rel="stylesheet" href="../zelos-theme.css">\n<link rel="stylesheet" href="../learn/learn.css">\n'
        '<link rel="stylesheet" href="scan.css">\n')
e = html.escape
DELAY_NOTE = ('<aside class="sc-delay"><b>Why this is published after the close</b>'
              '<span>Subscribers get each alert when it publishes, before the market opens. This public page goes up after the 4:00 pm ET close, '
              'so it is a record of what the scan found and how it was reasoned, not a live trading signal. By the time you read it, the '
              'entry price may no longer be available.</span></aside>')


# ------------------------------------------------------------ Firestore REST
def _val(v):
    if 'stringValue' in v: return v['stringValue']
    if 'integerValue' in v: return int(v['integerValue'])
    if 'doubleValue' in v: return v['doubleValue']
    if 'booleanValue' in v: return v['booleanValue']
    if 'timestampValue' in v: return v['timestampValue']
    if 'nullValue' in v: return None
    if 'mapValue' in v: return {k: _val(x) for k, x in v['mapValue'].get('fields', {}).items()}
    if 'arrayValue' in v: return [_val(x) for x in v['arrayValue'].get('values', [])]
    return None


def fetch_alerts():
    base = 'https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/alerts?pageSize=300' % PROJECT
    out, token = [], None
    while True:
        url = base + ('&pageToken=' + token if token else '')
        with urllib.request.urlopen(url, timeout=30) as r:
            j = json.load(r)
        for d in j.get('documents', []):
            doc = {k: _val(v) for k, v in d.get('fields', {}).items()}
            doc['id'] = d['name'].rsplit('/', 1)[1]
            out.append(doc)
        token = j.get('nextPageToken')
        if not token:
            return out


# ------------------------------------------------------------ helpers
def parse_ts(ts):
    if not ts: return None
    return dt.datetime.fromisoformat(str(ts).replace('Z', '+00:00'))


def num(x, d=2):
    try: return ('%.' + str(d) + 'f') % float(x)
    except (TypeError, ValueError): return '–'


def long_date(day):
    return day.strftime('%B ') + str(day.day) + day.strftime(', %Y')


def alert_card(a):
    name, href = STRAT.get(a.get('strategy'), (a.get('strategy', 'Zelos'), 'arsenal.html'))
    status = a.get('status')
    head = '<div class="sc-card-head"><span class="lr-kicker">%s</span>' % e(name)
    if a.get('score') is not None:
        head += '<span class="sc-score">Score %s / %s</span>' % (e(str(a.get('score'))), e(str(a.get('scoreMax', 80))))
    head += '</div>'
    if status == 'no-qualifying-setup' or not a.get('ticker'):
        return ('<div class="sc-card">%s<h3>No setup cleared the bar</h3><p>%s</p>'
                '<p class="sc-fine">Standing aside is part of the strategy: %s only publishes when a setup scores high enough.</p></div>') % (
            head, e(a.get('reasoning') or 'Nothing met every rule today.'), e(name))
    rows = [('Direction', (a.get('direction') or '').replace('-', ' ')), ('Setup', a.get('setupLabel')),
            ('Entry', num(a.get('entry'))), ('Stop', num(a.get('stop'))), ('Target 1', num(a.get('target1'))),
            ('Target 2', num(a.get('target2')) if a.get('target2') else None), ('Reward : risk', a.get('rewardRiskRatio')),
            ('Options rule', a.get('optionsRule'))]
    tbl = ''.join('<tr><th>%s</th><td>%s</td></tr>' % (e(k), e(str(v))) for k, v in rows if v not in (None, '', '–'))
    tech = a.get('technicals') or {}
    tech_html = ''
    if tech:
        labels = {'rsi': 'RSI', 'sma20': '20-day avg', 'sma50': '50-day avg', 'volumeVsAvg': 'Volume vs avg'}
        tech_html = '<ul class="sc-tech">' + ''.join('<li><span>%s</span><b>%s</b></li>' % (e(labels.get(k, k)), e(str(v))) for k, v in tech.items()) + '</ul>'
    oc = a.get('outcome') or {}
    outcome = ''
    if oc.get('result'):
        outcome = '<p class="sc-outcome sc-%s"><b>Outcome:</b> %s%s%s</p>' % (
            e(oc['result']), e(RESULT.get(oc['result'], oc['result'])),
            (' at ' + num(oc.get('exitPrice'))) if oc.get('exitPrice') else '', (' · ' + e(oc.get('notes'))) if oc.get('notes') else '')
    return f'''<div class="sc-card">{head}<h3>{e(a.get('ticker'))}</h3>
<table class="sc-plan">{tbl}</table>
<h4>Why it qualified</h4><p>{e(a.get('reasoning') or '')}</p>{tech_html}
{('<h4>Risk notes</h4><p>' + e(a['riskNotes']) + '</p>') if a.get('riskNotes') else ''}
{outcome}
<p class="sc-links"><a href="../alert.html?id={e(a['id'])}">Full alert page</a> · <a href="../{href}">How {e(name)} works</a></p></div>'''


def stats_block(alerts):
    """Merges the optional scanStats blocks from every strategy that ran that day."""
    scanned, passed, rejected, qualified = 0, 0, [], []
    have = False
    for a in alerts:
        s = a.get('scanStats') or {}
        if not s: continue
        have = True
        scanned = max(scanned, int(s.get('scanned') or 0))
        passed += int(s.get('passedFilters') or 0)
        rejected += s.get('rejected') or []
        qualified += s.get('qualified') or []
    return have, scanned, passed, rejected, qualified


# ------------------------------------------------------------ pages
def day_page(day, alerts, prev_day, next_day):
    iso = day.isoformat()
    title = '%s — Zelos Market Scan' % long_date(day)
    tickers = [a['ticker'] for a in alerts if a.get('ticker') and a.get('status') != 'no-qualifying-setup']
    regime = next((a.get('marketRegime') for a in alerts if a.get('marketRegime')), None)
    have, scanned, passed, rejected, qualified = stats_block(alerts)
    desc = ('Zelos Market Scan for %s: market conditions, what was scanned and rejected, and %s.' % (
        long_date(day), ('the qualified setup' + ('s ' if len(tickers) > 1 else ' ') + ', '.join(tickers)) if tickers else 'why no setup qualified'))

    stats_html = ''
    if have:
        stats_html = ('<div class="sc-stats"><div><small>Stocks scanned</small><b>%s</b></div><div><small>Passed first filters</small><b>%s</b></div>'
                      '<div><small>Rejected at scoring</small><b>%s</b></div><div><small>Qualified</small><b>%s</b></div></div>') % (
            f'{scanned:,}' if scanned else '–', passed or '–', len(rejected), len(qualified) or len(tickers))
    rej_html = ''
    if rejected:
        rej_html = '<h2>Setups rejected</h2><p>Candidates that looked promising but failed at least one rule:</p><table class="sc-rej"><tr><th>Ticker</th><th>Why it was rejected</th></tr>' + ''.join(
            '<tr><td>%s</td><td>%s</td></tr>' % (e(str(r.get('ticker', ''))), e(str(r.get('reason', '')))) for r in rejected[:25]) + '</table>'
    q_html = ''
    if qualified:
        q_html = '<h2>Qualified setups</h2><table class="sc-rej"><tr><th>Ticker</th><th>Score</th><th>Setup</th></tr>' + ''.join(
            '<tr><td>%s</td><td>%s</td><td>%s</td></tr>' % (e(str(q.get('ticker', ''))), e(str(q.get('score', ''))), e(str(q.get('setup', '')))) for q in qualified) + '</table>'
    cards = ''.join(alert_card(a) for a in sorted(alerts, key=lambda a: list(STRAT).index(a['strategy']) if a.get('strategy') in STRAT else 9))
    pn = '<nav class="sc-pn">%s<a href="index.html">All scans</a>%s</nav>' % (
        ('<a href="%s.html">&larr; %s</a>' % (prev_day, long_date(dt.date.fromisoformat(prev_day)))) if prev_day else '<span></span>',
        ('<a href="%s.html">%s &rarr;</a>' % (next_day, long_date(dt.date.fromisoformat(next_day)))) if next_day else '<span></span>')
    body = f'''<main class="lr-shell">
  <nav class="lr-crumbs" aria-label="Breadcrumb"><a href="../index.html">Zelos</a> / <a href="index.html">Market scans</a> / <span>{e(long_date(day))}</span></nav>
  <article class="lr-article">
    <header><span class="lr-kicker">Daily market scan</span><h1>{e(title)}</h1>
    <p class="lr-meta"><time datetime="{iso}">{e(day.strftime('%A'))}, {e(long_date(day))}</time> · Recap published after the close · Not investment advice</p></header>
    {DELAY_NOTE}
    <h2>Market conditions</h2>
    <p>{e(regime) if regime else 'No market-regime note was recorded for this session.'}</p>
    {stats_html}
    {rej_html}
    {q_html}
    <h2>Today's alert{'s' if len(alerts) > 1 else ''}</h2>
    {cards}
    <h2>How this scan works</h2>
    <p>Every trading day, each Zelos strategy screens the market with fixed rules, scores candidates out of 80 on trend, support, volume, reward-to-risk and relative strength, and publishes an alert only when a setup clears the bar. On days when nothing qualifies, the page says so. Every alert's outcome is tracked afterwards on the <a href="../alert-history.html">alert history</a> page, winners and losers alike.</p>
    <p>New to the setups? Read <a href="../learn/what-is-a-pullback-trading-strategy.html">what a pullback strategy is</a>, <a href="../learn/how-to-trade-breakouts.html">how to trade breakouts</a> and <a href="../learn/what-is-reward-to-risk-ratio.html">how reward-to-risk works</a>.</p>
    <aside class="lr-cta"><div><b>Want these alerts the moment they publish?</b><span>Subscribers get each alert in the morning, before the market opens, the same alert every subscriber sees.</span></div><a class="btn btn-primary" href="../arsenal.html">See the strategies &rarr;</a></aside>
  </article>
  {pn}
  <p class="lr-disclaimer">General information published the same way to every reader. Not personalized investment advice and not a recommendation to buy or sell any security. Zelos is not a registered investment adviser. Past alerts and outcomes do not guarantee future results. See the <a href="../terms.html">terms</a>.</p>
</main>'''
    path = 'scan/%s.html' % iso
    ld = [{'@context': 'https://schema.org', '@type': 'Article', 'headline': title, 'description': desc,
           'url': SITE + '/' + path, 'datePublished': iso, 'dateModified': dt.date.today().isoformat(),
           'author': {'@type': 'Organization', 'name': 'Zelos', 'url': SITE + '/'},
           'publisher': {'@type': 'Organization', 'name': 'Zelos', 'url': SITE + '/'},
           'image': SITE + '/og-image.png', 'about': ['Stock market', 'Swing trading'] + tickers},
          breadcrumbs([('Zelos', ''), ('Market scans', 'scan/index.html'), (long_date(day), None)])]
    render(path, title, desc, body, HEAD, '', jsonld=ld, og_type='article', include_shared_scripts=True)
    return {'date': iso, 'title': title, 'tickers': tickers,
            'none': not tickers}


def index_page(days):
    rows = ''.join('<a class="sc-row" href="%s.html"><span class="sc-date">%s</span><span>%s</span></a>' % (
        d['date'], e(long_date(dt.date.fromisoformat(d['date']))),
        e(', '.join(d['tickers'])) if d['tickers'] else '<em>No setup qualified</em>') for d in days)
    rows = rows.replace('&lt;em&gt;No setup qualified&lt;/em&gt;', '<em>No setup qualified</em>')
    body = f'''<main class="lr-shell">
  <nav class="lr-crumbs" aria-label="Breadcrumb"><a href="../index.html">Zelos</a> / <span>Market scans</span></nav>
  <header class="lr-hub-head"><span class="lr-kicker">Every trading day</span><h1>Zelos Market Scan archive</h1>
  <p>One page per trading day: market conditions, what the scanners looked at, what they rejected, and the alert that qualified (or why nothing did).</p></header>
  {DELAY_NOTE}
  <div class="sc-list">{rows or '<p>The first scan page will appear here after the next trading day.</p>'}</div>
  <p class="lr-disclaimer">General information, not investment advice. Full outcomes for every alert: <a href="../alert-history.html">alert history</a>.</p>
</main>'''
    render('scan/index.html', 'Daily Market Scan Archive: Every Zelos Scan, Day by Day',
           'Archive of every Zelos daily market scan: conditions, scanned and rejected stocks, and qualified swing, breakout and options setups.',
           body, HEAD, '', jsonld=[breadcrumbs([('Zelos', ''), ('Market scans', None)])])


def update_sitemap(days):
    p = os.path.join(ROOT, 'sitemap.xml')
    s = open(p, encoding='utf-8').read()
    s = re.sub(r'\s*<url><loc>https://agentictrading\.info/scan/[^<]+</loc>(<lastmod>[^<]*</lastmod>)?</url>', '', s)
    add = '\n  <url><loc>%s/scan/index.html</loc></url>' % SITE + ''.join(
        '\n  <url><loc>%s/scan/%s.html</loc><lastmod>%s</lastmod></url>' % (SITE, d['date'], d['date']) for d in days)
    s = s.replace('\n</urlset>', add + '\n</urlset>')
    open(p, 'w', encoding='utf-8').write(s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--from-json', help='use a local JSON list of alert docs instead of Firestore')
    ap.add_argument('--min-age-hours', type=float, default=0, help='skip alerts newer than this')
    ap.add_argument('--no-sitemap', action='store_true')
    args = ap.parse_args()
    alerts = json.load(open(args.from_json)) if args.from_json else fetch_alerts()
    now = dt.datetime.now(dt.timezone.utc)
    now_et = now.astimezone(ET)
    # never publish a day's alerts before that day's 4:00 pm ET close, even on a
    # manual run: subscribers get them first, the public page is the recap
    closed_today = now_et.hour >= 16
    by_day = {}
    for a in alerts:
        ts = parse_ts(a.get('createdAt'))
        if not ts or (now - ts).total_seconds() < args.min_age_hours * 3600:
            continue
        d_et = ts.astimezone(ET).date()
        if d_et > now_et.date() or (d_et == now_et.date() and not closed_today):
            continue
        by_day.setdefault(d_et, []).append(a)
    days = sorted(by_day)
    built = []
    for k, day in enumerate(days):
        prev_day = days[k - 1].isoformat() if k else None
        next_day = days[k + 1].isoformat() if k + 1 < len(days) else None
        built.append(day_page(day, by_day[day], prev_day, next_day))
    built.reverse()
    index_page(built)
    if not args.no_sitemap:
        update_sitemap(built)
    print('built %d scan pages' % len(built))


if __name__ == '__main__':
    main()
