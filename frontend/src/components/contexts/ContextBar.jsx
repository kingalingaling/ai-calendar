import React from 'react';
import { Briefcase, Laptop, Sparkles, User, Layers, Plus } from 'lucide-react';

const ICON_MAP = {
  briefcase: Briefcase,
  laptop: Laptop,
  sparkles: Sparkles,
  user: User,
  folder: Layers,
};

export function ContextBar({
  contexts = [],
  activeContextId,
  onSelectContext,
  onOpenCreateContext,
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar">
      {/* "All" Context Pill */}
      <button
        onClick={() => onSelectContext(null)}
        className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-all border cursor-pointer ${
          activeContextId === null
            ? 'bg-neutral-800 border-neutral-700 text-white shadow-sm'
            : 'bg-neutral-900/60 border-neutral-800/80 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
        }`}
      >
        <Layers className="w-3.5 h-3.5" />
        <span>All Contexts</span>
      </button>

      {/* Individual Context Pills */}
      {contexts.map((ctx) => {
        const Icon = ICON_MAP[ctx.icon] || Briefcase;
        const isSelected = activeContextId === ctx.id;

        return (
          <button
            key={ctx.id}
            onClick={() => onSelectContext(ctx.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-all border cursor-pointer ${
              isSelected
                ? 'text-white border-opacity-70 shadow-md'
                : 'bg-neutral-900/60 border-neutral-800/80 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
            }`}
            style={{
              backgroundColor: isSelected ? `${ctx.color}22` : undefined,
              borderColor: isSelected ? ctx.color : undefined,
              color: isSelected ? '#ffffff' : undefined,
            }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: ctx.color }}
            />
            <Icon className="w-3.5 h-3.5" style={{ color: ctx.color }} />
            <span>{ctx.name}</span>

            {ctx.activeTaskCount > 0 && (
              <span
                className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold"
                style={{
                  backgroundColor: `${ctx.color}33`,
                  color: ctx.color,
                }}
              >
                {ctx.activeTaskCount}
              </span>
            )}
          </button>
        );
      })}

      {/* Add Context Button */}
      {onOpenCreateContext && (
        <button
          onClick={onOpenCreateContext}
          className="p-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors shrink-0"
          title="Add New Context/Workspace"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
