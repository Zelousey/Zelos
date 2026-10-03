/*
 * zelos-founder.js — Founder Program popup (Mockup 8): Captain Bull sails to Founder Island.
 *
 * Shown once to signed-in people who aren't in a community yet, on their third visit or after
 * they've placed a Trade War trade; never on the first page of a visit, never on Communities,
 * never while an order confirmation or another dialog is open.
 * "Not now" hides it for 14 days; closing it twice hides it for good. "Become a Founder" opens
 * Communities with the start form ready. Computers: corner card. Phones: bottom sheet.
 * The scene is drawn at 6 frames a second; with "reduce motion" on it shows the still final frame.
 * Loaded by zelos-tabbar.js after sign-in. Exposes window.ZelosFounder.show({force}).
 */
(function (global) {
  'use strict';
  if (global.ZelosFounder) return;
  var d = document, KEY = 'zelosFounderPop';
  var ROOT = /\/(learn|scan|practice|real|games)\//.test(location.pathname) ? '../' : '';

  // ------------------------------------------------------------ Captain Bull (32x32 pixel kit)
  // Zelos captain, bull edition: hand-built 32x32 pixel sprite. sprite(pose) -> 32x32 array of palette keys.
  // pose: { happy, open, patch:false, ring:true (off by default), emblem:'z'|'candles'|'arrow'|'none' }
  var PAL = { o:'#0c1230', h:'#1b2140', H:'#2e3866', g:'#f0b434', y:'#ffd970', G:'#b07a12', b:'#4a8bf5', l:'#8db8ff', d:'#2c5fcc', s:'#cfe0ff', S:'#a9c4f0',
    w:'#ffffff', p:'#0a0e1c', k:'#ff8fb1', m:'#8a2340', c:'#22386c', C:'#16264f', i:'#f3ead2', I:'#c9bc98', e:'#0c1230', r:'#ef5350', q:'#2ecc71' };
  function sprite(pose) {
    pose = pose || {};
    var W = 32, g = []; for (var y = 0; y < W; y++) { g.push([]); for (var x = 0; x < W; x++) g[y].push('.'); }
    function set(x, y, v) { if (x >= 0 && y >= 0 && x < W && y < W) g[y][x] = v; }
    function ell(cx, cy, rx, ry, v, f) { for (var y = 0; y < W; y++) for (var x = 0; x < W; x++) { var dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry; if (dx * dx + dy * dy <= 1 && (!f || f(x, y))) set(x, y, typeof v === 'function' ? v(x, y) : v); } }
    function rect(x0, y0, x1, y1, v) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) set(x, y, v); }
    function mirror(pts, v) { pts.forEach(function (p) { set(p[0], p[1], v); set(31 - p[0], p[1], v); }); }
    // tail: thin line with a dark tuft
    [[23,27],[24,27],[25,26],[26,25],[26,24],[27,23]].forEach(function (p) { set(p[0], p[1], 'b'); });
    set(27, 22, 'C'); set(28, 22, 'C'); set(28, 23, 'C'); set(27, 21, 'C');
    // body / coat, feet (hooves), arms
    ell(16, 26.5, 6.8, 5.2, function (x) { return x < 16 ? 'c' : 'C'; }, function (x, y) { return y <= 29; });
    rect(11, 29, 14, 30, 'b'); rect(17, 29, 20, 30, 'b'); rect(11, 30, 14, 30, 'C'); rect(17, 30, 20, 30, 'C');
    ell(9.3, 25.5, 1.8, 2.3, 'c'); ell(9, 27.6, 1.5, 1.2, 'b'); ell(22.7, 25.5, 1.8, 2.3, 'c'); ell(23, 27.6, 1.5, 1.2, 'b');
    set(13, 22, 'w'); set(14, 22, 'w'); set(15, 23, 'w'); set(16, 23, 'w'); set(17, 22, 'w'); set(18, 22, 'w');
    set(13, 25, 'g'); set(13, 27, 'g'); set(18, 25, 'g'); set(18, 27, 'g');
    // floppy ears below the horns
    mirror([[5,15],[4,15],[3,15],[4,16],[5,16],[6,16]], 'b'); mirror([[4,15],[5,16]], 'k');
    // head: broad, a touch squarer than the cat
    ell(16, 16, 10.4, 7.6, function (x, y) { return (y >= 22 || (x >= 24 && y >= 15)) ? 'd' : 'b'; });
    // big snout
    ell(16, 20.2, 6.2, 3.1, function (x, y) { return y >= 22 ? 'S' : 's'; });
    // hat: crown + brim + gold trim + upturned tips
    ell(16, 9, 7.2, 6.2, function (x, y) { return (x >= 11 && x <= 13 && y <= 6) ? 'H' : 'h'; }, function (x, y) { return y <= 9; });
    rect(8, 9, 23, 9, 'h'); rect(6, 10, 25, 10, 'h'); rect(6, 11, 25, 11, 'g'); set(7, 9, 'h'); set(24, 9, 'h');
    // horns: from the sides of the head, out past the brim, curving up (ivory, darker base)
    mirror([[5,13],[6,13],[4,12],[5,12],[3,11],[4,11],[2,10],[3,10],[2,9],[3,9],[2,8],[3,8],[3,7],[4,6]], 'i');
    mirror([[5,13],[6,13],[5,12]], 'I'); mirror([[3,8],[3,9]], 'w');
    // emblem on the hat (choice)
    var em = pose.emblem || 'z';
    if (em === 'z') { rect(14, 4, 17, 4, 'y'); set(17, 5, 'g'); set(16, 5, 'g'); set(15, 6, 'g'); set(14, 6, 'g'); rect(14, 7, 17, 7, 'g'); }
    if (em === 'candles') { set(13, 3, 'w'); set(13, 4, 'q'); set(14, 4, 'q'); set(14, 5, 'q'); set(15, 5, 'q'); set(15, 6, 'q'); set(16, 6, 'q'); set(16, 7, 'q'); set(17, 7, 'q'); set(18, 8, 'w'); set(18, 3, 'w'); set(18, 4, 'r'); set(17, 4, 'r'); set(17, 5, 'r'); set(16, 5, 'r'); set(14, 7, 'r'); set(15, 7, 'r'); set(14, 6, 'r'); set(13, 8, 'w'); }
    if (em === 'arrow') { [[12,8],[13,7],[14,6],[15,7],[16,6],[17,5],[18,4]].forEach(function (q) { set(q[0], q[1], 'g'); }); set(19, 3, 'y'); set(18, 3, 'y'); set(17, 3, 'y'); set(19, 4, 'y'); set(19, 5, 'y'); set(12, 8, 'G'); }
    // outline pass
    var out = g.map(function (r) { return r.slice(); });
    for (var y2 = 0; y2 < W; y2++) for (var x2 = 0; x2 < W; x2++) if (g[y2][x2] === '.') {
      if ([[1,0],[-1,0],[0,1],[0,-1]].some(function (d) { var yy = y2 + d[1], xx = x2 + d[0]; return yy >= 0 && xx >= 0 && yy < W && xx < W && g[yy][xx] !== '.'; })) out[y2][x2] = 'o'; }
    g = out;
    // face: patch over the left eye (strap across the brow), bright right eye
    function eye(x0) { rect(x0, 14, x0 + 2, 16, 'e'); set(x0, 14, 'w'); set(x0 + 1, 14, 'w'); set(x0, 15, 'w'); }
    if (pose.patch !== false) {
      rect(9, 14, 13, 16, 'p'); rect(10, 13, 12, 17, 'p'); set(10, 14, 'H');
      [[5,12],[6,12],[7,12],[8,13],[9,13],[13,13],[14,12],[15,12],[16,12],[17,12],[18,12],[19,12],[20,12],[21,12],[22,12],[23,12],[24,12],[25,12],[26,12]].forEach(function (p) { if (g[p[1]][p[0]] !== 'p') set(p[0], p[1], 'p'); });
    } else if (pose.happy) { set(9, 16, 'e'); set(10, 15, 'e'); set(11, 15, 'e'); set(12, 16, 'e'); } else eye(10);
    if (pose.happy) { set(19, 16, 'e'); set(20, 15, 'e'); set(21, 15, 'e'); set(22, 16, 'e'); } else eye(19);
    // two big nostrils; a gold ring through the septum hangs down past the chin onto the chest
    rect(12, 19, 13, 20, 'o'); rect(18, 19, 19, 20, 'o'); set(12, 19, 'h'); set(19, 19, 'h');
    if (pose.ring === true) {
      set(15, 21, 'y'); set(16, 21, 'y');
      set(14, 22, 'y'); set(17, 22, 'g'); set(14, 23, 'g'); set(17, 23, 'G');
      set(15, 24, 'G'); set(16, 24, 'G');
    } else if (pose.open) { rect(14, 22, 17, 22, 'o'); set(15, 22, 'k'); set(16, 22, 'k'); }
    set(7, 18, 'k'); set(8, 18, 'k'); set(23, 18, 'k'); set(24, 18, 'k');   // cheeks
    return g;
  }
  function drawSprite(canvas, pose, scale) {
    var g = sprite(pose), S = scale || 8; canvas.width = 32 * S; canvas.height = 32 * S;
    var x = canvas.getContext('2d'); x.imageSmoothingEnabled = false;
    g.forEach(function (r, yy) { r.forEach(function (v, xx) { if (v !== '.') { x.fillStyle = PAL[v]; x.fillRect(xx * S, yy * S, S, S); } }); });
  }

  // ------------------------------------------------------------ Founder Island scene
  var SCENE_EMBLEM = 'z';
  // Founder Program scene: the captain sails to the island. drawScene(canvas, t, S): t = seconds since open.
  var SC = { W: 136, H: 76 };
  function drawScene(cv, t, S) {
    S = S || 3; var W = SC.W, H = SC.H;
    if (cv.width !== W * S) { cv.width = W * S; cv.height = H * S; }
    var x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
    function px(a, b, c) { x.fillStyle = c; x.fillRect(Math.round(a) * S, Math.round(b) * S, S, S); }
    function rect(a, b, w, h, c) { x.fillStyle = c; x.fillRect(Math.round(a) * S, Math.round(b) * S, w * S, h * S); }
    var HZ = 44, f = Math.floor(t * 6); // 6 fps pixel steps
    // sky bands (dusk navy -> violet -> warm horizon)
    [['#0d1433', 0, 12], ['#141c45', 12, 9], ['#1f2558', 21, 8], ['#33306b', 29, 6], ['#523a78', 35, 4], ['#7a4a7c', 39, 3], ['#b0647a', 42, 2]].forEach(function (b) { rect(0, b[1], W, b[2], b[0]); });
    // dither between bands
    for (var i = 0; i < W; i += 2) { px(i, 12, '#0d1433'); px(i + 1, 21, '#141c45'); px(i, 29, '#1f2558'); px(i + 1, 35, '#33306b'); px(i, 39, '#523a78'); }
    // stars (twinkle)
    [[8,4],[22,9],[37,3],[52,7],[70,2],[88,6],[103,3],[118,8],[128,4],[44,14],[96,13]].forEach(function (s, k) { if ((f + k * 3) % 11) px(s[0], s[1], (f + k) % 7 ? '#8fa6e8' : '#ffffff'); });
    // moon
    rect(112, 9, 5, 5, '#f4e7c6'); rect(113, 8, 3, 1, '#f4e7c6'); rect(113, 14, 3, 1, '#f4e7c6'); rect(111, 10, 1, 3, '#f4e7c6'); rect(117, 10, 1, 3, '#f4e7c6'); px(113, 10, '#d9c9a2'); px(115, 12, '#d9c9a2');
    // clouds drifting
    function cloud(cx, cy) { rect(cx, cy, 12, 2, '#3a3f7a'); rect(cx + 2, cy - 1, 7, 1, '#3a3f7a'); rect(cx + 3, cy - 2, 4, 1, '#46508c'); rect(cx + 1, cy - 1, 1, 1, '#46508c'); }
    cloud(((t * 2) % (W + 30)) - 20, 20); cloud(((t * 1.3 + 70) % (W + 30)) - 20, 28);
    // island (right), palm, Founder flag
    var IX = 98;
    rect(IX, HZ - 4, 30, 4, '#c9a25e'); rect(IX + 3, HZ - 6, 24, 2, '#3e8a52'); rect(IX + 6, HZ - 8, 16, 2, '#4fa463'); rect(IX + 9, HZ - 9, 9, 1, '#5cb871'); rect(IX - 2, HZ - 1, 34, 1, '#e0bd78');
    // palm
    rect(IX + 9, HZ - 20, 1, 12, '#7a5530'); rect(IX + 10, HZ - 18, 1, 4, '#7a5530');
    [[-4,-21],[-3,-22],[-2,-22],[-1,-21],[0,-21],[1,-22],[2,-22],[3,-21],[4,-20],[-5,-20],[5,-19],[-6,-19],[0,-23],[1,-23]].forEach(function (p) { px(IX + 9 + p[0], HZ + p[1], '#3e8a52'); });
    // flag pole + waving gold flag with the bar mark
    rect(IX + 19, HZ - 22, 1, 14, '#d8d8e0');
    var wv = f % 2;
    rect(IX + 20, HZ - 22, 7, 4, '#f0b434'); rect(IX + 27, HZ - 22 + wv, 1, 4 - wv, '#f0b434'); rect(IX + 20, HZ - 18, 7, 1, '#c98a1f');
    rect(IX + 21, HZ - 21, 4, 1, '#173a8f'); px(IX + 23, HZ - 20, '#173a8f'); px(IX + 22, HZ - 20, '#173a8f'); rect(IX + 21, HZ - 19, 4, 1, '#173a8f');
    // sparkle over the island
    var sp = (f % 12);
    if (sp < 6) { var sx = IX + 30, sy = HZ - 26; px(sx, sy, '#fff6c8'); if (sp > 1 && sp < 5) { px(sx - 1, sy, '#ffd970'); px(sx + 1, sy, '#ffd970'); px(sx, sy - 1, '#ffd970'); px(sx, sy + 1, '#ffd970'); } }
    // sea bands + moving wave highlights
    [['#1b3a7a', HZ, 6], ['#173170', HZ + 6, 8], ['#132a62', HZ + 14, 10], ['#0f2254', HZ + 24, 8]].forEach(function (b) { rect(0, b[1], W, b[2], b[0]); });
    rect(0, HZ, W, 1, '#b0647a');
    for (var r = 0; r < 4; r++) { var yy = HZ + 3 + r * 7, off = (f * (r + 1)) % 16; for (var xx = -16; xx < W; xx += 16) { rect(xx + off + (r % 2) * 7, yy, 3 + r, 1, r < 2 ? '#3f6fc4' : '#2f5aa8'); } }
    // moon reflection
    for (var k = 0; k < 4; k++) if ((f + k) % 3) rect(112 + (k % 2), HZ + 3 + k * 4, 3, 1, '#9a8f8a');
    // boat: sails in from the left over 3.5 s, then bobs near the island
    var travel = Math.min(1, t / 3.5), ease = 1 - Math.pow(1 - travel, 3);
    var BX = Math.round(-46 + ease * 78), bob = Math.round(Math.sin(t * 3.2) * 1), BY = HZ + 13 + bob;
    // mast + sail (behind the captain, sail billowing toward the island)
    rect(BX + 30, BY - 34, 1, 34, '#6b4423'); rect(BX + 29, BY - 35, 3, 1, '#f0b434');
    for (var k2 = 0; k2 < 22; k2++) { var w2 = Math.round(Math.sin((k2 + 1) / 23 * Math.PI) * 11) + 1; rect(BX + 31, BY - 33 + k2, w2, 1, k2 % 7 === 6 ? '#d9d2bf' : '#f2ecda'); }
    rect(BX + 34, BY - 25, 5, 1, '#3f74e8'); px(BX + 37, BY - 24, '#3f74e8'); px(BX + 36, BY - 23, '#3f74e8'); px(BX + 35, BY - 22, '#3f74e8'); rect(BX + 34, BY - 21, 5, 1, '#3f74e8');
    // captain (sprite rows 2..23) seated in the boat
    if (typeof sprite === 'function') { var g = sprite(Math.floor(t * 1.2) % 5 === 4 ? { happy: 1, open: 1, emblem: SCENE_EMBLEM } : { emblem: SCENE_EMBLEM }), CX = BX + 2, CY = BY - 21;
      for (var ry = 2; ry < 24; ry++) for (var rx = 0; rx < 32; rx++) { var v = g[ry][rx]; if (v !== '.') px(CX + rx, CY + ry - 2, PAL[v]); } }
    // hull: curved, raised bow on the right, gold rail
    var L = BX - 2, R = BX + 44;
    for (var hy = 0; hy < 8; hy++) { var inset = Math.round(hy * hy / 9); rect(L + inset + 1, BY + hy, (R - L) - inset * 2 - 1, 1, hy === 0 ? '#f0b434' : hy % 3 === 0 ? '#6b4423' : '#8b5a2b'); px(L + inset, BY + hy, '#0c1230'); px(R - inset, BY + hy, '#0c1230'); }
    rect(L + 6, BY + 8, R - L - 11, 1, '#0c1230');
    rect(R - 2, BY - 3, 2, 3, '#8b5a2b'); px(R, BY - 3, '#0c1230'); px(R, BY - 2, '#0c1230'); px(R, BY - 1, '#0c1230'); rect(R - 2, BY - 4, 3, 1, '#0c1230'); px(R - 1, BY - 3, '#f0b434');
    rect(L, BY - 2, 2, 2, '#8b5a2b'); rect(L, BY - 3, 2, 1, '#0c1230');
    rect(L + 8, BY + 3, 2, 2, '#f0b434'); rect(L + 20, BY + 3, 2, 2, '#f0b434'); rect(L + 32, BY + 3, 2, 2, '#f0b434');
    // water line + wake
    rect(L - 1, BY + 7, R - L + 3, 1, '#3f6fc4'); if (travel < 1) { rect(L - 4 - (f % 3), BY + 6, 3, 1, '#a9c8ff'); rect(L - 9 - (f % 4), BY + 7, 2, 1, '#6f95d8'); }
  }

  // ------------------------------------------------------------ when to show
  function state() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  // a "visit" = a browser session; the page count says whether this is the first page of the visit
  function countVisit() {
    var s = state(), pages = 0;
    try { pages = +(sessionStorage.getItem(KEY + 'Pages') || 0) + 1; sessionStorage.setItem(KEY + 'Pages', String(pages)); } catch (e) { pages = 2; }
    if (pages === 1) { s.visits = (s.visits || 0) + 1; save(s); }
    return pages;
  }
  function traded() {
    try { var a = JSON.parse(localStorage.getItem('zelosPractice-v1') || 'null'); return !!(a && ((a.fills && a.fills.length) || (a.life && a.life.fills))); } catch (e) { return false; }
  }
  var BUSY = '#ptConfirm:not([hidden]), .zc-back, .ziv-back, .zlv-overlay, .zt-back, .zp-card, .zo-back, .auth-pop';
  function maybe(uid) {
    var pages = countVisit(), s = state();
    if (s.done || (s.closes || 0) >= 2 || (s.until && Date.now() < s.until)) return;
    if (/communities\.html$/.test(location.pathname) || pages < 2) return;
    if ((s.visits || 0) < 3 && !traded()) return;
    if (!global.firebase || typeof firebase.firestore !== 'function') return;
    firebase.firestore().collection('communityMembers').doc(uid).get().then(function (snap) {
      var m = snap.exists ? snap.data() : null;
      if (m && (m.cid || m.founded)) { var s2 = state(); s2.done = true; save(s2); return; }
      setTimeout(function () { whenFree(show, 0); }, 2500);
    }, function () {});
  }
  function whenFree(fn, n) { if (!d.querySelector(BUSY) || n > 75) return fn(); setTimeout(function () { whenFree(fn, n + 1); }, 1500); }

  // ------------------------------------------------------------ the popup
  function css() {
    if (d.getElementById('zf-style')) return;
    var st = d.createElement('style'); st.id = 'zf-style';
    st.textContent =
      '.zf-pop{position:fixed;right:22px;bottom:22px;z-index:9003;width:min(400px,calc(100vw - 44px));overflow:hidden;background:#14161c;color:#f4f5f7;border:1px solid rgba(240,180,52,.45);border-radius:4px;box-shadow:0 30px 70px rgba(0,0,0,.6);font-family:var(--sans,system-ui,sans-serif);animation:zf-rise .45s cubic-bezier(.2,.8,.2,1) both}' +
      '@keyframes zf-rise{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}' +
      '.zf-pop canvas{display:block;width:100%;height:auto;image-rendering:pixelated}' +
      '.zf-x{position:absolute;top:10px;right:10px;width:30px;height:30px;border-radius:2px;border:0;background:rgba(11,12,16,.6);color:#f4f5f7;font-size:18px;line-height:1;cursor:pointer}' +
      '.zf-body{padding:16px 18px 18px;display:flex;flex-direction:column;gap:10px}' +
      '.zf-k{font:700 11px var(--mono,ui-monospace,monospace);letter-spacing:.16em;color:#f0b434}' +
      '.zf-body h3{margin:0;font-size:21px;letter-spacing:-.01em}.zf-body p{margin:0;font-size:14px;line-height:1.5;color:#cfd3da}' +
      '.zf-miles{display:flex;gap:6px;flex-wrap:wrap}.zf-miles span{font:600 11px var(--mono,ui-monospace,monospace);padding:4px 8px;border-radius:2px;border:1px solid #262a34;color:#9599a3}' +
      '.zf-miles span.is-first{border-color:rgba(240,180,52,.6);color:#f0b434;background:rgba(240,180,52,.08)}' +
      '.zf-acts{display:flex;gap:8px;margin-top:4px}.zf-btn{flex:1;font:700 14px var(--sans,system-ui,sans-serif);padding:12px 14px;border-radius:2px;border:1px solid #262a34;background:#1a1d25;color:#f4f5f7;cursor:pointer;text-align:center;text-decoration:none}' +
      '.zf-btn.zf-go{background:linear-gradient(180deg,#f6c453,#d99a1e);border-color:transparent;color:#1a1204}' +
      '.zf-btn:focus-visible,.zf-x:focus-visible{outline:2px solid #4a86ff;outline-offset:2px}.zf-fine{font-size:12px;color:#9599a3}' +
      '.zf-grab{display:none}' +
      '@media (max-width:760px){.zf-pop{left:0;right:0;bottom:0;width:auto;border-radius:0;border-width:1px 0 0;padding-bottom:calc(64px + env(safe-area-inset-bottom));box-shadow:0 -20px 60px rgba(0,0,0,.6)}' +
      '.zf-grab{display:block;position:absolute;top:7px;left:50%;transform:translateX(-50%);width:38px;height:5px;border-radius:3px;background:rgba(255,255,255,.5);z-index:2}.zf-miles,.zf-fine{display:none}.zf-body h3{font-size:20px}}' +
      '@media (prefers-reduced-motion:reduce){.zf-pop{animation:none}}';
    d.head.appendChild(st);
  }
  var open = null;
  function show(opts) {
    if (open || !d.body) return;
    css();
    var phone = global.matchMedia && matchMedia('(max-width:760px)').matches;
    var el = d.createElement('div'); el.className = 'zf-pop'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-labelledby', 'zfTitle');
    el.innerHTML = '<span class="zf-grab" aria-hidden="true"></span>' +
      '<canvas width="408" height="228" role="img" aria-label="Captain Bull sails a small boat toward an island with a gold Founder flag"></canvas>' +
      '<button class="zf-x" type="button" aria-label="Close">&times;</button>' +
      '<div class="zf-body"><span class="zf-k">FOUNDER PROGRAM</span><h3 id="zfTitle">Claim your island</h3>' +
      (phone ? '<p>Bring 5 real traders to your community and become a Founder: 250 tokens + a permanent badge.</p>'
             : '<p>Start a trading community, bring 5 real traders, and become an official Founder: <b>250 tokens</b> and a permanent Founder badge.</p>') +
      '<div class="zf-miles"><span class="is-first">5 &middot; Founder</span><span>10</span><span>25</span><span>50</span><span>100</span></div>' +
      '<div class="zf-acts"><a class="zf-btn zf-go" href="' + ROOT + 'practice/communities.html#start">Become a Founder</a><button class="zf-btn zf-later" type="button">Not now</button></div>' +
      '<span class="zf-fine">Free. Just a name and your state.</span></div>';
    d.body.appendChild(el); open = el;
    var cv = el.querySelector('canvas'), reduce = global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, t0 = performance.now(), last = -1, alive = true;
    function frame(now) {
      if (!alive) return;
      var t = reduce ? 6 : (now - t0) / 1000, step = Math.floor(t * 6);
      if (step !== last) { last = step; drawScene(cv, t, 3); }
      if (!reduce) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    function close(kind) {
      if (!alive) return; alive = false; open = null;
      var s = state();
      if (kind === 'go') s.done = true;
      else { s.closes = (s.closes || 0) + 1; s.until = Date.now() + 14 * 864e5; }
      if (!(opts && opts.force)) save(s);
      el.remove(); d.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close('later'); }
    d.addEventListener('keydown', onKey);
    el.querySelector('.zf-x').onclick = function () { close('later'); };
    el.querySelector('.zf-later').onclick = function () { close('later'); };
    el.querySelector('.zf-go').addEventListener('click', function () { close('go'); });
    // phones: swipe the sheet down to close
    var y0 = null;
    el.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchmove', function (e) { if (y0 == null) return; var dy = e.touches[0].clientY - y0; if (dy > 0) el.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
    el.addEventListener('touchend', function (e) { if (y0 == null) return; var dy = e.changedTouches[0].clientY - y0; y0 = null; if (dy > 80) close('later'); else el.style.transform = ''; });
  }

  global.ZelosFounder = { show: show, maybe: maybe, sprite: sprite, drawSprite: drawSprite, drawScene: drawScene };
})(window);
