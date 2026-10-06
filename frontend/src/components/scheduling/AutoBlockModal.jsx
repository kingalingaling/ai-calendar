import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Calendar,
  Clock,
  ShieldCheck,
  Check,
  AlertTriangle,
  ArrowRight,
  Layers,
  RefreshCw,
  Bell,
} from 'lucide-react';
import { api } from '../../api/client.js';

export function AutoBlockModal({
  isOpen,
  onClose,
  contexts = [],
  activeContextId,
  onCommitSuccess,
}) {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [selectedContextId, setSelectedContextId] = useState(activeContextId || '');
  const [minBufferMinutes, setMinBufferMinutes] = useState(10);
  const [allowSpillover, setAllowSpillover] = useState(true);

  // Proposal State
  const [isPlanning, setIsPlanning] = useState(false);
  const [planResult, setPlanResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Commit State
  const [isCommitting, setIsCommitting] = useState(false);

  if (!isOpen) return null;

  const handleGeneratePlan = async () => {
    setIsPlanning(true);
    setErrorMsg(null);
    try {
      const res = await api.post('/schedule/auto-block', {
        targetDate: selectedDate,
        contextId: selectedContextId || null,
        minBufferMinutes: parseInt(minBufferMinutes, 10) || 10,
        allowSpillover,
      });

      setPlanResult(res.data);
    } catch (err) {
      console.error('Auto block planning failed:', err);
      setErrorMsg(
        err.response?.data?.message || 'Failed to calculate open calendar slots.'
      );
    } finally {
      setIsPlanning(false);
    }
  };

  const handleCommitSchedule = async () => {
    if (!planResult || planResult.totalScheduled === 0) return;

    setIsCommitting(true);
    setErrorMsg(null);
    try {
      const allTasksToCommit = (planResult.scheduledDays || []).flatMap(
        (d) => d.items
      );

      const res = await api.post('/schedule/commit-tasks', {
        scheduledTasks: allTasksToCommit,
      });

      if (onCommitSuccess) {
        onCommitSuccess(res.data);
      }

      onClose();
    } catch (err) {
      console.error('Failed to commit scheduled tasks:', err);
      setErrorMsg('Failed to commit scheduled tasks to Google Calendar & Google Tasks.');
    } finally {
      setIsCommitting(false);
    }
  };

  const allItems = (planResult?.scheduledDays || []).flatMap((d) => d.items);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100">
                Auto-Block into Calendar
              </h2>
              <p className="text-[11px] text-neutral-400">
                Effort-based time blocking with burnout & cross-job buffers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Controls */}
        <div className="px-5 py-3 border-b border-neutral-800 bg-neutral-950/60 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-neutral-300">
                Target Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-neutral-300">
                Context / Workspace
              </label>
              <select
                value={selectedContextId}
                onChange={(e) => setSelectedContextId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-200"
              >
                <option value="">All Contexts</option>
                {contexts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-neutral-300 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-neutral-400">Rest Buffer:</span>
              <select
                value={minBufferMinutes}
                onChange={(e) => setMinBufferMinutes(Number(e.target.value))}
                className="px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-200"
              >
                <option value={10}>10 mins</option>
                <option value={15}>15 mins</option>
                <option value={20}>20 mins</option>
              </select>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-neutral-300">
              <input
                type="checkbox"
                checked={allowSpillover}
                onChange={(e) => setAllowSpillover(e.target.checked)}
                className="rounded border-neutral-700 text-emerald-400 focus:ring-0"
              />
              <span>Spillover if full</span>
            </label>
          </div>

          <button
            type="button"
            onClick={handleGeneratePlan}
            disabled={isPlanning}
            className="w-full py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {isPlanning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Calculate Optimal Open Slots</span>
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="m-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Scrollable Plan Results */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 no-scrollbar">
          {!planResult ? (
            <div className="text-center py-12 space-y-2 text-neutral-500">
              <Calendar className="w-8 h-8 mx-auto text-neutral-600" />
              <p className="text-xs">
                Click "Calculate Optimal Open Slots" to find conflict-free calendar windows for your active to-dos.
              </p>
            </div>
          ) : planResult.totalScheduled === 0 ? (
            <div className="text-center py-10 space-y-2 text-neutral-400">
              <p className="text-xs">{planResult.message || 'No pending tasks to schedule.'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Guardrails Applied Badge */}
              {planResult.guardrailsApplied && planResult.guardrailsApplied.length > 0 && (
                <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-800/40 space-y-1.5">
                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Scheduling Guardrails Enforced:
                  </span>
                  <div className="text-[10px] text-emerald-300/80 space-y-1">
                    {planResult.guardrailsApplied.map((g, i) => (
                      <div key={i}>• {g.message}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Day-by-Day Slot List */}
              {planResult.scheduledDays.map((dayGroup) => (
                <div key={dayGroup.date} className="space-y-2">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                    <span className="text-xs font-bold text-neutral-200">
                      {dayGroup.dayLabel}
                    </span>
                    <span className="text-[10px] font-mono text-neutral-400">
                      {dayGroup.count} task{dayGroup.count !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {dayGroup.items.map((item, idx) => {
                      const startTime = new Date(item.start).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const endTime = new Date(item.end).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800/80 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: item.contextColor || '#10b981' }}
                              />
                              <span className="text-xs font-semibold text-neutral-100 truncate">
                                {item.title}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono font-bold text-emerald-400 shrink-0">
                              {startTime} - {endTime}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-neutral-400">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.2 rounded bg-neutral-900 border border-neutral-800">
                                {item.contextName}
                              </span>
                              <span>{item.estimatedMinutes}m duration</span>
                            </div>

                            {item.isSpillover && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-medium">
                                Tomorrow Spillover
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* 5-Minute Reminder Notification Note */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800 text-[10px] text-neutral-400">
                <Bell className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  Items will be created as native Google Tasks and events will have exact <strong>5-minute reminder popups</strong> configured.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {planResult && planResult.totalScheduled > 0 && (
          <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between gap-3">
            <span className="text-xs text-neutral-400 font-mono">
              {allItems.length} blocks ready
            </span>
            <button
              onClick={handleCommitSchedule}
              disabled={isCommitting}
              className="py-2.5 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-neutral-950 font-bold text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isCommitting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Commit to Calendar & Tasks</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
