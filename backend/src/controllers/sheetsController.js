import * as sheetsService from '../services/sheetsService.js';

function getUserId(req) {
  return req.user?.id || 'default_user';
}

export async function previewSheet(req, res, next) {
  try {
    const { spreadsheetUrl, gid } = req.body;

    if (!spreadsheetUrl) {
      return res.status(400).json({ error: 'spreadsheetUrl is required.' });
    }

    const preview = await sheetsService.previewGoogleSheet({
      authClient: req.authClient,
      spreadsheetUrl,
      gid,
    });

    res.json({ success: true, ...preview });
  } catch (err) {
    next(err);
  }
}

export function createSource(req, res, next) {
  try {
    const userId = getUserId(req);
    const { contextId, projectId, name, spreadsheetUrl, sheetName, gid, columnMapping, statusFilter, autoSync } = req.body;

    if (!spreadsheetUrl || !name || !contextId) {
      return res.status(400).json({ error: 'spreadsheetUrl, name, and contextId are required.' });
    }

    const created = sheetsService.registerSheetSource(userId, {
      contextId,
      projectId,
      name,
      spreadsheetUrl,
      sheetName,
      gid,
      columnMapping,
      statusFilter,
      autoSync,
    });

    res.status(201).json({ success: true, source: created });
  } catch (err) {
    next(err);
  }
}

export function listSources(req, res, next) {
  try {
    const userId = getUserId(req);
    const sources = sheetsService.listSheetSources(userId);
    res.json({ success: true, sources });
  } catch (err) {
    next(err);
  }
}

export async function syncSource(req, res, next) {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const result = await sheetsService.syncSheetSource(userId, id, req.authClient);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export function deleteSource(req, res, next) {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const success = sheetsService.deleteSheetSource(userId, id);

    if (!success) {
      return res.status(404).json({ error: 'Sheet source not found.' });
    }

    res.json({ success: true, message: 'Sheet source deleted successfully.' });
  } catch (err) {
    next(err);
  }
}
