/**
 * Editing your watchlist (users/{uid}.watchlist, the same list as the classic site). You may
 * write your own users doc (firestore.rules); the list holds Zelos symbols, at most 50.
 */
import { arrayRemove, arrayUnion, doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { instrument } from '../../data/universe';

export const WATCH_MAX = 50;

/** Adds a Zelos symbol; false when it isn't one, or the list is full. */
export async function watch(uid: string, sym: string, current: string[]): Promise<boolean> {
  const s = sym.trim().toUpperCase();
  if (!instrument(s) || (current.length >= WATCH_MAX && !current.includes(s))) return false;
  await setDoc(doc(db(), 'users', uid), { watchlist: arrayUnion(s) }, { merge: true });
  return true;
}

export const unwatch = (uid: string, sym: string) => setDoc(doc(db(), 'users', uid), { watchlist: arrayRemove(sym) }, { merge: true });
