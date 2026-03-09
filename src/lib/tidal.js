// ═══════════════════════════════════════════════════════════════════════════════
// Tidal API Service (OpenAPI v2)
// ═══════════════════════════════════════════════════════════════════════════════
// OAuth 2.1 with PKCE (no client secret). Playlist read/write via openapi.tidal.com/v2.
// Register at https://developer.tidal.com/dashboard, set redirect URI.
// ═══════════════════════════════════════════════════════════════════════════════

import { PLATFORMS } from './platforms';

const config = PLATFORMS.tidal;

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, v) => acc + chars[v % chars.length], '');
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const TIDAL_ACCEPT = 'application/vnd.tidal.v1+json';

/**
 * Start Tidal OAuth (PKCE). Redirects to Tidal; user returns to /callback/tidal?code=...
 */
export async function initiateTidalAuth() {
  if (!config.clientId) {
    throw new Error('Tidal Client ID not configured. Add TIDAL_CLIENT_ID to your .env and register at https://developer.tidal.com/dashboard');
  }

  const codeVerifier = generateRandomString(64);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64urlencode(hashed);
  sessionStorage.setItem('tidal_code_verifier', codeVerifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: (config.scopes || ['r_usr', 'w_usr']).join(' '),
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    state: generateRandomString(16),
  });

  window.location.href = `${config.authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens.
 * @returns { accessToken, refreshToken, expiresAt }
 */
export async function exchangeTidalCode(code) {
  const codeVerifier = sessionStorage.getItem('tidal_code_verifier');
  if (!codeVerifier) throw new Error('Missing code verifier');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code: (code || '').trim(),
    redirect_uri: (config.redirectUri || '').trim(),
    code_verifier: codeVerifier,
  });

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    let msg = 'Tidal token exchange failed';
    try {
      const err = JSON.parse(text);
      if (err.error_description || err.error) msg += ': ' + [err.error, err.error_description].filter(Boolean).join(' — ');
    } catch {
      if (text) msg += ': ' + text.slice(0, 150);
    }
    throw new Error(msg);
  }

  const data = await response.json();
  sessionStorage.removeItem('tidal_code_verifier');

  const expiresIn = data.expires_in ?? 86400;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

/**
 * Refresh an expired access token using the refresh token.
 * @returns { accessToken, refreshToken, expiresAt } or null on failure.
 */
export async function refreshTidalToken(refreshToken) {
  if (!refreshToken) return null;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) return null;
  const data = await response.json();
  const expiresIn = data.expires_in ?? 86400;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

/**
 * Return valid token data, refreshing if expired (with 60s buffer).
 * Pass the object from getToken(platform). Returns same shape or null.
 */
export async function getValidTidalToken(tokenData) {
  if (!tokenData?.accessToken) return null;
  const now = Date.now();
  const bufferMs = 60 * 1000;
  if (tokenData.expiresAt && tokenData.expiresAt > now + bufferMs) return tokenData;
  if (!tokenData.refreshToken) {
    if (tokenData.expiresAt && tokenData.expiresAt <= now + bufferMs) return null;
    return tokenData;
  }
  const refreshed = await refreshTidalToken(tokenData.refreshToken);
  return refreshed || null;
}

/** Throw this (optionally with "|detail") so the app can show a reconnect tip. */
export const TIDAL_NEED_PERMISSION = 'TIDAL_NEED_PERMISSION';

/**
 * Clear Tidal auth state so the user can reconnect with a fresh consent.
 * Removes code verifier and stored Tidal token.
 */
export function clearTidalAuthState() {
  sessionStorage.removeItem('tidal_code_verifier');
  try {
    const raw = sessionStorage.getItem('streamswap_tokens');
    if (raw) {
      const data = JSON.parse(raw);
      delete data.tidal;
      sessionStorage.setItem('streamswap_tokens', JSON.stringify(data));
    }
  } catch (_) {}
}

async function tidalFetch(path, accessToken, options = {}) {
  const url = config.apiBase + path;
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: TIDAL_ACCEPT,
      'Content-Type': TIDAL_ACCEPT,
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });
  if (res.status === 401) throw new Error(TIDAL_NEED_PERMISSION);
  if (res.status === 403) {
    const text = await res.text().catch(() => '');
    throw new Error(TIDAL_NEED_PERMISSION + (text ? '|' + text.slice(0, 200) : ''));
  }
  if (!res.ok) throw new Error(await res.text().catch(() => `Tidal API ${res.status}`));
  return res.json();
}

/**
 * Get current user (for creating playlists). Tidal returns userId from /users/me.
 */
export async function getTidalUser(accessToken) {
  const data = await tidalFetch('/users/me', accessToken);
  return { id: data.userId ?? data.id ?? data.uuid, ...data };
}

/**
 * Get current user's playlists. Tries GET /playlists first (v2), then /users/{id}/playlists.
 * @returns Array of { id, name, trackCount, image, ... }
 */
export async function getTidalPlaylists(accessToken) {
  let items = [];
  try {
    const data = await tidalFetch('/playlists', accessToken);
    items = data.items ?? data.playlists ?? data.data ?? data ?? [];
  } catch (e1) {
    const user = await getTidalUser(accessToken).catch(() => null);
    if (user?.id) {
      const data = await tidalFetch(`/users/${user.id}/playlists`, accessToken);
      items = data.items ?? data.playlists ?? data ?? [];
    }
  }
  return (Array.isArray(items) ? items : []).map((p) => ({
    id: p.uuid ?? p.id,
    name: p.title ?? p.name,
    trackCount: p.numberOfTracks ?? p.totalItems ?? p.trackCount ?? 0,
    image: p.image ?? p.cover?.[0]?.url,
    owner: p.creator ?? null,
  }));
}

/**
 * Get tracks in a playlist. Tidal v2: GET /playlists/{id}/relationships/items
 */
export async function getTidalPlaylistTracks(accessToken, playlistId) {
  const data = await tidalFetch(`/playlists/${playlistId}/relationships/items`, accessToken);
  const items = data.data ?? data.items ?? data.tracks ?? data ?? [];
  return (Array.isArray(items) ? items : []).map((t) => {
    const item = t.attributes ?? t.item ?? t.track ?? t;
    const artist = item.artist ?? item.artists?.[0];
    return {
      id: t.id ?? item.id ?? item.trackId ?? item.uuid,
      videoId: t.id ?? item.id ?? item.trackId,
      title: item.title ?? item.name,
      artist: typeof artist === 'string' ? artist : (artist?.name ?? artist?.id ?? 'Unknown'),
      album: item.album?.title ?? item.album?.name ?? '',
      duration: item.duration ?? item.playbackSeconds ?? 0,
      isrc: item.isrc ?? null,
    };
  });
}

/**
 * Create a playlist for the current user.
 * @returns Playlist id (uuid)
 */
export async function createTidalPlaylist(accessToken, name, description = '') {
  const user = await getTidalUser(accessToken);
  const userId = user.id || user.userId;
  const body = { title: name, description: description || undefined };
  const data = await tidalFetch(`/users/${userId}/playlists`, accessToken, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.uuid ?? data.id;
}

/**
 * Add tracks to a playlist. Tidal v2: POST /playlists/{id}/relationships/items (JSON:API style).
 */
export async function addTracksToTidalPlaylist(accessToken, playlistId, trackIds) {
  if (!trackIds.length) return;
  const body = {
    data: trackIds.map((id) => ({ type: 'tracks', id: String(id) })),
  };
  await tidalFetch(`/playlists/${playlistId}/relationships/items`, accessToken, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Search Tidal catalog for a track. Returns first match or null.
 * @returns { id, title, artist, videoId (same as id), confidence, method } or null
 */
export async function searchTidalTrack(accessToken, title, artist, isrc = null) {
  const q = [title, artist].filter(Boolean).join(' ');
  if (!q.trim()) return null;
  const params = new URLSearchParams({ query: q, limit: '5' });
  const data = await tidalFetch(`/search/tracks?${params}`, accessToken);
  const tracks = data.tracks?.items ?? data.items ?? data ?? [];
  if (!Array.isArray(tracks) || tracks.length === 0) return null;

  if (isrc) {
    const byIsrc = tracks.find((t) => (t.isrc || t.item?.isrc) === isrc);
    if (byIsrc) {
      const t = byIsrc.item ?? byIsrc;
      return { id: t.id, videoId: t.id, title: t.title, artist: t.artist?.name ?? t.artist ?? '', confidence: 1, method: 'ISRC' };
    }
  }

  const t = tracks[0].item ?? tracks[0];
  return {
    id: t.id,
    videoId: t.id,
    title: t.title ?? t.name,
    artist: typeof t.artist === 'string' ? t.artist : (t.artist?.name ?? ''),
    confidence: 0.85,
    method: 'search',
  };
}
