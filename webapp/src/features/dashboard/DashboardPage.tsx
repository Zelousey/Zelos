/**
 * Dashboard: the Trade War command center, as 4 pages (Phase 6, F14):
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
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { parseUserDoc, useUserDoc } from '../../data/userDoc';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { Card, PageHeader, useScrollFade, useToast } from '../../ui';
import { StatusLine } from '../markets/StatusLine';
import { useQuotes } from '../../data/markets';
import { AchievementsCard, GlobePanel, LeaderboardCard, MarketCard, MissionsCard, MoversCard, TraderCard, WarsCard, WatchlistCard, WelcomeCard } from './Panels';
import { achievementsView, mergeProgress, missionsView, readLocal } from './progress';
import { useIdentity, useMyProfile, useMyRank } from './social';
import { usePracticeAccount } from '../practice/account';
import { AccountSection } from '../practice/AccountSection';
import { FirstSteps } from '../welcome/FirstSteps';
import { StrategiesPromo } from '../strategies/StrategiesPromo';
import { lsGet, SKIP_KEY } from '../welcome/welcome';
import { PAGE_LABEL, PAGES, pageFrom, stepPage, swipeBlocked, swipeDirection, type DashPage } from './pages';
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
  const swipe = useSwipe(page, go);

  if (fresh && !skipped) return <Navigate to="/welcome" replace />;
  const trader = uid ? (
    <TraderCard identity={identity.status === 'ready' ? identity.data : null} xp={userDoc.status === 'ready' ? userDoc.data.xp : userDoc.status === 'loading' ? null : 0} streak={streak} rank={rank} badges={ach.unlocked.length} totalBadges={ach.total} />
  ) : (
    <WelcomeCard onSignIn={signIn} />
  );
  return (
    <>
      <PageHeader title={t('nav.dashboard')} subtitle={uid && name ? t(isNew ? 'dash.helloNew' : 'dash.hello', { name }) : t('dash.helloGuest')} />
      <PageNav page={page} go={go} />
      <div className={s.pageBody} {...swipe} key={page} data-page={page}>
        {page === 'trading' && (
          <>
            <StatusLine quotes={quotes} />
            {/* owner 2026-10-20: your account, open positions (stocks and options) and orders come first */}
            {uid && <AccountSection uid={uid} />}
            {uid && meDoc && acct.status !== 'loading' && identity.status !== 'loading' && (
              <FirstSteps uid={uid} me={meDoc} hasUsername={hasUsername} hasAccount={acct.status === 'ready' && !!acct.data} />
            )}
            <div className={s.cols}>
              {!uid && trader}
              <WarsCard uid={uid} />
            </div>
          </>
        )}
        {page === 'profile' && (
          <>
            {uid && meDoc && <LevelCard me={meDoc} />}
            {trader}
            <div className={s.cols}>
              <MissionsCard progress={progress} xpLog={local.xpLog} />
              <LeaderboardCard uid={uid} rank={rank} me={me} />
            </div>
            <AchievementsCard progress={progress} publicIds={me?.achievements ?? []} />
          </>
        )}
        {page === 'market' && (
          <>
            <StatusLine quotes={quotes} />
            <GlobePanel />
            <MarketCard />
            <div className={s.cols}>
              <MoversCard />
              {uid && <WatchlistCard watch={watch} uid={uid} />}
            </div>
          </>
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
    </>
  );
}

/** The page row (F14). Links keep the page in the address; arrow keys move between pages. */
function PageNav({ page, go }: { page: DashPage; go: (p: DashPage) => void }) {
  const ref = useRef<HTMLElement>(null);
  useScrollFade(ref);
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = stepPage(page, e.key === 'ArrowRight' ? 1 : -1);
    if (!next) return;
    e.preventDefault();
    go(next);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(`[data-page="${next}"]`)?.focus());
  }
  return (
    <nav ref={ref} className={s.pageNav} aria-label={t('dash.pages')} onKeyDown={onKey}>
      {PAGES.map((p) => (
        <Link key={p} to={p === 'trading' ? '/dashboard' : `/dashboard?p=${p}`} replace data-page={p} className={s.pageLink} aria-current={p === page ? 'page' : undefined}>
          {t(PAGE_LABEL[p])}
        </Link>
      ))}
    </nav>
  );
}

/** Phone swipe between pages: touch only, never from the screen edge, charts, fields or sideways rows. */
function useSwipe(page: DashPage, go: (p: DashPage) => void) {
  const start = useRef<{ x: number; y: number; at: number } | null>(null);
  return {
    onPointerDown(e: PointerEvent) {
      start.current = e.pointerType === 'touch' && e.isPrimary && !swipeBlocked(e.target as Element) ? { x: e.clientX, y: e.clientY, at: e.timeStamp } : null;
    },
    onPointerUp(e: PointerEvent) {
      const st = start.current;
      start.current = null;
      if (!st) return;
      const by = swipeDirection({ x0: st.x, y0: st.y, x1: e.clientX, y1: e.clientY, ms: e.timeStamp - st.at, width: window.innerWidth });
      const next = by ? stepPage(page, by) : null;
      if (next) go(next);
    },
    onPointerCancel() {
      start.current = null;
    },
  };
}
