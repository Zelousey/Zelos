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
    var L = window.ZelosLevels, lv = L ? L.levelForXp(p.xp || 0) : null, P = window.ZelosProgress, S = window.ZelosSocial;
    var tier = S && p.referrals ? S.referralTier(p.referrals) : null;
    var h = '<div class="pf-head"><div class="pf-id">' + (L && lv ? '<span class="pf-badge">' + L.badge(lv, 64) + '</span>' : '') + '<div><span class="pt-kicker">$10,000 Practice Account' + (mine ? ' &middot; your public profile' : '') + '</span>' +
      '<h1>' + esc(p.name || 'Trader') + '</h1>' +
      '<div class="pf-tags">' + (lv ? '<span><b>Lv ' + lv.level + '</b> ' + esc(lv.name) + '</span><span>' + (p.xp || 0).toLocaleString('en-US') + ' XP</span>' : '') +
      (p.streak ? '<span>🔥 ' + p.streak + '-day streak</span>' : '') + (tier ? '<span>' + tier.icon + ' ' + tier.name + ' recruiter</span>' : '') +
      (since ? '<span>Since ' + since + '</span>' : '') + '</div>' +
      '<div class="pf-actions" id="pfActions"></div></div></div>' +
      '<div class="pf-bal"><small>Current balance</small><b>' + money(eq) + '</b><span class="' + cls(g) + '">' + pct(g) + ' from ' + money(p.start || START) + '</span></div></div>';
    h += '<div class="pt-perf pf-stats">' + [
      ['Starting balance', money(p.start || START)], ['Growth', '<span class="' + cls(g) + '">' + pct(g) + '</span>'],
      ['Net P&amp;L <small title="Growth actually traded: resets never count as gains">excl. resets</small>', p.netPnl != null ? '<span class="' + cls(p.netPnl) + '">' + signed(p.netPnl) + '</span>' : '–'],
      ['XP', (p.xp || 0).toLocaleString('en-US')], ['Level', lv ? lv.level + ' · ' + esc(lv.name) : '–'], ['Streak', p.streak ? p.streak + ' days' : '–'],
      ['Best win streak', p.winStreakBest || 0],
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
    if (P) {
      var got = p.achievements || [];
      h += '<section class="pt-card pf-card pf-achs-card"><h2>Achievements <small>' + got.length + ' of ' + P.ACHIEVEMENTS.length + '</small></h2><div class="pf-achs">' +
        (got.length ? got.map(function (id) { var a = P.achievement(id); return a ? '<span class="pf-ach">' + P.badge(id, 38) + '<span><b>' + esc(a.label) + '</b><small>' + esc(a.desc) + '</small></span></span>' : ''; }).join('')
          : '<p class="pt-empty">No achievements yet.</p>') + '</div></section>';
    }
    h += '<div class="pf-cols"><section class="pt-card pf-card"><h2>Biggest winning trades</h2>' + ((p.bestTrades || []).length
      ? '<div class="pt-table-wrap"><table class="pt-table"><thead><tr><th>Ticker</th><th>Invested</th><th>Profit</th><th>Gain</th><th>Entry</th><th>Exit</th><th>Dates</th></tr></thead><tbody>' +
        p.bestTrades.map(function (t, i) {
          return '<tr' + (i === 0 ? ' class="pf-top"' : '') + '><td><b>' + esc(t.label || t.sym) + '</b></td><td>' + money(t.invested) + '</td><td class="up">' + signed(t.pnl) + '</td><td class="up">' + pct(t.pct) + '</td>' +
            '<td>' + px(t.entry) + '</td><td>' + px(t.exit) + '</td><td><small>' + (t.openDay ? day(t.openDay) + ' → ' : '') + day(t.closeDay) + '</small></td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<p class="pt-empty">No winning trades closed yet.</p>') + '</section>';
    h += '<section class="pt-card pf-card"><h2>Most traded</h2>' + ((p.mostTraded || []).length
      ? '<ol class="pf-top-stocks">' + p.mostTraded.map(function (s) { return '<li><b>' + esc(s.sym) + '</b> <small>' + s.trades + ' trade' + (s.trades === 1 ? '' : 's') + '</small><span class="' + cls(s.pnl) + '">' + signed(s.pnl) + '</span></li>'; }).join('') + '</ol>'
      : '<p class="pt-empty">No closed trades yet.</p>') +
      '<h2>Top stocks by realized profit</h2>' + ((p.topStocks || []).length
      ? '<ol class="pf-top-stocks">' + p.topStocks.map(function (s) { return '<li><b>' + esc(s.sym) + '</b><span class="up">' + signed(s.pnl) + '</span></li>'; }).join('') + '</ol>'
      : '<p class="pt-empty">Shows up once a stock closes in profit.</p>') +
      '<h2>Reset history</h2>' + ((p.resetHistory || []).length
      ? '<table class="pt-table"><tbody>' + p.resetHistory.slice().reverse().map(function (r, k) { return '<tr><td>#' + (p.resetHistory.length - k) + '</td><td>' + day(r.day) + '</td><td>Reset from ' + money(r.equityBefore) + '</td></tr>'; }).join('') + '</tbody></table>'
      : '<p class="pt-empty">Never reset. Still on the first $10,000.</p>') + '</section></div>';
    $('pfBody').innerHTML = h;
    actions(p, uid, mine);
  }
  // Share profile · Challenge this trader · Add friend (social actions need a signed-in account)
  function actions(p, uid, mine) {
    var S = window.ZelosSocial, box = $('pfActions'); if (!S || !box) return;
    var link = S.links(uid).profile(uid), meUser = S.me();
    var h = '<button class="pt-mini pt-soc" type="button" data-a="share">Share profile</button>';
    if (!mine) h += '<button class="pt-mini pt-soc" type="button" data-a="challenge">⚔️ Challenge this trader</button><button class="pt-mini" type="button" data-a="friend">+ Add friend</button>';
    else h += '<button class="pt-mini pt-soc" type="button" data-a="card">Share my account card</button><a class="pt-mini" href="squads.html">Trading Squads</a>';
    box.innerHTML = h;
    if (meUser && !mine) S.friends().then(function (f) { var b = box.querySelector('[data-a="friend"]'); if (b && f.indexOf(uid) !== -1) { b.textContent = '✓ Friends'; b.setAttribute('data-a', 'unfriend'); } });
    box.onclick = function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return;
      var a = b.getAttribute('data-a'), u = S.me();
      if (a === 'share') return S.shareLink((p.name || 'Trader') + ' · Practice Account', (p.name || 'This trader') + ' grew a $10,000 practice account to ' + money(p.equity) + '. Can you beat that?', link + (u ? '&ref=' + encodeURIComponent(u.uid) : '')).then(function (r) { if (r === 'copied') b.textContent = 'Link copied ✓'; });
      if (a === 'card') return S.shareCard({ name: p.name, equity: p.equity, level: window.ZelosLevels ? 'Lv ' + ZelosLevels.levelForXp(p.xp || 0).level : null, xp: p.xp, winRate: p.trades ? p.winRate : null,
        best: (p.bestTrades || [])[0] ? '+$' + Math.round(p.bestTrades[0].pnl).toLocaleString('en-US') + ' ' + p.bestTrades[0].sym : null }, link + '&ref=' + encodeURIComponent(uid)).then(function (r) { if (r === 'downloaded') b.textContent = 'Saved · link copied ✓'; });
      if (!u) { b.textContent = 'Sign in on the practice page first'; return; }
      if (a === 'friend') S.addFriend(uid).then(function () { b.textContent = '✓ Friends'; b.setAttribute('data-a', 'unfriend'); });
      if (a === 'unfriend') S.removeFriend(uid).then(function () { b.textContent = '+ Add friend'; b.setAttribute('data-a', 'friend'); });
      if (a === 'challenge') {
        b.disabled = true; b.textContent = 'Creating…';
        S.createChallenge({ days: 7, target: uid, targetName: p.name || 'Trader' }).then(function (id) { location.href = 'challenge.html?c=' + encodeURIComponent(id); })
          .catch(function (err) { b.disabled = false; b.textContent = '⚔️ Challenge this trader'; alert(err.message || err); });
      }
    };
  }
  function missing(msg) { $('pfBody').innerHTML = '<div class="pf-missing"><h1>Profile not found</h1><p>' + msg + '</p><a class="pt-btn pt-btn-go" href="./">Open the practice account</a></div>'; }

  function start() {
    var uid = new URLSearchParams(location.search).get('u');
    var cfg = window.ZELOS_FIREBASE_CONFIG;
    if (!window.firebase || !cfg || !cfg.projectId) return missing('Profiles need the live site. Try again on agentictrading.info.');
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    var db = firebase.firestore();
    if (window.ZelosSocial) ZelosSocial.init();
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
