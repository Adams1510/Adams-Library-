export type BookCategory = 'Islamic' | 'Psychological' | 'Contemporary' | 'Custom';

export interface Chapter {
  id: string;
  title: string;
  order: number;
  content: string; // Plain text or clean HTML
  paragraphs: string[];
  wordCount: number;
  estimatedDurationSec: number; // calculated at ~140 words per minute
}

export interface Book {
  id: string;
  title: string;
  author: string;
  category: BookCategory;
  description: string;
  coverImage?: string;
  coverTheme?: string;
  chapters: Chapter[];
  chapterCount?: number;
  totalWords: number;
  totalDurationSec: number;
  uploadedAt: string;
  isCustomUpload?: boolean;
  tags?: string[];
  rating?: number;
  sourceFilename?: string;
}

export interface Bookmark {
  id: string;
  bookId: string;
  chapterId: string;
  chapterTitle: string;
  paragraphIndex: number;
  snippet: string;
  createdAt: string;
  timestamp?: string;
  note?: string;
}

export interface ReadingProgress {
  bookId: string;
  currentChapterId: string;
  currentParagraphIndex: number;
  playbackPositionSec: number;
  completedChapterIds: string[];
  percentage: number;
  lastListenedAt: string;
}

export type TtsEngine = 'gemini' | 'google-cloud' | 'browser';

export interface VoiceOption {
  id: string;
  name: string;
  engine: TtsEngine;
  geminiVoiceName?: string;
  browserVoiceURI?: string;
  gender: 'Female' | 'Male' | 'Neutral';
  description: string;
  accent?: string;
}

export interface PlayerSettings {
  playbackRate: number;
  voiceId: string;
  ttsEngine: TtsEngine;
  pitch: number;
  autoScroll: boolean;
  sentenceHighlighting: boolean;
  ambientSound: 'none' | 'rain' | 'library' | 'stream' | 'waves';
  ambientVolume: number;
}

export interface SleepTimerState {
  active: boolean;
  targetMinutes: number;
  endOfChapter: boolean;
  remainingSeconds: number;
}
