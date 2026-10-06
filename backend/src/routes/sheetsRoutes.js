import { Router } from 'express';
import * as sheetsController from '../controllers/sheetsController.js';

const router = Router();

router.post('/preview', sheetsController.previewSheet);
router.get('/sources', sheetsController.listSources);
router.post('/sources', sheetsController.createSource);
router.post('/sources/:id/sync', sheetsController.syncSource);
router.delete('/sources/:id', sheetsController.deleteSource);

export default router;
