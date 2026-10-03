import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { env } from './config/env.js';
import { attachAuth } from './middleware/authMiddleware.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import agendaRoutes from './routes/agendaRoutes.js';
import { logger } from './utils/logger.js';
import { TIMEZONE } from './config/timezone.js';

const app = express();

// Trust reverse proxy (for cookies/sessions when deployed behind Nginx or Cloud Run)
app.set('trust proxy', 1);

// CORS configuration for React Vite frontend
app.use(cors({
  origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  exposedHeaders: ['X-New-Token', 'x-new-token'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session management (stores Google OAuth tokens in session, 14 days lifespan)
app.use(session({
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
  },
}));

// Attach Google Auth client to request if logged in
app.use(attachAuth);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timezone: TIMEZONE,
    timestamp: new Date().toISOString(),
    geminiConfigured: Boolean(env.GEMINI_API_KEY),
    googleOAuthConfigured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  });
});

// Mount modular API routers
app.use('/api/auth', authRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/agenda', agendaRoutes);

// Global error handler
app.use(errorHandler);

const port = env.PORT || 5000;
app.listen(port, () => {
  logger.info(`🚀 AI Calendar Backend running on http://localhost:${port}`);
  logger.info(`⏰ Operating Timezone: ${TIMEZONE} (WAT, UTC+1)`);
  logger.info(`🤖 Gemini Model: ${env.GEMINI_MODEL}`);
});
