/** /invite → make an invite; /i/:code → an invite link someone shared with you. */
import { Route, Routes } from 'react-router';
import InviteLanding from './InviteLanding';
import InvitePage from './InvitePage';

export function InviteMakeModule() {
  return (
    <Routes>
      <Route index element={<InvitePage />} />
    </Routes>
  );
}

export default function InviteLinkModule() {
  return (
    <Routes>
      <Route path=":code" element={<InviteLanding />} />
      <Route index element={<InviteLanding />} />
    </Routes>
  );
}
