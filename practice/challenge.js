/*!
 * Zelos Practice Account: friend challenges (practice/challenge.html).
 *
 *   challenge.html            your challenges + start a new one
 *   challenge.html?c=<id>     one challenge: accept it, the live head-to-head, or the final result
 *
 * Scores are growth since the challenge started, in net P&L (resets never
 * count as gains), from each player's public practice profile. After the end
 * date the result freezes on each player's end-of-day history. See
 * zelos-social.js for the data model.
 */
(function () {
  'use strict';
  var S = window.ZelosSocial, P = window.ZelosProgress, L = window.ZelosLevels;
  var $ = function (id) { return document.getElementById(id); };
  var esc = S ? S.esc : function (x) { return x; };
  function money(v, d) { d = d == null ? 2 : d; return (v < 0 ? '-$' : '$') + Math.abs(+v || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function signed(v) { return (v >= 0 ? '+' : '-') + money(Math.abs(v)); }
  function pct(v) { return (v >= 0 ? '+' : '') + (+v || 0).toFixed(2) + '%'; }
  function cls(v) { return v >= 0 ? 'up' : 'dn'; }
  function body(h) { $('chBody').innerHTML = h; }
  function left(ms) {
    var s = Math.max(0, Math.round((ms - Date.now()) / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + m + 'm' : m + 'm';
  }
  function signInBtn(label) { return '<button class="pt-btn pt-btn-go" type="button" id="chSignIn">' + (label || 'Sign in with Google') + '</button>'; }
  function wireSignIn() {
    var b = $('chSignIn'); if (!b) return;
    b.onclick = function () { firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(function (e) { alert(e.message || e); }); };
  }

  // ------------------------------------------------------------ hub (no ?c)
  function hub(user) {
    var h = '<div class="ch-hero"><span class="pt-kicker">Friend challenges</span><h1>Who can grow $10,000 the most?</h1>' +
      '<p>Challenge a friend in Trade War with your $10,000 virtual accounts. You both start from where you are now; the bigger percentage gain wins. Resets never count as growth.</p></div>';
    if (!user) { body(h + '<div class="pt-card ch-card">' + signInBtn() + '<p class="pt-fine">You need to be signed in to Trade War (with "Show my stats" on) to challenge anyone.</p></div>'); return wireSignIn(); }
    var se = P && P.season();
    h += '<div class="pt-card ch-card"><h2>Start a challenge</h2><div class="pt-ch-days">' +
      [['7', '7 days'], ['30', '30 days']].concat(se ? [['season', 'Rest of ' + se.name]] : []).map(function (d, k) { return '<label><input type="radio" name="chDays" value="' + d[0] + '"' + (k === 0 ? ' checked' : '') + '> ' + d[1] + '</label>'; }).join('') +
      '</div><button class="pt-btn pt-btn-go" type="button" id="chCreate">Create challenge link</button><p class="pt-fine" id="chMsg"></p></div>' +
      '<div class="pt-card ch-card"><h2>Your challenges</h2><div id="chList"><p class="pt-empty">Loading…</p></div></div>';
    body(h);
    $('chCreate').onclick = function () {
      var v = (document.querySelector('[name="chDays"]:checked') || {}).value || '7', endAt = null, days = +v;
      if (v === 'season' && se) { endAt = new Date(se.end + 'T21:00:00Z').getTime(); days = Math.max(1, Math.round((endAt - Date.now()) / 864e5)); }
      this.disabled = true;
      S.createChallenge({ days: days, endAt: endAt, season: v === 'season' && se ? se.id : null }).then(function (id) { location.search = '?c=' + encodeURIComponent(id); })
        .catch(function (e) { $('chCreate').disabled = false; $('chMsg').innerHTML = esc(e.message || e) + ' <a href="./">Enter Trade War &rarr;</a>'; });
    };
    S.myChallenges(user.uid).then(function (list) {
      if (!list.length) { $('chList').innerHTML = '<p class="pt-empty">No challenges yet.</p>'; return; }
      $('chList').innerHTML = '<div class="ch-rows">' + list.map(function (c) {
        var mineC = c.creator === user.uid, other = mineC ? (c.opponentName || (c.targetName ? c.targetName + ' (invited)' : 'Waiting for a friend')) : c.creatorName;
        var state = c.status === 'open' ? (c.target === user.uid ? '<b class="ch-inc">Challenged you</b>' : 'Waiting') : (c.endAt && Date.now() > c.endAt ? 'Finished' : left(c.endAt) + ' left');
        return '<a class="ch-row" href="?c=' + encodeURIComponent(c.id) + '"><span>⚔️ vs <b>' + esc(other) + '</b></span><span>' + (c.days || '?') + ' days</span><span>' + state + '</span></a>';
      }).join('') + '</div>';
    });
  }

  // ------------------------------------------------------------ one challenge
  var profUnsubs = [], profs = {}, tick = null, chUnsub = null;
  function watchProfiles(ids, cb) {
    profUnsubs.forEach(function (u) { u(); }); profUnsubs = [];
    ids.forEach(function (id) {
      profUnsubs.push(firebase.firestore().collection('practiceProfiles').doc(id).onSnapshot(function (d) { profs[id] = d.exists ? Object.assign({ uid: id }, d.data()) : null; cb(); }, function () {}));
    });
  }
  function view(id, user) {
    if (chUnsub) chUnsub();
    chUnsub = S.watchChallenge(id, function (ch) {
      if (!ch || ch.status === 'cancelled') { body('<div class="pf-missing"><h1>Challenge not found</h1><p>It may have been cancelled, or the link is wrong.</p><a class="pt-btn pt-btn-go" href="challenge.html">Your challenges</a></div>'); return; }
      if (ch.status === 'open') return open(ch, user);
      if (profUnsubs.length && profs.hasOwnProperty(ch.creator) && profs.hasOwnProperty(ch.opponent)) return active(ch, user);
      watchProfiles([ch.creator, ch.opponent], function () { active(ch, user); });
      active(ch, user);
      clearInterval(tick); tick = setInterval(function () { active(ch, user); }, 30000);
    });
  }
  function open(ch, user) {
    var mine = user && user.uid === ch.creator, link = S.links(ch.creator).challenge(ch.id);
    var h = '<div class="ch-hero"><span class="pt-kicker">Friend challenge · ' + (ch.season ? 'rest of the season' : ch.days + ' days') + '</span>' +
      '<h1>' + esc(ch.creatorName) + ' challenged ' + (ch.target ? esc(ch.targetName || 'you') : 'you') + ' to see who can grow $10,000 the most.</h1>' +
      '<p>Both Trade War accounts (virtual money) start the clock at their current value. The bigger percentage gain after ' + (ch.season ? 'the season ends' : ch.days + ' days') + ' wins. Resets don\'t count as growth.</p></div><div class="pt-card ch-card">';
    if (mine) {
      h += '<h2>Waiting for ' + (ch.target ? esc(ch.targetName) : 'a friend') + ' to accept</h2><p class="pt-fine">Send this link. The clock starts the moment they accept.</p>' +
        '<div class="pt-invite"><input readonly value="' + esc(link) + '"><button class="pt-mini pt-soc" type="button" id="chShare">Share link</button></div>' +
        '<button class="pt-mini" type="button" id="chCancel">Cancel challenge</button>';
    } else if (!user) {
      h += '<h2>Accept the challenge</h2>' + signInBtn('Sign in with Google to accept') + '<p class="pt-fine">New here? You get a free $10,000 Trade War account (virtual money, real stock prices). Sign in, then open the practice account once so your stats exist.</p>';
    } else if (ch.target && ch.target !== user.uid) {
      h += '<p class="pt-empty">This challenge was sent to ' + esc(ch.targetName || 'someone else') + '.</p>';
    } else {
      h += '<h2>Accept the challenge</h2><button class="pt-btn pt-btn-go" type="button" id="chAccept">Accept · start the clock</button><p class="pt-fine" id="chMsg"></p>';
    }
    body(h + '</div>');
    wireSignIn();
    if ($('chShare')) $('chShare').onclick = function () { var b = this; S.shareLink('Trade War challenge', ch.creatorName + ' challenged you to a Trade War: who can grow $10,000 (virtual) the most?', link).then(function (r) { if (r === 'copied') b.textContent = 'Copied ✓'; }); };
    if ($('chCancel')) $('chCancel').onclick = function () { if (confirm('Cancel this challenge?')) S.cancelChallenge(ch.id); };
    if ($('chAccept')) $('chAccept').onclick = function () {
      this.disabled = true;
      S.acceptChallenge(ch).catch(function (e) { $('chAccept').disabled = false; $('chMsg').innerHTML = esc(e.message || e) + ' <a href="./">Enter Trade War &rarr;</a>'; });
    };
  }
  function card(r, isLeader, finished) {
    var p = r.profile, sc = r.score, lv = L && p ? L.levelForXp(p.xp || 0) : null;
    return '<div class="ch-side' + (isLeader ? ' is-lead' : '') + '">' + (isLeader ? '<span class="ch-crown">' + (finished ? '🏆 Winner' : '👑 Leading') + '</span>' : '') +
      '<a class="ch-name" href="profile.html?u=' + encodeURIComponent(r.uid) + '">' + (lv && L ? L.badge(lv, 34) : '') + '<b>' + esc(r.name) + '</b></a>' +
      (sc ? '<div class="ch-pct ' + cls(sc.pct) + '">' + pct(sc.pct) + '</div><div class="ch-sub">' + signed(sc.pnl) + ' since the start</div>' +
        '<div class="ch-stats"><span><small>Balance</small><b>' + money(sc.equity || (p && p.equity) || 0) + '</b></span><span><small>XP gained</small><b>+' + Math.max(0, Math.round(sc.xp || 0)) + '</b></span>' +
        '<span><small>Level</small><b>' + (lv ? lv.level : '–') + '</b></span><span><small>Trades</small><b>' + ((p && p.trades) || 0) + '</b></span></div>'
        : '<p class="pt-empty">' + (p ? 'Waiting for numbers…' : 'Stats are private or missing.') + '</p>') + '</div>';
  }
  function active(ch, user) {
    var st = S.standings(ch, profs), finished = st.finished || (ch.endAt && Date.now() > ch.endAt);
    var rows = st.rows, lead = finished ? st.winner : st.leader;
    var a = rows[0], b = rows[1];
    var h = '<div class="ch-hero"><span class="pt-kicker">Head-to-head · ' + (ch.season ? 'season challenge' : ch.days + '-day challenge') + '</span>' +
      '<h1>' + esc(a.name) + ' <span class="ch-vs">vs</span> ' + esc(b ? b.name : '…') + '</h1>' +
      '<p>' + (finished ? 'Finished ' + new Date(ch.endAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '. ' + (st.winner ? esc(st.winner.name) + ' wins.' : 'It\'s a tie.')
        : '<b>' + left(ch.endAt) + '</b> left · ends ' + new Date(ch.endAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '. Growth since the start, resets excluded.') + '</p></div>';
    // tug-of-war bar
    if (a.score && b && b.score) {
      var diff = a.score.pct - b.score.pct, share = Math.max(8, Math.min(92, 50 + diff * 4));
      h += '<div class="ch-tug"><i style="width:' + share.toFixed(1) + '%"></i></div>';
    }
    h += '<div class="ch-grid">' + card(a, lead && lead.uid === a.uid, finished) + (b ? card(b, lead && lead.uid === b.uid, finished) : '') + '</div>';
    var link = S.links(ch.creator).challenge(ch.id);
    h += '<div class="ch-foot"><button class="pt-mini pt-soc" type="button" id="chShare">Share this challenge</button><a class="pt-mini" href="./">Trade in Trade War &rarr;</a><a class="pt-mini" href="challenge.html">All challenges</a></div>';
    body(h);
    $('chShare').onclick = function () { var btn = this; S.shareLink('Trade War challenge', a.name + ' vs ' + (b ? b.name : '') + ': who can grow $10,000 the most?', link).then(function (r) { if (r === 'copied') btn.textContent = 'Copied ✓'; }); };
    if (finished) S.settle(ch, st);
  }

  function start() {
    if (!S || !S.init()) { body('<div class="pf-missing"><h1>Challenges need the live site</h1><p>Try again on agentictrading.info.</p></div>'); return; }
    var id = new URLSearchParams(location.search).get('c'), started = false;
    firebase.auth().onAuthStateChanged(function (u) {
      var user = u && !u.isAnonymous ? u : null;
      if (id) { if (!started || user) { started = true; view(id, user); } return; }
      hub(user);
    });
  }
  document.addEventListener('DOMContentLoaded', start);
})();
