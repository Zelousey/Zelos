/**
 * The red cards (owner's reference images, 2026-10-22): a black-and-white portrait on red, the
 * name in bold capitals, a dark pill bottom-right.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { portraitUrl, type Figure } from './minds';
import s from './Minds.module.css';

export function Portrait({ figure, className }: { figure: Figure; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <span className={[s.portrait, s.initials, className].filter(Boolean).join(' ')} aria-hidden>
        {figure.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
      </span>
    );
  }
  return <img className={[s.portrait, className].filter(Boolean).join(' ')} src={portraitUrl(figure)} alt="" decoding="async" onError={() => setBroken(true)} />;
}

export function FigureCard({ figure, pill, big, to }: { figure: Figure; pill: string; big?: boolean; to?: string }) {
  const body = (
    <>
      <Portrait figure={figure} />
      <span className={s.cardName}>{figure.name}</span>
      <span className={s.pill}>{pill}</span>
    </>
  );
  const cls = [s.card, big && s.cardBig].filter(Boolean).join(' ');
  return to ? (
    <Link className={cls} to={to} aria-label={`${figure.name}, ${figure.role}. ${pill}`}>
      {body}
    </Link>
  ) : (
    <div className={cls} role="img" aria-label={`${figure.name}, ${figure.role}`}>
      {body}
    </div>
  );
}
