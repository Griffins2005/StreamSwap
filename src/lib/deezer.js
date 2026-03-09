// ═══════════════════════════════════════════════════════════════════════════════
// Deezer API Service
// ═══════════════════════════════════════════════════════════════════════════════
// OAuth via connect.deezer.com; API at api.deezer.com. Requires DEEZER_APP_ID and
// DEEZER_APP_SECRET. Register at https://developers.deezer.com/
// ═══════════════════════════════════════════════════════════════════════════════

import { PLATFORMS } from './platforms';

const config = PLATFORMS.deezer;

/**
 * Start Deezer OAuth. Redirects to connect.deezer.com; user returns to /callback/deezer?code=...
 */
export async function initiateDeezerAuth() {
  if (!config.clientId) {
    throw new Error('Deezer App ID not configured. Add DEEZER_APP_ID to your .env file.');
  }
  const perms = (config.scopes || ['basic_access', 'manage_library', 'offline_access']).join(',');
  const params = new URLSearchParams({
    app_id: config.clientId,
    redirect_uri: config.redirectUri,
    perms,
  });
  window.location.href = `${config.authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token.
 * Deezer returns access_token (and optionally expires) as query string or JSON.
 * @returns { accessToken, refreshToken, expiresAt }
 */
export async function exchangeDeezerCode(code) {
  const appId = (config.clientId || '').trim();
  const secret = config.clientSecret || '';
  const redirectUri = (config.redirectUri || '').trim();
  if (!appId) throw new Error('Deezer App ID not configured.');
  const url = new URL(config.tokenUrl);
  url.searchParams.set('app_id', appId);
  url.searchParams.set('code', (code || '').trim());
  url.searchParams.set('redirect_uri', redirectUri);
  if (secret) url.searchParams.set('secret', secret);

  const response = await fetch(url.toString(), { method: 'GET' });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Deezer token exchange failed');
  }
  const text = await response.text();
  let accessToken = null;
  let expires = 0;
  try {
    if (text.startsWith('{')) {
      const data = JSON.parse(text);
      accessToken = data.access_token || data.accessToken;
      expires = data.expires ?? 0;
    } else {
      const params = new URLSearchParams(text.replace(/#/g, '&'));
      accessToken = params.get('access_token');
      const exp = params.get('expires');
      if (exp != null) expires = parseInt(exp, 10) || 0;
    }
  } catch {
    const match = /access_token=([^&]+)/.exec(text);
    if (match) accessToken = match[1];
    const expMatch = /expires=(\d+)/.exec(text);
    if (expMatch) expires = parseInt(expMatch[1], 10) || 0;
  }
  if (!accessToken) throw new Error('No access token in Deezer response');
  const expiresAt = expires > 0 ? Date.now() + expires * 1000 : Date.now() + 10 * 365 * 24 * 60 * 60 * 1000;
  return {
    accessToken,
    refreshToken: null,
    expiresAt,
  };
}

/**
 * Return valid token data if the token is still usable. Deezer tokens are long-lived
 * (often no expiry); if expiresAt is missing we treat as valid.
 * @returns Token object or null if expired/invalid.
 */
export async function getValidDeezerToken(tokenData) {
  if (!tokenData?.accessToken) return null;
  const expiresAt = tokenData.expiresAt;
  if (expiresAt != null && typeof expiresAt === 'number' && expiresAt < Date.now()) return null;
  return tokenData;
}

function deezerUrl(path, accessToken, extra = {}) {
  const url = new URL(config.apiBase + path);
  url.searchParams.set('access_token', accessToken);
  Object.entries(extra).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, v); });
  return url.toString();
}

async function deezerFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...options.headers },
  });
  if (res.status === 401) throw new Error('TOKEN_EXPIRED');
  if (!res.ok) throw new Error(await res.text().catch(() => `Deezer API ${res.status}`));
  return res.json();
}

/**
 * Current user (for creating playlists).
 */
export async function getDeezerUser(accessToken) {
  const data = await deezerFetch(deezerUrl('/user/me', accessToken));
  return { id: data.id, name: data.name };
}

/**
 * User's playlists. Returns { id, name, trackCount, image, platform }[].
 */
export async function getDeezerPlaylists(accessToken) {
  const out = [];
  let index = 0;
  const limit = 25;
  let data;
  do {
    data = await deezerFetch(deezerUrl('/user/me/playlists', accessToken, { index, limit }));
    const list = data.data || data || [];
    for (const p of list) {
      out.push({
        id: String(p.id),
        name: p.title || p.name || 'Untitled',
        trackCount: p.nb_tracks ?? p.trackCount ?? 0,
        image: p.picture_small || p.picture || null,
        platform: 'deezer',
      });
    }
    index += limit;
  } while (data.data && data.data.length === limit);
  return out;
}

/**
 * Fetch a public Deezer playlist by ID (no auth). Returns { id, name, trackCount, tracks }.
 * Use for "import public playlist" when user pastes a Deezer playlist link.
 */
export async function getDeezerPublicPlaylist(playlistId) {
  const id = String(playlistId).trim();
  if (!id) throw new Error('Invalid playlist ID');
  const out = { id, name: '', trackCount: 0, tracks: [], platform: 'deezer' };
  let url = `${config.apiBase}/playlist/${id}`;
  let first = true;
  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text().catch(() => 'Deezer playlist not found or not public'));
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'Deezer API error');
    if (first) {
      out.name = data.title || data.name || 'Untitled';
      out.trackCount = data.nb_tracks ?? data.tracks?.data?.length ?? 0;
      first = false;
    }
    const list = data.tracks?.data || data.data || [];
    for (const t of list) {
      const artist = t.artist?.name || (Array.isArray(t.artists) ? t.artists.map((a) => a.name).join(', ') : '');
      out.tracks.push({
        id: String(t.id),
        title: t.title || '',
        artist: artist || '',
        album: t.album?.title || '',
        duration: t.duration ?? 0,
        isrc: null,
        platform: 'deezer',
      });
    }
    url = data.tracks?.next || data.next || null;
  }
  return out;
}

/**
 * Tracks in a playlist. Returns normalized { id, title, artist, album, ... }[].
 */
export async function getDeezerPlaylistTracks(accessToken, playlistId) {
  const out = [];
  let index = 0;
  const limit = 100;
  let data;
  do {
    data = await deezerFetch(deezerUrl(`/playlist/${playlistId}/tracks`, accessToken, { index, limit }));
    const list = data.data || data || [];
    for (const t of list) {
      const artist = t.artist?.name || (Array.isArray(t.artists) ? t.artists.map((a) => a.name).join(', ') : '');
      out.push({
        id: String(t.id),
        title: t.title || '',
        artist: artist || '',
        album: t.album?.title || '',
        duration: t.duration ?? 0,
        isrc: null,
        platform: 'deezer',
      });
    }
    index += limit;
  } while (data.data && data.data.length === limit);
  return out;
}

/**
 * Create a playlist. Returns playlist id.
 */
export async function createDeezerPlaylist(accessToken, name, description = '') {
  const url = deezerUrl('/user/me/playlists', accessToken);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ title: name, description: description || 'Transferred via StreamSwap' }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || 'Failed to create Deezer playlist');
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid response from Deezer when creating playlist');
  }
  if (data.error) throw new Error(data.error.message || 'Deezer API error');
  return String(data.id);
}

/**
 * Add tracks to a playlist. songs = comma-separated track ids.
 */
export async function addTracksToDeezerPlaylist(accessToken, playlistId, trackIds) {
  if (trackIds.length === 0) return;
  const batch = trackIds.slice(0, 100);
  const songs = batch.join(',');
  const url = deezerUrl(`/playlist/${playlistId}/tracks`, accessToken);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ songs }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || 'Failed to add tracks to Deezer playlist');
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    if (res.ok) return; else throw new Error(text || 'Deezer API error');
  }
  if (data && data.error) throw new Error(data.error.message || 'Deezer API error');
  if (trackIds.length > 100) {
    await addTracksToDeezerPlaylist(accessToken, playlistId, trackIds.slice(100));
  }
}

/**
 * Search for a track by title + artist. Returns { id, title, artist, confidence, method } or null.
 */
export async function searchDeezerTrack(accessToken, title, artist) {
  const q = [title, artist].filter(Boolean).join(' ');
  if (!q.trim()) return null;
  const data = await deezerFetch(deezerUrl('/search', accessToken, { q, limit: 5 }));
  const list = data.data || data || [];
  if (list.length === 0) return null;
  const first = list[0];
  const artistName = first.artist?.name || '';
  return {
    id: String(first.id),
    title: first.title || '',
    artist: artistName,
    confidence: 0.85,
    method: 'search',
  };
}
