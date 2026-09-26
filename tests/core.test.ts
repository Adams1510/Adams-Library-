import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pcmToWav, audioBlob} from '../src/utils/audio.ts';
import {splitIntoParagraphs, resolveEpubPath} from '../src/utils/epubParser.ts';
import {AudiobookSpeechEngine} from '../src/services/speechEngine.ts';

test('long prose and unspaced text are chunked without truncation', () => {
  const text = Array.from({length: 2200}, (_, i) => `word${i}`).join(' ');
  const chunks = splitIntoParagraphs(text);
  assert.equal(chunks.join(' '), text);
  assert.ok(chunks.every(c => c.length <= 900));
  const unspaced = '中文'.repeat(2000);
  assert.equal(splitIntoParagraphs(unspaced).join(''), unspaced);
  assert.deepEqual(splitIntoParagraphs('one\r\n\r\ntwo'), ['one', 'two']);
  assert.deepEqual(splitIntoParagraphs(' \n\n'), []);
});
test('EPUB relative, URI-encoded and fragment paths resolve', () => {
  assert.equal(resolveEpubPath('EPUB/Package/', '../Text/chapter%201.xhtml#heading'), 'EPUB/Text/chapter 1.xhtml');
  assert.throws(() => resolveEpubPath('', 'https://example.com/chapter'));
});
test('PCM gets a valid mono 24kHz WAV header and retains samples', async () => {
  const pcm = new Uint8Array([0, 0, 255, 127, 0, 128]);
  const wav = pcmToWav(pcm), view = new DataView(wav.buffer);
  assert.equal(new TextDecoder().decode(wav.slice(0, 4)), 'RIFF');
  assert.equal(view.getUint32(24, true), 24000);
  assert.equal(view.getUint32(40, true), pcm.length);
  assert.deepEqual(wav.slice(44), pcm);
  assert.equal(audioBlob(btoa(String.fromCharCode(...pcm)), 'audio/L16;codec=pcm;rate=24000').type, 'audio/wav');
  assert.throws(() => pcmToWav(new Uint8Array(1)));
});

test('pause/resume retains the utterance; stale callbacks cannot advance another chapter', async () => {
  const utterances: any[] = [];
  const synth = {paused: false, getVoices: () => [], cancel() {this.paused = false;}, pause() {this.paused = true;}, resume() {this.paused = false;}, speak(value: any) {utterances.push(value);}};
  (globalThis as any).window = {speechSynthesis: synth};
  (globalThis as any).SpeechSynthesisUtterance = class {constructor(public text: string) {}};
  const engine = new AudiobookSpeechEngine();
  engine.loadChapter(['first paragraph', 'second paragraph']);
  await engine.play();
  const staleEnd = utterances[0].onend;
  engine.pause(); engine.resume();
  assert.equal(utterances.length, 1);
  engine.setPlaybackRate(1); assert.equal(utterances.length, 1);
  engine.loadChapter(['new book']); await engine.play();
  staleEnd();
  assert.equal(engine.getCurrentState().currentParagraphIndex, 0);
  assert.equal(utterances.at(-1).text, 'new book');
  engine.stop();
});
test('late AI response after stop or pause never starts playback or fallback', async () => {
  let complete: (value: any) => void = () => {};
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (() => new Promise(resolve => {complete = resolve;})) as any;
  const engine = new AudiobookSpeechEngine(); let fallback = 0;
  engine.setCallbacks({onEngineFallback: () => fallback++}); engine.setEngine('gemini');
  engine.loadChapter(['old chapter']); const playing = engine.play(); engine.pause();
  complete({ok: true, json: async () => ({useFallback: true})}); await playing;
  assert.equal(engine.getCurrentState().isPlaying, false); assert.equal(fallback, 0);
  engine.stop(); globalThis.fetch = previousFetch;
});
