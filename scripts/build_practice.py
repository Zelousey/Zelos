"""Builds Trade War: practice/index.html (the Trade War home: Main account + hub) + profile, squads and match (war.html) pages.

    python3 scripts/build_practice.py

Page logic lives in practice/practice.js (account, orders, live prices) and
practice/practice-chart.js (chart + indicators); styles in practice/practice.css.
Live quotes come from the refresh_quotes Cloud Function (functions/main.py);
see docs/practice-account.md.
"""
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from site_shell import render, breadcrumbs, SITE  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

HEAD = '<link rel="stylesheet" href="../zelos-theme.css">\n<link rel="stylesheet" href="practice.css">\n'

BODY = '''<main class="pt-shell">
  <h1 class="pt-sr">Trade War: your $10,000 virtual trading account</h1>
  <div id="twTop" class="twh-wrap"></div>
  <div id="zOnboard" class="tw-onboard" hidden></div>
  <div id="twTiles" class="twh-tiles" aria-label="Missions, achievements, leaderboards, friends"></div>
  <div class="pt-statusbar">
    <span class="pt-feed" id="ptFeed">Connecting to live prices…</span>
    <span class="pt-clock" id="ptClock">Market closed</span>
    <span class="pt-sync" id="ptSync">Saved in this browser</span>
    <button class="pt-bell" type="button" id="ptBell" title="Get a pop-up when a take profit or stop loss hits">&#128277;<span>Alerts</span></button>
  </div>
  <div class="pt-reset-banner" id="ptResetBanner" hidden>
    <span><b>Account below $2,500.</b> You can start over at $10,000. Your trade history is kept and the reset shows on your stats.</span>
    <button class="pt-btn" type="button" id="ptResetBtn">Reset account</button>
  </div>

  <div class="pt-recovery" id="ptRecovery" hidden></div>

  <div class="pt-grid">
    <section class="pt-card pt-acard" aria-label="Main account">
      <div class="pt-acard-head"><span class="pt-acard-k">Main account &middot; <span class="zm-tag is-war">VIRTUAL</span></span><button class="pt-linkbtn" type="button" id="ptHistBtn">History &rsaquo;</button></div>
      <b class="pt-acard-eq" id="ptEquity">…</b>
      <span class="pt-acard-since"><b id="ptTotal">…</b> <span id="ptSinceLbl">since start</span></span>
      <div class="pt-acard-chart"><canvas id="ptAcctChart" aria-label="Account value history, resets marked"></canvas></div>
      <div class="pt-acard-foot"><span id="ptAcctNote">Account #1</span><span class="pt-acard-rng" id="ptAcctRng"><button type="button" data-ar="31">1M</button><button type="button" data-ar="92">3M</button><button type="button" data-ar="all" class="is-on">ALL</button></span></div>
      <div class="pt-acard-stats" data-help="Account value is your cash plus what your positions are worth at live prices. Everyone starts with $10,000 of virtual money; nothing here is real money. RESET on the chart marks where you started over."><span><small>Today</small><b id="ptDay">…</b></span><span><small>Open P&amp;L</small><b id="ptOpen">…</b></span><span><small>Buying power</small><b id="ptBP">…</b></span></div>
    </section>

    <aside class="pt-card pt-watch-card" aria-label="Stocks and crypto">
      <input class="pt-search" id="ptSearch" type="search" placeholder="Search stocks, ETFs &amp; crypto" aria-label="Search stocks and crypto">
      <div class="pt-watch" id="ptWatch"></div>
    </aside>

    <section class="pt-card pt-main" aria-label="Chart">
      <div class="pt-qhead">
        <h2 id="ptSym">NVDA</h2><span class="pt-name" id="ptName"></span>
        <span class="pt-dd pt-news-dd">
          <button class="pt-chip pt-news-btn" type="button" id="ptNewsBtn" aria-haspopup="true" aria-expanded="false">News <em id="ptNewsN" hidden></em> <span class="pt-caret">&#9662;</span></button>
          <div class="pt-menu pt-news" id="ptNewsMenu" hidden></div>
        </span>
        <span class="pt-earn" id="ptEarn" hidden></span>
        <span class="pt-px" id="ptPx">–</span><span class="pt-chg" id="ptChg"></span>
      </div>
      <div class="pt-toolbar">
        <span class="pt-dd">
          <button class="pt-chip pt-dd-btn" type="button" id="ptTfBtn" aria-haspopup="true" aria-expanded="false" title="Timeframe">D</button>
          <div class="pt-menu pt-tf-menu" id="ptTfMenu" role="menu" hidden></div>
        </span>
        <span class="pt-seg" id="ptRanges" role="group" aria-label="Range"></span>
        <button class="pt-chip" type="button" id="ptStyle" title="Switch between a live line and candles">Candles</button>
        <span class="pt-dd">
          <button class="pt-chip pt-dd-btn" type="button" id="ptIndBtn" aria-haspopup="true" aria-expanded="false">Indicators</button>
          <div class="pt-menu pt-ind-menu" id="ptIndMenu" hidden></div>
        </span>
        <button class="pt-chip pt-fc-chip" type="button" id="ptForecast" aria-pressed="false" title="Draw your stop-loss and take-profit as boxes on the chart. Drag an edge to move it."><i></i>SL / TP boxes</button>
        <button class="pt-chip" type="button" id="ptFib" aria-pressed="false" title="Fibonacci retracement across the visible swing">Fib</button>
        <button class="pt-chip" type="button" id="ptAlertAdd" aria-pressed="false" title="Set a Trade War price alert: press, then click a price on the chart">&#9200; Alert</button>
        <button class="pt-chip" type="button" id="ptAbc" aria-pressed="false" title="Three-Legged Strategy: draw an A-B-C pullback (click the start, then the ends of legs A, B and C)">3-Leg</button>
        <span class="grow"></span>
        <span class="pt-dd">
          <button class="pt-chip" type="button" id="ptColorsBtn" aria-haspopup="true" aria-expanded="false" title="Candle colors"><i class="pt-swatch" id="ptColorSwatch"></i>Colors</button>
          <div class="pt-menu pt-color-pop" id="ptColorPop" hidden>
            <b>Candle colors</b>
            <div class="pt-presets" id="ptColorPresets"></div>
            <div class="pt-custom">
              <label>Up <input type="color" id="ptColorUp"></label>
              <label>Down <input type="color" id="ptColorDown"></label>
            </div>
            <small>Also used on the Arcade charts. Saved in this browser.</small>
          </div>
        </span>
        <button class="pt-chip" type="button" id="ptZoomIn" aria-label="Zoom in">+</button>
        <button class="pt-chip" type="button" id="ptZoomOut" aria-label="Zoom out">&minus;</button>
      </div>
      <div class="pt-chart-wrap"><canvas class="pt-chart" id="ptChart" aria-label="Price chart"></canvas></div>
      <div class="pt-active" id="ptActive" hidden></div>
      <div class="pt-stats" id="ptStats"></div>
      <p class="pt-hint">Scroll to zoom &middot; drag to pan &middot; hover for exact values. Dashed lines are your average cost and open orders.</p>
    </section>

    <div class="pt-ticket-col">
      <section class="pt-card pt-ticket" aria-label="Order ticket">
        <div class="pt-modes" role="tablist" aria-label="Trade">
          <button type="button" role="tab" data-mode="stock" class="is-on" aria-selected="true">Stock</button>
          <button type="button" role="tab" data-mode="options" aria-selected="false">Options</button>
        </div>
        <div id="ptStockTicket">
          <div class="pt-sides" data-help="Buy opens or adds to a position. Sell closes shares you already own. Pick a stock on the left, choose how many shares, then press the big button below.">
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
          <div class="pt-bracket" id="ptBracket" data-help="Optional safety net: a stop-loss sells automatically if the price falls to your level, a take-profit sells when it reaches your target. Whichever hits first cancels the other.">
            <label class="pt-check"><input type="checkbox" id="ptUseBracket"> Add stop-loss / take-profit</label>
            <div class="pt-bracket-fields" id="ptBracketFields" hidden>
              <label class="pt-field pt-f-sl"><span>Stop-loss</span><input id="ptSL" type="number" min="0" step="0.01" inputmode="decimal"></label>
              <label class="pt-field pt-f-tp"><span>Take-profit</span><input id="ptTP" type="number" min="0" step="0.01" inputmode="decimal"></label>
            </div>
          </div>
          <div class="pt-est" id="ptEst"></div>
          <p class="pt-when" id="ptWhen"></p>
          <button class="pt-submit is-buy" type="button" id="ptSubmit"><span class="pt-sub-main">Buy</span></button>
        </div>
        <div id="ptOptTicket" hidden>
          <div class="pt-sides pt-otypes">
            <button class="pt-side is-on" type="button" data-otype="call">Calls</button>
            <button class="pt-side" type="button" data-otype="put">Puts</button>
          </div>
          <label class="pt-field"><span>Expiration</span><select id="ptOptExp"></select></label>
          <div class="pt-chain-wrap" id="ptChain"></div>
          <div class="pt-opt-pick" id="ptOptPick"></div>
          <label class="pt-field"><span>Contracts</span><input id="ptOptQty" type="number" min="1" step="1" value="1" inputmode="numeric"></label>
          <div class="pt-opt-btns">
            <button class="pt-submit is-buy" type="button" id="ptOptBuy" disabled><span class="pt-sub-main">Buy to open</span></button>
            <button class="pt-submit is-sell" type="button" id="ptOptSell" disabled><span class="pt-sub-main">Sell to close</span></button>
          </div>
          <p class="pt-fine" id="ptOptNote"></p>
        </div>
        <p class="pt-fine"><b>Trade War: virtual money.</b> Long positions, cash account, no fees. Prices are real; your money isn't. Made a real trade? Log it in the <a href="../real/">Real Trade Journal</a>.</p>
      </section>
    </div>
  </div>

  <section class="pt-card pt-lower" aria-label="Portfolio">
    <div class="pt-tabs" role="tablist" data-help="Positions: what you own now. Open orders: orders waiting to fill (cancel them here). History: every fill. Progress: your XP, missions and badges.">
      <button class="pt-tab" type="button" role="tab" data-tab="positions" aria-selected="true">Positions</button>
      <button class="pt-tab" type="button" role="tab" data-tab="orders" aria-selected="false">Open orders</button>
      <button class="pt-tab" type="button" role="tab" data-tab="history" aria-selected="false">History</button>
      <button class="pt-tab" type="button" role="tab" data-tab="agents" aria-selected="false">Agent signals</button>
      <button class="pt-tab" type="button" role="tab" data-tab="performance" aria-selected="false">Performance</button>
      <button class="pt-tab" type="button" role="tab" data-tab="alerts" aria-selected="false">Alerts</button>
      <button class="pt-tab" type="button" role="tab" data-tab="progress" aria-selected="false">XP &amp; missions</button>
    </div>
    <div class="pt-table-wrap" id="ptTabBody"></div>
  </section>

  <section id="twHub" class="twh-hub" aria-label="Trade War home"></section>
  <details class="pt-about">
    <summary>How Trade War works</summary>
    <p><b>Trade War is virtual.</b> Every trade here uses virtual money from a $10,000 starting balance, marked <b>TRADE WAR — VIRTUAL</b>. Your
    real trades live separately in the <a href="../real/">Real Trade Journal</a>, marked <b>REAL TRADE</b>. The two never mix: Trade War
    leaderboards only rank virtual accounts, and your profile shows each side on its own. Both earn XP on the same account.</p>
    <p><b>Prices are real.</b> During market hours (9:30 am to 4:00 pm Eastern, weekdays) quotes update about once a minute. Outside those hours
    you see the latest close, and market orders wait for the next open, just like at a real broker.</p>
    <p><b>Orders.</b> Market orders fill at the current price. Limit orders fill at your price or better. Stop orders trigger when price
    reaches your stop (a gap can fill it past your price). Day orders expire at the close; good-til-cancelled orders stay open. Add a
    stop-loss and take-profit to a buy and they're placed together the moment it fills: whichever hits first cancels the other.
    Turn on <b>Alerts</b> to get a pop-up when one hits while this page is open.</p>
    <p><b>Options.</b> Buy calls and puts to open, sell them to close. There's no live options feed on this data plan, so option prices are
    <b>modeled</b> (Black-Scholes on the stock's live price and its recent volatility) with a bid/ask spread. Contracts left open at
    expiration settle at their intrinsic value.</p>
    <p><b>Agent signals.</b> The Agent signals tab shows the latest setup from each Zelos agent. One click loads it into your ticket with its
    stop and target so you can test the agent with virtual money.</p>
    <p><b>Timeframes.</b> Daily and weekly charts go back to 2024. The 5-minute, 15-minute and 1-hour charts come from the live
    price feed during market hours and keep the last five sessions.</p>
    <p><b>Crypto.</b> Bitcoin, Ethereum and the rest of the Crypto 24/7 list trade around the clock in your Main account, in fractions of a coin
    (Trade War matches stay stocks only). Crypto orders are good til cancelled.</p>
    <p><b>Your account</b> is saved in this browser. Sign in with Google and it follows you to any device and shows on the
    <a href="../leaderboard.html">leaderboard</a> (public numbers only: name, balance, trades; turn it off any time in Performance).
    If the account drops below $2,500 you can reset it to $10,000; resets are counted on your stats.
    Want to train your eye first? Try <a href="../games/chart-replay.html">Chart Replay</a> or
    <a href="../games/grade-the-setup.html">Grade the Setup</a>.</p>
    <p class="pt-fine">Trade War is virtual trading for practice, competition and education only. Not investment advice, no real orders, no brokerage connection.
    Quotes may be delayed or briefly unavailable; holidays aren't modelled.</p>
  </details>
</main>

<div class="pt-vmoney" aria-hidden="true">Trade War &middot; virtual money</div>

<div class="pt-gate" id="ptGate" hidden role="dialog" aria-modal="true" aria-labelledby="ptGateTitle">
  <div class="pt-gate-card">
    <span class="zm-tag is-war">TRADE WAR — VIRTUAL</span>
    <h2 id="ptGateTitle">You're entering Trade War</h2>
    <div class="pt-gate-start"><b>$10,000</b><span>virtual starting balance</span></div>
    <p><b>All trades in Trade War use virtual money.</b> Real stock prices, no real money, and nothing here touches a brokerage account.</p>
    <div class="pt-gate-who">
      <span class="pt-gate-av" aria-hidden="true">&#9679;</span>
      <span><b id="ptGateName">Guest</b><small id="ptGateWho">Guest · saved in this browser only</small></span>
      <button class="pt-linkbtn" type="button" id="ptGateRename" hidden>Edit profile</button>
    </div>
    <div class="pt-gate-bal"><small>Your Trade War account</small><b id="ptGateBal">$10,000.00</b></div>
    <button class="pt-btn pt-gate-google" type="button" id="ptGateGoogle"><svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true"><path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.7H9v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z"/><path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z"/><path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z"/></svg>Continue with Google</button>
    <p class="pt-auth-msg" id="ptGateMsg" role="alert" hidden></p>
    <button class="pt-btn pt-btn-go pt-gate-enter" type="button" id="ptGateEnter">Enter Trade War</button>
    <small class="pt-gate-fine">Sign in to save your account everywhere and appear on the Trade War leaderboards. Only your display name and virtual trading stats are public. Same account, XP and profile as the rest of AgenticTrading.info.</small>
  </div>
</div>

<div class="pt-modal" id="ptConfirm" hidden role="dialog" aria-modal="true" aria-labelledby="ptModalTitle">
  <div class="pt-modal-card">
    <h3 id="ptModalTitle">Confirm order</h3>
    <p id="ptModalText"></p>
    <div class="pt-modal-actions">
      <button class="pt-btn" type="button" id="ptModalCancel">Cancel</button>
      <button class="pt-btn pt-btn-go" type="button" id="ptModalGo">Place order</button>
    </div>
  </div>
</div>'''


PROFILE_BODY = '''<main class="pt-shell pf-shell">
  <nav class="pf-crumbs"><a href="../leaderboard.html#practice">&larr; Trade War leaderboard</a> &middot; <a href="./">Enter Trade War</a> &middot; <a href="../real/">Real Trade Journal</a></nav>
  <div id="pfBody"><p class="pt-empty">Loading profile…</p></div>
  <p class="pt-fine pf-fine">Public stats only. Trade War numbers are virtual money; Real Trading status comes from trades logged in the Real Trade
  Journal (self-reported, timestamped, never dollar amounts) and never implies profitability. The two are never combined. No email, login or personal
  details are shown. Trade War stats can be made private in Trade War's Performance tab; real-trade stats in the Real Trade Journal.</p>
</main>'''


SOCIAL_SCRIPTS = ('<script src="../zelos-signin.js"></script>\n<script src="../zelos-modes.js"></script>\n<script src="../zelos-levels.js"></script>\n<script src="../zelos-progress.js"></script>\n'
                  '<script src="../zelos-social.js"></script>\n<script src="../zelos-profile.js"></script>\n')
CRUMBS = ('<nav class="pf-crumbs"><a href="./">&larr; Trade War</a> &middot; '
          '<a href="squads.html">Squads</a> &middot; <a href="../leaderboard.html#practice">Leaderboards</a></nav>')


def build_social_pages():
    render('practice/squads.html', 'Join my Trading Squad: Private Trade War Leaderboard | Zelos',
           'You\'re invited to a private Trading Squad: compete with friends on your own leaderboard of $10,000 Trade War accounts (virtual money).',
           '<main class="pt-shell ch-shell">' + CRUMBS + '<div id="sqBody"><p class="pt-empty">Loading…</p></div>'
           '<p class="pt-fine pf-fine">Squads are private: only people with the invite link or room code can find one. Members see each other\'s public Trade War (virtual) stats, and only members can read the squad chat.</p></main>',
           HEAD, SOCIAL_SCRIPTS + '<script src="squads.js"></script>\n', robots='noindex')
    print('built practice/squads.html')


def build_war():
    render('practice/war.html', 'Trade War Matches: Equal Buy-In Trading Competitions | Zelos',
           'Create a Trade War: pick a virtual buy-in, invite friends, and everyone starts with the same money. Best % gain wins. Virtual money only.',
           '<main class="pt-shell ch-shell"><div id="twTop" class="twh-wrap"></div>' + CRUMBS + '<div id="twBody"><p class="pt-empty">Loading…</p></div>'
           '<p class="pt-fine pf-fine">Trade War matches use virtual money only: no cash value, no deposits, no prizes. Separate from your Main account and from real trading.</p></main>',
           HEAD, SOCIAL_SCRIPTS + '<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-functions-compat.js"></script>\n<script src="practice-chart.js"></script>\n<script src="war.js"></script>\n<script src="tw-home.js"></script>\n', robots='noindex')
    print('built practice/war.html')


def build_profile():
    desc = 'A Zelos trader profile: level, XP and streak, Real Trading activity, and Trade War (virtual $10,000 account) stats kept separately.'
    scripts = ('<script src="../zelos-modes.js"></script>\n<script src="../zelos-levels.js"></script>\n<script src="../zelos-progress.js"></script>\n<script src="../zelos-social.js"></script>\n'
               '<script src="../zelos-profile.js"></script>\n<script src="profile.js"></script>\n')
    render('practice/profile.html', 'Trader Profile | Zelos', desc, PROFILE_BODY, HEAD, scripts, robots='noindex')
    print('built practice/profile.html')


def main():
    desc = ('Trade War: a free $10,000 virtual trading account. Trade 50 real stocks and ETFs at live prices with virtual money and compete with friends. Candlestick charts with 13 '
            'indicators, market, limit, stop and bracket orders, simulated options, agent signals and a public leaderboard.')
    ld = {
        '@context': 'https://schema.org', '@type': 'WebApplication', 'name': 'Zelos Trade War ($10,000 virtual trading account)',
        'url': SITE + '/practice/', 'description': desc, 'applicationCategory': 'FinanceApplication',
        'operatingSystem': 'Web browser', 'isAccessibleForFree': True,
        'offers': {'@type': 'Offer', 'price': 0, 'priceCurrency': 'USD'},
        'publisher': {'@type': 'Organization', 'name': 'Zelos', 'url': SITE + '/'},
    }
    scripts = ('<script src="../zelos-signin.js"></script>\n<script src="../zelos-modes.js"></script>\n<script src="../zelos-levels.js"></script>\n<script src="../zelos-progress.js"></script>\n<script src="../zelos-social.js"></script>\n'
               '<script src="../zelos-profile.js"></script>\n<script src="practice-chart.js"></script>\n<script src="practice-options.js"></script>\n'
               '<script src="practice.js"></script>\n<script src="tw-home.js"></script>\n')
    render('practice/index.html', 'Trade War: $10,000 Virtual Trading Account, Compete with Friends | Zelos', desc, BODY, HEAD, scripts,
           jsonld=[ld, breadcrumbs([('Zelos', ''), ('Trade War', None)])])
    print('built practice/index.html')
    build_profile()
    build_social_pages()
    build_war()
    # the price function reads the same stock list, so it can never drift from the page
    shutil.copyfile(os.path.join(ROOT, 'data', 'practice-universe.json'), os.path.join(ROOT, 'functions', 'practice_universe.json'))
    print('copied data/practice-universe.json -> functions/practice_universe.json')
    shutil.copyfile(os.path.join(ROOT, 'data', 'crypto-universe.json'), os.path.join(ROOT, 'functions', 'crypto_universe.json'))
    print('copied data/crypto-universe.json -> functions/crypto_universe.json')


if __name__ == '__main__':
    main()
