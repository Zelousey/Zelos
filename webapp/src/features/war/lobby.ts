/**
 * Private Wars with friends (W3, docs/WAR_DESIGN.md §8): reads wars/{id} (written only by the
 * server, functions/warlobby.py) and calls war_lobby for every action. The server checks
 * everything: who may invite, join, lock in or start, and the deadlines.
 *
 *   configuring → recruiting → ready → (start, once) active → ended;  or cancelled
 */
import { collection, limit, query, where, type DocumentData } from 'firebase/firestore';
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
};

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
  };
}

/** Territories on the map for this many players (the server sets it at the start). */
export const mapSize = (players: number) => (players <= 3 ? 6 : players <= 6 ? 8 : 10);
export const isOpen = (w: PrivateWar) => w.status === 'lobby' || w.status === 'active';

export const useWar = (id: string | null) => useLiveDoc(id && WAR_ID_RE.test(id) ? `wars/${id}` : null, (d) => parseWar(id!, d));
export const useMyWars = (uid: string | null) =>
  useLiveQuery(uid ? `wars:${uid}` : null, () => query(collection(db(), 'wars'), where('players', 'array-contains', uid), limit(20)), parseWar);
export const useWarInvites = (uid: string | null) =>
  useLiveQuery(uid ? `warInv:${uid}` : null, () => query(collection(db(), 'wars'), where('invited', 'array-contains', uid), limit(20)), parseWar);

export type WarConfig = { name: string; days: number; lobbyHours: number; maxPlayers: number };
type LobbyReq =
  | ({ action: 'create' } & WarConfig)
  | ({ action: 'config'; warId: string } & WarConfig)
  | { action: 'open' | 'join' | 'decline' | 'leave' | 'cancel' | 'start'; warId: string }
  | { action: 'invite'; warId: string; username: string }
  | { action: 'ready'; warId: string; ready: boolean };
export const warLobby = (req: LobbyReq) => callFunction<LobbyReq, { warId: string; war: DocumentData }>('war_lobby', req);
