/*!
 * Zelos Trade War matches (practice/war.html): equal buy-in virtual competitions.
 *
 *   war.html          redirects to the Trade War home (practice/index.html)
 *   war.html?w=<id>   one match: lobby (join / start), live (trade + leaderboard), results
 *
 * Last Man Standing matches (war.lms) add elimination rules: knocked-out players
 * show as OUT on the board, everyone sees a short elimination banner when it
 * happens, and the last trader standing wins.
 *
 * The browser never writes match data. Every action calls a Cloud Function
 * (tw_create, tw_join, tw_leave, tw_start, tw_cancel, tw_trade in
 * functions/main.py) that checks the rules server-side and prices trades from
 * the server's own quotes. This page only reads: tradeWars/{id}, its
 * accounts/* (leaderboard, players only) and books/{you} (your positions).
 * Virtual money only; separate from the Main account.
 */
(function () {
  'use strict';
  var SITE = 'https://agentictrading.info';
  var $ = function (id) { return document.getElementById(id); };
  var db, auth, fns, user = null, unsubs = [], quotes = {}, quoteDoc = {}, universe = [], warId = null, war = null, accounts = [], book = null, books = {}, events = [], prevRanks = {};
  var ticket = { sym: 'AAPL', qty: 1 };
  // Trade War chart (practice-chart.js): daily history + live FMP quote, your entry and fills,
  // Fibonacci, and the Trade War price alerts shared with the $10,000 account.
  var CH = window.ZelosChallenge; // Last Man Standing rule text (zelos-challenge.js)
  var OUT_WHY = { floor: 'hit the P&L floor', bigLoss: 'took too big a loss on one trade', losses: 'ran out of losing trades', cut: 'finished last at the timed cut', surrender: 'surrendered' };
  var TC = window.ZelosTradeChart, hist = {}, extra = {}, chartEl = null, chart = null, fibOn = false;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // name in the trader's purchased color (zelos-tokens.js paints [data-zname])
  function zn(uid) { return uid ? ' data-zname="' + esc(uid) + '"' : ''; }
  function money(v, d) { d = d == null ? 2 : d; v = +v || 0; return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function signed(v) { return (v >= 0 ? '+' : '-') + money(Math.abs(v)); }
  function pct(v) { v = +v || 0; return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; }
  function cls(v) { return v > 0 ? 'up' : v < 0 ? 'dn' : ''; }
  function body(h) {
    var f = document.activeElement && document.activeElement.id; // keep typing focus across live re-renders
    $('twBody').innerHTML = h; if (window.ZelosProfile) ZelosProfile.help.apply($('twBody'));
    var el = f && $(f); if (el && el.focus) { el.focus(); try { var n = String(el.value || '').length; el.setSelectionRange(n, n); } catch (e) {} }
  }
  function call(name, data) { return fns.httpsCallable(name)(data).then(function (r) { return r.data; }); }
  function errText(e) { return (e && e.message ? String(e.message) : String(e || 'Something went wrong.')).replace(/^(FirebaseError: )?/, ''); }
  function stop() { unsubs.forEach(function (u) { try { u(); } catch (e) {} }); unsubs = []; }
  function left(ms) {
    if (ms <= 0) return 'ending now';
    var d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
    return d ? d + 'd ' + h + 'h left' : h ? h + 'h ' + m + 'm left' : m + 'm left';
  }
  function link(id) { return SITE + '/practice/war.html?w=' + encodeURIComponent(id); }
  function tradable() {
    var age = quoteDoc.updatedAt ? (Date.now() - new Date(quoteDoc.updatedAt).getTime()) / 1000 : 1e9;
    return !!quoteDoc.marketOpen && age < 180;
  }
  var AUTH_MSG = '<p class="pt-auth-msg" id="twAuthMsg" role="alert" hidden></p>';
  function signIn() {
    var msg = $('twAuthMsg'), show = function (t) { if (msg) { msg.textContent = t; msg.hidden = false; } else alert(t); };
    if (window.ZelosSignIn) return ZelosSignIn.google(show);
    auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(function (e) { show(e.message || e); });
  }
  function R(w) { return (w && w.rules) || {}; }
  function rulesBox(w) {
    return '<div class="tw-rules" data-help="These rules are enforced by the server, so nobody can change their balance or buy-in.">' +
      '<b>Rules</b><ul>' +
      '<li>Everyone starts with the same <b>' + money(w.buyIn, 0) + '</b> of virtual money. The buy-in is locked once the match starts.</li>' +
      '<li>No adding or withdrawing money during the match. Only match money can be used.</li>' +
      '<li>Stocks only, long only (buy, then sell what you own). Market orders fill at the live price during market hours.</li>' +
      (R(w).symbols ? '<li>Squad rule: only these stocks can be traded: <b>' + R(w).symbols.map(esc).join(', ') + '</b>.</li>' : '') +
      (R(w).viewTrades ? '<li>Squad rule: every player can see everyone\'s trades.</li>' : '') +
      (CH ? CH.modesText(w.modes).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') : '') +
      (w.lms ? '' : '<li>Ranked by % gain after ' + w.days + ' day' + (w.days === 1 ? '' : 's') + '. Virtual money only: no cash value, no prizes.</li>') + '</ul>' +
      (w.lms ? '<div class="tw-lms-rules"><b>&#9760; Last Man Standing</b><ul>' + (CH ? CH.lmsRules(w.lms, w.buyIn) : []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') +
        '<li>Knocked out = your stocks are sold at the current price and your result is locked.</li><li>The last trader standing wins. If time runs out first, survivors are ranked by % gain, above everyone knocked out. Virtual money only.</li></ul></div>' : '') + '</div>';
  }

  // ------------------------------------------------------------ hub
  function hub() { location.replace('index.html' + (location.hash || '')); } // one Trade War: matches live on the Trade War home

  // ------------------------------------------------------------ one match
  function view(id) {
    stop(); warId = id; war = null; accounts = []; book = null; events = []; prevRanks = {};
    body('<p class="pt-empty">Loading Trade War…</p>');
    var ref = db.collection('tradeWars').doc(id);
    unsubs.push(ref.onSnapshot(function (d) {
      if (!d.exists) { body('<div class="pf-missing"><h1>Trade War not found</h1><p>The link may be wrong.</p><a class="pt-btn pt-btn-go" href="war.html">Your Trade Wars</a></div>'); return; }
      var first = !war; war = Object.assign({ id: d.id }, d.data());
      var mine = user && war.players.indexOf(user.uid) !== -1;
      if (first || mine !== !!unsubs.mine) watchPlayer(ref, mine);
      render();
    }, function () { body('<p class="pt-empty">Sign in to open this Trade War.</p>'); }));
  }
  function watchPlayer(ref, mine) {
    if (!mine || unsubs.mine) return;
    unsubs.mine = true;
    unsubs.push(ref.collection('accounts').onSnapshot(function (s) { accounts = []; s.forEach(function (d) { accounts.push(Object.assign({ uid: d.id }, d.data())); }); render(); }, function () {}));
    unsubs.push(ref.collection('books').doc(user.uid).onSnapshot(function (d) { book = d.exists ? d.data() : null; render(); }, function () {}));
    unsubs.push(ref.collection('events').orderBy('at', 'desc').limit(30).onSnapshot(function (s) { events = []; s.forEach(function (d) { events.push(d.data()); }); drawTicker(); }, function () {}));
    if (R(war).viewTrades) unsubs.push(ref.collection('books').onSnapshot(function (s) { books = {}; s.forEach(function (d) { books[d.id] = d.data(); }); render(); }, function () {}));
  }
  function board(rows, final) {
    rows = rows.slice().sort(function (a, b) { return ((a.out ? 1 : 0) - (b.out ? 1 : 0)) || (a.out ? (a.place || 0) - (b.place || 0) : 0) || (b.pnlPct - a.pnlPct) || (b.pnl - a.pnl); });
    var ranks = {};
    var h = '<div class="tw-board" role="table" aria-label="Trade War leaderboard"><div class="tw-tr tw-th" role="row"><span>#</span><span>Trader</span><span>Start</span><span>' + (final ? 'Final' : 'Current') + '</span><span>$ P&amp;L</span><span>% P&amp;L</span><span>Trades</span><span>W/L</span></div>' +
      rows.map(function (r, i) {
        var rank = final ? r.rank : i + 1, was = prevRanks[r.uid]; ranks[r.uid] = rank;
        var move = !final && was && was !== rank ? (rank < was ? '<i class="tw-mv up" aria-label="up">▲</i>' : '<i class="tw-mv dn" aria-label="down">▼</i>') : '';
        var me = user && r.uid === user.uid;
        return '<a class="tw-tr' + (me ? ' is-me' : '') + (move ? ' is-moved' : '') + (r.out ? ' is-out' : '') + '" role="row" href="profile.html?u=' + encodeURIComponent(r.uid) + '"><span>' + (final && rank === 1 ? '🏆' : rank) + move + '</span><span><b' + zn(r.uid) + '>' + esc(r.name || 'Trader') + '</b>' + (me ? ' <small>you</small>' : '') + (r.out ? ' <small class="tw-out-tag" title="' + esc(OUT_WHY[r.outReason] || 'knocked out') + '">OUT</small>' : '') + roleTags(r.uid) + '</span>' +
          '<span>' + money(r.start, 0) + '</span><span>' + money(final ? r.final : r.equity) + '</span><span class="' + cls(r.pnl) + '">' + signed(r.pnl) + '</span><span class="' + cls(r.pnlPct) + '"><b>' + pct(r.pnlPct) + '</b></span>' +
          '<span>' + (r.trades || 0) + '</span><span>' + (r.wins || 0) + '/' + (r.losses || 0) + '</span></a>';
      }).join('') + '</div>';
    if (!final) prevRanks = ranks;
    return h;
  }
  function render() {
    if (!war) return;
    var w = war, mine = user && w.players.indexOf(user.uid) !== -1, host = user && w.host === user.uid;
    var status = w.status === 'active' ? '<span class="tw-st is-live">LIVE · ' + left(w.endAt - Date.now()) + '</span>' : w.status === 'lobby' ? '<span class="tw-st">Lobby · waiting to start</span>'
      : w.status === 'draft' ? '<span class="tw-st is-live">DRAFT</span>'
      : w.status === 'ended' ? '<span class="tw-st is-done">Finished</span>' : '<span class="tw-st is-done">Cancelled</span>';
    if (w.lms) status = '<span class="tw-st is-lms">&#9760; LAST MAN STANDING</span> ' + status;
    var meAcct = user && (accounts || []).filter(function (a) { return a.uid === user.uid; })[0];
    var canMore = mine && (w.status === 'lobby' || (w.status === 'active' && !(meAcct && meAcct.out)));
    var h = '<div class="ch-hero">' + (canMore ? '<button type="button" class="tw-more" id="twMore" aria-label="More: ' + (w.status === 'lobby' ? (host ? 'invite or cancel' : 'leave') : 'surrender') + '" aria-haspopup="dialog">&#8943;</button>' : '') + '<span class="pt-kicker"><span class="zm-tag is-war">TRADE WAR — VIRTUAL</span> ' + status + '</span><h1>' + (w.lms ? '&#9760;' : '⚔️') + ' ' + esc(w.name) + '</h1>' +
      '<p>Hosted by <span' + zn(w.host) + '>' + esc(w.hostName || 'a trader') + '</span> · <b>' + money(w.buyIn, 0) + '</b> virtual buy-in · ' + w.days + ' day' + (w.days === 1 ? '' : 's') + ' · ' + w.players.length + '/' + w.maxPlayers + ' players</p></div>';
    if (w.status === 'cancelled') { body(h + '<div class="pt-card ch-card"><p>The host cancelled this Trade War before it started.</p><a class="pt-btn pt-btn-go" href="war.html">Your Trade Wars</a></div>'); return; }
    if (w.status === 'lobby') {
      var waiting = (w.invited || []).filter(function (u) { return w.players.indexOf(u) === -1; }).length;
      h += '<div class="tw-grid"><section class="pt-card ch-card"><h2>Players</h2><ul class="tw-players">' + w.players.map(function (u) { return '<li><span' + zn(u) + '>' + esc((w.names || {})[u] || 'Trader') + '</span>' + (u === w.host ? ' <small>host</small>' : '') + '</li>'; }).join('') + '</ul>' +
        (waiting ? '<p class="pt-fine">&#9203; Waiting for ' + waiting + ' challenged player' + (waiting === 1 ? '' : 's') + ' to accept.' + (w.mode === 'duel' ? ' The Trade War starts as soon as they do.' : '') + '</p>' : '');
      if (!user) h += '<button class="pt-btn pt-btn-go" type="button" id="twSignIn">Sign in to join</button>' + AUTH_MSG;
      else if (!mine) h += '<button class="pt-btn pt-btn-go" type="button" id="twJoin">Join with ' + money(w.buyIn, 0) + ' virtual</button><p class="pt-fine">You\'ll start with exactly the same virtual money as everyone else. Nothing is taken from your $10,000 account.</p>';
      else if (host) h += '<div class="pt-soc-row"><button class="pt-btn pt-btn-go" type="button" id="twStart"' + (w.players.length < 2 ? ' disabled' : '') + '>Start the Trade War</button><button class="pt-mini" type="button" id="twCancel">Cancel</button></div>' + (w.players.length < 2 ? '<p class="pt-fine">Invite at least one opponent to start.</p>' : '<p class="pt-fine">Starting locks the buy-in and starts the ' + w.days + '-day clock.</p>');
      else h += '<p class="pt-fine">Waiting for the host to start.</p><button class="pt-mini" type="button" id="twLeave">Leave</button>';
      h += '<p class="pt-auth-msg" id="twMsg" role="alert" hidden></p></section><section class="pt-card ch-card">' + (mine ? '<h2>Invite friends</h2><div class="pt-invite"><input readonly value="' + esc(link(w.id)) + '"><button class="pt-mini pt-soc" type="button" id="twShare">Share invite</button></div>' : '') + rulesBox(w) + '</section></div>';
      body(h); wireLobby(); return;
    }
    if (w.status === 'ended') {
      var res = w.results || [], win = res[0];
      var survivors = res.filter(function (r) { return !r.out; }).length;
      h += (win ? '<div class="pt-card ch-card tw-winner' + (w.lms ? ' is-lms' : '') + '"><span class="pt-kicker">' + (w.lms ? (survivors === 1 ? 'Last Man Standing' : 'Winner · ' + survivors + ' still standing at the bell') : 'Winner') + '</span><h2>🏆 <span' + zn(win.uid) + '>' + esc(win.name) + '</span> <span class="' + cls(win.pnlPct) + '">' + pct(win.pnlPct) + '</span></h2><p class="pt-fine">' +
        (w.lms && survivors === 1 ? 'Outlasted ' + (res.length - 1) + ' trader' + (res.length === 2 ? '' : 's') + '. Final results are locked.' : 'Final results, frozen when the clock ran out.') + '</p></div>' : '') +
        ((w.rewards || []).length ? '<div class="pt-card ch-card tw-rewards"><h2>🪙 Token rewards</h2>' + w.rewards.map(function (r) { return '<p><b' + zn(r.uid) + '>' + esc((w.names || {})[r.uid] || 'Trader') + '</b> earned <b>' + r.tokens + ' tokens</b> <small class="pt-fine">' + esc(r.note) + '</small></p>'; }).join('') + '</div>' : '') +
        '<section class="pt-card ch-card"><h2>Final standings</h2>' + board(res, true) + '</section>' + (w.lms ? outsBox(w) : '');
      body(h); if (w.lms) announceOuts(w); return;
    }
    if (w.status === 'draft') { body(h + (mine ? draftView(w) + '<div id="twTickerSlot"></div>' : '<div class="pt-card ch-card"><p>This Trade War is drafting. Only its players can watch.</p></div>')); wireDraft(w); drawTicker(); return; }
    // live
    if (!mine) { body(h + '<div class="pt-card ch-card"><p>This Trade War is live. Only its players can see the leaderboard.</p><a class="pt-btn pt-btn-go" href="war.html">Your Trade Wars</a></div>'); return; }
    var me = accounts.filter(function (a) { return a.uid === user.uid; })[0] || {};
    var only = myPicks(w) || R(w).symbols;
    if (only && only.indexOf(ticket.sym) === -1) ticket.sym = only[0];
    var storm = stormNow(w), halted = storm && storm.kind === 'halt' && storm.sym === ticket.sym;
    var pos = (book && book.positions) || {}, q = quotes[ticket.sym] || {}, px = q.c, open = tradable();
    var liveEq = (me.cash || 0) + Object.keys(pos).reduce(function (t, s) { return t + pos[s].qty * ((quotes[s] && quotes[s].c) || pos[s].avg); }, 0);
    var livePnl = liveEq - (me.start || w.buyIn);
    if (me.out) { liveEq = me.equity; livePnl = me.pnl; open = false; }
    var canTrade = open && !halted;
    h += '<div id="twTickerSlot"></div>' + stormBar(storm);
    if (w.lms) {
      var alive = (w.alive || w.players).length;
      h += '<div class="tw-lms-bar"><span><b>' + alive + '</b> of ' + w.players.length + ' still standing</span>' +
        (w.lms.cutHours && w.nextCutAt ? '<span>Next cut: last place ' + (w.nextCutAt > Date.now() ? 'in <b>' + left(w.nextCutAt - Date.now()).replace(' left', '') + '</b>' : '<b>any moment</b>') + '</span>' : '') +
        '<span>' + (CH ? CH.lmsRules(w.lms, w.buyIn).filter(function (t) { return !/^Every/.test(t); }).map(esc).join(' · ') : '') + '</span></div>';
      if (me.out) h += '<div class="pt-card ch-card tw-you-out" role="status"><b>You\'re out.</b> You ' + esc(OUT_WHY[me.outReason] || 'were knocked out') + '. Your stocks were sold and your result is locked: <b class="' + cls(me.pnlPct) + '">' + pct(me.pnlPct) + '</b>, finishing <b>#' + me.place + '</b> of ' + w.players.length + '. Stay and watch who\'s left standing.</div>';
    }
    h += '<div id="twChartSlot"></div><div class="tw-live"><section class="pt-card ch-card tw-acct">' +
      '<h2 data-help="Your match account. It started at the buy-in, like everyone else\'s, and only changes when you trade or prices move.">Your match account</h2><div class="pf-mini"><span><small>Balance</small><b>' + money(liveEq) + '</b></span><span><small>Cash</small><b>' + money(me.cash) + '</b></span>' +
      '<span><small>P&amp;L</small><b class="' + cls(livePnl) + '">' + signed(livePnl) + '</b></span><span><small>% P&amp;L</small><b class="' + cls(livePnl) + '">' + pct(livePnl / (me.start || w.buyIn) * 100) + '</b></span></div>' +
      '<h2 style="margin-top:14px">Trade</h2><div class="tw-ticket"><select id="twSym" aria-label="Stock">' + universe.filter(function (u) { return !only || only.indexOf(u.sym) !== -1; }).map(function (u) { return '<option value="' + u.sym + '"' + (u.sym === ticket.sym ? ' selected' : '') + '>' + u.sym + ' · ' + esc(u.name) + '</option>'; }).join('') + '</select>' +
      '<div class="tw-px"><b>' + (px ? money(px) : '–') + '</b><small>' + (open ? 'live price' : 'market closed') + '</small></div>' +
      '<label class="tw-f"><span>Shares</span><input id="twQty" type="number" min="1" step="1" value="' + ticket.qty + '"></label>' +
      sltpRow(pos[ticket.sym], px) +
      '<div class="tw-est" id="twEst">' + (px ? '≈ ' + money(px * ticket.qty) + ' · you have ' + money(me.cash) + ' cash · you hold ' + ((pos[ticket.sym] || {}).qty || 0) : '') + '</div>' +
      '<div class="tw-actions"><button class="pt-submit is-buy" type="button" id="twBuy"' + (canTrade ? '' : ' disabled') + '><span class="pt-sub-main">Buy ' + esc(ticket.sym) + '</span><span class="pt-sub-meta">market</span></button>' +
      '<button class="pt-submit is-sell" type="button" id="twSell"' + (canTrade && pos[ticket.sym] ? '' : ' disabled') + '><span class="pt-sub-main">Sell ' + esc(ticket.sym) + '</span><span class="pt-sub-meta">' + ((pos[ticket.sym] || {}).qty ? 'you hold ' + pos[ticket.sym].qty : 'nothing to sell') + '</span></button></div>' +
      '<p class="pt-auth-msg" id="twMsg" role="alert" hidden></p>' + (halted ? '<p class="pt-fine tw-storm-note">' + esc(ticket.sym) + ' is halted by the storm. Pick another stock or wait it out.</p>' : storm && storm.kind === 'fee' ? '<p class="pt-fine tw-storm-note">Storm: every trade costs a 1% virtual fee right now.</p>' : '') +
      (myPicks(w) ? '<p class="pt-fine">Your draft: <b>' + myPicks(w).map(esc).join(', ') + '</b>. You can only trade these.</p>' : '') + (me.out ? '<p class="pt-fine">You\'ve been knocked out, so trading is closed for you.</p>' : open ? '' : '<p class="pt-fine">Trades fill during market hours (9:30 am to 4:00 pm New York time).</p>') + '</div>' +
      '<h2 style="margin-top:14px">Your positions</h2>' + (Object.keys(pos).length ? '<div class="tw-pos">' + Object.keys(pos).map(function (s) {
        var p = pos[s], c = (quotes[s] && quotes[s].c) || p.avg, g = (c - p.avg) * p.qty;
        return '<button type="button" class="tw-pos-row" data-sym="' + s + '"><b>' + s + '</b><span>' + p.qty + ' @ ' + money(p.avg) + '</span><span>' + money(c * p.qty) + '</span><span class="' + cls(g) + '">' + signed(g) + '</span></button>';
      }).join('') + '</div>' : '<p class="pt-empty">No positions yet. Pick a stock and buy to get on the board.</p>') +
      '</section><section class="pt-card ch-card"><h2>Leaderboard</h2>' + board(accounts, false) + (w.lms ? outsBox(w) : '') + (R(w).viewTrades ? feedBox() : '') + (M(w).bounties ? bountyBox(w, me) : '') +
      '<p class="pt-fine">Updated after every trade and every 5 minutes. Ranked by % gain: everyone started with ' + money(w.buyIn, 0) + '.</p>' + rulesBox(w) + '</section></div>';
    body(h); wireLive(me, pos); announceOuts(w); wireBounty(w); drawTicker();
    ensureChart(); if (chartEl) { $('twChartSlot').appendChild(chartEl); drawChart(); }
  }
  // ------------------------------------------------------------ advanced gameplay
  function M(w) { return (w && w.modes) || {}; }
  function myPicks(w) { var d = w.draft; return M(w).draft && d && d.picks && user ? d.picks[user.uid] || null : null; }
  function stormNow(w) { var st = w.storm; return st && st.start <= Date.now() && Date.now() < st.end ? st : null; }
  var STORM_TXT = { double: 'Double or nothing: profits and losses on sells count twice', fee: 'Choppy water: every trade costs a 1% virtual fee', halt: 'Trading halt on ' };
  function stormBar(st) {
    if (!st) return '';
    return '<div class="tw-storm" role="status"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3 5 13h6l-1 8 8-10h-6l1-8z"/></svg><div><b>VOLATILITY STORM</b> <small>virtual game event · ' + left(st.end - Date.now()).replace(' left', '') + ' left</small><br>' +
      esc(STORM_TXT[st.kind] + (st.kind === 'halt' ? st.sym + ': it can\'t be traded' : '')) + '</div></div>';
  }
  function roleTags(uid) {
    var w = war || {}, t = '';
    if ((w.whales || []).indexOf(uid) !== -1) t += ' <small class="tw-role is-whale" title="Whale: max ' + M(w).whale.capPct + '% of the account in one stock">WHALE</small>';
    var sh = (w.shields || {})[uid];
    if (sh) t += ' <small class="tw-role is-shield" title="Shield Tokens: cancel a bounty on you or survive a timed cut">' + sh + ' SHIELD' + (sh === 1 ? '' : 'S') + '</small>';
    if ((w.bounties || []).some(function (b) { return b.status === 'open' && b.target === uid; })) t += ' <small class="tw-role is-bounty" title="There\'s a bounty on this trader">WANTED</small>';
    return t;
  }
  // Battlefield Ticker: server-written events (tradeWars/{id}/events)
  var TICK_ICON = { bracket: 'target', big: 'bolt', lead: 'crown', out: 'skull', bounty: 'target', shield: 'shield', storm: 'bolt', draft: 'flag', start: 'flag', win: 'trophy', whale: 'users', reward: 'trophy' };
  function drawTicker() {
    var slot = $('twTickerSlot'); if (!slot) return;
    if (!events.length) { slot.innerHTML = ''; return; }
    var ico = function (k) { return window.ZelosIcons && ZelosIcons.names.indexOf(TICK_ICON[k]) !== -1 ? ZelosIcons.icon(TICK_ICON[k]) : ''; };
    var item = function (e) { return '<span class="tw-tick is-' + esc(e.kind) + '">' + ico(e.kind) + esc(e.text) + '<small>' + new Date(e.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + '</small></span>'; };
    var row = events.slice(0, 12).map(item).join('');
    slot.innerHTML = '<div class="tw-ticker" aria-label="Battlefield Ticker"><span class="tw-ticker-lbl">BATTLEFIELD</span><div class="tw-ticker-win"><div class="tw-ticker-run">' + row + row + '</div></div>' +
      '<details class="tw-ticker-all"><summary>All</summary><div>' + events.map(item).join('') + '</div></details></div>';
  }
  // Draft: snake order, 45 s a pick; when a clock runs out anyone's page asks the server to auto-pick
  var draftTimer = null, draftNudged = -1;
  function draftView(w) {
    var d = w.draft, names = w.names || {}, onClock = draftOnClock(d), mineNow = user && onClock === user.uid;
    var uni = (R(w).symbols || universe.map(function (u) { return u.sym; })).slice().sort();
    var owner = {}; Object.keys(d.picks).forEach(function (u) { d.picks[u].forEach(function (x) { owner[x] = u; }); });
    return '<div class="tw-draft"><section class="pt-card ch-card"><div class="tw-draft-top"><div><span class="pt-kicker">Pre-battle draft · pick ' + Math.min(d.turn + 1, d.total) + ' of ' + d.total + '</span>' +
      '<h2>' + (mineNow ? 'Your pick' : esc(names[onClock] || 'Trader') + ' is picking') + '</h2></div><b class="tw-draft-clock" id="twDraftClock"></b></div>' +
      '<p class="pt-fine">Each player drafts ' + d.per + ' stocks in a snake order. Once the draft ends the Trade War starts, and you can only trade the stocks you drafted. Run out of time and the server picks for you.</p>' +
      '<div class="tw-draft-grid" role="list">' + uni.map(function (x) {
        var who = owner[x];
        return '<button type="button" role="listitem" class="tw-dpick' + (who ? ' is-taken' + (user && who === user.uid ? ' is-mine' : '') : '') + '" data-dsym="' + esc(x) + '"' + (who || !mineNow ? ' disabled' : '') + '><b>' + esc(x) + '</b>' + (who ? '<small>' + esc(names[who] || 'Trader') + '</small>' : '') + '</button>';
      }).join('') + '</div><p class="pt-auth-msg" id="twMsg" role="alert" hidden></p></section>' +
      '<section class="pt-card ch-card"><h2>Draft order</h2><ol class="tw-draft-order">' + d.order.map(function (u) {
        return '<li class="' + (u === onClock ? 'is-on' : '') + '"><b>' + esc(names[u] || 'Trader') + (user && u === user.uid ? ' <small>you</small>' : '') + '</b><span>' + (d.picks[u].length ? d.picks[u].map(esc).join(', ') : '–') + '</span></li>';
      }).join('') + '</ol>' + rulesBox(w) + '</section></div>';
  }
  function draftOnClock(d) { var n = d.order.length, r = Math.floor(d.turn / n), p = d.turn % n; return d.order[r % 2 === 0 ? p : n - 1 - p]; }
  function wireDraft(w) {
    document.querySelectorAll('[data-dsym]').forEach(function (b) { b.onclick = function () {
      var x = b.getAttribute('data-dsym'); document.querySelectorAll('[data-dsym]').forEach(function (y) { y.disabled = true; });
      call('tw_draft_pick', { warId: warId, sym: x }).catch(function (e) { msg(errText(e)); render(); });
    }; });
    clearInterval(draftTimer);
    var tick = function () {
      var el = $('twDraftClock'); if (!el || !war || war.status !== 'draft') { clearInterval(draftTimer); return; }
      var ms = war.draft.deadline - Date.now(); el.textContent = ms > 0 ? Math.ceil(ms / 1000) + 's' : '0s';
      el.classList.toggle('is-low', ms < 10000);
      if (ms < -1500 && draftNudged !== war.draft.turn) { draftNudged = war.draft.turn; call('tw_draft_pick', { warId: warId }).catch(function () {}); }
    };
    tick(); draftTimer = setInterval(tick, 500);
  }
  // Bounty Board
  var bountyPick = { pct: 5, hours: 24, target: '' };
  function bountyBox(w, me) {
    var names = w.names || {}, list = (w.bounties || []).slice().reverse(), open = list.filter(function (b) { return b.status === 'open'; });
    var myOpen = open.some(function (b) { return b.by === user.uid; }), shields = (w.shields || {})[user.uid] || 0;
    var rivals = (w.alive || w.players).filter(function (u) { return u !== user.uid; });
    if (rivals.indexOf(bountyPick.target) === -1) bountyPick.target = rivals[0] || '';
    var ST = { won: 'claimed by ', defended: 'survived by ', refunded: 'expired', shielded: 'cancelled by a Shield' };
    var h = '<div class="tw-bounty"><h3>Bounty Board</h3>' + (open.length ? open.map(function (b) {
      return '<div class="tw-b-row is-open"><span><b>' + esc(b.byName) + '</b> &rarr; <b>' + esc(b.targetName) + '</b></span><b class="tw-b-amt">' + money(b.amount) + '</b><small>' + left(b.end - Date.now()) + '</small>' +
        (b.target === user.uid && shields ? '<button class="pt-mini" type="button" data-shield="' + esc(b.id) + '">Use a Shield</button>' : '') + '</div>';
    }).join('') : '<p class="pt-empty">No open bounties.</p>') +
      list.filter(function (b) { return b.status !== 'open'; }).slice(0, 4).map(function (b) {
        return '<div class="tw-b-row"><span>' + esc(b.byName) + ' &rarr; ' + esc(b.targetName) + ': ' + (ST[b.status] || b.status) + (b.status === 'won' || b.status === 'defended' ? esc(b.winnerName) : '') + '</span><span class="tw-b-amt">' + money(b.amount) + '</span></div>';
      }).join('');
    if (!me.out && !myOpen && rivals.length && w.endAt - Date.now() > 3600000) {
      var cash = me.cash || 0, eq = me.equity || w.buyIn;
      h += '<div class="tw-b-form"><label>On <select id="twBTarget">' + rivals.map(function (u) { return '<option value="' + esc(u) + '"' + (u === bountyPick.target ? ' selected' : '') + '>' + esc(names[u] || 'Trader') + '</option>'; }).join('') + '</select></label>' +
        '<span class="tw-chips" id="twBPct">' + [2, 5, 10].map(function (p) { return '<button type="button" class="pt-chip' + (bountyPick.pct === p ? ' is-on' : '') + '" data-bpct="' + p + '">' + money(eq * p / 100) + '</button>'; }).join('') + '</span>' +
        '<select id="twBHours" aria-label="Bounty length"><option value="6"' + (bountyPick.hours === 6 ? ' selected' : '') + '>6 hours</option><option value="24"' + (bountyPick.hours === 24 ? ' selected' : '') + '>24 hours</option></select>' +
        '<button class="pt-mini pt-soc" type="button" id="twBPlace">Place bounty</button></div>' +
        '<p class="pt-fine">Paid from your match cash (' + money(cash) + '). When it ends, whoever beat ' + 'the target by the most since it was placed (and traded since) wins it; if nobody did, the target keeps it. One bounty at a time, each rival once per match.</p>';
    } else if (myOpen) h += '<p class="pt-fine">Your bounty is out. You can place another once it settles.</p>';
    return h + '</div>';
  }
  function wireBounty(w) {
    if ($('twBTarget')) $('twBTarget').onchange = function () { bountyPick.target = this.value; };
    if ($('twBHours')) $('twBHours').onchange = function () { bountyPick.hours = +this.value; };
    document.querySelectorAll('[data-bpct]').forEach(function (b) { b.onclick = function () { bountyPick.pct = +b.getAttribute('data-bpct'); render(); }; });
    if ($('twBPlace')) $('twBPlace').onclick = function () {
      var b = this; b.disabled = true;
      call('tw_bounty', { warId: warId, target: bountyPick.target, pct: bountyPick.pct, hours: bountyPick.hours }).then(function (r) { msg('Bounty placed: ' + money(r.amount) + '.', true); }, function (e) { b.disabled = false; msg(errText(e)); });
    };
    document.querySelectorAll('[data-shield]').forEach(function (b) { b.onclick = function () {
      if (!confirm('Use a Shield Token to cancel this bounty? The sponsor gets their money back.')) return;
      b.disabled = true; call('tw_shield', { warId: warId, bountyId: b.getAttribute('data-shield') }).then(function () { msg('Shield up: the bounty is cancelled.', true); }, function (e) { b.disabled = false; msg(errText(e)); });
    }; });
  }

  // Squad setting "view everyone's trades": the latest fills from every player's book.
  function feedBox() {
    var all = [];
    Object.keys(books).forEach(function (u) { ((books[u] || {}).fills || []).forEach(function (f) { all.push(Object.assign({ uid: u }, f)); }); });
    all.sort(function (a, b) { return b.at - a.at; });
    var name = function (u) { return (war.names || {})[u] || 'Trader'; };
    return '<div class="tw-feed"><h3>Everyone\'s trades</h3>' + (all.length ? all.slice(0, 25).map(function (f) {
      return '<div class="tw-feed-row"><span><b' + (user && f.uid === user.uid ? '' : zn(f.uid)) + '>' + esc(user && f.uid === user.uid ? 'You' : name(f.uid)) + '</b> ' + (f.auto === 'sl' ? 'hit their stop loss: sold' : f.auto === 'tp' ? 'took profit: sold' : f.auto ? 'sold out' : f.side === 'buy' ? 'bought' : 'sold') + ' ' + f.qty + ' ' + esc(f.sym) + ' @ ' + money(f.price) + '</span>' +
        (f.pnl != null ? '<span class="' + cls(f.pnl) + '">' + signed(f.pnl) + '</span>' : '<span></span>') + '<small>' + new Date(f.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + '</small></div>';
    }).join('') : '<p class="pt-empty">No trades yet.</p>') + '</div>';
  }
  function outsBox(w) {
    var outs = (w.outs || []).slice().reverse();
    return '<div class="tw-outs"><h3>Eliminations</h3>' + (outs.length ? outs.map(function (o) {
      return '<div class="tw-out-row"><span class="tw-out-x" aria-hidden="true"></span><span><b' + zn(o.uid) + '>' + esc(o.name || 'Trader') + '</b> ' + esc(OUT_WHY[o.reason] || 'was knocked out') + '</span><span class="' + cls(o.pnlPct) + '">' + pct(o.pnlPct) + '</span><span>#' + o.place + '</span></div>';
    }).join('') : '<p class="pt-empty">Nobody is out yet.</p>') + '</div>';
  }
  // A short banner when someone is knocked out. Shown once per elimination per device;
  // eliminations that happened before you opened the page are only listed, not replayed.
  var seenOuts = null;
  function announceOuts(w) {
    var key = 'zelosTwOuts:' + w.id, list = w.outs || [], seen;
    try { seen = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { seen = null; }
    if (seenOuts === null) seenOuts = seen === null ? list.length : seen;
    var fresh = list.slice(Math.min(seenOuts, list.length));
    seenOuts = list.length; try { localStorage.setItem(key, String(list.length)); } catch (e) {}
    fresh.forEach(function (o, i) { setTimeout(function () { banner(o, w); }, i * 2600); });
  }
  function banner(o, w) {
    var me = user && o.uid === user.uid, left_ = (w.alive || []).length, el = document.createElement('div');
    el.className = 'tw-elim' + (me ? ' is-me' : ''); el.setAttribute('role', 'alert');
    el.innerHTML = '<div class="tw-elim-card"><svg class="tw-elim-line" viewBox="0 0 300 40" aria-hidden="true"><polyline points="0,20 70,20 90,6 110,34 130,20 175,20 190,30 300,30"/></svg>' +
      '<p class="tw-elim-kick">' + (me ? 'YOU\'RE OUT' : 'ELIMINATED') + '</p><p class="tw-elim-name">' + esc(me ? 'You' : o.name || 'A trader') + ' ' + esc(OUT_WHY[o.reason] || 'was knocked out') + '</p>' +
      '<p class="tw-elim-meta">Finished #' + o.place + ' · ' + pct(o.pnlPct) + (w.status === 'active' ? ' · ' + left_ + ' still standing' : '') + '</p></div>';
    document.body.appendChild(el);
    var gone = function () { el.classList.add('is-gone'); setTimeout(function () { el.remove(); }, 400); };
    el.onclick = gone; setTimeout(gone, me ? 5500 : 4000);
  }
  // ⋯ menu: invite / cancel (host, lobby), leave (lobby), surrender (live)
  function moreSheet() {
    var w = war, host = user && w.host === user.uid, lobby = w.status === 'lobby';
    var sh = document.createElement('div'); sh.className = 'tw-sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
    var items = lobby ? (host ? '<button type="button" data-m="invite"><b>Invite more traders</b><small>Share the invite link</small></button>' +
        '<button type="button" data-m="cancel" class="is-bad"><b>Cancel this Trade War</b><small>Everyone is told. Nothing goes on anyone\'s record.</small></button>'
        : '<button type="button" data-m="leave" class="is-bad"><b>Leave the lobby</b><small>It hasn\'t started, so nothing counts.</small></button>')
      : '<button type="button" data-m="surrender" class="is-bad"><b>&#127987;&#65039; Surrender</b><small>Out in last place. Counts as a loss.</small></button>';
    sh.innerHTML = '<div class="tw-sheet-card"><div class="tw-sheet-grab"></div><div class="tw-sheet-list">' + items + '<button type="button" data-m="close" class="is-close">Close</button></div></div>';
    document.body.appendChild(sh);
    var close = function () { sh.remove(); };
    sh.addEventListener('click', function (e) {
      if (e.target === sh) return close();
      var b = e.target.closest('[data-m]'); if (!b) return;
      var m = b.getAttribute('data-m');
      if (m === 'close') return close();
      if (m === 'invite') { close(); var sb = $('twShare'); if (sb) { sb.scrollIntoView({ behavior: 'smooth', block: 'center' }); sb.click(); } return; }
      if (m === 'leave' || m === 'cancel') {
        b.disabled = true;
        call(m === 'leave' ? 'tw_leave' : 'tw_cancel', { warId: warId }).then(function () { close(); if (m === 'leave') location.href = 'index.html'; }, function (e2) { b.disabled = false; close(); msg(errText(e2)); });
        return;
      }
      if (m === 'surrender') surrenderConfirm(sh);
    });
  }
  function surrenderConfirm(sh) {
    var n = (war.alive && war.alive.length) || war.players.length;
    sh.querySelector('.tw-sheet-card').innerHTML = '<div class="tw-sheet-grab"></div><div class="tw-flag" aria-hidden="true">&#127987;&#65039;</div><h2>Surrender this Trade War?</h2>' +
      '<p>You\'ll be marked <b>out, last place (#' + n + ' of ' + war.players.length + ')</b>. Your stocks are sold at the current price. It counts as a <b>loss</b> on your record and adds a surrender. ' +
      'You give up any rewards from this battle. The others keep playing.</p>' +
      '<button type="button" class="tw-hold" id="twHold"><i></i><span>Hold to surrender</span></button><button type="button" class="tw-keep" data-m="close">Keep fighting</button><p class="pt-auth-msg" id="twSurrMsg" hidden></p>';
    var hb = $('twHold'), fill = hb.querySelector('i'), timer = null, t0 = 0, done = false;
    function stop() { if (done) return; cancelAnimationFrame(timer); fill.style.width = '0'; }
    function step() {
      var k = Math.min(1, (performance.now() - t0) / 1600); fill.style.width = (k * 100).toFixed(1) + '%';
      if (k < 1) { timer = requestAnimationFrame(step); return; }
      done = true; hb.disabled = true; hb.querySelector('span').textContent = 'Surrendering…';
      call('tw_surrender', { warId: warId }).then(function () { sh.remove(); }, function (e) { var m = $('twSurrMsg'); m.textContent = errText(e); m.hidden = false; hb.querySelector('span').textContent = 'Couldn\'t surrender'; });
    }
    function start(e) { if (done) return; e.preventDefault(); t0 = performance.now(); timer = requestAnimationFrame(step); }
    hb.addEventListener('pointerdown', start); ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { hb.addEventListener(ev, stop); });
    hb.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && !timer) start(e); });
    hb.addEventListener('keyup', function (e) { if (e.key === 'Enter' || e.key === ' ') { stop(); timer = null; } });
  }
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#twMore')) moreSheet(); });
  function msg(t, good) { var m = $('twMsg'); if (!m) return; m.textContent = t; m.hidden = !t; m.classList.toggle('is-ok', !!good); }
  function wireLobby() {
    if ($('twSignIn')) $('twSignIn').onclick = signIn;
    var act = function (btn, name, after) { if (!btn) return; btn.onclick = function () { var b = this; b.disabled = true; call(name, { warId: warId }).then(after || function () {}, function (e) { b.disabled = false; msg(errText(e)); }); }; };
    act($('twJoin'), 'tw_join'); act($('twStart'), 'tw_start');
    act($('twLeave'), 'tw_leave', function () { location.href = 'war.html'; });
    if ($('twCancel')) $('twCancel').onclick = function () { if (!confirm('Cancel this Trade War? Players will see it was cancelled.')) return; var b = this; b.disabled = true; call('tw_cancel', { warId: warId }).catch(function (e) { b.disabled = false; msg(errText(e)); }); };
    if ($('twShare')) $('twShare').onclick = function () { var b = this; var S = window.ZelosSocial; (S && S.shareLink ? S.shareLink('Join my Trade War', 'Join my Trade War "' + war.name + '": everyone starts with ' + money(war.buyIn, 0) + ' of virtual money. Best % gain wins.', link(warId)) : Promise.resolve()).then(function (r) { if (r === 'copied') b.textContent = 'Copied ✓'; }); };
  }
  function sltpRow(p, px) {
    var cur = typed[ticket.sym] || p || plans[ticket.sym] || {};
    return '<div class="tw-sltp" data-help="Stop loss sells your whole position if the price falls to it; take profit sells if it rises to it. Checked every 5 minutes in market hours; fills at the market price then. You can also drag the red and green boxes on the chart.">' +
      '<label class="tw-f"><span>Stop loss</span><input id="twSL" inputmode="decimal" placeholder="optional" value="' + (cur.sl ? cur.sl.toFixed(2) : '') + '"></label>' +
      '<label class="tw-f"><span>Take profit</span><input id="twTP" inputmode="decimal" placeholder="optional" value="' + (cur.tp ? cur.tp.toFixed(2) : '') + '"></label>' +
      (p ? '<button class="pt-mini pt-soc" type="button" id="twSltpSave">Save</button>' + (p.sl || p.tp ? '<button class="pt-mini" type="button" id="twSltpClear">Clear</button>' : '') : '') + '</div>';
  }
  function num(id) { var v = parseFloat(String(($(id) || {}).value || '').replace(/[$,]/g, '')); return v > 0 ? Math.round(v * 100) / 100 : null; }
  function wireLive(me, pos) {
    ['twSL', 'twTP'].forEach(function (id) { if ($(id)) $(id).oninput = function () {
      typed[ticket.sym] = { sl: num('twSL'), tp: num('twTP') };
      if (!pos[ticket.sym]) { plans[ticket.sym] = typed[ticket.sym]; drawChart(); }
    }; });
    if ($('twSltpSave')) $('twSltpSave').onclick = function () { saveBracket(num('twSL'), num('twTP'), 'Stop loss / take profit saved on ' + ticket.sym + '.'); };
    if ($('twSltpClear')) $('twSltpClear').onclick = function () { saveBracket(null, null, 'Stop loss / take profit cleared on ' + ticket.sym + '.'); };
    $('twSym').onchange = function () { ticket.sym = this.value; render(); };
    $('twQty').oninput = function () { var v = parseInt(this.value, 10); ticket.qty = v > 0 ? v : 1; var q = quotes[ticket.sym] || {}; $('twEst').textContent = q.c ? '≈ ' + money(q.c * ticket.qty) + ' · you have ' + money(me.cash) + ' cash · you hold ' + ((pos[ticket.sym] || {}).qty || 0) : ''; };
    document.querySelectorAll('.tw-pos-row').forEach(function (b) { b.onclick = function () { ticket.sym = b.getAttribute('data-sym'); ticket.qty = pos[ticket.sym].qty; render(); }; });
    var trade = function (side) { return function () {
      var b = this; b.disabled = true; msg('');
      var req = { warId: warId, sym: ticket.sym, side: side, qty: ticket.qty };
      if (side === 'buy') { req.sl = num('twSL'); req.tp = num('twTP'); }
      call('tw_trade', req).then(function (r) {
        if (side === 'buy') { delete plans[ticket.sym]; delete typed[ticket.sym]; }
        msg((side === 'buy' ? 'Bought ' : 'Sold ') + r.fill.qty + ' ' + r.fill.sym + ' at ' + money(r.fill.price) + (r.fill.pnl != null ? ' (' + signed(r.fill.pnl) + ')' : '') + (r.out ? '. That knocked you out.' : ''), !r.out);
        if (window.ZelosProgress) ZelosProgress.track('trade', ticket.sym);
      }, function (e) { msg(errText(e)); }).then(function () { b.disabled = false; });
    }; };
    $('twBuy').onclick = trade('buy'); $('twSell').onclick = trade('sell');
  }

  // ------------------------------------------------------------ chart
  function nyDate(ms) { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(ms)); } catch (e) { return new Date(ms).toISOString().slice(0, 10); } }
  function seriesFor(sym) {
    var rows = hist[sym] || [], last = rows.length ? rows[rows.length - 1][0] : '';
    var all = rows.concat((extra[sym] || []).filter(function (r) { return r[0] > last; })), q = quotes[sym], live = false;
    if (q && q.c) {
      var qd = q.t ? nyDate(q.t * 1000) : null, lastD = all.length ? all[all.length - 1][0] : '';
      if (qd && qd > lastD && q.o) { all = all.concat([[qd, q.o, Math.max(q.h, q.c), Math.min(q.l, q.c), q.c, 0]]); live = true; }
      else if (qd && qd === lastD) { var r = all[all.length - 1].slice(); r[4] = q.c; r[2] = Math.max(r[2], q.c); r[3] = Math.min(r[3], q.c); all = all.slice(0, -1).concat([r]); live = true; }
    }
    var s = { sym: sym, key: sym + '|D', d: [], o: [], h: [], l: [], c: [], v: [], live: live };
    all.forEach(function (r) { s.d.push(r[0]); s.o.push(+r[1]); s.h.push(+r[2]); s.l.push(+r[3]); s.c.push(+r[4]); s.v.push(+r[5] || 0); });
    s.n = s.d.length;
    return TC.computeIndicators(s);
  }
  function ensureChart() {
    if (chartEl || !TC) return;
    chartEl = document.createElement('section'); chartEl.className = 'pt-card ch-card tw-chart-card';
    chartEl.innerHTML = '<div class="tw-chart-bar"><b id="twChartSym"></b><span class="tw-chart-tools">' +
      '<button class="pt-chip" type="button" id="twFib" aria-pressed="false" title="Fibonacci retracement across the visible swing">Fib</button>' +
      '<button class="pt-chip" type="button" id="twAlertAdd" aria-pressed="false" title="Set a Trade War price alert: press, then click a price on the chart">&#9200; Alert</button>' +
      '<button class="pt-chip" type="button" id="twAbc" aria-pressed="false" title="Three-Legged Strategy: draw an A-B-C pullback (click the start, then the ends of legs A, B and C)">3-Leg</button>' +
      '<button class="pt-chip" type="button" id="twSltp" aria-pressed="false" title="Stop Loss / Take Profit boxes: drag the red and green edges">SL/TP</button></span></div>' +
      '<canvas class="tw-chart" id="twChart" aria-label="Trade War chart"></canvas>' +
      '<p class="pt-fine">Drag to pan · scroll to zoom · dashed line: your entry and P&amp;L · ▲▼ your trades · green / red boxes: take profit / stop loss (drag the edges) · ⏰ lines: your Trade War price alerts (drag to move)</p>' +
      '<div class="tw-alerts" id="twAlerts"></div>';
    chart = new TC.TradeChart(chartEl.querySelector('canvas'));
    try { fibOn = localStorage.getItem('zelosPracticeFib') === '1'; } catch (e) {}
    var fib = chartEl.querySelector('#twFib'), al = chartEl.querySelector('#twAlertAdd');
    fib.classList.toggle('is-on', fibOn); fib.setAttribute('aria-pressed', String(fibOn));
    fib.onclick = function () { fibOn = !fibOn; fib.classList.toggle('is-on', fibOn); fib.setAttribute('aria-pressed', String(fibOn)); try { localStorage.setItem('zelosPracticeFib', fibOn ? '1' : '0'); } catch (e) {} drawChart(); };
    al.onclick = function () { var on = chart.placing !== 'alert'; chart.placing = on ? 'alert' : null; al.classList.toggle('is-on', on); al.setAttribute('aria-pressed', String(on)); if (on) msg('Click a price on the chart to set a Trade War alert for ' + ticket.sym + '.', true); };
    chart.onPlaceAlert = function (p) {
      var cur = (quotes[ticket.sym] || {}).c, a = TC.alerts.add(ticket.sym, p, cur); al.classList.remove('is-on'); al.setAttribute('aria-pressed', 'false');
      msg('Trade War alert set: ' + ticket.sym + ' ' + (a.dir === 'above' ? '≥' : '≤') + ' ' + money(p) + '. Manage alerts on your Trade War account page.', true); drawChart();
    };
    var abcBtn = chartEl.querySelector('#twAbc'), abcOff = function () { abcBtn.classList.remove('is-on'); abcBtn.setAttribute('aria-pressed', 'false'); };
    abcBtn.onclick = function () {
      if (chart.placing === 'abc') { chart.placing = null; abcOff(); drawChart(); return; }
      if (TC.abc.get(ticket.sym)) { if (!confirm('Remove the three-leg drawing on ' + ticket.sym + '?')) return; TC.abc.set(ticket.sym, null); drawChart(); return; }
      chart.placing = 'abc'; chart.abc = { pts: [] }; abcBtn.classList.add('is-on'); abcBtn.setAttribute('aria-pressed', 'true');
      msg('Three-Legged Strategy: click where the move starts, then the end of leg A, leg B and leg C.', true);
    };
    chart.onAbcDone = function (abc) {
      TC.abc.set(ticket.sym, abc); abcOff(); var P = abc.pts;
      msg('Three-leg drawing saved: leg C is ' + (Math.abs(P[3].p - P[2].p) / Math.max(1e-9, Math.abs(P[1].p - P[0].p))).toFixed(2) + '× leg A.', true); drawChart();
    };
    chart.onAlertMove = function (a) { TC.alerts.update(a.id, a.price, (quotes[a.sym] || {}).c); msg('Alert moved to ' + money(a.price) + '.', true); drawChart(); };
    var sl = chartEl.querySelector('#twSltp');
    try { sltpOn = localStorage.getItem('zelosTwSltp') !== '0'; } catch (e) {}
    sl.classList.toggle('is-on', sltpOn); sl.setAttribute('aria-pressed', String(sltpOn));
    sl.onclick = function () { sltpOn = !sltpOn; sl.classList.toggle('is-on', sltpOn); sl.setAttribute('aria-pressed', String(sltpOn)); try { localStorage.setItem('zelosTwSltp', sltpOn ? '1' : '0'); } catch (e) {} drawChart(); };
    chart.onForecastEdit = onBoxEdit;
    chartEl.querySelector('#twAlerts').addEventListener('click', function (e) {
      var ed = e.target.closest('[data-aedit]'), del = e.target.closest('[data-adel]');
      if (ed) {
        var a = TC.alerts.list.filter(function (x) { return x.id === ed.getAttribute('data-aedit'); })[0]; if (!a) return;
        var v = prompt('New price for the ' + a.sym + ' Trade War alert:', a.price.toFixed(2)); if (v == null) return;
        v = parseFloat(String(v).replace(/[$,]/g, '')); if (!(v > 0)) return msg('Type a price, like 187.50.');
        TC.alerts.update(a.id, Math.round(v * 100) / 100, (quotes[a.sym] || {}).c); msg('Alert moved to ' + money(v) + '.', true); drawChart();
      }
      if (del) { var id = del.getAttribute('data-adel'); TC.alerts.remove(id); msg('Alert deleted.', true); drawChart(); }
    });
  }
  // ------------------------------------------------------------ Stop Loss / Take Profit
  // On a position: the server's SL / TP (tw_bracket), sold automatically when reached.
  // Before buying: a plan that rides along with the next buy. Trade War is long only,
  // so the stop sits below the price and the target above (the engine flips them for sells).
  var sltpOn = true, plans = {}, typed = {}; // typed: what's in the SL / TP boxes, kept across live re-renders
  function atr(s) { var n = 14, prev = null; for (var i = Math.max(1, s.n - 60); i < s.n; i++) { var tr = Math.max(s.h[i] - s.l[i], Math.abs(s.h[i] - s.c[i - 1]), Math.abs(s.l[i] - s.c[i - 1])); prev = prev == null ? tr : (prev * (n - 1) + tr) / n; } return prev; }
  function r2(v) { return Math.round(v * 100) / 100; }
  function boxes(s, px) {
    if (!sltpOn || !px || !war || war.status !== 'active') return null;
    var pos = ((book && book.positions) || {})[ticket.sym], a = s.n > 15 ? atr(s) : px * 0.02, plan = plans[ticket.sym];
    if (pos) {
      if (pos.sl || pos.tp) return { entry: pos.avg, sl: pos.sl || null, tp: pos.tp || null, label: 'Your stop loss / take profit', side: 'buy', editable: true, src: 'pos' };
      return { entry: pos.avg, sl: r2(Math.min(px, pos.avg) - 1.5 * a), tp: r2(Math.max(px, pos.avg) + 3 * a), label: 'Suggested: drag to set', side: 'buy', editable: true, src: 'pos' };
    }
    return { entry: px, sl: plan ? plan.sl : r2(px - 1.5 * a), tp: plan ? plan.tp : r2(px + 3 * a), label: plan ? 'Your plan for the next buy' : 'Suggested plan (1.5 ATR stop, 2:1)', side: 'buy', editable: true, src: 'plan' };
  }
  function onBoxEdit(F, which) {
    var name = which === 'sl' ? 'Stop loss' : 'Take profit';
    if (F.src === 'plan') { plans[ticket.sym] = { sl: F.sl, tp: F.tp }; msg(name + ' set to ' + money(F[which]) + ' for your next ' + ticket.sym + ' buy.', true); render(); return; }
    saveBracket(F.sl, F.tp, name + ' set to ' + money(F[which]) + '.');
  }
  function saveBracket(sl, tp, ok) {
    call('tw_bracket', { warId: warId, sym: ticket.sym, sl: sl || null, tp: tp || null }).then(function () { delete typed[ticket.sym]; msg(ok, true); }, function (e) { msg(errText(e)); drawChart(); });
  }
  function drawAlerts() {
    var el = chartEl && chartEl.querySelector('#twAlerts'); if (!el) return;
    var list = TC.alerts.list.filter(function (a) { return a.status === 'active'; }).sort(function (a, b) { return (a.sym === ticket.sym ? 0 : 1) - (b.sym === ticket.sym ? 0 : 1) || a.createdAt - b.createdAt; });
    el.innerHTML = '<div class="tw-alerts-head"><b>Trade War price alerts</b><small>' + (list.length ? list.length + ' active' : 'Press Alert, then click a price on the chart') + '</small></div>' + list.slice(0, 8).map(function (a) {
      return '<div class="tw-alert-row"><span class="zm-tag is-war">TW</span><b>' + esc(a.sym) + '</b><span class="tw-al-dir is-' + a.dir + '">' + (a.dir === 'above' ? '▲ Above' : '▼ Below') + '</span><span class="tw-al-px">' + money(a.price) + '</span>' +
        '<button class="pt-mini" type="button" data-aedit="' + esc(a.id) + '" aria-label="Edit the ' + esc(a.sym) + ' alert">Edit</button><button class="pt-mini" type="button" data-adel="' + esc(a.id) + '" aria-label="Delete the ' + esc(a.sym) + ' alert">Delete</button></div>';
    }).join('');
  }
  function drawChart() {
    if (!chart) return;
    var s = seriesFor(ticket.sym), pos = ((book && book.positions) || {})[ticket.sym], px = (quotes[ticket.sym] || {}).c || (s.n ? s.c[s.n - 1] : null);
    var ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#f4f5f7';
    $('twChartSym').textContent = ticket.sym + (px ? ' · ' + money(px) : '');
    chart.lines = pos ? [{ price: pos.avg, color: ink, dash: [6, 3], label: 'ENTRY ' + money(pos.avg) + ' · ' + pos.qty + ' sh · P&L ' + signed((px - pos.avg) * pos.qty) + ' (' + pct((px / pos.avg - 1) * 100) + ')' }] : [];
    chart.marks = ((book && book.fills) || []).filter(function (f) { return f.sym === ticket.sym; }).map(function (f) { return { i: s.d.indexOf(nyDate(f.at)), price: f.price, side: f.side }; }).filter(function (m) { return m.i >= 0; });
    chart.lastPrice = px; chart.fib = fibOn; chart.alerts = TC.alerts.forSym(ticket.sym);
    chart.forecast = boxes(s, px); drawAlerts();
    if (chart.placing !== 'abc') chart.abc = TC.abc.get(ticket.sym);
    chart.empty = s.n ? null : 'Loading chart…';
    if (!chart.s || chart.s.key !== s.key) chart.setSeries(s, 126); else chart.setSeries(s);
    chart.draw();
  }
  function checkAlerts() {
    if (!TC) return;
    var px = {}; Object.keys(quotes).forEach(function (k) { if (quotes[k] && quotes[k].c) px[k] = quotes[k].c; });
    TC.alerts.check(px).forEach(function (a) {
      var t = 'Price alert: ' + a.sym + ' ' + (a.dir === 'above' ? '≥' : '≤') + ' ' + money(a.price), b = a.sym + ' is at ' + money(a.hitPrice) + '. Trade War price alert.';
      if (window.ZelosProgress && ZelosProgress.toast) ZelosProgress.toast('<span class="zm-tag is-war">TRADE WAR — VIRTUAL</span> <b>' + esc(t) + '</b><br>' + esc(b), 'mission');
      try { if ('Notification' in window && Notification.permission === 'granted') new Notification('Trade War (virtual): ' + t, { body: b, icon: '../icons/icon-192.png', tag: 'zelos-alert-' + a.id }); } catch (e) {}
    });
  }

  // ------------------------------------------------------------ boot
  function start() {
    var cfg = window.ZELOS_FIREBASE_CONFIG;
    if (!window.firebase || !cfg || !cfg.projectId || !firebase.functions) { body('<div class="pf-missing"><h1>Trade War needs the live site</h1><p>Try again on agentictrading.info.</p></div>'); return; }
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    db = firebase.firestore(); auth = firebase.auth(); fns = firebase.functions();
    if (window.ZelosSocial) ZelosSocial.init();
    if (window.ZelosSignIn) ZelosSignIn.finish(function (t) { msg(t); });
    fetch('../data/practice-universe.json').then(function (r) { return r.json(); }).then(function (u) { universe = (u.symbols || []).slice(0, 55); if (war) render(); }).catch(function () {});
    db.collection('markets').doc('quotes').onSnapshot(function (d) { quoteDoc = d.exists ? d.data() : {}; quotes = quoteDoc.quotes || {}; checkAlerts(); if (war && war.status === 'active') render(); }, function () {});
    Promise.all([
      fetch('../data/game-charts.json').then(function (r) { return r.json(); }),
      fetch('../data/practice-extra.json').then(function (r) { return r.json(); }).catch(function () { return { symbols: {} }; })
    ]).then(function (res) { hist = {}; [res[0].symbols, res[1].symbols].forEach(function (src) { Object.keys(src || {}).forEach(function (k) { hist[k] = src[k]; }); }); drawChart(); }).catch(function () {});
    db.collection('markets').doc('dailyBars').onSnapshot(function (d) {
      var b = (d.exists && d.data().bars) || {}; extra = {};
      Object.keys(b).forEach(function (k) { extra[k] = (b[k] || []).map(function (r) { var p = String(r).split(','); return [p[0], +p[1], +p[2], +p[3], +p[4], +p[5] || 0]; }); });
      drawChart();
    }, function () {});
    var id = new URLSearchParams(location.search).get('w');
    auth.onAuthStateChanged(function (u) {
      user = u && !u.isAnonymous ? u : null;
      if (user && TC) TC.alerts.attach(db, user.uid);
      if (id) {
        if (u) view(id);
        else { body('<div class="pt-card ch-card"><h2>You\'ve been invited to a Trade War</h2><button class="pt-btn pt-btn-go" type="button" id="twSignIn">Sign in to see it</button>' + AUTH_MSG + '</div>'); $('twSignIn').onclick = signIn; }
        return;
      }
      hub();
    });
    setInterval(function () { if (war && war.status === 'active') render(); }, 60000);
  }
  document.addEventListener('DOMContentLoaded', start);
})();
