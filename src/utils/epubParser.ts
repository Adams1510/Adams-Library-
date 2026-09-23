import JSZip from 'jszip';
import { Book, Chapter, BookCategory } from '../types';

/**
 * Strips HTML tags and unescapes standard entities for clean text extraction
 */
export function cleanHtmlText(html: string): string {
  if (!html) return '';
  
  // Replace line breaks and paragraph tags with double newlines
  let text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');

  // Collapse consecutive whitespace and normalize newlines
  text = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n\n');

  return text.trim();
}

/**
 * Split text into meaningful spoken paragraphs/chunks (~40-80 words each for smooth TTS tracking)
 */
export function splitIntoParagraphs(text: string): string[] {
  if (!text) return [];
  const rawParagraphs = text.split(/\n\n+/);
  const result: string[] = [];

  for (const raw of rawParagraphs) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // If paragraph is very long (more than 100 words), split into sentence chunks
    if (trimmed.split(/\s+/).length > 90) {
      const sentences = trimmed.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [trimmed];
      let currentChunk = '';
      for (const sent of sentences) {
        const s = sent.trim();
        if (!s) continue;
        if ((currentChunk + ' ' + s).split(/\s+/).length > 70) {
          if (currentChunk) result.push(currentChunk.trim());
          currentChunk = s;
        } else {
          currentChunk = currentChunk ? currentChunk + ' ' + s : s;
        }
      }
      if (currentChunk.trim()) {
        result.push(currentChunk.trim());
      }
    } else {
      result.push(trimmed);
    }
  }

  return result.length > 0 ? result : [text];
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
    loadedZip = await zip.loadAsync(fileData);
  } catch (err) {
    throw new Error('Failed to read archive: The file does not appear to be a valid ePub or zip archive.');
  }

  // 1. Locate container.xml to find the OPF file path
  const containerFile = loadedZip.file('META-INF/container.xml');
  if (!containerFile) {
    throw new Error('Invalid ePub format: META-INF/container.xml is missing.');
  }

  const containerXml = await containerFile.async('text');
  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, 'application/xml');
  const rootfile = containerDoc.querySelector('rootfile');
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
  const opfDoc = parser.parseFromString(opfXml, 'application/xml');

  // Base directory for relative links
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

  // Extract Metadata
  const titleElem = opfDoc.querySelector('metadata > title, metadata > dc\\:title');
  const creatorElem = opfDoc.querySelector('metadata > creator, metadata > dc\\:creator');
  const descElem = opfDoc.querySelector('metadata > description, metadata > dc\\:description');
  const subjectElems = opfDoc.querySelectorAll('metadata > subject, metadata > dc\\:subject');

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

  const itemElems = opfDoc.querySelectorAll('manifest > item');
  itemElems.forEach(item => {
    const id = item.getAttribute('id') || '';
    const href = item.getAttribute('href') || '';
    const mediaType = item.getAttribute('media-type') || '';
    const properties = item.getAttribute('properties') || '';

    if (id && href) {
      manifestMap.set(id, { href, mediaType });
      if (properties.includes('cover-image') || id.toLowerCase().includes('cover')) {
        coverHref = href;
      }
    }
  });

  // Extract Cover Image if available
  let coverImage: string | undefined = undefined;
  if (coverHref) {
    const fullCoverPath = (opfDir + coverHref).replace(/^\//, '');
    const coverFile = loadedZip.file(fullCoverPath) || loadedZip.file(coverHref);
    if (coverFile) {
      try {
        const coverBase64 = await coverFile.async('base64');
        const mediaType = manifestMap.get(coverHref)?.mediaType || 'image/jpeg';
        coverImage = `data:${mediaType};base64,${coverBase64}`;
      } catch (e) {
        console.warn('Could not extract cover image:', e);
      }
    }
  }

  // Extract Spine (reading order)
  const spineItemrefs = opfDoc.querySelectorAll('spine > itemref');
  const chapterIds: string[] = [];
  spineItemrefs.forEach(itemref => {
    const idref = itemref.getAttribute('idref');
    if (idref) chapterIds.push(idref);
  });

  // 3. Process Chapters from Spine
  const chapters: Chapter[] = [];
  let chapterIndex = 1;
  let allExtractedText = '';

  for (const idref of chapterIds) {
    const item = manifestMap.get(idref);
    if (!item) continue;

    // Resolve relative path
    const itemPath = (opfDir + item.href).replace(/^\//, '');
    // In case of URI decoding issues:
    const decodedPath = decodeURIComponent(itemPath);
    const chapterFile = loadedZip.file(itemPath) || loadedZip.file(decodedPath);

    if (!chapterFile) continue;

    const rawContent = await chapterFile.async('text');
    const cleanText = cleanHtmlText(rawContent);

    // Filter out empty placeholder or navigation pages with fewer than 15 words unless it's the only content
    const words = cleanText.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 15 && spineItemrefs.length > 3) {
      continue;
    }

    // Try to find chapter title inside the HTML
    let chapterTitle = `Chapter ${chapterIndex}`;
    try {
      const chapterDoc = parser.parseFromString(rawContent, 'text/html');
      const heading = chapterDoc.querySelector('h1, h2, h3, title');
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
    rating: 5,
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
