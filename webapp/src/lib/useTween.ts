import { useEffect, useRef, useState } from 'react';

/**
 * A number that glides to its new value instead of jumping (owner 2026-11-15: the Dashboard should
 * feel live). 500ms ease-out; with "reduce motion" it jumps straight there.
 */
export function useTween(target: number, ms = 500): number {
  const [v, setV] = useState(target);
  const from = useRef(target);
  const raf = useRef(0);
  useEffect(() => {
    const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const start = from.current;
    if (still || start === target || !Number.isFinite(start)) {
      from.current = target;
      raf.current = requestAnimationFrame(() => setV(target));
      return () => cancelAnimationFrame(raf.current);
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const cur = start + (target - start) * e;
      from.current = cur;
      setV(cur);
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);
  return v;
}
