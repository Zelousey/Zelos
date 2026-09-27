/*!
 * Zelos — progression: missions, mission streaks, achievements, seasons.
 *
 * Shared by the practice account (practice/), the Command Center
 * (dashboard.html), the Arcade drills (games/) and the social pages. Load it
 * after zelos-xp.js; it awards XP through ZelosXP when that's present and
 * still tracks everything locally when it isn't.
 *
 * State lives in localStorage (zelosProgress-v1) and, for a signed-in real
 * account, is merged into users/{uid}.progress so it follows the person
 * (attach(db, uid) — the practice page and dashboard call it).
 *
 * Exposes window.ZelosProgress:
 *   track(event, ref)          'trade' | 'win' | 'analyze' (ref = symbol) | 'grade' | 'news'
 *   bump(total, n)             lifetime counters social pages feed: challenges, challengeWins, squads
 *   missions()                 { daily: [...], weekly: [...], streak: {days, best, today} }
 *   checkAchievements(ctx)     unlocks + awards anything ctx now satisfies; returns the new ids
 *   ACHIEVEMENTS, unlocked(), badge(id, size), achievement(id)
 *   SEASONS, season(), seasonFor(day), periodKeys(day) -> { w, m, s }, todayNY()
 *   gradeGameDone()            XP for a finished Grade the Setup game (5 a day)
 *   ref()                      the inviter uid captured from a ?ref= link (first touch)
 *   attach(db, uid)            sync with the user doc; toast(html, kind)
 */
(function (global) {
  'use strict';
  var KEY = 'zelosProgress-v1', REF_KEY = 'zelosRef';

  // ------------------------------------------------------------ calendar
  function todayNY(offset) {
    var d = new Date(); if (offset) d.setDate(d.getDate() + offset);
    try { return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); } catch (e) { return d.toISOString().slice(0, 10); }
  }
  function weekKey(day) {
    if (global.ZelosXP && ZelosXP.weekKey) return 'w' + ZelosXP.weekKey(day);
    var d = new Date(day + 'T12:00:00Z'), dow = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dow + 3);
    var y = d.getUTCFullYear(), first = new Date(Date.UTC(y, 0, 4));
    return 'w' + y + '_' + String(1 + Math.round(((d - first) / 864e5 - 3 + ((first.getUTCDay() + 6) % 7)) / 7)).padStart(2, '0');
  }
  function monthKey(day) { return 'm' + day.slice(0, 4) + '_' + day.slice(5, 7); }
  function weekStart(day) { var d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); }

  // Seasons: every account gets a fresh seasonal ranking; the permanent
  // Practice Account and all-time records carry on untouched. Add the next
  // season here; ids must be letters/digits (they're Firestore field names).
  var SEASONS = [
    { id: 's1', name: 'Season 1', title: 'Agentic Trading Championship', start: '2026-09-27', end: '2026-12-31' },
    { id: 's2', name: 'Season 2', title: 'Winter Breakout', start: '2027-01-01', end: '2027-03-31' }
  ];
  function seasonFor(day) { for (var i = 0; i < SEASONS.length; i++) if (day >= SEASONS[i].start && day <= SEASONS[i].end) return SEASONS[i]; return null; }
  function season() { return seasonFor(todayNY()); }
  function periodKeys(day) { day = day || todayNY(); var s = seasonFor(day); return { w: weekKey(day), m: monthKey(day), s: s ? s.id : null }; }

  // ------------------------------------------------------------ state
  function fresh() {
    return { v: 1, updatedAt: 0, day: { date: '', counts: {}, analyzed: [], done: {} }, week: { key: '', counts: {}, done: {} },
      streak: { days: 0, best: 0, lastDate: '', start: '' }, totals: {}, achievements: {} };
  }
  var st = load();
  function load() { try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) return s; } catch (e) {} return fresh(); }
  function roll() {
    var today = todayNY(), wk = weekKey(today);
    if (st.day.date !== today) st.day = { date: today, counts: {}, analyzed: [], done: {} };
    if (st.week.key !== wk) st.week = { key: wk, counts: {}, done: {} };
  }
  var remote = null, saveTimer = null;
  function save() {
    st.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
    if (remote) { clearTimeout(saveTimer); saveTimer = setTimeout(function () { remote.set({ progress: JSON.parse(JSON.stringify(st)) }, { merge: true }).catch(function () {}); }, 1200); }
    try { document.dispatchEvent(new CustomEvent('zelos:progress')); } catch (e) {}
  }
  // two copies (this browser + the account) → keep the best of each
  function merge(a, b) {
    if (!b || b.v !== 1) return a;
    var out = JSON.parse(JSON.stringify(a));
    if (b.day && b.day.date === out.day.date) {
      Object.keys(b.day.counts || {}).forEach(function (k) { out.day.counts[k] = Math.max(out.day.counts[k] || 0, b.day.counts[k]); });
      (b.day.analyzed || []).forEach(function (s) { if (out.day.analyzed.indexOf(s) === -1) out.day.analyzed.push(s); });
      Object.keys(b.day.done || {}).forEach(function (k) { out.day.done[k] = true; });
    } else if (b.day && b.day.date > out.day.date) out.day = b.day;
    if (b.week && b.week.key === out.week.key) {
      Object.keys(b.week.counts || {}).forEach(function (k) { out.week.counts[k] = Math.max(out.week.counts[k] || 0, b.week.counts[k]); });
      Object.keys(b.week.done || {}).forEach(function (k) { out.week.done[k] = true; });
    } else if (b.week && b.week.key > out.week.key) out.week = b.week;
    if (b.streak && (b.streak.lastDate > out.streak.lastDate || (b.streak.lastDate === out.streak.lastDate && b.streak.days > out.streak.days))) {
      var best = Math.max(out.streak.best || 0, b.streak.best || 0); out.streak = b.streak; out.streak.best = best;
    } else out.streak.best = Math.max(out.streak.best || 0, (b.streak && b.streak.best) || 0);
    Object.keys(b.totals || {}).forEach(function (k) { out.totals[k] = Math.max(out.totals[k] || 0, b.totals[k]); });
    Object.keys(b.achievements || {}).forEach(function (k) { out.achievements[k] = out.achievements[k] ? Math.min(out.achievements[k], b.achievements[k]) : b.achievements[k]; });
    return out;
  }
  function attach(db, uid) {
    if (!db || !uid) return;
    var ref = db.collection('users').doc(uid);
    ref.get().then(function (d) {
      st = merge(load(), d.exists ? (d.data() || {}).progress : null);
      remote = ref; roll(); save(); evaluateMissions();
    }).catch(function () {});
  }
  function detach() { remote = null; }

  // ------------------------------------------------------------ XP helper
  function award(type, refId, amount, cb) {
    if (global.ZelosXP) ZelosXP.award(type, refId, cb || function () {}, amount);
    else if (cb) cb(false);
  }
  function xpLog() { try { return JSON.parse(localStorage.getItem('zelosXpLog') || '{}'); } catch (e) { return {}; } }

  // ------------------------------------------------------------ missions
  var DAILY = [
    { id: 'trade', label: 'Make 1 practice trade', goal: 1, xp: 10, ev: 'trade', href: 'practice/' },
    { id: 'analyze', label: 'Analyze 3 stocks', goal: 3, xp: 10, ev: 'analyze', href: 'practice/', hint: 'Open 3 different charts in the practice account' },
    { id: 'grade', label: 'Complete a Grade the Setup round', goal: 1, xp: 10, ev: 'grade', href: 'games/grade-the-setup.html' },
    { id: 'news', label: 'Check the market news', goal: 1, xp: 5, ev: 'news', href: 'dashboard.html', hint: 'Open a headline in the Command Center' },
    { id: 'xp', label: 'Earn 100 XP', goal: 100, xp: 20, ev: 'xp' }
  ];
  var WEEKLY = [
    { id: 'trades10', label: 'Make 10 practice trades', goal: 10, xp: 40, ev: 'trade', href: 'practice/' },
    { id: 'wins3', label: 'Close 3 winning trades', goal: 3, xp: 50, ev: 'win', href: 'practice/' },
    { id: 'grade10', label: 'Grade 10 setups', goal: 10, xp: 40, ev: 'grade', href: 'games/grade-the-setup.html' },
    { id: 'days5', label: 'Keep your streak 5 days this week', goal: 5, xp: 75, ev: 'mday' },
    { id: 'xp300', label: 'Earn 300 XP', goal: 300, xp: 60, ev: 'xp' }
  ];
  var STREAK_NEED = 2; // daily missions that keep the streak alive
  var STREAK_REWARDS = [[3, 25], [7, 75], [14, 150], [30, 300]];

  function count(m, scope) {
    if (m.ev === 'xp') { var l = xpLog(); return scope === 'day' ? (l.day && l.day.date === st.day.date ? l.day.xp : 0) : (l.week && 'w' + l.week.key === st.week.key ? l.week.xp : 0); }
    return (scope === 'day' ? st.day.counts : st.week.counts)[m.ev] || 0;
  }
  function streakDays() { var s = st.streak; return s.lastDate === todayNY() || s.lastDate === todayNY(-1) ? s.days : 0; }
  function missions() {
    roll();
    function view(list, scope, done) { return list.map(function (m) { var c = count(m, scope); return { id: m.id, label: m.label, hint: m.hint || '', href: m.href || '', goal: m.goal, count: Math.min(c, m.goal), done: !!done[m.id], xp: m.xp }; }); }
    var daily = view(DAILY, 'day', st.day.done);
    return { daily: daily, weekly: view(WEEKLY, 'week', st.week.done), streak: { days: streakDays(), best: st.streak.best || 0, today: st.streak.lastDate === todayNY(), need: STREAK_NEED, doneToday: daily.filter(function (m) { return m.done; }).length } };
  }
  function evaluateMissions() {
    roll();
    var changed = false;
    DAILY.forEach(function (m) {
      if (st.day.done[m.id] || count(m, 'day') < m.goal) return;
      st.day.done[m.id] = true; changed = true;
      award('mission', 'd:' + st.day.date + ':' + m.id, m.xp);
      toast('<b>Mission complete</b> ' + esc(m.label) + ' <em>+' + m.xp + ' XP</em>', 'mission');
    });
    var doneN = Object.keys(st.day.done).length;
    if (doneN >= STREAK_NEED && st.streak.lastDate !== st.day.date) {
      var s = st.streak, cont = s.lastDate === todayNY(-1);
      s.days = cont ? s.days + 1 : 1; if (!cont) s.start = st.day.date;
      s.lastDate = st.day.date; s.best = Math.max(s.best || 0, s.days);
      st.week.counts.mday = (st.week.counts.mday || 0) + 1; changed = true;
      toast('<b>' + s.days + '-day streak</b> ' + (s.days === 1 ? 'started. Come back tomorrow to keep it going.' : 'Keep it going tomorrow.'), 'streak');
      STREAK_REWARDS.forEach(function (r) {
        if (s.days === r[0]) { award('mission', 'streak:' + s.start + ':' + r[0], r[1]); toast('<b>Streak reward</b> ' + r[0] + ' days in a row <em>+' + r[1] + ' XP</em>', 'streak'); }
      });
    }
    WEEKLY.forEach(function (m) {
      if (st.week.done[m.id] || count(m, 'week') < m.goal) return;
      st.week.done[m.id] = true; changed = true;
      award('mission', 'w:' + st.week.key + ':' + m.id, m.xp);
      toast('<b>Weekly mission complete</b> ' + esc(m.label) + ' <em>+' + m.xp + ' XP</em>', 'mission');
    });
    if (changed) { save(); checkAchievements({}); }
  }
  function track(ev, ref) {
    roll();
    if (ev === 'analyze') {
      if (!ref || st.day.analyzed.indexOf(ref) !== -1) return;
      st.day.analyzed.push(ref);
    }
    st.day.counts[ev] = (st.day.counts[ev] || 0) + 1;
    st.week.counts[ev] = (st.week.counts[ev] || 0) + 1;
    if (ev === 'grade') st.totals.grade = (st.totals.grade || 0) + 1;
    save(); evaluateMissions();
  }
  function bump(total, n) { st.totals[total] = Math.max(st.totals[total] || 0, n == null ? (st.totals[total] || 0) + 1 : n); save(); checkAchievements({}); }
  function gradeGameDone() {
    roll();
    var n = (st.day.counts.gradeGames || 0) + 1; st.day.counts.gradeGames = n; save();
    if (n <= 5) award('grade-setup', st.day.date + ':' + n);
  }

  // ------------------------------------------------------------ achievements
  // test(ctx): ctx carries whatever the calling page knows (the practice page
  // passes account stats); missing data just means "not yet".
  var A = [
    ['first-trade', 'First Trade', 'Place your first practice trade', '🎯', 25, 'Trading', function (c) { return c.fills >= 1; }],
    ['first-win', 'First Win', 'Close a trade in profit', '✅', 25, 'Trading', function (c) { return c.wins >= 1; }],
    ['perfect-exit', 'Perfect Exit', 'Get taken out at your take-profit', '🎯', 50, 'Trading', function (c) { return c.tpExits >= 1; }],
    ['hot-hand', 'Hot Hand', '5 winning trades in a row', '🔥', 50, 'Trading', function (c) { return c.bestWinStreak >= 5; }],
    ['win-streak-10', '10-Win Streak', '10 winning trades in a row', '⚡', 150, 'Trading', function (c) { return c.bestWinStreak >= 10; }],
    ['explorer', 'Explorer', 'Trade 10 different stocks', '🧭', 50, 'Trading', function (c) { return c.symbols >= 10; }],
    ['options-rookie', 'Options Rookie', 'Trade your first option', '🎲', 25, 'Trading', function (c) { return c.optionTrades >= 1; }],
    ['agent-handler', 'Agent Handler', 'Place a trade from an agent signal', '🤖', 50, 'Trading', function (c) { return c.agentTrades >= 1; }],
    ['centurion', 'Centurion', 'Close 100 trades', '💯', 200, 'Trading', function (c) { return c.trades >= 100; }],
    ['club-12k', '$12K Club', 'Grow the account to $12,000', '💵', 50, 'Milestones', function (c) { return c.peak >= 12000; }],
    ['club-25k', '$25K Club', 'Grow the account to $25,000', '💰', 150, 'Milestones', function (c) { return c.peak >= 25000; }],
    ['club-50k', '$50K Club', 'Grow the account to $50,000', '🏦', 300, 'Milestones', function (c) { return c.peak >= 50000; }],
    ['club-100k', '$100K Club', 'Grow the account to $100,000', '👑', 500, 'Milestones', function (c) { return c.peak >= 100000; }],
    ['comeback-kid', 'Comeback Kid', 'Recover from $9,000 or lower back to $10,000 without a reset', '🦅', 150, 'Milestones', function (c) { return c.comebacks >= 1; }],
    ['sharp-eye', 'Sharp Eye', 'Grade 25 setups', '👁️', 50, 'Training', function (c) { return c.grade >= 25; }],
    ['on-a-roll', 'On a Roll', 'Keep a 7-day mission streak', '📅', 75, 'Training', function (c) { return c.bestStreak >= 7; }],
    ['challenger', 'Challenger', 'Start or accept a friend challenge', '⚔️', 50, 'Social', function (c) { return c.challenges >= 1; }],
    ['champion', 'Champion', 'Win a friend challenge', '🏆', 150, 'Social', function (c) { return c.challengeWins >= 1; }],
    ['squad-up', 'Squad Up', 'Create or join a Trading Squad', '👥', 25, 'Social', function (c) { return c.squads >= 1; }],
    ['ref-bronze', 'Bronze Recruiter', '1 friend joined from your invite', '🥉', 50, 'Referrals', function (c) { return c.referrals >= 1; }],
    ['ref-silver', 'Silver Recruiter', '3 friends joined from your invite', '🥈', 100, 'Referrals', function (c) { return c.referrals >= 3; }],
    ['ref-gold', 'Gold Recruiter', '10 friends joined from your invite', '🥇', 250, 'Referrals', function (c) { return c.referrals >= 10; }],
    ['ref-diamond', 'Diamond Recruiter', '25 friends joined from your invite', '💎', 500, 'Referrals', function (c) { return c.referrals >= 25; }]
  ];
  SEASONS.forEach(function (s) {
    A.push(['season-' + s.id + '-in', s.name + ' Competitor', 'Trade during ' + s.name + ' (' + s.title + ')', '🏁', 25, 'Seasons', function (c) { return !!(c.seasonTraded && c.seasonTraded[s.id]); }]);
    A.push(['season-' + s.id + '-green', s.name + ' Green Season', 'Grow your account 10% in ' + s.name, '📈', 100, 'Seasons', function (c) { return !!(c.seasonPct && c.seasonPct[s.id] >= 10); }]);
  });
  var ACHIEVEMENTS = A.map(function (a) { return { id: a[0], label: a[1], desc: a[2], icon: a[3], xp: a[4], group: a[5], test: a[6] }; });
  var BY_ID = {}; ACHIEVEMENTS.forEach(function (a) { BY_ID[a.id] = a; });
  var lastCtx = {};
  function checkAchievements(ctx) {
    ctx = ctx || {};
    Object.keys(ctx).forEach(function (k) { if (ctx[k] != null) lastCtx[k] = ctx[k]; });
    var c = {}; Object.keys(lastCtx).forEach(function (k) { c[k] = lastCtx[k]; });
    c.grade = st.totals.grade || 0; c.bestStreak = st.streak.best || 0;
    ['challenges', 'challengeWins', 'squads'].forEach(function (k) { c[k] = Math.max(c[k] || 0, st.totals[k] || 0); });
    var fresh = [];
    ACHIEVEMENTS.forEach(function (a) {
      if (st.achievements[a.id]) return;
      var ok = false; try { ok = !!a.test(c); } catch (e) {}
      if (!ok) return;
      st.achievements[a.id] = Date.now(); fresh.push(a.id);
      award('achievement', a.id, a.xp);
      toast('<span class="zp-ico">' + a.icon + '</span><b>Achievement unlocked: ' + esc(a.label) + '</b> <em>+' + a.xp + ' XP</em>', 'ach');
    });
    if (fresh.length) save();
    return fresh;
  }
  function badge(id, size, locked) {
    var a = BY_ID[id]; if (!a) return '';
    return '<span class="zp-badge' + (locked ? ' is-locked' : '') + '" style="--zp-s:' + (size || 40) + 'px" title="' + esc(a.label + ': ' + a.desc) + '">' + a.icon + '</span>';
  }

  // ------------------------------------------------------------ invite links
  (function captureRef() {
    try {
      var r = new URLSearchParams(location.search).get('ref');
      if (r && /^[A-Za-z0-9]{10,40}$/.test(r) && !localStorage.getItem(REF_KEY)) localStorage.setItem(REF_KEY, JSON.stringify({ uid: r, at: Date.now() }));
    } catch (e) {}
  })();
  function ref() { try { var r = JSON.parse(localStorage.getItem(REF_KEY) || 'null'); return r && r.uid; } catch (e) { return null; } }

  // ------------------------------------------------------------ toasts
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
  function injectStyle() {
    if (document.getElementById('zp-style')) return;
    var css = '.zp-stack{position:fixed;left:50%;top:76px;transform:translateX(-50%);z-index:9000;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;width:min(420px,calc(100vw - 32px));}' +
      '.zp-toast{pointer-events:auto;width:100%;display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;background:var(--surface,#151922);color:var(--ink,#f4f5f7);border:1px solid var(--zp-c,#d9a441);box-shadow:0 12px 34px rgba(0,0,0,.45),0 0 24px -8px var(--zp-c,#d9a441);font:500 .86rem var(--sans,system-ui,sans-serif);animation:zp-in .35s cubic-bezier(.2,1.3,.4,1);transition:opacity .4s,transform .4s;}' +
      '.zp-toast em{margin-left:auto;font-style:normal;font:700 .78rem var(--mono,ui-monospace,monospace);color:var(--zp-c,#d9a441);white-space:nowrap;}' +
      '.zp-toast b{margin-right:4px;} .zp-toast.is-out{opacity:0;transform:translateY(-8px);} .zp-toast.k-mission{--zp-c:#3ecb7c;} .zp-toast.k-streak{--zp-c:#ff8a3d;} .zp-toast.k-ach{--zp-c:#d9a441;}' +
      '.zp-ico{font-size:1.3rem;} @keyframes zp-in{from{opacity:0;transform:translateY(-10px) scale(.96);}to{opacity:1;transform:none;}}' +
      '.zp-badge{display:inline-flex;align-items:center;justify-content:center;width:var(--zp-s);height:var(--zp-s);font-size:calc(var(--zp-s) * .5);line-height:1;flex:none;' +
      'clip-path:polygon(50% 0,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%);background:linear-gradient(135deg,#ffd45c,#b07a12);box-shadow:inset 0 0 0 2px rgba(255,255,255,.2);}' +
      '.zp-badge.is-locked{background:linear-gradient(135deg,#3a3f4a,#23262d);filter:grayscale(1);opacity:.55;}' +
      '@media (prefers-reduced-motion:reduce){.zp-toast{animation:none;}}';
    var el = document.createElement('style'); el.id = 'zp-style'; el.textContent = css; document.head.appendChild(el);
  }
  function toast(html, kind) {
    if (!document.body) return;
    injectStyle();
    var stack = document.querySelector('.zp-stack');
    if (!stack) { stack = document.createElement('div'); stack.className = 'zp-stack'; stack.setAttribute('aria-live', 'polite'); document.body.appendChild(stack); }
    var t = document.createElement('div'); t.className = 'zp-toast k-' + (kind || 'ach'); t.innerHTML = html;
    stack.appendChild(t);
    setTimeout(function () { t.classList.add('is-out'); }, 4200); setTimeout(function () { t.remove(); }, 4700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectStyle); else injectStyle();
  // "Earn N XP" missions complete as XP lands, whichever page earned it
  document.addEventListener('zelos:xp', function () { evaluateMissions(); });
  window.addEventListener('storage', function (e) { if (e.key === KEY) { st = load(); try { document.dispatchEvent(new CustomEvent('zelos:progress')); } catch (er) {} } });

  global.ZelosProgress = {
    track: track, bump: bump, missions: missions, evaluate: evaluateMissions, gradeGameDone: gradeGameDone,
    ACHIEVEMENTS: ACHIEVEMENTS, achievement: function (id) { return BY_ID[id] || null; }, checkAchievements: checkAchievements,
    unlocked: function () { return JSON.parse(JSON.stringify(st.achievements)); }, badge: badge,
    SEASONS: SEASONS, season: season, seasonFor: seasonFor, periodKeys: periodKeys, weekKey: weekKey, monthKey: monthKey, weekStart: weekStart, todayNY: todayNY,
    streak: streakDays, totals: function () { return JSON.parse(JSON.stringify(st.totals)); },
    ref: ref, attach: attach, detach: detach, toast: toast, esc: esc
  };
})(window);
