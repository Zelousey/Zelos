(function () {
  var START_EQ = 10000, PLAY = 60, HIST = 100, WAIT_BARS = 3, WAIT_MS = 280, IDLE_MS = 14000;
  var $ = function (id) { return document.getElementById(id); };
  var ch, s, cur, end, startIdx, eq, pos, draft, mode, trades, log, peak, maxDD, widen, lowRR, fullPorts, auto, rand, gameSeed, finished;
  var revealing = false, hesitating = false, idleTimer = null, dragFrom = null;
  var RED = function () { return ZC.cssVar('--danger', '#e0483f'); }, GREEN = function () { return ZC.cssVar('--bull', '#3ecb7c'); };
  var TIPS = [
    'Patience is a position. Waiting for price to come to your level beats chasing a move that already left.',
    'A stop belongs where the idea is proven wrong: just past the last swing low for a long, the last swing high for a short.',
    'Aim for at least 2:1. With 2R winners you can be wrong more often than right and still come out ahead.',
    'Trade with the 50-day average: longs above a rising 50-day, shorts below a falling one.',
    'Volume confirms. Breakouts on heavy volume hold more often than breakouts on light volume.',
    'Pullbacks on lighter volume are healthy; heavy selling into support is a warning.',
    'One good trade beats five forced ones. Overtrading costs discipline points here and money in real life.'
  ];

  function setHint(h) { $('zrHint').innerHTML = h; }
  function addLog(t) { log.unshift(t); $('zrLog').innerHTML = log.slice(0, 30).map(function (x) { return '<div>' + x + '</div>'; }).join(''); }
  function barNo() { return cur - startIdx + 1; }
  function isFull() { return $('zrRisk').value === 'full'; }
  function riskPct() { return isFull() ? null : parseFloat($('zrRisk').value) / 100; }
  function sizeFor(price, stop) {
    if (isFull()) return Math.floor(eq / price);
    return Math.floor(riskPct() * eq / Math.abs(price - stop));
  }
  function mtm() { return pos ? eq + pos.side * (s.c[cur] - pos.entry) * pos.qty : eq; }
  function sideWord(sd) { return sd > 0 ? 'long' : 'short'; }

  // ------------------------------------------------------------ reading the chart
  // Same rules the checklist teaches, used here only to decide when to nudge
  // the player toward an entry. Nothing is traded for them.
  function detectSetup() {
    var i = cur, c = s.c[i], m20 = s.sma20[i], m50 = s.sma50[i], m50p = s.sma50[i - 10], v20 = s.vol20[i];
    if (m20 == null || m50 == null || m50p == null) return null;
    var e = ZC.evaluateSetup(s, i);
    if (e.trend && e.support) return { side: 1, text: '<b>Possible long setup:</b> an uptrend (above a rising 50-day) that has pulled back to the 20-day average. That\'s the pullback the checklist looks for. If you like it, <b>Go long</b> with a stop under the recent swing low (' + ZC.fmt(ZC.minRange(s.l, i - 9, i)) + ').' };
    var hi20 = ZC.maxRange(s.h, i - 20, i - 1), lo20 = ZC.minRange(s.l, i - 20, i - 1);
    if (c > hi20 && c > m50 && s.v[i] > 1.3 * v20) return { side: 1, text: '<b>Breakout:</b> a close above the 20-day high (' + ZC.fmt(hi20) + ') on heavy volume, above the 50-day. Breakouts like this often retest the old high: <b>Go long</b> now, or wait for the retest.' };
    if (c < m50 && m50 < m50p && Math.abs(c - m20) / m20 <= 0.03 && ZC.minRange(s.l, i - 9, i) <= c * 0.97) return { side: -1, text: '<b>Possible short setup:</b> a downtrend (below a falling 50-day) bouncing back into the 20-day average. If it fails here, <b>Go short</b> with a stop above the recent swing high (' + ZC.fmt(ZC.maxRange(s.h, i - 9, i)) + ').' };
    if (c < lo20 && c < m50 && s.v[i] > 1.3 * v20) return { side: -1, text: '<b>Breakdown:</b> a close under the 20-day low (' + ZC.fmt(lo20) + ') on heavy volume, below the 50-day. <b>Go short</b>, or wait for a bounce back into the broken level.' };
    return null;
  }

  function tip() {
    var c = s.c[cur];
    if (finished) return null;
    if (hesitating) return { ico: '⏳', text: '<b>Not seeing a setup? Wait for confirmation.</b> Press <b>Wait</b> to reveal the next few bars. Sitting out a messy chart is a decision too.' };
    if (mode === 'stop' && draft) {
      var sw = draft.side > 0 ? ZC.minRange(s.l, cur - 9, cur) : ZC.maxRange(s.h, cur - 9, cur);
      return { ico: '🛑', text: 'The 10-day swing ' + (draft.side > 0 ? 'low' : 'high') + ' is <b>' + ZC.fmt(sw) + '</b>. A stop just ' + (draft.side > 0 ? 'below' : 'above') + ' it is where this idea is proven wrong. Average daily range: ' + ZC.fmt(s.atr[cur]) + '.' };
    }
    if ((mode === 'target' || mode === 'ptarget') && (draft || pos)) {
      var sd = draft ? draft.side : pos.side, lvl = sd > 0 ? ZC.maxRange(s.h, cur - 30, cur) : ZC.minRange(s.l, cur - 30, cur);
      return { ico: '🎯', text: 'The recent ' + (sd > 0 ? 'high' : 'low') + ' is <b>' + ZC.fmt(lvl) + '</b>, the natural first target. If the trend is strong and price is already there, a 2–3R target beyond it is reasonable.' };
    }
    if (pos) {
      var r0 = Math.abs(pos.entry - pos.stop0), ur = pos.side * (c - pos.entry) / r0;
      var losingSideStop = pos.side * (pos.entry - pos.stop) > 0;
      if (ur >= 1 && losingSideStop) return { ico: '🔒', text: 'You\'re up <b>' + ur.toFixed(1) + 'R</b>. Many traders trail the stop to breakeven here: <b>drag the red handle</b> to ' + ZC.fmt(pos.entry) + ' and the trade can no longer lose.' };
      if (pos.target) {
        var left = pos.side * (pos.target - c) / r0;
        var strong = pos.side > 0 ? (c > s.sma20[cur] && s.sma20[cur] > s.sma20[cur - 5] && c >= ZC.maxRange(s.h, cur - 10, cur - 1))
          : (c < s.sma20[cur] && s.sma20[cur] < s.sma20[cur - 5] && c <= ZC.minRange(s.l, cur - 10, cur - 1));
        if (left < 0.4 && strong) return { ico: '🚀', text: 'Strong trend running into your target. If the chart supports a bigger move, <b>drag the green handle farther</b> to let the winner run. Moving a target costs no discipline points.' };
      } else return { ico: '🎯', text: 'No target set, so you\'re managing the exit yourself. Use <b>Set target</b> any time, then drag it wherever the chart says.' };
      return { ico: '✋', text: 'In a ' + sideWord(pos.side) + ' at ' + ZC.fmt(pos.entry) + ', ' + (ur >= 0 ? '+' : '') + ur.toFixed(1) + 'R. <b>Hold</b> lets the plan work; drag either handle to manage it, or <b>Close</b> at the next open.' };
    }
    if (draft && draft.queued) return { ico: '⏱', text: 'Order queued. It fills at the next bar\'s open. Press <b>Wait</b>.' };
    var st = detectSetup();
    if (st) return { ico: st.side > 0 ? '📈' : '📉', text: st.text, side: st.side };
    return { ico: '💡', text: TIPS[Math.floor(barNo() / 6) % TIPS.length] };
  }

  // ------------------------------------------------------------ game setup
  function newGame(seed) {
    ZC.load().then(function (data) {
      gameSeed = seed || String(Date.now());
      rand = ZC.rng(gameSeed);
      var pick = ZC.pickReplay(data, rand, PLAY, HIST + 60);
      s = pick.s; startIdx = pick.start; cur = startIdx; end = startIdx + PLAY - 1;
      eq = START_EQ; pos = null; draft = null; mode = null; trades = []; log = []; peak = START_EQ; maxDD = 0; widen = 0; lowRR = 0; fullPorts = 0; finished = false;
      revealing = false; hesitating = false;
      stopAuto();
      $('zrEnd').hidden = true; $('zrPlay').hidden = false;
      $('zrLog').innerHTML = '';
      ch.lines = []; ch.marks = []; ch.zones = []; ch.pickLine = null; ch.onPick = onPick; ch.onDrag = onDrag;
      ch.padBars = 16; ch.banner = null;
      $('zrChart').classList.add('zg-pickable');
      render();
      setHint('Real daily chart, ticker hidden. You have <b>' + PLAY + ' bars</b> to trade a $10,000 practice account. Every trade needs a stop. Press <b>Wait</b> (or →) to watch price develop, and enter only when you see a setup.');
      touch();
    }).catch(function () { setHint('Couldn\'t load chart data. Refresh to try again.'); });
  }

  // ------------------------------------------------------------ drawing + guidance
  function render() {
    ch.lines = []; ch.handles = []; ch.box = null; ch.prompt = null;
    var red = RED(), green = GREEN();
    if (pos) {
      ch.box = { from: pos.entryIdx, entry: pos.entry, stop: pos.stop, target: pos.target };
      ch.handles.push({ id: 'stop', price: pos.stop, color: red, label: 'STOP' });
      if (pos.target) ch.handles.push({ id: 'target', price: pos.target, color: green, label: 'TARGET' });
    } else if (draft) {
      ch.box = { from: cur + 1, entry: s.c[cur], stop: draft.stop, target: draft.target };
      if (draft.stop != null) ch.handles.push({ id: 'stop', price: draft.stop, color: red, label: 'STOP' });
      if (draft.target != null) ch.handles.push({ id: 'target', price: draft.target, color: green, label: 'TARGET' });
    }
    if (mode === 'stop') ch.prompt = { text: '① Tap the chart to set your STOP ' + (draft.side > 0 ? 'below' : 'above') + ' price', color: red };
    else if (mode === 'target') ch.prompt = { text: '② Tap to set your TARGET ' + (draft.side > 0 ? 'above' : 'below') + ' price, or skip it', color: green };
    else if (mode === 'ptarget') ch.prompt = { text: 'Tap the chart to set your TARGET', color: green };
    else if (hesitating) ch.prompt = { text: 'Not seeing a setup? Wait for confirmation.', color: ZC.cssVar('--accent', '#4a86ff') };
    var span = ($('zrChart').clientWidth < 600) ? 60 : HIST;
    ch.set(s, Math.max(0, cur - span + 1), cur);

    var m = mtm(), ret = (m / START_EQ - 1) * 100;
    $('zrEq').textContent = ZC.money(m);
    $('zrRet').textContent = (ret >= 0 ? '+' : '') + ret.toFixed(2) + '%';
    $('zrRet').className = ret >= 0 ? 'up' : 'dn';
    $('zrBar').textContent = Math.min(PLAY, barNo()) + ' / ' + PLAY;
    var rs = trades.reduce(function (a, t) { return a + t.r; }, 0);
    $('zrR').textContent = (rs >= 0 ? '+' : '') + rs.toFixed(1) + 'R';
    $('zrR').className = rs >= 0 ? 'up' : 'dn';

    var busy = finished || revealing;
    $('zrLong').disabled = !!pos || !!(draft && draft.queued) || busy;
    $('zrShort').disabled = !!pos || !!(draft && draft.queued) || busy;
    $('zrClose').disabled = !pos || busy;
    $('zrSetTarget').hidden = !pos || !!pos.target;
    $('zrSetTarget').disabled = busy;
    $('zrWait').disabled = busy;
    $('zrWait').innerHTML = pos ? 'Hold &#9656;' : 'Wait &#9656;';
    $('zrWait').title = pos ? 'Hold the position and reveal the next few bars' : 'Stay flat and reveal the next few bars';
    $('zrCancel').hidden = !mode && !(draft && draft.queued);
    $('zrConfirm').hidden = mode !== 'confirm' && mode !== 'target';
    $('zrConfirm').textContent = mode === 'target' ? 'Skip target' : 'Place order';

    var t = tip(), box = $('zrTip');
    if (t) { box.hidden = false; box.className = 'zr-tip' + (hesitating ? ' is-warn' : ''); box.innerHTML = '<span class="zr-tip-ico" aria-hidden="true">' + t.ico + '</span><span>' + t.text + '</span>'; }
    else box.hidden = true;
    guide(t);
  }

  // exactly one next action glows at a time
  function guide(t) {
    ['zrWait', 'zrLong', 'zrShort', 'zrConfirm', 'zrSetTarget'].forEach(function (id) { $(id).classList.remove('zg-pulse'); });
    if (finished || revealing) return;
    if (mode === 'confirm') return $('zrConfirm').classList.add('zg-pulse');
    if (mode) return; // stop/target: the prompt and handles on the chart carry it
    if (pos || (draft && draft.queued) || hesitating) return $('zrWait').classList.add('zg-pulse');
    if (t && t.side) return $(t.side > 0 ? 'zrLong' : 'zrShort').classList.add('zg-pulse');
    $('zrWait').classList.add('zg-pulse');
  }

  // idle detection → "Not seeing a setup? Wait for confirmation."
  function touch() {
    if (hesitating) { hesitating = false; if (s && !finished) render(); }
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (finished || revealing || pos || mode || (draft && draft.queued) || auto) return;
      hesitating = true; render();
    }, IDLE_MS);
  }

  // ------------------------------------------------------------ orders
  function beginOrder(side) {
    if (pos || finished || revealing || (draft && draft.queued)) return;
    touch(); stopAuto();
    draft = { side: side, stop: null, target: null };
    mode = 'stop';
    setHint('<b>Tap the chart to set your stop</b> ' + (side > 0 ? 'below' : 'above') + ' the current price (' + ZC.fmt(s.c[cur]) + '). ' +
      (isFull() ? 'You\'re on <b>Full Port</b>: the whole account goes in, so your loss at the stop is whatever that distance costs on every share.' : 'Position size is set so hitting it costs ' + (riskPct() * 100) + '% of the account.') +
      ' Or press <b>Wait</b> to skip this one.');
    render();
  }
  function validStop(side, px, p) { return side * (px - p) > 0; }
  function validTarget(side, px, p) { return side * (p - px) > 0; }
  function onPick(p) {
    touch();
    var px = s.c[cur];
    if (mode === 'stop') {
      if (!validStop(draft.side, px, p)) { setHint('That\'s on the wrong side. A ' + sideWord(draft.side) + ' stop goes ' + (draft.side > 0 ? 'below' : 'above') + ' ' + ZC.fmt(px) + '.'); return; }
      draft.stop = p; mode = 'target';
      setHint('Stop set at <b>' + ZC.fmt(p) + '</b>. Now <b>tap a target</b>, or skip it and manage the exit yourself. Drag the red handle to adjust.');
    } else if (mode === 'target') {
      if (!validTarget(draft.side, px, p)) { setHint('A target goes ' + (draft.side > 0 ? 'above' : 'below') + ' the current price.'); return; }
      draft.target = p; mode = 'confirm';
      confirmHint();
    } else if (mode === 'ptarget' && pos) {
      if (!validTarget(pos.side, px, p)) { setHint('A target goes ' + (pos.side > 0 ? 'above' : 'below') + ' the current price.'); return; }
      pos.target = p; mode = null;
      addLog('Bar ' + barNo() + ': target set at ' + ZC.fmt(p));
      setHint('Target set at <b>' + ZC.fmt(p) + '</b>. Drag the green handle to move it.');
    }
    render();
  }
  function confirmHint() {
    var px = s.c[cur], rr = draft.target ? Math.abs(draft.target - px) / Math.abs(px - draft.stop) : null;
    var q = sizeFor(px, draft.stop), riskAcct = q * Math.abs(px - draft.stop) / eq * 100;
    setHint((rr != null ? 'Planned reward:risk <b>' + rr.toFixed(1) + ':1</b>' + (rr < 1.5 ? ' (thin; the checklist wants 2:1). ' : '. ') : 'No target: you\'ll manage the exit. ') +
      (isFull() ? '<b>Full Port:</b> about ' + q + ' shares, risking roughly <b>' + riskAcct.toFixed(1) + '% of the account</b> at your stop. ' : '') +
      'Drag either handle to fine-tune, then <b>Place order</b>. It fills at the next open.');
  }
  // drag either handle, any time: while planning, while queued, or in the trade
  function onDrag(id, p, phase) {
    if (finished || revealing) return;
    touch();
    try { dragMove(id, p, phase); } finally { if (phase === 'end') dragFrom = null; }
    render();
  }
  function dragMove(id, p, phase) {
    var px = s.c[cur];
    if (pos) {
      if (id === 'stop') {
        if (!validStop(pos.side, px, p)) { if (phase !== 'end') return; p = pos.stop; } // released past price: keep the last valid spot
        if (dragFrom == null) dragFrom = pos.stop;
        pos.stop = p;
        if (phase === 'end') {
          var wider = pos.side > 0 ? p < dragFrom : p > dragFrom;
          if (Math.abs(p - dragFrom) > 1e-9) {
            if (wider) { widen++; addLog('Bar ' + barNo() + ': stop moved further away to ' + ZC.fmt(p) + ' (discipline −15)'); setHint('Stop widened to <b>' + ZC.fmt(p) + '</b>. Widening a stop after entry costs 15 discipline points.'); }
            else { addLog('Bar ' + barNo() + ': stop tightened to ' + ZC.fmt(p)); setHint('Stop tightened to <b>' + ZC.fmt(p) + '</b>.'); }
          }
        }
      } else if (id === 'target') {
        if (!validTarget(pos.side, px, p)) { if (phase !== 'end') return; p = pos.target; }
        if (dragFrom == null) dragFrom = pos.target;
        pos.target = p;
        if (phase === 'end') {
          var farther = pos.side * (p - dragFrom) > 0;
          if (Math.abs(p - dragFrom) > 1e-9) { addLog('Bar ' + barNo() + ': target moved ' + (farther ? 'farther' : 'closer') + ' to ' + ZC.fmt(p)); setHint('Target ' + (farther ? 'extended' : 'pulled in') + ' to <b>' + ZC.fmt(p) + '</b>' + (farther ? ': letting the winner run.' : '.')); }
        }
      }
    } else if (draft) {
      if (id === 'stop' && validStop(draft.side, px, p)) draft.stop = p;
      if (id === 'target' && validTarget(draft.side, px, p)) draft.target = p;
      if (phase === 'end' && mode === 'confirm') confirmHint();
    }
  }
  function confirmOrder() {
    touch();
    if (mode === 'target') mode = 'confirm';
    if (mode !== 'confirm') return;
    draft.queued = true; mode = null;
    setHint('Order queued: ' + (draft.side > 0 ? 'buy' : 'short') + ' at the next open with stop ' + ZC.fmt(draft.stop) + (draft.target ? ', target ' + ZC.fmt(draft.target) : '') + '. Press <b>Wait</b>.');
    render();
  }
  function cancel() {
    touch();
    if (mode === 'ptarget') mode = null;
    else { draft = null; mode = null; }
    setHint('Cancelled.'); render();
  }

  function closePos(price, why) {
    var pnl = pos.side * (price - pos.entry) * pos.qty;
    var r = pnl / pos.risk;
    eq += pnl;
    trades.push({ r: r, pnl: pnl });
    ch.marks.push({ i: cur, price: price, type: pos.side > 0 ? 'sell' : 'buy', color: ZC.cssVar('--ink', '#d8dde6') });
    addLog('Bar ' + barNo() + ': ' + why + ' at ' + ZC.fmt(price) + ' · ' + (pnl >= 0 ? '+' : '') + ZC.money(pnl) + ' (' + (r >= 0 ? '+' : '') + r.toFixed(2) + 'R)');
    setHint(why + ' at ' + ZC.fmt(price) + ': <b>' + (r >= 0 ? '+' : '') + r.toFixed(2) + 'R</b> (' + (pnl >= 0 ? '+' : '') + ZC.money(pnl) + '). Flat now; wait for the next setup.');
    pos = null;
  }

  // advances one bar; returns true if something happened the player should see
  function step() {
    if (finished) return true;
    if (cur >= end) { finish(); return true; }
    cur++;
    var o = s.o[cur], h = s.h[cur], l = s.l[cur], event = false;
    if (pos && pos.exitNext) { closePos(o, 'Closed at the open'); event = true; }
    if (draft && draft.queued) {
      var riskPer = Math.abs(o - draft.stop);
      if (draft.side * (o - draft.stop) <= 0) { addLog('Bar ' + barNo() + ': order cancelled, price opened through your stop'); setHint('Price opened through your stop, so the order was cancelled.'); draft = null; }
      else {
        var full = isFull(), qty = sizeFor(o, draft.stop);
        if (qty < 1) { addLog('Bar ' + barNo() + ': stop too wide to size even 1 share'); draft = null; }
        else {
          pos = { side: draft.side, entry: o, entryIdx: cur, stop: draft.stop, stop0: draft.stop, target: draft.target, qty: qty, risk: qty * riskPer, full: full };
          if (full) fullPorts++;
          if (draft.target && Math.abs(draft.target - o) / riskPer < 1.5) lowRR++;
          ch.marks.push({ i: cur, price: o, type: pos.side > 0 ? 'buy' : 'sell' });
          addLog('Bar ' + barNo() + ': ' + (pos.side > 0 ? 'bought ' : 'shorted ') + qty + ' @ ' + ZC.fmt(o) + ' · risking ' + ZC.money(pos.risk) + (full ? ' (Full Port, ' + (pos.risk / eq * 100).toFixed(1) + '% of account, discipline −25)' : ''));
          setHint('Filled: ' + sideWord(pos.side) + ' ' + qty + ' shares at ' + ZC.fmt(o) + ', risking ' + ZC.money(pos.risk) + '. Let the plan work with <b>Hold</b>, or drag the handles to manage it.');
          draft = null;
        }
      }
      event = true;
    }
    if (pos) {
      var sd = pos.side;
      if (sd * (o - pos.stop) <= 0) { closePos(o, 'Gapped through the stop'); event = true; }
      else if (sd > 0 ? l <= pos.stop : h >= pos.stop) { closePos(pos.stop, 'Stopped out'); event = true; }
      else if (pos.target && (sd > 0 ? h >= pos.target : l <= pos.target)) { closePos(sd * (o - pos.target) >= 0 ? o : pos.target, 'Target hit'); event = true; }
    }
    var m = mtm(); peak = Math.max(peak, m); maxDD = Math.max(maxDD, (peak - m) / peak);
    if (cur >= end) { render(); finish(); return true; }
    if (!pos && !draft && detectSetup()) event = true; // stop the reveal so the player can act on it
    return event;
  }

  // Wait / Hold: reveal a few bars one at a time, stopping early on anything new
  function wait(n) {
    if (finished || revealing) return;
    touch();
    if (mode === 'stop' || mode === 'target' || mode === 'confirm') {
      draft = null; mode = null;
      addLog('Bar ' + barNo() + ': skipped the entry, waiting for confirmation');
    } else if (mode === 'ptarget') mode = null;
    revealing = true; render();
    var left = n || WAIT_BARS;
    (function next() {
      var ev = step(); left--;
      if (finished) { revealing = false; return; }
      if (ev || left <= 0) { revealing = false; render(); touch(); return; }
      render();
      setTimeout(next, WAIT_MS);
    })();
  }

  function finish() {
    if (finished) return;
    stopAuto(); clearTimeout(idleTimer); hesitating = false;
    if (pos) closePos(s.c[cur], 'Closed at the final bar');
    finished = true; draft = null; mode = null; revealing = false;
    var n = trades.length, wins = trades.filter(function (t) { return t.r > 0; }).length;
    var totR = trades.reduce(function (a, t) { return a + t.r; }, 0);
    var disc = Math.max(0, 100 - 15 * widen - 10 * lowRR - 25 * fullPorts - (n > 8 ? 20 : 0));
    var bh = (s.c[end] / s.o[startIdx] - 1) * 100;
    var ret = (eq / START_EQ - 1) * 100;
    var score = Math.max(0, Math.round((1000 + totR * 200) * disc / 100));
    if (n === 0) score = 0;
    render();
    ch.onPick = null; ch.onDrag = null; ch.handles = []; ch.box = null; ch.prompt = null; ch.padBars = 0;
    ch.set(s, Math.max(0, startIdx - 40), end);
    var best = ZC.store('zrBest') || 0; if (score > best) ZC.store('zrBest', score);
    $('zrPlay').hidden = true; $('zrEnd').hidden = false;
    $('zrEnd').innerHTML =
      '<p class="zg-kicker">Session over</p><h2>This was ' + s.sym + ', ' + ZC.monthYear(s.d[startIdx]) + ' – ' + ZC.monthYear(s.d[end]) + '</h2>' +
      '<div class="zg-big">' + score.toLocaleString() + '</div><p class="zg-fine">Score = (1,000 + 200 × total R) × discipline%. ' + (n === 0 ? 'No trades, no score: sitting out every bar isn\'t a strategy either.' : '') + (score > best ? ' New personal best.' : ' Personal best: ' + best.toLocaleString() + '.') + '</p>' +
      '<div class="zg-scorecard">' +
      card('Final equity', ZC.money(eq), ret >= 0) + card('Your return', (ret >= 0 ? '+' : '') + ret.toFixed(2) + '%', ret >= 0) +
      card('Buy & hold', (bh >= 0 ? '+' : '') + bh.toFixed(2) + '%', bh >= 0) + card('Total R', (totR >= 0 ? '+' : '') + totR.toFixed(2) + 'R', totR >= 0) +
      card('Trades', n) + card('Win rate', n ? Math.round(wins / n * 100) + '%' : '–') +
      card('Max drawdown', (maxDD * 100).toFixed(1) + '%') + card('Discipline', disc + '%', disc >= 80) + '</div>' +
      '<p class="zg-fine">Discipline loses 15 for each time a stop was moved further away, 10 for each trade planned under 1.5:1, 25 for each Full Port trade, and 20 for more than 8 trades.</p>' +
      '<div class="zg-actions"><button class="zg-btn zg-btn-primary" id="zrAgain" type="button">New chart</button><button class="zg-btn" id="zrShare" type="button">Share result</button>' +
      '<a class="zg-btn zg-back" href="../arcade.html">&larr; Back to Arcade</a><a class="zg-btn zg-back" href="../leaderboard.html#chart-replay">Leaderboard</a></div>';
    $('zrAgain').addEventListener('click', function () { newGame(); });
    $('zrShare').addEventListener('click', function () {
      var b = this;
      ZC.share('Zelos Chart Replay: ' + score.toLocaleString() + ' pts on a hidden ' + ZC.monthYear(s.d[startIdx]) + ' chart. ' + (totR >= 0 ? '+' : '') + totR.toFixed(1) + 'R, ' + disc + '% discipline. Can you beat it?', 'https://agentictrading.info/games/chart-replay.html?seed=' + encodeURIComponent(gameSeed))
        .then(function () { b.textContent = 'Copied ✓'; });
    });
    if (n > 0 && window.zgLeaderboard) zgLeaderboard($('zrEnd'), 'chart-replay', score, 'Chart Replay', gameSeed);
  }
  function card(k, v, good) { return '<div class="zg-stat"><small>' + k + '</small><b class="' + (good === true ? 'up' : good === false ? 'dn' : '') + '">' + v + '</b></div>'; }

  function toggleAuto() {
    touch();
    if (auto) return stopAuto();
    if (mode) { draft = null; mode = null; }
    $('zrAuto').textContent = 'Pause';
    auto = setInterval(function () {
      if (mode || revealing) return stopAuto();
      var ev = step(); render();
      if (finished || ev) stopAuto();
    }, 450);
  }
  function stopAuto() { if (auto) clearInterval(auto); auto = null; if ($('zrAuto')) $('zrAuto').textContent = 'Auto-play'; }

  function syncRiskUi() {
    var full = isFull();
    $('zrRisk').classList.toggle('is-full', full);
    $('zrRiskWarn').hidden = !full;
    if (s && mode === 'confirm') confirmHint();
  }

  document.addEventListener('DOMContentLoaded', function () {
    ch = new ZC.Chart($('zrChart'));
    ch.hoverNote = function (p) {
      if (!s) return null;
      var px = s.c[cur];
      if (mode === 'stop' && draft) {
        var q = sizeFor(px, p);
        return isFull() ? 'stop here → risk ' + (q * Math.abs(px - p) / eq * 100).toFixed(1) + '% of account' : 'stop here → ' + q + ' shares';
      }
      if (mode === 'target' && draft && draft.stop != null) return (Math.abs(p - px) / Math.abs(px - draft.stop)).toFixed(1) + ':1 reward:risk';
      return null;
    };
    $('zrWait').addEventListener('click', function () { wait(); });
    $('zrAuto').addEventListener('click', toggleAuto);
    $('zrLong').addEventListener('click', function () { beginOrder(1); });
    $('zrShort').addEventListener('click', function () { beginOrder(-1); });
    $('zrClose').addEventListener('click', function () { if (pos && !revealing) { touch(); pos.exitNext = true; addLog('Bar ' + barNo() + ': exit queued for the next open'); step(); render(); } });
    $('zrSetTarget').addEventListener('click', function () { if (pos && !pos.target) { touch(); stopAuto(); mode = 'ptarget'; setHint('<b>Tap the chart</b> to set a target. You can drag it later.'); render(); } });
    $('zrConfirm').addEventListener('click', confirmOrder);
    $('zrCancel').addEventListener('click', cancel);
    $('zrNew').addEventListener('click', function () { newGame(); });
    $('zrRisk').addEventListener('change', function () { touch(); syncRiskUi(); });
    syncRiskUi();
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); wait(); }
      else if (e.key === 'l' || e.key === 'L') beginOrder(1);
      else if (e.key === 's' || e.key === 'S') beginOrder(-1);
      else if (e.key === 'Escape') cancel();
    });
    ['pointerdown', 'keydown'].forEach(function (evn) { document.addEventListener(evn, function () { if (hesitating) touch(); }); });
    var seed = new URLSearchParams(location.search).get('seed');
    newGame(seed || undefined);
  });
})();
