/**
 * One alert (/alerts/:id), like the website's alert.html: the setup, the trade plan (entry,
 * stop, targets, risk/reward), the result once the trade finishes, and why the setup was
 * picked. A live alert is locked until the 4 pm close (after it, cheaper) unless you hold a
 * pass for that strategy or unlock it with tokens; finished trades are free for everyone.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { formatDate, formatPrice, formatRelative } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { Badge, Button, buttonClass, Card, EmptyState, Icon, LoadingState, PageHeader, useToast } from '../../ui';
import { errorText, shareLink } from '../invites/invites';
import { PassButton } from '../strategies/StrategiesPage';
import { StrategyArt } from '../strategies/StrategyArt';
import { strategy } from '../strategies/strategies';
import { TokensSheet, useTokens } from '../strategies/Tokens';
import { awardOpen, hasTrade, ID_RE, isClosedForUnlock, isShort, unlockAlert, useAlertDoc, useFullAlert, type Alert } from './alerts';
import { ResultBadge, StatusBadge } from './Badges';
import { ResearchCard } from '../markets/Research';
import s from './Alerts.module.css';

const SITE = 'https://agentictrading.info/app';

export default function AlertPage() {
  const raw = useParams().id ?? '';
  const id = ID_RE.test(raw) ? raw : null;
  const { user, isReal } = useAuth();
  const uid = isReal && user ? user.uid : null;
  const teaser = useAlertDoc(id);
  const [unlocks, setUnlocks] = useState(0);
  const locked = teaser.status === 'ready' && !!teaser.data?.locked;
  const full = useFullAlert(locked ? id : null, uid, String(unlocks));
  const awarded = useRef(false);
  useEffect(() => {
    if (!uid || !id || awarded.current || teaser.status !== 'ready' || !teaser.data) return;
    awarded.current = true;
    void awardOpen(id).catch(() => {}); // XP + streak for opening a real alert (server-checked)
  }, [uid, id, teaser]);

  if (!id || teaser.status === 'missing' || (teaser.status === 'ready' && !teaser.data))
    return (
      <EmptyState
        icon="signal"
        title={t('al.missing')}
        actions={
          <Link to="/alerts" className={s.more}>
            ← {t('nav.alerts')}
          </Link>
        }
      />
    );
  if (teaser.status !== 'ready' || (locked && full.loading)) return <LoadingState rows={6} />;
  const tz = teaser.data!;
  // the full alert, with the live outcome from the public doc
  const a: Alert = full.alert ? { ...full.alert, result: tz.result, exitPrice: tz.exitPrice, closedAt: tz.closedAt, outcomeNotes: tz.outcomeNotes, locked: false } : tz;
  return <View a={a} uid={uid} onUnlocked={() => setUnlocks((n) => n + 1)} />;
}

function View({ a, uid, onUnlocked }: { a: Alert; uid: string | null; onUnlocked: () => void }) {
  const st = strategy(a.strategy)!;
  const toast = useToast();
  const short = isShort(a);
  const trade = hasTrade(a);
  async function share() {
    const r = await shareLink(`${SITE}/alerts/${a.id}`, `${st.name} alert`, a.ticker ? `${st.name}: ${a.ticker}` : `${st.name} alert on Zelos`);
    if (r === 'copied') toast.show(t('al.copied'));
  }
  return (
    <>
      <Link to="/alerts" className={s.back}>
        ← {t('nav.alerts')}
      </Link>
      <PageHeader
        title={a.ticker ?? (a.locked ? `🔒 ${t('al.locked')}` : trade ? st.name : t('al.noSetup'))}
        subtitle={`${st.name} · ${formatDate(a.at)}`}
        keepOnPhone
        actions={
          <Button variant="ghost" size="sm" onClick={() => void share()}>
            <Icon name="share" size={16} /> {t('al.share')}
          </Button>
        }
      />
      <div className={s.badgeRow}>
        <StatusBadge a={a} />
        <ResultBadge a={a} />
        {a.direction && <Badge tone={short ? 'down' : 'up'}>{a.direction}</Badge>}
        {a.label && <Badge>{a.label}</Badge>}
        {a.score != null && <Badge tone="violet">{t('al.score', { n: a.score, of: a.scoreMax ?? 80 })}</Badge>}
      </div>
      <div className={s.detail}>
        {a.locked ? (
          <LockCard a={a} uid={uid} onUnlocked={onUnlocked} />
        ) : trade && a.legs.length === 3 ? (
          <LegsCard a={a} />
        ) : trade ? (
          <PlanCard a={a} />
        ) : (
          <Card title={t('al.noSetup')} pad>
            <p className={s.muted}>{t('al.noSetup.body')}</p>
          </Card>
        )}
        {a.result && <OutcomeCard a={a} />}
        {!a.locked && (a.reasoning || a.technicals.length > 0 || a.riskNotes || a.regime) && <WhyCard a={a} />}
        {a.locked && a.regime && (
          <Card title={t('al.regime')} pad>
            <p>{a.regime}</p>
          </Card>
        )}
        {!a.locked && a.ticker && <ResearchCard sym={a.ticker} />}
        <Card title={st.name} subtitle={st.tagline}>
          <StrategyArt id={st.id} name={st.name} size="sm" />
          <Link to={`/strategies/${st.id}`} className={s.more}>
            {t('st.details')} →
          </Link>
        </Card>
      </div>
      <p className={s.fine}>{t('st.disclaimer')}</p>
    </>
  );
}

function PlanCard({ a }: { a: Alert }) {
  const rr = a.rewardRisk ?? (a.riskPerShare && a.rewardPerShare ? a.rewardPerShare / a.riskPerShare : null);
  const rows: [string, number | null][] = [
    [t('al.entry'), a.entry],
    [t('al.stop'), a.stop],
    [t('al.target1'), a.target1],
    [t('al.target2'), a.target2],
    [t('al.risk'), a.riskPerShare],
    [t('al.reward'), a.rewardPerShare],
  ];
  return (
    <Card title={t('al.plan')} subtitle={t('al.plan.sub')}>
      <dl className={s.plan}>
        {rows
          .filter(([, v]) => v != null)
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>${formatPrice(v)}</dd>
            </div>
          ))}
      </dl>
      {rr != null && (
        <div className={s.rr}>
          <span>{t('al.rr', { n: rr.toFixed(1) })}</span>
          <div className={s.rrBar} role="img" aria-label={t('al.rr', { n: rr.toFixed(1) })}>
            <i className={s.loss} style={{ flex: 1 }} />
            <i className={s.win} style={{ flex: Math.min(rr, 6) }} />
          </div>
        </div>
      )}
      <Ladder a={a} />
      {a.optionsRule && (
        <p className={s.note}>
          <b>{t('al.options')}</b> {a.optionsRule}
        </p>
      )}
      {a.sizeNote && (
        <p className={s.note}>
          <b>{t('al.size')}</b> {a.sizeNote}
        </p>
      )}
      {a.ticker && (
        <div className={s.actions}>
          <Link to={tradeLink(a)} className={buttonClass({ variant: 'primary', size: 'sm' })}>
            {t('al.practice')}
          </Link>
          <Link to={`/markets/${encodeURIComponent(a.ticker)}`} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
            <Icon name="chart" size={16} /> {t('al.chart')}
          </Link>
        </div>
      )}
    </Card>
  );
}

/** The practice ticket for this alert; a long stock idea comes with its stop and first target filled in. */
function tradeLink(a: Alert): string {
  const base = `/practice/trade/${encodeURIComponent(a.ticker!)}`;
  if (a.direction !== 'long' || a.stop == null || a.target1 == null) return base;
  return `${base}?sl=${a.stop}&tp=${a.target1}`;
}

const usd = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A 3-Leg Options trade: the three positions, what it costs, the most it can make or lose. */
function LegsCard({ a }: { a: Alert }) {
  const cost = a.netCost ?? 0;
  const rows: [string, string][] = [
    [cost >= 0 ? t('al.tl.cost') : t('al.tl.credit'), usd(cost)],
    [t('al.tl.maxProfit'), a.maxProfit == null ? t('al.tl.unlimited') : usd(a.maxProfit)],
    [t('al.tl.maxLoss'), a.maxLoss == null ? t('al.tl.unlimited') : usd(a.maxLoss)],
    [t('al.tl.breakevens'), a.breakevens.length ? a.breakevens.map(usd).join(' · ') : '—'],
  ];
  return (
    <Card title={a.kindLabel ?? t('al.plan')} subtitle={t('al.tl.sub', { date: a.expiration ? formatDate(Date.parse(`${a.expiration}T12:00:00Z`)) : '—', p: formatPrice(a.entry) })}>
      <table className={s.legs}>
        <thead>
          <tr>
            <th scope="col">{t('al.tl.action')}</th>
            <th scope="col">{t('al.tl.option')}</th>
            <th scope="col">{t('al.tl.strike')}</th>
            <th scope="col">{t('al.tl.price')}</th>
          </tr>
        </thead>
        <tbody>
          {a.legs.map((l, i) => (
            <tr key={i}>
              <td>
                <Badge tone={l.side === 'buy' ? 'up' : 'down'}>{t(l.side === 'buy' ? 'al.tl.buy' : 'al.tl.sell', { n: l.qty })}</Badge>
              </td>
              <td>{t(l.type === 'call' ? 'al.tl.call' : 'al.tl.put')}</td>
              <td className={s.mono}>{usd(l.strike)}</td>
              <td className={s.mono}>{usd(l.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className={s.plan}>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <Payoff a={a} />
      <p className={s.note}>{t('al.tl.how')}</p>
      {a.ticker && (
        <div className={s.actions}>
          <Link to={`/markets/${encodeURIComponent(a.ticker)}`} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
            <Icon name="chart" size={16} /> {t('al.chart')}
          </Link>
        </div>
      )}
    </Card>
  );
}

/** Profit or loss at expiration across stock prices (display only; the numbers above come from the server). */
function Payoff({ a }: { a: Alert }) {
  const strikes = a.legs.map((l) => l.strike);
  const lo = Math.min(...strikes) * 0.85;
  const hi = Math.max(...strikes) * 1.15;
  const pnl = (px: number) => a.legs.reduce((sum, l) => sum + (l.side === 'buy' ? 1 : -1) * l.qty * 100 * Math.max(0, l.type === 'call' ? px - l.strike : l.strike - px), 0) - (a.netCost ?? 0);
  const xs = Array.from({ length: 61 }, (_, i) => lo + ((hi - lo) * i) / 60);
  const ys = xs.map(pnl);
  const top = Math.max(...ys, 1);
  const bot = Math.min(...ys, -1);
  const W = 300;
  const H = 90;
  const x = (v: number) => ((v - lo) / (hi - lo)) * W;
  const y = (v: number) => ((top - v) / (top - bot)) * H;
  const line = xs.map((v, i) => `${i ? 'L' : 'M'}${x(v).toFixed(1)},${y(pnl(v)).toFixed(1)}`).join('');
  return (
    <figure className={s.payoff}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('al.tl.chart')} preserveAspectRatio="none">
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} className={s.zero} />
        {a.entry != null && a.entry > lo && a.entry < hi && <line x1={x(a.entry)} x2={x(a.entry)} y1="0" y2={H} className={s.now} />}
        <path d={line} className={s.curve} />
      </svg>
      <figcaption className={s.muted}>{t('al.tl.chart')}</figcaption>
    </figure>
  );
}

/** Stop, entry and targets on one line, to scale. */
function Ladder({ a }: { a: Alert }) {
  const pts = ([['stop', a.stop], ['entry', a.entry], ['t1', a.target1], ['t2', a.target2]] as const).filter((p): p is readonly [typeof p[0], number] => p[1] != null);
  if (pts.length < 2) return null;
  const vals = pts.map((p) => p[1]);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pos = (v: number) => (hi === lo ? 50 : ((v - lo) / (hi - lo)) * 100);
  const name = { stop: t('al.stop'), entry: t('al.entry'), t1: t('al.target1'), t2: t('al.target2') };
  return (
    <div className={s.ladder} role="img" aria-label={pts.map(([k, v]) => `${name[k]} ${formatPrice(v)}`).join(', ')}>
      <div className={s.ladderLine} />
      {pts.map(([k, v]) => (
        <span key={k} className={[s.mark, s[`m_${k}`]].join(' ')} style={{ left: `${pos(v)}%` }}>
          <i />
          <small>{name[k]}</small>
        </span>
      ))}
    </div>
  );
}

function LockCard({ a, uid, onUnlocked }: { a: Alert; uid: string | null; onUnlocked: () => void }) {
  const st = strategy(a.strategy)!;
  const tk = useTokens();
  const toast = useToast();
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const closed = isClosedForUnlock(a, now);
  const price = closed ? (tk.info?.prices.unlockClosed ?? 3) : (tk.info?.prices.unlock ?? 10);
  async function unlock() {
    setBusy(true);
    try {
      await unlockAlert(a.id);
      toast.show(t('al.unlocked'));
      onUnlocked();
    } catch (e) {
      toast.show(errorText(e, t('st.buy.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  const left = a.lockedUntil && !closed ? Math.max(0, a.lockedUntil - now) : 0;
  const hms = `${Math.floor(left / 3600000)}h ${Math.floor((left % 3600000) / 60000)}m`;
  return (
    <Card title={t('al.lock.title')} className={s.lock}>
      <p>{closed ? t('al.lock.closed', { n: price }) : t('al.lock.live', { time: hms })}</p>
      <p className={s.muted}>{t('al.lock.free')}</p>
      {uid ? (
        <div className={s.actions}>
          {tk.balance != null && tk.balance < price ? (
            <Button variant="primary" size="sm" onClick={() => setSheet(true)}>
              {t('st.getTokensFor', { n: price })}
            </Button>
          ) : (
            <Button variant="primary" size="sm" disabled={busy || tk.balance == null} onClick={() => void unlock()}>
              {t('al.unlock', { n: price })}
            </Button>
          )}
          <PassButton st={st} wallet={tk.wallet} info={tk.info} balance={tk.balance} onTokens={() => setSheet(true)} />
        </div>
      ) : (
        <div className={s.actions}>
          <PassButton st={st} wallet={null} info={null} balance={null} onTokens={() => setSheet(true)} />
        </div>
      )}
      {a.lockedUntil && !closed && <p className={s.muted}>{t('al.lock.cheaper', { when: formatRelative(a.lockedUntil) })}</p>}
      <TokensSheet open={sheet} onClose={() => setSheet(false)} info={tk.info} balance={tk.balance} />
    </Card>
  );
}

function OutcomeCard({ a }: { a: Alert }) {
  return (
    <Card title={t('al.outcome')} pad>
      <div className={s.badgeRow}>
        <ResultBadge a={a} />
        {a.exitPrice != null && <span className={s.mono}>{t(a.legs.length ? 'al.tl.closeAt' : 'al.exit', { p: formatPrice(a.exitPrice) })}</span>}
        {a.closedAt && <span className={s.muted}>{formatDate(a.closedAt)}</span>}
      </div>
      {a.outcomeNotes && <p className={s.note}>{a.outcomeNotes}</p>}
    </Card>
  );
}

function WhyCard({ a }: { a: Alert }) {
  return (
    <Card title={t('al.why')} pad>
      {a.reasoning && <p className={s.prose}>{a.reasoning}</p>}
      {a.technicals.length > 0 && (
        <dl className={s.tech}>
          {a.technicals.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {a.riskNotes && (
        <p className={s.note}>
          <b>{t('al.riskNotes')}</b> {a.riskNotes}
        </p>
      )}
      {a.regime && (
        <p className={s.note}>
          <b>{t('al.regime')}</b> {a.regime}
        </p>
      )}
    </Card>
  );
}
