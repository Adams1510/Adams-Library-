import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Book, Chapter, BookCategory, Bookmark, SleepTimerState, TtsEngine } from './types';
import { INITIAL_BOOKS } from './data/sampleBooks';
import { speechEngine } from './services/speechEngine';
import { ambientSound } from './utils/ambientAudio';

import { Header } from './components/Header';
import { LibraryView } from './components/LibraryView';
import { ReaderView } from './components/ReaderView';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { EpubUploadModal } from './components/EpubUploadModal';
import { OpenLibraryModal } from './components/OpenLibraryModal';
import { VoiceSettingsModal } from './components/VoiceSettingsModal';
import { SleepTimerModal } from './components/SleepTimerModal';
import { AmbientSoundModal } from './components/AmbientSoundModal';
import { AiInsightsModal } from './components/AiInsightsModal';
import { BookmarksModal } from './components/BookmarksModal';

const STORAGE_KEY_BOOKS = 'audiobook_studio_books_v2';
const STORAGE_KEY_BOOKMARKS = 'audiobook_studio_bookmarks_v2';
const STORAGE_KEY_PROGRESS = 'audiobook_studio_progress_v2';
const STORAGE_KEY_THEME = 'audiobook_studio_theme_v2';

export default function App() {
  // --- Theme State (Dark / Light) ---
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
      if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_THEME, theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // --- Persistent State: Zero placeholder books by default ---
  const [books, setBooks] = useState<Book[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BOOKS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_BOOKS; // strictly []
  });

  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BOOKMARKS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [readingProgress, setReadingProgress] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROGRESS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  // --- App Views & Filtering ---
  const [currentView, setCurrentView] = useState<'library' | 'reader'>('library');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // --- Active Playback State ---
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(0);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentProgressSec, setCurrentProgressSec] = useState<number>(0);
  const [totalDurationSec, setTotalDurationSec] = useState<number>(100);

  // --- Speech & Audio Settings ---
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(1.0);
  const [ttsEngine, setTtsEngine] = useState<TtsEngine>('gemini');
  const [geminiVoiceName, setGeminiVoiceName] = useState<string>('Kore');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [ambientSoundType, setAmbientSoundType] = useState<'none' | 'rain' | 'library' | 'stream' | 'waves'>('none');
  const [ambientVolume, setAmbientVolume] = useState<number>(0.3);

  // --- Sleep Timer ---
  const [sleepTimer, setSleepTimer] = useState<SleepTimerState>({
    active: false,
    targetMinutes: 0,
    endOfChapter: false,
    remainingSeconds: 0,
  });

  // --- Modals State ---
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isOpenLibraryOpen, setIsOpenLibraryOpen] = useState(false);
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState(false);
  const [isAmbientOpen, setIsAmbientOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [insightsChapter, setInsightsChapter] = useState<Chapter | null>(null);
  const [fallbackToast, setFallbackToast] = useState<string | null>(null);

  // Derive active book & chapter
  const activeBook = books.find(b => b.id === activeBookId) || (books.length > 0 ? books[0] : null);
  const activeChapter = activeBook?.chapters[activeChapterIndex] || (activeBook?.chapters[0] || null);

  // Save books to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_BOOKS, JSON.stringify(books));
    } catch {}
  }, [books]);

  // Save bookmarks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(bookmarks));
    } catch {}
  }, [bookmarks]);

  // Save progress to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(readingProgress));
    } catch {}
  }, [readingProgress]);

  // Chapter completion handler
  const handleChapterComplete = useCallback(() => {
    if (sleepTimer.active && sleepTimer.endOfChapter) {
      speechEngine.stop();
      ambientSound.stop();
      setSleepTimer({ active: false, targetMinutes: 0, endOfChapter: false, remainingSeconds: 0 });
      return;
    }

    // Trigger celebratory confetti on finishing chapter
    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.8 },
      });
    } catch {}

    // Advance to next chapter if available
    if (activeBook && activeChapterIndex + 1 < activeBook.chapters.length) {
      const nextIdx = activeChapterIndex + 1;
      setActiveChapterIndex(nextIdx);
      setActiveParagraphIndex(0);
      const nextChap = activeBook.chapters[nextIdx];
      speechEngine.loadChapter(nextChap.paragraphs, 0, nextChap.wordCount);
      speechEngine.play();
    } else {
      speechEngine.stop();
    }
  }, [activeBook, activeChapterIndex, sleepTimer]);

  // Configure speech engine callbacks and settings
  useEffect(() => {
    speechEngine.setCallbacks({
      onParagraphChange: (pIdx) => {
        setActiveParagraphIndex(pIdx);
        // update reading progress
        if (activeBook && activeChapter) {
          const chapterFraction = (pIdx + 1) / (activeChapter.paragraphs.length || 1);
          const totalChapters = activeBook.chapters.length || 1;
          const overallFraction = ((activeChapterIndex + chapterFraction) / totalChapters) * 100;
          setReadingProgress(prev => ({
            ...prev,
            [activeBook.id]: Math.min(100, Math.round(overallFraction)),
          }));
        }
      },
      onStateChange: (playing) => {
        setIsPlaying(playing);
      },
      onProgress: (curSec, totSec) => {
        setCurrentProgressSec(curSec);
        setTotalDurationSec(totSec);
      },
      onChapterComplete: () => {
        handleChapterComplete();
      },
      onEngineFallback: (msg) => {
        setFallbackToast(msg);
        setTimeout(() => {
          setFallbackToast(null);
        }, 6000);
      },
      onError: (err) => {
        console.warn('Speech engine error:', err);
      },
    });

    speechEngine.setEngine(ttsEngine, geminiVoiceName);
    speechEngine.setPlaybackRate(playbackRate);
    speechEngine.setPitch(pitch);
  }, [activeBookId, activeChapterIndex, ttsEngine, geminiVoiceName, playbackRate, pitch, handleChapterComplete]);

  // Sleep Timer Countdown Interval
  useEffect(() => {
    if (!sleepTimer.active || sleepTimer.endOfChapter) return;

    const interval = window.setInterval(() => {
      setSleepTimer(prev => {
        if (prev.remainingSeconds <= 1) {
          speechEngine.pause();
          ambientSound.stop();
          return { active: false, targetMinutes: 0, endOfChapter: false, remainingSeconds: 0 };
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimer.active, sleepTimer.endOfChapter]);

  // --- Audio Control Functions ---
  const handlePlayBook = (book: Book, chapterIndex: number = 0) => {
    setActiveBookId(book.id);
    setActiveChapterIndex(chapterIndex);
    setActiveParagraphIndex(0);

    const chapter = book.chapters[chapterIndex] || book.chapters[0];
    if (chapter) {
      speechEngine.loadChapter(chapter.paragraphs, 0, chapter.wordCount);
      speechEngine.play();
    }
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      speechEngine.pause();
    } else {
      if (activeChapter) {
        if (!speechEngine.getCurrentState().isPlaying) {
          speechEngine.loadChapter(activeChapter.paragraphs, activeParagraphIndex, activeChapter.wordCount);
        }
        speechEngine.resume();
      }
    }
  };

  const handleSkip15 = (delta: number) => {
    speechEngine.skipSeconds(delta);
  };

  const handleSelectChapter = (index: number) => {
    if (!activeBook) return;
    const validIdx = Math.max(0, Math.min(activeBook.chapters.length - 1, index));
    setActiveChapterIndex(validIdx);
    setActiveParagraphIndex(0);

    const chapter = activeBook.chapters[validIdx];
    if (chapter) {
      speechEngine.loadChapter(chapter.paragraphs, 0, chapter.wordCount);
      if (isPlaying) {
        speechEngine.play();
      }
    }
  };

  const handleJumpToParagraph = (pIdx: number) => {
    setActiveParagraphIndex(pIdx);
    speechEngine.jumpToParagraph(pIdx);
  };

  const handleSeek = (fraction: number) => {
    if (!activeChapter) return;
    const targetPIdx = Math.floor(fraction * (activeChapter.paragraphs.length || 1));
    handleJumpToParagraph(targetPIdx);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSkip15(-15);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSkip15(15);
      } else if (e.code === 'Escape') {
        setIsUploadOpen(false);
        setIsOpenLibraryOpen(false);
        setIsVoiceSettingsOpen(false);
        setIsSleepTimerOpen(false);
        setIsAmbientOpen(false);
        setIsBookmarksOpen(false);
        setIsInsightsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, activeBook, activeChapterIndex, activeParagraphIndex]);

  // --- Bookmark Management ---
  const handleAddBookmark = (chapterId: string, chapterTitle: string, paragraphIndex: number, snippet: string) => {
    if (!activeBook) return;
    const newBm: Bookmark = {
      id: `bm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      bookId: activeBook.id,
      chapterId,
      chapterTitle,
      paragraphIndex,
      snippet,
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    };
    setBookmarks(prev => [newBm, ...prev]);
  };

  const handleDeleteBookmark = (id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  const handleSelectBookmark = (bookId: string, chapterId: string, paragraphIndex: number) => {
    const targetBook = books.find(b => b.id === bookId);
    if (!targetBook) return;

    setActiveBookId(targetBook.id);
    const chapterIdx = targetBook.chapters.findIndex(c => c.id === chapterId);
    const validChapterIdx = chapterIdx !== -1 ? chapterIdx : 0;
    setActiveChapterIndex(validChapterIdx);
    setActiveParagraphIndex(paragraphIndex);

    setCurrentView('reader');

    const chap = targetBook.chapters[validChapterIdx];
    if (chap) {
      speechEngine.loadChapter(chap.paragraphs, paragraphIndex, chap.wordCount);
      speechEngine.play();
    }
  };

  // --- Custom ePub Import ---
  const handleBookImported = (newBook: Book) => {
    setBooks(prev => [newBook, ...prev]);
    handlePlayBook(newBook, 0);
    setCurrentView('reader');
  };

  const handleDeleteBook = (bookId: string) => {
    setBooks(prev => prev.filter(b => b.id !== bookId));
    if (activeBookId === bookId) {
      speechEngine.stop();
      setActiveBookId(null);
    }
  };

  // --- Quick Test ePub Generator (for immediate audio testing if desired) ---
  const handleLoadQuickSample = () => {
    const sampleParagraphs = [
      'In the name of contemplative wisdom and clarity. Know that the heart of man is like a polished mirror reflecting whichever world it turns toward.',
      'When the mind becomes tranquil through disciplined contemplation, internal anxieties dissipate, allowing cognitive and spiritual balance to flourish.',
      'Every moment of genuine self-reflection builds emotional resilience and anchors the spirit in timeless purpose.',
    ];
    const textContent = sampleParagraphs.join('\n\n');
    const wordCount = textContent.split(/\s+/).length;

    const quickSampleBook: Book = {
      id: `sample-${Date.now()}`,
      title: 'The Discipline of the Mind & Spirit',
      author: 'Imam Al-Ghazali & Contemporary Commentary',
      category: 'Islamic',
      description: 'An introductory discourse on emotional equanimity, cognitive contemplation, and inner peace.',
      totalWords: wordCount,
      totalDurationSec: Math.max(20, Math.round((wordCount / 140) * 60)),
      uploadedAt: new Date().toISOString(),
      isCustomUpload: true,
      rating: 4.9,
      tags: ['Islamic', 'Psychology', 'Mindfulness'],
      chapters: [
        {
          id: `sample-ch1-${Date.now()}`,
          title: 'Chapter 1: The Sanctuary of Intention',
          order: 1,
          content: textContent,
          paragraphs: sampleParagraphs,
          wordCount,
          estimatedDurationSec: Math.max(20, Math.round((wordCount / 140) * 60)),
        },
      ],
    };

    setBooks(prev => [quickSampleBook, ...prev]);
    handlePlayBook(quickSampleBook, 0);
    setCurrentView('reader');
  };

  // --- Voice & Speech Settings ---
  const handleSelectEngineAndVoice = (engine: TtsEngine, geminiVoice: string) => {
    setTtsEngine(engine);
    setGeminiVoiceName(geminiVoice);
    speechEngine.setEngine(engine, geminiVoice);
  };

  const handleChangePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    speechEngine.setPlaybackRate(rate);
  };

  const handleChangePitch = (p: number) => {
    setPitch(p);
    speechEngine.setPitch(p);
  };

  // --- Ambient Sound ---
  const handleSelectAmbientSound = (type: 'none' | 'rain' | 'library' | 'stream' | 'waves') => {
    setAmbientSoundType(type);
    ambientSound.setSound(type, ambientVolume);
  };

  const handleChangeAmbientVolume = (vol: number) => {
    setAmbientVolume(vol);
    ambientSound.setVolume(vol);
  };

  // --- Sleep Timer ---
  const handleSetSleepMinutes = (mins: number) => {
    setSleepTimer({
      active: true,
      targetMinutes: mins,
      endOfChapter: false,
      remainingSeconds: mins * 60,
    });
  };

  const handleSetSleepEndOfChapter = () => {
    setSleepTimer({
      active: true,
      targetMinutes: 0,
      endOfChapter: true,
      remainingSeconds: 0,
    });
  };

  const handleCancelSleepTimer = () => {
    setSleepTimer({
      active: false,
      targetMinutes: 0,
      endOfChapter: false,
      remainingSeconds: 0,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950 transition-colors duration-200">
      
      {/* Top Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (currentView === 'reader' && q.trim()) {
            setCurrentView('library');
          }
        }}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenOpenLibrary={() => setIsOpenLibraryOpen(true)}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        onOpenVoiceSettings={() => setIsVoiceSettingsOpen(true)}
        isPlaying={isPlaying}
        activeBookTitle={activeBook?.title}
        onReturnToPlaying={() => setCurrentView('reader')}
        totalBooksCount={books.length}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Dynamic Engine Notification Toast */}
      {fallbackToast && (
        <div className="fixed top-20 right-4 z-50 max-w-sm p-3.5 rounded-2xl bg-emerald-950/90 dark:bg-slate-850/95 border border-emerald-500/50 text-white shadow-xl backdrop-blur-md animate-fade-in flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <p className="leading-snug">{fallbackToast}</p>
          </div>
          <button
            onClick={() => setFallbackToast(null)}
            className="text-slate-400 hover:text-white shrink-0 p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content Area: Switch between Library and Reader */}
      <main className="flex-1 pb-28">
        {currentView === 'library' ? (
          <LibraryView
            books={books}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            searchQuery={searchQuery}
            onPlayBook={(book, chIdx) => {
              handlePlayBook(book, chIdx || 0);
              setCurrentView('reader');
            }}
            onOpenReader={(book) => {
              setActiveBookId(book.id);
              setActiveChapterIndex(0);
              setActiveParagraphIndex(0);
              setCurrentView('reader');
            }}
            onDeleteBook={handleDeleteBook}
            onOpenUpload={() => setIsUploadOpen(true)}
            onOpenOpenLibrary={() => setIsOpenLibraryOpen(true)}
            onLoadQuickSample={handleLoadQuickSample}
            activeBookId={activeBook?.id}
            isPlaying={isPlaying}
            readingProgress={readingProgress}
          />
        ) : activeBook && activeChapter ? (
          <ReaderView
            book={activeBook}
            currentChapterIndex={activeChapterIndex}
            currentParagraphIndex={activeParagraphIndex}
            isPlaying={isPlaying}
            onBackToLibrary={() => setCurrentView('library')}
            onSelectChapter={handleSelectChapter}
            onPlayPause={handleTogglePlay}
            onJumpToParagraph={handleJumpToParagraph}
            onAddBookmark={handleAddBookmark}
            onOpenAiInsights={(chapter) => {
              setInsightsChapter(chapter);
              setIsInsightsOpen(true);
            }}
            bookmarks={bookmarks}
          />
        ) : (
          <div className="text-center py-20">
            <p className="text-slate-400">No book currently loaded. Returning to library...</p>
            <button
              onClick={() => setCurrentView('library')}
              className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
            >
              Go to Library
            </button>
          </div>
        )}
      </main>

      {/* Persistent Bottom Audio Player Bar */}
      {activeBook && activeChapter && (
        <AudioPlayerBar
          book={activeBook}
          currentChapter={activeChapter}
          isPlaying={isPlaying}
          onPlayPause={handleTogglePlay}
          onSkipBack15={() => handleSkip15(-15)}
          onSkipForward15={() => handleSkip15(15)}
          onPrevChapter={() => handleSelectChapter(activeChapterIndex - 1)}
          onNextChapter={() => handleSelectChapter(activeChapterIndex + 1)}
          hasPrevChapter={activeChapterIndex > 0}
          hasNextChapter={activeChapterIndex < (activeBook.chapters.length - 1)}
          currentProgressSec={currentProgressSec}
          totalDurationSec={totalDurationSec}
          onSeek={handleSeek}
          playbackRate={playbackRate}
          onChangeRate={handleChangePlaybackRate}
          onOpenVoiceSettings={() => setIsVoiceSettingsOpen(true)}
          onOpenSleepTimer={() => setIsSleepTimerOpen(true)}
          onOpenAmbientSettings={() => setIsAmbientOpen(true)}
          onToggleReader={() => setCurrentView(prev => prev === 'library' ? 'reader' : 'library')}
          isReaderOpen={currentView === 'reader'}
          sleepTimer={sleepTimer}
          ambientSound={ambientSoundType}
        />
      )}

      {/* Modals */}
      <EpubUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onBookImported={handleBookImported}
      />

      <OpenLibraryModal
        isOpen={isOpenLibraryOpen}
        onClose={() => setIsOpenLibraryOpen(false)}
        onImportBook={handleBookImported}
      />

      <VoiceSettingsModal
        isOpen={isVoiceSettingsOpen}
        onClose={() => setIsVoiceSettingsOpen(false)}
        currentEngine={ttsEngine}
        currentGeminiVoice={geminiVoiceName}
        playbackRate={playbackRate}
        pitch={pitch}
        autoScroll={autoScroll}
        onSelectEngineAndVoice={handleSelectEngineAndVoice}
        onChangePlaybackRate={handleChangePlaybackRate}
        onChangePitch={handleChangePitch}
        onToggleAutoScroll={setAutoScroll}
      />

      <SleepTimerModal
        isOpen={isSleepTimerOpen}
        onClose={() => setIsSleepTimerOpen(false)}
        sleepTimer={sleepTimer}
        onSetTimer={handleSetSleepMinutes}
        onSetEndOfChapter={handleSetSleepEndOfChapter}
        onCancelTimer={handleCancelSleepTimer}
      />

      <AmbientSoundModal
        isOpen={isAmbientOpen}
        onClose={() => setIsAmbientOpen(false)}
        ambientSound={ambientSoundType}
        ambientVolume={ambientVolume}
        onSelectSound={handleSelectAmbientSound}
        onChangeVolume={handleChangeAmbientVolume}
      />

      <AiInsightsModal
        isOpen={isInsightsOpen}
        onClose={() => setIsInsightsOpen(false)}
        chapter={insightsChapter || activeChapter}
        bookTitle={activeBook?.title || 'Audiobook'}
      />

      <BookmarksModal
        isOpen={isBookmarksOpen}
        onClose={() => setIsBookmarksOpen(false)}
        bookmarks={bookmarks}
        books={books}
        onSelectBookmark={handleSelectBookmark}
        onDeleteBookmark={handleDeleteBookmark}
      />

    </div>
  );
}
