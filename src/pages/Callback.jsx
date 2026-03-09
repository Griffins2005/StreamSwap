// ═══════════════════════════════════════════════════════════════════════════════
// OAuth Callback Page
// ═══════════════════════════════════════════════════════════════════════════════
// Route: /callback/:platform (e.g. /callback/spotify, /callback/youtube)
// After user authorizes on Spotify or Google, they are redirected here with ?code=...
// This page exchanges the code for tokens (using PKCE verifier from sessionStorage),
// stores tokens in sessionStorage under key streamswap_tokens, then redirects to /.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeSpotifyCode } from '../lib/spotify';
import { exchangeYouTubeCode } from '../lib/youtube';
import { exchangeTidalCode } from '../lib/tidal';
import { exchangeDeezerCode } from '../lib/deezer';

// Shared theme for callback page (matches app milk-white + purple)
const pageStyle = {
  minHeight: '100vh',
  background: '#fafaf8',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'Outfit', sans-serif",
  color: '#1c1c1e',
};

export default function Callback() {
  const { platform } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing...');
  const [error, setError] = useState(null);
  const exchangeStarted = useRef(false);

  useEffect(() => {
    async function handleCallback() {
      if (exchangeStarted.current) return;
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setError(`Authorization denied: ${errorParam}`);
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      if (!code) {
        setError('No authorization code received');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      exchangeStarted.current = true;
      const platformLabels = { spotify: 'Spotify', youtube: 'YouTube Music', tidal: 'Tidal', deezer: 'Deezer' };
      const platformLabel = platformLabels[platform] || platform;
      try {
        setStatus(`Exchanging code with ${platformLabel}...`);

        let tokenData;
        if (platform === 'spotify') tokenData = await exchangeSpotifyCode(code);
        else if (platform === 'youtube') tokenData = await exchangeYouTubeCode(code);
        else if (platform === 'tidal') tokenData = await exchangeTidalCode(code);
        else if (platform === 'deezer') tokenData = await exchangeDeezerCode(code);
        else throw new Error(`Unsupported platform: ${platform}`);

        // Persist tokens for useAuth() in App (same key)
        const existing = JSON.parse(sessionStorage.getItem('streamswap_tokens') || '{}');
        existing[platform] = tokenData;
        sessionStorage.setItem('streamswap_tokens', JSON.stringify(existing));

        setStatus(`Connected to ${platformLabel}! Redirecting...`);
        setTimeout(() => navigate('/'), 500);
      } catch (err) {
        setError(err.message);
        setTimeout(() => navigate('/'), 4000);
      }
    }

    handleCallback();
  }, [platform, searchParams, navigate]);

  return (
    <div style={pageStyle}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        {!error ? (
          <>
            <div
              style={{
                width: 40,
                height: 40,
                border: '3px solid rgba(0,0,0,0.08)',
                borderTopColor: '#7C3AED',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 20px',
              }}
            />
            <p style={{ fontSize: 16, fontWeight: 600 }}>{status}</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#ef4444' }}>{error}</p>
            <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', marginTop: 8 }}>
              Redirecting back...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
