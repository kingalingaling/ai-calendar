import { getDayBoundsWAT, getMultiDayBoundsWAT, TIMEZONE } from '../config/timezone.js';
import { listCalendarEvents, updateCalendarEvent, deleteCalendarEvent } from '../services/calendarService.js';

export async function getAgenda(req, res, next) {
  try {
    const { date, view = 'day' } = req.query;

    let timeMin, timeMax, daysMeta;

    if (view === 'week') {
      const multi = getMultiDayBoundsWAT(date, 7);
      timeMin = multi.timeMin;
      timeMax = multi.timeMax;
      daysMeta = multi.days;
    } else {
      const single = getDayBoundsWAT(date);
      timeMin = single.timeMin;
      timeMax = single.timeMax;
      daysMeta = [{ date: single.date, dayLabel: single.formattedDate, timeMin, timeMax }];
    }

    const events = await listCalendarEvents(req.authClient, timeMin, timeMax);

    // Format events for mobile UI
    const formattedEvents = events.map(e => ({
      id: e.id,
      summary: e.summary || '(Untitled Event)',
      description: e.description || '',
      location: e.location || '',
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      isAllDay: !e.start?.dateTime,
      colorId: e.colorId || '9',
      htmlLink: e.htmlLink,
      aiScheduled: e.extendedProperties?.private?.aiScheduled === 'true',
      category: e.extendedProperties?.private?.category || 'task',
      autoSuggested: e.extendedProperties?.private?.autoSuggested === 'true',
      isSpillover: e.extendedProperties?.private?.isSpillover === 'true',
    }));

    res.json({
      success: true,
      timezone: TIMEZONE,
      view,
      dateRange: { timeMin, timeMax },
      days: daysMeta,
      events: formattedEvents,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateEvent(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await updateCalendarEvent(req.authClient, id, req.body);
    res.json({ success: true, event: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteEvent(req, res, next) {
  try {
    const { id } = req.params;
    const result = await deleteCalendarEvent(req.authClient, id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
