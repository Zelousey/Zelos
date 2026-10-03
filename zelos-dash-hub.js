/*!
 * Zelos dashboard: trading hub widgets (dashboard.html).
 *
 *   Practice Account P&L  #hubPractice    balance, today, total, open P&L, top positions
 *   Watchlist news        #hubWatchNews   headlines for watched + held tickers
 *   Trending news         #hubTrending    general market headlines
 *   Market movers         #hubMovers      top gainers / losers / most active (markets/movers) and crypto (markets/crypto)
 *   Trader card           #hubTrader      XP, level, streak, leaderboard + friends rank
 *   Daily missions        #hubMissions    today's missions, weekly progress, streak (zelos-progress.js)
 *   Trade Wars            #hubChallenges  your Trade War matches (live, lobby, finished), squads
 *   Achievements          #hubAchievements unlocked badges
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
  var quotes = {}, news = null, userDoc = null, newsFilter = 'all', movers = null, crypto = null, mvTab = 'gainers';

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // name in the trader's purchased color (zelos-tokens.js paints [data-zname])
  function zn(uid) { return uid ? ' data-zname="' + esc(uid) + '"' : ''; }
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
        '<div class="hub-foot"><a href="practice/">Enter Trade War &rarr;</a></div>';
      return;
    }
    var today = todayNY(), cash = s ? s.cash : (a.cash || START), positions = s ? s.positions || [] : [];
    var optVal = s ? s.optionsValue || 0 : 0, optCost = s ? (s.optionsCost != null ? s.optionsCost : optVal) : 0;
    var stockVal = 0, day = 0, open = optVal - optCost, rows = [], live = false;
    positions.forEach(function (p) {
      var q = quotes[p.sym] || (crypto && crypto.quotes && crypto.quotes[p.sym]), px = q && q.c ? q.c : p.avg, pc = q && q.pc ? q.pc : null;
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
      bestHtml(a) +
      '<div class="hub-btns"><a href="practice/?tab=progress">Share my account</a><a href="practice/#start">⚔️ Start a Trade War</a></div>' +
      '<div class="hub-foot"><span>' + (live ? 'Live prices' : 'Last close') + (optVal ? ' · options as of your last visit' : '') + ' · <b>TRADE WAR — VIRTUAL</b></span><a href="practice/">Trade &rarr;</a></div>';
  }
  // biggest closed virtual winners
  function bestHtml(a) {
    var w = ((a && a.trades) || []).filter(function (t) { return t.pnl > 0; }).sort(function (x, y) { return y.pnl - x.pnl; }).slice(0, 3);
    if (!w.length) return '';
    return '<div class="hub-sub">Biggest winners</div>' + w.map(function (t) {
      return '<div class="hub-pos"><span><b>' + esc(t.label || t.sym) + '</b> <small>' + esc(t.closeDay || '') + '</small></span><span class="hub-up">' + signed(t.pnl) + ' <small>(+' + (+t.pct || 0).toFixed(1) + '%)</small></span></div>';
    }).join('');
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
  function renderMovers() {
    var el = $('hubMovers'); if (!el) return;
    document.querySelectorAll('#hubMoversTabs [data-mv]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-mv') === mvTab); });
    var ORDER = ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'DOGEUSD', 'ADAUSD', 'AVAXUSD', 'LTCUSD'], rk = function (k) { var i = ORDER.indexOf(k); return i < 0 ? 99 : i; };
    var rows = mvTab === 'crypto' ? Object.keys((crypto && crypto.quotes) || {}).sort(function (x, y) { return rk(x) - rk(y); }).map(function (k) { var q = crypto.quotes[k]; return { sym: k.replace(/USD$/, ''), name: q.name, price: q.c, chPct: q.chPct != null ? q.chPct : (q.pc ? (q.c / q.pc - 1) * 100 : 0) }; })
      : ((movers && movers[mvTab]) || []);
    if (!rows.length) { el.innerHTML = '<div class="empty">' + (!movers ? 'Movers load during market hours.' : mvTab === 'gainers' ? 'No stocks on the list are up today.' : mvTab === 'losers' ? 'No stocks on the list are down today.' : 'No trading yet today.') + '</div>'; return; }
    el.innerHTML = '<ul class="hub-mv">' + rows.slice(0, 7).map(function (r) {
      var px = +r.price || 0, ch = +r.chPct || 0;
      return '<li><span><b>' + esc(r.sym) + '</b><small>' + esc(r.name || '') + '</small></span><em class="' + cls(ch) + '">$' + px.toLocaleString('en-US', { minimumFractionDigits: px < 2 ? 4 : 2, maximumFractionDigits: px < 2 ? 4 : 2 }) + '<br>' + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%</em></li>';
    }).join('') + '</ul><div class="hub-foot"><span>' + (mvTab === 'crypto' ? '<a href="practice/index.html">Trade crypto 24/7 in Trade War &rarr;</a>' : 'Among Zelos stocks · prices by Marketstack') + '</span></div>';
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
    if (!tks.length) { el.innerHTML = '<div class="empty">Add tickers to your watchlist (or hold a stock in Trade War or the Real Trade Journal) to see their headlines here.</div>'; return; }
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
      (missing.length ? '<p class="card-sub" style="margin:8px 0 0">Company news covers the Trade War stock list; ' + esc(missing.join(', ')) + ' only show up when a market headline names them.</p>' : '') +
      attribution();
  }

  // ---------------------------------------------------------------- progression + social
  var P = window.ZelosProgress, S = window.ZelosSocial, L = window.ZelosLevels, ranks = null, challenges = null, squads = null, attached = null, top = null, friendList = null, realTrades = null, realUnsub = null;
  // ---- Trade War leaderboard widget: global top 5 + friends
  function renderBoards() {
    var el = $('hubBoards'); if (!el) return;
    var u = realUser();
    if (!top) { if (!u) loadTop(); el.innerHTML = '<div class="empty">Loading…</div>'; return; }
    var row = function (r, i) {
      var me = u && r.uid === u.uid, g = +r.growthPct || 0;
      return '<a class="hub-ch' + (me ? ' inc' : '') + '" href="practice/profile.html?u=' + encodeURIComponent(r.uid) + '"><span>' + (i + 1) + '. <span' + zn(r.uid) + '>' + esc(r.name || 'Trader') + '</span></span><small>' + money(r.equity).replace('.00', '') + ' · <span class="' + cls(g) + '">' + (g >= 0 ? '+' : '') + g.toFixed(1) + '%</span></small></a>';
    };
    el.innerHTML = '<div class="hub-sub">Global</div>' + (top.length ? top.map(row).join('') : '<p class="card-sub" style="margin:0">No Trade War accounts yet.</p>') +
      (friendList && friendList.length > 1 ? '<div class="hub-sub">Friends</div>' + friendList.slice(0, 5).map(row).join('') : '') +
      '<div class="hub-foot"><span>' + (ranks && ranks.global ? 'You\'re #' + ranks.global + ' overall' : u ? 'Trade to get ranked' : 'Sign in to get ranked') + ' · virtual accounts only</span></div>';
  }
  function loadTop() {
    if (top || !window.firebase || !firebase.apps.length) return;
    firebase.firestore().collection('practiceProfiles').orderBy('equity', 'desc').limit(5).get().then(function (snap) { top = []; snap.forEach(function (d) { top.push(Object.assign({ uid: d.id }, d.data())); }); renderBoards(); }).catch(function () { top = []; renderBoards(); });
  }
  // ---- Real trades widget (REAL mode): the signed-in user's Real Trade Journal
  function renderReal() {
    var el = $('hubReal'); if (!el) return;
    var u = realUser();
    if (!u) { el.innerHTML = '<p class="card-sub" style="margin:0">Log the trades you make at your broker and track them here with live prices. Private to your account; never mixed with Trade War.</p><div class="hub-btns"><a href="real/">Open the Real Trade Journal</a></div>'; return; }
    if (!realTrades) { el.innerHTML = '<div class="empty">Loading…</div>'; return; }
    var open = realTrades.filter(function (t) { return t.exit == null; }), closed = realTrades.filter(function (t) { return t.exit != null; });
    var un = 0, priced = 0;
    var rows = open.slice(0, 5).map(function (t) {
      var q = quotes[t.sym], m = t.side === 'short' ? -1 : 1, pl = q && q.c ? m * (q.c - t.entry) * t.qty : null;
      if (pl != null) { un += pl; priced++; }
      return '<div class="hub-pos"><span><b>' + esc(t.sym) + '</b> <small>' + (t.side === 'short' ? 'short ' : '') + t.qty + ' @ ' + (+t.entry).toFixed(2) + '</small></span><span class="' + (pl == null ? '' : cls(pl)) + '">' + (pl == null ? '<small>no live price</small>' : signed(pl)) + '</span></div>';
    }).join('');
    var wins = closed.filter(function (t) { var m = t.side === 'short' ? -1 : 1; return m * (t.exit - t.entry) > 0; }).length;
    el.innerHTML = '<div class="hub-pnl-grid" style="margin-top:0"><span><small>Open</small><b>' + open.length + '</b></span><span><small>Open P&amp;L</small><b class="' + cls(un) + '">' + (priced ? signed(un) : '–') + '</b></span>' +
      '<span><small>Win rate</small><b>' + (closed.length ? Math.round(wins / closed.length * 100) + '%' : '–') + '</b></span></div>' +
      (rows || '<div class="empty">No open real trades.</div>') +
      '<div class="hub-btns"><a href="real/">+ Log a real trade</a><a href="live-chart.html">Charts</a></div><div class="hub-foot"><span><b>REAL TRADE</b> · logged by you · private</span></div>';
  }
  function watchReal(u) {
    if (realUnsub) { realUnsub(); realUnsub = null; }
    realTrades = null;
    if (!u) return renderReal();
    realUnsub = firebase.firestore().collection('users').doc(u.uid).collection('realTrades').orderBy('createdAt', 'desc').limit(100).onSnapshot(function (snap) {
      realTrades = []; snap.forEach(function (d) { realTrades.push(d.data()); }); renderReal();
    }, function () { realTrades = []; renderReal(); });
  }
  // ---- dashboard mode: Real Trading / Trade War
  function syncMode() {
    var D = window.ZelosDashLayout, m = D && D.getMode ? D.getMode() : null;
    document.querySelectorAll('.dash-mode [data-mode]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-mode') === m)); });
    var ch = $('dashChooser'); if (ch) ch.hidden = !!m;
  }
  function realUser() { var u = window.firebase && firebase.apps.length && firebase.auth().currentUser; return u && !u.isAnonymous ? u : null; }
  function renderTrader() {
    var el = $('hubTrader'); if (!el) return;
    var u = realUser(), xp = userDoc ? userDoc.xp || 0 : null, sk = P ? P.streak() : 0;
    if (xp == null) {
      el.innerHTML = '<p class="card-sub" style="margin:0">Earn XP for trades, wins, missions and achievements, climb levels and the leaderboards.</p>' +
        (sk ? '<p class="hub-streak" style="margin:8px 0 0">🔥 ' + sk + '-day mission streak</p>' : '') + '<div class="hub-btns"><a href="practice/">Enter Trade War</a></div>';
      return;
    }
    var lv = L ? L.levelForXp(xp) : null, nx = L ? L.nextLevelForXp(xp) : null, pctLv = lv && nx ? (xp - lv.xp) / (nx.xp - lv.xp) * 100 : 100;
    el.innerHTML = '<div class="hub-trader">' + (L && lv ? (L.framed ? L.framed(lv, 54) : L.badge(lv, 48)) : '') + '<span><small>Level ' + (lv ? lv.level : 0) + ' · ' + esc(lv ? lv.title : '') + '</small><b>' + esc(lv ? lv.name : '') + '</b></span></div>' +
      '<div class="hub-xpbar"><i style="width:' + Math.max(0, Math.min(100, pctLv)).toFixed(1) + '%"></i></div><small style="font:0.72rem var(--mono);color:var(--muted)">' + xp.toLocaleString('en-US') + ' XP' + (nx ? ' · ' + (nx.xp - xp) + ' to ' + esc(nx.name) : '') + '</small>' +
      '<div class="hub-pnl-grid" style="margin-bottom:0"><span><small>Streak</small><b>' + (sk ? '🔥 ' + sk : '0') + '</b></span>' +
      '<span><small>Leaderboard</small><b>' + (ranks && ranks.global ? '#' + ranks.global : ranks && ranks.globalOut ? '100+' : '–') + '</b></span>' +
      '<span><small>Friends</small><b>' + (ranks && ranks.friends ? '#' + ranks.friends + '/' + ranks.friendsOf : '–') + '</b></span></div>' +
      '<div class="hub-btns">' + (u ? '<a href="practice/profile.html?u=' + encodeURIComponent(u.uid) + '">My profile</a>' : '') + '<a href="leaderboard.html#practice">Leaderboards</a></div>';
  }
  function loadRanks(u) {
    if (!S || !S.init() || !u) return;
    var db = firebase.firestore();
    Promise.all([
      db.collection('practiceProfiles').orderBy('equity', 'desc').limit(100).get().then(function (snap) { var i = 0, at = 0; top = []; snap.forEach(function (d) { i++; if (d.id === u.uid) at = i; if (i <= 5) top.push(Object.assign({ uid: d.id }, d.data())); }); return { at: at, n: i }; }).catch(function (e) { console.warn('[hub] rank query failed', e && e.message); return null; }),
      Promise.all([S.friends(), S.mySquads(u.uid)]).then(function (r) { squads = r[1]; var ids = [u.uid].concat(r[0]); r[1].forEach(function (q) { ids = ids.concat(q.members); }); return S.profiles(ids); }).catch(function (e) { console.warn('[hub] friends rank failed', e && e.message); return {}; })
    ]).then(function (r) {
      var g = r[0], m = r[1] || {}, list = Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return (b.growthPct || 0) - (a.growthPct || 0); });
      var fi = list.map(function (p) { return p.uid; }).indexOf(u.uid);
      ranks = { global: g && g.at ? g.at : null, globalOut: g && !g.at && g.n >= 100, friends: fi >= 0 && list.length > 1 ? fi + 1 : null, friendsOf: list.length };
      friendList = list;
      renderTrader(); renderChallenges(); renderBoards();
    });
  }
  function renderMissions() {
    var el = $('hubMissions'); if (!el || !P) return;
    var m = P.missions(), wk = m.weekly.filter(function (x) { return x.done; }).length;
    $('hubStreak').textContent = m.streak.days ? '🔥 ' + m.streak.days + ' day' + (m.streak.days === 1 ? '' : 's') : '';
    el.innerHTML = '<ul class="hub-ms">' + m.daily.map(function (x) {
      return '<li class="' + (x.done ? 'done' : '') + '"><span class="ck">' + (x.done ? '&#10003;' : '') + '</span>' + (x.href ? '<a href="' + esc(x.href) + '">' + esc(x.label) + '</a>' : '<a>' + esc(x.label) + '</a>') +
        '<small>' + x.count + '/' + x.goal + '</small><em>+' + x.xp + '</em></li>';
    }).join('') + '</ul><div class="hub-foot"><span>' + m.streak.doneToday + ' done · ' + m.streak.need + ' keep your streak · weekly ' + wk + '/' + m.weekly.length + '</span><a href="practice/?tab=progress">Weekly &rarr;</a></div>';
  }
  // Trade Wars you're in (equal-buy-in matches, functions/main.py tw_*) + waiting invites
  function renderChallenges() {
    var el = $('hubChallenges'); if (!el) return;
    var u = realUser();
    if (!u) { el.innerHTML = '<p class="card-sub" style="margin:0">Challenge a friend to a Trade War: everyone starts with the same virtual buy-in, best % gain wins.</p><div class="hub-btns"><a href="practice/#start">Start a Trade War</a><a href="practice/squads.html">Squads</a></div>'; return; }
    if (!challenges) { el.innerHTML = '<div class="empty">Loading…</div>'; return; }
    var order = { active: 0, lobby: 1, ended: 2 };
    var list = challenges.filter(function (w) { return w.status in order; }).sort(function (a, b) { return (order[a.status] - order[b.status]) || ((b.createdAt || 0) - (a.createdAt || 0)); }).slice(0, 4);
    var h = list.map(function (w) {
      var me = (w.results || []).filter(function (r) { return r.uid === u.uid; })[0];
      var right = w.status === 'active' ? 'LIVE · ' + Math.max(0, Math.ceil((w.endAt - Date.now()) / 36e5)) + 'h left' : w.status === 'lobby' ? 'lobby · ' + w.players.length + '/' + w.maxPlayers : me ? '#' + me.rank + ' of ' + w.results.length : 'finished';
      return '<a class="hub-ch" href="practice/war.html?w=' + encodeURIComponent(w.id) + '"><span>⚔️ ' + esc(w.name) + '</span><small>' + right + '</small></a>';
    }).join('');
    el.innerHTML = (h || '<p class="card-sub" style="margin:0">No Trade Wars yet.</p>') +
      '<div class="hub-btns"><a href="practice/#start">+ Start a Trade War</a><a href="practice/squads.html">' + (squads && squads.length ? '👥 ' + squads.length + ' squad' + (squads.length === 1 ? '' : 's') : 'Squads') + '</a></div>';
  }
  function renderAchievements() {
    var el = $('hubAchievements'); if (!el || !P) return;
    var un = P.unlocked(), ids = Object.keys(un).sort(function (a, b) { return un[b] - un[a]; }), all = P.ACHIEVEMENTS.length;
    var next = P.ACHIEVEMENTS.filter(function (a) { return !un[a.id]; }).slice(0, 3);
    el.innerHTML = '<p class="card-sub" style="margin:0 0 8px">' + ids.length + ' of ' + all + ' unlocked</p>' +
      (ids.length ? '<div class="hub-achs">' + ids.slice(0, 12).map(function (id) { return P.badge(id, 34); }).join('') + '</div>' : '') +
      (next.length ? '<div class="hub-foot" style="display:block"><span>Next up: ' + next.map(function (a) { return esc(a.label) + ' (' + esc(a.desc) + ')'; }).join(' · ') + '</span></div>' : '');
  }
  function renderSocial() { renderTrader(); renderMissions(); renderChallenges(); renderAchievements(); renderBoards(); renderReal(); }
  function onUser(u) {
    if (!u) { attached = null; if (P) P.detach(); challenges = null; ranks = null; friendList = null; watchReal(null); renderSocial(); return; }
    if (attached === u.uid) return;
    attached = u.uid;
    watchReal(u);
    if (P) P.attach(firebase.firestore(), u.uid);
    if (S && S.init()) {
      firebase.firestore().collection('tradeWars').where('players', 'array-contains', u.uid).limit(20).get().then(function (snap) {
        challenges = []; snap.forEach(function (d) { challenges.push(Object.assign({ id: d.id }, d.data())); }); renderChallenges();
      }).catch(function () { challenges = []; renderChallenges(); });
      S.myReferrals(u.uid);
      loadRanks(u);
    }
  }

  // ---------------------------------------------------------------- wiring
  function renderAll() { renderPractice(); renderWatchNews(); renderTrending(); renderSocial(); }
  document.addEventListener('zelos:userdoc', function (e) { userDoc = e.detail || null; renderPractice(); renderWatchNews(); renderTrader(); onUser(userDoc ? realUser() : null); });
  document.addEventListener('zelos:progress', function () { renderMissions(); renderAchievements(); renderTrader(); });
  document.addEventListener('zelos:dashmode', syncMode);
  document.addEventListener('DOMContentLoaded', function () {
    renderAll(); syncMode();
    document.addEventListener('click', function (e) {
      var b = e.target.closest('.dash-mode [data-mode], [data-pick]'); if (!b || !window.ZelosDashLayout) return;
      ZelosDashLayout.setMode(b.getAttribute('data-mode') || b.getAttribute('data-pick')); syncMode();
    });
    var w = $('hubWatchNews');
    if (w) w.addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (b) { newsFilter = b.getAttribute('data-f'); renderWatchNews(); } });
    // opening a headline completes the "Check the market news" mission
    document.addEventListener('click', function (e) { if (e.target.closest('.hub-news a') && P) P.track('news'); });
    window.addEventListener('storage', function (e) { if (e.key === PKEY) renderAll(); });
    var cfg = window.ZELOS_FIREBASE_CONFIG;
    if (!window.firebase || !cfg || !cfg.projectId) return;
    try {
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      var db = firebase.firestore();
      db.collection('markets').doc('quotes').onSnapshot(function (snap) { quotes = (snap.exists && snap.data().quotes) || {}; renderPractice(); renderReal(); }, function () {});
      db.collection('markets').doc('movers').onSnapshot(function (snap) { movers = snap.exists ? snap.data() : null; renderMovers(); }, function () {});
      db.collection('markets').doc('crypto').onSnapshot(function (snap) { crypto = snap.exists ? snap.data() : null; renderMovers(); renderPractice(); }, function () {});
      var mt = $('hubMoversTabs'); if (mt) mt.addEventListener('click', function (e) { var b = e.target.closest('[data-mv]'); if (b) { mvTab = b.getAttribute('data-mv'); renderMovers(); } });
    } catch (e) { /* widgets keep their offline text */ }
  });
})();
