/** The signed-in person's watchlist (users/{uid}.watchlist, readable only by them). */
import { useLiveDoc } from '../../data/liveDoc';
import { SYMBOL_RE } from '../../data/markets';

export function useWatchlist(uid: string | null) {
  return useLiveDoc(uid ? `users/${uid}` : null, (d) => (Array.isArray(d.watchlist) ? (d.watchlist as unknown[]).map((x) => String(x).toUpperCase()).filter((x) => SYMBOL_RE.test(x)).slice(0, 50) : []));
}
