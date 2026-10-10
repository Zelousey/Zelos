/**
 * The live match: your match account (moving with live prices), the trade ticket and chart,
 * your positions (Close, stop-loss / take-profit), the leaderboard, the Battlefield Ticker,
 * Last Man Standing, storms and the Bounty Board. The server prices and checks every trade.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { QuotesDoc } from '../../data/markets';
import { instrument } from '../../data/universe';
import { formatMoney, formatPercent, formatPrice, formatRelative, formatSignedMoney } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Badge, Button, Card, Change, EmptyState, Field, useToast } from '../../ui';
import { ChartView } from '../charts/ChartView';
import { TIMEFRAMES } from '../charts/series';
import { useSymbolBars } from '../charts/useSymbolBars';
import { errorText } from '../invites/invites';
import { allowedSymbols, liveEquity, OUT_REASON, placeBounty, setBracket, spendShield, standings, stormNow, trade, tradable, type Account, type Battle, type Book, type Position, type TickerEvent } from './battle';
import { clock, RulesBox } from './parts';
import s from './Battles.module.css';

type Props = { b: Battle; uid: string; accounts: Account[]; me: Account | null; book: Book; events: TickerEvent[]; quotes: QuotesDoc | null; now: number };

export function LiveView({ b, uid, accounts, me, book, events, quotes, now }: Props) {
  const qs = useMemo(() => quotes?.quotes ?? {}, [quotes]);
  const syms = useMemo(() => allowedSymbols(b, uid), [b, uid]);
  const [sym, setSym] = useState(() => book.positions[0]?.sym ?? syms[0] ?? 'AAPL');
  const storm = stormNow(b.storm, now);
  const live = me ? liveEquity(me.cash, book.positions, qs) : 0;
  const pnl = me ? live - me.start : 0;
  const rows = useMemo(() => standings(accounts, b), [accounts, b]);
  const wanted = new Set(b.bounties.filter((x) => x.status === 'open').map((x) => x.target));

  return (
    <div className={s.live}>
      {storm && (
        <div className={s.storm} role="status">
          ⛈️ {t(`bt.storm.${storm.kind}`, { sym: storm.sym ?? '' })} · {clock(storm.end - now)}
        </div>
      )}
      {b.lms && b.alive && (
        <div className={s.lmsBar}>
          <b>{t('bt.lms.standing', { n: b.alive.length, of: b.players.length })}</b>
          {b.nextCutAt && <span>{t('bt.lms.nextCut', { t: clock(b.nextCutAt - now) })}</span>}
        </div>
      )}
      {me?.out && (
        <Card pad className={s.outCard}>
          <b>{t('bt.youreOut')}</b>
          <span>{me.outReason ? (OUT_REASON[me.outReason] ?? me.outReason) : ''}</span>
          <span className={s.muted}>{t('bt.outPlace', { n: me.place ?? '—' })}</span>
        </Card>
      )}

      <div className={s.cols}>
        <div className={s.stack}>
          <Card pad>
            <div className={s.acct}>
              <span className={s.kicker}>{t('bt.yourAccount')}</span>
              <span className={s.big}>{formatMoney(live)}</span>
              <Change abs={pnl} pct={me?.start ? (pnl / me.start) * 100 : 0} />
              <span className={s.muted}>{t('bt.cashLine', { cash: formatMoney(me?.cash ?? 0), start: formatMoney(me?.start ?? b.buyIn, { digits: 0 }) })}</span>
            </div>
          </Card>
          {!me?.out && <Ticket b={b} uid={uid} me={me} book={book} quotes={quotes} sym={sym} setSym={setSym} syms={syms} now={now} />}
          <Positions b={b} book={book} quotes={quotes} now={now} disabled={!!me?.out} onPick={setSym} />
        </div>
        <div className={s.stack}>
          <Card title={t('bt.leaderboard')} subtitle={t('bt.leaderboardSub')} flush>
            <ol className={s.board}>
              {rows.map((r) => (
                <li key={r.uid} className={r.uid === uid ? s.mine : undefined}>
                  <span className={s.rank}>{r.rank}</span>
                  <Link to={`/profile/${r.uid}`} className={s.name}>
                    {r.name}
                  </Link>
                  <span className={s.tags}>
                    {r.out && <Badge tone="down">{t('bt.outTag')}</Badge>}
                    {b.whales.includes(r.uid) && <Badge tone="violet">{t('bt.whaleTag')}</Badge>}
                    {(b.shields[r.uid] ?? 0) > 0 && <Badge>{t('bt.shieldTag', { n: b.shields[r.uid]! })}</Badge>}
                    {wanted.has(r.uid) && <Badge tone="gold">{t('bt.wantedTag')}</Badge>}
                  </span>
                  <span className={[s.pct, r.pnlPct >= 0 ? s.up : s.down].join(' ')}>{formatPercent(r.pnlPct)}</span>
                </li>
              ))}
            </ol>
          </Card>
          {b.modes.bounties && <Bounties b={b} uid={uid} me={me} now={now} />}
          <Card title={t('bt.ticker')} flush>
            {events.length ? (
              <ul className={s.ticker}>
                {events.map((e) => (
                  <li key={e.id}>
                    <span>{e.text}</span>
                    <small className={s.muted}>{formatRelative(e.at)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={s.note}>{t('bt.tickerEmpty')}</p>
            )}
          </Card>
          {b.lms && b.outs.length > 0 && (
            <Card title={t('bt.eliminations')} flush>
              <ul className={s.list}>
                {b.outs.map((o) => (
                  <li key={o.uid}>
                    <span>{o.name}</span>
                    <small className={s.muted}>
                      {OUT_REASON[o.reason] ?? o.reason} · {formatPercent(o.pnlPct)}
                    </small>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <RulesBox b={b} />
        </div>
      </div>
    </div>
  );
}

function Ticket({ b, uid, me, book, quotes, sym, setSym, syms, now }: { b: Battle; uid: string; me: Account | null; book: Book; quotes: QuotesDoc | null; sym: string; setSym: (s: string) => void; syms: string[]; now: number }) {
  const toast = useToast();
  const [qty, setQty] = useState('1');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [busy, setBusy] = useState(false);
  const { built, loading } = useSymbolBars(sym, '15m');
  const tf = TIMEFRAMES.find((x) => x.id === '15m')!;
  const price = quotes?.quotes[sym]?.c ?? null;
  const held = book.positions.find((p) => p.sym === sym)?.qty ?? 0;
  const gate = tradable(quotes, now);
  const storm = stormNow(b.storm, now);
  const halted = storm?.kind === 'halt' && storm.sym === sym;
  const n = Number(qty);
  const okQty = Number.isInteger(n) && n >= 1;
  const cost = okQty && price ? n * price : 0;
  const slN = sl ? Number(sl) : null;
  const tpN = tp ? Number(tp) : null;
  const bracketErr = b.modes.stops && price && ((slN != null && !(slN > 0 && slN < price)) || (tpN != null && !(tpN > price))) ? t('bt.bracketBad') : null;
  const why = !gate.ok ? t(gate.why === 'stale' ? 'bt.stale' : 'bt.closed') : halted ? t('bt.halted', { sym }) : !price ? t('bt.noPrice', { sym }) : null;
  const whale = b.whales.includes(uid) && b.modes.whale ? b.modes.whale.capPct : null;

  async function go(side: 'buy' | 'sell') {
    if (!okQty || !price) return;
    setBusy(true);
    try {
      const r = await trade({ warId: b.id, sym, side, qty: n, ...(side === 'buy' && slN ? { sl: slN } : {}), ...(side === 'buy' && tpN ? { tp: tpN } : {}) });
      toast.show(t(side === 'buy' ? 'bt.bought' : 'bt.sold', { qty: r.fill.qty, sym, price: formatPrice(r.fill.price) }), 'success');
      if (r.out) toast.show(t('bt.knockedOut'), 'error');
      setSl('');
      setTp('');
    } catch (e) {
      toast.show(errorText(e, t('bt.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!syms.length) return <EmptyState icon="war" body={t('bt.noSymbols')} compact />;
  return (
    <Card title={t('bt.trade')} pad>
      <div className={s.ticket}>
        <label className={s.select}>
          {t('opt.stock')}
          <select value={sym} onChange={(e) => setSym(e.target.value)}>
            {syms.map((x) => (
              <option key={x} value={x}>
                {x} · {instrument(x)?.name ?? x}
              </option>
            ))}
          </select>
        </label>
        <div className={s.chart}>
          {built.bars.length === 0 && !loading ? <EmptyState icon="chart" body={t('chart.noIntraday')} compact /> : <ChartView sym={sym} seriesKey={`${sym}:15m:battle`} bars={built.bars} live={built.live} intraday={built.intraday} range={tf.def} style="line" loading={loading} label={t('chart.label', { sym, tf: tf.label })} />}
        </div>
        <p className={s.priceLine}>
          <b className="num">{price ? formatPrice(price) : '—'}</b> <span className={s.muted}>{t('bt.youHold', { n: held })}</span>
        </p>
        <Field label={t('bt.shares')} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ''))} hint={okQty && price ? t('bt.estimate', { cost: formatMoney(cost), cash: formatMoney(me?.cash ?? 0) }) : undefined} />
        {b.modes.stops && (
          <div className={s.row2}>
            <Field label={t('trade.stopLoss')} prefix="$" inputMode="decimal" value={sl} onChange={(e) => setSl(e.target.value)} />
            <Field label={t('trade.takeProfit')} prefix="$" inputMode="decimal" value={tp} onChange={(e) => setTp(e.target.value)} error={bracketErr ?? undefined} />
          </div>
        )}
        {whale != null && <p className={s.note}>{t('bt.whaleCap', { n: whale })}</p>}
        {why && <p className={s.warn}>{why}</p>}
        <div className={s.row2}>
          <Button variant="buy" size="lg" disabled={busy || !!why || !okQty || !!bracketErr || cost > (me?.cash ?? 0) + 0.005} onClick={() => void go('buy')}>
            {t('trade.buy')}
          </Button>
          <Button variant="sell" size="lg" disabled={busy || !!why || !okQty || n > held} onClick={() => void go('sell')}>
            {t('trade.sell')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Positions({ b, book, quotes, now, disabled, onPick }: { b: Battle; book: Book; quotes: QuotesDoc | null; now: number; disabled: boolean; onPick: (s: string) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [edit, setEdit] = useState<Position | null>(null);
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const gate = tradable(quotes, now);
  async function close(p: Position) {
    setBusy(p.sym);
    try {
      const r = await trade({ warId: b.id, sym: p.sym, side: 'sell', qty: p.qty });
      toast.show(t('bt.sold', { qty: r.fill.qty, sym: p.sym, price: formatPrice(r.fill.price) }), 'success');
    } catch (e) {
      toast.show(errorText(e, t('bt.failed')), 'error');
    } finally {
      setBusy(null);
    }
  }
  async function saveBracket(clear = false) {
    if (!edit) return;
    setBusy(edit.sym);
    try {
      await setBracket(b.id, edit.sym, clear || !sl ? null : Number(sl), clear || !tp ? null : Number(tp));
      toast.show(t('bt.bracketSaved'), 'success');
      setEdit(null);
    } catch (e) {
      toast.show(errorText(e, t('bt.failed')), 'error');
    } finally {
      setBusy(null);
    }
  }
  return (
    <Card title={t('bt.positions')} flush>
      {!book.positions.length ? (
        <p className={s.note}>{t('bt.noPositions')}</p>
      ) : (
        <ul className={s.positions}>
          {book.positions.map((p) => {
            const last = quotes?.quotes[p.sym]?.c ?? p.avg;
            const pl = (last - p.avg) * p.qty;
            return (
              <li key={p.sym}>
                <button type="button" className={s.posSym} onClick={() => onPick(p.sym)}>
                  {p.sym}
                </button>
                <span className={s.muted}>
                  {p.qty} × {formatPrice(p.avg)}
                  {(p.sl || p.tp) && ` · ${t('bt.bracketShort', { sl: p.sl ? formatPrice(p.sl) : '—', tp: p.tp ? formatPrice(p.tp) : '—' })}`}
                </span>
                <span className={[s.pct, pl >= 0 ? s.up : s.down].join(' ')}>{formatSignedMoney(pl)}</span>
                <span className={s.posActions}>
                  {b.modes.stops && !disabled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEdit(p);
                        setSl(p.sl ? String(p.sl) : '');
                        setTp(p.tp ? String(p.tp) : '');
                      }}
                      aria-label={t('bt.editBracket', { sym: p.sym })}
                    >
                      {t('bt.stops')}
                    </Button>
                  )}
                  {!disabled && (
                    <Button variant="secondary" size="sm" disabled={busy === p.sym || !gate.ok} onClick={() => void close(p)} aria-label={t('bt.closeLabel', { sym: p.sym })}>
                      {t('practice.close')}
                    </Button>
                  )}
                </span>
                {edit?.sym === p.sym && (
                  <form
                    className={s.bracketForm}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveBracket();
                    }}
                  >
                    <Field label={t('trade.stopLoss')} prefix="$" inputMode="decimal" value={sl} onChange={(e) => setSl(e.target.value)} />
                    <Field label={t('trade.takeProfit')} prefix="$" inputMode="decimal" value={tp} onChange={(e) => setTp(e.target.value)} />
                    <span className={s.row2}>
                      <Button type="submit" variant="primary" size="sm" disabled={busy === p.sym}>
                        {t('bt.save')}
                      </Button>
                      <Button variant="ghost" size="sm" disabled={busy === p.sym} onClick={() => void saveBracket(true)}>
                        {t('bt.clearStops')}
                      </Button>
                    </span>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Bounties({ b, uid, me, now }: { b: Battle; uid: string; me: Account | null; now: number }) {
  const toast = useToast();
  const [target, setTarget] = useState('');
  const [pct, setPct] = useState<2 | 5 | 10>(5);
  const [hours, setHours] = useState<6 | 24>(24);
  const [busy, setBusy] = useState(false);
  const open = b.bounties.filter((x) => x.status === 'open');
  const rivals = b.players.filter((p) => p !== uid && !(b.outs ?? []).some((o) => o.uid === p));
  const myShields = b.shields[uid] ?? 0;
  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.show(ok, 'success');
    } catch (e) {
      toast.show(errorText(e, t('bt.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title={t('bt.bounties')} subtitle={t('bt.bountiesSub')} pad>
      {open.length ? (
        <ul className={s.list}>
          {open.map((x) => (
            <li key={x.id}>
              <span>{t('bt.bountyLine', { by: x.byName, target: x.targetName, amount: formatMoney(x.amount) })}</span>
              <small className={s.muted}>{t('bt.endsIn', { t: clock(x.end - now) })}</small>
              {x.target === uid && myShields > 0 && (
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => void run(() => spendShield(b.id, x.id), t('bt.shielded'))}>
                  {t('bt.useShield')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.muted}>{t('bt.noBounties')}</p>
      )}
      {me && !me.out && rivals.length > 0 && (
        <form
          className={s.bountyForm}
          onSubmit={(e) => {
            e.preventDefault();
            if (target) void run(() => placeBounty(b.id, target, pct, hours), t('bt.bountyPlaced'));
          }}
        >
          <label className={s.select}>
            {t('bt.bountyOn')}
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">{t('bt.pickRival')}</option>
              {rivals.map((p) => (
                <option key={p} value={p}>
                  {b.names[p] ?? 'Trader'}
                </option>
              ))}
            </select>
          </label>
          <label className={s.select}>
            {t('bt.bountyStake')}
            <select value={pct} onChange={(e) => setPct(Number(e.target.value) as 2 | 5 | 10)}>
              {[2, 5, 10].map((p) => (
                <option key={p} value={p}>
                  {t('bt.stakePct', { n: p, amount: formatMoney(((me.equity || me.start) * p) / 100) })}
                </option>
              ))}
            </select>
          </label>
          <label className={s.select}>
            {t('bt.bountyFor')}
            <select value={hours} onChange={(e) => setHours(Number(e.target.value) as 6 | 24)}>
              <option value={6}>{t('bt.hours', { n: 6 })}</option>
              <option value={24}>{t('bt.hours', { n: 24 })}</option>
            </select>
          </label>
          <Button type="submit" variant="primary" disabled={busy || !target}>
            {t('bt.placeBounty')}
          </Button>
        </form>
      )}
    </Card>
  );
}
