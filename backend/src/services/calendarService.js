import { google } from 'googleapis';
import { TIMEZONE } from '../config/timezone.js';
import { logger } from '../utils/logger.js';

// In-memory mock store for unauthenticated/demo mode
let mockCalendarEvents = [
  {
    id: 'demo-standup-01',
    summary: 'Team Morning Standup',
    description: 'Daily team sync and blockers check',
    start: { dateTime: '2026-10-01T09:00:00+01:00', timeZone: TIMEZONE },
    end: { dateTime: '2026-10-01T09:30:00+01:00', timeZone: TIMEZONE },
    colorId: '1',
    htmlLink: 'https://calendar.google.com',
    entryType: 'event',
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 5 }] },
    extendedProperties: {
      private: {
        entryType: 'event',
        completed: 'false',
        aiScheduled: 'true',
        category: 'meeting_call',
      },
    },
  },
  {
    id: 'demo-task-02',
    summary: 'Review Q3 Financial Audit',
    description: 'Audit report review and variance analysis',
    start: { dateTime: '2026-10-01T10:00:00+01:00', timeZone: TIMEZONE },
    end: { dateTime: '2026-10-01T11:30:00+01:00', timeZone: TIMEZONE },
    colorId: '9',
    htmlLink: 'https://calendar.google.com',
    entryType: 'task',
    extendedProperties: {
      private: {
        entryType: 'task',
        completed: 'false',
        aiScheduled: 'true',
        category: 'deep_work',
      },
    },
  },
  {
    id: 'demo-lunch-03',
    summary: 'Lunch & Recharge',
    description: 'Break',
    start: { dateTime: '2026-10-01T12:30:00+01:00', timeZone: TIMEZONE },
    end: { dateTime: '2026-10-01T13:30:00+01:00', timeZone: TIMEZONE },
    colorId: '5',
    htmlLink: 'https://calendar.google.com',
    entryType: 'event',
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 5 }] },
    extendedProperties: {
      private: {
        entryType: 'event',
        completed: 'false',
        aiScheduled: 'false',
        category: 'break',
      },
    },
  },
];

/**
 * Returns Google Calendar client or null if in demo mode
 */
function getCalendarClient(authClient) {
  if (!authClient) return null;
  return google.calendar({ version: 'v3', auth: authClient });
}

/**
 * Returns Google Tasks client or null if in demo mode
 */
function getTasksClient(authClient) {
  if (!authClient) return null;
  return google.tasks({ version: 'v1', auth: authClient });
}

/**
 * Lists both events and native tasks for a given time window in Africa/Lagos
 */
export async function listCalendarEvents(authClient, timeMin, timeMax) {
  const calendar = getCalendarClient(authClient);
  const tasksClient = getTasksClient(authClient);

  if (!calendar) {
    logger.info('📱 [Demo Mode] Returning in-memory demo calendar events.');
    return mockCalendarEvents.filter(ev => {
      const evStart = ev.start?.dateTime || ev.start?.date;
      const evEnd = ev.end?.dateTime || ev.end?.date;
      return evEnd >= timeMin && evStart <= timeMax;
    });
  }

  const results = [];

  // 1. Fetch Calendar Events
  try {
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      timeZone: TIMEZONE,
      singleEvents: true,
      orderBy: 'startTime',
    });

    results.push(...(res.data.items || []));
  } catch (err) {
    logger.error('Failed to fetch events from Google Calendar:', err.message);
  }

  // 2. Fetch Native Google Tasks (which appear on the calendar)
  if (tasksClient) {
    try {
      const tasksRes = await tasksClient.tasks.list({
        tasklist: '@default',
        showCompleted: true,
        showHidden: true,
        dueMin: timeMin,
        dueMax: timeMax,
      });

      const nativeTasks = (tasksRes.data.items || []).map(t => ({
        id: t.id,
        summary: t.title || '(Untitled Task)',
        description: t.notes || '',
        start: { dateTime: t.due || timeMin, timeZone: TIMEZONE },
        end: { dateTime: t.due || timeMin, timeZone: TIMEZONE },
        colorId: '9',
        htmlLink: 'https://calendar.google.com',
        isNativeTask: true,
        entryType: 'task',
        completed: t.status === 'completed',
        extendedProperties: {
          private: {
            entryType: 'task',
            completed: String(t.status === 'completed'),
            aiScheduled: 'true',
          },
        },
      }));

      results.push(...nativeTasks);
    } catch (err) {
      logger.warn(`Google Tasks API list failed (${err.message}). Continuing with Calendar events.`);
    }
  }

  return results;
}

/**
 * Inserts a single event/task into Google Calendar
 * - Tasks: Created via Google Tasks API (or fallback with task properties)
 * - Events: Created with exact 5-minute reminder popup override
 */
export async function insertCalendarEvent(authClient, eventData) {
  const isTask = (eventData.entry_type || eventData.entryType) === 'task';
  const cleanSummary = eventData.summary || 'Untitled';
  const calendar = getCalendarClient(authClient);
  const tasksClient = getTasksClient(authClient);

  // 1. If it is a Task and Google Tasks API is available: Create actual native Google Task!
  if (isTask && tasksClient) {
    try {
      const taskDue = eventData.start_time || eventData.start || new Date().toISOString();
      const res = await tasksClient.tasks.insert({
        tasklist: '@default',
        requestBody: {
          title: cleanSummary,
          notes: eventData.description || '',
          due: taskDue,
          status: eventData.completed ? 'completed' : 'needsAction',
        },
      });

      logger.info(`✨ Created native Google Task on Calendar: "${cleanSummary}" (ID: ${res.data.id})`);
      return {
        id: res.data.id,
        summary: res.data.title,
        description: res.data.notes || '',
        start: { dateTime: taskDue, timeZone: TIMEZONE },
        end: { dateTime: taskDue, timeZone: TIMEZONE },
        entryType: 'task',
        isNativeTask: true,
        completed: res.data.status === 'completed',
        htmlLink: 'https://calendar.google.com',
      };
    } catch (err) {
      logger.warn(`Google Tasks API insert failed (${err.message}). Falling back to Calendar event representation.`);
    }
  }

  // 2. Standard Google Calendar Event (with 5-minute reminder override)
  const payload = {
    summary: cleanSummary,
    description: eventData.description || '',
    location: eventData.location || '',
    colorId: eventData.colorId || (isTask ? '9' : '1'),
    start: {
      dateTime: eventData.start_time || eventData.start,
      timeZone: TIMEZONE,
    },
    end: {
      dateTime: eventData.end_time || eventData.end,
      timeZone: TIMEZONE,
    },
    // Reminders set to exactly 5 minutes as requested!
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 5 },
      ],
    },
    extendedProperties: {
      private: {
        aiScheduled: 'true',
        entryType: isTask ? 'task' : 'event',
        completed: String(eventData.completed || false),
        category: eventData.category || (isTask ? 'deep_work' : 'meeting_call'),
        autoSuggested: String(eventData.auto_suggested_time || false),
        isSpillover: String(eventData.is_spillover || false),
      },
    },
  };

  if (!calendar) {
    const newDemoEvent = {
      id: `demo-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      ...payload,
      entryType: isTask ? 'task' : 'event',
      completed: Boolean(eventData.completed),
      htmlLink: 'https://calendar.google.com',
    };
    mockCalendarEvents.push(newDemoEvent);
    return newDemoEvent;
  }

  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: payload,
  });

  return res.data;
}

/**
 * Inserts multiple events in batch/sequence
 */
export async function batchInsertEvents(authClient, eventsList = []) {
  const created = [];
  for (const item of eventsList) {
    const res = await insertCalendarEvent(authClient, item);
    created.push(res);
  }
  return created;
}

/**
 * Toggles an item's completed status (handles native Google Tasks and Calendar events)
 */
export async function toggleItemComplete(authClient, itemId, forceStatus) {
  const calendar = getCalendarClient(authClient);
  const tasksClient = getTasksClient(authClient);

  if (!calendar) {
    const item = mockCalendarEvents.find(e => e.id === itemId);
    if (!item) throw new Error('Item not found in demo calendar');

    const currentCompleted = item.completed === true || item.extendedProperties?.private?.completed === 'true';
    const nextStatus = forceStatus !== undefined ? forceStatus : !currentCompleted;

    item.completed = nextStatus;
    if (!item.extendedProperties) item.extendedProperties = { private: {} };
    if (!item.extendedProperties.private) item.extendedProperties.private = {};

    item.extendedProperties.private.completed = String(nextStatus);
    item.extendedProperties.private.entryType = 'task';

    return {
      id: item.id,
      completed: nextStatus,
      entryType: 'task',
    };
  }

  // 1. Try toggling via Google Tasks API first
  if (tasksClient) {
    try {
      const currentTask = await tasksClient.tasks.get({
        tasklist: '@default',
        task: itemId,
      });

      const nextStatus = forceStatus !== undefined
        ? (forceStatus ? 'completed' : 'needsAction')
        : (currentTask.data.status === 'completed' ? 'needsAction' : 'completed');

      const patchRes = await tasksClient.tasks.patch({
        tasklist: '@default',
        task: itemId,
        requestBody: {
          status: nextStatus,
        },
      });

      return {
        id: patchRes.data.id,
        completed: patchRes.data.status === 'completed',
        entryType: 'task',
        isNativeTask: true,
      };
    } catch (e) {
      // Not a native task, proceed to Calendar event patch
    }
  }

  // 2. Toggle via Google Calendar event extended properties
  const existing = await calendar.events.get({
    calendarId: 'primary',
    eventId: itemId,
  });

  const priv = existing.data.extendedProperties?.private || {};
  const currentCompleted = priv.completed === 'true';
  const nextStatus = forceStatus !== undefined ? forceStatus : !currentCompleted;

  const updatedPriv = {
    ...priv,
    entryType: 'task',
    completed: String(nextStatus),
  };

  const res = await calendar.events.patch({
    calendarId: 'primary',
    eventId: itemId,
    requestBody: {
      extendedProperties: {
        private: updatedPriv,
      },
    },
  });

  return {
    id: res.data.id,
    completed: nextStatus,
    entryType: 'task',
  };
}

/**
 * Updates an event
 */
export async function updateCalendarEvent(authClient, eventId, eventData) {
  const calendar = getCalendarClient(authClient);

  if (!calendar) {
    const idx = mockCalendarEvents.findIndex(e => e.id === eventId);
    if (idx !== -1) {
      mockCalendarEvents[idx] = { ...mockCalendarEvents[idx], ...eventData };
      return mockCalendarEvents[idx];
    }
    throw new Error('Event not found in demo calendar');
  }

  // Enforce 5-minute reminder override on updates
  const requestBody = {
    ...eventData,
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: 5 }],
    },
  };

  const res = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody,
  });

  return res.data;
}

/**
 * Deletes an event or task
 */
export async function deleteCalendarEvent(authClient, eventId) {
  const calendar = getCalendarClient(authClient);
  const tasksClient = getTasksClient(authClient);

  if (!calendar) {
    mockCalendarEvents = mockCalendarEvents.filter(e => e.id !== eventId);
    return { success: true, id: eventId };
  }

  // Try deleting from Google Tasks first
  if (tasksClient) {
    try {
      await tasksClient.tasks.delete({
        tasklist: '@default',
        task: eventId,
      });
      return { success: true, id: eventId, isNativeTask: true };
    } catch (e) {
      // Not a task, proceed to calendar event delete
    }
  }

  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
  });

  return { success: true, id: eventId };
}
