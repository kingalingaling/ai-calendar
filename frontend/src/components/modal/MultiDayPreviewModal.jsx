import React, { useState } from 'react';
import { X, Check, Clock, Sparkles, AlertTriangle, Trash2, Calendar, ArrowRight, CheckSquare } from 'lucide-react';
import { DateTime } from 'luxon';

const CATEGORY_COLORS = {
  deep_work: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', label: 'Deep Work' },
  meeting_call: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', label: 'Call / Meeting' },
  health_fitness: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', label: 'Fitness' },
  admin: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', label: 'Admin' },
  break: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', label: 'Break' },
};

export function MultiDayPreviewModal({
  isOpen,
  onClose,
  proposalData,
  onConfirmSchedule,
  isCommitting,
}) {
  if (!isOpen || !proposalData) return null;

  const [scheduleState, setScheduleState] = useState(() => {
    // Clone proposal to allow in-modal editing
    return (proposalData.schedule || []).map(dayGroup => ({
      ...dayGroup,
      events: (dayGroup.events || []).map(ev => ({
        ...ev,
        entry_type: ev.entry_type || 'task',
      })),
    }));
  });

  const handleUpdateEvent = (dayIndex, eventIndex, field, value) => {
    setScheduleState(prev => {
      const next = [...prev];
      next[dayIndex].events[eventIndex] = {
        ...next[dayIndex].events[eventIndex],
        [field]: value,
      };
      return next;
    });
  };

  const handleRemoveEvent = (dayIndex, eventIndex) => {
    setScheduleState(prev => {
      const next = [...prev];
      next[dayIndex].events.splice(eventIndex, 1);
      return next;
    });
  };

  const handleConfirm = () => {
    // Flatten all events across all days that are still kept
    const allEventsToCommit = [];
    for (const day of scheduleState) {
      for (const ev of day.events) {
        allEventsToCommit.push({
          summary: ev.summary,
          description: ev.description,
          start: ev.start_time || ev.start,
          end: ev.end_time || ev.end,
          colorId: ev.color_id || (ev.entry_type === 'event' ? '1' : '9'),
          category: ev.category,
          entry_type: ev.entry_type || 'task',
          auto_suggested_time: ev.auto_suggested_time,
          is_spillover: ev.is_spillover,
        });
      }
    }

    if (allEventsToCommit.length === 0) return;
    onConfirmSchedule(allEventsToCommit);
  };

  const totalEventsCount = scheduleState.reduce((sum, d) => sum + d.events.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-t-3xl sm:rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-100">Review Proposed Schedule</h2>
              <p className="text-xs text-neutral-400">
                {totalEventsCount} item{totalEventsCount !== 1 ? 's' : ''} across {scheduleState.length} day{scheduleState.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 overflow-y-auto space-y-4 divide-y divide-neutral-800/80">
          {/* AI Executive Summary */}
          {proposalData.summary && (
            <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-3 text-xs text-emerald-300">
              <span className="font-semibold text-emerald-200">AI Plan: </span>
              {proposalData.summary}
            </div>
          )}

          {/* Spillover Notification */}
          {proposalData.spilloverOccurred && (
            <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Automatic Spillover Activated: </span>
                <span>{proposalData.spilloverCount} task(s) were automatically allotted to Tomorrow to protect your maximum daily focus limit.</span>
              </div>
            </div>
          )}

          {/* Days Loop */}
          {scheduleState.map((dayGroup, dayIdx) => (
            <div key={dayGroup.date} className="pt-3 first:pt-0 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{dayGroup.dayLabel}</span>
                </span>
                <span className="text-[11px] font-mono text-neutral-500">
                  {dayGroup.events.length} item{dayGroup.events.length !== 1 ? 's' : ''}
                </span>
              </div>

              {dayGroup.events.length === 0 ? (
                <div className="text-xs text-neutral-500 italic py-2">
                  No items scheduled for this day.
                </div>
              ) : (
                <div className="space-y-2">
                  {dayGroup.events.map((event, evIdx) => {
                    const categoryMeta = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.deep_work;
                    const startTimeFormatted = DateTime.fromISO(event.start_time, { zone: 'Africa/Lagos' }).toFormat('h:mm a');
                    const endTimeFormatted = DateTime.fromISO(event.end_time, { zone: 'Africa/Lagos' }).toFormat('h:mm a');
                    const isTask = event.entry_type === 'task';

                    return (
                      <div
                        key={event.tempId || evIdx}
                        className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 space-y-2 group hover:border-neutral-700 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <input
                            type="text"
                            value={event.summary}
                            onChange={(e) => handleUpdateEvent(dayIdx, evIdx, 'summary', e.target.value)}
                            className="bg-transparent text-sm font-medium text-neutral-100 focus:outline-none focus:border-b focus:border-emerald-500 w-full"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveEvent(dayIdx, evIdx)}
                            className="text-neutral-500 hover:text-red-400 p-1 transition-colors"
                            title="Exclude this item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Badges & Type Switcher */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          {/* Interactive Event vs Task Toggle Button */}
                          <button
                            type="button"
                            onClick={() => handleUpdateEvent(dayIdx, evIdx, 'entry_type', isTask ? 'event' : 'task')}
                            className={`px-2 py-0.5 rounded-md border font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                              isTask
                                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50 hover:bg-emerald-900/60'
                                : 'bg-blue-950/70 text-blue-300 border-blue-700/50 hover:bg-blue-900/60'
                            }`}
                            title="Click to toggle between checkable Task and calendar Event"
                          >
                            {isTask ? <CheckSquare className="w-3 h-3 text-emerald-400" /> : <Calendar className="w-3 h-3 text-blue-400" />}
                            <span>{isTask ? 'Task (Checkable)' : 'Event / Meeting'}</span>
                          </button>

                          <span className={`px-2 py-0.5 rounded-md border font-medium ${categoryMeta.bg} ${categoryMeta.text} ${categoryMeta.border}`}>
                            {categoryMeta.label}
                          </span>

                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-300 border border-neutral-800 font-mono">
                            <Clock className="w-3 h-3 text-neutral-400" />
                            <span>{startTimeFormatted} - {endTimeFormatted}</span>
                          </span>

                          {event.auto_suggested_time && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                              ✨ Auto-suggested
                            </span>
                          )}

                          {event.is_spillover && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium">
                              ⚡ Rollover
                            </span>
                          )}
                        </div>

                        {/* Reasoning */}
                        {event.reasoning && (
                          <p className="text-[11px] text-neutral-400 bg-neutral-900/60 rounded-lg px-2.5 py-1.5">
                            💡 {event.reasoning}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Modal Sticky Footer CTA */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/95 flex items-center justify-between gap-3 safe-bottom">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={totalEventsCount === 0 || isCommitting}
            onClick={handleConfirm}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm text-neutral-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 active:scale-[0.99] disabled:opacity-50 shadow-lg shadow-emerald-500/10 transition-all cursor-pointer"
          >
            {isCommitting ? (
              <>
                <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                <span>Writing to Google Calendar...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Confirm & Schedule ({totalEventsCount})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
