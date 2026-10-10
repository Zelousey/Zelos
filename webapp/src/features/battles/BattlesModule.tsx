/** /battles → your battles; /battles/:id → one battle's room. */
import { Route, Routes } from 'react-router';
import BattlePage from './BattlePage';
import BattlesPage from './BattlesPage';

export default function BattlesModule() {
  return (
    <Routes>
      <Route index element={<BattlesPage />} />
      <Route path=":id" element={<BattlePage />} />
    </Routes>
  );
}
