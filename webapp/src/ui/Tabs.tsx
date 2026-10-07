/**
 * Segmented tabs (timeframes, list filters, Buy/Sell). Keyboard: arrow keys move
 * between tabs, as the WAI-ARIA tabs pattern expects. Controlled: pass `value` and
 * `onChange`; the panel content is the caller's job.
 */
import { useRef, type KeyboardEvent } from 'react';
import s from './Tabs.module.css';

export type TabItem<T extends string> = { value: T; label: string };

export function Tabs<T extends string>({ items, value, onChange, label, stretch }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void; label: string; stretch?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = items.findIndex((it) => it.value === value);
    const next = items[(i + (e.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length];
    if (!next) return;
    onChange(next.value);
    ref.current?.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus();
    e.preventDefault();
  }
  return (
    <div ref={ref} role="tablist" aria-label={label} className={[s.list, stretch && s.stretch].filter(Boolean).join(' ')} onKeyDown={onKey}>
      {items.map((it) => (
        <button key={it.value} type="button" role="tab" data-value={it.value} aria-selected={it.value === value} tabIndex={it.value === value ? 0 : -1} className={s.tab} onClick={() => onChange(it.value)}>
          {it.label}
        </button>
      ))}
    </div>
  );
}
