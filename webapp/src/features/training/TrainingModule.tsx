/** /training → the Training Ground; /training/:id → one drill. */
import { Route, Routes } from 'react-router';
import DrillPage from './DrillPage';
import TrainingPage from './TrainingPage';

export default function TrainingModule() {
  return (
    <Routes>
      <Route index element={<TrainingPage />} />
      <Route path=":id" element={<DrillPage />} />
    </Routes>
  );
}
