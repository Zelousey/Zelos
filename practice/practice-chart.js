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
    { id: 'sma20', label: 'SMA 20', kind: 'overlay', group: 'Moving averages', color: 'accent', compute: function (s) { return sma(s.c, 20); } },
    { id: 'sma50', label: 'SMA 50', kind: 'overlay', group: 'Moving averages', color: 'gold', compute: function (s) { return sma(s.c, 50); } },
    { id: 'sma200', label: 'SMA 200', kind: 'overlay', group: 'Moving averages', color: '#f472b6', compute: function (s) { return sma(s.c, 200); } },
    { id: 'ema9', label: 'EMA 9', kind: 'overlay', group: 'Moving averages', color: 'violet', compute: function (s) { return ema(s.c, 9); } },
    { id: 'ema21', label: 'EMA 21', kind: 'overlay', group: 'Moving averages', color: '#22d3ee', compute: function (s) { return ema(s.c, 21); } },
    { id: 'bb', label: 'Bollinger Bands (20, 2)', kind: 'overlay', group: 'Bands', color: 'violet', compute: function (s) { return bollinger(s.c, 20, 2); },
      band: ['up', 'lo', 'mid'] },
    { id: 'dc', label: 'Donchian Channel (20)', kind: 'overlay', group: 'Bands', color: '#f59e0b', compute: function (s) { return donchian(s, 20); }, band: ['up', 'lo'] },
    { id: 'rsi', label: 'RSI (14)', kind: 'pane', group: 'Oscillators', range: [0, 100], levels: [30, 70], compute: function (s) { return rsi(s.c, 14); }, lines: [[null, 'violet']] },
    { id: 'stoch', label: 'Stochastic (14, 3)', kind: 'pane', group: 'Oscillators', range: [0, 100], levels: [20, 80], compute: function (s) { return stoch(s, 14, 3); }, lines: [['k', 'accent'], ['d', 'gold']] },
    { id: 'macd', label: 'MACD (12, 26, 9)', kind: 'pane', group: 'Oscillators', zero: true, compute: function (s) { return macd(s.c); }, lines: [['line', 'accent'], ['signal', 'gold']], hist: 'hist' },
    { id: 'atr', label: 'ATR (14)', kind: 'pane', group: 'Volatility & volume', compute: function (s) { return atr(s, 14); }, lines: [[null, '#f59e0b']] },
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
  function rgba(hex, a) { if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex; var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
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
    this.forecast = null; // { entry, sl, tp, label } -> green / red boxes right of the last bar
    var self = this, drag = null;
    function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    canvas.addEventListener('pointerdown', function (e) {
      drag = { x: pos(e).x, from: self.from, to: self.to };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    });
    canvas.addEventListener('pointermove', function (e) {
      var p = pos(e);
      if (drag && self.s) {
        var bw = self.barW(); var shift = Math.round((drag.x - p.x) / bw);
        var span = drag.to - drag.from;
        var to = Math.max(span, Math.min(self.s.n - 1, drag.to + shift));
        self.from = to - span; self.to = to;
      }
      self.hover = p; self.draw();
    });
    function end() { drag = null; }
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', function () { if (!drag) { self.hover = null; self.draw(); } });
    canvas.addEventListener('wheel', function (e) {
      if (!self.s) return; e.preventDefault();
      self.zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, pos(e).x);
    }, { passive: false });
    if ('ResizeObserver' in global) new ResizeObserver(function () { self.resize(); }).observe(canvas);
    else global.addEventListener('resize', function () { self.resize(); });
    global.addEventListener('zelos:theme', function () { self.draw(); });
    this.resize();
  }
  TradeChart.prototype.toggle = function (id, on) {
    this.show[id] = on == null ? !this.show[id] : !!on;
    try { localStorage.setItem('zelosPracticeInd', JSON.stringify(this.show)); } catch (e) {}
    this.draw();
  };
  TradeChart.prototype.resize = function () {
    var dpr = Math.min(global.devicePixelRatio || 1, 2), w = this.cv.clientWidth, h = this.cv.clientHeight;
    if (!w || !h) return;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.W = w; this.H = h; this.dpr = dpr; this.draw();
  };
  TradeChart.prototype.setSeries = function (s, bars) {
    // same stock and timeframe, scrolled to the latest bar: stay pinned to the right edge as bars arrive
    var keep = this.s && this.s.key === s.key && this.to === this.s.n - 1;
    var span = this.s ? this.to - this.from : null;
    this.s = s;
    if (keep && span != null) { this.to = s.n - 1; this.from = Math.max(0, this.to - span); }
    else this.setRange(bars || 126);
  };
  TradeChart.prototype.setRange = function (bars) {
    if (!this.s) return;
    this.to = this.s.n - 1; this.from = bars === 'all' ? 0 : Math.max(0, this.to - bars + 1); this.draw();
  };
  TradeChart.prototype.zoom = function (f, x) {
    if (!this.s) return;
    var span = this.to - this.from + 1, ns = Math.max(Math.min(8, this.s.n), Math.min(this.s.n, Math.round(span * f)));
    var L = this.layout(), rel = x == null ? 1 : Math.max(0, Math.min(1, (x - L.x0) / (L.x1 - L.x0)));
    var anchor = this.from + rel * span, from = Math.round(anchor - rel * ns);
    from = Math.max(0, Math.min(this.s.n - ns, from));
    this.from = from; this.to = from + ns - 1; this.draw();
  };
  TradeChart.prototype.padBars = function () { return this.forecast ? Math.max(8, Math.round((this.to - this.from + 1) * 0.16)) : 3; };
  TradeChart.prototype.barW = function () { var L = this.layout(); return (L.x1 - L.x0) / (this.to - this.from + 1 + this.padBars()); };
  TradeChart.prototype.panes = function () {
    var self = this;
    return INDICATORS.filter(function (d) { return d.kind === 'pane' && self.show[d.id]; }).slice(0, 3);
  };
  TradeChart.prototype.layout = function () {
    var padR = 64, top = 40, bottom = 20, gap = 8, H = this.H, panes = this.panes();
    var subH = panes.length ? Math.max(54, Math.round(H * (panes.length > 2 ? 0.13 : 0.16))) : 0;
    var priceB = H - bottom - panes.length * (subH + gap);
    var L = { x0: 8, x1: this.W - padR, y0: top, y1: priceB, panes: [] };
    var y = priceB + gap;
    panes.forEach(function (d) { L.panes.push({ def: d, y0: y, y1: y + subH }); y += subH + gap; });
    L.xAxis = H - 4;
    return L;
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
    var bull = this.colors.up, bear = this.colors.down, acc = cssVar('--accent', '#4a86ff');
    var lightBg = document.documentElement.getAttribute('data-theme') === 'white';
    var muted = cssVar('--muted', '#8a8f98'), green = '#3ecb7c', red = '#e0483f';
    var ink = cssVar('--ink', '#f4f5f7'), grid = cssVar('--chart-grid', 'rgba(255,255,255,0.06)'), cross = cssVar('--chart-cross', 'rgba(255,255,255,0.35)');
    var tagInk = cssVar('--chart-label-ink', '#0b0c0f'), bg = cssVar('--bg', '#0c0d10');
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.W, this.H);
    var bw = this.barW(), from = this.from, to = this.to;
    function X(i) { return L.x0 + (i - from + 0.5) * bw; }
    var overlays = INDICATORS.filter(function (d) { return d.kind === 'overlay' && show[d.id]; });
    // price range: candles, visible overlays, lines, forecast
    var lo = Infinity, hi = -Infinity, vmax = 0, i;
    for (i = from; i <= to; i++) {
      lo = Math.min(lo, s.l[i]); hi = Math.max(hi, s.h[i]); vmax = Math.max(vmax, s.v[i] || 0);
      overlays.forEach(function (d) {
        var v = s.ind[d.id];
        (d.band ? d.band.map(function (k) { return v[k][i]; }) : [v[i]]).forEach(function (x) { if (x != null && x > s.l[i] * 0.6 && x < s.h[i] * 1.6) { lo = Math.min(lo, x); hi = Math.max(hi, x); } });
      });
    }
    this.lines.forEach(function (ln) { if (ln.price > lo * 0.8 && ln.price < hi * 1.25) { lo = Math.min(lo, ln.price); hi = Math.max(hi, ln.price); } });
    if (this.forecast) [this.forecast.sl, this.forecast.tp].forEach(function (v) { if (v) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    var pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
    function Y(p) { return L.y0 + (hi - p) / (hi - lo) * (L.y1 - L.y0); }
    c.font = '500 10px "IBM Plex Mono", ui-monospace, monospace'; c.textBaseline = 'middle';
    // grid + price axis
    var step = niceStep((hi - lo) / 6);
    for (var g = Math.ceil(lo / step) * step; g < hi; g += step) {
      var gy = Y(g); c.strokeStyle = grid; c.lineWidth = 1; c.beginPath(); c.moveTo(L.x0, gy); c.lineTo(L.x1, gy); c.stroke();
      c.fillStyle = muted; c.fillText(fmt(g, g >= 1000 ? 0 : 2), L.x1 + 8, gy);
    }
    // time axis
    c.textBaseline = 'alphabetic';
    var lastM = null, MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], lastX = -1e9;
    for (i = from; i <= to; i++) {
      if (s.intraday) {
        var day = s.d[i].slice(0, 10), hr = s.d[i].slice(11, 13);
        var isDay = day !== lastM, isHour = !isDay && i > from && s.d[i - 1].slice(11, 13) !== hr;
        if (isDay) lastM = day;
        if ((isDay || isHour) && X(i) - lastX > (isDay ? 40 : 34)) {
          var ix = X(i); lastX = ix;
          c.strokeStyle = grid; c.beginPath(); c.moveTo(ix, L.y0); c.lineTo(ix, L.y1); c.stroke();
          c.fillStyle = isDay ? ink : muted;
          c.fillText(isDay ? MN[parseInt(day.slice(5, 7), 10) - 1] + ' ' + parseInt(day.slice(8, 10), 10) : s.d[i].slice(11, 16), ix + 3, L.xAxis);
        }
        continue;
      }
      var m = s.d[i].slice(0, 7);
      if (m !== lastM) {
        lastM = m; var mx = X(i);
        if (mx - lastX > 46) {
          lastX = mx;
          c.strokeStyle = grid; c.beginPath(); c.moveTo(mx, L.y0); c.lineTo(mx, L.y1); c.stroke();
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
    // band fills under the candles
    overlays.forEach(function (d) {
      if (!d.band) return;
      var v = s.ind[d.id], cc = col(d.color, '#8f7bf6');
      c.beginPath(); var started = false;
      for (var k = from; k <= to; k++) { if (v.up[k] == null) continue; if (!started) { c.moveTo(X(k), Y(v.up[k])); started = true; } else c.lineTo(X(k), Y(v.up[k])); }
      for (k = to; k >= from; k--) { if (v.lo[k] == null) continue; c.lineTo(X(k), Y(v.lo[k])); }
      c.closePath(); c.globalAlpha = 0.07; c.fillStyle = cc; c.fill(); c.globalAlpha = 1;
      pathLine(v.up, cc, 1, 0.6); pathLine(v.lo, cc, 1, 0.6); if (v.mid) pathLine(v.mid, cc, 1, 0.35, [3, 3]);
    });
    // volume (bottom 18% of the price pane)
    if (show.vol && vmax) {
      var vh = (L.y1 - L.y0) * 0.18;
      for (i = from; i <= to; i++) {
        if (!s.v[i]) continue;
        var up = s.c[i] >= s.o[i], h = s.v[i] / vmax * vh;
        c.fillStyle = rgba(up ? bull : bear, 0.28);
        c.fillRect(X(i) - bw * 0.36, L.y1 - h, Math.max(1, bw * 0.72), h);
      }
    }
    overlays.forEach(function (d) { if (!d.band) pathLine(s.ind[d.id], col(d.color, acc), 1.4); });
    // candles
    for (i = from; i <= to; i++) {
      var o = s.o[i], cl = s.c[i], x = X(i), cc = cl >= o ? bull : bear;
      c.strokeStyle = cc; c.lineWidth = 1; c.beginPath(); c.moveTo(x, Y(s.h[i])); c.lineTo(x, Y(s.l[i])); c.stroke();
      var top = Y(Math.max(o, cl)), hgt = Math.max(1, Math.abs(Y(o) - Y(cl)));
      c.fillStyle = cc; c.fillRect(x - bw * 0.36, top, Math.max(1, bw * 0.72), hgt);
      if (lightBg && lum(cc) > 0.8) { c.strokeStyle = '#9aa1ac'; c.strokeRect(x - bw * 0.36, top, Math.max(1, bw * 0.72), hgt); c.beginPath(); c.moveTo(x, Y(s.h[i])); c.lineTo(x, Y(s.l[i])); c.stroke(); }
      if (s.live && i === s.n - 1) { c.strokeStyle = acc; c.setLineDash([2, 2]); c.strokeRect(x - bw * 0.5, Y(s.h[i]) - 2, bw, Y(s.l[i]) - Y(s.h[i]) + 4); c.setLineDash([]); }
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
          c.font = '700 9.5px "IBM Plex Mono", ui-monospace, monospace'; c.fillStyle = k[1];
          c.fillText(k[2] + ' ' + (pctv >= 0 ? '+' : '') + pctv.toFixed(1) + '%', fx0 + 5, k[0] === 'tp' ? tp0 + 10 : tp0 + hh - 9);
          c.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
        }
        c.fillStyle = k[1]; c.fillRect(L.x1 + 1, yB - 8, 62, 16); c.fillStyle = '#0b0c0f'; c.fillText(fmt(v), L.x1 + 6, yB);
      });
      c.strokeStyle = ink; c.globalAlpha = 0.7; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(fx0, Y(F.entry)); c.lineTo(fx1, Y(F.entry)); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      if (F.sl && F.tp && F.entry) {
        var rr = Math.abs(F.tp - F.entry) / Math.max(1e-9, Math.abs(F.entry - F.sl));
        c.font = '700 10px "IBM Plex Mono", ui-monospace, monospace'; c.fillStyle = ink; c.textAlign = 'right';
        c.fillText((F.label ? F.label + ' · ' : '') + rr.toFixed(1) + ':1', fx1 - 5, Y(F.entry) - 8); c.textAlign = 'left';
        c.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
      }
    }
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
      c.font = '600 9px "IBM Plex Mono", ui-monospace, monospace'; c.fillStyle = ln.color; c.textAlign = 'right'; c.textBaseline = 'bottom';
      c.fillText(ln.label, L.x1 - 4, y3 - 2); c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
      c.fillStyle = ln.color; c.fillRect(L.x1 + 1, y3 - 8, 62, 16); c.fillStyle = tagInk; c.fillText(fmt(ln.price), L.x1 + 6, y3);
    });
    // last price tag
    if (this.lastPrice != null) {
      var ly = Y(this.lastPrice), up2 = this.lastPrice >= (s.c[s.n - 2] || this.lastPrice), pc2 = up2 ? bull : bear;
      if (ly >= L.y0 && ly <= L.y1) {
        c.strokeStyle = pc2; c.globalAlpha = 0.6; c.setLineDash([1, 3]); c.beginPath(); c.moveTo(L.x0, ly); c.lineTo(L.x1, ly); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
        c.fillStyle = pc2; c.fillRect(L.x1 + 1, ly - 9, 62, 18); c.fillStyle = lum(pc2) > 0.62 ? '#0b0c0f' : '#ffffff';
        c.font = '700 10px "IBM Plex Mono", ui-monospace, monospace'; c.fillText(fmt(this.lastPrice), L.x1 + 6, ly); c.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
      }
    }
    // indicator panes
    L.panes.forEach(function (P) {
      var d = P.def, v = s.ind[d.id];
      c.strokeStyle = grid; c.strokeRect(L.x0, P.y0, L.x1 - L.x0, P.y1 - P.y0);
      var series = (d.lines || []).map(function (ln) { return { arr: ln[0] ? v[ln[0]] : v, color: col(ln[1], acc) }; });
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
      (d.levels || []).forEach(function (lv) {
        c.strokeStyle = grid; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(L.x0, PY(lv)); c.lineTo(L.x1, PY(lv)); c.stroke(); c.setLineDash([]);
        c.fillStyle = muted; c.fillText(String(lv), L.x1 + 8, PY(lv));
      });
      if (d.levels && d.levels.length === 2) { c.fillStyle = 'rgba(143,123,246,0.05)'; c.fillRect(L.x0, PY(d.levels[1]), L.x1 - L.x0, PY(d.levels[0]) - PY(d.levels[1])); }
      if (histArr) for (var k2 = from; k2 <= to; k2++) { var hv = histArr[k2]; if (hv == null) continue; c.fillStyle = hv >= 0 ? rgba(bull, 0.5) : rgba(bear, 0.5); c.fillRect(X(k2) - bw * 0.3, Math.min(PY(0), PY(hv)), Math.max(1, bw * 0.6), Math.abs(PY(hv) - PY(0))); }
      series.forEach(function (sr) {
        c.strokeStyle = sr.color; c.lineWidth = 1.2; c.beginPath(); var pn = false;
        for (var k3 = from; k3 <= to; k3++) { var v2 = sr.arr[k3]; if (v2 == null) { pn = false; continue; } if (!pn) { c.moveTo(X(k3), PY(v2)); pn = true; } else c.lineTo(X(k3), PY(v2)); }
        c.stroke();
      });
      if (!d.range && !d.levels) { c.fillStyle = muted; c.fillText(fmtShort(mx2), L.x1 + 8, P.y0 + 8); c.fillText(fmtShort(mn), L.x1 + 8, P.y1 - 8); }
      c.fillStyle = muted; c.textBaseline = 'top'; c.fillText(d.label + (d.needsVolume && !s.v[s.n - 1] ? ' (needs volume)' : ''), L.x0 + 4, P.y0 + 3); c.textBaseline = 'middle';
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
    var chg = li > 0 ? (s.c[li] / s.c[li - 1] - 1) * 100 : 0;
    var parts = [
      [s.d[li] + (s.live && li === s.n - 1 ? ' (today)' : ''), muted],
      ['O ' + fmt(s.o[li]), ink], ['H ' + fmt(s.h[li]), ink], ['L ' + fmt(s.l[li]), ink], ['C ' + fmt(s.c[li]), ink],
      [(chg >= 0 ? '+' : '') + fmt(chg) + '%', chg >= 0 ? bull : bear], ['Vol ' + fmtVol(s.v[li]), muted]
    ];
    overlays.forEach(function (d) {
      var v = s.ind[d.id];
      parts.push([d.label.split(' (')[0] + ' ' + (d.band ? fmt(v.up[li]) + '/' + fmt(v.lo[li]) : fmt(v[li])), col(d.color, acc)]);
    });
    L.panes.forEach(function (P) {
      var d = P.def, v = s.ind[d.id];
      var val = (d.lines || []).map(function (ln) { return fmtShort(ln[0] ? v[ln[0]][li] : v[li]); }).join(' / ');
      parts.push([d.label.split(' (')[0] + ' ' + val, col((d.lines[0] || [])[1], acc)]);
    });
    c.font = '500 10.5px "IBM Plex Mono", ui-monospace, monospace'; c.textBaseline = 'middle';
    var lx = L.x0 + 2, ly2 = 10;
    parts.forEach(function (pt) {
      var w = c.measureText(pt[0]).width;
      if (lx + w > L.x1) { lx = L.x0 + 2; ly2 += 14; }
      c.fillStyle = pt[1]; c.fillText(pt[0], lx, ly2); lx += w + 12;
    });
  };
  function fmtShort(v) { if (v == null || isNaN(v)) return '–'; var a = Math.abs(v); return a >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : a >= 1e4 ? (v / 1e3).toFixed(1) + 'K' : a >= 100 ? v.toFixed(1) : v.toFixed(2); }
  function niceStep(raw) { var p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; }

  global.ZelosTradeChart = { TradeChart: TradeChart, computeIndicators: computeIndicators, fmt: fmt, fmtVol: fmtVol,
    INDICATORS: INDICATORS, PRESETS: PRESETS, loadColors: loadColors, saveColors: saveColors };
})(window);
