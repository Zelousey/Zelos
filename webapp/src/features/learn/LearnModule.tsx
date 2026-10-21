/** /learn → Trading 101 chapters, /learn/:chapter/:lesson → a lesson, /learn/:chapter/quiz → the chapter quiz. */
import { Route, Routes } from 'react-router';
import { ChapterQuiz } from './ChapterQuiz';
import { LearnPage, OldLessonRedirect } from './LearnPage';
import { LessonPlayer } from './LessonPlayer';

export default function LearnModule() {
  return (
    <Routes>
      <Route index element={<LearnPage />} />
      <Route path=":chapter/quiz" element={<ChapterQuiz />} />
      <Route path=":chapter/:lesson" element={<LessonPlayer />} />
      <Route path=":id" element={<OldLessonRedirect />} />
    </Routes>
  );
}
