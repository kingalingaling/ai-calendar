import { DateTime } from 'luxon';
import { TIMEZONE } from '../config/timezone.js';

export const ENERGY_WINDOWS = {
  MORNING_FOCUS: { startHour: 8.5, endHour: 12.5, category: 'deep_work', label: 'Morning High Focus' },
  LUNCH_BREAK: { startHour: 12.5, endHour: 13.5, category: 'break', label: 'Lunch & Recharge' },
  AFTERNOON_COLLAB: { startHour: 13.5, endHour: 16.5, category: 'meeting_call', label: 'Afternoon Collaborative' },
  TWILIGHT_WRAPUP: { startHour: 16.5, endHour: 18.5, category: 'health_fitness', label: 'Evening Fitness & Wrap-up' },
};

export const DEFAULT_WORKING_HOURS = {
  start: '08:30',
  end: '18:00',
};

/**
 * Infers task category and default duration in minutes when omitted by the user.
 */
export function inferTaskDetails(text = '') {
  const lower = text.toLowerCase();

  // Calls & quick syncs
  if (lower.match(/\b(call|phone|catch up|quick sync|check in|talk to|ring)\b/)) {
    return { category: 'meeting_call', durationMinutes: 25, colorId: '1' }; // Lavender
  }

  // Fitness & Health
  if (lower.match(/\b(gym|workout|run|jog|exercise|fitness|yoga|swim|walk)\b/)) {
    return { category: 'health_fitness', durationMinutes: 45, colorId: '2' }; // Sage (Green)
  }

  // Deep work / Creative / Strategy / Coding / Writing
  if (lower.match(/\b(code|build|write|draft|audit|deep work|focus|deck|slides|strategy|design|research|study)\b/)) {
    return { category: 'deep_work', durationMinutes: 90, colorId: '9' }; // Blueberry (Dark Blue)
  }

  // Admin / Reviews / Emails / Housekeeping
  if (lower.match(/\b(email|emails|review|pr|invoice|budget|clean|organize|pay|errand|grocery|buy)\b/)) {
    return { category: 'admin', durationMinutes: 30, colorId: '7' }; // Peacock (Cyan)
  }

  // Default fallback
  return { category: 'deep_work', durationMinutes: 45, colorId: '9' };
}

/**
 * Calculates available free intervals for a given date within working hours in Africa/Lagos
 */
export function calculateFreeIntervals(dateStr, existingEvents = [], workingHours = DEFAULT_WORKING_HOURS) {
  const [startH, startM] = workingHours.start.split(':').map(Number);
  const [endH, endM] = workingHours.end.split(':').map(Number);

  const dayStart = DateTime.fromISO(dateStr, { zone: TIMEZONE }).set({ hour: startH, minute: startM, second: 0, millisecond: 0 });
  const dayEnd = DateTime.fromISO(dateStr, { zone: TIMEZONE }).set({ hour: endH, minute: endM, second: 0, millisecond: 0 });

  // Map and sort existing events that fall on this day
  const busyRanges = existingEvents
    .map(event => {
      const startStr = event.start?.dateTime || event.start?.date;
      const endStr = event.end?.dateTime || event.end?.date;
      if (!startStr || !endStr) return null;
      return {
        start: DateTime.fromISO(startStr, { zone: TIMEZONE }),
        end: DateTime.fromISO(endStr, { zone: TIMEZONE }),
        summary: event.summary || 'Busy',
      };
    })
    .filter(Boolean)
    .filter(r => r.end > dayStart && r.start < dayEnd)
    .sort((a, b) => a.start.toMillis() - b.start.toMillis());

  let cursor = dayStart;
  const freeIntervals = [];

  for (const busy of busyRanges) {
    if (busy.end <= cursor) continue;

    if (busy.start > cursor) {
      const gapEnd = busy.start < dayEnd ? busy.start : dayEnd;
      const durationMins = gapEnd.diff(cursor, 'minutes').minutes;
      if (durationMins >= 15) { // Minimum usable gap: 15 mins
        freeIntervals.push({
          start: cursor.toISO(),
          end: gapEnd.toISO(),
          durationMins: Math.round(durationMins),
        });
      }
    }

    cursor = busy.end > cursor ? busy.end : cursor;
    if (cursor >= dayEnd) break;
  }

  if (cursor < dayEnd) {
    const durationMins = dayEnd.diff(cursor, 'minutes').minutes;
    if (durationMins >= 15) {
      freeIntervals.push({
        start: cursor.toISO(),
        end: dayEnd.toISO(),
        durationMins: Math.round(durationMins),
      });
    }
  }

  const totalFreeMinutes = freeIntervals.reduce((sum, item) => sum + item.durationMins, 0);

  return {
    date: dateStr,
    workingHoursStart: dayStart.toISO(),
    workingHoursEnd: dayEnd.toISO(),
    freeIntervals,
    totalFreeMinutes,
    totalFreeHours: (totalFreeMinutes / 60).toFixed(1),
  };
}
