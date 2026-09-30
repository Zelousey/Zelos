/*!
 * Zelos — icons instead of emoji.
 *
 * Emoji render differently on every device (and look like phone stickers on
 * most). This swaps the emoji the site uses for one consistent set of line
 * icons, drawn in the brand colors, wherever they appear: static HTML and
 * content scripts render later (toasts, leaderboards, cards). Places where an
 * icon can't go (form controls, <title>, canvas) keep their text.
 *
 * Add an icon: draw it on a 24x24 grid (stroke = currentColor) in ICONS and map
 * the emoji to it in MAP.
 */
(function (global) {
  'use strict';
  var d = global.document;
  var ICONS = {
    swords: '<path d="M4 4l9 9M4 4v3.5M4 4h3.5M20 4l-9 9M20 4v3.5M20 4h-3.5"/><path d="M8.5 15.5l-3 3M5 16l3 3M15.5 15.5l3 3M19 16l-3 3"/>',
    flame: '<path d="M12 3c1 3.5 5 5.2 5 10a5 5 0 0 1-10 0c0-2.2 1.1-3.6 2.3-4.8.3 1.6 1.2 2.6 2.2 2.8C11 9 11 6 12 3z"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M9 20h6M10 17h4"/>',
    medal: '<circle cx="12" cy="15" r="5"/><path d="M8.5 11 6 3h4l2 5 2-5h4l-2.5 8"/><path d="M12 13v4"/>',
    trendUp: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
    trendDown: '<path d="M3 7l6 6 4-4 8 8M15 17h6v-6"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 5.5 4.8"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    alarm: '<circle cx="12" cy="13" r="7"/><path d="M12 9.5V13l2.5 1.5M4 5l3-2M20 5l-3-2"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16zM10 20a2 2 0 0 0 4 0"/>',
    bellOff: '<path d="M6 16V11a6 6 0 0 1 9.3-5M18 11v5l1.5 2H8M10 20a2 2 0 0 0 4 0M3 3l18 18"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    bolt: '<path d="M13 3 5 13h6l-1 8 8-10h-6l1-8z"/>',
    dollar: '<path d="M12 3v18M16.5 7.5C16 6 14.3 5 12 5 9.5 5 8 6.3 8 8c0 4 8.5 2.5 8.5 7 0 1.8-1.7 3-4.5 3-2.4 0-4-1-4.6-2.6"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
    stop: '<path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2z"/><path d="M9 12h6"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.8"/>',
    crown: '<path d="M4 8l4 4 4-7 4 7 4-4-2 11H6L4 8z"/>',
    gem: '<path d="M6 4h12l3 5-9 11L3 9l3-5zM3 9h18M9 4l3 16M15 4l-3 16"/>',
    hourglass: '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5 5-2z"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/>',
    robot: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9.5 13h.01M14.5 13h.01M9.5 16h5"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    bank: '<path d="M3 9l9-5 9 5M5 9v9M9.7 9v9M14.3 9v9M19 9v9M3 20h18"/>',
    eye: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>',
    shield: '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
    thumb: '<path d="M7 11v9H4v-9h3zM7 11l4-7c1.5 0 2.4 1.2 2 2.7L12.3 10H18a2 2 0 0 1 2 2.3l-1.1 6A2 2 0 0 1 17 20H7"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14.5c1 1.4 2.4 2 4 2s3-.6 4-2M9 9.5h.01M15 9.5h.01"/>',
    camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
    skull: '<path d="M12 3a7.5 7.5 0 0 0-7.5 7.5c0 2.6 1.3 4.3 3 5.3V19a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-3.2c1.7-1 3-2.7 3-5.3A7.5 7.5 0 0 0 12 3z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/><path d="M10.5 20v-2M13.5 20v-2"/>',
    rocket: '<path d="M12 3c3 2 5 5.5 5 9.5L15 16H9l-2-3.5C7 8.5 9 5 12 3z"/><circle cx="12" cy="10" r="1.6"/><path d="M9 16l-2 4 3-1.5M15 16l2 4-3-1.5"/>'
  };
  // emoji -> [icon, color] (color null = inherit the text color)
  var MAP = {
    '⚔': ['swords', null], '🔥': ['flame', '#f59e0b'], '🏆': ['trophy', '#e8b23d'],
    '🥇': ['medal', '#e8b23d'], '🥈': ['medal', '#c0c7d2'], '🥉': ['medal', '#cd8a52'],
    '📈': ['trendUp', '#10b981'], '📉': ['trendDown', '#ef4444'], '✅': ['check', '#10b981'],
    '👥': ['users', null], '🏁': ['flag', null], '⏰': ['alarm', null], '🔔': ['bell', null],
    '🔕': ['bellOff', null], '🔒': ['lock', null], '⚡': ['bolt', '#f59e0b'], '💵': ['dollar', '#10b981'],
    '💰': ['dollar', '#10b981'], '📅': ['calendar', null], '🛑': ['stop', '#ef4444'], '🎯': ['target', null],
    '👑': ['crown', '#e8b23d'], '💎': ['gem', '#8f7bf6'], '🐂': ['trendUp', '#10b981'], '🐃': ['trendUp', '#10b981'],
    '⏳': ['hourglass', null], '⌛': ['hourglass', null], '🧭': ['compass', null], '🎲': ['dice', null],
    '🤖': ['robot', null], '💯': ['star', '#e8b23d'], '⭐': ['star', '#e8b23d'], '🏦': ['bank', null],
    '🦅': ['trendUp', null], '👁': ['eye', null], '🚀': ['rocket', null], '🎉': ['star', '#e8b23d'], '☠': ['skull', '#ef4444']
  };
  var keys = Object.keys(MAP).sort(function (a, b) { return b.length - a.length; });
  var RE = new RegExp('(' + keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')️?', 'g');
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, TITLE: 1, NOSCRIPT: 1, CANVAS: 1, SVG: 1, svg: 1, CODE: 1, PRE: 1 };

  function svg(name, color) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }
  function icon(name, color, label) { return '<span class="zi" role="img" aria-label="' + (label || name) + '">' + svg(name, color) + '</span>'; }
  function swapText(node) {
    var t = node.nodeValue; RE.lastIndex = 0; if (!RE.test(t)) return;
    var p = node.parentNode; if (!p || SKIP[p.nodeName] || (p.closest && p.closest('svg,select,textarea,[contenteditable="true"],.zi'))) return;
    var frag = d.createDocumentFragment(), last = 0; RE.lastIndex = 0; var m;
    while ((m = RE.exec(t))) {
      if (m.index > last) frag.appendChild(d.createTextNode(t.slice(last, m.index)));
      var def = MAP[m[1]], w = d.createElement('span'); w.innerHTML = icon(def[0], def[1]); frag.appendChild(w.firstChild);
      last = m.index + m[0].length;
    }
    if (last < t.length) frag.appendChild(d.createTextNode(t.slice(last)));
    p.replaceChild(frag, node);
  }
  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) return swapText(root);
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
    var w = d.createTreeWalker(root, 4, null), n, list = [];
    while ((n = w.nextNode())) list.push(n);
    list.forEach(swapText);
  }
  function style() {
    var s = d.createElement('style');
    s.textContent = '.zi{display:inline-block;width:1.08em;height:1.08em;vertical-align:-0.17em;line-height:1;flex-shrink:0}.zi svg{display:block;width:100%;height:100%}';
    d.head.appendChild(s);
  }
  var pending = [], raf = null;
  function flush() { raf = null; var l = pending; pending = []; l.forEach(scan); }
  function boot() {
    style(); scan(d.body);
    new MutationObserver(function (muts) {
      muts.forEach(function (m) { if (m.type === 'characterData') pending.push(m.target); else m.addedNodes.forEach(function (n) { pending.push(n); }); });
      if (!raf) raf = (global.requestAnimationFrame || setTimeout)(flush);
    }).observe(d.body, { childList: true, subtree: true, characterData: true });
  }
  global.ZelosIcons = { icon: icon, svg: svg, names: Object.keys(ICONS) };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
