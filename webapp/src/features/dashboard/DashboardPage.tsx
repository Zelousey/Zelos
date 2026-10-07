/**
 * Dashboard: the home screen. Index ETFs (stat tiles), top movers, sector moves, your
 * watchlist and a way into Practice. Every row and tile opens the chart.
 * Desktop: a 12-column grid. Phone: one column, index tiles swipe sideways.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useMovers, useQuotes, useSnapshot } from '../../data/markets';
import { instrument, INDEX_ETFS } from '../../data/universe';
import { useAuth } from '../../lib/auth';
import { formatPercent, formatPrice } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useMediaQuery, PHONE_QUERY } from '../../lib/useMediaQuery';
import { buttonClass, Card, Change, EmptyState, ErrorState, LoadingState, PageHeader, Skeleton, Sparkline, Stat, Tabs } from '../../ui';
import { MarketList } from '../markets/MarketRow';
import { StatusLine } from '../markets/StatusLine';
import { useWatchlist } from './useWatchlist';
import s from './DashboardPage.module.css';

type MoverTab = 'gainers' | 'losers' | 'actives';

export default function DashboardPage() {
  const quotes = useQuotes();
  const snapshot = useSnapshot();
  const movers = useMovers();
  const { user, isReal, signInWithGoogle } = useAuth();
  const watch = useWatchlist(isReal && user ? user.uid : null);
  const [tab, setTab] = useState<MoverTab>('gainers');
  // phones get a shorter, focused home screen; the full lists are one tap away
  const phone = useMediaQuery(PHONE_QUERY);
  const moverCount = phone ? 5 : 6;
  const qs = useMemo(() => (quotes.status === 'ready' ? quotes.data.quotes : {}), [quotes]);

  const indexTiles = INDEX_ETFS.map(({ sym, label }) => {
    const snap = snapshot.status === 'ready' ? snapshot.data.items[sym] : undefined;
    const spark = snapshot.status === 'ready' ? snapshot.data.spark[sym]?.points.map((p) => p.c) ?? [] : [];
    const q = qs[sym];
    return { sym, label, price: q?.c ?? snap?.price ?? null, pct: q?.chPct ?? snap?.pct ?? null, spark };
  });
  const loadingTiles = quotes.status === 'loading' && snapshot.status === 'loading';

  const watchRows = useMemo(() => {
    if (watch.status !== 'ready') return [];
    return watch.data.map((sym) => ({ sym, name: instrument(sym)?.name ?? '', price: qs[sym]?.c, chPct: qs[sym]?.chPct }));
  }, [watch, qs]);

  const allSectors = movers.status === 'ready' ? movers.data.sectors : [];
  // phones: the five biggest moves either way, still in order from best to worst
  const sectors = phone ? [...allSectors].sort((a, b) => Math.abs(b.chPct) - Math.abs(a.chPct)).slice(0, 5).sort((a, b) => b.chPct - a.chPct) : allSectors;
  const maxAbs = Math.max(1, ...allSectors.map((x) => Math.abs(x.chPct)));

  return (
    <>
      <PageHeader title={t('nav.dashboard')} />
      <StatusLine quotes={quotes} />
      <div className={s.grid}>
        <section className={s.indexes} aria-label={t('dash.indexes')}>
          <div className={s.tiles}>
            {indexTiles.map((x) => (
              <Card key={x.sym} as="article" interactive>
                <Link to={`/markets/${x.sym}`} className={s.tile} aria-label={`${x.label} (${x.sym}) ${formatPrice(x.price)} ${formatPercent(x.pct)} today`}>
                  {loadingTiles ? (
                    <Skeleton height={48} />
                  ) : (
                    <Stat label={`${x.label} · ${x.sym}`} value={formatPrice(x.price)} delta={<>{formatPercent(x.pct)} today</>} direction={x.pct == null ? 'flat' : x.pct > 0 ? 'up' : x.pct < 0 ? 'down' : 'flat'} />
                  )}
                  <Sparkline values={x.spark} label={`${x.label}, last month`} />
                </Link>
              </Card>
            ))}
          </div>
          <p className={s.tileNote}>{t('dash.indexesNote')}</p>
        </section>

        <Card className={s.movers} title={t('dash.movers')} subtitle={t('dash.movers.scope')} flush>
          <div style={{ padding: 'var(--space-3) var(--space-4) var(--space-2)' }}>
            <Tabs label={t('dash.movers')} value={tab} onChange={setTab} stretch items={[{ value: 'gainers', label: t('dash.movers.gainers') }, { value: 'losers', label: t('dash.movers.losers') }, { value: 'actives', label: t('dash.movers.actives') }]} />
          </div>
          {movers.status === 'loading' ? (
            <LoadingState rows={5} />
          ) : movers.status === 'error' ? (
            <ErrorState compact />
          ) : movers.status === 'missing' || movers.data[tab].length === 0 ? (
            <EmptyState icon="markets" body={t('dash.movers.empty')} compact />
          ) : (
            <MarketList rows={movers.data[tab].slice(0, moverCount)} label={t(`dash.movers.${tab}`)} />
          )}
          <div className={s.foot}>
            <span />
            <Link to="/markets">{t('dash.allMarkets')} →</Link>
          </div>
        </Card>

        <Card className={s.sectors} title={t('dash.sectors')} flush>
          {movers.status === 'loading' ? (
            <LoadingState rows={5} />
          ) : sectors.length === 0 ? (
            <EmptyState icon="markets" body={t('dash.sectors.empty')} compact />
          ) : (
            <ul className={s.sectorList}>
              {sectors.map((x) => (
                <li key={x.sector} className={s.sectorRow}>
                  <span className={s.sectorName} title={x.sector}>{x.sector}</span>
                  <span className={s.track} aria-hidden>
                    <span className={[s.bar, x.chPct >= 0 ? s.barUp : s.barDown].join(' ')} style={{ width: `${(Math.abs(x.chPct) / maxAbs) * 50}%` }} />
                  </span>
                  <Change pct={x.chPct} className={s.pct} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className={s.watch} title={t('dash.watchlist')} flush>
          {!isReal ? (
            <div className={s.signin}>
              <span>{t('dash.watchlist.signedOut')}</span>
              <button type="button" className={buttonClass({ variant: 'primary', size: 'sm' })} onClick={() => void signInWithGoogle().catch(() => {})}>
                {t('auth.signIn')}
              </button>
            </div>
          ) : watch.status === 'loading' ? (
            <LoadingState rows={4} />
          ) : watchRows.length === 0 ? (
            <EmptyState icon="markets" body={t('dash.watchlist.empty')} compact />
          ) : (
            <MarketList rows={watchRows} label={t('dash.watchlist')} />
          )}
        </Card>

        <Card className={s.practice} title={t('dash.practice')}>
          <div className={s.practiceBody}>
            <p>{t('dash.practice.body')}</p>
            <Link className={buttonClass({ variant: 'secondary' })} to="/practice">
              {t('dash.practice.open')}
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
