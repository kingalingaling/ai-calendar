import { Router } from 'express';
import * as taskController from '../controllers/taskController.js';

const router = Router();

router.get('/', taskController.getTasks);
router.get('/:id', taskController.getTaskById);
router.post('/', taskController.createTask);
router.put('/:id', taskController.updateTask);
router.patch('/:id/status', taskController.setTaskStatus);
router.delete('/:id', taskController.deleteTask);

export default router;
