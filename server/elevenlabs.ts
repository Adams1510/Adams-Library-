import {narrationText, validTimepoints} from '../src/utils/narrationText.ts';

type Env = Record<string, string | undefined>;
export const defaultElevenVoice = '21m00Tcm4TlvDq8ikWAM';
export class ElevenError extends Error {
  constructor(public reason: string) {super(reason);}
}
const voicesCache = new Map<string, {expires: number; voices: {voiceId: string; name: string}[]}>();
const exhausted = new Map<string, number>();
async function elevenJson(path: string, key: string, signal?: AbortSignal, body?: unknown) {
  const response = await fetch(`https://api.elevenlabs.io/v1/${path}`, {
    method: body ? 'POST' : 'GET', headers: {'xi-api-key': key, 'Content-Type': 'application/json'},
    ...(body ? {body: JSON.stringify(body)} : {}),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    let status = ''; try {status = (await response.json()).detail?.status || '';} catch {}
    // Provider responses and credentials never leave the backend.
    throw new ElevenError(/quota_exceeded|insufficient_credits/i.test(status) ? 'credits_exhausted' : response.status === 429 ? 'rate_limited' : 'provider_error');
  }
  return response.json();
}
export async function elevenVoices(env: Env, signal?: AbortSignal) {
  const key = env.ELEVENLABS_API_KEY;
  if (!key) return [];
  const cached = voicesCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.voices;
  const data = await elevenJson('voices', key, signal);
  const voices = (Array.isArray(data.voices) ? data.voices : []).filter((v: any) => /^[A-Za-z0-9]{10,64}$/.test(v.voice_id) && typeof v.name === 'string')
    .map((v: any) => ({voiceId: v.voice_id, name: v.name.slice(0, 100)}));
  if (voicesCache.size >= 8) voicesCache.delete(voicesCache.keys().next().value!);
  voicesCache.set(key, {expires: Date.now() + 300000, voices});
  return voices;
}
export async function elevenAudio(env: Env, text: string, voiceId: string, signal?: AbortSignal) {
  const key = env.ELEVENLABS_API_KEY!;
  if ((exhausted.get(key) || 0) > Date.now()) throw new ElevenError('credits_exhausted');
  let data: any;
  try {data = await elevenJson(`text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, key, signal, {
    text, model_id: env.ELEVENLABS_TTS_MODEL || 'eleven_flash_v2_5',
    voice_settings: {stability: 0.5, similarity_boost: 0.75},
    // Omit language_code so English and Arabic retain their original languages.
  });} catch (error) {
    if (error instanceof ElevenError && error.reason === 'credits_exhausted') {
      if (exhausted.size >= 8) exhausted.delete(exhausted.keys().next().value!);
      exhausted.set(key, Date.now() + 1800000);
    }
    throw error;
  }
  const alignment = data.alignment;
  const words = narrationText(text).words;
  let points: {wordIndex: number; timeSeconds: number}[] = [];
  if (Array.isArray(alignment?.characters) && alignment.characters.join('') === text && Array.isArray(alignment.character_start_times_seconds) && alignment.characters.length === alignment.character_start_times_seconds.length) {
    const offsets: number[] = []; let offset = 0;
    for (const character of alignment.characters) {offsets.push(offset); offset += character.length;}
    points = words.map((word, wordIndex) => ({wordIndex, timeSeconds: alignment.character_start_times_seconds[offsets.indexOf(word.start)]}));
  }
  return {audioBase64: data.audio_base64, mimeType: 'audio/mpeg', wordTimepoints: validTimepoints(points, words.length)};
}
