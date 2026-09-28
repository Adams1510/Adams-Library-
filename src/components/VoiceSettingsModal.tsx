import { audioBlob } from '../utils/audio';
import { speechEngine } from '../services/speechEngine';
import React, { useState, useRef, useEffect } from 'react';
import { TtsEngine, VoiceOption } from '../types';
import { AVAILABLE_VOICES } from '../data/sampleBooks';
import {
  SlidersHorizontal,
  X,
  Sparkles,
  Gauge,
  Check,
  Play,
  Loader2,
  Cpu,
} from 'lucide-react';

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEngine: TtsEngine;
  currentGeminiVoice: string;
  geminiStyle: string;
  browserVoiceURI: string;
  playbackRate: number;
  pitch: number;
  autoScroll: boolean;
  onSelectEngineAndVoice: (engine: TtsEngine, geminiVoice: string) => void;
  onChangeGeminiStyle: (style: string) => void;
  onSelectBrowserVoice: (voiceURI: string) => void;
  onChangePlaybackRate: (rate: number) => void;
  onChangePitch: (pitch: number) => void;
  onToggleAutoScroll: (enabled: boolean) => void;
}

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  isOpen,
  onClose,
  currentEngine,
  currentGeminiVoice,
  geminiStyle,
  browserVoiceURI,
  playbackRate,
  pitch,
  autoScroll,
  onSelectEngineAndVoice,
  onChangeGeminiStyle,
  onSelectBrowserVoice,
  onChangePlaybackRate,
  onChangePitch,
  onToggleAutoScroll,
}) => {
  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);

  const preview = useRef<HTMLAudioElement | null>(null);
  const previewUrl = useRef<string | null>(null);
  const previewGeneration = useRef(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const stopPreview = () => {
    previewGeneration.current++;
    preview.current?.pause(); preview.current = null;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
  };
  useEffect(() => { if (!isOpen) { stopPreview(); setTestingVoiceId(null); } return stopPreview; }, [isOpen]);
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const refresh = () => setBrowserVoices(window.speechSynthesis.getVoices());
    refresh(); window.speechSynthesis.addEventListener('voiceschanged', refresh);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refresh);
  }, [isOpen]);
  if (!isOpen) return null;

  const testVoiceSample = async (voice: typeof AVAILABLE_VOICES[0]) => {
    stopPreview();
    speechEngine.pause();
    const generation = previewGeneration.current;
    setPreviewError(null);
    setTestingVoiceId(voice.id);
    const sampleText = 'Verily, with every hardship comes ease and profound stillness of the heart.';

    try {
      if (voice.engine === 'gemini') {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: sampleText,
              voiceName: voice.geminiVoiceName,
              style: geminiStyle,
            rate: playbackRate,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.audioBase64) {
            if (generation !== previewGeneration.current) return;
            previewUrl.current = URL.createObjectURL(audioBlob(data.audioBase64, data.mimeType || 'audio/L16;rate=24000'));
            const audio = new Audio(previewUrl.current);
            preview.current = audio;
            audio.playbackRate = playbackRate;
            await audio.play();
            audio.onended = () => setTestingVoiceId(null);
            audio.onerror = () => setTestingVoiceId(null);
            return;
          }
        }
      }

      if (generation !== previewGeneration.current) return;
      if (voice.engine === 'gemini') setPreviewError('AI voice is unavailable. This preview uses your device voice.');
      // Browser fallback speech
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(sampleText);
        utterance.rate = playbackRate;
        utterance.pitch = pitch;
        utterance.onend = () => setTestingVoiceId(null);
        utterance.onerror = () => setTestingVoiceId(null);
        window.speechSynthesis.speak(utterance);
      } else {
        setTestingVoiceId(null);
      }
    } catch (e) {
      setPreviewError('Unable to play this voice. Please try again.');
      setTestingVoiceId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {previewError && <p role="alert" className="text-sm text-amber-600 mb-3">{previewError}</p>}
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Voice & Speech Engine
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose Gemini AI Studio models or Device Native TTS
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

        {/* Modal Body */}
        <div className="py-5 overflow-y-auto space-y-6 flex-1 pr-1">
          
          {/* Narrator Voice Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Available Narrator Voices
            </label>
            <div className="space-y-2.5">
              {AVAILABLE_VOICES.map((v) => {
                const isSelected =
                  v.engine === currentEngine &&
                  (v.engine === 'browser' || v.geminiVoiceName === currentGeminiVoice);
                const isTesting = testingVoiceId === v.id;

                return (
                  <div
                    key={v.id}
                    onClick={() => onSelectEngineAndVoice(v.engine, v.geminiVoiceName || 'Kore')}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-500 shadow-md shadow-emerald-950/20'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl mt-0.5 ${
                        isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                        {v.engine === 'gemini' ? <Sparkles className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{v.name}</h4>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                            {v.gender} • {v.accent}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {v.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          testVoiceSample(v);
                        }}
                        disabled={isTesting}
                        className="p-2 rounded-xl bg-white dark:bg-slate-750 hover:bg-slate-100 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-slate-300 dark:border-slate-700 flex items-center gap-1 transition-colors"
                        title="Preview sample narration"
                      >
                        {isTesting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                        <span className="hidden sm:inline">Preview</span>
                      </button>

                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white dark:text-slate-950 flex items-center justify-center">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-4">
            <label htmlFor="device-voice" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Free device voice</label>
            <select id="device-voice" value={browserVoiceURI} onChange={(event) => onSelectBrowserVoice(event.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
              <option value="">Use device default voice</option>
              {browserVoices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang}){voice.default ? ' • default' : ''}</option>)}
            </select>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">These voices come from your browser or operating system. The available list varies by device.</p>
          </div>

          <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-4">
            <label htmlFor="gemini-style" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Gemini speaking style
            </label>
            <select id="gemini-style" value={['Warm, clear audiobook narration', 'Calm and reflective, with gentle pacing', 'Bright and conversational', 'Formal and measured', 'Dramatic storytelling'].includes(geminiStyle) ? geminiStyle : 'custom'}
              onChange={(event) => onChangeGeminiStyle(event.target.value === 'custom' ? geminiStyle : event.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
              <option>Warm, clear audiobook narration</option>
              <option>Calm and reflective, with gentle pacing</option>
              <option>Bright and conversational</option>
              <option>Formal and measured</option>
              <option>Dramatic storytelling</option>
              {!['Warm, clear audiobook narration', 'Calm and reflective, with gentle pacing', 'Bright and conversational', 'Formal and measured', 'Dramatic storytelling'].includes(geminiStyle) && <option value="custom">Custom style</option>}
              <option value="custom">Custom style…</option>
            </select>
            <input aria-label="Custom Gemini speaking style" value={geminiStyle} maxLength={160}
              onChange={(event) => onChangeGeminiStyle(event.target.value)}
              placeholder="Describe tone, pace, or accent"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100" />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Gemini 3.8 Flash-Lite offers controllable narration on Google’s free API tier. Google may use free-tier requests to improve its products. Browser voices are free and stay on your device.</p>
            <label htmlFor="custom-gemini-voice" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pt-2">
              Custom Gemini voice ID (optional)
            </label>
            <input id="custom-gemini-voice" value={currentGeminiVoice} maxLength={100}
              onChange={(event) => onSelectEngineAndVoice('gemini', event.target.value.trim() || 'Kore')}
              placeholder="Choose a voice above or paste a voice_… ID"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100" />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">You can create custom personas in Google AI Studio, then paste their ID here.</p>
          </div>

          {/* Speed & Auto-scroll Controls */}
          <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                <span className="flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-emerald-500" />
                  Narration Speed
                </span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{playbackRate}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.25"
                value={playbackRate}
                onChange={(e) => onChangePlaybackRate(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer h-2"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                <span>0.5x (Slow)</span>
                <span>1.0x (Normal)</span>
                <span>1.5x</span>
                <span>2.5x (Fast)</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                <span>Device voice pitch</span><span className="font-mono text-emerald-600 dark:text-emerald-400">{pitch.toFixed(1)}</span>
              </div>
              <input type="range" min="0.5" max="1.5" step="0.1" value={pitch}
                onChange={(event) => onChangePitch(parseFloat(event.target.value))}
                className="w-full accent-emerald-500 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer h-2" />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Pitch applies to device speech. Gemini voices use their selected voice and speaking style.</p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div>
                <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">Auto-Scroll Text with Audio</h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Keep the active spoken paragraph centered on screen</p>
              </div>
              <button
                type="button"
                onClick={() => onToggleAutoScroll(!autoScroll)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  autoScroll ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    autoScroll ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
          >
            Save & Close
          </button>
        </div>

      </div>
    </div>
  );
};
