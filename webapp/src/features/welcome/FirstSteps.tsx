/**
 * First steps (Dashboard): what a new player does first, with the website's XP for each step.
 * Hidden once every required step is done, or with Hide (shared with the website's checklist).
 */
import { useState } from 'react';
import { Link } from 'react-router';
import type { UserDoc } from '../../data/userDoc';
import { t, type MessageKey } from '../../lib/i18n';
import { Card } from '../../ui';
import { useAsStudent } from '../coach/coach';
import { DONE_KEY, firstSteps, HIDE_KEY, lsGet, lsSet } from './welcome';
import s from './Welcome.module.css';

export function FirstSteps({ uid, me, hasUsername, hasAccount }: { uid: string; me: UserDoc; hasUsername: boolean; hasAccount: boolean }) {
  const [hidden, setHidden] = useState(() => lsGet(HIDE_KEY) === '1' || lsGet(DONE_KEY) === '1');
  const coach = useAsStudent(me.experience === 'new' && !hidden ? uid : null);
  const hasCoach = coach.status === 'ready' && coach.data.length > 0;
  const steps = firstSteps({ onboard: me.onboard, hasUsername, hasAccount, experience: me.experience, hasCoach });
  const required = steps.filter((x) => !x.optional);
  const done = required.filter((x) => x.done).length;
  if (hidden || done === required.length) return null;
  const hide = () => {
    lsSet(HIDE_KEY, '1');
    setHidden(true);
  };
  return (
    <Card
      className={s.steps}
      title={t('fs.title')}
      subtitle={t('fs.progress', { done, of: required.length })}
      flush
      actions={
        <button type="button" className={s.hide} onClick={hide}>
          {t('fs.hide')}
        </button>
      }
    >
      <div className={s.bar} role="progressbar" aria-label={t('fs.title')} aria-valuemin={0} aria-valuemax={required.length} aria-valuenow={done}>
        <i style={{ width: `${(done / required.length) * 100}%` }} />
      </div>
      <ul className={s.list}>
        {steps.map((x) => {
          const inner = (
            <>
              <span className={s.check} aria-hidden="true">
                {x.done ? '✓' : ''}
              </span>
              <span>
                <span className={s.label}>{t(`fs.${x.id}` as MessageKey)}</span>
                {x.id === 'invite' && !x.done && <small>{t('fs.invite.xp')}</small>}
                {x.optional && <small>{t('fs.optional')}</small>}
              </span>
              <span className={s.xp}>{x.xp && x.id !== 'invite' ? `+${x.xp} XP` : ''}</span>
            </>
          );
          return (
            <li key={x.id} className={x.done ? s.done : undefined}>
              {x.done ? (
                <span className={s.row}>{inner}</span>
              ) : (
                <Link to={x.to} className={s.row}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
