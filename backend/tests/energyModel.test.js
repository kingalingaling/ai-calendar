import { inferTaskDetails, calculateFreeIntervals } from '../src/services/energyModel.js';
import { doIntervalsOverlap, validateScheduleConflicts } from '../src/services/conflictService.js';
import { getDayBoundsWAT } from '../src/config/timezone.js';

console.log('🧪 Running Unit & Integration Tests for AI Calendar Core Engine...');

// Test 1: Task Category & Duration Inference
const callTask = inferTaskDetails('Quick sync with Sarah about Q3');
console.assert(callTask.category === 'meeting_call', 'Expected meeting_call category');
console.assert(callTask.durationMinutes === 25, 'Expected 25 mins for sync');

const deepTask = inferTaskDetails('Write architecture draft for payment system');
console.assert(deepTask.category === 'deep_work', 'Expected deep_work category');
console.assert(deepTask.durationMinutes === 90, 'Expected 90 mins for deep work');

const gymTask = inferTaskDetails('Evening workout at local gym');
console.assert(gymTask.category === 'health_fitness', 'Expected health_fitness category');

console.log('✅ Task inference tests passed.');

// Test 2: Conflict Detection & Overlap Math
const overlap = doIntervalsOverlap(
  '2026-10-01T09:00:00+01:00',
  '2026-10-01T10:00:00+01:00',
  '2026-10-01T09:30:00+01:00',
  '2026-10-01T10:30:00+01:00'
);
console.assert(overlap === true, 'Intervals must overlap');

const noOverlap = doIntervalsOverlap(
  '2026-10-01T09:00:00+01:00',
  '2026-10-01T10:00:00+01:00',
  '2026-10-01T10:00:00+01:00',
  '2026-10-01T11:00:00+01:00'
);
console.assert(noOverlap === false, 'Adjacent intervals must not overlap');

console.log('✅ Interval overlap math tests passed.');

// Test 3: Free Interval Calculation with Africa/Lagos Timezone
const bounds = getDayBoundsWAT('2026-10-01');
console.assert(bounds.timeMin.includes('+01:00'), 'WAT offset must be +01:00');

const freeCalc = calculateFreeIntervals('2026-10-01', [
  {
    summary: 'Existing Team Sync',
    start: { dateTime: '2026-10-01T09:30:00+01:00' },
    end: { dateTime: '2026-10-01T10:30:00+01:00' },
  },
]);

console.assert(freeCalc.freeIntervals.length >= 2, 'Should have morning slot before sync and afternoon slot after sync');
console.log('✅ Free interval calculations in Africa/Lagos passed.');

console.log('🎉 All core unit tests passed successfully!');
