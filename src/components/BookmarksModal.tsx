import React from 'react';
import { Bookmark, Book } from '../types';
import { BookmarkCheck, X, Trash2, ArrowRight, BookOpen, Clock } from 'lucide-react';

interface BookmarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
  books: Book[];
  onSelectBookmark: (bookId: string, chapterId: string, paragraphIndex: number) => void;
  onDeleteBookmark: (bookmarkId: string) => void;
}

export const BookmarksModal: React.FC<BookmarksModalProps> = ({
  isOpen,
  onClose,
  bookmarks,
  books,
  onSelectBookmark,
  onDeleteBookmark,
}) => {
  if (!isOpen) return null;

  const getBookTitle = (bookId: string) => {
    return books.find((b) => b.id === bookId)?.title || 'Audiobook';
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Recent';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <BookmarkCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Bookmarks & Quotes
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {bookmarks.length} saved passage{bookmarks.length === 1 ? '' : 's'} across your library
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

        {/* Bookmarks List */}
        <div className="py-5 overflow-y-auto space-y-3 flex-1 pr-1">
          {bookmarks.length > 0 ? (
            bookmarks.map((bm) => (
              <div
                key={bm.id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 hover:border-amber-500/50 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      {getBookTitle(bm.bookId)} • {bm.chapterTitle}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      <Clock className="w-3 h-3" />
                      {formatDate(bm.timestamp)}
                    </span>
                  </div>

                  <blockquote className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 italic border-l-2 border-amber-500 pl-3 leading-relaxed">
                    "{bm.snippet}"
                  </blockquote>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700/40 text-xs">
                  <span className="text-slate-400 text-[11px]">
                    Paragraph #{bm.paragraphIndex + 1}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onDeleteBookmark(bm.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                      title="Delete bookmark"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        onSelectBookmark(bm.bookId, bm.chapterId, bm.paragraphIndex);
                        onClose();
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all"
                    >
                      <span>Jump to Reading</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16 px-4">
              <BookmarkCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No saved bookmarks yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Hover or tap any paragraph inside the Chapter Reader to bookmark passages.
              </p>
            </div>
          )}
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
