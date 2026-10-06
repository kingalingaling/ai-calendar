import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../.data');
const DB_PATH = path.join(DATA_DIR, 'app.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);

// Enable WAL mode & foreign keys for concurrency and integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initSchema() {
  db.exec(`
    -- Contexts / Workspaces (Job A, Job B, Side Projects, Personal)
    CREATE TABLE IF NOT EXISTS contexts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT DEFAULT 'briefcase',
      is_default INTEGER DEFAULT 0,
      working_hours TEXT DEFAULT '{"start":"09:00","end":"17:00","days":[1,2,3,4,5]}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_contexts_user ON contexts(user_id);

    -- Projects & Milestones (Supports hierarchical nesting)
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      context_id TEXT NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
      parent_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      milestone_date TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'on_hold', 'archived')),
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_projects_context ON projects(context_id);
    CREATE INDEX IF NOT EXISTS idx_projects_parent ON projects(parent_id);

    -- Tasks (Unified task model with Waiting For status and external tracking)
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      context_id TEXT NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'waiting_for', 'done')),
      waiting_reason TEXT,
      waiting_since TEXT,
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
      estimated_minutes INTEGER DEFAULT 30,
      due_date TEXT,
      scheduled_start TEXT,
      scheduled_end TEXT,
      calendar_event_id TEXT,
      source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'ai_brain_dump', 'google_sheets')),
      source_external_id TEXT,
      source_metadata TEXT,
      xp_value INTEGER DEFAULT 25,
      energy_cost INTEGER DEFAULT 1,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_tasks_context ON tasks(context_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_source_ext ON tasks(source, source_external_id);

    -- External Sync Sources (Google Sheets view-only readers)
    CREATE TABLE IF NOT EXISTS sheet_sources (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      context_id TEXT NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      spreadsheet_url TEXT NOT NULL,
      spreadsheet_id TEXT NOT NULL,
      sheet_name TEXT,
      gid TEXT DEFAULT '0',
      column_mapping TEXT NOT NULL,
      status_filter TEXT DEFAULT '[]',
      last_synced_at TEXT,
      last_sync_count INTEGER DEFAULT 0,
      auto_sync INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sheet_sources_user ON sheet_sources(user_id);

    -- Gamification Layer (XP, Levels, Consistency Streaks, Freezes, Badges)
    CREATE TABLE IF NOT EXISTS user_gamification (
      user_id TEXT PRIMARY KEY,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      streak_count INTEGER DEFAULT 0,
      best_streak INTEGER DEFAULT 0,
      last_active_date TEXT,
      streak_freezes_available INTEGER DEFAULT 2,
      unlocked_badges TEXT DEFAULT '[]',
      current_theme TEXT DEFAULT 'emerald',
      daily_stamina_max INTEGER DEFAULT 100,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS xp_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      task_id TEXT,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_xp_logs_user ON xp_logs(user_id);
  `);

  logger.info('🗄️ SQLite schema initialized successfully (Contexts, Projects, Tasks, Sheet Sources, Gamification).');
}

/**
 * Seeds default contexts (Job A, Job B, Side Projects, Personal) for a user if they have none.
 */
export function seedDefaultContextsIfEmpty(userId = 'default_user') {
  const existing = db.prepare('SELECT COUNT(*) as count FROM contexts WHERE user_id = ?').get(userId);
  if (existing.count === 0) {
    const now = new Date().toISOString();
    const defaults = [
      { id: `ctx-job-a-${Date.now()}`, name: 'Job A', color: '#3b82f6', icon: 'briefcase', isDefault: 1, hours: '{"start":"09:00","end":"13:00","days":[1,2,3,4,5]}' },
      { id: `ctx-job-b-${Date.now() + 1}`, name: 'Job B', color: '#8b5cf6', icon: 'laptop', isDefault: 0, hours: '{"start":"13:30","end":"17:30","days":[1,2,3,4,5]}' },
      { id: `ctx-side-proj-${Date.now() + 2}`, name: 'Side Projects', color: '#10b981', icon: 'sparkles', isDefault: 0, hours: '{"start":"18:00","end":"20:00","days":[1,2,3,4,5]}' },
      { id: `ctx-personal-${Date.now() + 3}`, name: 'Personal', color: '#f59e0b', icon: 'user', isDefault: 0, hours: '{"start":"07:00","end":"22:00","days":[0,1,2,3,4,5,6]}' },
    ];

    const insertStmt = db.prepare(`
      INSERT INTO contexts (id, user_id, name, color, icon, is_default, working_hours, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const ctx of defaults) {
      insertStmt.run(ctx.id, userId, ctx.name, ctx.color, ctx.icon, ctx.isDefault, ctx.hours, now, now);
    }

    logger.info(`✨ Seeded 4 default contexts (Job A, Job B, Side Projects, Personal) for user ${userId}.`);
  }
}
