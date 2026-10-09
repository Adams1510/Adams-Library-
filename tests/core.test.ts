import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pcmToWav, audioBlob} from '../src/utils/audio.ts';
import {splitIntoParagraphs, resolveEpubPath} from '../src/utils/epubParser.ts';
import {AudiobookSpeechEngine} from '../src/services/speechEngine.ts';
import {narrationText, bilingualRuns, markedSsml, validTimepoints} from '../src/utils/narrationText.ts';

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
  engine.setEngine('browser');
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

test('Google audio is primary; only a failed backend request uses device speech with the chosen language', async () => {
  const previousFetch = globalThis.fetch;
  const previousAudio = (globalThis as any).Audio;
  let audioPlays = 0; const utterances: any[] = []; const requests: any[] = [];
  (globalThis as any).window = {speechSynthesis: {getVoices: () => [], cancel() {}, speak(value: any) {utterances.push(value);}}};
  (globalThis as any).Audio = class {playbackRate = 1; currentTime = 0; constructor(public src: string) {} async play() {audioPlays++;} pause() {} removeAttribute() {}};
  try {
    globalThis.fetch = (async (_url: any, init: any) => {requests.push(JSON.parse(init.body)); return Response.json({audioBase64: 'YWJj', mimeType: 'audio/mpeg'});}) as any;
    const engine = new AudiobookSpeechEngine();
    engine.setEngine('google-cloud', 'en-GB-Neural2-A'); engine.setLanguageCode('en-GB');
    engine.loadChapter(['Successful Google audio']); await engine.play(); engine.stop();
    assert.equal(audioPlays, 1); assert.equal(utterances.length, 0);
    assert.equal(requests[0].provider, 'google-cloud'); assert.equal(requests[0].voiceId, 'en-GB-Neural2-A'); assert.equal(requests[0].languageCode, 'en-GB');
    globalThis.fetch = (async () => Response.json({useFallback: true, message: 'No server key'})) as any;
    engine.loadChapter(['Fallback paragraph']); await engine.play();
    assert.equal(utterances.length, 1); assert.equal(utterances[0].lang, 'en-GB'); engine.stop();
  } finally {globalThis.fetch = previousFetch; (globalThis as any).Audio = previousAudio;}
});

test('word tracking preserves punctuation and Unicode offsets and escapes SSML input', () => {
  const text = 'Hello, café! Next: أحمد & <reader>.';
  const {words,sentences}=narrationText(text);
  for(const word of words)assert.equal(text.slice(word.start,word.end),word.text);
  assert.equal(words[2].sentenceIndex,1);
  assert.equal(sentences.map(s=>s.text).join(''),text);
  const ssml=markedSsml(text); assert.ok(ssml.includes('&amp;')); assert.ok(ssml.includes('&lt;')); assert.ok(!ssml.includes('<reader>'));
  assert.deepEqual(validTimepoints([{wordIndex:0,timeSeconds:0}],2),[]);
  assert.deepEqual(validTimepoints([{wordIndex:0,timeSeconds:2},{wordIndex:1,timeSeconds:1}],2),[]);
});

test('device word boundaries highlight exactly, ignore paused/stale events, and retain the word when speed changes', async () => {
  const utterances: any[] = [], positions: any[] = [];
  const synth={paused:false,getVoices:()=>[],speak(u:any){utterances.push(u);},cancel(){this.paused=false;},pause(){this.paused=true;},resume(){this.paused=false;}};
  (globalThis as any).window={speechSynthesis:synth};
  (globalThis as any).SpeechSynthesisUtterance=class{constructor(public text:string){}};
  const engine=new AudiobookSpeechEngine(); engine.setEngine('browser'); engine.setCallbacks({onWordChange:p=>positions.push(p)});
  engine.loadChapter(['Hello, café! Next sentence.']);await engine.play();
  const first=utterances[0], staleBoundary=first.onboundary;
  first.onstart();first.onboundary({name:'word',charIndex:7});
  assert.equal(positions.at(-1).word,'café');assert.equal(positions.at(-1).timing,'boundary');
  const count=positions.length;engine.pause();first.onboundary({name:'word',charIndex:13});assert.equal(positions.length,count);
  engine.resume();engine.setPlaybackRate(1.5);assert.equal(utterances.at(-1).text,'café! Next sentence.');
  utterances.at(-1).onboundary({name:'word',charIndex:6});assert.equal(positions.at(-1).word,'Next');assert.equal(positions.at(-1).sentenceIndex,1);
  staleBoundary({name:'word',charIndex:0});assert.equal(positions.at(-1).word,'Next');engine.stop();
});

test('timestamp alignment follows media time and a seek within audio preserves the clip', async () => {
  const previousFetch=globalThis.fetch,previousAudio=(globalThis as any).Audio;
  const positions:any[]=[],audios:any[]=[];
  (globalThis as any).window={speechSynthesis:{cancel(){}}};
  (globalThis as any).Audio=class{playbackRate=1;currentTime=0;duration=3;paused=false;readyState=4;ended=false;onloadedmetadata:any;onplaying:any;
    constructor(public src:string){audios.push(this);}async play(){this.onloadedmetadata?.();this.onplaying?.();}pause(){this.paused=true;}removeAttribute(){} };
  globalThis.fetch=(async()=>Response.json({audioBase64:'YWJj',mimeType:'audio/mpeg',wordTimepoints:[{wordIndex:0,timeSeconds:0},{wordIndex:1,timeSeconds:1},{wordIndex:2,timeSeconds:2}]}))as any;
  const engine=new AudiobookSpeechEngine();engine.setCallbacks({onWordChange:p=>positions.push(p)});
  try{engine.loadChapter(['one two three']);await engine.play();engine.seekToFraction(.5);assert.equal(audios.length,1);assert.equal(audios[0].currentTime,1.5);assert.equal(positions.at(-1).word,'two');assert.equal(positions.at(-1).timing,'timestamp');engine.pause();assert.equal(engine.getVisualization().energy,0);}
  finally{engine.stop();globalThis.fetch=previousFetch;(globalThis as any).Audio=previousAudio;}
});

test('mixed Arabic and English switch device voices without translating or losing offsets', async () => {
  const text='English first. السَّلَامُ عَلَيْكُمْ، then English again.';
  const runs=bilingualRuns(text);assert.deepEqual(runs.map(r=>r.language),['en','ar','en']);assert.equal(runs.map(r=>r.text).join(''),text);
  const voices=[{voiceURI:'english',lang:'en-US',default:true},{voiceURI:'arabic',lang:'ar-EG'}] as any;
  const utterances:any[]=[],positions:any[]=[];
  (globalThis as any).window={speechSynthesis:{paused:false,getVoices:()=>voices,speak(u:any){utterances.push(u);},cancel(){},pause(){this.paused=true;},resume(){this.paused=false;}}};
  (globalThis as any).SpeechSynthesisUtterance=class{constructor(public text:string){}};
  const engine=new AudiobookSpeechEngine();engine.setEngine('browser');engine.setBrowserVoice(voices[0]);engine.setArabicVoiceURI('arabic');engine.setCallbacks({onWordChange:p=>positions.push(p)});
  engine.loadChapter([text]);await engine.play();
  assert.equal(utterances[0].voice.voiceURI,'english');utterances[0].onend();
  assert.equal(utterances[1].voice.voiceURI,'arabic');assert.equal(utterances[1].lang,'ar-EG');
  utterances[1].onstart();utterances[1].onboundary({name:'word',charIndex:0});
  assert.equal(positions.at(-1).word,narrationText(text).words.find(w=>/\p{Script=Arabic}/u.test(w.text))!.text);
  const end=utterances[1].onend;engine.pause();end();assert.equal(utterances.length,2);engine.resume();end();
  assert.equal(utterances[2].voice.voiceURI,'english');assert.equal(utterances.map(u=>u.text).join(''),text);
  engine.loadChapter(['Another chapter']);end();assert.equal(utterances.length,3);engine.stop();
});

test('missing Arabic voices stop with a useful message rather than choosing an English voice', async () => {
  let message='',spoken=0;
  (globalThis as any).window={speechSynthesis:{getVoices:()=>[{voiceURI:'english',lang:'en-US'}],speak(){spoken++;},cancel(){}}};
  const engine=new AudiobookSpeechEngine();engine.setEngine('browser');engine.setCallbacks({onError:m=>message=m});
  engine.loadChapter(['English and العربية']);await engine.play();
  assert.equal(spoken,0);assert.match(message,/Arabic device voice/);assert.equal(engine.getCurrentState().isPlaying,false);engine.stop();
});
