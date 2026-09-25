"""Builds data/market-snapshot.json — the data behind Zelos' own ticker tape,
Market Overview mini-chart and quotes tables (zelos-market.js).

TradingView is now only used for the full interactive Live Chart; every other
market number on the site comes from this file, so it is always dark-themed,
on-brand, and traceable to Robinhood market data.

Inputs are raw Robinhood MCP tool outputs saved as JSON:

    --index-quotes   get_index_quotes   (SPX, NDX, DJX ids from get_indexes)
    --index-bars     get_index_historicals, interval=day, ~6 weeks back
                     (gives the prior close + the 1-month sparkline)
    --equity-quotes  get_equity_quotes  (AAPL NVDA TSLA + sector ETFs)
    --crypto-quotes  get_crypto_quotes  (BTC-USD)

    python3 scripts/build_market_snapshot.py \
        --index-quotes iq.json --index-bars ib.json \
        --equity-quotes eq.json --crypto-quotes cq.json

Run it after the 4 pm ET close (that's the site's publishing rule) and commit
the result. Interpolated (weekend/holiday gap-fill) bars are dropped.
"""
import argparse
import datetime as dt
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'market-snapshot.json')

LABELS = {
    'SPX': 'S&P 500', 'NDX': 'Nasdaq 100', 'DJX': 'Dow (DJX)',
    'AAPL': 'AAPL', 'NVDA': 'NVDA', 'TSLA': 'TSLA', 'BTCUSD': 'Bitcoin',
    'XLK': 'Technology', 'XLC': 'Communication', 'XLY': 'Consumer Disc.',
    'XLV': 'Healthcare', 'XLF': 'Financials', 'XLE': 'Energy',
}
TAPE = ['SPX', 'NDX', 'DJX', 'AAPL', 'NVDA', 'TSLA', 'BTCUSD', 'XLK', 'XLE']
INDICES = ['SPX', 'NDX', 'DJX']
SECTORS = ['XLK', 'XLC', 'XLY', 'XLV', 'XLF', 'XLE']
SPARK = ['SPX', 'NDX', 'DJX']


def load(path):
    with open(path) as f:
        d = json.load(f)
    return d.get('data', d)


def item(sym, kind, price, prev, as_of):
    chg = price - prev
    return {'sym': sym, 'label': LABELS.get(sym, sym), 'kind': kind,
            'price': round(price, 4), 'prev': round(prev, 4),
            'chg': round(chg, 4), 'pct': round(chg / prev * 100, 2) if prev else None,
            'asOf': as_of}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--index-quotes', required=True)
    ap.add_argument('--index-bars', required=True)
    ap.add_argument('--equity-quotes', required=True)
    ap.add_argument('--crypto-quotes', required=True)
    ap.add_argument('--out', default=OUT)
    a = ap.parse_args()

    items, spark = {}, {}

    # index daily bars -> sparkline + prior close
    bars = {}
    for r in load(a.index_bars)['results']:
        pts = [{'d': b['begins_at'][:10], 'c': float(b['close_value'])}
               for b in r['bars'] if not b.get('interpolated')]
        bars[r['symbol']] = pts

    for q in load(a.index_quotes)['quotes']:
        sym, val, ts = q['symbol'], float(q['value']), q.get('venue_timestamp')
        today = (ts or '')[:10]
        pts = [p for p in bars.get(sym, []) if p['d'] < today] if today else bars.get(sym, [])
        if not pts:
            continue
        items[sym] = item(sym, 'index', val, pts[-1]['c'], ts)
        if sym in SPARK:
            spark[sym] = pts + [{'d': today, 'c': val}]

    for r in load(a.equity_quotes)['results']:
        q = r['quote']
        cands = [(q.get('venue_last_trade_time') or '', q.get('last_trade_price')),
                 (q.get('venue_last_non_reg_trade_time') or '', q.get('last_non_reg_trade_price'))]
        # regular-session price is what the site shows (after-hours ignored)
        price = float(q['last_trade_price'])
        items[q['symbol']] = item(q['symbol'], 'equity', price,
                                  float(q['adjusted_previous_close']), cands[0][0])

    for r in load(a.crypto_quotes)['results']:
        items[r['symbol']] = item(r['symbol'], 'crypto', float(r['mark_price']),
                                  float(r['open_price']), r.get('updated_at'))

    out = {
        'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
        'source': 'Robinhood market data (regular-session prices; crypto is 24/7)',
        'items': items,
        'groups': {'tape': [s for s in TAPE if s in items],
                   'indices': [s for s in INDICES if s in items],
                   'sectors': [s for s in SECTORS if s in items]},
        'spark': {s: {'label': LABELS[s], 'points': p} for s, p in spark.items()},
    }
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, 'w') as f:
        json.dump(out, f, indent=1)
    print('wrote', a.out, '-', len(items), 'symbols')


if __name__ == '__main__':
    main()
