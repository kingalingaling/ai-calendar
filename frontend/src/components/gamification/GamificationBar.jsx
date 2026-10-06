import React from 'react';
import { Flame, Snowflake, Zap, Award, ShieldAlert, Sparkles } from 'lucide-react';

export function GamificationBar({
  profile,
  stamina,
  onOpenModal,
}) {
  if (!profile) return null;

  const currentLevel = profile.level || 1;
  const levelTitle = profile.levelTitle || 'Apprentice';
  const progressPercent = profile.levelProgressPercent || 0;
  const streak = profile.streakCount || 0;
  const freezes = profile.streakFreezesAvailable ?? 2;

  // Stamina stats
  const usedStamina = stamina?.staminaUsed || 0;
  const maxStamina = stamina?.maxStamina || 100;
  const staminaPercent = stamina?.percentage || 0;
  const isOvercommitted = stamina?.isOvercommitted || false;

  // Stamina bar color logic
  let staminaBarColor = 'bg-emerald-400';
  let staminaTextColor = 'text-emerald-400';
  if (isOvercommitted) {
    staminaBarColor = 'bg-rose-500 animate-pulse';
    staminaTextColor = 'text-rose-400';
  } else if (usedStamina >= 80) {
    staminaBarColor = 'bg-amber-400';
    staminaTextColor = 'text-amber-400';
  } else if (usedStamina >= 60) {
    staminaBarColor = 'bg-yellow-400';
    staminaTextColor = 'text-yellow-400';
  }

  return (
    <div
      onClick={onOpenModal}
      className="bg-neutral-900/80 hover:bg-neutral-900 border border-neutral-800 rounded-2xl p-2.5 transition-all shadow-md cursor-pointer select-none group"
      title="Click to view RPG Badges, XP & Themes"
    >
      <div className="flex items-center justify-between gap-2">
        {/* Level & Title */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-black text-emerald-400 font-mono">
              L{currentLevel}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-neutral-100 truncate max-w-[110px]">
                {levelTitle}
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">
                {profile.xp} XP
              </span>
            </div>
            {/* XP Mini Bar */}
            <div className="w-24 sm:w-28 bg-neutral-950 rounded-full h-1 mt-1 overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right Stats: Energy & Streaks */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Daily Stamina / Energy Gauge */}
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1">
              {isOvercommitted ? (
                <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0 animate-bounce" />
              ) : (
                <Zap className={`w-3 h-3 ${staminaTextColor} shrink-0`} />
              )}
              <span className={`text-[10px] font-bold font-mono ${staminaTextColor}`}>
                {usedStamina}/{maxStamina}
              </span>
            </div>
            <div className="w-14 sm:w-16 bg-neutral-950 rounded-full h-1 mt-1 overflow-hidden">
              <div
                className={`${staminaBarColor} h-full rounded-full transition-all duration-500`}
                style={{ width: `${Math.min(100, staminaPercent)}%` }}
              />
            </div>
          </div>

          {/* Streak Counter & Freezes */}
          <div className="flex items-center gap-1 bg-neutral-950 px-2 py-1 rounded-xl border border-neutral-800/80">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-black text-amber-300 font-mono">{streak}d</span>
            {freezes > 0 && (
              <div
                className="flex items-center gap-0.5 ml-1 pl-1 border-l border-neutral-800 text-[10px] text-cyan-400"
                title={`${freezes} streak freezes ready`}
              >
                <Snowflake className="w-2.5 h-2.5" />
                <span className="font-mono">{freezes}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
