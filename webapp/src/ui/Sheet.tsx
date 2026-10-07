/**
 * Sheet: the one overlay component. It covers modals, side drawers and phone bottom
 * sheets, so they all behave the same (Esc closes, focus is trapped, background is inert).
 *
 * placement: 'auto' (bottom sheet on phones, right drawer on larger screens) · 'center'
 * (confirmations) · 'right' · 'bottom'. Built on the native <dialog> element, which gives
 * focus trapping and the top layer for free.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { t } from '../lib/i18n';
import { useMediaQuery, PHONE_QUERY } from '../lib/useMediaQuery';
import { Button } from './Button';
import { Icon } from './Icon';
import s from './Sheet.module.css';

type Placement = 'auto' | 'center' | 'right' | 'bottom';

export function Sheet({ open, onClose, title, placement = 'auto', children, labelledBy }: { open: boolean; onClose: () => void; title?: ReactNode; placement?: Placement; children: ReactNode; labelledBy?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const phone = useMediaQuery(PHONE_QUERY);
  const resolved = placement === 'auto' ? (phone ? 'bottom' : 'right') : placement;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
    } else if (!open && el.open) {
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={[s.dialog, s[resolved]].join(' ')}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
    >
      {open && (
        <div className={s.inner}>
          {resolved === 'bottom' && <div className={s.grab} aria-hidden />}
          {title != null && (
            <div className={s.head}>
              <h2 className={s.title} id={labelledBy}>
                {title}
              </h2>
              <Button variant="ghost" iconOnly aria-label={t('common.close')} onClick={onClose}>
                <Icon name="close" />
              </Button>
            </div>
          )}
          <div className={s.body}>{children}</div>
        </div>
      )}
    </dialog>
  );
}
