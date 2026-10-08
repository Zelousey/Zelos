/**
 * One symbol: price header, chart (15m / 1H / D / W with ranges, line or candles),
 * today's stats, a data-table view of the bars, and the hand-off into a practice trade.
 * Prices come from markets/quotes (live, every minute in market hours), bars from
 * markets/intraday_SYM and the daily history.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { SYMBOL_RE } from '../../data/markets';
import { instrument, INDEX_ETFS } from '../../data/universe';
import { formatCompact, formatMarketTime, formatPrice } from '../../lib/format';
import { t } from '../../lib/i18n';
import { readString, writeString } from '../../lib/storage';
import { buttonClass, Button, Card, Change, EmptyState, ErrorState, Stat, Tabs } from '../../ui';
import { ChartView } from '../charts/ChartView';
import { TIMEFRAMES, type Timeframe } from '../charts/series';
import { useSymbolBars } from '../charts/useSymbolBars';
import { StatusLine } from './StatusLine';
import { rememberSymbol } from './useLastSymbol';
import s from './SymbolPage.module.css';

const TF_KEY = 'zelosAppChartTf';
const STYLE_KEY = 'zelosChartStyle'; // shared with the classic chart engine

function initialTf(): Timeframe {
  const v = readString(TF_KEY);
  return v === '15m' || v === '1h' || v === 'D' || v === 'W' ? v : 'D';
}

export default function SymbolPage() {
  const raw = (useParams().sym ?? '').toUpperCase();
  const valid = SYMBOL_RE.test(raw);
  const inst = valid ? instrument(raw) : undefined;
  if (!inst) {
    return (
      <Card>
        <EmptyState
          icon="search"
          title={t('markets.unknown.title', { sym: valid ? raw : '?' })}
          body={t('markets.unknown.body', { sym: valid ? raw : 'That symbol' })}
          actions={
            <Link className={buttonClass({ variant: 'secondary' })} to="/markets">
              {t('markets.backToMarkets')}
            </Link>
          }
        />
      </Card>
    );
  }
  return <SymbolView key={inst.sym} sym={inst.sym} name={INDEX_ETFS.find((x) => x.sym === inst.sym) ? `${inst.name} · tracks the ${INDEX_ETFS.find((x) => x.sym === inst.sym)!.label}` : inst.name} />;
}

function SymbolView({ sym, name }: { sym: string; name: string }) {
  const [tf, setTfState] = useState<Timeframe>(initialTf);
  const tfDef = TIMEFRAMES.find((x) => x.id === tf)!;
  const [range, setRange] = useState<number | 'all'>(tfDef.def);
  const [style, setStyleState] = useState<'line' | 'candles'>(() => (readString(STYLE_KEY) === 'candles' ? 'candles' : 'line'));
  const [showTable, setShowTable] = useState(false);
  const { quotes, quote: q, built, loading, failed, retry } = useSymbolBars(sym, tf);

  useEffect(() => rememberSymbol(sym), [sym]);

  const lastBar = built.bars[built.bars.length - 1];
  const prevBar = built.bars[built.bars.length - 2];
  const price = q?.c ?? lastBar?.[4] ?? null;
  const prevClose = q?.pc ?? (tf === 'D' ? prevBar?.[4] : null) ?? null;
  const chAbs = price != null && prevClose ? price - prevClose : null;
  const chPct = q?.chPct ?? (chAbs != null && prevClose ? (chAbs / prevClose) * 100 : null);

  function setTf(v: Timeframe) {
    setTfState(v);
    writeString(TF_KEY, v);
    setRange(TIMEFRAMES.find((x) => x.id === v)!.def);
  }
  function setStyle(v: 'line' | 'candles') {
    setStyleState(v);
    writeString(STYLE_KEY, v);
  }

  const tableRows = built.bars.slice(-12).reverse();
  const tradeHref = `/practice/trade/${encodeURIComponent(sym)}`;

  return (
    <>
      <div className={s.head}>
        <div className={s.ident}>
          <h1 className={s.sym}>{sym}</h1>
          <span className={s.name}>{name}</span>
        </div>
        <div className={s.price}>
          <span className={s.last} aria-label={`Price ${formatPrice(price)}`}>
            {formatPrice(price)}
          </span>
          <span className={s.today}>
            <Change pct={chPct} abs={chAbs} />
            <span>today</span>
          </span>
        </div>
      </div>
      <StatusLine quotes={quotes} />

      <div className={s.layout}>
        <Card>
          <div className={s.controls}>
            <Tabs label={t('chart.timeframe')} value={tf} onChange={setTf} items={TIMEFRAMES.map((x) => ({ value: x.id, label: x.label }))} />
            <div>
              <Tabs label={t('chart.range')} value={String(range)} onChange={(v) => setRange(v === 'all' ? 'all' : Number(v))} items={tfDef.ranges.map(([label, n]) => ({ value: String(n), label }))} />
              <Tabs label={t('chart.style')} value={style} onChange={setStyle} items={[{ value: 'line', label: t('chart.line') }, { value: 'candles', label: t('chart.candles') }]} />
            </div>
          </div>
          {failed ? (
            <ErrorState compact onRetry={retry} />
          ) : !loading && built.bars.length === 0 ? (
            <EmptyState icon="chart" body={built.intraday ? t('chart.noIntraday') : t('chart.noData', { sym })} compact />
          ) : (
            <div className={s.chartBody}>
              <ChartView sym={sym} seriesKey={`${sym}:${tf}`} bars={built.bars} live={built.live} intraday={built.intraday} range={range} style={style} refPrice={tf === '15m' || tf === '1h' ? prevClose : null} loading={loading} label={t('chart.label', { sym, tf: tfDef.label })} />
            </div>
          )}
          {built.bars.length > 0 && (
            <>
              <div className={s.tableToggle}>
                <Button variant="ghost" size="sm" onClick={() => setShowTable((x) => !x)} aria-expanded={showTable}>
                  {showTable ? t('chart.table.hide') : t('chart.table.show')}
                </Button>
              </div>
              {showTable && (
                <div className={s.tableWrap}>
                  <table className={s.table}>
                    <caption>{t('chart.table.caption', { count: tableRows.length, tf: tfDef.label })}</caption>
                    <thead>
                      <tr>
                        {(['col.date', 'col.open', 'col.high', 'col.low', 'col.close', 'col.volume'] as const).map((k) => (
                          <th key={k} scope="col">
                            {t(k)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="num">
                      {tableRows.map((b) => (
                        <tr key={b[0]}>
                          <td>{b[0]}</td>
                          <td>{formatPrice(b[1])}</td>
                          <td>{formatPrice(b[2])}</td>
                          <td>{formatPrice(b[3])}</td>
                          <td>{formatPrice(b[4])}</td>
                          <td>{b[5] ? formatCompact(b[5]) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Card>

        <div className={s.side}>
          <Card title={t('stats.title')}>
            <div className={s.stats}>
              <Stat size="sm" label={t('stats.open')} value={formatPrice(q?.o)} />
              <Stat size="sm" label={t('stats.prevClose')} value={formatPrice(prevClose)} />
              <Stat size="sm" label={t('stats.high')} value={formatPrice(q?.h)} />
              <Stat size="sm" label={t('stats.low')} value={formatPrice(q?.l)} />
              <Stat size="sm" label={t('stats.volume')} value={q?.v ? formatCompact(q.v) : '—'} />
              <Stat size="sm" label={t('stats.updated')} value={q?.t ? formatMarketTime(q.t * 1000) : '—'} />
            </div>
          </Card>
          <div className={s.desktopTrade}>
            <Link className={buttonClass({ variant: 'primary', size: 'lg', block: true })} to={tradeHref}>
              {t('trade.practice')}
            </Link>
            <p className={s.tradeHint}>{t('trade.practiceHint')}</p>
          </div>
        </div>
      </div>

      <div className={s.actionBar}>
        <Link className={buttonClass({ variant: 'primary', size: 'lg', block: true })} to={tradeHref}>
          {t('trade.practice')} · {sym}
        </Link>
      </div>
    </>
  );
}
