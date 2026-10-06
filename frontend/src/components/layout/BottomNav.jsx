import React from 'react';
import { Calendar, CheckSquare, Hourglass, Sparkles, RefreshCw } from 'lucide-react';

export function BottomNav({
  activeTab,
  onTabChange,
  pendingRolloversCount = 0,
  waitingCount = 0,
}) {
  const tabs = [
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    {
      id: 'waiting',
      label: 'Waiting',
      icon: Hourglass,
      badge: waitingCount,
      badgeColor: 'bg-amber-500 text-neutral-950',
    },
    { id: 'schedule', label: 'AI Sync', icon: Sparkles, highlight: true },
    {
      id: 'rollover',
      label: 'Rollover',
      icon: RefreshCw,
      badge: pendingRolloversCount,
      badgeColor: 'bg-emerald-500 text-neutral-950',
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/95 backdrop-blur-lg border-t border-neutral-900 safe-bottom">
      <div className="max-w-md mx-auto grid grid-cols-5 h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                isActive
                  ? 'text-emerald-400 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {tab.highlight && (
                <div
                  className={`absolute -top-2 w-8 h-8 rounded-full bg-emerald-500/20 blur-md pointer-events-none ${
                    isActive ? 'opacity-100' : 'opacity-40'
                  }`}
                />
              )}
              <div className="relative">
                <Icon
                  className={`w-4 h-4 sm:w-5 sm:h-5 ${
                    tab.highlight && isActive ? 'text-emerald-400 scale-110' : ''
                  }`}
                />
                {tab.badge > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-2 px-1.5 py-0.2 text-[9px] font-bold rounded-full ${
                      tab.badgeColor || 'bg-emerald-500 text-neutral-950'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] sm:text-[11px] tracking-tight truncate max-w-[64px]">
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
