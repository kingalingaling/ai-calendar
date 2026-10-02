import { Router } from 'express';
import { getAgenda, updateEvent, deleteEvent, toggleComplete } from '../controllers/agendaController.js';

const router = Router();

router.get('/', getAgenda);
router.patch('/items/:id/toggle', toggleComplete);
router.patch('/events/:id', updateEvent);
router.delete('/events/:id', deleteEvent);

export default router;
