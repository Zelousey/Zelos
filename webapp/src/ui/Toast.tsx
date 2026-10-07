/**
 * Toasts: short, non-blocking confirmations ("Order filled", "Couldn't load").
 * Wrap the app in <ToastProvider>, then `const toast = useToast(); toast.show('…')`.
 * Announced to screen readers through a polite live region.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { t } from '../lib/i18n';
import { Button } from './Button';
import { Icon } from './Icon';
import s from './Toast.module.css';

type Tone = 'info' | 'success' | 'error';
type Toast = { id: number; message: string; tone: Tone };
type Api = { show: (message: string, tone?: Tone, ms?: number) => void };

const Ctx = createContext<Api | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (message: string, tone: Tone = 'info', ms = 4000) => {
      const id = nextId++;
      setToasts((all) => [...all.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), ms);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ show }), [show]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className={s.region} role="status" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className={[s.toast, s[x.tone]].join(' ')}>
            <span className={s.msg}>{x.message}</span>
            <Button variant="ghost" size="sm" iconOnly aria-label={t('common.close')} onClick={() => dismiss(x.id)}>
              <Icon name="close" size={16} />
            </Button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): Api {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
