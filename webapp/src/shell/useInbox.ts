/**
 * The bell: notifications the server writes to users/{uid}/inbox (challenges, battle
 * updates, friends, fills). firestore.rules let a person read their own inbox, mark
 * items read and delete them; only the server can create them.
 */
import { collection, doc, limit, onSnapshot, orderBy, query, writeBatch } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { db } from '../lib/firebase';

const EMPTY: InboxItem[] = [];

export type InboxItem = { id: string; kind: string; title: string; body: string; link?: string; at: number; read: boolean };

export function useInbox(uid: string | null) {
  // State is tagged with the uid it belongs to, so switching accounts never shows the
  // previous person's notifications, without resetting state inside the effect.
  const [state, setState] = useState<{ uid: string | null; items: InboxItem[]; error: boolean }>({ uid: null, items: [], error: false });

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db(), 'users', uid, 'inbox'), orderBy('at', 'desc'), limit(30));
    return onSnapshot(
      q,
      (snap) =>
        setState({
          uid,
          error: false,
          items: snap.docs.map((d) => {
            const x = d.data();
            return { id: d.id, kind: String(x.kind ?? ''), title: String(x.title ?? ''), body: String(x.body ?? ''), link: typeof x.link === 'string' ? x.link : undefined, at: Number(x.at) || 0, read: !!x.read };
          }),
        }),
      () => setState({ uid, items: [], error: true }),
    );
  }, [uid]);

  const mine = state.uid === uid && uid != null;
  const items = mine ? state.items : EMPTY;
  const error = mine && state.error;

  const markAllRead = useCallback(async () => {
    if (!uid) return;
    const unread = items.filter((i) => !i.read);
    if (!unread.length) return;
    const batch = writeBatch(db());
    unread.forEach((i) => batch.update(doc(db(), 'users', uid, 'inbox', i.id), { read: true }));
    await batch.commit().catch(() => {});
  }, [uid, items]);

  return { items, unread: items.filter((i) => !i.read).length, error, markAllRead };
}
