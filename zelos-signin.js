/*!
 * Zelos — "Continue with Google" for Trade War, Squads, Challenges and the
 * Real Trade Journal.
 *
 * signInWithPopup alone fails on phones, in-app browsers (Instagram, TikTok,
 * Messenger...), with popup blockers and with some Safari privacy settings,
 * and Firebase's error ("auth/internal-error") means nothing to a person. So:
 *   1. try the popup;
 *   2. if the browser can't do popups, fall back to a full-page redirect to
 *      Google and finish the sign-in when the page loads again;
 *   3. anything else gets a plain-English message, including the exact
 *      Firebase console setting when it's a configuration problem.
 *
 *   ZelosSignIn.google(onMessage)   start sign-in; onMessage(text) shows a problem
 *   ZelosSignIn.finish(onMessage)   call once on page load (completes a redirect)
 */
(function (global) {
  'use strict';
  var FALLBACK = /popup-blocked|operation-not-supported-in-this-environment|cancelled-popup-request|internal-error|web-storage-unsupported/;
  function inAppBrowser() { return /FBAN|FBAV|Instagram|Line\/|TikTok|Snapchat|Twitter|LinkedInApp|GSA\//i.test(navigator.userAgent || ''); }
  function explain(e) {
    var c = (e && e.code) || '';
    if (c === 'auth/operation-not-allowed') return 'Google sign-in isn\'t switched on for this site yet. (Site owner: Firebase console → Authentication → Sign-in method → Google → Enable.)';
    if (c === 'auth/unauthorized-domain') return 'This web address (' + location.hostname + ') isn\'t allowed to sign in yet. (Site owner: Firebase console → Authentication → Settings → Authorized domains → add ' + location.hostname + '.)';
    if (c === 'auth/network-request-failed') return 'Couldn\'t reach Google. Check your connection and try again.';
    if (c === 'auth/too-many-requests') return 'Too many sign-in attempts. Wait a minute and try again.';
    if (c === 'auth/user-disabled') return 'This account has been disabled.';
    if (c === 'auth/account-exists-with-different-credential') return 'You already have an account with this email using a different sign-in method. Sign in that way from the Log in menu.';
    if (inAppBrowser()) return 'Google sign-in doesn\'t work inside this app\'s built-in browser. Open this page in Safari or Chrome (tap ⋯ → Open in browser) and try again.';
    return 'Sign-in didn\'t finish' + (c ? ' (' + c.replace('auth/', '') + ')' : '') + '. Try again, or use the Log in menu at the top.';
  }
  function provider() { var p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); return p; }
  function google(onMessage) {
    onMessage = onMessage || function (m) { global.alert(m); };
    if (!global.firebase || !firebase.auth) { onMessage('Sign-in isn\'t available right now. Refresh and try again.'); return Promise.resolve(null); }
    var auth = firebase.auth();
    if (inAppBrowser()) { onMessage(explain({})); return Promise.resolve(null); }
    return auth.signInWithPopup(provider()).then(function (r) { return r && r.user; }).catch(function (e) {
      var c = (e && e.code) || '';
      if (c === 'auth/popup-closed-by-user') return null; // they closed it; nothing to say
      if (FALLBACK.test(c)) {
        try { sessionStorage.setItem('zelosSignInRedirect', '1'); } catch (er) {}
        return auth.signInWithRedirect(provider()).then(function () { return null; }).catch(function (e2) { onMessage(explain(e2)); return null; });
      }
      onMessage(explain(e)); return null;
    });
  }
  function finish(onMessage) {
    if (!global.firebase || !firebase.auth) return;
    var pending = false; try { pending = sessionStorage.getItem('zelosSignInRedirect') === '1'; sessionStorage.removeItem('zelosSignInRedirect'); } catch (e) {}
    firebase.auth().getRedirectResult().catch(function (e) { if (pending && onMessage) onMessage(explain(e)); });
  }
  global.ZelosSignIn = { google: google, finish: finish, explain: explain, inAppBrowser: inAppBrowser };
})(window);
