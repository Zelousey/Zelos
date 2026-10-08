import { useEffect, useState } from 'react';

/** The current time, refreshed every `everyMs` (for countdowns, "open now" states and day rollovers). */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}
