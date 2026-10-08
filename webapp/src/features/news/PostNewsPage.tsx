/**
 * Post News (Zelos team only): write, edit or delete News posts, including "voices" (a post
 * by someone who moves markets, pasted from X or Truth Social). The server checks admins/{uid}
 * and validates every field; this screen only helps fill them in.
 */
import { useId, useState, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { Button, Card, Confirm, EmptyState, Field, PageHeader, useToast } from '../../ui';
import { deletePost, savePost, SECTIONS, useCanPost, usePosts, type NewsPost, type NewsSection, type PostInput } from './news';
import { SECTION_LABEL } from './NewsPage';
import s from './News.module.css';

type Form = { section: NewsSection; title: string; body: string; date: string; featured: boolean; linkTo: string; linkLabel: string; platform: 'x' | 'truth' | 'other'; url: string; author: string; handle: string; quote: string; postedAt: string };

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const blank = (): Form => ({ section: 'zelos', title: '', body: '', date: today(), featured: false, linkTo: '', linkLabel: '', platform: 'x', url: '', author: '', handle: '', quote: '', postedAt: today() });
const fromPost = (p: NewsPost): Form => ({
  ...blank(),
  section: p.section,
  title: p.title,
  body: p.body.join('\n\n'),
  date: p.date,
  featured: !!p.featured,
  linkTo: p.link?.to ?? '',
  linkLabel: p.link?.label ?? '',
  ...(p.voice ? { platform: p.voice.platform, url: p.voice.url, author: p.voice.author, handle: p.voice.handle, quote: p.voice.quote, postedAt: p.voice.postedAt } : {}),
});

function toInput(f: Form, id?: string): PostInput {
  const p: PostInput = { section: f.section, title: f.title, body: f.body, date: f.date, featured: f.featured };
  if (id) p.id = id;
  if (f.linkTo.trim()) p.link = { to: f.linkTo.trim(), label: f.linkLabel.trim() };
  if (f.section === 'voices') p.voice = { platform: f.platform, url: f.url.trim(), author: f.author, handle: f.handle, quote: f.quote, postedAt: f.postedAt };
  return p;
}

const message = (e: unknown) => {
  const m = (e as { message?: string })?.message;
  return m && !/^internal$/i.test(m) ? m : t('news.post.failed');
};

function Select({ label, children, ...rest }: { label: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className={s.fieldLabel}>
      <label htmlFor={id}>{label}</label>
      <select id={id} className={s.input} {...rest}>
        {children}
      </select>
    </div>
  );
}

function TextArea({ label, hint, ...rest }: { label: string; hint?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className={s.fieldLabel}>
      <label htmlFor={id}>{label}</label>
      <textarea id={id} className={s.input} aria-describedby={hint ? id + '-hint' : undefined} {...rest} />
      {hint && (
        <small id={id + '-hint'} className={s.hint}>
          {hint}
        </small>
      )}
    </div>
  );
}

export default function PostNewsPage() {
  const { user, isReal, ready } = useAuth();
  const uid = isReal && user ? user.uid : null;
  const canPost = useCanPost(uid);
  const { posts } = usePosts();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const editId = params.get('id');
  const editing = editId ? posts.find((p) => p.id === editId && !p.id.startsWith('b-')) : undefined;
  const [form, setForm] = useState<{ key: string; f: Form }>({ key: 'new', f: blank() });
  const key = editing ? editing.id : 'new';
  const f = form.key === key ? form.f : editing ? fromPost(editing) : blank();
  const set = (patch: Partial<Form>) => setForm({ key, f: { ...f, ...patch } });
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<NewsPost | null>(null);

  if (!ready) return null;
  if (!canPost) {
    return (
      <>
        <PageHeader title={t('news.post.title')} />
        <Card>
          <EmptyState icon="news" body={t('news.post.only')} actions={<Link to="/news">{t('nav.news')}</Link>} />
        </Card>
      </>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await savePost(toInput(f, editing?.id));
      toast.show(editing ? t('news.post.updated') : t('news.post.published'), 'success');
      setForm({ key: 'new', f: blank() });
      setParams({});
    } catch (err) {
      toast.show(message(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  const mine = posts.filter((p) => !p.id.startsWith('b-'));
  return (
    <>
      <PageHeader title={editing ? t('news.post.editTitle') : t('news.post.title')} subtitle={t('news.post.subtitle')} actions={<Link to="/news">{t('news.post.back')}</Link>} />
      <div className={s.postLayout}>
        <Card pad>
          <form className={s.form} onSubmit={submit}>
            <Select label={t('news.post.section')} value={f.section} onChange={(e) => set({ section: e.target.value as NewsSection })}>
              {SECTIONS.map((sec) => (
                <option key={sec} value={sec}>
                  {t(SECTION_LABEL[sec])}
                </option>
              ))}
            </Select>
            {f.section === 'voices' && (
              <fieldset className={s.voiceFields}>
                <legend>{t('news.post.voice')}</legend>
                <Select label={t('news.post.platform')} value={f.platform} onChange={(e) => set({ platform: e.target.value as Form['platform'] })}>
                  <option value="x">{t('news.platform.x')}</option>
                  <option value="truth">{t('news.platform.truth')}</option>
                  <option value="other">{t('news.platform.other')}</option>
                </Select>
                <Field label={t('news.post.url')} value={f.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://x.com/…/status/…" inputMode="url" required />
                <Field label={t('news.post.author')} value={f.author} onChange={(e) => set({ author: e.target.value })} maxLength={60} required />
                <Field label={t('news.post.handle')} value={f.handle} onChange={(e) => set({ handle: e.target.value })} maxLength={40} />
                <TextArea label={t('news.post.quote')} rows={4} value={f.quote} onChange={(e) => set({ quote: e.target.value })} maxLength={1000} required />
                <Field label={t('news.post.postedAt')} type="date" value={f.postedAt} onChange={(e) => set({ postedAt: e.target.value })} />
              </fieldset>
            )}
            <Field label={f.section === 'voices' ? t('news.post.why') : t('news.post.titleField')} value={f.title} onChange={(e) => set({ title: e.target.value })} maxLength={140} required />
            {f.section !== 'voices' && (
              <TextArea label={t('news.post.body')} hint={t('news.post.bodyHint')} rows={8} value={f.body} onChange={(e) => set({ body: e.target.value })} maxLength={4000} required />
            )}
            <div className={s.row2}>
              <Field label={t('news.post.linkTo')} value={f.linkTo} onChange={(e) => set({ linkTo: e.target.value })} placeholder="/practice" />
              <Field label={t('news.post.linkLabel')} value={f.linkLabel} onChange={(e) => set({ linkLabel: e.target.value })} maxLength={40} />
            </div>
            <div className={s.row2}>
              <Field label={t('news.post.date')} type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
              <label className={s.check}>
                <input type="checkbox" checked={f.featured} onChange={(e) => set({ featured: e.target.checked })} />
                {t('news.post.featured')}
              </label>
            </div>
            <div className={s.formActions}>
              {editing && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setForm({ key: 'new', f: blank() });
                    setParams({});
                  }}
                >
                  {t('news.post.cancelEdit')}
                </Button>
              )}
              <Button type="submit" variant="primary" disabled={busy}>
                {editing ? t('news.post.save') : t('news.post.publish')}
              </Button>
            </div>
          </form>
        </Card>
        <Card title={t('news.post.list')}>
          {mine.length ? (
            <ul className={s.adminList}>
              {mine.map((p) => (
                <li key={p.id}>
                  <span>
                    <b>{p.title}</b>
                    <small>
                      {t(SECTION_LABEL[p.section])} · {p.date}
                      {p.featured ? ` · ${t('news.featured')}` : ''}
                    </small>
                  </span>
                  <span className={s.adminActions}>
                    <Button size="sm" variant="ghost" onClick={() => setParams({ id: p.id })}>
                      {t('news.post.edit')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(p)}>
                      {t('news.post.delete')}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="news" body={t('news.post.none')} />
          )}
        </Card>
      </div>
      <Confirm
        open={!!deleting}
        title={t('news.post.deleteTitle')}
        action={t('news.post.delete')}
        variant="danger"
        busy={busy}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          setBusy(true);
          deletePost(deleting.id)
            .then(() => toast.show(t('news.post.deleted'), 'success'))
            .catch((e) => toast.show(message(e), 'error'))
            .finally(() => {
              setBusy(false);
              setDeleting(null);
            });
        }}
      >
        {deleting?.title}
      </Confirm>
    </>
  );
}
