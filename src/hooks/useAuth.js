// ══════════════════════════════════════════════
// Auth State Hook
// ══════════════════════════════════════════════
// Manages OAuth tokens for connected platforms.

import { useState, useCallback } from 'react';

const TOKEN_KEY = 'streamswap_tokens';

function loadTokens() {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveTokens(tokens) {
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  } catch {}
}

export function useAuth() {
  const [tokens, setTokens] = useState(loadTokens);

  const setToken = useCallback((platform, tokenData) => {
    setTokens((prev) => {
      const updated = { ...prev, [platform]: tokenData };
      saveTokens(updated);
      return updated;
    });
  }, []);

  const getToken = useCallback(
    (platform) => {
      const data = tokens[platform];
      if (!data) return null;

      // Check if expired
      if (data.expiresAt && Date.now() > data.expiresAt) {
        return { ...data, expired: true };
      }

      return data;
    },
    [tokens]
  );

  const isConnected = useCallback(
    (platform) => {
      const data = tokens[platform];
      if (!data) return false;
      if (data.expiresAt && Date.now() > data.expiresAt) return false;
      return true;
    },
    [tokens]
  );

  const disconnect = useCallback((platform) => {
    setTokens((prev) => {
      const updated = { ...prev };
      delete updated[platform];
      saveTokens(updated);
      return updated;
    });
  }, []);

  const disconnectAll = useCallback(() => {
    setTokens({});
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {}
  }, []);

  return { tokens, setToken, getToken, isConnected, disconnect, disconnectAll };
}
