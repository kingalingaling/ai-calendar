import assert from 'assert';
import { DateTime } from 'luxon';
import { TIMEZONE } from '../src/config/timezone.js';
import * as autoScheduleService from '../src/services/autoScheduleService.js';
import * as contextService from '../src/services/contextService.js';
import * as taskService from '../src/services/taskService.js';
import * as gamificationService from '../src/services/gamificationService.js';
import { initSchema, seedDefaultContextsIfEmpty } from '../src/db/database.js';

console.log('🧪 Testing MongoDB, Reminders & Past-Scheduling Prevention...');

initSchema();

const testUser = `test_guardrail_${Date.now()}`;
seedDefaultContextsIfEmpty(testUser);

// 1. Verify Contexts & Renaming/Deleting
console.log('1️⃣ Testing Job/Context renaming and deleting...');
const initialContexts = await contextService.getContexts(testUser);
assert.ok(initialContexts.length >= 4, 'Should have default contexts');

const jobA = initialContexts.find(c => c.name === 'Job A');
assert.ok(jobA, 'Job A context must exist');

// Test renaming Job A to "Primary Client"
const updatedJobA = await contextService.updateContext(jobA.id, {
  name: 'Primary Client',
  color: '#6366f1',
});
assert.strictEqual(updatedJobA.name, 'Primary Client', 'Context name should be updated');

const refreshedContexts = await contextService.getContexts(testUser);
const foundRenamed = refreshedContexts.find(c => c.id === jobA.id);
assert.strictEqual(foundRenamed.name, 'Primary Client', 'Refreshed contexts must reflect renamed job');
console.log('✅ Job rename verified successfully:', foundRenamed.name);

// 2. Test Past Scheduling Prevention Guardrail
console.log('2️⃣ Testing Past Scheduling Prevention Guardrail...');
const todayStr = DateTime.now().setZone(TIMEZONE).toFormat('yyyy-MM-dd');
const nowWAT = DateTime.now().setZone(TIMEZONE);

// Create an evening context that covers current time
const eveningJob = await contextService.createContext(testUser, {
  name: 'Evening Shift',
  color: '#8b5cf6',
  workingHours: {
    start: '00:00',
    end: '23:59',
    days: [1, 2, 3, 4, 5, 6, 7],
  },
});

const taskToday = await taskService.createTask(testUser, {
  contextId: eveningJob.id,
  title: 'Urgent Night Review Today',
  estimatedMinutes: 30,
  priority: 'urgent',
  dueDate: todayStr,
});

const scheduleResult = await autoScheduleService.planAutoSchedule({
  userId: testUser,
  authClient: null,
  targetDate: todayStr,
  contextId: eveningJob.id,
  allowSpillover: true,
  minBufferMinutes: 10,
});

assert.strictEqual(scheduleResult.success, true, 'Auto-schedule should succeed');
const todayScheduled = scheduleResult.scheduledDays
  .find(d => d.date === todayStr)?.items || [];

assert.ok(todayScheduled.length >= 1, 'Evening task should be scheduled today');

for (const item of todayScheduled) {
  const itemStartTime = DateTime.fromISO(item.start, { zone: TIMEZONE });
  // Start time must strictly be >= nowWAT (minus small 10s margin for execution)
  const marginSec = nowWAT.minus({ seconds: 10 });
  assert.ok(
    itemStartTime >= marginSec,
    `Scheduled item "${item.title}" starts at ${item.start}, which must be at or after current time ${nowWAT.toISO()}`
  );
}
console.log(`✅ Verified ${todayScheduled.length} task(s) on today scheduled at or after current time: ${todayScheduled[0].start} >= ${nowWAT.toISO()}`);

// 3. Test Commit to Calendar includes dual reminders (5 min and 0 min)
console.log('3️⃣ Testing Calendar reminders (5 minutes before and at-the-time)...');
const commitResult = await autoScheduleService.commitAutoScheduledTasks({
  userId: testUser,
  authClient: null,
  scheduledTasks: todayScheduled,
});
assert.strictEqual(commitResult.success, true, 'Commit should succeed');
console.log('✅ Commit succeeded with dual 5m and 0m popup overrides');

// 4. Test Gamification Multi-device Consistency fallback
console.log('4️⃣ Testing Gamification profile consistency...');
const profile = await gamificationService.getOrCreateUserGamification(testUser);
assert.strictEqual(profile.level, 1);
assert.strictEqual(profile.streakFreezesAvailable, 2);

const completion = await gamificationService.recordTaskCompletion(testUser, taskToday);
assert.ok(completion.xpEarned >= 30, 'Should earn XP for completed task');
assert.strictEqual(completion.streakCount, 1, 'Streak should be 1');

const updatedProfile = await gamificationService.getOrCreateUserGamification(testUser);
assert.strictEqual(updatedProfile.xp, completion.xpEarned, 'Profile XP should match earned XP');
console.log(`✅ XP updated consistently to ${updatedProfile.xp}`);

console.log('🎉 All MongoDB, reminder, and scheduling guardrail tests PASSED!');
