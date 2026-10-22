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

export type StrategyId = 'swing-trader' | 'breakout-rider' | 'options-scanner' | 'three-leg';
export type Strategy = { id: StrategyId; name: string; tagline: string; looksFor: string[]; avoids: string[]; page: string; tone: 'accent' | 'gold' | 'violet' };

// Same as functions/main.py ALLOWED_STRATEGIES; copy from the website's strategy pages.
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
  {
    id: 'three-leg',
    name: '3-Leg Options',
    tagline: 'One options trade built from three positions (a butterfly or a jade lizard), with the cost, the most it can make or lose, and the breakevens worked out for you.',
    looksFor: ['A stock likely to settle near a price by expiration', 'Three legs on one expiration: buy, sell and buy (or a credit jade lizard)', 'A defined cost, max profit and max loss before you enter', 'Breakevens and the profit zone at expiration'],
    avoids: ['Earnings inside the trade', 'Thin options with wide bid/ask spreads', '0DTE and weeklies'],
    page: '',
    tone: 'violet',
  },
];
export const strategy = (id: string) => STRATEGIES.find((x) => x.id === id);

// ------------------------------------------------------------------ alerts
/** outcome = {result, exitPrice, closedAt, notes} on the server (functions/main.py _apply_one_outcome). */
export const OUTCOMES: Record<string, string> = { 'hit-target': 'Hit target', 'stopped-out': 'Stopped out', open: 'Still open', expired: 'Expired', 'no-trade': 'No trade taken' };
export const outcomeLabel = (o: unknown): string | null => {
  const r = o && typeof o === 'object' ? (o as { result?: unknown }).result : o;
  return typeof r === 'string' && OUTCOMES[r] ? OUTCOMES[r] : null;
};
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
    outcome: outcomeLabel(d.outcome),
    locked: d.locked === true,
    ticker: d.locked === true ? null : str(d.ticker, 10),
  };
}
export const useAlerts = () => useLiveQuery('alerts:recent', () => query(collection(db(), 'alerts'), orderBy('createdAt', 'desc'), limit(40)), parseAlert);
export const alertUrl = (id: string) => `alert.html?id=${encodeURIComponent(id)}`;

// ------------------------------------------------------------------ tokens
/** mindQuotes: Hall of Minds daily quotes, {figure id: until ms} (functions/minds.py). */
export type WalletDoc = { balance: number; passes: Partial<Record<StrategyId, number>>; mindQuotes: Record<string, number> };
export function parseWallet(d: DocumentData): WalletDoc {
  const passes: WalletDoc['passes'] = {};
  const p = (d.passes && typeof d.passes === 'object' ? d.passes : {}) as Record<string, unknown>;
  for (const s of STRATEGIES) {
    const until = num(p[s.id]);
    if (until) passes[s.id] = until;
  }
  const mindQuotes: Record<string, number> = {};
  for (const [k, v] of Object.entries((d.mindQuotes && typeof d.mindQuotes === 'object' ? d.mindQuotes : {}) as Record<string, unknown>)) {
    const until = num(v);
    if (until && /^[a-z-]{2,30}$/.test(k)) mindQuotes[k] = until;
  }
  return { balance: Math.max(0, Math.floor(num(d.balance) ?? 0)), passes, mindQuotes };
}
export const useWalletDoc = (uid: string | null) => useLiveDoc(uid ? `wallets/${uid}` : null, parseWallet);
export const passUntil = (w: WalletDoc | null, id: StrategyId, now: number) => {
  const u = w?.passes[id];
  return u && u > now ? u : null;
};

export type Pack = { id: string; tokens: number; cents: number };
export type WalletInfo = { balance: number; welcomed: boolean; canBuy: boolean; needsVerify: boolean; prices: { pass: number; passPrices?: Partial<Record<StrategyId, number>>; passDays: number; dayPass?: number; dayPassPrices?: Partial<Record<StrategyId, number>>; unlock: number; unlockClosed: number; welcome: number }; packs: Pack[] };
export type PassDays = 1 | 7;
/** Tokens for a pass to this strategy: 7 days, or 1 (owner 2026-10-22). The 3-Leg pass costs more (owner 2026-10-15).
 *  The server's prices win; these defaults only show before the wallet loads. */
export const passPrice = (info: WalletInfo | null, id: StrategyId, days: PassDays = 7) =>
  days === 1
    ? (info?.prices.dayPassPrices?.[id] ?? (id === 'three-leg' ? 45 : (info?.prices.dayPass ?? 30)))
    : (info?.prices.passPrices?.[id] ?? (id === 'three-leg' ? 180 : (info?.prices.pass ?? 120)));
/** Makes the wallet on first use (and gives the welcome tokens once), returns prices and packs. */
export const openWallet = () => callFunction<Record<string, never>, WalletInfo>('tokens_wallet', {});
export const buyPass = (id: StrategyId, days: PassDays = 7) =>
  callFunction<{ kind: 'pass'; strategy: StrategyId; days: PassDays }, { balance: number; charged: number }>('tokens_spend', { kind: 'pass', strategy: id, days });
export const checkout = (pack: string) => callFunction<{ pack: string }, { url: string }>('tokens_checkout', { pack });
export const safeCheckout = (url: unknown): url is string => typeof url === "string" && /^https:\/\/[^/]+\//.test(url); // only ever send people to an https page
