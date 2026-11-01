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
import { Army } from './Army';
import { Attacks, AttackSheet } from './Attacks';
import { Battles } from './Battles';
import { Standings } from './Standings';
import { TerritoryMap, type TerritoryView } from './TerritoryMap';
import { armyOf, warDay, warLobby, type PrivateWar } from './lobby';
import { CAMO_COST, CAMO_MAX, companiesOf, MAX_PER_TERRITORY, placementProblem, SECTOR_NAME, useIntel, usePlacement, useWarLog, type Placement, type Warning } from './map';
import { useWarQuotes } from './war';
import s from './War.module.css';

export function WarMap({ w, uid, now }: { w: PrivateWar; uid: string; now: number }) {
  const mine = usePlacement(w.id, uid);
  const intel = useIntel(w.id, uid);
  if (mine.status === 'loading') return <LoadingState rows={4} />;
  const placement = mine.status === 'ready' ? mine.data : null;
  if (w.phase === 'claiming' && !placement?.locked)
    return <Claiming key={placement ? 'saved' : 'new'} w={w} uid={uid} saved={placement} warnings={intel.status === 'ready' ? intel.data : {}} now={now} />;
  return <Board w={w} uid={uid} placement={placement} warnings={w.phase === 'claiming' && intel.status === 'ready' ? intel.data : {}} now={now} />;
}

const PROBLEM: Record<'over' | 'empty' | 'left' | 'camo', MessageKey> = { over: 'wmap.problem.over', empty: 'wmap.problem.empty', left: 'wmap.problem.left', camo: 'wmap.problem.camo' };

function WarningBadge({ w }: { w: Warning | undefined }) {
  if (!w) return null;
  return <Badge tone={w === 'heavy' ? 'down' : 'gold'}>{w === 'heavy' ? t('wmap.heavy') : t('wmap.enemy')}</Badge>;
}

function Claiming({ w, uid, saved, warnings, now }: { w: PrivateWar; uid: string; saved: Placement | null; warnings: Record<string, Warning>; now: number }) {
  const toast = useToast();
  const [soldiers, setSoldiers] = useState<Record<string, number>>(saved?.soldiers ?? {});
  const [camo, setCamo] = useState<string[]>(saved?.camo ?? []);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const army = armyOf(w, uid);
  const total = army - CAMO_COST * camo.length;
  const placed = w.territories.reduce((a, x) => a + (soldiers[x] ?? 0), 0);
  const problem = placementProblem({ soldiers, camo }, w.territories, army);
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
      <TerritoryMap
        territories={w.territories}
        label={t('wmap.mapLabel')}
        onPick={(x) => jumpTo(w.id, x)}
        status={{ title: t('wmap.st.claim'), big: minutesLeft(w.claimEnds, now), line: t('wmap.lockedCount', { n: w.lockedCount, of: w.players.length }) }}
        deploy={{ placed, total }}
        view={Object.fromEntries(
          w.territories.map((x) => {
            const n = soldiers[x] ?? 0;
            const v: TerritoryView = { tone: n ? 'mine' : 'neutral', line: n ? t('wmap.k.yourN', { n }) : t('wmap.k.none'), warn: warnings[x] };
            if (camo.includes(x)) v.extra = t('wmap.hidden');
            return [x, v];
          }),
        )}
      />
      <p className={s.note}>{t('wmap.rules', { max: MAX_PER_TERRITORY, cost: CAMO_COST, camo: CAMO_MAX })}</p>
      <ul className={s.rows} aria-label={t('wmap.tiles')}>
        {w.territories.map((x) => {
          const n = soldiers[x] ?? 0;
          const hidden = camo.includes(x);
          return (
            <li key={x} id={tileId(w.id, x)} tabIndex={-1} className={s.terr}>
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
  const [target, setTarget] = useState<string | null>(null);
  const canAttack = w.status === 'active' && w.phase === 'holding' && !!w.endsAt && now < w.endsAt - 3600000;
  const name = (p: string) => (p === uid ? t('wmap.you') : (w.names[p] ?? 'Trader'));
  const claiming = w.phase === 'claiming';
  return (
    <>
      <Card title={claiming ? t('wmap.waitTitle') : t('wmap.boardTitle')} subtitle={claiming ? t(w.kind === 'zone' ? 'wzone.waitSub' : 'wmap.waitSub', { n: w.lockedCount, of: w.players.length, when: formatRelative(w.claimEnds ?? now, now) }) : t('wmap.boardSub')} flush>
        <TerritoryMap
          territories={w.territories}
          label={t('wmap.mapLabel')}
          onPick={(x) => jumpTo(w.id, x)}
          view={boardView(w, uid, placement, warnings, name, canAttack)}
          status={
            claiming
              ? { title: t('wmap.st.claim'), big: minutesLeft(w.claimEnds, now), line: t('wmap.lockedCount', { n: w.lockedCount, of: w.players.length }) }
              : w.status === 'active'
                ? { title: t('wmap.st.day', { n: warDay(w, now) + 1 }), big: w.endsAt ? t('wmap.st.ends', { when: formatRelative(w.endsAt, now) }) : undefined, line: t('wmap.st.held', { n: w.territories.filter((x) => w.map[x]?.state === 'owned' && w.map[x]?.owner === uid).length, of: w.territories.length }) }
                : undefined
          }
        />
        <ul className={s.board} aria-label={t('wmap.tiles')}>
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
              <li key={x} id={tileId(w.id, x)} tabIndex={-1} className={[s.tile, cell?.state === 'owned' && cell.owner === uid && s.tileMine, cell?.state === 'contested' && s.tileHot].filter(Boolean).join(' ')}>
                <b>{SECTOR_NAME[x]}</b>
                {label && <Badge tone={tone}>{label}</Badge>}
                {claiming && <WarningBadge w={warnings[x]} />}
                <small className={s.muted}>
                  {n ? t('wmap.yourSoldiers', { n }) : t('wmap.noSoldiers')}
                  {placement?.camo.includes(x) && ` · ${t('wmap.hidden')}`}
                  {(w.progress[x]?.[uid] ?? 0) > 0 && ` · ${t('watk.yourWins', { n: w.progress[x]![uid]! })}`}
                </small>
                {w.hot[x] && (
                  <Badge tone="gold">
                    {t('war.hot')}
                  </Badge>
                )}
                {w.hot[x] && <small className={s.muted}>{w.hot[x]}</small>}
                {canAttack && cell?.state === 'owned' && cell.owner !== uid && (
                  <Button size="sm" variant="secondary" onClick={() => setTarget(x)}>
                    {t('watk.attack')}
                  </Button>
                )}
                {canAttack && cell?.state === 'neutral' && <ClaimButton w={w} territory={x} />}
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
      {!claiming && <Standings w={w} uid={uid} now={now} />}
      {!claiming && w.status === 'active' && <Army w={w} uid={uid} placement={placement} now={now} />}
      {!claiming && <Attacks w={w} uid={uid} q={quotes.status === 'ready' ? quotes.data : null} now={now} />}
      {!claiming && <Battles w={w} uid={uid} placement={placement} q={quotes.status === 'ready' ? quotes.data : null} now={now} />}
      {target && <AttackSheet key={target} w={w} territory={target} onClose={() => setTarget(null)} />}
      {!claiming && log.status === 'ready' && log.data.length > 0 && (
        <Card title={t('wmap.logTitle')} flush>
          <ul className={s.logList}>
            {log.data.map((l) => (
              <li key={l.id}>
                <span>{l.text}</span>
                <small className={s.muted}>{formatRelative(Math.min(l.at, now), now)}</small>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

/** "42 min" until the claiming hour ends (the screen clock can lag the server). */
function minutesLeft(until: number | null, now: number) {
  if (!until) return undefined;
  return t('wmap.st.min', { n: Math.max(0, Math.round((until - now) / 60000)) });
}

const tileId = (warId: string, x: string) => `terr-${warId}-${x}`;
/** Tapping a territory on the map brings its card (and its buttons) into view. */
function jumpTo(warId: string, x: string) {
  const el = document.getElementById(tileId(warId, x));
  if (!el) return;
  el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  el.focus({ preventScroll: true });
}

/** What the map shows for each territory: who holds it, your soldiers there, Hot zones, warnings. */
function boardView(w: PrivateWar, uid: string, placement: Placement | null, warnings: Record<string, Warning>, name: (p: string) => string, canClaim: boolean): Record<string, TerritoryView> {
  return Object.fromEntries(
    w.territories.map((x) => {
      const cell = w.map[x];
      const n = placement?.soldiers[x] ?? 0;
      let v: TerritoryView;
      if (!cell) v = { tone: n ? 'mine' : 'neutral', line: n ? t('wmap.k.yourN', { n }) : t('wmap.k.none') };
      else if (cell.state === 'owned' && cell.owner === uid) v = { tone: 'mine', line: t('wmap.you'), ...(n ? { extra: t('wmap.k.soldiersN', { n }) } : {}) };
      else if (cell.state === 'owned') v = { tone: 'enemy', line: name(cell.owner ?? ''), initial: name(cell.owner ?? '').slice(0, 1) };
      else if (cell.state === 'contested') v = { tone: 'contested', line: cell.contenders.map(name).join(' vs ') };
      else v = { tone: 'neutral', line: t('wmap.neutral'), claimable: canClaim };
      if (w.hot[x]) v.hot = true;
      if (!cell && warnings[x]) v.warn = warnings[x];
      return [x, v];
    }),
  );
}

/** Claim a neutral territory (once a War day; a Redeploy pass gives one more). */
function ClaimButton({ w, territory }: { w: PrivateWar; territory: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [offerPass, setOfferPass] = useState(false);
  async function claim(usePass = false) {
    setBusy(true);
    try {
      await warLobby({ action: 'claim', warId: w.id, territory, ...(usePass && { usePass: true }) });
      toast.show(t('wmap.claimed', { t: SECTOR_NAME[territory] ?? territory }), 'success');
    } catch (err) {
      if ((err as { details?: { pass?: boolean } })?.details?.pass) setOfferPass(true);
      toast.show(errorText(err, t('warl.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  return offerPass ? (
    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void claim(true)}>
      {t('wmap.claimPass')}
    </Button>
  ) : (
    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void claim()}>
      {t('wmap.claim')}
    </Button>
  );
}
