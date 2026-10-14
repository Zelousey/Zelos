/** Edit your watchlist: remove stocks, or add one from the Zelos list. */
import { useId, useState } from 'react';
import { instrument, UNIVERSE } from '../../data/universe';
import { t } from '../../lib/i18n';
import { Button, Sheet, useToast } from '../../ui';
import { unwatch, watch, WATCH_MAX } from './watchlist';
import s from './WatchlistEditor.module.css';

export function WatchlistEditor({ uid, list, open, onClose }: { uid: string; list: string[]; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [sym, setSym] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const ids = useId();
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const v = sym.trim().toUpperCase();
    if (!instrument(v)) return setErr(t('wl.unknown', { sym: v || '?' }));
    if (list.includes(v)) return setErr(t('wl.already', { sym: v }));
    try {
      if (!(await watch(uid, v, list))) return setErr(t('wl.full', { n: WATCH_MAX }));
      setSym('');
      setErr(null);
    } catch {
      toast.show(t('wl.failed'), 'error');
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title={t('wl.edit')} labelledBy="wl-edit-title">
      <form className={s.add} onSubmit={add}>
        <label htmlFor={`${ids}-sym`}>{t('wl.addLabel')}</label>
        <div className={s.row}>
          <input id={`${ids}-sym`} list={`${ids}-list`} value={sym} maxLength={8} autoCapitalize="characters" autoComplete="off" onChange={(e) => setSym(e.target.value)} placeholder="AAPL" />
          <Button type="submit" variant="primary">
            {t('wl.add')}
          </Button>
        </div>
        <datalist id={`${ids}-list`}>
          {UNIVERSE.map((i) => (
            <option key={i.sym} value={i.sym}>
              {i.name}
            </option>
          ))}
        </datalist>
        {err && (
          <p className={s.error} role="alert">
            {err}
          </p>
        )}
      </form>
      {list.length === 0 ? (
        <p className={s.muted}>{t('dash.watchlist.empty')}</p>
      ) : (
        <ul className={s.list} aria-label={t('dash.watchlist')}>
          {list.map((x) => (
            <li key={x}>
              <span>
                <b>{x}</b> <small>{instrument(x)?.name ?? ''}</small>
              </span>
              <Button size="sm" variant="ghost" aria-label={t('wl.remove', { sym: x })} onClick={() => void unwatch(uid, x).catch(() => toast.show(t('wl.failed'), 'error'))}>
                ✕
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
