/**
 * The big chart: one symbol at a time, as large as the screen allows (15m / 1H / D / W with
 * ranges, line or candles), a symbol switcher, mini-chart previews to jump between symbols,
 * today's stats, a data-table view of the bars, and the hand-off into a practice trade.
 * Prices come from markets/quotes (live, every minute in market hours), bars from
 * markets/intraday_SYM and the daily history.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { SYMBOL_RE, useQuotes } from '../../data/markets';
import { instrument, INDEX_ETFS, searchUniverse, UNIVERSE } from '../../data/universe';
import { useUserDoc } from '../../data/userDoc';
import { fallbackSymbol, MODE_DEFAULT_TF, MODE_TFS, modeOf, readMode, useMode, type Mode } from '../../data/tradeMode';
import { useAuth } from '../../lib/auth';
import { formatCompact, formatMarketTime, formatPercent, formatPrice, formatSignedMoney } from '../../lib/format';
import { t } from '../../lib/i18n';
import { readString, writeString } from '../../lib/storage';
import { buttonClass, Button, Card, Change, EmptyState, ErrorState, Icon, Sheet, Stat, Tabs, useScrollFade } from '../../ui';
import { ChartView } from '../charts/ChartView';
import type { Forecast } from '../charts/engine';
import { nyDay } from '../charts/series';
import { usePracticeAccount, valueAccount } from '../practice/account';
import { useVolMap } from '../options/model';
import { TIMEFRAMES, type Timeframe } from '../charts/series';
import { useSymbolBars } from '../charts/useSymbolBars';
import { StatusLine } from './StatusLine';
import { WatchButton } from './WatchButton';
import { ResearchCard } from './Research';
import { MarketList } from './MarketRow';
import { MiniChart } from './MiniChart';
import { useMinis } from './miniSeries';
import { recentSymbols, rememberSymbol } from './useLastSymbol';
import { reportMission } from '../../data/missionEvent';
import { ModeToggle, modeExplanation, useModeMinutes } from './ModeToggle';
import s from './SymbolPage.module.css';

const TF_KEY = 'zelosAppChartTf';
const tfKey = (m: Mode) => `${TF_KEY}:${m}`;

/** The timeframe last used in this mode (Day Trading: 5m / 15m / 1H; Long Term: D / W). */
function initialTf(m: Mode): Timeframe {
  const v = readString(tfKey(m)) ?? readString(TF_KEY);
  return MODE_TFS[m].find((x) => x === v) ?? MODE_DEFAULT_TF[m];
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
  // Day Trading or Long Term (owner 2026-11-10): every symbol is on one mode's list, so the chart
  // is in that mode. Arriving at a symbol of the other mode turns that mode on (and says so);
  // switching the mode here moves to a symbol of the new mode and explains why in a popup.
  const symMode: Mode = modeOf(sym) ?? 'fast';
  const [mode, setMode] = useMode();
  const navigate = useNavigate();
  const location = useLocation();
  // arriving from the other mode: a short note under the header (not a toast, which would sit on the chart's buttons)
  const [joined] = useState(() => readMode() !== symMode);
  const swappedFrom = (location.state as { swappedFrom?: string } | null)?.swappedFrom ?? null;
  const [swapNote, setSwapNote] = useState(swappedFrom);
  const minutes = useModeMinutes();
  useEffect(() => {
    if (mode === symMode) return;
    setMode(symMode);
    // only on arrival: later switches go through switchMode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym]);
  const switchMode = (m: Mode) => {
    setMode(m);
    if (m === symMode) return;
    navigate(`/markets/${encodeURIComponent(fallbackSymbol(sym, m))}`, { state: { swappedFrom: sym } });
  };
  const [tf, setTfState] = useState<Timeframe>(() => initialTf(symMode));
  const controlsRef = useRef<HTMLDivElement>(null);
  useScrollFade(controlsRef);
  const tfDef = TIMEFRAMES.find((x) => x.id === tf)!;
  const [range, setRange] = useState<number | 'all'>(tfDef.def);
  // owner 2026-10-09: every chart opens as a line; candles apply only to the chart you switch
  const [style, setStyle] = useState<'line' | 'candles'>('candles');
  const [showTable, setShowTable] = useState(false);
  // Forecast (owner 2026-11-10): a green target box and a red stop box on the chart, dragged up and
  // down; Buy then opens the ticket with them as the take-profit and stop-loss. Long only.
  const [fc, setFc] = useState<{ sl: number; tp: number } | null>(null);
  const [switching, setSwitching] = useState(false);
  const { quotes, quote: q, built, loading, failed, retry } = useSymbolBars(sym, tf);
  const isIndexEtf = INDEX_ETFS.some((x) => x.sym === sym); // funds have no SEC company research

  useEffect(() => {
    rememberSymbol(sym);
    reportMission('analyze', sym); // "Analyze 3 stocks", counted by the server
  }, [sym]);

  const lastBar = built.bars[built.bars.length - 1];
  const prevBar = built.bars[built.bars.length - 2];
  const price = q?.c ?? lastBar?.[4] ?? null;
  const prevClose = q?.pc ?? (tf === 'D' ? prevBar?.[4] : null) ?? null;
  const chAbs = price != null && prevClose ? price - prevClose : null;
  const chPct = q?.chPct ?? (chAbs != null && prevClose ? (chAbs / prevClose) * 100 : null);

  const forecast: Forecast | null = useMemo(() => (fc && price ? { entry: price, sl: fc.sl, tp: fc.tp, side: 'buy', editable: true, label: `${sym} plan` } : null), [fc, price, sym]);
  const onForecastEdit = useCallback((f: Forecast) => setFc((x) => (x ? { sl: f.sl ?? x.sl, tp: f.tp ?? x.tp } : x)), []);
  // the boxes start sized to what's on screen (a 5-minute chart gets a tight plan, a daily chart a
  // wider one): the stop a quarter of the visible high-low range below, the target twice as far up
  const flipForecast = () =>
    setFc((x) => {
      if (x || !price) return null;
      const seen = built.bars.slice(typeof range === 'number' ? -range : 0);
      const spread = seen.length ? Math.max(...seen.map((b) => b[2])) - Math.min(...seen.map((b) => b[3])) : price * 0.05;
      const step = Math.max(price * 0.002, spread * 0.25);
      return { sl: +(price - step).toFixed(2), tp: +(price + 2 * step).toFixed(2) };
    });
  const buyHref = `${tradeHrefOf(sym)}?side=buy${fc ? `&sl=${fc.sl.toFixed(2)}&tp=${fc.tp.toFixed(2)}` : ''}`;
  const dayLabel = tfDef.ranges.find(([, n]) => n === range)?.[0];

  function setTf(v: Timeframe) {
    setTfState(v);
    writeString(tfKey(symMode), v);
    setRange(TIMEFRAMES.find((x) => x.id === v)!.def);
  }

  // owner 2026-11-10: the timeframe row sits right under the chart, like a trading app; it stays
  // when a timeframe has no bars yet, so you can always switch
  const controls = (
    <div ref={controlsRef} className={s.controls}>
      <Tabs label={t('chart.range')} value={String(range)} onChange={(v) => setRange(v === 'all' ? 'all' : Number(v))} items={tfDef.ranges.map(([label, n]) => ({ value: String(n), label }))} />
      <span className={s.ctrlGap} aria-hidden="true" />
      <Tabs label={t('chart.timeframe')} value={tf} onChange={setTf} items={TIMEFRAMES.filter((x) => MODE_TFS[symMode].includes(x.id)).map((x) => ({ value: x.id, label: x.label }))} />
      <Tabs label={t('chart.style')} value={style} onChange={setStyle} items={[{ value: 'line', label: t('chart.line') }, { value: 'candles', label: t('chart.candles') }]} />
    </div>
  );

  const tableRows = built.bars.slice(-12).reverse();
  const tradeHref = tradeHrefOf(sym);

  return (
    <>
      <div className={s.head}>
        <div className={s.ident}>
          <div className={s.symRow}>
            <h1 className={s.sym}>{sym}</h1>
            <Button variant="secondary" size="sm" onClick={() => setSwitching(true)} aria-haspopup="dialog" aria-label={t('chart.switch')}>
              <Icon name="search" size={16} /> <span className={s.switchText}>{t('chart.switch')}</span>
            </Button>
            <WatchButton sym={sym} />
            {/* owner 2026-11-10: chart settings sit up here with Switch and Watch, and open the chart part of Settings */}
            <Link className={buttonClass({ variant: 'secondary', size: 'sm' })} to="/settings#chart" aria-label={t('chart.settings')}>
              <Icon name="palette" size={16} /> <span className={s.switchText}>{t('chart.settings')}</span>
            </Link>
          </div>
          <span className={s.name}>{name}</span>
        </div>
        {/* owner 2026-11-10: the mode switch sits between the symbol and its price */}
        <ModeToggle className={s.mode} onChange={switchMode} compact />
        <div className={s.price}>
          <span className={s.last} aria-label={`Price ${formatPrice(price)}`}>
            {formatPrice(price)}
          </span>
          <span className={s.today}>
            <Change pct={chPct} abs={chAbs} />
            <span>today</span>
          </span>
          {q?.stale && (
            <span className={s.delayed} title={t('stats.delayedHint', { sym })}>
              {t('stats.delayed')}
            </span>
          )}
        </div>
      </div>
      <StatusLine quotes={quotes} />
      {joined && !swapNote && (
        <p className={s.joined} role="status">
          {t('mode.joined', { sym, mode: t(symMode === 'fast' ? 'mode.fast' : 'mode.slow') })}
        </p>
      )}

      <div className={s.layout}>
        <Card className={s.chartCard}>
          {failed ? (
            <ErrorState compact onRetry={retry} />
          ) : !loading && built.bars.length === 0 ? (
            <div className={s.chartBody}>
              <EmptyState icon="chart" body={built.intraday ? t('chart.noIntraday') : t('chart.noData', { sym })} compact />
              {controls}
            </div>
          ) : (
            <div className={s.chartBody}>
              <ChartView
                sym={sym}
                seriesKey={`${sym}:${tf}`}
                bars={built.bars}
                live={built.live}
                intraday={built.intraday}
                range={range}
                style={style}
                refPrice={built.intraday ? prevClose : null}
                loading={loading}
                label={t('chart.label', { sym, tf: tfDef.label })}
                forecast={forecast}
                onForecastEdit={onForecastEdit}
                daySlots={built.intraday && dayLabel === '1D' && typeof range === 'number' ? range : undefined}
                tools
                toolsTop
                toolbarExtra={
                  <>
                    <Button size="sm" variant={fc ? 'primary' : 'ghost'} aria-pressed={!!fc} onClick={flipForecast} disabled={!price}>
                      <Icon name="target" size={16} /> {t('chart.forecast')}
                    </Button>
                    <Link className={buttonClass({ variant: 'secondary', size: 'sm' }, s.tradeOptions)} to={`/options/${encodeURIComponent(sym)}`}>
                      <Icon name="options" size={16} /> {t('chart.options')}
                    </Link>
                  </>
                }
                under={controls}
              />
            </div>
          )}
          {fc && price && (
            <div className={s.plan} role="status">
              <span>
                <b className={s.planTp}>{t('chart.forecast.target')}</b> {formatPrice(fc.tp)} <span className="up">{formatPercent((fc.tp / price - 1) * 100)}</span>
              </span>
              <span>
                <b className={s.planSl}>{t('chart.forecast.stop')}</b> {formatPrice(fc.sl)} <span className="down">{formatPercent((fc.sl / price - 1) * 100)}</span>
              </span>
              <span className={s.planRr}>{t('chart.forecast.rr', { r: price > fc.sl ? ((fc.tp - price) / (price - fc.sl)).toFixed(1) : '–' })}</span>
              <span className={s.planHint}>{t('chart.forecast.hint')}</span>
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

        {/* owner 2026-11-10: on a computer Buy / Sell sit right under Today (Your position, Today,
            Buy / Sell), and Company research comes after, folded to a summary */}
        <div className={s.side}>
          <YourPosition sym={sym} tradeHref={tradeHref} />
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
            <div className={s.tradeBtns}>
              <Link className={buttonClass({ variant: 'buy', size: 'lg', block: true })} to={buyHref} aria-label={t('trade.buyLabel', { sym })}>
                {t('trade.buyBtn')}
              </Link>
              <Link className={buttonClass({ variant: 'sell', size: 'lg', block: true })} to={`${tradeHref}?side=sell`} aria-label={t('trade.sellLabel', { sym })}>
                {t('trade.sellBtn')}
              </Link>
            </div>
            <p className={s.tradeHint}>{t('trade.practiceHint')}</p>
          </div>
          {!isIndexEtf && <ResearchCard sym={sym} collapsible />}
        </div>
      </div>

      <Previews current={sym} />
      <SymbolSwitcher open={switching} onClose={() => setSwitching(false)} current={sym} />
      <Sheet open={!!swapNote} onClose={() => setSwapNote(null)} title={t('mode.swap.title', { to: sym })} labelledBy="mode-swap-title">
        <div className={s.swap}>
          <p>{t('mode.swap.body', { from: swapNote ?? '', other: t(symMode === 'fast' ? 'mode.slow' : 'mode.fast'), to: sym, mode: t(symMode === 'fast' ? 'mode.fast' : 'mode.slow') })}</p>
          <p className={s.swapExplain}>{modeExplanation(minutes)}</p>
          <div className={s.swapBtns}>
            <Button variant="primary" onClick={() => setSwapNote(null)}>
              {t('mode.swap.ok')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSwapNote(null);
                setSwitching(true);
              }}
            >
              {t('mode.swap.change')}
            </Button>
          </div>
        </div>
      </Sheet>

      <div className={[s.actionBar, s.tradeBtns].join(' ')}>
        <Link className={buttonClass({ variant: 'buy', size: 'lg', block: true })} to={buyHref} aria-label={t('trade.buyLabel', { sym })}>
          {t('trade.buyBtn')}
        </Link>
        <Link className={buttonClass({ variant: 'sell', size: 'lg', block: true })} to={`${tradeHref}?side=sell`} aria-label={t('trade.sellLabel', { sym })}>
          {t('trade.sellBtn')}
        </Link>
      </div>
    </>
  );
}

const tradeHrefOf = (sym: string) => `/practice/trade/${encodeURIComponent(sym)}`;

/** "You own this" (owner 2026-11-10): your Solo shares and options in this stock, with their profit
 *  or loss, and a way into the trade. Only when you hold something. */
function YourPosition({ sym, tradeHref }: { sym: string; tradeHref: string }) {
  const { user, isReal } = useAuth();
  const acct = usePracticeAccount(isReal && user ? user.uid : null);
  const quotes = useQuotes();
  const vols = useVolMap();
  const [today] = useState(() => nyDay(Date.now()));
  const data = acct.status === 'ready' ? acct.data : null;
  const v = useMemo(() => (data ? valueAccount(data, quotes.status === 'ready' ? quotes.data.quotes : {}, today, vols) : null), [data, quotes, today, vols]);
  if (!data || !v) return null;
  const pos = v.rows.find((r) => r.sym === sym);
  const opts = v.optionRows.filter((o) => o.u === sym);
  const orders = data.orders.filter((o) => o.sym === sym).length;
  if (!pos && !opts.length && !orders) return null;
  // owner 2026-11-10: each holding is a small rectangle you tap to open it (you may hold shares and
  // an option at once); profit in green, loss in red
  const tone = (n: number) => (n > 0 ? s.gain : n < 0 ? s.loss : '');
  return (
    <section className={s.position} aria-labelledby="pos-title">
      <h2 id="pos-title" className={s.posTitle}>
        {t('pos.title')}
      </h2>
      <ul className={s.posList}>
        {pos && (
          <li>
            <Link to={`${tradeHref}?side=sell`} className={s.posChip}>
              <span className={s.posWhat}>
                <b>{pos.qty === 1 ? t('pos.share') : t('pos.shares', { n: pos.qty })}</b>
                <span className={s.muted}>{t('pos.avg', { price: formatPrice(pos.avg) })}</span>
              </span>
              <span className={`${s.posPnl} ${tone(pos.pnl)}`}>
                <b>{formatSignedMoney(pos.pnl)}</b>
                <span>{formatPercent(pos.pnlPct)}</span>
              </span>
            </Link>
          </li>
        )}
        {opts.map((o) => (
          <li key={o.id}>
            <Link to={`/options/${encodeURIComponent(sym)}`} className={s.posChip}>
              <span className={s.posWhat}>
                <b>{o.label}</b>
                <span className={s.muted}>{t('pos.contractsN', { n: o.qty })}</span>
              </span>
              <span className={`${s.posPnl} ${tone(o.pnl)}`}>
                <b>{formatSignedMoney(o.pnl)}</b>
                <span>{formatPercent(o.pnlPct)}</span>
              </span>
            </Link>
          </li>
        ))}
        {orders > 0 && (
          <li>
            <Link to={tradeHref} className={`${s.posChip} ${s.posOrders}`}>
              <span className={s.posWhat}>
                <b>{orders === 1 ? t('pos.order') : t('pos.orders', { n: orders })}</b>
              </span>
            </Link>
          </li>
        )}
      </ul>
    </section>
  );
}

/** Mini charts to jump between symbols: recent ones, your watchlist, then the indexes. */
function Previews({ current }: { current: string }) {
  const { user, isReal } = useAuth();
  const userDoc = useUserDoc(isReal && user ? user.uid : null);
  const minis = useMinis();
  const [recent] = useState(recentSymbols);
  const syms = useMemo(() => {
    const watch = userDoc.status === 'ready' ? userDoc.data.watchlist : [];
    return [...new Set([current, ...recent, ...watch, ...INDEX_ETFS.map((x) => x.sym)])].filter((x) => instrument(x)).slice(0, 10);
  }, [current, recent, userDoc]);
  return (
    <section className={s.previews} aria-label={t('chart.previews')}>
      <h2 className={s.previewsTitle}>{t('chart.previews')}</h2>
      <ul className={s.previewList}>
        {syms.map((x) => (
          <li key={x}>
            <MiniChart sym={x} name={instrument(x)?.name ?? ''} mini={minis.get(x)} loading={minis.status === 'loading'} active={x === current} replace />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Search the Zelos list and jump to another chart (keeps your timeframe and style). */
function SymbolSwitcher({ open, onClose, current }: { open: boolean; onClose: () => void; current: string }) {
  const [q, setQ] = useState('');
  const quotes = useQuotes();
  const [recent] = useState(recentSymbols);
  // owner 2026-11-10: switch between the day-trading list and the long-term list (starts on this stock's list)
  // (picking a stock from the other list turns that mode on when its chart opens)
  const [speed, setSpeed] = useState<'fast' | 'slow'>(() => (instrument(current)?.fast === false ? 'slow' : 'fast'));
  const minutes = useModeMinutes();
  const qs = quotes.status === 'ready' ? quotes.data.quotes : {};
  // picking a symbol changes the page, which remounts this screen and closes the sheet; a search
  // looks in both lists
  const rows = searchUniverse(q)
    .filter((i) => (q.trim() ? true : i.fast === (speed === 'fast')))
    .filter((i) => i.sym !== current)
    .map((i) => ({ sym: i.sym, name: i.name, price: qs[i.sym]?.c, chPct: qs[i.sym]?.chPct }));
  return (
    <Sheet open={open} onClose={onClose} title={t('chart.switch.title')} labelledBy="chart-switch-title">
      <div className={s.switchSpeed}>
        <Tabs
          stretch
          label={t('market.speed')}
          value={speed}
          onChange={setSpeed}
          items={[
            { value: 'fast', label: t('market.speed.fast') },
            { value: 'slow', label: t('market.speed.slow') },
          ]}
        />
      </div>
      <label className={s.switchSearch}>
        <Icon name="search" size={18} />
        <span className="visually-hidden">{t('markets.search')}</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('markets.searchPlaceholder')} autoComplete="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="search" autoFocus />
      </label>
      {!q && recent.filter((x) => x !== current).length > 0 && (
        <div className={s.recent}>
          <span>{t('chart.recent')}</span>
          {recent
            .filter((x) => x !== current)
            .map((x) => (
              <Link key={x} to={`/markets/${x}`} replace className={buttonClass({ variant: 'secondary', size: 'sm' })}>
                {x}
              </Link>
            ))}
        </div>
      )}
      <MarketList rows={rows} label={t('chart.switch.title')} replace />
      <div className={s.modeHelp}>
        <h3>{t('mode.explain.title')}</h3>
        <p>{modeExplanation(minutes)}</p>
      </div>
      <p className={s.switchScope}>{t('markets.scope', { count: UNIVERSE.length })}</p>
    </Sheet>
  );
}
