"""Turns raw Robinhood MCP outputs into the moves file build_market_map.py reads.

    python3 scripts/moves_from_robinhood.py --quotes quotes.json --bars bars1.json bars2.json ... > moves.json

quotes.json: one get_equity_quotes result for every symbol (its previous_close is
the latest official close once the session is over). bars*.json:
get_equity_historicals results (interval=day, ~2 months back) used for the prior
close and the 1-month change.

previous_close only rolls over to the new session overnight, so a same-evening
run would rebuild the day before. Pass --after-close when running after today's
4:00 pm ET close: each symbol's last regular-session trade (last_trade_price)
then counts as today's close when it's dated after previous_close_date. Leave it
off during market hours, or intraday prices would be recorded as a close. Prints the list of symbols with `python3
scripts/moves_from_robinhood.py --symbols`.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'page-src'))
from country_links import COUNTRIES  # noqa: E402


def symbols():
    s = set()
    for c in COUNTRIES.values():
        if c['etf']:
            s.add(c['etf'])
        s.update(x[1] for x in c['local'] if x[1])
        s.update(x[0] for x in c['us'])
    return sorted(s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--symbols', action='store_true')
    ap.add_argument('--quotes')
    ap.add_argument('--bars', nargs='*', default=[])
    ap.add_argument('--after-close', action='store_true')
    a = ap.parse_args()
    if a.symbols:
        print(json.dumps(symbols()))
        return
    bars = {}
    for f in a.bars:
        for r in json.load(open(f))['data']['results']:
            bars[r['symbol']] = [(b['begins_at'][:10], float(b['close_price'])) for b in r['bars'] if not b.get('interpolated')]
    out = {}
    for r in json.load(open(a.quotes))['data']['results']:
        q = r.get('quote', r)
        sym, b = q['symbol'], bars.get(q['symbol'])
        if not b or not q.get('previous_close'):
            continue
        last, d = float(q['previous_close']), q['previous_close_date']
        traded = (q.get('venue_last_trade_time') or '')[:10]
        if a.after_close and q.get('last_trade_price') and traded > d:
            last, d = float(q['last_trade_price']), traded
        prior = [x for x in b if x[0] < d]
        if not prior:
            continue
        m1 = prior[-21][1] if len(prior) > 21 else prior[0][1]
        out[sym] = {'close': last, 'date': d, 'chg': round((last / prior[-1][1] - 1) * 100, 2), 'm1': round((last / m1 - 1) * 100, 1)}
    json.dump(out, sys.stdout)


if __name__ == '__main__':
    main()
