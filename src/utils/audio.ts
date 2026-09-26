export function pcmToWav(pcm: Uint8Array, sampleRate = 24000): Uint8Array {
  if (pcm.length % 2 || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new Error('Invalid PCM format.');
  const wav = new Uint8Array(44 + pcm.length), view = new DataView(wav.buffer);
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) wav[offset + i] = value.charCodeAt(i); };
  text(0, 'RIFF'); view.setUint32(4, 36 + pcm.length, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, pcm.length, true); wav.set(pcm, 44);
  return wav;
}

/** Gemini's raw signed little-endian PCM needs a WAV container for browsers. */
export function audioBlob(base64: string, mimeType: string): Blob {
  let bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  let type = mimeType;
  if (/audio\/(L16|pcm|raw)/i.test(type)) {
    bytes = pcmToWav(bytes, Number(/rate=(\d+)/i.exec(type)?.[1] || 24000));
    type = 'audio/wav';
  }
  return new Blob([bytes as BlobPart], {type});
}
