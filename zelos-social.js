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
 *   squads/{id}      { name, owner, members: [uid], names: {uid: name}, createdAt,
 *                      comp: { start, end, days, base: {uid: {net, eq}} } | null,
 *                      goal: { text, target %, days, start, end, base } | null, code: 'K7QX2M' | null,
 *                      config: { reactions, photos, viewTrades, symbols: [SYM] | null }, helpMode }
 *   squads/{id}/messages/{id}  { author, name, text, photo?, createdAt, r: {uid: reaction} }
 *   squadCodes/{CODE} { squad }                     private room code -> squad id
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
  // The name squad-mates see: your Trade War name, else your @username, else your first name.
  function myName(u) {
    return profile(u.uid).then(function (p) {
      if (p && p.name) return p.name;
      return db.collection('traders').doc(u.uid).get().then(function (d) { var t = d.exists ? d.data() : {}; return t.username ? '@' + t.username : t.name; }).catch(function () { return null; });
    }).then(function (n) { return String(n || (u.displayName || '').split(' ')[0] || 'Trader').slice(0, 24); });
  }
  function createSquad(name) {
    var u = me(); if (!u) return Promise.reject(new Error('Sign in with Google first.'));
    name = String(name || '').replace(/[<>]/g, '').trim().slice(0, 32);
    if (!name) return Promise.reject(new Error('Give your squad a name.'));
    return myName(u).then(function (nm) {
      var id = newId(), names = {}; names[u.uid] = nm;
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
    return myName(u).then(function (nm) {
      var names = Object.assign({}, sq.names || {}); names[u.uid] = nm;
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

  // Owner controls (firestore.rules checks every one of these server-side)
  function squadRef(sq) { return db.collection('squads').doc(sq.id); }
  function renameSquad(sq, name) {
    name = String(name || '').replace(/[<>]/g, '').trim().slice(0, 32);
    return name ? squadRef(sq).update({ name: name }) : Promise.reject(new Error('Give your squad a name.'));
  }
  function removeMember(sq, uid) {
    var names = Object.assign({}, sq.names || {}); delete names[uid];
    return squadRef(sq).update({ members: sq.members.filter(function (m) { return m !== uid; }), names: names });
  }
  // Chat first (the owner may delete any message; it can't be read once the squad is gone), then the code, then the squad.
  function deleteSquad(sq) {
    var msgs = squadRef(sq).collection('messages');
    function sweep() {
      return msgs.limit(200).get().then(function (snap) {
        if (snap.empty) return;
        var b = db.batch(); snap.forEach(function (d) { b.delete(d.ref); });
        return b.commit().then(function () { if (snap.size === 200) return sweep(); });
      });
    }
    return sweep()
      .then(function () { if (sq.code) return db.collection('squadCodes').doc(sq.code).delete().catch(function () {}); })
      .then(function () { return squadRef(sq).delete(); });
  }
  function setSquadConfig(sq, patch) { return squadRef(sq).update({ config: Object.assign({}, sq.config || {}, patch) }); }
  // Shared goal: the squad's average % growth over 7 or 30 days, from everyone's starting point.
  function setSquadGoal(sq, text, target, days) {
    return profiles(sq.members).then(function (m) {
      var base = {}; sq.members.forEach(function (u) { if (m[u]) base[u] = baseFor(m[u]); });
      var start = now();
      return squadRef(sq).update({ goal: { text: String(text || '').replace(/[<>]/g, '').trim().slice(0, 80), target: +target, days: days, start: start, end: start + days * 864e5, base: base } });
    });
  }
  function clearSquadGoal(sq) { return squadRef(sq).update({ goal: null }); }
  function goalProgress(sq, profs) {
    var g = sq.goal; if (!g) return null;
    var list = sq.members.map(function (u) { var p = profs[u]; if (!p) return null; var b = (g.base && g.base[u]) || baseFor(p); return scoreSince(p, b, g.end).pct; }).filter(function (x) { return x != null; });
    var avg = list.length ? list.reduce(function (a, b) { return a + b; }, 0) / list.length : 0;
    return { avg: avg, pct: Math.max(0, Math.min(100, avg / g.target * 100)), done: avg >= g.target, over: now() >= g.end, counted: list.length };
  }
  // Private room codes: 6 characters, no look-alikes (0/O, 1/I).
  var CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function newRoomCode(sq) {
    var r = (global.crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint8Array(6)) : null, c = '';
    for (var i = 0; i < 6; i++) c += CODE_ABC[(r ? r[i] : Math.floor(Math.random() * 256)) % CODE_ABC.length];
    var old = sq.code;
    return db.collection('squadCodes').doc(c).set({ squad: sq.id })
      .then(function () { return squadRef(sq).update({ code: c }); })
      .then(function () { if (old) return db.collection('squadCodes').doc(old).delete().catch(function () {}); })
      .then(function () { return c; });
  }
  function removeRoomCode(sq) {
    if (!sq.code) return Promise.resolve();
    return squadRef(sq).update({ code: null }).then(function () { return db.collection('squadCodes').doc(sq.code).delete().catch(function () {}); });
  }
  function findRoomCode(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) return Promise.reject(new Error('Room codes are 6 letters and numbers, like K7QX2M.'));
    return db.collection('squadCodes').doc(code).get().then(function (d) { if (!d.exists) throw new Error('No squad has the room code ' + code + '.'); return d.data().squad; });
  }

  // Squad chat: squads/{id}/messages, members only
  var REACTIONS = ['like', 'fire', 'rocket', 'trophy', 'smile'];
  function watchMessages(sq, cb, err) {
    return squadRef(sq).collection('messages').orderBy('createdAt', 'desc').limit(60).onSnapshot(function (s) {
      var o = []; s.forEach(function (d) { o.push(Object.assign({ id: d.id }, d.data())); }); cb(o.reverse());
    }, err || function () {});
  }
  function sendMessage(sq, text, photo) {
    var u = me(); if (!u) return Promise.reject(new Error('Sign in first.'));
    text = String(text || '').trim().slice(0, 500);
    if (!text && !photo) return Promise.resolve();
    var d = { author: u.uid, name: String((sq.names && sq.names[u.uid]) || 'Trader').slice(0, 24), text: text, createdAt: firebase.firestore.FieldValue.serverTimestamp(), r: {} };
    if (photo) d.photo = photo;
    return squadRef(sq).collection('messages').add(d);
  }
  function react(sq, msg, kind) {
    var u = me(); if (!u || REACTIONS.indexOf(kind) === -1) return Promise.resolve();
    var upd = {}; upd['r.' + u.uid] = (msg.r || {})[u.uid] === kind ? firebase.firestore.FieldValue.delete() : kind;
    return squadRef(sq).collection('messages').doc(msg.id).update(upd);
  }
  function deleteMessage(sq, msg) { return squadRef(sq).collection('messages').doc(msg.id).delete(); }
  // A camera-roll photo, resized in the browser to a small JPEG (the rules cap it at ~250 KB).
  function chatPhoto(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('Pick a photo.'));
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var max = 900, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var q = 0.8, out = c.toDataURL('image/jpeg', q);
        while (out.length > 240000 && q > 0.3) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
        if (out.length > 240000) return reject(new Error('That photo is too large. Try a smaller one.'));
        resolve(out);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Couldn\'t read that photo.')); };
      img.src = url;
    });
  }

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
    renameSquad: renameSquad, removeMember: removeMember, deleteSquad: deleteSquad, setSquadConfig: setSquadConfig,
    setSquadGoal: setSquadGoal, clearSquadGoal: clearSquadGoal, goalProgress: goalProgress,
    newRoomCode: newRoomCode, removeRoomCode: removeRoomCode, findRoomCode: findRoomCode,
    REACTIONS: REACTIONS, watchMessages: watchMessages, sendMessage: sendMessage, react: react, deleteMessage: deleteMessage, chatPhoto: chatPhoto,
    claimReferral: claimReferral, myReferrals: myReferrals, referralTier: referralTier, nextTier: nextTier,
    copy: copy, shareLink: shareLink, card: card, shareCard: shareCard
  };
})(window);
