/**
 * Taking or declining a strategy alert (owner 2026-11-19): users/{uid}/alertDecisions/{alertId}
 * {status: 'taken' | 'declined' | 'reactivated', at}. Declining is free; taking a declined one back
 * costs REACTIVATE_COST tokens (functions/main.py alert_reactivate) while its trade is still live.
 */
import { collection, doc, limit, orderBy, query, setDoc, type DocumentData } from 'firebase/firestore';
import { useLiveDoc } from '../../data/liveDoc';
import { useLiveQuery } from '../../data/liveQuery';
import { callFunction, db } from '../../lib/firebase';

export const REACTIVATE_COST = 2;
export type DecisionStatus = 'taken' | 'declined' | 'reactivated';
export type Decision = { id: string; status: DecisionStatus; at: number };

function parse(id: string, d: DocumentData): Decision | null {
  const status = d.status === 'taken' || d.status === 'declined' || d.status === 'reactivated' ? (d.status as DecisionStatus) : null;
  return status ? { id, status, at: typeof d.at === 'number' ? d.at : 0 } : null;
}

export function useDecision(uid: string | null, alertId: string | null) {
  return useLiveDoc(uid && alertId ? `users/${uid}/alertDecisions/${alertId}` : null, (d) => parse(alertId ?? '', d));
}

export function useDecisions(uid: string | null) {
  return useLiveQuery(uid ? `decisions|${uid}` : null, () => query(collection(db(), 'users', uid!, 'alertDecisions'), orderBy('at', 'desc'), limit(60)), parse);
}

export const decide = (uid: string, alertId: string, status: 'taken' | 'declined') => setDoc(doc(db(), 'users', uid, 'alertDecisions', alertId), { status, at: Date.now() });

export const reactivate = (alertId: string) => callFunction<{ alertId: string }, { balance: number; charged: number }>('alert_reactivate', { alertId });

/** Shares so the stop risks about `pct` of the account (at least 1), the way the alerts' size note suggests. */
export function sharesFor(account: number, entry: number, stop: number, pct = 0.01): number {
  const risk = Math.abs(entry - stop);
  if (!(risk > 0) || !(entry > 0)) return 1;
  const byRisk = Math.floor((account * pct) / risk);
  const byCash = Math.floor((account * 0.25) / entry); // never more than a quarter of the account in one idea
  return Math.max(1, Math.min(byRisk, byCash));
}
