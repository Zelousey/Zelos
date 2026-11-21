/**
 * Profit calendar (/practice/calendar, owner 2026-11-19): the month as a calendar, each market day
 * showing what your practice account made or lost that day (green or red, darker for bigger days),
 * the month's total and green and red days, and a tap on any day for that day's trades.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuotes } from '../../data/markets';
import { useAuth } from '../../lib/auth';
import { formatMoney } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { Button, Card, EmptyState, Icon, LoadingState, PageHeader, Sheet } from '../../ui';
import { nyDay } from '../charts/series';
import { usePracticeAccount, usePracticeFills, usePracticeTrades, valueAccount, type HistoryItem } from './account';
import { dayActivity, dayChanges, monthGrid, shortMoney, summarize, type DayCell } from './calendar';
import s from './Calendar.module.css';

/** +$600.00 / −$400.00 */
const signed = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + formatMoney(Math.abs(v));
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPage() {
  const { user, isReal, openSignIn } = useAuth();
  const uid = isReal && user ? user.uid : null;
  const acct = usePracticeAccount(uid);
  const quotes = useQuotes();
  const trades = usePracticeTrades(uid);
  const fills = usePracticeFills(uid).items;
  const today = nyDay(useNow());
  const [ym, setYm] = useState(() => [Number(today.slice(0, 4)), Number(today.slice(5, 7))] as [number, number]);
  const [open, setOpen] = useState<DayCell | null>(null);

  const data = acct.status === 'ready' ? acct.data : null;
  const resetDays = useMemo(() => (data ? data.resetHistory.flatMap((r) => (r.day ? [r.day] : [])) : []), [data]);
  const changes = useMemo(() => (data ? dayChanges(data.hist, resetDays) : {}), [data, resetDays]);
  const todayPnl = data && quotes.status === 'ready' ? valueAccount(data, quotes.data.quotes, today).dayPnl : null;
  const weeks = useMemo(() => monthGrid(ym[0], ym[1], changes, resetDays, trades, today, todayPnl), [ym, changes, resetDays, trades, today, todayPnl]);
  const sum = summarize(weeks);
  const biggest = Math.max(1, ...weeks.flat().map((c) => Math.abs(c.pnl ?? 0)));
  const first = data?.hist[0]?.day ?? today;
  const canBack = `${ym[0]}-${String(ym[1]).padStart(2, '0')}` > first.slice(0, 7);
  const canNext = `${ym[0]}-${String(ym[1]).padStart(2, '0')}` < today.slice(0, 7);
  const move = (k: number) => setYm(([y, m]) => (m + k < 1 ? [y - 1, 12] : m + k > 12 ? [y + 1, 1] : [y, m + k]));
  const title = new Date(Date.UTC(ym[0], ym[1] - 1, 15)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  if (!uid)
    return (
      <>
        <PageHeader title={t('cal.title')} subtitle={t('cal.sub')} keepOnPhone />
        <EmptyState icon="calendar" body={t('cal.signIn')} actions={<Button onClick={() => openSignIn()}>{t('auth.signIn')}</Button>} />
      </>
    );
  if (acct.status === 'loading') return <LoadingState rows={6} />;
  if (!data)
    return (
      <>
        <PageHeader title={t('cal.title')} subtitle={t('cal.sub')} keepOnPhone />
        <EmptyState icon="calendar" body={t('cal.noAccount')} actions={<Link to="/dashboard">{t('nav.dashboard')} →</Link>} />
      </>
    );
  return (
    <>
      <Link to="/dashboard" className={s.back}>
        ← {t('nav.dashboard')}
      </Link>
      <PageHeader title={t('cal.title')} subtitle={t('cal.sub')} keepOnPhone />
      <Card className={s.card}>
        <div className={s.head}>
          <Button variant="ghost" size="sm" onClick={() => move(-1)} disabled={!canBack} aria-label={t('cal.prev')}>
            <Icon name="chevronLeft" size={18} />
          </Button>
          <h2 className={s.month} aria-live="polite">
            {title}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => move(1)} disabled={!canNext} aria-label={t('cal.next')}>
            <Icon name="chevronRight" size={18} />
          </Button>
        </div>
        <dl className={s.summary}>
          <div>
            <dt>{t('cal.total')}</dt>
            <dd className={sum.total > 0 ? 'up' : sum.total < 0 ? 'down' : ''}>{signed(sum.total)}</dd>
          </div>
          <div>
            <dt>{t('cal.greenDays')}</dt>
            <dd className="up">{sum.green}</dd>
          </div>
          <div>
            <dt>{t('cal.redDays')}</dt>
            <dd className="down">{sum.red}</dd>
          </div>
          <div>
            <dt>{t('cal.best')}</dt>
            <dd className="up">{sum.best && sum.best.pnl! > 0 ? shortMoney(sum.best.pnl!) : '—'}</dd>
          </div>
        </dl>
        <div className={s.grid} role="grid" aria-label={t('cal.gridLabel', { month: title })}>
          <div className={s.row} role="row">
            {WEEKDAYS.map((w) => (
              <span key={w} className={s.wd} role="columnheader">
                {w}
              </span>
            ))}
          </div>
          {weeks.map((w) => (
            <div className={s.row} role="row" key={w[0]!.day}>
              {w.map((c) => (
                <Day key={c.day} c={c} biggest={biggest} onOpen={() => setOpen(c)} />
              ))}
            </div>
          ))}
        </div>
        <p className={s.note}>{t('cal.note')}</p>
      </Card>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? dayTitle(open.day) : ''}>
        {open && <DayDetail c={open} items={[...trades, ...fills]} />}
      </Sheet>
    </>
  );
}

function Day({ c, biggest, onOpen }: { c: DayCell; biggest: number; onOpen: () => void }) {
  const tone = c.pnl == null || c.pnl === 0 ? s.flat : c.pnl > 0 ? s.green : s.red;
  const strength = c.pnl == null ? 0 : 0.12 + 0.33 * Math.min(1, Math.abs(c.pnl) / biggest); // at most 45%, so the amount stays readable
  const label = `${dayTitle(c.day)}: ${c.reset ? t('cal.reset') : c.pnl == null ? t('cal.noData') : signed(c.pnl)}${c.trades ? `, ${t(c.trades === 1 ? 'cal.trade' : 'cal.trades', { n: c.trades })}` : ''}`;
  if (!c.inMonth) return <span className={[s.cell, s.out].join(' ')} role="gridcell" aria-hidden="true" />;
  return (
    <button
      type="button"
      role="gridcell"
      className={[s.cell, tone, c.weekend && s.weekend, c.today && s.today].filter(Boolean).join(' ')}
      style={{ ['--k' as string]: strength }}
      onClick={onOpen}
      aria-label={label}
    >
      <span className={s.num}>{Number(c.day.slice(8))}</span>
      {c.reset ? <span className={s.tag}>{t('cal.resetShort')}</span> : c.pnl != null ? <b className={s.amt}>{shortMoney(c.pnl)}</b> : null}
      {c.trades > 0 && <span className={s.dot}>{c.trades}</span>}
    </button>
  );
}

function DayDetail({ c, items }: { c: DayCell; items: HistoryItem[] }) {
  const { trades, fills } = dayActivity(items, c.day, nyDay);
  return (
    <div className={s.detail}>
      <p className={s.dayTotal}>
        {c.reset ? (
          t('cal.resetDay')
        ) : c.pnl == null ? (
          t('cal.noData')
        ) : (
          <>
            {t(c.today ? 'cal.today' : 'cal.dayResult')} <b className={c.pnl > 0 ? 'up' : c.pnl < 0 ? 'down' : ''}>{signed(c.pnl)}</b>
          </>
        )}
      </p>
      <h3 className={s.h3}>{t('cal.closed')}</h3>
      {trades.length ? (
        <ul className={s.list}>
          {trades.map((x) => (
            <li key={x.id}>
              <Link to={`/markets/${encodeURIComponent(x.sym)}`}>
                <b>{x.label ?? x.sym}</b>
              </Link>
              <span>{x.qty != null && x.entry != null && x.exit != null ? t('cal.tradeLine', { qty: x.qty, entry: x.entry.toFixed(2), exit: x.exit.toFixed(2) }) : ''}</span>
              <b className={(x.pnl ?? 0) >= 0 ? 'up' : 'down'}>{x.pnl != null ? signed(x.pnl) : ''}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.muted}>{t('cal.noTrades')}</p>
      )}
      {fills.length > 0 && (
        <>
          <h3 className={s.h3}>{t('cal.fills')}</h3>
          <ul className={s.list}>
            {fills.map((x) => (
              <li key={x.id}>
                <b>{x.label ?? x.sym}</b>
                <span>{t(x.side === 'sell' ? 'cal.sold' : 'cal.bought', { qty: x.qty ?? 0, price: (x.price ?? 0).toFixed(2) })}</span>
                <span />
              </li>
            ))}
          </ul>
        </>
      )}
      <p className={s.muted}>{t('cal.dayNote')}</p>
    </div>
  );
}

function dayTitle(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}
