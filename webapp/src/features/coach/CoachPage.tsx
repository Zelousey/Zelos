/**
 * Coaching (/coach): your coach (if you have one), your students (up to 5), the Coach badge,
 * and the way to invite a student (unlocks at Level 3, Gold). Owner decisions 2026-10-08.
 */
import { Link } from 'react-router';
import { useUserDoc } from '../../data/userDoc';
import { useAuth } from '../../lib/auth';
import { formatDate } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Badge, Button, buttonClass, Card, EmptyState, Icon, LoadingState, PageHeader, useToast } from '../../ui';
import { COACH_MIN_XP, MAX_STUDENTS, useAsCoach, useAsStudent, useCoachStats, type Coaching } from './coach';
import s from './Coach.module.css';

const BADGE_TASKS = 5;

export default function CoachPage() {
  const { user, isReal, ready, signInWithGoogle } = useAuth();
  const toast = useToast();
  const uid = isReal && user ? user.uid : null;
  const asCoach = useAsCoach(uid);
  const asStudent = useAsStudent(uid);
  const me = useUserDoc(uid);
  const stats = useCoachStats(uid);
  const xp = me.status === 'ready' ? me.data.xp : 0;
  const students = asCoach.status === 'ready' ? asCoach.data : [];
  const coach = asStudent.status === 'ready' ? asStudent.data[0] : undefined;
  const st = stats.status === 'ready' ? stats.data : { badge: false, tasksDone: 0 };

  if (!ready) return <LoadingState rows={4} />;
  if (!uid)
    return (
      <>
        <PageHeader title={t('co.title')} subtitle={t('co.subtitle')} />
        <Card pad>
          <EmptyState icon="missions" body={t('co.signIn')} actions={<Button variant="primary" onClick={() => void signInWithGoogle().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>{t('auth.signInWithGoogle')}</Button>} />
        </Card>
      </>
    );

  return (
    <>
      <PageHeader title={t('co.title')} subtitle={t('co.subtitle')} />
      <div className={s.stack}>
        <Card title={t('co.myCoach')}>
          {asStudent.status === 'loading' ? <LoadingState rows={1} /> : coach ? <Row c={coach} name={coach.coachName} /> : <p className={s.muted}>{t('co.noCoach')}</p>}
        </Card>

        <Card
          title={t('co.myStudents')}
          subtitle={`${students.length}/${MAX_STUDENTS}`}
          actions={
            xp >= COACH_MIN_XP && students.length < MAX_STUDENTS ? (
              <Link className={buttonClass({ variant: 'primary', size: 'sm' })} to="/invite?kind=coach">
                + {t('co.invite')}
              </Link>
            ) : undefined
          }
        >
          {asCoach.status === 'loading' ? (
            <LoadingState rows={2} />
          ) : students.length ? (
            <ul className={s.list}>
              {students.map((c) => (
                <li key={c.id}>
                  <Row c={c} name={c.studentName} />
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.muted}>{t('co.noStudents')}</p>
          )}
          {xp < COACH_MIN_XP && <p className={s.lock}>{t('co.locked', { n: COACH_MIN_XP - xp })}</p>}
          {students.length >= MAX_STUDENTS && <p className={s.muted}>{t('co.full', { max: MAX_STUDENTS })}</p>}
        </Card>

        <Card pad className={s.badgeCard}>
          <span className={[s.badgeIcon, st.badge && s.badgeOn].filter(Boolean).join(' ')} aria-hidden>
            <Icon name="missions" size={26} />
          </span>
          <div>
            <b>
              {t('co.badge')} {st.badge && <Badge tone="gold">✓</Badge>}
            </b>
            <p className={s.muted}>{st.badge ? t('co.badgeBody', { n: BADGE_TASKS }) : t('co.badgeProgress', { done: Math.min(st.tasksDone, BADGE_TASKS), n: BADGE_TASKS })}</p>
          </div>
        </Card>
      </div>
    </>
  );
}

function Row({ c, name }: { c: Coaching; name: string }) {
  return (
    <Link to={`/coach/${encodeURIComponent(c.id)}`} className={s.row}>
      <span className={s.avatar} aria-hidden>
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className={s.rowText}>
        <b>{name}</b>
        <span className={s.muted}>
          {t('co.tasksDone', { n: c.tasksDone })} · {t('co.since', { date: formatDate(c.startedAt) })}
        </span>
      </span>
      <Icon name="chevronRight" size={18} />
    </Link>
  );
}
