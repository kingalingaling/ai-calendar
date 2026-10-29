import { isMongoConnected } from '../db/mongodb.js';
import { Gamification } from '../models/Gamification.js';
import { XpLog } from '../models/XpLog.js';
import { Task } from '../models/Task.js';
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
 * Retrieves or initializes gamification profile for user.
 * In MongoDB, profiles are synced across all devices connected to the same database.
 */
export async function getOrCreateUserGamification(userId = 'default_user') {
  if (isMongoConnected()) {
    try {
      // Find profile by userId or fallback to global_user so all devices share the XP
      let doc = await Gamification.findOne({ userId });
      if (!doc && userId !== 'global_user') {
        doc = await Gamification.findOne({ userId: 'global_user' });
      }

      if (!doc) {
        doc = await Gamification.create({
          userId: userId || 'global_user',
          xp: 0,
          level: 1,
          streakCount: 0,
          bestStreak: 0,
          lastActiveDate: null,
          streakFreezesAvailable: 2,
          unlockedBadges: [],
          currentTheme: 'emerald',
          dailyStaminaMax: 100,
        });
      }

      const levelInfo = calculateLevelFromXp(doc.xp);
      const badges = (doc.unlockedBadges || []).map(bId => BADGE_DEFINITIONS[bId] || { id: bId, name: bId });
      const unlockedThemes = LEVEL_THRESHOLDS
        .filter(t => t.level <= levelInfo.level)
        .map(t => t.theme);

      return {
        userId: doc.userId,
        xp: doc.xp,
        level: levelInfo.level,
        levelTitle: levelInfo.title,
        levelProgressPercent: levelInfo.progressPercent,
        xpForNextLevel: levelInfo.xpForNextLevel,
        streakCount: doc.streakCount,
        bestStreak: doc.bestStreak,
        lastActiveDate: doc.lastActiveDate,
        streakFreezesAvailable: doc.streakFreezesAvailable,
        unlockedBadges: badges,
        currentTheme: doc.currentTheme,
        unlockedThemes,
        dailyStaminaMax: doc.dailyStaminaMax || 100,
      };
    } catch (err) {
      logger.warn('Failed to fetch gamification from MongoDB, falling back to SQLite:', err.message);
    }
  }

  // SQLite Fallback
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
 */
export async function calculateDailyStamina(userId = 'default_user', dateStr = null, existingEvents = []) {
  const targetDate = dateStr || DateTime.now().setZone(TIMEZONE).toFormat('yyyy-MM-dd');

  let tasksForDay = [];

  if (isMongoConnected()) {
    try {
      tasksForDay = await Task.find({
        $or: [
          { dueDate: targetDate },
          { scheduledStart: new RegExp(`^${targetDate}`) },
          { completedAt: { $gte: new Date(targetDate), $lt: new Date(DateTime.fromISO(targetDate).plus({ days: 1 }).toISODate()) } },
        ],
      }).lean();
    } catch {
      // Fallback to SQLite
    }
  }

  if (tasksForDay.length === 0) {
    tasksForDay = db.prepare(`
      SELECT * FROM tasks
      WHERE user_id = ?
        AND (
          due_date = ?
          OR scheduled_start LIKE ?
          OR (completed_at LIKE ? AND status = 'done')
        )
    `).all(userId, targetDate, `${targetDate}%`, `${targetDate}%`);
  }

  let staminaUsed = 0;

  for (const t of tasksForDay) {
    const mins = t.estimated_minutes || t.estimatedMinutes || 30;
    let cost = 10;
    if (mins > 60) cost = 35;
    else if (mins > 30) cost = 20;

    if (t.priority === 'urgent') cost = Math.round(cost * 1.3);
    else if (t.priority === 'high') cost = Math.round(cost * 1.15);

    staminaUsed += cost;
  }

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
 * Awards XP and updates streaks & badges upon task completion.
 * Syncs directly to MongoDB when connected, making XP consistent across all devices!
 */
export async function recordTaskCompletion(userId = 'default_user', task) {
  const profile = await getOrCreateUserGamification(userId);
  const nowWAT = DateTime.now().setZone(TIMEZONE);
  const todayStr = nowWAT.toFormat('yyyy-MM-dd');
  const yesterdayStr = nowWAT.minus({ days: 1 }).toFormat('yyyy-MM-dd');

  // 1. Calculate XP earned
  const mins = task.estimated_minutes || task.estimatedMinutes || 30;
  let xpEarned = Math.max(15, mins);

  if (task.priority === 'urgent') xpEarned += 25;
  else if (task.priority === 'high') xpEarned += 15;
  else if (task.priority === 'medium') xpEarned += 5;

  if (mins >= 60) xpEarned += 20;

  if (profile.streakCount >= 7) xpEarned = Math.round(xpEarned * 1.25);
  else if (profile.streakCount >= 3) xpEarned = Math.round(xpEarned * 1.1);

  // 2. Streaks and Freezes
  let newStreak = profile.streakCount;
  let newBestStreak = profile.bestStreak;
  let freezesAvailable = profile.streakFreezesAvailable;
  let freezeUsed = false;

  if (profile.lastActiveDate === todayStr) {
    // Already active today
  } else if (profile.lastActiveDate === yesterdayStr || !profile.lastActiveDate) {
    newStreak = (profile.streakCount || 0) + 1;
    if (newStreak > newBestStreak) newBestStreak = newStreak;
  } else {
    const lastActive = DateTime.fromISO(profile.lastActiveDate, { zone: TIMEZONE });
    const daysMissed = Math.floor(nowWAT.diff(lastActive, 'days').days);

    if (daysMissed === 2 && freezesAvailable > 0) {
      freezesAvailable -= 1;
      freezeUsed = true;
      newStreak = (profile.streakCount || 0) + 1;
      if (newStreak > newBestStreak) newBestStreak = newStreak;
      logger.info(`❄️ Streak freeze consumed for ${userId}! Streak preserved at ${newStreak}.`);
    } else {
      newStreak = 1;
    }
  }

  // 3. Badges Check
  const currentBadgeIds = (profile.unlockedBadges || []).map(b => (typeof b === 'string' ? b : b.id));
  const newlyUnlockedBadges = [];

  const tryAwardBadge = (badgeId) => {
    if (!currentBadgeIds.includes(badgeId)) {
      currentBadgeIds.push(badgeId);
      newlyUnlockedBadges.push(BADGE_DEFINITIONS[badgeId] || { id: badgeId });
    }
  };

  tryAwardBadge('novice_adventurer');
  if (mins >= 60) tryAwardBadge('deep_work_focus');
  if (newStreak >= 3) tryAwardBadge('streak_cadet');
  if (newStreak >= 7) tryAwardBadge('streak_veteran');
  if (newStreak >= 14) tryAwardBadge('streak_legend');

  const newTotalXp = profile.xp + xpEarned;
  const oldLevel = profile.level;
  const levelInfo = calculateLevelFromXp(newTotalXp);
  const levelUp = levelInfo.level > oldLevel;
  const now = new Date().toISOString();

  // 4. Update MongoDB if connected
  if (isMongoConnected()) {
    try {
      await Gamification.findOneAndUpdate(
        { userId: profile.userId },
        {
          $set: {
            xp: newTotalXp,
            level: levelInfo.level,
            streakCount: newStreak,
            bestStreak: newBestStreak,
            lastActiveDate: todayStr,
            streakFreezesAvailable: freezesAvailable,
            unlockedBadges: currentBadgeIds,
          },
        },
        { upsert: true }
      );

      await XpLog.create({
        userId: profile.userId,
        taskId: task.id || null,
        amount: xpEarned,
        reason: `Completed task: ${task.title || 'Untitled Task'}`,
      });
    } catch (err) {
      logger.warn('Failed to update gamification in MongoDB:', err.message);
    }
  }

  // Also update SQLite fallback
  try {
    db.prepare(`
      UPDATE user_gamification
      SET xp = ?, level = ?, streak_count = ?, best_streak = ?,
          last_active_date = ?, streak_freezes_available = ?,
          unlocked_badges = ?, updated_at = ?
      WHERE user_id = ?
    `).run(
      newTotalXp,
      levelInfo.level,
      newStreak,
      newBestStreak,
      todayStr,
      freezesAvailable,
      JSON.stringify(currentBadgeIds),
      now,
      userId
    );
  } catch {}

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

export async function setUserTheme(userId = 'default_user', theme = 'emerald') {
  const profile = await getOrCreateUserGamification(userId);
  if (!profile.unlockedThemes.includes(theme)) {
    throw new Error(`Theme "${theme}" is locked. Level up to unlock it!`);
  }

  if (isMongoConnected()) {
    try {
      await Gamification.findOneAndUpdate(
        { userId: profile.userId },
        { $set: { currentTheme: theme } }
      );
    } catch {}
  }

  try {
    db.prepare('UPDATE user_gamification SET current_theme = ?, updated_at = ? WHERE user_id = ?')
      .run(theme, new Date().toISOString(), userId);
  } catch {}

  return { success: true, theme };
}
