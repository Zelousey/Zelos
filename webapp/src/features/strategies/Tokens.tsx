/**
 * Tokens in the app: the balance chip and the "Get tokens" sheet. Buying opens Square Checkout
 * (functions/main.py tokens_checkout), the same as on the website; balances only change on the
 * server.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { Button, Sheet, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { checkout, openWallet, safeCheckout, useWalletDoc, type WalletInfo } from './strategies';
import { Coin } from '../tokens/Coin';
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

export function TokensSheet({ open, onClose, info, balance }: { open: boolean; onClose: () => void; info: WalletInfo | null; balance: number | null }) {
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
  return (
    <Sheet open={open} onClose={onClose} title={t('st.getTokens')} labelledBy="tokens-sheet-title">
      <div className={s.sheet}>
        <p className={s.balance}>
          <Coin size={20} /> <b>{balance ?? 0}</b> {t('st.tokens')}
        </p>
        <p className={s.muted}>{t('st.tokens.what', { pass: info?.prices.pass ?? 40, days: info?.prices.passDays ?? 7, unlock: info?.prices.unlock ?? 10 })}</p>
        {!info ? (
          <p className={s.muted}>{t('st.loading')}</p>
        ) : !info.canBuy ? (
          <p className={s.note}>{t('st.buy.soon')}</p>
        ) : (
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
        )}
        <p className={s.fine}>{t('st.tokens.fine')}</p>
      </div>
    </Sheet>
  );
}
