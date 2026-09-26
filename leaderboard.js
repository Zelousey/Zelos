/*!
 * Zelos Arcade — shared live leaderboard module.
 *
 * Requires, loaded BEFORE this file:
 *   <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js"></script>
 *   <script src="firebase-config.js"></script>  (or "../firebase-config.js" from games/)
 *
 * Every score submitted here is a single push to /scores/{gameId} — a public
 * leaderboard entry, the same for every visitor, nothing tied to any Zelos alert
 * or account. Firebase's own security rules (see the setup instructions) are what
 * actually enforce "you can only add a new score, never edit or delete one."
 *
 * Exposes window.ZelosLeaderboard with:
 *   GAMES                          — { gameId: { label, isCurrency, group, href, emoji } }
 *                                    group is the leaderboard section it's listed under;
 *                                    href is the page (relative to the site root) a board
 *                                    row links back to
 *   isConfigured()                 — true once firebase-config.js has real values
 *   getName() / setName(v)         — the player's cached display name (localStorage)
 *   formatScore(gameId, score)     — "$1,234" for currency games, "1,234" otherwise
 *   submitScore(gameId, score, cb, ref) — cb(true|false). ref is optional: a short
 *                                    string that lets a board row link to the exact run
 *                                    (Chart Replay passes its chart seed). If the live
 *                                    database rules predate the ref field, the push is
 *                                    retried without it so the score still posts.
 *   entryHref(gameId, row, prefix) — link for one board row (the game, or that exact run)
 *   topScores(gameId, limit, cb)   — cb(rows), returns an unsubscribe function; rows
 *                                    stay live-updated (cb fires again on any change)
 *                                    until you call the returned unsubscribe function
 */
(function () {
  var GAMES = {
    'chart-replay': { label: 'Chart Replay', isCurrency: false, group: 'sim', href: 'games/chart-replay.html', emoji: '📈' },
    'grade-the-setup': { label: 'Grade the Setup', isCurrency: false, group: 'sim', href: 'games/grade-the-setup.html', emoji: '✅' },
    'stop-drill': { label: "Where's the Stop?", isCurrency: false, group: 'sim', href: 'games/stop-drill.html', emoji: '🛑' },
    'bull-run': { label: 'Bull Run', isCurrency: false, group: 'arcade', href: 'games/bull-run.html', emoji: '🐃' },
    'buy-the-dip': { label: 'Buy the Dip', isCurrency: true, group: 'arcade', href: 'games/buy-the-dip.html', emoji: '💵' },
    'setup-spotter': { label: 'Setup Spotter', isCurrency: false, group: 'arcade', href: 'games/setup-spotter.html', emoji: '🐂' }
  };
  // Daily Challenge boards are one per ET date: 'daily-2026-09-24' etc.
  function gameInfo(id) {
    if (GAMES[id]) return GAMES[id];
    if (/^daily-\d{4}-\d{2}-\d{2}$/.test(id)) return { label: 'Daily Challenge ' + id.slice(6), isCurrency: false, group: 'daily', href: 'games/daily-challenge.html', emoji: '📅' };
    return null;
  }
  function entryHref(gameId, row, prefix) {
    var g = gameInfo(gameId); if (!g) return null;
    var ref = row && typeof row.ref === 'string' && /^[\w.-]{1,64}$/.test(row.ref) ? row.ref : null;
    return (prefix || '') + g.href + (ref && gameId === 'chart-replay' ? '?seed=' + encodeURIComponent(ref) : '');
  }
  var NAME_KEY = 'zelosPlayerName';
  var initialized = false;
  var db = null;

  function ensureInit() {
    if (initialized) return db;
    initialized = true; // only try once per page load — don't retry on every call
    var cfg = window.ZELOS_FIREBASE_CONFIG;
    if (!cfg || !cfg.databaseURL || String(cfg.databaseURL).indexOf('PASTE_ME') !== -1) {
      return null; // firebase-config.js hasn't been filled in yet — quietly no-op
    }
    if (!window.firebase) return null; // SDK script tags missing/blocked
    try {
      if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(cfg);
      db = firebase.database();
    } catch (e) {
      db = null;
    }
    return db;
  }

  function getName() {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; }
  }
  function setName(v) {
    try { localStorage.setItem(NAME_KEY, v); } catch (e) {}
  }

  function sanitizeName(v) {
    v = (v || '').toString().trim().slice(0, 20);
    return v || 'Anon';
  }

  function formatScore(gameId, score) {
    var n = Math.round(score);
    var withCommas = n.toLocaleString('en-US');
    return (gameInfo(gameId) && gameInfo(gameId).isCurrency) ? ('$' + withCommas) : withCommas;
  }

  function submitScore(gameId, score, cb, ref) {
    var database = ensureInit();
    var n = Math.round(score);
    if (!database || !gameInfo(gameId) || !(n > 0)) { if (cb) cb(false); return; }
    var name = sanitizeName(getName());
    var entry = { name: name, score: n, ts: Date.now() };
    var push = function (e) { return database.ref('scores/' + gameId).push(e); };
    var withRef = ref != null && /^[\w.-]{1,64}$/.test(String(ref));
    if (withRef) entry.ref = String(ref);
    push(entry)
      .catch(function (err) {
        if (!withRef) throw err;
        delete entry.ref; // rules deployed before the ref field existed reject it — post the plain score
        return push(entry);
      })
      .then(function () { if (cb) cb(true); })
      .catch(function () { if (cb) cb(false); });
    // Small, once-per-day XP for playing — separate system (zelos-xp.js, Firestore),
    // entirely optional, and never blocks the leaderboard score submit above even
    // if it's not loaded on a given page or the visitor isn't signed in.
    if (window.ZelosXP) ZelosXP.award('arcade-play');
  }

  function topScores(gameId, limit, cb) {
    var database = ensureInit();
    if (!database || !gameInfo(gameId)) { cb([]); return function () {}; }
    var q = database.ref('scores/' + gameId).orderByChild('score').limitToLast(limit || 10);
    var handler = function (snap) {
      var rows = [];
      snap.forEach(function (child) { rows.push(child.val()); });
      rows.reverse(); // Firebase returns ascending; highest score first is what we want to show
      cb(rows);
    };
    q.on('value', handler);
    return function () { q.off('value', handler); };
  }

  window.ZelosLeaderboard = {
    GAMES: GAMES,
    gameInfo: gameInfo,
    isConfigured: function () { return !!ensureInit(); },
    getName: getName,
    setName: setName,
    formatScore: formatScore,
    entryHref: entryHref,
    submitScore: submitScore,
    topScores: topScores
  };
})();
