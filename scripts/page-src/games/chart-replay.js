(function () {
  var START_EQ = 10000, PLAY = 60, HIST = 100;
  var $ = function (id) { return document.getElementById(id); };
  var ch, s, cur, end, startIdx, eq, pos, pending, mode, trades, log, peak, maxDD, widen, lowRR, auto, rand, gameSeed, finished;

  function setHint(h) { $('zrHint').innerHTML = h; }
  function addLog(t) { log.unshift(t); $('zrLog').innerHTML = log.slice(0, 30).map(function (x) { return '<div>' + x + '</div>'; }).join(''); }
  function barNo() { return cur - startIdx + 1; }
  function riskPct() { return parseFloat($('zrRisk').value) / 100; }
  function mtm() {
    if (!pos) return eq;
    return eq + pos.side * (s.c[cur] - pos.entry) * pos.qty;
  }

  function newGame(seed) {
    ZC.load().then(function (data) {
      gameSeed = seed || String(Date.now());
      rand = ZC.rng(gameSeed);
      var pick = ZC.pickReplay(data, rand, PLAY, HIST + 60);
      s = pick.s; startIdx = pick.start; cur = startIdx; end = startIdx + PLAY - 1;
      eq = START_EQ; pos = null; pending = null; mode = null; trades = []; log = []; peak = START_EQ; maxDD = 0; widen = 0; lowRR = 0; finished = false;
      stopAuto();
      $('zrEnd').hidden = true; $('zrPlay').hidden = false;
      $('zrLog').innerHTML = '';
      ch.lines = []; ch.marks = []; ch.zones = []; ch.pickLine = null; ch.onPick = onPick;
      document.getElementById('zrChart').classList.add('zg-pickable');
      render();
      setHint('Real daily chart, ticker hidden. You have <b>' + PLAY + ' bars</b> to trade a $10,000 practice account. Every trade needs a stop before it can be placed. Press <b>Next bar</b> (or →) to begin.');
    }).catch(function () { setHint('Couldn\'t load chart data. Refresh to try again.'); });
  }

  function render() {
    ch.lines = [];
    if (pos) {
      ch.lines.push({ price: pos.entry, color: '#d8dde6', label: pos.side > 0 ? 'LONG' : 'SHORT', dash: [4, 3] });
      ch.lines.push({ price: pos.stop, color: ZC.cssVar('--danger', '#e0483f'), label: 'STOP' });
      if (pos.target) ch.lines.push({ price: pos.target, color: ZC.cssVar('--bull', '#3ecb7c'), label: 'TARGET' });
    } else if (pending) {
      if (pending.stop != null) ch.lines.push({ price: pending.stop, color: ZC.cssVar('--danger', '#e0483f'), label: 'STOP' });
      if (pending.target != null) ch.lines.push({ price: pending.target, color: ZC.cssVar('--bull', '#3ecb7c'), label: 'TARGET' });
    }
    var span = (document.getElementById('zrChart').clientWidth < 600) ? 60 : HIST;
    ch.set(s, Math.max(0, cur - span + 1), cur);
    var m = mtm(), ret = (m / START_EQ - 1) * 100;
    $('zrEq').textContent = ZC.money(m);
    $('zrRet').textContent = (ret >= 0 ? '+' : '') + ret.toFixed(2) + '%';
    $('zrRet').className = ret >= 0 ? 'up' : 'dn';
    $('zrBar').textContent = Math.min(PLAY, barNo()) + ' / ' + PLAY;
    var rs = trades.reduce(function (a, t) { return a + t.r; }, 0);
    $('zrR').textContent = (rs >= 0 ? '+' : '') + rs.toFixed(1) + 'R';
    $('zrR').className = rs >= 0 ? 'up' : 'dn';
    $('zrLong').disabled = !!pos || finished; $('zrShort').disabled = !!pos || finished;
    $('zrClose').disabled = !pos || finished; $('zrMove').disabled = !pos || finished;
    $('zrNext').disabled = finished || (mode && mode !== 'confirm');
    $('zrCancel').hidden = !mode;
    $('zrConfirm').hidden = mode !== 'confirm' && mode !== 'target';
    $('zrConfirm').textContent = mode === 'target' ? 'Skip target' : 'Place order';
  }

  function beginOrder(side) {
    if (pos || finished) return;
    stopAuto();
    pending = { side: side, stop: null, target: null };
    mode = 'stop';
    setHint('<b>Tap the chart to set your stop</b> ' + (side > 0 ? 'below' : 'above') + ' the current price (' + ZC.fmt(s.c[cur]) + '). Position size is set so hitting it costs ' + (riskPct() * 100) + '% of the account.');
    render();
  }
  function onPick(p) {
    var px = s.c[cur];
    if (mode === 'stop') {
      if (pending.side * (px - p) <= 0) { setHint('That\'s on the wrong side. A ' + (pending.side > 0 ? 'long' : 'short') + ' stop goes ' + (pending.side > 0 ? 'below' : 'above') + ' ' + ZC.fmt(px) + '.'); return; }
      pending.stop = p; mode = 'target';
      setHint('Stop set at <b>' + ZC.fmt(p) + '</b>. Now <b>tap a target</b>, or skip it and manage the exit yourself.');
    } else if (mode === 'target') {
      if (pending.side * (p - px) <= 0) { setHint('A target goes ' + (pending.side > 0 ? 'above' : 'below') + ' the current price.'); return; }
      pending.target = p; mode = 'confirm';
      var rr = Math.abs(p - px) / Math.abs(px - pending.stop);
      setHint('Planned reward:risk <b>' + rr.toFixed(1) + ':1</b>' + (rr < 1.5 ? ' (thin; the checklist wants 2:1).' : '.') + ' The order fills at the next bar\'s open. Press <b>Place order</b>.');
    } else if (mode === 'move' && pos) {
      if (pos.side * (s.c[cur] - p) <= 0) { setHint('That would put the stop through the current price.'); return; }
      var wider = pos.side > 0 ? p < pos.stop : p > pos.stop;
      if (wider) { widen++; addLog('Bar ' + barNo() + ': stop moved further away (discipline −15)'); }
      else addLog('Bar ' + barNo() + ': stop tightened to ' + ZC.fmt(p));
      pos.stop = p; mode = null; setHint('Stop moved to <b>' + ZC.fmt(p) + '</b>.');
    }
    render();
  }
  function confirmOrder() {
    if (mode === 'target') { mode = 'confirm'; }
    if (mode !== 'confirm') return;
    pending.queued = true; mode = null;
    setHint('Order queued: ' + (pending.side > 0 ? 'buy' : 'short') + ' at the next open with stop ' + ZC.fmt(pending.stop) + (pending.target ? ', target ' + ZC.fmt(pending.target) : '') + '. Press <b>Next bar</b>.');
    render();
  }
  function cancel() { if (mode === 'move') mode = null; else { pending = null; mode = null; } setHint('Cancelled.'); render(); }

  function closePos(price, why) {
    var pnl = pos.side * (price - pos.entry) * pos.qty;
    var r = pnl / pos.risk;
    eq += pnl;
    trades.push({ r: r, pnl: pnl });
    ch.marks.push({ i: cur, price: price, type: pos.side > 0 ? 'sell' : 'buy', color: '#d8dde6' });
    addLog('Bar ' + barNo() + ': ' + why + ' at ' + ZC.fmt(price) + ' · ' + (pnl >= 0 ? '+' : '') + ZC.money(pnl) + ' (' + (r >= 0 ? '+' : '') + r.toFixed(2) + 'R)');
    setHint(why + ' at ' + ZC.fmt(price) + ': <b>' + (r >= 0 ? '+' : '') + r.toFixed(2) + 'R</b> (' + (pnl >= 0 ? '+' : '') + ZC.money(pnl) + '). Flat now; look for the next setup.');
    pos = null;
  }

  function step() {
    if (finished || (mode && mode !== 'confirm')) return;
    if (mode === 'confirm') confirmOrder();
    if (cur >= end) return finish();
    cur++;
    var o = s.o[cur], h = s.h[cur], l = s.l[cur];
    if (pos && pos.exitNext) { closePos(o, 'Closed at the open'); }
    if (pending && pending.queued) {
      var riskPer = Math.abs(o - pending.stop);
      if (pending.side * (o - pending.stop) <= 0) { addLog('Bar ' + barNo() + ': order cancelled, price opened through your stop'); pending = null; }
      else {
        var qty = Math.floor(riskPct() * eq / riskPer);
        if (qty < 1) { addLog('Bar ' + barNo() + ': stop too wide to size even 1 share'); pending = null; }
        else {
          pos = { side: pending.side, entry: o, stop: pending.stop, target: pending.target, qty: qty, risk: qty * riskPer };
          if (pending.target && Math.abs(pending.target - o) / riskPer < 1.5) lowRR++;
          ch.marks.push({ i: cur, price: o, type: pos.side > 0 ? 'buy' : 'sell' });
          addLog('Bar ' + barNo() + ': ' + (pos.side > 0 ? 'bought ' : 'shorted ') + qty + ' @ ' + ZC.fmt(o) + ' · risking ' + ZC.money(pos.risk));
          setHint('Filled: ' + (pos.side > 0 ? 'long ' : 'short ') + qty + ' shares at ' + ZC.fmt(o) + ', risking ' + ZC.money(pos.risk) + '. Let the stop' + (pos.target ? ' and target' : '') + ' do the work, or use <b>Move stop</b> / <b>Close</b>.');
          pending = null;
        }
      }
    }
    if (pos) {
      var sd = pos.side;
      if (sd * (o - pos.stop) <= 0) closePos(o, 'Gapped through the stop');
      else if (sd > 0 ? l <= pos.stop : h >= pos.stop) closePos(pos.stop, 'Stopped out');
      else if (pos.target && (sd > 0 ? h >= pos.target : l <= pos.target)) closePos(sd * (o - pos.target) >= 0 ? o : pos.target, 'Target hit');
    }
    var m = mtm(); peak = Math.max(peak, m); maxDD = Math.max(maxDD, (peak - m) / peak);
    if (cur >= end) { render(); return finish(); }
    render();
  }

  function finish() {
    if (finished) return;
    stopAuto();
    if (pos) closePos(s.c[cur], 'Closed at the final bar');
    finished = true; pending = null; mode = null;
    var n = trades.length, wins = trades.filter(function (t) { return t.r > 0; }).length;
    var totR = trades.reduce(function (a, t) { return a + t.r; }, 0);
    var disc = Math.max(0, 100 - 15 * widen - 10 * lowRR - (n > 8 ? 20 : 0));
    var bh = (s.c[end] / s.o[startIdx] - 1) * 100;
    var ret = (eq / START_EQ - 1) * 100;
    var score = Math.max(0, Math.round((1000 + totR * 200) * disc / 100));
    if (n === 0) score = 0;
    render();
    ch.onPick = null;
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
      '<p class="zg-fine">Discipline loses 15 for each time a stop was moved further away, 10 for each trade planned under 1.5:1, and 20 for more than 8 trades.</p>' +
      '<div class="zg-actions"><button class="zg-btn zg-btn-primary" id="zrAgain" type="button">New chart</button><button class="zg-btn" id="zrShare" type="button">Share result</button></div>';
    $('zrAgain').addEventListener('click', function () { newGame(); });
    $('zrShare').addEventListener('click', function () {
      var b = this;
      ZC.share('Zelos Chart Replay: ' + score.toLocaleString() + ' pts on a hidden ' + ZC.monthYear(s.d[startIdx]) + ' chart. ' + (totR >= 0 ? '+' : '') + totR.toFixed(1) + 'R, ' + disc + '% discipline. Can you beat it?', 'https://agentictrading.info/games/chart-replay.html?seed=' + encodeURIComponent(gameSeed))
        .then(function () { b.textContent = 'Copied ✓'; });
    });
    if (n > 0 && window.zgLeaderboard) zgLeaderboard($('zrEnd'), 'chart-replay', score, 'Chart Replay');
  }
  function card(k, v, good) { return '<div class="zg-stat"><small>' + k + '</small><b class="' + (good === true ? 'up' : good === false ? 'dn' : '') + '">' + v + '</b></div>'; }

  function toggleAuto() {
    if (auto) return stopAuto();
    $('zrAuto').textContent = 'Pause'; auto = setInterval(function () { if (mode && mode !== 'confirm') return stopAuto(); step(); if (finished) stopAuto(); }, 450);
  }
  function stopAuto() { if (auto) clearInterval(auto); auto = null; if ($('zrAuto')) $('zrAuto').textContent = 'Auto-play'; }

  document.addEventListener('DOMContentLoaded', function () {
    ch = new ZC.Chart($('zrChart'));
    ch.hoverNote = function (p) {
      if (mode === 'stop' && pending) { var q = Math.floor(riskPct() * eq / Math.abs(s.c[cur] - p)); return 'stop here → ' + q + ' shares'; }
      if (mode === 'target' && pending && pending.stop != null) return (Math.abs(p - s.c[cur]) / Math.abs(s.c[cur] - pending.stop)).toFixed(1) + ':1 reward:risk';
      return null;
    };
    $('zrNext').addEventListener('click', step);
    $('zrAuto').addEventListener('click', toggleAuto);
    $('zrLong').addEventListener('click', function () { beginOrder(1); });
    $('zrShort').addEventListener('click', function () { beginOrder(-1); });
    $('zrClose').addEventListener('click', function () { if (pos) { pos.exitNext = true; addLog('Bar ' + barNo() + ': exit queued for the next open'); step(); } });
    $('zrMove').addEventListener('click', function () { if (pos) { stopAuto(); mode = 'move'; setHint('<b>Tap the chart</b> to move your stop. Tightening is fine; widening it costs discipline points.'); render(); } });
    $('zrConfirm').addEventListener('click', confirmOrder);
    $('zrCancel').addEventListener('click', cancel);
    $('zrNew').addEventListener('click', function () { newGame(); });
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); step(); }
      else if (e.key === 'l' || e.key === 'L') beginOrder(1);
      else if (e.key === 's' || e.key === 'S') beginOrder(-1);
      else if (e.key === 'Escape') cancel();
    });
    var seed = new URLSearchParams(location.search).get('seed');
    newGame(seed || undefined);
  });
})();
