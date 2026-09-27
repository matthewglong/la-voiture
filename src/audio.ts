// Procedural Web Audio: engines, bumps, wind, splash, countdown, UI blips and a crowd cheer.
// The AudioContext is created on the first user gesture only (no autoplay warnings). M mutes.

export type EngineKind = 'mower' | 'v8' | 'jet';

export interface EngineVoice {
  /** Speed in m/s and whether the engine is burning fuel. */
  set(speed: number, running: boolean, wheelspin: boolean): void;
  stop(): void;
}

export interface WindVoice {
  set(airspeed: number): void;
  stop(): void;
}

const NOOP_ENGINE: EngineVoice = { set: () => {}, stop: () => {} };
const NOOP_WIND: WindVoice = { set: () => {}, stop: () => {} };

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private analyser: AnalyserNode | null = null;
  private readonly probe = new Float32Array(2048);
  private _muted = false;
  private readonly listeners = new Set<(muted: boolean) => void>();

  get muted(): boolean {
    return this._muted;
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Call from a trusted user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 0.8;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      // Pass-through level meter on the output (lets the test hooks prove sound plays and M mutes).
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.master.connect(comp).connect(this.analyser).connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < len; i++) {
        seed = (seed * 16807) % 2147483647;
        d[i] = (seed / 2147483647) * 2 - 1;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** RMS level of the output right now (0 when silent, muted or not started). */
  level(): number {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.probe);
    let sum = 0;
    for (const v of this.probe) sum += v * v;
    return Math.sqrt(sum / this.probe.length);
  }

  onMuteChange(fn: (muted: boolean) => void): void {
    this.listeners.add(fn);
  }

  setMuted(m: boolean): void {
    this._muted = m;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.03);
    }
    for (const fn of this.listeners) fn(m);
  }

  toggleMute(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  private noiseSource(): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noise) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.loopStart = Math.random() * 1.5;
    return src;
  }

  private envGain(peak: number, attack: number, decay: number, at = 0): GainNode | null {
    if (!this.ctx) return null;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime + at;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  private tone(freq: number, dur: number, type: OscillatorType, peak: number, at = 0, glideTo?: number): void {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    const t = this.ctx.currentTime + at;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    const g = this.envGain(peak, 0.005, dur, at)!;
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  click(): void {
    this.tone(1250, 0.05, 'triangle', 0.12);
  }

  /** READY: a bright rising pair of notes (a falling pair when a player goes back to editing). */
  readyChime(on: boolean): void {
    this.tone(on ? 784 : 1047, 0.08, 'triangle', 0.13);
    this.tone(on ? 1175 : 698, 0.16, 'triangle', 0.13, 0.08);
  }

  /** A part the player can't afford: a short low buzz. */
  deny(): void {
    this.tone(190, 0.12, 'square', 0.06, 0, 150);
  }

  /** Countdown beep; `go` is the long high one. */
  beep(go: boolean): void {
    if (go) {
      this.tone(988, 0.55, 'square', 0.12);
      this.tone(1976, 0.5, 'sine', 0.05);
    } else {
      this.tone(659, 0.18, 'square', 0.1);
    }
  }

  thump(pan = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(this.master);
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    const g = this.envGain(0.7, 0.004, 0.22)!;
    o.connect(g).connect(p);
    o.start(t);
    o.stop(t + 0.3);
    const n = this.noiseSource();
    if (n) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 2400;
      f.Q.value = 0.8;
      const gn = this.envGain(0.25, 0.002, 0.06)!;
      n.connect(f).connect(gn).connect(p);
      n.start(t);
      n.stop(t + 0.1);
    }
  }

  splash(pan = 0, size = 1): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const n = this.noiseSource();
    if (!n) return;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(4200, t);
    f.frequency.exponentialRampToValueAtTime(180, t + 1.1);
    f.Q.value = 2;
    const g = this.envGain(0.9 * Math.min(1.3, size), 0.01, 1.3)!;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    n.connect(f).connect(g).connect(p).connect(this.master);
    n.start(t);
    n.stop(t + 1.5);
    // A low "plunk" under the hiss.
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.35);
    const go = this.envGain(0.45, 0.005, 0.4)!;
    o.connect(go).connect(p);
    o.start(t);
    o.stop(t + 0.5);
  }

  /** A short rising whoosh at the lip. */
  launch(pan = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const n = this.noiseSource();
    if (!n) return;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.5);
    f.Q.value = 1.2;
    const g = this.envGain(0.35, 0.08, 0.6)!;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    n.connect(f).connect(g).connect(p).connect(this.master);
    n.start(t);
    n.stop(t + 0.8);
  }

  /** Glider wings snapping open: a short rising swoosh with a click. */
  wings(pan = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const n = this.noiseSource();
    if (!n) return;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.25);
    f.Q.value = 2.5;
    const g = this.envGain(0.3, 0.02, 0.3)!;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    n.connect(f).connect(g).connect(p).connect(this.master);
    n.start(t);
    n.stop(t + 0.4);
    p.connect(this.master);
    this.tone(1800, 0.05, 'square', 0.05, 0.2);
  }

  cheer(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const bus = this.ctx.createGain();
    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.exponentialRampToValueAtTime(0.55, t + 0.35);
    bus.gain.setValueAtTime(0.55, t + 1.8);
    bus.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
    bus.connect(this.master);
    // Crowd: several band-passed noise "voices" with wobbling formants.
    for (let i = 0; i < 9; i++) {
      const n = this.noiseSource();
      if (!n) break;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      const base = 350 + Math.random() * 900;
      f.frequency.setValueAtTime(base, t);
      f.frequency.linearRampToValueAtTime(base * (1.1 + Math.random() * 0.4), t + 1.2);
      f.frequency.linearRampToValueAtTime(base * 0.9, t + 3.4);
      f.Q.value = 3 + Math.random() * 4;
      const g = this.ctx.createGain();
      g.gain.value = 0.35;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 3 + Math.random() * 6;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.2;
      lfo.connect(lfoGain).connect(g.gain);
      n.connect(f).connect(g).connect(bus);
      n.start(t);
      n.stop(t + 3.8);
      lfo.start(t);
      lfo.stop(t + 3.8);
    }
    // A couple of whistles.
    for (let i = 0; i < 3; i++) {
      const at = 0.2 + Math.random() * 1.4;
      this.tone(1700 + Math.random() * 500, 0.35, 'sine', 0.06, at, 2600 + Math.random() * 500);
    }
  }

  engine(kind: EngineKind, pan: number): EngineVoice {
    const ctx = this.ctx;
    if (!ctx || !this.master) return NOOP_ENGINE;
    const out = ctx.createGain();
    out.gain.value = 0;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    out.connect(panner).connect(this.master);
    const stops: (() => void)[] = [];

    if (kind === 'jet') {
      const n = this.noiseSource()!;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 0.7;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 5000;
      const whine = ctx.createOscillator();
      whine.type = 'sine';
      whine.frequency.value = 2400;
      const wg = ctx.createGain();
      wg.gain.value = 0.05;
      n.connect(bp).connect(lp).connect(out);
      whine.connect(wg).connect(out);
      n.start();
      whine.start();
      stops.push(() => {
        n.stop();
        whine.stop();
      });
      return {
        set: (speed, running) => {
          const now = ctx.currentTime;
          out.gain.setTargetAtTime(running ? 0.34 : 0.0, now, running ? 0.05 : 0.25);
          bp.frequency.setTargetAtTime(700 + speed * 38, now, 0.1);
          whine.frequency.setTargetAtTime(2000 + speed * 30, now, 0.1);
        },
        stop: () => {
          out.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
          setTimeout(() => stops.forEach((s) => s()), 300);
        },
      };
    }

    const v8 = kind === 'v8';
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const sub = ctx.createOscillator();
    sub.type = v8 ? 'square' : 'triangle';
    const subGain = ctx.createGain();
    subGain.gain.value = v8 ? 0.45 : 0.2;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = v8 ? 6 : 3;
    // Amplitude flutter reads as firing cylinders.
    const flutter = ctx.createOscillator();
    flutter.type = 'square';
    const flutterGain = ctx.createGain();
    flutterGain.gain.value = v8 ? 0.25 : 0.4;
    const body = ctx.createGain();
    body.gain.value = 0.7;
    flutter.connect(flutterGain).connect(body.gain);
    osc.connect(lp);
    sub.connect(subGain).connect(lp);
    lp.connect(body).connect(out);
    osc.start();
    sub.start();
    flutter.start();
    stops.push(() => {
      osc.stop();
      sub.stop();
      flutter.stop();
    });
    const base = v8 ? 42 : 68;
    const perMs = v8 ? 2.3 : 3.2;
    return {
      set: (speed, running, wheelspin) => {
        const now = ctx.currentTime;
        const rev = wheelspin ? 1.35 : 1;
        const f = (base + speed * perMs) * rev;
        osc.frequency.setTargetAtTime(f, now, 0.06);
        sub.frequency.setTargetAtTime(f / 2, now, 0.06);
        flutter.frequency.setTargetAtTime(f / (v8 ? 2 : 1), now, 0.06);
        lp.frequency.setTargetAtTime(running ? 300 + speed * (v8 ? 40 : 30) : 180, now, 0.08);
        out.gain.setTargetAtTime(running ? (v8 ? 0.32 : 0.22) : 0.0, now, running ? 0.05 : 0.3);
      },
      stop: () => {
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        setTimeout(() => stops.forEach((s) => s()), 300);
      },
    };
  }

  wind(pan: number): WindVoice {
    const ctx = this.ctx;
    if (!ctx || !this.master) return NOOP_WIND;
    const n = this.noiseSource()!;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    n.connect(bp).connect(g).connect(p).connect(this.master);
    n.start();
    return {
      set: (airspeed) => {
        const now = ctx.currentTime;
        const a = Math.min(airspeed / 50, 1.2);
        g.gain.setTargetAtTime(0.05 + a * a * 0.3, now, 0.1);
        bp.frequency.setTargetAtTime(300 + airspeed * 30, now, 0.1);
      },
      stop: () => {
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        setTimeout(() => n.stop(), 900);
      },
    };
  }
}
