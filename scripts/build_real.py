"""Builds the Real Trade Journal: real/index.html (REAL mode).

    python3 scripts/build_real.py

Logic in real/real.js, styles in practice/practice.css (shared UI) + real/real.css.
Real trades are logged by the trader; Zelos never connects to a brokerage account.
Kept completely separate from Trade War (virtual, practice/). See zelos-modes.js.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from site_shell import render, breadcrumbs, SITE  # noqa: E402

HEAD = ('<link rel="stylesheet" href="../zelos-theme.css">\n<link rel="stylesheet" href="../practice/practice.css">\n'
        '<link rel="stylesheet" href="real.css">\n')

BODY = '''<main class="pt-shell ch-shell rj-shell">
  <nav class="pf-crumbs"><a href="../dashboard.html">&larr; Command Center</a> &middot; <a href="../practice/">Trade War (virtual)</a> &middot; <a href="../live-chart.html">Charts</a></nav>
  <div class="ch-hero">
    <span class="zm-tag is-real">REAL TRADE</span>
    <h1>Real Trade Journal</h1>
    <p>Track the trades you actually make with real money at your own broker. Zelos never connects to or places trades in a brokerage
    account: you log them here, privately. Kept completely separate from <a href="../practice/">Trade War</a>, where everything is virtual.</p>
  </div>
  <div id="rjBody"><p class="pt-empty">Loading…</p></div>
  <section class="pt-about">
    <h2>Real Trading vs Trade War</h2>
    <p><b>One account, two trading modes.</b> Your XP, level, streak, achievements, friends and profile are shared. The money and the statistics
    never mix: real trades are marked <b>REAL TRADE</b> and live here; Trade War trades are marked <b>TRADE WAR — VIRTUAL</b> and use a $10,000
    virtual account. Trade War leaderboards only ever rank virtual accounts.</p>
    <p><b>Real Trading status</b> on your profile comes from trades you log here over time (timestamped by the server, so they can't be
    backdated). It shows that you use the real-trading side, not that you're profitable. Broker-verified trades are on the roadmap.</p>
    <p class="pt-fine">Journal for your own records. Not investment advice. Zelos doesn't hold, route or execute orders.</p>
  </section>
</main>'''


def main():
    desc = ('Real Trade Journal: log and track the real trades you make at your own broker, with live prices for open positions, '
            'win rate and P&L. Private to your account, kept separate from Trade War virtual trading.')
    scripts = ('<script src="../zelos-modes.js"></script>\n<script src="../zelos-levels.js"></script>\n<script src="../zelos-progress.js"></script>\n'
               '<script src="real.js"></script>\n')
    render('real/index.html', 'Real Trade Journal: Track Your Real Trades | Zelos', desc, BODY, HEAD, scripts,
           jsonld=[breadcrumbs([('Zelos', ''), ('Real Trade Journal', None)])])
    print('built real/index.html')


if __name__ == '__main__':
    main()
