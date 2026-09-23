import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Lazy/safe initialization for GoogleGenAI
function getGenAI() {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-memory cache for synthesized audio chunks to save quota & speed up playback
const ttsCache = new Map<string, { audioBase64: string; mimeType: string; timestamp: number }>();
const MAX_TTS_CACHE = 200;

// Helper to delay for backoff
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fallback heuristic book classifier when AI API experiences high demand or rate limits
function heuristicCategorize(title: string, textSample: string) {
  const combined = `${title || ''} ${textSample || ''}`.toLowerCase();
  
  const islamicKeywords = ['islam', 'quran', 'hadith', 'sunnah', 'allah', 'prophet', 'ghazali', 'muraqabah', 'spiritual', 'theology', 'fiqh', 'dua', 'surah', 'muslim', 'deen', 'ihsan', 'iman', 'tazkiyah', 'ramadan', 'fasting', 'prayer', 'sufism'];
  const psychKeywords = ['psycholog', 'cognitive', 'mind', 'behavior', 'behaviour', 'emotion', 'therapy', 'neuro', 'trauma', 'stoic', 'meditat', 'habit', 'focus', 'attention', 'anxiety', 'resilience', 'mental', 'unconscious', 'freud', 'jung', 'frankl'];

  let islamicScore = 0;
  let psychScore = 0;

  for (const kw of islamicKeywords) {
    if (combined.includes(kw)) islamicScore++;
  }
  for (const kw of psychKeywords) {
    if (combined.includes(kw)) psychScore++;
  }

  if (islamicScore > 0 && islamicScore >= psychScore) {
    return {
      category: 'Islamic' as const,
      description: `Spiritual exploration in "${title || 'this work'}" focusing on inner cultivation, contemplative awareness, and classical wisdom.`,
      tags: ['Spiritual', 'Islamic Wisdom', 'Contemplation', 'Ethics'],
      mood: 'Contemplative & Serene',
    };
  } else if (psychScore > 0) {
    return {
      category: 'Psychological' as const,
      description: `Analytical inquiry in "${title || 'this work'}" examining human cognition, emotional resilience, and behavioral awareness.`,
      tags: ['Psychology', 'Mindfulness', 'Cognition', 'Behavior'],
      mood: 'Analytical & Insightful',
    };
  } else {
    return {
      category: 'Contemporary' as const,
      description: `Modern literary and philosophical reflections in "${title || 'this work'}" crafted for immersive audio listening.`,
      tags: ['Contemporary', 'Philosophy', 'Literature', 'Essays'],
      mood: 'Inspiring & Engaging',
    };
  }
}

// 1. Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    cachedTtsCount: ttsCache.size,
    timestamp: new Date().toISOString(),
  });
});

// 2. Gemini Text-To-Speech endpoint with caching & rate limit mitigation
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voiceName = 'Kore', rate = 1.0 } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for TTS synthesis.' });
    }

    const ai = getGenAI();
    if (!ai) {
      return res.json({
        audioBase64: null,
        useFallback: true,
        message: 'Gemini API key is not configured; using high-fidelity device speech.',
      });
    }

    // Limit chunk to reasonable size for fastest response
    const cleanText = text.substring(0, 1000).trim();
    const validVoices = ['Kore', 'Puck', 'Fenrir', 'Zephyr', 'Charon'];
    const chosenVoice = validVoices.includes(voiceName) ? voiceName : 'Kore';
    const cacheKey = `${chosenVoice}:${cleanText}`;

    // Return from cache immediately if present
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      return res.json({
        audioBase64: cached.audioBase64,
        mimeType: cached.mimeType,
        voiceUsed: chosenVoice,
        text: cleanText,
        cached: true,
      });
    }

    let response: any = null;
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-tts-preview',
          contents: [{ parts: [{ text: cleanText }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: chosenVoice },
              },
            },
          },
        });
        break; // Success
      } catch (genErr: any) {
        const errMsg = genErr?.message || String(genErr);
        const isQuotaOrDemand = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('503') || errMsg.includes('UNAVAILABLE');

        if (isQuotaOrDemand && attempts < maxAttempts) {
          await sleep(600);
          continue;
        }

        // Return clean fallback response so the client seamlessly uses Device Speech
        console.warn(`[TTS] Gemini TTS rate limit/quota reached: switching seamlessly to browser speech engine.`);
        return res.json({
          audioBase64: null,
          useFallback: true,
          rateLimited: true,
          error: 'Gemini TTS quota reached. Seamlessly playing with Device Native Speech.',
        });
      }
    }

    const candidate = response?.candidates?.[0];
    const audioPart = candidate?.content?.parts?.find((p: any) => p.inlineData?.data);

    if (audioPart?.inlineData?.data) {
      const audioBase64 = audioPart.inlineData.data;
      const mimeType = audioPart.inlineData.mimeType || 'audio/mp3';

      // Save in LRU cache
      if (ttsCache.size >= MAX_TTS_CACHE) {
        const oldestKey = ttsCache.keys().next().value;
        if (oldestKey) ttsCache.delete(oldestKey);
      }
      ttsCache.set(cacheKey, { audioBase64, mimeType, timestamp: Date.now() });

      return res.json({
        audioBase64,
        mimeType,
        voiceUsed: chosenVoice,
        text: cleanText,
      });
    }

    return res.json({
      audioBase64: null,
      useFallback: true,
      error: 'No audio data received from Gemini TTS.',
    });
  } catch (err: any) {
    console.warn('[TTS] Error in /api/tts:', err?.message || err);
    return res.json({
      audioBase64: null,
      useFallback: true,
      error: err?.message || 'TTS generation unavailable.',
    });
  }
});

// 3. AI Book Categorization and Metadata Enrichment with retry & robust fallback
app.post('/api/categorize-book', async (req, res) => {
  const { title = 'Untitled Work', textSample = '' } = req.body;
  const ai = getGenAI();

  if (!ai || !textSample) {
    return res.json(heuristicCategorize(title, textSample));
  }

  const prompt = `Analyze this book title and text sample:
Title: "${title}"
Text Sample: "${textSample.substring(0, 2000)}"

Classify the book into EXACTLY ONE category from: ["Islamic", "Psychological", "Contemporary"].
Also provide a 2-sentence captivating description, 4 relevant thematic tags, and estimated listening mood.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                enum: ['Islamic', 'Psychological', 'Contemporary'],
                description: 'The best matching category for this book.',
              },
              description: {
                type: Type.STRING,
                description: 'A 2-sentence summary of the book.',
              },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '4 thematic keywords or tags.',
              },
              mood: {
                type: Type.STRING,
                description: 'Atmosphere/tone, e.g. Contemplative, Scientific, Inspiring.',
              },
            },
            required: ['category', 'description', 'tags'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      if (parsed.category) {
        return res.json(parsed);
      }
    } catch (err: any) {
      if (attempt === 0) {
        await sleep(500);
        continue;
      }
      console.warn('[Categorize] Gemini high demand / rate limit; using heuristic categorization fallback.');
    }
  }

  // Graceful rule-based fallback
  return res.json(heuristicCategorize(title, textSample));
});

// 4. Chapter Insights & Reflection Questions with retry & robust fallback
app.post('/api/chapter-insights', async (req, res) => {
  const { bookTitle = 'Audiobook', chapterTitle = 'Chapter', textContent = '' } = req.body;
  const ai = getGenAI();

  const fallbackInsights = {
    takeaways: [
      `Explores foundational concepts and reflections articulated in "${chapterTitle}".`,
      'Emphasizes the integration of mindful attention, character discipline, and ethical action.',
      'Highlights the practical realization of knowledge through deliberate daily contemplation.',
    ],
    reflectionQuestions: [
      `How does the primary insight from "${chapterTitle}" alter your perspective on daily challenges?`,
      'What concrete step can you take today to internalize this reflection?',
    ],
    vocabulary: [
      { term: 'Muraqabah (Mindful Vigilance)', definition: 'The state of continuous spiritual presence and reflective awareness.' },
      { term: 'Metacognition', definition: 'The conscious awareness and regulation of one’s own thought processes and emotional states.' },
    ],
  };

  if (!ai || !textContent) {
    return res.json(fallbackInsights);
  }

  const prompt = `You are a literary and philosophical companion. Analyze the following chapter:
Book: ${bookTitle}
Chapter: ${chapterTitle}
Content: "${textContent.substring(0, 3000)}"

Provide:
1. A concise 3-bullet summary of key insights.
2. Two thoughtful reflection questions for the listener to ponder.
3. 2-3 key terms/vocabulary defined with brief context.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              takeaways: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 bullet points of core insights.',
              },
              reflectionQuestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2 deep contemplation prompts.',
              },
              vocabulary: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    term: { type: Type.STRING },
                    definition: { type: Type.STRING },
                  },
                  required: ['term', 'definition'],
                },
                description: 'Key terms explained.',
              },
            },
            required: ['takeaways', 'reflectionQuestions', 'vocabulary'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      if (parsed.takeaways && parsed.takeaways.length > 0) {
        return res.json(parsed);
      }
    } catch (err: any) {
      if (attempt === 0) {
        await sleep(500);
        continue;
      }
      console.warn('[Insights] Gemini high demand / rate limit; using enriched fallback insights.');
    }
  }

  return res.json(fallbackInsights);
});

// 5. Open Library External API Integration Hooks
// Search books from Open Library with category filtering & cover image hooks
app.get('/api/open-library/search', async (req, res) => {
  try {
    const query = (req.query.q as string || '').trim();
    const category = (req.query.category as string || '').trim();
    const limit = Math.min(24, Math.max(1, parseInt(req.query.limit as string || '12', 10)));

    let searchUrl = '';
    if (query) {
      searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}&fields=key,title,author_name,first_publish_year,cover_i,subject,number_of_pages_median,ia`;
    } else if (category && category !== 'All') {
      const subjectMap: Record<string, string> = {
        'Islamic': 'islamic_philosophy+theology+islam',
        'Psychological': 'psychology+cognitive_psychology+mindfulness',
        'Contemporary': 'contemporary_literature+philosophy+essays',
      };
      const subject = subjectMap[category] || category.toLowerCase();
      searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(subject)}&limit=${limit}&fields=key,title,author_name,first_publish_year,cover_i,subject,number_of_pages_median,ia`;
    } else {
      searchUrl = `https://openlibrary.org/search.json?q=classic+literature+philosophy&limit=${limit}&fields=key,title,author_name,first_publish_year,cover_i,subject,number_of_pages_median,ia`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AudiobookStudio/1.0 (academic-audio-narration-assistant)',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Open Library returned status ${response.status}`);
    }

    const data = await response.json() as any;
    const docs = Array.isArray(data.docs) ? data.docs : [];

    const formattedBooks = docs.map((doc: any) => {
      const title = doc.title || 'Untitled Work';
      const author = Array.isArray(doc.author_name) ? doc.author_name.join(', ') : (doc.author_name || 'Various Authors');
      const coverId = doc.cover_i;
      const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : undefined;
      const subjects = Array.isArray(doc.subject) ? doc.subject.slice(0, 5) : [];
      const firstPublishYear = doc.first_publish_year || null;
      const key = doc.key ? doc.key.replace('/works/', '') : `ol-${Math.random().toString(36).substring(2, 8)}`;
      const iaIdentifier = Array.isArray(doc.ia) ? doc.ia[0] : (doc.ia || null);

      return {
        id: `ol-${key}`,
        openLibraryKey: key,
        title,
        author,
        coverImage: coverUrl,
        firstPublishYear,
        subjects,
        iaIdentifier,
        estimatedPages: doc.number_of_pages_median || 180,
      };
    });

    return res.json({
      total: data.numFound || formattedBooks.length,
      books: formattedBooks,
    });
  } catch (err: any) {
    console.error('Error fetching from Open Library API:', err?.message || err);
    return res.status(500).json({
      error: 'Failed to search Open Library. Please verify connection.',
      books: [],
    });
  }
});

// Fetch book details from Open Library
app.get('/api/open-library/book/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const url = `https://openlibrary.org/works/${encodeURIComponent(key)}.json`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AudiobookStudio/1.0 (academic-audio-narration-assistant)',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return res.status(404).json({ error: 'Book details not found on Open Library.' });
    }

    const data = await response.json() as any;
    let description = '';
    if (typeof data.description === 'string') {
      description = data.description;
    } else if (data.description && typeof data.description.value === 'string') {
      description = data.description.value;
    }

    return res.json({
      key: data.key,
      title: data.title,
      description: description || 'Classic literary and philosophical work indexed on Open Library.',
      subjects: Array.isArray(data.subjects) ? data.subjects.slice(0, 8) : [],
    });
  } catch (err: any) {
    console.error('Error fetching Open Library book details:', err?.message || err);
    return res.status(500).json({ error: 'Failed to fetch book details.' });
  }
});

// Vite middleware or static serving
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Audiobook Studio Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
