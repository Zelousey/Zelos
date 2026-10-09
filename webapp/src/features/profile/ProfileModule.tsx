/** /profile → your profile; /profile/:uid → anyone's (the website's practice/profile.html?u=). */
import { Route, Routes, useParams } from 'react-router';
import NotFoundPage from '../notfound/NotFoundPage';
import ProfilePage from './ProfilePage';
import { UID_RE } from './profile';

function ByUid() {
  const { uid = '' } = useParams();
  return UID_RE.test(uid) ? <ProfilePage uid={uid} /> : <NotFoundPage />;
}

export default function ProfileModule() {
  return (
    <Routes>
      <Route index element={<ProfilePage uid={null} />} />
      <Route path=":uid" element={<ByUid />} />
    </Routes>
  );
}
