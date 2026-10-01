/*!
 * Zelos mobile tab bar: Home · Dashboard · Trade War · Alerts · Account, fixed to the
 * bottom of the screen on phones (styles in zelos-theme.css, .zb-bar; hidden above 760px).
 * The full menu stays in the hamburger. Games keep the whole screen, so no bar there.
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
  var tabs = [
    ['Home', 'index.html', 'home', /^\/(index\.html)?$/],
    ['Dashboard', 'dashboard.html', 'dash', /\/dashboard\.html$/],
    ['Trade War', 'practice/index.html', 'war', /\/practice\//],
    ['Alerts', 'alert-history.html', 'bell', /\/(alert-history|alert|swing-trader|breakout-rider|options-scanner|daily-market)\.html$/]
  ];
  function build() {
    var bar = d.createElement('nav'); bar.className = 'zb-bar'; bar.setAttribute('aria-label', 'Main');
    bar.innerHTML = tabs.map(function (t) {
      return '<a href="' + ROOT + t[1] + '"' + (t[3].test(path) ? ' class="is-on" aria-current="page"' : '') + '>' + svg(t[2]) + '<span>' + t[0] + '</span></a>';
    }).join('') + '<a href="' + ROOT + 'my-zelos.html" id="zbAcct"' + (/\/(my-zelos|tokens)\.html$/.test(path) ? ' class="is-on"' : '') + '><span class="zb-av">?</span><span>Account</span></a>';
    d.body.appendChild(bar); d.documentElement.classList.add('has-tabbar');
    function hook() {
      try {
        if (!window.firebase || !firebase.apps || !firebase.apps.length) return false;
        firebase.auth().onAuthStateChanged(function (u) {
          var av = bar.querySelector('.zb-av'); if (!av) return;
          if (u && !u.isAnonymous) av.innerHTML = u.photoURL && /^https:/.test(u.photoURL) ? '<img src="' + u.photoURL.replace(/"/g, '') + '" alt="" referrerpolicy="no-referrer">' : ((u.displayName || u.email || 'Z').charAt(0).toUpperCase());
          else av.textContent = '?';
        });
        return true;
      } catch (e) { return false; }
    }
    if (!hook()) window.addEventListener('load', function () { if (!hook()) setTimeout(hook, 1500); });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', build); else build();
})();
