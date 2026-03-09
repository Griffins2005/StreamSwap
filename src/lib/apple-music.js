// ══════════════════════════════════════════════
// Apple Music API Service
// ══════════════════════════════════════════════
// Uses MusicKit JS for auth + Apple Music API
// for playlist operations.
//
// Prerequisites:
// 1. Apple Developer account with MusicKit enabled
// 2. Developer Token (JWT signed with your key)
// 3. MusicKit JS loaded in index.html

import { PLATFORMS } from './platforms';

const config = PLATFORMS.apple;

// ── MusicKit Setup ───────────────────────────
let musicKit = null;

export async function initAppleMusic() {
  if (musicKit) return musicKit;

  if (!config.developerToken) {
    throw new Error('Apple Music Developer Token not configured. Add APPLE_MUSIC_DEVELOPER_TOKEN to your .env file.');
  }

  // Load MusicKit JS if not already loaded
  if (!window.MusicKit) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    // Wait for MusicKit to be ready
    await new Promise((resolve) => {
      document.addEventListener('musickitloaded', resolve, { once: true });
    });
  }

  musicKit = await window.MusicKit.configure({
    developerToken: config.developerToken,
    app: {
      name: 'StreamSwap',
      build: '1.0.0',
    },
  });

  return musicKit;
}

// ── Auth Flow ────────────────────────────────
export async function initiateAppleMusicAuth() {
  const mk = await initAppleMusic();
  const musicUserToken = await mk.authorize();
  return { musicUserToken };
}

export function getAppleMusicToken() {
  if (!musicKit) return null;
  return musicKit.musicUserToken;
}

// ── API Helpers ──────────────────────────────
async function appleFetch(endpoint, musicUserToken) {
  const url = `${config.apiBase}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.developerToken}`,
      'Music-User-Token': musicUserToken,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.title || `Apple Music API error: ${response.status}`);
  }

  return response.json();
}

// ── Playlist Operations ──────────────────────
export async function getAppleMusicPlaylists(musicUserToken) {
  const playlists = [];
  let url = '/me/library/playlists?limit=100';

  while (url) {
    const data = await appleFetch(url, musicUserToken);
    playlists.push(
      ...data.data.map((pl) => ({
        id: pl.id,
        name: pl.attributes.name,
        trackCount: pl.attributes.trackCount || 0,
        image: pl.attributes.artwork?.url?.replace('{w}', '200').replace('{h}', '200') || null,
        description: pl.attributes.description?.standard || '',
        platform: 'apple',
      }))
    );
    url = data.next || null;
  }

  return playlists;
}

export async function getAppleMusicPlaylistTracks(musicUserToken, playlistId) {
  const tracks = [];
  let url = `/me/library/playlists/${playlistId}/tracks?limit=100`;

  while (url) {
    const data = await appleFetch(url, musicUserToken);
    tracks.push(
      ...data.data.map((item) => ({
        id: item.id,
        title: item.attributes.name,
        artist: item.attributes.artistName,
        album: item.attributes.albumName || '',
        duration: Math.round((item.attributes.durationInMillis || 0) / 1000),
        isrc: null, // Apple doesn't expose ISRC in library endpoint
        platform: 'apple',
      }))
    );
    url = data.next || null;
  }

  return tracks;
}

export async function createAppleMusicPlaylist(musicUserToken, name, description = '') {
  const response = await fetch(`${config.apiBase}/me/library/playlists`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.developerToken}`,
      'Music-User-Token': musicUserToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      attributes: {
        name,
        description: description || 'Transferred via StreamSwap',
      },
    }),
  });

  const data = await response.json();
  return data.data[0].id;
}

export async function addTracksToAppleMusicPlaylist(musicUserToken, playlistId, trackIds) {
  const tracks = trackIds.map((id) => ({ id, type: 'songs' }));

  // Apple allows up to 100 tracks per request
  const chunks = [];
  for (let i = 0; i < tracks.length; i += 100) {
    chunks.push(tracks.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    await fetch(`${config.apiBase}/me/library/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.developerToken}`,
        'Music-User-Token': musicUserToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: chunk }),
    });
  }
}

export async function searchAppleMusicTrack(musicUserToken, title, artist, isrc = null) {
  // Try ISRC first via catalog search
  if (isrc) {
    try {
      const data = await appleFetch(
        `/catalog/us/songs?filter[isrc]=${encodeURIComponent(isrc)}`,
        musicUserToken
      );
      if (data.data?.length > 0) {
        const t = data.data[0];
        return {
          id: t.id,
          title: t.attributes.name,
          artist: t.attributes.artistName,
          confidence: 1.0,
          method: 'ISRC',
        };
      }
    } catch (e) {
      // Fall through
    }
  }

  // Text search fallback
  const query = `${title} ${artist}`;
  const data = await appleFetch(
    `/catalog/us/search?types=songs&term=${encodeURIComponent(query)}&limit=5`,
    musicUserToken
  );

  const results = data.results?.songs?.data;
  if (!results?.length) return null;

  const t = results[0];
  return {
    id: t.id,
    title: t.attributes.name,
    artist: t.attributes.artistName,
    confidence: 0.85,
    method: 'search',
  };
}
