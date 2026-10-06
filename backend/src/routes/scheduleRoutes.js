import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { parseSchedule, commitSchedule, rolloverTasks, autoBlockTasks, commitAutoTasks } from '../controllers/scheduleController.js';

const router = Router();

const scheduleRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { error: 'Too many scheduling requests. Please wait a moment.' },
});

router.post('/parse', scheduleRateLimiter, parseSchedule);
router.post('/commit', commitSchedule);
router.post('/rollover', rolloverTasks);
router.post('/auto-block', autoBlockTasks);
router.post('/commit-tasks', commitAutoTasks);

export default router;
