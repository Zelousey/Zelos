/**
 * Strategies (the Zelos scanners) in the app: what each one looks for, its recent alerts,
 * 7-day passes and tokens. Every balance change is a server call (functions/main.py
 * tokens_*); the wallet doc is read-only for its owner. Alerts are public teasers until the
 * trade finishes (alertsLocked holds the full alert, unlocked with tokens on the website).
 */
import { collection, limit, orderBy, query, type DocumentData } from 'firebase/firestore';
import { useLiveDoc } from '../../data/liveDoc';
import { useLiveQuery } from '../../data/liveQuery';
import { callFunction, db } from '../../lib/firebase';

export type StrategyId = 'swing-trader' | 'breakout-rider' | 'options-scanner';
export type Strategy = { id: StrategyId; name: string; tagline: string; looksFor: string[]; avoids: string[]; page: string; tone: 'accent' | 'gold' | 'violet' };

// Same three as functions/main.py ALLOWED_STRATEGIES; copy from the website's strategy pages.
export const STRATEGIES: Strategy[] = [
  {
    id: 'swing-trader',
    name: 'Swing Trader',
    tagline: 'Pullbacks in a healthy uptrend, alerted only when selling pressure looks like it’s fading and the risk/reward earns it.',
    looksFor: ['A stock in a clear uptrend', 'A pullback or bull flag toward support', 'Selling pressure fading, with room to the next target', 'A stop and two targets set before entry'],
    avoids: ['Downtrends and broken charts', 'Setups where the risk is bigger than the reward'],
    page: 'swing-trader.html',
    tone: 'accent',
  },
  {
    id: 'breakout-rider',
    name: 'Breakout Rider',
    tagline: 'Waits for a stock to clear resistance and hold above it (not just spike) before it ever gets on the list.',
    looksFor: ['A flat base or ascending triangle', 'A clean move through resistance', 'The breakout holding, with volume behind it', 'A stop under the breakout level'],
    avoids: ['One-candle spikes that fade', 'Breakouts in a weak market'],
    page: 'breakout-rider.html',
    tone: 'gold',
  },
  {
    id: 'options-scanner',
    name: 'Options Scanner',
    tagline: 'Turns the day’s best stock setup into one long call or put idea, only if it clears the bar.',
    looksFor: ['A strong bullish or bearish setup in an optionable stock', 'One long call or long put, with a rule for strike and expiration'],
    avoids: ['Spreads and multi-leg trades', 'Selling options, 0DTE and weeklies'],
    page: 'options-scanner.html',
    tone: 'violet',
  },
];
export const strategy = (id: string) => STRATEGIES.find((x) => x.id === id);

// ------------------------------------------------------------------ alerts
export type Alert = { id: string; strategy: StrategyId; at: number; status: string; label: string | null; direction: string | null; score: number | null; scoreMax: number | null; outcome: string | null; locked: boolean; ticker: string | null };

const ms = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Date.parse(v) || 0;
  const ts = v as { toMillis?: () => number } | null;
  return typeof ts?.toMillis === 'function' ? ts.toMillis() : 0;
};
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);

/** A public alert, or null for anything that isn't a real alert of a known strategy (test docs, no-setup days). */
export function parseAlert(id: string, d: DocumentData): Alert | null {
  const s = STRATEGIES.find((x) => x.id === d.strategy);
  const status = typeof d.status === 'string' ? d.status : '';
  if (!s || /^test/i.test(status) || /^test/i.test(id)) return null;
  return {
    id,
    strategy: s.id,
    at: ms(d.createdAt),
    status,
    label: str(d.setupLabel, 60),
    direction: str(d.direction, 12),
    score: num(d.score),
    scoreMax: num(d.scoreMax),
    outcome: str(d.outcome, 24),
    locked: d.locked === true,
    ticker: d.locked === true ? null : str(d.ticker, 10),
  };
}
export const useAlerts = () => useLiveQuery('alerts:recent', () => query(collection(db(), 'alerts'), orderBy('createdAt', 'desc'), limit(40)), parseAlert);
export const alertUrl = (id: string) => `alert.html?id=${encodeURIComponent(id)}`;

// ------------------------------------------------------------------ tokens
export type WalletDoc = { balance: number; passes: Partial<Record<StrategyId, number>> };
export function parseWallet(d: DocumentData): WalletDoc {
  const passes: WalletDoc['passes'] = {};
  const p = (d.passes && typeof d.passes === 'object' ? d.passes : {}) as Record<string, unknown>;
  for (const s of STRATEGIES) {
    const until = num(p[s.id]);
    if (until) passes[s.id] = until;
  }
  return { balance: Math.max(0, Math.floor(num(d.balance) ?? 0)), passes };
}
export const useWalletDoc = (uid: string | null) => useLiveDoc(uid ? `wallets/${uid}` : null, parseWallet);
export const passUntil = (w: WalletDoc | null, id: StrategyId, now: number) => {
  const u = w?.passes[id];
  return u && u > now ? u : null;
};

export type Pack = { id: string; tokens: number; cents: number };
export type WalletInfo = { balance: number; welcomed: boolean; canBuy: boolean; needsVerify: boolean; prices: { pass: number; passDays: number; unlock: number; unlockClosed: number; welcome: number }; packs: Pack[] };
/** Makes the wallet on first use (and gives the welcome tokens once), returns prices and packs. */
export const openWallet = () => callFunction<Record<string, never>, WalletInfo>('tokens_wallet', {});
export const buyPass = (id: StrategyId) => callFunction<{ kind: 'pass'; strategy: StrategyId }, { balance: number; charged: number }>('tokens_spend', { kind: 'pass', strategy: id });
export const checkout = (pack: string) => callFunction<{ pack: string }, { url: string }>('tokens_checkout', { pack });
export const safeCheckout = (url: unknown): url is string => typeof url === "string" && /^https:\/\/[^/]+\//.test(url); // only ever send people to an https page
