/** /coach → your coaching hub; /coach/:id → one coaching; /coach/:id/play/new and /coach/:id/play/:playId → chart plays. */
import { Route, Routes } from 'react-router';
import CoachingPage from './CoachingPage';
import CoachPage from './CoachPage';
import PlayEditor from './PlayEditor';
import PlayPage from './PlayPage';

export default function CoachModule() {
  return (
    <Routes>
      <Route index element={<CoachPage />} />
      <Route path=":id" element={<CoachingPage />} />
      <Route path=":id/play/new" element={<PlayEditor />} />
      <Route path=":id/play/:playId" element={<PlayPage />} />
    </Routes>
  );
}
