/*!
 * Zelos — social layer for Trade War (the $10,000 virtual account).
 *
 * Trading Squads, friends, referrals and shareable
 * account cards. Everything reads the public practice profile each player
 * publishes (practiceProfiles/{uid}, written by practice/practice.js), so the
 * numbers here are the same ones on the leaderboard and never include email
 * or login details.
 *
 * Scoring uses "net P&L": account value minus $10,000, plus whatever each
 * reset wiped out. A reset refills the account but never counts as growth,
 * so it can't win a challenge or a weekly board.
 *
 * Firestore (rules in firestore.rules):
 *   challenges/{id}  { creator, creatorName, target|null, targetName, opponent|null, opponentName,
 *                      days, status: open|active|cancelled, createdAt, startAt, endAt,
 *                      base: { <uid>: { net, eq, xp } } }
 *   squads/{id}      { name, owner, members: [uid], names: {uid: name}, createdAt,
 *                      comp: { start, end, days, base: {uid: {net, eq}} } | null }
 *   referrals/{uid}  { referrer, createdAt }        one per invited player, written by them
 *   users/{uid}.friends  [uid]                       private follow list
 *
 * Exposes window.ZelosSocial (call init() once Firebase is initialized).
 */
(function (global) {
  'use strict';
  var SITE = 'https://agentictrading.info';
  var db = null, auth = null;
  var START = 10000;

  function init() {
    if (db) return true;
    var cfg = global.ZELOS_FIREBASE_CONFIG;
    if (!global.firebase || !cfg || !cfg.projectId) return false;
    try { if (!firebase.apps.length) firebase.initializeApp(cfg); db = firebase.firestore(); auth = firebase.auth(); } catch (e) { return false; }
    return true;
  }
  function me() { return auth && auth.currentUser && !auth.currentUser.isAnonymous ? auth.currentUser : null; }
  function now() { return Date.now(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function newId() { var a = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = ''; var r = (global.crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint8Array(12)) : null; for (var i = 0; i < 12; i++) s += a[(r ? r[i] : Math.floor(Math.random() * 256)) % a.length]; return s; }

  // ------------------------------------------------------------ links
  function links(uid) {
    return {
      profile: function (u) { return SITE + '/practice/profile.html?u=' + encodeURIComponent(u || uid); },
      invite: function () { return SITE + '/practice/?ref=' + encodeURIComponent(uid); },
      war: function (id) { return SITE + '/practice/war.html?w=' + encodeURIComponent(id); },
      squad: function (id) { return SITE + '/practice/squads.html?s=' + encodeURIComponent(id) + (uid ? '&ref=' + encodeURIComponent(uid) : ''); }
    };
  }

  // ------------------------------------------------------------ profiles
  function profile(uid) { return db.collection('practiceProfiles').doc(uid).get().then(function (d) { return d.exists ? Object.assign({ uid: uid }, d.data()) : null; }); }
  function profiles(uids) {
    uids = uids.filter(function (u, i) { return u && uids.indexOf(u) === i; });
    var chunks = []; for (var i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30));
    return Promise.all(chunks.map(function (c) {
      return db.collection('practiceProfiles').where(firebase.firestore.FieldPath.documentId(), 'in', c).get().then(function (snap) {
        var out = []; snap.forEach(function (d) { out.push(Object.assign({ uid: d.id }, d.data())); }); return out;
      });
    })).then(function (lists) { var m = {}; lists.forEach(function (l) { l.forEach(function (p) { m[p.uid] = p; }); }); return m; });
  }
  function net(p) { return p ? (p.netPnl != null ? p.netPnl : (p.equity || START) - START) : 0; }
  // the profile's end-of-day net P&L on (or before) a day — used to freeze a result at a challenge's end
  function netOn(p, day) {
    var h = (p && p.h) || {}, key = 'd' + day.replace(/-/g, ''), best = null;
    Object.keys(h).forEach(function (k) { if (k <= key && (!best || k > best)) best = k; });
    return best ? h[best] : null;
  }
  function dayOf(ms) { try { return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); } catch (e) { return new Date(ms).toISOString().slice(0, 10); } }
  // growth since a baseline { net, eq }; frozen at `endMs` once that's passed
  function scoreSince(p, base, endMs) {
    if (!p || !base) return null;
    var n = net(p), xp = p.xp || 0, finished = endMs && now() > endMs;
    if (finished) { var h = netOn(p, dayOf(endMs)); if (h) { n = h.n; xp = h.x != null ? h.x : xp; } }
    var pnl = n - (base.net || 0), eq0 = base.eq || START;
    return { pnl: pnl, pct: pnl / eq0 * 100, xp: xp - (base.xp || 0), equity: finished ? eq0 + pnl : p.equity };
  }
  function baseFor(p, xp) { return { net: Math.round(net(p) * 100) / 100, eq: (p && p.equity) || START, xp: xp != null ? xp : (p && p.xp) || 0 }; }

  // ------------------------------------------------------------ friends
  function friends() {
    var u = me(); if (!u) return Promise.resolve([]);
    return db.collection('users').doc(u.uid).get().then(function (d) { return (d.exists && d.data().friends) || []; }).catch(function () { return []; });
  }
  function addFriend(uid) {
    var u = me(); if (!u || uid === u.uid) return Promise.resolve();
    return db.collection('users').doc(u.uid).set({ friends: firebase.firestore.FieldValue.arrayUnion(uid) }, { merge: true });
  }
  function removeFriend(uid) {
    var u = me(); if (!u) return Promise.resolve();
    return db.collection('users').doc(u.uid).set({ friends: firebase.firestore.FieldValue.arrayRemove(uid) }, { merge: true });
  }

  // ------------------------------------------------------------ squads
  function createSquad(name) {
    var u = me(); if (!u) return Promise.reject(new Error('Sign in with Google first.'));
    name = String(name || '').replace(/[<>]/g, '').trim().slice(0, 32);
    if (!name) return Promise.reject(new Error('Give your squad a name.'));
    return profile(u.uid).then(function (p) {
      var id = newId(), names = {}; names[u.uid] = (p && p.name) || 'Trader';
      return db.collection('squads').doc(id).set({ name: name, owner: u.uid, members: [u.uid], names: names, createdAt: now(), comp: null }).then(function () {
        if (global.ZelosProgress) ZelosProgress.bump('squads');
        return id;
      });
    });
  }
  function getSquad(id) { return db.collection('squads').doc(id).get().then(function (d) { return d.exists ? Object.assign({ id: d.id }, d.data()) : null; }); }
  function watchSquad(id, cb, err) { return db.collection('squads').doc(id).onSnapshot(function (d) { cb(d.exists ? Object.assign({ id: d.id }, d.data()) : null); }, err || function () { cb(null); }); }
  function joinSquad(sq) {
    var u = me(); if (!u) return Promise.reject(new Error('Sign in with Google first.'));
    if (sq.members.indexOf(u.uid) !== -1) return Promise.resolve();
    if (sq.members.length >= 50) return Promise.reject(new Error('This squad is full (50 members).'));
    return profile(u.uid).then(function (p) {
      var names = Object.assign({}, sq.names || {}); names[u.uid] = (p && p.name) || 'Trader';
      return db.collection('squads').doc(sq.id).update({ members: sq.members.concat([u.uid]), names: names }).then(function () {
        if (global.ZelosProgress) ZelosProgress.bump('squads');
      });
    });
  }
  function leaveSquad(sq) {
    var u = me(); if (!u) return Promise.resolve();
    var names = Object.assign({}, sq.names || {}); delete names[u.uid];
    return db.collection('squads').doc(sq.id).update({ members: sq.members.filter(function (m) { return m !== u.uid; }), names: names });
  }
  function mySquads(uid) {
    return db.collection('squads').where('members', 'array-contains', uid).limit(20).get().then(function (s) { var o = []; s.forEach(function (d) { o.push(Object.assign({ id: d.id }, d.data())); }); return o; }).catch(function () { return []; });
  }
  function startSquadComp(sq, days) {
    return profiles(sq.members).then(function (m) {
      var base = {}; sq.members.forEach(function (u) { if (m[u]) base[u] = baseFor(m[u]); });
      var start = now();
      return db.collection('squads').doc(sq.id).update({ comp: { start: start, end: start + days * 864e5, days: days, base: base } });
    });
  }
  function endSquadComp(sq) { return db.collection('squads').doc(sq.id).update({ comp: null }); }

  // ------------------------------------------------------------ referrals
  // The invited player's own browser records the referral the first time
  // they open a practice account signed in (rules allow exactly one, ever).
  function claimReferral(user) {
    var r = global.ZelosProgress && ZelosProgress.ref();
    if (!user || user.isAnonymous || !r || r === user.uid) return Promise.resolve(false);
    var ref = db.collection('referrals').doc(user.uid);
    return ref.get().then(function (d) {
      if (d.exists) return false;
      return ref.set({ referrer: r, createdAt: now() }).then(function () {
        if (global.ZelosXP) ZelosXP.award('referral-welcome', 'welcome');
        addFriend(r);
        return true;
      });
    }).catch(function () { return false; });
  }
  // the referrer's browser counts successes and pays XP per friend (deduped by friend uid)
  function myReferrals(uid) {
    return db.collection('referrals').where('referrer', '==', uid).limit(200).get().then(function (s) {
      var ids = []; s.forEach(function (d) { ids.push(d.id); });
      ids.forEach(function (f) { if (global.ZelosXP) ZelosXP.award('referral', f); });
      return ids;
    }).catch(function () { return []; });
  }
  var TIERS = [[25, 'Diamond', '💎'], [10, 'Gold', '🥇'], [3, 'Silver', '🥈'], [1, 'Bronze', '🥉']];
  function referralTier(n) { for (var i = 0; i < TIERS.length; i++) if (n >= TIERS[i][0]) return { name: TIERS[i][1], icon: TIERS[i][2], at: TIERS[i][0] }; return null; }
  function nextTier(n) { var t = [1, 3, 10, 25].filter(function (x) { return x > n; })[0]; return t || null; }

  // ------------------------------------------------------------ share
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (res) { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} t.remove(); res(); });
  }
  // +10 XP "Shared Trade War", once a day
  function shareXp(r) { if (r !== 'cancelled' && global.ZelosXP) ZelosXP.award('share', dayOf(now())); return r; }
  function shareLink(title, text, url) {
    if (navigator.share) return navigator.share({ title: title, text: text, url: url }).then(function () { return 'shared'; }).catch(function () { return copy(url).then(function () { return 'copied'; }); }).then(shareXp);
    return copy(text + ' ' + url).then(function () { return 'copied'; }).then(shareXp);
  }
  // A 1200x630 account card (drawn on canvas, so it works offline and needs no server)
  function card(d) {
    var W = 1200, H = 630, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var c = cv.getContext('2d'), up = d.equity >= START, col = up ? '#3ecb7c' : '#e0483f';
    var g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0b0e15'); g.addColorStop(1, '#141b2b'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    // faint rising candles
    c.globalAlpha = 0.09; for (var i = 0; i < 26; i++) { var x = 40 + i * 44, h = 60 + (i * 37 % 140), y = 470 - i * 9 - h / 2; c.fillStyle = i % 4 === 3 ? '#e0483f' : '#3ecb7c'; c.fillRect(x, y, 20, h); c.fillRect(x + 9, y - 22, 2, h + 44); } c.globalAlpha = 1;
    var glow = c.createRadialGradient(W - 200, 120, 10, W - 200, 120, 420); glow.addColorStop(0, up ? 'rgba(62,203,124,0.25)' : 'rgba(224,72,63,0.22)'); glow.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = glow; c.fillRect(0, 0, W, H);
    c.fillStyle = '#4c8dff'; c.font = '700 26px "IBM Plex Mono", ui-monospace, monospace'; c.fillText('AGENTICTRADING.INFO · TRADE WAR', 64, 82);
    c.fillStyle = '#f4f6fb'; c.font = '800 54px system-ui, -apple-system, "Segoe UI", sans-serif'; c.fillText(String(d.name || 'Trader').slice(0, 24), 64, 158);
    c.fillStyle = '#9aa3b2'; c.font = '500 30px system-ui, sans-serif'; c.fillText(d.headline || ('I grew my $10,000 Trade War account to'), 64, 236);
    c.fillStyle = col; c.font = '800 118px "IBM Plex Mono", ui-monospace, monospace'; c.fillText('$' + Math.round(d.equity).toLocaleString('en-US'), 60, 352);
    var pct = (d.equity / START - 1) * 100;
    c.font = '700 40px "IBM Plex Mono", ui-monospace, monospace'; c.fillText((pct >= 0 ? '+' : '') + pct.toFixed(1) + '%', 64, 414);
    var stats = [['LEVEL', d.level || '–'], ['XP', d.xp != null ? Math.round(d.xp).toLocaleString('en-US') : '–'], ['WIN RATE', d.winRate != null ? d.winRate + '%' : '–'], ['BEST TRADE', d.best || '–']];
    stats.forEach(function (s, k) {
      var x = 64 + k * 270; c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x, 452, 250, 86); c.strokeStyle = 'rgba(255,255,255,0.1)'; c.strokeRect(x + 0.5, 452.5, 249, 85);
      c.fillStyle = '#8a93a3'; c.font = '600 18px "IBM Plex Mono", monospace'; c.fillText(s[0], x + 16, 482);
      c.fillStyle = '#f4f6fb'; c.font = '700 28px "IBM Plex Mono", monospace'; c.fillText(String(s[1]).slice(0, 14), x + 16, 522);
    });
    c.fillStyle = '#f4f6fb'; c.font = '800 34px system-ui, sans-serif'; c.fillText(d.cta || 'Can you beat me?', 64, 592);
    c.fillStyle = '#8a93a3'; c.font = '500 20px system-ui, sans-serif'; c.textAlign = 'right'; c.fillText('TRADE WAR · VIRTUAL MONEY', W - 64, 592); c.textAlign = 'left';
    return cv;
  }
  function shareCard(d, url) { return shareCardRaw(d, url).then(shareXp); }
  function shareCardRaw(d, url) {
    var cv = card(d), text = (d.headline || 'I grew my $10,000 Trade War account to') + ' $' + Math.round(d.equity).toLocaleString('en-US') + '. ' + (d.cta || 'Can you beat me?');
    return new Promise(function (resolve) {
      cv.toBlob(function (blob) {
        var file = blob && global.File ? new File([blob], 'zelos-trade-war.png', { type: 'image/png' }) : null;
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: 'My Trade War account', text: text + ' ' + url }).then(function () { resolve('shared'); }).catch(function () { resolve('cancelled'); });
          return;
        }
        // desktop: download the image and copy the link to paste next to it
        var a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = 'zelos-trade-war.png'; document.body.appendChild(a); a.click(); a.remove();
        copy(text + ' ' + url).then(function () { resolve('downloaded'); });
      }, 'image/png');
    });
  }

  global.ZelosSocial = {
    init: init, me: me, links: links, esc: esc, START: START,
    profile: profile, profiles: profiles, net: net, netOn: netOn, scoreSince: scoreSince, baseFor: baseFor,
    friends: friends, addFriend: addFriend, removeFriend: removeFriend,
    createSquad: createSquad, getSquad: getSquad, watchSquad: watchSquad, joinSquad: joinSquad, leaveSquad: leaveSquad, mySquads: mySquads,
    startSquadComp: startSquadComp, endSquadComp: endSquadComp,
    claimReferral: claimReferral, myReferrals: myReferrals, referralTier: referralTier, nextTier: nextTier,
    copy: copy, shareLink: shareLink, card: card, shareCard: shareCard
  };
})(window);
