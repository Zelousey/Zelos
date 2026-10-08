/**
 * App entry. Order matters: theme first (no flash), then the 404 redirect fix-up, then render,
 * then the launch animation (index.html) fades out.
 */
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles/tokens.css';
import './styles/base.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { createAppRouter, restoreRedirect } from './app/router';
import { AuthProvider } from './lib/auth';
import { hideSplash } from './lib/splash';
import { applyTheme, getTheme } from './lib/theme';
import { ToastProvider } from './ui';

applyTheme(getTheme());
restoreRedirect();

const router = createAppRouter();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
);
hideSplash();
