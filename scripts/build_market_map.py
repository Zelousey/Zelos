"""Builds the globe's market map: data/globe-markets.json.

For every country in scripts/page-src/country_links.py it records the US-listed
country ETF's daily move (the globe's red/green tint), the day's biggest
mover among that country's companies (with a headline when one is supplied),
and the US-tradable stocks linked to it.

Input is one JSON file of daily moves, keyed by symbol:

    { "EWY": {"chg": -1.68, "m1": 1.3, "close": 182.53, "date": "2026-09-24"}, ... }

and, optionally, headlines keyed by symbol:

    { "ARM": {"title": "...", "publisher": "Benzinga", "published": "2026-09-24"} }

    python3 scripts/build_market_map.py moves.json [--headlines h.json] [--publish]

--publish also POSTs the result to the publish_market_map Cloud Function
(ZELOS_MARKET_MAP_URL + ZELOS_PUBLISH_SECRET env vars), so the live site
updates without a redeploy. See docs/market-map.md for the daily runbook.
"""
import argparse
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, 'page-src'))
from country_links import COUNTRIES  # noqa: E402


def build(moves, headlines):
    dates = sorted({v.get('date') for v in moves.values() if v.get('date')})
    as_of = dates[-1] if dates else None
    out = {}
    for iso, c in COUNTRIES.items():
        etf = moves.get(c['etf']) if c['etf'] else None
        local = [{'name': n, 'sym': s, 'chg': moves[s]['chg'] if s and s in moves else None, 'listed': bool(s)}
                 for n, s in c['local']]
        us = [{'sym': s, 'why': why, 'chg': moves[s]['chg'] if s in moves else None} for s, why in c['us']]
        movers = [x for x in local if x['chg'] is not None]
        trending = None
        if movers:
            t = max(movers, key=lambda x: abs(x['chg']))
            # prefer a mover with a headline explaining it, if it moved nearly as much
            with_news = [x for x in movers if x['sym'] in headlines and abs(x['chg']) >= 0.6 * abs(t['chg'])]
            if with_news:
                t = max(with_news, key=lambda x: abs(x['chg']))
            trending = dict(t)
            h = headlines.get(t['sym'])
            if h:
                trending['headline'] = h
        out[iso] = {
            'name': c['name'], 'etf': c['etf'], 'etfLabel': c.get('etf_label', c['etf'] or ''),
            'chg': etf['chg'] if etf else None, 'm1': etf.get('m1') if etf else None,
            'trending': trending, 'local': local, 'us': us,
        }
    return {'asOf': as_of, 'source': 'Daily closes of US-listed shares via Robinhood market data',
            'note': 'Country moves use each country\'s US-listed ETF, in US dollars. Links are business relationships, not recommendations.',
            'countries': out}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('moves')
    ap.add_argument('--headlines')
    ap.add_argument('--out', default=os.path.join(ROOT, 'data', 'globe-markets.json'))
    ap.add_argument('--publish', action='store_true')
    a = ap.parse_args()
    moves = json.load(open(a.moves))
    headlines = json.load(open(a.headlines)) if a.headlines else {}
    data = build(moves, headlines)
    with open(a.out, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print('wrote %s (%d countries, as of %s)' % (a.out, len(data['countries']), data['asOf']))
    if a.publish:
        url, secret = os.environ.get('ZELOS_MARKET_MAP_URL'), os.environ.get('ZELOS_PUBLISH_SECRET')
        if not url or not secret:
            sys.exit('set ZELOS_MARKET_MAP_URL and ZELOS_PUBLISH_SECRET to publish')
        req = urllib.request.Request(url, data=json.dumps(data).encode(), method='POST',
                                     headers={'Content-Type': 'application/json', 'X-Zelos-Secret': secret})
        with urllib.request.urlopen(req, timeout=30) as r:
            print('published:', r.status, r.read()[:200])


if __name__ == '__main__':
    main()
