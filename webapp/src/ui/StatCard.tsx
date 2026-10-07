/**
 * One number with its label (and optionally its change): account value, day P&L, a price.
 * Put several in a row inside a Card. `delta` is coloured by `direction`.
 */
import type { ReactNode } from 'react';
import s from './StatCard.module.css';

export function Stat({ label, value, delta, direction, hint, size = 'md' }: { label: ReactNode; value: ReactNode; delta?: ReactNode; direction?: 'up' | 'down' | 'flat'; hint?: ReactNode; size?: 'sm' | 'md' }) {
  return (
    <div className={[s.stat, size === 'sm' && s.sm].filter(Boolean).join(' ')}>
      <span className={s.label}>{label}</span>
      <span className={s.value}>{value}</span>
      {delta != null && <span className={[s.delta, direction === 'up' ? 'up' : direction === 'down' ? 'down' : ''].join(' ')}>{delta}</span>}
      {hint != null && <span className={s.hint}>{hint}</span>}
    </div>
  );
}
