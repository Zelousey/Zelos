/** /battles → your battles; /battles/:id → one battle's room; /battles/:id/rematch → challenge them again. */
import { Route, Routes } from 'react-router';
import BattlePage from './BattlePage';
import BattlesPage from './BattlesPage';
import RematchPage from './RematchPage';

export default function BattlesModule() {
  return (
    <Routes>
      <Route index element={<BattlesPage />} />
      <Route path=":id" element={<BattlePage />} />
      <Route path=":id/rematch" element={<RematchPage />} />
    </Routes>
  );
}
