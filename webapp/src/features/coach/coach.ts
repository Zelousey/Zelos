/**
 * Coach / Learn: reads the coaching records the server writes (functions/main.py coach_*) and
 * calls those functions. A coaching is readable only by its coach and its student.
 */
import { collection, limit, orderBy, query, where, type DocumentData } from 'firebase/firestore';
import { useLiveDoc } from '../../data/liveDoc';
import { useLiveQuery } from '../../data/liveQuery';
import { callFunction, db } from '../../lib/firebase';

export const COACH_MIN_XP = 150; // Level 3 (Gold), same as functions/coaching.py
export const MAX_STUDENTS = 5;
export type TaskKind = 'trade' | 'win' | 'analyze' | 'grade' | 'news' | 'custom';
export const TASK_KINDS: { kind: TaskKind; label: string; max: number }[] = [
  { kind: 'trade', label: 'Make practice trades', max: 10 },
  { kind: 'win', label: 'Close winning trades', max: 5 },
  { kind: 'analyze', label: 'Analyze different stocks', max: 10 },
  { kind: 'grade', label: 'Grade setups', max: 10 },
  { kind: 'news', label: 'Read market news', max: 5 },
  { kind: 'custom', label: 'Custom task (no XP for the coach)', max: 1 },
];
export const TASK_XP: Record<TaskKind, number> = { trade: 10, win: 15, analyze: 10, grade: 10, news: 5, custom: 5 };

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown, n = 80) => (typeof v === 'string' ? v.slice(0, n) : '');

export type Trade = { id: string; sym: string; side: string; qty: number | null; entry: number | null; exit: number | null; pnl: number; pct: number; at: number };
export type Summary = { xp: number; level: number; levelName: string | null; equity: number | null; growthPct: number | null; trades: Trade[]; missionsToday: number; streak: number; updatedAt: number };
export type Coaching = { id: string; coach: string; student: string; coachName: string; studentName: string; status: 'active' | 'ended'; startedAt: number; tasksDone: number; summary: Summary | null };

export function parseSummary(v: unknown): Summary | null {
  const s = v as Record<string, unknown> | null;
  if (!s || typeof s !== 'object') return null;
  const trades = Array.isArray(s.trades)
    ? (s.trades as Record<string, unknown>[])
        .filter((t) => t && typeof t.id === 'string' && num(t.pnl) != null)
        .map((t) => ({ id: str(t.id), sym: str(t.sym, 10), side: t.side === 'short' ? 'short' : 'long', qty: num(t.qty), entry: num(t.entry), exit: num(t.exit), pnl: num(t.pnl) ?? 0, pct: num(t.pct) ?? 0, at: num(t.at) ?? 0 }))
    : [];
  return { xp: num(s.xp) ?? 0, level: num(s.level) ?? 0, levelName: str(s.levelName, 24) || null, equity: num(s.equity), growthPct: num(s.growthPct), trades, missionsToday: num(s.missionsToday) ?? 0, streak: num(s.streak) ?? 0, updatedAt: num(s.updatedAt) ?? 0 };
}

export function parseCoaching(id: string, d: DocumentData): Coaching | null {
  if (typeof d.coach !== 'string' || typeof d.student !== 'string') return null;
  return { id, coach: d.coach, student: d.student, coachName: str(d.coachName, 24) || 'Coach', studentName: str(d.studentName, 24) || 'Trader', status: d.status === 'active' ? 'active' : 'ended', startedAt: num(d.startedAt) ?? 0, tasksDone: num(d.tasksDone) ?? 0, summary: parseSummary(d.summary) };
}

export type Task = { id: string; kind: TaskKind; n: number; label: string; progress: number; status: 'open' | 'review' | 'done' | 'expired' | 'cancelled'; createdAt: number; dueAt: number };
const STATUSES = ['open', 'review', 'done', 'expired', 'cancelled'] as const;
export function parseTask(id: string, d: DocumentData): Task | null {
  const kind = TASK_KINDS.find((k) => k.kind === d.kind)?.kind;
  const status = STATUSES.find((x) => x === d.status);
  if (!kind || !status) return null;
  return { id, kind, n: num(d.n) ?? 1, label: str(d.label, 140), progress: num(d.progress) ?? 0, status, createdAt: num(d.createdAt) ?? 0, dueAt: num(d.dueAt) ?? 0 };
}

export type Note = { id: string; from: string; fromName: string; role: 'coach' | 'student'; text: string; reaction: 'good' | 'bad' | 'tip' | null; trade: { sym: string; pnl: number; pct: number } | null; at: number };
export function parseNote(id: string, d: DocumentData): Note | null {
  if (typeof d.from !== 'string') return null;
  const tr = d.trade as Record<string, unknown> | null;
  return {
    id,
    from: d.from,
    fromName: str(d.fromName, 24) || 'Someone',
    role: d.role === 'coach' ? 'coach' : 'student',
    text: str(d.text, 500),
    reaction: d.reaction === 'good' || d.reaction === 'bad' || d.reaction === 'tip' ? d.reaction : null,
    trade: tr && typeof tr === 'object' && typeof tr.sym === 'string' ? { sym: str(tr.sym, 10), pnl: num(tr.pnl) ?? 0, pct: num(tr.pct) ?? 0 } : null,
    at: num(d.at) ?? 0,
  };
}

const active = (field: 'coach' | 'student', uid: string) => query(collection(db(), 'coachings'), where(field, '==', uid), where('status', '==', 'active'), limit(10));
export const useAsCoach = (uid: string | null) => useLiveQuery(uid ? `coach:${uid}` : null, () => active('coach', uid!), parseCoaching);
export const useAsStudent = (uid: string | null) => useLiveQuery(uid ? `student:${uid}` : null, () => active('student', uid!), parseCoaching);
export const useCoaching = (id: string | null) => useLiveDoc(id ? `coachings/${id}` : null, (d) => parseCoaching(id ?? '', d));
export const useTasks = (id: string | null) => useLiveQuery(id ? `tasks:${id}` : null, () => query(collection(db(), 'coachings', id!, 'tasks'), orderBy('createdAt', 'desc'), limit(20)), parseTask);
export const useNotes = (id: string | null) => useLiveQuery(id ? `notes:${id}` : null, () => query(collection(db(), 'coachings', id!, 'notes'), orderBy('at', 'desc'), limit(50)), parseNote);
export const useCoachStats = (uid: string | null) => useLiveDoc(uid ? `coaches/${uid}` : null, (d) => ({ badge: d.badge === true, tasksDone: num(d.tasksDone) ?? 0 }));

export const refreshSummary = (coachingId: string) => callFunction('coach_refresh', { coachingId });
export const addTask = (data: { coachingId: string; kind: TaskKind; n: number; days: number; text?: string }) => callFunction<typeof data, { taskId: string }>('coach_task', data);
export const updateTask = (coachingId: string, taskId: string, action: 'tick' | 'confirm' | 'reject' | 'cancel') => callFunction('coach_task_update', { coachingId, taskId, action });
export const sendNote = (data: { coachingId: string; text?: string; reaction?: 'good' | 'bad' | 'tip'; tradeId?: string }) => callFunction('coach_note', data);
export const endCoaching = (coachingId: string) => callFunction('coach_end', { coachingId });
