/*!
 * Zelos notification switches: what reaches your phone or computer.
 *
 *   ZelosNotifySettings.mount(el)   draws "This device" (zelos-push.js) + one switch per kind
 *
 * Personal kinds live in users/{uid}.notificationPrefs.types ({kind: false} = off; missing
 * = on). Scanner alerts keep using notificationPrefs.strategies (the My Agents switches on
 * the dashboard; missing = every scanner on). The server checks both before it sends
 * (functions/main.py notify_users / alert_push). Everything also lands in the bell's inbox.
 */
(function (global) {
  'use strict';
  var d = document;
  var GROUPS = [
    ['Battles', [['challenges', 'Challenges', 'Someone challenges you to a Trade War, or answers your challenge'],
      ['battles', 'Battle updates', 'A Trade War starts, you lose the lead, you\'re knocked out, final results']]],
    ['Friends & community', [['friends', 'Friends', 'Someone adds you as a friend, or adds you back'],
      ['community', 'Community', 'New members in your community, Founder milestones']]],
    ['Your trades', [['fills', 'Stop loss & take profit', 'An automatic exit fills in one of your Trade Wars']]],
    ['Scanner alerts', [['s:swing-trader', 'Swing Trader', 'A new alert is published'],
      ['s:breakout-rider', 'Breakout Rider', 'A new alert is published'], ['s:options-scanner', 'Options Scanner', 'A new alert is published']]]
  ];
  var STRATS = ['swing-trader', 'breakout-rider', 'options-scanner'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function style() {
    if (d.getElementById('znsStyle')) return;
    var s = d.createElement('style'); s.id = 'znsStyle';
    s.textContent = '.zns-g{font:600 .64rem var(--mono,monospace);letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#8b93a3);margin:16px 0 2px}' +
      '.zns-row{display:flex;gap:14px;align-items:center;padding:11px 0;border-top:1px solid var(--border-soft,#1d2028)}.zns-row div{flex:1;min-width:0}' +
      '.zns-row b{display:block;font-size:.92rem}.zns-row small{color:var(--muted,#8b93a3);font-size:.8rem;line-height:1.4}' +
      '.zns-sw{position:relative;width:46px;height:27px;flex:none}.zns-sw input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer;z-index:1}' +
      '.zns-sw i{position:absolute;inset:0;border-radius:999px;background:var(--border,#262a34);transition:background .15s}' +
      '.zns-sw i::after{content:"";position:absolute;left:3px;top:3px;width:21px;height:21px;border-radius:50%;background:#9599a3;transition:transform .15s,background .15s}' +
      '.zns-sw input:checked+i{background:var(--bull,#3ecb7c)}.zns-sw input:checked+i::after{transform:translateX(19px);background:#fff}' +
      '.zns-sw input:focus-visible+i{outline:2px solid var(--accent,#4a86ff);outline-offset:2px}.zns-sw input:disabled+i{opacity:.5}' +
      '.zns-note{font-size:.8rem;color:var(--muted,#8b93a3);margin:12px 0 0;line-height:1.5}' +
      '@media (prefers-reduced-motion:reduce){.zns-sw i,.zns-sw i::after{transition:none}}';
    d.head.appendChild(s);
  }
  function mount(el) {
    if (!el) return;
    style();
    el.innerHTML = '<div class="zns-dev"></div><div class="zns-list"></div><p class="zns-note"></p>';
    if (global.ZelosPush) ZelosPush.mount(el.querySelector('.zns-dev'));
    var list = el.querySelector('.zns-list'), note = el.querySelector('.zns-note'), user = null, prefs = {};
    function draw() {
      var types = prefs.types || {}, strats = prefs.strategies;
      list.innerHTML = GROUPS.map(function (g) {
        return '<div class="zns-g">' + esc(g[0]) + '</div>' + g[1].map(function (k) {
          var on = k[0].indexOf('s:') === 0 ? (!strats || strats.indexOf(k[0].slice(2)) !== -1) : types[k[0]] !== false;
          return '<label class="zns-row"><div><b>' + esc(k[1]) + '</b><small>' + esc(k[2]) + '</small></div><span class="zns-sw"><input type="checkbox" data-k="' + k[0] + '"' + (on ? ' checked' : '') + (user ? '' : ' disabled') + ' aria-label="' + esc(k[1]) + '"><i></i></span></label>';
        }).join('');
      }).join('');
      note.textContent = user ? 'Each switch is saved to your account and applies on every device. Everything also shows up under the bell.' : 'Sign in to choose which notifications you get.';
    }
    list.addEventListener('change', function (e) {
      var k = e.target.getAttribute('data-k'); if (!k || !user) return;
      var db = firebase.firestore(), ref = db.collection('users').doc(user.uid), on = e.target.checked, upd = {};
      if (k.indexOf('s:') === 0) {
        var cur = (prefs.strategies || STRATS).slice(), s = k.slice(2), i = cur.indexOf(s);
        if (on && i === -1) cur.push(s); if (!on && i !== -1) cur.splice(i, 1);
        prefs.strategies = cur; upd = { notificationPrefs: { strategies: cur } };
      } else {
        prefs.types = prefs.types || {}; prefs.types[k] = on; upd = { notificationPrefs: { types: {} } }; upd.notificationPrefs.types[k] = on;
      }
      ref.set(upd, { merge: true }).then(function () { note.textContent = 'Saved.'; }, function () { note.textContent = 'Couldn\'t save that. Try again.'; e.target.checked = !on; });
    });
    draw();
    try {
      firebase.auth().onAuthStateChanged(function (u) {
        user = u && !u.isAnonymous ? u : null; prefs = {}; draw();
        if (!user) return;
        firebase.firestore().collection('users').doc(user.uid).get().then(function (s) { prefs = (s.exists && s.data().notificationPrefs) || {}; draw(); }).catch(function () {});
      });
    } catch (e) {}
  }
  global.ZelosNotifySettings = { mount: mount };
})(window);
