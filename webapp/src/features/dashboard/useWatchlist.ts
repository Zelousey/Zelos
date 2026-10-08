/** The signed-in person's watchlist (users/{uid}.watchlist, readable only by them). */
import { useMemo } from 'react';
import type { Loadable } from '../../data/liveDoc';
import { useUserDoc } from '../../data/userDoc';

export function useWatchlist(uid: string | null): Loadable<string[]> {
  const doc = useUserDoc(uid);
  return useMemo(() => (doc.status === 'ready' ? { status: 'ready', data: doc.data.watchlist } : doc), [doc]);
}
