/** /practice → the Dashboard, where your account now lives (owner 2026-10-20);
 *  /practice/trade/:sym → the Buy/Sell ticket for that stock (shares or options). */
import { Navigate, Route, Routes } from 'react-router';
import TradePage from './TradePage';

export default function PracticeModule() {
  return (
    <Routes>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="trade/:sym" element={<TradePage />} />
      <Route path="trade" element={<Navigate to="/markets" replace />} />
    </Routes>
  );
}
