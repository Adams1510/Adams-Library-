import React from 'react';
import { Moon, Clock, X, Check, Timer } from 'lucide-react';
import { SleepTimerState } from '../types';

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sleepTimer: SleepTimerState;
  onSetTimer: (minutes: number) => void;
  onSetEndOfChapter: () => void;
  onCancelTimer: () => void;
}

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({
  isOpen,
  onClose,
  sleepTimer,
  onSetTimer,
  onSetEndOfChapter,
  onCancelTimer,
}) => {
  if (!isOpen) return null;

  const timerPresets = [
    { label: '5 Minutes', minutes: 5 },
    { label: '15 Minutes', minutes: 15 },
    { label: '30 Minutes', minutes: 30 },
    { label: '45 Minutes', minutes: 45 },
    { label: '60 Minutes', minutes: 60 },
  ];

  const formatRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Audio Sleep Timer
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gradually fades audio out for bed & rest
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Timer Status */}
        {sleepTimer.active && (
          <div className="my-5 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-between text-indigo-900 dark:text-indigo-200">
            <div className="flex items-center gap-3">
              <Timer className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin" />
              <div>
                <p className="text-xs font-semibold">Active Sleep Countdown</p>
                <p className="text-lg font-mono font-bold text-indigo-600 dark:text-indigo-300">
                  {sleepTimer.endOfChapter ? 'End of Chapter' : formatRemaining(sleepTimer.remainingSeconds)}
                </p>
              </div>
            </div>

            <button
              onClick={onCancelTimer}
              className="px-3 py-1.5 rounded-xl bg-indigo-200 dark:bg-indigo-900/80 hover:bg-indigo-300 dark:hover:bg-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs font-bold transition-colors"
            >
              Turn Off
            </button>
          </div>
        )}

        {/* Presets Grid */}
        <div className="my-5 space-y-2">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Set Timer Duration
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {timerPresets.map((t) => (
              <button
                key={t.minutes}
                onClick={() => {
                  onSetTimer(t.minutes);
                  onClose();
                }}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 hover:border-indigo-500/50 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-between transition-all"
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  {t.label}
                </span>
                {sleepTimer.active && sleepTimer.targetMinutes === t.minutes && !sleepTimer.endOfChapter && (
                  <Check className="w-4 h-4 text-indigo-500" />
                )}
              </button>
            ))}

            {/* End of Chapter preset */}
            <button
              onClick={() => {
                onSetEndOfChapter();
                onClose();
              }}
              className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-800 dark:text-indigo-300 text-xs font-semibold flex items-center justify-between col-span-2 transition-all"
            >
              <span className="flex items-center gap-2">
                <Moon className="w-3.5 h-3.5 text-indigo-500" />
                Stop at End of Current Chapter
              </span>
              {sleepTimer.active && sleepTimer.endOfChapter && (
                <Check className="w-4 h-4 text-indigo-500" />
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
