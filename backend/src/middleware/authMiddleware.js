import { createAuthenticatedClient } from '../config/googleAuth.js';

export function attachAuth(req, res, next) {
  const tokens = req.session?.tokens;

  if (tokens) {
    req.authClient = createAuthenticatedClient(tokens, (updatedTokens) => {
      req.session.tokens = updatedTokens;
    });
    req.user = req.session.user || null;
  } else {
    req.authClient = null;
    req.user = null;
  }

  next();
}

export function requireAuth(req, res, next) {
  if (!req.session?.tokens) {
    return res.status(401).json({
      error: 'UNAUTHENTICATED',
      message: 'Please authenticate with Google Calendar to access this endpoint.',
    });
  }
  next();
}
