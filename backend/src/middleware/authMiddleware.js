import { createAuthenticatedClient } from '../config/googleAuth.js';
import { getSession, updateSessionTokens } from '../config/sessionStore.js';

export function attachAuth(req, res, next) {
  let tokens = req.session?.tokens;
  let user = req.session?.user;
  let bearerToken = null;

  // Check Authorization Bearer header first (crucial for iOS Safari cross-domain ITP & stateless 14-day auth)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerToken = authHeader.split(' ')[1]?.trim();
    if (bearerToken) {
      const sessionData = getSession(bearerToken);
      if (sessionData) {
        tokens = sessionData.tokens;
        user = sessionData.user;
      }
    }
  }

  if (tokens) {
    req.authClient = createAuthenticatedClient(tokens, (updatedTokens) => {
      if (req.session) {
        req.session.tokens = updatedTokens;
      }
      if (bearerToken) {
        const freshToken = updateSessionTokens(bearerToken, updatedTokens);
        if (freshToken) {
          try {
            res.setHeader('X-New-Token', freshToken);
          } catch (e) {
            // Header may have already been sent in streaming responses
          }
        }
      }
    });
    req.user = user || null;
    req.bearerToken = bearerToken;
  } else {
    req.authClient = null;
    req.user = null;
    req.bearerToken = null;
  }

  next();
}

export function requireAuth(req, res, next) {
  if (!req.authClient) {
    return res.status(401).json({
      error: 'UNAUTHENTICATED',
      message: 'Please authenticate with Google Calendar to access this endpoint.',
    });
  }
  next();
}
