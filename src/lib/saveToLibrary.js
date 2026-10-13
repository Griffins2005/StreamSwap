// Saves a loaded playlist onto the signed-in account when that service allows it.

import { copyDeezerPlaylistToLibrary } from './deezer';
import { copySpotifyPlaylistToLibrary, getSpotifyUserProfile } from './spotify';
import { copyYouTubePlaylistToLibrary, getYouTubeMyChannelId } from './youtube';

const NAMES = { spotify: 'Spotify', youtube: 'YouTube Music', deezer: 'Deezer' };

export function savedCopyGuide(platform, info = {}) {
  const name = NAMES[platform] || 'your account';
  const playlistName = info.name || 'Playlist';
  if (info.unavailable) {
    return { title: 'These songs are loaded.', handles: info.handles, steps: info.steps || [] };
  }
  if (info.limited) {
    return {
      title: `Part of this playlist is now on your ${name} account.`,
      handles: `StreamSwap saved ${info.saved} of ${info.total} songs to a private playlist named “${playlistName}”. ${name} stopped the rest. The songs already loaded can still be moved.`,
      steps: ['Save the rest later, after the daily limit resets.'],
    };
  }
  if (info.failed) {
    return {
      title: `These songs are loaded. A copy was not saved to your ${name} account.`,
      handles: info.handles || `${name} did not accept the new playlist. The songs from the link can still be moved.`,
      steps: info.steps || [],
      reconnect: info.reconnect,
    };
  }
  const count = info.saved != null ? `, with ${info.saved} songs` : '';
  return {
    title: `A copy is now on your ${name} account.`,
    handles: `StreamSwap saved “${playlistName}” as a private playlist you own${count}. This move uses that copy.`,
    steps: [],
  };
}

function failureGuide(platform, err) {
  const msg = String(err?.message || '');
  if (platform === 'spotify' && msg.startsWith('SPOTIFY_NEED_PERMISSION')) {
    return savedCopyGuide(platform, {
      failed: true,
      reconnect: 'spotify',
      handles: 'Spotify needs permission to create a playlist. The songs from the link can still be moved. Reconnect and allow playlist changes if you want a copy saved.',
    });
  }
  if (err?.name === 'YouTubeQuotaError' || msg === 'YOUTUBE_UNIT_QUOTA') {
    return savedCopyGuide(platform, {
      failed: true,
      handles: 'YouTube’s daily limit for adding songs is used up, so no copy was saved. The songs from the link can still be moved.',
    });
  }
  return savedCopyGuide(platform, { failed: true });
}

/**
 * When the signed-in user does not already own the playlist, save a private copy.
 * Returns the playlist to move (the copy, when one was saved) and a note for the next step.
 */
export async function saveLoadedPlaylist(platform, accessToken, playlist) {
  try {
    if (platform === 'spotify') {
      const me = await getSpotifyUserProfile(accessToken);
      if (playlist.ownerId && me?.id && playlist.ownerId === me.id) return { playlist, guide: null };
      const copy = await copySpotifyPlaylistToLibrary(accessToken, playlist);
      if (!copy.saved) return { playlist, guide: savedCopyGuide('spotify', { failed: true, name: playlist.name }) };
      return {
        playlist: { ...playlist, id: copy.id },
        guide: savedCopyGuide('spotify', { name: playlist.name, saved: copy.saved }),
      };
    }

    if (platform === 'youtube') {
      const mine = await getYouTubeMyChannelId(accessToken);
      if (playlist.channelId && mine && playlist.channelId === mine) return { playlist, guide: null };
      const copy = await copyYouTubePlaylistToLibrary(accessToken, playlist);
      if (!copy.saved) return { playlist, guide: failureGuide('youtube', new Error('YOUTUBE_UNIT_QUOTA')) };
      return {
        playlist: copy.saved > 0 ? { ...playlist, id: copy.id } : playlist,
        guide: savedCopyGuide('youtube', {
          name: playlist.name,
          saved: copy.saved,
          total: copy.total,
          limited: Boolean(copy.limited),
        }),
      };
    }

    if (platform === 'deezer') {
      if (!accessToken) {
        return {
          playlist,
          guide: savedCopyGuide('deezer', {
            unavailable: true,
            handles: 'Deezer shared this public playlist. Saving a copy onto your Deezer account needs a Deezer sign-in, which is not available yet. The songs can still be moved.',
          }),
        };
      }
      const copy = await copyDeezerPlaylistToLibrary(accessToken, playlist);
      if (!copy.saved) return { playlist, guide: savedCopyGuide('deezer', { failed: true, name: playlist.name }) };
      return {
        playlist: { ...playlist, id: copy.id },
        guide: savedCopyGuide('deezer', { name: playlist.name, saved: copy.saved }),
      };
    }
  } catch (err) {
    return { playlist, guide: failureGuide(platform, err) };
  }

  return { playlist, guide: null };
}
