/**
 * An option position, opened from its row (owner 2026-11-13): the stock's own chart with a pin
 * where you bought, the contract's price over the same time (modeled from the stock's price the
 * same way the server prices it), and your contracts on this stock underneath.
 */
import { useMemo, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { formatMoney, formatPrice } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Card, Change, Tabs, ValueChart } from '../../ui';
import { ChartView } from '../charts/ChartView';
import { UpdateTimer } from '../markets/UpdateTimer';
import { TIMEFRAMES, type Timeframe } from '../charts/series';
import { useSymbolBars } from '../charts/useSymbolBars';
import type { Account, Valued } from '../practice/account';
import { useEntries } from '../practice/entries';
import { quote, volFor, type Vols } from './model';
import { OptionPositions } from './OptionPositions';
import s from './Options.module.css';

type Row = Valued['optionRows'][number];
const TFS: Timeframe[] = ['15m', '1h', 'D'];

/** A bar label as a time: 'YYYY-MM-DD' = that day's close, 'YYYY-MM-DD HH:MM' = New York time. */
function barTime(label: string): number {
  if (label.length === 10) return Date.parse(label + 'T16:00:00-05:00');
  return Date.parse(label.replace(' ', 'T') + ':00-05:00');
}

export function PositionFocus({ acct, row, rows, vols }: { acct: Account; row: Row; rows: Row[]; vols: Vols | null }) {
  const { user } = useAuth();
  const [tf, setTf] = useState<Timeframe>('15m');
  const def = TIMEFRAMES.find((x) => x.id === tf)!;
  const { built, loading } = useSymbolBars(row.u, tf);
  const bought = useEntries(user?.uid ?? null, row.u, row.qty, null, row.id);
  const pins = useMemo(() => bought.map((e) => ({ ...e, onBar: true })), [bought]);
  const vol = volFor(vols, row.u);
  // the contract's price on each bar, from when you first bought (or the chart's window)
  const points = useMemo(() => {
    const bars = built.bars;
    const span = typeof def.def === 'number' ? def.def : bars.length;
    const first = bought[0]?.at ?? 0;
    return bars
      .slice(-span)
      .filter((b) => barTime(b[0]) >= first - (built.intraday ? 15 * 60e3 : 864e5))
      .filter((b) => b[0].slice(0, 10) <= row.exp)
      .map((b) => ({ t: barTime(b[0]), v: quote(row.kind, b[4], row.strike, row.exp, b[0].slice(0, 10), vol).mid }));
  }, [built, def, bought, row, vol]);

  return (
    <Card title={row.label} subtitle={t('opt.focus.sub', { qty: row.qty, avg: formatPrice(row.avg) })} actions={<span className={s.focusPnl}><span className="num">{formatMoney(row.value)}</span> <Change abs={row.pnl} pct={row.pnlPct} /></span>}>
      <div className={s.focus}>
        <div className={s.focusHead}>
          <h3>{t('opt.focus.stock', { sym: row.u })}</h3>
          <UpdateTimer syms={[row.u]} />
          <Tabs label={t('chart.timeframe')} value={tf} onChange={setTf} items={TFS.map((x) => ({ value: x, label: TIMEFRAMES.find((d) => d.id === x)!.label }))} />
        </div>
        <ChartView
          sym={row.u}
          seriesKey={`${row.u}:${tf}:opt`}
          bars={built.bars}
          live={built.live}
          intraday={built.intraday}
          range={def.def}
          style="candles"
          loading={loading}
          entries={pins}
          label={t('chart.label', { sym: row.u, tf: def.label })}
        />
        <h3>{t('opt.focus.contract')}</h3>
        {points.length >= 2 ? <ValueChart points={points} base={row.avg} label={t('opt.focus.contractLabel', { label: row.label })} /> : <p className={s.sub}>{t('opt.focus.noChart')}</p>}
        <p className={s.sub}>{t('opt.focus.modeled')}</p>
        <h3>{t('opt.focus.yours', { sym: row.u })}</h3>
        <OptionPositions acct={acct} rows={rows} />
      </div>
    </Card>
  );
}
