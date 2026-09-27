/*!
 * Zelos dashboard: trading hub widgets (dashboard.html).
 *
 *   Practice Account P&L  #hubPractice    balance, today, total, open P&L, top positions
 *   Watchlist news        #hubWatchNews   headlines for watched + held tickers
 *   Trending news         #hubTrending    general market headlines
 *
 * Practice numbers come from the account summary the practice page saves
 * (localStorage zelosPractice-v1, or users/{uid}.practice when signed in,
 * whichever is newer), re-priced live from markets/quotes.
 *
 * News comes from markets/news, written every 10 minutes by the refresh_news
 * Cloud Function. Items are provider-neutral ({headline, source, url,
 * datetime, summary, image, tickers}) and the doc names its own attribution,
 * so swapping news providers is a server-side change only.
 *
 * The main dashboard script fires `zelos:userdoc` with the signed-in user's
 * doc (or null when signed out); that's where the watchlist comes from.
 */
(function () {
  'use strict';
  var START = 10000, PKEY = 'zelosPractice-v1';
  var quotes = {}, news = null, userDoc = null, newsFilter = 'all';

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(v) { return (v < 0 ? '-$' : '$') + Math.abs(+v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function signed(v) { return (v >= 0 ? '+' : '-') + money(Math.abs(v)); }
  function cls(v) { return v >= 0 ? 'hub-up' : 'hub-dn'; }
  function todayNY() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function ago(sec) {
    var s = Math.max(0, Date.now() / 1000 - sec);
    return s < 3600 ? Math.max(1, Math.round(s / 60)) + 'm ago' : s < 86400 ? Math.round(s / 3600) + 'h ago' : Math.round(s / 86400) + 'd ago';
  }

  // ---------------------------------------------------------------- practice
  function localAcct() { try { return JSON.parse(localStorage.getItem(PKEY) || 'null'); } catch (e) { return null; } }
  function account() {
    var a = localAcct(), r = userDoc && userDoc.practice;
    if (r && (!a || (r.updatedAt || 0) > (a.updatedAt || 0))) a = r;
    return a;
  }
  function renderPractice() {
    var el = $('hubPractice'); if (!el) return;
    var a = account(), s = a && a.summary;
    if (!a) {
      el.innerHTML = '<div class="hub-pnl-main"><span><small>Account value</small><b>$10,000.00</b></span></div>' +
        '<p class="card-sub" style="margin:8px 0 0">Trade real stocks at live prices with $10,000 of virtual money. Your P&amp;L shows up here.</p>' +
        '<div class="hub-foot"><a href="practice/">Open the practice account &rarr;</a></div>';
      return;
    }
    var today = todayNY(), cash = s ? s.cash : (a.cash || START), positions = s ? s.positions || [] : [];
    var optVal = s ? s.optionsValue || 0 : 0, optCost = s ? (s.optionsCost != null ? s.optionsCost : optVal) : 0;
    var stockVal = 0, day = 0, open = optVal - optCost, rows = [], live = false;
    positions.forEach(function (p) {
      var q = quotes[p.sym], px = q && q.c ? q.c : p.avg, pc = q && q.pc ? q.pc : null;
      if (q && q.c) live = true;
      stockVal += p.qty * px;
      open += p.qty * (px - p.avg);
      day += p.qty * (px - (p.openedDay === today || pc == null ? p.avg : pc));
      rows.push({ sym: p.sym, qty: p.qty, pl: p.qty * (px - p.avg), pct: (px / p.avg - 1) * 100 });
    });
    if (s && s.date === today) day += s.realizedToday || 0;
    var eq = cash + stockVal + optVal, tot = eq - START;
    rows.sort(function (x, y) { return Math.abs(y.pl) - Math.abs(x.pl); });
    el.innerHTML = '<div class="hub-pnl-main"><span><small>Account value</small><b>' + money(eq) + '</b></span>' +
      '<span class="' + cls(tot) + '" style="font:700 0.9rem var(--mono)">' + signed(tot) + ' (' + (tot >= 0 ? '+' : '') + (tot / START * 100).toFixed(2) + '%)</span></div>' +
      '<div class="hub-pnl-grid"><span><small>Today</small><b class="' + cls(day) + '">' + signed(day) + '</b></span>' +
      '<span><small>Open P&amp;L</small><b class="' + cls(open) + '">' + signed(open) + '</b></span>' +
      '<span><small>Cash</small><b>' + money(cash) + '</b></span></div>' +
      (rows.length ? rows.slice(0, 4).map(function (r) {
        return '<div class="hub-pos"><span><b>' + esc(r.sym) + '</b> <small>' + r.qty + ' sh</small></span><span class="' + cls(r.pl) + '">' + signed(r.pl) + ' <small>(' + (r.pct >= 0 ? '+' : '') + r.pct.toFixed(1) + '%)</small></span></div>';
      }).join('') + (rows.length > 4 ? '<div class="hub-pos"><small>+' + (rows.length - 4) + ' more</small></div>' : '') : '<div class="empty">No open positions.</div>') +
      '<div class="hub-foot"><span>' + (live ? 'Live prices' : 'Last close') + (optVal ? ' · options as of your last visit' : '') + ' · virtual money</span><a href="practice/">Trade &rarr;</a></div>';
  }

  // ---------------------------------------------------------------- news
  function item(n, showTk) {
    var tk = (n.tickers || []).slice(0, 3);
    return '<a href="' + esc(n.url) + '" target="_blank" rel="noopener nofollow">' +
      (n.image ? '<img src="' + esc(n.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : '') +
      '<span class="hub-news-body"><span class="hub-h">' + esc(n.headline) + '</span><span class="hub-meta">' +
      (showTk ? tk.map(function (t) { return '<span class="hub-tk">' + esc(t) + '</span>'; }).join('') : '') +
      '<span>' + esc(n.source) + '</span><span>' + (n.datetime ? ago(n.datetime) : '') + '</span></span></span></a>';
  }
  function attribution() {
    if (!news) return '';
    return '<div class="hub-foot"><span>' + (news.attributionUrl ? '<a href="' + esc(news.attributionUrl) + '" target="_blank" rel="noopener">' + esc(news.attribution || 'News') + '</a>' : esc(news.attribution || '')) +
      ' · headlines link to the publisher</span></div>';
  }
  function renderTrending() {
    var el = $('hubTrending'); if (!el) return;
    if (!news) { el.innerHTML = '<div class="empty">Market headlines load here once the news feed is running.</div>'; return; }
    var g = news.general || [];
    el.innerHTML = g.length ? '<div class="hub-news hub-scroll">' + g.slice(0, 15).map(function (n) { return item(n, true); }).join('') + '</div>' + attribution()
      : '<div class="empty">No headlines right now.</div>';
  }
  function watchedTickers() {
    var t = [];
    ((userDoc && userDoc.watchlist) || []).forEach(function (x) { x = String(x).toUpperCase(); if (t.indexOf(x) === -1) t.push(x); });
    var a = account(), s = a && a.summary;
    ((s && s.positions) || []).forEach(function (p) { if (t.indexOf(p.sym) === -1) t.push(p.sym); });
    ((a && a.options) || []).forEach(function (o) { if (t.indexOf(o.sym) === -1) t.push(o.sym); });
    return t;
  }
  function renderWatchNews() {
    var el = $('hubWatchNews'); if (!el) return;
    var tks = watchedTickers();
    if (!tks.length) { el.innerHTML = '<div class="empty">Add tickers to your watchlist (or hold a stock in the practice account) to see their headlines here.</div>'; return; }
    if (!news) { el.innerHTML = '<div class="empty">Headlines load here once the news feed is running.</div>'; return; }
    if (newsFilter !== 'all' && tks.indexOf(newsFilter) === -1) newsFilter = 'all';
    var by = news.bySymbol || {}, seen = {}, list = [], covered = [];
    tks.forEach(function (t) {
      if (by[t]) covered.push(t);
      (by[t] || []).forEach(function (n) { if (!seen[n.url]) { seen[n.url] = 1; list.push(Object.assign({}, n, { tickers: [t].concat((n.tickers || []).filter(function (x) { return x !== t; })) })); } });
    });
    // general headlines that name a watched ticker count too (covers tickers outside the practice list)
    (news.general || []).forEach(function (n) {
      var hit = (n.tickers || []).filter(function (x) { return tks.indexOf(x) !== -1; });
      if (hit.length && !seen[n.url]) { seen[n.url] = 1; list.push(n); }
    });
    var shown = list.filter(function (n) { return newsFilter === 'all' || (n.tickers || []).indexOf(newsFilter) !== -1; })
      .sort(function (x, y) { return (y.datetime || 0) - (x.datetime || 0); }).slice(0, 20);
    var missing = tks.filter(function (t) { return covered.indexOf(t) === -1; });
    el.innerHTML = '<div class="hub-filter"><button type="button" data-f="all" class="' + (newsFilter === 'all' ? 'is-on' : '') + '">All</button>' +
      tks.map(function (t) { return '<button type="button" data-f="' + esc(t) + '" class="' + (newsFilter === t ? 'is-on' : '') + '">' + esc(t) + '</button>'; }).join('') + '</div>' +
      (shown.length ? '<div class="hub-news hub-scroll">' + shown.map(function (n) { return item(n, true); }).join('') + '</div>'
        : '<div class="empty">No recent headlines for ' + (newsFilter === 'all' ? 'these tickers' : esc(newsFilter)) + '.</div>') +
      (missing.length ? '<p class="card-sub" style="margin:8px 0 0">Company news covers the practice-account stock list; ' + esc(missing.join(', ')) + ' only show up when a market headline names them.</p>' : '') +
      attribution();
  }

  // ---------------------------------------------------------------- wiring
  function renderAll() { renderPractice(); renderWatchNews(); renderTrending(); }
  document.addEventListener('zelos:userdoc', function (e) { userDoc = e.detail || null; renderPractice(); renderWatchNews(); });
  document.addEventListener('DOMContentLoaded', function () {
    renderAll();
    var w = $('hubWatchNews');
    if (w) w.addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (b) { newsFilter = b.getAttribute('data-f'); renderWatchNews(); } });
    window.addEventListener('storage', function (e) { if (e.key === PKEY) renderAll(); });
    var cfg = window.ZELOS_FIREBASE_CONFIG;
    if (!window.firebase || !cfg || !cfg.projectId) return;
    try {
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      var db = firebase.firestore();
      db.collection('markets').doc('quotes').onSnapshot(function (snap) { quotes = (snap.exists && snap.data().quotes) || {}; renderPractice(); }, function () {});
      db.collection('markets').doc('news').onSnapshot(function (snap) { news = snap.exists ? snap.data() : null; renderWatchNews(); renderTrending(); }, function () {});
    } catch (e) { /* widgets keep their offline text */ }
  });
})();
