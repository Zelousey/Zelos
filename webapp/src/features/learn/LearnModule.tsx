/** /learn → Trading 101 lessons, /learn/:id → one lesson. */
import { Route, Routes } from 'react-router';
import { LearnPage, LessonPage } from './LearnPage';

export default function LearnModule() {
  return (
    <Routes>
      <Route index element={<LearnPage />} />
      <Route path=":id" element={<LessonPage />} />
    </Routes>
  );
}
