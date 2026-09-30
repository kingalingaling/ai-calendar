import React from 'react';
import { Calendar, Sparkles, CheckCircle2, AlertCircle, LogIn, LogOut } from 'lucide-react';
import { DateTime } from 'luxon';

export function Header({ user, onLogin, onLogout }) {
  const watNow = DateTime.now().setZone('Africa/Lagos');

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Sparkles className="w-4 h-4 text-neutral-950" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-semibold tracking-tight text-neutral-100">AI Calendar</h1>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
                WAT (UTC+1)
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              {watNow.toFormat('EEE, d MMM yyyy')} • {watNow.toFormat('h:mm a')}
            </p>
          </div>
        </div>

        {/* User status */}
        <div className="flex items-center gap-2">
          {user?.authenticated ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded-full border border-emerald-800/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Google Synced</span>
              </div>
              <button
                onClick={onLogout}
                title="Disconnect Google"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-900 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 px-2.5 py-1.5 rounded-lg border border-neutral-800 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5 text-emerald-400" />
              <span>Connect</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
