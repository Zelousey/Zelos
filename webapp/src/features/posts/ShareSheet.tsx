/**
 * Share a closed trade or a finished battle (owner 2026-11-13): the card, a short thesis, then
 * **Share to community** (the Zelos community page) or **Download image** (a picture for Snapchat,
 * Instagram and the like; on a phone it opens the share sheet, where Save Image is one tap).
 */
import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useIntraday } from '../../data/markets';
import { useHistory } from '../../data/useHistory';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { Button, Sheet, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { cardBlob, drawCard } from './cardImage';
import { nyLabel, tradeChart } from './chartData';
import { createPost, THESIS_MAX, type Draft, type SoloCard } from './posts';
import { ShareCard } from './ShareCard';
import s from './Posts.module.css';

/** The preview's chart for a Solo trade: minute prices for a same-day trade, else daily closes (as the server does). */
function useSoloChart(draft: Draft | null): Draft | null {
  const solo = draft?.source === 'solo' ? draft : null;
  const sameDay = !!solo && !!solo.card.openDay && solo.card.openDay === solo.card.closeDay;
  const intra = useIntraday(solo && sameDay ? solo.card.sym : null);
  const hist = useHistory(!!solo && !sameDay && !solo.card.chart);
  return useMemo(() => {
    if (!solo || solo.card.chart) return draft;
    const sell = solo.sellAt ? nyLabel(solo.sellAt) : (solo.card.closeDay ?? '');
    let chart = null;
    if (sameDay) {
      if (intra.status === 'ready') chart = tradeChart(intra.data, solo.buyAt ? nyLabel(solo.buyAt) : solo.card.openDay!, sell);
    } else if (hist.data[solo.card.sym]) chart = tradeChart(hist.data[solo.card.sym]!, solo.card.openDay ?? solo.card.closeDay ?? '', solo.card.closeDay ?? sell.slice(0, 10));
    return chart ? { ...solo, card: { ...solo.card, chart } as SoloCard } : draft;
  }, [draft, solo, sameDay, intra, hist.data]);
}

export function ShareSheet({ draft: given, onClose }: { draft: Draft | null; onClose: () => void }) {
  const { isReal } = useAuth();
  const toast = useToast();
  const id = useId();
  const draft = useSoloChart(given);
  const [thesis, setThesis] = useState('');
  const [busy, setBusy] = useState<'post' | 'save' | null>(null);
  const [posted, setPosted] = useState(false);
  const key = given ? given.source + given.ref : '';
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
  async function save() {
    setBusy('save');
    try {
      const cv = await drawCard(draft!.source, draft!.card, draft!.name, draft!.username, thesis);
      const blob = await cardBlob(cv);
      if (!blob) throw new Error('no image');
      const file = new File([blob], `zelos-${draft!.source === 'solo' ? draft!.card.sym : 'battle'}.png`, { type: 'image/png' });
      // phones: the system share sheet (Save Image, Snapchat, Instagram…); computers: a download
      const phone = window.matchMedia('(pointer: coarse)').matches;
      if (phone && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
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
    <Sheet open onClose={onClose} title={t(draft.source === 'solo' ? 'post.title' : 'post.titleBattle')} labelledBy={`${id}-t`}>
      <div className={s.sheet}>
        <ShareCard source={draft.source} card={draft.card} />
        <label className={s.thesisLabel} htmlFor={`${id}-thesis`}>
          {t('post.thesis')}
          <span className={s.count}>
            {thesis.length}/{THESIS_MAX}
          </span>
        </label>
        <textarea id={`${id}-thesis`} className={s.thesis} rows={3} maxLength={THESIS_MAX} value={thesis} onChange={(e) => setThesis(e.target.value)} placeholder={t(draft.source === 'solo' ? 'post.thesis.solo' : 'post.thesis.battle')} disabled={posted} />
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
          <Button variant="secondary" block onClick={() => void save()} disabled={busy != null}>
            {busy === 'save' ? t('post.making') : t('post.download')}
          </Button>
        </div>
        <p className={s.fine}>{t('post.fine')}</p>
      </div>
    </Sheet>
  );
}
