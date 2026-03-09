// ══════════════════════════════════════════════
// Song Matching Engine
// ══════════════════════════════════════════════
// Matches tracks across platforms using:
// 1. ISRC (International Standard Recording Code) — exact match
// 2. Title + Artist fuzzy matching via Levenshtein distance
// 3. Duration comparison as a tiebreaker

/**
 * Normalize a string for comparison:
 * - Lowercase
 * - Remove feat./ft. parentheticals
 * - Remove brackets [Remix], [Live], etc.
 * - Strip special characters
 * - Collapse whitespace
 */
export function normalizeString(str) {
  return str
    .toLowerCase()
    .replace(/\(feat\.?[^)]*\)/gi, '')
    .replace(/\(ft\.?[^)]*\)/gi, '')
    .replace(/\(with\s[^)]*\)/gi, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\s*[-–—]\s*(feat|ft)\.?\s.*/gi, '')
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein distance between two strings.
 * Returns the minimum number of single-character edits
 * (insertions, deletions, substitutions) to transform a → b.
 */
export function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;

  // Use single-row optimization for memory efficiency
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] = 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/**
 * Similarity score between two strings (0 to 1).
 * 1 = identical, 0 = completely different.
 */
export function stringSimilarity(a, b) {
  const na = normalizeString(a);
  const nb = normalizeString(b);

  if (na === nb) return 1;
  if (na.length === 0 && nb.length === 0) return 1;

  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(na, nb);
  return 1 - distance / maxLen;
}

/**
 * Check if duration difference is within acceptable range.
 * Songs on different platforms can vary by a few seconds.
 */
export function durationMatch(durA, durB, toleranceSec = 5) {
  if (!durA || !durB) return true; // Unknown duration, don't penalize
  return Math.abs(durA - durB) <= toleranceSec;
}

/**
 * Match a single track against a catalog of destination tracks.
 *
 * Returns:
 *   { match, confidence, method }
 *   - match: the best matching track object (or null)
 *   - confidence: 0..1 match quality
 *   - method: 'ISRC' | 'title+artist' | 'fuzzy' | 'none'
 */
export function matchTrack(track, catalog) {
  // Strategy 1: ISRC exact match (highest confidence)
  if (track.isrc) {
    const isrcMatch = catalog.find(
      (c) => c.isrc && c.isrc.toUpperCase() === track.isrc.toUpperCase()
    );
    if (isrcMatch) {
      return { match: isrcMatch, confidence: 1.0, method: 'ISRC' };
    }
  }

  // Strategy 2: Title + Artist fuzzy match
  let bestMatch = null;
  let bestScore = 0;

  for (const candidate of catalog) {
    const titleSim = stringSimilarity(track.title, candidate.title);
    const artistSim = stringSimilarity(track.artist, candidate.artist);

    // Weighted combination: title matters more
    let combined = titleSim * 0.55 + artistSim * 0.35;

    // Duration bonus/penalty
    if (track.duration && candidate.duration) {
      const durOk = durationMatch(track.duration, candidate.duration);
      combined += durOk ? 0.1 : -0.05;
    } else {
      combined += 0.05; // Neutral
    }

    if (combined > bestScore) {
      bestScore = combined;
      bestMatch = candidate;
    }
  }

  // Classify the match
  if (bestScore >= 0.88) {
    return { match: bestMatch, confidence: bestScore, method: 'title+artist' };
  }
  if (bestScore >= 0.6) {
    return { match: bestMatch, confidence: bestScore, method: 'fuzzy' };
  }

  return { match: null, confidence: bestScore, method: 'none' };
}

/**
 * Match all tracks in a playlist against a destination catalog.
 * Returns a Map of trackId → matchResult.
 */
export function matchPlaylist(tracks, catalog) {
  const results = new Map();
  for (const track of tracks) {
    results.set(track.id, matchTrack(track, catalog));
  }
  return results;
}

/**
 * Find duplicate tracks across multiple playlists.
 * Returns array of { track, playlist, existsIn }.
 */
export function findDuplicates(playlists) {
  const seen = new Map(); // normalized key → first playlist name
  const duplicates = [];

  for (const playlist of playlists) {
    for (const track of playlist.tracks) {
      const key = normalizeString(`${track.title}|${track.artist}`);

      if (seen.has(key)) {
        duplicates.push({
          track,
          playlist: playlist.name,
          existsIn: seen.get(key),
        });
      } else {
        seen.set(key, playlist.name);
      }
    }
  }

  return duplicates;
}

/**
 * Compute match statistics from a results map.
 */
export function computeMatchStats(results) {
  const arr = Array.from(results.values());
  return {
    total: arr.length,
    exact: arr.filter((r) => r.confidence >= 0.88).length,
    fuzzy: arr.filter((r) => r.confidence >= 0.6 && r.confidence < 0.88).length,
    missing: arr.filter((r) => r.confidence < 0.6).length,
    avgConfidence: arr.length > 0
      ? arr.reduce((sum, r) => sum + r.confidence, 0) / arr.length
      : 0,
  };
}
