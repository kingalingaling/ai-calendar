import React, { useState } from 'react';
import { Hourglass, CheckCircle2, AlertCircle, Clock, Trash2, ArrowRight, CornerDownRight } from 'lucide-react';
import { DateTime } from 'luxon';

export function WaitingForView({
  waitingTasks = [],
  onUnblockTask,
  onDeleteTask,
  onUpdateTask,
  isLoading,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editReason, setEditReason] = useState('');

  const formatWaitingDuration = (sinceIso) => {
    if (!sinceIso) return 'Recently marked';
    const since = DateTime.fromISO(sinceIso);
    const diffDays = Math.floor(DateTime.now().diff(since, 'days').days);
    const diffHours = Math.floor(DateTime.now().diff(since, 'hours').hours);

    if (diffDays > 0) {
      return `Waiting for ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    }
    if (diffHours > 0) {
      return `Waiting for ${diffHours} hr${diffHours !== 1 ? 's' : ''}`;
    }
    return 'Waiting since today';
  };

  const handleStartEdit = (task) => {
    setEditingId(task.id);
    setEditReason(task.waitingReason || '');
  };

  const handleSaveReason = async (taskId) => {
    if (onUpdateTask) {
      await onUpdateTask(taskId, { waitingReason: editReason });
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="bg-amber-950/20 border border-amber-800/40 rounded-2xl p-4 shadow-lg space-y-1.5">
        <div className="flex items-center gap-2">
          <Hourglass className="w-5 h-5 text-amber-400 animate-pulse" />
          <h2 className="text-base font-bold text-neutral-100">Waiting For / External Blockers</h2>
          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 ml-auto">
            {waitingTasks.length}
          </span>
        </div>
        <p className="text-xs text-amber-300/80">
          Tasks blocked by external approvals (like boss reviews or client sign-offs) are kept here and filtered out of your active daily agenda until approved.
        </p>
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-neutral-500">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : waitingTasks.length === 0 ? (
        <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-2xl p-10 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-950/40 border border-emerald-800/30 text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-200">Zero Blocked Tasks</h3>
          <p className="text-xs text-neutral-500 max-w-xs mx-auto">
            You have no tasks waiting on boss reviews or external sign-offs. Your daily schedule is ready to execute!
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {waitingTasks.map((task) => (
            <div
              key={task.id}
              className="bg-neutral-900/80 border border-neutral-800/90 hover:border-amber-700/50 rounded-2xl p-4 space-y-3 shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  {/* Context & Project Tag */}
                  <div className="flex items-center gap-1.5 flex-wrap">
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

                    {task.project && (
                      <span className="text-[10px] text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded-md border border-neutral-750">
                        📁 {task.project.name}
                      </span>
                    )}

                    <span className="text-[10px] font-mono text-amber-400/90 bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-800/40 flex items-center gap-1 ml-auto">
                      <Clock className="w-3 h-3" />
                      <span>{formatWaitingDuration(task.waitingSince)}</span>
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-neutral-100 truncate">
                    {task.title}
                  </h3>

                  {task.description && (
                    <p className="text-xs text-neutral-400 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => onDeleteTask(task.id)}
                  className="p-1.5 text-neutral-500 hover:text-red-400 rounded-lg hover:bg-neutral-800 transition-colors"
                  title="Delete Task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Blocker Reason Box */}
              <div className="bg-neutral-950 border border-amber-900/40 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-400 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>External Blocker:</span>
                  </span>

                  {editingId !== task.id && (
                    <button
                      onClick={() => handleStartEdit(task)}
                      className="text-[10px] text-neutral-500 hover:text-neutral-300"
                    >
                      Edit reason
                    </button>
                  )}
                </div>

                {editingId === task.id ? (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      placeholder="e.g. Waiting for boss review on slide deck"
                      className="flex-1 bg-neutral-900 border border-neutral-750 rounded-lg px-2.5 py-1 text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={() => handleSaveReason(task.id)}
                      className="px-2.5 py-1 text-xs bg-amber-500 text-neutral-950 font-semibold rounded-lg hover:bg-amber-400"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-neutral-300 italic">
                    "{task.waitingReason || 'Awaiting external approval'}"
                  </p>
                )}
              </div>

              {/* Unblock Action CTA */}
              <div className="flex items-center justify-end pt-1">
                <button
                  onClick={() => onUnblockTask(task.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 shadow-md shadow-emerald-500/10 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approved! Move to Active To-Do</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
