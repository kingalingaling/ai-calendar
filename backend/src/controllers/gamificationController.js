import * as gamificationService from '../services/gamificationService.js';
import { listCalendarEvents } from '../services/calendarService.js';
import { getDayBoundsWAT } from '../config/timezone.js';

function getUserId(req) {
  return req.user?.id || 'default_user';
}

export async function getGamificationStats(req, res, next) {
  try {
    const userId = getUserId(req);
    const { date } = req.query;

    const profile = gamificationService.getOrCreateUserGamification(userId);

    // Fetch calendar events to calculate today's stamina
    let events = [];
    try {
      const { timeMin, timeMax } = getDayBoundsWAT(date);
      events = await listCalendarEvents(req.authClient, timeMin, timeMax);
    } catch {
      // If calendar fetch fails, proceed with empty events
    }

    const stamina = gamificationService.calculateDailyStamina(userId, date, events);

    res.json({
      success: true,
      profile,
      stamina,
    });
  } catch (err) {
    next(err);
  }
}

export function switchTheme(req, res, next) {
  try {
    const userId = getUserId(req);
    const { theme } = req.body;

    if (!theme) {
      return res.status(400).json({ error: 'Theme is required.' });
    }

    const result = gamificationService.setUserTheme(userId, theme);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
