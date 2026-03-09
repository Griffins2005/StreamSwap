// ═══════════════════════════════════════════════════════════════════════════════
// Platform Configuration
// ═══════════════════════════════════════════════════════════════════════════════
// Central config for each service: names, colors, OAuth URLs, API base, env vars.
// Used by spotify.js, youtube.js, apple-music.js and by App.jsx for UI (icons, labels).
// ═══════════════════════════════════════════════════════════════════════════════

export const PLATFORMS = {
  spotify: {
    name: 'Spotify',
    color: '#1DB954',
    authUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    apiBase: 'https://api.spotify.com/v1',
    scopes: [
      'playlist-read-private',
      'playlist-read-collaborative',
      'playlist-modify-public',
      'playlist-modify-private',
      'user-library-read',
    ],
    clientId: import.meta.env.SPOTIFY_CLIENT_ID || '',
    redirectUri: import.meta.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:3000/callback/spotify',
  },
  apple: {
    name: 'Apple Music',
    color: '#FC3C44',
    apiBase: 'https://api.music.apple.com/v1',
    developerToken: import.meta.env.APPLE_MUSIC_DEVELOPER_TOKEN || '',
  },
  youtube: {
    name: 'YouTube Music',
    color: '#FF0000',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    apiBase: 'https://www.googleapis.com/youtube/v3',
    scopes: ['https://www.googleapis.com/auth/youtube'],
    clientId: import.meta.env.GOOGLE_CLIENT_ID || '',
    clientSecret: (import.meta.env.GOOGLE_CLIENT_SECRET || '').trim(),
    redirectUri: import.meta.env.GOOGLE_REDIRECT_URI || 'http://127.0.0.1:3000/callback/youtube',
  },
  tidal: {
    name: 'Tidal',
    color: '#00FFFF',
    authUrl: 'https://login.tidal.com/authorize',
    tokenUrl: 'https://auth.tidal.com/v1/oauth2/token',
    apiBase: 'https://openapi.tidal.com/v2',
    scopes: ['r_usr', 'w_usr'],
    clientId: import.meta.env.TIDAL_CLIENT_ID || '',
    redirectUri: import.meta.env.TIDAL_REDIRECT_URI || 'http://127.0.0.1:3000/callback/tidal',
  },
  deezer: {
    name: 'Deezer',
    color: '#A238FF',
    authUrl: 'https://connect.deezer.com/oauth/auth.php',
    tokenUrl: 'https://connect.deezer.com/oauth/access_token.php',
    apiBase: 'https://api.deezer.com',
    scopes: ['basic_access', 'email', 'manage_library', 'offline_access'],
    clientId: import.meta.env.DEEZER_APP_ID || '',
    clientSecret: (import.meta.env.DEEZER_APP_SECRET || '').trim(),
    redirectUri: import.meta.env.DEEZER_REDIRECT_URI || 'http://127.0.0.1:3000/callback/deezer',
  },
};

export const PLATFORM_ICONS = {
  spotify: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`,
  apple: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.997 6.124a9.23 9.23 0 00-.24-2.19C23.44 2.624 22.695 1.624 21.577.891A5.022 5.022 0 0019.702.175 10.65 10.65 0 0017.867.072C17.101.028 16.335.009 15.57 0H8.43c-.766.009-1.53.028-2.296.072A10.65 10.65 0 004.3.175 5.022 5.022 0 002.425.891C1.307 1.624.562 2.624.245 3.934a9.23 9.23 0 00-.24 2.19C-.008 6.89-.026 7.656 0 8.423v7.154c-.026.766-.008 1.533.005 2.299.026.753.102 1.49.24 2.19.317 1.31 1.062 2.31 2.18 3.043a5.022 5.022 0 001.875.716c.617.084 1.236.118 1.835.103.766.044 1.53.063 2.296.072h7.14c.766-.009 1.53-.028 2.296-.072a10.65 10.65 0 001.836-.103 5.022 5.022 0 001.874-.716c1.118-.733 1.863-1.733 2.18-3.043.139-.7.214-1.437.241-2.19.013-.766.031-1.533.005-2.299V8.423c.026-.767.008-1.534-.005-2.3zM17.994 12l-6 3.464a.75.75 0 01-1.125-.65v-6.928a.75.75 0 011.125-.65l6 3.464a.75.75 0 010 1.3z"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm-1.2-4.08l4.838-3.024L10.8 8.976v6.048z"/></svg>`,
  tidal: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L8 4l4 4-4 4-4-4 4-4L4 0 0 4l4 4-4 4 4 4 4-4 4 4 4-4-4-4 4-4 4 4 4-4-4-4 4-4-4-4-4 4z"/></svg>`,
  deezer: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="0" y="18" width="4" height="3" rx="0.5"/><rect x="5" y="15" width="4" height="6" rx="0.5"/><rect x="10" y="12" width="4" height="9" rx="0.5"/><rect x="15" y="9" width="4" height="12" rx="0.5"/><rect x="20" y="6" width="4" height="15" rx="0.5"/></svg>`,
};
