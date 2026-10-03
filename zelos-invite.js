/*!
 * Invite a Friend (Mockup 15): the sender's side.
 *
 *   ZelosInvite.open()   sheet: Trading Squad · Battle · Just invite to join → link → share → "Invite sent"
 *
 * Every invite is one link to the landing page (practice/invite.html), which shows
 * "<you> invited you to trade with $10,000" plus what you picked. A Battle invite
 * creates an open Trade War lobby first (tw_create, all the server's checks); a squad
 * invite links one of your squads. ?ref= credits you when they join.
 */
(function (global) {
  'use strict';
  var d = document, SITE = 'https://agentictrading.info';
  var ROOT = /\/(learn|scan|practice|real|games)\//.test(location.pathname) ? '../' : '';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function user() { try { var u = firebase.auth().currentUser; return u && !u.isAnonymous ? u : null; } catch (e) { return null; } }
  function call(n, data) { return global.ZelosTokens && ZelosTokens.call ? ZelosTokens.call(n, data) : global.ZelosChallenge ? ZelosChallenge.call(n, data) : Promise.reject(new Error('Refresh and try again.')); }
  function errText(e) { return String((e && e.message) || e || 'Something went wrong.').replace(/^FirebaseError: /, ''); }
  function style() {
    if (d.getElementById('zivStyle')) return;
    var s = d.createElement('style'); s.id = 'zivStyle';
    s.textContent = '.ziv-back{position:fixed;inset:0;z-index:2250;display:flex;align-items:flex-end;justify-content:center;background:rgba(3,4,8,.72)}' +
      '@media (min-width:761px){.ziv-back{align-items:center;padding:16px}}' +
      '.ziv{width:min(460px,100%);max-height:calc(100dvh - 24px);overflow:auto;background:var(--surface,#14161c);color:var(--ink,#f4f5f7);border:1px solid var(--border,#262a34);border-radius:3px 3px 0 0;padding:16px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -20px 60px rgba(0,0,0,.5);font-family:var(--sans,system-ui)}' +
      '@media (min-width:761px){.ziv{border-radius:3px}}' +
      '.ziv h3{margin:0 0 4px;font-size:1.15rem}.ziv p.s{margin:0 0 14px;color:var(--muted,#9599a3);font-size:.86rem;line-height:1.45}' +
      '.ziv-x{float:right;background:none;border:0;color:var(--muted,#9599a3);font-size:1.4rem;cursor:pointer;line-height:1}' +
      '.ziv-opt{display:flex;gap:12px;align-items:center;width:100%;text-align:left;padding:12px;margin-bottom:8px;background:var(--bg-soft,#101216);border:1px solid var(--border,#262a34);border-radius:3px;color:inherit;font:inherit;cursor:pointer}' +
      '.ziv-opt.is-on{border-color:var(--accent,#4a86ff);box-shadow:inset 0 0 0 1px var(--accent,#4a86ff);background:var(--accent-soft,#182a4a)}' +
      '.ziv-opt b{display:block;font-size:.95rem}.ziv-opt small{color:var(--muted,#9599a3);font-size:.8rem}.ziv-ic{width:34px;height:34px;flex:none;border-radius:3px;display:flex;align-items:center;justify-content:center;background:var(--surface-2,#1a1d25)}' +
      '.ziv-r{width:18px;height:18px;border-radius:50%;border:2px solid var(--border,#262a34);margin-left:auto;flex:none}.is-on .ziv-r{border-color:var(--accent,#4a86ff);background:radial-gradient(circle,var(--accent,#4a86ff) 45%,transparent 50%)}' +
      '.ziv-f{display:block;margin-top:10px}.ziv-f span{font:600 .68rem var(--mono,monospace);letter-spacing:.1em;color:var(--muted,#9599a3);text-transform:uppercase}' +
      '.ziv-f input,.ziv-f select{display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:11px 12px;border:1px solid var(--border,#262a34);border-radius:3px;background:var(--bg-soft,#101216);color:inherit;font:inherit}' +
      '.ziv-2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}' +
      '.ziv-go{display:block;width:100%;margin-top:14px;padding:13px;border:0;border-radius:3px;background:var(--accent,#4a86ff);color:#fff;font:700 1rem var(--sans,system-ui);cursor:pointer}.ziv-go:disabled{opacity:.6}' +
      '.ziv-msg{color:var(--danger,#e0483f);font-size:.84rem;margin:8px 0 0;min-height:1em}' +
      '.ziv-ok{width:62px;height:62px;margin:6px auto 12px;border-radius:50%;background:rgba(62,203,124,.15);border:2px solid var(--bull,#3ecb7c);display:flex;align-items:center;justify-content:center;font-size:1.8rem;color:var(--bull,#3ecb7c)}' +
      '.ziv-sent{text-align:center}.ziv-sent h3{font-size:1.3rem}.ziv-sent p{color:var(--muted,#9599a3);font-size:.88rem;line-height:1.5}' +
      '.ziv-prev{text-align:left;border:1px solid var(--border,#262a34);border-radius:3px;overflow:hidden;margin:12px 0}.ziv-prev div:first-child{height:84px;display:flex;align-items:center;justify-content:center;font:800 1.05rem var(--sans,system-ui);background:radial-gradient(120% 120% at 30% 0%,#22406f,#0b0f17)}' +
      '.ziv-prev div:last-child{padding:9px 11px;font-size:.78rem;color:var(--muted,#9599a3)}.ziv-prev b{display:block;color:var(--ink,#f4f5f7);font-size:.85rem}' +
      '.ziv-share{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.ziv-share a,.ziv-share button{padding:10px 2px;text-align:center;border:1px solid var(--border,#262a34);border-radius:3px;background:none;color:var(--ink,#f4f5f7);font:500 .78rem var(--sans,system-ui);text-decoration:none;cursor:pointer}' +
      '.ziv-done{display:block;width:100%;margin-top:12px;padding:11px;border:1px solid var(--border,#262a34);border-radius:3px;background:none;color:inherit;font:600 .9rem var(--sans,system-ui);cursor:pointer}';
    d.head.appendChild(s);
  }
  function myName(u) {
    return firebase.firestore().collection('traders').doc(u.uid).get().then(function (t) { var x = t.exists ? t.data() : {}; return x.username ? '@' + x.username : (x.name || (u.displayName || '').split(' ')[0] || 'Your friend'); }).catch(function () { return (u.displayName || '').split(' ')[0] || 'Your friend'; });
  }
  function mySquads(u) {
    return firebase.firestore().collection('squads').where('members', 'array-contains', u.uid).limit(20).get().then(function (s) { var out = []; s.forEach(function (x) { out.push({ id: x.id, name: x.data().name || 'Squad' }); }); return out; }).catch(function () { return []; });
  }
  function open() {
    var u = user();
    if (!u) { location.href = ROOT + 'my-zelos.html'; return; }
    style();
    var back = d.createElement('div'); back.className = 'ziv-back';
    back.innerHTML = '<div class="ziv" role="dialog" aria-modal="true" aria-labelledby="zivT"></div>';
    var box = back.firstChild, kind = 'battle', squads = null, name = 'Your friend';
    function close() { back.remove(); d.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    d.addEventListener('keydown', onKey);
    function opt(k, ic, t, sub) { return '<button type="button" class="ziv-opt' + (k === kind ? ' is-on' : '') + '" data-k="' + k + '"><span class="ziv-ic" aria-hidden="true">' + ic + '</span><span><b>' + t + '</b><small>' + sub + '</small></span><span class="ziv-r"></span></button>'; }
    function pick() {
      var extra = kind === 'battle'
        ? '<label class="ziv-f"><span>Battle name</span><input id="zivName" maxlength="40" placeholder="e.g. Friday Night Fight" autocomplete="off"></label>' +
          '<div class="ziv-2"><label class="ziv-f"><span>Buy-in</span><select id="zivBuy"><option value="100">$100 buy-in</option><option value="500">$500 buy-in</option><option value="1000" selected>$1,000 buy-in</option></select></label>' +
          '<label class="ziv-f"><span>Length</span><select id="zivDays"><option value="1">1 day</option><option value="3" selected>3 days</option><option value="7">7 days</option></select></label></div>'
        : kind === 'squad'
          ? (squads == null ? '<p class="s">Loading your squads…</p>' : squads.length ? '<label class="ziv-f"><span>Squad</span><select id="zivSquad">' + squads.map(function (q) { return '<option value="' + esc(q.id) + '">' + esc(q.name) + '</option>'; }).join('') + '</select></label>'
            : '<p class="s">You\'re not in a squad yet. <a href="' + ROOT + 'practice/squads.html">Start one</a>, then invite friends to it.</p>')
          : '';
      box.innerHTML = '<button type="button" class="ziv-x" aria-label="Close">&times;</button><h3 id="zivT">Invite a friend</h3><p class="s">They get $10,000 of virtual money, and you both get +50 XP when they join.</p>' +
        opt('squad', '&#128101;', 'Trading Squad', 'Join your squad\'s private leaderboard') + opt('battle', '&#9876;&#65039;', 'Battle', 'A head-to-head Trade War') + opt('join', '&#128640;', 'Just invite to join', 'No strings, they just sign up') +
        extra + '<button type="button" class="ziv-go" id="zivGo"' + (kind === 'squad' && !(squads && squads.length) ? ' disabled' : '') + '>Create invite link</button><p class="ziv-msg" id="zivMsg" role="alert"></p>';
      box.querySelector('.ziv-x').onclick = close;
      box.querySelectorAll('[data-k]').forEach(function (b) { b.onclick = function () { kind = b.getAttribute('data-k'); if (kind === 'squad' && squads == null) mySquads(u).then(function (l) { squads = l; if (kind === 'squad') pick(); }); pick(); }; });
      box.querySelector('#zivGo').onclick = create;
      var f = box.querySelector('#zivName'); if (f) f.focus();
    }
    function link(extra) { return SITE + '/practice/invite.html?ref=' + encodeURIComponent(u.uid) + (extra || ''); }
    function create() {
      var go = box.querySelector('#zivGo'), m = box.querySelector('#zivMsg'); m.textContent = '';
      if (kind === 'join') return sent(link(''), 'join', '');
      if (kind === 'squad') { var sel = box.querySelector('#zivSquad'), q = squads.filter(function (x) { return x.id === sel.value; })[0]; return sent(link('&squad=' + encodeURIComponent(q.id) + '&sn=' + encodeURIComponent(q.name)), 'squad', q.name); }
      var bn = String(box.querySelector('#zivName').value || '').replace(/[<>]/g, '').trim();
      if (bn.length < 2) { box.querySelector('#zivName').focus(); m.textContent = 'Give your battle a name, so you can tell your battles apart.'; return; }
      go.disabled = true; go.textContent = 'Creating your battle…';
      call('tw_create', { name: bn, buyIn: +box.querySelector('#zivBuy').value, days: +box.querySelector('#zivDays').value, maxPlayers: 10 }).then(function (r) {
        sent(link('&battle=' + encodeURIComponent(r.warId) + '&bn=' + encodeURIComponent(bn)), 'battle', bn, r.warId);
      }, function (e) { go.disabled = false; go.textContent = 'Create invite link'; m.textContent = errText(e); });
    }
    function sent(url, k, label, warId) {
      var title = name + ' invited you to trade with $10,000';
      var text = title + (k === 'battle' ? '. Accept my battle "' + label + '" or just join free.' : k === 'squad' ? '. Join my squad "' + label + '".' : '. Join me on AgenticTrading.');
      function share() { if (navigator.share) return navigator.share({ title: title, text: text, url: url }).then(function () { return 'shared'; }, function () { return null; }); return copy(); }
      function copy() { try { return navigator.clipboard.writeText(url).then(function () { return 'copied'; }, function () { return null; }); } catch (e) { return Promise.resolve(null); } }
      box.innerHTML = '<div class="ziv-sent"><div class="ziv-ok" aria-hidden="true">&#10003;</div><h3 id="zivT">Invite ready</h3>' +
        '<p>When your friend opens it they\'ll see <b>"' + esc(title) + '"</b>' + (k === 'battle' ? ' and can accept your battle.' : k === 'squad' ? ' and can join your squad.' : '.') + ' You\'ll get a notification when they join.</p>' +
        '<div class="ziv-prev"><div>' + (k === 'battle' ? '&#9876;&#65039; ' + esc(name) + ' challenged you' : k === 'squad' ? '&#128101; Join ' + esc(label) : '&#128640; Trade with $10,000') + '</div><div><b>' + esc(title) + '</b>agentictrading.info</div></div>' +
        '<div class="ziv-share"><a href="sms:?&body=' + encodeURIComponent(text + ' ' + url) + '">Messages</a><a href="https://wa.me/?text=' + encodeURIComponent(text + ' ' + url) + '" target="_blank" rel="noopener">WhatsApp</a><button type="button" id="zivCopy">Copy link</button><button type="button" id="zivMore">More…</button></div>' +
        (warId ? '<a class="ziv-done" style="text-align:center;text-decoration:none" href="' + ROOT + 'practice/war.html?w=' + encodeURIComponent(warId) + '">Go to your battle lobby</a>' : '') +
        '<button type="button" class="ziv-done" id="zivDone">Done</button></div>';
      box.querySelector('#zivDone').onclick = close;
      box.querySelector('#zivCopy').onclick = function () { var b = this; copy().then(function (r) { b.textContent = r ? 'Copied ✓' : url; }); };
      box.querySelector('#zivMore').onclick = function () { share().then(function (r) { if (r) box.querySelector('#zivT').textContent = 'Invite sent'; }); };
      share().then(function (r) { if (r) box.querySelector('#zivT').textContent = r === 'copied' ? 'Link copied: paste it anywhere' : 'Invite sent'; });
    }
    d.body.appendChild(back);
    myName(u).then(function (n) { name = n; });
    pick();
  }
  global.ZelosInvite = { open: open };
})(window);
