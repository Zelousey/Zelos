/**
 * Practice: your server-side $10,000 virtual account. Value and P&L, positions (with Close),
 * open orders (with Cancel), recent activity, the archived classic account, privacy and reset.
 * Every change goes through a Cloud Function; this screen only shows what the server holds.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuotes } from '../../data/markets';
import { useAuth } from '../../lib/auth';
import { formatDate, formatMoney, formatPrice, formatRelative, formatSignedMoney } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Badge, Button, buttonClass, Card, Change, Confirm, EmptyState, ErrorState, LoadingState, PageHeader, Stat, useToast } from '../../ui';
import { nyDay } from '../charts/series';
import { useVolMap } from '../options/model';
import { AccountChart } from './AccountChart';
import { OptionPositions } from '../options/OptionPositions';
import { RESET_BELOW, sellableShares, useArchive, usePracticeAccount, usePracticeHistory, valueAccount, type HistoryItem, type Order } from './account';
import { cancelOrder, errorMessage, openAccount, placeOrder, resetAccount, setPublic } from './actions';
import s from './Practice.module.css';

const STATUS: Record<string, 'status.cancelled' | 'status.expired' | 'status.rejected' | 'status.filled'> = { cancelled: 'status.cancelled', expired: 'status.expired', rejected: 'status.rejected', filled: 'status.filled' };
const dir = (n: number) => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat') as 'up' | 'down' | 'flat';

export default function PracticePage() {
  const { user, isReal, ready, signInWithGoogle } = useAuth();
  const uid = isReal && user ? user.uid : null;
  const acct = usePracticeAccount(uid);
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (!ready) return <LoadingState />;
  if (!uid) {
    return (
      <>
        <PageHeader title={t('practice.title')} />
        <Card>
          <EmptyState icon="practice" body={t('practice.signIn')} actions={<Button variant="primary" size="lg" onClick={() => void signInWithGoogle().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>{t('auth.signInWithGoogle')}</Button>} />
        </Card>
      </>
    );
  }
  if (acct.status === 'loading') return <LoadingState rows={6} />;
  if (acct.status === 'error') return <ErrorState />;
  if (acct.status === 'missing') {
    return (
      <>
        <PageHeader title={t('practice.title')} />
        <Card>
          <EmptyState
            icon="practice"
            title={t('practice.start.title')}
            body={
              <>
                {t('practice.start.body')} {t('practice.start.archive')}
              </>
            }
            actions={
              <Button
                variant="primary"
                size="lg"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  openAccount()
                    .catch((e) => toast.show(errorMessage(e), 'error'))
                    .finally(() => setBusy(false));
                }}
              >
                {t('practice.start.cta')}
              </Button>
            }
          />
        </Card>
      </>
    );
  }
  return <AccountView uid={uid} />;
}

function AccountView({ uid }: { uid: string }) {
  const acctState = usePracticeAccount(uid);
  const quotes = useQuotes();
  const history = usePracticeHistory(uid);
  const toast = useToast();
  const acct = acctState.status === 'ready' ? acctState.data : null;
  const archive = useArchive(uid, !!acct?.archivedClassic);
  const qs = useMemo(() => (quotes.status === 'ready' ? quotes.data.quotes : {}), [quotes]);
  const [today] = useState(() => nyDay(Date.now()));
  const vols = useVolMap();
  const v = useMemo(() => (acct ? valueAccount(acct, qs, today, vols) : null), [acct, qs, today, vols]);
  const [closing, setClosing] = useState<{ sym: string; qty: number } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [pending, setPending] = useState(false);
  if (!acct || !v) return <LoadingState />;

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    setPending(true);
    try {
      await fn();
      toast.show(okMsg, 'success');
    } catch (e) {
      toast.show(errorMessage(e), 'error');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t('practice.title')}
        subtitle={
          <span className={s.badgeRow}>
            <Badge tone="accent">{t('practice.virtual')}</Badge>
          </span>
        }
        actions={
          <Link className={buttonClass({ variant: 'primary' })} to="/markets">
            {t('practice.findStock')}
          </Link>
        }
      />
      <div className={s.stack}>
        <Card>
          <AccountChart acct={acct} equity={v.equity} quotes={qs} vols={vols} today={today} />
          <div className={s.kpis}>
            <Stat label={t('practice.dayPnl')} value={formatSignedMoney(v.dayPnl)} direction={dir(v.dayPnl)} delta={null} />
            <Stat label={t('practice.netPnl')} value={formatSignedMoney(v.netPnl)} />
            <Stat label={t('practice.cash')} value={formatMoney(acct.cash)} />
            <Stat label={t('practice.buyingPower')} value={formatMoney(v.buyingPower)} />
          </div>
        </Card>

        <div className={s.grid}>
          <Card title={t('practice.positions')} flush>
            {v.rows.length === 0 ? (
              <EmptyState icon="markets" body={t('practice.positions.empty')} compact actions={<Link className={buttonClass({ variant: 'secondary' })} to="/markets">{t('practice.findStock')}</Link>} />
            ) : (
              <>
                <div className={[s.desktopOnly, s.tableWrap].join(' ')}>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th scope="col">{t('col.symbol')}</th>
                        <th scope="col">{t('col.qty')}</th>
                        <th scope="col">{t('col.avg')}</th>
                        <th scope="col">{t('col.last')}</th>
                        <th scope="col">{t('col.value')}</th>
                        <th scope="col">{t('col.pnl')}</th>
                        <th scope="col">
                          <span className="visually-hidden">{t('col.actions')}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="num">
                      {v.rows.map((r) => (
                        <tr key={r.sym}>
                          <td className={s.symCell}>
                            <Link to={`/markets/${r.sym}`}>{r.sym}</Link>
                          </td>
                          <td>{r.qty}</td>
                          <td>{formatPrice(r.avg)}</td>
                          <td>{formatPrice(r.last)}</td>
                          <td>{formatMoney(r.value)}</td>
                          <td>
                            <Change abs={r.pnl} pct={r.pnlPct} />
                          </td>
                          <td>
                            <span style={{ display: 'inline-flex', gap: 6 }}>
                              <Link className={buttonClass({ variant: 'ghost', size: 'sm' })} to={`/practice/trade/${r.sym}`}>
                                {t('practice.trade')}
                              </Link>
                              <Button variant="secondary" size="sm" onClick={() => setClosing({ sym: r.sym, qty: sellableShares(acct, r.sym) })} disabled={pending || sellableShares(acct, r.sym) === 0}>
                                {t('practice.close')}
                              </Button>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className={[s.cards, s.phoneOnly].join(' ')}>
                  {v.rows.map((r) => (
                    <li key={r.sym} className={s.cardRow}>
                      <span>
                        <Link to={`/markets/${r.sym}`} className="num" style={{ color: 'var(--ink)', fontWeight: 600 }}>
                          {r.sym}
                        </Link>
                        <span className={s.sub}>
                          {r.qty} × {formatPrice(r.avg)}
                        </span>
                      </span>
                      <span className={s.right}>
                        <span className="num">{formatMoney(r.value)}</span>
                        <Change abs={r.pnl} pct={r.pnlPct} />
                      </span>
                      <span className={s.cardActions}>
                        <Link className={buttonClass({ variant: 'secondary', size: 'sm' })} to={`/practice/trade/${r.sym}`}>
                          {t('practice.trade')}
                        </Link>
                        <Button variant="ghost" size="sm" onClick={() => setClosing({ sym: r.sym, qty: sellableShares(acct, r.sym) })} disabled={pending || sellableShares(acct, r.sym) === 0}>
                          {t('practice.close')}
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {v.optionRows.length > 0 && (
            <Card
              title={t('opt.positions')}
              flush
              actions={
                <Link className={buttonClass({ variant: 'ghost', size: 'sm' })} to="/options">
                  {t('nav.options')}
                </Link>
              }
            >
              <OptionPositions acct={acct} rows={v.optionRows} />
            </Card>
          )}

          <div className={s.side}>
            <Card title={t('practice.orders')} flush>
              {acct.orders.length === 0 ? <EmptyState icon="inbox" body={t('practice.orders.empty')} compact /> : acct.orders.map((o) => <OrderRow key={o.id} o={o} disabled={pending} onCancel={() => void run(() => cancelOrder(o.id), t('practice.cancelled'))} />)}
              <p className={s.note}>{t('practice.fillNote')}</p>
            </Card>
            <Card title={t('practice.history')} flush>
              {!history.ready ? <LoadingState rows={3} /> : history.items.length === 0 ? <EmptyState icon="inbox" body={t('practice.history.empty')} compact /> : <HistoryList items={history.items} />}
            </Card>
          </div>
        </div>

        {acct.archivedClassic && archive.status === 'ready' && (
          <Card title={t('practice.archive')}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-2)' }}>{t('practice.archive.body', { value: formatMoney(archive.data.equity), trades: archive.data.trades })}</p>
          </Card>
        )}

        <Card>
          <div className={s.settings}>
            <label className={s.toggle}>
              <input type="checkbox" checked={acct.publicProfile} disabled={pending} onChange={(e) => void run(() => setPublic(e.target.checked), e.target.checked ? t('practice.publicOn') : t('practice.publicOff'))} />
              {t('practice.public')}
            </label>
            <span style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
              <Button variant="secondary" size="sm" disabled={pending || v.equity >= RESET_BELOW} onClick={() => setResetting(true)}>
                {t('practice.reset')}
              </Button>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>{t('practice.reset.hint')}</span>
            </span>
          </div>
        </Card>
      </div>

      <Confirm
        open={!!closing}
        title={t('practice.close')}
        action={t('trade.sell')}
        variant="sell"
        busy={pending}
        onClose={() => setClosing(null)}
        onConfirm={() => {
          const c = closing!;
          void run(() => placeOrder({ sym: c.sym, side: 'sell', type: 'market', qty: c.qty, tif: 'day' }), t('practice.closeDone', { qty: c.qty, sym: c.sym })).then(() => setClosing(null));
        }}
      >
        {closing && t('practice.closeConfirm', { qty: closing.qty, sym: closing.sym })}
      </Confirm>
      <Confirm
        open={resetting}
        title={t('practice.reset')}
        action={t('practice.reset')}
        variant="danger"
        busy={pending}
        onClose={() => setResetting(false)}
        onConfirm={() => void run(resetAccount, t('practice.reset.done')).then(() => setResetting(false))}
      >
        {t('practice.reset.confirm', { n: acct.resets + 1 })}
      </Confirm>
    </>
  );
}

function orderText(o: Order): string {
  if (o.opt) return `${o.side === 'buy' ? t('trade.buy') : t('trade.sell')} ${o.qty} ${o.label ?? o.sym} · ${t('trade.market')}`;
  const what = o.type === 'market' ? t('trade.market') : o.type === 'limit' ? `${t('trade.limit')} ${formatPrice(o.limit)}` : `${t('trade.stop')} ${formatPrice(o.stop)}`;
  const role = o.role === 'sl' ? ` · ${t('trade.stopLoss')}` : o.role === 'tp' ? ` · ${t('trade.takeProfit')}` : '';
  return `${o.side === 'buy' ? t('trade.buy') : t('trade.sell')} ${o.qty} ${o.sym} · ${what}${role}`;
}

function OrderRow({ o, onCancel, disabled }: { o: Order; onCancel: () => void; disabled: boolean }) {
  return (
    <div className={s.orderRow}>
      <span>
        <span className={s.orderText}>{orderText(o)}</span>
        <span className={[s.orderMeta, s.sub].join(' ')}>
          {o.opt ? t('nav.options') : o.tif === 'gtc' ? t('trade.gtc') : `${t('trade.day')} (${formatDate(o.session + 'T12:00:00Z')})`} · {formatRelative(o.createdAt)}
        </span>
      </span>
      <Button variant="ghost" size="sm" onClick={onCancel} disabled={disabled} aria-label={`${t('practice.cancel')}: ${orderText(o)}`}>
        {t('practice.cancel')}
      </Button>
    </div>
  );
}

function HistoryList({ items }: { items: HistoryItem[] }) {
  return (
    <ul className={s.hist}>
      {items
        .filter((h) => h.kind !== 'order' || h.status !== 'filled')
        .slice(0, 25)
        .map((h) => (
          <li key={h.id}>
            <span>
              {h.kind === 'fill' && (
                <>
                  {t(h.side === 'buy' ? 'hist.bought' : 'hist.sold', { qty: h.qty ?? 0, sym: h.label ?? h.sym, price: formatPrice(h.price) })}
                  {h.role === 'tp' ? t('hist.viaTp') : h.role === 'sl' ? t('hist.viaSl') : ''}
                </>
              )}
              {h.kind === 'trade' && (
                <>
                  {h.role === 'expired' ? t('hist.expired', { label: h.label ?? h.sym, price: formatPrice(h.exit) }) : t('hist.closed', { sym: h.label ?? h.sym })} <Change abs={h.pnl} pct={h.pct} />
                </>
              )}
              {h.kind === 'order' && (
                <>
                  {t('hist.order', { side: h.side === 'buy' ? t('trade.buy') : t('trade.sell'), qty: h.qty ?? 0, sym: h.label ?? h.sym, status: STATUS[h.status ?? ''] ? t(STATUS[h.status ?? '']!) : (h.status ?? '') })}
                  {h.note ? ` · ${h.note}` : ''}
                </>
              )}
            </span>
            <span className={s.histWhen}>{formatRelative(h.at)}</span>
          </li>
        ))}
    </ul>
  );
}
