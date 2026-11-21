/** /alerts → every alert (and notification switches); /alerts/declined → the ones you passed on; /alerts/:id → one alert. */
import { Route, Routes } from 'react-router';
import AlertPage from './AlertPage';
import AlertsPage from './AlertsPage';
import DeclinedPage from './DeclinedPage';

export default function AlertsModule() {
  return (
    <Routes>
      <Route index element={<AlertsPage />} />
      <Route path="declined" element={<DeclinedPage />} />
      <Route path=":id" element={<AlertPage />} />
    </Routes>
  );
}
