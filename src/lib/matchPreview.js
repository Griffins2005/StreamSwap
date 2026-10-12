// Decisions for the match preview step.
// A song is found, close, or missing before anything is added on the destination.

export function matchBand(confidence) {
  if (confidence >= 0.85) return 'found';
  if (confidence >= 0.6) return 'close';
  return 'missing';
}

/** Id the destination API needs in order to add this hit. */
export function destinationTrackId(dest, match) {
  if (!match) return null;
  if (dest === 'spotify') return match.uri || null;
  if (dest === 'youtube') return match.videoId || null;
  return match.id || null;
}

export function buildPreviewItem({ dest, key, playlistId, playlistName, playlistEmoji, track, match }) {
  const addedId = destinationTrackId(dest, match);
  const confidence = addedId ? Number(match.confidence) || 0 : 0;
  const method = addedId ? match.method || 'none' : 'none';
  const band = addedId ? matchBand(confidence) : 'missing';
  return {
    key,
    playlistId,
    playlistName,
    playlistEmoji: playlistEmoji || '',
    track,
    match: addedId ? match : null,
    confidence,
    method,
    band,
    included: band === 'found' || band === 'close',
  };
}

/** Compact hit stored on the transfer checkpoint so a resume does not search again. */
export function savedMatchFromPreview(dest, item) {
  const id = item?.included ? destinationTrackId(dest, item.match) : null;
  if (!id) return null;
  return {
    id,
    confidence: item.confidence,
    method: item.method,
    title: item.match?.title || '',
    artist: item.match?.artist || '',
  };
}

export function matchFromSaved(dest, saved) {
  if (!saved?.id) return null;
  return {
    id: saved.id,
    uri: dest === 'spotify' ? saved.id : undefined,
    videoId: dest === 'youtube' ? saved.id : undefined,
    title: saved.title || '',
    artist: saved.artist || '',
    confidence: saved.confidence ?? 0,
    method: saved.method || 'none',
  };
}

export function summarizePreview(items) {
  const summary = { found: 0, close: 0, missing: 0, included: 0, leftOut: 0 };
  for (const item of items || []) {
    if (summary[item.band] != null) summary[item.band] += 1;
    if (item.included) summary.included += 1;
    else if (item.band !== 'missing') summary.leftOut += 1;
  }
  return summary;
}
