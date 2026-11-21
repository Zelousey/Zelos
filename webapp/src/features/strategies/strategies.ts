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
    // owner 2026-11-19: the short-term pick, almost every market day (functions/scanner.py)
    tagline: 'A short-term pick almost every market day: the best pullback in an uptrend, with the stop and targets set, held up to 5 days.',
    looksFor: ['A stock in an uptrend', 'A pullback toward its 20-day average', 'The best kind of pullback that day, strongest stock first', 'A stop one normal day’s range under, first target 1.5 times the risk'],
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
    // owner 2026-11-19: run by the server; bull call butterflies (functions/three_leg_scan.py)
    tagline: 'One options trade built from three positions (a bull call butterfly), with the cost, the most it can make or lose, and the breakevens worked out for you.',
    looksFor: ['A clean pullback or breakout with room to rise', 'Three calls on one expiration about 3 weeks out: buy, sell two, buy', 'The most it can make at least twice what it costs', 'Breakevens and the profit zone at expiration'],
    avoids: ['Small or thinly traded stocks', '0DTE and same-week expirations', 'Trades where the most you can lose isn’t known up front'],
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
/** passes: sold before 2026-11-10 (live + after the close); passesClose: sold since (after the close only). */
export type WalletDoc = { balance: number; passes: Partial<Record<StrategyId, number>>; passesClose: Partial<Record<StrategyId, number>>; mindQuotes: Record<string, number> };
export function parseWallet(d: DocumentData): WalletDoc {
  const read = (raw: unknown) => {
    const out: WalletDoc['passes'] = {};
    const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    for (const s of STRATEGIES) {
      const until = num(p[s.id]);
      if (until) out[s.id] = until;
    }
    return out;
  };
  const passes = read(d.passes);
  const passesClose = read(d.passesClose);
  const mindQuotes: Record<string, number> = {};
  for (const [k, v] of Object.entries((d.mindQuotes && typeof d.mindQuotes === 'object' ? d.mindQuotes : {}) as Record<string, unknown>)) {
    const until = num(v);
    if (until && /^[a-z-]{2,30}$/.test(k)) mindQuotes[k] = until;
  }
  return { balance: Math.max(0, Math.floor(num(d.balance) ?? 0)), passes, passesClose, mindQuotes };
}
export const useWalletDoc = (uid: string | null) => useLiveDoc(uid ? `wallets/${uid}` : null, parseWallet);
/** The end of your pass for this strategy, of either kind (null: none). */
export const passUntil = (w: WalletDoc | null, id: StrategyId, now: number) => {
  const u = Math.max(w?.passes[id] ?? 0, w?.passesClose[id] ?? 0);
  return u > now ? u : null;
};
/** True when your pass is the after-the-close kind (sold from 2026-11-10). */
export const passIsAfterClose = (w: WalletDoc | null, id: StrategyId, now: number) => !((w?.passes[id] ?? 0) > now) && (w?.passesClose[id] ?? 0) > now;

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
