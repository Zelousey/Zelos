/*
 * zelos-demo.js — the homepage's interactive demo (owner 2026-11-15).
 *
 * Click the computer or the phone in the homepage hero and a simulated Zelos opens: an account
 * that's actively trading, with its chart, P&L, positions, market movers and sectors moving every
 * second. Everything in it is simulated in this page (a seeded random walk), labelled "Live demo ·
 * simulated" at the top, and nothing is saved or sent anywhere. It's not a real account and can't
 * trade. Dashboard and Market can be explored; the other sections are shown locked and point to
 * Open Practice.
 *
 * Markup it attaches to: [data-demo="desktop"] and [data-demo="phone"] (clickable), and an
 * optional [data-demo-hint] that's hidden once someone has opened the demo.
 */
(function () {
  'use strict';
  var d = document, w = window;
  var triggers = d.querySelectorAll('[data-demo]');
  if (!triggers.length) return;
  var HINT_KEY = 'zelosDemoSeen';
  var APP = 'app/';
  var still = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------------ the simulated market
  var seed = 11;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  var SYMS = [
    ['NVDA', 'NVIDIA', 186.4], ['AAPL', 'Apple', 231.8], ['MSFT', 'Microsoft', 512.3], ['AMZN', 'Amazon', 221.5], ['META', 'Meta', 702.1],
    ['AMD', 'AMD', 164.9], ['TSLA', 'Tesla', 402.7], ['PLTR', 'Palantir', 172.2], ['JPM', 'JPMorgan', 294.6], ['UBER', 'Uber', 96.3],
    ['SOFI', 'SoFi', 27.4], ['HOOD', 'Robinhood', 128.9], ['XOM', 'Exxon Mobil', 114.2], ['UNH', 'UnitedHealth', 331.5], ['MU', 'Micron', 189.7],
  ];
  var mkt = {};
  SYMS.forEach(function (s) {
    var open = s[2] * (1 + (rnd() - 0.5) * 0.02);
    mkt[s[0]] = { sym: s[0], name: s[1], open: open, px: s[2], drift: (rnd() - 0.42) * 0.0012 };
  });
  var SPY = { open: 668.2, px: 669.0, hist: [] };
  var SECTORS = ['Technology', 'Communication Services', 'Consumer Cyclical', 'Financial Services', 'Healthcare', 'Energy', 'Industrials', 'Utilities', 'Real Estate', 'Basic Materials', 'Consumer Defensive']
    .map(function (n) { return { name: n, pct: (rnd() - 0.45) * 2.4 }; });
  // the account: $10,000 start, a few winning positions and one loser, cash for the rest
  var acct = { start: 10000, cash: 4210.35, pos: [['NVDA', 12, 171.2], ['AAPL', 6, 224.1], ['AMD', 10, 158.4], ['TSLA', 3, 419.9], ['PLTR', 8, 151.6]] };
  var acctHist = [];

  function equity() { return acct.cash + acct.pos.reduce(function (t, p) { return t + p[1] * mkt[p[0]].px; }, 0); }
  function dayStart() { return acct.cash + acct.pos.reduce(function (t, p) { return t + p[1] * mkt[p[0]].open; }, 0); }
  function step() {
    Object.keys(mkt).forEach(function (k) {
      var m = mkt[k];
      // a little lively: occasional bigger moves; a slight upward lean overall
      var shock = rnd() < 0.04 ? (rnd() - 0.45) * 0.012 : 0;
      m.px = Math.max(1, m.px * (1 + m.drift + 0.00018 + (rnd() - 0.5) * 0.0042 + shock));
      if (rnd() < 0.01) m.drift = (rnd() - 0.42) * 0.0012;
    });
    SPY.px = SPY.px * (1 + 0.00008 + (rnd() - 0.5) * 0.0016);
    SPY.hist.push(SPY.px);
    if (SPY.hist.length > 160) SPY.hist.shift();
    SECTORS.forEach(function (s) { s.pct = Math.max(-4, Math.min(4, s.pct + (rnd() - 0.48) * 0.08)); });
    acctHist.push(equity());
    if (acctHist.length > 160) acctHist.shift();
  }
  // a morning's worth of history so the charts aren't empty when the demo opens
  for (var i = 0; i < 120; i++) step();

  // ------------------------------------------------------------------ formatting
  function money(v) { return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function signed(v) { return (v >= 0 ? '+' : '−') + money(Math.abs(v)); }
  function pct(v) { return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) + '%'; }
  function chg(m) { return (m.px / m.open - 1) * 100; }
  function cls(v) { return v >= 0 ? 'up' : 'down'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function spark(vals, wd, ht, fill) {
    if (vals.length < 2) return '';
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), sp = hi - lo || 1;
    var pts = vals.map(function (v, i) { return ((i / (vals.length - 1)) * wd).toFixed(1) + ',' + (4 + (1 - (v - lo) / sp) * (ht - 8)).toFixed(1); });
    var up = vals[vals.length - 1] >= vals[0];
    var c = up ? 'var(--zd-up)' : 'var(--zd-down)';
    return '<svg viewBox="0 0 ' + wd + ' ' + ht + '" preserveAspectRatio="none" aria-hidden="true">' +
      (fill ? '<path d="M' + pts.join('L') + 'L' + wd + ',' + ht + 'L0,' + ht + 'Z" fill="' + c + '" opacity="0.12"/>' : '') +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + c + '" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' +
      '<circle cx="' + wd + '" cy="' + pts[pts.length - 1].split(',')[1] + '" r="3.5" fill="' + c + '"/></svg>';
  }

  // ------------------------------------------------------------------ the demo window
  var NAV = [['dash', 'Dashboard', true], ['market', 'Market', true], ['war', 'Trade War'], ['battles', 'Battles'], ['alerts', 'Alerts'], ['news', 'News'], ['board', 'Leaderboard'], ['learn', 'Trading 101'], ['minds', 'Hall of Minds']];
  var TABS = [['dash', 'Dashboard', true], ['market', 'Market', true], ['war', 'Trade War'], ['alerts', 'Alerts'], ['news', 'News']];
  var ov, body, kind, page = 'dash', timer = null, tick = 0, lastFocus = null;

  function open(k) {
    kind = k;
    page = 'dash';
    lastFocus = d.activeElement;
    try { localStorage.setItem(HINT_KEY, '1'); } catch (e) {}
    d.querySelectorAll('[data-demo-hint]').forEach(function (h) { h.hidden = true; });
    ov = d.createElement('div');
    ov.className = 'zd-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Zelos interactive demo');
    ov.innerHTML =
      '<div class="zd-shell zd-' + k + '">' +
      '<div class="zd-top"><span class="zd-live"><i></i>Live demo · simulated account and prices</span>' +
      '<a class="zd-cta" href="' + APP + '">Open Practice →</a>' +
      '<button type="button" class="zd-close" aria-label="Close the demo">✕</button></div>' +
      '<div class="zd-app">' +
      (k === 'desktop' ? '<nav class="zd-side" aria-label="Demo sections"><div class="zd-brand">Zelos Trade War</div>' + NAV.map(navItem).join('') + '</nav>' : '<div class="zd-phonebar"><b>Zelos</b><span>Demo</span></div>') +
      '<div class="zd-main" tabindex="0"></div>' +
      (k === 'phone' ? '<nav class="zd-tabs" aria-label="Demo sections">' + TABS.map(navItem).join('') + '</nav>' : '') +
      '</div><div class="zd-toast" role="status" aria-live="polite"></div></div>';
    d.body.appendChild(ov);
    d.documentElement.classList.add('zd-lock');
    body = ov.querySelector('.zd-main');
    ov.addEventListener('click', onClick);
    ov.addEventListener('pointerdown', onPress);
    d.addEventListener('keydown', onKey);
    render();
    ov.querySelector('.zd-close').focus();
    if (!still) timer = w.setInterval(function () { step(); tick++; render(); }, 1000);
  }
  function navItem(n) {
    return '<button type="button" class="zd-nav' + (n[2] ? '' : ' is-locked') + '" data-page="' + n[0] + '"' + (n[2] ? '' : ' aria-disabled="true"') + '>' + esc(n[1]) + (n[2] ? '' : '<span class="zd-lock" aria-hidden="true">🔒</span>') + '</button>';
  }
  function close() {
    if (!ov) return;
    w.clearInterval(timer);
    d.removeEventListener('keydown', onKey);
    ov.remove();
    ov = null;
    d.documentElement.classList.remove('zd-lock');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab' && ov) {
      // keep the keyboard inside the demo
      var f = ov.querySelectorAll('a, button, [tabindex="0"]');
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  var toastTimer = null;
  function toast(msg) {
    var t = ov.querySelector('.zd-toast');
    t.textContent = msg;
    t.classList.add('is-on');
    w.clearTimeout(toastTimer);
    toastTimer = w.setTimeout(function () { t.classList.remove('is-on'); }, 2600);
  }
  function onClick(e) {
    if (e.target === ov || e.target.closest('.zd-close')) return close();
    var nav = e.target.closest('[data-page]');
    if (nav) {
      if (nav.classList.contains('is-locked')) return toast(nav.textContent.replace('🔒', '').trim() + ' is in the real app. Open Practice to try it.');
      page = nav.getAttribute('data-page');
      body.scrollTop = 0;
      render();
    }
  }
  // the page redraws every second, so buttons inside it react on press, not on a full click
  function onPress(e) {
    if (e.target.closest('[data-locked]')) toast('This demo can’t trade. Open Practice to place real practice trades.');
  }

  // ------------------------------------------------------------------ pages
  function render() {
    ov.querySelectorAll('[data-page]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-page') === page); });
    body.innerHTML = page === 'market' ? market() : dash();
  }
  function movers() {
    var list = Object.keys(mkt).map(function (k) { return mkt[k]; }).sort(function (a, b) { return chg(b) - chg(a); });
    return { up: list.slice(0, 5), down: list.slice(-5).reverse() };
  }
  function ticker(title, m, tone, n) {
    return '<div class="zd-card zd-tick zd-' + tone + '"><small>' + title + '</small><div><b>' + m.sym + '</b> <span>' + esc(m.name) + '</span></div><em class="' + cls(chg(m)) + '">' + pct(chg(m)) + '</em><i class="zd-dots">' + Array.from({ length: 5 }, function (_, j) { return '<i' + (j === n % 5 ? ' class="on"' : '') + '></i>'; }).join('') + '</i></div>';
  }
  function dash() {
    var eq = equity(), today = eq - dayStart(), total = eq - acct.start;
    var mv = movers(), n = Math.floor(tick / 4);
    var contrib = acct.pos.map(function (p) { var m = mkt[p[0]]; return { sym: p[0], pnl: (m.px - p[2]) * p[1], pct: (m.px / p[2] - 1) * 100 }; }).sort(function (a, b) { return b.pnl - a.pnl; });
    var upC = contrib.filter(function (c) { return c.pnl > 0; }), dnC = contrib.filter(function (c) { return c.pnl < 0; });
    var big = contrib.map(function (c) { return { sym: c.sym, ch: chg(mkt[c.sym]) }; }).filter(function (c) { return Math.abs(c.ch) > 0.6; });
    var news = big.length ? big[n % big.length].sym + ' is ' + pct(big[n % big.length].ch) + ' today' : 'Quiet day on your stocks';
    var up = upC[n % Math.max(1, upC.length)], dn = dnC[n % Math.max(1, dnC.length)];
    return (
      '<div class="zd-grid zd-dash">' +
      '<div class="zd-tiles">' +
      tile('Today', signed(today), cls(today)) + tile('Total P&L', signed(total), cls(total)) + tile('Buying power', money(acct.cash), '') +
      '</div>' +
      '<div class="zd-movers">' + ticker('Market · gainers', mv.up[n % 5], 'green', n) + ticker('Market · losers', mv.down[n % 5], 'red', n) + '</div>' +
      '<div class="zd-card zd-chart"><div class="zd-value"><b>' + money(eq) + '</b> <span class="' + cls(total) + '">' + signed(total) + ' (' + pct((total / acct.start) * 100) + ')</span></div>' +
      '<div class="zd-plot">' + spark(acctHist, 600, 200, true) + '</div><div class="zd-ranges"><span class="on">1D</span><span>1W</span><span>1M</span><span>3M</span></div></div>' +
      '<div class="zd-side-col">' +
      '<div class="zd-card"><h4>Battle · Your battles</h4><div class="zd-row"><span>⚔ Friday Showdown</span><b>#2 of 6</b></div><div class="zd-row"><span>⚔ Head-to-head</span><b>Live</b></div></div>' +
      '<div class="zd-card zd-etf"><h4>SPY <span class="' + cls(SPY.px - SPY.open) + '">' + pct((SPY.px / SPY.open - 1) * 100) + '</span></h4>' + spark(SPY.hist, 300, 90, true) + '</div>' +
      '</div>' +
      '<div class="zd-why">' +
      '<div class="zd-card zd-tick zd-green"><small>Pushing you up</small>' + (up ? '<div><b>' + up.sym + '</b></div><em class="up">' + signed(up.pnl) + '</em>' : '<span>Nothing yet</span>') + '</div>' +
      '<div class="zd-card zd-tick zd-red"><small>Pulling you down</small>' + (dn ? '<div><b>' + dn.sym + '</b></div><em class="down">' + signed(dn.pnl) + '</em>' : '<span>Nothing is down</span>') + '</div>' +
      '<div class="zd-card zd-tick zd-blue"><small>News on your stocks</small><div><b>' + esc(news) + '</b></div></div>' +
      '</div>' +
      '<div class="zd-card zd-pos"><h4>Solo · Positions</h4><table><thead><tr><th>Symbol</th><th>Shares</th><th>Avg cost</th><th>Last</th><th>P&L</th><th></th></tr></thead><tbody>' +
      acct.pos.map(function (p) { var m = mkt[p[0]], pl = (m.px - p[2]) * p[1]; return '<tr><td><b>' + p[0] + '</b></td><td>' + p[1] + '</td><td>' + p[2].toFixed(2) + '</td><td>' + m.px.toFixed(2) + '</td><td class="' + cls(pl) + '">' + signed(pl) + '</td><td><button type="button" class="zd-sell" data-locked>Close</button></td></tr>'; }).join('') +
      '</tbody></table></div>' +
      '<div class="zd-card zd-missions"><h4>Daily missions</h4><div class="zd-row"><span>✓ Make 1 Trade War trade</span><b>+10 XP</b></div><div class="zd-row"><span>✓ Analyze 3 stocks</span><b>+10 XP</b></div><div class="zd-row"><span>○ Check the market news</span><b>+5 XP</b></div></div>' +
      '</div>'
    );
  }
  function tile(k, v, c) { return '<div class="zd-card zd-tile"><small>' + k + '</small><b class="' + c + '">' + v + '</b></div>'; }
  function market() {
    var mv = movers();
    function list(title, arr) { return '<div class="zd-card"><h4>' + title + '</h4>' + arr.map(function (m) { return '<div class="zd-row"><span><b>' + m.sym + '</b> ' + esc(m.name) + '</span><b class="' + cls(chg(m)) + '">' + pct(chg(m)) + '</b></div>'; }).join('') + '</div>'; }
    var heat = SECTORS.slice().sort(function (a, b) { return b.pct - a.pct; });
    return (
      '<div class="zd-grid zd-market">' +
      '<div class="zd-card zd-chart"><div class="zd-value"><b>SPY ' + SPY.px.toFixed(2) + '</b> <span class="' + cls(SPY.px - SPY.open) + '">' + pct((SPY.px / SPY.open - 1) * 100) + '</span> <small>S&P 500</small></div><div class="zd-plot">' + spark(SPY.hist, 600, 220, true) + '</div>' +
      '<div class="zd-ranges"><span class="on">Chart</span><span>Globe</span><span>Sectors</span></div></div>' +
      list('Gainers', mv.up) + list('Losers', mv.down) +
      '<div class="zd-card zd-heat"><h4>Sectors today</h4><div class="zd-heat-grid">' +
      heat.map(function (s) { var a = Math.min(1, Math.abs(s.pct) / 3); return '<div class="zd-heat-tile ' + cls(s.pct) + '" style="--a:' + (6 + a * 30).toFixed(0) + '%"><span>' + esc(s.name) + '</span><b>' + pct(s.pct) + '</b></div>'; }).join('') +
      '</div></div>' +
      '<div class="zd-card zd-trade"><h4>NVDA · ' + mkt.NVDA.px.toFixed(2) + '</h4><div class="zd-buysell"><button type="button" class="zd-buy" data-locked>Buy</button><button type="button" class="zd-sell" data-locked>Sell</button></div></div>' +
      '</div>'
    );
  }

  // ------------------------------------------------------------------ wiring
  triggers.forEach(function (t) {
    t.setAttribute('role', 'button');
    t.setAttribute('tabindex', '0');
    t.addEventListener('click', function (e) { e.preventDefault(); open(t.getAttribute('data-demo')); });
    t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(t.getAttribute('data-demo')); } });
  });
  var seen = false;
  try { seen = localStorage.getItem(HINT_KEY) === '1'; } catch (e) {}
  if (!seen) d.querySelectorAll('[data-demo-hint]').forEach(function (h) { h.hidden = false; });
})();
