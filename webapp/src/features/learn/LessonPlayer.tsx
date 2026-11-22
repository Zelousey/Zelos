/**
 * One Trading 101 lesson (/learn/:chapter/:lesson): a few animated scenes, one quick check,
 * then a finish screen. Finishing ticks the lesson on your account (users/{uid}.learnDone)
 * and asks the server for its 10 XP (paid once). Signed out, you can still take every
 * lesson; the finish screen asks you to sign in to keep your progress.
 *
 * Your step is kept in the address (?step=), so leaving for a chart and coming back (or the back
 * button) returns to the same step; a "Back to your lesson" button on other screens (LearnReturn)
 * takes you there too.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { Button, buttonClass, EmptyState, useToast } from '../../ui';
import { chapterById, chapterState, lessonChecks, LESSON_XP, lessonOpen, lessonXp, markLesson, rightAnswer, type Answer } from './chapters';
import { CheckView } from './CheckView';
import { noteLearnPlace } from './learnReturn';
import { learnCheck } from './loop';
import { Scene } from './Scene';
import { useSkill } from './useSkill';
import s from './Learn.module.css';

export function LessonPlayer() {
  const { chapter = '', lesson: lessonId = '' } = useParams();
  const c = chapterById(chapter);
  const idx = c ? c.lessons.findIndex((l) => l.id === lessonId) : -1;
  const { isReal } = useAuth();
  const { learnDone, learnPassed, loaded } = useSkill();
  if (!c || idx < 0) return <EmptyState icon="learn" title={t('ln.missing')} actions={<Link to="/learn">{t('ln.back')}</Link>} />;
  const st = chapterState(c, learnDone, learnPassed);
  if (isReal && loaded && (!st.unlocked || !lessonOpen(c, idx, learnDone, st.passed))) {
    return <EmptyState icon="learn" title={t('ln.lessonLocked')} body={t('ln.lessonLockedBody')} actions={<Link className={buttonClass({ variant: 'primary' })} to="/learn">{t('ln.back')}</Link>} />;
  }
  return <Player key={`${c.id}/${lessonId}`} chapterId={c.id} idx={idx} />;
}

function Player({ chapterId, idx }: { chapterId: string; idx: number }) {
  const c = chapterById(chapterId)!;
  const lesson = c.lessons[idx]!;
  const after = c.lessons[idx + 1] ?? null;
  const { user, isReal, openSignIn } = useAuth();
  const { learnDone } = useSkill();
  const toast = useToast();
  const checks = lessonChecks(lesson);
  const total = lesson.steps.length + checks.length; // the scenes, then the quick check(s)
  const [params, setParams] = useSearchParams();
  const [at, setAt] = useState(() => {
    const n = Number(params.get('step'));
    return Number.isInteger(n) && n > 0 && n < total ? n : 0; // never straight to the finish (no XP from a link)
  });
  const [answers, setAnswers] = useState<(Answer | null)[]>(() => checks.map(() => null));
  const [xpState, setEarned] = useState<'pending' | 'xp' | 'already' | 'none'>('pending');
  const earned = isReal && user ? xpState : 'none'; // signed out: nothing to save
  const finished = at === total;
  const headRef = useRef<HTMLHeadingElement>(null);
  const wasDone = useRef(learnDone.includes(lesson.id));

  // remember the step: in the address (back button, reload) and for the "Back to your lesson" button
  useEffect(() => {
    const step = Math.min(at, total - 1);
    setParams(step > 0 ? { step: String(step) } : {}, { replace: true });
    noteLearnPlace(`/learn/${c.id}/${lesson.id}${step > 0 ? `?step=${step}` : ''}`, t('ln.return.where', { title: lesson.title, n: step + 1, total }));
  }, [at, total, c.id, lesson.id, lesson.title, setParams]);

  // move focus to each new step's heading, so screen readers hear it and keyboard users start there
  useEffect(() => {
    if (at > 0) headRef.current?.focus();
  }, [at]);

  // finishing: tick the lesson and ask the server for its XP (once)
  const saved = useRef(false);
  useEffect(() => {
    if (!finished || saved.current) return;
    if (!isReal || !user) return;
    saved.current = true;
    void markLesson(user.uid, lesson.id).catch(() => toast.show(t('qz.failed'), 'error'));
    lessonXp(lesson.id)
      .then((r) => setEarned(r.awarded ? 'xp' : 'already'))
      .catch(() => setEarned(wasDone.current ? 'already' : 'none'));
  }, [finished, isReal, user, lesson.id, toast]);

  const step = !finished && at < lesson.steps.length ? lesson.steps[at]! : null;
  const ci = !finished && !step ? at - lesson.steps.length : -1;
  const check = ci >= 0 ? checks[ci]! : null;
  const picked = ci >= 0 ? answers[ci]! : null;
  // the server grades the quick check too: a miss comes back later for review (learning loop)
  const answer = (a: Answer) => {
    setAnswers((xs) => xs.map((x, k) => (k === ci ? a : x)));
    if (isReal && user) void learnCheck(lesson.id, a, ci + 1).catch(() => undefined);
  };

  return (
    <div className={s.player}>
      <div className={s.playerTop}>
        <Link to={`/learn/${c.id}`} className={s.close} aria-label={t('ln.closeLesson')}>
          ×
        </Link>
        <div className={s.pathBar} role="progressbar" aria-label={t('ln.lessonProgress')} aria-valuemin={0} aria-valuemax={total} aria-valuenow={at}>
          <i style={{ width: `${(at / total) * 100}%` }} />
        </div>
        <span className={s.stepCount} aria-hidden="true">
          {Math.min(at + 1, total)}/{total}
        </span>
      </div>
      <p className={s.kicker}>
        {t('ln.chapter', { n: c.n })} · {t('ln.lessonN', { n: idx + 1 })} · {lesson.title}
      </p>

      {!check && (
        <div className={s.stage} key={at}>
          <Scene art={finished ? { k: 'done', label: t('ln.lessonDoneArt', { n: idx + 1 }) } : step!.art} />
        </div>
      )}

      {step && (
        <div className={s.say} aria-live="polite">
          <h2 ref={headRef} tabIndex={-1}>
            {step.title}
          </h2>
          <p>{step.text}</p>
          {step.tip && <p className={s.tip}>{step.tip}</p>}
        </div>
      )}
      {check && (
        <CheckView
          key={at}
          check={check}
          answer={picked}
          right={picked == null ? null : rightAnswer(check)}
          onAnswer={answer}
          headRef={headRef}
          kicker={checks.length > 1 ? t('ck.n', { n: ci + 1, of: checks.length }) : undefined}
        />
      )}
      <div className={s.say}>
        {finished && (
          <div className={s.finish}>
            <h2 ref={headRef} tabIndex={-1}>
              {t('ln.lessonDone')}
            </h2>
            {earned === 'xp' && (
              <p className={s.xp} aria-label={t('ln.xpEarned', { xp: LESSON_XP })}>
                +{LESSON_XP} XP
              </p>
            )}
            {earned === 'already' && <p className={s.muted}>{t('ln.xpAlready')}</p>}
            {earned === 'none' && !isReal && (
              <p className={s.muted}>
                {t('ln.signInToEarn')}{' '}
                <button type="button" className={s.inlineBtn} onClick={() => void openSignIn().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>
                  {t('auth.signIn')}
                </button>
              </p>
            )}
            <Link className={buttonClass({ variant: 'secondary', block: true })} to={lesson.tryIt.to}>
              {lesson.tryIt.label}
            </Link>
          </div>
        )}
      </div>

      {finished ? (
        after ? (
          <Link className={buttonClass({ variant: 'primary', size: 'lg', block: true })} to={`/learn/${c.id}/${after.id}`}>
            {t('ln.nextLesson', { title: after.title })}
          </Link>
        ) : (
          <Link className={buttonClass({ variant: 'primary', size: 'lg', block: true })} to={`/learn/${c.id}/quiz`}>
            {t('ln.takeChapterQuiz')}
          </Link>
        )
      ) : (
        <Button variant="primary" size="lg" block disabled={!!check && picked == null} onClick={() => setAt((a) => a + 1)}>
          {check && picked == null ? t('ln.pickAnswer') : t('ln.continue')}
        </Button>
      )}
    </div>
  );
}
