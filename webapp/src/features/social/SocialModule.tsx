/** /social → your squads and friends; /social/:id → one squad (the website's squads.html?s=). */
import { Route, Routes } from 'react-router';
import SocialPage from './SocialPage';
import SquadPage from './SquadPage';

export default function SocialModule() {
  return (
    <Routes>
      <Route index element={<SocialPage />} />
      <Route path=":id" element={<SquadPage />} />
    </Routes>
  );
}
