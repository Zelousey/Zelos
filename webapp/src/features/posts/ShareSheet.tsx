/**
 * Share a closed trade or a finished battle (owner 2026-11-13): the card, a short thesis, then
 * post it to the Zelos community, or send the picture to another app (or save it).
 */
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { Button, Sheet, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { cardBlob, drawCard } from './cardImage';
import { createPost, THESIS_MAX, type Draft } from './posts';
import { ShareCard } from './ShareCard';
import s from './Posts.module.css';

export function ShareSheet({ draft, onClose }: { draft: Draft | null; onClose: () => void }) {
  const { isReal } = useAuth();
  const toast = useToast();
  const id = useId();
  const [thesis, setThesis] = useState('');
  const [busy, setBusy] = useState<'post' | 'share' | null>(null);
  const [posted, setPosted] = useState(false);
  const key = draft ? draft.source + draft.ref : '';
  // a new card starts empty
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setThesis('');
    setPosted(false);
    setBusy(null);
  }
  if (!draft) return null;

  async function post() {
    setBusy('post');
    try {
      await createPost(draft!.source, draft!.ref, thesis.trim());
      setPosted(true);
      toast.show(t('post.posted'));
    } catch (e) {
      toast.show(errorText(e, t('post.failed')), 'error');
    } finally {
      setBusy(null);
    }
  }
  async function share() {
    setBusy('share');
    try {
      const cv = await drawCard(draft!.source, draft!.card, draft!.name, thesis);
      const blob = await cardBlob(cv);
      if (!blob) throw new Error('no image');
      const file = new File([blob], `zelos-${draft!.source === 'solo' ? draft!.card.sym : 'battle'}.png`, { type: 'image/png' });
      const text = thesis.trim() ? `${thesis.trim()}\n\n${t('post.shareText')}` : t('post.shareText');
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast.show(t('post.saved'));
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') toast.show(t('post.shareFailed'), 'error');
    } finally {
      setBusy(null);
    }
  }
  return (
    <Sheet open onClose={onClose} title={t('post.title')} labelledBy={`${id}-t`}>
      <div className={s.sheet}>
        <ShareCard source={draft.source} card={draft.card} />
        <label className={s.thesisLabel} htmlFor={`${id}-thesis`}>
          {t('post.thesis')}
          <span className={s.count}>
            {thesis.length}/{THESIS_MAX}
          </span>
        </label>
        <textarea id={`${id}-thesis`} className={s.thesis} rows={4} maxLength={THESIS_MAX} value={thesis} onChange={(e) => setThesis(e.target.value)} placeholder={t(draft.source === 'solo' ? 'post.thesis.solo' : 'post.thesis.battle')} disabled={posted} />
        <div className={s.sheetActions}>
          {isReal &&
            (posted ? (
              <Link className={s.postedLink} to={`/communities?feed=${draft.source}`} onClick={onClose}>
                {t('post.seeIt')} →
              </Link>
            ) : (
              <Button variant="primary" block onClick={() => void post()} disabled={busy != null}>
                {busy === 'post' ? t('post.posting') : t('post.toCommunity')}
              </Button>
            ))}
          <Button variant="secondary" block onClick={() => void share()} disabled={busy != null}>
            {busy === 'share' ? t('post.making') : t('post.elsewhere')}
          </Button>
        </div>
        <p className={s.fine}>{t('post.fine')}</p>
      </div>
    </Sheet>
  );
}
