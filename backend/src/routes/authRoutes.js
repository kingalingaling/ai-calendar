import { Router } from 'express';
import { getAuthUrl, handleGoogleCallback, getCurrentUser, logout } from '../controllers/authController.js';

const router = Router();

router.get('/google/url', getAuthUrl);
router.get('/google/callback', handleGoogleCallback);
router.get('/me', getCurrentUser);
router.post('/logout', logout);

export default router;
