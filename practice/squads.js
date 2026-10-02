/*!
 * Zelos Practice Account: Trading Squads (practice/squads.html).
 *
 *   squads.html           your squads, create one, or join with a room code
 *   squads.html?s=<id>    one squad: join by invite link, shared goal, leaderboard,
 *                         squad chat, and the owner's controls (competitions,
 *                         goal, room code, settings, rename, members, delete)
 *
 * A squad is private: only people with the invite link or room code can find
 * it. Its leaderboard reads each member's public practice profile; the chat is
 * members only. See zelos-social.js and firestore.rules.
 */
(function () {
  'use strict';
  var S = window.ZelosSocial, P = window.ZelosProgress, L = window.ZelosLevels;
  var $ = function (id) { return document.getElementById(id); };
  var esc = S ? S.esc : function (x) { return x; };
  // name in the trader's purchased color (zelos-tokens.js paints [data-zname])
  function zn(uid) { return uid ? ' data-zname="' + esc(uid) + '"' : ''; }
  function money(v) { return (v < 0 ? '-$' : '$') + Math.abs(+v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pct(v) { return (v >= 0 ? '+' : '') + (+v || 0).toFixed(2) + '%'; }
  function cls(v) { return v >= 0 ? 'up' : 'dn'; }
  function body(h) { $('sqBody').innerHTML = h; }
  // Google sign-in with a redirect fallback and readable errors (zelos-signin.js)
  function signIn() {
    var msg = $('sqAuthMsg'), show = function (t) { if (msg) { msg.textContent = t; msg.hidden = false; } else alert(t); };
    if (msg) msg.hidden = true;
    if (window.ZelosSignIn) return ZelosSignIn.google(show);
    firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(function (e) { show(e.message || e); });
  }
  var AUTH_MSG = '<p class="pt-auth-msg" id="sqAuthMsg" role="alert" hidden></p>';

  function hub(user) {
    var h = '<div class="ch-hero"><span class="pt-kicker">Trading Squads</span><h1>Compete with your friends</h1>' +
      '<p>Make a private squad, send the invite link, and get your own leaderboard of Trade War accounts (virtual money). Squad owners can run competitions for a week or a month.</p></div>';
    if (!user) { body(h + '<div class="pt-card ch-card"><button class="pt-btn pt-btn-go" type="button" id="sqSignIn">Sign in with Google</button>' + AUTH_MSG + '<p class="pt-fine">Squads use your signed-in Trade War account.</p></div>'); $('sqSignIn').onclick = signIn; return; }
    h += '<div class="pt-card ch-card"><h2>Create a squad</h2><div class="pt-invite"><input id="sqName" maxlength="32" placeholder="Squad name, e.g. Tuesday Traders"><button class="pt-btn pt-btn-go" type="button" id="sqCreate">Create</button></div><p class="pt-fine" id="sqMsg"></p></div>' +
      '<div class="pt-card ch-card"><h2>Join with a room code</h2><div class="pt-invite" data-help="A friend who owns a squad can give you a 6-character room code."><input id="sqCode" maxlength="8" placeholder="e.g. K7QX2M" autocapitalize="characters" spellcheck="false" aria-label="Room code"><button class="pt-btn pt-btn-go" type="button" id="sqCodeGo">Find squad</button></div><p class="pt-fine" id="sqCodeMsg"></p></div>' +
      '<div class="pt-card ch-card"><h2>Your squads</h2><div id="sqList"><p class="pt-empty">Loading…</p></div></div>';
    body(h);
    $('sqCodeGo').onclick = function () { $('sqCodeMsg').textContent = ''; S.findRoomCode($('sqCode').value).then(function (id) { location.search = '?s=' + encodeURIComponent(id); }, function (e) { $('sqCodeMsg').textContent = e.message; }); };
    $('sqCode').onkeydown = function (e) { if (e.key === 'Enter') $('sqCodeGo').click(); };
    $('sqCreate').onclick = function () {
      var b = this; b.disabled = true;
      S.createSquad($('sqName').value).then(function (id) { location.search = '?s=' + encodeURIComponent(id); }).catch(function (e) { b.disabled = false; $('sqMsg').textContent = e.message || e; });
    };
    S.mySquads(user.uid).then(function (list) {
      $('sqList').innerHTML = list.length ? '<div class="ch-rows">' + list.map(function (q) {
        return '<a class="ch-row" href="?s=' + encodeURIComponent(q.id) + '"><span>👥 <b>' + esc(q.name) + '</b></span><span>' + q.members.length + ' member' + (q.members.length === 1 ? '' : 's') + '</span><span>' + (q.comp && Date.now() < q.comp.end ? '🏁 Competition on' : q.owner === user.uid ? 'Owner' : 'Member') + '</span></a>';
      }).join('') + '</div>' : '<p class="pt-empty">You\'re not in a squad yet. Create one, or ask a friend for their invite link.</p>';
    });
  }

  var board = 'comp', sqUnsub = null, current = null, profs = {}, universe = [];
  function metric(sq, uid, p) {
    if (!p) return null;
    var keys = P ? P.periodKeys() : {}, per = p.p || {};
    if (board === 'comp' && sq.comp) {
      var base = sq.comp.base && sq.comp.base[uid];
      if (!base) { var hs = S.netOn(p, new Date(sq.comp.start).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })); base = hs ? { net: hs.n, eq: hs.e, xp: hs.x } : S.baseFor(p); }
      var sc = S.scoreSince(p, base, sq.comp.end); return { pct: sc.pct, pnl: sc.pnl, xp: sc.xp };
    }
    if (board === 'week') return per[keys.w] ? { pct: per[keys.w].pct, pnl: per[keys.w].pnl } : { pct: 0, pnl: 0 };
    if (board === 'month') return per[keys.m] ? { pct: per[keys.m].pct, pnl: per[keys.m].pnl } : { pct: 0, pnl: 0 };
    if (board === 'season') return keys.s && per[keys.s] ? { pct: per[keys.s].pct, pnl: per[keys.s].pnl, xp: per[keys.s].xp } : { pct: 0, pnl: 0 };
    return { pct: p.growthPct || 0, pnl: S.net(p) };
  }
  var REACT_ICON = { like: 'thumb', fire: 'flame', rocket: 'rocket', trophy: 'trophy', smile: 'smile' };
  function ico(name, color) { return window.ZelosIcons ? ZelosIcons.icon(name, color) : name; }
  function time(ts) { var d = ts && ts.toDate ? ts.toDate() : new Date(); var t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); return d.toDateString() === new Date().toDateString() ? t : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + t; }

  function render(user) {
    var sq = current; if (!sq) return;
    var cfg = sq.config || {}, isMember = user && sq.members.indexOf(user.uid) !== -1, isOwner = user && sq.owner === user.uid;
    var link = S.links(user ? user.uid : null).squad(sq.id);
    var compOn = sq.comp && Date.now() < sq.comp.end, compDone = sq.comp && Date.now() >= sq.comp.end;
    if (!sq.comp && board === 'comp') board = 'all';
    var h = '<div class="ch-hero"><span class="pt-kicker">Trading Squad · ' + sq.members.length + ' member' + (sq.members.length === 1 ? '' : 's') + (isMember && sq.code ? ' · room code <b class="sq-code">' + esc(sq.code) + '</b>' : '') + '</span><h1>👥 ' + esc(sq.name) + '</h1>' +
      (sq.comp ? '<p>' + (compOn ? '🏁 <b>Squad competition:</b> ' + Math.ceil((sq.comp.end - Date.now()) / 864e5) + ' days left. Biggest % growth since it started wins.' : '🏁 Competition finished ' + new Date(sq.comp.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '.') + '</p>' : '') + '</div>';
    if (!isMember) {
      h += '<div class="pt-card ch-card"><h2>You\'re invited</h2>' + (user ? '<button class="pt-btn pt-btn-go" type="button" id="sqJoin">Join ' + esc(sq.name) + '</button>' : '<button class="pt-btn pt-btn-go" type="button" id="sqSignIn">Sign in with Google to join</button>' + AUTH_MSG) +
        '<p class="pt-fine" id="sqMsg">Members see each other\'s Trade War (virtual) balance, growth and XP, and can chat in the squad. Enter Trade War once so your stats exist.</p></div>';
    }
    // shared goal
    var g = sq.goal, gp = g && S.goalProgress(sq, profs);
    if (g) h += '<div class="pt-card ch-card sq-goal' + (gp.done ? ' is-done' : '') + '"><div class="sq-goal-top"><span class="pt-kicker">Squad goal · ' + (gp.over ? 'finished' : Math.ceil((g.end - Date.now()) / 864e5) + ' days left') + '</span>' +
      '<b class="' + cls(gp.avg) + '">' + pct(gp.avg) + ' <small>of +' + g.target + '%</small></b></div>' +
      '<h2>' + esc(g.text || 'Squad average +' + g.target + '%') + '</h2><div class="sq-goal-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(gp.pct) + '"><i style="width:' + gp.pct.toFixed(1) + '%"></i></div>' +
      '<p class="pt-fine">' + (gp.done ? '🎉 Goal reached. ' : '') + 'Average % growth of ' + gp.counted + ' member' + (gp.counted === 1 ? '' : 's') + ' since ' + new Date(g.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '. Everyone counts, so help each other out.</p></div>';
    // leaderboard
    var tabs = (sq.comp ? [['comp', compOn ? 'Competition' : 'Last competition']] : []).concat([['all', 'All-time'], ['week', 'This week'], ['month', 'This month']]).concat(P && P.season() ? [['season', P.season().name]] : []);
    h += '<div class="sq-cols"><div class="pt-card ch-card"><h2>Leaderboard</h2><div class="lb-subtabs">' + tabs.map(function (t) { return '<button type="button" data-b="' + t[0] + '" class="' + (board === t[0] ? 'is-on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div>';
    var rows = sq.members.map(function (u) { var p = profs[u]; return { uid: u, p: p, name: (p && p.name) || (sq.names && sq.names[u]) || 'Trader', m: metric(sq, u, p) }; })
      .sort(function (a, b) { return (b.m ? b.m.pct : -1e9) - (a.m ? a.m.pct : -1e9); });
    h += '<div class="sq-board" data-help="Ranked by percentage growth, so everyone competes fairly whatever their balance. Tap a trader to open their profile.">' + rows.map(function (r, i) {
      var lv = L && r.p ? L.levelForXp(r.p.xp || 0) : null, me = user && r.uid === user.uid;
      return '<a class="sq-row' + (me ? ' is-me' : '') + '" href="profile.html?u=' + encodeURIComponent(r.uid) + '"><span class="sq-rank">' + (i + 1) + '</span>' +
        '<span class="sq-name">' + (lv && L ? L.badge(lv, 22) : '') + '<span' + zn(r.uid) + '>' + esc(r.name) + '</span>' + (r.uid === sq.owner ? ' <small>owner</small>' : '') + (compDone && board === 'comp' && i === 0 ? ' 🏆' : '') + '</span>' +
        (r.m ? '<span class="sq-pct ' + cls(r.m.pct) + '">' + pct(r.m.pct) + '</span><span class="sq-bal">' + money(r.p.equity) + '</span><span class="sq-xp">' + ((r.p.xp || 0).toLocaleString('en-US')) + ' XP</span>'
          : '<span class="sq-pct">private</span><span class="sq-bal"></span><span class="sq-xp"></span>') + '</a>';
    }).join('') + '</div>' +
      (isMember && sq.members.length > 1 ? '<div class="pt-soc-row" style="margin-top:12px"><button class="pt-mini pt-soc" type="button" id="sqWar">⚔️ Start a squad Trade War</button></div>' +
        (cfg.symbols || cfg.viewTrades ? '<p class="pt-fine">Squad Trade Wars: ' + [cfg.symbols ? 'only ' + cfg.symbols.length + ' allowed stock' + (cfg.symbols.length === 1 ? '' : 's') : '', cfg.viewTrades ? 'everyone sees everyone\'s trades' : ''].filter(Boolean).join(' · ') + '.</p>' : '') : '') + '</div>';
    // chat slot (built once, kept across re-renders so typing isn't lost)
    h += isMember ? '<div id="sqChatSlot"></div>' : '';
    h += '</div>';
    if (isMember) {
      h += '<div class="pt-card ch-card"><h2>Invite friends</h2><div class="pt-invite" data-help="Send this link to friends. They join with one tap after signing in, and see the squad leaderboard."><input readonly value="' + esc(link) + '"><button class="pt-mini pt-soc" type="button" id="sqShare">Share invite</button></div>' +
        (sq.code ? '<p class="pt-fine">Or tell them the room code <b class="sq-code">' + esc(sq.code) + '</b>: they type it on the Squads page.</p>' : '');
      if (isOwner) h += ownerPanel(sq, compOn);
      else h += '<button class="pt-mini" type="button" id="sqLeave">Leave squad</button>';
      h += '</div>';
    }
    body(h);
    if (isMember) mountChat(sq, user);
    wire(sq, user, link);
  }
  function ownerPanel(sq, compOn) {
    var cfg = sq.config || {};
    var h = '<div class="sq-owner"><h2>Squad competition</h2>' + (compOn ? '<p class="pt-fine">Running until ' + new Date(sq.comp.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '.</p><button class="pt-mini" type="button" id="sqEnd">End competition</button>'
      : '<p class="pt-fine">Everyone starts from their current account. Biggest % growth wins; resets don\'t count.</p><div class="pt-soc-row"><button class="pt-mini pt-soc" type="button" data-comp="7">Start a 7-day competition</button><button class="pt-mini pt-soc" type="button" data-comp="30">Start a 30-day competition</button></div>');
    h += '<h2>Shared goal</h2>' + (sq.goal ? '<button class="pt-mini" type="button" id="sqGoalEnd">Clear the goal</button>'
      : '<div class="sq-form"><input id="sqGoalText" maxlength="80" placeholder="Goal name, e.g. Green week"><label>Squad average <select id="sqGoalTarget">' + [1, 2, 3, 5, 10, 20].map(function (v) { return '<option value="' + v + '"' + (v === 3 ? ' selected' : '') + '>+' + v + '%</option>'; }).join('') + '</select></label>' +
        '<label>in <select id="sqGoalDays"><option value="7">7 days</option><option value="30">30 days</option></select></label><button class="pt-mini pt-soc" type="button" id="sqGoalSet">Set goal</button></div>');
    h += '<h2>Room code</h2><div class="pt-soc-row">' + (sq.code ? '<span class="sq-code sq-code-big">' + esc(sq.code) + '</span><button class="pt-mini" type="button" id="sqCodeNew">New code</button><button class="pt-mini" type="button" id="sqCodeOff">Turn off</button>' : '<button class="pt-mini pt-soc" type="button" id="sqCodeNew">Make a room code</button>') + '</div>' +
      '<p class="pt-fine">A 6-character code friends can type to find the squad. Making a new one stops the old one working.</p>';
    h += '<h2>Squad settings</h2><div class="sq-settings">' +
      chk('sqHelp', sq.helpMode, 'Help Mode: show beginner tips to every member here') +
      chk('sqCfgReact', cfg.reactions !== false, 'Reactions in the chat') +
      chk('sqCfgPhotos', !!cfg.photos, 'Camera-roll photos in the chat') +
      chk('sqCfgTrades', !!cfg.viewTrades, 'Squad Trade Wars: everyone can see everyone\'s trades') + '</div>' +
      '<label class="sq-f"><span>Squad Trade Wars: allowed stocks (empty = every stock)</span><input id="sqSyms" placeholder="e.g. AAPL, NVDA, TSLA" value="' + esc((cfg.symbols || []).join(', ')) + '" autocapitalize="characters" spellcheck="false"></label>' +
      '<div class="pt-soc-row"><button class="pt-mini pt-soc" type="button" id="sqSymsSave">Save stocks</button></div><p class="pt-fine">Options and crypto aren\'t in Trade War yet, so squad Trade Wars trade stocks.</p>';
    h += '<h2>Rename</h2><div class="pt-invite"><input id="sqRename" maxlength="32" value="' + esc(sq.name) + '"><button class="pt-mini" type="button" id="sqRenameGo">Save</button></div>';
    h += '<h2>Members</h2><div class="sq-members">' + sq.members.map(function (u) { return '<div class="sq-mem"><span>' + esc((sq.names || {})[u] || 'Trader') + (u === sq.owner ? ' <small>owner</small>' : '') + '</span>' + (u === sq.owner ? '' : '<button class="pt-mini" type="button" data-kick="' + esc(u) + '">Remove</button>') + '</div>'; }).join('') + '</div>';
    h += '<div class="sq-danger"><h2>Delete squad</h2><p class="pt-fine">Deletes the squad, its chat and its room code for everyone. This can\'t be undone.</p><button class="pt-mini sq-del" type="button" id="sqDelete">Delete squad…</button></div>';
    return h + '<p class="pt-auth-msg" id="sqOwnMsg" role="alert" hidden></p></div>';
  }
  function chk(id, on, label) { return '<label class="pt-check"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '> ' + label + '</label>'; }
  function wire(sq, user, link) {
    var say = function (t) { var m = $('sqOwnMsg'); if (m) { m.textContent = t; m.hidden = !t; } };
    var fail = function (e) { say((e && e.message) || String(e)); };
    document.querySelectorAll('[data-b]').forEach(function (b) { b.onclick = function () { board = b.getAttribute('data-b'); render(user); }; });
    if ($('sqSignIn')) $('sqSignIn').onclick = signIn;
    if (window.ZelosProfile) ZelosProfile.help.setGroup(sq.helpMode == null ? null : sq.helpMode);
    if ($('sqHelp')) $('sqHelp').onchange = function () { var on = this.checked, b = this; b.disabled = true; firebase.firestore().collection('squads').doc(sq.id).update({ helpMode: on }).then(function () { b.disabled = false; }, function () { b.checked = !on; b.disabled = false; }); };
    [['sqCfgReact', 'reactions'], ['sqCfgPhotos', 'photos'], ['sqCfgTrades', 'viewTrades']].forEach(function (x) {
      if ($(x[0])) $(x[0]).onchange = function () { var on = this.checked, b = this, patch = {}; patch[x[1]] = on; b.disabled = true; S.setSquadConfig(sq, patch).then(function () { b.disabled = false; }, function (e) { b.checked = !on; b.disabled = false; fail(e); }); };
    });
    if ($('sqSymsSave')) $('sqSymsSave').onclick = function () {
      var list = String($('sqSyms').value || '').toUpperCase().split(/[^A-Z.]+/).filter(Boolean), known = universe.map(function (u) { return u.sym; });
      var bad = known.length ? list.filter(function (x) { return known.indexOf(x) === -1; }) : [];
      if (bad.length) return say(bad.join(', ') + (bad.length === 1 ? ' isn\'t' : ' aren\'t') + ' in Trade War. Pick from the stocks in the Trade War ticket.');
      list = list.filter(function (x, i) { return list.indexOf(x) === i; }).slice(0, 60);
      S.setSquadConfig(sq, { symbols: list.length ? list : null }).then(function () { say(''); $('sqSymsSave').textContent = 'Saved ✓'; }, fail);
    };
    if ($('sqJoin')) $('sqJoin').onclick = function () { this.disabled = true; S.joinSquad(sq).catch(function (e) { $('sqJoin').disabled = false; $('sqMsg').textContent = e.message || e; }); };
    if ($('sqShare')) $('sqShare').onclick = function () { var b = this; S.shareLink('Join my Trading Squad', 'Join my Trading Squad "' + sq.name + '" on AgenticTrading.info.' + (sq.code ? ' Room code: ' + sq.code : ''), link).then(function (r) { if (r === 'copied') b.textContent = 'Copied ✓'; }); };
    if ($('sqLeave')) $('sqLeave').onclick = function () { if (confirm('Leave ' + sq.name + '?')) S.leaveSquad(sq).then(function () { location.search = ''; }); };
    if ($('sqEnd')) $('sqEnd').onclick = function () { if (confirm('End the competition now?')) S.endSquadComp(sq); };
    document.querySelectorAll('[data-comp]').forEach(function (b) { b.onclick = function () { b.disabled = true; board = 'comp'; S.startSquadComp(sq, +b.getAttribute('data-comp')); }; });
    if ($('sqGoalSet')) $('sqGoalSet').onclick = function () { this.disabled = true; S.setSquadGoal(sq, $('sqGoalText').value, +$('sqGoalTarget').value, +$('sqGoalDays').value).catch(fail); };
    if ($('sqGoalEnd')) $('sqGoalEnd').onclick = function () { if (confirm('Clear the squad goal?')) S.clearSquadGoal(sq).catch(fail); };
    if ($('sqCodeNew')) $('sqCodeNew').onclick = function () { if (sq.code && !confirm('Make a new room code? The old one (' + sq.code + ') stops working.')) return; this.disabled = true; S.newRoomCode(sq).catch(fail); };
    if ($('sqCodeOff')) $('sqCodeOff').onclick = function () { if (confirm('Turn off the room code? People can still join with the invite link.')) S.removeRoomCode(sq).catch(fail); };
    if ($('sqRenameGo')) $('sqRenameGo').onclick = function () { S.renameSquad(sq, $('sqRename').value).then(function () { say(''); }, fail); };
    document.querySelectorAll('[data-kick]').forEach(function (b) { b.onclick = function () { var u = b.getAttribute('data-kick'); if (confirm('Remove ' + ((sq.names || {})[u] || 'this trader') + ' from ' + sq.name + '?')) S.removeMember(sq, u).catch(fail); }; });
    if ($('sqDelete')) $('sqDelete').onclick = function () {
      var t = prompt('This deletes "' + sq.name + '" for everyone and can\'t be undone.\n\nType the squad name to confirm:');
      if (t == null) return;
      if (t.trim() !== sq.name) return say('The name didn\'t match, so nothing was deleted.');
      if (sqUnsub) { sqUnsub(); sqUnsub = null; }
      S.deleteSquad(sq).then(function () { location.href = 'squads.html'; }, fail);
    };
    if ($('sqWar')) $('sqWar').onclick = function () { if (window.ZelosChallenge) ZelosChallenge.open({ squadId: sq.id, squadName: sq.name }); };
  }

  // ------------------------------------------------------------ chat
  var chat = null; // { id, el, unsub, msgs, photo }
  function mountChat(sq, user) {
    var slot = $('sqChatSlot'); if (!slot) return;
    if (!chat || chat.id !== sq.id) {
      if (chat && chat.unsub) chat.unsub();
      var el = document.createElement('section'); el.className = 'pt-card ch-card sq-chat';
      el.innerHTML = '<h2>Squad chat</h2><div class="sq-msgs" id="sqMsgs" aria-live="polite"><p class="pt-empty">Loading…</p></div>' +
        '<div class="sq-photo-prev" id="sqPhotoPrev" hidden></div>' +
        '<form class="sq-compose" id="sqCompose"><label class="sq-photo-btn" id="sqPhotoBtn" title="Add a photo from your camera roll" hidden><input type="file" accept="image/*" id="sqPhoto" hidden>' + ico('camera') + '</label>' +
        '<input id="sqText" maxlength="500" placeholder="Message your squad" autocomplete="off" aria-label="Message"><button class="pt-mini pt-soc" type="submit">Send</button></form><p class="pt-auth-msg" id="sqChatMsg" role="alert" hidden></p>';
      chat = { id: sq.id, el: el, msgs: [], photo: null };
      var say = function (t) { var m = el.querySelector('#sqChatMsg'); m.textContent = t; m.hidden = !t; };
      el.querySelector('#sqCompose').onsubmit = function (e) {
        e.preventDefault(); var inp = el.querySelector('#sqText'), txt = inp.value, ph = chat.photo;
        if (!txt.trim() && !ph) return;
        inp.value = ''; chat.photo = null; showPhoto(); say('');
        S.sendMessage(current, txt, ph).catch(function (err) { inp.value = txt; say((err && err.message) || 'Couldn\'t send. Try again.'); });
      };
      el.querySelector('#sqPhoto').onchange = function () { var f = this.files && this.files[0]; this.value = ''; S.chatPhoto(f).then(function (d) { chat.photo = d; showPhoto(); }, function (err) { say(err.message); }); };
      el.addEventListener('click', function (e) {
        var r = e.target.closest('[data-react]'), del = e.target.closest('[data-del]'), x = e.target.closest('#sqPhotoX');
        if (x) { chat.photo = null; showPhoto(); return; }
        var find = function (id) { return chat.msgs.filter(function (m) { return m.id === id; })[0]; };
        if (r) { var m = find(r.getAttribute('data-id')); if (m) S.react(current, m, r.getAttribute('data-react')).catch(function (err) { say(err.message); }); }
        if (del && confirm('Delete this message?')) { var d = find(del.getAttribute('data-del')); if (d) S.deleteMessage(current, d).catch(function (err) { say(err.message); }); }
      });
      // Right after joining, the server may not have your membership yet: retry a few times.
      var tries = 0, listen = function () {
        chat.unsub = S.watchMessages(sq, function (msgs) { tries = 0; chat.msgs = msgs; drawChat(user); }, function () {
          if (++tries <= 10) return setTimeout(function () { if (chat && chat.el === el) listen(); }, 800);
          el.querySelector('#sqMsgs').innerHTML = '<p class="pt-empty">Couldn\'t load the chat. Reload the page to try again.</p>';
        });
      };
      listen();
    }
    slot.appendChild(chat.el);
    chat.el.querySelector('#sqPhotoBtn').hidden = !(current.config || {}).photos;
    drawChat(user);
  }
  function showPhoto() {
    var p = chat.el.querySelector('#sqPhotoPrev');
    p.hidden = !chat.photo; p.innerHTML = chat.photo ? '<img alt="Photo to send" src="' + chat.photo + '"><button type="button" class="pt-mini" id="sqPhotoX">Remove</button>' : '';
  }
  function drawChat(user) {
    if (!chat) return;
    var box = chat.el.querySelector('#sqMsgs'), sq = current, cfg = sq.config || {}, owner = user && sq.owner === user.uid;
    var atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.innerHTML = chat.msgs.length ? chat.msgs.map(function (m) {
      var mine = user && m.author === user.uid, counts = {};
      Object.keys(m.r || {}).forEach(function (u) { counts[m.r[u]] = (counts[m.r[u]] || 0) + 1; });
      var reacts = cfg.reactions === false ? '' : '<div class="sq-reacts">' + S.REACTIONS.map(function (k) {
        var n = counts[k] || 0, on = user && (m.r || {})[user.uid] === k;
        return '<button type="button" class="sq-react' + (on ? ' is-on' : '') + (n ? ' has' : '') + '" data-react="' + k + '" data-id="' + esc(m.id) + '" aria-label="' + k + (n ? ' (' + n + ')' : '') + '" aria-pressed="' + !!on + '">' + ico(REACT_ICON[k]) + (n ? '<small>' + n + '</small>' : '') + '</button>';
      }).join('') + '</div>';
      return '<div class="sq-msg' + (mine ? ' is-me' : '') + '"><div class="sq-msg-head"><b' + zn(m.author) + '>' + esc(m.name || 'Trader') + '</b><small>' + time(m.createdAt) + '</small>' +
        (mine || owner ? '<button type="button" class="sq-msg-del" data-del="' + esc(m.id) + '" aria-label="Delete message">×</button>' : '') + '</div>' +
        (m.text ? '<p>' + esc(m.text) + '</p>' : '') + (m.photo && /^data:image\/jpeg;base64,/.test(m.photo) ? '<img class="sq-msg-img" alt="Photo from ' + esc(m.name || 'a member') + '" src="' + m.photo + '">' : '') + reacts + '</div>';
    }).join('') : '<p class="pt-empty">No messages yet. Say hi to your squad.</p>';
    if (atBottom || !box.dataset.seen) { box.scrollTop = box.scrollHeight; box.dataset.seen = '1'; }
  }

  function view(id, user) {
    if (sqUnsub) sqUnsub();
    sqUnsub = S.watchSquad(id, function (sq) {
      if (!sq) { body('<div class="pf-missing"><h1>Squad not found</h1><p>The invite link may be wrong, or the squad was deleted.</p><a class="pt-btn pt-btn-go" href="squads.html">Your squads</a></div>'); return; }
      current = sq;
      S.profiles(sq.members).then(function (m) { profs = m; render(user); });
      render(user);
    }, function () {
      body('<div class="ch-hero"><span class="pt-kicker">Trading Squad</span><h1>Sign in to see this squad</h1><p>Squads are private to people with the invite link.</p></div><div class="pt-card ch-card"><button class="pt-btn pt-btn-go" type="button" id="sqSignIn">Sign in with Google</button>' + AUTH_MSG + '</div>');
      $('sqSignIn').onclick = signIn;
    });
  }
  function start() {
    if (!S || !S.init()) { body('<div class="pf-missing"><h1>Squads need the live site</h1><p>Try again on agentictrading.info.</p></div>'); return; }
    var id = new URLSearchParams(location.search).get('s');
    fetch('../data/practice-universe.json').then(function (r) { return r.json(); }).then(function (u) { universe = u.symbols || []; }).catch(function () {});
    if (window.ZelosSignIn) ZelosSignIn.finish(function (t) { var m = $('sqAuthMsg'); if (m) { m.textContent = t; m.hidden = false; } else alert(t); });
    firebase.auth().onAuthStateChanged(function (u) {
      var user = u && !u.isAnonymous ? u : null;
      // squad reads need some auth; zelos-xp signs guests in anonymously a moment after load
      if (id) { if (u) view(id, user); else body('<p class="pt-empty">Loading squad…</p>'); return; }
      hub(user);
    });
  }
  document.addEventListener('DOMContentLoaded', start);
})();
