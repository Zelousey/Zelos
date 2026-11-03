/**
 * A territory's outpost in its details panel on the War map (owner 2026-11-02): everyone sees what's
 * there; on land you hold you build a Fort or a Supply camp with your base gold, upgrade it and
 * collect a camp's gold. The server (war_lobby outpost*) checks the land, the gold and the limits.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { formatLeft, hqLevel, useWarBase } from './base/base';
import { OUTPOST, OUTPOST_KINDS, outpostAction, outpostNow, type Outpost, type OutpostKind } from './outposts';
import s from './TerritoryMap.module.css';

const g = (n: number) => n.toLocaleString('en-US');

/** "Fort, level 2: 2 more wins to take it" / "Supply camp, level 1" / "Fort, being built". */
export function outpostLine(o: Outpost, now: number, active: boolean): string {
  const x = outpostNow(o, now, active);
  const name = t(`wout.k.${o.kind}`);
  if (x.level < 1) return t('wout.lineBuilding', { name });
  return o.kind === 'fort' ? t('wout.lineFort', { name, n: x.level, w: OUTPOST.fort.wins[x.level - 1]! }) : t('wout.lineCamp', { name, n: x.level });
}

export function OutpostPanel({ warId, terr, uid, outposts, active }: { warId: string; terr: string; uid: string; outposts: Record<string, Outpost>; active: boolean }) {
  const live = useWarBase(uid);
  const toast = useToast();
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);
  const base = live.status === 'ready' ? live.data : null;
  const o = outposts[terr];
  if (!active || (o && o.owner !== uid)) return null;
  const hq = base ? hqLevel(base) : 1;
  const gold = base?.gold ?? 0;
  async function go(req: Parameters<typeof outpostAction>[0], ok: (n: number) => string) {
    setBusy(true);
    try {
      const r = await outpostAction(req);
      toast.show(ok(r.collected), 'success');
    } catch (err) {
      toast.show(errorText(err, t('warl.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!o) {
    if (hq < OUTPOST.unlockHq)
      return (
        <div className={s.outpost}>
          <p>{t('wout.locked', { n: OUTPOST.unlockHq })}</p>
          <Link className={s.outpostLink} to="/war/base">
            {t('wout.openBase')}
          </Link>
        </div>
      );
    const have = Object.values(outposts).filter((x) => x.owner === uid).length;
    return (
      <div className={s.outpost}>
        <p className={s.outpostTitle}>{t('wout.buildTitle')}</p>
        {have >= hq ? (
          <p>{t('wout.full', { n: hq })}</p>
        ) : (
          OUTPOST_KINDS.map((k: OutpostKind) => {
            const cost = OUTPOST[k].cost[0]!;
            return (
              <button key={k} type="button" className={s.outpostBtn} disabled={busy || gold < cost} onClick={() => void go({ action: 'outpostBuild', warId, terr, kind: k }, () => t('wout.started', { name: t(`wout.k.${k}`) }))}>
                <b>{t('wout.build', { name: t(`wout.k.${k}`), g: g(cost) })}</b>
                <small>{t(`wout.k.${k}.about`)}</small>
              </button>
            );
          })
        )}
        <small className={s.outpostFine}>{t('wout.gold', { g: g(Math.floor(gold)) })}</small>
      </div>
    );
  }

  const x = outpostNow(o, now, active);
  const next = x.level < OUTPOST.maxLevel && !x.busy ? OUTPOST[o.kind].cost[x.level]! : null;
  return (
    <div className={s.outpost}>
      <p className={s.outpostTitle}>{x.level < 1 ? t('wout.lineBuilding', { name: t(`wout.k.${o.kind}`) }) : t('wout.yours', { name: t(`wout.k.${o.kind}`), n: x.level })}</p>
      {x.busy && <p>{t('wout.readyIn', { t: formatLeft((x.busyUntil ?? now) - now) })}</p>}
      {!x.busy && o.kind === 'fort' && x.level >= 1 && <p>{t('wout.fortNow', { w: OUTPOST.fort.wins[x.level - 1]! })}</p>}
      {!x.busy && o.kind === 'camp' && x.level >= 1 && <p>{t('wout.campNow', { r: OUTPOST.camp.rate[x.level - 1]!, cap: g(OUTPOST.camp.rate[x.level - 1]! * OUTPOST.camp.hours) })}</p>}
      {o.kind === 'camp' && x.stored >= 1 && (
        <button type="button" className={s.outpostBtn} disabled={busy} onClick={() => void go({ action: 'outpostCollect', warId, terr }, (n) => t('wout.collected', { g: g(n) }))}>
          <b>{t('wout.collect', { g: g(x.stored) })}</b>
        </button>
      )}
      {next !== null && (
        <button type="button" className={s.outpostBtn} disabled={busy || gold < next} onClick={() => void go({ action: 'outpostUpgrade', warId, terr }, () => t('wout.upgrading', { n: x.level + 1 }))}>
          <b>{t('wout.upgrade', { n: x.level + 1, g: g(next) })}</b>
        </button>
      )}
      <small className={s.outpostFine}>{t('wout.gold', { g: g(Math.floor(gold)) })}</small>
    </div>
  );
}
