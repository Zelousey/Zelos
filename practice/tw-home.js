/*!
 * Zelos Trade War home: one place for everything Trade War.
 *
 *   #twTop  (Trade War page + every match room)
 *           your trader card (picture, @username, level + XP bar), the account
 *           switcher (Main account + the Trade Wars you're in), "Start a Trade
 *           War", and any challenges waiting for you (Accept / Decline).
 *   #twHub  (Trade War page) leaderboard, today's missions, achievements,
 *           friends (with Challenge buttons) and your Trade War history.
 *
 * The Main account is the standing $10,000 virtual account (practice.js); each
 * Trade War is a separate equal-buy-in match account run by the server
 * (functions/main.py tw_*). practice/index.html#start opens "Start a Trade War".
 */
(function () {
  'use strict';
  var d = document, $ = function (id) { return d.getElementById(id); };
  var db = null, user = null, wars = [], ranks = {}, invites = [], xp = 0, trader = {};
  var here = new URLSearchParams(location.search).get('w'), onHome = !!$('twHub');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(v, dd) { dd = dd == null ? 2 : dd; v = +v || 0; return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dd, maximumFractionDigits: dd }); }
  function pct(v) { v = +v || 0; return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; }
  function mainBalance() {
    try { var a = JSON.parse(localStorage.getItem('zelosPractice-v1') || 'null'); if (a && a.summary && a.summary.equity != null) return a.summary.equity; } catch (e) {}
    return null;
  }

  // ------------------------------------------------------------ top strip
  function renderTop() {
    var el = $('twTop'); if (!el) return;
    var L = window.ZelosLevels, lv = L ? L.levelForXp(xp) : null, nx = L ? L.nextLevelForXp(xp) : null;
    var prog = lv && nx ? Math.round((xp - lv.xp) / Math.max(1, nx.xp - lv.xp) * 100) : 100;
    var ph = trader.avatar || trader.photo || (user && user.photoURL);
    var nm = trader.username ? '@' + trader.username : (trader.name || (user && user.displayName ? user.displayName.split(' ')[0] : 'Guest'));
    var av = ph && /^(https:|data:image\/(jpeg|png|webp);base64,)/.test(ph) ? '<img class="twh-av" alt="" referrerpolicy="no-referrer" src="' + esc(ph) + '">' : '<span class="twh-av">' + esc(nm.replace('@', '').charAt(0).toUpperCase() || 'Z') + '</span>';
    var bal = mainBalance();
    var chips = '<a class="twh-acct' + (!here ? ' is-on' : '') + '" href="index.html"><small>Main account</small><b>' + (bal != null ? money(bal) : '$10,000') + '</b></a>' +
      wars.filter(function (w) { return w.status === 'active' || w.status === 'lobby' || w.status === 'draft'; }).map(function (w) {
        var r = ranks[w.id], sub = w.status === 'lobby' ? 'Lobby · ' + w.players.length + '/' + w.maxPlayers : w.status === 'draft' ? 'Drafting' : r ? (r.out ? 'OUT · #' : '#') + r.rank + ' of ' + r.of + ' · ' + pct(r.pnlPct) : 'Live';
        return '<a class="twh-acct' + (here === w.id ? ' is-on' : '') + (w.status === 'active' ? ' is-live' : '') + '" href="war.html?w=' + encodeURIComponent(w.id) + '"><small>' + (w.lms ? '&#9760; ' : '⚔️ ') + esc(w.name) + '</small><b>' + sub + '</b></a>';
      }).join('');
    el.innerHTML = '<div class="twh-top">' +
      '<a class="twh-me" href="profile.html">' + av + '<span><b>' + esc(nm) + '</b>' + (lv ? '<small>Level ' + lv.level + ' · ' + esc(lv.name) + ' · ' + xp.toLocaleString('en-US') + ' XP</small><i class="twh-xp"><i style="width:' + prog + '%"></i></i>' : '') + '</span></a>' +
      '<nav class="twh-accts" aria-label="Your Trade War accounts">' + chips + '</nav>' +
      '<button type="button" class="twh-start" id="twhStart">+ Start a Trade War</button></div>' +
      (invites.length ? '<div class="twh-inv">' + invites.map(function (i) {
        return '<div class="twh-inv-row"><span>' + (i.lms ? '&#9760;' : '⚔️') + ' <b>' + esc(i.fromName || 'A trader') + '</b> challenged you' + (i.lms ? ' to Last Man Standing' : '') + ' · ' + money(i.buyIn, 0) + ' buy-in · ' + i.days + 'd' +
          (i.lms && window.ZelosChallenge ? '<small class="twh-inv-rules">' + ZelosChallenge.lmsRules(i.lms, i.buyIn).map(esc).join(' · ') + '</small>' : '') + '</span>' +
          '<span><button type="button" class="twh-no" data-inv="' + esc(i.id) + '" data-ok="0">Decline</button><button type="button" class="twh-yes" data-inv="' + esc(i.id) + '" data-ok="1">Accept</button></span></div>';
      }).join('') + '</div>' : '');
    $('twhStart').onclick = start;
    el.querySelectorAll('[data-inv]').forEach(function (b) {
      b.onclick = function () {
        var ok = b.getAttribute('data-ok') === '1'; b.disabled = true;
        window.ZelosChallenge.call('tw_respond', { inviteId: b.getAttribute('data-inv'), accept: ok }).then(function (r) {
          if (ok && r.status === 'accepted') location.href = 'war.html?w=' + encodeURIComponent(r.warId);
        }, function (e) { b.disabled = false; alert((e && e.message) || 'Something went wrong.'); });
      };
    });
  }
  function start() {
    if (!user) { alert('Sign in to start a Trade War.'); return; }
    if (window.ZelosChallenge) ZelosChallenge.open({});
  }

  // ------------------------------------------------------------ hub
  function card(title, body, link) { return '<section class="pt-card twh-card"><div class="twh-card-head"><h2>' + title + '</h2>' + (link || '') + '</div>' + body + '</section>'; }
  function renderHub(extra) {
    var el = $('twHub'); if (!el) return;
    var P = window.ZelosProgress, h = '';
    // missions
    if (P) {
      var ms = P.missions();
      h += card('Today\'s missions', '<ul class="twh-list">' + ms.daily.map(function (m) { return '<li class="' + (m.done ? 'is-done' : '') + '"><span>' + (m.done ? '✅ ' : '') + esc(m.label) + '</span><small>' + m.count + '/' + m.goal + ' · +' + m.xp + ' XP</small></li>'; }).join('') + '</ul>' +
        '<p class="pt-fine">🔥 ' + ms.streak.days + '-day streak · finish ' + ms.streak.need + ' a day to keep it.</p>', '<a href="index.html?tab=progress">All &rarr;</a>');
      var un = P.unlocked(), ids = Object.keys(un).sort(function (a, b) { return un[b] - un[a]; });
      h += card('Achievements', '<p class="twh-big">' + ids.length + ' <small>of ' + P.ACHIEVEMENTS.length + ' unlocked</small></p><div class="twh-badges">' + ids.slice(0, 6).map(function (id) { return '<span title="' + esc((P.achievement(id) || {}).label || id) + '">' + P.badge(id, 34) + '</span>'; }).join('') + '</div>', '<a href="profile.html">Profile &rarr;</a>');
    }
    h += card('Leaderboard', (extra.board || '<p class="pt-empty">Loading…</p>'), '<a href="../leaderboard.html#practice">All &rarr;</a>');
    h += card('Friends', (extra.friends || (user ? '<p class="pt-empty">Loading…</p>' : '<p class="pt-empty">Sign in to see your friends.</p>')), '<a href="squads.html">Squads &rarr;</a>');
    var done = wars.filter(function (w) { return w.status === 'ended'; }).slice(0, 5);
    h += card('Trade War history', done.length ? '<ul class="twh-list">' + done.map(function (w) {
      var me = (w.results || []).filter(function (r) { return user && r.uid === user.uid; })[0];
      return '<li><a href="war.html?w=' + encodeURIComponent(w.id) + '">' + (me && me.rank === 1 ? '🏆 ' : '') + esc(w.name) + '</a><small>' + (me ? '#' + me.rank + ' of ' + w.results.length + ' · ' + pct(me.pnlPct) : 'finished') + '</small></li>';
    }).join('') + '</ul>' : '<p class="pt-empty">Finished Trade Wars show up here with your rank.</p>');
    // Challenge history (§14): challenges you sent or received and what happened to them
    var ST = { pending: 'Waiting', accepted: 'Accepted', declined: 'Declined', cancelled: 'Cancelled', expired: 'Expired' };
    h += card('Challenges', extra.challenges == null ? (user ? '<p class="pt-empty">Loading…</p>' : '<p class="pt-empty">Sign in to see your challenges.</p>')
      : extra.challenges.length ? '<ul class="twh-list">' + extra.challenges.map(function (c) {
        var sent = user && c.from === user.uid, who = sent ? (c.toName || 'Trader') : (c.fromName || 'Trader'), go = c.status === 'accepted' || (sent && c.status === 'pending');
        var label = (sent ? 'You &rarr; <b>' + esc(who) + '</b>' : '<b>' + esc(who) + '</b> &rarr; you') + ' <small>' + money(c.buyIn, 0) + (c.lms ? ' · Last Man' : '') + '</small>';
        return '<li>' + (go ? '<a href="war.html?w=' + encodeURIComponent(c.warId) + '">' + label + '</a>' : '<span>' + label + '</span>') + '<small class="twh-ch-st is-' + esc(c.status) + '">' + (ST[c.status] || esc(c.status)) + '</small></li>';
      }).join('') + '</ul>' : '<p class="pt-empty">No challenges yet. Tap <b>+ Start a Trade War</b> to challenge a friend or your squad.</p>');
    el.innerHTML = '<div class="twh-grid">' + h + '</div>';
    el.querySelectorAll('[data-ch]').forEach(function (b) { b.onclick = function () { if (window.ZelosChallenge) ZelosChallenge.open({ to: b.getAttribute('data-ch'), toName: b.getAttribute('data-chn') }); }; });
  }
  var extra = {};
  function loadHub() {
    if (!onHome || !db) return renderHub(extra);
    db.collection('practiceProfiles').orderBy('growthPct', 'desc').limit(5).get().then(function (s) {
      var rows = []; s.forEach(function (x) { rows.push(Object.assign({ uid: x.id }, x.data())); });
      extra.board = rows.length ? '<ol class="twh-list twh-board">' + rows.map(function (r, i) {
        return '<li class="' + (user && r.uid === user.uid ? 'is-me' : '') + '"><a href="profile.html?u=' + encodeURIComponent(r.uid) + '">' + (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.') + ' ' + esc(r.name || 'Trader') + '</a><small class="' + ((r.growthPct || 0) >= 0 ? 'up' : 'dn') + '">' + pct(r.growthPct) + '</small></li>';
      }).join('') + '</ol>' : '<p class="pt-empty">No traders on the board yet.</p>';
      renderHub(extra);
    }).catch(function () { extra.board = '<p class="pt-empty">Leaderboard unavailable.</p>'; renderHub(extra); });
    if (!user) return renderHub(extra);
    var inv = function (field) { return db.collection('twInvites').where(field, '==', user.uid).limit(15).get().then(function (s) { var o = []; s.forEach(function (d) { o.push(Object.assign({ id: d.id }, d.data())); }); return o; }).catch(function () { return []; }); };
    Promise.all([inv('from'), inv('to')]).then(function (r) {
      extra.challenges = r[0].concat(r[1]).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }).slice(0, 8);
      renderHub(extra);
    });
    db.collection('users').doc(user.uid).get().then(function (u) {
      var f = ((u.exists && u.data().friends) || []).slice(0, 12);
      if (!f.length) { extra.friends = '<p class="pt-empty">No friends yet. Open a trader\'s profile and tap <b>+ Add friend</b>.</p>'; return renderHub(extra); }
      return Promise.all(f.map(function (id) { return db.collection('practiceProfiles').doc(id).get().then(function (x) { return { uid: id, p: x.exists ? x.data() : {} }; }).catch(function () { return { uid: id, p: {} }; }); })).then(function (list) {
        extra.friends = '<ul class="twh-list">' + list.map(function (r) {
          return '<li><a href="profile.html?u=' + encodeURIComponent(r.uid) + '">' + esc(r.p.name || 'Trader') + '</a><button type="button" class="twh-ch" data-ch="' + esc(r.uid) + '" data-chn="' + esc(r.p.name || 'Trader') + '">⚔️ Challenge</button></li>';
        }).join('') + '</ul>';
        renderHub(extra);
      });
    }).catch(function () {});
  }

  // ------------------------------------------------------------ data
  function loadWars() {
    if (!user) { wars = []; ranks = {}; renderTop(); return; }
    db.collection('tradeWars').where('players', 'array-contains', user.uid).limit(30).get().then(function (s) {
      wars = []; s.forEach(function (x) { wars.push(Object.assign({ id: x.id }, x.data())); });
      wars.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      renderTop(); if (onHome) renderHub(extra);
      wars.filter(function (w) { return w.status === 'active'; }).slice(0, 6).forEach(function (w) {
        db.collection('tradeWars').doc(w.id).collection('accounts').get().then(function (a) {
          var rows = []; a.forEach(function (x) { rows.push(Object.assign({ uid: x.id }, x.data())); });
          rows.sort(function (p, q) { return ((p.out ? 1 : 0) - (q.out ? 1 : 0)) || (q.pnlPct || 0) - (p.pnlPct || 0); });
          var i = rows.findIndex(function (r) { return r.uid === user.uid; });
          if (i >= 0) { ranks[w.id] = { rank: rows[i].out ? rows[i].place : i + 1, of: rows.length, pnlPct: rows[i].pnlPct, out: rows[i].out }; renderTop(); }
        }).catch(function () {});
      });
    }).catch(function () {});
  }
  function boot() {
    var cfg = window.ZELOS_FIREBASE_CONFIG;
    renderTop(); if (onHome) renderHub(extra);
    if (!window.firebase || !cfg || !cfg.projectId) return;
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    db = firebase.firestore();
    firebase.auth().onAuthStateChanged(function (u) {
      user = u && !u.isAnonymous ? u : null; invites = []; trader = {}; xp = 0;
      renderTop(); loadWars(); loadHub();
      if (!user) return;
      db.collection('traders').doc(user.uid).get().then(function (t) { trader = t.exists ? t.data() : {}; renderTop(); }).catch(function () {});
      db.collection('users').doc(user.uid).onSnapshot(function (u2) { xp = (u2.exists && u2.data().xp) || 0; renderTop(); }, function () {});
      db.collection('twInvites').where('to', '==', user.uid).where('status', '==', 'pending').onSnapshot(function (s) {
        invites = []; s.forEach(function (x) { invites.push(Object.assign({ id: x.id }, x.data())); }); renderTop();
      }, function () {});
      if (location.hash === '#start') setTimeout(start, 400);
    });
    d.addEventListener('zelos:profile', function (e) { trader = e.detail || trader; renderTop(); });
    d.addEventListener('zelos:progress', function () { if (onHome) renderHub(extra); });
    setInterval(renderTop, 30000); // keeps the Main account balance fresh
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})();
