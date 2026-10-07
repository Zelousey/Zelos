/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app is served from https://agentictrading.info/app/ (GitHub Pages, see
// .github/workflows/pages.yml) and later from inside the Capacitor shell. `base`
// makes every asset URL start with /app/ so it never collides with the classic site.
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false, // no source maps in production (security checklist)
    target: 'es2022',
    // Long-lived vendor chunks: app updates don't make phones re-download React or Firebase.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: 'firebase-auth', test: /node_modules[\\/]@firebase[\\/](auth|app|util|component|logger)[\\/]|node_modules[\\/]firebase[\\/](app|auth)[\\/]/ },
            { name: 'firebase-firestore', test: /node_modules[\\/]@firebase[\\/](firestore|webchannel-wrapper)[\\/]|node_modules[\\/]firebase[\\/]firestore[\\/]/ },
          ],
        },
      },
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
