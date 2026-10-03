import { createEncryptedSession, getSession, FOURTEEN_DAYS_MS } from '../src/config/sessionStore.js';

console.log('🧪 Testing 14-Day Stateless Encrypted Session Store...');

const mockSessionData = {
  tokens: {
    access_token: 'mock-access-token-12345',
    refresh_token: 'mock-refresh-token-67890',
    expiry_date: Date.now() + 3600000,
  },
  user: {
    id: 'user_123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/pic.jpg',
  },
};

// Test 1: Create encrypted token
const token = createEncryptedSession(mockSessionData, FOURTEEN_DAYS_MS);
console.assert(typeof token === 'string' && token.length > 50, 'Token must be a non-empty string');
console.log('✅ Token creation passed:', token.slice(0, 30) + '...');

// Test 2: Decrypt token
const retrieved = getSession(token);
console.assert(retrieved !== null, 'Session must be retrieved');
console.assert(retrieved.tokens.refresh_token === 'mock-refresh-token-67890', 'Refresh token must match');
console.assert(retrieved.user.email === 'test@example.com', 'User email must match');
console.log('✅ Session retrieval and decryption passed.');

// Test 3: Test expiration logic
const expiredToken = createEncryptedSession(mockSessionData, -1000); // Expired 1 second ago
const shouldBeNull = getSession(expiredToken);
console.assert(shouldBeNull === null, 'Expired token must return null');
console.log('✅ Expired token rejection passed.');

console.log('🎉 All 14-day session store tests passed!');
