/*!
 * Zelos — background theme toggle (brown / black).
 *
 * Only the surface tokens change between themes (see the
 * :root[data-theme="black"] block in zelos-theme.css) — accent blue, gold,
 * bull-green and danger-red stay fixed so charts/chips/alerts read the same
 * either way. The choice is remembered per-browser via localStorage.
 *
 * The early read-and-apply (applyStoredTheme) is meant to be called inline,
 * synchronously, near the top of <head> — before the stylesheet paints —
 * so a returning visitor who picked "black" never sees a flash of brown.
 * wireToggle() then runs after the DOM is ready to hook up any
 * `.theme-toggle` buttons on the page.
 */
(function (global) {
  var KEY = 'zelosTheme';

  function applyStoredTheme() {
    try {
      var saved = global.localStorage.getItem(KEY);
      if (saved === 'black') {
        document.documentElement.setAttribute('data-theme', 'black');
      }
    } catch (e) { /* localStorage unavailable — default brown theme stands */ }
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'black' ? 'black' : 'brown';
  }

  function setTheme(theme) {
    if (theme === 'black') {
      document.documentElement.setAttribute('data-theme', 'black');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    try { global.localStorage.setItem(KEY, theme); } catch (e) { /* ignore */ }
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      btn.setAttribute('aria-checked', theme === 'black' ? 'true' : 'false');
    });
  }

  function wireToggle() {
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      btn.setAttribute('role', 'switch');
      btn.setAttribute('aria-label', 'Switch background theme');
      btn.setAttribute('aria-checked', currentTheme() === 'black' ? 'true' : 'false');
      btn.addEventListener('click', function () {
        setTheme(currentTheme() === 'black' ? 'brown' : 'black');
      });
    });
  }

  global.ZelosThemeToggle = { applyStoredTheme: applyStoredTheme, setTheme: setTheme, currentTheme: currentTheme, wireToggle: wireToggle };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireToggle);
  } else {
    wireToggle();
  }
})(window);
