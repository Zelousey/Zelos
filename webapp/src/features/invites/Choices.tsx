/** A row of radio chips (buy-in, days, players) for the battle forms. */
import { useId } from 'react';
import s from './Invites.module.css';

export function Choices<T extends number>({ label, value, options, onChange, format }: { label: string; value: T; options: T[]; onChange: (v: T) => void; format: (v: T) => string }) {
  const name = useId();
  return (
    <fieldset className={s.choices}>
      <legend>{label}</legend>
      <div className={s.chips}>
        {options.map((o) => (
          <label key={o} className={[s.chip, o === value && s.chipOn].filter(Boolean).join(' ')}>
            <input type="radio" name={name} value={o} checked={o === value} onChange={() => onChange(o)} />
            {format(o)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
