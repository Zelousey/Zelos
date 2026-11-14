/**
 * A small live chart of a market ETF for the computer Dashboard (owner 2026-11-14): pick which one
 * (SPY, QQQ, DIA, GLD), drag it sideways to look back through the last few sessions, tap it to open
 * that ETF in the Market. No indicators or tools. It reads the same 5-minute price doc the Market
 * page uses (markets/intraday_<SYM>), so it costs no extra data.
 */
import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useIntraday, useQuotes } from '../../data/markets';
import { instrument } from '../../data/universe';
import { formatPercent, formatPrice } from '../../lib/format';
import { t } from '../../lib/i18n';
import { readString, writeString } from '../../lib/storage';
import { Card, Skeleton } from '../../ui';
import s from './EtfChart.module.css';

export const ETFS = ['SPY', 'QQQ', 'DIA', 'GLD'] as const;
const KEY = 'zelosDashEtf';
const W = 400;
const H = 160;

export function EtfChart({ className }: { className?: string }) {
  const [sym, setSym] = useState<string>(() => {
    const v = readString(KEY) ?? 'SPY';
    return (ETFS as readonly string[]).includes(v) ? v : 'SPY';
  });
  const bars = useIntraday(sym);
  const quotes = useQuotes();
  const q = quotes.status === 'ready' ? quotes.data.quotes[sym] : undefined;
  const list = useMemo(() => (bars.status === 'ready' ? bars.data : []), [bars]);
  // one session's worth of bars on screen; dragging shows earlier ones
  const win = useMemo(() => {
    const last = list[list.length - 1]?.[0].slice(0, 10);
    const n = list.filter((b) => b[0].startsWith(last ?? '-')).length;
    return Math.max(12, Math.min(list.length, n || 78));
  }, [list]);
  const [back, setBack] = useState(0);
  const maxBack = Math.max(0, list.length - win);
  const from = Math.max(0, list.length - win - Math.min(back, maxBack));
  const shown = list.slice(from, from + win);
  const closes = shown.map((b) => b[4]);
  const navigate = useNavigate();
  const drag = useRef<{ x: number; back: number; moved: boolean; w: number } | null>(null);
  const selectId = useId();

  const pick = (v: string) => {
    setSym(v);
    setBack(0);
    writeString(KEY, v);
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, back, moved: false, w: e.currentTarget.getBoundingClientRect().width || 1 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 4) d.moved = true;
    const step = Math.round((dx / d.w) * win);
    setBack(Math.max(0, Math.min(maxBack, d.back + step)));
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) navigate(`/markets/${sym}`);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') navigate(`/markets/${sym}`);
    else if (e.key === 'ArrowLeft') setBack((b) => Math.min(maxBack, b + 6));
    else if (e.key === 'ArrowRight') setBack((b) => Math.max(0, b - 6));
    else return;
    e.preventDefault();
  };

  const lo = Math.min(...closes);
  const hi = Math.max(...closes);
  const span = hi - lo || 1;
  const x = (i: number) => (i / Math.max(1, closes.length - 1)) * W;
  const y = (v: number) => 6 + (1 - (v - lo) / span) * (H - 12);
  const line = closes.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const upDir = closes.length > 1 && closes[closes.length - 1]! >= closes[0]!;
  const color = upDir ? 'var(--bull)' : 'var(--danger)';
  const ch = q?.c && q.pc ? (q.c / q.pc - 1) * 100 : null;
  const range = shown.length ? `${when(shown[0]![0])} – ${when(shown[shown.length - 1]![0])}` : '';
  const gid = useId().replace(/:/g, '');

  return (
    <Card className={[s.card, className].filter(Boolean).join(' ')} flush>
      <div className={s.head}>
        <label htmlFor={selectId} className="visually-hidden">
          {t('etf.pick')}
        </label>
        <select id={selectId} className={s.pick} value={sym} onChange={(e) => pick(e.target.value)}>
          {ETFS.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <span className={s.name}>{instrument(sym)?.name ?? ''}</span>
        <span className={s.quote}>
          {q?.c != null && <b className="num">{formatPrice(q.c)}</b>}
          {ch != null && <span className={`num ${ch >= 0 ? 'up' : 'down'}`}>{formatPercent(ch, { signed: true })}</span>}
        </span>
      </div>
      {bars.status === 'loading' ? (
        <Skeleton height={120} />
      ) : closes.length < 2 ? (
        <p className={s.empty}>{t('etf.none')}</p>
      ) : (
        <div className={s.plot} role="link" tabIndex={0} aria-label={t('etf.open', { sym })} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => (drag.current = null)} onKeyDown={key}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id={`e${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={color} stopOpacity="0.25" />
                <stop offset="1" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${line}L${W},${H}L0,${H}Z`} fill={`url(#e${gid})`} />
            <path d={line} fill="none" stroke={color} strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      <div className={s.foot}>
        <span>{range}</span>
        <Link to={`/markets/${sym}`} className={s.open}>
          {t('etf.market')}
        </Link>
      </div>
    </Card>
  );
}

/** "2026-11-13 10:05" -> "Nov 13 10:05" */
function when(label: string): string {
  const d = new Date(label.slice(0, 10) + 'T12:00:00Z');
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} ${label.slice(11, 16)}`;
}
