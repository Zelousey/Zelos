/** /war → the War zone (market, your War profile, your private Wars); /war/:id → one private War's lobby or War. */
import { Route, Routes } from 'react-router';
import WarLobbyPage from './WarLobbyPage';
import WarPage from './WarPage';

export default function WarModule() {
  return (
    <Routes>
      <Route index element={<WarPage />} />
      <Route path=":id" element={<WarLobbyPage />} />
    </Routes>
  );
}
