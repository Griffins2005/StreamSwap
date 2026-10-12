// Exchanges a YouTube sign-in code on the server so the Google client secret
// stays out of the public site. Vercel serves this at /api/youtube-token.

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function allowedRedirect(uri) {
  try {
    const url = new URL(uri);
    if (url.pathname !== '/callback/youtube') return false;
    if (url.protocol === 'https:' && url.hostname.endsWith('.vercel.app')) return true;
    if (url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')) return true;
    return false;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: 'server_config',
      error_description: 'YouTube sign-in is not configured on the server yet.',
    });
  }

  const body = readBody(req);
  const redirectUri = (body.redirect_uri || '').trim();
  if (!allowedRedirect(redirectUri)) {
    return res.status(400).json({
      error: 'invalid_redirect',
      error_description: 'That return address is not allowed.',
    });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  if (body.refresh_token) {
    params.set('grant_type', 'refresh_token');
    params.set('refresh_token', String(body.refresh_token));
  } else if (body.code) {
    params.set('grant_type', 'authorization_code');
    params.set('code', String(body.code));
    if (body.code_verifier) params.set('code_verifier', String(body.code_verifier));
  } else {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing sign-in code.',
    });
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await response.json().catch(() => ({}));
  return res.status(response.status).json(data);
}
