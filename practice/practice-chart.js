/*!
 * Zelos Practice Account: full candlestick chart with indicators.
 *
 * Price pane (candles, volume, SMA 20/50, EMA 9, Bollinger Bands, order and
 * cost-basis lines, live price tag) plus optional RSI and MACD panes.
 * Mouse wheel / pinch-free buttons zoom, drag pans, and the crosshair shows
 * OHLC and every visible indicator's value for the hovered day.
 */
(function (global) {
  'use strict';

  function cssVar(n, fb) { try { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || fb; } catch (e) { return fb; } }
  function fmt(n, d) { return (n == null || isNaN(n)) ? '–' : Number(n).toFixed(d == null ? 2 : d); }
  function fmtVol(v) { return v == null || !v ? '–' : v >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : String(v); }

  // ------------------------------------------------------------ indicators
  function sma(a, n) { var o = new Array(a.length), s = 0; for (var i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; o[i] = i >= n - 1 ? s / n : null; } return o; }
  function ema(a, n) { var o = new Array(a.length), k = 2 / (n + 1), p = null; for (var i = 0; i < a.length; i++) { p = p == null ? a[i] : a[i] * k + p * (1 - k); o[i] = i >= n - 1 ? p : null; } return o; }
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
  function computeIndicators(s) {
    var c = s.c;
    s.sma20 = sma(c, 20); s.sma50 = sma(c, 50); s.ema9 = ema(c, 9);
    s.bb = bollinger(c, 20, 2); s.rsi = rsi(c, 14); s.macd = macd(c);
    return s;
  }

  // ------------------------------------------------------------ chart
  function TradeChart(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.s = null; this.from = 0; this.to = 0; this.hover = null;
    this.show = { vol: true, sma20: true, sma50: true, ema9: false, bb: false, rsi: true, macd: false };
    this.lines = []; this.lastPrice = null; this.marks = [];
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
  TradeChart.prototype.resize = function () {
    var dpr = Math.min(global.devicePixelRatio || 1, 2), w = this.cv.clientWidth, h = this.cv.clientHeight;
    if (!w || !h) return;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.W = w; this.H = h; this.dpr = dpr; this.draw();
  };
  TradeChart.prototype.setSeries = function (s, bars) {
    var keep = this.s && this.s.sym === s.sym && this.to === this.s.n - 1;
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
    var span = this.to - this.from + 1, ns = Math.max(15, Math.min(this.s.n, Math.round(span * f)));
    var L = this.layout(), rel = x == null ? 1 : Math.max(0, Math.min(1, (x - L.x0) / (L.x1 - L.x0)));
    var anchor = this.from + rel * span, from = Math.round(anchor - rel * ns);
    from = Math.max(0, Math.min(this.s.n - ns, from));
    this.from = from; this.to = from + ns - 1; this.draw();
  };
  TradeChart.prototype.barW = function () { var L = this.layout(); return (L.x1 - L.x0) / (this.to - this.from + 1 + 3); };
  TradeChart.prototype.layout = function () {
    var padR = 64, top = 40, bottom = 20, gap = 8, H = this.H;
    var subs = (this.show.rsi ? 1 : 0) + (this.show.macd ? 1 : 0);
    var subH = subs ? Math.max(60, Math.round(H * 0.17)) : 0;
    var priceB = H - bottom - subs * (subH + gap);
    var L = { x0: 8, x1: this.W - padR, y0: top, y1: priceB, panes: [] };
    var y = priceB + gap;
    if (this.show.rsi) { L.panes.push({ kind: 'rsi', y0: y, y1: y + subH }); y += subH + gap; }
    if (this.show.macd) { L.panes.push({ kind: 'macd', y0: y, y1: y + subH }); }
    L.xAxis = H - 4;
    return L;
  };
  TradeChart.prototype.draw = function () {
    var c = this.ctx, s = this.s; if (!s || !this.W) return;
    var L = this.layout(), self = this, show = this.show;
    var bull = cssVar('--bull', '#3ecb7c'), bear = cssVar('--danger', '#e0483f'), acc = cssVar('--accent', '#4a86ff');
    var gold = cssVar('--gold', '#e8b23d'), violet = cssVar('--violet', '#8f7bf6'), muted = cssVar('--muted', '#8a8f98');
    var ink = cssVar('--ink', '#f4f5f7'), grid = cssVar('--chart-grid', 'rgba(255,255,255,0.06)'), cross = cssVar('--chart-cross', 'rgba(255,255,255,0.35)');
    var tagInk = cssVar('--chart-label-ink', '#0b0c0f'), bg = cssVar('--bg', '#0c0d10');
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.W, this.H);
    var bw = this.barW(), from = this.from, to = this.to;
    function X(i) { return L.x0 + (i - from + 0.5) * bw; }
    // price range
    var lo = Infinity, hi = -Infinity, vmax = 0;
    for (var i = from; i <= to; i++) {
      lo = Math.min(lo, s.l[i]); hi = Math.max(hi, s.h[i]); vmax = Math.max(vmax, s.v[i] || 0);
      if (show.bb && s.bb.up[i] != null) { hi = Math.max(hi, s.bb.up[i]); lo = Math.min(lo, s.bb.lo[i]); }
    }
    this.lines.forEach(function (ln) { if (ln.price > lo * 0.8 && ln.price < hi * 1.25) { lo = Math.min(lo, ln.price); hi = Math.max(hi, ln.price); } });
    var pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
    function Y(p) { return L.y0 + (hi - p) / (hi - lo) * (L.y1 - L.y0); }
    this._Y = Y; this._X = X; this._L = L;
    c.font = '500 10px "IBM Plex Mono", ui-monospace, monospace'; c.textBaseline = 'middle';
    // grid + price axis
    var step = niceStep((hi - lo) / 6);
    for (var g = Math.ceil(lo / step) * step; g < hi; g += step) {
      var gy = Y(g); c.strokeStyle = grid; c.lineWidth = 1; c.beginPath(); c.moveTo(L.x0, gy); c.lineTo(L.x1, gy); c.stroke();
      c.fillStyle = muted; c.fillText(fmt(g, g >= 1000 ? 0 : 2), L.x1 + 8, gy);
    }
    // date axis: month starts
    c.textBaseline = 'alphabetic';
    var lastM = null, MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], minGap = 46, lastX = -1e9;
    for (i = from; i <= to; i++) {
      var m = s.d[i].slice(0, 7);
      if (m !== lastM) {
        lastM = m; var mx = X(i);
        if (mx - lastX > minGap) {
          lastX = mx;
          c.strokeStyle = grid; c.beginPath(); c.moveTo(mx, L.y0); c.lineTo(mx, L.y1); c.stroke();
          var lab = MN[parseInt(s.d[i].slice(5, 7), 10) - 1] + (s.d[i].slice(5, 7) === '01' ? ' ' + s.d[i].slice(0, 4) : '');
          c.fillStyle = muted; c.fillText(lab, mx + 3, L.xAxis);
        }
      }
    }
    c.textBaseline = 'middle';
    // Bollinger band fill
    if (show.bb) {
      c.beginPath(); var started = false;
      for (i = from; i <= to; i++) { if (s.bb.up[i] == null) continue; if (!started) { c.moveTo(X(i), Y(s.bb.up[i])); started = true; } else c.lineTo(X(i), Y(s.bb.up[i])); }
      for (i = to; i >= from; i--) { if (s.bb.lo[i] == null) continue; c.lineTo(X(i), Y(s.bb.lo[i])); }
      c.closePath(); c.globalAlpha = 0.08; c.fillStyle = violet; c.fill(); c.globalAlpha = 1;
      line(s.bb.up, violet, 1, 0.6); line(s.bb.lo, violet, 1, 0.6); line(s.bb.mid, violet, 1, 0.35, [3, 3]);
    }
    // volume (bottom 18% of the price pane)
    if (show.vol && vmax) {
      var vh = (L.y1 - L.y0) * 0.18;
      for (i = from; i <= to; i++) {
        if (!s.v[i]) continue;
        var up = s.c[i] >= s.o[i], h = s.v[i] / vmax * vh;
        c.fillStyle = up ? 'rgba(62,203,124,0.28)' : 'rgba(224,72,63,0.28)';
        c.fillRect(X(i) - bw * 0.36, L.y1 - h, Math.max(1, bw * 0.72), h);
      }
    }
    function line(arr, col, w, alpha, dash) {
      c.strokeStyle = col; c.lineWidth = w || 1.3; c.globalAlpha = alpha == null ? 0.9 : alpha; c.setLineDash(dash || []);
      c.beginPath(); var pen = false;
      for (var k = from; k <= to; k++) { if (arr[k] == null) { pen = false; continue; } var x = X(k), y = Y(arr[k]); if (!pen) { c.moveTo(x, y); pen = true; } else c.lineTo(x, y); }
      c.stroke(); c.globalAlpha = 1; c.setLineDash([]);
    }
    if (show.sma50) line(s.sma50, gold, 1.4);
    if (show.sma20) line(s.sma20, acc, 1.4);
    if (show.ema9) line(s.ema9, violet, 1.3);
    // candles
    for (i = from; i <= to; i++) {
      var o = s.o[i], cl = s.c[i], x = X(i), col = cl >= o ? bull : bear;
      c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.moveTo(x, Y(s.h[i])); c.lineTo(x, Y(s.l[i])); c.stroke();
      var top = Y(Math.max(o, cl)), hgt = Math.max(1, Math.abs(Y(o) - Y(cl)));
      c.fillStyle = col; c.fillRect(x - bw * 0.36, top, Math.max(1, bw * 0.72), hgt);
      if (s.live && i === s.n - 1) { c.strokeStyle = acc; c.setLineDash([2, 2]); c.strokeRect(x - bw * 0.5, Y(s.h[i]) - 2, bw, Y(s.l[i]) - Y(s.h[i]) + 4); c.setLineDash([]); }
    }
    // fills on the chart
    this.marks.forEach(function (mk) {
      if (mk.i < from || mk.i > to) return;
      var x = X(mk.i), y = Y(mk.price), d = mk.side === 'buy' ? 1 : -1;
      c.fillStyle = mk.side === 'buy' ? bull : bear;
      c.beginPath(); c.moveTo(x, y + d * 3); c.lineTo(x - 5, y + d * 12); c.lineTo(x + 5, y + d * 12); c.closePath(); c.fill();
    });
    // horizontal lines: cost basis, open orders
    this.lines.forEach(function (ln) {
      var y = Y(ln.price); if (y < L.y0 || y > L.y1) return;
      c.strokeStyle = ln.color; c.lineWidth = 1; c.setLineDash(ln.dash || [5, 4]); c.beginPath(); c.moveTo(L.x0, y); c.lineTo(L.x1, y); c.stroke(); c.setLineDash([]);
      c.font = '600 9px "IBM Plex Mono", ui-monospace, monospace'; c.fillStyle = ln.color; c.textAlign = 'right'; c.textBaseline = 'bottom';
      c.fillText(ln.label, L.x1 - 4, y - 2); c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
      c.fillStyle = ln.color; c.fillRect(L.x1 + 1, y - 8, 62, 16); c.fillStyle = tagInk; c.fillText(fmt(ln.price), L.x1 + 6, y);
    });
    // last price tag
    if (this.lastPrice != null) {
      var ly = Y(this.lastPrice), up2 = this.lastPrice >= (s.c[s.n - 2] || this.lastPrice);
      if (ly >= L.y0 && ly <= L.y1) {
        c.strokeStyle = up2 ? bull : bear; c.globalAlpha = 0.6; c.setLineDash([1, 3]); c.beginPath(); c.moveTo(L.x0, ly); c.lineTo(L.x1, ly); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
        c.fillStyle = up2 ? bull : bear; c.fillRect(L.x1 + 1, ly - 9, 62, 18); c.fillStyle = '#ffffff'; c.font = '700 10px "IBM Plex Mono", ui-monospace, monospace'; c.fillText(fmt(this.lastPrice), L.x1 + 6, ly); c.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
      }
    }
    // sub panes
    L.panes.forEach(function (P) {
      c.strokeStyle = grid; c.strokeRect(L.x0, P.y0, L.x1 - L.x0, P.y1 - P.y0);
      if (P.kind === 'rsi') {
        var RY = function (v) { return P.y1 - v / 100 * (P.y1 - P.y0); };
        c.fillStyle = 'rgba(143,123,246,0.06)'; c.fillRect(L.x0, RY(70), L.x1 - L.x0, RY(30) - RY(70));
        [30, 70].forEach(function (lv) { c.strokeStyle = grid; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(L.x0, RY(lv)); c.lineTo(L.x1, RY(lv)); c.stroke(); c.setLineDash([]); c.fillStyle = muted; c.fillText(String(lv), L.x1 + 8, RY(lv)); });
        c.strokeStyle = violet; c.lineWidth = 1.3; c.beginPath(); var pen = false;
        for (var k = from; k <= to; k++) { var v = s.rsi[k]; if (v == null) continue; if (!pen) { c.moveTo(X(k), RY(v)); pen = true; } else c.lineTo(X(k), RY(v)); }
        c.stroke();
        c.fillStyle = muted; c.textBaseline = 'top'; c.fillText('RSI 14', L.x0 + 4, P.y0 + 3); c.textBaseline = 'middle';
      } else {
        var mm = 0; for (var k2 = from; k2 <= to; k2++) { [s.macd.line[k2], s.macd.signal[k2], s.macd.hist[k2]].forEach(function (v) { if (v != null) mm = Math.max(mm, Math.abs(v)); }); }
        mm = mm || 1;
        var MY = function (v) { return (P.y0 + P.y1) / 2 - v / mm * (P.y1 - P.y0) * 0.45; };
        for (k2 = from; k2 <= to; k2++) { var hv = s.macd.hist[k2]; if (hv == null) continue; c.fillStyle = hv >= 0 ? 'rgba(62,203,124,0.5)' : 'rgba(224,72,63,0.5)'; c.fillRect(X(k2) - bw * 0.3, Math.min(MY(0), MY(hv)), Math.max(1, bw * 0.6), Math.abs(MY(hv) - MY(0))); }
        [[s.macd.line, acc], [s.macd.signal, gold]].forEach(function (pr) {
          c.strokeStyle = pr[1]; c.lineWidth = 1.2; c.beginPath(); var pn = false;
          for (var k3 = from; k3 <= to; k3++) { var v2 = pr[0][k3]; if (v2 == null) continue; if (!pn) { c.moveTo(X(k3), MY(v2)); pn = true; } else c.lineTo(X(k3), MY(v2)); }
          c.stroke();
        });
        c.fillStyle = muted; c.textBaseline = 'top'; c.fillText('MACD 12 26 9', L.x0 + 4, P.y0 + 3); c.textBaseline = 'middle';
      }
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
    if (show.sma20) parts.push(['SMA20 ' + fmt(s.sma20[li]), acc]);
    if (show.sma50) parts.push(['SMA50 ' + fmt(s.sma50[li]), gold]);
    if (show.ema9) parts.push(['EMA9 ' + fmt(s.ema9[li]), violet]);
    if (show.rsi) parts.push(['RSI ' + fmt(s.rsi[li], 1), violet]);
    if (show.macd) parts.push(['MACD ' + fmt(s.macd.line[li]) + ' / ' + fmt(s.macd.signal[li]), acc]);
    c.font = '500 10.5px "IBM Plex Mono", ui-monospace, monospace'; c.textBaseline = 'middle';
    var lx = L.x0 + 2, ly2 = 10;
    parts.forEach(function (pt) {
      var w = c.measureText(pt[0]).width;
      if (lx + w > L.x1) { lx = L.x0 + 2; ly2 += 14; }
      c.fillStyle = pt[1]; c.fillText(pt[0], lx, ly2); lx += w + 12;
    });
  };
  function niceStep(raw) { var p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; }

  global.ZelosTradeChart = { TradeChart: TradeChart, computeIndicators: computeIndicators, fmt: fmt, fmtVol: fmtVol };
})(window);
