// ══════════════════════════════════════════════
// Import/Export Utilities
// ══════════════════════════════════════════════
// Handles playlist data in JSON and CSV formats
// for backup, sharing, and cross-tool migration.

/**
 * Format duration seconds as m:ss
 */
function fmtDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Parse duration string "m:ss" back to seconds
 */
function parseDuration(str) {
  if (!str) return 0;
  const parts = str.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  return parseInt(str) || 0;
}

// ── Export ────────────────────────────────────

/**
 * Export playlists as a JSON file download.
 */
export function exportAsJSON(playlists) {
  const data = playlists.map((pl) => ({
    name: pl.name,
    description: pl.description || '',
    trackCount: pl.tracks.length,
    tracks: pl.tracks.map((t) => ({
      title: t.title,
      artist: t.artist,
      album: t.album || '',
      duration: t.duration,
      isrc: t.isrc || null,
    })),
  }));

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, `streamswap_export_${dateStamp()}.json`);
}

/**
 * Export playlists as a CSV file download.
 * Format: Playlist, Track, Artist, Album, Duration, ISRC
 */
export function exportAsCSV(playlists) {
  const rows = ['Playlist,Track,Artist,Album,Duration,ISRC'];

  for (const pl of playlists) {
    for (const t of pl.tracks) {
      rows.push(
        [
          csvEscape(pl.name),
          csvEscape(t.title),
          csvEscape(t.artist),
          csvEscape(t.album || ''),
          fmtDuration(t.duration),
          t.isrc || '',
        ].join(',')
      );
    }
  }

  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  downloadBlob(blob, `streamswap_export_${dateStamp()}.csv`);
}

// ── Import ────────────────────────────────────

/**
 * Parse a JSON file into playlist objects.
 */
export function parseJSON(text) {
  const data = JSON.parse(text);

  if (!Array.isArray(data)) {
    throw new Error('JSON must be an array of playlists');
  }

  return data.map((pl, i) => ({
    id: `import-${i}`,
    name: pl.name || `Imported Playlist ${i + 1}`,
    description: pl.description || '',
    trackCount: pl.tracks?.length || 0,
    tracks: (pl.tracks || []).map((t, j) => ({
      id: `import-${i}-t${j}`,
      title: t.title || t.name || 'Unknown',
      artist: t.artist || t.artists || 'Unknown',
      album: t.album || '',
      duration: t.duration || 0,
      isrc: t.isrc || null,
    })),
    platform: 'import',
    emoji: '📥',
  }));
}

/**
 * Parse a CSV file into playlist objects.
 * Expected columns: Playlist, Track, Artist, Album, Duration, ISRC
 * Also supports: Spotify export format, Soundiiz, TuneMyMusic
 */
export function parseCSV(text) {
  const lines = text.split('\n').filter((line) => line.trim());
  if (lines.length < 2) throw new Error('CSV file is empty');

  // Parse header to detect format
  const header = lines[0].toLowerCase();
  const isStandard = header.includes('playlist') && header.includes('track');

  const playlists = new Map();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 3) continue;

    let plName, title, artist, album, duration, isrc;

    if (isStandard) {
      [plName, title, artist, album, duration, isrc] = cols;
    } else {
      // Try to auto-detect: assume Title, Artist, Album at minimum
      plName = 'Imported Playlist';
      [title, artist, album, duration, isrc] = cols;
    }

    plName = plName || 'Imported Playlist';
    if (!playlists.has(plName)) {
      playlists.set(plName, {
        id: `import-csv-${playlists.size}`,
        name: plName,
        tracks: [],
        platform: 'import',
        emoji: '📥',
      });
    }

    playlists.get(plName).tracks.push({
      id: `import-csv-${playlists.size}-t${playlists.get(plName).tracks.length}`,
      title: title || 'Unknown',
      artist: artist || 'Unknown',
      album: album || '',
      duration: parseDuration(duration),
      isrc: isrc || null,
    });
  }

  const result = Array.from(playlists.values());
  result.forEach((pl) => {
    pl.trackCount = pl.tracks.length;
  });

  return result;
}

/**
 * Auto-detect format and parse file content.
 */
export function parsePlaylistFile(filename, content) {
  const ext = filename.split('.').pop().toLowerCase();

  if (ext === 'json') {
    return { format: 'json', playlists: parseJSON(content) };
  }
  if (ext === 'csv' || ext === 'tsv') {
    return { format: 'csv', playlists: parseCSV(content) };
  }

  // Try JSON first, then CSV
  try {
    return { format: 'json', playlists: parseJSON(content) };
  } catch {
    return { format: 'csv', playlists: parseCSV(content) };
  }
}

// ── Helpers ──────────────────────────────────

function csvEscape(str) {
  if (!str) return '""';
  const s = String(str);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }

  result.push(current.trim());
  return result;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
