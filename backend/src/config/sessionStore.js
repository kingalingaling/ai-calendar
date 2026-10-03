import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../.data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// Session lifespan: 14 days in milliseconds
export const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

// AES-256-GCM encryption key derived from SESSION_SECRET
const ENCRYPTION_KEY = crypto.createHash('sha256').update(env.SESSION_SECRET || 'ai-calendar-default-secret-change-me').digest();
const ALGORITHM = 'aes-256-gcm';

// In-memory cache + persistent file store
const memoryStore = new Map();

// Initialize disk storage directory
function initDiskStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      for (const [key, value] of Object.entries(parsed)) {
        if (value && value.expiresAt > Date.now()) {
          memoryStore.set(key, value);
        }
      }
      logger.info(`📂 Loaded ${memoryStore.size} persistent session(s) from disk.`);
    }
  } catch (err) {
    logger.warn('Disk session store init warning:', err.message);
  }
}

function persistToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const plainObj = {};
    for (const [key, value] of memoryStore.entries()) {
      if (value.expiresAt > Date.now()) {
        plainObj[key] = value;
      }
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(plainObj, null, 2), 'utf8');
  } catch (err) {
    logger.warn('Failed to persist session to disk:', err.message);
  }
}

// Initialize on startup
initDiskStore();

/**
 * Creates a stateless, encrypted session token (AES-256-GCM) lasting 14 days.
 * Contains user info and OAuth refresh tokens.
 * Survives container restarts, spin-downs, and redeployments!
 */
export function createEncryptedSession(data, ttlMs = FOURTEEN_DAYS_MS) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  const payload = JSON.stringify({
    tokens: data.tokens,
    user: data.user,
    iat: Date.now(),
    expiresAt: Date.now() + ttlMs,
  });

  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine iv (12 bytes) + tag (16 bytes) + encrypted payload
  const combined = Buffer.concat([iv, tag, encrypted]);
  const token = combined.toString('base64url');

  // Also cache in memory and disk for rapid lookups
  memoryStore.set(token, {
    ...data,
    expiresAt: Date.now() + ttlMs,
    updatedAt: Date.now(),
  });
  persistToDisk();

  return token;
}

/**
 * Decrypts and validates a session token.
 * Falls back to memory/disk store if passed as an ID.
 */
export function getSession(tokenString) {
  if (!tokenString || typeof tokenString !== 'string') return null;

  // 1. Try memory cache first
  const cached = memoryStore.get(tokenString);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  // 2. Stateless AES-256-GCM Decryption (works even after full server wipe/restart)
  try {
    const combined = Buffer.from(tokenString, 'base64url');
    if (combined.length >= 28) {
      const iv = combined.subarray(0, 12);
      const tag = combined.subarray(12, 28);
      const encrypted = combined.subarray(28);

      const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      const sessionData = JSON.parse(decrypted.toString('utf8'));

      if (sessionData && sessionData.expiresAt > Date.now()) {
        // Cache back into memory
        memoryStore.set(tokenString, sessionData);
        return sessionData;
      }
    }
  } catch (err) {
    // Not an encrypted token or corrupted
  }

  return null;
}

/**
 * Updates session tokens (e.g. after Google refresh token rotation)
 */
export function updateSessionTokens(tokenString, newTokens) {
  const existing = getSession(tokenString);
  if (!existing) return null;

  const updatedData = {
    ...existing,
    tokens: { ...existing.tokens, ...newTokens },
    updatedAt: Date.now(),
  };

  // Generate a fresh 14-day encrypted token with the new credentials
  const freshToken = createEncryptedSession(updatedData, FOURTEEN_DAYS_MS);

  // Update memory
  memoryStore.set(tokenString, updatedData);
  persistToDisk();

  return freshToken;
}

/**
 * Removes session on logout
 */
export function removeSession(tokenString) {
  if (tokenString) {
    memoryStore.delete(tokenString);
    persistToDisk();
  }
}
