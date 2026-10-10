/**
 * Battle settings for creating a battle or sending a challenge: the buy-in locks and the game
 * modes, as the server takes them (tw_create / tw_challenge in functions/main.py). The server
 * checks everything again; these copies only decide what the form offers.
 */
import type { MessageKey } from '../../lib/i18n';

type Tier = [maxBuyIn: number, level: number, xp: number, name: string];
const TOP: Tier = [10000, 5, 1000, 'Diamond'];
/** TW_BUYIN_TIERS in functions/main.py. */
export const BUYIN_TIERS: Tier[] = [[1000, 0, 0, ''], [5000, 3, 150, 'Gold'], TOP];
export type Lock = { level: number; xp: number; name: string };

/** null when this XP may host this buy-in, else the level that unlocks it. */
export function buyInLock(buyIn: number, xp: number): Lock | null {
  const [, level, need, name] = BUYIN_TIERS.find(([cap]) => buyIn <= cap) ?? TOP;
  return xp >= need ? null : { level, xp: need, name };
}

// TW_LMS_OPTS and TW_MODE_OPTS in functions/main.py
export const LMS_OPTS = { floorPct: [5, 10, 15, 20, 30], maxLossPct: [2, 5, 10], maxLosses: [3, 5, 10], cutHours: [6, 12, 24, 48] };
export type LmsKey = keyof typeof LMS_OPTS;
export const LMS_KEYS: LmsKey[] = ['floorPct', 'maxLossPct', 'maxLosses', 'cutHours'];
export const DRAFT_PICKS = [2, 3, 5];
export const WHALE_CAPS = [25, 50, 75];
export const WHALE_SHIELDS = [1, 2, 3];

export type Settings = {
  mode: 'classic' | 'lms';
  lms: Record<LmsKey, number>; // 0 = off
  draftPicks: number; // 0 = off
  whaleCap: number; // 0 = off
  whaleShields: number;
  storms: '' | 'rare' | 'often';
  bounties: boolean;
  stops: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  mode: 'classic',
  lms: { floorPct: 10, maxLossPct: 0, maxLosses: 0, cutHours: 0 },
  draftPicks: 0,
  whaleCap: 0,
  whaleShields: 1,
  storms: '',
  bounties: false,
  stops: false,
};

/** Timed cuts must come more often than the battle lasts. */
export const cutOptions = (days: number) => LMS_OPTS.cutHours.filter((h) => h < days * 24);

/** The settings after the battle length changes: a timed cut as long as the battle is dropped. */
export const fitDays = (s: Settings, days: number): Settings => (s.lms.cutHours >= days * 24 ? { ...s, lms: { ...s.lms, cutHours: 0 } } : s);

/** What's wrong with these settings, or null. */
export function settingsError(s: Settings, days: number): MessageKey | null {
  if (s.mode !== 'lms') return null;
  if (!LMS_KEYS.some((k) => s.lms[k])) return 'bs.lms.none';
  if (s.lms.cutHours >= days * 24) return 'bs.lms.cutTooLong';
  return null;
}

export type Payload = {
  lms?: Partial<Record<LmsKey, number>>;
  modes?: { draftPicks?: number; whaleCap?: number; whaleShields?: number; storms?: 'rare' | 'often'; bounties?: true; stops?: true };
};

/** What tw_create / tw_challenge take for these settings (nothing extra for a classic match). */
export function toPayload(s: Settings): Payload {
  const out: Payload = {};
  if (s.mode === 'lms') out.lms = Object.fromEntries(LMS_KEYS.filter((k) => s.lms[k]).map((k) => [k, s.lms[k]]));
  const modes: NonNullable<Payload['modes']> = {};
  if (s.draftPicks) modes.draftPicks = s.draftPicks;
  if (s.whaleCap) Object.assign(modes, { whaleCap: s.whaleCap, whaleShields: s.whaleShields });
  if (s.storms) modes.storms = s.storms;
  if (s.bounties) modes.bounties = true;
  if (s.stops) modes.stops = true;
  if (Object.keys(modes).length) out.modes = modes;
  return out;
}

/** How many game options are on (for the "Game options" summary). */
export const optionsOn = (s: Settings) => [s.draftPicks, s.whaleCap, s.storms, s.bounties, s.stops].filter(Boolean).length;
