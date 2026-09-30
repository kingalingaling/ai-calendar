import { getAuthorizationUrl, exchangeCodeForTokens, fetchGoogleProfile } from '../config/googleAuth.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export async function getAuthUrl(req, res, next) {
  try {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return res.status(200).json({
        configured: false,
        message: 'Google OAuth Client ID & Secret are not yet configured in backend/.env. Running in Demo Mode.',
        url: null,
      });
    }

    const url = getAuthorizationUrl();
    res.json({ configured: true, url });
  } catch (err) {
    next(err);
  }
}

export async function handleGoogleCallback(req, res, next) {
  try {
    const { code } = req.query;
    if (!code) {
      return res.redirect(`${env.CLIENT_URL}?auth=failed&reason=no_code`);
    }

    const tokens = await exchangeCodeForTokens(code);
    const profile = await fetchGoogleProfile(tokens);

    req.session.tokens = tokens;
    req.session.user = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    };

    logger.info(`✅ User authenticated successfully: ${profile.email}`);
    res.redirect(`${env.CLIENT_URL}?auth=success`);
  } catch (err) {
    logger.error('OAuth Callback error:', err.message);
    res.redirect(`${env.CLIENT_URL}?auth=failed&reason=${encodeURIComponent(err.message)}`);
  }
}

export function getCurrentUser(req, res) {
  if (req.session?.tokens) {
    return res.json({
      authenticated: true,
      mode: 'google',
      user: req.session.user,
    });
  }

  // Demo user mode
  res.json({
    authenticated: false,
    mode: 'demo',
    user: {
      name: 'Demo User (WAT)',
      email: 'demo@ai-calendar.local',
      picture: null,
    },
  });
}

export function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
}
