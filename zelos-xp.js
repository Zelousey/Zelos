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
 * Practice Account and social XP (callers build the refId, including any daily
 * cap, e.g. "2026-09-28:3" for the 3rd trade of the day):
 *   practice-trade   +5    a filled practice order (first 10 a day)
 *   practice-win     +10   a closed trade in profit (first 10 a day)
 *   grade-setup      +10   a finished Grade the Setup game (first 5 a day)
 *   challenge-join   +25   created or accepted a friend challenge (per challenge)
 *   challenge-win    +150  won a friend challenge (per challenge)
 *   referral         +50   a friend you invited opened their practice account (per friend)
 *   referral-welcome +50   you joined through a friend's invite link (once)
 *   real-trade       +10   logged a trade in the Real Trade Journal (first 3 a day)
 *   trading-tools    +5    used the real-trading tools (watchlist, journal) — once a day
 *   share            +10   shared a Trade War challenge or account card — once a day
 * Variable amounts (caller passes the amount, capped here):
 *   mission          up to 300   daily / weekly missions, mission-streak rewards
 *   achievement      up to 500   badges (First Trade, $25K Club, ...)
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
  var POINTS = { 'alert-open': 5, 'daily-checkin': 3, 'arcade-play': 5,
    'practice-trade': 5, 'practice-win': 10, 'grade-setup': 10, 'challenge-join': 25, 'challenge-win': 150,
    'referral': 50, 'referral-welcome': 50, 'real-trade': 10, 'trading-tools': 5, 'share': 10 };
  // Where each award came from. One XP total, but every entry is labeled so a
  // profile never mixes up Trade War (virtual), Real Trading and training.
  // [source, label]; the activity ledger stores both, and pages show "+10 XP — Trade War Win".
  var SOURCES = {
    'alert-open': ['real', 'Opened an alert'], 'daily-checkin': ['platform', 'Daily check-in'], 'arcade-play': ['training', 'Arcade game'],
    'practice-trade': ['trade-war', 'Trade War trade'], 'practice-win': ['trade-war', 'Trade War win'], 'grade-setup': ['training', 'Completed Grade Setup'],
    'challenge-join': ['trade-war', 'Trade War challenge'], 'challenge-win': ['trade-war', 'Won a Trade War challenge'],
    'referral': ['social', 'Friend joined'], 'referral-welcome': ['social', 'Joined from an invite'],
    'real-trade': ['real', 'Real Trading Activity'], 'trading-tools': ['real', 'Used trading tools'], 'share': ['social', 'Shared Trade War'],
    'mission': ['missions', 'Mission'], 'achievement': ['achievements', 'Achievement'], 'onboard': ['platform', 'Getting set up']
  };
  var SOURCE_NAMES = { 'trade-war': 'Trade War', real: 'Real Trading', training: 'Training', social: 'Social', missions: 'Missions', achievements: 'Achievements', platform: 'Platform' };
  // types whose amount the caller chooses, with a hard cap so a bad call can't mint a fortune
  var VARIABLE = { 'mission': 300, 'achievement': 500, 'onboard': 50 };

  // Local tally of XP earned today / this week (ET), for the "Earn N XP" missions
  // in zelos-progress.js. Browser-local on purpose: it's a mission counter, not a balance.
  var LOG_KEY = 'zelosXpLog';
  function weekKey(dateStr) {
    var d = new Date(dateStr + 'T12:00:00Z'), day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day + 3);
    var y = d.getUTCFullYear(), first = new Date(Date.UTC(y, 0, 4));
    return y + '_' + String(1 + Math.round(((d - first) / 864e5 - 3 + ((first.getUTCDay() + 6) % 7)) / 7)).padStart(2, '0');
  }
  function logXp(amount, type, total) {
    var today = dateStrET(0), wk = weekKey(today), l;
    try { l = JSON.parse(localStorage.getItem(LOG_KEY) || '{}'); } catch (e) { l = {}; }
    if (!l.day || l.day.date !== today) l.day = { date: today, xp: 0 };
    if (!l.week || l.week.key !== wk) l.week = { key: wk, xp: 0 };
    l.day.xp += amount; l.week.xp += amount;
    try { localStorage.setItem(LOG_KEY, JSON.stringify(l)); } catch (e) {}
    var src = SOURCES[type] || ['platform', type];
    try { document.dispatchEvent(new CustomEvent('zelos:xp', { detail: { type: type, amount: amount, source: src[0], label: src[1], day: l.day.xp, week: l.week.xp, total: total } })); } catch (e) {}
  }

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

  function award(type, refId, cb, amount) {
    cb = cb || function () {};
    if (!ensureInit()) return cb(false);
    if (VARIABLE.hasOwnProperty(type)) {
      amount = Math.round(+amount || 0);
      if (!(amount > 0)) return cb(false);
      amount = Math.min(amount, VARIABLE[type]);
    } else if (POINTS.hasOwnProperty(type)) amount = POINTS[type];
    else return cb(false);
    ensureAnonAuth().then(function (user) {
      // whoever is signed in right now: after a guest signs in with Google on
      // the same page, XP must land on the real account, not the guest uid
      // this promise first resolved with
      user = auth.currentUser || user;
      if (!user) return cb(false);
      awardForUser(type, refId, user, cb, amount);
    });
  }

  function awardForUser(type, refId, user, cb, amount) {
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
            var src = SOURCES[type] || ['platform', type];
            tx.set(eventRef, {
              type: type, refId: dedupKey, xp: amount, source: src[0], label: src[1],
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
      if (result.awarded) { maybeCelebrate(result.before, result.xp); logXp(amount, type, result.xp); }
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
    points: function (type) { return POINTS[type] || 0; },
    source: function (type) { var s = SOURCES[type] || ['platform', type]; return { id: s[0], name: SOURCE_NAMES[s[0]] || s[0], label: s[1] }; },
    SOURCE_NAMES: SOURCE_NAMES,
    weekKey: weekKey,
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
