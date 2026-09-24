/*!
 * Zelos — shared "market mood" background module.
 *
 * Sets document.body.dataset.mood to 'bull' | 'bear' | '' (neutral/unknown)
 * from the most recent alert's marketRegime text, so the ambient page
 * background (zelos-theme.css: body.zt-body[data-mood="bull"|"bear"]) can
 * carry a faint green/red tint that matches current conditions — subtle by
 * design, never more than the low-opacity --mood-tint values in the theme.
 *
 * Requires, loaded BEFORE this file (same pattern as zelos-xp.js):
 *   <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"></script>
 *   <script src="firebase-config.js"></script>  (or "../firebase-config.js" from games/)
 *
 * No auth needed — alerts are public-read (see firestore.rules). This never
 * blocks or delays page content: it runs after the fact and just nudges a
 * CSS custom property, with a 1.2s transition already defined in the theme.
 *
 * Cached in localStorage for CACHE_MS so most page loads don't hit Firestore
 * at all — one visitor browsing several pages in a session reads the regime
 * once, not once per page.
 */
(function () {
  var CACHE_KEY = 'zelosMood';
  var CACHE_MS = 10 * 60 * 1000; // 10 minutes — regime doesn't change fast enough to need less

  function applyMood(mood) {
    // mood is 'bull', 'bear', or '' (neutral/unknown — leaves the default transparent tint)
    document.body.dataset.mood = mood || '';
  }

  function regimeToMood(text) {
    var t = (text || '').toUpperCase();
    if (t.indexOf('BULLISH') !== -1) return 'bull';
    if (t.indexOf('BEARISH') !== -1) return 'bear';
    return ''; // neutral or unknown — no tint, per "keep it subdued/neutral"
  }

  function readCache() {
    try {
      var raw = window.localStorage && localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.ts !== 'number') return null;
      if (Date.now() - parsed.ts > CACHE_MS) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeCache(mood) {
    try {
      if (window.localStorage) {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ mood: mood, ts: Date.now() }));
      }
    } catch (e) { /* ignore — quota/private-mode, not worth failing over */ }
  }

  // Apply a cached value immediately (if any) so there's no flash of the
  // default tint while we wait on a fresh network read.
  var cached = readCache();
  if (cached) applyMood(cached.mood);

  var cfg = window.ZELOS_FIREBASE_CONFIG;
  if (!cfg || !cfg.projectId || String(cfg.projectId).indexOf('PASTE_ME') !== -1) return;
  if (!window.firebase || !firebase.firestore) return;
  // If we just applied a fresh-enough cached value, no need to refetch yet.
  if (cached) return;

  try {
    if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(cfg);
    var db = firebase.firestore();
    db.collection('alerts').orderBy('createdAt', 'desc').limit(1).get().then(function (snap) {
      var latest = null;
      snap.forEach(function (doc) { latest = doc.data(); });
      var mood = regimeToMood(latest && latest.marketRegime);
      applyMood(mood);
      writeCache(mood);
    }).catch(function (e) {
      console.warn('[ZelosMood] could not read latest regime:', e);
    });
  } catch (e) {
    console.warn('[ZelosMood] init failed:', e);
  }
})();
