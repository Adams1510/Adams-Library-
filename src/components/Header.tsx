import React from 'react';
import {
  BookOpen,
  Upload,
  Search,
  BookmarkCheck,
  Volume2,
  Sparkles,
  SlidersHorizontal,
  Sun,
  Moon,
  Globe,
} from 'lucide-react';
import { BookCategory } from '../types';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenUpload: () => void;
  onOpenOpenLibrary: () => void;
  onOpenBookmarks: () => void;
  onOpenVoiceSettings: () => void;
  isPlaying: boolean;
  activeBookTitle?: string;
  onReturnToPlaying?: () => void;
  totalBooksCount: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onOpenUpload,
  onOpenOpenLibrary,
  onOpenBookmarks,
  onOpenVoiceSettings,
  isPlaying,
  activeBookTitle,
  onReturnToPlaying,
  totalBooksCount,
  theme,
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3 sm:gap-4">
          
          {/* Brand Logo & Name */}
          <div
            className="flex items-center gap-3 shrink-0 cursor-pointer"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 flex items-center justify-center shadow-md shadow-teal-900/20 text-white">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
                  Adam’s <span className="text-emerald-600 dark:text-emerald-400">Library</span>
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                  <Sparkles className="w-3 h-3 mr-1 text-emerald-600 dark:text-emerald-400" />
                  ePub & AI TTS
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Phone & PC Speech Narration • {totalBooksCount} {totalBooksCount === 1 ? 'Volume' : 'Volumes'}
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="header-search flex-1 min-w-0 max-w-md mx-1 sm:mx-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="main-search-input"
                aria-label="Search your library"
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search your library…"
                className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Actions & Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Active playback pulse banner */}
            {isPlaying && activeBookTitle && (
              <button
                id="active-playback-banner-btn"
                onClick={onReturnToPlaying}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/90 border border-emerald-300 dark:border-emerald-700/70 text-emerald-800 dark:text-emerald-300 text-xs font-medium hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-colors animate-pulse"
                title="Click to jump to currently playing chapter"
              >
                <Volume2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-bounce" />
                <span className="max-w-[120px] truncate">{activeBookTitle}</span>
              </button>
            )}

            {/* Open Library search trigger */}
            <button
              id="header-openlibrary-btn"
              onClick={onOpenOpenLibrary}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-sm transition-colors flex items-center gap-1.5"
              title="Search Online (Open Library catalog)"
            >
              <Globe className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span className="hidden xl:inline text-xs font-medium">Explore</span>
            </button>

            {/* Voice Settings modal button */}
            <button
              id="header-voice-settings-btn"
              onClick={onOpenVoiceSettings}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-sm transition-colors flex items-center gap-1.5"
              title="Voice & Speech Settings"
            >
              <SlidersHorizontal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden lg:inline text-xs font-medium">Voices</span>
            </button>

            {/* Bookmarks modal button */}
            <button
              id="header-bookmarks-btn"
              onClick={onOpenBookmarks}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-sm transition-colors flex items-center gap-1.5"
              title="Saved Bookmarks & Notes"
            >
              <BookmarkCheck className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <span className="hidden lg:inline text-xs font-medium">Bookmarks</span>
            </button>

            {/* Light / Dark Mode Toggle */}
            <button
              id="theme-toggle-btn"
              onClick={onToggleTheme}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-sm transition-colors flex items-center gap-1"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              aria-label="Toggle light/dark theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>

            {/* Upload ePub Button */}
            <button
              id="header-upload-epub-btn"
              onClick={onOpenUpload}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-emerald-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload ePub</span>
              <span className="sm:hidden">Upload</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
