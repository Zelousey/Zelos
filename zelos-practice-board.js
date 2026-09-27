/*!
 * Zelos — Practice Account leaderboards (leaderboard.html#practice).
 *
 *   All-time   by current balance
 *   Weekly     % growth this week   (practiceProfiles.p.<weekKey>.pct)
 *   Monthly    % growth this month  (p.<monthKey>.pct)
 *   Season     one of six categories (p.<seasonId>.<metric>)
 *   Friends    you + the people you follow + your squad mates
 *
 * Period numbers are net P&L since the period started, published by each
 * player's practice page (practice/practice.js → periodStats), so resets
 * never count as growth. Single-field orderBy only: Firestore indexes every
 * map subfield automatically, so no composite indexes are needed.
 */
(function (global) {
  'use strict';
  var P = global.ZelosProgress, L = global.ZelosLevels;
  var CATS = [
    ['pct', 'Best % return', function (v) { return pct(v); }],
    ['pnl', 'Biggest account growth', function (v) { return signedMoney(v); }],
    ['bestWin', 'Biggest single win', function (v) { return signedMoney(v); }],
    ['xp', 'Most XP', function (v) { return Math.round(v || 0).toLocaleString('en-US') + ' XP'; }],
    ['winStreak', 'Longest winning streak', function (v) { return (v || 0) + ' wins'; }],
    ['topStockPnl', 'Most profitable stock', function (v) { return signedMoney(v); }]
  ];
  var state = { tab: 'all', cat: 'pct' }, unsub = null, el = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(v) { return '$' + Math.round(+v || 0).toLocaleString('en-US'); }
  function signedMoney(v) { return (v >= 0 ? '+' : '-') + money(Math.abs(v)); }
  function pct(v) { return (v >= 0 ? '+' : '') + (+v || 0).toFixed(1) + '%'; }
  function db() { return firebase.firestore(); }

  function head() {
    var se = P && P.season();
    var tabs = [['all', 'All-time'], ['week', 'Weekly'], ['month', 'Monthly']].concat(se ? [['season', se.name]] : []).concat([['friends', 'Friends']]);
    var h = '<div class="pb-tabs">' + tabs.map(function (t) { return '<button type="button" data-pt="' + t[0] + '" class="' + (state.tab === t[0] ? 'is-on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (state.tab === 'season' && se) h += '<div class="pb-season"><b>' + esc(se.name) + ' · ' + esc(se.title) + '</b> <span>' + se.start + ' → ' + se.end + '</span></div><div class="pb-cats">' +
      CATS.map(function (c) { return '<button type="button" data-cat="' + c[0] + '" class="' + (state.cat === c[0] ? 'is-on' : '') + '">' + c[1] + '</button>'; }).join('') + '</div>';
    return h;
  }
  function row(r, i, main, sub, meUid) {
    var lv = L ? L.levelForXp(r.xp || 0) : null;
    return '<a class="board-row pb-row' + (r.uid === meUid ? ' is-me' : '') + '" href="practice/profile.html?u=' + encodeURIComponent(r.uid) + '"><span class="board-rank">' + (i + 1) + '</span>' +
      '<span class="board-name">' + (lv && L ? L.badge(lv, 20) + ' ' : '') + esc(r.name || 'Trader') + '</span>' +
      '<span class="board-sub">' + sub + '</span><span class="board-score">' + main + '</span><span class="board-go">Stats &rarr;</span></a>';
  }
  function stdSub(r, extra) {
    var g = +r.growthPct || 0;
    return (extra || '') + '<span class="' + (g >= 0 ? 'up' : 'dn') + '">' + pct(g) + '</span>' +
      '<span class="board-xp">Lv ' + (L ? L.levelForXp(r.xp || 0).level : 0) + ' · ' + Math.round(r.xp || 0).toLocaleString('en-US') + ' XP</span>' +
      (r.streak ? '<span class="board-streak">🔥' + r.streak + '</span>' : '') +
      '<span class="board-resets">' + (r.resets || 0) + ' reset' + (r.resets === 1 ? '' : 's') + '</span><span class="board-trades">' + (r.trades || 0) + ' trades · ' + (r.trades ? (r.winRate || 0) + '% win' : '–') + '</span>';
  }
  function paint(rows, main, sub, note) {
    var meU = global.firebase && firebase.auth().currentUser;
    var meUid = meU && !meU.isAnonymous ? meU.uid : null;
    el.board.innerHTML = head() + (note ? '<p class="pb-note">' + note + '</p>' : '') +
      (rows.length ? rows.map(function (r, i) { return row(r, i, main(r), sub(r), meUid); }).join('') : '<div class="board-empty">' + emptyText() + '</div>');
  }
  function emptyText() {
    if (state.tab === 'friends') return 'Add friends from their profile pages, accept a challenge or join a squad, and they show up here.';
    if (state.tab === 'all') return 'No practice accounts yet. Sign in on the practice page and place a trade to show up here.';
    return 'Nobody has traded this period yet. Be the first on the board.';
  }
  function query(field, main, sub, note) {
    if (unsub) { unsub(); unsub = null; }
    el.board.innerHTML = head() + '<div class="board-empty">Loading…</div>';
    unsub = db().collection('practiceProfiles').orderBy(field, 'desc').limit(50).onSnapshot(function (snap) {
      var rows = []; snap.forEach(function (d) { var r = d.data(); r.uid = d.id; rows.push(r); });
      paint(rows, main, sub, note);
    }, function () { el.board.innerHTML = head() + '<div class="board-empty">The practice leaderboard isn\'t reachable right now.</div>'; });
  }
  function load() {
    var keys = P ? P.periodKeys() : { w: null, m: null, s: null };
    var t = state.tab;
    if (t === 'all') return query('equity', function (r) { return money(r.equity); }, function (r) { return stdSub(r); });
    if (t === 'week' || t === 'month') {
      var k = t === 'week' ? keys.w : keys.m;
      return query('p.' + k + '.pct', function (r) { return pct(r.p[k].pct); }, function (r) { return stdSub(r, '<span class="pb-per ' + (r.p[k].pnl >= 0 ? 'up' : 'dn') + '">' + signedMoney(r.p[k].pnl) + ' ' + (t === 'week' ? 'this week' : 'this month') + '</span>'); },
        'Growth ' + (t === 'week' ? 'this week (Monday to Sunday, Eastern)' : 'this month') + ', counted from each player\'s first visit in the period. Resets don\'t count.');
    }
    if (t === 'season' && keys.s) {
      var cat = CATS.filter(function (c) { return c[0] === state.cat; })[0];
      return query('p.' + keys.s + '.' + cat[0], function (r) { return cat[2](r.p[keys.s][cat[0]]); }, function (r) {
        var s = r.p[keys.s];
        return (cat[0] === 'topStockPnl' && s.topStock ? '<span class="pb-per">' + esc(s.topStock) + '</span>' : '') + stdSub(r);
      }, 'Everyone starts ' + P.season().name + ' fresh; your permanent account and all-time records carry on.');
    }
    if (t === 'friends') return friends();
  }
  function friends() {
    if (unsub) { unsub(); unsub = null; }
    var S = global.ZelosSocial, u = global.firebase && firebase.auth().currentUser;
    if (!S || !S.init() || !u || u.isAnonymous) { el.board.innerHTML = head() + '<div class="board-empty">Sign in on the <a href="practice/">practice page</a> to see your friends leaderboard.</div>'; return; }
    el.board.innerHTML = head() + '<div class="board-empty">Loading…</div>';
    Promise.all([S.friends(), S.mySquads(u.uid)]).then(function (r) {
      var ids = [u.uid].concat(r[0]); r[1].forEach(function (sq) { ids = ids.concat(sq.members); });
      return S.profiles(ids);
    }).then(function (m) {
      var rows = Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return (b.growthPct || 0) - (a.growthPct || 0); });
      if (state.tab !== 'friends') return;
      paint(rows.length > 1 ? rows : [], function (r) { return money(r.equity); }, function (r) { return stdSub(r); }, 'You, the traders you follow and your squad mates, ranked by growth.');
    }).catch(function () { el.board.innerHTML = head() + '<div class="board-empty">Couldn\'t load your friends right now.</div>'; });
  }
  function mount(opts) {
    el = opts;
    var cfg = global.ZELOS_FIREBASE_CONFIG;
    if (!global.firebase || !cfg || !cfg.projectId) { el.board.innerHTML = '<div class="board-empty">The practice leaderboard needs the live site.</div>'; return function () {}; }
    try { if (!firebase.apps.length) firebase.initializeApp(cfg); } catch (e) {}
    try { var h = (location.hash || '').split(':')[1]; if (h) state.tab = h; } catch (e) {}
    el.board.onclick = function (e) {
      var b = e.target.closest('[data-pt],[data-cat]'); if (!b) return;
      e.preventDefault();
      if (b.hasAttribute('data-pt')) state.tab = b.getAttribute('data-pt'); else state.cat = b.getAttribute('data-cat');
      try { history.replaceState(null, '', '#practice' + (state.tab === 'all' ? '' : ':' + state.tab)); } catch (er) {}
      load();
    };
    firebase.auth().onAuthStateChanged(function () { if (state.tab === 'friends') load(); });
    load();
    return function () { if (unsub) unsub(); unsub = null; el.board.onclick = null; };
  }
  global.ZelosPracticeBoard = { mount: mount, CATEGORIES: CATS };
})(window);
