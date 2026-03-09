import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const googleSecret = (env.GOOGLE_CLIENT_SECRET ?? '').trim();
  if (env.GOOGLE_CLIENT_ID && !googleSecret) {
    console.warn('\n[StreamSwap] GOOGLE_CLIENT_SECRET is missing. Add it to .env and restart the dev server.\n');
  }
  return {
    plugins: [react()],
    server: { port: 3000, strictPort: true, host: true },
    appType: 'spa',
    define: {
      'import.meta.env.SPOTIFY_CLIENT_ID': JSON.stringify(env.SPOTIFY_CLIENT_ID ?? ''),
      'import.meta.env.SPOTIFY_REDIRECT_URI': JSON.stringify(env.SPOTIFY_REDIRECT_URI ?? 'http://127.0.0.1:3000/callback/spotify'),
      'import.meta.env.APPLE_MUSIC_DEVELOPER_TOKEN': JSON.stringify(env.APPLE_MUSIC_DEVELOPER_TOKEN ?? ''),
      'import.meta.env.GOOGLE_CLIENT_ID': JSON.stringify(env.GOOGLE_CLIENT_ID ?? ''),
      'import.meta.env.GOOGLE_REDIRECT_URI': JSON.stringify(env.GOOGLE_REDIRECT_URI ?? 'http://127.0.0.1:3000/callback/youtube'),
      'import.meta.env.GOOGLE_CLIENT_SECRET': JSON.stringify(googleSecret),
      'import.meta.env.TIDAL_CLIENT_ID': JSON.stringify(env.TIDAL_CLIENT_ID ?? ''),
      'import.meta.env.TIDAL_REDIRECT_URI': JSON.stringify(env.TIDAL_REDIRECT_URI ?? 'http://127.0.0.1:3000/callback/tidal'),
      'import.meta.env.DEEZER_APP_ID': JSON.stringify(env.DEEZER_APP_ID ?? ''),
      'import.meta.env.DEEZER_APP_SECRET': JSON.stringify(env.DEEZER_APP_SECRET ?? ''),
      'import.meta.env.DEEZER_REDIRECT_URI': JSON.stringify(env.DEEZER_REDIRECT_URI ?? 'http://127.0.0.1:3000/callback/deezer'),
    },
  };
});
