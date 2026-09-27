/*!
 * Zelos — trading modes: REAL and PRACTICE (Trade War).
 *
 * One account, one XP / level / achievement / social system; two trading
 * environments whose money and statistics never mix:
 *
 *   REAL      trades the person actually made at their own broker, logged in the
 *             Real Trade Journal (real/). Zelos never connects to or trades on a
 *             brokerage account.
 *   PRACTICE  Trade War: the $10,000 virtual account (practice/). Virtual money.
 *
 * Every trade record carries `mode: 'REAL' | 'PRACTICE'`; pages show it with
 * ZelosModes.tag(mode) so nobody ever has to wonder whether money is real.
 * New modes (a paper options league, agent sandboxes, ...) add an entry here.
 */
(function (global) {
  'use strict';
  var MODES = {
    REAL: { id: 'REAL', name: 'Real Trading', tag: 'REAL TRADE', short: 'REAL', cls: 'is-real', href: 'real/', money: 'real money, logged by you' },
    PRACTICE: { id: 'PRACTICE', name: 'Trade War', tag: 'TRADE WAR — VIRTUAL', short: 'VIRTUAL', cls: 'is-war', href: 'practice/', money: 'virtual money' }
  };
  function mode(id) { return MODES[id] || MODES.PRACTICE; }
  // <span class="zm-tag is-war">TRADE WAR — VIRTUAL</span>
  function tag(id, short) { var m = mode(id); return '<span class="zm-tag ' + m.cls + '">' + (short ? m.short : m.tag) + '</span>'; }
  function injectStyle() {
    if (document.getElementById('zm-style')) return;
    var css = '.zm-tag{display:inline-flex;align-items:center;gap:4px;font:700 .6rem var(--mono,ui-monospace,monospace);letter-spacing:.06em;text-transform:uppercase;' +
      'padding:2px 7px;border-radius:3px;border:1px solid;white-space:nowrap;vertical-align:middle;line-height:1.5;}' +
      '.zm-tag.is-war{color:#6ea8ff;border-color:rgba(76,141,255,.55);background:rgba(76,141,255,.12);}' +
      '.zm-tag.is-real{color:#2fd3a4;border-color:rgba(47,211,164,.55);background:rgba(47,211,164,.1);}';
    var el = document.createElement('style'); el.id = 'zm-style'; el.textContent = css; (document.head || document.documentElement).appendChild(el);
  }
  injectStyle();
  // Real Trading status from the public, server-timestamped log of logged real
  // trades (traders/{uid}/realLog: [{ at: ms, sym }]). It measures activity on
  // AgenticTrading.info over time, never profitability, and can't be typed in:
  //   experience  10+ real trades logged on 5+ different days, first one 14+ days ago
  //   active      at least one real trade logged in the last 30 days
  function realStatus(logs) {
    logs = logs || [];
    var now = Date.now(), n = logs.length, days = {}, first = null, recent = 0;
    logs.forEach(function (l) {
      var d = new Date(l.at).toISOString().slice(0, 10); days[d] = 1;
      if (first == null || l.at < first) first = l.at;
      if (now - l.at < 30 * 864e5) recent++;
    });
    var nd = Object.keys(days).length, exp = n >= 10 && nd >= 5 && first != null && now - first >= 14 * 864e5, active = recent > 0;
    var detail = n ? n + ' real trade' + (n === 1 ? '' : 's') + ' logged on ' + nd + ' day' + (nd === 1 ? '' : 's') + (recent ? ' · ' + recent + ' in the last 30 days' : '') +
      '. Timestamped when logged; self-reported, not broker-verified, and not a measure of profitability.' : 'No real trades logged yet.';
    var id = !n ? 'none' : active ? 'active' : 'inactive';
    var label = !n ? 'Real Trading: not yet' : active ? (exp ? 'Real Trading: Active · Experienced' : 'Real Trading: Active') : (exp ? 'Real Trading Experience' : 'Real Trading: Inactive');
    return { id: id, label: label, short: !n ? 'Not yet' : active ? 'Active' : exp ? 'Experienced' : 'Inactive', experienced: exp, active: active, trades: n, days: nd, recent: recent, detail: detail };
  }
  global.ZelosModes = { MODES: MODES, mode: mode, tag: tag, realStatus: realStatus };
})(window);
