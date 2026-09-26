import React, { useState } from 'react';
import { Book, BookCategory } from '../types';
import { CategoryFilter } from './CategoryFilter';
import { BookCard } from './BookCard';
import {
  Upload,
  Sparkles,
  ArrowUpDown,
  BookOpen,
  Clock,
  Headphones,
  Globe,
  FileCheck,
  CheckCircle2,
  HelpCircle,
  Plus,
} from 'lucide-react';

interface LibraryViewProps {
  books: Book[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
  onPlayBook: (book: Book, chapterIndex?: number) => void;
  onOpenReader: (book: Book) => void;
  onDeleteBook: (bookId: string) => void;
  onOpenUpload: () => void;
  onOpenOpenLibrary: () => void;
  onLoadQuickSample: () => void;
  activeBookId?: string;
  isPlaying: boolean;
  readingProgress: Record<string, number>; // bookId -> percentage
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  books,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onPlayBook,
  onOpenReader,
  onDeleteBook,
  onOpenUpload,
  onOpenOpenLibrary,
  onLoadQuickSample,
  activeBookId,
  isPlaying,
  readingProgress,
}) => {
  const [sortBy, setSortBy] = useState<'recommended' | 'duration' | 'title' | 'chapters'>('recommended');

  // Filter books by category and search query
  const filteredBooks = books.filter((book) => {
    // Category match
    if (selectedCategory !== 'All') {
      if (selectedCategory === 'Custom') {
        if (!book.isCustomUpload) return false;
      } else if (book.category !== selectedCategory) {
        return false;
      }
    }

    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const inTitle = book.title.toLowerCase().includes(q);
      const inAuthor = book.author.toLowerCase().includes(q);
      const inCategory = book.category.toLowerCase().includes(q);
      const inDesc = book.description.toLowerCase().includes(q);
      const inChapters = book.chapters.some(c => c.title.toLowerCase().includes(q) || c.content.toLowerCase().includes(q));
      const inTags = book.tags?.some(t => t.toLowerCase().includes(q));

      return inTitle || inAuthor || inCategory || inDesc || inChapters || inTags;
    }

    return true;
  });

  // Sort filtered books
  const sortedBooks = [...filteredBooks].sort((a, b) => {
    if (sortBy === 'duration') return b.totalDurationSec - a.totalDurationSec;
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'chapters') return (b.chapterCount ?? b.chapters.length) - (a.chapterCount ?? a.chapters.length);
    return 0; // recommended
  });

  // Category counts
  const categoryCounts = {
    all: books.length,
    islamic: books.filter(b => b.category === 'Islamic').length,
    psychological: books.filter(b => b.category === 'Psychological').length,
    contemporary: books.filter(b => b.category === 'Contemporary').length,
    custom: books.filter(b => b.isCustomUpload).length,
  };

  const totalMinutes = Math.round(books.reduce((acc, b) => acc + b.totalDurationSec, 0) / 60);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
      
      {/* Ready Status & Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 border border-slate-700/80 p-6 sm:p-8 shadow-2xl text-white">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 mb-3">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Read and listen at your own pace</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
              Your personal <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">listening library</span>
            </h1>
            
            <p className="text-sm sm:text-base text-slate-300 mt-2 leading-relaxed">
              Upload custom .ePub files, extract clean chapter text, and listen with Gemini AI & natural device voices. Organize Islamic philosophy, cognitive psychology, and contemporary reflections.
            </p>

            {/* Quick Metrics Bar */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-5 text-xs sm:text-sm text-slate-300">
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span>{books.length} {books.length === 1 ? 'Volume' : 'Volumes'} in Library</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
                <Clock className="w-4 h-4 text-teal-400" />
                <span>~{totalMinutes} mins narration</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
                <Headphones className="w-4 h-4 text-indigo-400" />
                <span>Gemini Studio + Device Audio</span>
              </div>
            </div>
          </div>

          {/* Quick Upload CTA & Explore */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
            <button
              id="hero-upload-cta"
              onClick={onOpenUpload}
              className="flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-950/60 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Upload className="w-5 h-5 stroke-[2.5]" />
              <span>Upload Custom ePub</span>
            </button>

            <button
              id="hero-openlibrary-cta"
              onClick={onOpenOpenLibrary}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-semibold transition-all hover:scale-[1.02]"
            >
              <Globe className="w-4 h-4 text-teal-400" />
              <span>Search Open Library</span>
            </button>
          </div>
        </div>
      </div>

      {/* When books are present: Show Filter and Grid */}
      {books.length > 0 ? (
        <div className="space-y-6">
          {/* Category Tabs & Sort row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CategoryFilter
              selectedCategory={selectedCategory}
              onSelectCategory={onSelectCategory}
              categoryCounts={categoryCounts}
            />

            {/* Sort Selector */}
            <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5" />
                Sort:
              </span>
              <select
                id="library-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="Sort books"
                className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="recommended">Curated Order</option>
                <option value="duration">Longest Duration</option>
                <option value="chapters">Most Chapters</option>
                <option value="title">Alphabetical (Title)</option>
              </select>
            </div>
          </div>

          {/* Books Grid Display */}
          {sortedBooks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  onPlayBook={onPlayBook}
                  onOpenReader={onOpenReader}
                  onDeleteBook={onDeleteBook}
                  isCurrentlyPlaying={isPlaying && activeBookId === book.id}
                  progressPercent={readingProgress[book.id] || 0}
                />
              ))}
            </div>
          ) : (
            /* Search filter empty */
            <div className="text-center py-16 px-4 bg-white dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700/80">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                <BookOpen className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">No matching audiobooks found</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                No books matched your criteria. Try adjusting your search query or upload a new ePub file.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={onOpenUpload}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                >
                  Upload ePub File
                </button>
                <button
                  onClick={() => onSelectCategory('All')}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Pristine Zero-Placeholder Empty State: Ready for first ePub upload */
        <div className="relative rounded-3xl p-8 sm:p-12 text-center bg-white dark:bg-slate-900/60 border-2 border-dashed border-slate-300 dark:border-slate-700/80 shadow-sm space-y-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner">
            <Upload className="w-10 h-10 stroke-[2]" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Your library is empty</span>
            </div>
            
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              Add your first book
            </h3>
            
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Upload EPUB or text files to read and listen. Device voices work without an API key; AI voices need Gemini setup.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              id="empty-state-upload-btn"
              onClick={onOpenUpload}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-900/20 transition-all hover:scale-105 active:scale-95"
            >
              <Upload className="w-4 h-4" />
              <span>Upload ePub File</span>
            </button>

            <button
              id="empty-state-openlibrary-btn"
              onClick={onOpenOpenLibrary}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-sm font-semibold transition-all hover:scale-105"
            >
              <Globe className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Search Open Library</span>
            </button>

            <button
              id="empty-state-sample-btn"
              onClick={onLoadQuickSample}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-sm font-medium transition-all"
              title="Test audio player immediately with a quick sample chapter"
            >
              <Plus className="w-4 h-4 text-emerald-500" />
              <span>Try a short demo</span>
            </button>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 max-w-2xl mx-auto text-left border-t border-slate-200 dark:border-slate-800">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
              <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-emerald-500" />
                Automatic TOC Extraction
              </h5>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Reads OPF container & splits chapters by spine with word estimates.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
              <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Headphones className="w-4 h-4 text-teal-500" />
                Gemini AI Voice Models
              </h5>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Stream Kore, Puck, Fenrir, Zephyr & Charon voices with device fallback.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
              <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Ambient Sound & Timer
              </h5>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Layer rain, library noise, or forest stream with sleep countdown.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
