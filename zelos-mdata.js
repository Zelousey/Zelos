/*!
 * zelos-mdata.js: market data the server saves from licensed sources (Marketstack prices).
 *
 * Pages used to load price history from files in data/ that came from personal-use sources.
 * Those files are gone; the server now keeps the same data in public, read-only Firestore
 * docs (markets/history_<n>, markets/snapshot), and this reads them with one plain HTTPS
 * request each, so pages without the Firebase SDK (the arcade games) can use it too.
 *
 *   ZelosData.history()   -> Promise({ source, symbols: { SYM: [["YYYY-MM-DD", o, h, l, c, v], ...] } })
 *                            (the shape data/game-charts.json used to have; never rejects)
 *   ZelosData.json(docId) -> Promise(parsed JSON stored in markets/<docId>.json, or null)
 */
(function (global) {
  'use strict';
  if (global.ZelosData) return;
  var BASE = 'https://firestore.googleapis.com/v1/projects/leaderboard-agentictrading/databases/(default)/documents/markets/';
  function field(doc, name) {
    var f = doc && doc.fields && doc.fields[name];
    if (!f) return null;
    if ('stringValue' in f) return f.stringValue;
    if ('integerValue' in f) return +f.integerValue;
    if ('arrayValue' in f) return (f.arrayValue.values || []).map(function (v) { return v.stringValue; });
    return null;
  }
  function getDoc(id) {
    return fetch((global.ZELOS_MDATA_BASE || BASE) + id, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function json(id) {
    return getDoc(id).then(function (d) { var s = field(d, 'json'); if (!s) return null; try { return JSON.parse(s); } catch (e) { return null; } });
  }
  var histP = null;
  function history() {
    if (histP) return histP;
    histP = getDoc('historyIndex').then(function (idx) {
      var n = field(idx, 'parts') || 0, jobs = [];
      for (var i = 0; i < n; i++) jobs.push(json('history_' + i));
      return Promise.all(jobs);
    }).then(function (parts) {
      var symbols = {};
      (parts || []).forEach(function (p) { if (p) Object.keys(p).forEach(function (k) { symbols[k] = p[k]; }); });
      return { source: 'Marketstack', symbols: symbols };
    }).catch(function () { return { source: 'Marketstack', symbols: {} }; });
    return histP;
  }
  global.ZelosData = { history: history, json: json };
})(window);
