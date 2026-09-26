"""Builds the $10,000 Practice Account page: practice/index.html.

    python3 scripts/build_practice.py

Page logic lives in practice/practice.js (account, orders, live prices) and
practice/practice-chart.js (chart + indicators); styles in practice/practice.css.
Live quotes come from the refresh_quotes Cloud Function (functions/main.py);
see docs/practice-account.md.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from site_shell import render, breadcrumbs, SITE  # noqa: E402

HEAD = '<link rel="stylesheet" href="../zelos-theme.css">\n<link rel="stylesheet" href="practice.css">\n'

BODY = '''<main class="pt-shell">
  <div class="pt-top">
    <div>
      <span class="pt-kicker">Practice account &middot; paper trading</span>
      <h1>$10,000 Practice Account</h1>
      <p>Trade real stocks at real prices with $10,000 of practice money. Full charts and indicators, market, limit and stop orders,
      stop-loss and take-profit brackets. No real money, no brokerage account.</p>
    </div>
    <div class="pt-acct">
      <span class="is-main"><small>Account value</small><b id="ptEquity">$10,000.00</b></span>
      <span><small>Today</small><b id="ptDay">+$0.00</b></span>
      <span><small>Total P&amp;L</small><b id="ptTotal">+$0.00</b></span>
      <span><small>Cash</small><b id="ptCash">$10,000.00</b></span>
      <span><small>Buying power</small><b id="ptBP">$10,000.00</b></span>
    </div>
  </div>
  <div class="pt-statusbar">
    <span class="pt-feed" id="ptFeed">Connecting to live prices…</span>
    <span class="pt-clock" id="ptClock">Market closed</span>
    <span class="pt-sync" id="ptSync">Saved in this browser</span>
  </div>

  <div class="pt-grid">
    <aside class="pt-card pt-watch-card" aria-label="Stocks">
      <input class="pt-search" id="ptSearch" type="search" placeholder="Search 30 stocks & ETFs" aria-label="Search stocks">
      <div class="pt-watch" id="ptWatch"></div>
    </aside>

    <section class="pt-card pt-main" aria-label="Chart">
      <div class="pt-qhead">
        <h2 id="ptSym">AAPL</h2><span class="pt-name" id="ptName">Apple</span>
        <span class="pt-px" id="ptPx">–</span><span class="pt-chg" id="ptChg"></span>
      </div>
      <div class="pt-stats" id="ptStats"></div>
      <div class="pt-toolbar">
        <span class="pt-seg" role="group" aria-label="Timeframe">
          <button class="pt-chip" type="button" data-tf="5m" title="5-minute bars">5m</button>
          <button class="pt-chip" type="button" data-tf="15m" title="15-minute bars">15m</button>
          <button class="pt-chip" type="button" data-tf="1h" title="1-hour bars">1H</button>
          <button class="pt-chip" type="button" data-tf="D" title="Daily bars">D</button>
          <button class="pt-chip" type="button" data-tf="W" title="Weekly bars">W</button>
        </span>
        <span class="pt-seg" id="ptRanges" role="group" aria-label="Range"></span>
        <button class="pt-chip" type="button" id="ptZoomIn" aria-label="Zoom in">+</button>
        <button class="pt-chip" type="button" id="ptZoomOut" aria-label="Zoom out">&minus;</button>
        <span class="grow"></span>
        <button class="pt-chip" type="button" data-ind="sma20">SMA 20</button>
        <button class="pt-chip" type="button" data-ind="sma50">SMA 50</button>
        <button class="pt-chip" type="button" data-ind="ema9">EMA 9</button>
        <button class="pt-chip" type="button" data-ind="bb">Bollinger</button>
        <button class="pt-chip" type="button" data-ind="vol">Volume</button>
        <button class="pt-chip" type="button" data-ind="rsi">RSI</button>
        <button class="pt-chip" type="button" data-ind="macd">MACD</button>
        <span class="pt-colors">
          <button class="pt-chip" type="button" id="ptColorsBtn" aria-haspopup="true" aria-expanded="false" title="Candle colors"><i class="pt-swatch" id="ptColorSwatch"></i>Colors</button>
          <div class="pt-color-pop" id="ptColorPop" hidden>
            <b>Candle colors</b>
            <div class="pt-presets" id="ptColorPresets"></div>
            <div class="pt-custom">
              <label>Up <input type="color" id="ptColorUp"></label>
              <label>Down <input type="color" id="ptColorDown"></label>
            </div>
            <small>Also used on the Arcade charts. Saved in this browser.</small>
          </div>
        </span>
      </div>
      <div class="pt-chart-wrap"><canvas class="pt-chart" id="ptChart" aria-label="Price chart"></canvas></div>
      <p class="pt-hint">Scroll to zoom &middot; drag to pan &middot; hover for exact values. Dashed lines are your average cost and open orders.</p>
    </section>

    <div class="pt-ticket-col">
      <section class="pt-card pt-ticket" aria-label="Order ticket">
        <div class="pt-sides">
          <button class="pt-side is-on" type="button" id="ptBuy" aria-pressed="true">Buy</button>
          <button class="pt-side" type="button" id="ptSell" aria-pressed="false">Sell</button>
        </div>
        <label class="pt-fp"><input type="checkbox" id="ptFullPort"><span class="pt-fp-track"><i></i></span><span><b>Full Port</b> (all-in)</span></label>
        <div class="pt-fp-warn" id="ptFullWarn" hidden><b>&#9888; Full Port:</b> every buy puts your <b>entire buying power</b> into one stock, and every
        sell dumps the whole position. One bad trade can take a huge bite out of the account, which is exactly how real accounts blow up. The screen
        glows green or red with how the account is doing.</div>
        <div class="pt-field"><span>Order type</span>
          <div class="pt-types" role="radiogroup" aria-label="Order type">
            <label><input type="radio" name="ptType" value="market" checked>Market</label>
            <label><input type="radio" name="ptType" value="limit">Limit</label>
            <label><input type="radio" name="ptType" value="stop">Stop</label>
          </div>
        </div>
        <label class="pt-field"><span><span id="ptQtyLabel">Shares</span><button class="pt-linkbtn" type="button" id="ptQtyMode">Use $ amount</button></span>
          <input id="ptQty" type="number" min="0" step="1" inputmode="decimal" placeholder="0"></label>
        <label class="pt-field" id="ptLimitRow" hidden><span>Limit price</span><input id="ptLimit" type="number" min="0" step="0.01" inputmode="decimal"></label>
        <label class="pt-field" id="ptStopRow" hidden><span>Stop price</span><input id="ptStopPx" type="number" min="0" step="0.01" inputmode="decimal"></label>
        <label class="pt-field"><span>Time in force</span>
          <select id="ptTif"><option value="day">Day</option><option value="gtc">Good til cancelled</option></select></label>
        <div class="pt-bracket" id="ptBracket">
          <label class="pt-check"><input type="checkbox" id="ptUseBracket"> Add stop-loss / take-profit</label>
          <div class="pt-bracket-fields" id="ptBracketFields" hidden>
            <label class="pt-field"><span>Stop-loss</span><input id="ptSL" type="number" min="0" step="0.01" inputmode="decimal"></label>
            <label class="pt-field"><span>Take-profit</span><input id="ptTP" type="number" min="0" step="0.01" inputmode="decimal"></label>
          </div>
        </div>
        <p class="pt-est" id="ptEst"></p>
        <p class="pt-when" id="ptWhen"></p>
        <button class="pt-submit is-buy" type="button" id="ptSubmit">Review buy</button>
        <p class="pt-fine">Practice only. Long positions, cash account, no fees. Prices are real; your money isn't.</p>
      </section>
    </div>
  </div>

  <section class="pt-card pt-lower" aria-label="Portfolio">
    <div class="pt-tabs" role="tablist">
      <button class="pt-tab" type="button" role="tab" data-tab="positions" aria-selected="true">Positions</button>
      <button class="pt-tab" type="button" role="tab" data-tab="orders" aria-selected="false">Open orders</button>
      <button class="pt-tab" type="button" role="tab" data-tab="history" aria-selected="false">History</button>
      <button class="pt-tab" type="button" role="tab" data-tab="performance" aria-selected="false">Performance</button>
    </div>
    <div class="pt-table-wrap" id="ptTabBody"></div>
  </section>

  <section class="pt-about">
    <h2>How the practice account works</h2>
    <p><b>Prices are real.</b> During market hours (9:30 am to 4:00 pm Eastern, weekdays) quotes update about once a minute. Outside those hours
    you see the latest close, and market orders wait for the next open, just like at a real broker.</p>
    <p><b>Orders.</b> Market orders fill at the current price. Limit orders fill at your price or better. Stop orders trigger when price
    reaches your stop (a gap can fill it past your price). Day orders expire at the close; good-til-cancelled orders stay open. Add a
    stop-loss and take-profit to a buy and they're placed together the moment it fills: whichever hits first cancels the other.</p>
    <p><b>Timeframes.</b> Daily and weekly charts go back to 2024. The 5-minute, 15-minute and 1-hour charts are built from the live
    price feed during market hours and keep the last five sessions.</p>
    <p><b>Full Port</b> is the all-in mode from Chart Replay: every order uses all your buying power, and the screen glows with your
    profit or loss. It's here so you can feel how fast concentration swings an account, not as a way to trade.</p>
    <p><b>Your account</b> is saved in this browser. Sign in and it follows you to any device. Reset it to $10,000 any time from the
    Performance tab. Want to train your eye first? Try <a href="../games/chart-replay.html">Chart Replay</a> or
    <a href="../games/grade-the-setup.html">Grade the Setup</a>.</p>
    <p class="pt-fine">Paper trading for practice and education only. Not investment advice, no real orders, no brokerage connection.
    Quotes may be delayed or briefly unavailable; holidays aren't modelled.</p>
  </section>
</main>

<div class="pt-modal" id="ptConfirm" hidden role="dialog" aria-modal="true" aria-labelledby="ptConfirmTitle">
  <div class="pt-modal-card">
    <h3 id="ptConfirmTitle">Confirm order</h3>
    <p id="ptConfirmText"></p>
    <div class="pt-modal-actions">
      <button class="pt-btn" type="button" id="ptConfirmCancel">Cancel</button>
      <button class="pt-btn pt-btn-go" type="button" id="ptConfirmGo">Place order</button>
    </div>
  </div>
</div>'''


def main():
    desc = ('Free $10,000 practice trading account: trade real stocks at live prices with paper money. Candlestick charts with RSI, MACD, '
            'Bollinger Bands and moving averages, plus market, limit, stop and bracket orders.')
    ld = {
        '@context': 'https://schema.org', '@type': 'WebApplication', 'name': 'Zelos $10,000 Practice Account',
        'url': SITE + '/practice/', 'description': desc, 'applicationCategory': 'FinanceApplication',
        'operatingSystem': 'Web browser', 'isAccessibleForFree': True,
        'offers': {'@type': 'Offer', 'price': 0, 'priceCurrency': 'USD'},
        'publisher': {'@type': 'Organization', 'name': 'Zelos', 'url': SITE + '/'},
    }
    scripts = '<script src="practice-chart.js"></script>\n<script src="practice.js"></script>\n'
    render('practice/index.html', '$10,000 Practice Account: Free Paper Trading with Live Prices | Zelos', desc, BODY, HEAD, scripts,
           jsonld=[ld, breadcrumbs([('Zelos', ''), ('Practice Account', None)])])
    print('built practice/index.html')


if __name__ == '__main__':
    main()
