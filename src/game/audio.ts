import type { MaterialId } from '../physics/materials';
import type { SurfaceId } from '../physics/surfaces';

/**
 * Procedural WebAudio. Every material has its own voice for transforms, jumps and
 * a continuous rolling/air bed, so state is audible even when the screen is busy.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private bedGain!: GainNode;
  private bedFilter!: BiquadFilterNode;
  private humOsc!: OscillatorNode;
  private humGain!: GainNode;
  volume = 0.7;

  /** Must be called from a user gesture. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Continuous bed: filtered noise for rolling/wind + a hum for zero-g/lava.
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    this.bedFilter = ctx.createBiquadFilter();
    this.bedFilter.type = 'bandpass';
    this.bedFilter.Q.value = 1.2;
    this.bedGain = ctx.createGain();
    this.bedGain.gain.value = 0;
    src.connect(this.bedFilter).connect(this.bedGain).connect(this.master);
    src.start();
    this.humOsc = ctx.createOscillator();
    this.humOsc.type = 'sine';
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0;
    this.humOsc.connect(this.humGain).connect(this.master);
    this.humOsc.start();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    void this.ctx?.resume();
  }

  /** Per-frame continuous sound driven by physical state. */
  updateBed(material: MaterialId, speed: number, grounded: boolean, inFluid: boolean): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const s = Math.min(speed / 900, 1);
    let freq = 400;
    let gain = 0;
    let hum = 0;
    let humF = 60;
    switch (material) {
      case 'ice':
        freq = 2800 + s * 2000;
        gain = grounded ? s * 0.09 : 0;
        break;
      case 'oil':
        freq = 1400 + s * 800;
        gain = grounded ? s * 0.08 : 0;
        break;
      case 'mud':
        freq = 180 + s * 200;
        gain = grounded ? s * 0.25 : 0;
        break;
      case 'water':
        freq = 500 + s * 300;
        gain = (grounded ? s * 0.08 : 0) + (inFluid ? 0.04 : 0);
        break;
      case 'wind':
        freq = 900 + s * 1500;
        gain = 0.03 + s * 0.08;
        break;
      case 'lava':
        freq = 250;
        gain = 0.03 + s * 0.05;
        hum = 0.05;
        humF = 55;
        break;
      case 'zerog':
        freq = 3000;
        gain = 0.01;
        hum = 0.04;
        humF = 220 + s * 220;
        break;
      default:
        freq = 700 + s * 500;
        gain = grounded ? s * 0.07 : s * 0.02;
    }
    this.bedFilter.frequency.setTargetAtTime(freq, t, 0.05);
    this.bedGain.gain.setTargetAtTime(gain, t, 0.08);
    this.humOsc.frequency.setTargetAtTime(humF, t, 0.1);
    this.humGain.gain.setTargetAtTime(hum, t, 0.2);
  }

  silenceBed(): void {
    if (!this.ctx) return;
    this.bedGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    this.humGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private hiss(freq: number, q: number, dur: number, vol: number, sweepTo?: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  jump(material: MaterialId): void {
    switch (material) {
      case 'water':
        this.tone('sine', 300, 700, 0.14, 0.18);
        break;
      case 'ice':
        this.tone('triangle', 1200, 1800, 0.08, 0.1);
        break;
      case 'mud':
        this.tone('sine', 120, 200, 0.12, 0.25);
        this.hiss(400, 2, 0.1, 0.1);
        break;
      case 'wind':
        this.hiss(800, 1, 0.25, 0.12, 2400);
        break;
      case 'lava':
        this.tone('sawtooth', 200, 90, 0.18, 0.06);
        break;
      default:
        this.tone('sine', 260, 520, 0.12, 0.16);
    }
  }

  airImpulse(material: MaterialId): void {
    if (material === 'water') {
      this.tone('sine', 220, 440, 0.12, 0.14);
      this.hiss(700, 3, 0.12, 0.06);
    } else {
      this.tone('sine', 500, 1200, 0.16, 0.12);
      this.hiss(3000, 2, 0.15, 0.05, 6000);
    }
  }

  impact(speed: number, surface: SurfaceId, material: MaterialId): void {
    const v = Math.min(speed / 1200, 1);
    if (v < 0.1) return;
    const vol = 0.05 + v * 0.25;
    if (surface === 'bouncer') {
      this.tone('square', 180, 720, 0.18, 0.1);
      return;
    }
    switch (material) {
      case 'ice':
        this.tone('triangle', 1600 + v * 800, 1300, 0.12, vol * 0.6);
        this.tone('sine', 2400, 2200, 0.2, vol * 0.3, 0.01);
        break;
      case 'mud':
        this.tone('sine', 90, 50, 0.18, vol * 1.3);
        this.hiss(300, 1, 0.15, vol * 0.5);
        break;
      case 'water':
        this.hiss(900, 1.5, 0.2, vol * 0.6, 300);
        break;
      case 'oil':
        this.tone('sine', 160, 110, 0.1, vol * 0.8);
        break;
      case 'lava':
        this.hiss(2000, 0.8, 0.2, vol * 0.5);
        this.tone('sine', 100, 60, 0.15, vol * 0.6);
        break;
      default:
        this.tone('sine', 150 + v * 60, 70, 0.12, vol);
        if (surface === 'metal') this.tone('triangle', 900, 850, 0.25, vol * 0.3);
    }
  }

  transform(to: MaterialId, effect?: string): void {
    if (effect === 'steam') {
      this.hiss(3000, 0.7, 0.7, 0.35, 800);
      return;
    }
    switch (to) {
      case 'water':
        [0, 0.07, 0.14].forEach((d, i) => this.tone('sine', 400 + i * 150, 250, 0.2, 0.15, d));
        break;
      case 'oil':
        this.tone('sine', 180, 90, 0.35, 0.2);
        this.hiss(1200, 4, 0.3, 0.06, 500);
        break;
      case 'ice':
        [0, 0.05, 0.1].forEach((d, i) => this.tone('triangle', 1400 + i * 400, 1500 + i * 400, 0.25, 0.1, d));
        break;
      case 'lava':
        this.tone('sawtooth', 70, 140, 0.5, 0.12);
        this.hiss(1500, 0.6, 0.5, 0.18);
        break;
      case 'zerog':
        this.tone('sine', 300, 1200, 0.6, 0.12);
        this.tone('sine', 450, 1800, 0.6, 0.06, 0.05);
        break;
      case 'mud':
        this.tone('sine', 100, 55, 0.4, 0.3);
        this.hiss(250, 1.5, 0.35, 0.12);
        break;
      case 'wind':
        this.hiss(500, 0.8, 0.6, 0.2, 3000);
        break;
      default:
        this.tone('sine', 520, 390, 0.25, 0.12);
    }
  }

  breakSound(surface: SurfaceId): void {
    if (surface === 'frost') {
      this.hiss(4000, 1, 0.4, 0.2, 1500);
      this.tone('triangle', 2000, 1200, 0.3, 0.08);
    } else {
      this.hiss(600, 0.7, 0.35, 0.35);
      this.tone('square', 120, 60, 0.2, 0.1);
    }
  }

  checkpoint(): void {
    this.tone('sine', 523, 523, 0.12, 0.12);
    this.tone('sine', 784, 784, 0.25, 0.12, 0.09);
  }

  fragment(): void {
    [0, 0.06, 0.12, 0.18].forEach((d, i) => this.tone('triangle', 880 * Math.pow(1.26, i), 880 * Math.pow(1.26, i), 0.18, 0.09, d));
  }

  death(): void {
    this.tone('square', 300, 60, 0.35, 0.1);
    this.hiss(800, 0.8, 0.3, 0.15, 200);
  }

  win(): void {
    [0, 0.1, 0.2, 0.35].forEach((d, i) => this.tone('triangle', [523, 659, 784, 1046][i], [523, 659, 784, 1046][i], 0.35, 0.12, d));
  }

  ui(): void {
    this.tone('sine', 660, 660, 0.05, 0.05);
  }
}
