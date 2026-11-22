/** /practice → the Dashboard, where your account now lives (owner 2026-10-20);
 *  /practice/calendar → the profit calendar (owner 2026-11-19);
 *  /practice/trade/:sym → the Buy/Sell ticket for that stock (shares or options). */
import { Navigate, Route, Routes } from 'react-router';
import CalendarPage from './CalendarPage';
import TradePage from './TradePage';

export default function PracticeModule() {
  return (
    <Routes>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="calendar" element={<CalendarPage />} />
      <Route path="trade/:sym" element={<TradePage />} />
      <Route path="trade" element={<Navigate to="/markets" replace />} />
    </Routes>
  );
}
