/**
 * Who is signed in.
 *
 * The classic site signs every visitor in anonymously (zelos-xp.js) so guests can earn
 * XP. Here an anonymous session counts as a guest for the UI: `isReal` is false and we
 * offer sign-in. Google sign-in uses a popup on the web; inside the native app this will
 * switch to the Capacitor Firebase Authentication plugin (popups don't work there).
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth';
import { auth } from './firebase';

export type AuthState = {
  ready: boolean;
  user: User | null;
  isReal: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

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
      async signInWithGoogle() {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        try {
          await signInWithPopup(auth(), provider);
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
    [ready, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
