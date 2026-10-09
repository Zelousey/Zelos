/**
 * Alerts in the app (owner 2026-10-09: the website's Alerts pages, in the app). Public alerts
 * are teasers until the trade finishes; the full alert is in alertsLocked/{id}, readable with a
 * pass for that strategy or a single unlock (firestore.rules). Outcomes are written by the
 * server (functions/main.py _apply_one_outcome).
 */
import { collection, doc, getDoc, limit, orderBy, query, type DocumentData } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useLiveDoc } from '../../data/liveDoc';
import { useLiveQuery } from '../../data/liveQuery';
import { callFunction, db } from '../../lib/firebase';
import { STRATEGIES, type StrategyId } from '../strategies/strategies';

export type Result = 'hit-target' | 'stopped-out' | 'open' | 'expired' | 'no-trade';
const RESULTS: Result[] = ['hit-target', 'stopped-out', 'open', 'expired', 'no-trade'];
export const ID_RE = /^[a-z0-9-]{3,80}$/;

export type Alert = {
  id: string;
  strategy: StrategyId;
  at: number;
  status: string; // qualified | watching | no-qualifying-setup | …
  locked: boolean;
  afterClose: boolean;
  lockedUntil: number | null;
  ticker: string | null;
  direction: string | null;
  label: string | null;
  score: number | null;
  scoreMax: number | null;
  regime: string | null;
  result: Result | null;
  exitPrice: number | null;
  closedAt: number | null;
  outcomeNotes: string | null;
  // the full alert (null while locked)
  entry: number | null;
  stop: number | null;
  target1: number | null;
  target2: number | null;
  riskPerShare: number | null;
  rewardPerShare: number | null;
  rewardRisk: number | null;
  reasoning: string | null;
  riskNotes: string | null;
  optionsRule: string | null;
  sizeNote: string | null;
  technicals: [string, string][];
};

const ms = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') return Date.parse(v) || null;
  const ts = v as { toMillis?: () => number } | null;
  return typeof ts?.toMillis === 'function' ? ts.toMillis() : null;
};
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);

/** A real alert of a known strategy (test docs ignored), teaser or full. */
export function parseAlert(id: string, d: DocumentData): Alert | null {
  const st = STRATEGIES.find((x) => x.id === d.strategy);
  const status = typeof d.status === 'string' ? d.status : '';
  if (!st || /^test/i.test(status) || /^test/i.test(id)) return null;
  const o = (d.outcome && typeof d.outcome === 'object' ? d.outcome : {}) as Record<string, unknown>;
  const locked = d.locked === true && !d.ticker;
  const tech = d.technicals && typeof d.technicals === 'object' && !Array.isArray(d.technicals) ? (d.technicals as Record<string, unknown>) : {};
  return {
    id,
    strategy: st.id,
    at: ms(d.createdAt) ?? 0,
    status,
    locked,
    afterClose: d.afterClose === true,
    lockedUntil: num(d.lockedUntil),
    ticker: locked ? null : str(d.ticker, 10)?.toUpperCase() ?? null,
    direction: str(d.direction, 12),
    label: str(d.setupLabel, 80),
    score: num(d.score),
    scoreMax: num(d.scoreMax),
    regime: str(d.marketRegime, 200),
    result: RESULTS.find((r) => r === o.result) ?? null,
    exitPrice: num(o.exitPrice),
    closedAt: ms(o.closedAt),
    outcomeNotes: str(o.notes, 500),
    entry: num(d.entry),
    stop: num(d.stop),
    target1: num(d.target1),
    target2: num(d.target2),
    riskPerShare: num(d.riskPerShare),
    rewardPerShare: num(d.rewardPerShare),
    rewardRisk: num(d.rewardRiskRatio),
    reasoning: str(d.reasoning, 3000),
    riskNotes: str(d.riskNotes, 1500),
    optionsRule: str(d.optionsRule, 600),
    sizeNote: str(d.suggestedSizeNote, 400),
    technicals: Object.entries(tech)
      .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      .slice(0, 20)
      .map(([k, v]) => [k.slice(0, 40), String(v).slice(0, 120)]),
  };
}

export const hasTrade = (a: Alert) => a.status !== 'no-qualifying-setup' && (a.locked || !!a.ticker);
export const isShort = (a: Alert) => /short|put|bear/i.test(a.direction ?? '');
export const isClosedForUnlock = (a: Alert, now: number) => a.afterClose || (a.lockedUntil != null && a.lockedUntil <= now);

export const useAlertList = () => useLiveQuery('alerts:100', () => query(collection(db(), 'alerts'), orderBy('createdAt', 'desc'), limit(100)), parseAlert);
export const useAlertDoc = (id: string | null) => useLiveDoc(id ? `alerts/${id}` : null, (d) => parseAlert(id ?? '', d));

/** The full alert from alertsLocked, when your pass or unlock allows it. `key` re-reads after an unlock. */
export function useFullAlert(id: string | null, uid: string | null, key: string) {
  const [state, setState] = useState<{ k: string; alert: Alert | null }>({ k: '', alert: null });
  const k = `${id}|${uid}|${key}`;
  useEffect(() => {
    if (!id || !uid) return;
    let live = true;
    getDoc(doc(db(), 'alertsLocked', id))
      .then((s) => live && setState({ k, alert: s.exists() ? parseAlert(id, s.data()) : null }))
      .catch(() => live && setState({ k, alert: null })); // no access: stays locked
    return () => {
      live = false;
    };
  }, [id, uid, k]);
  return { loading: !!id && !!uid && state.k !== k, alert: state.k === k ? state.alert : null };
}

export const unlockAlert = (alertId: string) => callFunction<{ kind: 'unlock'; alertId: string }, { balance: number; charged: number }>('tokens_spend', { kind: 'unlock', alertId });
/** Opening a real alert: XP and the streak (server-checked; once per alert). */
export const awardOpen = (alertId: string) => callFunction<{ type: string; refId: string }, { awarded: boolean }>('xp_award', { type: 'alert-open', refId: alertId });

export type Record_ = { wins: number; losses: number; open: number; expired: number; noTrade: number; winRate: number | null };
/** The track record over these alerts: win rate over closed trades only (like the website). */
export function trackRecord(list: Alert[]): Record_ {
  const r = { wins: 0, losses: 0, open: 0, expired: 0, noTrade: 0 };
  for (const a of list) {
    if (!hasTrade(a)) continue;
    if (a.result === 'hit-target') r.wins++;
    else if (a.result === 'stopped-out') r.losses++;
    else if (a.result === 'expired') r.expired++;
    else if (a.result === 'no-trade') r.noTrade++;
    else r.open++;
  }
  return { ...r, winRate: r.wins + r.losses ? Math.round((r.wins / (r.wins + r.losses)) * 100) : null };
}

// ------------------------------------------------------------------ notifications
// users/{uid}.notificationPrefs: strategies = the scanners that may push (missing = all on);
// types.{kind} = false turns a personal kind off. Same as the website (zelos-notify-settings.js).
export const NOTIFY_GROUPS: { title: string; items: { key: string; label: string; hint: string }[] }[] = [
  { title: 'Strategy alerts', items: STRATEGIES.map((s) => ({ key: `s:${s.id}`, label: s.name, hint: 'A new alert is published' })) },
  { title: 'Battles', items: [{ key: 'challenges', label: 'Challenges', hint: 'Someone challenges you, or answers your challenge' }, { key: 'battles', label: 'Battle updates', hint: 'A Trade War starts, you lose the lead, final results' }] },
  { title: 'Friends & community', items: [{ key: 'friends', label: 'Friends', hint: 'Someone adds you as a friend' }, { key: 'community', label: 'Community', hint: 'New members, Founder milestones' }] },
  { title: 'Your trades', items: [{ key: 'fills', label: 'Stop loss & take profit', hint: 'An automatic exit fills in one of your Trade Wars' }] },
];
export type Prefs = { strategies: string[] | null; types: Record<string, boolean> };
export function parsePrefs(d: DocumentData | null | undefined): Prefs {
  const p = (d?.notificationPrefs && typeof d.notificationPrefs === 'object' ? d.notificationPrefs : {}) as Record<string, unknown>;
  const strategies = Array.isArray(p.strategies) ? (p.strategies as unknown[]).filter((x): x is string => typeof x === 'string' && STRATEGIES.some((s) => s.id === x)) : null;
  const types: Record<string, boolean> = {};
  if (p.types && typeof p.types === 'object') for (const [k, v] of Object.entries(p.types as Record<string, unknown>)) if (typeof v === 'boolean') types[k] = v;
  return { strategies, types };
}
export const isOn = (p: Prefs, key: string) => (key.startsWith('s:') ? (p.strategies ?? STRATEGIES.map((s) => s.id)).includes(key.slice(2)) : p.types[key] !== false);
/** The update for users/{uid} after flipping one switch. */
export function toggle(p: Prefs, key: string, on: boolean): Record<string, unknown> {
  if (key.startsWith('s:')) {
    const cur = new Set(p.strategies ?? STRATEGIES.map((s) => s.id));
    if (on) cur.add(key.slice(2));
    else cur.delete(key.slice(2));
    return { notificationPrefs: { strategies: STRATEGIES.map((s) => s.id).filter((id) => cur.has(id)) } };
  }
  return { notificationPrefs: { types: { [key]: on } } };
}
