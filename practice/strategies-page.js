/*!
 * Three-Leg Strategies page (practice/strategies.html, Mockup 18).
 * Scans the Trade War stock list for each strategy (strategies.js), shows the best
 * setups, and lays out the chosen one like a broker app: legs, cost, max profit and
 * loss, breakevens, payoff chart and why. "Open this trade" hands it to your Main
 * account (index.html?strategy=...), which asks before placing it.
 */
(function () {
  'use strict';
  var d = document, Z = window.ZelosStrategies, TC = window.ZelosTradeChart;
  var state = { tab: (location.hash || '').slice(1) || 'bull-fly', sel: null, adj: {}, results: {}, hist: null, universe: [], quotes: {}, extra: {}, at: null };
  if (!Z.byId(state.tab)) state.tab = 'bull-fly';
  function $(id) { return d.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(v, dp) { var n = Math.abs(v); return (v < 0 ? '−' : '') + '$' + n.toLocaleString('en-US', { minimumFractionDigits: dp == null ? 2 : dp, maximumFractionDigits: dp == null ? 2 : dp }); }
  function today() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  // same history as the trading page: the static file, then the server's newer daily bars, then the live quote
  function merged() {
    var h = {}; Object.keys(state.hist || {}).forEach(function (k) {
      var rows = state.hist[k] || [], last = rows.length ? rows[rows.length - 1][0] : '';
      h[k] = rows.concat((state.extra[k] || []).filter(function (r) { return r[0] > last; }));
    });
    return h;
  }
  function lists() {
    var h = merged();
    return state.universe.map(function (u) { var q = state.quotes[u.sym], ser = TC.dailySeries(u.sym, h, q); return { sym: u.sym, name: u.name, series: ser, S: q && q.c ? q.c : ser.n ? ser.c[ser.n - 1] : null }; }).filter(function (x) { return x.series && x.series.n >= 60; });
  }
  function scanAll() { var L = lists(), t = today(); Z.STRATS.forEach(function (s) { state.results[s.id] = Z.scan(s.id, L, t, 6); }); state.at = new Date(); state.n = L.length; }
  function current() {
    var res = state.results[state.tab] || [], pick = res.filter(function (r) { return r.sym === state.sel; })[0] || res[0];
    if (!pick) return null;
    if (state.adj.center || state.adj.width) {
      var it = lists().filter(function (x) { return x.sym === pick.sym; })[0], again = it && Z.evaluate(Z.byId(state.tab), it, today(), state.adj);
      if (again) { again.score = pick.score; return again; }
    }
    return pick;
  }
  function payoffSvg(r) {
    var legs = r.plan.legs, ks = legs.map(function (l) { return l.strike; }), lo = Math.min.apply(null, ks), hi = Math.max.apply(null, ks), span = Math.max(hi - lo, r.ctx.S * 0.04);
    var a = Math.max(0.01, Math.min(lo, r.ctx.S) - span * 0.8), b = Math.max(hi, r.ctx.S) + span * 0.8, W = 760, H = 190, N = 160, pts = [], vmin = Infinity, vmax = -Infinity;
    for (var i = 0; i <= N; i++) { var x = a + (b - a) * i / N, v = Z.payoffAt(r.plan, r.priced.net, x); pts.push([x, v]); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v); }
    var pad = (vmax - vmin) * 0.12 || 10; vmin -= pad; vmax += pad;
    var X = function (x) { return (x - a) / (b - a) * W; }, Y = function (v) { return 12 + (vmax - v) / (vmax - vmin) * (H - 40); }, y0 = Y(0);
    var line = pts.map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ');
    var fill = 'M' + X(a).toFixed(1) + ',' + y0.toFixed(1) + ' L' + pts.map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(Math.max(0, p[1])).toFixed(1); }).join(' L') + ' L' + X(b).toFixed(1) + ',' + y0.toFixed(1) + ' Z';
    var nx = X(r.ctx.S);
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="Profit or loss at expiration by ' + esc(r.sym) + ' price">' +
      '<line x1="0" x2="' + W + '" y1="' + y0.toFixed(1) + '" y2="' + y0.toFixed(1) + '" stroke="var(--muted-2,#5c6068)"/><text x="4" y="' + (y0 - 5).toFixed(1) + '" fill="var(--muted,#9599a3)" font-size="11" font-family="var(--mono,monospace)">$0</text>' +
      '<path d="' + fill + '" fill="rgba(62,203,124,.15)"/><polyline fill="none" stroke="#3ecb7c" stroke-width="2.4" stroke-linejoin="round" points="' + line + '"/>' +
      ks.filter(function (k, i) { return ks.indexOf(k) === i; }).map(function (k) { return '<text x="' + (X(k) - 10).toFixed(1) + '" y="' + (H - 14) + '" fill="var(--muted,#9599a3)" font-size="10" font-family="var(--mono,monospace)">' + k + '</text>'; }).join('') +
      '<line x1="' + nx.toFixed(1) + '" x2="' + nx.toFixed(1) + '" y1="0" y2="' + (H - 22) + '" stroke="#4a86ff" stroke-dasharray="4 4"/><text x="' + Math.min(W - 150, nx + 5).toFixed(1) + '" y="' + (H - 2) + '" fill="#7fa8ff" font-size="11" font-family="var(--mono,monospace)">' + esc(r.sym) + ' now ' + money(r.ctx.S) + '</text>' +
      '<text x="' + Math.min(W - 70, X(r.stats.best) + 4).toFixed(1) + '" y="12" fill="#3ecb7c" font-size="11" font-family="var(--mono,monospace)">+' + money(r.stats.maxProfit, 0) + '</text></svg>';
  }
  function openLink(r) {
    var p = { sym: r.sym, kind: r.plan.kind, exp: r.plan.exp, s: Math.round(r.ctx.S * 100) / 100, legs: r.plan.legs.map(function (l) { return [l.type, l.strike, l.qty]; }) };
    return 'index.html?strategy=' + encodeURIComponent(JSON.stringify(p));
  }
  function render() {
    var strat = Z.byId(state.tab), res = state.results[state.tab] || [], r = current();
    $('stTabs').innerHTML = Z.STRATS.map(function (s) { return '<button type="button" data-tab="' + s.id + '"' + (s.id === state.tab ? ' class="is-on" aria-pressed="true"' : ' aria-pressed="false"') + '>' + esc(s.label) + '</button>'; }).join('') + '<span class="st-soon">+ more soon</span>';
    $('stWhen').textContent = state.at ? 'Scanned ' + state.at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' · ' + state.n + ' stocks' : 'Scanning…';
    $('stList').innerHTML = '<h4>TOP SETUPS · ' + esc(strat.label.toUpperCase()) + '</h4>' + (res.length ? res.map(function (x) {
      return '<button type="button" class="st-ri' + (r && x.sym === r.sym ? ' is-on' : '') + '" data-sym="' + esc(x.sym) + '"><b>' + esc(x.sym) + '</b><span class="st-sc' + (x.score < 60 ? ' is-mid' : '') + '">Score ' + x.score + '</span><small>' + money(x.ctx.S) + ' · ' + esc(x.name || '') + ' · IV ' + Math.round(x.ctx.sigma * 100) + '%</small></button>';
    }).join('') : '<p class="st-empty">' + (state.at ? 'No ' + esc(strat.label) + ' setups right now. Check back after the next scan.' : 'Scanning the stock list…') + '</p>') +
      '<p class="st-note">' + esc(strat.desc) + '</p>';
    if (!r) { $('stDetail').innerHTML = '<p class="st-empty">Pick a setup on the left.</p>'; return; }
    var st = r.stats, debit = r.priced.net >= 0;
    $('stDetail').innerHTML = '<div class="st-dt"><h3>' + esc(r.sym) + ' ' + esc(strat.label) + '</h3><span class="st-pill' + (debit ? '' : ' is-credit') + '">' + (debit ? 'Debit ' : 'Credit ') + money(Math.abs(st.cost), 0) + '</span><span class="st-exp">' + esc(r.plan.exp) + ' · ' + r.ctx.dte + ' days</span></div>' +
      '<div class="st-legs">' + r.priced.legs.map(function (l) {
        return '<div class="st-lg"><span class="st-bs ' + (l.qty > 0 ? 'is-b' : 'is-s') + '">' + (l.qty > 0 ? 'BUY ' : 'SELL ') + Math.abs(l.qty) + '</span><b>' + l.strike + '</b><span>' + esc(r.sym) + ' ' + esc(r.plan.exp) + ' $' + l.strike + ' ' + (l.type === 'call' ? 'Call' : 'Put') + '</span><span class="st-m">$' + l.px.toFixed(2) + '</span><span class="st-m ' + (l.qty > 0 ? 'dn' : 'up') + '">' + (l.qty > 0 ? '−' : '+') + money(Math.abs(l.qty * l.px * 100), 0).replace('−', '') + '</span></div>';
      }).join('') + '</div>' +
      '<div class="st-stats"><div><small>' + (debit ? 'Cost (max loss)' : 'You collect') + '</small><b class="' + (debit ? 'dn' : 'up') + '">' + money(Math.abs(st.cost), 0) + '</b></div><div><small>Max profit</small><b class="up">' + money(st.maxProfit, 0) + '</b></div>' +
        '<div><small>' + (debit ? 'Best price' : 'Max loss') + '</small><b' + (debit ? '' : ' class="dn"') + '>' + (debit ? money(st.best) : money(st.maxLoss, 0)) + '</b></div><div><small>Breakeven' + (st.breakevens.length === 1 ? '' : 's') + '</small><b>' + st.breakevens.map(function (x) { return money(x); }).join(' · ') + '</b></div>' +
        '<div><small>Reward : risk</small><b>' + (st.maxLoss > 0 ? (st.maxProfit / st.maxLoss).toFixed(st.maxProfit / st.maxLoss < 0.1 ? 2 : 1) + ' : 1' : '–') + '</b></div></div>' +
      '<div class="st-pay">' + payoffSvg(r) + '</div>' +
      '<p class="st-why"><b>Why ' + esc(r.sym) + ':</b> ' + esc(r.why) + (st.upsideRisk ? '' : '') + '</p>' +
      '<div class="st-adj" id="stAdj"' + (state.showAdj ? '' : ' hidden') + '><span>Strikes</span><button type="button" data-adj="center:-1" aria-label="Move strikes down">&#9664;</button><button type="button" data-adj="center:1" aria-label="Move strikes up">&#9654;</button><span>Width</span><button type="button" data-adj="width:-1" aria-label="Narrower">&minus;</button><button type="button" data-adj="width:1" aria-label="Wider">+</button><button type="button" data-adj="reset">Reset</button></div>' +
      '<div class="st-go"><a class="cta buy" href="' + esc(openLink(r)) + '">Open this trade (Trade War, simulated)</a><button type="button" class="cta sell" id="stAdjBtn">Adjust strikes</button></div>' +
      '<p class="st-fine">Prices come from the same options model as Trade War\'s simulated options (Black-Scholes on each stock\'s recent volatility), at the bid and ask. Virtual money only. Not investment advice.</p>';
  }
  d.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab]'); if (t) { state.tab = t.getAttribute('data-tab'); state.sel = null; state.adj = {}; history.replaceState(null, '', '#' + state.tab); render(); return; }
    var s = e.target.closest('[data-sym]'); if (s && s.closest('#stList')) { state.sel = s.getAttribute('data-sym'); state.adj = {}; render(); return; }
    if (e.target.id === 'stAdjBtn') { state.showAdj = !state.showAdj; render(); return; }
    var a = e.target.closest('[data-adj]'); if (a) {
      var v = a.getAttribute('data-adj'); if (v === 'reset') state.adj = {}; else { var k = v.split(':'); state.adj[k[0]] = (state.adj[k[0]] || 0) + +k[1]; }
      var r = current(); if (!r) state.adj = {}; state.sel = state.sel || (r && r.sym); render();
    }
  });
  function boot() {
    render();
    Promise.all([fetch('../data/practice-universe.json').then(function (r) { return r.json(); }), TC.loadHistory('../')]).then(function (res) {
      state.universe = res[0].symbols || []; state.hist = res[1]; scanAll(); render();
    }).catch(function () { $('stDetail').innerHTML = '<p class="st-empty">Couldn\'t load market data. Refresh to try again.</p>'; });
    var cfg = window.ZELOS_FIREBASE_CONFIG;
    if (window.firebase && cfg && cfg.projectId) {
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      var last = 0;
      firebase.firestore().collection('markets').doc('dailyBars').onSnapshot(function (x) {
        var b = (x.exists && x.data().bars) || {}; state.extra = {};
        Object.keys(b).forEach(function (k) { state.extra[k] = (b[k] || []).map(function (r) { var p = String(r).split(','); return [p[0], +p[1], +p[2], +p[3], +p[4], +p[5] || 0]; }); });
        if (state.hist) { scanAll(); render(); }
      }, function () {});
      firebase.firestore().collection('markets').doc('quotes').onSnapshot(function (x) {
        state.quotes = (x.exists && x.data().quotes) || {};
        if (state.hist && Date.now() - last > 30 * 60000) { last = Date.now(); scanAll(); render(); } // rescan at most every 30 minutes
      }, function () {});
    }
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})();
