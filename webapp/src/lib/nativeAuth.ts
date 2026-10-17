/**
 * Sign-in inside the iPhone app (Capacitor). WKWebView can't open Firebase's popups, so the
 * native Apple / Google sheet runs first (@capacitor-firebase/authentication with
 * skipNativeAuth: it only returns the provider's tokens), then the same Firebase JS SDK the
 * web uses signs in with them. The rest of the app sees an ordinary Firebase user.
 * Loaded only inside the app (dynamic import), so the website never downloads the plugin.
 */
import { GoogleAuthProvider, OAuthProvider, reauthenticateWithCredential, signInWithCredential, type AuthCredential, type User } from 'firebase/auth';
import { auth } from './firebase';

export type NativeProvider = 'apple' | 'google';

/** The provider's tokens as a Firebase credential, plus Apple's one-time code (for revoking on delete). */
async function nativeCredential(p: NativeProvider): Promise<{ cred: AuthCredential; appleCode?: string } | null> {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  try {
    if (p === 'apple') {
      const r = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true, scopes: ['email', 'name'] });
      const c = r.credential;
      if (!c?.idToken) return null;
      return { cred: new OAuthProvider('apple.com').credential({ idToken: c.idToken, rawNonce: c.nonce }), appleCode: c.authorizationCode };
    }
    const r = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
    const c = r.credential;
    if (!c?.idToken) return null;
    return { cred: GoogleAuthProvider.credential(c.idToken, c.accessToken) };
  } catch (e) {
    // closing the sheet is not an error
    if (/cancel/i.test(String((e as { message?: string; code?: string }).code ?? (e as Error).message ?? ''))) return null;
    throw e;
  }
}

/** Sign in with the native sheet. false if the person closed it. */
export async function nativeSignIn(p: NativeProvider): Promise<boolean> {
  const r = await nativeCredential(p);
  if (!r) return false;
  await signInWithCredential(auth(), r.cred);
  return true;
}

/** Confirm it's really you before deleting the account; returns Apple's code so the server-side token can be revoked. */
export async function nativeReauth(user: User, p: NativeProvider): Promise<{ appleCode?: string } | null> {
  const r = await nativeCredential(p);
  if (!r) return null;
  await reauthenticateWithCredential(user, r.cred);
  return { appleCode: r.appleCode };
}

/** Sign out of the native Google/Apple session too, so the next sign-in can pick another account. */
export async function nativeSignOut(): Promise<void> {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  await FirebaseAuthentication.signOut().catch(() => undefined);
}
