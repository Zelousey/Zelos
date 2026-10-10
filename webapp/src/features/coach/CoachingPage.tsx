/**
 * One coaching (/coach/:id), for both people. Both see the student's progress, the recent
 * trades, the tasks and the notes. The coach reacts to trades ("Good move" / "Bad move" /
 * "Try this", with an optional note), sets and confirms tasks; the student ticks custom
 * tasks and replies. Either side can end it. The server does the work (coach_* functions).
 */
import { useEffect, useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { levelFor } from '../../data/levels';
import { useAuth } from '../../lib/auth';
import { formatDate, formatMoney, formatPercent, formatPrice, formatRelative, formatSignedMoney } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { Badge, Button, buttonClass, Card, Confirm, EmptyState, Field, Icon, LoadingState, PageHeader, Stat, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { addTask, endCoaching, refreshSummary, sendNote, TASK_KINDS, TASK_XP, updateTask, useCoaching, useNotes, useTasks, type Coaching, type Task, type TaskKind, type Trade } from './coach';
import { usePlays } from './plays';
import s from './Coach.module.css';

const dir = (n: number) => (n > 0 ? 'up' : n < 0 ? 'down' : '');

export default function CoachingPage() {
  const id = useParams().id ?? '';
  const { user, isReal } = useAuth();
  const c = useCoaching(/^[A-Za-z0-9_-]{6,260}$/.test(id) ? id : null);
  if (!isReal || !user) return <EmptyState icon="missions" body={t('co.signIn')} />;
  if (c.status === 'loading') return <LoadingState rows={6} />;
  if (c.status !== 'ready' || !c.data)
    return (
      <EmptyState
        icon="missions"
        title={t('co.ended')}
        actions={
          <Link to="/coach" className={s.backLink}>
            ← {t('co.back')}
          </Link>
        }
      />
    );
  return <View c={c.data} uid={user.uid} />;
}

function View({ c, uid }: { c: Coaching; uid: string }) {
  const role = uid === c.coach ? 'coach' : 'student';
  const toast = useToast();
  const navigate = useNavigate();
  const [ending, setEnding] = useState(false);
  const active = c.status === 'active';
  useEffect(() => {
    if (active) void refreshSummary(c.id).catch(() => {});
  }, [c.id, active]);
  const sm = c.summary;
  const lv = sm ? levelFor(sm.xp).level : null; // from XP, the same table as everywhere else

  async function end() {
    try {
      await endCoaching(c.id);
      navigate('/coach');
    } catch (e) {
      toast.show(errorText(e, t('co.failed')), 'error');
    }
  }

  return (
    <>
      <Link to="/coach" className={s.backLink}>
        ← {t('co.back')}
      </Link>
      <PageHeader title={role === 'coach' ? t('co.youCoach', { name: c.studentName }) : t('co.yourCoach', { name: c.coachName })} subtitle={active ? t('co.since', { date: formatDate(c.startedAt) }) : t('co.ended')} keepOnPhone />
      <div className={s.grid}>
        <Card className={s.progress} title={t('co.progress')} subtitle={sm ? t('co.updated', { when: formatRelative(sm.updatedAt) }) : undefined}>
          {sm ? (
            <div className={s.stats}>
              <Stat size="sm" label={t('co.level')} value={`${lv!.level} · ${lv!.name}`} hint={`${sm.xp.toLocaleString('en-US')} XP`} />
              <Stat size="sm" label={t('co.account')} value={formatMoney(sm.equity)} delta={sm.growthPct != null ? formatPercent(sm.growthPct) : undefined} direction={sm.growthPct == null ? 'flat' : sm.growthPct >= 0 ? 'up' : 'down'} />
              <Stat size="sm" label={t('co.streak')} value={sm.streak ? `🔥 ${sm.streak}` : '0'} />
              <Stat size="sm" label={t('co.missionsToday')} value={`${sm.missionsToday}/5`} />
            </div>
          ) : (
            <LoadingState rows={2} />
          )}
        </Card>

        <Card className={s.trades} title={t('co.trades')} flush>
          {!sm?.trades.length ? <p className={s.pad}>{t('co.noTrades')}</p> : (
            <ul className={s.tradeList}>
              {sm.trades.map((tr) => (
                <TradeRow key={tr.id} tr={tr} coachingId={c.id} canReact={role === 'coach' && active} />
              ))}
            </ul>
          )}
        </Card>

        <Plays c={c} role={role} active={active} />
        <Tasks c={c} role={role} active={active} />
        <Notes c={c} uid={uid} active={active} />
      </div>
      {active && (
        <div className={s.endRow}>
          <Button variant="ghost" onClick={() => setEnding(true)}>
            {t('co.end')}
          </Button>
        </div>
      )}
      <Confirm open={ending} title={t('co.end.title')} action={t('co.end')} variant="danger" onConfirm={() => void end()} onClose={() => setEnding(false)}>
        <p>{t('co.end.body')}</p>
      </Confirm>
    </>
  );
}

function TradeRow({ tr, coachingId, canReact }: { tr: Trade; coachingId: string; canReact: boolean }) {
  const toast = useToast();
  const [pick, setPick] = useState<'good' | 'bad' | 'tip' | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!pick) return;
    setBusy(true);
    try {
      await sendNote({ coachingId, reaction: pick, tradeId: tr.id, text: text.trim() || undefined });
      toast.show(t(`co.react.${pick}` as MessageKey) + ' ✓');
      setPick(null);
      setText('');
    } catch (e) {
      toast.show(errorText(e, t('co.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className={s.trade}>
      <div className={s.tradeTop}>
        <b>{tr.sym}</b>
        <span className={s.muted}>
          {[tr.qty != null ? t('co.shares', { n: tr.qty }) : '', tr.entry != null && tr.exit != null ? `$${formatPrice(tr.entry)} → $${formatPrice(tr.exit)}` : '', formatDate(tr.at)].filter(Boolean).join(' · ')}
        </span>
        <span className={dir(tr.pnl)}>
          {formatSignedMoney(tr.pnl)} <small>({formatPercent(tr.pct)})</small>
        </span>
      </div>
      {canReact && (
        <div className={s.reacts}>
          {(['good', 'bad', 'tip'] as const).map((r) => (
            <button key={r} type="button" className={[s.react, pick === r && s.reactOn].filter(Boolean).join(' ')} aria-pressed={pick === r} onClick={() => setPick(pick === r ? null : r)}>
              {r === 'good' ? '👍' : r === 'bad' ? '👎' : '💡'} {t(`co.react.${r}` as MessageKey)}
            </button>
          ))}
        </div>
      )}
      {pick && (
        <div className={s.reactForm}>
          <Field label={t('co.react.note')} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
          <Button size="sm" variant="primary" disabled={busy} onClick={() => void send()}>
            {t('co.react.send')}
          </Button>
        </div>
      )}
    </li>
  );
}

function Tasks({ c, role, active }: { c: Coaching; role: 'coach' | 'student'; active: boolean }) {
  const tasks = useTasks(c.id);
  const list = tasks.status === 'ready' ? tasks.data : [];
  const open = list.filter((x) => x.status === 'open' || x.status === 'review').length;
  return (
    <Card className={s.tasks} title={t('co.tasks')} subtitle={role === 'coach' ? t('co.task.max') : undefined}>
      {tasks.status === 'loading' ? <LoadingState rows={2} /> : !list.length ? <p className={s.muted}>{t('co.noTasks')}</p> : (
        <ul className={s.taskList}>
          {list.map((x) => (
            <TaskRow key={x.id} task={x} coachingId={c.id} role={role} active={active} />
          ))}
        </ul>
      )}
      {role === 'coach' && active && open < 3 && <NewTask coachingId={c.id} student={c.studentName} />}
    </Card>
  );
}

function TaskRow({ task, coachingId, role, active }: { task: Task; coachingId: string; role: 'coach' | 'student'; active: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function act(a: 'tick' | 'confirm' | 'reject' | 'cancel') {
    setBusy(true);
    try {
      await updateTask(coachingId, task.id, a);
    } catch (e) {
      toast.show(errorText(e, t('co.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  const pct = Math.min(100, (task.progress / Math.max(1, task.n)) * 100);
  const tone = task.status === 'done' ? 'up' : task.status === 'review' ? 'violet' : task.status === 'open' ? 'accent' : 'neutral';
  return (
    <li className={s.task}>
      <div className={s.taskTop}>
        <span>{task.label}</span>
        <Badge tone={tone}>{t(`co.task.status.${task.status}` as MessageKey)}</Badge>
      </div>
      {task.kind !== 'custom' && (
        <div className={s.bar} role="progressbar" aria-label={task.label} aria-valuemin={0} aria-valuemax={task.n} aria-valuenow={task.progress}>
          <i style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className={s.taskFoot}>
        <span className={s.muted}>
          {task.kind !== 'custom' && `${task.progress}/${task.n} · `}
          {t('co.task.due', { date: formatDate(task.dueAt) })} · +{TASK_XP[task.kind]} XP
        </span>
        {active && (
          <span className={s.row2}>
            {role === 'student' && task.kind === 'custom' && task.status === 'open' && (
              <Button size="sm" variant="primary" disabled={busy} onClick={() => void act('tick')}>
                {t('co.task.tick')}
              </Button>
            )}
            {role === 'coach' && task.status === 'review' && (
              <>
                <Button size="sm" variant="primary" disabled={busy} onClick={() => void act('confirm')}>
                  {t('co.task.confirm')}
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act('reject')}>
                  {t('co.task.reject')}
                </Button>
              </>
            )}
            {role === 'coach' && (task.status === 'open' || task.status === 'review') && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act('cancel')}>
                {t('co.task.cancel')}
              </Button>
            )}
          </span>
        )}
      </div>
    </li>
  );
}

function NewTask({ coachingId, student }: { coachingId: string; student: string }) {
  const toast = useToast();
  const kindId = useId();
  const daysId = useId();
  const [kind, setKind] = useState<TaskKind>('trade');
  const [n, setN] = useState(3);
  const [days, setDays] = useState(7);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const max = TASK_KINDS.find((k) => k.kind === kind)!.max;
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await addTask({ coachingId, kind, n: kind === 'custom' ? 1 : Math.min(n, max), days, text: kind === 'custom' ? text : undefined });
      setText('');
    } catch (err) {
      toast.show(errorText(err, t('co.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={s.newTask} onSubmit={add} aria-label={t('co.newTask')}>
      <div className={s.fieldLabel}>
        <label htmlFor={kindId}>{t('co.task.kind')}</label>
        <select id={kindId} className={s.select} value={kind} onChange={(e) => setKind(e.target.value as TaskKind)}>
          {TASK_KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      {kind === 'custom' ? (
        <Field label={t('co.task.text')} value={text} maxLength={120} onChange={(e) => setText(e.target.value)} />
      ) : (
        <Field label={t('co.task.n')} type="number" min={1} max={max} value={n} onChange={(e) => setN(Math.max(1, Math.min(max, Number(e.target.value) || 1)))} />
      )}
      <div className={s.fieldLabel}>
        <label htmlFor={daysId}>{t('co.task.days')}</label>
        <select id={daysId} className={s.select} value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {[1, 3, 7, 14].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <p className={s.muted}>{t('co.task.xp', { xp: TASK_XP[kind], name: student })}</p>
      <Button type="submit" variant="primary" disabled={busy || (kind === 'custom' && text.trim().length < 3)}>
        <Icon name="missions" size={16} /> {t('co.task.add')}
      </Button>
    </form>
  );
}

function Notes({ c, uid, active }: { c: Coaching; uid: string; active: boolean }) {
  const notes = useNotes(c.id);
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const list = notes.status === 'ready' ? notes.data : [];
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await sendNote({ coachingId: c.id, text: text.trim() });
      setText('');
    } catch (err) {
      toast.show(errorText(err, t('co.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className={s.notes} title={t('co.notes')}>
      {active && (
        <form className={s.noteForm} onSubmit={send}>
          <Field label={t('co.notePlaceholder')} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" variant="primary" disabled={busy || !text.trim()}>
            {t('co.send')}
          </Button>
        </form>
      )}
      {notes.status === 'loading' ? <LoadingState rows={2} /> : !list.length ? <p className={s.muted}>{t('co.noNotes')}</p> : (
        <ul className={s.noteList}>
          {list.map((n) => (
            <li key={n.id} className={[s.note, n.from === uid && s.mine].filter(Boolean).join(' ')}>
              <span className={s.noteHead}>
                <b>{n.fromName}</b> <span className={s.muted}>{formatRelative(n.at)}</span>
              </span>
              {n.trade && (
                <span className={s.noteTrade}>
                  {n.reaction === 'good' ? '👍' : n.reaction === 'bad' ? '👎' : n.reaction === 'tip' ? '💡' : ''} {n.reaction ? t(`co.react.${n.reaction}` as MessageKey) : ''} · {n.trade.sym} <span className={dir(n.trade.pnl)}>{formatPercent(n.trade.pct)}</span>
                </span>
              )}
              {n.text && <span>{n.text}</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Plays({ c, role, active }: { c: Coaching; role: 'coach' | 'student'; active: boolean }) {
  const plays = usePlays(c.id);
  const list = plays.status === 'ready' ? plays.data : [];
  return (
    <Card
      className={s.plays}
      title={t('play.list')}
      subtitle={role === 'coach' ? t('play.listSubCoach') : t('play.listSub')}
      actions={
        role === 'coach' && active ? (
          <Link className={buttonClass({ variant: 'primary', size: 'sm' })} to={`/coach/${c.id}/play/new`}>
            {t('play.newBtn')}
          </Link>
        ) : undefined
      }
      flush
    >
      {plays.status === 'loading' ? (
        <LoadingState rows={2} />
      ) : !list.length ? (
        <p className={s.pad}>{role === 'coach' ? t('play.noneCoach') : t('play.none', { name: c.coachName })}</p>
      ) : (
        <ul className={s.playList}>
          {list.map((p) => (
            <li key={p.id}>
              <Link to={`/coach/${c.id}/play/${p.id}`} className={s.playRow}>
                <b>{p.title}</b>
                <span className={s.muted}>
                  {p.sym} · {formatRelative(p.at)} · {t('play.commentsShort', { n: p.comments.length })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
