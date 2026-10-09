/**
 * Edit your profile: picture, display name, @username (checked as you type) and bio, the same
 * fields and limits as the website's editor (zelos-profile.js). The server saves the name and
 * @username; the picture is shrunk on the device to a small square before it's saved.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { t } from '../../lib/i18n';
import { Button, Field, Sheet, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { checkUsername, USERNAME_RE, type Availability } from '../welcome/welcome';
import { BIO_MAX, saveProfile, shrinkImage } from './profile';
import s from './Profile.module.css';

type Initial = { name: string; username: string | null; bio: string; avatar: string | null; fallbackPhoto: string | null };

export function EditProfileSheet({ open, onClose, uid, initial }: { open: boolean; onClose: () => void; uid: string; initial: Initial }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const bioId = useId();
  const [name, setName] = useState(initial.name);
  const [username, setUsername] = useState(initial.username ?? '');
  const [bio, setBio] = useState(initial.bio);
  const [avatar, setAvatar] = useState<string | null>(initial.avatar);
  const [checked, setChecked] = useState<{ u: string; a: Availability } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const u = username.trim().replace(/^@/, '').toLowerCase();

  useEffect(() => {
    if (!USERNAME_RE.test(u)) return;
    let live = true;
    const id = setTimeout(() => {
      checkUsername(u, uid)
        .then((a) => live && setChecked({ u, a }))
        .catch(() => live && setChecked({ u, a: 'free' })); // the server checks again when saving
    }, 350);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [u, uid]);
  const avail: Availability = !USERNAME_RE.test(u) ? 'invalid' : u === initial.username ? 'mine' : checked?.u === u ? checked.a : 'checking';
  const userErr = avail === 'invalid' ? (u ? t('wel.username.hint') : t('pf.edit.needUsername')) : avail === 'taken' ? t('wel.username.taken', { u }) : undefined;
  const userHint = avail === 'free' ? t('wel.username.free', { u }) : avail === 'mine' ? t('wel.username.mine', { u }) : t('wel.username.checking');
  const canSave = !busy && name.trim().length > 0 && (avail === 'free' || avail === 'mine');
  const preview = avatar ?? initial.fallbackPhoto;

  async function pick(f: File | undefined) {
    if (!f) return;
    setErr(null);
    try {
      setAvatar(await shrinkImage(f));
    } catch (e) {
      setErr((e as Error).message === 'not-image' ? t('pf.edit.notImage') : t('pf.edit.tooBig'));
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await saveProfile(uid, { name: name.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24), username: u, bio, avatar });
      toast.show(r.awarded ? `${t('pf.edit.saved')} · +25 XP` : t('pf.edit.saved'));
      onClose();
    } catch (e2) {
      setErr(errorText(e2, t('pf.failed')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('pf.edit.title')} labelledBy="pf-edit-title">
      <form className={s.form} onSubmit={save}>
        <div className={s.picRow}>
          {preview ? <img className={s.photo} src={preview} alt={t('pf.edit.picture')} width={72} height={72} referrerPolicy="no-referrer" /> : <span className={s.photo} aria-hidden="true">{(name || '?').slice(0, 1).toUpperCase()}</span>}
          <div className={s.row}>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} data-testid="pf-file" />
            <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              {t('pf.edit.upload')}
            </Button>
            {avatar && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setAvatar(null)}>
                {t('pf.edit.remove')}
              </Button>
            )}
          </div>
        </div>
        <Field label={t('wel.name')} value={name} maxLength={24} autoComplete="nickname" onChange={(e) => setName(e.target.value)} />
        <Field label={t('wel.username')} prefix="@" value={username} maxLength={21} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => setUsername(e.target.value.toLowerCase())} error={userErr} hint={userErr ? undefined : userHint} />
        <div className={s.bioField}>
          <label htmlFor={bioId}>{t('pf.edit.bio')}</label>
          <textarea id={bioId} value={bio} maxLength={BIO_MAX} rows={3} placeholder={t('pf.edit.bioPlaceholder')} onChange={(e) => setBio(e.target.value)} aria-describedby={`${bioId}-n`} />
          <small id={`${bioId}-n`}>{t('pf.edit.bioLeft', { n: BIO_MAX - bio.length })}</small>
        </div>
        {err && (
          <p className={s.error} role="alert">
            {err}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" block disabled={!canSave}>
          {busy ? t('pf.edit.saving') : t('pf.edit.save')}
        </Button>
        <p className={s.fine}>{t('pf.edit.fine')}</p>
      </form>
    </Sheet>
  );
}
