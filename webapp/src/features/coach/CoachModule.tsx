/** /coach → your coaching hub; /coach/:id → one coaching. */
import { Route, Routes } from 'react-router';
import CoachingPage from './CoachingPage';
import CoachPage from './CoachPage';

export default function CoachModule() {
  return (
    <Routes>
      <Route index element={<CoachPage />} />
      <Route path=":id" element={<CoachingPage />} />
    </Routes>
  );
}
