// Builds the files the iPhone app (Capacitor) ships: `npm run build:native` → dist-native/.
// The web build keeps its /app/ base (same files as agentictrading.info/app/), so the app's
// files go in dist-native/app/, and dist-native/index.html is the same page with one line
// first that moves the app's start address (capacitor://localhost/) to /app/.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

rmSync('dist-native', { recursive: true, force: true });
mkdirSync('dist-native');
cpSync('dist', 'dist-native/app', { recursive: true });
const page = readFileSync('dist/index.html', 'utf8');
const start = "<script>if(!location.pathname.startsWith('/app/'))history.replaceState(null,'','/app/'+location.search+location.hash)</script>";
if (!page.includes('<head>')) throw new Error('dist/index.html has no <head>');
writeFileSync('dist-native/index.html', page.replace('<head>', `<head>\n    ${start}`));
console.log('dist-native ready');
