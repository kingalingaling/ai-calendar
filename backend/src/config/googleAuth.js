import { google } from 'googleapis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export function createBaseOAuth2Client() {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthorizationUrl() {
  const oauth2Client = createBaseOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: OAUTH_SCOPES,
  });
}

export async function exchangeCodeForTokens(code) {
  const oauth2Client = createBaseOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function fetchGoogleProfile(tokens) {
  const oauth2Client = createBaseOAuth2Client();
  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();
  return data;
}

export function createAuthenticatedClient(tokens, onTokenUpdate) {
  const oauth2Client = createBaseOAuth2Client();
  oauth2Client.setCredentials(tokens);

  if (onTokenUpdate) {
    oauth2Client.on('tokens', (newTokens) => {
      logger.info('🔄 Google OAuth tokens refreshed automatically.');
      onTokenUpdate({ ...tokens, ...newTokens });
    });
  }

  return oauth2Client;
}
