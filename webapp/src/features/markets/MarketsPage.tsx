/**
 * Market: the overview, as one page (owner brief 2026-11-08). On a computer the US index chart
 * (or, one tap away, the live globe; owner decision 2026-10-09) fills most of the screen; on the
 * right a compact stock search, your watchlist and today's sectors; under the chart one row of
 * tabs (indexes, watchlist, gainers, losers, most active, every stock) with small charts. On a
 * phone the same parts stack, search first. Every chart opens the big chart screen (SymbolPage),
 * which is where charting happens: Market is for looking around.
 */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMovers, useQuotes } from '../../data/markets';
import { bySpeed, groups, instrument, searchUniverse, UNIVERSE } from '../../data/universe';
import { useMode } from '../../data/tradeMode';
import { useUserDoc } from '../../data/userDoc';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { Button, Card, EmptyState, ErrorState, Icon, LoadingState, PageHeader, Tabs } from '../../ui';
import { MarketList } from './MarketRow';
import { MiniChart } from './MiniChart';
import { useMinis } from './miniSeries';
import { SectorBars } from './Sectors';
import { StatusLine } from './StatusLine';
import { MarketView } from './MarketView';
import { TradeChoice } from './TradeChoice';
import { ModeToggle } from './ModeToggle';
import s from './MarketsPage.module.css';

type Glance = 'indexes' | 'watchlist' | 'gainers' | 'losers' | 'actives' | 'all';
const INDEXES = UNIVERSE.filter((i) => i.group === 'ETF').map((i) => i.sym);

type Speed = 'fast' | 'slow';
/** The Day Trading / Long Term choice, shared with the chart below and the Full Chart (data/tradeMode). */
const useSpeed = useMode;

export default function MarketsPage() {
  const quotes = useQuotes();
  const [speed, setSpeed] = useSpeed();
  // Find a stock (Phase 7): from a "Find a stock" button, picking a stock asks Solo or Battle
  const [params] = useSearchParams();
  const find = params.get('find') === '1';
  const [picked, setPicked] = useState<string | null>(null);
  if (find)
    return (
      <>
        <PageHeader title={t('find.page')} subtitle={t('find.page.sub')} />
        <Card className={s.findCard} flush>
          <AllStocks speed={speed} setSpeed={setSpeed} onPick={setPicked} />
        </Card>
        <TradeChoice sym={picked} onClose={() => setPicked(null)} />
      </>
    );
  return (
    <div className={s.page}>
      <h1 className="visually-hidden">{t('nav.market')}</h1>
      <div className={s.topRow}>
        <StatusLine quotes={quotes} />
        {/* owner 2026-11-10: this switch changes the chart below too, and the Full Chart keeps it */}
        <ModeToggle className={s.speed} />
        <Link to="/charts" className={s.openCharts}>
          <Icon name="chart" size={16} /> {t('market.openCharts')}
        </Link>
      </div>
      <div className={s.layout}>
        <MarketView hero className={s.hero} globeHeight={460} phoneGlobeHeight={280} all />
        <aside className={s.side} aria-label={t('market.side')}>
          <QuickSearch speed={speed} />
          <WatchPanel />
          <section className={s.panel} aria-labelledby="mk-sectors">
            <h2 id="mk-sectors" className={s.panelTitle}>
              {t('dash.sectors')}
            </h2>
            <SectorBars />
          </section>
        </aside>
        <Glance speed={speed} setSpeed={setSpeed} />
      </div>
    </div>
  );
}

/** The compact search in the top-right corner: matches drop down under it, across every stock. */
function QuickSearch({ speed }: { speed: Speed }) {
  const quotes = useQuotes();
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    if (!q.trim()) return [];
    const qs = quotes.status === 'ready' ? quotes.data.quotes : {};
    // this trading style first, then the rest
    return searchUniverse(q)
      .sort((a, b) => Number(b.fast === (speed === 'fast')) - Number(a.fast === (speed === 'fast')))
      .slice(0, 8)
      .map((i) => ({ sym: i.sym, name: i.name, price: qs[i.sym]?.c, chPct: qs[i.sym]?.chPct }));
  }, [quotes, q, speed]);
  return (
    <div className={s.quick}>
      <label className={s.search}>
        <Icon name="search" size={16} />
        <span className="visually-hidden">{t('markets.search')}</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setQ('')}
          placeholder={t('markets.searchPlaceholder')}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="search"
        />
      </label>
      {q.trim() !== '' && (
        <div className={s.results}>
          {rows.length ? <MarketList rows={rows} label={t('nav.market')} dense /> : <p className={s.none}>{t('markets.empty', { q })}</p>}
        </div>
      )}
    </div>
  );
}

/** Your watchlist, one line per stock (sign in to keep one). */
function WatchPanel() {
  const quotes = useQuotes();
  const { user, isReal } = useAuth();
  const doc = useUserDoc(isReal && user ? user.uid : null);
  const list = doc.status === 'ready' ? doc.data.watchlist : [];
  const qs = quotes.status === 'ready' ? quotes.data.quotes : {};
  const rows = list.map((sym) => ({ sym, name: instrument(sym)?.name ?? '', price: qs[sym]?.c, chPct: qs[sym]?.chPct }));
  return (
    <section className={[s.panel, s.watch].join(' ')} aria-labelledby="mk-watch">
      <h2 id="mk-watch" className={s.panelTitle}>
        {t('market.tab.watchlist')}
      </h2>
      {!(isReal && user) ? (
        <p className={s.none}>{t('market.watch.signedOut')}</p>
      ) : !rows.length ? (
        <p className={s.none}>{t('dash.watchlist.empty')}</p>
      ) : (
        <div className={s.watchList}>
          <MarketList rows={rows} label={t('market.tab.watchlist')} dense />
        </div>
      )}
    </section>
  );
}

/** One row of tabs under the chart, then small charts (or, for All stocks, the whole list). */
function Glance({ speed, setSpeed }: { speed: Speed; setSpeed: (x: Speed) => void }) {
  const [tab, setTab] = useState<Glance>('indexes');
  const { user, isReal } = useAuth();
  const userDoc = useUserDoc(isReal && user ? user.uid : null);
  const movers = useMovers();
  const minis = useMinis();
  // movers are limited to the Zelos list (the server does that too); anything else has no chart
  const fromMovers = (k: 'gainers' | 'losers' | 'actives') => (movers.status === 'ready' ? movers.data[k].map((m) => m.sym).filter((x) => instrument(x)) : []);
  // owner 2026-11-12: no empty cards; a fund with no price yet is left out once prices have loaded
  const priced = (list: string[]) => (minis.status === 'loading' ? list : list.filter((x) => minis.get(x).price != null));
  const syms = tab === 'all' ? [] : tab === 'indexes' ? priced(INDEXES) : tab === 'watchlist' ? (userDoc.status === 'ready' ? userDoc.data.watchlist : []) : fromMovers(tab);
  const items: { value: Glance; label: string }[] = [
    { value: 'indexes', label: t('market.tab.indexes') },
    { value: 'watchlist', label: t('market.tab.watchlist') },
    { value: 'gainers', label: t('dash.movers.gainers') },
    { value: 'losers', label: t('dash.movers.losers') },
    { value: 'actives', label: t('dash.movers.actives') },
    { value: 'all', label: t('market.allStocks') },
  ];
  let body;
  if (tab === 'all') body = <AllStocks speed={speed} setSpeed={setSpeed} columns />;
  else if (tab === 'watchlist' && !(isReal && user)) body = <EmptyState icon="markets" body={t('market.watch.signedOut')} compact />;
  else if (tab !== 'indexes' && tab !== 'watchlist' && movers.status === 'loading') body = <LoadingState rows={3} />;
  else if (!syms.length) body = <EmptyState icon="markets" body={tab === 'watchlist' ? t('dash.watchlist.empty') : t('dash.movers.empty')} compact />;
  else
    body = (
      <ul className={s.minis} aria-label={items.find((i) => i.value === tab)!.label}>
        {syms.slice(0, 8).map((sym) => (
          <li key={sym}>
            <MiniChart compact sym={sym} name={instrument(sym)?.name ?? ''} mini={minis.get(sym)} loading={minis.status === 'loading'} />
          </li>
        ))}
      </ul>
    );
  return (
    <section className={s.glance} aria-label={t('market.glance')}>
      <div className={s.glanceTabs}>
        <Tabs label={t('market.glance')} value={tab} onChange={setTab} items={items} />
      </div>
      {body}
    </section>
  );
}

/** Every stock, in two sections (owner, 2026-10-22): day trading (prices every minute) and
 * long-term (every 15 minutes), so the data plan lasts the month. */
function AllStocks({ onPick, speed, setSpeed: setSpeedRaw, columns }: { onPick?: (sym: string) => void; speed: Speed; setSpeed: (x: Speed) => void; columns?: boolean }) {
  const quotes = useQuotes();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const setSpeed = (x: Speed) => {
    setSpeedRaw(x);
    setGroup('all');
  };
  const section = useMemo(() => bySpeed(speed === 'fast'), [speed]);
  const rows = useMemo(() => {
    const qs = quotes.status === 'ready' ? quotes.data.quotes : {};
    return searchUniverse(q)
      .filter((i) => i.fast === (speed === 'fast'))
      .filter((i) => group === 'all' || i.group === group)
      .map((i) => ({ sym: i.sym, name: i.name, price: qs[i.sym]?.c, chPct: qs[i.sym]?.chPct }));
  }, [quotes, q, group, speed]);
  const other = speed === 'fast' ? 'slow' : 'fast';
  const inOther = q.trim() !== '' && rows.length === 0 && searchUniverse(q).some((i) => i.fast === (other === 'fast'));
  const sectionGroups = groups().filter((g) => section.some((i) => i.group === g));
  return (
    <>
      {onPick && (
      <div className={s.speedFind}>
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
        <p className={s.speedNote}>{speed === 'fast' ? t('market.speed.fastNote') : t('market.speed.slowNote')}</p>
      </div>
      )}
      <div className={[s.tools, !onPick && s.toolsBare].filter(Boolean).join(' ')}>
        <label className={s.search}>
          <Icon name="search" size={18} />
          <span className="visually-hidden">{t('markets.search')}</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('markets.searchPlaceholder')} autoComplete="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="search" />
        </label>
        <Tabs label={t('markets.search')} value={group} onChange={setGroup} items={[{ value: 'all', label: t('markets.all') }, ...sectionGroups.map((g) => ({ value: g, label: g }))]} />
      </div>
      {quotes.status === 'loading' ? (
        <LoadingState rows={8} />
      ) : quotes.status === 'error' ? (
        <ErrorState compact />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="search"
          title={t('markets.empty', { q })}
          body={inOther ? t('market.speed.inOther', { section: t(other === 'fast' ? 'market.speed.fast' : 'market.speed.slow') }) : undefined}
          actions={inOther ? <Button variant="secondary" size="sm" onClick={() => setSpeed(other)}>{t(other === 'fast' ? 'market.speed.fast' : 'market.speed.slow')}</Button> : undefined}
          compact
        />
      ) : (
        <MarketList rows={rows} label={onPick ? t('nav.market') : t('market.allStocks')} onPick={onPick} dense={!onPick} columns={columns} />
      )}
      <p className={s.scope}>{onPick ? t('markets.scope', { count: UNIVERSE.length }) : `${speed === 'fast' ? t('market.speed.fastNote') : t('market.speed.slowNote')} ${t('markets.scope', { count: UNIVERSE.length })}`}</p>
    </>
  );
}
