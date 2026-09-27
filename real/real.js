/*!
 * Zelos Real Trade Journal (real/index.html): REAL mode.
 *
 * For trades the person actually made at their own broker. Zelos never
 * connects to or places orders in a brokerage account: trades are logged
 * here by the trader and kept completely separate from Trade War (virtual).
 *
 * Firestore:
 *   users/{uid}/realTrades/{id}   private: { mode:'REAL', sym, side, qty, entry, entryDate,
 *                                  exit, exitDate, fees, source, notes, status, createdAt, updatedAt }
 *   traders/{uid}                 public identity: { name, photo, showRealStats, realStats, skills, updatedAt }
 *   traders/{uid}/realLog/{id}    public, one per logged trade: { sym, createdAt } with a
 *                                  server timestamp the rules won't let anyone backdate. The
 *                                  "Real Trading: Active / Experience" status is computed from
 *                                  these (ZelosModes.realStatus), never typed in.
 */
(function () {
  'use strict';
  var M = window.ZelosModes, P = window.ZelosProgress;
  var $ = function (id) { return document.getElementById(id); };
  var SKILL_NAMES = { 'swing-trader': 'Swing Trader', 'breakout-rider': 'Breakout Rider', 'options-scanner': 'Options Scanner' }, userData = {};
  var db = null, user = null, trades = [], quotes = {}, trader = {}, traderLoaded = false, logs = [], names = {}, editing = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(v) { return (v < 0 ? '-$' : '$') + Math.abs(+v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function signed(v) { return (v >= 0 ? '+' : '-') + money(Math.abs(v)); }
  function pct(v) { return (v >= 0 ? '+' : '') + (+v || 0).toFixed(2) + '%'; }
  function cls(v) { return v >= 0 ? 'up' : 'dn'; }
  function today() { try { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function tag(short) { return M ? M.tag('REAL', short) : '<span class="zm-tag is-real">REAL TRADE</span>'; }
  function toast(t, bad) {
    var el = document.createElement('div'); el.className = 'pt-toast' + (bad ? ' is-bad' : ''); el.innerHTML = t;
    document.body.appendChild(el); setTimeout(function () { el.classList.add('is-out'); }, 3600); setTimeout(function () { el.remove(); }, 4100);
  }
  var SOURCES = { manual: 'My own idea', 'swing-trader': 'Swing Trader signal', 'breakout-rider': 'Breakout Rider signal', 'options-scanner': 'Options Scanner signal' };

  // ------------------------------------------------------------ math
  function mult(t) { return t.side === 'short' ? -1 : 1; }
  function realized(t) { return t.exit != null ? mult(t) * (t.exit - t.entry) * t.qty - (t.fees || 0) : 0; }
  function unrealized(t) { var q = quotes[t.sym]; return t.exit == null && q && q.c ? mult(t) * (q.c - t.entry) * t.qty : null; }
  function stats() {
    var closed = trades.filter(function (t) { return t.exit != null; }), open = trades.filter(function (t) { return t.exit == null; });
    var wins = closed.filter(function (t) { return realized(t) > 0; }).length, losses = closed.filter(function (t) { return realized(t) < 0; }).length;
    var un = open.reduce(function (a, t) { var u = unrealized(t); return a + (u || 0); }, 0);
    var pcts = closed.map(function (t) { return mult(t) * (t.exit / t.entry - 1) * 100; });
    var bySym = {}; trades.forEach(function (t) { bySym[t.sym] = (bySym[t.sym] || 0) + 1; });
    return { total: trades.length, open: open.length, closed: closed.length, wins: wins, losses: losses, winRate: closed.length ? Math.round(wins / closed.length * 100) : null,
      realized: closed.reduce(function (a, t) { return a + realized(t); }, 0), unrealized: un, avgPct: pcts.length ? pcts.reduce(function (a, b) { return a + b; }, 0) / pcts.length : null,
      favorites: Object.keys(bySym).sort(function (a, b) { return bySym[b] - bySym[a]; }).slice(0, 5) };
  }

  // ------------------------------------------------------------ render
  function render() {
    if (!user) {
      $('rjBody').innerHTML = '<div class="pt-card ch-card"><h2>Sign in to keep a Real Trade Journal</h2><p class="pt-fine">Your real trades are private to your account. ' +
        'Same account, XP and profile as Trade War; the money and statistics are kept completely separate.</p><button class="pt-btn pt-btn-go" type="button" id="rjSignIn">Sign in with Google</button></div>';
      $('rjSignIn').onclick = signIn; return;
    }
    var st = stats(), rs = M ? M.realStatus(logs) : null;
    var h = '<div class="rj-status ' + (rs ? 'is-' + rs.id : '') + '"><span class="rj-status-dot"></span><div><b>' + esc(rs ? rs.label : 'Real Trading') + '</b><small>' + esc(rs ? rs.detail : '') + '</small></div>' +
      '<a class="pt-mini" href="../practice/profile.html?u=' + encodeURIComponent(user.uid) + '">My profile &rarr;</a></div>';
    h += '<div class="pt-perf rj-stats">' + [
      ['Real trades logged', st.total], ['Open', st.open], ['Closed', st.closed], ['Win rate', st.winRate == null ? '–' : st.winRate + '%'],
      ['Realized P&amp;L <small>private</small>', st.closed ? '<span class="' + cls(st.realized) + '">' + signed(st.realized) + '</span>' : '–'],
      ['Open P&amp;L <small>live where available</small>', st.open ? '<span class="' + cls(st.unrealized) + '">' + signed(st.unrealized) + '</span>' : '–']
    ].map(function (r) { return '<span><small>' + r[0] + '</small><b>' + r[1] + '</b></span>'; }).join('') + '</div>';
    h += '<div class="rj-grid"><section class="pt-card ch-card rj-form"><h2>' + (editing ? 'Close ' + esc(editing.sym) : 'Log a real trade') + ' ' + tag() + '</h2>' + form() + '</section>' +
      '<section class="pt-card ch-card"><h2>Open real trades ' + tag(true) + '</h2>' + table(trades.filter(function (t) { return t.exit == null; }), true) +
      '<h2 style="margin-top:18px">Closed real trades ' + tag(true) + '</h2>' + table(trades.filter(function (t) { return t.exit != null; }), false) + '</section></div>';
    h += '<section class="pt-card ch-card"><h2>Your public profile</h2>' +
      '<label class="pt-check"><input type="checkbox" id="rjLog"' + (trader.publicLog !== false ? ' checked' : '') + '> Count my real trades toward my public <b>Real Trading</b> status <small>(shows the ticker and the date you logged it, never prices, size or P&amp;L)</small></label>' +
      '<label class="pt-check"><input type="checkbox" id="rjStats"' + (trader.showRealStats ? ' checked' : '') + '> Show my real-trade statistics on my profile <small>(closed trades, win rate, average % per trade; never dollar amounts)</small></label>' +
      '<p class="pt-fine">Real Trading status comes from trades logged here over time, each timestamped by the server when you log it, so it can\'t be backdated or typed in. ' +
      'It shows activity, not skill: it never means someone is profitable. Trades are self-reported; broker-verified trades are on the roadmap.</p></section>';
    $('rjBody').innerHTML = h;
    wire();
  }
  function form() {
    if (editing) {
      return '<div class="rj-fields"><label class="pt-field"><span>Exit price</span><input id="rjExit" type="number" step="0.01" min="0" inputmode="decimal"></label>' +
        '<label class="pt-field"><span>Exit date</span><input id="rjExitDate" type="date" value="' + today() + '"></label>' +
        '<label class="pt-field"><span>Fees (optional)</span><input id="rjFees" type="number" step="0.01" min="0" value="' + (editing.fees || '') + '"></label></div>' +
        '<div class="pt-soc-row"><button class="pt-btn pt-btn-go" type="button" id="rjSaveClose">Close this real trade</button><button class="pt-btn" type="button" id="rjCancelClose">Cancel</button></div>';
    }
    return '<div class="rj-fields">' +
      '<label class="pt-field"><span>Ticker</span><input id="rjSym" maxlength="10" placeholder="NVDA" autocomplete="off" list="rjSyms"></label>' +
      '<label class="pt-field"><span>Direction</span><select id="rjSide"><option value="long">Long (bought)</option><option value="short">Short (sold short)</option></select></label>' +
      '<label class="pt-field"><span>Shares</span><input id="rjQty" type="number" step="any" min="0" inputmode="decimal"></label>' +
      '<label class="pt-field"><span>Entry price</span><input id="rjEntry" type="number" step="0.01" min="0" inputmode="decimal"></label>' +
      '<label class="pt-field"><span>Entry date</span><input id="rjEntryDate" type="date" value="' + today() + '" max="' + today() + '"></label>' +
      '<label class="pt-field"><span>Idea from</span><select id="rjSource">' + Object.keys(SOURCES).map(function (k) { return '<option value="' + k + '">' + SOURCES[k] + '</option>'; }).join('') + '</select></label>' +
      '<label class="pt-check rj-closed"><input type="checkbox" id="rjIsClosed"> Already closed</label>' +
      '<label class="pt-field rj-x" hidden><span>Exit price</span><input id="rjExitNew" type="number" step="0.01" min="0"></label>' +
      '<label class="pt-field rj-x" hidden><span>Exit date</span><input id="rjExitDateNew" type="date" value="' + today() + '" max="' + today() + '"></label>' +
      '<label class="pt-field rj-wide"><span>Notes (private)</span><input id="rjNotes" maxlength="300" placeholder="Why you took it, your stop and target…"></label></div>' +
      '<datalist id="rjSyms">' + Object.keys(names).map(function (s) { return '<option value="' + s + '">' + esc(names[s]) + '</option>'; }).join('') + '</datalist>' +
      '<button class="pt-btn rj-log" type="button" id="rjAdd">Log REAL trade</button>' +
      '<p class="pt-fine">This records a trade you already made with real money at your broker. Nothing is bought or sold here. To practice with virtual money, use <a href="../practice/">Trade War</a>.</p>';
  }
  function table(list, open) {
    if (!list.length) return '<p class="pt-empty">' + (open ? 'No open real trades.' : 'No closed real trades yet.') + '</p>';
    return '<div class="pt-table-wrap"><table class="pt-table"><thead><tr><th>Ticker</th><th>Side</th><th>Shares</th><th>Entry</th>' + (open ? '<th>Now</th><th>Open P&amp;L</th><th>Since</th>' : '<th>Exit</th><th>P&amp;L</th><th>%</th><th>Closed</th>') + '<th></th></tr></thead><tbody>' +
      list.map(function (t) {
        var q = quotes[t.sym], u = unrealized(t), r = realized(t), pc = t.exit != null ? mult(t) * (t.exit / t.entry - 1) * 100 : 0;
        return '<tr><td><b>' + esc(t.sym) + '</b>' + (t.source && t.source !== 'manual' ? ' <small>' + esc(SOURCES[t.source] || '') + '</small>' : '') + '</td><td>' + (t.side === 'short' ? 'Short' : 'Long') + '</td><td>' + t.qty + '</td><td>' + (+t.entry).toFixed(2) + '</td>' +
          (open ? '<td>' + (q && q.c ? q.c.toFixed(2) : '–') + '</td><td class="' + (u == null ? '' : cls(u)) + '">' + (u == null ? '–' : signed(u)) + '</td><td>' + esc(t.entryDate) + '</td><td><button class="pt-mini" data-close="' + t.id + '">Close</button> <button class="pt-mini" data-del="' + t.id + '">Delete</button></td>'
            : '<td>' + (+t.exit).toFixed(2) + '</td><td class="' + cls(r) + '">' + signed(r) + '</td><td class="' + cls(pc) + '">' + pct(pc) + '</td><td>' + esc(t.exitDate || '') + '</td><td><button class="pt-mini" data-del="' + t.id + '">Delete</button></td>') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  function wire() {
    var closed = $('rjIsClosed');
    if (closed) closed.onchange = function () { document.querySelectorAll('.rj-x').forEach(function (e) { e.hidden = !closed.checked; }); };
    if ($('rjAdd')) $('rjAdd').onclick = add;
    if ($('rjSaveClose')) $('rjSaveClose').onclick = saveClose;
    if ($('rjCancelClose')) $('rjCancelClose').onclick = function () { editing = null; render(); };
    $('rjBody').onclick = function (e) {
      var b = e.target.closest('[data-close],[data-del]'); if (!b) return;
      var id = b.getAttribute('data-close') || b.getAttribute('data-del'), t = trades.filter(function (x) { return x.id === id; })[0]; if (!t) return;
      if (b.hasAttribute('data-close')) { editing = t; render(); window.scrollTo({ top: $('rjBody').offsetTop, behavior: 'smooth' }); return; }
      if (!confirm('Delete this ' + t.sym + ' real trade from your journal? It also stops counting toward your Real Trading status.')) return;
      col().doc(id).delete().then(function () { logRef(id).delete().catch(function () {}); toast('Real trade deleted.'); });
    };
    $('rjLog').onchange = function () {
      var on = this.checked;
      publish({ publicLog: on });
      if (!on) logs.forEach(function (l) { logRef(l.id).delete().catch(function () {}); });
      else trades.forEach(function (t) { if (!logs.some(function (l) { return l.id === t.id; })) writeLog(t.id, t.sym); });
      toast(on ? 'Your real trades count toward your public Real Trading status. (Trades re-added now are timestamped today.)' : 'Removed your public Real Trading log. Your journal is untouched.');
    };
    $('rjStats').onchange = function () { publish({ showRealStats: this.checked }); toast(this.checked ? 'Real-trade statistics are on your profile (no dollar amounts).' : 'Real-trade statistics hidden from your profile.'); };
  }

  // ------------------------------------------------------------ data
  function col() { return db.collection('users').doc(user.uid).collection('realTrades'); }
  function logRef(id) { return db.collection('traders').doc(user.uid).collection('realLog').doc(id); }
  function writeLog(id, sym) { return logRef(id).set({ sym: sym, createdAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(function () {}); }
  function add() {
    var sym = ($('rjSym').value || '').trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, ''), qty = +$('rjQty').value, entry = +$('rjEntry').value, date = $('rjEntryDate').value;
    if (!sym) return toast('Enter the ticker.', true);
    if (!(qty > 0) || !(entry > 0)) return toast('Enter the shares and your entry price.', true);
    if (!date || date > today()) return toast('The entry date can\'t be in the future.', true);
    var t = { mode: 'REAL', sym: sym, side: $('rjSide').value, qty: qty, entry: entry, entryDate: date, exit: null, exitDate: null, fees: 0, source: $('rjSource').value,
      notes: ($('rjNotes').value || '').slice(0, 300), status: 'open', createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: Date.now() };
    if ($('rjIsClosed').checked) {
      var x = +$('rjExitNew').value, xd = $('rjExitDateNew').value;
      if (!(x > 0)) return toast('Enter the exit price, or untick "Already closed".', true);
      if (!xd || xd < date || xd > today()) return toast('The exit date has to be between the entry date and today.', true);
      t.exit = x; t.exitDate = xd; t.status = 'closed';
    }
    $('rjAdd').disabled = true;
    col().add(t).then(function (ref) {
      if (trader.publicLog !== false) writeLog(ref.id, sym);
      logXp();
      if (P) P.track('analyze', sym);
      toast(tag() + ' Logged your ' + sym + ' real trade.');
    }).catch(function (e) { $('rjAdd').disabled = false; toast('Couldn\'t save: ' + esc(e.message || e), true); });
  }
  function saveClose() {
    var t = editing, x = +$('rjExit').value, xd = $('rjExitDate').value, fees = +$('rjFees').value || 0;
    if (!(x > 0)) return toast('Enter the exit price.', true);
    if (!xd || xd < t.entryDate || xd > today()) return toast('The exit date has to be between the entry date and today.', true);
    col().doc(t.id).update({ exit: x, exitDate: xd, fees: fees, status: 'closed', updatedAt: Date.now() }).then(function () {
      editing = null; toast(tag() + ' Closed ' + t.sym + ' · ' + signed(mult(t) * (x - t.entry) * t.qty - fees)); logXp();
    });
  }
  // +10 XP "Real Trading Activity" (first 3 a day)
  function logXp() {
    var d = today(), k = 'zelosRealXp', n = 0;
    try { var v = JSON.parse(localStorage.getItem(k) || '{}'); n = v.d === d ? v.n : 0; localStorage.setItem(k, JSON.stringify({ d: d, n: n + 1 })); } catch (e) {}
    if (window.ZelosXP && n < 3) ZelosXP.award('real-trade', d + ':' + (n + 1));
  }
  function publish(extra) {
    if (!traderLoaded) return Promise.resolve(); // never overwrite saved settings with defaults
    Object.keys(extra || {}).forEach(function (k) { trader[k] = extra[k]; });
    var st = stats(), doc = {
      name: String(trader.name || (user.displayName || 'Trader').split(' ')[0]).slice(0, 24), photo: user.photoURL && /^https:/.test(user.photoURL) ? user.photoURL : null,
      publicLog: trader.publicLog !== false, showRealStats: !!trader.showRealStats, updatedAt: Date.now(),
      xp: userData.xp || 0, streak: P ? P.streak() : 0,
      skills: (userData.ownedSkills || []).map(function (k) { return SKILL_NAMES[k]; }).filter(Boolean),
      realStats: trader.showRealStats ? { closed: st.closed, wins: st.wins, losses: st.losses, winRate: st.winRate, avgPct: st.avgPct == null ? null : Math.round(st.avgPct * 100) / 100, favorites: st.favorites } : null
    };
    return db.collection('traders').doc(user.uid).set(doc, { merge: true }).catch(function () {});
  }

  function signIn() { firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(function (e) { toast(esc(e.message || e), true); }); }
  function start() {
    var cfg = window.ZELOS_FIREBASE_CONFIG;
    if (!window.firebase || !cfg || !cfg.projectId) { $('rjBody').innerHTML = '<p class="pt-empty">The journal needs the live site.</p>'; return; }
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    db = firebase.firestore();
    fetch('../data/practice-universe.json').then(function (r) { return r.json(); }).then(function (u) { u.symbols.forEach(function (x) { names[x.sym] = x.name; }); }).catch(function () {});
    db.collection('markets').doc('quotes').onSnapshot(function (s) { quotes = (s.exists && s.data().quotes) || {}; if (user) render(); }, function () {});
    var unsubs = [];
    firebase.auth().onAuthStateChanged(function (u) {
      unsubs.forEach(function (f) { f(); }); unsubs = []; traderLoaded = false;
      user = u && !u.isAnonymous ? u : null;
      if (!user) { if (P) P.detach(); return render(); }
      if (P) P.attach(db, user.uid);
      unsubs.push(db.collection('users').doc(user.uid).onSnapshot(function (d) { var before = userData.xp; userData = d.exists ? d.data() : {}; if (before !== userData.xp) publish(); }, function () {}));
      unsubs.push(db.collection('traders').doc(user.uid).onSnapshot(function (d) { var first = !traderLoaded; trader = d.exists ? d.data() : {}; traderLoaded = true; render(); if (first) publish(); }, function () {}));
      unsubs.push(db.collection('traders').doc(user.uid).collection('realLog').orderBy('createdAt', 'desc').limit(500).onSnapshot(function (s) {
        logs = []; s.forEach(function (d) { var v = d.data(); logs.push({ id: d.id, sym: v.sym, at: v.createdAt && v.createdAt.toMillis ? v.createdAt.toMillis() : Date.now() }); }); render();
      }, function () {}));
      unsubs.push(col().orderBy('createdAt', 'desc').limit(500).onSnapshot(function (s) {
        trades = []; s.forEach(function (d) { var v = d.data(); v.id = d.id; trades.push(v); });
        render(); publish();
      }, function () {}));
      if (window.ZelosXP) ZelosXP.award('trading-tools', today());
    });
  }
  document.addEventListener('DOMContentLoaded', start);
})();
