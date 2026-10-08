/**
 * Dashboard: the Trade War command center (redesign of the classic dashboard.html, owner
 * reference 2026-10-08). Your trader card and Trade War account on top, then the live
 * globe, daily missions, the leaderboard, your Trade Wars, achievements, movers and the
 * US market. Every panel reads real server data or your own progress; nothing is mocked.
 *
 * Layout: a grid with named areas. Phones get one column in the order a player needs:
 * account, missions, wars, leaderboard, then the market.
 */
import { useMemo, useState } from 'react';
import { useUserDoc } from '../../data/userDoc';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { PageHeader, useToast } from '../../ui';
import { StatusLine } from '../markets/StatusLine';
import { useQuotes } from '../../data/markets';
import { AccountCard, AchievementsCard, GlobePanel, LeaderboardCard, MarketCard, MissionsCard, MoversCard, TraderCard, WarsCard, WatchlistCard, WelcomeCard } from './Panels';
import { achievementsView, mergeProgress, missionsView, readLocal } from './progress';
import { useIdentity, useMyProfile, useMyRank } from './social';
import s from './DashboardPage.module.css';

export default function DashboardPage() {
  const quotes = useQuotes();
  const { user, isReal, signInWithGoogle } = useAuth();
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
  const progress = useMemo(() => mergeProgress(local.progress, remote), [local.progress, remote]);
  const now = useNow();
  const streak = missionsView(progress, local.xpLog, now).streak;
  const ach = achievementsView(progress, me?.achievements);

  const name = (identity.status === 'ready' && identity.data.name) || user?.displayName?.split(' ')[0] || '';
  const signIn = () => void signInWithGoogle().catch(() => toast.show(t('auth.signInFailed'), 'error'));
  const watch = useMemo(() => (userDoc.status === 'ready' ? { status: 'ready' as const, data: userDoc.data.watchlist } : userDoc), [userDoc]);

  return (
    <>
      <PageHeader title={t('nav.dashboard')} subtitle={uid && name ? t('dash.hello', { name }) : t('dash.helloGuest')} />
      <StatusLine quotes={quotes} />
      <div className={[s.grid, uid ? s.signedIn : s.signedOut].join(' ')}>
        {uid ? (
          <>
            <TraderCard uid={uid} identity={identity.status === 'ready' ? identity.data : null} xp={userDoc.status === 'ready' ? userDoc.data.xp : userDoc.status === 'loading' ? null : 0} streak={streak} rank={rank} badges={ach.unlocked.length} totalBadges={ach.total} />
            <AccountCard uid={uid} />
          </>
        ) : (
          <WelcomeCard onSignIn={signIn} />
        )}
        <MissionsCard progress={progress} xpLog={local.xpLog} />
        <WarsCard uid={uid} />
        <LeaderboardCard uid={uid} rank={rank} me={me} />
        <GlobePanel />
        <MoversCard />
        <AchievementsCard progress={progress} publicIds={me?.achievements ?? []} />
        <MarketCard />
        {uid && <WatchlistCard watch={watch} />}
      </div>
    </>
  );
}
