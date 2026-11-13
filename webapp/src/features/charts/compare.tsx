/**
 * Compare a stock with its sector or an index (owner's chart plan, step 6: "comparing the stock
 * against its sector", 2026-11-12). The sector is the average of the other Zelos stocks in the
 * same group (Tech, Finance, ...): the server keeps no price history for sector funds like XLK,
 * and adding them would cost price-feed calls. SPY and QQQ are in the Zelos list already.
 * The engine draws the result as a dashed line started at this stock's price on the left edge.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useIntraday, useQuotes, type Bar } from '../../data/markets';
import { useHistory } from '../../data/useHistory';
import { instrument, UNIVERSE } from '../../data/universe';
import { t } from '../../lib/i18n';
import { barsFor, type Timeframe } from './series';
import { Button, Icon } from '../../ui';
import ds from './DrawTools.module.css';

export type CompareTarget = 'sector' | 'SPY' | 'QQQ';
export type CompareLine = { label: string; color: string; r: (number | null)[] };

/** The stocks a sector average is made of: the same group, not the stock itself; intraday only the day-trading ones (they have minute prices). */
export function sectorMembers(sym: string, intraday: boolean): string[] {
  const me = instrument(sym);
  if (!me || !me.group || me.group === 'ETF') return [];
  return UNIVERSE.filter((i) => i.group === me.group && i.sym !== me.sym && !i.retired && (!intraday || i.fast)).map((i) => i.sym);
}

/**
 * The comparison as one ratio per bar of `bars`: each member's close divided by its close at the
 * first bar where it has a price, averaged over the members that have that bar. null where none do.
 */
export function compareRatios(bars: Bar[], members: Record<string, Bar[]>): (number | null)[] {
  const maps = Object.values(members)
    .filter((b) => b.length)
    .map((b) => new Map(b.map((x) => [x[0], x[4]] as const)));
  const firsts: (number | null)[] = maps.map(() => null);
  return bars.map((bar) => {
    let sum = 0;
    let n = 0;
    maps.forEach((m, k) => {
      const v = m.get(bar[0]);
      if (v == null || !(v > 0)) return;
      if (firsts[k] == null) firsts[k] = v;
      sum += v / firsts[k]!;
      n++;
    });
    return n ? sum / n : null;
  });
}

/** Loads one stock's minute prices for the comparison (a component, so the number of stocks can change). */
function Feed({ sym, onBars }: { sym: string; onBars: (sym: string, b: Bar[]) => void }) {
  const d = useIntraday(sym);
  const cb = useRef(onBars);
  useEffect(() => {
    cb.current = onBars;
  });
  const data = d.status === 'ready' ? d.data : null;
  useEffect(() => {
    if (data) cb.current(sym, data);
  }, [data, sym]);
  return null;
}

export function useCompare(sym: string, tf: Timeframe, bars: Bar[], target: CompareTarget | null) {
  const daily = tf === 'D' || tf === 'W';
  const history = useHistory(!!target && daily);
  const quotes = useQuotes();
  const [intra, setIntra] = useState<Record<string, Bar[]>>({});
  const members = useMemo(() => (target === 'sector' ? sectorMembers(sym, !daily) : target ? [target] : []), [target, sym, daily]);
  const group = instrument(sym)?.group ?? '';

  const line = useMemo<CompareLine | null>(() => {
    if (!target || !members.length || !bars.length) return null;
    const qs = quotes.status === 'ready' ? quotes.data.quotes : {};
    const per: Record<string, Bar[]> = {};
    for (const m of members) per[m] = barsFor(tf, { history: history.data[m], intraday: intra[m] ?? [], quote: qs[m] }).bars;
    const r = compareRatios(bars, per);
    if (!r.some((x) => x != null)) return null;
    const label = target === 'sector' ? t('cmp.sectorShort', { group }) : target;
    return { label, color: target === 'sector' ? 'violet' : 'gold', r };
  }, [target, members, bars, quotes, tf, history.data, intra, group]);

  const feeds: ReactNode = !daily && target
    ? members.map((m) => <Feed key={m} sym={m} onBars={(s, b) => setIntra((x) => (x[s] === b ? x : { ...x, [s]: b }))} />)
    : null;
  return { line, feeds, members, group };
}

/** The Compare button and its menu in the chart toolbar. */
export function CompareMenu({ sym, value, onChange, sectorCount, group }: { sym: string; value: CompareTarget | null; onChange: (v: CompareTarget | null) => void; sectorCount: number; group: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const items: [CompareTarget | null, string][] = [[null, t('cmp.off')]];
  if (sectorCount > 0) items.push(['sector', t('cmp.sector', { group, n: sectorCount })]);
  if (sym !== 'SPY') items.push(['SPY', t('cmp.spy')]);
  if (sym !== 'QQQ') items.push(['QQQ', t('cmp.qqq')]);
  return (
    <div className={ds.menuWrap} ref={ref}>
      <Button size="sm" iconOnly data-tip={t('cmp.title')} variant={value ? 'primary' : 'ghost'} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="compare" size={18} />
        <span className="visually-hidden">{t('cmp.title')}</span>
      </Button>
      {open && (
        <div className={ds.menu} role="menu" aria-label={t('cmp.title')}>
          {items.map(([v, label]) => (
            <button
              key={v ?? 'off'}
              type="button"
              role="menuitemradio"
              aria-checked={value === v}
              className={ds.item}
              onClick={() => {
                onChange(v);
                setOpen(false);
              }}
            >
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
