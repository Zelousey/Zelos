/**
 * Private Wars with friends (W3, docs/WAR_DESIGN.md §8): reads wars/{id} (written only by the
 * server, functions/warlobby.py) and calls war_lobby for every action. The server checks
 * everything: who may invite, join, lock in or start, and the deadlines.
 *
 *   configuring → recruiting → ready → (start, once) active → ended;  or cancelled
 */
import { collection, limit, orderBy, query, where, type DocumentData } from 'firebase/firestore';
import { useLiveDoc } from '../../data/liveDoc';
import { useLiveQuery } from '../../data/liveQuery';
import { callFunction, db } from '../../lib/firebase';

export const DAYS = [1, 2, 3, 5, 7] as const;
export const LOBBY_HOURS = [1, 6, 24] as const;
export const PLAYERS = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const WAR_ID_RE = /^[A-Za-z0-9]{10,40}$/;

export type WarStatus = 'lobby' | 'active' | 'ended' | 'cancelled';
export type WarStage = 'configuring' | 'recruiting' | 'ready' | null;
export type PrivateWar = {
  id: string;
  name: string;
  status: WarStatus;
  stage: WarStage;
  organizer: string;
  players: string[];
  names: Record<string, string>;
  ready: Record<string, boolean>;
  invited: string[];
  days: number;
  lobbyHours: number;
  maxPlayers: number;
  soldiers: number;
  deadline: number | null;
  startedAt: number | null;
  endsAt: number | null;
  mapSize: number | null;
  why: string | null;
  phase: 'claiming' | 'holding' | null;
  claimEnds: number | null;
  lockedCount: number;
  territories: string[];
  map: Record<string, Territory>;
  battles: Record<string, Battle>;
  bonusPoints: Record<string, number>;
  redeployPasses: Record<string, number>;
  passExpiry: Record<string, number>;
  attacks: Record<string, Attack>;
  progress: Record<string, Record<string, number>>;
  lostAt: Record<string, Record<string, number>>;
  waitSkips: Record<string, number>;
  startEquity: Record<string, number>;
};
/** An attack on owned territory (W5a): open ones live on the War, finished ones in wars/{id}/attacks. */
export type Attack = {
  id: string;
  attacker: string;
  defender: string;
  territory: string;
  sym: string;
  side: Side;
  stage: 'answering' | 'running' | 'done';
  answerBy: number;
  startsAt: number | null;
  endsAt: number | null;
  start: number | null;
  end: number | null;
  stakes: Record<string, number>;
  counterPicked: boolean;
  result: string | null;
  captured: boolean;
  doneAt: number | null;
};
export function parseAttack(id: string, d: DocumentData): Attack | null {
  const b = rec(d);
  if (!['answering', 'running', 'done'].includes(b.stage as string) || !isSide(b.side) || typeof b.sym !== 'string' || typeof b.territory !== 'string') return null;
  return {
    id,
    attacker: typeof b.attacker === 'string' ? b.attacker : '',
    defender: typeof b.defender === 'string' ? b.defender : '',
    territory: b.territory,
    sym: b.sym,
    side: b.side,
    stage: b.stage as Attack['stage'],
    answerBy: num(b.answerBy) ?? 0,
    startsAt: num(b.startsAt),
    endsAt: num(b.endsAt),
    start: num(b.start),
    end: num(b.end),
    stakes: nums(b.stakes),
    counterPicked: b.counterPicked === true,
    result: typeof b.result === 'string' ? b.result : null,
    captured: b.captured === true,
    doneAt: num(b.doneAt),
  };
}
function nested(v: unknown): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const [k, x] of Object.entries(rec(v))) out[k] = nums(x);
  return out;
}
export type Side = 'bull' | 'bear';
/** A contested battle (W4b): best-pick choices only appear here once it's running. */
export type Battle = {
  territory: string;
  kind: 'duel' | 'best';
  players: string[];
  command: string;
  stage: 'waiting' | 'picking' | 'running' | 'done';
  wakeAt: number | null;
  pickBy: number | null;
  startsAt: number | null;
  endsAt: number | null;
  sym: string | null;
  sides: Record<string, Side>;
  picks: Record<string, { side: Side; sym: string }>;
  start: Record<string, number>;
  end: Record<string, number>;
  winner: string | null;
};
/** A territory on the revealed map: owners are public, soldier counts never are. */
export type Territory = { state: 'owned' | 'neutral' | 'contested'; owner: string | null; contenders: string[] };

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
export function parseWar(id: string, d: DocumentData): PrivateWar | null {
  if (!['lobby', 'active', 'ended', 'cancelled'].includes(d.status)) return null;
  const names: Record<string, string> = {};
  for (const [k, v] of Object.entries((d.names && typeof d.names === 'object' ? d.names : {}) as Record<string, unknown>)) if (typeof v === 'string') names[k] = v.slice(0, 24);
  const ready: Record<string, boolean> = {};
  for (const [k, v] of Object.entries((d.ready && typeof d.ready === 'object' ? d.ready : {}) as Record<string, unknown>)) ready[k] = v === true;
  return {
    id,
    name: typeof d.name === 'string' ? d.name.slice(0, 40) : 'War',
    status: d.status,
    stage: ['configuring', 'recruiting', 'ready'].includes(d.stage) ? d.stage : null,
    organizer: typeof d.organizer === 'string' ? d.organizer : '',
    players: strs(d.players),
    names,
    ready,
    invited: strs(d.invited),
    days: num(d.days) ?? 3,
    lobbyHours: num(d.lobbyHours) ?? 6,
    maxPlayers: num(d.maxPlayers) ?? 10,
    soldiers: num(d.soldiers) ?? 100,
    deadline: num(d.deadline),
    startedAt: num(d.startedAt),
    endsAt: num(d.endsAt),
    mapSize: num(d.mapSize),
    why: typeof d.why === 'string' ? d.why : null,
    phase: d.phase === 'claiming' || d.phase === 'holding' ? d.phase : null,
    claimEnds: num(d.claimEnds),
    lockedCount: num(d.lockedCount) ?? 0,
    territories: strs(d.territories),
    map: parseMap(d.map),
    battles: parseBattles(d.battles),
    bonusPoints: nums(d.bonusPoints),
    redeployPasses: nums(d.redeployPasses),
    passExpiry: nums(d.passExpiry),
    attacks: Object.fromEntries(
      Object.entries(rec(d.attacks))
        .map(([k, v]) => [k, parseAttack(k, rec(v))] as const)
        .filter((x): x is readonly [string, Attack] => !!x[1]),
    ),
    progress: nested(d.progress),
    lostAt: nested(d.lostAt),
    waitSkips: nums(d.waitSkips),
    startEquity: nums(d.startEquity),
  };
}
const rec = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
function nums(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(rec(v))) if (typeof n === 'number' && Number.isFinite(n)) out[k] = n;
  return out;
}
const isSide = (x: unknown): x is Side => x === 'bull' || x === 'bear';
function parseBattles(v: unknown): Record<string, Battle> {
  const out: Record<string, Battle> = {};
  for (const [k, raw] of Object.entries(rec(v))) {
    const b = rec(raw);
    if (!['waiting', 'picking', 'running', 'done'].includes(b.stage as string)) continue;
    const sides: Record<string, Side> = {};
    for (const [u, sd] of Object.entries(rec(b.sides))) if (isSide(sd)) sides[u] = sd;
    const picks: Record<string, { side: Side; sym: string }> = {};
    for (const [u, p] of Object.entries(rec(b.picks))) {
      const x = rec(p);
      if (isSide(x.side) && typeof x.sym === 'string') picks[u] = { side: x.side, sym: x.sym };
    }
    out[k] = {
      territory: k,
      kind: b.kind === 'best' ? 'best' : 'duel',
      players: strs(b.players),
      command: typeof b.command === 'string' ? b.command : '',
      stage: b.stage as Battle['stage'],
      wakeAt: num(b.wakeAt),
      pickBy: num(b.pickBy),
      startsAt: num(b.startsAt),
      endsAt: num(b.endsAt),
      sym: typeof b.sym === 'string' ? b.sym : null,
      sides,
      picks,
      start: nums(b.start),
      end: nums(b.end),
      winner: typeof b.winner === 'string' ? b.winner : null,
    };
  }
  return out;
}
function parseMap(v: unknown): Record<string, Territory> {
  const out: Record<string, Territory> = {};
  for (const [k, raw] of Object.entries((v && typeof v === 'object' ? v : {}) as Record<string, unknown>)) {
    const x = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    if (x.state === 'owned' || x.state === 'neutral' || x.state === 'contested')
      out[k] = { state: x.state, owner: typeof x.owner === 'string' ? x.owner : null, contenders: strs(x.contenders) };
  }
  return out;
}

/** Territories on the map for this many players (the server sets it at the start). */
export const mapSize = (players: number) => (players <= 3 ? 6 : players <= 6 ? 8 : 10);
export const isOpen = (w: PrivateWar) => w.status === 'lobby' || w.status === 'active';

export const useWar = (id: string | null) => useLiveDoc(id && WAR_ID_RE.test(id) ? `wars/${id}` : null, (d) => parseWar(id!, d));
export const useMyWars = (uid: string | null) =>
  useLiveQuery(uid ? `wars:${uid}` : null, () => query(collection(db(), 'wars'), where('players', 'array-contains', uid), limit(20)), parseWar);
export const useWarAttackLog = (warId: string | null) =>
  useLiveQuery(warId ? `warAtk:${warId}` : null, () => query(collection(db(), 'wars', warId!, 'attacks'), orderBy('doneAt', 'desc'), limit(10)), parseAttack);
export const useWarInvites = (uid: string | null) =>
  useLiveQuery(uid ? `warInv:${uid}` : null, () => query(collection(db(), 'wars'), where('invited', 'array-contains', uid), limit(20)), parseWar);

export type WarConfig = { name: string; days: number; lobbyHours: number; maxPlayers: number };
type LobbyReq =
  | ({ action: 'create' } & WarConfig)
  | ({ action: 'config'; warId: string } & WarConfig)
  | { action: 'open' | 'join' | 'decline' | 'leave' | 'cancel' | 'start'; warId: string }
  | { action: 'invite'; warId: string; username: string }
  | { action: 'ready'; warId: string; ready: boolean }
  | { action: 'place'; warId: string; soldiers: Record<string, number>; camo: string[]; lock: boolean }
  | { action: 'pick'; warId: string; territory: string; side: Side; sym?: string }
  | { action: 'attack'; warId: string; territory: string; sym: string; side: Side; usePass?: boolean }
  | { action: 'answer'; warId: string; attackId: string; accept: boolean; counter?: string }
  | { action: 'skipWait'; warId: string; territory: string };
export const warLobby = (req: LobbyReq) => callFunction<LobbyReq, { warId: string; war: DocumentData }>('war_lobby', req);
