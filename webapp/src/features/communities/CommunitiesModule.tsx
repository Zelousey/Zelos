/** /communities → the Founder Program hub; /communities/:cid → one community. */
import { Route, Routes } from 'react-router';
import CommunitiesPage from './CommunitiesPage';
import CommunityPage from './CommunityPage';

export default function CommunitiesModule() {
  return (
    <Routes>
      <Route index element={<CommunitiesPage />} />
      <Route path=":cid" element={<CommunityPage />} />
    </Routes>
  );
}
