const KEY = 'streamswap_transfer_checkpoint';

export function checkpointSignature(source, dest, playlistIds) {
  return `${source}|${dest}|${[...playlistIds].sort().join(',')}`;
}

export function loadCheckpoint() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCheckpoint(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, updatedAt: Date.now() }));
  } catch {
    // Resume data is best-effort.
  }
}

export function clearCheckpoint() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore storage failures.
  }
}
