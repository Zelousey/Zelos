/** /minds → the Hall of Minds grid, /minds/:id → one great mind's dashboard, /minds/:id/:section → one of its pages, /minds/:id/learn/:lesson → a scroll lesson. (The old head-to-head pages, /minds/vs/…, go to the grid.) */
import { useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { BookIntro } from './BookIntro';
import { FigurePage, FigureSectionPage } from './FigurePage';
import { MindsPage } from './MindsPage';
import { ScrollLessonPage } from './ScrollLesson';

export default function MindsModule() {
  // the book plays each time you come into the Hall of Minds at the grid, and not again while you
  // move between the grid and the figures (this module stays mounted); a link straight into a
  // figure or a lesson opens without it
  const { pathname } = useLocation();
  const [intro] = useState(() => /\/minds\/?$/.test(pathname));
  return (
    <>
      {intro && <BookIntro />}
      <Routes>
        <Route index element={<MindsPage />} />
        <Route path="vs/*" element={<Navigate to="/minds" replace />} />
        <Route path=":id" element={<FigurePage />} />
        <Route path=":id/learn/:lesson" element={<ScrollLessonPage />} />
        <Route path=":id/:section" element={<FigureSectionPage />} />
      </Routes>
    </>
  );
}
