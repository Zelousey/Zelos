/**
 * Shared live Firestore documents.
 *
 * Several screens need the same doc (e.g. markets/quotes on the dashboard, the market
 * list and a chart). `liveDoc()` keeps ONE onSnapshot listener per document, shared by
 * every component that uses it, starts it when the first component mounts and stops it
 * shortly after the last one unmounts. That keeps Firestore reads flat no matter how
 * many widgets show prices.
 */
import { doc, onSnapshot, type DocumentData } from 'firebase/firestore';
import { useSyncExternalStore } from 'react';
import { db } from '../lib/firebase';

export type Loadable<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'missing' } | { status: 'error' };

type Entry<T> = { value: Loadable<T>; listeners: Set<() => void>; unsub: (() => void) | null; stopTimer: number | null };

const LOADING = { status: 'loading' } as const;
const registry = new Map<string, Entry<unknown>>();

function entry<T>(path: string): Entry<T> {
  let e = registry.get(path) as Entry<T> | undefined;
  if (!e) {
    e = { value: LOADING, listeners: new Set(), unsub: null, stopTimer: null };
    registry.set(path, e as Entry<unknown>);
  }
  return e;
}

function start<T>(path: string, parse: (d: DocumentData) => T) {
  const e = entry<T>(path);
  if (e.stopTimer != null) {
    window.clearTimeout(e.stopTimer);
    e.stopTimer = null;
  }
  if (e.unsub) return;
  const emit = (v: Loadable<T>) => {
    e.value = v;
    e.listeners.forEach((l) => l());
  };
  try {
    const [col, ...rest] = path.split('/');
    e.unsub = onSnapshot(
      doc(db(), col!, ...rest),
      (snap) => {
        if (!snap.exists()) return emit({ status: 'missing' });
        try {
          emit({ status: 'ready', data: parse(snap.data()) });
        } catch {
          emit({ status: 'error' });
        }
      },
      () => emit({ status: 'error' }),
    );
  } catch {
    emit({ status: 'error' });
  }
}

function release(path: string) {
  const e = registry.get(path);
  if (!e || e.listeners.size) return;
  // keep the listener a few seconds so moving between screens doesn't re-read the doc
  e.stopTimer = window.setTimeout(() => {
    e.unsub?.();
    e.unsub = null;
    e.stopTimer = null;
  }, 5000);
}

/** Subscribe to a document; `parse` turns raw data into a typed value (and may throw on bad data). */
export function useLiveDoc<T>(path: string | null, parse: (d: DocumentData) => T): Loadable<T> {
  return useSyncExternalStore(
    (onChange) => {
      if (!path) return () => {};
      const e = entry<T>(path);
      e.listeners.add(onChange);
      start(path, parse);
      return () => {
        e.listeners.delete(onChange);
        release(path);
      };
    },
    () => (path ? (entry<T>(path).value as Loadable<T>) : LOADING),
    () => LOADING,
  );
}

/** Test helper: forget every cached doc. */
export function _resetLiveDocs() {
  registry.forEach((e) => e.unsub?.());
  registry.clear();
}
