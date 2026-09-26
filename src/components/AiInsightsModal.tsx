import React, { useState, useEffect } from 'react';
import { Chapter } from '../types';
import { Sparkles, X, Lightbulb, HelpCircle, BookMarked, Loader2, RefreshCw } from 'lucide-react';

interface AiInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapter: Chapter | null;
  bookTitle: string;
}

interface InsightsData {
  takeaways: string[];
  reflectionQuestions: string[];
  vocabulary: { term: string; definition: string }[];
}

export const AiInsightsModal: React.FC<AiInsightsModalProps> = ({
  isOpen,
  onClose,
  chapter,
  bookTitle,
}) => {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    if (!chapter) return;
    setLoading(true);
    setError(null);
    setInsights(null);

    try {
      const res = await fetch('/api/chapter-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookTitle,
          chapterTitle: chapter.title,
          textContent: chapter.content.substring(0, 60000),
        }),
      });

      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        throw new Error(problem.error || 'AI insights are unavailable. Please try again.');
      }

      const data = await res.json();
      setInsights(data);
    } catch (e: any) {
      console.warn('AI Insights error:', e);
      setInsights(null);
      setError(e?.message || 'Unable to generate insights.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && chapter) {
      fetchInsights();
    }
  }, [isOpen, chapter?.id]);

  if (!isOpen || !chapter) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Chapter AI Companion
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  AI insights
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
                {chapter.title} • {bookTitle}
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
        <div className="py-6 overflow-y-auto space-y-6 flex-1 pr-1">
          {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{error}</p>}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Synthesizing chapter wisdom with Gemini AI...
              </p>
            </div>
          ) : insights ? (
            <div className="space-y-6 animate-fade-in">
              
              {/* Takeaways Section */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  Key Chapter Insights
                </h4>
                <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {insights.takeaways.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Reflection Questions */}
              <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
                <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Contemplation & Reflection Prompts
                </h4>
                <div className="space-y-2">
                  {insights.reflectionQuestions.map((q, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-emerald-200/60 dark:border-emerald-800/40 text-xs text-slate-800 dark:text-slate-200 font-medium"
                    >
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold mr-1.5">Q{idx + 1}:</span>
                      {q}
                    </div>
                  ))}
                </div>
              </div>

              {/* Vocabulary / Concepts */}
              {insights.vocabulary && insights.vocabulary.length > 0 && (
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <BookMarked className="w-4 h-4 text-indigo-500" />
                    Essential Terms & Context
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {insights.vocabulary.map((vocab, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/60"
                      >
                        <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 text-emerald-600 dark:text-emerald-400">{vocab.term}</h5>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{vocab.definition}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={fetchInsights}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Regenerate Insights</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
