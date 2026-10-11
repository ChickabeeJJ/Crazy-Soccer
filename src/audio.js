// Procedural Web Audio: every sound is synthesised at runtime (no audio files to download).
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.vol = { master: 0.8, music: 0.45, sfx: 0.9 };
    this.muted = false;
    this.adMuted = false;
    this.musicOn = false;
    this.crowd = null;
    this.noiseBuf = null;
    this.lastPlay = new Map();
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setVolumes(v) { Object.assign(this.vol, v); this.applyVolumes(); }
  setMuted(m) { this.muted = m; this.applyVolumes(); }
  setAdMuted(m) { this.adMuted = m; this.applyVolumes(); }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.muted || this.adMuted ? 0 : this.vol.master;
    this.master.gain.setTargetAtTime(m, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.05);
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }

  ok(name, gap = 0.04) {
    if (!this.ctx || this.ctx.state !== 'running') return false;
    const t = this.ctx.currentTime;
    const last = this.lastPlay.get(name) || 0;
    if (t - last < gap) return false;
    this.lastPlay.set(name, t);
    return true;
  }

  env(gainNode, t, a, peak, d) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peak, t + a);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  tone(type, f0, f1, dur, vol, dest = this.sfxBus, delay = 0) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    this.env(g, t, 0.005, vol, dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur, vol, filterType, f0, f1, q = 1, delay = 0, dest = this.sfxBus) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = filterType;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    this.env(g, t, 0.005, vol, dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------ game sounds
  kick(power = 0.5) {
    if (!this.ok('kick')) return;
    this.tone('sine', 160 + power * 40, 45, 0.16, 0.7 + power * 0.3);
    this.noise(0.06, 0.4 + power * 0.3, 'bandpass', 2500, 800, 1.2);
    if (power > 0.7) this.noise(0.25, 0.25, 'lowpass', 3000, 300, 0.7);
  }
  pass() { if (this.ok('kick')) { this.tone('sine', 220, 70, 0.1, 0.45); this.noise(0.04, 0.25, 'bandpass', 3000, 1200, 1.5); } }
  bounce(v) { if (this.ok('bounce', 0.08)) this.tone('sine', 120, 50, 0.1, Math.min(0.5, v / 30)); }
  post() { if (this.ok('post', 0.1)) { this.tone('triangle', 880, 840, 0.5, 0.35); this.tone('sine', 1320, 1300, 0.4, 0.15); } }
  net() { if (this.ok('net', 0.2)) this.noise(0.35, 0.35, 'bandpass', 1200, 500, 0.8); }
  whistle(kind) {
    if (!this.ctx || !this.ok('whistle', 0.3)) return;
    const blasts = kind === 'end' ? [0, 0.35, 0.7] : kind === 'goal' ? [0] : [0];
    for (const d of blasts) {
      const c = this.ctx;
      const t = c.currentTime + d;
      const o = c.createOscillator();
      const lfo = c.createOscillator();
      const lg = c.createGain();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = 2900;
      lfo.frequency.value = 38;
      lg.gain.value = 140;
      lfo.connect(lg).connect(o.frequency);
      const len = kind === 'end' && d === 0.7 ? 0.6 : 0.26;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
      g.gain.setValueAtTime(0.28, t + len);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.05);
      o.connect(g).connect(this.sfxBus);
      o.start(t); lfo.start(t);
      o.stop(t + len + 0.1); lfo.stop(t + len + 0.1);
    }
  }
  goalHorn() {
    if (!this.ok('horn', 1)) return;
    for (const f of [220, 277, 330]) this.tone('sawtooth', f, f, 1.1, 0.12);
    this.cheer(1);
  }
  cheer(amount = 1) {
    if (!this.ctx) return;
    this.noise(2.4, 0.35 * amount, 'bandpass', 700, 1400, 0.6);
    this.noise(2.0, 0.2 * amount, 'highpass', 2000, 3500, 0.5, 0.1);
  }
  groan() { if (this.ctx) this.noise(1.2, 0.2, 'lowpass', 900, 300, 0.7); }
  tackle() { if (this.ok('tackle')) this.noise(0.35, 0.35, 'bandpass', 800, 300, 1); }
  thud() { if (this.ok('thud')) { this.tone('sine', 110, 40, 0.18, 0.6); this.noise(0.1, 0.25, 'lowpass', 600, 200); } }
  whoosh() { if (this.ok('whoosh')) this.noise(0.25, 0.3, 'bandpass', 600, 2400, 2); }
  pickup() { if (this.ok('pickup')) [660, 880, 1320].forEach((f, i) => this.tone('square', f, f, 0.08, 0.12, this.sfxBus, i * 0.06)); }
  item(kind) {
    if (!this.ok('item', 0.05)) return;
    switch (kind) {
      case 'fire': this.noise(0.6, 0.5, 'lowpass', 400, 3000, 0.8); this.tone('sawtooth', 90, 180, 0.4, 0.15); break;
      case 'ice': [1800, 2400, 3000].forEach((f, i) => this.tone('sine', f, f * 1.2, 0.15, 0.12, this.sfxBus, i * 0.04)); break;
      case 'oil': this.tone('sine', 300, 90, 0.25, 0.4); this.tone('sine', 250, 70, 0.2, 0.3, this.sfxBus, 0.12); break;
      case 'jet': this.noise(1.2, 0.35, 'bandpass', 500, 1600, 1); break;
      case 'grapple': this.tone('square', 1200, 300, 0.25, 0.15); break;
      case 'punch': this.tone('sine', 180, 600, 0.12, 0.4); this.tone('sine', 600, 120, 0.3, 0.3, this.sfxBus, 0.12); break;
      case 'speed': [500, 750, 1000, 1500].forEach((f, i) => this.tone('triangle', f, f, 0.07, 0.15, this.sfxBus, i * 0.05)); break;
      case 'shield': this.tone('sine', 400, 900, 0.5, 0.25); break;
      case 'barricade': this.tone('square', 220, 160, 0.12, 0.25); this.noise(0.15, 0.3, 'lowpass', 800, 300); break;
      case 'bazooka': this.noise(0.5, 0.4, 'lowpass', 900, 200, 0.9); this.tone('sawtooth', 160, 60, 0.4, 0.2); break;
      case 'shotgun': this.noise(0.35, 0.6, 'lowpass', 2500, 300, 1); this.tone('square', 120, 50, 0.2, 0.25); break;
      case 'flintlock': this.noise(0.2, 0.5, 'highpass', 1500, 600, 1); this.tone('square', 300, 80, 0.12, 0.2); break;
      case 'magnet': this.tone('sine', 120, 240, 0.6, 0.25); this.tone('sine', 360, 720, 0.6, 0.08); break;
      case 'mines': this.tone('square', 900, 900, 0.05, 0.12); this.tone('square', 900, 900, 0.05, 0.12, this.sfxBus, 0.12); break;
      default: this.tone('sine', 600, 900, 0.2, 0.2);
    }
  }
  freeze() { if (this.ok('freeze')) { this.noise(0.4, 0.3, 'highpass', 3000, 6000, 1); this.tone('sine', 2000, 900, 0.3, 0.12); } }
  slip() { if (this.ok('slip')) { this.tone('sine', 900, 200, 0.35, 0.3); } }
  boing() { if (this.ok('boing')) this.tone('sine', 220, 880, 0.18, 0.4); }
  tick() { if (this.ok('tick', 0.025)) this.tone('square', 1800, 1500, 0.025, 0.06); }
  reveal(big) { if (this.ok('reveal', 0.2)) { [523, 659, 784, big ? 1047 : 988].forEach((f, i) => this.tone('triangle', f, f, 0.16, 0.16, this.sfxBus, i * 0.07)); if (big) this.noise(0.6, 0.18, 'highpass', 4000, 9000, 1); } }
  click() { if (this.ok('click', 0.03)) this.tone('triangle', 900, 700, 0.05, 0.18); }
  hover() { if (this.ok('hover', 0.05)) this.tone('sine', 1200, 1200, 0.03, 0.05); }
  coins() { if (this.ok('coins', 0.2)) [1300, 1700, 2100, 2600].forEach((f, i) => this.tone('square', f, f, 0.06, 0.08, this.sfxBus, i * 0.07)); }
  beep(hi) { if (this.ok('beep', 0.2)) this.tone('square', hi ? 1320 : 880, hi ? 1320 : 880, hi ? 0.3 : 0.12, 0.15); }
  toast() { if (this.ok('toast', 0.1)) this.tone('triangle', 1000, 1500, 0.08, 0.12); }
  chat() { if (this.ok('chat', 0.1)) this.tone('sine', 700, 1000, 0.08, 0.15); }

  // --------------------------------------------------------- crowd ambience
  startCrowd() {
    if (!this.ctx || this.crowd) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 0.4;
    const g = c.createGain();
    g.gain.value = 0.05;
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 0.15; lg.gain.value = 0.02;
    lfo.connect(lg).connect(g.gain);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(); lfo.start();
    this.crowd = { src, lfo, g };
  }
  stopCrowd() {
    if (!this.crowd) return;
    try { this.crowd.src.stop(); this.crowd.lfo.stop(); } catch (e) { /* ignore */ }
    this.crowd = null;
  }

  // ---------------------------------------------------------- menu music
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextT = this.ctx.currentTime + 0.1;
    const bpm = 112;
    this.stepDur = 60 / bpm / 4;
    const chords = [[48, 55, 64, 67], [45, 52, 60, 64], [41, 48, 57, 60], [43, 50, 59, 62]];
    const melody = [76, -1, 79, 76, 74, -1, 72, -1, 74, 76, -1, 72, 69, -1, 67, -1];
    const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const tick = () => {
      if (!this.musicOn || !this.ctx) return;
      while (this.nextT < this.ctx.currentTime + 0.2) {
        const s = this.step;
        const bar = Math.floor(s / 16) % 4;
        const ch = chords[bar];
        const t = this.nextT;
        const d = t - this.ctx.currentTime;
        if (s % 4 === 0) this.tone('sine', 110, 45, 0.18, 0.5, this.musicBus, d);
        if (s % 8 === 4) this.noise(0.12, 0.25, 'highpass', 1800, 1800, 0.8, d, this.musicBus);
        if (s % 2 === 1) this.noise(0.03, 0.08, 'highpass', 7000, 7000, 0.8, d, this.musicBus);
        if (s % 4 === 0 || s % 16 === 10) this.tone('triangle', midi(ch[0] - 12), midi(ch[0] - 12), 0.22, 0.22, this.musicBus, d);
        if (s % 8 === 2 || s % 8 === 6) ch.slice(1).forEach((n) => this.tone('square', midi(n), midi(n), 0.08, 0.025, this.musicBus, d));
        const m = melody[s % 16];
        if (m > 0 && bar % 2 === 1) this.tone('triangle', midi(m), midi(m), 0.16, 0.06, this.musicBus, d);
        this.step++;
        this.nextT += this.stepDur;
      }
      this.musicTimer = setTimeout(tick, 60);
    };
    tick();
  }
  stopMusic() {
    this.musicOn = false;
    clearTimeout(this.musicTimer);
  }
}
