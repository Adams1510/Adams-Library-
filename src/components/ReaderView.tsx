import React, {useState, useEffect, useRef, useMemo} from 'react';
import {Book, Chapter, Bookmark} from '../types';
import type {WordPosition} from '../services/speechEngine';
import {narrationText} from '../utils/narrationText';
import {ArrowLeft, ChevronLeft, ChevronRight, Play, Pause, List, Sparkles, BookmarkPlus, Type, Check, LocateFixed} from 'lucide-react';

interface ReaderViewProps {
  book: Book; currentChapterIndex: number; currentParagraphIndex: number; wordPosition: WordPosition; isPlaying: boolean;
  onBackToLibrary: () => void; onSelectChapter: (index: number) => void; onPlayPause: () => void; onJumpToParagraph: (index: number) => void;
  onAddBookmark: (chapterId: string, chapterTitle: string, paragraphIndex: number, snippet: string) => void;
  onOpenAiInsights: (chapter: Chapter) => void; bookmarks: Bookmark[];
}

const SyncedParagraph = React.memo(function SyncedParagraph({text, wordIndex, sentenceIndex, selected, playing}: {text: string; wordIndex: number; sentenceIndex: number; selected: boolean; playing: boolean}) {
  const parsed = useMemo(() => selected ? narrationText(text) : null, [text, selected]);
  if (!parsed) return <p className="reader-prose" dir="auto">{text}</p>;
  return <p className="reader-prose" dir="auto">{parsed.sentences.map((sentence, sIdx) => {
    const tokens: React.ReactNode[] = []; let cursor = sentence.start;
    parsed.words.forEach((word, wIdx) => {
      if (word.sentenceIndex !== sIdx) return;
      tokens.push(text.slice(cursor, word.start));
      tokens.push(<span key={word.start} className={`reader-word ${wIdx === wordIndex ? 'reader-word-active' : ''}`} data-active-word={wIdx === wordIndex || undefined} aria-current={wIdx === wordIndex ? 'true' : undefined}>{word.text}</span>);
      cursor = word.end;
    });
    tokens.push(text.slice(cursor, sentence.end));
    return <span key={sentence.start} data-active-sentence={sIdx === sentenceIndex || undefined} className={sIdx === sentenceIndex ? `reader-sentence-active ${playing ? '' : 'reader-sentence-paused'}` : ''}>{tokens}</span>;
  })}</p>;
});

export function ReaderView(p: ReaderViewProps) {
  const {book, currentChapterIndex, currentParagraphIndex, wordPosition, isPlaying} = p;
  const chapter = book.chapters[currentChapterIndex] || book.chapters[0];
  const [showToc, setShowToc] = useState(false), [fontSize, setFontSize] = useState(21), [serif, setSerif] = useState(true), [follow, setFollow] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const article = useRef<HTMLElement>(null), toc = useRef<HTMLDialogElement>(null), toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = wordPosition.paragraphIndex === currentParagraphIndex ? wordPosition : null;
  useEffect(() => {
    if (!follow || !isPlaying || !active || active.wordIndex < 0) return;
    const frame = requestAnimationFrame(() => {
      const sentence = article.current?.querySelector('[data-active-sentence]');
      if (!sentence) return;
      const rect = sentence.getBoundingClientRect();
      const top = document.getElementById('reader-navigation')?.getBoundingClientRect().bottom || 128;
      const bottom = document.getElementById('narration-dock')?.getBoundingClientRect().top || window.innerHeight;
      const available = Math.max(80, bottom - top);
      const difference = rect.top + Math.min(rect.height, available) / 2 - (top + available / 2);
      if (Math.abs(difference) > 28) window.scrollBy({top: difference, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
    });
    return () => cancelAnimationFrame(frame);
  }, [currentParagraphIndex, active?.sentenceIndex, isPlaying, follow, chapter.id, fontSize, serif]);
  useEffect(() => {if (showToc) toc.current?.showModal(); else toc.current?.close();}, [showToc]);
  useEffect(() => () => {if (toastTimeout.current) clearTimeout(toastTimeout.current);}, []);
  const addBookmark = (index: number, text: string) => {
    p.onAddBookmark(chapter.id, chapter.title, index, text); setToast('Passage bookmarked');
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 2500);
  };
  return <div className="reader-view" onWheel={() => {if(isPlaying) setFollow(false);}} onTouchMove={() => {if(isPlaying) setFollow(false);}}>
    <nav id="reader-navigation" className="reader-navigation" aria-label="Reader controls">
      <button id="reader-back-btn" onClick={p.onBackToLibrary}><ArrowLeft size={18}/><span className="hidden sm:inline">Library</span></button>
      <button onClick={() => setShowToc(true)} className="reader-chapter-button"><List size={18}/><span>{chapter.title}</span></button>
      <button className={follow ? 'reader-follow-enabled' : ''} aria-pressed={follow} onClick={() => setFollow(!follow)} title="Keep the spoken sentence centered"><LocateFixed size={18}/><span className="hidden sm:inline">Follow</span></button>
      <button onClick={() => setSerif(!serif)} title="Change reader font" aria-label="Change reader font"><Type size={18}/></button>
      <select aria-label="Reader text size" value={fontSize} onChange={e => setFontSize(Number(e.target.value))}>{[18,21,24,28].map(size => <option key={size} value={size}>{size}px</option>)}</select>
    </nav>
    <article ref={article} className="reader-article" style={{'--reader-font-size': `${fontSize}px`} as React.CSSProperties}>
      <header className="reader-chapter-header">
        <p className="reader-eyebrow">Chapter {currentChapterIndex + 1} / {book.chapters.length}</p>
        <h1>{chapter.title}</h1>
        <p className="reader-book-credit">{book.title} <span>·</span> {book.author}</p>
        <div className="reader-chapter-actions">
          <button onClick={p.onPlayPause} className="reader-listen-button">{isPlaying ? <Pause size={17}/> : <Play size={17}/>} {isPlaying ? 'Pause' : 'Listen'}</button>
          <button id="reader-ai-insights-btn" onClick={() => p.onOpenAiInsights(chapter)}><Sparkles size={17}/> Insights</button>
          <span>{chapter.wordCount.toLocaleString()} words</span>
        </div>
      </header>
      <div className={`reader-passages ${serif ? 'font-serif' : 'font-sans'}`}>
        {chapter.paragraphs.map((paragraph, index) => {
          const selected = index === currentParagraphIndex;
          const bookmarked = p.bookmarks.some(b => b.chapterId === chapter.id && b.paragraphIndex === index);
          return <div key={`${chapter.id}:${index}`} className={`reader-passage ${selected ? 'reader-passage-selected' : ''}`}>
            <SyncedParagraph text={paragraph} selected={selected} playing={selected && isPlaying} wordIndex={selected ? active?.wordIndex ?? -1 : -1} sentenceIndex={selected ? active?.sentenceIndex ?? -1 : -1}/>
            <div className="reader-passage-actions">
              <button onClick={() => {setFollow(true); p.onJumpToParagraph(index);}} aria-label={`Start at passage ${index + 1}`} title="Listen from this passage"><Play size={16}/></button>
              <button onClick={() => addBookmark(index, paragraph)} aria-label={bookmarked ? `Passage ${index + 1} bookmarked` : `Bookmark passage ${index + 1}`} title="Bookmark passage">{bookmarked ? <Check size={16}/> : <BookmarkPlus size={16}/>}</button>
            </div>
          </div>;
        })}
      </div>
      <footer className="reader-chapter-footer">
        <button disabled={currentChapterIndex === 0} onClick={() => p.onSelectChapter(currentChapterIndex - 1)}><ChevronLeft size={18}/> Previous chapter</button>
        <button disabled={currentChapterIndex === book.chapters.length - 1} onClick={() => p.onSelectChapter(currentChapterIndex + 1)}>Next chapter <ChevronRight size={18}/></button>
      </footer>
    </article>
    <dialog ref={toc} className="reader-toc" onCancel={() => setShowToc(false)} onClick={e => {if(e.target === e.currentTarget)setShowToc(false);}} aria-labelledby="reader-toc-title">
      <div className="reader-toc-heading"><h2 id="reader-toc-title">Chapters</h2><button onClick={() => setShowToc(false)}>Close</button></div>
      <div className="reader-toc-list">{book.chapters.map((ch, index) => <button key={ch.id} aria-current={index === currentChapterIndex ? 'true' : undefined} onClick={() => {p.onSelectChapter(index); setShowToc(false); setFollow(true);}}><span>{index + 1}. {ch.title}</span><span>~{Math.ceil(ch.estimatedDurationSec / 60)}m</span></button>)}</div>
    </dialog>
    {toast && <div className="reader-bookmark-toast" role="status">{toast}</div>}
  </div>;
}
