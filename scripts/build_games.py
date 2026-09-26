"""Builds the chart-based Zelos Arcade games into /games/.

    python3 scripts/build_games.py

Game logic lives in games/zelos-chart-engine.js (shared) and
scripts/page-src/games/*.js (per page, inlined at build time).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from site_shell import render, breadcrumbs, SITE  # noqa: E402

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'page-src', 'games')
HEAD = ('<link rel="stylesheet" href="../zelos-theme.css">\n<link rel="stylesheet" href="zelos-games.css">\n')


def src(name):
    return open(os.path.join(SRC, name), encoding='utf-8').read()


def game_ld(name, path, desc):
    return {
        '@context': 'https://schema.org', '@type': ['VideoGame', 'LearningResource'],
        'name': name, 'url': SITE + '/' + path, 'description': desc,
        'genre': ['Educational', 'Simulation'], 'gamePlatform': 'Web browser', 'applicationCategory': 'Game',
        'isAccessibleForFree': True, 'learningResourceType': 'Interactive exercise',
        'teaches': 'Trade planning, stop placement and risk management on real historical stock charts',
        'publisher': {'@type': 'Organization', 'name': 'Zelos', 'url': SITE + '/'},
        'offers': {'@type': 'Offer', 'price': 0, 'priceCurrency': 'USD'},
    }


CTA = ('<div class="zg-cta"><span>Zelos runs this same checklist on the whole market every morning and publishes '
       'the setups that pass.</span><a class="zg-btn zg-btn-primary" href="../swing-trader.html">See Swing Trader &rarr;</a></div>')
NOTE = ('<p class="zg-fine" style="margin-top:14px;">Real historical daily bars (split-adjusted) for 30 widely traded US stocks and ETFs, '
        '2024 to 2026. Practice only: no real money, no account connection, not investment advice.</p>')

STATS_DRILL = ('<div class="zg-stats"><div class="zg-stat"><small>Score</small><b id="zgScore">0</b></div>'
               '<div class="zg-stat"><small>Best</small><b id="zgBest">–</b></div></div>')


def drill_page(path, game_id, title, h1, kicker, lede, rounds, howto, seo_title, desc):
    import json
    jstitle = json.dumps(title)
    body = f'''<main class="zg-shell" id="zgTop">
  <div class="zg-top">
    <div><span class="zg-kicker">{kicker}</span><h1>{h1}</h1><p>{lede}</p></div>
    {STATS_DRILL}
  </div>
  <div class="zg-progress" id="zgProgress"></div>
  <section class="zg-panel" id="zgRound"><p class="zg-prompt">Loading real charts…</p></section>
  {CTA}
  <section class="zg-howto">{howto}</section>
  {NOTE}
</main>'''
    js = src('drill-common.js') + f'''
(function(){{
  var GAME = '{game_id}', ROUNDS = {rounds!r};
  var best = ZC.store('best-' + GAME); document.getElementById('zgBest').textContent = best == null ? '–' : best;
  function start(){{
    ZC.load().then(function(data){{
      zgRunDrill({{ data: data, rand: ZC.rng(String(Date.now())), rounds: ROUNDS, onFinish: function(res){{
        var b = ZC.store('best-' + GAME) || 0; if (res.total > b) ZC.store('best-' + GAME, res.total);
        document.getElementById('zgBest').textContent = Math.max(b, res.total);
        res.host.innerHTML = '<div class="zg-end"><p class="zg-kicker">Session complete</p><h2>' + {jstitle} + '</h2>' +
          '<div class="zg-big">' + res.total + ' <span style="font-size:1rem;color:var(--muted)">/ ' + res.max + '</span></div>' +
          '<div class="zg-grid">' + res.grid + '</div>' +
          '<p class="zg-fine">Charts this session: ' + res.results.map(function(r){{ return r.sym + ' (' + ZC.monthYear(r.date) + ')'; }}).join(', ') + '</p>' +
          '<div class="zg-actions"><button class="zg-btn zg-btn-primary" id="zgAgain" type="button">Play again</button>' +
          '<button class="zg-btn" id="zgShare" type="button">Share</button><a class="zg-btn zg-back" href="daily-challenge.html">Today\\'s Daily Challenge</a>' +
          '<a class="zg-btn zg-back" href="../arcade.html">&larr; Back to Arcade</a></div></div>';
        document.getElementById('zgAgain').addEventListener('click', start);
        document.getElementById('zgShare').addEventListener('click', function(){{ var b2=this;
          ZC.share({jstitle} + ': ' + res.total + '/' + res.max + '\\n' + res.grid, 'https://agentictrading.info/{path}').then(function(){{ b2.textContent='Copied ✓'; }}); }});
        zgLeaderboard(res.host.querySelector('.zg-end'), GAME, res.total, {jstitle});
      }}, showMax: false }});
    }}).catch(function(){{ document.getElementById('zgRound').innerHTML = '<p class="zg-prompt">Couldn\\'t load chart data. Refresh to try again.</p>'; }});
  }}
  start();
}})();'''
    scripts = '<script src="zelos-chart-engine.js"></script>\n<script>\n' + js + '\n</script>\n'
    render(path, seo_title, desc, body, HEAD, scripts,
           jsonld=[game_ld(title, path, desc), breadcrumbs([('Zelos', ''), ('Arcade', 'arcade.html'), (title, None)])])


def main():
    drill_page(
        'games/grade-the-setup.html', 'grade-the-setup', 'Grade the Setup', 'Grade the Setup', 'Training drill · 8 rounds',
        'A real chart, entry at today\'s close. Plan the trade with the red stop and green target boxes, run the four-point swing '
        'trading checklist (trend, support, volume, reward:risk), decide whether it qualifies, then watch what actually happened.',
        ['grade'] * 8,
        '<h2>How a round works</h2><p>1. Tap the chart to set your stop (the red box is what you risk). 2. Tap again for your target '
        '(the green box is your reward). Drag either handle to adjust. 3. Answer the checklist. 4. Make the call. The chart then plays '
        'the next 20 trading days forward through your boxes.</p>'
        '<h2>How scoring works</h2><p>8 points per round: 1 for a stop just under the 10-day swing low (within one average daily range), '
        '1 for a target at the recent high (the first real resistance), 1 for each checklist answer and 2 for the final call. '
        'The rules are the same objective ones every time: price above a rising 50-day average; within about 3% of the 20-day '
        'average after a real pullback; lighter volume on the last three days; and room to the recent high of at least twice the stop distance.</p>'
        '<p>Want the background? Read <a href="../learn/what-is-a-pullback-trading-strategy.html">what a pullback strategy is</a> '
        'and <a href="../learn/what-is-reward-to-risk-ratio.html">how reward-to-risk works</a>.</p>',
        'Grade the Setup: Swing Trading Checklist Practice on Real Charts | Zelos',
        'Free swing trading drill: grade real historical stock charts against a trend, support, volume and reward-to-risk checklist, then see what happened next.')

    drill_page(
        'games/stop-drill.html', 'stop-drill', "Where's the Stop?", "Where's the Stop?", 'Training drill · 8 rounds',
        "You're long at the close. Tap the chart where your stop-loss belongs. Too tight and normal noise knocks you out; "
        'too wide and you waste your position size. Then watch the next 20 days play out.',
        ['stop'] * 8,
        '<h2>How scoring works</h2><p>Up to 70 points for placement and 30 for the outcome. The best zone is just under the most recent '
        'swing low, within one average daily range of it: the place where the trade idea is actually proven wrong. '
        'The outcome part pays 30 if price reaches a 2R target first, 15 if the stop simply survives.</p>'
        '<p>More on this: <a href="../learn/how-to-use-stop-losses-in-swing-trading.html">how to use stop-losses in swing trading</a> '
        'and <a href="../learn/how-to-find-stocks-near-support.html">how to find support</a>.</p>',
        "Where's the Stop? Stop-Loss Placement Practice on Real Charts | Zelos",
        'Free stop-loss placement game: tap where your stop goes on real historical stock charts, get graded on structure, then see what happened.')

    # ---------------- Daily Challenge
    body = f'''<main class="zg-shell" id="zgTop">
  <div class="zg-top">
    <div><span class="zg-kicker" id="dcDate">Daily Challenge</span><h1>The Zelos Daily Challenge</h1>
    <p>Five real charts, the same five for everyone today. Three setups to grade, two stops to place. One try per day. Share your grid.</p></div>
    <div class="zg-stats"><div class="zg-stat"><small>Score</small><b id="zgScore">0</b></div>
    <div class="zg-stat"><small>Streak</small><b id="zgStreak">0</b></div></div>
  </div>
  <div class="zg-progress" id="zgProgress"></div>
  <section class="zg-panel" id="zgRound"><p class="zg-prompt">Loading today's charts…</p></section>
  {CTA}
  <section class="zg-howto"><h2>How it works</h2><p>A new challenge unlocks at midnight Eastern. Every round is scored out of 100:
  grading rounds on the checklist (trend, support, volume, reward:risk) and your final call, stop rounds on placement plus outcome.
  A perfect day is 500. Play at least once a day to keep your streak.</p>
  <p>Practice without limits in <a href="grade-the-setup.html">Grade the Setup</a>, <a href="stop-drill.html">Where's the Stop?</a>
  and <a href="chart-replay.html">Chart Replay</a>.</p></section>
  {NOTE}
</main>'''
    js = src('drill-common.js') + '''
(function(){
  var day = ZC.etDateStr(), GAME = 'daily-' + day, KEY = 'zdc-' + day;
  document.getElementById('dcDate').textContent = 'Daily Challenge · ' + day;
  var streak = ZC.store('zdc-streak') || { n: 0, last: null };
  document.getElementById('zgStreak').textContent = streak.n;
  function endScreen(res){
    var host = document.getElementById('zgRound');
    host.innerHTML = '<div class="zg-end"><p class="zg-kicker">Daily Challenge · ' + day + '</p><h2>' + (res.total >= 400 ? 'Sharp.' : res.total >= 250 ? 'Solid day.' : 'Tough tape.') + '</h2>' +
      '<div class="zg-big">' + res.total + ' <span style="font-size:1rem;color:var(--muted)">/ 500</span></div>' +
      '<div class="zg-grid">' + res.grid + '</div>' +
      '<p class="zg-fine">Streak: ' + streak.n + ' day' + (streak.n === 1 ? '' : 's') + '. Next challenge at midnight ET.</p>' +
      (res.results ? '<p class="zg-fine">Today\\'s charts: ' + res.results.map(function(r){ return r.sym + ' (' + ZC.monthYear(r.date) + ')'; }).join(', ') + '</p>' : '') +
      '<div class="zg-actions"><button class="zg-btn zg-btn-primary" id="dcShare" type="button">Share my grid</button><a class="zg-btn zg-back" href="chart-replay.html">Play Chart Replay</a>' +
      '<a class="zg-btn zg-back" href="../arcade.html">&larr; Back to Arcade</a></div></div>';
    document.getElementById('dcShare').addEventListener('click', function(){ var b=this;
      ZC.share('Zelos Daily Challenge ' + day + '\\n' + res.grid + '  ' + res.total + '/500' + (streak.n > 1 ? '  🔥' + streak.n : ''), 'https://agentictrading.info/games/daily-challenge.html')
        .then(function(){ b.textContent = 'Copied ✓'; }); });
    zgLeaderboard(host.querySelector('.zg-end'), GAME, res.total, 'today');
  }
  var done = ZC.store(KEY);
  if (done) {
    document.getElementById('zgScore').textContent = done.total;
    return endScreen(done);
  }
  ZC.load().then(function(data){
    zgRunDrill({ data: data, rand: ZC.rng('zelos-daily-' + day), rounds: ['grade','stop','grade','stop','grade'], normalize: true,
      onFinish: function(res){
        var y = ZC.etDateStr(new Date(Date.now() - 86400000));
        streak = { n: streak.last === y ? streak.n + 1 : (streak.last === day ? streak.n : 1), last: day };
        ZC.store('zdc-streak', streak);
        document.getElementById('zgStreak').textContent = streak.n;
        var saved = { total: res.total, grid: res.grid, results: res.results.map(function(r){ return { sym: r.sym, date: r.date }; }) };
        ZC.store(KEY, saved);
        endScreen(res);
      } });
  }).catch(function(){ document.getElementById('zgRound').innerHTML = '<p class="zg-prompt">Couldn\\'t load chart data. Refresh to try again.</p>'; });
})();'''
    desc = 'A free daily trading puzzle: five real historical stock charts, the same for everyone. Grade three setups, place two stops, share your score grid.'
    render('games/daily-challenge.html', 'Zelos Daily Challenge: A Daily Trading Chart Puzzle', desc, body, HEAD,
           '<script src="zelos-chart-engine.js"></script>\n<script>\n' + js + '\n</script>\n',
           jsonld=[game_ld('Zelos Daily Challenge', 'games/daily-challenge.html', desc),
                   breadcrumbs([('Zelos', ''), ('Arcade', 'arcade.html'), ('Daily Challenge', None)])])

    # ---------------- Chart Replay (flagship)
    body = f'''<main class="zg-shell" id="zgTop">
  <div class="zg-top">
    <div><span class="zg-kicker">Flagship · trading simulator</span><h1>Chart Replay</h1>
    <p>A hidden ticker, a real daily chart, 60 bars you haven't seen yet. Wait for your setup, then trade it with a $10,000 practice
    account. Every trade needs a stop. You're scored on R-multiples and discipline, not luck.</p></div>
    <div class="zg-stats">
      <div class="zg-stat"><small>Equity</small><b id="zrEq">$10,000</b></div>
      <div class="zg-stat"><small>Return</small><b id="zrRet">+0.00%</b></div>
      <div class="zg-stat"><small>Total R</small><b id="zrR">+0.0R</b></div>
      <div class="zg-stat"><small>Bar</small><b id="zrBar">1 / 60</b></div>
    </div>
  </div>
  <section class="zg-panel">
    <div class="zg-chart-wrap" style="height:clamp(300px, 52vh, 480px)"><canvas class="zg-chart zg-pickable" id="zrChart" aria-label="Price chart"></canvas></div>
    <div id="zrPlay">
      <div class="zr-bar">
        <button class="zg-btn zg-btn-primary" id="zrWait" type="button" title="Stay flat and reveal the next few bars">Wait &#9656;</button>
        <button class="zg-btn" id="zrAuto" type="button">Auto-play</button>
        <span class="grow"></span>
        <button class="zg-btn zg-btn-buy" id="zrLong" type="button">Go long</button>
        <button class="zg-btn zg-btn-sell" id="zrShort" type="button">Go short</button>
        <button class="zg-btn" id="zrSetTarget" type="button" hidden>Set target</button>
        <button class="zg-btn" id="zrClose" type="button">Close</button>
      </div>
      <div class="zr-bar">
        <label class="zr-risk">Risk per trade <select id="zrRisk"><option value="0.5">0.5%</option><option value="1" selected>1%</option><option value="2">2%</option><option value="full">Full Port (all-in)</option></select></label>
        <span class="grow"></span>
        <button class="zg-btn zg-btn-primary" id="zrConfirm" type="button" hidden>Place order</button>
        <button class="zg-btn" id="zrCancel" type="button" hidden>Cancel</button>
        <button class="zg-btn zg-btn-sm" id="zrNew" type="button">New chart</button>
      </div>
      <div class="zr-risk-warn" id="zrRiskWarn" role="note" hidden><b>&#9888; Full Port:</b> every trade puts your <b>entire account</b> into the position,
      so a loss at your stop is no longer a fixed 0.5&ndash;2%; it can be many times that. Real traders almost never do this. Full Port plays on
      <b>Auto-play</b> with <b>no hints</b>. Each Full Port trade costs <b>25 discipline points</b>, each <b>Wait</b> costs 10, and discipline
      multiplies your score.</div>
      <div class="zr-tip" id="zrTip" hidden></div>
      <p class="zr-hint" id="zrHint">Loading a real chart…</p>
      <div class="zr-log" id="zrLog"></div>
    </div>
    <div class="zg-end" id="zrEnd" hidden></div>
  </section>
  {CTA}
  <section class="zg-howto">
    <h2>How Chart Replay works</h2>
    <p>You see 100 days of history. <b>Wait</b> (or the → key) reveals the next few trading days one at a time, and stops early
    when something happens: a fill, an exit, or a setup worth a look. You never have to enter: waiting for confirmation is a
    real decision. To enter, choose <b>Go long</b> or <b>Go short</b>, tap your stop on the chart, then tap a target or skip it.
    The red box is what you risk and the green box is your reward; drag either handle to adjust them, before or after the fill.
    Moving a target farther when the chart supports a bigger move is fine; widening a stop costs discipline.</p>
    <p>Orders fill at the next day's open, and position size is calculated so that hitting your stop costs exactly your chosen risk
    (0.5%, 1% or 2% of the account). <b>Full Port</b> instead puts the whole account into the trade: the screen glows green or red
    with your account, there are no hints, you play it on Auto-play, and every Wait costs 10 discipline points on top of the 25 each
    Full Port trade costs.</p>
    <p>Stops and targets fill at their price during the day, or at the open if price gaps through them. If a day touches both,
    the stop is assumed to fill first. That's the conservative assumption real backtests use.</p>
    <h2>Scoring</h2>
    <p>Score = (1,000 + 200 × total R) × discipline%. An R is one unit of the risk you planned, so +3R means you made three times
    what you risked. Discipline drops when you move a stop further away, plan trades under 1.5:1 reward:risk, go Full Port, or overtrade.
    You'll also see how you did against simply buying and holding the same 60 days.</p>
    <p>Keyboard: → or Space wait · L long · S short · Esc cancel. Background reading:
    <a href="../learn/what-is-reward-to-risk-ratio.html">reward-to-risk</a>,
    <a href="../learn/how-to-use-stop-losses-in-swing-trading.html">stop-losses</a>.</p>
  </section>
  {NOTE}
</main>'''
    desc = 'Free stock trading simulator: replay a hidden real chart bar by bar with a $10,000 practice account. Every trade needs a stop; scored on R-multiples and discipline.'
    render('games/chart-replay.html', 'Chart Replay: Free Stock Trading Simulator on Real Charts | Zelos', desc, body, HEAD,
           '<script src="zelos-chart-engine.js"></script>\n<script>\n' + src('drill-common.js') + '\n' + src('chart-replay.js') + '\n</script>\n',
           jsonld=[game_ld('Zelos Chart Replay', 'games/chart-replay.html', desc),
                   breadcrumbs([('Zelos', ''), ('Arcade', 'arcade.html'), ('Chart Replay', None)])])
    print('built games')


if __name__ == '__main__':
    main()
