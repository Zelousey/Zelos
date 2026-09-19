/*!
 * Zelos — shared XP/streak module.
 *
 * Requires, loaded BEFORE this file (same pattern as leaderboard.js):
 *   <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"></script>
 *   <script src="firebase-config.js"></script>  (or "../firebase-config.js" from games/)
 *
 * Optional, not required for awarding but needed for a page to know why nothing
 * happened: window.ZelosXP.isSignedIn().
 *
 * How this stays "never interrupts the trading workflow": award() is entirely
 * silent and fire-and-forget. A signed-out visitor simply earns nothing — no
 * prompt, no gate, nothing blocks the page they're actually looking at. Every
 * caller in this codebase treats XP as a background side effect of something
 * the person already did (opened an alert, visited the dashboard, played a
 * game), never a requirement to do it.
 *
 * Point values live here, not scattered across pages, so they're one place to
 * tune later:
 *   alert-open    +5   (once per unique alert per person — dedup by alertId)
 *   daily-checkin +3   (once per calendar day — dedup by date, ET)
 *   arcade-play   +5   (once per calendar day, any game — dedup by date, ET)
 *
 * Streaks track "opened at least one alert today" specifically (per product
 * decision — daily check-ins and arcade play earn XP but don't feed the
 * streak). The streak updates at most once per day, the first time
 * award('alert-open', ...) runs that day, regardless of how many different
 * alerts get opened afterward.
 *
 * Exposes window.ZelosXP with:
 *   isConfigured()         — true once firebase-config.js has real values and the SDKs loaded
 *   isSignedIn()           — true if someone's currently authenticated
 *   award(type, refId, cb) — cb(awarded, newTotals) — awarded is false if signed out,
 *                            already counted for that refId, or unreachable; newTotals
 *                            is {xp, streakDays} when known.
 *   onChange(cb)           — cb(user|null) fires on sign-in/out (thin wrapper so pages
 *                            don't need their own onAuthStateChanged just for this)
 */
(function () {
  var POINTS = { 'alert-open': 5, 'daily-checkin': 3, 'arcade-play': 5 };
  var initialized = false;
  var auth = null, db = null;

  function ensureInit() {
    if (initialized) return !!(auth && db);
    initialized = true;
    var cfg = window.ZELOS_FIREBASE_CONFIG;
    if (!cfg || !cfg.projectId || String(cfg.projectId).indexOf('PASTE_ME') !== -1) return false;
    if (!window.firebase || !firebase.auth || !firebase.firestore) return false;
    try {
      if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(cfg);
      auth = firebase.auth();
      db = firebase.firestore();
    } catch (e) {
      auth = null; db = null;
    }
    return !!(auth && db);
  }

  function dateStrET(offsetDays) {
    var d = new Date();
    if (offsetDays) d.setDate(d.getDate() + offsetDays);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // -> "YYYY-MM-DD"
  }

  function award(type, refId, cb) {
    cb = cb || function () {};
    if (!ensureInit()) return cb(false);
    var user = auth.currentUser;
    if (!user || !POINTS.hasOwnProperty(type)) return cb(false);

    var amount = POINTS[type];
    var dedupKey = (refId === undefined || refId === null || refId === '') ? dateStrET(0) : String(refId);
    var eventId = type + ':' + dedupKey;
    var userRef = db.collection('users').doc(user.uid);
    var eventRef = userRef.collection('activity').doc(eventId);
    var today = dateStrET(0);
    var yesterday = dateStrET(-1);

    db.runTransaction(function (tx) {
      return tx.get(eventRef).then(function (eventDoc) {
        return tx.get(userRef).then(function (userDoc) {
          var data = userDoc.exists ? (userDoc.data() || {}) : {};
          var updates = {};
          var awardedThisCall = false;

          if (!eventDoc.exists) {
            updates.xp = (data.xp || 0) + amount;
            tx.set(eventRef, {
              type: type, refId: dedupKey, xp: amount,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            awardedThisCall = true;
          }

          if (type === 'alert-open' && data.lastAlertOpenDate !== today) {
            updates.streakDays = (data.lastAlertOpenDate === yesterday) ? ((data.streakDays || 0) + 1) : 1;
            updates.lastAlertOpenDate = today;
          }

          if (Object.keys(updates).length) {
            tx.set(userRef, updates, { merge: true });
          }

          return {
            awarded: awardedThisCall,
            xp: updates.xp !== undefined ? updates.xp : (data.xp || 0),
            streakDays: updates.streakDays !== undefined ? updates.streakDays : (data.streakDays || 0)
          };
        });
      });
    }).then(function (result) {
      cb(result.awarded, { xp: result.xp, streakDays: result.streakDays });
    }).catch(function () {
      cb(false);
    });
  }

  window.ZelosXP = {
    isConfigured: function () { return ensureInit(); },
    isSignedIn: function () { return ensureInit() && !!auth.currentUser; },
    award: award,
    onChange: function (cb) {
      if (!ensureInit()) return function () {};
      return auth.onAuthStateChanged(cb);
    }
  };
})();
