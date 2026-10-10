/**
 * Trade War battles (matches) in the app: reads what the server writes and calls the tw_*
 * functions (functions/main.py). Browsers never write battle data; every rule (buy-in, market
 * hours, draft picks, whale caps, eliminations, bounties, rewards) is checked by the server.
 *
 *   tradeWars/{id}                 the match (any signed-in user)
 *     accounts/{uid}               each player's match account (players)
 *     books/{uid}                  positions + fills (yourself; everyone when rules.viewTrades)
 *     events/{id}                  the Battlefield Ticker (players)
 */
import { collection, limit, orderBy, query, type DocumentData } from 'firebase/firestore';
import { useLiveDoc } from '../../data/liveDoc';
import { useLiveQuery } from '../../data/liveQuery';
import type { Quote, QuotesDoc } from '../../data/markets';
import { UNIVERSE } from '../../data/universe';
import { callFunction, db } from '../../lib/firebase';

export const BATTLE_ID_RE = /^[A-Za-z0-9]{12}$/;
export const QUOTE_MAX_AGE_S = 180; // same as TW_QUOTE_MAX_AGE_S: older prices can't be traded on
export const DRAFT_PICK_MS = 45000;

export type Status = 'lobby' | 'draft' | 'active' | 'ended' | 'cancelled';
export type Lms = { floorPct?: number; maxLossPct?: number; maxLosses?: number; cutHours?: number };
export type Modes = { draft?: { picks: number }; whale?: { capPct: number; shields: number }; storms?: 'rare' | 'often'; bounties?: boolean; stops?: boolean };
export type Out = { uid: string; name: string; reason: string; at: number; pnlPct: number; place: number };
export type Draft = { order: string[]; per: number; picks: Record<string, string[]>; taken: string[]; turn: number; total: number; deadline: number; done?: boolean };
export type Storm = { kind: 'double' | 'fee' | 'halt'; start: number; end: number; sym?: string };
export type Bounty = { id: string; by: string; byName: string; target: string; targetName: string; amount: number; pct: number; at: number; end: number; status: string; winner?: string; winnerName?: string };
export type Result = { uid: string; name: string; start: number; final: number; pnl: number; pnlPct: number; trades: number; out: boolean; outReason: string | null; rank: number };
export type Reward = { uid: string; tokens: number; note: string };

export type Battle = {
  id: string;
  name: string;
  host: string;
  hostName: string;
  buyIn: number;
  days: number;
  maxPlayers: number;
  status: Status;
  players: string[];
  names: Record<string, string>;
  invited: string[];
  lms: Lms | null;
  modes: Modes;
  symbols: string[] | null;
  viewTrades: boolean;
  createdAt: number;
  startAt: number;
  endAt: number;
  alive: string[] | null;
  outs: Out[];
  nextCutAt: number | null;
  whales: string[];
  shields: Record<string, number>;
  draft: Draft | null;
  storm: Storm | null;
  bounties: Bounty[];
  results: Result[];
  rewards: Reward[];
  rewardsPaid: boolean;
};

export type Account = { uid: string; name: string; start: number; cash: number; equity: number; pnl: number; pnlPct: number; trades: number; wins: number; losses: number; out: boolean; outReason: string | null; place: number | null };
export type Position = { sym: string; qty: number; avg: number; sl: number | null; tp: number | null };
export type Fill = { sym: string; side: 'buy' | 'sell'; qty: number; price: number; at: number; pnl: number | null; auto: boolean | 'sl' | 'tp' };
export type Book = { positions: Position[]; fills: Fill[] };
export type TickerEvent = { id: string; kind: string; text: string; at: number; uid: string | null };

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, n = 80) => (typeof v === 'string' ? v.slice(0, n) : '');
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const STATUSES: Status[] = ['lobby', 'draft', 'active', 'ended', 'cancelled'];

export function parseBattle(id: string, d: DocumentData): Battle {
  const rules = rec(d.rules);
  const modes = rec(d.modes);
  const lms = d.lms && typeof d.lms === 'object' ? (d.lms as Lms) : null;
  const draft = d.draft && typeof d.draft === 'object' ? (d.draft as Draft) : null;
  const storm = d.storm && typeof d.storm === 'object' && ['double', 'fee', 'halt'].includes(String((d.storm as Storm).kind)) ? (d.storm as Storm) : null;
  return {
    id,
    name: str(d.name, 40) || 'Trade War',
    host: str(d.host),
    hostName: str(d.hostName, 24) || 'Host',
    buyIn: num(d.buyIn),
    days: num(d.days),
    maxPlayers: num(d.maxPlayers, 10),
    status: STATUSES.includes(d.status) ? d.status : 'lobby',
    players: arr<string>(d.players).filter((x) => typeof x === 'string'),
    names: Object.fromEntries(Object.entries(rec(d.names)).map(([k, v]) => [k, str(v, 24)])),
    invited: arr<string>(d.invited).filter((x) => typeof x === 'string'),
    lms,
    modes: {
      draft: modes.draft ? { picks: num(rec(modes.draft).picks, 3) } : undefined,
      whale: modes.whale ? { capPct: num(rec(modes.whale).capPct, 50), shields: num(rec(modes.whale).shields, 1) } : undefined,
      storms: modes.storms === 'rare' || modes.storms === 'often' ? modes.storms : undefined,
      bounties: modes.bounties === true,
      stops: modes.stops === true,
    },
    symbols: Array.isArray(rules.symbols) ? (rules.symbols as string[]) : null,
    viewTrades: rules.viewTrades === true,
    createdAt: num(d.createdAt),
    startAt: num(d.startAt),
    endAt: num(d.endAt),
    alive: Array.isArray(d.alive) ? (d.alive as string[]) : null,
    outs: arr<Record<string, unknown>>(d.outs).map((o) => ({ uid: str(o.uid), name: str(o.name, 24), reason: str(o.reason), at: num(o.at), pnlPct: num(o.pnlPct), place: num(o.place) })),
    nextCutAt: typeof d.nextCutAt === 'number' ? d.nextCutAt : null,
    whales: arr<string>(d.whales),
    shields: Object.fromEntries(Object.entries(rec(d.shields)).map(([k, v]) => [k, num(v)])),
    draft,
    storm,
    bounties: arr<Record<string, unknown>>(d.bounties).map((b) => ({
      id: str(b.id),
      by: str(b.by),
      byName: str(b.byName, 24),
      target: str(b.target),
      targetName: str(b.targetName, 24),
      amount: num(b.amount),
      pct: num(b.pct),
      at: num(b.at),
      end: num(b.end),
      status: str(b.status, 16),
      ...(b.winner ? { winner: str(b.winner), winnerName: str(b.winnerName, 24) } : {}),
    })),
    results: arr<Record<string, unknown>>(d.results).map((r) => ({ uid: str(r.uid), name: str(r.name, 24), start: num(r.start), final: num(r.final), pnl: num(r.pnl), pnlPct: num(r.pnlPct), trades: num(r.trades), out: !!r.out, outReason: r.outReason ? str(r.outReason) : null, rank: num(r.rank) })),
    rewards: arr<Record<string, unknown>>(d.rewards).map((r) => ({ uid: str(r.uid), tokens: num(r.tokens), note: str(r.note, 80) })),
    rewardsPaid: d.rewardsPaid === true,
  };
}

export const parseAccount = (uid: string, d: DocumentData): Account => ({
  uid,
  name: str(d.name, 24) || 'Trader',
  start: num(d.start),
  cash: num(d.cash),
  equity: num(d.equity, num(d.start)),
  pnl: num(d.pnl),
  pnlPct: num(d.pnlPct),
  trades: num(d.trades),
  wins: num(d.wins),
  losses: num(d.losses),
  out: d.out === true,
  outReason: d.outReason ? str(d.outReason) : null,
  place: typeof d.place === 'number' ? d.place : null,
});

export function parseBook(d: DocumentData): Book {
  const positions = Object.entries(rec(d.positions))
    .map(([sym, p]) => {
      const x = rec(p);
      return { sym, qty: num(x.qty), avg: num(x.avg), sl: typeof x.sl === 'number' ? x.sl : null, tp: typeof x.tp === 'number' ? x.tp : null };
    })
    .filter((p) => p.qty > 0)
    .sort((a, b) => a.sym.localeCompare(b.sym));
  const fills = arr<Record<string, unknown>>(d.fills)
    .map((f) => ({ sym: str(f.sym, 10), side: f.side === 'sell' ? 'sell' : 'buy', qty: num(f.qty), price: num(f.price), at: num(f.at), pnl: typeof f.pnl === 'number' ? f.pnl : null, auto: f.auto === 'sl' || f.auto === 'tp' ? f.auto : f.auto === true }) as Fill)
    .reverse();
  return { positions, fills };
}

export const useBattle = (id: string | null) => useLiveDoc(id ? `tradeWars/${id}` : null, (d) => parseBattle(id ?? '', d));
/** Readable only by players: pass null for anyone else (the rules refuse it). */
export const useAccounts = (id: string | null) => useLiveQuery(id ? `twAccts:${id}` : null, () => query(collection(db(), 'tradeWars', id!, 'accounts'), limit(60)), (uid, d) => parseAccount(uid, d));
export const useBook = (id: string | null, uid: string | null) => useLiveDoc(id && uid ? `tradeWars/${id}/books/${uid}` : null, parseBook);
export const useEvents = (id: string | null) => useLiveQuery(id ? `twEvents:${id}` : null, () => query(collection(db(), 'tradeWars', id!, 'events'), orderBy('at', 'desc'), limit(30)), (eid, d): TickerEvent => ({ id: eid, kind: str(d.kind, 16), text: str(d.text, 160), at: num(d.at), uid: d.uid ? str(d.uid) : null }));

// ---------------------------------------------------------------- the rules the screen shows (the server decides)
/** Can you trade right now? Same check as the server's _tw_prices. */
export function tradable(q: QuotesDoc | null, nowMs: number): { ok: boolean; why: 'closed' | 'stale' | null } {
  if (!q || !q.marketOpen) return { ok: false, why: 'closed' };
  const at = q.updatedAt ? Date.parse(q.updatedAt) : NaN;
  if (!Number.isFinite(at) || nowMs - at > QUOTE_MAX_AGE_S * 1000) return { ok: false, why: 'stale' };
  return { ok: true, why: null };
}

/** The stocks you may trade in this match: your draft picks, else the squad's list, else the Zelos list. */
export function allowedSymbols(b: Battle, uid: string): string[] {
  if (b.modes.draft && b.draft) return [...(b.draft.picks[uid] ?? [])].sort();
  const all = UNIVERSE.map((i) => i.sym);
  return b.symbols ? all.filter((s) => b.symbols!.includes(s)) : all;
}

/** Whose pick it is in the snake draft (1-2-3, 3-2-1, ...), as the server's tw_draft_on_clock. */
export function onClock(d: Draft): string | null {
  if (d.turn >= d.total || !d.order.length) return null;
  const n = d.order.length;
  const rnd = Math.floor(d.turn / n);
  const pos = d.turn % n;
  return d.order[rnd % 2 === 0 ? pos : n - 1 - pos] ?? null;
}

export const stormNow = (s: Storm | null, nowMs: number) => (s && s.start <= nowMs && nowMs < s.end ? s : null);

/** Your match value with live prices (the server's stored equity only moves on trades and every 5 minutes). */
export function liveEquity(cash: number, positions: Position[], quotes: Record<string, Quote>): number {
  return positions.reduce((t, p) => t + p.qty * (quotes[p.sym]?.c ?? p.avg), cash);
}

export type Standing = Account & { rank: number; live: boolean };
/** Live standings: players still in by % P&L (then $), then everyone knocked out by their place. */
export function standings(accts: Account[], b: Battle): Standing[] {
  const inGame = accts.filter((a) => !a.out).sort((x, y) => y.pnlPct - x.pnlPct || y.pnl - x.pnl || x.uid.localeCompare(y.uid));
  const out = accts.filter((a) => a.out).sort((x, y) => (x.place ?? 999) - (y.place ?? 999));
  return [...inGame, ...out].map((a, i) => ({ ...a, rank: i + 1, live: b.status === 'active' && !a.out }));
}

export const OUT_REASON: Record<string, string> = { floor: 'Fell below the P&L floor', bigLoss: 'One loss was too big', losses: 'Too many losing trades', cut: 'Last place at the cut', surrender: 'Surrendered' };

// ---------------------------------------------------------------- the server calls
type Ok = { ok: boolean };
export const joinBattle = (warId: string) => callFunction<{ warId: string }, Ok>('tw_join', { warId });
export const leaveBattle = (warId: string) => callFunction<{ warId: string }, Ok>('tw_leave', { warId });
export const startBattle = (warId: string) => callFunction<{ warId: string }, Ok>('tw_start', { warId });
export const cancelBattle = (warId: string) => callFunction<{ warId: string }, Ok>('tw_cancel', { warId });
export const surrender = (warId: string) => callFunction<{ warId: string }, { ok: boolean; place: number }>('tw_surrender', { warId });
export const draftPick = (warId: string, sym?: string) => callFunction<{ warId: string; sym?: string }, Ok>('tw_draft_pick', sym ? { warId, sym } : { warId });
export type TradeReq = { warId: string; sym: string; side: 'buy' | 'sell'; qty: number; sl?: number; tp?: number };
export const trade = (req: TradeReq) => callFunction<TradeReq, { fill: { price: number; qty: number }; cash: number; equity: number; out: boolean }>('tw_trade', req);
export const setBracket = (warId: string, sym: string, sl: number | null, tp: number | null) => callFunction<{ warId: string; sym: string; sl: number | null; tp: number | null }, { sl: number | null; tp: number | null }>('tw_bracket', { warId, sym, sl, tp });
export const placeBounty = (warId: string, target: string, pct: 2 | 5 | 10, hours: 6 | 24) => callFunction<{ warId: string; target: string; pct: number; hours: number }, { id: string; amount: number; end: number }>('tw_bounty', { warId, target, pct, hours });
export const spendShield = (warId: string, bountyId: string) => callFunction<{ warId: string; bountyId: string }, Ok>('tw_shield', { warId, bountyId });
