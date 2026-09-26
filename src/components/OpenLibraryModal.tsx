import React, { useState, useEffect, useRef } from 'react';
import { Book, BookCategory, Chapter } from '../types';
import {
  Search,
  Globe,
  X,
  BookOpen,
  Sparkles,
  Loader2,
  Calendar,
  Layers,
  Plus,
  Check,
  AlertCircle,
  ExternalLink,
  Moon,
  Brain,
  Radio,
} from 'lucide-react';

interface OpenLibraryBook {
  id: string;
  openLibraryKey: string;
  title: string;
  author: string;
  coverImage?: string;
  firstPublishYear?: number | null;
  subjects?: string[];
  iaIdentifier?: string | null;
  estimatedPages?: number;
}

interface OpenLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportBook: (book: Book) => void;
}

export const OpenLibraryModal: React.FC<OpenLibraryModalProps> = ({
  isOpen,
  onClose,
  onImportBook,
}) => {
  const latestSearch = useRef(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [results, setResults] = useState<OpenLibraryBook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importingKey, setImportingKey] = useState<string | null>(null);
  const [importedKeys, setImportedKeys] = useState<Set<string>>(new Set());

  // Quick search topics
  const searchCategories = [
    { id: 'All', label: 'Featured Classics' },
    { id: 'Islamic', label: 'Islamic Thought & Spirituality' },
    { id: 'Psychological', label: 'Cognitive Psychology & Mind' },
    { id: 'Contemporary', label: 'Contemporary Philosophy' },
  ];

  const performSearch = async (query: string, cat: string) => {
    const requestId = ++latestSearch.current;
    setIsLoading(true);
    setError(null);
    try {
      const url = `/api/open-library/search?q=${encodeURIComponent(query)}&category=${encodeURIComponent(cat)}&limit=12`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Search request failed');
      const data = await res.json();
      if (requestId === latestSearch.current) setResults(data.books || []);
    } catch (err: any) {
      console.error('Open Library search failed:', err);
      if (requestId === latestSearch.current) setError('Unable to fetch external books from Open Library. Please verify your connection.');
    } finally {
      if (requestId === latestSearch.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      performSearch(searchTerm, selectedCategory);
    }
  }, [isOpen, selectedCategory]);

  if (!isOpen) return null;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchTerm, selectedCategory);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Open Library Search & Explorer
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Book discovery
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Search book records. Open the source to find an available EPUB, then upload that file here. Catalog descriptions are not full books.
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

        {/* Search Bar & Filter Tabs */}
        <div className="pt-4 pb-2 space-y-3">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title, author, or keyword (e.g. Al-Ghazali, Daniel Kahneman, Marcus Aurelius)..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>Search</span>
            </button>
          </form>

          {/* Quick Filter Categories */}
          <div className="flex flex-wrap items-center gap-2">
            {searchCategories.map((c) => {
              const isSel = selectedCategory === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium border transition-all ${
                    isSel
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results Container */}
        <div className="py-4 overflow-y-auto flex-1 space-y-4 pr-1">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Querying Open Library catalogs...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {results.map((b) => {
                const isImported = importedKeys.has(b.openLibraryKey);
                const isImporting = importingKey === b.openLibraryKey;

                return (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 hover:border-emerald-500/50 flex flex-col justify-between transition-all"
                  >
                    <div>
                      {/* Thumbnail Cover */}
                      <div className="w-full h-36 rounded-xl bg-slate-200 dark:bg-slate-800 overflow-hidden mb-3 flex items-center justify-center relative">
                        {b.coverImage ? (
                          <img
                            src={b.coverImage}
                            alt={b.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 flex flex-col items-center justify-center p-3 text-center">
                            <BookOpen className="w-6 h-6 text-slate-400 dark:text-slate-500 mb-1" />
                            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 line-clamp-2">
                              {b.title}
                            </span>
                          </div>
                        )}

                        {b.firstPublishYear && (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-slate-900/80 text-slate-200 text-[10px] font-mono">
                            {b.firstPublishYear}
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-2">
                        {b.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                        {b.author}
                      </p>

                      {b.subjects && b.subjects.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {b.subjects.slice(0, 2).map((s, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 line-clamp-1 max-w-[120px]"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <a
                        href={`https://openlibrary.org/works/${b.openLibraryKey}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-slate-400 hover:text-emerald-500 flex items-center gap-1 transition-colors"
                      >
                        <span>Open Library</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>

<span className="text-[11px] text-slate-500">Catalog record only</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 px-4">
              <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No books found for "{searchTerm}"</p>
              <p className="text-xs text-slate-400 mt-1">Try broader terms like "philosophy", "psychology", or "Ibn Khaldun".</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <p className="text-xs text-slate-400 hidden sm:block">
            Powered by Open Library REST APIs • Free & Open Catalog
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
