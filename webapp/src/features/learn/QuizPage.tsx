/** /quiz: the new-user quiz on its own (from the dashboard card, an invite, or the profile), then your next steps. */
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { Button, buttonClass, Card, EmptyState, LoadingState } from '../../ui';
import { NextSteps } from './NextSteps';
import { Quiz, levelLabel } from './Quiz';
import type { Skill } from './quiz';
import s from './Learn.module.css';

/** Only in-app paths are followed after the quiz. */
const safeNext = (v: string | null) => (v && /^\/[A-Za-z0-9/_-]{0,80}$/.test(v) ? v : null);

export default function QuizPage() {
  const { user, isReal, ready, openSignIn } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const [done, setDone] = useState<Skill | null>(null);
  if (!ready) return <LoadingState rows={4} />;
  if (!isReal || !user)
    return <EmptyState icon="learn" body={t('qz.signIn')} actions={<Button variant="primary" onClick={() => void openSignIn()}>{t('auth.signIn')}</Button>} />;
  return (
    <div className={s.narrow}>
      {done ? (
        <Card pad>
          <div className={s.result}>
            <span className={s.kicker}>{t('qz.yourLevel')}</span>
            <h1 className={s.resultTitle}>{levelLabel(done.level)}</h1>
            <p className={s.muted}>{t(`qz.result.${done.level}`)}</p>
            <p className={s.muted}>{t('qz.score', { n: done.right, of: 3 })}</p>
            <NextSteps level={done.level} />
            {next && (
              <Link className={buttonClass({ variant: 'primary', size: 'lg', block: true })} to={next}>
                {t('qz.continue')}
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <Card pad>
          <h1 className={s.pageTitle}>{t('qz.title')}</h1>
          <p className={s.muted}>{t('qz.sub')}</p>
          <Quiz uid={user.uid} onDone={setDone} onSkip={() => navigate(next ?? '/dashboard')} />
        </Card>
      )}
    </div>
  );
}
