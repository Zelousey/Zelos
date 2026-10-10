/**
 * Account value chart (Practice page): 1D / 1W / 1M / 3M like a brokerage app. The value and the
 * newest point follow live prices (markets/quotes and the 1-minute price docs of what you hold);
 * the line is green when you're up over the range and red when you're down. Touch or hover to
 * read any point; "Show as a table" lists the numbers.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useIntraday, type Bar, type Quote } from '../../data/markets';
import { formatDate, formatMoney, formatSignedMoney } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { Tabs } from '../../ui';
import type { Vols } from '../options/model';
import { START_CASH, type Account } from './account';
import s from './AccountChart.module.css';
import { change, CLOSE_MIN, dailyPoints, intradayPoints, OPEN_MIN, previousClose, sessionDay, type Range, type ValuePoint } from './valueSeries';

const H = 180;
const PAD = { l: 4, r: 4, t: 10, b: 10 };
const MAX_FEEDS = 12; // 1-minute price docs read for the 1D line (the biggest holdings)

type Props = { acct: Account; equity: number; quotes: Record<string, Quote>; vols: Vols | null; today: string };

export function AccountChart({ acct, equity, quotes, vols, today }: Props) {
  const [range, setRange] = useState<Range>('1D');
  const [bars, setBars] = useState<Record<string, Bar[]>>({});
  const now = useNow(60_000);
  const nowMin = useMemo(() => {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
    return +(p.find((x) => x.type === 'hour')?.value ?? 0) * 60 + +(p.find((x) => x.type === 'minute')?.value ?? 0);
  }, [now]);
  const feeds = useMemo(() => {
    const val = new Map<string, number>();
    for (const p of acct.positions) val.set(p.sym, (val.get(p.sym) ?? 0) + p.qty * (quotes[p.sym]?.c ?? p.avg));
    for (const o of acct.options) val.set(o.u, (val.get(o.u) ?? 0) + o.qty * 100 * o.avg);
    return [...val.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_FEEDS).map(([sym]) => sym);
  }, [acct.positions, acct.options, quotes]);

  const session = sessionDay(bars, today);
  const base1d = previousClose(acct.hist, session, START_CASH);
  const points = useMemo<ValuePoint[]>(
    () => (range === '1D' ? intradayPoints(acct, bars, quotes, session, today, vols, equity, nowMin) : dailyPoints(acct.hist, today, equity, range)),
    [range, acct, bars, quotes, session, today, vols, equity, nowMin],
  );
  const base = range === '1D' ? base1d : (points[0]?.v ?? equity);
  const ch = change(points, base);
  const [hover, setHover] = useState<ValuePoint | null>(null);
  const shown = hover ?? points[points.length - 1];
  const dir = ch.abs >= 0 ? 'up' : 'down';
  const tableId = useId();

  return (
    <div className={s.wrap}>
      {feeds.map((sym) => (
        <Feed key={sym} sym={sym} onBars={(b) => setBars((x) => (x[sym] === b ? x : { ...x, [sym]: b }))} />
      ))}
      <div className={s.head} aria-live="polite">
        <span className={s.value}>{formatMoney(shown?.v ?? equity)}</span>
        <span className={dir === 'up' ? s.up : s.down}>
          {formatSignedMoney((shown?.v ?? equity) - base)} ({(((shown?.v ?? equity) - base) / (base || 1)) * 100 >= 0 ? '+' : ''}
          {((((shown?.v ?? equity) - base) / (base || 1)) * 100).toFixed(2)}%)
        </span>
        <span className={s.when}>{hover ? whenLabel(hover, range) : range === '1D' && session !== today ? formatDate(session + 'T12:00:00Z') : t(`acct.range.${range}`)}</span>
      </div>
      <Plot points={points} base={base} range={range} dir={dir} onHover={setHover} />
      <Tabs stretch label={t('acct.range')} value={range} onChange={setRange} items={(['1D', '1W', '1M', '3M'] as Range[]).map((r) => ({ value: r, label: r }))} />
      {range === '1D' && (acct.positions.length > 0 || acct.options.length > 0) && <p className={s.note}>{t('acct.todayNote')}</p>}
      <details className={s.table}>
        <summary>{t('acct.table')}</summary>
        <table aria-describedby={tableId}>
          <caption id={tableId}>{t('acct.tableCaption', { range: t(`acct.range.${range}`) })}</caption>
          <thead>
            <tr>
              <th scope="col">{t('acct.col.when')}</th>
              <th scope="col">{t('acct.col.value')}</th>
            </tr>
          </thead>
          <tbody className="num">
            {thin(points, 12).map((p) => (
              <tr key={p.label + p.t}>
                <td>{whenLabel(p, range)}</td>
                <td>{formatMoney(p.v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/** Reads one holding's 1-minute prices (one shared listener per stock). */
function Feed({ sym, onBars }: { sym: string; onBars: (b: Bar[]) => void }) {
  const d = useIntraday(sym);
  const data = d.status === 'ready' ? d.data : null;
  const cb = useRef(onBars);
  useEffect(() => {
    cb.current = onBars;
  });
  useEffect(() => {
    if (data) cb.current(data);
  }, [data]);
  return null;
}

function whenLabel(p: ValuePoint, range: Range): string {
  if (p.label === 'now') return t('acct.now');
  if (range === '1D') {
    const m = +p.label.slice(11, 13) * 60 + +p.label.slice(14, 16);
    const h = Math.floor(m / 60);
    return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }
  return formatDate(p.label + 'T12:00:00Z');
}

function thin(points: ValuePoint[], n: number): ValuePoint[] {
  if (points.length <= n) return points;
  const out: ValuePoint[] = [];
  for (let i = 0; i < n; i++) out.push(points[Math.round((i * (points.length - 1)) / (n - 1))]!);
  return out;
}

function Plot({ points, base, range, dir, onHover }: { points: ValuePoint[]; base: number; range: Range; dir: 'up' | 'down'; onHover: (p: ValuePoint | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(220, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [x0, x1] = range === '1D' ? [OPEN_MIN, CLOSE_MIN] : [points[0]?.t ?? 0, points[points.length - 1]?.t ?? 1];
  const vs = [...points.map((p) => p.v), base];
  let lo = Math.min(...vs);
  let hi = Math.max(...vs);
  const pad = (hi - lo) * 0.1 || Math.max(1, hi * 0.002);
  lo -= pad;
  hi += pad;
  const x = (tt: number) => PAD.l + ((tt - x0) / (x1 - x0 || 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const last = points[points.length - 1];
  const [hx, setHx] = useState<number | null>(null);
  const nearest = (px: number) => points.reduce((b, p) => (Math.abs(x(p.t) - px) < Math.abs(x(b.t) - px) ? p : b), points[0]!);
  const hp = hx != null && points.length ? nearest(hx) : null;
  return (
    <div ref={ref} className={s.plot}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t('acct.chartLabel')}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHx(px);
          onHover(points.length ? nearest(px) : null);
        }}
        onPointerLeave={() => {
          setHx(null);
          onHover(null);
        }}
      >
        <line x1={PAD.l} x2={W - PAD.r} y1={y(base)} y2={y(base)} className={s.base} />
        {points.length > 1 && <path d={d} className={dir === 'up' ? s.lineUp : s.lineDown} />}
        {last && <circle cx={x(last.t)} cy={y(last.v)} r={4} className={dir === 'up' ? s.dotUp : s.dotDown} />}
        {hp && <line x1={x(hp.t)} x2={x(hp.t)} y1={PAD.t} y2={H - PAD.b} className={s.cross} />}
        {hp && <circle cx={x(hp.t)} cy={y(hp.v)} r={4} className={s.crossDot} />}
      </svg>
    </div>
  );
}
