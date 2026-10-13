// ═══════════════════════════════════════════════════════════════════════════════
// Spotify API Service
// ═══════════════════════════════════════════════════════════════════════════════
// Handles OAuth 2.0 with PKCE (no client secret), playlist/track read and write.
// Used for: source playlists → fetch tracks → search on destination → create
// playlists and add tracks. All operations use Bearer token from exchangeSpotifyCode.
// ═══════════════════════════════════════════════════════════════════════════════

import { PLATFORMS } from './platforms';
import { forgetPlatform } from './tokenStore';
import { fetchWithRetry } from './rateLimit';
import { pickBestCandidate } from './matching';

const config = PLATFORMS.spotify;

// ─── PKCE helpers (RFC 7636) ─────────────────────────────────────────────────
// Used to secure the authorization code flow without a client secret in the browser.

/** Generate a cryptographically random string for code_verifier (43–128 chars). */
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, v) => acc + chars[v % chars.length], '');
}

/** SHA-256 hash of plaintext (for code_challenge). */
async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

/** Base64url-encode buffer (no +, /, or padding =). */
function base64urlencode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ─── Auth flow ────────────────────────────────────────────────────────────────

const SPOTIFY_VERIFIER_KEY = 'spotify_code_verifier';

/**
 * Clear Spotify auth data so the next connect is a fresh flow.
 * Call this before "Reconnect" when Spotify itself rejected the saved sign-in.
 */
export function clearSpotifyAuthState() {
  try {
    sessionStorage.removeItem(SPOTIFY_VERIFIER_KEY);
    forgetPlatform('spotify');
  } catch (_) {}
}

/**
 * Start Spotify OAuth: generate PKCE challenge, store verifier, redirect to Spotify.
 * Returning visitors are not sent here again. Spotify is not asked to show the approval screen every time.
 * User signs in and is redirected to /callback/spotify?code=...
 */
export async function initiateSpotifyAuth() {
  if (!config.clientId) {
    throw new Error('Spotify Client ID not configured. Add SPOTIFY_CLIENT_ID to your .env file.');
  }

  sessionStorage.removeItem(SPOTIFY_VERIFIER_KEY);

  const codeVerifier = generateRandomString(64);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64urlencode(hashed);

  sessionStorage.setItem(SPOTIFY_VERIFIER_KEY, codeVerifier);

  const state = generateRandomString(32);
  sessionStorage.setItem('spotify_oauth_state', state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    scope: config.scopes.join(' '),
    redirect_uri: config.redirectUri,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    state,
  });

  window.location.href = `${config.authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access + refresh token (callback page).
 * Requires code_verifier in sessionStorage from initiateSpotifyAuth.
 * @returns { accessToken, refreshToken, expiresAt }
 */
export async function exchangeSpotifyCode(code) {
  const codeVerifier = sessionStorage.getItem(SPOTIFY_VERIFIER_KEY);
  if (!codeVerifier) throw new Error('Missing code verifier');
  sessionStorage.removeItem(SPOTIFY_VERIFIER_KEY);
  sessionStorage.removeItem('spotify_oauth_state');

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error_description || 'Token exchange failed');
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Refresh an expired access token using refresh_token.
 * Use when API returns 401; then retry the request with the new accessToken.
 */
export async function refreshSpotifyToken(refreshToken) {
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
    }),
  });

  if (!response.ok) throw new Error('Token refresh failed');

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Return valid token data, refreshing if expired (with 60s buffer).
 * Pass the object from getToken(platform). Returns same shape or null.
 * Returns null if token is expired and refresh fails (caller should not use expired token).
 */
export async function getValidSpotifyToken(tokenData) {
  if (!tokenData?.accessToken) return null;
  const now = Date.now();
  const bufferMs = 60 * 1000;
  if (tokenData.expiresAt && tokenData.expiresAt > now + bufferMs) return tokenData;
  if (!tokenData.refreshToken) {
    if (tokenData.expiresAt && tokenData.expiresAt <= now + bufferMs) return null;
    return tokenData;
  }
  try {
    const refreshed = await refreshSpotifyToken(tokenData.refreshToken);
    return refreshed || null;
  } catch {
    return null;
  }
}

// ─── API helpers ──────────────────────────────────────────────────────────────

/** Authenticated GET/POST to Spotify Web API. Throws TOKEN_EXPIRED on 401. */
async function spotifyFetch(endpoint, accessToken, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${config.apiBase}${endpoint}`;
  const response = await fetchWithRetry(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (response.status === 401) {
    throw new Error('TOKEN_EXPIRED');
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err.error?.message || err.message || `Spotify API error: ${response.status}`;
    if (response.status === 403) {
      const detail = msg ? `|${msg}` : '';
      throw new Error('SPOTIFY_NEED_PERMISSION' + detail);
    }
    throw new Error(msg);
  }

  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/** Try the current Spotify path, then the older one if Spotify says that path is gone. */
async function spotifyFetchFallback(paths, accessToken, options) {
  let lastError;
  for (let i = 0; i < paths.length; i++) {
    try {
      return await spotifyFetch(paths[i], accessToken, options);
    } catch (err) {
      lastError = err;
      const msg = String(err?.message || '');
      const missingPath = /\b404\b|not found/i.test(msg);
      if (!missingPath || i === paths.length - 1) throw err;
    }
  }
  throw lastError;
}

function trackFromPlaylistEntry(entry) {
  const track = entry?.item || entry?.track;
  if (!track || track.is_local || track.type === 'episode') return null;
  return {
    id: track.id,
    title: track.name,
    artist: (track.artists || []).map((a) => a.name).join(', '),
    album: track.album?.name || '',
    duration: Math.round((track.duration_ms || 0) / 1000),
    isrc: track.external_ids?.isrc || null,
    uri: track.uri,
    platform: 'spotify',
  };
}

// ─── Playlist operations ─────────────────────────────────────────────────────

/** Current user profile (for creating playlists under their account). */
export async function getSpotifyUserProfile(accessToken) {
  return spotifyFetch('/me', accessToken);
}

/**
 * All playlists for the current user. Paginates automatically (50 per page).
 * Returns normalized list: { id, name, trackCount, image, owner, platform: 'spotify', ... }
 */
export async function getSpotifyPlaylists(accessToken) {
  const playlists = [];
  let url = '/me/playlists?limit=50';

  while (url) {
    const data = await spotifyFetch(url, accessToken);
    playlists.push(
      ...(data.items || []).map((pl) => ({
        id: pl.id,
        name: pl.name,
        trackCount: pl.items?.total ?? pl.tracks?.total ?? 0,
        image: pl.images?.[0]?.url || null,
        owner: pl.owner?.display_name || '',
        public: pl.public,
        description: pl.description || '',
        uri: pl.uri,
        platform: 'spotify',
      }))
    );
    url = data.next ? data.next.replace(config.apiBase, '') : null;
  }

  return playlists;
}

/**
 * Get a single playlist by ID (e.g. public playlist). Returns { id, name, trackCount }.
 * Use with getSpotifyPlaylistTracks to get tracks. Requires user or app token.
 */
export async function getSpotifyPlaylistById(accessToken, playlistId) {
  const data = await spotifyFetch(`/playlists/${playlistId}`, accessToken);
  return {
    id: data.id,
    name: data.name,
    trackCount: data.items?.total ?? data.tracks?.total ?? 0,
    ownerId: data.owner?.id || null,
    platform: 'spotify',
  };
}

/**
 * Add a playlist to the signed-in user's library without copying its songs.
 * Spotify allows this for some playlists it will not let an app read.
 * Returns true when the playlist is now followed.
 */
export async function followSpotifyPlaylist(accessToken, playlistId) {
  const uri = `spotify:playlist:${playlistId}`;
  try {
    await spotifyFetch('/me/library?uris=' + encodeURIComponent(uri), accessToken, { method: 'PUT' });
    return true;
  } catch (err) {
    const msg = String(err?.message || '');
    if (!/\b404\b|not found/i.test(msg)) throw err;
  }
  const response = await fetchWithRetry(`${config.apiBase}/playlists/${playlistId}/followers`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ public: false }),
  });
  if (response.status === 401) throw new Error('TOKEN_EXPIRED');
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Spotify API error: ${response.status}`);
  }
  return true;
}

/**
 * Create a private playlist on the signed-in account and add the given tracks.
 * Returns { id, saved }. saved is how many track URIs Spotify accepted.
 */
export async function copySpotifyPlaylistToLibrary(accessToken, { name, tracks }) {
  const me = await getSpotifyUserProfile(accessToken);
  const id = await createSpotifyPlaylist(accessToken, me.id, name, 'Saved from a link via StreamSwap');
  const uris = (tracks || []).map((track) => track.uri).filter(Boolean);
  if (uris.length) await addTracksToSpotifyPlaylist(accessToken, id, uris);
  return { id, saved: uris.length };
}

/**
 * All tracks in a playlist. Paginates (100 per page). Skips local files.
 * Returns normalized tracks: { id, title, artist, album, duration (seconds), isrc, uri, platform }.
 */
export async function getSpotifyPlaylistTracks(accessToken, playlistId) {
  const tracks = [];
  let url = `/playlists/${playlistId}/items?limit=50`;

  while (url) {
    let data;
    try {
      data = await spotifyFetch(url, accessToken);
    } catch (err) {
      const msg = String(err?.message || '');
      const canTryLegacy = url.includes('/items') && /\b404\b|not found/i.test(msg);
      if (!canTryLegacy) throw err;
      url = url.replace('/items?', '/tracks?');
      data = await spotifyFetch(url, accessToken);
    }
    for (const entry of data.items || []) {
      const track = trackFromPlaylistEntry(entry);
      if (track?.id) tracks.push(track);
    }
    url = data.next ? data.next.replace(config.apiBase, '') : null;
  }

  return tracks;
}

/** Create a new playlist. Returns playlist id. */
export async function createSpotifyPlaylist(accessToken, userId, name, description = '') {
  const body = JSON.stringify({
    name,
    description: description || `Transferred via StreamSwap`,
    public: false,
  });
  const data = await spotifyFetchFallback(
    ['/me/playlists', userId ? `/users/${userId}/playlists` : null].filter(Boolean),
    accessToken,
    { method: 'POST', body }
  );

  return data.id;
}

/** Add tracks to a playlist by URI. Chunks of 100 (Spotify limit per request). */
export async function addTracksToSpotifyPlaylist(accessToken, playlistId, trackUris) {
  for (let i = 0; i < trackUris.length; i += 100) {
    const chunk = trackUris.slice(i, i + 100);
    await spotifyFetchFallback(
      [`/playlists/${playlistId}/items`, `/playlists/${playlistId}/tracks`],
      accessToken,
      { method: 'POST', body: JSON.stringify({ uris: chunk }) }
    );
  }
}

/**
 * Find a track on Spotify by ISRC (best) or by title + artist search.
 * Returns { id, title, artist, uri, confidence, method: 'ISRC'|'search' } or null.
 */
export async function searchSpotifyTrack(accessToken, title, artist, isrc = null, duration = 0) {
  if (isrc) {
    try {
      const data = await spotifyFetch(
        `/search?q=isrc:${encodeURIComponent(isrc)}&type=track&limit=1`,
        accessToken
      );
      const found = data.tracks?.items || [];
      if (found.length > 0) {
        const t = found[0];
        return {
          id: t.id,
          title: t.name,
          artist: (t.artists || []).map((a) => a.name).join(', '),
          uri: t.uri,
          confidence: 1.0,
          method: 'ISRC',
        };
      }
    } catch (e) {
      // Fall through to text search
    }
  }

  const query = `track:${title} artist:${artist}`;
  const data = await spotifyFetch(
    `/search?q=${encodeURIComponent(query)}&type=track&limit=5`,
    accessToken
  );

  const found = data.tracks?.items || [];
  if (found.length === 0) return null;

  const candidates = found.map((t) => ({
    id: t.id,
    title: t.name,
    artist: (t.artists || []).map((a) => a.name).join(', '),
    album: t.album?.name || '',
    duration: Math.round((t.duration_ms || 0) / 1000),
    isrc: t.external_ids?.isrc || null,
    uri: t.uri,
  }));

  return pickBestCandidate({ title, artist, isrc, duration }, candidates);
}
