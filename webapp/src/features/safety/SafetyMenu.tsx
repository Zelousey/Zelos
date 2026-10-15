/**
 * "⋯" next to anything someone else posted: Report, and Block / Unblock that person.
 * Shown only to signed-in people, never on your own things.
 */
import { useId, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { useUserDoc } from '../../data/userDoc';
import { Button, Confirm, Sheet, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { ReportSheet } from './ReportSheet';
import { block, unblock, type ReportTarget } from './safety';
import s from './Safety.module.css';

export function SafetyMenu({ what, name, label, size = 'sm' }: { what: ReportTarget; name: string; label?: string; size?: 'sm' | 'md' }) {
  const { user, isReal } = useAuth();
  const me = useUserDoc(isReal && user ? user.uid : null);
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const id = useId();
  if (!isReal || !user || user.uid === what.target) return null;
  const blocked = me.status === 'ready' && me.data.blocked.includes(what.target);
  async function flip() {
    setBusy(true);
    try {
      if (blocked) await unblock(user!.uid, what.target);
      else await block(user!.uid, what.target);
      toast.show(t(blocked ? 'sf.unblocked' : 'sf.blockedToast', { name }));
      setConfirm(false);
    } catch (e) {
      toast.show(errorText(e, t('sf.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button variant="ghost" size={size} iconOnly={!label} aria-label={label ? undefined : t('sf.more', { name })} className={s.moreBtn} onClick={() => setMenu(true)}>
        {label ?? <span aria-hidden="true">⋯</span>}
      </Button>
      <Sheet open={menu} onClose={() => setMenu(false)} title={name} labelledBy={`${id}-menu`} placement="center">
        <div className={s.menu}>
          <Button variant="secondary" block onClick={() => (setMenu(false), setReport(true))}>
            {t('sf.report')}
          </Button>
          <Button variant={blocked ? 'secondary' : 'danger'} block onClick={() => (setMenu(false), blocked ? void flip() : setConfirm(true))}>
            {blocked ? t('sf.unblock', { name }) : t('sf.block', { name })}
          </Button>
        </div>
      </Sheet>
      <ReportSheet open={report} onClose={() => setReport(false)} what={what} name={name} />
      <Confirm open={confirm} title={t('sf.blockTitle', { name })} action={t('sf.blockAction')} variant="danger" busy={busy} onConfirm={() => void flip()} onClose={() => setConfirm(false)}>
        {t('sf.blockBody')}
      </Confirm>
    </>
  );
}

/** The signed-in person's block list (empty for guests). */
export function useBlocked(): string[] {
  const { user, isReal } = useAuth();
  const me = useUserDoc(isReal && user ? user.uid : null);
  return me.status === 'ready' ? me.data.blocked : [];
}
