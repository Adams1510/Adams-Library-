import { TtsEngine } from '../types';

export interface SpeechCallbacks {
  onParagraphChange?: (index: number) => void;
  onChapterComplete?: () => void;
  onError?: (err: string) => void;
  onStateChange?: (isPlaying: boolean) => void;
  onProgress?: (progressSec: number, totalSec: number) => void;
  onEngineFallback?: (message: string) => void;
}

class AudiobookSpeechEngine {
  private currentAudioElement: HTMLAudioElement | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private paragraphs: string[] = [];
  private currentParagraphIndex: number = 0;
  private isPlaying: boolean = false;
  private playbackRate: number = 1.0;
  private pitch: number = 1.0;
  private engine: TtsEngine = 'browser';
  private geminiVoiceName: string = 'Kore';
  private selectedBrowserVoice: SpeechSynthesisVoice | null = null;
  private callbacks: SpeechCallbacks = {};
  private currentChapterWordCount: number = 0;
  private progressInterval: number | null = null;
  private elapsedSecondsInChapter: number = 0;

  // Caching & Rate-limit resilience
  private audioCache = new Map<string, { audioBase64: string; mimeType: string }>();
  private geminiCooldownUntil: number = 0;
  private isPrefetching: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Load voices once available
      window.speechSynthesis.onvoiceschanged = () => {
        this.getAvailableBrowserVoices();
      };
    }
  }

  public getAvailableBrowserVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    return window.speechSynthesis.getVoices();
  }

  public setCallbacks(cbs: SpeechCallbacks) {
    this.callbacks = { ...this.callbacks, ...cbs };
  }

  public setEngine(engine: TtsEngine, geminiVoice: string = 'Kore') {
    this.engine = engine;
    this.geminiVoiceName = geminiVoice;
  }

  public setPlaybackRate(rate: number) {
    this.playbackRate = Math.max(0.5, Math.min(2.5, rate));
    if (this.currentAudioElement) {
      this.currentAudioElement.playbackRate = this.playbackRate;
    }
    // If browser speech is currently speaking, restart current paragraph with new rate
    if (this.isPlaying && (this.engine === 'browser' || this.isGeminiCooldownActive())) {
      this.speakCurrentParagraph();
    }
  }

  public setPitch(pitch: number) {
    this.pitch = Math.max(0.5, Math.min(1.5, pitch));
  }

  public setBrowserVoice(voice: SpeechSynthesisVoice | null) {
    this.selectedBrowserVoice = voice;
  }

  public isGeminiCooldownActive(): boolean {
    return this.geminiCooldownUntil > Date.now();
  }

  public loadChapter(paragraphs: string[], startParagraphIndex: number = 0, wordCount: number = 0) {
    this.stop();
    this.paragraphs = paragraphs;
    this.currentParagraphIndex = Math.max(0, Math.min(paragraphs.length - 1, startParagraphIndex));
    this.currentChapterWordCount = wordCount;
    this.elapsedSecondsInChapter = 0;
    this.callbacks.onParagraphChange?.(this.currentParagraphIndex);
  }

  public async play() {
    if (this.paragraphs.length === 0) return;
    this.isPlaying = true;
    this.callbacks.onStateChange?.(true);
    this.startProgressTracking();
    await this.speakCurrentParagraph();
  }

  public pause() {
    this.isPlaying = false;
    this.callbacks.onStateChange?.(false);
    this.stopProgressTracking();

    if (this.currentAudioElement) {
      this.currentAudioElement.pause();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
    }
  }

  public resume() {
    if (this.paragraphs.length === 0) return;
    this.isPlaying = true;
    this.callbacks.onStateChange?.(true);
    this.startProgressTracking();

    if (this.engine === 'gemini' && !this.isGeminiCooldownActive() && this.currentAudioElement && !this.currentAudioElement.ended) {
      this.currentAudioElement.play().catch(() => {
        this.speakCurrentParagraph();
      });
    } else if (this.engine === 'browser' || this.isGeminiCooldownActive()) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      } else {
        this.speakCurrentParagraph();
      }
    } else {
      this.speakCurrentParagraph();
    }
  }

  public stop() {
    this.isPlaying = false;
    this.callbacks.onStateChange?.(false);
    this.stopProgressTracking();

    if (this.currentAudioElement) {
      this.currentAudioElement.pause();
      this.currentAudioElement.src = '';
      this.currentAudioElement = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public jumpToParagraph(index: number) {
    const validIndex = Math.max(0, Math.min(this.paragraphs.length - 1, index));
    this.currentParagraphIndex = validIndex;
    this.callbacks.onParagraphChange?.(validIndex);
    if (this.isPlaying) {
      this.stop();
      this.isPlaying = true;
      this.callbacks.onStateChange?.(true);
      this.startProgressTracking();
      this.speakCurrentParagraph();
    }
  }

  public skipSeconds(deltaSec: number) {
    const paragraphsToSkip = Math.round(deltaSec / 15);
    const target = Math.max(0, Math.min(this.paragraphs.length - 1, this.currentParagraphIndex + paragraphsToSkip));
    this.jumpToParagraph(target);
  }

  private startProgressTracking() {
    this.stopProgressTracking();
    const wordsTotal = this.currentChapterWordCount || Math.max(100, this.paragraphs.join(' ').split(/\s+/).length);
    const estimatedTotalDuration = (wordsTotal / 140) * 60; // 140 WPM baseline

    this.progressInterval = window.setInterval(() => {
      if (!this.isPlaying) return;
      
      const progressFraction = this.paragraphs.length > 0 ? (this.currentParagraphIndex + 0.5) / this.paragraphs.length : 0;
      const currentSec = progressFraction * estimatedTotalDuration;
      this.callbacks.onProgress?.(currentSec, estimatedTotalDuration);
    }, 500);
  }

  private stopProgressTracking() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  private async speakCurrentParagraph() {
    if (!this.isPlaying || this.currentParagraphIndex >= this.paragraphs.length) {
      if (this.currentParagraphIndex >= this.paragraphs.length) {
        this.stop();
        this.callbacks.onChapterComplete?.();
      }
      return;
    }

    const textToSpeak = this.paragraphs[this.currentParagraphIndex];
    if (!textToSpeak || !textToSpeak.trim()) {
      this.moveToNextParagraph();
      return;
    }

    this.callbacks.onParagraphChange?.(this.currentParagraphIndex);

    // If Gemini is selected and not in cooldown, attempt Gemini TTS
    if (this.engine === 'gemini' && !this.isGeminiCooldownActive()) {
      try {
        await this.speakWithGeminiTTS(textToSpeak);
      } catch (err: any) {
        console.warn('[TTS] Gemini fallback to browser speech:', err?.message || err);
        this.geminiCooldownUntil = Date.now() + 45000;
        this.callbacks.onEngineFallback?.('Gemini rate limit reached. Using instant Device Speech.');
        this.speakWithBrowserSpeech(textToSpeak);
      }
    } else {
      this.speakWithBrowserSpeech(textToSpeak);
    }

    // Prefetch next paragraph in the background
    this.prefetchNextParagraph();
  }

  private async prefetchNextParagraph() {
    if (this.engine !== 'gemini' || this.isGeminiCooldownActive() || this.isPrefetching) return;
    const nextIdx = this.currentParagraphIndex + 1;
    if (nextIdx >= this.paragraphs.length) return;

    const nextText = this.paragraphs[nextIdx]?.trim();
    if (!nextText) return;

    const cacheKey = `${this.geminiVoiceName}:${nextText.substring(0, 1000)}`;
    if (this.audioCache.has(cacheKey)) return;

    this.isPrefetching = true;
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: nextText,
          voiceName: this.geminiVoiceName,
          rate: this.playbackRate,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          this.audioCache.set(cacheKey, {
            audioBase64: data.audioBase64,
            mimeType: data.mimeType || 'audio/mp3',
          });
        }
      }
    } catch {}
    this.isPrefetching = false;
  }

  private async speakWithGeminiTTS(text: string): Promise<void> {
    const cleanText = text.substring(0, 1000).trim();
    const cacheKey = `${this.geminiVoiceName}:${cleanText}`;

    let audioData = this.audioCache.get(cacheKey);

    if (!audioData) {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          voiceName: this.geminiVoiceName,
          rate: this.playbackRate,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (data.rateLimited || data.useFallback || !data.audioBase64) {
        this.geminiCooldownUntil = Date.now() + 45000;
        this.callbacks.onEngineFallback?.(data.error || 'Gemini quota reached. Seamlessly playing with Device Speech.');
        throw new Error(data.error || 'Gemini TTS unavailable; switching to fallback.');
      }

      audioData = {
        audioBase64: data.audioBase64,
        mimeType: data.mimeType || 'audio/mp3',
      };
      this.audioCache.set(cacheKey, audioData);
    }

    const mime = audioData.mimeType || 'audio/mp3';
    const audioUrl = `data:${mime};base64,${audioData.audioBase64}`;

    if (this.currentAudioElement) {
      this.currentAudioElement.pause();
      this.currentAudioElement.src = '';
    }

    const audio = new Audio(audioUrl);
    this.currentAudioElement = audio;
    audio.playbackRate = this.playbackRate;

    return new Promise((resolve, reject) => {
      audio.onended = () => {
        if (this.isPlaying) {
          this.moveToNextParagraph();
        }
        resolve();
      };

      audio.onerror = () => {
        reject(new Error('Audio playback failed'));
      };

      audio.play().catch(reject);
    });
  }

  private speakWithBrowserSpeech(text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.callbacks.onError?.('Speech synthesis is not supported on this browser.');
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance = utterance;
    utterance.rate = this.playbackRate;
    utterance.pitch = this.pitch;

    if (this.selectedBrowserVoice) {
      utterance.voice = this.selectedBrowserVoice;
    } else {
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => (v.name.includes('Natural') || v.name.includes('Enhanced') || v.name.includes('Google') || v.name.includes('Premium')) && v.lang.startsWith('en')) ||
        voices.find(v => v.lang.startsWith('en')) ||
        voices[0];
      if (preferred) utterance.voice = preferred;
    }

    utterance.onend = () => {
      if (this.isPlaying) {
        this.moveToNextParagraph();
      }
    };

    utterance.onerror = (event) => {
      if (event.error === 'canceled' || event.error === 'interrupted') return;
      console.warn('[SpeechSynthesis] Event error:', event.error);
      if (this.isPlaying) {
        this.moveToNextParagraph();
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  private moveToNextParagraph() {
    if (this.currentParagraphIndex + 1 < this.paragraphs.length) {
      this.currentParagraphIndex++;
      this.speakCurrentParagraph();
    } else {
      this.stop();
      this.callbacks.onChapterComplete?.();
    }
  }

  public getCurrentState() {
    return {
      isPlaying: this.isPlaying,
      currentParagraphIndex: this.currentParagraphIndex,
      playbackRate: this.playbackRate,
      engine: this.engine,
      geminiVoiceName: this.geminiVoiceName,
      isCooldownActive: this.isGeminiCooldownActive(),
    };
  }
}

export const speechEngine = new AudiobookSpeechEngine();
