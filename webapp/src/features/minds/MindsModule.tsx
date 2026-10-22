/** /minds → the Hall of Minds grid, /minds/:id → one figure, /minds/vs/:id → a head-to-head pair. */
import { Route, Routes } from 'react-router';
import { FigurePage } from './FigurePage';
import { MindsPage } from './MindsPage';
import { PairPage } from './PairPage';

export default function MindsModule() {
  return (
    <Routes>
      <Route index element={<MindsPage />} />
      <Route path="vs/:id" element={<PairPage />} />
      <Route path=":id" element={<FigurePage />} />
    </Routes>
  );
}
