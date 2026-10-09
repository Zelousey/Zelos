/**
 * Challenge a trader to a Trade War from their profile (the website's "Challenge to a Trade
 * War") or from a squad (everyone else in it). They get a card to accept or decline; the battle opens on the website's war page.
 * The server checks the buy-in your level allows and how many challenges you have waiting.
 */
import { useState } from 'react';
import { formatMoney } from '../../lib/format';
import { t } from '../../lib/i18n';
import { classicUrl } from '../../lib/platform';
import { Button, Field, Sheet, useToast } from '../../ui';
import { BUY_INS, DAYS, errorText } from '../invites/invites';
import { Choices } from '../invites/Choices';
import { auth } from '../../lib/firebase';
import { unlockQuietly } from '../missions/missions';
import { challenge } from './profile';
import s from './Profile.module.css';

export function ChallengeSheet({ open, onClose, to, squadId, toName }: { open: boolean; onClose: () => void; to?: string; squadId?: string; toName: string }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [buyIn, setBuyIn] = useState(1000);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const title = name.replace(/[<>]/g, '').trim().slice(0, 40);
    if (title.length < 2) return setErr(t('pf.ch.needName'));
    setBusy(true);
    setErr(null);
    try {
      const r = await challenge({ ...(squadId ? { squadId } : { to: to ?? '' }), name: title, buyIn, days });
      toast.show(t('pf.ch.sent', { name: toName }));
      const me = auth().currentUser;
      if (me) await Promise.race([unlockQuietly(me.uid, 'challenger', 'Challenger', toast.show), new Promise((ok) => setTimeout(ok, 2500))]); // the page changes next
      onClose();
      window.location.assign(classicUrl(`practice/war.html?w=${encodeURIComponent(r.warId)}`));
    } catch (e2) {
      setErr(errorText(e2, t('pf.failed')));
      setBusy(false);
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title={t('pf.ch.title', { name: toName })} labelledBy="pf-ch-title">
      <form className={s.form} onSubmit={send}>
        <p className={s.muted}>{t('pf.ch.body')}</p>
        <Field label={t('inv.battle.name')} value={name} maxLength={40} placeholder={t('pf.ch.placeholder')} onChange={(e) => setName(e.target.value)} required />
        <Choices label={t('inv.battle.buyIn')} value={buyIn} options={BUY_INS} onChange={setBuyIn} format={(v) => formatMoney(v, { digits: 0 })} />
        <Choices label={t('inv.battle.days')} value={days} options={DAYS} onChange={setDays} format={(v) => (v === 1 ? t('inv.battle.day1') : t('inv.battle.daysN', { n: v }))} />
        {err && (
          <p className={s.error} role="alert">
            {err}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" block disabled={busy}>
          {busy ? t('pf.ch.sending') : t('pf.ch.send')}
        </Button>
      </form>
    </Sheet>
  );
}
