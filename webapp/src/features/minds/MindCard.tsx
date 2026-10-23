/**
 * The red cards (owner's reference images, 2026-10-22): a black-and-white portrait on red, the
 * name in bold capitals, a dark pill bottom-right. A pair card shows two faces melting into
 * each other (made ahead of time by scripts/minds/pairs.py: public/minds/pair-<id>.webp).
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { figureById, pairUrl, portraitUrl, type Figure, type Pair } from './minds';
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

export function PairCard({ pair, pill, big, to }: { pair: Pair; pill: string; big?: boolean; to?: string }) {
  const [broken, setBroken] = useState(false);
  const body = (
    <>
      {broken ? (
        <span className={s.pairFaces} aria-hidden>
          <Portrait figure={figureById(pair.a)!} className={s.left} />
          <Portrait figure={figureById(pair.b)!} className={s.right} />
        </span>
      ) : (
        <img className={s.pairArt} src={pairUrl(pair)} alt="" decoding="async" onError={() => setBroken(true)} />
      )}
      <span className={s.cardName}>{pair.title}</span>
      <span className={s.pill}>{pill}</span>
    </>
  );
  const cls = [s.card, s.pairCard, big && s.cardBig].filter(Boolean).join(' ');
  return to ? (
    <Link className={cls} to={to} aria-label={`${pair.title}. ${pill}`}>
      {body}
    </Link>
  ) : (
    <div className={cls} role="img" aria-label={pair.title}>
      {body}
    </div>
  );
}
