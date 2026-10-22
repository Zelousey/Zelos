/**
 * Founder Program communities (owner: the website's practice/communities.html, in the app).
 * Everyone can read communities/{cid} and its members; your own membership
 * (communityMembers/{uid}) is yours only. Every change goes through the server
 * (community_create / community_join / community_leave in functions/main.py), which decides
 * who counts toward the founder's milestones and pays the tokens.
 */
import { collection, limit, orderBy, query, where, type DocumentData } from 'firebase/firestore';
import { useLiveDoc } from '../../data/liveDoc';
import { useLiveQuery } from '../../data/liveQuery';
import { callFunction, db } from '../../lib/firebase';
import { nyToday, weekKey } from '../leaderboard/periods';

// US_STATES in functions/main.py
export const STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
  MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

/** [members, tokens, title, icon]; FOUNDER_TIERS in functions/main.py. */
export const TIERS: [number, number, string, string][] = [
  [5, 120, 'Founder', '🏛️'],
  [10, 80, 'Rising Founder', '⭐'],
  [25, 200, 'Community Builder', '🏗️'],
  [50, 400, 'Community Leader', '🛡️'],
  [100, 750, 'Legendary Founder', '🏆'],
];
export const ACTIVE_DAYS = 2; // FOUNDER_ACTIVE_DAYS

/** The ISO week the server counts joins under (communities/{cid}.weeks.wYYYYWW). */
export const thisWeek = (now = Date.now()) => `w${weekKey(nyToday(now)).replace(/\D/g, '')}`;

export type Community = { id: string; name: string; state: string; founder: string; founderName: string; members: number; counted: number; xp: number; title: string | null; rewarded: number[]; weeks: Record<string, number> };
export type Member = { uid: string; name: string; xp: number; counted: boolean; founder: boolean };
export type Membership = { cid: string; counted: boolean; activeDays: number; founded: string | null };

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const s = (v: unknown, max = 60) => (typeof v === 'string' ? v.slice(0, max) : '');

export function parseCommunity(id: string, d: DocumentData): Community {
  const weeks: Record<string, number> = {};
  if (d.weeks && typeof d.weeks === 'object') for (const [k, v] of Object.entries(d.weeks as Record<string, unknown>)) if (/^w\d{6}$/.test(k)) weeks[k] = n(v);
  return {
    id, name: s(d.name, 40) || id, state: s(d.state, 2), founder: s(d.founder, 40), founderName: s(d.founderName, 40) || 'a trader',
    members: n(d.members), counted: n(d.counted), xp: n(d.xp), title: d.title ? s(d.title, 40) : null,
    rewarded: Array.isArray(d.rewarded) ? (d.rewarded as unknown[]).map(n) : [], weeks,
  };
}
const parseMember = (uid: string, d: DocumentData): Member => ({ uid, name: s(d.name, 40) || 'Trader', xp: n(d.xp), counted: d.counted === true, founder: d.founder === true });
const parseMembership = (d: DocumentData): Membership => ({ cid: s(d.cid, 80), counted: d.counted === true, activeDays: n(d.activeDays), founded: d.founded ? s(d.founded, 80) : null });

/** The next milestone not reached yet (null past 100). */
export const nextTier = (counted: number) => TIERS.find(([need]) => counted < need) ?? null;

export const useTrending = (wk: string) => useLiveQuery(`cm-trend:${wk}`, () => query(collection(db(), 'communities'), orderBy(`weeks.${wk}`, 'desc'), limit(6)), parseCommunity);
export const useBiggest = () => useLiveQuery('cm-top', () => query(collection(db(), 'communities'), orderBy('members', 'desc'), limit(9)), parseCommunity);
export const useByState = (st: string | null) => useLiveQuery(st ? `cm-state:${st}` : null, () => query(collection(db(), 'communities'), where('state', '==', st), limit(60)), parseCommunity);
export const useCommunity = (cid: string | null) => useLiveDoc(cid ? `communities/${cid}` : null, (d) => parseCommunity(cid!, d));
export const useBoard = (cid: string | null) => useLiveQuery(cid ? `cm-board:${cid}` : null, () => query(collection(db(), 'communities', cid!, 'members'), orderBy('xp', 'desc'), limit(50)), parseMember);
export const useMembership = (uid: string | null) => useLiveDoc(uid ? `communityMembers/${uid}` : null, parseMembership);

export const createCommunity = (name: string, state: string) => callFunction<{ name: string; state: string }, { cid: string }>('community_create', { name, state });
export const joinCommunity = (cid: string, sw = false) => callFunction<{ cid: string; switch: boolean }, { cid: string; already?: boolean }>('community_join', { cid, switch: sw });
export const leaveCommunity = () => callFunction<Record<string, never>, { left: boolean }>('community_leave', {});
/** The server's "you're in another community" answer starts with SWITCH: and asks to confirm a switch. */
export const isSwitchAsk = (msg: string) => msg.startsWith('SWITCH:');
