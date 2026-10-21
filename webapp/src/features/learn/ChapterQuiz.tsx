/**
 * A chapter's quiz (/learn/:chapter/quiz). Answer every question, then the server grades it
 * (learn_quiz): pass and the chapter is done, the next one opens, and the chapter's XP is paid
 * once. Anyone can take it straight away to test out. Results show the right answer for every
 * question, with why.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { Badge, Button, buttonClass, Card, EmptyState, PageHeader, useToast } from '../../ui';
import { CHAPTER_XP, CHAPTERS, chapterById, gradeQuiz, type QuizResult } from './chapters';
import s from './Learn.module.css';

export function ChapterQuiz() {
  const { chapter = '' } = useParams();
  const c = chapterById(chapter);
  const { isReal, openSignIn } = useAuth();
  const toast = useToast();
  const [answers, setAnswers] = useState<(number | null)[]>(() => (c ? c.quiz.map(() => null) : []));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  if (!c) return <EmptyState icon="learn" title={t('ln.missing')} actions={<Link to="/learn">{t('ln.back')}</Link>} />;
  const nextChapter = CHAPTERS[CHAPTERS.indexOf(c) + 1] ?? null;
  const all = answers.every((a) => a != null);

  async function submit() {
    setBusy(true);
    try {
      setResult(await gradeQuiz(c!.id, answers.map((a) => a ?? -1)));
      window.scrollTo?.({ top: 0 });
    } catch {
      toast.show(t('qz.failed'), 'error');
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
                  <Link className={buttonClass({ variant: 'primary' })} to="/learn">
                    {nextChapter ? t('ln.toNextChapter') : t('ln.back')}
                  </Link>
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
                <fieldset className={s.question} disabled={!!result}>
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
          <Button variant="primary" size="lg" block disabled={!all || busy || !isReal} onClick={() => void submit()}>
            {all ? t('ln.checkAnswers') : t('ln.answerAll', { n: answers.filter((a) => a == null).length })}
          </Button>
        )}
      </div>
    </>
  );
}
