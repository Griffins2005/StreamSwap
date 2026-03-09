// ═══════════════════════════════════════════════════════════════════════════════
// Public playlist URL parsing and fetching
// ═══════════════════════════════════════════════════════════════════════════════
// Parse supported public playlist URLs and return { platform, playlistId }.
// Platforms that allow public playlist access: Spotify (with user token), YouTube (with user token), Deezer (no auth).
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse a public playlist URL and return platform + playlist ID, or null if unsupported.
 * Supported patterns:
 * - Spotify: open.spotify.com/playlist/{id}, spotify.com/playlist/{id}
 * - YouTube: youtube.com/playlist?list={id}, music.youtube.com/playlist?list={id}, youtu.be (playlist in query)
 * - Deezer: deezer.com/.../playlist/{id}, open.spotify.com is not Deezer
 * @returns {{ platform: 'spotify'|'youtube'|'deezer', playlistId: string } | null}
 */
export function parsePublicPlaylistUrl(input) {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;

  try {
    // Spotify: .../playlist/22xqXQz6LfyFCN2S2b+PRg or 22xqXQz6LfyFCN2S2b+PRg
    const spotifyMatch = s.match(/(?:open\.)?spotify\.com\/playlist\/([A-Za-z0-9]+)/);
    if (spotifyMatch) return { platform: 'spotify', playlistId: spotifyMatch[1] };

    // YouTube: .../playlist?list=PLxxx or ...?list=PLxxx
    const ytMatch = s.match(/(?:youtube\.com|music\.youtube\.com)\/.*[?&]list=([A-Za-z0-9_-]+)/);
    if (ytMatch) return { platform: 'youtube', playlistId: ytMatch[1] };

    // Deezer: deezer.com/.../playlist/1234567890 or /playlist/1234567890
    const deezerMatch = s.match(/(?:deezer\.com(?:\/[a-z]{2})?\/)?playlist\/(\d+)/);
    if (deezerMatch) return { platform: 'deezer', playlistId: deezerMatch[1] };

    return null;
  } catch {
    return null;
  }
}
