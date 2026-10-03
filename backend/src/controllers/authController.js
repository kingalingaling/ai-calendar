import { randomUUID } from 'crypto';
import { getAuthorizationUrl, exchangeCodeForTokens, fetchGoogleProfile } from '../config/googleAuth.js';
import { createEncryptedSession, removeSession } from '../config/sessionStore.js';
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
    const { code, error, error_description } = req.query;
    if (error) {
      logger.warn(`Google OAuth returned error: ${error} - ${error_description || ''}`);
      return res.redirect(`${env.CLIENT_URL}?auth=failed&reason=${encodeURIComponent(error_description || error)}`);
    }
    if (!code) {
      return res.redirect(`${env.CLIENT_URL}?auth=failed&reason=no_code`);
    }

    const tokens = await exchangeCodeForTokens(code);
    const profile = await fetchGoogleProfile(tokens);

    const user = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    };

    // 1. Save in traditional session cookie (for browsers supporting it)
    if (req.session) {
      req.session.tokens = tokens;
      req.session.user = user;
    }

    // 2. Generate a 14-day stateless encrypted session token (survives container restarts, spin-downs, and Safari ITP)
    const sessionToken = createEncryptedSession({ tokens, user });

    logger.info(`✅ User authenticated successfully: ${profile.email} (14-day persistent session created)`);
    // Pass token in URL so client can store in localStorage
    res.redirect(`${env.CLIENT_URL}?auth=success&token=${sessionToken}`);
  } catch (err) {
    logger.error('OAuth Callback error:', err.message);
    res.redirect(`${env.CLIENT_URL}?auth=failed&reason=${encodeURIComponent(err.message)}`);
  }
}

export function getCurrentUser(req, res) {
  if (req.authClient && req.user) {
    return res.json({
      authenticated: true,
      mode: 'google',
      user: req.user,
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
  if (req.bearerToken) {
    removeSession(req.bearerToken);
  }

  if (req.session) {
    req.session.destroy((err) => {
      res.clearCookie('connect.sid');
      res.json({ success: true, message: 'Logged out successfully' });
    });
  } else {
    res.json({ success: true, message: 'Logged out successfully' });
  }
}
