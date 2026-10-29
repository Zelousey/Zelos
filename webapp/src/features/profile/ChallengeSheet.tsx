/**
 * Challenge a trader to a Trade War from their profile (the website's "Challenge to a Trade
 * War") or from a squad (everyone else in it). They get a card to accept or decline; the battle opens in the app's battle room.
 * Every game mode can be set (BattleSettings); the server checks the buy-in your level allows,
 * the modes and how many challenges you have waiting. A squad battle starts from a ruleset
 * (Phase 10): Free-for-all or Fantasy Draft, which fixes the mode and the draft.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { t } from '../../lib/i18n';
import { Button, Field, Sheet, useToast } from '../../ui';
import { DAYS, errorText } from '../invites/invites';
import { Choices } from '../invites/Choices';
import { auth } from '../../lib/firebase';
import { useUserDoc } from '../../data/userDoc';
import { BattleSettings, BuyInChoices } from '../battles/BattleSettings';
import { useSkill } from '../learn/useSkill';
import { applyRuleset, DEFAULT_SETTINGS, fitDays, RULESETS, settingsError, toPayload, type Ruleset } from '../battles/settings';
import { unlockQuietly } from '../missions/missions';
import { challenge } from './profile';
import { useSlotGate } from '../battles/slots';
import { BattleLock, useBattlesOpen } from '../learn/BattleLock';
import s from './Profile.module.css';

export function ChallengeSheet({ open, onClose, to, squadId, toName }: { open: boolean; onClose: () => void; to?: string; squadId?: string; toName: string }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [buyIn, setBuyIn] = useState(1000);
  const [days, setDays] = useState(7);
  const [ruleset, setRuleset] = useState<Ruleset>('ffa');
  const [settings, setSettings] = useState(() => (squadId ? applyRuleset(DEFAULT_SETTINGS, 'ffa') : DEFAULT_SETTINGS));
  const me = useUserDoc(auth().currentUser?.uid ?? null);
  const { level } = useSkill();
  const xp = me.status === 'ready' ? me.data.xp : me.status === 'loading' ? null : 0;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const battles = useBattlesOpen();
  const slot = useSlotGate();
  function pickDays(d: number) {
    setDays(d);
    setSettings((v) => fitDays(v, d));
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const title = name.replace(/[<>]/g, '').trim().slice(0, 40);
    if (title.length < 2) return setErr(t('pf.ch.needName'));
    const bad = settingsError(settings, days);
    if (bad) return setErr(t(bad));
    setBusy(true);
    setErr(null);
    try {
      const r = await slot.gate((x) => challenge({ ...(squadId ? { squadId, ruleset } : { to: to ?? '' }), name: title, buyIn, days, ...toPayload(settings), ...(x && { extraSlot: true }) }));
      if (!r) return setBusy(false);
      toast.show(t('pf.ch.sent', { name: toName }));
      const me = auth().currentUser;
      if (me) await Promise.race([unlockQuietly(me.uid, 'challenger', 'Challenger', toast.show), new Promise((ok) => setTimeout(ok, 2500))]); // the page changes next
      onClose();
      navigate(`/battles/${encodeURIComponent(r.warId)}`);
    } catch (e2) {
      setErr(errorText(e2, t('pf.failed')));
      setBusy(false);
    }
  }
  if (battles.loaded && !battles.open) {
    return (
      <Sheet open={open} onClose={onClose} title={t('pf.ch.title', { name: toName })} labelledBy="pf-ch-title">
        <BattleLock flat />
      </Sheet>
    );
  }
  return (
    <Sheet open={open} onClose={onClose} title={t('pf.ch.title', { name: toName })} labelledBy="pf-ch-title">
      <form className={s.form} onSubmit={send}>
        <p className={s.muted}>{t('pf.ch.body')}</p>
        {squadId && (
          <div>
            <Choices
              label={t('rs.label')}
              value={ruleset}
              options={[...RULESETS]}
              onChange={(r) => {
                setRuleset(r);
                setSettings((v) => applyRuleset(v, r));
                setErr(null);
              }}
              format={(r) => t(`rs.${r}`)}
            />
            <p className={s.muted}>{t(`rs.${ruleset}.body`)}</p>
          </div>
        )}
        <Field label={t('inv.battle.name')} value={name} maxLength={40} placeholder={t('pf.ch.placeholder')} onChange={(e) => setName(e.target.value)} required />
        <BuyInChoices value={buyIn} onChange={setBuyIn} xp={xp} />
        <Choices label={t('inv.battle.days')} value={days} options={DAYS} onChange={pickDays} format={(v) => (v === 1 ? t('inv.battle.day1') : t('inv.battle.daysN', { n: v }))} />
        <BattleSettings value={settings} onChange={(v) => { setSettings(v); setErr(null); }} days={days} simple={level === 'beginner' && !squadId} ruleset={squadId ? ruleset : undefined} />
        {err && (
          <p className={s.error} role="alert">
            {err}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" block disabled={busy}>
          {busy ? t('pf.ch.sending') : t('pf.ch.send')}
        </Button>
      </form>
      {slot.dialog}
    </Sheet>
  );
}
