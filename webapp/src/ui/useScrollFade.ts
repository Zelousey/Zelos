/**
 * Rows that scroll sideways (tabs, filters, chart controls) fade at the edge where more
 * is hidden, so it's clear there is more to swipe to (Phase 4 M-2, M-3). Sets
 * `data-fade="start" | "end" | "both"` on the element; the fade itself is in base.css.
 */
import { useEffect, type RefObject } from 'react';

function update(el: HTMLElement) {
  const max = el.scrollWidth - el.clientWidth;
  const start = el.scrollLeft > 2;
  const end = el.scrollLeft < max - 2;
  const v = start && end ? 'both' : start ? 'start' : end ? 'end' : '';
  if (v) el.dataset.fade = v;
  else delete el.dataset.fade;
}

export function useScrollFade(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => update(el);
    on();
    el.addEventListener('scroll', on, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(on);
    ro?.observe(el);
    for (const c of Array.from(el.children)) ro?.observe(c);
    return () => {
      el.removeEventListener('scroll', on);
      ro?.disconnect();
    };
  }, [ref]);
  // contents can change (new tabs, longer labels): re-check after every render
  useEffect(() => {
    if (ref.current) update(ref.current);
  });
}
