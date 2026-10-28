/**
 * Strategies (/strategies, in the Trade War hub; owner decision 2026-10-09): the Zelos
 * strategies, easy to find and buy. Each card says what the strategy looks for, shows its
 * latest alert and sells a 7-day pass for tokens; one tap opens the strategy (/strategies/:id).
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../lib/auth';
import { formatDate, formatRelative } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { Badge, Button, Card, Confirm, Icon, PageHeader, Skeleton, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { buyPass, passPrice, passUntil, STRATEGIES, useAlerts, type Alert, type PassDays, type Strategy, type WalletDoc, type WalletInfo } from './strategies';
import { StrategyArt } from './StrategyArt';
import { TokensSheet, useTokens } from './Tokens';
import s from './Strategies.module.css';
import { TradeWarNav } from '../tradewar/TradeWarNav';

export default function StrategiesPage() {
  const tk = useTokens();
  const [sheet, setSheet] = useState(false);
  const alerts = useAlerts();
  const list = alerts.status === 'ready' ? alerts.data : [];
  return (
    <>
      <PageHeader title={t('nav.strategies')} subtitle={t('st.subtitle')} />
      <TradeWarNav />
      <div className={s.list}>
        {STRATEGIES.map((x) => (
          <StrategyCard key={x.id} st={x} latest={list.find((a) => a.strategy === x.id) ?? null} loading={alerts.status === 'loading'} wallet={tk.wallet} info={tk.info} balance={tk.balance} onTokens={() => setSheet(true)} />
        ))}
      </div>
      <p className={s.fine}>{t('st.disclaimer')}</p>
      <TokensSheet open={sheet} onClose={() => setSheet(false)} info={tk.info} balance={tk.balance} />
    </>
  );
}

export function StrategyCard({ st, latest, loading, wallet, info, balance, onTokens }: { st: Strategy; latest: Alert | null; loading: boolean; wallet: WalletDoc | null; info: WalletInfo | null; balance: number | null; onTokens: () => void }) {
  return (
    <Card className={[s.card, s[st.tone]].join(' ')}>
      <div className={s.cardHead}>
        <Link to={`/strategies/${st.id}`} className={s.name}>
          {st.name}
        </Link>
        <PassBadge st={st} wallet={wallet} />
      </div>
      <Link to={`/strategies/${st.id}`} tabIndex={-1} aria-hidden="true">
        <StrategyArt id={st.id} name={st.name} />
      </Link>
      <p className={s.tagline}>{st.tagline}</p>
      <div className={s.latest}>
        <span className={s.kicker}>{t('st.latest')}</span>
        {loading ? <Skeleton width="60%" /> : latest ? <AlertLine a={latest} /> : <span className={s.muted}>{t('st.noAlerts')}</span>}
      </div>
      <div className={s.actions}>
        <PassButton st={st} wallet={wallet} info={info} balance={balance} onTokens={onTokens} />
        <Link to={`/strategies/${st.id}`} className={s.more}>
          {t('st.details')} <Icon name="chevronRight" size={14} />
        </Link>
      </div>
    </Card>
  );
}

function PassBadge({ st, wallet }: { st: Strategy; wallet: WalletDoc | null }) {
  const now = useNow();
  const until = passUntil(wallet, st.id, now);
  return until ? <Badge tone="up">{t('st.pass.active', { date: formatDate(until) })}</Badge> : null;
}

export function AlertLine({ a }: { a: Alert }) {
  return (
    <span className={s.alertLine}>
      <b>{a.ticker ?? (a.locked ? '🔒' : '—')}</b>
      <span>{a.label ?? t('st.alert')}</span>
      {a.score != null && a.scoreMax ? <span className={s.mono}>{t('st.score', { n: a.score, of: a.scoreMax })}</span> : null}
      <span className={s.muted}>{a.at ? formatRelative(a.at) : ''}</span>
      {a.outcome && <Badge tone={/target|win/i.test(a.outcome) ? 'up' : /stop|loss/i.test(a.outcome) ? 'down' : 'neutral'}>{a.outcome}</Badge>}
    </span>
  );
}

export function PassButton({ st, wallet, info, balance, onTokens }: { st: Strategy; wallet: WalletDoc | null; info: WalletInfo | null; balance: number | null; onTokens: () => void }) {
  const { user, isReal, openSignIn } = useAuth();
  const toast = useToast();
  const now = useNow();
  const [asking, setAsking] = useState<PassDays | null>(null);
  const [busy, setBusy] = useState(false);
  const week = passPrice(info, st.id);
  const day = passPrice(info, st.id, 1);
  const days = info?.prices.passDays ?? 7;
  if (!isReal || !user)
    return (
      <Button variant="primary" size="sm" onClick={() => void openSignIn().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>
        {t('st.signIn')}
      </Button>
    );
  const until = passUntil(wallet, st.id, now);
  if (until)
    return (
      <Link className={s.openLink} to={`/strategies/${st.id}`}>
        {t('st.openAlerts')}
      </Link>
    );
  if (balance != null && balance < day)
    return (
      <Button variant="primary" size="sm" onClick={onTokens}>
        {t('st.getTokensFor', { n: day })}
      </Button>
    );
  const price = asking === 1 ? day : week;
  async function buy(d: PassDays) {
    setBusy(true);
    try {
      await buyPass(st.id, d);
      toast.show(d === 1 ? t('st.pass.boughtDay', { name: st.name }) : t('st.pass.bought', { name: st.name, days }));
      setAsking(null);
    } catch (e) {
      toast.show(errorText(e, t('st.buy.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className={s.passChoices}>
        <Button variant="secondary" size="sm" disabled={balance == null} onClick={() => setAsking(1)}>
          {t('st.pass.buyDay', { n: day })}
        </Button>
        <Button variant="primary" size="sm" disabled={balance == null || (balance ?? 0) < week} onClick={() => setAsking(7)}>
          {t('st.pass.buy', { days, n: week })}
        </Button>
      </div>
      <Confirm
        open={asking != null}
        title={asking === 1 ? t('st.pass.confirmDay', { name: st.name }) : t('st.pass.confirm', { name: st.name, days })}
        action={t('st.pass.confirmAction', { n: price })}
        busy={busy}
        onConfirm={() => void buy(asking ?? 7)}
        onClose={() => setAsking(null)}
      >
        <p>{asking === 1 ? t('st.pass.confirmBodyDay', { name: st.name, left: (balance ?? 0) - price }) : t('st.pass.confirmBody', { days, name: st.name, left: (balance ?? 0) - price })}</p>
      </Confirm>
    </>
  );
}
