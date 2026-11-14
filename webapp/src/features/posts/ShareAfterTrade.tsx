/**
 * After every closed Solo trade the share card pops up (owner 2026-11-13: "automatically on", with
 * a switch in Settings to turn it off). Watches your recent history while you're signed in; trades
 * that closed before this visit don't pop up. Remembered per account on this device.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { readString, writeString } from '../../lib/storage';
import { useIdentity } from '../dashboard/social';
import { usePracticeHistory } from '../practice/account';
import { soloDraft, type Draft } from './posts';
import { ShareSheet } from './ShareSheet';

export const SHARE_AFTER_KEY = 'zelosShareAfterTrade';
export const shareAfterOn = () => readString(SHARE_AFTER_KEY) !== 'off';

export function ShareAfterTrade() {
  const { user, isReal } = useAuth();
  const [on] = useState(shareAfterOn);
  const uid = isReal && user ? user.uid : null;
  return uid ? <Watch uid={uid} auto={on} /> : null;
}

/** auto: pop up after each trade (the Settings switch). ?share=<history id> (the closed-trade
 *  notification, owner 2026-11-14) opens that trade's card either way. */
function Watch({ uid, auto }: { uid: string; auto: boolean }) {
  const [params, setParams] = useSearchParams();
  const asked = params.get('share');
  const history = usePracticeHistory(uid);
  const ident = useIdentity(uid);
  const [draft, setDraft] = useState<Draft | null>(null);
  const seenKey = `zelosShareSeen:${uid}`;
  useEffect(() => {
    if (!asked || !history.ready) return;
    const h = history.items.find((x) => x.id === asked && x.kind === 'trade');
    const next = new URLSearchParams(params);
    next.delete('share');
    setParams(next, { replace: true });
    if (!h) return;
    const id = window.setTimeout(() => setDraft(soloDraft(h, history.items, { name: ident.status === 'ready' ? ident.data.name : '', username: ident.status === 'ready' ? ident.data.username : null })), 0);
    return () => window.clearTimeout(id);
  }, [asked, history, ident, params, setParams]);
  useEffect(() => {
    if (!auto || !history.ready) return;
    const trades = history.items.filter((h) => h.kind === 'trade' && h.entry != null && h.exit != null);
    const newest = trades.reduce((m, h) => Math.max(m, h.at), 0);
    const seen = Number(readString(seenKey) ?? 0);
    if (!seen) {
      // first visit: nothing old pops up
      writeString(seenKey, String(Math.max(newest, Date.now() - 60_000)));
      return;
    }
    const fresh = trades.filter((h) => h.at > seen).sort((a, b) => b.at - a.at)[0];
    if (!fresh || !shareAfterOn()) return;
    writeString(seenKey, String(newest));
    const id = window.setTimeout(() => setDraft(soloDraft(fresh, history.items, { name: ident.status === 'ready' ? ident.data.name : '', username: ident.status === 'ready' ? ident.data.username : null })), 0);
    return () => window.clearTimeout(id);
  }, [auto, history, ident, seenKey]);
  return <ShareSheet draft={draft} onClose={() => setDraft(null)} />;
}
