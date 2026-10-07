/** "Charts" opens the chart of the last symbol you looked at (SPY the first time). */
import { Navigate } from 'react-router';
import { lastSymbol } from '../markets/useLastSymbol';

export default function ChartsRedirect() {
  return <Navigate to={`/markets/${lastSymbol()}`} replace />;
}
