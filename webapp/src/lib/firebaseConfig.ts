/**
 * Public Firebase web config for project `leaderboard-agentictrading`.
 *
 * Same values as the classic site's firebase-config.js (src/lib/firebaseConfig.test.ts
 * fails if they drift). These identify the project and are public by design; access is
 * controlled by Firebase Auth, firestore.rules and database.rules.json, not by hiding
 * this object. Provider keys (Marketstack, Square) are never in the app: they live in
 * Secret Manager and are used only by Cloud Functions.
 */
const BASE = {
  apiKey: 'AIzaSyANA_aoUP5zpgura_ICRl_IgVsSJ1HdXk4',
  authDomain: 'leaderboard-agentictrading.firebaseapp.com',
  databaseURL: 'https://leaderboard-agentictrading-default-rtdb.firebaseio.com',
  projectId: 'leaderboard-agentictrading',
  storageBucket: 'leaderboard-agentictrading.firebasestorage.app',
  messagingSenderId: '623950684200',
  appId: '1:623950684200:web:fc4a5c0c0131ab82ee151d',
} as const;

/**
 * Browser tests (npm run test:e2e) build the app with `--mode e2e`, which points it at a
 * fake "demo-zelos" project on the local Firebase emulators. Normal builds never contain
 * this: Vite replaces the env check with `false` and drops the branch.
 */
export const firebaseConfig = import.meta.env.VITE_FIREBASE_EMULATORS === '1' ? { ...BASE, projectId: 'demo-zelos', authDomain: 'demo-zelos.firebaseapp.com', databaseURL: 'https://demo-zelos-default-rtdb.firebaseio.com' } : BASE;
export const useEmulators = import.meta.env.VITE_FIREBASE_EMULATORS === '1';
