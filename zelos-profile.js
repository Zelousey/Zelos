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
 * Onboarding checklist: (Sign up ->) Profile -> First trade -> Invite a friend ->
 *   Add Zelos to your phone -> Turn on notifications. Mounted into
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
      '.zo-card{border:1px solid var(--border,#262a34);background:var(--surface,#15171c);border-radius:3px;padding:16px 18px;margin:0 0 14px;max-width:560px}',
      '.zo-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.zo-top b{font-size:1.1rem}.zo-top small{color:var(--muted,#9599a3);font-family:var(--mono,monospace);font-size:.72rem;letter-spacing:.06em;text-transform:uppercase}',
      '.zo-bar{height:6px;background:var(--border-soft,#1d2028);margin:10px 0 4px;overflow:hidden}.zo-bar i{display:block;height:100%;background:var(--accent,#4a86ff);transition:width var(--dur-slow,260ms) var(--ease-out,ease-out)}',
      '.zo-steps{list-style:none;margin:0;padding:0}',
      '.zo-step{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--border-soft,#1d2028)}.zo-step:first-child{border-top:0}',
      '.zo-go{display:flex;align-items:center;gap:12px;width:100%;font:inherit;color:inherit;text-align:left;background:none;border:0;padding:0;cursor:pointer;text-decoration:none}.zo-go:hover .zo-txt b{color:var(--accent,#4a86ff)}',
      '.zo-n{width:28px;height:28px;flex:none;border-radius:50%;border:1.5px solid var(--border,#262a34);display:flex;align-items:center;justify-content:center;font:700 .8rem var(--mono,monospace);color:var(--muted,#9599a3)}',
      '.zo-step.is-done .zo-n{background:var(--bull,#3ecb7c);border-color:var(--bull,#3ecb7c);color:#04160b}.zo-step.is-now .zo-n{border-color:var(--accent,#4a86ff);color:var(--accent,#4a86ff);box-shadow:0 0 0 4px rgba(74,134,255,.18)}',
      '.zo-txt{flex:1;min-width:0}.zo-txt b{display:block;font-size:.92rem}.zo-txt small{color:var(--muted,#9599a3);font-size:.78rem}.zo-step.is-done .zo-txt b{color:var(--muted,#9599a3);text-decoration:line-through}',
      '.zo-step em{font:600 .7rem var(--mono,monospace);font-style:normal;color:var(--violet,#8f7bf6);white-space:nowrap}',
      '.zo-cta{display:block;width:100%;margin-top:10px;text-align:center;padding:13px;border-radius:14px;font-size:1rem;font-weight:800;text-decoration:none}',
      '.zo-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:10px;font-size:.8rem;color:var(--muted,#9599a3)}',
      '.zo-foot button.zo-link{color:var(--accent,#4a86ff);background:none;border:0;font:inherit;cursor:pointer;padding:0}',
      '.zo-sheet{position:fixed;inset:0;z-index:2400;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(4,6,10,.62)}html.zo-locked{overflow:hidden}',
      '.zo-sheet-card{width:min(480px,100%);max-height:88vh;overflow:auto;background:var(--surface,#15171c);border:1px solid var(--border,#262a34);border-radius:3px;box-shadow:0 30px 80px rgba(0,0,0,.55)}',
      '.zo-sheet-head{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border-soft,#1d2028)}.zo-sheet-head b{font-size:1.05rem}',
      '.zo-x{font-size:1.5rem;line-height:1;background:none;border:0;color:var(--muted,#9599a3);cursor:pointer}.zo-sheet-body{padding:14px 16px 18px}',
      '.zo-video{display:block;width:100%;max-height:52vh;background:#000;border:1px solid var(--border,#262a34);border-radius:3px;margin-bottom:10px}',
      '.zo-p{font-size:.9rem;color:var(--muted,#9599a3);line-height:1.5;margin:0 0 10px}.zo-p b{color:var(--ink,#f4f5f7)}',
      '.zo-g{font:600 .64rem var(--mono,monospace);letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#9599a3);margin:12px 0 4px}',
      '.zo-how{margin:0;padding:0;list-style:none;counter-reset:zo}.zo-how li{counter-increment:zo;display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--border-soft,#1d2028);font-size:.92rem}',
      '.zo-how li::before{content:counter(zo);width:28px;height:28px;flex:none;border:1px solid var(--border,#262a34);border-radius:3px;display:flex;align-items:center;justify-content:center;font:700 .8rem var(--mono,monospace);color:var(--accent,#4a86ff)}',
      '.zo-wide{display:block;width:100%;margin-top:10px;text-align:center;padding:12px}',
      '.zo-invite{display:flex;gap:6px}.zo-invite input{flex:1;min-width:0;font:.8rem var(--mono,monospace);padding:9px 10px;border:1px solid var(--border,#262a34);border-radius:3px;background:var(--bg-soft,#0f1116);color:var(--ink,#f4f5f7)}',
      '.zo-help{display:inline-flex;align-items:center;gap:8px;cursor:pointer}.zo-help input{accent-color:var(--accent,#4a86ff);width:16px;height:16px}',
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
  // Profile -> first trade -> invite a friend -> add Zelos to your phone -> notifications.
  // (Sign up comes first for guests.) XP per step, paid once (zelos-xp.js 'onboard').
  function localFills() { try { var a = JSON.parse(localStorage.getItem('zelosPractice-v1') || 'null'); return a ? ((a.life && a.life.fills) || (a.fills || []).length || 0) : 0; } catch (e) { return 0; } }
  function standalone() { return (global.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  var installEvt = null;
  global.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; });
  if (standalone()) ls('zelosAppInstalled', '1');
  function steps(ctx) {
    var t = ctx.trader || {}, p = ctx.userdoc && ctx.userdoc.practice, ob = (ctx.userdoc && ctx.userdoc.onboard) || {};
    var fills = Math.max(localFills(), p ? ((p.life && p.life.fills) || (p.fills || []).length || 0) : 0);
    var pushOn = !!(global.ZelosPush && ZelosPush.state() === 'on');
    var list = [
      { id: 'profile', label: 'Set up your profile', hint: 'Picture and @username', done: !!(t.username && t.name), cta: 'Set up profile', act: 'profile', xp: 25 },
      { id: 'trade', label: 'Make your first trade', hint: 'Virtual money, real prices', done: fills > 0, cta: 'Make a trade', href: ROOT + 'practice/index.html', xp: 25 },
      { id: 'invite', label: 'Invite a friend', hint: 'You both get +50 XP when they join', done: !!(ob.invited || ls('zelosInvited') === '1' || (ctx.userdoc && (ctx.userdoc.referralCount || 0) > 0)), cta: 'Invite a friend', act: 'invite', xp: 0 },
      { id: 'app', label: 'Add Zelos to your phone', hint: 'Opens full screen, like an app', done: !!(ob.app || ls('zelosAppInstalled') === '1'), cta: 'Add to your phone', act: 'app', xp: 50 },
      { id: 'notify', label: 'Turn on notifications', hint: 'Challenges, battles, alerts', done: pushOn || !!ob.notify, cta: 'Turn on notifications', act: 'notify', xp: 50 }
    ];
    if (!ctx.user) list.unshift({ id: 'signup', label: 'Create your account', hint: 'Free. Keeps your progress on every device.', done: false, cta: 'Sign up free', act: 'signup', xp: 0 });
    return list;
  }
  function loadScript(src) {
    return new Promise(function (res) {
      if (d.querySelector('script[src$="' + src + '"]')) return res();
      var s = d.createElement('script'); s.src = ROOT + src; s.onload = res; s.onerror = res; d.head.appendChild(s);
    });
  }
  function sheet(title, html) {
    var sh = d.createElement('div'); sh.className = 'zo-sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-label', title);
    sh.innerHTML = '<div class="zo-sheet-card"><div class="zo-sheet-head"><b>' + esc(title) + '</b><button type="button" class="zo-x" aria-label="Close">&times;</button></div><div class="zo-sheet-body">' + html + '</div></div>';
    d.body.appendChild(sh); d.documentElement.classList.add('zo-locked');
    var close = function () { sh.remove(); d.documentElement.classList.remove('zo-locked'); d.dispatchEvent(new CustomEvent('zelos:onboard')); };
    sh.addEventListener('click', function (e) { if (e.target === sh || e.target.closest('.zo-x') || e.target.closest('[data-zo-close]')) close(); });
    d.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { close(); d.removeEventListener('keydown', k); } });
    return sh;
  }
  function markStep(f, uid, key) {
    var o = {}; o[key] = true;
    if (f && uid) f.db.collection('users').doc(uid).set({ onboard: o }, { merge: true }).catch(function () {});
  }
  function appSheet(ctx, f) {
    var vid = global.ZELOS_TOUR_VIDEO || '';
    var sh = sheet('Add Zelos to your phone',
      (vid ? '<video class="zo-video" controls playsinline preload="metadata"' + (global.ZELOS_TOUR_POSTER ? ' poster="' + esc(ROOT + global.ZELOS_TOUR_POSTER) + '"' : '') + ' src="' + esc(ROOT + vid) + '"></video>' : '') +
      '<p class="zo-p">Zelos opens full screen from your Home Screen, like an app. No App Store needed.</p>' +
      (isIOS() ? '<div class="zo-g">On iPhone (Safari)</div><ol class="zo-how"><li>Tap the <b>Share</b> button <span aria-hidden="true">&#x2B06;&#xFE0E;</span></li><li>Tap <b>Add to Home Screen</b></li><li>Open Zelos from the new icon</li></ol>'
        : '<div class="zo-g">On Android or a computer</div>' + (installEvt ? '<button type="button" class="zp-btn is-go zo-wide" id="zoInstall">Install Zelos</button>' : '<ol class="zo-how"><li>Open your browser menu <b>&#8942;</b></li><li>Tap <b>Install app</b> or <b>Add to Home screen</b></li></ol>')) +
      '<button type="button" class="zp-btn zo-wide" id="zoDidIt">I already did this</button>');
    var ib = sh.querySelector('#zoInstall');
    if (ib) ib.onclick = function () { installEvt.prompt(); installEvt.userChoice.then(function (c) { if (c && c.outcome === 'accepted') { ls('zelosAppInstalled', '1'); markStep(f, ctx.user && ctx.user.uid, 'app'); if (global.ZelosXP) ZelosXP.award('onboard', 'app', null, 50); sh.querySelector('.zo-x').click(); } }); };
    sh.querySelector('#zoDidIt').onclick = function () { ls('zelosAppInstalled', '1'); markStep(f, ctx.user && ctx.user.uid, 'app'); sh.querySelector('.zo-x').click(); };
  }
  function notifySheet() {
    var sh = sheet('Notifications', '<div id="zoNotify"><p class="zo-p">Loading…</p></div><button type="button" class="zp-btn zo-wide" data-zo-close>Done</button>');
    Promise.all([loadScript('zelos-tokens.js'), loadScript('zelos-push.js')]).then(function () { return loadScript('zelos-notify-settings.js'); }).then(function () {
      if (global.ZelosNotifySettings) ZelosNotifySettings.mount(sh.querySelector('#zoNotify'));
    });
  }
  function inviteSheet(ctx, f) {
    var S = global.ZelosSocial, link = ctx.user && S && S.links ? S.links(ctx.user.uid).invite() : SITE_ORIGIN() + '/practice/';
    var sh = sheet('Invite a friend', '<p class="zo-p">When a friend joins Trade War from your link, you <b>both</b> get +50 XP. Then challenge them to a battle.</p>' +
      '<div class="zo-invite"><input readonly value="' + esc(link) + '"><button type="button" class="zp-btn is-go" id="zoShare">Share link</button></div>');
    sh.querySelector('#zoShare').onclick = function () {
      var done = function () { ls('zelosInvited', '1'); markStep(f, ctx.user && ctx.user.uid, 'invited'); };
      if (S && S.shareLink) S.shareLink('Join me in Trade War', 'Trade real stocks with $10,000 of virtual money and see if you can beat me.', link).then(function () { done(); this.textContent = 'Shared'; }.bind(this));
      else { try { navigator.clipboard.writeText(link); } catch (e) {} done(); this.textContent = 'Copied'; }
    };
  }
  function SITE_ORIGIN() { return location.origin; }
  function mountChecklist(el) {
    if (!el) return;
    style();
    var ctx = { user: null, trader: null, userdoc: null }, f = fb();
    // opened after this tap finishes, or the page's click-outside handler would close it straight away
    function signup() { var b = d.getElementById('getStartedBtn'); if (b) { setTimeout(function () { b.click(); try { b.scrollIntoView({ block: 'nearest' }); } catch (e) {} }, 0); } else location.href = ROOT + 'my-zelos.html'; }
    function payXp(list) {
      if (!ctx.user || !global.ZelosXP) return;
      list.forEach(function (s) { if (s.done && s.xp && ls('zelosObXp-' + s.id) !== '1') { ls('zelosObXp-' + s.id, '1'); ZelosXP.award('onboard', s.id, null, s.xp); } });
    }
    function render() {
      var list = steps(ctx), done = list.filter(function (s) { return s.done; }).length, all = done === list.length;
      payXp(list);
      if (all) ls(DONE_KEY, '1');
      if (all || ls(HIDE_KEY) === '1') { el.innerHTML = ''; el.hidden = true; help.apply(); return; }
      el.hidden = false;
      var now = list.filter(function (s) { return !s.done; })[0];
      el.innerHTML = '<section class="zo-card" aria-labelledby="zoTitle">' +
        '<div class="zo-top"><b id="zoTitle">Get set up</b><small>' + done + ' of ' + list.length + ' done</small></div>' +
        '<div class="zo-bar" aria-hidden="true"><i style="width:' + Math.round(done / list.length * 100) + '%"></i></div>' +
        '<ol class="zo-steps">' + list.map(function (s, i) {
          var cls = s.done ? 'is-done' : s === now ? 'is-now' : '';
          // any unfinished step can be opened, not just the next one
          var inner = '<span class="zo-n" aria-hidden="true">' + (s.done ? '&#10003;' : i + 1) + '</span>' +
            '<span class="zo-txt"><b>' + esc(s.label) + '</b><small>' + esc(s.hint) + '</small></span>' + (s.xp ? '<em>+' + s.xp + ' XP</em>' : '');
          var open = s.done ? inner : s.href ? '<a class="zo-go" href="' + s.href + '">' + inner + '</a>' : '<button type="button" class="zo-go" data-act="' + s.act + '">' + inner + '</button>';
          return '<li class="zo-step ' + cls + '"' + (s === now ? ' aria-current="step"' : '') + '>' + open + '</li>';
        }).join('') + '</ol>' +
        (now.href ? '<a class="zp-btn is-go zo-cta" href="' + now.href + '">Continue: ' + esc(now.cta.toLowerCase()) + '</a>' : '<button type="button" class="zp-btn is-go zo-cta" data-act="' + now.act + '">Continue: ' + esc(now.cta.toLowerCase()) + '</button>') +
        '<div class="zo-foot"><label class="zo-help"><input type="checkbox" id="zoHelp"' + (help.on() ? ' checked' : '') + '> Help Mode: tips around the site</label>' +
        '<button type="button" class="zo-link" id="zoHide">Hide checklist</button></div></section>';
      el.querySelectorAll('[data-act]').forEach(function (b) { b.onclick = function () {
        var a = this.getAttribute('data-act');
        if (a === 'signup') return signup();
        if (a === 'profile') return openEditor({ onNeedSignIn: signup }).then(function (out) { if (out) { ctx.trader = out; render(); } });
        if (a === 'invite') { // the Invite a Friend sheet (zelos-invite.js); the old copy-link box if it can't load
          ls('zelosInvited', '1'); markStep(f, ctx.user && ctx.user.uid, 'invited');
          if (global.ZelosInvite) return ZelosInvite.open();
          var sc = d.createElement('script'); sc.src = ROOT + 'zelos-invite.js'; sc.onload = function () { ZelosInvite.open(); }; sc.onerror = function () { inviteSheet(ctx, f); }; d.head.appendChild(sc); return;
        }
        if (a === 'app') return appSheet(ctx, f);
        if (a === 'notify') return notifySheet();
      }; });
      el.querySelector('#zoHelp').onchange = function () { help.set(this.checked); };
      el.querySelector('#zoHide').onclick = function () { ls(HIDE_KEY, '1'); render(); };
      help.apply();
    }
    d.addEventListener('zelos:userdoc', function (e) { ctx.userdoc = e.detail; render(); });
    d.addEventListener('zelos:profile', function (e) { ctx.trader = e.detail; render(); });
    d.addEventListener('zelos:progress', render);
    d.addEventListener('zelos:onboard', render);
    if (f) f.auth.onAuthStateChanged(function (u) {
      ctx.user = u && !u.isAnonymous ? u : null; ctx.trader = null; ctx.userdoc = null;
      render();
      if (!ctx.user) return;
      load(ctx.user.uid).then(function (t) { ctx.trader = t; render(); });
      f.db.collection('users').doc(ctx.user.uid).onSnapshot(function (s) { ctx.userdoc = s.exists ? s.data() : {}; render(); }, function () {});
    });
    render();
  }

  global.ZelosProfile = { load: load, openEditor: openEditor, displayPhoto: displayPhoto, help: help, mountChecklist: mountChecklist };
  function boot() { mountChecklist(d.getElementById('zOnboard')); help.apply(); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
