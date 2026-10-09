/**
 * Market: the overview. A chart of the US indexes (or, one tap away, the live globe + open
 * exchanges; owner decision 2026-10-09), the US market (sectors),
 * "charts at a glance" (mini charts of the indexes, your watchlist and today's movers) and
 * every stock on the Zelos list with search. Every chart opens the big chart screen
 * (SymbolPage), which is where charting happens: Market is for looking around.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useMovers, useQuotes } from '../../data/markets';
import { groups, instrument, searchUniverse, UNIVERSE } from '../../data/universe';
import { useUserDoc } from '../../data/userDoc';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { buttonClass, Card, EmptyState, ErrorState, Icon, LoadingState, PageHeader, Tabs } from '../../ui';
import { MarketList } from './MarketRow';
import { MiniChart } from './MiniChart';
import { useMinis } from './miniSeries';
import { SectorBars } from './Sectors';
import { StatusLine } from './StatusLine';
import { MarketView } from './MarketView';
import s from './MarketsPage.module.css';

type Glance = 'indexes' | 'watchlist' | 'gainers' | 'losers' | 'actives';
const INDEXES = UNIVERSE.filter((i) => i.group === 'ETF').map((i) => i.sym);

export default function MarketsPage() {
  const quotes = useQuotes();
  return (
    <>
      <PageHeader
        title={t('nav.market')}
        subtitle={t('market.subtitle')}
        actions={
          <Link to="/charts" className={buttonClass({ variant: 'primary', size: 'sm' })}>
            <Icon name="chart" size={16} /> {t('market.openCharts')}
          </Link>
        }
      />
      <StatusLine quotes={quotes} />
      <div className={s.grid}>
        <MarketView className={s.world} globeHeight={380} phoneGlobeHeight={280} all />
        <Card className={s.sectors} title={t('dash.sectors')} subtitle={t('dash.movers.scope')}>
          <SectorBars />
        </Card>
        <GlanceCard />
        <AllStocks />
      </div>
    </>
  );
}

function GlanceCard() {
  const [tab, setTab] = useState<Glance>('indexes');
  const { user, isReal } = useAuth();
  const userDoc = useUserDoc(isReal && user ? user.uid : null);
  const movers = useMovers();
  const minis = useMinis();
  // movers are limited to the Zelos list (the server does that too); anything else has no chart
  const fromMovers = (k: 'gainers' | 'losers' | 'actives') => (movers.status === 'ready' ? movers.data[k].map((m) => m.sym).filter((x) => instrument(x)) : []);
  const syms = tab === 'indexes' ? INDEXES : tab === 'watchlist' ? (userDoc.status === 'ready' ? userDoc.data.watchlist : []) : fromMovers(tab);
  const items: { value: Glance; label: string }[] = [
    { value: 'indexes', label: t('market.tab.indexes') },
    { value: 'watchlist', label: t('market.tab.watchlist') },
    { value: 'gainers', label: t('dash.movers.gainers') },
    { value: 'losers', label: t('dash.movers.losers') },
    { value: 'actives', label: t('dash.movers.actives') },
  ];
  let body;
  if (tab === 'watchlist' && !(isReal && user)) body = <EmptyState icon="markets" body={t('market.watch.signedOut')} compact />;
  else if (tab !== 'indexes' && tab !== 'watchlist' && movers.status === 'loading') body = <LoadingState rows={3} />;
  else if (!syms.length) body = <EmptyState icon="markets" body={tab === 'watchlist' ? t('dash.watchlist.empty') : t('dash.movers.empty')} compact />;
  else
    body = (
      <ul className={s.minis} aria-label={items.find((i) => i.value === tab)!.label}>
        {syms.slice(0, 8).map((sym) => (
          <li key={sym}>
            <MiniChart sym={sym} name={instrument(sym)?.name ?? ''} mini={minis.get(sym)} loading={minis.status === 'loading'} />
          </li>
        ))}
      </ul>
    );
  return (
    <Card className={s.glance} title={t('market.glance')} subtitle={t('market.glance.sub')}>
      <div className={s.glanceTabs}>
        <Tabs label={t('market.glance')} value={tab} onChange={setTab} items={items} />
      </div>
      {body}
    </Card>
  );
}

function AllStocks() {
  const quotes = useQuotes();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const rows = useMemo(() => {
    const qs = quotes.status === 'ready' ? quotes.data.quotes : {};
    return searchUniverse(q)
      .filter((i) => group === 'all' || i.group === group)
      .map((i) => ({ sym: i.sym, name: i.name, price: qs[i.sym]?.c, chPct: qs[i.sym]?.chPct }));
  }, [quotes, q, group]);
  return (
    <Card className={s.all} title={t('market.allStocks')} flush>
      <div className={s.tools}>
        <label className={s.search}>
          <Icon name="search" size={18} />
          <span className="visually-hidden">{t('markets.search')}</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('markets.searchPlaceholder')} autoComplete="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="search" />
        </label>
        <Tabs label={t('markets.search')} value={group} onChange={setGroup} items={[{ value: 'all', label: t('markets.all') }, ...groups().map((g) => ({ value: g, label: g }))]} />
      </div>
      {quotes.status === 'loading' ? (
        <LoadingState rows={8} />
      ) : quotes.status === 'error' ? (
        <ErrorState compact />
      ) : rows.length === 0 ? (
        <EmptyState icon="search" title={t('markets.empty', { q })} compact />
      ) : (
        <MarketList rows={rows} label={t('nav.market')} />
      )}
      <p className={s.scope}>{t('markets.scope', { count: UNIVERSE.length })}</p>
    </Card>
  );
}
