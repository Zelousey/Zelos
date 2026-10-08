/**
 * A live Firestore query for one screen (onSnapshot while mounted). Unlike liveDoc it isn't
 * shared between components: use it for lists only one screen shows at a time.
 */
import { onSnapshot, type DocumentData, type Query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import type { Loadable } from './liveDoc';

export function useLiveQuery<T>(key: string | null, make: () => Query<DocumentData>, parse: (id: string, d: DocumentData) => T | null): Loadable<T[]> {
  const [state, setState] = useState<{ key: string | null; value: Loadable<T[]> }>({ key: null, value: { status: 'loading' } });
  useEffect(() => {
    if (!key) return;
    return onSnapshot(
      make(),
      (snap) => setState({ key, value: { status: 'ready', data: snap.docs.map((d) => parse(d.id, d.data())).filter((x): x is T => x != null) } }),
      () => setState({ key, value: { status: 'error' } }),
    );
    // `make` and `parse` are stable for a given key by contract
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state.key === key && key ? state.value : { status: 'loading' };
}
