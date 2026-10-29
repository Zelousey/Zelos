/**
 * Rematch (/battles/:id/rematch, Phase 9, F19 / S8): after a battle ends, any of its players can
 * challenge the same opponents (or the same squad) again. The old battle's settings are copied
 * into the form and can be changed; sending makes a brand-new match (tw_rematch) and the old one
 * stays as it was. One rematch per player per battle: if yours already exists, this opens it.
 */
import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { useUserDoc } from '../../data/userDoc';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { Button, Card, EmptyState, Field, LoadingState, PageHeader, useToast } from '../../ui';
import { Choices } from '../invites/Choices';
import { DAYS, errorText } from '../invites/invites';
import { BATTLE_ID_RE, rematch, useBattle, useMyRematch, type Battle } from './battle';
import { BattleSettings, BuyInChoices } from './BattleSettings';
import { fitDays, settingsError, settingsOf, toPayload } from './settings';
import { useSlotGate } from './slots';
import s from './Battles.module.css';

export default function RematchPage() {
  const raw = useParams().id ?? '';
  const id = BATTLE_ID_RE.test(raw) ? raw : null;
  const { user, isReal, ready } = useAuth();
  const uid = ready && user && isReal ? user.uid : null;
  const b = useBattle(id && uid ? id : null);
  const mine = useMyRematch(id && uid ? id : null, uid);
  const back = id ? `/battles/${id}` : '/battles';
  if (!ready || (uid && (b.status === 'loading' || mine.status === 'loading'))) return <LoadingState rows={6} />;
  if (mine.status === 'ready' && mine.data) return <Navigate to={`/battles/${mine.data}`} replace />;
  if (!uid || b.status !== 'ready' || b.data.status !== 'ended' || !b.data.players.includes(uid))
    return <EmptyState icon="war" body={t('bt.rematch.notNow')} actions={<Link to={back}>{t('bt.rematch.back')}</Link>} />;
  return <RematchForm b={b.data} uid={uid} />;
}

function RematchForm({ b, uid }: { b: Battle; uid: string }) {
  const toast = useToast();
  const navigate = useNavigate();
  const me = useUserDoc(uid);
  const xp = me.status === 'ready' ? me.data.xp : me.status === 'loading' ? null : 0;
  const [title, setTitle] = useState(() => t('bt.rematch.nameDefault', { name: b.name }).slice(0, 40));
  const [buyIn, setBuyIn] = useState(b.buyIn);
  const [days, setDays] = useState(DAYS.includes(b.days) ? b.days : 3);
  const [settings, setSettings] = useState(() => settingsOf(b.lms, b.modes));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slot = useSlotGate();
  const others = b.players.filter((p) => p !== uid).map((p) => b.names[p] ?? 'Trader');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 2) return setError(t('inv.battle.name'));
    const bad = settingsError(settings, days);
    if (bad) return setError(t(bad));
    setBusy(true);
    setError(null);
    try {
      const r = await slot.gate((x) => rematch({ warId: b.id, name: title.trim(), buyIn, days, ...toPayload(settings), ...(b.ruleset && { ruleset: b.ruleset }), ...(x && { extraSlot: true }) }));
      if (!r) return;
      if (!r.again) toast.show(t('bt.rematch.sent'), 'success');
      navigate(`/battles/${r.warId}`, { replace: true });
    } catch (err) {
      const m = errorText(err, t('bt.failed'));
      setError(m);
      toast.show(m, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {slot.dialog}
      <Link to={`/battles/${b.id}`} className={s.back}>
        ← {t('bt.rematch.back')}
      </Link>
      <PageHeader title={t('bt.rematch')} subtitle={b.squadId ? t('bt.rematch.squad') : t('bt.rematch.who', { names: others.join(', ') })} keepOnPhone />
      <Card pad>
        <form className={s.rematchForm} onSubmit={submit}>
          <p className={s.muted}>{t('bt.rematch.copied', { name: b.name })}</p>
          <Field label={t('inv.battle.name')} value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} required />
          <BuyInChoices value={buyIn} onChange={setBuyIn} xp={xp} />
          <Choices
            label={t('inv.battle.days')}
            value={days}
            options={DAYS}
            onChange={(d) => {
              setDays(d);
              setSettings((v) => fitDays(v, d));
            }}
            format={(v) => (v === 1 ? t('inv.battle.day1') : t('inv.battle.daysN', { n: v }))}
          />
          <BattleSettings
            value={settings}
            onChange={(v) => {
              setSettings(v);
              setError(null);
            }}
            days={days}
            ruleset={b.ruleset ?? undefined}
          />
          {error && (
            <p className={s.error} role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" block disabled={busy}>
            {t('bt.rematch.send')}
          </Button>
        </form>
      </Card>
    </>
  );
}
