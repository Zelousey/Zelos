/*!
 * Zelos Trade War home: one place for everything Trade War.
 *
 *   #twTop  (Trade War page + every match room)
 *           your trader card (picture, @username, level + XP bar), the account
 *           switcher (Main account + the Trade Wars you're in), "Start a Trade
 *           War", and any challenges waiting for you (Accept / Decline).
 *           A "battle banner" under it for every live Trade War you're in.
 *   #twTiles (Trade War page) one row of small tiles: today's missions,
 *           achievements, leaderboard, friends, your Trade Wars + challenges,
 *           and market movers. Each opens a bigger panel over the page.
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
  // name in the trader's purchased color (zelos-tokens.js paints [data-zname])
  function zn(uid) { return uid ? ' data-zname="' + esc(uid) + '"' : ''; }
  function money(v, dd) { dd = dd == null ? 2 : dd; v = +v || 0; return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dd, maximumFractionDigits: dd }); }
  function pct(v) { v = +v || 0; return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; }
  // Signed in: the online account (users/{uid}.practice) is the only source, so every
  // device shows the same number; until it loads the tile says "…", never a made-up $10,000.
  var onlineBal = null, authReady = false;
  function mainBalance() {
    if (!authReady || user) return onlineBal;
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
    var T = window.ZelosTokens, tw = T && T.wallet();
    if (T && !renderTop.hooked) { renderTop.hooked = true; T.onChange(function () { renderTop(); }); }
    var chips = '<a class="twh-acct' + (!here ? ' is-on' : '') + '" href="index.html"><small>Main account</small><b>' + (bal != null ? money(bal) : !authReady || user ? '…' : '$10,000') + '</b></a>' +
      (user && T ? '<a class="twh-acct twh-tokens" href="../tokens.html" title="Your tokens: unlock live scanner alerts"><small>Tokens</small><b><i class="twh-coin" aria-hidden="true"></i>' + (tw ? tw.balance : '…') + '</b></a>' : '') +
      wars.filter(function (w) { return w.status === 'active' || w.status === 'lobby' || w.status === 'draft'; }).map(function (w) {
        var r = ranks[w.id], sub = w.status === 'lobby' ? 'Lobby · ' + w.players.length + '/' + w.maxPlayers : w.status === 'draft' ? 'Drafting' : r ? (r.out ? 'OUT · #' : '#') + r.rank + ' of ' + r.of + ' · ' + pct(r.pnlPct) : 'Live';
        return '<a class="twh-acct' + (here === w.id ? ' is-on' : '') + (w.status === 'active' ? ' is-live' : '') + '" href="war.html?w=' + encodeURIComponent(w.id) + '"><small>' + (w.lms ? '&#9760; ' : '⚔️ ') + esc(w.name) + '</small><b>' + sub + '</b></a>';
      }).join('');
    el.innerHTML = '<div class="twh-top">' +
      '<a class="twh-me" href="profile.html">' + av + '<span><b' + zn(user && user.uid) + '>' + esc(nm) + '</b>' + (lv ? '<small>Level ' + lv.level + ' · ' + esc(lv.name) + ' · ' + xp.toLocaleString('en-US') + ' XP</small><i class="twh-xp"><i style="width:' + prog + '%"></i></i>' : '') + '</span></a>' +
      '<nav class="twh-accts" aria-label="Your Trade War accounts">' + chips + '</nav>' +
      '<button type="button" class="twh-start" id="twhStart">+ Start a Trade War</button></div>' + battleBanner() +
      (invites.length ? '<div class="twh-inv">' + invites.map(function (i) {
        return '<div class="twh-inv-row"><span>' + (i.lms ? '&#9760;' : '⚔️') + ' <b' + zn(i.from) + '>' + esc(i.fromName || 'A trader') + '</b> challenged you' + (i.lms ? ' to Last Man Standing' : '') + (i.warName ? ': <b class="twh-inv-name">' + esc(i.warName) + '</b>' : '') + ' · ' + money(i.buyIn, 0) + ' buy-in · ' + i.days + 'd' +
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
  // "you're in battle": every live (or drafting) Trade War you're in, except the room you're looking at
  function battleBanner() {
    var on = wars.filter(function (w) { return (w.status === 'active' || w.status === 'draft') && w.id !== here; }).slice(0, 3);
    return on.map(function (w) {
      var r = ranks[w.id], draft = w.status === 'draft';
      return '<a class="twh-battle' + (w.lms ? ' is-lms' : '') + (r && r.out ? ' is-out' : '') + '" href="war.html?w=' + encodeURIComponent(w.id) + '">' +
        '<span class="twh-battle-k"><i></i>' + (draft ? 'Draft is on' : r && r.out ? 'Knocked out' : 'In battle') + '</span>' +
        '<b>' + (w.lms ? '&#9760; ' : '⚔️ ') + esc(w.name) + '</b>' +
        '<span class="twh-battle-st">' + (draft ? 'Pick your stocks now' : (r ? (r.out ? 'Finished #' : '#') + r.rank + ' of ' + r.of + ' · <em class="' + ((r.pnlPct || 0) >= 0 ? 'up' : 'dn') + '">' + pct(r.pnlPct) + '</em> · ' : '') + left(w.endAt - Date.now()) + ' left') + '</span>' +
        '<span class="twh-battle-go">' + (draft ? 'Draft' : 'Go to battle') + ' &rarr;</span></a>';
    }).join('');
  }
  function start() {
    if (!user) { alert('Sign in to start a Trade War.'); return; }
    if (window.ZelosChallenge) ZelosChallenge.open({});
  }

  // ------------------------------------------------------------ hub: small tiles that open into a bigger panel
  // (#twTiles, one row under the trader strip; the panel is a sheet over the page, so nothing scrolls inside boxes)
  function left(ms) { ms = Math.max(0, ms || 0); var dd = Math.floor(ms / 86400000), h = Math.floor(ms % 86400000 / 3600000), mi = Math.floor(ms % 3600000 / 60000); return dd ? dd + 'd ' + h + 'h' : h ? h + 'h ' + mi + 'm' : mi + 'm'; }
  var sheetOpen = null;
  function tile(id, label, big, sub) {
    return '<button type="button" class="twh-tile" data-sheet="' + id + '"><small>' + label + '</small><b>' + big + '</b><span>' + sub + '</span></button>';
  }
  function sheets(extra) {
    var P = window.ZelosProgress, out = {};
    if (P) {
      var ms = P.missions(), row = function (m) { return '<li class="' + (m.done ? 'is-done' : '') + '"><span>' + (m.done ? '✅ ' : '') + esc(m.label) + '</span><small>' + m.count + '/' + m.goal + ' · +' + m.xp + ' XP</small></li>'; };
      var doneN = ms.daily.filter(function (m) { return m.done; }).length;
      out.missions = { tile: tile('missions', 'Today\'s missions', doneN + '/' + ms.daily.length, '🔥 ' + ms.streak.days + '-day streak'), title: 'Today\'s missions',
        body: '<ul class="twh-list">' + ms.daily.map(row).join('') + '</ul><p class="pt-fine">🔥 ' + ms.streak.days + '-day streak · finish ' + ms.streak.need + ' a day to keep it.</p>' +
          '<h3 class="twh-sh">This week</h3><ul class="twh-list">' + ms.weekly.map(row).join('') + '</ul>',
        link: '<a href="index.html?tab=progress#ptTabBody">XP &amp; missions &rarr;</a>' };
      var un = P.unlocked(), ids = Object.keys(un).sort(function (a, b) { return un[b] - un[a]; }), groups = {};
      P.ACHIEVEMENTS.forEach(function (a) { (groups[a.group] = groups[a.group] || []).push(a); });
      out.achievements = { tile: tile('achievements', 'Achievements', ids.length + '<small>/' + P.ACHIEVEMENTS.length + '</small>', ids.length ? '<i class="twh-mini-badges">' + ids.slice(0, 4).map(function (id) { return P.badge(id, 18); }).join('') + '</i>' : 'None yet'),
        title: 'Achievements · ' + ids.length + ' of ' + P.ACHIEVEMENTS.length,
        body: Object.keys(groups).map(function (g) {
          return '<h3 class="twh-sh">' + esc(g) + '</h3><div class="twh-achs">' + groups[g].map(function (a) {
            return '<div class="twh-ach' + (un[a.id] ? ' is-on' : '') + '">' + P.badge(a.id, 34, !un[a.id]) + '<span><b>' + esc(a.label) + '</b><small>' + esc(a.desc) + '</small></span><em>+' + a.xp + '</em></div>';
          }).join('') + '</div>';
        }).join(''), link: '<a href="profile.html">Profile &rarr;</a>' };
    }
    var top = extra.rows || [], meI = user ? top.findIndex(function (r) { return r.uid === user.uid; }) : -1;
    out.leaderboard = { tile: tile('leaderboard', 'Leaderboard', meI >= 0 ? '#' + (meI + 1) : top.length ? esc((top[0].name || 'Trader').slice(0, 12)) : '–', meI >= 0 ? 'Your rank · ' + pct(top[meI].growthPct) : top.length ? 'Leading · ' + pct(top[0].growthPct) : 'Top traders'),
      title: 'Leaderboard · top traders', body: extra.board || '<p class="pt-empty">Loading…</p>', link: '<a href="../leaderboard.html#practice">All leaderboards &rarr;</a>' };
    out.friends = { tile: tile('friends', 'Friends', user ? String(extra.friendCount == null ? '…' : extra.friendCount) : '–', user ? 'Challenge one' : 'Sign in'),
      title: 'Friends', body: extra.friends || (user ? '<p class="pt-empty">Loading…</p>' : '<p class="pt-empty">Sign in to see your friends.</p>'), link: '<a href="squads.html">Squads &rarr;</a>' };
    var live = wars.filter(function (w) { return w.status === 'active' || w.status === 'lobby' || w.status === 'draft'; });
    var done = wars.filter(function (w) { return w.status === 'ended'; }).slice(0, 8);
    var ST = { pending: 'Waiting', accepted: 'Accepted', declined: 'Declined', cancelled: 'Cancelled', expired: 'Expired' };
    var waiting = (extra.challenges || []).filter(function (c) { return c.status === 'pending'; }).length;
    out.battles = { tile: tile('battles', 'Trade Wars', live.length ? live.length + ' <small>live</small>' : String(done.length), live.length ? 'In battle now' : waiting ? waiting + ' challenge' + (waiting === 1 ? '' : 's') + ' waiting' : done.length ? 'finished' : 'Start one'),
      title: 'Your Trade Wars',
      body: (live.length ? '<h3 class="twh-sh">Live &amp; starting</h3><ul class="twh-list">' + live.map(function (w) {
          var r = ranks[w.id];
          return '<li><a href="war.html?w=' + encodeURIComponent(w.id) + '">' + (w.lms ? '&#9760; ' : '⚔️ ') + esc(w.name) + '</a><small>' + (w.status === 'active' ? (r ? '#' + r.rank + ' of ' + r.of + ' · ' + pct(r.pnlPct) + ' · ' : '') + left(w.endAt - Date.now()) + ' left' : w.status === 'draft' ? 'Drafting' : 'Lobby') + '</small></li>';
        }).join('') + '</ul>' : '') +
        '<h3 class="twh-sh">Finished</h3>' + (done.length ? '<ul class="twh-list">' + done.map(function (w) {
          var me = (w.results || []).filter(function (r) { return user && r.uid === user.uid; })[0];
          return '<li><a href="war.html?w=' + encodeURIComponent(w.id) + '">' + (me && me.rank === 1 ? '🏆 ' : '') + esc(w.name) + '</a><small>' + (me ? '#' + me.rank + ' of ' + w.results.length + ' · ' + pct(me.pnlPct) : 'finished') + '</small></li>';
        }).join('') + '</ul>' : '<p class="pt-empty">Finished Trade Wars show up here with your rank.</p>') +
        '<h3 class="twh-sh">Challenges</h3>' + (extra.challenges == null ? (user ? '<p class="pt-empty">Loading…</p>' : '<p class="pt-empty">Sign in to see your challenges.</p>')
          : extra.challenges.length ? '<ul class="twh-list">' + extra.challenges.map(function (c) {
            var sent = user && c.from === user.uid, who = sent ? (c.toName || 'Trader') : (c.fromName || 'Trader'), go = c.status === 'accepted' || (sent && c.status === 'pending');
            var label = (sent ? 'You &rarr; <b' + zn(c.to) + '>' + esc(who) + '</b>' : '<b' + zn(c.from) + '>' + esc(who) + '</b> &rarr; you') + ' <small>' + (c.warName ? esc(c.warName) + ' · ' : '') + money(c.buyIn, 0) + (c.lms ? ' · Last Man' : '') + '</small>';
            return '<li>' + (go ? '<a href="war.html?w=' + encodeURIComponent(c.warId) + '">' + label + '</a>' : '<span>' + label + '</span>') + '<small class="twh-ch-st is-' + esc(c.status) + '">' + (ST[c.status] || esc(c.status)) + '</small></li>';
          }).join('') + '</ul>' : '<p class="pt-empty">No challenges yet. Tap <b>+ Start a Trade War</b> to challenge a friend or your squad.</p>'),
      link: '<button type="button" class="twh-ch" data-start="1">+ Start a Trade War</button>' };
    var mv = extra.movers, g0 = mv && mv.gainers && mv.gainers[0];
    out.market = { tile: tile('market', 'Market movers', g0 ? esc(g0.sym) + ' <small class="up">' + pct(g0.chPct) + '</small>' : '–', g0 ? 'Top gainer · sectors' : 'Gainers, losers, sectors'),
      title: 'Market movers' + (mv && mv.updatedAt ? ' <small>' + esc(new Date(mv.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })) + ' ET</small>' : ''),
      body: mv ? '<div class="twh-mv">' + [['Top gainers', mv.gainers], ['Top losers', mv.losers], ['Most active', mv.actives]].map(function (c) {
          return '<div><h3 class="twh-sh">' + c[0] + '</h3>' + ((c[1] || []).length ? '<ul class="twh-list">' + c[1].map(function (r) {
            return '<li><span><b>' + esc(r.sym) + '</b> <small>' + esc(r.name || '') + '</small></span><small class="' + ((r.chPct || 0) >= 0 ? 'up' : 'dn') + '">$' + (+r.price).toLocaleString('en-US', { minimumFractionDigits: r.price < 2 ? 4 : 2, maximumFractionDigits: r.price < 2 ? 4 : 2 }) + ' · ' + pct(r.chPct) + '</small></li>';
          }).join('') + '</ul>' : '<p class="pt-empty">Not available right now.</p>') + '</div>';
        }).join('') + '</div>' + ((mv.sectors || []).length ? '<h3 class="twh-sh">Sectors today</h3><div class="twh-sectors">' + mv.sectors.map(function (x) {
          var w = Math.min(100, Math.abs(x.chPct) * 40);
          return '<div><span>' + esc(x.sector) + '</span><i class="' + (x.chPct >= 0 ? 'up' : 'dn') + '"><i style="width:' + w.toFixed(0) + '%"></i></i><small class="' + (x.chPct >= 0 ? 'up' : 'dn') + '">' + pct(x.chPct) + '</small></div>';
        }).join('') + '</div>' : '') + '<p class="pt-fine">Among the Trade War stock list. Prices: Marketstack. Refreshes every 15 minutes in market hours.</p>'
        : '<p class="pt-empty">Market movers load during market hours.</p>', link: '' };
    return out;
  }
  var ORDER = ['missions', 'achievements', 'leaderboard', 'friends', 'battles', 'market'];
  function renderHub(extra) {
    var el = $('twTiles'); if (!el) return;
    var S = sheets(extra);
    el.innerHTML = ORDER.filter(function (k) { return S[k]; }).map(function (k) { return S[k].tile; }).join('');
    if (sheetOpen && S[sheetOpen]) fillSheet(S[sheetOpen]);
  }
  function fillSheet(x) {
    var sh = $('twhSheet'); if (!sh) return;
    sh.querySelector('.twh-sheet-title').innerHTML = x.title;
    sh.querySelector('.twh-sheet-body').innerHTML = x.body;
    sh.querySelector('.twh-sheet-foot').innerHTML = x.link || '';
    sh.querySelectorAll('[data-ch]').forEach(function (b) { b.onclick = function () { closeSheet(); if (window.ZelosChallenge) ZelosChallenge.open({ to: b.getAttribute('data-ch'), toName: b.getAttribute('data-chn') }); }; });
    sh.querySelectorAll('[data-start]').forEach(function (b) { b.onclick = function () { closeSheet(); start(); }; });
  }
  function openSheet(id) {
    var S = sheets(extra); if (!S[id]) return;
    var sh = $('twhSheet');
    if (!sh) {
      sh = d.createElement('div'); sh.id = 'twhSheet'; sh.className = 'twh-sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
      sh.innerHTML = '<div class="twh-sheet-card"><div class="twh-sheet-head"><h2 class="twh-sheet-title"></h2><button type="button" class="twh-sheet-x" aria-label="Close">&times;</button></div><div class="twh-sheet-body"></div><div class="twh-sheet-foot"></div></div>';
      d.body.appendChild(sh);
      sh.addEventListener('click', function (e) { if (e.target === sh || e.target.closest('.twh-sheet-x')) closeSheet(); });
      d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheetOpen) closeSheet(); });
    }
    sheetOpen = id; fillSheet(S[id]); sh.hidden = false; d.documentElement.classList.add('twh-locked');
    var x = sh.querySelector('.twh-sheet-x'); if (x) x.focus();
  }
  function closeSheet() { var sh = $('twhSheet'); if (sh) sh.hidden = true; sheetOpen = null; d.documentElement.classList.remove('twh-locked'); }
  var extra = {};
  function loadHub() {
    if (!onHome || !db) return renderHub(extra);
    if (!loadHub.movers) {
      loadHub.movers = true;
      db.collection('markets').doc('movers').onSnapshot(function (m) { extra.movers = m.exists ? m.data() : null; renderHub(extra); }, function () {});
    }
    db.collection('practiceProfiles').orderBy('growthPct', 'desc').limit(10).get().then(function (s) {
      var rows = []; s.forEach(function (x) { rows.push(Object.assign({ uid: x.id }, x.data())); });
      extra.rows = rows;
      extra.board = rows.length ? '<ol class="twh-list twh-board">' + rows.map(function (r, i) {
        return '<li class="' + (user && r.uid === user.uid ? 'is-me' : '') + '"><a href="profile.html?u=' + encodeURIComponent(r.uid) + '">' + (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.') + ' <span' + zn(r.uid) + '>' + esc(r.name || 'Trader') + '</span></a><small class="' + ((r.growthPct || 0) >= 0 ? 'up' : 'dn') + '">' + pct(r.growthPct) + '</small></li>';
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
      var all = (u.exists && u.data().friends) || [], f = all.slice(0, 12);
      extra.friendCount = all.length;
      if (!f.length) { extra.friends = '<p class="pt-empty">No friends yet. Open a trader\'s profile and tap <b>+ Add friend</b>.</p>'; return renderHub(extra); }
      return Promise.all(f.map(function (id) { return db.collection('practiceProfiles').doc(id).get().then(function (x) { return { uid: id, p: x.exists ? x.data() : {} }; }).catch(function () { return { uid: id, p: {} }; }); })).then(function (list) {
        extra.friends = '<ul class="twh-list">' + list.map(function (r) {
          return '<li><a href="profile.html?u=' + encodeURIComponent(r.uid) + '"' + zn(r.uid) + '>' + esc(r.p.name || 'Trader') + '</a><button type="button" class="twh-ch" data-ch="' + esc(r.uid) + '" data-chn="' + esc(r.p.name || 'Trader') + '">⚔️ Challenge</button></li>';
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
    if (!window.firebase || !cfg || !cfg.projectId) { authReady = true; return; }
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    db = firebase.firestore();
    firebase.auth().onAuthStateChanged(function (u) {
      user = u && !u.isAnonymous ? u : null; invites = []; trader = {}; xp = 0; onlineBal = null; authReady = true;
      renderTop(); loadWars(); loadHub();
      if (!user) return;
      db.collection('traders').doc(user.uid).get().then(function (t) { trader = t.exists ? t.data() : {}; renderTop(); }).catch(function () {});
      db.collection('users').doc(user.uid).onSnapshot(function (u2) {
        var dd = u2.exists ? u2.data() : {}; xp = dd.xp || 0;
        var sm = dd.practice && dd.practice.summary;
        onlineBal = sm && sm.equity != null ? sm.equity : dd.practice ? null : 10000; // no online account yet = the fresh $10,000
        renderTop();
      }, function () {});
      db.collection('twInvites').where('to', '==', user.uid).where('status', '==', 'pending').onSnapshot(function (s) {
        invites = []; s.forEach(function (x) { invites.push(Object.assign({ id: x.id }, x.data())); }); renderTop();
      }, function () {});
      if (location.hash === '#start') setTimeout(start, 400);
    });
    d.addEventListener('zelos:profile', function (e) { trader = e.detail || trader; renderTop(); });
    d.addEventListener('zelos:progress', function () { if (onHome) renderHub(extra); });
    var tl = $('twTiles');
    if (tl) tl.addEventListener('click', function (e) { var b = e.target.closest('[data-sheet]'); if (b) openSheet(b.getAttribute('data-sheet')); });
    setInterval(renderTop, 30000); // keeps the Main account balance fresh
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})();
