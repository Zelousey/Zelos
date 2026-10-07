/** /markets → list, /markets/:sym → that symbol's screen. */
import { Route, Routes } from 'react-router';
import MarketsPage from './MarketsPage';
import SymbolPage from './SymbolPage';

export default function MarketsModule() {
  return (
    <Routes>
      <Route index element={<MarketsPage />} />
      <Route path=":sym" element={<SymbolPage />} />
    </Routes>
  );
}
