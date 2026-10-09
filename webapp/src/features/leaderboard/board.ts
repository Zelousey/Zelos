/**
 * Trade War leaderboards, from the public practiceProfiles (server-written): all-time by account
 * value, this week / this month / the season by % return (season: also P&L, biggest win, XP,
 * winning streak), and Friends (your friends + squadmates). Same boards as the website.
 */
import { collection, documentId, getCountFromServer, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useLiveQuery } from '../../data/liveQuery';
import { db } from '../../lib/firebase';
import { parseRanked, type Ranked } from '../dashboard/social';
import { monthKey, nyToday, seasonFor, weekKey } from './periods';

export type BoardId = 'all' | 'week' | 'month' | 'season' | 'friends';
export type SeasonCat = 'pct' | 'pnl' | 'bestWin' | 'xp' | 'winStreak';
export const SEASON_CATS: SeasonCat[] = ['pct', 'pnl', 'bestWin', 'xp', 'winStreak'];
export const TOP = 50;

/** The field a board sorts by, and how to read it from a profile. */
export function boardField(board: BoardId, cat: SeasonCat, day = nyToday()): { path: string; value: (r: Ranked) => number | null } {
  if (board === 'week' || board === 'month') {
    const k = board === 'week' ? weekKey(day) : monthKey(day);
    return { path: `p.${k}.pct`, value: (r) => r.p[k]?.pct ?? null };
  }
  if (board === 'season') {
    const s = seasonFor(day);
    const k = s?.id ?? 's0';
    return { path: `p.${k}.${cat}`, value: (r) => r.p[k]?.[cat] ?? null };
  }
  return { path: 'equity', value: (r) => r.equity };
}

export function useBoard(board: BoardId, cat: SeasonCat) {
  const f = boardField(board, cat);
  return useLiveQuery(board === 'friends' ? null : `lb:${f.path}`, () => query(collection(db(), 'practiceProfiles'), orderBy(f.path, 'desc'), limit(TOP)), parseRanked);
}

/** Your place on a board: 1 + how many are ahead (a server count, no list download). */
export function useRank(path: string, value: number | null) {
  const [r, setR] = useState<{ key: string; rank: number | null }>({ key: '', rank: null });
  const key = `${path}|${value}`;
  useEffect(() => {
    if (value == null) return;
    let live = true;
    getCountFromServer(query(collection(db(), 'practiceProfiles'), where(path, '>', value)))
      .then((c) => live && setR({ key, rank: c.data().count + 1 }))
      .catch(() => live && setR({ key, rank: null }));
    return () => {
      live = false;
    };
  }, [path, value, key]);
  return value == null || r.key !== key ? null : r.rank;
}

/** Friends board: your friends and your squadmates, plus you, by % return. */
export function useFriendsBoard(uid: string | null, friends: string[]) {
  const [state, setState] = useState<{ key: string; rows: Ranked[] | null }>({ key: '', rows: null });
  const key = `${uid}|${friends.join(',')}`;
  useEffect(() => {
    if (!uid) return;
    let live = true;
    (async () => {
      const ids = new Set([uid, ...friends]);
      try {
        const sq = await getDocs(query(collection(db(), 'squads'), where('members', 'array-contains', uid), limit(20)));
        sq.forEach((d) => {
          const m = d.data().members;
          if (Array.isArray(m)) for (const x of m) if (typeof x === 'string') ids.add(x);
        });
      } catch {
        /* no squads readable: friends only */
      }
      const list = [...ids].filter((x) => /^[A-Za-z0-9]{10,40}$/.test(x)).slice(0, 100);
      const rows: Ranked[] = [];
      for (let i = 0; i < list.length; i += 10) {
        const snap = await getDocs(query(collection(db(), 'practiceProfiles'), where(documentId(), 'in', list.slice(i, i + 10))));
        snap.forEach((d) => {
          const r = parseRanked(d.id, d.data());
          if (r) rows.push(r);
        });
      }
      rows.sort((a, b) => b.growthPct - a.growthPct);
      if (live) setState({ key, rows });
    })().catch(() => live && setState({ key, rows: [] }));
    return () => {
      live = false;
    };
  }, [uid, key, friends]);
  return uid ? (state.key === key ? state.rows : null) : [];
}
