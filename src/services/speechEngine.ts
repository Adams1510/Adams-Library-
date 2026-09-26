import type { TtsEngine } from '../types.ts';
import { audioBlob } from '../utils/audio.ts';

export interface SpeechCallbacks {
  onParagraphChange?: (index: number) => void;
  onChapterComplete?: () => void;
  onError?: (err: string) => void;
  onStateChange?: (isPlaying: boolean) => void;
  onProgress?: (progressSec: number, totalSec: number) => void;
  onEngineFallback?: (message: string) => void;
}

export class AudiobookSpeechEngine {
  private audio: HTMLAudioElement | null = null;
  private audioUrl: string | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private paragraphs: string[] = [];
  private currentParagraphIndex = 0;
  private isPlaying = false;
  private playbackRate = 1;
  private pitch = 1;
  private engine: TtsEngine = 'browser';
  private geminiVoiceName = 'Kore';
  private selectedBrowserVoice: SpeechSynthesisVoice | null = null;
  private callbacks: SpeechCallbacks = {};
  private progressInterval: ReturnType<typeof setInterval> | null = null;
  private offsets: number[] = [];
  private totalSeconds = 0;
  private paragraphSeconds = 0;
  private generation = 0;
  private request: AbortController | null = null;
  private geminiCooldownUntil = 0;
  private cache = new Map<string, Blob>();
  private cacheBytes = 0;

  getAvailableBrowserVoices(): SpeechSynthesisVoice[] {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : [];
  }
  setCallbacks(callbacks: SpeechCallbacks) { this.callbacks = callbacks; }
  setEngine(engine: TtsEngine, voice = 'Kore') {
    if (engine === this.engine && voice === this.geminiVoiceName) return;
    this.engine = engine; this.geminiVoiceName = voice; this.geminiCooldownUntil = 0;
    if (this.isPlaying) void this.speak();
  }
  setPlaybackRate(rate: number) {
    const next = Math.max(0.5, Math.min(2.5, rate));
    if (next === this.playbackRate) return;
    this.playbackRate = next;
    if (this.audio) this.audio.playbackRate = next;
    else if (this.isPlaying && this.utterance) void this.speak();
  }
  setPitch(pitch: number) { this.pitch = Math.max(0.5, Math.min(1.5, pitch)); }
  setBrowserVoice(voice: SpeechSynthesisVoice | null) { this.selectedBrowserVoice = voice; }
  isGeminiCooldownActive() { return this.geminiCooldownUntil > Date.now(); }
  loadChapter(paragraphs: string[], start = 0, _wordCount = 0) {
    this.stop(); this.paragraphs = paragraphs;
    this.currentParagraphIndex = Math.max(0, Math.min(paragraphs.length - 1, start));
    this.totalSeconds = 0;
    this.offsets = paragraphs.map(text => {
      const offset = this.totalSeconds;
      this.totalSeconds += Math.max(1, text.trim().split(/\s+/).length) * 60 / 140;
      return offset;
    });
    this.paragraphSeconds = 0; this.notifyProgress();
    this.callbacks.onParagraphChange?.(this.currentParagraphIndex);
  }
  async play() { if (this.paragraphs.length) { this.setPlaying(true); await this.speak(); } }
  pause() {
    this.setPlaying(false); this.audio?.pause();
    if (this.utterance) window.speechSynthesis.pause();
    // Ignore late synthesis responses after Pause.
    if (this.request) { this.generation++; this.request.abort(); this.request = null; }
  }
  resume() {
    if (!this.paragraphs.length || this.isPlaying) return;
    this.setPlaying(true);
    if (this.audio && !this.audio.ended) void this.audio.play().catch(() => this.fail('Playback was blocked. Please press Listen again.'));
    else if (this.utterance && window.speechSynthesis.paused) window.speechSynthesis.resume();
    else void this.speak();
  }
  stop() { this.setPlaying(false); this.cancelOutput(); }
  private cancelOutput() {
    this.generation++; this.request?.abort(); this.request = null;
    if (this.audio) {
      this.audio.onended = null; this.audio.onerror = null;
      this.audio.pause(); this.audio.removeAttribute('src'); this.audio = null;
    }
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
    this.audioUrl = null;
    if (this.utterance) { this.utterance.onend = null; this.utterance.onerror = null; }
    this.utterance = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }
  jumpToParagraph(index: number) {
    if (!this.paragraphs.length) return;
    this.cancelOutput();
    this.currentParagraphIndex = Math.max(0, Math.min(this.paragraphs.length - 1, index));
    this.paragraphSeconds = 0;
    this.callbacks.onParagraphChange?.(this.currentParagraphIndex); this.notifyProgress();
    if (this.isPlaying) void this.speak();
  }
  skipSeconds(delta: number) {
    const target = Math.max(0, (this.offsets[this.currentParagraphIndex] || 0) + this.paragraphSeconds + delta);
    this.jumpToParagraph(Math.max(0, this.offsets.findIndex((offset, i) => target >= offset && target < (this.offsets[i + 1] ?? Infinity))));
  }
  private setPlaying(playing: boolean) {
    this.isPlaying = playing; this.callbacks.onStateChange?.(playing);
    if (this.progressInterval) clearInterval(this.progressInterval);
    this.progressInterval = null;
    if (playing) this.progressInterval = setInterval(() => {
      if (this.audio) this.paragraphSeconds = this.audio.currentTime;
      else if (this.utterance) this.paragraphSeconds += 0.5 * this.playbackRate;
      this.notifyProgress();
    }, 500);
  }
  private notifyProgress() {
    const start = this.offsets[this.currentParagraphIndex] || 0;
    const end = this.offsets[this.currentParagraphIndex + 1] ?? this.totalSeconds;
    this.callbacks.onProgress?.(Math.min(end, start + this.paragraphSeconds), this.totalSeconds);
  }
  private fail(message: string) { this.stop(); this.callbacks.onError?.(message); }
  private async speak() {
    if (!this.isPlaying) return;
    this.cancelOutput();
    const version = this.generation, text = this.paragraphs[this.currentParagraphIndex];
    if (!text?.trim()) { this.next(); return; }
    this.paragraphSeconds = 0; this.callbacks.onParagraphChange?.(this.currentParagraphIndex);
    if (this.engine === 'gemini' && !this.isGeminiCooldownActive()) {
      try {
        const key = `${this.geminiVoiceName}:${text}`;
        let blob = this.cache.get(key);
        if (!blob) {
          const controller = new AbortController(); this.request = controller;
          const timeout = setTimeout(() => controller.abort(), 45000);
          let data: any;
          try {
            const res = await fetch('/api/tts', {method: 'POST', headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({text, voiceName: this.geminiVoiceName}), signal: controller.signal});
            data = await res.json();
            if (!res.ok || !data.audioBase64) throw new Error(data.message || data.error || 'AI voice is unavailable.');
          } finally { clearTimeout(timeout); if (this.request === controller) this.request = null; }
          if (version !== this.generation || !this.isPlaying) return;
          blob = audioBlob(data.audioBase64, data.mimeType || 'audio/L16;rate=24000');
          while (this.cacheBytes + blob.size > 16 * 1024 * 1024 && this.cache.size) {
            const first = this.cache.keys().next().value!;
            this.cacheBytes -= this.cache.get(first)!.size; this.cache.delete(first);
          }
          if (blob.size <= 16 * 1024 * 1024) { this.cache.set(key, blob); this.cacheBytes += blob.size; }
        }
        if (version !== this.generation || !this.isPlaying) return;
        this.audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(this.audioUrl); this.audio = audio; audio.playbackRate = this.playbackRate;
        audio.onended = () => { if (version === this.generation && this.isPlaying) this.next(); };
        audio.onerror = () => { if (version === this.generation) this.fail('The AI audio could not be played. Try the device voice.'); };
        await audio.play(); return;
      } catch (error) {
        if (version !== this.generation || !this.isPlaying) return;
        this.geminiCooldownUntil = Date.now() + 60000;
        this.callbacks.onEngineFallback?.(`${error instanceof Error ? error.message : 'AI voice is unavailable.'} Using the device voice.`);
      }
    }
    if (!('speechSynthesis' in window)) { this.fail('This browser does not support device narration.'); return; }
    const utterance = new SpeechSynthesisUtterance(text); this.utterance = utterance;
    utterance.rate = this.playbackRate; utterance.pitch = this.pitch;
    const voices = this.getAvailableBrowserVoices(), voice = this.selectedBrowserVoice || voices.find(v => v.default) || voices[0];
    if (voice) utterance.voice = voice;
    utterance.onend = () => { if (version === this.generation && this.isPlaying) this.next(); };
    utterance.onerror = event => {
      if (version === this.generation && !['canceled', 'interrupted'].includes(event.error)) this.fail('Device narration failed. Try another voice or press Listen again.');
    };
    window.speechSynthesis.speak(utterance);
  }
  private next() {
    if (this.currentParagraphIndex + 1 < this.paragraphs.length) { this.currentParagraphIndex++; void this.speak(); }
    else { this.stop(); this.callbacks.onChapterComplete?.(); }
  }
  getCurrentState() {
    return {isPlaying: this.isPlaying, currentParagraphIndex: this.currentParagraphIndex, playbackRate: this.playbackRate,
      engine: this.engine, geminiVoiceName: this.geminiVoiceName, isCooldownActive: this.isGeminiCooldownActive(), hasChapter: this.paragraphs.length > 0};
  }
}
export const speechEngine = new AudiobookSpeechEngine();
