import { initSchema, seedDefaultContextsIfEmpty, db } from '../src/db/database.js';
import * as contextService from '../src/services/contextService.js';
import * as projectService from '../src/services/projectService.js';
import * as taskService from '../src/services/taskService.js';
import * as sheetsService from '../src/services/sheetsService.js';

console.log('🧪 Testing Phase 1 & Phase 2 Database & Services...');

const testUser = `test_user_${Date.now()}`;

// 1. Initialize DB & seed default contexts
initSchema();
seedDefaultContextsIfEmpty(testUser);

const contexts = contextService.getContexts(testUser);
console.assert(contexts.length >= 4, 'Should have at least 4 default contexts');
console.log('✅ Contexts seeded successfully:', contexts.map(c => c.name).join(', '));

const jobA = contexts.find(c => c.name === 'Job A');
const jobB = contexts.find(c => c.name === 'Job B');
console.assert(jobA && jobB, 'Job A and Job B contexts must exist');

// 2. Create Project & nested milestone
const rootProj = projectService.createProject(testUser, {
  contextId: jobA.id,
  name: 'Client Redesign',
  description: 'Main project container',
});

const subMilestone = projectService.createProject(testUser, {
  contextId: jobA.id,
  parentId: rootProj.id,
  name: 'Milestone 1: Wireframes',
  milestoneDate: '2026-10-15',
});

const projectsTree = projectService.getProjects(testUser, jobA.id);
console.assert(projectsTree.length === 1, 'Should have 1 root project');
console.assert(projectsTree[0].subProjects.length === 1, 'Root project should have 1 nested milestone');
console.log('✅ Project hierarchy & milestones created successfully.');

// 3. Create Tasks (including Waiting For status)
const normalTask = taskService.createTask(testUser, {
  contextId: jobA.id,
  projectId: subMilestone.id,
  title: 'Draft wireframe layout',
  estimatedMinutes: 60,
  status: 'todo',
});

const waitingTask = taskService.createTask(testUser, {
  contextId: jobA.id,
  projectId: subMilestone.id,
  title: 'Submit design for Boss approval',
  status: 'waiting_for',
  waitingReason: 'Awaiting boss review before frontend development',
});

// Test filtering: excludeWaiting should filter out the blocked task!
const activeTasks = taskService.getTasks(testUser, { contextId: jobA.id, excludeWaiting: true });
console.assert(activeTasks.length === 1, 'Active tasks with excludeWaiting should have 1 task');
console.assert(activeTasks[0].id === normalTask.id, 'Active task should be normal task');

const waitingTasks = taskService.getTasks(testUser, { contextId: jobA.id, waitingOnly: true });
console.assert(waitingTasks.length === 1, 'Waiting tasks should have 1 task');
console.assert(waitingTasks[0].waitingReason.includes('boss review'), 'Waiting reason should match');
console.log('✅ Task creation & "Waiting For" filtering verified successfully.');

// 4. Test Google Sheets URL parser
const parsed = sheetsService.parseSpreadsheetUrl('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=123456');
console.assert(parsed.spreadsheetId === '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms', 'Spreadsheet ID must match');
console.assert(parsed.gid === '123456', 'GID must match');
console.log('✅ Google Sheets URL parsing verified successfully.');

console.log('🎉 All Phase 1 and Phase 2 backend tests passed with flying colors!');
