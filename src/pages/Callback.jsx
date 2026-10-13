// ═══════════════════════════════════════════════════════════════════════════════
// OAuth Callback Page
// ═══════════════════════════════════════════════════════════════════════════════
// Route: /callback/:platform (e.g. /callback/spotify, /callback/youtube)
// After user authorizes on Spotify or Google, they are redirected here with ?code=...
// This page exchanges the code for tokens (using PKCE verifier from sessionStorage),
// stores tokens on this browser, then redirects to /.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeSpotifyCode } from '../lib/spotify';
import { exchangeYouTubeCode } from '../lib/youtube';
import { exchangeTidalCode } from '../lib/tidal';
import { exchangeDeezerCode } from '../lib/deezer';
import { readTokens, writeTokens } from '../lib/tokenStore';
import { explainUserError } from '../lib/userErrors';

const pageStyle = {
  minHeight: '100vh',
  background: '#f4efe6',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'Nunito Sans', sans-serif",
  color: '#2c2824',
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
        setError(explainUserError(errorParam, { where: 'signin', platform }));
        return;
      }

      if (!code) {
        setError(explainUserError('access_denied', { where: 'signin', platform }));
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
        const existing = readTokens();
        existing[platform] = tokenData;
        writeTokens(existing);

        setStatus(`Connected to ${platformLabel}! Redirecting...`);
        setTimeout(() => navigate('/'), 500);
      } catch (err) {
        setError(explainUserError(err, { where: 'signin', platform }));
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
                border: '3px solid #e6dccf',
                borderTopColor: '#3e6b5e',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 20px',
              }}
            />
            <p style={{ fontSize: 16, fontWeight: 600 }}>{status}</p>
          </>
        ) : (
          <>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#8d534c', fontFamily: "'Fraunces', serif" }}>{error.title}</p>
            {error.handles && <p style={{ fontSize: 14, color: '#6f675e', marginTop: 8, lineHeight: 1.5 }}>{error.handles}</p>}
            {error.steps?.length > 0 && (
              <ol style={{ textAlign: 'left', fontSize: 14, color: '#2c2824', lineHeight: 1.5, paddingLeft: 18, marginTop: 14 }}>
                {error.steps.map((step) => (
                  <li key={step} style={{ marginTop: 6 }}>{step}</li>
                ))}
              </ol>
            )}
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{ marginTop: 18, background: '#3e6b5e', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Back to StreamSwap
            </button>
          </>
        )}
      </div>
    </div>
  );
}
