import { getMultiDayBoundsWAT, TIMEZONE } from '../config/timezone.js';
import { listCalendarEvents, batchInsertEvents } from '../services/calendarService.js';
import { parseScheduleWithGemini } from '../services/geminiService.js';
import { validateScheduleConflicts } from '../services/conflictService.js';
import { planTaskRollover } from '../services/rolloverService.js';
import { DEFAULT_WORKING_HOURS } from '../services/energyModel.js';
import { logger } from '../utils/logger.js';

export async function parseSchedule(req, res, next) {
  try {
    const {
      prompt,
      targetDate,
      allowSpillover = true,
      workingHours = DEFAULT_WORKING_HOURS,
    } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    // 2-day horizon for multi-day spillover planning
    const daysHorizon = allowSpillover ? 2 : 1;
    const { days, timeMin, timeMax } = getMultiDayBoundsWAT(targetDate, daysHorizon);

    // Fetch existing events for the whole horizon
    const allExistingEvents = await listCalendarEvents(req.authClient, timeMin, timeMax);

    // Group existing events by date
    const existingEventsByDay = {};
    for (const d of days) {
      existingEventsByDay[d.date] = allExistingEvents.filter(ev => {
        const evStart = ev.start?.dateTime || ev.start?.date;
        return evStart && evStart.startsWith(d.date);
      });
    }

    logger.info(`Analyzing brain dump for ${days[0].date} in ${TIMEZONE}...`);

    // Call Gemini 3.8 Flash with Function Calling
    const aiResult = await parseScheduleWithGemini({
      userPrompt: prompt,
      targetDays: days,
      existingEventsByDay,
      workingHours,
    });

    // Flatten proposed events across all days to run algorithmic conflict verification
    const allProposedEvents = [];
    const formattedSchedule = (aiResult.scheduled_days || []).map((dayGroup, idx) => {
      const dayMeta = days.find(d => d.date === dayGroup.date) || days[idx] || { date: dayGroup.date, dayLabel: dayGroup.date };
      const eventsWithIds = (dayGroup.events || []).map((ev, evIdx) => {
        const item = {
          tempId: `prop-${dayGroup.date}-${evIdx}-${Date.now().toString(36)}`,
          ...ev,
        };
        allProposedEvents.push(item);
        return item;
      });

      return {
        date: dayGroup.date,
        dayLabel: dayMeta.dayLabel,
        eventCount: eventsWithIds.length,
        events: eventsWithIds,
      };
    });

    // Run deterministic collision check against existing Google Calendar events
    const validation = validateScheduleConflicts(allProposedEvents, allExistingEvents);

    const spilloverCount = formattedSchedule.slice(1).reduce((sum, d) => sum + d.events.length, 0);

    res.json({
      success: true,
      timezone: TIMEZONE,
      summary: aiResult.summary_rationale,
      spilloverOccurred: spilloverCount > 0,
      spilloverCount,
      isValid: validation.isValid,
      conflicts: validation.conflicts,
      schedule: formattedSchedule,
    });
  } catch (err) {
    next(err);
  }
}

export async function commitSchedule(req, res, next) {
  try {
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Array of events to commit is required.' });
    }

    logger.info(`Committing ${events.length} events to Google Calendar...`);
    const createdEvents = await batchInsertEvents(req.authClient, events);

    res.status(201).json({
      success: true,
      count: createdEvents.length,
      createdEvents,
    });
  } catch (err) {
    next(err);
  }
}

export async function rolloverTasks(req, res, next) {
  try {
    const { fromDate, toDate, workingHours } = req.body;
    const plan = await planTaskRollover({
      authClient: req.authClient,
      fromDate,
      toDate,
      workingHours: workingHours || DEFAULT_WORKING_HOURS,
    });

    res.json({
      success: true,
      ...plan,
    });
  } catch (err) {
    next(err);
  }
}

export async function autoBlockTasks(req, res, next) {
  try {
    const userId = req.user?.id || 'default_user';
    const { targetDate, contextId, taskIds, allowSpillover, minBufferMinutes } = req.body;

    const plan = await import('../services/autoScheduleService.js').then(m =>
      m.planAutoSchedule({
        userId,
        authClient: req.authClient,
        targetDate,
        contextId,
        taskIds,
        allowSpillover,
        minBufferMinutes,
      })
    );

    res.json(plan);
  } catch (err) {
    next(err);
  }
}

export async function commitAutoTasks(req, res, next) {
  try {
    const userId = req.user?.id || 'default_user';
    const { scheduledTasks } = req.body;

    const result = await import('../services/autoScheduleService.js').then(m =>
      m.commitAutoScheduledTasks({
        userId,
        authClient: req.authClient,
        scheduledTasks,
      })
    );

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

