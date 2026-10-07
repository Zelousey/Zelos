/*!
 * Zelos: the server practice account, for classic-site widgets.
 *
 * Since 2026-10-07 the $10,000 practice account lives on the server
 * (practiceAccounts/{uid}, written only by Cloud Functions; trading happens in the
 * app at /app/practice). Classic pages that show the balance (Trade War home, the
 * dashboard widget) read it through this helper instead of the old browser copy.
 *
 *   ZelosPracticeAcct.watch(db, uid, cb) -> unsubscribe
 *     cb(null)                       no server account yet (shows the fresh $10,000)
 *     cb({ equity, cash, positions: [{sym, qty, avg, openedDay}], best: [trades], stats })
 *   Prices come from the public markets/quotes doc, same rule as the server:
 *   a position without a price is valued at its cost.
 *   ZelosPracticeAcct.APP_URL  where to send people to trade
 */
(function (global) {
  'use strict';
  var ROOT = /\/(learn|scan|practice|real|games)\//.test(global.location.pathname) ? '../' : '';
  function watch(db, uid, cb) {
    var acct, quotes = {}, haveAcct = false;
    function emit() {
      if (!haveAcct) return;
      if (!acct) return cb(null);
      var positions = Object.keys(acct.positions || {}).map(function (s) { var p = acct.positions[s]; return { sym: s, qty: +p.qty || 0, avg: +p.avg || 0, openedDay: p.openedDay || null }; }).filter(function (p) { return p.qty > 0; });
      var eq = (+acct.cash || 0) + positions.reduce(function (t, p) { var q = quotes[p.sym]; return t + p.qty * (q && q.c ? q.c : p.avg); }, 0);
      cb({ equity: eq, cash: +acct.cash || 0, positions: positions, best: (acct.stats && acct.stats.best) || [], stats: acct.stats || {} });
    }
    var u1 = db.collection('practiceAccounts').doc(uid).onSnapshot(function (s) { haveAcct = true; acct = s.exists ? s.data() : null; emit(); }, function () { haveAcct = true; acct = null; emit(); });
    var u2 = db.collection('markets').doc('quotes').onSnapshot(function (s) { quotes = (s.exists && s.data().quotes) || {}; emit(); }, function () {});
    return function () { u1(); u2(); };
  }
  global.ZelosPracticeAcct = { watch: watch, APP_URL: ROOT + 'app/practice' };
})(window);
