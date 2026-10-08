/**
 * Major stock exchanges and whether each is in its regular session right now, from its own
 * local time zone. Same table and rules as the classic globe (zelos-globe.js EXCHANGES /
 * exchangeStatus); exchanges.test.ts fails if the two drift apart. Public holidays and
 * half-days are not modelled, so the UI says "regular hours".
 */
export type Exchange = { id: string; name: string; city: string; tz: string; s: [number, number][]; days?: number[] };
export type ExchangeStatus = { id: string; name: string; city: string; open: boolean; label: string };

export const EXCHANGES: Exchange[] = [
  { id: 'NYSE', name: 'NYSE / Nasdaq', city: 'New York', tz: 'America/New_York', s: [[570, 960]] },
  { id: 'TSX', name: 'TSX', city: 'Toronto', tz: 'America/Toronto', s: [[570, 960]] },
  { id: 'BMV', name: 'BMV', city: 'Mexico City', tz: 'America/Mexico_City', s: [[510, 900]] },
  { id: 'B3', name: 'B3', city: 'São Paulo', tz: 'America/Sao_Paulo', s: [[600, 1020]] },
  { id: 'LSE', name: 'LSE', city: 'London', tz: 'Europe/London', s: [[480, 990]] },
  { id: 'ENX', name: 'Euronext', city: 'Paris', tz: 'Europe/Paris', s: [[540, 1050]] },
  { id: 'XETRA', name: 'Xetra', city: 'Frankfurt', tz: 'Europe/Berlin', s: [[540, 1050]] },
  { id: 'SIX', name: 'SIX', city: 'Zurich', tz: 'Europe/Zurich', s: [[540, 1050]] },
  { id: 'JSE', name: 'JSE', city: 'Johannesburg', tz: 'Africa/Johannesburg', s: [[540, 1020]] },
  { id: 'TADAWUL', name: 'Tadawul', city: 'Riyadh', tz: 'Asia/Riyadh', s: [[600, 900]], days: [0, 1, 2, 3, 4] },
  { id: 'NSE', name: 'NSE', city: 'Mumbai', tz: 'Asia/Kolkata', s: [[555, 930]] },
  { id: 'SSE', name: 'SSE', city: 'Shanghai', tz: 'Asia/Shanghai', s: [[570, 690], [780, 900]] },
  { id: 'HKEX', name: 'HKEX', city: 'Hong Kong', tz: 'Asia/Hong_Kong', s: [[570, 720], [780, 960]] },
  { id: 'TSE', name: 'TSE', city: 'Tokyo', tz: 'Asia/Tokyo', s: [[540, 690], [750, 930]] },
  { id: 'KRX', name: 'KRX', city: 'Seoul', tz: 'Asia/Seoul', s: [[540, 930]] },
  { id: 'SGX', name: 'SGX', city: 'Singapore', tz: 'Asia/Singapore', s: [[540, 720], [780, 1020]] },
  { id: 'ASX', name: 'ASX', city: 'Sydney', tz: 'Australia/Sydney', s: [[600, 960]] },
];

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function localParts(tz: string, date: Date): { wd: number; min: number } | null {
  try {
    const o: Record<string, string> = {};
    for (const p of new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)) o[p.type] = p.value;
    return { wd: WD[o.weekday!] ?? -1, min: (parseInt(o.hour!, 10) % 24) * 60 + parseInt(o.minute!, 10) };
  } catch {
    return null;
  }
}

export function exchangeStatus(x: Exchange, date: Date): ExchangeStatus {
  const base = { id: x.id, name: x.name, city: x.city };
  const lp = localParts(x.tz, date);
  if (!lp) return { ...base, open: false, label: 'Hours unavailable' };
  if (!(x.days ?? [1, 2, 3, 4, 5]).includes(lp.wd)) return { ...base, open: false, label: 'Closed for the weekend' };
  for (const [a, b] of x.s) if (lp.min >= a && lp.min < b) return { ...base, open: true, label: `Open · closes ${hhmm(b)} local` };
  for (let j = 0; j < x.s.length; j++) if (lp.min < x.s[j]![0]) return { ...base, open: false, label: `${j ? 'Lunch break' : 'Pre-open'} · opens ${hhmm(x.s[j]![0])} local` };
  return { ...base, open: false, label: `Closed · opens ${hhmm(x.s[0]![0])} local` };
}

export const exchangesNow = (date = new Date()) => EXCHANGES.map((x) => exchangeStatus(x, date));
