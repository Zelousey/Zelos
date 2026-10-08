/**
 * A mini chart card: symbol, price, today's change and the last month as a small area
 * chart, coloured by the month's direction. Taps through to the big chart.
 */
import { useId } from 'react';
import { Link } from 'react-router';
import { formatPercent, formatPrice } from '../../lib/format';
import { Change, Skeleton } from '../../ui';
import type { Mini } from './miniSeries';
import s from './MiniChart.module.css';

export function MiniLine({ closes, width = 160, height = 48 }: { closes: number[]; width?: number; height?: number }) {
  const id = useId().replace(/:/g, '');
  if (closes.length < 2) return <svg width="100%" height={height} aria-hidden />;
  const lo = Math.min(...closes);
  const hi = Math.max(...closes);
  const span = hi - lo || 1;
  const x = (i: number) => (i / (closes.length - 1)) * width;
  const y = (v: number) => 3 + (1 - (v - lo) / span) * (height - 6);
  const line = closes.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const up = closes[closes.length - 1]! >= closes[0]!;
  const color = up ? 'var(--bull)' : 'var(--danger)';
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`m${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line}L${width},${height}L0,${height}Z`} fill={`url(#m${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export function MiniChart({ sym, name, mini, loading, active, replace }: { sym: string; name: string; mini: Mini; loading?: boolean; active?: boolean; replace?: boolean }) {
  const label = `${sym}, ${name}: ${formatPrice(mini.price)}, ${formatPercent(mini.chPct)} today${mini.periodPct != null ? `, ${formatPercent(mini.periodPct)} over the last month` : ''}`;
  return (
    <Link to={`/markets/${encodeURIComponent(sym)}`} replace={replace} className={[s.card, active && s.active].filter(Boolean).join(' ')} aria-label={label} aria-current={active ? 'page' : undefined}>
      <span className={s.top}>
        <span className={s.sym}>{sym}</span>
        <Change pct={mini.chPct} className={s.chg} />
      </span>
      <span className={s.name}>{name}</span>
      <span className={s.price}>{formatPrice(mini.price)}</span>
      <span className={s.chart}>{loading ? <Skeleton height={44} /> : <MiniLine closes={mini.closes} />}</span>
    </Link>
  );
}
