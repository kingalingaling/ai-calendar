import { db } from '../db/database.js';
import { randomUUID } from 'crypto';

export function getProjects(userId, contextId = null) {
  let query = "SELECT p.*, (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'done') as active_task_count FROM projects p WHERE p.user_id = ?";
  const params = [userId];

  if (contextId) {
    query += ' AND p.context_id = ?';
    params.push(contextId);
  }

  query += ' ORDER BY p.sort_order ASC, p.created_at ASC';

  const rows = db.prepare(query).all(...params);

  // Build hierarchical project tree
  const projectMap = new Map();
  const rootProjects = [];

  for (const row of rows) {
    const item = {
      id: row.id,
      userId: row.user_id,
      contextId: row.context_id,
      parentId: row.parent_id,
      name: row.name,
      description: row.description,
      color: row.color,
      milestoneDate: row.milestone_date,
      status: row.status,
      sortOrder: row.sort_order,
      activeTaskCount: row.active_task_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      subProjects: [],
    };
    projectMap.set(item.id, item);
  }

  for (const item of projectMap.values()) {
    if (item.parentId && projectMap.has(item.parentId)) {
      projectMap.get(item.parentId).subProjects.push(item);
    } else {
      rootProjects.push(item);
    }
  }

  return rootProjects;
}

export function createProject(userId, data) {
  const id = `prj-${randomUUID()}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO projects (id, user_id, context_id, parent_id, name, description, color, milestone_date, status, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    data.contextId,
    data.parentId || null,
    data.name.trim(),
    data.description || '',
    data.color || null,
    data.milestoneDate || null,
    data.status || 'active',
    data.sortOrder || 0,
    now,
    now
  );

  return getProjectById(userId, id);
}

export function getProjectById(userId, id) {
  const row = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    contextId: row.context_id,
    parentId: row.parent_id,
    name: row.name,
    description: row.description,
    color: row.color,
    milestoneDate: row.milestone_date,
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function updateProject(userId, id, data) {
  const now = new Date().toISOString();
  const existing = getProjectById(userId, id);
  if (!existing) return null;

  db.prepare(`
    UPDATE projects
    SET name = ?, description = ?, color = ?, milestone_date = ?, status = ?, parent_id = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(
    data.name !== undefined ? data.name.trim() : existing.name,
    data.description !== undefined ? data.description : existing.description,
    data.color !== undefined ? data.color : existing.color,
    data.milestoneDate !== undefined ? data.milestoneDate : existing.milestoneDate,
    data.status !== undefined ? data.status : existing.status,
    data.parentId !== undefined ? data.parentId : existing.parentId,
    now,
    id,
    userId
  );

  return getProjectById(userId, id);
}

export function deleteProject(userId, id) {
  const result = db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(id, userId);
  return result.changes > 0;
}
