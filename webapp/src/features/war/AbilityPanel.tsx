/**
 * War abilities in a territory's details panel (owner 2026-11-03), paid with Energy from your base
 * (the Wizard's Tower, or the shop): Scout an enemy territory (25 Energy: its real soldiers, for an
 * hour, only you see it) or Shield one of yours (60 Energy: no attacks for 6 hours, once a War day).
 * The server (functions/warability.py, war_lobby scout / shield) checks everything.
 */
import { useState } from 'react';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { formatLeft, useWarBase } from './base/base';
import { warLobby } from './lobby';
import { useIntel } from './map';
import s from './TerritoryMap.module.css';

export const SCOUT_ENERGY = 25;
export const SHIELD_ENERGY = 60;

export function AbilityPanel({ warId, terr, uid, mine, shieldUntil, shieldUsed }: { warId: string; terr: string; uid: string; mine: boolean; shieldUntil: number | null; shieldUsed: boolean }) {
  const base = useWarBase(uid);
  const intel = useIntel(warId, uid);
  const toast = useToast();
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);
  const energy = base.status === 'ready' && base.data ? Math.floor(base.data.energy) : 0;
  const scout = intel.status === 'ready' ? intel.data.scouts[terr] : undefined;
  const scouted = scout && scout.until > now ? scout : null;
  async function go(action: 'scout' | 'shield', ok: string) {
    setBusy(true);
    try {
      await warLobby({ action, warId, terr });
      toast.show(ok, 'success');
    } catch (err) {
      toast.show(errorText(err, t('warl.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  const shielded = shieldUntil !== null && shieldUntil > now;
  return (
    <div className={s.outpost}>
      <p className={s.outpostTitle}>{t('wab.title')}</p>
      {mine ? (
        shielded ? (
          <p>{t('wab.shieldOn', { t: formatLeft((shieldUntil ?? now) - now) })}</p>
        ) : (
          <button type="button" className={s.outpostBtn} disabled={busy || shieldUsed || energy < SHIELD_ENERGY} onClick={() => void go('shield', t('wab.shielded'))}>
            <b>{t('wab.shield', { n: SHIELD_ENERGY })}</b>
            <small>{shieldUsed ? t('wab.shieldUsed') : t('wab.shieldAbout')}</small>
          </button>
        )
      ) : scouted ? (
        <p>{t('wab.scoutSeen', { n: scouted.n, t: formatLeft(scouted.until - now) })}</p>
      ) : (
        <button type="button" className={s.outpostBtn} disabled={busy || energy < SCOUT_ENERGY} onClick={() => void go('scout', t('wab.scouted'))}>
          <b>{t('wab.scout', { n: SCOUT_ENERGY })}</b>
          <small>{t('wab.scoutAbout')}</small>
        </button>
      )}
      <small className={s.outpostFine}>{t('wab.energy', { n: energy })}</small>
    </div>
  );
}
