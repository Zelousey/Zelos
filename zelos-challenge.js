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
 * asks for a buy-in and length, then calls tw_challenge.
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
      '.zc-name{font-size:1.25rem;font-weight:700;line-height:1.15}.zc-user{font-family:"IBM Plex Mono",monospace;font-size:.82rem;color:#8b93a3}',
      '.zc-terms{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:4px 0 10px}',
      '.zc-terms span{border:1px solid #232835;border-radius:10px;padding:8px;text-align:center;background:#11151d}.zc-terms small{display:block;color:#8b93a3;font-size:.68rem;text-transform:uppercase;letter-spacing:.06em}.zc-terms b{font-family:"IBM Plex Mono",monospace;font-size:.95rem}',
      '.zc-card .zc-fine{color:#8b93a3;font-size:.78rem;text-align:center;margin:0 0 14px;line-height:1.4}',
      '.zc-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
      '.zc-btn{font:inherit;font-weight:700;font-size:.98rem;padding:12px;border-radius:12px;cursor:pointer;border:1px solid #2b3140;background:#151a23;color:#e6e9ef;transition:transform 120ms,filter 120ms,box-shadow 180ms}',
      '.zc-btn:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.07)}.zc-btn:active:not(:disabled){transform:none}.zc-btn:disabled{opacity:.5;cursor:default}',
      '.zc-btn:focus-visible{outline:2px solid #4a86ff;outline-offset:2px}',
      '.zc-go{background:linear-gradient(180deg,#08825e,#047857);border-color:rgba(255,255,255,.06);color:#fff;box-shadow:0 10px 26px -12px rgba(5,150,105,.6),inset 0 1px 0 rgba(255,255,255,.18)}',
      '.zc-later{display:block;margin:10px auto 0;background:none;border:0;color:#8b93a3;font:inherit;font-size:.82rem;cursor:pointer;text-decoration:underline}',
      '.zc-card .zc-msg{text-align:center;font-size:.86rem;margin:10px 0 0;min-height:1em}.zc-card .zc-msg.is-bad{color:#f87171}',
      '.zc-f{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;font-size:.84rem}.zc-f>span{color:#8b93a3;font-weight:600}',
      '.zc-chips{display:flex;flex-wrap:wrap;gap:6px}.zc-chips button{font:inherit;font-weight:600;font-size:.86rem;padding:7px 12px;border-radius:999px;border:1px solid #2b3140;background:transparent;color:#cfd4dd;cursor:pointer}.zc-chips button.is-on{border-color:#4a86ff;background:#182a4a;color:#fff}',
      '.zc-chips button.is-locked{opacity:.55;cursor:not-allowed;border-style:dashed}',
      '.zc-lock{font-size:.74rem;color:#8b93a3;margin:6px 0 0}',
      '.zc-f select{font:inherit;padding:9px 10px;border-radius:8px;border:1px solid #2b3140;background:#11151d;color:#f4f5f7}',
      '.zc-card .zc-h{margin:18px 0 4px;font-size:1.15rem}',
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
      '<div class="zc-who">' + av + '<div><div class="zc-name">' + esc(inv.fromName || 'A trader') + '</div>' + (inv.fromUsername ? '<div class="zc-user">@' + esc(inv.fromUsername) + '</div>' : '') + '</div></div>' +
      '<div class="zc-terms"><span><small>Battle</small><b>' + (inv.mode === 'duel' ? '1 v 1' : 'Group') + '</b></span><span><small>Buy-in</small><b>' + money(inv.buyIn) + '</b></span><span><small>Length</small><b>' + inv.days + ' day' + (inv.days === 1 ? '' : 's') + '</b></span></div>' +
      '<p class="zc-fine">' + esc(inv.warName || 'Trade War') + ' · everyone starts with the same ' + money(inv.buyIn) + ' of virtual money. Best % gain wins. Virtual only: no real money, no prizes.' + (inv.mode === 'duel' ? ' A 1 v 1 starts as soon as you accept.' : '') + '</p>' +
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
      var buy = 1000;
      var who = opts.squadId ? 'your squad' + (opts.squadName ? ' ' + opts.squadName : '') : (opts.toName || 'this trader');
      var m = modal(BLADES + '<h2 class="zc-h" id="zcTitle">Challenge ' + esc(who) + '</h2>' +
        '<p class="zc-fine" style="text-align:left">They get a "You\'ve been challenged" card and choose to accept or decline. Everyone starts with the same virtual buy-in. Virtual money only.</p>' +
        '<div class="zc-f"><span>Virtual buy-in (everyone starts with this)</span><div class="zc-chips" id="zcBuy">' + buyInChips(buy, xp) + '</div>' +
        (lockNote(xp) ? '<p class="zc-lock">' + lockNote(xp) + '</p>' : '') + '</div>' +
        '<label class="zc-f"><span>Length</span><select id="zcDays"><option value="1">1 day</option><option value="3">3 days</option><option value="7" selected>1 week</option><option value="14">2 weeks</option><option value="30">30 days</option></select></label>' +
        '<div class="zc-btns"><button type="button" class="zc-btn" id="zcCancel">Cancel</button><button type="button" class="zc-btn zc-go" id="zcSend">Send challenge</button></div><p class="zc-msg" id="zcMsg" role="status"></p>',
        function (e) { if (e.key === 'Escape') { m.close(); resolve(null); } });
      var $ = function (id) { return m.el.querySelector('#' + id); };
      $('zcBuy').onclick = function (e) { var b = e.target.closest('[data-b]'); if (!b || b.disabled) return; buy = +b.getAttribute('data-b'); this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-on', x === b); }); };
      $('zcCancel').onclick = function () { m.close(); resolve(null); };
      $('zcSend').onclick = function () {
        var btn = this; btn.disabled = true; $('zcMsg').textContent = 'Sending…'; $('zcMsg').className = 'zc-msg';
        var data = { buyIn: buy, days: +$('zcDays').value };
        if (opts.squadId) data.squadId = opts.squadId; else data.to = opts.to;
        call('tw_challenge', data).then(function (r) {
          if (global.ZelosProgress) ZelosProgress.bump('challenges');
          $('zcMsg').textContent = 'Challenge sent. Opening your Trade War…';
          setTimeout(function () { m.close(true); resolve(r); location.href = ROOT + 'practice/war.html?w=' + encodeURIComponent(r.warId); }, 500);
        }, function (e) { btn.disabled = false; $('zcMsg').textContent = errText(e); $('zcMsg').className = 'zc-msg is-bad'; });
      };
      setTimeout(function () { try { $('zcSend').focus(); } catch (e) {} }, 60);
    }); });
  }

  global.ZelosChallenge = { open: open, call: call, buyInLock: buyInLock, buyInChips: buyInChips, lockNote: lockNote, lockText: lockText, myXp: myXp };
  function boot() {
    var f = fb(); if (!f) return;
    f.auth.onAuthStateChanged(function (u) { watch(u && !u.isAnonymous ? u : null); });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
