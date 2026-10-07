/** React hook for a CSS media query. The phone breakpoint matches the classic site's (760px). */
import { useSyncExternalStore } from 'react';

export const PHONE_QUERY = '(max-width: 760px)';
export const WIDE_QUERY = '(min-width: 1200px)';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
    () => false,
  );
}
