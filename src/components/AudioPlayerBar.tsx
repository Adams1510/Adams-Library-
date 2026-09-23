import React, { useState } from 'react';
import { Book, Chapter, PlayerSettings, SleepTimerState } from '../types';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Volume2,
  SlidersHorizontal,
  Moon,
  CloudRain,
  BookOpen,
  ChevronUp,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

interface AudioPlayerBarProps {
  book: Book;
  currentChapter: Chapter;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSkipBack15: () => void;
  onSkipForward15: () => void;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  hasPrevChapter: boolean;
  hasNextChapter: boolean;
  currentProgressSec: number;
  totalDurationSec: number;
  onSeek: (fraction: number) => void;
  playbackRate: number;
  onChangeRate: (rate: number) => void;
  onOpenVoiceSettings: () => void;
  onOpenSleepTimer: () => void;
  onOpenAmbientSettings: () => void;
  onToggleReader: () => void;
  isReaderOpen: boolean;
  sleepTimer: SleepTimerState;
  ambientSound: string;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  book,
  currentChapter,
  isPlaying,
  onPlayPause,
  onSkipBack15,
  onSkipForward15,
  onPrevChapter,
  onNextChapter,
  hasPrevChapter,
  hasNextChapter,
  currentProgressSec,
  totalDurationSec,
  onSeek,
  playbackRate,
  onChangeRate,
  onOpenVoiceSettings,
  onOpenSleepTimer,
  onOpenAmbientSettings,
  onToggleReader,
  isReaderOpen,
  sleepTimer,
  ambientSound,
}) => {
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressFraction = totalDurationSec > 0 ? Math.min(1, currentProgressSec / totalDurationSec) : 0;
  const progressPercent = progressFraction * 100;

  const rates = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
  const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length] || 1.0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/98 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-2xl transition-colors duration-200">
      
      {/* Top Scrubber Progress Bar */}
      <div
        className="w-full h-2 bg-slate-200 dark:bg-slate-800/80 hover:h-3 transition-all cursor-pointer relative group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const fraction = Math.max(0, Math.min(1, clickX / rect.width));
          onSeek(fraction);
        }}
        title="Seek position"
      >
        <div
          className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 relative"
          style={{ width: `${progressPercent}%` }}
        >
          {/* Thumb */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-slate-900 dark:bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Left: Book & Chapter Info */}
          <div
            className="flex items-center gap-3 min-w-0 max-w-[200px] sm:max-w-xs cursor-pointer group"
            onClick={onToggleReader}
            title="Click to open reader"
          >
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shrink-0 overflow-hidden flex items-center justify-center shadow-xs relative">
              {book.coverImage ? (
                <img
                  src={book.coverImage}
                  alt={book.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-800 to-slate-900 flex items-center justify-center text-emerald-300 font-serif font-bold text-base">
                  {book.title.substring(0, 2).toUpperCase()}
                </div>
              )}
              {isPlaying && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 uppercase">
                  {book.category}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono hidden sm:inline">
                  {formatTime(currentProgressSec)} / {formatTime(totalDurationSec)}
                </span>
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {currentChapter.title}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {book.title}
              </p>
            </div>
          </div>

          {/* Center: Main Playback Controls */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 sm:gap-3">
              {/* Previous Chapter */}
              <button
                id="player-prev-chapter-btn"
                onClick={onPrevChapter}
                disabled={!hasPrevChapter}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Previous Chapter"
              >
                <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Skip Back 15s */}
              <button
                id="player-skip-back-btn"
                onClick={onSkipBack15}
                className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
                title="Rewind 15 seconds"
              >
                <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="absolute -bottom-1 text-[8px] font-bold left-1/2 -translate-x-1/2">15</span>
              </button>

              {/* Primary Play / Pause Button */}
              <button
                id="player-main-play-btn"
                onClick={onPlayPause}
                className="p-3 sm:p-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/30 hover:scale-105 active:scale-95 transition-all mx-1"
                title={isPlaying ? 'Pause Narration' : 'Play Narration'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
                ) : (
                  <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-0.5" />
                )}
              </button>

              {/* Skip Forward 15s */}
              <button
                id="player-skip-forward-btn"
                onClick={onSkipForward15}
                className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
                title="Fast forward 15 seconds"
              >
                <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="absolute -bottom-1 text-[8px] font-bold left-1/2 -translate-x-1/2">15</span>
              </button>

              {/* Next Chapter */}
              <button
                id="player-next-chapter-btn"
                onClick={onNextChapter}
                disabled={!hasNextChapter}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Next Chapter"
              >
                <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {/* Right: Audio Engine, Speed, Mixer & Reader toggles */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Playback Rate Button */}
            <button
              id="player-rate-btn"
              onClick={() => onChangeRate(nextRate)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 transition-colors"
              title="Change Narration Speed"
            >
              {playbackRate}x
            </button>

            {/* Ambient Audio Mixer */}
            <button
              id="player-ambient-btn"
              onClick={onOpenAmbientSettings}
              className={`p-2 rounded-xl border text-xs transition-colors relative ${
                ambientSound !== 'none'
                  ? 'bg-teal-100 dark:bg-teal-950/90 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
              title="Ambient Background Audio Mixer (Rain, Stream, Library)"
            >
              <CloudRain className="w-4 h-4" />
              {ambientSound !== 'none' && (
                <span className="w-2 h-2 rounded-full bg-teal-500 absolute top-1 right-1" />
              )}
            </button>

            {/* Sleep Timer */}
            <button
              id="player-sleeptimer-btn"
              onClick={onOpenSleepTimer}
              className={`p-2 rounded-xl border text-xs transition-colors relative ${
                sleepTimer.active
                  ? 'bg-indigo-100 dark:bg-indigo-950/90 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
              title="Sleep Timer"
            >
              <Moon className="w-4 h-4" />
              {sleepTimer.active && (
                <span className="w-2 h-2 rounded-full bg-indigo-500 absolute top-1 right-1" />
              )}
            </button>

            {/* Voice Settings */}
            <button
              id="player-voice-settings-btn"
              onClick={onOpenVoiceSettings}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors hidden sm:flex items-center gap-1"
              title="Voice & Narration Engine"
            >
              <SlidersHorizontal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </button>

            {/* Reader Toggle Button */}
            <button
              id="player-toggle-reader-btn"
              onClick={onToggleReader}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                isReaderOpen
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">{isReaderOpen ? 'Library' : 'Read'}</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
