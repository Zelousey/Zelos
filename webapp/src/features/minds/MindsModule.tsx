/** /minds → the Hall of Minds grid, /minds/:id → one great mind's dashboard, /minds/:id/:section → one of its pages, /minds/:id/learn/:lesson → a scroll lesson. (The old head-to-head pages, /minds/vs/…, go to the grid.) */
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { BookIntro } from './BookIntro';
import { FigurePage, FigureSectionPage } from './FigurePage';
import { MindsPage } from './MindsPage';
import { markMindsSeen } from './QuoteCard';
import { ScrollLessonPage } from './ScrollLesson';

const INTRO_KEY = 'zelosMindsIntro';
/** sessionStorage lasts while the app (or tab) is open, so a fresh launch plays the book again. */
function introPlayed(): boolean {
  try {
    return sessionStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return false;
  }
}
function markIntroPlayed() {
  try {
    sessionStorage.setItem(INTRO_KEY, '1');
  } catch {
    /* private mode: it just plays again */
  }
}

export default function MindsModule() {
  // the book plays when you come into the Hall of Minds at the grid; a link straight into a figure
  // or a lesson opens without it
  // owner 2026-11-23: only once per app visit; it plays again after the app is closed and reopened
  const { pathname } = useLocation();
  const [intro] = useState(() => /\/minds\/?$/.test(pathname) && !introPlayed());
  useEffect(() => {
    if (intro) markIntroPlayed();
  }, [intro]);
  // the quote card waits until you've been away from the Hall of Minds a few days
  useEffect(() => markMindsSeen(), []);
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
