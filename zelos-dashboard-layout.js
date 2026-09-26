/*!
 * Zelos — customizable dashboard layout (dashboard.html).
 *
 * Every `.card[data-widget]` inside #dashGrid is a widget. In "Customize"
 * mode each widget gets a small bar with a drag handle (reorder), width
 * buttons, a remove button, and a corner handle that resizes it (width snaps
 * to the 12-column grid, height snaps to 10px; double-click the corner to go
 * back to automatic height). Removed widgets can be brought back from
 * "+ Add widget".
 *
 * The layout — { order, hidden, size: { id: { w, h } }, updatedAt } — is saved
 * to localStorage on every change, and (via syncRemote, called by the
 * dashboard once a real account's user doc loads) to users/{uid}.dashboardLayout
 * in Firestore, so it follows the person across devices. Whichever copy has
 * the newer updatedAt wins.
 */
(function (global) {
  'use strict';

  var KEY = 'zelosDashLayout-v1';
  var WIDTHS = [3, 4, 6, 8, 9, 12];
  var ROW = 6, GAP = 18, MIN_H = 120;
  var grid, cards = {}, defaults = null, layout = null, editing = false, saver = null, saveTimer = null;

  function $(id) { return document.getElementById(id); }
  function read() { try { return JSON.parse(global.localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function write(l) { try { global.localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) { /* ignore */ } }

  function snapshotDefaults() {
    var order = [], size = {};
    grid.querySelectorAll(':scope > .card[data-widget]').forEach(function (c) {
      var id = c.getAttribute('data-widget');
      cards[id] = c; order.push(id); size[id] = { w: parseInt(c.getAttribute('data-w'), 10) || 4, h: null };
    });
    return { order: order, hidden: [], size: size, updatedAt: 0 };
  }

  // fills in widgets added to the page after a layout was saved, drops unknown ids
  function sanitize(l) {
    if (!l || !Array.isArray(l.order)) return JSON.parse(JSON.stringify(defaults));
    var out = { order: [], hidden: [], size: {}, updatedAt: +l.updatedAt || 0 };
    l.order.forEach(function (id) { if (cards[id] && out.order.indexOf(id) === -1) out.order.push(id); });
    defaults.order.forEach(function (id) { if (out.order.indexOf(id) === -1) out.order.push(id); });
    (l.hidden || []).forEach(function (id) { if (cards[id] && out.hidden.indexOf(id) === -1) out.hidden.push(id); });
    out.order.forEach(function (id) {
      var sz = (l.size && l.size[id]) || defaults.size[id];
      var w = Math.max(3, Math.min(12, parseInt(sz.w, 10) || defaults.size[id].w));
      var h = sz.h ? Math.max(MIN_H, Math.min(2000, parseInt(sz.h, 10))) : null;
      out.size[id] = { w: w, h: h };
    });
    return out;
  }

  function cols() { var w = global.innerWidth; return w > 1200 ? 12 : w > 820 ? 6 : 1; }
  function spanFor(w) {
    var c = cols();
    if (c === 12) return w;
    if (c === 6) return w <= 4 ? 6 : 12;
    return 12;
  }

  // Moves nodes only when they're out of place: re-inserting an iframe (the
  // TradingView chart) reloads it, so resizing never touches DOM order.
  function reorder() {
    var cur = Array.prototype.filter.call(grid.children, function (n) { return n.hasAttribute('data-widget'); })
      .map(function (n) { return n.getAttribute('data-widget'); });
    if (cur.join() === layout.order.join()) return;
    layout.order.forEach(function (id) { grid.appendChild(cards[id]); });
  }

  function apply() {
    reorder();
    layout.order.forEach(function (id) {
      var c = cards[id], sz = layout.size[id];
      c.style.setProperty('--span', spanFor(sz.w));
      if (sz.h && cols() !== 1) { c.classList.add('dw-fixed-h'); c.style.setProperty('--h', sz.h + 'px'); }
      else { c.classList.remove('dw-fixed-h'); c.style.removeProperty('--h'); }
      c.classList.toggle('dw-removed', layout.hidden.indexOf(id) !== -1);
      var wl = c.querySelector('.dw-wlabel'); if (wl) wl.textContent = sz.w + '/12';
    });
    packAll();
    renderAddMenu();
  }

  // masonry: each widget spans enough 6px rows for its real height
  function pack(c) {
    if (c.classList.contains('dw-removed') || c.hidden) return;
    var h = c.getBoundingClientRect().height;
    var span = Math.max(1, Math.ceil((h + GAP) / ROW));
    if (c._span !== span) { c._span = span; c.style.gridRowEnd = 'span ' + span; }
  }
  function packAll() { Object.keys(cards).forEach(function (id) { pack(cards[id]); }); }

  function save(quiet) {
    layout.updatedAt = Date.now();
    write(layout);
    var note = $('dashSaveNote');
    if (!quiet && note) note.textContent = saver ? 'Saving…' : 'Layout saved on this device';
    if (saver) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        Promise.resolve(saver(JSON.parse(JSON.stringify(layout)))).then(function () {
          if (note) note.textContent = 'Layout saved to your account';
        }).catch(function () { if (note) note.textContent = 'Saved on this device (couldn\'t reach your account)'; });
      }, 600);
    }
    // globe/TradingView frames listen for resize to re-fit
    try { global.dispatchEvent(new Event('resize')); } catch (e) { /* old browsers */ }
  }

  // ------------------------------------------------------------ edit chrome
  function addChrome(c) {
    if (c.querySelector(':scope > .dw-bar')) return;
    var id = c.getAttribute('data-widget');
    var bar = document.createElement('div');
    bar.className = 'dw-bar';
    bar.innerHTML = '<button class="dw-handle" type="button" aria-label="Drag to move ' + c.getAttribute('data-title') + '" title="Drag to move">&#10303;</button>' +
      '<span class="dw-name">' + c.getAttribute('data-title') + '</span>' +
      '<button class="dw-btn" type="button" data-act="narrow" title="Narrower" aria-label="Narrower">&minus;</button>' +
      '<span class="dw-wlabel"></span>' +
      '<button class="dw-btn" type="button" data-act="wider" title="Wider" aria-label="Wider">+</button>' +
      '<button class="dw-btn" type="button" data-act="autoh" title="Automatic height">Auto&nbsp;h</button>' +
      '<button class="dw-btn dw-remove" type="button" data-act="remove" title="Remove widget" aria-label="Remove ' + c.getAttribute('data-title') + '">&times;</button>';
    var rz = document.createElement('div');
    rz.className = 'dw-resize'; rz.title = 'Drag to resize · double-click for automatic height';
    c.insertBefore(bar, c.firstChild); c.appendChild(rz);
    bar.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act'); if (!act) return;
      var sz = layout.size[id];
      if (act === 'wider') sz.w = WIDTHS.filter(function (w) { return w > sz.w; })[0] || 12;
      else if (act === 'narrow') sz.w = WIDTHS.filter(function (w) { return w < sz.w; }).pop() || 3;
      else if (act === 'autoh') sz.h = null;
      else if (act === 'remove') { layout.hidden.push(id); }
      apply(); save();
    });
    bar.querySelector('.dw-handle').addEventListener('pointerdown', function (e) { startDrag(e, c); });
    rz.addEventListener('pointerdown', function (e) { startResize(e, c); });
    rz.addEventListener('dblclick', function () { layout.size[id].h = null; apply(); save(); });
    var wl = bar.querySelector('.dw-wlabel'); wl.textContent = layout.size[id].w + '/12';
  }
  function removeChrome(c) {
    var b = c.querySelector(':scope > .dw-bar'), r = c.querySelector(':scope > .dw-resize');
    if (b) b.remove(); if (r) r.remove();
  }

  function setEditing(on) {
    editing = on;
    grid.classList.toggle('is-editing', on);
    $('dashEditTools').hidden = !on;
    var btn = $('dashCustomize');
    btn.setAttribute('aria-pressed', String(on));
    btn.innerHTML = on ? '&#10003; Done' : '&#9998; Customize dashboard';
    btn.classList.toggle('btn-primary', on);
    Object.keys(cards).forEach(function (id) { if (on) addChrome(cards[id]); else removeChrome(cards[id]); });
    if (!on) { $('dashAddMenu').hidden = true; }
    packAll();
  }

  function renderAddMenu() {
    var menu = $('dashAddMenu'); if (!menu) return;
    if (!layout.hidden.length) { menu.innerHTML = '<div class="empty">Every widget is already on your dashboard.</div>'; return; }
    menu.innerHTML = layout.hidden.map(function (id) {
      return '<button type="button" data-add="' + id + '">+ ' + cards[id].getAttribute('data-title') + '</button>';
    }).join('');
  }

  // ------------------------------------------------------------ drag to reorder
  // Listeners go on document, not the handle: moving a node in the DOM drops
  // pointer capture. Only the dragged widget itself ever moves.
  function startDrag(e, c) {
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    c.classList.add('is-dragging'); document.body.classList.add('dw-dragging');
    function move(ev) {
      var el = document.elementFromPoint(ev.clientX, ev.clientY);
      var t = el && el.closest ? el.closest('#dashGrid > .card[data-widget]') : null;
      if (!t || t === c) return;
      var r = t.getBoundingClientRect();
      var wide = r.width > grid.getBoundingClientRect().width * 0.7;
      var before = wide ? ev.clientY < r.top + r.height / 2 : ev.clientX < r.left + r.width / 2;
      var ref = before ? t : t.nextElementSibling;
      if (ref === c || c.nextElementSibling === ref) return; // already there
      grid.insertBefore(c, ref);
      layout.order = Array.prototype.filter.call(grid.children, function (n) { return n.hasAttribute('data-widget'); })
        .map(function (n) { return n.getAttribute('data-widget'); });
      packAll();
    }
    function up() {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
      c.classList.remove('is-dragging'); document.body.classList.remove('dw-dragging');
      save();
    }
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  }

  // ------------------------------------------------------------ resize
  function startResize(e, c) {
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    var id = c.getAttribute('data-widget'), sz = layout.size[id];
    var gr = grid.getBoundingClientRect(), colW = (gr.width + GAP) / 12;
    var r0 = c.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
    document.body.classList.add('dw-resizing');
    function move(ev) {
      if (cols() === 12) sz.w = Math.max(3, Math.min(12, Math.round((r0.width + GAP + ev.clientX - x0) / colW)));
      sz.h = Math.max(MIN_H, Math.round((r0.height + ev.clientY - y0) / 10) * 10);
      apply();
    }
    function up() {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
      document.body.classList.remove('dw-resizing');
      save();
    }
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  }

  // ------------------------------------------------------------ account sync
  // remote: the saved users/{uid}.dashboardLayout (or null); fn: persists a layout
  // to the account (or null when signed out, which keeps saving to this device only)
  function syncRemote(remote, fn) {
    if (!grid) return;
    saver = fn;
    if (remote && (+remote.updatedAt || 0) > (layout.updatedAt || 0)) {
      layout = sanitize(remote); write(layout); apply();
    } else if (fn && layout.updatedAt && (!remote || (+remote.updatedAt || 0) < layout.updatedAt)) {
      // this device has newer edits than the account copy (e.g. made while signed out)
      Promise.resolve(fn(JSON.parse(JSON.stringify(layout)))).catch(function () {});
    }
  }

  function init() {
    grid = $('dashGrid'); if (!grid) return;
    defaults = snapshotDefaults();
    layout = sanitize(read());
    apply();
    $('dashCustomize').addEventListener('click', function () { setEditing(!editing); });
    $('dashReset').addEventListener('click', function () {
      layout = JSON.parse(JSON.stringify(defaults)); apply(); save();
      if (editing) Object.keys(cards).forEach(function (id) { removeChrome(cards[id]); addChrome(cards[id]); });
    });
    var addBtn = $('dashAddBtn'), menu = $('dashAddMenu');
    addBtn.addEventListener('click', function (e) { e.stopPropagation(); menu.hidden = !menu.hidden; addBtn.setAttribute('aria-expanded', String(!menu.hidden)); });
    menu.addEventListener('click', function (e) {
      var id = e.target.getAttribute && e.target.getAttribute('data-add'); if (!id) return;
      layout.hidden.splice(layout.hidden.indexOf(id), 1);
      layout.order.splice(layout.order.indexOf(id), 1); layout.order.push(id);
      apply(); save(); menu.hidden = true;
      try { cards[id].scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (err) {}
    });
    document.addEventListener('click', function (e) { if (!menu.hidden && !menu.contains(e.target) && e.target !== addBtn) menu.hidden = true; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && editing) setEditing(false); });
    if ('ResizeObserver' in global) {
      var ro = new ResizeObserver(function (entries) { entries.forEach(function (en) { pack(en.target); }); });
      Object.keys(cards).forEach(function (id) { ro.observe(cards[id]); });
    } else setInterval(packAll, 1000);
    // the progress card toggles `hidden` on sign-in/out
    if ('MutationObserver' in global) new MutationObserver(packAll).observe(grid, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
    var lastCols = cols();
    global.addEventListener('resize', function () { if (cols() !== lastCols) { lastCols = cols(); apply(); } });
  }

  global.ZelosDashLayout = { syncRemote: syncRemote, setEditing: function (on) { setEditing(!!on); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
