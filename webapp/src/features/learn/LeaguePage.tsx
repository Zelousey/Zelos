/**
 * This week's learning league (/learn/league, 2026-11-22): everyone ranked by the XP they earned
 * learning this week (lessons, chapter quizzes, Hall of Minds, review). Trading doesn't count.
 * Resets every Monday, New York time.
 */
import { Link } from 'react-router';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from '../../ui';
import { loopView, today as nyToday, useLeague, weekId } from './loop';
import { useSkill } from './useSkill';
import s from './Loop.module.css';

export function LeaguePage() {
  const { user } = useAuth();
  const { learnLoop } = useSkill();
  const day = nyToday(useNow(60_000));
  const league = useLeague(weekId(day));
  const mine = loopView(learnLoop, day).week;
  return (
    <>
      <Link to="/learn" className={s.back}>
        ← {t('nav.learn')}
      </Link>
      <PageHeader title={t('lp.league')} subtitle={t('lg.sub')} keepOnPhone />
      <Card pad>
        {league.status === 'loading' ? (
          <LoadingState rows={6} />
        ) : league.status !== 'ready' ? (
          <ErrorState body={t('lg.failed')} />
        ) : !league.data.length ? (
          <EmptyState icon="trophy" body={t('lg.empty')} />
        ) : (
          <ol className={s.table} aria-label={t('lp.league')}>
            {league.data.map((r, i) => (
              <li key={r.uid} className={r.uid === user?.uid ? s.me : ''}>
                <span className={s.rank}>{i + 1}</span>
                <span className={s.name}>
                  {r.name}
                  {r.uid === user?.uid && <em> · {t('lg.you')}</em>}
                </span>
                <b>{r.xp} XP</b>
              </li>
            ))}
          </ol>
        )}
        {user && mine > 0 && league.status === 'ready' && !league.data.some((r) => r.uid === user.uid) && <p className={s.sub}>{t('lp.weekXp', { xp: mine })}</p>}
        <p className={s.fine}>{t('lg.note')}</p>
      </Card>
    </>
  );
}
