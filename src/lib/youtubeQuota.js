import { normalizeString } from './matching';

/** Default YouTube Data API search.list bucket: 100 calls per day (Pacific). */
export const YOUTUBE_DAILY_SEARCH_LIMIT = 100;

const BUDGET_KEY = 'streamswap_yt_search_budget';
const CACHE_KEY = 'streamswap_yt_match_cache';
const CACHE_MAX = 2000;

export class YouTubeQuotaError extends Error {
  constructor() {
    super('YOUTUBE_SEARCH_QUOTA');
    this.name = 'YouTubeQuotaError';
  }
}

function pacificDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function readBudget() {
  const today = pacificDate();
  try {
    const raw = JSON.parse(localStorage.getItem(BUDGET_KEY) || 'null');
    if (raw && raw.date === today && Number.isFinite(raw.used)) {
      return { date: today, used: raw.used };
    }
  } catch {
    // Ignore corrupt storage and start a fresh day.
  }
  return { date: today, used: 0 };
}

function writeBudget(budget) {
  try {
    localStorage.setItem(BUDGET_KEY, JSON.stringify(budget));
  } catch {
    // Quota tracking is best-effort if storage is full.
  }
}

export function getYouTubeSearchBudget() {
  const { used } = readBudget();
  return {
    used,
    remaining: Math.max(0, YOUTUBE_DAILY_SEARCH_LIMIT - used),
    limit: YOUTUBE_DAILY_SEARCH_LIMIT,
  };
}

/** Count one successful search.list call. Throws if the daily bucket is already empty. */
export function consumeYouTubeSearch() {
  const budget = readBudget();
  if (budget.used >= YOUTUBE_DAILY_SEARCH_LIMIT) throw new YouTubeQuotaError();
  budget.used += 1;
  writeBudget(budget);
  return getYouTubeSearchBudget();
}

/** Mark the daily search bucket as spent after the API itself reports quota exhaustion. */
export function markYouTubeSearchExhausted() {
  const budget = readBudget();
  budget.used = YOUTUBE_DAILY_SEARCH_LIMIT;
  writeBudget(budget);
}

function cacheKey(title, artist) {
  return `${normalizeString(title)}\n${normalizeString(artist)}`;
}

function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (raw && typeof raw === 'object') return raw;
  } catch {
    // Ignore corrupt cache.
  }
  return {};
}

function writeCache(cache) {
  const keys = Object.keys(cache);
  if (keys.length > CACHE_MAX) {
    for (const key of keys.slice(0, keys.length - CACHE_MAX)) delete cache[key];
  }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // A full cache should not block the transfer.
  }
}

/** @returns {object|null} cached match, `{ miss: true }` when previously not found, or null if unknown. */
export function lookupYouTubeMatch(title, artist) {
  const key = cacheKey(title, artist);
  if (!key) return null;
  const hit = readCache()[key];
  return hit || null;
}

export function rememberYouTubeMatch(title, artist, match) {
  const key = cacheKey(title, artist);
  if (!key) return;
  const cache = readCache();
  cache[key] = match || { miss: true };
  writeCache(cache);
}
