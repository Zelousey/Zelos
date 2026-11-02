/** /war → the War Zone (your War Zones, market, War profile); /war/base → your base; /war/:id → one War's lobby or map. */
import { Route, Routes } from 'react-router';
import BasePage from './base/BasePage';
import WarLobbyPage from './WarLobbyPage';
import WarPage from './WarPage';

export default function WarModule() {
  return (
    <Routes>
      <Route index element={<WarPage />} />
      <Route path="base" element={<BasePage />} />
      <Route path=":id" element={<WarLobbyPage />} />
    </Routes>
  );
}
