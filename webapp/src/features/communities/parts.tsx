/** Pieces shared by the communities hub and a community's page. */
import { Link } from 'react-router';
import { t } from '../../lib/i18n';
import { STATES, TIERS, type Community } from './communities';
import s from './Communities.module.css';

const num = (v: number) => v.toLocaleString('en-US');

/** A community in a list: name, state, members, XP, founder title. */
export function CommunityCard({ c, sub }: { c: Community; sub?: string }) {
  return (
    <Link className={s.card} to={`/communities/${encodeURIComponent(c.id)}`}>
      <b>{c.name}</b>
      <small className={s.muted}>{STATES[c.state] ?? c.state}</small>
      <span className={s.nums}>
        <span>{t('cm.members', { n: num(c.members) })}</span>
        <span>{t('cm.xp', { n: num(c.xp) })}</span>
        {c.title && <span className={s.title}>{c.title}</span>}
      </span>
      {sub && <small className={s.sub}>{sub}</small>}
    </Link>
  );
}

/** The five founder milestones; with c, which are unlocked. */
export function Milestones({ c }: { c?: Community }) {
  return (
    <ul className={s.tiers} aria-label={t('cm.milestones')}>
      {TIERS.map(([need, tokens, title, icon]) => {
        const got = !!c && c.rewarded.includes(need);
        return (
          <li key={need} className={got ? s.got : undefined}>
            <span aria-hidden="true" className={s.ico}>
              {icon}
            </span>
            <b>{t('cm.tierMembers', { n: need === 100 ? '100+' : need })}</b>
            <span>{title}</span>
            <small>{got ? t('cm.unlocked') : t('cm.tierTokens', { n: num(tokens) })}</small>
          </li>
        );
      })}
    </ul>
  );
}

export const StateSelect = ({ id, value, onChange, label }: { id: string; value: string; onChange: (v: string) => void; label: string }) => (
  <div className={s.select}>
    <label htmlFor={id}>{label}</label>
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('cm.pickState')}</option>
      {Object.entries(STATES).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  </div>
);
