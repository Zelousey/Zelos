/*!
 * Zelos: analytics cookie consent (Google Analytics only).
 *
 * Loaded synchronously in <head>, BEFORE the Google tag, on every page with
 * Google Analytics, so Consent Mode defaults are in place before GA runs.
 *
 * - Visitors in the EEA, the UK and Switzerland: GA analytics storage is OFF
 *   by default, and they get a small banner (Allow / Decline). Two layers
 *   decide who counts: Google applies the region default itself from the
 *   visitor's location, and this script shows the banner from the browser's
 *   time zone (GitHub Pages has no server-side geolocation).
 * - Everyone else: analytics runs as before, with no banner.
 * - Advertising storage is denied everywhere: the site shows no ads.
 * - Sign-in, theme and trading data kept in the browser are necessary for the
 *   site to work and aren't affected.
 *
 * The choice is stored in localStorage (zelosConsent = granted | denied).
 * Pages with a consent-region visitor or a stored choice get a
 * "Cookie settings" link in the footer to change it. window.ZelosConsent.open()
 * reopens the banner.
 */
(function (w, d) {
  'use strict';
  var KEY = 'zelosConsent';
  // EEA (EU 27 + Iceland, Liechtenstein, Norway), UK, Switzerland
  var REGIONS = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH'];
  // European time zones outside the EEA/UK/CH
  var NOT_IN = /^Europe\/(Moscow|Kirov|Volgograd|Samara|Ulyanovsk|Astrakhan|Saratov|Simferopol|Kaliningrad|Minsk|Istanbul|Kyiv|Kiev|Zaporozhye|Uzhgorod|Chisinau|Belgrade|Sarajevo|Skopje|Podgorica|Tirane)$/;
  // EEA territories outside Europe/* (Canaries, Madeira, Azores, Iceland, Svalbard, French overseas regions)
  var ALSO_IN = /^(Atlantic\/(Canary|Madeira|Azores|Reykjavik)|Arctic\/Longyearbyen|America\/(Guadeloupe|Martinique|Cayenne)|Indian\/(Reunion|Mayotte))$/;

  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  w.gtag = w.gtag || gtag;

  gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', region: REGIONS, wait_for_update: 500 });
  gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });

  function stored() { try { return w.localStorage.getItem(KEY); } catch (e) { return null; } }
  function store(v) { try { w.localStorage.setItem(KEY, v); } catch (e) {} }
  function inRegion() {
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    return ALSO_IN.test(tz) || (/^Europe\//.test(tz) && !NOT_IN.test(tz));
  }

  var choice = stored(), needs = inRegion();
  if (choice === 'granted') gtag('consent', 'update', { analytics_storage: 'granted' });
  else if (choice === 'denied' || needs) gtag('consent', 'update', { analytics_storage: 'denied' });

  function apply(v) {
    store(v);
    gtag('consent', 'update', { analytics_storage: v });
    close();
    link();
  }
  function close() { var b = d.getElementById('zcBanner'); if (b) b.parentNode.removeChild(b); }

  function open() {
    if (d.getElementById('zcBanner')) return;
    if (!d.getElementById('zcStyle')) {
      var st = d.createElement('style'); st.id = 'zcStyle';
      st.textContent =
        '#zcBanner{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;max-width:640px;margin:0 auto;' +
        'background:var(--card,#101318);color:var(--ink,#e8edf5);border:1px solid var(--border,#263041);border-radius:10px;' +
        'box-shadow:0 12px 32px rgba(0,0,0,.35);padding:14px 16px;font:14px/1.45 var(--sans,system-ui,sans-serif);' +
        'display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;animation:zcIn .18s ease-out}' +
        '#zcBanner p{margin:0;flex:1 1 280px}#zcBanner a{color:var(--accent,#3b82f6)}' +
        '#zcBanner .zc-btns{display:flex;gap:8px;flex:0 0 auto}' +
        '#zcBanner button{font:inherit;font-weight:600;padding:8px 14px;border-radius:8px;cursor:pointer;' +
        'border:1px solid var(--accent,#3b82f6);background:transparent;color:var(--ink,#e8edf5)}' +
        '#zcBanner button:focus-visible{outline:2px solid var(--accent,#3b82f6);outline-offset:2px}' +
        '@keyframes zcIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
        '@media (prefers-reduced-motion:reduce){#zcBanner{animation:none}}';
      d.head.appendChild(st);
    }
    var root = /\/(games|learn|scan|practice|real)\//.test(w.location.pathname) ? '../' : '';
    var b = d.createElement('div');
    b.id = 'zcBanner'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-live', 'polite'); b.setAttribute('aria-label', 'Cookie choice');
    b.innerHTML = '<p>We\'d like to use Google Analytics cookies to see which pages people use. They stay off unless you allow them. ' +
      'Storage needed for sign-in and your settings is always on. <a href="' + root + 'terms.html">Details</a></p>' +
      '<div class="zc-btns"><button type="button" data-zc="denied">Decline</button><button type="button" data-zc="granted">Allow analytics</button></div>';
    b.addEventListener('click', function (e) { var v = e.target && e.target.getAttribute('data-zc'); if (v) apply(v); });
    d.body.appendChild(b);
  }

  function link() {
    var f = d.querySelector('footer.site-footer');
    if (!f || d.getElementById('zcLink')) return;
    var a = d.createElement('a'); a.id = 'zcLink'; a.href = '#'; a.textContent = 'Cookie settings';
    a.style.cssText = 'display:inline-block;margin-top:8px;font-size:12px;color:inherit;opacity:.75';
    a.addEventListener('click', function (e) { e.preventDefault(); open(); });
    f.appendChild(a);
  }

  w.ZelosConsent = { open: open, choice: stored, inRegion: inRegion };
  function ready() { if (needs || choice) link(); if (needs && !choice) open(); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', ready); else ready();
})(window, document);
