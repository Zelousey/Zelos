/**
 * Squad chat (members only): the last 60 messages, reactions when the owner allows them,
 * camera-roll photos when the owner allows them. You can delete your own messages; the owner
 * can delete any.
 */
import { useEffect, useRef, useState } from 'react';
import { formatMarketTime, formatDate } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { Button, Card, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { chatPhoto, deleteMessage, react, REACTION_EMOJI, REACTIONS, sendMessage, useMessages, type Message, type Squad } from './squads';
import s from './Social.module.css';

const when = (at: number) => (new Date(at).toDateString() === new Date().toDateString() ? formatMarketTime(at) : `${formatDate(at)} ${formatMarketTime(at)}`);

export function SquadChat({ sq, uid }: { sq: Squad; uid: string }) {
  const toast = useToast();
  const [attempt, setAttempt] = useState(0);
  const msgs = useMessages(sq.id, attempt);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const owner = sq.owner === uid;
  const count = msgs.status === 'ready' ? msgs.data.length : 0;

  // right after joining the chat rules may not see your membership yet: retry a few times
  useEffect(() => {
    if (msgs.status !== 'error' || attempt >= 10) return;
    const id = setTimeout(() => setAttempt((a) => a + 1), 800);
    return () => clearTimeout(id);
  }, [msgs.status, attempt]);
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const tx = text;
    const ph = photo;
    if (!tx.trim() && !ph) return;
    setText('');
    setPhoto(null);
    setErr(null);
    try {
      await sendMessage(sq, uid, tx, ph);
    } catch (e2) {
      setText(tx);
      setPhoto(ph);
      setErr(errorText(e2, t('sq.chat.failed')));
    }
  }
  async function pick(f: File | undefined) {
    if (!f) return;
    try {
      setPhoto(await chatPhoto(f));
    } catch (e) {
      setErr(errorText(e, t('sq.chat.failed')));
    }
  }

  return (
    <Card flush title={t('sq.chat')} className={s.chat}>
      <div className={s.msgs} ref={box} aria-live="polite" tabIndex={0} role="log" aria-label={t('sq.chat')}>
        {msgs.status === 'ready' ? (
          msgs.data.length ? (
            msgs.data.map((m) => <Bubble key={m.id} m={m} sq={sq} uid={uid} canDelete={m.author === uid || owner} onError={(x) => toast.show(x, 'error')} />)
          ) : (
            <p className={s.muted}>{t('sq.chat.empty')}</p>
          )
        ) : msgs.status === 'error' && attempt >= 10 ? (
          <p className={s.muted}>{t('sq.chat.error')}</p>
        ) : (
          <p className={s.muted}>{t('sq.chat.loading')}</p>
        )}
      </div>
      {photo && (
        <div className={s.photoPrev}>
          <img src={photo} alt={t('sq.chat.photoToSend')} />
          <Button variant="ghost" size="sm" onClick={() => setPhoto(null)}>
            {t('pf.edit.remove')}
          </Button>
        </div>
      )}
      <form className={s.compose} onSubmit={send}>
        {sq.config.photos && (
          <>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} data-testid="sq-photo" />
            <Button type="button" variant="ghost" size="sm" iconOnly aria-label={t('sq.chat.addPhoto')} onClick={() => fileRef.current?.click()}>
              <span aria-hidden="true">📷</span>
            </Button>
          </>
        )}
        <input className={s.composeInput} value={text} maxLength={500} placeholder={t('sq.chat.placeholder')} aria-label={t('sq.chat.message')} autoComplete="off" onChange={(e) => setText(e.target.value)} />
        <Button type="submit" variant="primary" size="sm" disabled={!text.trim() && !photo}>
          {t('sq.chat.send')}
        </Button>
      </form>
      {err && (
        <p className={[s.error, s.chatErr].join(' ')} role="alert">
          {err}
        </p>
      )}
    </Card>
  );
}

function Bubble({ m, sq, uid, canDelete, onError }: { m: Message; sq: Squad; uid: string; canDelete: boolean; onError: (msg: string) => void }) {
  const counts: Partial<Record<string, number>> = {};
  for (const k of Object.values(m.r)) counts[k] = (counts[k] ?? 0) + 1;
  return (
    <div className={[s.msg, m.author === uid && s.msgMine].filter(Boolean).join(' ')}>
      <div className={s.msgHead}>
        <b>{m.name}</b>
        <small>{when(m.at)}</small>
        {canDelete && (
          <button type="button" className={s.msgDel} aria-label={t('sq.chat.delete')} onClick={() => window.confirm(t('sq.chat.deleteConfirm')) && void deleteMessage(sq, m).catch((e) => onError(errorText(e, t('sq.chat.failed'))))}>
            ×
          </button>
        )}
      </div>
      {m.text && <p>{m.text}</p>}
      {m.photo && <img className={s.msgImg} src={m.photo} alt={t('sq.chat.photoFrom', { name: m.name })} />}
      {sq.config.reactions && (
        <div className={s.reacts}>
          {REACTIONS.map((k) => {
            const n = counts[k] ?? 0;
            const on = m.r[uid] === k;
            return (
              <button key={k} type="button" className={[s.react, on && s.reactOn, n && s.reactHas].filter(Boolean).join(' ')} aria-pressed={on} aria-label={`${t(`sq.react.${k}` as MessageKey)}${n ? ` (${n})` : ''}`} onClick={() => void react(sq, m, uid, k).catch((e) => onError(errorText(e, t('sq.chat.failed'))))}>
                <span aria-hidden="true">{REACTION_EMOJI[k]}</span>
                {n > 0 && <small>{n}</small>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
