/**
 * Sector heat map (owner 2026-11-15): the 11 market sectors as tiles, green for up and red for down,
 * stronger the bigger today's move (markets/movers.sectors, refreshed every 15 minutes in market
 * hours). Tap a sector to see the Zelos stocks in it as smaller tiles with today's move from the
 * live quotes; tap a stock for its chart. Only data we already have.
 */
import { useId, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { useMovers, useQuotes } from '../../data/markets';
import { instrument, UNIVERSE } from '../../data/universe';
import { formatPercent } from '../../lib/format';
import { t } from '../../lib/i18n';
import { LoadingState } from '../../ui';
import { heat, stocksIn } from './sectorMap';
import s from './SectorHeat.module.css';

const tone = (pct: number): CSSProperties => ({ '--heat': `${Math.round(heat(pct) * 100)}%` }) as CSSProperties;

export function SectorHeat() {
  const movers = useMovers();
  const quotes = useQuotes();
  const [open, setOpen] = useState<string | null>(null);
  const panelId = useId();
  if (movers.status === 'loading') return <LoadingState rows={4} />;
  const sectors = movers.status === 'ready' ? [...movers.data.sectors].sort((a, b) => b.chPct - a.chPct) : [];
  if (!sectors.length) return <p className={s.muted}>{t('dash.sectors.empty')}</p>;
  const qs = quotes.status === 'ready' ? quotes.data.quotes : {};
  const picked = open ? sectors.find((x) => x.sector === open) : undefined;
  const stocks = picked
    ? stocksIn(
        picked.sector,
        UNIVERSE.map((i) => i.sym),
      )
        .map((sym) => {
          const q = qs[sym];
          return { sym, pct: q?.c && q.pc ? (q.c / q.pc - 1) * 100 : null };
        })
        .sort((a, b) => (b.pct ?? -1e9) - (a.pct ?? -1e9))
    : [];
  return (
    <div className={s.wrap}>
      <ul className={s.grid} aria-label={t('heat.title')}>
        {sectors.map((x) => (
          <li key={x.sector}>
            <button type="button" className={[s.tile, x.chPct >= 0 ? s.up : s.down].join(' ')} style={tone(x.chPct)} aria-pressed={open === x.sector} aria-controls={panelId} onClick={() => setOpen((o) => (o === x.sector ? null : x.sector))}>
              <span className={s.name}>{x.sector}</span>
              <span className={s.pct}>{formatPercent(x.chPct, { signed: true })}</span>
            </button>
          </li>
        ))}
      </ul>
      <div id={panelId} className={s.panel} hidden={!picked} aria-live="polite">
        {picked && (
          <>
            <h3 className={s.panelTitle}>{t('heat.inSector', { sector: picked.sector })}</h3>
            {stocks.length ? (
              <ul className={s.stocks}>
                {stocks.map((x) => (
                  <li key={x.sym}>
                    <Link to={`/markets/${x.sym}`} className={[s.stock, (x.pct ?? 0) >= 0 ? s.up : s.down].join(' ')} style={tone(x.pct ?? 0)} aria-label={`${x.sym}, ${instrument(x.sym)?.name ?? ''}: ${x.pct == null ? t('heat.noPrice') : formatPercent(x.pct, { signed: true })}`}>
                      <b>{x.sym}</b>
                      <span>{x.pct == null ? '—' : formatPercent(x.pct, { signed: true })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={s.muted}>{t('heat.none')}</p>
            )}
          </>
        )}
      </div>
      <p className={s.note}>{t('heat.note')}</p>
    </div>
  );
}
