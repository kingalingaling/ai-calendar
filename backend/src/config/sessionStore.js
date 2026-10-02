// In-memory token store for Bearer token authorization
// Resolves iOS Safari third-party cookie blocking (ITP) when frontend and backend are on different domains
const tokenStore = new Map();

// Session expires after 30 days
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function saveSession(token, data) {
  tokenStore.set(token, {
    ...data,
    updatedAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
}

export function getSession(token) {
  if (!token) return null;
  const session = tokenStore.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    tokenStore.delete(token);
    return null;
  }
  return session;
}

export function updateSessionTokens(token, newTokens) {
  const session = getSession(token);
  if (session) {
    session.tokens = { ...session.tokens, ...newTokens };
    session.updatedAt = Date.now();
    tokenStore.set(token, session);
  }
}

export function removeSession(token) {
  if (token) {
    tokenStore.delete(token);
  }
}
