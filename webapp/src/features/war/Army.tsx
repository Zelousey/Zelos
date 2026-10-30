/**
 * Your army in a running War (W5b): soldiers in reserve, Reinforce (once a War day, onto your own
 * land, in secret) and Rally (15 reserve soldiers for one extra attack today). The server checks
 * everything (functions/warmoves.py).
 */
import { useState } from 'react';
import { t } from '../../lib/i18n';
import { Button, Card, Sheet, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { warDay, warLobby, type PrivateWar } from './lobby';
import { MAX_PER_TERRITORY, SECTOR_NAME, type Placement } from './map';
import s from './War.module.css';

const RALLY = 15;

export function Army({ w, uid, placement, now }: { w: PrivateWar; uid: string; placement: Placement | null; now: number }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [add, setAdd] = useState<Record<string, number>>({});
  const day = warDay(w, now);
  const key = `${uid}:${day}`;
  const reserve = placement?.reserve ?? 0;
  const mine = w.territories.filter((x) => w.map[x]?.state === 'owned' && w.map[x]?.owner === uid);
  const reinforced = !!w.reinforced[key];
  const rallied = !!w.rallies[key];
  const moving = Object.values(add).reduce((a, b) => a + b, 0);
  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await fn();
      toast.show(done, 'success');
      setOpen(false);
      setAdd({});
    } catch (err) {
      toast.show(errorText(err, t('warl.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title={t('warmy.title')} subtitle={t('warmy.sub')} pad>
      <div className={s.ticket}>
        <p className={s.armyLine}>
          <b>{t('warmy.reserve', { n: reserve })}</b>
          <span className={s.muted}>{t('warmy.today', { claim: w.claims[key] ? t('warmy.used') : t('warmy.free'), reinforce: reinforced ? t('warmy.used') : t('warmy.free'), rally: rallied ? t('warmy.used') : t('warmy.free') })}</span>
        </p>
        <div className={s.actionsRow}>
          <Button variant="secondary" disabled={busy || reinforced || reserve < 1 || !mine.length} onClick={() => setOpen(true)}>
            {t('warmy.reinforce')}
          </Button>
          <Button variant="secondary" disabled={busy || rallied || reserve < RALLY} onClick={() => void run(() => warLobby({ action: 'rally', warId: w.id }), t('warmy.rallied'))}>
            {t('warmy.rally', { n: RALLY })}
          </Button>
        </div>
        <p className={s.muted}>{t('warmy.help', { n: RALLY })}</p>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('warmy.reinforce')} labelledBy="war-reinforce">
        <form
          className={s.explain}
          onSubmit={(e) => {
            e.preventDefault();
            const soldiers = Object.fromEntries(Object.entries(add).filter(([, n]) => n > 0));
            if (Object.keys(soldiers).length) void run(() => warLobby({ action: 'reinforce', warId: w.id, soldiers }), t('warmy.reinforced'));
          }}
        >
          <p className={s.muted}>{t('warmy.reinforceHelp', { n: reserve, max: MAX_PER_TERRITORY })}</p>
          {mine.map((x) => {
            const have = placement?.soldiers[x] ?? 0;
            return (
              <label key={x} className={s.reinforceRow}>
                <span>
                  <b>{SECTOR_NAME[x]}</b> <small className={s.muted}>{t('warmy.have', { n: have })}</small>
                </span>
                <input
                  className={s.count}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={Math.min(reserve, MAX_PER_TERRITORY - have)}
                  value={add[x] ?? 0}
                  onChange={(e) => setAdd((a) => ({ ...a, [x]: Math.max(0, Math.min(MAX_PER_TERRITORY - have, Math.round(Number(e.target.value) || 0))) }))}
                />
              </label>
            );
          })}
          <p className={moving > reserve ? s.warn : s.muted} role="status">
            {t('warmy.moving', { n: moving, of: reserve })}
          </p>
          <Button type="submit" variant="primary" block disabled={busy || moving < 1 || moving > reserve}>
            {t('warmy.move', { n: moving })}
          </Button>
        </form>
      </Sheet>
    </Card>
  );
}
