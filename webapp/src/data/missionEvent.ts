/**
 * Missions are counted by the server (functions/missions.py). It sees trades, wins, graded
 * setups and XP itself; the app reports the two it can't see: opening a chart of a stock
 * (analyze) and opening a news item. Fire and forget: a failed report never shows an error.
 * Waits for sign-in to be restored first (a chart opened from a link loads signed-out for a moment).
 */
import { auth, callFunction } from '../lib/firebase';

const sent = new Set<string>();

export function reportMission(ev: 'analyze' | 'news', ref: string): void {
  const key = `${new Date().toDateString()}:${ev}:${ref}`;
  if (sent.has(key)) return;
  sent.add(key);
  void (async () => {
    try {
      const a = auth();
      await a.authStateReady();
      if (!a.currentUser) return sent.delete(key);
      await callFunction('mission_event', { ev, ref });
    } catch {
      sent.delete(key);
    }
  })();
}
