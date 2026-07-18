import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The web app talks to the MotionForge server through /api (and downloads
// rendered MP4s from /renders). In dev both are proxied to the Express server.
// The server's port comes from the repo-root .env (see server/src/config), so
// read that same file here rather than hardcoding a port that can drift.
export default defineConfig(({ mode }) => {
  const repoRoot = path.resolve(__dirname, '..');
  const env = loadEnv(mode, repoRoot, 'PORT');
  const serverUrl = `http://localhost:${env.PORT ?? 5174}`;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': serverUrl,
        '/renders': serverUrl,
      },
    },
  };
});
