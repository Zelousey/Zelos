/*!
 * Zelos Trade War matches (practice/war.html): equal buy-in virtual competitions.
 *
 *   war.html          create a Trade War + your matches (live, lobby, finished)
 *   war.html?w=<id>   one match: lobby (join / start), live (trade + leaderboard), results
 *
 * The browser never writes match data. Every action calls a Cloud Function
 * (tw_create, tw_join, tw_leave, tw_start, tw_cancel, tw_trade in
 * functions/main.py) that checks the rules server-side and prices trades from
 * the server's own quotes. This page only reads: tradeWars/{id}, its
 * accounts/* (leaderboard, players only) and books/{you} (your positions).
 * Virtual money only; separate from the standing $10,000 Trade War account.
 */
(function () {
  'use strict';
  var SITE = 'https://agentictrading.info';
  var $ = function (id) { return document.getElementById(id); };
  var db, auth, fns, user = null, unsubs = [], quotes = {}, quoteDoc = {}, universe = [], warId = null, war = null, accounts = [], book = null, prevRanks = {};
  var ticket = { sym: 'AAPL', qty: 1 };
  // Trade War chart (practice-chart.js): daily history + live FMP quote, your entry and fills,
  // Fibonacci, and the Trade War price alerts shared with the $10,000 account.
  var TC = window.ZelosTradeChart, hist = {}, extra = {}, chartEl = null, chart = null, fibOn = false;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
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
  function rulesBox(w) {
    return '<div class="tw-rules" data-help="These rules are enforced by the server, so nobody can change their balance or buy-in.">' +
      '<b>Rules</b><ul>' +
      '<li>Everyone starts with the same <b>' + money(w.buyIn, 0) + '</b> of virtual money. The buy-in is locked once the match starts.</li>' +
      '<li>No adding or withdrawing money during the match. Only match money can be used.</li>' +
      '<li>Stocks only, long only (buy, then sell what you own). Market orders fill at the live price during market hours.</li>' +
      '<li>Ranked by % gain after ' + w.days + ' day' + (w.days === 1 ? '' : 's') + '. Virtual money only: no cash value, no prizes.</li></ul></div>';
  }

  // ------------------------------------------------------------ hub
  function hub() {
    stop();
    var h = '<div class="ch-hero"><span class="pt-kicker"><span class="zm-tag is-war">TRADE WAR — VIRTUAL</span></span><h1>Trade War matches</h1>' +
      '<p>Pick a buy-in, invite friends, and everyone starts with exactly the same virtual money. Best % gain when the clock runs out wins. Your $10,000 Trade War account isn\'t touched.</p></div>';
    if (!user) {
      body(h + '<div class="pt-card ch-card"><button class="pt-btn pt-btn-go" type="button" id="twSignIn">Sign in to play</button>' + AUTH_MSG + '<p class="pt-fine">Matches need a free account so results are saved and fair.</p></div>');
      $('twSignIn').onclick = signIn; return;
    }
    h += '<div class="tw-grid"><section class="pt-card ch-card tw-create"><h2>Create a Trade War</h2>' +
      '<label class="tw-f"><span>Name</span><input id="twName" maxlength="40" placeholder="Friday Fight"></label>' +
      '<div class="tw-f" data-help="The buy-in is the virtual starting balance every player gets. It is the same for everyone and can\'t change after the start."><span>Virtual buy-in (everyone starts with this)</span><div class="tw-chips" id="twBuy">' +
      [100, 500, 1000, 5000, 10000].map(function (b, i) { return '<button type="button" data-b="' + b + '" class="' + (b === 1000 ? 'is-on' : '') + '">' + money(b, 0) + '</button>'; }).join('') +
      '</div><input id="twBuyCustom" inputmode="numeric" placeholder="or type an amount (multiple of $100)"></div>' +
      '<div class="tw-row"><label class="tw-f"><span>Length</span><select id="twDays"><option value="1">1 day</option><option value="3">3 days</option><option value="7" selected>1 week</option><option value="14">2 weeks</option><option value="30">30 days</option></select></label>' +
      '<label class="tw-f"><span>Max players</span><select id="twMax">' + [2, 4, 6, 10, 20, 50].map(function (n) { return '<option' + (n === 10 ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label></div>' +
      '<button class="pt-btn pt-btn-go" type="button" id="twCreate">Create &amp; get invite link</button><p class="pt-auth-msg" id="twCreateMsg" role="alert" hidden></p></section>' +
      '<section class="pt-card ch-card"><h2>Your Trade Wars</h2><div id="twMine"><p class="pt-empty">Loading…</p></div></section></div>' +
      '<div class="tw-grid"><section class="pt-card ch-card"><h2>Challenge someone</h2>' +
      '<p class="pt-fine">They get a "You\'ve been challenged" card and choose to accept or decline. A 1 v 1 starts the moment they accept.</p>' +
      '<div class="pt-invite" data-help="Type a friend\'s @username (they can set one on their profile), then press Challenge to pick the buy-in and length."><input id="twUser" placeholder="@username" autocapitalize="none" spellcheck="false" aria-label="Username to challenge"><button class="pt-mini pt-soc" type="button" id="twChUser">&#9876;&#65039; Challenge</button></div>' +
      '<div id="twSquads" class="tw-squads"></div><p class="pt-auth-msg" id="twChMsg" role="alert" hidden></p></section>' +
      '<section class="pt-card ch-card"><h2>Challenge history</h2><div id="twHist"><p class="pt-empty">Loading…</p></div></section></div>';
    body(h);
    wireChallenges();
    var buy = 1000;
    $('twBuy').onclick = function (e) { var b = e.target.closest('[data-b]'); if (!b) return; buy = +b.getAttribute('data-b'); $('twBuyCustom').value = ''; this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-on', x === b); }); };
    $('twBuyCustom').oninput = function () { var v = parseInt(this.value.replace(/[^0-9]/g, ''), 10); if (v) { buy = v; $('twBuy').querySelectorAll('button').forEach(function (x) { x.classList.remove('is-on'); }); } };
    $('twCreate').onclick = function () {
      var b = this, msg = $('twCreateMsg'); msg.hidden = true; b.disabled = true; b.textContent = 'Creating…';
      call('tw_create', { name: $('twName').value || 'Trade War', buyIn: buy, days: +$('twDays').value, maxPlayers: +$('twMax').value })
        .then(function (r) { location.search = '?w=' + encodeURIComponent(r.warId); })
        .catch(function (e) { b.disabled = false; b.textContent = 'Create & get invite link'; msg.textContent = errText(e); msg.hidden = false; });
    };
    db.collection('tradeWars').where('players', 'array-contains', user.uid).limit(50).get().then(function (s) {
      var list = []; s.forEach(function (d) { list.push(Object.assign({ id: d.id }, d.data())); });
      list = list.filter(function (w) { return w.status !== 'cancelled'; }).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      if (!list.length) { $('twMine').innerHTML = '<p class="pt-empty">No Trade Wars yet. Create one and send the link to a friend.</p>'; return; }
      var order = { active: 0, lobby: 1, ended: 2 };
      list.sort(function (a, b) { return (order[a.status] - order[b.status]) || (b.createdAt - a.createdAt); });
      $('twMine').innerHTML = list.map(function (w) {
        var me = (w.results || []).filter(function (r) { return r.uid === user.uid; })[0];
        var st = w.status === 'active' ? '<span class="tw-st is-live">LIVE · ' + left(w.endAt - Date.now()) + '</span>' : w.status === 'lobby' ? '<span class="tw-st">Lobby · ' + w.players.length + '/' + w.maxPlayers + '</span>'
          : '<span class="tw-st is-done">Finished' + (me ? ' · #' + me.rank + ' of ' + w.results.length + ' · <span class="' + cls(me.pnlPct) + '">' + pct(me.pnlPct) + '</span>' : '') + '</span>';
        return '<a class="ch-row" href="?w=' + encodeURIComponent(w.id) + '"><span>⚔️ <b>' + esc(w.name) + '</b></span><span>' + money(w.buyIn, 0) + ' buy-in</span>' + st + '</a>';
      }).join('');
    }).catch(function () { $('twMine').innerHTML = '<p class="pt-empty">Couldn\'t load your Trade Wars.</p>'; });
  }

  // ------------------------------------------------------------ challenges (zelos-challenge.js does the dialogs)
  function wireChallenges() {
    var C = window.ZelosChallenge, S = window.ZelosSocial, m = $('twChMsg');
    function say(t) { m.textContent = t; m.hidden = !t; }
    $('twChUser').onclick = function () {
      var u = String($('twUser').value || '').trim().replace(/^@/, '').toLowerCase(); say('');
      if (!/^[a-z0-9_]{3,20}$/.test(u)) return say('Type a username like @amy_trades.');
      db.collection('usernames').doc(u).get().then(function (d) {
        if (!d.exists) return say('No trader has the username @' + u + ' yet.');
        if (d.data().uid === user.uid) return say('That\'s you. Challenge someone else.');
        if (C) C.open({ to: d.data().uid, toName: '@' + u });
      }).catch(function () { say('Couldn\'t look that up. Try again.'); });
    };
    $('twUser').onkeydown = function (e) { if (e.key === 'Enter') $('twChUser').click(); };
    if (S && S.mySquads) S.mySquads(user.uid).then(function (list) {
      list = (list || []).filter(function (q) { return q.members && q.members.length > 1; });
      $('twSquads').innerHTML = list.length ? '<p class="pt-fine" style="margin-top:12px">Or challenge a whole squad:</p>' + list.map(function (q) { return '<button class="pt-mini" type="button" data-sq="' + esc(q.id) + '" data-sqn="' + esc(q.name) + '">&#128101; ' + esc(q.name) + ' (' + q.members.length + ')</button>'; }).join(' ') : '';
      $('twSquads').onclick = function (e) { var b = e.target.closest('[data-sq]'); if (b && C) C.open({ squadId: b.getAttribute('data-sq'), squadName: b.getAttribute('data-sqn') }); };
    }).catch(function () {});
    var q = function (field) { return db.collection('twInvites').where(field, '==', user.uid).limit(25).get().then(function (s) { var o = []; s.forEach(function (d) { o.push(Object.assign({ id: d.id }, d.data())); }); return o; }).catch(function () { return []; }); };
    Promise.all([q('from'), q('to')]).then(function (r) {
      var list = r[0].concat(r[1]).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }).slice(0, 25);
      var ST = { pending: 'Waiting', accepted: 'Accepted', declined: 'Declined', cancelled: 'Cancelled', expired: 'Expired' };
      $('twHist').innerHTML = list.length ? list.map(function (c) {
        var sent = c.from === user.uid, other = sent ? (c.toName || 'Trader') : (c.fromName || 'Trader');
        var go = c.status === 'accepted' || (sent && c.status === 'pending');
        return '<' + (go ? 'a href="?w=' + encodeURIComponent(c.warId) + '"' : 'div') + ' class="ch-row"><span>' + (sent ? 'You &rarr; <b>' + esc(other) + '</b>' : '<b>' + esc(other) + '</b> &rarr; you') + '</span><span>' + money(c.buyIn, 0) + ' · ' + c.days + 'd</span>' +
          '<span class="tw-st' + (c.status === 'accepted' ? ' is-live' : c.status === 'pending' ? '' : ' is-done') + '">' + (ST[c.status] || c.status) + '</span></' + (go ? 'a' : 'div') + '>';
      }).join('') : '<p class="pt-empty">No challenges yet. Challenge a friend by @username above.</p>';
    });
  }

  // ------------------------------------------------------------ one match
  function view(id) {
    stop(); warId = id; war = null; accounts = []; book = null; prevRanks = {};
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
  }
  function board(rows, final) {
    rows = rows.slice().sort(function (a, b) { return (b.pnlPct - a.pnlPct) || (b.pnl - a.pnl); });
    var ranks = {};
    var h = '<div class="tw-board" role="table" aria-label="Trade War leaderboard"><div class="tw-tr tw-th" role="row"><span>#</span><span>Trader</span><span>Start</span><span>' + (final ? 'Final' : 'Current') + '</span><span>$ P&amp;L</span><span>% P&amp;L</span><span>Trades</span><span>W/L</span></div>' +
      rows.map(function (r, i) {
        var rank = final ? r.rank : i + 1, was = prevRanks[r.uid]; ranks[r.uid] = rank;
        var move = !final && was && was !== rank ? (rank < was ? '<i class="tw-mv up" aria-label="up">▲</i>' : '<i class="tw-mv dn" aria-label="down">▼</i>') : '';
        var me = user && r.uid === user.uid;
        return '<a class="tw-tr' + (me ? ' is-me' : '') + (move ? ' is-moved' : '') + '" role="row" href="profile.html?u=' + encodeURIComponent(r.uid) + '"><span>' + (final && rank === 1 ? '🏆' : rank) + move + '</span><span><b>' + esc(r.name || 'Trader') + '</b>' + (me ? ' <small>you</small>' : '') + '</span>' +
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
      : w.status === 'ended' ? '<span class="tw-st is-done">Finished</span>' : '<span class="tw-st is-done">Cancelled</span>';
    var h = '<div class="ch-hero"><span class="pt-kicker"><span class="zm-tag is-war">TRADE WAR — VIRTUAL</span> ' + status + '</span><h1>⚔️ ' + esc(w.name) + '</h1>' +
      '<p>Hosted by ' + esc(w.hostName || 'a trader') + ' · <b>' + money(w.buyIn, 0) + '</b> virtual buy-in · ' + w.days + ' day' + (w.days === 1 ? '' : 's') + ' · ' + w.players.length + '/' + w.maxPlayers + ' players</p></div>';
    if (w.status === 'cancelled') { body(h + '<div class="pt-card ch-card"><p>The host cancelled this Trade War before it started.</p><a class="pt-btn pt-btn-go" href="war.html">Your Trade Wars</a></div>'); return; }
    if (w.status === 'lobby') {
      var waiting = (w.invited || []).filter(function (u) { return w.players.indexOf(u) === -1; }).length;
      h += '<div class="tw-grid"><section class="pt-card ch-card"><h2>Players</h2><ul class="tw-players">' + w.players.map(function (u) { return '<li>' + esc((w.names || {})[u] || 'Trader') + (u === w.host ? ' <small>host</small>' : '') + '</li>'; }).join('') + '</ul>' +
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
      h += (win ? '<div class="pt-card ch-card tw-winner"><span class="pt-kicker">Winner</span><h2>🏆 ' + esc(win.name) + ' <span class="' + cls(win.pnlPct) + '">' + pct(win.pnlPct) + '</span></h2><p class="pt-fine">Final results, frozen when the clock ran out.</p></div>' : '') +
        '<section class="pt-card ch-card"><h2>Final standings</h2>' + board(res, true) + '</section>';
      body(h); return;
    }
    // live
    if (!mine) { body(h + '<div class="pt-card ch-card"><p>This Trade War is live. Only its players can see the leaderboard.</p><a class="pt-btn pt-btn-go" href="war.html">Your Trade Wars</a></div>'); return; }
    var me = accounts.filter(function (a) { return a.uid === user.uid; })[0] || {};
    var pos = (book && book.positions) || {}, q = quotes[ticket.sym] || {}, px = q.c, open = tradable();
    var liveEq = (me.cash || 0) + Object.keys(pos).reduce(function (t, s) { return t + pos[s].qty * ((quotes[s] && quotes[s].c) || pos[s].avg); }, 0);
    var livePnl = liveEq - (me.start || w.buyIn);
    h += '<div id="twChartSlot"></div><div class="tw-live"><section class="pt-card ch-card tw-acct">' +
      '<h2 data-help="Your match account. It started at the buy-in, like everyone else\'s, and only changes when you trade or prices move.">Your match account</h2><div class="pf-mini"><span><small>Balance</small><b>' + money(liveEq) + '</b></span><span><small>Cash</small><b>' + money(me.cash) + '</b></span>' +
      '<span><small>P&amp;L</small><b class="' + cls(livePnl) + '">' + signed(livePnl) + '</b></span><span><small>% P&amp;L</small><b class="' + cls(livePnl) + '">' + pct(livePnl / (me.start || w.buyIn) * 100) + '</b></span></div>' +
      '<h2 style="margin-top:14px">Trade</h2><div class="tw-ticket"><select id="twSym" aria-label="Stock">' + universe.map(function (u) { return '<option value="' + u.sym + '"' + (u.sym === ticket.sym ? ' selected' : '') + '>' + u.sym + ' · ' + esc(u.name) + '</option>'; }).join('') + '</select>' +
      '<div class="tw-px"><b>' + (px ? money(px) : '–') + '</b><small>' + (open ? 'live price' : 'market closed') + '</small></div>' +
      '<label class="tw-f"><span>Shares</span><input id="twQty" type="number" min="1" step="1" value="' + ticket.qty + '"></label>' +
      '<div class="tw-est" id="twEst">' + (px ? '≈ ' + money(px * ticket.qty) + ' · you have ' + money(me.cash) + ' cash · you hold ' + ((pos[ticket.sym] || {}).qty || 0) : '') + '</div>' +
      '<div class="tw-actions"><button class="pt-submit is-buy" type="button" id="twBuy"' + (open ? '' : ' disabled') + '><span class="pt-sub-main">Buy ' + esc(ticket.sym) + '</span><span class="pt-sub-meta">market</span></button>' +
      '<button class="pt-submit is-sell" type="button" id="twSell"' + (open && pos[ticket.sym] ? '' : ' disabled') + '><span class="pt-sub-main">Sell ' + esc(ticket.sym) + '</span><span class="pt-sub-meta">' + ((pos[ticket.sym] || {}).qty ? 'you hold ' + pos[ticket.sym].qty : 'nothing to sell') + '</span></button></div>' +
      '<p class="pt-auth-msg" id="twMsg" role="alert" hidden></p>' + (open ? '' : '<p class="pt-fine">Trades fill during market hours (9:30 am to 4:00 pm New York time).</p>') + '</div>' +
      '<h2 style="margin-top:14px">Your positions</h2>' + (Object.keys(pos).length ? '<div class="tw-pos">' + Object.keys(pos).map(function (s) {
        var p = pos[s], c = (quotes[s] && quotes[s].c) || p.avg, g = (c - p.avg) * p.qty;
        return '<button type="button" class="tw-pos-row" data-sym="' + s + '"><b>' + s + '</b><span>' + p.qty + ' @ ' + money(p.avg) + '</span><span>' + money(c * p.qty) + '</span><span class="' + cls(g) + '">' + signed(g) + '</span></button>';
      }).join('') + '</div>' : '<p class="pt-empty">No positions yet. Pick a stock and buy to get on the board.</p>') +
      '</section><section class="pt-card ch-card"><h2>Leaderboard</h2>' + board(accounts, false) +
      '<p class="pt-fine">Updated after every trade and every 5 minutes. Ranked by % gain: everyone started with ' + money(w.buyIn, 0) + '.</p>' + rulesBox(w) + '</section></div>';
    body(h); wireLive(me, pos);
    ensureChart(); if (chartEl) { $('twChartSlot').appendChild(chartEl); drawChart(); }
  }
  function msg(t, good) { var m = $('twMsg'); if (!m) return; m.textContent = t; m.hidden = !t; m.classList.toggle('is-ok', !!good); }
  function wireLobby() {
    if ($('twSignIn')) $('twSignIn').onclick = signIn;
    var act = function (btn, name, after) { if (!btn) return; btn.onclick = function () { var b = this; b.disabled = true; call(name, { warId: warId }).then(after || function () {}, function (e) { b.disabled = false; msg(errText(e)); }); }; };
    act($('twJoin'), 'tw_join'); act($('twStart'), 'tw_start');
    act($('twLeave'), 'tw_leave', function () { location.href = 'war.html'; });
    if ($('twCancel')) $('twCancel').onclick = function () { if (!confirm('Cancel this Trade War? Players will see it was cancelled.')) return; var b = this; b.disabled = true; call('tw_cancel', { warId: warId }).catch(function (e) { b.disabled = false; msg(errText(e)); }); };
    if ($('twShare')) $('twShare').onclick = function () { var b = this; var S = window.ZelosSocial; (S && S.shareLink ? S.shareLink('Join my Trade War', 'Join my Trade War "' + war.name + '": everyone starts with ' + money(war.buyIn, 0) + ' of virtual money. Best % gain wins.', link(warId)) : Promise.resolve()).then(function (r) { if (r === 'copied') b.textContent = 'Copied ✓'; }); };
  }
  function wireLive(me, pos) {
    $('twSym').onchange = function () { ticket.sym = this.value; render(); };
    $('twQty').oninput = function () { var v = parseInt(this.value, 10); ticket.qty = v > 0 ? v : 1; var q = quotes[ticket.sym] || {}; $('twEst').textContent = q.c ? '≈ ' + money(q.c * ticket.qty) + ' · you have ' + money(me.cash) + ' cash · you hold ' + ((pos[ticket.sym] || {}).qty || 0) : ''; };
    document.querySelectorAll('.tw-pos-row').forEach(function (b) { b.onclick = function () { ticket.sym = b.getAttribute('data-sym'); ticket.qty = pos[ticket.sym].qty; render(); }; });
    var trade = function (side) { return function () {
      var b = this; b.disabled = true; msg('');
      call('tw_trade', { warId: warId, sym: ticket.sym, side: side, qty: ticket.qty }).then(function (r) {
        msg((side === 'buy' ? 'Bought ' : 'Sold ') + r.fill.qty + ' ' + r.fill.sym + ' at ' + money(r.fill.price) + (r.fill.pnl != null ? ' (' + signed(r.fill.pnl) + ')' : ''), true);
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
      '<button class="pt-chip" type="button" id="twAbc" aria-pressed="false" title="Three-Legged Strategy: draw an A-B-C pullback (click the start, then the ends of legs A, B and C)">3-Leg</button></span></div>' +
      '<canvas class="tw-chart" id="twChart" aria-label="Trade War chart"></canvas>' +
      '<p class="pt-fine">Drag to pan · scroll to zoom · dashed line: your entry and P&amp;L · ▲▼ your trades · ⏰ lines: your Trade War price alerts (drag to move)</p>';
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
  }
  function drawChart() {
    if (!chart) return;
    var s = seriesFor(ticket.sym), pos = ((book && book.positions) || {})[ticket.sym], px = (quotes[ticket.sym] || {}).c || (s.n ? s.c[s.n - 1] : null);
    var ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#f4f5f7';
    $('twChartSym').textContent = ticket.sym + (px ? ' · ' + money(px) : '');
    chart.lines = pos ? [{ price: pos.avg, color: ink, dash: [6, 3], label: 'ENTRY ' + money(pos.avg) + ' · ' + pos.qty + ' sh · P&L ' + signed((px - pos.avg) * pos.qty) + ' (' + pct((px / pos.avg - 1) * 100) + ')' }] : [];
    chart.marks = ((book && book.fills) || []).filter(function (f) { return f.sym === ticket.sym; }).map(function (f) { return { i: s.d.indexOf(nyDate(f.at)), price: f.price, side: f.side }; }).filter(function (m) { return m.i >= 0; });
    chart.lastPrice = px; chart.fib = fibOn; chart.alerts = TC.alerts.forSym(ticket.sym);
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
