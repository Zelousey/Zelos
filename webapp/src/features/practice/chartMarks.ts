/**
 * Markers on the account chart (owner 2026-11-15): the closed trades that moved the account most
 * in the range shown (up to 3 winners and 3 losers) and the biggest drop from a high to a low.
 * Only real records: closed trades from practiceAccounts/{uid}/history and the plotted values.
 * Pure (chartMarks.test.ts).
 */
import { formatDate, formatMoney, formatSignedMoney } from '../../lib/format';
import { t } from '../../lib/i18n';
import { nyDay } from '../charts/series';
import type { HistoryItem } from './account';
import { dayNum, nyMinute, type Range, type ValuePoint } from './valueSeries';

export type MarkKind = 'win' | 'loss' | 'drawdown';
export type Mark = { t: number; v: number; kind: MarkKind; title: string; detail: string };
export type MarkOptions = { wins: boolean; losses: boolean; drawdown: boolean };

const TOP = 3;
const MIN_DROP = 0.02; // a drop under 2% isn't an event

/** The point on the line nearest to time tt (for a marker's height). */
function at(points: ValuePoint[], tt: number): ValuePoint | null {
  if (!points.length) return null;
  return points.reduce((b, p) => (Math.abs(p.t - tt) < Math.abs(b.t - tt) ? p : b), points[0]!);
}

export function tradeMarks(trades: HistoryItem[], points: ValuePoint[], range: Range, session: string): Mark[] {
  if (points.length < 2) return [];
  const t0 = points[0]!.t;
  const t1 = points[points.length - 1]!.t;
  const inRange = trades
    .filter((h) => h.kind === 'trade' && typeof h.pnl === 'number' && h.pnl !== 0 && h.at)
    .map((h) => ({ h, tt: range === '1D' ? (nyDay(h.at) === session ? nyMinute(h.at) : NaN) : dayNum(h.closeDay ?? nyDay(h.at)) }))
    .filter((x) => Number.isFinite(x.tt) && x.tt >= t0 && x.tt <= t1);
  const wins = inRange.filter((x) => x.h.pnl! > 0).sort((a, b) => b.h.pnl! - a.h.pnl!).slice(0, TOP);
  const losses = inRange.filter((x) => x.h.pnl! < 0).sort((a, b) => a.h.pnl! - b.h.pnl!).slice(0, TOP);
  return [...wins, ...losses].map(({ h, tt }) => {
    const p = at(points, tt)!;
    const what = h.label ?? h.sym;
    const pct = typeof h.pct === 'number' ? ` (${h.pct >= 0 ? '+' : ''}${h.pct.toFixed(1)}%)` : '';
    return {
      t: p.t,
      v: p.v,
      kind: h.pnl! > 0 ? 'win' : 'loss',
      title: `${t('mk.closed', { what })} ${formatSignedMoney(h.pnl!)}${pct}`,
      detail: [h.qty ? t('mk.qty', { n: h.qty }) : null, h.entry != null && h.exit != null ? t('mk.entryExit', { entry: formatMoney(h.entry), exit: formatMoney(h.exit) }) : null, formatDate(h.at)].filter(Boolean).join(' · '),
    };
  });
}

/** The biggest fall from a high to a later low in the points shown, if it's at least 2%. */
export function drawdownMark(points: ValuePoint[], range: Range): Mark | null {
  let peak = points[0];
  let best: { from: ValuePoint; to: ValuePoint; drop: number } | null = null;
  for (const p of points) {
    if (!peak || p.v > peak.v) peak = p;
    const drop = peak.v > 0 ? (peak.v - p.v) / peak.v : 0;
    if (drop > (best?.drop ?? 0)) best = { from: peak, to: p, drop };
  }
  if (!best || best.drop < MIN_DROP) return null;
  const when = (p: ValuePoint) => (range === '1D' ? p.label.slice(11, 16) || t('acct.now') : p.label === 'now' ? t('acct.now') : formatDate(p.label + 'T12:00:00Z'));
  return {
    t: best.to.t,
    v: best.to.v,
    kind: 'drawdown',
    title: t('mk.drop', { pct: (best.drop * 100).toFixed(1) }),
    detail: t('mk.dropDetail', { from: formatMoney(best.from.v), fromAt: when(best.from), to: formatMoney(best.to.v), toAt: when(best.to) }),
  };
}

export function chartMarks(trades: HistoryItem[], points: ValuePoint[], range: Range, session: string, o: MarkOptions): Mark[] {
  const out = tradeMarks(trades, points, range, session).filter((m) => (m.kind === 'win' ? o.wins : o.losses));
  const dd = o.drawdown ? drawdownMark(points, range) : null;
  return dd ? [...out, dd] : out;
}
