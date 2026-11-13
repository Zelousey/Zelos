/**
 * One line of the chart colours in Settings (owner 2026-11-12: "instead of showing all the colors at
 * once ... they click on it and it opens up the colors"). The line shows the name and the current
 * colour; tapping it opens the choices under it. One line is open at a time (the page holds which).
 */
import { useId, type ReactNode } from 'react';
import s from './SettingsPage.module.css';

export function PickRow({ label, value, preview, open, onToggle, children }: { label: string; value: string; preview: ReactNode; open: boolean; onToggle: () => void; children: ReactNode }) {
  const id = useId();
  return (
    <div className={s.pick}>
      <button type="button" className={s.pickHead} aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <span className={s.pickName}>{label}</span>
        <span className={s.pickVal}>
          <span className={s.pickPreview} aria-hidden>
            {preview}
          </span>
          <span>{value}</span>
        </span>
        <span className={s.chev} aria-hidden />
      </button>
      {open && (
        <div id={id} className={s.pickBody}>
          {children}
        </div>
      )}
    </div>
  );
}
