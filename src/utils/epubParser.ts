import JSZip from 'jszip';
import type { Book, Chapter, BookCategory } from '../types';

/**
 * Strips HTML tags and unescapes standard entities for clean text extraction
 */
export function cleanHtmlText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, nav, head').forEach(node => node.remove());
  doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, li, blockquote, br').forEach(node => node.after(doc.createTextNode('\n\n')));
  return (doc.body.textContent || '').split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n');
}

// Keep every character, including unusually long sentences and unspaced text.
export function splitIntoParagraphs(text: string): string[] {
  const result: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    let remaining = paragraph.replace(/\s+/g, ' ').trim();
    while (remaining.length > 900) {
      let cut = remaining.lastIndexOf(' ', 900);
      if (cut < 400) cut = 900;
      if (/[\uD800-\uDBFF]/.test(remaining[cut - 1])) cut--;
      result.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining) result.push(remaining);
  }
  return result;
}

export function resolveEpubPath(base: string, href: string): string {
  const path = decodeURIComponent(href.split('#')[0].split('?')[0]);
  if (/^[a-z]+:/i.test(path)) throw new Error('External chapter references are not supported.');
  const parts: string[] = [];
  for (const part of (path.startsWith('/') ? path : base + path).split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
}

/**
 * Determine category heuristic if not provided
 */
export function guessCategory(title: string, contentSample: string): BookCategory {
  const combined = (title + ' ' + contentSample).toLowerCase();
  
  const islamicKeywords = ['allah', 'quran', 'prophet', 'hadith', 'sunnah', 'islam', 'tazkiyah', 'heart', 'soul', 'prayer', 'salah', 'dhikr', 'imam', 'mosque', 'ramadan', 'taqwa', 'sufi', 'caliph', 'deen', 'jannah'];
  const psychKeywords = ['psychology', 'mind', 'cognitive', 'emotion', 'behavior', 'habit', 'therapy', 'trauma', 'resilience', 'brain', 'consciousness', 'dopamine', 'cbt', 'neuroscience', 'mental', 'anxiety', 'bias', 'ego', 'psyche'];
  
  let islamicScore = 0;
  for (const kw of islamicKeywords) {
    if (combined.includes(kw)) islamicScore += 1;
  }

  let psychScore = 0;
  for (const kw of psychKeywords) {
    if (combined.includes(kw)) psychScore += 1;
  }

  if (islamicScore > 1 && islamicScore >= psychScore) return 'Islamic';
  if (psychScore > 1 && psychScore > islamicScore) return 'Psychological';
  return 'Contemporary';
}

/**
 * Parse an ePub file (ArrayBuffer or File) into a structured Book object
 */
export async function parseEpub(fileData: ArrayBuffer | File, filename?: string): Promise<Book> {
  const zip = new JSZip();
  let loadedZip: JSZip;
  
  try {
    loadedZip = await zip.loadAsync(fileData instanceof ArrayBuffer ? fileData : await fileData.arrayBuffer());
  } catch (err) {
    throw new Error('Failed to read archive: The file does not appear to be a valid ePub or zip archive.');
  }

  const entries = Object.values(loadedZip.files);
  const expandedSize = entries.reduce((sum, entry) => sum + ((entry as any)._data?.uncompressedSize || 0), 0);
  if (entries.length > 10000 || expandedSize > 100 * 1024 * 1024) throw new Error('This EPUB is too large to unpack (100 MB expanded limit).');

  // 1. Locate container.xml to find the OPF file path
  const containerFile = loadedZip.file('META-INF/container.xml');
  if (!containerFile) {
    throw new Error('Invalid ePub format: META-INF/container.xml is missing.');
  }

  const containerXml = await containerFile.async('text');
  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml.replace(/^\uFEFF/, '').trimStart(), 'application/xml');
  const rootfile = containerDoc.getElementsByTagNameNS('*', 'rootfile')[0];
  const opfPath = rootfile?.getAttribute('full-path');

  if (!opfPath) {
    throw new Error('Invalid ePub format: Root OPF file path not specified in container.');
  }

  // 2. Read OPF file
  const opfFile = loadedZip.file(opfPath);
  if (!opfFile) {
    throw new Error(`OPF package file not found at path: ${opfPath}`);
  }

  const opfXml = await opfFile.async('text');
  const opfDoc = parser.parseFromString(opfXml.replace(/^\uFEFF/, '').trimStart(), 'application/xml');
  if (opfDoc.querySelector('parsererror')) throw new Error('The EPUB package metadata is malformed.');

  // Base directory for relative links
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

  // Extract Metadata
  const titleElem = opfDoc.getElementsByTagNameNS('*', 'title')[0];
  const creatorElem = opfDoc.getElementsByTagNameNS('*', 'creator')[0];
  const descElem = opfDoc.getElementsByTagNameNS('*', 'description')[0];
  const subjectElems = Array.from(opfDoc.getElementsByTagNameNS('*', 'subject'));

  const title = titleElem?.textContent?.trim() || (filename ? filename.replace(/\.[^/.]+$/, '') : 'Untitled ePub');
  const author = creatorElem?.textContent?.trim() || 'Unknown Author';
  const description = descElem?.textContent?.trim() || 'Custom uploaded ePub audiobook extracted and ready for speech playback.';
  
  const subjects: string[] = [];
  subjectElems.forEach(s => {
    if (s.textContent?.trim()) subjects.push(s.textContent.trim());
  });

  // Extract Manifest (id -> href, media-type)
  const manifestMap = new Map<string, { href: string; mediaType: string }>();
  let coverHref = '';
  let coverMime = '';
  const coverId = Array.from(opfDoc.getElementsByTagNameNS('*', 'meta')).find(e => e.getAttribute('name') === 'cover')?.getAttribute('content');

  const itemElems = Array.from(opfDoc.getElementsByTagNameNS('*', 'item'));
  itemElems.forEach(item => {
    const id = item.getAttribute('id') || '';
    const href = item.getAttribute('href') || '';
    const mediaType = item.getAttribute('media-type') || '';
    const properties = item.getAttribute('properties') || '';

    if (id && href) {
      manifestMap.set(id, { href, mediaType });
      if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType) && (properties.includes('cover-image') || id === coverId || (!coverHref && id.toLowerCase().includes('cover')))) {
        coverHref = href;
        coverMime = mediaType;
      }
    }
  });

  // Extract Cover Image if available
  let coverImage: string | undefined = undefined;
  if (coverHref) {
    const fullCoverPath = resolveEpubPath(opfDir, coverHref);
    const coverFile = loadedZip.file(fullCoverPath) || loadedZip.file(coverHref);
    if (coverFile) {
      try {
        const coverBase64 = await coverFile.async('base64');
        const mediaType = coverMime;
        coverImage = `data:${mediaType};base64,${coverBase64}`;
      } catch (e) {
        console.warn('Could not extract cover image:', e);
      }
    }
  }

  // Extract Spine (reading order)
  const spineItemrefs = Array.from(opfDoc.getElementsByTagNameNS('*', 'itemref'));
  const chapterIds: string[] = [];
  spineItemrefs.forEach(itemref => {
    const idref = itemref.getAttribute('idref');
    if (idref && itemref.getAttribute('linear') !== 'no') chapterIds.push(idref);
  });

  // 3. Process Chapters from Spine
  const chapters: Chapter[] = [];
  let chapterIndex = 1;
  let allExtractedText = '';

  for (const idref of chapterIds) {
    const item = manifestMap.get(idref);
    if (!item) continue;

    // Resolve relative path
    const itemPath = resolveEpubPath(opfDir, item.href);
    // In case of URI decoding issues:
    const decodedPath = decodeURIComponent(itemPath);
    const chapterFile = loadedZip.file(itemPath) || loadedZip.file(decodedPath);

    if (!chapterFile) throw new Error(`A chapter is missing from the EPUB: ${itemPath}`);

    const rawContent = await chapterFile.async('text');
    const cleanText = cleanHtmlText(rawContent);

    // Filter out empty placeholder or navigation pages with fewer than 15 words unless it's the only content
    const words = cleanText.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) {
      continue;
    }

    // Try to find chapter title inside the HTML
    let chapterTitle = `Chapter ${chapterIndex}`;
    try {
      const chapterDoc = parser.parseFromString(rawContent, 'text/html');
      const heading = chapterDoc.querySelector('h1, h2, h3') || chapterDoc.querySelector('title');
      if (heading && heading.textContent?.trim()) {
        const hText = heading.textContent.trim();
        if (hText.length < 80) {
          chapterTitle = hText;
        }
      }
    } catch {
      // fallback to Chapter N
    }

    const paragraphs = splitIntoParagraphs(cleanText);
    const wordCount = words.length;
    // ~140 words per minute narration speed
    const estimatedDurationSec = Math.max(10, Math.round((wordCount / 140) * 60));

    chapters.push({
      id: `chap-${chapterIndex}-${Date.now()}`,
      title: chapterTitle,
      order: chapterIndex,
      content: cleanText,
      paragraphs,
      wordCount,
      estimatedDurationSec,
    });

    allExtractedText += ' ' + cleanText;
    chapterIndex++;
  }

  if (chapters.length === 0) {
    throw new Error('Could not find any readable text chapters in the provided ePub.');
  }

  const totalWords = chapters.reduce((acc, c) => acc + c.wordCount, 0);
  const totalDurationSec = chapters.reduce((acc, c) => acc + c.estimatedDurationSec, 0);
  const category = guessCategory(title + ' ' + subjects.join(' '), allExtractedText.substring(0, 3000));

  const bookId = `custom-epub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  return {
    id: bookId,
    title,
    author,
    category,
    description,
    coverImage,
    coverTheme: getThemeForCategory(category),
    chapters,
    totalWords,
    totalDurationSec,
    uploadedAt: new Date().toISOString(),
    isCustomUpload: true,
    tags: subjects.length > 0 ? subjects : [category, 'ePub'],
    sourceFilename: filename || 'book.epub',
  };
}

export function getThemeForCategory(cat: BookCategory): string {
  switch (cat) {
    case 'Islamic':
      return 'from-emerald-800 via-teal-900 to-slate-950 text-emerald-100';
    case 'Psychological':
      return 'from-indigo-900 via-violet-950 to-slate-950 text-indigo-100';
    case 'Contemporary':
      return 'from-amber-900 via-stone-900 to-zinc-950 text-amber-100';
    default:
      return 'from-slate-800 via-slate-900 to-zinc-950 text-slate-100';
  }
}
