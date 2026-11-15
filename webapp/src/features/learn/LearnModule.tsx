/** /learn → the Trading 101 bookshelf, /learn/:chapter → one book (or an old lesson's redirect), /learn/:chapter/:lesson → a lesson, /learn/:chapter/quiz → the chapter quiz. */
import { Route, Routes } from 'react-router';
import { ChapterQuiz } from './ChapterQuiz';
import { BookPage, LearnPage } from './LearnPage';
import { LessonPlayer } from './LessonPlayer';
import s from './Learn.module.css';

export default function LearnModule() {
  return (
    <div className={s.t101}>
      <Routes>
      <Route index element={<LearnPage />} />
      <Route path=":chapter/quiz" element={<ChapterQuiz />} />
      <Route path=":chapter/:lesson" element={<LessonPlayer />} />
      <Route path=":chapter" element={<BookPage />} />
      </Routes>
    </div>
  );
}
