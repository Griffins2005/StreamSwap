// Account tokens stay on this browser so a return visit does not start sign-in again.
// Older sessions kept them in sessionStorage; those are moved across once.

const TOKEN_KEY = 'streamswap_tokens';

export function readTokens() {
  try {
    let raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) {
      raw = sessionStorage.getItem(TOKEN_KEY);
      if (raw) {
        localStorage.setItem(TOKEN_KEY, raw);
        sessionStorage.removeItem(TOKEN_KEY);
      }
    }
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function writeTokens(tokens) {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // A full browser store should not block the rest of the app.
  }
}

export function forgetPlatform(platform) {
  const tokens = readTokens();
  delete tokens[platform];
  writeTokens(tokens);
}
