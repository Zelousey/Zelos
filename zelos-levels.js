/*!
 * Zelos — XP levels, branded level badges and the level-up celebration.
 *
 * Shared by dashboard.html (progress card) and zelos-xp.js (which loads this
 * file on demand and calls celebrate() the moment an award crosses a level,
 * on whatever page the XP was earned — a game end screen, an alert, etc.).
 *
 * Badges are AgenticTrading.info marks rather than generic medals: a
 * hexagonal emblem in the tier's metal, carrying the site's rising-candles
 * mark and an up-chevron, with one pip per level along the bottom rim. Higher
 * tiers add a laurel ring (Gold+) and wings (Diamond) so the rank reads at a
 * glance even at 16px.
 *
 * Exposes window.ZelosLevels:
 *   LEVELS                       — [{ level, xp, name, title, colors }]
 *   levelForXp(xp) / nextLevelForXp(xp)
 *   badge(levelOrNumber, size)   — inline SVG string
 *   celebrate(level, opts)       — full-screen level-up moment. opts: { xp, gained }
 *                                  Deduped: the same level is only celebrated once
 *                                  per browser, so two tabs (or the dashboard's live
 *                                  XP listener plus the award that caused it) never
 *                                  double-fire.
 */
(function (global) {
  'use strict';

  var LEVELS = [
    { level: 0, xp: 0,    name: 'Getting started', title: 'New trader',     colors: ['#3a3f4a', '#23262d', '#8a909c'] },
    { level: 1, xp: 10,   name: 'Bronze',          title: 'Chart Reader',   colors: ['#d08a52', '#7a4722', '#ffd9b3'] },
    { level: 2, xp: 50,   name: 'Silver',          title: 'Setup Hunter',   colors: ['#e3e8ef', '#8a95a5', '#ffffff'] },
    { level: 3, xp: 150,  name: 'Gold',            title: 'Risk Manager',   colors: ['#ffd45c', '#b07a12', '#fff4c7'] },
    { level: 4, xp: 400,  name: 'Platinum',        title: 'Strategist',     colors: ['#7fb0ff', '#2a58c9', '#e6f0ff'] },
    { level: 5, xp: 1000, name: 'Diamond',         title: 'Agentic Trader', colors: ['#b9a8ff', '#5b3fd6', '#f1ecff'] }
  ];

  function levelForXp(xp) {
    var cur = LEVELS[0];
    for (var i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].xp) cur = LEVELS[i];
    return cur;
  }
  function nextLevelForXp(xp) {
    for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].xp > xp) return LEVELS[i];
    return null;
  }

  var uid = 0;
  function badge(lv, size) {
    if (typeof lv === 'number') lv = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, lv))];
    size = size || 24;
    var n = lv.level, c = lv.colors, id = 'zlv' + (++uid);
    var hex = 'M32 4 L56 17.5 V46.5 L32 60 L8 46.5 V17.5 Z';
    var inner = 'M32 10 L50.5 20.5 V43.5 L32 54 L13.5 43.5 V20.5 Z';
    var s = '<svg class="zlv-badge" viewBox="0 0 64 64" width="' + size + '" height="' + size + '" role="img" aria-label="' + lv.name + ' level badge">' +
      '<defs><linearGradient id="' + id + 'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1017"/><stop offset="1" stop-color="#1b2130"/></linearGradient></defs>';
    // wings (Diamond)
    if (n >= 5) s += '<path d="M8 24 L0 20 L3 30 L0 36 L8 34 Z M56 24 L64 20 L61 30 L64 36 L56 34 Z" fill="url(#' + id + 'g)" opacity="0.9"/>';
    // laurel ring (Gold+)
    if (n >= 3) {
      for (var k = 0; k < 5; k++) {
        var y = 44 - k * 6;
        s += '<ellipse cx="' + (9 - k * 0.2) + '" cy="' + y + '" rx="2.2" ry="3.6" transform="rotate(-28 ' + (9 - k * 0.2) + ' ' + y + ')" fill="' + c[0] + '" opacity="0.8"/>';
        s += '<ellipse cx="' + (55 + k * 0.2) + '" cy="' + y + '" rx="2.2" ry="3.6" transform="rotate(28 ' + (55 + k * 0.2) + ' ' + y + ')" fill="' + c[0] + '" opacity="0.8"/>';
      }
    }
    s += '<path d="' + hex + '" fill="url(#' + id + 'g)" stroke="' + c[2] + '" stroke-opacity="0.55" stroke-width="1.2"/>' +
      '<path d="' + inner + '" fill="url(#' + id + 'f)"/>';
    // rising candles + up-chevron: the AgenticTrading mark
    var candles = [[20, 36, 42, 32, 44], [27, 31, 38, 27, 40], [34, 27, 33, 22, 36], [41, 21, 28, 17, 30]];
    candles.forEach(function (cd, i) {
      var col = n === 0 ? '#6c7380' : (i === 3 ? c[2] : c[0]);
      s += '<line x1="' + (cd[0] + 2) + '" y1="' + cd[3] + '" x2="' + (cd[0] + 2) + '" y2="' + cd[4] + '" stroke="' + col + '" stroke-width="1.2"/>' +
        '<rect x="' + cd[0] + '" y="' + cd[1] + '" width="4" height="' + (cd[2] - cd[1]) + '" rx="0.6" fill="' + col + '"/>';
    });
    if (n > 0) s += '<path d="M18 30 L28 22 L34 26 L46 15" fill="none" stroke="' + c[2] + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M41 14.5 L46.5 14.5 L46.5 20" fill="none" stroke="' + c[2] + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    // level pips along the bottom rim
    for (var p = 0; p < 5; p++) {
      var px = 22 + p * 5;
      s += '<circle cx="' + px + '" cy="49" r="1.6" fill="' + (p < n ? c[2] : '#4a505c') + '"/>';
    }
    return s + '</svg>';
  }

  // ------------------------------------------------------------ celebration
  var STYLE_ID = 'zlv-style';
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      '.zlv-overlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;' +
      'background:rgba(4,6,12,0.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:zlv-fade .25s ease-out;}' +
      '.zlv-card{position:relative;width:min(380px,100%);text-align:center;padding:34px 24px 24px;border-radius:14px;overflow:hidden;' +
      'background:linear-gradient(180deg,#141a28,#0b0e15);border:1px solid var(--zlv-c0);color:#f4f6fb;font-family:var(--sans,system-ui,sans-serif);' +
      'box-shadow:0 0 0 1px rgba(255,255,255,0.04),0 0 60px var(--zlv-glow),0 30px 80px rgba(0,0,0,0.6);animation:zlv-pop .55s cubic-bezier(.2,1.4,.4,1);}' +
      '.zlv-rays{position:absolute;left:50%;top:92px;width:520px;height:520px;margin:-260px 0 0 -260px;pointer-events:none;opacity:.35;' +
      'background:repeating-conic-gradient(from 0deg,var(--zlv-c0) 0deg 6deg,transparent 6deg 22deg);' +
      '-webkit-mask:radial-gradient(circle,#000 0,#000 30%,transparent 62%);mask:radial-gradient(circle,#000 0,#000 30%,transparent 62%);animation:zlv-spin 14s linear infinite;}' +
      '.zlv-badge-wrap{position:relative;display:inline-block;animation:zlv-badge 1s cubic-bezier(.2,1.5,.35,1) .1s both;filter:drop-shadow(0 0 18px var(--zlv-glow));}' +
      '.zlv-kicker{position:relative;margin-top:14px;font-family:var(--mono,ui-monospace,monospace);font-size:.72rem;letter-spacing:.3em;text-transform:uppercase;color:var(--zlv-c2);}' +
      '.zlv-title{position:relative;margin:6px 0 2px;font-size:2.1rem;font-weight:800;letter-spacing:.02em;line-height:1.1;' +
      'background:linear-gradient(90deg,var(--zlv-c2),var(--zlv-c0),var(--zlv-c2));background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:zlv-shine 2.4s linear infinite;}' +
      '.zlv-sub{position:relative;font-size:.95rem;color:#c9cfdb;}' +
      '.zlv-xp{position:relative;margin-top:10px;font-family:var(--mono,ui-monospace,monospace);font-size:.8rem;color:#8f97a8;}' +
      '.zlv-btn{position:relative;margin-top:18px;font:700 .92rem/1 var(--sans,system-ui,sans-serif);padding:12px 22px;border-radius:8px;border:none;cursor:pointer;color:#0b0e15;background:var(--zlv-c2);}' +
      '.zlv-btn:focus-visible{outline:2px solid #fff;outline-offset:2px;}' +
      '.zlv-confetti{position:absolute;inset:0;pointer-events:none;}' +
      '@keyframes zlv-fade{from{opacity:0}to{opacity:1}}' +
      '@keyframes zlv-pop{0%{opacity:0;transform:scale(.6) translateY(20px)}100%{opacity:1;transform:none}}' +
      '@keyframes zlv-badge{0%{opacity:0;transform:scale(.2) rotate(-25deg)}60%{opacity:1;transform:scale(1.18) rotate(6deg)}100%{transform:scale(1) rotate(0)}}' +
      '@keyframes zlv-spin{to{transform:rotate(360deg)}}' +
      '@keyframes zlv-shine{to{background-position:-200% 0}}' +
      '@media (prefers-reduced-motion: reduce){.zlv-overlay,.zlv-card,.zlv-badge-wrap,.zlv-title{animation:none}.zlv-rays{animation:none;opacity:.2}}';
    var st = document.createElement('style'); st.id = STYLE_ID; st.textContent = css;
    document.head.appendChild(st);
  }

  function confetti(host, colors) {
    if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var cv = document.createElement('canvas'); cv.className = 'zlv-confetti'; host.appendChild(cv);
    var dpr = Math.min(global.devicePixelRatio || 1, 2), W = host.clientWidth, H = host.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; var ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    var parts = [], pal = colors.concat(['#3ecb7c', '#4a86ff']);
    for (var i = 0; i < 90; i++) {
      var a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 6;
      parts.push({ x: W / 2, y: 110, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, r: 2 + Math.random() * 3, c: pal[i % pal.length], rot: Math.random() * 6, vr: Math.random() * 0.3 - 0.15 });
    }
    var t0 = performance.now();
    (function frame(t) {
      var dt = t - t0; if (dt > 2600 || !cv.isConnected) return cv.remove();
      ctx.clearRect(0, 0, W, H);
      parts.forEach(function (p) {
        p.vy += 0.18; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - dt / 2600); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore();
      });
      requestAnimationFrame(frame);
    })(t0);
  }

  var SEEN_KEY = 'zelosLevelCelebrated';
  function celebrate(lv, opts) {
    if (typeof lv === 'number') lv = LEVELS[lv];
    if (!lv || lv.level < 1) return;
    opts = opts || {};
    try {
      var seen = parseInt(global.localStorage.getItem(SEEN_KEY) || '0', 10);
      if (seen >= lv.level && !opts.force) return;
      global.localStorage.setItem(SEEN_KEY, String(lv.level));
    } catch (e) { /* no storage: celebrate anyway */ }
    if (!document.body) return document.addEventListener('DOMContentLoaded', function () { celebrate(lv, opts); });
    injectStyle();
    var c = lv.colors;
    var ov = document.createElement('div');
    ov.className = 'zlv-overlay'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Level up: ' + lv.name);
    ov.style.setProperty('--zlv-c0', c[0]); ov.style.setProperty('--zlv-c2', c[2]); ov.style.setProperty('--zlv-glow', c[0] + '88');
    ov.innerHTML = '<div class="zlv-card"><div class="zlv-rays"></div>' +
      '<div class="zlv-badge-wrap">' + badge(lv, 116) + '</div>' +
      '<div class="zlv-kicker">Level ' + lv.level + ' unlocked</div>' +
      '<div class="zlv-title">LEVEL UP!</div>' +
      '<div class="zlv-sub">You\'re now <b>' + lv.name + '</b> &middot; ' + lv.title + '</div>' +
      (opts.xp != null ? '<div class="zlv-xp">' + (opts.gained ? '+' + opts.gained + ' XP &middot; ' : '') + opts.xp + ' XP total</div>' : '') +
      '<button class="zlv-btn" type="button">Keep trading &rarr;</button></div>';
    document.body.appendChild(ov);
    var card = ov.querySelector('.zlv-card');
    confetti(card, [c[0], c[2]]);
    var prevFocus = document.activeElement;
    function close() {
      if (!ov.isConnected) return;
      ov.remove(); document.removeEventListener('keydown', onKey);
      try { if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true }); } catch (e) {}
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.zlv-btn').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    try { ov.querySelector('.zlv-btn').focus({ preventScroll: true }); } catch (e) {}
    setTimeout(close, 9000);
  }

  global.ZelosLevels = { LEVELS: LEVELS, levelForXp: levelForXp, nextLevelForXp: nextLevelForXp, badge: badge, celebrate: celebrate };
})(window);
