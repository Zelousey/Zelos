/*!
 * Zelos Training Ground: drills shown inside the app (/app/training/<drill>).
 * Only when the page is framed with ?embed=1: hides the website's menu, footer and tab bar,
 * keeps links to other drills inside the frame, and sends "Back to Training Ground" (and any
 * other site link) to the app instead of loading the website inside the frame.
 */
(function () {
  'use strict';
  if (!/[?&]embed=1(&|$)/.test(location.search) || window.top === window) return;
  var d = document.documentElement;
  d.classList.add('zg-embed');
  var st = document.createElement('style');
  st.textContent = '.zg-embed .site-nav,.zg-embed .site-footer,.zg-embed .zb-bar,.zg-embed #zcBanner{display:none!important}' +
    '.zg-embed body{padding-top:0!important;padding-bottom:0!important}';
  (document.head || d).appendChild(st);
  function tell(msg) { try { window.parent.postMessage(msg, location.origin); } catch (e) {} }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.target === '_blank') return;
    var u;
    try { u = new URL(a.getAttribute('href'), location.href); } catch (err) { return; }
    if (u.origin !== location.origin) { a.target = '_blank'; a.rel = 'noopener'; return; }
    if (/\/games\/[a-z-]+\.html$/.test(u.pathname)) { u.searchParams.set('embed', '1'); a.href = u.toString(); return; }
    e.preventDefault();
    tell({ zelos: 'training-nav', path: u.pathname + u.search + u.hash });
  }, true);
  window.addEventListener('load', function () { tell({ zelos: 'training-height', h: document.documentElement.scrollHeight }); });
})();
