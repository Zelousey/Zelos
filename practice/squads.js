/*!
 * Zelos Practice Account: Trading Squads (practice/squads.html).
 *
 *   squads.html           your squads + create one
 *   squads.html?s=<id>    one squad: join by invite link, the squad leaderboard,
 *                         and the owner's squad competitions
 *
 * A squad is private: only people with the invite link can find it. Its
 * leaderboard reads each member's public practice profile. See zelos-social.js.
 */
(function () {
  'use strict';
  var S = window.ZelosSocial, P = window.ZelosProgress, L = window.ZelosLevels;
  var $ = function (id) { return document.getElementById(id); };
  var esc = S ? S.esc : function (x) { return x; };
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
      '<div class="pt-card ch-card"><h2>Your squads</h2><div id="sqList"><p class="pt-empty">Loading…</p></div></div>';
    body(h);
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

  var board = 'comp', sqUnsub = null, current = null, profs = {};
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
  function render(user) {
    var sq = current; if (!sq) return;
    var isMember = user && sq.members.indexOf(user.uid) !== -1, isOwner = user && sq.owner === user.uid;
    var link = S.links(user ? user.uid : null).squad(sq.id);
    var compOn = sq.comp && Date.now() < sq.comp.end, compDone = sq.comp && Date.now() >= sq.comp.end;
    if (!sq.comp && board === 'comp') board = 'all';
    var h = '<div class="ch-hero"><span class="pt-kicker">Trading Squad · ' + sq.members.length + ' member' + (sq.members.length === 1 ? '' : 's') + '</span><h1>👥 ' + esc(sq.name) + '</h1>' +
      (sq.comp ? '<p>' + (compOn ? '🏁 <b>Squad competition:</b> ' + Math.ceil((sq.comp.end - Date.now()) / 864e5) + ' days left. Biggest % growth since it started wins.' : '🏁 Competition finished ' + new Date(sq.comp.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '.') + '</p>' : '') + '</div>';
    if (!isMember) {
      h += '<div class="pt-card ch-card"><h2>You\'re invited</h2>' + (user ? '<button class="pt-btn pt-btn-go" type="button" id="sqJoin">Join ' + esc(sq.name) + '</button>' : '<button class="pt-btn pt-btn-go" type="button" id="sqSignIn">Sign in with Google to join</button>' + AUTH_MSG) +
        '<p class="pt-fine" id="sqMsg">Members see each other\'s Trade War (virtual) balance, growth and XP. Enter Trade War once so your stats exist.</p></div>';
    }
    var tabs = (sq.comp ? [['comp', compOn ? 'Competition' : 'Last competition']] : []).concat([['all', 'All-time'], ['week', 'This week'], ['month', 'This month']]).concat(P && P.season() ? [['season', P.season().name]] : []);
    h += '<div class="pt-card ch-card"><div class="lb-subtabs">' + tabs.map(function (t) { return '<button type="button" data-b="' + t[0] + '" class="' + (board === t[0] ? 'is-on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div>';
    var rows = sq.members.map(function (u) { var p = profs[u]; return { uid: u, p: p, name: (p && p.name) || (sq.names && sq.names[u]) || 'Trader', m: metric(sq, u, p) }; })
      .sort(function (a, b) { return (b.m ? b.m.pct : -1e9) - (a.m ? a.m.pct : -1e9); });
    h += '<div class="sq-board" data-help="Ranked by percentage growth, so everyone competes fairly whatever their balance. Tap a trader to open their profile.">' + rows.map(function (r, i) {
      var lv = L && r.p ? L.levelForXp(r.p.xp || 0) : null, me = user && r.uid === user.uid;
      return '<a class="sq-row' + (me ? ' is-me' : '') + '" href="profile.html?u=' + encodeURIComponent(r.uid) + '"><span class="sq-rank">' + (i + 1) + '</span>' +
        '<span class="sq-name">' + (lv && L ? L.badge(lv, 22) : '') + esc(r.name) + (r.uid === sq.owner ? ' <small>owner</small>' : '') + (compDone && board === 'comp' && i === 0 ? ' 🏆' : '') + '</span>' +
        (r.m ? '<span class="sq-pct ' + cls(r.m.pct) + '">' + pct(r.m.pct) + '</span><span class="sq-bal">' + money(r.p.equity) + '</span><span class="sq-xp">' + ((r.p.xp || 0).toLocaleString('en-US')) + ' XP</span>'
          : '<span class="sq-pct">private</span><span class="sq-bal"></span><span class="sq-xp"></span>') + '</a>';
    }).join('') + '</div></div>';
    if (isMember) {
      h += '<div class="pt-card ch-card"><h2>Invite friends</h2><div class="pt-invite" data-help="Send this link to friends. They join with one tap after signing in, and see the squad leaderboard."><input readonly value="' + esc(link) + '"><button class="pt-mini pt-soc" type="button" id="sqShare">Share invite</button></div>';
      if (isOwner) {
        h += '<h2>Squad competition</h2>' + (compOn ? '<p class="pt-fine">Running until ' + new Date(sq.comp.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '.</p><button class="pt-mini" type="button" id="sqEnd">End competition</button>'
          : '<p class="pt-fine">Everyone starts from their current account. Biggest % growth wins; resets don\'t count.</p><div class="pt-soc-row"><button class="pt-mini pt-soc" type="button" data-comp="7">Start a 7-day competition</button><button class="pt-mini pt-soc" type="button" data-comp="30">Start a 30-day competition</button></div>');
        h += '<h2>Squad settings</h2><label class="pt-check"><input type="checkbox" id="sqHelp"' + (sq.helpMode ? ' checked' : '') + '> Help Mode for this squad: show beginner tips to every member here</label>';
      } else h += '<button class="pt-mini" type="button" id="sqLeave">Leave squad</button>';
      h += '</div>';
    }
    body(h);
    document.querySelectorAll('[data-b]').forEach(function (b) { b.onclick = function () { board = b.getAttribute('data-b'); render(user); }; });
    if ($('sqSignIn')) $('sqSignIn').onclick = signIn;
    if (window.ZelosProfile) ZelosProfile.help.setGroup(sq.helpMode == null ? null : sq.helpMode);
    if ($('sqHelp')) $('sqHelp').onchange = function () { var on = this.checked, b = this; b.disabled = true; firebase.firestore().collection('squads').doc(sq.id).update({ helpMode: on }).then(function () { b.disabled = false; }, function () { b.checked = !on; b.disabled = false; }); };
    if ($('sqJoin')) $('sqJoin').onclick = function () { this.disabled = true; S.joinSquad(sq).catch(function (e) { $('sqJoin').disabled = false; $('sqMsg').textContent = e.message || e; }); };
    if ($('sqShare')) $('sqShare').onclick = function () { var b = this; S.shareLink('Join my Trading Squad', 'Join my Trading Squad "' + sq.name + '" and compete with $10,000 Trade War accounts.', link).then(function (r) { if (r === 'copied') b.textContent = 'Copied ✓'; }); };
    if ($('sqLeave')) $('sqLeave').onclick = function () { if (confirm('Leave ' + sq.name + '?')) S.leaveSquad(sq).then(function () { location.search = ''; }); };
    if ($('sqEnd')) $('sqEnd').onclick = function () { if (confirm('End the competition now?')) S.endSquadComp(sq); };
    document.querySelectorAll('[data-comp]').forEach(function (b) { b.onclick = function () { b.disabled = true; board = 'comp'; S.startSquadComp(sq, +b.getAttribute('data-comp')); }; });
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
