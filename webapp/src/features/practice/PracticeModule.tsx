/** /practice → your account, /practice/trade/:sym → the order ticket for that stock. */
import { Navigate, Route, Routes } from 'react-router';
import PracticePage from './PracticePage';
import TradePage from './TradePage';

export default function PracticeModule() {
  return (
    <Routes>
      <Route index element={<PracticePage />} />
      <Route path="trade/:sym" element={<TradePage />} />
      <Route path="trade" element={<Navigate to="/markets" replace />} />
    </Routes>
  );
}
