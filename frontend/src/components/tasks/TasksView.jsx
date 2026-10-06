import React, { useState } from 'react';
import {
  Plus, CheckCircle2, Circle, AlertCircle, Clock, Trash2, Folder,
  ChevronDown, ChevronRight, FileSpreadsheet, Hourglass, Sparkles
} from 'lucide-react';

export function TasksView({
  tasks = [],
  projects = [],
  contexts = [],
  activeContextId,
  onToggleTaskComplete,
  onMarkTaskWaiting,
  onDeleteTask,
  onCreateTask,
  onCreateProject,
  onOpenSheetsSync,
  onOpenAutoBlock,
  isLoading,
}) {
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContextId, setNewContextId] = useState(activeContextId || (contexts[0]?.id || ''));
  const [newProjectId, setNewProjectId] = useState('');
  const [newEstimate, setNewEstimate] = useState(30);
  const [newPriority, setNewPriority] = useState('medium');
  const [newStatus, setNewStatus] = useState('todo');
  const [newWaitingReason, setNewWaitingReason] = useState('');

  // Blocker prompt modal state
  const [promptTaskId, setPromptTaskId] = useState(null);
  const [blockerInput, setBlockerInput] = useState('');

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    await onCreateTask({
      title: newTitle.trim(),
      contextId: newContextId || contexts[0]?.id,
      projectId: newProjectId || null,
      estimatedMinutes: parseInt(newEstimate, 10) || 30,
      priority: newPriority,
      status: newStatus,
      waitingReason: newStatus === 'waiting_for' ? blockerInput : null,
    });

    setNewTitle('');
    setBlockerInput('');
    setIsCreatingTask(false);
  };

  const handleConfirmWaiting = async () => {
    if (!promptTaskId || !blockerInput.trim()) return;
    await onMarkTaskWaiting(promptTaskId, blockerInput.trim());
    setPromptTaskId(null);
    setBlockerInput('');
  };

  return (
    <div className="space-y-4">
      {/* Top Controls: Add Task, Auto-Block & Google Sheets Ingestion */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => {
            setNewContextId(activeContextId || (contexts[0]?.id || ''));
            setIsCreatingTask(true);
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-neutral-950 font-semibold text-xs shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>

        {onOpenAutoBlock && (
          <button
            onClick={onOpenAutoBlock}
            className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 text-xs font-medium transition-colors cursor-pointer"
            title="Auto-schedule tasks into open calendar slots with burnout buffers"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Auto-Block</span>
          </button>
        )}

        {onOpenSheetsSync && (
          <button
            onClick={onOpenSheetsSync}
            className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 text-xs font-medium transition-colors cursor-pointer"
            title="Import tasks from a view-only Google Sheet"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Sheets</span>
          </button>
        )}
      </div>

      {/* Inline Task Creator Drawer */}
      {isCreatingTask && (
        <form onSubmit={handleQuickAdd} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-3 shadow-xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <span className="text-xs font-semibold text-neutral-200">Create Task</span>
            <button
              type="button"
              onClick={() => setIsCreatingTask(false)}
              className="text-xs text-neutral-500 hover:text-white"
            >
              Cancel
            </button>
          </div>

          <input
            type="text"
            required
            autoFocus
            placeholder="Task title (e.g. Prepare Q3 sprint review)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
          />

          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Context Selector */}
            <div>
              <label className="text-[10px] text-neutral-400">Context</label>
              <select
                value={newContextId}
                onChange={(e) => setNewContextId(e.target.value)}
                className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-xl px-2 py-1.5 text-neutral-200 focus:outline-none"
              >
                {contexts.map((ctx) => (
                  <option key={ctx.id} value={ctx.id}>
                    {ctx.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Project Selector */}
            <div>
              <label className="text-[10px] text-neutral-400">Project / Milestone</label>
              <select
                value={newProjectId}
                onChange={(e) => setNewProjectId(e.target.value)}
                className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-xl px-2 py-1.5 text-neutral-200 focus:outline-none"
              >
                <option value="">(None / General)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[10px] text-neutral-400">Estimate (Mins)</label>
              <input
                type="number"
                step="5"
                min="5"
                value={newEstimate}
                onChange={(e) => setNewEstimate(e.target.value)}
                className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-neutral-200 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-neutral-400">Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-xl px-2 py-1.5 text-neutral-200 focus:outline-none"
              >
                <option value="todo">To-Do</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting_for">Waiting For Approval</option>
              </select>
            </div>
          </div>

          {newStatus === 'waiting_for' && (
            <div>
              <label className="text-[10px] text-amber-400">Blocker Reason (e.g. Waiting for Boss Review)</label>
              <input
                type="text"
                placeholder="Who or what is this waiting on?"
                value={blockerInput}
                onChange={(e) => setBlockerInput(e.target.value)}
                className="w-full mt-1 bg-neutral-950 border border-amber-900/60 rounded-xl px-3 py-1.5 text-xs text-neutral-200 focus:outline-none"
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-neutral-950 font-semibold text-xs cursor-pointer transition-all"
          >
            Add Task
          </button>
        </form>
      )}

      {/* Task List */}
      <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-4 shadow-xl space-y-3 min-h-[360px]">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
          <span className="text-xs font-semibold text-neutral-300">
            Active Tasks ({tasks.length})
          </span>
          <span className="text-[10px] text-neutral-500">
            Excludes "Waiting For" tasks
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-neutral-500">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-neutral-500 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-neutral-800/50 flex items-center justify-center text-neutral-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-neutral-300">No active tasks in this context</p>
            <p className="text-xs text-neutral-500 max-w-xs">
              Tap <span className="text-emerald-400">New Task</span> or use the AI Schedule Brain Dump to add tasks.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {tasks.map((task) => {
              const isDone = task.status === 'done';
              return (
                <div
                  key={task.id}
                  className={`border rounded-xl p-3 flex items-start gap-3 transition-all ${
                    isDone
                      ? 'bg-neutral-950/40 border-neutral-900 opacity-60'
                      : 'bg-neutral-950/80 border-neutral-800/90 hover:border-neutral-700'
                  }`}
                >
                  {/* Complete Checkbox */}
                  <button
                    type="button"
                    onClick={() => onToggleTaskComplete(task.id, !isDone)}
                    className="mt-0.5 text-neutral-400 hover:text-emerald-400 transition-colors shrink-0 cursor-pointer"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-950" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Context Tag */}
                      {task.context && (
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-md border"
                          style={{
                            backgroundColor: `${task.context.color}22`,
                            color: task.context.color,
                            borderColor: `${task.context.color}44`,
                          }}
                        >
                          {task.context.name}
                        </span>
                      )}

                      {/* Project Tag */}
                      {task.project && (
                        <span className="text-[10px] text-neutral-400 bg-neutral-850 px-2 py-0.5 rounded-md border border-neutral-800">
                          📁 {task.project.name}
                        </span>
                      )}

                      <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
                        {task.estimatedMinutes}m
                      </span>

                      {task.source === 'google_sheets' && (
                        <span className="text-[9px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/40 flex items-center gap-0.5">
                          <FileSpreadsheet className="w-2.5 h-2.5" />
                          <span>Sheet</span>
                        </span>
                      )}
                    </div>

                    <h3 className={`text-sm font-semibold truncate ${isDone ? 'line-through text-neutral-500' : 'text-neutral-100'}`}>
                      {task.title}
                    </h3>

                    {task.description && (
                      <p className="text-xs text-neutral-400 line-clamp-1">
                        {task.description}
                      </p>
                    )}
                  </div>

                  {/* Actions: Block (Waiting For) or Delete */}
                  <div className="flex items-center gap-1">
                    {!isDone && (
                      <button
                        onClick={() => {
                          setPromptTaskId(task.id);
                          setBlockerInput('');
                        }}
                        className="p-1.5 text-neutral-500 hover:text-amber-400 rounded-lg hover:bg-neutral-800 transition-colors"
                        title="Mark as Waiting on External Approval"
                      >
                        <Hourglass className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="p-1.5 text-neutral-500 hover:text-red-400 rounded-lg hover:bg-neutral-800 transition-colors"
                      title="Delete Task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Blocker Reason Prompt Modal */}
      {promptTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-2xl">
            <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-1.5 text-amber-400">
              <Hourglass className="w-4 h-4" />
              <span>Mark as Waiting For Approval</span>
            </h3>
            <p className="text-xs text-neutral-400">
              This task will be filtered out of your daily agenda until approval is received.
            </p>

            <input
              type="text"
              autoFocus
              placeholder="e.g. Waiting for boss review on budget"
              value={blockerInput}
              onChange={(e) => setBlockerInput(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
            />

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPromptTaskId(null)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!blockerInput.trim()}
                onClick={handleConfirmWaiting}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-neutral-950 disabled:opacity-50"
              >
                Move to Waiting For
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
