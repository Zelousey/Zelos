/** /news → the News tab, /news/post → Post News (Zelos team only). */
import { lazy } from 'react';
import { Route, Routes } from 'react-router';
import NewsPage from './NewsPage';

const PostNewsPage = lazy(() => import('./PostNewsPage'));

export default function NewsModule() {
  return (
    <Routes>
      <Route index element={<NewsPage />} />
      <Route path="post" element={<PostNewsPage />} />
    </Routes>
  );
}
