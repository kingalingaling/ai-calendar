import { db } from '../db/database.js';
import { randomUUID } from 'crypto';
import { DateTime } from 'luxon';
import { TIMEZONE } from '../config/timezone.js';
import { logger } from '../utils/logger.js';

export const BADGE_DEFINITIONS = {
  novice_adventurer: {
    id: 'novice_adventurer',
    name: 'First Quest Complete',
    icon: 'Sword',
    description: 'Completed your first scheduled task.',
  },
  deep_work_focus: {
    id: 'deep_work_focus',
    name: 'Deep Work Sorcerer',
    icon: 'Brain',
    description: 'Completed a deep work block of 60 minutes or longer.',
  },
  streak_cadet: {
    id: 'streak_cadet',
    name: 'Consistency Cadet',
    icon: 'Flame',
    description: 'Maintained a 3-day daily planning streak.',
  },
  streak_veteran: {
    id: 'streak_veteran',
    name: 'Habit Champion',
    icon: 'Zap',
    description: 'Reached a 7-day consistency streak without breaking.',
  },
  streak_legend: {
    id: 'streak_legend',
    name: 'Titan of Time',
    icon: 'Crown',
    description: 'Achieved a monumental 14-day streak.',
  },
  context_master: {
    id: 'context_master',
    name: 'Multi-Workspace Pro',
    icon: 'Layers',
    description: 'Completed tasks across multiple distinct workspaces in one day.',
  },
  sheet_wizard: {
    id: 'sheet_wizard',
    name: 'Spreadsheet Ingestor',
    icon: 'FileSpreadsheet',
    description: 'Completed a task synchronized directly from a Google Sheet.',
  },
};

export const LEVEL_THRESHOLDS = [
  { level: 1, minXp: 0, maxXp: 100, title: 'Apprentice Scribe', theme: 'emerald' },
  { level: 2, minXp: 100, maxXp: 250, title: 'Focus Adept', theme: 'sapphire' },
  { level: 3, minXp: 250, maxXp: 500, title: 'Workflow Alchemist', theme: 'amethyst' },
  { level: 4, minXp: 500, maxXp: 1000, title: 'Temporal Sentinel', theme: 'amber' },
  { level: 5, minXp: 1000, maxXp: 2000, title: 'Grandmaster of Flow', theme: 'crimson' },
];

export function calculateLevelFromXp(xp = 0) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i].minXp) {
      const current = LEVEL_THRESHOLDS[i];
      const nextThreshold = LEVEL_THRESHOLDS[i + 1] ? LEVEL_THRESHOLDS[i + 1].minXp : current.minXp + 1000;
      const progressInLevel = xp - current.minXp;
      const range = nextThreshold - current.minXp;
      const progressPercent = Math.min(100, Math.round((progressInLevel / range) * 100));

      return {
        level: current.level,
        title: current.title,
        themeUnlocked: current.theme,
        xpCurrent: xp,
        xpForCurrentLevel: current.minXp,
        xpForNextLevel: nextThreshold,
        progressPercent,
      };
    }
  }
  return {
    level: 1,
    title: LEVEL_THRESHOLDS[0].title,
    themeUnlocked: 'emerald',
    xpCurrent: xp,
    xpForCurrentLevel: 0,
    xpForNextLevel: 100,
    progressPercent: 0,
  };
}

/**
 * Retrieves or initializes gamification profile for user
 */
export function getOrCreateUserGamification(userId = 'default_user') {
  let row = db.prepare('SELECT * FROM user_gamification WHERE user_id = ?').get(userId);

  if (!row) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO user_gamification (
        user_id, xp, level, streak_count, best_streak, last_active_date,
        streak_freezes_available, unlocked_badges, current_theme, daily_stamina_max,
        created_at, updated_at
      ) VALUES (?, 0, 1, 0, 0, NULL, 2, '[]', 'emerald', 100, ?, ?)
    `).run(userId, now, now);

    row = db.prepare('SELECT * FROM user_gamification WHERE user_id = ?').get(userId);
  }

  const levelInfo = calculateLevelFromXp(row.xp);
  const badges = JSON.parse(row.unlocked_badges || '[]').map((bId) => BADGE_DEFINITIONS[bId] || { id: bId, name: bId });

  // Unlocked themes based on user level
  const unlockedThemes = LEVEL_THRESHOLDS
    .filter((t) => t.level <= levelInfo.level)
    .map((t) => t.theme);

  return {
    userId: row.user_id,
    xp: row.xp,
    level: levelInfo.level,
    levelTitle: levelInfo.title,
    levelProgressPercent: levelInfo.progressPercent,
    xpForNextLevel: levelInfo.xpForNextLevel,
    streakCount: row.streak_count,
    bestStreak: row.best_streak,
    lastActiveDate: row.last_active_date,
    streakFreezesAvailable: row.streak_freezes_available,
    unlockedBadges: badges,
    currentTheme: row.current_theme,
    unlockedThemes,
    dailyStaminaMax: row.daily_stamina_max || 100,
  };
}

/**
 * Calculates current day's stamina/energy consumption
 * Stamina limit is 100 daily points. Tasks and meetings consume stamina based on cognitive load.
 */
export function calculateDailyStamina(userId = 'default_user', dateStr = null, existingEvents = []) {
  const targetDate = dateStr || DateTime.now().setZone(TIMEZONE).toFormat('yyyy-MM-dd');

  // Query scheduled/completed tasks for this date
  const tasksForDay = db.prepare(`
    SELECT * FROM tasks
    WHERE user_id = ?
      AND (
        due_date = ?
        OR scheduled_start LIKE ?
        OR (completed_at LIKE ? AND status = 'done')
      )
  `).all(userId, targetDate, `${targetDate}%`, `${targetDate}%`);

  let staminaUsed = 0;

  // Calculate task stamina drain
  for (const t of tasksForDay) {
    const mins = t.estimated_minutes || 30;
    let cost = 10;
    if (mins > 60) cost = 35;
    else if (mins > 30) cost = 20;

    if (t.priority === 'urgent') cost = Math.round(cost * 1.3);
    else if (t.priority === 'high') cost = Math.round(cost * 1.15);

    staminaUsed += cost;
  }

  // Calculate calendar events stamina drain (meetings & calls)
  if (Array.isArray(existingEvents)) {
    for (const ev of existingEvents) {
      const start = ev.start?.dateTime;
      const end = ev.end?.dateTime;
      if (start && end && start.startsWith(targetDate)) {
        const dur = DateTime.fromISO(end, { zone: TIMEZONE })
          .diff(DateTime.fromISO(start, { zone: TIMEZONE }), 'minutes').minutes;
        const eventCost = Math.round(Math.max(10, (dur / 30) * 15));
        staminaUsed += eventCost;
      }
    }
  }

  const maxStamina = 100;
  const remaining = Math.max(0, maxStamina - staminaUsed);
  const percentage = Math.min(100, Math.round((staminaUsed / maxStamina) * 100));

  let burnoutRisk = 'low';
  if (staminaUsed > 100) burnoutRisk = 'critical';
  else if (staminaUsed >= 85) burnoutRisk = 'high';
  else if (staminaUsed >= 60) burnoutRisk = 'moderate';

  return {
    date: targetDate,
    maxStamina,
    staminaUsed,
    staminaRemaining: remaining,
    percentage,
    burnoutRisk,
    isOvercommitted: staminaUsed > 100,
    taskCount: tasksForDay.length,
  };
}

/**
 * Awards XP and updates streaks & badges upon task completion
 */
export function recordTaskCompletion(userId = 'default_user', task) {
  const profile = getOrCreateUserGamification(userId);
  const nowWAT = DateTime.now().setZone(TIMEZONE);
  const todayStr = nowWAT.toFormat('yyyy-MM-dd');
  const yesterdayStr = nowWAT.minus({ days: 1 }).toFormat('yyyy-MM-dd');

  // 1. Calculate XP earned
  const mins = task.estimated_minutes || 30;
  let xpEarned = Math.max(15, mins); // Base: 1 XP per minute, min 15 XP

  if (task.priority === 'urgent') xpEarned += 25;
  else if (task.priority === 'high') xpEarned += 15;
  else if (task.priority === 'medium') xpEarned += 5;

  if (mins >= 60) xpEarned += 20; // Deep work bonus

  // Streak bonus multiplier
  if (profile.streakCount >= 7) xpEarned = Math.round(xpEarned * 1.25);
  else if (profile.streakCount >= 3) xpEarned = Math.round(xpEarned * 1.1);

  // 2. Handle Streaks and Freezes
  let newStreak = profile.streakCount;
  let newBestStreak = profile.bestStreak;
  let freezesAvailable = profile.streakFreezesAvailable;
  let freezeUsed = false;

  if (profile.lastActiveDate === todayStr) {
    // Already logged activity today, streak remains current
  } else if (profile.lastActiveDate === yesterdayStr || !profile.lastActiveDate) {
    // Consecutive day activity!
    newStreak = (profile.streakCount || 0) + 1;
    if (newStreak > newBestStreak) newBestStreak = newStreak;
  } else {
    // Missed at least one day
    const lastActive = DateTime.fromISO(profile.lastActiveDate, { zone: TIMEZONE });
    const daysMissed = Math.floor(nowWAT.diff(lastActive, 'days').days);

    if (daysMissed === 2 && freezesAvailable > 0) {
      // Grace period with streak freeze!
      freezesAvailable -= 1;
      freezeUsed = true;
      newStreak = (profile.streakCount || 0) + 1;
      if (newStreak > newBestStreak) newBestStreak = newStreak;
      logger.info(`❄️ Streak freeze consumed for user ${userId}! Streak preserved at ${newStreak}.`);
    } else {
      // Streak broken, reset to 1
      newStreak = 1;
    }
  }

  // 3. Check for Badge Unlocks
  const currentBadges = JSON.parse(
    db.prepare('SELECT unlocked_badges FROM user_gamification WHERE user_id = ?').get(userId)?.unlocked_badges || '[]'
  );
  const newlyUnlockedBadges = [];

  const tryAwardBadge = (badgeId) => {
    if (!currentBadges.includes(badgeId)) {
      currentBadges.push(badgeId);
      newlyUnlockedBadges.push(BADGE_DEFINITIONS[badgeId] || { id: badgeId });
    }
  };

  // Badge 1: First Quest
  tryAwardBadge('novice_adventurer');

  // Badge 2: Deep Work
  if (mins >= 60) {
    tryAwardBadge('deep_work_focus');
  }

  // Badge 3 & 4: Streaks
  if (newStreak >= 3) tryAwardBadge('streak_cadet');
  if (newStreak >= 7) tryAwardBadge('streak_veteran');
  if (newStreak >= 14) tryAwardBadge('streak_legend');

  // Badge 5: Google Sheets Task
  if (task.source === 'google_sheets') {
    tryAwardBadge('sheet_wizard');
  }

  // Badge 6: Multi-Context
  const distinctContexts = db.prepare(`
    SELECT COUNT(DISTINCT context_id) as count
    FROM tasks
    WHERE user_id = ? AND status = 'done' AND completed_at LIKE ?
  `).get(userId, `${todayStr}%`);

  if (distinctContexts && distinctContexts.count >= 2) {
    tryAwardBadge('context_master');
  }

  // 4. Update Database
  const newTotalXp = profile.xp + xpEarned;
  const oldLevel = profile.level;
  const levelInfo = calculateLevelFromXp(newTotalXp);
  const levelUp = levelInfo.level > oldLevel;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE user_gamification
    SET xp = ?,
        level = ?,
        streak_count = ?,
        best_streak = ?,
        last_active_date = ?,
        streak_freezes_available = ?,
        unlocked_badges = ?,
        updated_at = ?
    WHERE user_id = ?
  `).run(
    newTotalXp,
    levelInfo.level,
    newStreak,
    newBestStreak,
    todayStr,
    freezesAvailable,
    JSON.stringify(currentBadges),
    now,
    userId
  );

  // Log XP transaction
  const logId = `xp-${randomUUID()}`;
  db.prepare(`
    INSERT INTO xp_logs (id, user_id, task_id, amount, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    logId,
    userId,
    task.id,
    xpEarned,
    `Completed task: ${task.title}`,
    now
  );

  return {
    xpEarned,
    newTotalXp,
    level: levelInfo.level,
    levelTitle: levelInfo.title,
    levelUp,
    streakCount: newStreak,
    freezeUsed,
    freezesAvailable,
    newlyUnlockedBadges,
  };
}

/**
 * Allows user to switch their active unlock theme
 */
export function setUserTheme(userId = 'default_user', theme = 'emerald') {
  const profile = getOrCreateUserGamification(userId);
  if (!profile.unlockedThemes.includes(theme)) {
    throw new Error(`Theme "${theme}" is locked. Level up to unlock it!`);
  }

  db.prepare(`
    UPDATE user_gamification SET current_theme = ?, updated_at = ? WHERE user_id = ?
  `).run(theme, new Date().toISOString(), userId);

  return { success: true, theme };
}
