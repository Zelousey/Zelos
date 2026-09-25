/* Shared runner for the round-based drills (Grade the Setup, Where's the Stop, Daily Challenge). */
function zgRunDrill(cfg) {
  var host = document.getElementById('zgRound'), prog = document.getElementById('zgProgress');
  var scoreEl = document.getElementById('zgScore'), streakEl = document.getElementById('zgStreak');
  var results = [], total = 0, max = 0, rounds = cfg.rounds;
  prog.innerHTML = rounds.map(function () { return '<i></i>'; }).join('');
  function paint() {
    prog.querySelectorAll('i').forEach(function (d, k) { d.className = results[k] ? results[k].grade : (k === results.length ? 'now' : ''); });
    if (scoreEl) scoreEl.textContent = total + (cfg.showMax ? ' / ' + max : '');
  }
  function next() {
    paint();
    var k = results.length;
    if (k >= rounds.length) return finish();
    var kind = rounds[k];
    var meta = { no: 'Round ' + (k + 1) + ' of ' + rounds.length, label: kind === 'grade' ? 'Grade the setup' : 'Where\'s the stop?', nextLabel: k === rounds.length - 1 ? 'See results &rarr;' : 'Next round &rarr;' };
    host._locked = false;
    (kind === 'grade' ? ZC.gradeRound : ZC.stopRound)(host, cfg.data, cfg.rand, meta, function (res) {
      results.push(res);
      total += cfg.normalize ? Math.round(res.points / res.max * 100) : res.points;
      max += cfg.normalize ? 100 : res.max;
      window.scrollTo({ top: document.getElementById('zgTop').offsetTop - 10, behavior: 'smooth' });
      next();
    });
  }
  function finish() {
    paint();
    var grid = results.map(function (r) { return r.grade === 'g' ? '🟩' : r.grade === 'y' ? '🟨' : '🟥'; }).join('');
    cfg.onFinish({ total: total, max: max, grid: grid, results: results, host: host });
  }
  next();
}
function zgLeaderboard(host, gameId, score, label) {
  var LB = window.ZelosLeaderboard;
  var box = ZC.el('div', 'zg-lb');
  host.appendChild(box);
  if (!LB || !LB.isConfigured()) { box.innerHTML = '<p class="zg-fine">Leaderboard offline right now.</p>'; return; }
  var form = ZC.el('div', 'zg-lb-form', '<input id="zgName" maxlength="20" placeholder="Your name" aria-label="Your name"><button class="zg-btn zg-btn-primary" id="zgSubmit" type="button">Post score</button>');
  box.appendChild(form);
  var list = ZC.el('div', '', '<b>Top scores' + (label ? ' · ' + label : '') + '</b><ol id="zgTop5"><li>Loading…</li></ol>');
  box.appendChild(list);
  var inp = form.querySelector('input'); inp.value = LB.getName() || '';
  form.querySelector('button').addEventListener('click', function () {
    LB.setName(inp.value || 'Anon');
    this.disabled = true; var b = this;
    LB.submitScore(gameId, score, function (ok) { b.textContent = ok ? 'Posted ✓' : 'Couldn\'t post'; });
  });
  LB.topScores(gameId, 5, function (rows) {
    var ol = document.getElementById('zgTop5'); if (!ol) return;
    ol.innerHTML = rows && rows.length ? rows.map(function (r) { return '<li>' + String(r.name).replace(/[<>&]/g, '') + ' · ' + LB.formatScore(gameId, r.score) + '</li>'; }).join('') : '<li>No scores yet. Be first.</li>';
  });
}
