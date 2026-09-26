/*!
 * Zelos Arcade chart engine: shared by Chart Replay, Grade the Setup,
 * Where's the Stop and the Daily Challenge.
 *
 * All charts are real daily bars (split-adjusted, regular session) from
 * /data/game-charts.json. Tickers and dates stay hidden until a round ends.
 *
 * The rules in evaluateSetup() mirror the public Swing Trader checklist
 * (trend, support, volume, reward:risk). They are a teaching version of
 * the checklist, not the live scoring engine.
 */
(function (global) {
  'use strict';

  var DATA_URL = (global.ZC_DATA_URL || '../data/game-charts.json');
  var cache = null;

  // ------------------------------------------------------------ utils
  function cssVar(name, fb) {
    try { var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fb; }
    catch (e) { return fb; }
  }
  function rng(seed) {
    var a = (typeof seed === 'string' ? hashStr(seed) : seed) >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function etDateStr(d) {
    d = d || new Date();
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    } catch (e) { return d.toISOString().slice(0, 10); }
  }
  function fmt(n, d) { return (n == null || isNaN(n)) ? '–' : Number(n).toFixed(d == null ? 2 : d); }
  function money(n) { var s = Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 }); return (n < 0 ? '-$' : '$') + s; }
  function monthYear(dstr) {
    var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return m[parseInt(dstr.slice(5, 7), 10) - 1] + ' ' + dstr.slice(0, 4);
  }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  // ------------------------------------------------------------ data
  function load() {
    if (cache) return Promise.resolve(cache);
    return fetch(DATA_URL).then(function (r) { if (!r.ok) throw new Error('chart data ' + r.status); return r.json(); })
      .then(function (j) {
        var series = {};
        Object.keys(j.symbols).forEach(function (sym) {
          var rows = j.symbols[sym];
          var s = { sym: sym, d: [], o: [], h: [], l: [], c: [], v: [] };
          rows.forEach(function (r) { s.d.push(r[0]); s.o.push(r[1]); s.h.push(r[2]); s.l.push(r[3]); s.c.push(r[4]); s.v.push(r[5]); });
          s.n = rows.length;
          s.sma20 = sma(s.c, 20); s.sma50 = sma(s.c, 50);
          s.vol20 = sma(s.v, 20); s.atr = atr(s, 14);
          series[sym] = s;
        });
        cache = { meta: j, series: series, symbols: Object.keys(series).filter(function (s) { return s !== 'SPY' && s !== 'QQQ'; }) };
        return cache;
      });
  }
  function sma(arr, n) {
    var out = new Array(arr.length), sum = 0;
    for (var i = 0; i < arr.length; i++) {
      sum += arr[i]; if (i >= n) sum -= arr[i - n];
      out[i] = i >= n - 1 ? sum / n : null;
    }
    return out;
  }
  function atr(s, n) {
    var out = new Array(s.n), prev = null;
    for (var i = 0; i < s.n; i++) {
      var tr = i ? Math.max(s.h[i] - s.l[i], Math.abs(s.h[i] - s.c[i - 1]), Math.abs(s.l[i] - s.c[i - 1])) : s.h[i] - s.l[i];
      prev = prev == null ? tr : (prev * (n - 1) + tr) / n;
      out[i] = i >= n ? prev : null;
    }
    return out;
  }
  function minRange(a, from, to) { var m = Infinity; for (var i = from; i <= to; i++) if (a[i] < m) m = a[i]; return m; }
  function maxRange(a, from, to) { var m = -Infinity; for (var i = from; i <= to; i++) if (a[i] > m) m = a[i]; return m; }
  function avgRange(a, from, to) { var s = 0; for (var i = from; i <= to; i++) s += a[i]; return s / (to - from + 1); }

  // ------------------------------------------------------------ the checklist
  function evaluateSetup(s, i) {
    var c = s.c[i], m20 = s.sma20[i], m50 = s.sma50[i], m50p = s.sma50[i - 10], a = s.atr[i];
    var hi10 = maxRange(s.h, i - 9, i);
    var trend = c > m50 && m50 > m50p;
    var distTo20 = (c - m20) / m20;
    var pulledBack = hi10 >= c * 1.03;
    var support = Math.abs(distTo20) <= 0.03 && pulledBack;
    var vol3 = avgRange(s.v, i - 2, i), volPrior = avgRange(s.v, i - 22, i - 3);
    var volume = vol3 < volPrior * 0.9;
    var entry = c;
    // same structural stop the stop drill teaches: under the 10-day swing low,
    // and never closer than one average daily range
    var stop = Math.min(minRange(s.l, i - 9, i) - 0.1 * a, c - 1.0 * a);
    var target = maxRange(s.h, i - 30, i);
    var rr = (target - entry) / Math.max(0.01, entry - stop);
    var reward = rr >= 2;
    return {
      i: i, entry: entry, stop: stop, target: target, rr: rr,
      trend: trend, support: support, volume: volume, reward: reward,
      qualifies: trend && support && volume && reward,
      detail: {
        trend: 'Close ' + fmt(c) + ' vs 50-day avg ' + fmt(m50) + '; the 50-day avg is ' + (m50 > m50p ? 'rising' : 'falling') + ' (' + fmt(m50p) + ' ten days earlier).',
        support: 'Price is ' + (distTo20 >= 0 ? '+' : '') + fmt(distTo20 * 100, 1) + '% from the 20-day avg (' + fmt(m20) + ')' + (pulledBack ? ', after pulling back from ' + fmt(hi10) + '.' : ', with no real pullback in the last 10 days.'),
        volume: 'Last 3 days averaged ' + Math.round(vol3 / 1e5) / 10 + 'M shares vs ' + Math.round(volPrior / 1e5) / 10 + 'M over the prior 20 (' + (vol3 < volPrior * 0.9 ? 'lighter' : 'not lighter') + ').',
        reward: 'Entry ' + fmt(entry) + ', stop ' + fmt(stop) + ' (under the 10-day swing low), target ' + fmt(target) + ' (recent high): ' + fmt(rr, 1) + ':1.'
      }
    };
  }
  // what happened next if the trade was taken at the close with that stop/target
  function simulate(s, i, entry, stop, target, bars) {
    var risk = entry - stop;
    for (var k = i + 1; k <= Math.min(s.n - 1, i + bars); k++) {
      if (s.o[k] <= stop) return { kind: 'stop', r: (s.o[k] - entry) / risk, day: k - i, gap: true };
      if (s.l[k] <= stop) return { kind: 'stop', r: -1, day: k - i };
      if (target && s.h[k] >= target) return { kind: 'target', r: (target - entry) / risk, day: k - i };
    }
    var last = s.c[Math.min(s.n - 1, i + bars)];
    return { kind: 'open', r: (last - entry) / risk, day: bars };
  }

  // candidate pickers ------------------------------------------------
  function gradeCandidates(data) {
    if (data._grade) return data._grade;
    var yes = [], no = [];
    data.symbols.forEach(function (sym) {
      var s = data.series[sym];
      for (var i = 70; i < s.n - 21; i += 1) {
        var e = evaluateSetup(s, i);
        if (e.entry <= e.stop) continue;
        if (e.qualifies) yes.push([sym, i]);
        else if (i % 3 === 0 && (e.trend || e.support)) no.push([sym, i]);
      }
    });
    data._grade = { yes: yes, no: no };
    return data._grade;
  }
  function pickGrade(data, r) {
    var c = gradeCandidates(data);
    var pool = (r() < 0.45 && c.yes.length) ? c.yes : c.no;
    var p = pool[Math.floor(r() * pool.length)];
    return { s: data.series[p[0]], i: p[1] };
  }
  function pickStop(data, r) {
    for (var tries = 0; tries < 400; tries++) {
      var sym = data.symbols[Math.floor(r() * data.symbols.length)], s = data.series[sym];
      var i = 70 + Math.floor(r() * (s.n - 70 - 22));
      var a = s.atr[i], c = s.c[i], sw = minRange(s.l, i - 9, i);
      if (c > s.sma50[i] && (c - sw) > 1.0 * a && (c - sw) < 4 * a) return { s: s, i: i };
    }
    var s0 = data.series[data.symbols[0]]; return { s: s0, i: 120 };
  }
  function pickReplay(data, r, len, hist) {
    var sym = data.symbols[Math.floor(r() * data.symbols.length)], s = data.series[sym];
    var start = hist + Math.floor(r() * (s.n - hist - len - 1));
    return { s: s, start: start, len: len, hist: hist };
  }

  // ------------------------------------------------------------ chart
  // Canvas candlestick chart shared by every game.
  //   lines    [{ price, color, label, dash, fit }]  thin reference lines; the price
  //            tag sits in the right-hand axis gutter so nothing covers the candles
  //   box      { from, entry, stop, target }  green-target / red-stop forecast boxes
  //            drawn from bar `from` to the right edge (use padBars to leave empty
  //            room right of the last candle so the boxes never cover price)
  //   handles  [{ id, price, color, label, pulse }]  draggable grips; onDrag(id, price,
  //            'move'|'end') fires while dragging and on release
  //   prompt   { text, color }  pulsing call-to-action drawn on the chart itself
  //   revealTo bar index: candles after it stay hidden (for animated reveals)
  // candle colors picked on the Practice Account chart (shared localStorage key)
  function candleColors(bull, bear) {
    try { var c = JSON.parse(localStorage.getItem('zelosChartColors') || 'null'); if (c && /^#[0-9a-f]{6}$/i.test(c.up) && /^#[0-9a-f]{6}$/i.test(c.down)) return c; } catch (e) {}
    return { up: bull, down: bear };
  }
  function hexA(hex, a) { if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex; var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
  var REDUCED = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function Chart(canvas, opts) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.opts = opts || {};
    this.s = null; this.from = 0; this.to = 0; this.cut = null; this.lines = []; this.zones = []; this.marks = [];
    this.padBars = 0; this.box = null; this.handles = []; this.prompt = null; this.revealTo = null; this.banner = null;
    this.hoverY = null; this.onPick = null; this.onDrag = null; this.pickLine = null; this.showMA = true;
    this.drag = null; this._anim = null;
    var self = this;
    function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    canvas.addEventListener('pointermove', function (e) {
      var p = pos(e); self.hoverY = p.y; self.hoverX = p.x;
      if (self.drag) {
        var pr = self.priceAt(p.y, true);
        if (pr != null && self.onDrag) self.onDrag(self.drag.id, pr, 'move');
      } else {
        canvas.style.cursor = self.handleAt(p.y) ? 'ns-resize' : '';
      }
      self.draw();
    });
    canvas.addEventListener('pointerleave', function () { if (!self.drag) { self.hoverY = null; self.draw(); } });
    canvas.addEventListener('pointerdown', function (e) {
      var p = pos(e), h = self.handleAt(p.y);
      if (h && self.onDrag) {
        e.preventDefault();
        self.drag = h; self._frozen = self._r;
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        return;
      }
      if (!self.onPick) return;
      var pr = self.priceAt(p.y);
      if (pr != null) self.onPick(pr);
    });
    function endDrag(e) {
      if (!self.drag) return;
      var h = self.drag, pr = self.priceAt(pos(e).y, true);
      self.drag = null; self._frozen = null;
      if (self.onDrag) self.onDrag(h.id, pr == null ? h.price : pr, 'end');
      self.draw();
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    if ('ResizeObserver' in global) new ResizeObserver(function () { self.resize(); }).observe(canvas);
    else global.addEventListener('resize', function () { self.resize(); });
    global.addEventListener('zelos:theme', function () { self.draw(); });
    this.resize();
  }
  Chart.prototype.resize = function () {
    var dpr = Math.min(global.devicePixelRatio || 1, 2), w = this.cv.clientWidth, h = this.cv.clientHeight;
    if (!w || !h) return;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.W = w; this.H = h; this.dpr = dpr; this.draw();
  };
  Chart.prototype.set = function (s, from, to, cut) { this.s = s; this.from = from; this.to = to; this.cut = cut == null ? null : cut; this.draw(); };
  Chart.prototype.layout = function () {
    var padR = 62, volH = Math.round(this.H * 0.14);
    return { x0: 6, x1: this.W - padR, y0: 12, y1: this.H - volH - 18, vy0: this.H - volH - 4, vy1: this.H - 4 };
  };
  Chart.prototype.range = function () {
    if (this._frozen) return this._frozen;
    var s = this.s, lo = Infinity, hi = -Infinity;
    for (var i = this.from; i <= this.to; i++) { if (s.l[i] < lo) lo = s.l[i]; if (s.h[i] > hi) hi = s.h[i]; }
    var extra = [];
    this.lines.forEach(function (ln) { if (ln.fit !== false) extra.push(ln.price); });
    this.handles.forEach(function (h) { if (h.price != null) extra.push(h.price); });
    if (this.box) [this.box.entry, this.box.stop, this.box.target].forEach(function (v) { if (v != null) extra.push(v); });
    extra.forEach(function (v) { lo = Math.min(lo, v); hi = Math.max(hi, v); });
    var pad = (hi - lo) * 0.08 || 1;
    return { lo: lo - pad, hi: hi + pad };
  };
  // clamp=true keeps dragging usable past the plot edges
  Chart.prototype.priceAt = function (y, clamp) {
    if (!this.s) return null;
    var L = this.layout(), R = this._r || this.range();
    if (clamp) y = Math.max(L.y0, Math.min(L.y1, y));
    else if (y < L.y0 || y > L.y1) return null;
    return R.hi - (y - L.y0) / (L.y1 - L.y0) * (R.hi - R.lo);
  };
  Chart.prototype.yOf = function (p) { var L = this.layout(), R = this._r || this.range(); return L.y0 + (R.hi - p) / (R.hi - R.lo) * (L.y1 - L.y0); };
  Chart.prototype.handleAt = function (y) {
    if (!this.s || !this.onDrag) return null;
    var best = null, bd = 12;
    for (var k = 0; k < this.handles.length; k++) {
      var h = this.handles[k]; if (h.price == null) continue;
      var d = Math.abs(this.yOf(h.price) - y);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  };
  Chart.prototype.needsAnim = function () {
    return !REDUCED && !!(this.prompt || this.banner || this.handles.some(function (h) { return h.pulse; }));
  };
  Chart.prototype.draw = function () {
    var c = this.ctx, s = this.s; if (!s || !this.W) return;
    var self = this;
    if (this.needsAnim() && !this._anim) {
      var tick = function () { if (!self.needsAnim() || !self.cv.isConnected) { self._anim = null; return; } self._draw(); self._anim = setTimeout(function () { requestAnimationFrame(tick); }, 33); };
      this._anim = true; requestAnimationFrame(tick);
    }
    this._draw();
  };
  Chart.prototype._draw = function () {
    var c = this.ctx, s = this.s; if (!s || !this.W) return;
    var L = this.layout(), R = this.range(); this._r = R;
    this.cv.style.touchAction = (this.onDrag && this.handles.length) ? 'none' : '';
    var bull = cssVar('--bull', '#3ecb7c'), bear = cssVar('--danger', '#e0483f'), acc = cssVar('--accent', '#4a86ff');
    var gold = cssVar('--gold', '#d9a441'), muted = cssVar('--muted', '#8a8f98'), ink = cssVar('--ink', '#e8e6e1');
    var grid = cssVar('--chart-grid', 'rgba(255,255,255,0.06)'), cross = cssVar('--chart-cross', 'rgba(255,255,255,0.35)'), tagInk = cssVar('--chart-label-ink', '#0b0c0f');
    var cc = candleColors(bull, bear);
    var t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    var pulseA = REDUCED ? 1 : 0.55 + 0.45 * Math.sin(t * 4);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.W, this.H);
    var n = this.to - this.from + 1 + (this.padBars || 0), bw = (L.x1 - L.x0) / n;
    var from0 = this.from; function X(i) { return L.x0 + (i - from0 + 0.5) * bw; }
    var self = this;
    function Y(p) { return L.y0 + (R.hi - p) / (R.hi - R.lo) * (L.y1 - L.y0); }
    var lastShown = this.revealTo == null ? this.to : Math.min(this.to, this.revealTo);
    // grid + axis
    c.font = '500 10px "IBM Plex Mono", ui-monospace, monospace'; c.textBaseline = 'middle';
    var step = niceStep((R.hi - R.lo) / 5);
    for (var g = Math.ceil(R.lo / step) * step; g < R.hi; g += step) {
      var gy = Y(g); c.strokeStyle = grid; c.lineWidth = 1; c.beginPath(); c.moveTo(L.x0, gy); c.lineTo(L.x1, gy); c.stroke();
      c.fillStyle = muted; c.fillText(fmt(g, g >= 100 ? 0 : 2), L.x1 + 8, gy);
    }
    // future region: tinted, with a loud "what happened next" banner
    if (this.cut != null && this.cut < this.to) {
      var fx = X(this.cut) + bw / 2;
      c.save(); c.globalAlpha = 0.07; c.fillStyle = acc; c.fillRect(fx, L.y0, L.x1 - fx, L.vy1 - L.y0); c.restore();
      c.strokeStyle = acc; c.lineWidth = 1.5; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(fx, L.y0); c.lineTo(fx, L.vy1); c.stroke(); c.setLineDash([]);
    }
    // zones
    this.zones.forEach(function (z) { c.fillStyle = z.color; c.fillRect(L.x0, Y(z.hi), L.x1 - L.x0, Y(z.lo) - Y(z.hi)); });
    // forecast boxes
    var bx0 = null, bx1 = L.x1;
    if (this.box && this.box.entry != null) {
      var B = this.box;
      bx0 = B.from == null || B.from > this.to ? X(this.to) + bw / 2 + 2 : X(B.from) - bw / 2;
      bx0 = Math.min(bx0, L.x1 - 40);
      var risk = B.stop != null ? Math.abs(B.entry - B.stop) : null;
      [['target', bull, 'rgba(62,203,124,'], ['stop', bear, 'rgba(224,72,63,']].forEach(function (k) {
        var v = B[k[0]]; if (v == null) return;
        var yA = Y(B.entry), yB = Y(v), top = Math.min(yA, yB), h = Math.abs(yB - yA);
        c.fillStyle = k[2] + '0.16)'; c.fillRect(bx0, top, bx1 - bx0, h);
        c.strokeStyle = k[1]; c.globalAlpha = 0.7; c.lineWidth = 1; c.strokeRect(bx0 + 0.5, top + 0.5, bx1 - bx0 - 1, h - 1); c.globalAlpha = 1;
        if (h > 30 && bx1 - bx0 > 70) {
          // R multiple, near the entry side; the price itself is on the gutter tag
          var txt = k[0] === 'target' ? (risk ? '+' + fmt(Math.abs(v - B.entry) / risk, 1) + 'R' : 'TARGET') : '−1R';
          c.fillStyle = k[1]; c.textBaseline = 'middle'; c.font = '700 10px "IBM Plex Mono", ui-monospace, monospace';
          c.fillText(txt, bx0 + 6, k[0] === 'target' ? top + h - 9 : top + 9);
          c.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
        }
      });
      c.strokeStyle = ink; c.globalAlpha = 0.6; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(bx0, Y(B.entry)); c.lineTo(bx1, Y(B.entry)); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    }
    // volume
    var vmax = 0; for (var i = this.from; i <= this.to; i++) vmax = Math.max(vmax, s.v[i]);
    for (i = this.from; i <= lastShown; i++) {
      var up = s.c[i] >= s.o[i], vh = (s.v[i] / vmax) * (L.vy1 - L.vy0);
      c.fillStyle = hexA(up ? cc.up : cc.down, 0.35);
      c.fillRect(X(i) - bw * 0.35, L.vy1 - vh, Math.max(1, bw * 0.7), vh);
    }
    // moving averages
    if (this.showMA) {
      [[s.sma20, acc, '20d'], [s.sma50, gold, '50d']].forEach(function (m) {
        c.strokeStyle = m[1]; c.lineWidth = 1.4; c.globalAlpha = 0.85; c.beginPath(); var pen = false;
        for (var k = self.from; k <= lastShown; k++) { if (m[0][k] == null) continue; var x = X(k), y = Y(m[0][k]); if (!pen) { c.moveTo(x, y); pen = true; } else c.lineTo(x, y); }
        c.stroke(); c.globalAlpha = 1;
      });
      c.textBaseline = 'top'; c.fillStyle = acc; c.fillText('— 20-day avg', L.x0 + 4, L.y0 - 8); c.fillStyle = gold; c.fillText('— 50-day avg', L.x0 + 96, L.y0 - 8); c.textBaseline = 'middle';
    }
    // candles
    for (i = this.from; i <= lastShown; i++) {
      var o = s.o[i], cl = s.c[i], x = X(i), upc = cl >= o, col = upc ? cc.up : cc.down;
      c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.moveTo(x, Y(s.h[i])); c.lineTo(x, Y(s.l[i])); c.stroke();
      var top = Y(Math.max(o, cl)), hgt = Math.max(1, Math.abs(Y(o) - Y(cl)));
      c.fillStyle = col; c.fillRect(x - bw * 0.36, top, Math.max(1, bw * 0.72), hgt);
    }
    // the bar being revealed gets a soft highlight
    if (this.revealTo != null && this.revealTo < this.to && this.revealTo > (this.cut || 0)) {
      c.save(); c.globalAlpha = 0.12; c.fillStyle = acc; c.fillRect(X(this.revealTo) - bw / 2, L.y0, bw, L.vy1 - L.y0); c.restore();
    }
    // horizontal lines: thin line + small name at the right end, price tag in the gutter
    this.lines.concat(this.pickLine ? [this.pickLine] : []).forEach(function (ln) {
      var y = Y(ln.price);
      c.strokeStyle = ln.color; c.lineWidth = ln.w || 1; c.globalAlpha = 0.85; c.setLineDash(ln.dash || []); c.beginPath(); c.moveTo(L.x0, y); c.lineTo(bx0 != null ? bx0 : L.x1, y); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      if (ln.label && bx0 == null) { c.font = '600 9px "IBM Plex Mono", ui-monospace, monospace'; c.fillStyle = ln.color; c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText(ln.label, L.x1 - 4, y - 2); c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = '500 10px "IBM Plex Mono", ui-monospace, monospace'; }
      c.fillStyle = ln.color; c.fillRect(L.x1 + 1, y - 8, 60, 16);
      c.fillStyle = tagInk; c.fillText(fmt(ln.price), L.x1 + 6, y);
    });
    // draggable handles: grip pill on the box edge + gutter tag
    this.handles.forEach(function (h) {
      if (h.price == null) return;
      var y = Y(h.price), active = self.drag && self.drag.id === h.id;
      var hx0 = bx0 != null ? bx0 : L.x1 - 120;
      c.strokeStyle = h.color; c.lineWidth = active ? 2 : 1.4; c.beginPath(); c.moveTo(hx0, y); c.lineTo(bx1, y); c.stroke();
      var lab = '⇕ ' + (h.label || ''), tw = c.measureText(lab).width + 14, cx = bx1 - tw / 2 - 4;
      if (h.pulse && !active) { c.save(); c.globalAlpha = 0.35 * pulseA; c.fillStyle = h.color; c.fillRect(cx - tw / 2 - 5, y - 13, tw + 10, 26); c.restore(); }
      c.fillStyle = h.color; roundRect(c, cx - tw / 2, y - 9, tw, 18, 9); c.fill();
      c.fillStyle = tagInk; c.textAlign = 'center'; c.fillText(lab, cx, y + 0.5); c.textAlign = 'left';
      c.fillStyle = h.color; c.fillRect(L.x1 + 1, y - 8, 60, 16);
      c.fillStyle = tagInk; c.fillText(fmt(h.price), L.x1 + 6, y);
    });
    // markers
    this.marks.forEach(function (m) {
      if (m.i > lastShown) return;
      var x = X(m.i), y = Y(m.price), dir = m.type === 'buy' ? 1 : -1;
      c.fillStyle = m.color || (m.type === 'buy' ? bull : bear);
      c.beginPath(); c.moveTo(x, y + dir * 4); c.lineTo(x - 5, y + dir * 13); c.lineTo(x + 5, y + dir * 13); c.closePath(); c.fill();
      if (m.label) {
        c.font = '700 10px "IBM Plex Mono", ui-monospace, monospace';
        var mw = c.measureText(m.label).width + 10, my = y + dir * 24;
        c.fillRect(Math.min(L.x1 - mw, Math.max(L.x0, x - mw / 2)), my - 8, mw, 16);
        c.fillStyle = tagInk; c.textAlign = 'center'; c.fillText(m.label, Math.min(L.x1 - mw / 2, Math.max(L.x0 + mw / 2, x)), my); c.textAlign = 'left';
        c.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
      }
    });
    // crosshair
    if (this.hoverY != null && this.hoverY >= L.y0 && this.hoverY <= L.y1) {
      var hp = this.priceAt(this.hoverY);
      c.strokeStyle = cross; c.setLineDash([2, 3]); c.beginPath(); c.moveTo(L.x0, this.hoverY); c.lineTo(L.x1, this.hoverY); c.stroke(); c.setLineDash([]);
      c.fillStyle = ink; c.fillRect(L.x1 + 1, this.hoverY - 8, 60, 16);
      c.fillStyle = cssVar('--bg', '#0b0c0f'); c.fillText(fmt(hp), L.x1 + 6, this.hoverY);
      if (this.hoverNote) { var tx = this.hoverNote(hp); if (tx) { c.fillStyle = 'rgba(11,12,15,0.85)'; var tw2 = c.measureText(tx).width + 12; c.fillRect(L.x0 + 4, this.hoverY - 22, tw2, 16); c.fillStyle = '#eef0f4'; c.fillText(tx, L.x0 + 10, this.hoverY - 14); } }
    }
    // callouts go at the top or bottom edge, whichever has more empty room above/below the candles
    function freeY(i0, i1, inset) {
      var hi = -Infinity, lo = Infinity;
      for (var k = Math.max(self.from, i0); k <= Math.min(self.to, i1); k++) { hi = Math.max(hi, s.h[k]); lo = Math.min(lo, s.l[k]); }
      var top = L.y0 + inset, bot = L.y1 - inset;
      var pick = hi === -Infinity || (Y(hi) - L.y0) >= (L.y1 - Y(lo)) ? top : bot;
      // never sit on top of a draggable handle
      var blocked = function (y) { return self.handles.some(function (h) { return h.price != null && Math.abs(Y(h.price) - y) < 24; }); };
      if (blocked(pick)) pick = pick === top ? bot : top;
      return pick;
    }
    // "what happened next" banner, pinned over the future region
    if (this.banner && this.cut != null && this.cut < this.to) {
      var bxs = X(this.cut) + bw / 2;
      drawPill(c, this.banner, bxs + (L.x1 - bxs) / 2, freeY(this.cut + 1, this.to, 14), acc, '#ffffff', pulseA, 12, L.x1 - bxs - 8);
    }
    // on-chart call to action
    if (this.prompt) {
      drawPill(c, this.prompt.text, L.x0 + (L.x1 - L.x0) / 2, freeY(this.from, lastShown, 22), this.prompt.color || acc, '#ffffff', pulseA, 12, L.x1 - L.x0 - 16);
    }
  };
  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r); c.lineTo(x + w, y + h - r);
    c.arcTo(x + w, y + h, x + w - r, y + h, r); c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath();
  }
  function drawPill(c, text, cx, cy, bg, fg, pulse, size, maxW) {
    var fs = size;
    c.font = '700 ' + fs + 'px "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif';
    while (fs > 9 && c.measureText(text).width + 28 > maxW) { fs--; c.font = '700 ' + fs + 'px "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif'; }
    var w = Math.min(maxW, c.measureText(text).width + 28), h = fs + 14;
    c.save();
    c.shadowColor = bg; c.shadowBlur = 6 + 14 * pulse;
    c.fillStyle = bg; roundRect(c, cx - w / 2, cy - h / 2, w, h, h / 2); c.fill();
    c.restore();
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, cx, cy + 0.5); c.textAlign = 'left';
    c.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
  }
  // Reveals bars (cut, to] one at a time. onBar(i) may return false to stop early.
  Chart.prototype.reveal = function (fromIdx, toIdx, msPerBar, onBar, done) {
    var self = this, i = fromIdx;
    if (REDUCED) msPerBar = 0;
    function next() {
      i++;
      self.revealTo = i; self.draw();
      var go = onBar ? onBar(i) : true;
      if (i >= toIdx || go === false) { self.revealTo = i >= self.to ? null : i; self.draw(); if (done) done(i); return; }
      setTimeout(next, msPerBar);
    }
    this.revealTo = fromIdx; this.draw();
    setTimeout(next, msPerBar);
  };
  function niceStep(raw) { var p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; }

  // ------------------------------------------------------------ rounds
  // Each round renders into `host` and calls done(result) once the player
  // moves on. result = { points, max, grade: 'g'|'y'|'r', label }
  // Grade the Setup. Four steps, each one highlighted as it becomes the thing to
  // do next: (1) set your stop and (2) your target with the red/green boxes on
  // the chart, (3) run the checklist, (4) make the call. Then the chart plays
  // the next 20 days forward bar by bar through your boxes.
  // Scoring: 1 point per plan level (stop in the structural zone, target at the
  // obvious resistance), 1 per checklist answer, 2 for the final call: 8 max.
  function gradeRound(host, data, r, meta, done) {
    var pick = pickGrade(data, r), s = pick.s, i = pick.i, ev = evaluateSetup(s, i);
    var a = s.atr[i], entry = ev.entry, swing = minRange(s.l, i - 9, i), hi30 = maxRange(s.h, i - 30, i);
    var zoneHi = swing - 0.05 * a, zoneLo = swing - 1.0 * a;
    var plan = { stop: null, target: null }, step = 'stop';
    host.innerHTML = '';
    var head = el('div', 'zg-round-head', '<span class="zg-kicker">' + (meta.label || 'Grade the setup') + '</span><span class="zg-round-no">' + (meta.no || '') + '</span>');
    var steps = el('ol', 'zg-steps', '<li data-s="stop">Set stop</li><li data-s="target">Set target</li><li data-s="check">Checklist</li><li data-s="call">Your call</li>');
    var wrap = el('div', 'zg-chart-wrap'); var cv = el('canvas', 'zg-chart zg-pickable'); wrap.appendChild(cv);
    var ticket = el('div', 'zg-ticket');
    var hint = el('p', 'zg-prompt zg-prompt-sm', 'Hidden ticker, real daily chart. You\'re buying at today\'s close. Plan the trade on the chart first.');
    var qs = [
      ['trend', 'Trend', 'Is price above a <em>rising</em> 50-day average?'],
      ['support', 'Support', 'Has it pulled back to within about 3% of the 20-day average?'],
      ['volume', 'Volume', 'Was volume lighter on the last 3 days than the 20 before?'],
      ['reward', 'Reward:risk', 'Is the recent high at least 2&times; as far away as a stop under the swing low?']
    ];
    var answers = {};
    var list = el('div', 'zg-checklist'); list.hidden = true;
    qs.forEach(function (q) {
      var row = el('div', 'zg-q', '<div class="zg-q-text"><b>' + q[1] + '</b><span>' + q[2] + '</span></div>');
      var btns = el('div', 'zg-yn');
      ['Yes', 'No'].forEach(function (lab) {
        var b = el('button', 'zg-btn zg-btn-sm', lab); b.type = 'button';
        b.addEventListener('click', function () {
          if (host._locked) return;
          answers[q[0]] = lab === 'Yes';
          btns.querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-on', x === b); });
          guide();
        });
        btns.appendChild(b);
      });
      row.appendChild(btns); row.appendChild(el('div', 'zg-q-exp')); list.appendChild(row); q.row = row;
    });
    var actions = el('div', 'zg-actions'); actions.hidden = true;
    var bTake = el('button', 'zg-btn zg-btn-buy', 'Qualifies: take it'); bTake.type = 'button'; bTake.disabled = true;
    var bPass = el('button', 'zg-btn', 'Doesn\'t qualify: pass'); bPass.type = 'button'; bPass.disabled = true;
    actions.appendChild(bTake); actions.appendChild(bPass);
    var result = el('div', 'zg-result'); result.hidden = true;
    [head, steps, wrap, ticket, hint, list, actions, result].forEach(function (x) { host.appendChild(x); });

    var red = cssVar('--danger', '#e0483f'), green = cssVar('--bull', '#3ecb7c');
    var ch = new Chart(cv);
    ch.padBars = 16;
    ch.box = { from: i + 1, entry: entry, stop: null, target: null };
    ch.hoverNote = function (p) {
      if (host._locked) return null;
      if (step === 'stop' && p < entry) return 'stop here: risk ' + fmt((entry - p) / entry * 100, 1) + '% · ' + fmt((entry - p) / a, 1) + '× daily range';
      if (step === 'target' && p > entry && plan.stop != null) return fmt((p - entry) / (entry - plan.stop), 1) + ':1 reward:risk';
      return null;
    };
    ch.onPick = function (p) {
      if (host._locked) return;
      if (step === 'stop') setLevel('stop', p);
      else if (step === 'target') setLevel('target', p);
    };
    ch.onDrag = function (id, p) { if (!host._locked) setLevel(id, p, true); };
    ch.set(s, i - 79, i);

    function setLevel(kind, p, dragging) {
      if (kind === 'stop') {
        if (p >= entry) { if (!dragging) hint.innerHTML = 'A long trade\'s stop goes <b>below</b> the entry (' + fmt(entry) + ').'; return; }
        plan.stop = p;
        if (step === 'stop' && !dragging) step = 'target';
      } else {
        if (p <= entry) { if (!dragging) hint.innerHTML = 'The target goes <b>above</b> the entry (' + fmt(entry) + ').'; return; }
        plan.target = p;
        if (step === 'target' && !dragging) step = 'check';
      }
      if (step === 'target' && plan.target != null) step = 'check';
      guide();
    }

    function guide() {
      ch.box.stop = plan.stop; ch.box.target = plan.target;
      ch.handles = [];
      if (plan.stop != null) ch.handles.push({ id: 'stop', price: plan.stop, color: red, label: 'STOP' });
      if (plan.target != null) ch.handles.push({ id: 'target', price: plan.target, color: green, label: 'TARGET' });
      var rr = plan.stop != null && plan.target != null ? (plan.target - entry) / (entry - plan.stop) : null;
      ticket.innerHTML = '<span><small>Entry</small><b>' + fmt(entry) + '</b></span>' +
        '<span class="is-stop' + (step === 'stop' ? ' is-due' : '') + '"><small>Your stop</small><b>' + (plan.stop != null ? fmt(plan.stop) : '—') + '</b></span>' +
        '<span class="is-target' + (step === 'target' ? ' is-due' : '') + '"><small>Your target</small><b>' + (plan.target != null ? fmt(plan.target) : '—') + '</b></span>' +
        '<span><small>Reward:risk</small><b class="' + (rr == null ? '' : rr >= 2 ? 'up' : 'dn') + '">' + (rr == null ? '—' : fmt(rr, 1) + ':1') + '</b></span>';
      var answered = qs.filter(function (q) { return answers[q[0]] !== undefined; }).length;
      var cur = step === 'check' && answered === qs.length ? 'call' : step;
      steps.querySelectorAll('li').forEach(function (li) {
        var order = ['stop', 'target', 'check', 'call'], k = order.indexOf(li.getAttribute('data-s'));
        li.className = k < order.indexOf(cur) ? 'is-done' : k === order.indexOf(cur) ? 'is-now' : '';
      });
      ch.prompt = null;
      qs.forEach(function (q) { q.row.classList.remove('zg-glow'); });
      bTake.classList.remove('zg-pulse'); bPass.classList.remove('zg-pulse');
      if (step === 'stop') {
        ch.prompt = { text: '① Tap the chart where your STOP goes: below the entry, where the idea is wrong', color: red };
        hint.innerHTML = 'Step 1: <b>set your stop.</b> Tap below the entry line (the red box shows what you\'re risking). You can drag it afterwards.';
      } else if (step === 'target') {
        ch.prompt = { text: '② Now tap where your TARGET goes: above the entry', color: green };
        ch.handles.forEach(function (h) { h.pulse = false; });
        hint.innerHTML = 'Step 2: <b>set your target.</b> Tap above the entry (the green box is your reward). Drag either handle to fine-tune.';
      } else {
        list.hidden = false; actions.hidden = false;
        ch.onPick = null; cv.classList.remove('zg-pickable');
        var firstOpen = qs.filter(function (q) { return answers[q[0]] === undefined; })[0];
        if (firstOpen) {
          firstOpen.row.classList.add('zg-glow');
          hint.innerHTML = 'Step 3: <b>run the checklist</b> on this chart. Drag the red or green handles if you want to adjust your plan.';
        } else {
          hint.innerHTML = 'Step 4: <b>make the call.</b> Does this setup qualify?';
          bTake.classList.add('zg-pulse'); bPass.classList.add('zg-pulse');
        }
        bTake.disabled = bPass.disabled = !!firstOpen;
      }
      ch.draw();
    }
    guide();

    function planGrade() {
      var sp = plan.stop >= zoneLo && plan.stop <= zoneHi ? 1 : 0;
      var sTxt = sp ? 'Stop ' + fmt(plan.stop) + ' sits just under the 10-day swing low (' + fmt(swing) + '): the right spot.'
        : plan.stop > zoneHi ? 'Stop ' + fmt(plan.stop) + ' is above or right on the swing low (' + fmt(swing) + '), inside normal noise.'
        : 'Stop ' + fmt(plan.stop) + ' is more than a full daily range under the swing low (' + fmt(swing) + '): wider than it needs to be.';
      var rr = (plan.target - entry) / (entry - plan.stop), tp, tTxt;
      if (hi30 > entry * 1.01) {
        tp = plan.target >= hi30 * 0.97 && plan.target <= hi30 * 1.03 ? 1 : 0;
        tTxt = tp ? 'Target ' + fmt(plan.target) + ' is at the recent high (' + fmt(hi30) + '), the first real resistance.'
          : plan.target > hi30 * 1.03 ? 'Target ' + fmt(plan.target) + ' is past the recent high (' + fmt(hi30) + '). Price usually has to fight through that level first.'
          : 'Target ' + fmt(plan.target) + ' is short of the recent high (' + fmt(hi30) + '), leaving reward on the table.';
      } else {
        tp = rr >= 2 && rr <= 4 ? 1 : 0;
        tTxt = 'Price is already at its highs, so there\'s no overhead resistance to aim at; a 2–4R target is the norm. Yours is ' + fmt(rr, 1) + 'R' + (tp ? '. Good.' : '.');
      }
      return { pts: sp + tp, stop: sp, target: tp, sTxt: sTxt, tTxt: tTxt };
    }

    function submit(take) {
      if (host._locked) return; host._locked = true;
      bTake.disabled = bPass.disabled = true; bTake.classList.remove('zg-pulse'); bPass.classList.remove('zg-pulse');
      steps.querySelectorAll('li').forEach(function (li) { li.className = 'is-done'; });
      var pg = planGrade(), pts = pg.pts;
      qs.forEach(function (q) {
        var right = answers[q[0]] === ev[q[0]];
        if (right) pts += 1;
        q.row.classList.remove('zg-glow');
        q.row.classList.add(right ? 'is-right' : 'is-wrong');
        q.row.querySelector('.zg-q-exp').innerHTML = (right ? '✓ ' : '✗ ') + (ev[q[0]] ? '<b>Yes.</b> ' : '<b>No.</b> ') + ev.detail[q[0]];
      });
      var finalRight = take === ev.qualifies;
      if (finalRight) pts += 2;
      var MAX = 8;
      var grade = pts >= 6.5 ? 'g' : pts >= 4 ? 'y' : 'r';
      var out = simulate(s, i, entry, plan.stop, plan.target, 20);
      var ref = simulate(s, i, ev.entry, ev.stop, ev.target, 20);
      // play the next 20 days forward through the boxes
      ch.handles = []; ch.prompt = null; ch.onDrag = null; ch.hoverNote = null;
      ch.padBars = 0; ch.box.from = i;
      ch.banner = '▶ WHAT HAPPENED NEXT';
      var last = Math.min(s.n - 1, i + 20);
      ch.set(s, i - 59, last, i);
      result.hidden = false;
      result.innerHTML = '<div class="zg-next-head"><span class="zg-next-dot"></span>What happened next</div><p class="zg-fine">Playing the next 20 trading days forward…</p>';
      try { wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
      var marked = false;
      ch.reveal(i, last, 130, function (k) {
        if (!marked && out.kind !== 'open' && k === i + out.day) {
          marked = true;
          var px = out.kind === 'target' ? plan.target : Math.min(plan.stop, s.o[k]);
          ch.marks.push({ i: k, price: px, type: out.kind === 'target' ? 'sell' : 'buy', color: out.kind === 'target' ? green : red, label: out.kind === 'target' ? 'TARGET HIT' : 'STOPPED' });
        }
      }, function () {
        ch.banner = null; ch.draw();
        var outTxt = out.kind === 'target' ? '<b class="up">hit your target on day ' + out.day + ' (+' + fmt(out.r, 1) + 'R)</b>'
          : out.kind === 'stop' ? '<b class="dn">stopped you out on day ' + out.day + ' (' + fmt(out.r, 1) + 'R' + (out.gap ? ', gapped through the stop' : '') + ')</b>'
          : '<b>was still open after 20 days (' + (out.r >= 0 ? '+' : '') + fmt(out.r, 1) + 'R)</b>';
        var refTxt = ref.kind === 'target' ? 'reached its target (+' + fmt(ref.r, 1) + 'R)' : ref.kind === 'stop' ? 'was stopped out (' + fmt(ref.r, 1) + 'R)' : 'was still open (' + (ref.r >= 0 ? '+' : '') + fmt(ref.r, 1) + 'R)';
        result.innerHTML =
          '<div class="zg-next-head"><span class="zg-next-dot"></span>What happened next</div>' +
          '<p>This was <b>' + s.sym + '</b>, ' + monthYear(s.d[i]) + '. Your plan ' + outTxt + '. The checklist\'s own plan (stop ' + fmt(ev.stop) + ', target ' + fmt(ev.target) + ') ' + refTxt + '.</p>' +
          '<div class="zg-verdict ' + grade + '">' + (finalRight ? 'Right call.' : 'Wrong call.') + ' The checklist says <b>' + (ev.qualifies ? 'qualifies' : 'pass') + '</b>. +' + pts + ' / ' + MAX + '</div>' +
          '<ul class="zg-plan-notes"><li class="' + (pg.stop ? 'ok' : 'miss') + '">' + (pg.stop ? '✓ ' : '✗ ') + pg.sTxt + '</li><li class="' + (pg.target ? 'ok' : 'miss') + '">' + (pg.target ? '✓ ' : '✗ ') + pg.tTxt + '</li></ul>' +
          '<p class="zg-fine">Outcomes vary even for textbook setups. Points are for planning and following the checklist, not for guessing the future.</p>';
        var next = el('button', 'zg-btn zg-btn-primary zg-pulse', meta.nextLabel || 'Next &rarr;'); next.type = 'button';
        next.addEventListener('click', function () { done({ points: pts, max: MAX, grade: grade, sym: s.sym, date: s.d[i] }); });
        result.appendChild(next);
        try { next.focus({ preventScroll: true }); } catch (e) {}
      });
    }
    bTake.addEventListener('click', function () { submit(true); });
    bPass.addEventListener('click', function () { submit(false); });
  }

  function stopRound(host, data, r, meta, done) {
    var pick = pickStop(data, r), s = pick.s, i = pick.i;
    var entry = s.c[i], a = s.atr[i], swing = minRange(s.l, i - 9, i);
    var zoneHi = swing - 0.05 * a, zoneLo = swing - 1.0 * a;
    host.innerHTML = '';
    var head = el('div', 'zg-round-head', '<span class="zg-kicker">' + (meta.label || 'Where\'s the stop?') + '</span><span class="zg-round-no">' + (meta.no || '') + '</span>');
    var wrap = el('div', 'zg-chart-wrap'); var cv = el('canvas', 'zg-chart zg-pickable'); wrap.appendChild(cv);
    var prompt = el('p', 'zg-prompt', 'You\'re long at <b>' + fmt(entry) + '</b> (today\'s close). <b>Tap the chart where your stop goes.</b> Average daily range right now: ' + fmt(a) + '.');
    var status = el('div', 'zg-pickinfo', 'No stop set yet.');
    var actions = el('div', 'zg-actions');
    var lock = el('button', 'zg-btn zg-btn-primary', 'Lock in stop'); lock.type = 'button'; lock.disabled = true;
    actions.appendChild(lock);
    var result = el('div', 'zg-result'); result.hidden = true;
    [head, wrap, prompt, status, actions, result].forEach(function (x) { host.appendChild(x); });
    var ch = new Chart(cv), stop = null;
    ch.lines = [{ price: entry, color: cssVar('--ink', '#d8dde6'), label: 'ENTRY', dash: [4, 3] }];
    ch.prompt = { text: 'Tap the chart where your stop-loss belongs', color: cssVar('--danger', '#e0483f') };
    ch.hoverNote = function (p) { return p < entry ? 'risk ' + fmt((entry - p) / entry * 100, 1) + '% · ' + fmt((entry - p) / a, 1) + '× daily range' : null; };
    ch.onPick = function (p) {
      if (host._locked) return;
      if (p >= entry) { status.textContent = 'A long position\'s stop goes below the entry.'; return; }
      stop = p; ch.pickLine = { price: p, color: cssVar('--danger', '#e0483f'), label: 'YOUR STOP', fit: false };
      status.innerHTML = 'Stop <b>' + fmt(p) + '</b> · risk ' + fmt((entry - p) / entry * 100, 1) + '% of price · ' + fmt((entry - p) / a, 1) + '× the daily range';
      ch.prompt = null; lock.disabled = false; lock.classList.add('zg-pulse'); ch.draw();
    };
    ch.set(s, i - 79, i);
    lock.addEventListener('click', function () {
      if (host._locked || stop == null) return; host._locked = true; lock.disabled = true; lock.classList.remove('zg-pulse'); ch.onPick = null;
      var placement, verdict;
      if (stop > zoneHi) { placement = stop > swing + 0.5 * a ? 10 : 35; verdict = 'Too tight: it sits above the recent swing low (' + fmt(swing) + '), inside normal day-to-day noise.'; }
      else if (stop >= zoneLo) { placement = 100; verdict = 'Well placed: just under the recent swing low (' + fmt(swing) + '), where the idea is actually wrong if price gets there.'; }
      else if (entry - stop <= 3.5 * a) { placement = 60; verdict = 'Safe but wider than it needs to be. The swing low is ' + fmt(swing) + '; anything much below it costs you position size for no extra protection.'; }
      else { placement = 25; verdict = 'Far too wide: ' + fmt((entry - stop) / a, 1) + '× the daily range. At the same dollar risk you\'d be holding a tiny position.'; }
      var tgt = entry + 2 * (entry - stop);
      var out = simulate(s, i, entry, stop, tgt, 20);
      var outPts = out.kind === 'target' ? 30 : out.kind === 'open' && out.r > -1 ? 15 : 0;
      var pts = Math.round(placement * 0.7 + outPts);
      ch.zones = [{ lo: zoneLo, hi: zoneHi, color: 'rgba(62,203,124,0.13)' }];
      ch.lines = [
        { price: entry, color: cssVar('--ink', '#d8dde6'), label: 'ENTRY', dash: [4, 3] },
        { price: swing, color: cssVar('--gold', '#d9a441'), label: 'SWING LOW', dash: [2, 3] },
        { price: tgt, color: cssVar('--bull', '#3ecb7c'), label: '2R TARGET', fit: false }
      ];
      ch.banner = '▶ WHAT HAPPENED NEXT';
      ch.set(s, i - 59, Math.min(s.n - 1, i + 20), i);
      ch.reveal(i, Math.min(s.n - 1, i + 20), 110, null, function () { ch.banner = null; ch.draw(); });
      var outTxt = out.kind === 'target' ? 'reached the 2R target on day ' + out.day : out.kind === 'stop' ? 'hit your stop on day ' + out.day : 'neither stop nor target was hit in 20 days';
      var grade = pts >= 80 ? 'g' : pts >= 50 ? 'y' : 'r';
      result.hidden = false;
      result.innerHTML = '<div class="zg-verdict ' + grade + '">' + verdict + ' <b>+' + pts + ' / 100</b></div>' +
        '<p>The green band is the structural stop zone (just under the swing low, within one daily range). This was <b>' + s.sym + '</b>, ' + monthYear(s.d[i]) + '. With your stop, price ' + outTxt + '.</p>' +
        '<p class="zg-fine">70 points are for placement and 30 for what happened next. Placement is the skill; the outcome is partly luck.</p>';
      var next = el('button', 'zg-btn zg-btn-primary zg-pulse', meta.nextLabel || 'Next &rarr;'); next.type = 'button';
      next.addEventListener('click', function () { done({ points: pts, max: 100, grade: grade, sym: s.sym, date: s.d[i] }); });
      result.appendChild(next);
    });
  }

  // ------------------------------------------------------------ share
  function share(text, url) {
    var full = text + (url ? '\n' + url : '');
    if (navigator.share) { return navigator.share({ text: text, url: url }).catch(function () { return copy(full); }); }
    return copy(full);
  }
  function copy(t) {
    if (navigator.clipboard) return navigator.clipboard.writeText(t).then(function () { return 'copied'; });
    var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta); return Promise.resolve('copied');
  }
  function store(key, val) { try { if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null'); localStorage.setItem(key, JSON.stringify(val)); } catch (e) { return null; } }

  global.ZC = {
    load: load, rng: rng, hashStr: hashStr, etDateStr: etDateStr, fmt: fmt, money: money, monthYear: monthYear, el: el,
    evaluateSetup: evaluateSetup, simulate: simulate, pickReplay: pickReplay, minRange: minRange, maxRange: maxRange,
    Chart: Chart, gradeRound: gradeRound, stopRound: stopRound, share: share, store: store, cssVar: cssVar
  };
})(window);
