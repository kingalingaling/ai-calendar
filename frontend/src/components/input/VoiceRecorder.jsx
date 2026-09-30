import React from 'react';
import { Mic, MicOff } from 'lucide-react';

export function VoiceRecorder({ isListening, isSupported, onToggle, error }) {
  if (!isSupported) {
    return (
      <div className="text-xs text-neutral-500 italic">
        Microphone not supported on this browser.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 ${
          isListening
            ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 scale-105'
            : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700 hover:text-white'
        }`}
        title={isListening ? 'Stop listening' : 'Start voice input'}
      >
        {isListening ? (
          <>
            <span className="absolute -inset-1.5 rounded-full border-2 border-rose-500/40 animate-ping" />
            <span className="absolute -inset-3 rounded-full border border-rose-500/20 animate-pulse" />
            <MicOff className="w-5 h-5 relative z-10" />
          </>
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </button>

      {isListening && (
        <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium animate-pulse">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span>Listening... Speak naturally</span>
        </div>
      )}

      {error && (
        <span className="text-[11px] text-amber-400">
          Mic: {error}
        </span>
      )}
    </div>
  );
}
