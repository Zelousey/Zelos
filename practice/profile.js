/*!
 * Zelos Practice Account: public profile (practice/profile.html?u=<uid>).
 * Reads practiceProfiles/{uid}, the public summary the practice page publishes
 * for signed-in players who keep "Show my stats on the leaderboard" on.
 * Holds display name and trading numbers only, never email or login details.
 */
(function () {
  'use strict';
  var START = 10000;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(v) { return (v < 0 ? '-$' : '$') + Math.abs(+v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function signed(v) { return (v >= 0 ? '+' : '-') + money(Math.abs(v)); }
  function pct(v) { return (v >= 0 ? '+' : '') + (+v || 0).toFixed(2) + '%'; }
  function px(v) { return v == null ? '–' : (+v).toFixed(2); }
  function cls(v) { return v >= 0 ? 'up' : 'dn'; }
  function day(d) { if (!d) return '–'; try { return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return d; } }

  // One trader identity; Real Trading (REAL) and Trade War (PRACTICE) side by side, never combined.
  //   p     practiceProfiles/{uid}  Trade War (virtual) numbers, or null
  //   t     traders/{uid}           identity + opt-in real-trade statistics, or null
  //   logs  traders/{uid}/realLog   server-timestamped real-trade log → Real Trading status
  function show(p, uid, mine, t, logs) {
    var war = !!p; p = p || {}; t = t || {};
    var eq = +p.equity || START, g = p.growthPct != null ? p.growthPct : (eq / START - 1) * 100;
    var best = (p.bestTrades || [])[0], name = (t.username && t.name) || p.name || t.name || 'Trader', photo = t.avatar || p.photo || t.photo;
    var xp = Math.max(p.xp || 0, t.xp || 0), streak = Math.max(p.streak || 0, t.streak || 0);
    var since = p.since ? new Date(p.since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;
    document.title = name + ' · Trader profile | Zelos';
    var L = window.ZelosLevels, lv = L ? L.levelForXp(xp) : null, P = window.ZelosProgress, S = window.ZelosSocial, M = window.ZelosModes;
    var tier = S && p.referrals ? S.referralTier(p.referrals) : null, rs = M ? M.realStatus(logs || []) : null, rst = t.showRealStats && t.realStats ? t.realStats : null;
    var favs = {}; (logs || []).forEach(function (l) { favs[l.sym] = (favs[l.sym] || 0) + 1; });
    var favList = Object.keys(favs).sort(function (a2, b2) { return favs[b2] - favs[a2]; }).slice(0, 5);
    // header: picture + level badge beside the name; bio, tags, buttons and tokens full width below
    var h = '<div class="pf-head"><div class="pf-id"><div class="pf-pics">' + (photo ? '<img class="pf-photo" src="' + esc(photo) + '" alt="" referrerpolicy="no-referrer">' : '') + (L && lv ? '<span class="pf-badge">' + L.badge(lv, photo ? 40 : 64) + '</span>' : '') + '</div>' +
      '<div class="pf-name"><span class="pt-kicker">' + (mine ? 'Your public profile' : 'Trader profile') + '</span>' +
      '<h1>' + esc(name) + '</h1>' + (t.username ? '<p class="pf-handle">@' + esc(t.username) + '</p>' : '') + '</div><div class="pf-rest">' +
      (t.bio ? '<p class="pf-bio">' + esc(t.bio) + '</p>' : (mine && !t.username ? '<p class="pf-bio pt-fine">Add a picture, @username and bio so friends can find you.</p>' : '')) +
      '<div class="pf-tags">' + (lv ? '<span><b>Level ' + lv.level + '</b> ' + esc(lv.name) + '</span><span>' + xp.toLocaleString('en-US') + ' XP</span>' : '') +
      (streak ? '<span>🔥 ' + streak + '-day streak</span>' : '') + (tier ? '<span>' + tier.icon + ' ' + tier.name + ' recruiter</span>' : '') +
      (since ? '<span>Since ' + since + '</span>' : '') + '</div>' +
      '<div class="pf-ident">' + (rs && rs.trades ? '<span class="zm-tag is-real">Real Trading: ' + esc(rs.short) + '</span>' : '') +
      (war ? '<span class="zm-tag is-war">Trade War: ' + money(eq) + '</span>' : '') +
      (war ? '<span class="pf-count">' + (p.virtualTrades != null ? p.virtualTrades : p.trades || 0) + ' virtual trades</span>' : '') +
      (rs && rs.trades ? '<span class="pf-count">' + rs.trades + ' real trades</span>' : '') + '</div>' +
      '<div class="pf-actions" id="pfActions"></div></div></div></div>';
    // ---- trading status: two environments, separate numbers
    h += '<div class="pf-modes"><section class="pt-card pf-card pf-mode is-real"><h2>Real Trading <span class="zm-tag is-real">REAL</span></h2>';
    if (rs && rs.trades) {
      h += '<div class="pf-real-status is-' + rs.id + '"><b>' + esc(rs.label) + '</b><small>' + esc(rs.detail) + '</small></div>' +
        '<div class="pf-mini">' + [['Real trades logged', rs.trades], ['Active days', rs.days], ['Last 30 days', rs.recent]].map(function (r) { return '<span><small>' + r[0] + '</small><b>' + r[1] + '</b></span>'; }).join('') + '</div>' +
        (favList.length ? '<p class="pf-favs"><small>Favorite stocks</small>' + favList.map(function (sy) { return '<b>' + esc(sy) + '</b>'; }).join('') + '</p>' : '') +
        ((t.skills || []).length ? '<p class="pf-favs"><small>Trading skills</small>' + t.skills.map(function (k) { return '<b>' + esc(k) + '</b>'; }).join('') + '</p>' : '') +
        (rst ? '<div class="pf-mini">' + [['Closed real trades', rst.closed], ['Win rate', rst.winRate == null ? '–' : rst.winRate + '%'], ['Wins / losses', (rst.wins || 0) + ' / ' + (rst.losses || 0)],
          ['Avg per trade', rst.avgPct == null ? '–' : '<span class="' + cls(rst.avgPct) + '">' + pct(rst.avgPct) + '</span>']].map(function (r) { return '<span><small>' + r[0] + '</small><b>' + r[1] + '</b></span>'; }).join('') + '</div>' +
          '<p class="pt-fine">Real-trade statistics are self-reported by ' + esc(name) + ' from their Real Trade Journal.</p>'
          : '<p class="pt-fine">' + (mine ? 'Your real-trade statistics are hidden. Turn them on in the <a href="../real/">Real Trade Journal</a>.' : 'Real-trade statistics are private.') + '</p>');
    } else h += '<p class="pt-empty">' + (mine ? 'No real trades logged yet. Log the trades you make at your broker in the <a href="../real/">Real Trade Journal</a>.' : 'No Real Trading activity yet.') + '</p>';
    h += '</section><section class="pt-card pf-card pf-mode is-war"><h2>Trade War <span class="zm-tag is-war">VIRTUAL</span></h2>';
    if (war) {
      h += '<div class="pf-war-bal"><b>' + money(eq) + '</b><span class="' + cls(g) + '">' + pct(g) + ' growth</span></div>' +
        '<div class="pf-mini">' + [['Virtual trades', p.virtualTrades != null ? p.virtualTrades : p.trades || 0], ['Trade War streak', p.tradeStreak ? '🔥 ' + p.tradeStreak + ' day' + (p.tradeStreak === 1 ? '' : 's') : '–'],
          ['Biggest virtual win', best ? '<span class="up">' + signed(best.pnl) + '</span> ' + esc(best.sym) : '–'], ['Net P&amp;L', p.netPnl != null ? '<span class="' + cls(p.netPnl) + '">' + signed(p.netPnl) + '</span>' : '–']]
          .map(function (r) { return '<span><small>' + r[0] + '</small><b>' + r[1] + '</b></span>'; }).join('') + '</div>' +
        '<p class="pt-fine">Virtual money from a $10,000 start. Never combined with real trading.</p>';
    } else h += '<p class="pt-empty">' + (mine ? 'Not in Trade War yet. <a href="./">Enter Trade War</a> for a $10,000 virtual account.' : 'Not playing Trade War, or their Trade War stats are private.') + '</p>';
    h += '</section></div>';
    if (!war) { $('pfBody').innerHTML = h + achievementsHtml(p, P); actions(p, uid, mine, name); return; }
    h += '<h2 class="pf-section">Trade War details <span class="zm-tag is-war">TRADE WAR — VIRTUAL</span></h2>';
    h += '<div class="pt-perf pf-stats">' + [
      ['Starting balance', money(p.start || START)], ['Growth', '<span class="' + cls(g) + '">' + pct(g) + '</span>'],
      ['Net P&amp;L <small title="Growth actually traded: resets never count as gains">excl. resets</small>', p.netPnl != null ? '<span class="' + cls(p.netPnl) + '">' + signed(p.netPnl) + '</span>' : '–'],
      ['Best win streak', p.winStreakBest || 0],
      ['Peak balance', money(p.peakEquity || eq)], ['Resets', p.resets || 0],
      ['Closed trades', p.trades || 0], ['Wins / losses', (p.wins || 0) + ' / ' + (p.losses || 0)],
      ['Win rate', p.trades ? (p.winRate || 0) + '%' : '–'], ['Realized P&amp;L', '<span class="' + cls(p.realized || 0) + '">' + signed(p.realized || 0) + '</span>'],
      ['Avg win', p.wins ? '<span class="up">' + signed(p.avgWin || 0) + '</span>' : '–'], ['Avg loss', p.losses ? '<span class="dn">' + signed(p.avgLoss || 0) + '</span>' : '–']
    ].map(function (r) { return '<span><small>' + r[0] + '</small><b>' + r[1] + '</b></span>'; }).join('') + '</div>';
    if (best) {
      h += '<section class="pf-best"><span class="pf-best-tag">&#9733; Best trade</span><div class="pf-best-main"><b>' + esc(best.label || best.sym) + '</b>' +
        '<span class="up">' + signed(best.pnl) + ' <small>(' + pct(best.pct) + ')</small></span></div>' +
        '<div class="pf-best-row"><span>Invested <b>' + money(best.invested) + '</b></span><span>Entry <b>' + px(best.entry) + '</b></span><span>Exit <b>' + px(best.exit) + '</b></span>' +
        '<span>' + (best.openDay ? day(best.openDay) + ' &rarr; ' : 'Closed ') + day(best.closeDay) + '</span></div></section>';
    }
    h += achievementsHtml(p, P);
    h += '<div class="pf-cols"><section class="pt-card pf-card"><h2>Biggest winning trades</h2>' + ((p.bestTrades || []).length
      ? '<div class="pt-table-wrap"><table class="pt-table"><thead><tr><th>Ticker</th><th>Invested</th><th>Profit</th><th>Gain</th><th>Entry</th><th>Exit</th><th>Dates</th></tr></thead><tbody>' +
        p.bestTrades.map(function (t, i) {
          return '<tr' + (i === 0 ? ' class="pf-top"' : '') + '><td><b>' + esc(t.label || t.sym) + '</b></td><td>' + money(t.invested) + '</td><td class="up">' + signed(t.pnl) + '</td><td class="up">' + pct(t.pct) + '</td>' +
            '<td>' + px(t.entry) + '</td><td>' + px(t.exit) + '</td><td><small>' + (t.openDay ? day(t.openDay) + ' → ' : '') + day(t.closeDay) + '</small></td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<p class="pt-empty">No winning trades closed yet.</p>') + '</section>';
    h += '<section class="pt-card pf-card"><h2>Most traded</h2>' + ((p.mostTraded || []).length
      ? '<ol class="pf-top-stocks">' + p.mostTraded.map(function (s) { return '<li><b>' + esc(s.sym) + '</b> <small>' + s.trades + ' trade' + (s.trades === 1 ? '' : 's') + '</small><span class="' + cls(s.pnl) + '">' + signed(s.pnl) + '</span></li>'; }).join('') + '</ol>'
      : '<p class="pt-empty">No closed trades yet.</p>') +
      '<h2>Top stocks by realized profit</h2>' + ((p.topStocks || []).length
      ? '<ol class="pf-top-stocks">' + p.topStocks.map(function (s) { return '<li><b>' + esc(s.sym) + '</b><span class="up">' + signed(s.pnl) + '</span></li>'; }).join('') + '</ol>'
      : '<p class="pt-empty">Shows up once a stock closes in profit.</p>') +
      '<h2>Reset history</h2>' + ((p.resetHistory || []).length
      ? '<table class="pt-table"><tbody>' + p.resetHistory.slice().reverse().map(function (r, k) { return '<tr><td>#' + (p.resetHistory.length - k) + '</td><td>' + day(r.day) + '</td><td>Reset from ' + money(r.equityBefore) + '</td></tr>'; }).join('') + '</tbody></table>'
      : '<p class="pt-empty">Never reset. Still on the first $10,000.</p>') + '</section></div>';
    $('pfBody').innerHTML = h;
    actions(p, uid, mine, name);
  }
  function achievementsHtml(p, P) {
    if (!P) return '';
    var got = p.achievements || [], groups = {};
    got.forEach(function (id) { var a = P.achievement(id); if (a) (groups[a.group] = groups[a.group] || []).push(a); });
    return '<section class="pt-card pf-card pf-achs-card"><h2>Achievements <small>' + got.length + ' of ' + P.ACHIEVEMENTS.length + '</small></h2>' +
      (got.length ? Object.keys(groups).map(function (g) {
        var warGroup = /Trading|Milestones|Seasons/.test(g);
        return '<div class="pt-subhead">' + esc(g) + (warGroup ? ' <span class="zm-tag is-war">TRADE WAR</span>' : '') + '</div><div class="pf-achs">' +
          groups[g].map(function (a) { return '<span class="pf-ach">' + P.badge(a.id, 38) + '<span><b>' + esc(a.label) + '</b><small>' + esc(a.desc) + '</small></span></span>'; }).join('') + '</div>';
      }).join('') : '<p class="pt-empty">No achievements yet.</p>') + '</section>';
  }
  // Your own profile: token balance and passes (private: only you see this card)
  var SCAN = { 'swing-trader': 'Swing Trader', 'breakout-rider': 'Breakout Rider', 'options-scanner': 'Options Scanner' };
  function tokensCard(box) {
    var T = window.ZelosTokens; if (!T) return;
    var el = document.getElementById('pfTokens');
    if (!el) {
      el = document.createElement('section'); el.id = 'pfTokens'; el.className = 'pt-card ch-card pf-tokens';
      var grid = box.closest && box.closest('.pf-id'); // header grid: its own column on desktop, full width on phones
      if (grid) grid.appendChild(el); else box.parentNode.insertBefore(el, box.nextSibling);
    }
    var draw = function (w) {
      var passes = Object.keys((w && w.passes) || {}).filter(function (k) { return w.passes[k] > Date.now(); });
      el.innerHTML = '<div class="pf-tk-top"><div><small>Your tokens <span class="pf-tk-private">only you can see this</span></small><b><i class="twh-coin" aria-hidden="true"></i>' + (w ? w.balance : '…') + '</b></div>' +
        '<div class="pf-tk-acts"><button class="pt-mini pt-soc" type="button" id="pfTkWallet">Wallet &amp; history</button><button class="pt-mini pt-soc" type="button" id="pfTkLooks">Profile looks</button><a class="pt-mini" href="../tokens.html">Get tokens &amp; passes</a></div></div>' +
        '<p class="pt-fine">' + (passes.length ? 'Active passes: ' + passes.map(function (k) { return '<b>' + esc(SCAN[k] || k) + '</b> until ' + new Date(w.passes[k]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }).join(' · ')
          : 'No active scanner pass. Live alerts unlock with tokens; after the 4:00 pm ET close they\'re 3 tokens, then free once the trade finishes.') + '</p>';
      el.querySelector('#pfTkWallet').onclick = function () { T.open(); };
      el.querySelector('#pfTkLooks').onclick = function () { T.shop(); };
    };
    if (!tokensCard.hooked) { tokensCard.hooked = true; T.onChange(draw); }
    draw(T.wallet());
  }
  // Profile looks bought with tokens (cosmetics/{uid}): name color, badge, banner, Founder title, community
  function looks(uid, name, mine) {
    var T = window.ZelosTokens, h1 = document.querySelector('.pf-head h1'); if (!T || !h1) return;
    T.look(uid).then(function (lk) {
      h1.innerHTML = T.nameHtml(name, lk);
      var head = document.querySelector('.pf-head'), bg = T.bannerCss(lk), old = document.querySelector('.pf-banner');
      if (old) old.remove();
      if (bg && head) { var b = document.createElement('div'); b.className = 'pf-banner'; b.style.background = bg; head.parentNode.insertBefore(b, head); }
      var tags = document.querySelector('.pf-tags'), c = lk.community;
      if (tags && c && c.cid && !tags.querySelector('.pf-comm')) tags.insertAdjacentHTML('beforeend', '<a class="pf-comm" href="communities.html?c=' + encodeURIComponent(c.cid) + '">🏘️ ' + esc(c.name) + ' · ' + esc(c.state) + '</a>');
    });
    if (mine && !looks.hooked) { looks.hooked = true; T.onLook(function () { looks(uid, name, mine); }); }
  }
  // Share profile · Challenge this trader · Add friend (social actions need a signed-in account)
  function actions(p, uid, mine, name) {
    looks(uid, name, mine);
    var S = window.ZelosSocial, box = $('pfActions'); if (!S || !box) return;
    var link = S.links(uid).profile(uid), meUser = S.me();
    var war = p.equity != null;
    var h = '<button class="pt-mini pt-soc" type="button" data-a="share">Share profile</button>';
    if (!mine) h += (window.ZelosChallenge ? '<button class="pt-mini pt-soc" type="button" data-a="challenge">⚔️ Challenge to a Trade War</button>' : '') + '<button class="pt-mini" type="button" data-a="friend">+ Add friend</button>';
    else h = '<details class="pf-edit"><summary class="pt-mini pt-soc">Edit profile &#9662;</summary><div class="pf-edit-menu">' +
      '<button type="button" data-a="edit">Picture, name, @username &amp; bio</button>' +
      '<label><input type="checkbox" data-a="help"' + (window.ZelosProfile && ZelosProfile.help.on() ? ' checked' : '') + '> Help Mode (tips around the site)</label>' +
      '<a href="index.html?tab=progress">XP, missions &amp; badges</a><a href="../real/">Real-trade statistics privacy</a></div></details>' + h +
      (war ? '<button class="pt-mini pt-soc" type="button" data-a="card">Share my Trade War card</button>' : '') + '<a class="pt-mini" href="squads.html">Trading Squads</a><a class="pt-mini" href="../real/">Real Trade Journal</a>';
    box.innerHTML = h;
    if (mine) tokensCard(box);
    if (meUser && !mine) S.friends().then(function (f) { var b = box.querySelector('[data-a="friend"]'); if (b && f.indexOf(uid) !== -1) { b.textContent = '✓ Friends'; b.setAttribute('data-a', 'unfriend'); } });
    box.onchange = function (e) { if (e.target.getAttribute('data-a') === 'help' && window.ZelosProfile) ZelosProfile.help.set(e.target.checked); };
    box.onclick = function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return;
      var a = b.getAttribute('data-a'), u = S.me();
      if (a === 'help') return;
      if (a === 'edit') { if (window.ZelosProfile) ZelosProfile.openEditor().then(function (out) { if (out) location.reload(); }); return; }
      if (a === 'share') return S.shareLink(name + ' · Trader profile', war ? name + '\'s Trade War account (virtual) is at ' + money(p.equity) + '. Can you beat that?' : 'Check out ' + name + '\'s trader profile.', link + (u ? '&ref=' + encodeURIComponent(u.uid) : '')).then(function (r) { if (r === 'copied') b.textContent = 'Link copied ✓'; });
      if (a === 'card') return S.shareCard({ name: p.name, equity: p.equity, level: window.ZelosLevels ? 'Lv ' + ZelosLevels.levelForXp(p.xp || 0).level : null, xp: p.xp, winRate: p.trades ? p.winRate : null,
        best: (p.bestTrades || [])[0] ? '+$' + Math.round(p.bestTrades[0].pnl).toLocaleString('en-US') + ' ' + p.bestTrades[0].sym : null }, link + '&ref=' + encodeURIComponent(uid)).then(function (r) { if (r === 'downloaded') b.textContent = 'Saved · link copied ✓'; });
      if (!u) { b.textContent = 'Sign in first (Trade War or the journal)'; return; }
      if (a === 'friend') S.addFriend(uid).then(function () { b.textContent = '✓ Friends'; b.setAttribute('data-a', 'unfriend'); });
      if (a === 'unfriend') S.removeFriend(uid).then(function () { b.textContent = '+ Add friend'; b.setAttribute('data-a', 'friend'); });
      if (a === 'challenge' && window.ZelosChallenge) { ZelosChallenge.open({ to: uid, toName: name }); return; }
    };
  }
  function missing(msg, mine) {
    $('pfBody').innerHTML = '<div class="pf-missing"><h1>' + (mine ? 'Your profile' : 'Profile not found') + '</h1><p>' + msg + '</p>' +
      (mine && window.ZelosProfile ? '<button class="pt-btn pt-btn-go" type="button" id="pfSetup">Set up your profile</button> ' : '') +
      '<a class="pt-btn' + (mine ? '' : ' pt-btn-go') + '" href="./">Enter Trade War</a> <a class="pt-btn" href="../real/">Real Trade Journal</a></div>';
    var b = $('pfSetup'); if (b) b.onclick = function () { ZelosProfile.openEditor().then(function (out) { if (out) location.reload(); }); };
  }

  function start() {
    var uid = new URLSearchParams(location.search).get('u');
    var cfg = window.ZELOS_FIREBASE_CONFIG;
    if (!window.firebase || !cfg || !cfg.projectId) return missing('Profiles need the live site. Try again on agentictrading.info.');
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    var db = firebase.firestore();
    if (window.ZelosSocial) ZelosSocial.init();
    function load(id, mine) {
      var get = function (ref) { return ref.get().then(function (d) { return d.exists ? d.data() : null; }).catch(function () { return null; }); };
      Promise.all([
        get(db.collection('practiceProfiles').doc(id)), get(db.collection('traders').doc(id)),
        db.collection('traders').doc(id).collection('realLog').orderBy('createdAt', 'desc').limit(500).get().then(function (s2) {
          var o = []; s2.forEach(function (d) { var v = d.data(); o.push({ sym: v.sym, at: v.createdAt && v.createdAt.toMillis ? v.createdAt.toMillis() : 0 }); }); return o;
        }).catch(function () { return []; })
      ]).then(function (r) {
        if (!r[0] && !r[1] && !r[2].length) return missing(mine ? 'Nothing public yet. Set up your profile, then make a trade in Trade War (with "Show my stats" on) or log a real trade in the Real Trade Journal.' : 'This trader\'s profile is private, or the link is wrong.', mine);
        show(r[0], id, mine, r[1], r[2]);
        get(db.collection('twRecords').doc(id)).then(function (rec) { if (rec && rec.played) showRecord(rec); });
      });
    }
    if (uid) { firebase.auth().onAuthStateChanged(function (u) { load(uid, !!(u && u.uid === uid)); }); return; }
    firebase.auth().onAuthStateChanged(function (u) { if (u && !u.isAnonymous) load(u.uid, true); else missing('Pick a trader on the <a href="../leaderboard.html#practice">Trade War leaderboard</a>, or sign in to see your own profile.'); });
  }
  // Trade War match record (twRecords/{uid}, written by the server when a match ends).
  // A surrender counts as a loss and is also shown on its own.
  function showRecord(rec) {
    var box = $('pfBody'); if (!box || box.querySelector('.pf-record')) return;
    var wr = rec.played ? Math.round((rec.wins || 0) / rec.played * 100) : 0;
    var el = document.createElement('section'); el.className = 'pt-card pf-card pf-record';
    el.innerHTML = '<h2>Trade War record</h2><div class="pf-rec">' + [['Played', rec.played || 0, ''], ['Wins', rec.wins || 0, 'up'], ['Losses', rec.losses || 0, 'dn'], ['&#127987;&#65039; Surrendered', rec.surrenders || 0, '']]
      .map(function (r) { return '<span><small>' + r[0] + '</small><b class="' + r[2] + '">' + r[1] + '</b></span>'; }).join('') + '</div>' +
      '<p class="pt-fine">Win rate ' + wr + '%.' + (rec.surrenders ? ' Losses include ' + rec.surrenders + ' surrender' + (rec.surrenders === 1 ? '' : 's') + '.' : '') + '</p>' +
      ((rec.recent || []).length ? '<ul class="twh-list">' + rec.recent.slice(0, 5).map(function (x) {
        return '<li><a href="war.html?w=' + encodeURIComponent(x.w) + '">' + (x.rank === 1 ? '🏆 ' : x.surrendered ? '&#127987;&#65039; ' : '') + esc(x.name) + '</a><small>' +
          (x.surrendered ? 'Surrendered · counted as a loss' : (x.rank === 1 ? 'Won' : 'Lost') + ' · #' + x.rank + ' of ' + x.of + (x.pnlPct != null ? ' · ' + pct(x.pnlPct) : '')) + '</small></li>';
      }).join('') + '</ul>' : '');
    var anchor = box.querySelector('.pf-section');
    if (anchor) box.insertBefore(el, anchor); else box.appendChild(el);
  }
  document.addEventListener('DOMContentLoaded', start);
})();
