/*!
 * Zelos tokens: the wallet and the token-gated live alerts.
 *
 * Tokens are the site's paid currency. The server (functions/main.py, Tokens
 * section) owns every balance: this file only reads your wallet
 * (wallets/{uid}, readable by you alone) and asks Cloud Functions to change it:
 *   tokens_wallet    your wallet + prices (the first call adds the welcome tokens)
 *   tokens_spend     a 1-week scanner pass, or one live alert
 *   tokens_checkout  a Square Checkout payment link for a token pack
 *
 * Alerts with a trade: alerts/{id} is a teaser (locked: true) and the full
 * alert sits in alertsLocked/{id}, readable with a pass for that scanner or a
 * single unlock. Before the 4:00 pm ET close an unlock costs the live price;
 * after it (afterClose: true) the cheaper after-close price. Once the trade
 * finishes (target, stop or expiry) the full alert is public, free for everyone.
 *
 *   ZelosTokens.open()                         wallet pop-up
 *   ZelosTokens.full(alert, id)                Promise<full alert | null>
 *   ZelosTokens.lockCard(alert, id, onOpen)    element: the locked-alert card
 *   ZelosTokens.isLocked(alert)
 *
 * Tokens are site credit only: no cash value, not transferable, not refundable
 * except where the law requires (terms.html §07).
 */
(function (global) {
  'use strict';
  var d = document, ROOT = /\/(games|learn|scan|practice|real)\//.test(location.pathname) ? '../' : '';
  var FNS_URL = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions-compat.js';
  var NAMES = { 'swing-trader': 'Swing Trader', 'breakout-rider': 'Breakout Rider', 'options-scanner': 'Options Scanner' };
  var fnsP = null, wallet = null, walletUnsub = null, prices = null, me = null, listeners = [];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fb() {
    var cfg = global.ZELOS_FIREBASE_CONFIG;
    if (!global.firebase || !cfg || !cfg.projectId) return null;
    try { if (!firebase.apps.length) firebase.initializeApp(cfg); return { auth: firebase.auth(), db: firebase.firestore() }; } catch (e) { return null; }
  }
  function functions() {
    if (!fnsP) fnsP = new Promise(function (resolve, reject) {
      if (firebase.functions) { try { return resolve(firebase.functions()); } catch (e) { return reject(e); } }
      var s = d.createElement('script'); s.src = FNS_URL;
      s.onload = function () { try { resolve(firebase.functions()); } catch (e) { reject(e); } };
      s.onerror = function () { fnsP = null; reject(new Error('Couldn\'t reach the wallet. Check your connection and try again.')); };
      d.head.appendChild(s);
    });
    return fnsP;
  }
  function call(name, data) { return functions().then(function (f) { return f.httpsCallable(name)(data || {}); }).then(function (r) { return r.data; }); }
  function errText(e) { return String((e && e.message) || e || 'Something went wrong.').replace(/^FirebaseError: /, ''); }
  function user() { var f = fb(), u = f && f.auth.currentUser; return u && !u.isAnonymous ? u : null; }
  function emit() { listeners.forEach(function (fn) { try { fn(wallet); } catch (e) {} }); }
  function hasAccess(strategy, id) { return !!wallet && (((wallet.passes || {})[strategy] || 0) > Date.now() || (wallet.unlocked || []).indexOf(id) !== -1); }
  function until(ms) { return new Date(ms).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  function left(ms) { var s = Math.max(0, Math.round((ms - Date.now()) / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? h + 'h ' + m + 'm' : m + 'm'; }

  // ------------------------------------------------------------ wallet (live read of your own doc)
  var greeted = false;
  function ensureWallet() {
    return call('tokens_wallet').then(function (w) {
      prices = w; wallet = Object.assign({}, wallet || {}, { balance: w.balance, passes: w.passes, unlocked: w.unlocked }); emit();
      if (w.bought) toast('Payment received: +' + w.bought + ' tokens are in your wallet.');
      if (w.welcomed && !greeted) { greeted = true; toast('Welcome! ' + w.prices.welcome + ' free tokens are in your wallet. Use them to unlock live scanner alerts.'); }
      return w;
    });
  }
  function toast(t) {
    style();
    var el = d.createElement('div'); el.className = 'zt-toast'; el.setAttribute('role', 'status');
    var base = d.documentElement.classList.contains('has-tabbar') && global.innerWidth <= 760 ? 84 : 20;
    el.style.bottom = (base + d.querySelectorAll('.zt-toast').length * 74) + 'px';
    el.innerHTML = '<span class="zt-coin" aria-hidden="true"></span><span>' + esc(t) + '</span>';
    el.onclick = function () { el.remove(); open(); };
    d.body.appendChild(el); setTimeout(function () { el.classList.add('is-gone'); setTimeout(function () { el.remove(); }, 400); }, 7000);
  }
  // Daily check-in: once per New York day (the server decides; this only avoids extra calls)
  function nyDay() { try { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function checkin(u) {
    var key = 'ztCheckin:' + u.uid, today = nyDay();
    try { if (localStorage.getItem(key) === today) return; } catch (e) {}
    setTimeout(function () {
      call('rewards_checkin').then(function (r) {
        try { localStorage.setItem(key, today); } catch (e) {}
        if (r && r.earned > 0) {
          var left = r.every - (r.streak % r.every);
          toast('+' + r.earned + ' tokens for checking in today. ' + (r.streak > 1 ? r.streak + '-day streak! ' : '') +
            (r.streak % r.every === 0 ? 'Streak bonus included.' : left + ' more day' + (left === 1 ? '' : 's') + ' for a +' + r.bonus + ' bonus.'));
        }
      }, function () {});
    }, 1500);
  }
  function watch(u) {
    if (walletUnsub) { walletUnsub(); walletUnsub = null; }
    me = u; wallet = null; emit();
    if (!u) return;
    checkin(u);
    var f = fb(), made = false;
    walletUnsub = f.db.collection('wallets').doc(u.uid).onSnapshot(function (s) {
      if (!s.exists) { if (!made) { made = true; ensureWallet().catch(function () {}); } return; }
      wallet = s.data(); emit(); chip();
    }, function () {});
  }

  // ------------------------------------------------------------ nav chip
  function chip() {
    // the site nav, or a page's own spot for it (data-zt-slot, e.g. the alert page header)
    var nav = d.getElementById('navAuth') || d.querySelector('[data-zt-slot]'); if (!nav || !me) return;
    var c = nav.querySelector('.zt-chip');
    if (!c) {
      c = d.createElement('button'); c.type = 'button'; c.className = 'zt-chip'; c.title = 'Your tokens';
      c.onclick = function (e) { e.preventDefault(); e.stopPropagation(); open(); };
      nav.insertBefore(c, nav.firstChild);
    }
    var t = wallet ? String(wallet.balance) : '…';
    if (c.textContent !== t + ' tokens') c.innerHTML = '<span class="zt-coin" aria-hidden="true"></span>' + t + '<span class="zt-sr"> tokens</span>';
  }

  // ------------------------------------------------------------ styles
  function style() {
    if (d.getElementById('ztStyle')) return;
    var s = d.createElement('style'); s.id = 'ztStyle';
    s.textContent = [
      '.zt-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}',
      '.zt-chip{display:inline-flex;align-items:center;gap:6px;margin-right:8px;padding:5px 10px;border-radius:999px;border:1px solid rgba(232,178,61,.45);background:rgba(232,178,61,.08);color:#f2d38a;font:600 .82rem "IBM Plex Mono",monospace;cursor:pointer;vertical-align:middle}',
      '.zt-chip:hover{background:rgba(232,178,61,.16)}',
      '.zt-coin{width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ffe7a3,#e8b23d 60%,#a67a1c);box-shadow:inset 0 0 0 1.5px rgba(0,0,0,.18);flex-shrink:0}',
      '.zt-back{position:fixed;inset:0;z-index:2150;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(3,4,8,.78)}',
      '.zt-card{width:min(460px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:#0d1016;color:#f4f5f7;border:1px solid #262b36;border-radius:16px;padding:20px 22px;box-shadow:0 40px 90px rgba(0,0,0,.6);font-size:.9rem;line-height:1.45}',
      '.zt-card h2{margin:0 0 4px;font-size:1.2rem}.zt-card h3{margin:16px 0 6px;font-size:.92rem}',
      '.zt-bal{display:flex;align-items:center;gap:10px;font:700 2rem "IBM Plex Mono",monospace;margin:6px 0 2px}.zt-bal .zt-coin{width:22px;height:22px}',
      '.zt-muted{color:#8b93a3;font-size:.8rem}',
      '.zt-packs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}',
      '.zt-pack{display:flex;flex-direction:column;align-items:center;gap:2px;padding:12px 6px;border-radius:12px;border:1px solid #2b3140;background:#11151d;color:#f4f5f7;font:inherit;cursor:pointer}',
      '.zt-pack b{font:700 1.05rem "IBM Plex Mono",monospace}.zt-pack span{color:#8b93a3;font-size:.78rem}.zt-pack:hover:not(:disabled){border-color:#e8b23d}.zt-pack:disabled{opacity:.55;cursor:default}',
      '.zt-row{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid #1d222c;font-size:.84rem}.zt-row b{font-family:"IBM Plex Mono",monospace}.zt-row .up{color:#10b981}.zt-row .dn{color:#f87171}',
      '.zt-btn{font:inherit;font-weight:700;padding:10px 14px;border-radius:10px;border:1px solid #2b3140;background:#151a23;color:#e6e9ef;cursor:pointer}',
      '.zt-btn:disabled{opacity:.55;cursor:default}.zt-btn.zt-go{background:linear-gradient(180deg,#08825e,#047857);border-color:transparent;color:#fff}',
      '.zt-btn.zt-gold{background:linear-gradient(180deg,#e8b23d,#c9901b);border-color:transparent;color:#1a1204}',
      '.zt-x{float:right;background:none;border:0;color:#8b93a3;font-size:1.3rem;cursor:pointer;line-height:1}',
      '.zt-msg{min-height:1.2em;margin:10px 0 0;font-size:.84rem}.zt-msg.is-bad{color:#f87171}.zt-msg.is-ok{color:#10b981}',
      '.zt-lock{border:1px solid rgba(232,178,61,.45);background:linear-gradient(180deg,rgba(232,178,61,.08),rgba(232,178,61,.02));border-radius:14px;padding:16px 18px;color:#f4f5f7;font-size:.9rem;line-height:1.5;margin:14px 0}',
      '.zt-lock h3{margin:0 0 4px;font-size:1.05rem;display:flex;align-items:center;gap:8px}',
      '.zt-lock .zt-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}',
      '.zt-lock .zt-muted{margin-top:8px}',
      '.zt-toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2140;display:flex;gap:10px;align-items:center;max-width:min(460px,calc(100vw - 32px));padding:12px 16px;border-radius:12px;border:1px solid rgba(232,178,61,.5);background:#0d1016;color:#f4f5f7;font-size:.9rem;box-shadow:0 20px 50px rgba(0,0,0,.5);cursor:pointer;transition:opacity .35s}',
      '.zt-toast.is-gone{opacity:0}.zt-toast .zt-coin{width:18px;height:18px}',
      '.zt-name{font-weight:inherit}.zt-prism{background:linear-gradient(90deg,#f87171,#fbbf24,#34d399,#38bdf8,#a78bfa);-webkit-background-clip:text;background-clip:text;color:transparent}',
      '.zt-badge{font-size:.95em}.zt-founder{display:inline-flex;align-items:center;gap:3px;padding:1px 7px;border-radius:999px;border:1px solid rgba(232,178,61,.5);background:rgba(232,178,61,.1);color:#f2d38a;font:600 .7rem "IBM Plex Mono",monospace;vertical-align:middle;white-space:nowrap}',
      '.zt-preview{display:flex;align-items:flex-end;height:74px;border-radius:12px;padding:10px 14px;margin:10px 0 4px;font-size:1.15rem;font-weight:700;border:1px solid #262b36}.zt-preview>span{background:rgba(8,10,14,.72);padding:3px 10px;border-radius:8px}',
      '.zt-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px}',
      '.zt-item{display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 6px;border-radius:12px;border:1px solid #2b3140;background:#11151d;color:#f4f5f7;font:inherit;cursor:pointer;text-align:center}',
      '.zt-item b{font-size:.78rem}.zt-item small{color:#8b93a3;font-size:.7rem}.zt-item:hover:not(:disabled){border-color:#e8b23d}.zt-item.is-on{border-color:#10b981;background:rgba(16,185,129,.08)}.zt-item:disabled{opacity:.6}',
      '.zt-item .zt-name{font-size:1.2rem;font-weight:800}.zt-sw{display:block;width:100%;height:26px;border-radius:6px}',
      '@media (max-width:420px){.zt-packs{grid-template-columns:1fr}}'
    ].join('\n');
    d.head.appendChild(s);
  }

  // ------------------------------------------------------------ wallet pop-up
  function modal(html) {
    style();
    var prev = d.activeElement, back = d.createElement('div');
    back.className = 'zt-back'; back.innerHTML = '<div class="zt-card" role="dialog" aria-modal="true" aria-labelledby="ztTitle">' + html + '</div>';
    d.body.appendChild(back);
    var close = function () { back.remove(); d.removeEventListener('keydown', key); try { prev && prev.focus(); } catch (e) {} };
    var key = function (e) { if (e.key === 'Escape') close(); };
    d.addEventListener('keydown', key);
    back.addEventListener('click', function (e) { if (e.target === back || e.target.closest('.zt-x')) close(); });
    return { el: back, close: close };
  }
  function open() {
    if (!user()) { location.href = ROOT + 'tokens.html'; return; }
    var m = modal('<button class="zt-x" type="button" aria-label="Close">&times;</button><h2 id="ztTitle">Your tokens</h2><div id="ztBody"><p class="zt-muted">Loading…</p></div>');
    var body = m.el.querySelector('#ztBody');
    ensureWallet().then(function (w) {
      var passes = Object.keys(w.passes || {}).filter(function (k) { return w.passes[k] > Date.now(); });
      body.innerHTML = '<div class="zt-bal"><span class="zt-coin" aria-hidden="true"></span>' + w.balance + '</div>' +
        (w.welcomed ? '<p class="zt-msg is-ok">Welcome! ' + w.prices.welcome + ' free tokens were added to your wallet.</p>' : '') +
        (w.needsVerify ? '<p class="zt-muted">Verify your email (or sign in with Google) to get your ' + w.prices.welcome + ' free welcome tokens.</p>' : '') +
        '<p class="zt-muted">A 1-week scanner pass is ' + w.prices.pass + ' tokens. One live alert is ' + w.prices.unlock + '; after the 4:00 pm ET close it\'s ' + (w.prices.unlockClosed || 3) + '. Every alert is free for everyone once its trade finishes.</p>' +
        '<h3>Active passes</h3>' + (passes.length ? passes.map(function (k) { return '<div class="zt-row"><span>' + esc(NAMES[k] || k) + '</span><span class="zt-muted">until ' + until(w.passes[k]) + '</span></div>'; }).join('') : '<p class="zt-muted">None. Get one on any scanner\'s locked alert, or on the <a href="' + ROOT + 'tokens.html" style="color:#9dbcff">tokens page</a>.</p>') +
        '<h3>Earn free tokens</h3><div class="zt-row"><span>Daily check-in' + (wallet && wallet.checkin && wallet.checkin.streak ? ' <span class="zt-muted">(' + wallet.checkin.streak + '-day streak)</span>' : '') + '</span><span class="zt-muted">+2 a day, +10 every 7th day in a row</span></div>' +
        '<div class="zt-row"><span>Win a Trade War</span><span class="zt-muted">up to +25</span></div>' +
        '<div class="zt-row"><span><a href="' + ROOT + 'practice/communities.html" style="color:#9dbcff">Founder Program</a></span><span class="zt-muted">up to +3,050</span></div>' +
        '<h3>Spend tokens</h3><div class="zt-acts" style="display:flex;gap:8px;flex-wrap:wrap"><button class="zt-btn" type="button" id="ztLooks">Profile looks</button><a class="zt-btn" style="text-decoration:none" href="' + ROOT + 'tokens.html">Scanner passes</a></div>' +
        '<h3>Get tokens</h3><div class="zt-packs">' + w.packs.map(function (p) { return '<button class="zt-pack" type="button" data-pack="' + p.id + '"' + (w.canBuy ? '' : ' disabled') + '><b>' + p.tokens + '</b><span>$' + (p.cents / 100).toFixed(2) + '</span></button>'; }).join('') + '</div>' +
        (w.canBuy ? '<p class="zt-muted">Secure checkout by Square. Tokens are site credit with no cash value.</p>' : '<p class="zt-muted">Buying tokens is coming soon. Your free tokens work now.</p>') +
        '<h3>History</h3><div id="ztHist"><p class="zt-muted">Loading…</p></div><p class="zt-msg" id="ztMsg" role="status"></p>';
      body.querySelectorAll('[data-pack]').forEach(function (b) { b.onclick = function () { buy(b.getAttribute('data-pack'), m.el.querySelector('#ztMsg'), b); }; });
      history(m.el.querySelector('#ztHist'));
      m.el.querySelector('#ztLooks').onclick = function () { m.close(); shop(); };
    }, function (e) { body.innerHTML = '<p class="zt-msg is-bad">' + esc(errText(e)) + '</p>'; });
  }
  function history(el) {
    var f = fb(), u = user(); if (!f || !u) return;
    f.db.collection('wallets').doc(u.uid).collection('ledger').orderBy('at', 'desc').limit(15).get().then(function (s) {
      var rows = []; s.forEach(function (x) { rows.push(x.data()); });
      el.innerHTML = rows.length ? rows.map(function (r) { return '<div class="zt-row"><span>' + esc(r.note || r.type) + '<br><span class="zt-muted">' + until(r.at) + '</span></span><b class="' + (r.amount >= 0 ? 'up' : 'dn') + '">' + (r.amount >= 0 ? '+' : '') + r.amount + '</b></div>'; }).join('') : '<p class="zt-muted">No activity yet.</p>';
    }).catch(function () { el.innerHTML = '<p class="zt-muted">Couldn\'t load your history.</p>'; });
  }
  function buy(pack, msg, btn) {
    if (btn) btn.disabled = true; msg.className = 'zt-msg'; msg.textContent = 'Opening secure checkout…';
    call('tokens_checkout', { pack: pack }).then(function (r) { if (r.url) location.href = r.url; }, function (e) { if (btn) btn.disabled = false; msg.className = 'zt-msg is-bad'; msg.textContent = errText(e); });
  }

  // ------------------------------------------------------------ locked alerts
  function isLocked(a) { return !!(a && a.locked); }
  function isClosed(a) { return !!(a && (a.afterClose || (a.lockedUntil || 0) <= Date.now())); }
  // The full alert if you have a pass or unlocked it; null otherwise.
  function full(a, id) {
    var f = fb(), u = user(); if (!f || !u || !isLocked(a)) return Promise.resolve(null);
    return f.db.collection('alertsLocked').doc(id).get().then(function (s) { return s.exists ? Object.assign({ id: id }, s.data()) : null; }).catch(function () { return null; });
  }
  // Wait for sign-in to settle, then: { alert: the full alert if you can see it, locked }
  function resolve(a, id) {
    if (!isLocked(a)) return Promise.resolve({ alert: a, locked: false });
    var f = fb(); if (!f) return Promise.resolve({ alert: a, locked: true });
    return new Promise(function (res) { var un = f.auth.onAuthStateChanged(function (u) { un(); res(u); }); })
      .then(function () { return full(a, id); })
      .then(function (x) { return x ? { alert: x, locked: false, unlocked: true } : { alert: a, locked: true }; });
  }
  function lockCard(a, id, onOpen) {
    style();
    var el = d.createElement('div'), name = NAMES[a.strategy] || 'this scanner';
    el.className = 'zt-lock';
    function draw(msg, bad) {
      var u = user(), p = prices || {}, bal = wallet ? wallet.balance : null, closed = isClosed(a);
      var cost = closed ? (p.prices ? p.prices.unlockClosed : 3) : (p.prices ? p.prices.unlock : 10);
      el.innerHTML = '<h3><span class="zt-coin" aria-hidden="true"></span>' + (closed ? 'Unlock this alert with tokens' : 'Live alert: unlock with tokens') + '</h3>' +
        (closed ? '<div>The ticker, entry, stop, targets and full reasoning. The market has closed, so it costs less now, and it\'s free for everyone once the trade finishes (target, stop or expiry).</div>'
          : '<div>The ticker, entry, stop, targets and full reasoning. Live until the 4:00 pm ET close (in about <b>' + left(a.lockedUntil) + '</b>), then ' + (p.prices ? p.prices.unlockClosed : 3) + ' tokens, and free once the trade finishes.</div>') +
        (u ? '<div class="zt-acts"><button class="zt-btn zt-gold" type="button" data-k="unlock">Unlock this alert · ' + cost + ' tokens</button>' +
          '<button class="zt-btn" type="button" data-k="pass">1-week ' + esc(name) + ' pass · ' + (p.prices ? p.prices.pass : 40) + ' tokens</button></div>' +
          '<div class="zt-muted">' + (bal != null ? 'You have <b>' + bal + '</b> tokens. ' : '') + '<a href="#" data-k="wallet" style="color:#9dbcff">Wallet &amp; token packs</a></div>'
          : '<div class="zt-acts"><a class="zt-btn zt-gold" href="' + ROOT + 'tokens.html" style="text-decoration:none">Sign in to get free tokens</a></div><div class="zt-muted">New accounts start with free tokens: enough for a week-long pass.</div>') +
        '<p class="zt-msg' + (bad ? ' is-bad' : msg ? ' is-ok' : '') + '" role="status">' + esc(msg || '') + '</p>';
      el.querySelectorAll('[data-k]').forEach(function (b) { b.onclick = function (e) {
        e.preventDefault(); var k = b.getAttribute('data-k');
        if (k === 'wallet') return open();
        el.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
        var req = k === 'pass' ? { kind: 'pass', strategy: a.strategy } : { kind: 'unlock', alertId: id };
        call('tokens_spend', req).then(function (w) {
          wallet = Object.assign({}, wallet || {}, w); emit();
          return full(a, id);
        }).then(function (f) { if (f && onOpen) onOpen(f); else draw('Unlocked. Loading the alert…'); }, function (e2) { draw(errText(e2), true); });
      }; });
    }
    draw();
    if (user() && !prices) ensureWallet().then(function () { draw(); }, function () {});
    return el;
  }

  // ------------------------------------------------------------ profile looks (cosmetics)
  // What each item looks like; the server (COSMETICS in functions/main.py) owns names and prices.
  var LOOKS = {
    color: { gold: '#f2c14e', emerald: '#34d399', electric: '#38bdf8', crimson: '#fb7185', violet: '#a78bfa', rainbow: 'prism' },
    badge: { bull: '🐂', bear: '🐻', rocket: '🚀', diamond: '💎', crown: '👑' },
    banner: {
      sunset: 'linear-gradient(135deg,#ff7e5f,#feb47b 45%,#6a3093)', midnight: 'linear-gradient(135deg,#0f2027,#203a43 50%,#2c5364)',
      neon: 'linear-gradient(rgba(0,255,255,.18) 1px,transparent 1px) 0 0/18px 18px,linear-gradient(90deg,rgba(255,0,200,.18) 1px,transparent 1px) 0 0/18px 18px,linear-gradient(135deg,#12002b,#2b0050)',
      ocean: 'linear-gradient(135deg,#1c6e8c,#2193b0 45%,#6dd5ed)', gold: 'linear-gradient(135deg,#8a6a1f,#e8c66a 30%,#b38728 60%,#fbf5b7 80%,#aa771c)'
    }
  };
  var FOUNDER_ICONS = { 5: '🏛️', 10: '⭐', 25: '🏗️', 50: '🛡️', 100: '🏆' };
  var lookCache = {};
  // cosmetics/{uid} (public): { color, badge, banner, founder: {title, tier, cid, name} }
  function look(uid) {
    if (!uid) return Promise.resolve({});
    if (!lookCache[uid]) {
      var f = fb();
      lookCache[uid] = !f ? Promise.resolve({}) : f.db.collection('cosmetics').doc(uid).get().then(function (s) { return s.exists ? s.data() : {}; }).catch(function () { return {}; });
    }
    return lookCache[uid];
  }
  function nameHtml(name, lk) {
    lk = lk || {}; style();
    var c = LOOKS.color[lk.color], st = c && c !== 'prism' ? ' style="color:' + c + '"' : '';
    return '<span class="zt-name' + (c === 'prism' ? ' zt-prism' : '') + '"' + st + '>' + esc(name) + '</span>' +
      (LOOKS.badge[lk.badge] ? ' <span class="zt-badge" title="' + esc(lk.badge) + '">' + LOOKS.badge[lk.badge] + '</span>' : '') +
      (lk.founder ? ' <span class="zt-founder" title="' + esc(lk.founder.title + ' of ' + (lk.founder.name || 'a community')) + '">' + (FOUNDER_ICONS[lk.founder.tier] || '🏛️') + ' ' + esc(lk.founder.title) + '</span>' : '');
  }
  function bannerCss(lk) { return lk && LOOKS.banner[lk.banner] || ''; }

  // ------------------------------------------------------------ name colors everywhere
  // One property per trader: cosmetics/{uid} (server-written). Any element with
  // data-zname="<uid>" shows that trader's name in their color, with their badge
  // (data-zname-full adds the Founder title). Renderers only add the attribute; this
  // paints every such element on the page, including ones drawn later (live
  // leaderboards, chat), with one batched read per trader per page.
  var looksIn = {}, UID_OK = /^[A-Za-z0-9_\-]{1,128}$/;
  function lookNow(uid) { return looksIn[uid]; }
  function fetchLooks(uids) {
    var f = fb(); if (!f || !global.firebase || !firebase.firestore.FieldPath) return Promise.resolve();
    var jobs = [];
    for (var i = 0; i < uids.length; i += 30) {
      var part = uids.slice(i, i + 30);
      part.forEach(function (u) { looksIn[u] = looksIn[u] || null; });
      jobs.push(f.db.collection('cosmetics').where(firebase.firestore.FieldPath.documentId(), 'in', part).get().then(function (s) {
        var got = {}; s.forEach(function (x) { got[x.id] = x.data(); });
        part.forEach(function (u) { looksIn[u] = got[u] || {}; lookCache[u] = Promise.resolve(looksIn[u]); });
      }, function () { part.forEach(function (u) { looksIn[u] = {}; }); }));
    }
    return Promise.all(jobs);
  }
  function paintEl(el, lk) {
    el.setAttribute('data-znp', '1');
    var full = el.hasAttribute('data-zname-full');
    if (!LOOKS.color[lk.color] && !LOOKS.badge[lk.badge] && !(full && lk.founder)) return;
    var nm = el.getAttribute('data-zntext') || el.textContent;
    el.setAttribute('data-zntext', nm);
    el.innerHTML = nameHtml(nm, full ? lk : { color: lk.color, badge: lk.badge });
  }
  function paintNames() {
    var need = [];
    d.querySelectorAll('[data-zname]:not([data-znp])').forEach(function (el) {
      var u = el.getAttribute('data-zname');
      if (!UID_OK.test(u)) return el.setAttribute('data-znp', '1');
      if (looksIn[u]) paintEl(el, looksIn[u]);
      else if (!(u in looksIn) && need.indexOf(u) === -1) need.push(u);
    });
    if (need.length) fetchLooks(need).then(paintNames);
  }
  function hasName(n) { return n.nodeType === 1 && (n.hasAttribute('data-zname') || !!n.querySelector('[data-zname]')); }
  function watchNames() {
    style(); paintNames();
    if (global.MutationObserver) new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) for (var j = 0; j < ms[i].addedNodes.length; j++) if (hasName(ms[i].addedNodes[j])) return paintNames();
    }).observe(d.body, { childList: true, subtree: true });
  }
  function shop() {
    if (!user()) { location.href = ROOT + 'tokens.html'; return; }
    var m = modal('<button class="zt-x" type="button" aria-label="Close">&times;</button><h2 id="ztTitle">Profile looks</h2><p class="zt-muted">Make your name stand out on your profile, in communities and on leaderboards. Buy once, switch any time.</p><div id="ztShop"><p class="zt-muted">Loading…</p></div><p class="zt-msg" id="ztShopMsg" role="status"></p>');
    var box = m.el.querySelector('#ztShop'), msg = m.el.querySelector('#ztShopMsg'), state = null;
    var me2 = user(), nm = (me2 && me2.displayName || 'You').split(' ')[0];
    var TITLES = { color: 'Name colors', badge: 'Badges', banner: 'Profile banners' };
    function draw() {
      var owned = state.owned || [], lk = state.look || {};
      box.innerHTML = '<div class="zt-preview" style="background:' + (bannerCss(lk) || '#151a23') + '"><span>' + nameHtml(nm, lk) + '</span></div>' +
        '<p class="zt-muted">You have <b>' + (wallet ? wallet.balance : '…') + '</b> tokens.</p>' +
        ['color', 'badge', 'banner'].map(function (k) {
          return '<h3>' + TITLES[k] + '</h3><div class="zt-items">' + state.shop[k].map(function (it) {
            var have = owned.indexOf(k + ':' + it.id) !== -1, on = lk[k] === it.id;
            var sw = k === 'color' ? '<span class="zt-name' + (LOOKS.color[it.id] === 'prism' ? ' zt-prism' : '') + '" style="' + (LOOKS.color[it.id] !== 'prism' ? 'color:' + LOOKS.color[it.id] : '') + '">Aa</span>'
              : k === 'badge' ? '<span style="font-size:1.3rem">' + LOOKS.badge[it.id] + '</span>' : '<span class="zt-sw" style="background:' + LOOKS.banner[it.id] + '"></span>';
            return '<button type="button" class="zt-item' + (on ? ' is-on' : '') + '" data-k="' + k + '" data-id="' + it.id + '" data-have="' + (have ? 1 : 0) + '">' + sw +
              '<b>' + esc(it.name) + '</b><small>' + (on ? 'Wearing · tap to remove' : have ? 'Owned · tap to wear' : it.price + ' tokens') + '</small></button>';
          }).join('') + '</div>';
        }).join('');
      box.querySelectorAll('.zt-item').forEach(function (b) { b.onclick = function () {
        var k = b.getAttribute('data-k'), id = b.getAttribute('data-id'), have = b.getAttribute('data-have') === '1', on = (state.look || {})[k] === id;
        msg.className = 'zt-msg'; msg.textContent = have ? '' : 'Buying…';
        box.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
        var p = have ? call('cosmetics_equip', { kind: k, id: on ? null : id }) : call('cosmetics_buy', { kind: k, id: id }).then(function (r) { msg.className = 'zt-msg is-ok'; msg.textContent = 'Bought! It\'s on your profile now.'; return call('cosmetics_equip'); });
        p.then(function (r) { if (r && r.shop) state = r; else return call('cosmetics_equip').then(function (r2) { state = r2; }); })
          .then(function () { delete lookCache[me2.uid]; delete looksIn[me2.uid]; d.querySelectorAll('[data-zname="' + me2.uid + '"]').forEach(function (el) { if (el.hasAttribute('data-zntext')) el.textContent = el.getAttribute('data-zntext'); el.removeAttribute('data-znp'); }); paintNames(); draw(); emitLook(); }, function (e) { msg.className = 'zt-msg is-bad'; msg.textContent = errText(e); draw(); });
      }; });
    }
    call('cosmetics_equip').then(function (r) { state = r; draw(); }, function (e) { box.innerHTML = '<p class="zt-msg is-bad">' + esc(errText(e)) + '</p>'; });
  }
  var lookListeners = [];
  function emitLook() { lookListeners.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  // ------------------------------------------------------------ boot
  function boot() {
    var f = fb(); if (!f) return;
    style();
    f.auth.onAuthStateChanged(function (u) { watch(u && !u.isAnonymous ? u : null); chip(); });
    watchNames();
    var nav = d.getElementById('navAuth');
    if (nav && global.MutationObserver) new MutationObserver(function () { if (me && !nav.querySelector('.zt-chip')) chip(); }).observe(nav, { childList: true });
  }
  global.ZelosTokens = { open: open, full: full, resolve: resolve, lockCard: lockCard, isLocked: isLocked, isClosed: isClosed, look: look, lookNow: lookNow, paintNames: paintNames, nameHtml: nameHtml, bannerCss: bannerCss, shop: shop, onLook: function (fn) { lookListeners.push(fn); }, LOOKS: LOOKS, hasAccess: hasAccess, wallet: function () { return wallet; }, onChange: function (fn) { listeners.push(fn); }, ensure: ensureWallet, buy: buy, call: call };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
