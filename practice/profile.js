/*!
 * Zelos Practice Account: public profile (practice/profile.html?u=<uid>).
 * Reads practiceProfiles/{uid}, the public summary the practice page publishes
 * for signed-in players who keep "Show my stats on the leaderboard" on.
 * Holds display name and trading numbers only, never email or login details.
 */
(function () {
  'use strict';
  var START = 10000;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(v) { return (v < 0 ? '-$' : '$') + Math.abs(+v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function signed(v) { return (v >= 0 ? '+' : '-') + money(Math.abs(v)); }
  function pct(v) { return (v >= 0 ? '+' : '') + (+v || 0).toFixed(2) + '%'; }
  function px(v) { return v == null ? '–' : (+v).toFixed(2); }
  function cls(v) { return v >= 0 ? 'up' : 'dn'; }
  function day(d) { if (!d) return '–'; try { return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return d; } }

  function show(p, uid, mine) {
    var eq = +p.equity || START, g = p.growthPct != null ? p.growthPct : (eq / START - 1) * 100;
    var best = (p.bestTrades || [])[0];
    var since = p.since ? new Date(p.since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;
    document.title = (p.name || 'Trader') + ' · Practice Account | Zelos';
    var h = '<div class="pf-head"><div><span class="pt-kicker">$10,000 Practice Account' + (mine ? ' &middot; your public profile' : '') + '</span>' +
      '<h1>' + esc(p.name || 'Trader') + '</h1>' + (since ? '<p class="pt-fine">Trading since ' + since + '</p>' : '') + '</div>' +
      '<div class="pf-bal"><small>Current balance</small><b>' + money(eq) + '</b><span class="' + cls(g) + '">' + pct(g) + ' from ' + money(p.start || START) + '</span></div></div>';
    h += '<div class="pt-perf pf-stats">' + [
      ['Starting balance', money(p.start || START)], ['Growth', '<span class="' + cls(g) + '">' + pct(g) + '</span>'],
      ['Peak balance', money(p.peakEquity || eq)], ['Resets', p.resets || 0],
      ['Closed trades', p.trades || 0], ['Wins / losses', (p.wins || 0) + ' / ' + (p.losses || 0)],
      ['Win rate', p.trades ? (p.winRate || 0) + '%' : '–'], ['Realized P&amp;L', '<span class="' + cls(p.realized || 0) + '">' + signed(p.realized || 0) + '</span>'],
      ['Avg win', p.wins ? '<span class="up">' + signed(p.avgWin || 0) + '</span>' : '–'], ['Avg loss', p.losses ? '<span class="dn">' + signed(p.avgLoss || 0) + '</span>' : '–']
    ].map(function (r) { return '<span><small>' + r[0] + '</small><b>' + r[1] + '</b></span>'; }).join('') + '</div>';
    if (best) {
      h += '<section class="pf-best"><span class="pf-best-tag">&#9733; Best trade</span><div class="pf-best-main"><b>' + esc(best.label || best.sym) + '</b>' +
        '<span class="up">' + signed(best.pnl) + ' <small>(' + pct(best.pct) + ')</small></span></div>' +
        '<div class="pf-best-row"><span>Invested <b>' + money(best.invested) + '</b></span><span>Entry <b>' + px(best.entry) + '</b></span><span>Exit <b>' + px(best.exit) + '</b></span>' +
        '<span>' + (best.openDay ? day(best.openDay) + ' &rarr; ' : 'Closed ') + day(best.closeDay) + '</span></div></section>';
    }
    h += '<div class="pf-cols"><section class="pt-card pf-card"><h2>Biggest winning trades</h2>' + ((p.bestTrades || []).length
      ? '<div class="pt-table-wrap"><table class="pt-table"><thead><tr><th>Ticker</th><th>Invested</th><th>Profit</th><th>Gain</th><th>Entry</th><th>Exit</th><th>Dates</th></tr></thead><tbody>' +
        p.bestTrades.map(function (t, i) {
          return '<tr' + (i === 0 ? ' class="pf-top"' : '') + '><td><b>' + esc(t.label || t.sym) + '</b></td><td>' + money(t.invested) + '</td><td class="up">' + signed(t.pnl) + '</td><td class="up">' + pct(t.pct) + '</td>' +
            '<td>' + px(t.entry) + '</td><td>' + px(t.exit) + '</td><td><small>' + (t.openDay ? day(t.openDay) + ' → ' : '') + day(t.closeDay) + '</small></td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<p class="pt-empty">No winning trades closed yet.</p>') + '</section>';
    h += '<section class="pt-card pf-card"><h2>Top stocks by realized profit</h2>' + ((p.topStocks || []).length
      ? '<ol class="pf-top-stocks">' + p.topStocks.map(function (s) { return '<li><b>' + esc(s.sym) + '</b><span class="up">' + signed(s.pnl) + '</span></li>'; }).join('') + '</ol>'
      : '<p class="pt-empty">Shows up once a stock closes in profit.</p>') +
      '<h2>Reset history</h2>' + ((p.resetHistory || []).length
      ? '<table class="pt-table"><tbody>' + p.resetHistory.slice().reverse().map(function (r, k) { return '<tr><td>#' + (p.resetHistory.length - k) + '</td><td>' + day(r.day) + '</td><td>Reset from ' + money(r.equityBefore) + '</td></tr>'; }).join('') + '</tbody></table>'
      : '<p class="pt-empty">Never reset. Still on the first $10,000.</p>') + '</section></div>';
    $('pfBody').innerHTML = h;
  }
  function missing(msg) { $('pfBody').innerHTML = '<div class="pf-missing"><h1>Profile not found</h1><p>' + msg + '</p><a class="pt-btn pt-btn-go" href="./">Open the practice account</a></div>'; }

  function start() {
    var uid = new URLSearchParams(location.search).get('u');
    var cfg = window.ZELOS_FIREBASE_CONFIG;
    if (!window.firebase || !cfg || !cfg.projectId) return missing('Profiles need the live site. Try again on agentictrading.info.');
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    var db = firebase.firestore();
    function load(id, mine) {
      db.collection('practiceProfiles').doc(id).get().then(function (d) {
        if (!d.exists) return missing(mine ? 'Your stats are private, or you haven\'t saved a trade since signing in. Turn on "Show my stats on the leaderboard" in the Performance tab.' : 'This player\'s stats are private, or the link is wrong.');
        show(d.data(), id, mine);
      }).catch(function () { missing('Couldn\'t load this profile right now. Refresh to try again.'); });
    }
    if (uid) { firebase.auth().onAuthStateChanged(function (u) { load(uid, !!(u && u.uid === uid)); }); return; }
    firebase.auth().onAuthStateChanged(function (u) { if (u && !u.isAnonymous) load(u.uid, true); else missing('Pick a player on the <a href="../leaderboard.html#practice">practice leaderboard</a>, or sign in to see your own profile.'); });
  }
  document.addEventListener('DOMContentLoaded', start);
})();
