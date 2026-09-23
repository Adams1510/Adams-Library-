import React, { useState, useRef } from 'react';
import { Book, BookCategory, Chapter } from '../types';
import { parseEpub } from '../utils/epubParser';
import {
  Upload,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BookOpen,
  Layers,
  Clock,
  Moon,
  Brain,
  Radio,
  Loader2,
} from 'lucide-react';

interface EpubUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookImported: (book: Book) => void;
}

export const EpubUploadModal: React.FC<EpubUploadModalProps> = ({
  isOpen,
  onClose,
  onBookImported,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingStep, setParsingStep] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extractedBook, setExtractedBook] = useState<Book | null>(null);
  const [customCategory, setCustomCategory] = useState<BookCategory>('Islamic');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [customAuthor, setCustomAuthor] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    setErrorMsg(null);
    setIsParsing(true);
    setParsingStep('Reading archive and extracting contents...');

    try {
      if (file.name.endsWith('.txt')) {
        setParsingStep('Parsing text paragraphs and chapters...');
        const textContent = await file.text();
        const lines = textContent.split(/\n\n+/).filter(l => l.trim().length > 0);
        const title = file.name.replace(/\.[^/.]+$/, '');
        const wordCount = textContent.split(/\s+/).length;

        const fallbackBook: Book = {
          id: `custom-txt-${Date.now()}`,
          title,
          author: 'Uploaded Document',
          category: 'Contemporary',
          description: `Custom text document "${title}" extracted with ${lines.length} paragraphs.`,
          chapters: [
            {
              id: `ch-1-${Date.now()}`,
              title: 'Chapter 1: Full Document',
              order: 1,
              content: textContent,
              paragraphs: lines,
              wordCount,
              estimatedDurationSec: Math.max(15, Math.round((wordCount / 140) * 60)),
            },
          ],
          totalWords: wordCount,
          totalDurationSec: Math.max(15, Math.round((wordCount / 140) * 60)),
          uploadedAt: new Date().toISOString(),
          isCustomUpload: true,
          tags: ['Custom Upload', 'Text Document'],
          sourceFilename: file.name,
        };

        setExtractedBook(fallbackBook);
        setCustomCategory(fallbackBook.category);
        setCustomTitle(fallbackBook.title);
        setCustomAuthor(fallbackBook.author);
        setIsParsing(false);
        return;
      }

      setParsingStep('Extracting OPF metadata, table of contents & cover art...');
      const parsed = await parseEpub(file, file.name);

      setParsingStep('Analyzing content and enriching chapter tags...');
      // Try to ask server for AI categorization if available
      try {
        const sample = parsed.chapters[0]?.content || '';
        const res = await fetch('/api/categorize-book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: parsed.title,
            textSample: sample.substring(0, 1500),
          }),
        });
        if (res.ok) {
          const catData = await res.json();
          if (catData.category) parsed.category = catData.category;
          if (catData.description) parsed.description = catData.description;
          if (catData.tags && Array.isArray(catData.tags)) parsed.tags = catData.tags;
        }
      } catch (e) {
        // Fallback gracefully
      }

      setExtractedBook(parsed);
      setCustomCategory(parsed.category);
      setCustomTitle(parsed.title);
      setCustomAuthor(parsed.author);
      setIsParsing(false);
    } catch (err: any) {
      console.error('Error processing ePub:', err);
      setErrorMsg(err?.message || 'Failed to extract ePub. Please ensure the file is a valid .epub archive.');
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = () => {
    if (!extractedBook) return;
    const finalBook: Book = {
      ...extractedBook,
      title: customTitle.trim() || extractedBook.title,
      author: customAuthor.trim() || extractedBook.author,
      category: customCategory,
    };
    onBookImported(finalBook);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Upload & Extract ePub Audiobook
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Accepts .epub electronic publications & .txt text files
              </p>
            </div>
          </div>

          <button
            id="close-upload-modal-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-6 overflow-y-auto space-y-6 flex-1 pr-1">
          
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs sm:text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block">Extraction issue:</strong>
                {errorMsg}
              </div>
            </div>
          )}

          {!extractedBook ? (
            /* Dropzone Area */
            <div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 scale-[1.01]'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:border-emerald-500'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".epub,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileProcess(e.target.files[0]);
                    }
                  }}
                />

                {isParsing ? (
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Extracting Audiobook...</h4>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-mono">{parsingStep}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                        Drag & drop your ePub file here
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        or click to browse from your device
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs">
                      <Sparkles className="w-3 h-3 text-emerald-500" />
                      Auto-extracts chapters, metadata & word counts
                    </div>
                  </div>
                )}
              </div>

              {/* Tips for sample downloads */}
              <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-300">💡 ePub Compatibility:</p>
                <p>Standard ePub files from Gutenberg, open repositories, or academic portals are supported with instant chapter splitting and speech synthesis.</p>
              </div>
            </div>
          ) : (
            /* Extracted Preview & Category Customization */
            <div className="space-y-6 animate-fade-in">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-700/60 flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-semibold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Extracted {extractedBook.chapters.length} chapters ({extractedBook.totalWords.toLocaleString()} total words, ~{Math.ceil(extractedBook.totalDurationSec / 60)} mins narration)</span>
              </div>

              {/* Editable Meta fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Book Title
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Author
                  </label>
                  <input
                    type="text"
                    value={customAuthor}
                    onChange={(e) => setCustomAuthor(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Category Assignment */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Assign Category Filter
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Islamic', 'Psychological', 'Contemporary'] as BookCategory[]).map((cat) => {
                    const isSel = customCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCustomCategory(cat)}
                        className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                          isSel
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-md scale-[1.02]'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                        }`}
                      >
                        {cat === 'Islamic' && <Moon className="w-4 h-4" />}
                        {cat === 'Psychological' && <Brain className="w-4 h-4" />}
                        {cat === 'Contemporary' && <Radio className="w-4 h-4" />}
                        <span>{cat}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chapters list preview */}
              <div>
                <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Extracted Chapters ({extractedBook.chapters.length})
                </h5>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
                  {extractedBook.chapters.map((ch, idx) => (
                    <div
                      key={ch.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-800 dark:text-slate-200"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-5 text-slate-400 font-bold">{idx + 1}.</span>
                        <span className="truncate font-medium">{ch.title}</span>
                      </div>
                      <span className="text-slate-500 dark:text-slate-400 shrink-0 ml-2">
                        {ch.wordCount} words (~{Math.ceil(ch.estimatedDurationSec / 60)} min)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setExtractedBook(null)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
              >
                Choose another file
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {extractedBook && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              id="confirm-import-epub-btn"
              onClick={handleConfirmImport}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-900/30 transition-all hover:scale-105"
            >
              <BookOpen className="w-4 h-4" />
              <span>Add to Audiobook Library</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
