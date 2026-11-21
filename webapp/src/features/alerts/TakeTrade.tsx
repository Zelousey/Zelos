/**
 * Take this trade (owner 2026-11-19): what the trade might look like on the stock's chart, the
 * live price, why it was picked, then one tap to place it (shares sized to risk about 1% of your
 * practice account, a stop, a target and a time exit after the recommended hold, which you can
 * change) or Decline. A declined alert goes to Declined alerts, where it can be taken back for a
 * few tokens while its trade is live.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuotes } from '../../data/markets';
import { useHistory } from '../../data/useHistory';
import { formatPrice } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Badge, Button, buttonClass, Card, Icon, useToast } from '../../ui';
import { usePracticeAccount } from '../practice/account';
import { errorMessage, placeOrder } from '../practice/actions';
import { strategy } from '../strategies/strategies';
import type { Alert } from './alerts';
import { decide, reactivate, REACTIVATE_COST, sharesFor, useDecision } from './decisions';
import s from './Alerts.module.css';

/** The 13 chart checks (functions/momentum_scan.py CHECK_NAMES). */
export const CHECK_NAMES: Record<string, string> = {
  above50: 'Above its 50-day average', trend: '50-day over the 200-day', above20: 'Above its 20-day average',
  macdUp: 'MACD histogram rising', macdBull: 'MACD over its signal line', rsiZone: 'RSI(14) between 45 and 65',
  rsiTurn: 'RSI(14) turning up', greenDay: 'Closed higher than it opened', strongClose: 'Closed near the day’s high',
  volume: 'Volume at least its 20-day average', market: 'SPY above its 20-day average', leader: 'Beating SPY over the last month',
  notStretched: 'Not stretched above its 20-day',
};
const HOLD_CHOICES = [1, 2, 3, 5, 7, 10, 15, 20, 30];

/** Only a long stock plan can be taken in one tap (options and 3-Leg trades open their ticket). */
export const canTakeInOneTap = (a: Alert) =>
  !!a.ticker && a.direction === 'long' && !a.contract && a.legs.length !== 3 && a.entry != null && a.stop != null && a.target1 != null && !a.result;

export function TakeTrade({ a, uid }: { a: Alert; uid: string | null }) {
  const st = strategy(a.strategy)!;
  const toast = useToast();
  const quotes = useQuotes();
  const acct = usePracticeAccount(uid);
  const decision = useDecision(uid, a.id);
  const q = quotes.status === 'ready' && a.ticker ? quotes.data.quotes[a.ticker] : undefined;
  const live = q?.c ?? null;
  const recommended = a.holdDays ?? st.hold ?? 3;
  const account = acct.status === 'ready' ? acct.data.cash + acct.data.positions.reduce((t2, p) => t2 + p.qty * p.avg, 0) : 10_000;
  const suggested = sharesFor(account, live ?? a.entry!, a.stop!);
  const [qty, setQty] = useState<number | null>(null);
  const [hold, setHold] = useState<number>(recommended);
  const [busy, setBusy] = useState(false);
  const status = decision.status === 'ready' ? decision.data?.status ?? null : null;
  const shares = qty ?? suggested;

  async function take() {
    if (!uid) return;
    setBusy(true);
    try {
      await placeOrder({ sym: a.ticker!, side: 'buy', type: 'market', qty: shares, tif: 'day', bracket: { sl: a.stop!, tp: a.target1!, days: hold } });
      await decide(uid, a.id, 'taken');
      toast.show(t('al.take.done', { n: shares, sym: a.ticker!, days: hold }), 'success');
    } catch (e) {
      toast.show(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  }
  async function decline() {
    if (!uid) return;
    setBusy(true);
    try {
      await decide(uid, a.id, 'declined');
      toast.show(t('al.decline.done'));
    } catch (e) {
      toast.show(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  }
  async function takeBack() {
    setBusy(true);
    try {
      await reactivate(a.id);
      toast.show(t('al.reactivate.done', { n: REACTIVATE_COST }), 'success');
    } catch (e) {
      toast.show(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  const risk = Math.abs((live ?? a.entry!) - a.stop!) * shares;
  const reward = Math.abs(a.target1! - (live ?? a.entry!)) * shares;
  return (
    <Card title={t('al.take.title')} subtitle={t('al.take.sub', { days: recommended })} className={s.takeCard}>
      <TradePreview a={a} live={live} hold={hold} />
      <dl className={s.takeNums}>
        <div>
          <dt>{t('al.take.live')}</dt>
          <dd>{live != null ? `$${formatPrice(live)}` : '—'}</dd>
        </div>
        <div>
          <dt>{t('al.entry')}</dt>
          <dd>${formatPrice(a.entry)}</dd>
        </div>
        <div>
          <dt>{t('al.stop')}</dt>
          <dd className="down">${formatPrice(a.stop)}</dd>
        </div>
        <div>
          <dt>{t('al.target1')}</dt>
          <dd className="up">${formatPrice(a.target1)}</dd>
        </div>
      </dl>
      <Why a={a} />
      {!uid ? (
        <p className={s.muted}>{t('al.take.signIn')}</p>
      ) : status === 'taken' ? (
        <p className={s.takeDone}>
          <Icon name="check" size={16} /> {t('al.take.taken')}{' '}
          <Link to="/dashboard" className={s.more}>
            {t('al.take.see')} →
          </Link>
        </p>
      ) : status === 'declined' ? (
        <div className={s.takeDone}>
          <span>{t('al.decline.state')}</span>
          <Button size="sm" variant="secondary" onClick={() => void takeBack()} disabled={busy}>
            {t('al.reactivate', { n: REACTIVATE_COST })}
          </Button>
        </div>
      ) : (
        <>
          <div className={s.takeForm}>
            <label>
              <span>{t('al.take.shares')}</span>
              <input type="number" inputMode="numeric" min={1} max={100000} value={shares} onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
            </label>
            <label>
              <span>{t('al.take.hold')}</span>
              <select value={hold} onChange={(e) => setHold(Number(e.target.value))}>
                {[...new Set([...HOLD_CHOICES, recommended])]
                  .sort((x, y) => x - y)
                  .map((d) => (
                    <option key={d} value={d}>
                      {t(d === 1 ? 'al.take.day' : 'al.take.days', { n: d })}
                      {d === recommended ? ` (${t('al.take.recommended')})` : ''}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <p className={s.muted}>{t('al.take.math', { risk: risk.toFixed(0), reward: reward.toFixed(0), pct: ((risk / account) * 100).toFixed(1) })}</p>
          <div className={s.takeActions}>
            <Button variant="buy" onClick={() => void take()} disabled={busy}>
              {t('al.take.go', { n: shares, sym: a.ticker! })}
            </Button>
            <Button variant="ghost" onClick={() => void decline()} disabled={busy}>
              {t('al.decline')}
            </Button>
          </div>
        </>
      )}
      {a.highRisk && <Badge tone="gold">{t('al.highRisk')}</Badge>}
    </Card>
  );
}

/** Why it was picked: the checklist (Momentum Trader / Max), or the setup and its key numbers. */
function Why({ a }: { a: Alert }) {
  if (a.checks.length) {
    return (
      <ul className={s.checks} aria-label={t('al.take.why')}>
        {a.checks.map(([k, ok]) => (
          <li key={k} className={ok ? s.checkOk : s.checkNo}>
            <span aria-hidden="true">{ok ? '✓' : '✗'}</span> {CHECK_NAMES[k] ?? k}
            <span className="visually-hidden">{ok ? t('al.check.yes') : t('al.check.no')}</span>
          </li>
        ))}
      </ul>
    );
  }
  const keys = ['RSI', 'Month return', 'Volume vs month', 'Breakout volume', 'Resistance', 'SMA20', 'SMA50'];
  const tech = a.technicals.filter(([k]) => keys.includes(k)).slice(0, 5);
  return (
    <ul className={s.checks} aria-label={t('al.take.why')}>
      {a.label && <li className={s.checkOk}>✓ {a.label}</li>}
      {tech.map(([k, v]) => (
        <li key={k} className={s.checkInfo}>
          {k}: <b>{v}</b>
        </li>
      ))}
    </ul>
  );
}

/** The last 30 sessions, the live price, and the plan drawn ahead of it: the zone to the target (green) and to the stop (red). */
export function TradePreview({ a, live, hold }: { a: Alert; live: number | null; hold: number }) {
  const history = useHistory(true);
  const bars = useMemo(() => (history.status === 'ready' && a.ticker ? (history.data[a.ticker] ?? []).slice(-30) : []), [history, a.ticker]);
  const W = 600, H = 220, P = 10, AX = 56;
  const closes = bars.map((b) => b[4]);
  const now = live ?? a.entry!;
  const levels = [a.stop!, a.target1!, now, ...(a.target2 != null ? [a.target2] : []), ...closes];
  const lo = Math.min(...levels), hi = Math.max(...levels);
  const span = hi - lo || 1;
  const y = (v: number) => P + (1 - (v - lo) / span) * (H - 2 * P);
  const futureW = Math.min(0.42, 0.12 + hold * 0.03) * (W - AX);
  const pastW = W - AX - futureW;
  const x = (i: number) => (closes.length > 1 ? (i / (closes.length - 1)) * pastW : pastW);
  const path = closes.map((c, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(c).toFixed(1)}`).join('');
  const x0 = pastW, x1 = W - AX;
  const label = t('al.preview.aria', { sym: a.ticker ?? '', stop: formatPrice(a.stop), target: formatPrice(a.target1), days: hold });
  return (
    <figure className={s.preview}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <rect x={x0} y={y(a.target1!)} width={x1 - x0} height={Math.max(1, y(now) - y(a.target1!))} fill="var(--bull)" opacity="0.14" />
        <rect x={x0} y={y(now)} width={x1 - x0} height={Math.max(1, y(a.stop!) - y(now))} fill="var(--danger)" opacity="0.14" />
        {path && <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" data-testid="price-path" />}
        <path d={`M${x0},${y(now)} L${x1 - 6},${y(a.target1!)}`} fill="none" stroke="var(--bull)" strokeWidth="2" strokeDasharray="6 5" />
        {(
          [
            [a.target1!, 'var(--bull)', t('al.target1')],
            ...(a.target2 != null ? ([[a.target2, 'var(--bull)', t('al.target2')]] as const) : []),
            [now, 'var(--ink)', t('al.take.now')],
            [a.stop!, 'var(--danger)', t('al.stop')],
          ] as const
        ).map(([v, c, name]) => (
          <g key={name}>
            <line x1={name === t('al.take.now') ? x0 : 0} x2={x1} y1={y(v)} y2={y(v)} stroke={c} strokeWidth="1" strokeDasharray="3 4" opacity="0.8" />
            <text x={x1 + 4} y={y(v) + 4} fontSize="11" fill={c} fontFamily="var(--mono)">
              {formatPrice(v)}
            </text>
          </g>
        ))}
        <circle cx={x0} cy={y(now)} r="4.5" fill="var(--ink)" />
        <line x1={x0} x2={x0} y1={P} y2={H - P} stroke="var(--border)" strokeDasharray="2 4" />
      </svg>
      <figcaption className={s.previewCap}>
        <span>{t('al.preview.past')}</span>
        <span>{t('al.preview.next', { days: hold })}</span>
      </figcaption>
      <Link to={`/markets/${encodeURIComponent(a.ticker ?? '')}`} className={buttonClass({ variant: 'ghost', size: 'sm' })}>
        <Icon name="chart" size={16} /> {t('al.preview.live')}
      </Link>
    </figure>
  );
}
