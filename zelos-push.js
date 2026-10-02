/*!
 * Zelos push notifications: turn on alerts for this phone or computer.
 *
 *   ZelosPush.mount(el)   draws the "Notifications on this device" row into el
 *   ZelosPush.state()     'on' | 'off' | 'blocked' | 'unsupported' | 'ios-home' | 'unset'
 *
 * Uses Firebase Cloud Messaging (firebase-messaging-sw.js at the site root). This
 * device's token goes to the server through push_register; which scanners notify
 * you is your My Agents switches on the dashboard. On iPhone, web notifications
 * only work once Zelos is added to the Home Screen and opened from there.
 */
(function (global) {
  'use strict';
  var d = document, ROOT = /\/(games|learn|scan|practice|real)\//.test(location.pathname) ? '../' : '';
  var MSG_URL = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js';
  var KEY = 'zpToken', UKEY = 'zpTokenUid', AKEY = 'zpTokenAt', mounts = [], refreshing = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function saved() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
  function save(t, uid) {
    try {
      if (t) { localStorage.setItem(KEY, t); localStorage.setItem(UKEY, uid || ''); localStorage.setItem(AKEY, String(Date.now())); }
      else { localStorage.removeItem(KEY); localStorage.removeItem(UKEY); localStorage.removeItem(AKEY); }
    } catch (e) {}
  }
  function ls(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function ios() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function standalone() { return (global.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function supported() { return 'serviceWorker' in navigator && 'Notification' in global && 'PushManager' in global; }
  function user() { try { var u = firebase.auth().currentUser; return u && !u.isAnonymous ? u : null; } catch (e) { return null; } }
  function state() {
    if (!global.ZELOS_VAPID_KEY) return 'unset';
    if (ios() && !standalone()) return 'ios-home';
    if (!supported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'blocked';
    if (Notification.permission !== 'granted') return 'off';
    // permission is what the browser remembers; the token we refresh on every visit (refresh())
    return saved() || refreshing ? 'on' : 'off';
  }
  var msgP = null;
  function messaging() {
    if (!msgP) msgP = new Promise(function (res, rej) {
      if (firebase.messaging) return res(firebase.messaging());
      var s = d.createElement('script'); s.src = MSG_URL;
      s.onload = function () { try { res(firebase.messaging()); } catch (e) { rej(e); } };
      s.onerror = function () { msgP = null; rej(new Error('Couldn\'t load notifications. Check your connection.')); };
      d.head.appendChild(s);
    });
    return msgP;
  }
  function call(name, data) { return global.ZelosTokens ? ZelosTokens.call(name, data) : Promise.reject(new Error('Not ready yet. Try again.')); }
  function enable() {
    if (!user()) return Promise.reject(new Error('Sign in first.'));
    return Notification.requestPermission().then(function (p) {
      if (p !== 'granted') throw new Error(p === 'denied' ? 'Notifications are blocked for this site. Allow them in your browser settings, then try again.' : 'Notifications weren\'t allowed.');
      return navigator.serviceWorker.register('/firebase-messaging-sw.js');
    }).then(function (reg) {
      return messaging().then(function (m) { return m.getToken({ vapidKey: global.ZELOS_VAPID_KEY, serviceWorkerRegistration: reg }); });
    }).then(function (token) {
      if (!token) throw new Error('This browser didn\'t give a notification token. Try again.');
      var prev = saved();
      return call('push_register', { token: token }).then(function () {
        if (prev && prev !== token) call('push_unregister', { token: prev }).catch(function () {});
        save(token, user().uid); listen(); return token;
      });
    });
  }
  // Every visit, once permission is granted: get this device's current token (Firebase
  // rotates them) and re-register it if it changed, belongs to another account, or
  // hasn't been confirmed for a day. This is what keeps notifications connected after
  // you leave and come back; nobody should have to turn them off and on again.
  function refresh() {
    var u = user();
    if (!u || !global.ZELOS_VAPID_KEY || !supported() || Notification.permission !== 'granted' || (ios() && !standalone())) return Promise.resolve(false);
    if (refreshing) return refreshing;
    refreshing = navigator.serviceWorker.register('/firebase-messaging-sw.js').then(function (reg) {
      return messaging().then(function (m) { return m.getToken({ vapidKey: global.ZELOS_VAPID_KEY, serviceWorkerRegistration: reg }); });
    }).then(function (token) {
      if (!token) return false;
      var prev = saved(), fresh = Date.now() - (+ls(AKEY) || 0) < 864e5;
      if (token === prev && ls(UKEY) === u.uid && fresh) return true;
      return call('push_register', { token: token }).then(function () {
        if (prev && prev !== token) call('push_unregister', { token: prev }).catch(function () {});
        save(token, u.uid); return true;
      });
    }).catch(function () { return false; }).then(function (ok) {
      refreshing = null; if (ok) listen(); redraw(); return ok;
    });
    redraw();
    return refreshing;
  }
  function disable() {
    var t = saved(); save('');
    var done = t ? call('push_unregister', { token: t }).catch(function () {}) : Promise.resolve();
    return done.then(function () { return messaging().then(function (m) { return m.deleteToken(); }).catch(function () {}); });
  }
  // a notification that arrives while the page is open shows as a banner here instead
  var listening = false;
  function listen() {
    if (listening || state() !== 'on') return; listening = true;
    messaging().then(function (m) {
      m.onMessage(function (p) {
        var n = p.notification || {}, link = (p.fcmOptions && p.fcmOptions.link) || (p.data && p.data.link) || ROOT + 'dashboard.html';
        var el = d.createElement('a'); el.href = link; el.className = 'zn-banner';
        el.innerHTML = '<b>' + esc(n.title || 'Zelos') + '</b><span>' + esc(n.body || '') + '</span>';
        d.body.appendChild(el); setTimeout(function () { el.remove(); }, 9000);
      });
    }).catch(function () {});
  }
  function style() {
    if (d.getElementById('znStyle')) return;
    var s = d.createElement('style'); s.id = 'znStyle';
    s.textContent = '.zn-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--border,#262b36);border-radius:12px;background:var(--surface-2,#11151d);margin:0 0 12px}' +
      '.zn-row .zn-txt{flex:1 1 220px;min-width:0;font-size:.86rem;line-height:1.4}.zn-row .zn-txt b{display:block;font-size:.92rem}.zn-row .zn-txt small{color:var(--muted,#8b93a3)}' +
      '.zn-btn{font:inherit;font-weight:700;font-size:.84rem;padding:9px 14px;border-radius:10px;border:1px solid var(--border,#2b3140);background:var(--surface,#151a23);color:var(--ink,#e6e9ef);cursor:pointer}' +
      '.zn-btn.zn-go{background:var(--accent,#3b82f6);border-color:transparent;color:#fff}.zn-btn:disabled{opacity:.6}' +
      '.zn-msg{flex-basis:100%;font-size:.8rem;margin:0}.zn-msg.is-bad{color:#f87171}.zn-msg.is-ok{color:#10b981}' +
      '.zn-banner{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2200;display:flex;flex-direction:column;gap:2px;width:min(440px,calc(100vw - 24px));padding:12px 16px;border-radius:14px;background:#0d1016;border:1px solid #3b82f6;color:#f4f5f7;text-decoration:none;box-shadow:0 20px 50px rgba(0,0,0,.5);font-size:.86rem}.zn-banner span{color:#aab2c0}';
    d.head.appendChild(s);
  }
  function draw(el, msg, bad) {
    var st = state(), u = user(), bell = '🔔 ';
    var t = {
      on: ['Notifications are on for this device', 'New alerts from the scanners you switched on in My Agents.'],
      off: ['Get notified when a new alert drops', 'A notification on this phone or computer the moment a scanner publishes.'],
      blocked: ['Notifications are blocked', 'Allow notifications for agentictrading.info in your browser settings, then come back.'],
      unsupported: ['This browser can\'t show notifications', 'Try Chrome, Edge, Firefox or Safari on a computer, or Android.'],
      'ios-home': ['On iPhone: add Zelos to your Home Screen', 'Tap the Share button, then "Add to Home Screen". Open Zelos from the new icon and turn notifications on there.'],
      unset: ['Notifications are coming soon', 'Website notifications aren\'t switched on for the site yet.']
    }[st];
    el.innerHTML = '<div class="zn-row"><div class="zn-txt"><b>' + bell + esc(t[0]) + '</b><small>' + esc(t[1]) + '</small></div>' +
      (st === 'off' ? (u ? '<button class="zn-btn zn-go" type="button" data-zn="on">Turn on</button>' : '<a class="zn-btn" href="' + ROOT + 'tokens.html" style="text-decoration:none">Sign in first</a>') : '') +
      (st === 'on' ? '<button class="zn-btn" type="button" data-zn="test">Send a test</button><button class="zn-btn" type="button" data-zn="off">Turn off</button>' : '') +
      '<p class="zn-msg' + (bad ? ' is-bad' : msg ? ' is-ok' : '') + '" role="status">' + esc(msg || '') + '</p></div>';
    el.querySelectorAll('[data-zn]').forEach(function (b) { b.onclick = function () {
      var k = b.getAttribute('data-zn'); el.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
      var p = k === 'on' ? enable().then(function () { return 'Done! You\'ll get new alerts here.'; })
        : k === 'off' ? disable().then(function () { return 'Turned off for this device.'; })
        : refresh().then(function () { return call('push_test', { token: saved() }); }).then(function (r) { return r.sent ? 'Sent. It should pop up in a few seconds.' : 'Couldn\'t reach this device. Check that notifications are allowed for Zelos in your phone\'s settings.'; });
      p.then(function (m) { redraw(m); }, function (e) { redraw(String((e && e.message) || e).replace(/^FirebaseError: /, ''), true); });
    }; });
  }
  function redraw(msg, bad) { mounts.forEach(function (el) { draw(el, msg, bad); }); }
  function mount(el) { if (!el) return; style(); mounts.push(el); draw(el); }
  function boot() {
    try { firebase.auth().onAuthStateChanged(function () { redraw(); refresh(); }); } catch (e) {}
    d.addEventListener('visibilitychange', function () { if (d.visibilityState === 'visible') refresh(); });
  }
  global.ZelosPush = { mount: mount, state: state, enable: enable, disable: disable, refresh: refresh };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
