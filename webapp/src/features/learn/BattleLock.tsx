/**
 * Battles open once Trading 101 Chapter 1's quiz is passed (owner 2026-10-21). The server
 * enforces it (tw_create, tw_join, tw_challenge, tw_respond and battle invites check
 * users.learnPassed.basics); this card explains it where a battle would start, and sends the
 * player to the lessons or straight to the quiz, then back (`next`).
 */
import { Link } from 'react-router';
import { t } from '../../lib/i18n';
import { buttonClass, Card } from '../../ui';
import { useSkill } from './useSkill';
import s from './Learn.module.css';

export const BATTLE_CHAPTER = 'basics';

/** open: Chapter 1 passed; loaded: your account has been read (don't flash the lock before) */
export function useBattlesOpen(): { open: boolean; loaded: boolean } {
  const { learnPassed, loaded } = useSkill();
  return { open: !!learnPassed[BATTLE_CHAPTER], loaded };
}

/** next: an in-app path to come back to after passing the quiz (an invite, a profile) */
export function BattleLock({ next, flat }: { next?: string; flat?: boolean }) {
  const back = next && next.startsWith('/') && !next.startsWith('//') ? `?next=${encodeURIComponent(next)}` : '';
  const body = (
    <div className={s.lock} role="note">
      <span className={s.lockIcon} aria-hidden="true">
        🔒
      </span>
      <b>{t('lock.title')}</b>
      <p className={s.muted}>{t('lock.body')}</p>
      <div className={s.lessonActions}>
        <Link className={buttonClass({ variant: 'primary' })} to="/learn">
          {t('lock.lessons')}
        </Link>
        <Link className={buttonClass({ variant: 'secondary' })} to={`/learn/${BATTLE_CHAPTER}/quiz${back}`}>
          {t('lock.testOut')}
        </Link>
      </div>
    </div>
  );
  return flat ? body : <Card pad>{body}</Card>;
}
