// ═══════════════════════════════════════════════════════════════════════════════
// Spotify API Service
// ═══════════════════════════════════════════════════════════════════════════════
// Handles OAuth 2.0 with PKCE (no client secret), playlist/track read and write.
// Used for: source playlists → fetch tracks → search on destination → create
// playlists and add tracks. All operations use Bearer token from exchangeSpotifyCode.
// ═══════════════════════════════════════════════════════════════════════════════

import { PLATFORMS } from './platforms';

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
 * Clear all Spotify auth data from sessionStorage so the next connect is a fresh flow.
 * Call this before "Reconnect" so Spotify is forced to show the consent screen again.
 */
export function clearSpotifyAuthState() {
  try {
    sessionStorage.removeItem(SPOTIFY_VERIFIER_KEY);
    const raw = sessionStorage.getItem('streamswap_tokens');
    if (raw) {
      const data = JSON.parse(raw);
      delete data.spotify;
      sessionStorage.setItem('streamswap_tokens', JSON.stringify(data));
    }
  } catch (_) {}
}

/**
 * Start Spotify OAuth: generate PKCE challenge, store verifier, redirect to Spotify.
 * Always clears any old verifier first, uses show_dialog so user sees consent again.
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
    show_dialog: 'true',
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
  const response = await fetch(url, {
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

  return response.json();
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
      ...data.items.map((pl) => ({
        id: pl.id,
        name: pl.name,
        trackCount: pl.tracks.total,
        image: pl.images?.[0]?.url || null,
        owner: pl.owner.display_name,
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
    trackCount: data.tracks?.total ?? 0,
    platform: 'spotify',
  };
}

/**
 * All tracks in a playlist. Paginates (100 per page). Skips local files.
 * Returns normalized tracks: { id, title, artist, album, duration (seconds), isrc, uri, platform }.
 */
export async function getSpotifyPlaylistTracks(accessToken, playlistId) {
  const tracks = [];
  let url = `/playlists/${playlistId}/tracks?limit=100&fields=items(track(id,name,artists,album,duration_ms,external_ids,uri)),next`;

  while (url) {
    const data = await spotifyFetch(url, accessToken);
    tracks.push(
      ...data.items
        .filter((item) => item.track && !item.track.is_local)
        .map((item) => ({
          id: item.track.id,
          title: item.track.name,
          artist: item.track.artists.map((a) => a.name).join(', '),
          album: item.track.album?.name || '',
          duration: Math.round(item.track.duration_ms / 1000),
          isrc: item.track.external_ids?.isrc || null,
          uri: item.track.uri,
          platform: 'spotify',
        }))
    );
    url = data.next ? data.next.replace(config.apiBase, '') : null;
  }

  return tracks;
}

/** Create a new playlist. Returns playlist id. */
export async function createSpotifyPlaylist(accessToken, userId, name, description = '') {
  const data = await spotifyFetch(`/users/${userId}/playlists`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      name,
      description: description || `Transferred via StreamSwap`,
      public: false,
    }),
  });

  return data.id;
}

/** Add tracks to a playlist by URI. Chunks of 100 (Spotify limit per request). */
export async function addTracksToSpotifyPlaylist(accessToken, playlistId, trackUris) {
  for (let i = 0; i < trackUris.length; i += 100) {
    const chunk = trackUris.slice(i, i + 100);
    await spotifyFetch(`/playlists/${playlistId}/tracks`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ uris: chunk }),
    });
  }
}

/**
 * Find a track on Spotify by ISRC (best) or by title + artist search.
 * Returns { id, title, artist, uri, confidence, method: 'ISRC'|'search' } or null.
 */
export async function searchSpotifyTrack(accessToken, title, artist, isrc = null) {
  if (isrc) {
    try {
      const data = await spotifyFetch(
        `/search?q=isrc:${encodeURIComponent(isrc)}&type=track&limit=1`,
        accessToken
      );
      if (data.tracks.items.length > 0) {
        const t = data.tracks.items[0];
        return {
          id: t.id,
          title: t.name,
          artist: t.artists.map((a) => a.name).join(', '),
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

  if (data.tracks.items.length === 0) return null;

  const t = data.tracks.items[0];
  return {
    id: t.id,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(', '),
    uri: t.uri,
    confidence: 0.85,
    method: 'search',
  };
}
