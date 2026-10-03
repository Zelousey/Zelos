/*!
 * Zelos app bars.
 *
 * Phones (styles in zelos-theme.css, hidden above 760px):
 *   - bottom tab bar: Home · Dashboard · Trade War · Alerts · Account. The Account tab
 *     shows your own avatar (traders/{uid}.avatar, else your sign-in photo) in a ring
 *     the color of your level.
 *   - top bar: the page name, your coins (zelos-tokens.js chip), the bell and the menu.
 *     The logo, theme switch and Log in / Get Started move out of the way; the theme
 *     switch and sign in / out live at the bottom of the menu instead.
 *
 * Every size: the bell (.zb-bell) opens your notifications: challenges, battle
 * updates, friends, your community and Trade War fills, written by the server to
 * users/{uid}/inbox. Opening it marks them read. Alerts → Notifications
 * (alert-history.html#notifications) has the switches for what reaches your phone.
 *
 * Games keep the whole screen, so no bars there.
 */
(function () {
  'use strict';
  var d = document, path = location.pathname;
  if (/\/games\//.test(path) || d.querySelector('.zb-bar')) return;
  var ROOT = /\/(learn|scan|practice|real)\//.test(path) ? '../' : '';
  var I = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    dash: '<rect x="3" y="3" width="7.5" height="9" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="5" rx="1.5"/><rect x="13.5" y="11" width="7.5" height="10" rx="1.5"/><rect x="3" y="15" width="7.5" height="6" rx="1.5"/>',
    war: '<path d="M4 19 19 4M15 4h4v4M5 4l5 5M14 14l5 5M19 15v4h-4"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>'
  };
  function svg(k) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[k] + '</svg>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var tabs = [
    ['Home', 'index.html', 'home', /^\/(index\.html)?$/],
    ['Dashboard', 'dashboard.html', 'dash', /\/dashboard\.html$/],
    ['Trade War', 'practice/index.html', 'war', /\/practice\//],
    ['Alerts', 'alert-history.html', 'bell', /\/(alert-history|alert|swing-trader|breakout-rider|options-scanner|daily-market)\.html$/]
  ];
  // level ring colors (same tiers as zelos-levels.js)
  var LV = [[0, '#8a909c'], [10, '#d08a52'], [50, '#e3e8ef'], [150, '#ffd45c'], [400, '#7fb0ff'], [1000, '#b9a8ff'], [2000, '#ff8a5c'], [3500, '#4fe0c1'], [6000, '#ff6fb5'], [10000, '#ffe27a'], [16000, '#9fd3ff']];
  function ring(xp) { var c = LV[0][1]; LV.forEach(function (l) { if ((xp || 0) >= l[0]) c = l[1]; }); return c; }
  function pageName() {
    if (/\/practice\/profile\.html$/.test(path)) return 'Profile';
    if (/\/practice\/invite\.html$/.test(path)) return 'You\'re invited';
    if (/\/practice\/war\.html$/.test(path)) return 'Battle';
    if (/\/practice\/(squads|communities)\.html$/.test(path)) return /squads/.test(path) ? 'Squads' : 'Communities';
    for (var i = 0; i < tabs.length; i++) if (tabs[i][3].test(path)) return /\/alert\.html$/.test(path) ? 'Alert' : tabs[i][0];
    if (/\/(my-zelos|tokens)\.html$/.test(path)) return /tokens/.test(path) ? 'Tokens' : 'My Zelos';
    var t = (d.title || 'Zelos').split(/\s[|:—–]\s|:\s/)[0].replace(/^Zelos\s*[—–-]\s*/, '').trim();
    return t.length > 22 ? t.slice(0, 21) + '…' : t;
  }

  var bar, bell, inbox = [], unsubInbox = null, uid = null, db = null;
  function build() {
    bar = d.createElement('nav'); bar.className = 'zb-bar'; bar.setAttribute('aria-label', 'Main');
    bar.innerHTML = tabs.map(function (t) {
      return '<a href="' + ROOT + t[1] + '"' + (t[3].test(path) ? ' class="is-on" aria-current="page"' : '') + '>' + svg(t[2]) + '<span>' + t[0] + '</span></a>';
    }).join('') + '<a href="' + ROOT + 'my-zelos.html" id="zbAcct"' + (/\/(my-zelos|tokens)\.html$/.test(path) || /\/practice\/profile\.html$/.test(path) ? ' class="is-on"' : '') + '><span class="zb-av">?</span><span>Account</span></a>';
    d.body.appendChild(bar); d.documentElement.classList.add('has-tabbar');
    topBar();
    addInviteEntries();
    if (!hook()) window.addEventListener('load', function () { if (!hook()) setTimeout(hook, 1500); });
  }

  // ------------------------------------------------------------ Invite a Friend (menu entry, every page)
  // Top of the phone menu and of the desktop account dropdown; loads zelos-invite.js on demand.
  function openInvite(e) {
    if (e) e.preventDefault();
    if (window.ZelosInvite) return ZelosInvite.open();
    var sc = d.createElement('script'); sc.src = ROOT + 'zelos-invite.js'; sc.onload = function () { if (window.ZelosInvite) ZelosInvite.open(); }; d.head.appendChild(sc);
  }
  function inviteLink(cls) { var a = d.createElement('a'); a.href = '#invite'; a.className = 'zb-invite ' + (cls || ''); a.innerHTML = '&#127873; Invite a Friend'; a.onclick = openInvite; return a; }
  function addInviteEntries() {
    var panel = d.getElementById('navMobilePanel');
    if (panel && !panel.querySelector('.zb-invite')) panel.insertBefore(inviteLink('zb-invite-m'), panel.firstChild);
    var nav = d.getElementById('navAuth');
    function desk() { var ap = d.getElementById('accountPanel'); if (ap && !ap.querySelector('.zb-invite')) ap.insertBefore(inviteLink('zb-invite-d'), ap.firstChild); }
    desk();
    if (nav && window.MutationObserver) new MutationObserver(desk).observe(nav, { childList: true, subtree: true });
    if (location.hash === '#invite') setTimeout(openInvite, 1200);
  }

  // ------------------------------------------------------------ top bar
  function topBar() {
    var nav = d.querySelector('.site-nav .shell'), ham = d.getElementById('navHamburger');
    if (!nav || !ham) return;
    d.documentElement.classList.add('has-zbtop');
    var title = d.createElement('b'); title.className = 'zb-title'; title.textContent = pageName();
    nav.insertBefore(title, nav.firstChild);
    bell = d.createElement('button'); bell.type = 'button'; bell.className = 'zb-bell'; bell.hidden = true;
    bell.setAttribute('aria-label', 'Notifications'); bell.setAttribute('aria-haspopup', 'true');
    bell.innerHTML = svg('bell') + '<em hidden></em>';
    ham.parentNode.insertBefore(bell, ham);
    var pop = d.createElement('div'); pop.className = 'zb-inbox'; pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Notifications');
    d.body.appendChild(pop);
    bell.onclick = function (e) { e.stopPropagation(); if (pop.hidden) openInbox(pop); else pop.hidden = true; };
    d.addEventListener('click', function (e) { if (!pop.hidden && !pop.contains(e.target)) pop.hidden = true; });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') pop.hidden = true; });
    // the menu gets what the top bar no longer shows: theme + account
    var panel = d.getElementById('navMobilePanel');
    if (panel && !panel.querySelector('.zb-menu-extra')) {
      var x = d.createElement('div'); x.className = 'zb-menu-extra';
      x.innerHTML = '<div class="nav-mobile-label">Settings</div><a href="' + ROOT + 'alert-history.html#notifications">Notifications</a>' +
        '<button type="button" class="zb-theme">Switch background theme</button><a href="' + ROOT + 'my-zelos.html" class="zb-acct-link">My account &amp; sign in</a>';
      panel.appendChild(x);
      x.querySelector('.zb-theme').onclick = function () { var t = d.getElementById('themeToggle'); if (t) t.click(); };
    }
  }
  function ago(ms) { var m = Math.max(1, Math.round((Date.now() - ms) / 60000)); return m < 60 ? m + 'm' : m < 1440 ? Math.round(m / 60) + 'h' : Math.round(m / 1440) + 'd'; }
  var ICON = { challenges: '⚔️', battles: '🏁', friends: '👋', community: '🏝️', fills: '🎯' };
  function renderInbox(pop) {
    pop.innerHTML = '<div class="zb-inbox-head"><b>Notifications</b><a href="' + ROOT + 'alert-history.html#notifications">Settings</a></div>' +
      (inbox.length ? inbox.map(function (n) {
        var link = /^[a-z0-9_\-\/.]+(\?[\w=&%.\-]*)?$/i.test(n.link || '') ? ROOT + n.link : '#';
        return '<a class="zb-note' + (n.read ? '' : ' is-new') + '" href="' + esc(link) + '"><span class="zb-note-ic" aria-hidden="true">' + (ICON[n.kind] || '🔔') + '</span>' +
          '<span><b>' + esc(n.title) + '</b><small>' + esc(n.body) + '</small></span><time>' + ago(n.at || Date.now()) + '</time></a>';
      }).join('') : '<p class="zb-inbox-empty">Nothing yet. Challenges, battle updates, friend adds and your community show up here.</p>');
  }
  function openInbox(pop) {
    renderInbox(pop); pop.hidden = false;
    var unread = inbox.filter(function (n) { return !n.read; });
    if (db && uid && unread.length) {
      var b = db.batch();
      unread.forEach(function (n) { b.update(db.collection('users').doc(uid).collection('inbox').doc(n.id), { read: true }); });
      b.commit().catch(function () {});
    }
  }
  function badge() {
    if (!bell) return;
    var n = inbox.filter(function (x) { return !x.read; }).length, em = bell.querySelector('em');
    em.hidden = !n; em.textContent = n > 9 ? '9+' : n;
    bell.classList.toggle('has-new', !!n);
  }

  // ------------------------------------------------------------ signed-in bits
  // computers: a small "Lv N · XP" chip beside the account menu, linking to XP & missions.
  // The account button is drawn by each page after sign-in, so keep looking for it a little while.
  var chipXp = null, chipTimer = null;
  function xpChip(v) {
    chipXp = v; clearInterval(chipTimer); placeChip();
    if (v != null) { var n = 0; chipTimer = setInterval(function () { if (placeChip() || ++n > 20) clearInterval(chipTimer); }, 1000); }
  }
  function placeChip() {
    var old = d.querySelector('.zb-xpchip');
    if (chipXp == null) { if (old) old.remove(); return true; }
    if (!window.ZelosLevels) { // pages without the level script: load it once
      if (!d.querySelector('script[src*="zelos-levels.js"]')) { var ls = d.createElement('script'); ls.src = ROOT + 'zelos-levels.js'; ls.onload = placeChip; d.head.appendChild(ls); }
      return false;
    }
    var btn = d.getElementById('accountBtn'), host = btn && btn.closest('.nav-drop');
    if (!host) return false;
    var L = window.ZelosLevels, lv = L.levelForXp(chipXp), nx = L.nextLevelForXp(chipXp);
    var pct = nx ? Math.max(0, Math.min(100, (chipXp - lv.xp) / (nx.xp - lv.xp) * 100)) : 100, c = ring(chipXp);
    var el = old || d.createElement('a');
    el.className = 'zb-xpchip'; el.href = ROOT + 'practice/index.html?tab=progress'; el.title = 'XP & missions';
    el.innerHTML = '<i style="background:conic-gradient(' + c + ' ' + pct + '%, rgba(255,255,255,.12) 0)"><b>' + lv.level + '</b></i><span>Lv ' + lv.level + ' &middot; ' + chipXp.toLocaleString('en-US') + ' XP</span>';
    if (el.nextSibling !== host) host.parentNode.insertBefore(el, host);
    return true;
  }

  function hook() {
    try {
      if (!window.firebase || !firebase.apps || !firebase.apps.length) return false;
      var hasFs = typeof firebase.firestore === 'function';
      db = hasFs ? firebase.firestore() : null;
      var unsubT = null, unsubU = null, trader = {}, xp = 0;
      firebase.auth().onAuthStateChanged(function (u) {
        var av = bar.querySelector('.zb-av');
        [unsubT, unsubU, unsubInbox].forEach(function (f) { if (f) f(); }); unsubT = unsubU = unsubInbox = null; inbox = []; badge();
        if (!u || u.isAnonymous) { xpChip(null); uid = null; av.textContent = '?'; av.style.boxShadow = ''; if (bell) bell.hidden = true; return; }
        uid = u.uid; trader = {}; xp = 0;
        function paint() {
          var ph = trader.avatar || trader.photo || u.photoURL;
          if (ph && /^(https:|data:image\/(jpeg|png|webp);base64,)/.test(ph)) av.innerHTML = '<img src="' + esc(ph) + '" alt="" referrerpolicy="no-referrer">';
          else av.textContent = ((trader.username || u.displayName || u.email || 'Z').charAt(0) || 'Z').toUpperCase();
          var c = ring(xp); av.style.boxShadow = '0 0 0 2px ' + c + ', 0 0 8px ' + c + '88';
          xpChip(xp);
        }
        paint();
        // keep this device's notifications connected on every page (zelos-push.js refresh())
        try {
          if ('Notification' in window && Notification.permission === 'granted' && !window.ZelosPush && window.ZelosTokens && !d.querySelector('script[src*="zelos-push.js"]')) {
            var ps = d.createElement('script'); ps.src = ROOT + 'zelos-push.js'; d.head.appendChild(ps);
          }
        } catch (e) {}
        // Founder Program popup (decides for itself whether to show)
        try {
          if (window.ZelosFounder) ZelosFounder.maybe(uid);
          else if (!d.querySelector('script[src*="zelos-founder.js"]')) { var fs = d.createElement('script'); fs.src = ROOT + 'zelos-founder.js'; fs.onload = function () { if (window.ZelosFounder && uid === u.uid) ZelosFounder.maybe(uid); }; d.head.appendChild(fs); }
        } catch (e) {}
        if (!db) return;
        unsubT = db.collection('traders').doc(uid).onSnapshot(function (s) { trader = s.exists ? s.data() : {}; paint(); }, function () {});
        unsubU = db.collection('users').doc(uid).onSnapshot(function (s) { xp = (s.exists && s.data().xp) || 0; paint(); }, function () {});
        if (bell) {
          bell.hidden = false;
          unsubInbox = db.collection('users').doc(uid).collection('inbox').orderBy('at', 'desc').limit(20).onSnapshot(function (s) {
            inbox = []; s.forEach(function (x) { inbox.push(Object.assign({ id: x.id }, x.data())); });
            badge(); var pop = d.querySelector('.zb-inbox'); if (pop && !pop.hidden) renderInbox(pop);
          }, function () {});
        }
      });
      return true;
    } catch (e) { return false; }
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', build); else build();
})();
