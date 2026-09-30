/*!
 * Zelos — profile setup, new-user onboarding checklist, and Help Mode.
 *
 * Load after firebase (app/auth/firestore compat) + firebase-config.js, and
 * after zelos-progress.js / zelos-social.js where those are on the page.
 *
 * Profile (public): traders/{uid} { name, username, bio, avatar, photo, ... }
 *   - avatar: a picture the person uploaded, resized here to a small JPEG
 *     data URL (<= ~20 KB, checked again by firestore.rules). photo is the
 *     Google account photo other code keeps in sync. Shown: avatar || photo.
 *   - username: unique, reserved in usernames/{name} = { uid } in the same
 *     batch (rules refuse a username that isn't reserved by its owner, and
 *     make a change release the old one).
 *   - After a save, practiceProfiles/{uid} (leaderboards) gets the new
 *     name/username/photo too if it exists, and a `zelos:profile` event fires.
 *
 * Onboarding checklist: Sign up -> Complete profile -> First trade ->
 *   Challenge a friend -> Join or create a Trade War (a practice/war.html match). Mounted into
 *   #zOnboard when present; the first unfinished step is highlighted with one
 *   clear button. Hides itself when everything is done, or when dismissed.
 *
 * Help Mode: elements with data-help="..." get a short tip under them while
 *   Help Mode is on. Default: on until onboarding is finished, then off,
 *   unless the person picked. A private group (squad) can force it on or off
 *   for its own page with setGroupHelp(true|false).
 *
 * window.ZelosProfile = { load, openEditor, displayPhoto, help: { on, set, apply, setGroup }, mountChecklist }
 */
(function (global) {
  'use strict';
  var HELP_KEY = 'zelosHelp', HIDE_KEY = 'zelosOnboardHidden', DONE_KEY = 'zelosOnboardDone';
  var d = document;
  var ROOT = /\/(games|learn|scan|practice|real)\//.test(location.pathname) ? '../' : '';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function fb() {
    var cfg = global.ZELOS_FIREBASE_CONFIG;
    if (!global.firebase || !cfg || !cfg.projectId) return null;
    try { if (!firebase.apps.length) firebase.initializeApp(cfg); return { db: firebase.firestore(), auth: firebase.auth() }; } catch (e) { return null; }
  }
  function me() { var f = fb(); var u = f && f.auth.currentUser; return u && !u.isAnonymous ? u : null; }

  // ------------------------------------------------------------ styles
  function style() {
    if (d.getElementById('zpStyle')) return;
    var s = d.createElement('style'); s.id = 'zpStyle';
    s.textContent = [
      '.zp-back{position:fixed;inset:0;z-index:2000;background:rgba(4,6,10,.72);display:flex;align-items:center;justify-content:center;padding:16px}',
      '.zp-card{width:min(460px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:var(--surface,#15171c);color:var(--ink,#f4f5f7);border:1px solid var(--border,#2b2e35);border-radius:12px;padding:22px 20px 18px;box-shadow:0 30px 80px rgba(0,0,0,.55);animation:zm-rise var(--dur-base,180ms) var(--ease-out,ease-out)}',
      '.zp-card h2{margin:0 0 4px;font-size:1.2rem}.zp-card>p{margin:0 0 14px;color:var(--muted,#9599a3);font-size:.88rem}',
      '.zp-row{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}.zp-row label{font-size:.8rem;font-weight:600;color:var(--ink-2,#d6d9de)}',
      '.zp-row input,.zp-row textarea{font:inherit;font-size:.92rem;padding:9px 11px;border-radius:6px;border:1px solid var(--border,#2b2e35);background:var(--bg-soft,#101216);color:var(--ink,#f4f5f7)}',
      '.zp-row textarea{min-height:70px;resize:vertical}.zp-row input:focus,.zp-row textarea:focus{outline:2px solid var(--accent,#4a86ff);outline-offset:1px}',
      '.zp-note{font-size:.76rem;color:var(--muted,#9599a3)}.zp-note.is-ok{color:var(--bull,#1fbf75)}.zp-note.is-bad{color:var(--danger,#ef4d56)}',
      '.zp-uname{display:flex;align-items:center;border:1px solid var(--border,#2b2e35);border-radius:6px;background:var(--bg-soft,#101216)}.zp-uname span{padding:0 0 0 11px;color:var(--muted,#9599a3)}.zp-uname input{border:0;flex:1;min-width:0;background:transparent}',
      '.zp-photo{display:flex;align-items:center;gap:14px}.zp-av{width:64px;height:64px;border-radius:50%;background:var(--bg-soft,#101216);border:1px solid var(--border,#2b2e35);object-fit:cover;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.4rem;color:var(--muted,#9599a3)}',
      '.zp-btns{display:flex;gap:8px;justify-content:flex-end;margin-top:6px;flex-wrap:wrap}',
      '.zp-btn{font:inherit;font-weight:600;font-size:.88rem;padding:9px 14px;border-radius:6px;border:1px solid var(--border,#2b2e35);background:transparent;color:var(--ink,#f4f5f7);cursor:pointer}',
      '.zp-btn.is-go{background:var(--accent,#4a86ff);border-color:var(--accent,#4a86ff);color:#fff}.zp-btn:disabled{opacity:.5;cursor:not-allowed}',
      '.zp-btn:focus-visible{outline:2px solid var(--accent,#4a86ff);outline-offset:2px}',
      '.zp-err{color:var(--danger,#ef4d56);font-size:.84rem;margin:0 0 8px}',
      // onboarding card
      '.zo-card{border:1px solid var(--accent-line,#2c4d8a);background:linear-gradient(180deg,var(--accent-soft,#182a4a) 0%,var(--surface,#15171c) 70%);border-radius:10px;padding:16px 18px;margin:14px 0 16px}',
      '.zo-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}.zo-top b{font-size:1rem}.zo-top small{color:var(--muted,#9599a3)}',
      '.zo-bar{height:4px;border-radius:2px;background:var(--border,#2b2e35);margin:10px 0 12px;overflow:hidden}.zo-bar i{display:block;height:100%;background:var(--accent,#4a86ff);transition:width var(--dur-slow,260ms) var(--ease-out,ease-out)}',
      '.zo-steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}',
      '.zo-step{border:1px solid var(--border-soft,#1d1f24);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px;font-size:.84rem;color:var(--muted,#9599a3);background:var(--bg-soft,#101216)}',
      '.zo-step .zo-n{font-family:var(--mono,monospace);font-size:.7rem;letter-spacing:.06em}',
      '.zo-step.is-done{color:var(--ink-2,#d6d9de)}.zo-step.is-done .zo-n::after{content:" \\2713";color:var(--bull,#1fbf75)}',
      '.zo-step.is-now{border-color:var(--accent,#4a86ff);color:var(--ink,#f4f5f7);box-shadow:0 0 0 1px var(--accent,#4a86ff) inset}',
      '.zo-step b{color:inherit;font-size:.88rem}.zo-step .zp-btn{align-self:flex-start;padding:7px 11px;font-size:.8rem}',
      '.zo-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px;font-size:.8rem;color:var(--muted,#9599a3)}',
      '.zo-foot a,.zo-foot button.zo-link{color:var(--accent,#4a86ff);background:none;border:0;font:inherit;cursor:pointer;padding:0;text-decoration:none}',
      '.zo-help{display:inline-flex;align-items:center;gap:8px;cursor:pointer}.zo-help input{accent-color:var(--accent,#4a86ff);width:16px;height:16px}',
      '@media (max-width:860px){.zo-steps{grid-template-columns:1fr}.zo-step{flex-direction:row;align-items:center;flex-wrap:wrap}.zo-step:not(.is-now) small{display:none}.zo-step .zp-btn{margin-left:auto}}',
      // help mode tips
      '.zh-tip{flex-basis:100%;display:block;margin:6px 0 2px;padding:7px 10px;border-left:2px solid var(--accent,#4a86ff);background:var(--accent-soft,#182a4a);color:var(--ink-2,#d6d9de);font-size:.8rem;line-height:1.4;border-radius:0 4px 4px 0;animation:zm-rise var(--dur-base,180ms) var(--ease-out,ease-out)}',
      '@media (prefers-reduced-motion:reduce){.zp-card,.zh-tip{animation:none}.zo-bar i{transition:none}}'
    ].join('\n');
    d.head.appendChild(s);
  }

  // ------------------------------------------------------------ profile data
  function load(uid) {
    var f = fb(); if (!f || !uid) return Promise.resolve({});
    return f.db.collection('traders').doc(uid).get().then(function (s) { return s.exists ? s.data() : {}; }).catch(function () { return {}; });
  }
  function displayPhoto(t, fallback) { t = t || {}; return t.avatar || t.photo || fallback || null; }
  function cleanName(v) { return String(v || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24); }
  function cleanUser(v) { return String(v || '').trim().replace(/^@/, '').toLowerCase(); }
  var USER_RE = /^[a-z0-9_]{3,20}$/;

  // center-crop + resize to a small JPEG data URL that fits the rules' 20 KB cap
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('Pick an image file.'));
      if (file.size > 15 * 1024 * 1024) return reject(new Error('That image is too large (max 15 MB).'));
      var r = new FileReader();
      r.onerror = function () { reject(new Error('Couldn\'t read that image.')); };
      r.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('Couldn\'t open that image.')); };
        img.onload = function () {
          var tries = [[160, 0.85], [128, 0.8], [112, 0.7], [96, 0.6]];
          for (var i = 0; i < tries.length; i++) {
            var n = tries[i][0], c = d.createElement('canvas'); c.width = c.height = n;
            var side = Math.min(img.width, img.height), sx = (img.width - side) / 2, sy = (img.height - side) / 2;
            var g = c.getContext('2d'); g.fillStyle = '#101216'; g.fillRect(0, 0, n, n);
            g.drawImage(img, sx, sy, side, side, 0, 0, n, n);
            var url = c.toDataURL('image/jpeg', tries[i][1]);
            if (url.length <= 19500) return resolve(url);
          }
          reject(new Error('Couldn\'t make that image small enough. Try another one.'));
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }

  function checkUsername(name, uid) {
    var f = fb();
    if (!USER_RE.test(name)) return Promise.resolve({ ok: false, msg: '3–20 characters: lowercase letters, numbers, underscore.' });
    return f.db.collection('usernames').doc(name).get().then(function (s) {
      if (!s.exists || s.data().uid === uid) return { ok: true, msg: '@' + name + ' is available.' };
      return { ok: false, msg: '@' + name + ' is taken.' };
    }).catch(function () { return { ok: true, msg: '' }; });
  }

  function save(uid, before, next) {
    var f = fb(), b = f.db.batch(), tr = f.db.collection('traders').doc(uid);
    var doc = { name: next.name, bio: next.bio || null, avatar: next.avatar || null, updatedAt: Date.now() };
    if (next.username !== (before.username || null)) {
      doc.username = next.username || null;
      if (next.username) b.set(f.db.collection('usernames').doc(next.username), { uid: uid });
      if (before.username) b.delete(f.db.collection('usernames').doc(before.username));
    }
    b.set(tr, doc, { merge: true });
    return b.commit().then(function () {
      var photo = next.avatar || before.photo || null;
      // keep leaderboards in step (only if a Trade War profile is published)
      f.db.collection('practiceProfiles').doc(uid).get().then(function (s) {
        if (s.exists) return s.ref.update({ name: next.name, username: next.username || null, photo: photo });
      }).catch(function () {});
      var out = Object.assign({}, before, doc, { username: next.username || null });
      try { d.dispatchEvent(new CustomEvent('zelos:profile', { detail: out })); } catch (e) {}
      return out;
    });
  }

  // ------------------------------------------------------------ editor
  function openEditor(opts) {
    opts = opts || {};
    var user = me();
    if (!user) { if (opts.onNeedSignIn) opts.onNeedSignIn(); return Promise.resolve(null); }
    style();
    return load(user.uid).then(function (before) {
      return new Promise(function (resolve) {
        var prevFocus = d.activeElement;
        var state = { avatar: before.avatar || null, unameOk: true };
        var back = d.createElement('div'); back.className = 'zp-back';
        back.innerHTML =
          '<div class="zp-card" role="dialog" aria-modal="true" aria-labelledby="zpTitle">' +
          '<h2 id="zpTitle">' + (before.username ? 'Edit your profile' : 'Set up your profile') + '</h2>' +
          '<p>This is how other traders see you on leaderboards, challenges and squads. Your email is never shown.</p>' +
          '<p class="zp-err" id="zpErr" hidden></p>' +
          '<div class="zp-row"><label>Profile picture</label><div class="zp-photo"><span id="zpAvWrap"></span>' +
          '<div style="display:flex;flex-direction:column;gap:6px"><label class="zp-btn" style="text-align:center">Choose photo<input type="file" id="zpFile" accept="image/*" hidden></label>' +
          '<button type="button" class="zp-btn" id="zpRemove">Remove</button></div></div></div>' +
          '<div class="zp-row"><label for="zpName">Display name</label><input id="zpName" maxlength="24" autocomplete="nickname" value="' + esc(before.name || (user.displayName || '').split(' ')[0]) + '"></div>' +
          '<div class="zp-row"><label for="zpUser">Username</label><div class="zp-uname"><span>@</span><input id="zpUser" maxlength="20" autocomplete="off" autocapitalize="none" spellcheck="false" value="' + esc(before.username || '') + '"></div><span class="zp-note" id="zpUserNote">Lowercase letters, numbers and _ · 3–20 characters.</span></div>' +
          '<div class="zp-row"><label for="zpBio">Bio <span class="zp-note" id="zpBioN"></span></label><textarea id="zpBio" maxlength="160" placeholder="Swing trader, mostly tech. Here for the Trade Wars.">' + esc(before.bio || '') + '</textarea></div>' +
          '<div class="zp-btns"><button type="button" class="zp-btn" id="zpCancel">Cancel</button><button type="button" class="zp-btn is-go" id="zpSave">Save profile</button></div>' +
          '</div>';
        d.body.appendChild(back);
        var $ = function (id) { return back.querySelector('#' + id); };
        function av() {
          var src = state.avatar || before.photo || user.photoURL || null; // uploaded picture, else the Google photo
          $('zpAvWrap').innerHTML = src ? '<img class="zp-av" alt="" referrerpolicy="no-referrer" src="' + esc(src) + '">' : '<span class="zp-av">' + esc((cleanName($('zpName').value) || '?').charAt(0).toUpperCase()) + '</span>';
          $('zpRemove').hidden = !state.avatar;
        }
        function err(t) { $('zpErr').textContent = t || ''; $('zpErr').hidden = !t; }
        function bioN() { $('zpBioN').textContent = '(' + $('zpBio').value.length + '/160)'; }
        var timer = null;
        function uname() {
          var v = cleanUser($('zpUser').value), note = $('zpUserNote');
          if (v !== $('zpUser').value) $('zpUser').value = v;
          clearTimeout(timer);
          if (!v) { state.unameOk = false; note.className = 'zp-note is-bad'; note.textContent = 'Pick a username so friends can find you.'; return; }
          if (v === before.username) { state.unameOk = true; note.className = 'zp-note'; note.textContent = 'Your current username.'; return; }
          state.unameOk = false; note.className = 'zp-note'; note.textContent = 'Checking…';
          timer = setTimeout(function () { checkUsername(v, user.uid).then(function (r) { if (cleanUser($('zpUser').value) !== v) return; state.unameOk = r.ok; note.className = 'zp-note ' + (r.ok ? 'is-ok' : 'is-bad'); note.textContent = r.msg; }); }, 350);
        }
        function close(result) { d.removeEventListener('keydown', onKey); back.remove(); try { prevFocus && prevFocus.focus(); } catch (e) {} resolve(result); }
        function onKey(e) {
          if (e.key === 'Escape') close(null);
          if (e.key === 'Tab') { // keep focus inside the dialog
            var f = back.querySelectorAll('button:not([hidden]),input:not([hidden]),textarea'); if (!f.length) return;
            var first = f[0], last = f[f.length - 1];
            if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
          }
        }
        d.addEventListener('keydown', onKey);
        back.addEventListener('mousedown', function (e) { if (e.target === back) close(null); });
        $('zpCancel').onclick = function () { close(null); };
        $('zpFile').onchange = function () { err(''); shrink(this.files[0]).then(function (u) { state.avatar = u; av(); }, function (e) { err(e.message); }); this.value = ''; };
        $('zpRemove').onclick = function () { state.avatar = null; av(); };
        $('zpName').oninput = function () { if (!state.avatar) av(); };
        $('zpUser').oninput = uname; $('zpBio').oninput = bioN;
        $('zpSave').onclick = function () {
          var name = cleanName($('zpName').value), u = cleanUser($('zpUser').value), bio = $('zpBio').value.replace(/[<>]/g, '').trim().slice(0, 160);
          if (!name) return err('Add a display name.');
          if (!USER_RE.test(u)) return err('Pick a username: 3–20 lowercase letters, numbers or _.');
          if (!state.unameOk) return err('That username isn\'t available yet. Try another one.');
          err(''); this.disabled = true; this.textContent = 'Saving…'; var btn = this;
          checkUsername(u, user.uid).then(function (r) {
            if (!r.ok) throw new Error(r.msg);
            return save(user.uid, before, { name: name, username: u, bio: bio, avatar: state.avatar });
          }).then(function (out) { close(out); }, function (e) {
            btn.disabled = false; btn.textContent = 'Save profile';
            err(/permission|PERMISSION/.test(String(e && (e.code || e.message))) ? 'That username was just taken, or your session expired. Try another name or sign in again.' : (e && e.message) || 'Couldn\'t save. Try again.');
          });
        };
        av(); bioN(); if (before.username) { $('zpUserNote').textContent = 'Your current username.'; }
        setTimeout(function () { try { $('zpName').focus(); } catch (e) {} }, 30);
      });
    });
  }

  // ------------------------------------------------------------ help mode
  var groupHelp = null;
  var help = {
    on: function () {
      if (groupHelp != null) return groupHelp;
      var v = ls(HELP_KEY); if (v === 'on') return true; if (v === 'off') return false;
      return ls(DONE_KEY) !== '1'; // new users get tips until onboarding is done
    },
    set: function (on) { ls(HELP_KEY, on ? 'on' : 'off'); help.apply(); try { d.dispatchEvent(new CustomEvent('zelos:help', { detail: on })); } catch (e) {} },
    setGroup: function (v) { groupHelp = v == null ? null : !!v; help.apply(); },
    apply: function (root) {
      style();
      var on = help.on();
      d.documentElement.classList.toggle('zh-on', on);
      (root || d).querySelectorAll('[data-help]').forEach(function (el) {
        var next = el.nextElementSibling, has = next && next.classList.contains('zh-tip') && next.getAttribute('data-for') === '1';
        if (on && !has) { var p = d.createElement('span'); p.className = 'zh-tip'; p.setAttribute('data-for', '1'); p.setAttribute('role', 'note'); p.textContent = el.getAttribute('data-help'); el.insertAdjacentElement('afterend', p); }
        if (!on && has) next.remove();
      });
    }
  };

  // ------------------------------------------------------------ onboarding checklist
  function localFills() { try { var a = JSON.parse(localStorage.getItem('zelosPractice-v1') || 'null'); return a ? ((a.life && a.life.fills) || (a.fills || []).length || 0) : 0; } catch (e) { return 0; } }
  function steps(ctx) {
    var t = ctx.trader || {}, p = ctx.userdoc && ctx.userdoc.practice, tot = Object.assign({}, ctx.userdoc && ctx.userdoc.progress && ctx.userdoc.progress.totals);
    if (global.ZelosProgress && ZelosProgress.totals) { var lt = ZelosProgress.totals(); Object.keys(lt).forEach(function (k) { tot[k] = Math.max(tot[k] || 0, lt[k]); }); }
    var fills = Math.max(localFills(), p ? ((p.life && p.life.fills) || (p.fills || []).length || 0) : 0);
    return [
      { id: 'signup', label: 'Create your account', hint: 'Free. Keeps your progress on every device.', done: !!ctx.user, cta: 'Sign up free', act: 'signup' },
      { id: 'profile', label: 'Set up your profile', hint: 'Picture, name, @username and a short bio.', done: !!(t.username && t.name), cta: 'Set up profile', act: 'profile' },
      { id: 'trade', label: 'Make your first trade', hint: 'Buy any stock in Trade War. Virtual money, real prices.', done: fills > 0, cta: 'Make a trade', href: ROOT + 'practice/index.html' },
      { id: 'challenge', label: 'Challenge a friend', hint: 'Send a head-to-head challenge link.', done: (tot.challenges || 0) > 0, cta: 'Challenge a friend', href: ROOT + 'practice/challenge.html' },
      { id: 'war', label: 'Join or create a Trade War', hint: 'Pick a buy-in and invite friends. Everyone starts with the same virtual money.', done: !!ctx.inWar, cta: 'Start a Trade War', href: ROOT + 'practice/war.html' }
    ];
  }
  function mountChecklist(el) {
    if (!el) return;
    style();
    var ctx = { user: null, trader: null, userdoc: null, inWar: false };
    function signup() { var b = d.getElementById('getStartedBtn'); if (b) { b.click(); try { b.scrollIntoView({ block: 'nearest' }); } catch (e) {} } else location.href = ROOT + 'index.html'; }
    function render() {
      var list = steps(ctx), done = list.filter(function (s) { return s.done; }).length, all = done === list.length;
      if (all) ls(DONE_KEY, '1');
      if (all || ls(HIDE_KEY) === '1') { el.innerHTML = ''; el.hidden = true; help.apply(); return; }
      el.hidden = false;
      var now = list.filter(function (s) { return !s.done; })[0];
      el.innerHTML = '<section class="zo-card" aria-labelledby="zoTitle">' +
        '<div class="zo-top"><b id="zoTitle">Get started: ' + esc(now.label.toLowerCase()) + '</b><small>' + done + ' of ' + list.length + ' done</small></div>' +
        '<div class="zo-bar" aria-hidden="true"><i style="width:' + Math.round(done / list.length * 100) + '%"></i></div>' +
        '<ol class="zo-steps">' + list.map(function (s, i) {
          var cls = s.done ? 'is-done' : s === now ? 'is-now' : '';
          var btn = s === now ? (s.href ? '<a class="zp-btn is-go" href="' + s.href + '">' + esc(s.cta) + '</a>' : '<button type="button" class="zp-btn is-go" data-act="' + s.act + '">' + esc(s.cta) + '</button>') : '';
          return '<li class="zo-step ' + cls + '"' + (s === now ? ' aria-current="step"' : '') + '><span class="zo-n">STEP ' + (i + 1) + '</span><b>' + esc(s.label) + '</b>' + (s === now ? '<small>' + esc(s.hint) + '</small>' : '') + btn + '</li>';
        }).join('') + '</ol>' +
        '<div class="zo-foot"><label class="zo-help"><input type="checkbox" id="zoHelp"' + (help.on() ? ' checked' : '') + '> Help Mode: show tips around the site</label>' +
        '<span><a href="' + ROOT + 'practice/index.html?tab=progress">XP &amp; missions</a> &middot; <button type="button" class="zo-link" id="zoHide">Hide checklist</button></span></div></section>';
      var b = el.querySelector('[data-act]');
      if (b) b.onclick = function () { if (this.getAttribute('data-act') === 'signup') signup(); else openEditor({ onNeedSignIn: signup }).then(function (out) { if (out) { ctx.trader = out; render(); } }); };
      el.querySelector('#zoHelp').onchange = function () { help.set(this.checked); };
      el.querySelector('#zoHide').onclick = function () { ls(HIDE_KEY, '1'); render(); };
      help.apply();
    }
    d.addEventListener('zelos:userdoc', function (e) { ctx.userdoc = e.detail; render(); });
    d.addEventListener('zelos:profile', function (e) { ctx.trader = e.detail; render(); });
    d.addEventListener('zelos:progress', render);
    var f = fb();
    if (f) f.auth.onAuthStateChanged(function (u) {
      ctx.user = u && !u.isAnonymous ? u : null; ctx.trader = null; ctx.inWar = false;
      render();
      if (!ctx.user) return;
      load(ctx.user.uid).then(function (t) { ctx.trader = t; render(); });
      // joined or created any Trade War match (lobby, live or finished)
      f.db.collection('tradeWars').where('players', 'array-contains', ctx.user.uid).limit(1).get().then(function (s) {
        ctx.inWar = !s.empty; render();
      }).catch(function () {});
    });
    render();
  }

  global.ZelosProfile = { load: load, openEditor: openEditor, displayPhoto: displayPhoto, help: help, mountChecklist: mountChecklist };
  function boot() { mountChecklist(d.getElementById('zOnboard')); help.apply(); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
