/**
 * Options (/options, /options/:sym): buy calls and puts on any Zelos stock with the practice
 * account, and sell them back. Prices are MODELED (see model.ts) and the page says so; the
 * server re-prices and fills every order on the next price update after it's placed.
 */
import { useId, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { SYMBOL_RE, useQuotes } from '../../data/markets';
import { instrument, UNIVERSE } from '../../data/universe';
import { useAuth } from '../../lib/auth';
import { formatDate, formatMoney, formatPercent, formatPrice } from '../../lib/format';
import { t } from '../../lib/i18n';
import { readString, writeString } from '../../lib/storage';
import { Badge, Button, buttonClass, Card, Change, EmptyState, Field, LoadingState, PageHeader, Sheet, Tabs, useToast } from '../../ui';
import { nyDay } from '../charts/series';
import { usePracticeAccount, valueAccount, type Account } from '../practice/account';
import { cancelOrder, errorMessage } from '../practice/actions';
import { placeOptionOrder } from './actions';
import { daysTo, expirations, label, MAX_CONTRACTS, quote, strikes, useVolMap, volFor, type Kind, type OptionQuote } from './model';
import { OptionPositions } from './OptionPositions';
import s from './Options.module.css';

const SYM_KEY = 'zelosAppOptionsSym';
const NEAR = 5; // strikes shown each side of the money until "Show all strikes"

type Pick = { strike: number; q: OptionQuote };

export default function OptionsPage() {
  const raw = (useParams().sym ?? '').toUpperCase();
  const navigate = useNavigate();
  const remembered = readString(SYM_KEY);
  const sym = SYMBOL_RE.test(raw) && instrument(raw) ? raw : remembered && instrument(remembered) ? remembered : 'AAPL';
  const { user, isReal } = useAuth();
  const uid = isReal && user ? user.uid : null;
  const acctState = usePracticeAccount(uid);
  const acct = acctState.status === 'ready' ? acctState.data : null;
  const quotes = useQuotes();
  const vols = useVolMap();
  const [today] = useState(() => nyDay(Date.now()));
  const exps = useMemo(() => expirations(today), [today]);
  const [exp, setExp] = useState(exps[2] ?? exps[0]!);
  const [kind, setKind] = useState<Kind>('call');
  const [all, setAll] = useState(false);
  const [pick, setPick] = useState<Pick | null>(null);
  const selectId = useId();
  const expId = useId();

  const qs = quotes.status === 'ready' ? quotes.data.quotes : null;
  const live = qs?.[sym];
  const S = live?.c;
  const vol = volFor(vols, sym);
  const chain = useMemo(() => {
    if (!S) return [];
    const list = strikes(S);
    const atm = list.reduce((b, k, i) => (Math.abs(k - S) < Math.abs(list[b]! - S) ? i : b), 0);
    return list.map((k, i) => ({ strike: k, q: quote(kind, S, k, exp, today, vol), itm: kind === 'call' ? k < S : k > S, atm: i === atm, near: Math.abs(i - atm) <= NEAR }));
  }, [S, kind, exp, today, vol]);
  const v = useMemo(() => (acct && qs ? valueAccount(acct, qs, today, vols) : null), [acct, qs, today, vols]);
  const optOrders = acct?.orders.filter((o) => o.opt) ?? [];

  const choose = (next: string) => {
    writeString(SYM_KEY, next);
    navigate(`/options/${next}`, { replace: true });
  };

  return (
    <>
      <PageHeader title={t('nav.options')} subtitle={t('opt.subtitle')} actions={<Badge tone="accent">{t('practice.virtual')}</Badge>} />
      <div className={s.page}>
        <Card pad>
          <div className={s.controls}>
            <label className={s.select} htmlFor={selectId}>
              {t('opt.stock')}
              <select id={selectId} value={sym} onChange={(e) => choose(e.target.value)}>
                {UNIVERSE.map((i) => (
                  <option key={i.sym} value={i.sym}>
                    {i.sym} · {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={s.select} htmlFor={expId}>
              {t('opt.expiry')}
              <select id={expId} value={exp} onChange={(e) => setExp(e.target.value)}>
                {exps.map((e) => (
                  <option key={e} value={e}>
                    {formatDate(e + 'T12:00:00Z')} · {t('opt.days', { n: daysTo(e, today) })}
                  </option>
                ))}
              </select>
            </label>
            <Tabs label={t('opt.kind')} value={kind} onChange={setKind} items={[{ value: 'call', label: t('opt.calls') }, { value: 'put', label: t('opt.puts') }]} />
          </div>
          <p className={s.stockLine}>
            <Link to={`/markets/${sym}`} className={s.stockSym}>
              {sym}
            </Link>{' '}
            {live ? (
              <>
                <span className="num">{formatPrice(live.c)}</span> {live.pc ? <Change abs={live.c - live.pc} pct={(live.c / live.pc - 1) * 100} /> : null}
              </>
            ) : null}
            <span className={s.sub}>{t('opt.vol', { v: formatPercent(vol * 100, { digits: 0, signed: false }) })}</span>
          </p>
          <p className={s.explain}>{kind === 'call' ? t('opt.callExplain') : t('opt.putExplain')}</p>
        </Card>

        <Card flush title={t('opt.chain', { kind: kind === 'call' ? t('opt.calls') : t('opt.puts'), date: formatDate(exp + 'T12:00:00Z') })}>
          {quotes.status === 'loading' ? (
            <LoadingState rows={6} />
          ) : !S ? (
            <EmptyState icon="options" body={t('opt.noPrice', { sym })} compact />
          ) : (
            <>
              <div className={s.tableWrap} tabIndex={0} role="region" aria-label={t('opt.chainLabel')}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th scope="col">{t('opt.col.strike')}</th>
                      <th scope="col">{t('opt.col.bid')}</th>
                      <th scope="col">{t('opt.col.ask')}</th>
                      <th scope="col" className={s.wide}>
                        {t('opt.col.delta')}
                      </th>
                      <th scope="col" className={s.wide}>
                        {t('opt.col.breakeven')}
                      </th>
                      <th scope="col">
                        <span className="visually-hidden">{t('col.actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="num">
                    {chain
                      .filter((r) => all || r.near)
                      .map((r) => (
                        <tr key={r.strike} className={[r.itm ? s.itm : '', r.atm ? s.atm : ''].join(' ')}>
                          <td>
                            {formatPrice(r.strike)}
                            {r.atm && <span className={s.tag}>{t('opt.atm')}</span>}
                          </td>
                          <td>{formatPrice(r.q.bid)}</td>
                          <td>{formatPrice(r.q.ask)}</td>
                          <td className={s.wide}>{r.q.delta.toFixed(2)}</td>
                          <td className={s.wide}>{formatPrice(kind === 'call' ? r.strike + r.q.ask : r.strike - r.q.ask)}</td>
                          <td>
                            <Button size="sm" variant="buy" onClick={() => setPick({ strike: r.strike, q: r.q })} aria-label={t('opt.buyLabel', { label: label({ u: sym, kind, strike: r.strike, exp }) })}>
                              {t('trade.buy')}
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className={s.chainFoot}>
                <Button variant="ghost" size="sm" onClick={() => setAll(!all)}>
                  {all ? t('opt.fewer') : t('opt.all', { n: chain.length })}
                </Button>
              </div>
            </>
          )}
          <p className={s.note}>{t('opt.modeled')}</p>
        </Card>

        {uid && acct && v && (
          <div className={s.cols}>
            <Card flush title={t('opt.positions')} subtitle={v.optionRows.length ? formatMoney(v.optionValue) : undefined}>
              <OptionPositions acct={acct} rows={v.optionRows} empty />
              <p className={s.note}>{t('opt.settleNote')}</p>
            </Card>
            <Card flush title={t('practice.orders')}>
              {optOrders.length === 0 ? <EmptyState icon="inbox" body={t('practice.orders.empty')} compact /> : optOrders.map((o) => <OpenOrder key={o.id} id={o.id} text={`${o.side === 'buy' ? t('trade.buy') : t('trade.sell')} ${o.qty} ${o.label ?? o.sym}`} />)}
              <p className={s.note}>{t('opt.fillNote')}</p>
            </Card>
          </div>
        )}
        {(!uid || acctState.status === 'missing') && (
          <Card>
            <EmptyState icon="practice" body={uid ? t('opt.needAccount') : t('practice.signIn')} actions={<Link className={buttonClass({ variant: 'primary' })} to="/practice">{t('trade.openAccount')}</Link>} compact />
          </Card>
        )}
      </div>
      {pick && S && <BuySheet key={`${sym}${exp}${kind}${pick.strike}`} sym={sym} kind={kind} exp={exp} pick={pick} acct={acct} buyingPower={v?.buyingPower ?? null} onClose={() => setPick(null)} />}
    </>
  );
}

function OpenOrder({ id, text }: { id: string; text: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <div className={s.orderRow}>
      <span className={s.orderText}>{text}</span>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        aria-label={`${t('practice.cancel')}: ${text}`}
        onClick={() => {
          setBusy(true);
          cancelOrder(id)
            .then(() => toast.show(t('practice.cancelled'), 'success'))
            .catch((e) => toast.show(errorMessage(e), 'error'))
            .finally(() => setBusy(false));
        }}
      >
        {t('practice.cancel')}
      </Button>
    </div>
  );
}

function BuySheet({ sym, kind, exp, pick, acct, buyingPower, onClose }: { sym: string; kind: Kind; exp: string; pick: Pick; acct: Account | null; buyingPower: number | null; onClose: () => void }) {
  const toast = useToast();
  const [qty, setQty] = useState('1');
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const n = Number(qty);
  const valid = Number.isInteger(n) && n >= 1 && n <= MAX_CONTRACTS;
  const cost = valid ? pick.q.ask * 100 * n : 0;
  const short = valid && buyingPower != null && cost > buyingPower + 0.005;
  const name = label({ u: sym, kind, strike: pick.strike, exp });
  const err = qty && !valid ? t('opt.qtyRange', { max: MAX_CONTRACTS }) : short ? t('opt.short', { bp: formatMoney(buyingPower) }) : undefined;
  return (
    <Sheet open onClose={onClose} title={t('opt.buyTitle', { label: name })} labelledBy={titleId}>
      <div className={s.sheet}>
        <dl className={s.facts}>
          <div>
            <dt>{t('opt.perShare')}</dt>
            <dd className="num">{formatPrice(pick.q.ask)}</dd>
          </div>
          <div>
            <dt>{t('opt.col.breakeven')}</dt>
            <dd className="num">{formatPrice(kind === 'call' ? pick.strike + pick.q.ask : pick.strike - pick.q.ask)}</dd>
          </div>
          <div>
            <dt>{t('opt.daysLeft')}</dt>
            <dd className="num">{pick.q.dte}</dd>
          </div>
        </dl>
        <Field label={t('opt.contracts')} type="number" inputMode="numeric" min={1} max={MAX_CONTRACTS} step={1} value={qty} onChange={(e) => setQty(e.target.value)} hint={t('opt.each')} error={err} />
        <p className={s.total}>
          {t('opt.total')} <b className="num">{formatMoney(cost)}</b>
          {buyingPower != null && <span className={s.sub}>{t('opt.bp', { bp: formatMoney(buyingPower) })}</span>}
        </p>
        <p className={s.sub}>{t('opt.risk', { cost: formatMoney(cost) })}</p>
        <div className={s.sheetActions}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="buy"
            disabled={!acct || !valid || short || busy}
            onClick={() => {
              setBusy(true);
              placeOptionOrder({ u: sym, type: kind, strike: pick.strike, exp, side: 'buy', qty: n })
                .then(() => {
                  toast.show(t('opt.placed'), 'success');
                  onClose();
                })
                .catch((e) => toast.show(errorMessage(e), 'error'))
                .finally(() => setBusy(false));
            }}
          >
            {t('opt.buyN', { n: valid ? n : 0 })}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
