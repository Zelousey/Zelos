/**
 * The market view on Market and the Dashboard (owner decision 2026-10-09): opens on a chart
 * of the US indexes; "Globe" switches to the live globe with the exchanges. Same switch and
 * same remembered choice as the classic dashboard (localStorage zelosDashboardViz), but the
 * app opens on the chart until someone picks the globe.
 */
import { useState, type ReactNode } from 'react';
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

/** hero: the Market page's main chart, no box around it, as tall as the screen allows. */
export function MarketView({ className, globeHeight, phoneGlobeHeight, all, hero }: { className?: string; globeHeight: number; phoneGlobeHeight?: number; all?: boolean; hero?: boolean }) {
  const [viz, setVizState] = useState<Viz>(readViz);
  const { summary } = useOpenExchanges();
  const setViz = (v: Viz) => {
    setVizState(v);
    writeString(VIZ_KEY, v);
  };
  const switcher = <Tabs label={t('mv.switch')} value={viz} onChange={setViz} items={[{ value: 'chart', label: t('mv.chart') }, { value: 'globe', label: t('mv.globe') }]} />;
  if (hero)
    return (
      <section className={[s.hero, className].filter(Boolean).join(' ')} aria-labelledby="mv-hero-title">
        {viz === 'chart' ? (
          <IndexChart hero title={<h2 id="mv-hero-title" className={s.heroTitle}>{t('mv.chart.title')}</h2>} switcher={switcher} />
        ) : (
          <>
            <div className={s.heroBar}>
              <h2 id="mv-hero-title" className={s.heroTitle}>
                {t('market.world')}
              </h2>
              <span className={s.muted}>{summary}</span>
              <span className={s.push}>{switcher}</span>
            </div>
            <WorldMarkets height={globeHeight} phoneHeight={phoneGlobeHeight} all={all} />
          </>
        )}
      </section>
    );
  return (
    <Card
      className={className}
      title={viz === 'chart' ? t('mv.chart.title') : t('market.world')}
      subtitle={viz === 'globe' ? summary : t('mv.chart.sub')}
      actions={switcher}
    >
      {viz === 'chart' ? <IndexChart /> : <WorldMarkets height={globeHeight} phoneHeight={phoneGlobeHeight} all={all} />}
    </Card>
  );
}

const TFS: Timeframe[] = ['15m', 'D'];

function IndexChart({ hero, title, switcher }: { hero?: boolean; title?: ReactNode; switcher?: ReactNode }) {
  const [sym, setSym] = useState('SPY');
  const [tf, setTf] = useState<Timeframe>('D');
  const tfDef = TIMEFRAMES.find((x) => x.id === tf)!;
  const { quote, built, loading } = useSymbolBars(sym, tf);
  const label = INDEX_ETFS.find((x) => x.sym === sym)?.label ?? sym;
  const quoteLine = (
    <div className={s.quote}>
      <b>{sym}</b>
      <span className={s.muted}>{label}</span>
      {quote?.c != null && <span className={s.price}>{formatPrice(quote.c)}</span>}
      {quote?.chPct != null && <span className={quote.chPct >= 0 ? 'up' : 'down'}>{formatPercent(quote.chPct)}</span>}
      <Link to={`/markets/${sym}`} className={s.open}>
        {t('mv.openFull')} →
      </Link>
    </div>
  );
  const chart = (
    <div className={hero ? s.heroChart : s.chart}>
      <ChartView sym={sym} seriesKey={`mv:${sym}:${tf}`} bars={built.bars} live={built.live} intraday={built.intraday} range={tfDef.def} style="candles" loading={loading} label={t('chart.label', { sym, tf: tfDef.label })} />
    </div>
  );
  if (hero)
    return (
      <>
        <div className={s.heroBar}>
          {title}
          <Tabs label={t('mv.index')} value={sym} onChange={setSym} items={INDEX_ETFS.map((x) => ({ value: x.sym, label: x.label }))} />
          <Tabs label={t('chart.timeframe')} value={tf} onChange={setTf} items={TFS.map((x) => ({ value: x, label: x === 'D' ? t('mv.tf.days') : t('mv.tf.today') }))} />
          <span className={s.push}>{switcher}</span>
        </div>
        {quoteLine}
        {chart}
      </>
    );
  return (
    <div className={s.wrap}>
      <div className={s.bar}>
        <Tabs label={t('mv.index')} value={sym} onChange={setSym} items={INDEX_ETFS.map((x) => ({ value: x.sym, label: x.label }))} />
        <Tabs label={t('chart.timeframe')} value={tf} onChange={setTf} items={TFS.map((x) => ({ value: x, label: x === 'D' ? t('mv.tf.days') : t('mv.tf.today') }))} />
      </div>
      {quoteLine}
      {chart}
    </div>
  );
}
