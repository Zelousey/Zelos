/**
 * Dashboard cards (owner 2026-11-15):
 *   YourMovers     two cards, green "Your top gainers" and red "Your top losers": your open stock
 *                  and option positions ranked by what they're up or down since you opened them
 *                  (analysis.ts contributors; "your option call is up $40"). Tap one for its
 *                  detail: open P&L, today's move, the next earnings and recent SEC filings.
 *   PendingPanel   Solo · Pending orders as one compact bar each (tap for the order's details,
 *                  Cancel on the bar); with none, two small cards that cycle through today's
 *                  market movers instead (markets/movers: real stock gainers and losers, labelled
 *                  as the market, never as your account).
 */
import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useMovers, useQuotes, type Mover } from '../../data/markets';
import { instrument } from '../../data/universe';
import { formatDate, formatMoney, formatPercent, formatPrice, formatSignedMoney } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { Button, buttonClass, Card, Sheet, Skeleton, useToast } from '../../ui';
import { useOfficialNews } from '../news/news';
import { useNextEarnings } from '../dashboard/Earnings';
import { useVolMap } from '../options/model';
import { nyDay } from '../charts/series';
import { usePracticeAccount, type Order, type Valued } from './account';
import { cancelOrder, errorMessage } from './actions';
import { contributors, type Contributor } from './analysis';
import s from './DashCards.module.css';

// ------------------------------------------------------------------ your gainers and losers
export function YourMovers({ v }: { v: Valued }) {
  const quotes = useQuotes();
  const vols = useVolMap();
  const [today] = useState(() => nyDay(Date.now()));
  const c = useMemo(() => contributors(v, quotes.status === 'ready' ? quotes.data.quotes : {}, vols, today), [v, quotes, vols, today]);
  const [open, setOpen] = useState<Contributor | null>(null);
  if (!v.rows.length && !v.optionRows.length) return null;
  return (
    <>
      <div className={s.pair}>
        <MoverList tone="up" title={t('dc.gainers')} items={c.gainers} empty={t('dc.noGainers')} onOpen={setOpen} />
        <MoverList tone="down" title={t('dc.losers')} items={c.losers} empty={t('dc.noLosers')} onOpen={setOpen} />
      </div>
      <MoverSheet item={open} onClose={() => setOpen(null)} />
    </>
  );
}

function MoverList({ tone, title, items, empty, onOpen }: { tone: 'up' | 'down'; title: string; items: Contributor[]; empty: string; onOpen: (c: Contributor) => void }) {
  return (
    <section className={[s.card, tone === 'up' ? s.green : s.red].join(' ')} aria-label={title}>
      <h3 className={s.cardTitle}>{title}</h3>
      {items.length === 0 ? (
        <p className={s.empty}>{empty}</p>
      ) : (
        <ul className={s.rows}>
          {items.map((c) => (
            <li key={c.key}>
              <button type="button" className={s.row} onClick={() => onOpen(c)}>
                <span className={s.name}>
                  {c.name}
                </span>
                <span className={`num ${tone}`}>
                  {formatSignedMoney(c.pnl)} <small>({formatPercent(c.pnlPct, { signed: true })})</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MoverSheet({ item, onClose }: { item: Contributor | null; onClose: () => void }) {
  const titleId = useId();
  const earn = useNextEarnings(item?.sym ?? null);
  const news = useOfficialNews();
  const filings = item && news.status === 'ready' ? news.data.filter((n) => n.sym === item.sym).slice(0, 3) : [];
  if (!item) return null;
  const up = item.pnl >= 0;
  return (
    <Sheet open onClose={onClose} title={item.name} labelledBy={titleId}>
      <div className={s.sheet}>
        <dl className={s.facts}>
          <div>
            <dt>{t('dc.openPnl')}</dt>
            <dd className={`num ${up ? 'up' : 'down'}`}>
              {formatSignedMoney(item.pnl)} ({formatPercent(item.pnlPct, { signed: true })})
            </dd>
          </div>
          {item.today != null && (
            <div>
              <dt>{t('dc.today')}</dt>
              <dd className={`num ${item.today >= 0 ? 'up' : 'down'}`}>
                {formatSignedMoney(item.today)}
                {item.todayPct != null && ` (${formatPercent(item.todayPct, { signed: true })})`}
              </dd>
            </div>
          )}
          <div>
            <dt>{item.kind === 'option' ? t('dc.contractNow') : t('dc.priceNow')}</dt>
            <dd className="num">{formatPrice(item.last)}</dd>
          </div>
        </dl>
        <p className={s.why}>{t(up ? 'dc.whyUp' : 'dc.whyDown', { name: item.name, amt: formatMoney(Math.abs(item.pnl)) })}</p>
        {item.kind === 'option' && <p className={s.muted}>{t('dc.optionNote', { sym: item.sym })}</p>}
        <h4 className={s.sub}>{t('dc.context', { sym: item.sym })}</h4>
        <ul className={s.context}>
          <li>{earn ? t('dc.earnings', { date: formatDate(earn.date + 'T12:00:00Z') }) : t('dc.noEarnings')}</li>
          {filings.map((f) => (
            <li key={f.id}>
              <a href={f.url} target="_blank" rel="noopener noreferrer">
                {f.title}
              </a>{' '}
              <span className={s.muted}>· {formatDate(f.at)}</span>
            </li>
          ))}
          {!filings.length && <li className={s.muted}>{t('dc.noNews')}</li>}
        </ul>
        <Link className={buttonClass({ variant: 'primary', block: true })} to={item.to}>
          {item.kind === 'option' ? t('dc.openPosition') : t('dc.openChart', { sym: item.sym })}
        </Link>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------------ pending orders / market movers
export function PendingPanel({ uid }: { uid: string }) {
  const acct = usePracticeAccount(uid);
  if (acct.status !== 'ready' || !acct.data) return null;
  return acct.data.orders.length ? <PendingOrders orders={acct.data.orders} /> : <MarketMovers />;
}

function orderLine(o: Order): string {
  const side = o.side === 'buy' ? t('trade.buy') : t('trade.sell');
  const what = o.opt ? (o.label ?? o.sym) : o.sym;
  const how = o.opt ? t('trade.market') : o.type === 'market' ? t('trade.market') : o.type === 'limit' ? `${t('trade.limit')} ${formatPrice(o.limit)}` : `${t('trade.stop')} ${formatPrice(o.stop)}`;
  const role = o.role === 'sl' ? ` · ${t('trade.stopLoss')}` : o.role === 'tp' ? ` · ${t('trade.takeProfit')}` : '';
  return `${side} ${o.qty} ${what} · ${how}${role}`;
}

function PendingOrders({ orders }: { orders: Order[] }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<Order | null>(null);
  const quotes = useQuotes();
  const marketOpen = quotes.status === 'ready' ? quotes.data.marketOpen : true;
  const titleId = useId();
  const cancel = (o: Order) => {
    setBusy(o.id);
    cancelOrder(o.id)
      .then(() => {
        toast.show(t('practice.cancelled'), 'success');
        setOpen(null);
      })
      .catch((e) => toast.show(errorMessage(e), 'error'))
      .finally(() => setBusy(null));
  };
  return (
    <Card title={t('practice.orders')} flush>
      <ul className={s.bars}>
        {orders.map((o) => (
          <li key={o.id} className={s.bar}>
            <button type="button" className={s.barMain} onClick={() => setOpen(o)} aria-haspopup="dialog">
              <span className={[s.side, o.side === 'buy' ? s.buy : s.sell].join(' ')}>{o.side === 'buy' ? t('trade.buy') : t('trade.sell')}</span>
              <span className={s.barText}>{orderLine(o).replace(/^\S+ /, '')}</span>
              <span className={s.pending}>{t('dc.pending')}</span>
            </button>
            <Button variant="ghost" size="sm" disabled={busy != null} onClick={() => cancel(o)} aria-label={`${t('orders.cancel')}: ${orderLine(o)}`}>
              {busy === o.id ? t('orders.cancelling') : t('dc.cancel')}
            </Button>
          </li>
        ))}
      </ul>
      {open && (
        <Sheet open onClose={() => setOpen(null)} title={orderLine(open)} labelledBy={titleId}>
          <div className={s.sheet}>
            <dl className={s.facts}>
              <div>
                <dt>{t('dc.status')}</dt>
                <dd>{t('dc.pending')}</dd>
              </div>
              <div>
                <dt>{t('dc.type')}</dt>
                <dd>{open.opt ? t('dc.optionMarket') : t(`dc.type.${open.type}`)}</dd>
              </div>
              <div>
                <dt>{t('dc.qty')}</dt>
                <dd className="num">{open.qty}</dd>
              </div>
              {open.limit != null && (
                <div>
                  <dt>{t('trade.limit')}</dt>
                  <dd className="num">{formatPrice(open.limit)}</dd>
                </div>
              )}
              {open.stop != null && (
                <div>
                  <dt>{t('trade.stop')}</dt>
                  <dd className="num">{formatPrice(open.stop)}</dd>
                </div>
              )}
              {open.opt && open.est > 0 && (
                <div>
                  <dt>{t('dc.estCost')}</dt>
                  <dd className="num">{formatMoney(open.est)}</dd>
                </div>
              )}
              <div>
                <dt>{t('dc.lasts')}</dt>
                <dd>{open.tif === 'gtc' ? t('dc.gtc') : t('dc.day')}</dd>
              </div>
              <div>
                <dt>{t('dc.placed')}</dt>
                <dd>{new Date(open.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</dd>
              </div>
              {open.bracket && (open.bracket.sl != null || open.bracket.tp != null) && (
                <div>
                  <dt>{t('dc.bracket')}</dt>
                  <dd className="num">
                    {open.bracket.sl != null && `${t('trade.stopLoss')} ${formatPrice(open.bracket.sl)}`}
                    {open.bracket.sl != null && open.bracket.tp != null && ' · '}
                    {open.bracket.tp != null && `${t('trade.takeProfit')} ${formatPrice(open.bracket.tp)}`}
                  </dd>
                </div>
              )}
            </dl>
            <p className={s.muted}>{waiting(open, marketOpen)}</p>
            <Button variant="danger" block disabled={busy != null} onClick={() => cancel(open)}>
              {busy === open.id ? t('orders.cancelling') : t('orders.cancel')}
            </Button>
          </div>
        </Sheet>
      )}
    </Card>
  );
}

function waiting(o: Order, marketOpen: boolean): string {
  if (!marketOpen) return t('orders.waitOpen');
  if (o.type === 'limit' && o.limit != null) return t('orders.waitPrice', { price: formatPrice(o.limit) });
  if (o.type === 'stop' && o.stop != null) return t('orders.waitPrice', { price: formatPrice(o.stop) });
  return t('orders.waitNext');
}

/** Two small cards that cycle through today's market gainers and losers (real stock movers). */
function MarketMovers() {
  const movers = useMovers();
  const tick = useNow(4000);
  if (movers.status === 'loading') return <Skeleton height={86} />;
  if (movers.status !== 'ready') return null;
  const up = movers.data.gainers.slice(0, 5);
  const down = movers.data.losers.slice(0, 5);
  if (!up.length && !down.length) return null;
  const i = Math.floor(tick / 4000);
  return (
    <div className={s.pair} aria-label={t('dc.marketMovers')}>
      <MoverTicker tone="up" title={t('dc.mktGainers')} list={up} i={i} />
      <MoverTicker tone="down" title={t('dc.mktLosers')} list={down} i={i} />
    </div>
  );
}

function MoverTicker({ tone, title, list, i }: { tone: 'up' | 'down'; title: string; list: Mover[]; i: number }) {
  const [still] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  if (!list.length) return null;
  const k = still ? 0 : i % list.length;
  const m = list[k]!;
  return (
    <Link to={`/markets/${m.sym}`} className={[s.card, s.ticker, tone === 'up' ? s.green : s.red].join(' ')} aria-label={`${title}: ${m.sym} ${formatPercent(m.chPct, { signed: true })}`}>
      <span className={s.cardTitle}>{title}</span>
      <span key={m.sym} className={s.tickRow}>
        <b>{m.sym}</b>
        <span className={s.tickName}>{instrument(m.sym)?.name ?? m.name}</span>
        <span className={`num ${tone}`}>{formatPercent(m.chPct, { signed: true })}</span>
      </span>
      <span className={s.dots} aria-hidden>
        {list.map((x, j) => (
          <i key={x.sym} className={j === k ? s.dotOn : undefined} />
        ))}
      </span>
    </Link>
  );
}

