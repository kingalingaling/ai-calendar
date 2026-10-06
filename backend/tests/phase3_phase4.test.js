import assert from 'assert';
import { db, initSchema, seedDefaultContextsIfEmpty } from '../src/db/database.js';
import * as gamificationService from '../src/services/gamificationService.js';
import * as autoScheduleService from '../src/services/autoScheduleService.js';
import * as taskService from '../src/services/taskService.js';
import * as contextService from '../src/services/contextService.js';

console.log('🧪 Testing Phase 3 (Intelligent Time Blocking) & Phase 4 (Gamification)...');

// Initialize schema
initSchema();

const testUser = `test_hero_${Date.now()}`;
seedDefaultContextsIfEmpty(testUser);

const contexts = contextService.getContexts(testUser);
const jobA = contexts.find(c => c.name === 'Job A');
const jobB = contexts.find(c => c.name === 'Job B');

assert.ok(jobA, 'Job A context should exist');
assert.ok(jobB, 'Job B context should exist');

// 1. Test Gamification: Profile Initialization
console.log('1️⃣ Testing Gamification Profile & XP System...');
const initialProfile = gamificationService.getOrCreateUserGamification(testUser);
assert.strictEqual(initialProfile.level, 1, 'Initial level should be 1');
assert.strictEqual(initialProfile.xp, 0, 'Initial XP should be 0');
assert.strictEqual(initialProfile.streakFreezesAvailable, 2, 'Should start with 2 streak freezes');

// 2. Test Gamification: Task Completion & XP Awarding
const dummyTask1 = {
  id: `task-gamify-1-${Date.now()}`,
  title: 'Audit Financial Balance Sheet',
  estimated_minutes: 60,
  priority: 'high',
  source: 'manual',
};

const xpResult1 = gamificationService.recordTaskCompletion(testUser, dummyTask1);
assert.ok(xpResult1.xpEarned >= 60, 'XP earned should be >= 60 for 60-min high priority task');
assert.strictEqual(xpResult1.streakCount, 1, 'Streak should increment to 1');
assert.ok(
  xpResult1.newlyUnlockedBadges.some(b => b.id === 'novice_adventurer'),
  'Should unlock novice_adventurer badge'
);
assert.ok(
  xpResult1.newlyUnlockedBadges.some(b => b.id === 'deep_work_focus'),
  'Should unlock deep_work_focus badge for 60-min task'
);
console.log(`✅ Awarded ${xpResult1.xpEarned} XP! Badges unlocked: ${xpResult1.newlyUnlockedBadges.map(b => b.name).join(', ')}`);

// 3. Test Gamification: Daily Stamina Calculation
const stamina = gamificationService.calculateDailyStamina(testUser);
assert.strictEqual(stamina.maxStamina, 100, 'Max stamina should be 100');
assert.ok(stamina.staminaRemaining <= 100, 'Remaining stamina should be <= 100');
console.log(`✅ Daily Stamina: ${stamina.staminaUsed}/100 used (${stamina.staminaRemaining} remaining, Burnout Risk: ${stamina.burnoutRisk})`);

// 4. Test Phase 3: Create Tasks for Job A and Job B
console.log('2️⃣ Testing Intelligent Time Blocking with Context Hours & Buffers...');
const taskJobA1 = taskService.createTask(testUser, {
  contextId: jobA.id,
  title: 'Job A Deep Architecture',
  estimatedMinutes: 60,
  priority: 'urgent',
});

const taskJobA2 = taskService.createTask(testUser, {
  contextId: jobA.id,
  title: 'Job A Client Brief',
  estimatedMinutes: 45,
  priority: 'high',
});

const taskJobB1 = taskService.createTask(testUser, {
  contextId: jobB.id,
  title: 'Job B Code Review',
  estimatedMinutes: 45,
  priority: 'medium',
});

// Run Auto-Schedule Engine
const schedulePlan = await autoScheduleService.planAutoSchedule({
  userId: testUser,
  authClient: null, // Demo/mock mode
  targetDate: '2026-10-07',
  allowSpillover: true,
  minBufferMinutes: 10,
});

assert.strictEqual(schedulePlan.success, true, 'Auto-schedule should succeed');
assert.ok(schedulePlan.totalScheduled >= 3, 'Should have scheduled at least 3 tasks');

const allScheduledItems = schedulePlan.scheduledDays.flatMap(d => d.items);

// Verify Job A tasks are scheduled within Job A window (09:00 - 13:00)
const scheduledJobA = allScheduledItems.filter(i => i.contextId === jobA.id);
for (const item of scheduledJobA) {
  const startHour = new Date(item.start).getUTCHours() + 1; // WAT UTC+1
  assert.ok(
    startHour >= 9 && startHour <= 13,
    `Job A task "${item.title}" (${item.start}) must start within Job A window 09:00-13:00`
  );
}

// Verify Job B tasks are scheduled within Job B window (13:30 - 17:30)
const scheduledJobB = allScheduledItems.filter(i => i.contextId === jobB.id);
for (const item of scheduledJobB) {
  const startHour = new Date(item.start).getUTCHours() + 1;
  assert.ok(
    startHour >= 13,
    `Job B task "${item.title}" (${item.start}) must start within Job B window (13:30 onwards)`
  );
}

// Verify buffers between consecutive items
for (let i = 0; i < allScheduledItems.length - 1; i++) {
  const itemA = allScheduledItems[i];
  const itemB = allScheduledItems[i + 1];
  if (itemA.day === itemB.day) {
    const endA = new Date(itemA.end).getTime();
    const startB = new Date(itemB.start).getTime();
    const gapMinutes = (startB - endA) / (1000 * 60);
    assert.ok(
      gapMinutes >= 10,
      `Consecutive tasks must have at least 10 min buffer (found ${gapMinutes} min between "${itemA.title}" and "${itemB.title}")`
    );
  }
}

console.log(`✅ All ${allScheduledItems.length} tasks scheduled with context isolation and burnout buffers!`);

// 5. Test Auto-Commit to Google Tasks & Calendar
console.log('3️⃣ Testing Auto-Commit to Calendar & Google Tasks...');
const commitResult = await autoScheduleService.commitAutoScheduledTasks({
  userId: testUser,
  authClient: null,
  scheduledTasks: allScheduledItems,
});

assert.strictEqual(commitResult.success, true, 'Commit should succeed');
assert.strictEqual(commitResult.count, allScheduledItems.length, 'All tasks should be committed');

// Check that SQLite task records were updated with scheduled_start and scheduled_end
const updatedTask = taskService.getTaskById(testUser, taskJobA1.id);
assert.ok(updatedTask.scheduledStart, 'Task should have scheduledStart populated');
assert.ok(updatedTask.scheduledEnd, 'Task should have scheduledEnd populated');

console.log('✅ Tasks successfully committed and SQLite records updated with scheduled timestamps!');
console.log('🎉 All Phase 3 and Phase 4 backend integration tests PASSED with 100% success!');
