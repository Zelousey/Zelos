/** A row of radio chips (buy-in, days, players, mode) for the battle forms. A locked option is shown but can't be picked. */
import { useId } from 'react';
import s from './Invites.module.css';

export function Choices<T extends number | string>({ label, value, options, onChange, format, locked }: { label: string; value: T; options: T[]; onChange: (v: T) => void; format: (v: T) => string; locked?: (v: T) => boolean }) {
  const name = useId();
  return (
    <fieldset className={s.choices}>
      <legend>{label}</legend>
      <div className={s.chips}>
        {options.map((o) => {
          const off = locked?.(o) ?? false;
          return (
            <label key={o} className={[s.chip, o === value && s.chipOn, off && s.chipLocked].filter(Boolean).join(' ')}>
              <input type="radio" name={name} value={o} checked={o === value} disabled={off} onChange={() => onChange(o)} />
              {off && <span aria-hidden="true">🔒 </span>}
              {format(o)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
