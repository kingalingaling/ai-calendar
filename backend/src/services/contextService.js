import { db, seedDefaultContextsIfEmpty } from '../db/database.js';
import { randomUUID } from 'crypto';

export function getContexts(userId) {
  seedDefaultContextsIfEmpty(userId);

  const contexts = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM tasks t WHERE t.context_id = c.id AND t.status != 'done') as active_task_count,
      (SELECT COUNT(*) FROM tasks t WHERE t.context_id = c.id AND t.status = 'waiting_for') as waiting_task_count
    FROM contexts c
    WHERE c.user_id = ?
    ORDER BY c.is_default DESC, c.name ASC
  `).all(userId);

  return contexts.map(ctx => ({
    id: ctx.id,
    userId: ctx.user_id,
    name: ctx.name,
    color: ctx.color,
    icon: ctx.icon,
    isDefault: Boolean(ctx.is_default),
    workingHours: JSON.parse(ctx.working_hours || '{}'),
    activeTaskCount: ctx.active_task_count,
    waitingTaskCount: ctx.waiting_task_count,
    createdAt: ctx.created_at,
    updatedAt: ctx.updated_at,
  }));
}

export function createContext(userId, data) {
  const id = `ctx-${randomUUID()}`;
  const now = new Date().toISOString();

  const workingHours = typeof data.workingHours === 'object'
    ? JSON.stringify(data.workingHours)
    : data.workingHours || '{"start":"09:00","end":"17:00","days":[1,2,3,4,5]}';

  db.prepare(`
    INSERT INTO contexts (id, user_id, name, color, icon, is_default, working_hours, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    data.name.trim(),
    data.color || '#3b82f6',
    data.icon || 'briefcase',
    data.isDefault ? 1 : 0,
    workingHours,
    now,
    now
  );

  return getContextById(userId, id);
}

export function getContextById(userId, id) {
  const ctx = db.prepare('SELECT * FROM contexts WHERE id = ? AND user_id = ?').get(id, userId);
  if (!ctx) return null;

  return {
    id: ctx.id,
    userId: ctx.user_id,
    name: ctx.name,
    color: ctx.color,
    icon: ctx.icon,
    isDefault: Boolean(ctx.is_default),
    workingHours: JSON.parse(ctx.working_hours || '{}'),
    createdAt: ctx.created_at,
    updatedAt: ctx.updated_at,
  };
}

export function updateContext(userId, id, data) {
  const now = new Date().toISOString();
  const existing = getContextById(userId, id);
  if (!existing) return null;

  const workingHours = data.workingHours
    ? (typeof data.workingHours === 'object' ? JSON.stringify(data.workingHours) : data.workingHours)
    : JSON.stringify(existing.workingHours);

  db.prepare(`
    UPDATE contexts
    SET name = ?, color = ?, icon = ?, working_hours = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(
    data.name !== undefined ? data.name.trim() : existing.name,
    data.color !== undefined ? data.color : existing.color,
    data.icon !== undefined ? data.icon : existing.icon,
    workingHours,
    now,
    id,
    userId
  );

  return getContextById(userId, id);
}

export function deleteContext(userId, id) {
  const result = db.prepare('DELETE FROM contexts WHERE id = ? AND user_id = ?').run(id, userId);
  return result.changes > 0;
}
