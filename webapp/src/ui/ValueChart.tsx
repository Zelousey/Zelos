/**
 * An account's value over time, like a brokerage app (owner 2026-11-12: "say you go up to 11,000,
 * it will show the graph going up to 11,000, and if it goes back down to 10 it still shows it").
 * Green above the starting value, red below; hover or touch to read any point. Used by battles and
 * the War balance; the Solo account has its own fuller chart (practice/AccountChart).
 */
import { useEffect, useId, useRef, useState } from 'react';
import { formatMoney, formatSignedMoney } from '../lib/format';
import s from './ValueChart.module.css';

export type ValuePt = { t: number; v: number };

const H = 120;
const fmtTime = (ms: number) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(ms));

export function ValueChart({ points, base, label }: { points: ValuePt[]; base: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(320);
  const [hover, setHover] = useState<number | null>(null);
  const fillId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pts = points.filter((p) => Number.isFinite(p.v) && Number.isFinite(p.t));
  if (pts.length < 2) return null;
  const vs = pts.map((p) => p.v);
  let lo = Math.min(...vs, base);
  let hi = Math.max(...vs, base);
  const pad = Math.max((hi - lo) * 0.08, hi * 0.001, 0.01);
  lo -= pad;
  hi += pad;
  // even spacing by point (a battle sleeps overnight; time-scaled lines would be mostly flat gaps)
  const x = (i: number) => (i / (pts.length - 1)) * W;
  const y = (v: number) => 4 + (1 - (v - lo) / (hi - lo)) * (H - 8);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const last = pts[pts.length - 1]!;
  const up = last.v >= base;
  const tone = up ? s.up : s.down;
  const shown = hover != null ? pts[hover]! : null;
  const pick = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setHover(Math.max(0, Math.min(pts.length - 1, Math.round(((clientX - r.left) / r.width) * (pts.length - 1)))));
  };
  return (
    <div className={s.wrap}>
      <div className={s.read} aria-live="polite">
        {shown ? (
          <>
            <b>{formatMoney(shown.v)}</b> <span className={shown.v >= base ? 'up' : 'down'}>{formatSignedMoney(shown.v - base)}</span> <span className={s.when}>{fmtTime(shown.t)}</span>
          </>
        ) : (
          <span className={s.when}>{`${fmtTime(pts[0]!.t)} – now`}</span>
        )}
      </div>
      <div
        ref={ref}
        className={[s.plot, tone].join(' ')}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${formatMoney(pts[0]!.v)} to ${formatMoney(last.v)}, high ${formatMoney(Math.max(...vs))}, low ${formatMoney(Math.min(...vs))}`}>
          <defs>
            <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1={0} x2={W} y1={y(base)} y2={y(base)} className={s.base} />
          <path d={`${d}L${W},${H}L0,${H}Z`} fill={`url(#${fillId})`} />
          <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {shown && hover != null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} className={s.cross} />
              <circle cx={x(hover)} cy={y(shown.v)} r={4} fill="currentColor" stroke="var(--surface)" strokeWidth={2} />
            </>
          )}
          {!shown && <circle cx={x(pts.length - 1)} cy={y(last.v)} r={3.5} fill="currentColor" stroke="var(--surface)" strokeWidth={2} />}
        </svg>
      </div>
    </div>
  );
}
