import React from 'react';
import { Clock, Trash2, ExternalLink, Sparkles, MapPin, CheckCircle2, Circle, Calendar, CheckSquare } from 'lucide-react';
import { DateTime } from 'luxon';

export function DayTimeline({
  selectedDate,
  onSelectDate,
  viewMode,
  onChangeView,
  events = [],
  isLoading,
  onDeleteEvent,
  onToggleTask,
}) {
  const watNow = DateTime.now().setZone('Africa/Lagos');
  const todayStr = watNow.toFormat('yyyy-MM-dd');
  const isToday = selectedDate === todayStr;

  // Generate 5 quick day tabs (Yesterday, Today, Tomorrow, +2, +3)
  const dayTabs = [-1, 0, 1, 2, 3].map(offset => {
    const dt = watNow.plus({ days: offset });
    return {
      date: dt.toFormat('yyyy-MM-dd'),
      label: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : dt.toFormat('EEE'),
      dayNum: dt.toFormat('d'),
      isToday: offset === 0,
    };
  });

  return (
    <div className="space-y-4">
      {/* Day Selector Strip */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
        {dayTabs.map((tab) => {
          const isSelected = selectedDate === tab.date;
          return (
            <button
              key={tab.date}
              onClick={() => onSelectDate(tab.date)}
              className={`flex-1 min-w-[64px] py-2 px-1.5 rounded-xl flex flex-col items-center gap-0.5 border transition-all ${
                isSelected
                  ? 'bg-neutral-800 border-emerald-500/50 text-white shadow-md'
                  : 'bg-neutral-900/60 border-neutral-800/80 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span className={`text-[10px] uppercase font-semibold ${isSelected ? 'text-emerald-400' : 'text-neutral-500'}`}>
                {tab.label}
              </span>
              <span className="text-sm font-bold font-mono">
                {tab.dayNum}
              </span>
              {tab.isToday && (
                <span className="w-1 h-1 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Events & Tasks List */}
      <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-sm min-h-[360px]">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-neutral-100">
              {DateTime.fromISO(selectedDate, { zone: 'Africa/Lagos' }).toFormat('EEEE, MMMM d')}
            </h2>
          </div>
          <span className="text-xs font-mono text-neutral-400">
            {events.length} item{events.length !== 1 ? 's' : ''}
          </span>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-neutral-500">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Fetching calendar data...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-neutral-500 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-neutral-800/50 flex items-center justify-center text-neutral-400 mb-1">
              <Clock className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-neutral-300">No entries for this day</p>
            <p className="text-xs text-neutral-500 max-w-xs">
              Your day is open. Tap the <span className="text-emerald-400">AI Schedule</span> button to auto-allot your meetings and tasks.
            </p>
          </div>
        ) : (
          <div className="relative space-y-2.5">
            {/* Real-time "NOW" indicator for current day */}
            {isToday && (
              <div className="flex items-center gap-2 py-1 text-[11px] text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Now: {watNow.toFormat('h:mm a')} WAT</span>
                <div className="flex-1 h-px bg-emerald-500/30" />
              </div>
            )}

            {events.map((item) => {
              const startDt = item.start ? DateTime.fromISO(item.start, { zone: 'Africa/Lagos' }) : null;
              const endDt = item.end ? DateTime.fromISO(item.end, { zone: 'Africa/Lagos' }) : null;
              const isTask = item.entryType === 'task';
              const isCompleted = Boolean(item.completed);

              return (
                <div
                  key={item.id}
                  className={`group relative border rounded-xl p-3 flex items-start gap-3 transition-all ${
                    isCompleted
                      ? 'bg-neutral-950/40 border-neutral-900 opacity-60'
                      : isTask
                      ? 'bg-neutral-950/80 border-neutral-800/90 hover:border-neutral-700'
                      : 'bg-neutral-950/90 border-blue-900/30 hover:border-blue-700/50'
                  }`}
                >
                  {/* Task Checkbox (Only for Tasks) */}
                  {isTask ? (
                    <button
                      type="button"
                      onClick={() => onToggleTask && onToggleTask(item.id)}
                      className="mt-0.5 text-neutral-400 hover:text-emerald-400 transition-colors shrink-0"
                      title={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-950" />
                      ) : (
                        <Circle className="w-5 h-5 hover:scale-105 transition-transform" />
                      )}
                    </button>
                  ) : (
                    <div className="mt-1 text-blue-400 shrink-0" title="Fixed Event / Meeting">
                      <Calendar className="w-4 h-4" />
                    </div>
                  )}

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded-md border ${
                        isTask
                          ? 'text-emerald-400/90 bg-emerald-500/10 border-emerald-500/20'
                          : 'text-blue-400/90 bg-blue-500/10 border-blue-500/20'
                      }`}>
                        {startDt && endDt
                          ? `${startDt.toFormat('h:mm a')} - ${endDt.toFormat('h:mm a')}`
                          : 'All Day'}
                      </span>

                      {/* Entry Type Badge */}
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                        isTask
                          ? 'text-emerald-300 bg-emerald-950/50 border-emerald-800/40'
                          : 'text-blue-300 bg-blue-950/50 border-blue-800/40'
                      }`}>
                        {isTask ? <CheckSquare className="w-2.5 h-2.5" /> : <Calendar className="w-2.5 h-2.5" />}
                        <span>{isTask ? 'To-Do Task' : 'Event / Meeting'}</span>
                      </span>

                      {item.aiScheduled && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>AI Placed</span>
                        </span>
                      )}

                      {item.isSpillover && (
                        <span className="text-[10px] font-medium text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          ⚡ Rollover
                        </span>
                      )}
                    </div>

                    <h3 className={`text-sm font-semibold truncate ${
                      isCompleted ? 'line-through text-neutral-500' : 'text-neutral-100'
                    }`}>
                      {item.summary}
                    </h3>

                    {item.description && (
                      <p className={`text-xs line-clamp-1 ${isCompleted ? 'line-through text-neutral-600' : 'text-neutral-400'}`}>
                        {item.description}
                      </p>
                    )}

                    {item.location && (
                      <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{item.location}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    {item.htmlLink && (
                      <a
                        href={item.htmlLink}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
                        title="View in Google Calendar"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => onDeleteEvent(item.id)}
                      className="p-1.5 text-neutral-500 hover:text-red-400 rounded-lg hover:bg-neutral-800 transition-colors"
                      title="Delete item"
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
    </div>
  );
}
