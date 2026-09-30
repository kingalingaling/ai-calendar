import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, ArrowRight, Sparkles, Clock } from 'lucide-react';
import { api } from '../../api/client.js';

export function RolloverBanner({ onRolloverSuccess }) {
  const [isScanning, setIsScanning] = useState(false);
  const [rolloverPlan, setRolloverPlan] = useState(null);
  const [isCommitting, setIsCommitting] = useState(false);

  const handleScanRollovers = async () => {
    setIsScanning(true);
    try {
      const res = await api.post('/schedule/rollover', {});
      setRolloverPlan(res.data);
    } catch (e) {
      console.error('Failed to plan rollover:', e);
    } finally {
      setIsScanning(false);
    }
  };

  const handleCommitRollover = async () => {
    if (!rolloverPlan || rolloverPlan.rolledOverEvents.length === 0) return;

    setIsCommitting(true);
    try {
      await api.post('/schedule/commit', {
        events: rolloverPlan.rolledOverEvents,
      });
      setRolloverPlan(null);
      if (onRolloverSuccess) onRolloverSuccess();
    } catch (e) {
      console.error('Failed to commit rollover:', e);
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-purple-950/40 to-indigo-950/40 border border-purple-800/40 rounded-2xl p-4 shadow-lg backdrop-blur-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-100">Automatic Task Rollover</h3>
            <p className="text-xs text-neutral-400">Move unfinished tasks into open slots automatically</p>
          </div>
        </div>

        {!rolloverPlan && (
          <button
            onClick={handleScanRollovers}
            disabled={isScanning}
            className="flex items-center gap-1.5 text-xs font-medium text-purple-200 bg-purple-900/60 hover:bg-purple-800/80 px-3 py-1.5 rounded-xl border border-purple-700/50 transition-all cursor-pointer"
          >
            <span>Scan Tasks</span>
          </button>
        )}
      </div>

      {rolloverPlan && (
        <div className="pt-2 border-t border-purple-800/30 space-y-2.5 animate-fade-in">
          <div className="text-xs text-purple-200">
            {rolloverPlan.message}
          </div>

          {rolloverPlan.rolledOverEvents.length > 0 ? (
            <div className="space-y-2">
              {rolloverPlan.rolledOverEvents.map((task, idx) => (
                <div key={idx} className="bg-neutral-950/80 border border-purple-900/50 rounded-xl p-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium text-neutral-200">{task.summary}</span>
                    <p className="text-[11px] text-purple-400 font-mono mt-0.5">
                      New Slot: {task.start_time.slice(11, 16)} - {task.end_time.slice(11, 16)} WAT
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/20 text-purple-300">
                    Allotted
                  </span>
                </div>
              ))}

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setRolloverPlan(null)}
                  className="px-3 py-1.5 rounded-xl text-xs text-neutral-400 hover:text-white"
                >
                  Dismiss
                </button>
                <button
                  onClick={handleCommitRollover}
                  disabled={isCommitting}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold text-neutral-950 bg-gradient-to-r from-purple-400 to-indigo-400 hover:from-purple-300 hover:to-indigo-300 transition-all cursor-pointer"
                >
                  {isCommitting ? 'Allotting...' : `Auto-Allot ${rolloverPlan.rolledOverEvents.length} Task(s)`}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-neutral-400 italic">No eligible uncompleted tasks found.</p>
          )}
        </div>
      )}
    </div>
  );
}
