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
  function Chart(canvas, opts) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.opts = opts || {};
    this.s = null; this.from = 0; this.to = 0; this.cut = null; this.lines = []; this.zones = []; this.marks = [];
    this.hoverY = null; this.onPick = null; this.pickLine = null; this.showMA = true;
    var self = this;
    function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    canvas.addEventListener('pointermove', function (e) { self.hoverY = pos(e).y; self.hoverX = pos(e).x; self.draw(); });
    canvas.addEventListener('pointerleave', function () { self.hoverY = null; self.draw(); });
    canvas.addEventListener('pointerdown', function (e) {
      if (!self.onPick) return;
      var p = self.priceAt(pos(e).y);
      if (p != null) self.onPick(p);
    });
    if ('ResizeObserver' in global) new ResizeObserver(function () { self.resize(); }).observe(canvas);
    else global.addEventListener('resize', function () { self.resize(); });
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
    var padR = 58, volH = Math.round(this.H * 0.16);
    return { x0: 6, x1: this.W - padR, y0: 10, y1: this.H - volH - 18, vy0: this.H - volH - 4, vy1: this.H - 4 };
  };
  Chart.prototype.range = function () {
    var s = this.s, lo = Infinity, hi = -Infinity;
    for (var i = this.from; i <= this.to; i++) { if (s.l[i] < lo) lo = s.l[i]; if (s.h[i] > hi) hi = s.h[i]; }
    this.lines.forEach(function (ln) { if (ln.fit !== false) { lo = Math.min(lo, ln.price); hi = Math.max(hi, ln.price); } });
    var pad = (hi - lo) * 0.07 || 1;
    return { lo: lo - pad, hi: hi + pad };
  };
  Chart.prototype.priceAt = function (y) {
    if (!this.s) return null;
    var L = this.layout(), R = this._r || this.range();
    if (y < L.y0 || y > L.y1) return null;
    return R.hi - (y - L.y0) / (L.y1 - L.y0) * (R.hi - R.lo);
  };
  Chart.prototype.draw = function () {
    var c = this.ctx, s = this.s; if (!s || !this.W) return;
    var L = this.layout(), R = this.range(); this._r = R;
    var bull = cssVar('--bull', '#3ecb7c'), bear = cssVar('--danger', '#e0483f'), acc = cssVar('--accent', '#4a86ff');
    var gold = cssVar('--gold', '#d9a441'), muted = cssVar('--muted', '#8a8f98'), grid = 'rgba(255,255,255,0.06)', ink = cssVar('--ink', '#e8e6e1');
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.W, this.H);
    var n = this.to - this.from + 1, bw = (L.x1 - L.x0) / n;
    var from0 = this.from; function X(i) { return L.x0 + (i - from0 + 0.5) * bw; }
    var self = this;
    function Y(p) { return L.y0 + (R.hi - p) / (R.hi - R.lo) * (L.y1 - L.y0); }
    // grid + axis
    c.font = '500 10px "IBM Plex Mono", ui-monospace, monospace'; c.textBaseline = 'middle';
    var step = niceStep((R.hi - R.lo) / 5);
    for (var g = Math.ceil(R.lo / step) * step; g < R.hi; g += step) {
      var gy = Y(g); c.strokeStyle = grid; c.lineWidth = 1; c.beginPath(); c.moveTo(L.x0, gy); c.lineTo(L.x1, gy); c.stroke();
      c.fillStyle = muted; c.fillText(fmt(g, g >= 100 ? 0 : 2), L.x1 + 8, gy);
    }
    // future region tint
    if (this.cut != null && this.cut < this.to) {
      var fx = X(this.cut) + bw / 2;
      c.fillStyle = 'rgba(255,255,255,0.035)'; c.fillRect(fx, L.y0, L.x1 - fx, L.vy1 - L.y0);
      c.strokeStyle = 'rgba(255,255,255,0.25)'; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(fx, L.y0); c.lineTo(fx, L.vy1); c.stroke(); c.setLineDash([]);
      c.fillStyle = muted; c.textBaseline = 'top'; c.fillText('WHAT HAPPENED NEXT', fx + 6, L.y0 + 2); c.textBaseline = 'middle';
    }
    // zones
    this.zones.forEach(function (z) { c.fillStyle = z.color; c.fillRect(L.x0, Y(z.hi), L.x1 - L.x0, Y(z.lo) - Y(z.hi)); });
    // volume
    var vmax = 0; for (var i = this.from; i <= this.to; i++) vmax = Math.max(vmax, s.v[i]);
    for (i = this.from; i <= this.to; i++) {
      var up = s.c[i] >= s.o[i], vh = (s.v[i] / vmax) * (L.vy1 - L.vy0);
      c.fillStyle = up ? 'rgba(62,203,124,0.35)' : 'rgba(224,72,63,0.35)';
      c.fillRect(X(i) - bw * 0.35, L.vy1 - vh, Math.max(1, bw * 0.7), vh);
    }
    // moving averages
    if (this.showMA) {
      [[s.sma20, acc, '20d'], [s.sma50, gold, '50d']].forEach(function (m) {
        c.strokeStyle = m[1]; c.lineWidth = 1.4; c.globalAlpha = 0.85; c.beginPath(); var pen = false;
        for (var k = self.from; k <= self.to; k++) { if (m[0][k] == null) continue; var x = X(k), y = Y(m[0][k]); if (!pen) { c.moveTo(x, y); pen = true; } else c.lineTo(x, y); }
        c.stroke(); c.globalAlpha = 1;
      });
      c.textBaseline = 'top'; c.fillStyle = acc; c.fillText('— 20-day avg', L.x0 + 4, L.y0); c.fillStyle = gold; c.fillText('— 50-day avg', L.x0 + 96, L.y0); c.textBaseline = 'middle';
    }
    // candles
    for (i = this.from; i <= this.to; i++) {
      var o = s.o[i], cl = s.c[i], x = X(i), upc = cl >= o, col = upc ? bull : bear;
      var fut = this.cut != null && i > this.cut;
      c.globalAlpha = fut ? 0.8 : 1;
      c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.moveTo(x, Y(s.h[i])); c.lineTo(x, Y(s.l[i])); c.stroke();
      var top = Y(Math.max(o, cl)), hgt = Math.max(1, Math.abs(Y(o) - Y(cl)));
      c.fillStyle = col; c.fillRect(x - bw * 0.36, top, Math.max(1, bw * 0.72), hgt);
    }
    c.globalAlpha = 1;
    // horizontal lines
    this.lines.concat(this.pickLine ? [this.pickLine] : []).forEach(function (ln) {
      var y = Y(ln.price);
      c.strokeStyle = ln.color; c.lineWidth = ln.w || 1.3; c.setLineDash(ln.dash || []); c.beginPath(); c.moveTo(L.x0, y); c.lineTo(L.x1, y); c.stroke(); c.setLineDash([]);
      var label = ln.label + ' ' + fmt(ln.price);
      var tw = c.measureText(label).width + 10;
      c.fillStyle = ln.color; c.fillRect(L.x1 - tw - 2, y - 8, tw, 16);
      c.fillStyle = '#0b0c0f'; c.fillText(label, L.x1 - tw + 3, y);
    });
    // markers
    this.marks.forEach(function (m) {
      var x = X(m.i), y = Y(m.price), dir = m.type === 'buy' ? 1 : -1;
      c.fillStyle = m.color || (m.type === 'buy' ? bull : bear);
      c.beginPath(); c.moveTo(x, y + dir * 4); c.lineTo(x - 5, y + dir * 13); c.lineTo(x + 5, y + dir * 13); c.closePath(); c.fill();
    });
    // crosshair
    if (this.hoverY != null && this.hoverY >= L.y0 && this.hoverY <= L.y1) {
      var hp = this.priceAt(this.hoverY);
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.setLineDash([2, 3]); c.beginPath(); c.moveTo(L.x0, this.hoverY); c.lineTo(L.x1, this.hoverY); c.stroke(); c.setLineDash([]);
      c.fillStyle = ink; c.fillRect(L.x1 + 2, this.hoverY - 8, 54, 16);
      c.fillStyle = '#0b0c0f'; c.fillText(fmt(hp), L.x1 + 6, this.hoverY);
      if (this.hoverNote) { var t = this.hoverNote(hp); if (t) { c.fillStyle = 'rgba(11,12,15,0.85)'; var tw2 = c.measureText(t).width + 12; c.fillRect(L.x0 + 4, this.hoverY - 22, tw2, 16); c.fillStyle = ink; c.fillText(t, L.x0 + 10, this.hoverY - 14); } }
    }
  };
  function niceStep(raw) { var p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; }

  // ------------------------------------------------------------ rounds
  // Each round renders into `host` and calls done(result) once the player
  // moves on. result = { points, max, grade: 'g'|'y'|'r', label }
  function gradeRound(host, data, r, meta, done) {
    var pick = pickGrade(data, r), s = pick.s, i = pick.i, ev = evaluateSetup(s, i);
    host.innerHTML = '';
    var head = el('div', 'zg-round-head', '<span class="zg-kicker">' + (meta.label || 'Grade the setup') + '</span><span class="zg-round-no">' + (meta.no || '') + '</span>');
    var wrap = el('div', 'zg-chart-wrap'); var cv = el('canvas', 'zg-chart'); wrap.appendChild(cv);
    var prompt = el('p', 'zg-prompt', 'Hidden ticker, real daily chart. Planned trade: buy at today\'s close <b>' + fmt(ev.entry) + '</b>, stop <b>' + fmt(ev.stop) + '</b>, target <b>' + fmt(ev.target) + '</b>. Run the checklist, then decide.');
    var qs = [
      ['trend', 'Trend', 'Is price above a <em>rising</em> 50-day average?'],
      ['support', 'Support', 'Has it pulled back to within about 3% of the 20-day average?'],
      ['volume', 'Volume', 'Was volume lighter on the last 3 days than the 20 before?'],
      ['reward', 'Reward:risk', 'Is the target at least 2&times; as far as the stop?']
    ];
    var answers = {};
    var list = el('div', 'zg-checklist');
    qs.forEach(function (q) {
      var row = el('div', 'zg-q', '<div class="zg-q-text"><b>' + q[1] + '</b><span>' + q[2] + '</span></div>');
      var btns = el('div', 'zg-yn');
      ['Yes', 'No'].forEach(function (lab) {
        var b = el('button', 'zg-btn zg-btn-sm', lab); b.type = 'button';
        b.addEventListener('click', function () {
          if (host._locked) return;
          answers[q[0]] = lab === 'Yes';
          btns.querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-on', x === b); });
          check();
        });
        btns.appendChild(b);
      });
      row.appendChild(btns); row.appendChild(el('div', 'zg-q-exp')); list.appendChild(row); q.row = row;
    });
    var actions = el('div', 'zg-actions');
    var bTake = el('button', 'zg-btn zg-btn-primary', 'Qualifies: take it'); bTake.type = 'button'; bTake.disabled = true;
    var bPass = el('button', 'zg-btn', 'Doesn\'t qualify: pass'); bPass.type = 'button'; bPass.disabled = true;
    actions.appendChild(bTake); actions.appendChild(bPass);
    var result = el('div', 'zg-result'); result.hidden = true;
    [head, wrap, prompt, list, actions, result].forEach(function (x) { host.appendChild(x); });
    var ch = new Chart(cv);
    ch.lines = [
      { price: ev.entry, color: '#d8dde6', label: 'ENTRY', dash: [4, 3] },
      { price: ev.stop, color: cssVar('--danger', '#e0483f'), label: 'STOP' },
      { price: ev.target, color: cssVar('--bull', '#3ecb7c'), label: 'TARGET' }
    ];
    ch.set(s, i - 89, i);
    function check() { var ok = qs.every(function (q) { return answers[q[0]] !== undefined; }); bTake.disabled = bPass.disabled = !ok; }
    function submit(take) {
      if (host._locked) return; host._locked = true;
      bTake.disabled = bPass.disabled = true;
      var pts = 0;
      qs.forEach(function (q) {
        var right = answers[q[0]] === ev[q[0]];
        if (right) pts += 1;
        q.row.classList.add(right ? 'is-right' : 'is-wrong');
        q.row.querySelector('.zg-q-exp').innerHTML = (right ? '✓ ' : '✗ ') + (ev[q[0]] ? '<b>Yes.</b> ' : '<b>No.</b> ') + ev.detail[q[0]];
      });
      var finalRight = take === ev.qualifies;
      if (finalRight) pts += 2;
      var out = simulate(s, i, ev.entry, ev.stop, ev.target, 20);
      ch.set(s, i - 69, Math.min(s.n - 1, i + 20), i);
      var outTxt = out.kind === 'target' ? 'hit the target on day ' + out.day + ' (+' + fmt(out.r, 1) + 'R)'
        : out.kind === 'stop' ? 'was stopped out on day ' + out.day + ' (' + fmt(out.r, 1) + 'R' + (out.gap ? ', gapped through the stop' : '') + ')'
        : 'was still open after 20 days (' + (out.r >= 0 ? '+' : '') + fmt(out.r, 1) + 'R)';
      var grade = pts >= 5 ? 'g' : pts >= 3 ? 'y' : 'r';
      result.hidden = false;
      result.innerHTML =
        '<div class="zg-verdict ' + grade + '">' + (finalRight ? 'Right call.' : 'Wrong call.') + ' The checklist says <b>' + (ev.qualifies ? 'qualifies' : 'pass') + '</b>. +' + pts + ' / 6</div>' +
        '<p>This was <b>' + s.sym + '</b>, ' + monthYear(s.d[i]) + '. Taken at the close, the trade ' + outTxt + '.</p>' +
        '<p class="zg-fine">Outcomes vary even for textbook setups. The points are for following the checklist correctly, not for guessing the future.</p>';
      var next = el('button', 'zg-btn zg-btn-primary', meta.nextLabel || 'Next &rarr;'); next.type = 'button';
      next.addEventListener('click', function () { done({ points: pts, max: 6, grade: grade, sym: s.sym, date: s.d[i] }); });
      result.appendChild(next);
      try { next.focus({ preventScroll: true }); } catch (e) {}
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
    ch.lines = [{ price: entry, color: '#d8dde6', label: 'ENTRY', dash: [4, 3] }];
    ch.hoverNote = function (p) { return p < entry ? 'risk ' + fmt((entry - p) / entry * 100, 1) + '% · ' + fmt((entry - p) / a, 1) + '× daily range' : null; };
    ch.onPick = function (p) {
      if (host._locked) return;
      if (p >= entry) { status.textContent = 'A long position\'s stop goes below the entry.'; return; }
      stop = p; ch.pickLine = { price: p, color: cssVar('--danger', '#e0483f'), label: 'YOUR STOP', fit: false };
      status.innerHTML = 'Stop <b>' + fmt(p) + '</b> · risk ' + fmt((entry - p) / entry * 100, 1) + '% of price · ' + fmt((entry - p) / a, 1) + '× the daily range';
      lock.disabled = false; ch.draw();
    };
    ch.set(s, i - 79, i);
    lock.addEventListener('click', function () {
      if (host._locked || stop == null) return; host._locked = true; lock.disabled = true; ch.onPick = null;
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
        { price: entry, color: '#d8dde6', label: 'ENTRY', dash: [4, 3] },
        { price: swing, color: cssVar('--gold', '#d9a441'), label: 'SWING LOW', dash: [2, 3] },
        { price: tgt, color: cssVar('--bull', '#3ecb7c'), label: '2R TARGET', fit: false }
      ];
      ch.set(s, i - 59, Math.min(s.n - 1, i + 20), i);
      var outTxt = out.kind === 'target' ? 'reached the 2R target on day ' + out.day : out.kind === 'stop' ? 'hit your stop on day ' + out.day : 'neither stop nor target was hit in 20 days';
      var grade = pts >= 80 ? 'g' : pts >= 50 ? 'y' : 'r';
      result.hidden = false;
      result.innerHTML = '<div class="zg-verdict ' + grade + '">' + verdict + ' <b>+' + pts + ' / 100</b></div>' +
        '<p>The green band is the structural stop zone (just under the swing low, within one daily range). This was <b>' + s.sym + '</b>, ' + monthYear(s.d[i]) + '. With your stop, price ' + outTxt + '.</p>' +
        '<p class="zg-fine">70 points are for placement and 30 for what happened next. Placement is the skill; the outcome is partly luck.</p>';
      var next = el('button', 'zg-btn zg-btn-primary', meta.nextLabel || 'Next &rarr;'); next.type = 'button';
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
