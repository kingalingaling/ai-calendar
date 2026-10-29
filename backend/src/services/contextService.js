import { isMongoConnected } from '../db/mongodb.js';
import { Context } from '../models/Context.js';
import { Task } from '../models/Task.js';
import { db, seedDefaultContextsIfEmpty } from '../db/database.js';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

/**
 * Pulls jobs/contexts.
 * When MongoDB is connected, pulls directly from MongoDB collection `contexts`.
 * Any rename, addition, or deletion made directly in MongoDB takes effect immediately!
 */
export async function getContexts(userId = 'default_user') {
  if (isMongoConnected()) {
    try {
      const docs = await Context.find().sort({ sortOrder: 1, createdAt: 1 }).lean();
      
      // Compute task counts for each context
      const contextsWithCounts = await Promise.all(
        docs.map(async (ctx) => {
          const ctxId = ctx._id.toString();
          const activeCount = await Task.countDocuments({
            contextId: ctxId,
            status: { $ne: 'done' },
          });
          const waitingCount = await Task.countDocuments({
            contextId: ctxId,
            status: 'waiting_for',
          });

          return {
            id: ctxId,
            userId: ctx.userId || userId,
            name: ctx.name,
            color: ctx.color || '#3b82f6',
            icon: ctx.icon || 'briefcase',
            isDefault: Boolean(ctx.isDefault),
            workingHours: ctx.workingHours || { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] },
            activeTaskCount: activeCount,
            waitingTaskCount: waitingCount,
            createdAt: ctx.createdAt,
            updatedAt: ctx.updatedAt,
          };
        })
      );

      return contextsWithCounts;
    } catch (err) {
      logger.warn('Failed to fetch contexts from MongoDB, falling back to SQLite:', err.message);
    }
  }

  // SQLite Fallback
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

export async function createContext(userId = 'default_user', data) {
  if (isMongoConnected()) {
    try {
      const workingHours = typeof data.workingHours === 'object'
        ? data.workingHours
        : { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] };

      const doc = await Context.create({
        name: data.name.trim(),
        color: data.color || '#3b82f6',
        icon: data.icon || 'briefcase',
        isDefault: Boolean(data.isDefault),
        workingHours,
        sortOrder: data.sortOrder || 0,
      });

      return {
        id: doc._id.toString(),
        userId,
        name: doc.name,
        color: doc.color,
        icon: doc.icon,
        isDefault: Boolean(doc.isDefault),
        workingHours: doc.workingHours,
        activeTaskCount: 0,
        waitingTaskCount: 0,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    } catch (err) {
      logger.warn('Failed to create context in MongoDB, falling back to SQLite:', err.message);
    }
  }

  // SQLite Fallback
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

export async function getContextById(userId = 'default_user', id) {
  if (!id) {
    id = userId;
    userId = 'default_user';
  }

  if (isMongoConnected()) {
    try {
      const doc = await Context.findById(id).lean();
      if (doc) {
        return {
          id: doc._id.toString(),
          userId,
          name: doc.name,
          color: doc.color,
          icon: doc.icon,
          isDefault: Boolean(doc.isDefault),
          workingHours: doc.workingHours,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        };
      }
    } catch {
      // If invalid ObjectId or not found, fall back to SQLite
    }
  }

  const ctx = db.prepare('SELECT * FROM contexts WHERE id = ?').get(id);
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

/**
 * Updates/renames a job.
 * If user renames in MongoDB, it takes effect; if they rename via API, it updates MongoDB!
 */
export async function updateContext(userId = 'default_user', id, data) {
  if (typeof id === 'object' && data === undefined) {
    data = id;
    id = userId;
    userId = 'default_user';
  }

  if (isMongoConnected()) {
    try {
      const updatePayload = {};
      if (data.name !== undefined) updatePayload.name = data.name.trim();
      if (data.color !== undefined) updatePayload.color = data.color;
      if (data.icon !== undefined) updatePayload.icon = data.icon;
      if (data.isDefault !== undefined) updatePayload.isDefault = Boolean(data.isDefault);
      if (data.workingHours !== undefined) updatePayload.workingHours = data.workingHours;

      const doc = await Context.findByIdAndUpdate(id, { $set: updatePayload }, { new: true }).lean();
      if (doc) {
        return {
          id: doc._id.toString(),
          userId,
          name: doc.name,
          color: doc.color,
          icon: doc.icon,
          isDefault: Boolean(doc.isDefault),
          workingHours: doc.workingHours,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        };
      }
    } catch (err) {
      logger.warn('Failed to update context in MongoDB, falling back to SQLite:', err.message);
    }
  }

  // SQLite Fallback
  const now = new Date().toISOString();
  const existing = await getContextById(userId, id);
  if (!existing) return null;

  const workingHours = data.workingHours
    ? (typeof data.workingHours === 'object' ? JSON.stringify(data.workingHours) : data.workingHours)
    : JSON.stringify(existing.workingHours);

  db.prepare(`
    UPDATE contexts
    SET name = ?, color = ?, icon = ?, working_hours = ?, updated_at = ?
    WHERE id = ?
  `).run(
    data.name !== undefined ? data.name.trim() : existing.name,
    data.color !== undefined ? data.color : existing.color,
    data.icon !== undefined ? data.icon : existing.icon,
    workingHours,
    now,
    id
  );

  return getContextById(userId, id);
}

export async function deleteContext(userId = 'default_user', id) {
  if (!id) {
    id = userId;
    userId = 'default_user';
  }

  if (isMongoConnected()) {
    try {
      const res = await Context.findByIdAndDelete(id);
      if (res) {
        // Also remove or clean up associated tasks
        await Task.deleteMany({ contextId: id });
        return true;
      }
    } catch (err) {
      logger.warn('Failed to delete context in MongoDB, falling back to SQLite:', err.message);
    }
  }

  const result = db.prepare('DELETE FROM contexts WHERE id = ?').run(id);
  return result.changes > 0;
}
