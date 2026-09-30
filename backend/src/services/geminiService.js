import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { TIMEZONE } from '../config/timezone.js';
import { inferTaskDetails, calculateFreeIntervals } from './energyModel.js';
import { logger } from '../utils/logger.js';
import { DateTime } from 'luxon';

let aiClient = null;
if (env.GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
} else {
  logger.warn('⚠️ GEMINI_API_KEY is not set. The service will use heuristic rule-based fallback scheduling until key is provided.');
}

export const scheduleEventsToolSchema = {
  type: 'function',
  name: 'schedule_events',
  description: 'Proposes an optimized, conflict-free schedule across one or more days. Infers durations and assigns optimal energy-aligned time slots when timestamps are omitted. Overflows excess tasks to the next day when daily capacity is reached.',
  parameters: {
    type: 'object',
    properties: {
      summary_rationale: {
        type: 'string',
        description: 'A brief executive explanation of the scheduling decisions and any multi-day spillover rationale.',
      },
      scheduled_days: {
        type: 'array',
        description: 'List of days containing proposed events.',
        items: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Date in YYYY-MM-DD format.',
            },
            events: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  summary: { type: 'string', description: 'Clear title of the task or appointment.' },
                  description: { type: 'string', description: 'Context notes or agenda details.' },
                  category: {
                    type: 'string',
                    enum: ['deep_work', 'meeting_call', 'admin', 'health_fitness', 'personal'],
                    description: 'Categorization for energy-window placement.',
                  },
                  start_time: {
                    type: 'string',
                    description: 'RFC3339 / ISO 8601 start timestamp with explicit WAT +01:00 offset (e.g. 2026-10-01T09:00:00+01:00).',
                  },
                  end_time: {
                    type: 'string',
                    description: 'RFC3339 / ISO 8601 end timestamp with explicit WAT +01:00 offset.',
                  },
                  auto_suggested_time: {
                    type: 'boolean',
                    description: 'True if the model inferred the time because user did not specify one.',
                  },
                  is_spillover: {
                    type: 'boolean',
                    description: 'True if this task was moved to this date because previous date was full.',
                  },
                  spillover_reason: {
                    type: 'string',
                    description: 'Explanation for moving this task to the next day.',
                  },
                  color_id: {
                    type: 'string',
                    description: "Google Calendar colorId: '1' (Lavender), '2' (Sage), '7' (Peacock), '9' (Bold Blue), '11' (Red).",
                  },
                  reasoning: {
                    type: 'string',
                    description: 'Energy fit and conflict-avoidance justification.',
                  },
                },
                required: ['summary', 'start_time', 'end_time', 'category', 'auto_suggested_time', 'is_spillover', 'reasoning'],
              },
            },
          },
          required: ['date', 'events'],
        },
      },
    },
    required: ['summary_rationale', 'scheduled_days'],
  },
};

/**
 * Calls Gemini with function calling to parse brain dump schedule
 */
export async function parseScheduleWithGemini({
  userPrompt,
  targetDays, // [{ date, dayLabel, timeMin, timeMax }]
  existingEventsByDay, // { [date]: [events...] }
  workingHours = { start: '08:30', end: '18:00' },
}) {
  // If no Gemini API key configured, use deterministic heuristic engine
  if (!aiClient) {
    return generateHeuristicSchedule({ userPrompt, targetDays, existingEventsByDay, workingHours });
  }

  try {
    const formattedContext = targetDays.map(day => {
      const dayEvents = existingEventsByDay[day.date] || [];
      const freeSummary = calculateFreeIntervals(day.date, dayEvents, workingHours);
      return {
        date: day.date,
        dayLabel: day.dayLabel,
        totalFreeHours: freeSummary.totalFreeHours,
        existingCommitments: dayEvents.map(e => ({
          summary: e.summary,
          start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date,
        })),
        freeWindows: freeSummary.freeIntervals,
      };
    });

    const systemInstruction = `
You are an expert AI Calendar Scheduling Assistant operating in timezone ${TIMEZONE} (WAT, UTC+1).
Current local context: ${JSON.stringify(formattedContext, null, 2)}
Default Workday: ${workingHours.start} to ${workingHours.end} WAT.

CORE CAPABILITIES & RULES:
1. ZERO-TIMESTAMP SCHEDULING:
   - When the user lists tasks without specific times (e.g. "review financials, gym, call client"), you MUST automatically assign optimal time slots.
   - Match by energy levels:
     * Morning (08:30 - 12:30): High-focus deep work, complex writing, strategy.
     * Lunch Break (12:30 - 13:30): Avoid scheduling here unless asked.
     * Afternoon (13:30 - 16:30): Calls, syncs, reviews, emails, admin.
     * Twilight (16:30 - 18:30): Workouts, fitness, end-of-day wrap-up.
   - Infer sensible durations (calls: 20-30m, deep work: 60-90m, workouts: 45m, admin: 30m).

2. MULTI-DAY OVERFLOW & SPILLOVER:
   - Never cram tasks past the ${workingHours.end} cutoff or exceed reasonable daily working capacity.
   - If tasks cannot fit comfortably on Day 1 (${targetDays[0]?.date}), automatically spill over remaining tasks to Day 2 (${targetDays[1]?.date}) and mark "is_spillover": true with an explanation.

3. STRICT COLLISION AVOIDANCE:
   - NEVER overlap with any existing commitment.
   - Output all timestamps with explicit '+01:00' timezone offset.

4. YOU MUST CALL the 'schedule_events' function.
`;

    const interaction = await aiClient.interactions.create({
      model: env.GEMINI_MODEL,
      input: `User Brain-Dump: "${userPrompt}"\nTarget Date: ${targetDays[0]?.date}`,
      system_instruction: systemInstruction,
      tools: [scheduleEventsToolSchema],
    });

    for (const step of interaction.steps || []) {
      if (step.type === 'function_call' && step.name === 'schedule_events') {
        logger.info('✨ Gemini 3.8 Flash returned structured schedule_events tool call.');
        return step.arguments;
      }
    }

    logger.warn('Gemini did not return function_call, using heuristic fallback.');
    return generateHeuristicSchedule({ userPrompt, targetDays, existingEventsByDay, workingHours });
  } catch (err) {
    logger.error('Gemini API call failed, falling back to heuristic scheduler:', err.message);
    return generateHeuristicSchedule({ userPrompt, targetDays, existingEventsByDay, workingHours });
  }
}

/**
 * Intelligent deterministic heuristic scheduler fallback
 */
export function generateHeuristicSchedule({ userPrompt, targetDays, existingEventsByDay, workingHours }) {
  const lines = userPrompt
    .split(/[\n,;]|(?:\sand\s)/)
    .map(s => s.trim())
    .filter(s => s.length > 2);

  const rawTasks = lines.length > 0 ? lines : [userPrompt.trim()];
  const scheduledDays = targetDays.map(d => ({ date: d.date, events: [] }));

  let currentDayIndex = 0;

  for (const taskText of rawTasks) {
    const details = inferTaskDetails(taskText);
    let placed = false;

    while (currentDayIndex < targetDays.length && !placed) {
      const activeDay = targetDays[currentDayIndex];
      const existing = existingEventsByDay[activeDay.date] || [];
      const freeSlots = calculateFreeIntervals(activeDay.date, [
        ...existing,
        ...scheduledDays[currentDayIndex].events.map(e => ({
          start: { dateTime: e.start_time },
          end: { dateTime: e.end_time },
        })),
      ], workingHours);

      const usableSlot = freeSlots.freeIntervals.find(slot => slot.durationMins >= details.durationMinutes);

      if (usableSlot) {
        const slotStart = DateTime.fromISO(usableSlot.start, { zone: TIMEZONE });
        const slotEnd = slotStart.plus({ minutes: details.durationMinutes });

        scheduledDays[currentDayIndex].events.push({
          summary: taskText.replace(/^\w/, c => c.toUpperCase()),
          description: `Auto-scheduled ${details.category.replace('_', ' ')}`,
          category: details.category,
          start_time: slotStart.toISO(),
          end_time: slotEnd.toISO(),
          auto_suggested_time: true,
          is_spillover: currentDayIndex > 0,
          spillover_reason: currentDayIndex > 0 ? 'Moved to next day to avoid daily overbooking.' : '',
          color_id: details.colorId,
          reasoning: currentDayIndex > 0
            ? 'Allotted to next day due to working hours limit.'
            : `Fitted in open ${details.category.replace('_', ' ')} window.`,
        });
        placed = true;
      } else {
        // Day is full, move to next day
        currentDayIndex++;
      }
    }
  }

  const spilloverCount = scheduledDays.slice(1).reduce((sum, d) => sum + d.events.length, 0);

  return {
    summary_rationale: spilloverCount > 0
      ? `Scheduled ${rawTasks.length} tasks across ${targetDays.length} days with ${spilloverCount} task(s) rolled over to subsequent days.`
      : `Successfully scheduled all ${rawTasks.length} tasks into optimal open slots.`,
    scheduled_days: scheduledDays,
  };
}
