/*!
 * Zelos — actionable alert modal.
 *
 * Turns a click on any "Latest Alert" card into a modal/drawer with a live
 * chart for that ticker plus the same entry/stop/target/reasoning data
 * alert.html already renders — so a person doesn't have to leave the page
 * to see what a trade would actually look like.
 *
 * Requires, loaded BEFORE this file:
 *   <link rel="stylesheet" href="zelos-theme.css">
 *   Firebase app + firestore compat scripts, firebase-config.js
 *   (zelos-xp.js optional — used for a silent alert-open XP tick)
 *
 * Usage:
 *   ZelosAlertModal.open(alertId)          // fetches then opens
 *   ZelosAlertModal.openWithData(id, data) // already have the doc, skip the fetch
 */
(function () {
  var ROOT_ID = 'zelosAlertModalRoot';
  var db = null;

  function getDb() {
    if (db) return db;
    var cfg = window.ZELOS_FIREBASE_CONFIG;
    if (!cfg || !cfg.projectId || !window.firebase || !firebase.firestore) return null;
    try {
      if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(cfg);
      db = firebase.firestore();
      return db;
    } catch (e) { return null; }
  }

  function root() {
    var el = document.getElementById(ROOT_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = ROOT_ID;
      document.body.appendChild(el);
    }
    return el;
  }

  function fmtMoney(n, showPlus) {
    if (n === undefined || n === null) return '—';
    var sign = n < 0 ? '−' : (showPlus ? '+' : '');
    return sign + '$' + Math.abs(n).toFixed(2);
  }
  function fmtStamp(ts) {
    try {
      var d = ts && ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString('en-US', { timeZone: 'America/New_York', month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' ET';
    } catch (e) { return ''; }
  }
  var STRATEGY_LABEL = { 'swing-trader': 'Swing Trader', 'breakout-rider': 'Breakout Rider', 'options-scanner': 'Options Scanner' };

  function close() {
    var overlay = document.querySelector('.zmodal-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', onKeydown);
  }
  function onKeydown(e) { if (e.key === 'Escape') close(); }

  function buildLedger(a) {
    var rows = [];
    if (a.entry !== undefined) rows.push(['Entry (reference)', fmtMoney(a.entry), '']);
    if (a.stop !== undefined) rows.push(['Stop', fmtMoney(a.stop), 'risk']);
    if (a.target1 !== undefined) rows.push(['Target 1', fmtMoney(a.target1), 'accent']);
    if (a.target2 !== undefined) rows.push(['Target 2', fmtMoney(a.target2), '']);
    if (a.riskPerShare !== undefined) rows.push(['Risk / share', fmtMoney(a.riskPerShare), 'risk']);
    if (a.rewardPerShare !== undefined) rows.push(['Reward / share (T1)', fmtMoney(a.rewardPerShare, true), 'accent']);
    if (a.rewardRiskRatio) rows.push(['Reward : Risk', a.rewardRiskRatio, 'accent']);
    if (a.optionsRule) rows.push(['Strike / expiration rule', a.optionsRule, '']);
    if (a.suggestedSizeNote) rows.push(['Suggested size', a.suggestedSizeNote, '']);
    if (!rows.length) return '<div class="zmodal-fine">No entry/stop/target on this alert — see the reasoning below.</div>';
    return rows.map(function (r) {
      return '<div class="zmodal-row"><span class="zmodal-label">' + r[0] + '</span><span class="zmodal-value ' + r[2] + '">' + r[1] + '</span></div>';
    }).join('');
  }

  function techLine(technicals) {
    if (!technicals || !Object.keys(technicals).length) return '';
    return Object.keys(technicals).map(function (k) { return k + ': ' + technicals[k]; }).join(' · ');
  }

  // Our own Trade War chart engine (practice/practice-chart.js), loaded on demand.
  // TradingView is only used on the Live Chart page (Real Trading).
  var ROOT = /\/(games|learn|scan|practice|real)\//.test(location.pathname) ? '../' : '';
  var kitP = null;
  function chartKit() {
    if (window.ZelosTradeChart && window.ZelosTradeChart.mount) return Promise.resolve(window.ZelosTradeChart);
    if (!kitP) kitP = new Promise(function (resolve, reject) {
      var s = document.createElement('script'); s.src = ROOT + 'practice/practice-chart.js';
      s.onload = function () { resolve(window.ZelosTradeChart); }; s.onerror = function () { kitP = null; reject(); };
      document.head.appendChild(s);
    });
    return kitP;
  }
  function mountChart(container, ticker, a) {
    if (!ticker) return;
    a = a || {};
    container.innerHTML = '<div style="height:240px"></div>';
    chartKit().then(function (TC) {
      var lines = [];
      if (a.entry) lines.push({ price: +a.entry, color: '#4a86ff', label: 'ENTRY' });
      if (a.stop) lines.push({ price: +a.stop, color: '#e0483f', label: 'STOP' });
      if (a.target1) lines.push({ price: +a.target1, color: '#10b981', label: 'TARGET 1' });
      if (a.target2) lines.push({ price: +a.target2, color: '#10b981', label: 'TARGET 2' });
      var db = null; try { db = window.firebase && firebase.apps && firebase.apps.length ? firebase.firestore() : null; } catch (e) {}
      TC.mount(container, { root: ROOT, sym: String(ticker).toUpperCase(), db: db, height: '240px', bars: 90, lines: lines,
        missing: function (sym) { return sym + ' isn\'t in the Zelos chart data yet. Open it in Live Chart for the full history.'; } });
    }).catch(function () { container.innerHTML = '<div class="zmodal-fine">Chart unavailable right now.</div>'; });
  }

  function render(id, a) {
    var strategyLabel = STRATEGY_LABEL[a.strategy] || a.strategy || 'Zelos';
    var statusLabel = a.status === 'qualified' ? 'Qualifying setup' : (a.status === 'watching' ? 'Watching — not yet qualified' : 'No qualifying setup today');

    var techText = techLine(a.technicals);

    var html =
      '<div class="zmodal-overlay" id="zmodalOverlay">' +
        '<div class="zmodal" role="dialog" aria-modal="true" aria-label="Alert detail">' +
          '<div class="zmodal-head">' +
            '<div>' +
              '<div class="eyebrow">' + strategyLabel + ' · ' + statusLabel + '</div>' +
              '<h2 style="font-size:1.4rem; margin-top:6px; font-family:var(--mono);">' + (a.ticker || '—') + '</h2>' +
              (a.setupLabel ? '<div style="color:var(--ink-2); font-size:0.86rem; margin-top:4px;">' + a.setupLabel + '</div>' : '') +
            '</div>' +
            '<button class="zmodal-close" id="zmodalCloseBtn" type="button" aria-label="Close">&times;</button>' +
          '</div>' +
          '<div class="zmodal-body">' +
            '<div class="zmodal-chart" id="zmodalChart"></div>' +
            '<div>' + buildLedger(a) + '</div>' +
            (a.reasoning ? '<div class="zmodal-block"><h4>How to read this</h4><p>' + a.reasoning + '</p></div>' : '') +
            (techText ? '<div class="zmodal-block"><h4>Technicals</h4><p>' + techText + '</p></div>' : '') +
            (a.riskNotes ? '<div class="zmodal-block"><h4>Risk notes</h4><p>' + a.riskNotes + '</p></div>' : '') +
            '<div class="zmodal-fine">' +
              (a.marketRegime ? a.marketRegime + '<br>' : '') +
              'Rule-based scan only — general information, the same for every subscriber, not personalized advice. Not a registered investment adviser. Trading involves risk, including loss of principal.<br>' +
              'This page never places, cancels, or modifies any order — Zelos never connects to your brokerage account.<br>' +
              fmtStamp(a.createdAt) +
              (id ? ' · <a href="alert.html?id=' + encodeURIComponent(id) + '" style="color:var(--accent);">Full alert page &rarr;</a>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    root().innerHTML = html;
    document.getElementById('zmodalCloseBtn').addEventListener('click', close);
    document.getElementById('zmodalOverlay').addEventListener('click', function (e) {
      if (e.target.id === 'zmodalOverlay') close();
    });
    document.addEventListener('keydown', onKeydown);
    if (a.ticker) mountChart(document.getElementById('zmodalChart'), a.ticker, a);

    if (id && window.ZelosXP && ZelosXP.onChange) {
      ZelosXP.onChange(function (user) { if (user) ZelosXP.award('alert-open', id); });
    }
  }

  // Live alerts are token-gated until the close (zelos-tokens.js): the full alert if you
  // have a pass or unlocked it, else the teaser with an unlock card instead of the levels.
  function show(id, a) {
    var T = window.ZelosTokens;
    if (!T || !T.isLocked(a)) return render(id, a);
    T.resolve(a, id).then(function (r) {
      render(id, r.alert);
      if (!r.locked) return;
      var head = document.querySelector('#zmodalOverlay h2'); if (head) head.textContent = 'Locked · live';
      var chart = document.getElementById('zmodalChart'); if (!chart) return;
      var card = T.lockCard(a, id, function (f) { render(id, f); });
      chart.replaceWith(card);
    });
  }
  function openWithData(id, data) { show(id, data || {}); }

  function open(id) {
    var database = getDb();
    if (!database || !id) return;
    database.collection('alerts').doc(id).get().then(function (doc) {
      if (!doc.exists) return;
      show(id, doc.data());
    }).catch(function () { /* fail quiet — the sidebar link to alert.html still works */ });
  }

  window.ZelosAlertModal = { open: open, openWithData: openWithData, close: close };
})();
