import * as contextService from '../services/contextService.js';

function getUserId(req) {
  return req.user?.id || 'default_user';
}

export function getContexts(req, res, next) {
  try {
    const userId = getUserId(req);
    const contexts = contextService.getContexts(userId);
    res.json({ success: true, contexts });
  } catch (err) {
    next(err);
  }
}

export function createContext(req, res, next) {
  try {
    const userId = getUserId(req);
    const { name, color, icon, workingHours, isDefault } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Context name is required.' });
    }

    const created = contextService.createContext(userId, {
      name,
      color,
      icon,
      workingHours,
      isDefault,
    });

    res.status(201).json({ success: true, context: created });
  } catch (err) {
    next(err);
  }
}

export function updateContext(req, res, next) {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const updated = contextService.updateContext(userId, id, req.body);

    if (!updated) {
      return res.status(404).json({ error: 'Context not found.' });
    }

    res.json({ success: true, context: updated });
  } catch (err) {
    next(err);
  }
}

export function deleteContext(req, res, next) {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const success = contextService.deleteContext(userId, id);

    if (!success) {
      return res.status(404).json({ error: 'Context not found.' });
    }

    res.json({ success: true, message: 'Context deleted successfully.' });
  } catch (err) {
    next(err);
  }
}
