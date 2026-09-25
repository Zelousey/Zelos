"""Daily auto-update for data/market-snapshot.json (runs in GitHub Actions).

Pulls end-of-day prices from Yahoo Finance's public chart feed (no API key,
no extra packages) and rewrites the file zelos-market.js reads for the
ticker tape, the Market Overview chart and the US market & sectors tables.

    python3 scripts/update_market_snapshot.py            # fetch + write
    python3 scripts/update_market_snapshot.py --fixtures DIR   # offline test

Safe by design:
  * a symbol that fails to download keeps its previous value (never blanked,
    never made up); if the S&P 500 itself fails, nothing is written.
  * if nothing changed (weekend / market holiday) the file isn't touched,
    so the workflow makes no commit.
"""
import argparse
import datetime as dt
import json
import os
import sys
import time
import urllib.request
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'market-snapshot.json')
ET = ZoneInfo('America/New_York')

# site key -> (Yahoo symbol, label, kind)
SYMBOLS = {
    'SPX':    ('^GSPC',   'S&P 500',        'index'),
    'COMP':   ('^IXIC',   'Nasdaq',         'index'),
    'DJI':    ('^DJI',    'Dow Jones',      'index'),
    'AAPL':   ('AAPL',    'AAPL',           'equity'),
    'NVDA':   ('NVDA',    'NVDA',           'equity'),
    'TSLA':   ('TSLA',    'TSLA',           'equity'),
    'BTCUSD': ('BTC-USD', 'Bitcoin',        'crypto'),
    'XLK':    ('XLK',     'Technology',     'equity'),
    'XLC':    ('XLC',     'Communication',  'equity'),
    'XLY':    ('XLY',     'Consumer Disc.', 'equity'),
    'XLV':    ('XLV',     'Healthcare',     'equity'),
    'XLF':    ('XLF',     'Financials',     'equity'),
    'XLE':    ('XLE',     'Energy',         'equity'),
}
GROUPS = {
    'tape':    ['SPX', 'COMP', 'DJI', 'AAPL', 'NVDA', 'TSLA', 'BTCUSD', 'XLK', 'XLE'],
    'indices': ['SPX', 'COMP', 'DJI'],
    'sectors': ['XLK', 'XLC', 'XLY', 'XLV', 'XLF', 'XLE'],
}
SPARK = ['SPX', 'COMP', 'DJI']
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'


def fetch(ysym):
    q = urllib.request.quote(ysym)
    last_err = None
    for host in ('query1', 'query2'):
        for attempt in range(3):
            url = 'https://%s.finance.yahoo.com/v8/finance/chart/%s?range=2mo&interval=1d' % (host, q)
            try:
                req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
                with urllib.request.urlopen(req, timeout=20) as r:
                    return json.load(r)
            except Exception as e:  # noqa: BLE001
                last_err = e
                time.sleep(2 * (attempt + 1))
    raise RuntimeError('%s: %s' % (ysym, last_err))


def parse(raw, kind):
    """Yahoo chart JSON -> (daily [(date, close)], price, prev, asOf ISO)."""
    res = raw['chart']['result'][0]
    tz = ZoneInfo(res['meta'].get('exchangeTimezoneName') or 'America/New_York')
    closes = res['indicators']['quote'][0]['close']
    days = {}
    for ts, c in zip(res.get('timestamp') or [], closes):
        if c is None:
            continue
        days[dt.datetime.fromtimestamp(ts, tz).date().isoformat()] = float(c)
    pts = sorted(days.items())
    if len(pts) < 2:
        raise ValueError('not enough bars')
    price, prev = pts[-1][1], pts[-2][1]
    meta_px = res['meta'].get('regularMarketPrice')
    if kind == 'crypto' and meta_px:
        price = float(meta_px)
        as_of = dt.datetime.fromtimestamp(res['meta'].get('regularMarketTime', time.time()), ET).isoformat(timespec='seconds')
    else:
        d = dt.date.fromisoformat(pts[-1][0])
        as_of = dt.datetime(d.year, d.month, d.day, 16, 0, tzinfo=ET).isoformat()
    return pts, price, prev, as_of


def build(get_raw, old):
    items, spark, failed = {}, {}, []
    for key, (ysym, label, kind) in SYMBOLS.items():
        try:
            pts, price, prev, as_of = parse(get_raw(ysym), kind)
        except Exception as e:  # noqa: BLE001
            failed.append(key)
            print('WARN', key, e, file=sys.stderr)
            if key in old.get('items', {}):
                items[key] = old['items'][key]
            if key in old.get('spark', {}):
                spark[key] = old['spark'][key]
            continue
        chg = price - prev
        items[key] = {'sym': key, 'label': label, 'kind': kind,
                      'price': round(price, 4), 'prev': round(prev, 4), 'chg': round(chg, 4),
                      'pct': round(chg / prev * 100, 2) if prev else None, 'asOf': as_of}
        if key in SPARK:
            # last ~1 month of daily closes for the overview chart
            spark[key] = {'label': label, 'points': [{'d': d, 'c': round(c, 2)} for d, c in pts[-23:]]}
    if 'SPX' in failed or 'SPX' not in items:
        raise SystemExit('S&P 500 download failed; leaving the snapshot unchanged.')
    return {
        'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
        'source': 'Yahoo Finance end-of-day prices (crypto is 24/7)',
        'sourceShort': 'Yahoo Finance',
        'items': items,
        'groups': {g: [s for s in syms if s in items] for g, syms in GROUPS.items()},
        'spark': spark,
    }, failed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--fixtures', help='directory of <yahoo symbol>.json files (offline test)')
    ap.add_argument('--out', default=OUT)
    a = ap.parse_args()
    old = {}
    if os.path.exists(a.out):
        with open(a.out) as f:
            old = json.load(f)
    if a.fixtures:
        def get_raw(ysym):
            with open(os.path.join(a.fixtures, ysym + '.json')) as f:
                return json.load(f)
    else:
        get_raw = fetch
    new, failed = build(get_raw, old)
    same = (old.get('items') == new['items'] and old.get('spark') == new['spark'])
    if same:
        print('No change (weekend/holiday or already current); not writing.')
        return
    with open(a.out, 'w') as f:
        json.dump(new, f, indent=1)
    print('Wrote', a.out, '-', len(new['items']), 'symbols', ('(kept old: %s)' % ', '.join(failed)) if failed else '')


if __name__ == '__main__':
    main()
