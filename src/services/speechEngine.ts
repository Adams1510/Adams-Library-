import type { TtsEngine } from '../types.ts';
import { audioBlob } from '../utils/audio.ts';
import {narrationText, bilingualRuns, wordAtCharacter, estimatedWord, validTimepoints, type Word, type WordTimepoint} from '../utils/narrationText.ts';

export type WordPosition = {paragraphIndex: number; wordIndex: number; sentenceIndex: number; word: string; timing: 'boundary' | 'timestamp' | 'estimated' | 'idle'};

export interface SpeechCallbacks {
  onParagraphChange?: (index: number) => void;
  onChapterComplete?: () => void;
  onError?: (err: string) => void;
  onStateChange?: (isPlaying: boolean) => void;
  onProgress?: (progressSec: number, totalSec: number) => void;
  onEngineFallback?: (message: string) => void;
  onWordChange?: (position: WordPosition) => void;
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
  private engine: TtsEngine = 'gemini';
  private geminiVoiceName = 'Kore';
  private geminiStyle = 'Warm, clear audiobook narration';
  private languageCode = 'en-US';
  private selectedBrowserVoice: SpeechSynthesisVoice | null = null;
  private arabicVoiceURI = '';
  private bilingual = true;
  private runEndCharacter = Infinity;
  private runStartCharacter = 0;
  private callbacks: SpeechCallbacks = {};
  private progressInterval: ReturnType<typeof setInterval> | null = null;
  private offsets: number[] = [];
  private totalSeconds = 0;
  private paragraphSeconds = 0;
  private generation = 0;
  private request: AbortController | null = null;
  private geminiCooldownUntil = 0;
  private cache = new Map<string, {blob: Blob; points: WordTimepoint[]}>();
  private cacheBytes = 0;
  private words: Word[] = [];
  private points: WordTimepoint[] = [];
  private wordIndex = -1;
  private timing: WordPosition['timing'] = 'idle';
  private hasWordBoundaries = false;
  private outputStarted = false;
  private startCharacter = 0;
  private pendingSeconds = 0;
  private pendingCharacter: number | null = null;
  private lastWordParagraph = -1;
  private durations: number[] = [];
  private lastTick = 0;
  private pulseAt = 0;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private frequencies = new Uint8Array(128);

  private prepareAudioContext() {
    try {
      const Context = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Context) return;
      if (!this.context) {this.context = new Context(); this.analyser = this.context!.createAnalyser(); this.analyser.fftSize = 256; this.analyser.smoothingTimeConstant = 0.8; this.analyser.connect(this.context!.destination);}
      if (this.context!.state === 'suspended') void this.context!.resume().catch(() => {});
    } catch {/* Analysis must never block narration. */}
  }
  getVisualization() {
    if (!this.isPlaying || !this.outputStarted) return {source: 'idle' as const, energy: 0, frequencies: null};
    if (this.audio && this.analyser && this.source && this.context?.state === 'running') {
      this.analyser.getByteFrequencyData(this.frequencies);
      return {source: 'audio' as const, energy: this.frequencies.reduce((a, b) => a + b, 0) / (128 * 255), frequencies: this.frequencies};
    }
    return {source: 'speech' as const, energy: Math.max(0, 1 - (performance.now() - this.pulseAt) / 420), frequencies: null};
  }
  private notifyWord(index: number, timing: WordPosition['timing']) {
    if (this.wordIndex === index && this.timing === timing && this.lastWordParagraph === this.currentParagraphIndex) return;
    this.lastWordParagraph = this.currentParagraphIndex;
    this.wordIndex = index; this.timing = timing;
    if (index >= 0) this.pulseAt = performance.now();
    this.callbacks.onWordChange?.({paragraphIndex: this.currentParagraphIndex, wordIndex: index, sentenceIndex: this.words[index]?.sentenceIndex ?? -1, word: this.words[index]?.text || '', timing});
  }
  private rebuildOffsets() {
    this.totalSeconds = 0;
    this.offsets = this.durations.map(duration => {const start = this.totalSeconds; this.totalSeconds += duration; return start;});
  }

  getAvailableBrowserVoices(): SpeechSynthesisVoice[] {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : [];
  }
  setCallbacks(callbacks: SpeechCallbacks) { this.callbacks = callbacks; }
  setEngine(engine: TtsEngine, voice = 'Kore') {
    if (engine === this.engine && voice === this.geminiVoiceName) return;
    this.engine = engine; this.geminiVoiceName = voice; this.geminiCooldownUntil = 0;
    if (this.isPlaying) void this.speak();
  }
  setGeminiStyle(style: string) {
    const next = style.slice(0, 160);
    if (next === this.geminiStyle) return;
    this.geminiStyle = next;
    this.cache.clear(); this.cacheBytes = 0;
    if (this.isPlaying && this.engine === 'gemini') void this.speak();
  }
  setLanguageCode(languageCode: string) {
    if (this.languageCode === languageCode) return;
    this.languageCode = languageCode; this.geminiCooldownUntil = 0;
    if (this.isPlaying) void this.speak();
  }
  setPlaybackRate(rate: number) {
    const next = Math.max(0.5, Math.min(2.5, rate));
    if (next === this.playbackRate) return;
    this.playbackRate = next;
    if (this.audio) this.audio.playbackRate = next;
    else if (this.utterance) {
      const start = this.words[Math.max(0, this.wordIndex)]?.start || 0;
      this.pendingCharacter = start;
      this.pendingSeconds = start / Math.max(1, this.paragraphs[this.currentParagraphIndex].length) * this.durations[this.currentParagraphIndex];
      this.cancelOutput(); if (this.isPlaying) void this.speak();
    }
  }
  setPitch(pitch: number) { this.pitch = Math.max(0.5, Math.min(1.5, pitch)); }
  setBrowserVoice(voice: SpeechSynthesisVoice | null) { this.selectedBrowserVoice = voice; }
  setArabicVoiceURI(uri: string) {this.arabicVoiceURI = uri;}
  setBilingual(enabled: boolean) {this.bilingual = enabled;}
  isGeminiCooldownActive() { return this.geminiCooldownUntil > Date.now(); }
  loadChapter(paragraphs: string[], start = 0, _wordCount = 0) {
    this.stop(); this.paragraphs = paragraphs;
    this.currentParagraphIndex = Math.max(0, Math.min(paragraphs.length - 1, start));
    this.durations = paragraphs.map(text => Math.max(1, narrationText(text).words.length) * 60 / 140);
    this.rebuildOffsets();
    this.paragraphSeconds = 0; this.pendingSeconds = 0; this.pendingCharacter = null; this.words = narrationText(paragraphs[this.currentParagraphIndex] || '').words;
    this.notifyWord(-1, 'idle'); this.notifyProgress();
    this.callbacks.onParagraphChange?.(this.currentParagraphIndex);
  }
  async play() { if (this.paragraphs.length) { this.prepareAudioContext(); this.setPlaying(true); await this.speak(); } }
  pause() {
    this.setPlaying(false); this.audio?.pause();
    if (this.utterance) window.speechSynthesis.pause();
    // Ignore late synthesis responses after Pause.
    if (this.request) { this.pendingSeconds = this.paragraphSeconds; this.generation++; this.request.abort(); this.request = null; }
  }
  resume() {
    if (!this.paragraphs.length || this.isPlaying) return;
    this.prepareAudioContext();
    this.setPlaying(true);
    if (this.audio && !this.audio.ended) void this.audio.play().catch(() => this.fail('Playback was blocked. Please press Listen again.'));
    else if (this.utterance && window.speechSynthesis.paused) window.speechSynthesis.resume();
    else void this.speak();
  }
  stop() { this.setPlaying(false); this.cancelOutput(); this.notifyWord(-1, 'idle'); }
  private cancelOutput() {
    this.generation++; this.request?.abort(); this.request = null;
    this.source?.disconnect(); this.source = null; this.outputStarted = false;
    if (this.audio) {
      this.audio.onended = null; this.audio.onerror = null; this.audio.onloadedmetadata = null; this.audio.onplaying = null;
      this.audio.pause(); this.audio.removeAttribute('src'); this.audio = null;
    }
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
    this.audioUrl = null;
    if (this.utterance) { this.utterance.onend = null; this.utterance.onerror = null; this.utterance.onboundary = null; this.utterance.onstart = null; }
    this.utterance = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }
  jumpToParagraph(index: number) {
    if (!this.paragraphs.length) return;
    this.cancelOutput();
    this.currentParagraphIndex = Math.max(0, Math.min(this.paragraphs.length - 1, index));
    this.paragraphSeconds = 0; this.pendingSeconds = 0; this.pendingCharacter = null; this.words = narrationText(this.paragraphs[this.currentParagraphIndex]).words; this.notifyWord(-1, 'idle');
    this.callbacks.onParagraphChange?.(this.currentParagraphIndex); this.notifyProgress();
    if (this.isPlaying) void this.speak();
  }
  skipSeconds(delta: number) {
    this.seekSeconds((this.offsets[this.currentParagraphIndex] || 0) + this.paragraphSeconds + delta);
  }
  seekToFraction(fraction: number) {this.seekSeconds(Math.max(0, Math.min(1, fraction)) * this.totalSeconds);}
  private seekSeconds(seconds: number) {
    if (!this.paragraphs.length) return;
    const target = Math.max(0, Math.min(Math.max(0, this.totalSeconds - 0.01), seconds));
    const index = Math.max(0, this.offsets.findIndex((offset, i) => target >= offset && target < (this.offsets[i + 1] ?? Infinity)));
    const within = target - this.offsets[index];
    if (index === this.currentParagraphIndex && this.audio && Number.isFinite(this.audio.duration)) {
      this.audio.currentTime = within; this.paragraphSeconds = within; this.updateAudioWord(); this.notifyProgress(); return;
    }
    this.cancelOutput(); this.currentParagraphIndex = index; this.words = narrationText(this.paragraphs[index]).words;
    this.paragraphSeconds = within; this.pendingSeconds = within; this.pendingCharacter = null;
    this.notifyWord(estimatedWord(this.words, within / this.durations[index]), 'estimated');
    this.callbacks.onParagraphChange?.(index); this.notifyProgress();
    if (this.isPlaying) void this.speak();
  }
  private updateAudioWord() {
    if (this.points.length) {
      let index = -1;
      for (const point of this.points) {if (point.timeSeconds > this.paragraphSeconds) break; index = point.wordIndex;}
      this.notifyWord(index, 'timestamp');
    } else this.notifyWord(estimatedWord(this.words, this.paragraphSeconds / this.durations[this.currentParagraphIndex]), 'estimated');
  }
  private setPlaying(playing: boolean) {
    this.isPlaying = playing; this.callbacks.onStateChange?.(playing);
    if (this.progressInterval) clearInterval(this.progressInterval);
    this.progressInterval = null;
    this.lastTick = performance.now();
    if (playing) this.progressInterval = setInterval(() => {
      const now = performance.now(), delta = (now - this.lastTick) / 1000; this.lastTick = now;
      if (!this.outputStarted) return;
      if (this.audio) {
        if (this.audio.paused || this.audio.seeking || this.audio.readyState < 2) return;
        this.paragraphSeconds = this.audio.currentTime; this.updateAudioWord();
      } else if (this.utterance) {
        this.paragraphSeconds += delta * this.playbackRate;
        if (!this.hasWordBoundaries) this.notifyWord(Math.max(wordAtCharacter(this.words, this.runStartCharacter), Math.min(wordAtCharacter(this.words, this.runEndCharacter - 1), estimatedWord(this.words, this.paragraphSeconds / this.durations[this.currentParagraphIndex]))), 'estimated');
      }
      this.notifyProgress();
    }, 80);
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
    this.words = narrationText(text).words; this.points = []; this.hasWordBoundaries = false;
    const seekSeconds = this.pendingSeconds; this.pendingSeconds = 0;
    this.paragraphSeconds = seekSeconds; this.notifyWord(-1, 'idle'); this.callbacks.onParagraphChange?.(this.currentParagraphIndex);
    const languageRuns = bilingualRuns(text);
    const hasArabic = languageRuns.some(r => r.language === 'ar');
    // Mixed passages need two device voices; the deferred cloud setup has one selected voice.
    const deviceBilingual = this.bilingual && hasArabic && (languageRuns.some(r => r.language === 'en') || !this.languageCode.startsWith('ar'));
    if (this.engine !== 'browser' && !deviceBilingual && !this.isGeminiCooldownActive()) {
      try {
        const key = `${this.engine}:${this.geminiVoiceName}:${this.languageCode}:${this.geminiStyle}:${text}`;
        let clip = this.cache.get(key);
        if (!clip) {
          const controller = new AbortController(); this.request = controller;
          const timeout = setTimeout(() => controller.abort(), 45000);
          let data: any;
          try {
            const res = await fetch('/api/tts', {method: 'POST', headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({text, voiceId: this.geminiVoiceName, provider: this.engine, languageCode: this.languageCode, style: this.geminiStyle}), signal: controller.signal});
            data = await res.json();
            if (!res.ok || !data.audioBase64) throw new Error(data.message || data.error || 'AI voice is unavailable.');
          } finally { clearTimeout(timeout); if (this.request === controller) this.request = null; }
          if (version !== this.generation || !this.isPlaying) return;
          const blob = audioBlob(data.audioBase64, data.mimeType || 'audio/L16;rate=24000');
          clip = {blob, points: validTimepoints(data.wordTimepoints, this.words.length)};
          while (this.cacheBytes + blob.size > 16 * 1024 * 1024 && this.cache.size) {
            const first = this.cache.keys().next().value!;
            this.cacheBytes -= this.cache.get(first)!.blob.size; this.cache.delete(first);
          }
          if (blob.size <= 16 * 1024 * 1024) { this.cache.set(key, clip); this.cacheBytes += blob.size; }
        }
        if (version !== this.generation || !this.isPlaying) return;
        this.points = clip.points;
        this.audioUrl = URL.createObjectURL(clip.blob);
        const audio = new Audio(this.audioUrl); this.audio = audio; audio.playbackRate = this.playbackRate;
        audio.onloadedmetadata = () => {
          if (version !== this.generation || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
          this.durations[this.currentParagraphIndex] = audio.duration; this.rebuildOffsets();
          audio.currentTime = Math.min(seekSeconds, audio.duration - 0.01); this.paragraphSeconds = audio.currentTime; this.notifyProgress();
        };
        audio.onplaying = () => {
          if (version !== this.generation) return;
          this.outputStarted = true; this.lastTick = performance.now(); this.updateAudioWord();
          if (this.context?.state === 'running' && this.analyser && !this.source) {
            try {this.source = this.context.createMediaElementSource(audio); this.source.connect(this.analyser);} catch {this.source?.disconnect(); this.source = null;}
          }
        };
        audio.onended = () => { if (version === this.generation && this.isPlaying) this.next(); };
        audio.onerror = () => {
          if (version !== this.generation || !this.isPlaying) return;
          this.geminiCooldownUntil = Date.now() + 60000;
          this.callbacks.onEngineFallback?.('Google audio could not be played. Using device speech.');
          this.pendingSeconds = this.paragraphSeconds; void this.speak();
        };
        await audio.play(); return;
      } catch (error) {
        if (version !== this.generation || !this.isPlaying) return;
        this.geminiCooldownUntil = Date.now() + 60000;
        this.callbacks.onEngineFallback?.(`${error instanceof Error ? error.message : 'AI voice is unavailable.'} Using the device voice.`);
        if (this.audio) {this.pendingSeconds = this.paragraphSeconds; this.cancelOutput(); return this.speak();}
      }
    }
    if (!('speechSynthesis' in window)) { this.fail('This browser does not support device narration.'); return; }
    const initialWord = estimatedWord(this.words, seekSeconds / this.durations[this.currentParagraphIndex]);
    this.startCharacter = this.pendingCharacter ?? (seekSeconds > 0 ? this.words[initialWord]?.start || 0 : 0);
    this.pendingCharacter = null;
    const startCharacter = this.startCharacter;
    const runs = this.bilingual ? bilingualRuns(text.slice(startCharacter)) : [{text: text.slice(startCharacter), start: 0, language: this.languageCode.startsWith('ar') ? 'ar' as const : 'en' as const}];
    let voices = this.getAvailableBrowserVoices();
    if (runs.some(r => r.language === 'ar') && !voices.some(v => /^ar(?:-|$)/i.test(v.lang))) {
      const synth = window.speechSynthesis;
      if (typeof synth.addEventListener === 'function') await new Promise<void>(resolve => {
        const ready = () => {clearTimeout(timeout); synth.removeEventListener('voiceschanged', ready); resolve();};
        const timeout = setTimeout(ready, 1500); synth.addEventListener('voiceschanged', ready, {once:true});
      });
      if (version !== this.generation || !this.isPlaying) return;
      voices = this.getAvailableBrowserVoices();
      if (!voices.some(v => /^ar(?:-|$)/i.test(v.lang))) {this.pendingSeconds = seekSeconds; this.pendingCharacter = startCharacter; this.fail('An Arabic device voice is needed to read this passage. Enable an Arabic voice on your device, then press Listen.'); return;}
    }
    if (this.bilingual && hasArabic && runs.some(r => r.language === 'en') && !voices.some(v => /^en(?:-|$)/i.test(v.lang))) {
      this.pendingSeconds = seekSeconds; this.pendingCharacter = startCharacter;
      this.fail('An English device voice is needed alongside Arabic. Enable an English voice on your device, then press Listen.'); return;
    }
    const speakRun = (index: number) => {
    if (version !== this.generation || !this.isPlaying) return;
    const run = runs[index];
    if (!run) {this.next(); return;}
    const speechStart = startCharacter + run.start;
    this.runStartCharacter = speechStart;
    this.runEndCharacter = speechStart + run.text.length;
    this.hasWordBoundaries = false; this.outputStarted = false;
    const utterance = new SpeechSynthesisUtterance(run.text); this.utterance = utterance;
    utterance.onstart = () => {
      if (version !== this.generation || !this.isPlaying) return;
      this.paragraphSeconds = speechStart / text.length * this.durations[this.currentParagraphIndex];
      this.outputStarted = true; this.lastTick = performance.now(); this.notifyWord(wordAtCharacter(this.words, speechStart), 'estimated');
    };
    utterance.onboundary = event => {
      if (version !== this.generation || !this.isPlaying || event.name === 'sentence' || !Number.isFinite(event.charIndex)) return;
      this.outputStarted = true; this.hasWordBoundaries = true;
      const character = speechStart + event.charIndex;
      this.paragraphSeconds = Math.min(this.durations[this.currentParagraphIndex], character / text.length * this.durations[this.currentParagraphIndex]);
      this.notifyWord(wordAtCharacter(this.words, character), 'boundary'); this.notifyProgress();
    };
    utterance.rate = this.playbackRate; utterance.pitch = this.pitch;
    const language = this.bilingual && run.language === 'ar' ? 'ar-SA' : this.bilingual && (hasArabic || this.languageCode.startsWith('ar')) ? 'en-US' : this.languageCode;
    const base = language.split('-')[0];
    const preferred = base === 'ar' ? voices.find(v => v.voiceURI === this.arabicVoiceURI && /^ar(?:-|$)/i.test(v.lang)) : this.selectedBrowserVoice?.lang.split('-')[0] === base ? this.selectedBrowserVoice : null;
    const voice = preferred || voices.find(v => v.lang === language) || voices.find(v => v.lang.split('-')[0] === base) || (base !== 'ar' ? voices.find(v => v.default) || voices[0] : null);
    utterance.lang = voice?.lang || language;
    if (voice) utterance.voice = voice;
    utterance.onend = () => {if (version === this.generation && this.isPlaying) speakRun(index + 1);};
    utterance.onerror = event => {
      if (version === this.generation && !['canceled', 'interrupted'].includes(event.error)) this.fail('Device narration failed. Try another voice or press Listen again.');
    };
    window.speechSynthesis.speak(utterance);
    };
    speakRun(0);
  }
  private next() {
    if (this.currentParagraphIndex + 1 < this.paragraphs.length) { this.currentParagraphIndex++; this.pendingSeconds = 0; this.pendingCharacter = null; void this.speak(); }
    else { this.stop(); this.callbacks.onChapterComplete?.(); }
  }
  getCurrentState() {
    return {isPlaying: this.isPlaying, currentParagraphIndex: this.currentParagraphIndex, playbackRate: this.playbackRate,
      engine: this.engine, geminiVoiceName: this.geminiVoiceName, isCooldownActive: this.isGeminiCooldownActive(), hasChapter: this.paragraphs.length > 0};
  }
}
export const speechEngine = new AudiobookSpeechEngine();
