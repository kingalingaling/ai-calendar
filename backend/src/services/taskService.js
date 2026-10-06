import { db } from '../db/database.js';
import { randomUUID } from 'crypto';

export function getTasks(userId, filters = {}) {
  let query = `
    SELECT t.*,
      c.name as context_name, c.color as context_color, c.icon as context_icon,
      p.name as project_name, p.color as project_color
    FROM tasks t
    LEFT JOIN contexts c ON t.context_id = c.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.user_id = ?
  `;
  const params = [userId];

  if (filters.contextId) {
    query += ' AND t.context_id = ?';
    params.push(filters.contextId);
  }

  if (filters.projectId) {
    query += ' AND t.project_id = ?';
    params.push(filters.projectId);
  }

  if (filters.status) {
    query += ' AND t.status = ?';
    params.push(filters.status);
  }

  // User specifically requested: Filter out tasks blocked by external approvals (like boss reviews) from active daily views
  if (filters.excludeWaiting) {
    query += " AND t.status != 'waiting_for'";
  }

  if (filters.waitingOnly) {
    query += " AND t.status = 'waiting_for'";
  }

  if (filters.dueDate) {
    query += ' AND t.due_date = ?';
    params.push(filters.dueDate);
  }

  query += " ORDER BY CASE t.status WHEN 'in_progress' THEN 1 WHEN 'todo' THEN 2 WHEN 'waiting_for' THEN 3 ELSE 4 END, t.created_at DESC";

  const rows = db.prepare(query).all(...params);

  return rows.map(mapTaskRow);
}

export function getTaskById(userId, id) {
  const row = db.prepare(`
    SELECT t.*,
      c.name as context_name, c.color as context_color, c.icon as context_icon,
      p.name as project_name, p.color as project_color
    FROM tasks t
    LEFT JOIN contexts c ON t.context_id = c.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = ? AND t.user_id = ?
  `).get(id, userId);

  return row ? mapTaskRow(row) : null;
}

export function createTask(userId, data) {
  const id = `tsk-${randomUUID()}`;
  const now = new Date().toISOString();

  const status = data.status || 'todo';
  const waitingSince = status === 'waiting_for' ? now : null;
  const waitingReason = status === 'waiting_for' ? (data.waitingReason || 'Awaiting external approval') : null;

  db.prepare(`
    INSERT INTO tasks (
      id, user_id, context_id, project_id, title, description, status,
      waiting_reason, waiting_since, priority, estimated_minutes, due_date,
      scheduled_start, scheduled_end, source, source_external_id, source_metadata,
      xp_value, energy_cost, completed_at, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    data.contextId,
    data.projectId || null,
    data.title.trim(),
    data.description || '',
    status,
    waitingReason,
    waitingSince,
    data.priority || 'medium',
    data.estimatedMinutes || 30,
    data.dueDate || null,
    data.scheduledStart || null,
    data.scheduledEnd || null,
    data.source || 'manual',
    data.sourceExternalId || null,
    data.sourceMetadata ? JSON.stringify(data.sourceMetadata) : null,
    data.xpValue || 25,
    data.energyCost || 1,
    status === 'done' ? now : null,
    now,
    now
  );

  return getTaskById(userId, id);
}

export function updateTask(userId, id, data) {
  const now = new Date().toISOString();
  const existing = getTaskById(userId, id);
  if (!existing) return null;

  const status = data.status !== undefined ? data.status : existing.status;
  let waitingReason = existing.waitingReason;
  let waitingSince = existing.waitingSince;
  let completedAt = existing.completedAt;

  if (status === 'waiting_for') {
    waitingReason = data.waitingReason !== undefined ? data.waitingReason : (existing.waitingReason || 'Awaiting external review');
    if (existing.status !== 'waiting_for') {
      waitingSince = now;
    }
  } else if (status === 'done') {
    completedAt = existing.completedAt || now;
    waitingReason = null;
    waitingSince = null;
  } else {
    // Return to todo or in_progress
    completedAt = null;
    waitingReason = null;
    waitingSince = null;
  }

  db.prepare(`
    UPDATE tasks
    SET
      context_id = ?,
      project_id = ?,
      title = ?,
      description = ?,
      status = ?,
      waiting_reason = ?,
      waiting_since = ?,
      priority = ?,
      estimated_minutes = ?,
      due_date = ?,
      scheduled_start = ?,
      scheduled_end = ?,
      completed_at = ?,
      updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(
    data.contextId !== undefined ? data.contextId : existing.contextId,
    data.projectId !== undefined ? data.projectId : existing.projectId,
    data.title !== undefined ? data.title.trim() : existing.title,
    data.description !== undefined ? data.description : existing.description,
    status,
    waitingReason,
    waitingSince,
    data.priority !== undefined ? data.priority : existing.priority,
    data.estimatedMinutes !== undefined ? data.estimatedMinutes : existing.estimatedMinutes,
    data.dueDate !== undefined ? data.dueDate : existing.dueDate,
    data.scheduledStart !== undefined ? data.scheduledStart : existing.scheduledStart,
    data.scheduledEnd !== undefined ? data.scheduledEnd : existing.scheduledEnd,
    completedAt,
    now,
    id,
    userId
  );

  return getTaskById(userId, id);
}

export function setTaskStatus(userId, id, newStatus, waitingReason = null) {
  return updateTask(userId, id, { status: newStatus, waitingReason });
}

export function deleteTask(userId, id) {
  const result = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(id, userId);
  return result.changes > 0;
}

function mapTaskRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    contextId: row.context_id,
    context: {
      id: row.context_id,
      name: row.context_name,
      color: row.context_color,
      icon: row.context_icon,
    },
    projectId: row.project_id,
    project: row.project_id ? {
      id: row.project_id,
      name: row.project_name,
      color: row.project_color,
    } : null,
    title: row.title,
    description: row.description,
    status: row.status,
    waitingReason: row.waiting_reason,
    waitingSince: row.waiting_since,
    priority: row.priority,
    estimatedMinutes: row.estimated_minutes,
    dueDate: row.due_date,
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    calendarEventId: row.calendar_event_id,
    source: row.source,
    sourceExternalId: row.source_external_id,
    xpValue: row.xp_value,
    energyCost: row.energy_cost,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
