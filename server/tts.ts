import type {RouteApp} from './router.ts';
import {AVAILABLE_VOICES} from '../src/data/sampleBooks.ts';
import {cloudAuthHeaders, cloudConfigured, cloudCredentialIdentity} from './google-cloud-auth.ts';

type Env = Record<string, string | undefined>;
type Audio = {audioBase64: string; mimeType: string};
const audioCache = new Map<string, Audio>();
const voiceCache = new Map<string, {expires: number; voices: any[]}>();
const isLanguage = (value: unknown): value is string => typeof value === 'string' && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/.test(value);
const usableKey = (key?: string) => key && !/^(MY_|YOUR_|REPLACE_)/.test(key) ? key : undefined;
export const geminiTtsKey = (env: Env) => usableKey(env.GEMINI_TTS_API_KEY) || usableKey(env.GEMINI_API_KEY);

async function googleJson(url: string, auth: string | Record<string, string>, body?: unknown, signal?: AbortSignal): Promise<any> {
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {'Content-Type': 'application/json', ...(typeof auth === 'string' ? {'x-goog-api-key': auth} : auth)},
    ...(body ? {body: JSON.stringify(body)} : {}),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
  });
  // Never send provider errors (which can contain credentials or input) to the browser.
  if (!response.ok) throw new Error(`Google TTS returned HTTP ${response.status}`);
  return response.json();
}

async function cloudVoices(env: Env, languageCode: string, signal?: AbortSignal) {
  const key = cloudCredentialIdentity(env);
  if (!cloudConfigured(env)) return [];
  const cacheKey = `${key}:${languageCode}`;
  const cached = voiceCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.voices;
  const data = await googleJson(`https://texttospeech.googleapis.com/v1/voices?languageCode=${encodeURIComponent(languageCode)}`, await cloudAuthHeaders(env), undefined, signal);
  const voices = (Array.isArray(data.voices) ? data.voices : []).filter((v: any) =>
    typeof v.name === 'string' && /-(Standard|Wavenet|Neural2)-/.test(v.name) && Array.isArray(v.languageCodes)
  ).map((v: any) => ({voiceId: v.name, languageCodes: v.languageCodes, gender: v.ssmlGender}));
  if (voiceCache.size >= 16) voiceCache.delete(voiceCache.keys().next().value!);
  voiceCache.set(cacheKey, {expires: Date.now() + 300000, voices});
  return voices;
}

export function registerTtsRoutes(app: RouteApp, env: Env) {
  app.get('/api/tts/voices', async (req, res) => {
    const languageCode = req.query.languageCode || 'en-US';
    if (!isLanguage(languageCode)) return res.status(400).json({error: 'Use a valid language code, such as en-US.'});
    const configuration = {geminiConfigured: !!geminiTtsKey(env), cloudConfigured: cloudConfigured(env)};
    try {res.json({...configuration, voices: await cloudVoices(env, languageCode, req.signal)});}
    catch {res.json({...configuration, voices: [], error: 'Google Cloud voices could not be loaded. Check your server key and API access.'});}
  });

  app.post('/api/tts', async (req, res) => {
    const {text, languageCode = 'en-US', style = 'Warm, clear audiobook narration'} = req.body;
    const voiceId = req.body.voiceId ?? req.body.voiceName ?? 'Kore';
    const provider = req.body.provider ?? (/-(Standard|Wavenet|Neural2)-/.test(String(voiceId)) ? 'google-cloud' : 'gemini');
    if (typeof text !== 'string' || !text.trim() || text.length > 1000) return res.status(400).json({error: 'Provide between 1 and 1000 characters of narration text.'});
    if (!isLanguage(languageCode) || typeof voiceId !== 'string' || typeof style !== 'string' || style.length > 160 || !['gemini', 'google-cloud'].includes(provider)) return res.status(400).json({error: 'Invalid language, voice, style or provider.'});
    const validGeminiVoice = AVAILABLE_VOICES.some(v => v.geminiVoiceName === voiceId) || /^voice_[a-zA-Z0-9_-]{1,90}$/.test(voiceId);
    if (provider === 'gemini' && !validGeminiVoice) return res.status(400).json({error: 'Choose a supported Gemini voice.'});
    if (provider === 'google-cloud' && !/^[a-z]{2,3}-[A-Z]{2}-(Standard|Wavenet|Neural2)-[A-Za-z0-9]+$/.test(voiceId)) return res.status(400).json({error: 'Choose a Standard, WaveNet or Neural2 voice from the Google Cloud list.'});
    const key = provider === 'google-cloud' ? cloudCredentialIdentity(env) : geminiTtsKey(env);
    if (!key) return res.json({audioBase64: null, useFallback: true, reason: 'missing_key', message: `${provider === 'gemini' ? 'Gemini' : 'Google Cloud'} narration is not configured. Using device speech.`});
    const cleanText = text.trim(), model = env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts';
    const cacheKey = JSON.stringify([provider, key, model, voiceId, languageCode, style, cleanText]);
    const cached = audioCache.get(cacheKey);
    if (cached) return res.json({...cached, voiceUsed: voiceId, provider, cached: true});
    try {
      let audio: Audio;
      if (provider === 'google-cloud') {
        const voices = await cloudVoices(env, languageCode, req.signal);
        if (!voices.some(v => v.voiceId === voiceId && v.languageCodes.includes(languageCode))) return res.status(400).json({error: 'This voice is not available for the selected language.'});
        const data = await googleJson('https://texttospeech.googleapis.com/v1/text:synthesize', await cloudAuthHeaders(env), {
          input: {text: cleanText}, voice: {languageCode, name: voiceId}, audioConfig: {audioEncoding: 'MP3'},
        }, req.signal);
        audio = {audioBase64: data.audioContent, mimeType: 'audio/mpeg'};
      } else {
        // Gemini 3.8 treats the transcript verbatim; delivery directions are metadata.
        const data = await googleJson('https://generativelanguage.googleapis.com/v1beta/interactions', key, {
          model, input: [{type: 'user_input', content: [{type: 'text', text: cleanText,
            annotations: [{type: 'speech_metadata', style: `${style}. Narrate in ${languageCode}.`}]}]}],
          response_format: {type: 'audio', mime_type: 'audio/l16', sample_rate: 24000},
          generation_config: {speech_config: [{voice: voiceId}]},
        }, req.signal);
        audio = {audioBase64: data.output_audio?.data, mimeType: data.output_audio?.mime_type || 'audio/L16;rate=24000'};
      }
      if (typeof audio.audioBase64 !== 'string' || !audio.audioBase64 || !/^[A-Za-z0-9+/=]+$/.test(audio.audioBase64)) throw new Error('Google returned no playable audio');
      if (audioCache.size >= 8) audioCache.delete(audioCache.keys().next().value!);
      audioCache.set(cacheKey, audio);
      return res.json({...audio, voiceUsed: voiceId, provider});
    } catch {
      return res.json({audioBase64: null, useFallback: true, reason: 'provider_error', error: 'Google narration is unavailable. Using device speech.'});
    }
  });
}
