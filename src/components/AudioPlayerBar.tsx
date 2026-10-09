import React, {useState, useEffect, useRef, useMemo} from 'react';
import {Book, Chapter, SleepTimerState} from '../types';
import {Play, Pause, RotateCcw, RotateCw, SkipBack, SkipForward, SlidersHorizontal, Moon, CloudRain, BookOpen} from 'lucide-react';
import {speechEngine, type WordPosition} from '../services/speechEngine';
import {narrationText} from '../utils/narrationText';

interface AudioPlayerBarProps {
  book: Book; currentChapter: Chapter; currentParagraphIndex: number; wordPosition: WordPosition; isPlaying: boolean;
  onPlayPause: () => void; onSkipBack15: () => void; onSkipForward15: () => void; onPrevChapter: () => void; onNextChapter: () => void;
  hasPrevChapter: boolean; hasNextChapter: boolean; currentProgressSec: number; totalDurationSec: number;
  onSeek: (fraction: number) => void; playbackRate: number; onChangeRate: (rate: number) => void;
  onOpenVoiceSettings: () => void; onOpenSleepTimer: () => void; onOpenAmbientSettings: () => void;
  onToggleReader: () => void; isReaderOpen: boolean; sleepTimer: SleepTimerState; ambientSound: string;
}
type Fragment = {id: string; text: string};
const time = (value: number) => {const sec = Math.max(0, Math.floor(value || 0)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;};

export function AudioPlayerBar(p: AudioPlayerBarProps) {
  const {book, currentChapter, currentParagraphIndex, wordPosition, isPlaying} = p;
  const dock = useRef<HTMLElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [spectrum, setSpectrum] = useState(false);
  const lastPosition = useRef({paragraph: -1, word: -1});
  const paragraph = currentChapter.paragraphs[currentParagraphIndex] || '';
  const words = useMemo(() => narrationText(paragraph).words, [paragraph]);
  const group = Math.floor(Math.max(0, wordPosition.wordIndex) / 4);
  const fragmentId = `${currentChapter.id}:${currentParagraphIndex}:${group}`;
  const fragmentText = words.length ? paragraph.slice(words[group * 4]?.start || 0, words[(group + 1) * 4]?.start ?? paragraph.length).trim() : paragraph;
  const activeFragment = () => {
    const parts: React.ReactNode[] = []; let cursor = words[group * 4]?.start || 0;
    words.slice(group * 4, (group + 1) * 4).forEach((word, offset) => {
      parts.push(paragraph.slice(cursor, word.start));
      parts.push(<span key={word.start} className={group * 4 + offset === wordPosition.wordIndex ? 'waterfall-spoken-word' : ''}>{word.text}</span>);
      cursor = word.end;
    });
    parts.push(paragraph.slice(cursor, words[(group + 1) * 4]?.start ?? paragraph.length)); return parts;
  };
  useEffect(() => {setFragments([]); lastPosition.current = {paragraph: -1, word: -1};}, [book.id, currentChapter.id]);
  useEffect(() => {
    if (wordPosition.wordIndex < 0 || wordPosition.paragraphIndex !== currentParagraphIndex) return;
    const previous = lastPosition.current;
    const jumped = currentParagraphIndex < previous.paragraph || currentParagraphIndex > previous.paragraph + 1 || (currentParagraphIndex === previous.paragraph && wordPosition.wordIndex < previous.word);
    setFragments(items => {
      const history = jumped ? [] : items;
      return history[0]?.id === fragmentId ? history : [{id: fragmentId, text: fragmentText}, ...history].slice(0, 5);
    });
    lastPosition.current = {paragraph: currentParagraphIndex, word: wordPosition.wordIndex};
  }, [fragmentId, fragmentText, wordPosition.wordIndex, currentParagraphIndex, isPlaying]);

  useEffect(() => {
    if (!dock.current) return;
    const observer = new ResizeObserver(([entry]) => document.documentElement.style.setProperty('--narration-dock-height', `${entry.borderBoxSize?.[0]?.blockSize || dock.current!.offsetHeight}px`));
    observer.observe(dock.current);
    return () => {observer.disconnect(); document.documentElement.style.removeProperty('--narration-dock-height');};
  }, []);

  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext('2d');
    if (!element || !ctx) return;
    let frame = 0, lastFrame = 0, audioMode = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const draw = (now: number) => {
      if (document.hidden || now - lastFrame < 32) {frame = requestAnimationFrame(draw); return;}
      lastFrame = now;
      const width = element.clientWidth, height = element.clientHeight, ratio = Math.min(2, window.devicePixelRatio || 1);
      if (element.width !== Math.round(width * ratio) || element.height !== Math.round(height * ratio)) {element.width = Math.round(width * ratio); element.height = Math.round(height * ratio);}
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
      const data = speechEngine.getVisualization();
      if (audioMode !== (data.source === 'audio')) {audioMode = data.source === 'audio'; setSpectrum(audioMode);}
      const energy = reduced.matches ? 0 : data.energy;
      dock.current?.style.setProperty('--audio-energy', String(energy));
      const bars = 56, step = width / bars;
      for (let i = 0; i < bars; i++) {
        const frequency = data.frequencies ? data.frequencies[Math.floor(i / bars * data.frequencies.length)] / 255 : energy * (0.25 + 0.75 * Math.sin(i / bars * Math.PI) ** 2);
        const size = 2 + (reduced.matches ? 0 : frequency * height * 0.65);
        ctx.fillStyle = data.source === 'idle' ? 'rgba(148,163,184,0.16)' : `rgba(52,211,153,${0.12 + frequency * 0.38})`;
        ctx.fillRect(i * step, height - size, Math.max(2, step - 4), size);
      }
      if (isPlaying && !reduced.matches) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying]);

  const progress = Math.min(1, Math.max(0, p.currentProgressSec / Math.max(1, p.totalDurationSec)));
  const timingLabel = wordPosition.timing === 'boundary' ? 'Word sync' : wordPosition.timing === 'timestamp' ? 'Timed audio' : wordPosition.timing === 'estimated' ? 'Estimated sync' : isPlaying ? 'Preparing narration' : 'Ready to listen';
  return <section ref={dock} id="narration-dock" className="narration-dock" aria-label="Narration player">
    <div className="narration-dock-inner">
      <div className="narration-title-row">
        <div className="min-w-0"><p className="narration-book-name">{book.title}</p><p className="narration-chapter-name">{currentChapter.title}</p></div>
        <span className="sync-status" title="Exact highlighting needs device word events or audio timestamps. Other voices use estimated timing.">{timingLabel}</span>
      </div>
      <div className="waterfall-stage" aria-hidden="true" data-playing={isPlaying}>
        <canvas ref={canvas} className="waterfall-canvas" />
        <span className="visualizer-label">{spectrum ? 'Audio spectrum' : 'Speech rhythm'}</span>
        <div className="waterfall-fragments">
          {(fragments.length ? fragments : [{id: 'preview', text: fragmentText || 'Your next chapter awaits.'}]).map((fragment, index) =>
            <div key={fragment.id} className={`waterfall-fragment ${index === 0 ? 'waterfall-current' : ''}`} style={{'--fragment-depth': index} as React.CSSProperties}>
              {index === 0 && fragment.id === fragmentId && wordPosition.wordIndex >= 0 ? activeFragment() : fragment.text}
            </div>)}
        </div>
      </div>
      <div className="narration-seek-row">
        <span>{time(p.currentProgressSec)}</span>
        <input aria-label="Seek within chapter" type="range" min="0" max="1000" step="1" value={Math.round(progress * 1000)} onChange={e => p.onSeek(Number(e.target.value) / 1000)} aria-valuetext={`${time(p.currentProgressSec)} of approximately ${time(p.totalDurationSec)}`} style={{'--seek-progress': `${progress * 100}%`} as React.CSSProperties} />
        <span>~{time(p.totalDurationSec)}</span>
      </div>
      <div className="narration-controls">
        <div className="narration-transport">
          <button id="player-prev-chapter-btn" aria-label="Previous chapter" title="Previous chapter" disabled={!p.hasPrevChapter} onClick={p.onPrevChapter}><SkipBack size={19}/></button>
          <button id="player-skip-back-btn" aria-label="Rewind 15 seconds" title="Rewind 15 seconds" onClick={p.onSkipBack15}><RotateCcw size={19}/><span className="skip-number">15</span></button>
          <button id="player-main-play-btn" className="narration-play" aria-label={isPlaying ? 'Pause narration' : 'Play narration'} title={isPlaying ? 'Pause narration' : 'Play narration'} onClick={p.onPlayPause}>{isPlaying ? <Pause size={23} fill="currentColor"/> : <Play size={23} fill="currentColor"/>}</button>
          <button id="player-skip-forward-btn" aria-label="Forward 15 seconds" title="Forward 15 seconds" onClick={p.onSkipForward15}><RotateCw size={19}/><span className="skip-number">15</span></button>
          <button id="player-next-chapter-btn" aria-label="Next chapter" title="Next chapter" disabled={!p.hasNextChapter} onClick={p.onNextChapter}><SkipForward size={19}/></button>
          <select id="player-rate-btn" aria-label="Narration speed" value={p.playbackRate} onChange={e => p.onChangeRate(Number(e.target.value))}>{[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5].map(rate => <option key={rate} value={rate}>{rate}×</option>)}</select>
        </div>
        <div className="narration-tools">
          <button id="player-ambient-btn" aria-label="Ambient sounds" title="Ambient sounds" aria-pressed={p.ambientSound !== 'none'} onClick={p.onOpenAmbientSettings}><CloudRain size={19}/></button>
          <button id="player-sleeptimer-btn" aria-label="Sleep timer" title="Sleep timer" aria-pressed={p.sleepTimer.active} onClick={p.onOpenSleepTimer}><Moon size={19}/></button>
          <button id="player-voice-settings-btn" aria-label="Voice settings" title="Voice settings" onClick={p.onOpenVoiceSettings}><SlidersHorizontal size={19}/></button>
          <button id="player-toggle-reader-btn" className="narration-view-button" onClick={p.onToggleReader}><BookOpen size={18}/>{p.isReaderOpen ? 'Library' : 'Read'}</button>
        </div>
      </div>
    </div>
  </section>;
}
