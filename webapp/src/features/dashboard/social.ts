/**
 * Trade War social data for the dashboard, all server-written:
 * - practiceProfiles: the public leaderboard (functions/practice.py build_profile)
 * - traders/{uid}: public name + avatar
 * - tradeWars: matches you're in (functions/main.py tw_*), readable when signed in
 */
import { collection, getCountFromServer, limit, orderBy, query, where, type DocumentData } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useLiveDoc } from '../../data/liveDoc';
import { useLiveQuery } from '../../data/liveQuery';
import { db } from '../../lib/firebase';
import { parseDetail, type ProfileDetail } from '../profile/detail';

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, max = 60) => (typeof v === 'string' ? v.slice(0, max) : '');
// only https images (Google photos, our storage) or an uploaded data: image
const safeImg = (v: unknown) => (typeof v === 'string' && (/^https:\/\//.test(v) || /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v)) ? v : null);

/** One period's numbers in practiceProfiles.p (functions/practice.py build_profile): pnl and pct, plus xp/bestWin/winStreak in a season. */
export type PeriodStats = Record<string, number>;
export type Ranked = { uid: string; name: string; username: string | null; photo: string | null; equity: number; growthPct: number; netPnl: number; level: number; xp: number; trades: number; winRate: number; tradeStreak: number; achievements: string[]; p: Record<string, PeriodStats>; detail?: ProfileDetail };

function parsePeriods(v: unknown): Record<string, PeriodStats> {
  const out: Record<string, PeriodStats> = {};
  if (!v || typeof v !== 'object') return out;
  for (const [k, row] of Object.entries(v as Record<string, unknown>).slice(0, 40)) {
    if (!/^[wms][0-9_]{1,10}$/.test(k) || !row || typeof row !== 'object') continue;
    const r: PeriodStats = {};
    for (const [f, x] of Object.entries(row as Record<string, unknown>)) if (typeof x === 'number' && Number.isFinite(x)) r[f] = x;
    out[k] = r;
  }
  return out;
}

export function parseRanked(uid: string, d: DocumentData): Ranked | null {
  if (typeof d.equity !== 'number' || !Number.isFinite(d.equity)) return null;
  return {
    uid,
    name: str(d.name, 24) || 'Trader',
    photo: safeImg(d.photo),
    equity: d.equity,
    growthPct: num(d.growthPct),
    netPnl: num(d.netPnl, d.equity - 10000),
    username: /^[a-z0-9_]{3,20}$/.test(String(d.username ?? '')) ? String(d.username) : null,
    level: Math.max(0, Math.min(10, Math.floor(num(d.level)))),
    xp: Math.max(0, Math.floor(num(d.xp))),
    trades: Math.max(0, Math.floor(num(d.trades))),
    winRate: num(d.winRate),
    tradeStreak: Math.max(0, Math.floor(num(d.tradeStreak))),
    p: parsePeriods(d.p),
    achievements: Array.isArray(d.achievements) ? (d.achievements as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 80) : [],
    detail: parseDetail(d),
  };
}

/** The top 5 practice accounts by value, live. */
export const useTopTraders = () => useLiveQuery('top5', () => query(collection(db(), 'practiceProfiles'), orderBy('equity', 'desc'), limit(5)), parseRanked);

/** Your own public profile (exists once your practice account has been published). */
export const useMyProfile = (uid: string | null) => useLiveDoc(uid ? `practiceProfiles/${uid}` : null, (d) => parseRanked(uid ?? '', d));

/** Your overall rank: how many accounts are worth more than yours, plus one (one cheap count query). */
export function useMyRank(equity: number | null): number | null {
  const [rank, setRank] = useState<{ equity: number; rank: number } | null>(null);
  useEffect(() => {
    if (equity == null) return;
    let live = true;
    getCountFromServer(query(collection(db(), 'practiceProfiles'), where('equity', '>', equity)))
      .then((r) => live && setRank({ equity, rank: r.data().count + 1 }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [equity]);
  return rank && rank.equity === equity ? rank.rank : null;
}

export type Identity = { name: string; username: string | null; avatar: string | null; bio: string | null };
export const useIdentity = (uid: string | null) =>
  useLiveDoc(uid ? `traders/${uid}` : null, (d): Identity => ({ name: str(d.name, 24), username: /^[a-z0-9_]{3,20}$/.test(String(d.username ?? '')) ? String(d.username) : null, avatar: safeImg(d.avatar) ?? safeImg(d.photo), bio: str(d.bio, 160).trim() || null }));

export type War = { id: string; name: string; status: 'lobby' | 'draft' | 'active' | 'ended'; players: number; maxPlayers: number; endAt: number; createdAt: number; myRank: number | null; of: number };

const STATUSES = ['lobby', 'draft', 'active', 'ended'] as const;
export function parseWar(uid: string) {
  return (id: string, d: DocumentData): War | null => {
    const status = STATUSES.find((s) => s === d.status);
    if (!status) return null; // cancelled or unknown
    const results = Array.isArray(d.results) ? (d.results as Record<string, unknown>[]) : [];
    const me = results.find((r) => r && r.uid === uid);
    return {
      id,
      name: str(d.name, 40) || 'Trade War',
      status,
      players: Array.isArray(d.players) ? d.players.length : 0,
      maxPlayers: num(d.maxPlayers),
      endAt: num(d.endAt),
      createdAt: num(d.createdAt),
      myRank: me ? num(me.rank, 0) || null : null,
      of: results.length,
    };
  };
}

const ORDER = { active: 0, draft: 1, lobby: 2, ended: 3 } as const;
export const sortWars = (ws: War[]) => [...ws].sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.createdAt - a.createdAt);

/** Trade Wars you're in, live: the running ones first, then lobbies, then finished ones. */
export function useMyWars(uid: string | null) {
  return useLiveQuery(uid ? `wars:${uid}` : null, () => query(collection(db(), 'tradeWars'), where('players', 'array-contains', uid), limit(20)), parseWar(uid ?? ''));
}
