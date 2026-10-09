/**
 * The squad owner's controls, the same as on the website: competitions, the shared goal, the
 * room code, settings, allowed stocks for squad Trade Wars, rename, members and delete.
 * firestore.rules lets only the owner make these changes.
 */
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { UNIVERSE } from '../../data/universe';
import { formatDate } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Button, Card, Confirm, Field, useToast } from '../../ui';
import type { Ranked } from '../dashboard/social';
import { errorText } from '../invites/invites';
import { clearGoal, deleteSquad, endComp, GOAL_TARGETS, newRoomCode, removeMember, removeRoomCode, renameSquad, setConfig, setGoal, setHelpMode, startComp, type Squad } from './squads';
import s from './Social.module.css';

type Ask = { title: string; body: ReactNode; action: string; danger?: boolean; run: () => Promise<unknown> };

export function OwnerPanel({ sq, profs, compOn }: { sq: Squad; profs: Record<string, Ranked> | null; compOn: boolean }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [goalText, setGoalText] = useState('');
  const [target, setTarget] = useState(3);
  const [goalDays, setGoalDays] = useState<7 | 30>(7);
  const [syms, setSyms] = useState((sq.config.symbols ?? []).join(', '));
  const [name, setName] = useState(sq.name);
  const [delName, setDelName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      if (ok) toast.show(ok);
      return true;
    } catch (e) {
      setErr(errorText(e, t('sq.failed')));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const p = profs ?? {};
  function saveSyms() {
    const list = [...new Set(syms.toUpperCase().split(/[^A-Z.]+/).filter(Boolean))];
    const bad = list.filter((x) => !UNIVERSE.some((u) => u.sym === x));
    if (bad.length) return setErr(t('sq.own.symsBad', { list: bad.join(', ') }));
    void run(() => setConfig(sq, { symbols: list.length ? list.slice(0, 60) : null }), t('sq.own.saved'));
  }
  const check = (label: string, on: boolean, change: (v: boolean) => Promise<unknown>) => (
    <label className={s.check}>
      <input type="checkbox" checked={on} disabled={busy} onChange={(e) => void run(() => change(e.target.checked))} /> {label}
    </label>
  );

  return (
    <Card title={t('sq.own')} className={s.owner}>
      <section className={s.ownSec}>
        <h3 className={s.sub}>{t('sq.own.comp')}</h3>
        {compOn ? (
          <>
            <p className={s.muted}>{t('sq.own.compRunning', { date: formatDate(sq.comp!.end) })}</p>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => setAsk({ title: t('sq.own.compEnd'), body: t('sq.own.compEndBody'), action: t('sq.own.compEnd'), run: () => endComp(sq) })}>
              {t('sq.own.compEnd')}
            </Button>
          </>
        ) : (
          <>
            <p className={s.muted}>{t('sq.own.compBody')}</p>
            <div className={s.inlineRow}>
              {([7, 30] as const).map((d) => (
                <Button key={d} variant="secondary" size="sm" disabled={busy || !profs} onClick={() => void run(() => startComp(sq, p, d), t('sq.own.compStarted'))}>
                  {t('sq.own.compStart', { n: d })}
                </Button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className={s.ownSec}>
        <h3 className={s.sub}>{t('sq.own.goal')}</h3>
        {sq.goal ? (
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => setAsk({ title: t('sq.own.goalClear'), body: t('sq.own.goalClearBody'), action: t('sq.own.goalClear'), run: () => clearGoal(sq) })}>
            {t('sq.own.goalClear')}
          </Button>
        ) : (
          <form
            className={s.goalForm}
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => setGoal(sq, p, goalText, target, goalDays), t('sq.own.goalSet'));
            }}
          >
            <Field label={t('sq.own.goalName')} value={goalText} maxLength={80} placeholder={t('sq.own.goalPlaceholder')} onChange={(e) => setGoalText(e.target.value)} />
            <label className={s.select}>
              <span>{t('sq.own.goalTarget')}</span>
              <select value={target} onChange={(e) => setTarget(+e.target.value)}>
                {GOAL_TARGETS.map((v) => (
                  <option key={v} value={v}>
                    +{v}%
                  </option>
                ))}
              </select>
            </label>
            <label className={s.select}>
              <span>{t('sq.own.goalDays')}</span>
              <select value={goalDays} onChange={(e) => setGoalDays(+e.target.value === 30 ? 30 : 7)}>
                <option value={7}>{t('sq.own.days', { n: 7 })}</option>
                <option value={30}>{t('sq.own.days', { n: 30 })}</option>
              </select>
            </label>
            <Button type="submit" variant="secondary" size="sm" disabled={busy || !profs}>
              {t('sq.own.goalSetGo')}
            </Button>
          </form>
        )}
      </section>

      <section className={s.ownSec}>
        <h3 className={s.sub}>{t('sq.own.code')}</h3>
        <div className={s.inlineRow}>
          {sq.code ? (
            <>
              <b className={[s.code, s.codeBig].join(' ')}>{sq.code}</b>
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => setAsk({ title: t('sq.own.codeNew'), body: t('sq.own.codeNewBody', { code: sq.code! }), action: t('sq.own.codeNew'), run: () => newRoomCode(sq) })}>
                {t('sq.own.codeNew')}
              </Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setAsk({ title: t('sq.own.codeOff'), body: t('sq.own.codeOffBody'), action: t('sq.own.codeOff'), run: () => removeRoomCode(sq) })}>
                {t('sq.own.codeOff')}
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void run(() => newRoomCode(sq))}>
              {t('sq.own.codeMake')}
            </Button>
          )}
        </div>
        <p className={s.muted}>{t('sq.own.codeBody')}</p>
      </section>

      <section className={s.ownSec}>
        <h3 className={s.sub}>{t('sq.own.settings')}</h3>
        <div className={s.checks}>
          {check(t('sq.own.help'), sq.helpMode === true, (v) => setHelpMode(sq, v))}
          {check(t('sq.own.reactions'), sq.config.reactions, (v) => setConfig(sq, { reactions: v }))}
          {check(t('sq.own.photos'), sq.config.photos, (v) => setConfig(sq, { photos: v }))}
          {check(t('sq.own.viewTrades'), sq.config.viewTrades, (v) => setConfig(sq, { viewTrades: v }))}
        </div>
        <div className={s.inline}>
          <Field label={t('sq.own.syms')} value={syms} placeholder="AAPL, NVDA, TSLA" autoCapitalize="characters" spellCheck={false} onChange={(e) => setSyms(e.target.value)} hint={t('sq.own.symsHint')} />
          <Button variant="secondary" size="sm" disabled={busy} onClick={saveSyms}>
            {t('sq.own.symsSave')}
          </Button>
        </div>
      </section>

      <section className={s.ownSec}>
        <h3 className={s.sub}>{t('sq.own.rename')}</h3>
        <div className={s.inline}>
          <Field label={t('sq.create.name')} value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
          <Button variant="secondary" size="sm" disabled={busy || !name.trim() || name.trim() === sq.name} onClick={() => void run(() => renameSquad(sq, name), t('sq.own.saved'))}>
            {t('pf.edit.save')}
          </Button>
        </div>
      </section>

      <section className={s.ownSec}>
        <h3 className={s.sub}>{t('sq.own.members')}</h3>
        <ul className={s.members}>
          {sq.members.map((u) => (
            <li key={u}>
              <span>
                {sq.names[u] || 'Trader'} {u === sq.owner && <small className={s.ownerTag}>{t('sq.owner').toLowerCase()}</small>}
              </span>
              {u !== sq.owner && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setAsk({ title: t('sq.own.remove', { name: sq.names[u] || 'Trader' }), body: t('sq.own.removeBody'), action: t('sq.own.removeGo'), danger: true, run: () => removeMember(sq, u) })}>
                  {t('sq.own.removeGo')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={[s.ownSec, s.danger].join(' ')}>
        <h3 className={s.sub}>{t('sq.own.delete')}</h3>
        <p className={s.muted}>{t('sq.own.deleteBody')}</p>
        <Button variant="danger" size="sm" disabled={busy} onClick={() => setDeleting(true)}>
          {t('sq.own.deleteGo')}…
        </Button>
      </section>

      {err && (
        <p className={s.error} role="alert">
          {err}
        </p>
      )}
      {ask && (
        <Confirm
          open
          title={ask.title}
          action={ask.action}
          variant={ask.danger ? 'danger' : 'primary'}
          busy={busy}
          onClose={() => setAsk(null)}
          onConfirm={() => void run(ask.run).then((ok) => ok && setAsk(null))}
        >
          {ask.body}
        </Confirm>
      )}
      <Confirm
        open={deleting}
        title={t('sq.own.deleteTitle', { name: sq.name })}
        action={t('sq.own.deleteGo')}
        variant="danger"
        busy={busy}
        onClose={() => setDeleting(false)}
        onConfirm={() => {
          if (delName.trim() !== sq.name) return setErr(t('sq.own.deleteMismatch'));
          void run(() => deleteSquad(sq)).then((ok) => ok && navigate('/social'));
        }}
      >
        <DeleteBody name={sq.name} value={delName} onChange={setDelName} />
        {err && <p className={s.error}>{err}</p>}
      </Confirm>
    </Card>
  );
}

function DeleteBody({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className={s.delBody}>
      <p>{t('sq.own.deleteConfirm', { name })}</p>
      <Field label={t('sq.own.deleteType')} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
    </div>
  );
}
