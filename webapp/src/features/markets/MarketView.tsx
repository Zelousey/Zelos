/**
 * The market view on Market and the Dashboard (owner decision 2026-10-09): opens on a chart
 * of the US indexes; "Globe" switches to the live globe with the exchanges. Same switch and
 * same remembered choice as the classic dashboard (localStorage zelosDashboardViz), but the
 * app opens on the chart until someone picks the globe.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { INDEX_ETFS } from '../../data/universe';
import { t } from '../../lib/i18n';
import { formatPercent, formatPrice } from '../../lib/format';
import { readString, writeString } from '../../lib/storage';
import { Card, Tabs } from '../../ui';
import { ChartView } from '../charts/ChartView';
import { TIMEFRAMES, type Timeframe } from '../charts/series';
import { useSymbolBars } from '../charts/useSymbolBars';
import { useOpenExchanges, WorldMarkets } from './WorldMarkets';
import s from './MarketView.module.css';

export const VIZ_KEY = 'zelosDashboardViz'; // shared with dashboard.html
export type Viz = 'chart' | 'globe';
export const readViz = (): Viz => (readString(VIZ_KEY) === 'globe' ? 'globe' : 'chart');

export function MarketView({ className, globeHeight, phoneGlobeHeight, all }: { className?: string; globeHeight: number; phoneGlobeHeight?: number; all?: boolean }) {
  const [viz, setVizState] = useState<Viz>(readViz);
  const { summary } = useOpenExchanges();
  const setViz = (v: Viz) => {
    setVizState(v);
    writeString(VIZ_KEY, v);
  };
  return (
    <Card
      className={className}
      title={viz === 'chart' ? t('mv.chart.title') : t('market.world')}
      subtitle={viz === 'globe' ? summary : t('mv.chart.sub')}
      actions={<Tabs label={t('mv.switch')} value={viz} onChange={setViz} items={[{ value: 'chart', label: t('mv.chart') }, { value: 'globe', label: t('mv.globe') }]} />}
    >
      {viz === 'chart' ? <IndexChart /> : <WorldMarkets height={globeHeight} phoneHeight={phoneGlobeHeight} all={all} />}
    </Card>
  );
}

const TFS: Timeframe[] = ['15m', 'D'];

function IndexChart() {
  const [sym, setSym] = useState('SPY');
  const [tf, setTf] = useState<Timeframe>('D');
  const tfDef = TIMEFRAMES.find((x) => x.id === tf)!;
  const { quote, built, loading } = useSymbolBars(sym, tf);
  const label = INDEX_ETFS.find((x) => x.sym === sym)?.label ?? sym;
  return (
    <div className={s.wrap}>
      <div className={s.bar}>
        <Tabs label={t('mv.index')} value={sym} onChange={setSym} items={INDEX_ETFS.map((x) => ({ value: x.sym, label: x.label }))} />
        <Tabs label={t('chart.timeframe')} value={tf} onChange={setTf} items={TFS.map((x) => ({ value: x, label: x === 'D' ? t('mv.tf.days') : t('mv.tf.today') }))} />
      </div>
      <div className={s.quote}>
        <b>{sym}</b>
        <span className={s.muted}>{label}</span>
        {quote?.c != null && <span className={s.price}>{formatPrice(quote.c)}</span>}
        {quote?.chPct != null && <span className={quote.chPct >= 0 ? 'up' : 'down'}>{formatPercent(quote.chPct)}</span>}
        <Link to={`/markets/${sym}`} className={s.open}>
          {t('mv.openFull')} →
        </Link>
      </div>
      <div className={s.chart}>
        <ChartView sym={sym} seriesKey={`mv:${sym}:${tf}`} bars={built.bars} live={built.live} intraday={built.intraday} range={tfDef.def} style="line" loading={loading} label={t('chart.label', { sym, tf: tfDef.label })} />
      </div>
    </div>
  );
}
