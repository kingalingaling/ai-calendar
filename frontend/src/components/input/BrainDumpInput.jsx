import React, { useState, useEffect } from 'react';
import { Sparkles, Calendar, ArrowRight, CornerDownLeft } from 'lucide-react';
import { VoiceRecorder } from './VoiceRecorder.jsx';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition.js';
import { DateTime } from 'luxon';

export function BrainDumpInput({ onParseSchedule, isSubmitting }) {
  const watNow = DateTime.now().setZone('Africa/Lagos');
  const todayStr = watNow.toFormat('yyyy-MM-dd');
  const tomorrowStr = watNow.plus({ days: 1 }).toFormat('yyyy-MM-dd');

  const [prompt, setPrompt] = useState('');
  const [targetDate, setTargetDate] = useState(todayStr);
  const [allowSpillover, setAllowSpillover] = useState(true);

  const {
    isListening,
    transcript,
    isSupported,
    error: speechError,
    toggleListening,
    resetTranscript,
  } = useSpeechRecognition();

  // Synchronize speech transcript into prompt input
  useEffect(() => {
    if (transcript) {
      setPrompt((prev) => {
        const cleaned = transcript.trim();
        return prev ? `${prev} ${cleaned}` : cleaned;
      });
      resetTranscript();
    }
  }, [transcript, resetTranscript]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!prompt.trim() || isSubmitting) return;

    onParseSchedule({
      prompt: prompt.trim(),
      targetDate,
      allowSpillover,
    });
  };

  const samplePrompts = [
    {
      label: 'Zero-Timestamp Dump (Auto-Slot)',
      text: 'Need to review financial audit, call prospective client, 45m workout, write architecture draft, review pull requests.',
    },
    {
      label: 'With Mixed Times',
      text: 'Standup at 9:30am, client call at 2pm, and 2 hours of deep work before 6pm.',
    },
  ];

  return (
    <div className="bg-neutral-900/70 border border-neutral-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>AI Schedule Generator</span>
        </span>

        {/* Date Selector Pills */}
        <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
          <button
            type="button"
            onClick={() => setTargetDate(todayStr)}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              targetDate === todayStr
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setTargetDate(tomorrowStr)}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              targetDate === tomorrowStr
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Tomorrow
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Dump your tasks or schedule... Times are optional! e.g., 'Review budget, call supplier, 45m workout, write architecture draft'"
            rows={4}
            className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl p-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 resize-none transition-all"
          />

          <div className="absolute right-2.5 bottom-2.5 flex items-center gap-2">
            <VoiceRecorder
              isListening={isListening}
              isSupported={isSupported}
              onToggle={toggleListening}
              error={speechError}
            />
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="text-[11px] text-neutral-500 self-center mr-1">Examples:</span>
          {samplePrompts.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setPrompt(sample.text)}
              className="text-[11px] bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-white px-2 py-1 rounded-lg border border-neutral-750 transition-colors text-left"
            >
              {sample.label}
            </button>
          ))}
          {prompt && (
            <button
              type="button"
              onClick={() => setPrompt('')}
              className="text-[11px] text-neutral-500 hover:text-red-400 px-1.5 py-1 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Spillover Setting */}
        <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60">
          <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allowSpillover}
              onChange={(e) => setAllowSpillover(e.target.checked)}
              className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 accent-emerald-500"
            />
            <span>Auto-allot excess tasks to Tomorrow</span>
          </label>
          <span className="text-[10px] text-neutral-500">
            Workday: 08:30 - 18:00 WAT
          </span>
        </div>

        {/* Primary Submit Button */}
        <button
          type="submit"
          disabled={!prompt.trim() || isSubmitting}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm text-neutral-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/10 transition-all cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
              <span>Analyzing Calendar & Scheduling...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate Smart Schedule</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
