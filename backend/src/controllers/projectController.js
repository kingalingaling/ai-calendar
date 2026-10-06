import * as projectService from '../services/projectService.js';

function getUserId(req) {
  return req.user?.id || 'default_user';
}

export function getProjects(req, res, next) {
  try {
    const userId = getUserId(req);
    const { contextId } = req.query;
    const projects = projectService.getProjects(userId, contextId);
    res.json({ success: true, projects });
  } catch (err) {
    next(err);
  }
}

export function createProject(req, res, next) {
  try {
    const userId = getUserId(req);
    const { contextId, parentId, name, description, color, milestoneDate, status, sortOrder } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required.' });
    }
    if (!contextId) {
      return res.status(400).json({ error: 'contextId is required.' });
    }

    const created = projectService.createProject(userId, {
      contextId,
      parentId,
      name,
      description,
      color,
      milestoneDate,
      status,
      sortOrder,
    });

    res.status(201).json({ success: true, project: created });
  } catch (err) {
    next(err);
  }
}

export function updateProject(req, res, next) {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const updated = projectService.updateProject(userId, id, req.body);

    if (!updated) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    res.json({ success: true, project: updated });
  } catch (err) {
    next(err);
  }
}

export function deleteProject(req, res, next) {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const success = projectService.deleteProject(userId, id);

    if (!success) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    res.json({ success: true, message: 'Project deleted successfully.' });
  } catch (err) {
    next(err);
  }
}
