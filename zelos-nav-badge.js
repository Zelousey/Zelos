/*!
 * Zelos — nav "what's new" badge.
 *
 * Requires, loaded BEFORE this file (same pattern as zelos-xp.js):
 *   <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"></script>
 *   <script src="firebase-config.js"></script>
 *
 * Shows a small pulsing dot on every "Menu ▾" button on the page when the
 * most recently published alert is newer than what this browser has already
 * seen. It's a nudge, not a notification center - it doesn't say what's new
 * or how many, just that something is, and it clears the moment the visitor
 * opens the menu to look. Entirely cosmetic and best-effort: a signed-out
 * visitor, a slow connection, or Firestore being briefly unreachable all just
 * mean no dot appears - never an error, never blocks the page underneath it.
 */
(function () {
  var STORAGE_KEY = 'zelosLastSeenAlertAt';

  function firestoreDb() {
    var cfg = window.ZELOS_FIREBASE_CONFIG;
    if (!cfg || !cfg.projectId || String(cfg.projectId).indexOf('PASTE_ME') !== -1) return null;
    if (!window.firebase || !firebase.firestore) return null;
    try {
      if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(cfg);
      return firebase.firestore();
    } catch (e) {
      return null;
    }
  }

  function lastSeenMs() {
    try {
      return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0;
    } catch (e) {
      return 0;
    }
  }
  function markSeenNow() {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch (e) {}
  }

  function showBadges() {
    document.querySelectorAll('.nav-menu-btn').forEach(function (btn) {
      if (btn.querySelector('.nav-menu-badge')) return;
      var dot = document.createElement('span');
      dot.className = 'nav-menu-badge';
      dot.setAttribute('aria-hidden', 'true');
      btn.appendChild(dot);
    });
  }
  function hideBadges() {
    document.querySelectorAll('.nav-menu-badge').forEach(function (el) {
      el.remove();
    });
  }

  function wireClearOnOpen() {
    document.querySelectorAll('.nav-menu-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        markSeenNow();
        hideBadges();
      });
    });
  }

  function check() {
    var db = firestoreDb();
    if (!db) return;
    db.collection('alerts').orderBy('createdAt', 'desc').limit(1).get().then(function (snap) {
      if (snap.empty) return;
      var ts = snap.docs[0].data().createdAt;
      var ms = ts && ts.toMillis ? ts.toMillis() : 0;
      if (ms && ms > lastSeenMs()) showBadges();
    }).catch(function () {
      /* cosmetic only - fail quietly */
    });
  }

  function init() {
    wireClearOnOpen();
    check();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
