/*!
 * Zelos — Trade War challenges: the "YOU'VE BEEN CHALLENGED" card and the
 * challenge dialog. Loaded site-wide (after firebase + zelos-xp.js).
 *
 * Incoming: while you're signed in, twInvites where to == you and status ==
 * 'pending' are watched in real time. A new one shows a full-screen, dark
 * invite card: crossing chart "blades", the challenger's picture, name and
 * @username, the buy-in and length, and Accept / Decline (plus "Not now",
 * which keeps it pending). A browser notification is also sent once per
 * invite when notifications are allowed. Accept calls tw_respond: you join
 * the match with the same virtual buy-in as everyone; a 1-on-1 starts right
 * away and you're taken into it. Nobody is entered into a match without
 * pressing Accept.
 *
 * Outgoing: ZelosChallenge.open({ to: uid | [uids], toName, squadId, squadName })
 * asks for a buy-in, length and mode (classic or Last Man Standing), then calls
 * tw_challenge (or tw_create for an invite-link match).
 *
 * Everything here is virtual money. Server rules: functions/main.py (tw_*).
 */
(function (global) {
  'use strict';
  var d = document, ROOT = /\/(games|learn|scan|practice|real)\//.test(location.pathname) ? '../' : '';
  var FNS_URL = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions-compat.js';
  var SEEN = 'zelosChSeen', NOTIFIED = 'zelosChNotified';
  var queue = [], showing = null, unsub = null, fnsPromise = null;
  // Bigger buy-ins unlock with your level; the server enforces the same table
  // (TW_BUYIN_TIERS in functions/main.py): [max buy-in, level, XP needed, level name]
  var TIERS = [[1000, 0, 0, ''], [5000, 3, 150, 'Gold'], [10000, 5, 1000, 'Diamond']];
  function buyInLock(b, xp) { for (var i = 0; i < TIERS.length; i++) if (b <= TIERS[i][0]) return (xp || 0) >= TIERS[i][2] ? null : { level: TIERS[i][1], xp: TIERS[i][2], name: TIERS[i][3] }; var t = TIERS[TIERS.length - 1]; return { level: t[1], xp: t[2], name: t[3] }; }
  function lockText(L) { return 'Unlocks at Level ' + L.level + ' (' + L.name + ', ' + L.xp.toLocaleString('en-US') + ' XP)'; }
  // chip row for the preset buy-ins; locked ones are disabled and say what unlocks them
  function buyInChips(sel, xp) {
    return [100, 500, 1000, 5000, 10000].map(function (b) {
      var L = buyInLock(b, xp);
      return '<button type="button" data-b="' + b + '" class="' + (b === sel && !L ? 'is-on' : '') + (L ? ' is-locked' : '') + '"' + (L ? ' disabled aria-disabled="true" title="' + lockText(L) + '"' : '') + '>' + (L ? '&#128274; ' : '') + money(b) + '</button>';
    }).join('');
  }
  function lockNote(xp) {
    var locked = TIERS.filter(function (t) { return (xp || 0) < t[2]; });
    return locked.length ? '&#128274; ' + locked.map(function (t) { return money(t[0]) + ' unlocks at Level ' + t[1] + ' (' + t[3] + ')'; }).join(' · ') + '. You have ' + (xp || 0).toLocaleString('en-US') + ' XP.' : '';
  }
  function myXp() { var f = fb(), u = f && f.auth.currentUser; if (!u) return Promise.resolve(0); return f.db.collection('users').doc(u.uid).get().then(function (d) { return (d.exists && d.data().xp) || 0; }).catch(function () { return 0; }); }
  // Last Man Standing rules in plain words (same options as TW_LMS_OPTS in functions/main.py)
  var LMS_OPTS = { floorPct: [5, 10, 15, 20, 30], maxLossPct: [2, 5, 10], maxLosses: [3, 5, 10], cutHours: [6, 12, 24, 48] };
  function hrs(h) { return h % 24 ? h + ' hours' : h === 24 ? 'day' : (h / 24) + ' days'; }
  function lmsRules(lms, buyIn) {
    if (!lms) return [];
    var r = [];
    if (lms.floorPct) r.push('Out if your total P&L falls to -' + lms.floorPct + '%');
    if (lms.maxLossPct) r.push('Out if one trade loses more than ' + lms.maxLossPct + '% of the buy-in' + (buyIn ? ' (' + money(buyIn * lms.maxLossPct / 100) + ')' : ''));
    if (lms.maxLosses) r.push('Out after ' + lms.maxLosses + ' losing trades');
    if (lms.cutHours) r.push('Every ' + hrs(lms.cutHours) + ', last place is cut');
    return r;
  }
  // Advanced gameplay options in plain words (TW_MODE_OPTS in functions/main.py)
  function modesText(m) {
    m = m || {}; var r = [];
    if (m.draft) r.push('Draft: everyone drafts ' + m.draft.picks + ' stocks and can only trade those');
    if (m.whale) r.push('Whale vs Minnow: top-XP players can put at most ' + m.whale.capPct + '% in one stock; everyone else gets ' + m.whale.shields + ' Shield Token' + (m.whale.shields === 1 ? '' : 's'));
    if (m.storms) r.push('Volatility Storms (' + m.storms + '): random 30-minute virtual events');
    if (m.bounties) r.push('Bounty Board: put virtual bounties on rivals');
    return r;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(v) { return '$' + (+v || 0).toLocaleString('en-US'); }
  function store(k) { try { return JSON.parse(sessionStorage.getItem(k) || '[]'); } catch (e) { return []; } }
  function remember(k, id, local) { try { var S = local ? localStorage : sessionStorage, a = JSON.parse(S.getItem(k) || '[]'); if (a.indexOf(id) === -1) { a.push(id); S.setItem(k, JSON.stringify(a.slice(-200))); } } catch (e) {} }
  function notified(id) { try { return JSON.parse(localStorage.getItem(NOTIFIED) || '[]').indexOf(id) !== -1; } catch (e) { return false; } }
  function fb() {
    var cfg = global.ZELOS_FIREBASE_CONFIG;
    if (!global.firebase || !firebase.firestore || !firebase.auth || !cfg || !cfg.projectId) return null;
    try { if (!firebase.apps.length) firebase.initializeApp(cfg); return { db: firebase.firestore(), auth: firebase.auth() }; } catch (e) { return null; }
  }
  function functions() {
    if (!fnsPromise) fnsPromise = new Promise(function (resolve, reject) {
      if (firebase.functions) return resolve(firebase.functions());
      var s = d.createElement('script'); s.src = FNS_URL;
      s.onload = function () { try { resolve(firebase.functions()); } catch (e) { reject(e); } };
      s.onerror = function () { fnsPromise = null; reject(new Error('Couldn\'t reach Trade War. Check your connection and try again.')); };
      d.head.appendChild(s);
    });
    return fnsPromise;
  }
  function call(name, data) { return functions().then(function (f) { return f.httpsCallable(name)(data); }).then(function (r) { return r.data; }); }
  function errText(e) { return String((e && e.message) || e || 'Something went wrong.').replace(/^FirebaseError: /, ''); }

  // ------------------------------------------------------------ styles
  function style() {
    if (d.getElementById('zcStyleCh')) return;
    var s = d.createElement('style'); s.id = 'zcStyleCh';
    s.textContent = [
      '.zc-back{position:fixed;inset:0;z-index:2100;display:flex;align-items:center;justify-content:center;padding:16px;background:radial-gradient(ellipse at 50% 40%,rgba(20,30,55,.72),rgba(3,4,8,.9));animation:zcFade 180ms ease-out}',
      '.zc-card{position:relative;width:min(440px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:#0d1016;color:#f4f5f7;border:1px solid rgba(74,134,255,.35);border-radius:16px;padding:0 22px 20px;box-shadow:0 0 0 1px rgba(255,255,255,.03),0 40px 90px rgba(0,0,0,.7),0 0 60px -20px rgba(74,134,255,.45);font-family:"IBM Plex Sans",system-ui,sans-serif;animation:zcPop 260ms cubic-bezier(.2,.7,.2,1)}',
      '.zc-blades{display:block;width:100%;height:96px;margin:0 -2px}',
      '.zc-blades .b1,.zc-blades .b2{fill:none;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}',
      '.zc-blades .b1{stroke:#10b981;stroke-dasharray:420;stroke-dashoffset:420;animation:zcDraw 460ms 80ms cubic-bezier(.2,.7,.2,1) forwards}',
      '.zc-blades .b2{stroke:#ef4444;stroke-dasharray:420;stroke-dashoffset:420;animation:zcDraw 460ms 80ms cubic-bezier(.2,.7,.2,1) forwards}',
      '.zc-blades .spark{fill:#fff;opacity:0;transform-origin:center;transform-box:fill-box;animation:zcSpark 420ms 460ms ease-out forwards}',
      '.zc-card .zc-kick{text-align:center;font-family:"IBM Plex Mono",monospace;font-weight:700;letter-spacing:.24em;font-size:.78rem;color:#7fa8ff;margin:0 0 12px}',
      '.zc-who{display:flex;align-items:center;gap:12px;justify-content:center;margin-bottom:12px}',
      '.zc-av{width:54px;height:54px;border-radius:50%;object-fit:cover;border:2px solid rgba(74,134,255,.6);background:#161a22;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.3rem;color:#9aa4b8;flex-shrink:0}',
      '.zc-bname{text-align:center;color:#fff;margin:2px 0 14px;font-size:1.5rem;font-weight:800;line-height:1.15;letter-spacing:-.01em;overflow-wrap:anywhere}',
      '.zc-name{font-size:1.25rem;font-weight:700;line-height:1.15}.zc-user{font-family:"IBM Plex Mono",monospace;font-size:.82rem;color:#8b93a3}',
      '.zc-terms{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:4px 0 10px}',
      '.zc-terms span{border:1px solid #232835;border-radius:10px;padding:8px;text-align:center;background:#11151d}.zc-terms small{display:block;color:#8b93a3;font-size:.68rem;text-transform:uppercase;letter-spacing:.06em}.zc-terms b{font-family:"IBM Plex Mono",monospace;font-size:.95rem}',
      '.zc-card .zc-fine{color:#8b93a3;font-size:.78rem;text-align:center;margin:0 0 14px;line-height:1.4}',
      '.zc-btns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}',
      '.zc-btn{font:inherit;font-weight:700;font-size:.98rem;padding:12px;border-radius:12px;cursor:pointer;border:1px solid #2b3140;background:#151a23;color:#e6e9ef;transition:transform 120ms,filter 120ms,box-shadow 180ms}',
      '.zc-btn:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.07)}.zc-btn:active:not(:disabled){transform:none}.zc-btn:disabled{opacity:.5;cursor:default}',
      '.zc-btn:focus-visible{outline:2px solid #4a86ff;outline-offset:2px}',
      '.zc-go{background:linear-gradient(180deg,#08825e,#047857);border-color:rgba(255,255,255,.06);color:#fff;box-shadow:0 10px 26px -12px rgba(5,150,105,.6),inset 0 1px 0 rgba(255,255,255,.18)}',
      '.zc-later{display:block;margin:10px auto 0;background:none;border:0;color:#8b93a3;font:inherit;font-size:.82rem;cursor:pointer;text-decoration:underline}',
      '.zc-card .zc-msg{text-align:center;font-size:.86rem;margin:10px 0 0;min-height:1em}.zc-card .zc-msg.is-bad{color:#f87171}',
      '.zc-f{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;font-size:.84rem;min-width:0}.zc-f select,.zc-f input{width:100%;min-width:0;box-sizing:border-box}.zc-f>span{color:#8b93a3;font-weight:600}',
      '.zc-chips{display:flex;flex-wrap:wrap;gap:6px}.zc-chips button{font:inherit;font-weight:600;font-size:.86rem;padding:7px 12px;border-radius:999px;border:1px solid #2b3140;background:transparent;color:#cfd4dd;cursor:pointer}.zc-chips button.is-on{border-color:#4a86ff;background:#182a4a;color:#fff}',
      '.zc-chips button.is-locked{opacity:.55;cursor:not-allowed;border-style:dashed}',
      '.zc-lock{font-size:.74rem;color:#8b93a3;margin:6px 0 0}',
      '.zc-f input{font:inherit;padding:9px 10px;border-radius:8px;border:1px solid #2b3140;background:#11151d;color:#f4f5f7}',
      '.zc-f select{font:inherit;padding:9px 10px;border-radius:8px;border:1px solid #2b3140;background:#11151d;color:#f4f5f7}',
      '.zc-card .zc-h{margin:18px 0 4px;font-size:1.15rem}',
      '.zc-lms{border:1px solid rgba(239,68,68,.35);background:linear-gradient(180deg,rgba(239,68,68,.07),transparent);border-radius:12px;padding:10px 12px 2px;margin:-4px 0 12px}',
      '.zc-lms .zc-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}.zc-lms .zc-f{margin-bottom:8px}',
      '.zc-card ul.zc-rules{margin:0 0 12px;padding:8px 12px 8px 28px;border:1px solid rgba(239,68,68,.35);border-radius:10px;background:rgba(239,68,68,.06);font-size:.82rem;line-height:1.45;color:#e6e9ef}',
      '.zc-more{border:1px solid #232835;border-radius:12px;padding:8px 12px;margin:0 0 12px;font-size:.84rem}.zc-more summary{cursor:pointer;font-weight:600;color:#cfd4dd}.zc-more summary small{color:#8b93a3;font-weight:400}',
      '.zc-more .zc-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;margin-top:10px}.zc-more .zc-f{margin-bottom:6px}',
      '.zc-check{display:flex;gap:8px;align-items:center;margin:4px 0;color:#cfd4dd}',
      '.zc-card ul.zc-modes{border-color:rgba(74,134,255,.35);background:rgba(74,134,255,.06)}.zc-card ul.zc-modes b{color:#9dbcff}',
      '.zc-card ul.zc-rules b{color:#fca5a5;letter-spacing:.06em;font-size:.72rem;display:block;margin:0 0 2px -16px}',
      '@keyframes zcFade{from{opacity:0}to{opacity:1}}',
      '@keyframes zcPop{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}',
      '@keyframes zcDraw{to{stroke-dashoffset:0}}',
      '@keyframes zcSpark{0%{opacity:0;transform:scale(.2)}40%{opacity:1;transform:scale(1.4)}100%{opacity:.85;transform:scale(1)}}',
      '@keyframes zcOut{to{opacity:0;transform:scale(1.04)}}',
      '@media (prefers-reduced-motion:reduce){.zc-back,.zc-card{animation:none}.zc-blades .b1,.zc-blades .b2{animation:none;stroke-dashoffset:0}.zc-blades .spark{animation:none;opacity:.85}.zc-btn{transition:none}}'
    ].join('\n');
    d.head.appendChild(s);
  }
  // two chart lines that cross like blades: a rising green one and a falling red one
  var BLADES = '<svg class="zc-blades" viewBox="0 0 400 96" aria-hidden="true">' +
    '<polyline class="b1" points="20,84 70,70 110,76 160,52 200,48 240,34 290,38 330,18 380,10"/>' +
    '<polyline class="b2" points="20,12 70,24 110,18 160,40 200,48 240,58 290,54 330,76 380,86"/>' +
    '<circle class="spark" cx="200" cy="48" r="5"/></svg>';

  // ------------------------------------------------------------ incoming
  function modal(html, onKey) {
    style();
    var back = d.createElement('div'); back.className = 'zc-back';
    back.innerHTML = '<div class="zc-card" role="dialog" aria-modal="true" aria-labelledby="zcTitle">' + html + '</div>';
    d.body.appendChild(back);
    var prev = d.activeElement;
    function key(e) { if (onKey) onKey(e); }
    d.addEventListener('keydown', key);
    return { el: back, close: function (anim) {
      d.removeEventListener('keydown', key);
      var done = function () { back.remove(); try { prev && prev.focus(); } catch (e) {} };
      if (anim && !(global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) { back.style.animation = 'zcOut 160ms ease-in forwards'; setTimeout(done, 170); } else done();
    } };
  }
  function show(inv) {
    showing = inv;
    var init = esc((inv.fromName || '?').charAt(0).toUpperCase());
    var av = inv.fromPhoto && /^(https:|data:image\/(jpeg|png|webp);base64,)/.test(inv.fromPhoto) ? '<img class="zc-av" alt="" referrerpolicy="no-referrer" src="' + esc(inv.fromPhoto) + '">' : '<span class="zc-av">' + init + '</span>';
    var m = modal(BLADES + '<p class="zc-kick" id="zcTitle">YOU\'VE BEEN CHALLENGED</p>' +
      (inv.warName ? '<p class="zc-bname">' + (inv.lms ? '&#9760; ' : '⚔️ ') + esc(inv.warName) + '</p>' : '') +
      '<div class="zc-who">' + av + '<div><div class="zc-name"' + (inv.from ? ' data-zname="' + esc(inv.from) + '"' : '') + '>' + esc(inv.fromName || 'A trader') + '</div>' + (inv.fromUsername ? '<div class="zc-user">@' + esc(inv.fromUsername) + '</div>' : '') + '</div></div>' +
      '<div class="zc-terms"><span><small>Battle</small><b>' + (inv.lms ? 'Last Man' : inv.mode === 'duel' ? '1 v 1' : 'Group') + '</b></span><span><small>Buy-in</small><b>' + money(inv.buyIn) + '</b></span><span><small>Length</small><b>' + inv.days + ' day' + (inv.days === 1 ? '' : 's') + '</b></span></div>' +
      '<p class="zc-fine">Everyone starts with the same ' + money(inv.buyIn) + ' of virtual money. Best % gain wins. Virtual only: no real money, no prizes.' + (inv.mode === 'duel' ? ' A 1 v 1 starts as soon as you accept.' : '') + '</p>' +
      (inv.symbols && inv.symbols.length ? '<p class="zc-fine">Squad rule: only ' + inv.symbols.slice(0, 12).map(esc).join(', ') + (inv.symbols.length > 12 ? ' and more' : '') + ' can be traded.</p>' : '') +
      (modesText(inv.modes).length ? '<ul class="zc-rules zc-modes"><b>GAME OPTIONS</b>' + modesText(inv.modes).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '') +
      (inv.lms ? '<ul class="zc-rules"><b>LAST MAN STANDING</b>' + lmsRules(inv.lms, inv.buyIn).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '<li>Knocked out = your stocks are sold and your result is locked. Last trader standing wins.</li></ul>' : '') +
      '<div class="zc-btns"><button type="button" class="zc-btn" id="zcNo">Decline</button><button type="button" class="zc-btn zc-go" id="zcYes">Accept</button></div>' +
      '<button type="button" class="zc-later" id="zcLater">Not now</button><p class="zc-msg" id="zcMsg" role="status"></p>',
      function (e) { if (e.key === 'Escape') later(); });
    var $ = function (id) { return m.el.querySelector('#' + id); };
    function busy(on) { $('zcYes').disabled = $('zcNo').disabled = on; }
    function say(t, bad) { $('zcMsg').textContent = t; $('zcMsg').className = 'zc-msg' + (bad ? ' is-bad' : ''); }
    function next() { showing = null; m.close(true); setTimeout(pump, 200); }
    function later() { remember(SEEN, inv.id); next(); }
    $('zcLater').onclick = later;
    $('zcNo').onclick = function () { busy(true); say('Declining…'); call('tw_respond', { inviteId: inv.id, accept: false }).then(function () { remember(SEEN, inv.id); next(); }, function (e) { busy(false); say(errText(e), true); }); };
    $('zcYes').onclick = function () {
      busy(true); say('Joining with ' + money(inv.buyIn) + ' of virtual money…');
      call('tw_respond', { inviteId: inv.id, accept: true }).then(function (r) {
        remember(SEEN, inv.id);
        if (r.status === 'accepted') { say(r.started ? 'Game on. Entering the Trade War…' : 'You\'re in. Entering the lobby…'); setTimeout(function () { location.href = ROOT + 'practice/war.html?w=' + encodeURIComponent(r.warId); }, 450); }
        else { say(r.status === 'expired' ? 'This Trade War already started or was cancelled.' : 'This challenge was already answered.', true); setTimeout(next, 1400); }
      }, function (e) { busy(false); say(errText(e), true); });
    };
    setTimeout(function () { try { $('zcYes').focus(); } catch (e) {} }, 60);
  }
  function pump() {
    if (showing) return;
    var seen = store(SEEN);
    var inv = queue.filter(function (q) { return seen.indexOf(q.id) === -1; })[0];
    if (inv) show(inv);
  }
  function notify(inv) {
    if (notified(inv.id)) return; remember(NOTIFIED, inv.id, true);
    try {
      if ('Notification' in global && Notification.permission === 'granted') new Notification('Trade War (virtual): you\'ve been challenged', { body: (inv.fromName || 'A trader') + ' challenged you: ' + money(inv.buyIn) + ' buy-in, ' + inv.days + ' day' + (inv.days === 1 ? '' : 's') + '.', icon: ROOT + 'icons/icon-192.png', tag: 'zelos-invite-' + inv.id });
    } catch (e) {}
  }
  function watch(user) {
    if (unsub) { unsub(); unsub = null; }
    queue = [];
    if (!user) return;
    var f = fb(); if (!f) return;
    unsub = f.db.collection('twInvites').where('to', '==', user.uid).where('status', '==', 'pending').onSnapshot(function (snap) {
      queue = []; snap.forEach(function (doc) { queue.push(Object.assign({ id: doc.id }, doc.data())); });
      queue.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      queue.forEach(notify);
      if (showing && !queue.some(function (q) { return q.id === showing.id; })) { var b = d.querySelector('.zc-back'); if (b) b.remove(); showing = null; }
      pump();
    }, function () {});
  }

  // ------------------------------------------------------------ outgoing
  function open(opts) {
    opts = opts || {};
    var f = fb(), u = f && f.auth.currentUser;
    if (!u || u.isAnonymous) { alert('Sign in to challenge someone to a Trade War.'); return Promise.resolve(null); }
    return myXp().then(function (xp) { return new Promise(function (resolve) {
      var buy = 1000, start = !opts.to && !opts.squadId, pickSq = null, mode = '';
      function sel(id, label, opts) { return '<label class="zc-f"><span>' + label + '</span><select id="' + id + '">' + opts.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></label>'; }
      function pick(k, label, txt, def) {
        return '<label class="zc-f"><span>' + label + '</span><select data-lms="' + k + '"><option value="">Off</option>' +
          LMS_OPTS[k].map(function (v) { return '<option value="' + v + '"' + (v === def ? ' selected' : '') + '>' + txt(v) + '</option>'; }).join('') + '</select></label>';
      }
      var who = opts.squadId ? 'your squad' + (opts.squadName ? ' ' + opts.squadName : '') : (opts.toName || 'this trader');
      var m = modal(BLADES + '<h2 class="zc-h" id="zcTitle">' + (start ? 'Start a Trade War' : 'Challenge ' + esc(who)) + '</h2>' +
        '<p class="zc-fine" style="text-align:left">' + (start ? 'Challenge a friend by @username, pick a squad, or leave it empty to get an invite link to share. ' : 'They get a "You\'ve been challenged" card and choose to accept or decline. ') + 'Everyone starts with the same virtual buy-in. Virtual money only.</p>' +
        '<label class="zc-f"><span>Battle name</span><input id="zcName" maxlength="40" placeholder="e.g. Friday Night Fight" autocomplete="off" required></label>' +
        (start ? '<label class="zc-f"><span>Challenge a friend (optional)</span><input id="zcUser" placeholder="@username, or leave empty for an invite link" autocapitalize="none" spellcheck="false"></label>' +
          '<div class="zc-f" id="zcSqWrap" hidden><span>Or challenge a squad</span><div class="zc-chips" id="zcSq"></div></div>' : '') +
        '<div class="zc-f"><span>Virtual buy-in (everyone starts with this)</span><div class="zc-chips" id="zcBuy">' + buyInChips(buy, xp) + '</div>' +
        (lockNote(xp) ? '<p class="zc-lock">' + lockNote(xp) + '</p>' : '') + '</div>' +
        '<label class="zc-f"><span>Length</span><select id="zcDays"><option value="1">1 day</option><option value="3">3 days</option><option value="7" selected>1 week</option><option value="14">2 weeks</option><option value="30">30 days</option></select></label>' +
        '<div class="zc-f"><span>Mode</span><div class="zc-chips" id="zcMode"><button type="button" data-m="" class="is-on">Classic: best % gain wins</button><button type="button" data-m="lms">Last Man Standing</button></div></div>' +
        '<details class="zc-more"><summary>Game options <small>draft, whales &amp; minnows, storms, bounties</small></summary><div class="zc-row">' +
          sel('zcDraft', 'Pre-battle draft', [['', 'Off'], ['2', '2 stocks each'], ['3', '3 stocks each'], ['5', '5 stocks each']]) +
          sel('zcStorm', 'Volatility Storms', [['', 'Off'], ['rare', 'Rare (~1 a day)'], ['often', 'Often (~3 a day)']]) +
          sel('zcWhale', 'Whale vs Minnow', [['', 'Off'], ['25', 'Whales max 25% a stock'], ['50', 'Whales max 50% a stock'], ['75', 'Whales max 75% a stock']]) +
          sel('zcShields', 'Minnow Shield Tokens', [['1', '1 shield'], ['2', '2 shields'], ['3', '3 shields']]) +
        '</div><label class="zc-check"><input type="checkbox" id="zcBounty"> Bounty Board: players can put virtual bounties on rivals</label>' +
        '<p class="zc-lock">Whales are the players above the match\'s median XP. Shields cancel a bounty on you or save you from a timed cut. Everything is virtual.</p></details>' +
        '<div class="zc-lms" id="zcLms" hidden><div class="zc-row">' +
          pick('floorPct', 'P&L floor', function (v) { return 'Out at -' + v + '%'; }, 10) +
          pick('maxLossPct', 'Max loss on one trade', function (v) { return v + '% of buy-in'; }) +
          pick('maxLosses', 'Losing trades allowed', function (v) { return 'Out after ' + v; }) +
          pick('cutHours', 'Timed cuts', function (v) { return 'Last place cut every ' + hrs(v); }) +
        '</div><p class="zc-lock">Pick at least one. Knocked-out players have their stocks sold and their result locked. The last trader standing wins.</p></div>' +
        '<div class="zc-btns"><button type="button" class="zc-btn" id="zcCancel">Cancel</button><button type="button" class="zc-btn zc-go" id="zcSend">' + (start ? 'Start Trade War' : 'Send challenge') + '</button></div><p class="zc-msg" id="zcMsg" role="status"></p>',
        function (e) { if (e.key === 'Escape') { m.close(); resolve(null); } });
      var $ = function (id) { return m.el.querySelector('#' + id); };
      $('zcBuy').onclick = function (e) { var b = e.target.closest('[data-b]'); if (!b || b.disabled) return; buy = +b.getAttribute('data-b'); this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-on', x === b); }); };
      $('zcCancel').onclick = function () { m.close(); resolve(null); };
      $('zcMode').onclick = function (e) { var b = e.target.closest('[data-m]'); if (!b) return; mode = b.getAttribute('data-m'); this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-on', x === b); }); $('zcLms').hidden = !mode; };
      var cutSel = m.el.querySelector('[data-lms="cutHours"]');
      function fitCuts() { var h = +$('zcDays').value * 24; [].forEach.call(cutSel.options, function (o) { o.disabled = !!o.value && +o.value >= h; if (o.disabled && o.selected) cutSel.value = ''; }); }
      $('zcDays').onchange = fitCuts; fitCuts();
      if (start) {
        f.db.collection('squads').where('members', 'array-contains', u.uid).limit(20).get().then(function (snap) {
          var sq = []; snap.forEach(function (x) { var v = x.data(); if ((v.members || []).length > 1) sq.push({ id: x.id, name: v.name, n: v.members.length }); });
          if (!sq.length) return;
          $('zcSq').innerHTML = sq.map(function (q) { return '<button type="button" data-sq="' + esc(q.id) + '">&#128101; ' + esc(q.name) + ' (' + q.n + ')</button>'; }).join('');
          $('zcSqWrap').hidden = false;
          $('zcSq').onclick = function (e) { var b = e.target.closest('[data-sq]'); if (!b) return; var on = !b.classList.contains('is-on'); this.querySelectorAll('button').forEach(function (x) { x.classList.remove('is-on'); }); b.classList.toggle('is-on', on); pickSq = on ? b.getAttribute('data-sq') : null; if (on) $('zcUser').value = ''; };
        }).catch(function () {});
      }
      $('zcSend').onclick = function () {
        var btn = this; btn.disabled = true; $('zcMsg').textContent = 'Sending…'; $('zcMsg').className = 'zc-msg';
        var data = { buyIn: buy, days: +$('zcDays').value }, bad = function (t) { btn.disabled = false; $('zcMsg').textContent = t; $('zcMsg').className = 'zc-msg is-bad'; };
        // every battle needs its own name: people can be in several at once
        var bname = String($('zcName').value || '').replace(/[<>]/g, '').trim();
        if (bname.length < 2) { $('zcName').focus(); return bad('Give your battle a name, so you can tell your battles apart.'); }
        data.name = bname.slice(0, 40);
        var md = {};
        if ($('zcDraft').value) md.draftPicks = +$('zcDraft').value;
        if ($('zcStorm').value) md.storms = $('zcStorm').value;
        if ($('zcWhale').value) { md.whaleCap = +$('zcWhale').value; md.whaleShields = +$('zcShields').value; }
        if ($('zcBounty').checked) md.bounties = true;
        if (Object.keys(md).length) data.modes = md;
        if (mode === 'lms') {
          data.lms = {}; m.el.querySelectorAll('[data-lms]').forEach(function (x) { if (x.value) data.lms[x.getAttribute('data-lms')] = +x.value; });
          if (!Object.keys(data.lms).length) return bad('Pick at least one elimination rule for Last Man Standing.');
        }
        var go = function (name, payload) {
          return call(name, payload).then(function (r) {
            if (name === 'tw_challenge' && global.ZelosProgress) ZelosProgress.bump('challenges');
            $('zcMsg').textContent = name === 'tw_create' ? 'Trade War created. Opening it so you can share the invite link…' : 'Challenge sent. Opening your Trade War…';
            setTimeout(function () { m.close(true); resolve(r); location.href = ROOT + 'practice/war.html?w=' + encodeURIComponent(r.warId); }, 500);
          });
        };
        var p;
        if (!start) { if (opts.squadId) data.squadId = opts.squadId; else data.to = opts.to; p = go('tw_challenge', data); }
        else if (pickSq) { data.squadId = pickSq; p = go('tw_challenge', data); }
        else {
          var un = String($('zcUser').value || '').trim().replace(/^@/, '').toLowerCase();
          if (!un) { data.maxPlayers = 10; p = go('tw_create', data); }
          else if (!/^[a-z0-9_]{3,20}$/.test(un)) return bad('Type a username like @amy_trades, or leave it empty.');
          else p = f.db.collection('usernames').doc(un).get().then(function (x) {
            if (!x.exists) throw new Error('No trader has the username @' + un + ' yet.');
            if (x.data().uid === u.uid) throw new Error('That\'s you. Challenge someone else.');
            data.to = x.data().uid; return go('tw_challenge', data);
          });
        }
        p.then(null, function (e) { bad(errText(e)); });
      };
      setTimeout(function () { try { $('zcName').focus(); } catch (e) {} }, 60);
    }); });
  }

  // ------------------------------------------------------------ nav identity
  // The account button shows your @username and picture (never your email).
  var ident = null, identObs = null;
  function applyIdentity() {
    var nav = d.getElementById('navAuth'); if (!nav || !ident) return;
    var nm = nav.querySelector('.account-name'), av = nav.querySelector('.account-avatar');
    var label = ident.t.username ? '@' + ident.t.username : (ident.t.name || '');
    if (nm && label && nm.textContent !== label) nm.textContent = label;
    var ph = ident.t.avatar || ident.t.photo || ident.photo;
    if (av && ph && /^(https:|data:image\/(jpeg|png|webp);base64,)/.test(ph) && !av.querySelector('img')) {
      av.innerHTML = '<img alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block" src="' + esc(ph) + '">';
    }
  }
  function watchIdentity(user) {
    ident = null; if (!user) return;
    var f = fb(); if (!f) return;
    f.db.collection('traders').doc(user.uid).get().then(function (snap) { ident = { t: snap.exists ? snap.data() : {}, photo: user.photoURL }; applyIdentity(); }).catch(function () {});
    var nav = d.getElementById('navAuth');
    if (nav && !identObs && global.MutationObserver) { identObs = new MutationObserver(applyIdentity); identObs.observe(nav, { childList: true, subtree: true }); }
  }
  d.addEventListener('zelos:profile', function (e) { if (ident && e.detail) { ident.t = e.detail; var nav = d.getElementById('navAuth'), av = nav && nav.querySelector('.account-avatar img'); if (av) av.remove(); applyIdentity(); } });

  global.ZelosChallenge = { lmsRules: lmsRules, modesText: modesText, open: open, call: call, buyInLock: buyInLock, buyInChips: buyInChips, lockNote: lockNote, lockText: lockText, myXp: myXp };
  function boot() {
    var f = fb(); if (!f) return;
    f.auth.onAuthStateChanged(function (u) { var real = u && !u.isAnonymous ? u : null; watch(real); watchIdentity(real); });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
