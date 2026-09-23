import React, { useState, useEffect, useRef } from 'react';
import { Book, Chapter, Bookmark } from '../types';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  List,
  Sparkles,
  BookmarkPlus,
  Type,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Clock,
  FileText,
  Volume2,
  BookOpen,
} from 'lucide-react';

interface ReaderViewProps {
  book: Book;
  currentChapterIndex: number;
  currentParagraphIndex: number;
  isPlaying: boolean;
  onBackToLibrary: () => void;
  onSelectChapter: (index: number) => void;
  onPlayPause: () => void;
  onJumpToParagraph: (index: number) => void;
  onAddBookmark: (chapterId: string, chapterTitle: string, paragraphIndex: number, snippet: string) => void;
  onOpenAiInsights: (chapter: Chapter) => void;
  bookmarks: Bookmark[];
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  book,
  currentChapterIndex,
  currentParagraphIndex,
  isPlaying,
  onBackToLibrary,
  onSelectChapter,
  onPlayPause,
  onJumpToParagraph,
  onAddBookmark,
  onOpenAiInsights,
  bookmarks,
}) => {
  const [showToc, setShowToc] = useState(false);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('lg');
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans' | 'mono'>('serif');
  const [autoScroll, setAutoScroll] = useState(true);
  const [bookmarkToast, setBookmarkToast] = useState<string | null>(null);

  const activeParagraphRef = useRef<HTMLParagraphElement | null>(null);
  const currentChapter = book.chapters[currentChapterIndex] || book.chapters[0];

  // Auto-scroll to active paragraph when playing
  useEffect(() => {
    if (autoScroll && activeParagraphRef.current && isPlaying) {
      activeParagraphRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentParagraphIndex, autoScroll, isPlaying]);

  const handleBookmarkParagraph = (index: number, text: string) => {
    onAddBookmark(currentChapter.id, currentChapter.title, index, text);
    setBookmarkToast(`Bookmarked paragraph ${index + 1}`);
    setTimeout(() => setBookmarkToast(null), 2500);
  };

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'sm': return 'text-sm sm:text-base leading-relaxed';
      case 'base': return 'text-base sm:text-lg leading-relaxed';
      case 'lg': return 'text-lg sm:text-xl leading-loose';
      case 'xl': return 'text-xl sm:text-2xl leading-loose';
    }
  };

  const getFontFamilyClass = () => {
    switch (fontFamily) {
      case 'serif': return 'font-serif';
      case 'sans': return 'font-sans';
      case 'mono': return 'font-mono';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-36 transition-colors duration-200">
      
      {/* Top Sticky Reader Navigation Bar */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          
          {/* Left: Back to Library */}
          <div className="flex items-center gap-3">
            <button
              id="reader-back-btn"
              onClick={onBackToLibrary}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Return to Library"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Library</span>
            </button>

            <div className="hidden md:block">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1 max-w-[200px] lg:max-w-xs">
                {book.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {book.author}
              </p>
            </div>
          </div>

          {/* Center: Chapter Switcher Title */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => onSelectChapter(Math.max(0, currentChapterIndex - 1))}
              disabled={currentChapterIndex === 0}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous Chapter"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowToc(!showToc)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
            >
              <List className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="max-w-[140px] sm:max-w-[200px] truncate">{currentChapter.title}</span>
              <span className="text-[10px] text-slate-400">({currentChapterIndex + 1}/{book.chapters.length})</span>
            </button>

            <button
              onClick={() => onSelectChapter(Math.min(book.chapters.length - 1, currentChapterIndex + 1))}
              disabled={currentChapterIndex === book.chapters.length - 1}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next Chapter"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Typography & AI Insights */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* AI Insights Button */}
            <button
              id="reader-ai-insights-btn"
              onClick={() => onOpenAiInsights(currentChapter)}
              className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1 transition-colors"
              title="Generate Chapter AI Insights & Reflection Prompts"
            >
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Insights</span>
            </button>

            {/* Font Size Selector */}
            <div className="hidden sm:flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
              {(['sm', 'base', 'lg', 'xl'] as const).map((sz) => (
                <button
                  key={sz}
                  onClick={() => setFontSize(sz)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                    fontSize === sz
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {sz.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Font Family Toggle */}
            <button
              onClick={() => {
                const fams: ('serif' | 'sans' | 'mono')[] = ['serif', 'sans', 'mono'];
                const next = fams[(fams.indexOf(fontFamily) + 1) % fams.length];
                setFontFamily(next);
              }}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold capitalize transition-colors"
              title="Toggle Font Family"
            >
              <Type className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

      {/* Table of Contents Drawer Modal */}
      {showToc && (
        <div className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs flex items-start justify-center pt-16 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-h-[80vh] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <List className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Table of Contents</h3>
              </div>
              <button
                onClick={() => setShowToc(false)}
                className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white p-1"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto space-y-1.5 flex-1 pr-1">
              {book.chapters.map((ch, idx) => {
                const isSelected = idx === currentChapterIndex;
                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      onSelectChapter(idx);
                      setShowToc(false);
                    }}
                    className={`w-full p-3 rounded-2xl text-left text-xs transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-bold'
                        : 'bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="w-5 font-mono text-slate-400">{idx + 1}.</span>
                      <span className="truncate">{ch.title}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                      ~{Math.ceil(ch.estimatedDurationSec / 60)}m
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bookmark Toast Alert */}
      {bookmarkToast && (
        <div className="fixed top-20 right-6 z-50 px-4 py-2.5 rounded-2xl bg-amber-500 text-slate-950 font-bold text-xs shadow-xl flex items-center gap-2 animate-fade-in">
          <BookmarkPlus className="w-4 h-4" />
          <span>{bookmarkToast}</span>
        </div>
      )}

      {/* Main Chapter Content Container */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full space-y-8">
        
        {/* Chapter Header Info */}
        <div className="text-center space-y-3 pb-8 border-b border-slate-200 dark:border-slate-800">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <span>Chapter {currentChapterIndex + 1} of {book.chapters.length}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight font-serif">
            {currentChapter.title}
          </h1>

          <div className="flex items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              ~{Math.ceil(currentChapter.estimatedDurationSec / 60)} minutes narration
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-teal-500" />
              {currentChapter.wordCount.toLocaleString()} words
            </span>
          </div>
        </div>

        {/* Paragraphs with Karaoke Synced Highlighting */}
        <div className={`space-y-6 ${getFontSizeClass()} ${getFontFamilyClass()}`}>
          {currentChapter.paragraphs.map((paragraph, pIdx) => {
            const isCurrentlySpoken = isPlaying && pIdx === currentParagraphIndex;
            const isSelected = pIdx === currentParagraphIndex;

            return (
              <div
                key={pIdx}
                ref={isSelected ? activeParagraphRef : null}
                className={`group relative p-4 sm:p-5 rounded-2xl transition-all duration-300 ${
                  isCurrentlySpoken
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-500 text-slate-900 dark:text-emerald-50 shadow-md scale-[1.01]'
                    : isSelected
                    ? 'bg-slate-100/80 dark:bg-slate-800/40 border-l-4 border-slate-400 dark:border-slate-600 text-slate-900 dark:text-slate-100'
                    : 'hover:bg-slate-100/50 dark:hover:bg-slate-900/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                {/* Paragraph Content */}
                <p className="leading-relaxed">
                  {paragraph}
                </p>

                {/* Hover Action Controls (Jump & Bookmark) */}
                <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => onJumpToParagraph(pIdx)}
                    className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-lg text-xs font-semibold flex items-center gap-1"
                    title="Play narration from this paragraph"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>

                  <button
                    onClick={() => handleBookmarkParagraph(pIdx, paragraph)}
                    className="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950 rounded-lg text-xs"
                    title="Bookmark this paragraph"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Chapter Navigation Bar */}
        <div className="pt-10 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <button
            onClick={() => onSelectChapter(Math.max(0, currentChapterIndex - 1))}
            disabled={currentChapterIndex === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous Chapter</span>
          </button>

          <button
            onClick={() => onOpenAiInsights(currentChapter)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>Chapter AI Summary</span>
          </button>

          <button
            onClick={() => onSelectChapter(Math.min(book.chapters.length - 1, currentChapterIndex + 1))}
            disabled={currentChapterIndex === book.chapters.length - 1}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <span>Next Chapter</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </main>
    </div>
  );
};
