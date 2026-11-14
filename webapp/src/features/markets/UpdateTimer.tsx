/**
 * When the next prices land (owner 2026-11-14: people sat watching a position, waiting, and
 * thought the site was frozen). A small ring fills up to the next price update and counts down.
 *
 * The schedule is the server's real one (functions/main.py refresh_quotes): Day trading stocks
 * every `every` minutes (1), the rest every `everySlow` minutes (15) from 9:31 (:01, :16, :31, :46),
 * plus a few seconds to fetch. For an account the ring follows the soonest of its stocks, and says
 * how often each kind updates. Nothing while the market is closed (the status line says so).
 */
import { useQuotes } from '../../data/markets';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import s from './UpdateTimer.module.css';

const LAG = 20_000; // the update runs on the minute; prices land within ~20 s
const OPEN_MIN = 9 * 60 + 31;

/** The next update for a refresh every `mins` minutes, and how far along we are (0-1). */
export function nextUpdate(now: number, mins: number): { at: number; left: number; done: number } {
  const step = mins * 60_000;
  // the server runs at 9:31 ET and then every `mins` minutes: 9:31, 9:46, 10:01… (minute 571 of the day)
  const off = ((OPEN_MIN % mins) * 60_000) % step + LAG;
  let at = Math.ceil((now - off) / step) * step + off;
  if (at <= now) at += step;
  const left = at - now;
  return { at, left, done: 1 - left / step };
}

const mmss = (ms: number) => {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

/** syms: what this screen shows (one stock, or the stocks in your account). */
export function UpdateTimer({ syms, className }: { syms?: string[]; className?: string }) {
  const quotes = useQuotes();
  const now = useNow(1000);
  if (quotes.status !== 'ready') return null;
  const q = quotes.data;
  if (!q.marketOpen || q.paused || !q.every) return null;
  const fast = q.every;
  const slow = q.everySlow ?? fast;
  const list = syms?.length ? syms : null;
  const tiers = list ? Array.from(new Set(list.map((x) => (q.fast.includes(x) ? fast : slow)))).sort((a, b) => a - b) : [fast];
  const n = nextUpdate(now, tiers[0]!);
  const R = 7;
  const C = 2 * Math.PI * R;
  const how =
    tiers.length > 1
      ? t('upd.mixed', { fast: tiers[0]!, slow: tiers[tiers.length - 1]! })
      : tiers[0] === 1
        ? t('upd.everyMin')
        : t('upd.every', { n: tiers[0]! });
  return (
    <span className={[s.timer, className].filter(Boolean).join(' ')} title={how}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <circle cx="9" cy="9" r={R} className={s.track} />
        <circle cx="9" cy="9" r={R} className={s.fill} strokeDasharray={C} strokeDashoffset={C * (1 - n.done)} />
      </svg>
      <span>
        {t('upd.next', { t: mmss(n.left) })} <span className={s.how}>· {how}</span>
      </span>
    </span>
  );
}
