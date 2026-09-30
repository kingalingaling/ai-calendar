import { DateTime } from 'luxon';
import { env } from './env.js';

export const TIMEZONE = env.DEFAULT_TIMEZONE || 'Africa/Lagos';

/**
 * Returns the current DateTime in Africa/Lagos
 */
export function nowWAT() {
  return DateTime.now().setZone(TIMEZONE);
}

/**
 * Given a date string (YYYY-MM-DD or ISO), returns start and end of day in Africa/Lagos (WAT)
 * with explicit +01:00 offset strings required by Google Calendar API.
 */
export function getDayBoundsWAT(dateInput) {
  let dt;
  if (!dateInput) {
    dt = nowWAT();
  } else if (typeof dateInput === 'string' && dateInput.length === 10) {
    dt = DateTime.fromISO(dateInput, { zone: TIMEZONE });
  } else {
    dt = DateTime.fromISO(dateInput, { zone: TIMEZONE });
  }

  if (!dt.isValid) {
    dt = nowWAT();
  }

  const startOfDay = dt.startOf('day');
  const endOfDay = dt.endOf('day');

  return {
    date: startOfDay.toFormat('yyyy-MM-dd'),
    timeMin: startOfDay.toISO(), // e.g. 2026-10-01T00:00:00.000+01:00
    timeMax: endOfDay.toISO(),   // e.g. 2026-10-01T23:59:59.999+01:00
    formattedDate: startOfDay.toFormat('EEEE, MMMM d, yyyy'),
  };
}

/**
 * Returns day bounds for a range of N days starting from dateInput (default 2 days for spillover planning)
 */
export function getMultiDayBoundsWAT(dateInput, daysCount = 2) {
  const firstDay = getDayBoundsWAT(dateInput);
  const startDt = DateTime.fromISO(firstDay.date, { zone: TIMEZONE });
  const endDt = startDt.plus({ days: daysCount - 1 }).endOf('day');

  const days = [];
  for (let i = 0; i < daysCount; i++) {
    const cur = startDt.plus({ days: i });
    days.push({
      date: cur.toFormat('yyyy-MM-dd'),
      dayLabel: i === 0 ? `Today (${cur.toFormat('cccc')})` : i === 1 ? `Tomorrow (${cur.toFormat('cccc')})` : cur.toFormat('cccc, LLL d'),
      timeMin: cur.startOf('day').toISO(),
      timeMax: cur.endOf('day').toISO(),
    });
  }

  return {
    days,
    timeMin: startDt.startOf('day').toISO(),
    timeMax: endDt.toISO(),
  };
}
