/**
 * Trading 101 (/learn): six short lessons for people new to trading, each with a "Try it" link
 * into the app (virtual money). Signed in, finished lessons are ticked on your account.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { Badge, Button, buttonClass, Card, EmptyState, Icon, PageHeader, useToast } from '../../ui';
import { levelLabel } from './Quiz';
import { LESSONS, lessonById, markLesson, nextLesson } from './lessons';
import { useSkill } from './useSkill';
import s from './Learn.module.css';

export function LearnPage() {
  const { isReal } = useAuth();
  const { level, quizTaken, learnDone } = useSkill();
  const done = learnDone.filter((id) => LESSONS.some((l) => l.id === id)).length;
  const upNext = nextLesson(learnDone);
  return (
    <>
      <PageHeader title={t('nav.learn')} subtitle={t('ln.sub')} />
      <div className={s.stack}>
        {isReal && (
          <Card pad>
            <div className={s.levelRow}>
              <div>
                <span className={s.kicker}>{t('qz.yourLevel')}</span>
                <b className={s.levelName}>{level ? levelLabel(level) : t('ln.noLevel')}</b>
                <span className={s.muted}>{t('ln.progress', { n: done, of: LESSONS.length })}</span>
              </div>
              <Link className={buttonClass({ variant: quizTaken ? 'ghost' : 'primary', size: 'sm' })} to="/quiz?next=/learn">
                {quizTaken ? t('ln.retake') : t('ln.takeQuiz')}
              </Link>
            </div>
            <div className={s.bar} aria-hidden="true">
              <i style={{ width: `${(done / LESSONS.length) * 100}%` }} />
            </div>
          </Card>
        )}
        <Card flush title={t('ln.lessons')}>
          <ol className={s.lessons}>
            {LESSONS.map((l, i) => {
              const isDone = learnDone.includes(l.id);
              return (
                <li key={l.id}>
                  <Link to={`/learn/${l.id}`} className={s.lessonLink}>
                    <span className={[s.num, isDone && s.numDone].filter(Boolean).join(' ')} aria-hidden="true">
                      {isDone ? '✓' : i + 1}
                    </span>
                    <span className={s.stepText}>
                      <b>{l.title}</b>
                      <span>{t('ln.minutes', { n: l.minutes })}</span>
                    </span>
                    {isDone ? <Badge tone="up">{t('ln.done')}</Badge> : upNext?.id === l.id ? <Badge tone="accent">{t('ln.next')}</Badge> : null}
                    <Icon name="chevronRight" size={16} />
                  </Link>
                </li>
              );
            })}
          </ol>
        </Card>
        <p className={s.fine}>{t('ln.fine')}</p>
      </div>
    </>
  );
}

export function LessonPage() {
  const { id = '' } = useParams();
  const lesson = lessonById(id);
  const { user, isReal } = useAuth();
  const { learnDone } = useSkill();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!lesson) return <EmptyState icon="learn" title={t('ln.missing')} actions={<Link to="/learn">{t('ln.back')}</Link>} />;
  const idx = LESSONS.indexOf(lesson);
  const after = LESSONS[idx + 1] ?? null;
  const isDone = learnDone.includes(lesson.id);
  async function done() {
    if (!user) return;
    setBusy(true);
    try {
      await markLesson(user.uid, lesson!.id);
      toast.show(t('ln.marked'));
    } catch {
      toast.show(t('qz.failed'), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader title={lesson.title} subtitle={t('ln.of', { n: idx + 1, of: LESSONS.length, min: lesson.minutes })} />
      <div className={s.narrow}>
        <Card pad>
          <div className={s.lesson}>
            {lesson.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {lesson.tip && (
              <p className={s.tip}>
                <b>{t('ln.tip')}</b> {lesson.tip}
              </p>
            )}
            <div className={s.lessonActions}>
              <Link className={buttonClass({ variant: 'primary' })} to={lesson.tryIt.to}>
                {lesson.tryIt.label}
              </Link>
              {isReal && (
                <Button variant="secondary" disabled={busy || isDone} onClick={() => void done()}>
                  {isDone ? t('ln.done') : t('ln.markDone')}
                </Button>
              )}
            </div>
          </div>
        </Card>
        <nav className={s.pager} aria-label={t('ln.lessons')}>
          <Link to="/learn">{t('ln.back')}</Link>
          {after && (
            <Link to={`/learn/${after.id}`}>
              {t('ln.nextLesson', { title: after.title })} <Icon name="chevronRight" size={14} />
            </Link>
          )}
        </nav>
      </div>
    </>
  );
}
