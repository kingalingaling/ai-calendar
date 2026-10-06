import React, { useState } from 'react';
import { X, Check, Briefcase, Laptop, Sparkles, User, Layers } from 'lucide-react';

const PRESET_COLORS = [
  '#3b82f6', // Blue (Job A)
  '#8b5cf6', // Purple (Job B)
  '#10b981', // Emerald (Side Projects)
  '#f59e0b', // Amber (Personal)
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#6366f1', // Indigo
];

const PRESET_ICONS = [
  { id: 'briefcase', icon: Briefcase, label: 'Work' },
  { id: 'laptop', icon: Laptop, label: 'Tech' },
  { id: 'sparkles', icon: Sparkles, label: 'Creative' },
  { id: 'user', icon: User, label: 'Personal' },
  { id: 'folder', icon: Layers, label: 'General' },
];

export function CreateContextModal({ isOpen, onClose, onCreateContext }) {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [icon, setIcon] = useState('briefcase');
  const [startHour, setStartHour] = useState('09:00');
  const [endHour, setEndHour] = useState('17:00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onCreateContext({
        name: name.trim(),
        color,
        icon,
        workingHours: {
          start: startHour,
          end: endHour,
          days: [1, 2, 3, 4, 5],
        },
      });
      onClose();
    } catch (err) {
      console.error('Failed to create context:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-t-3xl sm:rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <h2 className="text-base font-semibold text-neutral-100">Add Workspace / Context</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-neutral-400">Context Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Job A, Freelance, Studies"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="text-xs font-medium text-neutral-400">Context Color Tag</label>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center ${
                    color === c ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-neutral-900' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Icon Picker */}
          <div>
            <label className="text-xs font-medium text-neutral-400">Icon</label>
            <div className="flex items-center gap-2 mt-1.5">
              {PRESET_ICONS.map((item) => {
                const IconComponent = item.icon;
                const isSelected = icon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIcon(item.id)}
                    className={`flex-1 py-2 rounded-xl flex items-center justify-center border transition-all ${
                      isSelected
                        ? 'bg-neutral-800 border-emerald-500 text-white'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Working Hours */}
          <div>
            <label className="text-xs font-medium text-neutral-400">Default Working Hours (WAT)</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <span className="text-[10px] text-neutral-500">Start</span>
                <input
                  type="time"
                  value={startHour}
                  onChange={(e) => setStartHour(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] text-neutral-500">End</span>
                <input
                  type="time"
                  value={endHour}
                  onChange={(e) => setEndHour(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="flex-1 py-2 px-4 rounded-xl text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isSubmitting ? 'Creating...' : 'Create Context'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
