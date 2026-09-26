import type { Book } from '../types';
export async function libraryRequest(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(path, {method, headers: body === undefined ? {} : {'Content-Type': 'application/json'}, body: body === undefined ? undefined : JSON.stringify(body)});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Unable to load or save the library. Please try again.');
  return data;
}
export async function getBook(book: Book): Promise<Book> {
  if (book.chapters.length) return book;
  return (await libraryRequest(`/api/books/${encodeURIComponent(book.id)}`)).book;
}
