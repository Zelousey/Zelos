/**
 * The War map in a running War (W4a): while claiming, your secret placement (soldiers per
 * territory, Camouflage, Lock in) with your enemy warnings; after the reveal, who holds what,
 * your own soldiers on each territory, and the map log. Opponents' counts are never shown.
 */
import { useState } from 'react';
import { formatRelative } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { Badge, Button, Card, Confirm, LoadingState, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { Battles } from './Battles';
import { warLobby, type PrivateWar } from './lobby';
import { CAMO_COST, CAMO_MAX, companiesOf, MAX_PER_TERRITORY, placementProblem, SECTOR_NAME, useIntel, usePlacement, useWarLog, type Placement, type Warning } from './map';
import { useWarQuotes } from './war';
import s from './War.module.css';

export function WarMap({ w, uid, now }: { w: PrivateWar; uid: string; now: number }) {
  const mine = usePlacement(w.id, uid);
  const intel = useIntel(w.id, uid);
  if (mine.status === 'loading') return <LoadingState rows={4} />;
  const placement = mine.status === 'ready' ? mine.data : null;
  if (w.phase === 'claiming' && !placement?.locked)
    return <Claiming key={placement ? 'saved' : 'new'} w={w} saved={placement} warnings={intel.status === 'ready' ? intel.data : {}} now={now} />;
  return <Board w={w} uid={uid} placement={placement} warnings={w.phase === 'claiming' && intel.status === 'ready' ? intel.data : {}} now={now} />;
}

const PROBLEM: Record<'over' | 'empty' | 'left' | 'camo', MessageKey> = { over: 'wmap.problem.over', empty: 'wmap.problem.empty', left: 'wmap.problem.left', camo: 'wmap.problem.camo' };

function WarningBadge({ w }: { w: Warning | undefined }) {
  if (!w) return null;
  return <Badge tone={w === 'heavy' ? 'down' : 'gold'}>{w === 'heavy' ? t('wmap.heavy') : t('wmap.enemy')}</Badge>;
}

function Claiming({ w, saved, warnings, now }: { w: PrivateWar; saved: Placement | null; warnings: Record<string, Warning>; now: number }) {
  const toast = useToast();
  const [soldiers, setSoldiers] = useState<Record<string, number>>(saved?.soldiers ?? {});
  const [camo, setCamo] = useState<string[]>(saved?.camo ?? []);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const total = w.soldiers - CAMO_COST * camo.length;
  const placed = w.territories.reduce((a, x) => a + (soldiers[x] ?? 0), 0);
  const problem = placementProblem({ soldiers, camo }, w.territories, w.soldiers);
  const set = (x: string, n: number) => {
    const v = Math.max(0, Math.min(MAX_PER_TERRITORY, Math.round(Number.isFinite(n) ? n : 0)));
    setSoldiers((cur) => ({ ...cur, [x]: v }));
    if (!v) setCamo((c) => c.filter((y) => y !== x));
  };
  async function send(lock: boolean) {
    setBusy(true);
    try {
      const clean = Object.fromEntries(Object.entries(soldiers).filter(([, n]) => n > 0));
      await warLobby({ action: 'place', warId: w.id, soldiers: clean, camo, lock });
      toast.show(lock ? t('wmap.locked') : t('wmap.saved'), 'success');
    } catch (err) {
      toast.show(errorText(err, t('warl.failed')), 'error');
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }
  return (
    <Card title={t('wmap.claimTitle')} subtitle={t('wmap.claimSub', { when: formatRelative(w.claimEnds ?? now, now) })} flush>
      <p className={s.note}>{t('wmap.rules', { max: MAX_PER_TERRITORY, cost: CAMO_COST, camo: CAMO_MAX })}</p>
      <ul className={s.rows}>
        {w.territories.map((x) => {
          const n = soldiers[x] ?? 0;
          const hidden = camo.includes(x);
          return (
            <li key={x} className={s.terr}>
              <div className={s.who}>
                <b>
                  {SECTOR_NAME[x]} <WarningBadge w={warnings[x]} />
                </b>
                <small>{companiesOf(x).map((c) => c.name).join(' · ')}</small>
              </div>
              <div className={s.stepper} role="group" aria-label={t('wmap.soldiersOn', { t: SECTOR_NAME[x] ?? x })}>
                <Button size="sm" variant="ghost" aria-label={t('wmap.less', { t: SECTOR_NAME[x] ?? x })} disabled={busy || n === 0} onClick={() => set(x, n - 5)}>
                  −5
                </Button>
                <input
                  className={s.count}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_PER_TERRITORY}
                  value={n}
                  aria-label={t('wmap.soldiersOn', { t: SECTOR_NAME[x] ?? x })}
                  onChange={(e) => set(x, Number(e.target.value))}
                />
                <Button size="sm" variant="ghost" aria-label={t('wmap.more', { t: SECTOR_NAME[x] ?? x })} disabled={busy || n >= MAX_PER_TERRITORY} onClick={() => set(x, n + 5)}>
                  +5
                </Button>
              </div>
              <label className={s.camo}>
                <input
                  type="checkbox"
                  checked={hidden}
                  disabled={busy || !n || (!hidden && camo.length >= CAMO_MAX)}
                  onChange={(e) => setCamo((c) => (e.target.checked ? [...c, x] : c.filter((y) => y !== x)))}
                />
                {t('wmap.camo', { cost: CAMO_COST })}
              </label>
            </li>
          );
        })}
      </ul>
      <div className={s.claimFoot}>
        <p className={problem ? s.warn : s.muted} role="status">
          {t('wmap.placed', { placed, total })}
          {camo.length > 0 && ` · ${t('wmap.camoUsed', { n: camo.length, cost: camo.length * CAMO_COST })}`}
          {problem && ` · ${t(problem.key === 'left' && problem.n < 0 ? 'wmap.problem.tooMany' : PROBLEM[problem.key], { n: Math.abs(problem.n) })}`}
        </p>
        <p className={s.muted}>{t('wmap.lockedCount', { n: w.lockedCount, of: w.players.length })}</p>
        <div className={s.actionsRow}>
          <Button variant="ghost" disabled={busy} onClick={() => void send(false)}>
            {t('wmap.save')}
          </Button>
          <Button variant="primary" disabled={busy || !!problem} onClick={() => setConfirm(true)}>
            {t('wmap.lock')}
          </Button>
        </div>
      </div>
      <Confirm open={confirm} title={t('wmap.lockQ')} action={t('wmap.lock')} busy={busy} onClose={() => setConfirm(false)} onConfirm={() => void send(true)}>
        <p>{t('wmap.lockBody')}</p>
      </Confirm>
    </Card>
  );
}

function Board({ w, uid, placement, warnings, now }: { w: PrivateWar; uid: string; placement: Placement | null; warnings: Record<string, Warning>; now: number }) {
  const log = useWarLog(w.phase === 'holding' ? w.id : null);
  const quotes = useWarQuotes();
  const name = (p: string) => (p === uid ? t('wmap.you') : (w.names[p] ?? 'Trader'));
  const claiming = w.phase === 'claiming';
  return (
    <>
      <Card title={claiming ? t('wmap.waitTitle') : t('wmap.boardTitle')} subtitle={claiming ? t('wmap.waitSub', { n: w.lockedCount, of: w.players.length, when: formatRelative(w.claimEnds ?? now, now) }) : t('wmap.boardSub')} flush>
        <ul className={s.board}>
          {w.territories.map((x) => {
            const cell = w.map[x];
            const n = placement?.soldiers[x] ?? 0;
            const tone = !cell ? 'neutral' : cell.state === 'contested' ? 'gold' : cell.state === 'owned' ? (cell.owner === uid ? 'up' : 'down') : 'neutral';
            const label = !cell
              ? null
              : cell.state === 'owned'
                ? cell.owner === uid
                  ? t('wmap.yours')
                  : t('wmap.heldBy', { name: name(cell.owner ?? '') })
                : cell.state === 'contested'
                  ? t('wmap.contested', { names: cell.contenders.map(name).join(' vs ') })
                  : t('wmap.neutral');
            return (
              <li key={x} className={[s.tile, cell?.state === 'owned' && cell.owner === uid && s.tileMine, cell?.state === 'contested' && s.tileHot].filter(Boolean).join(' ')}>
                <b>{SECTOR_NAME[x]}</b>
                {label && <Badge tone={tone}>{label}</Badge>}
                {claiming && <WarningBadge w={warnings[x]} />}
                <small className={s.muted}>
                  {n ? t('wmap.yourSoldiers', { n }) : t('wmap.noSoldiers')}
                  {placement?.camo.includes(x) && ` · ${t('wmap.hidden')}`}
                </small>
              </li>
            );
          })}
        </ul>
        {placement?.auto && <p className={s.note}>{t('wmap.autoNote')}</p>}
        {!claiming && placement && (placement.reserve > 0 || (w.redeployPasses[uid] ?? 0) > 0) && (
          <p className={s.note}>
            {[placement.reserve > 0 && t('wmap.reserve', { n: placement.reserve }), (w.redeployPasses[uid] ?? 0) > 0 && t('wmap.passes', { n: w.redeployPasses[uid] ?? 0 })].filter(Boolean).join(' · ')}
          </p>
        )}
      </Card>
      {!claiming && <Battles w={w} uid={uid} placement={placement} q={quotes.status === 'ready' ? quotes.data : null} now={now} />}
      {!claiming && log.status === 'ready' && log.data.length > 0 && (
        <Card title={t('wmap.logTitle')} flush>
          <ul className={s.logList}>
            {log.data.map((l) => (
              <li key={l.id}>
                <span>{l.text}</span>
                <small className={s.muted}>{formatRelative(l.at, now)}</small>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
