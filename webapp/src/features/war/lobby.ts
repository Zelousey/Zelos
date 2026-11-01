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
import type { MessageKey } from '../../lib/i18n';

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
  hot: Record<string, string>;
  hotDay: number | null;
  hotPoints: Record<string, number>;
  claims: Record<string, number>;
  reinforced: Record<string, number>;
  rallies: Record<string, number>;
  standings: Standing[];
  standingsAt: number | null;
  results: Standing[] | null;
  ranks: Record<string, string>;
  /** Open War zones (W6b1): a zone is a War for one weekly season, with per-player armies. */
  kind: 'private' | 'zone';
  rookie: boolean;
  troops: Record<string, number>;
  joinedAt: Record<string, number>;
  shieldUntil: Record<string, number>;
};
/** One row of the War Score table (W5c): 60% trading (return, ±10% → 0–100) + 40% land points. */
export type Standing = { uid: string; rank: number; score: number; trading: number; strategy: number; ret: number; points: number; wins: number; forfeit: boolean };
function parseStandings(v: unknown): Standing[] {
  return (Array.isArray(v) ? v : [])
    .map((x) => rec(x))
    .filter((r) => typeof r.uid === 'string' && typeof r.score === 'number')
    .map((r) => ({ uid: r.uid as string, rank: num(r.rank) ?? 0, score: num(r.score) ?? 0, trading: num(r.trading) ?? 0, strategy: num(r.strategy) ?? 0, ret: num(r.ret) ?? 0, points: num(r.points) ?? 0, wins: num(r.wins) ?? 0, forfeit: r.forfeit === true }));
}
/** A War day: 24 hours counted from the War's start (daily limits reset then). */
export const warDay = (w: PrivateWar, now: number) => (w.startedAt != null ? Math.max(0, Math.floor((now - w.startedAt) / 86400000)) : 0); // the screen clock can lag the server
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
    hot: Object.fromEntries(Object.entries(rec(d.hot)).filter((x): x is [string, string] => typeof x[1] === 'string').map(([k, v]) => [k, v.slice(0, 80)])),
    hotDay: num(d.hotDay),
    hotPoints: nums(d.hotPoints),
    claims: nums(d.claims),
    reinforced: nums(d.reinforced),
    rallies: nums(d.rallies),
    standings: parseStandings(d.standings),
    standingsAt: num(d.standingsAt),
    results: d.results && typeof d.results === 'object' ? parseStandings((d.results as Record<string, unknown>).standings) : null,
    ranks: Object.fromEntries(Object.entries(rec(d.ranks)).filter((x): x is [string, string] => typeof x[1] === 'string').map(([k, v]) => [k, v.slice(0, 20)])),
    kind: d.kind === 'zone' ? 'zone' : 'private',
    rookie: d.rookie === true,
    troops: nums(d.troops),
    joinedAt: nums(d.joinedAt),
    shieldUntil: nums(d.shieldUntil),
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
/** Soldiers this player places: their own army in a zone (level armies), else the War's equal army. */
export const armyOf = (w: PrivateWar, uid: string) => w.troops[uid] ?? w.soldiers;
/** A zone drop-in's land can't be attacked for their first 24 hours (functions/warzone.py). */
export const shieldedUntil = (w: PrivateWar, uid: string, now: number) => {
  const until = w.shieldUntil[uid];
  return until != null && until > now ? until : null;
};
/** functions/warzone.py: 10 players a zone; armies drop 10 a day after the claiming hour, never below 50. */
export const ZONE_SIZE = 10;
export const ZONE_LATE_PER_DAY = 10;
export const ZONE_MIN_ARMY = 50;

const STATUS: Record<string, MessageKey> = {
  configuring: 'warl.st.configuring',
  recruiting: 'warl.st.recruiting',
  ready: 'warl.st.ready',
  active: 'warl.st.active',
  ended: 'warl.st.ended',
  cancelled: 'warl.st.cancelled',
};
export const statusKey = (w: PrivateWar): MessageKey => STATUS[w.status === 'lobby' ? (w.stage ?? 'recruiting') : w.status]!;

/** The order of the War Zone cards: running Wars first (your open zone, then private), lobbies, then finished. */
export function sortZones(list: PrivateWar[]): PrivateWar[] {
  const rank = (w: PrivateWar) => (w.status === 'active' ? (w.kind === 'zone' ? 0 : 1) : w.status === 'lobby' ? 2 : 3);
  return [...list].sort((a, b) => rank(a) - rank(b) || (b.startedAt ?? b.deadline ?? 0) - (a.startedAt ?? a.deadline ?? 0));
}

/** One War Zone card's territory line: each territory on the map as yours, an enemy's, neutral or contested. */
export type Holding = 'mine' | 'enemy' | 'neutral' | 'contested';
export function holdings(w: PrivateWar, uid: string): { t: string; h: Holding }[] {
  return w.territories.map((t) => {
    const c = w.map[t];
    const h: Holding = !c || c.state === 'neutral' ? 'neutral' : c.state === 'contested' ? 'contested' : c.owner === uid ? 'mine' : 'enemy';
    return { t, h };
  });
}

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
  | { action: 'skipWait'; warId: string; territory: string }
  | { action: 'claim'; warId: string; territory: string; usePass?: boolean }
  | { action: 'reinforce'; warId: string; soldiers: Record<string, number> }
  | { action: 'rally'; warId: string }
  | { action: 'zoneJoin'; open?: boolean }
  | { action: 'reset' }
  | { action: 'zoneLeave'; warId: string };
export const warLobby = (req: LobbyReq) => callFunction<LobbyReq, { warId: string; war: DocumentData }>('war_lobby', req);
