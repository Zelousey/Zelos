/*!
 * Zelos Trade War: the $10,000 virtual account (PRACTICE mode).
 *
 * A persistent simulated brokerage account: real prices, virtual money.
 *
 * Prices: live quotes the refresh_quotes Cloud Function pulls from FMP
 * into Firestore markets/quotes every minute in market hours, on top of daily
 * history (data/game-charts.json + data/practice-extra.json + markets/dailyBars).
 * With no live feed it falls back to the latest close and says so.
 *
 * Stocks: market / limit / stop orders, day or GTC, optional stop-loss +
 * take-profit bracket (one cancels the other), long only, no fees. Orders fill
 * on live ticks while the page is open and are caught up against daily bars
 * when you come back.
 *
 * Options: long calls/puts priced by a model (practice-options.js), traded in
 * market hours, settled at intrinsic value at expiration.
 *
 * Crypto (data/crypto-universe.json): trades 24/7 in fractions of a coin, GTC
 * only, prices from markets/crypto + markets/cryptoBars (refresh_market_data).
 *
 * Persistence: localStorage, plus users/{uid}.practice for signed-in users.
 * Public stats go to practiceProfiles/{uid} (leaderboard + profile page)
 * unless the player turns that off. Resets are only offered below $2,500,
 * are counted, and are kept in a history.
 */
(function () {
  'use strict';
  var START_CASH = 10000, RESET_BELOW = 2500, KEY = 'zelosPractice-v1';
  var MAX_FILLS = 600, MAX_ORDERS = 400, MAX_TRADES = 1000;
  var TC = window.ZelosTradeChart, OPT = window.ZelosOptions, fmt = TC.fmt;
  var NAMES = {}, GROUPS = {}, UNIVERSE = [], CRYPTO = {};
  function isCrypto(sym) { return !!CRYPTO[sym]; }
  // crypto never closes; stocks follow the New York session
  function symOpen(sym) { return isCrypto(sym) || marketOpen(); }
  function pfmt(v) { return v == null || isNaN(v) ? '–' : Math.abs(v) < 2 && v !== 0 ? Number(v).toFixed(4) : fmt(v); }
  function qtyStr(q) { return Math.abs(q - Math.round(q)) < 1e-9 ? String(Math.round(q)) : String(+(+q).toFixed(6)); }
  var $ = function (id) { return document.getElementById(id); };
  function money(n, d) { if (n == null || isNaN(n)) return '–'; var s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d }); return (n < 0 ? '-$' : '$') + s; }
  function signed(n, d) { return (n >= 0 ? '+' : '') + money(n, d); }
  function pct(n) { return (n >= 0 ? '+' : '') + (isFinite(n) ? n.toFixed(2) : '0.00') + '%'; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ------------------------------------------------------------ market clock (New York)
  function nyParts(d) {
    var f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false });
    var o = {}; f.formatToParts(d || new Date()).forEach(function (p) { o[p.type] = p.value; });
    return { date: o.year + '-' + o.month + '-' + o.day, min: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10), wd: o.weekday };
  }
  function isWeekend(wd) { return wd === 'Sat' || wd === 'Sun'; }
  function marketOpen() { var p = nyParts(); return !isWeekend(p.wd) && p.min >= 570 && p.min < 960; }
  function addDays(ds, n) { var d = new Date(ds + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function nextSession(ds) { var d = addDays(ds, 1); while ([0, 6].indexOf(new Date(d + 'T12:00:00Z').getUTCDay()) !== -1) d = addDays(d, 1); return d; }
  function todayNY() { return nyParts().date; }
  function activeSession() { var p = nyParts(); if (!isWeekend(p.wd) && p.min < 960) return p.date; return nextSession(p.date); }

  // ------------------------------------------------------------ data
  var hist = {}, extra = {}, cbars = {}, quotes = {}, cquotes = {}, feed = { state: 'loading' }, series = {}, intraday = {}, intradayUnsub = null, intradaySym = null;
  function buildSeries(sym) {
    var rows = hist[sym] || cbars[sym] || []; var last = rows.length ? rows[rows.length - 1][0] : '';
    var more = (extra[sym] || []).filter(function (r) { return r[0] > last; });
    var all = rows.concat(more);
    var q = quotes[sym] || cquotes[sym], live = false;
    if (q && q.c) {
      var qd = q.date || (q.t ? nyParts(new Date(q.t * 1000)).date : null);
      var lastD = all.length ? all[all.length - 1][0] : '';
      if (qd && qd > lastD && q.o) { all = all.concat([[qd, q.o, Math.max(q.h, q.c), Math.min(q.l, q.c), q.c, 0]]); live = true; }
      else if (qd && qd === lastD) { var r = all[all.length - 1].slice(); r[4] = q.c; r[2] = Math.max(r[2], q.c); r[3] = Math.min(r[3], q.c); all = all.slice(0, -1).concat([r]); live = true; }
    }
    var s = { sym: sym, d: [], o: [], h: [], l: [], c: [], v: [], live: live };
    all.forEach(function (r) { s.d.push(r[0]); s.o.push(+r[1]); s.h.push(+r[2]); s.l.push(+r[3]); s.c.push(+r[4]); s.v.push(+r[5] || 0); });
    s.n = s.d.length;
    series[sym] = TC.computeIndicators(s);
    return s;
  }
  function price(sym) { var s = series[sym]; return s && s.n ? s.c[s.n - 1] : null; }
  function prevClose(sym) {
    var s = series[sym]; if (!s || s.n < 2) return null;
    var q = quotes[sym] || cquotes[sym]; if (q && q.pc && s.live) return q.pc;
    return s.c[s.n - 2];
  }
  function isLiveTick(sym) {
    if (isCrypto(sym)) { var c = cquotes[sym]; return !!(c && c.t && Date.now() / 1000 - c.t < 900); }
    return feed.state === 'live' && quotes[sym] && marketOpen();
  }
  function vol(sym) { var s = series[sym]; return s ? OPT.histVol(s.c, 20) : 0.4; }

  // ------------------------------------------------------------ timeframes
  var TF = {
    '5m': { label: '5 minutes', short: '5m', intraday: 5, ranges: [['1D', 78], ['2D', 156], ['5D', 390]], def: 78 },
    '15m': { label: '15 minutes', short: '15m', intraday: 15, ranges: [['1D', 26], ['2D', 52], ['5D', 130]], def: 52 },
    '1h': { label: '1 hour', short: '1H', intraday: 60, ranges: [['1D', 7], ['5D', 35]], def: 35 },
    'D': { label: 'Daily', short: 'D', ranges: [['1M', 21], ['3M', 63], ['6M', 126], ['1Y', 252], ['All', 'all']], def: 126 },
    'W': { label: 'Weekly', short: 'W', ranges: [['6M', 26], ['1Y', 52], ['All', 'all']], def: 52 }
  };
  var tf = 'D', rangeSel = null;
  function fromRows(rows, key, extraProps) {
    var s = { sym: sel, key: key, d: [], o: [], h: [], l: [], c: [], v: [] };
    rows.forEach(function (r) { s.d.push(r[0]); s.o.push(r[1]); s.h.push(r[2]); s.l.push(r[3]); s.c.push(r[4]); s.v.push(r[5] || 0); });
    s.n = s.d.length;
    Object.keys(extraProps || {}).forEach(function (k) { s[k] = extraProps[k]; });
    return TC.computeIndicators(s);
  }
  function weekKey(ds) { var d = new Date(ds + 'T12:00:00Z'), wd = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - wd); return d.toISOString().slice(0, 10); }
  function displaySeries() {
    var day = series[sel]; if (!day) return null;
    if (tf === 'D') { day.key = sel + ':D'; return day; }
    if (tf === 'W') {
      var rows = [], cur = null;
      for (var i = 0; i < day.n; i++) {
        var k = weekKey(day.d[i]);
        if (!cur || cur[0] !== k) { cur = [k, day.o[i], day.h[i], day.l[i], day.c[i], day.v[i]]; rows.push(cur); }
        else { cur[2] = Math.max(cur[2], day.h[i]); cur[3] = Math.min(cur[3], day.l[i]); cur[4] = day.c[i]; cur[5] += day.v[i]; }
      }
      return fromRows(rows, sel + ':W', { live: day.live });
    }
    var base = intraday[sel] || [], step = TF[tf].intraday, out = [], cb = null;
    base.forEach(function (r) {
      var mins = parseInt(r[0].slice(11, 13), 10) * 60 + parseInt(r[0].slice(14, 16), 10);
      var b = 570 + Math.floor((mins - 570) / step) * step;
      var label = r[0].slice(0, 11) + ('0' + Math.floor(b / 60)).slice(-2) + ':' + ('0' + b % 60).slice(-2);
      if (!cb || cb[0] !== label) { cb = [label, r[1], r[2], r[3], r[4], r[5] || 0]; out.push(cb); }
      else { cb[2] = Math.max(cb[2], r[2]); cb[3] = Math.min(cb[3], r[3]); cb[4] = r[4]; cb[5] += r[5] || 0; }
    });
    return fromRows(out, sel + ':' + tf, { intraday: true, live: isCrypto(sel) ? isLiveTick(sel) : marketOpen() && feed.state === 'live' });
  }
  function watchIntraday() {
    var want = TF[tf].intraday ? sel : null;
    if (want === intradaySym) return;
    if (intradayUnsub) { intradayUnsub(); intradayUnsub = null; }
    intradaySym = want;
    if (!want || !db) return;
    intradayUnsub = db.collection('markets').doc('intraday_' + want).onSnapshot(function (snap) {
      var bars = (snap.exists && snap.data().bars) || [];
      intraday[want] = bars.map(function (b) { var p = String(b).split(','); return [p[0], +p[1], +p[2], +p[3], +p[4], +p[5] || 0]; });
      renderQuote();
    }, function () {});
  }

  // ------------------------------------------------------------ account state
  // Sync: the account stored online (users/{uid}.practice) is the one true balance. This
  // browser keeps a copy for speed and offline use. `synced` stays false until the online
  // copy has been read after sign-in, and nothing is written online before that, so a stale
  // phone can never overwrite the computer. acct.owner = whose copy this is; acct.dirty =
  // changes made here that aren't online yet.
  var synced = false, syncFailed = false, authReady = false; // authReady: Firebase has said whether you're signed in
  var acct = null, currentUser = null, db = null, saveTimer = null, ownedSkills = [], profile = {}; // profile: traders/{uid} (zelos-profile.js)
  function fresh() {
    return { v: 2, cash: START_CASH, positions: {}, options: [], orders: [], fills: [], trades: [], realized: 0, equityDays: {},
      resets: 0, resetHistory: [], epoch: 0, epochStartedAt: Date.now(), peakEquity: START_CASH, publicProfile: true, displayName: '',
      life: null, periods: {}, hist: {}, recovery: null, valueHist: {},
      createdAt: Date.now(), updatedAt: Date.now() };
  }
  // lifetime counters for XP and achievements (survive resets); seeded from history for older accounts
  function seedLife(a) {
    if (a.life) return a;
    var syms = [];
    (a.trades || []).concat(a.fills || []).forEach(function (t) { if (t.sym && syms.indexOf(t.sym) === -1) syms.push(t.sym); });
    a.life = { peak: Math.max(START_CASH, a.peakEquity || 0), fills: (a.fills || []).length, tpExits: (a.fills || []).filter(function (f) { return f.role === 'tp'; }).length,
      comebacks: 0, optionTrades: (a.trades || []).filter(function (t) { return t.kind === 'option'; }).length + (a.options || []).length,
      agentTrades: (a.orders || []).filter(function (o) { return o.agent && o.status === 'filled'; }).length, symbols: syms };
    return a;
  }
  // v1 accounts (before options/resets) keep everything; closed trades are rebuilt from their sell fills
  function migrate(a) {
    if (!a) return fresh();
    if (a.v === 2) { var f = fresh(); Object.keys(f).forEach(function (k) { if (a[k] == null) a[k] = f[k]; }); return a; }
    var b = fresh();
    Object.keys(a).forEach(function (k) { b[k] = a[k]; });
    b.v = 2; b.options = b.options || []; b.resets = b.resets || 0; b.resetHistory = b.resetHistory || []; b.epoch = 0;
    b.trades = (a.fills || []).filter(function (f) { return f.side === 'sell' && f.pnl != null; }).map(function (f) {
      var entry = f.price - f.pnl / f.qty;
      return { kind: 'stock', sym: f.sym, label: f.sym, qty: f.qty, entry: entry, exit: f.price, invested: entry * f.qty, pnl: f.pnl, pct: (f.price / entry - 1) * 100, openDay: null, closeDay: f.day, epoch: 0 };
    });
    return b;
  }
  function load() { try { return seedLife(migrate(JSON.parse(localStorage.getItem(KEY) || 'null'))); } catch (e) { return seedLife(fresh()); } }
  function save() {
    acct.updatedAt = Date.now();
    acct.dirty = true;
    if (acct.fills.length > MAX_FILLS) acct.fills = acct.fills.slice(-MAX_FILLS);
    if (acct.trades.length > MAX_TRADES) acct.trades = acct.trades.slice(-MAX_TRADES);
    if (acct.orders.length > MAX_ORDERS) acct.orders = acct.orders.filter(function (o) { return o.status === 'open'; }).concat(acct.orders.filter(function (o) { return o.status !== 'open'; }).slice(-MAX_ORDERS));
    acct.summary = summary();
    try { localStorage.setItem(KEY, JSON.stringify(acct)); } catch (e) {}
    setTimeout(checkAch, 0);
    if (currentUser && db && synced) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        var copy = JSON.parse(JSON.stringify(acct)), at = acct.updatedAt, uid0 = currentUser && currentUser.uid;
        delete copy.dirty; copy.owner = uid0;
        db.collection('users').doc(uid0).set({ practice: copy }, { merge: true }).then(function () {
          if (acct.updatedAt === at && currentUser && currentUser.uid === uid0) { acct.dirty = false; try { localStorage.setItem(KEY, JSON.stringify(acct)); } catch (e) {} }
        }).catch(function () {});
        publishProfile();
      }, 900);
    }
  }
  // the online copy changed (another device traded): take it unless this device has unsent changes
  function adoptRemote(remote) {
    acct = remote; acct.dirty = false;
    try { localStorage.setItem(KEY, JSON.stringify(acct)); } catch (e) {}
    if (UNIVERSE.length) tick();
  }

  function optionMark(o) { var S = price(o.sym); if (S == null) return o.avg; return OPT.quote(o.type, S, o.strike, o.exp, todayNY(), vol(o.sym)).mid; }
  function stockValue() { var t = 0; Object.keys(acct.positions).forEach(function (s) { t += acct.positions[s].qty * (price(s) || acct.positions[s].avg); }); return t; }
  function optionsValue() { return acct.options.reduce(function (t, o) { return t + o.qty * 100 * optionMark(o); }, 0); }
  function equity() { return acct.cash + stockValue() + optionsValue(); }
  function openPnl() {
    var t = 0;
    Object.keys(acct.positions).forEach(function (s) { var p = acct.positions[s]; t += p.qty * ((price(s) || p.avg) - p.avg); });
    acct.options.forEach(function (o) { t += o.qty * 100 * (optionMark(o) - o.avg); });
    return t;
  }
  function reservedCash() { return acct.orders.reduce(function (t, o) { return o.status === 'open' && o.side === 'buy' ? t + o.qty * (o.limit || o.stop || price(o.sym) || 0) : t; }, 0); }
  function buyingPower() { return Math.max(0, acct.cash - reservedCash()); }
  function reservedShares(sym) { return acct.orders.reduce(function (t, o) { return o.status === 'open' && o.side === 'sell' && o.sym === sym && !o.oco ? t + o.qty : t; }, 0); }
  function dayPnl() {
    var t = 0, today = todayNY();
    Object.keys(acct.positions).forEach(function (s) {
      var p = acct.positions[s], px = price(s), pc = prevClose(s);
      if (px == null) return;
      t += p.qty * (px - (p.openedDay === today || pc == null ? p.avg : pc));
    });
    acct.fills.forEach(function (f) { if (f.side === 'sell' && f.day === today && f.dayBase != null) t += f.qty * (f.price - f.dayBase); });
    return t;
  }
  function summary() {
    var eq = equity();
    return { equity: round2(eq), day: round2(dayPnl()), total: round2(eq - START_CASH), open: round2(openPnl()), cash: round2(acct.cash),
      positions: Object.keys(acct.positions).map(function (s) { return { sym: s, qty: acct.positions[s].qty, avg: acct.positions[s].avg, openedDay: acct.positions[s].openedDay }; }),
      optionsValue: round2(optionsValue()), optionsCost: round2(acct.options.reduce(function (t, o) { return t + o.qty * 100 * o.avg; }, 0)),
      date: todayNY(), realizedToday: round2(acct.fills.reduce(function (t, f) { return f.side === 'sell' && f.day === todayNY() && f.dayBase != null ? t + f.qty * (f.price - f.dayBase) : t; }, 0)),
      resets: acct.resets, updatedAt: Date.now() };
  }
  function round2(x) { return Math.round(x * 100) / 100; }
  function recordTrade(t) { t.epoch = acct.epoch; t.mode = MODE; acct.trades.push(t); }
  // every fill: lifetime counters, XP (first 10 trades and 10 wins a day) and missions
  var PROG = window.ZelosProgress || null;
  // every Trade War record is PRACTICE mode: virtual money, never mixed with REAL (see zelos-modes.js)
  var MODE = 'PRACTICE';
  function modeTag(short) { return window.ZelosModes ? ZelosModes.tag(MODE, short) : '<span class="zm-tag is-war">' + (short ? 'VIRTUAL' : 'TRADE WAR — VIRTUAL') + '</span>'; }
  function onActivity(sym, pnl, extra) {
    var L = acct.life, today = todayNY(); extra = extra || {};
    L.fills = (L.fills || 0) + 1;
    if (L.symbols.indexOf(sym) === -1) L.symbols.push(sym);
    if (extra.option) L.optionTrades = (L.optionTrades || 0) + 1;
    if (extra.agent) L.agentTrades = (L.agentTrades || 0) + 1;
    if (extra.tp) L.tpExits = (L.tpExits || 0) + 1;
    var d = acct.dayFills && acct.dayFills.date === today ? acct.dayFills : (acct.dayFills = { date: today, n: 0, w: 0 });
    d.n += 1;
    if (L.tradeDay !== today) {
      var y = new Date(today + 'T12:00:00Z'); y.setUTCDate(y.getUTCDate() - 1);
      L.tradeStreak = L.tradeDay === y.toISOString().slice(0, 10) ? (L.tradeStreak || 0) + 1 : 1;
      L.tradeDay = today; L.bestTradeStreak = Math.max(L.bestTradeStreak || 0, L.tradeStreak);
    }
    if (window.ZelosXP && d.n <= 10) ZelosXP.award('practice-trade', today + ':' + d.n);
    if (PROG) PROG.track('trade');
    if (pnl != null && pnl > 0.005) {
      d.w += 1;
      if (window.ZelosXP && d.w <= 10) ZelosXP.award('practice-win', today + ':' + d.w);
      if (PROG) PROG.track('win');
    }
  }
  // Net P&L: growth that was actually traded. A reset refills the account to
  // $10,000 but what it wiped out still counts against you, so resets never
  // look like gains on a leaderboard or in a challenge.
  function netPnl() { return equity() - START_CASH + acct.resetHistory.reduce(function (t, r) { return t + (r.equityBefore - START_CASH); }, 0); }
  function tradeStreakNow() {
    var L = acct.life, t = todayNY(), y = new Date(t + 'T12:00:00Z'); y.setUTCDate(y.getUTCDate() - 1);
    return L.tradeDay === t || L.tradeDay === y.toISOString().slice(0, 10) ? (L.tradeStreak || 0) : 0;
  }
  function winStreakBest(list) { var best = 0, cur = 0; list.forEach(function (t) { if (t.pnl > 0) { cur++; best = Math.max(best, cur); } else if (t.pnl < 0) cur = 0; }); return best; }
  var xpNow = null, referralCount = 0;

  // ------------------------------------------------------------ stock orders + fills
  function fill(o, px, when) {
    var sym = o.sym, qty = o.qty, day = when || todayNY();
    if (o.side === 'buy') {
      var cost = qty * px;
      if (cost > acct.cash + 0.005) { o.status = 'rejected'; o.note = 'Not enough cash when it triggered'; return; }
      acct.cash -= cost;
      var p = acct.positions[sym] || { qty: 0, avg: 0, openedDay: day };
      p.avg = (p.avg * p.qty + cost) / (p.qty + qty); p.qty = +(p.qty + qty).toFixed(6);
      acct.positions[sym] = p;
      acct.fills.push({ id: uid(), sym: sym, side: 'buy', qty: qty, price: px, day: day, at: Date.now(), orderId: o.id, type: o.type });
      o.status = 'filled'; o.fillPrice = px; o.filledAt = Date.now(); o.filledDay = day;
      onActivity(sym, null, { agent: !!o.agent });
      if (o.bracket && (o.bracket.sl || o.bracket.tp)) {
        var group = uid();
        if (o.bracket.sl) acct.orders.push(newOrder({ sym: sym, side: 'sell', type: 'stop', qty: qty, stop: o.bracket.sl, tif: 'gtc', oco: group, parent: o.id, role: 'sl', placedOpen: symOpen(sym) }));
        if (o.bracket.tp) acct.orders.push(newOrder({ sym: sym, side: 'sell', type: 'limit', qty: qty, limit: o.bracket.tp, tif: 'gtc', oco: group, parent: o.id, role: 'tp', placedOpen: symOpen(sym) }));
      }
    } else {
      var pos = acct.positions[sym];
      if (!pos || pos.qty <= 0) { o.status = 'cancelled'; o.note = 'No shares left to sell'; return; }
      qty = Math.min(qty, pos.qty);
      var pc = prevClose(sym), pnl = (px - pos.avg) * qty;
      acct.cash += qty * px; acct.realized += pnl;
      recordTrade({ kind: 'stock', sym: sym, label: sym, qty: qty, entry: pos.avg, exit: px, invested: pos.avg * qty, pnl: pnl, pct: (px / pos.avg - 1) * 100, openDay: pos.openedDay, closeDay: day });
      pos.qty = +(pos.qty - qty).toFixed(6);
      acct.fills.push({ id: uid(), sym: sym, side: 'sell', qty: qty, price: px, day: day, at: Date.now(), orderId: o.id, type: o.type, pnl: pnl, role: o.role || null, dayBase: pos.openedDay === day ? pos.avg : pc });
      o.status = 'filled'; o.fillPrice = px; o.filledAt = Date.now(); o.filledDay = day; o.qty = qty;
      if (pos.qty <= 0) delete acct.positions[sym];
      onActivity(sym, pnl, { tp: o.role === 'tp' });
      if (o.role === 'tp' || o.role === 'sl' || o.type === 'stop') alertFill(o, qty, px, pnl);
      acct.orders.forEach(function (x) {
        if (x.status !== 'open' || x.side !== 'sell' || x.sym !== sym) return;
        if ((o.oco && x.oco === o.oco) || !acct.positions[sym]) { x.status = 'cancelled'; x.note = o.oco && x.oco === o.oco ? 'Other side of the bracket filled' : 'Position closed'; }
        else if (x.qty > acct.positions[sym].qty) x.qty = acct.positions[sym].qty;
      });
    }
  }
  function newOrder(f) {
    return {
      id: uid(), sym: f.sym, side: f.side, type: f.type, qty: f.qty, limit: f.limit || null, stop: f.stop || null,
      tif: f.tif || 'day', status: 'open', createdAt: Date.now(), createdDay: todayNY(), placedOpen: f.placedOpen != null ? f.placedOpen : symOpen(f.sym),
      session: isCrypto(f.sym) ? todayNY() : activeSession(), bracket: f.bracket || null, oco: f.oco || null, parent: f.parent || null, role: f.role || null,
      fullPort: !!f.fullPort, agent: f.agent || null
    };
  }
  function triggerOnPrice(o, p) {
    if (o.type === 'market') return p;
    if (o.type === 'limit') return o.side === 'buy' ? (p <= o.limit ? p : null) : (p >= o.limit ? p : null);
    if (o.type === 'stop') return o.side === 'sell' ? (p <= o.stop ? p : null) : (p >= o.stop ? p : null);
    return null;
  }
  function triggerOnBar(o, b) {
    if (o.type === 'market') return b.o;
    if (o.type === 'limit') return o.side === 'buy' ? (b.o <= o.limit ? b.o : b.l <= o.limit ? o.limit : null) : (b.o >= o.limit ? b.o : b.h >= o.limit ? o.limit : null);
    if (o.type === 'stop') return o.side === 'sell' ? (b.o <= o.stop ? b.o : b.l <= o.stop ? o.stop : null) : (b.o >= o.stop ? b.o : b.h >= o.stop ? o.stop : null);
    return null;
  }
  function processOrders() {
    var changed = false, today = todayNY(), p = nyParts(), open = marketOpen();
    acct.orders.forEach(function (o) {
      if (o.status !== 'open') return;
      var s = series[o.sym]; if (!s || !s.n) return;
      var firstDay = isCrypto(o.sym) ? addDays(o.createdDay, 1) : o.placedOpen ? nextSession(o.createdDay) : o.session;
      for (var i = 0; i < s.n && o.status === 'open'; i++) {
        var d = s.d[i];
        if (d < firstDay) continue;
        if (o.tif === 'day' && d > o.session) break;
        if (s.live && i === s.n - 1 && d === today && (open || isCrypto(o.sym))) {
          var px0 = triggerOnBar(o, { o: s.o[i], h: s.h[i], l: s.l[i] });
          if (px0 != null) { fill(o, px0, d); changed = true; }
          break;
        }
        var px = triggerOnBar(o, { o: s.o[i], h: s.h[i], l: s.l[i] });
        if (px != null) { fill(o, px, d); changed = true; }
      }
      if (o.status !== 'open') return;
      if (isLiveTick(o.sym) && o.session <= today) {
        var tp = triggerOnPrice(o, price(o.sym));
        if (tp != null) { fill(o, tp, today); changed = true; return; }
      }
      var sessionOver = today > o.session || (today === o.session && p.min >= 960);
      if (o.tif === 'day' && sessionOver && !isCrypto(o.sym)) { o.status = 'expired'; o.note = 'Day order expired at the close'; changed = true; }
    });
    if (settleExpiredOptions()) changed = true;
    return changed;
  }

  // ------------------------------------------------------------ options
  function buyOption(c, qty) {
    var cost = c.ask * 100 * qty;
    if (cost > buyingPower() + 0.005) return 'Not enough buying power: that costs ' + money(cost) + ', you have ' + money(buyingPower()) + '.';
    acct.cash -= cost;
    var cid = OPT.contractId(c.sym, c.type, c.strike, c.exp), pos = acct.options.filter(function (o) { return o.cid === cid; })[0];
    if (pos) { pos.avg = (pos.avg * pos.qty + c.ask * qty) / (pos.qty + qty); pos.qty += qty; }
    else acct.options.push({ id: uid(), cid: cid, sym: c.sym, type: c.type, strike: c.strike, exp: c.exp, qty: qty, avg: c.ask, openDay: todayNY(), agent: c.agent || null });
    acct.fills.push({ id: uid(), sym: c.sym, side: 'buy', qty: qty, price: c.ask, day: todayNY(), at: Date.now(), option: cid, type: 'option' });
    onActivity(c.sym, null, { option: true, agent: !!c.agent });
    return null;
  }
  function sellOption(pos, qty, bid, why) {
    qty = Math.min(qty, pos.qty);
    var proceeds = bid * 100 * qty, pnl = (bid - pos.avg) * 100 * qty;
    acct.cash += proceeds; acct.realized += pnl;
    recordTrade({ kind: 'option', sym: pos.sym, label: OPT.label(pos), qty: qty, entry: pos.avg, exit: bid, invested: pos.avg * 100 * qty, pnl: pnl, pct: pos.avg ? (bid / pos.avg - 1) * 100 : 0, openDay: pos.openDay, closeDay: todayNY(), note: why || null });
    acct.fills.push({ id: uid(), sym: pos.sym, side: 'sell', qty: qty, price: bid, day: todayNY(), at: Date.now(), option: pos.cid, type: 'option', pnl: pnl });
    onActivity(pos.sym, pnl, {});
    pos.qty -= qty;
    if (pos.qty <= 0) acct.options = acct.options.filter(function (o) { return o !== pos; });
    return pnl;
  }
  // at expiration a long option is worth exactly its intrinsic value
  function settleExpiredOptions() {
    var today = todayNY(), p = nyParts(), changed = false;
    acct.options.slice().forEach(function (o) {
      var done = today > o.exp || (today === o.exp && p.min >= 960);
      if (!done) return;
      var S = price(o.sym); if (S == null) return;
      var intrinsic = Math.max(0, o.type === 'call' ? S - o.strike : o.strike - S);
      var pnl = sellOption(o, o.qty, round2(intrinsic), intrinsic > 0 ? 'Expired in the money' : 'Expired worthless');
      notify('Option expired: ' + OPT.label(o), (intrinsic > 0 ? 'Settled at $' + intrinsic.toFixed(2) + ' · ' : 'Expired worthless · ') + signed(pnl));
      changed = true;
    });
    return changed;
  }

  // ------------------------------------------------------------ notifications
  function notify(title, body) {
    toast('<span class="zm-tag is-war">TRADE WAR — VIRTUAL</span> <b>' + esc(title) + '</b><br>' + esc(body));
    try {
      if ('Notification' in window && Notification.permission === 'granted') new Notification('Trade War (virtual): ' + title, { body: body, icon: '../icons/icon-192.png', tag: 'zelos-' + title });
    } catch (e) {}
  }
  function alertFill(o, qty, px, pnl) {
    var kind = o.role === 'tp' ? 'Take profit hit' : o.role === 'sl' || o.type === 'stop' ? 'Stop loss hit' : 'Order filled';
    notify(kind + ': ' + o.sym, 'Sold ' + qty + ' @ $' + px.toFixed(2) + ' · ' + signed(pnl));
  }
  function renderBell() {
    var b = $('ptBell'); if (!b) return;
    var ok = 'Notification' in window;
    var on = ok && Notification.permission === 'granted';
    b.classList.toggle('is-on', on);
    b.title = !ok ? 'This browser doesn\'t support notifications' : on ? 'Notifications on: you\'ll get a pop-up when a take profit or stop loss hits' : 'Get a pop-up when a take profit or stop loss hits';
    b.innerHTML = (on ? '&#128276;' : '&#128277;') + '<span>' + (on ? 'Alerts on' : 'Alerts') + '</span>';
  }

  // ------------------------------------------------------------ UI state
  var sel = 'NVDA', side = 'buy', chart = null, ticket = { type: 'market', qtyMode: 'shares', mode: 'stock' }, tab = 'positions';
  try { var qTab = new URLSearchParams(location.search).get('tab'); if (/^(positions|orders|history|agents|performance|alerts|progress)$/.test(qTab)) tab = qTab; } catch (e) {}
  var opt = { type: 'call', exp: null, pick: null }, agentAlerts = null, forecastOn = false, fibOn = false, sellPlan = null;
  var ALERTS = TC.alerts; // Trade War price alerts, shared with matches (practice-chart.js)

  function renderWatch() {
    var q = ($('ptSearch').value || '').trim().toUpperCase(), lastG = null, h = '';
    UNIVERSE.forEach(function (u) {
      var s = u.sym;
      if (q && s.indexOf(q) !== 0 && NAMES[s].toUpperCase().indexOf(q) === -1 && !(u.short && u.short.indexOf(q) === 0)) return;
      if (!q && u.group !== lastG) { h += '<div class="pt-wgroup">' + esc(u.group) + '</div>'; lastG = u.group; }
      var px = price(s), pc = prevClose(s), ch = px != null && pc ? (px / pc - 1) * 100 : 0, held = acct.positions[s] || acct.options.some(function (o) { return o.sym === s; });
      h += '<button type="button" class="pt-wrow' + (s === sel ? ' is-sel' : '') + '" data-sym="' + s + '">' +
        '<span class="pt-wsym">' + s + (held ? '<i class="pt-held" title="You hold this"></i>' : '') + '<small>' + esc(NAMES[s]) + '</small></span>' +
        '<span class="pt-wpx">' + pfmt(px) + '<small class="' + (ch >= 0 ? 'up' : 'dn') + '">' + pct(ch) + '</small></span></button>';
    });
    $('ptWatch').innerHTML = h || '<p class="pt-empty">No match.</p>';
  }

  function fullPortGlow() {
    var on = !!acct.fullPort;
    document.body.classList.toggle('pt-fullport', on);
    if (!on) return;
    var eq = equity(), held = Object.keys(acct.positions).length + acct.options.length;
    var move = held ? openPnl() / Math.max(1, eq) : eq / START_CASH - 1;
    var k = Math.min(1, 0.3 + Math.abs(move) * 12), rgb = move >= 0 ? '62,203,124' : '224,72,63', st = document.body.style;
    st.setProperty('--pt-glow', 'rgba(' + rgb + ',' + (0.25 + 0.55 * k).toFixed(2) + ')');
    st.setProperty('--pt-glow-soft', 'rgba(' + rgb + ',' + (0.08 + 0.22 * k).toFixed(2) + ')');
    st.setProperty('--pt-glow-size', Math.round(60 + 140 * k) + 'px');
    st.setProperty('--pt-glow-speed', (2.4 - 1.5 * k).toFixed(2) + 's');
  }
  function renderHeader() {
    fullPortGlow();
    var eq = equity(), tot = eq - START_CASH, dp = dayPnl(), op = openPnl();
    if (eq > (acct.peakEquity || 0)) acct.peakEquity = round2(eq);
    $('ptEquity').textContent = money(eq);
    $('ptTotal').textContent = signed(tot) + ' (' + pct(tot / START_CASH * 100) + ')'; $('ptTotal').className = tot >= 0 ? 'up' : 'dn';
    renderAcctCard();
    $('ptDay').textContent = signed(dp); $('ptDay').className = dp >= 0 ? 'up' : 'dn';
    $('ptOpen').textContent = signed(op); $('ptOpen').className = op >= 0 ? 'up' : 'dn';
    $('ptBP').textContent = money(buyingPower());
    // signed in but the online account hasn't loaded yet: don't flash this browser's old copy
    if (!authReady || (currentUser && !synced && !syncFailed)) ['ptEquity', 'ptTotal', 'ptDay', 'ptOpen', 'ptBP'].forEach(function (id) { $(id).textContent = '…'; $(id).className = ''; });
    if ($('ptUser')) $('ptUser').textContent = playerName();
    $('ptResetBanner').hidden = eq >= RESET_BELOW;
    renderLevelChip(); renderRecovery();
    var st = $('ptFeed'), txt, cls;
    if (feed.state === 'live' && marketOpen()) { txt = 'Live · updated ' + ago(feed.updatedAt); cls = 'is-live'; }
    else if (feed.state === 'live' || feed.state === 'closed') { txt = 'Market closed · prices as of ' + asOf(feed.updatedAt); cls = 'is-closed'; }
    else if (feed.state === 'error') { txt = feed.error === 'auth' ? 'Live feed error (API key rejected) · last close' : 'Live feed unavailable · last close'; cls = 'is-error'; }
    else if (feed.state === 'none') { txt = 'Delayed · latest close ' + (series[sel] ? series[sel].d[series[sel].n - 1] : ''); cls = 'is-closed'; }
    else { txt = 'Connecting…'; cls = ''; }
    st.textContent = txt; st.className = 'pt-feed ' + cls;
    $('ptClock').textContent = marketOpen() ? 'Market open' : 'Market closed';
    $('ptClock').className = 'pt-clock ' + (marketOpen() ? 'is-open' : '');
    renderBell();
  }
  // ------------------------------------------------------------ News dropdown + research (markets/research_<SYM>, FMP)
  var research = {}, researchSym = null, researchUnsub = null, finnNews = null, finnAttr = '';
  function watchResearch() {
    if (researchSym === sel || !db) return; // no db yet: try again on the next render
    if (researchUnsub) { researchUnsub(); researchUnsub = null; }
    researchSym = sel;
    if (isCrypto(sel)) return;
    var sym = sel;
    researchUnsub = db.collection('markets').doc('research_' + sym.replace('.', '-')).onSnapshot(function (sn) {
      research[sym] = sn.exists ? sn.data() : null; if (sym === sel) renderNewsBtn();
    }, function () {});
  }
  function newsFor(sym) {
    var r = research[sym], a = ((r && r.news) || []).map(function (n) { return { headline: n.headline, source: n.source, url: n.url, when: n.date ? fmtStamp(n.date) : '', image: n.image }; });
    if (!a.length && finnNews && finnNews[sym]) a = finnNews[sym].map(function (n) { return { headline: n.headline, source: n.source, url: n.url, when: n.datetime ? agoS(n.datetime) : '', image: n.image }; });
    return a.filter(function (n) { return /^https?:\/\//.test(n.url || ''); });
  }
  function fmtStamp(str) { var m = /^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d):(\d\d))?/.exec(str || ''); if (!m) return ''; var mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1]; return mo + ' ' + +m[3] + (m[4] ? ' · ' + ((+m[4] % 12) || 12) + ':' + m[5] + (+m[4] < 12 ? ' am' : ' pm') : ''); }
  function agoS(sec) { var m = Math.max(1, Math.round((Date.now() / 1000 - sec) / 60)); return m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; }
  function daysUntil(ds) { return Math.round((new Date(ds + 'T12:00:00Z') - new Date(todayNY() + 'T12:00:00Z')) / 864e5); }
  function renderNewsBtn() {
    watchResearch();
    var btn = $('ptNewsBtn'); if (!btn) return;
    var cr = isCrypto(sel), n = cr ? 0 : newsFor(sel).length, r = research[sel], earn = $('ptEarn');
    btn.parentNode.hidden = cr;
    $('ptNewsN').hidden = !n; $('ptNewsN').textContent = n;
    var e = r && r.earnings, dd = e && e.date ? daysUntil(e.date) : null;
    if (earn) {
      earn.hidden = !(dd != null && dd >= 0 && dd <= 14);
      if (!earn.hidden) { earn.textContent = dd === 0 ? 'Earnings today' : 'Earnings in ' + dd + ' day' + (dd === 1 ? '' : 's'); earn.title = 'Next earnings report: ' + e.date + '. Prices can jump on earnings day.'; }
    }
    if (!$('ptNewsMenu').hidden) renderNewsMenu();
  }
  function renderNewsMenu() {
    var r = research[sel], items = newsFor(sel), px = price(sel), facts = [];
    if (r && r.target && r.target.targetConsensus && px) { var up = (r.target.targetConsensus / px - 1) * 100; facts.push('Analysts\' target <b>$' + fmt(r.target.targetConsensus) + '</b> <span class="' + (up >= 0 ? 'up' : 'dn') + '">(' + pct(up) + ')</span>'); }
    if (r && r.earnings && r.earnings.date) facts.push('Next earnings <b>' + shortDay(r.earnings.date) + '</b>');
    if (r && r.grades && r.grades[0]) { var g = r.grades[0]; facts.push(esc(g.firm) + ': <b>' + esc(g.to || g.action) + '</b> <small>' + shortDay(g.date) + '</small>'); }
    $('ptNewsMenu').innerHTML = '<div class="pt-news-head"><b>' + esc(sel) + ' news</b><button type="button" class="pt-linkbtn" data-newsx="1">close &times;</button></div>' +
      (facts.length ? '<div class="pt-news-facts">' + facts.map(function (f) { return '<span>' + f + '</span>'; }).join('') + '</div>' : '') +
      (items.length ? items.slice(0, 6).map(function (n) {
        return '<a class="pt-news-item" href="' + esc(n.url) + '" target="_blank" rel="noopener noreferrer">' +
          (n.image && /^https:/.test(n.image) ? '<img src="' + esc(n.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<i class="pt-news-ph" aria-hidden="true"></i>') +
          '<span><b>' + esc(n.headline) + '</b><small>' + esc(n.source || '') + (n.when ? ' · ' + esc(n.when) : '') + '</small></span></a>';
      }).join('') : '<p class="pt-empty">No recent headlines for ' + esc(sel) + ' yet.</p>') +
      '<p class="pt-news-foot">Opens each story at its source &#8599; · ' + (r && r.news && r.news.length ? 'Data: Financial Modeling Prep' : esc(finnAttr || 'News via Finnhub')) + '</p>';
    var x = $('ptNewsMenu').querySelector('[data-newsx]'); if (x) x.onclick = function () { $('ptNewsMenu').hidden = true; $('ptNewsBtn').setAttribute('aria-expanded', 'false'); };
  }

  // ------------------------------------------------------------ account card: value + history across resets
  var acctRange = 'all';
  try { var ar0 = localStorage.getItem('zelosAcctRange'); if (ar0 === '31' || ar0 === '92' || ar0 === 'all') acctRange = ar0; } catch (e) {}
  function valuePoints() {
    var vh = acct.valueHist || {}, today = todayNY(), resets = acct.resetHistory || [], pts = [];
    var days = Object.keys(vh).filter(function (k) { return k !== 'seeded' && k < today; }).sort();
    days.forEach(function (d) {
      // a reset day: the drop (value before) first, then the fresh $10,000
      resets.filter(function (r) { return r.day === d; }).forEach(function (r) { pts.push({ d: d, v: r.equityBefore }); pts.push({ d: d, v: START_CASH, reset: true }); });
      pts.push({ d: d, v: vh[d] });
    });
    resets.forEach(function (r) { if (days.indexOf(r.day) === -1) { pts.push({ d: r.day, v: r.equityBefore }); pts.push({ d: r.day, v: START_CASH, reset: true }); } });
    pts.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    if (acctRange !== 'all') { var from = addDays(todayNY(), -(+acctRange)); pts = pts.filter(function (p) { return p.d >= from; }); }
    return pts;
  }
  function renderAcctCard() {
    var lastReset = acct.resetHistory.length ? acct.resetHistory[acct.resetHistory.length - 1] : null;
    var lbl = $('ptSinceLbl'); if (lbl) lbl.textContent = lastReset ? 'since reset' : 'since start';
    var note = $('ptAcctNote');
    if (note) note.textContent = 'Account #' + (acct.resets + 1) + ' · ' + (lastReset ? 'reset ' + shortDay(lastReset.day) : 'started ' + shortDay(nyParts(new Date(acct.createdAt || Date.now())).date));
    document.querySelectorAll('#ptAcctRng [data-ar]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-ar') === acctRange); });
    drawAcctChart();
  }
  function shortDay(ds) { try { return new Date(ds + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); } catch (e) { return ds; } }
  function drawAcctChart() {
    var cv = $('ptAcctChart'); if (!cv || !cv.clientWidth) return;
    var pts = valuePoints().concat([{ d: todayNY(), v: round2(equity()), now: true }]);
    var dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr;
    var c = cv.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, W, H);
    if (pts.length < 2) pts.unshift({ d: '', v: START_CASH });
    var vals = pts.map(function (p) { return p.v; }), lo = Math.min.apply(null, vals.concat([START_CASH])), hi = Math.max.apply(null, vals.concat([START_CASH])), pad = (hi - lo) * 0.12 || 60;
    lo -= pad; hi += pad;
    var X = function (i) { return 2 + i / (pts.length - 1) * (W - 4); }, Y = function (v) { return 4 + (hi - v) / (hi - lo) * (H - 8); };
    var cs = getComputedStyle(document.documentElement), muted = cs.getPropertyValue('--muted').trim() || '#8b93a3';
    c.strokeStyle = 'rgba(127,127,127,0.35)'; c.setLineDash([3, 4]); c.lineWidth = 1; c.beginPath(); c.moveTo(0, Y(START_CASH)); c.lineTo(W, Y(START_CASH)); c.stroke(); c.setLineDash([]);
    var lastReset = -1; pts.forEach(function (p, i) { if (p.reset) lastReset = i; });
    var cur = pts[pts.length - 1].v >= START_CASH ? '#3ecb7c' : '#e0483f';
    // before the latest reset: grey; this account: green/red with a soft fill
    if (lastReset > 0) {
      c.beginPath(); for (var i = 0; i <= lastReset - 1; i++) { if (i) c.lineTo(X(i), Y(pts[i].v)); else c.moveTo(X(i), Y(pts[i].v)); }
      c.strokeStyle = muted; c.globalAlpha = 0.7; c.lineWidth = 1.5; c.stroke(); c.globalAlpha = 1;
    }
    var s0 = Math.max(0, lastReset);
    c.beginPath(); for (var j = s0; j < pts.length; j++) { if (j > s0) c.lineTo(X(j), Y(pts[j].v)); else c.moveTo(X(j), Y(pts[j].v)); }
    c.strokeStyle = cur; c.lineWidth = 2; c.stroke();
    c.lineTo(X(pts.length - 1), H); c.lineTo(X(s0), H); c.closePath(); c.globalAlpha = 0.12; c.fillStyle = cur; c.fill(); c.globalAlpha = 1;
    pts.forEach(function (p, k) {
      if (!p.reset) return;
      var x = Math.round(X(k)) + 0.5;
      c.strokeStyle = '#e8b23d'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(x, 12); c.lineTo(x, H); c.stroke(); c.setLineDash([]);
      c.font = '700 9px ' + (cs.getPropertyValue('--mono').trim() || 'monospace');
      var tw = c.measureText('RESET').width + 8, bx = Math.min(W - tw - 1, Math.max(1, x - tw / 2));
      c.fillStyle = '#e8b23d'; c.fillRect(bx, 0, tw, 12); c.fillStyle = '#1a1204'; c.fillText('RESET', bx + 4, 9);
    });
  }
  function levelOf(xp) { return window.ZelosLevels ? ZelosLevels.levelForXp(xp || 0) : null; }
  function renderLevelChip() {
    var el = $('ptLevel'); if (!el) return;
    if (xpNow == null) { el.hidden = true; return; }
    var lv = levelOf(xpNow), sk = PROG ? PROG.streak() : 0;
    el.hidden = false;
    el.innerHTML = (lv && window.ZelosLevels ? ZelosLevels.badge(lv, 18) : '') + '<b>Lv ' + (lv ? lv.level : 0) + '</b> ' + (lv ? esc(lv.name) : '') + ' · ' + xpNow.toLocaleString('en-US') + ' XP' + (sk ? ' · <span title="Mission streak">🔥 ' + sk + '</span>' : '');
  }
  function renderRecovery() {
    var el = $('ptRecovery'); if (!el) return;
    var r = acct.recovery; if (!r) { el.hidden = true; return; }
    var eq = equity(), span = START_CASH - r.low, pctBack = span > 0 ? Math.max(0, Math.min(100, (eq - r.low) / span * 100)) : 0;
    el.hidden = false;
    el.innerHTML = '<div class="pt-rec-head"><span><b>Recovery goal</b> ' + money(r.low, 0) + ' &rarr; ' + money(START_CASH, 0) + '</span><span>' + money(eq) + ' · ' + pctBack.toFixed(0) + '% back</span></div>' +
      '<div class="pt-rec-bar"><i style="width:' + pctBack.toFixed(1) + '%"></i></div>' +
      '<small>Win it back to ' + money(START_CASH, 0) + ' without a reset' + (r.low <= START_CASH * 0.9 ? ' to earn <b>Comeback Kid</b>' : '') + '. Resets are counted separately and never count as growth.</small>';
  }
  function ago(iso) { if (!iso) return '–'; var s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000)); return s < 60 ? s + 's ago' : Math.round(s / 60) + 'm ago'; }
  function asOf(iso) { if (!iso) return 'last close'; try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET'; } catch (e) { return iso; } }

  // forecast boxes: the ticket's bracket, else the open position's bracket, else a 2:1 ATR suggestion.
  // All of them can be dragged on the chart (see onForecastEdit); a Sell ticket flips the plan.
  function forecast() {
    if (!forecastOn) return null;
    var px = price(sel); if (px == null) return null;
    var stockTicket = ticket.mode === 'stock';
    if (stockTicket && side === 'buy' && $('ptUseBracket').checked && (+$('ptSL').value || +$('ptTP').value)) {
      var e = ticket.type === 'limit' ? +$('ptLimit').value || px : ticket.type === 'stop' ? +$('ptStopPx').value || px : px;
      return { entry: e, sl: +$('ptSL').value || null, tp: +$('ptTP').value || null, label: 'Your plan', side: 'buy', editable: true, src: 'ticket' };
    }
    var pos = acct.positions[sel];
    if (pos && !(stockTicket && side === 'sell')) {
      var sl = null, tp = null;
      acct.orders.forEach(function (o) { if (o.status === 'open' && o.sym === sel && o.side === 'sell') { if (o.type === 'stop') sl = o.stop; if (o.type === 'limit') tp = o.limit; } });
      if (sl || tp) return { entry: pos.avg, sl: sl, tp: tp, label: 'Open position', side: 'buy', editable: true, src: 'orders' };
    }
    var s = series[sel], a = s && s.n > 15 ? atrOf(s) : px * 0.02;
    if (stockTicket && side === 'sell') {
      if (sellPlan && sellPlan.sym === sel) return { entry: px, sl: sellPlan.sl, tp: sellPlan.tp, label: 'If you sell here', side: 'sell', editable: true, src: 'sell' };
      return { entry: px, sl: round2(px + 1.5 * a), tp: round2(px - 3 * a), label: 'If you sell here', side: 'sell', editable: true, src: 'sell' };
    }
    return { entry: px, sl: round2(px - 1.5 * a), tp: round2(px + 3 * a), label: 'Suggested (1.5 ATR stop, 2:1)', side: 'buy', editable: true, src: 'suggest' };
  }
  // a dragged SL / TP edge: update the ticket, the live bracket orders, or the sell plan
  function onForecastEdit(F, which) {
    var v = F[which], px = price(sel), name = which === 'sl' ? 'Stop loss' : 'Take profit';
    if (F.src === 'ticket' || F.src === 'suggest') {
      ticket.mode = 'stock'; $('ptUseBracket').checked = true; $('ptBracketFields').hidden = false;
      if (F.sl) $('ptSL').value = fmt(F.sl); if (F.tp) $('ptTP').value = fmt(F.tp);
      renderTicket(); toast(name + ' set to $' + fmt(v) + ' on your order ticket.');
    } else if (F.src === 'orders') {
      if (px != null && ((which === 'sl' && v >= px) || (which === 'tp' && v <= px))) {
        toast(name + ' has to stay ' + (which === 'sl' ? 'below' : 'above') + ' the current price ($' + fmt(px) + ').', true); renderAll(); return;
      }
      var moved = false;
      acct.orders.forEach(function (o) { if (o.status === 'open' && o.sym === sel && o.side === 'sell') { if (which === 'sl' && o.type === 'stop') { o.stop = v; moved = true; } if (which === 'tp' && o.type === 'limit') { o.limit = v; moved = true; } } });
      if (moved) { save(); toast(name + ' order moved to $' + fmt(v) + '.'); }
      renderAll();
    } else if (F.src === 'sell') { sellPlan = { sym: sel, sl: F.sl, tp: F.tp }; }
  }
  function atrOf(s) { var n = 14, prev = null; for (var i = 1; i < s.n; i++) { var tr = Math.max(s.h[i] - s.l[i], Math.abs(s.h[i] - s.c[i - 1]), Math.abs(s.l[i] - s.c[i - 1])); prev = prev == null ? tr : (prev * (n - 1) + tr) / n; } return prev; }

  function renderQuote() {
    var s = series[sel]; if (!s) return;
    if (!s.n) { // a crypto coin before its first price arrives
      $('ptSym').textContent = sel; $('ptName').textContent = NAMES[sel] || ''; $('ptPx').textContent = '–'; $('ptChg').textContent = ''; $('ptStats').innerHTML = '';
      renderNewsBtn(); chart.empty = 'Loading prices for ' + sel + '…'; chart.s = null; chart.draw(); return;
    }
    var px = price(sel), pc = prevClose(sel), ch = px - pc, chp = pc ? ch / pc * 100 : 0;
    $('ptSym').textContent = sel; $('ptName').textContent = NAMES[sel] || '';
    $('ptPx').textContent = pfmt(px);
    $('ptChg').textContent = (ch >= 0 ? '+' : '') + pfmt(ch) + ' (' + pct(chp) + ')'; $('ptChg').className = ch >= 0 ? 'up' : 'dn';
    renderNewsBtn();
    var i = s.n - 1, hi52 = Math.max.apply(null, s.h.slice(-252)), lo52 = Math.min.apply(null, s.l.slice(-252));
    var avgV = s.v.slice(-21, -1).filter(Boolean); avgV = avgV.length ? avgV.reduce(function (a, b) { return a + b; }, 0) / avgV.length : null;
    $('ptStats').innerHTML = [
      ['Open', pfmt(s.o[i])], ['High', pfmt(s.h[i])], ['Low', pfmt(s.l[i])], ['Prev close', pfmt(pc)],
      ['52-wk high', pfmt(hi52)], ['52-wk low', pfmt(lo52)], ['Avg volume', TC.fmtVol(avgV)], ['Volatility', (vol(sel) / 1.1 * 100).toFixed(0) + '%']
    ].map(function (r) { return '<span><small>' + r[0] + '</small><b>' + r[1] + '</b></span>'; }).join('');
    var ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#f4f5f7';
    var lines = [], pos = acct.positions[sel];
    if (pos) { var upl = (px - pos.avg) * pos.qty; lines.push({ price: pos.avg, color: ink, label: 'ENTRY ' + fmt(pos.avg) + ' · ' + pos.qty + ' sh · P&L ' + signed(upl) + ' (' + pct((px / pos.avg - 1) * 100) + ')', dash: [6, 3] }); }
    acct.orders.forEach(function (o) {
      if (o.status !== 'open' || o.sym !== sel || o.type === 'market') return;
      var col = o.role === 'tp' ? '#3ecb7c' : o.role === 'sl' ? '#e0483f' : o.type === 'stop' ? '#e8b23d' : o.side === 'buy' ? '#3ecb7c' : '#e0483f';
      lines.push({ price: o.limit || o.stop, color: col, label: (o.role === 'tp' ? 'TAKE PROFIT ' : o.role === 'sl' ? 'STOP LOSS ' : (o.side === 'buy' ? 'BUY ' : 'SELL ') + o.type.toUpperCase() + ' ') + o.qty });
    });
    chart.lines = lines;
    chart.forecast = forecast();
    chart.fib = fibOn;
    chart.alerts = ALERTS.forSym(sel);
    if (chart.placing !== 'abc') chart.abc = TC.abc.get(sel);
    var ds = displaySeries();
    chart.marks = !ds || ds.intraday ? [] : acct.fills.filter(function (f) { return f.sym === sel && !f.option; }).map(function (f) {
      return { i: ds.d.indexOf(tf === 'W' ? weekKey(f.day) : f.day), price: f.price, side: f.side };
    }).filter(function (m) { return m.i >= 0; });
    chart.lastPrice = px;
    chart.empty = null;
    if (!ds || !ds.n) {
      chart.empty = ds && ds.intraday
        ? 'Intraday bars are built from the live price feed during market hours (9:30 am to 4:00 pm Eastern) and keep the last 5 sessions. Daily and weekly charts are available now.'
        : 'Loading chart…';
      chart.s = null; chart.draw(); return;
    }
    var freshKey = !chart.s || chart.s.key !== ds.key;
    chart.setSeries(ds, rangeSel || TF[tf].def);
    if (freshKey && rangeSel) chart.setRange(rangeSel);
    chart.draw();
  }

  // ------------------------------------------------------------ ticket (stocks + options)
  function renderTicket() {
    document.querySelectorAll('[data-mode]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-mode') === ticket.mode); b.setAttribute('aria-selected', String(b.getAttribute('data-mode') === ticket.mode)); });
    $('ptStockTicket').hidden = ticket.mode !== 'stock'; $('ptOptTicket').hidden = ticket.mode !== 'options';
    $('ptBuy').classList.toggle('is-on', side === 'buy'); $('ptSell').classList.toggle('is-on', side === 'sell');
    $('ptBuy').setAttribute('aria-pressed', String(side === 'buy')); $('ptSell').setAttribute('aria-pressed', String(side === 'sell'));
    var cr = isCrypto(sel);
    document.querySelector('.pt-modes').hidden = cr; // no options on crypto
    if (cr && ticket.mode === 'options') { ticket.mode = 'stock'; $('ptStockTicket').hidden = false; $('ptOptTicket').hidden = true; }
    if (ticket.mode === 'options') return renderOptTicket();
    var px = price(sel), pos = acct.positions[sel];
    $('ptQty').step = cr ? 'any' : '1';
    $('ptTif').disabled = cr; if (cr) $('ptTif').value = 'gtc';
    $('ptLimitRow').hidden = ticket.type !== 'limit'; $('ptStopRow').hidden = ticket.type !== 'stop';
    $('ptBracket').hidden = side !== 'buy';
    var unit = cr ? (CRYPTO[sel].short || sel) : 'Shares';
    $('ptQtyLabel').textContent = acct.fullPort ? unit + ' (Full Port: all in)' : ticket.qtyMode === 'shares' ? (cr ? 'Amount (' + unit + ')' : 'Shares') : 'Amount ($)';
    $('ptFullPort').checked = !!acct.fullPort; $('ptFullWarn').hidden = !acct.fullPort;
    $('ptQtyMode').hidden = !!acct.fullPort; $('ptQty').disabled = !!acct.fullPort;
    if (acct.fullPort) $('ptQty').value = fullQty() || '';
    var q = orderQty(), est = q * (ticket.type === 'limit' ? +$('ptLimit').value || px : ticket.type === 'stop' ? +$('ptStopPx').value || px : px);
    var have = pos ? pos.qty - reservedShares(sel) : 0;
    $('ptEst').innerHTML = side === 'buy' ? '<span>Buying power</span><b>' + money(buyingPower()) + '</b>' + (q ? '<span>Est. cost</span><b>' + money(est) + '</b>' : '')
      : (pos ? '<span>' + (cr ? 'Available' : 'Shares available') + '</span><b>' + qtyStr(have) + '</b>' + (q ? '<span>Est. proceeds</span><b>' + money(est) + '</b>' : '') : '<span>You don\'t hold ' + sel + '</span>');
    var open = symOpen(sel), liveOk = cr ? isLiveTick(sel) : feed.state === 'live';
    $('ptWhen').textContent = ticket.type === 'market'
      ? (open ? (liveOk ? 'Fills right away at the live price.' : 'Fills right away at the last price shown.') : 'Market is closed: fills at the next open.')
      : (ticket.type === 'limit' ? (side === 'buy' ? 'Fills at your price or lower.' : 'Fills at your price or higher.') : (side === 'sell' ? 'Sells if price drops to your stop (can fill lower on a gap).' : 'Buys if price rises to your stop.'));
    if (cr && ticket.type !== 'market') $('ptWhen').textContent += ' Crypto orders stay open until they fill or you cancel them.';
    var typeTxt = ticket.type === 'market' ? 'Market' : ticket.type === 'limit' ? 'Limit ' + pfmt(+$('ptLimit').value) : 'Stop ' + pfmt(+$('ptStopPx').value);
    $('ptSubmit').innerHTML = '<span class="pt-sub-main">' + (side === 'buy' ? 'Buy ' : 'Sell ') + (cr ? CRYPTO[sel].short || sel : sel) + '</span><span class="pt-sub-meta">' + typeTxt + (q ? ' · ' + qtyStr(q) + (cr ? '' : ' sh') + ' · ' + money(est) : '') + '</span>';
    $('ptSubmit').className = 'pt-submit ' + (side === 'buy' ? 'is-buy' : 'is-sell');
    if (forecastOn) { chart.forecast = forecast(); chart.draw(); }
  }
  // whole shares for stocks; crypto trades in fractions (6 decimals)
  function roundQty(q) { return isCrypto(sel) ? Math.floor(q * 1e6 + 1e-6) / 1e6 : Math.floor(q); }
  function fullQty() {
    if (side === 'sell') { var p = acct.positions[sel]; return p ? Math.max(0, +(p.qty - reservedShares(sel)).toFixed(6)) : 0; }
    var px = ticket.type === 'limit' ? +$('ptLimit').value || price(sel) : ticket.type === 'stop' ? +$('ptStopPx').value || price(sel) : price(sel);
    return px ? roundQty(buyingPower() / px) : 0;
  }
  function orderQty() {
    if (acct.fullPort) return fullQty();
    var v = parseFloat($('ptQty').value); if (!(v > 0)) return 0;
    if (ticket.qtyMode === 'shares') return roundQty(v);
    var px = ticket.type === 'limit' ? +$('ptLimit').value || price(sel) : price(sel);
    return px ? roundQty(v / px) : 0;
  }

  function optChain() {
    var S = price(sel), today = todayNY(); if (S == null) return null;
    var exps = OPT.expirations(today);
    if (!opt.exp || exps.indexOf(opt.exp) === -1) opt.exp = exps.filter(function (e) { return OPT.daysTo(e, today) >= 21; })[0] || exps[0];
    var sig = vol(sel);
    return { S: S, exps: exps, rows: OPT.strikes(S, 17).map(function (K) { var q = OPT.quote(opt.type, S, K, opt.exp, today, sig); q.strike = K; return q; }), sig: sig };
  }
  function renderOptTicket() {
    var ch = optChain(); if (!ch) return;
    var today = todayNY();
    $('ptOptExp').innerHTML = ch.exps.map(function (e) { var d = OPT.daysTo(e, today); return '<option value="' + e + '"' + (e === opt.exp ? ' selected' : '') + '>' + e.slice(5).replace('-', '/') + ' · ' + d + 'd</option>'; }).join('');
    document.querySelectorAll('[data-otype]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-otype') === opt.type); });
    var atm = ch.rows.reduce(function (a, r) { return Math.abs(r.strike - ch.S) < Math.abs(a.strike - ch.S) ? r : a; }, ch.rows[0]);
    var chainKey = sel + opt.type + opt.exp, keepTop = $('ptChain').getAttribute('data-key') === chainKey ? $('ptChain').scrollTop : null;
    $('ptChain').innerHTML = '<table class="pt-chain"><thead><tr><th>Strike</th><th>Bid</th><th>Ask</th><th>Delta</th></tr></thead><tbody>' + ch.rows.map(function (r) {
      var itm = opt.type === 'call' ? r.strike < ch.S : r.strike > ch.S, on = opt.pick && opt.pick.strike === r.strike && opt.pick.exp === opt.exp && opt.pick.type === opt.type;
      return '<tr class="' + (itm ? 'itm ' : '') + (r === atm ? 'atm ' : '') + (on ? 'is-sel' : '') + '" data-strike="' + r.strike + '"><td>' + r.strike + '</td><td>' + r.bid.toFixed(2) + '</td><td>' + r.ask.toFixed(2) + '</td><td>' + r.delta.toFixed(2) + '</td></tr>';
    }).join('') + '</tbody></table>';
    $('ptChain').setAttribute('data-key', chainKey);
    if (keepTop != null) $('ptChain').scrollTop = keepTop;
    else { var ar = $('ptChain').querySelector('tr.atm'); if (ar) $('ptChain').scrollTop = Math.max(0, ar.offsetTop - $('ptChain').clientHeight / 2); }
    var held = acct.options.filter(function (o) { return o.sym === sel; });
    var pick = opt.pick && opt.pick.exp === opt.exp && opt.pick.type === opt.type ? ch.rows.filter(function (r) { return r.strike === opt.pick.strike; })[0] : null;
    var q = Math.max(1, Math.floor(+$('ptOptQty').value || 1));
    if (pick) {
      var c = { sym: sel, type: opt.type, strike: pick.strike, exp: opt.exp };
      var cid = OPT.contractId(sel, opt.type, pick.strike, opt.exp), mine = acct.options.filter(function (o) { return o.cid === cid; })[0];
      $('ptOptPick').innerHTML = '<b>' + esc(OPT.label(c)) + '</b><span>Bid ' + pick.bid.toFixed(2) + ' · Ask ' + pick.ask.toFixed(2) + ' · Δ ' + pick.delta.toFixed(2) + ' · ' + pick.dte + ' days</span>' +
        '<span>Break-even ' + fmt(opt.type === 'call' ? pick.strike + pick.ask : pick.strike - pick.ask) + (mine ? ' · you hold ' + mine.qty : '') + '</span>';
      $('ptOptBuy').disabled = false; $('ptOptSell').disabled = !mine;
      $('ptOptBuy').innerHTML = '<span class="pt-sub-main">Buy to open</span><span class="pt-sub-meta">' + q + ' × $' + (pick.ask * 100).toFixed(0) + ' = ' + money(pick.ask * 100 * q) + '</span>';
      $('ptOptSell').innerHTML = '<span class="pt-sub-main">Sell to close</span><span class="pt-sub-meta">' + (mine ? Math.min(q, mine.qty) + ' × $' + (pick.bid * 100).toFixed(0) : 'none held') + '</span>';
    } else {
      $('ptOptPick').innerHTML = '<span>Pick a strike from the chain. Highlighted rows are in the money; the outlined row is at the money.</span>';
      $('ptOptBuy').disabled = true; $('ptOptSell').disabled = true;
      $('ptOptBuy').innerHTML = '<span class="pt-sub-main">Buy to open</span>'; $('ptOptSell').innerHTML = '<span class="pt-sub-main">Sell to close</span>';
    }
    $('ptOptNote').textContent = (marketOpen() ? '' : 'Options trade 9:30 am to 4:00 pm Eastern. ') + 'Option prices are modeled (Black-Scholes on ' + sel + '\'s recent volatility, ' + (ch.sig * 100).toFixed(0) + '%), not live exchange quotes.' + (held.length ? ' You hold ' + held.length + ' ' + sel + ' contract' + (held.length === 1 ? '' : 's') + '.' : '');
  }
  function optTrade(action) {
    if (!marketOpen()) return toast('Options trade during market hours (9:30 am to 4:00 pm Eastern).', true);
    var ch = optChain(); if (!ch || !opt.pick) return;
    var row = ch.rows.filter(function (r) { return r.strike === opt.pick.strike; })[0]; if (!row) return;
    var q = Math.max(1, Math.floor(+$('ptOptQty').value || 1)), c = { sym: sel, type: opt.type, strike: row.strike, exp: opt.exp, ask: row.ask, agent: opt.agent || null };
    if (action === 'buy') {
      var err = buyOption(c, q); if (err) return toast(err, true);
      toast('Bought ' + q + ' ' + esc(OPT.label(c)) + ' @ ' + row.ask.toFixed(2));
    } else {
      var cid = OPT.contractId(sel, opt.type, row.strike, opt.exp), mine = acct.options.filter(function (o) { return o.cid === cid; })[0];
      if (!mine) return;
      var pnl = sellOption(mine, q, row.bid, 'Sold to close');
      toast('Sold ' + esc(OPT.label(c)) + ' @ ' + row.bid.toFixed(2) + ' · ' + signed(pnl));
    }
    save(); renderAll();
  }

  // ------------------------------------------------------------ lower tabs
  function renderTabs() {
    document.querySelectorAll('.pt-tab').forEach(function (t) { t.setAttribute('aria-selected', String(t.getAttribute('data-tab') === tab)); });
    var h = '', today = todayNY();
    if (tab === 'positions') {
      var syms = Object.keys(acct.positions);
      h = syms.length ? '<div class="pt-subhead">Stocks ' + modeTag() + '</div><table class="pt-table"><thead><tr><th>Symbol</th><th>Shares</th><th>Avg cost</th><th>Price</th><th>Market value</th><th>Today</th><th>Total P&amp;L</th><th></th></tr></thead><tbody>' +
        syms.map(function (s) {
          var p = acct.positions[s], px = price(s), pc = prevClose(s), mv = p.qty * px, pl = (px - p.avg) * p.qty, base = p.openedDay === today ? p.avg : pc, dp = (px - base) * p.qty;
          return '<tr><td><button class="pt-link" data-sym="' + s + '">' + s + '</button></td><td>' + qtyStr(p.qty) + '</td><td>' + pfmt(p.avg) + '</td><td>' + pfmt(px) + '</td><td>' + money(mv) + '</td>' +
            '<td class="' + (dp >= 0 ? 'up' : 'dn') + '">' + signed(dp) + '</td><td class="' + (pl >= 0 ? 'up' : 'dn') + '">' + signed(pl) + ' (' + pct(pl / (p.avg * p.qty) * 100) + ')</td>' +
            '<td><button class="pt-mini" data-close="' + s + '">Sell all</button></td></tr>';
        }).join('') + '</tbody></table>' : '';
      if (acct.options.length) {
        h += '<div class="pt-subhead">Options ' + modeTag() + ' <small>modeled prices</small></div><table class="pt-table"><thead><tr><th>Contract</th><th>Qty</th><th>Avg</th><th>Mark</th><th>Value</th><th>P&amp;L</th><th>Expires</th><th></th></tr></thead><tbody>' +
          acct.options.map(function (o) {
            var m = optionMark(o), pl = (m - o.avg) * 100 * o.qty;
            return '<tr><td><button class="pt-link" data-optsym="' + o.id + '">' + esc(OPT.label(o)) + '</button></td><td>' + o.qty + '</td><td>' + o.avg.toFixed(2) + '</td><td>' + m.toFixed(2) + '</td><td>' + money(m * 100 * o.qty) + '</td>' +
              '<td class="' + (pl >= 0 ? 'up' : 'dn') + '">' + signed(pl) + '</td><td>' + o.exp + ' (' + OPT.daysTo(o.exp, today) + 'd)</td><td><button class="pt-mini" data-optclose="' + o.id + '">Close</button></td></tr>';
          }).join('') + '</tbody></table>';
      }
      if (!h) h = '<p class="pt-empty">No positions yet. Pick a stock on the left and place your first order.</p>';
    } else if (tab === 'orders') {
      var open = acct.orders.filter(function (o) { return o.status === 'open'; });
      h = open.length ? '<table class="pt-table"><thead><tr><th>Placed</th><th>Symbol</th><th>Side</th><th>Type</th><th>Qty</th><th>Price</th><th>Time in force</th><th></th></tr></thead><tbody>' +
        open.slice().reverse().map(function (o) {
          return '<tr><td>' + new Date(o.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + '</td><td><button class="pt-link" data-sym="' + o.sym + '">' + o.sym + '</button></td>' +
            '<td class="' + (o.side === 'buy' ? 'up' : 'dn') + '">' + o.side.toUpperCase() + '</td><td>' + (o.role === 'tp' ? 'take profit' : o.role === 'sl' ? 'stop loss' : o.type) + '</td><td>' + o.qty + '</td>' +
            '<td>' + (o.type === 'market' ? 'market' : fmt(o.limit || o.stop)) + '</td><td>' + (o.tif === 'gtc' ? 'Good til cancelled' : 'Day (' + o.session + ')') + '</td>' +
            '<td><button class="pt-mini" data-cancel="' + o.id + '">Cancel</button></td></tr>';
        }).join('') + '</tbody></table>' : '<p class="pt-empty">No open orders.</p>';
    } else if (tab === 'history') {
      var tr = acct.trades.slice(-150).reverse();
      h = tr.length ? '<table class="pt-table"><thead><tr><th>Closed</th><th>Type</th><th>Position</th><th>Qty</th><th>Entry</th><th>Exit</th><th>Invested</th><th>P&amp;L</th><th>%</th></tr></thead><tbody>' +
        tr.map(function (t) {
          return '<tr><td>' + (t.closeDay || '') + (t.epoch !== acct.epoch ? ' <small>(before reset)</small>' : '') + '</td><td>' + modeTag() + '</td><td>' + esc(t.label) + (t.note ? ' <small>· ' + esc(t.note) + '</small>' : '') + '</td><td>' + t.qty + '</td><td>' + fmt(t.entry) + '</td><td>' + fmt(t.exit) + '</td><td>' + money(t.invested) + '</td>' +
            '<td class="' + (t.pnl >= 0 ? 'up' : 'dn') + '">' + signed(t.pnl) + '</td><td class="' + (t.pct >= 0 ? 'up' : 'dn') + '">' + pct(t.pct) + '</td></tr>';
        }).join('') + '</tbody></table>' : '<p class="pt-empty">Closed trades show up here with entry, exit and P&amp;L.</p>';
      var done = acct.orders.filter(function (o) { return o.status !== 'open' && o.status !== 'filled'; }).slice(-20).reverse();
      if (done.length) h += '<div class="pt-subhead">Cancelled &amp; expired orders</div><table class="pt-table"><tbody>' + done.map(function (o) {
        return '<tr><td>' + o.createdDay + '</td><td>' + o.sym + '</td><td>' + o.side + ' ' + o.type + ' ' + o.qty + '</td><td>' + o.status + (o.note ? ' <small>· ' + esc(o.note) + '</small>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>';
    } else if (tab === 'agents') {
      h = renderAgents();
    } else if (tab === 'alerts') {
      var al = ALERTS.list.slice().sort(function (a, b) { return (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) || b.createdAt - a.createdAt; });
      h = '<div class="pt-subhead">Price alerts ' + modeTag() + '</div>' + (al.length ? '<table class="pt-table"><thead><tr><th>Stock</th><th>Alert when price is</th><th>Now</th><th>Status</th><th></th></tr></thead><tbody>' +
        al.map(function (a) {
          return '<tr><td><button class="pt-link" data-sym="' + esc(a.sym) + '">' + esc(a.sym) + '</button></td><td>' + (a.dir === 'above' ? 'at or above' : 'at or below') + ' <b>$' + fmt(a.price) + '</b></td><td>' + (price(a.sym) != null ? fmt(price(a.sym)) : '–') + '</td>' +
            '<td>' + (a.status === 'active' ? '<span class="pt-pill">Active</span>' : '<span class="pt-pill is-done">Triggered ' + (a.triggeredAt ? new Date(a.triggeredAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '') + '</span>') + '</td>' +
            '<td><button class="pt-mini" data-alert-edit="' + a.id + '">Edit</button> <button class="pt-mini" data-alert-del="' + a.id + '">Delete</button></td></tr>';
        }).join('') + '</tbody></table>' : '<p class="pt-empty">No price alerts yet. Press <b>&#9200; Alert</b> above the chart, then click the price you want to watch. You can drag an alert line to move it.</p>') +
        '<p class="pt-fine">Trade War alerts pop up while a Trade War page is open (turn on <b>Alerts</b> for browser notifications). They follow you between your Main account and your Trade Wars.</p>';
    } else if (tab === 'progress') {
      h = renderProgress();
    } else {
      var st = stats(), eq = equity(), days = Object.keys(acct.equityDays).sort();
      h = '<div class="pt-perf">' +
        '<span><small>Account value</small><b>' + money(eq) + '</b></span>' +
        '<span><small>Growth this account</small><b class="' + (eq >= START_CASH ? 'up' : 'dn') + '">' + pct((eq / START_CASH - 1) * 100) + '</b></span>' +
        '<span><small>Realized P&amp;L</small><b class="' + (acct.realized >= 0 ? 'up' : 'dn') + '">' + signed(acct.realized) + '</b></span>' +
        '<span><small>Closed trades</small><b>' + st.trades + '</b></span>' +
        '<span><small>Win rate</small><b>' + (st.trades ? st.winRate + '%' : '–') + '</b></span>' +
        '<span><small>Wins / losses</small><b>' + st.wins + ' / ' + st.losses + '</b></span>' +
        '<span><small>Peak value</small><b>' + money(acct.peakEquity || START_CASH) + '</b></span>' +
        '<span><small>Resets</small><b>' + acct.resets + '</b></span></div>' +
        (days.length > 1 ? '<canvas class="pt-curve" id="ptCurve"></canvas>' : '<p class="pt-empty">Your account-value curve fills in as the days go by.</p>') +
        '<div class="pt-perf-foot">' +
        '<label class="pt-check"><input type="checkbox" id="ptPublic"' + (acct.publicProfile !== false ? ' checked' : '') + '> Show my stats on the leaderboard' + (currentUser ? '' : ' <small>(sign in to appear)</small>') + '</label>' +
        (currentUser && acct.publicProfile !== false ? '<a class="pt-mini" href="profile.html?u=' + encodeURIComponent(currentUser.uid) + '">View my public profile &rarr;</a>' : '') +
        '<button class="pt-mini pt-soc" type="button" data-act="share">Share my account</button><button class="pt-mini pt-soc" type="button" data-act="challenge">Challenge a friend</button>' +
        (eq < RESET_BELOW ? '<button class="pt-reset" id="ptReset" type="button">Reset account to $10,000</button>' : '<span class="pt-fine">Reset unlocks if the account falls below ' + money(RESET_BELOW, 0) + '.</span>') + '</div>' +
        (acct.resetHistory.length ? '<div class="pt-subhead">Reset history</div><table class="pt-table"><tbody>' + acct.resetHistory.slice().reverse().map(function (r, k) {
          return '<tr><td>#' + (acct.resetHistory.length - k) + '</td><td>' + r.day + '</td><td>Account was at ' + money(r.equityBefore) + '</td></tr>';
        }).join('') + '</tbody></table>' : '');
    }
    $('ptTabBody').innerHTML = h;
    if (tab === 'performance') {
      drawCurve();
      var r = $('ptReset'); if (r) r.addEventListener('click', askReset);
      $('ptPublic').addEventListener('change', function () { acct.publicProfile = this.checked; save(); renderTabs(); toast(this.checked ? 'Your stats will show on the leaderboard.' : 'Your stats are private now and removed from the leaderboard.'); });
    }
  }
  // ------------------------------------------------------------ progress tab: level, missions, achievements, invites
  function renderProgress() {
    var xp = xpNow || 0, lv = levelOf(xp), L = window.ZelosLevels, nx = L ? L.nextLevelForXp(xp) : null;
    var pctLv = lv && nx ? Math.max(0, Math.min(100, (xp - lv.xp) / (nx.xp - lv.xp) * 100)) : 100;
    var m = PROG ? PROG.missions() : null, un = PROG ? PROG.unlocked() : {};
    var h = '<div class="pt-prog"><section class="pt-prog-card pt-lvl-card">' + (L && lv ? L.badge(lv, 64) : '') +
      '<div class="pt-lvl-main"><small>Level ' + (lv ? lv.level : 0) + (lv ? ' · ' + esc(lv.title) : '') + '</small><b>' + (lv ? esc(lv.name) : 'Getting started') + '</b>' +
      '<div class="pt-xpbar"><i style="width:' + pctLv.toFixed(1) + '%"></i></div>' +
      '<span>' + xp.toLocaleString('en-US') + ' XP' + (nx ? ' · ' + (nx.xp - xp).toLocaleString('en-US') + ' to Level ' + nx.level + ' (' + esc(nx.name) + ')' : ' · top level') + '</span></div>' +
      (m ? '<div class="pt-streak"><b>🔥 ' + m.streak.days + '</b><small>day streak</small><span>Best ' + m.streak.best + '</span></div>' : '') + '</section>';
    if (xpNow == null) h += '<p class="pt-fine">XP is loading. Every trade, win, mission and achievement earns XP, even as a guest; sign in to keep it on every device.</p>';
    if (m) {
      var row = function (x) {
        return '<li class="' + (x.done ? 'is-done' : '') + '"><span class="pt-mcheck">' + (x.done ? '&#10003;' : '') + '</span><span class="pt-mlabel">' + esc(x.label) +
          (x.hint && !x.done ? '<small>' + esc(x.hint) + '</small>' : '') + '</span><span class="pt-mprog">' + x.count + '/' + x.goal + '</span><em>+' + x.xp + '</em></li>';
      };
      h += '<div class="pt-prog-cols"><section class="pt-prog-card"><h3>Daily missions <small>' + m.streak.doneToday + ' done · ' + m.streak.need + ' keep your streak</small></h3><ul class="pt-missions">' + m.daily.map(row).join('') + '</ul></section>' +
        '<section class="pt-prog-card"><h3>Weekly missions</h3><ul class="pt-missions">' + m.weekly.map(row).join('') + '</ul>' +
        '<p class="pt-fine">Streak rewards: 3 days +25 XP · 7 days +75 · 14 days +150 · 30 days +300.</p></section></div>';
    }
    if (PROG) {
      var groups = {}; PROG.ACHIEVEMENTS.forEach(function (a) { (groups[a.group] = groups[a.group] || []).push(a); });
      var got = Object.keys(un).length;
      h += '<section class="pt-prog-card"><h3>Achievements <small>' + got + ' of ' + PROG.ACHIEVEMENTS.length + '</small></h3>' + Object.keys(groups).map(function (g) {
        return '<div class="pt-subhead">' + esc(g) + '</div><div class="pt-achs">' + groups[g].map(function (a) {
          return '<div class="pt-ach' + (un[a.id] ? ' is-on' : '') + '">' + PROG.badge(a.id, 40, !un[a.id]) + '<span><b>' + esc(a.label) + '</b><small>' + esc(a.desc) + '</small></span><em>+' + a.xp + '</em></div>';
        }).join('') + '</div>';
      }).join('') + '</section>';
    }
    var S = window.ZelosSocial;
    h += '<section class="pt-prog-card"><h3>Invite friends</h3>';
    if (currentUser && S) {
      var tier = S.referralTier(referralCount), nt = S.nextTier(referralCount);
      h += '<p class="pt-fine">When a friend joins Trade War from your link, you both get <b>+50 XP</b>. ' + referralCount + ' friend' + (referralCount === 1 ? '' : 's') + ' joined so far' +
        (tier ? ' · ' + tier.icon + ' <b>' + tier.name + '</b>' : '') + (nt ? ' · ' + (nt - referralCount) + ' more for ' + (S.referralTier(nt).name) : '') + '.</p>' +
        '<div class="pt-invite"><input readonly id="ptInvite" value="' + esc(S.links(currentUser.uid).invite()) + '"><button class="pt-mini" type="button" data-act="invite">Copy link</button></div>';
    } else h += '<p class="pt-fine">Sign in with Google to get your invite link. Bronze at 1 friend, Silver at 3, Gold at 10, Diamond at 25.</p><button class="pt-mini" type="button" data-act="signin">Sign in</button>';
    h += '<div class="pt-soc-row"><button class="pt-mini pt-soc" type="button" data-act="share">Share my account</button><button class="pt-mini pt-soc" type="button" data-act="challenge">Challenge a friend</button>' +
      '<a class="pt-mini" href="squads.html">Trading Squads &rarr;</a><a class="pt-mini" href="../leaderboard.html#practice">Leaderboards &rarr;</a></div></section></div>';
    return h;
  }
  function needSignIn(why) { toast(why || 'Sign in with Google first.', true); $('ptGate').hidden = false; renderGate(); }
  function shareAccount() {
    var S = window.ZelosSocial; if (!S) return;
    var st = stats(), lv = levelOf(xpNow || 0), best = st.best[0];
    var url = currentUser ? S.links(currentUser.uid).profile() + '&ref=' + encodeURIComponent(currentUser.uid) : 'https://agentictrading.info/practice/';
    var eq = equity();
    S.shareCard({ name: playerName(), equity: eq, headline: eq >= START_CASH ? 'I grew my $10,000 Trade War account to' : 'My $10,000 Trade War account is at',
      cta: 'Can you beat me? Take me on in Trade War', level: lv ? 'Lv ' + lv.level + ' ' + lv.name : null, xp: xpNow, winRate: st.trades ? st.winRate : null,
      best: best ? '+$' + Math.round(best.pnl).toLocaleString('en-US') + ' ' + best.sym : null }, url).then(function (r) {
      if (r === 'downloaded') toast('Card saved as an image and your link is copied. Paste both into a text, Discord or social post.');
    });
  }
  function challengeFriend() {
    // Old net-P&L challenges were retired: challenging a friend starts a Trade War match now.
    if (!currentUser) return needSignIn('Sign in to challenge a friend to a Trade War.');
    if (window.ZelosChallenge) ZelosChallenge.open({});
  }
  function drawCurve() {
    var cv = $('ptCurve'); if (!cv) return;
    var days = Object.keys(acct.equityDays).sort(), vals = days.map(function (d) { return acct.equityDays[d]; });
    var dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr;
    var c = cv.getContext('2d'); c.scale(dpr, dpr);
    var lo = Math.min.apply(null, vals.concat([START_CASH])), hi = Math.max.apply(null, vals.concat([START_CASH])), pad = (hi - lo) * 0.1 || 50;
    lo -= pad; hi += pad;
    var X = function (i) { return 8 + i / (vals.length - 1) * (W - 16); }, Y = function (v) { return 8 + (hi - v) / (hi - lo) * (H - 16); };
    var col = vals[vals.length - 1] >= START_CASH ? '#3ecb7c' : '#e0483f';
    c.strokeStyle = 'rgba(127,127,127,0.4)'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(8, Y(START_CASH)); c.lineTo(W - 8, Y(START_CASH)); c.stroke(); c.setLineDash([]);
    c.beginPath(); vals.forEach(function (v, i) { if (i) c.lineTo(X(i), Y(v)); else c.moveTo(X(i), Y(v)); });
    c.strokeStyle = col; c.lineWidth = 2; c.stroke();
    c.lineTo(X(vals.length - 1), H - 8); c.lineTo(X(0), H - 8); c.closePath(); c.globalAlpha = 0.12; c.fillStyle = col; c.fill(); c.globalAlpha = 1;
  }

  // ------------------------------------------------------------ stats + public profile
  function stats() {
    var t = acct.trades, wins = t.filter(function (x) { return x.pnl > 0; }), losses = t.filter(function (x) { return x.pnl < 0; });
    var bySym = {}, cnt = {};
    t.forEach(function (x) { bySym[x.sym] = (bySym[x.sym] || 0) + x.pnl; cnt[x.sym] = (cnt[x.sym] || 0) + 1; });
    return {
      trades: t.length, wins: wins.length, losses: losses.length, winRate: t.length ? Math.round(wins.length / t.length * 100) : 0,
      avgWin: wins.length ? wins.reduce(function (a, x) { return a + x.pnl; }, 0) / wins.length : 0,
      avgLoss: losses.length ? losses.reduce(function (a, x) { return a + x.pnl; }, 0) / losses.length : 0,
      best: wins.slice().sort(function (a, b) { return b.pnl - a.pnl; }).slice(0, 10),
      topStocks: Object.keys(bySym).map(function (s) { return { sym: s, pnl: round2(bySym[s]) }; }).filter(function (x) { return x.pnl > 0; }).sort(function (a, b) { return b.pnl - a.pnl; }).slice(0, 5),
      mostTraded: Object.keys(cnt).map(function (s) { return { sym: s, trades: cnt[s], pnl: round2(bySym[s] || 0) }; }).sort(function (a, b) { return b.trades - a.trades; }).slice(0, 5)
    };
  }
  function playerName() {
    if (currentUser && profile.name) return profile.name;
    if (acct && acct.displayName) return acct.displayName;
    if (currentUser && currentUser.displayName) return currentUser.displayName.split(' ')[0];
    if (currentUser) return 'Trader-' + currentUser.uid.slice(0, 4);
    return 'Guest';
  }
  // Public, leaderboard-facing numbers only. Never email, login or order details.
  function publishProfile() {
    if (!currentUser || !db) return;
    var ref = db.collection('practiceProfiles').doc(currentUser.uid);
    if (acct.publicProfile === false) { ref.delete().catch(function () {}); return; }
    var st = stats(), eq = equity(), lv = window.ZelosLevels && xpNow != null ? ZelosLevels.levelForXp(xpNow) : null;
    ref.set({
      name: String(playerName()).slice(0, 24), equity: round2(eq), start: START_CASH, growthPct: round2((eq / START_CASH - 1) * 100),
      peakEquity: round2(acct.peakEquity || eq), resets: acct.resets || 0,
      resetHistory: acct.resetHistory.slice(-20).map(function (r) { return { day: r.day, equityBefore: r.equityBefore }; }),
      trades: st.trades, wins: st.wins, losses: st.losses, winRate: st.winRate, avgWin: round2(st.avgWin), avgLoss: round2(st.avgLoss),
      realized: round2(acct.realized),
      bestTrades: st.best.map(function (x) { return { sym: x.sym, label: x.label, kind: x.kind, qty: x.qty, invested: round2(x.invested), pnl: round2(x.pnl), pct: round2(x.pct), entry: round2(x.entry), exit: round2(x.exit), openDay: x.openDay || null, closeDay: x.closeDay || null }; }),
      topStocks: st.topStocks, since: acct.createdAt, updatedAt: Date.now(),
      // progression + social (see zelos-progress.js / zelos-social.js)
      mode: MODE, photo: profile.avatar || (currentUser.photoURL && /^https:/.test(currentUser.photoURL) ? currentUser.photoURL : null),
      username: profile.username || null,
      virtualTrades: acct.life.fills || 0, tradeStreak: tradeStreakNow(), bestTradeStreak: acct.life.bestTradeStreak || 0,
      netPnl: round2(netPnl()), xp: xpNow || 0, level: lv ? lv.level : 0, levelName: lv ? lv.name : '', streak: PROG ? PROG.streak() : 0,
      achievements: PROG ? Object.keys(PROG.unlocked()) : [], referrals: referralCount, winStreakBest: winStreakBest(acct.trades),
      mostTraded: st.mostTraded, recovering: acct.recovery ? { low: acct.recovery.low, since: acct.recovery.since } : null,
      p: periodStats(), h: acct.hist
    }).catch(function () {});
  }

  // ------------------------------------------------------------ reset
  function askReset() {
    if (equity() >= RESET_BELOW) return toast('Reset unlocks once the account is below ' + money(RESET_BELOW, 0) + '.', true);
    $('ptModalTitle').textContent = 'Reset your Trade War account?';
    $('ptModalText').innerHTML = 'Your account goes back to <b>$10,000</b>: open positions, options and orders are cleared. Your trade history stays, and this counts as <b>reset #' + (acct.resets + 1) + '</b> on your public stats.';
    $('ptModalGo').textContent = 'Reset to $10,000';
    $('ptModalGo').disabled = false; $('ptConfirm').hidden = false; $('ptModalGo').focus();
    $('ptModalGo').onclick = function () {
      $('ptConfirm').hidden = true;
      acct.resetHistory.push({ at: Date.now(), day: todayNY(), equityBefore: round2(equity()) });
      acct.resets += 1; acct.epoch += 1; acct.epochStartedAt = Date.now();
      acct.cash = START_CASH; acct.positions = {}; acct.options = []; acct.equityDays = {}; acct.peakEquity = START_CASH; acct.realized = 0; acct.recovery = null;
      acct.orders.forEach(function (o) { if (o.status === 'open') { o.status = 'cancelled'; o.note = 'Account reset'; } });
      save(); renderAll(); toast('Account reset to $10,000. Reset #' + acct.resets + ' recorded.');
    };
  }

  // ------------------------------------------------------------ agent signals
  var AGENTS = { 'swing-trader': 'Swing Trader', 'breakout-rider': 'Breakout Rider', 'options-scanner': 'Options Scanner' };
  function loadAgents() {
    if (!db) { agentAlerts = []; return; }
    try { var q = db.collection('alerts').orderBy('createdAt', 'desc').limit(40); } catch (e) { agentAlerts = []; return; }
    q.get().then(function (snap) {
      var latest = {};
      // a live (token-locked) alert has no ticker yet, so it's skipped until the close
      snap.forEach(function (d) { var a = d.data(); a.id = d.id; if (AGENTS[a.strategy] && !latest[a.strategy] && a.status === 'qualified' && a.ticker) latest[a.strategy] = a; });
      agentAlerts = Object.keys(AGENTS).map(function (k) { return latest[k] || { strategy: k, none: true }; });
      if (tab === 'agents') renderTabs();
    }).catch(function () { agentAlerts = []; if (tab === 'agents') renderTabs(); });
  }
  function renderAgents() {
    if (!agentAlerts) { loadAgents(); if (!agentAlerts) return '<p class="pt-empty">Loading the latest agent signals…</p>'; }
    if (!agentAlerts.length) return '<p class="pt-empty">Agent signals load from the live alert feed. They\'re not reachable right now.</p>';
    return '<p class="pt-fine" style="margin-bottom:10px">Test a Zelos agent in Trade War with virtual money: each card is that agent\'s latest qualified setup. <b>Trade it in Trade War</b> loads it into your ticket with its stop and target; you still review and place the order.</p><div class="pt-agents">' +
      agentAlerts.map(function (a) {
        var name = AGENTS[a.strategy], own = !!(window.ZelosTokens && ZelosTokens.hasAccess(a.strategy, a.id)); // an active scanner pass
        var badge = '<span class="pt-abadge' + (own ? ' is-own' : '') + '">' + (own ? 'Your pass' : 'Preview') + '</span>';
        if (a.none) return '<div class="pt-agent"><div class="pt-ahead"><b>' + name + '</b>' + badge + '</div><p class="pt-fine">No qualified setup in the latest scans.</p></div>';
        var inU = !!NAMES[a.ticker], isOpt = a.strategy === 'options-scanner';
        var rr = a.entry && a.stop && a.target1 ? Math.abs(a.target1 - a.entry) / Math.abs(a.entry - a.stop) : null;
        return '<div class="pt-agent"><div class="pt-ahead"><b>' + name + '</b>' + badge + '</div>' +
          '<div class="pt-aticker">' + esc(a.ticker) + ' <small>' + esc(a.setupLabel || a.direction || '') + '</small></div>' +
          (a.entry ? '<div class="pt-alevels"><span>Entry <b>' + fmt(a.entry) + '</b></span><span>Stop <b>' + fmt(a.stop) + '</b></span><span>Target <b>' + fmt(a.target1) + '</b></span>' + (rr ? '<span>R:R <b>' + rr.toFixed(1) + '</b></span>' : '') + '</div>' : '') +
          (isOpt && a.optionsRule ? '<p class="pt-fine">' + esc(a.optionsRule) + '</p>' : '') +
          (inU ? '<button class="pt-mini pt-abtn" data-agent="' + a.strategy + '">' + (isOpt ? 'Open in options &rarr;' : 'Trade it in Trade War &rarr;') + '</button>'
            : '<p class="pt-fine">' + esc(a.ticker) + ' isn\'t in the practice stock list yet.</p>') +
          (own ? '' : '<a class="pt-fine pt-alink" href="../arsenal.html">Get the ' + name + ' agent</a>') + '</div>';
      }).join('') + '</div>';
  }
  // practice/index.html?alert=<id>&side=buy|sell (the Buy / Sell buttons on an alert page):
  // load that alert into the Trade War ticket. Virtual money only; you still review and place it.
  function fromAlertLink() {
    var q; try { q = new URLSearchParams(location.search); } catch (e) { return; }
    var id = q.get('alert'), want = q.get('side') === 'sell' ? 'sell' : 'buy';
    if (!id || !db || !/^[a-z-]+-\d{4}-\d{2}-\d{2}$/.test(id)) return;
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
    db.collection('alerts').doc(id).get().then(function (s) {
      if (!s.exists) return null;
      var a = Object.assign({ id: id }, s.data());
      if (a.ticker) return a;
      return new Promise(function (res) { var un = firebase.auth().onAuthStateChanged(function () { un(); res(); }); })
        .then(function () { return window.ZelosTokens ? ZelosTokens.full(a, id) : null; });
    }).then(function (a) {
      if (!a || !a.ticker) return toast('Unlock this alert first, then you can trade it in Trade War.', true);
      if (!NAMES[a.ticker]) return toast(esc(a.ticker) + ' isn\'t in the Trade War stock list yet.', true);
      agentAlerts = (agentAlerts || []).filter(function (x) { return x.strategy !== a.strategy; }).concat([a]);
      if (want === 'sell') {
        selectSymbol(a.ticker); ticket.mode = 'stock'; side = 'sell'; ticket.type = 'market';
        var r = document.querySelector('[name="ptType"][value="market"]'); if (r) r.checked = true;
        renderAll(); toast('Loaded a sell of ' + esc(a.ticker) + ' in your Trade War account. Set how many shares and review it.');
      } else useAgent(a.strategy);
      var t = document.querySelector('.pt-ticket-col'); if (t && t.scrollIntoView) t.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }).catch(function () { toast('Couldn\'t load that alert.', true); });
  }
  function useAgent(strategy) {
    var a = (agentAlerts || []).filter(function (x) { return x.strategy === strategy; })[0]; if (!a || !NAMES[a.ticker]) return;
    selectSymbol(a.ticker);
    if (strategy === 'options-scanner') {
      ticket.mode = 'options'; opt.type = /put/.test(a.direction || '') ? 'put' : 'call';
      var today = todayNY(), exps = OPT.expirations(today);
      opt.exp = exps.filter(function (e) { var d = OPT.daysTo(e, today); return d >= 30 && d <= 45; })[0] || exps.filter(function (e) { return OPT.daysTo(e, today) >= 21; })[0];
      var S = price(a.ticker), ks = OPT.strikes(S, 17);
      var otm = opt.type === 'call' ? ks.filter(function (k) { return k > S; })[0] : ks.filter(function (k) { return k < S; }).pop();
      opt.pick = { strike: otm, exp: opt.exp, type: opt.type }; opt.agent = strategy;
      renderAll(); toast('Loaded the Options Scanner idea: 1 strike out of the money, 30–45 days. Review it in the ticket.');
    } else {
      ticket.mode = 'stock'; side = 'buy'; acct.fullPort = false;
      var px = price(a.ticker);
      ticket.type = a.entry && Math.abs(a.entry - px) / px > 0.01 ? 'limit' : 'market';
      document.querySelector('[name="ptType"][value="' + ticket.type + '"]').checked = true;
      $('ptLimit').value = fmt(a.entry || px);
      $('ptUseBracket').checked = true; $('ptBracketFields').hidden = false;
      $('ptSL').value = a.stop ? fmt(a.stop) : ''; $('ptTP').value = a.target1 ? fmt(a.target1) : '';
      ticket.agent = strategy;
      forecastOn = true; syncForecastChip();
      renderAll(); toast('Loaded the ' + AGENTS[strategy] + ' setup on ' + a.ticker + ' with its stop and target. Set a size and review.');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ------------------------------------------------------------ misc UI
  function selectSymbol(sym) {
    if (sym === sel) return renderAll();
    sel = sym;
    if (PROG) PROG.track('analyze', sym);
    buildSeries(sym);
    var p = price(sym);
    $('ptLimit').value = p ? fmt(p) : ''; $('ptStopPx').value = p ? fmt(p) : '';
    if ($('ptUseBracket').checked && p) { $('ptSL').value = fmt(p * 0.95); $('ptTP').value = fmt(p * 1.10); }
    else { $('ptSL').value = ''; $('ptTP').value = ''; }
    opt.pick = null; opt.agent = null; ticket.agent = null;
    watchIntraday();
    renderAll();
  }
  function renderAll() { renderHeader(); renderWatch(); renderQuote(); renderTicket(); renderTabs(); }
  function toast(t, bad) {
    var el = document.createElement('div'); el.className = 'pt-toast' + (bad ? ' is-bad' : ''); el.innerHTML = t;
    document.body.appendChild(el); setTimeout(function () { el.classList.add('is-out'); }, 3600); setTimeout(function () { el.remove(); }, 4100);
  }
  function syncForecastChip() { var b = $('ptForecast'); b.classList.toggle('is-on', forecastOn); b.setAttribute('aria-pressed', String(forecastOn)); }
  function renderTfMenu() {
    $('ptTfBtn').innerHTML = TF[tf].short + ' <span class="pt-caret">&#9662;</span>';
    $('ptTfMenu').innerHTML = Object.keys(TF).map(function (k) { return '<button type="button" role="menuitemradio" aria-checked="' + (k === tf) + '" data-tf="' + k + '"' + (k === tf ? ' class="is-on"' : '') + '><b>' + TF[k].short + '</b>' + TF[k].label + (TF[k].intraday ? '<small>live feed</small>' : '') + '</button>'; }).join('');
    var def = rangeSel || TF[tf].def;
    $('ptRanges').innerHTML = TF[tf].ranges.map(function (r) { return '<button class="' + (String(r[1]) === String(def) ? 'is-on' : '') + '" type="button" data-range="' + r[1] + '">' + r[0] + '</button>'; }).join('');
  }
  function renderIndMenu() {
    var groups = {};
    TC.INDICATORS.forEach(function (d) { (groups[d.group] = groups[d.group] || []).push(d); });
    $('ptIndMenu').innerHTML = Object.keys(groups).map(function (g) {
      return '<div class="pt-menu-group">' + esc(g) + '</div>' + groups[g].map(function (d) {
        return '<label class="pt-menu-check"><input type="checkbox" data-ind="' + d.id + '"' + (chart.show[d.id] ? ' checked' : '') + '> ' + esc(d.label) + '</label>';
      }).join('');
    }).join('') + '<small>Up to 3 indicator panels show at once.</small>';
    var n = TC.INDICATORS.filter(function (d) { return chart.show[d.id]; }).length;
    $('ptIndBtn').innerHTML = 'Indicators' + (n ? ' <em>' + n + '</em>' : '') + ' <span class="pt-caret">&#9662;</span>';
  }
  function menu(btnId, menuId) {
    var btn = $(btnId), m = $(menuId);
    btn.addEventListener('click', function (e) { e.stopPropagation(); var open = m.hidden; document.querySelectorAll('.pt-menu').forEach(function (x) { x.hidden = true; }); m.hidden = !open; btn.setAttribute('aria-expanded', String(open)); });
    m.addEventListener('click', function (e) { e.stopPropagation(); });
  }

  // ------------------------------------------------------------ placing stock orders
  function review() {
    var q = orderQty(), px = price(sel);
    if (!q) return toast('Enter how many shares (or dollars) first.', true);
    var o = { sym: sel, side: side, type: ticket.type, qty: q, tif: $('ptTif').value, fullPort: !!acct.fullPort, agent: ticket.agent || null };
    if (o.type === 'limit') { o.limit = +(+$('ptLimit').value).toFixed(2); if (!(o.limit > 0)) return toast('Enter a limit price.', true); }
    if (o.type === 'stop') { o.stop = +(+$('ptStopPx').value).toFixed(2); if (!(o.stop > 0)) return toast('Enter a stop price.', true); }
    if (o.type === 'market') o.tif = 'day';
    if (isCrypto(sel)) o.tif = 'gtc'; // crypto never closes, so there's no "day" to expire at
    if (side === 'buy') {
      var cost = q * (o.limit || o.stop || px);
      if (cost > buyingPower() + 0.005) return toast('Not enough buying power: that\'s ' + money(cost) + ', you have ' + money(buyingPower()) + '.', true);
      var sl = +$('ptSL').value, tp = +$('ptTP').value, ref = o.limit || o.stop || px;
      if ($('ptUseBracket').checked) {
        if (sl && sl >= ref) return toast('Your stop-loss has to be below the buy price.', true);
        if (tp && tp <= ref) return toast('Your take-profit has to be above the buy price.', true);
        if (sl || tp) o.bracket = { sl: sl ? +sl.toFixed(2) : null, tp: tp ? +tp.toFixed(2) : null };
      }
    } else {
      var pos = acct.positions[sel], have = pos ? pos.qty - reservedShares(sel) : 0;
      if (q > have + 1e-9) return toast(have ? 'You can only sell ' + qtyStr(have) + (isCrypto(sel) ? ' ' : ' share' + (have === 1 ? '' : 's') + ' of ') + sel + '.' : 'You don\'t have any ' + sel + ' to sell.', true);
    }
    var desc = (o.fullPort ? 'FULL PORT · ' : '') + (side === 'buy' ? 'Buy ' : 'Sell ') + qtyStr(q) + ' ' + sel + ' · ' + (o.type === 'market' ? 'market order' : o.type + ' @ ' + pfmt(o.limit || o.stop)) +
      (o.bracket ? ' · stop-loss ' + (o.bracket.sl ? fmt(o.bracket.sl) : 'none') + ', take-profit ' + (o.bracket.tp ? fmt(o.bracket.tp) : 'none') : '');
    $('ptModalTitle').textContent = 'Confirm order';
    $('ptModalText').innerHTML = '<b>' + esc(desc) + '</b><br>' + esc($('ptWhen').textContent) + (side === 'buy' ? '<br>Estimated ' + money(q * (o.limit || o.stop || px)) + ' of your ' + money(buyingPower()) + ' buying power.' : '');
    $('ptModalGo').textContent = side === 'buy' ? 'Place buy order' : 'Place sell order';
    $('ptModalGo').disabled = false; $('ptConfirm').hidden = false; $('ptModalGo').focus();
    $('ptModalGo').onclick = function () { $('ptConfirm').hidden = true; place(o); };
  }
  function place(f) {
    var o = newOrder(f);
    acct.orders.push(o);
    if (o.type === 'market' && symOpen(o.sym)) fill(o, price(o.sym), todayNY());
    else processOrders();
    save(); renderAll();
    if (o.status === 'filled') toast((o.side === 'buy' ? 'Bought ' : 'Sold ') + qtyStr(o.qty) + ' ' + o.sym + ' @ ' + pfmt(o.fillPrice));
    else if (o.status === 'open') toast('Order placed: ' + o.side + ' ' + qtyStr(o.qty) + ' ' + o.sym + (o.type === 'market' ? ' at the next open' : ' ' + o.type + ' @ ' + pfmt(o.limit || o.stop)));
    else toast('Order ' + o.status + (o.note ? ': ' + esc(o.note) : ''), true);
    $('ptQty').value = ''; ticket.agent = null;
    renderTicket();
  }
  function snapshotEquity() {
    var today = todayNY(), eq = equity(), n = round2(netPnl());
    acct.equityDays[today] = round2(eq);
    acct.valueHist = acct.valueHist || {};
    if (!acct.valueHist.seeded) {
      Object.keys(acct.hist || {}).forEach(function (k) { var dd = k.slice(1, 5) + '-' + k.slice(5, 7) + '-' + k.slice(7, 9); if (acct.hist[k].e != null && acct.valueHist[dd] == null) acct.valueHist[dd] = acct.hist[k].e; });
      Object.keys(acct.equityDays || {}).forEach(function (dd) { if (acct.valueHist[dd] == null) acct.valueHist[dd] = acct.equityDays[dd]; });
      acct.valueHist.seeded = 1;
    }
    acct.valueHist[today] = round2(eq);
    var vk = Object.keys(acct.valueHist).filter(function (k) { return k !== 'seeded'; }).sort();
    if (vk.length > 800) vk.slice(0, vk.length - 800).forEach(function (k) { delete acct.valueHist[k]; });
    var L = acct.life; if (eq > (L.peak || 0)) L.peak = round2(eq);
    // weekly / monthly / season baselines: the first time a period is seen
    if (PROG) {
      var keys = PROG.periodKeys(today), keep = {};
      [keys.w, keys.m, keys.s].forEach(function (k) {
        if (!k) return;
        var b = acct.periods[k] || { net0: n, eq0: round2(eq), xp0: null, at: today };
        if (b.xp0 == null && xpNow != null) b.xp0 = xpNow;
        keep[k] = b;
      });
      acct.periods = keep;
    }
    // end-of-day history (net P&L, XP, value) so challenges and squads can freeze a result at their end date
    acct.hist['d' + today.replace(/-/g, '')] = { n: n, x: xpNow || 0, e: round2(eq) };
    var hk = Object.keys(acct.hist).sort(); if (hk.length > 90) hk.slice(0, hk.length - 90).forEach(function (k) { delete acct.hist[k]; });
    // recovery goals: down 5% or more → work back to $10,000 instead of feeling finished
    var r = acct.recovery;
    if (r && r.epoch !== acct.epoch) r = acct.recovery = null;
    if (!r && eq < START_CASH * 0.95) r = acct.recovery = { low: round2(eq), since: today, epoch: acct.epoch, halfway: false };
    if (r) {
      r.low = round2(Math.min(r.low, eq));
      if (!r.halfway && r.low < START_CASH * 0.95 && eq >= r.low + (START_CASH - r.low) / 2) { r.halfway = true; toast('<b>Halfway back.</b> You\'ve recovered half of what the account lost. Keep going.'); }
      if (eq >= START_CASH) {
        if (r.low <= START_CASH * 0.9) { L.comebacks = (L.comebacks || 0) + 1; toast('<b>Comeback complete!</b> From ' + money(r.low) + ' back to ' + money(START_CASH) + ' without a reset.'); }
        acct.recovery = null;
      }
    }
  }
  // what the achievements check sees
  function achCtx() {
    var L = acct.life, s = PROG && PROG.season(), c = {
      fills: L.fills, wins: acct.trades.filter(function (t) { return t.pnl > 0; }).length, tpExits: L.tpExits, bestWinStreak: winStreakBest(acct.trades),
      symbols: L.symbols.length, optionTrades: L.optionTrades, agentTrades: L.agentTrades, trades: acct.trades.length, peak: L.peak, comebacks: L.comebacks,
      referrals: referralCount, seasonTraded: {}, seasonPct: {}
    };
    if (PROG) PROG.SEASONS.forEach(function (se) {
      c.seasonTraded[se.id] = acct.fills.some(function (f) { return f.day >= se.start && f.day <= se.end; }) || acct.trades.some(function (t) { return t.closeDay >= se.start && t.closeDay <= se.end; });
    });
    if (s && acct.periods[s.id]) { var b = acct.periods[s.id]; c.seasonPct[s.id] = (netPnl() - b.net0) / b.eq0 * 100; }
    return c;
  }
  function checkAch() { if (PROG && UNIVERSE.length) PROG.checkAchievements(achCtx()); }
  // weekly / monthly / season numbers for the public profile and the period leaderboards
  function periodStats() {
    var out = {}, n = netPnl(); if (!PROG) return out;
    var keys = PROG.periodKeys(todayNY());
    Object.keys(acct.periods).forEach(function (k) {
      var b = acct.periods[k], pnl = n - b.net0, row = { pnl: round2(pnl), pct: round2(pnl / (b.eq0 || START_CASH) * 100) };
      if (k === keys.s) {
        var se = PROG.SEASONS.filter(function (x) { return x.id === k; })[0], ts = acct.trades.filter(function (t) { return t.closeDay >= se.start && t.closeDay <= se.end; }), bySym = {};
        ts.forEach(function (t) { bySym[t.sym] = (bySym[t.sym] || 0) + t.pnl; });
        var top = Object.keys(bySym).sort(function (a, b2) { return bySym[b2] - bySym[a]; })[0];
        row.xp = xpNow != null && b.xp0 != null ? xpNow - b.xp0 : 0;
        row.bestWin = round2(Math.max(0, Math.max.apply(null, ts.map(function (t) { return t.pnl; }).concat([0]))));
        row.bestPct = round2(Math.max(0, Math.max.apply(null, ts.filter(function (t) { return t.pnl > 0; }).map(function (t) { return t.pct; }).concat([0]))));
        row.winStreak = winStreakBest(ts);
        row.topStock = top && bySym[top] > 0 ? top : null; row.topStockPnl = top && bySym[top] > 0 ? round2(bySym[top]) : 0;
        row.trades = ts.length;
      }
      out[k] = row;
    });
    return out;
  }

  // ------------------------------------------------------------ entry gate
  function showGate() {
    $('ptGate').hidden = true; return; // the Trade War home opens straight into your account now
    var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {};
    var entered = false; try { entered = sessionStorage.getItem('zelosPracticeEntered') === '1'; } catch (e) {}
    if (entered || nav.type === 'reload' || nav.type === 'back_forward') { $('ptGate').hidden = true; return; }
    $('ptGate').hidden = false;
    renderGate();
    setTimeout(function () { try { $('ptGateEnter').focus(); } catch (e) {} }, 50);
  }
  function renderGate() {
    if ($('ptGate').hidden) return;
    $('ptGateName').textContent = playerName();
    $('ptGateWho').textContent = currentUser ? 'Signed in · your account is saved and follows you to any device' : 'Guest · saved in this browser only';
    $('ptGateGoogle').hidden = !!currentUser || !window.firebase;
    $('ptGateRename').hidden = !currentUser;
    var eq = equity();
    $('ptGateBal').textContent = money(eq);
  }

  // ------------------------------------------------------------ wiring
  function checkPriceAlerts() {
    var px = {}; UNIVERSE.forEach(function (u) { var p = price(u.sym); if (p != null) px[u.sym] = p; });
    ALERTS.check(px).forEach(function (a) {
      notify('Price alert: ' + a.sym + ' ' + (a.dir === 'above' ? '≥' : '≤') + ' $' + fmt(a.price), a.sym + ' is at $' + fmt(a.hitPrice) + '. Trade War price alert.');
    });
  }
  function tick() {
    UNIVERSE.forEach(function (u) { buildSeries(u.sym); });
    checkPriceAlerts();
    var changed = processOrders();
    snapshotEquity();
    if (changed) save();
    checkAch();
    renderAll();
  }

  function start() {
    acct = load();
    chart = new TC.TradeChart($('ptChart'));
    chart.onForecastEdit = onForecastEdit;
    chart.onAlertMove = function (a) { ALERTS.update(a.id, a.price, price(a.sym)); toast('Alert moved to $' + fmt(a.price) + '.'); renderAll(); };
    chart.onPlaceAlert = function (p) {
      var a = ALERTS.add(sel, p, price(sel)); $('ptAlertAdd').setAttribute('aria-pressed', 'false'); $('ptAlertAdd').classList.remove('is-on');
      toast('Trade War alert set: ' + sel + ' ' + (a.dir === 'above' ? '≥' : '≤') + ' $' + fmt(p) + '.'); renderAll();
    };
    try { fibOn = localStorage.getItem('zelosPracticeFib') === '1'; } catch (err) {}
    $('ptFib').classList.toggle('is-on', fibOn); $('ptFib').setAttribute('aria-pressed', String(fibOn));
    $('ptFib').addEventListener('click', function () {
      fibOn = !fibOn; this.classList.toggle('is-on', fibOn); this.setAttribute('aria-pressed', String(fibOn));
      try { localStorage.setItem('zelosPracticeFib', fibOn ? '1' : '0'); } catch (err) {} renderAll();
    });
    function abcOff() { $('ptAbc').classList.remove('is-on'); $('ptAbc').setAttribute('aria-pressed', 'false'); }
    $('ptAbc').addEventListener('click', function () {
      if (chart.placing === 'abc') { chart.placing = null; abcOff(); renderAll(); return; }
      if (TC.abc.get(sel)) {
        if (!confirm('Remove the three-leg drawing on ' + sel + '?')) return;
        TC.abc.set(sel, null); renderAll(); toast('Three-leg drawing removed.'); return;
      }
      chart.placing = 'abc'; chart.abc = { pts: [] }; this.classList.add('is-on'); this.setAttribute('aria-pressed', 'true');
      toast('Three-Legged Strategy: click where the move starts, then the end of leg A, leg B and leg C.');
    });
    chart.onAbcDone = function (abc) {
      TC.abc.set(sel, abc); abcOff(); var P = abc.pts, ca = Math.abs(P[3].p - P[2].p) / Math.max(1e-9, Math.abs(P[1].p - P[0].p));
      toast('Three-leg drawing saved for ' + sel + ': leg C is ' + ca.toFixed(2) + '× leg A. Press 3-Leg again to remove it.'); renderAll();
    };
    $('ptAlertAdd').addEventListener('click', function () {
      var on = chart.placing !== 'alert'; chart.placing = on ? 'alert' : null; this.classList.toggle('is-on', on); this.setAttribute('aria-pressed', String(on));
      if (on) toast('Click a price on the chart to set a Trade War alert for ' + sel + '.');
    });
    $('ptWatch').addEventListener('click', function (e) { var b = e.target.closest('[data-sym]'); if (b) selectSymbol(b.getAttribute('data-sym')); });
    $('ptSearch').addEventListener('input', renderWatch);
    document.querySelectorAll('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { ticket.mode = b.getAttribute('data-mode'); renderTicket(); }); });
    $('ptBuy').addEventListener('click', function () { side = 'buy'; renderTicket(); });
    $('ptSell').addEventListener('click', function () { side = 'sell'; renderTicket(); });
    document.querySelectorAll('[name="ptType"]').forEach(function (r) { r.addEventListener('change', function () { ticket.type = r.value; if (r.value !== 'market' && !$('ptLimit').value) { $('ptLimit').value = fmt(price(sel)); $('ptStopPx').value = fmt(price(sel)); } renderTicket(); }); });
    $('ptQtyMode').addEventListener('click', function () { ticket.qtyMode = ticket.qtyMode === 'shares' ? 'dollars' : 'shares'; this.textContent = ticket.qtyMode === 'shares' ? 'Use $ amount' : 'Use shares'; $('ptQty').value = ''; renderTicket(); });
    ['ptQty', 'ptLimit', 'ptStopPx', 'ptTif', 'ptSL', 'ptTP'].forEach(function (id) { $(id).addEventListener('input', renderTicket); });
    $('ptUseBracket').addEventListener('change', function () { $('ptBracketFields').hidden = !this.checked; if (this.checked && !$('ptSL').value) { var p = price(sel); $('ptSL').value = fmt(p * 0.95); $('ptTP').value = fmt(p * 1.10); } renderTicket(); });
    $('ptSubmit').addEventListener('click', review);
    // options ticket
    document.querySelectorAll('[data-otype]').forEach(function (b) { b.addEventListener('click', function () { opt.type = b.getAttribute('data-otype'); opt.pick = null; renderTicket(); }); });
    $('ptOptExp').addEventListener('change', function () { opt.exp = this.value; opt.pick = null; renderTicket(); });
    $('ptChain').addEventListener('click', function (e) { var tr = e.target.closest('[data-strike]'); if (!tr) return; opt.pick = { strike: +tr.getAttribute('data-strike'), exp: opt.exp, type: opt.type }; renderTicket(); });
    $('ptOptQty').addEventListener('input', renderTicket);
    $('ptOptBuy').addEventListener('click', function () { optTrade('buy'); });
    $('ptOptSell').addEventListener('click', function () { optTrade('sell'); });
    // modal
    $('ptModalCancel').addEventListener('click', function () { $('ptConfirm').hidden = true; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { $('ptConfirm').hidden = true; if (chart.placing) { chart.placing = null; ['ptAlertAdd', 'ptAbc'].forEach(function (id) { $(id).classList.remove('is-on'); $(id).setAttribute('aria-pressed', 'false'); }); renderAll(); } document.querySelectorAll('.pt-menu').forEach(function (x) { x.hidden = true; }); } });
    document.querySelectorAll('.pt-tab').forEach(function (t) { t.addEventListener('click', function () { tab = t.getAttribute('data-tab'); renderTabs(); }); });
    $('ptTabBody').addEventListener('click', function (e) {
      var tg = e.target.closest('button,a'); if (!tg) return;
      var s = tg.getAttribute('data-sym'), c = tg.getAttribute('data-cancel'), cl = tg.getAttribute('data-close'), oc = tg.getAttribute('data-optclose'), os = tg.getAttribute('data-optsym'), ag = tg.getAttribute('data-agent');
      if (s) { selectSymbol(s); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      var ae = tg.getAttribute('data-alert-edit'), ad = tg.getAttribute('data-alert-del');
      if (ae) { var al = ALERTS.list.filter(function (x) { return x.id === ae; })[0]; if (!al) return; var nv = prompt('New alert price for ' + al.sym + ':', fmt(al.price)); if (nv == null) return; nv = +String(nv).replace(/[^0-9.]/g, ''); if (!(nv > 0)) return toast('Enter a price above 0.', true); ALERTS.update(ae, Math.round(nv * 100) / 100, price(al.sym)); renderAll(); toast('Alert updated.'); return; }
      if (ad) { ALERTS.remove(ad); renderAll(); toast('Alert deleted.'); return; }
      if (c) { acct.orders.forEach(function (o) { if (o.id === c && o.status === 'open') { o.status = 'cancelled'; o.note = 'Cancelled by you'; } }); save(); renderAll(); toast('Order cancelled.'); }
      if (cl) { selectSymbol(cl); ticket.mode = 'stock'; side = 'sell'; ticket.type = 'market'; document.querySelector('[name="ptType"][value="market"]').checked = true; ticket.qtyMode = 'shares'; $('ptQtyMode').textContent = 'Use $ amount'; $('ptQty').value = qtyStr(acct.positions[cl].qty - reservedShares(cl)); renderAll(); review(); }
      if (oc || os) {
        var o = acct.options.filter(function (x) { return x.id === (oc || os); })[0]; if (!o) return;
        selectSymbol(o.sym); ticket.mode = 'options'; opt.type = o.type; opt.exp = o.exp; opt.pick = { strike: o.strike, exp: o.exp, type: o.type };
        $('ptOptQty').value = o.qty; renderAll(); window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (ag) useAgent(ag);
      var act = tg.getAttribute('data-act');
      if (act === 'share') shareAccount();
      if (act === 'challenge') challengeFriend();
      if (act === 'signin') needSignIn('Sign in with Google to get your invite link.');
      if (act === 'invite' && window.ZelosSocial) ZelosSocial.shareLink('Join me in Trade War', 'Trade real stocks with $10,000 of virtual money and see if you can beat me.', $('ptInvite').value).then(function (r) { if (r === 'copied') toast('Invite link copied.'); });
    });
    // toolbar: timeframe, ranges, indicators, forecast, colors
    $('ptNewsBtn').addEventListener('click', function () { if ($('ptNewsMenu').hidden) renderNewsMenu(); });
    menu('ptTfBtn', 'ptTfMenu'); menu('ptIndBtn', 'ptIndMenu'); menu('ptColorsBtn', 'ptColorPop'); menu('ptNewsBtn', 'ptNewsMenu');
    $('ptAcctRng').addEventListener('click', function (e) {
      var b = e.target.closest('[data-ar]'); if (!b) return;
      acctRange = b.getAttribute('data-ar'); try { localStorage.setItem('zelosAcctRange', acctRange); } catch (err) {}
      renderAcctCard();
    });
    $('ptHistBtn').addEventListener('click', function () { tab = 'performance'; renderTabs(); var l = document.querySelector('.pt-lower'); if (l) l.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    window.addEventListener('resize', function () { clearTimeout(drawAcctChart.t); drawAcctChart.t = setTimeout(drawAcctChart, 120); });
    document.addEventListener('click', function () { document.querySelectorAll('.pt-menu').forEach(function (x) { x.hidden = true; }); });
    $('ptTfMenu').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tf]'); if (!b) return;
      tf = b.getAttribute('data-tf'); rangeSel = null; $('ptTfMenu').hidden = true;
      try { localStorage.setItem('zelosPracticeTf', tf); } catch (err) {}
      watchIntraday(); renderTfMenu(); renderQuote();
    });
    $('ptRanges').addEventListener('click', function (e) {
      var b = e.target.closest('[data-range]'); if (!b) return;
      var r = b.getAttribute('data-range'); rangeSel = r === 'all' ? 'all' : +r;
      chart.setRange(rangeSel); renderTfMenu();
    });
    try { var savedTf = localStorage.getItem('zelosPracticeTf'); if (TF[savedTf]) tf = savedTf; } catch (err) {}
    renderTfMenu(); renderIndMenu();
    $('ptIndMenu').addEventListener('change', function (e) { var id = e.target.getAttribute('data-ind'); if (!id) return; chart.toggle(id, e.target.checked); renderIndMenu(); });
    try { forecastOn = localStorage.getItem('zelosPracticeForecast') === '1'; } catch (err) {}
    syncForecastChip();
    $('ptForecast').addEventListener('click', function () {
      forecastOn = !forecastOn; syncForecastChip();
      try { localStorage.setItem('zelosPracticeForecast', forecastOn ? '1' : '0'); } catch (err) {}
      renderQuote();
    });
    function paintColors() {
      var c = chart.colors;
      $('ptColorUp').value = c.up; $('ptColorDown').value = c.down;
      $('ptColorSwatch').style.background = 'linear-gradient(135deg, ' + c.up + ' 50%, ' + c.down + ' 50%)';
      document.querySelectorAll('[data-preset]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-preset') === c.id); });
    }
    $('ptColorPresets').innerHTML = TC.PRESETS.map(function (p) { return '<button type="button" class="pt-preset" data-preset="' + p.id + '"><i style="background:' + p.up + '"></i><i style="background:' + p.down + '"></i>' + esc(p.name) + '</button>'; }).join('');
    $('ptColorPresets').addEventListener('click', function (e) {
      var b = e.target.closest('[data-preset]'); if (!b) return;
      var p = TC.PRESETS.filter(function (x) { return x.id === b.getAttribute('data-preset'); })[0];
      chart.colors = { id: p.id, up: p.up, down: p.down }; TC.saveColors(chart.colors); paintColors(); chart.draw();
    });
    ['ptColorUp', 'ptColorDown'].forEach(function (id) { $(id).addEventListener('input', function () { chart.colors = { id: 'custom', up: $('ptColorUp').value, down: $('ptColorDown').value }; TC.saveColors(chart.colors); paintColors(); chart.draw(); }); });
    paintColors();
    $('ptZoomIn').addEventListener('click', function () { chart.zoom(1 / 1.3); });
    $('ptZoomOut').addEventListener('click', function () { chart.zoom(1.3); });
    // Full Port, reset banner, notifications
    $('ptFullPort').addEventListener('change', function () {
      acct.fullPort = this.checked; save(); renderAll();
      toast(this.checked ? '<b>Full Port on.</b> Every order now uses your entire buying power (or your whole position when selling).' : 'Full Port off.', this.checked);
    });
    $('ptResetBtn').addEventListener('click', askReset);
    $('ptBell').addEventListener('click', function () {
      if (!('Notification' in window)) return toast('This browser doesn\'t support notifications.', true);
      if (Notification.permission === 'denied') return toast('Notifications are blocked for this site in your browser settings.', true);
      Notification.requestPermission().then(function () { renderBell(); if (Notification.permission === 'granted') toast('You\'ll get a pop-up when a take profit or stop loss hits while this tab is open.'); });
    });
    // missions / achievements changed (here or in another tab)
    document.addEventListener('zelos:progress', function () { if (!UNIVERSE.length) return; renderLevelChip(); if (tab === 'progress') renderTabs(); });
    // entry gate
    $('ptGateEnter').addEventListener('click', function () { $('ptGate').hidden = true; try { sessionStorage.setItem('zelosPracticeEntered', '1'); } catch (e) {} });
    $('ptGateGoogle').addEventListener('click', function () {
      if (!window.firebase) return;
      var m = $('ptGateMsg'), show = function (t) { if (m) { m.textContent = t; m.hidden = false; } else toast(esc(t), true); };
      if (m) m.hidden = true;
      if (window.ZelosSignIn) return ZelosSignIn.google(show);
      firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(function (e) { show('Sign-in didn\'t finish: ' + (e.message || e)); });
    });
    $('ptGateRename').addEventListener('click', function () {
      if (window.ZelosProfile) return ZelosProfile.openEditor().then(function (out) { if (out) { profile = out; renderGate(); renderHeader(); save(); } });
      var n = prompt('Display name for the leaderboard (no email or real name needed):', playerName());
      if (n == null) return; n = n.replace(/[<>]/g, '').trim().slice(0, 24); if (!n) return;
      acct.displayName = n; save(); renderGate(); renderHeader();
    });

    // universe + history
    Promise.all([
      fetch('../data/practice-universe.json').then(function (r) { return r.json(); }),
      fetch('../data/game-charts.json').then(function (r) { return r.json(); }),
      fetch('../data/practice-extra.json').then(function (r) { return r.json(); }).catch(function () { return { symbols: {} }; }),
      fetch('../data/crypto-universe.json').then(function (r) { return r.json(); }).catch(function () { return { symbols: [] }; })
    ]).then(function (res) {
      (res[3].symbols || []).forEach(function (u) { CRYPTO[u.sym] = u; });
      UNIVERSE = res[0].symbols.concat(res[3].symbols || []); UNIVERSE.forEach(function (u) { NAMES[u.sym] = u.name; GROUPS[u.sym] = u.group; });
      hist = {}; [res[1].symbols, res[2].symbols].forEach(function (src) { Object.keys(src).forEach(function (k) { hist[k] = src[k]; }); });
      if (!NAMES[sel]) sel = UNIVERSE[0].sym;
      tick(); showGate(); fromAlertLink();
    }).catch(function () { toast('Couldn\'t load price history. Refresh to try again.', true); });

    var cfg = window.ZELOS_FIREBASE_CONFIG;
    if (window.firebase && cfg && cfg.projectId) {
      try {
        if (!firebase.apps.length) firebase.initializeApp(cfg);
        db = firebase.firestore();
        if (window.ZelosSignIn) ZelosSignIn.finish(function (t) { toast(esc(t), true); });
        db.collection('markets').doc('quotes').onSnapshot(function (snap) {
          if (!snap.exists) { feed = { state: 'none' }; if (UNIVERSE.length) tick(); return; }
          var d = snap.data() || {};
          quotes = {};
          Object.keys(d.quotes || {}).forEach(function (s) { var q = d.quotes[s]; q.date = q.t ? nyParts(new Date(q.t * 1000)).date : d.date; quotes[s] = q; });
          var freshQ = d.updatedAt && Date.now() - new Date(d.updatedAt).getTime() < 3 * 60 * 1000;
          feed = { state: d.error ? 'error' : freshQ ? 'live' : 'closed', error: d.error, updatedAt: d.updatedAt };
          if (UNIVERSE.length) tick();
        }, function () { feed = { state: 'none' }; if (UNIVERSE.length) tick(); });
        // crypto: 24/7 quotes and daily history (refresh_market_data)
        db.collection('markets').doc('crypto').onSnapshot(function (snap) {
          var d = (snap.exists && snap.data().quotes) || {};
          cquotes = {};
          Object.keys(d).forEach(function (s) { var q = d[s]; q.date = q.t ? nyParts(new Date(q.t * 1000)).date : null; cquotes[s] = q; });
          if (UNIVERSE.length) tick();
        }, function () {});
        db.collection('markets').doc('cryptoBars').onSnapshot(function (snap) {
          var b = (snap.exists && snap.data().bars) || {};
          cbars = {};
          Object.keys(b).forEach(function (s) { cbars[s] = (b[s] || []).map(function (r) { var p = String(r).split(','); return [p[0], +p[1], +p[2], +p[3], +p[4], +p[5] || 0]; }); });
          if (UNIVERSE.length) tick();
        }, function () {});
        db.collection('markets').doc('dailyBars').onSnapshot(function (snap) {
          var b = (snap.exists && snap.data().bars) || {};
          extra = {};
          Object.keys(b).forEach(function (s) { extra[s] = (b[s] || []).map(function (r) { var p = String(r).split(','); return [p[0], +p[1], +p[2], +p[3], +p[4], +p[5] || 0]; }); });
          if (UNIVERSE.length) tick();
        }, function () {});
        watchIntraday();
        db.collection('markets').doc('news').onSnapshot(function (snap) { var d = snap.exists ? snap.data() : {}; finnNews = d.bySymbol || {}; finnAttr = d.attribution || ''; if (UNIVERSE.length) renderNewsBtn(); }, function () {});
        var xpUnsub = null;
        firebase.auth().onAuthStateChanged(function (user) {
          authReady = true;
          // XP accrues to whoever is signed in, guests included (zelos-xp.js signs them in anonymously)
          if (xpUnsub) { xpUnsub(); xpUnsub = null; }
          if (user) xpUnsub = db.collection('users').doc(user.uid).onSnapshot(function (d) {
            var data = d.exists ? d.data() : {}, before = xpNow;
            xpNow = data.xp || 0;
            if (before == null && UNIVERSE.length) { snapshotEquity(); }
            if (before !== xpNow && currentUser && synced && UNIVERSE.length) publishProfile(); // republish XP / level on the public profile
            // live sync: a newer online copy from another device
            if (currentUser && synced && data.practice && !d.metadata.hasPendingWrites && !acct.dirty && (data.practice.updatedAt || 0) > (acct.updatedAt || 0)) adoptRemote(seedLife(migrate(data.practice)));
            if (UNIVERSE.length) { renderHeader(); if (tab === 'progress') renderTabs(); }
          }, function () {});
          currentUser = user && !user.isAnonymous ? user : null;
          synced = false; clearTimeout(saveTimer);
          // the account sync below waits for the profile so the first publish uses the right name/photo
          profile = {};
          var profileReady = currentUser && window.ZelosProfile
            ? ZelosProfile.load(currentUser.uid).then(function (t) { profile = t || {}; }) : Promise.resolve();
          if (PROG) { if (currentUser) PROG.attach(db, currentUser.uid); else PROG.detach(); }
          if (currentUser) ALERTS.attach(db, currentUser.uid, function () { if (UNIVERSE.length) renderAll(); });
          if (currentUser && window.ZelosSocial && ZelosSocial.init()) {
            ZelosSocial.claimReferral(currentUser);
            ZelosSocial.myReferrals(currentUser.uid).then(function (ids) { if (ids.length !== referralCount) { referralCount = ids.length; checkAch(); save(); } });
          }
          $('ptSync').textContent = currentUser ? 'Saved to your account' : 'Saved in this browser · sign in to keep it everywhere';
          if (!currentUser) { renderGate(); if (UNIVERSE.length) renderHeader(); return; }
          var syncUser = currentUser;
          (function loadOnline(tries) {
          Promise.all([db.collection('users').doc(currentUser.uid).get(), profileReady]).then(function (r) {
            if (currentUser !== syncUser) return; // signed out / switched while loading
            var doc = r[0];
            var data = doc.exists ? doc.data() : {};
            ownedSkills = data.ownedSkills || [];
            var remote = data.practice ? seedLife(migrate(data.practice)) : null, uid0 = currentUser.uid;
            var mine = !acct.owner || acct.owner === uid0; // a copy left by another account on this device is never used
            if (remote && (!mine || !acct.dirty || (remote.updatedAt || 0) >= (acct.updatedAt || 0))) { acct = remote; acct.dirty = false; }
            else if (!remote && !mine) acct = seedLife(fresh());
            acct.owner = uid0; synced = true;
            if (acct.dirty || !remote) save(); else { try { localStorage.setItem(KEY, JSON.stringify(acct)); } catch (e) {} publishProfile(); }
            syncFailed = false; renderGate(); if (UNIVERSE.length) tick();
          }).catch(function () {
            // couldn't reach the account: keep retrying; after a few tries show this device's copy
            // (still never written online until the real one has loaded)
            if (currentUser !== syncUser) return;
            if (tries >= 2) { syncFailed = true; if (UNIVERSE.length) renderHeader(); }
            setTimeout(function () { if (currentUser === syncUser && !synced) loadOnline(tries + 1); }, Math.min(30000, 2000 * (tries + 1)));
          });
          })(0);
        });
      } catch (e) { feed = { state: 'none' }; authReady = true; }
    } else { feed = { state: 'none' }; authReady = true; }
    setInterval(function () { if (!UNIVERSE.length) return; renderHeader(); if (marketOpen()) tick(); }, 15000);
  }
  document.addEventListener('zelos:profile', function (e) { profile = e.detail || {}; if (acct) { renderGate(); if (UNIVERSE.length) renderHeader(); save(); } });
  document.addEventListener('DOMContentLoaded', start);
})();
