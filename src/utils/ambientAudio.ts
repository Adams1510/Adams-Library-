// Web Audio API ambient sound generator (Self-contained, zero external asset dependencies)

class AmbientSoundEngine {
  private ctx: AudioContext | null = null;
  private currentType: string = 'none';
  private gainNode: GainNode | null = null;
  private activeNodes: (AudioNode | number)[] = [];

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setSound(type: 'none' | 'rain' | 'library' | 'stream' | 'waves', volume: number = 0.3) {
    this.stop();
    if (type === 'none') {
      this.currentType = 'none';
      return;
    }

    try {
      this.initContext();
      if (!this.ctx) return;

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(Math.max(0.01, Math.min(1, volume * 0.25)), this.ctx.currentTime);
      this.gainNode.connect(this.ctx.destination);
      this.currentType = type;

      if (type === 'rain') {
        this.createRainSound();
      } else if (type === 'library') {
        this.createLibrarySound();
      } else if (type === 'stream') {
        this.createStreamSound();
      } else if (type === 'waves') {
        this.createWavesSound();
      }
    } catch (e) {
      console.warn('Could not initialize ambient sound:', e);
    }
  }

  public setVolume(volume: number) {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(Math.max(0.001, Math.min(1, volume * 0.25)), this.ctx.currentTime);
    }
  }

  public stop() {
    this.activeNodes.forEach(node => {
      if (typeof node === 'number') {
        clearInterval(node);
      } else {
        try {
          (node as any).stop?.();
          node.disconnect();
        } catch {}
      }
    });
    this.activeNodes = [];
    this.currentType = 'none';
  }

  private createNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private createRainSound() {
    if (!this.ctx || !this.gainNode) return;
    const buffer = this.createNoiseBuffer();
    if (!buffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // Pink / Low-pass filter for soothing steady rain
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(this.gainNode);
    noise.start();
    this.activeNodes.push(noise, filter);
  }

  private createLibrarySound() {
    if (!this.ctx || !this.gainNode) return;
    const buffer = this.createNoiseBuffer();
    if (!buffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // Deep warm brown noise
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(this.gainNode);
    noise.start();
    this.activeNodes.push(noise, filter);
  }

  private createStreamSound() {
    if (!this.ctx || !this.gainNode) return;
    const buffer = this.createNoiseBuffer();
    if (!buffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(700, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(this.gainNode);
    noise.start();
    this.activeNodes.push(noise, filter);
  }

  private createWavesSound() {
    if (!this.ctx || !this.gainNode) return;
    const buffer = this.createNoiseBuffer();
    if (!buffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);

    const waveLfo = this.ctx.createOscillator();
    waveLfo.frequency.setValueAtTime(0.12, this.ctx.currentTime); // ~8s swell period

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(300, this.ctx.currentTime);

    waveLfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    noise.connect(filter);
    filter.connect(this.gainNode);

    noise.start();
    waveLfo.start();
    this.activeNodes.push(noise, filter, waveLfo, lfoGain);
  }
}

export const ambientSound = new AmbientSoundEngine();
