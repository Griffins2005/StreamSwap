// ═══════════════════════════════════════════════════════════════════════════════
// YouTube Music API Service (YouTube Data API v3)
// ═══════════════════════════════════════════════════════════════════════════════
// OAuth 2.0 with PKCE (no client secret). Uses playlists and playlistItems for
// library playlists; search for matching tracks when transferring from another
// platform. Requires YouTube Data API v3 enabled in Google Cloud Console.
// ═══════════════════════════════════════════════════════════════════════════════

import { PLATFORMS } from './platforms';

const config = PLATFORMS.youtube;

// ─── PKCE helpers (same as Spotify) ──────────────────────────────────────────

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

// ─── Auth flow ────────────────────────────────────────────────────────────────

/**
 * Start Google OAuth. With client secret: standard auth code flow. Without: PKCE.
 * User signs in and is redirected to /callback/youtube?code=...
 */
export async function initiateYouTubeAuth() {
  if (!config.clientId) {
    throw new Error('Google Client ID not configured. Add GOOGLE_CLIENT_ID to your .env file.');
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });

  if (config.clientSecret) {
    // Confidential client: no PKCE
  } else {
    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64urlencode(hashed);
    sessionStorage.setItem('youtube_code_verifier', codeVerifier);
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }

  window.location.href = `${config.authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens. With client secret: no PKCE. Without: send code_verifier.
 */
export async function exchangeYouTubeCode(code) {
  const redirectUri = (config.redirectUri || '').trim();
  const body = new URLSearchParams({
    client_id: (config.clientId || '').trim(),
    code: (code || '').trim(),
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const clientSecret = (config.clientSecret || '').trim();
  if (clientSecret) {
    body.set('client_secret', clientSecret);
  } else {
    const codeVerifier = sessionStorage.getItem('youtube_code_verifier');
    if (!codeVerifier) throw new Error('Missing code verifier');
    body.set('code_verifier', codeVerifier);
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[YouTube token]', response.status, text);
    let msg = `Token exchange failed (${response.status})`;
    try {
      const err = JSON.parse(text);
      const parts = [err.error, err.error_description].filter(Boolean);
      if (parts.length) msg += ': ' + parts.join(' — ');
      if (text.includes('client_secret is missing')) msg += ' Add GOOGLE_CLIENT_SECRET to .env (no spaces around =), then restart the dev server.';
    } catch {
      if (text) msg += ': ' + text.slice(0, 200);
    }
    throw new Error(msg);
  }

  const data = await response.json();
  sessionStorage.removeItem('youtube_code_verifier');

  const expiresIn = data.expires_in || 3600;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

/**
 * Refresh an expired access token using the refresh token.
 * Returns new token data { accessToken, refreshToken, expiresAt }.
 */
export async function refreshYouTubeToken(refreshToken) {
  if (!refreshToken) return null;
  const clientSecret = (config.clientSecret || '').trim();
  const body = new URLSearchParams({
    client_id: (config.clientId || '').trim(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  if (clientSecret) body.set('client_secret', clientSecret);

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) return null;
  const data = await response.json();
  const expiresIn = data.expires_in || 3600;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

/**
 * Return valid token data, refreshing if expired (with 60s buffer).
 * Pass the object from getToken(platform). Returns same shape or null.
 * Returns null if token is expired and refresh fails or is not possible (so caller does not use an expired token and get 401).
 */
export async function getValidYouTubeToken(tokenData) {
  if (!tokenData?.accessToken) return null;
  const now = Date.now();
  const bufferMs = 60 * 1000;
  if (tokenData.expiresAt && tokenData.expiresAt > now + bufferMs) return tokenData;
  if (!tokenData.refreshToken) {
    // No refresh token: do not return token if expired or if we don't know expiry (missing expiresAt)
    if (!tokenData.expiresAt || tokenData.expiresAt <= now + bufferMs) return null;
    return tokenData;
  }
  const refreshed = await refreshYouTubeToken(tokenData.refreshToken);
  if (refreshed) return refreshed;
  return null;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

/**
 * GET request to YouTube Data API v3. Adds ?part=snippet by default.
 * All list endpoints use pagination via pageToken.
 */
async function youtubeFetch(endpoint, accessToken, params = {}) {
  const url = new URL(config.apiBase + endpoint);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  if (!url.searchParams.has('part')) url.searchParams.set('part', 'snippet');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 401) throw new Error('TOKEN_EXPIRED');
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `YouTube API error: ${response.status}`);
  }
  return response.json();
}

// ─── Playlist operations ──────────────────────────────────────────────────────

/**
 * All playlists owned by the authenticated user (mine=true).
 * Paginates with nextPageToken. Returns { id, name, trackCount, image, platform }.
 */
export async function getYouTubePlaylists(accessToken) {
  const playlists = [];
  let pageToken = '';

  do {
    const data = await youtubeFetch('/playlists', accessToken, {
      part: 'snippet,contentDetails',
      mine: 'true',
      maxResults: '50',
      pageToken,
    });
    playlists.push(
      ...(data.items || []).map((pl) => ({
        id: pl.id,
        name: pl.snippet?.title || 'Untitled',
        trackCount: pl.contentDetails?.itemCount ?? 0,
        image: pl.snippet?.thumbnails?.default?.url || null,
        platform: 'youtube',
      }))
    );
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return playlists;
}

/**
 * Get a single playlist by ID (e.g. public playlist). Returns { id, name, trackCount }.
 * Use with getYouTubePlaylistTracks to get tracks.
 */
export async function getYouTubePlaylistById(accessToken, playlistId) {
  const data = await youtubeFetch('/playlists', accessToken, {
    part: 'snippet,contentDetails',
    id: playlistId,
    maxResults: '1',
  });
  const pl = data.items?.[0];
  if (!pl) throw new Error('Playlist not found or not accessible');
  return {
    id: pl.id,
    name: pl.snippet?.title || 'Untitled',
    trackCount: pl.contentDetails?.itemCount ?? 0,
    platform: 'youtube',
  };
}

/**
 * All videos in a playlist (playlistItems). Each item has videoId, title, channel.
 * Returns normalized tracks: { id (item id), videoId, title, artist, platform }.
 */
export async function getYouTubePlaylistTracks(accessToken, playlistId) {
  const tracks = [];
  let pageToken = '';

  do {
    const data = await youtubeFetch('/playlistItems', accessToken, {
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: '50',
      pageToken,
    });
    for (const item of data.items || []) {
      const vid = item.contentDetails?.videoId;
      if (!vid) continue;
      tracks.push({
        id: item.id,
        videoId: vid,
        title: item.snippet?.title || '',
        artist: item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle || '',
        album: '',
        duration: null,
        isrc: null,
        platform: 'youtube',
      });
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return tracks;
}

/** Create a new private playlist. Returns playlist id. */
export async function createYouTubePlaylist(accessToken, name, description = '') {
  const response = await fetch(
    `${config.apiBase}/playlists?part=snippet,status`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: {
          title: name,
          description: description || 'Transferred via StreamSwap',
        },
        status: { privacyStatus: 'private' },
      }),
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err.error?.message || err.error?.errors?.[0]?.reason || 'Failed to create playlist';
    if (response.status === 401) {
      throw new Error(
        'YouTube API 401: Token expired or invalid. Sign out of YouTube in the app and sign in again, then retry the transfer.'
      );
    }
    if (response.status === 403) {
      throw new Error(
        `YouTube API 403: ${msg}. Enable "YouTube Data API v3" in Google Cloud Console (APIs & Services) and ensure your OAuth consent includes the youtube scope.`
      );
    }
    throw new Error(msg);
  }
  const data = await response.json();
  return data.id;
}

/** Add videos to a playlist (one request per video; API does not batch insert). */
export async function addTracksToYouTubePlaylist(accessToken, playlistId, videoIds) {
  for (const videoId of videoIds) {
    const response = await fetch(
      `${config.apiBase}/playlistItems?part=snippet`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            playlistId,
            resourceId: { kind: 'youtube#video', videoId },
          },
        }),
      }
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to add video ${videoId}`);
    }
  }
}

/**
 * Search for a music video by title + artist. Uses category 10 (Music) to bias results.
 * Returns { id, videoId, title, artist, confidence, method } or null.
 */
export async function searchYouTubeTrack(accessToken, title, artist) {
  const q = [title, artist].filter(Boolean).join(' ');
  if (!q.trim()) return null;

  const data = await youtubeFetch('/search', accessToken, {
    part: 'snippet',
    q,
    type: 'video',
    maxResults: '5',
    videoCategoryId: '10', // Music
  });

  const items = data.items || [];
  if (items.length === 0) return null;

  const first = items[0];
  const videoId = first.id?.videoId;
  if (!videoId) return null;

  return {
    id: videoId,
    videoId,
    title: first.snippet?.title || '',
    artist: first.snippet?.channelTitle || '',
    confidence: 0.85,
    method: 'search',
  };
}
