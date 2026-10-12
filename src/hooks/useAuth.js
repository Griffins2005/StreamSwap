// ══════════════════════════════════════════════════════════════════════════════
// Auth State Hook
// ══════════════════════════════════════════════════════════════════════════════
// Remembers OAuth tokens on this browser. A refresh token still counts as
// signed in after the short-lived access token expires.

import { useState, useCallback } from 'react';
import { readTokens, writeTokens } from '../lib/tokenStore';

export function useAuth() {
  const [tokens, setTokens] = useState(readTokens);

  const setToken = useCallback((platform, tokenData) => {
    setTokens((prev) => {
      const updated = { ...prev, [platform]: tokenData };
      writeTokens(updated);
      return updated;
    });
  }, []);

  const getToken = useCallback(
    (platform) => {
      const data = tokens[platform];
      if (!data) return null;

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
      if (!data?.accessToken && !data?.refreshToken) return false;
      if (data.refreshToken) return true;
      if (data.expiresAt && Date.now() > data.expiresAt) return false;
      return true;
    },
    [tokens]
  );

  const disconnect = useCallback((platform) => {
    setTokens((prev) => {
      const updated = { ...prev };
      delete updated[platform];
      writeTokens(updated);
      return updated;
    });
  }, []);

  const disconnectAll = useCallback(() => {
    setTokens({});
    writeTokens({});
  }, []);

  return { tokens, setToken, getToken, isConnected, disconnect, disconnectAll };
}
