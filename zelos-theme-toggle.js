/*!
 * Zelos — background theme toggle (Blue / White / Black).
 *
 * Only the surface/text tokens change between themes (see the
 * :root[data-theme=...] blocks in zelos-theme.css) — accent blue, gold,
 * bull-green and danger-red stay fixed so charts/chips/alerts read the same
 * whichever background is picked. The choice is remembered per-browser via
 * localStorage.
 *
 * Black is the default: a first-ever visitor (or anyone whose saved value is
 * missing or retired, e.g. the old "brown" theme) sees black.
 *
 * Every page runs a one-line copy of applyStoredTheme() inline near the top
 * of <head> — before the stylesheet paints — so a returning visitor who
 * picked Blue or White never sees a flash of black. wireToggle() then runs
 * after the DOM is ready to hook up any `.theme-toggle` buttons on the page:
 * clicking a swatch picks that theme, clicking elsewhere on the pill cycles.
 */
(function (global) {
  var KEY = 'zelosTheme';
  var THEMES = ['blue', 'white', 'black'];
  var LABELS = { blue: 'Blue', white: 'White', black: 'Black' };

  function normalize(t) { return THEMES.indexOf(t) === -1 ? 'black' : t; }

  function applyStoredTheme() {
    var t = 'black';
    try { t = normalize(global.localStorage.getItem(KEY)); } catch (e) { /* default black stands */ }
    document.documentElement.setAttribute('data-theme', t);
  }

  function currentTheme() { return normalize(document.documentElement.getAttribute('data-theme')); }

  function syncButtons() {
    var t = currentTheme();
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      btn.setAttribute('aria-label', 'Background theme: ' + LABELS[t] + '. Click to switch.');
      btn.title = 'Background: ' + LABELS[t] + ' (click to switch)';
    });
  }

  function setTheme(theme) {
    theme = normalize(theme);
    document.documentElement.setAttribute('data-theme', theme);
    try { global.localStorage.setItem(KEY, theme); } catch (e) { /* ignore */ }
    syncButtons();
    try { global.dispatchEvent(new CustomEvent('zelos:theme', { detail: { theme: theme } })); } catch (e) { /* old browsers */ }
  }

  function wireToggle() {
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      if (btn._zelosWired) return;
      btn._zelosWired = true;
      // pages written before the three-way toggle still carry the old two-swatch markup
      var track = btn.querySelector('.theme-toggle-track');
      if (track && !track.querySelector('.sw-blue')) track.innerHTML = '<i class="sw-blue"></i><i class="sw-white"></i><i class="sw-black"></i>';
      btn.removeAttribute('role');
      btn.addEventListener('click', function (e) {
        var sw = e.target && e.target.className && String(e.target.className).match(/sw-(blue|white|black)/);
        if (sw) return setTheme(sw[1]);
        var i = THEMES.indexOf(currentTheme());
        setTheme(THEMES[(i + 1) % THEMES.length]);
      });
    });
    syncButtons();
  }

  global.ZelosThemeToggle = { THEMES: THEMES, applyStoredTheme: applyStoredTheme, setTheme: setTheme, currentTheme: currentTheme, wireToggle: wireToggle };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireToggle);
  } else {
    wireToggle();
  }
})(window);
