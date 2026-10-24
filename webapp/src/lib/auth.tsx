/**
 * Who is signed in.
 *
 * The classic site signs every visitor in anonymously (zelos-xp.js) so guests can earn
 * XP. Here an anonymous session counts as a guest for the UI: `isReal` is false and we
 * offer sign-in. Every "Sign in" button calls openSignIn(), which shows the sign-in sheet
 * (SignInSheet in the shell): Continue with Apple or Continue with Google (App Store 4.8
 * requires Apple next to any social login). On the web both use a popup; inside the native
 * app they switch to the Capacitor Firebase Authentication plugin (popups don't work there).
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createUserWithEmailAndPassword, GoogleAuthProvider, OAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth';
import { auth } from './firebase';
import { useEmulators } from './firebaseConfig';

// Browser tests only (emulator build): sign in with email/password, since Google's popup
// can't be driven in CI. Vite drops this from normal builds (useEmulators is false there).
if (useEmulators) {
  // wait for Auth to finish starting up first: a sign-in sent before that could be dropped
  // unanswered, which failed a test about 1 run in 170 ("promise was garbage collected", 2026-10-24)
  (window as unknown as { __zelosTestSignIn?: (email: string, pw: string) => Promise<unknown> }).__zelosTestSignIn = async (email, pw) => {
    const a = auth();
    await a.authStateReady();
    return signInWithEmailAndPassword(a, email, pw).catch(() => createUserWithEmailAndPassword(a, email, pw));
  };
}

export type SignInProvider = 'apple' | 'google';

/** The Firebase provider for a sign-in choice (Apple asks for name and email, which it may hide). */
export function providerFor(p: SignInProvider) {
  if (p === 'apple') {
    const a = new OAuthProvider('apple.com');
    a.addScope('email');
    a.addScope('name');
    return a;
  }
  const g = new GoogleAuthProvider();
  g.setCustomParameters({ prompt: 'select_account' });
  return g;
}

export type AuthState = {
  ready: boolean;
  user: User | null;
  isReal: boolean;
  /** show the sign-in sheet */
  openSignIn: () => Promise<void>;
  signInOpen: boolean;
  closeSignIn: () => void;
  /** sign in with that provider (popup, or redirect where popups are blocked) */
  signInWith: (p: SignInProvider) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);

  useEffect(() => {
    try {
      return onAuthStateChanged(auth(), (u) => {
        setUser(u);
        setReady(true);
      });
    } catch {
      queueMicrotask(() => setReady(true)); // Firebase unavailable: run as a guest
      return undefined;
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      isReal: !!user && !user.isAnonymous,
      async openSignIn() {
        setSignInOpen(true);
      },
      signInOpen,
      closeSignIn: () => setSignInOpen(false),
      async signInWith(p: SignInProvider) {
        const provider = providerFor(p);
        try {
          await signInWithPopup(auth(), provider);
          setSignInOpen(false);
        } catch (e) {
          const code = (e as { code?: string }).code;
          if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
            await signInWithRedirect(auth(), provider);
            return;
          }
          if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
          throw e;
        }
      },
      async signOut() {
        await signOut(auth());
      },
    }),
    [ready, user, signInOpen],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
