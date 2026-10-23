/** /minds → the Hall of Minds grid, /minds/:id → one great mind, /minds/:id/learn/:lesson → a scroll lesson. (The old head-to-head pages, /minds/vs/…, go to the grid.) */
import { Navigate, Route, Routes } from 'react-router';
import { FigurePage } from './FigurePage';
import { MindsPage } from './MindsPage';
import { ScrollLessonPage } from './ScrollLesson';

export default function MindsModule() {
  return (
    <Routes>
      <Route index element={<MindsPage />} />
      <Route path="vs/*" element={<Navigate to="/minds" replace />} />
      <Route path=":id" element={<FigurePage />} />
      <Route path=":id/learn/:lesson" element={<ScrollLessonPage />} />
    </Routes>
  );
}
