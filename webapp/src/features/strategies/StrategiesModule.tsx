/** /strategies → every strategy; /strategies/:id → one strategy. */
import { Route, Routes } from 'react-router';
import StrategiesPage from './StrategiesPage';
import StrategyPage from './StrategyPage';

export default function StrategiesModule() {
  return (
    <Routes>
      <Route index element={<StrategiesPage />} />
      <Route path=":id" element={<StrategyPage />} />
    </Routes>
  );
}
