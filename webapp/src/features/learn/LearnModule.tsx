/** /learn → the Trading 101 bookshelf, /learn/:chapter → one book (or an old lesson's redirect), /learn/:chapter/:lesson → a lesson, /learn/:chapter/quiz → the chapter quiz, /learn/review → review missed questions, /learn/league → the weekly learning league. */
import { Route, Routes } from 'react-router';
import { ChapterQuiz } from './ChapterQuiz';
import { BookPage, LearnPage } from './LearnPage';
import { LeaguePage } from './LeaguePage';
import { LessonPlayer } from './LessonPlayer';
import { ReviewPage } from './ReviewPage';
import s from './Learn.module.css';

export default function LearnModule() {
  return (
    <div className={s.t101}>
      <Routes>
      <Route index element={<LearnPage />} />
      <Route path="review" element={<ReviewPage />} />
      <Route path="league" element={<LeaguePage />} />
      <Route path=":chapter/quiz" element={<ChapterQuiz />} />
      <Route path=":chapter/:lesson" element={<LessonPlayer />} />
      <Route path=":chapter" element={<BookPage />} />
      </Routes>
    </div>
  );
}
