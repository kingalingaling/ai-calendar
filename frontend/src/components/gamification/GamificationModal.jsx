import React, { useState } from 'react';
import {
  X,
  Award,
  Flame,
  Snowflake,
  Zap,
  ShieldCheck,
  Check,
  Lock,
  Layers,
  Sparkles,
  Palette,
} from 'lucide-react';
import { api } from '../../api/client.js';

const THEMES = [
  { id: 'emerald', name: 'Cyber Emerald', levelRequired: 1, color: '#10b981' },
  { id: 'sapphire', name: 'Deep Sapphire', levelRequired: 2, color: '#3b82f6' },
  { id: 'amethyst', name: 'Royal Amethyst', levelRequired: 3, color: '#a855f7' },
  { id: 'amber', name: 'Solar Gold', levelRequired: 4, color: '#f59e0b' },
  { id: 'crimson', name: 'Crimson Moon', levelRequired: 5, color: '#f43f5e' },
];

const ALL_BADGES = [
  {
    id: 'novice_adventurer',
    name: 'First Quest Complete',
    icon: '⚔️',
    description: 'Completed your first scheduled task.',
  },
  {
    id: 'deep_work_focus',
    name: 'Deep Work Sorcerer',
    icon: '🔮',
    description: 'Completed a deep work block of 60 minutes or longer.',
  },
  {
    id: 'streak_cadet',
    name: 'Consistency Cadet',
    icon: '🔥',
    description: 'Maintained a 3-day daily planning streak.',
  },
  {
    id: 'streak_veteran',
    name: 'Habit Champion',
    icon: '⚡',
    description: 'Reached a 7-day consistency streak without breaking.',
  },
  {
    id: 'streak_legend',
    name: 'Titan of Time',
    icon: '👑',
    description: 'Achieved a monumental 14-day streak.',
  },
  {
    id: 'context_master',
    name: 'Multi-Workspace Pro',
    icon: '📑',
    description: 'Completed tasks across multiple distinct workspaces in one day.',
  },
  {
    id: 'sheet_wizard',
    name: 'Spreadsheet Ingestor',
    icon: '📊',
    description: 'Completed a task synchronized directly from a Google Sheet.',
  },
];

export function GamificationModal({
  isOpen,
  onClose,
  profile,
  stamina,
  onThemeChanged,
}) {
  const [activeTheme, setActiveTheme] = useState(profile?.currentTheme || 'emerald');
  const [isUpdatingTheme, setIsUpdatingTheme] = useState(false);
  const [activeTab, setActiveTab] = useState('badges'); // 'badges' | 'energy' | 'themes'

  if (!isOpen || !profile) return null;

  const unlockedBadgeIds = (profile.unlockedBadges || []).map((b) => b.id);
  const currentLevel = profile.level || 1;

  const handleSelectTheme = async (themeId) => {
    setIsUpdatingTheme(true);
    try {
      await api.post('/gamification/theme', { theme: themeId });
      setActiveTheme(themeId);
      if (onThemeChanged) onThemeChanged(themeId);
    } catch (err) {
      console.error('Failed to update theme:', err);
    } finally {
      setIsUpdatingTheme(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Award className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100">
                Gamification & RPG Hub
              </h2>
              <p className="text-[11px] text-neutral-400">
                Level, Consistency Streaks, Badges & Energy Bar
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

        {/* Level & XP Hero Banner */}
        <div className="bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 p-5 border-b border-neutral-800 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono text-xs font-black">
                LEVEL {currentLevel}
              </span>
              <span className="text-sm font-bold text-neutral-100">
                {profile.levelTitle}
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 font-mono">
              {profile.xp} XP total • Next level at {profile.xpForNextLevel} XP
            </div>
            {/* XP Bar */}
            <div className="w-48 sm:w-56 bg-neutral-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${profile.levelProgressPercent}%` }}
              />
            </div>
          </div>

          {/* Streaks pill */}
          <div className="flex flex-col items-end gap-1.5 bg-neutral-900/90 border border-neutral-800 p-2.5 rounded-2xl">
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-black text-amber-300 font-mono">
                {profile.streakCount} days
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-neutral-400">
              <span>Best: {profile.bestStreak}d</span>
              <span>•</span>
              <span className="text-cyan-400 flex items-center gap-0.5">
                <Snowflake className="w-2.5 h-2.5" />
                {profile.streakFreezesAvailable}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-neutral-800 px-5 pt-2">
          <button
            onClick={() => setActiveTab('badges')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'badges'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-300'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Badges ({unlockedBadgeIds.length}/{ALL_BADGES.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('energy')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'energy'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-300'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Energy Bar</span>
          </button>
          <button
            onClick={() => setActiveTab('themes')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'themes'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-300'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Theme Unlocks</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 no-scrollbar">
          {/* TAB 1: BADGES */}
          {activeTab === 'badges' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ALL_BADGES.map((badge) => {
                  const isUnlocked = unlockedBadgeIds.includes(badge.id);

                  return (
                    <div
                      key={badge.id}
                      className={`p-3 rounded-2xl border transition-all ${
                        isUnlocked
                          ? 'bg-neutral-950/80 border-emerald-500/40 text-neutral-100 shadow-sm'
                          : 'bg-neutral-950/40 border-neutral-800/60 opacity-50 grayscale'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl shrink-0">{badge.icon}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold truncate">
                              {badge.name}
                            </span>
                            {isUnlocked && (
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                            )}
                          </div>
                          <p className="text-[10px] text-neutral-400 line-clamp-2 mt-0.5">
                            {badge.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: ENERGY & STAMINA SYSTEM */}
          {activeTab === 'energy' && (
            <div className="space-y-4">
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-neutral-100">
                      Daily Stamina / Energy Gauge
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-neutral-200">
                    {stamina?.staminaUsed || 0} / 100
                  </span>
                </div>

                <div className="w-full bg-neutral-900 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      stamina?.isOvercommitted
                        ? 'bg-rose-500'
                        : (stamina?.staminaUsed || 0) >= 80
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, stamina?.percentage || 0)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Burnout Risk: <strong className="capitalize text-neutral-200">{stamina?.burnoutRisk || 'low'}</strong></span>
                  <span>Tasks Today: <strong className="text-neutral-200">{stamina?.taskCount || 0}</strong></span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-neutral-400 bg-neutral-950/60 p-4 rounded-2xl border border-neutral-800">
                <h4 className="font-bold text-neutral-200 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  How Cognitive Capacity Protection Works:
                </h4>
                <p>
                  • <strong>100 Stamina</strong> represents the ideal cognitive load for a healthy workday (approx. 5-6 hours of focused work + meetings).
                </p>
                <p>
                  • <strong>Quick Tasks (30m)</strong> cost ~15 stamina; <strong>Deep Work (60m+)</strong> costs ~35-45 stamina.
                </p>
                <p>
                  • If your planned day crosses 100%, the AI automatically prompts you to spill excess tasks to Tomorrow to avoid burnout.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: THEMES */}
          {activeTab === 'themes' && (
            <div className="space-y-3">
              <p className="text-xs text-neutral-400">
                Unlock new aesthetic accent themes by leveling up your scheduling RPG rank:
              </p>

              <div className="space-y-2">
                {THEMES.map((theme) => {
                  const isUnlocked = currentLevel >= theme.levelRequired;
                  const isCurrent = activeTheme === theme.id;

                  return (
                    <div
                      key={theme.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                        isCurrent
                          ? 'bg-neutral-950 border-emerald-500/60 shadow-md'
                          : isUnlocked
                          ? 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
                          : 'bg-neutral-950/30 border-neutral-850 opacity-40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="w-4 h-4 rounded-full border border-white/20"
                          style={{ backgroundColor: theme.color }}
                        />
                        <div>
                          <span className="text-xs font-bold text-neutral-200">
                            {theme.name}
                          </span>
                          {!isUnlocked && (
                            <span className="text-[10px] text-neutral-500 block">
                              Unlocks at Level {theme.levelRequired}
                            </span>
                          )}
                        </div>
                      </div>

                      {isCurrent ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                          Active
                        </span>
                      ) : isUnlocked ? (
                        <button
                          onClick={() => handleSelectTheme(theme.id)}
                          disabled={isUpdatingTheme}
                          className="px-2.5 py-1 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors cursor-pointer"
                        >
                          Equip
                        </button>
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-neutral-600" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
