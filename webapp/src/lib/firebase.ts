/**
 * The one place the app talks to Firebase.
 *
 * Uses the modular SDK so only what we import ships. The classic site uses the older
 * "compat" SDK with the same project and origin, so a person signed in on one is signed
 * in on the other. Functions (callables) load on demand because most screens never
 * call one.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import type { Functions } from 'firebase/functions';
import { firebaseConfig, useEmulators } from './firebaseConfig';

let app: FirebaseApp | null = null;

export function firebaseApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(firebaseConfig);
    if (useEmulators) {
      // test builds only (see firebaseConfig.ts)
      connectAuthEmulator(getAuth(app), 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(getFirestore(app), '127.0.0.1', 8080);
    }
  }
  return app;
}

export function auth(): Auth {
  return getAuth(firebaseApp());
}

export function db(): Firestore {
  return getFirestore(firebaseApp());
}

let fnsPromise: Promise<Functions> | null = null;
export function functions(): Promise<Functions> {
  if (!fnsPromise)
    fnsPromise = import('firebase/functions').then((m) => {
      const f = m.getFunctions(firebaseApp());
      if (useEmulators) m.connectFunctionsEmulator(f, '127.0.0.1', 5001);
      return f;
    });
  return fnsPromise;
}

/** Call a Cloud Function callable. Every money-like or permission-like decision happens there. */
export async function callFunction<Req, Res>(name: string, data: Req): Promise<Res> {
  const [{ httpsCallable }, fns] = await Promise.all([import('firebase/functions'), functions()]);
  const result = await httpsCallable<Req, Res>(fns, name)(data);
  return result.data;
}
