import { DateTime } from 'luxon';
import { TIMEZONE, nowWAT, getDayBoundsWAT } from '../config/timezone.js';
import { calculateFreeIntervals, inferTaskDetails } from './energyModel.js';
import { listCalendarEvents, insertCalendarEvent } from './calendarService.js';
import { logger } from '../utils/logger.js';

/**
 * Finds elapsed/uncompleted tasks from yesterday or earlier today
 * and allots them automatically into open slots on the target date (e.g. Tomorrow or Today).
 */
export async function planTaskRollover({ authClient, fromDate, toDate, workingHours }) {
  const currentNow = nowWAT();
  const searchFrom = fromDate || currentNow.minus({ days: 1 }).toFormat('yyyy-MM-dd');
  const targetDate = toDate || currentNow.toFormat('yyyy-MM-dd');

  const { timeMin: pastMin } = getDayBoundsWAT(searchFrom);
  const pastMax = currentNow.toISO();

  // Fetch past events
  const pastEvents = await listCalendarEvents(authClient, pastMin, pastMax);

  // Filter for candidate tasks (tasks that passed, especially AI-scheduled or non-all-day meetings)
  const candidateTasks = pastEvents.filter(ev => {
    const end = ev.end?.dateTime;
    if (!end) return false;
    const isPast = DateTime.fromISO(end, { zone: TIMEZONE }) < currentNow;
    const isAiTask = ev.extendedProperties?.private?.aiScheduled === 'true';
    return isPast && (isAiTask || !ev.attendees || ev.attendees.length <= 1);
  });

  if (candidateTasks.length === 0) {
    return {
      rolledOverCount: 0,
      targetDate,
      rolledOverEvents: [],
      message: 'No pending or elapsed tasks found to roll over.',
    };
  }

  // Fetch existing events on the destination day
  const { timeMin: destMin, timeMax: destMax } = getDayBoundsWAT(targetDate);
  const destExisting = await listCalendarEvents(authClient, destMin, destMax);

  // Calculate free intervals on target day
  const freeSummary = calculateFreeIntervals(targetDate, destExisting, workingHours);
  let availableSlots = [...freeSummary.freeIntervals];

  const proposedRollovers = [];

  for (const task of candidateTasks) {
    const origDurationMins = DateTime.fromISO(task.end.dateTime, { zone: TIMEZONE })
      .diff(DateTime.fromISO(task.start.dateTime, { zone: TIMEZONE }), 'minutes').minutes || 30;

    const slotIndex = availableSlots.findIndex(s => s.durationMins >= origDurationMins);

    if (slotIndex !== -1) {
      const slot = availableSlots[slotIndex];
      const newStart = DateTime.fromISO(slot.start, { zone: TIMEZONE });
      const newEnd = newStart.plus({ minutes: origDurationMins });

      proposedRollovers.push({
        originalEventId: task.id,
        summary: task.summary,
        description: `Rolled over from ${DateTime.fromISO(task.start.dateTime, { zone: TIMEZONE }).toFormat('LLL d')}`,
        start_time: newStart.toISO(),
        end_time: newEnd.toISO(),
        color_id: task.colorId || '9',
        category: task.extendedProperties?.private?.category || 'deep_work',
        auto_suggested_time: true,
        is_spillover: true,
        reasoning: `Rolled over from past uncompleted task into first available free slot on ${targetDate}.`,
      });

      // Update remaining slot time
      if (slot.durationMins - origDurationMins >= 15) {
        availableSlots[slotIndex] = {
          start: newEnd.toISO(),
          end: slot.end,
          durationMins: slot.durationMins - origDurationMins,
        };
      } else {
        availableSlots.splice(slotIndex, 1);
      }
    }
  }

  return {
    rolledOverCount: proposedRollovers.length,
    targetDate,
    rolledOverEvents: proposedRollovers,
    message: `Identified ${proposedRollovers.length} task(s) for automatic rollover into ${targetDate}.`,
  };
}
