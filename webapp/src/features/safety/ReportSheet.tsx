/** Report something someone posted (and optionally block them). Reasons match the server's list. */
import { useId, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { t, type MessageKey } from '../../lib/i18n';
import { Button, Sheet, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { block, REASONS, reportContent, type Reason, type ReportTarget } from './safety';
import s from './Safety.module.css';

export function ReportSheet({ open, onClose, what, name }: { open: boolean; onClose: () => void; what: ReportTarget; name: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const id = useId();
  async function send() {
    if (!reason || !user) return;
    setBusy(true);
    try {
      await reportContent({ ...what, reason, note: note.trim() || undefined });
      if (alsoBlock) await block(user.uid, what.target);
      toast.show(t(alsoBlock ? 'sf.reportedBlocked' : 'sf.reported', { name }));
      setReason(null);
      setNote('');
      setAlsoBlock(false);
      onClose();
    } catch (e) {
      toast.show(errorText(e, t('sf.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title={t('sf.reportTitle')} labelledBy={`${id}-title`}>
      <div className={s.sheet}>
        <p className={s.muted}>{t(`sf.what.${what.kind}` as MessageKey, { name })}</p>
        <fieldset className={s.reasons}>
          <legend>{t('sf.why')}</legend>
          {REASONS.map((r) => (
            <label key={r} className={s.reason}>
              <input type="radio" name={`${id}-reason`} value={r} checked={reason === r} onChange={() => setReason(r)} />
              <span>{t(`sf.reason.${r}` as MessageKey)}</span>
            </label>
          ))}
        </fieldset>
        <label className={s.noteLabel} htmlFor={`${id}-note`}>
          {t('sf.note')}
        </label>
        <textarea id={`${id}-note`} className={s.note} maxLength={300} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        <label className={s.reason}>
          <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />
          <span>{t('sf.alsoBlock', { name })}</span>
        </label>
        <p className={s.fine}>{t('sf.reviewNote')}</p>
        <Button variant="danger" block disabled={!reason || busy} onClick={() => void send()}>
          {busy ? t('sf.sending') : t('sf.send')}
        </Button>
      </div>
    </Sheet>
  );
}
