// audio.js — procedural sound for MERPATI SENJA, WebAudio only.
// One job: engine hum, wind rush, ring chime and crash thud, all
// synthesised at run time. No audio files are loaded, ever.

export class FlightAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.windSrc = null;
    this.windGain = null;
    this.windFilter = null;
  }

  /** Must be called from a user gesture at least once. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    // Engine: a low sawtooth through a low-pass, pitch follows throttle.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 62;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();

    // Wind: looped noise through a band-pass, loudness follows speed.
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.windSrc = this.ctx.createBufferSource();
    this.windSrc.buffer = buf;
    this.windSrc.loop = true;
    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 700;
    this.windFilter.Q.value = 0.6;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    this.windSrc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);
    this.windSrc.start();
  }

  /** Call every frame: engine note + wind follow throttle and speed. */
  update(throttle, speedMs, flying) {
    if (!this.ctx || this.muted) {
      if (this.engineGain) this.engineGain.gain.value = 0;
      if (this.windGain) this.windGain.gain.value = 0;
      return;
    }
    const t = this.ctx.currentTime;
    const target = flying ? 0.05 + throttle * 0.06 : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(52 + throttle * 58, t, 0.1);
    this.windGain.gain.setTargetAtTime(flying ? Math.min(0.12, speedMs * 0.0011) : 0, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(500 + speedMs * 9, t, 0.15);
  }

  /** Two-note chime when a ring is threaded. */
  chime() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    for (const [freq, when, dur] of [[880, 0, 0.28], [1318, 0.09, 0.4]]) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t + when);
      g.gain.linearRampToValueAtTime(0.22, t + when + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + when + dur);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start(t + when);
      o.stop(t + when + dur + 0.05);
    }
  }

  /** Noise burst + low thud on a crash. */
  crash() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    src.connect(g);
    g.connect(this.ctx.destination);
    src.start(t);
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.4);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.4, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(og);
    og.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + 0.5);
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) {
      if (m) {
        if (this.engineGain) this.engineGain.gain.value = 0;
        if (this.windGain) this.windGain.gain.value = 0;
      }
    }
  }
}
