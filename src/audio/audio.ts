// 程序化音频：风、篝火噼啪、脚步、砍伐、凿石、夜虫、黄昏警钟、低语、民谣拨弦（原创，非采样）
export class Audio {
  ctx: AudioContext | null = null;
  master!: GainNode; sfx!: GainNode; amb!: GainNode; music!: GainNode;
  private noiseBuf!: AudioBuffer;
  private windGain!: GainNode; private windFilter!: BiquadFilterNode;
  private fireGain!: GainNode;
  private nightGain!: GainNode;
  private whisperGain!: GainNode;
  private crickets: OscillatorNode[] = [];
  private nextNote = 0;
  private musicOn = true;
  muted = false;
  fireLevel = 0;
  nightLevel = 0;
  whisperLevel = 0;
  windLevel = 0.5;

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.master);
    this.amb = ctx.createGain(); this.amb.gain.value = 0.6; this.amb.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 0.22; this.music.connect(this.master);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.5 + b * 2.5; }
    // 风
    const wind = this.loopNoise();
    this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 400; this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0.0;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.amb);
    // 火的底噪（低沉的呼呼声）
    const fire = this.loopNoise();
    const ff = ctx.createBiquadFilter(); ff.type = 'lowpass'; ff.frequency.value = 280;
    this.fireGain = ctx.createGain(); this.fireGain.gain.value = 0;
    fire.connect(ff).connect(this.fireGain).connect(this.amb);
    // 夜虫：调幅的高频正弦
    this.nightGain = ctx.createGain(); this.nightGain.gain.value = 0; this.nightGain.connect(this.amb);
    for (const f of [4200, 4870, 3900]) {
      const o = ctx.createOscillator(); o.frequency.value = f;
      const am = ctx.createGain(); am.gain.value = 0;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 18 + Math.random() * 10;
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.02;
      const slow = ctx.createOscillator(); slow.frequency.value = 0.3 + Math.random() * 0.4;
      const slowG = ctx.createGain(); slowG.gain.value = 0.02;
      lfo.connect(lfoG).connect(am.gain); slow.connect(slowG).connect(am.gain);
      o.connect(am).connect(this.nightGain);
      o.start(); lfo.start(); slow.start();
      this.crickets.push(o);
    }
    // 低语：共振峰滤波的噪声
    const wh = this.loopNoise();
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 700; f1.Q.value = 8;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1500; f2.Q.value = 10;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 3.3; const lg = ctx.createGain(); lg.gain.value = 300;
    lfo.connect(lg).connect(f1.frequency); lfo.start();
    this.whisperGain = ctx.createGain(); this.whisperGain.gain.value = 0;
    wh.connect(f1).connect(this.whisperGain); wh.connect(f2).connect(this.whisperGain);
    this.whisperGain.connect(this.amb);
    this.nextNote = ctx.currentTime + 1.5;
  }

  private loopNoise(): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = true;
    s.loopStart = Math.random(); s.start(0, Math.random() * 1.5);
    return s;
  }

  setMuted(m: boolean) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.8; }

  private noiseBurst(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass', when = 0, dest?: AudioNode) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(dest ?? this.sfx);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', when = 0, slide = 0, dest?: AudioNode) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(dest ?? this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }
  /** Karplus-Strong 拨弦（似古琴/三弦） */
  private pluck(freq: number, when: number, gain: number) {
    const ctx = this.ctx; if (!ctx) return;
    const sr = ctx.sampleRate, dur = 2.2;
    const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const d = buf.getChannelData(0);
    const N = Math.floor(sr / freq);
    const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < d.length; i++) {
      const nx = (idx + 1) % N;
      const v = (ring[idx] + ring[nx]) * 0.4985;
      d[i] = ring[idx];
      ring[idx] = v;
      idx = nx;
    }
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
    const g = ctx.createGain(); g.gain.value = gain;
    s.connect(f).connect(g).connect(this.music);
    s.start(ctx.currentTime + when);
  }

  footstep(surface: number) {
    this.noiseBurst(0.08, surface === 2 ? 1800 : surface === 3 ? 500 : 900, 1.2, 0.18, 'bandpass');
    if (surface === 3) this.noiseBurst(0.12, 300, 2, 0.08, 'lowpass', 0.02);
  }
  chop() { this.tone(140, 0.18, 0.5, 'triangle', 0, 0.5); this.noiseBurst(0.12, 1200, 1.5, 0.35); }
  treeFall() { this.tone(80, 0.9, 0.5, 'sawtooth', 0.05, 0.4); this.noiseBurst(0.9, 300, 0.7, 0.5, 'lowpass', 0.05); for (let i = 0; i < 5; i++) this.noiseBurst(0.1, 2000 + Math.random() * 2000, 2, 0.12, 'bandpass', 0.1 + i * 0.07); }
  mine() { this.tone(1800 + Math.random() * 400, 0.25, 0.18, 'square', 0, 0.6); this.noiseBurst(0.08, 3000, 3, 0.3); this.tone(220, 0.12, 0.3, 'triangle', 0, 0.5); }
  rockBreak() { this.noiseBurst(0.6, 600, 0.6, 0.6, 'lowpass'); this.tone(90, 0.4, 0.4, 'triangle', 0, 0.5); }
  pick() { this.noiseBurst(0.12, 2600, 1, 0.2, 'highpass'); this.tone(660, 0.08, 0.08, 'sine', 0.05, 1.5); }
  pop() { this.tone(520, 0.09, 0.22, 'sine', 0, 2.2); this.tone(1040, 0.06, 0.08, 'sine', 0.03, 1.5); }
  ui() { this.tone(1300, 0.04, 0.08, 'triangle'); }
  uiOpen() { this.tone(700, 0.08, 0.1, 'triangle'); this.tone(1050, 0.08, 0.08, 'triangle', 0.05); }
  craft() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, 0.16, 'triangle', i * 0.07)); this.noiseBurst(0.3, 4000, 1, 0.05, 'highpass'); }
  equip() { this.noiseBurst(0.1, 1500, 1, 0.2); this.tone(400, 0.1, 0.1, 'triangle', 0.02, 1.4); }
  eat() { for (let i = 0; i < 3; i++) this.noiseBurst(0.07, 900 + Math.random() * 400, 2, 0.25, 'bandpass', i * 0.13); }
  swing() { this.noiseBurst(0.18, 1400, 0.8, 0.2, 'bandpass'); }
  hit() { this.tone(120, 0.15, 0.5, 'square', 0, 0.4); this.noiseBurst(0.1, 800, 1, 0.4); }
  hurt() { this.tone(300, 0.3, 0.35, 'sawtooth', 0, 0.45); this.noiseBurst(0.2, 500, 1, 0.4, 'lowpass'); }
  spiderHiss() { this.noiseBurst(0.45, 5000, 2, 0.25, 'bandpass'); this.tone(90, 0.3, 0.12, 'sawtooth', 0, 1.6); }
  spiderDie() { this.noiseBurst(0.35, 2500, 3, 0.3); this.tone(400, 0.4, 0.2, 'sawtooth', 0, 0.3); }
  ignite() { this.noiseBurst(0.6, 900, 0.5, 0.4, 'lowpass'); this.noiseBurst(0.3, 3000, 1, 0.15, 'highpass', 0.1); }
  shadowStrike() { this.tone(60, 0.6, 0.5, 'sawtooth', 0, 0.5); this.noiseBurst(0.4, 1200, 4, 0.5, 'bandpass'); this.tone(1400, 0.3, 0.08, 'sine', 0.05, 0.3); }
  /** 黄昏警示：低沉的钟与不协和泛音 */
  duskStinger() {
    const t = 0;
    this.tone(110, 3.5, 0.35, 'sine', t); this.tone(116.5, 3.5, 0.18, 'sine', t);
    this.tone(220, 2.8, 0.12, 'triangle', t + 0.02); this.tone(311, 2.4, 0.06, 'sine', t + 0.05);
    this.noiseBurst(1.6, 200, 0.5, 0.15, 'lowpass');
  }
  nightStinger() { this.tone(73, 4, 0.35, 'sine'); this.tone(77.8, 4, 0.2, 'sine'); this.tone(146, 3, 0.08, 'triangle', 0.3); }
  dawn() { [392, 523, 587, 784].forEach((f, i) => this.pluck(f, i * 0.25, 0.25)); }
  death() { this.tone(220, 2.5, 0.3, 'triangle', 0, 0.5); this.tone(207, 2.5, 0.2, 'triangle', 0.2, 0.5); this.tone(110, 3, 0.3, 'sine', 0.4, 0.5); }

  /** 每帧更新环境层与音乐 */
  update(dt: number, phase: string, danger: number) {
    const ctx = this.ctx; if (!ctx) return;
    const now = ctx.currentTime;
    const k = 1 - Math.exp(-dt * 2);
    this.windGain.gain.value += ((0.05 + this.windLevel * 0.12) - this.windGain.gain.value) * k;
    this.windFilter.frequency.value = 300 + Math.sin(now * 0.2) * 150 + Math.sin(now * 0.07) * 100;
    this.fireGain.gain.value += (this.fireLevel * 0.5 - this.fireGain.gain.value) * k;
    this.nightGain.gain.value += (this.nightLevel * 0.25 - this.nightGain.gain.value) * k;
    this.whisperGain.gain.value += (this.whisperLevel * 0.35 - this.whisperGain.gain.value) * k;
    // 噼啪
    if (this.fireLevel > 0.02 && Math.random() < dt * 14 * this.fireLevel) {
      this.noiseBurst(0.02 + Math.random() * 0.04, 1500 + Math.random() * 4000, 3, 0.25 * this.fireLevel * (0.4 + Math.random()), 'bandpass', 0, this.amb);
    }
    // 民谣拨弦：白天五声音阶的稀疏旋律；夜里只剩低音
    if (this.musicOn && now > this.nextNote - 0.1) {
      const scale = phase === 'night' ? [110, 130.8, 146.8, 164.8] : [196, 220, 261.6, 293.7, 329.6, 392, 440];
      const n = scale[Math.floor(Math.random() * scale.length)];
      const when = Math.max(0, this.nextNote - now);
      if (danger < 0.5) this.pluck(n, when, phase === 'night' ? 0.18 : 0.22);
      if (Math.random() < 0.3 && phase !== 'night') this.pluck(n * 1.5, when + 0.18, 0.12);
      this.nextNote = now + when + (phase === 'night' ? 2.6 : 0.6 + Math.random() * 1.4) * (Math.random() < 0.15 ? 3 : 1);
    }
  }
}
