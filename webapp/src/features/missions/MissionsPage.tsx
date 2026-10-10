/**
 * Missions & XP (/missions; the website's Trade War "XP & Missions" tab): your level and XP,
 * the mission streak, daily and weekly missions, every achievement (earned and still to
 * earn), your recent XP and the invite-a-friend rewards. XP is paid only by the server.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { LEVELS, levelFor } from '../../data/levels';
import { useUserDoc } from '../../data/userDoc';
import { useAuth } from '../../lib/auth';
import { formatRelative } from '../../lib/format';
import { t } from '../../lib/i18n';
import { classicUrl } from '../../lib/platform';
import { useNow } from '../../lib/useNow';
import { Badge, Button, buttonClass, Card, EmptyState, LoadingState, PageHeader, useToast } from '../../ui';
import { LevelBadge } from '../dashboard/LevelBadge';
import { ACHIEVEMENTS, achievementsView, mergeProgress, missionsView, readLocal, STREAK_NEED, type MissionView } from '../dashboard/progress';
import { useMyProfile } from '../dashboard/social';
import { useMySquadList } from '../social/squads';
import { nextTier, referralTier, STREAK_REWARDS, unlockAchievement, useReferralCount, useXpHistory } from './missions';
import s from './Missions.module.css';

export default function MissionsPage() {
  const { user, isReal, ready, signInWithGoogle } = useAuth();
  const toast = useToast();
  if (!ready) return <LoadingState rows={6} />;
  if (!isReal || !user)
    return (
      <>
        <PageHeader title={t('nav.missions')} subtitle={t('ms.subtitle')} />
        <EmptyState
          icon="missions"
          body={t('ms.signIn')}
          actions={
            <Button variant="primary" onClick={() => void signInWithGoogle().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>
              {t('auth.signInWithGoogle')}
            </Button>
          }
        />
      </>
    );
  return <Missions uid={user.uid} />;
}

function Missions({ uid }: { uid: string }) {
  const userDoc = useUserDoc(uid);
  const profile = useMyProfile(uid);
  const now = useNow();
  const [local] = useState(readLocal);
  const doc = userDoc.status === 'ready' ? userDoc.data : null;
  const progress = useMemo(() => mergeProgress(mergeProgress(local.progress, doc?.progress ?? null), doc?.missions ?? null), [local.progress, doc]);
  const m = missionsView(progress, local.xpLog, now);
  const publicIds = profile.status === 'ready' ? (profile.data?.achievements ?? []) : [];
  const ach = achievementsView(progress, publicIds);
  useSquadUpCatchUp(uid, ach.unlocked.some((a) => a.id === 'squad-up'), userDoc.status === 'ready' || userDoc.status === 'missing');

  if (userDoc.status === 'loading') return <LoadingState rows={6} />;
  const xp = Math.max(doc?.xp ?? 0, profile.status === 'ready' ? (profile.data?.xp ?? 0) : 0);
  return (
    <>
      <PageHeader title={t('nav.missions')} subtitle={t('ms.subtitle')} />
      <div className={s.page}>
        <LevelCard xp={xp} streak={m.streak} best={m.best} />
        <LevelPath xp={xp} />
        <div className={s.cols}>
          <Card flush title={t('ms.daily')} subtitle={t('ms.daily.sub', { done: m.doneToday, need: STREAK_NEED })}>
            <MissionList list={m.daily} />
          </Card>
          <Card flush title={t('ms.weekly')}>
            <MissionList list={m.weekly} />
            <p className={s.note}>{t('ms.streakRewards', { list: STREAK_REWARDS.map(([d, x]) => t('ms.streakReward', { d, x })).join(' · ') })}</p>
          </Card>
        </div>
        <AchievementsCard unlocked={new Set(ach.unlocked.map((a) => a.id))} />
        <div className={s.cols}>
          <RecentXp uid={uid} />
          <InviteCard uid={uid} />
        </div>
      </div>
    </>
  );
}

/** Joined a squad in the app before it unlocked "Squad Up"? Unlock it once now. */
function useSquadUpCatchUp(uid: string, has: boolean, ready: boolean) {
  const squads = useMySquadList(uid);
  const toast = useToast();
  const tried = useRef(false);
  const inSquad = squads.status === 'ready' && squads.data.length > 0;
  useEffect(() => {
    if (!ready || has || !inSquad || tried.current) return;
    tried.current = true;
    void unlockAchievement(uid, 'squad-up', { key: 'squads', n: 1 }).then((xp) => toast.show(xp ? t('ms.unlocked.xp', { name: 'Squad Up', xp }) : t('ms.unlocked', { name: 'Squad Up' })));
  }, [ready, has, inSquad, uid, toast]);
}

function LevelCard({ xp, streak, best }: { xp: number; streak: number; best: number }) {
  const lv = levelFor(xp);
  return (
    <Card pad className={s.level}>
      <LevelBadge level={lv.level} size={72} />
      <div className={s.levelMain}>
        <span className={s.kicker}>{t('ms.level', { n: lv.level.level, title: lv.level.title })}</span>
        <b className={s.levelName}>{lv.level.name}</b>
        <div className={s.xpBar} role="progressbar" aria-label={t('ms.toNext')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(lv.progress * 100)}>
          <i style={{ width: `${Math.max(2, lv.progress * 100).toFixed(1)}%`, background: `linear-gradient(90deg, ${lv.level.colors[1]}, ${lv.level.colors[0]})` }} />
        </div>
        <span className={s.muted}>
          {t('dash.trader.xp', { xp: xp.toLocaleString('en-US') })} · {lv.next ? t('ms.next', { n: lv.toNext.toLocaleString('en-US'), level: lv.next.level, name: lv.next.name }) : t('dash.trader.max')}
        </span>
      </div>
      <div className={s.streak}>
        <b>🔥 {streak}</b>
        <small>{t('ms.streak')}</small>
        <span>{t('ms.best', { n: best })}</span>
      </div>
    </Card>
  );
}

function LevelPath({ xp }: { xp: number }) {
  const cur = levelFor(xp).level.level;
  return (
    <Card title={t('ms.path')} subtitle={t('ms.path.sub')}>
      <ol className={s.path} tabIndex={0} aria-label={t('ms.path')}>
        {LEVELS.map((l) => (
          <li key={l.level} className={l.level < cur ? s.pathDone : l.level === cur ? s.pathNow : s.pathNext} aria-current={l.level === cur ? 'step' : undefined}>
            <LevelBadge level={l} size={l.level === cur ? 64 : 48} />
            <b>{t('pf.level', { n: l.level })}</b>
            <small>{l.name}</small>
            <small className={s.pathXp}>{l.xp.toLocaleString('en-US')} XP</small>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function MissionList({ list }: { list: MissionView[] }) {
  return (
    <ul className={s.missions}>
      {list.map((x) => (
        <li key={x.id} className={x.done ? s.done : undefined}>
          <span className={s.check} aria-hidden="true">
            {x.done ? '✓' : ''}
          </span>
          <span className={s.label}>{x.href?.startsWith('/') ? <Link to={x.href}>{x.label}</Link> : x.href ? <a href={classicUrl(x.href)}>{x.label}</a> : x.label}</span>
          <span className={s.count} aria-label={t('ms.count', { n: x.count, of: x.goal }) + (x.done ? `, ${t('ms.done')}` : '')}>
            {x.count}/{x.goal}
          </span>
          <span className={s.xp}>+{x.xp}</span>
          <span className={s.mini} aria-hidden="true">
            <i style={{ width: `${((x.count / x.goal) * 100).toFixed(0)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function AchievementsCard({ unlocked }: { unlocked: Set<string> }) {
  const groups = useMemo(() => {
    const g: Record<string, typeof ACHIEVEMENTS> = {};
    for (const a of ACHIEVEMENTS) (g[a.group] ??= []).push(a);
    return Object.entries(g);
  }, []);
  return (
    <Card title={t('pf.ach')} subtitle={t('pf.ach.count', { n: unlocked.size, of: ACHIEVEMENTS.length })}>
      {groups.map(([group, list]) => (
        <section key={group} className={s.achGroup}>
          <h3 className={s.sub}>
            {group} <small>{t('ms.groupCount', { n: list.filter((a) => unlocked.has(a.id)).length, of: list.length })}</small>
          </h3>
          <ul className={s.achs}>
            {list.map((a) => {
              const on = unlocked.has(a.id);
              return (
                <li key={a.id} className={on ? s.achOn : s.achOff}>
                  <span className={s.achIcon} aria-hidden="true">
                    {on ? a.icon : '🔒'}
                  </span>
                  <span className={s.achText}>
                    <b>{a.label}</b>
                    <small>{a.desc}</small>
                  </span>
                  <span className={s.xp}>{on ? <Badge tone="up">{t('ms.earned')}</Badge> : `+${a.xp}`}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Card>
  );
}

function RecentXp({ uid }: { uid: string }) {
  const hist = useXpHistory(uid);
  const now = useNow();
  return (
    <Card flush title={t('ms.recent')}>
      {hist.status === 'loading' ? (
        <LoadingState rows={3} />
      ) : hist.status === 'ready' && hist.data.length ? (
        <ul className={s.hist}>
          {hist.data.map((e) => (
            <li key={e.id}>
              <span>{e.label}</span>
              <small>{e.at ? formatRelative(e.at, now) : ''}</small>
              <b className={s.xp}>+{e.xp}</b>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="missions" body={t('ms.recent.none')} compact />
      )}
    </Card>
  );
}

function InviteCard({ uid }: { uid: string }) {
  const n = useReferralCount(uid);
  const tier = n != null ? referralTier(n) : null;
  const next = n != null ? nextTier(n) : null;
  return (
    <Card pad className={s.invite}>
      <h2 className={s.cardTitle}>{t('ms.invite')}</h2>
      <p className={s.muted}>{t('ms.invite.body')}</p>
      <p>
        {n == null ? '…' : t('ms.invite.count', { n })}
        {tier && (
          <>
            {' · '}
            <b>
              {tier.icon} {t('ms.invite.tier', { name: tier.name })}
            </b>
          </>
        )}
        {next && n != null && ` · ${t('ms.invite.next', { n: next.at - n, name: next.name })}`}
      </p>
      <div className={s.row}>
        <Link className={buttonClass({ variant: 'primary', size: 'sm' })} to="/invite">
          {t('ms.invite.go')}
        </Link>
        <Link className={buttonClass({ variant: 'ghost', size: 'sm' })} to="/social">
          {t('nav.social')}
        </Link>
        <Link className={buttonClass({ variant: 'ghost', size: 'sm' })} to="/leaderboard">
          {t('nav.leaderboard')}
        </Link>
      </div>
    </Card>
  );
}
