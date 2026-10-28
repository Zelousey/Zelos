/**
 * Tokens in the app: the balance chip and the "Get tokens" sheet. On the web, buying opens Square
 * Checkout (functions/main.py tokens_checkout), the same as on the website. Inside the iPhone app
 * digital goods may only be sold with Apple in-app purchase (App Store guideline 3.1.1), so there
 * the sheet only shows how to earn tokens until that is added. Balances only change on the server.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../lib/auth';
import { isNative } from '../../lib/platform';
import { t } from '../../lib/i18n';
import { Button, Sheet, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { checkout, openWallet, passPrice, safeCheckout, useWalletDoc, type WalletInfo } from './strategies';
import { Coin } from '../tokens/Coin';
import { TokenHistory } from './TokenHistory';
import s from './Strategies.module.css';

/** The live wallet plus prices/packs (tokens_wallet also makes the wallet and gives welcome tokens once). */
export function useTokens() {
  const { user, isReal } = useAuth();
  const uid = isReal && user ? user.uid : null;
  const doc = useWalletDoc(uid);
  const [info, setInfo] = useState<{ uid: string; info: WalletInfo } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!uid) return;
    let live = true;
    openWallet()
      .then((i) => live && setInfo({ uid, info: i }))
      .catch(() => live && setFailed(uid));
    return () => {
      live = false;
    };
  }, [uid]);
  const mine = info?.uid === uid ? info.info : null;
  const wallet = doc.status === 'ready' ? doc.data : null;
  return { uid, wallet, info: mine, balance: wallet?.balance ?? mine?.balance ?? null, failed: failed === uid };
}

/** The token packs at the server's prices; buying opens Square Checkout. Hidden inside the iPhone app (guideline 3.1.1). */
export function TokenPacks({ info }: { info: WalletInfo | null }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function buy(pack: string) {
    setBusy(pack);
    try {
      const r = await checkout(pack);
      if (!safeCheckout(r.url)) throw new Error(t('st.buy.failed'));
      window.location.assign(r.url);
    } catch (e) {
      toast.show(errorText(e, t('st.buy.failed')), 'error');
      setBusy(null);
    }
  }
  if (!info) return <p className={s.muted}>{t('st.loading')}</p>;
  if (!info.canBuy || isNative()) return <p className={s.note}>{t('st.buy.soon')}</p>;
  return (
    <ul className={s.packs}>
      {info.packs.map((p) => (
        <li key={p.id}>
          <span>
            <b>{p.tokens.toLocaleString('en-US')}</b> {t('st.tokens')}
          </span>
          <Button variant="primary" size="sm" disabled={!!busy} onClick={() => void buy(p.id)}>
            {busy === p.id ? t('st.buy.opening') : `$${(p.cents / 100).toFixed(p.cents % 100 ? 2 : 0)}`}
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function TokensSheet({ open, onClose, info, balance }: { open: boolean; onClose: () => void; info: WalletInfo | null; balance: number | null }) {
  return (
    <Sheet open={open} onClose={onClose} title={t('st.getTokens')} labelledBy="tokens-sheet-title">
      <div className={s.sheet}>
        <p className={s.balance}>
          <Coin size={20} /> <b>{balance ?? 0}</b> {t('st.tokens')}
        </p>
        <p className={s.muted}>{t('st.tokens.what', { pass: passPrice(info, 'swing-trader'), day: passPrice(info, 'swing-trader', 1), threeLeg: passPrice(info, 'three-leg'), days: info?.prices.passDays ?? 7, unlock: info?.prices.unlock ?? 25 })}</p>
        <TokenPacks info={info} />
        <p className={s.fine}>{t('st.tokens.fine')}</p>
        <TokenHistory />
        <Link className={s.storeLink} to="/tokens" onClick={onClose}>
          {t('tok.storeLink')} →
        </Link>
      </div>
    </Sheet>
  );
}
