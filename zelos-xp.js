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
 *   isSignedIn()           — true if someone's currently authenticated (including anonymously —
 *                            see below; use isRealAccount() to ask "did they actually sign up")
 *   isRealAccount()        — true only for an email/Google account, never an anonymous session
 *   award(type, refId, cb) — cb(awarded, newTotals) — awarded is false if signed out,
 *                            already counted for that refId, or unreachable; newTotals
 *                            is {xp, streakDays} when known.
 *   onChange(cb)           — cb(user|null) fires on sign-in/out (thin wrapper so pages
 *                            don't need their own onAuthStateChanged just for this)
 *
 * Anonymous auth: earning XP requires *some* Firebase user, but almost nobody signs up
 * just to earn XP — most visitors never create an account. So on first load this module
 * silently signs every visitor in anonymously (auth.signInAnonymously()), giving them a
 * uid to award XP against with zero prompt, zero UI change. That anonymous uid is a real
 * Firebase user, so it satisfies firestore.rules (request.auth.uid == userId) the same as
 * a real account. If they later actually sign up, call ZelosXP.linkAccount(credential) (or
 * just let firebase.auth().signInWithPopup/createUserWithEmailAndPassword run as normal —
 * Firebase will upgrade the same uid in place when the session was anonymous) so their
 * accumulated XP carries over instead of starting over at 0.
 *
 * IMPORTANT for every page's own onAuthStateChanged handler: an anonymous session is a
 * truthy `user` with `user.isAnonymous === true`. Anywhere a page decides whether to show
 * "signed in" account UI (nav dropdown, owned skills, dashboard content), it must check
 * `user && !user.isAnonymous` — otherwise every anonymous visitor will look signed in.
 * XP awarding itself does NOT need that check; award() below works for anon users on purpose.
 */
(function () {
  var POINTS = { 'alert-open': 5, 'daily-checkin': 3, 'arcade-play': 5 };

  // Level-ups get a full-screen celebration (zelos-levels.js) on whatever page
  // the XP was earned. Loaded lazily, from the same folder as this file, so
  // no page has to add another script tag.
  var LEVELS_SRC = (function () {
    var cs = document.currentScript;
    return cs && cs.src ? cs.src.replace(/zelos-xp\.js(\?.*)?$/, 'zelos-levels.js') : null;
  })();
  var levelsPromise = null;
  function withLevels(fn) {
    if (window.ZelosLevels) return fn(window.ZelosLevels);
    if (!LEVELS_SRC) return;
    if (!levelsPromise) {
      levelsPromise = new Promise(function (resolve) {
        var sc = document.createElement('script');
        sc.src = LEVELS_SRC; sc.async = true;
        sc.onload = function () { resolve(window.ZelosLevels || null); };
        sc.onerror = function () { resolve(null); };
        document.head.appendChild(sc);
      });
    }
    levelsPromise.then(function (L) { if (L) fn(L); });
  }
  function maybeCelebrate(before, after) {
    if (!(after > before)) return;
    withLevels(function (L) {
      var a = L.levelForXp(before), b = L.levelForXp(after);
      if (b.level > a.level) L.celebrate(b, { xp: after, gained: after - before });
    });
  }
  var initialized = false;
  var auth = null, db = null;
  var authReadyPromise = null;

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

  // Resolves once we know the auth state for sure — either a persisted/real user Firebase
  // already knew about, or (if nobody was signed in at all) a freshly created anonymous
  // user. Only tries signInAnonymously() once; safe to call repeatedly, always the same
  // promise.
  function ensureAnonAuth() {
    if (authReadyPromise) return authReadyPromise;
    authReadyPromise = new Promise(function (resolve) {
      var unsub = auth.onAuthStateChanged(function (user) {
        if (user) {
          if (unsub) unsub();
          resolve(user);
          return;
        }
        auth.signInAnonymously().catch(function (e) {
          console.warn('[ZelosXP] anonymous sign-in failed:', e);
          if (unsub) unsub();
          resolve(null);
        });
        // don't resolve here — the resulting onAuthStateChanged(user) call above
        // (or the catch, on failure) settles the promise.
      });
    });
    return authReadyPromise;
  }

  function dateStrET(offsetDays) {
    var d = new Date();
    if (offsetDays) d.setDate(d.getDate() + offsetDays);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // -> "YYYY-MM-DD"
  }

  function award(type, refId, cb) {
    cb = cb || function () {};
    if (!ensureInit()) return cb(false);
    if (!POINTS.hasOwnProperty(type)) return cb(false);
    ensureAnonAuth().then(function (user) {
      if (!user) return cb(false);
      awardForUser(type, refId, user, cb);
    });
  }

  function awardForUser(type, refId, user, cb) {
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
            before: data.xp || 0,
            awarded: awardedThisCall,
            xp: updates.xp !== undefined ? updates.xp : (data.xp || 0),
            streakDays: updates.streakDays !== undefined ? updates.streakDays : (data.streakDays || 0)
          };
        });
      });
    }).then(function (result) {
      if (result.awarded) maybeCelebrate(result.before, result.xp);
      cb(result.awarded, { xp: result.xp, streakDays: result.streakDays });
    }).catch(function (e) {
      console.warn('[ZelosXP] award failed:', type, refId, e);
      cb(false);
    });
  }

  window.ZelosXP = {
    isConfigured: function () { return ensureInit(); },
    isSignedIn: function () { return ensureInit() && !!auth.currentUser; },
    isRealAccount: function () { return ensureInit() && !!auth.currentUser && !auth.currentUser.isAnonymous; },
    award: award,
    onChange: function (cb) {
      if (!ensureInit()) return function () {};
      return auth.onAuthStateChanged(cb);
    }
  };

  // Make good on the doc comment above: "on first load this module silently
  // signs every visitor in anonymously." Without this line, that only
  // actually happened as a side effect of some page's own onAuthStateChanged
  // handler calling award() — and every one of those handlers (copy-pasted
  // across ~25 pages) is gated on `if (user && ...)`, which a genuinely
  // first-ever visitor with no persisted session never satisfies. For a
  // visitor whose first-ever pageview is a shared alert link (arguably the
  // single most common way anyone new arrives at Zelos), that meant no
  // anonymous uid ever got created, so alert-open XP and the streak silently
  // never started. Kicking it off once, right here, means every page that
  // loads this file gets a real Firebase user before its own auth listener
  // runs, so the existing per-page `if (user) award(...)` calls now do what
  // they were always meant to.
  if (ensureInit()) ensureAnonAuth();
})();
