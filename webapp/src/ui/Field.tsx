/** A labelled input with optional prefix/suffix ($, shares), hint and error. Numbers use the mono font. */
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import s from './Field.module.css';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> & { label: ReactNode; prefix?: ReactNode; suffix?: ReactNode; hint?: ReactNode; error?: ReactNode };

export function Field({ label, prefix, suffix, hint, error, id, ...rest }: Props) {
  const auto = useId();
  const fid = id ?? auto;
  const describedBy = [hint && `${fid}-hint`, error && `${fid}-err`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={[s.field, error && s.invalid].filter(Boolean).join(' ')}>
      <label className={s.label} htmlFor={fid}>
        {label}
      </label>
      <div className={s.control}>
        {prefix != null && <span className={s.affix}>{prefix}</span>}
        <input id={fid} aria-invalid={!!error} aria-describedby={describedBy} {...rest} />
        {suffix != null && <span className={s.affix}>{suffix}</span>}
      </div>
      {error ? (
        <span className={s.error} id={`${fid}-err`}>
          {error}
        </span>
      ) : hint ? (
        <span className={s.hint} id={`${fid}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
