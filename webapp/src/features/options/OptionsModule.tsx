/** /options → the option chain (last stock you looked at); /options/:sym → that stock's chain. */
import { Route, Routes } from 'react-router';
import OptionsPage from './OptionsPage';

export default function OptionsModule() {
  return (
    <Routes>
      <Route index element={<OptionsPage />} />
      <Route path=":sym" element={<OptionsPage />} />
    </Routes>
  );
}
