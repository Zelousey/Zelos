/*!
 * Invite landing page (practice/invite.html, Mockup 15).
 *
 *   invite.html?ref=<uid>[&battle=<warId>&bn=<name>][&squad=<squadId>&sn=<name>]
 *
 * Shows who invited you ("Nate invited you to trade with $10,000"), with their public
 * profile and name color, and lets you: accept their battle, join their squad, follow
 * them, just join, make a first trade, or read how the $10,000 account works. The
 * battle / squad name in the link is only a label; the real battle or squad page does
 * every check. ?ref is captured by zelos-progress.js, so the inviter gets credit.
 */
(function () {
  'use strict';
  var d = document, Q = new URLSearchParams(location.search);
  var ID = /^[A-Za-z0-9_-]{6,128}$/;
  var REF = ID.test(Q.get('ref') || '') ? Q.get('ref') : null;
  var BATTLE = ID.test(Q.get('battle') || '') ? Q.get('battle') : null, BN = (Q.get('bn') || '').slice(0, 40);
  var SQUAD = ID.test(Q.get('squad') || '') ? Q.get('squad') : null, SN = (Q.get('sn') || '').slice(0, 32);
  var PENDING = 'zelosInviteAction';
  var user = null, inviter = { name: 'A trader' }, db = null;
  function $(id) { return d.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function act(k, icon, title, sub, main) {
    return '<button type="button" class="iv-act' + (main ? ' is-main' : '') + '" data-act="' + k + '"><span class="iv-ic" aria-hidden="true">' + icon + '</span><span><b>' + title + '</b><small>' + sub + '</small></span><em aria-hidden="true">' + (main ? '&rarr;' : '&rsaquo;') + '</em></button>';
  }
  function draw() {
    var nm = inviter.name, first = esc(nm), zn = REF ? ' data-zname="' + esc(REF) + '"' : '';
    var acts = [];
    if (BATTLE) acts.push(act('battle', '&#9876;&#65039;', 'Accept ' + first + '\'s battle', esc(BN ? '"' + BN + '"' : 'A head-to-head Trade War') + ' · virtual money', true));
    if (SQUAD) acts.push(act('squad', '&#128101;', 'Join ' + first + '\'s squad', esc(SN || 'Their Trading Squad') + ' · private leaderboard', !BATTLE));
    if (REF) acts.push(act('follow', '&#10133;', 'Follow ' + first, 'See their trades and battles'));
    acts.push(act('join', '&#128640;', user ? 'Open your $10,000 account' : 'Just join AgenticTrading', user ? 'You\'re signed in' : 'Free with Google, about 10 seconds', !BATTLE && !SQUAD));
    $('ivBody').innerHTML =
      '<div class="iv-grid"><div class="iv-left">' +
        '<div class="iv-who">' + (inviter.photo ? '<img class="iv-av" alt="" referrerpolicy="no-referrer" src="' + esc(inviter.photo) + '">' : '<span class="iv-av">' + esc(nm.replace('@', '').charAt(0).toUpperCase() || 'Z') + '</span>') +
        '<div><small class="iv-kick">YOU\'RE INVITED</small>' + (inviter.sub ? '<div class="iv-sub">' + esc(inviter.sub) + '</div>' : '') + '</div></div>' +
        '<h1><span class="iv-nm"' + zn + '>' + first + '</span> invited you to trade with $10,000</h1>' +
        '<p class="iv-lead">A free virtual account with real, live prices. Trade stocks, ETFs and crypto, battle friends, climb the leaderboard. No real money, ever.</p>' +
        '<ul class="iv-chk"><li>$10,000 virtual account, ready in seconds</li><li>Real prices, live charts, 13 indicators</li><li>Battles, squads, XP and tokens</li></ul></div>' +
      '<div class="iv-right"><div class="iv-money"><span><small>Your free virtual account</small><b>$10,000.00</b></span><span class="iv-free">FREE</span></div>' +
        '<div class="iv-acts">' + acts.join('') + '</div>' +
        '<div class="iv-mini"><button type="button" data-act="trade">&#128200; Make your first trade</button><button type="button" data-act="how">&#128181; How the $10,000 works</button></div>' +
        '<div class="iv-how" id="ivHow" hidden><p><b>It\'s virtual money.</b> Everyone starts with $10,000 that isn\'t real and can\'t be withdrawn. Prices are real and live, so wins and losses work like a real account.</p><p><b>Battles</b> give everyone the same buy-in for a set number of days; best % gain wins. Your $10,000 account is separate.</p><p>Run it down? Reset it any time. Nothing here is a real trade or investment advice.</p></div>' +
        '<div class="iv-signin" id="ivSignIn" hidden><p>Sign in to continue. It\'s free.</p><button type="button" class="iv-google" id="ivGoogle">Continue with Google</button><button type="button" class="iv-email" id="ivEmail">Use email instead</button><p class="iv-msg" id="ivMsg" role="alert"></p></div>' +
        '<p class="iv-done" id="ivDone" role="status" hidden></p></div></div>';
    if (window.ZelosTokens && ZelosTokens.paintNames) ZelosTokens.paintNames();
  }
  function msg(t) { var m = $('ivMsg'); if (m) m.textContent = t || ''; }
  function needSignIn(k) {
    try { sessionStorage.setItem(PENDING, k); } catch (e) {}
    var s = $('ivSignIn'); s.hidden = false; s.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function run(k) {
    if (k === 'how') { var h = $('ivHow'); h.hidden = !h.hidden; return; }
    if (k === 'trade') { location.href = 'index.html'; return; }
    if (!user) return needSignIn(k);
    try { sessionStorage.removeItem(PENDING); } catch (e) {}
    if (window.ZelosSocial && ZelosSocial.init && ZelosSocial.init()) ZelosSocial.claimReferral(user);
    if (k === 'battle') location.href = 'war.html?w=' + encodeURIComponent(BATTLE);
    else if (k === 'squad') location.href = 'squads.html?s=' + encodeURIComponent(SQUAD);
    else if (k === 'join') location.href = 'index.html';
    else if (k === 'follow') {
      if (REF === user.uid) { done('That\'s your own invite link.'); return; }
      (window.ZelosSocial && ZelosSocial.addFriend ? ZelosSocial.addFriend(REF) : Promise.reject()).then(function () {
        done('You follow ' + inviter.name + ' now. <a href="profile.html?u=' + encodeURIComponent(REF) + '">See their profile</a>');
      }, function () { done('Couldn\'t follow right now. Try again.'); });
    }
  }
  function done(h) { var el = $('ivDone'); el.innerHTML = h; el.hidden = false; }
  function loadInviter() {
    if (!REF || !db) return Promise.resolve();
    return Promise.all([db.collection('traders').doc(REF).get(), db.collection('practiceProfiles').doc(REF).get()]).then(function (r) {
      var t = r[0].exists ? r[0].data() : {}, p = r[1].exists ? r[1].data() : {};
      inviter.name = t.username ? '@' + t.username : (t.name || p.displayName || 'A trader');
      var ph = t.avatar || t.photo || p.photo; if (ph && /^(https:|data:image\/(jpeg|png|webp);base64,)/.test(ph)) inviter.photo = ph;
      var L = window.ZelosLevels, lv = L && p.xp != null ? L.levelForXp(p.xp) : null;
      inviter.sub = [lv ? 'Level ' + lv.level + ' · ' + lv.name : '', p.equity ? 'Account $' + Math.round(p.equity).toLocaleString('en-US') : ''].filter(Boolean).join(' · ');
    }).catch(function () {});
  }
  function boot() {
    var cfg = window.ZELOS_FIREBASE_CONFIG;
    draw();
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (b) { run(b.getAttribute('data-act')); return; }
      if (e.target.id === 'ivGoogle') { msg(''); if (window.ZelosSignIn) ZelosSignIn.google(msg); }
      if (e.target.id === 'ivEmail') { var g = $('getStartedBtn'); if (g) setTimeout(function () { g.click(); }, 0); }
    });
    if (!window.firebase || !cfg || !cfg.projectId) return;
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    db = firebase.firestore();
    if (window.ZelosSignIn) ZelosSignIn.finish(msg);
    loadInviter().then(draw);
    firebase.auth().onAuthStateChanged(function (u) {
      user = u && !u.isAnonymous ? u : null; draw();
      var k = null; try { k = sessionStorage.getItem(PENDING); } catch (e) {}
      if (user && k) run(k); // finish what they picked before signing in
    });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})();
