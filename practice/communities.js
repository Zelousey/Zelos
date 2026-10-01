/*!
 * Zelos Founder Program: communities (practice/communities.html).
 *
 *   communities.html          trending communities, the biggest, browse by state,
 *                             your community, and "start a community"
 *   communities.html?c=<cid>  one community: members, XP, leaderboard, the
 *                             founder's milestones and the invite link
 *
 * Everything that changes a community goes through Cloud Functions
 * (community_create / community_join / community_leave in functions/main.py),
 * which decide who counts toward the founder's milestones and pay the tokens.
 * This page only reads communities/{cid} (+ members) and your own
 * communityMembers/{uid}.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { return (+v || 0).toLocaleString('en-US'); }
  function body(h) { $('cmBody').innerHTML = h; }
  var STATES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
    FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
    MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
    NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
    PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
    WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };
  // Same milestones as FOUNDER_TIERS in functions/main.py
  var TIERS = [[5, 250, 'Founder', '🏛️'], [10, 150, 'Rising Founder', '⭐'], [25, 400, 'Community Builder', '🏗️'], [50, 750, 'Community Leader', '🛡️'], [100, 1500, 'Legendary Founder', '🏆']];
  var SITE = 'https://agentictrading.info/practice/communities.html';

  function db() { return firebase.firestore(); }
  function T() { return window.ZelosTokens; }
  function errText(e) { return String((e && e.message) || e || 'Something went wrong.').replace(/^FirebaseError: /, ''); }
  function signIn() {
    var msg = $('cmAuthMsg'), show = function (t) { if (msg) { msg.textContent = t; msg.hidden = false; } };
    if (window.ZelosSignIn) return ZelosSignIn.google(show);
    firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(function (e) { show(e.message || e); });
  }
  var AUTH = '<p class="pt-auth-msg" id="cmAuthMsg" role="alert" hidden></p>';
  // ISO week of today in New York, the same key the server counts joins under (weeks.wYYYYWW)
  function weekKey() {
    var day; try { day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); } catch (e) { day = new Date().toISOString().slice(0, 10); }
    var p = day.split('-').map(Number), dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    dt.setUTCDate(dt.getUTCDate() + 3 - ((dt.getUTCDay() + 6) % 7));
    var y = dt.getUTCFullYear(), w = Math.ceil(((dt - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
    return 'w' + y + (w < 10 ? '0' : '') + w;
  }
  function next(counted) { for (var i = 0; i < TIERS.length; i++) if (counted < TIERS[i][0]) return TIERS[i]; return null; }
  function tierRow(c) {
    var n = next(c.counted || 0), prev = 0;
    TIERS.forEach(function (t) { if ((c.counted || 0) >= t[0]) prev = t[0]; });
    if (!n) return '<div class="cm-prog"><div class="cm-bar"><i style="width:100%"></i></div><small>Every milestone reached. Legendary.</small></div>';
    var pct = Math.round(((c.counted || 0) - prev) / (n[0] - prev) * 100);
    return '<div class="cm-prog"><div class="cm-bar"><i style="width:' + pct + '%"></i></div><small><b>' + (n[0] - (c.counted || 0)) + '</b> more real member' + (n[0] - (c.counted || 0) === 1 ? '' : 's') + ' to ' + n[3] + ' ' + n[2] + ' (+' + num(n[1]) + ' tokens for the founder)</small></div>';
  }
  function card(c, sub) {
    return '<a class="cm-card" href="?c=' + encodeURIComponent(c.id) + '"><b>' + esc(c.name) + '</b><span class="cm-state">' + esc(STATES[c.state] || c.state) + '</span>' +
      '<span class="cm-nums"><span>👥 ' + num(c.members) + '</span><span>⚡ ' + num(c.xp) + ' XP</span>' + (c.title ? '<span class="cm-title">' + esc(c.title) + '</span>' : '') + '</span>' +
      (sub ? '<small>' + sub + '</small>' : '') + '</a>';
  }
  function list(q, empty, sub) {
    return q.get().then(function (s) {
      var rows = []; s.forEach(function (x) { rows.push(Object.assign({ id: x.id }, x.data())); });
      return rows.length ? '<div class="cm-grid">' + rows.map(function (c) { return card(c, sub && sub(c)); }).join('') + '</div>' : '<p class="pt-empty">' + empty + '</p>';
    }).catch(function () { return '<p class="pt-empty">Couldn\'t load communities.</p>'; });
  }
  function myMembership(user) {
    if (!user) return Promise.resolve(null);
    return db().collection('communityMembers').doc(user.uid).get().then(function (s) { return s.exists ? s.data() : null; }).catch(function () { return null; });
  }

  // ------------------------------------------------------------ hub
  function hub(user) {
    var wk = weekKey();
    var h = '<div class="ch-hero"><span class="pt-kicker">Founder Program</span><h1>Start a community. Earn tokens as it grows.</h1>' +
      '<p>Pick a name and your state (no school or workplace needed), share your invite link, and get real traders to join. At 5 members you become an official <b>Founder</b>, with a big token reward and a permanent Founder badge.</p></div>' +
      '<div class="pt-card ch-card"><h2>Founder milestones</h2><div class="cm-tiers">' + TIERS.map(function (t) {
        return '<div class="cm-tier"><span class="cm-ico">' + t[3] + '</span><b>' + t[0] + (t[0] === 100 ? '+' : '') + ' members</b><span>' + esc(t[2]) + '</span><small>+' + num(t[1]) + ' tokens</small></div>';
      }).join('') + '</div><p class="pt-fine">Only real, unique members count: a verified account (Google sign-in or a verified email), active on 2 different days after joining, never counted for another community, and not on the same network as the founder or another counted member. Your own extra accounts never count.</p></div>' +
      '<div id="cmMine"></div>' +
      '<div class="pt-card ch-card"><h2>🔥 Trending this week</h2><div id="cmTrend"><p class="pt-empty">Loading…</p></div></div>' +
      '<div class="pt-card ch-card"><h2>Biggest communities</h2><div id="cmTop"><p class="pt-empty">Loading…</p></div></div>' +
      '<div class="pt-card ch-card"><h2>Communities by state</h2><select id="cmState" class="cm-select" aria-label="State"><option value="">Pick a state</option>' +
      Object.keys(STATES).map(function (k) { return '<option value="' + k + '">' + esc(STATES[k]) + '</option>'; }).join('') + '</select><div id="cmByState"></div></div>';
    body(h);
    list(db().collection('communities').orderBy('weeks.' + wk, 'desc').limit(6), 'No new members anywhere yet this week. Start a community and be the first on this list.',
      function (c) { var n = (c.weeks || {})[wk] || 0; return '+' + n + ' joined this week'; }).then(function (x) { $('cmTrend').innerHTML = x; });
    list(db().collection('communities').orderBy('members', 'desc').limit(9), 'No communities yet. Start the first one.').then(function (x) { $('cmTop').innerHTML = x; });
    $('cmState').onchange = function () {
      var st = this.value; if (!st) { $('cmByState').innerHTML = ''; return; }
      $('cmByState').innerHTML = '<p class="pt-empty">Loading…</p>';
      db().collection('communities').where('state', '==', st).limit(60).get().then(function (s) {
        var rows = []; s.forEach(function (x) { rows.push(Object.assign({ id: x.id }, x.data())); });
        rows.sort(function (a, b) { return (b.members || 0) - (a.members || 0); });
        $('cmByState').innerHTML = rows.length ? '<div class="cm-grid">' + rows.map(function (c) { return card(c); }).join('') + '</div>' : '<p class="pt-empty">No communities in ' + esc(STATES[st]) + ' yet. Start one!</p>';
      }).catch(function () { $('cmByState').innerHTML = '<p class="pt-empty">Couldn\'t load communities.</p>'; });
    };
    mine(user);
  }
  function mine(user) {
    var box = $('cmMine'); if (!box) return;
    if (!user) { box.innerHTML = '<div class="pt-card ch-card"><h2>Start your community</h2><button class="pt-btn pt-btn-go" type="button" id="cmSignIn">Sign in with Google</button>' + AUTH + '<p class="pt-fine">Communities use your signed-in Zelos account.</p></div>'; $('cmSignIn').onclick = signIn; return; }
    myMembership(user).then(function (m) {
      if (m && m.cid) {
        return db().collection('communities').doc(m.cid).get().then(function (s) {
          var c = s.exists ? Object.assign({ id: s.id }, s.data()) : null;
          box.innerHTML = c ? '<div class="pt-card ch-card"><h2>' + (m.founded === m.cid ? 'Your community (you founded it)' : 'Your community') + '</h2>' + card(c) + (m.founded === m.cid ? tierRow(c) : '') + '</div>' : '';
        });
      }
      box.innerHTML = '<div class="pt-card ch-card"><h2>Start a community</h2>' + (m && m.founded ? '<p class="pt-fine">You already founded a community.</p>' :
        '<div class="cm-form"><input id="cmName" maxlength="30" placeholder="Community name, e.g. Zelos Clan" aria-label="Community name"><select id="cmNewState" class="cm-select" aria-label="Your state"><option value="">Your state</option>' +
        Object.keys(STATES).map(function (k) { return '<option value="' + k + '">' + esc(STATES[k]) + '</option>'; }).join('') + '</select><button class="pt-btn pt-btn-go" type="button" id="cmCreate">Create</button></div>' +
        '<p class="pt-fine" id="cmMsg"></p><p class="pt-fine">Example: <b>Zelos Clan</b>, Connecticut. Get 5 real members through your invite link and you\'re an official Founder.</p>') + '</div>';
      var b = $('cmCreate'); if (!b) return;
      b.onclick = function () {
        b.disabled = true; $('cmMsg').textContent = 'Creating…';
        T().call('community_create', { name: $('cmName').value, state: $('cmNewState').value }).then(function (r) { location.search = '?c=' + encodeURIComponent(r.cid); },
          function (e) { b.disabled = false; $('cmMsg').textContent = errText(e); });
      };
    });
  }

  // ------------------------------------------------------------ one community
  function one(cid, user) {
    var ref = db().collection('communities').doc(cid);
    Promise.all([ref.get(), myMembership(user)]).then(function (r) {
      var s = r[0], m = r[1] || {};
      if (!s.exists) { body('<div class="pt-card ch-card"><h2>Community not found</h2><p class="pt-empty">This link doesn\'t match a community. <a href="communities.html">See all communities</a>.</p></div>'); return; }
      var c = Object.assign({ id: s.id }, s.data()), member = m.cid === cid, founder = user && c.founder === user.uid;
      var link = SITE + '?c=' + encodeURIComponent(cid);
      document.title = c.name + ' · ' + (STATES[c.state] || c.state) + ' | Zelos Communities';
      var h = '<div class="ch-hero cm-hero"><span class="pt-kicker">Community · ' + esc(STATES[c.state] || c.state) + '</span><h1>' + esc(c.name) + '</h1>' +
        '<p>Founded by <span id="cmFounder">' + esc(c.founderName || 'a trader') + '</span>' + (c.title ? ' · <b>' + esc(c.title) + '</b>' : '') + '</p></div>' +
        '<div class="pt-perf cm-stats">' + [['Members', num(c.members)], ['Community XP', num(c.xp)], ['Real members counted', num(c.counted)], ['Joined this week', num((c.weeks || {})[weekKey()] || 0)]]
          .map(function (x) { return '<span><small>' + x[0] + '</small><b>' + x[1] + '</b></span>'; }).join('') + '</div>' +
        '<div class="pt-card ch-card"><h2>Founder milestones</h2>' + tierRow(c) + '<div class="cm-tiers is-small">' + TIERS.map(function (t) {
          var got = (c.rewarded || []).indexOf(t[0]) !== -1;
          return '<div class="cm-tier' + (got ? ' is-got' : '') + '"><span class="cm-ico">' + t[3] + '</span><b>' + t[0] + '</b><span>' + esc(t[2]) + '</span>' + (got ? '<small>Unlocked ✓</small>' : '<small>+' + num(t[1]) + '</small>') + '</div>';
        }).join('') + '</div></div>';
      // join / invite / leave
      h += '<div class="pt-card ch-card" id="cmAct">';
      if (!user) h += '<h2>Join ' + esc(c.name) + '</h2><button class="pt-btn pt-btn-go" type="button" id="cmSignIn">Sign in with Google to join</button>' + AUTH;
      else if (!member) h += '<h2>Join ' + esc(c.name) + '</h2><button class="pt-btn pt-btn-go" type="button" id="cmJoin">Join this community</button><p class="pt-fine" id="cmMsg"></p>';
      else h += '<h2>' + (founder ? 'Invite real traders' : 'Invite friends') + '</h2><div class="pt-invite"><input id="cmLink" readonly value="' + esc(link) + '" aria-label="Invite link"><button class="pt-btn pt-btn-go" type="button" id="cmCopy">Copy link</button>' +
        (navigator.share ? '<button class="pt-btn" type="button" id="cmShare">Share</button>' : '') + '</div><p class="pt-fine" id="cmMsg"></p>' +
        (founder ? '<p class="pt-fine">A new member counts once they\'ve been active (checked in) on 2 different days. Their account must be verified and on a different network from yours.</p>'
          : '<p class="pt-fine">You\'re a member' + (m.counted ? ' and you count toward the founder\'s milestones ✓' : '. Come back on another day so you count toward the founder\'s milestones.') + ' <button class="pt-mini" type="button" id="cmLeave">Leave</button></p>');
      h += '</div><div class="pt-card ch-card"><h2>Leaderboard <small class="pt-fine">by XP</small></h2><div id="cmBoard"><p class="pt-empty">Loading…</p></div></div>' +
        '<p class="pt-fine"><a href="communities.html">&larr; All communities</a></p>';
      body(h);
      if ($('cmSignIn')) $('cmSignIn').onclick = signIn;
      if ($('cmJoin')) $('cmJoin').onclick = function () { join(cid, false); };
      if ($('cmCopy')) $('cmCopy').onclick = function () { var i = $('cmLink'); i.select(); try { navigator.clipboard.writeText(i.value); } catch (e) { document.execCommand('copy'); } $('cmMsg').textContent = 'Link copied. Send it to friends who trade.'; };
      if ($('cmShare')) $('cmShare').onclick = function () { navigator.share({ title: 'Join ' + c.name + ' on Zelos', text: 'Join my trading community ' + c.name + ' on Zelos', url: link }).catch(function () {}); };
      if ($('cmLeave')) $('cmLeave').onclick = function () {
        if (!confirm('Leave ' + c.name + '?')) return;
        T().call('community_leave').then(function () { location.reload(); }, function (e) { $('cmMsg').textContent = errText(e); });
      };
      var tk = T(); if (tk) tk.look(c.founder).then(function (lk) { var el = $('cmFounder'); if (el) el.innerHTML = tk.nameHtml(c.founderName || 'a trader', lk); });
      board(ref, user);
    });
  }
  function join(cid, sw) {
    var b = $('cmJoin'); if (b) b.disabled = true; $('cmMsg').textContent = 'Joining…';
    T().call('community_join', { cid: cid, 'switch': sw }).then(function () { location.reload(); }, function (e) {
      var t = errText(e);
      if (t.indexOf('SWITCH:') === 0) { if (confirm(t.slice(7))) return join(cid, true); t = 'You stayed in your current community.'; }
      if (b) b.disabled = false; $('cmMsg').textContent = t;
    });
  }
  function board(ref, user) {
    ref.collection('members').orderBy('xp', 'desc').limit(50).get().then(function (s) {
      var rows = []; s.forEach(function (x) { rows.push(Object.assign({ uid: x.id }, x.data())); });
      if (!rows.length) { $('cmBoard').innerHTML = '<p class="pt-empty">No members yet.</p>'; return; }
      $('cmBoard').innerHTML = '<div class="sq-board">' + rows.map(function (r, i) {
        return '<a class="sq-row cm-row' + (user && r.uid === user.uid ? ' is-me' : '') + '" href="profile.html?u=' + encodeURIComponent(r.uid) + '"><span class="sq-rank">' + (i + 1) + '</span>' +
          '<span class="sq-name" data-uid="' + esc(r.uid) + '">' + esc(r.name || 'Trader') + '</span>' +
          '<span class="cm-tag">' + (r.founder ? 'Founder' : r.counted ? '✓ counted' : 'new') + '</span><span class="sq-xp">' + num(r.xp) + ' XP</span></a>';
      }).join('') + '</div>';
      var tk = T(); if (!tk) return;
      rows.forEach(function (r) {
        tk.look(r.uid).then(function (lk) { var el = document.querySelector('.cm-row [data-uid="' + r.uid.replace(/"/g, '') + '"]'); if (el) el.innerHTML = tk.nameHtml(r.name || 'Trader', lk); });
      });
    }).catch(function () { $('cmBoard').innerHTML = '<p class="pt-empty">Couldn\'t load the leaderboard.</p>'; });
  }

  function boot() {
    if (!window.firebase || !firebase.apps) return;
    try { if (!firebase.apps.length) firebase.initializeApp(window.ZELOS_FIREBASE_CONFIG); } catch (e) {}
    var cid = new URLSearchParams(location.search).get('c'), first = true, last;
    firebase.auth().onAuthStateChanged(function (u) {
      var user = u && !u.isAnonymous ? u : null, key = user ? user.uid : '';
      if (!first && key === last) return;
      first = false; last = key;
      if (cid) one(cid, user); else hub(user);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
