import { useSyncExternalStore } from 'react';

const Q = '(max-width: 760px)'; // the app's phone layout (same breakpoint as the CSS)

/** True on the phone layout; follows rotation and window resizes. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const m = window.matchMedia(Q);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(Q).matches : false),
    () => false,
  );
}
