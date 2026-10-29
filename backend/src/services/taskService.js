import { isMongoConnected } from '../db/mongodb.js';
import { Task } from '../models/Task.js';
import { Context } from '../models/Context.js';
import { db } from '../db/database.js';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

export async function getTasks(userId = 'default_user', filters = {}) {
  if (isMongoConnected()) {
    try {
      const query = {};
      if (filters.contextId) query.contextId = filters.contextId;
      if (filters.projectId) query.projectId = filters.projectId;
      if (filters.status) query.status = filters.status;
      if (filters.excludeWaiting) query.status = { $ne: 'waiting_for' };
      if (filters.waitingOnly) query.status = 'waiting_for';
      if (filters.dueDate) query.dueDate = filters.dueDate;

      const docs = await Task.find(query).sort({ createdAt: -1 }).lean();
      const contexts = await Context.find().lean();
      const contextMap = {};
      contexts.forEach(c => {
        contextMap[c._id.toString()] = c;
      });

      return docs.map(doc => {
        const ctx = contextMap[doc.contextId] || {};
        return {
          id: doc._id.toString(),
          userId: doc.userId,
          contextId: doc.contextId,
          context: {
            id: doc.contextId,
            name: ctx.name || 'General',
            color: ctx.color || '#3b82f6',
            icon: ctx.icon || 'briefcase',
          },
          projectId: doc.projectId || null,
          title: doc.title,
          description: doc.description || '',
          status: doc.status,
          waitingReason: doc.waitingReason || null,
          waitingSince: doc.waitingSince ? doc.waitingSince.toISOString() : null,
          priority: doc.priority || 'medium',
          estimatedMinutes: doc.estimatedMinutes || 30,
          dueDate: doc.dueDate || null,
          scheduledStart: doc.scheduledStart || null,
          scheduledEnd: doc.scheduledEnd || null,
          calendarEventId: doc.calendarEventId || null,
          source: doc.source || 'manual',
          xpValue: doc.xpValue || 25,
          completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
          createdAt: doc.createdAt ? doc.createdAt.toISOString() : null,
          updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : null,
        };
      });
    } catch (err) {
      logger.warn('Failed to query tasks from MongoDB, falling back to SQLite:', err.message);
    }
  }

  // SQLite Fallback
  let query = `
    SELECT t.*,
      c.name as context_name, c.color as context_color, c.icon as context_icon,
      p.name as project_name, p.color as project_color
    FROM tasks t
    LEFT JOIN contexts c ON t.context_id = c.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE 1=1
  `;
  const params = [];

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

export async function getTaskById(userId = 'default_user', id) {
  if (isMongoConnected()) {
    try {
      const doc = await Task.findById(id).lean();
      if (doc) {
        const ctx = await Context.findById(doc.contextId).lean();
        return {
          id: doc._id.toString(),
          userId: doc.userId,
          contextId: doc.contextId,
          context: {
            id: doc.contextId,
            name: ctx?.name || 'General',
            color: ctx?.color || '#3b82f6',
            icon: ctx?.icon || 'briefcase',
          },
          projectId: doc.projectId || null,
          title: doc.title,
          description: doc.description || '',
          status: doc.status,
          waitingReason: doc.waitingReason || null,
          waitingSince: doc.waitingSince ? doc.waitingSince.toISOString() : null,
          priority: doc.priority || 'medium',
          estimatedMinutes: doc.estimatedMinutes || 30,
          dueDate: doc.dueDate || null,
          scheduledStart: doc.scheduledStart || null,
          scheduledEnd: doc.scheduledEnd || null,
          calendarEventId: doc.calendarEventId || null,
          source: doc.source || 'manual',
          xpValue: doc.xpValue || 25,
          completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
          createdAt: doc.createdAt ? doc.createdAt.toISOString() : null,
          updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : null,
        };
      }
    } catch {}
  }

  const row = db.prepare(`
    SELECT t.*,
      c.name as context_name, c.color as context_color, c.icon as context_icon,
      p.name as project_name, p.color as project_color
    FROM tasks t
    LEFT JOIN contexts c ON t.context_id = c.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `).get(id);

  return row ? mapTaskRow(row) : null;
}

export async function createTask(userId = 'default_user', data) {
  const status = data.status || 'todo';
  const now = new Date();
  const waitingSince = status === 'waiting_for' ? now : null;
  const waitingReason = status === 'waiting_for' ? (data.waitingReason || 'Awaiting external approval') : null;

  if (isMongoConnected()) {
    try {
      const doc = await Task.create({
        userId,
        contextId: data.contextId,
        projectId: data.projectId || null,
        title: data.title.trim(),
        description: data.description || '',
        status,
        waitingReason,
        waitingSince,
        priority: data.priority || 'medium',
        estimatedMinutes: data.estimatedMinutes || 30,
        dueDate: data.dueDate || null,
        scheduledStart: data.scheduledStart || null,
        scheduledEnd: data.scheduledEnd || null,
        source: data.source || 'manual',
        xpValue: data.xpValue || 25,
      });

      return getTaskById(userId, doc._id.toString());
    } catch (err) {
      logger.warn('Failed to insert task into MongoDB, falling back to SQLite:', err.message);
    }
  }

  // SQLite Fallback
  const id = `tsk-${randomUUID()}`;
  const nowIso = now.toISOString();

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
    waitingSince ? nowIso : null,
    data.priority || 'medium',
    data.estimatedMinutes || 30,
    data.dueDate || null,
    data.scheduledStart || null,
    data.scheduledEnd || null,
    data.source || 'manual',
    null,
    null,
    data.xpValue || 25,
    data.energyCost || 1,
    status === 'done' ? nowIso : null,
    nowIso,
    nowIso
  );

  return getTaskById(userId, id);
}

export async function updateTask(userId = 'default_user', id, data) {
  const existing = await getTaskById(userId, id);
  if (!existing) return null;

  const status = data.status !== undefined ? data.status : existing.status;
  const now = new Date();
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
    completedAt = null;
    waitingReason = null;
    waitingSince = null;
  }

  if (isMongoConnected()) {
    try {
      const updatePayload = {
        status,
        waitingReason,
        waitingSince,
        completedAt,
      };

      if (data.contextId !== undefined) updatePayload.contextId = data.contextId;
      if (data.projectId !== undefined) updatePayload.projectId = data.projectId;
      if (data.title !== undefined) updatePayload.title = data.title.trim();
      if (data.description !== undefined) updatePayload.description = data.description;
      if (data.priority !== undefined) updatePayload.priority = data.priority;
      if (data.estimatedMinutes !== undefined) updatePayload.estimatedMinutes = data.estimatedMinutes;
      if (data.dueDate !== undefined) updatePayload.dueDate = data.dueDate;
      if (data.scheduledStart !== undefined) updatePayload.scheduledStart = data.scheduledStart;
      if (data.scheduledEnd !== undefined) updatePayload.scheduledEnd = data.scheduledEnd;

      await Task.findByIdAndUpdate(id, { $set: updatePayload });
      return getTaskById(userId, id);
    } catch {}
  }

  // SQLite Fallback
  const nowIso = now.toISOString();
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
    WHERE id = ?
  `).run(
    data.contextId !== undefined ? data.contextId : existing.contextId,
    data.projectId !== undefined ? data.projectId : existing.projectId,
    data.title !== undefined ? data.title.trim() : existing.title,
    data.description !== undefined ? data.description : existing.description,
    status,
    waitingReason,
    waitingSince ? (typeof waitingSince === 'string' ? waitingSince : waitingSince.toISOString()) : null,
    data.priority !== undefined ? data.priority : existing.priority,
    data.estimatedMinutes !== undefined ? data.estimatedMinutes : existing.estimatedMinutes,
    data.dueDate !== undefined ? data.dueDate : existing.dueDate,
    data.scheduledStart !== undefined ? data.scheduledStart : existing.scheduledStart,
    data.scheduledEnd !== undefined ? data.scheduledEnd : existing.scheduledEnd,
    completedAt ? (typeof completedAt === 'string' ? completedAt : completedAt.toISOString()) : null,
    nowIso,
    id
  );

  return getTaskById(userId, id);
}

export async function setTaskStatus(userId = 'default_user', id, newStatus, waitingReason = null) {
  return updateTask(userId, id, { status: newStatus, waitingReason });
}

export async function deleteTask(userId = 'default_user', id) {
  if (isMongoConnected()) {
    try {
      const res = await Task.findByIdAndDelete(id);
      if (res) return true;
    } catch {}
  }

  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
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
    xpValue: row.xp_value,
    energyCost: row.energy_cost,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
