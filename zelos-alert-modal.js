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

  function mountChart(container, ticker) {
    if (!ticker) return;
    container.innerHTML =
      '<div class="tradingview-widget-container" style="height:240px;">' +
        '<div class="tradingview-widget-container__widget"></div>' +
      '</div>';
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.text = JSON.stringify({
      autosize: true,
      symbol: ticker,
      interval: 'D',
      timezone: 'America/New_York',
      theme: 'dark',
      style: '1',
      locale: 'en',
      allow_symbol_change: false,
      hide_top_toolbar: true,
      hide_side_toolbar: true,
      save_image: false,
      backgroundColor: 'rgba(18,23,41,1)'
    });
    container.querySelector('.tradingview-widget-container').appendChild(script);
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
    mountChart(document.getElementById('zmodalChart'), a.ticker);

    if (id && window.ZelosXP && ZelosXP.onChange) {
      ZelosXP.onChange(function (user) { if (user) ZelosXP.award('alert-open', id); });
    }
  }

  function openWithData(id, data) { render(id, data || {}); }

  function open(id) {
    var database = getDb();
    if (!database || !id) return;
    database.collection('alerts').doc(id).get().then(function (doc) {
      if (!doc.exists) return;
      render(id, doc.data());
    }).catch(function () { /* fail quiet — the sidebar link to alert.html still works */ });
  }

  window.ZelosAlertModal = { open: open, openWithData: openWithData, close: close };
})();
