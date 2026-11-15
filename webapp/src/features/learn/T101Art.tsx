/**
 * Trading 101's black-and-red look (owner 2026-11-15): the book covers and the level card's red
 * candles. Drawn in code so every book matches, at any size.
 */
import { useId } from 'react';
import { t } from '../../lib/i18n';
import type { Chapter } from './chapters';
import s from './Learn.module.css';

/** Rising red candles with a glow line under them (seeded, so a book always has the same art). */
export function Candles({ seed = 3, n = 22, className }: { seed?: number; n?: number; className?: string }) {
  const gid = useId().replace(/:/g, '');
  let r = seed * 9301 + 49297;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const W = 200, H = 100, bw = W / n;
  const bars: { x: number; o: number; c: number; h: number; l: number }[] = [];
  let p = 78;
  for (let i = 0; i < n; i++) {
    const o = p, c = Math.max(8, p - (rnd() * 9 - 2.2) * (0.6 + i / n));
    bars.push({ x: i * bw + bw * 0.2, o, c, h: Math.min(o, c) - rnd() * 6, l: Math.max(o, c) + rnd() * 6 });
    p = c;
  }
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`g${gid}`} x1="0" x2="1">
          <stop offset="0" stopColor="#ff2d2d" stopOpacity="0" />
          <stop offset="1" stopColor="#ff2d2d" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      {bars.map((b, i) => (
        <g key={i} opacity={0.25 + (0.75 * i) / n}>
          <line x1={b.x + bw * 0.3} x2={b.x + bw * 0.3} y1={b.h} y2={b.l} stroke="#ff3b3b" strokeWidth="0.8" />
          <rect x={b.x} y={Math.min(b.o, b.c)} width={bw * 0.6} height={Math.max(1.5, Math.abs(b.o - b.c))} fill={b.c < b.o ? '#e53935' : '#5a1515'} />
        </g>
      ))}
      <path d={`M0,${H - 4} Q${W * 0.6},${H - 8} ${W},${H * 0.35}`} fill="none" stroke={`url(#g${gid})`} strokeWidth="1.5" />
    </svg>
  );
}

/** A book cover: BOOK n, the title with its last words in red, TRADING 101, and red candles. */
export function Cover({ c, big = false }: { c: Chapter; big?: boolean }) {
  const words = c.title.split(' ');
  const cut = Math.max(1, words.length - (words.length > 3 ? 2 : 1));
  return (
    <span className={[s.cover, big && s.coverBig].filter(Boolean).join(' ')} aria-hidden>
      <span className={s.coverN}>{t('ln.bookN', { n: c.n })}</span>
      <b className={s.coverTitle}>
        {words.slice(0, cut).join(' ')} <span className={s.coverRed}>{words.slice(cut).join(' ')}</span>
      </b>
      <Candles seed={c.n * 7} className={s.coverArt} />
      <span className={s.coverMark}>{c.advanced ? t('ln.advanced') : c.open ? t('ln.alwaysOpen') : 'Trading 101'}</span>
    </span>
  );
}
