/**
 * The share card (owner 2026-11-13, after a brokerage app's post): the price line with where you
 * bought (+) and sold (−), what it did, and a footer with the order and the result in a bold pill.
 * cardImage.ts draws the same thing as a picture to download.
 */
import { useId } from 'react';
import { instrument } from '../../data/universe';
import { formatDate } from '../../lib/format';
import { t } from '../../lib/i18n';
import type { CardChart } from './chartData';
import { heldFor, type BattleCard, type PostSource, type SoloCard } from './posts';
import s from './Posts.module.css';

const pct = (n: number) => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(2) + '%';
export const money = (n: number, signed = true) => (signed ? (n >= 0 ? '+' : '−') : n < 0 ? '−' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const UP = '#2fd67b';
export const DOWN = '#ff5a1f';

/** The price line, a dotted line at the buy (or the start), and the buy / sell markers. */
export function CardLine({ chart, color, base }: { chart: CardChart; color: string; base?: number }) {
  const id = useId();
  const W = 600;
  const H = 190;
  const P = 14;
  const ys = chart.p;
  const ref = base ?? (chart.buy != null ? ys[chart.buy]! : ys[0]!);
  const lo = Math.min(...ys, ref);
  const hi = Math.max(...ys, ref);
  const span = hi - lo || 1;
  const x = (i: number) => P + (i / (ys.length - 1)) * (W - 2 * P);
  const y = (v: number) => P + (1 - (v - lo) / span) * (H - 2 * P);
  const d = ys.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const mark = (i: number, kind: 'buy' | 'sell') => (
    <g key={kind}>
      <circle cx={x(i)} cy={y(ys[i]!)} r={11} fill={color} stroke="#0b0d12" strokeWidth={3} />
      <path d={kind === 'buy' ? `M${x(i) - 5},${y(ys[i]!)}h10M${x(i)},${y(ys[i]!) - 5}v10` : `M${x(i) - 5},${y(ys[i]!)}h10`} stroke="#0b0d12" strokeWidth={2.6} strokeLinecap="round" />
    </g>
  );
  return (
    <svg className={s.line} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={P} x2={W - P} y1={y(ref)} y2={y(ref)} stroke="rgba(255,255,255,0.35)" strokeWidth={2} strokeDasharray="2 9" strokeLinecap="round" />
      <path d={`${d}L${x(ys.length - 1)},${H}L${x(0)},${H}Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {chart.buy != null && mark(chart.buy, 'buy')}
      {chart.sell != null && mark(chart.sell, 'sell')}
      {chart.buy == null && <circle cx={x(ys.length - 1)} cy={y(ys[ys.length - 1]!)} r={7} fill={color} />}
    </svg>
  );
}

export function ShareCard({ source, card }: { source: PostSource; card: SoloCard | BattleCard }) {
  if (source === 'solo') {
    const c = card as SoloCard;
    const up = c.pnl >= 0;
    const color = up ? UP : DOWN;
    const invested = c.entry * c.qty * (c.option ? 100 : 1);
    return (
      <div className={s.card}>
        <div className={s.cardTop}>
          <span className={s.cardName}>{c.option ?? instrument(c.sym)?.name ?? c.sym}</span>
          <b className={s.cardBig} style={{ color }}>
            {money(c.pnl)}
          </b>
          <span className={s.cardChange} style={{ color }}>
            {up ? '▲' : '▼'} {pct(c.pct)}
            <span className={s.cardSince}>{c.openDay && c.closeDay ? ` ${formatDate(c.openDay + 'T12:00:00Z')} → ${formatDate(c.closeDay + 'T12:00:00Z')} · ${heldFor(c.openDay, c.closeDay)}` : ''}</span>
          </span>
        </div>
        {c.chart ? <CardLine chart={c.chart} color={color} /> : <div className={s.noLine} />}
        <div className={s.cardFoot}>
          <span className={s.footText}>
            <b>{c.sym}</b>
            <span>{t('post.order', { qty: c.qty.toLocaleString('en-US'), buy: money(c.entry, false), sell: money(c.exit, false) })}</span>
            <span className={s.footSub}>{t('post.invested', { amount: money(invested, false) })}</span>
          </span>
          <span className={s.pill} style={{ background: color }}>
            {money(c.pnl)}
          </span>
        </div>
      </div>
    );
  }
  const b = card as BattleCard;
  const up = b.pnlPct >= 0;
  const color = up ? UP : DOWN;
  return (
    <div className={s.card}>
      <div className={s.cardTop}>
        <span className={s.cardName}>{b.name}</span>
        <b className={s.cardBig}>{b.rank === 1 ? t('post.won') : t('post.placeOf', { n: b.rank, of: b.of })}</b>
        <span className={s.cardChange} style={{ color }}>
          {up ? '▲' : '▼'} {pct(b.pnlPct)}
          <span className={s.cardSince}> {t('post.trades', { n: b.trades })}</span>
        </span>
      </div>
      {b.chart ? <CardLine chart={b.chart} color={color} base={b.start ?? undefined} /> : <div className={s.noLine} />}
      <div className={s.cardFoot}>
        <span className={s.footText}>
          <b>{t('post.kind.battle')}</b>
          {b.start != null && b.final != null && <span>{t('post.battleMoney', { start: money(b.start, false), final: money(b.final, false) })}</span>}
          <span className={s.footSub}>{t('post.ofTraders', { n: b.of })}</span>
        </span>
        <span className={s.pill} style={{ background: color }}>
          {money(b.pnl)}
        </span>
      </div>
    </div>
  );
}
