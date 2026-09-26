import React from 'react';
import { Book } from '../types';
import { Play, BookOpen, Clock, FileText, Trash2, Moon, Brain, Radio, Sparkles } from 'lucide-react';

interface BookCardProps {
  book: Book;
  onPlayBook: (book: Book, chapterIndex?: number) => void;
  onOpenReader: (book: Book) => void;
  onDeleteBook?: (bookId: string) => void;
  isCurrentlyPlaying: boolean;
  progressPercent?: number;
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  onPlayBook,
  onOpenReader,
  onDeleteBook,
  isCurrentlyPlaying,
  progressPercent = 0,
}) => {
  const formatDuration = (sec: number) => {
    const mins = Math.ceil(sec / 60);
    if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'}`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  };

  const getCategoryStyles = () => {
    switch (book.category) {
      case 'Islamic':
        return {
          badge: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/80',
          icon: Moon,
          gradient: 'from-emerald-900 via-teal-950 to-slate-950',
          borderHover: 'hover:border-emerald-500/50',
        };
      case 'Psychological':
        return {
          badge: 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800/80',
          icon: Brain,
          gradient: 'from-indigo-950 via-violet-950 to-slate-950',
          borderHover: 'hover:border-indigo-500/50',
        };
      case 'Contemporary':
        return {
          badge: 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/80',
          icon: Radio,
          gradient: 'from-amber-950 via-stone-900 to-zinc-950',
          borderHover: 'hover:border-amber-500/50',
        };
      default:
        return {
          badge: 'bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-800/80',
          icon: Sparkles,
          gradient: 'from-teal-950 via-slate-900 to-zinc-950',
          borderHover: 'hover:border-teal-500/50',
        };
    }
  };

  const styles = getCategoryStyles();
  const CategoryIcon = styles.icon;

  return (
    <div
      id={`book-card-${book.id}`}
      className={`group relative flex flex-col bg-white dark:bg-slate-800/70 hover:bg-slate-50 dark:hover:bg-slate-800/95 border border-slate-200 dark:border-slate-700/70 ${styles.borderHover} rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/40 hover:-translate-y-1`}
    >
      {/* Book Cover Header */}
      <div className="relative h-48 w-full overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-3">
        {book.coverImage ? (
          <img
            src={book.coverImage}
            alt={book.title}
            className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={`w-full h-full rounded-xl bg-gradient-to-br ${styles.gradient} border border-slate-700/50 p-4 flex flex-col justify-between relative overflow-hidden shadow-inner text-white`}>
            {/* Book spine visual stripe */}
            <div className="absolute left-0 top-0 bottom-0 w-3 bg-white/10 backdrop-blur-xs border-r border-white/10" />
            
            {/* Background watermark icon */}
            <CategoryIcon className="absolute -right-3 -bottom-3 w-24 h-24 text-white/5 pointer-events-none" />

            <div className="pl-3">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles.badge}`}>
                <CategoryIcon className="w-3 h-3" />
                {book.category}
              </span>
            </div>

            <div className="pl-3 z-10">
              <h4 className="font-serif font-bold text-white text-base leading-snug line-clamp-2">
                {book.title}
              </h4>
              <p className="text-xs text-slate-300 mt-1 line-clamp-1">
                {book.author}
              </p>
            </div>
          </div>
        )}

        {/* Floating Quick Action Overlay on Hover */}
        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3 backdrop-blur-xs">
          <button
            id={`quick-play-${book.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onPlayBook(book, 0);
            }}
            className="p-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-950/50 hover:scale-110 active:scale-95 transition-all"
            title="Start Audio Narration"
          >
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </button>

          <button
            id={`quick-read-${book.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenReader(book);
            }}
            className="p-3.5 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold border border-slate-300 dark:border-slate-600 shadow-lg hover:scale-110 active:scale-95 transition-all"
            title="Open Chapter Reader"
          >
            <BookOpen className="w-5 h-5" />
          </button>
        </div>

        {/* Playing Badge */}
        {isCurrentlyPlaying && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-emerald-500 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg animate-pulse">
            <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
            Playing
          </div>
        )}

        {/* Custom Upload Badge */}
        {book.isCustomUpload && !isCurrentlyPlaying && (
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-teal-900/90 text-teal-200 border border-teal-700 text-[11px] font-semibold">
            Custom
          </div>
        )}
      </div>

      {/* Book Metadata and Details */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
              {book.title}
            </h3>
            {book.isCustomUpload && onDeleteBook && (
              <button
                id={`delete-book-${book.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${book.title}" from your library?`)) {
                    onDeleteBook(book.id);
                  }
                }}
                className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded transition-colors"
                title="Delete book"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {book.author}
          </p>

          <p className="text-xs text-slate-600 dark:text-slate-300/80 mt-2.5 line-clamp-2 leading-relaxed">
            {book.description}
          </p>
        </div>

        {/* Stats Row */}
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/60">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-3">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDuration(book.totalDurationSec)}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              {(book.chapterCount ?? book.chapters.length)} {(book.chapterCount ?? book.chapters.length) === 1 ? 'chapter' : 'chapters'}
            </span>
            <span>
              {book.totalWords.toLocaleString()} words
            </span>
          </div>

          {/* Reading progress bar */}
          {progressPercent > 0 && (
            <div className="w-full bg-slate-200 dark:bg-slate-700/50 rounded-full h-1.5 mb-3 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, progressPercent)}%` }}
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              id={`card-play-btn-${book.id}`}
              onClick={() => onPlayBook(book, 0)}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Listen</span>
            </button>

            <button
              id={`card-read-btn-${book.id}`}
              onClick={() => onOpenReader(book)}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-600/60 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Read</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
