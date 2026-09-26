import { parseEpub, splitIntoParagraphs, guessCategory } from './epubParser.ts';
import type { Book } from '../types';

export async function importBookFile(file: File): Promise<Book> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!['epub', 'txt'].includes(extension || '')) throw new Error('Choose an EPUB or TXT file.');
  if (file.size > 50 * 1024 * 1024) throw new Error('Each file must be 50 MB or smaller.');
  const bytes = await file.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  let book: Book;
  if (extension === 'epub') book = await parseEpub(bytes, file.name);
  else {
    const text = new TextDecoder().decode(bytes).trim();
    if (!text) throw new Error('This text file is empty.');
    const paragraphs = splitIntoParagraphs(text), content = paragraphs.join('\n\n');
    const wordCount = content.split(/\s+/).length, duration = Math.ceil(wordCount / 140 * 60);
    const title = file.name.replace(/\.[^.]+$/, '');
    book = {id: '', title, author: 'Unknown Author', category: guessCategory(title, text.slice(0, 3000)), description: '',
      chapters: [{id: 'chapter-1', title, order: 1, content, paragraphs, wordCount, estimatedDurationSec: duration}],
      totalWords: wordCount, totalDurationSec: duration, uploadedAt: new Date().toISOString(), sourceFilename: file.name, isCustomUpload: true};
  }
  book.id = `file-${hash}`;
  book.chapters.forEach((chapter, index) => chapter.id = `${book.id}-ch-${index + 1}`);
  return book;
}
