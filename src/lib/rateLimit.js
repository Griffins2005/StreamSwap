/** Thrown when a 429 persists after retries or Retry-After is too long to wait in the tab. */
export class RateLimitError extends Error {
  constructor(retryAfterSec = 0) {
    super('RATE_LIMIT');
    this.name = 'RateLimitError';
    this.retryAfterSec = retryAfterSec;
  }
}

function retryAfterMs(response, attempt) {
  const header = response.headers.get('Retry-After');
  if (header) {
    const seconds = Number(header);
    if (!Number.isNaN(seconds)) return Math.max(0, seconds * 1000);
    const when = Date.parse(header);
    if (!Number.isNaN(when)) return Math.max(0, when - Date.now());
  }
  return Math.min(30000, 1000 * 2 ** attempt);
}

/**
 * fetch() that honors Retry-After on 429, up to 3 retries.
 * Waits longer than 60s are surfaced as RateLimitError so the transfer can pause and resume.
 */
export async function fetchWithRetry(url, options = {}) {
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);
    if (response.status !== 429) return response;
    const wait = retryAfterMs(response, attempt);
    if (attempt === maxRetries || wait > 60000) {
      throw new RateLimitError(Math.ceil(wait / 1000));
    }
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  throw new RateLimitError(0);
}
