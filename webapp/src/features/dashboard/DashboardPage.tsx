/**
 * Dashboard (owner 2026-11-14): compact, the account chart near the top. One small line on top,
 * "Welcome back, Nate · Virtual money", with the market status and when prices update next. On a
 * phone a pull-down under it opens the Zelos sections as app icons (AppDrawer); a computer has the
 * sidebar. The old page row is gone; Profile, Market and Strategies have their own pages, and
 * ?p=profile|market|strategies still opens the older panels for links people saved.
 *
 * Earlier: the Trade War command center, as 4 pages (Phase 6, F14):
 *   Trading     your Solo account (value, stock and option positions, open orders), first
 *               steps and your battles; every list says which mode it belongs to
 *   Profile     trader card, level, daily missions (counted by the server), achievements,
 *               the leaderboard
 *   Market      the US index chart (candles), indexes and sectors, movers, watchlist
 *   Strategies  the strategies and your alerts (only what exists)
 * A row of page links on top; on phones a sideways swipe changes page (pages.ts). Every panel
 * reads real server data or your own progress; nothing is mocked.
 */
import { LevelCard } from '../learn/LevelCard';
import { useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { parseUserDoc, useUserDoc } from '../../data/userDoc';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { Badge, Card, useToast } from '../../ui';
import { useIsPhone } from '../../lib/useIsPhone';
import { UpdateTimer } from '../markets/UpdateTimer';
import { AppDrawer } from './AppDrawer';
import { EarningsCard } from './Earnings';
import { PushNudge } from '../alerts/PushNudge';
import { StatusLine } from '../markets/StatusLine';
import { useQuotes } from '../../data/markets';
import { AchievementsCard, IndexStrip, LeaderboardCard, MissionsCard, MoversCard, TraderCard, WarsCard, WatchlistCard, WelcomeCard } from './Panels';
import { MarketView } from '../markets/MarketView';
import { SectorBars } from '../markets/Sectors';
import { achievementsView, mergeProgress, missionsView, readLocal } from './progress';
import { useIdentity, useMyProfile, useMyRank } from './social';
import { usePracticeAccount } from '../practice/account';
import { AccountMore, AccountSection } from '../practice/AccountSection';
import { PendingPanel } from '../practice/DashCards';
import { FirstSteps } from '../welcome/FirstSteps';
import { StrategiesPromo } from '../strategies/StrategiesPromo';
import { lsGet, SKIP_KEY } from '../welcome/welcome';
import { pageFrom, type DashPage } from './pages';
import s from './DashboardPage.module.css';

export default function DashboardPage() {
  const quotes = useQuotes();
  const { user, isReal, openSignIn } = useAuth();
  const toast = useToast();
  const uid = isReal && user ? user.uid : null;
  const userDoc = useUserDoc(uid);
  const identity = useIdentity(uid);
  const profile = useMyProfile(uid);
  const me = profile.status === 'ready' ? profile.data : null;
  const rank = useMyRank(me?.equity ?? null);

  // progress: this browser's copy (shared with the website) merged with the account's copy
  const [local] = useState(readLocal);
  const remote = userDoc.status === 'ready' ? userDoc.data.progress : null;
  const counted = userDoc.status === 'ready' ? userDoc.data.missions : null; // the server's count
  const progress = useMemo(() => mergeProgress(mergeProgress(local.progress, remote), counted), [local.progress, remote, counted]);
  const now = useNow();
  const streak = missionsView(progress, local.xpLog, now).streak;
  const ach = achievementsView(progress, me?.achievements);

  const name = (identity.status === 'ready' && identity.data.name) || user?.displayName?.split(' ')[0] || '';
  const signIn = () => void openSignIn().catch(() => toast.show(t('auth.signInFailed'), 'error'));
  const acct = usePracticeAccount(uid);

  // first sign-in: no @username and the welcome not done or skipped -> the welcome screens
  const hasUsername = identity.status === 'ready' && !!identity.data.username;
  const meDoc = useMemo(() => (userDoc.status === 'ready' ? userDoc.data : userDoc.status === 'missing' ? parseUserDoc({}) : null), [userDoc]); // a brand-new player has no users doc yet
  const fresh = !!uid && !!meDoc && identity.status !== 'loading' && !hasUsername && !meDoc.onboard.profile;
  const [skipped] = useState(() => lsGet(SKIP_KEY) === '1');
  const isNew = !!meDoc && !meDoc.onboard.trade && meDoc.xp < 100; // "Welcome" until the first trade

  const watch = useMemo(() => (userDoc.status === 'ready' ? { status: 'ready' as const, data: userDoc.data.watchlist } : userDoc.status === 'missing' ? { status: 'ready' as const, data: [] as string[] } : userDoc), [userDoc]);

  const [params, setParams] = useSearchParams();
  const page = pageFrom(params.get('p'));
  const go = (p: DashPage) => setParams(p === 'trading' ? {} : { p }, { replace: true });
  const phone = useIsPhone();
  const acctData = acct.status === 'ready' ? acct.data : null;
  // what this account holds or watches: for the update timer and upcoming earnings
  const held = useMemo(() => (acctData ? Array.from(new Set([...acctData.positions.map((p) => p.sym), ...acctData.options.map((o) => o.u)])) : []), [acctData]);
  const mine = useMemo(() => Array.from(new Set([...held, ...(watch.status === 'ready' ? watch.data : [])])), [held, watch]);

  if (fresh && !skipped) return <Navigate to="/welcome" replace />;
  const trader = uid ? (
    <TraderCard identity={identity.status === 'ready' ? identity.data : null} xp={userDoc.status === 'ready' ? userDoc.data.xp : userDoc.status === 'loading' ? null : 0} streak={streak} rank={rank} badges={ach.unlocked.length} totalBadges={ach.total} />
  ) : (
    <WelcomeCard onSignIn={signIn} />
  );
  const status = (page === 'trading' || page === 'market') && (
    <div className={s.status}>
      <StatusLine quotes={quotes} />
      {page === 'trading' && <UpdateTimer syms={held} />}
    </div>
  );
  return (
    <div className={s.dash}>
      {/* owner 2026-11-14: one small line on top, then the chart; no page row */}
      <h1 className="visually-hidden">{t('nav.dashboard')}</h1>
      {phone && <AppDrawer />}
      <div className={s.top}>
        <p className={s.hello}>
          {uid && name ? t(isNew ? 'dash.helloNew' : 'dash.hello', { name }) : t('dash.helloGuest')}
          <Badge tone="accent">{t('practice.virtual')}</Badge>
        </p>
        {status}
      </div>
      <div className={s.pageBody} key={page} data-page={page}>
        {page === 'trading' && (
          <div className={s.tradeGrid}>
            {/* owner 2026-10-20: your account, positions (stocks and options) and orders come first.
                Phone (2026-11-14): pending orders right under the chart while there are any, otherwise
                down here; Activity & account settings at the very bottom. */}
            <div className={s.main}>
              {uid ? <AccountSection uid={uid} phone={phone} /> : trader}
              {uid && !phone && <AccountMore uid={uid} />}
            </div>
            <div className={s.side}>
              {/* computer: pending orders (or today's market movers) first; on a phone they sit under the chart */}
              {uid && !phone && <PendingPanel uid={uid} />}
              {/* owner 2026-11-15: Battle right under Solo positions and options */}
              <WarsCard uid={uid} />
              {uid && meDoc && acct.status !== 'loading' && identity.status !== 'loading' && (
                <FirstSteps uid={uid} me={meDoc} hasUsername={hasUsername} hasAccount={acct.status === 'ready' && !!acct.data} />
              )}
              {uid && <PushNudge uid={uid} />}
              <EarningsCard mine={mine} />
            </div>
            {uid && phone && <AccountMore uid={uid} />}
          </div>
        )}
        {page === 'profile' && (
          <div className={s.profGrid}>
            <div className={s.stack}>
              {uid && meDoc && <LevelCard me={meDoc} />}
              {trader}
            </div>
            <MissionsCard progress={progress} xpLog={local.xpLog} />
            <div className={s.stack}>
              <LeaderboardCard uid={uid} rank={rank} me={me} />
              <AchievementsCard progress={progress} publicIds={me?.achievements ?? []} />
            </div>
          </div>
        )}
        {page === 'market' && (
          <div className={s.marketGrid}>
            <MarketView hero className={s.mHero} globeHeight={420} phoneGlobeHeight={280} />
            <div className={s.mSide}>
              <IndexStrip />
              {uid && <WatchlistCard watch={watch} uid={uid} />}
              <Card title={t('dash.sectors')} className={s.mSectors}>
                <SectorBars />
              </Card>
            </div>
            <MoversCard className={s.mMovers} />
          </div>
        )}
        {page === 'strategies' && (
          <>
            <StrategiesPromo />
            <Card title={t('dash.strat.alerts')} actions={<Link className="hit" to="/alerts">{t('dash.strat.alerts.open')}</Link>}>
              <p className={s.muted}>{t('dash.strat.alerts.body')}</p>
            </Card>
          </>
        )}
        {page !== 'trading' && (
          <p className={s.back}>
            <button type="button" className={['hit', s.backBtn].join(' ')} onClick={() => go('trading')}>
              {t('dash.backToTrading')}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
