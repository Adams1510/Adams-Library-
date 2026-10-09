export type Word = {text: string; start: number; end: number; sentenceIndex: number};
export type Sentence = {text: string; start: number; end: number};
export type WordTimepoint = {wordIndex: number; timeSeconds: number};
export type LanguageRun = {text: string; start: number; language: 'ar' | 'en'};
export function bilingualRuns(text: string): LanguageRun[] {
  const runs: LanguageRun[] = []; let start = 0, language: 'ar' | 'en' | null = null;
  for (const word of narrationText(text).words) {
    const detected = /\p{Script=Arabic}/u.test(word.text) ? 'ar' : /\p{Script=Latin}/u.test(word.text) ? 'en' : null;
    if (!detected) continue;
    if (language && detected !== language) {runs.push({text: text.slice(start, word.start), start, language}); start = word.start;}
    language = detected;
  }
  if (start < text.length) runs.push({text: text.slice(start), start, language: language || 'en'});
  return runs;
}
const sentenceSegmenter = new Intl.Segmenter('en', {granularity: 'sentence'});
const wordSegmenter = new Intl.Segmenter('en', {granularity: 'word'});

export function narrationText(text: string): {words: Word[]; sentences: Sentence[]} {
  const sentences = Array.from(sentenceSegmenter.segment(text), s => ({text: s.segment, start: s.index, end: s.index + s.segment.length}));
  let sentenceIndex = 0;
  const words: Word[] = [];
  for (const s of wordSegmenter.segment(text)) {
    if (!s.isWordLike) continue;
    while (sentenceIndex + 1 < sentences.length && s.index >= sentences[sentenceIndex].end) sentenceIndex++;
    words.push({text: s.segment, start: s.index, end: s.index + s.segment.length, sentenceIndex});
  }
  return {words, sentences};
}
export function wordAtCharacter(words: Word[], charIndex: number): number {
  if (!words.length) return -1;
  const next = words.findIndex(w => w.end > charIndex);
  return next < 0 ? words.length - 1 : next;
}
export function estimatedWord(words: Word[], fraction: number): number {
  if (!words.length) return -1;
  const weights = words.map(w => Math.max(2, w.text.length));
  const target = Math.max(0, Math.min(1, fraction)) * weights.reduce((a, b) => a + b, 0);
  let elapsed = 0;
  for (let i = 0; i < words.length; i++) {elapsed += weights[i]; if (target < elapsed) return i;}
  return words.length - 1;
}
export function markedSsml(text: string): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  let start = 0, content = '';
  narrationText(text).words.forEach((word, index) => {
    content += escape(text.slice(start, word.start)) + `<mark name="w${index}"/>` + escape(text.slice(word.start, word.end));
    start = word.end;
  });
  return `<speak>${content}${escape(text.slice(start))}</speak>`;
}
export function validTimepoints(raw: unknown, wordCount: number): WordTimepoint[] {
  if (!Array.isArray(raw)) return [];
  const points = raw.filter(p => Number.isInteger(p?.wordIndex) && p.wordIndex >= 0 && p.wordIndex < wordCount && Number.isFinite(p.timeSeconds) && p.timeSeconds >= 0)
    .map(p => ({wordIndex: p.wordIndex, timeSeconds: p.timeSeconds})).sort((a, b) => a.wordIndex - b.wordIndex);
  // Partial timing is not exact word alignment; use the estimated mode instead.
  return points.length === wordCount && points.every((p, i) => p.wordIndex === i && (!i || p.timeSeconds >= points[i - 1].timeSeconds)) ? points : [];
}
