/**
 * Zelos News: what the News tab shows.
 *
 *   zelos     Zelos updates and announcements
 *   tradewar  Trade War news (new modes, events, seasons)
 *   market    market news: the owner's market posts + official sources (Federal Reserve
 *             releases, SEC 8-K filings for the Zelos stock list), filterable to your watchlist
 *   voices    posts by people who move markets (on X / Truth Social), picked by the owner and
 *             shown as quote cards linking to the original
 *
 * Posts come from Firestore `news/{id}` (written only by the news_save function, for accounts
 * in admins/{uid}) plus a few launch posts bundled below. Official items come from
 * markets/officialNews (refresh_official_news, every 30 minutes). Not financial advice and not a
 * paid headline feed (owner, 2026-10-08).
 */
import { collection, limit, orderBy, query, type DocumentData } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useLiveDoc } from '../../data/liveDoc';
import { useLiveQuery } from '../../data/liveQuery';
import { SYMBOL_RE } from '../../data/markets';
import { callFunction, db } from '../../lib/firebase';
import { readString, writeString } from '../../lib/storage';

export type NewsSection = 'zelos' | 'tradewar' | 'market' | 'voices';
export const SECTIONS: NewsSection[] = ['zelos', 'tradewar', 'market', 'voices'];

export type Voice = { platform: 'x' | 'truth' | 'other'; url: string; author: string; handle: string; quote: string; postedAt: string };

export type NewsPost = {
  id: string;
  section: NewsSection;
  /** publish day, YYYY-MM-DD */
  date: string;
  title: string;
  /** paragraphs */
  body: string[];
  featured?: boolean;
  /** in-app path ('/practice') or an https:// address */
  link?: { to: string; label: string };
  voice?: Voice;
  /** ms; when it was posted (bundled posts: noon on `date`) */
  stamp: number;
};

export type OfficialItem = { id: string; kind: 'fed' | 'filing'; source: string; title: string; detail: string; url: string; at: number; sym?: string; form?: string };

const noon = (day: string) => new Date(`${day}T12:00:00`).getTime();

/** Launch posts, bundled with the app. Newer posts are written from the Post News screen. */
export const BUNDLED: NewsPost[] = [
  {
    id: 'b-2026-10-07-app',
    date: '2026-10-07',
    section: 'zelos',
    featured: true,
    title: 'Welcome to the Zelos Trade War app',
    body: [
      'Zelos now has its own app. Dashboard, Market, Trade War, Alerts and News sit in one bar at the bottom, and switching between them is instant: no page reloads, no losing your place.',
      'Everything in Zelos Trade War uses virtual money. You practice, compete and learn with simulated trades; Zelos never places real trades or holds real money.',
      'More of Zelos moves into the app over the coming weeks. Anything not moved yet opens on the website with the same account.',
    ],
    link: { to: '/trade-war', label: 'Go to Trade War' },
    stamp: noon('2026-10-07'),
  },
  {
    id: 'b-2026-10-07-practice',
    date: '2026-10-07',
    section: 'tradewar',
    title: 'Practice accounts now run on Zelos servers',
    body: [
      'Your $10,000 practice account now lives on our servers instead of in your browser, so balances and leaderboards are the same for everyone and can’t be edited.',
      'Everyone starts fresh with a virtual $10,000. Your old practice account is saved, read-only, and you can see it in Practice.',
      'Orders fill on prices that come in after you place them, and your stop-loss and take-profit keep working even when the app is closed.',
    ],
    link: { to: '/practice', label: 'Open Practice' },
    stamp: noon('2026-10-07'),
  },
  {
    id: 'b-2026-10-07-market',
    date: '2026-10-07',
    section: 'zelos',
    title: 'Market and charts, rebuilt',
    body: [
      'Market shows the Zelos stock list with prices that update every minute during market hours, plus the day’s movers and sectors.',
      'Tap any stock for its chart: 15-minute, hourly, daily and weekly views, candles or line, and a Trade button that opens your practice order ticket.',
    ],
    link: { to: '/markets', label: 'Explore Market' },
    stamp: noon('2026-10-07'),
  },
];

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const safeTo = (v: string) => (/^\/[a-z0-9][a-z0-9\-/]*$/.test(v) && !v.includes('//')) || /^https:\/\/[^\s/@]+\//.test(v + '/');

/** A Firestore news doc → a post, or null if it isn't one (the server validated it; this guards the screen). */
export function parsePost(id: string, d: DocumentData): NewsPost | null {
  if (!SECTIONS.includes(d.section) || !isDay(d.date)) return null;
  const title = str(d.title, 140);
  if (!title) return null;
  const body = Array.isArray(d.body) ? (d.body as unknown[]).map((p) => str(p, 4000)).filter(Boolean).slice(0, 12) : [];
  const post: NewsPost = { id, section: d.section, date: d.date, title, body, featured: d.featured === true, stamp: typeof d.createdAt === 'number' ? d.createdAt : noon(d.date) };
  if (d.link && typeof d.link === 'object' && typeof d.link.to === 'string' && safeTo(d.link.to)) post.link = { to: d.link.to, label: str(d.link.label, 40) || 'Open' };
  const v = d.voice;
  if (d.section === 'voices') {
    if (!v || typeof v !== 'object' || !['x', 'truth', 'other'].includes(v.platform) || typeof v.url !== 'string' || !v.url.startsWith('https://')) return null;
    post.voice = { platform: v.platform, url: v.url, author: str(v.author, 60), handle: str(v.handle, 40), quote: str(v.quote, 1000), postedAt: isDay(v.postedAt) ? v.postedAt : d.date };
  }
  return post;
}

export function parseOfficial(d: DocumentData): OfficialItem[] {
  if (!Array.isArray(d.items)) return [];
  const out: OfficialItem[] = [];
  for (const it of d.items as Record<string, unknown>[]) {
    if (!it || (it.kind !== 'fed' && it.kind !== 'filing') || typeof it.at !== 'number' || typeof it.url !== 'string') continue;
    if (!/^https:\/\/([a-z0-9-]+\.)*(federalreserve\.gov|sec\.gov)\//.test(it.url)) continue;
    const sym = typeof it.sym === 'string' && SYMBOL_RE.test(it.sym) ? it.sym : undefined;
    out.push({ id: String(it.id), kind: it.kind, source: str(it.source, 40), title: str(it.title, 200), detail: str(it.detail, 240), url: it.url, at: it.at, sym, form: str(it.form, 12) || undefined });
  }
  return out;
}

/** All posts (newest first): live ones plus the bundled launch posts. */
export function usePosts() {
  const live = useLiveQuery('news', () => query(collection(db(), 'news'), orderBy('date', 'desc'), limit(60)), parsePost);
  const posts = live.status === 'ready' ? live.data : [];
  return { status: live.status, posts: [...posts, ...BUNDLED].sort((a, b) => b.stamp - a.stamp) };
}

export const useOfficialNews = () => useLiveDoc('markets/officialNews', parseOfficial);

/** Whether this account may post (asks the server; it checks again on every post). */
export function useCanPost(uid: string | null): boolean {
  const [state, setState] = useState<{ uid: string | null; admin: boolean }>({ uid: null, admin: false });
  useEffect(() => {
    if (!uid) return;
    let live = true;
    callFunction<Record<string, never>, { admin: boolean }>('news_can_post', {})
      .then((r) => live && setState({ uid, admin: !!r.admin }))
      .catch(() => live && setState({ uid, admin: false }));
    return () => {
      live = false;
    };
  }, [uid]);
  return state.uid === uid && !!uid && state.admin;
}

export type PostInput = { id?: string; section: NewsSection; title: string; body: string; date?: string; featured?: boolean; link?: { to: string; label: string }; voice?: Omit<Voice, 'postedAt'> & { postedAt?: string } };
export const savePost = (p: PostInput) => callFunction<PostInput, { id: string }>('news_save', p);
export const deletePost = (id: string) => callFunction<{ id: string }, { deleted: boolean }>('news_delete', { id });

// ------------------------------------------------------------------ "new posts" dot
const SEEN_KEY = 'zelosNewsSeenAt';

/** ms of the newest post the viewer has already seen (0 if never). */
export function readSeen(): number {
  return Number(readString(SEEN_KEY)) || 0;
}

function useNewestStamp(): number {
  const live = useLiveQuery('news-newest', () => query(collection(db(), 'news'), orderBy('createdAt', 'desc'), limit(1)), (_id, d) => (typeof d.createdAt === 'number' ? d.createdAt : null));
  const bundled = Math.max(...BUNDLED.map((p) => p.stamp));
  return Math.max(bundled, live.status === 'ready' ? (live.data[0] ?? 0) : 0);
}

/** True while there's a post newer than the last visit to News. Visiting /news marks everything seen. */
export function useNewsUnseen(pathname: string): boolean {
  const onNews = pathname === '/news' || pathname.startsWith('/news/');
  const newest = useNewestStamp();
  useEffect(() => {
    if (onNews && newest) writeString(SEEN_KEY, String(newest));
  }, [onNews, newest]);
  return !onNews && newest > readSeen();
}
