/**
 * Trading 101 (/learn): chapters of short animated lessons (chapters.ts), each chapter a path
 * you walk one lesson at a time, ending in a chapter quiz. Lessons pay 10 XP once, a passed
 * chapter quiz 50 XP once and unlocks the next chapter; anyone can test out with the quiz.
 *   /learn                        the chapters
 *   /learn/:chapter/:lesson       one lesson (LessonPlayer)
 *   /learn/:chapter/quiz          the chapter quiz (ChapterQuiz)
 *   /learn/:old                   the old one-page lessons → their new place
 */
import { Link, Navigate, useParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { Badge, buttonClass, Card, Icon, PageHeader, useToast } from '../../ui';
import { CHAPTER_XP, CHAPTERS, chapterState, LESSON_XP, lessonOpen, OLD_LESSON, type Chapter } from './chapters';
import { levelLabel } from './Quiz';
import { useSkill } from './useSkill';
import s from './Learn.module.css';

export function LearnPage() {
  const { isReal, openSignIn } = useAuth();
  const toast = useToast();
  const { level, quizTaken, learnDone, learnPassed } = useSkill();
  const lessons = CHAPTERS.flatMap((c) => c.lessons);
  const done = lessons.filter((l) => learnDone.includes(l.id)).length;
  const xp = done * LESSON_XP + CHAPTERS.filter((c) => learnPassed[c.id]).length * CHAPTER_XP;
  return (
    <>
      <PageHeader title={t('nav.learn')} subtitle={t('ln.sub')} />
      <div className={s.stack}>
        {isReal ? (
          <Card pad>
            <div className={s.levelRow}>
              <div>
                <span className={s.kicker}>{t('qz.yourLevel')}</span>
                <b className={s.levelName}>{level ? levelLabel(level) : t('ln.noLevel')}</b>
                <span className={s.muted}>{t('ln.progressXp', { n: done, of: lessons.length, xp })}</span>
              </div>
              <Link className={buttonClass({ variant: quizTaken ? 'ghost' : 'primary', size: 'sm' })} to="/quiz?next=/learn">
                {quizTaken ? t('ln.retake') : t('ln.takeQuiz')}
              </Link>
            </div>
          </Card>
        ) : (
          <Card pad>
            <div className={s.levelRow}>
              <span className={s.muted}>{t('ln.signInToSave')}</span>
              <button type="button" className={buttonClass({ variant: 'primary', size: 'sm' })} onClick={() => void openSignIn().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>
                {t('auth.signIn')}
              </button>
            </div>
          </Card>
        )}
        {CHAPTERS.map((c) => (
          <ChapterCard key={c.id} c={c} learnDone={learnDone} learnPassed={learnPassed} gated={isReal} />
        ))}
        <p className={s.fine}>{t('ln.fine')}</p>
      </div>
    </>
  );
}

/** gated: signed in, lessons open one at a time; signed out there's no progress to go by, so all are open */
function ChapterCard({ c, learnDone, learnPassed, gated }: { c: Chapter; learnDone: string[]; learnPassed: Record<string, number>; gated: boolean }) {
  const st = chapterState(c, learnDone, learnPassed);
  const titleId = `ch-${c.id}`;
  return (
    <section className={s.chapter} aria-labelledby={titleId}>
      <div className={s.chapterHead}>
        <span className={s.kicker}>{t('ln.chapter', { n: c.n })}</span>
        <h2 id={titleId} className={s.chapterTitle}>
          {c.title}
        </h2>
        <p className={s.muted}>{c.sub}</p>
        <div className={s.pathBar} role="progressbar" aria-label={t('ln.chapterProgress', { title: c.title })} aria-valuemin={0} aria-valuemax={st.total} aria-valuenow={st.done}>
          <i style={{ width: `${(st.done / st.total) * 100}%` }} />
        </div>
        <div className={s.pathBarLbl}>
          <span>{t('ln.progress', { n: st.done, of: st.total })}</span>
          {st.passed && <Badge tone="up">{t('ln.passed')}</Badge>}
        </div>
      </div>
      {gated && !st.unlocked ? (
        <p className={s.locked}>{t('ln.chapterLocked', { n: c.n - 1 })}</p>
      ) : (
        <ol className={s.path}>
          {c.lessons.map((l, i) => {
            const isDone = learnDone.includes(l.id);
            const open = !gated || lessonOpen(c, i, learnDone, st.passed);
            const now = !isDone && open && st.next?.id === l.id;
            const state = isDone ? s.done : now ? s.now : open ? s.open : s.lockedStep;
            const inner = (
              <>
                <span className={s.dot} aria-hidden="true">
                  {isDone ? '✓' : i + 1}
                </span>
                <span className={s.stepBody}>
                  <b>{l.title}</b>
                  <span>
                    {l.sub} · {t('ln.minutes', { n: l.minutes })}
                    {!open && ` · ${t('ln.lockedShort')}`}
                  </span>
                  {now && <span className={[buttonClass({ variant: 'primary', size: 'sm' }), s.go].join(' ')}>{st.done === 0 ? t('ln.start') : t('ln.continue')}</span>}
                </span>
              </>
            );
            return (
              <li key={l.id} className={[s.step, state].join(' ')}>
                {open ? (
                  <Link to={`/learn/${c.id}/${l.id}`} className={s.stepLink} aria-label={`${t('ln.lessonN', { n: i + 1 })}: ${l.title}${isDone ? ` (${t('ln.done')})` : ''}`}>
                    {inner}
                  </Link>
                ) : (
                  <div className={s.stepLink}>{inner}</div>
                )}
              </li>
            );
          })}
          <li className={[s.step, st.passed ? s.done : st.complete ? s.now : s.open].join(' ')}>
            <Link to={`/learn/${c.id}/quiz`} className={s.stepLink}>
              <span className={[s.dot, s.quizDot].join(' ')} aria-hidden="true">
                {st.passed ? '✓' : '★'}
              </span>
              <span className={s.stepBody}>
                <b>{t('ln.chapterQuiz')}</b>
                <span>{st.passed ? t('ln.quizPassed') : st.complete ? t('ln.quizReady', { xp: CHAPTER_XP }) : t('ln.testOut', { xp: CHAPTER_XP })}</span>
                {!st.passed && st.complete && <span className={[buttonClass({ variant: 'primary', size: 'sm' }), s.go].join(' ')}>{t('ln.takeChapterQuiz')}</span>}
              </span>
              <Icon name="chevronRight" size={16} />
            </Link>
          </li>
        </ol>
      )}
    </section>
  );
}

/** /learn/:id from before chapters (e.g. /learn/stops) → /learn/basics/stops */
export function OldLessonRedirect() {
  const { id = '' } = useParams();
  const to = OLD_LESSON[id];
  return <Navigate to={to ? `/learn/${to}` : '/learn'} replace />;
}
