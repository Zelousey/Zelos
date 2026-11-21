/**
 * High-risk strategies (Momentum Max, owner 2026-11-19: "maybe don't show them as often. So the
 * normal ones will be shown") stay out of the strategy list and the alerts feed until you turn
 * them on. A per-device choice, kept in this browser.
 */
import { useSyncExternalStore } from 'react';
import { readString, writeString } from '../../lib/storage';
import { STRATEGIES, type Strategy } from './strategies';

const KEY = 'zelosHighRisk';
const listeners = new Set<() => void>();
const read = () => readString(KEY) === '1';

export function setShowHighRisk(on: boolean) {
  writeString(KEY, on ? '1' : '0');
  listeners.forEach((l) => l());
}

export function useShowHighRisk(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => false,
  );
}

export const visibleStrategies = (show: boolean): Strategy[] => STRATEGIES.filter((x) => show || !x.highRisk);
