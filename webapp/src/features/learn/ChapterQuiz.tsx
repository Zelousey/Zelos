/**
 * A chapter's quiz (/learn/:chapter/quiz). Answer every question, then the server grades it
 * (learn_quiz): pass and the chapter is done, the next one opens, and the chapter's XP is paid
 * once. Anyone can take it straight away to test out. Results show the right answer for every
 * question, with why. Answers so far are kept while you look at something else (this tab), and a
 * "Back to your quiz" button on other screens brings you back (learnReturn.ts).
 */
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { Badge, Button, buttonClass, Card, EmptyState, PageHeader, useToast } from '../../ui';
import { useNow } from '../../lib/useNow';
import { errorText } from '../invites/invites';
import { CHAPTER_XP, CHAPTERS, chapterById, chapterState, gradeQuiz, RETAKE_COST, retakeAt, type QuizResult } from './chapters';
import { noteLearnPlace, readQuizDraft, writeQuizDraft } from './learnReturn';
import { useSkill } from './useSkill';
import s from './Learn.module.css';

export function ChapterQuiz() {
  const { chapter = '' } = useParams();
  const c = chapterById(chapter);
  // ?next=/i/CODE: came from a locked battle (BattleLock); go back there once passed
  const nextRaw = useSearchParams()[0].get('next') ?? '';
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : null;
  const { isReal, openSignIn } = useAuth();
  const { learnDone, learnPassed, learnFailed, loaded } = useSkill();
  const now = useNow(30_000);
  const toast = useToast();
  const [answers, setAnswers] = useState<(number | null)[]>(() => (c ? (readQuizDraft(c.id, c.quiz.length) ?? c.quiz.map(() => null)) : []));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [payNow, setPayNow] = useState(false); // chose to retake within the 12-hour wait for tokens
  // keep the answers and the way back while the quiz is open; drop them once it's graded
  useEffect(() => {
    if (!c) return;
    if (result) {
      writeQuizDraft(c.id, null);
      return;
    }
    if (answers.some((a) => a != null)) writeQuizDraft(c.id, answers);
    noteLearnPlace(`/learn/${c.id}/quiz${next ? `?next=${encodeURIComponent(next)}` : ''}`, t('ln.return.quiz', { n: c.n }));
  }, [c, answers, result, next]);
  if (!c) return <EmptyState icon="learn" title={t('ln.missing')} actions={<Link to="/learn">{t('ln.back')}</Link>} />;
  // chapters go in order: no Chapter 2 quiz before Chapter 1 is passed (the server checks too)
  if (isReal && loaded && !chapterState(c, learnDone, learnPassed).unlocked) {
    return <EmptyState icon="learn" title={t('ln.quizLocked', { n: c.n - 1 })} body={t('ln.chapterLocked', { n: c.n - 1 })} actions={<Link className={buttonClass({ variant: 'primary' })} to="/learn">{t('ln.back')}</Link>} />;
  }
  const nextChapter = CHAPTERS[CHAPTERS.indexOf(c) + 1] ?? null;
  const all = answers.every((a) => a != null);
  // after a fail the next try is free 12 hours later, or RETAKE_COST tokens now (the server decides)
  const waitUntil = isReal ? retakeAt(c.id, learnFailed, learnPassed, now) : null;
  const locked = !!waitUntil && !payNow && !result;

  async function submit() {
    setBusy(true);
    try {
      const r = await gradeQuiz(c!.id, answers.map((a) => a ?? -1), payNow && !!waitUntil);
      setResult(r);
      setPayNow(false);
      if (r.charged) toast.show(t('ln.retakePaid', { n: r.charged }));
      window.scrollTo?.({ top: 0 });
    } catch (e) {
      toast.show(errorText(e, t('qz.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t('ln.quizTitle', { n: c.n, title: c.title })} subtitle={t('ln.quizSub', { need: c.pass, of: c.quiz.length, xp: CHAPTER_XP })} />
      <div className={s.narrow}>
        {result && (
          <Card pad>
            <div className={s.result} role="status">
              <p className={s.resultTitle}>{result.passed ? t('ln.quizPass') : t('ln.quizFail')}</p>
              <p className={s.muted}>{t('ln.quizScore', { right: result.right, total: result.total, need: result.need })}</p>
              {result.passed && result.xp > 0 && <p className={s.xp}>+{result.xp} XP</p>}
              {result.passed && result.xp === 0 && <Badge tone="up">{t('ln.passed')}</Badge>}
              <div className={s.lessonActions}>
                {result.passed ? (
                  next ? (
                    <Link className={buttonClass({ variant: 'primary' })} to={next}>
                      {t('ln.backToNext')}
                    </Link>
                  ) : (
                    <Link className={buttonClass({ variant: 'primary' })} to="/learn">
                      {nextChapter ? t('ln.toNextChapter') : t('ln.back')}
                    </Link>
                  )
                ) : (
                  <>
                    <Button
                      variant="primary"
                      onClick={() => {
                        setResult(null);
                        setAnswers(c.quiz.map(() => null));
                      }}
                    >
                      {t('ln.tryAgain')}
                    </Button>
                    <Link className={buttonClass({ variant: 'secondary' })} to="/learn">
                      {t('ln.reviewLessons')}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </Card>
        )}
        {locked && (
          <Card pad>
            <div className={s.result} role="status">
              <p className={s.resultTitle}>{t('ln.retakeWait', { t: waitLeft(waitUntil! - now) })}</p>
              <p className={s.muted}>{t('ln.retakeWhy')}</p>
              <div className={s.lessonActions}>
                <Button variant="primary" onClick={() => setPayNow(true)}>
                  {t('ln.retakeNow', { n: RETAKE_COST })}
                </Button>
                <Link className={buttonClass({ variant: 'secondary' })} to={`/learn`}>
                  {t('ln.reviewLessons')}
                </Link>
              </div>
            </div>
          </Card>
        )}
        {payNow && waitUntil && !result && <p className={s.muted}>{t('ln.retakeNote', { n: RETAKE_COST })}</p>}
        {!isReal && (
          <Card pad>
            <div className={s.levelRow}>
              <span className={s.muted}>{t('ln.quizSignIn')}</span>
              <Button variant="primary" size="sm" onClick={() => void openSignIn().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>
                {t('auth.signIn')}
              </Button>
            </div>
          </Card>
        )}
        <ol className={s.quizList}>
          {c.quiz.map((q, qi) => {
            const r = result?.results[qi];
            return (
              <li key={qi}>
                <fieldset className={s.question} disabled={!!result || locked}>
                  <legend className={s.qTitle}>
                    {qi + 1}. {q.q}
                  </legend>
                  {q.opts.map((o, oi) => {
                    const on = answers[qi] === oi;
                    const cls = r ? (oi === r.answer ? s.answerRight : on ? s.answerWrong : '') : on ? s.answerOn : '';
                    return (
                      <label key={oi} className={[s.answer, cls].join(' ')}>
                        <input type="radio" name={`q${qi}`} checked={on} onChange={() => setAnswers((a) => a.map((x, i) => (i === qi ? oi : x)))} />
                        <span>{o}</span>
                        {r && oi === r.answer && <span className={s.mark}>✓</span>}
                      </label>
                    );
                  })}
                  {r && (
                    <p className={s.explain}>
                      <b>{r.ok ? t('ln.right') : t('ln.notQuite')}</b> {q.why}
                    </p>
                  )}
                </fieldset>
              </li>
            );
          })}
        </ol>
        {!result && (
          <Button variant="primary" size="lg" block disabled={!all || busy || !isReal || locked} onClick={() => void submit()}>
            {all ? t('ln.checkAnswers') : t('ln.answerAll', { n: answers.filter((a) => a == null).length })}
          </Button>
        )}
      </div>
    </>
  );
}

/** "11h 40m" / "25m" until a free retake. */
function waitLeft(ms: number): string {
  const mins = Math.max(1, Math.ceil(ms / 60_000));
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}
