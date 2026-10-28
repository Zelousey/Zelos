/**
 * The Token Store (owner list D, 2026-10-27): what the token chip in the top bar opens. Your balance
 * (the server's wallet, live), the token packs at the server's prices (Square Checkout on the web;
 * hidden inside the iPhone app, guideline 3.1.1), what tokens are for, and your whole token history
 * a page at a time. Balances only ever change on the server.
 */
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { Button, Card, PageHeader } from '../../ui';
import { passPrice } from '../strategies/strategies';
import { TokenHistory } from '../strategies/TokenHistory';
import { TokenPacks, useTokens } from '../strategies/Tokens';
import { Coin } from './Coin';
import st from '../strategies/Strategies.module.css';
import s from './Tokens.module.css';

export default function TokenStorePage() {
  const { openSignIn } = useAuth();
  const { uid, info, balance } = useTokens();
  return (
    <>
      <PageHeader title={t('nav.tokens')} subtitle={t('tok.store.sub')} />
      {!uid ? (
        <Card pad>
          <p className={st.muted}>{t('tk.signIn')}</p>
          <Button variant="primary" onClick={() => void openSignIn().catch(() => {})}>
            {t('auth.signIn')}
          </Button>
        </Card>
      ) : (
        <div className={s.store}>
          <Card pad className={s.storeBalance} aria-label={t('tok.store.balance')}>
            <span className={st.muted}>{t('tok.store.balance')}</span>
            <p className={s.storeNum} data-testid="store-balance">
              <Coin size={28} /> <b>{balance == null ? '…' : balance.toLocaleString('en-US')}</b> {t('st.tokens')}
            </p>
            <p className={st.muted}>{t('tok.store.earn')}</p>
          </Card>
          <Card title={t('tok.store.buy')}>
            <div className={s.storeBody}>
              <p className={st.muted}>{t('st.tokens.what', { pass: passPrice(info, 'swing-trader'), day: passPrice(info, 'swing-trader', 1), threeLeg: passPrice(info, 'three-leg'), days: info?.prices.passDays ?? 7, unlock: info?.prices.unlock ?? 25 })}</p>
              <TokenPacks info={info} />
              <p className={st.fine}>{t('st.tokens.fine')}</p>
            </div>
          </Card>
          <Card pad className={s.storeHistory}>
            <TokenHistory more />
          </Card>
        </div>
      )}
    </>
  );
}
