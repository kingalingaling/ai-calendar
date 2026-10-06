import { Router } from 'express';
import * as contextController from '../controllers/contextController.js';

const router = Router();

router.get('/', contextController.getContexts);
router.post('/', contextController.createContext);
router.put('/:id', contextController.updateContext);
router.delete('/:id', contextController.deleteContext);

export default router;
