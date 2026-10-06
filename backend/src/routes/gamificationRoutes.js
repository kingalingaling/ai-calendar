import { Router } from 'express';
import * as gamificationController from '../controllers/gamificationController.js';

const router = Router();

router.get('/stats', gamificationController.getGamificationStats);
router.post('/theme', gamificationController.switchTheme);

export default router;
