import * as taskService from '../services/taskService.js';

function getUserId(req) {
  return req.user?.id || 'default_user';
}

export function getTasks(req, res, next) {
  try {
    const userId = getUserId(req);
    const { contextId, projectId, status, excludeWaiting, waitingOnly, dueDate } = req.query;

    const tasks = taskService.getTasks(userId, {
      contextId,
      projectId,
      status,
      excludeWaiting: excludeWaiting === 'true',
      waitingOnly: waitingOnly === 'true',
      dueDate,
    });

    res.json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (err) {
    next(err);
  }
}

export function getTaskById(req, res, next) {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const task = taskService.getTaskById(userId, id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    res.json({ success: true, task });
  } catch (err) {
    next(err);
  }
}

export function createTask(req, res, next) {
  try {
    const userId = getUserId(req);
    const {
      contextId,
      projectId,
      title,
      description,
      status,
      waitingReason,
      priority,
      estimatedMinutes,
      dueDate,
      scheduledStart,
      scheduledEnd,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required.' });
    }
    if (!contextId) {
      return res.status(400).json({ error: 'contextId is required.' });
    }

    const created = taskService.createTask(userId, {
      contextId,
      projectId,
      title,
      description,
      status,
      waitingReason,
      priority,
      estimatedMinutes,
      dueDate,
      scheduledStart,
      scheduledEnd,
    });

    res.status(201).json({ success: true, task: created });
  } catch (err) {
    next(err);
  }
}

export async function updateTask(req, res, next) {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const updated = taskService.updateTask(userId, id, req.body);

    if (!updated) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    let gamification = null;
    if (updated.status === 'done') {
      try {
        const { recordTaskCompletion } = await import('../services/gamificationService.js');
        gamification = recordTaskCompletion(userId, updated);
      } catch (gErr) {
        // Log silently
      }
    }

    res.json({ success: true, task: updated, gamification });
  } catch (err) {
    next(err);
  }
}

export async function setTaskStatus(req, res, next) {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { status, waitingReason } = req.body;

    if (!status || !['todo', 'in_progress', 'waiting_for', 'done'].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Allowed values: 'todo', 'in_progress', 'waiting_for', 'done'." });
    }

    const updated = taskService.setTaskStatus(userId, id, status, waitingReason);

    if (!updated) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    let gamification = null;
    if (updated.status === 'done') {
      try {
        const { recordTaskCompletion } = await import('../services/gamificationService.js');
        gamification = recordTaskCompletion(userId, updated);
      } catch (gErr) {
        // Log silently
      }
    }

    res.json({ success: true, task: updated, gamification });
  } catch (err) {
    next(err);
  }
}

export function deleteTask(req, res, next) {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const success = taskService.deleteTask(userId, id);

    if (!success) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    res.json({ success: true, message: 'Task deleted successfully.' });
  } catch (err) {
    next(err);
  }
}
