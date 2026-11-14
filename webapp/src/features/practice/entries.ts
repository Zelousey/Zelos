/**
 * Entry pins (owner 2026-11-13): where you bought into a position you still hold, for the chart.
 *
 * The server keeps a position as one quantity at an average price, and sells come off it in the
 * order they were bought (first in, first out). So the shares you still hold are your most recent
 * buys, newest first, until they add up to what you hold now; buys from before the position was
 * (re)opened don't count. A closed position has no pins.
 */
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/firebase';
import type { Entry } from '../charts/engine';
import { usePracticeAccount, type HistoryItem } from './account';

type Fill = Pick<HistoryItem, 'kind' | 'side' | 'qty' | 'price' | 'at' | 'opt'> & { day?: string };

/** The buys that make up `qty` held now (oldest first). `opt`: an option contract instead of shares. */
export function openEntries(events: Fill[], qty: number, openedDay: string | null, opt: string | null = null): Entry[] {
  if (!(qty > 0)) return [];
  const buys = events
    .filter((e) => e.kind === 'fill' && e.side === 'buy' && (opt ? e.opt === opt : !e.opt) && e.qty && e.price && e.at && (!openedDay || !e.day || e.day >= openedDay))
    .sort((a, b) => b.at - a.at);
  const out: Entry[] = [];
  let left = qty;
  for (const b of buys) {
    if (left <= 0) break;
    const q = Math.min(left, b.qty!);
    out.push({ at: b.at, price: b.price!, qty: q });
    left -= q;
  }
  return out.reverse();
}

/** This stock's (or contract's) fill history from practiceAccounts/{uid}/history. */
export function useFills(uid: string | null, sym: string | null) {
  const [state, setState] = useState<{ key: string; items: Fill[] }>({ key: '', items: [] });
  const key = uid && sym ? `${uid}:${sym}` : '';
  useEffect(() => {
    if (!uid || !sym) return;
    const q = query(collection(db(), 'practiceAccounts', uid, 'history'), where('sym', '==', sym), limit(500));
    return onSnapshot(
      q,
      (snap) => setState({ key: `${uid}:${sym}`, items: snap.docs.map((d) => d.data() as Fill) }),
      () => setState({ key: `${uid}:${sym}`, items: [] }),
    );
  }, [uid, sym]);
  return state.key === key ? state.items : [];
}

/** Entry pins for a held stock (or option contract). */
export function useEntries(uid: string | null, sym: string | null, qty: number, openedDay: string | null, opt: string | null = null): Entry[] {
  const fills = useFills(uid, sym);
  return useMemo(() => openEntries(fills, qty, openedDay, opt), [fills, qty, openedDay, opt]);
}

/** Entry pins for the signed-in player's Solo position in this stock (none when not held). */
export function useHeldEntries(sym: string): Entry[] {
  const { user, isReal } = useAuth();
  const uid = isReal && user ? user.uid : null;
  const acct = usePracticeAccount(uid);
  const pos = acct.status === 'ready' ? acct.data.positions.find((p) => p.sym === sym) : undefined;
  return useEntries(pos ? uid : null, pos ? sym : null, pos?.qty ?? 0, pos?.openedDay ?? null);
}
