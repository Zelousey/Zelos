/**
 * The strategy pictures from the homepage cards (index.html): a candle chart with the entry and
 * exit marked, drawn with app colour tokens so it follows the theme. Our own files, inlined.
 */
import swing from './art/swing-trader.svg?raw';
import breakout from './art/breakout-rider.svg?raw';
import options from './art/options-scanner.svg?raw';
import { t } from '../../lib/i18n';
import type { StrategyId } from './strategies';
import s from './Strategies.module.css';

const ART: Record<StrategyId, string> = { 'swing-trader': swing, 'breakout-rider': breakout, 'options-scanner': options };

export function StrategyArt({ id, name, size = 'md' }: { id: StrategyId; name: string; size?: 'sm' | 'md' | 'lg' }) {
  return <div className={[s.art, s[`art-${size}`]].join(' ')} role="img" aria-label={t('st.art', { name })} dangerouslySetInnerHTML={{ __html: ART[id] }} />;
}
