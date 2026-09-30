import { Router } from 'express';
import { getAgenda, updateEvent, deleteEvent } from '../controllers/agendaController.js';

const router = Router();

router.get('/', getAgenda);
router.patch('/events/:id', updateEvent);
router.delete('/events/:id', deleteEvent);

export default router;
