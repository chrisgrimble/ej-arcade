'use strict';
// All sound is synthesised with WebAudio, so there are no asset files to host.
const sound = {
  ac: null, master: null, engineGain: null, engineOsc: [], engineFilter: null, muted: false, paused: false,

  // Browsers only allow audio to start from a user gesture.
  unlock() {
    if (this.ac) { if (!this.paused) this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ac = new AC();
    this.master = this.ac.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ac.destination);

    this.engineFilter = this.ac.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineGain = this.ac.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    for (const type of ['sawtooth', 'square']) {
      const o = this.ac.createOscillator();
      o.type = type;
      o.connect(this.engineFilter);
      o.start();
      this.engineOsc.push(o);
    }
  },

  // Suspending the context silences the engine and any effect still ringing out.
  setPaused(paused) {
    this.paused = paused;
    if (!this.ac) return;
    if (paused) this.ac.suspend();
    else this.ac.resume();
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
  },

  engine(pct, on) {
    if (!this.ac) return;
    const t = this.ac.currentTime;
    const f = 48 + pct * 150;
    this.engineOsc[0].frequency.setTargetAtTime(f, t, 0.05);
    this.engineOsc[1].frequency.setTargetAtTime(f * 0.503, t, 0.05);
    this.engineFilter.frequency.setTargetAtTime(350 + pct * 1100, t, 0.05);
    this.engineGain.gain.setTargetAtTime(on ? 0.1 + pct * 0.07 : 0, t, 0.06);
  },

  tone(freq, dur, type = 'square', vol = 0.22, delay = 0, slideTo = 0) {
    if (!this.ac) return;
    const t = this.ac.currentTime + delay;
    const o = this.ac.createOscillator();
    const g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur);
  },

  noise(dur, vol = 0.35, cutoff = 1200) {
    if (!this.ac) return;
    const len = Math.floor(this.ac.sampleRate * dur);
    const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ac.createBufferSource();
    const f = this.ac.createBiquadFilter();
    const g = this.ac.createGain();
    s.buffer = buf;
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    g.gain.value = vol;
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start();
  },

  beacon(mult) { this.tone(620 + mult * 110, 0.09); this.tone(930 + mult * 165, 0.1, 'square', 0.16, 0.05); },
  gate() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.3, i * 0.05)); },
  checkpoint() { [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'square', 0.2, i * 0.07)); },
  crash() { this.noise(0.6, 0.6, 900); this.tone(170, 0.45, 'sawtooth', 0.3, 0, 40); },
  glance() { this.noise(0.14, 0.4, 2400); this.tone(320, 0.14, 'square', 0.14, 0, 180); },
  splash() { this.noise(0.28, 0.3, 3200); },
  launch() { this.tone(240, 0.26, 'triangle', 0.3, 0, 720); },
  land() { this.noise(0.14, 0.4, 500); },
  boost() { this.tone(180, 0.4, 'sawtooth', 0.2, 0, 900); },
  tick() { this.tone(1100, 0.05, 'square', 0.16); },
  count(go) { this.tone(go ? 880 : 440, go ? 0.4 : 0.14, 'square', 0.24); },
  fanfare() { [523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'square', 0.2, i * 0.11)); },
  gameOver() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.3, i * 0.17)); },
};
