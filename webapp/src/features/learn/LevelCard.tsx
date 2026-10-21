/**
 * Dashboard card: invites people who haven't taken the quiz to find their level ("Not now"
 * hides it on this device), and shows beginners their next steps until they've done the
 * Trading 101 lessons.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import type { UserDoc } from '../../data/userDoc';
import { t } from '../../lib/i18n';
import { readString, writeString } from '../../lib/storage';
import { Button, buttonClass, Card } from '../../ui';
import { ALL_LESSONS } from './chapters';
import { NextSteps } from './NextSteps';
import { levelFromExperience } from './quiz';
import s from './Learn.module.css';

const LATER_KEY = 'zelosQuizLater';

export function LevelCard({ me }: { me: UserDoc }) {
  const [later, setLater] = useState(() => readString(LATER_KEY) === '1');
  const level = me.skill?.level ?? levelFromExperience(me.experience);
  const lessonsLeft = ALL_LESSONS.some((l) => !me.learnDone.includes(l.id));
  if (!me.skill && !later)
    return (
      <Card pad aria-label={t('qz.cardTitle')}>
        <div className={s.result}>
          <b>{t('qz.cardTitle')}</b>
          <p className={s.muted}>{t('qz.cardBody')}</p>
          <div className={s.lessonActions}>
            <Link className={buttonClass({ variant: 'primary', size: 'sm' })} to="/quiz">
              {t('qz.cardGo')}
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                writeString(LATER_KEY, '1');
                setLater(true);
              }}
            >
              {t('qz.cardLater')}
            </Button>
          </div>
        </div>
      </Card>
    );
  if (level === 'beginner' && lessonsLeft)
    return (
      <Card pad title={t('ns.title')} aria-label={t('ns.title')}>
        <NextSteps level="beginner" />
      </Card>
    );
  return null;
}
