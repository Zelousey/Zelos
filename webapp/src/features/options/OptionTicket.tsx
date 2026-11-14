/**
 * The trade ticket's Options choice (owner 2026-10-10: "options should be a choice when you're
 * buying stocks, not just a separate section"). Buy: calls or puts, an expiration and a strike
 * (at the money first), then the same buy form as the Options page with the estimated P&L.
 * Sell: the contracts you hold on this stock, with Sell and Estimate.
 */
import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { formatPrice } from '../../lib/format';
import { t } from '../../lib/i18n';
import { buttonClass, EmptyState, Tabs } from '../../ui';
import type { Account, Valued } from '../practice/account';
import { expirations, listedExpirations, OPTION_STOCKS, optionable, quote, strikes, useVolMap, volFor, type Kind } from './model';
import { expLabel } from './dates';
import { useNow } from '../../lib/useNow';
import { useQuotes } from '../../data/markets';
import { OptionBuyForm } from './OptionBuyForm';
import { OptionPositions } from './OptionPositions';
import { ChartButton } from './FloatingChart';
import { CurrentPrice } from './CurrentPrice';
import s from './Options.module.css';

/** initial: a contract to start on (an Options Scanner alert's "Trade this setup"). */
type Props = { sym: string; side: 'buy' | 'sell'; S: number | null; today: string; acct: Account | null; valued: Valued | null; initial?: { kind: Kind; exp: string; strike: number } | null };

export function OptionTicket({ sym, side, S, today, acct, valued, initial }: Props) {
  const vols = useVolMap();
  const vol = volFor(vols, sym);
  const now = useNow(30_000);
  const quotes = useQuotes();
  const marketOpen = quotes.status === 'ready' && quotes.data.marketOpen;
  const exps = useMemo(() => listedExpirations(today, now, marketOpen), [today, now, marketOpen]);
  const [kind, setKind] = useState<Kind>(initial?.kind ?? 'call');
  const [pickedExp, setExp] = useState(() => (initial && expirations(today).includes(initial.exp) ? initial.exp : (expirations(today)[2] ?? expirations(today)[0]!)));
  const exp = exps.includes(pickedExp) ? pickedExp : exps.find((e) => e !== today)!; // "Today" can drop off at the cutoff
  const list = useMemo(() => {
    const l = S ? strikes(S) : [];
    return initial && l.length && !l.includes(initial.strike) ? [...l, initial.strike].sort((a, b) => a - b) : l;
  }, [S, initial]);
  const atm = useMemo(() => (S && list.length ? list.reduce((b, k) => (Math.abs(k - S) < Math.abs(b - S) ? k : b), list[0]!) : null), [S, list]);
  const [picked, setPicked] = useState<number | null>(initial?.strike ?? null);
  const strike = picked != null && list.includes(picked) ? picked : atm;
  const expId = useId();
  const strikeId = useId();

  if (side === 'sell') {
    const rows = valued?.optionRows.filter((r) => r.u === sym) ?? [];
    return rows.length && acct ? (
      <OptionPositions acct={acct} rows={rows} />
    ) : (
      <EmptyState
        icon="options"
        body={t('opt.noneOn', { sym })}
        compact
        actions={
          <Link className={buttonClass({ variant: 'secondary', size: 'sm' })} to="/options">
            {t('opt.allMine')}
          </Link>
        }
      />
    );
  }
  if (!optionable(sym))
    return (
      <EmptyState
        icon="options"
        body={t('opt.fastOnly', { list: OPTION_STOCKS.join(', ') })}
        compact
        actions={
          <Link className={buttonClass({ variant: 'secondary', size: 'sm' })} to="/options">
            {t('opt.openChain')}
          </Link>
        }
      />
    );
  if (!S || strike == null) return <EmptyState icon="options" body={t('opt.noPrice', { sym })} compact />;
  const q = quote(kind, S, strike, exp, today, vol, now);
  return (
    <div className={s.ticket}>
      {/* owner 2026-11-10: the chart opens from the card's left side, and the stock's price is easy to find */}
      <div className={s.ticketHead}>
        <ChartButton sym={sym} />
        <CurrentPrice sym={sym} price={S} />
      </div>
      <Tabs stretch label={t('opt.kind')} value={kind} onChange={setKind} items={[{ value: 'call', label: t('opt.callUp') }, { value: 'put', label: t('opt.putDown') }]} />
      <div className={s.row2}>
        <label className={s.select} htmlFor={expId}>
          {t('opt.expiry')}
          <select id={expId} value={exp} onChange={(e) => setExp(e.target.value)}>
            {exps.map((e) => (
              <option key={e} value={e}>
                {expLabel(e, today)}
              </option>
            ))}
          </select>
        </label>
        <label className={s.select} htmlFor={strikeId}>
          {t('opt.col.strike')}
          <select id={strikeId} value={strike} onChange={(e) => setPicked(+e.target.value)}>
            {list.map((k) => (
              <option key={k} value={k}>
                {formatPrice(k)}
                {k === atm ? ` · ${t('opt.atm')}` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className={s.sub}>{kind === 'call' ? t('opt.callExplain') : t('opt.putExplain')}</p>
      <OptionBuyForm key={`${kind}${exp}${strike}`} sym={sym} kind={kind} exp={exp} strike={strike} q={q} S={S} vol={vol} today={today} canTrade={!!acct} buyingPower={valued?.buyingPower ?? null} />
      <p className={s.sub}>{t('opt.modeled')}</p>
    </div>
  );
}
