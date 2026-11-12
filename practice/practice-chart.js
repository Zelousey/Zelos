/*!
 * Zelos Practice Account: full candlestick chart with indicators.
 *
 * Indicators are a registry (INDICATORS below): each entry says whether it's
 * an overlay on the price pane or gets its own pane, how to compute it, and
 * how to draw it. Adding an indicator = adding one entry.
 *
 * Also: volume, cost-basis / open-order lines, your fills, the live price tag,
 * forecast stop-loss / take-profit boxes (green = target, red = stop), zoom
 * and pan, and a crosshair legend with every visible value.
 *
 * Trade War chart tools (Phase 6):
 *   - forecast.editable: the SL / TP edges can be dragged; onForecastEdit(forecast,
 *     which) fires when a drag ends. forecast.side 'sell' flips the plan (TP
 *     below the entry, SL above). A drag can't cross the entry.
 *   - fib: Fibonacci retracement across the visible swing high / low.
 *   - alerts: [{ id, price, dir: 'above'|'below' }] drawn as labelled Trade War
 *     alert lines; drag one to move it (onAlertMove(alert)). placing = 'alert'
 *     turns the next click into onPlaceAlert(price).
 *   - abc: Three-Legged Strategy (A-B-C pullback) drawing { pts: [{ d, p }] } -
 *     start, end of leg A, end of B, end of C. placing = 'abc' adds one point per
 *     click (snapped to the nearest candle's high or low); after three points the
 *     likely end of leg C is projected (100%-161.8% of leg A from B); after four,
 *     onAbcDone(abc) fires. Points are stored by date so they survive zooming.
 *   - shapes: coach "plays" and the stock page's drawings [{ k: line|ray|arrow|box|hline|hray|vline|measure|text, c: blue|green|red|gold,
 *     pts: [{ d, p }], text }] drawn over the chart; shapeDraft is the one being drawn.
 *     pointAt(x, y) -> { d, p } turns a pointer position into a bar date and a price.
 */
(function (global) {
  'use strict';

  function cssVar(n, fb) { try { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || fb; } catch (e) { return fb; } }
  function fmt(n, d) { return (n == null || isNaN(n)) ? '–' : Number(n).toFixed(d == null ? 2 : d); }
  function fmtVol(v) { return v == null || !v ? '–' : v >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : String(v); }

  // ------------------------------------------------------------ math
  function sma(a, n) { var o = new Array(a.length), s = 0; for (var i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; o[i] = i >= n - 1 ? s / n : null; } return o; }
  function ema(a, n) { var o = new Array(a.length), k = 2 / (n + 1), p = null; for (var i = 0; i < a.length; i++) { if (a[i] == null) { o[i] = null; continue; } p = p == null ? a[i] : a[i] * k + p * (1 - k); o[i] = i >= n - 1 ? p : null; } return o; }
  function bollinger(a, n, m) {
    var mid = sma(a, n), up = new Array(a.length), lo = new Array(a.length);
    for (var i = 0; i < a.length; i++) {
      if (mid[i] == null) { up[i] = lo[i] = null; continue; }
      var v = 0; for (var k = i - n + 1; k <= i; k++) v += (a[k] - mid[i]) * (a[k] - mid[i]);
      var sd = Math.sqrt(v / n); up[i] = mid[i] + m * sd; lo[i] = mid[i] - m * sd;
    }
    return { mid: mid, up: up, lo: lo };
  }
  function rsi(a, n) {
    var o = new Array(a.length).fill(null), g = 0, l = 0;
    for (var i = 1; i < a.length; i++) {
      var ch = a[i] - a[i - 1], up = Math.max(ch, 0), dn = Math.max(-ch, 0);
      if (i <= n) { g += up; l += dn; if (i === n) { g /= n; l /= n; o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } }
      else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
    }
    return o;
  }
  function macd(a) {
    var f = ema(a, 12), s = ema(a, 26), line = a.map(function (_, i) { return f[i] != null && s[i] != null ? f[i] - s[i] : null; });
    var start = line.findIndex(function (v) { return v != null; });
    var sig = new Array(a.length).fill(null);
    if (start >= 0) { var e = ema(line.slice(start), 9); for (var i = 0; i < e.length; i++) sig[start + i] = e[i]; }
    return { line: line, signal: sig, hist: line.map(function (v, i) { return v != null && sig[i] != null ? v - sig[i] : null; }) };
  }
  function stoch(s, n, d) {
    var k = new Array(s.n).fill(null);
    for (var i = n - 1; i < s.n; i++) {
      var hh = -Infinity, ll = Infinity;
      for (var j = i - n + 1; j <= i; j++) { hh = Math.max(hh, s.h[j]); ll = Math.min(ll, s.l[j]); }
      k[i] = hh === ll ? 50 : (s.c[i] - ll) / (hh - ll) * 100;
    }
    var dd = sma(k.map(function (v) { return v == null ? 0 : v; }), d).map(function (v, i) { return i >= n + d - 2 ? v : null; });
    return { k: k, d: dd };
  }
  function atr(s, n) {
    var o = new Array(s.n).fill(null), prev = null;
    for (var i = 0; i < s.n; i++) {
      var tr = i ? Math.max(s.h[i] - s.l[i], Math.abs(s.h[i] - s.c[i - 1]), Math.abs(s.l[i] - s.c[i - 1])) : s.h[i] - s.l[i];
      prev = prev == null ? tr : (prev * (n - 1) + tr) / n;
      o[i] = i >= n ? prev : null;
    }
    return o;
  }
  // VWAP: the volume-weighted average price, starting again each trading day (intraday charts only)
  function vwap(s) {
    var o = new Array(s.n), day = null, pv = 0, vv = 0;
    for (var i = 0; i < s.n; i++) {
      if (!s.intraday) { o[i] = null; continue; }
      var d = s.d[i].slice(0, 10); if (d !== day) { day = d; pv = 0; vv = 0; }
      var v = s.v[i] || 0; pv += (s.h[i] + s.l[i] + s.c[i]) / 3 * v; vv += v;
      o[i] = vv ? pv / vv : null;
    }
    return o;
  }
  function obv(s) { var o = new Array(s.n), t = 0; for (var i = 0; i < s.n; i++) { if (i) t += s.c[i] > s.c[i - 1] ? s.v[i] : s.c[i] < s.c[i - 1] ? -s.v[i] : 0; o[i] = t; } return o; }
  function donchian(s, n) {
    var up = new Array(s.n).fill(null), lo = new Array(s.n).fill(null);
    for (var i = n - 1; i < s.n; i++) { var hh = -Infinity, ll = Infinity; for (var j = i - n + 1; j <= i; j++) { hh = Math.max(hh, s.h[j]); ll = Math.min(ll, s.l[j]); } up[i] = hh; lo[i] = ll; }
    return { up: up, lo: lo };
  }

  // ------------------------------------------------------------ indicator registry
  // kind: 'overlay' (drawn on price), 'pane' (own panel below), 'volume'.
  // lines: [key, color, width] for simple overlays; compute(s) fills s.ind[id].
  var INDICATORS = [
    { id: 'vol', label: 'Volume', kind: 'volume', group: 'Price' },
    { id: 'sma20', need: 20, label: 'SMA 20', kind: 'overlay', group: 'Moving averages', color: 'accent', compute: function (s) { return sma(s.c, 20); } },
    { id: 'sma50', need: 50, label: 'SMA 50', kind: 'overlay', group: 'Moving averages', color: 'gold', compute: function (s) { return sma(s.c, 50); } },
    { id: 'sma200', need: 200, label: 'SMA 200', kind: 'overlay', group: 'Moving averages', color: '#f472b6', compute: function (s) { return sma(s.c, 200); } },
    { id: 'ema9', need: 9, label: 'EMA 9', kind: 'overlay', group: 'Moving averages', color: 'violet', compute: function (s) { return ema(s.c, 9); } },
    { id: 'ema21', need: 21, label: 'EMA 21', kind: 'overlay', group: 'Moving averages', color: '#22d3ee', compute: function (s) { return ema(s.c, 21); } },
    { id: 'vwap', label: 'VWAP', kind: 'overlay', group: 'Moving averages', color: '#7dd3fc', compute: function (s) { return vwap(s); }, intradayOnly: true },
    { id: 'bb', need: 20, label: 'Bollinger Bands (20, 2)', kind: 'overlay', group: 'Bands', color: 'violet', compute: function (s) { return bollinger(s.c, 20, 2); },
      band: ['up', 'lo', 'mid'] },
    { id: 'dc', need: 20, label: 'Donchian Channel (20)', kind: 'overlay', group: 'Bands', color: '#f59e0b', compute: function (s) { return donchian(s, 20); }, band: ['up', 'lo'] },
    { id: 'rsi', need: 15, label: 'RSI (14)', kind: 'pane', group: 'Oscillators', range: [0, 100], levels: [30, 70], compute: function (s) { return rsi(s.c, 14); }, lines: [[null, 'violet']] },
    { id: 'stoch', need: 16, label: 'Stochastic (14, 3)', kind: 'pane', group: 'Oscillators', range: [0, 100], levels: [20, 80], compute: function (s) { return stoch(s, 14, 3); }, lines: [['k', 'accent'], ['d', 'gold']] },
    { id: 'macd', need: 34, label: 'MACD (12, 26, 9)', kind: 'pane', group: 'Oscillators', zero: true, compute: function (s) { return macd(s.c); }, lines: [['line', 'accent'], ['signal', 'gold']], hist: 'hist' },
    { id: 'atr', need: 15, label: 'ATR (14)', kind: 'pane', group: 'Volatility & volume', compute: function (s) { return atr(s, 14); }, lines: [[null, '#f59e0b']] },
    { id: 'obv', label: 'On-Balance Volume', kind: 'pane', group: 'Volatility & volume', compute: function (s) { return obv(s); }, lines: [[null, '#22d3ee']], needsVolume: true }
  ];
  var BY_ID = {}; INDICATORS.forEach(function (d) { BY_ID[d.id] = d; });
  function computeIndicators(s) {
    s.ind = {};
    INDICATORS.forEach(function (d) { if (d.compute) s.ind[d.id] = d.compute(s); });
    // kept for callers that read these directly
    s.sma20 = s.ind.sma20; s.sma50 = s.ind.sma50; s.rsi = s.ind.rsi;
    return s;
  }

  // ------------------------------------------------------------ candle colors
  // Shared with the Arcade charts (games/zelos-chart-engine.js reads the same key).
  var COLOR_KEY = 'zelosChartColors';
  var PRESETS = [
    { id: 'classic', name: 'Green / Red', up: '#3ecb7c', down: '#e0483f' },
    { id: 'bluewhite', name: 'Blue / White', up: '#4a86ff', down: '#e8eaef' },
    { id: 'tv', name: 'Teal / Coral', up: '#26a69a', down: '#ef5350' },
    { id: 'cb', name: 'Blue / Orange (color-blind safe)', up: '#3b82f6', down: '#f59e0b' },
    { id: 'purple', name: 'Purple / Gold', up: '#a78bfa', down: '#fbbf24' },
    { id: 'neon', name: 'Cyan / Magenta', up: '#22d3ee', down: '#f472b6' },
    { id: 'mono', name: 'White / Gray', up: '#f4f5f7', down: '#6b7280' },
    { id: 'lime', name: 'Lime / Crimson', up: '#a3e635', down: '#dc2626' }
  ];
  function loadColors() {
    try { var c = JSON.parse(localStorage.getItem(COLOR_KEY) || 'null'); if (c && /^#[0-9a-f]{6}$/i.test(c.up) && /^#[0-9a-f]{6}$/i.test(c.down)) return c; } catch (e) {}
    return { id: 'classic', up: PRESETS[0].up, down: PRESETS[0].down };
  }
  function saveColors(c) { try { localStorage.setItem(COLOR_KEY, JSON.stringify(c)); } catch (e) {} }
  // Chart themes bought with tokens (owner 2026-10-23; cosmetics/{uid}.chart, mirrored here by
  // zelos-tokens.js and the app): background, grid, text and candle colours. The free colour
  // presets above still work when no theme is on.
  var THEME_KEY = 'zelosChartTheme';
  var THEMES = {
    midnight: { bg: '#0b1630', grid: 'rgba(120,160,255,0.10)', ink: '#e6ecff', muted: '#8ea0c8', up: '#5eead4', down: '#f472b6', light: false },
    paper: { bg: '#f6f1e4', grid: 'rgba(60,40,20,0.10)', ink: '#2b2418', muted: '#7a6e5a', up: '#1f7a4d', down: '#b42318', light: true },
    neon: { bg: '#05010d', grid: 'rgba(255,0,200,0.12)', ink: '#f5f5ff', muted: '#a09ac0', up: '#39ff14', down: '#ff2bd6', light: false }
  };
  function loadTheme() { try { return THEMES[localStorage.getItem(THEME_KEY)] || null; } catch (e) { return null; } }
  function setTheme(id) {
    try { if (THEMES[id]) localStorage.setItem(THEME_KEY, id); else localStorage.removeItem(THEME_KEY); } catch (e) {}
    try { global.dispatchEvent(new Event('zelos:theme')); } catch (e) {}
  }
  function rgba(hex, a) { if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex; var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
  // Indicator colours (owner 2026-11-11, Settings): volume, Bollinger Bands, RSI, MACD line and
  // signal. Empty means the default; volume's default follows the candle colours.
  var IND_COLOR_KEY = 'zelosIndColors';
  function hexOk(x) { return typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x); }
  function loadIndColors() {
    try { var v = JSON.parse(localStorage.getItem(IND_COLOR_KEY) || 'null'); if (v && typeof v === 'object') return v; } catch (e) {}
    return {};
  }
  function saveIndColors(v) { try { localStorage.setItem(IND_COLOR_KEY, JSON.stringify(v || {})); } catch (e) {} }
  // Chart types (owner's step 2). 'line' is the live line coloured against the previous close.
  var CHART_TYPES = ['candles', 'hollow', 'volcandles', 'bars', 'heikin', 'line', 'linemarkers', 'step', 'area', 'hlcarea', 'baseline', 'columns', 'highlow'];
  var CLOSE_ONLY = { line: 1, linemarkers: 1, step: 1, area: 1, baseline: 1, columns: 1 };
  function heikinAshi(s) {
    var o = [], h = [], l = [], c = [];
    for (var i = 0; i < s.n; i++) {
      var cc = (s.o[i] + s.h[i] + s.l[i] + s.c[i]) / 4, oo = i ? (o[i - 1] + c[i - 1]) / 2 : (s.o[i] + s.c[i]) / 2;
      o.push(oo); c.push(cc); h.push(Math.max(s.h[i], oo, cc)); l.push(Math.min(s.l[i], oo, cc));
    }
    return { o: o, h: h, l: l, c: c };
  }
  function lum(hex) { if (!/^#[0-9a-f]{6}$/i.test(hex)) return 0.5; var n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; }

  // ------------------------------------------------------------ chart
  var DEFAULT_ON = { vol: true, sma20: true, sma50: true, rsi: true };
  function TradeChart(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.s = null; this.from = 0; this.to = 0; this.hover = null;
    this.show = {}; var saved = null;
    try { saved = JSON.parse(localStorage.getItem('zelosPracticeInd') || 'null'); } catch (e) {}
    var self0 = this; INDICATORS.forEach(function (d) { self0.show[d.id] = saved ? !!saved[d.id] : !!DEFAULT_ON[d.id]; });
    this.lines = []; this.lastPrice = null; this.marks = []; this.colors = loadColors(); this.empty = null;
    // 'line' (Robinhood-style live line, the default) or 'candles'; refPrice = previous close (line color + dotted line)
    // candles are the default everywhere (owner 2026-10-27); a saved choice still wins
    this.style = 'candles'; try { var st0 = localStorage.getItem('zelosChartStyle'); if (CHART_TYPES.indexOf(st0) >= 0) this.style = st0; } catch (e) {}
    this.indColors = loadIndColors();
    this.refPrice = null; this.anim = null; this.pulse = null;
    this.forecast = null; // { entry, sl, tp, label, side, editable } -> green / red boxes right of the last bar
    this.fib = false; this.alerts = []; this.placing = null; this.geo = null; this.frozen = null; this.abc = null; this.onAbcDone = null;
    this.shapes = []; this.shapeDraft = null; this.futureRoom = 0;
    this.compare = null; // { label, color, r: [ratio per bar, or null] }: a line to compare with, started at this stock's price
    this.onForecastEdit = null; this.onAlertMove = null; this.onPlaceAlert = null;
    var self = this, drag = null;
    canvas.__ztc = this; // lets the browser tests read the visible range
    function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    // touch (owner 2026-11-10: pinching and dragging on a phone was hard): every finger is tracked,
    // two fingers pinch-zoom around their midpoint (and pan as they move), one finger drags sideways,
    // a double tap goes back to the chosen range
    var fingers = {}, pinch = null, lastTap = null;
    function fingerList() { return Object.keys(fingers).map(function (k) { return fingers[k]; }); }
    function startPinch() {
      var f = fingerList(); if (f.length < 2 || !self.s) return;
      var L = self.layout(), w = L.x1 - L.x0;
      var mid = (f[0].x + f[1].x) / 2, rel = Math.max(0, Math.min(1, (mid - L.x0) / w));
      var span = self.to - self.from + 1;
      pinch = { d0: Math.max(24, Math.abs(f[0].x - f[1].x)), span: span, anchor: self.from + rel * span };
      drag = null; self.frozen = null; self.fullDay = null;
    }
    canvas.addEventListener('pointerdown', function (e) {
      var p = pos(e);
      if (e.pointerType === 'touch') {
        fingers[e.pointerId] = p;
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        if (fingerList().length >= 2) { startPinch(); return; }
        var now = Date.now();
        if (lastTap && now - lastTap.t < 320 && Math.abs(p.x - lastTap.x) < 30 && Math.abs(p.y - lastTap.y) < 30 && self._range && !self.placing) {
          lastTap = null; self.setRange(self._range[0], self._range[1]); return;
        }
        lastTap = { t: now, x: p.x, y: p.y };
      }
      var hit = self.hitTest(p);
      if (self.placing === 'abc' && self.geo && self.s && p.y >= self.geo.L.y0 && p.y <= self.geo.L.y1) {
        var bi = self.barAt(p.x), up = Math.abs(self.geo.Y(self.s.h[bi]) - p.y) < Math.abs(self.geo.Y(self.s.l[bi]) - p.y);
        if (!self.abc || self.abc.pts.length >= 4) self.abc = { pts: [] };
        self.abc.pts.push({ d: self.s.d[bi], p: up ? self.s.h[bi] : self.s.l[bi] });
        if (self.abc.pts.length === 4) { self.placing = null; canvas.style.cursor = ''; if (self.onAbcDone) self.onAbcDone(self.abc); }
        self.draw(); return;
      }
      if (self.placing === 'alert' && self.geo && p.y >= self.geo.L.y0 && p.y <= self.geo.L.y1) {
        var price = self.priceAt(p.y); self.placing = null; canvas.style.cursor = '';
        if (self.onPlaceAlert) self.onPlaceAlert(Math.round(price * 100) / 100);
        return;
      }
      if (hit) { drag = { handle: hit }; self.frozen = { lo: self.geo.lo, hi: self.geo.hi }; }
      else drag = { x: p.x, from: self.from, to: self.to };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    });
    canvas.addEventListener('pointermove', function (e) {
      var p = pos(e);
      if (e.pointerType === 'touch' && fingers[e.pointerId]) fingers[e.pointerId] = p;
      if (pinch && self.s) {
        var f = fingerList(); if (f.length < 2) return;
        var L = self.layout(), w = L.x1 - L.x0, n = self.s.n;
        var d = Math.max(24, Math.abs(f[0].x - f[1].x));
        var ns = Math.max(Math.min(8, n), Math.min(n, Math.round(pinch.span * pinch.d0 / d)));
        var rel = Math.max(0, Math.min(1, ((f[0].x + f[1].x) / 2 - L.x0) / w));
        var from = Math.round(pinch.anchor - rel * ns);
        from = Math.max(0, Math.min(n - ns, from));
        self.from = from; self.to = from + ns - 1; self.hover = null; self.draw();
        return;
      }
      if (drag && drag.handle) { self.dragHandle(drag.handle, p.y); }
      else if (drag && self.s) {
        if (Math.abs(drag.x - p.x) > 6) lastTap = null;
        var bw = self.barW(); var shift = Math.round((drag.x - p.x) / bw);
        var span = drag.to - drag.from;
        var to = Math.max(span, Math.min(self.s.n - 1, drag.to + shift));
        self.from = to - span; self.to = to;
      } else canvas.style.cursor = self.placing ? 'crosshair' : self.hitTest(p) ? 'ns-resize' : '';
      if (self.placing === 'abc') canvas.style.cursor = 'crosshair';
      self.hover = p; self.draw();
    });
    function end(e) {
      if (e && e.pointerType === 'touch') {
        delete fingers[e.pointerId];
        var left = fingerList();
        if (pinch) {
          if (left.length >= 2) { startPinch(); return; }
          pinch = null;
          // one finger still down: carry on as a sideways drag from where it is
          drag = left.length === 1 ? { x: left[0].x, from: self.from, to: self.to } : null;
          return;
        }
      }
      if (drag && drag.handle) {
        var h = drag.handle; self.frozen = null;
        if (h.kind === 'forecast' && self.onForecastEdit) self.onForecastEdit(self.forecast, h.which);
        if (h.kind === 'alert' && self.onAlertMove) self.onAlertMove(h.alert);
        self.draw();
      }
      drag = null;
    }
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    // the page must not take the gesture: two fingers are always the chart's; one finger is the
    // chart's once it moves more sideways than up/down (a mostly vertical swipe still scrolls the page)
    var axis = null, t0 = null;
    canvas.addEventListener('touchstart', function (e) {
      axis = e.touches.length >= 2 ? 'chart' : null;
      t0 = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    }, { passive: true });
    canvas.addEventListener('touchmove', function (e) {
      if (e.touches.length >= 2) axis = 'chart';
      else if (!axis && t0) {
        var dx = Math.abs(e.touches[0].clientX - t0.x), dy = Math.abs(e.touches[0].clientY - t0.y);
        if (dx > 4 || dy > 4) axis = dx >= dy || drag && drag.handle ? 'chart' : 'page';
      }
      if (axis === 'chart' && e.cancelable) e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('pointerleave', function () { if (!drag) { self.hover = null; self.draw(); } });
    canvas.addEventListener('wheel', function (e) {
      if (!self.s) return; e.preventDefault();
      self.zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, pos(e).x);
    }, { passive: false });
    this._onResize = function () { self.resize(); };
    // a theme or candle-colour change (Settings, the token shop) repaints every open chart
    this._onTheme = function () { self.colors = loadColors(); self.indColors = loadIndColors(); self.draw(); };
    if ('ResizeObserver' in global) { this._ro = new ResizeObserver(this._onResize); this._ro.observe(canvas); }
    else global.addEventListener('resize', this._onResize);
    global.addEventListener('zelos:theme', this._onTheme);
    this.resize();
  }
  // Stop observing the canvas and the window (the app calls this when a chart screen closes).
  TradeChart.prototype.destroy = function () {
    if (this._ro) this._ro.disconnect(); else global.removeEventListener('resize', this._onResize);
    global.removeEventListener('zelos:theme', this._onTheme);
    this.anim = null; this.s = null;
  };
  TradeChart.prototype.toggle = function (id, on) {
    this.show[id] = on == null ? !this.show[id] : !!on;
    try { localStorage.setItem('zelosPracticeInd', JSON.stringify(this.show)); } catch (e) {}
    this.draw();
  };
  TradeChart.prototype.barAt = function (x) {
    var g = this.geo, i = this.from + Math.floor((x - g.L.x0) / g.bw);
    return Math.max(this.from, Math.min(Math.min(this.to, this.s.n - 1), i));
  };
  TradeChart.prototype.priceAt = function (y) {
    var g = this.geo; return g.hi - (y - g.L.y0) / (g.L.y1 - g.L.y0) * (g.hi - g.lo);
  };
  // a pointer position as { d: bar date, p: price } (null off the price panel)
  TradeChart.prototype.pointAt = function (x, y) {
    var g = this.geo; if (!g || !this.s || y < g.L.y0 || y > g.L.y1) return null;
    var p = this.priceAt(y); if (!(p > 0)) return null;
    var last = this.s.n - 1, raw = this.from + Math.floor((x - g.L.x0) / g.bw);
    if (this.to === last && raw > last) return { d: this.s.d[last], p: Math.round(p * 100) / 100, f: raw - last };
    return { d: this.s.d[this.barAt(x)], p: Math.round(p * 100) / 100 };
  };
  // draggable things under the pointer: forecast SL / TP edges, then alert lines
  TradeChart.prototype.hitTest = function (p) {
    var g = this.geo; if (!g || !this.s) return null;
    var F = this.forecast, R = 7;
    if (F && F.editable && F.entry && p.x >= g.fx0 - 4 && p.x <= g.L.x1 + 64) {
      var best = null;
      ['sl', 'tp'].forEach(function (k) { if (F[k] != null) { var d = Math.abs(g.Y(F[k]) - p.y); if (d <= R && (!best || d < best.d)) best = { kind: 'forecast', which: k, d: d }; } });
      if (best) return best;
    }
    if (this.onAlertMove && p.x >= g.L.x0) {
      for (var i = 0; i < this.alerts.length; i++) { var a = this.alerts[i]; if (Math.abs(g.Y(a.price) - p.y) <= R - 2) return { kind: 'alert', alert: a }; }
    }
    return null;
  };
  TradeChart.prototype.dragHandle = function (h, y) {
    var v = Math.round(this.priceAt(y) * 100) / 100; if (!(v > 0)) return;
    if (h.kind === 'alert') { h.alert.price = v; return; }
    var F = this.forecast, e = F.entry, tick = Math.max(0.01, e * 0.001), sell = F.side === 'sell';
    // SL stays on the losing side of the entry, TP on the winning side (flipped for a sell)
    var below = (h.which === 'sl') !== sell;
    F[h.which] = below ? Math.min(v, e - tick) : Math.max(v, e + tick);
    F[h.which] = Math.round(F[h.which] * 100) / 100;
  };
  TradeChart.prototype.resize = function () {
    var dpr = Math.min(global.devicePixelRatio || 1, 2), w = this.cv.clientWidth, h = this.cv.clientHeight;
    if (!w || !h) return;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.W = w; this.H = h; this.dpr = dpr; this.draw();
  };
  TradeChart.prototype.setStyle = function (st) {
    this.style = CHART_TYPES.indexOf(st) >= 0 ? st : 'candles'; try { localStorage.setItem('zelosChartStyle', this.style); } catch (e) {} this.draw();
  };
  TradeChart.prototype.setSeries = function (s, bars, daySlots) {
    // a new live price on the same chart glides there (line view) instead of jumping
    if (this.s && this.s.key === s.key && s.n && this.s.n) {
      var was = this.anim ? this.animValue() : this.s.c[this.s.n - 1], now = s.c[s.n - 1];
      if (was !== now && this.style === 'line' && !(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches)) this.startAnim(was, now);
    }
    // same stock and timeframe, scrolled to the latest bar: stay pinned to the right edge as bars arrive
    var keep = this.s && this.s.key === s.key && this.to === this.s.n - 1;
    var span = this.s ? this.to - this.from : null;
    this.s = s;
    if (keep && span != null && !this.fullDay) { this.to = s.n - 1; this.from = Math.max(0, this.to - span); this.draw(); }
    else if (keep && this.fullDay) { this.to = s.n - 1; this.draw(); } // a new bar joins today's session
    else this.setRange(bars || 126, daySlots);
  };
  TradeChart.prototype.startAnim = function (a, b) {
    var self = this; this.anim = { a: a, b: b, t0: (global.performance || Date).now() };
    function step() { if (!self.anim) return; self.draw(); if ((global.performance || Date).now() - self.anim.t0 < 600) requestAnimationFrame(step); else { self.anim = null; self.draw(); } }
    requestAnimationFrame(step);
  };
  TradeChart.prototype.animValue = function () {
    if (!this.anim) return null; var k = Math.min(1, ((global.performance || Date).now() - this.anim.t0) / 600); k = 1 - Math.pow(1 - k, 3);
    return this.anim.a + (this.anim.b - this.anim.a) * k;
  };
  // daySlots (intraday "1D"): show only the latest session and keep room for the whole of it, so a
  // session in progress doesn't stretch its first bars across the chart (owner 2026-11-10)
  TradeChart.prototype.setRange = function (bars, daySlots) {
    if (!this.s) return;
    this._range = [bars, daySlots]; // a double tap comes back here
    this.to = this.s.n - 1; this.fullDay = null;
    if (daySlots && this.s.intraday && this.s.n) {
      var day = this.s.d[this.to].slice(0, 10), f = this.to;
      while (f > 0 && this.s.d[f - 1].slice(0, 10) === day) f--;
      this.from = f; this.fullDay = daySlots;
    } else this.from = bars === 'all' ? 0 : Math.max(0, this.to - bars + 1);
    this.draw();
  };
  TradeChart.prototype.zoom = function (f, x) {
    if (!this.s) return;
    var span = this.to - this.from + 1, ns = Math.max(Math.min(8, this.s.n), Math.min(this.s.n, Math.round(span * f)));
    var L = this.layout(), rel = x == null ? 1 : Math.max(0, Math.min(1, (x - L.x0) / (L.x1 - L.x0)));
    var anchor = this.from + rel * span, from = Math.round(anchor - rel * ns);
    from = Math.max(0, Math.min(this.s.n - ns, from));
    this.from = from; this.to = from + ns - 1; this.fullDay = null; this.draw();
  };
  TradeChart.prototype.padBars = function () {
    var span = this.to - this.from + 1, base = this.forecast ? Math.max(8, Math.round(span * 0.16)) : 3;
    if (this.s && this.to === this.s.n - 1) {
      var need = this.futureRoom || 0, sd = this.s.d;
      (this.shapes || []).forEach(function (sh) {
        if (sh.k === 'pattern' && sh.pts.length === 2) need = Math.max(need, Math.abs(sd.indexOf(sh.pts[1].d) - sd.indexOf(sh.pts[0].d)) + 1);
        (sh.pts || []).forEach(function (q) { if (q.f) need = Math.max(need, q.f); });
      });
      if (need) base = Math.max(base, Math.min(need + 2, Math.round(span * 0.8)));
    }
    return this.fullDay && span < this.fullDay ? Math.max(base, this.fullDay - span) : base;
  };
  TradeChart.prototype.barW = function () { var L = this.layout(); return (L.x1 - L.x0) / (this.to - this.from + 1 + this.padBars()); };
  TradeChart.prototype.panes = function () {
    var self = this;
    return INDICATORS.filter(function (d) { return d.kind === 'pane' && self.show[d.id]; }).slice(0, 3);
  };
  TradeChart.prototype.layout = function () {
    var padR = 64, top = 8 + 19 * (this.legendRows || 1) + 6, bottom = 20, gap = 4, H = this.H, panes = this.panes();
    var subH = panes.length ? Math.max(60, Math.round(H * (panes.length > 2 ? 0.14 : 0.17))) : 0;
    var priceB = H - bottom - panes.length * (subH + gap);
    var L = { x0: 8, x1: this.W - padR, y0: top, y1: priceB, panes: [], vol: null };
    // volume: faint bars along the bottom of the price area, behind the candles (the price scale
    // leaves room for them, see draw)
    if (this.show.vol && this.style !== 'line' && this.s && this.s.v.some(function (v) { return v > 0; })) {
      var vh = Math.max(28, Math.round((priceB - top) * 0.2));
      L.vol = { y0: priceB - vh, y1: priceB };
    }
    var y = priceB + gap;
    panes.forEach(function (d) { L.panes.push({ def: d, y0: y, y1: y + subH }); y += subH + gap; });
    L.xAxis = H - 4;
    return L;
  };
  // the live dot's pulse is a CSS element over the canvas, so nothing redraws every frame
  TradeChart.prototype.placePulse = function (p) {
    var host = this.cv.parentNode; if (!host) return;
    if (!p) { if (this.pulse) this.pulse.style.display = 'none'; return; }
    if (!this.pulse) {
      if (!document.getElementById('ztcPulseCss')) { var st = document.createElement('style'); st.id = 'ztcPulseCss'; st.textContent = '.ztc-pulse{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;pointer-events:none;animation:ztcPulse 1.6s ease-out infinite}@keyframes ztcPulse{0%{box-shadow:0 0 0 0 var(--ztc-pc)}100%{box-shadow:0 0 0 14px transparent}}@media (prefers-reduced-motion:reduce){.ztc-pulse{animation:none}}'; document.head.appendChild(st); }
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      this.pulse = document.createElement('span'); this.pulse.className = 'ztc-pulse'; this.pulse.setAttribute('aria-hidden', 'true'); host.appendChild(this.pulse);
    }
    var ox = this.cv.offsetLeft, oy = this.cv.offsetTop;
    this.pulse.style.display = ''; this.pulse.style.left = (ox + p.x) + 'px'; this.pulse.style.top = (oy + p.y) + 'px';
    this.pulse.style.setProperty('--ztc-pc', rgba(p.c, 0.55));
  };
  function col(name, fb) {
    if (!name) return fb;
    if (name.charAt(0) === '#') return name;
    return cssVar('--' + name, fb);
  }
  TradeChart.prototype.draw = function () {
    var c = this.ctx, s = this.s; if (!this.W) return;
    if (this.empty || !s || !s.n) {
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.W, this.H);
      c.fillStyle = cssVar('--muted', '#8a8f98'); c.font = '500 13px "IBM Plex Sans", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      var msg = this.empty || 'No data yet', words = msg.split(' '), line = '', y = this.H / 2 - 10, lines = [];
      words.forEach(function (w) { if (c.measureText(line + w).width > Math.min(460, this.W - 40) && line) { lines.push(line); line = ''; } line += w + ' '; }, this);
      lines.push(line);
      lines.forEach(function (l, k) { c.fillText(l.trim(), this.W / 2, y + k * 20 - (lines.length - 1) * 10); }, this);
      c.textAlign = 'left'; return;
    }
    var L = this.layout(), self = this, show = this.show;
    var th = loadTheme();
    var bull = th ? th.up : this.colors.up, bear = th ? th.down : this.colors.down, acc = cssVar('--accent', '#4a86ff');
    var lightBg = th ? th.light : document.documentElement.getAttribute('data-theme') === 'white';
    var muted = th ? th.muted : cssVar('--muted', '#8a8f98'), green = '#3ecb7c', red = '#e0483f';
    var ink = th ? th.ink : cssVar('--ink', '#f4f5f7'), grid = th ? th.grid : cssVar('--chart-grid', 'rgba(255,255,255,0.06)'), cross = cssVar('--chart-cross', 'rgba(255,255,255,0.35)');
    var tagInk = cssVar('--chart-label-ink', '#0b0c0f'), bg = th ? th.bg : cssVar('--bg', '#0c0d10');
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.W, this.H);
    if (th) { c.fillStyle = th.bg; c.fillRect(0, 0, this.W, this.H); }
    var bw = this.barW(), from = this.from, to = this.to;
    function X(i) { return L.x0 + (i - from + 0.5) * bw; }
    var overlays = INDICATORS.filter(function (d) { return d.kind === 'overlay' && show[d.id]; });
    // price range: candles, visible overlays, lines, forecast
    var lo = Infinity, hi = -Infinity, vmax = 0, i;
    var ST = this.style, lineMode = ST === 'line', closeOnly = !!CLOSE_ONLY[ST], IC = this.indColors || {};
    var SO = s.o, SH = s.h, SL = s.l, SC = s.c;
    if (ST === 'heikin') { if (!s._ha) s._ha = heikinAshi(s); SO = s._ha.o; SH = s._ha.h; SL = s._ha.l; SC = s._ha.c; }
    for (i = from; i <= to; i++) {
      if (closeOnly) { lo = Math.min(lo, s.c[i]); hi = Math.max(hi, s.c[i]); } else { lo = Math.min(lo, SL[i]); hi = Math.max(hi, SH[i]); }
      vmax = Math.max(vmax, s.v[i] || 0);
    }
    // averages and bands may widen the price range by a quarter at most; past that they run off
    // the edge (clipped) instead of squashing the candles into a thin strip
    var slack = Math.max((hi - lo) * 0.25, hi * 0.002), olo = lo - slack, ohi = hi + slack;
    for (i = from; i <= to; i++) {
      overlays.forEach(function (d) {
        var v = s.ind[d.id];
        (d.band ? d.band.map(function (k) { return v[k][i]; }) : [v[i]]).forEach(function (x) { if (x != null) { lo = Math.min(lo, Math.max(x, olo)); hi = Math.max(hi, Math.min(x, ohi)); } });
      });
    }
    var CMP = this.compare && this.compare.r && this.compare.r.length === s.n ? this.compare : null, cmpAt = null;
    if (CMP) {
      var c0 = null; for (i = from; i <= to; i++) if (CMP.r[i] != null) { c0 = i; break; }
      if (c0 != null) {
        var base0 = s.c[c0] / CMP.r[c0];
        cmpAt = function (k) { return CMP.r[k] == null ? null : CMP.r[k] * base0; };
        for (i = from; i <= to; i++) { var cv = cmpAt(i); if (cv != null) { lo = Math.min(lo, Math.max(cv, olo)); hi = Math.max(hi, Math.min(cv, ohi)); } }
      }
    }
    this.lines.forEach(function (ln) { if (ln.price > lo * 0.8 && ln.price < hi * 1.25) { lo = Math.min(lo, ln.price); hi = Math.max(hi, ln.price); } });
    if (this.forecast) [this.forecast.sl, this.forecast.tp].forEach(function (v) { if (v) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    this.alerts.forEach(function (a) { if (a.price > lo * 0.8 && a.price < hi * 1.25) { lo = Math.min(lo, a.price); hi = Math.max(hi, a.price); } });
    this.shapes.forEach(function (sh) { (sh.pts || []).forEach(function (q) { if (q.p > lo * 0.8 && q.p < hi * 1.25) { lo = Math.min(lo, q.p); hi = Math.max(hi, q.p); } }); });
    if (lineMode && this.refPrice && this.refPrice > lo * 0.97 && this.refPrice < hi * 1.03) { lo = Math.min(lo, this.refPrice); hi = Math.max(hi, this.refPrice); }
    var pad = (hi - lo) * (lineMode ? 0.12 : 0.06) || (lineMode ? hi * 0.004 : 1); lo -= pad; hi += pad;
    if (L.vol) lo -= (hi - lo) * 0.22; // the volume bars sit in the bottom fifth
    if (this.frozen) { lo = this.frozen.lo; hi = this.frozen.hi; } // keep the scale still while dragging
    function Y(p) { return L.y0 + (hi - p) / (hi - lo) * (L.y1 - L.y0); }
    this.geo = { L: L, lo: lo, hi: hi, Y: Y, bw: bw, fx0: X(Math.min(to, s.n - 1)) + bw * 0.7 };
    c.font = '500 11px "IBM Plex Sans", system-ui, -apple-system, sans-serif'; c.textBaseline = 'middle';
    // grid + price axis: faint horizontal lines only, labels down the right
    var step = niceStep((hi - lo) / 7), gTop = L.y0, gBot = L.vol ? L.vol.y0 : L.y1;
    c.globalAlpha = 0.6;
    for (var g = Math.ceil(lo / step) * step; g < hi; g += step) {
      var gy = Math.round(Y(g)) + 0.5; if (gy < gTop || gy > gBot) continue;
      c.strokeStyle = grid; c.lineWidth = 1; c.beginPath(); c.moveTo(L.x0, gy); c.lineTo(L.x1, gy); c.stroke();
    }
    c.globalAlpha = 1;
    for (g = Math.ceil(lo / step) * step; g < hi; g += step) {
      var gy2 = Y(g); if (gy2 < gTop + 4 || gy2 > gBot) continue;
      c.fillStyle = muted; c.fillText(fmt(g, g >= 1000 ? 0 : 2), L.x1 + 8, gy2);
    }
    // time axis
    c.textBaseline = 'alphabetic';
    var lastM = null, MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], lastX = -1e9;
    // intraday: every day gets its label first; hour labels fill in where they don't crowd one
    var dayXs = [];
    if (s.intraday) {
      for (i = from; i <= to; i++) {
        var day = s.d[i].slice(0, 10);
        if (day === lastM) continue;
        lastM = day;
        var ix = X(i); if (ix - lastX < 44) continue; lastX = ix; dayXs.push(ix);
        c.fillStyle = ink; c.fillText(MN[parseInt(day.slice(5, 7), 10) - 1] + ' ' + parseInt(day.slice(8, 10), 10), ix + 3, L.xAxis);
      }
      lastX = -1e9;
    }
    for (i = from; i <= to; i++) {
      if (s.intraday) {
        var hr = s.d[i].slice(11, 13);
        if (i === from || s.d[i - 1].slice(0, 10) !== s.d[i].slice(0, 10) || s.d[i - 1].slice(11, 13) === hr) continue;
        var hx0 = X(i);
        if (hx0 - lastX < 36 || dayXs.some(function (dx) { return Math.abs(hx0 - dx) < 46; })) continue;
        lastX = hx0;
        c.fillStyle = muted; c.fillText(s.d[i].slice(11, 16), hx0 + 3, L.xAxis);
        continue;
      }
      var m = s.d[i].slice(0, 7);
      if (m !== lastM) {
        lastM = m; var mx = X(i);
        if (mx - lastX > 46) {
          lastX = mx;
          var lab = MN[parseInt(s.d[i].slice(5, 7), 10) - 1] + (s.d[i].slice(5, 7) === '01' ? ' ' + s.d[i].slice(0, 4) : '');
          c.fillStyle = muted; c.fillText(lab, mx + 3, L.xAxis);
        }
      }
    }
    c.textBaseline = 'middle';
    function pathLine(arr, color, w, alpha, dash) {
      c.strokeStyle = color; c.lineWidth = w || 1.3; c.globalAlpha = alpha == null ? 0.9 : alpha; c.setLineDash(dash || []);
      c.beginPath(); var pen = false;
      for (var k = from; k <= to; k++) { if (arr[k] == null) { pen = false; continue; } var x = X(k), y = Y(arr[k]); if (!pen) { c.moveTo(x, y); pen = true; } else c.lineTo(x, y); }
      c.stroke(); c.globalAlpha = 1; c.setLineDash([]);
    }
    // band fills under the candles (overlays are clipped to the price area)
    c.save(); c.beginPath(); c.rect(L.x0, L.y0, L.x1 - L.x0, L.y1 - L.y0); c.clip();
    overlays.forEach(function (d) {
      if (!d.band) return;
      var v = s.ind[d.id], cc = d.id === 'bb' && hexOk(IC.bb) ? IC.bb : col(d.color, '#8f7bf6');
      c.beginPath(); var started = false;
      for (var k = from; k <= to; k++) { if (v.up[k] == null) continue; if (!started) { c.moveTo(X(k), Y(v.up[k])); started = true; } else c.lineTo(X(k), Y(v.up[k])); }
      for (k = to; k >= from; k--) { if (v.lo[k] == null) continue; c.lineTo(X(k), Y(v.lo[k])); }
      c.closePath(); c.globalAlpha = 0.1; c.fillStyle = cc; c.fill(); c.globalAlpha = 1;
      pathLine(v.up, cc, 1.2, 0.85); pathLine(v.lo, cc, 1.2, 0.85); if (v.mid) pathLine(v.mid, cc, 1, 0.55);
    });
    c.lineJoin = 'round';
    overlays.forEach(function (d) { if (!d.band) pathLine(s.ind[d.id], col(d.color, acc), 1.3, 0.95); });
    if (cmpAt) {
      var cc3 = col(CMP.color || 'violet', '#8f7bf6'), cArr = []; for (var ck = 0; ck < s.n; ck++) cArr.push(ck >= from && ck <= to ? cmpAt(ck) : null);
      pathLine(cArr, cc3, 2, 1, [6, 3]);
      var cl = null; for (ck = to; ck >= from; ck--) if (cArr[ck] != null) { cl = cArr[ck]; break; }
      if (cl != null) { var cy3 = Y(cl); if (cy3 > L.y0 + 6 && cy3 < L.y1 - 6) { pill(c, L.x1 + 2, cy3 - 8, 60, 16, cc3); c.fillStyle = lum(cc3) > 0.55 ? '#0b0c0f' : '#ffffff'; c.font = '600 9.5px "IBM Plex Sans", system-ui, sans-serif'; c.fillText(fmt(cl), L.x1 + 9, cy3); c.font = '500 11px "IBM Plex Sans", system-ui, -apple-system, sans-serif'; } }
    }
    c.lineJoin = 'miter'; c.restore();
    // volume: its own strip under the price area
    if (L.vol && vmax) {
      var vh = L.vol.y1 - L.vol.y0 - 2, vbw = Math.max(1, Math.min(13, Math.round(bw * 0.72)));
      for (i = from; i <= to; i++) {
        if (!s.v[i]) continue;
        var up = s.c[i] >= s.o[i], h = Math.max(1, s.v[i] / vmax * vh);
        c.fillStyle = hexOk(IC.vol) ? rgba(IC.vol, 0.45) : rgba(up ? bull : bear, 0.38);
        c.fillRect(Math.round(X(i) - vbw / 2), L.vol.y1 - h, vbw, h);
      }
    }
    // line view: one price line, green or red against the previous close, soft fill, live dot
    var pulseAt = null;
    if (lineMode) {
      var last = to === s.n - 1 && this.anim ? this.animValue() : s.c[to], ref = this.refPrice || s.o[from] || s.c[from];
      var lc = last >= ref ? bull : bear, val = function (k) { return k === to ? last : s.c[k]; };
      var ry = Y(ref);
      if (ry > L.y0 && ry < L.y1) { c.strokeStyle = muted; c.globalAlpha = 0.55; c.setLineDash([2, 4]); c.lineWidth = 1; c.beginPath(); c.moveTo(L.x0, ry); c.lineTo(L.x1, ry); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; }
      var grad = c.createLinearGradient(0, L.y0, 0, L.y1); grad.addColorStop(0, rgba(lc, 0.22)); grad.addColorStop(1, rgba(lc, 0));
      c.beginPath(); c.moveTo(X(from), Y(val(from))); for (i = from + 1; i <= to; i++) c.lineTo(X(i), Y(val(i)));
      c.lineTo(X(to), L.y1); c.lineTo(X(from), L.y1); c.closePath(); c.fillStyle = grad; c.fill();
      c.beginPath(); c.moveTo(X(from), Y(val(from))); for (i = from + 1; i <= to; i++) c.lineTo(X(i), Y(val(i)));
      c.strokeStyle = lc; c.lineWidth = 2; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); c.lineJoin = 'miter'; c.lineCap = 'butt';
      if (to === s.n - 1) { var dx = X(to), dy = Y(last); c.fillStyle = lc; c.beginPath(); c.arc(dx, dy, 4, 0, Math.PI * 2); c.fill(); if (s.live) pulseAt = { x: dx, y: dy, c: lc }; }
    }
    this.placePulse(pulseAt);
    // the price series in the chosen chart type (owner's step 2). Candle bodies are about 72% of
    // a bar's slot, up to 13 px (owner 2026-11-11: a little bigger, so zoomed out isn't a mess)
    var cbw = Math.max(1, Math.min(13, Math.round(bw * 0.72)));
    if (cbw > 2 && cbw % 2 === 0) cbw -= 1; // odd widths keep the wick in the middle
    var baseY = L.vol ? L.vol.y0 : L.y1;
    function closePath(step) {
      c.beginPath();
      for (var k = from; k <= to; k++) {
        var px = X(k), py = Y(SC[k]);
        if (step) { if (k === from) c.moveTo(px - bw / 2, py); else c.lineTo(px - bw / 2, py); c.lineTo(px + bw / 2, py); }
        else if (k === from) c.moveTo(px, py); else c.lineTo(px, py);
      }
    }
    function strokeClose(color, w, step) { closePath(step); c.strokeStyle = color; c.lineWidth = w; c.lineJoin = 'round'; c.stroke(); c.lineJoin = 'miter'; }
    function fillUnder(color, toY) {
      closePath(false); c.lineTo(X(to), toY); c.lineTo(X(from), toY); c.closePath();
      var gd = c.createLinearGradient(0, L.y0, 0, L.y1); gd.addColorStop(0, rgba(color, 0.28)); gd.addColorStop(1, rgba(color, 0.02));
      c.fillStyle = gd; c.fill();
    }
    if (ST === 'candles' || ST === 'heikin' || ST === 'hollow' || ST === 'volcandles') {
      var vmx = 0; if (ST === 'volcandles') for (i = from; i <= to; i++) vmx = Math.max(vmx, s.v[i] || 0);
      for (i = from; i <= to; i++) {
        var o = SO[i], cl = SC[i], x = Math.round(X(i));
        // hollow candles take their colour from the previous close; filled when the bar fell
        var upc = ST === 'hollow' ? (i > 0 ? cl >= SC[i - 1] : cl >= o) : cl >= o, cc = upc ? bull : bear, w = cbw;
        if (ST === 'volcandles' && vmx) { w = Math.max(1, Math.round(bw * 0.92 * (0.2 + 0.8 * Math.sqrt((s.v[i] || 0) / vmx)))); if (w > 2 && w % 2 === 0) w -= 1; }
        var top = Math.round(Y(Math.max(o, cl))), bot = Math.round(Y(Math.min(o, cl))), hgt = Math.max(1, bot - top), bx = x + 1 - Math.ceil(w / 2);
        // the wick above and below the body (not through it, so hollow bodies stay empty)
        c.strokeStyle = cc; c.lineWidth = 1; c.beginPath();
        c.moveTo(x + 0.5, Math.round(Y(SH[i]))); c.lineTo(x + 0.5, top);
        c.moveTo(x + 0.5, top + hgt); c.lineTo(x + 0.5, Math.round(Y(SL[i]))); c.stroke();
        if (ST === 'hollow' && cl >= o && w > 2) { c.strokeRect(bx + 0.5, top + 0.5, w - 1, Math.max(1, hgt - 1)); }
        else { c.fillStyle = cc; c.fillRect(bx, top, w, hgt); }
        if (lightBg && lum(cc) > 0.8) { c.strokeStyle = '#9aa1ac'; c.strokeRect(bx, top, w, hgt); }
        if (s.live && i === s.n - 1) { c.strokeStyle = acc; c.setLineDash([2, 2]); c.strokeRect(x - bw * 0.5, Y(SH[i]) - 2, bw, Y(SL[i]) - Y(SH[i]) + 4); c.setLineDash([]); }
      }
    } else if (ST === 'bars' || ST === 'highlow') {
      var tick = Math.max(1, Math.floor(cbw / 2));
      for (i = from; i <= to; i++) {
        var bxx = Math.round(X(i)), bcc = s.c[i] >= s.o[i] ? bull : bear, yH = Math.round(Y(s.h[i])), yL = Math.round(Y(s.l[i]));
        if (ST === 'highlow') { c.fillStyle = bcc; c.fillRect(bxx + 1 - Math.ceil(cbw / 2), yH, cbw, Math.max(1, yL - yH)); continue; }
        c.strokeStyle = bcc; c.lineWidth = cbw >= 7 ? 1.5 : 1; c.beginPath();
        c.moveTo(bxx + 0.5, yH); c.lineTo(bxx + 0.5, yL);
        c.moveTo(bxx + 0.5 - tick, Math.round(Y(s.o[i])) + 0.5); c.lineTo(bxx + 0.5, Math.round(Y(s.o[i])) + 0.5);
        c.moveTo(bxx + 0.5, Math.round(Y(s.c[i])) + 0.5); c.lineTo(bxx + 0.5 + tick, Math.round(Y(s.c[i])) + 0.5);
        c.stroke();
      }
    } else if (ST === 'columns') {
      for (i = from; i <= to; i++) {
        var cy = Math.round(Y(s.c[i])), ccol = i > 0 && s.c[i] < s.c[i - 1] ? bear : bull;
        c.fillStyle = rgba(ccol, 0.85); c.fillRect(Math.round(X(i)) + 1 - Math.ceil(cbw / 2), cy, cbw, Math.max(1, baseY - cy));
      }
    } else if (ST === 'linemarkers' || ST === 'step') {
      strokeClose(acc, 2, ST === 'step');
      if (ST === 'linemarkers' && bw >= 4) { c.fillStyle = acc; for (i = from; i <= to; i++) { c.beginPath(); c.arc(X(i), Y(s.c[i]), bw >= 9 ? 3 : 2, 0, Math.PI * 2); c.fill(); } }
    } else if (ST === 'area') {
      fillUnder(acc, baseY); strokeClose(acc, 2, false);
    } else if (ST === 'hlcarea') {
      c.beginPath(); for (i = from; i <= to; i++) { if (i === from) c.moveTo(X(i), Y(s.h[i])); else c.lineTo(X(i), Y(s.h[i])); }
      for (i = to; i >= from; i--) c.lineTo(X(i), Y(s.l[i])); c.closePath(); c.fillStyle = rgba(acc, 0.14); c.fill();
      pathLine(s.h, bull, 1, 0.75); pathLine(s.l, bear, 1, 0.75); strokeClose(ink, 1.6, false);
    } else if (ST === 'baseline') {
      // above the starting price in green, below it in red, both filled toward the base line
      var base = this.refPrice || s.c[from], by = Y(base);
      c.save(); c.beginPath(); c.rect(L.x0, L.y0, L.x1 - L.x0, Math.max(0, by - L.y0)); c.clip();
      closePath(false); c.lineTo(X(to), by); c.lineTo(X(from), by); c.closePath(); c.fillStyle = rgba(bull, 0.18); c.fill(); strokeClose(bull, 2, false); c.restore();
      c.save(); c.beginPath(); c.rect(L.x0, by, L.x1 - L.x0, Math.max(0, L.y1 - by)); c.clip();
      closePath(false); c.lineTo(X(to), by); c.lineTo(X(from), by); c.closePath(); c.fillStyle = rgba(bear, 0.18); c.fill(); strokeClose(bear, 2, false); c.restore();
      c.strokeStyle = muted; c.globalAlpha = 0.6; c.setLineDash([3, 3]); c.lineWidth = 1; c.beginPath(); c.moveTo(L.x0, Math.round(by) + 0.5); c.lineTo(L.x1, Math.round(by) + 0.5); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    }
    // forecast stop-loss / take-profit boxes, projected right of the latest bar
    if (this.forecast && this.forecast.entry) {
      var F = this.forecast, fx0 = X(Math.min(to, s.n - 1)) + bw * 0.7, fx1 = L.x1;
      [['tp', green, 'TAKE PROFIT'], ['sl', red, 'STOP LOSS']].forEach(function (k) {
        var v = F[k[0]]; if (!v) return;
        var yA = Y(F.entry), yB = Y(v), tp0 = Math.min(yA, yB), hh = Math.abs(yB - yA);
        c.fillStyle = rgba(k[1], 0.17); c.fillRect(fx0, tp0, fx1 - fx0, hh);
        c.strokeStyle = rgba(k[1], 0.75); c.lineWidth = 1; c.strokeRect(fx0 + 0.5, tp0 + 0.5, fx1 - fx0 - 1, Math.max(1, hh - 1));
        if (hh > 16 && fx1 - fx0 > 60) {
          var pctv = (v / F.entry - 1) * 100;
          c.font = '700 9.5px "IBM Plex Sans", system-ui, -apple-system, sans-serif'; c.fillStyle = k[1];
          c.fillText(k[2] + ' ' + (pctv >= 0 ? '+' : '') + pctv.toFixed(1) + '%', fx0 + 5, k[0] === 'tp' ? tp0 + 10 : tp0 + hh - 9);
          c.font = '500 10px "IBM Plex Sans", system-ui, -apple-system, sans-serif';
        }
        c.fillStyle = k[1]; c.fillRect(L.x1 + 1, yB - 8, 62, 16); c.fillStyle = '#0b0c0f'; c.fillText(fmt(v), L.x1 + 6, yB);
        if (F.editable) { // drag grip on the edge you can move
          c.fillStyle = k[1]; var gx = (fx0 + fx1) / 2; c.fillRect(gx - 14, yB - 2, 28, 4);
        }
      });
      c.strokeStyle = ink; c.globalAlpha = 0.7; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(fx0, Y(F.entry)); c.lineTo(fx1, Y(F.entry)); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      if (F.sl && F.tp && F.entry) {
        var rr = Math.abs(F.tp - F.entry) / Math.max(1e-9, Math.abs(F.entry - F.sl));
        c.font = '700 10px "IBM Plex Sans", system-ui, -apple-system, sans-serif'; c.fillStyle = ink; c.textAlign = 'right';
        c.fillText((F.label ? F.label + ' · ' : '') + rr.toFixed(1) + ':1', fx1 - 5, Y(F.entry) - 8); c.textAlign = 'left';
        c.font = '500 10px "IBM Plex Sans", system-ui, -apple-system, sans-serif';
      }
    }
    // Fibonacci retracement across the visible swing (0% at the latest extreme)
    if (this.fib) {
      var hiI = from, loI = from;
      for (i = from; i <= to; i++) { if (s.h[i] > s.h[hiI]) hiI = i; if (s.l[i] < s.l[loI]) loI = i; }
      var H0 = s.h[hiI], L0 = s.l[loI], upSwing = hiI > loI, gold = cssVar('--gold', '#e8b23d');
      var fx = X(Math.min(hiI, loI));
      c.font = '600 9px "IBM Plex Sans", system-ui, -apple-system, sans-serif';
      [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].forEach(function (f) {
        var pv = upSwing ? H0 - (H0 - L0) * f : L0 + (H0 - L0) * f, fy = Y(pv);
        c.strokeStyle = gold; c.globalAlpha = f === 0.618 || f === 0.5 ? 0.75 : 0.45; c.lineWidth = 1; c.setLineDash(f === 0 || f === 1 ? [] : [4, 3]);
        c.beginPath(); c.moveTo(fx, fy); c.lineTo(L.x1, fy); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
        c.fillStyle = gold; c.textBaseline = 'bottom'; c.fillText('FIB ' + (f * 100).toFixed(1) + '%  ' + fmt(pv), fx + 4, fy - 1); c.textBaseline = 'middle';
      });
      c.font = '500 10px "IBM Plex Sans", system-ui, -apple-system, sans-serif';
    }
    // Three-Legged Strategy: start -> A -> B -> C, with the projected end of leg C
    if (this.abc && this.abc.pts.length) {
      var P3 = this.abc.pts.map(function (q) { return { i: s.d.indexOf(q.d), p: q.p }; });
      if (P3.every(function (q) { return q.i >= 0; })) {
        var vio = cssVar('--violet', '#8f7bf6'), names = ['START', 'A', 'B', 'C'];
        if (this.placing === 'abc' && this.hover && P3.length < 4) P3 = P3.concat([{ i: this.barAt(this.hover.x), p: this.priceAt(this.hover.y), ghost: true }]);
        c.strokeStyle = vio; c.lineWidth = 2; c.beginPath();
        P3.forEach(function (q, k) { var x = X(q.i), y = Y(q.p); if (k) c.lineTo(x, y); else c.moveTo(x, y); });
        c.stroke();
        c.font = '700 10px "IBM Plex Sans", system-ui, -apple-system, sans-serif'; c.textAlign = 'center';
        P3.forEach(function (q, k) {
          if (q.ghost) return;
          var x = X(q.i), y = Y(q.p), above = k === 0 ? P3.length > 1 && P3[1].p < q.p : q.p >= (P3[k - 1] || q).p;
          c.fillStyle = vio; c.beginPath(); c.arc(x, y, 3.5, 0, Math.PI * 2); c.fill();
          var tag = names[k] + (k ? ' ' + ((q.p / P3[k - 1].p - 1) * 100 >= 0 ? '+' : '') + ((q.p / P3[k - 1].p - 1) * 100).toFixed(1) + '%' : '');
          c.fillText(tag, x, y + (above ? -12 : 13));
        });
        c.textAlign = 'left';
        if (P3.length >= 3 && !P3[2].ghost) {
          var legA = P3[1].p - P3[0].p, z1 = P3[2].p + legA, z2 = P3[2].p + 1.618 * legA, zx = X(P3[2].i), zy1 = Y(z1), zy2 = Y(z2);
          c.fillStyle = rgba(vio, 0.12); c.fillRect(zx, Math.min(zy1, zy2), L.x1 - zx, Math.abs(zy2 - zy1));
          c.strokeStyle = rgba(vio, 0.7); c.lineWidth = 1; c.setLineDash([4, 3]);
          [zy1, zy2].forEach(function (zy) { c.beginPath(); c.moveTo(zx, zy); c.lineTo(L.x1, zy); c.stroke(); }); c.setLineDash([]);
          c.font = '600 9px "IBM Plex Sans", system-ui, -apple-system, sans-serif'; c.fillStyle = vio; c.textAlign = 'right';
          c.fillText('C = 100% of A · ' + fmt(z1), L.x1 - 4, zy1 + (legA < 0 ? -6 : 8));
          c.fillText('C = 161.8% of A · ' + fmt(z2), L.x1 - 4, zy2 + (legA < 0 ? 8 : -6));
          if (P3.length === 4 && !P3[3].ghost) c.fillText('C/A ' + (Math.abs(P3[3].p - P3[2].p) / Math.max(1e-9, Math.abs(legA))).toFixed(2), L.x1 - 4, Math.min(zy1, zy2) - 16);
          c.textAlign = 'left';
        }
        c.font = '500 10px "IBM Plex Sans", system-ui, -apple-system, sans-serif';
      }
    }
    // coach plays: lines, arrows, boxes, price levels and labels pinned to bar dates
    var shapeList = this.shapeDraft ? this.shapes.concat([this.shapeDraft]) : this.shapes;
    if (shapeList.length) {
      var SC = { blue: cssVar('--accent', '#4a86ff'), green: green, red: red, gold: cssVar('--gold', '#e8b23d') };
      var idxOf = function (d) {
        var k = s.d.indexOf(d); if (k >= 0) return k;
        for (var j = 0; j < s.n; j++) if (s.d[j] > d) return j; // nearest later bar (e.g. a daily date on 15m bars)
        return d > s.d[s.n - 1] ? s.n - 1 : -1;
      };
      var ghostBar = function (gx, go, gh, gl, gcl) {
        var x = Math.round(X(gx)), up = gcl >= go, cc2 = up ? bull : bear, top = Math.round(Y(Math.max(go, gcl))), bot = Math.round(Y(Math.min(go, gcl)));
        c.save(); c.globalAlpha = 0.55; c.strokeStyle = cc2; c.lineWidth = 1; c.setLineDash([]);
        c.beginPath(); c.moveTo(x + 0.5, Math.round(Y(gh))); c.lineTo(x + 0.5, top); c.moveTo(x + 0.5, bot); c.lineTo(x + 0.5, Math.round(Y(gl))); c.stroke();
        var w = Math.max(1, Math.min(13, Math.round(bw * 0.72))); if (w > 2 && w % 2 === 0) w -= 1;
        c.strokeRect(x + 1 - Math.ceil(w / 2) + 0.5, top + 0.5, Math.max(1, w - 1), Math.max(1, bot - top - 1)); c.restore();
      };
      var PATS = { xabcd: ['X', 'A', 'B', 'C', 'D'], cypher: ['X', 'A', 'B', 'C', 'D'], headshoulders: ['', 'Left shoulder', '', 'Head', '', 'Right shoulder', ''], abcd: ['A', 'B', 'C', 'D'], trianglepat: ['A', 'B', 'C', 'D'], threedrives: ['', '1', '', '2', '', '3', ''], elliottimpulse: ['0', '1', '2', '3', '4', '5'], elliottcorrection: ['0', 'A', 'B', 'C'], elliotttriangle: ['0', 'A', 'B', 'C', 'D', 'E'], elliottdouble: ['0', 'W', 'X', 'Y'], elliotttriple: ['0', 'W', 'X', 'Y', 'X', 'Z'], cyclelines: 1, timecycles: 1, sineline: 1 };
      var drawPattern = function (k, P, colr) {
        var tag = function (t, q, j) {
          if (!t) return;
          // above a peak, below a trough (compared with its neighbours)
          var prev = P[j - 1], next = P[j + 1], peak = (!prev || q.y <= prev.y) && (!next || q.y <= next.y);
          c.save(); c.font = '700 10.5px "IBM Plex Sans", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = peak ? 'bottom' : 'top';
          var tw = c.measureText(t).width + 8, ty = peak ? q.y - 6 : q.y + 6;
          c.globalAlpha = 0.9; c.fillStyle = colr; c.fillRect(q.x - tw / 2, peak ? ty - 14 : ty, tw, 14);
          c.globalAlpha = 1; c.fillStyle = '#ffffff'; c.fillText(t, q.x, peak ? ty - 1 : ty + 1); c.restore();
        };
        var poly = function (list, alpha, dash) { if (list.length < 2) return; c.save(); c.globalAlpha = alpha == null ? 0.95 : alpha; c.setLineDash(dash || []); c.lineWidth = 1.6; c.beginPath(); c.moveTo(list[0].x, list[0].y); for (var j = 1; j < list.length; j++) c.lineTo(list[j].x, list[j].y); c.stroke(); c.restore(); };
        var fillTri = function (p1, p2, p3) { if (!p1 || !p2 || !p3) return; c.save(); c.globalAlpha = 0.1; c.beginPath(); c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.lineTo(p3.x, p3.y); c.closePath(); c.fill(); c.restore(); };
        var ratio = function (p1, p2, q1, q2) { var d1 = Math.abs(p2.p - p1.p); return d1 ? Math.abs(q2.p - q1.p) / d1 : 0; };
        var midTag = function (t, p1, p2) { if (!p1 || !p2) return; c.save(); c.font = '600 10px "IBM Plex Sans", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; var mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2, tw = c.measureText(t).width + 6; c.globalAlpha = 0.8; c.fillStyle = bg; c.fillRect(mx - tw / 2, my - 7, tw, 14); c.globalAlpha = 1; c.fillStyle = colr; c.fillText(t, mx, my); c.restore(); };
        var a = P[0], b = P[1];
        if (k === 'cyclelines' || k === 'timecycles' || k === 'sineline') {
          if (!b) return;
          var dx = b.x - a.x; if (Math.abs(dx) < 3) return;
          var step = Math.abs(dx), start = Math.min(a.x, b.x);
          while (start - step > L.x0) start -= step;
          if (k === 'cyclelines') {
            // equal cycles: verticals every a→b distance, across the whole chart
            for (var x = start; x <= L.x1; x += step) { c.save(); c.globalAlpha = 0.7; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(x, L.y0); c.lineTo(x, L.y1); c.stroke(); c.restore(); }
          } else if (k === 'timecycles') {
            // half-circles along the price, one per cycle, as tall as the cycle is wide
            for (var x2 = start; x2 <= L.x1; x2 += step) { c.save(); c.globalAlpha = 0.75; c.beginPath(); c.arc(x2 + step / 2, a.y, step / 2, Math.PI, 2 * Math.PI); c.stroke(); c.restore(); }
          } else {
            // a sine wave: half a wave from the first point to the second, repeated across the chart
            var amp = (b.y - a.y) / 2, mid = (a.y + b.y) / 2;
            c.save(); c.globalAlpha = 0.9; c.lineWidth = 1.6; c.beginPath();
            for (var sx = L.x0, f = true; sx <= L.x1; sx += 2) { var sy = mid - amp * Math.cos(Math.PI * (sx - a.x) / dx); if (f) { c.moveTo(sx, sy); f = false; } else c.lineTo(sx, sy); }
            c.stroke(); c.restore();
          }
          return;
        }
        var names = PATS[k];
        if (k === 'xabcd' || k === 'cypher') {
          fillTri(P[0], P[1], P[2]); fillTri(P[2], P[3], P[4]);
          poly(P); if (P[2]) poly([P[0], P[2]], 0.5, [4, 4]); if (P[4]) poly([P[2], P[4]], 0.5, [4, 4]);
          // Fibonacci ratios of each leg, the way harmonic traders read them
          if (P[2]) midTag(ratio(P[0], P[1], P[1], P[2]).toFixed(3), P[0], P[2]);
          if (P[3]) midTag(ratio(P[1], P[2], P[2], P[3]).toFixed(3), P[1], P[3]);
          // D: XABCD reads it against the X→A leg, Cypher against the X→C leg
          if (P[4]) midTag((k === 'cypher' ? ratio(P[0], P[3], P[3], P[4]) : ratio(P[0], P[1], P[1], P[4])).toFixed(3), P[2], P[4]);
        } else if (k === 'abcd') {
          poly(P); if (P[2]) midTag(ratio(P[0], P[1], P[1], P[2]).toFixed(3), P[0], P[2]); if (P[3]) midTag(ratio(P[1], P[2], P[2], P[3]).toFixed(3), P[1], P[3]);
        } else if (k === 'trianglepat') {
          fillTri(P[0], P[1], P[2]); fillTri(P[1], P[2], P[3]); poly(P); if (P[2]) poly([P[0], P[2]], 0.6, [4, 4]); if (P[3]) poly([P[1], P[3]], 0.6, [4, 4]);
        } else if (k === 'headshoulders') {
          poly(P);
          // the neckline through the two troughs either side of the head, run on to the right edge
          if (P[2] && P[4]) { var n0 = P[2], n1 = P[4], ny = n0.y + (n1.y - n0.y) * (L.x1 - n0.x) / ((n1.x - n0.x) || 1); poly([n0, { x: L.x1, y: ny }], 0.8, [6, 4]); c.save(); c.font = '600 10px "IBM Plex Sans", system-ui, sans-serif'; c.fillStyle = colr; c.textBaseline = 'bottom'; c.fillText('Neckline', n1.x + 6, n1.y + (ny - n1.y) * 0.1 - 3); c.restore(); }
          if (P[1] && P[3] && P[5]) { fillTri(P[0], P[1], P[2]); fillTri(P[2], P[3], P[4]); fillTri(P[4], P[5], P[6] || P[5]); }
        } else {
          poly(P);
        }
        P.forEach(function (q, j) { tag(names[j], q, j); });
      };
      var FIBG = { fibret: 1, fibext: 1, fibchannel: 1, fibtime: 1, fibtrendtime: 1, fibfan: 1, fibarcs: 1, fibcircles: 1, fibspiral: 1, fibwedge: 1, pitchfan: 1, gannbox: 1, gannsquare: 1, gannfixed: 1, gannfan: 1 };
      var drawFibGann = function (k, a, b, p3, colr) {
        var lbl = function (t, x, y, align) { c.save(); c.globalAlpha = 1; c.fillStyle = colr; c.font = '600 10px "IBM Plex Sans", system-ui, sans-serif'; c.textAlign = align || 'left'; c.textBaseline = 'bottom'; c.fillText(t, x, y - 2); c.restore(); };
        var seg = function (x0, y0, x1, y1, alpha, dash) { c.save(); c.globalAlpha = alpha == null ? 0.85 : alpha; c.setLineDash(dash || []); c.lineWidth = 1.2; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.restore(); };
        // a ray from (x0,y0) through (x1,y1) to the plot's edge
        var ray = function (x0, y0, x1, y1, alpha) {
          if (x1 === x0) { seg(x0, y0, x1, y1 > y0 ? L.y1 : L.y0, alpha); return; }
          var ex = x1 > x0 ? L.x1 : L.x0, ey = y0 + (y1 - y0) * (ex - x0) / (x1 - x0);
          // stop at the top or bottom edge when the line gets there first (so its label can sit there)
          if (ey < L.y0 || ey > L.y1) { var yy = ey < L.y0 ? L.y0 : L.y1; ex = x0 + (x1 - x0) * (yy - y0) / ((y1 - y0) || 1); ey = yy; }
          seg(x0, y0, ex, ey, alpha); return { x: ex, y: ey };
        };
        var band = function (x0, x1, y0, y1, alpha) { c.save(); c.globalAlpha = alpha; c.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); c.restore(); };
        var dist = b ? Math.hypot(b.x - a.x, b.y - a.y) : 0, R = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1], fmtK = function (v) { return String(+v.toFixed(3)); };
        if (!b && k !== 'gannfixed') return;
        if (k === 'fibret') {
          // 0 at the second point, 1 at the first, like most charting apps
          var x0 = Math.min(a.x, b.x);
          R.forEach(function (r, j) { var pr = b.p + (a.p - b.p) * r, y = Y(pr); if (j) band(x0, L.x1, Y(b.p + (a.p - b.p) * R[j - 1]), y, j % 2 ? 0.05 : 0.09); seg(x0, y, L.x1, y); lbl(fmtK(r) + ' (' + fmt(pr) + ')', x0 + 4, y); });
          seg(a.x, a.y, b.x, b.y, 0.5, [4, 4]);
        } else if (k === 'fibext' && p3) {
          // trend-based extension: the a→b move, projected from the third point
          [0, 0.382, 0.618, 1, 1.272, 1.618, 2, 2.618].forEach(function (r) { var pr = p3.p + (b.p - a.p) * r, y = Y(pr); seg(p3.x, y, L.x1, y); lbl(fmtK(r) + ' (' + fmt(pr) + ')', p3.x + 4, y); });
          seg(a.x, a.y, b.x, b.y, 0.6, [4, 4]); seg(b.x, b.y, p3.x, p3.y, 0.6, [4, 4]);
        } else if (k === 'fibchannel' && p3) {
          // lines parallel to a→b, spaced by the third point's distance from it
          var m = (b.y - a.y) / ((b.x - a.x) || 1), off = p3.y - (a.y + m * (p3.x - a.x));
          [0, 0.382, 0.618, 1, 1.618, 2.618].forEach(function (r) { var o = off * r; seg(a.x, a.y + o, L.x1, a.y + o + m * (L.x1 - a.x)); lbl(fmtK(r), a.x + 4, a.y + o); });
        } else if (k === 'fibtime') {
          // time zones: verticals at 0, 1, 2, 3, 5, 8, 13… times the a→b distance
          var dx = b.x - a.x; if (!dx) return;
          [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89].forEach(function (n) { var x = a.x + dx * n; if (x < L.x0 || x > L.x1) return; seg(x, L.y0, x, L.y1, 0.75); lbl(String(n), x + 3, L.y0 + 14); });
        } else if (k === 'fibtrendtime' && p3) {
          var dx2 = b.x - a.x;
          [0, 0.382, 0.5, 0.618, 1, 1.382, 1.618, 2, 2.618].forEach(function (r) { var x = p3.x + dx2 * r; if (x < L.x0 || x > L.x1) return; seg(x, L.y0, x, L.y1, 0.75); lbl(fmtK(r), x + 3, L.y0 + 14); });
          seg(a.x, a.y, b.x, b.y, 0.6, [4, 4]);
        } else if (k === 'fibfan') {
          // speed resistance fan: rays from the first point through fractions of the a→b move
          [1, 0.75, 0.618, 0.5, 0.382, 0.25, 0].forEach(function (r) { var y = b.y + (a.y - b.y) * r, e = ray(a.x, a.y, b.x, y, r === 1 || r === 0 ? 0.9 : 0.7); if (e) lbl(fmtK(r), b.x + 4, y); });
        } else if (k === 'fibarcs') {
          [0.382, 0.5, 0.618, 1].forEach(function (r) { c.save(); c.globalAlpha = 0.8; c.beginPath(); c.arc(b.x, b.y, dist * r, b.y > a.y ? Math.PI : 0, b.y > a.y ? 2 * Math.PI : Math.PI); c.stroke(); c.restore(); lbl(fmtK(r), b.x + 3, b.y + (b.y > a.y ? -dist * r : dist * r + 12)); });
          seg(a.x, a.y, b.x, b.y, 0.5, [4, 4]);
        } else if (k === 'fibcircles') {
          var cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, h = dist / 2;
          [0.382, 0.618, 1, 1.618, 2.618].forEach(function (r) { c.save(); c.globalAlpha = r === 1 ? 0.9 : 0.6; c.beginPath(); c.arc(cx, cy, h * r, 0, Math.PI * 2); c.stroke(); c.restore(); lbl(fmtK(r), cx + h * r + 3, cy); });
          seg(a.x, a.y, b.x, b.y, 0.5, [4, 4]);
        } else if (k === 'fibspiral') {
          // a golden spiral through the second point, centred on the first: it grows 1.618× every quarter turn
          var phi = 1.618034, ang0 = Math.atan2(b.y - a.y, b.x - a.x);
          c.save(); c.globalAlpha = 0.85; c.beginPath();
          for (var tt = -4, first = true; tt <= 1.5; tt += 0.05) { var rr = dist * Math.pow(phi, tt), th = ang0 + tt * Math.PI / 2, sx = a.x + rr * Math.cos(th), sy = a.y + rr * Math.sin(th); if (first) { c.moveTo(sx, sy); first = false; } else c.lineTo(sx, sy); }
          c.stroke(); c.restore();
        } else if (k === 'fibwedge' && p3) {
          var a1 = Math.atan2(b.y - a.y, b.x - a.x), a2 = Math.atan2(p3.y - a.y, p3.x - a.x);
          seg(a.x, a.y, b.x, b.y); seg(a.x, a.y, a.x + dist * Math.cos(a2), a.y + dist * Math.sin(a2));
          R.slice(1).forEach(function (r) { c.save(); c.globalAlpha = 0.7; c.beginPath(); c.arc(a.x, a.y, dist * r, Math.min(a1, a2), Math.max(a1, a2), Math.abs(a2 - a1) > Math.PI); c.stroke(); c.restore(); });
        } else if (k === 'pitchfan' && p3) {
          // rays from the first point through the second, the third, and the middle of the two
          var mx = (b.x + p3.x) / 2, my = (b.y + p3.y) / 2;
          ray(a.x, a.y, b.x, b.y, 0.85); ray(a.x, a.y, p3.x, p3.y, 0.85); ray(a.x, a.y, mx, my, 1); seg(b.x, b.y, p3.x, p3.y, 0.5, [4, 4]);
        } else if (k === 'gannbox' || k === 'gannsquare' || k === 'gannfixed') {
          // Gann box: price and time split at 0, ¼, 0.382, ½, 0.618, ¾, 1 with both diagonals; a Gann square
          // is the same grid in quarters, kept square on screen; the fixed square is 34 bars wide from the tap
          var bx = b, side;
          if (k === 'gannfixed') { side = Math.min(34 * bw, (L.y1 - L.y0) * 0.6); bx = { x: a.x + side, y: a.y - side }; }
          else if (k === 'gannsquare') { side = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)); bx = { x: a.x + side * (b.x >= a.x ? 1 : -1), y: a.y + side * (b.y >= a.y ? 1 : -1) }; }
          var gx0 = a.x, gy0 = a.y, gx1 = bx.x, gy1 = bx.y, G = k === 'gannbox' ? [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1] : [0, 0.25, 0.5, 0.75, 1];
          band(gx0, gx1, gy0, gy1, 0.06);
          G.forEach(function (r) { var x = gx0 + (gx1 - gx0) * r, y = gy0 + (gy1 - gy0) * r, edge = r === 0 || r === 1; seg(x, gy0, x, gy1, edge ? 0.9 : 0.45); seg(gx0, y, gx1, y, edge ? 0.9 : 0.45); if (k === 'gannbox' && !edge) { lbl(fmtK(r), x + 2, Math.max(gy0, gy1) + 12); lbl(fmtK(r), Math.max(gx0, gx1) + 4, y); } });
          seg(gx0, gy0, gx1, gy1, 0.8); seg(gx0, gy1, gx1, gy0, 0.8);
          if (k !== 'gannbox') { var s2 = Math.abs(gx1 - gx0); c.save(); c.globalAlpha = 0.5; c.beginPath(); c.arc((gx0 + gx1) / 2, (gy0 + gy1) / 2, s2 / 2, 0, Math.PI * 2); c.stroke(); c.restore(); }
        } else if (k === 'gannfan') {
          // Gann fan: 1×1 is the a→b slope; the other angles are 2×1, 3×1… (steeper) and 1×2, 1×3… (flatter)
          var vx = b.x - a.x, vy = b.y - a.y;
          [[8, '8×1'], [4, '4×1'], [3, '3×1'], [2, '2×1'], [1, '1×1'], [1 / 2, '1×2'], [1 / 3, '1×3'], [1 / 4, '1×4'], [1 / 8, '1×8']].forEach(function (g) { var e = ray(a.x, a.y, a.x + vx, a.y + vy * g[0], g[0] === 1 ? 1 : 0.65); if (e) lbl(g[1], e.x - 4, Math.max(L.y0 + 14, Math.min(L.y1 - 2, e.y + (e.y <= L.y0 + 1 ? 14 : 0))), 'right'); });
        }
      };
      c.save(); c.beginPath(); c.rect(L.x0, L.y0, L.x1 - L.x0, L.y1 - L.y0); c.clip();
      shapeList.forEach(function (sh) {
        var col = SC[sh.c] || SC.blue, pts = (sh.pts || []).map(function (q) { var qi = idxOf(q.d); return { x: X(qi + (q.f || 0)), y: Y(q.p), i: qi, f: q.f || 0, p: q.p }; });
        if (!pts.length || pts.some(function (q) { return q.i < 0; })) return;
        c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2; c.globalAlpha = sh === self.shapeDraft ? 0.7 : 1;
        var a = pts[0], b = pts[1];
        if (sh.k === 'hline') { c.setLineDash([6, 4]); c.beginPath(); c.moveTo(L.x0, a.y); c.lineTo(L.x1, a.y); c.stroke(); c.setLineDash([]); }
        else if (sh.k === 'box' && b) { c.globalAlpha *= 0.18; c.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); c.globalAlpha = sh === self.shapeDraft ? 0.7 : 1; c.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); }
        else if (sh.k === 'vline') { c.setLineDash([6, 4]); c.beginPath(); c.moveTo(Math.round(a.x) + 0.5, L.y0); c.lineTo(Math.round(a.x) + 0.5, L.y1); c.stroke(); c.setLineDash([]); }
        else if (sh.k === 'hray') { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(L.x1, a.y); c.stroke(); c.beginPath(); c.arc(a.x, a.y, 3, 0, Math.PI * 2); c.fill(); }
        else if (sh.k === 'ray' && b) {
          // a line through both points that runs on to the right edge
          var rx = b.x === a.x ? b.x : L.x1, ry = b.x === a.x ? b.y : a.y + (b.y - a.y) * (rx - a.x) / (b.x - a.x);
          if (b.x < a.x) { rx = L.x0; ry = a.y + (b.y - a.y) * (rx - a.x) / (b.x - a.x); }
          c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(rx, ry); c.stroke();
          c.beginPath(); c.arc(a.x, a.y, 3, 0, Math.PI * 2); c.fill();
        }
        else if (PATS[sh.k]) {
          // chart patterns (owner's chart plan, step 5): the points you placed, joined and labelled
          drawPattern(sh.k, pts, col);
        }
        else if (FIBG[sh.k]) {
          // Fibonacci and Gann tools (owner's chart plan, step 4); levels are drawn faint with their ratio
          drawFibGann(sh.k, a, b, pts[2] || null, col);
        }
        else if (sh.k === 'avwap') {
          // anchored VWAP (step 6): volume-weighted average price from the bar you tapped to now
          var pv = 0, vv = 0, k0 = a.i, started = false, lastY = null;
          c.beginPath();
          for (var ai = k0; ai <= Math.min(to, s.n - 1); ai++) {
            var tp = (s.h[ai] + s.l[ai] + s.c[ai]) / 3, w = s.v[ai] || 1; pv += tp * w; vv += w;
            if (ai < from) continue;
            var ay = Y(pv / vv); if (!started) { c.moveTo(X(ai), ay); started = true; } else c.lineTo(X(ai), ay); lastY = { y: ay, v: pv / vv };
          }
          c.stroke();
          c.beginPath(); c.arc(a.x, Y(s.l[a.i]) + 8, 3.5, 0, Math.PI * 2); c.fill();
          if (lastY) { pill(c, L.x1 + 2, lastY.y - 8, 60, 16, col); c.fillStyle = lum(col) > 0.55 ? '#0b0c0f' : '#ffffff'; c.font = '600 9.5px "IBM Plex Sans", system-ui, sans-serif'; c.fillText(fmt(lastY.v), L.x1 + 9, lastY.y); }
          sh = { k: 'avwap', c: sh.c, pts: sh.pts, text: sh.text || 'AVWAP' };
        }
        else if (sh.k === 'pattern' && b) {
          // bars pattern (step 6): the bars you picked, replayed after the latest bar as a what-if,
          // scaled so the copy starts at today's close
          var p0 = Math.min(a.i, b.i), p1 = Math.max(a.i, b.i), lastI = s.n - 1, k = s.c[lastI] / (s.o[p0] || 1);
          c.globalAlpha = 0.12; c.fillRect(X(p0) - bw / 2, L.y0, (p1 - p0 + 1) * bw, L.y1 - L.y0); c.globalAlpha = 1;
          for (var pj = p0; pj <= p1; pj++) ghostBar(lastI + 1 + pj - p0, s.o[pj] * k, s.h[pj] * k, s.l[pj] * k, s.c[pj] * k);
          sh = { k: 'pattern', c: sh.c, pts: [sh.pts[0]], text: sh.text || 'Pattern' };
          a = { x: X(lastI + 1), y: L.y0 + 14, i: lastI + 1, p: 0 };
        }
        else if (sh.k === 'ghost') {
          // ghost feed (step 6): made-up bars from now to the price and day you tapped, with wiggles
          // the size of this stock's usual bars (the same every time for the same tap)
          var gi = s.n - 1, n = Math.max(2, a.f || 10), ar = 0, ac = 0;
          for (var gk = Math.max(0, gi - 20); gk <= gi; gk++) { ar += s.h[gk] - s.l[gk]; ac++; }
          ar = ac ? ar / ac : s.c[gi] * 0.01;
          var seed = Math.round(a.p * 100) * 31 + n, rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
          var prev = s.c[gi];
          for (var gj = 1; gj <= n; gj++) {
            var target = s.c[gi] + (a.p - s.c[gi]) * gj / n, gc = gj === n ? a.p : target + (rnd() - 0.5) * ar * 0.8;
            ghostBar(gi + gj, prev, Math.max(prev, gc) + rnd() * ar * 0.35, Math.min(prev, gc) - rnd() * ar * 0.35, gc);
            prev = gc;
          }
          c.beginPath(); c.arc(a.x, a.y, 3.5, 0, Math.PI * 2); c.fill();
          sh = { k: 'ghost', c: sh.c, pts: sh.pts, text: sh.text || 'Ghost feed' };
          a = { x: X(gi + 1), y: Math.min(Y(s.c[gi]), Y(a.p)) - 8, i: gi + 1, p: a.p }; // the label where the made-up bars start
        }
        else if (sh.k === 'measure' && b) {
          // the measure tool (owner's step 3): price change and %, bars, days and volume between two points
          var up = b.p >= a.p, mc = up ? green : red, i0 = Math.min(a.i, b.i), i1 = Math.max(a.i, b.i), vol = 0;
          for (var vi = i0 + 1; vi <= i1; vi++) vol += s.v[vi] || 0;
          var nb = i1 - i0, dd = Math.round(Math.abs(Date.parse(s.d[b.i].slice(0, 10)) - Date.parse(s.d[a.i].slice(0, 10))) / 864e5);
          var mx0 = Math.min(a.x, b.x), my0 = Math.min(a.y, b.y), mw = Math.abs(b.x - a.x), mh = Math.abs(b.y - a.y);
          c.globalAlpha = 0.16; c.fillStyle = mc; c.fillRect(mx0, my0, mw, mh); c.globalAlpha = 1;
          c.strokeStyle = mc; c.lineWidth = 1.5; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, a.y); c.lineTo(b.x, b.y); c.stroke();
          // intraday moves inside a day read in hours and minutes, longer ones in days
          var span = dd + (dd === 1 ? ' day' : ' days');
          if (s.intraday && dd < 1) { var mins = Math.round(Math.abs(Date.parse(s.d[b.i].replace(' ', 'T')) - Date.parse(s.d[a.i].replace(' ', 'T'))) / 6e4) || 0; /* Safari wants the T */ span = mins >= 60 ? Math.floor(mins / 60) + 'h' + (mins % 60 ? ' ' + (mins % 60) + 'm' : '') : mins + 'm'; }
          var dif = b.p - a.p, lines = [(dif >= 0 ? '+' : '') + fmt(dif) + ' (' + (dif >= 0 ? '+' : '') + (a.p ? dif / a.p * 100 : 0).toFixed(2) + '%)', nb + (nb === 1 ? ' bar' : ' bars') + ', ' + span];
          if (vol) lines.push('Vol ' + fmtVol(vol));
          c.font = '600 11px "IBM Plex Sans", system-ui, -apple-system, sans-serif';
          var lw = Math.max.apply(null, lines.map(function (t) { return c.measureText(t).width; })) + 16, lh = lines.length * 15 + 8;
          var lx = Math.max(L.x0 + 2, Math.min(L.x1 - lw - 2, (a.x + b.x) / 2 - lw / 2)), ly = up ? my0 - lh - 6 : my0 + mh + 6;
          if (ly < L.y0 + 2) ly = my0 + mh + 6; if (ly + lh > L.y1 - 2) ly = Math.max(L.y0 + 2, my0 - lh - 6);
          c.fillStyle = mc; c.fillRect(lx, ly, lw, lh); c.fillStyle = '#ffffff'; c.textBaseline = 'top';
          lines.forEach(function (t, k) { c.fillText(t, lx + 8, ly + 5 + k * 15); });
          c.textBaseline = 'middle'; c.font = '500 10px "IBM Plex Sans", system-ui, -apple-system, sans-serif';
        }
        else if ((sh.k === 'line' || sh.k === 'arrow') && b) {
          c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
          if (sh.k === 'arrow') { var ang = Math.atan2(b.y - a.y, b.x - a.x), hl = 11; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - hl * Math.cos(ang - 0.45), b.y - hl * Math.sin(ang - 0.45)); c.lineTo(b.x - hl * Math.cos(ang + 0.45), b.y - hl * Math.sin(ang + 0.45)); c.closePath(); c.fill(); }
        } else if (sh.k === 'text') { c.beginPath(); c.arc(a.x, a.y, 3.5, 0, Math.PI * 2); c.fill(); }
        var label = sh.text || (sh.k === 'hline' || sh.k === 'hray' ? fmt(a.p) : '');
        if (label) {
          c.font = '700 11px "IBM Plex Sans", ui-sans-serif, sans-serif'; c.textBaseline = 'bottom';
          var tx = sh.k === 'hline' ? L.x0 + 6 : a.x + 6, ty = a.y - 4, tw = c.measureText(label).width;
          c.globalAlpha = 0.85; c.fillStyle = bg; c.fillRect(tx - 3, ty - 15, tw + 6, 16); c.globalAlpha = 1; c.fillStyle = col; c.fillText(label, tx, ty);
          c.textBaseline = 'middle'; c.font = '500 10px "IBM Plex Sans", system-ui, -apple-system, sans-serif';
        }
        c.globalAlpha = 1;
      });
      c.restore();
    }
    // Trade War price alerts
    this.alerts.forEach(function (a) {
      var ay = Y(a.price); if (ay < L.y0 || ay > L.y1) return;
      c.strokeStyle = acc; c.lineWidth = 1.2; c.setLineDash([2, 3]); c.beginPath(); c.moveTo(L.x0, ay); c.lineTo(L.x1, ay); c.stroke(); c.setLineDash([]);
      c.font = '700 9px "IBM Plex Sans", system-ui, -apple-system, sans-serif'; c.fillStyle = acc; c.textAlign = 'right'; c.textBaseline = 'top';
      c.fillText('TRADE WAR ALERT ' + (a.dir === 'below' ? '≤ ' : '≥ ') + fmt(a.price), L.x1 - 4, ay + 2); c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillStyle = acc; c.fillRect(L.x1 + 1, ay - 8, 62, 16); c.fillStyle = '#ffffff'; c.font = '600 10px "IBM Plex Sans", system-ui, -apple-system, sans-serif'; c.fillText(fmt(a.price), L.x1 + 6, ay);
      c.font = '500 10px "IBM Plex Sans", system-ui, -apple-system, sans-serif';
    });
    // your fills
    this.marks.forEach(function (mk) {
      if (mk.i < from || mk.i > to) return;
      var x2 = X(mk.i), y2 = Y(mk.price), dd = mk.side === 'buy' ? 1 : -1;
      c.fillStyle = mk.side === 'buy' ? bull : bear;
      c.beginPath(); c.moveTo(x2, y2 + dd * 3); c.lineTo(x2 - 5, y2 + dd * 12); c.lineTo(x2 + 5, y2 + dd * 12); c.closePath(); c.fill();
    });
    // horizontal lines: cost basis, open orders
    this.lines.forEach(function (ln) {
      var y3 = Y(ln.price); if (y3 < L.y0 || y3 > L.y1) return;
      c.strokeStyle = ln.color; c.lineWidth = 1; c.setLineDash(ln.dash || [5, 4]); c.beginPath(); c.moveTo(L.x0, y3); c.lineTo(L.x1, y3); c.stroke(); c.setLineDash([]);
      c.font = '600 9px "IBM Plex Sans", system-ui, -apple-system, sans-serif'; c.fillStyle = ln.color; c.textAlign = 'right'; c.textBaseline = 'bottom';
      c.fillText(ln.label, L.x1 - 4, y3 - 2); c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = '500 10px "IBM Plex Sans", system-ui, -apple-system, sans-serif';
      c.fillStyle = ln.color; c.fillRect(L.x1 + 1, y3 - 8, 62, 16); c.fillStyle = tagInk; c.fillText(fmt(ln.price), L.x1 + 6, y3);
    });
    // each average's latest value as a small tag on the price axis, in its colour, so you can
    // tell the lines apart without the legend (the last-price tag below stays on top)
    c.font = '600 9.5px "IBM Plex Sans", system-ui, -apple-system, sans-serif';
    overlays.forEach(function (d) {
      if (d.band) return;
      var ov = s.ind[d.id][to]; if (ov == null) return;
      var oy = Y(ov); if (oy < L.y0 + 6 || oy > L.y1 - 6) return;
      var oc = col(d.color, acc); pill(c, L.x1 + 2, oy - 8, 60, 16, oc);
      c.fillStyle = lum(oc) > 0.55 ? '#0b0c0f' : '#ffffff'; c.fillText(fmt(ov), L.x1 + 9, oy);
    });
    c.font = '500 10px "IBM Plex Sans", system-ui, -apple-system, sans-serif';
    // last price tag
    // the last price always gets its tag (the app's charts don't set lastPrice; use the latest close)
    var lastP = this.lastPrice != null ? this.lastPrice : to === s.n - 1 ? s.c[s.n - 1] : null;
    if (lastP != null) {
      var lp = this.anim ? this.animValue() : lastP;
      var ly = Y(lp), up2 = lineMode ? lp >= (this.refPrice || s.o[from] || lp) : lastP >= (s.c[s.n - 2] || lastP), pc2 = up2 ? bull : bear;
      if (ly >= L.y0 && ly <= L.y1) {
        c.strokeStyle = pc2; c.globalAlpha = 0.6; c.setLineDash([1, 3]); c.beginPath(); c.moveTo(L.x0, ly); c.lineTo(L.x1, ly); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
        pill(c, L.x1 + 2, ly - 10, 60, 20, pc2); c.fillStyle = lum(pc2) > 0.62 ? '#0b0c0f' : '#ffffff';
        c.font = '700 11.5px "IBM Plex Sans", system-ui, -apple-system, sans-serif'; c.fillText(fmt(lp), L.x1 + 8, ly); c.font = '500 11px "IBM Plex Sans", system-ui, -apple-system, sans-serif';
      }
    }
    // indicator panes
    L.panes.forEach(function (P) {
      var d = P.def, v = s.ind[d.id];
      c.strokeStyle = grid; c.lineWidth = 1; c.beginPath(); c.moveTo(0, Math.round(P.y0 - 2) + 0.5); c.lineTo(self.W, Math.round(P.y0 - 2) + 0.5); c.stroke();
      var series = (d.lines || []).map(function (ln) {
        var pick = d.id === 'rsi' ? IC.rsi : d.id === 'macd' ? (ln[0] === 'signal' ? IC.macdSignal : IC.macd) : null;
        return { arr: ln[0] ? v[ln[0]] : v, color: hexOk(pick) ? pick : col(ln[1], acc) };
      });
      var histArr = d.hist ? v[d.hist] : null;
      var mn, mx2;
      if (d.range) { mn = d.range[0]; mx2 = d.range[1]; }
      else {
        mn = Infinity; mx2 = -Infinity;
        for (var k = from; k <= to; k++) {
          series.forEach(function (sr) { var x3 = sr.arr[k]; if (x3 != null) { mn = Math.min(mn, x3); mx2 = Math.max(mx2, x3); } });
          if (histArr && histArr[k] != null) { mn = Math.min(mn, histArr[k]); mx2 = Math.max(mx2, histArr[k]); }
        }
        if (d.zero) { var am = Math.max(Math.abs(mn), Math.abs(mx2)) || 1; mn = -am; mx2 = am; }
        if (!isFinite(mn)) { mn = 0; mx2 = 1; }
        if (mn === mx2) { mn -= 1; mx2 += 1; }
      }
      var PY = function (val) { return P.y1 - 4 - (val - mn) / (mx2 - mn) * (P.y1 - P.y0 - 8); };
      if (d.levels && d.levels.length === 2) { c.fillStyle = rgba(acc, 0.08); c.fillRect(L.x0, PY(d.levels[1]), L.x1 - L.x0, PY(d.levels[0]) - PY(d.levels[1])); }
      (d.levels || []).forEach(function (lv) {
        c.strokeStyle = rgba(acc, 0.7); c.lineWidth = 1; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(L.x0, Math.round(PY(lv)) + 0.5); c.lineTo(L.x1, Math.round(PY(lv)) + 0.5); c.stroke(); c.setLineDash([]);
        c.fillStyle = muted; c.fillText(fmt(lv), L.x1 + 8, PY(lv));
      });
      if (histArr) { var hbw = Math.max(1, Math.min(7, Math.round(bw * 0.55))); for (var k2 = from; k2 <= to; k2++) { var hv = histArr[k2]; if (hv == null) continue; c.fillStyle = hv >= 0 ? rgba(bull, 0.75) : rgba(bear, 0.75); c.fillRect(Math.round(X(k2) - hbw / 2), Math.min(PY(0), PY(hv)), hbw, Math.max(1, Math.abs(PY(hv) - PY(0)))); } }
      series.forEach(function (sr) {
        c.strokeStyle = sr.color; c.lineWidth = 1.3; c.lineJoin = 'round'; c.beginPath(); var pn = false;
        for (var k3 = from; k3 <= to; k3++) { var v2 = sr.arr[k3]; if (v2 == null) { pn = false; continue; } if (!pn) { c.moveTo(X(k3), PY(v2)); pn = true; } else c.lineTo(X(k3), PY(v2)); }
        c.stroke();
      });
      if (!d.range && !d.levels && hasVals(series, from, to)) { c.fillStyle = muted; c.fillText(fmtShort(mx2), L.x1 + 8, P.y0 + 8); c.fillText(fmtShort(mn), L.x1 + 8, P.y1 - 8); }
      if (!hasVals(series, from, to)) { c.fillStyle = muted; c.textAlign = 'center'; c.fillText(needText(d, s), (L.x0 + L.x1) / 2, (P.y0 + P.y1) / 2 + 4); c.textAlign = 'left'; }
      // "RSI (14)  48.65": the name in ink, then each value in its line's colour
      c.textBaseline = 'top'; c.font = '600 11.5px "IBM Plex Sans", system-ui, -apple-system, sans-serif';
      var pl = d.label + (d.needsVolume && !s.v[s.n - 1] ? ' (needs volume)' : ''), plx = L.x0 + 4, pli = self.hoverIdx != null ? self.hoverIdx : to;
      c.fillStyle = ink; c.fillText(pl, plx, P.y0 + 3); plx += c.measureText(pl).width + 8; c.font = '500 11.5px "IBM Plex Sans", system-ui, -apple-system, sans-serif';
      series.forEach(function (sr) { var vv = sr.arr[pli]; if (vv == null) return; var tx = fmtShort(vv); c.fillStyle = sr.color; c.fillText(tx, plx, P.y0 + 3); plx += c.measureText(tx).width + 8; });
      if (histArr && histArr[pli] != null) { c.fillStyle = histArr[pli] >= 0 ? bull : bear; c.fillText(fmtShort(histArr[pli]), plx, P.y0 + 3); }
      c.textBaseline = 'middle'; c.font = '500 11px "IBM Plex Sans", system-ui, -apple-system, sans-serif';
    });
    // crosshair + legend
    var hi2 = null;
    if (this.hover && this.hover.x >= L.x0 && this.hover.x <= L.x1) {
      hi2 = Math.max(from, Math.min(to, Math.floor((this.hover.x - L.x0) / bw) + from));
      var hx = X(hi2);
      c.strokeStyle = cross; c.setLineDash([2, 3]); c.beginPath(); c.moveTo(hx, L.y0); c.lineTo(hx, this.H - 16); c.stroke();
      if (this.hover.y >= L.y0 && this.hover.y <= L.y1) {
        c.beginPath(); c.moveTo(L.x0, this.hover.y); c.lineTo(L.x1, this.hover.y); c.stroke();
        var hp = hi - (this.hover.y - L.y0) / (L.y1 - L.y0) * (hi - lo);
        c.setLineDash([]); c.fillStyle = ink; c.fillRect(L.x1 + 1, this.hover.y - 8, 62, 16); c.fillStyle = bg; c.fillText(fmt(hp), L.x1 + 6, this.hover.y);
      }
      c.setLineDash([]);
      var dl = s.d[hi2], tw = c.measureText(dl).width + 10;
      c.fillStyle = ink; c.fillRect(hx - tw / 2, this.H - 16, tw, 15); c.fillStyle = bg; c.textAlign = 'center'; c.fillText(dl, hx, this.H - 8.5); c.textAlign = 'left';
    }
    var li = hi2 == null ? to : hi2;
    this.hoverIdx = hi2;
    // the legend: one row each for the prices, the averages, each band and volume; names in ink,
    // values in colour (prices green or red with the candle)
    var cUp = s.c[li] >= s.o[li], pcol = cUp ? bull : bear;
    var lab = function (t) { return [t, ink, 'l']; }, sub = function (t) { return [t, muted, 's']; }, val = function (t, cc) { return [t, cc, 'v']; };
    var rows = [[lab('O'), val(fmt(s.o[li]), pcol), lab('H'), val(fmt(s.h[li]), pcol), lab('L'), val(fmt(s.l[li]), pcol), lab('C'), val(fmt(s.c[li]), pcol)].concat(s.v[li] ? [lab('V'), val(fmtVol(s.v[li]), pcol)] : [])];
    var avg = [];
    overlays.forEach(function (d) {
      var v = s.ind[d.id], name = d.label.split(' (')[0], cc = d.id === 'bb' && hexOk(IC.bb) ? IC.bb : col(d.color, acc);
      if (d.intradayOnly && !s.intraday) return; // e.g. VWAP on a daily chart: nothing to show
      if (!hasVals([{ arr: d.band ? v.up : v }], from, to)) { avg.push(lab(name), sub(needText(d, s))); return; }
      if (d.band) rows.push([lab(name === 'Bollinger Bands' ? 'BB (20)' : name === 'Donchian Channel' ? 'DC (20)' : name), sub('Lower'), val(fmt(v.lo[li]), cc)].concat(v.mid ? [sub('Mid'), val(fmt(v.mid[li]), cc)] : []).concat([sub('Upper'), val(fmt(v.up[li]), cc)]));
      else avg.push(lab(name), val(fmt(v[li]), cc));
    });
    if (avg.length) rows.push(avg);
    if (L.vol) rows.push([lab('Volume'), val(fmtVol(s.v[li]), pcol)]);
    if (cmpAt) {
      var f0 = null; for (var fk = from; fk <= li; fk++) if (CMP.r[fk] != null) { f0 = fk; break; }
      if (f0 != null && CMP.r[li] != null) {
        var mine = (s.c[li] / s.c[f0] - 1) * 100, theirs = (CMP.r[li] / CMP.r[f0] - 1) * 100, pc = function (v) { return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; };
        rows.push([lab(s.sym || 'This'), val(pc(mine), mine >= 0 ? bull : bear), lab('vs ' + CMP.label), val(pc(theirs), col(CMP.color || 'violet', '#8f7bf6'))]);
      }
    }
    var LH = 19, ly2 = 8 + LH / 2;
    c.textBaseline = 'middle';
    rows.forEach(function (row, r) {
      var lx = L.x0 + 4;
      row.forEach(function (pt, k) {
        c.font = (pt[2] === 'l' ? '600 ' : '500 ') + '12px "IBM Plex Sans", system-ui, -apple-system, sans-serif';
        var w = c.measureText(pt[0]).width;
        if (lx + w > L.x1 && lx > L.x0 + 4) { lx = L.x0 + 4; ly2 += LH; }
        c.fillStyle = pt[1]; c.fillText(pt[0], lx, ly2);
        var next = row[k + 1];
        lx += w + (pt[2] === 'v' ? 12 : next && next[2] !== 'v' ? 8 : 5); // a name sits close to its value
      });
      if (r < rows.length - 1) {
        c.strokeStyle = grid; c.lineWidth = 1; c.beginPath(); c.moveTo(L.x0, Math.round(ly2 + LH / 2) + 0.5); c.lineTo(L.x1, Math.round(ly2 + LH / 2) + 0.5); c.stroke();
        ly2 += LH;
      }
    });
    c.font = '500 11px "IBM Plex Sans", system-ui, -apple-system, sans-serif';
    // the price area starts below the legend (on a phone it wraps onto more lines); it only grows
    // while the crosshair moves, so the chart does not jump around under your finger
    var nrows = Math.round((ly2 - 8 - LH / 2) / LH) + 1;
    if (nrows !== this.legendRows && !(this.hover && nrows < this.legendRows)) { this.legendRows = nrows; if (!this._relayout) { this._relayout = true; this.draw(); this._relayout = false; } }
  };
  function hasVals(series, from, to) {
    for (var k = from; k <= to; k++) for (var j = 0; j < series.length; j++) if (series[j].arr && series[j].arr[k] != null) return true;
    return false;
  }
  // an indicator with nothing to draw: it needs more bars than this timeframe has (e.g. SMA 50
  // on hourly bars, where 5 days of history is about 35 bars)
  // a rounded tag on the price axis (falls back to a square on old browsers)
  function pill(c, x, y, w, h, color) {
    c.fillStyle = color; c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, h / 2); else c.rect(x, y, w, h);
    c.fill();
  }
  function needText(d, s) { if (d.intradayOnly && !s.intraday) return 'intraday charts only'; return d.need && s.n < d.need ? 'needs ' + d.need + ' bars (has ' + s.n + ')' : 'needs more history'; }
  function fmtShort(v) { if (v == null || isNaN(v)) return '–'; var a = Math.abs(v); return a >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : a >= 1e4 ? (v / 1e3).toFixed(1) + 'K' : a >= 100 ? v.toFixed(1) : v.toFixed(2); }
  function niceStep(raw) { var p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; }

  // ------------------------------------------------------------ Trade War price alerts
  // [{ id, sym, price, dir: 'above'|'below', status: 'active'|'triggered', createdAt, triggeredAt, updatedAt }]
  // Kept in this browser (localStorage) and, when signed in, in users/{uid}.twAlerts so
  // they follow the person between the $10,000 account, matches and the app. They fire while
  // a page is open; with it closed, the server checks them on every price update
  // (functions/price_alerts.py, using twAlertsActive to find who has waiting ones).
  var ALERT_KEY = 'zelosTwAlerts', ALERT_MAX = 50;
  function AlertStore() { this.list = []; this.ref = null; try { this.list = JSON.parse(localStorage.getItem(ALERT_KEY) || '[]') || []; } catch (e) {} }
  AlertStore.prototype.save = function () {
    this.list = this.list.slice(-ALERT_MAX);
    try { localStorage.setItem(ALERT_KEY, JSON.stringify(this.list)); } catch (e) {}
    var waiting = this.list.filter(function (a) { return a && a.status === 'active'; }).length;
    if (this.ref) this.ref.set({ twAlerts: this.list, twAlertsActive: waiting }, { merge: true }).catch(function () {});
  };
  AlertStore.prototype.attach = function (db, uid, done) {
    var self = this; this.ref = db && uid ? db.collection('users').doc(uid) : null; if (!this.ref) return;
    this.ref.get().then(function (d) {
      var remote = (d.exists && d.data().twAlerts) || [], by = {};
      remote.concat(self.list).forEach(function (a) { if (a && a.id && (!by[a.id] || (a.updatedAt || 0) > (by[a.id].updatedAt || 0))) by[a.id] = a; });
      self.list = Object.keys(by).map(function (k) { return by[k]; }).filter(function (a) { return !a.deleted; }).sort(function (a, b) { return a.createdAt - b.createdAt; });
      self.save(); if (done) done();
    }).catch(function () {});
  };
  AlertStore.prototype.add = function (sym, price, current) {
    var a = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), sym: sym, price: price, dir: current != null && price < current ? 'below' : 'above',
      status: 'active', createdAt: Date.now(), updatedAt: Date.now() };
    this.list.push(a); this.save(); return a;
  };
  AlertStore.prototype.update = function (id, price, current) {
    this.list.forEach(function (a) { if (a.id === id) { a.price = price; if (current != null) a.dir = price < current ? 'below' : 'above'; a.status = 'active'; a.triggeredAt = null; a.updatedAt = Date.now(); } });
    this.save();
  };
  AlertStore.prototype.remove = function (id) { this.list = this.list.filter(function (a) { return a.id !== id; }); this.save(); };
  AlertStore.prototype.forSym = function (sym) { return this.list.filter(function (a) { return a.sym === sym && a.status === 'active'; }); };
  // prices: { SYM: price } -> the alerts that just fired (each fires once)
  AlertStore.prototype.check = function (prices) {
    var hit = [];
    this.list.forEach(function (a) {
      var p = prices[a.sym]; if (a.status !== 'active' || p == null) return;
      if ((a.dir === 'above' && p >= a.price) || (a.dir === 'below' && p <= a.price)) { a.status = 'triggered'; a.triggeredAt = Date.now(); a.updatedAt = Date.now(); a.hitPrice = p; hit.push(a); }
    });
    if (hit.length) this.save();
    return hit;
  };

  // Three-leg drawings, one per symbol, kept in this browser
  var ABC_KEY = 'zelosTwAbc';
  var abcStore = {
    get: function (sym) { try { return (JSON.parse(localStorage.getItem(ABC_KEY) || '{}') || {})[sym] || null; } catch (e) { return null; } },
    set: function (sym, abc) { try { var all = JSON.parse(localStorage.getItem(ABC_KEY) || '{}') || {}; if (abc) all[sym] = abc; else delete all[sym]; localStorage.setItem(ABC_KEY, JSON.stringify(all)); } catch (e) {} }
  };

  // ------------------------------------------------------------ mount anywhere
  // Our chart on any page (dashboard, alert pop-ups): daily history the server saves
  // (zelos-mdata.js) plus the latest price from markets/quotes. opts: { root, sym, pick, db, height,
  // lines: [..] | fn(sym) -> [..], bars, missing: fn(sym) -> message }
  var histP = null;
  function loadHistory(root) {
    if (!histP) histP = Promise.all([
      (window.ZelosData ? ZelosData.history() : Promise.resolve({ symbols: {} })),
      Promise.resolve({ symbols: {} })
    ]).then(function (res) { var h = {}; [res[0].symbols, res[1].symbols].forEach(function (src) { Object.keys(src || {}).forEach(function (k) { h[k] = src[k]; }); }); return h; });
    return histP;
  }
  function nyDay(ms) { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(ms)); } catch (e) { return new Date(ms).toISOString().slice(0, 10); } }
  function dailySeries(sym, hist, q) {
    var all = (hist[sym] || []).slice(), live = false;
    if (q && q.c && all.length) {
      var qd = q.t ? nyDay(q.t * 1000) : null, lastD = all[all.length - 1][0];
      if (qd && qd > lastD && q.o) { all.push([qd, q.o, Math.max(q.h, q.c), Math.min(q.l, q.c), q.c, 0]); live = true; }
      else if (qd === lastD) { var r = all[all.length - 1].slice(); r[4] = q.c; r[2] = Math.max(r[2], q.c); r[3] = Math.min(r[3], q.c); all[all.length - 1] = r; live = true; }
    }
    var s = { sym: sym, key: sym + '|D', d: [], o: [], h: [], l: [], c: [], v: [], live: live };
    all.forEach(function (r) { s.d.push(r[0]); s.o.push(+r[1]); s.h.push(+r[2]); s.l.push(+r[3]); s.c.push(+r[4]); s.v.push(+r[5] || 0); });
    s.n = s.d.length;
    return computeIndicators(s);
  }
  function mount(el, opts) {
    opts = opts || {};
    var st = { sym: opts.sym || 'SPY', hist: null, quotes: {} };
    el.innerHTML = (opts.pick ? '<div class="ztc-bar" style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><select class="ztc-sym" aria-label="Stock" style="font:inherit;padding:6px 8px;border-radius:6px;border:1px solid var(--border,#2b2e35);background:var(--bg-soft,#101216);color:var(--ink,#f4f5f7)"></select><b class="ztc-px" style="font-family:var(--mono,monospace)"></b></div>' : '') +
      '<canvas class="ztc-canvas" style="display:block;width:100%;height:' + (opts.height || '260px') + ';border-radius:6px;background:var(--chart-bg,rgba(0,0,0,0.25))"></canvas>';
    var chart = new TradeChart(el.querySelector('canvas')), sel = el.querySelector('.ztc-sym'), pxEl = el.querySelector('.ztc-px');
    function draw() {
      if (!st.hist) { chart.empty = 'Loading chart…'; chart.draw(); return; }
      if (!st.hist[st.sym]) { chart.s = null; chart.empty = opts.missing ? opts.missing(st.sym) : 'No chart data for ' + st.sym + ' yet.'; chart.draw(); return; }
      var s = dailySeries(st.sym, st.hist, st.quotes[st.sym]);
      chart.lines = typeof opts.lines === 'function' ? opts.lines(st.sym) : (opts.lines || []);
      chart.lastPrice = s.c[s.n - 1]; chart.empty = null;
      if (pxEl) pxEl.textContent = fmt(chart.lastPrice);
      if (!chart.s || chart.s.key !== s.key) chart.setSeries(s, opts.bars || 126); else chart.setSeries(s);
      chart.draw();
    }
    loadHistory(opts.root).then(function (h) {
      st.hist = h;
      if (sel) { sel.innerHTML = Object.keys(h).sort().map(function (k) { return '<option' + (k === st.sym ? ' selected' : '') + '>' + k + '</option>'; }).join(''); sel.onchange = function () { st.sym = sel.value; draw(); }; }
      draw();
    }).catch(function () { chart.empty = 'Couldn\'t load the chart. Refresh to try again.'; chart.draw(); });
    if (opts.db) { try { opts.db.collection('markets').doc('quotes').onSnapshot(function (d) { st.quotes = (d.exists && d.data().quotes) || {}; if (st.hist) draw(); }, function () {}); } catch (e) {} }
    draw();
    return { chart: chart, setSym: function (x) { st.sym = x; if (sel) sel.value = x; draw(); } };
  }
  global.ZelosTradeChart = {
    loadHistory: loadHistory, dailySeries: dailySeries, mount: mount, TradeChart: TradeChart, computeIndicators: computeIndicators, fmt: fmt, fmtVol: fmtVol,
    INDICATORS: INDICATORS, PRESETS: PRESETS, loadColors: loadColors, saveColors: saveColors, CHART_TYPES: CHART_TYPES, loadIndColors: loadIndColors, saveIndColors: saveIndColors, THEMES: THEMES, setTheme: setTheme, loadTheme: loadTheme, alerts: new AlertStore(), AlertStore: AlertStore, abc: abcStore };
})(window);
