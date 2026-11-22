/**
 * Your learning (top of /learn, 2026-11-22): the learning streak, today's goal, questions due
 * for review (always free) and your place in this week's learning league. Learning only:
 * nothing here counts trades or profits.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { buttonClass, Icon, Sheet, useToast } from '../../ui';
import { dueIds, GOALS, loopView, setGoal, today as nyToday, useLeague, weekId } from './loop';
import { useSkill } from './useSkill';
import s from './Loop.module.css';

export function LoopCard() {
  const { user } = useAuth();
  const toast = useToast();
  const { learnLoop, review, learnGoal } = useSkill();
  const day = nyToday(useNow(60_000));
  const v = loopView(learnLoop, day);
  const due = dueIds(review, day).length;
  const queued = Object.keys(review).length;
  const league = useLeague(weekId(day));
  const rows = league.status === 'ready' ? league.data : [];
  const mine = user ? rows.findIndex((r) => r.uid === user.uid) : -1;
  const [picking, setPicking] = useState(false);
  const pct = Math.min(1, v.today / learnGoal);
  const met = v.today >= learnGoal;

  const pick = (g: number) => {
    setPicking(false);
    if (user && g !== learnGoal) void setGoal(user.uid, g).catch(() => toast.show(t('lp.goalFailed'), 'error'));
  };

  return (
    <section className={s.card} aria-label={t('lp.title')}>
      <div className={s.tiles}>
        <div className={s.tile}>
          <span className={s.kicker}>{t('lp.streak')}</span>
          <span className={[s.big, v.streak ? s.lit : ''].join(' ')}>
            <Icon name="flame" size={22} />
            {t(v.streak === 1 ? 'lp.day' : 'lp.days', { n: v.streak })}
          </span>
          <span className={s.sub}>{v.streak ? t(v.best === 1 ? 'lp.best1' : 'lp.best', { n: v.best }) : t('lp.startStreak')}</span>
        </div>
        <div className={s.tile}>
          <span className={s.kicker}>{t('lp.goal')}</span>
          <span className={s.goalRow}>
            <svg className={s.ring} viewBox="0 0 36 36" aria-hidden="true">
              <circle cx="18" cy="18" r="15" className={s.ringBack} />
              <circle cx="18" cy="18" r="15" className={[s.ringFill, met ? s.ringMet : ''].join(' ')} strokeDasharray={`${pct * 94.25} 94.25`} />
            </svg>
            <span className={s.big} aria-label={t('lp.goalLabel', { n: v.today, goal: learnGoal })}>
              {v.today}
              <small>/{learnGoal} XP</small>
            </span>
          </span>
          <button type="button" className={s.link} onClick={() => setPicking(true)}>
            {met ? t('lp.goalMet') : t('lp.changeGoal')}
          </button>
        </div>
        <div className={s.tile}>
          <span className={s.kicker}>{t('lp.review')}</span>
          <span className={s.big}>{due}</span>
          <span className={s.sub}>{due ? t('lp.dueFree') : queued ? t('lp.nothingDue', { n: queued }) : t('lp.noMisses')}</span>
          {due > 0 && (
            <Link className={buttonClass({ variant: 'primary', size: 'sm' })} to="/learn/review">
              {t('lp.reviewNow')}
            </Link>
          )}
        </div>
      </div>
      <Link to="/learn/league" className={s.league}>
        <Icon name="trophy" size={18} />
        <span>
          <b>{t('lp.league')}</b>{' '}
          {mine >= 0 ? t('lp.yourPlace', { n: mine + 1, xp: rows[mine]!.xp }) : v.week ? t('lp.weekXp', { xp: v.week }) : t('lp.joinLeague')}
        </span>
        <Icon name="chevronRight" size={16} />
      </Link>
      <Sheet open={picking} onClose={() => setPicking(false)} title={t('lp.pickGoal')}>
        <div className={s.goals}>
          <p className={s.sub}>{t('lp.pickGoalSub')}</p>
          {GOALS.map((g) => (
            <button key={g} type="button" className={[s.goal, g === learnGoal ? s.goalOn : ''].join(' ')} aria-pressed={g === learnGoal} onClick={() => pick(g)}>
              <b>{t(`lp.goal${g}` as 'lp.goal10')}</b>
              <span>{t('lp.goalXp', { n: g })}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </section>
  );
}
