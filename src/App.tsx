import { libraryRequest, getBook } from './services/library';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Book, Chapter, BookCategory, Bookmark, SleepTimerState, TtsEngine } from './types';
import { INITIAL_BOOKS } from './data/sampleBooks';
import { speechEngine, type WordPosition } from './services/speechEngine';
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

  const [books, setBooks] = useState<Book[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [readingProgress, setReadingProgress] = useState<Record<string, number>>({});
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [loadedBook, setLoadedBook] = useState<Book | null>(null);
  const positions = useRef<Record<string, {chapterIndex: number; paragraphIndex: number; percentage: number}>>({});
  const selection = useRef<{book: Book; chapterIndex: number} | null>(null);
  const openGeneration = useRef(0);
  const progressWrites = useRef(Promise.resolve());
  const savePosition = (bookId: string, chapterIndex: number, paragraphIndex: number, percentage: number) => {
    const value = {chapterIndex, paragraphIndex, percentage};
    if (JSON.stringify(positions.current[bookId]) === JSON.stringify(value)) return;
    positions.current[bookId] = value;
    setReadingProgress(prev => ({...prev, [bookId]: percentage}));
    progressWrites.current = progressWrites.current.then(() => libraryRequest('/api/progress/' + encodeURIComponent(bookId), 'PUT', value)).then(() => {}).catch(() => setLibraryError('Your latest reading position could not be saved.'));
  };
  const loadLibrary = async () => {
    setLibraryLoading(true); setLibraryError(null);
    try {
      const [catalog, state] = await Promise.all([libraryRequest('/api/books'), libraryRequest('/api/reading-state')]);
      setBooks(catalog.books); setBookmarks(state.bookmarks);
      positions.current = state.positions;
      setReadingProgress(Object.fromEntries(Object.entries(state.positions).map(([id, value]: [string, any]) => [id, value.percentage])));
    } catch (error: any) { setLibraryError(error.message); }
    finally { setLibraryLoading(false); }
  };
  useEffect(() => { void loadLibrary(); return () => { speechEngine.stop(); ambientSound.stop(); }; }, []);

  // --- App Views & Filtering ---
  const [currentView, setCurrentView] = useState<'library' | 'reader'>('library');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // --- Active Playback State ---
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(0);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number>(0);
  const [wordPosition, setWordPosition] = useState<WordPosition>({paragraphIndex: 0, wordIndex: -1, sentenceIndex: -1, word: '', timing: 'idle'});
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentProgressSec, setCurrentProgressSec] = useState<number>(0);
  const [totalDurationSec, setTotalDurationSec] = useState<number>(100);

  // --- Speech & Audio Settings ---
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(1.0);
  const [ttsEngine, setTtsEngine] = useState<TtsEngine>('gemini');
  const [geminiVoiceName, setGeminiVoiceName] = useState<string>('Kore');
  const [languageCode, setLanguageCode] = useState<string>('en-US');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/tts/voices?languageCode=en-US', {signal: controller.signal}).then(response => response.json()).then(data => {
      if (!data.geminiConfigured && data.cloudConfigured && data.voices?.length) {
        setTtsEngine('google-cloud'); setGeminiVoiceName(data.voices[0].voiceId);
      }
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  const [geminiStyle, setGeminiStyle] = useState<string>(() => localStorage.getItem('adams-gemini-style') || 'Warm, clear audiobook narration');
  const [browserVoiceURI, setBrowserVoiceURI] = useState<string>(() => localStorage.getItem('adams-browser-voice') || '');
  const [arabicVoiceURI, setArabicVoiceURI] = useState(() => localStorage.getItem('adams-arabic-voice') || '');
  const [bilingual, setBilingual] = useState(() => localStorage.getItem('adams-bilingual') !== 'false');
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
  const activeBook = loadedBook?.id === activeBookId ? loadedBook : null;
  const activeChapter = activeBook?.chapters[activeChapterIndex] || (activeBook?.chapters[0] || null);

  // Chapter completion handler
  const handleChapterComplete = useCallback(() => {
    const activeBook = selection.current?.book;
    const activeChapterIndex = selection.current?.chapterIndex ?? 0;
    if (activeBook) {
      const lastParagraph = Math.max(0, activeBook.chapters[activeChapterIndex].paragraphs.length - 1);
      savePosition(activeBook.id, activeChapterIndex, lastParagraph, Math.round((activeChapterIndex + 1) / activeBook.chapters.length * 100));
    }
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
      selection.current = {book: activeBook, chapterIndex: nextIdx};
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
      onWordChange: setWordPosition,
      onParagraphChange: (pIdx) => {
        setActiveParagraphIndex(pIdx);
        const context = selection.current;
        if (context) {
          const chapter = context.book.chapters[context.chapterIndex];
          const fraction = (context.chapterIndex + pIdx / Math.max(1, chapter.paragraphs.length)) / context.book.chapters.length;
          savePosition(context.book.id, context.chapterIndex, pIdx, Math.floor(fraction * 100));
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
        setFallbackToast(err);
      },
    });

    speechEngine.setEngine(ttsEngine, geminiVoiceName);
    speechEngine.setGeminiStyle(geminiStyle);
    speechEngine.setLanguageCode(languageCode);
    const availableVoice = speechEngine.getAvailableBrowserVoices().find((voice) => voice.voiceURI === browserVoiceURI) || null;
    speechEngine.setBrowserVoice(availableVoice);
    speechEngine.setArabicVoiceURI(arabicVoiceURI);
    speechEngine.setBilingual(bilingual);
    speechEngine.setPlaybackRate(playbackRate);
    speechEngine.setPitch(pitch);
  }, [activeBookId, activeChapterIndex, ttsEngine, geminiVoiceName, geminiStyle, languageCode, browserVoiceURI, arabicVoiceURI, bilingual, playbackRate, pitch, handleChapterComplete]);

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
  const handlePlayBook = async (book: Book, chapterIndex?: number, play = true, paragraphIndex?: number) => {
    const generation = ++openGeneration.current;
    speechEngine.stop();
    setLibraryError(null);
    try {
      const full = await getBook(book);
      if (generation !== openGeneration.current) return;
      const saved = positions.current[book.id];
      const index = Math.max(0, Math.min(full.chapters.length - 1, chapterIndex ?? saved?.chapterIndex ?? 0));
      const paragraph = Math.max(0, Math.min(full.chapters[index].paragraphs.length - 1, paragraphIndex ?? (chapterIndex === undefined ? saved?.paragraphIndex ?? 0 : 0)));
      selection.current = {book: full, chapterIndex: index};
      setLoadedBook(full); setActiveBookId(full.id); setActiveChapterIndex(index); setActiveParagraphIndex(paragraph);
      speechEngine.loadChapter(full.chapters[index].paragraphs, paragraph, full.chapters[index].wordCount);
      setCurrentView('reader');
      if (play) await speechEngine.play();
    } catch (error: any) { setLibraryError(error.message); }
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      speechEngine.pause();
    } else {
      if (activeChapter) {
        if (!speechEngine.getCurrentState().hasChapter) {
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
    selection.current = {book: activeBook, chapterIndex: validIdx};
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
    if (!speechEngine.getCurrentState().isPlaying) void speechEngine.play();
  };

  const handleSeek = (fraction: number) => {
    if (!activeChapter) return;
    speechEngine.seekToFraction(fraction);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes((e.target as HTMLElement).tagName) || (e.target as HTMLElement).isContentEditable) {
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
  const handleAddBookmark = async (chapterId: string, chapterTitle: string, paragraphIndex: number, snippet: string) => {
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
    try {
      const saved = await libraryRequest('/api/bookmarks', 'POST', newBm);
      setBookmarks(prev => [saved.bookmark, ...prev]);
    } catch (error: any) { setLibraryError(error.message); }
  };

  const handleDeleteBookmark = async (id: string) => {
    try { await libraryRequest('/api/bookmarks/' + encodeURIComponent(id), 'DELETE'); setBookmarks(prev => prev.filter(b => b.id !== id)); } catch (error: any) { setLibraryError(error.message); }
  };

  const handleSelectBookmark = async (bookId: string, chapterId: string, paragraphIndex: number) => {
    const target = books.find(b => b.id === bookId);
    if (!target) return;
    try {
      const full = await getBook(target);
      await handlePlayBook(full, Math.max(0, full.chapters.findIndex(c => c.id === chapterId)), true, paragraphIndex);
    } catch (error: any) { setLibraryError(error.message); }
  };

  const handleBookImported = async (newBook: Book) => {
    const result = await libraryRequest('/api/books', 'POST', newBook);
    setBooks(prev => [result.book, ...prev.filter(b => b.id !== newBook.id)]);
  };
  const handleDeleteBook = async (bookId: string) => {
    try {
      await libraryRequest('/api/books/' + encodeURIComponent(bookId), 'DELETE');
      setBooks(prev => prev.filter(b => b.id !== bookId));
      setBookmarks(prev => prev.filter(b => b.bookId !== bookId));
      delete positions.current[bookId];
      if (activeBookId === bookId) {
        openGeneration.current++; speechEngine.stop(); selection.current = null;
        setLoadedBook(null); setActiveBookId(null); setCurrentView('library');
      }
    } catch (error: any) { setLibraryError(error.message); }
  };

  // --- Quick Test ePub Generator (for immediate audio testing if desired) ---
  const handleLoadQuickSample = async () => {
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
      author: 'Audiobook Studio demo text',
      category: 'Islamic',
      description: 'An introductory discourse on emotional equanimity, cognitive contemplation, and inner peace.',
      totalWords: wordCount,
      totalDurationSec: Math.max(20, Math.round((wordCount / 140) * 60)),
      uploadedAt: new Date().toISOString(),
      isCustomUpload: true,
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

    try { await handleBookImported(quickSampleBook); await handlePlayBook(quickSampleBook, 0); } catch (error: any) { setLibraryError(error.message); }
  };

  // --- Voice & Speech Settings ---
  const handleSelectEngineAndVoice = (engine: TtsEngine, geminiVoice: string) => {
    setTtsEngine(engine);
    setGeminiVoiceName(geminiVoice);
    speechEngine.setEngine(engine, geminiVoice);
  };
  const handleChangeGeminiStyle = (style: string) => {
    setGeminiStyle(style); localStorage.setItem('adams-gemini-style', style); speechEngine.setGeminiStyle(style);
  };
  const handleSelectBrowserVoice = (voiceURI: string) => {
    setBrowserVoiceURI(voiceURI); localStorage.setItem('adams-browser-voice', voiceURI);
    speechEngine.setBrowserVoice(speechEngine.getAvailableBrowserVoices().find((voice) => voice.voiceURI === voiceURI) || null);
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
        onOpenUpload={() => { if (!libraryLoading) setIsUploadOpen(true); }}
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

      {libraryLoading && <p role="status" className="px-6 py-3 text-sm">Loading your library…</p>}
      {libraryError && <div role="alert" className="px-6 py-3 text-sm bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-200">{libraryError} <button onClick={loadLibrary} className="underline ml-2">Retry loading</button></div>}
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
      <main className={`flex-1 ${activeBook ? 'has-narration-player' : ''}`}>
        {currentView === 'library' ? (
          <LibraryView
            books={books}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            searchQuery={searchQuery}
            onPlayBook={(book) => { void handlePlayBook(book); }}
            onOpenReader={(book) => { void handlePlayBook(book, undefined, false); }}
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
            wordPosition={wordPosition}
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
          currentParagraphIndex={activeParagraphIndex}
          wordPosition={wordPosition}
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
        languageCode={languageCode}
        onChangeLanguageCode={setLanguageCode}
        geminiStyle={geminiStyle}
        browserVoiceURI={browserVoiceURI}
        arabicVoiceURI={arabicVoiceURI}
        bilingual={bilingual}
        onChangeArabicVoice={uri => {setArabicVoiceURI(uri); localStorage.setItem('adams-arabic-voice', uri); speechEngine.setArabicVoiceURI(uri);}}
        onChangeBilingual={enabled => {setBilingual(enabled); localStorage.setItem('adams-bilingual', String(enabled)); speechEngine.setBilingual(enabled);}}
        playbackRate={playbackRate}
        pitch={pitch}
        autoScroll={autoScroll}
        onSelectEngineAndVoice={handleSelectEngineAndVoice}
        onChangeGeminiStyle={handleChangeGeminiStyle}
        onSelectBrowserVoice={handleSelectBrowserVoice}
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
