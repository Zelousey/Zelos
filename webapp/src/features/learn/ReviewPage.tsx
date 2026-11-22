/**
 * Review (/learn/review, 2026-11-22): the questions you missed, back on schedule (1, 3, 7, 14,
 * 30 days; a wrong answer starts one over). Always free. Each answer is graded by the server
 * (learn_review), which moves the question along and pays a little XP for a right one.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { Button, buttonClass, EmptyState, LoadingState, useToast } from '../../ui';
import type { Answer } from './chapters';
import { CheckView } from './CheckView';
import { dueIds, learnReview, reviewQuestion, today, type ReviewResult } from './loop';
import { useSkill } from './useSkill';
import s from './Learn.module.css';
import l from './Loop.module.css';

export function ReviewPage() {
  const { isReal, openSignIn } = useAuth();
  const { review, loaded } = useSkill();
  // the session's questions are fixed once your account has loaded, so answering doesn't reshuffle them
  const [ids, setIds] = useState<string[] | null>(null);
  if (loaded && ids === null) setIds(dueIds(review, today()).slice(0, 10));
  if (!isReal)
    return <EmptyState icon="learn" title={t('rv.title')} body={t('rv.signIn')} actions={<Button onClick={() => void openSignIn()}>{t('auth.signIn')}</Button>} />;
  if (!loaded || ids === null) return <LoadingState rows={4} />;
  if (!ids.length)
    return (
      <EmptyState
        icon="check"
        title={t('rv.noneTitle')}
        body={t('rv.noneBody')}
        actions={
          <Link className={buttonClass({ variant: 'primary' })} to="/learn">
            {t('ln.back')}
          </Link>
        }
      />
    );
  return <Session ids={ids} />;
}

function Session({ ids }: { ids: string[] }) {
  const toast = useToast();
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<Answer | null>(null);
  const [res, setRes] = useState<ReviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState({ right: 0, xp: 0 });
  const done = at >= ids.length;
  const q = done ? null : reviewQuestion(ids[at]!);

  const choose = (i: Answer) => {
    if (picked != null || busy || !q) return;
    setPicked(i);
    setBusy(true);
    learnReview(q.id, i)
      .then((r) => {
        setRes(r);
        setScore((x) => ({ right: x.right + (r.ok ? 1 : 0), xp: x.xp + r.xp }));
      })
      .catch(() => {
        setPicked(null);
        toast.show(t('rv.failed'), 'error');
      })
      .finally(() => setBusy(false));
  };
  const next = () => {
    setAt((a) => a + 1);
    setPicked(null);
    setRes(null);
  };

  if (done)
    return (
      <div className={s.player}>
        <div className={s.say}>
          <span className={s.kicker}>{t('rv.title')}</span>
          <h2>{t('rv.doneTitle')}</h2>
          <p>{t('rv.doneBody', { right: score.right, n: ids.length })}</p>
          {score.xp > 0 && <p className={s.xp}>+{score.xp} XP</p>}
          <p className={s.muted}>{t('rv.doneNote')}</p>
        </div>
        <Link className={buttonClass({ variant: 'primary', size: 'lg', block: true })} to="/learn">
          {t('ln.back')}
        </Link>
      </div>
    );
  if (!q) {
    // a question that no longer exists in the app: skip it
    return (
      <div className={s.player}>
        <Button variant="primary" block onClick={next}>
          {t('ln.continue')}
        </Button>
      </div>
    );
  }
  return (
    <div className={s.player}>
      <div className={s.playerTop}>
        <Link to="/learn" className={s.close} aria-label={t('rv.close')}>
          ×
        </Link>
        <div className={s.pathBar} role="progressbar" aria-label={t('rv.progress')} aria-valuemin={0} aria-valuemax={ids.length} aria-valuenow={at}>
          <i style={{ width: `${(at / ids.length) * 100}%` }} />
        </div>
        <span className={s.stepCount} aria-hidden="true">
          {at + 1}/{ids.length}
        </span>
      </div>
      <CheckView
        key={q.id}
        check={q.check}
        answer={res ? picked : null}
        right={res ? res.answer : null}
        onAnswer={choose}
        busy={busy}
        kicker={`${t('rv.title')} · ${t('rv.free')} · ${q.from}`}
      />
      {res && <p className={l.when}>{res.ok ? (res.due ? t('rv.nextOn', { day: shortDay(res.due) }) : t('rv.mastered')) : t('rv.tomorrow')}</p>}
      <Button variant="primary" size="lg" block disabled={!res} onClick={next}>
        {res ? t('ln.continue') : t('ln.pickAnswer')}
      </Button>
    </div>
  );
}

const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
