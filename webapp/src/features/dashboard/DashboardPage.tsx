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
import { Card, useScrollFade, useToast } from '../../ui';
import { StatusLine } from '../markets/StatusLine';
import { useQuotes } from '../../data/markets';
import { AchievementsCard, IndexStrip, LeaderboardCard, MissionsCard, MoversCard, TraderCard, WarsCard, WatchlistCard, WelcomeCard } from './Panels';
import { MarketView } from '../markets/MarketView';
import { SectorBars } from '../markets/Sectors';
import { achievementsView, mergeProgress, missionsView, readLocal } from './progress';
import { useIdentity, useMyProfile, useMyRank } from './social';
import { usePracticeAccount } from '../practice/account';
import { AccountSection, OpenOrdersCard } from '../practice/AccountSection';
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
  const status = (page === 'trading' || page === 'market') && (
    <div className={s.status}>
      <StatusLine quotes={quotes} />
    </div>
  );
  return (
    <div className={s.dash}>
      {/* owner 2026-11-08: no big title; one slim row with the greeting, the page row and the market status */}
      <h1 className="visually-hidden">{t('nav.dashboard')}</h1>
      <div className={s.top}>
        <p className={s.hello}>{uid && name ? t(isNew ? 'dash.helloNew' : 'dash.hello', { name }) : t('dash.helloGuest')}</p>
        <PageNav page={page} go={go} />
        {status}
      </div>
      <div className={s.pageBody} {...swipe} key={page} data-page={page}>
        {page === 'trading' && (
          <div className={s.tradeGrid}>
            {/* owner 2026-10-20: your account, open positions (stocks and options) and orders come first */}
            <div className={s.main}>{uid ? <AccountSection uid={uid} ordersElsewhere /> : trader}</div>
            <div className={s.side}>
              {uid && meDoc && acct.status !== 'loading' && identity.status !== 'loading' && (
                <FirstSteps uid={uid} me={meDoc} hasUsername={hasUsername} hasAccount={acct.status === 'ready' && !!acct.data} />
              )}
              <WarsCard uid={uid} />
              {/* owner 2026-11-10: Solo · Open orders sits right under Battle */}
              {uid && <OpenOrdersCard uid={uid} />}
            </div>
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

/** The page row (F14). Links keep the page in the address; arrow keys move between pages. */
function PageNav({ page, go }: { page: DashPage; go: (p: DashPage) => void }) {
  const ref = useRef<HTMLElement>(null);
  useScrollFade(ref);
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    // step from the link that has focus (a fast second press can arrive before the page re-renders)
    const from = pageFrom((e.target as HTMLElement).closest<HTMLElement>('[data-page]')?.dataset.page ?? page);
    const next = stepPage(from, e.key === 'ArrowRight' ? 1 : -1);
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
