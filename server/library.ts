import type {RouteApp} from './router.ts';
import type {Storage} from './storage.ts';
import type {Book} from '../src/types.ts';
const validId = (id: string) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(id);
export function validateBook(input: any): Book {
  if (!input || !validId(input.id) || typeof input.title !== 'string' || !input.title.trim() || !Array.isArray(input.chapters) || !input.chapters.length || input.chapters.length > 10000) throw new Error('Invalid book data.');
  const chapters = input.chapters.map((chapter: any, index: number) => {
    if (!chapter || !Array.isArray(chapter.paragraphs) || !chapter.paragraphs.length || !chapter.paragraphs.every((p: unknown) => typeof p === 'string' && p.trim() && p.length <= 1000)) throw new Error('Book contains an empty or oversized narration segment. Please re-import the file.');
    const content = chapter.paragraphs.join('\n\n');
    const wordCount = content.trim().split(/\s+/).length;
    return {id: typeof chapter.id === 'string' ? chapter.id.slice(0, 160) : `chapter-${index + 1}`, title: String(chapter.title || `Chapter ${index + 1}`).slice(0, 300), order: index + 1, content, paragraphs: chapter.paragraphs, wordCount, estimatedDurationSec: Math.ceil(wordCount / 140 * 60)};
  });
  return {id: input.id, title: input.title.trim().slice(0, 500), author: String(input.author || 'Unknown Author').slice(0, 500),
    category: ['Islamic', 'Psychological', 'Contemporary', 'Custom'].includes(input.category) ? input.category : 'Custom',
    description: String(input.description || '').slice(0, 5000), chapters,
    totalWords: chapters.reduce((sum: number, ch: any) => sum + ch.wordCount, 0), totalDurationSec: chapters.reduce((sum: number, ch: any) => sum + ch.estimatedDurationSec, 0),
    uploadedAt: new Date().toISOString(), isCustomUpload: true,
    coverImage: typeof input.coverImage === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(input.coverImage) && input.coverImage.length < 4 * 1024 * 1024 ? input.coverImage : undefined,
    tags: Array.isArray(input.tags) ? input.tags.filter((t: unknown) => typeof t === 'string').slice(0, 10).map((t: string) => t.slice(0, 100)) : [],
    sourceFilename: typeof input.sourceFilename === 'string' ? input.sourceFilename.slice(0, 300) : undefined};
}

export function registerLibraryRoutes(app: RouteApp, storage: Storage) {
  const {read, write, remove, entries} = storage;
  const route = (fn: any) => async (req: any, res: any) => {
    try { await fn(req, res); } catch (error) { console.error('Library operation failed:', error); res.status(500).json({error: 'Could not save or load your library. Your input has been kept; please try again.'}); }
  };
  app.get('/api/books', route(async (_req: any, res: any) => res.json({books: (await entries('meta-')).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))})));
  app.post('/api/books', route(async (req: any, res: any) => {
    let book: Book;
    try { book = validateBook(req.body); } catch (error: any) { return res.status(400).json({error: error.message}); }
    if (await read(`book-${book.id}.json`)) return res.status(409).json({error: 'This file is already in your library.', duplicate: true});
    const metadata = {...book, chapters: [], chapterCount: book.chapters.length, coverImage: book.coverImage ? `/api/books/${book.id}/cover` : undefined};
    await write(`book-${book.id}.json`, book);
    try { await write(`meta-${book.id}.json`, metadata); } catch (error) { await remove(`book-${book.id}.json`); throw error; }
    res.status(201).json({book: metadata});
  }));
  app.get('/api/books/:id', route(async (req: any, res: any) => {
    if (!validId(req.params.id)) return res.status(400).json({error: 'Invalid book identifier.'});
    const book = await read(`book-${req.params.id}.json`);
    return book ? res.json({book}) : res.status(404).json({error: 'This book is no longer in the library.'});
  }));
  app.get('/api/books/:id/cover', route(async (req: any, res: any) => {
    if (!validId(req.params.id)) return res.sendStatus(400);
    const book = await read(`book-${req.params.id}.json`);
    const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/.exec(book?.coverImage || '');
    if (!match) return res.sendStatus(404);
    res.set('Cache-Control', 'private, max-age=3600').type(match[1]).send(Uint8Array.from(atob(match[2]), c => c.charCodeAt(0)));
  }));
  app.delete('/api/books/:id', route(async (req: any, res: any) => {
    const id = req.params.id;
    if (!validId(id)) return res.sendStatus(400);
    await remove(`meta-${id}.json`); await remove(`book-${id}.json`); await remove(`progress-${id}.json`);
    for (const bookmark of await entries('bookmark-')) if (bookmark.bookId === id) await remove(`bookmark-${bookmark.id}.json`);
    res.json({ok: true});
  }));
  app.get('/api/reading-state', route(async (_req: any, res: any) => {
    res.json({bookmarks: await entries('bookmark-'), positions: Object.fromEntries((await entries('progress-')).map(p => [p.bookId, p]))});
  }));
  app.put('/api/progress/:id', route(async (req: any, res: any) => {
    const id = req.params.id, {chapterIndex, paragraphIndex, percentage} = req.body;
    if (!validId(id) || ![chapterIndex, paragraphIndex].every(v => Number.isInteger(v) && v >= 0) || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) return res.sendStatus(400);
    if (!await read(`meta-${id}.json`)) return res.sendStatus(404);
    await write(`progress-${id}.json`, {bookId: id, chapterIndex, paragraphIndex, percentage}); res.json({ok: true});
  }));
  app.post('/api/bookmarks', route(async (req: any, res: any) => {
    const b = req.body;
    if (!b || !validId(b.id) || !validId(b.bookId) || !Number.isInteger(b.paragraphIndex) || b.paragraphIndex < 0 || typeof b.chapterId !== 'string') return res.sendStatus(400);
    if (!await read(`meta-${b.bookId}.json`)) return res.sendStatus(404);
    const bookmark = {id: b.id, bookId: b.bookId, chapterId: b.chapterId.slice(0, 160), chapterTitle: String(b.chapterTitle || '').slice(0, 300), paragraphIndex: b.paragraphIndex, snippet: String(b.snippet || '').slice(0, 1000), createdAt: new Date().toISOString()};
    await write(`bookmark-${b.id}.json`, bookmark); res.json({bookmark});
  }));
  app.delete('/api/bookmarks/:id', route(async (req: any, res: any) => {
    if (!validId(req.params.id)) return res.sendStatus(400);
    await remove(`bookmark-${req.params.id}.json`); res.json({ok: true});
  }));
}
