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
 *   GAMES                          — { gameId: { label, isCurrency } }
 *   isConfigured()                 — true once firebase-config.js has real values
 *   getName() / setName(v)         — the player's cached display name (localStorage)
 *   formatScore(gameId, score)     — "$1,234" for currency games, "1,234" otherwise
 *   submitScore(gameId, score, cb) — cb(true|false)
 *   topScores(gameId, limit, cb)   — cb(rows), returns an unsubscribe function; rows
 *                                    stay live-updated (cb fires again on any change)
 *                                    until you call the returned unsubscribe function
 */
(function () {
  var GAMES = {
    'bull-run': { label: 'Bull Run', isCurrency: false },
    'buy-the-dip': { label: 'Buy the Dip', isCurrency: true },
    'setup-spotter': { label: 'Setup Spotter', isCurrency: false }
  };
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
    return (GAMES[gameId] && GAMES[gameId].isCurrency) ? ('$' + withCommas) : withCommas;
  }

  function submitScore(gameId, score, cb) {
    var database = ensureInit();
    var n = Math.round(score);
    if (!database || !GAMES[gameId] || !(n > 0)) { if (cb) cb(false); return; }
    var name = sanitizeName(getName());
    database.ref('scores/' + gameId).push({ name: name, score: n, ts: Date.now() })
      .then(function () { if (cb) cb(true); })
      .catch(function () { if (cb) cb(false); });
  }

  function topScores(gameId, limit, cb) {
    var database = ensureInit();
    if (!database || !GAMES[gameId]) { cb([]); return function () {}; }
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
    isConfigured: function () { return !!ensureInit(); },
    getName: getName,
    setName: setName,
    formatScore: formatScore,
    submitScore: submitScore,
    topScores: topScores
  };
})();
