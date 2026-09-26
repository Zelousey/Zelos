/*!
 * Zelos $10,000 Practice Account.
 *
 * Prices: live quotes that the refresh_quotes Cloud Function pulls from
 * Finnhub every minute into Firestore markets/quotes, on top of daily bars
 * (data/game-charts.json plus markets/dailyBars). With no live feed, it
 * falls back to the latest daily close and says so.
 *
 * Orders: market, limit and stop, day or good-til-cancelled, with an optional
 * stop-loss / take-profit bracket (one cancels the other). Long positions
 * only, cash account, no fees. Orders fill on live price ticks while the page
 * is open, and are caught up against the daily bars when you come back.
 *
 * Saved in this browser, and to users/{uid}.practice when signed in.
 */
(function () {
  'use strict';
  var START_CASH = 10000, KEY = 'zelosPractice-v1', MAX_FILLS = 500, MAX_ORDERS = 400;
  var NAMES = {
    AAPL: 'Apple', AMZN: 'Amazon', MSFT: 'Microsoft', GOOGL: 'Alphabet', NFLX: 'Netflix', CRWD: 'CrowdStrike', UBER: 'Uber', SMCI: 'Super Micro',
    AVGO: 'Broadcom', SOFI: 'SoFi', NVDA: 'NVIDIA', AMD: 'AMD', TSLA: 'Tesla', META: 'Meta', PLTR: 'Palantir', COIN: 'Coinbase', SHOP: 'Shopify',
    MU: 'Micron', SPY: 'S&P 500 ETF', QQQ: 'Nasdaq 100 ETF', JPM: 'JPMorgan', XOM: 'Exxon Mobil', LLY: 'Eli Lilly', COST: 'Costco', HOOD: 'Robinhood',
    ANET: 'Arista', DKNG: 'DraftKings', RBLX: 'Roblox', SNOW: 'Snowflake', ABNB: 'Airbnb'
  };
  var TC = window.ZelosTradeChart, fmt = TC.fmt;
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
  // the session an order placed right now will trade in
  function activeSession() {
    var p = nyParts();
    if (!isWeekend(p.wd) && p.min < 960) return p.date;
    return nextSession(p.date);
  }

  // ------------------------------------------------------------ data
  var hist = {}, extra = {}, quotes = {}, feed = { state: 'loading' }, series = {};
  function buildSeries(sym) {
    var rows = hist[sym] || []; var last = rows.length ? rows[rows.length - 1][0] : '';
    var more = (extra[sym] || []).filter(function (r) { return r[0] > last; });
    var all = rows.concat(more);
    var q = quotes[sym], live = false;
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
    var q = quotes[sym]; if (q && q.pc && s.live) return q.pc;
    return s.c[s.n - 2];
  }
  function isLiveTick(sym) { return feed.state === 'live' && quotes[sym] && marketOpen(); }

  // ------------------------------------------------------------ account state
  var acct = null, currentUser = null, db = null, saveTimer = null;
  function fresh() { return { v: 1, cash: START_CASH, positions: {}, orders: [], fills: [], realized: 0, equityDays: {}, createdAt: Date.now(), updatedAt: Date.now() }; }
  function load() { try { var a = JSON.parse(localStorage.getItem(KEY) || 'null'); if (a && a.v === 1) return a; } catch (e) {} return fresh(); }
  function save() {
    acct.updatedAt = Date.now();
    if (acct.fills.length > MAX_FILLS) acct.fills = acct.fills.slice(-MAX_FILLS);
    if (acct.orders.length > MAX_ORDERS) acct.orders = acct.orders.filter(function (o) { return o.status === 'open'; }).concat(acct.orders.filter(function (o) { return o.status !== 'open'; }).slice(-MAX_ORDERS));
    try { localStorage.setItem(KEY, JSON.stringify(acct)); } catch (e) {}
    if (currentUser && db) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        db.collection('users').doc(currentUser.uid).set({ practice: JSON.parse(JSON.stringify(acct)) }, { merge: true }).catch(function () {});
      }, 800);
    }
  }

  function positionValue() { var t = 0; Object.keys(acct.positions).forEach(function (s) { t += acct.positions[s].qty * (price(s) || acct.positions[s].avg); }); return t; }
  function equity() { return acct.cash + positionValue(); }
  function reservedCash() {
    return acct.orders.reduce(function (t, o) { return o.status === 'open' && o.side === 'buy' ? t + o.qty * (o.limit || o.stop || price(o.sym) || 0) : t; }, 0);
  }
  function buyingPower() { return Math.max(0, acct.cash - reservedCash()); }
  function reservedShares(sym) { return acct.orders.reduce(function (t, o) { return o.status === 'open' && o.side === 'sell' && o.sym === sym && !o.oco ? t + o.qty : t; }, 0); }
  function dayPnl() {
    var t = 0, today = todayNY();
    Object.keys(acct.positions).forEach(function (s) {
      var p = acct.positions[s], px = price(s), pc = prevClose(s);
      if (px == null) return;
      var base = p.openedDay === today || pc == null ? p.avg : pc;
      t += p.qty * (px - base);
    });
    acct.fills.forEach(function (f) { if (f.side === 'sell' && f.day === today && f.dayBase != null) t += f.qty * (f.price - f.dayBase); });
    return t;
  }

  // ------------------------------------------------------------ orders + fills
  function fill(o, px, when) {
    var sym = o.sym, qty = o.qty, day = when || todayNY();
    if (o.side === 'buy') {
      var cost = qty * px;
      if (cost > acct.cash + 0.005) { o.status = 'rejected'; o.note = 'Not enough cash when it triggered'; return; }
      acct.cash -= cost;
      var p = acct.positions[sym] || { qty: 0, avg: 0, openedDay: day };
      p.avg = (p.avg * p.qty + cost) / (p.qty + qty); p.qty += qty;
      acct.positions[sym] = p;
      acct.fills.push({ id: uid(), sym: sym, side: 'buy', qty: qty, price: px, day: day, at: Date.now(), orderId: o.id, type: o.type });
      o.status = 'filled'; o.fillPrice = px; o.filledAt = Date.now(); o.filledDay = day;
      if (o.bracket && (o.bracket.sl || o.bracket.tp)) {
        var group = uid();
        if (o.bracket.sl) acct.orders.push(newOrder({ sym: sym, side: 'sell', type: 'stop', qty: qty, stop: o.bracket.sl, tif: 'gtc', oco: group, parent: o.id, placedOpen: marketOpen() }));
        if (o.bracket.tp) acct.orders.push(newOrder({ sym: sym, side: 'sell', type: 'limit', qty: qty, limit: o.bracket.tp, tif: 'gtc', oco: group, parent: o.id, placedOpen: marketOpen() }));
      }
    } else {
      var pos = acct.positions[sym];
      if (!pos || pos.qty <= 0) { o.status = 'cancelled'; o.note = 'No shares left to sell'; return; }
      qty = Math.min(qty, pos.qty);
      var pc = prevClose(sym);
      var pnl = (px - pos.avg) * qty;
      acct.cash += qty * px; acct.realized += pnl;
      pos.qty -= qty;
      acct.fills.push({ id: uid(), sym: sym, side: 'sell', qty: qty, price: px, day: day, at: Date.now(), orderId: o.id, type: o.type, pnl: pnl, dayBase: pos.openedDay === day ? pos.avg : pc });
      o.status = 'filled'; o.fillPrice = px; o.filledAt = Date.now(); o.filledDay = day; o.qty = qty;
      if (pos.qty <= 0) delete acct.positions[sym];
      // one-cancels-other, and never leave sell orders for shares you no longer have
      acct.orders.forEach(function (x) {
        if (x.status !== 'open' || x.side !== 'sell' || x.sym !== sym) return;
        if ((o.oco && x.oco === o.oco) || !acct.positions[sym]) { x.status = 'cancelled'; x.note = o.oco && x.oco === o.oco ? 'Other side of the bracket filled' : 'Position closed'; }
        else if (x.qty > acct.positions[sym].qty) x.qty = acct.positions[sym].qty;
      });
    }
  }
  function newOrder(f) {
    var open = marketOpen();
    return {
      id: uid(), sym: f.sym, side: f.side, type: f.type, qty: f.qty, limit: f.limit || null, stop: f.stop || null,
      tif: f.tif || 'day', status: 'open', createdAt: Date.now(), createdDay: todayNY(), placedOpen: f.placedOpen != null ? f.placedOpen : open,
      session: activeSession(), bracket: f.bracket || null, oco: f.oco || null, parent: f.parent || null
    };
  }
  function triggerOnPrice(o, p) {
    if (o.type === 'market') return p;
    if (o.type === 'limit') return o.side === 'buy' ? (p <= o.limit ? p : null) : (p >= o.limit ? p : null);
    if (o.type === 'stop') return o.side === 'sell' ? (p <= o.stop ? p : null) : (p >= o.stop ? p : null);
    return null;
  }
  function triggerOnBar(o, b) { // b = { o, h, l }
    if (o.type === 'market') return b.o;
    if (o.type === 'limit') return o.side === 'buy' ? (b.o <= o.limit ? b.o : b.l <= o.limit ? o.limit : null) : (b.o >= o.limit ? b.o : b.h >= o.limit ? o.limit : null);
    if (o.type === 'stop') return o.side === 'sell' ? (b.o <= o.stop ? b.o : b.l <= o.stop ? o.stop : null) : (b.o >= o.stop ? b.o : b.h >= o.stop ? o.stop : null);
    return null;
  }
  // Works every open order against (1) whole trading days it has been live
  // for since it was placed, then (2) the current live price.
  function processOrders() {
    var changed = false, today = todayNY(), p = nyParts(), open = marketOpen();
    acct.orders.forEach(function (o) {
      if (o.status !== 'open') return;
      var s = series[o.sym]; if (!s || !s.n) return;
      // bars that started after the order was placed; a same-day order placed
      // mid-session can't use that day's bar (its high/low may be from before)
      var firstDay = o.placedOpen ? nextSession(o.createdDay) : o.session;
      for (var i = 0; i < s.n && o.status === 'open'; i++) {
        var d = s.d[i];
        if (d < firstDay) continue;
        if (o.tif === 'day' && d > o.session) break;
        if (s.live && i === s.n - 1 && d === today && open) {
          // today's live bar: fine for orders waiting since before the open
          var px0 = triggerOnBar(o, { o: s.o[i], h: s.h[i], l: s.l[i] });
          if (px0 != null) { fill(o, px0, d); changed = true; }
          break;
        }
        var px = triggerOnBar(o, { o: s.o[i], h: s.h[i], l: s.l[i] });
        if (px != null) { fill(o, px, d); changed = true; }
      }
      if (o.status !== 'open') return;
      if (isLiveTick(o.sym) && (o.session <= today)) {
        var tp = triggerOnPrice(o, price(o.sym));
        if (tp != null) { fill(o, tp, today); changed = true; return; }
      }
      // day orders die at the close of their session
      var sessionOver = today > o.session || (today === o.session && p.min >= 960);
      if (o.tif === 'day' && sessionOver) { o.status = 'expired'; o.note = 'Day order expired at the close'; changed = true; }
    });
    return changed;
  }

  // ------------------------------------------------------------ UI state
  var sel = 'AAPL', side = 'buy', chart = null, ticket = { type: 'market', qtyMode: 'shares' }, tab = 'positions';

  function renderWatch() {
    var q = ($('ptSearch').value || '').trim().toUpperCase();
    $('ptWatch').innerHTML = Object.keys(NAMES).filter(function (s) { return !q || s.indexOf(q) === 0 || NAMES[s].toUpperCase().indexOf(q) !== -1; }).map(function (s) {
      var px = price(s), pc = prevClose(s), ch = px != null && pc ? (px / pc - 1) * 100 : 0, held = acct.positions[s];
      return '<button type="button" class="pt-wrow' + (s === sel ? ' is-sel' : '') + '" data-sym="' + s + '">' +
        '<span class="pt-wsym">' + s + (held ? '<i class="pt-held" title="You hold this"></i>' : '') + '<small>' + esc(NAMES[s]) + '</small></span>' +
        '<span class="pt-wpx">' + fmt(px) + '<small class="' + (ch >= 0 ? 'up' : 'dn') + '">' + pct(ch) + '</small></span></button>';
    }).join('');
  }
  function renderHeader() {
    var eq = equity(), tot = eq - START_CASH, dp = dayPnl();
    $('ptEquity').textContent = money(eq);
    $('ptTotal').textContent = signed(tot) + ' (' + pct(tot / START_CASH * 100) + ')'; $('ptTotal').className = tot >= 0 ? 'up' : 'dn';
    $('ptDay').textContent = signed(dp); $('ptDay').className = dp >= 0 ? 'up' : 'dn';
    $('ptCash').textContent = money(acct.cash);
    $('ptBP').textContent = money(buyingPower());
    // feed status
    var st = $('ptFeed'), txt, cls;
    if (feed.state === 'live' && marketOpen()) { txt = 'Live prices · updated ' + ago(feed.updatedAt); cls = 'is-live'; }
    else if (feed.state === 'live' || feed.state === 'closed') { txt = 'Market closed · prices as of ' + asOf(feed.updatedAt); cls = 'is-closed'; }
    else if (feed.state === 'error') { txt = feed.error === 'auth' ? 'Live feed error: the price service rejected the API key. Using last close.' : 'Live feed unavailable right now · using last close'; cls = 'is-error'; }
    else if (feed.state === 'none') { txt = 'Live feed not connected yet · using latest close (' + (series[sel] ? series[sel].d[series[sel].n - 1] : '') + ')'; cls = 'is-closed'; }
    else { txt = 'Connecting to live prices…'; cls = ''; }
    st.textContent = txt; st.className = 'pt-feed ' + cls;
    $('ptClock').textContent = marketOpen() ? 'Market open' : 'Market closed';
    $('ptClock').className = 'pt-clock ' + (marketOpen() ? 'is-open' : '');
  }
  function ago(iso) { if (!iso) return '–'; var s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000)); return s < 60 ? s + 's ago' : Math.round(s / 60) + 'm ago'; }
  function asOf(iso) { if (!iso) return 'last close'; try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET'; } catch (e) { return iso; } }

  function renderQuote() {
    var s = series[sel]; if (!s) return;
    var px = price(sel), pc = prevClose(sel), ch = px - pc, chp = pc ? ch / pc * 100 : 0;
    $('ptSym').textContent = sel; $('ptName').textContent = NAMES[sel];
    $('ptPx').textContent = fmt(px);
    $('ptChg').textContent = (ch >= 0 ? '+' : '') + fmt(ch) + ' (' + pct(chp) + ')'; $('ptChg').className = ch >= 0 ? 'up' : 'dn';
    var i = s.n - 1, hi52 = Math.max.apply(null, s.h.slice(-252)), lo52 = Math.min.apply(null, s.l.slice(-252));
    var avgV = s.v.slice(-21, -1).filter(Boolean); avgV = avgV.length ? avgV.reduce(function (a, b) { return a + b; }, 0) / avgV.length : null;
    $('ptStats').innerHTML = [
      ['Open', fmt(s.o[i])], ['High', fmt(s.h[i])], ['Low', fmt(s.l[i])], ['Prev close', fmt(pc)],
      ['52-wk high', fmt(hi52)], ['52-wk low', fmt(lo52)], ['Avg volume', TC.fmtVol(avgV)], ['RSI 14', fmt(s.rsi[i], 1)]
    ].map(function (r) { return '<span><small>' + r[0] + '</small><b>' + r[1] + '</b></span>'; }).join('');
    // chart overlays: cost basis, open orders, your fills
    var lines = [], pos = acct.positions[sel];
    if (pos) lines.push({ price: pos.avg, color: 'var(--ink)', label: 'AVG COST ' + pos.qty + ' sh', dash: [6, 3] });
    acct.orders.forEach(function (o) {
      if (o.status !== 'open' || o.sym !== sel || o.type === 'market') return;
      var lvl = o.limit || o.stop;
      var col = o.type === 'stop' ? '#e8b23d' : o.side === 'buy' ? '#3ecb7c' : '#e0483f';
      lines.push({ price: lvl, color: col, label: (o.side === 'buy' ? 'BUY ' : 'SELL ') + o.type.toUpperCase() + ' ' + o.qty });
    });
    lines.forEach(function (l) { if (l.color.indexOf('var(') === 0) l.color = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#f4f5f7'; });
    chart.lines = lines;
    chart.marks = acct.fills.filter(function (f) { return f.sym === sel; }).map(function (f) { return { i: s.d.indexOf(f.day), price: f.price, side: f.side }; }).filter(function (m) { return m.i >= 0; });
    chart.lastPrice = px;
    chart.setSeries(s);
    chart.draw();
  }

  function renderTicket() {
    var px = price(sel), pos = acct.positions[sel];
    $('ptBuy').classList.toggle('is-on', side === 'buy'); $('ptSell').classList.toggle('is-on', side === 'sell');
    $('ptBuy').setAttribute('aria-pressed', String(side === 'buy')); $('ptSell').setAttribute('aria-pressed', String(side === 'sell'));
    $('ptLimitRow').hidden = ticket.type !== 'limit'; $('ptStopRow').hidden = ticket.type !== 'stop';
    $('ptBracket').hidden = side !== 'buy';
    $('ptQtyLabel').textContent = ticket.qtyMode === 'shares' ? 'Shares' : 'Amount ($)';
    var q = orderQty(), est = q * (ticket.type === 'limit' ? +$('ptLimit').value || px : ticket.type === 'stop' ? +$('ptStopPx').value || px : px);
    var have = pos ? pos.qty - reservedShares(sel) : 0;
    var msg = '';
    if (side === 'buy') msg = 'Buying power ' + money(buyingPower()) + (q ? ' · est. cost ' + money(est) : '');
    else msg = pos ? 'You can sell ' + have + ' share' + (have === 1 ? '' : 's') + (q ? ' · est. proceeds ' + money(est) : '') : 'You don\'t hold ' + sel + ' yet.';
    $('ptEst').textContent = msg;
    var open = marketOpen(), liveOk = feed.state === 'live';
    $('ptWhen').textContent = ticket.type === 'market'
      ? (open ? (liveOk ? 'Fills right away at the live price.' : 'Fills right away at the last price shown.') : 'Market is closed: fills at the next open.')
      : (ticket.type === 'limit' ? (side === 'buy' ? 'Fills at your price or lower.' : 'Fills at your price or higher.') : (side === 'sell' ? 'Sells if price drops to your stop (can fill lower on a gap).' : 'Buys if price rises to your stop.'));
    $('ptSubmit').textContent = (side === 'buy' ? 'Review buy' : 'Review sell') + (q ? ' · ' + q + ' ' + sel : '');
    $('ptSubmit').className = 'pt-submit ' + (side === 'buy' ? 'is-buy' : 'is-sell');
  }
  function orderQty() {
    var v = parseFloat($('ptQty').value); if (!(v > 0)) return 0;
    if (ticket.qtyMode === 'shares') return Math.floor(v);
    var px = ticket.type === 'limit' ? +$('ptLimit').value || price(sel) : price(sel);
    return px ? Math.floor(v / px) : 0;
  }

  function renderTabs() {
    document.querySelectorAll('.pt-tab').forEach(function (t) { t.setAttribute('aria-selected', String(t.getAttribute('data-tab') === tab)); });
    var h = '';
    if (tab === 'positions') {
      var syms = Object.keys(acct.positions);
      h = syms.length ? '<table class="pt-table"><thead><tr><th>Symbol</th><th>Shares</th><th>Avg cost</th><th>Price</th><th>Market value</th><th>Today</th><th>Total P&amp;L</th><th></th></tr></thead><tbody>' +
        syms.map(function (s) {
          var p = acct.positions[s], px = price(s), pc = prevClose(s), mv = p.qty * px, pl = (px - p.avg) * p.qty, base = p.openedDay === todayNY() ? p.avg : pc, dp = (px - base) * p.qty;
          return '<tr><td><button class="pt-link" data-sym="' + s + '">' + s + '</button></td><td>' + p.qty + '</td><td>' + fmt(p.avg) + '</td><td>' + fmt(px) + '</td><td>' + money(mv) + '</td>' +
            '<td class="' + (dp >= 0 ? 'up' : 'dn') + '">' + signed(dp) + '</td><td class="' + (pl >= 0 ? 'up' : 'dn') + '">' + signed(pl) + ' (' + pct(pl / (p.avg * p.qty) * 100) + ')</td>' +
            '<td><button class="pt-mini" data-close="' + s + '">Sell all</button></td></tr>';
        }).join('') + '</tbody></table>' : '<p class="pt-empty">No positions yet. Pick a stock on the left and place your first order.</p>';
    } else if (tab === 'orders') {
      var open = acct.orders.filter(function (o) { return o.status === 'open'; });
      h = open.length ? '<table class="pt-table"><thead><tr><th>Placed</th><th>Symbol</th><th>Side</th><th>Type</th><th>Qty</th><th>Price</th><th>Time in force</th><th></th></tr></thead><tbody>' +
        open.slice().reverse().map(function (o) {
          return '<tr><td>' + new Date(o.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + '</td><td><button class="pt-link" data-sym="' + o.sym + '">' + o.sym + '</button></td>' +
            '<td class="' + (o.side === 'buy' ? 'up' : 'dn') + '">' + o.side.toUpperCase() + '</td><td>' + o.type + (o.oco ? ' (bracket)' : '') + '</td><td>' + o.qty + '</td>' +
            '<td>' + (o.type === 'market' ? 'market' : fmt(o.limit || o.stop)) + '</td><td>' + (o.tif === 'gtc' ? 'Good til cancelled' : 'Day (' + o.session + ')') + '</td>' +
            '<td><button class="pt-mini" data-cancel="' + o.id + '">Cancel</button></td></tr>';
        }).join('') + '</tbody></table>' : '<p class="pt-empty">No open orders.</p>';
    } else if (tab === 'history') {
      var done = acct.orders.filter(function (o) { return o.status !== 'open'; }).slice(-100).reverse();
      h = done.length ? '<table class="pt-table"><thead><tr><th>Date</th><th>Symbol</th><th>Side</th><th>Type</th><th>Qty</th><th>Status</th><th>Fill</th><th>P&amp;L</th></tr></thead><tbody>' +
        done.map(function (o) {
          var f = acct.fills.filter(function (x) { return x.orderId === o.id; })[0];
          return '<tr><td>' + (o.filledDay || o.createdDay) + '</td><td>' + o.sym + '</td><td class="' + (o.side === 'buy' ? 'up' : 'dn') + '">' + o.side.toUpperCase() + '</td><td>' + o.type + '</td><td>' + o.qty + '</td>' +
            '<td>' + o.status + (o.note ? ' <small>· ' + esc(o.note) + '</small>' : '') + '</td><td>' + (o.fillPrice ? fmt(o.fillPrice) : '–') + '</td>' +
            '<td class="' + (f && f.pnl != null ? (f.pnl >= 0 ? 'up' : 'dn') : '') + '">' + (f && f.pnl != null ? signed(f.pnl) : '–') + '</td></tr>';
        }).join('') + '</tbody></table>' : '<p class="pt-empty">Nothing yet. Filled, cancelled and expired orders show up here.</p>';
    } else {
      var sells = acct.fills.filter(function (f) { return f.side === 'sell'; }), wins = sells.filter(function (f) { return f.pnl > 0; });
      var days = Object.keys(acct.equityDays).sort();
      h = '<div class="pt-perf">' +
        '<span><small>Account value</small><b>' + money(equity()) + '</b></span>' +
        '<span><small>Total return</small><b class="' + (equity() >= START_CASH ? 'up' : 'dn') + '">' + pct((equity() / START_CASH - 1) * 100) + '</b></span>' +
        '<span><small>Realized P&amp;L</small><b class="' + (acct.realized >= 0 ? 'up' : 'dn') + '">' + signed(acct.realized) + '</b></span>' +
        '<span><small>Closed trades</small><b>' + sells.length + '</b></span>' +
        '<span><small>Win rate</small><b>' + (sells.length ? Math.round(wins.length / sells.length * 100) + '%' : '–') + '</b></span>' +
        '<span><small>Since</small><b>' + new Date(acct.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + '</b></span></div>' +
        (days.length > 1 ? '<canvas class="pt-curve" id="ptCurve"></canvas>' : '<p class="pt-empty">Your account-value curve fills in as the days go by.</p>') +
        '<button class="pt-reset" id="ptReset" type="button">Reset account to $10,000</button>';
    }
    $('ptTabBody').innerHTML = h;
    if (tab === 'performance') { drawCurve(); var r = $('ptReset'); if (r) r.addEventListener('click', resetAcct); }
  }
  function drawCurve() {
    var cv = $('ptCurve'); if (!cv) return;
    var days = Object.keys(acct.equityDays).sort(), vals = days.map(function (d) { return acct.equityDays[d]; });
    var dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr;
    var c = cv.getContext('2d'); c.scale(dpr, dpr);
    var lo = Math.min.apply(null, vals.concat([START_CASH])), hi = Math.max.apply(null, vals.concat([START_CASH])), pad = (hi - lo) * 0.1 || 50;
    lo -= pad; hi += pad;
    var X = function (i) { return 8 + i / (vals.length - 1) * (W - 16); }, Y = function (v) { return 8 + (hi - v) / (hi - lo) * (H - 16); };
    var up = vals[vals.length - 1] >= START_CASH, col = up ? '#3ecb7c' : '#e0483f';
    c.strokeStyle = 'rgba(127,127,127,0.4)'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(8, Y(START_CASH)); c.lineTo(W - 8, Y(START_CASH)); c.stroke(); c.setLineDash([]);
    c.beginPath(); vals.forEach(function (v, i) { if (i) c.lineTo(X(i), Y(v)); else c.moveTo(X(i), Y(v)); });
    c.strokeStyle = col; c.lineWidth = 2; c.stroke();
    c.lineTo(X(vals.length - 1), H - 8); c.lineTo(X(0), H - 8); c.closePath(); c.globalAlpha = 0.12; c.fillStyle = col; c.fill(); c.globalAlpha = 1;
  }
  function resetAcct() {
    if (!confirm('Reset your practice account to $10,000? This clears every position, order and trade.')) return;
    acct = fresh(); save(); renderAll();
    toast('Account reset to $10,000.');
  }

  // switching stocks: prices typed for the old one make no sense for the new one
  function selectSymbol(sym) {
    if (sym === sel) return renderAll();
    sel = sym;
    buildSeries(sym);
    var p = price(sym);
    $('ptLimit').value = p ? fmt(p) : ''; $('ptStopPx').value = p ? fmt(p) : '';
    if ($('ptUseBracket').checked && p) { $('ptSL').value = fmt(p * 0.95); $('ptTP').value = fmt(p * 1.10); }
    else { $('ptSL').value = ''; $('ptTP').value = ''; }
    renderAll();
  }

  function renderAll() {
    renderHeader(); renderWatch(); renderQuote(); renderTicket(); renderTabs();
  }

  function toast(t, bad) {
    var el = document.createElement('div'); el.className = 'pt-toast' + (bad ? ' is-bad' : ''); el.innerHTML = t;
    document.body.appendChild(el); setTimeout(function () { el.classList.add('is-out'); }, 3200); setTimeout(function () { el.remove(); }, 3700);
  }

  // ------------------------------------------------------------ placing orders
  function review() {
    var q = orderQty(), px = price(sel);
    if (!q) return toast('Enter how many shares (or dollars) first.', true);
    var o = { sym: sel, side: side, type: ticket.type, qty: q, tif: $('ptTif').value };
    if (o.type === 'limit') { o.limit = +(+$('ptLimit').value).toFixed(2); if (!(o.limit > 0)) return toast('Enter a limit price.', true); }
    if (o.type === 'stop') { o.stop = +(+$('ptStopPx').value).toFixed(2); if (!(o.stop > 0)) return toast('Enter a stop price.', true); }
    if (o.type === 'market') o.tif = 'day';
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
      if (q > have) return toast(have ? 'You can only sell ' + have + ' share' + (have === 1 ? '' : 's') + ' of ' + sel + '.' : 'You don\'t have any ' + sel + ' to sell.', true);
    }
    var desc = (side === 'buy' ? 'Buy ' : 'Sell ') + q + ' ' + sel + ' · ' + (o.type === 'market' ? 'market order' : o.type + ' @ ' + fmt(o.limit || o.stop)) +
      (o.bracket ? ' · stop-loss ' + (o.bracket.sl ? fmt(o.bracket.sl) : 'none') + ', take-profit ' + (o.bracket.tp ? fmt(o.bracket.tp) : 'none') : '');
    $('ptConfirmText').innerHTML = '<b>' + esc(desc) + '</b><br>' + esc($('ptWhen').textContent) + (side === 'buy' ? '<br>Estimated ' + money(q * (o.limit || o.stop || px)) + ' of your ' + money(buyingPower()) + ' buying power.' : '');
    $('ptConfirm').hidden = false; $('ptConfirmGo').focus();
    $('ptConfirmGo').onclick = function () { $('ptConfirm').hidden = true; place(o); };
  }
  function place(f) {
    var o = newOrder(f);
    acct.orders.push(o);
    // market orders during the session fill now at the price on screen
    if (o.type === 'market' && marketOpen()) fill(o, price(o.sym), todayNY());
    else processOrders();
    save(); renderAll();
    if (o.status === 'filled') toast((o.side === 'buy' ? 'Bought ' : 'Sold ') + o.qty + ' ' + o.sym + ' @ ' + fmt(o.fillPrice));
    else if (o.status === 'open') toast('Order placed: ' + o.side + ' ' + o.qty + ' ' + o.sym + (o.type === 'market' ? ' at the next open' : ' ' + o.type + ' @ ' + fmt(o.limit || o.stop)));
    else toast('Order ' + o.status + (o.note ? ': ' + esc(o.note) : ''), true);
    $('ptQty').value = '';
    renderTicket();
  }
  function snapshotEquity() { acct.equityDays[todayNY()] = Math.round(equity() * 100) / 100; }

  // ------------------------------------------------------------ wiring
  function tick() {
    Object.keys(NAMES).forEach(buildSeries);
    var changed = processOrders();
    snapshotEquity();
    if (changed) { save(); var last = acct.fills[acct.fills.length - 1]; if (last && Date.now() - last.at < 5000) toast('Filled: ' + (last.side === 'buy' ? 'bought ' : 'sold ') + last.qty + ' ' + last.sym + ' @ ' + fmt(last.price)); }
    renderAll();
  }

  function start() {
    acct = load();
    chart = new TC.TradeChart($('ptChart'));
    $('ptWatch').addEventListener('click', function (e) { var b = e.target.closest('[data-sym]'); if (b) selectSymbol(b.getAttribute('data-sym')); });
    $('ptSearch').addEventListener('input', renderWatch);
    $('ptBuy').addEventListener('click', function () { side = 'buy'; renderTicket(); });
    $('ptSell').addEventListener('click', function () { side = 'sell'; renderTicket(); });
    document.querySelectorAll('[name="ptType"]').forEach(function (r) { r.addEventListener('change', function () { ticket.type = r.value; if (r.value !== 'market' && !$('ptLimit').value) { $('ptLimit').value = fmt(price(sel)); $('ptStopPx').value = fmt(price(sel)); } renderTicket(); }); });
    $('ptQtyMode').addEventListener('click', function () { ticket.qtyMode = ticket.qtyMode === 'shares' ? 'dollars' : 'shares'; this.textContent = ticket.qtyMode === 'shares' ? 'Use $ amount' : 'Use shares'; $('ptQty').value = ''; renderTicket(); });
    ['ptQty', 'ptLimit', 'ptStopPx', 'ptTif'].forEach(function (id) { $(id).addEventListener('input', renderTicket); });
    $('ptUseBracket').addEventListener('change', function () { $('ptBracketFields').hidden = !this.checked; if (this.checked && !$('ptSL').value) { var p = price(sel); $('ptSL').value = fmt(p * 0.95); $('ptTP').value = fmt(p * 1.10); } });
    $('ptSubmit').addEventListener('click', review);
    $('ptConfirmCancel').addEventListener('click', function () { $('ptConfirm').hidden = true; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') $('ptConfirm').hidden = true; });
    document.querySelectorAll('.pt-tab').forEach(function (t) { t.addEventListener('click', function () { tab = t.getAttribute('data-tab'); renderTabs(); }); });
    $('ptTabBody').addEventListener('click', function (e) {
      var s = e.target.getAttribute('data-sym'), c = e.target.getAttribute('data-cancel'), cl = e.target.getAttribute('data-close');
      if (s) { selectSymbol(s); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      if (c) { acct.orders.forEach(function (o) { if (o.id === c && o.status === 'open') { o.status = 'cancelled'; o.note = 'Cancelled by you'; } }); save(); renderAll(); toast('Order cancelled.'); }
      if (cl) { selectSymbol(cl); side = 'sell'; ticket.type = 'market'; document.querySelector('[name="ptType"][value="market"]').checked = true; ticket.qtyMode = 'shares'; $('ptQtyMode').textContent = 'Use $ amount'; $('ptQty').value = acct.positions[cl].qty - reservedShares(cl); renderAll(); review(); }
    });
    document.querySelectorAll('[data-range]').forEach(function (b) { b.addEventListener('click', function () { var r = b.getAttribute('data-range'); chart.setRange(r === 'all' ? 'all' : +r); document.querySelectorAll('[data-range]').forEach(function (x) { x.classList.toggle('is-on', x === b); }); }); });
    document.querySelectorAll('[data-ind]').forEach(function (b) {
      var k = b.getAttribute('data-ind'); b.classList.toggle('is-on', !!chart.show[k]);
      b.addEventListener('click', function () { chart.show[k] = !chart.show[k]; b.classList.toggle('is-on', chart.show[k]); chart.draw(); });
    });
    $('ptZoomIn').addEventListener('click', function () { chart.zoom(1 / 1.3); });
    $('ptZoomOut').addEventListener('click', function () { chart.zoom(1.3); });

    fetch('../data/game-charts.json').then(function (r) { return r.json(); }).then(function (j) {
      hist = j.symbols; tick();
    }).catch(function () { toast('Couldn\'t load price history. Refresh to try again.', true); });

    // live data + account sync (Firestore)
    var cfg = window.ZELOS_FIREBASE_CONFIG;
    if (window.firebase && cfg && cfg.projectId) {
      try {
        if (!firebase.apps.length) firebase.initializeApp(cfg);
        db = firebase.firestore();
        db.collection('markets').doc('quotes').onSnapshot(function (snap) {
          if (!snap.exists) { feed = { state: 'none' }; return tick(); }
          var d = snap.data() || {};
          quotes = {};
          Object.keys(d.quotes || {}).forEach(function (s) { var q = d.quotes[s]; q.date = q.t ? nyParts(new Date(q.t * 1000)).date : d.date; quotes[s] = q; });
          var fresh = d.updatedAt && Date.now() - new Date(d.updatedAt).getTime() < 3 * 60 * 1000;
          // on an error the last good prices stay on screen; the header says what's wrong
          feed = { state: d.error ? 'error' : fresh ? 'live' : 'closed', error: d.error, updatedAt: d.updatedAt };
          tick();
        }, function () { feed = { state: 'none' }; tick(); });
        db.collection('markets').doc('dailyBars').onSnapshot(function (snap) {
          var b = (snap.exists && snap.data().bars) || {};
          extra = {};
          Object.keys(b).forEach(function (s) { extra[s] = (b[s] || []).map(function (r) { var p = String(r).split(','); return [p[0], +p[1], +p[2], +p[3], +p[4], +p[5] || 0]; }); });
          tick();
        }, function () {});
        firebase.auth().onAuthStateChanged(function (user) {
          currentUser = user && !user.isAnonymous ? user : null;
          $('ptSync').textContent = currentUser ? 'Saved to your account' : 'Saved in this browser · sign in to keep it everywhere';
          if (!currentUser) return;
          db.collection('users').doc(currentUser.uid).get().then(function (doc) {
            var remote = doc.exists && doc.data().practice;
            if (remote && remote.v === 1 && (remote.updatedAt || 0) > (acct.updatedAt || 0)) { acct = remote; try { localStorage.setItem(KEY, JSON.stringify(acct)); } catch (e) {} tick(); }
            else save();
          }).catch(function () {});
        });
      } catch (e) { feed = { state: 'none' }; }
    } else feed = { state: 'none' };
    setInterval(function () { renderHeader(); if (marketOpen()) tick(); }, 15000);
  }
  document.addEventListener('DOMContentLoaded', start);
})();
