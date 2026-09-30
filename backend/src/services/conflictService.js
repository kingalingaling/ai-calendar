import { DateTime } from 'luxon';
import { TIMEZONE } from '../config/timezone.js';

/**
 * Checks whether two time intervals overlap.
 * Overlap condition: max(start1, start2) < min(end1, end2)
 */
export function doIntervalsOverlap(startA, endA, startB, endB) {
  const dtStartA = DateTime.fromISO(startA, { zone: TIMEZONE });
  const dtEndA = DateTime.fromISO(endA, { zone: TIMEZONE });
  const dtStartB = DateTime.fromISO(startB, { zone: TIMEZONE });
  const dtEndB = DateTime.fromISO(endB, { zone: TIMEZONE });

  const maxStart = dtStartA > dtStartB ? dtStartA : dtStartB;
  const minEnd = dtEndA < dtEndB ? dtEndA : dtEndB;

  return maxStart < minEnd;
}

/**
 * Validates a list of proposed events against existing events and among themselves.
 * Returns an object with { isValid: boolean, conflicts: Array }
 */
export function validateScheduleConflicts(proposedEvents = [], existingEvents = []) {
  const conflicts = [];

  // Check proposed events against existing calendar commitments
  for (const proposed of proposedEvents) {
    const pStart = proposed.start_time || proposed.start;
    const pEnd = proposed.end_time || proposed.end;

    if (!pStart || !pEnd) {
      conflicts.push({
        type: 'INVALID_TIMESTAMP',
        event: proposed.summary,
        message: 'Missing start or end timestamp.',
      });
      continue;
    }

    const dtStart = DateTime.fromISO(pStart, { zone: TIMEZONE });
    const dtEnd = DateTime.fromISO(pEnd, { zone: TIMEZONE });

    if (dtStart >= dtEnd) {
      conflicts.push({
        type: 'NEGATIVE_DURATION',
        event: proposed.summary,
        message: 'Start time must be strictly before end time.',
      });
      continue;
    }

    for (const existing of existingEvents) {
      const eStart = existing.start?.dateTime || existing.start?.date;
      const eEnd = existing.end?.dateTime || existing.end?.date;
      if (!eStart || !eEnd) continue;

      if (doIntervalsOverlap(pStart, pEnd, eStart, eEnd)) {
        conflicts.push({
          type: 'OVERLAP_WITH_EXISTING',
          proposedEvent: proposed.summary,
          existingEvent: existing.summary || 'Existing commitment',
          conflictWindow: `${eStart} to ${eEnd}`,
        });
      }
    }
  }

  // Check proposed events against each other
  for (let i = 0; i < proposedEvents.length; i++) {
    for (let j = i + 1; j < proposedEvents.length; j++) {
      const evA = proposedEvents[i];
      const evB = proposedEvents[j];
      const startA = evA.start_time || evA.start;
      const endA = evA.end_time || evA.end;
      const startB = evB.start_time || evB.start;
      const endB = evB.end_time || evB.end;

      if (startA && endA && startB && endB && doIntervalsOverlap(startA, endA, startB, endB)) {
        conflicts.push({
          type: 'MUTUAL_PROPOSED_OVERLAP',
          eventA: evA.summary,
          eventB: evB.summary,
          message: `Proposed events "${evA.summary}" and "${evB.summary}" overlap in time.`,
        });
      }
    }
  }

  return {
    isValid: conflicts.length === 0,
    conflicts,
  };
}
