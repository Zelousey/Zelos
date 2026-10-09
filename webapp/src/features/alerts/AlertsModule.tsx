/** /alerts → every alert (and notification switches); /alerts/:id → one alert. */
import { Route, Routes } from 'react-router';
import AlertPage from './AlertPage';
import AlertsPage from './AlertsPage';

export default function AlertsModule() {
  return (
    <Routes>
      <Route index element={<AlertsPage />} />
      <Route path=":id" element={<AlertPage />} />
    </Routes>
  );
}
