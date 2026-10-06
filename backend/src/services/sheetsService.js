import { google } from 'googleapis';
import { parse as parseCsv } from 'csv-parse/sync';
import { db } from '../db/database.js';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

/**
 * Extracts Spreadsheet ID and GID from any Google Sheets URL format
 */
export function parseSpreadsheetUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Spreadsheet URL is required.');
  }

  const cleanUrl = url.trim();

  // Pattern: https://docs.google.com/spreadsheets/d/{ID}/edit...
  const idMatch = cleanUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const spreadsheetId = idMatch ? idMatch[1] : cleanUrl;

  // Extract GID (tab ID)
  const gidMatch = cleanUrl.match(/[?#&]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  return { spreadsheetId, gid };
}

/**
 * Dual-Mode Engine to fetch raw rows from a view-only Google Sheet:
 * 1. Primary: Google Sheets API v4 using user's OAuth tokens
 * 2. Fallback: Google Sheets CSV export endpoint (works on any sheet with view-only link)
 */
export async function fetchRawSheetRows({ authClient, spreadsheetId, gid = '0', sheetName = null }) {
  // Method 1: Try Google Sheets API v4 if authenticated
  if (authClient) {
    try {
      const sheets = google.sheets({ version: 'v4', auth: authClient });
      let range = sheetName ? `'${sheetName}'!A1:Z1000` : 'A1:Z1000';

      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      if (res.data.values && res.data.values.length > 0) {
        logger.info(`📊 Fetched ${res.data.values.length} rows via Google Sheets API v4.`);
        const headers = res.data.values[0].map(h => String(h || '').trim());
        const dataRows = res.data.values.slice(1).map(row => {
          const rowObj = {};
          headers.forEach((header, idx) => {
            if (header) {
              rowObj[header] = String(row[idx] || '').trim();
            }
          });
          return rowObj;
        });

        return { headers, rows: dataRows };
      }
    } catch (err) {
      logger.warn(`Google Sheets API v4 fetch failed (${err.message}). Attempting CSV export fallback...`);
    }
  }

  // Method 2: CSV Export Fallback (Works on any sheet where user or public has view access)
  const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  logger.info(`📥 Fetching view-only Google Sheet via CSV fallback: ${exportUrl}`);

  const fetchRes = await fetch(exportUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AI-Calendar/1.0',
    },
  });

  if (!fetchRes.ok) {
    throw new Error(`Failed to read Google Sheet (${fetchRes.status} ${fetchRes.statusText}). Ensure you have view access or the link is shared.`);
  }

  const csvText = await fetchRes.text();
  const records = parseCsv(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  logger.info(`📊 Fetched ${records.length} rows via CSV export fallback.`);

  return { headers, rows: records };
}

/**
 * Preview Google Sheet structure to configure column mappings in the UI
 */
export async function previewGoogleSheet({ authClient, spreadsheetUrl, gid }) {
  const { spreadsheetId, gid: parsedGid } = parseSpreadsheetUrl(spreadsheetUrl);
  const activeGid = gid || parsedGid;

  const { headers, rows } = await fetchRawSheetRows({
    authClient,
    spreadsheetId,
    gid: activeGid,
  });

  return {
    spreadsheetId,
    gid: activeGid,
    headers,
    totalRows: rows.length,
    sampleRows: rows.slice(0, 5),
  };
}

/**
 * Register a new Google Sheets tracking source
 */
export function registerSheetSource(userId, data) {
  const { spreadsheetId, gid } = parseSpreadsheetUrl(data.spreadsheetUrl);
  const id = `src-${randomUUID()}`;
  const now = new Date().toISOString();

  const columnMapping = typeof data.columnMapping === 'object'
    ? JSON.stringify(data.columnMapping)
    : (data.columnMapping || '{}');

  const statusFilter = Array.isArray(data.statusFilter)
    ? JSON.stringify(data.statusFilter)
    : (data.statusFilter || '[]');

  db.prepare(`
    INSERT INTO sheet_sources (
      id, user_id, context_id, project_id, name, spreadsheet_url,
      spreadsheet_id, sheet_name, gid, column_mapping, status_filter,
      last_synced_at, last_sync_count, auto_sync, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    data.contextId,
    data.projectId || null,
    data.name.trim(),
    data.spreadsheetUrl.trim(),
    spreadsheetId,
    data.sheetName || null,
    gid || '0',
    columnMapping,
    statusFilter,
    null,
    0,
    data.autoSync !== undefined ? (data.autoSync ? 1 : 0) : 1,
    now,
    now
  );

  return getSheetSourceById(userId, id);
}

export function getSheetSourceById(userId, id) {
  const row = db.prepare(`
    SELECT s.*, c.name as context_name, c.color as context_color, p.name as project_name
    FROM sheet_sources s
    LEFT JOIN contexts c ON s.context_id = c.id
    LEFT JOIN projects p ON s.project_id = p.id
    WHERE s.id = ? AND s.user_id = ?
  `).get(id, userId);

  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    contextId: row.context_id,
    context: { id: row.context_id, name: row.context_name, color: row.context_color },
    projectId: row.project_id,
    project: row.project_id ? { id: row.project_id, name: row.project_name } : null,
    name: row.name,
    spreadsheetUrl: row.spreadsheet_url,
    spreadsheetId: row.spreadsheet_id,
    sheetName: row.sheet_name,
    gid: row.gid,
    columnMapping: JSON.parse(row.column_mapping || '{}'),
    statusFilter: JSON.parse(row.status_filter || '[]'),
    lastSyncedAt: row.last_synced_at,
    lastSyncCount: row.last_sync_count,
    autoSync: Boolean(row.auto_sync),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listSheetSources(userId) {
  const rows = db.prepare(`
    SELECT s.*, c.name as context_name, c.color as context_color, p.name as project_name
    FROM sheet_sources s
    LEFT JOIN contexts c ON s.context_id = c.id
    LEFT JOIN projects p ON s.project_id = p.id
    WHERE s.user_id = ?
    ORDER BY s.created_at DESC
  `).all(userId);

  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    contextId: row.context_id,
    context: { id: row.context_id, name: row.context_name, color: row.context_color },
    projectId: row.project_id,
    project: row.project_id ? { id: row.project_id, name: row.project_name } : null,
    name: row.name,
    spreadsheetUrl: row.spreadsheet_url,
    spreadsheetId: row.spreadsheet_id,
    sheetName: row.sheet_name,
    gid: row.gid,
    columnMapping: JSON.parse(row.column_mapping || '{}'),
    statusFilter: JSON.parse(row.status_filter || '[]'),
    lastSyncedAt: row.last_synced_at,
    lastSyncCount: row.last_sync_count,
    autoSync: Boolean(row.auto_sync),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function deleteSheetSource(userId, id) {
  const result = db.prepare('DELETE FROM sheet_sources WHERE id = ? AND user_id = ?').run(id, userId);
  return result.changes > 0;
}

/**
 * Executes ingestion sync pipeline from a Google Sheet source into Tasks table
 */
export async function syncSheetSource(userId, sourceId, authClient) {
  const source = getSheetSourceById(userId, sourceId);
  if (!source) throw new Error('Sheet source not found.');

  const { rows } = await fetchRawSheetRows({
    authClient,
    spreadsheetId: source.spreadsheetId,
    gid: source.gid,
    sheetName: source.sheetName,
  });

  const mapping = source.columnMapping || {};
  let ingestedCount = 0;
  const now = new Date().toISOString();

  const insertStmt = db.prepare(`
    INSERT INTO tasks (
      id, user_id, context_id, project_id, title, description, status,
      waiting_reason, waiting_since, priority, estimated_minutes, due_date,
      source, source_external_id, source_metadata, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'google_sheets', ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      status = excluded.status,
      waiting_reason = excluded.waiting_reason,
      priority = excluded.priority,
      due_date = excluded.due_date,
      updated_at = excluded.updated_at
  `);

  const selectExistingStmt = db.prepare(`
    SELECT id FROM tasks WHERE user_id = ? AND source = 'google_sheets' AND source_external_id = ?
  `);

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rawTitle = row[mapping.title || 'Task'] || row[mapping.title || 'Title'] || row['Task'] || row['Title'] || row['Name'];
    if (!rawTitle || rawTitle.trim().length === 0) continue;

    // Filter by Assignee / Owner (e.g. King)
    const assigneeCol = mapping.assignee || 'Assignee';
    const targetAssigneeFilter = mapping.assigneeFilter ? String(mapping.assigneeFilter).trim().toLowerCase() : null;
    if (targetAssigneeFilter) {
      const rowAssignee = String(row[assigneeCol] || row['Assignee'] || row['Owner'] || row['Assigned To'] || row['Who'] || '').trim().toLowerCase();
      if (!rowAssignee.includes(targetAssigneeFilter)) {
        continue; // Skip tasks assigned to other team members
      }
    }

    const rawStatus = (row[mapping.status || 'Status'] || '').toLowerCase();

    // Map sheet status to system status
    let status = 'todo';
    let waitingReason = null;
    let waitingSince = null;

    if (rawStatus.includes('waiting') || rawStatus.includes('review') || rawStatus.includes('blocked') || rawStatus.includes('approval') || rawStatus.includes('boss')) {
      status = 'waiting_for';
      waitingReason = row[mapping.waitingReason || 'Blocker'] || row[mapping.waitingReason || 'Waiting On'] || `Waiting on external review (${rawStatus})`;
      waitingSince = now;
    } else if (rawStatus.includes('done') || rawStatus.includes('complete') || rawStatus.includes('finished')) {
      status = 'done';
    } else if (rawStatus.includes('in progress') || rawStatus.includes('doing') || rawStatus.includes('active')) {
      status = 'in_progress';
    }

    const priorityRaw = (row[mapping.priority || 'Priority'] || 'medium').toLowerCase();
    const priority = ['urgent', 'high', 'low'].find(p => priorityRaw.includes(p)) || 'medium';

    const rawEstimate = parseInt(row[mapping.estimatedMinutes || 'Estimate'] || '30', 10);
    const estimatedMinutes = isNaN(rawEstimate) ? 30 : rawEstimate;

    const dueDate = row[mapping.dueDate || 'Due Date'] || row['Due'] || null;
    const description = row[mapping.description || 'Description'] || row['Notes'] || '';

    // Deterministic external ID based on spreadsheet ID + row number or unique title
    const externalId = `${source.spreadsheetId}_${source.gid}_row_${idx + 1}`;

    const existing = selectExistingStmt.get(userId, externalId);
    const taskId = existing ? existing.id : `tsk-sheet-${randomUUID()}`;

    insertStmt.run(
      taskId,
      userId,
      source.contextId,
      source.projectId,
      rawTitle.trim(),
      description,
      status,
      waitingReason,
      waitingSince,
      priority,
      estimatedMinutes,
      dueDate,
      externalId,
      JSON.stringify({ sheetSourceId: source.id, rowNumber: idx + 1 }),
      now,
      now
    );

    ingestedCount++;
  }

  // Update sheet source metadata
  db.prepare(`
    UPDATE sheet_sources
    SET last_synced_at = ?, last_sync_count = ?, updated_at = ?
    WHERE id = ?
  `).run(now, ingestedCount, now, source.id);

  logger.info(`✅ Successfully ingested ${ingestedCount} task(s) from sheet "${source.name}".`);

  return {
    sourceId: source.id,
    sourceName: source.name,
    syncedCount: ingestedCount,
    totalRows: rows.length,
    lastSyncedAt: now,
  };
}
