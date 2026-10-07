/** Daily history for the charts (loaded once per session; see loadHistory). */
import { useEffect, useState } from 'react';
import { loadHistory, type Bar } from './markets';

export type HistoryState = { status: 'loading' | 'ready' | 'error'; data: Record<string, Bar[]>; retry: () => void };

export function useHistory(enabled = true): HistoryState {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; data: Record<string, Bar[]> }>({ status: 'loading', data: {} });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadHistory().then(
      (data) => live && setState({ status: 'ready', data }),
      () => live && setState({ status: 'error', data: {} }),
    );
    return () => {
      live = false;
    };
  }, [enabled, attempt]);
  return {
    ...state,
    retry: () => {
      setState({ status: 'loading', data: {} });
      setAttempt((a) => a + 1);
    },
  };
}
