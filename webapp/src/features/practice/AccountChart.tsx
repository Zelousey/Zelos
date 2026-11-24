/**
 * Account value chart (Practice page): 1D / 1W / 1M / 3M like a brokerage app. The value and the
 * newest point follow live prices (markets/quotes and the 1-minute price docs of what you hold);
 * the line is green when you're up over the range and red when you're down. Touch or hover to
 * read any point. The ⋯ button (owner 2026-11-15) holds "Show as a table" and the trade markers:
 * your biggest winning and losing closed trades in the range and the biggest drop (chartMarks.ts),
 * each a dot on the line; tap one to read it. Choices are remembered on this device.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useIntraday, type Bar, type Quote } from '../../data/markets';
import { formatDate, formatMoney, formatSignedMoney } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { useTween } from '../../lib/useTween';
import { readJSON, writeString } from '../../lib/storage';
import { Button, Icon, Tabs } from '../../ui';
import { chartMarks, type Mark } from './chartMarks';
import type { Vols } from '../options/model';
import { START_CASH, type Account, type HistoryItem } from './account';
import s from './AccountChart.module.css';
import { nyDay } from '../charts/series';
import { change, CLOSE_MIN, dailyPoints, feedDays, intradayPoints, nyMinute, OPEN_MIN, previousClose, sessionDay, type DayFill, type Range, type ValuePoint } from './valueSeries';

const PLOT_H = 180;
/** the last 1-minute prices of each holding, kept while the app is open so the 1D line is right the moment you come back */
const barsCache = new Map<string, Bar[]>();
const PAD = { l: 4, r: 4, t: 10, b: 10 };
const MAX_FEEDS = 12; // 1-minute price docs read for the 1D line (the biggest holdings)

type Props = { acct: Account; equity: number; quotes: Record<string, Quote>; vols: Vols | null; today: string; history?: HistoryItem[]; trades?: HistoryItem[]; fills?: HistoryItem[]; /** the line's height in px (the computer Dashboard makes it taller) */ plotHeight?: number; /** the line fills all the height the card gets (computer Dashboard) */ grow?: boolean; /** false until today's fills have loaded: 1D waits instead of drawing the day without your trades */ fillsReady?: boolean };
type Opts = { table: boolean; fill: boolean; glow: boolean; markers: boolean; wins: boolean; losses: boolean; drawdown: boolean; line: LineColor; bg: ChartBg };
const OPTS_KEY = 'zelosAcctChart';
// owner 2026-11-23: no shading and no glow unless you turn them on; line and background colours are yours to pick
const DEFAULT_OPTS: Opts = { table: false, fill: false, glow: false, markers: true, wins: true, losses: true, drawdown: true, line: 'green', bg: 'black' }; // owner 2026-11-24: black background, green line
/** Line colours: auto = green when up, red when down. */
export const LINE_COLORS = { auto: '', green: '#33b86e', blue: '#4a86ff', white: '#e6e8ec', purple: '#a78bfa' } as const;
/** Chart backgrounds: card = the card's own colour. */
export const CHART_BGS = { card: '', black: '#000000', navy: '#0b1730', charcoal: '#1b1e24', forest: '#0c1f15' } as const;
type LineColor = keyof typeof LINE_COLORS;
type ChartBg = keyof typeof CHART_BGS;
const isLine = (v: unknown): v is LineColor => typeof v === 'string' && v in LINE_COLORS;
const isBg = (v: unknown): v is ChartBg => typeof v === 'string' && v in CHART_BGS;
function readOpts(): Opts {
  const saved = readJSON<Partial<Opts>>(OPTS_KEY, {});
  const o = { ...DEFAULT_OPTS, ...saved };
  return { ...o, line: isLine(o.line) ? o.line : DEFAULT_OPTS.line, bg: isBg(o.bg) ? o.bg : DEFAULT_OPTS.bg };
}

export function AccountChart({ acct, equity, quotes, vols, today, history = [], trades = [], fills: allFills = [], plotHeight, grow = false, fillsReady = true }: Props) {
  const [range, setRange] = useState<Range>('1D');
  const [opts, setOptsState] = useState<Opts>(readOpts);
  const save = (f: (o: Opts) => Opts) =>
    setOptsState((o) => {
      const n = f(o);
      writeString(OPTS_KEY, JSON.stringify(n));
      return n;
    });
  const setOpt = (k: 'table' | 'fill' | 'glow' | 'markers' | 'wins' | 'losses' | 'drawdown') => save((o) => ({ ...o, [k]: !o[k] }));
  const [menu, setMenu] = useState(false);
  const [picked, setPicked] = useState<Mark | null>(null);
  const [bars, setBars] = useState<Record<string, Bar[]>>(() => Object.fromEntries(barsCache));
  const now = useNow(60_000);
  const nowMin = useMemo(() => {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
    return +(p.find((x) => x.type === 'hour')?.value ?? 0) * 60 + +(p.find((x) => x.type === 'minute')?.value ?? 0);
  }, [now]);
  const feeds = useMemo(() => {
    const val = new Map<string, number>();
    for (const p of acct.positions) val.set(p.sym, (val.get(p.sym) ?? 0) + p.qty * (quotes[p.sym]?.c ?? p.avg));
    for (const o of acct.options) val.set(o.u, (val.get(o.u) ?? 0) + o.qty * 100 * o.avg);
    // what you sold on the day 1D shows too, so the morning still moves with its price. On a
    // weekend or holiday 1D shows the last session (Friday), so that day's fills count as well:
    // without them a stock bought and sold on Friday had no prices and drew as flat steps.
    const list = allFills.length ? allFills : history;
    const days = feedDays(list.filter((h) => h.kind === 'fill').map((h) => nyDay(h.at)), today);
    for (const h of list) if (h.kind === 'fill' && h.sym && days.has(nyDay(h.at)) && !val.has(h.sym)) val.set(h.sym, (h.qty ?? 0) * (h.price ?? 0) * (h.opt ? 100 : 1));
    return [...val.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_FEEDS).map(([sym]) => sym);
  }, [acct.positions, acct.options, quotes, history, allFills, today]);

  const session = sessionDay(bars, today);
  const fills = useMemo<DayFill[]>(
    () =>
      (allFills.length ? allFills : history)
        .filter((h) => h.kind === 'fill' && h.sym && (h.side === 'buy' || h.side === 'sell') && h.qty && h.price != null && nyDay(h.at) === session)
        .map((h) => ({ m: nyMinute(h.at), sym: h.sym, opt: h.opt, side: h.side as 'buy' | 'sell', qty: h.qty!, price: h.price! })),
    [allFills, history, session],
  );
  const base1d = previousClose(acct.hist, session, START_CASH);
  const points = useMemo<ValuePoint[]>(
    () => (range === '1D' ? (fillsReady ? intradayPoints(acct, bars, quotes, session, today, vols, equity, nowMin, fills) : []) : dailyPoints(acct.hist, today, equity, range)),
    [range, acct, bars, quotes, session, today, vols, equity, nowMin, fills, fillsReady],
  );
  const base = range === '1D' ? base1d : (points[0]?.v ?? equity);
  const ch = change(points, base);
  const [hover, setHover] = useState<ValuePoint | null>(null);
  const shown = hover ?? points[points.length - 1];
  const tweenEq = useTween(shown?.v ?? equity);
  const dir = ch.abs >= 0 ? 'up' : 'down';
  const tableId = useId();
  const marks = useMemo(() => (opts.markers ? chartMarks(trades.length ? trades : history, points, range, session, opts) : []), [opts, trades, history, points, range, session]);
  const menuId = useId();

  return (
    <div
      className={[s.wrap, grow && s.wrapGrow, opts.glow && s.glow].filter(Boolean).join(' ')}
      data-dir={dir}
      style={{ ...(LINE_COLORS[opts.line] ? { ['--acct-up' as string]: LINE_COLORS[opts.line], ['--acct-down' as string]: LINE_COLORS[opts.line] } : {}), ...(CHART_BGS[opts.bg] ? { ['--acct-bg' as string]: CHART_BGS[opts.bg] } : {}) }}
    >
      {feeds.map((sym) => (
        <Feed key={sym} sym={sym} onBars={(b) => (barsCache.set(sym, b), setBars((x) => (x[sym] === b ? x : { ...x, [sym]: b })))} />
      ))}
      <div className={s.head} aria-live="polite">
        {/* the value glides to each new number; while you scrub the line it shows that point exactly */}
        <span className={s.value}>{formatMoney(hover ? (shown?.v ?? equity) : tweenEq)}</span>
        <span className={[s.pill, (shown?.v ?? equity) - base >= 0 ? s.pillUp : s.pillDown].join(' ')}>
          <span aria-hidden="true">{(shown?.v ?? equity) - base >= 0 ? '▲' : '▼'}</span>
          {formatSignedMoney((shown?.v ?? equity) - base)} ({(((shown?.v ?? equity) - base) / (base || 1)) * 100 >= 0 ? '+' : ''}
          {((((shown?.v ?? equity) - base) / (base || 1)) * 100).toFixed(2)}%)
        </span>
        <span className={s.when}>{hover ? whenLabel(hover, range) : range === '1D' && session !== today ? formatDate(session + 'T12:00:00Z') : t(`acct.range.${range}`)}</span>
      </div>
      <Plot points={points} base={base} range={range} dir={dir} onHover={setHover} marks={marks} picked={picked} onPick={setPicked} H={plotHeight} fill={opts.fill} grow={grow} />
      {picked && (
        <div className={[s.pick, s[picked.kind]].join(' ')} role="status">
          <span>
            <b>{picked.title}</b>
            <small>{picked.detail}</small>
          </span>
          <Button variant="ghost" size="sm" iconOnly aria-label={t('common.close')} onClick={() => setPicked(null)}>
            <Icon name="close" size={16} />
          </Button>
        </div>
      )}
      <div className={s.controls}>
        <Tabs compact label={t('acct.range')} value={range} onChange={(r) => (setRange(r), setPicked(null))} items={(['1D', '1W', '1M', '3M'] as Range[]).map((r) => ({ value: r, label: r }))} />
        <span className={s.menuWrap}>
          <Button variant="ghost" size="sm" iconOnly aria-label={t('cho.title')} aria-haspopup="true" aria-expanded={menu} aria-controls={menuId} onClick={() => setMenu((m) => !m)}>
            <Icon name="more" size={18} />
          </Button>
          {menu && (
            <div className={s.menu} id={menuId} role="group" aria-label={t('cho.title')}>
              {(
                [
                  ['table', 'cho.table'],
                  ['fill', 'cho.fill'],
                  ['glow', 'cho.glow'],
                  ['markers', 'cho.markers'],
                  ['wins', 'cho.wins'],
                  ['losses', 'cho.losses'],
                  ['drawdown', 'cho.drawdown'],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className={[s.opt, SUB.has(k) && s.sub, SUB.has(k) && !opts.markers && s.off].filter(Boolean).join(' ')}>
                  <input type="checkbox" checked={opts[k]} disabled={SUB.has(k) && !opts.markers} onChange={() => setOpt(k)} />
                  {t(label)}
                </label>
              ))}
              {opts.markers && !marks.some((m) => m.kind !== 'drawdown') && <p className={s.menuNote}>{t('cho.none')}</p>}
              <Swatches label={t('cho.lineColor')} value={opts.line} colors={LINE_COLORS} names={LINE_NAMES} onPick={(v) => save((o) => ({ ...o, line: v }))} />
              <Swatches label={t('cho.bg')} value={opts.bg} colors={CHART_BGS} names={BG_NAMES} onPick={(v) => save((o) => ({ ...o, bg: v }))} />
            </div>
          )}
        </span>
      </div>
      {opts.table && (
      <div className={s.table}>
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
      </div>
      )}
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

const SUB = new Set(['wins', 'losses', 'drawdown']);
const LINE_NAMES: Record<LineColor, Parameters<typeof t>[0]> = { auto: 'cho.c.auto', green: 'cho.c.green', blue: 'cho.c.blue', white: 'cho.c.white', purple: 'cho.c.purple' };
const BG_NAMES: Record<ChartBg, Parameters<typeof t>[0]> = { card: 'cho.c.card', black: 'cho.c.black', navy: 'cho.c.navy', charcoal: 'cho.c.charcoal', forest: 'cho.c.forest' };

/** A row of colour swatches in the chart menu (one is chosen). */
function Swatches<K extends string>({ label, value, colors, names, onPick }: { label: string; value: K; colors: Record<K, string>; names: Record<K, Parameters<typeof t>[0]>; onPick: (k: K) => void }) {
  return (
    <div className={s.swatchRow} role="radiogroup" aria-label={label}>
      <span className={s.swatchLabel}>{label}</span>
      <span className={s.swatches}>
        {(Object.keys(colors) as K[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={value === k}
            aria-label={t(names[k])}
            title={t(names[k])}
            className={[s.swatch, value === k && s.swatchOn, !colors[k] && s.swatchAuto].filter(Boolean).join(' ')}
            style={colors[k] ? { background: colors[k] } : undefined}
            onClick={() => onPick(k)}
          />
        ))}
      </span>
    </div>
  );
}

function Plot({ points, base, range, dir, onHover, marks = [], picked, onPick, H: fixedH = PLOT_H, fill = true, grow = false }: { points: ValuePoint[]; base: number; range: Range; dir: 'up' | 'down'; onHover: (p: ValuePoint | null) => void; marks?: Mark[]; picked?: Mark | null; onPick?: (m: Mark | null) => void; H?: number; fill?: boolean; grow?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);
  // grow (computer Dashboard, owner 2026-11-15): the line takes all the height its box has, so
  // there's never empty space under it when the column beside it is taller
  const [boxH, setBoxH] = useState(fixedH);
  const H = grow ? boxH : fixedH;
  // measured before the first paint, so the line never draws at a guessed size and then jumps
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width) setW(Math.max(220, Math.round(r.width)));
    if (grow && r.height) setBoxH(Math.max(160, Math.round(r.height)));
    if (typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(([e]) => {
      setW(Math.max(220, Math.round(e!.contentRect.width)));
      if (grow) setBoxH(Math.max(160, Math.round(e!.contentRect.height)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [grow]);
  const [x0, x1] = range === '1D' ? [OPEN_MIN, CLOSE_MIN] : [points[0]?.t ?? 0, points[points.length - 1]?.t ?? 1];
  // the scale follows the line; the starting value joins it only when it's near, so one far-off
  // reference (a big deposit, a reset) doesn't squash the day's moves into a flat line
  const pv = points.map((p) => p.v);
  let lo = Math.min(...pv, pv.length ? Infinity : base);
  let hi = Math.max(...pv, pv.length ? -Infinity : base);
  const span = Math.max(hi - lo, hi * 0.004);
  const showBase = base >= lo - span * 1.5 && base <= hi + span * 1.5;
  if (showBase) {
    lo = Math.min(lo, base);
    hi = Math.max(hi, base);
  }
  const pad = (hi - lo) * 0.1 || Math.max(1, hi * 0.002);
  lo -= pad;
  hi += pad;
  const x = (tt: number) => PAD.l + ((tt - x0) / (x1 - x0 || 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const last = points[points.length - 1];
  const first = points[0];
  const area = first && last && points.length > 1 ? `${d}L${x(last.t).toFixed(1)},${H}L${x(first.t).toFixed(1)},${H}Z` : '';
  const gradId = useId();
  const [hx, setHx] = useState<number | null>(null);
  const nearest = (px: number) => points.reduce((b, p) => (Math.abs(x(p.t) - px) < Math.abs(x(b.t) - px) ? p : b), points[0]!);
  const hp = hx != null && points.length ? nearest(hx) : null;
  // Phones (owner 2026-11-15): a finger dragged sideways across the line moves the crosshair and
  // holds the page still; a mostly-vertical drag still scrolls the page. The direction is decided on
  // the first move (iPhone Safari only lets a page scroll be stopped at its very start).
  const scrub = useRef<(clientX: number | null) => void>(() => {});
  useEffect(() => {
    scrub.current = (cx) => {
      const el = ref.current?.querySelector('svg');
      if (cx == null || !el || !points.length) {
        setHx(null);
        onHover(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const px = ((cx - r.left) / (r.width || 1)) * W;
      setHx(px);
      onHover(nearest(px));
    };
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: { x: number; y: number } | null = null;
    let lock: 'x' | 'y' | null = null;
    const onStart = (e: TouchEvent) => {
      const t0 = e.touches[0];
      start = t0 && e.touches.length === 1 ? { x: t0.clientX, y: t0.clientY } : null;
      lock = null;
    };
    const onMove = (e: TouchEvent) => {
      const t0 = e.touches[0];
      if (!start || !t0) return;
      if (!lock) lock = Math.abs(t0.clientX - start.x) >= Math.abs(t0.clientY - start.y) ? 'x' : 'y';
      if (lock !== 'x') return;
      e.preventDefault();
      scrub.current(t0.clientX);
    };
    const onEnd = () => {
      if (lock === 'x') scrub.current(null);
      start = null;
      lock = null;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);
  return (
    <div ref={ref} className={[s.plot, grow && s.plotGrow].filter(Boolean).join(' ')}>
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
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" className={dir === 'up' ? s.gUp : s.gDown} stopOpacity="0.22" />
            <stop offset="1" className={dir === 'up' ? s.gUp : s.gDown} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* faint price lines behind the account line */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + f * (H - PAD.t - PAD.b)} y2={PAD.t + f * (H - PAD.t - PAD.b)} className={s.grid} />
        ))}
        {showBase && <line x1={PAD.l} x2={W - PAD.r} y1={y(base)} y2={y(base)} className={s.base} />}
        {area && fill && <path d={area} fill={`url(#${gradId})`} />}
        {points.length > 1 && <path d={d} className={dir === 'up' ? s.lineUp : s.lineDown} />}
        {last && <circle cx={x(last.t)} cy={y(last.v)} r={4} className={dir === 'up' ? s.dotUp : s.dotDown} />}
        {hp && <line x1={x(hp.t)} x2={x(hp.t)} y1={PAD.t} y2={H - PAD.b} className={s.cross} />}
        {hp && <circle cx={x(hp.t)} cy={y(hp.v)} r={4} className={s.crossDot} />}
      </svg>
      {/* trade markers: real buttons over the line (a button can't sit inside the chart image) */}
      {marks.map((m, i) => (
        <button
          key={i}
          type="button"
          aria-label={`${m.title}. ${m.detail}`}
          aria-pressed={picked === m}
          className={[s.mark, s[m.kind], picked === m && s.markOn].filter(Boolean).join(' ')}
          style={{ left: `${(x(m.t) / W) * 100}%`, top: y(m.v) }}
          onClick={() => onPick?.(picked === m ? null : m)}
        />
      ))}
    </div>
  );
}
