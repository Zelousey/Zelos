/**
 * Strategies (/strategies, in the Trade War hub; owner decision 2026-10-09): the Zelos
 * strategies, easy to find and buy. Each card says what the strategy looks for, shows its
 * latest alert and sells a 7-day pass for tokens; one tap opens the strategy (/strategies/:id).
 * Player-made strategies come later (design doc first).
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../lib/auth';
import { classicUrl } from '../../lib/platform';
import { formatDate, formatRelative } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { Badge, Button, Card, Confirm, Icon, PageHeader, Skeleton, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { buyPass, passUntil, STRATEGIES, useAlerts, type Alert, type Strategy, type WalletDoc, type WalletInfo } from './strategies';
import { TokensSheet, useTokens, WalletChip } from './Tokens';
import s from './Strategies.module.css';

export default function StrategiesPage() {
  const tk = useTokens();
  const [sheet, setSheet] = useState(false);
  const alerts = useAlerts();
  const list = alerts.status === 'ready' ? alerts.data : [];
  return (
    <>
      <PageHeader title={t('nav.strategies')} subtitle={t('st.subtitle')} actions={tk.uid ? <WalletChip balance={tk.balance} onClick={() => setSheet(true)} /> : undefined} />
      <div className={s.list}>
        {STRATEGIES.map((x) => (
          <StrategyCard key={x.id} st={x} latest={list.find((a) => a.strategy === x.id) ?? null} loading={alerts.status === 'loading'} wallet={tk.wallet} info={tk.info} balance={tk.balance} onTokens={() => setSheet(true)} />
        ))}
        <Card className={s.soon} pad>
          <span className={s.soonIcon} aria-hidden="true">
            ✦
          </span>
          <div>
            <h2 className={s.soonTitle}>{t('st.soon.title')}</h2>
            <p className={s.muted}>{t('st.soon.body')}</p>
          </div>
        </Card>
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
  const { user, isReal, signInWithGoogle } = useAuth();
  const toast = useToast();
  const now = useNow();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const price = info?.prices.pass ?? 40;
  const days = info?.prices.passDays ?? 7;
  if (!isReal || !user)
    return (
      <Button variant="primary" size="sm" onClick={() => void signInWithGoogle().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>
        {t('st.signIn')}
      </Button>
    );
  const until = passUntil(wallet, st.id, now);
  if (until)
    return (
      <a className={s.openLink} href={classicUrl(st.page)}>
        {t('st.openAlerts')} <Icon name="external" size={12} />
      </a>
    );
  if (balance != null && balance < price)
    return (
      <Button variant="primary" size="sm" onClick={onTokens}>
        {t('st.getTokensFor', { n: price })}
      </Button>
    );
  async function buy() {
    setBusy(true);
    try {
      await buyPass(st.id);
      toast.show(t('st.pass.bought', { name: st.name, days }));
      setAsking(false);
    } catch (e) {
      toast.show(errorText(e, t('st.buy.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button variant="primary" size="sm" disabled={balance == null} onClick={() => setAsking(true)}>
        {t('st.pass.buy', { days, n: price })}
      </Button>
      <Confirm open={asking} title={t('st.pass.confirm', { name: st.name, days })} action={t('st.pass.confirmAction', { n: price })} busy={busy} onConfirm={() => void buy()} onClose={() => setAsking(false)}>
        <p>{t('st.pass.confirmBody', { days, name: st.name, left: (balance ?? 0) - price })}</p>
      </Confirm>
    </>
  );
}
