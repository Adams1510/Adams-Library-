import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ApiRouter} from '../server/router.ts';
import {registerTtsRoutes} from '../server/tts.ts';

function router(env: Record<string, string> = {}) {const app = new ApiRouter(); registerTtsRoutes(app, env); return app;}
function request(body: unknown) {return new Request('https://library.test/api/tts', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});}

test('TTS validates input before requesting Google and falls back when a key is missing', async () => {
  const app = router();
  assert.equal((await app.fetch(request({text: '   '}))).status, 400);
  assert.equal((await app.fetch(request({text: 'a'.repeat(1001)}))).status, 400);
  assert.equal((await app.fetch(request({text: 'Hello', languageCode: 'not a language'}))).status, 400);
  const fallback = await (await app.fetch(request({text: 'Hello', voiceId: 'Kore'}))).json();
  assert.equal(fallback.reason, 'missing_key'); assert.equal(fallback.useFallback, true);
});

test('Gemini uses the dedicated backend key, verbatim text, metadata and PCM response', async () => {
  const oldFetch = globalThis.fetch; const calls: any[] = [];
  globalThis.fetch = (async (url: any, init: any) => {calls.push({url, init}); return Response.json({output_audio: {data: 'AAAA', mime_type: 'audio/l16'}});}) as any;
  try {
    const app = router({GEMINI_TTS_API_KEY: 'test-secret'});
    const input = {text: 'Read exactly these words.', voiceId: 'Kore', languageCode: 'en-GB', style: 'Calm'};
    const result = await (await app.fetch(request(input))).json();
    assert.equal(result.audioBase64, 'AAAA'); assert.equal(result.mimeType, 'audio/l16');
    assert.equal(calls[0].init.headers['x-goog-api-key'], 'test-secret');
    const sent = JSON.parse(calls[0].init.body);
    assert.equal(sent.input[0].content[0].text, input.text);
    assert.match(sent.input[0].content[0].annotations[0].style, /en-GB/);
    assert.equal(sent.generation_config.speech_config[0].voice, 'Kore');
    const cached = await (await app.fetch(request(input))).json();
    assert.equal(cached.cached, true); assert.equal(calls.length, 1);
    assert.ok(!JSON.stringify(result).includes('test-secret'));
  } finally {globalThis.fetch = oldFetch;}
});

test('Cloud TTS loads official voices and maps language and selected ID to MP3 synthesis', async () => {
  const oldFetch = globalThis.fetch; const calls: any[] = [];
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({url, init});
    return Response.json(String(url).includes('/voices?') ? {voices: [{name: 'en-US-Neural2-F', languageCodes: ['en-US'], ssmlGender: 'FEMALE'}]} : {audioContent: 'YWJj'});
  }) as any;
  try {
    const app = router({GOOGLE_CLOUD_TTS_API_KEY: 'cloud-test-secret'});
    const result = await (await app.fetch(request({text: 'Cloud narration', voiceId: 'en-US-Neural2-F', languageCode: 'en-US', provider: 'google-cloud'}))).json();
    assert.equal(result.mimeType, 'audio/mpeg'); assert.equal(result.audioBase64, 'YWJj');
    assert.equal(calls[1].url, 'https://texttospeech.googleapis.com/v1/text:synthesize');
    const sent = JSON.parse(calls[1].init.body);
    assert.deepEqual(sent.voice, {languageCode: 'en-US', name: 'en-US-Neural2-F'});
    assert.equal(sent.audioConfig.audioEncoding, 'MP3');
    const mismatch = await app.fetch(request({text: 'Hello', voiceId: 'en-US-Standard-A', languageCode: 'en-US', provider: 'google-cloud'}));
    assert.equal(mismatch.status, 400);
  } finally {globalThis.fetch = oldFetch;}
});

test('provider errors become a safe fallback without leaking the Google response', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('secret key and private transcript', {status: 403})) as any;
  try {
    const result = await (await router({GEMINI_TTS_API_KEY: 'failed-test-key'}).fetch(request({text: 'Provider failure'}))).json();
    assert.equal(result.reason, 'provider_error'); assert.equal(result.useFallback, true);
    assert.ok(!JSON.stringify(result).includes('private transcript'));
  } finally {globalThis.fetch = oldFetch;}
});
