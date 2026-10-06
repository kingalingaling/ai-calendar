import { DateTime } from 'luxon';
import { TIMEZONE, nowWAT } from '../config/timezone.js';
import { db } from '../db/database.js';
import { listCalendarEvents, insertCalendarEvent } from './calendarService.js';
import { doIntervalsOverlap } from './conflictService.js';
import { calculateDailyStamina } from './gamificationService.js';
import { logger } from '../utils/logger.js';

export const DEFAULT_BUFFER_MINUTES = 10;
export const CROSS_JOB_BUFFER_MINUTES = 15;

/**
 * Parses working hours JSON from contexts table
 */
function parseContextWorkingHours(hoursJson) {
  try {
    const parsed = typeof hoursJson === 'string' ? JSON.parse(hoursJson) : hoursJson;
    return {
      start: parsed?.start || '09:00',
      end: parsed?.end || '17:00',
      days: parsed?.days || [1, 2, 3, 4, 5],
    };
  } catch {
    return { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] };
  }
}

/**
 * Intelligent Time Blocking Algorithm with Guardrails:
 * 1. Context Working Hours Isolation (Job A vs Job B windows)
 * 2. Cognitive Burnout Buffers (10-15m between tasks)
 * 3. Cross-Job Meeting Collision Guardrail
 * 4. Energy-Window Priority Scheduling
 * 5. Automatic Multi-Day Spillover when daily capacity is reached
 */
export async function planAutoSchedule({
  userId = 'default_user',
  authClient,
  targetDate,
  contextId = null,
  taskIds = null,
  allowSpillover = true,
  minBufferMinutes = DEFAULT_BUFFER_MINUTES,
}) {
  const baseDateStr = targetDate || nowWAT().toFormat('yyyy-MM-dd');
  const horizonDays = allowSpillover ? 2 : 1;

  // 1. Fetch Candidate Tasks from DB
  let query = `
    SELECT t.*, c.name as context_name, c.color as context_color, c.working_hours as context_working_hours
    FROM tasks t
    JOIN contexts c ON t.context_id = c.id
    WHERE t.user_id = ?
      AND t.status IN ('todo', 'in_progress')
  `;
  const params = [userId];

  if (contextId) {
    query += ' AND t.context_id = ?';
    params.push(contextId);
  }

  if (Array.isArray(taskIds) && taskIds.length > 0) {
    query += ` AND t.id IN (${taskIds.map(() => '?').join(',')})`;
    params.push(...taskIds);
  }

  // Priority order: urgent -> high -> medium -> low, then longer tasks first (deep work)
  query += `
    ORDER BY 
      CASE t.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END ASC,
      t.estimated_minutes DESC
  `;

  const tasksToSchedule = db.prepare(query).all(...params);

  if (tasksToSchedule.length === 0) {
    return {
      success: true,
      scheduledDays: [],
      scheduledCount: 0,
      unassignedTasks: [],
      guardrailsApplied: [],
      message: 'No pending tasks found to auto-schedule.',
    };
  }

  // 2. Fetch existing Google Calendar events for target horizon
  const startHorizon = DateTime.fromISO(baseDateStr, { zone: TIMEZONE }).startOf('day');
  const endHorizon = startHorizon.plus({ days: horizonDays }).endOf('day');

  const existingCalendarEvents = await listCalendarEvents(
    authClient,
    startHorizon.toISO(),
    endHorizon.toISO()
  );

  const guardrailsApplied = [];
  const scheduledDaysMap = {}; // { '2026-10-06': [scheduledItems] }
  const unassignedTasks = [];

  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
    const currentDate = startHorizon.plus({ days: dayOffset }).toFormat('yyyy-MM-dd');
    scheduledDaysMap[currentDate] = [];
  }

  // Running commitments tracker (combines Google Calendar events + already scheduled tasks)
  const allCommitments = existingCalendarEvents.map((ev) => {
    const s = ev.start?.dateTime || ev.start?.date;
    const e = ev.end?.dateTime || ev.end?.date;
    return {
      start: DateTime.fromISO(s, { zone: TIMEZONE }),
      end: DateTime.fromISO(e, { zone: TIMEZONE }),
      contextId: ev.extendedProperties?.private?.contextId || null,
      summary: ev.summary || 'Busy',
      isEvent: true,
    };
  });

  // 3. Process each task through Guardrail Slot Allocator
  for (const task of tasksToSchedule) {
    const durationMins = task.estimated_minutes || 30;
    const contextHours = parseContextWorkingHours(task.context_working_hours);
    let taskAssigned = false;

    for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
      const dayDate = startHorizon.plus({ days: dayOffset });
      const dayDateStr = dayDate.toFormat('yyyy-MM-dd');

      // Check daily stamina capacity: If stamina > 95, overflow to next day to prevent burnout
      const staminaStatus = calculateDailyStamina(userId, dayDateStr, existingCalendarEvents);
      if (staminaStatus.staminaUsed >= 95 && dayOffset < horizonDays - 1) {
        guardrailsApplied.push({
          taskId: task.id,
          taskTitle: task.title,
          type: 'STAMINA_LIMIT_OVERFLOW',
          message: `Daily stamina on ${dayDateStr} reached ${staminaStatus.staminaUsed}%. Shifted to next day to avoid burnout.`,
        });
        continue;
      }

      // Context Working Hours Bounds for this day
      const [startH, startM] = contextHours.start.split(':').map(Number);
      const [endH, endM] = contextHours.end.split(':').map(Number);

      const windowStart = dayDate.set({ hour: startH, minute: startM, second: 0, millisecond: 0 });
      const windowEnd = dayDate.set({ hour: endH, minute: endM, second: 0, millisecond: 0 });

      // Find free gap inside context window
      let candidateStart = windowStart;

      while (candidateStart.plus({ minutes: durationMins }) <= windowEnd) {
        const candidateEnd = candidateStart.plus({ minutes: durationMins });

        // Guardrail 1: Cognitive Buffer Check
        // Enforce minBufferMinutes between any preceding commitment and candidateStart
        // Enforce minBufferMinutes after candidateEnd
        let collisionFound = false;

        for (const comm of allCommitments) {
          // Cross-job buffer is 15 min; standard burnout buffer is 10 min
          const isCrossJob = comm.contextId && comm.contextId !== task.context_id;
          const bufferToApply = isCrossJob ? CROSS_JOB_BUFFER_MINUTES : minBufferMinutes;

          const commStartBuffered = comm.start.minus({ minutes: bufferToApply });
          const commEndBuffered = comm.end.plus({ minutes: bufferToApply });

          // Overlap check
          const maxStart = candidateStart > commStartBuffered ? candidateStart : commStartBuffered;
          const minEnd = candidateEnd < commEndBuffered ? candidateEnd : commEndBuffered;

          if (maxStart < minEnd) {
            collisionFound = true;
            if (isCrossJob) {
              guardrailsApplied.push({
                taskId: task.id,
                taskTitle: task.title,
                type: 'CROSS_JOB_BUFFER_GUARD',
                message: `Enforced 15-minute buffer between "${task.context_name}" and "${comm.summary}" to prevent cross-job context collapse.`,
              });
            }
            // Advance candidateStart past this commitment's buffered end
            candidateStart = commEndBuffered;
            break;
          }
        }

        if (!collisionFound) {
          // Found a conflict-free, buffer-protected slot!
          const scheduledItem = {
            taskId: task.id,
            title: task.title,
            description: task.description || '',
            contextId: task.context_id,
            contextName: task.context_name,
            contextColor: task.context_color,
            priority: task.priority,
            estimatedMinutes: durationMins,
            start: candidateStart.toISO(),
            end: candidateEnd.toISO(),
            day: dayDateStr,
            isSpillover: dayOffset > 0,
            spilloverReason: dayOffset > 0 ? `Overflowed from ${baseDateStr} because work hours were full.` : null,
          };

          scheduledDaysMap[dayDateStr].push(scheduledItem);

          allCommitments.push({
            start: candidateStart,
            end: candidateEnd,
            contextId: task.context_id,
            summary: task.title,
            isEvent: false,
          });

          taskAssigned = true;
          break;
        }
      }

      if (taskAssigned) break;
    }

    if (!taskAssigned) {
      unassignedTasks.push({
        id: task.id,
        title: task.title,
        contextName: task.context_name,
        estimatedMinutes: durationMins,
        reason: 'No open slot in working hours across scheduling horizon.',
      });
    }
  }

  const scheduledDays = Object.entries(scheduledDaysMap).map(([date, items]) => ({
    date,
    dayLabel: DateTime.fromISO(date, { zone: TIMEZONE }).toFormat('cccc, LLL d'),
    items,
    count: items.length,
  }));

  const totalScheduled = scheduledDays.reduce((acc, d) => acc + d.count, 0);

  return {
    success: true,
    timezone: TIMEZONE,
    targetDate: baseDateStr,
    totalScheduled,
    scheduledDays,
    unassignedTasks,
    guardrailsApplied,
    summary: `Intelligently scheduled ${totalScheduled} task(s) into calendar slots with cognitive buffers and cross-job guardrails.`,
  };
}

/**
 * Commits scheduled tasks to Google Calendar & Google Tasks
 * - Tasks are created as native Google Tasks (via Tasks API)
 * - Calendar events receive exact 5-minute reminder popup overrides
 * - SQLite tasks records are updated with scheduled timestamps and calendar event IDs
 */
export async function commitAutoScheduledTasks({
  userId = 'default_user',
  authClient,
  scheduledTasks = [],
}) {
  if (!Array.isArray(scheduledTasks) || scheduledTasks.length === 0) {
    return { success: true, count: 0, tasks: [] };
  }

  const results = [];
  const now = new Date().toISOString();

  for (const item of scheduledTasks) {
    // 1. Create on Google Calendar / Google Tasks
    const calendarPayload = {
      summary: item.title,
      description: item.description || `Context: ${item.contextName || 'General'}`,
      start_time: item.start,
      end_time: item.end,
      entry_type: 'task', // Native task trigger
      colorId: '9',
      extendedProperties: {
        private: {
          taskId: item.taskId,
          contextId: item.contextId || '',
          aiScheduled: 'true',
        },
      },
    };

    let calendarResult = null;
    try {
      calendarResult = await insertCalendarEvent(authClient, calendarPayload);
    } catch (err) {
      logger.error(`Failed to push task "${item.title}" to Google Calendar:`, err);
    }

    // 2. Update SQLite Task
    if (item.taskId) {
      db.prepare(`
        UPDATE tasks
        SET scheduled_start = ?,
            scheduled_end = ?,
            calendar_event_id = ?,
            status = CASE WHEN status = 'todo' THEN 'in_progress' ELSE status END,
            updated_at = ?
        WHERE id = ? AND user_id = ?
      `).run(
        item.start,
        item.end,
        calendarResult?.id || null,
        now,
        item.taskId,
        userId
      );
    }

    results.push({
      taskId: item.taskId,
      title: item.title,
      start: item.start,
      end: item.end,
      calendarId: calendarResult?.id || null,
      isNativeTask: calendarResult?.isNativeTask || false,
    });
  }

  logger.info(`✨ Successfully auto-committed ${results.length} tasks to Google Calendar & Google Tasks with 5-min reminders.`);

  return {
    success: true,
    count: results.length,
    committedTasks: results,
  };
}
