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
  },
  {
    id: 'demo-lunch-02',
    summary: 'Lunch & Recharge',
    description: 'Break',
    start: { dateTime: '2026-10-01T12:30:00+01:00', timeZone: TIMEZONE },
    end: { dateTime: '2026-10-01T13:30:00+01:00', timeZone: TIMEZONE },
    colorId: '5',
    htmlLink: 'https://calendar.google.com',
  },
];

/**
 * Returns Google Calendar client or null if in demo mode
 */
function getClient(authClient) {
  if (!authClient) return null;
  return google.calendar({ version: 'v3', auth: authClient });
}

/**
 * Lists events for a given time window in Africa/Lagos
 */
export async function listCalendarEvents(authClient, timeMin, timeMax) {
  const calendar = getClient(authClient);

  if (!calendar) {
    logger.info('📱 [Demo Mode] Returning in-memory demo calendar events.');
    return mockCalendarEvents.filter(ev => {
      const evStart = ev.start.dateTime || ev.start.date;
      const evEnd = ev.end.dateTime || ev.end.date;
      return evEnd >= timeMin && evStart <= timeMax;
    });
  }

  try {
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      timeZone: TIMEZONE,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return res.data.items || [];
  } catch (err) {
    logger.error('Failed to fetch events from Google Calendar:', err.message);
    throw err;
  }
}

/**
 * Inserts a single event into Google Calendar
 */
export async function insertCalendarEvent(authClient, eventData) {
  const calendar = getClient(authClient);

  const payload = {
    summary: eventData.summary,
    description: eventData.description || '',
    location: eventData.location || '',
    colorId: eventData.colorId || '9',
    start: {
      dateTime: eventData.start_time || eventData.start,
      timeZone: TIMEZONE,
    },
    end: {
      dateTime: eventData.end_time || eventData.end,
      timeZone: TIMEZONE,
    },
    extendedProperties: {
      private: {
        aiScheduled: 'true',
        category: eventData.category || 'task',
        autoSuggested: String(eventData.auto_suggested_time || false),
        isSpillover: String(eventData.is_spillover || false),
      },
    },
  };

  if (!calendar) {
    const newDemoEvent = {
      id: `demo-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      ...payload,
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
 * Updates an event
 */
export async function updateCalendarEvent(authClient, eventId, eventData) {
  const calendar = getClient(authClient);

  if (!calendar) {
    const idx = mockCalendarEvents.findIndex(e => e.id === eventId);
    if (idx !== -1) {
      mockCalendarEvents[idx] = { ...mockCalendarEvents[idx], ...eventData };
      return mockCalendarEvents[idx];
    }
    throw new Error('Event not found in demo calendar');
  }

  const res = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody: eventData,
  });

  return res.data;
}

/**
 * Deletes an event
 */
export async function deleteCalendarEvent(authClient, eventId) {
  const calendar = getClient(authClient);

  if (!calendar) {
    mockCalendarEvents = mockCalendarEvents.filter(e => e.id !== eventId);
    return { success: true, id: eventId };
  }

  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
  });

  return { success: true, id: eventId };
}
