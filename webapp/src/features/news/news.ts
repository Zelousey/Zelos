/**
 * Zelos News: announcements about the app itself (features, updates, Trade War, events).
 * Not a financial-news feed and not investment advice.
 *
 * For now the posts live here, in the app bundle: adding one = adding an entry at the top
 * of NEWS and shipping. A "Post news" screen backed by the server needs a new Firestore
 * collection and rules, which is waiting on the owner's approval (PROJECT_STATE.md).
 * Post text is English only for now (the catalogue in lib/i18n.ts covers the UI around it).
 */
import { useEffect } from 'react';
import { readString, writeString } from '../../lib/storage';

export type NewsCategory = 'updates' | 'announcements' | 'tradewar' | 'events' | 'features' | 'community';

export type NewsPost = {
  id: string;
  /** publish day, YYYY-MM-DD */
  date: string;
  category: NewsCategory;
  title: string;
  /** paragraphs */
  body: string[];
  featured?: boolean;
  /** optional in-app destination, e.g. '/practice' */
  link?: { to: string; label: string };
};

export const CATEGORIES: NewsCategory[] = ['updates', 'announcements', 'tradewar', 'events', 'features', 'community'];

/** Newest first. */
export const NEWS: NewsPost[] = [
  {
    id: '2026-10-07-app',
    date: '2026-10-07',
    category: 'features',
    featured: true,
    title: 'Welcome to the Zelos Trade War app',
    body: [
      'Zelos now has its own app. Dashboard, Market, Trade War, Alerts and News sit in one bar at the bottom, and switching between them is instant: no page reloads, no losing your place.',
      'Everything in Zelos Trade War uses virtual money. You practice, compete and learn with simulated trades; Zelos never places real trades or holds real money.',
      'More of Zelos moves into the app over the coming weeks. Anything not moved yet opens on the website with the same account.',
    ],
    link: { to: '/trade-war', label: 'Go to Trade War' },
  },
  {
    id: '2026-10-07-practice',
    date: '2026-10-07',
    category: 'tradewar',
    title: 'Practice accounts now run on Zelos servers',
    body: [
      'Your $10,000 practice account now lives on our servers instead of in your browser, so balances and leaderboards are the same for everyone and can’t be edited.',
      'Everyone starts fresh with a virtual $10,000. Your old practice account is saved, read-only, and you can see it in Practice.',
      'Orders fill on prices that come in after you place them, and your stop-loss and take-profit keep working even when the app is closed.',
    ],
    link: { to: '/practice', label: 'Open Practice' },
  },
  {
    id: '2026-10-07-market',
    date: '2026-10-07',
    category: 'updates',
    title: 'Market and charts, rebuilt',
    body: [
      'Market shows the Zelos stock list with prices that refresh every 15 minutes during market hours, plus the day’s movers and sectors.',
      'Tap any stock for its chart: 15-minute, hourly, daily and weekly views, candles or line, and a Trade button that opens your practice order ticket.',
    ],
    link: { to: '/markets', label: 'Explore Market' },
  },
];

const SEEN_KEY = 'zelosNewsSeen';

/** The newest post's date the viewer has already seen ('' if never). */
export function readSeen(): string {
  return readString(SEEN_KEY) ?? '';
}

export function latestDate(posts: NewsPost[] = NEWS): string {
  return posts.reduce((d, p) => (p.date > d ? p.date : d), '');
}

/** True while there's a post newer than the last visit to News. Visiting /news marks everything seen. */
export function useNewsUnseen(pathname: string): boolean {
  const onNews = pathname === '/news' || pathname.startsWith('/news/');
  const latest = latestDate();
  useEffect(() => {
    if (onNews && latest) writeString(SEEN_KEY, latest);
  }, [onNews, latest]);
  return !onNews && latest > readSeen();
}
