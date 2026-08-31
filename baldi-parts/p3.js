
/* =========================================================================
   BALDI'S BASICS 3D  —  full-3D fan tribute
   Everything (models, textures, sound) is generated procedurally at runtime.
   Part 1 — constants, helpers, audio engine, texture factory
   ========================================================================= */
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp  = (a, b, t) => a + (b - a) * t;
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick  = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const angLerp = (a, b, t) => { let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * t; };

/* ---- map constants -------------------------------------------------- */
const CS   = 4;          // cell size in world units
const MW   = 48, MH = 54;// map dimensions in cells
const WALLH = 8;         // wall height
const W_WALL = 1, W_HALL = 0, W_ROOM = 2, W_DOOR = 3, W_EXIT = 4, W_GRASS = 5;

/* =========================================================================
   AUDIO — a tiny synth. No samples, all oscillators + shaped noise.
   ========================================================================= */
const Audio1 = {
  ctx: null, master: null, musicGain: null, sfxGain: null, noiseBuf: null,
  ready: false, ambientNodes: null,

  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 1.0; this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.35; this.musicGain.connect(this.master);

    // 2 s of white noise, reused everywhere
    const n = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.ready = true;
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  t() { return this.ctx.currentTime; },

  /* generic routing helper: returns the node you should connect a source to */
  chain(pan, vol, dest) {
    const g = this.ctx.createGain(); g.gain.value = vol;
    let out = g;
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = clamp(pan || 0, -1, 1);
      g.connect(p); out = p;
    }
    out.connect(dest || this.sfxGain);
    return g;
  },

  noise(dur, vol, filterType, freq, q, pan, curve) {
    if (!this.ready) return null;
    const t = this.t();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = rand(0.85, 1.15);
    const f = this.ctx.createBiquadFilter();
    f.type = filterType || 'bandpass'; f.frequency.value = freq || 1400; f.Q.value = q || 1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.004);
    if (curve === 'flat') {
      g.gain.setValueAtTime(vol, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } else {
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    src.connect(f); f.connect(g);
    g.connect(this.chain(pan, 1));
    src.start(t); src.stop(t + dur + 0.02);
    return { src, f, g };
  },

  tone(freq, dur, vol, type, pan, dest, slideTo) {
    if (!this.ready) return null;
    const t = this.t();
    const o = this.ctx.createOscillator();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.chain(pan, 1, dest));
    o.start(t); o.stop(t + dur + 0.02);
    return o;
  },

  /* --- the sound: Baldi's ruler slap ------------------------------- */
  slap(pan, vol, pitch) {
    if (!this.ready) return;
    const t = this.t();
    // crack: very short high noise
    this.noise(0.055, vol * 0.9, 'bandpass', 2600 * (pitch || 1), 1.1, pan);
    // body: wooden resonance
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(420 * (pitch || 1), t);
    o.frequency.exponentialRampToValueAtTime(150 * (pitch || 1), t + 0.10);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol * 0.55, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(g); g.connect(this.chain(pan, 1));
    o.start(t); o.stop(t + 0.16);
    // low thud
    this.tone(90, 0.09, vol * 0.35, 'sine', pan, null, 55);
  },

  footstep(vol) {
    this.noise(0.09, 0.055 * (vol || 1), 'lowpass', 380, 1, rand(-0.25, 0.25));
  },

  door(open) {
    if (!this.ready) return;
    this.noise(0.13, 0.16, 'bandpass', open ? 900 : 620, 2.2, rand(-0.3, 0.3));
    this.tone(open ? 220 : 160, 0.1, 0.06, 'sawtooth', 0, null, open ? 320 : 110);
  },

  pickup() {
    if (!this.ready) return;
    [660, 880, 1174].forEach((f, i) => setTimeout(() => this.tone(f, 0.13, 0.16, 'square'), i * 55));
  },

  notebookJingle() {
    if (!this.ready) return;
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => setTimeout(() => {
      this.tone(f, 0.16, 0.13, 'square', 0, this.musicGain);
      this.tone(f * 2, 0.1, 0.05, 'triangle', 0, this.musicGain);
    }, i * 90));
  },

  correct() {
    if (!this.ready) return;
    [784, 988, 1318].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 0.15, 'square'), i * 70));
  },

  wrong() {
    if (!this.ready) return;
    this.tone(180, 0.32, 0.16, 'sawtooth', 0, null, 70);
    setTimeout(() => this.tone(150, 0.36, 0.14, 'square', 0, null, 55), 90);
    this.noise(0.35, 0.05, 'lowpass', 500, 1, 0);
  },

  whistle() {
    if (!this.ready) return;
    this.tone(1800, 0.26, 0.12, 'sine', 0, null, 2500);
    setTimeout(() => this.tone(2400, 0.2, 0.1, 'sine', 0, null, 1700), 120);
  },

  spray() {
    if (!this.ready) return;
    // pressurised hiss with a fizzy tail
    this.noise(0.75, 0.26, 'highpass', 2600, 0.7, 0, 'flat');
    this.noise(0.55, 0.16, 'bandpass', 900, 0.5, 0, 'flat');
    const t = this.t();
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.5);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.10, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g); g.connect(this.chain(0, 1));
    o.start(t); o.stop(t + 0.65);
  },

  bell() {
    if (!this.ready) return;
    for (let i = 0; i < 3; i++) setTimeout(() => {
      this.tone(880, 0.5, 0.12, 'sine', 0, this.musicGain);
      this.tone(1320, 0.4, 0.06, 'sine', 0, this.musicGain);
    }, i * 260);
  },

  ropeTick(n) { this.tone(440 + n * 70, 0.08, 0.12, 'square'); },
  ropeWhoosh() { this.noise(0.16, 0.05, 'bandpass', 700, 1.5, rand(-0.5, 0.5)); },

  scream() {
    if (!this.ready) return;
    const t = this.t();
    for (let i = 0; i < 5; i++) {
      const o = this.ctx.createOscillator();
      o.type = i % 2 ? 'sawtooth' : 'square';
      o.frequency.setValueAtTime(rand(140, 300), t);
      o.frequency.linearRampToValueAtTime(rand(600, 1500), t + 0.8);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 1.15);
    }
    this.noise(1.0, 0.22, 'bandpass', 1200, 0.6, 0, 'flat');
  },

  /* ---- THE JUMPSCARE ------------------------------------------------
     Deliberately the loudest thing in the game. Runs on its own signal
     path — hard distortion into a brick-wall compressor straight to the
     output — so it hits at full scale without digital clipping. */
  _distCurve(amount) {
    const n = 8192, curve = new Float32Array(n), deg = Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const x = i * 2 / n - 1;
      curve[i] = (3 + amount) * x * 20 * deg / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  },

  jumpscare(loud) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const LV = loud === false ? 0.35 : 1.0;

    // duck the rest of the mix so nothing fights it
    try {
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(0.12, t + 0.05);
      this.master.gain.linearRampToValueAtTime(0.85, t + 2.6);
    } catch (e) {}

    const shaper = ctx.createWaveShaper();
    shaper.curve = this._distCurve(80);
    shaper.oversample = '4x';
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -26; comp.knee.value = 8; comp.ratio.value = 16;
    comp.attack.value = 0.0008; comp.release.value = 0.22;
    const out = ctx.createGain(); out.gain.value = LV;
    shaper.connect(comp); comp.connect(out); out.connect(ctx.destination);

    // A — the BAM: a wall of noise sweeping down from bright to guttural
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const bf = ctx.createBiquadFilter();
    bf.type = 'bandpass'; bf.Q.value = 0.35;
    bf.frequency.setValueAtTime(2600, t);
    bf.frequency.exponentialRampToValueAtTime(160, t + 1.2);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(1.0, t + 0.004);
    ng.gain.exponentialRampToValueAtTime(0.35, t + 0.40);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    src.connect(bf); bf.connect(ng); ng.connect(shaper);
    src.start(t); src.stop(t + 1.8);

    // B — eight detuned voices screaming upward, the classic shriek
    for (let i = 0; i < 8; i++) {
      const o = ctx.createOscillator();
      o.type = i % 3 === 0 ? 'sawtooth' : (i % 3 === 1 ? 'square' : 'triangle');
      const f0 = 78 + i * 41 + rand(-8, 8);
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * rand(5, 11), t + 0.5);
      o.frequency.exponentialRampToValueAtTime(f0 * 1.6, t + 1.45);
      o.detune.setValueAtTime(rand(-40, 40), t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.34, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g); g.connect(shaper);
      o.start(t); o.stop(t + 1.65);
    }

    // C — sub drop you feel more than hear
    const sub = ctx.createOscillator(); sub.type = 'sine';
    sub.frequency.setValueAtTime(150, t);
    sub.frequency.exponentialRampToValueAtTime(26, t + 0.8);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.exponentialRampToValueAtTime(0.95 * LV, t + 0.01);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    sub.connect(sg); sg.connect(comp);
    sub.start(t); sub.stop(t + 1.5);

    // D — three ruler cracks stacked on the transient
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(620 - i * 120, t + i * 0.012);
      o.frequency.exponentialRampToValueAtTime(120, t + 0.14 + i * 0.012);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.85, t + i * 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.20 + i * 0.012);
      o.connect(g); g.connect(shaper);
      o.start(t + i * 0.012); o.stop(t + 0.25 + i * 0.012);
    }
  },

  winFanfare() {
    if (!this.ready) return;
    const seq = [523, 523, 523, 523, 415, 466, 523, 466, 523];
    seq.forEach((f, i) => setTimeout(() => {
      this.tone(f, 0.2, 0.13, 'square', 0, this.musicGain);
      this.tone(f / 2, 0.2, 0.07, 'triangle', 0, this.musicGain);
    }, i * 170));
  },

  /* --- the bus ride: a diesel pull-away, then tyres on gravel ------ */
  busRide() {
    if (!this.ready) return;
    const t = this.t();
    /* engine: a low sawtooth that revs, doubled an octave down */
    for (const [base, vol] of [[52, 0.16], [26, 0.11], [78, 0.06]]) {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(base * 0.7, t);
      o.frequency.linearRampToValueAtTime(base * 1.5, t + 1.4);
      o.frequency.linearRampToValueAtTime(base * 1.05, t + 2.0);
      o.frequency.linearRampToValueAtTime(base * 1.8, t + 3.4);
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.5);
      g.gain.setValueAtTime(vol, t + 3.0);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4.0);
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 4.1);
    }
    /* gravel under the tyres */
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const bf = this.ctx.createBiquadFilter(); bf.type = 'bandpass';
    bf.frequency.value = 900; bf.Q.value = 0.5;
    const bg = this.ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.linearRampToValueAtTime(0.05, t + 0.8);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 3.9);
    src.connect(bf); bf.connect(bg); bg.connect(this.master);
    src.start(t); src.stop(t + 4.0);
    /* two toots on the horn as it pulls away */
    setTimeout(() => { this.tone(196, 0.42, 0.13, 'square'); this.tone(262, 0.42, 0.10, 'square'); }, 120);
    setTimeout(() => { this.tone(196, 0.30, 0.11, 'square'); this.tone(262, 0.30, 0.08, 'square'); }, 640);
  },

  /* a few birds on arrival */
  birds() {
    if (!this.ready) return;
    const chirp = (f, d) => setTimeout(() => {
      this.tone(f, 0.07, 0.07, 'sine', rand(-0.7, 0.7), null, f * 1.5);
      setTimeout(() => this.tone(f * 1.2, 0.06, 0.05, 'sine', 0, null, f * 0.8), 90);
    }, d);
    chirp(2100, 200); chirp(2600, 700); chirp(1900, 1400); chirp(2400, 2200);
  },

  /* crickets + a breeze through the pines */
  forestAmbient(on) {
    if (!this.ready) return;
    if (on && !this._forest) {
      const t = this.t();
      const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass';
      f.frequency.value = 620; f.Q.value = 0.35;
      const g = this.ctx.createGain(); g.gain.value = 0.028;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.18;
      const lg = this.ctx.createGain(); lg.gain.value = 0.014;
      lfo.connect(lg); lg.connect(g.gain);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t); lfo.start(t);
      /* crickets: a fast chirp gated on and off */
      const cr = this.ctx.createOscillator(); cr.type = 'square'; cr.frequency.value = 4300;
      const cg = this.ctx.createGain(); cg.gain.value = 0;
      const gate = this.ctx.createOscillator(); gate.type = 'square'; gate.frequency.value = 11;
      const gg = this.ctx.createGain(); gg.gain.value = 0.006;
      gate.connect(gg); gg.connect(cg.gain);
      cr.connect(cg); cg.connect(this.master);
      cr.start(t); gate.start(t);
      this._forest = { src, lfo, cr, gate };
    } else if (!on && this._forest) {
      const F = this._forest;
      try { F.src.stop(); F.lfo.stop(); F.cr.stop(); F.gate.stop(); } catch (e) {}
      this._forest = null;
    }
  },

  /* --- looping ambience ------------------------------------------- */
  startAmbient() {
    if (!this.ready || this.ambientNodes) return;
    const t = this.t();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 260;
    const g = this.ctx.createGain(); g.gain.value = 0.035;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
    // faint fluorescent buzz
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 120;
    const og = this.ctx.createGain(); og.gain.value = 0.012;
    o.connect(og); og.connect(this.master); o.start(t);
    this.ambientNodes = { src, o, g, og };
  },
  stopAmbient() {
    if (!this.ambientNodes) return;
    try { this.ambientNodes.src.stop(); this.ambientNodes.o.stop(); } catch (e) {}
    this.ambientNodes = null;
  },

  /* continuous sweeping brush for Gotta Sweep */
  sweepLoop(on) {
    if (!this.ready) return;
    if (on && !this._sweep) {
      const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1600; f.Q.value = 0.7;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 2.6;
      const lg = this.ctx.createGain(); lg.gain.value = 0.05;
      const g = this.ctx.createGain(); g.gain.value = 0.0;
      lfo.connect(lg); lg.connect(g.gain);
      src.connect(f); f.connect(g); g.connect(this.sfxGain);
      src.start(); lfo.start();
      this._sweep = { src, lfo, g };
    } else if (!on && this._sweep) {
      try { this._sweep.src.stop(); this._sweep.lfo.stop(); } catch (e) {}
      this._sweep = null;
    }
  },
  sweepVol(v) { if (this._sweep) this._sweep.g.gain.value = v * 0.25; },

  playtimeTune() {
    if (!this.ready) return;
    const seq = [659, 784, 880, 784, 659, 587, 659];
    seq.forEach((f, i) => setTimeout(() => this.tone(f, 0.15, 0.09, 'triangle', 0, this.musicGain), i * 150));
  }
};

/* =========================================================================
   SCHOOLHOUSE MUSIC — streamed live from the raw link, never baked in.
   It runs under Chapter 1 while you're getting problems right, and cuts dead
   the instant you get one wrong.
   ========================================================================= */
const Music = {
  el: null, ready: false, failed: false, srcIndex: 0,
  sources: [
    'https://raw.githubusercontent.com/wujiahui4-a11y/study-mathenmatics-G3-singapore-secondary/refs/heads/main/Mus_School.wav',
    'https://github.com/wujiahui4-a11y/study-mathenmatics-G3-singapore-secondary/raw/refs/heads/main/Mus_School.wav'
  ],

  init() {
    if (this.el) return;
    try {
      const a = new window.Audio();
      a.loop = true;
      a.preload = 'auto';
      a.volume = 0.55;
      a.addEventListener('canplay', () => { this.ready = true; });
      a.addEventListener('error', () => {
        // first host failed — try the mirror, then give up quietly
        this.srcIndex++;
        if (this.srcIndex < this.sources.length) { a.src = this.sources[this.srcIndex]; a.load(); }
        else this.failed = true;
      });
      a.src = this.sources[0];
      this.el = a;
    } catch (e) { this.failed = true; }
  },

  play() {
    this.init();
    if (!this.el || this.failed) return;
    try {
      this.el.currentTime = 0;
      const pr = this.el.play();
      if (pr && pr.catch) pr.catch(() => {});   // autoplay refused, no harm done
    } catch (e) {}
  },

  /* no fade, no tail — it just stops, mid-note */
  stop(rewind) {
    if (!this.el) return;
    try { this.el.pause(); if (rewind) this.el.currentTime = 0; } catch (e) {}
  }
};

/* =========================================================================
   TEXTURE FACTORY — canvas-drawn, nearest filtered, that 1999 CD-ROM look
   ========================================================================= */
function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, x: c.getContext('2d') };
}
function texFrom(canvas, repX, repY) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapLinearFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repX || 1, repY || 1);
  t.anisotropy = 4;
  return t;
}
/* speckle noise overlay — sells the "scanned texture" feel */
function speckle(x, w, h, amt, alpha) {
  const img = x.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amt;
    d[i] = clamp(d[i] + n, 0, 255);
    d[i + 1] = clamp(d[i + 1] + n, 0, 255);
    d[i + 2] = clamp(d[i + 2] + n, 0, 255);
  }
  x.putImageData(img, 0, 0);
  if (alpha) { x.globalAlpha = alpha; x.globalAlpha = 1; }
}

const TEX = {};
function buildTextures() {
  /* ---- hallway floor: classic beige/tan checkerboard ---- */
  {
    const S = 64, { c, x } = cv(S * 2, S * 2);
    const a = '#d9cfae', b = '#b0a37e';
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      x.fillStyle = ((i + j) % 2) ? a : b;
      x.fillRect(i * S, j * S, S, S);
      // subtle tile mottling
      x.globalAlpha = 0.09;
      for (let k = 0; k < 90; k++) {
        x.fillStyle = Math.random() < .5 ? '#000' : '#fff';
        x.fillRect(i * S + Math.random() * S, j * S + Math.random() * S, 2, 2);
      }
      x.globalAlpha = 1;
    }
    x.strokeStyle = 'rgba(0,0,0,.22)'; x.lineWidth = 2;
    for (let i = 0; i <= 2; i++) { x.beginPath(); x.moveTo(i * S, 0); x.lineTo(i * S, S * 2); x.stroke();
                                   x.beginPath(); x.moveTo(0, i * S); x.lineTo(S * 2, i * S); x.stroke(); }
    speckle(x, S * 2, S * 2, 16);
    TEX.floor = texFrom(c, MW / 2, MH / 2);
  }
  /* ---- classroom floor: greener linoleum ---- */
  {
    const S = 64, { c, x } = cv(S * 2, S * 2);
    const a = '#bcc9a8', b = '#98a884';
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      x.fillStyle = ((i + j) % 2) ? a : b;
      x.fillRect(i * S, j * S, S, S);
    }
    x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 2;
    for (let i = 0; i <= 2; i++) { x.beginPath(); x.moveTo(i * S, 0); x.lineTo(i * S, S * 2); x.stroke();
                                   x.beginPath(); x.moveTo(0, i * S); x.lineTo(S * 2, i * S); x.stroke(); }
    speckle(x, S * 2, S * 2, 18);
    TEX.floorRoom = texFrom(c, 1, 1);
  }
  /* ---- wall: pale institutional green over a darker wainscot ---- */
  {
    const W = 64, H = 128, { c, x } = cv(W, H);
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#dfe3c4'); g.addColorStop(0.55, '#cfd6b2'); g.addColorStop(1, '#c3cba6');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // wainscot band (bottom of wall = bottom of texture)
    x.fillStyle = '#7d8f63'; x.fillRect(0, H - 34, W, 34);
    x.fillStyle = '#5f6f49'; x.fillRect(0, H - 38, W, 5);
    x.fillStyle = '#93a476'; x.fillRect(0, H - 34, W, 3);
    // baseboard
    x.fillStyle = '#4a3a2c'; x.fillRect(0, H - 9, W, 9);
    x.fillStyle = '#2f251c'; x.fillRect(0, H - 9, W, 2);
    // faint vertical panel seams
    x.strokeStyle = 'rgba(0,0,0,.10)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(1, 0); x.lineTo(1, H - 9); x.stroke();
    speckle(x, W, H, 14);
    TEX.wall = texFrom(c, 1, 1);
  }
  /* ---- ceiling: white acoustic tile ---- */
  {
    const S = 64, { c, x } = cv(S, S);
    x.fillStyle = '#eceee6'; x.fillRect(0, 0, S, S);
    x.globalAlpha = .5;
    for (let k = 0; k < 380; k++) { x.fillStyle = '#c9ccc0'; x.fillRect(Math.random() * S, Math.random() * S, 1, 1); }
    x.globalAlpha = 1;
    x.strokeStyle = '#b9bcb1'; x.lineWidth = 3;
    x.strokeRect(1.5, 1.5, S - 3, S - 3);
    TEX.ceil = texFrom(c, MW, MH);
  }
  /* ---- locker: blue-grey with vents ---- */
  {
    const W = 64, H = 128, { c, x } = cv(W, H);
    x.fillStyle = '#4f7ea8'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#3f688c'; x.fillRect(0, 0, 4, H); x.fillRect(W - 4, 0, 4, H);
    x.fillStyle = '#66a0cd'; x.fillRect(4, 0, W - 8, 3);
    for (let i = 0; i < 5; i++) { x.fillStyle = '#2d4c68'; x.fillRect(14, 10 + i * 6, W - 28, 3); }
    x.fillStyle = '#c9d7e2'; x.fillRect(W - 18, H * 0.44, 7, 14);   // handle
    x.fillStyle = '#22384c'; x.fillRect(W - 17, H * 0.44 + 2, 5, 4);
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; x.strokeRect(1, 1, W - 2, H - 2);
    speckle(x, W, H, 12);
    TEX.locker = texFrom(c, 1, 1);
  }
  /* ---- chalkboard ---- */
  {
    const W = 128, H = 64, { c, x } = cv(W, H);
    x.fillStyle = '#2c4a34'; x.fillRect(0, 0, W, H);
    x.globalAlpha = .12;
    for (let k = 0; k < 60; k++) { x.fillStyle = '#fff'; x.fillRect(Math.random() * W, Math.random() * H, rand(4, 20), 1); }
    x.globalAlpha = 1;
    x.strokeStyle = '#e8e8e8'; x.lineWidth = 2; x.font = 'bold 15px monospace'; x.fillStyle = '#f0f0f0';
    x.fillText('2 + 2 = 4', 10, 22);
    x.fillText('7 x 3 = 21', 10, 42);
    x.fillText('MATH IS FUN!', 10, 58);
    x.fillStyle = '#8a6b3f'; x.fillRect(0, H - 6, W, 6);
    x.strokeStyle = '#6b512e'; x.lineWidth = 4; x.strokeRect(2, 2, W - 4, H - 4);
    TEX.chalkboard = texFrom(c, 1, 1);
  }
  /* ---- door panels ---- */
  TEX.doorRed  = doorTex('#b8483c', '#8c3229');
  TEX.doorExit = doorTex('#2f7d3f', '#1e5a2c', true);
  function doorTex(a, b, isExit) {
    const W = 64, H = 128, { c, x } = cv(W, H);
    x.fillStyle = a; x.fillRect(0, 0, W, H);
    x.fillStyle = b; x.fillRect(0, 0, 5, H); x.fillRect(W - 5, 0, 5, H);
    x.fillRect(0, 0, W, 5); x.fillRect(0, H - 5, W, 5);
    x.fillStyle = 'rgba(255,255,255,.10)'; x.fillRect(8, 8, W - 16, 46);
    x.fillStyle = '#cfd8e0'; x.fillRect(6, H * 0.46, 8, 16);
    if (isExit) {
      x.fillStyle = '#f6f2cf'; x.fillRect(10, 14, W - 20, 30);
      x.fillStyle = '#146b25'; x.font = 'bold 15px sans-serif'; x.textAlign = 'center';
      x.fillText('EXIT', W / 2, 34);
    }
    speckle(x, W, H, 10);
    return texFrom(c, 1, 1);
  }
  /* ---- poster art for hallway walls ---- */
  {
    const W = 64, H = 64, { c, x } = cv(W, H);
    x.fillStyle = '#fff8dc'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#333'; x.lineWidth = 2; x.strokeRect(1, 1, W - 2, H - 2);
    x.fillStyle = '#d33'; x.font = 'bold 11px sans-serif'; x.textAlign = 'center';
    x.fillText('NO', W / 2, 16); x.fillText('RUNNING', W / 2, 28);
    x.strokeStyle = '#c22'; x.lineWidth = 3;
    x.beginPath(); x.arc(W / 2, 44, 13, 0, TAU); x.stroke();
    x.beginPath(); x.moveTo(W / 2 - 10, 54); x.lineTo(W / 2 + 10, 34); x.stroke();
    x.fillStyle = '#222'; x.fillRect(W / 2 - 4, 38, 3, 10); x.fillRect(W / 2 + 1, 40, 3, 8);
    TEX.poster = texFrom(c, 1, 1);
  }
  /* ---- notebook cover ---- */
  {
    const W = 64, H = 64, { c, x } = cv(W, H);
    x.fillStyle = '#2d6cc0'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#f4f4ea'; x.fillRect(8, 6, W - 16, H - 12);
    x.strokeStyle = '#9fb8d8'; x.lineWidth = 1;
    for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(10, 12 + i * 6); x.lineTo(W - 10, 12 + i * 6); x.stroke(); }
    x.strokeStyle = '#c33'; x.beginPath(); x.moveTo(16, 6); x.lineTo(16, H - 6); x.stroke();
    x.fillStyle = '#222';
    for (let i = 0; i < 6; i++) x.fillRect(2, 8 + i * 9, 6, 3);
    TEX.notebook = texFrom(c, 1, 1);
  }
  /* ---- skin / cloth flats used by characters ---- */
  TEX.rulerFace = (function () {
    const W = 256, H = 26, { c, x } = cv(W, H);
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#f0d79a'); g.addColorStop(0.5, '#e3c483'); g.addColorStop(1, '#cfae6c');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = '#2a2118';
    for (let i = 0; i <= 48; i++) {                 // eighth-inch ticks
      const px = i * (W / 48);
      const major = i % 4 === 0;
      x.fillRect(px, 0, major ? 2 : 1, major ? 9 : 5);
    }
    x.fillStyle = '#1d1710'; x.font = 'bold 11px Arial';
    for (let i = 1; i <= 11; i++) {                 // 1" .. 11"
      x.fillText(i + '"', i * (W / 12) + 2, H - 6);
    }
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; x.strokeRect(1, 1, W - 2, H - 2);
    return texFrom(c, 1, 1);
  })();
}


/* =========================================================================
   Part 2 — the schoolhouse.  Hand-authored floorplan (not procedural) so it
   matches the real building: ring corridors, a central spine, fourteen rooms,
   a library and cafeteria across the north end, four exits onto grass.

   Every walkable cell carries a ZONE (1..5).  A chapter unlocks zones up to
   its number; the boundary cells become locked barricades.
   ========================================================================= */

const Map1 = {
  g: new Uint8Array(MW * MH),
  zone: new Uint8Array(MW * MH),
  gate: new Uint8Array(MW * MH),      // 0 = free, else the zone you need
  rooms: [], doors: [], exits: [], gates: [],
  unlocked: 5,                        // zones currently open

  at(x, y) { return (x < 0 || y < 0 || x >= MW || y >= MH) ? W_WALL : this.g[y * MW + x]; },
  set(x, y, v) { if (x >= 0 && y >= 0 && x < MW && y < MH) this.g[y * MW + x] = v; },
  zoneAt(x, y) { return (x < 0 || y < 0 || x >= MW || y >= MH) ? 9 : this.zone[y * MW + x]; },
  /* raw openness — used for building geometry */
  open(x, y) { const v = this.at(x, y); return v !== W_WALL; },
  /* gameplay openness — respects locked chapter barricades */
  walkable(x, y) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) return false;
    const i = y * MW + x;
    if (this.g[i] === W_WALL) return false;
    const gz = this.gate[i];
    return gz === 0 || gz <= this.unlocked;
  },
  locked(x, y) {
    const i = y * MW + x;
    return this.gate[i] !== 0 && this.gate[i] > this.unlocked;
  }
};

function cellCenter(cx, cy) { return { x: (cx + 0.5) * CS, z: (cy + 0.5) * CS }; }
function worldToCell(x, z) { return { x: Math.floor(x / CS), y: Math.floor(z / CS) }; }

/* ---------------------------------------------------------------- layout */
/* corridors: [x0,y0,x1,y1] inclusive */
const CORRIDORS = [
  [4, 4, 43, 5],    // north ring
  [4, 48, 43, 49],  // south ring
  [4, 4, 5, 49],    // west ring
  [42, 4, 43, 49],  // east ring
  [4, 18, 43, 19],  // upper cross hall
  [4, 32, 43, 33],  // lower cross hall
  [22, 18, 23, 49]  // central spine
];

/* rooms: name, x0,y0,x1,y1 (interior), zone, kind */
const ROOMDEF = [
  ['LIBRARY',       7,  7, 22, 16, 5, 'library'],
  ['CAFETERIA',    24,  7, 40, 16, 5, 'cafeteria'],

  ['CLASSROOM 1A',  7, 21, 12, 30, 3, 'class'],
  ['CLASSROOM 1B', 14, 21, 20, 30, 3, 'class'],
  ['SCIENCE LAB',  25, 21, 31, 24, 4, 'lab'],
  ['FACULTY ROOM', 25, 26, 31, 30, 4, 'faculty'],
  ['THE GYM',      33, 21, 40, 30, 4, 'gym'],

  ['ART ROOM',      7, 35, 12, 39, 3, 'art'],
  ['STORAGE',       7, 41, 12, 46, 2, 'storage'],
  ['MUSIC ROOM',   14, 35, 20, 39, 2, 'music'],
  ['HOMEROOM',     14, 41, 20, 46, 1, 'class'],
  ['COMPUTER LAB', 25, 35, 31, 39, 2, 'computer'],
  ['CLASSROOM 2A', 25, 41, 31, 46, 1, 'class'],
  ['JANITOR',      33, 35, 40, 39, 3, 'janitor'],
  ['DETENTION',    33, 41, 40, 46, 2, 'detention']
];

/* which zone each corridor patch belongs to — first match wins */
const CORRIDOR_ZONES = [
  [22, 50, 23, 51, 1], [14, 48, 31, 49, 1], [22, 41, 23, 49, 1],
  [4, 48, 13, 49, 2], [32, 48, 43, 49, 2],
  [4, 41, 5, 49, 2], [42, 41, 43, 49, 2], [22, 34, 23, 40, 2],
  [4, 32, 43, 33, 3], [4, 34, 5, 40, 3], [42, 34, 43, 40, 3], [22, 20, 23, 33, 3],
  [4, 18, 43, 19, 4], [4, 20, 5, 31, 4], [42, 20, 43, 31, 4],
  [2, 24, 3, 25, 4], [44, 24, 45, 25, 4]
];

/* doors: [roomIndex, x, y] chosen by hand so every room opens onto its zone */
const DOORDEF = [
  [0, 14, 17], [0, 6, 12],            // library
  [1, 32, 17], [1, 41, 12],           // cafeteria
  [2, 13, 25], [2, 9, 20],            // classroom 1A
  [3, 21, 25], [3, 17, 20],           // classroom 1B
  [4, 24, 22],                        // science lab
  [5, 24, 28], [5, 28, 31],           // faculty
  [6, 32, 25], [6, 36, 20],           // gym
  [7, 13, 37], [7, 9, 34],            // art room
  [8, 13, 43], [8, 9, 40],            // storage
  [9, 21, 37], [9, 17, 34],           // music
  [10, 21, 43], [10, 17, 47],         // homeroom
  [11, 24, 37], [11, 28, 34],         // computer lab
  [12, 24, 43], [12, 28, 47],         // classroom 2A
  [13, 32, 37], [13, 36, 34],         // janitor
  [14, 32, 43], [14, 36, 47]          // detention
];

const EXITDEF = [
  { x: 22, y: 51, hall: [[22, 50], [23, 50]], dir: 'S', zone: 1, main: true },
  { x: 22, y: 2,  hall: [[22, 3], [23, 3]],   dir: 'N', zone: 5 },
  { x: 2,  y: 24, hall: [[3, 24], [3, 25]],   dir: 'W', zone: 4 },
  { x: 45, y: 24, hall: [[44, 24], [44, 25]], dir: 'E', zone: 4 }
];

function fillRect(r, v) {
  for (let y = r[1]; y <= r[3]; y++) for (let x = r[0]; x <= r[2]; x++) Map1.set(x, y, v);
}

function generateMap() {
  const M = Map1;
  M.g.fill(W_WALL); M.zone.fill(0); M.gate.fill(0);
  M.rooms = []; M.doors = []; M.exits = []; M.gates = [];

  for (const c of CORRIDORS) fillRect(c, W_HALL);

  ROOMDEF.forEach((r, i) => {
    for (let y = r[2]; y <= r[4]; y++) for (let x = r[1]; x <= r[3]; x++) M.set(x, y, W_ROOM);
    M.rooms.push({
      id: i, name: r[0], x0: r[1], y0: r[2], x1: r[3], y1: r[4],
      zone: r[5], kind: r[6],
      cx: (r[1] + r[3]) >> 1, cy: (r[2] + r[4]) >> 1, doors: []
    });
  });

  for (const [ri, dx, dy] of DOORDEF) {
    M.set(dx, dy, W_DOOR);
    const d = { x: dx, y: dy, room: ri, open: 0, target: 0 };
    M.rooms[ri].doors.push(d); M.doors.push(d);
  }

  for (const e of EXITDEF) {
    for (const [hx, hy] of e.hall) M.set(hx, hy, W_HALL);
    M.set(e.x, e.y, W_EXIT); M.set(e.x + 1, e.y, W_EXIT);
    M.exits.push(Object.assign({}, e));
  }

  /* ---- zones ---- */
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (!M.open(x, y)) continue;
    let z = 5;
    for (const r of CORRIDOR_ZONES) {
      if (x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]) { z = r[4]; break; }
    }
    M.zone[y * MW + x] = z;
  }
  // rooms + their doors take the room's zone
  for (const r of M.rooms) {
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) M.zone[y * MW + x] = r.zone;
    for (const d of r.doors) M.zone[d.y * MW + d.x] = r.zone;
  }
  for (const e of M.exits) {
    M.zone[e.y * MW + e.x] = e.zone;
    M.zone[e.y * MW + e.x + 1] = e.zone;
    for (const [hx, hy] of e.hall) M.zone[hy * MW + hx] = e.zone;
  }

  /* ---- gates: a cell whose zone is higher than a neighbour's ---- */
  for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
    if (!M.open(x, y)) continue;
    const z = M.zoneAt(x, y);
    if (z <= 1) continue;
    let border = false;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (M.open(nx, ny) && M.zoneAt(nx, ny) < z) { border = true; break; }
    }
    if (border) { M.gate[y * MW + x] = z; M.gates.push({ x, y, zone: z }); }
  }
  return M;
}

/* =========================================================================
   Geometry
   ========================================================================= */
function pushQuad(P, N, U, a, b, c, d, nx, ny, nz, uw, uh) {
  const verts = [a, b, c, a, c, d];
  const uvs = [[0, 0], [uw, 0], [uw, uh], [0, 0], [uw, uh], [0, uh]];
  for (let i = 0; i < 6; i++) {
    P.push(verts[i][0], verts[i][1], verts[i][2]);
    N.push(nx, ny, nz);
    U.push(uvs[i][0], uvs[i][1]);
  }
}

function buildWorld(scene) {
  const M = Map1;
  const group = new THREE.Group();
  const props = [];

  /* ---------- ground: grass everywhere, tile inside ---------- */
  const grassTex = (function () {
    const S = 64, { c, x } = cv(S, S);
    x.fillStyle = '#4e8f3c'; x.fillRect(0, 0, S, S);
    for (let k = 0; k < 700; k++) {
      x.fillStyle = Math.random() < .5 ? '#5aa346' : '#3f7a30';
      x.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }
    return texFrom(c, MW, MH);
  })();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MW * CS + 200, MH * CS + 200),
    new THREE.MeshLambertMaterial({ map: grassTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(MW * CS / 2, -0.06, MH * CS / 2);
  group.add(ground);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(MW * CS, MH * CS),
    new THREE.MeshLambertMaterial({ map: TEX.floor }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(MW * CS / 2, 0, MH * CS / 2);
  group.add(floor);

  for (const r of M.rooms) {
    const w = (r.x1 - r.x0 + 1) * CS, h = (r.y1 - r.y0 + 1) * CS;
    const t = TEX.floorRoom.clone(); t.needsUpdate = true;
    t.repeat.set((r.x1 - r.x0 + 1) / 2, (r.y1 - r.y0 + 1) / 2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: t }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((r.x0 + (r.x1 - r.x0 + 1) / 2) * CS, 0.02, (r.y0 + (r.y1 - r.y0 + 1) / 2) * CS);
    group.add(m);
  }

  /* ---------- ceiling only over the building ---------- */
  const bw = 42 * CS, bh = 48 * CS;
  const ct = TEX.ceil.clone(); ct.needsUpdate = true; ct.repeat.set(42, 48);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshLambertMaterial({ map: ct }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set((3 + 21) * CS, WALLH, (3 + 24) * CS);
  group.add(ceil);

  /* ---------- walls ---------- */
  const P = [], N = [], U = [], H = WALLH;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (M.at(x, y) !== W_WALL) continue;
    // only build walls that actually border something walkable
    const X = x * CS, Z = y * CS;
    if (M.open(x + 1, y))
      pushQuad(P, N, U, [X + CS, 0, Z + CS], [X + CS, 0, Z], [X + CS, H, Z], [X + CS, H, Z + CS], 1, 0, 0, 1, 1);
    if (M.open(x - 1, y))
      pushQuad(P, N, U, [X, 0, Z], [X, 0, Z + CS], [X, H, Z + CS], [X, H, Z], -1, 0, 0, 1, 1);
    if (M.open(x, y + 1))
      pushQuad(P, N, U, [X, 0, Z + CS], [X + CS, 0, Z + CS], [X + CS, H, Z + CS], [X, H, Z + CS], 0, 0, 1, 1, 1);
    if (M.open(x, y - 1))
      pushQuad(P, N, U, [X + CS, 0, Z], [X, 0, Z], [X, H, Z], [X + CS, H, Z], 0, 0, -1, 1, 1);
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  wg.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  wg.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  group.add(new THREE.Mesh(wg, new THREE.MeshLambertMaterial({ map: TEX.wall })));

  /* outside face of the building, so it reads as a building from the lawn */
  const shellMat = new THREE.MeshLambertMaterial({ color: 0xc9c2a4 });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(43 * CS, WALLH + 1.2, 49 * CS), shellMat);
  shell.position.set(23.5 * CS, (WALLH + 1.2) / 2 - 0.4, 26.5 * CS);
  shell.material.side = THREE.BackSide;
  group.add(shell);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(43 * CS, 0.9, 49 * CS),
    new THREE.MeshLambertMaterial({ color: 0x9a9a92 }));
  roof.position.set(23.5 * CS, WALLH + 0.5, 26.5 * CS);
  group.add(roof);

  /* ---------- hallway dressing ---------- */
  const lockerGeo = new THREE.BoxGeometry(CS * 0.86, 5.2, 0.55);
  const lockerMat = new THREE.MeshLambertMaterial({ map: TEX.locker });
  const posterGeo = new THREE.PlaneGeometry(2.2, 2.2);
  const posterMat = new THREE.MeshLambertMaterial({ map: TEX.poster });
  let seed = 1337;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  for (let y = 2; y < MH - 2; y++) for (let x = 2; x < MW - 2; x++) {
    if (M.at(x, y) !== W_HALL) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (M.at(x + dx, y + dy) !== W_WALL) continue;
      const roll = rnd();
      const c = cellCenter(x, y);
      const wx = c.x + dx * (CS / 2 - 0.3), wz = c.z + dy * (CS / 2 - 0.3);
      if (roll < 0.36) {
        const l = new THREE.Mesh(lockerGeo, lockerMat);
        l.position.set(wx, 2.6, wz);
        l.rotation.y = dx !== 0 ? Math.PI / 2 : 0;
        group.add(l);
        props.push({ x: wx - dx * 0.25, z: wz - dy * 0.25, r: 0.55 });
      } else if (roll < 0.42) {
        const p = new THREE.Mesh(posterGeo, posterMat);
        p.position.set(c.x + dx * (CS / 2 - 0.06), 4.2, c.z + dy * (CS / 2 - 0.06));
        p.rotation.y = Math.atan2(dx, dy) + Math.PI;
        group.add(p);
      }
    }
  }

  /* ---------- room furniture, per kind ---------- */
  const deskTop = new THREE.MeshLambertMaterial({ color: 0xc8a06a });
  const deskLeg = new THREE.MeshLambertMaterial({ color: 0x555a60 });
  const chairMat = new THREE.MeshLambertMaterial({ color: 0xcf7d3a });
  const shelfMat = new THREE.MeshLambertMaterial({ color: 0x8a5a2e });
  const bookMat = [0xc0392b, 0x2980b9, 0x27ae60, 0xf1c40f, 0x8e44ad].map(c =>
    new THREE.MeshLambertMaterial({ color: c }));

  function desk(cx, cy) {
    const c = cellCenter(cx, cy);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 1.5), deskTop);
    top.position.set(c.x, 1.5, c.z); group.add(top);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const lg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 0.16), deskLeg);
      lg.position.set(c.x + sx * 1.1, 0.75, c.z + sz * 0.6); group.add(lg);
    }
    const ch = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 1.2), chairMat);
    ch.position.set(c.x, 1.0, c.z + 1.5); group.add(ch);
    const bk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.18), chairMat);
    bk.position.set(c.x, 1.55, c.z + 2.05); group.add(bk);
    props.push({ x: c.x, z: c.z, r: 1.15 }, { x: c.x, z: c.z + 1.7, r: 0.62 });
  }
  function bookshelf(cx, cy, rot) {
    const c = cellCenter(cx, cy);
    const s = new THREE.Mesh(new THREE.BoxGeometry(CS * 0.9, 5.0, 1.0), shelfMat);
    s.position.set(c.x, 2.5, c.z); s.rotation.y = rot; group.add(s);
    for (let i = 0; i < 12; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.5), bookMat[i % 5]);
      const off = (i % 6) * 0.42 - 1.05, shelfY = 1.4 + Math.floor(i / 6) * 1.5;
      b.position.set(c.x + Math.cos(rot) * off, shelfY, c.z - Math.sin(rot) * off + 0.55);
      b.rotation.y = rot; group.add(b);
    }
    props.push({ x: c.x, z: c.z, r: 1.1 });
  }

  for (const r of M.rooms) {
    // chalkboard on the room's north wall
    const boardW = Math.min((r.x1 - r.x0 + 1) * CS * 0.7, 13);
    const cb = new THREE.Mesh(new THREE.PlaneGeometry(boardW, 2.8),
      new THREE.MeshLambertMaterial({ map: TEX.chalkboard }));
    cb.position.set((r.x0 + (r.x1 - r.x0 + 1) / 2) * CS, 4.4, r.y0 * CS + 0.08);
    group.add(cb);
    r.board = cb;
    r.boardPos = { x: cb.position.x, y: 4.4, z: cb.position.z };

    if (r.kind === 'library') {
      for (let i = 0; i < 6; i++) bookshelf(r.x0 + 1 + i * 3, r.y0 + 3, 0);
      for (let i = 0; i < 6; i++) bookshelf(r.x0 + 1 + i * 3, r.y0 + 7, 0);
    } else if (r.kind === 'cafeteria') {
      for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
        const c = cellCenter(r.x0 + 2 + i * 4, r.y0 + 2 + j * 3);
        const t = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.3, 1.8), deskTop);
        t.position.set(c.x, 1.6, c.z); group.add(t);
        for (const sx of [-1, 1]) {
          const lg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 1.6), deskLeg);
          lg.position.set(c.x + sx * 2.5, 0.8, c.z); group.add(lg);
        }
        props.push({ x: c.x, z: c.z, r: 1.25 });
      }
    } else if (r.kind === 'gym') {
      for (let i = 0; i < 4; i++) {
        const c = cellCenter(r.x0 + 1 + i * 2, r.y0 + 7);
        const ball = sph(0.9, new THREE.MeshLambertMaterial({ color: 0xd8542a }), 1, 1, 1, 12);
        ball.position.set(c.x, 0.9, c.z); group.add(ball);
        props.push({ x: c.x, z: c.z, r: 0.9 });
      }
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 8, 18),
        new THREE.MeshLambertMaterial({ color: 0xe04a2a }));
      const hc = cellCenter(r.x0 + 4, r.y0 + 1);
      hoop.rotation.x = Math.PI / 2; hoop.position.set(hc.x, 5.0, hc.z + 1); group.add(hoop);
    } else if (r.kind === 'storage' || r.kind === 'janitor') {
      for (let i = 0; i < 4; i++) {
        const c = cellCenter(r.x0 + (i % 2) * (r.x1 - r.x0), r.y0 + Math.floor(i / 2) * (r.y1 - r.y0));
        const crate = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.0, 2.0), shelfMat);
        crate.position.set(c.x, 1.0, c.z); group.add(crate);
        props.push({ x: c.x, z: c.z, r: 1.05 });
      }
    } else {
      const cols = Math.min(3, Math.floor((r.x1 - r.x0) / 2));
      const rows = Math.min(2, Math.floor((r.y1 - r.y0) / 2));
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++)
        desk(r.x0 + 1 + i * 2, r.y0 + 2 + j * 2);
    }
  }

  /* ceiling lights */
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfffbe8 });
  for (let y = 4; y < MH - 4; y += 5) for (let x = 4; x < MW - 4; x += 5) {
    if (!M.open(x, y)) continue;
    const c = cellCenter(x, y);
    const lm = new THREE.Mesh(new THREE.PlaneGeometry(CS * 0.9, CS * 0.5), lightMat);
    lm.rotation.x = Math.PI / 2; lm.position.set(c.x, WALLH - 0.05, c.z);
    group.add(lm);
  }

  /* ---------- doors ---------- */
  const doorMat = new THREE.MeshLambertMaterial({ map: TEX.doorRed, side: THREE.DoubleSide });
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x6d5636 });
  for (const d of M.doors) {
    const c = cellCenter(d.x, d.y);
    const horizontal = M.open(d.x - 1, d.y) && M.open(d.x + 1, d.y);
    const pivot = new THREE.Group();
    const halfW = CS * 0.5;
    pivot.position.set(c.x + (horizontal ? 0 : -halfW), 0, c.z + (horizontal ? -halfW : 0));
    const panel = new THREE.Mesh(new THREE.BoxGeometry(CS * 0.98, 6.4, 0.22), doorMat);
    if (horizontal) { panel.rotation.y = Math.PI / 2; panel.position.set(0, 3.2, halfW); }
    else { panel.position.set(halfW, 3.2, 0); }
    pivot.add(panel); group.add(pivot);
    d.pivot = pivot; d.horizontal = horizontal; d.wx = c.x; d.wz = c.z;

    const doorH = 6.4, jw = 0.28;
    const header = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? 0.5 : CS, WALLH - doorH, horizontal ? CS : 0.5), frameMat);
    header.position.set(c.x, doorH + (WALLH - doorH) / 2, c.z); group.add(header);
    for (const sgn of [-1, 1]) {
      const jamb = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 0.5 : jw, doorH, horizontal ? jw : 0.5), frameMat);
      jamb.position.set(c.x + (horizontal ? 0 : sgn * (CS / 2 - jw / 2)), doorH / 2,
                        c.z + (horizontal ? sgn * (CS / 2 - jw / 2) : 0));
      group.add(jamb);
    }
  }

  /* ---------- chapter barricades ---------- */
  const gateTex = (function () {
    const W = 64, H = 64, { c, x } = cv(W, H);
    x.fillStyle = '#f2c419'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#22242a';
    for (let i = -8; i < 16; i++) { x.save(); x.translate(i * 10, 0); x.rotate(-0.5);
      x.fillRect(0, -20, 6, 120); x.restore(); }
    x.fillStyle = '#fff'; x.fillRect(4, 22, W - 8, 20);
    x.fillStyle = '#c02020'; x.font = 'bold 11px Arial'; x.textAlign = 'center';
    x.fillText('CLOSED', W / 2, 36);
    return texFrom(c, 1, 1);
  })();
  const gateMat = new THREE.MeshLambertMaterial({ map: gateTex, side: THREE.DoubleSide });
  for (const g of M.gates) {
    const c = cellCenter(g.x, g.y);
    const horizontal = M.open(g.x - 1, g.y) && M.open(g.x + 1, g.y) &&
                       M.zoneAt(g.x - 1, g.y) !== M.zoneAt(g.x + 1, g.y);
    const m = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? 0.4 : CS, 5.4, horizontal ? CS : 0.4), gateMat);
    m.position.set(c.x, 2.7, c.z);
    group.add(m);
    // a couple of trestle legs
    for (const sgn of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5.4, 0.25),
        new THREE.MeshLambertMaterial({ color: 0x3a3d44 }));
      leg.position.set(c.x + (horizontal ? 0 : sgn * 1.6), 2.7, c.z + (horizontal ? sgn * 1.6 : 0));
      group.add(leg);
    }
    g.mesh = m; g.wx = c.x; g.wz = c.z;
  }

  /* ---------- exits ---------- */
  const exitMat = new THREE.MeshLambertMaterial({ map: TEX.doorExit, side: THREE.DoubleSide });
  const barMat = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  for (const e of M.exits) {
    const c = cellCenter(e.x, e.y);
    const cx = c.x + CS / 2;                       // exits are two cells wide
    const horiz = (e.dir === 'W' || e.dir === 'E');
    const g = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 0.3 : CS * 2, 6.6, horiz ? CS * 2 : 0.3), exitMat);
    g.position.set(horiz ? c.x : cx, 3.3, horiz ? c.z + CS / 2 : c.z);
    group.add(g);
    e.doorMesh = g;
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(CS * 2, 6.6), barMat);
    bar.position.set(horiz ? c.x : cx, 3.3, horiz ? c.z + CS / 2 : c.z);
    bar.rotation.y = horiz ? Math.PI / 2 : 0;
    group.add(bar);
    e.bar = bar; e.wx = horiz ? c.x : cx; e.wz = horiz ? c.z + CS / 2 : c.z;

    const sc = cv(64, 24); sc.x.fillStyle = '#0b2f14'; sc.x.fillRect(0, 0, 64, 24);
    sc.x.fillStyle = '#63ff7d'; sc.x.font = 'bold 15px sans-serif'; sc.x.textAlign = 'center';
    sc.x.fillText('EXIT', 32, 18);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0),
      new THREE.MeshBasicMaterial({ map: texFrom(sc.c, 1, 1) }));
    sign.position.set(e.wx, 7.1, e.wz + (e.dir === 'N' ? 0.7 : e.dir === 'S' ? -0.7 : 0));
    sign.rotation.y = horiz ? Math.PI / 2 : 0;
    group.add(sign);
  }

  scene.add(group);
  return { group, props };
}

/* =========================================================================
   Pathfinding — BFS flow field
   ========================================================================= */
function makeFlowField() {
  return { dist: new Int32Array(MW * MH), from: new Int32Array(MW * MH), stamp: 0 };
}
const _bfsQ = new Int32Array(MW * MH);
function computeFlow(field, tx, ty) {
  const dist = field.dist, from = field.from;
  dist.fill(-1); from.fill(-1);
  if (!Map1.walkable(tx, ty)) {
    let best = null, bd = 1e9;
    for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
      if (!Map1.walkable(x, y)) continue;
      const d = (x - tx) * (x - tx) + (y - ty) * (y - ty);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    if (!best) return field;
    tx = best[0]; ty = best[1];
  }
  let head = 0, tail = 0;
  const s = ty * MW + tx;
  dist[s] = 0; _bfsQ[tail++] = s;
  while (head < tail) {
    const cur = _bfsQ[head++];
    const cx = cur % MW, cy = (cur / MW) | 0, cd = dist[cur];
    for (let k = 0; k < 4; k++) {
      const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0);
      const ny = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      const ni = ny * MW + nx;
      if (dist[ni] !== -1 || !Map1.walkable(nx, ny)) continue;
      dist[ni] = cd + 1; from[ni] = cur;
      _bfsQ[tail++] = ni;
    }
  }
  field.tx = tx; field.ty = ty;
  return field;
}
function flowNext(field, x, y) {
  const i = y * MW + x;
  if (i < 0 || i >= MW * MH) return null;
  const d = field.dist[i];
  if (d <= 0) return null;
  let best = null, bd = d;
  for (let k = 0; k < 4; k++) {
    const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0);
    const ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
    if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
    const nd = field.dist[ny * MW + nx];
    if (nd >= 0 && nd < bd) { bd = nd; best = { x: nx, y: ny }; }
  }
  return best;
}
function fieldDist(field, x, y) {
  if (x < 0 || y < 0 || x >= MW || y >= MH) return 9999;
  const d = field.dist[y * MW + x];
  return d < 0 ? 9999 : d;
}


/* =========================================================================
   Part 3 — BALDI.  Hand-built from primitives, rebuilt to match the
   original Anim8or model: lanky, egg-headed, boxy green shirt, long blue
   legs, orange shoes, and a twelve-inch ruler.
   Four moods drive the face: neutral, annoyed, angry, furious.
   ========================================================================= */

const MAT = {};
function initMats() {
  const L = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  MAT.skin      = L(0xe8cba4);   // that pale tan
  MAT.skinDark  = L(0xcfae83);
  MAT.shirt     = L(0x18c21c);   // bright green
  MAT.shirtDark = L(0x0e9412);
  MAT.pants     = L(0x2a2ad8);   // royal blue
  MAT.shoe      = L(0xf08a1e);   // orange
  MAT.white     = L(0xfdfdf6);
  MAT.black     = new THREE.MeshBasicMaterial({ color: 0x141414 });
  MAT.brow      = L(0xa8702a);
  MAT.lip       = L(0xd4646c);
  MAT.mouth     = L(0x5c1a1a);
  MAT.tongue    = L(0xc4585c);
  MAT.wood      = L(0xe0c188);
  MAT.suit      = L(0x2f3d55);
  MAT.suitDark  = L(0x222c3d);
  MAT.tie       = L(0xa32626);
  MAT.dress     = L(0xf07cc0);
  MAT.dressDark = L(0xd0559f);
  MAT.hair      = L(0x6b3f1d);
  MAT.hairBlonde= L(0xe0c060);
  MAT.bullyShirt= L(0xc94f3a);
  MAT.broom     = L(0x2f8ad6);
  MAT.bristle   = L(0xe8d26a);
  MAT.metal     = L(0xb9c2cc);
  MAT.sock      = L(0x3fa85a);
  MAT.sockDark  = L(0x2c7d42);
  MAT.robotRed  = L(0xd23a3a);
  MAT.robotBody = L(0xdfe4ea);
  MAT.robotBlue = L(0x2f6fd0);
  MAT.cloud     = L(0xf2f6ff);
  MAT.cloudDark = L(0xcdd8ea);
  MAT.beanBody  = L(0x8fd14f);
  MAT.gum       = L(0xff8fc8);
  MAT.chalk     = L(0xf2f2e6);
}

/* small primitive helpers ------------------------------------------------ */
function sph(r, mat, sx, sy, sz, seg) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg || 16, (seg || 16) - 4), mat);
  if (sx !== undefined) m.scale.set(sx, sy, sz);
  return m;
}
function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cyl(rt, rb, h, mat, seg) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 14), mat); }
function cone(r, h, mat, seg) { return new THREE.Mesh(new THREE.ConeGeometry(r, h, seg || 14), mat); }
/* a box with rounded ends, faked with two end-cap spheres — reads like the
   soft-edged primitives the original models were built from */
function capsuleBox(w, h, d, mat) {
  const g = new THREE.Group();
  g.add(box(w, h - Math.min(w, d) * 0.5, d, mat));
  const r = Math.min(w, d) * 0.5;
  const top = sph(r, mat, w / (2 * r), 0.55, d / (2 * r), 12);
  top.position.y = (h - Math.min(w, d) * 0.5) / 2; g.add(top);
  const bot = top.clone(); bot.position.y = -top.position.y; g.add(bot);
  return g;
}
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

/* =========================================================================
   makeBaldi() — returns { root, update(dt, opts), doSlap(), setMood() }
   ========================================================================= */
function makeBaldi() {
  const root = new THREE.Group();
  const SKIN = MAT.skin.clone(), SKIND = MAT.skinDark.clone();

  /* ---------------- legs: long, thin, royal blue ---------------- */
  const legs = new THREE.Group(); root.add(legs);
  const legL = new THREE.Group(), legR = new THREE.Group();
  [[legL, -0.34], [legR, 0.34]].forEach(([g, x]) => {
    g.position.set(x, 3.05, 0);
    const thigh = cyl(0.21, 0.19, 2.9, MAT.pants, 12);
    thigh.position.y = -1.45; g.add(thigh);
    const knee = sph(0.20, MAT.pants, 1, 1, 1, 10); knee.position.y = -1.5; g.add(knee);
    // orange wedge shoe
    const shoe = box(0.44, 0.26, 0.86, MAT.shoe);
    shoe.position.set(0, -2.98, 0.20); g.add(shoe);
    const toe = sph(0.22, MAT.shoe, 1.0, 0.58, 1.05, 10);
    toe.position.set(0, -2.96, 0.58); g.add(toe);
    legs.add(g);
  });

  /* ---------------- torso: boxy green shirt ---------------- */
  const torso = new THREE.Group();
  torso.position.y = 3.05; root.add(torso);

  const shirt = capsuleBox(1.44, 2.40, 0.90, MAT.shirt);
  shirt.position.y = 1.16; torso.add(shirt);
  const shoulders = sph(0.74, MAT.shirt, 1.02, 0.52, 0.62, 16);
  shoulders.position.y = 2.32; torso.add(shoulders);
  // the hem sits a little proud, like the original's stacked boxes
  const hem = box(1.48, 0.14, 0.94, MAT.shirtDark);
  hem.position.y = 0.04; torso.add(hem);

  /* ---------------- arms: green sleeves all the way to the wrist ------- */
  function makeArm(side) {
    const g = new THREE.Group();
    g.position.set(side * 0.74, 2.24, 0);
    const sleeve = capsuleBox(0.46, 1.55, 0.46, MAT.shirt);
    sleeve.position.y = -0.72; g.add(sleeve);
    const fore = new THREE.Group(); fore.position.y = -1.45; g.add(fore);
    const lower = capsuleBox(0.42, 1.35, 0.42, MAT.shirt);
    lower.position.y = -0.62; fore.add(lower);
    const cuff = box(0.44, 0.10, 0.44, MAT.shirtDark);
    cuff.position.y = -1.26; fore.add(cuff);
    const hand = sph(0.27, SKIN, 1.0, 0.92, 0.85, 12);
    hand.position.y = -1.45; fore.add(hand);
    const thumb = sph(0.10, SKIN, 1.3, 1, 1, 8);
    thumb.position.set(side * -0.20, -1.38, 0.10); fore.add(thumb);
    return { g, fore, hand };
  }
  const armL = makeArm(-1), armR = makeArm(1);
  torso.add(armL.g); torso.add(armR.g);

  /* ---------------- THE RULER ---------------- */
  const ruler = new THREE.Group();
  const blade = box(0.14, 0.42, 3.1, MAT.wood);
  blade.material = new THREE.MeshLambertMaterial({ map: TEX.rulerFace, color: 0xffffff });
  blade.position.z = 1.15;
  ruler.add(blade);
  const edge = box(0.155, 0.05, 3.1, new THREE.MeshLambertMaterial({ color: 0xb08a4e }));
  edge.position.set(0, 0.22, 1.15); ruler.add(edge);
  ruler.position.set(0.26, -1.40, 0.42);
  ruler.rotation.x = -1.42;                 // blade straight up, clear of the sleeve
  ruler.rotation.z = 0.12;
  armR.fore.add(ruler);

  /* ---------------- head: an egg, entirely bald ---------------- */
  const head = new THREE.Group();
  head.position.y = 6.05; root.add(head);

  const skull = sph(1.06, SKIN, 0.93, 1.14, 0.95, 24);
  head.add(skull);
  const crown = sph(0.78, SKIN, 0.95, 0.85, 0.95, 18);   // slight dome on top
  crown.position.y = 0.58; head.add(crown);
  const shine = sph(0.26, new THREE.MeshBasicMaterial({ color: 0xfff4e4, transparent: true, opacity: 0.5 }),
    1.5, 0.45, 1.1, 10);
  shine.position.set(-0.24, 0.92, 0.30); head.add(shine);
  [-1, 1].forEach(s => {
    const ear = sph(0.24, SKIN, 0.35, 0.95, 0.8, 10);
    ear.position.set(s * 0.99, -0.10, -0.04); head.add(ear);
  });
  const jaw = sph(0.80, SKIN, 1.0, 0.70, 0.98, 16);
  jaw.position.set(0, -0.62, 0.06); head.add(jaw);

  const face = new THREE.Group(); head.add(face);

  /* --- eyes: big white ovals with a thin dark rim --- */
  function makeEye(side) {
    const g = new THREE.Group();
    g.position.set(side * 0.42, 0.22, 0.82);
    const rim = sph(0.30, MAT.black, 1.02, 1.24, 0.40, 18); g.add(rim);
    /* its own material, not the shared one: the DJ scene recolours the eye
       whites for the fire, and a shared material would leave every Baldi in
       the game bloodshot for the rest of the session */
    const white = sph(0.30, MAT.white.clone(), 0.90, 1.13, 0.52, 18);
    white.position.z = 0.055; g.add(white);
    const pupilG = new THREE.Group(); pupilG.position.z = 0.155; g.add(pupilG);
    pupilG.add(sph(0.105, MAT.black, 1.0, 1.15, 0.6, 12));
    const glint = sph(0.036, new THREE.MeshBasicMaterial({ color: 0xffffff }), 1, 1, 0.6, 8);
    glint.position.set(-0.04, 0.05, 0.09); pupilG.add(glint);
    const lid = sph(0.31, SKIN, 0.98, 1.0, 0.56, 12);
    lid.position.set(0, 0.60, -0.55); g.add(lid);
    return { g, pupilG, lid, white };
  }
  const eyeL = makeEye(-1), eyeR = makeEye(1);
  face.add(eyeL.g); face.add(eyeR.g);

  /* --- thin arched eyebrows, set high and wide --- */
  function makeBrow(side) {
    const g = new THREE.Group();
    g.position.set(side * 0.44, 0.56, 0.90);
    for (let i = 0; i < 5; i++) {                        // arch built from segments
      const t = (i - 2) / 2;
      const seg = box(0.14, 0.062, 0.085, MAT.brow);
      seg.position.set(t * 0.24, -Math.abs(t) * 0.055, -Math.abs(t) * 0.05);
      g.add(seg);
    }
    return g;
  }
  const browL = makeBrow(-1), browR = makeBrow(1);
  face.add(browL); face.add(browR);
  /* The soft arch reads as a dot once it's rotated hard, so anger swaps in a
     straight thick slash instead — inner ends driven down toward the nose. */
  const angryBrows = [-1, 1].map(sd => {
    const b = box(0.68, 0.115, 0.11, MAT.brow);
    b.position.set(sd * 0.44, 0.50, 0.93);
    b.rotation.z = sd * 0.46;
    b.visible = false;
    face.add(b);
    return b;
  });

  /* --- nose: long, pointed, tipped down --- */
  const nose = new THREE.Group();
  nose.position.set(0, -0.08, 0.80); face.add(nose);
  const bridge = sph(0.25, SKIN, 0.88, 1.15, 1.55, 14);
  bridge.position.z = 0.18; nose.add(bridge);
  const tip = cone(0.21, 0.66, SKIN, 14);
  tip.rotation.x = Math.PI * 0.58; tip.position.set(0, -0.15, 0.46); nose.add(tip);

  /* --- mouth: two versions, cross-faded by mood --- */
  const mouth = new THREE.Group();
  mouth.position.set(0, -0.52, 0.70); face.add(mouth);

  // NEUTRAL: a simple pink smile line
  const calmMouth = new THREE.Group(); mouth.add(calmMouth);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.40, 0.052, 8, 22, Math.PI * 0.92), MAT.lip);
  smile.rotation.z = Math.PI * 1.04; smile.scale.set(1.28, 0.66, 1);
  smile.position.z = 0.14; calmMouth.add(smile);

  // ANGRY: an open maw with a row of teeth
  const talkO = sph(0.34, MAT.mouth, 1.30, 1.0, 0.45, 14);
  talkO.position.set(0, -0.10, 0.14); calmMouth.add(talkO); talkO.visible = false;

  const madMouth = new THREE.Group(); mouth.add(madMouth);

  /* The snarl is built upside-down on purpose: every curve in here arcs the
     WRONG way for a smile. The dark opening is a plain ellipsoid with no
     upward bias, the lower lip is a rainbow arc (high in the middle, ends
     dropping away) and the corner hooks angle down. There is no geometry
     here that can read as a grin. */
  const cave = sph(0.36, MAT.mouth, 1.34, 0.86, 0.55, 20);
  cave.position.y = -0.03; madMouth.add(cave);

  const tongue = sph(0.19, MAT.tongue, 1.15, 0.40, 0.80, 12);
  tongue.position.set(0, -0.23, 0.02); madMouth.add(tongue);

  // upper teeth, hung from a straight top edge
  const teeth = new THREE.Group(); teeth.position.z = 0.23; madMouth.add(teeth);
  for (let i = 0; i < 7; i++) {
    const t = box(0.118, 0.165, 0.11, MAT.white);
    t.position.set(-0.39 + i * 0.130, 0.075, 0); teeth.add(t);
    if (i < 6) {
      const gp = box(0.018, 0.165, 0.12, MAT.black);
      gp.position.set(-0.325 + i * 0.130, 0.075, 0.006); teeth.add(gp);
    }
  }

  // lower lip: a DOWN-turned arc — the ends fall below the middle
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.042, 8, 26, Math.PI), MAT.black);
  lip.rotation.z = 0;                      // top half of the torus = frown
  lip.scale.set(1.14, 0.58, 1);
  lip.position.set(0, -0.31, 0.20); madMouth.add(lip);

  // straight black upper edge
  const lipTop = box(1.00, 0.065, 0.11, MAT.black);
  lipTop.position.set(0, 0.175, 0.23); madMouth.add(lipTop);

  // corners angled downward
  const hooks = [];
  [-1, 1].forEach(s => {
    const hook = box(0.21, 0.065, 0.11, MAT.black);
    hook.position.set(s * 0.50, 0.075, 0.21); hook.rotation.z = s * 0.60;
    madMouth.add(hook); hooks.push({ m: hook, s: s });
  });
  madMouth.scale.setScalar(0.0001);

  /* ---------------- state ---------------- */
  const S = {
    root, head, torso, legs, legL, legR, armL, armR, ruler, face,
    eyeL, eyeR, browL, browR, mouth, calmMouth, madMouth, skull, SKIN,
    walk: 0, slapT: 0, slapDur: 0.42, anger: 0, mood: 0, talk: 0, bob: 0, blink: 0, blinkT: 2
  };

  /* mood: 0 neutral · 1 annoyed · 2 angry · 3 furious ------------------- */
  S.setMood = function (m) { S.moodTarget = m; };
  S.moodTarget = 0;

  S.update = function (dt, opt) {
    opt = opt || {};
    const moving = opt.speed > 0.05;
    // anger comes from the chase pace; mood can be forced for story beats
    const wanted = Math.max(clamp(opt.anger || 0, 0, 1) * 3, S.moodTarget);
    S.mood = lerp(S.mood, wanted, 1 - Math.exp(-dt * 4));
    const a = clamp(S.mood / 3, 0, 1);            // 0..1 overall rage
    S.anger = a;

    /* stride — long legs, big swing */
    S.walk += dt * (moving ? clamp(opt.speed * 0.40, 2.5, 13) : 0);
    const sw = Math.sin(S.walk);
    legL.rotation.x = sw * 0.80;
    legR.rotation.x = -sw * 0.80;
    armL.g.rotation.x = -sw * 0.50;
    armL.g.rotation.z = -0.10;
    armL.fore.rotation.x = -0.20 + Math.max(0, sw) * 0.20;

    S.bob = Math.abs(Math.cos(S.walk)) * (moving ? 0.15 : 0);
    torso.position.y = 3.05 + S.bob;
    head.position.y = 6.05 + S.bob * 1.04;
    torso.rotation.z = sw * 0.045;
    head.rotation.z = -sw * 0.04;

    /* ruler swing */
    if (S.slapT > 0) {
      S.slapT = Math.max(0, S.slapT - dt);
      const p = 1 - S.slapT / S.slapDur;
      if (p < 0.40) {
        const k = p / 0.40;
        armR.g.rotation.x = lerp(0.05, -1.85, k);
        armR.g.rotation.z = lerp(0.22, 0.80, k);
        armR.fore.rotation.x = lerp(-0.06, -1.15, k);
        ruler.rotation.x = lerp(-1.42, -1.85, k);
      } else {
        const k = (p - 0.40) / 0.60, e = 1 - Math.pow(1 - k, 3);
        armR.g.rotation.x = lerp(-1.85, 1.00, e);
        armR.g.rotation.z = lerp(0.80, 0.18, e);
        armR.fore.rotation.x = lerp(-1.15, 0.20, e);
        ruler.rotation.x = lerp(-1.85, -0.20, e);
      }
    } else {
      armR.g.rotation.x = lerp(armR.g.rotation.x, sw * 0.5, 1 - Math.exp(-dt * 8));
      armR.g.rotation.z = lerp(armR.g.rotation.z, 0.22, 1 - Math.exp(-dt * 8));
      armR.fore.rotation.x = lerp(armR.fore.rotation.x, -0.06, 1 - Math.exp(-dt * 8));
      ruler.rotation.x = lerp(ruler.rotation.x, -1.42, 1 - Math.exp(-dt * 8));
    }

    /* eyes track you, and blink now and then */
    if (opt.lookAt) {
      const local = head.worldToLocal(opt.lookAt.clone()).normalize();
      const px = clamp(local.x * 0.18, -0.10, 0.10);
      const py = clamp(local.y * 0.14, -0.08, 0.08);
      eyeL.pupilG.position.x = px; eyeL.pupilG.position.y = py;
      eyeR.pupilG.position.x = px; eyeR.pupilG.position.y = py;
    }
    S.blinkT -= dt;
    if (S.blinkT <= 0) { S.blinkT = rand(2.4, 6.0); S.blink = 0.16; }
    S.blink = Math.max(0, S.blink - dt);
    const blinking = S.blink > 0 ? 1 : 0;

    /* ---- the face: brows, lids, mouth ---- */
    const annoy = smoothstep(0.0, 0.42, a);      // brows start dropping early
    const rage  = smoothstep(0.30, 0.85, a);     // mouth opens later
    const fury  = smoothstep(0.75, 1.0, a);

    const browAngry = annoy > 0.25;
    browL.visible = browR.visible = !browAngry;
    angryBrows[0].visible = angryBrows[1].visible = browAngry;
    // inner ends driven DOWN toward the nose — the angry V
    angryBrows[0].position.y = angryBrows[1].position.y = lerp(0.52, 0.42, annoy);
    angryBrows[0].rotation.z = lerp(-0.28, -0.55, annoy);
    angryBrows[1].rotation.z = lerp(0.28, 0.55, annoy);
    browL.rotation.z = lerp(0.14, -0.30, annoy);
    browR.rotation.z = lerp(-0.14, 0.30, annoy);
    browL.position.y = lerp(0.58, 0.42, annoy);
    browR.position.y = browL.position.y;
    browL.position.x = lerp(-0.44, -0.36, annoy);
    browR.position.x = -browL.position.x;

    const lidDown = Math.max(annoy * 0.45, blinking);
    eyeL.lid.position.y = lerp(0.60, 0.16, lidDown);
    eyeL.lid.position.z = lerp(-0.55, 0.04, lidDown);
    eyeR.lid.position.y = eyeL.lid.position.y;
    eyeR.lid.position.z = eyeL.lid.position.z;
    const bulge = 1 + fury * 0.07;
    eyeL.g.scale.setScalar(bulge); eyeR.g.scale.setScalar(bulge);

    // talking makes the calm mouth open and close
    S.talk = Math.max(0, S.talk - dt);
    const talkOpen = S.talk > 0 ? (0.5 + 0.5 * Math.sin(G0.t * 22)) : 0;

    /* THREE mouths exist on this head and exactly ONE may ever be on screen.
       The old bug was the pink smile and the open talking mouth both drawing
       at once, so the smile rimmed the maw and he looked like he was laughing.
       Everything below is mutually exclusive by construction. */
    const angry   = a > 0.10;
    const talking = !angry && talkOpen > 0.06;

    calmMouth.visible = !angry;          // container for smile + talk
    madMouth.visible  = angry;           // the snarl
    smile.visible     = !angry && !talking;
    talkO.visible     = talking;

    if (talking) {
      talkO.scale.set(1.30, 0.30 + talkOpen * 0.95, 0.45);
    } else if (!angry) {
      smile.rotation.z = Math.PI * 1.04;
      smile.position.y = 0;
      smile.scale.set(1.28, 0.66, 1);
    } else {
      const gape = smoothstep(0.10, 0.80, a);
      madMouth.scale.set(0.94 + gape * 0.20, 0.62 + gape * 0.52, 1);
      hooks.forEach(h => {
        h.m.rotation.z = lerp(h.s * 0.62, h.s * 0.90, gape);
        h.m.position.y = lerp(0.075, -0.03, gape);
      });
      lip.scale.set(lerp(1.14, 1.26, gape), lerp(0.58, 0.72, gape), 1);
      cave.scale.set(lerp(1.34, 1.46, gape), lerp(0.86, 1.00, gape), 0.55);
    }

    mouth.position.y = lerp(-0.52, -0.56, rage);

    // skin flushes with fury
    S.SKIN.color.copy(new THREE.Color(0xe8cba4).lerp(new THREE.Color(0xdc8a6e), fury * 0.55));
    torso.rotation.x = lerp(0, 0.15, a);
    head.rotation.x = lerp(0, -0.07, a) + (opt.headTilt || 0);
  };

  S.doSlap = function (dur) { S.slapDur = dur || 0.42; S.slapT = S.slapDur; };
  S.say = function (secs) { S.talk = secs || 1.2; };
  return S;
}

/* a tiny global clock so the model can drive mouth flapping */
const G0 = { t: 0 };

/* =========================================================================
   2D Baldi face for the game-over jumpscare card
   ========================================================================= */
function drawBaldiFace(canvas) {
  const x = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  x.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2 + 10, R = W * 0.38;
  x.fillStyle = '#e8cba4';
  x.beginPath(); x.ellipse(cx, cy, R, R * 1.14, 0, 0, TAU); x.fill();
  x.strokeStyle = '#000'; x.lineWidth = W * 0.016; x.stroke();
  [-1, 1].forEach(s => {
    x.beginPath(); x.ellipse(cx + s * R * 0.96, cy + R * 0.02, R * 0.13, R * 0.24, 0, 0, TAU);
    x.fill(); x.stroke();
  });
  [-1, 1].forEach(s => {
    const ex = cx + s * R * 0.40, ey = cy - R * 0.22;
    x.fillStyle = '#fff';
    x.beginPath(); x.ellipse(ex, ey, R * 0.25, R * 0.33, 0, 0, TAU); x.fill();
    x.lineWidth = W * 0.02; x.strokeStyle = '#000'; x.stroke();
    x.fillStyle = '#000';
    x.beginPath(); x.ellipse(ex + s * R * 0.02, ey + R * 0.03, R * 0.10, R * 0.12, 0, 0, TAU); x.fill();
    x.fillStyle = '#fff';
    x.beginPath(); x.arc(ex - R * 0.03, ey - R * 0.03, R * 0.03, 0, TAU); x.fill();
  });
  x.strokeStyle = '#c98a3c'; x.lineWidth = W * 0.036; x.lineCap = 'round';
  x.beginPath(); x.moveTo(cx - R * 0.70, cy - R * 0.62); x.lineTo(cx - R * 0.16, cy - R * 0.34); x.stroke();
  x.beginPath(); x.moveTo(cx + R * 0.70, cy - R * 0.62); x.lineTo(cx + R * 0.16, cy - R * 0.34); x.stroke();
  // long nose
  x.fillStyle = '#e0bb93';
  x.beginPath(); x.moveTo(cx - R * 0.13, cy - R * 0.02); x.lineTo(cx + R * 0.13, cy - R * 0.02);
  x.lineTo(cx + R * 0.02, cy + R * 0.30); x.closePath(); x.fill();
  x.lineWidth = W * 0.01; x.strokeStyle = '#00000055'; x.stroke();
  // open maw
  x.fillStyle = '#5c1a1a';
  x.beginPath();
  x.moveTo(cx - R * 0.66, cy + R * 0.40);
  x.quadraticCurveTo(cx, cy + R * 1.06, cx + R * 0.66, cy + R * 0.40);
  x.closePath(); x.fill();
  x.lineWidth = W * 0.022; x.strokeStyle = '#000'; x.stroke();
  x.fillStyle = '#fff';
  for (let i = 0; i < 7; i++) {
    const tw = R * 0.175;
    x.fillRect(cx - R * 0.61 + i * tw, cy + R * 0.40, tw - 2, R * 0.16);
  }
  x.strokeStyle = '#000'; x.lineWidth = W * 0.007;
  x.strokeRect(cx - R * 0.61, cy + R * 0.40, R * 1.22, R * 0.16);
  x.fillStyle = '#18c21c';
  x.beginPath(); x.moveTo(cx - R * 0.95, H); x.lineTo(cx - R * 0.58, cy + R * 1.08);
  x.lineTo(cx + R * 0.58, cy + R * 1.08); x.lineTo(cx + R * 0.95, H); x.closePath(); x.fill();
}


/* =========================================================================
   The little live Baldi window in the corner of the You Can Think Pad.
   Drawn in 2D so it costs nothing next to the main scene. `anger` slides
   0 -> 1 and the face sours the whole way; `open` flaps the mouth.
   ========================================================================= */
function drawPadFace(canvas, anger, open) {
  const x = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  const a = clamp(anger, 0, 1), o = clamp(open, 0, 1);
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H * 0.44, R = W * 0.30;
  // shirt
  x.fillStyle = '#18c21c';
  x.beginPath();
  x.moveTo(cx - R * 1.5, H); x.lineTo(cx - R * 0.85, H - R * 0.62);
  x.lineTo(cx + R * 0.85, H - R * 0.62); x.lineTo(cx + R * 1.5, H);
  x.closePath(); x.fill();

  // head — flushes as he sours
  const skin = '#' + new THREE.Color(0xe8cba4).lerp(new THREE.Color(0xd07a5c), a * 0.75).getHexString();
  x.fillStyle = skin;
  x.beginPath(); x.ellipse(cx, cy, R, R * 1.16, 0, 0, TAU); x.fill();
  x.strokeStyle = '#3a2a1c'; x.lineWidth = W * 0.012; x.stroke();
  [-1, 1].forEach(s => {
    x.beginPath(); x.ellipse(cx + s * R * 0.98, cy + R * 0.05, R * 0.14, R * 0.24, 0, 0, TAU);
    x.fill(); x.stroke();
  });

  // eyes narrow a little with rage
  [-1, 1].forEach(s => {
    const ex = cx + s * R * 0.40, ey = cy - R * 0.22;
    x.fillStyle = '#fff';
    x.beginPath(); x.ellipse(ex, ey, R * 0.25, R * (0.33 - a * 0.09), 0, 0, TAU); x.fill();
    x.strokeStyle = '#111'; x.lineWidth = W * 0.018; x.stroke();
    x.fillStyle = '#111';
    x.beginPath(); x.ellipse(ex, ey + R * 0.03, R * 0.10, R * 0.12, 0, 0, TAU); x.fill();
  });

  // brows: level and friendly -> driven down into a V
  x.strokeStyle = '#a8702a'; x.lineWidth = W * 0.036; x.lineCap = 'round';
  const bOut = cy - R * (0.62 + a * 0.04), bIn = cy - R * (0.60 - a * 0.34);
  x.beginPath(); x.moveTo(cx - R * 0.70, bOut); x.lineTo(cx - R * 0.16, bIn); x.stroke();
  x.beginPath(); x.moveTo(cx + R * 0.70, bOut); x.lineTo(cx + R * 0.16, bIn); x.stroke();

  // nose
  x.fillStyle = '#' + new THREE.Color(0xdcbb92).lerp(new THREE.Color(0xc06a4e), a * 0.7).getHexString();
  x.beginPath();
  x.moveTo(cx - R * 0.12, cy - R * 0.02); x.lineTo(cx + R * 0.12, cy - R * 0.02);
  x.lineTo(cx + R * 0.02, cy + R * 0.30); x.closePath(); x.fill();

  // mouth: a friendly open oval that hardens into a snarl
  const my = cy + R * 0.62;
  const mw = R * (0.52 + a * 0.20), mh = R * (0.10 + o * 0.34 + a * 0.10);
  x.fillStyle = a > 0.5 ? '#5c1a1a' : '#8a2b2b';
  x.beginPath(); x.ellipse(cx, my, mw, mh, 0, 0, TAU); x.fill();
  x.strokeStyle = '#111'; x.lineWidth = W * 0.020; x.stroke();
  if (a > 0.45) {                       // bared teeth once he's properly cross
    x.fillStyle = '#fff';
    const tw = (mw * 1.7) / 6;
    for (let i = 0; i < 6; i++) x.fillRect(cx - mw * 0.85 + i * tw, my - mh, tw - 1.5, mh * 0.78);
  } else if (o > 0.25) {                // tongue while he's chatting
    x.fillStyle = '#c4585c';
    x.beginPath(); x.ellipse(cx, my + mh * 0.42, mw * 0.42, mh * 0.32, 0, 0, TAU); x.fill();
  }
}


/* =========================================================================
   Part 4 — the rest of the faculty, plus pickups
   ========================================================================= */

/* generic cartoon eyes used by several characters */
function cartoonEyes(parent, y, z, spread, size, browColor) {
  const out = { pupils: [], brows: [] };
  [-1, 1].forEach(s => {
    const g = new THREE.Group();
    g.position.set(s * spread, y, z);
    g.add(sph(size, MAT.black, 1.05, 1.25, 0.4, 14));
    const w = sph(size, MAT.white, 0.88, 1.1, 0.5, 14); w.position.z = 0.05; g.add(w);
    const pg = new THREE.Group(); pg.position.z = 0.13; g.add(pg);
    pg.add(sph(size * 0.42, MAT.black, 1, 1.1, 0.6, 10));
    parent.add(g);
    out.pupils.push(pg);
    if (browColor) {
      const b = box(size * 1.5, size * 0.34, size * 0.34, browColor);
      b.position.set(s * spread, y + size * 1.5, z + 0.05);
      parent.add(b); out.brows.push(b);
    }
  });
  return out;
}

/* ---------------- Principal of the Thing ---------------- */
function makePrincipal() {
  const root = new THREE.Group();
  const legs = new THREE.Group(); root.add(legs);
  const legL = new THREE.Group(), legR = new THREE.Group();
  [[legL, -0.34], [legR, 0.34]].forEach(([g, x]) => {
    g.position.set(x, 2.1, 0);
    const t = cyl(0.26, 0.24, 1.95, MAT.suitDark); t.position.y = -0.98; g.add(t);
    const s = box(0.55, 0.30, 1.05, MAT.black); s.position.set(0, -1.95, 0.2); g.add(s);
    legs.add(g);
  });
  const torso = new THREE.Group(); torso.position.y = 2.1; root.add(torso);
  const jacket = cyl(0.72, 0.86, 2.1, MAT.suit, 16); jacket.position.y = 1.05; torso.add(jacket);
  const shirtF = box(0.5, 1.5, 0.1, MAT.white); shirtF.position.set(0, 1.35, 0.72); torso.add(shirtF);
  const tie = box(0.2, 1.0, 0.08, MAT.tie); tie.position.set(0, 1.2, 0.79); torso.add(tie);
  const knot = box(0.24, 0.2, 0.1, MAT.tie); knot.position.set(0, 1.8, 0.78); torso.add(knot);
  const lapelL = box(0.22, 1.0, 0.08, MAT.suitDark); lapelL.position.set(-0.34, 1.4, 0.7);
  lapelL.rotation.z = 0.18; torso.add(lapelL);
  const lapelR = lapelL.clone(); lapelR.position.x = 0.34; lapelR.rotation.z = -0.18; torso.add(lapelR);
  const sho = sph(0.82, MAT.suit, 1, 0.45, 0.72); sho.position.y = 2.08; torso.add(sho);

  function arm(side) {
    const g = new THREE.Group(); g.position.set(side * 0.78, 2.02, 0);
    const u = cyl(0.24, 0.2, 1.9, MAT.suit); u.position.y = -0.95; g.add(u);
    const h = sph(0.24, MAT.skin, 1, 0.85, 0.8); h.position.y = -2.0; g.add(h);
    return g;
  }
  const armL = arm(-1), armR = arm(1); torso.add(armL); torso.add(armR);

  const head = new THREE.Group(); head.position.y = 4.85; root.add(head);
  head.add(sph(0.92, MAT.skin, 0.92, 1.12, 0.9, 20));
  // receding dark hair
  const hair = sph(0.94, MAT.hair, 0.95, 0.72, 0.95, 18);
  hair.position.y = 0.34; head.add(hair);
  const hairBack = sph(0.9, MAT.hair, 0.98, 0.8, 0.6); hairBack.position.set(0, 0.1, -0.35); head.add(hairBack);
  [-1, 1].forEach(s => { const e = sph(0.2, MAT.skin, 0.4, 1, 0.85); e.position.set(s * 0.86, -0.05, 0); head.add(e); });
  const eyes = cartoonEyes(head, 0.16, 0.72, 0.34, 0.24, MAT.hair);
  // glasses
  [-1, 1].forEach(s => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 6, 16), MAT.black);
    r.position.set(s * 0.34, 0.16, 0.80); head.add(r);
  });
  const bridge = box(0.2, 0.05, 0.05, MAT.black); bridge.position.set(0, 0.16, 0.82); head.add(bridge);
  const nose = sph(0.2, MAT.skin, 0.75, 1.1, 1.3); nose.position.set(0, -0.16, 0.82); head.add(nose);
  const frown = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.055, 6, 16, Math.PI), MAT.black);
  frown.position.set(0, -0.68, 0.72); frown.scale.set(1, 0.7, 1); head.add(frown);
  // whistle
  const wh = sph(0.14, MAT.metal, 1.3, 0.8, 0.8); wh.position.set(0, 1.05, 0.6); torso.add(wh);

  const S = { root, head, torso, legs, legL, legR, armL, armR, eyes, walk: 0 };
  S.update = function (dt, o) {
    o = o || {};
    S.walk += dt * (o.speed > 0.05 ? clamp(o.speed * 0.45, 2, 12) : 0);
    const sw = Math.sin(S.walk);
    legL.rotation.x = sw * 0.7; legR.rotation.x = -sw * 0.7;
    armL.rotation.x = -sw * 0.6; armR.rotation.x = sw * 0.6;
    torso.position.y = 2.1 + Math.abs(Math.cos(S.walk)) * 0.1;
    head.position.y = 4.85 + Math.abs(Math.cos(S.walk)) * 0.1;
    if (o.lookAt) {
      const l = head.worldToLocal(o.lookAt.clone()).normalize();
      eyes.pupils.forEach(p => { p.position.x = clamp(l.x * 0.16, -0.09, 0.09); p.position.y = clamp(l.y * 0.12, -0.07, 0.07); });
    }
  };
  return S;
}

/* ---------------- Playtime -----------------------------------------------
   A flat decal, not a model — a single billboarded quad exactly like the
   original's 2D sprites. The artwork is drawn to a canvas at boot; if the
   player's own PNG is reachable it is swapped in over the top at runtime,
   so the file still works with no network at all.                          */
const PLAYTIME_URL =
  'https://raw.githubusercontent.com/wujiahui4-a11y/study-mathenmatics-G3-singapore-secondary/main/image.png';

function playtimeDecalTexture() {
  const W = 256, H = 384, { c, x } = cv(W, H);
  x.clearRect(0, 0, W, H);
  const cx = W / 2;
  const ink = (w) => { x.strokeStyle = '#1a1a1a'; x.lineWidth = w; };

  // legs + shoes
  x.fillStyle = '#f0d3ae';
  x.fillRect(cx - 26, 268, 20, 66); x.fillRect(cx + 6, 268, 20, 66);
  x.fillStyle = '#ffffff';
  x.fillRect(cx - 27, 316, 22, 20); x.fillRect(cx + 5, 316, 22, 20);
  x.fillStyle = '#8e2f6d';
  x.beginPath(); x.ellipse(cx - 16, 344, 18, 12, 0, 0, TAU); x.fill();
  x.beginPath(); x.ellipse(cx + 16, 344, 18, 12, 0, 0, TAU); x.fill();

  // dress
  x.fillStyle = '#f472c0';
  x.beginPath();
  x.moveTo(cx - 34, 168); x.lineTo(cx + 34, 168);
  x.lineTo(cx + 66, 278); x.lineTo(cx - 66, 278); x.closePath(); x.fill();
  ink(4); x.stroke();
  x.fillStyle = '#d0559f'; x.fillRect(cx - 62, 262, 124, 16);
  x.fillStyle = '#d0559f'; x.fillRect(cx - 30, 196, 60, 12);

  // arms out, holding the rope handles
  x.fillStyle = '#f0d3ae';
  x.save(); x.translate(cx - 40, 186); x.rotate(0.5); x.fillRect(-11, 0, 22, 76); x.restore();
  x.save(); x.translate(cx + 40, 186); x.rotate(-0.5); x.fillRect(-11, 0, 22, 76); x.restore();
  x.fillStyle = '#d0559f';
  x.beginPath(); x.arc(cx - 76, 250, 13, 0, TAU); x.fill();
  x.beginPath(); x.arc(cx + 76, 250, 13, 0, TAU); x.fill();

  // head
  x.fillStyle = '#f7dcb8';
  x.beginPath(); x.ellipse(cx, 112, 60, 66, 0, 0, TAU); x.fill();
  ink(4); x.stroke();

  // blonde hair: cap, fringe, pigtails
  x.fillStyle = '#f2ce54';
  x.beginPath(); x.ellipse(cx, 92, 63, 56, 0, Math.PI, TAU); x.fill();
  x.fillRect(cx - 63, 78, 126, 26);
  ink(3); x.strokeRect(cx - 63, 78, 126, 26);
  x.beginPath(); x.ellipse(cx - 78, 132, 24, 40, 0.2, 0, TAU); x.fill(); x.stroke();
  x.beginPath(); x.ellipse(cx + 78, 132, 24, 40, -0.2, 0, TAU); x.fill(); x.stroke();
  x.fillStyle = '#d0559f';
  x.beginPath(); x.arc(cx - 70, 100, 10, 0, TAU); x.fill();
  x.beginPath(); x.arc(cx + 70, 100, 10, 0, TAU); x.fill();

  // big cartoon eyes
  [-1, 1].forEach(sd => {
    const ex = cx + sd * 23;
    x.fillStyle = '#fff';
    x.beginPath(); x.ellipse(ex, 116, 17, 21, 0, 0, TAU); x.fill();
    ink(4); x.stroke();
    x.fillStyle = '#141414';
    x.beginPath(); x.ellipse(ex + sd * 2, 120, 8, 10, 0, 0, TAU); x.fill();
    x.fillStyle = '#fff';
    x.beginPath(); x.arc(ex - 3, 113, 3, 0, TAU); x.fill();
  });
  // rosy cheeks + smile
  x.fillStyle = 'rgba(240,140,150,.55)';
  x.beginPath(); x.arc(cx - 40, 142, 11, 0, TAU); x.fill();
  x.beginPath(); x.arc(cx + 40, 142, 11, 0, TAU); x.fill();
  ink(4); x.lineCap = 'round';
  x.beginPath(); x.arc(cx, 140, 22, 0.18 * Math.PI, 0.82 * Math.PI); x.stroke();

  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function makePlaytime() {
  const root = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    map: playtimeDecalTexture(), transparent: true, alphaTest: 0.45,
    side: THREE.DoubleSide, depthWrite: true
  });
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 5.9), mat);
  decal.position.y = 2.95;
  root.add(decal);
  const S = { root, decal, mat, t: 0, usingRemoteArt: false };

  /* Pull the artwork straight off the raw link at runtime — the image is never
     baked into this file, it is fetched live every time the game loads. The
     drawn decal above is only what you see if the link can't be reached. */
  const PLAYTIME_H = 5.9;
  (function loadArt() {
    let done = false;
    const apply = function (img) {
      if (done) return;
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      if (!iw || !ih) return;
      done = true;
      const t = new THREE.Texture(img);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true;
      t.needsUpdate = true;
      mat.map = t;
      mat.needsUpdate = true;
      // keep her feet on the floor and honour the source image's proportions
      const ar = iw / ih;
      decal.geometry.dispose();
      decal.geometry = new THREE.PlaneGeometry(PLAYTIME_H * ar, PLAYTIME_H);
      decal.position.y = PLAYTIME_H / 2;
      S.usingRemoteArt = true;
    };
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';          // raw.githubusercontent.com sends ACAO:*
      img.onload = function () { apply(img); };
      img.onerror = function () { };           // no network — keep the drawn decal
      img.src = PLAYTIME_URL;
      if (img.complete && img.naturalWidth) apply(img);
    } catch (e) { }
  })();

  // the rope she swings during the minigame
  const rope = new THREE.Group(); rope.position.set(0, 2.05, 0); root.add(rope);
  S.rope = rope;
  const ropeRing = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.075, 6, 44, TAU * 0.86),
    new THREE.MeshLambertMaterial({ color: 0xe8e0c0 }));
  rope.add(ropeRing);
  rope.visible = false;

  S.update = function (dt, o) {
    o = o || {};
    S.t += dt;
    // a decal always faces the viewer — that is the whole point of a decal
    if (G.camera) {
      decal.rotation.y = Math.atan2(G.camera.position.x - root.position.x,
                                    G.camera.position.z - root.position.z);
    }
    if (o.roping) { rope.visible = true; rope.rotation.x = o.ropePhase || 0; }
    else rope.visible = false;
  };
  return S;
}

/* ---------------- It's a Bully ---------------- */
function makeBully() {
  const root = new THREE.Group();
  const legs = new THREE.Group(); root.add(legs);
  const legL = new THREE.Group(), legR = new THREE.Group();
  [[legL, -0.36], [legR, 0.36]].forEach(([g, x]) => {
    g.position.set(x, 1.6, 0);
    const t = cyl(0.28, 0.26, 1.5, new THREE.MeshLambertMaterial({ color: 0x36506e }));
    t.position.y = -0.75; g.add(t);
    const s = box(0.55, 0.3, 0.95, MAT.shoe); s.position.set(0, -1.6, 0.18); g.add(s);
    legs.add(g);
  });
  const torso = new THREE.Group(); torso.position.y = 1.6; root.add(torso);
  const body = cyl(0.92, 1.0, 1.7, MAT.bullyShirt, 16); body.position.y = 0.85; torso.add(body);
  const stripe = cyl(1.02, 1.02, 0.3, new THREE.MeshLambertMaterial({ color: 0xf0e0c0 }), 16);
  stripe.position.y = 0.85; torso.add(stripe);
  const sho = sph(0.95, MAT.bullyShirt, 1, 0.5, 0.8); sho.position.y = 1.68; torso.add(sho);
  function arm(side) {
    const g = new THREE.Group(); g.position.set(side * 0.9, 1.6, 0);
    const u = cyl(0.26, 0.24, 1.3, MAT.bullyShirt); u.position.y = -0.4; g.add(u);
    const l = cyl(0.22, 0.2, 0.7, MAT.skin); l.position.y = -1.2; g.add(l);
    const h = sph(0.28, MAT.skin); h.position.y = -1.6; g.add(h);
    g.rotation.z = -side * 0.25;
    return g;
  }
  const armL = arm(-1), armR = arm(1); torso.add(armL); torso.add(armR);
  const head = new THREE.Group(); head.position.y = 3.5; root.add(head);
  head.add(sph(0.9, MAT.skin, 1.05, 0.95, 0.95, 20));
  const cap = sph(0.92, new THREE.MeshLambertMaterial({ color: 0x2f4f7f }), 1.04, 0.62, 1.02, 18);
  cap.position.y = 0.3; head.add(cap);
  const brim = box(1.5, 0.12, 0.7, new THREE.MeshLambertMaterial({ color: 0x25406b }));
  brim.position.set(0, 0.46, 0.8); brim.rotation.x = -0.12; head.add(brim);
  [-1, 1].forEach(s => { const e = sph(0.2, MAT.skin, 0.45, 1, 0.9); e.position.set(s * 0.88, -0.06, 0); head.add(e); });
  const eyes = cartoonEyes(head, 0.06, 0.76, 0.33, 0.24, MAT.black);
  eyes.brows.forEach((b, i) => { b.rotation.z = i === 0 ? -0.45 : 0.45; });
  const nose = sph(0.19, MAT.skin, 1, 0.9, 1.2); nose.position.set(0, -0.28, 0.86); head.add(nose);
  const smirk = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 6, 16, Math.PI * 0.8), MAT.black);
  smirk.rotation.z = Math.PI * 0.9; smirk.position.set(0.06, -0.5, 0.76); smirk.scale.set(1, 0.6, 1); head.add(smirk);

  const S = { root, head, torso, legs, legL, legR, armL, armR, eyes, walk: 0 };
  S.update = function (dt, o) {
    o = o || {};
    S.walk += dt * 2.2;
    const sw = Math.sin(S.walk);
    torso.position.y = 1.6 + Math.abs(sw) * 0.05;
    head.position.y = 3.5 + Math.abs(sw) * 0.05;
    head.rotation.z = sw * 0.05;
    if (o.lookAt) {
      const l = head.worldToLocal(o.lookAt.clone()).normalize();
      eyes.pupils.forEach(p => { p.position.x = clamp(l.x * 0.16, -0.09, 0.09); p.position.y = clamp(l.y * 0.12, -0.07, 0.07); });
    }
  };
  return S;
}

/* ---------------- Gotta Sweep ---------------- */
function makeSweep() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const handle = cyl(0.32, 0.42, 6.4, MAT.broom, 14); handle.position.y = 4.0; body.add(handle);
  const cap = sph(0.34, MAT.broom); cap.position.y = 7.25; body.add(cap);
  const head = box(3.6, 0.7, 0.9, new THREE.MeshLambertMaterial({ color: 0x1f6fb0 }));
  head.position.y = 1.15; body.add(head);
  const bris = box(3.5, 1.1, 0.8, MAT.bristle); bris.position.y = 0.55; body.add(bris);
  for (let i = 0; i < 14; i++) {
    const b = box(0.12, 1.3, 0.7, MAT.bristle);
    b.position.set(-1.7 + i * 0.26, 0.35, 0); body.add(b);
  }
  const faceG = new THREE.Group(); faceG.position.set(0, 5.6, 0); body.add(faceG);
  const eyes = cartoonEyes(faceG, 0, 0.36, 0.36, 0.3, null);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.06, 6, 14, Math.PI), MAT.black);
  mouth.rotation.z = Math.PI; mouth.position.set(0, -0.55, 0.34); faceG.add(mouth);

  const S = { root, body, faceG, eyes, t: 0 };
  S.update = function (dt, o) {
    o = o || {};
    S.t += dt;
    body.rotation.z = Math.sin(S.t * 7) * 0.28;
    body.position.y = Math.abs(Math.sin(S.t * 7)) * 0.3;
    if (o.lookAt) {
      const l = faceG.worldToLocal(o.lookAt.clone()).normalize();
      eyes.pupils.forEach(p => { p.position.x = clamp(l.x * 0.18, -0.1, 0.1); p.position.y = clamp(l.y * 0.14, -0.08, 0.08); });
    }
  };
  return S;
}

/* =========================================================================
   Pickups
   ========================================================================= */
function makeNotebookMesh() {
  const g = new THREE.Group();
  const cover = box(1.5, 0.22, 1.9, new THREE.MeshLambertMaterial({ map: TEX.notebook }));
  g.add(cover);
  const pages = box(1.4, 0.16, 1.78, MAT.white); pages.position.y = 0.04; g.add(pages);
  for (let i = 0; i < 5; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 5, 8), MAT.metal);
    r.rotation.y = Math.PI / 2; r.position.set(-0.74, 0.06, -0.7 + i * 0.35); g.add(r);
  }
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({ color: 0x88ddff, transparent: true, opacity: 0.16 }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = -0.6; g.add(glow);
  return g;
}

const ITEM_DEFS = {
  bsoda:    { name: 'BSODA', desc: 'Blasts a character far away' },
  zesty:    { name: 'ZESTY BAR', desc: 'Energy: run without tiring' },
  quarter:  { name: 'QUARTER', desc: 'Buy a soda from a machine' },
  scissors: { name: 'SAFETY SCISSORS', desc: 'Cut Playtime\'s rope' },
  clock:    { name: 'ALARM CLOCK', desc: 'Distracts Baldi with noise' },
  key:      { name: 'PRINCIPAL\'S KEYS', desc: 'Skip one detention' },
  tape:     { name: 'DOOR-STOP TAPE', desc: 'Tapes a lurker to the wall' }
};

function makeItemMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'bsoda') {
    const can = cyl(0.34, 0.34, 1.1, new THREE.MeshLambertMaterial({ color: 0x3a5fd0 }), 14);
    g.add(can);
    const lbl = cyl(0.35, 0.35, 0.5, new THREE.MeshLambertMaterial({ color: 0xe8e8f5 }), 14);
    g.add(lbl);
    const top = cyl(0.3, 0.34, 0.1, MAT.metal, 14); top.position.y = 0.58; g.add(top);
  } else if (kind === 'zesty') {
    const bar = box(0.5, 1.1, 0.24, new THREE.MeshLambertMaterial({ color: 0xd83a2a }));
    g.add(bar);
    const s = box(0.52, 0.28, 0.26, new THREE.MeshLambertMaterial({ color: 0xf5d34a }));
    g.add(s);
  } else if (kind === 'quarter') {
    const c = cyl(0.42, 0.42, 0.08, MAT.metal, 20); c.rotation.x = Math.PI / 2; g.add(c);
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.04, 6, 20),
      new THREE.MeshLambertMaterial({ color: 0x8e959c }));
    g.add(r);
  } else if (kind === 'scissors') {
    const a = box(0.1, 1.0, 0.05, MAT.metal); a.rotation.z = 0.22; g.add(a);
    const b = box(0.1, 1.0, 0.05, MAT.metal); b.rotation.z = -0.22; g.add(b);
    [-1, 1].forEach(s => {
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 6, 14),
        new THREE.MeshLambertMaterial({ color: 0xd83a8a }));
      h.position.set(s * 0.2, -0.6, 0); g.add(h);
    });
  } else if (kind === 'clock') {
    const c = cyl(0.42, 0.42, 0.3, new THREE.MeshLambertMaterial({ color: 0xd23a3a }), 18);
    c.rotation.x = Math.PI / 2; g.add(c);
    const f = cyl(0.34, 0.34, 0.32, MAT.white, 18); f.rotation.x = Math.PI / 2; g.add(f);
    [-1, 1].forEach(s => { const b = sph(0.16, MAT.metal); b.position.set(s * 0.34, 0.4, 0); g.add(b); });
    const hand = box(0.04, 0.26, 0.02, MAT.black); hand.position.set(0, 0.1, 0.18); g.add(hand);
  } else if (kind === 'tape') {
    const roll = cyl(0.42, 0.42, 0.36, new THREE.MeshLambertMaterial({ color: 0xdcd0a8 }), 16);
    roll.rotation.x = Math.PI / 2; g.add(roll);
    const holeR = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.07, 6, 16),
      new THREE.MeshLambertMaterial({ color: 0xb8a878 }));
    g.add(holeR);
    const tail = box(0.5, 0.03, 0.34, new THREE.MeshLambertMaterial({ color: 0xf0e8cc }));
    tail.position.set(0.5, -0.3, 0); g.add(tail);
  } else if (kind === 'key') {
    const shaft = box(0.08, 0.9, 0.08, new THREE.MeshLambertMaterial({ color: 0xd8c060 }));
    g.add(shaft);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 6, 14),
      new THREE.MeshLambertMaterial({ color: 0xd8c060 }));
    ring.position.y = 0.55; g.add(ring);
    const t1 = box(0.22, 0.08, 0.08, new THREE.MeshLambertMaterial({ color: 0xd8c060 }));
    t1.position.set(0.12, -0.32, 0); g.add(t1);
  }
  return g;
}

/* HUD icons drawn on tiny canvases */
function drawItemIcon(canvas, kind) {
  const x = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  x.clearRect(0, 0, W, H);
  const S = W / 32;
  const R = (px, py, pw, ph, col) => { x.fillStyle = col; x.fillRect(px * S, py * S, pw * S, ph * S); };
  if (kind === 'bsoda') {
    R(11, 4, 10, 24, '#3a5fd0'); R(11, 12, 10, 8, '#e8e8f5');
    R(11, 3, 10, 3, '#b9c2cc'); R(13, 14, 6, 4, '#3a5fd0');
    x.fillStyle = '#fff'; x.font = 'bold ' + (5 * S) + 'px sans-serif'; x.textAlign = 'center';
    x.fillText('B', 16 * S, 18 * S);
  } else if (kind === 'zesty') {
    R(7, 9, 18, 14, '#d83a2a'); R(7, 14, 18, 4, '#f5d34a');
    R(7, 9, 18, 2, '#a82a1c');
    x.fillStyle = '#fff'; x.font = 'bold ' + (4 * S) + 'px sans-serif'; x.textAlign = 'center';
    x.fillText('ZESTY', 16 * S, 13.5 * S);
  } else if (kind === 'quarter') {
    x.fillStyle = '#b9c2cc'; x.beginPath(); x.arc(16 * S, 16 * S, 11 * S, 0, TAU); x.fill();
    x.strokeStyle = '#7d858d'; x.lineWidth = 1.6 * S; x.stroke();
    x.fillStyle = '#5c646c'; x.font = 'bold ' + (9 * S) + 'px serif'; x.textAlign = 'center';
    x.fillText('25', 16 * S, 19.5 * S);
  } else if (kind === 'scissors') {
    x.strokeStyle = '#c8d0d8'; x.lineWidth = 2.4 * S; x.lineCap = 'round';
    x.beginPath(); x.moveTo(10 * S, 6 * S); x.lineTo(21 * S, 21 * S); x.stroke();
    x.beginPath(); x.moveTo(22 * S, 6 * S); x.lineTo(11 * S, 21 * S); x.stroke();
    x.strokeStyle = '#e0559f'; x.lineWidth = 2 * S;
    x.beginPath(); x.arc(11 * S, 24 * S, 3.4 * S, 0, TAU); x.stroke();
    x.beginPath(); x.arc(21 * S, 24 * S, 3.4 * S, 0, TAU); x.stroke();
  } else if (kind === 'clock') {
    x.fillStyle = '#d23a3a'; x.beginPath(); x.arc(16 * S, 17 * S, 11 * S, 0, TAU); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(16 * S, 17 * S, 8 * S, 0, TAU); x.fill();
    x.strokeStyle = '#222'; x.lineWidth = 1.4 * S;
    x.beginPath(); x.moveTo(16 * S, 17 * S); x.lineTo(16 * S, 11 * S); x.stroke();
    x.beginPath(); x.moveTo(16 * S, 17 * S); x.lineTo(20 * S, 18 * S); x.stroke();
    x.fillStyle = '#b9c2cc';
    x.beginPath(); x.arc(8 * S, 7 * S, 3.4 * S, 0, TAU); x.fill();
    x.beginPath(); x.arc(24 * S, 7 * S, 3.4 * S, 0, TAU); x.fill();
  } else if (kind === 'tape') {
    const roll = cyl(0.42, 0.42, 0.36, new THREE.MeshLambertMaterial({ color: 0xdcd0a8 }), 16);
    roll.rotation.x = Math.PI / 2; g.add(roll);
    const holeR = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.07, 6, 16),
      new THREE.MeshLambertMaterial({ color: 0xb8a878 }));
    g.add(holeR);
    const tail = box(0.5, 0.03, 0.34, new THREE.MeshLambertMaterial({ color: 0xf0e8cc }));
    tail.position.set(0.5, -0.3, 0); g.add(tail);
  } else if (kind === 'tape') {
    x.fillStyle = '#dcd0a8'; x.beginPath(); x.arc(16 * S, 16 * S, 11 * S, 0, TAU); x.fill();
    x.fillStyle = '#0000'; x.globalCompositeOperation = 'destination-out';
    x.beginPath(); x.arc(16 * S, 16 * S, 4.5 * S, 0, TAU); x.fill();
    x.globalCompositeOperation = 'source-over';
    x.strokeStyle = '#a89a70'; x.lineWidth = 1.6 * S;
    x.beginPath(); x.arc(16 * S, 16 * S, 11 * S, 0, TAU); x.stroke();
    x.fillStyle = '#f0e8cc'; x.fillRect(24 * S, 20 * S, 8 * S, 3 * S);
  } else if (kind === 'key') {
    x.strokeStyle = '#d8c060'; x.lineWidth = 2.6 * S;
    x.beginPath(); x.arc(16 * S, 9 * S, 5 * S, 0, TAU); x.stroke();
    x.beginPath(); x.moveTo(16 * S, 14 * S); x.lineTo(16 * S, 26 * S); x.stroke();
    x.beginPath(); x.moveTo(16 * S, 22 * S); x.lineTo(21 * S, 22 * S); x.stroke();
  }
}


/* =========================================================================
   Part 4b — the characters that were missing:
   Arts and Crafters · 1st Prize · Chalkles · Cloudy Copter · Beans
   ========================================================================= */

/* ---------------- Arts and Crafters -------------------------------------
   A green sock puppet on a pole.  Hates being looked at — stare too long and
   he drags you somewhere else entirely.                                    */
function makeCrafters() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);

  const pole = cyl(0.16, 0.20, 3.4, new THREE.MeshLambertMaterial({ color: 0x8a6238 }), 10);
  pole.position.y = 1.7; body.add(pole);
  // purple cuff where the arm would go in
  const cuff = cyl(0.42, 0.46, 0.7, new THREE.MeshLambertMaterial({ color: 0x6d4b9e }), 12);
  cuff.position.y = 3.35; body.add(cuff);

  const sockG = new THREE.Group(); sockG.position.y = 4.1; body.add(sockG);
  const sock = sph(0.62, MAT.sock, 0.92, 1.0, 1.45, 18);
  sock.position.z = 0.22; sockG.add(sock);
  const back = sph(0.55, MAT.sockDark, 1.0, 1.0, 0.8, 14);
  back.position.z = -0.35; sockG.add(back);
  // the mouth: a dark wedge that opens
  const jaw = new THREE.Group(); jaw.position.set(0, -0.10, 0.52); sockG.add(jaw);
  const maw = new THREE.Mesh(new THREE.SphereGeometry(0.52, 16, 10, 0, TAU, Math.PI * 0.52, Math.PI * 0.48),
    new THREE.MeshLambertMaterial({ color: 0x7a1d2b }));
  maw.scale.set(0.9, 0.7, 1.3); jaw.add(maw);
  const lowerLip = sph(0.5, MAT.sockDark, 0.92, 0.34, 1.2, 14);
  lowerLip.position.set(0, -0.22, 0.14); jaw.add(lowerLip);

  // two big googly eyes stuck on top
  const eyes = { pupils: [] };
  [-1, 1].forEach(s => {
    const g = new THREE.Group();
    g.position.set(s * 0.31, 0.40, 0.80); sockG.add(g);
    g.add(sph(0.25, MAT.white, 1, 1, 1, 14));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 6, 16), MAT.black);
    rim.position.z = 0.10; g.add(rim);
    const pg = new THREE.Group(); pg.position.z = 0.16; g.add(pg);
    pg.add(sph(0.10, MAT.black, 1, 1, 0.7, 10));
    eyes.pupils.push(pg);
  });

  const S = { root, body, sockG, jaw, eyes, t: 0, stare: 0 };
  S.update = function (dt, o) {
    o = o || {};
    S.t += dt;
    const staring = clamp(o.stare || 0, 0, 1);
    // he shrinks back and gapes when watched
    body.position.y = Math.sin(S.t * 2.4) * 0.10 - staring * 0.35;
    sockG.rotation.x = lerp(0.10, -0.30, staring);
    jaw.rotation.x = lerp(-0.05, 0.55, staring);
    body.rotation.z = Math.sin(S.t * 1.7) * 0.05;
    if (o.lookAt) {
      const l = sockG.worldToLocal(o.lookAt.clone()).normalize();
      eyes.pupils.forEach(p => {
        p.position.x = clamp(l.x * 0.12, -0.08, 0.08);
        p.position.y = clamp(l.y * 0.10, -0.06, 0.06);
      });
    }
  };
  return S;
}

/* ---------------- 1st Prize ---------------------------------------------
   Science-fair robot on one wheel.  Charges in straight lines, turns like a
   shopping trolley, and hugs whatever it hits.                             */
function makePrize() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);

  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.34, 10, 20),
    new THREE.MeshLambertMaterial({ color: 0x2b2f36 }));
  wheel.rotation.y = Math.PI / 2; wheel.position.y = 0.9; body.add(wheel);
  const hub = cyl(0.32, 0.32, 0.5, MAT.metal, 12);
  hub.rotation.z = Math.PI / 2; hub.position.y = 0.9; body.add(hub);

  const chassis = cyl(0.85, 0.95, 2.6, MAT.robotBody, 16);
  chassis.position.y = 2.4; body.add(chassis);
  const stripe = cyl(0.97, 0.97, 0.5, MAT.robotRed, 16);
  stripe.position.y = 2.2; body.add(stripe);
  const stripe2 = cyl(0.97, 0.97, 0.28, MAT.robotBlue, 16);
  stripe2.position.y = 1.6; body.add(stripe2);

  // the blue prize ribbon
  const rosette = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12), MAT.robotBlue);
  rosette.position.set(0, 2.9, 0.96); body.add(rosette);
  for (let i = 0; i < 2; i++) {
    const tail = box(0.2, 0.7, 0.05, MAT.robotBlue);
    tail.position.set((i - 0.5) * 0.34, 2.4, 0.96); body.add(tail);
  }
  const one = box(0.1, 0.34, 0.05, MAT.white);
  one.position.set(0, 2.9, 1.0); body.add(one);

  const headG = new THREE.Group(); headG.position.y = 4.2; body.add(headG);
  const head = box(1.5, 1.15, 1.25, MAT.robotBody); headG.add(head);
  const visor = box(1.3, 0.5, 0.1, new THREE.MeshLambertMaterial({ color: 0x1b2430 }));
  visor.position.set(0, 0.12, 0.64); headG.add(visor);
  const eyes = { pupils: [] };
  [-1, 1].forEach(s => {
    const g = new THREE.Group(); g.position.set(s * 0.34, 0.12, 0.68); headG.add(g);
    g.add(sph(0.21, MAT.white, 1, 1, 0.7, 12));
    const pg = new THREE.Group(); pg.position.z = 0.11; g.add(pg);
    pg.add(sph(0.09, MAT.black, 1, 1, 0.7, 10));
    eyes.pupils.push(pg);
  });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.05, 6, 14, Math.PI), MAT.black);
  smile.rotation.z = Math.PI; smile.position.set(0, -0.30, 0.64); headG.add(smile);
  const ant = cyl(0.05, 0.05, 0.8, MAT.metal, 6); ant.position.y = 0.95; headG.add(ant);
  const bulb = sph(0.16, MAT.robotRed, 1, 1, 1, 10); bulb.position.y = 1.4; headG.add(bulb);

  // hug arms
  function arm(side) {
    const g = new THREE.Group(); g.position.set(side * 0.95, 3.3, 0);
    const u = cyl(0.20, 0.18, 1.5, MAT.metal, 10);
    u.rotation.x = Math.PI / 2; u.position.z = 0.75; g.add(u);
    const claw = sph(0.28, MAT.robotRed, 1, 1, 1, 10); claw.position.z = 1.55; g.add(claw);
    return g;
  }
  const armL = arm(-1), armR = arm(1); body.add(armL); body.add(armR);

  const S = { root, body, headG, eyes, armL, armR, bulb, t: 0 };
  S.update = function (dt, o) {
    o = o || {};
    S.t += dt;
    wheel.rotation.x -= (o.speed || 0) * dt * 1.1;
    body.position.y = Math.abs(Math.sin(S.t * 9)) * 0.08 * (o.speed > 0.1 ? 1 : 0);
    body.rotation.z = Math.sin(S.t * 9) * 0.05 * (o.speed > 0.1 ? 1 : 0);
    const hug = clamp(o.hug || 0, 0, 1);
    armL.rotation.y = lerp(-0.15, 0.85, hug);
    armR.rotation.y = lerp(0.15, -0.85, hug);
    bulb.material = hug > 0.5 || Math.sin(S.t * 8) > 0 ? MAT.robotRed : MAT.metal;
    if (o.lookAt) {
      const l = headG.worldToLocal(o.lookAt.clone()).normalize();
      eyes.pupils.forEach(p => {
        p.position.x = clamp(l.x * 0.10, -0.06, 0.06);
        p.position.y = clamp(l.y * 0.08, -0.05, 0.05);
      });
    }
  };
  return S;
}

/* ---------------- Chalkles ----------------------------------------------
   A face drawn in chalk.  Pops off a classroom board and blinds you with
   chalk dust.                                                              */
function chalkFaceTexture(mad) {
  const S = 128, { c, x } = cv(S, S);
  x.clearRect(0, 0, S, S);
  x.strokeStyle = '#f4f4e8'; x.fillStyle = '#f4f4e8';
  x.lineWidth = 4; x.lineCap = 'round';
  // rough chalk circle
  x.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * TAU, r = 52 + Math.sin(i * 3.1) * 2.4;
    const px = S / 2 + Math.cos(a) * r, py = S / 2 + Math.sin(a) * r;
    i ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.stroke();
  // eyes
  [-1, 1].forEach(s => {
    x.beginPath(); x.ellipse(S / 2 + s * 20, S / 2 - 12, 9, mad ? 7 : 11, 0, 0, TAU); x.fill();
  });
  // brows
  x.lineWidth = 5;
  if (mad) {
    x.beginPath(); x.moveTo(S / 2 - 34, S / 2 - 34); x.lineTo(S / 2 - 8, S / 2 - 20); x.stroke();
    x.beginPath(); x.moveTo(S / 2 + 34, S / 2 - 34); x.lineTo(S / 2 + 8, S / 2 - 20); x.stroke();
  }
  // grin
  x.lineWidth = 5;
  x.beginPath(); x.arc(S / 2, S / 2 + 6, 28, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
  if (mad) for (let i = 0; i < 5; i++) {
    x.fillRect(S / 2 - 22 + i * 11, S / 2 + 24, 8, 8);
  }
  return texFrom(c, 1, 1);
}
function makeChalkles() {
  const root = new THREE.Group();
  const calm = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0),
    new THREE.MeshBasicMaterial({ map: chalkFaceTexture(false), transparent: true }));
  const mad = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6),
    new THREE.MeshBasicMaterial({ map: chalkFaceTexture(true), transparent: true }));
  mad.visible = false;
  root.add(calm); root.add(mad);
  const S = { root, calm, mad, t: 0 };
  S.update = function (dt, o) {
    o = o || {};
    S.t += dt;
    const angry = !!o.angry;
    calm.visible = !angry; mad.visible = angry;
    root.position.y = (o.baseY || 4.4) + Math.sin(S.t * 2.2) * 0.25;
    const s = 1 + Math.sin(S.t * 6) * (angry ? 0.09 : 0.03);
    calm.scale.setScalar(s); mad.scale.setScalar(s);
    if (o.faceCam && G.camera) root.rotation.y = Math.atan2(
      G.camera.position.x - root.position.x, G.camera.position.z - root.position.z);
  };
  return S;
}

/* ---------------- Cloudy Copter -----------------------------------------
   A cloud with a propeller.  Blows a gale down whichever hall he's in.     */
function makeCloudy() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const puffs = [[0, 0, 0, 1.15], [-1.0, -0.2, 0, 0.85], [1.0, -0.2, 0, 0.85],
                 [-0.55, 0.5, 0.1, 0.75], [0.55, 0.5, 0.1, 0.75], [0, -0.5, -0.3, 0.8]];
  for (const [px, py, pz, r] of puffs) {
    const p = sph(r, MAT.cloud, 1, 0.9, 1, 12);
    p.position.set(px, py, pz); body.add(p);
  }
  const under = sph(1.2, MAT.cloudDark, 1.1, 0.4, 1.0, 12);
  under.position.y = -0.6; body.add(under);

  const eyes = { pupils: [] };
  [-1, 1].forEach(s => {
    const g = new THREE.Group(); g.position.set(s * 0.42, 0.18, 1.0); body.add(g);
    g.add(sph(0.30, MAT.white, 1, 1.05, 0.55, 14));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.04, 6, 16), MAT.black);
    rim.position.z = 0.10; g.add(rim);
    const pg = new THREE.Group(); pg.position.z = 0.14; g.add(pg);
    pg.add(sph(0.12, MAT.black, 1, 1.1, 0.7, 10));
    eyes.pupils.push(pg);
  });
  const mouth = new THREE.Group(); mouth.position.set(0, -0.42, 0.95); body.add(mouth);
  const puckerOuter = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 8, 16), MAT.cloudDark);
  mouth.add(puckerOuter);
  const hole = sph(0.19, new THREE.MeshLambertMaterial({ color: 0x5a6478 }), 1, 1, 0.6, 12);
  hole.position.z = -0.02; mouth.add(hole);

  // propeller cap
  const cap = cyl(0.30, 0.42, 0.34, new THREE.MeshLambertMaterial({ color: 0xd93b3b }), 12);
  cap.position.y = 1.25; body.add(cap);
  const stick = cyl(0.06, 0.06, 0.35, MAT.metal, 6); stick.position.y = 1.55; body.add(stick);
  const prop = new THREE.Group(); prop.position.y = 1.75; body.add(prop);
  for (let i = 0; i < 3; i++) {
    const bl = box(1.5, 0.06, 0.30, new THREE.MeshLambertMaterial({ color: 0x2f6fd0 }));
    bl.rotation.y = (i / 3) * TAU; bl.rotation.z = 0.22;
    bl.position.set(Math.cos((i / 3) * TAU) * 0.7, 0, -Math.sin((i / 3) * TAU) * 0.7);
    prop.add(bl);
  }

  // the gust — a cone of translucent streaks in front of his mouth
  const gust = new THREE.Group(); gust.position.set(0, -0.42, 1.2); body.add(gust);
  const gustMat = new THREE.MeshBasicMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.35 });
  const streaks = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 5.0), gustMat);
    s.rotation.x = Math.PI / 2;
    s.position.set(rand(-1.2, 1.2), rand(-0.6, 0.8), 2.6);
    gust.add(s); streaks.push(s);
  }
  gust.visible = false;

  const S = { root, body, prop, gust, streaks, eyes, mouth, t: 0 };
  S.update = function (dt, o) {
    o = o || {};
    S.t += dt;
    prop.rotation.y += dt * 22;
    body.position.y = Math.sin(S.t * 1.8) * 0.30;
    const blowing = !!o.blowing;
    gust.visible = blowing;
    mouth.scale.setScalar(blowing ? 1.5 : 1.0);
    if (blowing) S.streaks.forEach((s, i) => {
      s.position.z = ((S.t * 14 + i * 1.5) % 7) - 0.5;
      s.material.opacity = 0.30;
    });
    if (o.lookAt) {
      const l = body.worldToLocal(o.lookAt.clone()).normalize();
      eyes.pupils.forEach(p => {
        p.position.x = clamp(l.x * 0.14, -0.09, 0.09);
        p.position.y = clamp(l.y * 0.10, -0.06, 0.06);
      });
    }
  };
  return S;
}

/* ---------------- Beans -------------------------------------------------
   Chews gum, spits it at you, glues you to the floor.                      */
function makeBeans() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);

  const bean = sph(1.05, MAT.beanBody, 0.82, 1.25, 0.85, 18);
  bean.position.y = 1.9; body.add(bean);
  const bottom = sph(0.85, MAT.beanBody, 0.95, 0.8, 0.9, 14);
  bottom.position.y = 1.15; body.add(bottom);
  // little legs and shoes
  [-1, 1].forEach(s => {
    const l = cyl(0.16, 0.15, 0.9, new THREE.MeshLambertMaterial({ color: 0x3f6f2a }), 8);
    l.position.set(s * 0.3, 0.45, 0); body.add(l);
    const sh = box(0.42, 0.24, 0.7, new THREE.MeshLambertMaterial({ color: 0x54331f }));
    sh.position.set(s * 0.3, 0.12, 0.14); body.add(sh);
  });
  [-1, 1].forEach(s => {
    const a = cyl(0.14, 0.13, 1.0, MAT.beanBody, 8);
    a.position.set(s * 0.85, 1.8, 0); a.rotation.z = s * 0.35; body.add(a);
  });

  const headG = new THREE.Group(); headG.position.y = 2.9; body.add(headG);
  const eyes = { pupils: [] };
  [-1, 1].forEach(s => {
    const g = new THREE.Group(); g.position.set(s * 0.30, 0.10, 0.70); headG.add(g);
    g.add(sph(0.26, MAT.white, 1, 1.1, 0.5, 14));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.035, 6, 16), MAT.black);
    rim.position.z = 0.09; g.add(rim);
    const pg = new THREE.Group(); pg.position.z = 0.13; g.add(pg);
    pg.add(sph(0.10, MAT.black, 1, 1.1, 0.7, 10));
    eyes.pupils.push(pg);
  });
  const jaw = new THREE.Group(); jaw.position.set(0, -0.42, 0.62); headG.add(jaw);
  const maw = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10, 0, TAU, Math.PI * 0.5, Math.PI * 0.5),
    new THREE.MeshLambertMaterial({ color: 0x6b2230 }));
  maw.scale.set(1.2, 0.8, 0.7); jaw.add(maw);
  // the bubble
  const bubble = sph(0.5, new THREE.MeshLambertMaterial({ color: 0xff8fc8, transparent: true, opacity: 0.85 }), 1, 1, 1, 14);
  bubble.position.set(0, -0.42, 1.05); headG.add(bubble);
  bubble.scale.setScalar(0.0001);
  // cap
  const cap = sph(0.92, new THREE.MeshLambertMaterial({ color: 0x2f6fd0 }), 1.0, 0.55, 1.0, 14);
  cap.position.y = 0.45; headG.add(cap);
  const brim = box(1.3, 0.11, 0.62, new THREE.MeshLambertMaterial({ color: 0x24558f }));
  brim.position.set(0, 0.42, 0.75); headG.add(brim);

  const S = { root, body, headG, eyes, bubble, jaw, t: 0 };
  S.update = function (dt, o) {
    o = o || {};
    S.t += dt;
    const b = clamp(o.bubble || 0, 0, 1);
    S.bubble.scale.setScalar(Math.max(0.0001, b * 1.5));
    jaw.rotation.x = Math.sin(S.t * 6) * 0.12 + b * 0.35;
    body.position.y = Math.abs(Math.sin(S.t * (o.speed > 0.1 ? 8 : 2))) * 0.12;
    body.rotation.z = Math.sin(S.t * 4) * 0.05;
    if (o.lookAt) {
      const l = headG.worldToLocal(o.lookAt.clone()).normalize();
      eyes.pupils.forEach(p => {
        p.position.x = clamp(l.x * 0.12, -0.08, 0.08);
        p.position.y = clamp(l.y * 0.10, -0.06, 0.06);
      });
    }
  };
  return S;
}


/* =========================================================================
   Part 4c — WEIRD BALDI
   The same man, put together wrong.  He does not wait for you to open a
   notebook: he is after you from the first second of the round, and he gets
   there by breakdancing along the corridor floor.
   ========================================================================= */

function makeWeirdBaldi() {
  /* built on the real one, then warped — same rig, same face, same ruler,
     so everything that drives a Baldi drives this too */
  const S = makeBaldi();

  S.SKIN.color.setHex(0xe6d9a8);                    /* a bit off-colour */
  S.head.scale.set(1.22, 1.10, 1.14);
  S.head.position.y = 6.25;
  S.skull.rotation.z = 0.10;                        /* lopsided skull */

  /* the eyes never agree with each other */
  S.eyeL.g.scale.set(1.45, 1.25, 1.2);
  S.eyeR.g.scale.set(0.80, 1.05, 1.0);
  S.eyeL.g.position.y += 0.16;
  S.eyeR.g.position.y -= 0.12;
  S.browL.rotation.z += 0.35;
  S.browR.rotation.z += 0.28;

  /* one leg is longer than the other, and the shoes are enormous */
  S.legL.scale.set(0.85, 1.16, 0.85);
  S.legR.scale.set(1.18, 0.88, 1.18);
  S.legL.traverse(o => { if (o.isMesh && o.geometry.type === 'BoxGeometry') o.scale.x *= 1.0; });
  const bigShoe = (leg, sx) => {
    const sh = box(1.20, 0.50, 1.85, new THREE.MeshLambertMaterial({ color: 0xd8621f }));
    sh.position.set(sx * 0.08, -3.05, 0.42);
    leg.add(sh);
  };
  bigShoe(S.legL, -1); bigShoe(S.legR, 1);

  /* three hairs, because one would be restrained */
  const HAIR = new THREE.MeshLambertMaterial({ color: 0x3a2a1e });
  const hairs = [];
  for (let i = 0; i < 3; i++) {
    const h = new THREE.Group();
    h.position.set((i - 1) * 0.28, 1.05, -0.05);
    const st = box(0.10, 1.0 - i * 0.18, 0.10, HAIR);
    st.position.y = 0.5; h.add(st);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), HAIR);
    tip.position.y = 1.0 - i * 0.18; h.add(tip);
    S.head.add(h); hairs.push(h);
  }
  S.hairs = hairs;

  /* the ruler has seen things */
  S.ruler.scale.set(1.0, 1.0, 1.55);
  S.ruler.rotation.z = 0.5;

  /* the cloud he arrives in */
  const puffMat = new THREE.MeshBasicMaterial({
    color: 0x9fd44a, transparent: true, opacity: 0.34, depthWrite: false });
  const puff = new THREE.InstancedMesh(new THREE.SphereGeometry(0.40, 7, 6), puffMat, 20);
  puff.frustumCulled = false; puff.visible = false;
  S.root.parent === null && 0;
  S.puff = puff;
  S.puffState = [];
  for (let i = 0; i < 20; i++) S.puffState.push({ x: 0, y: 0, z: 0, s: 0, life: -1, vy: 0, vx: 0, vz: 0 });

  S.isWeird = 1;
  return S;
}

/* =========================================================================
   How he gets about.  Six ways, none of them walking, and he changes his
   mind about every three seconds.
   ========================================================================= */
const WEIRD_MOVES = ['worm', 'sixstep', 'moonwalk', 'sillywalk', 'cartwheel', 'fart'];

function weirdPickMove(e) {
  const d = distToPlayer(e.x, e.z);
  /* the fart is a closing move, so it only comes out when he is near enough
     for it to be a threat and he has not just done one */
  const pool = (d < 26 && e.fartCool <= 0)
    ? ['fart', 'worm', 'sixstep', 'moonwalk', 'sillywalk', 'cartwheel', 'fart']
    : ['worm', 'sixstep', 'moonwalk', 'sillywalk', 'cartwheel'];
  let m = pool[Math.floor(Math.random() * pool.length)];
  if (m === e.move && Math.random() < 0.7) m = pool[Math.floor(Math.random() * pool.length)];
  e.move = m;
  e.moveT = 0;
  e.moveDur = m === 'fart' ? 2.4 : rand(2.2, 4.0);
  if (m === 'fart') { e.fartStage = 0; e.fartCool = 9; }
  if (m === 'cartwheel') e.spinDir = Math.random() < 0.5 ? 1 : -1;
}

/* the speed of each style, and how much of it is a smooth glide */
const WEIRD_SPEED = { worm: 4.2, sixstep: 5.6, moonwalk: 6.4, sillywalk: 5.0,
                      cartwheel: 7.8, fart: 3.0 };

function updateWeirdOne(e, dt) {
  const m = e.model, p = G.player;
  const pos = new THREE.Vector3(p.x, 4.0, p.z);

  if (G.mode === 'intro') { place(e); return; }
  if (shoveTick(e, dt)) {
    place(e); m.root.rotation.y = e.heading;
    m.update(dt, { speed: 0, anger: 0.5, lookAt: pos });
    weirdPuff(e, dt);
    return;
  }
  if (e.stun > 0) {
    e.stun -= dt;
    m.update(dt, { speed: 0, anger: 0.6, lookAt: pos });
    place(e);
    m.root.rotation.z = Math.sin(G.time * 22) * 0.25;
    weirdPuff(e, dt);
    return;
  }

  e.fartCool = Math.max(0, (e.fartCool || 0) - dt);
  e.moveT = (e.moveT || 0) + dt;
  if (!e.move || e.moveT >= e.moveDur) weirdPickMove(e);

  const k = e.moveT, mv = e.move;
  let spd = WEIRD_SPEED[mv] || 5;
  let y = 0, roll = 0, tilt = 0, spin = 0, sx = 1, sy = 1, faceBack = 0;

  /* ---------------------------------------------------------- the worm */
  if (mv === 'worm') {
    /* flat on the floor, rippling forward.  He only actually moves on the
       part of the ripple where his chest is down, which is why it looks
       like it should not work */
    const w = Math.sin(k * 9.0);
    tilt = -1.42;                                   /* face down */
    y = 0.35 + Math.max(0, w) * 1.5;
    spd *= (w > 0 ? 1.7 : 0.25);
    sy = 1 - Math.max(0, -w) * 0.20;
    sx = 1 + Math.max(0, -w) * 0.16;
    roll = Math.sin(k * 9.0 + 1.2) * 0.16;

  /* ------------------------------------------------------- the six-step */
  } else if (mv === 'sixstep') {
    spin = k * 7.4;                                 /* spinning on one hand */
    y = 0.9 + Math.abs(Math.sin(k * 7.4)) * 0.5;
    tilt = -0.75;
    roll = Math.sin(k * 7.4) * 0.55;
    sx = 1 + Math.sin(k * 14.8) * 0.10;

  /* -------------------------------------------------------- the moonwalk */
  } else if (mv === 'moonwalk') {
    faceBack = 1;                                   /* he arrives backwards */
    const st = Math.sin(k * 6.5);
    y = Math.abs(Math.cos(k * 6.5)) * 0.14;
    roll = st * 0.10;
    tilt = 0.16;

  /* ------------------------------------------------------ the silly walk */
  } else if (mv === 'sillywalk') {
    const st = Math.sin(k * 4.2);
    y = Math.abs(st) * 1.30;                        /* enormous high steps */
    tilt = -0.30 + st * 0.22;
    roll = st * 0.30;
    sy = 1 + Math.abs(st) * 0.12;
    spd *= 0.6 + Math.abs(st) * 0.9;

  /* -------------------------------------------------------- the cartwheel */
  } else if (mv === 'cartwheel') {
    roll = k * 9.5 * e.spinDir;
    y = 1.1 + Math.abs(Math.sin(k * 9.5)) * 0.9;
    tilt = 0.10;

  /* ------------------------------------------------------------ the fart */
  } else {
    /* line up, wind up, let go, and get launched by it */
    if (k < 0.85) { faceBack = 1; spd = 0.6; y = Math.sin(k * 8) * 0.06; sy = 1 + k * 0.18; }
    else if (k < 1.05) {
      faceBack = 1; spd = 0;
      if (!e.fartStage) {
        e.fartStage = 1;
        weirdFart(e);
      }
      sy = 0.82; sx = 1.22;
    } else {
      faceBack = 1;
      spd = 26 * Math.exp(-(k - 1.05) * 2.2);       /* jet propulsion */
      y = Math.max(0, Math.sin((k - 1.05) * 3.4)) * 1.6;
      roll = Math.sin(k * 18) * 0.30;
      tilt = -0.35;
    }
  }

  /* ---- travel ---- */
  let tx = p.x, tz = p.z;
  if (e.distract && e.distract.t > 0) {
    e.distract.t -= dt;
    tx = e.distract.x; tz = e.distract.z;
    if (e.distract.t <= 0) e.distract = null;
  }
  stepAgent(e, tx, tz, spd, dt, 0.9);

  /* ---- put him on the floor in whatever shape he is currently in ---- */
  m.root.position.set(e.x, y, e.z);
  m.root.rotation.set(tilt, e.heading + (faceBack ? Math.PI : 0) + spin, roll);
  m.root.scale.set(sx, sy, sx);
  m.update(dt, { speed: mv === 'moonwalk' || mv === 'sillywalk' ? 9 : 0,
                 anger: 0.55 + Math.sin(G.time * 3) * 0.15, lookAt: pos });
  /* the hairs lag behind everything he does */
  if (m.hairs) {
    for (let i = 0; i < m.hairs.length; i++) {
      m.hairs[i].rotation.z = Math.sin(G.time * (7 + i * 2.3) + i) * 0.55;
      m.hairs[i].rotation.x = Math.cos(G.time * (5 + i * 1.7)) * 0.40;
    }
  }
  /* googly eyes, always a beat behind his head */
  m.eyeL.pupilG.position.set(Math.sin(G.time * 6.1) * 0.09, Math.cos(G.time * 4.7) * 0.07, 0.155);
  m.eyeR.pupilG.position.set(Math.sin(G.time * 5.3 + 2) * 0.09, Math.cos(G.time * 7.3) * 0.07, 0.155);

  weirdPuff(e, dt);

  if (distToPlayer(e.x, e.z) < 2.0 && (G.mode === 'play' || G.mode === 'rope')) caught(e);
}

/* ------------------------------------------------------------- the cloud */
function weirdFart(e) {
  const m = e.model;
  /* `faceBack` has already spun the model round, so his back is pointing
     along `heading` — which is straight at you.  The cloud goes that way. */
  const back = e.heading;
  const st = m.puffState;
  for (let i = 0; i < st.length; i++) {
    const s = st[i];
    s.life = rand(0.9, 1.7); s.max = s.life;
    s.x = e.x + Math.sin(back) * 1.4 + rand(-0.4, 0.4);
    s.y = 2.2 + rand(-0.5, 0.5);
    s.z = e.z + Math.cos(back) * 1.4 + rand(-0.4, 0.4);
    const sp = rand(3.5, 8.5);
    s.vx = Math.sin(back) * sp + rand(-1.4, 1.4);
    s.vz = Math.cos(back) * sp + rand(-1.4, 1.4);
    s.vy = rand(0.4, 1.9);
    s.s = rand(0.5, 1.15);
  }
  m.puff.visible = true;
  e.gasT = 1.4;
  weirdFartSound(panFor(e.x, e.z), clamp(1.2 - distToPlayer(e.x, e.z) / 55, 0.08, 1));
}

/* a rude noise, synthesised.  A wobbling saw through a moving lowpass, which
   is unfortunately exactly what one sounds like. */
function weirdFartSound(pan, vol) {
  Audio1.init();
  const ctx = Audio1.ctx;
  if (!ctx) return;
  const t = ctx.currentTime;
  const dur = rand(0.35, 0.75);
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  const f0 = rand(58, 105);
  o.frequency.setValueAtTime(f0, t);
  o.frequency.linearRampToValueAtTime(f0 * rand(0.55, 0.85), t + dur);
  /* the flutter */
  const lfo = ctx.createOscillator(); lfo.type = 'square';
  lfo.frequency.setValueAtTime(rand(16, 26), t);
  lfo.frequency.linearRampToValueAtTime(rand(7, 12), t + dur);
  const lg = ctx.createGain(); lg.gain.value = rand(14, 30);
  lfo.connect(lg); lg.connect(o.frequency);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 7;
  lp.frequency.setValueAtTime(rand(500, 900), t);
  lp.frequency.exponentialRampToValueAtTime(180, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22 * vol, t + 0.03);
  g.gain.setValueAtTime(0.20 * vol, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  o.connect(lp); lp.connect(g);
  if (pn) { pn.pan.value = clamp(pan, -1, 1); g.connect(pn); pn.connect(Audio1.sfxGain || Audio1.master); }
  else g.connect(Audio1.sfxGain || Audio1.master);
  o.start(t); o.stop(t + dur + 0.05);
  lfo.start(t); lfo.stop(t + dur + 0.05);
  /* and the spray */
  const n = ctx.createBufferSource(); n.buffer = Audio1.noiseBuf;
  const nf = ctx.createBiquadFilter(); nf.type = 'bandpass';
  nf.frequency.value = 420; nf.Q.value = 1.4;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.05 * vol, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(nf); nf.connect(ng); ng.connect(Audio1.sfxGain || Audio1.master);
  n.start(t); n.stop(t + dur + 0.05);
}

function weirdPuff(e, dt) {
  const m = e.model, st = m.puffState;
  if (!m.puff.visible) return;
  const D = new THREE.Object3D();
  let alive = 0;
  for (let i = 0; i < st.length; i++) {
    const s = st[i];
    if (s.life <= 0) { D.scale.setScalar(0.0001); D.updateMatrix(); m.puff.setMatrixAt(i, D.matrix); continue; }
    s.life -= dt; alive++;
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    s.vx *= 1 - dt * 1.6; s.vz *= 1 - dt * 1.6; s.vy += dt * 0.5;
    const a = clamp(s.life / s.max, 0, 1);
    D.position.set(s.x, s.y, s.z);
    D.scale.setScalar(s.s * (1.30 - a * 0.55));
    D.updateMatrix();
    m.puff.setMatrixAt(i, D.matrix);
    /* if it reaches you, it is not fatal — it is just horrible */
    if (a > 0.15 && Math.hypot(s.x - G.player.x, s.z - G.player.z) < 1.7 && (G.gasHit || 0) <= 0) {
      G.gasHit = 1.0;
    }
  }
  m.puff.instanceMatrix.needsUpdate = true;
  m.puff.material.opacity = 0.34 * clamp(alive / 8, 0, 1);
  if (!alive) m.puff.visible = false;
}

function updateWeird(dt) { forEachKind('weird', updateWeirdOne, dt); }

/* the after-effects of walking through one */
function updateGas(dt) {
  if (!G.gasHit) { const el = UI.el('gasOverlay'); if (el) el.style.opacity = 0; return; }
  G.gasHit = Math.max(0, G.gasHit - dt * 0.34);
  const el = UI.el('gasOverlay');
  if (el) el.style.opacity = (G.gasHit * 0.55).toFixed(3);
  if (G.gasHit <= 0) { G.gasHit = 0; if (el) el.style.opacity = 0; }
}


/* =========================================================================
   Part 5 — gameplay systems, the chapter campaign, and every character's AI
   ========================================================================= */

/* ------------------------------------------------------------ CHAPTERS */
const CHAPTERS = [
  {
    n: 1, name: 'FIRST DAY', zones: 1, notebooks: 2,
    sub: 'Homeroom and one classroom. Baldi will show you around.',
    cast: [], base: 2.30, step: 0.10, min: 1.05, intro: true, warn: true
  },
  {
    n: 2, name: 'SCHOOL DAY', zones: 2, notebooks: 3,
    sub: 'The whole south wing opens up — and so does the Principal\'s office.',
    cast: ['principal'], base: 1.85, step: 0.110, min: 0.72, warn: true
  },
  {
    n: 3, name: 'RECESS', zones: 3, notebooks: 5,
    sub: 'Playtime, It\'s a Bully and Gotta Sweep are out of class.',
    cast: ['principal', 'playtime', 'bully', 'sweep'],
    base: 1.55, step: 0.115, min: 0.52, warn: true
  },
  {
    n: 4, name: 'AFTER SCHOOL', zones: 4, notebooks: 7,
    sub: 'The north halls unlock. Whatever you do, don\'t stare at the sock puppet.',
    cast: ['principal', 'playtime', 'bully', 'sweep', 'crafters', 'prize', 'chalkles'],
    base: 1.30, step: 0.120, min: 0.38, warn: false
  },
  {
    n: 5, name: 'FINAL EXAM', zones: 5, notebooks: 7,
    sub: 'Everyone is here. Seven notebooks — then reach ALL FOUR exits.',
    cast: ['principal', 'playtime', 'bully', 'sweep', 'crafters', 'prize', 'chalkles', 'cloudy', 'beans'],
    base: 1.05, step: 0.125, min: 0.25, allExits: true, dark: true, warn: false
  },
  {
    n: 0, name: 'FIELD TRIP', zones: 5, notebooks: 5, campaign: true, hidden: true,
    sub: 'Just you and Baldi, and he is in a very good mood.',
    cast: [], base: 2.30, step: 0.0, min: 2.30, sunny: true, warn: false
  },
  {
    n: 0, name: 'CONFISCATION', zones: 5, notebooks: 0, confiscate: true, hidden: true,
    sub: 'Every anime book in the building. He has plans for them.',
    cast: [], base: 2.30, step: 0.0, min: 2.30, warn: false
  },
  {
    n: 0, name: 'CUSTOM MODE', zones: 5, notebooks: 7, custom: true, hidden: true,
    sub: 'Your own line-up, loose in the whole school.',
    cast: [], base: 1.45, step: 0.115, min: 0.40, warn: true
  }
];

/* Every character you can stock the school with, and how many of each.
   Zero means "leave them at home". Seven is the ceiling. */
const ROSTER = [
  { key: 'baldi',     name: 'Baldi',                 def: 1 },
  { key: 'principal', name: 'Principal of the Thing', def: 1 },
  { key: 'playtime',  name: 'Playtime',              def: 1 },
  { key: 'bully',     name: "It's a Bully",          def: 1 },
  { key: 'sweep',     name: 'Gotta Sweep',           def: 1 },
  { key: 'crafters',  name: 'Arts and Crafters',     def: 1 },
  { key: 'prize',     name: '1st Prize',             def: 1 },
  { key: 'chalkles',  name: 'Chalkles',              def: 1 },
  { key: 'cloudy',    name: 'Cloudy Copter',         def: 1 },
  { key: 'beans',     name: 'Beans',                 def: 1 },
  { key: 'weird',     name: 'Weird Baldi',           def: 1 }
];
const ROSTER_MAX = 10;

const G = {
  scene: null, camera: null, renderer: null,
  running: false, paused: false, mode: 'menu',
  chapter: 0, maxChapter: 0, unlockedZones: 1,
  time: 0, elapsed: 0,

  player: {
    x: 0, z: 0, yaw: 0, pitch: 0,
    stamina: 100, staminaLock: 0, bob: 0, stepAcc: 0,
    items: [null, null, null], sel: 0, running: false, stuck: 0, energy: 0, brokeRule: 0
  },
  keys: {},
  notebooks: 0, wrongs: 0, total: 7,
  nbList: [], groundItems: [], machines: [],
  ents: {}, cast: [],
  props: [], detentions: 0, seenCells: null,
  exitsReached: 0, blind: 0
};

/* ---------------------------------------------------------------- helpers */
function blockedAt(px, pz, r) {
  const cx = Math.floor(px / CS), cy = Math.floor(pz / CS);
  for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
    if (Map1.walkable(x, y)) continue;
    const x0 = x * CS, z0 = y * CS;
    const qx = clamp(px, x0, x0 + CS), qz = clamp(pz, z0, z0 + CS);
    const dx = px - qx, dz = pz - qz;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}
function blockedByProp(px, pz, r) {
  for (const p of G.props) {
    const dx = px - p.x, dz = pz - p.z, rr = r + p.r;
    if (dx * dx + dz * dz < rr * rr) return true;
  }
  return false;
}
function hasLOS(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const dist = Math.hypot(dx, dz);
  const steps = Math.ceil(dist / (CS * 0.4));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const c = worldToCell(ax + dx * t, az + dz * t);
    if (!Map1.walkable(c.x, c.y)) return false;
  }
  return true;
}
function panFor(wx, wz) {
  const p = G.player;
  const dx = wx - p.x, dz = wz - p.z;
  const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  const d = Math.hypot(dx, dz) || 1;
  return clamp(((dx * rx + dz * rz) / d) * 0.9, -1, 1);
}
function distToPlayer(wx, wz) { const p = G.player; return Math.hypot(wx - p.x, wz - p.z); }
/* is a world point inside the player's view cone (and visible)? */
function playerSees(wx, wz, coneCos) {
  const p = G.player;
  const dx = wx - p.x, dz = wz - p.z, d = Math.hypot(dx, dz) || 1;
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  const dot = (dx / d) * fx + (dz / d) * fz;
  return dot > (coneCos === undefined ? 0.72 : coneCos) && hasLOS(p.x, p.z, wx, wz);
}
/* Find the nearest point where a body of radius `rad` actually fits.
   Used for every teleport and every pickup placement so nothing can end up
   welded inside a desk. */
function freeSpotNear(x, z, rad, maxR) {
  rad = rad === undefined ? 0.95 : rad;
  maxR = maxR || 8;
  if (!blockedAt(x, z, rad) && !blockedByProp(x, z, rad)) return { x: x, z: z };
  for (let step = 1; step * 0.35 <= maxR; step++) {
    const r = step * 0.35;
    for (let a = 0; a < 18; a++) {
      const ang = (a / 18) * TAU + step * 0.37;
      const tx = x + Math.cos(ang) * r, tz = z + Math.sin(ang) * r;
      if (!blockedAt(tx, tz, rad) && !blockedByProp(tx, tz, rad)) return { x: tx, z: tz };
    }
  }
  return { x: x, z: z };
}
function fitsAt(x, z, rad) { return !blockedAt(x, z, rad) && !blockedByProp(x, z, rad); }

function unlockedRooms() { return Map1.rooms.filter(r => r.zone <= G.unlockedZones); }
function randomUnlockedCell(minDistFromPlayer) {
  for (let i = 0; i < 500; i++) {
    const x = randi(2, MW - 3), y = randi(2, MH - 3);
    if (!Map1.walkable(x, y) || Map1.zoneAt(x, y) > G.unlockedZones) continue;
    const c = cellCenter(x, y);
    if (minDistFromPlayer && distToPlayer(c.x, c.z) < minDistFromPlayer) continue;
    return { x: c.x, z: c.z, cx: x, cy: y };
  }
  const r = unlockedRooms()[0];
  const c = cellCenter(r.cx, r.cy);
  return { x: c.x, z: c.z, cx: r.cx, cy: r.cy };
}
function randomHallCell(minDist) {
  for (let i = 0; i < 500; i++) {
    const x = randi(2, MW - 3), y = randi(2, MH - 3);
    if (Map1.at(x, y) !== W_HALL) continue;
    if (Map1.zoneAt(x, y) > G.unlockedZones) continue;
    const c = cellCenter(x, y);
    if (minDist && distToPlayer(c.x, c.z) < minDist) continue;
    return { x: c.x, z: c.z, cx: x, cy: y };
  }
  return randomUnlockedCell(minDist);
}

/* ---------------------------------------------------------------- UI */
const UI = {
  el(id) { return document.getElementById(id); },
  toastT: 0, subT: 0,
  toast(msg, ms) { const t = this.el('toast'); t.textContent = msg; t.style.opacity = 1; this.toastT = (ms || 1800) / 1000; },
  say(msg, ms) { const s = this.el('subtitle'); s.textContent = msg; s.style.opacity = 1; this.subT = (ms || 2200) / 1000; },
  tick(dt) {
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.el('toast').style.opacity = 0; }
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) this.el('subtitle').style.opacity = 0; }
  },
  flash(a) { const f = this.el('hurtFlash'); f.style.opacity = a; setTimeout(() => { f.style.opacity = 0; }, 160); }
};

/* ---------------------------------------------------------------- inventory */
function buildSlots() {
  const wrap = UI.el('items'); wrap.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const d = document.createElement('div');
    d.className = 'slot' + (i === G.player.sel ? ' sel' : '');
    d.innerHTML = '<span class="num">' + (i + 1) + '</span>';
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    d.appendChild(c); wrap.appendChild(d);
  }
  refreshSlots();
}
function refreshSlots() {
  const slots = UI.el('items').children;
  for (let i = 0; i < 3; i++) {
    const s = slots[i]; if (!s) continue;
    s.className = 'slot' + (i === G.player.sel ? ' sel' : '');
    const c = s.querySelector('canvas');
    const k = G.player.items[i];
    if (k) drawItemIcon(c, k); else c.getContext('2d').clearRect(0, 0, 64, 64);
    s.title = k ? ITEM_DEFS[k].name : '';
  }
}
function giveItem(kind) {
  const p = G.player;
  const i = p.items.indexOf(null);
  if (i === -1) { UI.toast('POCKETS FULL!'); return false; }
  p.items[i] = kind; refreshSlots();
  UI.toast('GOT: ' + ITEM_DEFS[kind].name);
  Audio1.pickup();
  return true;
}

/* ---------------------------------------------------------------- math pad */
const Math1 = {
  active: false, idx: 0, correctCount: 0, q: null, nbIndex: 0,
  faceAnger: 0, faceTarget: 0, mouthT: 0, present: false, closing: 0, locked: false,

  gen(level, nb) {
    const ch = CHAPTERS[G.chapter];
    if (level === 2 && (nb >= 1 || ch.n >= 3)) {
      const junk = '¿?×∅@#§¤¶ΔΩ‡';
      let s = '';
      for (let i = 0; i < 9; i++) s += junk[randi(0, junk.length - 1)];
      return { text: s + ' =', answer: null, impossible: true };
    }
    const d = Math.max(0, ch.n - 2);
    if (level === 0) {
      const a = randi(1, 9 + d * 3), b = randi(1, 9 + d * 3);
      return Math.random() < 0.5
        ? { text: a + ' + ' + b + ' =', answer: a + b }
        : { text: (a + b) + ' - ' + b + ' =', answer: a };
    }
    if (level === 1) {
      if (Math.random() < 0.5) {
        const a = randi(10, 40 + d * 25), b = randi(10, 40 + d * 25);
        return { text: a + ' + ' + b + ' =', answer: a + b };
      }
      const a = randi(2, 9), b = randi(2, 9);
      return { text: a + ' × ' + b + ' =', answer: a * b };
    }
    const a = randi(3, 12), b = randi(2, 9), c = randi(1, 20);
    return { text: '(' + a + ' × ' + b + ') + ' + c + ' =', answer: a * b + c };
  },

  open(nbIndex) {
    this.active = true; this.idx = 0; this.correctCount = 0; this.nbIndex = nbIndex;
    this.closing = 0; this.locked = false;
    this.faceAnger = 0; this.faceTarget = 0; this.mouthT = 0;
    // once he has stormed off he does not come back to the pad
    this.present = !G.baldiLeftPad;
    UI.el('padFace').classList.toggle('gone', !this.present);
    UI.el('padSay').textContent = this.present ? 'Let\'s do some math!' : '';
    UI.el('padSay').className = '';
    for (let i = 0; i < 3; i++) UI.el('chk' + i).className = 'chk';
    UI.el('padBtn').disabled = false;
    G.mode = 'math';
    UI.el('dialogue').classList.add('hidden');
    UI.el('prompt').classList.add('hidden');
    UI.el('mathPad').classList.remove('hidden');
    document.exitPointerLock && document.exitPointerLock();
    this.next();
  },

  next() {
    this.q = this.gen(this.idx, this.nbIndex);
    const qEl = UI.el('question');
    qEl.textContent = this.q.text;
    qEl.className = this.q.impossible ? 'glitch' : '';
    UI.el('padPrompt').textContent = 'SOLVE MATH Q' + (this.idx + 1) + ':';
    const a = UI.el('answer'); a.value = ''; a.disabled = false;
    setTimeout(() => a.focus(), 30);
  },

  /* the little window: mouth always flapping, anger easing in slowly */
  tickFace(dt) {
    if (!this.active) return;
    this.mouthT += dt * (this.faceAnger > 0.5 ? 5.0 : 8.5);
    this.faceAnger += (this.faceTarget - this.faceAnger) * (1 - Math.exp(-dt * 1.6));
    if (this.present) {
      const open = 0.5 + 0.5 * Math.sin(this.mouthT);
      drawPadFace(UI.el('padFaceCv'), this.faceAnger, open);
    }
    if (this.closing > 0) {
      this.closing -= dt;
      if (this.closing <= 0) this.finish(false);
    }
  },

  submit() {
    if (!this.active || this.locked) return;
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (now - (this._lastSubmit || 0) < 150) return;
    this._lastSubmit = now;

    const raw = UI.el('answer').value.trim();
    const val = parseInt(raw, 10);
    const ok = !this.q.impossible && raw !== '' && val === this.q.answer;

    if (ok) {
      UI.el('chk' + this.idx).className = 'chk on';
      this.correctCount++;
      Audio1.correct();
      if (this.present) {
        UI.el('padSay').textContent = pick(['GREAT JOB!', 'Great job!', 'Nice work!', 'That\'s right!']);
        UI.el('padSay').className = '';
        this.mouthT = 0;
      }
      this.idx++;
      if (this.idx >= 3) this.finish(true); else this.next();
      return;
    }

    /* wrong: he sours, the music dies, and the pad shuts */
    UI.el('chk' + this.idx).className = 'chk bad';
    this.locked = true;
    UI.el('answer').disabled = true;
    UI.el('padBtn').disabled = true;
    G.wrongs++;
    if (G.friendlyBaldi) {
      /* field trip: he does not mind in the slightest */
      Audio1.tone(300, 0.16, 0.10, 'triangle');
      UI.el('padSay').textContent = pick([
        'Ooh, close one!', 'Not quite \u2014 never mind!', 'That happens to me too!']);
      UI.el('padSay').className = '';
      this.closing = 1.4;
      return;
    }
    Music.stop();                       // dead silence, mid-note
    Audio1.wrong();
    angerBaldi(this.q.impossible ? 1.0 : 0.8);
    if (this.present) {
      this.faceTarget = 1;              // he takes his time about it
      UI.el('padSay').textContent = 'WRONG.';
      UI.el('padSay').className = 'mad';
      G.baldiLeftPad = true;            // never in the pad again this run
      this.closing = 2.0;
    } else {
      UI.el('padSay').textContent = 'WRONG.';
      UI.el('padSay').className = 'mad';
      this.closing = 0.9;
    }
  },

  finish(allDone) {
    this.active = false; this.locked = false; this.closing = 0;
    UI.el('mathPad').classList.add('hidden');
    G.mode = 'play';
    resumeLock();
    G.notebooks++;
    UI.el('nbCount').innerHTML = G.notebooks + '/' + G.total + '<small>NOTEBOOKS</small>';
    Audio1.notebookJingle();
    if (allDone && this.correctCount === 3) { giveItem('quarter'); UI.say('All three right! Have a quarter.'); }
    else if (!allDone) UI.say('Baldi heard that…');
    onNotebookDone();
  },

  close() { this.finish(true); }
};

function angerBaldi(amount) {
  for (const b of baldis()) { b.anger += amount; b.awake = true; }
  UI.flash(0.5); updateAngerBar();
}
function baldis() { return (G.lists && G.lists.baldi) || []; }
function nearestBaldi() {
  let best = null, bd = 1e9;
  for (const b of baldis()) {
    const d = distToPlayer(b.x, b.z);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function baldiInterval(b) {
  const ch = CHAPTERS[G.chapter];
  b = b || G.ents.baldi;
  const anger = b ? b.anger : 0;
  return clamp(ch.base - (G.notebooks * 0.55 + anger) * ch.step, ch.min, ch.base);
}
function angerNorm(b) {
  const ch = CHAPTERS[G.chapter], iv = baldiInterval(b);
  return clamp((ch.base - iv) / (ch.base - ch.min), 0, 1);
}
function updateAngerBar() {
  UI.el('angerFill').style.width = (angerNorm() * 100).toFixed(0) + '%';
}

const GREETINGS = [
  'Wow! You found one of my notebooks!',
  'Ooh, that\'s two!',
  'Three down. Keep going!',
  'You\'re halfway there!',
  'Five! Baldi is getting fast…',
  'Just one more notebook!',
  'That\'s all of them!'
];

function onNotebookDone() {
  const ch = CHAPTERS[G.chapter];
  if (G.friendlyBaldi) {
    for (const b of baldis()) { b.awake = true; b.anger = 0; }
    updateAngerBar();
    UI.say(G.notebooks >= G.total
      ? 'That is the lot! Come and find me.'
      : 'Baldi: "Nice one \u2014 that is ' + G.notebooks + ' of ' + G.total + '!"', 3000);
    return;
  }
  for (const b of baldis()) b.awake = true;
  updateAngerBar();
  if (G.notebooks >= G.total) {
    for (const b of baldis()) b.anger += 4;
    updateAngerBar();
    Audio1.bell();
    for (const e of Map1.exits) if (e.bar && e.zone <= G.unlockedZones) e.bar.visible = false;
    UI.say(ch.allExits
      ? 'THAT\'S ALL SEVEN — NOW REACH ALL FOUR EXITS!'
      : 'THAT\'S ALL OF THEM — GET TO AN EXIT!', 4200);
    if (G.scene.fog) { G.scene.fog.color.setHex(0x2a1010); G.renderer.setClearColor(0x2a1010); }
  } else {
    UI.say(GREETINGS[Math.min(G.notebooks - 1, GREETINGS.length - 1)], 3000);
  }
}

/* ---------------------------------------------------------------- items */
/* Look at a notebook and press E / click — a guaranteed way to collect one
   even if it ended up somewhere awkward. */
function tryGrabNotebook() {
  const p = G.player;
  let best = null, bd = 1e9;
  for (const n of G.nbList) {
    if (n.taken) continue;
    const d = distToPlayer(n.x, n.z);
    if (d < 8 && d < bd && playerSees(n.x, n.z, 0.5)) { bd = d; best = n; }
  }
  if (!best) return false;
  best.taken = true;
  G.scene.remove(best.mesh);
  Audio1.pickup();
  Math1.open(G.notebooks);
  return true;
}

function useItem() {
  const p = G.player;
  if (tryGrabNotebook()) return;
  const kind = p.items[p.sel];
  if (!kind) { UI.toast('NOTHING SELECTED'); return; }
  const b = G.ents.baldi;
  if (kind === 'bsoda') {
    sodaBlast();
    p.items[p.sel] = null;
  } else if (kind === 'zesty') {
    p.energy = 22; p.stamina = 100;
    UI.say('Zesty! You feel unstoppable for 22 seconds.');
    Audio1.pickup(); p.items[p.sel] = null;
  } else if (kind === 'clock') {
    b.distract = { x: p.x, z: p.z, t: 12 };
    spawnAlarmProp(p.x, p.z);
    UI.say('The alarm clock rings — Baldi turns toward it.');
    Audio1.bell(); p.items[p.sel] = null;
  } else if (kind === 'quarter') {
    const m = nearestMachine();
    if (m && distToPlayer(m.x, m.z) < 4.5) {
      p.items[p.sel] = null; refreshSlots(); giveItem('bsoda');
      UI.say('*clunk* A cold BSODA rolls out.');
    } else { UI.toast('NO MACHINE NEARBY'); return; }
  } else if (kind === 'scissors') {
    // cutting 1st Prize's wires leaves him spinning helplessly
    let cut = null, cd = 1e9;
    for (const e of ((G.lists && G.lists.prize) || [])) {
      const dd = distToPlayer(e.x, e.z);
      if (dd < 8 && dd < cd && playerSees(e.x, e.z, 0.45)) { cd = dd; cut = e; }
    }
    if (cut) {
      cut.spin = 30; cut.state = 'turn'; cut.hug = 0; cut.speed = 0;
      UI.say('*snip* You cut 1st Prize\'s wires. He spins out.', 3000);
      Audio1.ropeWhoosh();
      p.items[p.sel] = null;
    } else { UI.toast('SAVE THESE FOR PLAYTIME — or 1ST PRIZE\'S WIRES'); return; }
  }
  else if (kind === 'key') { UI.toast('THE PRINCIPAL WILL WANT THESE'); return; }
  else if (kind === 'tape') {
    let done = false;
    for (const key of ['crafters', 'chalkles']) {
      const e = G.ents[key];
      if (e && e.active && distToPlayer(e.x, e.z) < 12) {
        e.disabled = 26; done = true;
        if (e.model.root) e.model.root.visible = false;
      }
    }
    UI.say(done ? 'You tape him to the wall. Rude, but effective.' : 'Nothing here to tape up.');
    if (done) p.items[p.sel] = null; else return;
  }
  refreshSlots();
}
/* =========================================================================
   BSODA — a fat blue jet that hoses down the hallway, and anything caught in
   it gets driven backwards until its back is against a wall.
   ========================================================================= */
const SHOVE_SPEED = 24;

function spawnSodaJet(px, pz, yaw) {
  const g = new THREE.Group();
  const scene = G.scene;

  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x9fdcff, transparent: true, opacity: 0.85, depthWrite: false });
  const shellMat = new THREE.MeshBasicMaterial({
    color: 0x2f7fe0, transparent: true, opacity: 0.30, depthWrite: false,
    side: THREE.DoubleSide });
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xdff2ff, transparent: true, opacity: 0.55, depthWrite: false });

  // the shaft: a wide cone of soda thrown forward
  // starts just past the camera so it never fogs the whole view
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 1.45, 18, 16, 1, true), shellMat);
  shell.rotation.x = Math.PI / 2; shell.position.z = 10.5; g.add(shell);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.62, 18, 12, 1, true), coreMat);
  core.rotation.x = Math.PI / 2; core.position.z = 10.5; g.add(core);

  // froth boiling along the stream
  const drops = [];
  for (let i = 0; i < 30; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(rand(0.14, 0.42), 6, 5),
      i % 3 === 0 ? foamMat : coreMat.clone());
    d.userData = { z0: rand(0.5, 18), sp: rand(16, 34), off: rand(0, TAU), rad: rand(0.15, 1.5) };
    g.add(d); drops.push(d);
  }

  g.position.set(px, 3.45, pz);
  g.rotation.y = yaw + Math.PI;          // local +Z now points where you look
  scene.add(g);
  G.jets = G.jets || [];
  G.jets.push({ g: g, t: 0, life: 0.85, shell: shell, core: core, drops: drops });
}

function updateJets(dt) {
  if (!G.jets) return;
  for (let i = G.jets.length - 1; i >= 0; i--) {
    const j = G.jets[i];
    j.t += dt;
    const k = clamp(j.t / j.life, 0, 1);
    const grow = Math.min(1, k / 0.18);            // punches out fast
    const fade = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
    j.shell.scale.set(1, grow, 1);
    j.core.scale.set(1, grow, 1);
    j.shell.material.opacity = 0.30 * fade;
    j.core.material.opacity = 0.85 * fade;
    for (const d of j.drops) {
      const u = d.userData;
      const z = 1.4 + (u.z0 + j.t * u.sp) % 18;
      const spread = 0.08 + z * 0.085;
      d.position.set(Math.cos(u.off + j.t * 6) * u.rad * spread,
                     Math.sin(u.off + j.t * 6) * u.rad * spread, z * grow);
      d.material.opacity = 0.7 * fade * (1 - z / 22);
      d.scale.setScalar(0.6 + z * 0.06);
    }
    if (j.t >= j.life) {
      G.scene.remove(j.g);
      j.g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      G.jets.splice(i, 1);
    }
  }
}

/* Anything under the jet gets driven along it. Called at the top of every
   character's update — while a shove is running their own AI is suspended. */
function shoveTick(e, dt) {
  if (!e.shove) return false;
  const sv = e.shove;
  sv.t -= dt;
  const step = SHOVE_SPEED * dt;
  const nx = e.x + sv.x * step, nz = e.z + sv.z * step;
  if (blockedAt(nx, nz, 0.85)) {          // back against the wall — that's the end of it
    e.shove = null; e.stun = Math.max(e.stun || 0, 1.1);
    if (distToPlayer(e.x, e.z) < 40) Audio1.noise(0.18, 0.10, 'lowpass', 300, 1, panFor(e.x, e.z));
    return true;
  }
  e.x = nx; e.z = nz;
  if (sv.t <= 0) { e.shove = null; e.stun = Math.max(e.stun || 0, 0.6); }
  return true;
}

function sodaBlast() {
  const p = G.player;
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  spawnSodaJet(p.x, p.z, p.yaw);
  Audio1.spray();

  let hit = 0;
  const targets = G.cast.filter(e => ['baldi', 'principal', 'playtime', 'bully',
    'crafters', 'beans', 'prize'].indexOf(e.kind.replace(/[0-9]+$/, '')) >= 0);
  for (const e of targets) {
    if (!e || !e.active) continue;
    const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1;
    if (d > 19) continue;
    const dot = (dx / d) * fx + (dz / d) * fz;
    if (dot < 0.66) continue;                       // must be in the stream
    if (!hasLOS(p.x, p.z, e.x, e.z)) continue;
    // shoved straight down the line of the spray, not away from you
    e.shove = { x: fx, z: fz, t: 4.0 };
    e.speed = 0;
    if (e.kind.indexOf('bully') === 0) e.timer = 0;
    if (e.kind.indexOf('prize') === 0) { e.state = 'turn'; e.hug = 0; }
    hit++;
  }
  UI.say(hit ? 'BSODA! Splash!' : 'You spray the empty hallway.');
  return hit;
}

function nearestMachine() {
  let best = null, bd = 1e9;
  for (const m of G.machines) { const d = distToPlayer(m.x, m.z); if (d < bd) { bd = d; best = m; } }
  return best;
}
function spawnAlarmProp(x, z) {
  const m = makeItemMesh('clock');
  m.position.set(x, 0.5, z); m.scale.setScalar(1.2);
  G.scene.add(m);
  G.alarmProp = { m, t: 12 };
}

/* ---------------------------------------------------------------- placement */
function placeContent() {
  const scene = G.scene;
  G.nbList = []; G.groundItems = []; G.machines = [];
  const ch = CHAPTERS[G.chapter];
  const rooms = shuffle(unlockedRooms().slice());

  // Principal's office: only reserve a whole room for it if we can spare one
  const needOffice = ch.cast.indexOf('principal') >= 0 && rooms.length > G.total;
  G.office = needOffice
    ? (rooms.find(r => r.kind === 'detention') || rooms.find(r => r.kind === 'faculty') || rooms[rooms.length - 1])
    : rooms[0];
  const nbRooms = needOffice ? rooms.filter(r => r !== G.office) : rooms;
  const need = G.total;
  for (let i = 0; i < need; i++) {
    const r = nbRooms[i % nbRooms.length];
    // try a few cells, then snap to somewhere the player can physically stand
    let spot = null;
    for (let t = 0; t < 30 && !spot; t++) {
      const cx = randi(r.x0, r.x1), cy = randi(r.y0, r.y1);
      const c = cellCenter(cx, cy);
      if (fitsAt(c.x, c.z, 1.0)) spot = { x: c.x, z: c.z };
    }
    if (!spot) {
      const c = cellCenter(r.cx, r.cy);
      spot = freeSpotNear(c.x, c.z, 1.0, 14);
    }
    // never stack two notebooks on top of each other
    for (const other of G.nbList) {
      if (Math.hypot(other.x - spot.x, other.z - spot.z) < 3) {
        spot = freeSpotNear(spot.x + 3.2, spot.z + 3.2, 1.0, 14);
        break;
      }
    }
    const cell = worldToCell(spot.x, spot.z);
    const mesh = makeNotebookMesh();
    mesh.position.set(spot.x, 1.9, spot.z);
    scene.add(mesh);
    G.nbList.push({ x: spot.x, z: spot.z, mesh, taken: false, cell: cell, room: r.name });
  }

  // items scale with the chapter
  const pool = ['bsoda', 'zesty', 'scissors', 'quarter', 'clock', 'key', 'tape', 'bsoda', 'zesty', 'quarter'];
  const count = Math.min(pool.length, 4 + ch.n * 2);
  for (let i = 0; i < count; i++) {
    const spot = Math.random() < 0.5 ? randomHallCell(0) : (() => {
      const r = pick(rooms);
      const c = cellCenter(randi(r.x0, r.x1), randi(r.y0, r.y1));
      return { x: c.x, z: c.z };
    })();
    const kind = pool[i % pool.length];
    const fs = freeSpotNear(spot.x, spot.z, 1.0, 12);
    const mesh = makeItemMesh(kind);
    mesh.position.set(fs.x, 1.1, fs.z);
    scene.add(mesh);
    G.groundItems.push({ x: fs.x, z: fs.z, kind, mesh });
  }

  // vending machines on hall walls
  const vt = (function () {
    const { c, x } = cv(64, 128);
    x.fillStyle = '#c2352f'; x.fillRect(0, 0, 64, 128);
    x.fillStyle = '#1a1f2b'; x.fillRect(6, 10, 38, 78);
    x.fillStyle = '#3a5fd0';
    for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) x.fillRect(10 + i * 12, 14 + j * 19, 8, 14);
    x.fillStyle = '#e8e8e8'; x.fillRect(48, 14, 12, 40);
    x.fillStyle = '#222'; x.fillRect(50, 18, 8, 5); x.fillRect(50, 26, 8, 5); x.fillRect(50, 34, 8, 5);
    x.fillStyle = '#111'; x.fillRect(6, 96, 52, 22);
    x.fillStyle = '#fff'; x.font = 'bold 9px sans-serif'; x.textAlign = 'center';
    x.fillText('BSODA 25¢', 32, 110);
    return texFrom(c, 1, 1);
  })();
  const vmMat = new THREE.MeshLambertMaterial({ map: vt });
  const spots = [[20, 49], [25, 49], [6, 33], [41, 33], [20, 19], [25, 19], [6, 18], [41, 18]];
  for (const [x, y] of spots) {
    if (Map1.at(x, y) !== W_HALL) continue;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      if (Map1.at(x + dx, y + dy) !== W_WALL) continue;
      const c = cellCenter(x, y);
      const mx = c.x + dx * (CS / 2 - 0.55), mz = c.z + dy * (CS / 2 - 0.55);
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.6, 5.4, 1.1), vmMat);
      m.position.set(mx, 2.7, mz);
      m.rotation.y = dx !== 0 ? Math.PI / 2 : 0;
      scene.add(m);
      G.machines.push({ x: mx - dx * 0.9, z: mz - dy * 0.9 });
      G.props.push({ x: mx, z: mz, r: 0.9 });
      break;
    }
  }
}

/* ---------------------------------------------------------------- spawn */
function spawnEntities() {
  const scene = G.scene;
  const ch = CHAPTERS[G.chapter];
  G.ents = {}; G.cast = [];
  G.lists = {};
  for (const r of ROSTER) G.lists[r.key] = [];

  /* how many of each: a chapter gives one of everything in its cast,
     Custom Mode uses whatever you dialled in on the mode screen */
  const counts = {};
  for (const r of ROSTER) {
    counts[r.key] = (ch.campaign || ch.confiscate)
      ? (r.key === 'baldi' ? 1 : 0)
      : ch.custom
        ? clamp(Math.round((G.customCounts && G.customCounts[r.key]) || 0), 0, ROSTER_MAX)
        : (r.key === 'baldi' ? 1 : (ch.cast.indexOf(r.key) >= 0 ? 1 : 0));
  }

  const MAKERS = {
    baldi: makeBaldi, principal: makePrincipal, playtime: makePlaytime,
    bully: makeBully, sweep: makeSweep, crafters: makeCrafters,
    prize: makePrize, chalkles: makeChalkles, cloudy: makeCloudy, beans: makeBeans,
    weird: makeWeirdBaldi
  };

  function add(kind, idx, spot) {
    const model = MAKERS[kind]();
    scene.add(model.root);
    const e = {
      kind: kind, model: model, x: spot.x, z: spot.z, active: true,
      stun: 0, speed: 0, heading: 0, field: makeFlowField(), disabled: 0
    };
    model.root.position.set(spot.x, 0, spot.z);
    G.lists[kind].push(e);
    G.cast.push(e);
    if (idx === 0) G.ents[kind] = e;
    return e;
  }

  for (const r of ROSTER) {
    const n = counts[r.key];
    for (let i = 0; i < n; i++) {
      const kind = r.key;
      let e;
      if (kind === 'baldi') {
        e = add(kind, i, randomUnlockedCell(50) || randomUnlockedCell(0));
        e.awake = false; e.anger = 0; e.slapT = 0.6 + i * 0.25; e.distract = null;
      } else if (kind === 'principal') {
        e = add(kind, i, randomHallCell(26));
        e.state = 'patrol'; e.cool = 0; e.target = null;
      } else if (kind === 'playtime') {
        e = add(kind, i, { x: -300 - i * 8, z: -300 });
        e.state = 'gone'; e.active = false; e.cool = rand(3, 10);
        e.dir = { x: 0, z: 1 }; e.ropePhase = 0; e.model.root.visible = false;
      } else if (kind === 'bully') {
        e = add(kind, i, randomHallCell(24));
        e.state = 'block'; e.timer = 0; e.talked = false;
      } else if (kind === 'sweep') {
        e = add(kind, i, { x: -200 - i * 8, z: -200 });
        e.active = false; e.cooldown = 14 + i * 7; e.dir = { x: 0, z: 1 }; e.speed = 9;
        e.model.root.visible = false;
      } else if (kind === 'crafters') {
        e = add(kind, i, randomUnlockedCell(30));
        e.stare = 0; e.cool = 0; e.state = 'lurk';
      } else if (kind === 'prize') {
        e = add(kind, i, randomHallCell(28));
        e.dir = pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]); e.want = e.dir;
        e.state = 'turn'; e.hug = 0; e.speed = 0; e.spin = 0; e.aimT = 0;
        e.rate = 0.88 + i * 0.05;
        e.lastX = e.x; e.lastZ = e.z; e.watchT = 0;
      } else if (kind === 'chalkles') {
        e = add(kind, i, { x: -200 - i * 8, z: -260 });
        e.active = false; e.cool = rand(8, 26) + i * 4; e.room = null;
        e.phase = 'idle'; e.t = 0; e.model.root.visible = false;
      } else if (kind === 'cloudy') {
        e = add(kind, i, { x: -240 - i * 8, z: -200 });
        e.active = false; e.cooldown = 12 + i * 6; e.dir = { x: 0, z: 1 };
        e.model.root.visible = false;
      } else if (kind === 'beans') {
        e = add(kind, i, randomHallCell(26));
        e.state = 'wander'; e.target = null; e.chew = rand(3, 8); e.bubble = 0;
      } else if (kind === 'weird') {
        /* no notebook required: he is already looking for you */
        e = add(kind, i, randomUnlockedCell(34) || randomUnlockedCell(0));
        e.move = null; e.moveT = 0; e.moveDur = 0;
        e.fartCool = rand(2, 6) + i * 1.5; e.fartStage = 0; e.spinDir = 1;
        scene.add(e.model.puff);          /* the cloud lives in world space */
      }
    }
  }
  G.prizeList = G.lists.prize;
}

/* --------------------------------------------------- generic agent stepping */
function stepAgent(e, tx, tz, speed, dt, radius) {
  const c = worldToCell(e.x, e.z);
  const tc = worldToCell(tx, tz);
  if (e.refreshTimer === undefined) e.refreshTimer = 0;
  e.refreshTimer -= dt;
  if (e.refreshTimer <= 0 || e.lastTx !== tc.x || e.lastTy !== tc.y) {
    computeFlow(e.field, tc.x, tc.y);
    e.lastTx = tc.x; e.lastTy = tc.y; e.refreshTimer = 0.35;
  }
  let goal;
  if (c.x === tc.x && c.y === tc.y) goal = { x: tx, z: tz };
  else {
    const n = flowNext(e.field, c.x, c.y);
    if (!n) goal = { x: tx, z: tz };
    else {
      const cc = cellCenter(n.x, n.y);
      goal = { x: cc.x, z: cc.z };
      const n2 = flowNext(e.field, n.x, n.y);
      if (n2) {
        const c2 = cellCenter(n2.x, n2.y);
        if (hasLOS(e.x, e.z, c2.x, c2.z)) goal = { x: c2.x, z: c2.z };
      }
    }
  }
  const dx = goal.x - e.x, dz = goal.z - e.z, d = Math.hypot(dx, dz);
  if (d < 0.01) return 0;
  const mv = Math.min(speed * dt, d);
  const nx = e.x + (dx / d) * mv, nz = e.z + (dz / d) * mv;
  const r = radius || 0.8;
  if (!blockedAt(nx, e.z, r)) e.x = nx;
  if (!blockedAt(e.x, nz, r)) e.z = nz;
  e.heading = angLerp(e.heading || 0, Math.atan2(dx, dz), 1 - Math.exp(-dt * 9));
  return speed;
}
/* Move an agent a fixed distance along its path INSTANTLY — one discrete
   lunge rather than a smooth glide. This is how Baldi travels: he stands
   still, cracks the ruler, and is suddenly further down the hall. */
function hopAgent(e, tx, tz, dist, radius) {
  const tc = worldToCell(tx, tz);
  computeFlow(e.field, tc.x, tc.y);
  const r = radius || 0.85;
  let px = e.x, pz = e.z, left = dist, guard = 0;
  while (left > 0.02 && guard++ < 32) {
    const c = worldToCell(px, pz);
    let goal;
    if (c.x === tc.x && c.y === tc.y) goal = { x: tx, z: tz };
    else {
      const n = flowNext(e.field, c.x, c.y);
      if (!n) break;
      const cc = cellCenter(n.x, n.y);
      goal = { x: cc.x, z: cc.z };
    }
    const dx = goal.x - px, dz = goal.z - pz, d = Math.hypot(dx, dz);
    if (d < 0.002) break;
    const mv = Math.min(left, d);
    const nx = px + (dx / d) * mv, nz = pz + (dz / d) * mv;
    if (blockedAt(nx, nz, r)) break;
    px = nx; pz = nz; left -= mv;
    e.heading = Math.atan2(dx, dz);
  }
  e.x = px; e.z = pz;
}

function wanderTarget() { const c = randomHallCell(0); return { x: c.x, z: c.z }; }
function place(e) { e.model.root.position.set(e.x, 0, e.z); }

/* ---------------------------------------------------------------- BALDI AI */
function updateBaldiOne(e, dt) {
  const m = e.model, p = G.player;
  const pos = new THREE.Vector3(p.x, 4.0, p.z);

  if (G.mode === 'intro') { place(e); return; }   // the cutscene drives him
  if (G.friendlyBaldi) { campaignBaldi(e, dt); return; }   // field trip: no chase at all
  if (shoveTick(e, dt)) {                        // riding the BSODA
    place(e); m.root.rotation.y = e.heading;
    m.update(dt, { speed: 0, anger: angerNorm(e), lookAt: pos });
    return;
  }

  if (!e.awake) {
    m.update(dt, { speed: 0, anger: 0, lookAt: pos });
    place(e);
    m.root.rotation.y = Math.sin(G.time * 0.4) * 0.6;
    return;
  }
  if (e.stun > 0) {
    e.stun -= dt;
    m.update(dt, { speed: 0, anger: angerNorm(e), lookAt: pos });
    place(e); return;
  }

  const interval = baldiInterval(e);
  const STRIDE = 3.7;                       // distance covered per ruler crack

  let tx = p.x, tz = p.z;
  if (e.distract && e.distract.t > 0) {
    e.distract.t -= dt;
    tx = e.distract.x; tz = e.distract.z;
    if (Math.hypot(e.x - tx, e.z - tz) < 2.5) e.distract.t = Math.min(e.distract.t, 1.2);
    if (e.distract.t <= 0) e.distract = null;
  }

  /* He does not walk. He waits, cracks the ruler, and is instantly a stride
     closer. The gap between lunges is the interval — so as he gets angrier
     the cracks come faster and he closes ground in bigger, quicker jerks. */
  e.slapT -= dt;
  if (e.slapT <= 0) {
    e.slapT += interval;
    m.doSlap(Math.min(0.42, interval * 0.85));
    const d = distToPlayer(e.x, e.z);
    const vol = clamp(1.15 - d / 68, 0.05, 1.0) * (hasLOS(p.x, p.z, e.x, e.z) ? 1 : 0.55);
    Audio1.slap(panFor(e.x, e.z), vol * 0.5, clamp(1.4 - interval * 0.35, 0.85, 1.35));
    hopAgent(e, tx, tz, STRIDE, 0.85);
    e.landT = 0.16;                          // little jolt as he arrives
  }
  e.landT = Math.max(0, (e.landT || 0) - dt);

  const jolt = e.landT > 0 ? Math.sin((1 - e.landT / 0.16) * Math.PI) : 0;
  m.root.position.set(e.x, -jolt * 0.18, e.z);
  m.root.rotation.y = e.heading;             // snaps, never eases
  m.update(dt, { speed: 0, anger: angerNorm(e), lookAt: pos });
  m.root.scale.set(1 + jolt * 0.05, 1 - jolt * 0.07, 1 + jolt * 0.05);

  if (distToPlayer(e.x, e.z) < 1.9 && (G.mode === 'play' || G.mode === 'rope')) caught(e);
}

/* ------------------------------------------------------------ PRINCIPAL */
function updatePrincipalOne(e, dt) {
  const m = e.model, p = G.player;
  const pos = new THREE.Vector3(p.x, 4.0, p.z);
  if (shoveTick(e, dt)) { place(e); m.update(dt, { speed: 0, lookAt: pos }); return; }
  if (e.stun > 0) { e.stun -= dt; m.update(dt, { speed: 0, lookAt: pos }); place(e); return; }
  e.cool = Math.max(0, e.cool - dt);

  const d = distToPlayer(e.x, e.z);
  const sees = d < 26 && hasLOS(p.x, p.z, e.x, e.z);
  const breaking = (p.running && p.stamina < 99.9) || p.brokeRule > 0;

  if (e.state === 'patrol') {
    if (!e.target || Math.hypot(e.x - e.target.x, e.z - e.target.z) < 2.0) e.target = wanderTarget();
    stepAgent(e, e.target.x, e.target.z, 5.2, dt, 0.75);
    if (sees && breaking && e.cool <= 0) {
      e.state = 'chase'; Audio1.whistle();
      UI.say(pick(['NO RUNNING IN THE HALLS!', 'HEY! Slow down!', 'That\'s a rule broken!']), 2600);
    }
  } else {
    stepAgent(e, p.x, p.z, 8.6, dt, 0.75);
    if (d < 2.2) { sendToDetention(); e.state = 'patrol'; e.cool = 9; e.target = null; }
    if (d > 34 || (!breaking && d > 14)) { e.state = 'patrol'; e.cool = 3; e.target = null; }
  }
  place(e); m.root.rotation.y = e.heading;
  // he never breaks his pose — no stride, no arm swing, he simply advances
  m.update(dt, { speed: 0, lookAt: pos });
}
function sendToDetention() {
  const p = G.player;
  const keyIdx = p.items.indexOf('key');
  if (keyIdx >= 0) {
    p.items[keyIdx] = null; refreshSlots();
    UI.say('You flash the Principal\'s own keys. He lets you off.', 3000);
    return;
  }
  G.detentions++;
  const secs = 12 + G.detentions * 5;
  const c = cellCenter(G.office.cx, G.office.cy);
  const spot = freeSpotNear(c.x, c.z, 0.95, 16);
  p.x = spot.x; p.z = spot.z;
  G.mode = 'detention'; G.detTime = secs;
  UI.el('detention').classList.remove('hidden');
  UI.el('detTime').textContent = Math.ceil(secs);
  document.exitPointerLock && document.exitPointerLock();
  Audio1.wrong();
}

/* ------------------------------------------------------------- PLAYTIME */
/* She is a decal on rails. She picks a corridor, charges dead straight down
   it faster than you can sprint, and vanishes at the far end. No steering,
   no turning, no curves, and she never sets foot in a classroom. */
const PLAYTIME_SPEED = 15.5;

function spawnPlaytime(e) {
  for (let i = 0; i < 240; i++) {
    const c = randomHallCell(20);
    const cx = c.cx, cy = c.cy;
    const horiz = Map1.at(cx + 1, cy) === W_HALL && Map1.at(cx - 1, cy) === W_HALL;
    const vert  = Map1.at(cx, cy + 1) === W_HALL && Map1.at(cx, cy - 1) === W_HALL;
    if (!horiz && !vert) continue;
    const useH = horiz && (!vert || Math.random() < 0.5);
    e.dir = useH ? { x: Math.random() < 0.5 ? 1 : -1, z: 0 }
                 : { x: 0, z: Math.random() < 0.5 ? 1 : -1 };
    // lock her to the middle of the corridor lane so she never clips a corner
    const centre = cellCenter(cx, cy);
    e.x = centre.x; e.z = centre.z;
    e.active = true;
    e.model.root.visible = true;
    if (distToPlayer(e.x, e.z) < 45) Audio1.playtimeTune();
    return;
  }
  e.cool = 3;
}

function updatePlaytimeOne(e, dt) {
  const m = e.model;
  if (e.shove) { if (shoveTick(e, dt)) { m.root.position.set(e.x, 0, e.z); m.update(dt, {}); return; } }

  if (e.state === 'roping') {
    e.ropePhase += dt * 6.5;
    m.root.position.set(e.x, 0, e.z);
    m.root.visible = true;
    m.update(dt, { roping: true, ropePhase: e.ropePhase });
    return;
  }

  if (!e.active) {
    m.root.visible = false;
    e.cool -= dt;
    if (e.cool <= 0) spawnPlaytime(e);
    return;
  }

  // dead straight. no pathfinding, no easing, no rotation.
  e.x += e.dir.x * PLAYTIME_SPEED * dt;
  e.z += e.dir.z * PLAYTIME_SPEED * dt;
  m.root.position.set(e.x, 0, e.z);
  m.root.visible = true;
  m.update(dt, {});

  const c = worldToCell(e.x, e.z);
  const stillInCorridor = Map1.at(c.x, c.y) === W_HALL &&
                          Map1.zoneAt(c.x, c.y) <= G.unlockedZones &&
                          !Map1.locked(c.x, c.y);
  if (!stillInCorridor) {                 // hit a wall, a door or a barricade
    e.active = false; e.cool = rand(5, 11);
    m.root.visible = false;
    return;
  }

  if (G.mode === 'play' && distToPlayer(e.x, e.z) < 2.6) startRope(e);
}

const Rope = { count: 5, phase: 0, window: false };
function startRope(who) {
  const p = G.player, e = who || G.ents.playtime;
  G.ropeEnt = e;
  const si = p.items.indexOf('scissors');
  if (si >= 0) {
    p.items[si] = null; refreshSlots();
    UI.say('*snip* You cut the rope. Playtime runs off crying.', 3000);
    e.state = 'gone'; e.active = false; e.cool = 26;
    e.model.root.visible = false;
    Audio1.ropeWhoosh();
    return;
  }
  const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1;
  for (const r of [6.0, 5.0, 4.0, 3.0]) {
    const tx = p.x + dx / d * r, tz = p.z + dz / d * r;
    if (!blockedAt(tx, tz, 0.8)) { e.x = tx; e.z = tz; break; }
  }
  p.yaw = Math.atan2(-dx, -dz); p.pitch = -0.05;
  e.state = 'roping'; e.ropePhase = 0;
  G.mode = 'rope'; Rope.count = 5; Rope.phase = 0;
  UI.el('ropeUI').classList.remove('hidden');
  UI.el('ropeCount').textContent = Rope.count;
  Audio1.playtimeTune();
  UI.say('Let\'s play jump rope! Five jumps!', 2600);
}
function updateRope(dt) {
  Rope.phase += dt * 3.1;
  if (Rope.phase > TAU) { Rope.phase -= TAU; Audio1.ropeWhoosh(); }
  if (G.ropeEnt) G.ropeEnt.ropePhase = Rope.phase;
  Rope.window = Math.sin(Rope.phase) > 0.55;
  UI.el('ropeHint').textContent = Rope.window ? '★ JUMP NOW! ★' : 'PRESS SPACE ON THE BEAT';
  UI.el('ropeHint').style.color = Rope.window ? '#9dff9d' : '#fff';
}
function ropeJump() {
  if (G.mode !== 'rope') return;
  if (Rope.window) {
    Rope.count--; Rope.phase = 0.1;
    Audio1.ropeTick(5 - Rope.count);
    UI.el('ropeCount').textContent = Math.max(0, Rope.count);
    if (Rope.count <= 0) endRope();
  } else {
    Audio1.wrong();
    UI.el('ropeCount').style.color = '#ff8f8f';
    setTimeout(() => { UI.el('ropeCount').style.color = '#ffd6f2'; }, 200);
  }
}
function endRope() {
  const e = G.ropeEnt || G.ents.playtime;
  if (!e) { G.mode = 'play'; UI.el('ropeUI').classList.add('hidden'); return; }
  e.state = 'gone'; e.active = false; e.cool = rand(10, 18);
  e.model.root.visible = false;
  G.mode = 'play';
  UI.el('ropeUI').classList.add('hidden');
  UI.say('That was fun! Bye!', 2000);
  resumeLock();
}

/* ---------------------------------------------------------------- BULLY */
function updateBullyOne(e, dt) {
  const m = e.model, p = G.player;
  const pos = new THREE.Vector3(p.x, 4.0, p.z);
  if (shoveTick(e, dt)) { place(e); m.update(dt, { lookAt: pos }); return; }
  place(e);
  const d = distToPlayer(e.x, e.z);
  m.root.rotation.y = angLerp(m.root.rotation.y, Math.atan2(p.x - e.x, p.z - e.z), 1 - Math.exp(-dt * 5));
  m.update(dt, { lookAt: pos });

  if (e.state === 'gone') {
    e.timer -= dt; m.root.visible = false;
    if (e.timer <= 0) {
      const c = randomHallCell(26); e.x = c.x; e.z = c.z;
      e.state = 'block'; m.root.visible = true;
    }
    return;
  }
  m.root.visible = true;
  if (d < 3.4) {
    if (!e.talked) { e.talked = true; UI.say('Gimme your stuff or you ain\'t gettin\' past!', 2600); }
    if (d < 2.6) {
      const has = p.items.findIndex(v => v);
      if (has >= 0) {
        const k = p.items[has]; p.items[has] = null; refreshSlots();
        UI.say('Thanks for the ' + ITEM_DEFS[k].name + '! Heh.', 2600);
        e.state = 'gone'; e.timer = 26; e.talked = false; Audio1.wrong();
      }
    }
  } else e.talked = false;
}

/* ------------------------------------------------------------ GOTTA SWEEP */
function updateSweepOne(e, dt) {
  const m = e.model, p = G.player;
  if (!e.active) {
    e.cooldown -= dt;
    if (e.cooldown <= 0) {
      const vertical = Math.random() < 0.5;
      const lines = vertical ? [4, 5, 22, 23, 42, 43] : [4, 5, 18, 19, 32, 33, 48, 49];
      const line = pick(lines), forward = Math.random() < 0.5;
      const startI = forward ? 4 : (vertical ? 49 : 43);
      const c = vertical ? cellCenter(line, startI) : cellCenter(startI, line);
      if (Map1.zoneAt(vertical ? line : startI, vertical ? startI : line) > G.unlockedZones) {
        e.cooldown = 6; return;
      }
      e.x = c.x; e.z = c.z;
      e.dir = vertical ? { x: 0, z: forward ? 1 : -1 } : { x: forward ? 1 : -1, z: 0 };
      e.active = true; m.root.visible = true;
      Audio1.sweepLoop(true);
      UI.say('Gotta sweep, sweep, sweep!', 2400);
    }
    return;
  }
  e.x += e.dir.x * e.speed * dt;
  e.z += e.dir.z * e.speed * dt;
  place(e);
  m.root.rotation.y = Math.atan2(e.dir.x, e.dir.z);
  m.update(dt, { lookAt: new THREE.Vector3(p.x, 5, p.z) });
  const d = distToPlayer(e.x, e.z);
  Audio1.sweepVol(clamp(1 - d / 45, 0, 1));
  if (G.mode === 'play' && d < 2.6) {
    const nx = p.x + e.dir.x * e.speed * dt, nz = p.z + e.dir.z * e.speed * dt;
    if (!blockedAt(nx, p.z, 0.9)) p.x = nx;
    if (!blockedAt(p.x, nz, 0.9)) p.z = nz;
  }
  const c = worldToCell(e.x, e.z);
  if (c.x < 3 || c.x > 44 || c.y < 3 || c.y > 50 || !Map1.walkable(c.x, c.y)) {
    e.active = false; m.root.visible = false;
    e.cooldown = rand(30, 55);
    Audio1.sweepLoop(false);
  }
}

/* -------------------------------------------------------- ARTS AND CRAFTERS */
function updateCraftersOne(e, dt) {
  const m = e.model, p = G.player;
  if (shoveTick(e, dt)) { place(e); m.update(dt, { stare: 0 }); return; }
  if (e.disabled > 0) { e.disabled -= dt; if (e.disabled <= 0) m.root.visible = true; else return; }
  const pos = new THREE.Vector3(p.x, 4.0, p.z);
  const d = distToPlayer(e.x, e.z);
  const watched = d < 34 && playerSees(e.x, e.z, 0.55);

  if (e.stun > 0) { e.stun -= dt; m.update(dt, { stare: 0, lookAt: pos }); place(e); return; }

  if (watched) {
    // freezes when watched, and his patience runs out
    e.stare = Math.min(1, e.stare + dt * (d < 16 ? 0.55 : 0.32));
    if (e.stare >= 1 && G.mode === 'play') {
      const raw = randomUnlockedCell(20);
      const spot = freeSpotNear(raw.x, raw.z, 0.95, 16);
      p.x = spot.x; p.z = spot.z;
      Audio1.scream();
      UI.flash(0.85);
      UI.say('Arts and Crafters didn\'t like that. You\'re somewhere else now.', 3200);
      e.stare = 0; e.cool = 8;
      const away = randomUnlockedCell(30); e.x = away.x; e.z = away.z;
    }
  } else {
    e.stare = Math.max(0, e.stare - dt * 0.5);
    e.cool = Math.max(0, e.cool - dt);
    if (e.cool <= 0) stepAgent(e, p.x, p.z, 5.4, dt, 0.7);
  }
  place(e);
  m.root.rotation.y = angLerp(m.root.rotation.y, Math.atan2(p.x - e.x, p.z - e.z), 1 - Math.exp(-dt * 6));
  m.update(dt, { stare: e.stare, lookAt: pos });

  // a warning ring on the HUD as his patience drains
  const ring = UI.el('stareRing');
  if (ring) {
    ring.style.opacity = e.stare > 0.05 ? Math.min(1, e.stare + 0.15) : 0;
    ring.style.transform = 'translate(-50%,-50%) scale(' + (1.3 - e.stare * 0.35) + ')';
  }
}

/* ---------------------------------------------------------------- 1ST PRIZE */
/* Straight lines only. He NEVER moves and turns at the same time — he stops
   dead, rotates (slowly, like the real thing: a full turn takes many seconds),
   and only then accelerates away in a perfectly straight line. On contact he
   halts, turns to face you, and shoves you to the end of the hallway. */
const PRIZE_TURN_LOCK = 0.62;   // rad/s while lining you up — deliberately slow
const PRIZE_TURN_FREE = 2.10;   // rad/s when just picking a clear lane
const PRIZE_CRUISE    = 9.0;
const PRIZE_TOP       = 19.0;   // he accelerates the longer the straight is
const PRIZE_PUSH      = 14.5;

/* He only ever travels along a corridor axis — never a diagonal. That keeps
   every run dead straight AND stops him grinding along walls at an angle. */
function snapAxis(a) { return Math.round(a / (Math.PI / 2)) * (Math.PI / 2); }
/* centre him in the lane he's about to drive down, so he can't clip a corner */
function prizeLockLane(e) {
  if ((e.speed || 0) > 0.01) return;            // never nudge him mid-run
  const alongX = Math.abs(Math.sin(e.want)) > 0.5;
  const keep = { x: e.x, z: e.z };
  if (alongX) e.z = (Math.floor(e.z / CS) + 0.5) * CS;
  else        e.x = (Math.floor(e.x / CS) + 0.5) * CS;
  if (blockedAt(e.x, e.z, 1.05) || Math.hypot(e.x - keep.x, e.z - keep.z) > 1.6) {
    e.x = keep.x; e.z = keep.z;
  }
}

function prizeTurn(e, rate, dt) {
  let diff = ((e.want - e.dir + Math.PI) % TAU + TAU) % TAU - Math.PI;
  const step = rate * dt;
  if (Math.abs(diff) <= step) { e.dir = e.want; return 0; }
  e.dir += (diff > 0 ? 1 : -1) * step;
  return diff - (diff > 0 ? 1 : -1) * step;
}
function prizeClear(e, dir, maxD) {
  for (let s = 1.4; s <= maxD; s += 1.4) {
    if (blockedAt(e.x + Math.sin(dir) * s, e.z + Math.cos(dir) * s, 1.1)) return s;
  }
  return maxD;
}
/* Pick a lane he can actually drive down. This is what stops him burying his
   face in a wall: a candidate is only accepted if it has real room ahead. */
function prizePickLane(e, avoidCurrent) {
  const cands = [];
  for (let k = 0; k < 4; k++) cands.push(k * Math.PI / 2);
  let best = null, bestScore = -1;
  for (const c of cands) {
    let diff = Math.abs(((c - e.dir + Math.PI) % TAU + TAU) % TAU - Math.PI);
    if (avoidCurrent && diff < 0.3) continue;
    const room = prizeClear(e, c, 26);
    if (room < 3.2) continue;
    // prefer long lanes, and lanes that head roughly toward the player
    const toP = Math.atan2(G.player.x - e.x, G.player.z - e.z);
    let toward = Math.abs(((c - toP + Math.PI) % TAU + TAU) % TAU - Math.PI);
    const score = room + (Math.PI - toward) * 5;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  if (best === null) best = snapAxis(e.dir + Math.PI);   // dead end: turn right around
  e.want = snapAxis(best);
  prizeLockLane(e);
  return e.want;
}

function updateOnePrize(e, dt) {
  const m = e.model, p = G.player;
  const pos = new THREE.Vector3(p.x, 4.2, p.z);
  if (shoveTick(e, dt)) { place(e); m.root.rotation.y = e.dir;
    m.update(dt, { speed: 0, hug: 0, lookAt: pos }); return; }

  // wires cut — he spins uselessly for a while
  if (e.spin > 0) {
    e.spin -= dt; e.dir += dt * 3.4; e.speed = 0;
    place(e); m.root.rotation.y = e.dir;
    m.update(dt, { speed: 0, hug: 0, lookAt: pos });
    return;
  }
  if (e.stun > 0) {
    e.stun -= dt; e.speed = 0;
    place(e); m.root.rotation.y = e.dir;
    m.update(dt, { speed: 0, hug: 0, lookAt: pos });
    return;
  }

  const d = distToPlayer(e.x, e.z);
  const sees = d < 46 && hasLOS(p.x, p.z, e.x, e.z);

  /* ---- shoving you down the hall ---- */
  if (e.state === 'push') {
    e.hug = 1;
    const step = PRIZE_PUSH * dt;
    const nx = e.x + Math.sin(e.dir) * step, nz = e.z + Math.cos(e.dir) * step;
    if (blockedAt(nx, nz, 1.15)) {           // end of the hallway
      e.state = 'turn'; e.speed = 0; e.hug = 0; e.aimT = 0;
      prizePickLane(e, true);
      UI.say('1st Prize lets go.', 1600);
      return;
    }
    e.x = nx; e.z = nz;
    if (G.mode === 'play') {
      const px = p.x + Math.sin(e.dir) * step, pz = p.z + Math.cos(e.dir) * step;
      if (!blockedAt(px, p.z, 0.9)) p.x = px;
      if (!blockedAt(p.x, pz, 0.9)) p.z = pz;
    }
    if (distToPlayer(e.x, e.z) > 5.0) {      // you slipped out
      e.state = 'turn'; e.hug = 0; e.speed = 0; prizePickLane(e, false);
      UI.say('1ST PRIZE: "I HAVE LOST YOU — I DON\'T LIKE THAT"', 2600);
    }
    place(e); m.root.rotation.y = e.dir;
    m.update(dt, { speed: PRIZE_PUSH, hug: 1, lookAt: pos });
    return;
  }

  /* ---- caught you: stop, then slowly line you up before shoving ---- */
  if (e.state === 'aim') {
    e.speed = 0;
    e.aimT = (e.aimT || 0) + dt;
    e.want = snapAxis(Math.atan2(p.x - e.x, p.z - e.z));
    const left = prizeTurn(e, PRIZE_TURN_LOCK, dt);
    e.hug = clamp(1 - Math.abs(left), 0, 1);
    // he always takes a beat to line you up, even if he was nearly facing you
    if (Math.abs(left) < 0.07 && e.aimT > 0.85) {
      e.state = 'push';
      Audio1.tone(300, 0.25, 0.12, 'square', panFor(e.x, e.z), null, 700);
      UI.say('1st Prize has you! Hold on…', 2000);
    }
    if (d > 5.5) { e.state = 'turn'; e.hug = 0; e.aimT = 0; prizePickLane(e, false); }
    place(e); m.root.rotation.y = e.dir;
    m.update(dt, { speed: 0, hug: e.hug, lookAt: pos });
    return;
  }

  /* ---- roaming: turn OR roll, never both at once ---- */
  e.hug = Math.max(0, e.hug - dt * 2);
  if (sees) {
    const axis = snapAxis(Math.atan2(p.x - e.x, p.z - e.z));
    if (axis !== e.want && prizeClear(e, axis, 6) > 3.0) {
      e.want = axis; e.speed = 0; prizeLockLane(e);   // stop, then turn, then go
    }
  }

  let diff = ((e.want - e.dir + Math.PI) % TAU + TAU) % TAU - Math.PI;
  if (Math.abs(diff) > 0.06) {
    // TURNING — he is stationary, so his path can never curve
    prizeTurn(e, sees ? PRIZE_TURN_LOCK : PRIZE_TURN_FREE, dt);
    e.speed = 0;
    m.update(dt, { speed: 0, hug: e.hug, lookAt: pos });
  } else {
    // ROLLING — dead straight, winding up to speed
    const top = (sees ? PRIZE_TOP : PRIZE_CRUISE) * (e.rate || 1);
    e.speed = Math.min(top, (e.speed || 0) + dt * (sees ? 15 : 8));
    const step = e.speed * dt;
    const nx = e.x + Math.sin(e.dir) * step, nz = e.z + Math.cos(e.dir) * step;
    if (blockedAt(nx, nz, 1.05)) {
      e.speed = 0;
      prizePickLane(e, true);            // a lane with real room, not the wall
    } else { e.x = nx; e.z = nz; }
    m.update(dt, { speed: e.speed, hug: e.hug, lookAt: pos });
  }

  /* last-resort unjam: if he has gone nowhere for a while, force a new lane */
  e.watchT = (e.watchT || 0) + dt;
  if (e.watchT > 1.4) {
    const moved = Math.hypot(e.x - (e.lastX || 0), e.z - (e.lastZ || 0));
    if (moved < 0.6 && e.state !== 'aim') { e.speed = 0; prizePickLane(e, true); }
    e.lastX = e.x; e.lastZ = e.z; e.watchT = 0;
  }

  place(e); m.root.rotation.y = e.dir;
  if (d < 2.5 && G.mode === 'play') { e.state = 'aim'; e.speed = 0; e.aimT = 0; }
}

function updatePrize(dt) { forEachKind('prize', updateOnePrize, dt); }

/* ---------------------------------------------------------------- fan-out */
function forEachKind(kind, fn, dt) {
  const list = (G.lists && G.lists[kind]) || [];
  for (let i = 0; i < list.length; i++) fn(list[i], dt);
}
function updateBaldi(dt)     { forEachKind('baldi', updateBaldiOne, dt); }
function updatePrincipal(dt) { forEachKind('principal', updatePrincipalOne, dt); }
function updatePlaytime(dt)  { forEachKind('playtime', updatePlaytimeOne, dt); }
function updateBully(dt)     { forEachKind('bully', updateBullyOne, dt); }
function updateSweep(dt)     { forEachKind('sweep', updateSweepOne, dt); }
function updateCrafters(dt)  { forEachKind('crafters', updateCraftersOne, dt); }
function updateChalkles(dt)  { forEachKind('chalkles', updateChalklesOne, dt); }
function updateCloudy(dt)    { forEachKind('cloudy', updateCloudyOne, dt); }
function updateBeans(dt)     { forEachKind('beans', updateBeansOne, dt); }

/* ---------------------------------------------------------------- CHALKLES */
function updateChalklesOne(e, dt) {
  const m = e.model, p = G.player;
  if (e.disabled > 0) { e.disabled -= dt; return; }
  const pc = worldToCell(p.x, p.z);
  const room = Map1.rooms.find(r => pc.x >= r.x0 && pc.x <= r.x1 && pc.y >= r.y0 && pc.y <= r.y1);

  if (e.phase === 'idle') {
    e.cool -= dt;
    m.root.visible = false;
    if (e.cool <= 0 && room && room.boardPos && G.mode === 'play') {
      e.room = room; e.phase = 'appear'; e.t = 0;
      e.x = room.boardPos.x; e.z = room.boardPos.z + 1.4;
      m.root.position.set(e.x, room.boardPos.y, e.z);
      m.root.visible = true;
      Audio1.tone(520, 0.2, 0.08, 'triangle', panFor(e.x, e.z), null, 300);
    }
    return;
  }
  e.t += dt;
  m.root.position.set(e.x, 4.4 + Math.sin(e.t * 2.2) * 0.25, e.z);
  m.update(dt, { angry: e.phase === 'blind', baseY: 4.4, faceCam: true });

  if (e.phase === 'appear') {
    if (e.t > 1.4) {
      e.phase = 'blind'; e.t = 0;
      // his laugh
      [440, 392, 440, 349].forEach((f, i) => setTimeout(() => Audio1.tone(f, 0.16, 0.10, 'square'), i * 130));
      if (distToPlayer(e.x, e.z) < 26) { G.blind = 5.0; UI.say('Chalkles: "Hee hee hee!"', 2600); }
    }
  } else if (e.phase === 'blind') {
    if (e.t > 4.0) { e.phase = 'idle'; e.cool = rand(22, 45); m.root.visible = false; }
  }
}

/* ------------------------------------------------------------ CLOUDY COPTER */
function updateCloudyOne(e, dt) {
  const m = e.model, p = G.player;
  if (!e.active) {
    e.cooldown -= dt;
    if (e.cooldown <= 0) {
      const c = randomHallCell(24);
      e.x = c.x; e.z = c.z;
      const cell = worldToCell(e.x, e.z);
      const horiz = Map1.walkable(cell.x + 1, cell.y) && Map1.walkable(cell.x - 1, cell.y);
      e.dir = horiz ? { x: Math.random() < 0.5 ? 1 : -1, z: 0 } : { x: 0, z: Math.random() < 0.5 ? 1 : -1 };
      e.active = true; e.life = rand(14, 24);
      m.root.visible = true;
      UI.say('Cloudy Copter is stirring up a gale!', 2400);
    }
    return;
  }
  e.life -= dt;
  m.root.position.set(e.x, 3.4, e.z);
  m.root.rotation.y = Math.atan2(e.dir.x, e.dir.z);
  // he blows anyone lined up in front of him
  const dx = p.x - e.x, dz = p.z - e.z;
  const along = dx * e.dir.x + dz * e.dir.z;
  const across = Math.abs(dx * e.dir.z - dz * e.dir.x);
  const blowing = along > 0 && along < 34 && across < 3.2 && hasLOS(e.x, e.z, p.x, p.z);
  m.update(dt, { blowing, lookAt: new THREE.Vector3(p.x, 4, p.z) });
  if (blowing && G.mode === 'play') {
    const force = 9 * (1 - along / 34);
    const nx = p.x + e.dir.x * force * dt, nz = p.z + e.dir.z * force * dt;
    if (!blockedAt(nx, p.z, 0.9)) p.x = nx;
    if (!blockedAt(p.x, nz, 0.9)) p.z = nz;
    if (!e.wind) { e.wind = true; Audio1.noise(1.2, 0.09, 'bandpass', 700, 0.7, panFor(e.x, e.z), 'flat'); }
  } else e.wind = false;
  if (e.life <= 0) { e.active = false; e.cooldown = rand(22, 40); m.root.visible = false; }
}

/* ---------------------------------------------------------------- BEANS */
function updateBeansOne(e, dt) {
  const m = e.model, p = G.player;
  const pos = new THREE.Vector3(p.x, 4.0, p.z);
  if (shoveTick(e, dt)) { place(e); m.update(dt, { speed: 0, lookAt: pos }); return; }
  if (e.stun > 0) { e.stun -= dt; m.update(dt, { speed: 0, lookAt: pos }); place(e); return; }

  const d = distToPlayer(e.x, e.z);
  const canSee = d < 30 && hasLOS(p.x, p.z, e.x, e.z);
  if (canSee) {
    e.chew -= dt;
    e.bubble = clamp(1 - e.chew / 2.2, 0, 1);
    if (e.chew <= 0) {
      e.chew = rand(5, 10); e.bubble = 0;
      // spit: instant line check with a visible blob
      spawnGum(e.x, e.z, p.x, p.z);
      if (d < 26) {
        p.stuck = 2.6;
        UI.say('Beans stuck gum on you! You can\'t move!', 2600);
        Audio1.tone(160, 0.3, 0.12, 'sawtooth', panFor(e.x, e.z), null, 90);
      }
    }
    if (!e.target || Math.hypot(e.x - e.target.x, e.z - e.target.z) < 2) e.target = wanderTarget();
    stepAgent(e, e.target.x, e.target.z, 4.0, dt, 0.75);
  } else {
    e.bubble = 0; e.chew = Math.max(1.4, e.chew);
    if (!e.target || Math.hypot(e.x - e.target.x, e.z - e.target.z) < 2) e.target = wanderTarget();
    stepAgent(e, e.target.x, e.target.z, 5.0, dt, 0.75);
  }
  place(e); m.root.rotation.y = e.heading;
  m.update(dt, { speed: 4, bubble: e.bubble, lookAt: pos });
}
function spawnGum(ax, az, bx, bz) {
  const g = sph(0.4, MAT.gum, 1, 1, 1, 10);
  g.position.set(ax, 3.0, az);
  G.scene.add(g);
  G.gums = G.gums || [];
  G.gums.push({ m: g, x: ax, z: az, tx: bx, tz: bz, t: 0 });
}
function updateGums(dt) {
  if (!G.gums) return;
  for (let i = G.gums.length - 1; i >= 0; i--) {
    const gm = G.gums[i];
    gm.t += dt * 1.6;
    gm.m.position.set(lerp(gm.x, gm.tx, gm.t), 3.0 - Math.sin(gm.t * Math.PI) * -1.2 + 1.2 * gm.t,
                      lerp(gm.z, gm.tz, gm.t));
    if (gm.t >= 1) { G.scene.remove(gm.m); G.gums.splice(i, 1); }
  }
}

/* ---------------------------------------------------------------- doors */
function updateDoors(dt) {
  const p = G.player;
  for (const d of Map1.doors) {
    const dist = Math.hypot(d.wx - p.x, d.wz - p.z);
    let want = dist < 3.4 ? 1 : 0;
    if (!want) {
      for (const e of G.cast) {
        if (e && e.active && Math.hypot(d.wx - e.x, d.wz - e.z) < 3.4) { want = 1; break; }
      }
    }
    if (want !== d.target) { d.target = want; if (dist < 26) Audio1.door(!!want); }
    d.open = lerp(d.open, d.target, 1 - Math.exp(-dt * 9));
    d.pivot.rotation.y = d.open * (d.horizontal ? -Math.PI * 0.62 : Math.PI * 0.62);
  }
}

/* =========================================================================
   The opening cutscene — Baldi walks up and welcomes you to the schoolhouse
   ========================================================================= */
const Intro = {
  lines: [
    { t: 'Hi! Welcome to my schoolhouse!', s: 2.6 },
    { t: 'I\'m Baldi. I\'ll be your teacher today.', s: 2.8 },
    { t: 'Oh no — I dropped my notebooks all over the school!', s: 3.2 },
    { t: 'Find them, and answer the problems inside. It\'s easy!', s: 3.4 },
    { t: 'But please… don\'t get any of them wrong.', s: 3.0 },
    { t: 'Most of the building is closed today.', s: 2.6 },
    { t: 'Just Homeroom and Classroom 2A, right down this hall.', s: 3.4 },
    { t: 'Get all the notebooks and meet me at the exit. Have fun!', s: 3.6 }
  ],
  i: 0, t: 0, active: false, walkOff: 0,
  start() {
    const b = G.ents.baldi, p = G.player;
    this.i = 0; this.t = 0; this.active = true; this.walkOff = 0;
    G.mode = 'intro';
    b.x = p.x; b.z = p.z - 7.5;
    b.model.root.position.set(b.x, 0, b.z);
    b.model.root.rotation.y = 0;
    b.model.setMood(0);
    b.awake = false;
    p.yaw = 0; p.pitch = 0.04;
    UI.el('dialogue').classList.remove('hidden');
    UI.el('dlgName').textContent = 'BALDI';
    this.show();
  },
  show() {
    const l = this.lines[this.i];
    UI.el('dlgText').textContent = l.t;
    G.ents.baldi.model.say(l.s * 0.85);
    Audio1.tone(300 + this.i * 8, 0.09, 0.05, 'square');
    this.t = l.s;
  },
  skip() { this.t = 0; },
  update(dt) {
    const b = G.ents.baldi, p = G.player;
    const look = new THREE.Vector3(p.x, 4.2, p.z);
    b.model.root.rotation.y = Math.atan2(p.x - b.x, p.z - b.z);
    this.t -= dt;
    if (this.walkOff > 0) {
      this.walkOff -= dt;
      b.z -= 9 * dt;
      b.model.root.position.set(b.x, 0, b.z);
      b.model.root.rotation.y = Math.PI;
      b.model.update(dt, { speed: 9, anger: 0, lookAt: look });
      if (this.walkOff <= 0) this.finish();
      return;
    }
    b.model.update(dt, { speed: 0, anger: 0, lookAt: look });
    if (this.t <= 0) {
      this.i++;
      if (this.i >= this.lines.length) {
        UI.el('dialogue').classList.add('hidden');
        this.walkOff = 2.2;
        UI.say('Baldi wanders off down the hall.', 2400);
      } else this.show();
    }
  },
  finish() {
    this.active = false;
    G.mode = 'play';
    const spot = randomUnlockedCell(26);
    G.ents.baldi.x = spot.x; G.ents.baldi.z = spot.z;
    G.ents.baldi.model.root.position.set(spot.x, 0, spot.z);
    resumeLock();
    UI.say('Find ' + G.total + ' notebooks, then reach an exit.', 3400);
  }
};


/* =========================================================================
   Part 5b — BALDI'S FIELD TRIP  (campaign mode)

   No chase, no ruler, no detention. Just you and Baldi, who is in an
   unusually good mood: he is your guide, he sets you little games, and he
   never once gets cross — not even when you get a sum wrong.
   The trip starts at the school bus parked out front.
   ========================================================================= */

/* ------------------------------------------------------- the bus bay
   The south exit normally opens onto nothing. For the field trip we carve a
   little walled bus bay outside it so you can actually walk out and see the
   bus. Called after generateMap() and before buildWorld(). */
const BUSLOT = { x0: 18, x1: 28, y0: 51, y1: 53 };
function carveBusLot() {
  for (let y = BUSLOT.y0; y <= BUSLOT.y1; y++) {
    for (let x = BUSLOT.x0; x <= BUSLOT.x1; x++) {
      if (Map1.at(x, y) === W_WALL) Map1.set(x, y, W_HALL);
      const i = y * MW + x;
      Map1.zone[i] = 1;
      Map1.gate[i] = 0;
    }
  }
}

/* ---------------------------------------------------------------- the bus */
function makeBus() {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: 0xf6c11a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd8e8 });
  const rubber = new THREE.MeshLambertMaterial({ color: 0x1b1e23 });
  const white = new THREE.MeshLambertMaterial({ color: 0xe8e8e0 });

  const hull = box(7.0, 5.4, 17.0, body); hull.position.y = 4.2; g.add(hull);
  const hood = box(6.4, 3.2, 3.6, body); hood.position.set(0, 3.0, 9.6); g.add(hood);
  const roof = box(7.34, 0.5, 17.2, white); roof.position.y = 7.22; g.add(roof);
  const skirt = box(7.3, 1.4, 17.1, dark); skirt.position.y = 1.9; g.add(skirt);
  const stripe = box(7.28, 0.45, 17.05, dark); stripe.position.y = 5.5; g.add(stripe);

  /* windows down both sides */
  for (let i = 0; i < 5; i++) {
    for (const sx of [-1, 1]) {
      const w = box(0.2, 2.0, 2.4, glass);
      w.position.set(sx * 3.66, 4.9, -6.4 + i * 3.2); g.add(w);
    }
  }
  const wind = box(5.6, 2.2, 0.2, glass); wind.position.set(0, 4.6, 11.3); g.add(wind);

  /* folding door on the kerb side */
  const doorL = box(0.16, 3.6, 1.0, glass); doorL.position.set(3.68, 3.5, 7.2); g.add(doorL);
  const doorR = box(0.16, 3.6, 1.0, glass); doorR.position.set(3.68, 3.5, 6.1); g.add(doorR);
  const stepA = box(1.4, 0.3, 2.2, dark); stepA.position.set(4.1, 1.2, 6.6); g.add(stepA);
  const stepB = box(1.8, 0.3, 2.2, dark); stepB.position.set(4.6, 0.5, 6.6); g.add(stepB);

  /* wheels */
  for (const sx of [-1, 1]) for (const sz of [7.0, -5.2]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.0, 14), rubber);
    w.rotation.z = Math.PI / 2; w.position.set(sx * 3.4, 1.5, sz); g.add(w);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.1, 10),
      new THREE.MeshLambertMaterial({ color: 0xb9c2cc }));
    hub.rotation.z = Math.PI / 2; hub.position.set(sx * 3.4, 1.5, sz); g.add(hub);
  }

  /* stop sign */
  const sign = new THREE.Mesh(new THREE.CircleGeometry(1.1, 8),
    new THREE.MeshLambertMaterial({ color: 0xd02020, side: THREE.DoubleSide }));
  sign.position.set(-3.95, 4.4, 1.5); sign.rotation.y = -Math.PI / 2; g.add(sign);

  /* SCHOOL BUS lettering down both flanks */
  const sc = cv(256, 48);
  sc.x.fillStyle = '#f6c11a'; sc.x.fillRect(0, 0, 256, 48);
  sc.x.fillStyle = '#191b1f'; sc.x.font = 'bold 30px Arial'; sc.x.textAlign = 'center';
  sc.x.fillText('SCHOOL BUS', 128, 34);
  const letMat = new THREE.MeshLambertMaterial({ map: texFrom(sc.c, 1, 1) });
  for (const sx of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 1.5), letMat);
    t.position.set(sx * 3.72, 6.35, 0); t.rotation.y = sx * Math.PI / 2; g.add(t);
  }

  /* headlights */
  for (const sx of [-1, 1]) {
    const h = sph(0.5, new THREE.MeshBasicMaterial({ color: 0xfff6cc }), 1, 1, 0.6, 8);
    h.position.set(sx * 2.2, 3.2, 11.4); g.add(h);
  }
  return g;
}


/* =========================================================================
   BALDI'S FIELD TRIP
   Stage one happens at school — he walks you out to the bus. Everything
   after that happens in the woods.
   ========================================================================= */
const CAMPAIGN = [
  {
    id: 'bus', title: 'ALL ABOARD', where: 'school',
    goal: 'Follow Baldi out the south doors and get on the bus',
    lines: [
      'Class! Grab your things — we are going CAMPING!',
      'Real woods. A real campfire. Not one single pop quiz.',
      'Look, I even wore the hat. The bus is out the south doors — follow me!'
    ]
  },
  {
    id: 'arrive', title: 'INTO THE WOODS', where: 'forest',
    goal: 'Follow the trail up to the campsite',
    lines: [
      'Here we are! Smell that? That is fresh air. Terrifying, isn\'t it.',
      'The campsite is at the top of the trail. Just follow the dirt.',
      'Mind the trees. They do not move out of the way like the lockers do.'
    ]
  },
  {
    id: 'wood', title: 'FIREWOOD', where: 'forest',
    goal: 'Find sticks in the woods and feed the fire',
    lines: [
      'A campsite needs a campfire, and a campfire needs wood.',
      'Sticks are all over these woods. Grab an armful and drop them on the fire.',
      'Careful though — the more you carry, the slower you go. And the fire burns down.'
    ]
  },
  {
    id: 'nature', title: 'NATURE HUNT', where: 'forest',
    goal: 'Find 4 nature treasures out in the woods',
    lines: [
      'Now for my favourite part. A nature hunt!',
      'A pinecone, a feather, a mushroom and one really good leaf.',
      'They are scattered all over. Off you go!'
    ]
  },
  {
    id: 'hide', title: 'HIDE AND SEEK', where: 'forest',
    goal: 'Find where Baldi is hiding',
    lines: [
      'My turn! I am going to hide somewhere in these woods.',
      'I will shout if you are getting warmer. I am very bad at whispering.',
      'One… two… no peeking!'
    ]
  },
  {
    id: 'marsh', title: 'MARSHMALLOWS', where: 'forest',
    goal: 'Fetch the marshmallows and bring them to the fire',
    lines: [
      'Last thing. The most important thing. MARSHMALLOWS.',
      'I left the bag down by the lake. Bring it back to the fire.',
      'Then we toast them and I tell you a story about long division.'
    ]
  }
];

const NATURE_KINDS = ['pinecone', 'feather', 'mushroom', 'leaf'];
const NATURE_NAMES = { pinecone: 'pinecone', feather: 'blue feather', mushroom: 'spotty mushroom', leaf: 'perfect leaf' };

const Campaign = {
  active: false, stage: 0, phase: 'idle', t: 0, line: 0, lineT: 0,
  target: null, marker: null, bus: null, lot: [], busDoor: null,
  world: 'school', exit: null, timer: 0, warmT: 0,
  fire: null, fuel: 1, sticks: [], carry: 0, delivered: 0, wantWood: 8,
  nature: [], found: 0, bag: null, hint: 0, items: [],

  /* ------------------------------------------------------------- start */
  start() {
    this.active = true; this.stage = -1; this.phase = 'idle';
    this.t = 0; this.world = 'school'; this.bus = null; this.lot = [];
    this.marker = null; this.target = null; this.items = [];
    this.sticks = []; this.nature = []; this.bag = null; this.fire = null;
    this.carry = 0; this.delivered = 0; this.found = 0; this.fuel = 1;
    this.hasBag = false; this.coldSaid = false; this.hint = 0;
    G.friendlyBaldi = true; G.baldiLeftPad = false; G.loadFactor = 1;

    for (const nb of G.nbList) if (!nb.taken && nb.mesh) G.scene.remove(nb.mesh);
    G.nbList = []; G.notebooks = 0; G.total = 0;
    UI.el('nbCount').innerHTML = '';

    this.exit = Map1.exits.find(e => e.main) || Map1.exits[0];
    if (this.exit) {
      if (this.exit.bar) this.exit.bar.visible = false;
      if (this.exit.doorMesh) this.exit.doorMesh.visible = false;
    }
    this.parkBus();

    const b = G.ents.baldi;
    if (b) {
      dressForCamp(b.model, true);                 // the cow hat goes on
      const sp = freeSpotNear(G.player.x, G.player.z - 6, 1.0, 14);
      b.x = sp.x; b.z = sp.z; b.awake = true; b.anger = 0;
      b.model.root.position.set(b.x, 0, b.z);
      b.model.setMood(0);
    }
    this.nextStage();
  },

  /* -------------------------------------------------------- school lot */
  dressLot() {
    const w = (BUSLOT.x1 - BUSLOT.x0 + 1) * CS, d = (BUSLOT.y1 - BUSLOT.y0 + 1) * CS;
    const cx = (BUSLOT.x0 + (BUSLOT.x1 - BUSLOT.x0 + 1) / 2) * CS;
    const cz = (BUSLOT.y0 + (BUSLOT.y1 - BUSLOT.y0 + 1) / 2) * CS;
    const sc = cv(64, 64);
    sc.x.fillStyle = '#4a4d52'; sc.x.fillRect(0, 0, 64, 64);
    for (let k = 0; k < 500; k++) {
      sc.x.fillStyle = Math.random() < 0.5 ? '#54575c' : '#42454a';
      sc.x.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
    }
    const tar = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshLambertMaterial({ map: texFrom(sc.c, w / 6, d / 6) }));
    tar.rotation.x = -Math.PI / 2; tar.position.set(cx, 0.06, cz);
    G.scene.add(tar); this.lot.push(tar);
    const paint = new THREE.MeshBasicMaterial({ color: 0xf2d43a });
    for (let i = -2; i <= 2; i++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 9), paint);
      line.rotation.x = -Math.PI / 2; line.position.set(cx + i * 4.4, 0.09, cz + 1.2);
      G.scene.add(line); this.lot.push(line);
    }
    const post = new THREE.MeshLambertMaterial({ color: 0x9aa3ad });
    const zEdge = (BUSLOT.y1 + 1) * CS - 0.5;
    for (let x = BUSLOT.x0 * CS; x <= (BUSLOT.x1 + 1) * CS; x += 4) {
      const pst = box(0.3, 3.2, 0.3, post);
      pst.position.set(x, 1.6, zEdge); G.scene.add(pst); this.lot.push(pst);
    }
    for (const y of [1.1, 2.6]) {
      const rail = box((BUSLOT.x1 - BUSLOT.x0 + 1) * CS, 0.18, 0.18, post);
      rail.position.set(cx, y, zEdge); G.scene.add(rail); this.lot.push(rail);
    }
  },

  parkBus() {
    if (this.bus || !this.exit) return;
    this.lot = [];
    this.dressLot();
    const bx = this.exit.wx + 11, bz = this.exit.wz + 5.5;
    this.bus = makeBus();
    this.bus.position.set(bx, 0, bz);
    this.bus.rotation.y = Math.PI / 2;
    G.scene.add(this.bus);
    for (let i = -2; i <= 2; i++) G.props.push({ x: bx + i * 3.8, z: bz, r: 3.2 });
    this.busDoor = { x: bx + 7.4, z: bz - 5.0 };
  },

  /* ------------------------------------------------------------- chatter */
  say(text) {
    UI.el('dialogue').classList.remove('hidden');
    UI.el('dlgName').textContent = 'BALDI';
    UI.el('dlgText').textContent = text;
    const b = G.ents.baldi;
    if (b) b.model.say(2.4);
    Audio1.tone(300 + rand(-25, 25), 0.09, 0.05, 'square');
  },

  banner(sub) {
    const s = CAMPAIGN[this.stage];
    UI.el('objTitle').textContent = (this.stage + 1) + '/' + CAMPAIGN.length + '  ' + s.title;
    UI.el('objText').textContent = sub || s.goal;
    UI.el('objBar').classList.remove('hidden');
  },

  nextStage() {
    this.stage++;
    this.clearProps();
    if (this.stage >= CAMPAIGN.length) { this.finish(); return; }
    const s = CAMPAIGN[this.stage];
    if (s.where === 'forest' && this.world !== 'forest') { this.rideBus(); return; }
    this.phase = 'talk'; this.line = 0; this.lineT = 0; this.timer = 0;
    this.banner();
    this.say(s.lines[0]);
    Audio1.tone(660, 0.12, 0.10, 'square');
    this.setup();
  },

  clearProps() {
    if (this.marker) { G.scene.remove(this.marker); this.marker = null; }
    for (const it of this.items) if (it.mesh && !it.taken) G.scene.remove(it.mesh);
    this.items = []; this.target = null;
    G.loadFactor = 1;
  },

  /* =====================================================================
     THE BUS RIDE — school scene out, forest scene in
     ===================================================================== */
  rideBus() {
    this.phase = 'ride'; this.timer = 0;
    UI.el('dialogue').classList.add('hidden');
    UI.el('objBar').classList.add('hidden');
    UI.el('fade').classList.add('on');
    UI.el('fadeText').textContent = '';
    if (document.exitPointerLock) document.exitPointerLock();
    Audio1.busRide();
    setTimeout(() => { if (this.active) UI.el('fadeText').textContent = 'TWO HOURS LATER…'; }, 1500);
    setTimeout(() => { if (this.active) this.enterForest(); }, 3800);
  },

  enterForest() {
    this.world = 'forest';
    this.bus = null; this.lot = []; this.exit = null;

    /* a brand new scene: the school is gone */
    const cast = G.cast.slice();
    for (const e of cast) if (e.model && e.model.root.parent) e.model.root.parent.remove(e.model.root);

    G.scene = new THREE.Scene();
    const dusk = 0x51688f;
    G.scene.background = new THREE.Color(dusk);
    G.scene.fog = new THREE.Fog(dusk, 20, 88);
    G.renderer.setClearColor(dusk);
    G.scene.add(new THREE.AmbientLight(0xdfe6ff, 0.52));
    G.scene.add(new THREE.HemisphereLight(0xffd9a8, 0x1e2c1a, 0.42));
    const moon = new THREE.DirectionalLight(0xcfd9ff, 0.30);
    moon.position.set(-0.5, 1, 0.3); G.scene.add(moon);
    const sun = new THREE.DirectionalLight(0xffb264, 0.34);
    sun.position.set(0.7, 0.24, -0.5); G.scene.add(sun);

    generateForest();
    const built = buildForest(G.scene);
    G.props = built.props;
    this.fire = built.fire;
    this.camp = built.camp;
    this.fuel = 1;
    G.seenCells = new Uint8Array(MW * MH);
    G.nbList = []; G.groundItems = []; G.machines = []; G.gums = []; G.jets = [];

    /* park the bus at the trailhead so the ride reads as real */
    const head = built.head;
    const bus = makeBus();
    bus.position.set(head.x + 12, 0, head.z + 3);
    bus.rotation.y = Math.PI / 2;
    G.scene.add(bus);
    this.bus = bus;
    for (let i = -2; i <= 2; i++) G.props.push({ x: bus.position.x + i * 3.8, z: bus.position.z, r: 3.2 });

    const p = G.player;
    p.x = head.x - 5; p.z = head.z + 4;
    p.yaw = 0; p.pitch = 0;                    // facing up the trail
    p.items = [null, null, null]; refreshSlots();

    for (const e of cast) {
      G.scene.add(e.model.root);
      e.field = makeFlowField();
      e.refreshTimer = 0; e.lastTx = -1; e.lastTy = -1;
      const sp = freeSpotNear(head.x - 7, head.z + 1, 1.0, 16);
      e.x = sp.x; e.z = sp.z;
      e.model.root.position.set(e.x, 0, e.z);
    }

    UI.el('fade').classList.remove('on');
    UI.el('fadeText').textContent = '';
    Audio1.stopAmbient();
    Audio1.forestAmbient(true);
    Audio1.birds();
    this.stage--;                       // re-enter the stage we were heading to
    this.nextStage();
    resumeLock();
  },

  /* --------------------------------------------------- per-stage setup */
  setup() {
    const id = CAMPAIGN[this.stage].id;
    const b = G.ents.baldi;
    if (!b) return;

    if (id === 'bus') {
      this.target = { x: this.busDoor.x, z: this.busDoor.z };
      this.markTarget();
      b.goal = { x: this.busDoor.x - 4.0, z: this.busDoor.z };
      b.mode2 = 'lead';

    } else if (id === 'arrive') {
      this.target = { x: this.camp.x, z: this.camp.z + 7 };
      this.markTarget();
      b.goal = { x: this.camp.x + 4, z: this.camp.z + 5 };
      b.mode2 = 'lead';

    } else if (id === 'wood') {
      this.delivered = 0; this.carry = 0; this.fuel = 0.55;
      this.scatterSticks(11);
      b.goal = { x: this.camp.x + 5, z: this.camp.z + 4 };
      b.mode2 = 'wait';
      b.x = this.camp.x + 5; b.z = this.camp.z + 4;
      b.model.root.position.set(b.x, 0, b.z);
      this.banner('Firewood on the fire: 0/' + this.wantWood);

    } else if (id === 'nature') {
      this.found = 0;
      this.nature = [];
      const spots = shuffle([
        [FOREST.lake.cx + 9, FOREST.lake.cy + 6], [FOREST.glade.cx, FOREST.glade.cy],
        [FOREST.ridge.cx, FOREST.ridge.cy], [9, 40], [40, 30], [14, 33], [34, 46]
      ]);
      NATURE_KINDS.forEach((k, i) => {
        const c = cellCenter(spots[i][0], spots[i][1]);
        const sp = freeSpotNear(c.x, c.z, 1.0, 22);
        const mesh = makeNatureItem(k);
        mesh.position.set(sp.x, 1.1, sp.z);
        G.scene.add(mesh);
        const it = { kind: k, x: sp.x, z: sp.z, mesh: mesh, taken: false };
        this.nature.push(it); this.items.push(it);
      });
      this.hint = 0;
      b.mode2 = 'follow';
      this.banner('Nature treasures 0/4');

    } else if (id === 'hide') {
      const spots = [[FOREST.glade.cx, FOREST.glade.cy], [FOREST.ridge.cx, FOREST.ridge.cy],
                     [FOREST.lake.cx + 8, FOREST.lake.cy + 7], [9, 44], [41, 24], [12, 27]];
      const sp0 = pick(spots);
      const c = cellCenter(sp0[0], sp0[1]);
      const spot = freeSpotNear(c.x, c.z, 1.0, 20);
      b.x = spot.x; b.z = spot.z;
      b.model.root.position.set(b.x, 0, b.z);
      b.mode2 = 'hide';
      this.warmT = 2.0;

    } else if (id === 'marsh') {
      const c = cellCenter(FOREST.lake.cx + 8, FOREST.lake.cy + 6);
      const sp = freeSpotNear(c.x, c.z, 1.0, 22);
      this.bag = makeMarshBag();
      this.bag.position.set(sp.x, 0.8, sp.z);
      G.scene.add(this.bag);
      const it = { kind: 'bag', x: sp.x, z: sp.z, mesh: this.bag, taken: false };
      this.items.push(it);
      this.hasBag = false;
      this.target = { x: sp.x, z: sp.z };
      this.markTarget();
      b.x = this.camp.x + 5; b.z = this.camp.z + 4;
      b.model.root.position.set(b.x, 0, b.z);
      b.mode2 = 'wait';
    }
  },

  scatterSticks(n) {
    for (const s of this.sticks) if (!s.taken && s.mesh) G.scene.remove(s.mesh);
    this.sticks = [];
    let guard = 0;
    while (this.sticks.length < n && guard++ < 2000) {
      const cx = randi(3, MW - 4), cy = randi(3, MH - 4);
      if (Map1.at(cx, cy) === W_WALL) continue;
      const c = cellCenter(cx, cy);
      if (Math.hypot(c.x - this.camp.x, c.z - this.camp.z) < 16) continue;
      const sp = freeSpotNear(c.x, c.z, 1.0, 4);
      if (blockedAt(sp.x, sp.z, 1.0)) continue;
      const mesh = makeStickPile();
      mesh.position.set(sp.x, 0.2, sp.z);
      G.scene.add(mesh);
      const it = { x: sp.x, z: sp.z, mesh: mesh, taken: false };
      this.sticks.push(it); this.items.push(it);
    }
  },

  markTarget() {
    if (this.marker) { G.scene.remove(this.marker); this.marker = null; }
    if (!this.target) return;
    const g = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 16, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x7dff7d, transparent: true, opacity: 0.22,
        side: THREE.DoubleSide, depthWrite: false, fog: false }));
    beam.position.y = 8; g.add(beam);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.14, 8, 22),
      new THREE.MeshBasicMaterial({ color: 0x7dff7d, transparent: true, opacity: 0.75, fog: false }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; g.add(ring);
    g.position.set(this.target.x, 0, this.target.z);
    G.scene.add(g);
    this.marker = g;
  },

  /* ------------------------------------------------------------ per frame */
  update(dt) {
    if (!this.active || !G.running) return;
    this.t += dt;
    if (this.phase === 'ride') return;
    if (G.mode !== 'play') return;
    const p = G.player, b = G.ents.baldi;
    if (!b) return;

    if (this.marker) {
      this.marker.rotation.y += dt * 0.9;
      this.marker.children[1].scale.setScalar(1 + Math.sin(this.t * 3) * 0.12);
    }
    if (this.fire) updateCampfire(this.fire, dt, this.fuel);
    for (const it of this.items) {
      if (it.taken || !it.mesh) continue;
      it.mesh.rotation.y += dt * 1.0;
    }

    if (this.phase === 'wait') { this.timer -= dt; if (this.timer <= 0) this.done(this.waitMsg); return; }
    if (this.phase === 'done') { this.timer -= dt; if (this.timer <= 0) this.nextStage(); return; }

    if (this.phase === 'talk') {
      this.lineT += dt;
      if (this.lineT > 3.1) {
        this.lineT = 0; this.line++;
        const ls = CAMPAIGN[this.stage].lines;
        if (this.line < ls.length) this.say(ls[this.line]);
        else {
          UI.el('dialogue').classList.add('hidden');
          this.phase = 'run';
          const id = CAMPAIGN[this.stage].id;
          if (id === 'hide') UI.say('Go and find him — he will shout hints.', 3000);
          if (id === 'wood') UI.say('Walk over a stick pile to pick it up.', 3200);
        }
      }
      return;
    }
    if (this.phase !== 'run') return;

    const id = CAMPAIGN[this.stage].id;

    if (id === 'bus') {
      if (this.target && Math.hypot(p.x - this.target.x, p.z - this.target.z) < 5.0) {
        this.beat('Climb aboard! Mind the step.', 2.0);
      }

    } else if (id === 'arrive') {
      if (Math.hypot(p.x - this.camp.x, p.z - this.camp.z) < 9) {
        this.done('This is the spot. Home for the night!');
      }

    } else if (id === 'wood') {
      this.woodTick(dt);

    } else if (id === 'nature') {
      for (const it of this.nature) {
        if (it.taken) continue;
        it.mesh.position.y = 1.1 + Math.sin(this.t * 2.4 + it.x) * 0.14;
        if (Math.hypot(it.x - p.x, it.z - p.z) < 2.8) {
          it.taken = true; G.scene.remove(it.mesh); this.found++;
          Audio1.pickup();
          UI.say('Found the ' + NATURE_NAMES[it.kind] + '!  (' + this.found + '/4)', 2400);
          this.banner('Nature treasures ' + this.found + '/4');
        }
      }
      this.hint -= dt;
      if (this.hint <= 0 && this.found < 4) {
        this.hint = 9;
        const left = this.nature.filter(i => !i.taken);
        if (left.length) {
          const it = left[0];
          const d = Math.hypot(it.x - p.x, it.z - p.z);
          UI.say('Baldi: "' + (d < 25 ? 'One of them is close by!' :
            it.x < MW * CS / 2 ? 'Try over towards the lake.' : 'Try the far side of the woods.') + '"', 3000);
        }
      }
      if (this.found >= 4) this.done('Four out of four. You have a naturalist\'s eye!');

    } else if (id === 'hide') {
      const d = distToPlayer(b.x, b.z);
      this.warmT -= dt;
      if (this.warmT <= 0) {
        this.warmT = 3.6;
        UI.say(d < 14 ? 'Baldi: "You are BOILING hot!"'
             : d < 32 ? 'Baldi: "Getting warmer…"'
             : d < 62 ? 'Baldi: "Cold. Very cold."'
                      : 'Baldi: "Freezing! Try somewhere else!"', 2800);
      }
      if (d < 5.0) this.done('You found me! I am hopeless at this.');

    } else if (id === 'marsh') {
      const bag = this.items[0];
      if (!this.hasBag) {
        if (bag && !bag.taken) {
          bag.mesh.position.y = 0.8 + Math.sin(this.t * 2.2) * 0.12;
          if (Math.hypot(bag.x - p.x, bag.z - p.z) < 3.0) {
            bag.taken = true; G.scene.remove(bag.mesh);
            this.hasBag = true; Audio1.pickup();
            UI.say('Got the marshmallows! Back to the fire.', 2600);
            this.target = { x: this.camp.x, z: this.camp.z + 5 };
            this.markTarget();
            this.banner('Take the marshmallows back to the campfire');
          }
        }
      } else if (Math.hypot(p.x - this.camp.x, p.z - this.camp.z) < 8) {
        this.done('MARSHMALLOWS! Sit down, this is the best bit.');
      }
    }
  },

  /* ------------------------------------------------------ firewood stage */
  woodTick(dt) {
    const p = G.player;
    this.fuel = clamp(this.fuel - dt * 0.030, 0, 1);

    for (const s of this.sticks) {
      if (s.taken) continue;
      s.mesh.position.y = 0.2 + Math.sin(this.t * 2 + s.x) * 0.06;
      if (this.carry < 5 && Math.hypot(s.x - p.x, s.z - p.z) < 2.6) {
        s.taken = true; G.scene.remove(s.mesh);
        this.carry++;
        Audio1.tone(220 + this.carry * 40, 0.10, 0.13, 'square');
        UI.say('Picked up a stick. Carrying ' + this.carry + '/5.', 1700);
      }
    }
    G.loadFactor = clamp(1 - this.carry * 0.085, 0.55, 1);
    UI.el('nbCount').innerHTML = this.carry + '/5<small>STICKS</small>';

    /* drop everything on the fire */
    if (this.carry > 0 && Math.hypot(p.x - this.camp.x, p.z - this.camp.z) < 6.5) {
      this.delivered += this.carry;
      this.fuel = clamp(this.fuel + this.carry * 0.16, 0, 1);
      Audio1.correct();
      UI.say('Threw ' + this.carry + ' on the fire! (' + Math.min(this.delivered, this.wantWood) +
             '/' + this.wantWood + ')', 2600);
      this.carry = 0; G.loadFactor = 1;
      this.banner('Firewood on the fire: ' + Math.min(this.delivered, this.wantWood) + '/' + this.wantWood);
    }

    if (this.fuel <= 0.02 && !this.coldSaid) {
      this.coldSaid = true;
      UI.say('Baldi: "Oh no, it went out! Quick, a few more sticks!"', 3400);
    }
    if (this.fuel > 0.2) this.coldSaid = false;

    const left = this.sticks.filter(s => !s.taken).length;
    if (left < 3 && this.delivered < this.wantWood) this.scatterSticks(8);

    if (this.delivered >= this.wantWood) {
      G.loadFactor = 1;
      this.fuel = 1;
      UI.el('nbCount').innerHTML = '';
      this.done('Look at it GO! That is a proper campfire.');
    }
  },

  /* a short beat before the stage closes */
  beat(msg, secs) {
    if (this.phase === 'wait' || this.phase === 'done') return;
    this.phase = 'wait'; this.timer = secs; this.waitMsg = msg;
    UI.say(msg, secs * 1000);
  },

  done(msg) {
    if (this.phase === 'done') return;
    this.phase = 'done';
    UI.say(msg, 3200);
    Audio1.correct();
    this.timer = 2.8;
  },

  finish() {
    this.active = false;
    this.clearProps();
    Audio1.forestAmbient(false);
    for (const m of (this.lot || [])) G.scene.remove(m);
    this.lot = [];
    G.friendlyBaldi = false; G.loadFactor = 1;
    UI.el('objBar').classList.add('hidden');
    UI.el('dialogue').classList.add('hidden');
    G.running = false; G.mode = 'win';
    Audio1.stopAmbient(); Music.stop(true); Audio1.winFanfare();
    if (document.exitPointerLock) document.exitPointerLock();
    UI.el('hud').classList.add('hidden');
    UI.el('win').querySelector('h2').textContent = 'FIELD TRIP COMPLETE!';
    UI.el('winSub').innerHTML =
      'You and Baldi sit by the fire and toast the whole bag.<br>' +
      '<b>"Best field trip I have ever run. And I have run three."</b><br>' +
      'No detention, no ruler, and he kept the hat on the entire time.';
    UI.el('win').classList.remove('hidden');
  }
};

/* =========================================================================
   Friendly Baldi — he walks like a person, never sours, never catches you.
   ========================================================================= */
function campaignBaldi(e, dt) {
  const m = e.model, p = G.player;
  const pos = new THREE.Vector3(p.x, 4.0, p.z);
  m.setMood(0); m.mood = 0; m.moodTarget = 0;
  e.anger = 0; e.stun = 0; e.shove = null;

  let speed = 0;
  const mode = e.mode2 || 'follow';

  if (mode === 'follow') {
    const d = distToPlayer(e.x, e.z);
    if (d > 8) speed = stepAgent(e, p.x, p.z, 7.6, dt, 0.85);
    else if (d > 5) speed = stepAgent(e, p.x, p.z, 4.4, dt, 0.85);
  } else if (mode === 'lead') {
    /* walks ahead to the goal but stops and waits rather than doubling back */
    const g = e.goal || { x: p.x, z: p.z };
    const dg = Math.hypot(e.x - g.x, e.z - g.z);
    if (distToPlayer(e.x, e.z) < 17 && dg > 2.5) {
      speed = stepAgent(e, g.x, g.z, 6.6, dt, 0.85);
    }
  } else if (mode === 'race') {
    const g = e.goal;
    if (g && Math.hypot(e.x - g.x, e.z - g.z) > 2.5) speed = stepAgent(e, g.x, g.z, 9.4, dt, 0.85);
  }

  place(e);
  if (speed > 0.1) m.root.rotation.y = e.heading;
  else {
    m.root.rotation.y = angLerp(m.root.rotation.y,
      Math.atan2(p.x - e.x, p.z - e.z), 1 - Math.exp(-dt * 4));
  }
  m.update(dt, { speed: speed, anger: 0, lookAt: pos });
}


/* =========================================================================
   Part 5c — THE WOODS
   A whole second world for the field trip: a pine forest at dusk with a lake,
   a trail, mountains on the skyline and a campsite with a real fire.
   Nothing in here is used by the school chapters.
   ========================================================================= */

/* ------------------------------------------------- Baldi's camping outfit */
function cowTexture() {
  const S = 128, { c, x } = cv(S, S);
  x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, S, S);
  x.fillStyle = '#1d1b19';
  const blobs = [[22, 26, 20], [78, 18, 15], [104, 62, 18], [40, 74, 22],
                 [10, 96, 14], [70, 104, 17], [96, 106, 11], [56, 40, 12]];
  for (const [bx, by, r] of blobs) {
    x.beginPath();
    for (let a = 0; a < 14; a++) {
      const ang = (a / 14) * Math.PI * 2;
      const rr = r * (0.62 + ((a * 37) % 11) / 16);
      const px = bx + Math.cos(ang) * rr, py = by + Math.sin(ang) * rr * 0.85;
      a ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath(); x.fill();
  }
  return texFrom(c, 2, 1);
}
let COWTEX = null;

/* A wide floppy cow-print hat — the one he wears on the field trip.
   Built with the brim at y = 0 so it can just be dropped onto the skull. */
function makeCowHat() {
  const g = new THREE.Group();
  if (!COWTEX) COWTEX = cowTexture();
  const cowMat = new THREE.MeshLambertMaterial({ map: COWTEX });
  const bandMat = new THREE.MeshLambertMaterial({ color: 0x7a4a22 });

  const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.76, 1.76, 0.13, 20), cowMat);
  g.add(brim);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(1.74, 0.10, 6, 22), cowMat);
  lip.rotation.x = Math.PI / 2; g.add(lip);

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.90, 1.12, 0.86, 18), cowMat);
  crown.position.y = 0.50; g.add(crown);
  const top = sph(0.90, cowMat, 1.0, 0.52, 1.0, 16);
  top.position.y = 0.93; g.add(top);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.16, 1.16, 0.22, 18), bandMat);
  band.position.y = 0.16; g.add(band);
  /* a little feather in the band, because it is a field trip */
  const feather = box(0.08, 0.86, 0.24, new THREE.MeshLambertMaterial({ color: 0xd94f3d }));
  feather.position.set(0.86, 0.62, 0.62); feather.rotation.z = -0.34; feather.rotation.x = -0.22;
  g.add(feather);
  return g;
}

/* A camping pack for his back — tan canvas so it reads against the shirt. */
function makeCampPack() {
  const g = new THREE.Group();
  const canvasM = new THREE.MeshLambertMaterial({ color: 0xa87a44 });
  const strapM = new THREE.MeshLambertMaterial({ color: 0x5a3d1e });
  const body = capsuleBox(1.26, 1.55, 0.70, canvasM);
  body.position.set(0, 1.55, -0.88); g.add(body);
  const lid = box(1.30, 0.34, 0.74, strapM);
  lid.position.set(0, 2.30, -0.88); g.add(lid);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.45, 10),
    new THREE.MeshLambertMaterial({ color: 0xc9563a }));
  roll.rotation.z = Math.PI / 2; roll.position.set(0, 0.82, -1.06); g.add(roll);
  for (const s of [-1, 1]) {
    const strap = box(0.19, 1.5, 0.15, strapM);
    strap.position.set(s * 0.50, 1.62, -0.42); g.add(strap);
  }
  const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.1, 12),
    new THREE.MeshLambertMaterial({ color: 0x9aa3ad }));
  pan.position.set(0.70, 1.95, -1.26); pan.rotation.x = Math.PI / 2; g.add(pan);
  return g;
}

/* Put the outfit on (or take it off again). */
function dressForCamp(model, on) {
  if (on) {
    if (!model.__hat) {
      model.__hat = makeCowHat();
      model.__hat.position.y = 0.56;
      model.head.add(model.__hat);
      model.__pack = makeCampPack();
      model.torso.add(model.__pack);
    }
    model.__hat.visible = true; model.__pack.visible = true;
  } else if (model.__hat) {
    model.__hat.visible = false; model.__pack.visible = false;
  }
}

/* =========================================================================
   Forest layout
   ========================================================================= */
const FOREST = {
  camp:  { cx: 24, cy: 25, r: 5.6 },        // the clearing with the fire
  head:  { cx: 24, cy: 48 },                // where the bus drops you off
  lake:  { cx: 11, cy: 13, rx: 7.5, ry: 5.2 },
  trail: [[24, 49], [24, 44], [26, 40], [25, 35], [24, 30], [24, 26]],
  glade: { cx: 38, cy: 40, r: 3.4 },        // a quiet spot for hide and seek
  ridge: { cx: 38, cy: 12, r: 3.8 }         // a lookout at the top of the map
};

function forestDistToTrail(x, y) {
  let best = 1e9;
  const T = FOREST.trail;
  for (let i = 0; i < T.length - 1; i++) {
    const ax = T[i][0], ay = T[i][1], bx = T[i + 1][0], by = T[i + 1][1];
    const vx = bx - ax, vy = by - ay;
    const t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
    best = Math.min(best, Math.hypot(x - (ax + vx * t), y - (ay + vy * t)));
  }
  return best;
}
function inLake(x, y) {
  const L = FOREST.lake;
  const dx = (x - L.cx) / L.rx, dy = (y - L.cy) / L.ry;
  return dx * dx + dy * dy <= 1;
}
function inCircle(x, y, c) { return Math.hypot(x - c.cx, y - c.cy) <= c.r; }

/* Fill the grid: open forest floor, blocked cells for thickets and water. */
function generateForest() {
  const M = Map1;
  M.g.fill(W_GRASS); M.zone.fill(1); M.gate.fill(0);
  M.rooms = []; M.doors = []; M.exits = []; M.gates = [];
  M.unlocked = 5;
  const water = new Uint8Array(MW * MH), tree = new Uint8Array(MW * MH);

  const clear = (x, y) =>
    forestDistToTrail(x, y) < 2.1 ||
    inCircle(x, y, FOREST.camp) ||
    inCircle(x, y, FOREST.glade) ||
    inCircle(x, y, FOREST.ridge) ||
    Math.hypot(x - FOREST.head.cx, y - FOREST.head.cy) < 4.5;

  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = y * MW + x;
    if (inLake(x, y)) { M.g[i] = W_WALL; water[i] = 1; continue; }
    if (x < 2 || y < 2 || x >= MW - 2 || y >= MH - 2) { M.g[i] = W_WALL; tree[i] = 2; continue; }
    if (clear(x, y)) continue;
    /* thicker woods away from the trail, thinner near it */
    const d = forestDistToTrail(x, y);
    const p = clamp(0.06 + d * 0.035, 0.06, 0.30);
    if (Math.random() < p) { M.g[i] = W_WALL; tree[i] = 1; }
  }

  /* nothing may be stranded: flood from the trailhead and wall off islands */
  const seen = new Uint8Array(MW * MH), q = [];
  const s = FOREST.head.cy * MW + FOREST.head.cx;
  seen[s] = 1; q.push(s);
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % MW, y = (i / MW) | 0;
    const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of nb) {
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      const j = ny * MW + nx;
      if (seen[j] || M.g[j] === W_WALL) continue;
      seen[j] = 1; q.push(j);
    }
  }
  for (let i = 0; i < MW * MH; i++) {
    if (M.g[i] !== W_WALL && !seen[i]) { M.g[i] = W_WALL; tree[i] = 1; }
  }
  M.forest = { water: water, tree: tree, open: q.length };
  return M.forest;
}

/* ------------------------------------------------------------ the skyline */
function makeSkyDome() {
  const W = 512, H = 256, { c, x } = cv(W, H);
  /* v = 0 is straight up, v = 0.5 is the horizon */
  const grad = x.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0.00, '#152447');
  grad.addColorStop(0.26, '#25396d');
  grad.addColorStop(0.40, '#3f5686');
  grad.addColorStop(0.49, '#51688f');
  grad.addColorStop(0.52, '#51688f');               // exactly the fog colour
  grad.addColorStop(0.62, '#33405a');
  grad.addColorStop(1.00, '#1d2a1c');
  x.fillStyle = grad; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 230; i++) {                    // stars, thicker up high
    const sy = Math.pow(Math.random(), 2.1) * H * 0.42;
    x.fillStyle = 'rgba(255,255,255,' + (0.35 + Math.random() * 0.6).toFixed(2) + ')';
    x.fillRect(Math.random() * W, sy, 2, 2);
  }
  /* the last of the sun, low on one side */
  const sun = x.createRadialGradient(370, 128, 4, 370, 128, 120);
  sun.addColorStop(0, 'rgba(255,206,138,.85)');
  sun.addColorStop(0.35, 'rgba(226,140,80,.42)');
  sun.addColorStop(1, 'rgba(226,140,80,0)');
  x.fillStyle = sun; x.fillRect(240, 40, 270, 130);
  x.fillStyle = '#fdf6e0';                           // and the moon opposite
  x.beginPath(); x.arc(96, 44, 20, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(210,200,175,.5)';
  x.beginPath(); x.arc(89, 38, 5, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(103, 52, 7, 0, Math.PI * 2); x.fill();
  const t = texFrom(c, 1, 1);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(430, 20, 12),
    new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false }));
  dome.position.set(MW * CS / 2, -40, MH * CS / 2);
  return dome;
}

function makeMountains() {
  const g = new THREE.Group();
  const rock = new THREE.MeshLambertMaterial({ color: 0x2f3d55, fog: false });
  const snow = new THREE.MeshLambertMaterial({ color: 0xdfe8f5, fog: false });
  const cx = MW * CS / 2, cz = MH * CS / 2;
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU + rnd() * 0.16;
    const dist = 300 + rnd() * 70;
    const h = 60 + rnd() * 80, r = 40 + rnd() * 34;
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), rock);
    m.position.set(cx + Math.sin(a) * dist, h / 2 - 12, cz + Math.cos(a) * dist);
    m.rotation.y = rnd() * 3; g.add(m);
    if (h > 96) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.34, h * 0.30, 5), snow);
      cap.position.set(m.position.x, h - 12 - h * 0.15, m.position.z);
      cap.rotation.y = m.rotation.y; g.add(cap);
    }
  }
  return g;
}

/* ------------------------------------------------------------- the ground */
function forestGroundTexture() {
  const PX = 8, W = MW * PX, H = MH * PX, { c, x } = cv(W, H);
  x.fillStyle = '#3d6b34'; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 14000; k++) {
    const g = Math.random();
    x.fillStyle = g < .33 ? '#457a3a' : g < .66 ? '#356029' : '#2c5424';
    x.fillRect(Math.random() * W, Math.random() * H, 3, 3);
  }
  /* the trail, painted straight into the ground */
  x.strokeStyle = '#8a6b42'; x.lineWidth = 3.1 * PX; x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath();
  FOREST.trail.forEach((p, i) => {
    const px = (p[0] + 0.5) * PX, py = (p[1] + 0.5) * PX;
    i ? x.lineTo(px, py) : x.moveTo(px, py);
  });
  x.stroke();
  x.strokeStyle = '#9a7b50'; x.lineWidth = 1.7 * PX; x.stroke();

  /* the clearing */
  const drawDirt = (cc, col) => {
    x.fillStyle = col;
    x.beginPath();
    x.arc((cc.cx + 0.5) * PX, (cc.cy + 0.5) * PX, cc.r * PX, 0, Math.PI * 2);
    x.fill();
  };
  drawDirt(FOREST.camp, '#8a6b42');
  drawDirt({ cx: FOREST.camp.cx, cy: FOREST.camp.cy, r: FOREST.camp.r * 0.6 }, '#9a7b50');
  drawDirt({ cx: FOREST.head.cx, cy: FOREST.head.cy, r: 4.2 }, '#7d705c');

  for (let k = 0; k < 2600; k++) {                   // scatter of grit + leaves
    const g = Math.random();
    x.fillStyle = g < .5 ? 'rgba(0,0,0,.10)' : g < .8 ? '#6d5a3a' : '#a8894f';
    x.fillRect(Math.random() * W, Math.random() * H, 3, 3);
  }
  return texFrom(c, 1, 1);
}

/* ------------------------------------------------------------ the campfire */
function makeCampfire() {
  const g = new THREE.Group();
  const stoneM = new THREE.MeshLambertMaterial({ color: 0x8d8f92 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const s = sph(0.5 + Math.random() * 0.22, stoneM, 1.2, 0.8, 1.0, 7);
    s.position.set(Math.sin(a) * 2.5, 0.3, Math.cos(a) * 2.5);
    s.rotation.y = Math.random() * 3; g.add(s);
  }
  const logM = new THREE.MeshLambertMaterial({ color: 0x6b4b28 });
  const logs = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.26, 2.6, 7), logM);
    l.position.set(Math.sin(a) * 0.6, 1.1, Math.cos(a) * 0.6);
    l.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
    logs.add(l);
  }
  g.add(logs);

  const flame = new THREE.Group();
  const cols = [0xffd24a, 0xff8a1e, 0xe8451c];
  const cones = [];
  cols.forEach((col, i) => {
    const f = new THREE.Mesh(new THREE.ConeGeometry(1.15 - i * 0.28, 3.0 - i * 0.5, 7),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.86 - i * 0.12,
        depthWrite: false, fog: false }));
    f.position.y = 1.5 + i * 0.35; flame.add(f); cones.push(f);
  });
  g.add(flame);

  const light = new THREE.PointLight(0xffb14a, 1.4, 46, 1.6);
  light.position.y = 2.4; g.add(light);

  const smoke = [];
  for (let i = 0; i < 5; i++) {
    const s = sph(0.55, new THREE.MeshBasicMaterial({ color: 0x9aa0a6, transparent: true,
      opacity: 0.18, depthWrite: false, fog: false }), 1, 1, 1, 7);
    s.position.set(0, 3.4 + i * 1.5, 0); g.add(s); smoke.push(s);
  }

  g.userData = { flame: flame, cones: cones, light: light, smoke: smoke, logs: logs, t: 0, size: 1 };
  return g;
}

/* size 0..1 drives how big and bright the fire is */
function updateCampfire(fire, dt, size) {
  const u = fire.userData;
  u.t += dt;
  u.size += (size - u.size) * (1 - Math.exp(-dt * 2.2));
  const s = clamp(u.size, 0, 1);
  const flick = 0.86 + Math.sin(u.t * 17) * 0.07 + Math.sin(u.t * 29.3) * 0.05;
  u.flame.scale.set((0.4 + s * 0.9) * flick, (0.35 + s * 1.25) * flick, (0.4 + s * 0.9) * flick);
  u.flame.rotation.y = u.t * 1.6;
  u.flame.visible = s > 0.02;
  u.light.intensity = (0.15 + s * 1.7) * flick;
  u.light.distance = 20 + s * 46;
  u.cones.forEach((c, i) => { c.material.opacity = (0.86 - i * 0.12) * clamp(s * 1.6, 0, 1); });
  u.smoke.forEach((m, i) => {
    const t = (u.t * 0.5 + i * 0.2) % 1;
    m.position.y = 3.4 + t * 7;
    m.position.x = Math.sin(u.t * 0.7 + i) * (0.5 + t * 1.6);
    m.scale.setScalar(0.6 + t * 1.9);
    m.material.opacity = 0.2 * (1 - t) * clamp(s * 1.4, 0, 1);
  });
  u.logs.children.forEach(l => { l.material.color.setHex(s > 0.35 ? 0x7a3c1c : 0x4a3320); });
}

/* ---------------------------------------------------------------- props */
function makeTent(col) {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: col });
  const dark = new THREE.MeshLambertMaterial({ color: 0x241f1a });
  /* a cube stood on its edge is a perfectly good A-frame */
  const body = box(3.9, 3.9, 6.6, m);
  body.rotation.z = Math.PI / 4;
  body.position.y = 0;                       // lower half sits below ground
  g.add(body);
  const door = box(0.12, 2.0, 2.0, dark);
  door.rotation.x = Math.PI / 4;
  door.position.set(0, 0.95, 3.34); g.add(door);
  const ridge = box(0.24, 0.24, 7.4, dark);
  ridge.position.y = 2.72; g.add(ridge);
  for (const s of [-1, 1]) {                 // guy ropes and pegs
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.4, 4), dark);
    rope.position.set(0, 1.4, s * 4.6); rope.rotation.x = s * 0.85; g.add(rope);
  }
  return g;
}
function makeLogBench() {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: 0x7a5a34 });
  const l = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.78, 5.4, 9), m);
  l.rotation.z = Math.PI / 2; l.position.y = 0.8; g.add(l);
  for (const s of [-1, 1]) {
    const leg = box(0.5, 0.9, 1.3, new THREE.MeshLambertMaterial({ color: 0x5c421f }));
    leg.position.set(s * 1.9, 0.45, 0); g.add(leg);
  }
  return g;
}
function makeStickPile() {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: 0x8b6534 });
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.13, 1.9, 6), m);
    s.rotation.set(Math.PI / 2, 0, (i / 4) * Math.PI);
    s.position.set(rand(-0.25, 0.25), 0.15 + i * 0.14, rand(-0.25, 0.25));
    g.add(s);
  }
  return g;
}
function makeMarshBag() {
  const g = new THREE.Group();
  const bag = box(1.0, 1.25, 0.55, new THREE.MeshLambertMaterial({ color: 0xf3f1ee }));
  bag.position.y = 0.62; g.add(bag);
  const band = box(1.04, 0.34, 0.58, new THREE.MeshLambertMaterial({ color: 0xff7fb0 }));
  band.position.y = 0.72; g.add(band);
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.34, 10),
      new THREE.MeshLambertMaterial({ color: 0xfff8f2 }));
    p.position.set(rand(-0.4, 0.4), 1.4 + i * 0.12, rand(-0.2, 0.2));
    p.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3)); g.add(p);
  }
  return g;
}
function makeNatureItem(kind) {
  const g = new THREE.Group();
  if (kind === 'pinecone') {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.05, 8),
      new THREE.MeshLambertMaterial({ color: 0x6b4a26 }));
    c.rotation.x = Math.PI; c.position.y = 0.5; g.add(c);
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.34 - i * 0.07, 0.09, 5, 9),
        new THREE.MeshLambertMaterial({ color: 0x87602f }));
      r.rotation.x = Math.PI / 2; r.position.y = 0.25 + i * 0.3; g.add(r);
    }
  } else if (kind === 'feather') {
    const q = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 1.5, 5),
      new THREE.MeshLambertMaterial({ color: 0xe8e2d4 }));
    q.position.y = 0.75; q.rotation.z = 0.2; g.add(q);
    const v = box(0.42, 1.0, 0.05, new THREE.MeshLambertMaterial({ color: 0x5aa0d8 }));
    v.position.set(0.05, 0.9, 0); v.rotation.z = 0.2; g.add(v);
  } else if (kind === 'mushroom') {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.26, 0.8, 8),
      new THREE.MeshLambertMaterial({ color: 0xf2ead6 }));
    st.position.y = 0.4; g.add(st);
    const cap = sph(0.62, new THREE.MeshLambertMaterial({ color: 0xd6402f }), 1, 0.6, 1, 12);
    cap.position.y = 0.86; g.add(cap);
    for (let i = 0; i < 5; i++) {
      const d = sph(0.11, new THREE.MeshLambertMaterial({ color: 0xfff6ea }), 1, 0.5, 1, 6);
      const a = (i / 5) * TAU;
      d.position.set(Math.sin(a) * 0.34, 1.03, Math.cos(a) * 0.34); g.add(d);
    }
  } else {                                     // a bright red leaf
    const l = box(0.9, 0.06, 0.62, new THREE.MeshLambertMaterial({ color: 0xd4682a }));
    l.position.y = 0.5; l.rotation.z = 0.25; g.add(l);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 5),
      new THREE.MeshLambertMaterial({ color: 0x6b4a26 }));
    st.rotation.z = Math.PI / 2; st.position.set(-0.6, 0.46, 0); g.add(st);
  }
  return g;
}
function makeRoastStick() {
  const g = new THREE.Group();
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.10, 2.6, 6),
    new THREE.MeshLambertMaterial({ color: 0x8b6534 }));
  s.rotation.z = Math.PI / 2.4; s.position.y = 0.7; g.add(s);
  const m = sph(0.26, new THREE.MeshLambertMaterial({ color: 0xfff8f2 }), 1, 1.2, 1, 10);
  m.position.set(1.05, 1.25, 0); g.add(m);
  return g;
}

/* =========================================================================
   Build the whole forest into a scene
   ========================================================================= */
function buildForest(scene) {
  const M = Map1, F = M.forest;
  const group = new THREE.Group();
  const props = [];

  scene.add(makeSkyDome());
  group.add(makeMountains());

  /* ground */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MW * CS, MH * CS),
    new THREE.MeshLambertMaterial({ map: forestGroundTexture() }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(MW * CS / 2, 0, MH * CS / 2);
  group.add(ground);


  /* ---- the lake ---- */
  const wk = cv(64, 64);
  wk.x.fillStyle = '#2d5f86'; wk.x.fillRect(0, 0, 64, 64);
  for (let k = 0; k < 420; k++) {
    wk.x.fillStyle = Math.random() < .5 ? '#3a76a3' : '#24506f';
    wk.x.fillRect(Math.random() * 64, Math.random() * 64, 4, 2);
  }
  const waterTex = texFrom(wk.c, 8, 8);
  const L = FOREST.lake;
  const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 30),
    new THREE.MeshLambertMaterial({ map: waterTex }));
  lake.rotation.x = -Math.PI / 2;
  lake.scale.set((L.rx + 0.6) * CS, (L.ry + 0.6) * CS, 1);
  lake.position.set((L.cx + 0.5) * CS, 0.10, (L.cy + 0.5) * CS);
  group.add(lake);
  const glint = new THREE.Mesh(new THREE.CircleGeometry(1, 30),
    new THREE.MeshBasicMaterial({ color: 0x9fd8f2, transparent: true, opacity: 0.16, depthWrite: false }));
  glint.rotation.x = -Math.PI / 2;
  glint.scale.set((L.rx + 0.2) * CS, (L.ry + 0.2) * CS, 1);
  glint.position.set((L.cx + 0.5) * CS, 0.16, (L.cy + 0.5) * CS);
  group.add(glint);

  /* ---- trees ----
     Instanced, and split into map chunks so the renderer can throw away the
     ones behind you. One un-chunked instanced mesh would have to rasterise
     every tree in the forest on every single frame. */
  const CH = 6;                                    // chunk size in cells
  const CX = Math.ceil(MW / CH), CY = Math.ceil(MH / CH);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x53381e });
  const pineMat  = new THREE.MeshLambertMaterial({ color: 0x1f4f2a });
  const leafMat  = new THREE.MeshLambertMaterial({ color: 0x3f7a2e });
  const bushMat  = new THREE.MeshLambertMaterial({ color: 0x2c5c26 });

  const chunks = [];
  for (let i = 0; i < CX * CY; i++) chunks.push({ trunks: [], cones: [], blobs: [], bushes: [] });
  const chunkOf = (cx, cy) => chunks[((cy / CH) | 0) * CX + ((cx / CH) | 0)];

  const D = new THREE.Object3D();
  const push = (arr, x, y, z, sx, sy, sz, ry) => {
    D.position.set(x, y, z); D.scale.set(sx, sy, sz);
    D.rotation.set(0, ry || 0, 0); D.updateMatrix();
    arr.push(D.matrix.clone());
  };

  for (let cy = 0; cy < MH; cy++) for (let cx = 0; cx < MW; cx++) {
    const i = cy * MW + cx;
    if (M.g[i] !== W_WALL || F.water[i]) continue;
    const K = chunkOf(cx, cy);
    const edge = F.tree[i] === 2;
    const n = edge ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const wx = cx * CS + rand(0.9, CS - 0.9), wz = cy * CS + rand(0.9, CS - 0.9);
      const tall = edge ? rand(12, 18) : rand(8, 15);
      const pine = Math.random() < 0.68;
      push(K.trunks, wx, 0, wz, rand(0.85, 1.3), tall * (pine ? 0.44 : 0.58), rand(0.85, 1.3));
      if (pine) {
        for (let t = 0; t < 2; t++) {
          const w = (2.9 - t * 0.85) * rand(0.9, 1.1);
          push(K.cones, wx, tall * (0.24 + t * 0.28), wz, w, tall * 0.48, w, rand(0, 3));
        }
      } else {
        const r = rand(2.6, 3.8);
        push(K.blobs, wx, tall * 0.66, wz, r, r * rand(0.8, 1.1), r, rand(0, 3));
      }
    }
    if (Math.random() < 0.34) {
      const bx = cx * CS + rand(0.7, CS - 0.7), bz = cy * CS + rand(0.7, CS - 0.7);
      const r = rand(1.0, 1.8);
      push(K.bushes, bx, r * 0.5, bz, r, r * 0.75, r, rand(0, 3));
    }
  }
  /* a scatter of bushes out on the open floor too */
  for (let k = 0; k < 140; k++) {
    const cx = randi(3, MW - 4), cy = randi(3, MH - 4), i = cy * MW + cx;
    if (M.g[i] === W_WALL) continue;
    if (inCircle(cx, cy, FOREST.camp) || forestDistToTrail(cx, cy) < 1.6) continue;
    const bx = cx * CS + rand(0.8, CS - 0.8), bz = cy * CS + rand(0.8, CS - 0.8);
    const r = rand(0.55, 1.2);
    push(chunkOf(cx, cy).bushes, bx, r * 0.5, bz, r, r * 0.8, r, rand(0, 3));
  }

  /* Each chunk gets its own low-poly geometry so we can hand the renderer a
     bounding sphere that actually covers that chunk's trees. */
  /* Deliberately chunky primitives — 4-sided trunks, pyramid pines and
     octahedron foliage. It suits the art style AND keeps the triangle count
     low enough that a whole forest is cheaper than one school corridor. */
  const CHW = CH * CS, chunkR = Math.hypot(CHW, CHW) * 0.5 + 20;
  const mkGeo = {
    trunks: () => { const g = new THREE.CylinderGeometry(0.32, 0.50, 1, 4, 1, true); g.translate(0, 0.5, 0); return g; },
    cones:  () => { const g = new THREE.ConeGeometry(1, 1, 4); g.translate(0, 0.5, 0); return g; },
    blobs:  () => new THREE.OctahedronGeometry(1, 0),
    bushes: () => new THREE.OctahedronGeometry(1, 0)
  };
  const mats = { trunks: trunkMat, cones: pineMat, blobs: leafMat, bushes: bushMat };

  const lod = [];
  chunks.forEach((K, ci) => {
    const gx = (ci % CX) * CHW + CHW / 2, gz = ((ci / CX) | 0) * CHW + CHW / 2;
    const meshes = [];
    for (const key of ['trunks', 'cones', 'blobs', 'bushes']) {
      const list = K[key];
      if (!list.length) continue;
      const geo = mkGeo[key]();
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(gx, 10, gz), chunkR);
      const im = new THREE.InstancedMesh(geo, mats[key], list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = true;
      group.add(im); meshes.push(im);
    }
    if (meshes.length) lod.push({ x: gx, z: gz, m: meshes });
  });
  Map1.forestLOD = lod;
  Map1.forestLODr = chunkR;

  /* ---- the campsite ---- */
  const camp = cellCenter(FOREST.camp.cx, FOREST.camp.cy);
  const fire = makeCampfire();
  fire.position.set(camp.x, 0, camp.z);
  group.add(fire);
  props.push({ x: camp.x, z: camp.z, r: 2.4 });

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.5;
    const b = makeLogBench();
    b.position.set(camp.x + Math.sin(a) * 6.4, 0, camp.z + Math.cos(a) * 6.4);
    b.rotation.y = -a;
    group.add(b);
    props.push({ x: b.position.x, z: b.position.z, r: 1.6 });
  }
  const tents = [[0xc4562f, -1], [0x2f6fb0, 1]];
  tents.forEach(([col, s], i) => {
    const t = makeTent(col);
    t.position.set(camp.x + s * 11.5, 0, camp.z - 6.5 + i * 1.5);
    t.rotation.y = -s * 0.5;
    group.add(t);
    props.push({ x: t.position.x, z: t.position.z, r: 2.9 });
  });
  /* a sign at the trailhead */
  const sc = cv(128, 40);
  sc.x.fillStyle = '#7a5a30'; sc.x.fillRect(0, 0, 128, 40);
  sc.x.fillStyle = '#f6e6c0'; sc.x.font = 'bold 18px Arial'; sc.x.textAlign = 'center';
  sc.x.fillText('CAMP HERE', 64, 26);
  const head = cellCenter(FOREST.head.cx, FOREST.head.cy);
  const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5, 6),
    new THREE.MeshLambertMaterial({ color: 0x6b4a26 }));
  signPost.position.set(head.x - 7, 2.5, head.z - 4); group.add(signPost);
  const signBoard = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.7),
    new THREE.MeshLambertMaterial({ map: texFrom(sc.c, 1, 1), side: THREE.DoubleSide }));
  signBoard.position.set(head.x - 7, 4.4, head.z - 4); group.add(signBoard);

  scene.add(group);
  return { group: group, props: props, fire: fire, camp: camp, head: head };
}

/* Trees past the fog are pure fog colour anyway — switch those chunks off so
   the renderer never touches them. */
function updateForestLOD(x, z) {
  const lod = Map1.forestLOD;
  if (!lod) return;
  const far = ((G.scene && G.scene.fog) ? G.scene.fog.far : 120) + (Map1.forestLODr || 40);
  const f2 = far * far;
  for (const c of lod) {
    const dx = c.x - x, dz = c.z - z;
    const on = dx * dx + dz * dz < f2;
    for (const m of c.m) m.visible = on;
  }
}


/* =========================================================================
   Part 5d — CONFISCATION
   Baldi has found out there are anime books in his school. He is taking this
   about as well as you would expect. You do the fetching; he does the
   commentary. When the last one is in the pile, the lights go out…
   ========================================================================= */

/* ------------------------------------------------- the offending article */
let MOE_TEX = null, MOE_SPINE = null;

/* A moe-style cover, drawn from scratch: big eyes, pink fringe, sparkles. */
function moeCoverTexture(variant) {
  const W = 128, H = 176, { c, x } = cv(W, H);
  const bgs = ['#ffd7ec', '#d9e6ff', '#ffe9c2', '#e2d6ff', '#d4f4e2'];
  const hairs = ['#ff7fc4', '#8fd0ff', '#ffd45c', '#b98bff', '#7be0b0'];
  const bg = bgs[variant % bgs.length], hair = hairs[variant % hairs.length];

  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  /* sunburst behind her */
  x.save(); x.translate(64, 84);
  for (let i = 0; i < 12; i++) {
    x.rotate(Math.PI / 6);
    x.fillStyle = 'rgba(255,255,255,.45)';
    x.beginPath(); x.moveTo(0, 0); x.lineTo(90, -14); x.lineTo(90, 14); x.closePath(); x.fill();
  }
  x.restore();

  /* hair behind */
  x.fillStyle = hair;
  x.beginPath(); x.ellipse(64, 92, 44, 52, 0, 0, Math.PI * 2); x.fill();
  /* face */
  x.fillStyle = '#ffeadd';
  x.beginPath(); x.ellipse(64, 96, 33, 36, 0, 0, Math.PI * 2); x.fill();
  /* fringe */
  x.fillStyle = hair;
  x.beginPath(); x.ellipse(64, 66, 40, 26, 0, Math.PI, 0); x.fill();
  x.beginPath(); x.moveTo(30, 66); x.lineTo(50, 66); x.lineTo(38, 96); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(78, 66); x.lineTo(98, 66); x.lineTo(90, 96); x.closePath(); x.fill();
  /* side locks */
  x.beginPath(); x.ellipse(26, 104, 10, 30, 0.15, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(102, 104, 10, 30, -0.15, 0, Math.PI * 2); x.fill();
  /* a ribbon */
  x.fillStyle = '#ff4f6d';
  x.beginPath(); x.moveTo(96, 62); x.lineTo(112, 52); x.lineTo(112, 74); x.closePath(); x.fill();
  x.beginPath(); x.arc(96, 63, 6, 0, Math.PI * 2); x.fill();

  /* eyes — enormous, glossy */
  for (const ex of [50, 78]) {
    x.fillStyle = '#2b2338';
    x.beginPath(); x.ellipse(ex, 98, 12, 15, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = variant % 2 ? '#4aa8ff' : '#a05cff';
    x.beginPath(); x.ellipse(ex, 100, 9, 12, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#ffffff';
    x.beginPath(); x.ellipse(ex - 4, 94, 4.2, 5, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(ex + 4, 105, 2.2, 2.6, 0, 0, Math.PI * 2); x.fill();
    /* lashes */
    x.strokeStyle = '#2b2338'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(ex - 13, 90); x.lineTo(ex - 5, 85); x.stroke();
  }
  /* blush + mouth */
  x.fillStyle = 'rgba(255,140,170,.55)';
  x.beginPath(); x.ellipse(38, 112, 8, 5, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(90, 112, 8, 5, 0, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#c2607a'; x.lineWidth = 2.4;
  x.beginPath(); x.arc(64, 116, 6, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();

  /* sparkles */
  x.fillStyle = '#ffffff';
  for (const [sx, sy, r] of [[24, 58, 5], [104, 40, 4], [16, 138, 3.5], [110, 130, 5]]) {
    x.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.34 : r;
      const px = sx + Math.cos(a) * rr, py = sy + Math.sin(a) * rr;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath(); x.fill();
  }

  /* title band + fake logotype bars */
  x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(0, 8, W, 26);
  x.fillStyle = '#e2417f';
  x.font = 'bold 19px Arial'; x.textAlign = 'center';
  x.fillText('MOE MOE', 64, 28);
  x.fillStyle = 'rgba(20,20,30,.82)'; x.fillRect(0, H - 30, W, 30);
  x.fillStyle = '#ffe14d'; x.font = 'bold 15px Arial';
  x.fillText('VOL. ' + (variant + 1), 64, H - 10);
  return texFrom(c, 1, 1);
}
function moeSpineTexture() {
  const { c, x } = cv(32, 176);
  x.fillStyle = '#e2417f'; x.fillRect(0, 0, 32, 176);
  x.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < 6; i++) x.fillRect(6, 22 + i * 24, 20, 10);
  return texFrom(c, 1, 1);
}

/* One volume of it. */
function makeMangaBook(variant) {
  if (!MOE_SPINE) MOE_SPINE = moeSpineTexture();
  const cover = new THREE.MeshLambertMaterial({ map: moeCoverTexture(variant || 0) });
  const spine = new THREE.MeshLambertMaterial({ map: MOE_SPINE });
  const pages = new THREE.MeshLambertMaterial({ color: 0xf6f2e2 });
  const g = new THREE.Group();
  const W = 1.35, H = 0.34, D = 1.85;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D),
    [pages, spine, cover, pages, pages, pages]);
  body.position.y = H / 2; g.add(body);
  const block = box(W * 0.94, H * 0.62, D * 0.94, pages);
  block.position.y = H / 2; g.add(block);
  g.userData.variant = variant || 0;
  return g;
}

/* =========================================================================
   The mode
   ========================================================================= */
const CONF_LINES = [
  'One down. How many of these ARE there?',
  '"Volume two"? There is a volume TWO?',
  'It was behind the fire extinguisher. Behind it!',
  'She has eyes bigger than the clock. That is not anatomy.',
  'I found one in my OWN desk. Somebody is in trouble.',
  'Nearly there. Do not read the back cover.',
  'That is the last one. I can feel it.'
];

const Confiscate = {
  active: false, books: [], got: 0, total: 7, t: 0, phase: 'idle',
  timer: 0, marker: null, fadeT: 0,

  start() {
    this.active = true; this.got = 0; this.t = 0; this.phase = 'hunt';
    this.books = []; this.timer = 0; this.fadeT = 0;
    G.friendlyBaldi = true; G.baldiLeftPad = false; G.loadFactor = 1;

    for (const nb of G.nbList) if (!nb.taken && nb.mesh) G.scene.remove(nb.mesh);
    G.nbList = []; G.notebooks = 0; G.total = 0;
    UI.el('nbCount').innerHTML = '0/' + this.total + '<small>ANIME BOOKS</small>';

    this.place(this.total);

    const b = G.ents.baldi;
    if (b) {
      const sp = freeSpotNear(G.player.x, G.player.z - 6, 1.0, 14);
      b.x = sp.x; b.z = sp.z; b.awake = true; b.anger = 0;
      b.model.root.position.set(b.x, 0, b.z);
      b.model.setMood(0);
      b.mode2 = 'follow';
    }
    UI.el('objTitle').textContent = 'CONFISCATION';
    UI.el('objText').textContent = 'Find all ' + this.total + ' anime books — 0/' + this.total;
    UI.el('objBar').classList.remove('hidden');
    UI.el('confCheat').classList.remove('hidden');
    this.say('Somebody has been smuggling ANIME into my school.');
    this.timer = 3.2;
  },

  say(text) {
    UI.el('dialogue').classList.remove('hidden');
    UI.el('dlgName').textContent = 'BALDI';
    UI.el('dlgText').textContent = text;
    const b = G.ents.baldi;
    if (b) b.model.say(2.6);
    Audio1.tone(300 + rand(-25, 25), 0.09, 0.05, 'square');
  },

  place(n) {
    const rooms = shuffle(Map1.rooms.slice());
    for (let i = 0; i < n; i++) {
      const r = rooms[i % rooms.length];
      const c = cellCenter(randi(r.x0, r.x1), randi(r.y0, r.y1));
      const sp = freeSpotNear(c.x, c.z, 1.0, 16);
      const mesh = makeMangaBook(i);
      mesh.position.set(sp.x, 1.9, sp.z);
      mesh.rotation.x = -0.5;
      G.scene.add(mesh);
      this.books.push({
        x: sp.x, z: sp.z, mesh: mesh, taken: false, variant: i,
        cell: worldToCell(sp.x, sp.z), room: r.name
      });
    }
  },

  update(dt) {
    if (!this.active || !G.running) return;
    this.t += dt;

    if (this.phase === 'fade') {
      this.fadeT += dt;
      if (this.fadeT > 3.4) { this.phase = 'done'; this.toCutscene(); }
      return;
    }
    if (G.mode !== 'play') return;

    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) UI.el('dialogue').classList.add('hidden');
    }

    const p = G.player;
    for (const b of this.books) {
      if (b.taken) continue;
      b.mesh.rotation.y += dt * 1.3;
      b.mesh.position.y = 1.9 + Math.sin(this.t * 2.3 + b.x) * 0.14;
      if (Math.hypot(b.x - p.x, b.z - p.z) < 2.8) this.grab(b);
    }

    if (this.phase === 'cheer') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.phase = 'fade'; this.fadeT = 0;
        G.mode = 'cut';                     // its own mode, so losing the
                                            // pointer lock cannot pause it
        G.paused = false;
        UI.el('pauseHint').classList.add('hidden');
        UI.el('dialogue').classList.add('hidden');
        UI.el('objBar').classList.add('hidden');
        UI.el('fadeText').textContent = '';
        UI.el('fade').classList.add('on');
        if (document.exitPointerLock) document.exitPointerLock();
      }
    }
  },

  grab(b) {
    b.taken = true;
    G.scene.remove(b.mesh);
    this.got++;
    Audio1.pickup();
    UI.el('nbCount').innerHTML = this.got + '/' + this.total + '<small>ANIME BOOKS</small>';
    UI.el('objText').textContent = 'Find all ' + this.total + ' anime books — ' +
      this.got + '/' + this.total;

    if (this.got >= this.total) {
      this.phase = 'cheer';
      UI.el('confCheat').classList.add('hidden');
      this.timer = 4.2;
      this.say('GREAT JOB! Every last one of them. Leave the rest to me.');
      Audio1.correct();
      const bl = G.ents.baldi;
      if (bl) { bl.mode2 = 'wait'; bl.model.say(3.0); }
      UI.el('objText').textContent = 'All ' + this.total + ' confiscated. Great job!';
      UI.say('GREAT JOB!', 3200);
    } else {
      this.say(CONF_LINES[Math.min(this.got - 1, CONF_LINES.length - 1)]);
      this.timer = 3.0;
    }
  },

  /* one click and the whole hunt is done — for testing the cutscene */
  grabAll() {
    if (!this.active || this.phase !== 'hunt') return;
    /* clear the pause that clicking the button caused */
    G.paused = false;
    UI.el('pauseHint').classList.add('hidden');
    UI.el('confCheat').classList.add('hidden');
    const left = this.books.filter(b => !b.taken);
    if (!left.length) return;
    for (let i = 0; i < left.length - 1; i++) {
      const b = left[i];
      b.taken = true; G.scene.remove(b.mesh); this.got++;
    }
    UI.el('nbCount').innerHTML = this.got + '/' + this.total + '<small>ANIME BOOKS</small>';
    this.grab(left[left.length - 1]);            // the last one runs the cheer
  },

  toCutscene() {
    this.active = false;
    G.friendlyBaldi = false;
    UI.el('hud').classList.add('hidden');
    UI.el('objBar').classList.add('hidden');
    Audio1.stopAmbient(); Music.stop(true);
    DJ.start();
  },

  stop() {
    this.active = false;
    UI.el('confCheat').classList.add('hidden');
    for (const b of this.books) if (!b.taken && b.mesh && G.scene) G.scene.remove(b.mesh);
    this.books = []; this.phase = 'idle';
  }
};


/* =========================================================================
   Part 5e — THE DJ ROOM
   What Baldi does with the confiscated books once you have gone home.
   A whole music video: grid floor, lasers, confetti, backup dancers, a
   bonfire of manga and a man who is having the time of his life.
   ========================================================================= */

const BPM = 120, BEAT = 60 / BPM, BAR = BEAT * 4;

/* ---------------------------------------------------------------- easing */
function easeOutBack(x)    { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
function easeOutElastic(x) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  return Math.pow(2, -9 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
}
function easeOutBounce(x) {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}
/* 1 on the beat, decaying away — the engine of every squash in here */
function thump(t, k) { const p = (t / BEAT) % 1; return Math.exp(-p * (k || 8)); }
function onBeat(t)   { return Math.floor(t / BEAT); }

/* =========================================================================
   THE SCORE
   A written piece rather than a pattern: nine melodic themes, each with its
   own character, handed around between voices as the film goes on, and then
   stacked on top of one another for the finish. Two key lifts at the end.
   ========================================================================= */

/* ---------------------------------------------------------------- pitch */
const SEMI = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6,
               Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
function midi(name) {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(name);
  if (!m) return null;
  return SEMI[m[1]] + (parseInt(m[2], 10) + 1) * 12;
}
function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
/* legacy short names a few one-shots still use */
const N = {
  A1: hz(33), C2: hz(36), D2: hz(38), E2: hz(40), F2: hz(41), G2: hz(43),
  A2: hz(45), C3: hz(48), D3: hz(50), E3: hz(52), F3: hz(53), G3: hz(55),
  A3: hz(57), B3: hz(59), C4: hz(60), D4: hz(62), E4: hz(64), F4: hz(65),
  G4: hz(67), A4: hz(69)
};
const CHORD = {
  Am: [57, 60, 64], F: [53, 57, 60], C: [60, 64, 67], G: [55, 59, 62],
  Dm: [62, 65, 69], E: [52, 56, 59], Bb: [58, 62, 65], Em: [52, 55, 59],
  Bdim: [59, 62, 65]
};
const CHORD_ROOT = { Am: 33, F: 29, C: 36, G: 31, Dm: 38, E: 40, Bb: 34, Em: 40, Bdim: 35 };
/* kept for the old bass code path */
const CHORD_SHIFT = { Am: 1, F: 0.7937, C: 1.1892, G: 0.8909, Dm: 1.3348, E: 1.4983 };

/* sixteen tokens to the bar: a note name, '-' to hold, '.' for a rest */
function bar16(str) {
  const t = str.trim().split(/\s+/);
  while (t.length < 16) t.push('.');
  return t.slice(0, 16);
}
const T = arr => arr.map(bar16);

/* =========================================================================
   The themes
   ========================================================================= */
const THEMES = {

  /* --- the bonus: he goes home --- */

  /* tired and warm, for walking up his own garden path at night */
  homing: T([
    'E4 .  .  .  G4 .  .  .  A4 .  .  .  G4 .  E4 . ',
    'D4 .  .  .  E4 .  .  .  C4 .  .  .  -  .  .  . ',
    'E4 .  .  .  G4 .  .  .  C5 .  .  .  B4 .  A4 . ',
    'G4 .  .  .  E4 .  .  .  A4 .  .  .  -  .  .  . ',
  ]),

  /* sickly sweet.  This is the tune the girls get, and it is a lie */
  cute: T([
    'E5 .  G5 .  A5 .  G5 .  E5 .  D5 .  E5 .  .  . ',
    'C5 .  D5 .  E5 .  G5 .  A5 .  .  .  G5 .  E5 . ',
    'D5 .  E5 .  G5 .  A5 .  C6 .  A5 .  G5 .  E5 . ',
    'D5 .  C5 .  D5 .  E5 .  C5 .  .  .  -  .  .  . ',
  ]),

  /* creeping chromatically up to the desk, one step per beat */
  creep: T([
    'A2 .  .  .  Bb2 . .  .  B2 .  .  .  C3 .  .  . ',
    '-  .  .  .  .  .  .  .  B2 .  .  .  Bb2 . .  . ',
    'A2 .  .  .  -  .  .  .  G#2 . .  .  A2 .  .  . ',
    'Bb2 . .  .  B2 .  .  .  C3 .  C#3 . D3 .  .  . ',
  ]),

  /* the sting, when he reads what is written on his own worksheet */
  dread: T([
    'A3 .  .  .  .  .  .  .  Eb4 . .  .  .  .  .  . ',
    'E4 .  .  .  .  .  .  .  F4 .  .  .  .  .  .  . ',
    'A3 .  .  .  Eb4 . .  .  E4 .  .  .  F4 .  .  . ',
    '-  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . ',
  ]),

  /* Phrygian and unfriendly — the duel */
  frames: T([
    'A3 .  .  .  Bb3 . .  .  A3 .  G3 .  F3 .  .  . ',
    'E3 .  .  .  -  .  .  .  F3 .  G3 .  A3 .  .  . ',
    'C4 .  .  .  Bb3 . A3 .  G3 .  .  .  F3 .  .  . ',
    'E3 .  .  .  -  .  .  .  -  .  .  .  .  .  .  . ',
  ]),

  /* bright and lazy, for a hot afternoon in a corridor */
  kampong: T([
    'D5 .  .  .  F5 .  .  .  A5 .  G5 .  F5 .  .  . ',
    'D5 .  .  .  -  .  .  .  C5 .  D5 .  F5 .  .  . ',
    'A5 .  .  .  G5 .  F5 .  D5 .  .  .  C5 .  .  . ',
    'D5 .  .  .  -  .  .  .  .  .  .  .  .  .  .  . ',
  ]),

  /* four notes, repeated, gets heavier every time */
  combo: T([
    'A3 .  A3 .  C4 .  A3 .  E4 .  .  .  D4 .  C4 . ',
    'A3 .  A3 .  C4 .  E4 .  G4 .  .  .  E4 .  D4 . ',
    'A3 .  A3 .  C4 .  A3 .  A4 .  .  .  G4 .  E4 . ',
    'F4 .  E4 .  D4 .  C4 .  A3 .  .  .  -  .  .  . ',
  ]),

  /* the CONFISCATE hook — the tune the whole film keeps coming back to */
  hook: T([
    'A4 .  .  .  A4 .  C5 .  A4 .  .  .  G4 .  .  . ',
    'E4 .  .  .  -  .  .  .  F4 .  G4 .  A4 .  .  . ',
    'F4 .  .  .  F4 .  A4 .  F4 .  .  .  E4 .  .  . ',
    'D4 .  .  .  -  .  .  .  -  .  .  .  .  .  .  . ',
    'A4 .  .  .  A4 .  C5 .  D5 .  .  .  E5 .  .  . ',
    'C5 .  .  .  -  .  .  .  D5 .  C5 .  B4 .  .  . ',
    'A4 .  .  .  C5 .  E5 .  D5 .  .  .  C5 .  .  . ',
    'A4 .  .  .  -  .  .  .  -  .  .  .  .  .  .  . '
  ]),

  /* a four-bar tease of the hook, for the very top of the film */
  tease: T([
    '.  .  .  .  .  .  .  .  A4 .  .  .  -  .  .  . ',
    'C5 .  .  .  -  .  .  .  .  .  .  .  .  .  .  . ',
    '.  .  .  .  .  .  .  .  E4 .  .  .  -  .  .  . ',
    'A4 .  .  .  -  .  .  .  -  .  .  .  .  .  .  . '
  ]),

  /* the schoolhouse — a plain, slightly sad counter-line for the verse */
  verse: T([
    'E4 .  .  .  .  .  .  .  D4 .  E4 .  .  .  .  . ',
    'F4 .  .  .  -  .  .  .  E4 .  .  .  .  .  .  . ',
    'D4 .  .  .  .  .  .  .  C4 .  D4 .  .  .  .  . ',
    'E4 .  .  .  -  .  .  .  -  .  .  .  .  .  .  . ',
    'A4 .  .  .  .  .  .  .  G4 .  A4 .  .  .  .  . ',
    'C5 .  .  .  -  .  .  .  B4 .  .  .  .  .  .  . ',
    'A4 .  .  .  G4 .  .  .  F4 .  .  .  E4 .  .  . ',
    'D4 .  .  .  -  .  .  .  -  .  .  .  .  .  .  . '
  ]),

  /* the pre-chorus climb */
  rise: T([
    'A4 .  B4 .  C5 .  D5 .  E5 .  .  .  -  .  .  . ',
    'C5 .  D5 .  E5 .  F5 .  G5 .  .  .  -  .  .  . ',
    'D5 .  E5 .  F5 .  G5 .  A5 .  .  .  G5 .  F5 . ',
    'E5 .  F5 .  G5 .  A5 .  B5 .  .  .  .  .  .  . '
  ]),

  /* the floor: a funk clav riff */
  floor: T([
    'A4 .  A4 .  .  C5 .  A4 .  .  G4 .  E4 .  .  . ',
    '.  .  A4 .  C5 .  .  D5 .  C5 .  A4 .  .  .  . ',
    'F4 .  F4 .  .  A4 .  F4 .  .  E4 .  D4 .  .  . ',
    '.  .  E4 .  G4 .  .  A4 .  .  .  .  .  .  .  . '
  ]),

  /* the machines: a chromatic ostinato that will not stop */
  machine: T([
    'A4 .  Bb4 . B4 .  C5 .  B4 .  Bb4 . A4 .  .  . ',
    'A4 .  Bb4 . B4 .  C5 .  D5 .  C5 .  B4 .  .  . ',
    'E4 .  F4 .  F#4 . G4 .  F#4 . F4 .  E4 .  .  . ',
    'A4 .  .  .  C5 .  .  .  E5 .  .  .  A5 .  .  . '
  ]),

  /* the obby: bright, bouncy, C major */
  obby: T([
    'C5 .  E5 .  G5 .  E5 .  C5 .  D5 .  E5 .  .  . ',
    'F5 .  E5 .  D5 .  C5 .  G4 .  .  .  C5 .  .  . ',
    'E5 .  G5 .  A5 .  G5 .  E5 .  D5 .  C5 .  .  . ',
    'D5 .  E5 .  F5 .  E5 .  D5 .  .  .  C5 .  .  . '
  ]),

  /* the long shot: two notes and a lot of air */
  longshot: T([
    'A4 .  .  .  .  .  .  .  -  .  .  .  .  .  .  . ',
    'E4 .  .  .  .  .  .  .  -  .  .  .  .  .  .  . ',
    'F4 .  .  .  .  .  .  .  -  .  .  .  E4 .  .  . ',
    'D4 .  .  .  .  .  .  .  -  .  .  .  .  .  .  . '
  ]),

  /* the bombsite: a bugle call */
  bugle: T([
    'A4 .  A4 .  E5 .  .  .  A4 .  A4 .  E5 .  .  . ',
    'F4 .  G4 .  A4 .  .  .  E5 .  .  .  -  .  .  . ',
    'A4 .  A4 .  E5 .  .  .  C5 .  C5 .  G5 .  .  . ',
    'F5 .  E5 .  D5 .  .  .  A4 .  .  .  -  .  .  . '
  ]),

  /* the skeleton: fast, minor, unforgiving */
  badtime: T([
    'D5 .  C5 D5 A4 .  F4 .  G4 A4 Bb4 A4 G4 F4 E4 D4',
    'D5 .  C5 D5 A4 .  F4 .  E4 F4 G4 F4 E4 D4 C4 D4',
    'F5 .  E5 F5 C5 .  A4 .  Bb4 C5 D5 C5 Bb4 A4 G4 F4',
    'E5 .  D5 E5 A4 .  C5 .  D5 .  .  .  A4 .  .  . '
  ]),

  /* the jumpscare: a music box that should have stayed shut */
  musicbox: T([
    'A5 .  .  .  .  .  .  .  E5 .  .  .  .  .  .  . ',
    'C5 .  .  .  .  .  .  .  E5 .  .  .  .  .  .  . ',
    'D5 .  .  .  .  .  .  .  B4 .  .  .  .  .  .  . ',
    'A4 .  .  .  .  .  .  .  -  .  .  .  .  .  .  . '
  ]),

  /* the cane: a dotted military figure */
  march: T([
    'A4 .  A4 .  A4 .  .  .  E5 .  .  .  -  .  .  . ',
    'F4 .  .  .  E4 .  .  .  D4 .  .  .  -  .  .  . ',
    'A4 .  A4 .  A4 .  .  .  C5 .  .  .  -  .  .  . ',
    'B4 .  .  .  A4 .  .  .  -  .  .  .  .  .  .  . '
  ]),

  /* the final: a stadium anthem you could actually sing */
  anthem: T([
    'C5 .  .  .  C5 .  D5 .  E5 .  .  .  -  .  .  . ',
    'F5 .  E5 .  D5 .  C5 .  D5 .  .  .  -  .  .  . ',
    'G4 .  .  .  C5 .  .  .  E5 .  .  .  G5 .  .  . ',
    'F5 .  E5 .  D5 .  .  .  C5 .  .  .  -  .  .  . ',
    'E5 .  .  .  E5 .  F5 .  G5 .  .  .  -  .  .  . ',
    'A5 .  G5 .  F5 .  E5 .  D5 .  .  .  -  .  .  . ',
    'C5 .  .  .  E5 .  G5 .  C6 .  .  .  B5 .  .  . ',
    'G5 .  .  .  E5 .  .  .  C5 .  .  .  -  .  .  . '
  ])
};

/* how long a note lasts, in sixteenths, counting the '-' after it */
function themeAt(th, bar, step) {
  const b = th[bar % th.length];
  const tok = b[step];
  if (!tok || tok === '.' || tok === '-') return null;
  let n = 1;
  for (let i = step + 1; i < 16 && b[i] === '-'; i++) n++;
  /* let it run into the next bar if that bar opens with a hold */
  if (step + n === 16) {
    const nb = th[(bar + 1) % th.length];
    for (let i = 0; i < 16 && nb[i] === '-'; i++) n++;
  }
  const m = midi(tok);
  return m === null ? null : { m: m, steps: n };
}

/* =========================================================================
   The arrangement
   ========================================================================= */
const SECTIONS = [
  { name: 'intro', bar0: 0, bars: 4, key: 0,
    kick: 'X.......X.......', snare: '................',
    clap: '................', hat: '................',
    bass: ['A1', 0, 0, 0, 0, 0, 0, 0, 'A1', 0, 0, 0, 0, 0, 0, 0],
    chords: ['Am', 'Am', 'F', 'F'], stab: '.......x........', open: 0, pad: 0.5,
    mel: [{ th: 'tease', v: 'bell', vol: 0.12, send: 0.55 }],
    extra: ['................', '..............h.', '......h.......h.', 'h.....h...h...h.'] },

  { name: 'verse', bar0: 4, bars: 8, key: 0,
    kick: 'X...x...X...x...', snare: '................',
    clap: '....X.......X...', hat: '..x...x...x...x.',
    bass: ['A1', 0, 0, 'A1', 0, 'C2', 0, 0, 'A1', 0, 'G2', 0, 'E2', 0, 0, 0],
    chords: ['Am', 'Am', 'F', 'F', 'C', 'C', 'G', 'G'], stab: '................',
    open: 1, pad: 0.30,
    mel: [{ th: 'verse', v: 'pluck', vol: 0.085, send: 0.30 }],
    extra: ['................', '..........s.....', '......k.........', '..........s...h.',
            '..............b.', '......k...s.....', '..k.............', '..........s.s...'] },

  { name: 'pre', bar0: 12, bars: 4, key: 0,
    kick: 'X.......X.......', snare: 'ROLL',
    clap: '................', hat: 'x.x.x.x.x.x.x.x.',
    bass: ['A1', 0, 0, 0, 'C2', 0, 0, 0, 'D2', 0, 0, 0, 'E2', 0, 0, 0],
    chords: ['Am', 'C', 'Dm', 'E'], stab: 'x...x...x...x...', open: 0, pad: 0.55,
    mel: [{ th: 'rise', v: 'chip', vol: 0.085, send: 0.35 }],
    extra: ['................', '............b...', '....b.......b...', 'b...b...b...b...'] },

  { name: 'chorus', bar0: 16, bars: 8, key: 0,
    kick: 'X...X...X...X...', snare: '....X.......X...',
    clap: '....X.......X..x', hat: '..X...X...X...X.',
    bass: ['A1', 0, 'A1', 0, 'A1', 0, 'A1', 0, 'G2', 0, 'G2', 0, 'F2', 0, 'F2', 0],
    chords: ['Am', 'Am', 'F', 'F', 'C', 'C', 'G', 'G'],
    stab: '..x...x...x...x.', open: 2, pad: 0.45,
    mel: [{ th: 'hook', v: 'lead', vol: 0.115, send: 0.30 },
          { th: 'verse', v: 'pluck', vol: 0.05, oct: -12, send: 0.25 }],
    extra: ['................', '..............c.', '..........s.....', '......c.......c.',
            '...........b....', '..........s...c.', '..k...........c.', '......c...s...c.'] },

  { name: 'break', bar0: 24, bars: 12, key: 0,
    kick: 'X.....x...X.....', snare: '....X.......X...',
    clap: '................', hat: 'x.xxx.xxx.xxx.xx',
    bass: ['A1', 0, 0, 'C2', 0, 'A1', 0, 0, 'G2', 0, 0, 'A1', 0, 'E2', 0, 0],
    chords: ['Am', 'F', 'Am', 'G', 'Dm', 'Am', 'F', 'E', 'Am', 'C', 'G', 'E'],
    stab: '....x.......x..x', open: 1, vinyl: 1, pad: 0.20,
    mel: [{ th: 'floor', v: 'clav', vol: 0.095, send: 0.22 },
          { th: 'tease', v: 'bell', vol: 0.055, oct: 12, send: 0.5 }],
    extra: ['................', '..........s.....', '......w.........', '..........s...w.',
            '..............b.', '......w...s.....', '..k.......w.....', '..........s.s...',
            '....w...........', '..k...........w.', '..........s...b.', 'w.....w...s...w.'] },

  { name: 'machines', bar0: 36, bars: 22, key: 0,
    kick: 'X...X...X...X...', snare: '........X.......',
    clap: '................', hat: '..x...x...x...x.',
    bass: ['A1', 0, 'A1', 0, 'A1', 0, 'A1', 0, 'A1', 0, 'A1', 0, 'A1', 0, 'A1', 0],
    chords: ['Am', 'Am', 'Am', 'E', 'Am', 'F', 'Am', 'E', 'Am', 'Am', 'Dm', 'E'],
    stab: '............x...', open: 0, dist: 1, pad: 0.30,
    mel: [{ th: 'machine', v: 'chip', vol: 0.075, send: 0.20 },
          { th: 'hook', v: 'brass', vol: 0.065, oct: -12, send: 0.30, every: 8 }],
    extra: ['................', '......m.........', '..m.........m...', '......m.......m.',
            '..m...m.........', '............m...', '..m.......m...m.', '......m.........',
            '..m.........m...', '............m...', '..m...m.......m.', '......m.......m.'] },

  { name: 'obby', bar0: 58, bars: 16, key: 0,
    kick: 'X...X...X...X...', snare: '....X.......X...',
    clap: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    bass: ['C2', 0, 0, 'C2', 0, 'G2', 0, 0, 'C2', 0, 0, 'C2', 0, 'G2', 0, 0],
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C', 'Am', 'F', 'C', 'G', 'C', 'Am', 'G', 'C'],
    stab: '..x...x...x...x.', open: 1, bright: 1, pad: 0.40,
    mel: [{ th: 'obby', v: 'chip', vol: 0.095, send: 0.28 },
          { th: 'obby', v: 'bell', vol: 0.045, oct: 12, off: 2, send: 0.55 }],
    extra: ['................', '..............b.', '..........c.....', '......b.......c.',
            '............b...', '..........c...b.', '..k...........c.', '......c...b...c.',
            '................', '..............c.', '..........b.....', '......c.......b.',
            '............c...', '..........b...c.', '..k...........b.', 'c...c...b...c...'] },

  { name: 'sniper', bar0: 74, bars: 8, key: 0,
    kick: 'X.......X.......', snare: '................',
    clap: '................', hat: '..............x.',
    bass: ['A1', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    chords: ['Am', 'Am', 'E', 'E', 'Am', 'Am', 'Dm', 'E'], stab: '................',
    open: 0, pad: 0.7,
    mel: [{ th: 'longshot', v: 'choir', vol: 0.075, send: 0.85 },
          { th: 'longshot', v: 'bell', vol: 0.035, oct: 12, off: 8, send: 0.8 }],
    extra: ['................', '..............h.', '................', '........h.......',
            '................', '..........h.....', '......h.........', 'h...h...h...h...'] },

  { name: 'csgo', bar0: 82, bars: 11, key: 0,
    kick: 'X...X...X...X...', snare: 'x.x.X.x.x.x.X.x.',
    clap: '................', hat: '................',
    bass: ['A1', 0, 0, 0, 'A1', 0, 0, 0, 'A1', 0, 0, 0, 'G2', 0, 'A1', 0],
    chords: ['Am', 'Am', 'F', 'E', 'Am', 'Am', 'Dm', 'E', 'Am', 'F', 'E'],
    stab: '............x...', open: 0, dist: 1, pad: 0.35,
    mel: [{ th: 'bugle', v: 'brass', vol: 0.105, send: 0.32 },
          { th: 'machine', v: 'chip', vol: 0.05, oct: -12, send: 0.2 }],
    extra: ['................', '..m.............', '..........m.....', '..m.......m...m.',
            '......m.........', '............m...', '..m...m.........', '..........m...m.',
            '..m.............', '......m.......m.', 'm...m...m...m...'] },

  { name: 'sans', bar0: 93, bars: 13, key: 0,
    kick: 'X...X...X...X...', snare: '....X.......X...',
    clap: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx',
    bass: ['D2', 'D2', 0, 'D2', 0, 'D2', 0, 'C2', 0, 'C2', 0, 'A1', 0, 'A1', 'A1', 0],
    chords: ['Dm', 'Dm', 'C', 'C', 'Am', 'Am', 'E', 'E', 'Dm', 'C', 'Am', 'E', 'Dm'],
    stab: '..x.x...x.x...x.', open: 3, pad: 0.25,
    mel: [{ th: 'badtime', v: 'lead', vol: 0.10, send: 0.22 },
          { th: 'badtime', v: 'chip', vol: 0.045, oct: -12, send: 0.15 }],
    extra: ['................', '..k.......k.....', '............c...', '..k...c...k...c.',
            '......b.........', '..k.......k...c.', 'c...c...c...c...', '..k...c.......c.',
            '..........b.....', '..k...........c.', '......c...b...c.', '..k...k...k...k.',
            'c...c...c...c...'] },

  { name: 'huggy', bar0: 106, bars: 11, key: 0,
    kick: '................', snare: '................',
    clap: '................', hat: '................',
    bass: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    chords: ['Am', 'Am', 'Dm', 'Dm', 'Am', 'E', 'Am', 'Dm', 'E', 'Am', 'Am'],
    stab: '................', open: 0, pad: 0.55,
    mel: [{ th: 'musicbox', v: 'box', vol: 0.11, send: 0.75 },
          { th: 'musicbox', v: 'choir', vol: 0.03, oct: -12, send: 0.9 }],
    extra: ['................', '................', '............h...', '................',
            '................', '..........h.....', '................', '......h.........',
            '................', 'h...............', '................'] },

  { name: 'cane', bar0: 117, bars: 8, key: 0,
    kick: 'X...x...X...x...', snare: 'x.x.x.x.x.x.x.x.',
    clap: '................', hat: '................',
    bass: ['A1', 0, 0, 0, 'A1', 0, 0, 0, 'E2', 0, 0, 0, 'A1', 0, 0, 0],
    chords: ['Am', 'Am', 'E', 'E', 'Am', 'Dm', 'E', 'Am'],
    stab: '................', open: 0, march: 1, pad: 0.35,
    mel: [{ th: 'march', v: 'brass', vol: 0.10, send: 0.30 }],
    extra: ['................', '..........s.....', '......s.........', '..........s...s.',
            '......s...s.....', '..........s.....', '..s...s...s...s.', 's.s.s.s.s.s.s.s.'] },

  { name: 'cup', bar0: 125, bars: 15, key: 0,
    kick: 'X...X...X...X...', snare: '....X.......X...',
    clap: '....X...x...X..x', hat: '..x...x...x...x.',
    bass: ['A1', 0, 'A1', 0, 'C2', 0, 'C2', 0, 'G2', 0, 'G2', 0, 'F2', 0, 'F2', 0],
    chords: ['C', 'C', 'G', 'G', 'Am', 'Am', 'F', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'C'],
    stab: 'x...x...x...x...', open: 2, anthem: 1, pad: 0.6,
    mel: [{ th: 'anthem', v: 'brass', vol: 0.115, send: 0.35 },
          { th: 'anthem', v: 'choir', vol: 0.045, oct: 12, send: 0.6 },
          { th: 'hook', v: 'lead', vol: 0.075, from: 11, send: 0.28 }],
    extra: ['................', '..............c.', '..........s.....', '......c.......c.',
            '............b...', '..........s...c.', '..k...........c.', '......c...s...c.',
            '..t.....t.......', '..............t.', '..........c.....', '......t.......c.',
            '............t...', '..........c...t.', 't...t...t...t...'] },

  { name: 'sgschool', bar0: 140, bars: 13, key: 0,
    kick: 'X.......X...x...', snare: '................',
    clap: '....x.......x...', hat: '..x.x.x...x.x.x.',
    bass: ['D2', 0, 0, 0, 'A1', 0, 0, 'D2', 0, 0, 'F2', 0, 'C2', 0, 0, 0],
    chords: ['Dm', 'Dm', 'F', 'C', 'Dm', 'Bb', 'F', 'C', 'Dm', 'F', 'C', 'Dm', 'Dm'],
    stab: '......x.......x.', open: 1, pad: 0.40,
    mel: [{ th: 'kampong', v: 'bell', vol: 0.095, send: 0.45 },
          { th: 'kampong', v: 'pluck', vol: 0.05, oct: -12, off: 4, send: 0.25 }],
    extra: ['................', '..........c.....', '......h.........', '..........c...h.',
            '............b...', '..........c...b.', '..k...........c.', '......h...c...h.',
            '..........b.....', '..k...........h.', '......c...b...c.', '..h...h...h...h.',
            'c...c...c...c...'] },

  { name: 'tsb', bar0: 153, bars: 15, key: 0,
    kick: 'X..X....X..X..X.', snare: '....X.......X...',
    clap: '....X...x...X..x', hat: 'x.x.x.x.x.x.x.x.',
    bass: ['A1', 0, 'A1', 0, 0, 'A1', 0, 0, 'A1', 0, 'G2', 0, 'F2', 0, 'E2', 0],
    chords: ['Am', 'Am', 'Am', 'E', 'Am', 'F', 'G', 'E', 'Am', 'Am', 'Dm', 'E', 'Am', 'F', 'E'],
    stab: 'x...x...x...x...', open: 3, dist: 1, pad: 0.30,
    mel: [{ th: 'combo', v: 'lead', vol: 0.115, send: 0.25 },
          { th: 'machine', v: 'clav', vol: 0.06, oct: -12, send: 0.15 },
          { th: 'hook', v: 'chip', vol: 0.05, oct: 12, from: 8, send: 0.30 }],
    extra: ['................', '..m.......m.....', '............c...', '..m...c...m...c.',
            '......b.........', '..m.......m...c.', 'c...c...c...c...', '..m...c.......c.',
            '..........b.....', '..m...........c.', '......c...b...c.', '..m...m...m...m.',
            'c...c...c...c...', '..m...c...m...c.', 'm...m...m...m...'] },

  { name: 'naoyaStill', bar0: 168, bars: 6, key: 0,
    kick: 'X...............', snare: '................',
    clap: '................', hat: '................',
    bass: ['A1', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    chords: ['Am', 'Am', 'Am', 'Am', 'Am', 'E'], stab: '................',
    open: 0, pad: 0.85, hush: 1,
    mel: [{ th: 'frames', v: 'choir', vol: 0.05, oct: -12, every: 2, send: 0.85 }],
    extra: ['................', '................', '................',
            '..............h.', '................', 'h.......h.......'] },

  { name: 'naoyaFight', bar0: 174, bars: 15, key: 0,
    kick: 'X..X..X.X..X..X.', snare: '....X.......X...',
    clap: '....X...x...X..x', hat: 'xxxxxxxxxxxxxxxx',
    bass: ['A1', 'A1', 0, 'A1', 'Bb', 0, 'A1', 0, 'A1', 'A1', 0, 'G2', 'F2', 0, 'E2', 0],
    chords: ['Am', 'Bb', 'Am', 'E', 'Am', 'F', 'E', 'Am', 'Bb', 'Am', 'Dm', 'E', 'Am', 'F', 'E'],
    stab: 'x.x.x.x.x.x.x.x.', open: 3, dist: 1, pad: 0.35,
    mel: [{ th: 'frames', v: 'lead', vol: 0.115, send: 0.28 },
          { th: 'badtime', v: 'chip', vol: 0.055, oct: -12, send: 0.20 },
          { th: 'machine', v: 'clav', vol: 0.05, oct: -12, off: 8, send: 0.15 }],
    extra: ['................', '..m.......m.....', '............t...', '..m...t...m...t.',
            '......b.........', '..m.......m...t.', 't...t...t...t...', '..m...t.......t.',
            '..........b.....', '..m...........t.', '......t...b...t.', '..m...m...m...m.',
            't...t...t...t...', '..m...t...m...t.', 'm...m...m...m...'] },

  { name: 'naoyaFinish', bar0: 189, bars: 12, key: 0,
    kick: 'X...X...X...X...', snare: '....X.......X...',
    clap: '....X...x...X..x', hat: '..X...X...X...X.',
    bass: ['A1', 0, 'A1', 0, 'A1', 0, 'A1', 0, 'F2', 0, 'F2', 0, 'E2', 0, 'E2', 0],
    chords: ['Am', 'Am', 'F', 'F', 'Dm', 'Dm', 'E', 'E', 'Am', 'F', 'E', 'Am'],
    stab: '..x...x...x...x.', open: 2, pad: 0.70, anthem: 1,
    mel: [{ th: 'frames', v: 'brass', vol: 0.105, send: 0.35 },
          { th: 'frames', v: 'choir', vol: 0.065, oct: 12, send: 0.75 },
          { th: 'hook', v: 'lead', vol: 0.09, oct: 12, from: 6, send: 0.30 },
          { th: 'machine', v: 'clav', vol: 0.05, oct: -12, send: 0.15 }],
    extra: ['................', '..t.......t.....', '............c...', '..t...c...t...c.',
            '......b.........', '..t.......t...c.', 'c...c...c...c...', '..t...c.......c.',
            '..........b.....', '..t...........c.', '......c...b...c.', 't...t...t...t...'] },

  { name: 'bridge', bar0: 201, bars: 5, key: 0,
    kick: 'X...............', snare: '................',
    clap: '........X.......', hat: '................',
    bass: ['A1', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    chords: ['Am', 'Am', 'Am', 'Am', 'E'], stab: '................', open: 0, pad: 0.65,
    mel: [{ th: 'tease', v: 'bell', vol: 0.09, send: 0.7 }],
    extra: ['................', '..............h.', '................', '........h.....h.',
            '....h...h...h.h.'] },

  /* ---- the climax: everything at once, then two key lifts ---- */
  { name: 'burn', bar0: 206, bars: 6, key: 0,
    kick: 'X..X..X.X..X..X.', snare: '....X.......X...',
    clap: '....X...x...X..x', hat: 'xxxxxxxxxxxxxxxx',
    bass: ['A1', 'A1', 0, 'A1', 'C2', 0, 'A1', 0, 'A1', 'A1', 0, 'G2', 'F2', 0, 'E2', 0],
    chords: ['Am', 'Am', 'F', 'E', 'Am', 'F'],
    stab: 'x.x.x.x.x.x.x.x.', open: 3, arp: 1, dist: 1, pad: 0.7,
    mel: [{ th: 'hook', v: 'lead', vol: 0.125, oct: 12, send: 0.30 },
          { th: 'anthem', v: 'brass', vol: 0.085, oct: -12, send: 0.30 },
          { th: 'badtime', v: 'chip', vol: 0.05, oct: -12, send: 0.18 },
          { th: 'obby', v: 'bell', vol: 0.04, oct: 12, off: 8, send: 0.6 }],
    extra: ['................', '..k.......k.....', '............c...', '..k...c...k...c.',
            '......b.........', '..k.......k...c.'] },

  { name: 'burnUp', bar0: 212, bars: 4, key: 2,          /* up a whole tone */
    kick: 'X..X..X.X..X..X.', snare: '....X...x...X..x',
    clap: '....X...X...X..X', hat: 'xxxxxxxxxxxxxxxx',
    bass: ['A1', 'A1', 0, 'A1', 'C2', 0, 'A1', 0, 'A1', 'A1', 0, 'G2', 'F2', 0, 'E2', 0],
    chords: ['Am', 'F', 'E', 'Am'],
    stab: 'x.x.x.x.x.x.x.x.', open: 3, arp: 1, dist: 1, pad: 0.85,
    mel: [{ th: 'hook', v: 'lead', vol: 0.150, oct: 12, send: 0.30 },
          { th: 'hook', v: 'chip', vol: 0.055, oct: 24, send: 0.35 },
          { th: 'anthem', v: 'brass', vol: 0.105, send: 0.32 },
          { th: 'anthem', v: 'choir', vol: 0.060, oct: 12, send: 0.7 },
          { th: 'machine', v: 'clav', vol: 0.050, oct: -12, send: 0.15 },
          { th: 'badtime', v: 'chip', vol: 0.045, oct: -12, send: 0.18 }],
    extra: ['c...c...c...c...', '..k...c...k...c.', 't...t...t...t...', '..k...k...k...k.'] },

  { name: 'outro', bar0: 216, bars: 4, key: 4,           /* and up again */
    kick: 'X.......X.......', snare: '................',
    clap: '................', hat: '................',
    bass: ['A1', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    chords: ['Am', 'Am', 'Am', 'Am'], stab: 'x...............', open: 0, pad: 0.9,
    mel: [{ th: 'hook', v: 'lead', vol: 0.135, send: 0.45 },
          { th: 'hook', v: 'choir', vol: 0.075, oct: 12, send: 0.80 },
          { th: 'hook', v: 'bell', vol: 0.055, oct: 24, send: 0.85 }],
    extra: ['................', '................', '........h.......', '....h...h...h...'] },

  /* =====================================================================
     BONUS — he goes home.  Everything drops away to almost nothing, gets
     sweet for as long as the lie holds, and then comes apart.
     ===================================================================== */

  { name: 'homeCard', bar0: 220, bars: 2, key: 0,      /* black, one bell */
    kick: '................', snare: '................',
    clap: '................', hat: '................',
    bass: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    chords: ['Am', 'Am'], stab: '................', open: 0, pad: 0.35,
    mel: [{ th: 'tease', v: 'box', vol: 0.085, oct: 12, send: 0.85 }],
    extra: ['................', '................'] },

  { name: 'porch', bar0: 222, bars: 5, key: 0,         /* crickets and a key */
    kick: 'X...............', snare: '................',
    clap: '................', hat: '..............h.',
    bass: ['A1', 0, 0, 0, 0, 0, 0, 0, 'E2', 0, 0, 0, 0, 0, 0, 0],
    chords: ['Am', 'F', 'C', 'G', 'Am'], stab: '................', open: 0, pad: 0.50,
    mel: [{ th: 'homing', v: 'box', vol: 0.075, send: 0.70 },
          { th: 'homing', v: 'pluck', vol: 0.045, oct: -12, send: 0.30 }],
    extra: ['................', '..........h.....', '................',
            '......h.........', '............h...'] },

  { name: 'hall', bar0: 227, bars: 4, key: 0,          /* the light comes on */
    kick: 'X.......X.......', snare: '............X...',
    clap: '................', hat: 'h...h...h...h...',
    bass: ['A1', 0, 0, 0, 'A1', 0, 0, 0, 'F2', 0, 0, 0, 'G2', 0, 0, 0],
    chords: ['Am', 'Am', 'F', 'G'], stab: '....x.......x...', open: 0, pad: 0.55,
    mel: [{ th: 'homing', v: 'pluck', vol: 0.075, send: 0.35 },
          { th: 'homing', v: 'bell', vol: 0.040, oct: 12, send: 0.75 }],
    extra: ['................', '..............h.', '................', '....h...h...h.h.'] },

  { name: 'reveal', bar0: 231, bars: 4, key: 0,        /* the door swings in */
    kick: 'X...X...X...X...', snare: '....X.......X...',
    clap: '................', hat: 'h.h.h.h.h.h.h.h.',
    bass: ['A1', 0, 0, 0, 'C2', 0, 0, 0, 'F2', 0, 0, 0, 'E2', 0, 0, 0],
    chords: ['Am', 'C', 'F', 'E'], stab: 'x...x...x...x...', open: 1, pad: 0.62,
    mel: [{ th: 'tease', v: 'bell', vol: 0.070, send: 0.65 },
          { th: 'creep', v: 'pluck', vol: 0.050, send: 0.25 }],
    extra: ['................', '........c.......', '................', 'c...............'] },

  { name: 'cute', bar0: 235, bars: 6, key: 0,          /* butter would not melt */
    kick: 'X.....X...X.....', snare: '....X.......X...',
    clap: '....x.......x...', hat: 'h.h.h.h.h.h.h.h.',
    bass: ['C2', 0, 0, 0, 'G2', 0, 0, 0, 'A1', 0, 0, 0, 'F2', 0, 0, 0],
    chords: ['C', 'G', 'Am', 'F', 'C', 'G'], stab: '..x...x...x...x.', open: 1, pad: 0.72,
    mel: [{ th: 'cute', v: 'box', vol: 0.095, send: 0.55 },
          { th: 'cute', v: 'bell', vol: 0.060, oct: 12, send: 0.70 },
          { th: 'cute', v: 'pluck', vol: 0.055, oct: -12, send: 0.20 },
          { th: 'homing', v: 'choir', vol: 0.032, send: 0.80 }],
    extra: ['....h...h...h...', '..h...h...h...h.', '....h...h...h...', '..h.h.h.h.h.h.h.',
            '....h...h...h...', '..h...h.h...h.h.'] },

  { name: 'approach', bar0: 241, bars: 4, key: 0,      /* he walks round the desk */
    kick: 'X.......X.......', snare: '................',
    clap: '................', hat: '................',
    bass: ['A1', 0, 0, 0, 0, 0, 0, 0, 'Bb1', 0, 0, 0, 0, 0, 0, 0],
    chords: ['Am', 'Am', 'Bb', 'Bdim'], stab: '................', open: 0, pad: 0.55,
    mel: [{ th: 'creep', v: 'clav', vol: 0.070, send: 0.20 },
          { th: 'creep', v: 'choir', vol: 0.038, oct: 12, send: 0.85 }],
    extra: ['................', '..............h.', '................', '............h.h.'] },

  { name: 'sting', bar0: 245, bars: 4, key: 0,         /* he reads it */
    kick: 'X...............', snare: '................',
    clap: '................', hat: '................',
    bass: ['A1', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    chords: ['Am', 'Bdim', 'Bdim', 'E'], stab: 'x...............', open: 0, dist: 1, pad: 0.80,
    mel: [{ th: 'dread', v: 'brass', vol: 0.110, send: 0.45 },
          { th: 'dread', v: 'choir', vol: 0.070, oct: -12, send: 0.85 },
          { th: 'dread', v: 'lead', vol: 0.055, oct: 12, send: 0.40 }],
    extra: ['c...............', '................', '................', 'c...c...c...c...'] },

  { name: 'rage', bar0: 249, bars: 4, key: 0,          /* and comes apart */
    kick: 'XX.XX.XX.XX.XX.X', snare: '....X...X...X..X',
    clap: '....X.......X...', hat: 'xxxxxxxxxxxxxxxx',
    bass: ['A1', 'A1', 0, 'A1', 'A1', 0, 'A1', 0, 'Bb1', 'Bb1', 0, 'Bb1', 'B1', 0, 'C2', 0],
    chords: ['Am', 'Am', 'Bb', 'Bdim'], stab: 'x.x.x.x.x.x.x.x.', open: 2, arp: 1, dist: 1, pad: 0.85,
    mel: [{ th: 'dread', v: 'lead', vol: 0.120, send: 0.30 },
          { th: 'machine', v: 'clav', vol: 0.070, oct: -12, send: 0.15 },
          { th: 'badtime', v: 'chip', vol: 0.050, oct: 12, send: 0.25 }],
    extra: ['c...c...c...c...', '..k...k...k...k.', 'c...c...c...c...', 'ttttcccc........'] },

  { name: 'grab', bar0: 253, bars: 5, key: 0,          /* GIVE BACK MY BOOK */
    kick: 'X..X..X.X..X..X.', snare: '....X...x...X..x',
    clap: '....X...X...X..X', hat: 'xxxxxxxxxxxxxxxx',
    bass: ['A1', 'A1', 0, 'A1', 'C2', 0, 'A1', 0, 'A1', 'A1', 0, 'G2', 'F2', 0, 'E2', 0],
    chords: ['Am', 'F', 'G', 'E', 'Am'], stab: 'x.x.x.x.x.x.x.x.', open: 3, arp: 1, dist: 1, pad: 0.88,
    mel: [{ th: 'hook', v: 'lead', vol: 0.145, send: 0.30 },
          { th: 'hook', v: 'chip', vol: 0.055, oct: 12, send: 0.30 },
          { th: 'cute', v: 'box', vol: 0.055, oct: 12, send: 0.60 },
          { th: 'anthem', v: 'brass', vol: 0.085, send: 0.30 }],
    extra: ['c...c...c...c...', '..k...c...k...c.', 'c...c...c...c...',
            '..k...k...k...k.', 'c...c...c...c...'] },

  { name: 'bonusEnd', bar0: 258, bars: 4, key: 2,      /* tag, and out */
    kick: 'X.......X.......', snare: '................',
    clap: '................', hat: '................',
    bass: ['A1', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    chords: ['Am', 'Am', 'Am', 'Am'], stab: 'x...............', open: 0, pad: 0.9,
    mel: [{ th: 'cute', v: 'box', vol: 0.090, send: 0.75 },
          { th: 'hook', v: 'choir', vol: 0.070, oct: 12, send: 0.85 },
          { th: 'hook', v: 'bell', vol: 0.050, oct: 24, send: 0.85 }],
    extra: ['................', '................', '........h.......', '....h...h...h...'] }
];

function sectionAt(bar) {
  for (let i = SECTIONS.length - 1; i >= 0; i--) if (bar >= SECTIONS[i].bar0) return SECTIONS[i];
  return SECTIONS[0];
}

/* seven fills, walked by phrase on a ten-long cycle so the pattern never
   lines up with the four-bar grid — no two phrases in the song end alike */
const FILL_ORDER = [0, 2, 4, 1, 5, 3, 6, 2, 0, 5];

/* =========================================================================
   The rock chart.  Same bars, same chords — a drummer instead of a machine.
   `k` kick · `s` snare · `h` hat (H = open) · `r` ride (R = bell)
   `c` crash · `n` china · `t` toms (0-3 by position)
   ========================================================================= */
const ROCKPAT = {
  intro:      { k: 'X.......X.......', s: '................', h: '................',
                r: 'R...r...R...r...', c: 'c...............' },
  verse:      { k: 'X..x..X...x..X..', s: '....X.......X...', h: 'x.x.x.x.x.x.x.H.',
                c: 'c...............' },
  pre:        { k: 'X...X...X...X...', s: 'ROLL',            h: 'xxxxxxxxxxxxxxxx' },
  chorus:     { k: 'X..X..X.X..X..X.', s: '....X.......X...', h: '................',
                r: 'r.r.r.r.r.r.r.r.', c: 'c.......c.......' },
  break:      { k: 'X.....x...X.....', s: '....X.......X...', h: 'x.xxx.xxx.xxx.xx',
                c: 'c...............' },
  machines:   { k: 'XXXXXXXXXXXXXXXX', s: '....X.......X...', h: '................',
                r: 'r.r.r.r.r.r.r.r.', n: 'n.......n.......' },
  obby:       { k: 'X...X...X...X...', s: '....X.......X...', h: 'x.x.x.x.x.x.x.H.',
                c: 'c...............' },
  sniper:     { k: 'X...............', s: '................', h: '................',
                t: '...............3' },
  csgo:       { k: 'X...X...X...X...', s: 'x.x.X.x.x.x.X.x.', h: '................',
                r: 'r...r...r...r...', c: 'c...............' },
  sans:       { k: 'X.X.X.X.X.X.X.X.', s: '.X.X.X.X.X.X.X.X', h: 'xxxxxxxxxxxxxxxx',
                n: 'n...............' },
  huggy:      { k: '................', s: '................', h: '................' },
  cane:       { k: 'X...x...X...x...', s: 'x.x.x.x.x.x.x.x.', h: '................',
                t: '..............2.' },
  cup:        { k: 'X...X...X...X...', s: '....X.......X...', h: '................',
                r: 'R.r.R.r.R.r.R.r.', c: 'c.......c.......', t: '0.1.............' },
  sgschool:   { k: 'X..x..X...x..X..', s: '....X.......X...', h: 'x.x.x.x.x.x.x.H.' },
  tsb:        { k: 'X..XX...X..XX..X', s: '....X.......X...', h: '................',
                r: 'r.r.r.r.r.r.r.r.', n: 'n.......n.......' },
  naoyaStill: { k: 'X...............', s: '................', h: '................',
                n: 'n...............', t: '..............3.' },
  naoyaFight: { k: 'XXXXXXXXXXXXXXXX', s: '.X.X.X.X.X.X.X.X', h: '................',
                n: 'n.......n.......', c: 'c...............' },
  homeCard:   { k: '................', s: '................', h: '................',
                c: 'c...............' },
  porch:      { k: 'X.......X.......', s: '................', h: '..............H.',
                r: 'r.......r.......' },
  hall:       { k: 'X.......X.......', s: '....X.......X...', h: 'x.x.x.x.x.x.x.H.',
                c: 'c...............' },
  reveal:     { k: 'X...X...X...X...', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.',
                r: 'r...r...r...r...', c: 'c.......c.......' },
  cute:       { k: 'X.....X...X.....', s: '....X.......X...', h: 'x.x.x.x.x.x.x.H.',
                r: '..r...r...r...r.', c: 'c...............' },
  approach:   { k: 'X.......X.......', s: '................', h: '................',
                r: 'r.r.r.r.r.r.r.r.', t: '..............3.' },
  sting:      { k: 'X...............', s: 'ROLL',            h: '................',
                n: 'n...............', c: 'c.......c.......' },
  rage:       { k: 'XXXXXXXXXXXXXXXX', s: '....X...X...X..X', h: '................',
                c: 'c...c...c...c...', n: '........n.......', t: '0123....0.1.2.3.' },
  grab:       { k: 'X..X..X.X..X..X.', s: '....X...x...X..x', h: '................',
                r: 'R.R.R.R.R.R.R.R.', c: 'c...c...c...c...', n: '........n.......' },
  bonusEnd:   { k: 'X.......X.......', s: '....X.......X...', h: '................',
                r: 'R...R...R...R...', c: 'c...............' },
  naoyaFinish:{ k: 'X.......X.......', s: '....X.......X...', h: '................',
                r: 'R...R...R...R...', c: 'c...c...c...c...', t: '..0...1...2...3.' },
  bridge:     { k: 'X...............', s: '................', h: '................',
                c: 'c...............' },
  burn:       { k: 'XX.XXX.XXX.XXX.X', s: '....X.......X...', h: 'xxxxxxxxxxxxxxxx',
                n: 'n.......n.......' },
  burnUp:     { k: 'XXXXXXXXXXXXXXXX', s: '....X.......X...', h: '................',
                c: 'c...c...c...c...', n: '........n.......' },
  outro:      { k: 'X...............', s: '................', h: '................',
                c: 'c...............', t: '........3.......' }
};

/* =========================================================================
   The engine
   ========================================================================= */
const DJAudio = {
  running: false, next: 0, step: 0, timer: null, gain: null, bus: null,
  wet: null, dly: null, t0: 0, padUntil: -1,

  start() {
    if (!Audio1.ready || this.running) return;
    const ctx = Audio1.ctx;
    this.running = true;

    this.gain = ctx.createGain(); this.gain.gain.value = 0.85;
    this.gain.connect(Audio1.master);
    this.bus = ctx.createDynamicsCompressor();
    this.bus.threshold.value = -15; this.bus.ratio.value = 3.0;
    this.bus.attack.value = 0.004; this.bus.release.value = 0.16;
    this.bus.connect(this.gain);

    /* a plate, so the melodies sit in a room instead of on a table */
    const rate = ctx.sampleRate, len = Math.floor(rate * 2.4);
    const ir = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const e = Math.pow(1 - i / len, 2.8);
        d[i] = (Math.random() * 2 - 1) * e * (i < rate * 0.01 ? i / (rate * 0.01) : 1);
      }
    }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    const wetOut = ctx.createGain(); wetOut.gain.value = 0.9;
    conv.connect(wetOut); wetOut.connect(this.bus);
    this.wet = ctx.createGain(); this.wet.gain.value = 1.0;
    this.wet.connect(conv);

    /* a dotted-eighth delay for the leads */
    const dl = ctx.createDelay(1.5); dl.delayTime.value = BEAT * 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const df = ctx.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 2600;
    dl.connect(df); df.connect(fb); fb.connect(dl);
    const dOut = ctx.createGain(); dOut.gain.value = 0.5;
    df.connect(dOut); dOut.connect(this.bus);
    this.dly = ctx.createGain(); this.dly.gain.value = 1.0;
    this.dly.connect(dl);

    /* --- the guitar rig: a distortion stage into a cabinet --- */
    const ws = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = i / 512 - 1;
      curve[i] = Math.tanh(x * 5.2) * 0.92;          /* soft-clipped, not fizzy */
    }
    ws.curve = curve; ws.oversample = '2x';
    const cabLo = ctx.createBiquadFilter(); cabLo.type = 'lowpass';
    cabLo.frequency.value = 4200; cabLo.Q.value = 0.9;
    const cabHi = ctx.createBiquadFilter(); cabHi.type = 'highpass';
    cabHi.frequency.value = 95;
    const cabMid = ctx.createBiquadFilter(); cabMid.type = 'peaking';
    cabMid.frequency.value = 2400; cabMid.Q.value = 1.1; cabMid.gain.value = 4;
    const cabOut = ctx.createGain(); cabOut.gain.value = 0.9;
    ws.connect(cabLo); cabLo.connect(cabMid); cabMid.connect(cabHi);
    cabHi.connect(cabOut); cabOut.connect(this.bus);
    this.amp = ws;
    this.style = (typeof G !== 'undefined' && G.musicStyle) || 'orig';

    this.next = ctx.currentTime + 0.10;
    this.t0 = this.next;
    this.step = 0; this.padUntil = -1; this.dropped = 0;
    this.timer = setInterval(() => this.pump(), 25);
  },

  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    try {
      if (this.bus) this.bus.disconnect();
      if (this.gain) this.gain.disconnect();
      if (this.amp) this.amp.disconnect();
      if (this.wet) this.wet.disconnect();
      if (this.dly) this.dly.disconnect();
    } catch (e) {}
    this.bus = null; this.gain = null; this.wet = null; this.dly = null; this.amp = null;
  },

  pump() {
    if (!this.running) return;
    const ctx = Audio1.ctx;
    /* A long frame (building a set-piece, first compile of a shader) can park
       the main thread past notes we had not scheduled yet.  Firing them now
       would machine-gun a whole bar into one instant AND put the sound behind
       the picture, so late notes are dropped instead: the step counter still
       advances, which is what keeps the bar in step with the audio clock. */
    let late = 0;
    while (this.next < ctx.currentTime - 0.012) {
      this.next += BEAT / 4; this.step++; late++;
      if (late > 96) { this.next = ctx.currentTime; break; }
    }
    this.dropped = (this.dropped || 0) + late;
    while (this.next < ctx.currentTime + 0.20) {
      this.hit(this.step, this.next);
      this.next += BEAT / 4;
      this.step++;
    }
  },

  /* --------------------------------------------------------------- drums */
  noise(t, dur, type, freq, vol, q) {
    const ctx = Audio1.ctx;
    const s = ctx.createBufferSource(); s.buffer = Audio1.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    if (q) f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.bus);
    s.start(t); s.stop(t + dur + 0.02);
  },
  kick(t, vol, dist) {
    const ctx = Audio1.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(dist ? 190 : 155, t);
    o.frequency.exponentialRampToValueAtTime(dist ? 34 : 40, t + (dist ? 0.10 : 0.15));
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dist ? 0.20 : 0.28));
    let last = g;
    if (dist) {
      const ws = ctx.createWaveShaper();
      const cv2 = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = i / 128 - 1; cv2[i] = Math.tanh(x * 3.2); }
      ws.curve = cv2; g.connect(ws); last = ws;
    }
    o.connect(g); last.connect(this.bus);
    o.start(t); o.stop(t + 0.32);
    this.noise(t, 0.026, 'lowpass', 1100, vol * 0.45);
  },
  snare(t, vol) {
    const ctx = Audio1.ctx;
    this.noise(t, 0.14, 'highpass', 1100, vol * 0.85);
    const g2 = ctx.createGain(); g2.gain.value = vol * 0.5;
    g2.connect(this.wet || this.bus);
    const s2 = ctx.createBufferSource(); s2.buffer = Audio1.noiseBuf;
    const f2 = ctx.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = 1800;
    const e2 = ctx.createGain();
    e2.gain.setValueAtTime(vol * 0.4, t);
    e2.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);
    s2.connect(f2); f2.connect(e2); e2.connect(this.wet || this.bus);
    s2.start(t); s2.stop(t + 0.12);
    for (const [fr, vv] of [[186, 0.5], [263, 0.28]]) {
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(fr, t);
      o.frequency.exponentialRampToValueAtTime(fr * 0.68, t + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol * vv, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 0.15);
    }
  },
  clap(t, vol) {
    for (let k = 0; k < 4; k++)
      this.noise(t + k * 0.010, 0.11, 'bandpass', 1500, vol * (k === 3 ? 1 : 0.5), 1.2);
    const ctx = Audio1.ctx;
    const s = ctx.createBufferSource(); s.buffer = Audio1.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.5, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    s.connect(f); f.connect(g); g.connect(this.wet || this.bus);
    s.start(t); s.stop(t + 0.30);
  },
  hat(t, vol, open) { this.noise(t, open ? 0.20 : 0.032, 'highpass', 7600, vol); },
  tom(t, f, vol) {
    const ctx = Audio1.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.58, t + 0.24);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 0.30);
    this.noise(t, 0.06, 'bandpass', f * 4, vol * 0.22, 1.5);
  },
  crash(t, vol) {
    this.noise(t, 1.8, 'highpass', 2400, vol || 0.14);
    const ctx = Audio1.ctx;
    const s = ctx.createBufferSource(); s.buffer = Audio1.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000;
    const g = ctx.createGain();
    g.gain.setValueAtTime((vol || 0.14) * 0.7, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    s.connect(f); f.connect(g); g.connect(this.wet || this.bus);
    s.start(t); s.stop(t + 2.3);
  },
  ride(t, vol) { this.noise(t, 0.30, 'bandpass', 5400, vol, 0.8); },

  /* ---------------------------------------------------------------- bass */
  sub(t, f, dur, vol) {
    const ctx = Audio1.ctx;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = f;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 9, t);
    lp.frequency.exponentialRampToValueAtTime(f * 2.4, t + dur * 0.8);
    lp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.setValueAtTime(vol, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o.connect(g); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + dur + 0.02);
    o2.start(t); o2.stop(t + dur + 0.02);
  },

  /* ------------------------------------------------------------- voices */
  /* =====================================================================
     THE ROCK KIT
     Everything below is the second band. Same patterns, same score, played
     on an acoustic kit with two bass drums and a wall of guitars.
     ===================================================================== */

  /* a struck drum: a pitched body that drops, plus a noise skin */
  drum(t, f0, f1, dur, vol, noiseHz, noiseAmt, q) {
    const ctx = Audio1.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.55);
    const o2 = ctx.createOscillator(); o2.type = 'triangle';
    o2.frequency.setValueAtTime(f0 * 1.48, t);
    o2.frequency.exponentialRampToValueAtTime(f1 * 1.4, t + dur * 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.34;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + dur + 0.02);
    o2.start(t); o2.stop(t + dur + 0.02);
    if (noiseAmt) this.noise(t, dur * 0.55, 'bandpass', noiseHz, noiseAmt, q || 1.1);
  },

  /* a metallic cymbal: six inharmonic squares through a bright filter */
  metal(t, base, dur, vol, hp, band) {
    const ctx = Audio1.ctx;
    const hpF = ctx.createBiquadFilter(); hpF.type = 'highpass'; hpF.frequency.value = hp || 7000;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = band || 9000; bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    hpF.connect(bp); bp.connect(g); g.connect(this.bus);
    this.send(g, 0.22);
    for (const r of [1, 1.342, 1.2312, 1.6532, 1.9523, 2.1523]) {
      const o = ctx.createOscillator(); o.type = 'square';
      o.frequency.value = base * r;
      o.connect(hpF); o.start(t); o.stop(t + dur + 0.02);
    }
  },

  rKick(t, vol) {
    /* beater click, then a short fat body — a real 22-inch, close-miked */
    const ctx = Audio1.ctx;
    this.noise(t, 0.012, 'highpass', 2600, (vol || 0.4) * 0.75);
    this.drum(t, 118, 41, 0.19, (vol || 0.4) * 1.15, 320, (vol || 0.4) * 0.16, 1.4);
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 46;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime((vol || 0.4) * 0.5, t);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    sub.connect(sg); sg.connect(this.bus); sub.start(t); sub.stop(t + 0.15);
  },
  rSnare(t, vol) {
    /* body, wires and crack */
    this.drum(t, 210, 168, 0.13, (vol || 0.25) * 0.55, 420, 0, 1);
    this.noise(t, 0.017, 'highpass', 3200, (vol || 0.25) * 1.25);        // the crack
    this.noise(t, 0.20, 'highpass', 1500, (vol || 0.25) * 0.80);         // the wires
    this.noise(t, 0.10, 'bandpass', 480, (vol || 0.25) * 0.45, 1.4);     // the shell
    const g2 = Audio1.ctx.createGain(); g2.gain.value = (vol || 0.25) * 0.5;
    this.send(g2, 0.30);
  },
  rTom(t, i, vol) {
    /* 0 rack hi · 1 rack lo · 2 floor · 3 big floor */
    const F = [[250, 150], [196, 118], [148, 90], [112, 66]][clamp(i, 0, 3)];
    this.drum(t, F[0], F[1], 0.44 + i * 0.09, (vol || 0.24) * 1.1, F[0] * 3, (vol || 0.24) * 0.14, 1.2);
  },
  rHat(t, vol, open) {
    this.metal(t, 420, open ? 0.34 : 0.045, (vol || 0.07) * (open ? 1.1 : 1), 8200, 11000);
  },
  rRide(t, vol, bell) {
    if (bell) this.metal(t, 560, 0.55, (vol || 0.08) * 1.3, 5200, 6200);
    else { this.metal(t, 340, 0.42, (vol || 0.06) * 0.75, 7600, 9500); }
  },
  rCrash(t, vol) { this.metal(t, 300, 2.2, (vol || 0.12), 4200, 7000); },
  rChina(t, vol) { this.metal(t, 250, 1.5, (vol || 0.13) * 1.1, 3000, 5200); },
  rSplash(t, vol) { this.metal(t, 620, 0.7, (vol || 0.09), 6800, 9000); },

  /* --- the guitars --- */
  /* one palm-muted chug: root + fifth + octave, very short */
  chug(t, midiRoot, dur, vol) {
    const ctx = Audio1.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(5200, t);
    lp.frequency.exponentialRampToValueAtTime(1500, t + dur);
    g.connect(lp); lp.connect(this.amp || this.bus);
    for (const iv of [0, 7, 12]) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = hz(midiRoot + iv); o.detune.value = det;
        o.connect(g); o.start(t); o.stop(t + dur + 0.03);
      }
    }
  },
  /* a held power chord, for choruses */
  power(t, midiRoot, dur, vol) {
    const ctx = Audio1.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.setValueAtTime(vol, t + dur * 0.72);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.amp || this.bus);
    this.send(g, 0.18);
    for (const iv of [0, 7, 12, 19]) {
      for (const det of [-9, 9]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = hz(midiRoot + iv); o.detune.value = det;
        o.connect(g); o.start(t); o.stop(t + dur + 0.05);
      }
    }
  },
  /* a single distorted note with vibrato — the lead */
  gtrLead(t, f, dur, vol, sendAmt) {
    const ctx = Audio1.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.018);
    g.gain.setValueAtTime(vol, t + Math.max(0.05, dur * 0.8));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.10);
    g.connect(this.amp || this.bus);
    this.send(g, sendAmt === undefined ? 0.3 : sendAmt);
    const vib = ctx.createOscillator(); vib.type = 'sine'; vib.frequency.value = 5.5;
    const vg = ctx.createGain(); vg.gain.value = 7;
    vib.connect(vg); vib.start(t); vib.stop(t + dur + 0.12);
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = f; o.detune.value = det;
      vg.connect(o.detune);
      o.connect(g); o.start(t); o.stop(t + dur + 0.12);
    }
  },
  /* a clean note, for the quiet sections */
  gtrClean(t, f, dur, vol, sendAmt) {
    const ctx = Audio1.ctx;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(Math.min(6000, f * 7), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.8), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.14);
    lp.connect(g); g.connect(this.bus);
    this.send(g, sendAmt === undefined ? 0.4 : sendAmt);
    for (const [ty, m, v] of [['triangle', 1, 1], ['sawtooth', 1, 0.35], ['sine', 2, 0.18]]) {
      const o = ctx.createOscillator(); o.type = ty; o.frequency.value = f * m;
      const og = ctx.createGain(); og.gain.value = v;
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.16);
    }
  },
  /* a pinch-harmonic squeal, for accents */
  squeal(t, f, dur, vol) {
    const ctx = Audio1.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.amp || this.bus);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 3.98, t);
    o.frequency.linearRampToValueAtTime(f * 4.12, t + dur);
    o.connect(g); o.start(t); o.stop(t + dur + 0.04);
  },
  /* the bass, played with a pick and a bit too much gain */
  rBass(t, f, dur, vol) {
    const ctx = Audio1.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    g.connect(lp); lp.connect(this.bus);
    for (const [ty, m, v] of [['sawtooth', 1, 0.62], ['square', 1, 0.30], ['sine', 0.5, 0.85]]) {
      const o = ctx.createOscillator(); o.type = ty; o.frequency.value = f * m;
      const og = ctx.createGain(); og.gain.value = v;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.06);
    }
    this.noise(t, 0.012, 'highpass', 1800, vol * 0.35);          // pick attack
  },

  send(node, amt) {
    if (!amt || !this.wet) return;
    const g = Audio1.ctx.createGain(); g.gain.value = amt;
    node.connect(g); g.connect(this.wet);
  },
  voice(name, t, f, dur, vol, sendAmt) {
    const ctx = Audio1.ctx;
    const out = ctx.createGain(); out.gain.value = 1;
    out.connect(this.bus);
    this.send(out, sendAmt);
    const env = ctx.createGain();
    env.connect(out);

    if (name === 'lead') {
      /* three detuned saws through a resonant sweep, plus the delay send */
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 5;
      lp.frequency.setValueAtTime(Math.min(9000, f * 8), t);
      lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2.6), t + dur * 0.9);
      lp.connect(env);
      for (const d of [-9, 0, 9]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = f; o.detune.value = d;
        o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
      }
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(vol, t + 0.012);
      env.gain.setValueAtTime(vol, t + dur * 0.7);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
      if (this.dly) { const dg = ctx.createGain(); dg.gain.value = 0.28; out.connect(dg); dg.connect(this.dly); }

    } else if (name === 'brass') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.4;
      lp.frequency.setValueAtTime(f * 1.6, t);
      lp.frequency.linearRampToValueAtTime(Math.min(7000, f * 6), t + 0.10);
      lp.frequency.linearRampToValueAtTime(f * 3, t + dur);
      lp.connect(env);
      for (const [ty, d] of [['sawtooth', -6], ['sawtooth', 6], ['square', 0]]) {
        const o = ctx.createOscillator(); o.type = ty;
        o.frequency.value = f; o.detune.value = d;
        const og = ctx.createGain(); og.gain.value = ty === 'square' ? 0.35 : 1;
        o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.05);
      }
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(vol, t + 0.045);
      env.gain.setValueAtTime(vol, t + dur * 0.75);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);

    } else if (name === 'chip') {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = 'square';
      o2.frequency.value = f; o2.detune.value = 8;
      const g2 = ctx.createGain(); g2.gain.value = 0.5;
      o.connect(env); o2.connect(g2); g2.connect(env);
      o.start(t); o.stop(t + dur + 0.02); o2.start(t); o2.stop(t + dur + 0.02);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(vol, t + 0.006);
      env.gain.setValueAtTime(vol * 0.75, t + Math.min(dur * 0.5, 0.09));
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    } else if (name === 'clav') {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = f * 3.2; bp.Q.value = 3.2; bp.connect(env);
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
      o.connect(bp); o.start(t); o.stop(t + dur + 0.02);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(vol, t + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(dur, 0.20));

    } else if (name === 'pluck') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
      lp.frequency.setValueAtTime(f * 7, t);
      lp.frequency.exponentialRampToValueAtTime(f * 1.4, t + 0.22);
      lp.connect(env);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth';
      o2.frequency.value = f; o2.detune.value = 5;
      const g2 = ctx.createGain(); g2.gain.value = 0.4;
      o.connect(lp); o2.connect(g2); g2.connect(lp);
      o.start(t); o.stop(t + dur + 0.02); o2.start(t); o2.stop(t + dur + 0.02);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(vol, t + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(dur + 0.1, 0.7));

    } else if (name === 'bell' || name === 'box') {
      /* two inharmonic sines — a glass bell, or a music box if it is short */
      const ratios = name === 'box' ? [1, 2.76, 5.4] : [1, 2.0, 3.01];
      const decay = name === 'box' ? 0.9 : Math.min(dur + 0.9, 2.2);
      ratios.forEach((r, i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * r;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol / (i + 1.4), t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + decay / (i * 0.6 + 1));
        o.connect(g); g.connect(out);
        o.start(t); o.stop(t + decay + 0.05);
      });
      if (this.dly) { const dg = ctx.createGain(); dg.gain.value = 0.2; out.connect(dg); dg.connect(this.dly); }
      return;

    } else {                                   /* choir / pad */
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.value = Math.min(4200, f * 5); lp.Q.value = 0.7;
      lp.connect(env);
      for (const d of [-7, 0, 7]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = f; o.detune.value = d;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 4.8 + d * 0.05;
        const lg = ctx.createGain(); lg.gain.value = 4.5;
        lfo.connect(lg); lg.connect(o.detune);
        lfo.start(t); lfo.stop(t + dur + 0.3);
        o.connect(lp); o.start(t); o.stop(t + dur + 0.3);
      }
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(vol, t + Math.min(0.28, dur * 0.4));
      env.gain.setValueAtTime(vol, t + dur * 0.8);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
    }
  },

  /* a sustained chord bed */
  pad(t, notes, dur, vol) {
    const ctx = Audio1.ctx;
    const out = ctx.createGain(); out.gain.value = 1; out.connect(this.bus);
    this.send(out, 0.7);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.linearRampToValueAtTime(2100, t + dur * 0.5);
    lp.frequency.linearRampToValueAtTime(800, t + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(vol, t + dur * 0.30);
    env.gain.setValueAtTime(vol, t + dur * 0.72);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
    lp.connect(env); env.connect(out);
    for (const m of notes) for (const d of [-6, 6]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = hz(m); o.detune.value = d;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.25);
    }
  },

  /* a short plucked chord */
  stab(t, notes, vol, dur) {
    const ctx = Audio1.ctx;
    const out = ctx.createGain(); out.connect(this.bus);
    this.send(out, 0.30);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 7;
    f.frequency.setValueAtTime(4200, t);
    f.frequency.exponentialRampToValueAtTime(560, t + (dur || 0.18));
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.18));
    f.connect(g); g.connect(out);
    for (const m of notes) for (const det of [-5, 5]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = hz(m); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + (dur || 0.18) + 0.03);
    }
  },

  /* -------------------------------------------------------- one-shots */
  blip(t, f, vol, dur, type) {
    const ctx = Audio1.ctx;
    const o = ctx.createOscillator(); o.type = type || 'square'; o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12));
    o.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + (dur || 0.12) + 0.02);
  },
  scratch(t, up) {
    const ctx = Audio1.ctx;
    const s2 = ctx.createBufferSource(); s2.buffer = Audio1.noiseBuf;
    s2.playbackRate.setValueAtTime(up ? 0.6 : 1.8, t);
    s2.playbackRate.linearRampToValueAtTime(up ? 2.2 : 0.5, t + 0.16);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = 1600; f.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.10, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    s2.connect(f); f.connect(g); g.connect(this.bus);
    s2.start(t); s2.stop(t + 0.20);
  },
  crackle(t) { this.noise(t, 0.02, 'highpass', 4200, 0.012); },
  clank(t, f) {
    const ctx = Audio1.ctx;
    this.noise(t, 0.10, 'bandpass', f || 2600, 0.09, 3);
    for (const m of [1, 1.51, 2.37]) {
      const o = ctx.createOscillator(); o.type = 'square';
      o.frequency.value = (f || 2600) * 0.42 * m;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.030 / m, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45 / m);
      o.connect(g); g.connect(this.bus);
      o.start(t); o.stop(t + 0.5);
    }
  },
  chime(t, f) {
    this.blip(t, f, 0.045, 0.07, 'square');
    this.blip(t + 0.06, f * 1.5, 0.045, 0.16, 'square');
  },
  oof() {
    if (!Audio1.ready || !this.bus) return;
    const ctx = Audio1.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(96, t + 0.30);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.30); f.Q.value = 4.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.26, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    o.connect(f); f.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + 0.40);
  },

  /* =================================================== the arrangement */
  hit(i, t) {
    const bar = Math.floor(i / 16), b = i % 16;
    const S = sectionAt(bar);
    const key = S.key || 0;
    const barIn = bar - S.bar0;
    const phrase = bar % 4;
    const fill = phrase === 3 || barIn === S.bars - 1;

    /* ================= the rock band plays a different chart ============= */
    if (this.style === 'rock') { this.rockHit(S, bar, barIn, b, t, key, fill); return; }

    /* ---- drums ---- */
    const kc = S.kick[b];
    if (kc !== '.' && !(fill && b >= 12 && S.name !== 'intro')) {
      this.kick(t, kc === 'X' ? 0.44 : 0.30, S.dist);
    }
    if (S.snare === 'ROLL') {
      const dense = barIn >= 2;
      if (dense || b % 2 === 0) {
        const ramp = (barIn * 16 + b) / (S.bars * 16);
        this.snare(t, 0.06 + ramp * 0.30);
        if (dense && barIn === 3 && b >= 8) this.snare(t + BEAT / 8, 0.10 + ramp * 0.30);
      }
    } else if (S.snare[b] !== '.') {
      this.snare(t, S.snare[b] === 'X' ? 0.22 : 0.12);
    }
    if (S.clap[b] !== '.') this.clap(t, S.clap[b] === 'X' ? 0.18 : 0.10);
    if (S.hat[b] !== '.') {
      const acc = S.hat[b] === 'X';
      this.hat(t, (acc ? 0.085 : 0.05) * (b % 4 === 2 ? 1.15 : 1), false);
    }
    if (S.open === 1 && b === 14) this.hat(t, 0.075, true);
    if (S.open === 2 && (b === 6 || b === 14)) this.hat(t, 0.085, true);
    if (S.open === 3 && b % 4 === 2) this.hat(t, 0.055, true);
    if (S.name === 'chorus' && b % 2 === 1) this.ride(t, 0.018);

    if (fill && b >= 12) {
      const kind = FILL_ORDER[Math.floor(bar / 4) % FILL_ORDER.length];
      const k = b - 12;
      if (kind === 0) this.tom(t, [320, 250, 190, 150][k], 0.22);
      else if (kind === 1) { this.snare(t, 0.16 + k * 0.05); this.snare(t + BEAT / 6, 0.13 + k * 0.05); }
      else if (kind === 2) {
        this.hat(t, 0.08, false); this.hat(t + BEAT / 8, 0.07, false);
        if (k === 3) this.clap(t + BEAT / 4, 0.22);
      } else if (kind === 3) {
        if (k === 0) this.noise(t, BEAT, 'highpass', 1800, 0.02);
        if (k === 3) this.kick(t, 0.5, S.dist);
      } else if (kind === 4) { this.snare(t, 0.10 + k * 0.06); this.snare(t + BEAT / 8, 0.10 + k * 0.06); }
      else if (kind === 5) {
        this.tom(t, [150, 190, 250, 330][k], 0.20);
        if (k === 3) this.crash(t + BEAT / 4, 0.13);
      } else if (k === 3) { this.kick(t, 0.5, S.dist); this.clap(t, 0.24); this.crash(t, 0.14); }
    }

    /* ---- per-bar wrinkles ---- */
    if (S.extra) {
      const ex = S.extra[barIn % S.extra.length][b];
      if (ex === 'k') this.kick(t, 0.24, S.dist);
      else if (ex === 's') this.snare(t, 0.09);
      else if (ex === 'c') this.clap(t, 0.10);
      else if (ex === 'h') this.hat(t, 0.055, false);
      else if (ex === 't') this.tom(t, 150 + ((bar + b) % 3) * 90, 0.16);
      else if (ex === 'w') this.scratch(t, (bar + b) % 2 === 0);
      else if (ex === 'm') this.clank(t, 1800 + ((bar * 7 + b) % 5) * 620);
      else if (ex === 'b') {
        const root = CHORD_ROOT[S.chords[barIn % S.chords.length]] || 33;
        this.sub(t, hz(root + 12 + key), BEAT / 2 * 0.8, 0.13);
      }
    }
    if (S.vinyl && b % 2 === 1) this.crackle(t);
    if (S.march && b % 4 === 0) this.tom(t, 190, 0.13);
    if (S.anthem && (b === 0 || b === 6 || b === 10)) {
      const ch2 = CHORD[S.chords[barIn % S.chords.length]] || CHORD.C;
      for (const m of ch2) this.blip(t, hz(m - 12 + key), 0.026, 0.42, 'sawtooth');
    }

    /* ---- bass ---- */
    const bn = S.bass[b];
    if (bn) {
      const root = CHORD_ROOT[S.chords[barIn % S.chords.length]] || 33;
      const base = bn === 'A1' ? root : midi(bn[0] + (bn[1] === '#' ? '#' : '') + bn.slice(-1));
      const dur = (S.name === 'burn' || S.name === 'burnUp' || S.name === 'sans')
        ? BEAT / 4 * 0.9 : BEAT / 2 * 0.9;
      this.sub(t, hz((bn === 'A1' ? root : base) + key), dur, 0.20);
    }

    /* ---- chords ---- */
    if (S.stab[b] !== '.') {
      const ch = CHORD[S.chords[barIn % S.chords.length]] || CHORD.Am;
      const short = S.name === 'burn' || S.name === 'burnUp';
      this.stab(t, ch.map(m => m + key), short ? 0.055 : 0.075, short ? 0.11 : 0.20);
    }
    if (S.pad && b === 0) {
      const ch = CHORD[S.chords[barIn % S.chords.length]] || CHORD.Am;
      this.pad(t, ch.map(m => m + key - 12), BAR * 0.95, 0.030 * S.pad);
    }

    /* ---- the melodies ---- */
    if (S.mel) {
      for (const L of S.mel) {
        if (L.from !== undefined && barIn < L.from) continue;
        if (L.every && barIn % L.every !== 0) continue;
        const th = THEMES[L.th];
        if (!th) continue;
        const off = L.off || 0;                    // shift in sixteenths
        const abs = barIn * 16 + b - off;
        if (abs < 0) continue;
        const nn = themeAt(th, Math.floor(abs / 16), abs % 16);
        if (!nn) continue;
        const dur = nn.steps * (BEAT / 4) * 0.96;
        this.voice(L.v, t, hz(nn.m + (L.oct || 0) + key), dur, L.vol, L.send);
      }
    }

    /* ---- section transitions ---- */
    if (b === 0 && barIn === 0) {
      if (['chorus', 'burn', 'cup', 'csgo'].indexOf(S.name) >= 0) this.impactAt(t);
      if (S.name === 'bridge' || S.name === 'huggy') this.noise(t, 2.4, 'lowpass', 500, 0.10);
      if (S.name === 'burnUp' || S.name === 'outro') { this.crash(t, 0.20); this.impactAt(t); }
    }
    if (b === 0 && (barIn === 0 || bar % 8 === 0)) this.crash(t, barIn === 0 ? 0.17 : 0.11);
    if (S.name === 'pre' && barIn === S.bars - 1 && b === 14) this.gapAt(t);
  },

  /* =====================================================================
     The same bar, played by the band
     ===================================================================== */
  rockHit(S, bar, barIn, b, t, key, fill) {
    const R = ROCKPAT[S.name] || ROCKPAT.verse;
    const heavy = ['machines', 'sans', 'tsb', 'naoyaFight', 'burn', 'burnUp'].indexOf(S.name) >= 0;

    /* ---- drums ---- */
    const kc = R.k[b];
    if (kc !== '.' && !(fill && b >= 12 && S.name !== 'intro')) {
      this.rKick(t, kc === 'X' ? 0.40 : 0.27);
    }
    if (R.s === 'ROLL') {
      const dense = barIn >= 2;
      if (dense || b % 2 === 0) {
        const ramp = (barIn * 16 + b) / (S.bars * 16);
        this.rSnare(t, 0.07 + ramp * 0.26);
        if (dense && barIn === 3 && b >= 8) this.rSnare(t + BEAT / 8, 0.10 + ramp * 0.26);
      }
    } else if (R.s[b] !== '.') {
      this.rSnare(t, R.s[b] === 'X' ? 0.26 : 0.11);
    }
    if (R.h && R.h[b] !== '.') this.rHat(t, R.h[b] === 'H' ? 0.075 : 0.055, R.h[b] === 'H');
    if (R.r && R.r[b] !== '.') this.rRide(t, 0.062, R.r[b] === 'R');
    if (R.c && R.c[b] !== '.' && barIn % 2 === 0) this.rCrash(t, 0.11);
    if (R.n && R.n[b] !== '.' && barIn % 2 === 0) this.rChina(t, 0.115);
    if (R.t && R.t[b] !== '.') this.rTom(t, parseInt(R.t[b], 10) || 0, 0.22);

    /* ---- fills: always toms, because it is that kind of band ---- */
    if (fill && b >= 12) {
      const kind = FILL_ORDER[Math.floor(bar / 4) % FILL_ORDER.length];
      const k2 = b - 12;
      if (kind === 0 || kind === 5) { this.rTom(t, 3 - k2, 0.28); }
      else if (kind === 1) { this.rSnare(t, 0.16 + k2 * 0.05); this.rSnare(t + BEAT / 6, 0.14 + k2 * 0.05); }
      else if (kind === 2) { this.rTom(t, k2 % 4, 0.24); this.rTom(t + BEAT / 8, (k2 + 2) % 4, 0.20); }
      else if (kind === 3) { if (k2 === 3) { this.rKick(t, 0.46); this.rCrash(t, 0.14); } }
      else if (kind === 4) { this.rSnare(t, 0.12 + k2 * 0.06); this.rSnare(t + BEAT / 8, 0.12 + k2 * 0.06); }
      else if (k2 === 3) { this.rKick(t, 0.46); this.rSnare(t, 0.26); this.rCrash(t, 0.15); }
    }
    if (b === 0 && (barIn === 0 || bar % 8 === 0)) this.rCrash(t, barIn === 0 ? 0.16 : 0.10);

    /* ---- per-bar wrinkles, translated for the kit ---- */
    if (S.extra) {
      const ex = S.extra[barIn % S.extra.length][b];
      if (ex === 'k') this.rKick(t, 0.24);
      else if (ex === 's') this.rSnare(t, 0.09);
      else if (ex === 'c') this.rSnare(t, 0.08);
      else if (ex === 'h') this.rHat(t, 0.05, false);
      else if (ex === 't') this.rTom(t, (bar + b) % 4, 0.18);
      else if (ex === 'w') this.rSplash(t, 0.07);
      else if (ex === 'm') this.rChina(t, 0.075);
      else if (ex === 'b') {
        const root = CHORD_ROOT[S.chords[barIn % S.chords.length]] || 33;
        this.rBass(t, hz(root + 12 + key), BEAT / 2 * 0.8, 0.15);
      }
    }

    /* ---- bass guitar ---- */
    const bn = S.bass[b];
    if (bn) {
      const root = CHORD_ROOT[S.chords[barIn % S.chords.length]] || 33;
      const base = bn === 'A1' ? root : midi(bn[0] + (bn[1] === '#' ? '#' : '') + bn.slice(-1));
      const dur = heavy ? BEAT / 4 * 0.95 : BEAT / 2 * 0.9;
      this.rBass(t, hz((bn === 'A1' ? root : base) + key), dur, 0.22);
    }

    /* ---- rhythm guitar: chug where the kick is, ring out where it is not ---- */
    const chRoot = (CHORD_ROOT[S.chords[barIn % S.chords.length]] || 33) + 12 + key;
    if (heavy) {
      if (kc !== '.') this.chug(t, chRoot, BEAT / 4 * 0.85, 0.052);
    } else if (S.stab[b] !== '.') {
      this.chug(t, chRoot, BEAT / 3, 0.055);
    }
    if (b === 0 && S.pad) this.power(t, chRoot, BAR * 0.92, 0.030 * S.pad);

    /* ---- and the melodies, on guitars ---- */
    if (S.mel) {
      for (const L of S.mel) {
        if (L.from !== undefined && barIn < L.from) continue;
        if (L.every && barIn % L.every !== 0) continue;
        const th = THEMES[L.th];
        if (!th) continue;
        const off = L.off || 0;
        const abs = barIn * 16 + b - off;
        if (abs < 0) continue;
        const nn = themeAt(th, Math.floor(abs / 16), abs % 16);
        if (!nn) continue;
        const dur = nn.steps * (BEAT / 4) * 0.96;
        const f = hz(nn.m + (L.oct || 0) + key);
        if (L.v === 'lead') this.gtrLead(t, f, dur, L.vol * 1.05, L.send);
        else if (L.v === 'clav') this.chug(t, nn.m + (L.oct || 0) + key, Math.min(dur, BEAT / 3), L.vol);
        else if (L.v === 'chip') this.squeal(t, f, Math.min(dur, 0.28), L.vol * 0.8);
        else if (L.v === 'brass') this.power(t, nn.m + (L.oct || 0) + key - 12, dur, L.vol * 0.75);
        else if (L.v === 'bell' || L.v === 'pluck') this.gtrClean(t, f, dur, L.vol, L.send);
        else this.voice(L.v, t, f, dur, L.vol, L.send);      /* choir and music box stay */
      }
    }

    /* ---- transitions ---- */
    if (b === 0 && barIn === 0) {
      if (['chorus', 'burn', 'cup', 'csgo', 'naoyaFight'].indexOf(S.name) >= 0) {
        this.rCrash(t, 0.17); this.impactAt(t);
      }
      if (S.name === 'burnUp' || S.name === 'outro') { this.rCrash(t, 0.20); this.impactAt(t); }
    }
    if (S.name === 'pre' && barIn === S.bars - 1 && b === 14) this.gapAt(t);
  },

  gapAt(t) {
    if (!this.gain) return;
    this.gain.gain.setValueAtTime(this.gain.gain.value, t);
    this.gain.gain.linearRampToValueAtTime(0.0001, t + 0.02);
    this.gain.gain.setValueAtTime(0.0001, t + BEAT / 2 - 0.02);
    this.gain.gain.linearRampToValueAtTime(0.85, t + BEAT / 2);
  },
  impactAt(t) {
    const ctx = Audio1.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(26, t + 1.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.45, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + 1.45);
    this.noise(t, 1.0, 'lowpass', 260, 0.22);
  },
  impact() { if (Audio1.ready && this.bus) this.impactAt(Audio1.ctx.currentTime); },

  riser(dur) {
    if (!Audio1.ready || !this.bus) return;
    const ctx = Audio1.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = Audio1.noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(360, t);
    f.frequency.exponentialRampToValueAtTime(9000, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.14, t + dur * 0.86);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.bus);
    s.start(t); s.stop(t + dur + 0.05);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(1400, t + dur);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.linearRampToValueAtTime(0.035, t + dur * 0.9);
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(og); og.connect(this.bus);
    o.start(t); o.stop(t + dur + 0.05);
  },
  whoosh() {
    if (!Audio1.ready || !this.bus) return;
    const ctx = Audio1.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = Audio1.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(2800, t);
    f.frequency.exponentialRampToValueAtTime(220, t + 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.20, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    s.connect(f); f.connect(g); g.connect(this.bus);
    s.start(t); s.stop(t + 0.8);
  }
};


/* =========================================================================
   Lyrics.  Words only — the tune is deliberately left blank.
   ========================================================================= */
const DJ_LYRICS = [
  { t: 0.6,  s: 'CON-FIS-CATED.', shout: 1 },
  { t: 2.6,  s: 'CON-FIS-CATED.', shout: 1 },
  { t: 4.6,  s: 'Anime. In MY schoolhouse.' },
  { t: 6.6,  s: 'Hit it.' },

  { t: 8.0,  s: 'Found it in your locker,' },
  { t: 10.0, s: 'found it in your bag,' },
  { t: 12.0, s: 'found it in the ceiling' },
  { t: 14.0, s: 'with a laminated tag!' },
  { t: 16.0, s: 'Great big shiny eyes' },
  { t: 18.0, s: 'and a fringe of bubblegum —' },
  { t: 20.0, s: 'not in my library,' },
  { t: 22.0, s: 'not while I am headmaster, chum!' },

  { t: 24.0, s: 'I got a ruler…' },
  { t: 26.0, s: 'and a rule to break…' },
  { t: 28.0, s: 'every single volume…' },
  { t: 30.0, s: 'for the SCHOOLHOUSE SAKE!', shout: 1 },

  { t: 32.0, s: 'CON-FIS-CATE!  (hey!)', shout: 1 },
  { t: 34.0, s: 'CON-FIS-CATE!  (hey!)', shout: 1 },
  { t: 36.0, s: 'Stack it in a tower,' },
  { t: 38.0, s: 'watch it levitate!' },
  { t: 40.0, s: 'CON-FIS-CATE!  (hey!)', shout: 1 },
  { t: 42.0, s: 'CON-FIS-CATE!  (hey!)', shout: 1 },
  { t: 44.0, s: 'Baldi is on the decks' },
  { t: 46.0, s: 'and the decks do NOT wait!' },

  /* ---------------- the floor ---------------- */
  { t: 48.0, s: 'Hold my ruler.' },
  { t: 50.0, s: 'You think all I do is teach?' },
  { t: 52.5, s: 'I was breaking in the staff room' },
  { t: 54.5, s: 'back in nineteen-eighty-nine.' },
  { t: 57.0, s: 'Six-step…' },
  { t: 59.0, s: 'back-spin…' },
  { t: 61.0, s: 'windmill…' },
  { t: 63.0, s: 'DE-TEN-TION!', shout: 1 },
  { t: 65.5, s: 'Volume six is under my elbow.' },
  { t: 67.5, s: 'Volume six is now a coaster.' },
  { t: 69.5, s: 'Nobody out-dances the teacher.' },
  { t: 71.0, s: 'Now — the OTHER methods.', shout: 1 },

  /* ---------------- six machines ---------------- */
  { t: 72.5,  s: 'METHOD ONE — THE SHREDDER.', shout: 1 },
  { t: 75.5,  s: 'Look at that. Confetti!' },
  { t: 77.5,  s: 'Very festive. Next.' },
  { t: 80.0,  s: 'METHOD TWO — THE PRESS.', shout: 1 },
  { t: 83.0,  s: 'Two hundred tonnes.' },
  { t: 85.0,  s: 'Now it is a bookmark.' },
  { t: 87.5,  s: 'METHOD THREE — THE CANNON.', shout: 1 },
  { t: 90.0,  s: 'Elevation… forty-five degrees…' },
  { t: 92.0,  s: 'Say hello to the moon for me!' },
  { t: 94.5,  s: 'METHOD FOUR — THE CHIPPER.', shout: 1 },
  { t: 97.5,  s: 'Straight in the hopper.' },
  { t: 99.5,  s: 'Recycling! I am also green.' },
  { t: 102.0, s: 'METHOD FIVE — THE ANVIL.', shout: 1 },
  { t: 104.5, s: 'A classic. Never fails.' },
  { t: 106.5, s: 'Look away if you are squeamish.' },
  { t: 109.5, s: 'METHOD SIX — ORBIT.', shout: 1 },
  { t: 112.0, s: 'Three… two… one…' },
  { t: 114.0, s: 'GOODBYE, VOLUME NINE!', shout: 1 },

  /* ---------------- the obby ---------------- */
  { t: 116.5, s: 'METHOD SEVEN.', shout: 1 },
  { t: 118.5, s: 'I built an obby.' },
  { t: 121.0, s: 'Bright blocks. No safety rail.' },
  { t: 124.0, s: 'Every part is a kill brick' },
  { t: 126.0, s: 'if you believe in yourself.' },
  { t: 128.5, s: 'Jump… jump… mind the spinner…' },
  { t: 132.0, s: 'Do NOT touch the lava, class.' },
  { t: 135.0, s: 'Checkpoint! I love a checkpoint.' },
  { t: 138.0, s: 'And at the very end of the course…' },
  { t: 141.0, s: '…is a hole.' },
  { t: 143.0, s: 'And your books are next to it.' },
  { t: 146.0, s: 'O O F .', shout: 1 },
  { t: 147.0, s: 'Ten out of ten. Would obby again.' },

  /* ---------------- 8 · sniper ---------------- */
  { t: 148.5, s: 'METHOD EIGHT — LONG RANGE.', shout: 1 },
  { t: 151.0, s: 'One hundred and fifty metres.' },
  { t: 153.0, s: 'Wind: four, right to left.' },
  { t: 155.0, s: 'Breathe in…' },
  { t: 156.4, s: 'hold…' },
  { t: 158.4, s: 'GOOD NIGHT, VOLUME TWO.', shout: 1 },
  { t: 160.5, s: 'One shot. One book.' },
  { t: 162.5, s: 'I have a marksmanship badge, you know.' },

  /* ---------------- 9 · bombsite ---------------- */
  { t: 164.5, s: 'METHOD NINE — BOMBSITE A.', shout: 1 },
  { t: 167.0, s: 'Rush B? No. Rush BOOKS.' },
  { t: 170.0, s: 'Planting the device…' },
  { t: 172.5, s: 'THE BOMB HAS BEEN PLANTED.', shout: 1 },
  { t: 175.0, s: 'Forty seconds. Well. Nine.' },
  { t: 177.5, s: 'Cut the red wire? No. Cut them all.' },
  { t: 180.5, s: 'Fire in the hole, class!' },
  { t: 182.5, s: 'HEADSHOT.', shout: 1 },
  { t: 184.5, s: 'Terrorists win. I am the terrorists.' },

  /* ---------------- 10 · the skeleton ---------------- */
  { t: 186.5, s: 'METHOD TEN.', shout: 1 },
  { t: 188.5, s: 'I called in a favour.' },
  { t: 190.5, s: '* it\u2019s a beautiful day outside.' },
  { t: 193.0, s: '* books are burning, pages are falling…' },
  { t: 196.0, s: '* on days like these, manga like you' },
  { t: 198.5, s: '* should be having a BAD TIME.', shout: 1 },
  { t: 201.0, s: 'Bones. Lovely.' },
  { t: 203.0, s: 'Now the big skulls. Watch this.' },
  { t: 206.0, s: '* you feel your sins crawling on your spine.' },
  { t: 209.0, s: '* G A M E   O V E R', shout: 1 },
  { t: 211.0, s: 'Thank you. I will send a hot dog.' },

  /* ---------------- 11 · the jumpscare ---------------- */
  { t: 212.5, s: 'METHOD ELEVEN — LET HER PLAY.', shout: 1 },
  { t: 215.5, s: 'She wanted a horror game.' },
  { t: 218.0, s: 'Chapter one. Very atmospheric.' },
  { t: 220.5, s: 'Nice big empty factory…' },
  { t: 223.0, s: 'nothing at all behind you…' },
  { t: 225.5, s: 'don\u2019t turn around, don\u2019t turn ar—' },
  { t: 227.2, s: 'A A A A A A H !', shout: 1 },
  { t: 229.5, s: 'Oh dear. She has left the building.' },
  { t: 232.0, s: 'Told her to play something educational.' },

  /* ---------------- 12 · the cane ---------------- */
  { t: 234.5, s: 'METHOD TWELVE — SIX OF THE BEST.', shout: 1 },
  { t: 237.5, s: 'Singapore rules. Rattan.' },
  { t: 239.5, s: 'Strap it down. Read the charges.' },
  { t: 241.5, s: 'Possession of anime, on school grounds.' },
  { t: 244.0, s: 'One… two… three…' },
  { t: 246.0, s: 'four… five…' },
  { t: 247.6, s: 'S I X !', shout: 1 },
  { t: 249.0, s: 'Case closed. Next.' },

  /* ---------------- 13 · the World Cup ---------------- */
  { t: 250.5, s: 'METHOD THIRTEEN — THE FINAL.', shout: 1 },
  { t: 253.0, s: 'Me. Against one thousand of them.' },
  { t: 255.5, s: 'The referee said it was fine.' },
  { t: 258.0, s: 'Here they come. All of them.' },
  { t: 260.5, s: 'Step over… step over… nutmeg…' },
  { t: 263.5, s: 'That is nine hundred beaten.' },
  { t: 266.0, s: 'The last one is in goal. Poor thing.' },
  { t: 268.5, s: 'Bicycle kick — from the halfway line —' },
  { t: 271.0, s: 'G O A A A A L !', shout: 1 },
  { t: 273.5, s: 'BALDI ONE. ANIME NOTHING.', shout: 1 },
  { t: 276.0, s: 'I would like to thank the ruler.' },
  { t: 278.0, s: 'And the schoolhouse. And me.' },

  /* ---------------- 14 · the corridor ---------------- */
  { t: 280.5, s: 'METHOD FOURTEEN — SECONDARY SCHOOL.', shout: 1 },
  { t: 283.5, s: 'Singapore. Level two corridor.' },
  { t: 286.0, s: '"Eh hello, you new here ah?"' },
  { t: 288.0, s: '"Wah, your eyes damn big sia."' },
  { t: 290.0, s: '"Which class you in? 2E?"' },
  { t: 292.0, s: 'Now. Watch the corridor.' },
  { t: 294.0, s: '"SORRY AH!" — and off he goes.', shout: 1 },
  { t: 296.5, s: 'Recess just ended. They are late.' },
  { t: 298.5, s: '"ORH SORRY SORRY—" bump.' },
  { t: 300.5, s: 'And from the futsal court below…' },
  { t: 302.6, s: 'B O N K !', shout: 1 },
  { t: 304.2, s: '"NO RUNNING IN THE CORRIDOR!"', shout: 1 },

  /* ---------------- 15 · the battlegrounds ---------------- */
  { t: 306.5, s: 'METHOD FIFTEEN — THE ARENA.', shout: 1 },
  { t: 309.0, s: 'Seven pro players. R6 only.' },
  { t: 311.5, s: 'They have been practising since primary four.' },
  { t: 314.0, s: 'M1. M1. M1. Uppercut.' },
  { t: 316.5, s: 'That is a true combo, class.' },
  { t: 318.5, s: 'Do not touch the ground. That is the rule.' },
  { t: 321.0, s: 'Juggle… juggle… reset…' },
  { t: 323.5, s: 'ninety-nine… one hundred and twelve…' },
  { t: 326.0, s: 'Save some for me!' },
  { t: 328.5, s: 'F I N A L   H I T !', shout: 1 },
  { t: 331.0, s: 'K . O .', shout: 1 },
  { t: 333.0, s: 'Well played, everyone. Well played.' },

  /* ---------------- 16 · twenty-four frames ---------------- */
  { t: 336.5, s: 'METHOD SIXTEEN.', shout: 1 },
  { t: 339.0, s: 'For this one I need a different technique.' },
  { t: 344.0, s: 'Projection Sorcery.' },
  { t: 347.0, s: 'TWENTY-FOUR FRAMES. ONE SECOND.', shout: 1 },
  { t: 349.5, s: 'Eleven strikes before you finish blinking.' },
  { t: 352.4, s: 'One. Two. Three —' },
  { t: 354.6, s: 'Through the rocks, please.' },
  { t: 358.0, s: 'I did say the hat was only for camping.' },
  { t: 361.5, s: 'Up you get. You are allowed one good hit.' },
  { t: 364.5, s: 'Ah — she is counting the frames.' },
  { t: 367.5, s: 'Twenty-four. That is the entire trick.' },
  { t: 370.2, s: 'And there it is. That WAS a good hit.', shout: 1 },
  { t: 373.5, s: 'Noted. Now watch this properly.' },
  { t: 376.5, s: 'Faster than the sound of me saying so.' },
  { t: 380.0, s: 'You cannot block what has already happened.' },
  { t: 383.5, s: 'The stance. I was waiting for the stance.' },
  { t: 386.5, s: 'You brace for the fist…' },
  { t: 388.6, s: '…so I take the ARM instead.', shout: 1 },
  { t: 391.0, s: 'Frozen. Held on frame twenty-four.' },
  { t: 394.0, s: 'One second is a very long time, class.' },
  { t: 396.6, s: 'S I T   D O W N .', shout: 1 },
  { t: 399.2, s: 'C O N F I S C A T E D .', shout: 1 },
  { t: 400.9, s: 'Sixteen out of sixteen. Undefeated.' },

  /* ---------------- bridge ---------------- */
  { t: 402.5, s: 'Class — do you like anime?' },
  { t: 405, s: 'NO.', shout: 57 },
  { t: 406.5, s: 'I said, do you LIKE anime?' },
  { t: 409, s: 'N O !', shout: 57 },
  { t: 410.5, s: 'Then what do we do with the rest?' },

  /* ---------------- the burn ---------------- */
  { t: 412, s: 'BURN IT.', shout: 57 },
  { t: 414, s: 'BURN IT.', shout: 57 },
  { t: 416, s: 'BURN IT DOWN!', shout: 57 },
  { t: 418, s: 'Volume one to ninety-nine,' },
  { t: 420, s: 'every spine, every spine,' },
  { t: 422, s: 'EVERY SPINE!', shout: 57 },
  { t: 424, s: 'Shredded, pressed, fired, chipped,' },
  { t: 426, s: 'flattened, launched and DROPPED,' },
  { t: 428, s: 'sniped, bombed, boned, scared,' },
  { t: 430, s: 'CANED and BEATEN ONE-NIL!', shout: 57 },
  { t: 432.5, s: 'ha ha ha ha ha HA!' },
  { t: 435, s: 'CONFISCATED. FOREVER.', shout: 57 },
  { t: 439, s: '' },

  /* ---- BONUS ---- */
  { t: 445.0, s: 'Home at last.' },
  { t: 449.4, s: "Kids? I'm back." },
  { t: 454.8, s: '…why is it dark.' },
  { t: 459.0, s: 'WHERE IS THE ANIME GIRL?', shout: 1 },
  { t: 462.6, s: 'You three had better be reading.' },
  { t: 468.6, s: 'Ah. There you are.' },
  { t: 471.2, s: 'Why are all three of you in MY chair?' },
  { t: 474.8, s: 'Hm.' },
  { t: 477.2, s: '…you are being very quiet.' },
  { t: 482.4, s: 'And what are we working on?' },
  { t: 486.8, s: 'Let me see that.' },
  { t: 490.0, s: '' },
  { t: 492.6, s: '"Ba-ru-di sen-sei… dai-su-ki."' },
  { t: 495.2, s: 'With a heart.' },
  { t: 496.8, s: 'On my marking.' },
  { t: 499.2, s: 'That took me ALL EVENING.', shout: 1 },
  { t: 502.4, s: '' },
  { t: 506.6, s: 'COME HERE.', shout: 1 },
  { t: 509.4, s: '' },
  { t: 517.4, s: "No. No, don't hug my leg." },
  { t: 520.2, s: 'Nobody is getting a gold star tonight.' }
];

/* which dance he is doing, and when */
const DJ_MOVES = [
  { t: 0,     m: 'arrive'   },
  { t: 6.6,   m: 'bounce'   },
  { t: 12,    m: 'point'    },
  { t: 18,    m: 'wave'     },
  { t: 24,    m: 'headbang' },
  { t: 30,    m: 'jumpspin' },
  { t: 32,    m: 'bounce'   },
  { t: 36,    m: 'kicks'    },
  { t: 40,    m: 'spinruler'},
  { t: 44,    m: 'jumpspin' },
  /* --- down to the floor --- */
  { t: 48,    m: 'toprock'  },
  { t: 52.5,  m: 'sixstep'  },
  { t: 57.5,  m: 'backspin' },
  { t: 61.5,  m: 'windmill' },
  { t: 65.5,  m: 'worm'     },
  { t: 69.5,  m: 'freeze'   },
  { t: 71.2,  m: 'toprock'  },
  /* --- the machine montage --- */
  { t: 72,    m: 'present'  },
  /* --- the obby --- */
  { t: 116,   m: 'obbyland' },
  { t: 120,   m: 'obbyrun'  },
  { t: 141.5, m: 'push'     },
  { t: 146.4, m: 'obbycheer'},
  /* --- the six new methods --- */
  { t: 148,   m: 'walkon'   },
  { t: 150.5, m: 'prone'    },
  { t: 164,   m: 'walkon'   },
  { t: 169.5, m: 'crouch'   },
  { t: 174,   m: 'backoff'  },
  { t: 186,   m: 'watch'    },
  { t: 212,   m: 'watch'    },
  { t: 234,   m: 'caneswing'},
  { t: 250,   m: 'dribble'  },
  { t: 268.4, m: 'bicycle'  },
  { t: 271.5, m: 'lift'     },
  /* --- the last two methods --- */
  { t: 280,   m: 'walkon'   },
  { t: 283,   m: 'watch'    },
  { t: 306,   m: 'watch'    },
  { t: 328,   m: 'slap'     },
  /* --- 16 · the duel --- */
  { t: 336,   m: 'naoya'    },
  /* --- back to the club --- */
  { t: 402,   m: 'shake'    },
  { t: 410.4, m: 'ignite'   },
  { t: 412.6, m: 'crazy'    },
  { t: 428,   m: 'crazy'    }
];

/* the big set-pieces, and where in the world they live */
const BIG_ACTS = [
  { id: 'sniper', t0: 148, t1: 164 },
  { id: 'csgo',   t0: 164, t1: 186 },
  { id: 'sans',   t0: 186, t1: 212 },
  { id: 'huggy',  t0: 212, t1: 234 },
  { id: 'cane',   t0: 234, t1: 250 },
  { id: 'cup',    t0: 250, t1: 280 },
  { id: 'sgschool', t0: 280, t1: 306 },
  { id: 'tsb',    t0: 306, t1: 336 },
  { id: 'naoya',  t0: 336, t1: 402 },
  { id: 'home',   t0: 440, t1: 522 }
];

/* where the pillar of confiscated anime stands — well clear of the dance floor */
const PILLAR_AT = { x: -8.5, z: -5.5 };

/* where the camera is looking, cut by cut */
const DJ_SHOTS = [
  { t: 0,    kind: 'push',   from: [0, 5, 26], to: [0, 5.5, 13],  look: [0, 6, 0] },
  { t: 6.6,  kind: 'orbit',  r: 15, y: 7.5,  a0: 0.6,  spin: 0.22, look: [0, 5.5, 0] },
  { t: 12,   kind: 'static', from: [7, 3.0, 10], look: [0, 6.5, 0], shake: 0.02 },
  { t: 16,   kind: 'orbit',  r: 12, y: 11,   a0: 3.2,  spin: -0.30, look: [0, 5, 0] },
  { t: 20,   kind: 'static', from: [-6, 8.5, 9], look: [0, 6, 0], shake: 0.03 },
  { t: 24,   kind: 'push',   from: [0, 2.0, 12], to: [0, 4.0, 6],  look: [0, 7, 0] },
  { t: 28,   kind: 'orbit',  r: 17, y: 4.0,  a0: 1.4,  spin: 0.45, look: [0, 6, 0] },
  { t: 32,   kind: 'push',   from: [0, 18, 17], to: [1, 6.5, 9.5], look: [0, 5.5, 0] },
  { t: 36,   kind: 'orbit',  r: 11, y: 3.0,  a0: 2.2,  spin: -0.55, look: [0, 6.5, 0] },
  { t: 40,   kind: 'static', from: [9, 6, 9], look: [0, 6, 0], shake: 0.04 },
  { t: 44,   kind: 'orbit',  r: 14, y: 9,    a0: 0.2,  spin: 0.5,  look: [0, 5.5, 0] },

  /* --- the floor: get low --- */
  { t: 48,   kind: 'push',   from: [0, 8, 14], to: [0, 3.4, 9.5], look: [0, 3.2, 0], shake: 0.02 },
  { t: 52.5, kind: 'orbit',  r: 10.5, y: 3.4, a0: 0.9, spin: 0.7,  look: [0, 1.7, 0], shake: 0.03 },
  { t: 57.5, kind: 'static', from: [0.5, 8.5, 5.0], look: [0, 0.9, 0], shake: 0.05 },
  { t: 61.5, kind: 'orbit',  r: 11.5, y: 6.0, a0: 2.4, spin: -0.9, look: [0, 1.5, 0], shake: 0.04 },
  { t: 65.5, kind: 'static', from: [10.5, 2.8, 4.5], look: [0, 1.4, -1.5], shake: 0.04 },
  { t: 69.5, kind: 'push',   from: [0, 3.2, 9.5], to: [0, 5.0, 12.5], look: [0, 2.4, 0], shake: 0.03 },

  /* --- machines: one setup and one detail each --- */
  { t: 72,   kind: 'push',   from: [13, 8, 24], to: [8.5, 5.2, 19],  look: [0, 4.0, 7.5] },
  { t: 76,   kind: 'static', from: [5.5, 4.6, 18.0], look: [0, 4.4, 7.5], shake: 0.03 },
  { t: 79.5, kind: 'orbit',  c: [0, 7.5], r: 16, y: 9, a0: 1.1, spin: 0.28, look: [0, 6.0, 7.5] },
  { t: 83.4, kind: 'static', from: [-7.5, 6.0, 19.5], look: [0, 3.4, 7.5], shake: 0.05 },
  { t: 87,   kind: 'push',   from: [11, 6.5, 23], to: [7.5, 5.5, 18.5], look: [-1, 4.5, 7.5] },
  { t: 90.5, kind: 'static', from: [6.0, 7.0, 20.0], look: [-3.0, 6.0, 7.5], shake: 0.04 },
  { t: 94,   kind: 'push',   from: [11, 11, 21], to: [8.0, 7.5, 17], look: [0, 5.5, 7.5] },
  { t: 98,   kind: 'static', from: [4.5, 6.5, -7.0], look: [0, 5.5, 2.5], shake: 0.05 },
  { t: 101.5, kind: 'static', from: [9.5, 9.0, 21], look: [0, 8.0, 7.5], shake: 0.03 },
  { t: 105,  kind: 'push',   from: [8, 15, 20], to: [6.5, 4.6, 16.5], look: [0, 2.6, 7.5], shake: 0.06 },
  { t: 109,  kind: 'push',   from: [-9, 3, 20], to: [-8, 9, 17],  look: [0, 8, 7.5] },
  { t: 112.6, kind: 'push',  from: [-7, 6, 15], to: [-7, 20, 15], look: [0, 16, 7.5], shake: 0.05 },

  /* --- the obby --- */
  { t: 116,  kind: 'obby',   mode: 'wide' },
  { t: 120,  kind: 'obby',   mode: 'chase' },
  { t: 128.5, kind: 'obby',  mode: 'side' },
  { t: 134,  kind: 'obby',   mode: 'chase' },
  { t: 138,  kind: 'obby',   mode: 'ahead' },
  { t: 141.5, kind: 'obby',  mode: 'push' },
  { t: 142.6, kind: 'obby',  mode: 'fall' },
  { t: 147.0, kind: 'obby',  mode: 'wide' },

  /* --- 8 · sniper --- */
  { t: 148,  act: 'sniper', kind: 'push',   from: [14, 7, 22], to: [9, 3.4, 14], look: [0, 1.8, 0] },
  { t: 151,  act: 'sniper', kind: 'static', from: [-5.5, 2.6, 9], look: [0, 1.8, -1], shake: 0.01 },
  { t: 153.5, act: 'sniper', kind: 'static', from: [0, 2.7, 8.4], look: [0, 2.4, -40], shake: 0.008 },
  { t: 158.2, act: 'sniper', kind: 'static', from: [0, 2.7, 8.4], look: [0, 2.4, -40], shake: 0.05 },
  { t: 159.0, act: 'sniper', kind: 'push',  from: [7, 11, -128], to: [11, 13, -136],
             look: [0, 9, -150], shake: 0.03 },
  { t: 161.5, act: 'sniper', kind: 'orbit', c: [0, 0], r: 17, y: 5.5, a0: 0.5, spin: 0.28, look: [0, 2.2, 0] },

  /* --- 9 · bombsite --- */
  { t: 164,  act: 'csgo', kind: 'push',   from: [16, 12, 26], to: [11, 7.5, 19], look: [0, 3.5, 0] },
  { t: 169.5, act: 'csgo', kind: 'static', from: [6.5, 3.2, 9.5], look: [0, 1.6, 2], shake: 0.02 },
  { t: 174,  act: 'csgo', kind: 'orbit',  c: [0, 2], r: 13, y: 5.5, a0: 1.6, spin: 0.25, look: [0, 2.6, 2] },
  { t: 179,  act: 'csgo', kind: 'static', from: [2.4, 1.4, 7.5], look: [0, 1.0, 2], shake: 0.05 },
  { t: 181.6, act: 'csgo', kind: 'static', from: [12, 8, 24], look: [0, 4, 2], shake: 0.10 },
  { t: 184,  act: 'csgo', kind: 'push',   from: [8, 6, 20], to: [5, 9, 26], look: [0, 3, 2] },

  /* --- 10 · the skeleton --- */
  { t: 186,  act: 'sans', kind: 'push',   from: [0, 8, 26], to: [0, 6.5, 19], look: [0, 5.0, -4] },
  { t: 190.5, act: 'sans', kind: 'static', from: [-6.5, 6.4, 6.5], look: [0, 5.4, -11], shake: 0.01 },
  { t: 196,  act: 'sans', kind: 'static', from: [0, 5.4, 16], look: [0, 5.0, 2], shake: 0.02 },
  { t: 201,  act: 'sans', kind: 'orbit',  c: [0, 0], r: 15, y: 7.5, a0: 0.4, spin: 0.22, look: [0, 5.2, -3] },
  { t: 203.5, act: 'sans', kind: 'static', from: [9, 9, 12], look: [0, 6.0, -2], shake: 0.05 },
  { t: 206.5, act: 'sans', kind: 'static', from: [0, 5.6, 13.5], look: [0, 5.0, 2], shake: 0.04 },
  { t: 210,  act: 'sans', kind: 'push',   from: [7, 6, 16], to: [5, 5.4, 12], look: [0, 5.0, -6] },

  /* --- 11 · the jumpscare --- */
  { t: 212,  act: 'huggy', kind: 'push',   from: [10, 8, 20], to: [7, 6, 15], look: [0, 4, -2] },
  { t: 217.5, act: 'huggy', kind: 'static', from: [-7.5, 5.5, 11], look: [0, 4.6, -3], shake: 0.01 },
  { t: 221,  act: 'huggy', kind: 'static', from: [0, 5.5, 14.5], look: [0, 6, -18], shake: 0.02 },
  { t: 224.5, act: 'huggy', kind: 'push',   from: [4.5, 5.2, 12], to: [3.4, 5.0, 9.5],
             look: [0, 5.2, 2], shake: 0.03 },
  { t: 227.0, act: 'huggy', kind: 'static', from: [0, 13.5, 16.0], look: [0, 15.4, 5.5], shake: 0.16 },
  { t: 229.5, act: 'huggy', kind: 'orbit',  c: [0, -2], r: 23, y: 10, a0: 1.9, spin: 0.26, look: [0, 6, -2] },

  /* --- 12 · the cane --- */
  { t: 234,  act: 'cane', kind: 'push',   from: [13, 9, 17], to: [9, 6.5, 12], look: [0, 6.4, 0] },
  { t: 239,  act: 'cane', kind: 'static', from: [-3.5, 8.4, 9.5], look: [0, 6.9, 0], shake: 0.02 },
  { t: 243.5, act: 'cane', kind: 'orbit',  c: [0, 0], r: 14, y: 11.0, a0: 2.3, spin: 0.20, look: [0, 6.6, 0] },
  { t: 247.2, act: 'cane', kind: 'static', from: [1.5, 7.6, 6.5], look: [0, 6.9, 0], shake: 0.09 },

  /* --- 13 · the final --- */
  { t: 250,  act: 'cup', kind: 'push',   from: [-30, 46, 96], to: [-22, 26, 66], look: [0, 4, 0] },
  { t: 255,  act: 'cup', kind: 'static', from: [-34, 16, 40], look: [-8, 3, 0], shake: 0.02 },
  { t: 258.5, act: 'cup', kind: 'orbit', c: [-10, 0], r: 30, y: 13, a0: 2.2, spin: 0.24, look: [-10, 3, 0] },
  { t: 263,  act: 'cup', kind: 'static', from: [-6, 7.5, 26], look: [-10, 2.5, 0], shake: 0.04 },
  { t: 268.4, act: 'cup', kind: 'static', from: [10, 9, 30], look: [-4, 6, 0], shake: 0.05 },
  { t: 271.0, act: 'cup', kind: 'push',  from: [58, 9, 22], to: [64, 7.5, 15], look: [72, 4, 0], shake: 0.07 },
  { t: 273.5, act: 'cup', kind: 'push',  from: [-6, 8, 26], to: [-8, 14, 40], look: [-10, 6, 0] },
  { t: 276,  act: 'cup', kind: 'static', from: [-4, 8.5, 16], look: [-10, 7.5, 0], shake: 0.03 },

  /* --- 14 · the corridor --- */
  { t: 280,  act: 'sgschool', kind: 'push', from: [26, 9, 22], to: [18, 5.5, 15], look: [0, 4.5, 0] },
  { t: 284,  act: 'sgschool', kind: 'static', from: [7.5, 4.2, 9.5], look: [0, 4.6, 0], shake: 0.02 },
  { t: 288.5, act: 'sgschool', kind: 'static', from: [-13, 4.6, 8], look: [1, 4.4, 0], shake: 0.03 },
  { t: 292,  act: 'sgschool', kind: 'static', from: [9, 3.6, 8.5], look: [-1, 4.2, 0], shake: 0.05 },
  { t: 295.5, act: 'sgschool', kind: 'orbit', c: [0, 0], r: 13, y: 6.5, a0: 1.5, spin: 0.22,
             look: [0, 4.4, 0], shake: 0.03 },
  { t: 299,  act: 'sgschool', kind: 'static', from: [4.5, 5.0, 15], look: [0, 5.4, 1], shake: 0.04 },
  { t: 302.4, act: 'sgschool', kind: 'push', from: [3, 4.2, 8], to: [2, 3.4, 6], look: [0, 3.6, 0], shake: 0.09 },

  /* --- 15 · the arena --- */
  { t: 306,  act: 'tsb', kind: 'push',   from: [0, 26, 46], to: [0, 15, 34], look: [0, 4, 0] },
  { t: 310,  act: 'tsb', kind: 'orbit',  c: [0, 0], r: 22, y: 8, a0: 0.6, spin: 0.26, look: [0, 4.5, 0] },
  { t: 314,  act: 'tsb', kind: 'static', from: [11, 6.5, 15], look: [0, 6.5, 0], shake: 0.06 },
  { t: 318,  act: 'tsb', kind: 'static', from: [-9, 10, 17], look: [0, 9, 0], shake: 0.07 },
  { t: 322,  act: 'tsb', kind: 'orbit',  c: [0, 0], r: 16, y: 12, a0: 2.4, spin: -0.34, look: [0, 8, 0], shake: 0.06 },
  { t: 326,  act: 'tsb', kind: 'static', from: [7, 5.5, 13], look: [0, 6, 0], shake: 0.08 },
  { t: 328.5, act: 'tsb', kind: 'push',  from: [5, 6.5, 12], to: [4, 5.5, 9.5], look: [0, 6, 0], shake: 0.12 },
  { t: 331,  act: 'tsb', kind: 'push',   from: [0, 9, 22], to: [0, 16, 34], look: [0, 2, 0], shake: 0.04 },

  /* --- 16 · twenty-four frames.  The act drives this camera itself. --- */
  { t: 336,  act: 'naoya', kind: 'duel' },

  /* --- back to the club for the finish --- */
  { t: 402,  kind: 'push',   from: [0, 6.2, 9], to: [0, 6.2, 5.2], look: [0, 6.6, 0], shake: 0.02 },
  { t: 408,  kind: 'static', from: [0, 6.6, 4.4], look: [0, 6.6, 0], shake: 0.05 },
  { t: 410.4, kind: 'push',  from: [-14.5, 5.2, 11.5], to: [-11.5, 6.4, 8.0],
             look: [-4.2, 6.0, -2.6], shake: 0.03 },
  { t: 412.6, kind: 'push',  from: [-16, 4.5, 15], to: [-12, 7.0, 10],
             look: [-4.5, 7, -2.6], shake: 0.06 },
  { t: 416,  kind: 'orbit',  c: [-4.2, -2.6], r: 15, y: 8.5, a0: 2.1, spin: 0.34,
             look: [-4.2, 7.5, -2.6], shake: 0.05 },
  { t: 420,  kind: 'static', from: [2.0, 2.8, -12.0], look: [-5.5, 7.6, -3.2], shake: 0.07 },
  { t: 424,  kind: 'orbit',  c: [-4.2, -2.6], r: 19, y: 12, a0: 0.6, spin: -0.42,
             look: [-4.2, 6.5, -2.6], shake: 0.04 },
  { t: 428,  kind: 'static', from: [-1.5, 6.6, 4.2], look: [-3.2, 6.6, 0.5], shake: 0.07 },
  { t: 432,  kind: 'push',   from: [-4, 8, 22], to: [-4, 16, 40], look: [-4.2, 7, -2.6] },

  /* ============ BONUS: he goes home ============ */
  /* the garden */
  { t: 440.0, act: 'home', kind: 'push',  from: [10, 17, 68], to: [4, 11.5, 48], look: [0, 8, 20] },
  { t: 444.2, act: 'home', kind: 'push',  from: [-8.5, 3.2, 33], to: [-6.5, 3.6, 24], look: [0, 4.2, 26] },
  { t: 447.0, act: 'home', kind: 'static', from: [-9.5, 4.4, 26.5], look: [-1.5, 4.2, 23.0] },
  { t: 449.2, act: 'home', kind: 'push',  from: [0, 5.0, 26.5], to: [0, 4.7, 23.4], look: [0, 4.2, 17] },
  { t: 451.2, act: 'home', kind: 'static', from: [-6.2, 5.4, 24.0], look: [0, 4.4, 17.0] },
  /* inside, dark */
  { t: 454.2, act: 'home', kind: 'static', from: [2.9, 5.0, 5.2], look: [-0.6, 4.4, 14.5] },
  { t: 456.6, act: 'home', kind: 'push',  from: [-3.0, 5.6, 9.0], to: [-2.2, 5.4, 9.8], look: [4.6, 4.6, 11.2] },
  { t: 458.8, act: 'home', kind: 'static', from: [-3.0, 6.0, 13.4], look: [1.4, 4.6, 5.0], shake: 0.02 },
  { t: 461.4, act: 'home', kind: 'push',  from: [0, 5.5, 10.5], to: [0, 5.3, 4.5], look: [0, 4.6, -5] },
  { t: 464.8, act: 'home', kind: 'static', from: [0, 5.1, 2.2], look: [0, 4.3, -7] },
  { t: 466.4, act: 'home', kind: 'push',  from: [0, 5.3, -0.8], to: [0, 5.0, -7.0], look: [0.5, 4.2, -21] },
  /* the three of them */
  { t: 470.2, act: 'home', kind: 'static', from: [0.5, 4.9, -15.6], look: [0.5, 4.2, -23.8] },
  { t: 472.8, act: 'home', kind: 'push',  from: [0.5, 4.7, -18.4], to: [0.5, 4.6, -20.2], look: [0.5, 4.3, -24.4] },
  { t: 475.2, act: 'home', kind: 'static', from: [-5.6, 5.6, -18.6], look: [0.5, 4.4, -24.0] },
  { t: 477.4, act: 'home', kind: 'push',  from: [0.5, 4.70, -20.2], to: [0.5, 4.62, -21.0], look: [0.5, 4.5, -23.9] },
  { t: 480.2, act: 'home', kind: 'orbit', c: [0.5, -24.2], r: 5.6, y: 5.0, a0: 0.35, spin: 0.16,
              look: [0.5, 4.3, -24.3] },
  /* he comes round the desk */
  { t: 482.4, act: 'home', kind: 'push',  from: [8.5, 5.8, -15.0], to: [5.0, 5.1, -18.0], look: [1.5, 3.6, -21.4] },
  { t: 486.6, act: 'home', kind: 'static', from: [3.4, 6.9, -17.4], look: [0.4, 3.3, -21.2] },
  { t: 488.4, act: 'home', kind: 'push',  from: [0.4, 6.6, -18.4], to: [0.4, 4.9, -19.7], look: [0.4, 3.2, -21.0] },
  /* the insert: the page itself, off in limbo */
  { t: 490.0, act: 'home', kind: 'static', from: [70, 10, 16], look: [70, 10, 0] },
  { t: 492.2, act: 'home', kind: 'push',  from: [70, 10, 11.5], to: [70, 10.4, 6.2], look: [70, 10.2, 0] },
  { t: 494.6, act: 'home', kind: 'static', from: [70, 10.3, 5.2], look: [70, 10.3, 0], shake: 0.02 },
  { t: 496.4, act: 'home', kind: 'static', from: [70, 9.4, 3.6], look: [70, 10.8, 0], shake: 0.04 },
  /* and back on him */
  { t: 498.0, act: 'home', kind: 'static', from: [5.8, 5.8, -22.8], look: [0.6, 4.8, -19.0], shake: 0.05 },
  { t: 500.4, act: 'home', kind: 'push',  from: [3.6, 6.3, -22.4], to: [2.8, 6.2, -21.6], look: [0.4, 5.9, -18.9], shake: 0.08 },
  { t: 502.6, act: 'home', kind: 'static', from: [-4.6, 6.1, -22.6], look: [0.4, 5.7, -18.8], shake: 0.10 },
  { t: 504.4, act: 'home', kind: 'push',  from: [1.9, 6.6, -21.6], to: [1.5, 6.55, -21.0], look: [0.4, 6.4, -18.7], shake: 0.14 },
  /* the grab */
  { t: 506.0, act: 'home', kind: 'static', from: [9.6, 5.6, -15.4], look: [0.6, 4.8, -19.4], shake: 0.10 },
  { t: 507.6, act: 'home', kind: 'static', from: [10.2, 6.2, -19.4], look: [0.5, 5.4, -19.4], shake: 0.12 },
  { t: 510.0, act: 'home', kind: 'push',  from: [6.8, 7.4, -28.0], to: [5.8, 7.2, -26.8], look: [0.4, 5.5, -19.4], shake: 0.10 },
  { t: 513.0, act: 'home', kind: 'static', from: [-10.2, 6.5, -19.4], look: [0.4, 5.7, -19.4], shake: 0.10 },
  /* out */
  { t: 516.2, act: 'home', kind: 'push',  from: [2.0, 7.2, -26.6], to: [5.0, 9.0, -28.9], look: [0.4, 5.6, -19.4] },
  { t: 519.4, act: 'home', kind: 'orbit', c: [0.4, -19.4], r: 9.8, y: 7.2, a0: 3.55, spin: 0.13,
              look: [0.4, 5.6, -19.4] }
];

/* the six machines, each with its moment */
const MACHINES = [
  { id: 'shredder', t0: 72,    t1: 79.5,  fire: 76.0 },
  { id: 'press',    t0: 79.5,  t1: 87,    fire: 83.6 },
  { id: 'cannon',   t0: 87,    t1: 94,    fire: 91.4 },
  { id: 'chipper',  t0: 94,    t1: 101.5, fire: 98.2 },
  { id: 'anvil',    t0: 101.5, t1: 109,   fire: 105.6 },
  { id: 'rocket',   t0: 109,   t1: 116,   fire: 113.0 }
];
const OBBY_T0 = 116, OBBY_RUN = 120, OBBY_PUSH = 141.5, OBBY_END = 148;

const DJ_END = 522.0;

/* =========================================================================
   The room
   ========================================================================= */
const DJ = {
  active: false, t: 0, scene: null, camera: null, model: null,
  tiles: null, tileCols: null, eq: null, eqM: null, confetti: null, embers: null,
  lasers: [], spots: [], dancers: [], pillar: null, books: [], flames: [],
  ball: null, decks: [], speakers: [], smoke: [], fireLights: [],
  move: 'arrive', moveT: 0, moveIdx: -1, shotIdx: -1, shot: null, shotT: 0,
  lyricIdx: -1, burn: 0, spirals: [], skipped: false, wallMat: null, fireTex: null,

  /* ------------------------------------------------------------- start */
  start() {
    this.active = true; this.t = 0; this.burn = 0; this.skipped = false;
    this.moveIdx = -1; this.shotIdx = -1; this.lyricIdx = -1;
    this._did = {}; this.audioT0 = null;
    this._stroke = -1; this._beep = -1; this._hop = -1;
    this.splashAt = null; this.actPose = null; this.punchT = 0;
    this.move = 'arrive'; this.moveT = 0;
    G.mode = 'dj'; G.running = true; G.paused = false;

    this.build();
    Audio1.init(); Audio1.resume();
    DJAudio.start();
    /* Run the whole video off the audio clock. Frame time can stutter; the
       music cannot, so anchoring to it keeps every lyric, cut and flame
       exactly where it belongs. */
    this.audioT0 = DJAudio.running ? DJAudio.t0 : null;

    ['hud', 'objBar', 'dialogue', 'mathPad', 'ropeUI', 'prompt', 'detention',
     'pauseHint', 'confCheat'].forEach(id => UI.el(id).classList.add('hidden'));
    UI.el('subtitle').style.opacity = 0;
    UI.el('toast').style.opacity = 0;
    UI.el('djSkip').classList.remove('hidden');
    UI.el('lyric').textContent = '';
    UI.el('lyric').classList.remove('pop');
    UI.el('djTitle').textContent = '';
    UI.el('djTitle').classList.remove('on');
    /* lift the black that Confiscation faded down to */
    setTimeout(() => { UI.el('fade').classList.remove('on'); }, 260);
  },

  /* ------------------------------------------------------------- build */
  build() {
    const S = new THREE.Scene();
    this.scene = S;
    S.background = new THREE.Color(0x05030c);
    S.fog = new THREE.Fog(0x05030c, 26, 78);

    this.camera = new THREE.PerspectiveCamera(64, 16 / 9, 0.1, 600);
    this.amb = new THREE.AmbientLight(0x6a5f9c, 0.55); S.add(this.amb);
    const key = new THREE.DirectionalLight(0xd8c8ff, 0.42);
    key.position.set(0.3, 1, 0.6); S.add(key);
    this.keyLight = key;
    /* everything club-shaped goes in here so the obby can switch it all off */
    const roomG = new THREE.Group(); S.add(roomG); this.roomG = roomG;

    /* ---- the grid floor: one instanced mesh, a colour per tile ---- */
    const N = 14, TS = 3.6;
    const tileGeo = new THREE.BoxGeometry(TS * 0.92, 0.3, TS * 0.92);
    const tileMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const tiles = new THREE.InstancedMesh(tileGeo, tileMat, N * N);
    const D = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      D.position.set((c - (N - 1) / 2) * TS, 0, (r - (N - 1) / 2) * TS);
      D.updateMatrix(); tiles.setMatrixAt(i, D.matrix);
      tiles.setColorAt(i, new THREE.Color(0x201838));
      i++;
    }
    tiles.instanceMatrix.needsUpdate = true;
    tiles.instanceColor.needsUpdate = true;
    tiles.frustumCulled = false;
    roomG.add(tiles);
    this.tiles = tiles; this.tileN = N; this.tileTS = TS;
    this.tmpCol = new THREE.Color();

    /* a dark reflective slab under the tiles so the gaps read as black */
    const base = new THREE.Mesh(new THREE.PlaneGeometry(N * TS + 8, N * TS + 8),
      new THREE.MeshBasicMaterial({ color: 0x090512 }));
    base.rotation.x = -Math.PI / 2; base.position.y = -0.2; roomG.add(base);

    /* ---- walls ---- */
    const wallTex = (function () {
      const { c, x } = cv(64, 64);
      x.fillStyle = '#120c22'; x.fillRect(0, 0, 64, 64);
      x.strokeStyle = '#2a1c4a'; x.lineWidth = 2;
      for (let k = 0; k <= 64; k += 16) {
        x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 64); x.stroke();
        x.beginPath(); x.moveTo(0, k); x.lineTo(64, k); x.stroke();
      }
      return texFrom(c, 8, 4);
    })();
    this.wallMat = new THREE.MeshLambertMaterial({ map: wallTex, side: THREE.DoubleSide });
    const R = N * TS / 2 + 3;
    for (let w = 0; w < 4; w++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, 26), this.wallMat);
      m.position.set(Math.sin(w * Math.PI / 2) * R, 13, Math.cos(w * Math.PI / 2) * R);
      m.rotation.y = w * Math.PI / 2 + Math.PI;
      roomG.add(m);
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, R * 2),
      new THREE.MeshBasicMaterial({ color: 0x08050f }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = 22; roomG.add(ceil);

    /* ---- mirror ball ---- */
    const ball = new THREE.Group();
    const facets = new THREE.Mesh(new THREE.IcosahedronGeometry(2.0, 1),
      new THREE.MeshPhongMaterial({ color: 0xbfc8d8, shininess: 90, flatShading: true }));
    ball.add(facets);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0x222222 }));
    rod.position.y = 5; ball.add(rod);
    ball.position.set(0, 24, 0);
    roomG.add(ball); this.ball = ball;
    const ballLight = new THREE.PointLight(0xbfd8ff, 0.5, 60, 1.5);
    ballLight.position.set(0, 16, 0); roomG.add(ballLight); this.ballLight = ballLight;

    /* ---- DJ booth ---- */
    const booth = new THREE.Group();
    booth.position.set(0, 0, -16);
    const desk = box(11, 3.0, 3.0, new THREE.MeshLambertMaterial({ color: 0x2a2440 }));
    desk.position.y = 1.5; booth.add(desk);
    const lip = box(11.4, 0.4, 3.4, new THREE.MeshBasicMaterial({ color: 0xff3fd0 }));
    lip.position.y = 3.1; booth.add(lip);
    this.boothLip = lip;
    for (const sx of [-3.4, 3.4]) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.3, 20),
        new THREE.MeshLambertMaterial({ color: 0x141020 }));
      plate.position.set(sx, 3.3, 0); booth.add(plate);
      const rec = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.12, 20),
        new THREE.MeshLambertMaterial({ color: 0x0b0b0f }));
      rec.position.set(sx, 3.5, 0); booth.add(rec);
      const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.14, 14),
        new THREE.MeshBasicMaterial({ color: sx < 0 ? 0xffe14d : 0x4ce0ff }));
      lab.position.set(sx, 3.56, 0); booth.add(lab);
      this.decks.push(rec, lab);
    }
    const mixer = box(2.4, 0.35, 2.2, new THREE.MeshLambertMaterial({ color: 0x181428 }));
    mixer.position.set(0, 3.35, 0); booth.add(mixer);
    this.mixLeds = [];
    for (let k = 0; k < 8; k++) {
      const led = box(0.18, 0.12, 0.18, new THREE.MeshBasicMaterial({ color: 0x2fff6a }));
      led.position.set(-0.9 + k * 0.26, 3.56, 0.6); booth.add(led);
      this.mixLeds.push(led);
    }
    roomG.add(booth); this.booth = booth;

    /* ---- speaker stacks ---- */
    for (const sx of [-14, 14]) {
      const st = new THREE.Group();
      st.position.set(sx, 0, -12);
      const cab = new THREE.MeshLambertMaterial({ color: 0x14121c });
      for (let k = 0; k < 3; k++) {
        const c2 = box(4.4, 3.4, 3.2, cab);
        c2.position.y = 1.7 + k * 3.5; st.add(c2);
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.2, 0.5, 16),
          new THREE.MeshLambertMaterial({ color: 0x2c2a38 }));
        cone.rotation.x = Math.PI / 2;
        cone.position.set(0, 1.7 + k * 3.5, 1.7); st.add(cone);
        this.speakers.push(cone);
      }
      const glow = box(4.5, 0.25, 3.3, new THREE.MeshBasicMaterial({ color: 0xff3fd0 }));
      glow.position.y = 10.7; st.add(glow); this.speakers.push(glow);
      roomG.add(st);
      this.speakerStacks = this.speakerStacks || [];
      this.speakerStacks.push(st);
    }

    /* ---- equalizer wall ---- */
    const EQ = 22;
    const eqGeo = new THREE.BoxGeometry(0.85, 1, 0.7);
    eqGeo.translate(0, 0.5, 0);
    const eqMesh = new THREE.InstancedMesh(eqGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff }), EQ);
    for (let k = 0; k < EQ; k++) {
      D.position.set((k - (EQ - 1) / 2) * 1.05, 5.0, -R + 0.6);
      D.scale.set(1, 2, 1); D.rotation.set(0, 0, 0); D.updateMatrix();
      eqMesh.setMatrixAt(k, D.matrix);
      eqMesh.setColorAt(k, new THREE.Color(0x30ffa0));
    }
    eqMesh.instanceMatrix.needsUpdate = true;
    eqMesh.frustumCulled = false;
    roomG.add(eqMesh);
    this.eq = eqMesh; this.eqN = EQ; this.eqR = R;

    /* ---- lasers ---- */
    const laserCols = [0xff2fa0, 0x2fd8ff, 0x8cff2f, 0xffd42f, 0xb02fff, 0xff6a2f];
    for (let k = 0; k < 8; k++) {
      const col = laserCols[k % laserCols.length];
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 46),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55,
          blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      const pivot = new THREE.Group();
      pivot.position.set(Math.sin(k / 8 * TAU) * 16, 19, Math.cos(k / 8 * TAU) * 16);
      g.position.z = -20;
      pivot.add(g); roomG.add(pivot);
      this.lasers.push({ pivot: pivot, beam: g, k: k });
    }

    /* ---- sweeping spotlight cones ---- */
    const spotCols = [0xff3fd0, 0x3fd0ff, 0xd0ff3f, 0xffb03f];
    for (let k = 0; k < 4; k++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(3.6, 20, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: spotCols[k], transparent: true, opacity: 0.13,
          side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      const piv = new THREE.Group();
      piv.position.set(Math.sin(k / 4 * TAU + 0.4) * 13, 20, Math.cos(k / 4 * TAU + 0.4) * 13);
      cone.position.y = -10; piv.add(cone); roomG.add(piv);
      const pl = new THREE.PointLight(spotCols[k], 0.6, 40, 1.6);
      pl.position.copy(piv.position); roomG.add(pl);
      this.spots.push({ piv: piv, cone: cone, light: pl, k: k });
    }

    /* ---- confetti ---- */
    const cGeo = new THREE.BoxGeometry(0.34, 0.06, 0.20);
    const conf = new THREE.InstancedMesh(cGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff }), 190);
    this.confState = [];
    for (let k = 0; k < 190; k++) {
      this.confState.push({
        x: rand(-24, 24), y: rand(12, 40), z: rand(-24, 24),
        vy: rand(2.6, 6.2), rx: rand(0, 6), rz: rand(0, 6),
        sx: rand(2, 7), sz: rand(2, 7)
      });
      conf.setColorAt(k, new THREE.Color().setHSL(Math.random(), 0.95, 0.62));
    }
    conf.instanceMatrix.needsUpdate = true;
    conf.frustumCulled = false; conf.visible = false;
    roomG.add(conf); this.confetti = conf;

    /* ---- embers (for the fire) ---- */
    const eGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const emb = new THREE.InstancedMesh(eGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), 160);
    this.embState = [];
    for (let k = 0; k < 160; k++) {
      this.embState.push({ x: PILLAR_AT.x + rand(-4, 4), y: rand(0, 26), z: PILLAR_AT.z + rand(-4, 4),
        vy: rand(3.5, 10), w: rand(0.4, 2.0), p: rand(0, 6) });
      emb.setColorAt(k, new THREE.Color().setHSL(rand(0.02, 0.11), 1, rand(0.5, 0.72)));
    }
    emb.instanceMatrix.needsUpdate = true;
    emb.frustumCulled = false; emb.visible = false;
    roomG.add(emb); this.embers = emb;

    /* ---- backup dancers: little silhouettes at the back ---- */
    for (let k = 0; k < 5; k++) {
      const d = new THREE.Group();
      const body = capsuleBox(1.5, 3.0, 1.0, new THREE.MeshLambertMaterial({ color: 0x120e20 }));
      body.position.y = 2.4; d.add(body);
      const hd = sph(1.0, new THREE.MeshLambertMaterial({ color: 0x140f24 }), 0.9, 1.1, 0.95, 10);
      hd.position.y = 4.7; d.add(hd);
      for (const sx of [-1, 1]) {
        const arm = capsuleBox(0.45, 2.4, 0.45, new THREE.MeshLambertMaterial({ color: 0x120e20 }));
        arm.position.set(sx * 1.05, 2.9, 0); d.add(arm);
      }
      d.position.set(-13 + k * 6.5, 0, -11.5);
      d.scale.setScalar(0.85);
      d.visible = false;
      roomG.add(d);
      this.dancers.push({ g: d, ph: k * 0.7 });
    }

    /* ---- the pillar of confiscated anime ---- */
    const pil = new THREE.Group();
    pil.position.set(PILLAR_AT.x, -14, PILLAR_AT.z);   // rises out of the floor later
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.1, 1.2, 12),
      new THREE.MeshLambertMaterial({ color: 0x241c3c }));
    plinth.position.y = 0.6; pil.add(plinth);
    for (let k = 0; k < 16; k++) {
      const bk = makeMangaBook(k % 5);
      bk.scale.setScalar(1.5);
      bk.position.y = 1.2 + k * 0.52;
      bk.rotation.y = k * 0.55 + rand(-0.15, 0.15);
      pil.add(bk); this.books.push(bk);
    }
    const cap = sph(1.1, new THREE.MeshBasicMaterial({ color: 0xff86d0 }), 1, 0.6, 1, 12);
    cap.position.y = 1.2 + 16 * 0.52 + 0.3; pil.add(cap);
    roomG.add(pil); this.pillar = pil;

    /* ---- flames, waiting to be needed ---- */
    const fcols = [0xffe14d, 0xff9a1e, 0xe8371c];
    for (let ring = 0; ring < 3; ring++) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + ring * 0.3;
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.85 - ring * 0.18, 5 - ring, 6),
          new THREE.MeshBasicMaterial({ color: fcols[ring], transparent: true,
            opacity: 0.9 - ring * 0.15, depthWrite: false, fog: false }));
        f.position.set(Math.sin(a) * (2.4 - ring * 0.6), 2 + ring * 1.6, Math.cos(a) * (2.4 - ring * 0.6));
        f.visible = false;
        pil.add(f);
        this.flames.push({ m: f, a: a, ring: ring, k: k });
      }
    }
    for (let k = 0; k < 3; k++) {
      const fl = new THREE.PointLight(0xff7a1e, 0, 70, 1.4);
      fl.position.set(PILLAR_AT.x + Math.sin(k / 3 * TAU) * 4, 5,
                      PILLAR_AT.z + Math.cos(k / 3 * TAU) * 4);
      roomG.add(fl); this.fireLights.push(fl);
    }

    /* ---- giant manga books that orbit him through the chorus ---- */
    this.orbit = [];
    for (let k = 0; k < 6; k++) {
      const bk = makeMangaBook(k % 5);
      bk.scale.setScalar(1.5);
      bk.visible = false;
      roomG.add(bk);
      this.orbit.push({ m: bk, a: (k / 6) * TAU, y: 8 + (k % 3) * 2.6, r: 12.5 + (k % 2) * 2.5 });
    }

    /* ---- haze ---- */
    for (let k = 0; k < 6; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(26, 14),
        new THREE.MeshBasicMaterial({ color: 0x6a4fa8, transparent: true, opacity: 0.05,
          depthWrite: false, fog: false }));
      m.position.set(rand(-8, 8), rand(3, 15), rand(-14, 8));
      roomG.add(m); this.smoke.push(m);
    }

    /* ---- the man himself ---- */
    const m = makeBaldi();
    m.root.position.set(0, 0, 0);
    m.root.scale.setScalar(1.05);
    S.add(m.root);
    this.model = m;
    m.root.rotation.order = 'YXZ';        // spin first, then tip him over
    this.rig = {
      headRX: 0, headRZ: 0, torsoRY: 0, torsoRZ: 0, torsoRX: 0,
      aLx: 0, aLz: 0, aRx: 0, aRz: 0, foreL: 0, foreR: 0,
      lLx: 0, lRx: 0, lLz: 0, lRz: 0,
      x: 0, y: 0, z: 0, spin: 0, tilt: 0, roll: 0, sx: 1, sy: 1
    };
    /* spiral discs for the crazy eyes, hidden until the burn */
    const spiralTex = (function () {
      const S2 = 96, { c, x } = cv(S2, S2);
      x.fillStyle = '#fff6e6'; x.fillRect(0, 0, S2, S2);
      x.strokeStyle = '#121016'; x.lineWidth = 4.6;
      x.lineCap = 'round'; x.beginPath();
      for (let a = 0; a < 30; a += 0.12) {
        const r = a * 1.55, px = 48 + Math.cos(a) * r, py = 48 + Math.sin(a) * r;
        a ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.stroke();
      x.fillStyle = '#d81f2a';                       // a mad little dot in the middle
      x.beginPath(); x.arc(48, 48, 5.5, 0, Math.PI * 2); x.fill();
      return texFrom(c, 1, 1);
    })();
    for (const eye of [m.eyeL, m.eyeR]) {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.27, 18),
        new THREE.MeshBasicMaterial({ map: spiralTex, transparent: true }));
      disc.position.z = 0.235; disc.visible = false;
      eye.g.add(disc);
      this.spirals.push(disc);
    }

    /* ---- the six machines, all hidden until their moment ---- */
    this.machines = {};
    const MK = { shredder: makeShredder, press: makePress, cannon: makeCannon,
                 chipper: makeChipper, anvil: makeAnvil, rocket: makeRocket };
    for (const id in MK) {
      const mm = MK[id]();
      mm.position.set(MACH_AT.x, 0, MACH_AT.z);
      mm.visible = false;
      S.add(mm);
      this.machines[id] = mm;
    }
    /* the book each machine is about to ruin */
    this.victim = makeMangaBook(3);
    this.victim.scale.setScalar(2.2);
    this.victim.visible = false;
    S.add(this.victim);
    /* and the mess it makes */
    this.debris = makeDebris(220, 0.55);
    S.add(this.debris);

    /* ---- the obby ---- */
    this.obby = makeObby();
    S.add(this.obby);
    this.obbyPath = this.obby.userData.path;
    /* the lava's reply */
    this.splash = new THREE.Mesh(new THREE.RingGeometry(0.66, 1.0, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false, fog: false }));
    this.splash.rotation.x = -Math.PI / 2; this.splash.visible = false;
    this.obby.add(this.splash);
    this.splashCol = new THREE.Mesh(new THREE.ConeGeometry(1.9, 9, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd86a, transparent: true, opacity: 0,
        depthWrite: false, fog: false }));
    this.splashCol.visible = false; this.obby.add(this.splashCol);

    /* ---- the six big set-pieces ---- */
    this.sets = {
      sniper: makeSniperSet(), csgo: makeCSGOSet(), sans: makeSansSet(),
      huggy: makeHuggySet(),   cane: makeCaneSet(), cup: makeCupSet(),
      sgschool: makeSGSchoolSet(), tsb: makeTSBSet(), naoya: makeNaoyaSet(),
      home: makeHomeSet()
    };
    /* the coat he wears for the duel, and eight of him */
    this.haori = makeHaori();
    this.haori.visible = false;
    m.torso.add(this.haori);
    this.ghosts = makeAfterimages(m, 6, 0x9fe0ff);
    for (const gh of this.ghosts.ghosts) S.add(gh.g);
    this.girlGhosts = null;
    this.hitStopT = 0;
    /* her. One model, moved between the sets that need her. */
    this.girl = makeAnimeGirl();
    this.girl.root.visible = false;
    S.add(this.girl.root);
    for (const id in this.sets) S.add(this.sets[id]);

    /* fire background texture, built now, swapped in at the burn */
    this.fireTex = (function () {
      const { c, x } = cv(128, 128);
      const g2 = x.createLinearGradient(0, 128, 0, 0);
      g2.addColorStop(0, '#ffe14d'); g2.addColorStop(0.35, '#ff7a1e');
      g2.addColorStop(0.72, '#c9200f'); g2.addColorStop(1, '#3a0602');
      x.fillStyle = g2; x.fillRect(0, 0, 128, 128);
      for (let k = 0; k < 1400; k++) {
        x.fillStyle = Math.random() < .5 ? 'rgba(255,220,120,.30)' : 'rgba(120,10,0,.35)';
        x.fillRect(Math.random() * 128, Math.random() * 128, 4, 6);
      }
      return texFrom(c, 4, 2);
    })();
  },

  /* =====================================================================
     Per-frame
     ===================================================================== */
  update(dt) {
    if (!this.active) return;
    const ctx = Audio1.ctx;
    if (this.audioT0 != null && ctx && ctx.state === 'running') {
      this.t = Math.max(0, ctx.currentTime - this.audioT0);
    } else {
      this.t += dt;
    }
    const t = this.t;

    this.tickTimeline(t);
    if (this.hitStopT > 0) { this.hitStopT -= dt; return; }   // held frame
    this.tickActs(dt, t);
    if (this.roomG.visible) this.tickRoom(dt, t);
    this.tickDance(dt, t);
    this.tickCamera(dt, t);

    if (t > DJ_END) { this.finish(); return; }
  },

  /* --------------------------------------------------------- timeline */
  tickTimeline(t) {
    /* lyrics */
    let li = -1;
    for (let i = 0; i < DJ_LYRICS.length; i++) if (DJ_LYRICS[i].t <= t) li = i;
    if (li !== this.lyricIdx) {
      this.lyricIdx = li;
      const el = UI.el('lyric');
      const L = li >= 0 ? DJ_LYRICS[li] : null;
      el.classList.remove('pop');
      if (L && L.s) {
        el.textContent = L.s;
        el.className = L.shout ? 'shout' : '';
        void el.offsetWidth;                       // restart the pop
        el.classList.add('pop');
        if (L.shout) DJAudio.impact();
      } else { el.textContent = ''; }
    }

    /* dance moves */
    let mi = -1;
    for (let i = 0; i < DJ_MOVES.length; i++) if (DJ_MOVES[i].t <= t) mi = i;
    if (mi !== this.moveIdx) {
      this.moveIdx = mi;
      this.move = mi >= 0 ? DJ_MOVES[mi].m : 'arrive';
      this.moveT = 0;
      if (this.move === 'jumpspin') DJAudio.whoosh();
    }
    this.moveT += 1 / 60;

    /* camera cuts */
    let si = -1;
    for (let i = 0; i < DJ_SHOTS.length; i++) if (DJ_SHOTS[i].t <= t) si = i;
    if (si !== this.shotIdx) { this.shotIdx = si; this.shot = DJ_SHOTS[si] || DJ_SHOTS[0]; this.shotT = 0; }

    /* one-off beats */
    if (!this._did) this._did = {};
    const once = (key, at, fn) => { if (!this._did[key] && t >= at) { this._did[key] = 1; fn(); } };
    once('confetti', 32, () => { this.confetti.visible = true; DJAudio.impact(); });
    once('dancers', 16, () => { for (const d of this.dancers) d.g.visible = true; });
    once('riser1', 28, () => DJAudio.riser(4));
    once('title', 32, () => { this.card('CONFISCATE!'); });
    once('title2', 44, () => { this.card(null); });

    /* the floor section */
    once('floorIn', 48, () => { this.confetti.visible = false; DJAudio.scratch(Audio1.ctx.currentTime, true); });
    once('floorCard', 52.5, () => this.card('THE FLOOR'));
    once('floorCard2', 56, () => this.card(null));
    once('freezeHit', 69.5, () => DJAudio.impact());

    /* one title card per machine */
    once('m1', 72.5,  () => this.card('1 · SHREDDER'));
    once('m1b', 77.5, () => this.card(null));
    once('m2', 80.0,  () => this.card('2 · THE PRESS'));
    once('m2b', 85.0, () => this.card(null));
    once('m3', 87.5,  () => this.card('3 · CANNON'));
    once('m3b', 92.5, () => this.card(null));
    once('m4', 94.5,  () => this.card('4 · WOOD CHIPPER'));
    once('m4b', 99.5, () => this.card(null));
    once('m5', 102.0, () => this.card('5 · ANVIL'));
    once('m5b', 107.0, () => this.card(null));
    once('m6', 109.5, () => this.card('6 · ORBIT'));
    once('m6b', 114.5, () => this.card(null));

    /* the obby */
    once('obbyIn', 116, () => {
      DJAudio.riser(3.4); this.card('7 · THE OBBY');
      for (const d of this.debris.userData.state) d.life = 0;   // tidy the shop floor
    });
    once('obbyCard', 121, () => this.card(null));
    once('obbyEnd', 146.0, () => this.card('OOF'));
    once('obbyEnd2', 147.5, () => this.card(null));

    /* the six new methods */
    once('a8',  148,   () => { this.card('8 · SNIPER'); this.fx(''); });
    once('a8b', 152.5, () => this.card(null));
    once('a9',  164.5, () => { this.card('9 · BOMBSITE A'); DJAudio.impact(); });
    once('a9b', 169,   () => this.card(null));
    once('a10', 186.5, () => { this.card('10 · SANS'); DJAudio.riser(3); });
    once('a10b', 190,  () => this.card(null));
    once('a11', 212.5, () => { this.card('11 · CHAPTER ONE'); });
    once('a11b', 216,  () => this.card(null));
    once('a12', 234.5, () => { this.card('12 · SIX OF THE BEST'); });
    once('a12b', 239,  () => this.card(null));
    once('a13', 250.5, () => { this.card('13 · THE FINAL'); DJAudio.riser(4); });
    once('a13b', 255,  () => this.card(null));

    once('a14', 280.5, () => { this.card('14 · SECONDARY SCHOOL'); });
    once('a14b', 285,  () => this.card(null));
    once('a15', 306.5, () => { this.card('15 · THE ARENA'); DJAudio.impact(); });
    once('a15b', 311,  () => this.card(null));

    /* back inside for the finale */
    once('backIn', 402, () => { this.confetti.visible = true; DJAudio.riser(9); });
    once('burnStart', 412, () => {
      DJAudio.impact();
      this.embers.visible = true;
      for (const f of this.flames) f.m.visible = true;
      for (const d of this.spirals) d.visible = true;
      this.scene.fog.color.setHex(0x431003);
      this.scene.background = new THREE.Color(0x431003);
      this.wallMat.map = this.fireTex; this.wallMat.needsUpdate = true;
      this.wallMat.color.setHex(0xb06a4a);
    });
    once('burnBig', 420, () => { DJAudio.impact(); this.confetti.visible = false; });
    once('endTitle', 435, () => this.card('CONFISCATED'));

    /* the pillar rides up out of the floor on the bridge */
    if (t >= 402) {
      const k = clamp((t - 402) / 3.2, 0, 1);
      this.pillar.position.y = lerp(-14, 0, easeOutBack(k));
      this.pillar.position.x = PILLAR_AT.x; this.pillar.position.z = PILLAR_AT.z;
      this.pillar.rotation.y = t * 0.35;
    }
    /* burn strength — and it cools off once the epilogue starts, because he
       cannot walk into his own hallway still on fire */
    this.burn = t < 440 ? clamp((t - 412) / 3.0, 0, 1)
                        : clamp(1 - (t - 440) / 2.0, 0, 1);
  },

  /* --- effect helpers used by the duel --- */
  wave(x, z, y, spd, life, col) {
    const U = this.sets.naoya.userData;
    for (const w of U.waves) {
      if (w.t >= 0) continue;
      w.t = 0; w.x = x; w.z = z; w.y = y || 0.25;
      w.spd = spd || 55; w.life = life || 1.1;
      if (col !== undefined) w.m.material.color.setHex(col);
      w.m.visible = true;
      return;
    }
  },
  crackAt(x, z, size) {
    const U = this.sets.naoya.userData;
    const c = U.cracks[(this._crack = ((this._crack || 0) + 1)) % U.cracks.length];
    c.visible = true; c.position.set(x, 0.08, z);
    c.scale.set(size, size, 1); c.rotation.z = rand(0, 6);
    c.material.opacity = 0.95;
  },
  hitStop(d) { this.hitStopT = Math.max(this.hitStopT, d); },

  /* raw HTML for the set-piece overlays */
  fx(html) { UI.el('djFX').innerHTML = html || ''; },

  /* a big title card, or null to clear it */
  card(text) {
    const el = UI.el('djTitle');
    if (text) { el.textContent = text; el.classList.add('on'); }
    else el.classList.remove('on');
  },

  /* ------------------------------------------------------------- room */
  tickRoom(dt, t) {
    const th = thump(t, 7), th2 = thump(t + BEAT / 2, 12);
    const beat = onBeat(t), bar = Math.floor(t / BAR);
    const lit = t > 6.0;                            // house lights up after the intro

    /* ---- floor tiles ---- */
    const N = this.tileN, tiles = this.tiles, C = this.tmpCol;
    const mode = bar % 4;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const i = r * N + c;
      let on = 0, hue = 0;
      if (!lit) { on = 0.04; hue = 0.72; }
      else if (this.burn > 0.05) {
        const d = Math.hypot(c - (N - 1) / 2, r - (N - 1) / 2);
        on = clamp(0.25 + Math.sin(t * 6 - d * 0.9) * 0.5 + th * 0.5, 0.06, 1) * (0.4 + this.burn);
        hue = 0.02 + Math.sin(t * 3 + d) * 0.04;
      } else if (mode === 0) {                       // checker flash
        on = ((r + c + beat) % 2) ? 0.95 : 0.10; hue = ((r + c) * 0.07 + beat * 0.11) % 1;
      } else if (mode === 1) {                       // ripple from the centre
        const d = Math.hypot(c - (N - 1) / 2, r - (N - 1) / 2);
        on = clamp(0.9 - Math.abs(((t * 5) % (N)) - d) * 0.55, 0.06, 1);
        hue = (d * 0.06 + t * 0.10) % 1;
      } else if (mode === 2) {                       // marching columns
        on = ((c + beat) % 4 < 2) ? 0.9 : 0.08; hue = (c * 0.08 + bar * 0.13) % 1;
      } else {                                       // random sparkle, held per beat
        const n = ((i * 2654435761 + beat * 40503) % 97) / 97;
        on = n > 0.62 ? 0.95 : 0.09; hue = (n + beat * 0.05) % 1;
      }
      C.setHSL(hue, 0.95, 0.06 + on * 0.52);
      tiles.setColorAt(i, C);
    }
    tiles.instanceColor.needsUpdate = true;

    /* ---- equalizer ---- */
    const D = new THREE.Object3D();
    for (let k = 0; k < this.eqN; k++) {
      const n = 0.5 + 0.5 * Math.sin(t * (3 + (k % 5)) + k * 0.9);
      const h = lit ? (1.5 + n * 7 + th * 4.5) : 0.6;
      D.position.set((k - (this.eqN - 1) / 2) * 1.05, 0.4, -this.eqR + 0.6);
      D.scale.set(1, h, 1); D.rotation.set(0, 0, 0); D.updateMatrix();
      this.eq.setMatrixAt(k, D.matrix);
      this.tmpCol.setHSL(this.burn > 0.05 ? 0.03 : (0.33 - n * 0.30 + t * 0.05) % 1, 1, 0.55);
      this.eq.setColorAt(k, this.tmpCol);
    }
    this.eq.instanceMatrix.needsUpdate = true;
    if (this.eq.instanceColor) this.eq.instanceColor.needsUpdate = true;

    /* ---- mirror ball, lasers, spots ---- */
    this.ball.rotation.y += dt * 0.9;
    this.ball.position.y = 24 - (t > 2 ? clamp((t - 2) / 2.2, 0, 1) * 8 : 0);
    this.ballLight.position.y = this.ball.position.y - 8;
    this.ballLight.intensity = lit ? 0.35 + th * 0.5 : 0.12;

    for (const L of this.lasers) {
      L.pivot.rotation.y = t * (0.5 + L.k * 0.09) * (L.k % 2 ? -1 : 1);
      L.pivot.rotation.x = -0.9 + Math.sin(t * 1.6 + L.k) * 0.45;
      L.beam.material.opacity = lit ? (0.22 + th * 0.55) * (this.burn > 0.05 ? 0.5 : 1) : 0;
      if (this.burn > 0.05) L.beam.material.color.setHSL(0.03 + Math.sin(t + L.k) * 0.03, 1, 0.55);
    }
    for (const S2 of this.spots) {
      S2.piv.rotation.z = Math.sin(t * 0.9 + S2.k * 1.7) * 0.7;
      S2.piv.rotation.x = Math.cos(t * 0.7 + S2.k) * 0.6;
      S2.cone.material.opacity = lit ? 0.09 + th * 0.16 : 0.03;
      S2.light.intensity = lit ? 0.35 + th2 * 0.9 : 0.1;
      if (this.burn > 0.05) S2.light.color.setHex(0xff6a1e);
    }

    /* ---- decks and LEDs ---- */
    for (const d of this.decks) d.rotation.y += dt * 5.5;
    this.boothLip.material.color.setHSL((t * 0.35) % 1, 1, 0.6);
    this.mixLeds.forEach((l, k) => {
      const on = (0.5 + 0.5 * Math.sin(t * 9 + k)) > 0.45;
      l.material.color.setHex(on ? (k > 5 ? 0xff2f2f : 0x2fff6a) : 0x123018);
    });

    /* ---- speakers punch on the kick ---- */
    const punch = 1 + th * 0.28;
    for (const c of this.speakers) c.scale.set(punch, punch, punch);
    if (this.speakerStacks) for (const s of this.speakerStacks) s.scale.set(1, 1 + th * 0.06, 1);

    /* ---- backup dancers ---- */
    this.dancers.forEach((d, k) => {
      if (!d.g.visible) return;
      const p = t * Math.PI / BEAT + d.ph;
      d.g.position.y = Math.abs(Math.sin(p)) * 1.1;
      d.g.rotation.z = Math.sin(p * 0.5) * 0.14;
      d.g.rotation.y = Math.sin(t * 1.1 + d.ph) * 0.5;
      const sq = 1 + thump(t + d.ph * 0.1, 9) * 0.14;
      d.g.scale.set(0.85 * sq, 0.85 / sq, 0.85 * sq);
    });

    /* ---- confetti ---- */
    if (this.confetti.visible) {
      const M = new THREE.Object3D();
      this.confState.forEach((c, k) => {
        c.y -= c.vy * dt;
        if (c.y < -1) { c.y = rand(26, 42); c.x = rand(-24, 24); c.z = rand(-24, 24); }
        M.position.set(c.x + Math.sin(t * 1.6 + k) * 1.2, c.y, c.z);
        M.rotation.set(t * c.sx, 0, t * c.sz);
        M.scale.setScalar(1); M.updateMatrix();
        this.confetti.setMatrixAt(k, M.matrix);
      });
      this.confetti.instanceMatrix.needsUpdate = true;
    }

    /* ---- fire ---- */
    if (this.burn > 0.01) {
      const b = this.burn;
      for (const f of this.flames) {
        const w = 0.7 + Math.sin(t * 11 + f.k * 1.3 + f.ring) * 0.28;
        const s = b * (1.1 + th * 0.45) * w;
        f.m.scale.set(s * (1.0 + b * 0.5), s * (1.5 + b * 2.4), s * (1.0 + b * 0.5));
        f.m.position.y = 2 + f.ring * 1.6 + Math.sin(t * 5 + f.k) * 0.4 + b * 2;
        f.m.rotation.y = t * 2 + f.k;
      }
      this.fireLights.forEach((l, k) => {
        l.intensity = b * (1.6 + Math.sin(t * 17 + k * 2) * 0.5);
        l.distance = 40 + b * 50;
      });
      const M = new THREE.Object3D();
      this.embState.forEach((e, k) => {
        e.y += e.vy * dt;
        if (e.y > 27) { e.y = rand(-1, 2); e.x = PILLAR_AT.x + rand(-5, 5); e.z = PILLAR_AT.z + rand(-5, 5); }
        M.position.set(e.x + Math.sin(t * e.w + e.p) * (1.2 + e.y * 0.12), e.y,
                       e.z + Math.cos(t * e.w * 0.8 + e.p) * (1.2 + e.y * 0.12));
        M.rotation.set(t * 3, t * 2, 0);
        const sc = clamp(1 - e.y / 30, 0.15, 1) * (0.7 + b * 0.8);
        M.scale.setScalar(sc); M.updateMatrix();
        this.embers.setMatrixAt(k, M.matrix);
      });
      this.embers.instanceMatrix.needsUpdate = true;

      /* the books char and shrink as they go */
      const eat = clamp((this.t - 60) / 14, 0, 1);
      this.books.forEach((bk, k) => {
        const gone = eat * this.books.length;
        if (k > this.books.length - 1 - gone) { bk.visible = false; return; }
        bk.rotation.z = Math.sin(t * 3 + k) * 0.06 * b;
      });
      /* the whole room pulses red */
      const f = 0.5 + 0.5 * Math.sin(t * 9);
      this.scene.background.setHSL(0.02, 0.9, 0.06 + f * 0.05 * b);
      this.scene.fog.color.copy(this.scene.background);
      this.wallMat.map.offset.y = -t * 0.35;
    }

    /* ---- the orbiting books: circle, then get dragged into the pile ---- */
    if (this.orbit) {
      const show = t > 32 && t < 48.5;
      for (const o of this.orbit) {
        o.m.visible = show;
        if (!show) continue;
        const suck = clamp((t - 46.2) / 2.3, 0, 1);
        const a = o.a + t * 0.8;
        const r = lerp(o.r, 0.6, suck);
        const yy = lerp(o.y + Math.sin(t * 2 + o.a) * 0.9, 5, suck);
        o.m.position.set(lerp(0, PILLAR_AT.x, suck) + Math.sin(a) * r, yy,
                         lerp(0, PILLAR_AT.z, suck) + Math.cos(a) * r);
        o.m.rotation.set(t * 1.3 + o.a, t * 2.1, Math.sin(t * 3 + o.a) * 0.5);
        o.m.scale.setScalar(lerp(1.5, 0.15, suck) * (1 + th * 0.12));
      }
    }

    /* haze drift */
    this.smoke.forEach((m, k) => {
      m.position.x = Math.sin(t * 0.24 + k) * 10;
      m.position.y = 4 + ((t * 0.5 + k * 3) % 16);
      m.material.opacity = (this.burn > 0.05 ? 0.10 : 0.05) + th * 0.02;
      m.material.color.setHex(this.burn > 0.05 ? 0xff8a3a : 0x6a4fa8);
      m.lookAt(this.camera.position);
    });
  },

  /* =====================================================================
     The machines and the obby
     ===================================================================== */
  tickActs(dt, t) {
    const inObby = t >= OBBY_T0 && t < OBBY_END;
    const inMach = t >= MACHINES[0].t0 && t < MACHINES[MACHINES.length - 1].t1;
    const BA = BIG_ACTS.find(a => t >= a.t0 && t < a.t1);

    /* --- only one world at a time --- */
    for (const id in this.sets) this.sets[id].visible = (BA && BA.id === id);
    if (this.girl) this.girl.root.visible =
      !!(BA && (BA.id === 'sgschool' || BA.id === 'tsb' || BA.id === 'naoya'));
    if (this.haori) this.haori.visible = !!(BA && BA.id === 'naoya' && t > BA.t0 + 8);
    if (this.ghosts && !(BA && BA.id === 'naoya')) {
      for (const gh of this.ghosts.ghosts) gh.g.visible = false;
    }
    this.roomG.visible = !inObby && !BA;
    this.obby.visible = inObby;
    if (BA) { this.runBigAct(BA, t, dt); updateDebris(this.debris, dt); return; }
    if (this.actPose) { this.actPose = null; this.fx(''); }
    this.homeMove = null;
    if (inObby) {
      this.scene.fog.near = 300; this.scene.fog.far = 1200;
      this.scene.background.setHex(0x7fb6ee);
      this.amb.intensity = 0.95; this.amb.color.setHex(0xffffff);
      this.keyLight.intensity = 0.55;
    } else if (!this.burn) {
      this.scene.fog.near = 26; this.scene.fog.far = 78;
      this.scene.background.setHex(0x05030c);
      this.amb.intensity = 0.55; this.amb.color.setHex(0x6a5f9c);
      this.keyLight.intensity = 0.42;
    }

    /* --- machines --- */
    for (const id in this.machines) this.machines[id].visible = false;
    this.victim.visible = false;
    if (inMach) {
      const M = MACHINES.find(m => t >= m.t0 && t < m.t1) || MACHINES[0];
      const g = this.machines[M.id];
      g.visible = true;
      const inK = clamp((t - M.t0) / 1.0, 0, 1);          // slides in
      const outK = clamp((M.t1 - t) / 0.7, 0, 1);          // and out again
      g.position.set(MACH_AT.x, 0, MACH_AT.z);
      g.scale.setScalar(lerp(0.02, 1, easeOutBack(inK)) * lerp(0.02, 1, outK));
      g.rotation.y = lerp(-1.2, 0, easeOutBack(inK));
      if (!this._did['fire_' + M.id] && t >= M.fire) {
        this._did['fire_' + M.id] = 1;
        this.punchT = 0.55;
        this.fireMachine(M.id);
      }
      this.runMachine(M, g, t, dt);
    }
    updateDebris(this.debris, dt);

    /* --- the obby --- */
    if (inObby) this.runObby(t, dt);
  },

  fireMachine(id) {
    const A = MACH_AT;
    if (id === 'shredder') { DJAudio.clank(Audio1.ctx.currentTime, 2200); DJAudio.impact(); }
    else if (id === 'press') { DJAudio.impactAt(Audio1.ctx.currentTime); DJAudio.clank(Audio1.ctx.currentTime, 1200); }
    else if (id === 'cannon') { DJAudio.impact(); DJAudio.whoosh(); }
    else if (id === 'chipper') { DJAudio.clank(Audio1.ctx.currentTime, 3400); }
    else if (id === 'anvil') { DJAudio.impact(); DJAudio.clank(Audio1.ctx.currentTime, 900); }
    else if (id === 'rocket') { DJAudio.riser(2.6); DJAudio.impact(); }
  },

  runMachine(M, g, t, dt) {
    const A = MACH_AT, V = this.victim, U = g.userData || {};
    const since = t - M.fire;
    const pre = clamp((t - M.t0 - 0.9) / (M.fire - M.t0 - 0.9), 0, 1);
    V.visible = true;
    V.rotation.set(0, t * 1.1, 0);
    V.scale.setScalar(2.2);

    if (M.id === 'shredder') {
      if (U.teeth) U.teeth.rotation.x = t * 22;
      if (U.lamp) U.lamp.material.color.setHex(since > 0 ? 0xff3030 : 0x3fff86);
      V.position.set(A.x, lerp(12, 6.9, easeOutBack(pre)), A.z);
      V.rotation.set(0.2, t * 1.4, 0);
      if (since > 0) {
        const eat = clamp(since / 0.55, 0, 1);
        V.position.y = lerp(6.9, 6.1, eat);
        V.scale.set(2.2, 2.2 * (1 - eat), 2.2);
        if (eat >= 1) V.visible = false;
        if (since < 2.2) burstDebris(this.debris, A.x + rand(-1.6, 1.6), 1.2, A.z + 2.3, 3, 3.2, 5.5);
      }

    } else if (M.id === 'press') {
      V.position.set(A.x, 1.5, A.z);
      V.rotation.set(0, 0.4, 0);
      if (since < 0) {
        if (U.ram) U.ram.position.y = 9.0 + Math.sin(t * 2) * 0.25;
      } else {
        const d = clamp(since / 0.22, 0, 1);
        const up = clamp((since - 1.5) / 1.2, 0, 1);
        if (U.ram) U.ram.position.y = lerp(lerp(9.0, 1.85, d), 9.0, easeOutBack(up));
        const flat = clamp(since / 0.26, 0, 1);
        V.scale.set(2.2 + flat * 1.5, 2.2 * (1 - flat * 0.94), 2.2 + flat * 1.0);
        V.position.y = lerp(1.5, 1.25, flat);
        if (!this._did.pressPuff && since > 0.20) {
          this._did.pressPuff = 1;
          burstDebris(this.debris, A.x, 1.4, A.z, 34, 7.5, 4.0);
        }
      }
      if (U.gauge) U.gauge.rotation.z = -Math.min(2.6, Math.max(0, since) * 9);

    } else if (M.id === 'cannon') {
      g.rotation.y = lerp(-1.2, -Math.PI / 2, easeOutBack(clamp((t - M.t0) / 1.0, 0, 1)));
      const piv = U.pivot;
      if (piv) piv.rotation.x = -0.55 + Math.sin(t * 1.4) * 0.05;
      const dir = new THREE.Vector3(-1, 0.60, 0).normalize();
      if (since < 0) {
        V.position.set(A.x - 5.4, 6.6, A.z);
        V.rotation.set(0, 1.5, 0.3);
      } else {
        if (U.flash) U.flash.visible = since < 0.22;
        g.position.x = A.x + Math.max(0, 2.4 - since * 9) * 1.0;   // recoil
        const f = since * 34;
        V.position.set(A.x - 5.4 + dir.x * f, 6.6 + dir.y * f - since * since * 5.5, A.z + dir.z * f);
        V.rotation.set(since * 12, since * 9, 0);
        V.scale.setScalar(Math.max(0.05, 2.2 - since * 0.9));
        if (since > 1.9) V.visible = false;
      }

    } else if (M.id === 'chipper') {
      if (U.hopper) U.hopper.rotation.y = Math.PI / 4 + Math.sin(t * 3) * 0.05;
      V.position.set(A.x, lerp(13, 7.6, easeOutBack(pre)), A.z + 0.4);
      V.rotation.set(0.5, t * 2.2, 0.2);
      if (since > 0) {
        const eat = clamp(since / 0.5, 0, 1);
        V.position.y = lerp(7.6, 6.2, eat);
        V.scale.setScalar(2.2 * (1 - eat));
        if (eat >= 1) V.visible = false;
        if (since < 2.6) {
          burstDebris(this.debris, A.x, 8.0, A.z - 4.8, 5, 2.0, 1.0);
          const S2 = this.debris.userData.state;
          for (let q = 1; q <= 5; q++) {
            const pt = S2[(this.debris.userData.cur - q + S2.length) % S2.length];
            pt.vz = -14 - Math.random() * 8; pt.vy = 5 + Math.random() * 5;
          }
        }
      }

    } else if (M.id === 'anvil') {
      V.position.set(A.x, 0.8, A.z);
      V.rotation.set(0, 0.6, 0);
      g.position.set(A.x, 0, A.z);
      if (since < 0) {
        g.position.y = 26 + Math.sin(t * 2) * 0.4;
        g.scale.setScalar(lerp(0.02, 1, easeOutBack(clamp((t - M.t0) / 1.0, 0, 1))));
      } else {
        const fall = since * since * 26;
        g.position.y = Math.max(0, 26 - fall);
        if (g.position.y <= 0.01) {
          const b = clamp((since - 0.98) / 0.9, 0, 1);
          g.position.y = Math.abs(Math.sin(b * 6)) * (1 - b) * 1.6;
          V.visible = false;
          if (!this._did.anvilHit) {
            this._did.anvilHit = 1;
            burstDebris(this.debris, A.x, 0.9, A.z, 46, 10.5, 6.5);
            this.shakeT = 0.5;
          }
        }
      }

    } else if (M.id === 'rocket') {
      const lift = Math.max(0, since);
      const h = lift * lift * 12;
      g.position.set(A.x, h, A.z);
      g.rotation.y = t * 0.4;
      if (U.plume) U.plume.visible = since > -0.35;
      V.position.set(A.x + 2.1, 4.2 + h, A.z);
      V.rotation.set(0, t * 1.6, 0.2);
      if (since > 0.25 && since < 2.6) burstDebris(this.debris, A.x, 0.6 + h * 0.1, A.z, 4, 4.5, 2.0);
      if (h > 60) { V.visible = false; g.visible = false; }
    }
  },

  /* =====================================================================
     Methods eight to thirteen
     ===================================================================== */
  runBigAct(A, t, dt) {
    const G2 = this.sets[A.id], U = G2.userData, O = ACT_AT[A.id];
    const k = t - A.t0;
    const P = (x, y, z, spin) => { this.actPose = { x: O.x + x, y: y, z: O.z + z, spin: spin }; };

    /* the epilogue runs its own lighting, so it goes before all of this */
    if (A.id === 'home') { runHomeAct(this, A, t, dt); return; }

    /* the world lights change per set */
    this.scene.fog.near = 200; this.scene.fog.far = 1400;
    if (A.id === 'sniper') { this.amb.intensity = 0.34; this.amb.color.setHex(0x8fa8d8); this.scene.background.setHex(0x0a1120); }
    else if (A.id === 'csgo') { this.amb.intensity = 0.92; this.amb.color.setHex(0xfff2d8); this.scene.background.setHex(0x9fc0d8); }
    else if (A.id === 'sans') { this.amb.intensity = 0.55; this.amb.color.setHex(0xc8d4ff); this.scene.background.setHex(0x000000); }
    else if (A.id === 'huggy') { this.amb.intensity = 0.30; this.amb.color.setHex(0x8fa0c0); this.scene.background.setHex(0x0a0908); }
    else if (A.id === 'cane') { this.amb.intensity = 0.80; this.amb.color.setHex(0xfff0d8); this.scene.background.setHex(0x3a3630); }
    else { this.amb.intensity = 0.95; this.amb.color.setHex(0xffffff); this.scene.background.setHex(0x2f4a86); }
    this.keyLight.intensity = A.id === 'sans' ? 0.25 : 0.5;

    /* ------------------------------------------------ 8 · sniper */
    if (A.id === 'sniper') {
      P(-2.4, 0, 5.6, 0);
      const scoped = k >= 5.5 && k < 11.2;
      const fired = k >= 10.4;
      const sway = scoped ? (k < 8.4 ? Math.sin(k * 1.7) * 0.9 : Math.sin(k * 0.5) * 0.12) : 0;
      U.rifle.rotation.y = sway * 0.012;
      U.rifle.rotation.x = Math.sin(k * 1.1) * (k < 8.4 ? 0.006 : 0.001);
      if (fired && k < 10.7) { U.rifle.position.z = 4 + (k - 10.4) * 9; U.flash.visible = k < 10.62; }
      else { U.rifle.position.z = lerp(U.rifle.position.z, 4, 1 - Math.exp(-dt * 6)); U.flash.visible = false; }
      if (!this._did.snipeShot && fired) {
        this._did.snipeShot = 1;
        DJAudio.impact(); DJAudio.clank(Audio1.ctx.currentTime, 4200);
        this.shakeT = 0.7;
        burstDebris(this.debris, O.x, 9.2, O.z - 150, 70, 9, 12);
      }
      U.book.visible = !fired;
      U.book.rotation.z = 0.2 + Math.sin(k) * 0.03;
      if (scoped && !fired) {
        const wind = 4, rng = 150;
        this.fx('<div class="fxScope"><div class="ring"></div><div class="cx"></div>' +
          '<div class="cy"></div>' +
          '<div class="rd a">RANGE ' + rng + 'M</div>' +
          '<div class="rd b">WIND ' + wind + ' &gt;</div>' +
          '<div class="rd c">7.62 &times; 51</div>' +
          '<div class="rd d">' + (k < 8.4 ? 'BREATHE' : 'HOLD') + '</div></div>');
      } else if (fired && k < 13.2) {
        this.fx('<div class="fxBanner">ONE SHOT.</div>');
      } else this.fx('');

    /* ------------------------------------------------ 9 · bombsite */
    } else if (A.id === 'csgo') {
      const planted = k >= 8.4, boom = k >= 18.0;
      if (k < 5.5) P(0, 0, 11 - k * 1.5, Math.PI);
      else if (k < 10) P(0, 0, 4.2, Math.PI);
      else P(0, 0, 4.2 + (k - 10) * 1.7, 0);
      U.c4.visible = planted && !boom;
      U.pile.visible = !boom;
      if (planted && !boom) {
        const left = clamp(1 - (k - 8.4) / 9.6, 0, 1);
        const rate = 1.5 + (1 - left) * 12;
        U.led.material.color.setHex((Math.sin(k * rate) > 0) ? 0xff2020 : 0x400808);
        if (!this._beep || Math.floor(k * rate / 3) !== this._beep) {
          this._beep = Math.floor(k * rate / 3);
          if (Audio1.ready && DJAudio.bus) DJAudio.blip(Audio1.ctx.currentTime, 1800, 0.05, 0.05, 'square');
        }
        this.fx('<div class="fxHud">BOMB PLANTED &nbsp;<b>' +
          Math.max(0, Math.ceil(left * 9.6)) + '</b>s</div>' +
          (k < 11 ? '<div class="fxBanner">THE BOMB HAS BEEN PLANTED.</div>' : ''));
      } else if (boom) {
        if (!this._did.csBoom) {
          this._did.csBoom = 1;
          DJAudio.impact(); DJAudio.impact();
          this.shakeT = 1.4;
          burstDebris(this.debris, O.x, 2, O.z + 2, 90, 14, 16);
        }
        const bk = k - 18.0;
        this.fx((bk < 0.35 ? '<div class="fxFlash"></div>' : '') +
          '<div class="fxScore"><span class="win">BALDI 16</span> : <span class="lose">0 ANIME</span></div>' +
          (bk > 0.6 ? '<div class="fxBanner">HEADSHOT</div>' : ''));
      } else this.fx('');

    /* ------------------------------------------------ 10 · the skeleton */
    } else if (A.id === 'sans') {
      P(9.5, 0, 6.5, -0.55);
      const sn = U.sans;
      sn.position.y = Math.sin(k * 2.2) * 0.14;
      sn.rotation.y = Math.sin(k * 0.6) * 0.12;
      U.eyeGlow.visible = k > 3.5 && (Math.sin(k * 14) > -0.6);
      U.eyeGlow.scale.setScalar(1 + Math.sin(k * 9) * 0.18);
      /* the book bobs inside the box */
      U.soul.position.set(Math.sin(k * 2.1) * 3.4, 5 + Math.cos(k * 1.6) * 1.8, 4.4);
      U.soul.rotation.y = k * 1.5;
      const hp = clamp(1 - (k - 5) / 17, 0, 1);
      /* bones sweep through from 5s */
      const D2 = U.D, B = U.bones;
      for (let i = 0; i < 40; i++) {
        const lane = i % 10, wave = Math.floor(i / 10);
        const tt = (k - 5 - wave * 1.6) * 9;
        const bx = -20 + (tt % 46);
        const tall = 1.6 + ((lane * 7) % 5) * 0.9;
        const on = k > 5 && k < 15 && tt > 0;
        D2.position.set(bx, on ? (lane % 2 ? 0.6 : 8.2 - tall) : -999, 4.2);
        D2.rotation.set(0, 0, 0);
        D2.scale.set(1, tall, 1);
        D2.updateMatrix(); B.setMatrixAt(i, D2.matrix);
      }
      B.instanceMatrix.needsUpdate = true;
      /* the blasters */
      U.blasters.forEach((bl, i) => {
        const t0 = 15.5 + i * 2.4;
        const on = k > t0 && k < t0 + 2.2;
        bl.g.visible = on;
        if (!on) return;
        const kk = k - t0;
        bl.g.position.set(-9 + i * 18, 12 - kk * 0.6, -2);
        bl.g.lookAt(U.soul.getWorldPosition(new THREE.Vector3()));
        bl.g.rotateY(Math.PI);            // the snout and the beam live on +Z
        bl.g.rotateZ(Math.sin(kk * 5) * 0.12);
        bl.g.scale.setScalar(easeOutBack(clamp(kk / 0.4, 0, 1)) * 1.5);
        const firing = kk > 0.75 && kk < 1.8;
        bl.beam.visible = firing;
        if (firing) {
          bl.beam.scale.set(1 + Math.sin(kk * 40) * 0.14, 1, 1 + Math.sin(kk * 40) * 0.14);
          if (!this._did['blast' + i]) { this._did['blast' + i] = 1; DJAudio.impact(); this.shakeT = 0.5; }
        }
      });
      if (hp <= 0 && !this._did.sansKO) {
        this._did.sansKO = 1;
        DJAudio.impact();
        burstDebris(this.debris, O.x + U.soul.position.x, 5, O.z + U.soul.position.z, 60, 8, 10);
      }
      U.soul.visible = hp > 0;
      this.fx('<div class="fxHP"><span>BOOK</span><div class="bar"><div class="fill" style="width:' +
        (hp * 100).toFixed(0) + '%"></div></div><span>' + Math.ceil(hp * 92) + ' / 92</span></div>' +
        (k > 20.5 ? '<div class="fxUT">* G A M E &nbsp; O V E R</div>' : ''));

    /* ------------------------------------------------ 11 · the jumpscare */
    } else if (A.id === 'huggy') {
      P(8.5, 0, 6.5, -0.7);
      const scare = 15.2;
      const flick = 0.4 + 0.6 * Math.abs(Math.sin(k * 7) * Math.sin(k * 2.3));
      U.screen.material.color.setRGB(0.10 * flick, 0.16 * flick, 0.34 * flick);
      U.girl.rotation.y = Math.sin(k * 1.1) * 0.10;
      U.girl.position.y = Math.sin(k * 2.6) * 0.10;
      /* it comes up the room behind her */
      const walk = clamp((k - 4.5) / 10.4, 0, 1);
      U.hug.visible = k > 4.5;
      U.hug.position.z = lerp(-30, -3.2, walk);
      U.hug.position.y = Math.abs(Math.sin(k * 3.2)) * 0.35;
      U.hug.rotation.y = Math.sin(k * 1.4) * 0.10;
      U.hug.rotation.x = 0;
      if (k > scare) {
        const kk = k - scare;
        U.hug.position.z = lerp(-3.2, 4.4, clamp(kk / 0.22, 0, 1));
        U.hug.position.y = clamp(kk / 0.22, 0, 1) * 1.6;
        U.hug.rotation.x = -clamp(kk / 0.3, 0, 1) * 0.35;
        U.maw.scale.setScalar(1 + clamp(kk / 0.25, 0, 1) * 1.5);
        U.head.scale.setScalar(1 + clamp(kk / 0.25, 0, 1) * 0.5);
        /* and she leaves */
        U.girl.position.y = kk * 14 - 5 * kk * kk;
        U.girl.position.z = 3 + kk * 9;
        U.girl.rotation.z = kk * 7;
        if (!this._did.scare) {
          this._did.scare = 1;
          Audio1.jumpscare && Audio1.jumpscare(false);
          DJAudio.impact(); this.shakeT = 1.6;
        }
        this.fx((kk < 0.22 ? '<div class="fxFlash"></div>' : '') +
          (kk < 2.2 ? '<div class="fxBanner">A A A H !</div>' : '') + '<div class="fxVig"></div>');
      } else {
        this.fx('<div class="fxVig"></div>' +
          (k > 11 ? '<div class="fxHud">BEHIND YOU</div>' : ''));
      }

    /* ------------------------------------------------ 12 · the cane */
    } else if (A.id === 'cane') {
      P(5.6, 0, 0, -Math.PI / 2);
      const first = 4.0, gap = 1.62;
      const n = clamp(Math.floor((k - first) / gap) + 1, 0, 6);
      const inStroke = k >= first;
      const ph = inStroke ? ((k - first) % gap) / gap : 0;
      /* wind up over the first 60% of the gap, then whip down */
      const swing = ph < 0.62 ? -easeOutBack(ph / 0.62) * 2.3
                              : lerp(-2.3, 0.85, easeOutBack((ph - 0.62) / 0.38));
      U.cane.rotation.z = inStroke && n <= 6 ? swing : -0.4;
      U.cane.position.set(4.4, 8.5, 0);
      this.caneSwing = U.cane.rotation.z;
      const stroke = Math.floor((k - first) / gap);
      if (inStroke && stroke >= 0 && stroke < 6 && this._stroke !== stroke && ph > 0.66) {
        this._stroke = stroke;
        DJAudio.clank(Audio1.ctx.currentTime, 5200);
        DJAudio.snare(Audio1.ctx.currentTime, 0.34);
        this.shakeT = 0.35;
        burstDebris(this.debris, O.x, 7.2, O.z, 14, 5, 6);
        U.book.rotation.z = rand(-0.3, 0.3);
      }
      U.book.visible = n < 6 || k < first + gap * 6 + 0.9;
      U.book.scale.setScalar(3.4 * clamp(1 - Math.max(0, n - 5) * 0.9, 0.1, 1));
      if (n >= 6 && !this._did.caneDone) {
        this._did.caneDone = 1;
        burstDebris(this.debris, O.x, 7.0, O.z, 60, 8, 9);
      }
      this.fx('<div class="fxHud">STROKE &nbsp;<b>' + n + ' / 6</b></div>' +
        (n >= 6 ? '<div class="fxBanner">SENTENCE SERVED</div>' : ''));

    /* ================================================ 16 · the duel */
    } else if (A.id === 'naoya') {
      this.runDuel(A, G2, U, O, k, t, dt);

    /* ------------------------------------------------ 14 · the corridor */
    } else if (A.id === 'sgschool') {
      const GR = this.girl;
      GR.root.visible = true;
      GR.root.scale.setScalar(1.05);
      const bumps = [10.6, 15.2], bonk = 21.4;
      /* she stands about a third of the way down, chatting */
      let gx = 0, gz = 0, gy = 0, spin = 0.42, tilt = 0;
      /* each sprinting student catches her on the way past */
      U.kids.forEach((kd, i) => {
        const t0 = 3.0 + i * 2.9;
        const kk = k - t0;
        const live = kk > 0 && kk < 7;
        kd.g.visible = live;
        if (!live) return;
        const px = -54 + kk * kd.sp;
        kd.g.position.set(px, 0, kd.lane);
        kd.g.rotation.y = Math.PI / 2;
        const run = Math.sin(kk * 17 + i);
        kd.legs.rotation.x = 0;
        kd.legs.children.forEach((c2, ci) => { c2.rotation.x = (ci % 2 ? run : -run) * 0.9; });
        kd.arms.children.forEach((c2, ci) => { c2.rotation.x = (ci % 2 ? -run : run) * 1.1; });
        kd.g.position.y = Math.abs(Math.cos(kk * 17)) * 0.35;
        kd.g.rotation.z = -0.12;
      });
      /* the two collisions */
      let shove = 0;
      for (let i = 0; i < bumps.length; i++) {
        const kk = k - bumps[i];
        if (kk > 0 && kk < 1.6) {
          const e = 1 - kk / 1.6;
          shove = e;
          gx += (i ? -1 : 1) * Math.sin(kk * 12) * 2.2 * e;
          spin += (i ? -1 : 1) * kk * 9 * e;
          tilt = Math.sin(kk * 9) * 0.35 * e;
          gy = Math.abs(Math.sin(kk * 11)) * 0.4 * e;
        }
        if (!this._did['sgb' + i] && k >= bumps[i]) {
          this._did['sgb' + i] = 1;
          DJAudio.clank(Audio1.ctx.currentTime, 900);
          DJAudio.impact(); this.shakeT = 0.4;
          GR.setMood('surprised');
          burstDebris(this.debris, O.x + gx, 4, O.z, 10, 4, 5);
        }
      }
      /* and then the football */
      const bk = k - bonk;
      U.ball.visible = bk > -1.6;
      if (bk <= 0) {
        const app = clamp((bk + 1.6) / 1.6, 0, 1);
        U.ball.position.set(lerp(14, 0.4, app), lerp(-8, 6.4, app) + Math.sin(app * Math.PI) * 6,
                            lerp(26, 0, app));
      } else {
        U.ball.position.set(lerp(0.4, -9, clamp(bk / 1.2, 0, 1)),
                            6.4 + bk * 3 - 5 * bk * bk, bk * 1.5);
        if (!this._did.sgbonk) {
          this._did.sgbonk = 1;
          DJAudio.impact(); DJAudio.clank(Audio1.ctx.currentTime, 2400);
          this.shakeT = 0.9;
          GR.setMood('dizzy');
          burstDebris(this.debris, O.x, 6.2, O.z, 26, 6, 8);
        }
        const e = clamp(1 - bk / 3.2, 0, 1);
        spin += bk * 5 * e;
        tilt = Math.sin(bk * 7) * 0.5 * e;
        gy = Math.abs(Math.sin(bk * 6)) * 0.25 * e;
      }
      U.ball.rotation.set(k * 7, k * 5, 0);
      if (k > 1.0 && k < 10.4 && GR.mood !== 'happy' && !this._did.sghi) {
        this._did.sghi = 1; GR.setMood('happy');
      }
      GR.root.position.set(O.x + gx, gy, O.z + gz);
      GR.root.rotation.set(tilt, spin, tilt * 0.6);
      GR.update(dt, { idle: shove < 0.05 && bk < 0 });
      if (shove > 0.05 || bk > 0) GR.ragdoll(k * 3);
      else GR.reset();
      P(-7.5, 0, 3.2, -1.9);
      this.fx('<div class="fxHud">LEVEL 2 CORRIDOR &nbsp;·&nbsp; <b>NO RUNNING</b></div>' +
        (bk > 0 && bk < 2.4 ? '<div class="fxBanner">B O N K</div>' : ''));

    /* ------------------------------------------- 15 · the battlegrounds */
    } else if (A.id === 'tsb') {
      const GR = this.girl;
      GR.root.visible = true;
      GR.root.scale.setScalar(1.05);
      const HITS = [];
      for (let i = 0; i < 14; i++) HITS.push(7.0 + i * 1.15);
      const finalHit = 22.6;
      /* she is in the middle, going steadily higher */
      let gy = 0.5, gx = 0, gz = 0, spin = k * 1.4, tilt = 0, roll = 0;
      let combo = 0, dmg = 0;
      for (let i = 0; i < HITS.length; i++) {
        if (k >= HITS[i]) { combo = i + 1; dmg += 8 + (i % 4) * 3; }
        const kk = k - HITS[i];
        if (kk > 0 && kk < 1.15) {
          const e = 1 - kk / 1.15;
          gy += Math.sin(kk * 4) * 3.4 * e + 2.2 * e;
          gx += Math.sin(i * 2.1) * 1.6 * e;
          gz += Math.cos(i * 1.7) * 1.6 * e;
          tilt = Math.sin(kk * 12 + i) * 0.6 * e;
          roll = Math.cos(kk * 9 + i) * 0.7 * e;
        }
        if (!this._did['tsb' + i] && k >= HITS[i]) {
          this._did['tsb' + i] = 1;
          DJAudio.impact();
          DJAudio.clank(Audio1.ctx.currentTime, 1400 + (i % 5) * 500);
          this.shakeT = 0.32;
          GR.setMood(i > 8 ? 'dizzy' : 'pain');
          /* hit sparks */
          const SS = U.sstate;
          for (let q = 0; q < 6; q++) {
            const sp2 = SS[(i * 6 + q) % SS.length];
            sp2.x = gx; sp2.y = gy + 3.5; sp2.z = gz;
            sp2.vx = rand(-9, 9); sp2.vy = rand(2, 12); sp2.vz = rand(-9, 9);
            sp2.life = 0.7;
          }
        }
      }
      gy += clamp((k - 7) * 0.55, 0, 7.5);          // the juggle keeps rising
      /* the pros take turns dashing in */
      U.players.forEach((pl, i) => {
        const my = HITS[i] !== undefined ? HITS[i] : -99;
        const turn = HITS.filter((h, hi) => hi % U.players.length === i);
        let near = 0, ph = 0;
        for (const h of turn) { const kk = k - h; if (kk > -0.45 && kk < 0.8) { near = 1; ph = kk; } }
        const rest = 13;
        const r = near ? lerp(rest, 3.4, clamp((ph + 0.45) / 0.45, 0, 1)) : rest;
        pl.g.position.set(Math.sin(pl.a) * r, near && ph > 0 ? clamp(gy - 4, 0, 6) : 0,
                          Math.cos(pl.a) * r);
        pl.g.rotation.y = -pl.a + Math.PI;
        const sw = near ? Math.sin(ph * 22) : Math.sin(k * 3 + i);
        pl.ud.arms.l.rotation.x = near ? -2.4 + sw * 0.5 : sw * 0.25;
        pl.ud.arms.r.rotation.x = near ? -2.4 - sw * 0.5 : -sw * 0.25;
        pl.ud.legs.l.rotation.x = sw * 0.35; pl.ud.legs.r.rotation.x = -sw * 0.35;
        pl.tag.lookAt(this.camera.position);
      });
      /* sparks */
      const SS = U.sstate, D4 = U.D;
      for (let q = 0; q < SS.length; q++) {
        const sp2 = SS[q];
        if (sp2.life <= 0) { D4.position.set(0, -999, 0); D4.scale.setScalar(0.001); }
        else {
          sp2.life -= dt; sp2.vy -= 22 * dt;
          sp2.x += sp2.vx * dt; sp2.y += sp2.vy * dt; sp2.z += sp2.vz * dt;
          D4.position.set(sp2.x, sp2.y, sp2.z);
          D4.scale.setScalar(clamp(sp2.life * 1.6, 0, 1));
        }
        D4.rotation.set(k * 6, k * 4, 0);
        D4.updateMatrix(); U.sparks.setMatrixAt(q, D4.matrix);
      }
      U.sparks.instanceMatrix.needsUpdate = true;
      /* Baldi steps in for the last one */
      const fk = k - finalHit;
      if (fk > -2.2) P(4.6, gy > 6 ? gy - 5.5 : 0, 4.2, -0.75);
      else P(Math.sin(k * 0.5) * 12, 0, 15, -Math.PI);
      if (fk > 0) {
        const e = clamp(fk / 2.6, 0, 1);
        gy = lerp(gy, 0.4, e * e);
        gx = lerp(gx, -14, e);
        tilt = lerp(tilt, -1.5, e);
        combo = HITS.length + 1; dmg = 999;
        if (!this._did.tsbKO) {
          this._did.tsbKO = 1;
          DJAudio.impact(); DJAudio.impact(); this.shakeT = 1.6;
          GR.setMood('ko');
          burstDebris(this.debris, O.x + gx, 3, O.z + gz, 50, 10, 12);
        }
      }
      GR.root.position.set(O.x + gx, gy, O.z + gz);
      GR.root.rotation.set(tilt, spin, roll);
      GR.ragdoll(k * 4);
      GR.update(dt, { idle: false });
      const hp = clamp(1 - dmg / 190, 0, 1);
      this.fx('<div class="fxHP"><span>HP</span><div class="bar"><div class="fill" style="width:' +
        (hp * 100).toFixed(0) + '%"></div></div><span>' + Math.ceil(hp * 190) + '</span></div>' +
        (combo > 1 ? '<div class="fxHud">COMBO <b>' + combo + '</b> &nbsp;·&nbsp; ' +
          (dmg >= 999 ? 'K.O.' : dmg + ' DMG') + '</div>' : '') +
        (fk > 0 && fk < 3 ? '<div class="fxBanner">K . O .</div>' : ''));

    /* ------------------------------------------------ 13 · the final */
    } else {
      const army = U.army, AS = U.astate, D3 = U.D, ball = U.ball;
      const charge = clamp((k - 6) / 5.5, 0, 1);
      const pile = k > 13.5 && k < 18.4;
      const burst = k >= 18.4;
      const goal = k >= 21.0;
      /* Baldi runs the length of the pitch */
      const bx = k < 18.4 ? lerp(-14, -2, clamp((k - 5) / 13.4, 0, 1)) : lerp(-2, 18, clamp((k - 18.4) / 3, 0, 1));
      P(bx, 0, Math.sin(k * 0.7) * 2.2, Math.PI / 2);
      /* the thousand */
      let alive = 0;
      for (let i = 0; i < AS.length; i++) {
        const a = AS[i];
        if (burst && !a.down && i % 3 !== 0) {
          a.down = 1;
          a.vx = (a.x - bx) * 0.5 + rand(-2, 2);
          a.vz = a.z * 0.5 + rand(-2, 2);
          a.vy = rand(6, 15);
        }
        if (a.down) {
          a.vy -= 26 * dt;
          a.x += a.vx * dt; a.z += a.vz * dt; a.y += a.vy * dt;
          a.spin += dt * 7;
          if (a.y < 0) { a.y = 0; a.vy *= -0.25; a.vx *= 0.6; a.vz *= 0.6; a.spin *= 0.7; }
        } else {
          const spread = 2.4 + (i % 19) * 0.62;
          const target = pile ? spread * 0.55 : lerp(a.r, spread, charge);
          const aa = a.a + k * 0.25;
          a.x = lerp(a.x, bx + Math.sin(aa) * target, 1 - Math.exp(-dt * 2.4));
          a.z = lerp(a.z, Math.cos(aa) * target, 1 - Math.exp(-dt * 2.4));
          a.y = Math.abs(Math.sin(k * 6 + a.ph)) * 0.5;
          alive++;
        }
        D3.position.set(a.x, a.y, a.z);
        /* billboard them at the camera, or they vanish edge-on */
        const fy = Math.atan2(this.camera.position.x - (O.x + a.x),
                              this.camera.position.z - (O.z + a.z));
        D3.rotation.set(a.down ? a.spin : 0, fy, a.down ? a.spin * 0.7 : 0);
        D3.scale.setScalar(1);
        D3.updateMatrix(); army.setMatrixAt(i, D3.matrix);
      }
      army.instanceMatrix.needsUpdate = true;
      /* the ball */
      if (!goal) {
        ball.position.set(bx + 2.4, 1.2 + Math.abs(Math.sin(k * 9)) * 0.5, Math.sin(k * 0.7) * 2.2);
      } else {
        const gk = k - 21.0;
        ball.position.set(lerp(16, 71, clamp(gk / 1.1, 0, 1)),
                          1.2 + Math.sin(clamp(gk / 1.1, 0, 1) * Math.PI) * 9,
                          lerp(0, 1.5, clamp(gk / 1.1, 0, 1)));
        if (!this._did.goal && gk > 1.0) {
          this._did.goal = 1;
          DJAudio.impact();
          this.shakeT = 1.0;
          burstDebris(this.debris, O.x + 71, 3, O.z, 40, 8, 10);
        }
      }
      ball.rotation.set(k * 6, k * 3, 0);
      /* crowd bounce */
      U.crowd.position.y = Math.abs(Math.sin(k * 4)) * (goal ? 0.9 : 0.25);
      /* the trophy */
      U.trophy.visible = k > 23.5;
      U.trophy.position.set(bx, 8.5 + Math.abs(Math.sin(k * 3)) * 0.6, 0);
      U.trophy.rotation.y = k * 1.4;
      const score = goal ? 1 : 0;
      this.fx('<div class="fxScore"><span class="win">BALDI ' + score +
        '</span> : <span class="lose">0 ANIME</span></div>' +
        (goal && k < 24.5 ? '<div class="fxBanner">G O A L !</div>' : '') +
        (!goal ? '<div class="fxHud">STANDING: <b>' + alive + '</b> / 1000</div>' : ''));
    }
  },

  /* =====================================================================
     METHOD SIXTEEN — twenty-four frames.
     Six movements: pressure, the flurry, her answer, beyond sound, the
     freeze, and the finish.
     ===================================================================== */
  runDuel(A, G2, U, O, k, t, dt) {
    const GR = this.girl, m = this.model;
    const P = (x, y, z, spin) => { this.actPose = { x: O.x + x, y: y || 0, z: O.z + z, spin: spin || 0 }; };
    const at = (x, z) => ({ x: O.x + x, z: O.z + z });

    /* lighting for the whole act: hard red key, almost no fill */
    this.scene.fog.near = 60; this.scene.fog.far = 320;
    this.scene.background.setHex(0x0a0508);
    this.amb.intensity = k < 13 ? 0.13 : (k > 60 ? 0.52 : 0.30);
    this.amb.color.setHex(0x6a5a7a);
    this.keyLight.intensity = k > 60 ? 0.35 : 0.10;
    U.moonGlow.intensity = k > 60 ? 2.2 : 1.1;

    /* ---- her position, driven per phase ---- */
    let gx = 0, gz = 14, gy = 0, gspin = Math.PI, gtilt = 0, groll = 0, grag = 0;
    let bx = 0, by = 0, bz = -14, bspin = 0;
    let fx = '';                                   /* the overlay for this frame */
    let sub = 'stand';                             /* which pose he holds */
    let camMode = 'hold';
    this.duelCam = this.duelCam || {};
    const C = this.duelCam;

    /* ============ A · PRESSURE (0–13) ============ */
    if (k < 13) {
      const st = k / 13;
      sub = 'stand';
      bx = 0; bz = -13; bspin = 0;
      gx = 0; gz = 15; gspin = Math.PI;
      GR.setMood(k > 9 ? 'surprised' : 'normal');
      /* the music is ducked to almost nothing by the section's `hush` */
      camMode = 'pushLow';
      C.from = [3.4, 0.95, 1.5]; C.to = [1.5, 2.15, -6.4];
      C.look = [0, 5.4, -13]; C.k = clamp(k / 12.5, 0, 1);
      /* the hat leaves at 8s, the coat arrives */
      if (this.model.__hat) this.model.__hat.visible = k < 8;
      if (!this._did.duelHat && k >= 8) {
        this._did.duelHat = 1;
        DJAudio.whoosh();
        burstDebris(this.debris, O.x, 8, O.z - 13, 12, 3, 6);
      }
      if (k > 8) {
        const c2 = clamp((k - 8) / 0.7, 0, 1);
        this.haori.scale.setScalar(easeOutBack(c2));
      }
      /* the eyes come on last */
      if (k > 10.8) {
        const gl = clamp((k - 10.8) / 0.6, 0, 1);
        m.eyeL.white.material.color.setHSL(0.03, 1, 0.5 + gl * 0.35);
        m.eyeR.white.material.color.setHSL(0.03, 1, 0.5 + gl * 0.35);
      }
      fx = '<div class="fxBars"></div>' +
        (k > 11.4 ? '<div class="fxGrid24">' + this.grid24(k, 0.9) + '</div>' : '') +
        (k > 11.6 ? '<div class="fxKanji">24 FPS</div>' : '');
      if (!this._did.duelOn && k >= 11.4) {
        this._did.duelOn = 1; DJAudio.impact(); this.shakeT = 0.6;
        this.wave(O.x, O.z - 13, 0.3, 40, 1.4, 0xff8a5a);
      }

    /* ============ B · THE FLURRY (13–26) ============ */
    } else if (k < 26) {
      const kk = k - 13;
      sub = 'dash';
      /* eleven strikes inside a second and a half, then she is launched */
      const HITS = [];
      for (let i = 0; i < 11; i++) HITS.push(2.6 + i * 0.14);
      const launch = 5.0;
      const ang = kk * 9.0;
      const orbitR = 7.5;
      gx = 0; gz = 12; gspin = Math.PI;
      if (kk < launch) {
        bx = gx + Math.sin(ang) * orbitR;
        bz = gz + Math.cos(ang) * orbitR;
        bspin = ang + Math.PI;
        by = Math.abs(Math.sin(ang * 1.7)) * 1.6;
        for (let i = 0; i < HITS.length; i++) {
          if (!this._did['dl' + i] && kk >= HITS[i]) {
            this._did['dl' + i] = 1;
            this.hitStop(0.055);
            this.shakeT = 0.35;
            DJAudio.clank(Audio1.ctx.currentTime, 2600 + (i % 4) * 700);
            burstDebris(this.debris, O.x + gx, 4.5, O.z + gz, 5, 5, 6);
            GR.setMood('pain');
          }
        }
        grag = kk * 6;
        gtilt = Math.sin(kk * 14) * 0.22;
        camMode = 'orbitTight'; C.r = 13; C.y = 6.5; C.spin = 2.6; C.look = [gx, 5.2, gz];
      } else {
        /* through the rocks */
        const lk = kk - launch;
        gx = lerp(0, -46, clamp(lk / 1.5, 0, 1));
        gz = 12 + lk * 2;
        gy = Math.max(0, 6.5 - lk * lk * 7);
        grag = lk * 9; gtilt = lk * 6; groll = lk * 4;
        bx = lerp(0, -10, clamp(lk / 1.5, 0, 1)); bz = 12; bspin = -Math.PI / 2;
        sub = 'follow';
        for (const p2 of U.pillars) {
          if (p2.alive && Math.abs(p2.x - gx) < 6 && Math.abs(p2.z - gz) < 8) {
            p2.alive = false; p2.g.visible = false;
            burstDebris(this.debris, O.x + p2.x, 5, O.z + p2.z, 30, 9, 11);
            DJAudio.impact(); this.shakeT = 0.7;
            this.wave(O.x + p2.x, O.z + p2.z, 1, 40, 0.8, 0xd8b09a);
          }
        }
        camMode = 'track'; C.look = [gx, 4 + gy, gz]; C.off = [10, 5, 13];
      }
      const dashing = kk < launch;
      fx = '<div class="fxBars"></div>' +
        (dashing ? '<div class="fxSpeed"></div>' : '<div class="fxRadial"></div>');

    /* ============ C · HER ANSWER (26–38) ============ */
    } else if (k < 38) {
      const kk = k - 26;
      sub = kk < 6.5 ? 'guard' : (kk < 8 ? 'knocked' : 'rise');
      gx = -34 + kk * 1.2; gz = 16; gy = 0;
      gspin = Math.PI * 0.5;
      bx = -14; bz = 8; bspin = -1.1;
      GR.setMood(kk > 1.5 ? 'pain' : 'dizzy');
      if (!this._did.duelLand && kk > 0.4) {
        this._did.duelLand = 1;
        this.crackAt(O.x + gx, O.z + gz, 16);
        burstDebris(this.debris, O.x + gx, 1, O.z + gz, 26, 8, 5);
        DJAudio.impact(); this.shakeT = 0.6;
      }
      /* she reads the rhythm — the frame counter ticks past */
      if (kk > 2.2 && kk < 6.4) {
        const n = 1 + Math.floor(((kk - 2.2) / 4.2) * 24);
        fx = '<div class="fxBars"></div><div class="fxGrid24">' + this.grid24(k, 0.55, n) +
             '</div><div class="fxCount">' + n + ' / 24</div>';
        camMode = 'closeGirl'; C.look = [gx, 5.6, gz]; C.off = [3.6, 5.9, 6.2];
      } else if (kk >= 6.5 && kk < 8.2) {
        /* she gets one in */
        if (!this._did.duelHer) {
          this._did.duelHer = 1;
          this.hitStop(0.13);
          this.shakeT = 1.1;
          DJAudio.impact();
          this.wave(O.x + bx, O.z + bz, 3, 46, 0.9, 0xbfe8ff);
          burstDebris(this.debris, O.x + bx, 5, O.z + bz, 26, 8, 9);
        }
        const hk = kk - 6.5;
        bx = -14 - hk * 16; by = Math.max(0, 3.6 - hk * hk * 6); bspin = -1.1 + hk * 5;
        sub = 'knocked';
        fx = '<div class="fxBars"></div>' + (hk < 0.09 ? '<div class="fxImpact"></div>' : '') +
             '<div class="fxRadial"></div>';
        camMode = 'track'; C.look = [bx, 4, bz]; C.off = [-9, 5.5, 11];
      } else {
        fx = '<div class="fxBars"></div>';
        camMode = 'orbitTight'; C.r = 17; C.y = 7; C.spin = -1.1; C.look = [-20, 4.6, 12];
      }

    /* ============ D · BEYOND SOUND (38–50) ============ */
    } else if (k < 50) {
      const kk = k - 38;
      sub = 'dash';
      gx = -18; gz = 14; gspin = Math.PI * 0.5;
      GR.setMood('surprised');
      /* he circles her faster and faster, quantised to 24 frames a second */
      const spd = 4 + kk * 2.6;
      const raw = kk * spd;
      const quant = Math.floor(raw * 24) / 24;        /* frame skipping */
      const R2 = 13 - kk * 0.5;
      bx = gx + Math.sin(quant) * R2;
      bz = gz + Math.cos(quant) * R2;
      by = Math.abs(Math.sin(quant * 2.2)) * 1.2;
      bspin = quant + Math.PI;
      if (kk > 9.0) {                                 /* she takes the stance */
        sub = 'dash';
        gtilt = 0.12;
      }
      camMode = 'orbitTight'; C.r = 16; C.y = 6.4; C.spin = -3.4; C.look = [gx, 5, gz];
      U.tunnel.visible = true;
      U.tunnel.material.opacity = clamp(kk / 4, 0, 1) * 0.5;
      U.tunnel.position.set(O.x + bx, 6, O.z + bz);
      U.tunnel.lookAt(O.x + gx, 6, O.z + gz);
      U.tunnel.rotateX(Math.PI / 2);
      fx = '<div class="fxBars"></div><div class="fxSpeed tight"></div>' +
        (kk > 9 ? '<div class="fxKanji" style="font-size:min(9vw,80px)">STANCE</div>' : '');

    /* ============ E · THE FREEZE (50–58) ============ */
    } else if (k < 58) {
      const kk = k - 50;
      gx = -18; gz = 14; gspin = Math.PI * 0.5;
      U.tunnel.material.opacity = 0;
      if (kk < 1.2) {
        /* the slap — he takes her arm, not her guard */
        sub = 'slapArm';
        bx = gx + 3.4; bz = gz + 1.2; bspin = Math.PI * 1.5;
        if (!this._did.duelFreeze && kk > 0.45) {
          this._did.duelFreeze = 1;
          this.hitStop(0.20);
          DJAudio.impact();
          this.shakeT = 0.5;
          GR.setMood('surprised');
        }
        fx = '<div class="fxBars"></div>' + (kk > 0.45 && kk < 0.56 ? '<div class="fxImpact"></div>' : '');
        camMode = 'closeGirl'; C.look = [gx + 1, 5.4, gz]; C.off = [2.6, 5.6, 5.0];
      } else {
        /* one second, held — except it is not one second, it is six */
        sub = 'walkRound';
        const wa = (kk - 1.2) * 0.85;
        bx = gx + Math.sin(wa) * 6.5; bz = gz + Math.cos(wa) * 6.5;
        bspin = wa + Math.PI;
        gtilt = 0.10;
        fx = '<div class="fxBars"></div><div class="fxGrid24">' + this.grid24(k, 0.5, 24) +
          '</div><div class="fxFreeze"><span>FROZEN &nbsp;1.00s</span></div>';
        camMode = 'orbitTight'; C.r = 11; C.y = 5.8; C.spin = 0.9; C.look = [gx, 5.2, gz];
      }
      GR.freeze = true;

    /* ============ F · THE FINISH (58–66) ============ */
    } else {
      const kk = k - 58;
      gx = -18; gz = 14; gspin = Math.PI * 0.5;
      const strike = 2.4;
      if (kk < strike) {
        /* stillness before impact — he winds up, everything else stops */
        sub = 'wind';
        bx = gx + 11; bz = gz + 5; bspin = Math.PI * 1.42;
        camMode = 'fist'; C.look = [gx + 7, 6.2, gz + 3];
        fx = '<div class="fxBars"></div>' +
          (kk > 1.5 ? '<div class="fxRadial"></div>' : '') +
          (kk > 1.9 ? '<div class="fxKanji" style="font-size:min(11vw,100px)">SIT DOWN</div>' : '');
      } else {
        const hk = kk - strike;
        sub = 'smash';
        bx = gx + 2.6; bz = gz + 1.4; bspin = Math.PI * 1.5;
        if (!this._did.duelKO) {
          this._did.duelKO = 1;
          this.hitStop(0.28);
          this.shakeT = 2.4;
          DJAudio.impact(); DJAudio.impact();
          this.crackAt(O.x + gx, O.z + gz, 46);
          this.crackAt(O.x + gx + 9, O.z + gz - 7, 26);
          this.crackAt(O.x + gx - 8, O.z + gz + 6, 22);
          burstDebris(this.debris, O.x + gx, 1.5, O.z + gz, 110, 20, 16);
          this.wave(O.x + gx, O.z + gz, 0.4, 110, 1.7, 0xfff0d0);
          this.wave(O.x + gx, O.z + gz, 0.4, 62, 2.2, 0xffb070);
          U.blast.visible = true;
          this._blastT = 0;
          for (const p2 of U.pillars) {
            if (!p2.alive) continue;
            p2.alive = false; p2.g.visible = false;
            burstDebris(this.debris, O.x + p2.x, 6, O.z + p2.z, 16, 10, 12);
          }
          GR.setMood('ko');
        }
        gy = Math.max(0, 0.4 - hk * 0.4);
        gtilt = -1.5; grag = hk * 2;
        camMode = hk < 2.2 ? 'lowSmash' : 'pullOut';
        C.look = [gx, 2.4, gz];
        fx = '<div class="fxBars"></div>' +
          (hk < 0.10 ? '<div class="fxImpact"></div>' : '') +
          (hk > 0.10 && hk < 0.18 ? '<div class="fxImpact dark"></div>' : '') +
          (hk > 0.2 && hk < 2.6 ? '<div class="fxSpeed"></div>' : '') +
          (hk > 3.2 ? '<div class="fxKanji" style="font-size:min(10vw,92px)">CONFISCATED</div>' : '');
      }
    }

    /* ---------------- apply ---------------- */
    P(bx, by, bz, bspin);
    this.naoyaSub = sub;
    GR.root.visible = true;
    GR.root.position.set(O.x + gx, gy, O.z + gz);
    GR.root.rotation.set(gtilt, gspin, groll);
    GR.root.scale.setScalar(1.05);
    if (grag > 0) GR.ragdoll(grag); else GR.reset();
    GR.update(dt, { idle: grag <= 0 && k < 13 });

    /* afterimages follow him whenever he is quick */
    pushGhostFrame(this.ghosts);
    /* only while he is actually quick — trailing him at walking pace just
       piles six translucent Baldis on top of each other */
    const fast = (k >= 13 && k < 26) || (k >= 38 && k < 50) ||
                 (k >= 60.2 && k < 62.2);
    poseGhosts(this.ghosts, 2, fast ? 0.20 : 0);

    /* motion smear: stretch him along the way he is going */
    if (!this._lastB) this._lastB = new THREE.Vector3();
    const now = new THREE.Vector3(O.x + bx, by, O.z + bz);
    const vel = now.clone().sub(this._lastB).length() / Math.max(dt, 0.001);
    this._lastB.copy(now);
    this.duelStretch = clamp(vel / 90, 0, 1);

    /* shockwaves, cracks, blast, mist */
    for (const w of U.waves) {
      if (w.t < 0) continue;
      w.t += dt;
      const p2 = w.t / w.life;
      if (p2 >= 1) { w.t = -1; w.m.visible = false; continue; }
      const r = 1 + w.t * w.spd;
      w.m.position.set(w.x, w.y, w.z);
      w.m.scale.set(r, r, 1);
      w.m.material.opacity = (1 - p2) * 0.85;
    }
    for (const c2 of U.cracks) {
      if (!c2.visible) continue;
      c2.material.opacity = Math.max(0, c2.material.opacity - dt * 0.10);
      if (c2.material.opacity <= 0.01) c2.visible = false;
    }
    if (U.blast.visible) {
      this._blastT += dt;
      const p2 = this._blastT / 1.3;
      U.blast.position.set(O.x + gx, 3, O.z + gz);
      U.blast.scale.setScalar(2 + p2 * 60);
      U.blast.material.opacity = Math.max(0, 0.55 * (1 - p2));
      if (p2 >= 1) U.blast.visible = false;
    }
    U.mist.forEach((mm, i) => {
      mm.position.x = O.x + Math.sin(t * 0.2 + i) * 30;
      mm.position.z = O.z + Math.cos(t * 0.16 + i * 2) * 30;
      mm.lookAt(this.camera.position);
    });
    if (k >= 50) U.tunnel.material.opacity = Math.max(0, U.tunnel.material.opacity - dt);
    if (U.tunnel.material.opacity <= 0.01) U.tunnel.visible = false;

    this.fx(fx);
    this.duelCamMode = camMode;
  },

  /* the 24-frame grid: `lit` cells are on */
  grid24(t, alpha, upto) {
    let out = '';
    const n = upto === undefined ? (Math.floor(t * 24) % 24) + 1 : upto;
    for (let i = 0; i < 24; i++) out += '<i class="' + (i < n ? 'on' : '') + '"></i>';
    return out;
  },

  /* ------------------------------------------------------------- obby */
  runObby(t, dt) {
    const U = this.obby.userData;
    const P = U.path;
    for (const sp of U.spinners) sp.rotation.y += dt * 2.6;
    if (U.lava.material.map) {
      U.lava.material.map.offset.x = t * 0.06;
      U.lava.material.map.offset.y = t * 0.04;
    }

    /* --- hop the course --- */
    const nHops = P.length - 1;
    const runT = clamp((t - OBBY_RUN) / (OBBY_PUSH - OBBY_RUN), 0, 1);
    const f = runT * nHops;
    const i = Math.min(nHops - 1, Math.floor(f));
    const u = clamp(f - i, 0, 1);
    const a = P[i], b = P[i + 1];
    const air = u > 0.12 && u < 0.88;
    const pose = {
      x: lerp(a.x, b.x, u),
      y: lerp(a.y, b.y, u) + Math.sin(clamp(u, 0, 1) * Math.PI) * 2.6,
      z: lerp(a.z, b.z, u),
      air: air,
      spin: -Math.PI / 2 + Math.atan2(0, 1)
    };
    pose.spin = Math.atan2(b.x - a.x, b.z - a.z);
    if (t >= OBBY_PUSH) {
      const last = P[P.length - 1];
      pose.x = last.x - 1.4; pose.y = last.y; pose.z = last.z;
      pose.air = false; pose.spin = Math.PI / 2;
    }
    this.obbyPose = pose;

    /* a little chime each time he lands */
    const hopIdx = Math.floor(f);
    if (this._hop !== hopIdx && t < OBBY_PUSH) {
      this._hop = hopIdx;
      if (Audio1.ready && DJAudio.bus) DJAudio.chime(Audio1.ctx.currentTime, 520 + hopIdx * 40);
    }

    /* --- and then he pushes the stack in --- */
    const st = U.stack;
    const shove = t - (OBBY_PUSH + 1.1);
    if (shove <= 0) {
      st.visible = true;
      st.position.set(P[10].x + 1.6, P[10].y + 0.6, P[10].z);
      st.rotation.set(0, 0, 0);
    } else {
      const g2 = 6.0;
      st.position.x = P[10].x + 1.6 + shove * 5.2;
      st.position.y = P[10].y + 0.6 + shove * 4.5 - 0.5 * g2 * shove * shove;
      st.rotation.set(shove * 2.2, shove * 1.4, shove * 3.1);
      if (st.position.y < -8.6) {
        st.visible = false;
        if (!this._did.splash) {
          this._did.splash = 1;
          DJAudio.oof();
          DJAudio.impact();
          this.splashAt = { x: st.position.x, z: st.position.z, t: 0 };
        }
      }
    }
    /* the lava throws a ring up where it went in */
    if (this.splashAt) {
      this.splashAt.t += dt;
      const k = clamp(this.splashAt.t / 1.5, 0, 1);
      this.splash.visible = k < 1;
      this.splash.position.set(this.splashAt.x, -8.6 + k * 1.4, this.splashAt.z);
      this.splash.scale.setScalar(0.4 + k * 9);
      this.splash.material.opacity = (1 - k) * 0.95;
      this.splash.rotation.z = k * 1.2;
      this.splashCol.visible = k < 0.7;
      this.splashCol.position.set(this.splashAt.x, -8.6 + k * 8, this.splashAt.z);
      this.splashCol.scale.set(1 + k * 2.5, 1 + k * 4.5, 1 + k * 2.5);
      this.splashCol.material.opacity = (1 - k / 0.7) * 0.9;
    }
  },

  /* ------------------------------------------------------------ dance */
  tickDance(dt, t) {
    const m = this.model, r = this.rig;
    const th = thump(t, 7);
    const p = t * Math.PI / BEAT;                    // half-beat oscillator
    const q = t * Math.PI / (BEAT * 2);              // bar oscillator
    let x = 0, y = 0, z = 0, spin = 0, tilt = 0, roll = 0, sx = 1, sy = 1, snap = 0;
    let hRX = 0, hRZ = 0, tRY = 0, tRZ = 0, tRX = 0;
    let aLx = -0.1, aLz = -0.25, aRx = -0.1, aRz = 0.25, fL = -0.2, fR = -0.2;
    let lL = 0, lR = 0, lLz = 0, lRz = 0;
    const mv = this.move, mt = this.moveT;
    this.punchT = Math.max(0, (this.punchT || 0) - dt);

    if (mv === 'arrive') {
      /* he walks up to the decks, then waits for the drop */
      const k = clamp(t / 2.4, 0, 1);
      m.root.position.z = lerp(-11, 0, easeOutBack(k));
      y = Math.abs(Math.sin(t * 4)) * (1 - k) * 0.4;
      hRX = -0.06; tRZ = Math.sin(t * 1.2) * 0.03;
      aLz = -0.18; aRz = 0.18;
      if (t > 4.2) {                                  // the ruler goes up
        const e = easeOutElastic(clamp((t - 4.2) / 1.2, 0, 1));
        aRx = lerp(-0.1, -2.5, e); aRz = lerp(0.25, 0.5, e);
      }
    } else if (mv === 'bounce') {
      y = Math.abs(Math.sin(p)) * 1.05;
      sy = 1 - th * 0.20; sx = 1 + th * 0.16;
      tRZ = Math.sin(p) * 0.16; tRY = Math.sin(q) * 0.30;
      hRZ = -Math.sin(p) * 0.13; hRX = -0.10 + th * 0.14;
      const e = easeOutBack(clamp((t % BEAT) / (BEAT * 0.6), 0, 1));
      aLx = lerp(-0.2, -2.3, Math.sin(p) > 0 ? e : 0);
      aRx = lerp(-0.2, -2.3, Math.sin(p) > 0 ? 0 : e);
      aLz = -0.5; aRz = 0.5; fL = -0.6; fR = -0.6;
      lL = Math.sin(p) * 0.30; lR = -Math.sin(p) * 0.30;
    } else if (mv === 'point') {
      const half = Math.floor(t / BEAT) % 2;
      const e = easeOutBack(clamp((t % BEAT) / (BEAT * 0.55), 0, 1));
      y = Math.abs(Math.sin(p)) * 0.55;
      sy = 1 - th * 0.14; sx = 1 + th * 0.12;
      tRY = (half ? 0.45 : -0.45) * e;
      tRZ = (half ? 0.14 : -0.14);
      hRZ = (half ? -0.2 : 0.2) * e;
      aRx = half ? lerp(-0.2, -2.9, e) : -0.4;
      aRz = half ? lerp(0.25, 0.75, e) : 0.30;
      aLx = half ? -0.4 : lerp(-0.2, -2.9, e);
      aLz = half ? -0.30 : lerp(-0.25, -0.75, e);
      fL = -0.15; fR = -0.15;
      lL = Math.sin(p) * 0.22; lR = -Math.sin(p) * 0.22;
    } else if (mv === 'wave') {
      y = Math.abs(Math.sin(p)) * 0.45;
      sy = 1 - th * 0.12; sx = 1 + th * 0.10;
      const w = Math.sin(t * 5.2);
      aLx = -1.9 + w * 0.5; aRx = -1.9 - w * 0.5;
      aLz = -1.05 - w * 0.25; aRz = 1.05 - w * 0.25;
      fL = -0.9 + Math.sin(t * 5.2 - 0.9) * 0.7;
      fR = -0.9 + Math.sin(t * 5.2 + 0.9) * 0.7;
      tRZ = w * 0.16; hRZ = -w * 0.2; tRY = Math.sin(q) * 0.5;
      lL = w * 0.16; lR = -w * 0.16;
    } else if (mv === 'headbang') {
      y = Math.abs(Math.sin(p * 2)) * 0.3;
      const hb = Math.sin(t * Math.PI * 2 / BEAT);
      hRX = 0.55 + hb * 0.55;
      tRZ = Math.sin(q) * 0.10;
      sy = 1 - th * 0.22; sx = 1 + th * 0.18;
      aLx = -2.6; aLz = -1.25; aRx = -2.6; aRz = 1.25;
      fL = -1.5; fR = -1.5;
      lL = 0.18; lR = -0.18;
    } else if (mv === 'kicks') {
      const half = Math.floor(t / BEAT) % 2;
      const e = easeOutBack(clamp((t % BEAT) / (BEAT * 0.5), 0, 1));
      y = Math.abs(Math.sin(p)) * 0.5;
      lL = half ? -1.5 * e : 0.3; lR = half ? 0.3 : -1.5 * e;
      tRZ = (half ? 0.22 : -0.22) * e;
      tRY = (half ? -0.3 : 0.3) * e;
      aLx = half ? -2.0 : -0.5; aRx = half ? -0.5 : -2.0;
      aLz = -0.9; aRz = 0.9; fL = -0.4; fR = -0.4;
      hRZ = (half ? 0.16 : -0.16);
      sy = 1 - th * 0.16; sx = 1 + th * 0.14;
    } else if (mv === 'spinruler') {
      spin = t * 1.7;
      y = Math.abs(Math.sin(p)) * 0.7;
      aRx = -2.75; aRz = 0.55; fR = -0.2;
      m.ruler.rotation.x = -1.5;
      m.ruler.rotation.z = t * 15;                    // helicopter
      aLx = -1.2; aLz = -1.15; fL = -0.9;
      tRZ = Math.sin(p) * 0.2; hRX = -0.22;
      sy = 1 - th * 0.18; sx = 1 + th * 0.15;
      lL = Math.sin(p) * 0.26; lR = -Math.sin(p) * 0.26;
    } else if (mv === 'jumpspin') {
      const cyc = (t % (BEAT * 2)) / (BEAT * 2);
      const up = Math.sin(clamp(cyc / 0.7, 0, 1) * Math.PI);
      y = up * 4.2;
      spin = easeOutBack(clamp(cyc / 0.75, 0, 1)) * TAU;
      const land = cyc > 0.74 ? easeOutElastic(clamp((cyc - 0.74) / 0.26, 0, 1)) : 1;
      sy = cyc > 0.74 ? lerp(0.62, 1, land) : 1 + up * 0.12;
      sx = cyc > 0.74 ? lerp(1.32, 1, land) : 1 - up * 0.06;
      aLx = -2.8 * up - 0.2; aRx = -2.8 * up - 0.2;
      aLz = -1.2; aRz = 1.2; fL = -0.3; fR = -0.3;
      lL = -0.9 * up; lR = -0.9 * up;
      hRX = -0.35 * up;
    } else if (mv === 'shake') {
      /* "NO." — the whole body says no */
      const fast = Math.sin(t * 17);
      const isNo = (t > 50.2 && t < 51.6) || (t > 54.2 && t < 56.0);
      hRZ = fast * (isNo ? 0.45 : 0.12);
      tRY = fast * (isNo ? 0.35 : 0.10);
      y = Math.abs(Math.sin(p)) * (isNo ? 0.9 : 0.35);
      sy = 1 - th * (isNo ? 0.24 : 0.12); sx = 1 + th * (isNo ? 0.20 : 0.10);
      const e = easeOutBack(clamp((t % BEAT) / (BEAT * 0.5), 0, 1));
      aLx = isNo ? lerp(-0.3, -2.9, e) : -0.6;
      aRx = isNo ? lerp(-0.3, -2.9, e) : -0.6;
      aLz = isNo ? -1.4 : -0.5; aRz = isNo ? 1.4 : 0.5;
      fL = -0.5; fR = -0.5;
      lL = Math.sin(p) * 0.2; lR = -Math.sin(p) * 0.2;
    } else if (mv === 'toprock') {
      /* standing hip-hop: weight shifts, shoulders, arms crossing low */
      const sw = Math.sin(p), sw2 = Math.sin(p * 0.5);
      y = Math.abs(sw) * 0.45;
      sy = 1 - th * 0.18; sx = 1 + th * 0.15;
      tRZ = sw * 0.22; tRY = sw2 * 0.55; tRX = 0.12;
      hRZ = -sw * 0.20; hRX = -0.12;
      aLx = -1.25 + sw * 0.8; aRx = -1.25 - sw * 0.8;
      aLz = -0.95 - sw * 0.35; aRz = 0.95 - sw * 0.35;
      fL = -1.35; fR = -1.35;
      lL = sw * 0.55; lR = -sw * 0.55;
      lLz = -0.12; lRz = 0.12;
    } else if (mv === 'sixstep') {
      /* down on his hands, legs sweeping a circle underneath him */
      const sp = t * 3.4;
      tilt = 1.02;                                   // tipped forward onto the floor
      spin = -sp;
      y = 1.55 + Math.sin(sp * 2) * 0.10;
      sy = 1 - th * 0.10; sx = 1 + th * 0.08;
      aLx = -2.95; aRx = -2.95; aLz = -0.55; aRz = 0.55;
      fL = 0.15; fR = 0.15;                          // arms straight, palms down
      lL = -0.55 + Math.sin(sp) * 1.15;
      lR = -0.55 + Math.sin(sp + Math.PI) * 1.15;
      lLz = -0.60 + Math.cos(sp) * 0.55;
      lRz = 0.60 - Math.cos(sp) * 0.55;
      hRX = -0.75; tRX = -0.25;
    } else if (mv === 'backspin') {
      /* flat on his back, legs tucked, going round like a record */
      tilt = -1.52;
      spin = t * 8.2;
      y = 1.15 + Math.sin(t * 16) * 0.05;
      const sq = 1 + th * 0.10;
      sy = 1 / sq; sx = sq;
      lL = -1.85; lR = -1.65;
      lLz = -0.25; lRz = 0.25;
      aLx = -1.5; aRx = -1.5; aLz = -1.45; aRz = 1.45;
      fL = -2.0; fR = -2.0;                          // arms folded in tight
      hRX = 0.45; tRX = 0.18;
    } else if (mv === 'windmill') {
      /* rolling over the shoulders with the legs wide open */
      const sp = t * 4.6;
      tilt = -1.15 + Math.sin(sp) * 0.55;
      roll = Math.sin(sp * 1.0) * 0.95;
      spin = sp * 1.05;
      y = 1.35 + Math.abs(Math.sin(sp)) * 0.75;
      sy = 1 - th * 0.12; sx = 1 + th * 0.10;
      lL = -1.15 + Math.sin(sp) * 0.5; lR = -1.15 - Math.sin(sp) * 0.5;
      lLz = -0.95; lRz = 0.95;                       // legs in a wide V
      aLx = -2.6; aRx = -1.1; aLz = -1.55; aRz = 0.95;
      fL = -0.4; fR = -1.5;
      hRX = 0.35; hRZ = Math.sin(sp) * 0.3;
    } else if (mv === 'worm') {
      /* face down, a wave travelling from head to heels, creeping forward */
      const w = t * 7.4;
      tilt = -1.52 + Math.sin(w) * 0.30;
      roll = Math.PI;                                 // face to the floor
      y = 0.95 + Math.max(0, Math.sin(w)) * 1.05;
      z = -((t - 65.5) * 1.25) % 6;
      sy = 1 + Math.sin(w) * 0.10; sx = 1 - Math.sin(w) * 0.07;
      tRX = Math.sin(w - 0.9) * 0.42;
      hRX = -Math.sin(w - 1.6) * 0.55 - 0.2;
      aLx = -2.85; aRx = -2.85; aLz = -0.75; aRz = 0.75;
      fL = 0.1 + Math.sin(w) * 0.5; fR = 0.1 + Math.sin(w) * 0.5;
      lL = Math.sin(w - 2.4) * 0.45; lR = Math.sin(w - 2.6) * 0.45;
    } else if (mv === 'freeze') {
      /* the pose at the end: one hand planted, everything else in the air */
      const k = clamp(mt / 0.5, 0, 1), e = easeOutBack(k);
      const trem = Math.sin(t * 24) * 0.02 * k;
      tilt = lerp(-1.4, -0.55, e);
      roll = lerp(0, 0.95, e) + trem;
      spin = 0.7;
      y = lerp(1.1, 2.5, e);
      sx = 1 + th * 0.06; sy = 1 - th * 0.06;
      aRx = lerp(-1.5, -2.95, e); aRz = lerp(1.0, 0.25, e); fR = 0.2;
      aLx = lerp(-1.5, -1.9, e); aLz = lerp(-1.0, -1.9, e); fL = -1.1;
      lL = lerp(-1.2, -0.35, e); lR = lerp(-1.2, -1.55, e);
      lLz = -0.75; lRz = 0.30;
      hRX = 0.35 + trem;
    } else if (mv === 'present') {
      /* game-show host: he stands beside the machine and shows it off */
      const half = Math.floor(t / (BEAT * 2)) % 2;
      const e = easeOutBack(clamp((t % (BEAT * 2)) / (BEAT * 0.7), 0, 1));
      x = MACH_AT.x + 7.6; z = MACH_AT.z + 1.4;
      spin = -1.15;                                  // angled toward the machine
      y = Math.abs(Math.sin(p)) * 0.42;
      sy = 1 - th * 0.15; sx = 1 + th * 0.13;
      tRZ = Math.sin(p) * 0.12; tRY = (half ? 0.22 : -0.18) * e;
      hRZ = -Math.sin(p) * 0.12; hRX = -0.14;
      /* the left arm sweeps out at the machine, the right one keeps the beat */
      aLx = lerp(-0.4, -2.35, e); aLz = lerp(-0.4, -1.35, e); fL = -0.35;
      aRx = half ? -0.5 : lerp(-0.4, -2.6, e); aRz = 0.55; fR = -0.5;
      lL = Math.sin(p) * 0.24; lR = -Math.sin(p) * 0.24;
      /* …unless he is slamming the big red button */
      if (this.punchT > 0) {
        const pk = 1 - this.punchT / 0.55;
        const down = pk < 0.45 ? easeOutBack(pk / 0.45) : 1;
        aRx = lerp(-2.9, 0.55, down); aRz = 0.35; fR = lerp(-1.6, 0.1, down);
        tRX = down * 0.30; hRX = 0.28 * down;
        y += (1 - down) * 0.6;
      }
    } else if (mv === 'obbyland') {
      /* dropped into the obby — the Roblox landing crouch, then upright */
      const k = clamp(mt / 1.1, 0, 1);
      const land = easeOutElastic(k);
      const P0 = this.obbyPath ? this.obbyPath[0] : { x: 0, y: 0, z: 0 };
      x = P0.x; z = P0.z; snap = 1;
      y = lerp(14, P0.y, easeOutBounce(clamp(mt / 0.9, 0, 1)));
      sy = lerp(0.55, 1, land); sx = lerp(1.4, 1, land);
      spin = -Math.PI / 2;
      aLx = -0.35; aRx = -0.35; aLz = -0.28; aRz = 0.28;
      fL = -0.1; fR = -0.1; lL = 0.15; lR = -0.15;
      hRX = -0.1;
    } else if (mv === 'obbyrun' || mv === 'push' || mv === 'obbycheer') {
      /* the obby drives his position; the pose comes from the act */
      const O = this.obbyPose || {};
      x = O.x || 0; y = O.y || 0; z = O.z || 0; snap = 1;
      spin = O.spin != null ? O.spin : -Math.PI / 2;
      if (mv === 'obbyrun') {
        /* Roblox default: stiff arms, stiff legs, and a big airborne V */
        if (O.air) {
          aLx = -2.85; aRx = -2.85; aLz = -0.85; aRz = 0.85;
          fL = -0.05; fR = -0.05; lL = -0.15; lR = -0.15;
          sy = 1.10; sx = 0.94; hRX = -0.22;
        } else {
          const st2 = Math.sin(t * 11);
          aLx = st2 * 0.85; aRx = -st2 * 0.85; aLz = -0.22; aRz = 0.22;
          fL = -0.1; fR = -0.1;
          lL = -st2 * 0.75; lR = st2 * 0.75;
          y += Math.abs(Math.cos(t * 11)) * 0.10;
          sy = 1 - th * 0.08; sx = 1 + th * 0.07;
        }
        tRZ = Math.sin(t * 5.5) * 0.06;
      } else if (mv === 'push') {
        const k = clamp(mt / 1.6, 0, 1), e = easeOutBack(k);
        spin = O.spin != null ? O.spin : -Math.PI / 2;
        aLx = lerp(-0.4, -1.62, e); aRx = lerp(-0.4, -1.62, e);
        aLz = lerp(-0.3, -0.16, e); aRz = lerp(0.3, 0.16, e);
        fL = lerp(-0.2, 0.05, e); fR = lerp(-0.2, 0.05, e);
        tRX = e * 0.42; hRX = e * 0.18;
        lL = e * 0.42; lR = -e * 0.12;
        sx = 1 + e * 0.06; sy = 1 - e * 0.04;
      } else {
        /* he did it */
        y += Math.abs(Math.sin(p)) * 1.15;
        aLx = -2.9; aRx = -2.9; aLz = -1.0; aRz = 1.0; fL = -0.2; fR = -0.2;
        sy = 1 - th * 0.24; sx = 1 + th * 0.20;
        hRX = -0.35; tRY = Math.sin(q) * 0.5;
        lL = Math.sin(p) * 0.4; lR = -Math.sin(p) * 0.4;
      }
    } else if (mv === 'hstand' || mv === 'hwalk' || mv === 'hpush' || mv === 'hreach' ||
               mv === 'hlean' || mv === 'hshake' || mv === 'hgrab' || mv === 'hsqueeze') {
      /* ---- the bonus: he is not dancing any more, he is just a man ---- */
      const A5 = this.actPose;
      if (A5) { x = A5.x; z = A5.z; y = A5.y || 0; spin = A5.spin || 0; snap = 1; }
      const hk = t - 440, HB = HOME_BEATS;

      if (mv === 'hwalk') {
        const st3 = Math.sin(t * 7.4);
        y += Math.abs(Math.cos(t * 7.4)) * 0.15;
        aLx = st3 * 0.60; aRx = -st3 * 0.60; aLz = -0.24; aRz = 0.24;
        lL = -st3 * 0.58; lR = st3 * 0.58;
        tRZ = st3 * 0.045; hRX = -0.05;
      } else if (mv === 'hstand') {
        y += Math.sin(t * 1.6) * 0.035;
        aLz = -0.20; aRz = 0.20; hRX = -0.04;
        tRZ = Math.sin(t * 1.1) * 0.025;
      } else if (mv === 'hpush') {
        /* one arm out on the door, leaning into it */
        const e = clamp((hk - (z > 0 ? HB.doorOpen : HB.bdoorOpen)) / 0.9, 0, 1);
        aRx = lerp(-0.2, -1.75, easeOutBack(e)); aRz = 0.42;
        fR = lerp(-0.2, -0.35, e);
        tRY = -0.18 * e; hRX = -0.10;
        y += Math.sin(t * 2) * 0.02;
      } else if (mv === 'hreach') {
        /* up to the switch, then down again */
        const e = clamp((hk - HB.atSwitch) / 0.9, 0, 1);
        const dn = clamp((hk - HB.click) / 0.5, 0, 1);
        const up = e * (1 - dn * 0.85);
        aRx = lerp(-0.2, -2.15, easeOutBack(up)); aRz = lerp(0.20, 0.62, up);
        fR = -0.25; hRX = -0.16 * e; tRY = -0.10 * e;
        y += Math.sin(t * 1.8) * 0.02;
      } else if (mv === 'hlean') {
        /* bent over the desk, reading it, getting slowly closer */
        const e = clamp((hk - HB.lean) / 1.6, 0, 1);
        tRX = lerp(0, 0.52, e);
        hRX = lerp(-0.05, 0.30, e);
        aLx = lerp(-0.2, -0.85, e); aRx = lerp(-0.2, -0.95, e);
        aLz = -0.36; aRz = 0.36; fL = -0.5; fR = -0.55;
        y += -e * 0.25;
      } else if (mv === 'hshake') {
        /* the tremble.  Fast, small, and it grows */
        const g5 = clamp((hk - HB.tremble) / 4.0, 0, 1);
        const big = hk >= HB.boilOver ? 1.9 : 1;
        const sh2 = g5 * big;
        x += Math.sin(t * 47) * 0.055 * sh2;
        y += Math.abs(Math.sin(t * 39)) * 0.045 * sh2;
        tRX = 0.34 + Math.sin(t * 31) * 0.05 * sh2;
        tRZ = Math.sin(t * 43) * 0.06 * sh2;
        hRX = 0.16 + Math.sin(t * 53) * 0.07 * sh2;
        hRZ = Math.sin(t * 37) * 0.08 * sh2;
        /* fists balled at his sides, shoulders up */
        aLx = -0.55 - g5 * 0.35; aRx = -0.55 - g5 * 0.35;
        aLz = -0.62 - g5 * 0.28; aRz = 0.62 + g5 * 0.28;
        fL = -1.25 - g5 * 0.4; fR = -1.25 - g5 * 0.4;
        sy = 1 + g5 * 0.05; sx = 1 + g5 * 0.10;
      } else if (mv === 'hgrab') {
        /* both arms out, going for her */
        const e = clamp((hk - HB.lunge) / 0.9, 0, 1);
        tRX = lerp(0.34, 0.18, e);
        aLx = lerp(-0.55, -2.15, easeOutBack(e)); aRx = lerp(-0.55, -2.15, easeOutBack(e));
        aLz = lerp(-0.62, -0.30, e); aRz = lerp(0.62, 0.30, e);
        fL = lerp(-1.25, -0.30, e); fR = lerp(-1.25, -0.30, e);
        hRX = 0.10; y += e * 0.35;
        sx = 1 + e * 0.10; sy = 1 - e * 0.06;
      } else if (mv === 'hsqueeze') {
        /* both arms wrapped round her, clutched to his chest, and a hard
           squeeze on every syllable of what he is shouting */
        const s4 = hk - HB.caught;
        const pump = Math.max(0, Math.sin(s4 * 5.2));
        aLx = -1.42 - pump * 0.18; aRx = -1.42 - pump * 0.18;
        aLz = -0.92 - pump * 0.22; aRz = 0.92 + pump * 0.22;
        fL = -1.55 - pump * 0.30; fR = -1.55 - pump * 0.30;
        tRX = 0.14 - pump * 0.12;
        hRX = 0.04 - pump * 0.16;
        x += Math.sin(t * 41) * 0.03;
        y += pump * 0.10 + Math.abs(Math.sin(t * 33)) * 0.02;
        sx = 1 + pump * 0.13; sy = 1 - pump * 0.08;
        tRZ = Math.sin(t * 27) * 0.04;
      }
    } else if (mv === 'walkon' || mv === 'backoff' || mv === 'watch' ||
               mv === 'prone' || mv === 'crouch' || mv === 'caneswing' ||
               mv === 'dribble' || mv === 'bicycle' || mv === 'lift') {
      const A2 = this.actPose;
      if (A2) { x = A2.x; z = A2.z; y = A2.y || 0; spin = A2.spin || 0; snap = 1; }

      if (mv === 'walkon') {
        const st2 = Math.sin(t * 9);
        y += Math.abs(Math.cos(t * 9)) * 0.16;
        aLx = st2 * 0.75; aRx = -st2 * 0.75; aLz = -0.28; aRz = 0.28;
        lL = -st2 * 0.68; lR = st2 * 0.68;
        tRZ = st2 * 0.05; hRX = -0.08;
        sy = 1 - th * 0.08; sx = 1 + th * 0.07;
      } else if (mv === 'backoff') {
        /* walking away without looking, like a professional */
        const st2 = Math.sin(t * 7.5);
        y += Math.abs(Math.cos(t * 7.5)) * 0.14;
        aLx = st2 * 0.5; aRx = -st2 * 0.5; aLz = -0.5; aRz = 0.5;
        lL = -st2 * 0.55; lR = st2 * 0.55;
        hRX = -0.12; tRZ = st2 * 0.04;
      } else if (mv === 'watch') {
        /* arms folded, nodding along to somebody else's violence */
        y += Math.abs(Math.sin(p)) * 0.22;
        aLx = -1.62; aRx = -1.62; aLz = -0.62; aRz = 0.62;
        fL = -1.75; fR = -1.75;
        hRX = -0.10 + Math.sin(p) * 0.10;
        tRZ = Math.sin(q) * 0.07; tRY = Math.sin(q * 0.5) * 0.18;
        sy = 1 - th * 0.10; sx = 1 + th * 0.09;
        lL = Math.sin(p) * 0.10; lR = -Math.sin(p) * 0.10;
      } else if (mv === 'prone') {
        /* flat behind the rifle */
        tilt = -1.50; y = 0.85;
        const recoil = clamp(1 - Math.abs(t - 158.45) / 0.35, 0, 1);
        z += recoil * 0.5;
        aLx = -2.55; aRx = -2.45; aLz = -0.75; aRz = 0.62;
        fL = -1.15; fR = -1.30;
        lL = 0.12; lR = -0.12; lLz = -0.34; lRz = 0.34;
        hRX = 0.55 - recoil * 0.35; tRX = 0.10;
        sx = 1 + recoil * 0.10; sy = 1 - recoil * 0.08;
      } else if (mv === 'crouch') {
        /* down on one knee, planting */
        y += 0;
        tRX = 0.55; hRX = 0.30;
        lL = -1.35; lR = -0.25; lLz = -0.35; lRz = 0.20;
        const work = Math.sin(t * 7) * 0.25;
        aLx = -1.9 + work; aRx = -1.9 - work; aLz = -0.45; aRz = 0.45;
        fL = -0.9; fR = -0.9;
        sy = 0.82; sx = 1.08;
      } else if (mv === 'caneswing') {
        /* his arm follows the cane exactly */
        const sw = this.caneSwing || -0.4;
        aRx = -1.35 + sw * 0.85; aRz = 0.55; fR = -0.5 + sw * 0.4;
        aLx = -0.45; aLz = -0.6; fL = -0.3;
        tRZ = sw * 0.16; tRY = -0.12; hRX = -0.08 - sw * 0.12;
        y += Math.abs(Math.sin(p)) * 0.12;
        sy = 1 - th * 0.10; sx = 1 + th * 0.09;
      } else if (mv === 'dribble') {
        const st2 = Math.sin(t * 13);
        y += Math.abs(Math.cos(t * 13)) * 0.30;
        aLx = st2 * 1.25; aRx = -st2 * 1.25; aLz = -0.42; aRz = 0.42;
        fL = -0.4; fR = -0.4;
        lL = -st2 * 1.15; lR = st2 * 1.15;
        tRZ = st2 * 0.10; tRX = 0.18; hRX = 0.10;
        sy = 1 - th * 0.10; sx = 1 + th * 0.09;
      } else if (mv === 'bicycle') {
        /* over he goes */
        const kk = clamp(mt / 1.5, 0, 1);
        tilt = -kk * TAU;                       // a full backflip
        y += Math.sin(kk * Math.PI) * 5.5;
        const sc2 = Math.sin(kk * Math.PI * 2.2);
        lL = -1.6 + sc2 * 1.9; lR = -1.6 - sc2 * 1.9;
        aLx = -2.7; aRx = -2.7; aLz = -1.35; aRz = 1.35;
        fL = -0.35; fR = -0.35;
        sx = 1 + Math.sin(kk * Math.PI) * 0.10;
        sy = 1 - Math.sin(kk * Math.PI) * 0.06;
      } else {                                  /* lift */
        y += Math.abs(Math.sin(p)) * 1.35;
        aLx = -2.95; aRx = -2.95; aLz = -0.9; aRz = 0.9;
        fL = -0.15; fR = -0.15;
        hRX = -0.42; tRY = Math.sin(q) * 0.55;
        sy = 1 - th * 0.26; sx = 1 + th * 0.22;
        lL = Math.sin(p) * 0.45; lR = -Math.sin(p) * 0.45;
      }
    } else if (mv === 'naoya') {
      const A4 = this.actPose;
      if (A4) { x = A4.x; z = A4.z; y = A4.y || 0; spin = A4.spin || 0; snap = 1; }
      const sub = this.naoyaSub || 'stand';
      const str = this.duelStretch || 0;

      if (sub === 'stand') {
        /* dead still. Only the coat moves. */
        y += Math.sin(t * 0.9) * 0.03;
        aLx = -0.06; aRx = -0.06; aLz = -0.16; aRz = 0.16;
        fL = -0.12; fR = -0.12; lL = 0; lR = 0;
        hRX = -0.05; tRZ = Math.sin(t * 0.7) * 0.015;
      } else if (sub === 'dash') {
        /* low, leaning into it, arm trailing */
        const w = Math.sin(t * 26);
        tRX = 0.62; hRX = -0.42;
        aLx = -2.7 + w * 0.5; aRx = 1.05 - w * 0.5;
        aLz = -0.85; aRz = 0.55;
        fL = -0.9; fR = -0.25;
        lL = -1.15 + w * 0.9; lR = -0.35 - w * 0.9;
        lLz = -0.16; lRz = 0.16;
        sx = 1 - str * 0.20; sy = 1 - str * 0.10;
      } else if (sub === 'follow') {
        tRX = 0.35; hRX = -0.25;
        aLx = -2.2; aRx = -1.4; aLz = -1.0; aRz = 0.9; fL = -0.5; fR = -0.5;
        lL = -0.5; lR = 0.4;
      } else if (sub === 'guard') {
        aLx = -1.55; aRx = -1.55; aLz = -0.55; aRz = 0.55;
        fL = -1.7; fR = -1.7; tRX = 0.16; hRX = -0.10;
        y += Math.abs(Math.sin(p)) * 0.10;
      } else if (sub === 'knocked') {
        const w = Math.sin(t * 19);
        tilt = -0.9 + w * 0.25; roll = w * 0.5;
        aLx = -2.5 + w; aRx = -2.5 - w; aLz = -1.5; aRz = 1.5;
        lL = -1.1 + w * 0.7; lR = -1.1 - w * 0.7;
        hRX = 0.5;
      } else if (sub === 'rise') {
        const e = easeOutBack(clamp(mt / 1.0, 0, 1));
        tilt = lerp(-0.9, 0, e);
        aLx = lerp(-2.5, -0.2, e); aRx = lerp(-2.5, -0.2, e);
        aLz = -0.3; aRz = 0.3; fL = -0.3; fR = -0.3;
        lL = lerp(-1.1, 0, e); lR = lerp(-1.1, 0, e);
      } else if (sub === 'slapArm') {
        const e = easeOutBack(clamp(mt / 0.5, 0, 1));
        aRx = lerp(-0.3, -1.62, e); aRz = lerp(0.3, 0.10, e); fR = lerp(-0.2, 0.05, e);
        aLx = -0.5; aLz = -0.9; fL = -0.4;
        tRX = e * 0.30; tRY = -e * 0.35; hRX = e * 0.15;
      } else if (sub === 'walkRound') {
        const w = Math.sin(t * 6.5);
        aLx = w * 0.4 - 0.15; aRx = -w * 0.4 - 0.15;
        aLz = -0.25; aRz = 0.25; fL = -0.2; fR = -0.2;
        lL = -w * 0.55; lR = w * 0.55;
        y += Math.abs(Math.cos(t * 6.5)) * 0.10;
        hRX = -0.06; tRY = -0.20;
      } else if (sub === 'wind') {
        /* stillness before impact — everything drawn back, nothing moving */
        const e = easeOutBack(clamp(mt / 1.6, 0, 1));
        aRx = lerp(-0.3, -3.05, e); aRz = lerp(0.3, 0.85, e); fR = lerp(-0.2, -1.75, e);
        aLx = -0.35; aLz = -0.95; fL = -0.35;
        tRZ = lerp(0, -0.34, e); tRY = lerp(0, 0.36, e);
        hRX = -0.24; tRX = -0.10;
        y += e * 0.30;
        sy = 1 + e * 0.04; sx = 1 - e * 0.03;
      } else {                                        /* smash */
        const e = easeOutBack(clamp(mt / 0.34, 0, 1));
        aRx = lerp(-3.05, 1.15, e); aRz = lerp(0.85, 0.20, e); fR = lerp(-1.75, 0.15, e);
        aLx = -0.9; aLz = -0.5; fL = -0.2;
        tRX = e * 0.72; tRZ = e * 0.30; hRX = e * 0.42;
        lL = e * 0.55; lR = -e * 0.20;
        sx = 1 + e * 0.14; sy = 1 - e * 0.12;
      }
    } else if (mv === 'slap') {
      /* the finishing blow, with the ruler */
      const A3 = this.actPose;
      if (A3) { x = A3.x; z = A3.z; y = A3.y || 0; spin = A3.spin || 0; snap = 1; }
      const kk = clamp(mt / 1.3, 0, 1);
      const wind = clamp(kk / 0.55, 0, 1), hit = clamp((kk - 0.55) / 0.45, 0, 1);
      aRx = lerp(-0.3, -3.0, easeOutBack(wind)) + hit * 3.7;
      aRz = 0.35; fR = lerp(-0.2, -1.6, wind) + hit * 1.5;
      aLx = -0.6; aLz = -0.7; fL = -0.4;
      tRZ = lerp(0, -0.30, wind) + hit * 0.55;
      tRX = hit * 0.35; hRX = -0.25 + hit * 0.45;
      y += (1 - hit) * wind * 0.9;
      sx = 1 + hit * 0.10; sy = 1 - hit * 0.08;
    } else if (mv === 'ignite') {
      /* he squares up to the pile, winds back, and throws the fire at it */
      const wind = clamp(mt / 1.0, 0, 1);
      const thrown = clamp((mt - 1.05) / 0.5, 0, 1);
      spin = Math.atan2(PILLAR_AT.x - 0, PILLAR_AT.z - 0);
      y = thrown > 0 ? easeOutBounce(thrown) * 0.3 : Math.abs(Math.sin(p)) * 0.25;
      sy = 1 - thrown * 0.10 + wind * 0.06;
      sx = 1 + thrown * 0.10 - wind * 0.05;
      const wb = easeOutBack(wind);
      aRx = lerp(-0.3, -2.95, wb) + thrown * 3.6;
      aRz = lerp(0.25, 0.95, wb) - thrown * 0.55;
      fR = lerp(-0.2, -1.5, wb) + thrown * 1.4;
      aLx = -0.5 - wind * 0.4; aLz = -0.8;
      fL = -0.4;
      hRX = -0.35 + thrown * 0.5;
      tRZ = lerp(0, -0.25, wb) + thrown * 0.5;
      m.ruler.rotation.z = 0;
    } else if (mv === 'crazy') {
      const f1 = Math.sin(t * 13.7), f2 = Math.sin(t * 9.1 + 1), f3 = Math.sin(t * 17.3);
      spin = Math.sin(t * 2.2) * 0.9 + t * 0.5;
      y = Math.abs(Math.sin(t * 7)) * 1.9 + Math.abs(f3) * 0.5;
      sy = 1 - th * 0.30 + f2 * 0.06; sx = 1 + th * 0.26 - f2 * 0.05;
      hRX = f1 * 0.4 - 0.15; hRZ = f2 * 0.5;
      tRZ = f2 * 0.30; tRY = f1 * 0.45;
      aLx = -2.2 + f1 * 1.4; aRx = -2.2 + f3 * 1.4;
      aLz = -1.5 + f2 * 0.6; aRz = 1.5 - f2 * 0.6;
      fL = -1.1 + f3 * 0.9; fR = -1.1 + f1 * 0.9;
      lL = f3 * 0.9; lR = -f1 * 0.9;
      m.ruler.rotation.z = t * 22;
    }

    /* once the pile is alight he sidles over to admire his work — but only
       while the fire is still burning.  The bonus takes him somewhere else
       entirely, and this would drag him back to the dance floor every frame. */
    const near = t < 440 ? clamp((t - 412.6) / 2.4, 0, 1) : 0;
    if (near > 0) { x = lerp(x, PILLAR_AT.x + 5.2, near); z = lerp(z, PILLAR_AT.z + 4.4, near); }
    if (mv === 'arrive') z = lerp(-11, 0, clamp(t / 2.4, 0, 1));

    /* ease every channel toward the pose so cuts never snap */
    const hard = snap || mv === 'jumpspin' || mv === 'crazy' || mv === 'sixstep' ||
                 mv === 'backspin' || mv === 'windmill' || mv === 'worm';
    const k = 1 - Math.exp(-dt * 17);
    const kp = snap ? 1 : k;
    r.x = lerp(r.x, x, kp); r.z = lerp(r.z, z, kp); r.y = lerp(r.y, y, kp);
    r.spin = lerp(r.spin, spin, hard ? 1 : k);
    r.tilt = lerp(r.tilt, tilt, hard ? 1 : k); r.roll = lerp(r.roll, roll, hard ? 1 : k);
    r.sx = lerp(r.sx, sx, k); r.sy = lerp(r.sy, sy, k);
    r.headRX = lerp(r.headRX, hRX, k); r.headRZ = lerp(r.headRZ, hRZ, k);
    r.torsoRY = lerp(r.torsoRY, tRY, k); r.torsoRZ = lerp(r.torsoRZ, tRZ, k);
    r.torsoRX = lerp(r.torsoRX, tRX, k);
    r.aLx = lerp(r.aLx, aLx, k); r.aLz = lerp(r.aLz, aLz, k);
    r.aRx = lerp(r.aRx, aRx, k); r.aRz = lerp(r.aRz, aRz, k);
    r.foreL = lerp(r.foreL, fL, k); r.foreR = lerp(r.foreR, fR, k);
    r.lLx = lerp(r.lLx, lL, k); r.lRx = lerp(r.lRx, lR, k);
    r.lLz = lerp(r.lLz, lLz, k); r.lRz = lerp(r.lRz, lRz, k);

    /* drive the rig */
    m.root.position.set(r.x, r.y, r.z);
    m.root.rotation.set(r.tilt, r.spin, r.roll);
    m.root.scale.set(1.05 * r.sx, 1.05 * r.sy, 1.05 * r.sx);
    m.torso.rotation.set(r.torsoRX, r.torsoRY, r.torsoRZ);
    m.torso.position.y = 3.05;
    m.head.rotation.set(r.headRX, 0, r.headRZ);
    m.head.position.y = 6.05 + Math.sin(t * Math.PI / BEAT) * 0.10;
    m.armL.g.rotation.set(r.aLx, 0, r.aLz);
    m.armR.g.rotation.set(r.aRx, 0, r.aRz);
    m.armL.fore.rotation.x = r.foreL;
    m.armR.fore.rotation.x = r.foreR;
    m.legL.rotation.set(r.lLx, 0, r.lLz);
    m.legR.rotation.set(r.lRx, 0, r.lRz);
    if (mv !== 'spinruler' && mv !== 'crazy') m.ruler.rotation.z = 0;

    /* ------- the face ------- */
    const burn = this.burn;
    /* the epilogue has its own kind of anger: no spirals, no fire — just a
       man who has read what is written on his own worksheet */
    const home = this.homeMove ? 1 : 0;
    const rg = home ? (this.rageK || 0) : 0;
    const heat = Math.max(burn, rg);
    m.setMood(heat > 0.05 ? 3 : 0);
    m.mood = lerp(m.mood, heat > 0.05 ? 3 : 0, 1 - Math.exp(-dt * 3));
    const a = clamp(m.mood / 3, 0, 1);
    m.anger = a;

    /* mouth: he is singing, so keep it flapping unless he is furious.  In the
       bonus he is not singing at all — he only opens his mouth to shout. */
    m.talk = 0.2;
    const shouting = home && (t - 440) >= HOME_BEATS.shout;
    const talkOpen = home
      ? (shouting ? 0.55 + 0.45 * Math.sin(t * 26) : 0.06)
      : 0.5 + 0.5 * Math.sin(t * 19);
    const angry = a > 0.10;
    m.calmMouth.visible = !angry;
    m.madMouth.visible = angry;
    const smile = m.calmMouth.children[0], talkO = m.calmMouth.children[1];
    if (smile) smile.visible = false;
    if (talkO) { talkO.visible = !angry; talkO.scale.set(1.35, 0.35 + talkOpen * 1.05, 0.5); }
    if (angry) {
      const roar = shouting ? 0.55 + Math.abs(Math.sin(t * 13)) * 0.5 : 0;
      m.madMouth.scale.set(1.05 + th * 0.2 + roar * 0.25,
                           1.10 + th * 0.35 + roar * 0.8, 1);
    }

    /* eyes: googly on the beat, full spiral once the fire starts */
    const bulge = 1 + th * 0.16 + burn * 0.55 + rg * 0.30;
    m.eyeL.g.scale.set(bulge * (1 + Math.sin(t * 12) * 0.06 * burn), bulge, bulge);
    m.eyeR.g.scale.set(bulge, bulge * (1 + Math.sin(t * 15 + 1) * 0.07 * burn), bulge);
    m.eyeL.pupilG.position.set(Math.sin(t * 6.3) * 0.06, Math.cos(t * 5.1) * 0.05, 0.155);
    m.eyeR.pupilG.position.set(Math.sin(t * 5.7 + 2) * 0.06, Math.cos(t * 6.9) * 0.05, 0.155);
    m.eyeL.lid.position.y = 0.60; m.eyeR.lid.position.y = 0.60;
    if (rg > 0.02) {
      /* whites gone red, pupils shrunk to pinpricks, both of them shivering
         out of time with each other */
      m.eyeL.pupilG.visible = true; m.eyeR.pupilG.visible = true;
      for (const S3 of this.spirals) S3.visible = false;
      m.eyeL.white.material.color.setRGB(1, lerp(1, 0.16, rg), lerp(1, 0.16, rg));
      m.eyeR.white.material.color.setRGB(1, lerp(1, 0.16, rg), lerp(1, 0.16, rg));
      const shr = lerp(1, 0.34, rg);
      m.eyeL.pupilG.scale.setScalar(shr * (1 + Math.sin(t * 44) * 0.10 * rg));
      m.eyeR.pupilG.scale.setScalar(shr * (1 + Math.sin(t * 51 + 1) * 0.10 * rg));
      m.eyeL.pupilG.position.x += Math.sin(t * 46) * 0.030 * rg;
      m.eyeR.pupilG.position.x += Math.sin(t * 52 + 2) * 0.030 * rg;
      m.eyeL.pupilG.position.y += Math.sin(t * 39) * 0.024 * rg;
      m.eyeR.pupilG.position.y += Math.sin(t * 43 + 1) * 0.024 * rg;
    } else if (burn > 0.02) {
      m.eyeL.pupilG.visible = false; m.eyeR.pupilG.visible = false;
      this.spirals[0].rotation.z = -t * 9;
      this.spirals[1].rotation.z = t * 11;
      this.spirals[0].scale.setScalar(0.7 + Math.sin(t * 8) * 0.18);
      this.spirals[1].scale.setScalar(0.7 + Math.sin(t * 8 + 2) * 0.18);
      m.eyeL.white.material.color.setHSL(0.09, 1, 0.72);
      m.eyeR.white.material.color.setHSL(0.09, 1, 0.72);
    } else if (home) {
      m.eyeL.pupilG.scale.setScalar(1); m.eyeR.pupilG.scale.setScalar(1);
      m.eyeL.white.material.color.setRGB(1, 1, 1);
      m.eyeR.white.material.color.setRGB(1, 1, 1);
    }
    m.SKIN.color.copy(new THREE.Color(0xe8cba4)
      .lerp(new THREE.Color(0xdc6a4a), burn * 0.7)
      .lerp(new THREE.Color(0xd05a48), rg * 0.55));
  },

  /* ----------------------------------------------------------- camera */
  tickCamera(dt, t) {
    const s = this.shot || DJ_SHOTS[0];
    this.shotT += dt;
    const cam = this.camera;
    /* set-piece shots are authored in local coordinates; each set lives in
       its own far-off corner of the world, so shift everything across */
    const O = s.act ? ACT_AT[s.act] : { x: 0, z: 0 };
    const look = new THREE.Vector3().fromArray(s.look || [0, 6, 0]);
    look.x += O.x; look.z += O.z;
    if (s.kind === 'duel') {
      const C = this.duelCam || {}, mode = this.duelCamMode || 'hold';
      const O2 = ACT_AT.naoya;
      const lk = C.look || [0, 5, 0];
      const target = new THREE.Vector3(O2.x + lk[0], lk[1], O2.z + lk[2]);
      const B = this.model.root.position;
      if (mode === 'pushLow') {
        const e = 1 - Math.pow(1 - (C.k || 0), 2.6);
        cam.position.set(O2.x + lerp(C.from[0], C.to[0], e), lerp(C.from[1], C.to[1], e),
                         O2.z + lerp(C.from[2], C.to[2], e));
        cam.fov = lerp(58, 40, e);
      } else if (mode === 'orbitTight') {
        const a = this.shotT * (C.spin || 1);
        cam.position.set(target.x + Math.sin(a) * C.r, C.y, target.z + Math.cos(a) * C.r);
        cam.fov = 62;
      } else if (mode === 'track') {
        const off = C.off || [10, 5, 12];
        cam.position.lerp(new THREE.Vector3(target.x + off[0], off[1], target.z + off[2]),
                          1 - Math.exp(-dt * 5));
        cam.fov = 68;
      } else if (mode === 'closeGirl') {
        const off = C.off || [3, 5.6, 5.5];
        cam.position.set(target.x + off[0], off[1], target.z + off[2]);
        cam.fov = 34;
      } else if (mode === 'fist') {
        /* extreme foreshortening — right down the barrel of the wind-up */
        cam.position.set(B.x + Math.sin(this.model.root.rotation.y) * 3.2, 6.4,
                         B.z + Math.cos(this.model.root.rotation.y) * 3.2);
        cam.fov = 96;
      } else if (mode === 'lowSmash') {
        cam.position.set(target.x + 7.5, 1.5, target.z + 9.5);
        cam.fov = 78;
      } else if (mode === 'pullOut') {
        const e = clamp((this.shotT - 2.2) / 3.0, 0, 1);
        cam.position.set(target.x + lerp(7.5, 22, e), lerp(1.5, 26, e), target.z + lerp(9.5, 40, e));
        cam.fov = lerp(78, 58, e);
      } else {
        cam.position.set(target.x + 12, 7, target.z + 16);
        cam.fov = 60;
      }
      cam.updateProjectionMatrix();
      const sh = (this.shakeT || 0) * 0.55;
      cam.position.x += Math.sin(t * 47) * sh * 3.2;
      cam.position.y += Math.sin(t * 39 + 1) * sh * 2.6;
      cam.lookAt(target);
      /* a dutch tilt that grows with the violence */
      cam.rotation.z += Math.sin(t * 0.7) * 0.03 + sh * 0.5;
      this.shakeT = Math.max(0, (this.shakeT || 0) - dt);
      return;
    }
    if (s.kind !== 'duel' && cam.fov !== 64) { cam.fov = 64; cam.updateProjectionMatrix(); }
    if (s.kind === 'obby') {
      const O = this.obbyPose || { x: 0, y: 0, z: 0 };
      const P = this.obby.userData.path;
      const mid = P[Math.floor(P.length / 2)];
      if (s.mode === 'wide') {
        cam.position.set(mid.x + 2, 16, mid.z + 34);
        look.set(mid.x, 2, mid.z);
      } else if (s.mode === 'chase') {
        cam.position.set(O.x - 9.5, O.y + 5.5, O.z + 8.5);
        look.set(O.x + 3, O.y + 2.2, O.z);
      } else if (s.mode === 'side') {
        cam.position.set(O.x + 1.5, O.y + 2.4, O.z + 12.5);
        look.set(O.x, O.y + 2.0, O.z);
      } else if (s.mode === 'ahead') {
        cam.position.set(O.x + 13, O.y + 4.0, O.z - 4.5);
        look.set(O.x, O.y + 2.4, O.z);
      } else if (s.mode === 'push') {
        cam.position.set(O.x + 3.0, O.y + 4.6, O.z + 9.0);
        look.set(O.x + 3.5, O.y + 1.6, O.z);
      } else {                                        // 'fall'
        const st = this.obby.userData.stack;
        const last = P[P.length - 1];
        cam.position.set(last.x + 11, 6.5, last.z + 21);
        const tgt = this.splashAt
          ? new THREE.Vector3(this.splashAt.x, -6.0, this.splashAt.z)
          : new THREE.Vector3(st.position.x, clamp(st.position.y, -9.5, 14), st.position.z);
        look.copy(tgt);
      }
      const sh = 0.018 * (0.5 + thump(t, 6));
      cam.position.x += Math.sin(t * 29) * sh * 2.2;
      cam.position.y += Math.sin(t * 24 + 1) * sh * 1.8;
      cam.lookAt(look);
      cam.rotation.z += Math.sin(t * 2.7) * 0.008;
      return;
    }
    if (s.kind === 'orbit') {
      const a = s.a0 + this.shotT * s.spin;
      const cx = (s.c ? s.c[0] : 0) + O.x, cz = (s.c ? s.c[1] : 0) + O.z;
      cam.position.set(cx + Math.sin(a) * s.r, s.y, cz + Math.cos(a) * s.r);
    } else if (s.kind === 'push') {
      const k = clamp(this.shotT / 4.0, 0, 1), e = 1 - Math.pow(1 - k, 2.2);
      cam.position.set(O.x + lerp(s.from[0], s.to[0], e), lerp(s.from[1], s.to[1], e),
                       O.z + lerp(s.from[2], s.to[2], e));
    } else {
      cam.position.set(O.x + s.from[0], s.from[1], O.z + s.from[2]);
    }
    this.shakeT = Math.max(0, (this.shakeT || 0) - dt);
    const shake = ((s.shake || 0) + this.shakeT * 0.30) * (0.5 + thump(t, 6));
    cam.position.x += Math.sin(t * 31) * shake * 2.4;
    cam.position.y += Math.sin(t * 27 + 1) * shake * 2.0;
    if (!s.act) look.y += this.model.root.position.y * 0.35;
    cam.lookAt(look);
    cam.rotation.z += Math.sin(t * 3.1) * 0.012 + shake * 0.25;
  },

  /* ------------------------------------------------------------ finish */
  /* jump to a point in the video (also re-anchors the audio clock) */
  seek(v) {
    this.t = v;
    const ctx = Audio1.ctx;
    if (this.audioT0 != null && ctx) this.audioT0 = ctx.currentTime - v;
  },

  skip() { if (this.active) { this.t = DJ_END - 0.01; this.skipped = true; this.finish(); } },

  finish() {
    if (!this.active) return;
    this.active = false;
    this.obbyPose = null; this._hop = -1;
    DJAudio.stop();
    UI.el('djSkip').classList.add('hidden');
    UI.el('djFX').innerHTML = '';
    UI.el('lyric').textContent = '';
    UI.el('lyric').classList.remove('pop');
    UI.el('djTitle').classList.remove('on');
    this.scene = null; this.model = null;
    G.running = false; G.mode = 'win';
    if (document.exitPointerLock) document.exitPointerLock();
    Audio1.winFanfare();
    UI.el('win').querySelector('h2').textContent = 'CONFISCATED!';
    UI.el('winSub').innerHTML = this.skipped
      ? 'Every volume accounted for, and every volume dealt with.<br>' +
        '<b>"Thank you for your service. Do not tell anyone about the decks."</b>'
      : 'Every volume accounted for. Every volume dealt with.<br>' +
        'Except the three at home, who are getting a very stern letter.<br>' +
        '<b>"Do not tell anyone about the decks. Or the girls."</b>';
    UI.el('win').classList.remove('hidden');
  }
};


/* =========================================================================
   Part 5f — SIX WAYS TO DESTROY A BOOK, AND ONE OBBY
   Props for the middle of the music video. Everything in here is built once
   and hidden until its moment.
   ========================================================================= */

const MACH_AT = { x: 0, z: 7.5 };            // where the machines stand
const ROBLOX = {
  red: 0xc4281c, blue: 0x0d69ac, yellow: 0xf5cd30, green: 0xa4bd47,
  white: 0xf8f8f8, grey: 0xa3a2a5, lime: 0x4bd44b, orange: 0xd77f31,
  purple: 0x8a4fbd, cyan: 0x3fc4d9
};

/* --------------------------------------------------------- shared bits */
let STUD_TEX = null;
function studTexture() {
  if (STUD_TEX) return STUD_TEX;
  const S = 64, { c, x } = cv(S, S);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, S, S);
  x.fillStyle = 'rgba(0,0,0,.16)';
  x.beginPath(); x.arc(32, 32, 18, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(255,255,255,.85)';
  x.beginPath(); x.arc(32, 30, 15, 0, Math.PI * 2); x.fill();
  x.strokeStyle = 'rgba(0,0,0,.22)'; x.lineWidth = 2.5;
  x.beginPath(); x.arc(32, 31, 16.5, 0, Math.PI * 2); x.stroke();
  STUD_TEX = texFrom(c, 1, 1);
  return STUD_TEX;
}
/* a Roblox part: a coloured box with studs on top */
function makePart(w, h, d, col, studsX, studsZ) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: col });
  const body = box(w, h, d, mat); g.add(body);
  const st = studTexture();
  const sm = new THREE.MeshLambertMaterial({ map: st, color: col, transparent: true });
  const nx = studsX || Math.max(1, Math.round(w / 2)), nz = studsZ || Math.max(1, Math.round(d / 2));
  const top = new THREE.Mesh(new THREE.PlaneGeometry(w, d), sm);
  const t2 = st.clone(); t2.needsUpdate = true;
  t2.wrapS = t2.wrapT = THREE.RepeatWrapping; t2.repeat.set(nx, nz);
  top.material = new THREE.MeshLambertMaterial({ map: t2, color: col });
  top.rotation.x = -Math.PI / 2; top.position.y = h / 2 + 0.02;
  g.add(top);
  return g;
}

/* metal, rubber, warning stripes — the machine kit */
const MACH_MATS = () => ({
  steel: new THREE.MeshPhongMaterial({ color: 0x9aa3ad, shininess: 40, flatShading: true }),
  dark:  new THREE.MeshLambertMaterial({ color: 0x2b2f36 }),
  hazard:new THREE.MeshLambertMaterial({ color: 0xf2c21a }),
  red:   new THREE.MeshLambertMaterial({ color: 0xc4281c }),
  glow:  new THREE.MeshBasicMaterial({ color: 0x3fff86 })
});

/* ------------------------------------------------------------ 1 shredder */
function makeShredder() {
  const g = new THREE.Group(); const M = MACH_MATS();
  const bin = box(6.0, 5.0, 4.4, M.dark); bin.position.y = 2.5; g.add(bin);
  const head = box(6.6, 1.6, 5.0, M.steel); head.position.y = 6.0; g.add(head);
  const slot = box(4.6, 0.4, 0.7, new THREE.MeshBasicMaterial({ color: 0x07090c }));
  slot.position.y = 6.85; g.add(slot);
  const teeth = new THREE.Group(); teeth.position.y = 6.5; g.add(teeth);
  for (let i = 0; i < 9; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.30, 8), M.steel);
    t.rotation.z = Math.PI / 2; t.position.set(-2.1 + i * 0.52, 0, 0); teeth.add(t);
  }
  for (const sx of [-1, 1]) {
    const st = box(0.5, 5.0, 0.5, M.hazard); st.position.set(sx * 3.4, 2.5, 2.4); g.add(st);
  }
  const win = box(4.4, 2.4, 0.2, new THREE.MeshBasicMaterial({ color: 0x9fd8e8,
    transparent: true, opacity: 0.35 }));
  win.position.set(0, 2.4, 2.25); g.add(win);
  const lamp = sph(0.3, M.glow, 1, 1, 1, 8); lamp.position.set(2.6, 6.9, 2.0); g.add(lamp);
  g.userData = { teeth: teeth, lamp: lamp };
  return g;
}

/* --------------------------------------------------------------- 2 press */
function makePress() {
  const g = new THREE.Group(); const M = MACH_MATS();
  const bed = box(7.5, 1.2, 6.0, M.steel); bed.position.y = 0.6; g.add(bed);
  for (const sx of [-1, 1]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 11, 10), M.dark);
    col.position.set(sx * 3.2, 5.5, -2.2); g.add(col);
  }
  const top = box(8.0, 1.4, 6.4, M.dark); top.position.y = 11.2; g.add(top);
  const ram = new THREE.Group(); ram.position.y = 9.0; g.add(ram);
  const piston = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3.4, 12), M.steel);
  piston.position.y = 1.9; ram.add(piston);
  const plate = box(6.4, 1.1, 5.2, M.steel); ram.add(plate);
  const stripe = box(6.5, 0.3, 5.3, M.hazard); stripe.position.y = 0.6; ram.add(stripe);
  const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.3, 14), M.red);
  gauge.rotation.x = Math.PI / 2; gauge.position.set(4.4, 6, 2.6); g.add(gauge);
  g.userData = { ram: ram, gauge: gauge };
  return g;
}

/* -------------------------------------------------------------- 3 cannon */
function makeCannon() {
  const g = new THREE.Group(); const M = MACH_MATS();
  const carriage = box(4.4, 1.4, 6.0, new THREE.MeshLambertMaterial({ color: 0x5b3d22 }));
  carriage.position.y = 1.6; g.add(carriage);
  for (const sx of [-1, 1]) for (const sz of [-1.8, 1.8]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.6, 12), M.dark);
    w.rotation.z = Math.PI / 2; w.position.set(sx * 2.3, 1.5, sz); g.add(w);
  }
  const pivot = new THREE.Group(); pivot.position.set(0, 3.0, 0); g.add(pivot);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.45, 8.5, 14), M.dark);
  barrel.rotation.x = Math.PI / 2; barrel.position.z = 2.6; pivot.add(barrel);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.5, 14), M.hazard);
  band.rotation.x = Math.PI / 2; band.position.z = 4.6; pivot.add(band);
  const flash = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5.0, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.9,
      depthWrite: false, fog: false }));
  flash.rotation.x = -Math.PI / 2; flash.position.z = 9.4; flash.visible = false;
  pivot.add(flash);
  pivot.rotation.x = -0.55;
  g.userData = { pivot: pivot, flash: flash };
  return g;
}

/* ------------------------------------------------------------- 4 chipper */
function makeChipper() {
  const g = new THREE.Group(); const M = MACH_MATS();
  const body = box(5.0, 4.2, 5.6, M.hazard); body.position.y = 2.6; g.add(body);
  const trim = box(5.1, 0.5, 5.7, M.dark); trim.position.y = 4.4; g.add(trim);
  const hopper = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 1.2, 3.0, 4), M.steel);
  hopper.rotation.y = Math.PI / 4; hopper.position.y = 6.2; g.add(hopper);
  const chute = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 6.5, 10), M.steel);
  chute.rotation.set(0.6, 0, 0); chute.position.set(0, 6.4, -3.2); g.add(chute);
  const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.4, 10), M.dark);
  mouth.rotation.set(0.6, 0, 0); mouth.position.set(0, 8.0, -4.8); g.add(mouth);
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.6, 10), M.dark);
    w.rotation.z = Math.PI / 2; w.position.set(sx * 2.5, 1.1, -1.6); g.add(w);
  }
  const eng = box(2.2, 1.6, 2.0, M.dark); eng.position.set(0, 5.2, 2.6); g.add(eng);
  g.userData = { mouth: mouth, hopper: hopper };
  return g;
}

/* --------------------------------------------------------------- 5 anvil */
function makeAnvil() {
  const g = new THREE.Group();
  const m = new THREE.MeshPhongMaterial({ color: 0x3a3f47, shininess: 30, flatShading: true });
  const base = box(4.6, 1.2, 3.0, m); base.position.y = 0.6; g.add(base);
  const waist = box(2.6, 1.6, 2.0, m); waist.position.y = 1.9; g.add(waist);
  const top = box(6.2, 1.5, 3.0, m); top.position.y = 3.4; g.add(top);
  const horn = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.2, 10), m);
  horn.rotation.z = -Math.PI / 2; horn.position.set(4.4, 3.4, 0); g.add(horn);
  const sc = cv(128, 40);
  sc.x.fillStyle = '#2b2f36'; sc.x.fillRect(0, 0, 128, 40);
  sc.x.fillStyle = '#f2f2e8'; sc.x.font = 'bold 22px Arial'; sc.x.textAlign = 'center';
  sc.x.fillText('1 TONNE', 64, 28);
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.25),
    new THREE.MeshBasicMaterial({ map: texFrom(sc.c, 1, 1) }));
  lab.position.set(0, 3.4, 1.55); g.add(lab);
  return g;
}

/* -------------------------------------------------------------- 6 rocket */
function makeRocket() {
  const g = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xf2f2ea });
  const red = new THREE.MeshLambertMaterial({ color: 0xc4281c });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 10, 14), white);
  hull.position.y = 5; g.add(hull);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.4, 14), red);
  nose.position.y = 11.7; g.add(nose);
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.75, 0.5, 14), red);
    band.position.y = 2.0 + i * 3.0; g.add(band);
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU;
    const fin = box(0.28, 3.0, 2.4, red);
    fin.position.set(Math.sin(a) * 1.7, 1.5, Math.cos(a) * 1.7);
    fin.rotation.y = -a; g.add(fin);
  }
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.62, 14),
    new THREE.MeshBasicMaterial({ color: 0x8fd8f2 }));
  win.position.set(0, 8.4, 1.55); g.add(win);
  const plume = new THREE.Group(); plume.position.y = 0.1; g.add(plume);
  [[0xffe14d, 4.5, 1.4], [0xff8a1e, 7.0, 1.0], [0xffffff, 2.4, 0.6]].forEach(([c, h, r]) => {
    const f = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85,
        depthWrite: false, fog: false }));
    f.rotation.x = Math.PI; f.position.y = -h / 2; plume.add(f);
  });
  plume.visible = false;
  g.userData = { plume: plume };
  return g;
}

/* =========================================================================
   The obby
   ========================================================================= */
function makeObby() {
  const g = new THREE.Group();
  const platforms = [], spinners = [];

  /* --- Roblox sky --- */
  const sk = (function () {
    const W = 256, H = 128, { c, x } = cv(W, H);
    const gr = x.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#3d7fd6'); gr.addColorStop(0.46, '#7fb6ee');
    gr.addColorStop(0.52, '#cfe6fb'); gr.addColorStop(1, '#9fc4e0');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(255,255,255,.92)';
    for (const [cx, cy, s] of [[40, 26, 1], [110, 18, 0.7], [190, 30, 1.1], [150, 42, 0.6], [230, 20, 0.8]]) {
      for (const [ox, oy, r] of [[0, 0, 13], [11, 3, 9], [-11, 4, 8], [5, -6, 8]]) {
        x.beginPath(); x.arc(cx + ox * s, cy + oy * s, r * s, 0, Math.PI * 2); x.fill();
      }
    }
    return texFrom(c, 1, 1);
  })();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(300, 20, 12),
    new THREE.MeshBasicMaterial({ map: sk, side: THREE.BackSide, fog: false }));
  g.add(dome);

  /* --- baseplate far below, and a lava sea --- */
  const bp = (function () {
    const { c, x } = cv(64, 64);
    x.fillStyle = '#9a9a9d'; x.fillRect(0, 0, 64, 64);
    x.strokeStyle = 'rgba(0,0,0,.22)'; x.lineWidth = 3;
    x.strokeRect(0, 0, 64, 64);
    x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(4, 4, 56, 56);
    return texFrom(c, 60, 60);
  })();
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(700, 700),
    new THREE.MeshLambertMaterial({ map: bp }));
  plate.rotation.x = -Math.PI / 2; plate.position.y = -34; g.add(plate);

  const lavaTex = (function () {
    const { c, x } = cv(64, 64);
    x.fillStyle = '#e8451c'; x.fillRect(0, 0, 64, 64);
    for (let k = 0; k < 500; k++) {
      x.fillStyle = Math.random() < .5 ? '#ffb02e' : '#a81208';
      x.fillRect(Math.random() * 64, Math.random() * 64, 5, 4);
    }
    return texFrom(c, 12, 12);
  })();
  const lava = new THREE.Mesh(new THREE.PlaneGeometry(200, 120),
    new THREE.MeshBasicMaterial({ map: lavaTex }));
  lava.rotation.x = -Math.PI / 2; lava.position.set(0, -9, 0); g.add(lava);

  /* --- the course: bright studded parts climbing away from the camera --- */
  const cols = [ROBLOX.red, ROBLOX.yellow, ROBLOX.blue, ROBLOX.green,
                ROBLOX.orange, ROBLOX.purple, ROBLOX.cyan, ROBLOX.white];
  const path = [];
  for (let i = 0; i < 11; i++) {
    const x0 = -26 + i * 5.2;
    const z0 = Math.sin(i * 0.9) * 4.5;
    const y0 = i * 0.85;
    const wdt = i === 10 ? 8 : (i % 3 === 2 ? 3.0 : 4.4);
    const part = makePart(wdt, 1.2, 4.2, cols[i % cols.length]);
    part.position.set(x0, y0, z0);
    g.add(part); platforms.push(part);
    path.push({ x: x0, y: y0 + 0.6, z: z0 });
  }
  /* two spinning kill bricks over the middle of the course */
  for (const [px, pz] of [[-9, 1.2], [6, -1.6]]) {
    const arm = new THREE.Group();
    const bar = box(11, 0.9, 0.9, new THREE.MeshLambertMaterial({ color: 0xff2020 }));
    arm.add(bar);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.4, 8),
      new THREE.MeshLambertMaterial({ color: 0x3a3f47 }));
    arm.add(hub);
    arm.position.set(px, 4.6 + pz * 0.1, pz);
    g.add(arm); spinners.push(arm);
  }
  /* a checkpoint flag halfway */
  const cp = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 5, 6),
    new THREE.MeshLambertMaterial({ color: 0xbfc4c9 }));
  pole.position.y = 2.5; cp.add(pole);
  const flag = box(2.6, 1.6, 0.12, new THREE.MeshLambertMaterial({ color: 0x2fd44b }));
  flag.position.set(1.3, 4.2, 0); cp.add(flag);
  cp.position.set(path[5].x, path[5].y + 0.6, path[5].z + 1.6);
  g.add(cp);

  /* a sign at the start, because every obby has one */
  const sc = cv(256, 64);
  sc.x.fillStyle = '#1b1b1f'; sc.x.fillRect(0, 0, 256, 64);
  sc.x.fillStyle = '#f5cd30'; sc.x.font = 'bold 26px Arial'; sc.x.textAlign = 'center';
  sc.x.fillText('BALDI OBBY [EASY]', 128, 27);
  sc.x.fillStyle = '#f8f8f8'; sc.x.font = 'bold 17px Arial';
  sc.x.fillText('no anime allowed', 128, 50);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25),
    new THREE.MeshBasicMaterial({ map: texFrom(sc.c, 1, 1), side: THREE.DoubleSide }));
  sign.position.set(path[0].x - 1, path[0].y + 5.4, path[0].z - 2.4);
  g.add(sign);
  const spost = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5, 6),
    new THREE.MeshLambertMaterial({ color: 0x6b4a26 }));
  spost.position.set(path[0].x - 1, path[0].y + 2.6, path[0].z - 2.4); g.add(spost);

  /* the doomed stack of books, waiting on the last platform */
  const stack = new THREE.Group();
  stack.position.set(path[10].x + 1.6, path[10].y + 0.6, path[10].z);
  for (let k = 0; k < 9; k++) {
    const bk = makeMangaBook(k % 5);
    bk.scale.setScalar(1.7);
    bk.position.y = k * 0.58;
    bk.rotation.y = k * 0.5;
    stack.add(bk);
  }
  g.add(stack);

  g.visible = false;
  g.userData = { platforms: platforms, spinners: spinners, lava: lava, path: path,
                 stack: stack, dome: dome, sign: sign };
  return g;
}

/* -------------------------------------------------- shredded-paper debris */
function makeDebris(n, size) {
  const geo = new THREE.BoxGeometry(size, size * 0.12, size * 0.55);
  const im = new THREE.InstancedMesh(geo,
    new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
  const state = [];
  for (let k = 0; k < n; k++) {
    state.push({ x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, rz: 0, life: 0 });
    im.setColorAt(k, new THREE.Color().setHSL(rand(0.86, 1.02) % 1, 0.55, rand(0.72, 0.95)));
  }
  im.instanceMatrix.needsUpdate = true;
  im.frustumCulled = false;
  im.userData = { state: state, cur: 0, D: new THREE.Object3D() };
  return im;
}
function burstDebris(im, x, y, z, n, spread, up) {
  const S = im.userData.state;
  for (let k = 0; k < n; k++) {
    const p = S[im.userData.cur % S.length]; im.userData.cur++;
    p.x = x + rand(-0.6, 0.6); p.y = y; p.z = z + rand(-0.6, 0.6);
    p.vx = rand(-spread, spread); p.vz = rand(-spread, spread);
    p.vy = rand(up * 0.4, up);
    p.rx = rand(-8, 8); p.rz = rand(-8, 8);
    p.life = rand(1.6, 3.2);
  }
}
function updateDebris(im, dt) {
  const S = im.userData.state, D = im.userData.D;
  let any = false;
  for (let k = 0; k < S.length; k++) {
    const p = S[k];
    if (p.life <= 0) { D.position.set(0, -999, 0); D.scale.setScalar(0.001); D.updateMatrix();
      im.setMatrixAt(k, D.matrix); continue; }
    any = true;
    p.life -= dt;
    p.vy -= 16 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < 0.1) { p.y = 0.1; p.vy *= -0.28; p.vx *= 0.7; p.vz *= 0.7; }
    D.position.set(p.x, p.y, p.z);
    D.rotation.set(p.rx * p.life, 0, p.rz * p.life);
    D.scale.setScalar(clamp(p.life, 0, 1));
    D.updateMatrix(); im.setMatrixAt(k, D.matrix);
  }
  im.instanceMatrix.needsUpdate = true;
  return any;
}


/* =========================================================================
   Part 5g — METHODS EIGHT THROUGH THIRTEEN
   A rifle, a bombsite, a skeleton, a jumpscare, a rattan cane and a
   World Cup final. Each set is built once, parked off in its own corner of
   the world, and switched on for its moment.
   ========================================================================= */

/* Every act gets its own patch of ground so nothing overlaps. */
const ACT_AT = {
  sniper: { x: 0,   z: 260 },
  csgo:   { x: 260, z: 0   },
  sans:   { x: 0,   z: -260 },
  huggy:  { x: -260, z: 0  },
  cane:   { x: 180, z: 180 },
  cup:    { x: -200, z: -200 }
};

/* ------------------------------------------------------- 8 · the sniper */
function makeSniperSet() {
  const g = new THREE.Group();
  const A = ACT_AT.sniper;
  g.position.set(A.x, 0, A.z);

  /* night sky and a hill to lie on */
  const sk = (function () {
    const W = 256, H = 128, { c, x } = cv(W, H);
    const gr = x.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#050912'); gr.addColorStop(0.5, '#122340'); gr.addColorStop(1, '#2b3b52');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 300; i++) {
      x.fillStyle = 'rgba(255,255,255,' + (0.3 + Math.random() * 0.6).toFixed(2) + ')';
      x.fillRect(Math.random() * W, Math.random() * H * 0.55, 1.6, 1.6);
    }
    return texFrom(c, 1, 1);
  })();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 18, 12),
    new THREE.MeshBasicMaterial({ map: sk, side: THREE.BackSide, fog: false }));
  g.add(dome);
  const grd = new THREE.Mesh(new THREE.PlaneGeometry(700, 700),
    new THREE.MeshLambertMaterial({ color: 0x1e3320 }));
  grd.rotation.x = -Math.PI / 2; g.add(grd);

  /* the rifle, resting on a bipod */
  const rifle = new THREE.Group();
  rifle.position.set(0, 1.6, 4);
  const black = new THREE.MeshPhongMaterial({ color: 0x22262c, shininess: 30, flatShading: true });
  const wood = new THREE.MeshLambertMaterial({ color: 0x4a3220 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 9, 10), black);
  barrel.rotation.x = Math.PI / 2; barrel.position.z = -3.2; rifle.add(barrel);
  const body = box(0.7, 0.9, 4.2, wood); body.position.z = 1.2; rifle.add(body);
  const stock = box(0.6, 1.5, 2.2, wood); stock.position.set(0, -0.2, 3.4); rifle.add(stock);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 3.2, 12), black);
  scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.85, 0.6); rifle.add(scope);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12),
    new THREE.MeshBasicMaterial({ color: 0x6fd0ff }));
  lens.position.set(0, 0.85, -1.0); rifle.add(lens);
  const mag = box(0.5, 1.0, 0.8, black); mag.position.set(0, -0.8, 0.9); rifle.add(mag);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 6), black);
    leg.position.set(sx * 0.5, -1.1, -6.2); leg.rotation.z = sx * 0.45; rifle.add(leg);
  }
  const flash = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.2, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff0a8, transparent: true, opacity: 0.95,
      depthWrite: false, fog: false }));
  flash.rotation.x = -Math.PI / 2; flash.position.z = -9.2; flash.visible = false;
  rifle.add(flash);
  g.add(rifle);

  /* the target, a very long way off */
  const target = new THREE.Group();
  target.position.set(0, 0, -150);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 9, 8), wood);
  post.position.y = 4.5; target.add(post);
  const bk = makeMangaBook(1); bk.scale.setScalar(5.5); bk.position.y = 9.2;
  bk.rotation.x = -Math.PI / 2; bk.rotation.z = 0.2; target.add(bk);
  g.add(target);
  /* a few silhouetted trees for depth */
  for (let k = 0; k < 26; k++) {
    const a = rand(-1.3, 1.3), d = rand(45, 200);
    const tr = new THREE.Mesh(new THREE.ConeGeometry(rand(3, 6), rand(14, 26), 5),
      new THREE.MeshLambertMaterial({ color: 0x0f1c12 }));
    tr.position.set(Math.sin(a) * d + rand(-30, 30), 9, -d);
    g.add(tr);
  }
  g.visible = false;
  g.userData = { rifle: rifle, flash: flash, target: target, book: bk };
  return g;
}

/* ------------------------------------------------- 9 · the bombsite */
function makeCSGOSet() {
  const g = new THREE.Group();
  const A = ACT_AT.csgo;
  g.position.set(A.x, 0, A.z);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 16, 10),
    new THREE.MeshBasicMaterial({ color: 0x9fc0d8, side: THREE.BackSide, fog: false }));
  g.add(sky);
  const sandTex = (function () {
    const { c, x } = cv(64, 64);
    x.fillStyle = '#c9ab74'; x.fillRect(0, 0, 64, 64);
    for (let k = 0; k < 700; k++) {
      x.fillStyle = Math.random() < .5 ? '#d6ba85' : '#b89964';
      x.fillRect(Math.random() * 64, Math.random() * 64, 3, 3);
    }
    return texFrom(c, 30, 30);
  })();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400),
    new THREE.MeshLambertMaterial({ map: sandTex }));
  ground.rotation.x = -Math.PI / 2; g.add(ground);

  /* the walls of a very familiar dusty courtyard */
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xb99a68 });
  for (const [wx, wz, ww, wd] of [[-22, 0, 3, 46], [22, 0, 3, 46], [0, -24, 46, 3]]) {
    const w = box(ww, 14, wd, wallMat); w.position.set(wx, 7, wz); g.add(w);
  }
  const arch = box(9, 3, 4, wallMat); arch.position.set(0, 12.5, -24); g.add(arch);

  /* crates */
  const crateTex = (function () {
    const { c, x } = cv(64, 64);
    x.fillStyle = '#a3763c'; x.fillRect(0, 0, 64, 64);
    x.strokeStyle = '#6d4c22'; x.lineWidth = 4; x.strokeRect(2, 2, 60, 60);
    x.beginPath(); x.moveTo(2, 2); x.lineTo(62, 62); x.moveTo(62, 2); x.lineTo(2, 62); x.stroke();
    return texFrom(c, 1, 1);
  })();
  const crateMat = new THREE.MeshLambertMaterial({ map: crateTex });
  for (const [cx, cy, cz] of [[-9, 2, -8], [-9, 6, -8], [-5, 2, -11], [10, 2, -6],
                              [10, 6, -6], [14, 2, -10], [-14, 2, 4], [13, 2, 8]]) {
    const cr = box(4, 4, 4, crateMat); cr.position.set(cx, cy, cz); g.add(cr);
  }
  /* the site marker */
  const sc = cv(128, 128);
  sc.x.fillStyle = 'rgba(0,0,0,0)'; sc.x.clearRect(0, 0, 128, 128);
  sc.x.strokeStyle = '#e8e2d0'; sc.x.lineWidth = 9;
  sc.x.beginPath(); sc.x.moveTo(24, 108); sc.x.lineTo(64, 22); sc.x.lineTo(104, 108); sc.x.stroke();
  sc.x.beginPath(); sc.x.moveTo(40, 74); sc.x.lineTo(88, 74); sc.x.stroke();
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(9, 9),
    new THREE.MeshBasicMaterial({ map: texFrom(sc.c, 1, 1), transparent: true }));
  mark.rotation.x = -Math.PI / 2; mark.position.set(0, 0.06, 2); g.add(mark);

  /* the pile of books, and the thing that is going under it */
  const pile = new THREE.Group();
  pile.position.set(0, 0, 2);
  for (let k = 0; k < 10; k++) {
    const bk = makeMangaBook(k % 5);
    bk.scale.setScalar(1.9);
    bk.position.set(rand(-0.7, 0.7), k * 0.62, rand(-0.7, 0.7));
    bk.rotation.y = k * 0.6; pile.add(bk);
  }
  g.add(pile);

  const c4 = new THREE.Group();
  c4.position.set(0, 0.4, 2);
  const brick = box(2.0, 0.8, 1.4, new THREE.MeshLambertMaterial({ color: 0x3f4b33 }));
  brick.position.y = 0.4; c4.add(brick);
  const panel = box(1.0, 0.1, 0.6, new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
  panel.position.set(0, 0.82, 0); c4.add(panel);
  const led = box(0.7, 0.06, 0.34, new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  led.position.set(0, 0.88, 0); c4.add(led);
  const wires = new THREE.Group();
  for (const [wc, wo] of [[0xff2020, -0.4], [0x20a0ff, 0], [0xffe14d, 0.4]]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 5, 12, Math.PI), 
      new THREE.MeshLambertMaterial({ color: wc }));
    w.rotation.y = Math.PI / 2; w.position.set(wo, 0.8, 0.6); wires.add(w);
  }
  c4.add(wires);
  c4.visible = false;
  g.add(c4);
  g.userData = { pile: pile, c4: c4, led: led };
  g.visible = false;
  return g;
}

/* ------------------------------------------------------- 10 · the skeleton */
function makeSansSet() {
  const g = new THREE.Group();
  const A = ACT_AT.sans;
  g.position.set(A.x, 0, A.z);

  /* pure void */
  const void_ = new THREE.Mesh(new THREE.SphereGeometry(320, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.BackSide, fog: false }));
  g.add(void_);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200),
    new THREE.MeshBasicMaterial({ color: 0x08080a }));
  floor.rotation.x = -Math.PI / 2; g.add(floor);

  /* the little skeleton in the blue hoodie */
  const sans = new THREE.Group();
  sans.position.set(0, 0, -13);
  const boneW = new THREE.MeshLambertMaterial({ color: 0xf2f0e6 });
  const hoodie = new THREE.MeshLambertMaterial({ color: 0x2f4faa });
  const shorts = new THREE.MeshLambertMaterial({ color: 0x2b2b33 });
  const legs = box(1.9, 2.0, 1.0, shorts); legs.position.y = 1.0; sans.add(legs);
  for (const sx of [-1, 1]) {
    const sl = box(0.6, 1.2, 0.6, boneW); sl.position.set(sx * 0.5, 0.4, 0); sans.add(sl);
    const sh = box(1.0, 0.4, 1.4, new THREE.MeshLambertMaterial({ color: 0xe8c0a0 }));
    sh.position.set(sx * 0.5, 0.1, 0.2); sans.add(sh);
  }
  const jacket = capsuleBox(2.6, 2.6, 1.5, hoodie); jacket.position.y = 3.3; sans.add(jacket);
  const hood = sph(1.3, hoodie, 1.15, 0.7, 1.0, 12); hood.position.set(0, 4.6, -0.5); sans.add(hood);
  const skull = sph(1.25, boneW, 1.05, 1.0, 0.95, 14); skull.position.y = 5.3; sans.add(skull);
  const jaw = box(1.5, 0.7, 1.4, boneW); jaw.position.set(0, 4.55, 0.1); sans.add(jaw);
  const grin = box(1.6, 0.14, 0.1, new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
  grin.position.set(0, 4.92, 1.0); sans.add(grin);
  const socketL = sph(0.34, new THREE.MeshBasicMaterial({ color: 0x0b0b0b }), 1, 1.15, 0.6, 10);
  socketL.position.set(-0.45, 5.5, 1.0); sans.add(socketL);
  const socketR = socketL.clone(); socketR.position.x = 0.45; sans.add(socketR);
  const eyeGlow = sph(0.3, new THREE.MeshBasicMaterial({ color: 0x39d9ff, fog: false }), 1, 1.2, 0.7, 10);
  eyeGlow.position.set(-0.45, 5.52, 1.06); sans.add(eyeGlow);
  const dot = sph(0.13, new THREE.MeshBasicMaterial({ color: 0xffffff }), 1, 1, 0.6, 8);
  dot.position.set(0.45, 5.5, 1.08); sans.add(dot);
  for (const sx of [-1, 1]) {
    const arm = capsuleBox(0.8, 2.2, 0.8, hoodie);
    arm.position.set(sx * 1.7, 3.2, 0.2); sans.add(arm);
  }
  g.add(sans);

  /* the battle box */
  const boxG = new THREE.Group();
  boxG.position.set(0, 5, 4);
  const W = 13, H = 9, TH = 0.30;
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2, fog: false });
  for (const [w, h, px, py] of [[W, TH, 0, H / 2], [W, TH, 0, -H / 2],
                                [TH, H, -W / 2, 0], [TH, H, W / 2, 0]]) {
    const bar = box(w, h, TH, lineMat); bar.position.set(px, py, 0); boxG.add(bar);
  }
  /* no backing plate — the void behind is already black, and a plate
     would hide the skeleton standing beyond it */
  g.add(boxG);

  /* the thing being fought, floating in the box */
  const soul = makeMangaBook(2);
  soul.scale.setScalar(2.0);
  soul.position.set(0, 5, 4.4);
  g.add(soul);

  /* bones — one instanced mesh, moved about by the act */
  const boneGeo = new THREE.BoxGeometry(0.8, 1, 0.8);
  boneGeo.translate(0, 0.5, 0);
  const bones = new THREE.InstancedMesh(boneGeo, new THREE.MeshBasicMaterial({ color: 0xf2f0e6, fog: false }), 40);
  bones.frustumCulled = false;
  g.add(bones);

  /* two blaster skulls */
  const blasters = [];
  for (let k = 0; k < 2; k++) {
    const bl = new THREE.Group();
    const head = box(2.6, 2.2, 3.2, boneW); bl.add(head);
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.9, 2.4, 4), boneW);
    snout.rotation.x = Math.PI / 2; snout.rotation.z = Math.PI / 4;
    snout.position.z = 2.4; bl.add(snout);
    for (const sx of [-1, 1]) {
      const so = box(0.8, 0.9, 0.3, new THREE.MeshBasicMaterial({ color: 0x0b0b0b }));
      so.position.set(sx * 0.7, 0.4, 1.65); bl.add(so);
    }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 60, 10),
      new THREE.MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.85,
        depthWrite: false, fog: false }));
    beam.rotation.x = Math.PI / 2; beam.position.z = 32; beam.visible = false;
    bl.add(beam);
    bl.visible = false;
    g.add(bl);
    blasters.push({ g: bl, beam: beam });
  }
  g.visible = false;
  g.userData = { sans: sans, boxG: boxG, soul: soul, bones: bones, blasters: blasters,
                 eyeGlow: eyeGlow, D: new THREE.Object3D() };
  return g;
}

/* ------------------------------------------------------- 11 · the jumpscare */
function makeHuggySet() {
  const g = new THREE.Group();
  const A = ACT_AT.huggy;
  g.position.set(A.x, 0, A.z);

  /* a grim little factory room */
  const wallTex = (function () {
    const { c, x } = cv(64, 64);
    x.fillStyle = '#2a2622'; x.fillRect(0, 0, 64, 64);
    for (let k = 0; k < 220; k++) {
      x.fillStyle = Math.random() < .5 ? '#332e28' : '#231f1c';
      x.fillRect(Math.random() * 64, Math.random() * 64, 5, 4);
    }
    x.strokeStyle = '#1a1714'; x.lineWidth = 2;
    for (let k = 0; k <= 64; k += 16) { x.beginPath(); x.moveTo(0, k); x.lineTo(64, k); x.stroke(); }
    return texFrom(c, 6, 3);
  })();
  const wm = new THREE.MeshLambertMaterial({ map: wallTex });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), wm);
  fl.rotation.x = -Math.PI / 2; g.add(fl);
  for (let w = 0; w < 4; w++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(44, 18), wm);
    m.position.set(Math.sin(w * Math.PI / 2) * 22, 9, Math.cos(w * Math.PI / 2) * 22);
    m.rotation.y = w * Math.PI / 2 + Math.PI; g.add(m);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(44, 44),
    new THREE.MeshLambertMaterial({ color: 0x14110f }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 18; g.add(ceil);

  /* a telly, a beanbag and a very relaxed anime girl */
  const tv = new THREE.Group();
  tv.position.set(0, 0, -9);
  const cab = box(9, 6.2, 1.6, new THREE.MeshLambertMaterial({ color: 0x1b1b1f }));
  cab.position.y = 5.4; tv.add(cab);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 4.8),
    new THREE.MeshBasicMaterial({ color: 0x2f5fa8 }));
  scr.position.set(0, 5.4, 0.85); tv.add(scr);
  const stand = box(2, 2.4, 1.6, new THREE.MeshLambertMaterial({ color: 0x2a2a30 }));
  stand.position.y = 1.2; tv.add(stand);
  g.add(tv);

  const bean = sph(2.6, new THREE.MeshLambertMaterial({ color: 0x8a3f6b }), 1.2, 0.7, 1.1, 12);
  bean.position.set(0, 1.5, 3); g.add(bean);

  /* she is a standee — the cover art, on legs */
  const girl = new THREE.Group();
  girl.position.set(0, 0, 3);
  const gtex = moeCoverTexture(0);
  const gm = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 7.2),
    new THREE.MeshLambertMaterial({ map: gtex, side: THREE.DoubleSide }));
  gm.position.y = 5.6; girl.add(gm);
  const gbase = box(3.4, 0.4, 1.6, new THREE.MeshLambertMaterial({ color: 0xc9c4b8 }));
  gbase.position.y = 0.2; girl.add(gbase);
  const pad = box(1.6, 0.35, 1.0, new THREE.MeshLambertMaterial({ color: 0x2b2b33 }));
  pad.position.set(0, 3.0, 1.0); girl.add(pad);
  g.add(girl);

  /* the tall blue thing */
  const hug = new THREE.Group();
  hug.position.set(0, 0, -30);
  const fur = new THREE.MeshLambertMaterial({ color: 0x2f6fd0 });
  const belly = new THREE.MeshLambertMaterial({ color: 0x7fb6f0 });
  const torso = capsuleBox(5.0, 9.0, 3.6, fur); torso.position.y = 10; hug.add(torso);
  const tummy = sph(2.0, belly, 1.1, 1.5, 0.5, 12); tummy.position.set(0, 9, 1.9); hug.add(tummy);
  const head = sph(3.4, fur, 1.15, 1.0, 1.0, 14); head.position.y = 16.5; hug.add(head);
  const muzzle = sph(2.4, fur, 1.15, 0.75, 0.9, 12); muzzle.position.set(0, 15.4, 2.0); hug.add(muzzle);
  const maw = sph(1.9, new THREE.MeshLambertMaterial({ color: 0x8a1030 }), 1.15, 0.9, 0.7, 14);
  maw.position.set(0, 15.2, 3.1); hug.add(maw);
  for (let k = 0; k < 9; k++) {
    const up = box(0.42, 0.75, 0.3, new THREE.MeshLambertMaterial({ color: 0xf6f2e6 }));
    up.position.set(-1.6 + k * 0.4, 15.9, 3.7); up.rotation.z = rand(-0.2, 0.2); hug.add(up);
    const lo = box(0.42, 0.75, 0.3, new THREE.MeshLambertMaterial({ color: 0xf6f2e6 }));
    lo.position.set(-1.6 + k * 0.4, 14.5, 3.7); lo.rotation.z = rand(-0.2, 0.2); hug.add(lo);
  }
  for (const sx of [-1, 1]) {
    const eye = sph(0.95, new THREE.MeshBasicMaterial({ color: 0xf6f2e6 }), 1, 1, 0.6, 12);
    eye.position.set(sx * 1.5, 17.6, 2.6); hug.add(eye);
    const pup = sph(0.42, new THREE.MeshBasicMaterial({ color: 0x101014 }), 1, 1, 0.6, 10);
    pup.position.set(sx * 1.5, 17.6, 3.15); hug.add(pup);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.62, 13, 8), fur);
    arm.position.set(sx * 3.4, 10.5, 0); arm.rotation.z = sx * 0.22; hug.add(arm);
    const hand = sph(1.5, fur, 1.1, 1.0, 0.9, 10);
    hand.position.set(sx * 4.6, 4.2, 0.6); hug.add(hand);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.8, 6, 8), fur);
    leg.position.set(sx * 1.4, 3, 0); hug.add(leg);
    const foot = box(2.2, 1.0, 3.4, fur); foot.position.set(sx * 1.4, 0.5, 0.8); hug.add(foot);
  }
  hug.visible = false;
  g.add(hug);

  g.visible = false;
  g.userData = { tv: tv, screen: scr, girl: girl, hug: hug, head: head, maw: maw, gm: gm };
  return g;
}

/* ------------------------------------------------------------ 12 · the cane */
function makeCaneSet() {
  const g = new THREE.Group();
  const A = ACT_AT.cane;
  g.position.set(A.x, 0, A.z);

  const room = new THREE.MeshLambertMaterial({ color: 0x8d8878 });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(40, 40),
    new THREE.MeshLambertMaterial({ color: 0x5f5a50 }));
  fl.rotation.x = -Math.PI / 2; g.add(fl);
  for (let w = 0; w < 4; w++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), room);
    m.position.set(Math.sin(w * Math.PI / 2) * 20, 8, Math.cos(w * Math.PI / 2) * 20);
    m.rotation.y = w * Math.PI / 2 + Math.PI; g.add(m);
  }

  /* the trestle */
  const wood = new THREE.MeshLambertMaterial({ color: 0x6b4a26 });
  const rack = new THREE.Group();
  for (const sx of [-1, 1]) {
    const legA = box(0.5, 7, 0.5, wood); legA.position.set(sx * 2.4, 3.5, -1.4);
    legA.rotation.x = -0.28; rack.add(legA);
    const legB = box(0.5, 7, 0.5, wood); legB.position.set(sx * 2.4, 3.5, 1.4);
    legB.rotation.x = 0.28; rack.add(legB);
  }
  const topBar = box(6.2, 0.6, 2.6, wood); topBar.position.y = 6.6; rack.add(topBar);
  for (const sz of [-0.9, 0.9]) {
    const strap = box(6.4, 0.4, 0.35, new THREE.MeshLambertMaterial({ color: 0x2a2018 }));
    strap.position.set(0, 7.1, sz); rack.add(strap);
  }
  g.add(rack);

  /* the accused */
  const bk = makeMangaBook(4);
  bk.scale.setScalar(3.4);
  bk.position.set(0, 6.95, 0);
  bk.rotation.x = -Math.PI / 2;
  g.add(bk);

  /* the rattan */
  const cane = new THREE.Group();
  cane.position.set(4.4, 8.5, 0);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 7.5, 7),
    new THREE.MeshLambertMaterial({ color: 0xc79a52 }));
  rod.position.x = -3.4; rod.rotation.z = Math.PI / 2; cane.add(rod);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 1.4, 8),
    new THREE.MeshLambertMaterial({ color: 0x3a2a18 }));
  grip.rotation.z = Math.PI / 2; cane.add(grip);
  g.add(cane);

  /* a wall clock and a stern little sign */
  const sc = cv(160, 56);
  sc.x.fillStyle = '#f2ede0'; sc.x.fillRect(0, 0, 160, 56);
  sc.x.strokeStyle = '#8a1616'; sc.x.lineWidth = 5; sc.x.strokeRect(4, 4, 152, 48);
  sc.x.fillStyle = '#8a1616'; sc.x.font = 'bold 19px Arial'; sc.x.textAlign = 'center';
  sc.x.fillText('NO ANIME', 80, 25);
  sc.x.font = 'bold 13px Arial';
  sc.x.fillText('BY ORDER OF THE HEADMASTER', 80, 44);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.45),
    new THREE.MeshBasicMaterial({ map: texFrom(sc.c, 1, 1) }));
  sign.position.set(0, 11, -19.6); g.add(sign);

  g.visible = false;
  g.userData = { cane: cane, book: bk, rack: rack };
  return g;
}

/* ---------------------------------------------------- 13 · the World Cup */
function makeCupSet() {
  const g = new THREE.Group();
  const A = ACT_AT.cup;
  g.position.set(A.x, 0, A.z);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 18, 12),
    new THREE.MeshBasicMaterial({ color: 0x2f4a86, side: THREE.BackSide, fog: false }));
  g.add(sky);

  /* pitch, with stripes and markings baked in */
  const pitchTex = (function () {
    const W = 256, H = 160, { c, x } = cv(W, H);
    for (let i = 0; i < 10; i++) {
      x.fillStyle = i % 2 ? '#2f7a30' : '#356f2c';
      x.fillRect(i * W / 10, 0, W / 10, H);
    }
    x.strokeStyle = '#f2f2ea'; x.lineWidth = 3;
    x.strokeRect(8, 8, W - 16, H - 16);
    x.beginPath(); x.moveTo(W / 2, 8); x.lineTo(W / 2, H - 8); x.stroke();
    x.beginPath(); x.arc(W / 2, H / 2, 26, 0, Math.PI * 2); x.stroke();
    x.strokeRect(8, H / 2 - 40, 34, 80);
    x.strokeRect(W - 42, H / 2 - 40, 34, 80);
    return texFrom(c, 1, 1);
  })();
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(160, 100),
    new THREE.MeshLambertMaterial({ map: pitchTex }));
  pitch.rotation.x = -Math.PI / 2; g.add(pitch);

  /* stands, packed with instanced spectators */
  const standMat = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
  for (const [sx, sz, sw, sd, ry] of [[0, 62, 190, 26, 0], [0, -62, 190, 26, 0],
                                      [92, 0, 26, 130, 0], [-92, 0, 26, 130, 0]]) {
    const st = box(sw, 22, sd, standMat);
    st.position.set(sx, 11, sz); st.rotation.y = ry; g.add(st);
  }
  const dotGeo = new THREE.BoxGeometry(1.1, 1.1, 0.6);
  const crowd = new THREE.InstancedMesh(dotGeo,
    new THREE.MeshLambertMaterial({ color: 0xffffff }), 2400);
  const D = new THREE.Object3D();
  let ci = 0;
  const rows = 11;
  for (const side of [0, 1, 2, 3]) {
    for (let r = 0; r < rows; r++) for (let k = 0; k < 55; k++) {
      if (ci >= 2400) break;
      const u = (k / 55 - 0.5);
      let px, pz, ryy;
      if (side === 0) { px = u * 180; pz = 50 + r * 1.9; ryy = Math.PI; }
      else if (side === 1) { px = u * 180; pz = -50 - r * 1.9; ryy = 0; }
      else if (side === 2) { px = 80 + r * 1.9; pz = u * 124; ryy = -Math.PI / 2; }
      else { px = -80 - r * 1.9; pz = u * 124; ryy = Math.PI / 2; }
      D.position.set(px, 4 + r * 1.55, pz);
      D.rotation.set(0, ryy, 0); D.scale.setScalar(1);
      D.updateMatrix(); crowd.setMatrixAt(ci, D.matrix);
      crowd.setColorAt(ci, new THREE.Color().setHSL(Math.random(), 0.6, rand(0.35, 0.8)));
      ci++;
    }
  }
  crowd.count = ci;
  crowd.instanceMatrix.needsUpdate = true;
  crowd.frustumCulled = false;
  g.add(crowd);

  /* floodlights */
  for (const [px, pz] of [[86, 56], [-86, 56], [86, -56], [-86, -56]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 46, 6), standMat);
    pole.position.set(px, 23, pz); g.add(pole);
    const rig = box(12, 4, 2, new THREE.MeshBasicMaterial({ color: 0xfff6d0 }));
    rig.position.set(px, 46, pz); rig.lookAt(0, 0, 0); g.add(rig);
  }

  /* goals */
  const postMat = new THREE.MeshLambertMaterial({ color: 0xf2f2ea });
  const goals = [];
  for (const gx of [-72, 72]) {
    const go = new THREE.Group(); go.position.set(gx, 0, 0);
    const bar = box(0.7, 0.7, 22, postMat); bar.position.y = 8; go.add(bar);
    for (const gz of [-11, 11]) {
      const pst = box(0.7, 8, 0.7, postMat); pst.position.set(0, 4, gz); go.add(pst);
    }
    const net = new THREE.Mesh(new THREE.PlaneGeometry(22, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.20,
        side: THREE.DoubleSide }));
    net.rotation.y = Math.PI / 2; net.position.set(gx > 0 ? 4 : -4, 4, 0); go.add(net);
    g.add(go); goals.push(go);
  }

  /* a thousand of them, as billboards */
  const armyTex = moeCoverTexture(2);
  const armyGeo = new THREE.PlaneGeometry(2.4, 3.4);
  armyGeo.translate(0, 1.7, 0);
  const army = new THREE.InstancedMesh(armyGeo,
    new THREE.MeshLambertMaterial({ map: armyTex, side: THREE.DoubleSide }), 1000);
  const astate = [];
  for (let k = 0; k < 1000; k++) {
    const ring = Math.floor(k / 40);
    const a = (k % 40) / 40 * TAU;
    const rr = 12 + ring * 2.1;
    astate.push({ x: Math.sin(a) * rr - 10, z: Math.cos(a) * rr, a: a, r: rr,
                  ph: rand(0, 6), down: 0, vx: 0, vz: 0, vy: 0, y: 0, spin: 0 });
  }
  army.frustumCulled = false;
  g.add(army);

  /* the ball */
  const ballTex = (function () {
    const { c, x } = cv(64, 64);
    x.fillStyle = '#f4f4ee'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#1a1a1a';
    for (const [bx, by] of [[16, 16], [48, 16], [32, 40], [8, 48], [56, 48]]) {
      x.beginPath();
      for (let i = 0; i < 5; i++) {
        const aa = i / 5 * TAU - 0.6;
        const px = bx + Math.cos(aa) * 10, py = by + Math.sin(aa) * 10;
        i ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.closePath(); x.fill();
    }
    return texFrom(c, 2, 1);
  })();
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1),
    new THREE.MeshLambertMaterial({ map: ballTex }));
  ball.position.set(-10, 1.2, 0); g.add(ball);

  /* the trophy, for later */
  const gold = new THREE.MeshPhongMaterial({ color: 0xe8c24a, shininess: 90, flatShading: true });
  const trophy = new THREE.Group();
  const cupBase = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 0.8, 12), 
    new THREE.MeshLambertMaterial({ color: 0x3a2a18 }));
  cupBase.position.y = 0.4; trophy.add(cupBase);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 2.6, 10), gold);
  stem.position.y = 2.0; trophy.add(stem);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 0.9, 2.2, 12), gold);
  bowl.position.y = 4.3; trophy.add(bowl);
  const globe = sph(1.1, gold, 1, 1, 1, 12); globe.position.y = 5.6; trophy.add(globe);
  trophy.visible = false;
  g.add(trophy);

  g.visible = false;
  g.userData = { army: army, astate: astate, ball: ball, trophy: trophy,
                 crowd: crowd, D: new THREE.Object3D(), goals: goals };
  return g;
}


/* =========================================================================
   Part 5h — THE ANIME GIRL
   The character off the book covers, built properly: a low-poly body in a
   school uniform with a hand-drawn face. The eyes are the whole point of
   her, so they are painted rather than modelled — a pale ice-blue iris with
   a navy rim, one big highlight up in the corner and a heavy lash line.
   ========================================================================= */

/* ---------------------------------------------------------------- the face
   `mood` picks the expression. Everything is drawn into one 256×256 canvas
   which is then mapped onto the flat front of her head. */
function drawAnimeFace(cvs, mood, blink, V) {
  V = V || {};
  const x = cvs.getContext('2d'), S = 256;
  x.clearRect(0, 0, S, S);

  const SKIN  = V.skin  || '#fdeae0';
  const LASH  = V.lash  || '#232a45';
  const BROW  = V.brow  || '#4a3330';
  /* four stops down the iris: rim, upper, lower, floor */
  const IRIS  = V.iris  || ['#1e3160', '#2b5f95', '#63b6dd', '#a9e6f6', '#d8f6ff'];
  const GLINT = V.glint || 'rgba(190,245,255,.95)';

  /* --- skin --- */
  x.fillStyle = SKIN; x.fillRect(0, 0, S, S);
  const sh = x.createLinearGradient(0, 30, 0, 110);
  sh.addColorStop(0, 'rgba(150,110,120,.30)');
  sh.addColorStop(1, 'rgba(150,110,120,0)');
  x.fillStyle = sh; x.fillRect(0, 30, S, 80);

  const EYES = [{ cx: 82, flip: 1 }, { cx: 174, flip: -1 }];
  const EY = 132;

  /* caught-in-the-act: the eyes go enormous and shiny.  This is the whole
     expression — nothing else on the face has to work very hard. */
  const innocent = mood === 'innocent';
  const eyeK = innocent ? 1.34 : (mood === 'plead' ? 1.20 : 1);

  /* ================= the eyes ================= */
  for (const E of EYES) {
    const cx = E.cx, f = E.flip;
    x.save();
    x.translate(cx, EY);
    x.scale(f, 1);

    if (mood === 'dizzy' || mood === 'ko') {
      x.strokeStyle = '#2b2033'; x.lineWidth = 9; x.lineCap = 'round';
      if (mood === 'ko') {
        x.beginPath(); x.moveTo(-22, -22); x.lineTo(22, 22);
        x.moveTo(22, -22); x.lineTo(-22, 22); x.stroke();
      } else {
        x.lineWidth = 5;
        x.beginPath();
        for (let a = 0; a < 13; a += 0.12) {
          const r = a * 2.5, px = Math.cos(a) * r, py = Math.sin(a) * r * 0.92;
          a ? x.lineTo(px, py) : x.moveTo(px, py);
        }
        x.stroke();
      }
      x.restore();
      continue;
    }

    const openK = blink ? 0.12 : (mood === 'surprised' ? 1.14 : 1);
    const EW = 35 * eyeK, EH = 29 * openK * eyeK;

    x.fillStyle = '#fbfdff';
    x.beginPath(); x.ellipse(0, 0, EW, EH, 0, 0, Math.PI * 2); x.fill();
    const sc = x.createLinearGradient(0, -EH, 0, EH * 0.2);
    sc.addColorStop(0, 'rgba(126,146,180,.70)');
    sc.addColorStop(1, 'rgba(150,168,196,0)');
    x.save(); x.beginPath(); x.ellipse(0, 0, EW, EH, 0, 0, Math.PI * 2); x.clip();
    x.fillStyle = sc; x.fillRect(-EW, -EH, EW * 2, EH * 1.4); x.restore();

    if (!blink) {
      x.save();
      x.beginPath(); x.ellipse(0, 0, EW, EH, 0, 0, Math.PI * 2); x.clip();
      const ix = (mood === 'surprised' || innocent) ? 0 : -2, iy = innocent ? 1 : -1;
      const IW = 20 * eyeK, IH = 23 * eyeK;
      x.fillStyle = IRIS[0];
      x.beginPath(); x.ellipse(ix, iy, IW, IH, 0, 0, Math.PI * 2); x.fill();
      const ig = x.createLinearGradient(0, iy - IH, 0, iy + IH);
      ig.addColorStop(0.00, IRIS[1]);
      ig.addColorStop(0.42, IRIS[2]);
      ig.addColorStop(0.78, IRIS[3]);
      ig.addColorStop(1.00, IRIS[4]);
      x.fillStyle = ig;
      x.beginPath(); x.ellipse(ix, iy + 1, IW * 0.86, IH * 0.86, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(30,60,110,.42)'; x.lineWidth = 2;
      for (let a = 0; a < 14; a++) {
        const ang = (a / 14) * Math.PI * 2;
        x.beginPath();
        x.moveTo(ix + Math.cos(ang) * IW * 0.30, iy + Math.sin(ang) * IH * 0.30);
        x.lineTo(ix + Math.cos(ang) * IW * 0.80, iy + Math.sin(ang) * IH * 0.80);
        x.stroke();
      }
      x.strokeStyle = GLINT; x.lineWidth = 5;
      x.beginPath(); x.ellipse(ix, iy + 1, IW * 0.74, IH * 0.74, 0, 0.18 * Math.PI, 0.82 * Math.PI);
      x.stroke();
      x.fillStyle = '#141f38';
      x.beginPath();
      x.ellipse(ix, iy + 2, IW * (innocent ? 0.30 : 0.36), IH * (innocent ? 0.40 : 0.46),
                0, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = '#ffffff';
      x.beginPath(); x.ellipse(ix - 7 * eyeK, iy - 9 * eyeK, 8.5 * eyeK, 7 * eyeK, -0.35, 0, Math.PI * 2); x.fill();
      x.globalAlpha = 0.85;
      x.beginPath(); x.ellipse(ix + 7 * eyeK, iy + 9 * eyeK, 3.6 * eyeK, 3.0 * eyeK, 0, 0, Math.PI * 2); x.fill();
      /* two extra catchlights, so the innocent look reads as wet and shiny */
      if (innocent || mood === 'plead') {
        x.globalAlpha = 0.75;
        x.beginPath(); x.ellipse(ix + 11, iy - 14, 4.2, 3.4, 0.5, 0, Math.PI * 2); x.fill();
        x.globalAlpha = 0.55;
        x.beginPath(); x.ellipse(ix - 12, iy + 12, 5.4, 4.0, -0.3, 0, Math.PI * 2); x.fill();
      }
      x.globalAlpha = 1;
      x.restore();
    }

    /* --- the lash line: heavy on top, flicking out at the corner --- */
    x.fillStyle = LASH;
    x.beginPath();
    x.moveTo(-EW - 3, -EH * 0.35);
    x.quadraticCurveTo(-EW * 0.2, -EH - 11, EW + 2, -EH * 0.52);
    x.lineTo(EW + 9, -EH * 0.92);
    x.quadraticCurveTo(EW * 0.1, -EH - 2.5, -EW - 2, -EH * 0.10);
    x.closePath(); x.fill();
    x.strokeStyle = LASH; x.lineWidth = 3.4; x.lineCap = 'round';
    x.beginPath();
    x.moveTo(EW - 1, -EH * 0.72); x.lineTo(EW + 12, -EH * 1.10);
    x.moveTo(EW - 9, -EH * 0.88); x.lineTo(EW - 1, -EH * 1.24);
    x.stroke();
    x.strokeStyle = 'rgba(120,88,96,.55)'; x.lineWidth = 2.6;
    x.beginPath();
    x.moveTo(-EW * 0.72, EH * 0.90);
    x.quadraticCurveTo(0, EH * 1.16, EW * 0.86, EH * 0.62);
    x.stroke();
    x.restore();
  }

  /* ================= brows ================= */
  x.strokeStyle = BROW; x.lineWidth = 6; x.lineCap = 'round';
  for (const E of EYES) {
    const up = mood === 'surprised' ? 12 : (mood === 'pain' ? -3 : (innocent ? 16 : 0));
    x.save(); x.translate(E.cx, EY - 44 - up); x.scale(E.flip, 1);
    x.beginPath();
    if (mood === 'pain') { x.moveTo(-26, -6); x.quadraticCurveTo(0, 4, 26, 8); }
    /* worried little arches — the "we were not doing anything" eyebrows */
    else if (innocent) { x.moveTo(-24, 2); x.quadraticCurveTo(-2, -9, 24, 3); }
    else { x.moveTo(-26, 4); x.quadraticCurveTo(-2, -7, 26, -1); }
    x.stroke(); x.restore();
  }

  /* ================= tinted round glasses ================= */
  /* drawn last of the eye furniture so the lens tints everything under it */
  if (V.glasses) {
    const LR = 44, LY = EY + 2;
    for (const E of EYES) {
      const gx = E.cx + E.flip * 2;
      const lg = x.createLinearGradient(gx - LR, LY - LR, gx + LR * 0.4, LY + LR);
      lg.addColorStop(0.00, 'rgba(255,196,120,.62)');
      lg.addColorStop(0.45, 'rgba(255,150,120,.46)');
      lg.addColorStop(1.00, 'rgba(240,120,150,.52)');
      x.fillStyle = lg;
      x.beginPath(); x.ellipse(gx, LY, LR, LR * 0.90, 0, 0, Math.PI * 2); x.fill();
      /* the sheen across the top left of the lens */
      x.save();
      x.beginPath(); x.ellipse(gx, LY, LR, LR * 0.90, 0, 0, Math.PI * 2); x.clip();
      x.fillStyle = 'rgba(255,255,255,.30)';
      x.beginPath();
      x.moveTo(gx - LR, LY - 6); x.lineTo(gx - 4, LY - LR); x.lineTo(gx + 14, LY - LR);
      x.lineTo(gx - LR, LY + 16); x.closePath(); x.fill();
      x.restore();
      /* thin gold rim */
      x.strokeStyle = '#d8a24a'; x.lineWidth = 4;
      x.beginPath(); x.ellipse(gx, LY, LR, LR * 0.90, 0, 0, Math.PI * 2); x.stroke();
      x.strokeStyle = 'rgba(255,240,200,.7)'; x.lineWidth = 1.6;
      x.beginPath(); x.ellipse(gx, LY, LR - 3, LR * 0.90 - 3, 0, 0, Math.PI * 2); x.stroke();
    }
    /* bridge and the arms disappearing past the temples */
    x.strokeStyle = '#d8a24a'; x.lineWidth = 4; x.lineCap = 'round';
    x.beginPath(); x.moveTo(126, LY - 6); x.quadraticCurveTo(128, LY - 16, 130, LY - 6); x.stroke();
    x.beginPath(); x.moveTo(82 - 44, LY - 8); x.lineTo(14, LY - 20); x.stroke();
    x.beginPath(); x.moveTo(174 + 44, LY - 8); x.lineTo(242, LY - 20); x.stroke();
  }

  /* ================= nose and mouth ================= */
  x.fillStyle = 'rgba(190,140,140,.55)';
  x.beginPath(); x.ellipse(128, 172, 3.6, 2.6, 0, 0, Math.PI * 2); x.fill();

  x.strokeStyle = '#b4636f'; x.lineWidth = 4; x.lineCap = 'round';
  x.fillStyle = '#8e3644';
  if (innocent) {
    /* a very small mouth.  The less of it there is, the more innocent she
       looks, which is exactly the trick being played on Baldi here. */
    x.lineWidth = 3.2;
    if (V.cat) {
      x.beginPath();
      x.moveTo(120, 192); x.quadraticCurveTo(124, 198, 128, 191);
      x.quadraticCurveTo(132, 198, 136, 192); x.stroke();
    } else {
      x.fillStyle = '#a84658';
      x.beginPath(); x.ellipse(128, 194, 4.6, 4.0, 0, 0, Math.PI * 2); x.fill();
    }
  } else if (V.cat && (mood === 'normal' || mood === 'happy')) {
    x.lineWidth = 3.6;
    x.beginPath();
    x.moveTo(116, 190); x.quadraticCurveTo(122, 200, 128, 189);
    x.quadraticCurveTo(134, 200, 140, 190); x.stroke();
  } else if (mood === 'surprised' || mood === 'pain' || mood === 'ko') {
    x.beginPath(); x.ellipse(128, 198, 13, mood === 'ko' ? 9 : 15, 0, 0, Math.PI * 2); x.fill();
  } else if (mood === 'happy') {
    x.beginPath(); x.arc(128, 190, 13, 0.12 * Math.PI, 0.88 * Math.PI); x.stroke();
  } else {
    x.beginPath(); x.arc(128, 188, 9, 0.18 * Math.PI, 0.82 * Math.PI); x.stroke();
  }

  /* ================= blush ================= */
  for (const bx of [48, 208]) {
    const bg = x.createRadialGradient(bx, 174, 2, bx, 174, 26);
    const str = innocent ? '.78' : '.55';
    bg.addColorStop(0, 'rgba(255,140,165,' + str + ')');
    bg.addColorStop(1, 'rgba(255,140,165,0)');
    x.fillStyle = bg;
    x.beginPath(); x.ellipse(bx, 174, 26, innocent ? 17 : 15, 0, 0, Math.PI * 2); x.fill();
  }
  /* whisker dots for the cat one */
  if (V.cat) {
    x.fillStyle = 'rgba(150,105,110,.55)';
    for (const wx of [36, 46, 56, 200, 210, 220]) {
      x.beginPath(); x.ellipse(wx, 168 + (wx % 20 === 6 ? 6 : 0), 2.2, 2.2, 0, 0, Math.PI * 2); x.fill();
    }
  }
  if (mood === 'pain' || mood === 'dizzy') {
    x.strokeStyle = '#d8353f'; x.lineWidth = 5; x.lineCap = 'round';
    x.save(); x.translate(206, 86);
    for (let i = 0; i < 2; i++) {
      x.beginPath(); x.moveTo(-10, -3 + i * 12); x.lineTo(10, -3 + i * 12); x.stroke();
      x.beginPath(); x.moveTo(-3 + i * 12, -10); x.lineTo(-3 + i * 12, 10); x.stroke();
    }
    x.restore();
  }
  /* a bead of sweat, for being caught red-handed */
  if (innocent) {
    x.fillStyle = 'rgba(180,225,255,.92)';
    x.beginPath();
    x.moveTo(224, 70); x.quadraticCurveTo(215, 88, 224, 96);
    x.quadraticCurveTo(233, 88, 224, 70); x.closePath(); x.fill();
    x.fillStyle = 'rgba(255,255,255,.8)';
    x.beginPath(); x.ellipse(221, 88, 2.4, 3.2, 0, 0, Math.PI * 2); x.fill();
  }
}

/* --------------------------------------------------------------- the model */
/* The three of them are the same girl underneath: same rig, same face
   renderer, different paint and a couple of extra parts.  `kind` picks one
   of the presets below; anything not named falls back to the schoolgirl. */
const GIRL_KINDS = {
  normal: {},
  cat: {
    hair: 0xe08a9c, hair2: 0xf0a2b2, ribbon: 0x8ad0e0,
    skirt: 0x3a2c48, tieCol: 0x8ad0e0,
    face: { iris: ['#5a2c12', '#b06a1e', '#e8a43c', '#f7d067', '#fff0bc'],
            brow: '#7a4030', lash: '#40252c', glint: 'rgba(255,238,190,.95)', cat: 1 },
    ears: 1, tail: 1
  },
  shades: {
    hair: 0xf0e2bc, hair2: 0xfff3d8, ribbon: 0xe8a24a,
    skirt: 0x3c3a50, tieCol: 0xe8a24a,
    face: { iris: ['#5c3a18', '#a86a2c', '#dfa246', '#f6cf7e', '#fff2cf'],
            brow: '#a68a5a', lash: '#4a3a34', glint: 'rgba(255,236,196,.95)', glasses: 1 },
    twin: 1
  }
};

function makeAnimeGirl(kind) {
  const V = GIRL_KINDS[kind] || GIRL_KINDS.normal;
  const FV = V.face || {};
  const g = new THREE.Group();

  const SKIN = new THREE.MeshLambertMaterial({ color: 0xfdeae0 });
  const HAIR = new THREE.MeshLambertMaterial({ color: V.hair || 0x3d2b2a });
  const HAIR2 = new THREE.MeshLambertMaterial({ color: V.hair2 || 0x4d3735 });
  const SHIRT = new THREE.MeshLambertMaterial({ color: 0xf7f5ef });
  const NAVY = new THREE.MeshLambertMaterial({ color: V.skirt || 0x2c3654 });
  const TIE = new THREE.MeshLambertMaterial({ color: V.tieCol || 0xc9384a });
  const SOCK = new THREE.MeshLambertMaterial({ color: 0xf2f0ea });
  const SHOE = new THREE.MeshLambertMaterial({ color: 0x30323c });

  /* ---- legs ---- */
  const legL = new THREE.Group(), legR = new THREE.Group();
  [[legL, -0.42], [legR, 0.42]].forEach(([L, dx]) => {
    L.position.set(dx, 3.3, 0); g.add(L);
    const thigh = capsuleBox(0.62, 1.7, 0.62, SKIN); thigh.position.y = -0.85; L.add(thigh);
    const sockM = capsuleBox(0.60, 1.5, 0.60, SOCK); sockM.position.y = -2.35; L.add(sockM);
    const shoe = box(0.72, 0.42, 1.12, SHOE); shoe.position.set(0, -3.2, 0.22); L.add(shoe);
  });

  /* ---- torso in a sailor uniform ---- */
  const torso = new THREE.Group(); torso.position.y = 3.3; g.add(torso);
  const body = capsuleBox(1.5, 2.3, 0.92, SHIRT); body.position.y = 1.15; torso.add(body);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.6, 1.15, 12), NAVY);
  skirt.position.y = 0.16; torso.add(skirt);
  for (let i = 0; i < 12; i++) {                       // pleats
    const a = (i / 12) * TAU;
    const pl = box(0.16, 1.15, 0.16, new THREE.MeshLambertMaterial({ color: 0x232b45 }));
    pl.position.set(Math.sin(a) * 1.42, 0.16, Math.cos(a) * 1.42); torso.add(pl);
  }
  /* the sailor collar */
  const collar = box(1.58, 0.5, 1.0, NAVY); collar.position.y = 2.24; torso.add(collar);
  const flap = box(1.2, 0.9, 0.16, NAVY); flap.position.set(0, 1.85, -0.52); torso.add(flap);
  const stripe = box(1.2, 0.10, 0.18, SHIRT); stripe.position.set(0, 1.55, -0.53); torso.add(stripe);
  const tie = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.8, 4), TIE);
  tie.position.set(0, 1.75, 0.48); tie.rotation.x = Math.PI; torso.add(tie);
  const knot = box(0.30, 0.26, 0.22, TIE); knot.position.set(0, 2.10, 0.46); torso.add(knot);

  /* ---- arms ---- */
  function arm(side) {
    const a = new THREE.Group();
    a.position.set(side * 0.92, 2.15, 0); torso.add(a);
    const upper = capsuleBox(0.46, 1.35, 0.46, SHIRT); upper.position.y = -0.67; a.add(upper);
    const fore = new THREE.Group(); fore.position.y = -1.32; a.add(fore);
    const lower = capsuleBox(0.42, 1.30, 0.42, SKIN); lower.position.y = -0.65; fore.add(lower);
    const hand = sph(0.30, SKIN, 1, 1.1, 0.85, 8); hand.position.y = -1.34; fore.add(hand);
    return { g: a, fore: fore };
  }
  const armL = arm(-1), armR = arm(1);

  /* ---- head ---- */
  const head = new THREE.Group(); head.position.y = 6.05; g.add(head);
  const skull = sph(1.30, SKIN, 0.98, 1.05, 0.95, 18); head.add(skull);
  const chin = sph(0.90, SKIN, 0.92, 0.80, 0.90, 14); chin.position.y = -0.66; head.add(chin);

  /* the face, drawn on a slightly domed panel across the front */
  const faceCv = document.createElement('canvas');
  faceCv.width = faceCv.height = 256;
  drawAnimeFace(faceCv, 'normal', false, FV);
  const faceTex = new THREE.CanvasTexture(faceCv);
  faceTex.magFilter = THREE.LinearFilter; faceTex.minFilter = THREE.LinearMipMapLinearFilter;
  const faceMat = new THREE.MeshLambertMaterial({ map: faceTex, transparent: true });
  /* phi = PI/2 is straight ahead on a three.js sphere, so centre the panel
     there — anywhere else and her face ends up on the side of her head */
  const faceGeo = new THREE.SphereGeometry(1.31, 20, 16,
    Math.PI * 0.12, Math.PI * 0.76, Math.PI * 0.20, Math.PI * 0.62);
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.scale.set(0.99, 1.06, 0.96);
  head.add(face);

  /* ---- hair ---- */
  const hair = new THREE.Group(); head.add(hair);
  /* an open-fronted shell rather than a full sphere — a complete one would
     be a helmet over the very face we just drew */
  const capGeo = new THREE.SphereGeometry(1.42, 22, 14,
    Math.PI * 0.84, Math.PI * 1.32, 0, Math.PI * 0.66);
  const cap = new THREE.Mesh(capGeo, HAIR);
  cap.scale.set(1.0, 1.02, 1.0);
  cap.position.y = 0.10; hair.add(cap);
  /* a cap for the crown, so there is no hole looking down on her */
  const crownCap = sph(1.30, HAIR, 1.06, 0.55, 1.06, 14);
  crownCap.position.y = 0.62; hair.add(crownCap);
  const fringe = new THREE.Group(); hair.add(fringe);
  for (let i = 0; i < 9; i++) {
    const u = (i / 8 - 0.5);
    const strand = box(0.48, 1.30 - Math.abs(u) * 0.30, 0.34, i % 2 ? HAIR : HAIR2);
    strand.position.set(u * 2.00, 0.74 - Math.abs(u) * 0.14, 1.00 - Math.abs(u) * 0.50);
    strand.rotation.z = u * 0.30;
    strand.rotation.x = -0.20;
    fringe.add(strand);
  }
  /* the two long locks that frame her face */
  for (const sx of [-1, 1]) {
    const lock = box(0.42, 2.5, 0.52, HAIR);
    lock.position.set(sx * 1.24, -0.75, 0.42);
    lock.rotation.z = sx * 0.06; hair.add(lock);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.7, 5), HAIR);
    tip.position.set(sx * 1.24, -2.25, 0.42); tip.rotation.x = Math.PI; hair.add(tip);
  }
  /* the back of the bob */
  const back = sph(1.34, HAIR, 1.02, 1.15, 0.9, 16);
  back.position.set(0, -0.45, -0.34); hair.add(back);
  /* one strand sticking up, because there is always one */
  const ahoge = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.075, 5, 12, Math.PI * 1.3), HAIR);
  ahoge.position.set(-0.1, 1.55, -0.1); ahoge.rotation.set(0.3, 0.2, 1.1); hair.add(ahoge);
  /* a little ribbon */
  const RIB = new THREE.MeshLambertMaterial({ color: V.ribbon || 0xc9384a });
  const rib = box(0.5, 0.28, 0.2, RIB); rib.position.set(-1.05, 0.86, 0.62); hair.add(rib);
  const rib2 = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.5, 4), RIB);
  rib2.position.set(-1.34, 0.86, 0.62); rib2.rotation.z = Math.PI / 2; hair.add(rib2);

  /* --- twin tails, for the one in the glasses --- */
  const tails = [];
  if (V.twin) {
    for (const sx of [-1, 1]) {
      const t0 = new THREE.Group();
      t0.position.set(sx * 1.30, 0.55, -0.45); hair.add(t0);
      const tie0 = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.10, 6, 10), RIB);
      tie0.rotation.y = Math.PI / 2; t0.add(tie0);
      let par = t0;
      for (let i = 0; i < 3; i++) {                     // three joints, so it swings
        const seg = new THREE.Group();
        seg.position.y = i ? -1.05 : -0.30; par.add(seg);
        const m2 = capsuleBox(0.44 - i * 0.06, 1.10, 0.44 - i * 0.06, i % 2 ? HAIR2 : HAIR);
        m2.position.y = -0.55; seg.add(m2);
        par = seg;
      }
      const tip2 = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.62, 6), HAIR);
      tip2.position.y = -1.16; tip2.rotation.x = Math.PI; par.add(tip2);
      tails.push({ root: t0, sx: sx });
    }
  }

  /* --- cat ears and a tail, for the one who is a cat --- */
  const ears = [];
  if (V.ears) {
    const INNER = new THREE.MeshLambertMaterial({ color: 0xffc2cf });
    for (const sx of [-1, 1]) {
      const e0 = new THREE.Group();
      e0.position.set(sx * 0.66, 1.28, -0.02); e0.rotation.z = sx * 0.30; hair.add(e0);
      const shell = new THREE.Mesh(new THREE.ConeGeometry(0.40, 0.86, 4), HAIR);
      shell.position.y = 0.43; shell.rotation.y = Math.PI / 4; e0.add(shell);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.54, 4), INNER);
      inner.position.set(0, 0.40, 0.13); inner.rotation.y = Math.PI / 4; e0.add(inner);
      ears.push({ root: e0, sx: sx });
    }
  }
  const tail = [];
  if (V.tail) {
    let par = new THREE.Group();
    par.position.set(0, 3.5, -0.85); g.add(par);
    const tailRoot = par;
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Group();
      seg.position.z = i ? -0.62 : -0.2; par.add(seg);
      const m2 = capsuleBox(0.30 - i * 0.03, 0.30 - i * 0.03, 0.66, i % 2 ? HAIR2 : HAIR);
      m2.position.z = -0.31; seg.add(m2);
      tail.push(seg);
      par = seg;
    }
    const tip3 = sph(0.20, HAIR2, 1, 1, 1.3, 8); tip3.position.z = -0.62; par.add(tip3);
    tail.unshift(tailRoot);
  }

  const S = {
    root: g, head: head, hair: hair, torso: torso, face: face,
    legL: legL, legR: legR, armL: armL, armR: armR,
    kind: kind || 'normal', tails: tails, ears: ears, tail: tail,
    mood: 'normal', blink: false, blinkT: rand(1.5, 4),
    _cv: faceCv, _tex: faceTex
  };

  S.setMood = function (m) {
    if (m === S.mood) return;
    S.mood = m;
    drawAnimeFace(faceCv, m, S.blink, FV);
    faceTex.needsUpdate = true;
  };
  /* a neutral standing pose with a bit of life in it */
  S.update = function (dt, opt) {
    opt = opt || {};
    S.blinkT -= dt;
    if (S.blinkT <= 0 && S.mood !== 'dizzy' && S.mood !== 'ko') {
      S.blinkT = rand(2.0, 5.0);
      S.blink = true; drawAnimeFace(faceCv, S.mood, true, FV); faceTex.needsUpdate = true;
      setTimeout(() => {
        S.blink = false; drawAnimeFace(faceCv, S.mood, false, FV); faceTex.needsUpdate = true;
      }, 110);
    }
    if (opt.idle !== false) {
      const t = opt.t != null ? opt.t : ((typeof G0 !== 'undefined' && G0.t) || 0);
      S.torso.rotation.z = Math.sin(t * 1.4) * 0.03;
      S.head.rotation.z = -Math.sin(t * 1.4) * 0.04;
      S.head.position.y = 6.05 + Math.sin(t * 2.4) * 0.04;
      S.armL.g.rotation.x = Math.sin(t * 1.3) * 0.08 - 0.06;
      S.armR.g.rotation.x = -Math.sin(t * 1.3) * 0.08 - 0.06;
    }
    S.wobble(opt.t != null ? opt.t : ((typeof G0 !== 'undefined' && G0.t) || 0),
             opt.wob == null ? 1 : opt.wob);
  };

  /* hair, ears and tail lag behind whatever the body just did — this is the
     only reason the three of them read as alive when they are sitting still */
  S.wobble = function (t, amt) {
    for (let i = 0; i < tails.length; i++) {
      const T = tails[i];
      T.root.rotation.x = 0.30 + Math.sin(t * 2.1 + i) * 0.10 * amt;
      T.root.rotation.z = T.sx * (0.34 + Math.sin(t * 1.7 + i * 2) * 0.08 * amt);
      let c = T.root.children[1];
      for (let d = 0; d < 3 && c; d++) {
        c.rotation.z = Math.sin(t * 2.4 - d * 0.7 + i * 1.3) * 0.11 * amt;
        c.rotation.x = Math.sin(t * 1.9 - d * 0.9) * 0.08 * amt;
        c = c.children.find(n => n.type === 'Group');
      }
    }
    for (let i = 0; i < ears.length; i++) {
      const E = ears[i];
      /* the twitch: mostly still, then a quick flick */
      const tw = Math.max(0, Math.sin(t * 0.8 + i * 2.2) - 0.93) * 14;
      E.root.rotation.z = E.sx * (0.30 + tw * 0.22 * amt);
      E.root.rotation.x = -tw * 0.18 * amt;
    }
    for (let i = 1; i < tail.length; i++) {
      tail[i].rotation.y = Math.sin(t * 2.6 - i * 0.8) * 0.22 * amt;
      tail[i].rotation.x = Math.sin(t * 1.9 - i * 0.6) * 0.14 * amt + (i === 1 ? 0.35 : 0);
    }
  };

  /* --- elastic --- */
  /* Being squeezed by Baldi is a volume-preserving operation: whatever she
     loses across, she gains up.  `k` above 1 stretches her tall and thin. */
  S.squash = function (k, twist) {
    const kk = Math.max(0.15, k);
    S.root.scale.set(1 / Math.sqrt(kk), kk, 1 / Math.sqrt(kk));
    S.root.rotation.z = twist || 0;
  };
  S.flail = function (t, amt) {
    const a = amt == null ? 1 : amt;
    S.armL.g.rotation.set(-2.2 + Math.sin(t * 15) * 0.9 * a, 0, -1.9 - Math.sin(t * 13) * 0.6 * a);
    S.armR.g.rotation.set(-2.2 + Math.sin(t * 14 + 2) * 0.9 * a, 0, 1.9 + Math.sin(t * 12) * 0.6 * a);
    S.armL.fore.rotation.x = -0.8 + Math.sin(t * 19) * 0.7 * a;
    S.armR.fore.rotation.x = -0.8 + Math.sin(t * 21) * 0.7 * a;
    S.legL.rotation.set(Math.sin(t * 16) * 0.9 * a, 0, -0.35);
    S.legR.rotation.set(-Math.sin(t * 17) * 0.9 * a, 0, 0.35);
    S.head.rotation.set(Math.sin(t * 11) * 0.25 * a, 0, Math.sin(t * 9) * 0.30 * a);
  };
  /* sitting, knees together, leaning over the desk */
  S.sit = function (lean) {
    S.legL.rotation.set(-1.45, 0, -0.06); S.legR.rotation.set(-1.45, 0, 0.06);
    S.legL.rotation.x = -1.45; S.legR.rotation.x = -1.45;
    S.torso.rotation.x = lean || 0;
  };
  /* a floppy ragdoll, for when she is being launched about */
  S.ragdoll = function (k) {
    const w = (a, b) => a + Math.sin(k * b) * 0.9;
    S.armL.g.rotation.set(w(-1.2, 7.1), 0, -1.5 + Math.sin(k * 5.3) * 0.7);
    S.armR.g.rotation.set(w(-1.2, 6.3), 0, 1.5 - Math.sin(k * 5.9) * 0.7);
    S.armL.fore.rotation.x = -1.0 + Math.sin(k * 8) * 0.6;
    S.armR.fore.rotation.x = -1.0 + Math.sin(k * 9) * 0.6;
    S.legL.rotation.set(w(-0.4, 6.7), 0, -0.3 + Math.sin(k * 4.6) * 0.4);
    S.legR.rotation.set(w(-0.4, 7.9), 0, 0.3 - Math.sin(k * 5.1) * 0.4);
    S.torso.rotation.set(Math.sin(k * 4) * 0.25, 0, Math.sin(k * 3.3) * 0.3);
    S.head.rotation.set(Math.sin(k * 6) * 0.4, 0, Math.sin(k * 5) * 0.5);
  };
  S.reset = function () {
    S.armL.g.rotation.set(0, 0, -0.10); S.armR.g.rotation.set(0, 0, 0.10);
    S.armL.fore.rotation.x = 0; S.armR.fore.rotation.x = 0;
    S.legL.rotation.set(0, 0, 0); S.legR.rotation.set(0, 0, 0);
    S.torso.rotation.set(0, 0, 0); S.head.rotation.set(0, 0, 0);
  };
  S.reset();
  return S;
}

/* ------------------------------------------------- her, as a flat sprite
   For crowds. One draw call for a thousand of her. */
let CHIBI_TEX = null;
function chibiTexture() {
  if (CHIBI_TEX) return CHIBI_TEX;
  const W = 128, H = 192, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.clearRect(0, 0, W, H);
  /* body */
  x.fillStyle = '#f7f5ef'; x.fillRect(40, 92, 48, 42);      // shirt
  x.fillStyle = '#2c3654'; x.fillRect(34, 128, 60, 26);     // skirt
  x.fillStyle = '#2c3654'; x.fillRect(40, 88, 48, 10);      // collar
  x.fillStyle = '#c9384a'; x.fillRect(60, 96, 8, 14);       // tie
  x.fillStyle = '#fdeae0'; x.fillRect(30, 96, 10, 34);      // arms
  x.fillRect(88, 96, 10, 34);
  x.fillStyle = '#f2f0ea'; x.fillRect(46, 152, 12, 26);     // socks
  x.fillRect(70, 152, 12, 26);
  x.fillStyle = '#30323c'; x.fillRect(44, 176, 16, 8);      // shoes
  x.fillRect(68, 176, 16, 8);
  /* head */
  x.fillStyle = '#fdeae0';
  x.beginPath(); x.ellipse(64, 56, 34, 36, 0, 0, Math.PI * 2); x.fill();
  /* hair */
  x.fillStyle = '#3d2b2a';
  x.beginPath(); x.ellipse(64, 44, 38, 34, 0, Math.PI, 0); x.fill();
  x.fillRect(26, 40, 12, 46); x.fillRect(90, 40, 12, 46);
  x.beginPath(); x.moveTo(30, 44); x.lineTo(64, 34); x.lineTo(98, 44);
  x.lineTo(94, 60); x.lineTo(64, 48); x.lineTo(34, 60); x.closePath(); x.fill();
  /* the eyes, small but the same colours */
  for (const ex of [50, 78]) {
    x.fillStyle = '#232a45';
    x.beginPath(); x.ellipse(ex, 62, 10, 11, 0, 0, Math.PI * 2); x.fill();
    const g2 = x.createLinearGradient(0, 54, 0, 72);
    g2.addColorStop(0, '#2b5f95'); g2.addColorStop(0.6, '#63b6dd'); g2.addColorStop(1, '#c8f0ff');
    x.fillStyle = g2;
    x.beginPath(); x.ellipse(ex, 63, 7.5, 8.5, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#141f38';
    x.beginPath(); x.ellipse(ex, 64, 3, 4, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#ffffff';
    x.beginPath(); x.ellipse(ex - 3, 58, 3.4, 2.8, 0, 0, Math.PI * 2); x.fill();
  }
  x.strokeStyle = '#b4636f'; x.lineWidth = 2;
  x.beginPath(); x.arc(64, 76, 4, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke();
  CHIBI_TEX = new THREE.CanvasTexture(c);
  CHIBI_TEX.magFilter = THREE.NearestFilter;
  return CHIBI_TEX;
}


/* =========================================================================
   Part 5i — METHODS FOURTEEN AND FIFTEEN
   A Singapore secondary school corridor, and a Roblox arena full of people
   who have been practising combos since primary four.
   ========================================================================= */

ACT_AT.sgschool = { x: 320, z: 320 };
ACT_AT.tsb      = { x: -320, z: 320 };

/* ------------------------------------------------- 14 · the school corridor */
function makeSGSchoolSet() {
  const g = new THREE.Group();
  const A = ACT_AT.sgschool;
  g.position.set(A.x, 0, A.z);

  /* bright tropical sky */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(380, 16, 10),
    new THREE.MeshBasicMaterial({ color: 0xa8cfe8, side: THREE.BackSide, fog: false }));
  g.add(sky);

  /* the corridor floor: grey terrazzo, running along +x */
  const terr = (function () {
    const { c, x } = cv(64, 64);
    x.fillStyle = '#b9b6ad'; x.fillRect(0, 0, 64, 64);
    for (let k = 0; k < 900; k++) {
      const g2 = Math.random();
      x.fillStyle = g2 < .34 ? '#a8a49a' : g2 < .67 ? '#c9c6bd' : '#8f8c83';
      x.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
    }
    x.strokeStyle = 'rgba(90,88,82,.5)'; x.lineWidth = 2;
    x.strokeRect(0, 0, 64, 64);
    return texFrom(c, 26, 3);
  })();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(104, 12),
    new THREE.MeshLambertMaterial({ map: terr }));
  floor.rotation.x = -Math.PI / 2; g.add(floor);

  /* the classroom-block wall down one side, with doors and a notice board */
  const wallM = new THREE.MeshLambertMaterial({ color: 0xe6e0d2 });
  const wall = box(104, 13, 1.2, wallM); wall.position.set(0, 6.5, -6); g.add(wall);
  const skirtM = new THREE.MeshLambertMaterial({ color: 0x5d6a52 });
  const skirtB = box(104, 1.5, 1.4, skirtM); skirtB.position.set(0, 0.75, -6); g.add(skirtB);

  const doorM = new THREE.MeshLambertMaterial({ color: 0x2f6f5a });
  for (let i = -3; i <= 3; i++) {
    const d = box(4.2, 7.2, 0.4, doorM); d.position.set(i * 13, 3.6, -5.3); g.add(d);
    const win = box(3.4, 2.2, 0.2, new THREE.MeshLambertMaterial({ color: 0x9fd0dd }));
    win.position.set(i * 13, 5.6, -5.05); g.add(win);
    /* the class sign above each door */
    const sc = cv(96, 40);
    sc.x.fillStyle = '#1d3f33'; sc.x.fillRect(0, 0, 96, 40);
    sc.x.fillStyle = '#f4f0e2'; sc.x.font = 'bold 22px Arial'; sc.x.textAlign = 'center';
    sc.x.fillText('SEC ' + (i + 4) + (['A', 'B', 'C', 'D', 'E', 'F', 'G'][i + 3]), 48, 28);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.35),
      new THREE.MeshBasicMaterial({ map: texFrom(sc.c, 1, 1) }));
    sg.position.set(i * 13, 7.9, -5.3); g.add(sg);
  }
  /* a notice board, because there is always a notice board */
  const nb = box(9, 4.4, 0.3, new THREE.MeshLambertMaterial({ color: 0x2d4a2f }));
  nb.position.set(6.5, 5.4, -5.3); g.add(nb);
  for (let k = 0; k < 8; k++) {
    const pn = box(1.5, 1.9, 0.12, new THREE.MeshLambertMaterial({
      color: [0xf4f0e2, 0xffe9a8, 0xd8f0ff][k % 3] }));
    pn.position.set(3.2 + (k % 4) * 2.1, 6.2 - Math.floor(k / 4) * 2.1, -5.1);
    pn.rotation.z = rand(-0.06, 0.06); g.add(pn);
  }

  /* the open side: pillars and a railing over the courtyard */
  const pillarM = new THREE.MeshLambertMaterial({ color: 0xe6e0d2 });
  for (let i = -4; i <= 4; i++) {
    const pl = box(1.3, 13, 1.3, pillarM); pl.position.set(i * 11, 6.5, 5.4); g.add(pl);
  }
  const railM = new THREE.MeshLambertMaterial({ color: 0x35566b });
  const ledge = box(104, 1.1, 1.0, pillarM); ledge.position.set(0, 3.4, 5.4); g.add(ledge);
  for (const y of [2.0, 2.8]) {
    const r = box(104, 0.16, 0.16, railM); r.position.set(0, y, 5.4); g.add(r);
  }
  for (let i = -25; i <= 25; i++) {
    const b = box(0.12, 2.4, 0.12, railM); b.position.set(i * 2, 1.7, 5.4); g.add(b);
  }
  const ceil = box(104, 0.9, 13, pillarM); ceil.position.set(0, 13.4, 0); g.add(ceil);

  /* the courtyard below: a green futsal court and some palms */
  const court = new THREE.Mesh(new THREE.PlaneGeometry(120, 90),
    new THREE.MeshLambertMaterial({ color: 0x3f7a44 }));
  court.rotation.x = -Math.PI / 2; court.position.set(0, -6, 44); g.add(court);
  const linesM = new THREE.MeshBasicMaterial({ color: 0xf2f2ea });
  for (const [lx, lz, lw, ld] of [[0, 44, 70, 0.5], [0, 20, 70, 0.5], [0, 68, 70, 0.5]]) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(lw, ld), linesM);
    l.rotation.x = -Math.PI / 2; l.position.set(lx, -5.94, lz); g.add(l);
  }
  for (let k = 0; k < 12; k++) {
    const px = rand(-58, 58), pz = rand(14, 78);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 11, 6),
      new THREE.MeshLambertMaterial({ color: 0x6b5a3a }));
    tr.position.set(px, -0.5, pz); g.add(tr);
    for (let f = 0; f < 7; f++) {
      const a = (f / 7) * TAU;
      const fr = box(0.5, 0.18, 5.2, new THREE.MeshLambertMaterial({ color: 0x2f7a3f }));
      fr.position.set(px + Math.sin(a) * 2.2, 5.0, pz + Math.cos(a) * 2.2);
      fr.rotation.set(-0.35, -a, 0); g.add(fr);
    }
  }
  /* a flag on a pole out in the courtyard */
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 26, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8d5cc }));
  pole.position.set(-26, 7, 40); g.add(pole);
  const fc = cv(96, 64);
  fc.x.fillStyle = '#ed2939'; fc.x.fillRect(0, 0, 96, 32);
  fc.x.fillStyle = '#ffffff'; fc.x.fillRect(0, 32, 96, 32);
  fc.x.beginPath(); fc.x.arc(24, 16, 10, 0, Math.PI * 2); fc.x.fill();
  fc.x.fillStyle = '#ed2939'; fc.x.beginPath(); fc.x.arc(28, 16, 9, 0, Math.PI * 2); fc.x.fill();
  fc.x.fillStyle = '#ffffff';
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k / 5) * TAU;
    fc.x.beginPath(); fc.x.arc(40 + Math.cos(a) * 8, 16 + Math.sin(a) * 8, 2.4, 0, Math.PI * 2); fc.x.fill();
  }
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 5),
    new THREE.MeshLambertMaterial({ map: texFrom(fc.c, 1, 1), side: THREE.DoubleSide }));
  flag.position.set(-22.2, 17.5, 40); g.add(flag);

  /* the students: white shirt, dark shorts or skirt, always in a hurry */
  const kids = [];
  for (let k = 0; k < 7; k++) {
    const s = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: 0xf6f4ec });
    const dark = new THREE.MeshLambertMaterial({ color: 0x2b3550 });
    const skin = new THREE.MeshLambertMaterial({
      color: [0xf0d0b0, 0xd8a878, 0xb98452, 0xe8c49c][k % 4] });
    const body = capsuleBox(1.5, 2.4, 0.9, shirt); body.position.y = 4.0; s.add(body);
    const bottom = box(1.5, 1.5, 0.95, dark); bottom.position.y = 2.4; s.add(bottom);
    const hd = sph(1.0, skin, 0.95, 1.05, 0.95, 12); hd.position.y = 6.0; s.add(hd);
    const hr = sph(1.06, new THREE.MeshLambertMaterial({ color: 0x1d1712 }), 0.98, 0.86, 1.0, 12);
    hr.position.y = 6.35; s.add(hr);
    const legs = new THREE.Group(); legs.position.y = 2.2; s.add(legs);
    for (const sx of [-1, 1]) {
      const lg = capsuleBox(0.5, 2.2, 0.5, skin); lg.position.set(sx * 0.4, -1.1, 0); legs.add(lg);
      const sk = box(0.55, 0.9, 0.55, new THREE.MeshLambertMaterial({ color: 0xf2f0ea }));
      sk.position.set(sx * 0.4, -2.5, 0); legs.add(sk);
      const sh = box(0.6, 0.35, 1.0, new THREE.MeshLambertMaterial({ color: 0x22242c }));
      sh.position.set(sx * 0.4, -2.95, 0.2); legs.add(sh);
    }
    const arms = new THREE.Group(); arms.position.y = 5.0; s.add(arms);
    for (const sx of [-1, 1]) {
      const am = capsuleBox(0.45, 2.1, 0.45, skin); am.position.set(sx * 0.95, -1.0, 0); arms.add(am);
    }
    /* a backpack, hanging off one shoulder */
    const bag = box(1.3, 1.7, 0.7, new THREE.MeshLambertMaterial({
      color: [0x2f4f8a, 0x8a2f3f, 0x2f8a5a][k % 3] }));
    bag.position.set(0, 4.0, -0.85); s.add(bag);
    s.position.set(-60 - k * 24, 0, rand(-3, 3));
    s.visible = false;
    g.add(s);
    kids.push({ g: s, legs: legs, arms: arms, lane: rand(-3, 3), sp: rand(19, 26) });
  }

  /* the football */
  const ballTex = (function () {
    const { c, x } = cv(64, 64);
    x.fillStyle = '#f4f4ee'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#1a1a1a';
    for (const [bx, by] of [[16, 16], [48, 16], [32, 40], [8, 48], [56, 48]]) {
      x.beginPath();
      for (let i = 0; i < 5; i++) {
        const aa = i / 5 * TAU - 0.6;
        const px = bx + Math.cos(aa) * 10, py = by + Math.sin(aa) * 10;
        i ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.closePath(); x.fill();
    }
    return texFrom(c, 2, 1);
  })();
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1),
    new THREE.MeshLambertMaterial({ map: ballTex }));
  ball.visible = false; g.add(ball);

  g.visible = false;
  g.userData = { kids: kids, ball: ball };
  return g;
}

/* ------------------------------------------- 15 · the strongest battlegrounds */
/* the classic six-part blocky avatar */
function makeR6(colors) {
  const g = new THREE.Group();
  const C = colors || {};
  const skin = new THREE.MeshLambertMaterial({ color: C.skin || 0xf5cd30 });
  const shirt = new THREE.MeshLambertMaterial({ color: C.shirt || 0x0d69ac });
  const pants = new THREE.MeshLambertMaterial({ color: C.pants || 0x27543f });

  const torso = box(2.0, 2.0, 1.0, shirt); torso.position.y = 3.0; g.add(torso);
  const head = new THREE.Group(); head.position.y = 4.6; g.add(head);
  const hd = box(1.6, 1.6, 1.6, skin); head.add(hd);
  /* the face */
  const fc = cv(64, 64);
  fc.x.clearRect(0, 0, 64, 64);
  fc.x.fillStyle = '#1a1a1a';
  fc.x.fillRect(16, 20, 7, 11); fc.x.fillRect(41, 20, 7, 11);
  fc.x.beginPath(); fc.x.arc(32, 40, 12, 0.12 * Math.PI, 0.88 * Math.PI); 
  fc.x.lineWidth = 5; fc.x.strokeStyle = '#1a1a1a'; fc.x.stroke();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6),
    new THREE.MeshLambertMaterial({ map: texFrom(fc.c, 1, 1), transparent: true }));
  face.position.z = 0.82; head.add(face);
  /* a hat, because everyone has a hat */
  if (C.hat) {
    const brim = box(2.2, 0.18, 2.2, new THREE.MeshLambertMaterial({ color: C.hat }));
    brim.position.y = 0.86; head.add(brim);
    const crown = box(1.5, 0.9, 1.5, new THREE.MeshLambertMaterial({ color: C.hat }));
    crown.position.y = 1.35; head.add(crown);
  }
  const arms = { l: new THREE.Group(), r: new THREE.Group() };
  for (const k of ['l', 'r']) {
    const sx = k === 'l' ? -1 : 1;
    arms[k].position.set(sx * 1.5, 3.9, 0); g.add(arms[k]);
    const a = box(1.0, 2.0, 1.0, skin); a.position.y = -1.0; arms[k].add(a);
  }
  const legs = { l: new THREE.Group(), r: new THREE.Group() };
  for (const k of ['l', 'r']) {
    const sx = k === 'l' ? -1 : 1;
    legs[k].position.set(sx * 0.5, 2.0, 0); g.add(legs[k]);
    const l = box(1.0, 2.0, 1.0, pants); l.position.y = -1.0; legs[k].add(l);
  }
  g.userData = { arms: arms, legs: legs, head: head };
  return g;
}

function makeTSBSet() {
  const g = new THREE.Group();
  const A = ACT_AT.tsb;
  g.position.set(A.x, 0, A.z);

  /* the flat grey sky those maps always have */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(360, 16, 10),
    new THREE.MeshBasicMaterial({ color: 0x6f7f96, side: THREE.BackSide, fog: false }));
  g.add(sky);

  /* the arena: one big studded slab floating in nothing */
  const plat = makePart(64, 3, 64, ROBLOX.grey);
  plat.position.y = -1.5; g.add(plat);
  const trimA = makePart(66, 1.2, 3, ROBLOX.red); trimA.position.set(0, 0.4, 32); g.add(trimA);
  const trimB = makePart(66, 1.2, 3, ROBLOX.red); trimB.position.set(0, 0.4, -32); g.add(trimB);
  /* a few blocky buildings round the edge */
  const cols = [ROBLOX.blue, ROBLOX.yellow, ROBLOX.white, ROBLOX.green, ROBLOX.orange];
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * TAU + 0.3;
    const h = 9 + (k % 4) * 6;
    const b = makePart(8, h, 8, cols[k % cols.length]);
    b.position.set(Math.sin(a) * 42, h / 2, Math.cos(a) * 42); g.add(b);
  }
  /* the ring of spawn pads */
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    const pd = makePart(5, 0.6, 5, k % 2 ? ROBLOX.cyan : ROBLOX.purple);
    pd.position.set(Math.sin(a) * 17, 0.3, Math.cos(a) * 17); g.add(pd);
  }

  /* the pros */
  const NAMES = ['xX_M1Godlike_Xx', 'ComboKing2013', 'oof_enjoyer', 'NoSkillDetected',
                 'BlockyMenace', 'RagdollAndy', 'skibidi_pro'];
  const players = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * TAU;
    const r6 = makeR6({
      shirt: cols[k % cols.length],
      pants: [0x27543f, 0x2b2b33, 0x5b3d22][k % 3],
      skin: 0xf5cd30,
      hat: k % 3 === 0 ? ROBLOX.red : (k % 3 === 1 ? 0x1a1a1a : null)
    });
    r6.position.set(Math.sin(a) * 13, 0, Math.cos(a) * 13);
    r6.rotation.y = -a;
    /* the name tag */
    const sc = cv(256, 40);
    sc.x.fillStyle = 'rgba(0,0,0,0)'; sc.x.clearRect(0, 0, 256, 40);
    sc.x.font = 'bold 21px Arial'; sc.x.textAlign = 'center';
    sc.x.lineWidth = 5; sc.x.strokeStyle = '#000';
    sc.x.strokeText(NAMES[k], 128, 27);
    sc.x.fillStyle = '#f2f2f2'; sc.x.fillText(NAMES[k], 128, 27);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.0),
      new THREE.MeshBasicMaterial({ map: texFrom(sc.c, 1, 1), transparent: true, fog: false }));
    tag.position.y = 7.2; r6.add(tag);
    g.add(r6);
    players.push({ g: r6, tag: tag, a: a, name: NAMES[k], ud: r6.userData });
  }

  /* hit sparks */
  const sparkGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const sparks = new THREE.InstancedMesh(sparkGeo,
    new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), 90);
  const sstate = [];
  for (let k = 0; k < 90; k++) sstate.push({ x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
  sparks.frustumCulled = false;
  g.add(sparks);

  g.visible = false;
  g.userData = { players: players, sparks: sparks, sstate: sstate, D: new THREE.Object3D() };
  return g;
}


/* =========================================================================
   Part 5j — METHOD SIXTEEN: TWENTY-FOUR FRAMES
   The long one. A speed duel staged the way an anime would stage it:
   silence and stillness first, then afterimages, smears, impact frames,
   hit-stop, shockwaves and a floor that does not survive the ending.
   ========================================================================= */

ACT_AT.naoya = { x: 0, z: -520 };

/* ------------------------------------------------------------- the arena */
function makeNaoyaSet() {
  const g = new THREE.Group();
  const A = ACT_AT.naoya;
  g.position.set(A.x, 0, A.z);

  /* --- a heavy red sky with one moon in it --- */
  const skyTex = (function () {
    const W = 512, H = 256, { c, x } = cv(W, H);
    const gr = x.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0.00, '#0a0508');
    gr.addColorStop(0.34, '#1c0a12');
    gr.addColorStop(0.48, '#4a1220');
    gr.addColorStop(0.52, '#7a1e24');
    gr.addColorStop(0.62, '#2a0c14');
    gr.addColorStop(1.00, '#07050a');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    /* torn cloud bands */
    for (let k = 0; k < 40; k++) {
      const y = 40 + Math.random() * 100;
      x.fillStyle = 'rgba(10,4,8,' + (0.2 + Math.random() * 0.4).toFixed(2) + ')';
      x.fillRect(Math.random() * W, y, 40 + Math.random() * 180, 4 + Math.random() * 9);
    }
    /* the moon */
    const mg = x.createRadialGradient(370, 62, 4, 370, 62, 60);
    mg.addColorStop(0, 'rgba(255,236,214,1)');
    mg.addColorStop(0.22, 'rgba(255,180,150,.85)');
    mg.addColorStop(1, 'rgba(200,60,50,0)');
    x.fillStyle = mg; x.fillRect(300, 0, 140, 130);
    x.fillStyle = '#fff0dc';
    x.beginPath(); x.arc(370, 62, 21, 0, Math.PI * 2); x.fill();
    return texFrom(c, 1, 1);
  })();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(420, 22, 14),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }));
  g.add(dome);

  /* --- the floor: dark cracked stone --- */
  const stoneTex = (function () {
    const { c, x } = cv(128, 128);
    x.fillStyle = '#2a2530'; x.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 2200; k++) {
      const v = Math.random();
      x.fillStyle = v < .34 ? '#332d3a' : v < .67 ? '#221d28' : '#3a3342';
      x.fillRect(Math.random() * 128, Math.random() * 128, 4, 4);
    }
    x.strokeStyle = 'rgba(12,8,14,.85)'; x.lineWidth = 2.5;
    for (let k = 0; k < 16; k++) {
      x.beginPath();
      let px = Math.random() * 128, py = Math.random() * 128;
      x.moveTo(px, py);
      for (let j = 0; j < 5; j++) { px += rand(-26, 26); py += rand(-26, 26); x.lineTo(px, py); }
      x.stroke();
    }
    return texFrom(c, 14, 14);
  })();
  const floor = new THREE.Mesh(new THREE.CircleGeometry(80, 40),
    new THREE.MeshLambertMaterial({ map: stoneTex }));
  floor.rotation.x = -Math.PI / 2; g.add(floor);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(80, 1.4, 6, 44),
    new THREE.MeshLambertMaterial({ color: 0x14101a }));
  rim.rotation.x = Math.PI / 2; g.add(rim);

  /* --- rock pillars, for her to be launched through --- */
  const rockM = new THREE.MeshLambertMaterial({ color: 0x322b38, flatShading: true });
  const pillars = [];
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU + 0.25;
    const r = 34 + (k % 3) * 9;
    const h = 16 + (k % 4) * 7;
    const pl = new THREE.Group();
    pl.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
    for (let s = 0; s < 4; s++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(
        3.4 - s * 0.55, 4.2 - s * 0.5, h / 4, 6), rockM);
      seg.position.y = h / 8 + s * (h / 4);
      seg.rotation.y = s * 0.5;
      pl.add(seg);
    }
    g.add(pl);
    pillars.push({ g: pl, x: pl.position.x, z: pl.position.z, alive: true });
  }
  /* torii gates on the far side, for silhouette */
  for (const [tx, tz, ts] of [[-52, -58, 1.4], [50, -62, 1.2], [0, -74, 1.7]]) {
    const t = new THREE.Group();
    const pM = new THREE.MeshLambertMaterial({ color: 0x5a1420 });
    for (const sx of [-1, 1]) {
      const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 18, 7), pM);
      p2.position.set(sx * 6, 9, 0); t.add(p2);
    }
    const top = box(17, 1.3, 1.6, pM); top.position.y = 18.2; t.add(top);
    const top2 = box(19, 1.0, 2.0, pM); top2.position.y = 19.4; t.add(top2);
    t.position.set(tx, 0, tz); t.scale.setScalar(ts); g.add(t);
  }
  /* distant mountain silhouette */
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * TAU;
    const h2 = 40 + ((k * 7) % 5) * 22;
    const m = new THREE.Mesh(new THREE.ConeGeometry(28 + (k % 3) * 10, h2, 4),
      new THREE.MeshLambertMaterial({ color: 0x120c16, fog: false }));
    m.position.set(Math.sin(a) * 210, h2 / 2 - 14, Math.cos(a) * 210);
    m.rotation.y = k; g.add(m);
  }

  /* --- lights: one hard red key from behind, almost no fill --- */
  const key = new THREE.DirectionalLight(0xff5a3c, 1.15);
  key.position.set(0.35, 0.55, -1); g.add(key);
  const fill = new THREE.DirectionalLight(0x5a6a9a, 0.30);
  fill.position.set(-0.6, 0.4, 0.8); g.add(fill);
  const moonGlow = new THREE.PointLight(0xff7a4a, 1.1, 200, 1.5);
  moonGlow.position.set(60, 70, -140); g.add(moonGlow);

  /* --- mist --- */
  const mist = [];
  for (let k = 0; k < 8; k++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 26),
      new THREE.MeshBasicMaterial({ color: 0x40203a, transparent: true, opacity: 0.10,
        depthWrite: false, fog: false }));
    m.position.set(rand(-40, 40), rand(1.5, 12), rand(-40, 40));
    g.add(m); mist.push(m);
  }

  /* --- shockwave rings, ground cracks and a dust dome, all pre-made --- */
  const waves = [];
  for (let k = 0; k < 4; k++) {
    const w = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 44),
      new THREE.MeshBasicMaterial({ color: 0xffe6c8, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false, fog: false }));
    w.rotation.x = -Math.PI / 2; w.visible = false; g.add(w);
    waves.push({ m: w, t: -1, x: 0, z: 0, y: 0.2, spd: 55, life: 1.1 });
  }
  /* a spherical blast, for the big one */
  const blast = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff0d8, transparent: true, opacity: 0,
      depthWrite: false, fog: false, side: THREE.BackSide }));
  blast.visible = false; g.add(blast);

  const crackTex = (function () {
    const { c, x } = cv(128, 128);
    x.clearRect(0, 0, 128, 128);
    x.strokeStyle = 'rgba(8,4,10,.95)'; x.lineCap = 'round';
    for (let k = 0; k < 11; k++) {
      const a = (k / 11) * TAU + rand(-0.2, 0.2);
      let px = 64, py = 64, aa = a;
      x.lineWidth = 5;
      x.beginPath(); x.moveTo(px, py);
      for (let j = 0; j < 5; j++) {
        aa += rand(-0.5, 0.5);
        px += Math.cos(aa) * 13; py += Math.sin(aa) * 13;
        x.lineTo(px, py);
      }
      x.stroke();
    }
    return texFrom(c, 1, 1);
  })();
  const cracks = [];
  for (let k = 0; k < 6; k++) {
    const c2 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, opacity: 0,
        depthWrite: false }));
    c2.rotation.x = -Math.PI / 2; c2.visible = false; g.add(c2);
    cracks.push(c2);
  }

  /* --- the speed tunnel: streaks that wrap the camera on a dash --- */
  const tunTex = (function () {
    const W = 256, H = 64, { c, x } = cv(W, H);
    x.clearRect(0, 0, W, H);
    for (let k = 0; k < 150; k++) {
      const y = Math.random() * H;
      const a = 0.10 + Math.random() * 0.55;
      x.fillStyle = 'rgba(255,235,225,' + a.toFixed(2) + ')';
      x.fillRect(Math.random() * W, y, 12 + Math.random() * 90, 1 + Math.random() * 2);
    }
    return texFrom(c, 3, 1);
  })();
  const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 90, 22, 1, true),
    new THREE.MeshBasicMaterial({ map: tunTex, transparent: true, opacity: 0,
      side: THREE.BackSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  tunnel.visible = false; g.add(tunnel);

  g.visible = false;
  g.userData = { pillars: pillars, waves: waves, blast: blast, cracks: cracks,
                 mist: mist, tunnel: tunnel, key: key, fill: fill, moonGlow: moonGlow };
  return g;
}

/* ------------------------------------------------ the black haori
   Worn over the shirt for this one fight. */
function makeHaori() {
  const g = new THREE.Group();
  const black = new THREE.MeshLambertMaterial({ color: 0x14121a });
  const trim = new THREE.MeshLambertMaterial({ color: 0x6a1520 });
  const back = box(1.62, 2.55, 0.20, black); back.position.set(0, 1.15, -0.52); g.add(back);
  for (const sx of [-1, 1]) {
    const panel = box(0.62, 2.55, 0.20, black);
    panel.position.set(sx * 0.48, 1.15, 0.50); g.add(panel);
    const side = box(0.20, 2.55, 1.0, black);
    side.position.set(sx * 0.80, 1.15, 0); g.add(side);
    /* the wide sleeve */
    const sleeve = box(0.70, 1.55, 0.80, black);
    sleeve.position.set(sx * 1.05, 1.55, 0); g.add(sleeve);
    const hem2 = box(0.72, 0.20, 0.82, trim);
    hem2.position.set(sx * 1.05, 0.80, 0); g.add(hem2);
  }
  const collar = box(1.70, 0.30, 1.10, trim); collar.position.set(0, 2.42, 0); g.add(collar);
  const hem = box(1.66, 0.24, 1.06, trim); hem.position.set(0, -0.10, 0); g.add(hem);
  /* the tail, which will flutter */
  const tail = new THREE.Group(); tail.position.set(0, -0.05, -0.52); g.add(tail);
  const flap = box(1.62, 1.55, 0.16, black); flap.position.y = -0.75; tail.add(flap);
  g.userData = { tail: tail };
  return g;
}

/* ------------------------------------------------- afterimage clones
   The real model, duplicated, flattened to one flat colour and posed from a
   ring buffer of where he was a few frames ago. */
function makeAfterimages(model, n, colour) {
  const ghosts = [];
  /* flat and translucent rather than additive — eight additive copies of a
     whole man stack up into a white blob */
  const mat = new THREE.MeshBasicMaterial({
    color: colour === undefined ? 0x8fd8ff : colour,
    transparent: true, opacity: 0.18, depthWrite: false, fog: false
  });
  const srcNodes = [];
  model.root.traverse(o => srcNodes.push(o));
  for (let k = 0; k < n; k++) {
    const c = model.root.clone(true);
    const nodes = [];
    c.traverse(o => { nodes.push(o); if (o.isMesh) o.material = mat; });
    c.visible = false;
    ghosts.push({ g: c, nodes: nodes, mat: mat });
  }
  return { ghosts: ghosts, srcNodes: srcNodes, mat: mat, hist: [], head: 0 };
}
/* remember where he is now */
function pushGhostFrame(rig) {
  const f = [];
  for (const o of rig.srcNodes) {
    f.push(o.position.x, o.position.y, o.position.z,
           o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w,
           o.scale.x, o.scale.y, o.scale.z);
  }
  rig.hist.push(f);
  if (rig.hist.length > 40) rig.hist.shift();
}
/* and put the ghosts where he was */
function poseGhosts(rig, spacing, alpha) {
  const H = rig.hist.length;
  rig.ghosts.forEach((gh, i) => {
    const idx = H - 1 - (i + 1) * spacing;
    if (idx < 0 || alpha <= 0.01) { gh.g.visible = false; return; }
    gh.g.visible = true;
    const f = rig.hist[idx];
    const N2 = gh.nodes.length;
    for (let k = 0; k < N2; k++) {
      const o = gh.nodes[k], b = k * 10;
      o.position.set(f[b], f[b + 1], f[b + 2]);
      o.quaternion.set(f[b + 3], f[b + 4], f[b + 5], f[b + 6]);
      o.scale.set(f[b + 7], f[b + 8], f[b + 9]);
    }
  });
  rig.mat.opacity = alpha;
}


/* =========================================================================
   Part 5k — BONUS: BALDI GOES HOME
   The epilogue.  A night exterior, a dark hall with a light switch, and the
   bedroom where the three anime girls he adopted have got at his marking.
   Everything lives in one group parked far away from the dance floor, and
   the camera cuts to it the way it cuts to every other set-piece.
   ========================================================================= */

ACT_AT.home = { x: 420, z: -420 };

/* -------------------------------------------------------- the doodled page
   His worksheet, ruined.  Drawn twice the size it needs to be so the insert
   shot holds up when the camera is right on top of it. */
function drawDoodlePage(c) {
  const W = c.width, H = c.height, x = c.getContext('2d');
  const S = W / 1024;                                  // everything scales off this
  x.save(); x.scale(S, S);
  const w = 1024, h = 1024 * (H / W) / S * S / (W / 1024) / 1;
  const ph = H / S;

  /* --- paper --- */
  x.fillStyle = '#fbf6e4'; x.fillRect(0, 0, w, ph);
  const grime = x.createLinearGradient(0, 0, w, ph);
  grime.addColorStop(0, 'rgba(190,170,120,.10)');
  grime.addColorStop(0.5, 'rgba(255,255,255,0)');
  grime.addColorStop(1, 'rgba(170,150,110,.16)');
  x.fillStyle = grime; x.fillRect(0, 0, w, ph);
  /* ruled lines and a red margin */
  x.strokeStyle = 'rgba(120,150,190,.42)'; x.lineWidth = 2;
  for (let y = 120; y < ph - 30; y += 52) {
    x.beginPath(); x.moveTo(58, y); x.lineTo(w - 44, y); x.stroke();
  }
  x.strokeStyle = 'rgba(210,90,90,.55)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(96, 24); x.lineTo(96, ph - 24); x.stroke();
  /* punch holes */
  x.fillStyle = '#e6dfc8';
  for (const y of [180, ph / 2, ph - 180]) {
    x.beginPath(); x.arc(30, y, 13, 0, Math.PI * 2); x.fill();
  }

  /* --- the worksheet underneath --- */
  x.fillStyle = '#2c3242';
  x.font = 'bold 40px Georgia, "Times New Roman", serif';
  x.fillText('MATHEMATICS  —  SET B', 118, 78);
  x.font = '26px Georgia, serif';
  x.fillStyle = '#5a6072';
  x.fillText('Name: ______________________          Marks:  /20', 118, 108);

  const sums = [
    ['1.  14 × 6  =', '84'], ['2.  91 ÷ 7  =', '13'],
    ['3.  38 + 47 =', '85'], ['4.  120 − 66 =', '54'],
    ['5.  9 × 9  =', '81'],  ['6.  144 ÷ 12 =', '12'],
    ['7.  25 × 4  =', '100'], ['8.  17 + 28 =', '45']
  ];
  x.font = '30px Georgia, serif';
  for (let i = 0; i < sums.length; i++) {
    const col = i % 2, row = (i / 2) | 0;
    const px = 128 + col * 430, py = 196 + row * 104;
    x.fillStyle = '#2c3242';
    x.fillText(sums[i][0], px, py);
    x.fillStyle = '#1a3f8a';                            // the pupil's answer
    x.font = '30px "Comic Sans MS", "Segoe Print", cursive';
    x.fillText(sums[i][1], px + 250, py + 2);
    x.font = '30px Georgia, serif';
  }

  /* ================= and now the vandalism ================= */
  const PINK = '#ff5d86', PINK2 = '#ff90ae', PEN = '#d4356b';

  /* the enormous heart, right across the middle of the page */
  x.save();
  x.translate(w * 0.52, ph * 0.54);
  x.rotate(-0.06);
  const HS = Math.min(w, ph) * 0.00046;
  x.scale(HS * 620, HS * 620);
  const heart = () => {
    x.beginPath();
    x.moveTo(0, 0.42);
    x.bezierCurveTo(-0.98, -0.28, -0.52, -1.02, 0, -0.52);
    x.bezierCurveTo(0.52, -1.02, 0.98, -0.28, 0, 0.42);
    x.closePath();
  };
  x.globalAlpha = 0.30; x.fillStyle = PINK2; heart(); x.fill();
  x.globalAlpha = 1;
  x.strokeStyle = PINK; x.lineWidth = 0.055; x.lineJoin = 'round';
  heart(); x.stroke();
  /* gone over twice, the way a child does */
  x.save(); x.translate(0.012, -0.014); x.rotate(0.012);
  x.globalAlpha = 0.7; x.lineWidth = 0.035; heart(); x.stroke();
  x.restore();
  x.globalAlpha = 1;
  x.restore();

  /* the Japanese, big, straight through the sums.  A font stack rather than
     one name — every desktop has *something* with kana in it. */
  const JP = '"Yu Gothic", "Hiragino Maru Gothic ProN", "Hiragino Kaku Gothic ProN", ' +
             '"Noto Sans CJK JP", "Noto Sans JP", "MS Gothic", sans-serif';
  x.save();
  x.translate(w * 0.50, ph * 0.40);
  x.rotate(-0.055);
  x.textAlign = 'center';
  x.font = 'bold 96px ' + JP;
  x.lineWidth = 11; x.lineJoin = 'round';
  x.strokeStyle = '#fff4f7'; x.strokeText('バルディせんせい', 0, 0);
  x.fillStyle = PEN;        x.fillText('バルディせんせい', 0, 0);
  x.font = 'bold 116px ' + JP;
  x.strokeStyle = '#fff4f7'; x.strokeText('だいすき ♡', 0, 132);
  x.fillStyle = PINK;        x.fillText('だいすき ♡', 0, 132);
  /* the translation, in case a machine somewhere has no kana at all */
  x.font = 'italic 34px Georgia, serif';
  x.fillStyle = 'rgba(212,53,107,.85)';
  x.fillText('( baldi-sensei  daisuki )', 0, 186);
  x.restore();

  /* little hearts scattered over the marking */
  x.fillStyle = PINK2;
  const spots = [[150, 300], [880, 250], [210, 700], [900, 640], [520, 830],
                 [320, 180], [760, 760], [110, 470], [940, 420]];
  for (let i = 0; i < spots.length; i++) {
    const [sx, sy] = spots[i], sc = 16 + (i % 3) * 7;
    x.save(); x.translate(sx, sy * (ph / 1024)); x.rotate((i % 5 - 2) * 0.2); x.scale(sc, sc);
    x.globalAlpha = 0.55 + (i % 3) * 0.15;
    heart(); x.fill();
    x.restore();
  }
  x.globalAlpha = 1;

  /* a cat, and a chibi of Baldi with a bow on his head */
  const doodle = (cx, cy, sc, cat) => {
    x.save(); x.translate(cx, cy * (ph / 1024)); x.scale(sc, sc);
    x.strokeStyle = PEN; x.lineWidth = 4 / sc * 6; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.arc(0, 0, 28, 0, Math.PI * 2); x.stroke();          // head
    if (cat) {                                                           // ears
      x.beginPath(); x.moveTo(-22, -18); x.lineTo(-26, -40); x.lineTo(-6, -26); x.stroke();
      x.beginPath(); x.moveTo(22, -18); x.lineTo(26, -40); x.lineTo(6, -26); x.stroke();
    } else {                                                             // a bow
      x.beginPath(); x.moveTo(-14, -26); x.lineTo(-2, -34); x.lineTo(-14, -42); x.closePath(); x.stroke();
      x.beginPath(); x.moveTo(14, -26); x.lineTo(2, -34); x.lineTo(14, -42); x.closePath(); x.stroke();
    }
    x.beginPath(); x.arc(-10, -4, 3.6, 0, Math.PI * 2); x.fillStyle = PEN; x.fill();
    x.beginPath(); x.arc(10, -4, 3.6, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(0, 6, 10, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
    if (cat) {
      for (const s of [-1, 1]) {
        x.beginPath(); x.moveTo(s * 16, 2); x.lineTo(s * 40, -4); x.stroke();
        x.beginPath(); x.moveTo(s * 16, 8); x.lineTo(s * 40, 12); x.stroke();
      }
    }
    x.restore();
  };
  doodle(200, 900, 1.5, true);
  doodle(860, 900, 1.5, false);

  /* one sum crossed out and "corrected" */
  x.strokeStyle = PEN; x.lineWidth = 7; x.lineCap = 'round';
  x.beginPath(); x.moveTo(560, 190); x.lineTo(880, 214); x.stroke();
  x.font = 'bold 44px "Comic Sans MS", "Segoe Print", cursive';
  x.fillStyle = PINK; x.fillText('= ♡♡♡', 600, 168);
  /* and a score she has awarded herself */
  x.save(); x.translate(w - 190, 96); x.rotate(0.22);
  x.font = 'bold 62px ' + JP;
  x.strokeStyle = '#fff4f7'; x.lineWidth = 10; x.strokeText('１００てん!', -60, 0);
  x.fillStyle = PINK; x.fillText('１００てん!', -60, 0);
  x.restore();

  x.restore();
}

/* --------------------------------------------------------------- the set */
function makeHomeSet() {
  const g = new THREE.Group();
  const A = ACT_AT.home;
  g.position.set(A.x, 0, A.z);
  const U = { };
  g.userData = U;

  const M = (c, o) => Object.assign(new THREE.MeshLambertMaterial({ color: c }), o || {});
  const B = (c) => new THREE.MeshBasicMaterial({ color: c });

  const WOOD  = M(0x6b4a2f), WOOD2 = M(0x8a6440), FLOOR = M(0x9a7247);
  const WALL  = M(0xd8cfae), WALL2 = M(0xbfae8a), TRIM = M(0xf2ead6);
  const GRASS = M(0x28401f), PATH = M(0x6a6458), ROOF = M(0x4a2c26);
  const DARKM = M(0x1c1a20);

  /* ================= night sky and garden ================= */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(240, 18, 12), (function () {
    const { c, x } = cv(8, 128);
    const gr = x.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#070a1c'); gr.addColorStop(0.55, '#101a3c'); gr.addColorStop(1, '#2a2444');
    x.fillStyle = gr; x.fillRect(0, 0, 8, 128);
    return new THREE.MeshBasicMaterial({ map: texFrom(c, 1, 1), side: THREE.BackSide, fog: false });
  })());
  g.add(sky);

  const stars = new THREE.Points(
    (function () {
      const gm = new THREE.BufferGeometry(), P = [];
      for (let i = 0; i < 260; i++) {
        const a = rand(0, TAU), b = rand(0.06, 1.15), r = 210;
        P.push(Math.cos(a) * Math.cos(b) * r, Math.abs(Math.sin(b)) * r + 20, Math.sin(a) * Math.cos(b) * r);
      }
      gm.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      return gm;
    })(),
    new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.5, sizeAttenuation: false, fog: false }));
  g.add(stars);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 22), B(0xf4f0dc));
  moon.position.set(-70, 74, -150); moon.material.fog = false; g.add(moon);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), GRASS);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.02, 20); g.add(ground);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 26), PATH);
  path.rotation.x = -Math.PI / 2; path.position.set(0, 0.02, 27); g.add(path);
  for (let i = 0; i < 8; i++) {                          // paving joints
    const j = box(5.2, 0.02, 0.16, M(0x4c483e));
    j.position.set(0, 0.04, 15 + i * 3.2); g.add(j);
  }
  /* bushes and a couple of trees so the garden is not a bald plane */
  for (let i = 0; i < 14; i++) {
    const bs = sph(rand(0.9, 1.7), M(0x1d3318), 1, 0.8, 1, 6);
    bs.position.set(rand(-24, 24) + (i % 2 ? 8 : -8), 0.6, rand(16, 40)); g.add(bs);
  }
  for (const tx of [-19, 20]) {
    const tr = box(1.1, 9, 1.1, M(0x2a1c14)); tr.position.set(tx, 4.5, 30); g.add(tr);
    const cn = new THREE.Mesh(new THREE.ConeGeometry(4.6, 9, 6), M(0x182c14));
    cn.position.set(tx, 12, 30); g.add(cn);
  }

  /* ================= the house shell ================= */
  /* facade at z = 14, hall runs back to z = -4, bedroom back to z = -28 */
  const FAC = 14;
  const facade = box(26, 15, 0.6, M(0xb8a37e)); facade.position.set(0, 7.5, FAC); g.add(facade);
  const roofM = new THREE.Mesh(new THREE.ConeGeometry(20, 7, 4), ROOF);
  roofM.position.set(0, 18.4, 0); roofM.rotation.y = Math.PI / 4; roofM.scale.set(1, 1, 2.1); g.add(roofM);
  /* outer side walls, so the roof has something to sit on from outside */
  for (const sx of [-13, 13]) {
    const sw = box(0.6, 15, 44, M(0xa8946f)); sw.position.set(sx, 7.5, -8); g.add(sw);
  }
  /* two lit windows on the front, and a dark one */
  for (const wx of [-8.4, 8.4]) {
    const fr = box(4.2, 3.4, 0.3, TRIM); fr.position.set(wx, 8.4, FAC - 0.4); g.add(fr);
    const pane = box(3.5, 2.7, 0.2, B(0x141a2e)); pane.position.set(wx, 8.4, FAC - 0.6); g.add(pane);
    const bar1 = box(0.16, 2.7, 0.24, TRIM); bar1.position.set(wx, 8.4, FAC - 0.7); g.add(bar1);
  }

  /* --- the porch --- */
  const porch = box(11, 0.5, 5, M(0x7a5a3c)); porch.position.set(0, 0.25, FAC + 2.6); g.add(porch);
  for (const px of [-4.6, 4.6]) {
    const post = box(0.55, 6.4, 0.55, TRIM); post.position.set(px, 3.7, FAC + 4.6); g.add(post);
  }
  const canopy = box(11.6, 0.45, 6, ROOF); canopy.position.set(0, 7.1, FAC + 2.4); g.add(canopy);
  const mat0 = box(3.2, 0.08, 1.7, M(0x4a3b2c)); mat0.position.set(0, 0.54, FAC + 2.2); g.add(mat0);

  /* the porch light, off at first */
  const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.9, 8), M(0x2b2620));
  lampShade.position.set(0, 6.5, FAC + 1.2); g.add(lampShade);
  const porchBulb = sph(0.32, B(0x3a3428), 1, 1, 1, 8);
  porchBulb.position.set(0, 6.1, FAC + 1.2); g.add(porchBulb);
  const porchLight = new THREE.PointLight(0xffd8a0, 0, 13, 2);
  porchLight.position.set(0, 6.0, FAC + 1.4); g.add(porchLight);
  U.porchBulb = porchBulb; U.porchLight = porchLight;

  /* --- the front door, on a hinge group --- */
  const doorH = new THREE.Group(); doorH.position.set(-1.8, 0, FAC - 0.05); g.add(doorH);
  const doorPanel = box(3.6, 7.2, 0.28, WOOD);
  doorPanel.position.set(1.8, 3.6, 0); doorH.add(doorPanel);
  for (const py of [2.0, 5.2]) {                       // recessed panels
    const pn = box(2.3, 2.2, 0.10, WOOD2); pn.position.set(1.8, py, 0.18); doorH.add(pn);
  }
  const knob = sph(0.20, M(0xd8b258), 1, 1, 1, 8); knob.position.set(3.2, 3.5, 0.30); doorH.add(knob);
  const frame = box(4.4, 7.8, 0.4, TRIM); frame.position.set(0, 3.9, FAC - 0.4);
  const frameCut = box(3.7, 7.3, 0.6, DARKM); frameCut.position.set(0, 3.6, FAC - 0.35);
  g.add(frame); g.add(frameCut);
  U.door = doorH;

  /* ================= the hall ================= */
  const hall = new THREE.Group(); g.add(hall); U.hall = hall;
  const hFloor = new THREE.Mesh(new THREE.PlaneGeometry(11, 18), FLOOR);
  hFloor.rotation.x = -Math.PI / 2; hFloor.position.set(0, 0, 5); hall.add(hFloor);
  for (let i = 0; i < 9; i++) {                          // floorboards
    const bd = box(11, 0.02, 0.06, M(0x7a5836)); bd.position.set(0, 0.03, -3.6 + i * 2.1); hall.add(bd);
  }
  const rug = box(4.4, 0.06, 7, M(0x7a2f34)); rug.position.set(0, 0.06, 6); hall.add(rug);
  const rug2 = box(3.5, 0.07, 6, M(0x8f4046)); rug2.position.set(0, 0.08, 6); hall.add(rug2);
  for (const sx of [-5.5, 5.5]) {
    const hw = box(0.4, 11, 18, WALL); hw.position.set(sx, 5.5, 5); hall.add(hw);
    const sk = box(0.5, 0.7, 18, TRIM); sk.position.set(sx, 0.35, 5); hall.add(sk);
    const dado = box(0.5, 0.14, 18, WALL2); dado.position.set(sx, 3.6, 5); hall.add(dado);
  }
  const hCeil = box(11.4, 0.4, 18, M(0xe8e0c8)); hCeil.position.set(0, 11, 5); hall.add(hCeil);

  /* the back wall of the hall, with the bedroom doorway in it */
  const BW = -4;
  for (const [bx, bw] of [[-4.0, 3.0], [4.0, 3.0]]) {
    const bwm = box(bw, 11, 0.4, WALL); bwm.position.set(bx, 5.5, BW); hall.add(bwm);
  }
  const lintel = box(11, 3.2, 0.4, WALL); lintel.position.set(0, 9.4, BW); hall.add(lintel);
  const bFrame = box(6.0, 8.4, 0.5, TRIM); bFrame.position.set(0, 4.0, BW + 0.1);
  const bFrameCut = box(5.2, 8.0, 0.7, DARKM); bFrameCut.position.set(0, 3.9, BW + 0.05);
  hall.add(bFrame); hall.add(bFrameCut);

  /* the bedroom door itself */
  const bdoorH = new THREE.Group(); bdoorH.position.set(-2.5, 0, BW - 0.1); hall.add(bdoorH);
  const bdoor = box(5.0, 7.9, 0.24, WOOD2); bdoor.position.set(2.5, 3.95, 0); bdoorH.add(bdoor);
  const bknob = sph(0.18, M(0xd8b258), 1, 1, 1, 8); bknob.position.set(4.5, 3.7, 0.22); bdoorH.add(bknob);
  /* a hand-lettered sign, because of course there is one */
  const sign = box(1.9, 0.9, 0.06, (function () {
    const { c, x } = cv(128, 64);
    x.fillStyle = '#f6efd8'; x.fillRect(0, 0, 128, 64);
    x.fillStyle = '#2b2a30'; x.font = 'bold 20px Georgia, serif'; x.textAlign = 'center';
    x.fillText('BALDI', 64, 28); x.fillText('ONLY', 64, 50);
    return new THREE.MeshLambertMaterial({ map: texFrom(c, 1, 1) });
  })());
  sign.position.set(2.5, 5.9, 0.16); bdoorH.add(sign);
  U.bdoor = bdoorH;

  /* the light switch, on the right-hand wall just inside the front door */
  const swPlate = box(0.12, 1.0, 0.7, TRIM); swPlate.position.set(5.2, 4.2, 11.2); hall.add(swPlate);
  const swLever = box(0.16, 0.42, 0.26, M(0xe6e0cc)); swLever.position.set(5.05, 4.32, 11.2); hall.add(swLever);
  U.swLever = swLever;

  /* hall ceiling lamp */
  const hCord = box(0.06, 1.4, 0.06, DARKM); hCord.position.set(0, 10.2, 6); hall.add(hCord);
  const hShade = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.5, 12, 1, true), M(0xe8dcc0));
  hShade.position.set(0, 9.2, 6); hShade.material.side = THREE.DoubleSide; hall.add(hShade);
  const hBulb = sph(0.42, B(0x3a3830), 1, 1, 1, 8); hBulb.position.set(0, 8.9, 6); hall.add(hBulb);
  const hLight = new THREE.PointLight(0xffe6bc, 0, 30, 2); hLight.position.set(0, 8.6, 6); hall.add(hLight);
  U.hallBulb = hBulb; U.hallLight = hLight;

  /* hall dressing */
  const rack = box(2.6, 0.2, 0.3, WOOD); rack.position.set(-5.1, 6.2, 8); rack.rotation.y = Math.PI / 2; hall.add(rack);
  for (let i = 0; i < 3; i++) {
    const coat = box(1.3, 3.0, 0.5, M([0x2e5a3a, 0x4a3a6a, 0x6a3a3a][i]));
    coat.position.set(-4.6, 4.5, 7 + i * 1.1); hall.add(coat);
  }
  const frame2 = box(0.12, 2.2, 1.7, TRIM); frame2.position.set(5.15, 6.6, 6.5); hall.add(frame2);
  const photo = box(0.06, 1.8, 1.3, (function () {
    const { c, x } = cv(96, 128);
    x.fillStyle = '#8fa8c8'; x.fillRect(0, 0, 96, 128);
    x.fillStyle = '#3d5a2c'; x.fillRect(0, 90, 96, 38);
    x.fillStyle = '#2f7a3a'; x.beginPath(); x.ellipse(48, 62, 22, 28, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#e8cba4'; x.beginPath(); x.ellipse(48, 34, 15, 16, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#2b2a30';
    x.beginPath(); x.arc(42, 32, 3, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(54, 32, 3, 0, Math.PI * 2); x.fill();
    return new THREE.MeshLambertMaterial({ map: texFrom(c, 1, 1) });
  })());
  photo.position.set(5.08, 6.6, 6.5); hall.add(photo);

  /* ================= the bedroom ================= */
  const room = new THREE.Group(); g.add(room); U.room = room;
  const RZ0 = -4, RZ1 = -30, RX = 11;
  const rFloor = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, RZ0 - RZ1), M(0x8a6a42));
  rFloor.rotation.x = -Math.PI / 2; rFloor.position.set(0, 0, (RZ0 + RZ1) / 2); room.add(rFloor);
  for (let i = 0; i < 13; i++) {
    const bd = box(RX * 2, 0.02, 0.06, M(0x6e5232)); bd.position.set(0, 0.03, RZ0 - 1 - i * 2); room.add(bd);
  }
  const rWallM = M(0xc8d6d8);
  for (const sx of [-RX, RX]) {
    const w2 = box(0.4, 12, RZ0 - RZ1, rWallM); w2.position.set(sx, 6, (RZ0 + RZ1) / 2); room.add(w2);
    const sk = box(0.5, 0.8, RZ0 - RZ1, TRIM); sk.position.set(sx, 0.4, (RZ0 + RZ1) / 2); room.add(sk);
  }
  const backW = box(RX * 2, 12, 0.4, rWallM); backW.position.set(0, 6, RZ1); room.add(backW);
  const bSk = box(RX * 2, 0.8, 0.5, TRIM); bSk.position.set(0, 0.4, RZ1 + 0.1); room.add(bSk);
  const rCeil = box(RX * 2 + 0.4, 0.4, RZ0 - RZ1, M(0xeceadc));
  rCeil.position.set(0, 12, (RZ0 + RZ1) / 2); room.add(rCeil);
  /* the front wall of the bedroom, either side of the doorway */
  for (const [bx, bw] of [[-8, 6], [8, 6]]) {
    const fw = box(bw, 12, 0.4, rWallM); fw.position.set(bx, 6, RZ0); room.add(fw);
  }
  const fLint = box(RX * 2, 3.6, 0.4, rWallM); fLint.position.set(0, 10.2, RZ0); room.add(fLint);

  /* window onto the night */
  const winFr = box(0.3, 5.0, 6.0, TRIM); winFr.position.set(-RX + 0.3, 7.0, -14); room.add(winFr);
  const winPane = box(0.16, 4.3, 5.3, B(0x0d1330)); winPane.position.set(-RX + 0.45, 7.0, -14); room.add(winPane);
  const winBar = box(0.2, 4.3, 0.18, TRIM); winBar.position.set(-RX + 0.5, 7.0, -14); room.add(winBar);
  const winBar2 = box(0.2, 0.18, 5.3, TRIM); winBar2.position.set(-RX + 0.5, 7.0, -14); room.add(winBar2);

  /* the multiplication chart on the wall, because it is his bedroom */
  const chart = box(0.08, 5.0, 6.5, (function () {
    const { c, x } = cv(128, 100);
    x.fillStyle = '#f4f0e0'; x.fillRect(0, 0, 128, 100);
    x.strokeStyle = '#8a8676'; x.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      x.beginPath(); x.moveTo(8 + i * 11, 6); x.lineTo(8 + i * 11, 94); x.stroke();
      x.beginPath(); x.moveTo(8, 6 + i * 8.8); x.lineTo(118, 6 + i * 8.8); x.stroke();
    }
    x.fillStyle = '#2f3a5a'; x.font = '7px Georgia, serif'; x.textAlign = 'center';
    for (let r2 = 0; r2 < 10; r2++) for (let c2 = 0; c2 < 10; c2++)
      x.fillText(String((r2 + 1) * (c2 + 1)), 13.5 + c2 * 11, 17 + r2 * 8.8);
    return new THREE.MeshLambertMaterial({ map: texFrom(c, 1, 1) });
  })());
  chart.position.set(RX - 0.3, 7.4, -16); room.add(chart);

  /* --- the bed --- */
  const bedG = new THREE.Group(); bedG.position.set(-6.6, 0, -25); room.add(bedG);
  const bedFr = box(6.4, 1.4, 9.6, WOOD); bedFr.position.set(0, 0.9, 0); bedG.add(bedFr);
  const mattress = box(6.0, 1.1, 9.2, M(0xe8e2d2)); mattress.position.set(0, 2.1, 0); bedG.add(mattress);
  const duvet = box(6.2, 0.7, 6.6, M(0x3f6f8a)); duvet.position.set(0, 2.85, -1.2); bedG.add(duvet);
  const pillow = box(4.4, 0.8, 1.9, M(0xf6f2e4)); pillow.position.set(0, 2.95, 3.4); bedG.add(pillow);
  const headB = box(6.6, 3.6, 0.5, WOOD2); headB.position.set(0, 2.4, 4.9); bedG.add(headB);

  /* --- the bookshelf --- */
  const shelfG = new THREE.Group(); shelfG.position.set(RX - 1.4, 0, -25); room.add(shelfG);
  const shCase = box(1.6, 9, 6.4, WOOD); shCase.position.set(0, 4.5, 0); shelfG.add(shCase);
  const BOOKC = [0x8a3b3b, 0x2f5a7a, 0x6a5a2f, 0x3f6b3f, 0x5a3f6b, 0x7a4a2f];
  for (let s2 = 0; s2 < 4; s2++) {
    const pl = box(1.5, 0.16, 6.2, WOOD2); pl.position.set(-0.05, 1.6 + s2 * 2.1, 0); shelfG.add(pl);
    let z2 = -2.8;
    while (z2 < 2.7) {
      const bw = rand(0.22, 0.46), bh = rand(1.2, 1.7);
      const bk = box(1.0, bh, bw, M(BOOKC[randi(0, 5)]));
      bk.position.set(-0.1, 1.68 + s2 * 2.1 + bh / 2, z2 + bw / 2);
      bk.rotation.x = Math.random() < 0.12 ? 0.3 : 0;
      shelfG.add(bk); z2 += bw + 0.04;
    }
  }

  /* --- the desk: clean, which is the entire joke --- */
  const deskG = new THREE.Group(); deskG.position.set(0.5, 0, -21.5); room.add(deskG);
  const top = box(9.0, 0.4, 4.4, WOOD2); top.position.set(0, 3.0, 0); deskG.add(top);
  const lip = box(9.0, 0.25, 0.2, WOOD); lip.position.set(0, 2.8, 2.2); deskG.add(lip);
  for (const dx of [-4.0, 4.0]) for (const dz of [-1.7, 1.7]) {
    const lg = box(0.4, 3.0, 0.4, WOOD); lg.position.set(dx, 1.5, dz); deskG.add(lg);
  }
  const drawer = box(3.0, 1.9, 3.8, WOOD); drawer.position.set(3.0, 1.85, 0); deskG.add(drawer);
  for (const dy of [1.3, 2.4]) {
    const dh = box(0.9, 0.14, 0.2, M(0xd8b258)); dh.position.set(3.0, dy, 1.95); deskG.add(dh);
  }
  /* a tidy stack of marked worksheets, a mug of pencils, a desk lamp */
  const stack = box(2.2, 0.5, 2.8, M(0xf4efdd)); stack.position.set(-3.2, 3.45, 0); deskG.add(stack);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 1.0, 10), M(0x3f6f8a));
  mug.position.set(-1.5, 3.7, -1.2); deskG.add(mug);
  for (let i = 0; i < 5; i++) {
    const pc = box(0.13, 1.6, 0.13, M([0xd8b23a, 0x3a8ad8, 0xd83a5a, 0x3ad86a, 0xd8763a][i]));
    pc.position.set(-1.5 + (i - 2) * 0.13, 4.4, -1.2 + (i % 2) * 0.12);
    pc.rotation.z = (i - 2) * 0.09; deskG.add(pc);
  }
  const lampArm = box(0.16, 2.6, 0.16, M(0x2f3a44)); lampArm.position.set(3.6, 4.3, -1.4); deskG.add(lampArm);
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.2, 10), M(0x2f3a44));
  lampBase.position.set(3.6, 3.3, -1.4); deskG.add(lampBase);
  const lampHd = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.0, 10, 1, true), M(0x38434e));
  lampHd.material.side = THREE.DoubleSide;
  lampHd.position.set(3.2, 5.4, -1.0); lampHd.rotation.z = 0.7; deskG.add(lampHd);

  /* --- the chair, one of them, for three of them --- */
  const chairG = new THREE.Group(); chairG.position.set(0.5, 0, -24.6); room.add(chairG);
  const seat = box(3.2, 0.35, 3.0, WOOD2); seat.position.set(0, 2.2, 0); chairG.add(seat);
  const bk2 = box(3.2, 3.4, 0.3, WOOD2); bk2.position.set(0, 3.8, -1.35); chairG.add(bk2);
  for (const cx2 of [-1.3, 1.3]) for (const cz2 of [-1.2, 1.2]) {
    const cl = box(0.28, 2.2, 0.28, WOOD); cl.position.set(cx2, 1.1, cz2); chairG.add(cl);
  }
  U.chair = chairG;

  /* --- the book on the desk, open, being ruined --- */
  const pageCv = document.createElement('canvas');
  pageCv.width = 1024; pageCv.height = 720;
  drawDoodlePage(pageCv);
  const pageTex = new THREE.CanvasTexture(pageCv);
  pageTex.anisotropy = 4;
  const bookG = new THREE.Group(); bookG.position.set(0.4, 3.22, -21.0); bookG.rotation.y = 0.10;
  room.add(bookG);
  const cover = box(4.6, 0.16, 3.2, M(0x2f4a7a)); cover.position.y = -0.10; bookG.add(cover);
  const leaves = box(4.4, 0.22, 3.0, M(0xf4efdd)); leaves.position.y = 0.02; bookG.add(leaves);
  const pageM = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 2.9),
    new THREE.MeshLambertMaterial({ map: pageTex }));
  pageM.rotation.x = -Math.PI / 2; pageM.position.y = 0.14; bookG.add(pageM);
  const spine = box(0.16, 0.30, 3.0, M(0x24395f)); spine.position.y = 0.0; bookG.add(spine);
  U.book = bookG;
  /* the pen she was using, dropped on the page */
  const pen = box(0.12, 0.12, 1.5, M(0xff4d7a)); pen.position.set(1.4, 3.45, -20.4);
  pen.rotation.y = 0.5; room.add(pen);

  /* --- the insert shot: the same page, enormous, off in limbo --- */
  const insert = new THREE.Group(); insert.position.set(70, 10, 0); g.add(insert);
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), B(0x0b0810));
  backdrop.position.z = -1.2; backdrop.material.fog = false; insert.add(backdrop);
  const bigCover = box(19.2, 0.6, 13.6, B(0x2f4a7a));
  bigCover.rotation.x = Math.PI / 2; bigCover.position.z = -0.5;
  bigCover.material.fog = false; insert.add(bigCover);
  const bigPage = new THREE.Mesh(new THREE.PlaneGeometry(18.4, 12.9),
    new THREE.MeshBasicMaterial({ map: pageTex, fog: false }));
  insert.add(bigPage);
  U.insert = insert; U.bigPage = bigPage;
  U.pageTex = pageTex;

  /* the bedroom ceiling lamp */
  const rShade = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 1.6, 12, 1, true), M(0xf0e6cc));
  rShade.material.side = THREE.DoubleSide;
  rShade.position.set(0, 10.4, -17); room.add(rShade);
  const rBulb = sph(0.5, B(0xfff0c8), 1, 1, 1, 8); rBulb.position.set(0, 10.2, -17); room.add(rBulb);
  const rLight = new THREE.PointLight(0xffeccc, 1.15, 44, 2); rLight.position.set(0, 9.8, -17); room.add(rLight);
  const rLight2 = new THREE.PointLight(0xbfd8ff, 0.35, 40, 2); rLight2.position.set(-8, 7, -14); room.add(rLight2);
  U.roomBulb = rBulb; U.roomLight = rLight;

  /* ================= the three of them ================= */
  const kinds = ['normal', 'cat', 'shades'];
  const girls = [];
  for (let i = 0; i < 3; i++) {
    const gr = makeAnimeGirl(kinds[i]);
    gr.root.scale.setScalar(0.74);                   // she is a small child
    room.add(gr.root);
    girls.push(gr);
  }
  U.girls = girls;

  /* sparkles for the innocent look, and hearts floating off the page */
  const spGeo = new THREE.PlaneGeometry(0.5, 0.5);
  const spMat = new THREE.MeshBasicMaterial({
    map: (function () {
      const { c, x } = cv(32, 32);
      x.clearRect(0, 0, 32, 32);
      const gr2 = x.createRadialGradient(16, 16, 0, 16, 16, 15);
      gr2.addColorStop(0, 'rgba(255,255,255,1)');
      gr2.addColorStop(0.35, 'rgba(255,220,240,.85)');
      gr2.addColorStop(1, 'rgba(255,180,220,0)');
      x.fillStyle = gr2; x.fillRect(0, 0, 32, 32);
      x.strokeStyle = 'rgba(255,255,255,.95)'; x.lineWidth = 2.4; x.lineCap = 'round';
      x.beginPath(); x.moveTo(16, 3); x.lineTo(16, 29); x.moveTo(3, 16); x.lineTo(29, 16); x.stroke();
      const t2 = new THREE.CanvasTexture(c); return t2;
    })(),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
  });
  const sparkles = new THREE.InstancedMesh(spGeo, spMat, 40);
  sparkles.frustumCulled = false; sparkles.visible = false;
  room.add(sparkles);
  U.sparkles = sparkles;
  U.spState = [];
  for (let i = 0; i < 40; i++) U.spState.push({ x: 0, y: 0, z: 0, s: 0, life: -1, sp: 0 });

  /* the rage overlay: a red wash that lives on the inside of a big sphere */
  const rage = new THREE.Mesh(new THREE.SphereGeometry(90, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0x8a0d0d, side: THREE.BackSide,
      transparent: true, opacity: 0, fog: false, depthWrite: false }));
  rage.position.set(0, 6, -18); g.add(rage); rage.visible = false;
  U.rage = rage;

  g.visible = false;
  return g;
}

/* =========================================================================
   The bonus, beat by beat.  `k` is seconds since the epilogue began.
   ========================================================================= */
const HOME_T0 = 440;

/* every timed event in one table, so the whole scene reads top to bottom */
const HOME_BEATS = {
  gate: 4.2, walk: 4.4, atDoor: 8.6, doorOpen: 10.4, stepIn: 13.0,
  toSwitch: 15.0, atSwitch: 17.2, click: 18.4,
  downHall: 21.0, atBDoor: 24.6, bdoorOpen: 26.2,
  notice: 30.0, sparkle: 31.2,
  round: 42.0, atDesk: 46.0, lean: 47.4,
  insert: 50.0, readIt: 52.0, backOn: 56.0,
  redEyes: 57.4, tremble: 59.0, boilOver: 63.0,
  lunge: 66.2, caught: 67.4, squeeze: 68.6,
  shout: 70.0, shout2: 73.0, cling: 76.0, endCard: 79.5
};

function runHomeAct(D, A, t, dt) {
  const G2 = D.sets.home, U = G2.userData, O = ACT_AT.home;
  const k = t - A.t0;
  const B = HOME_BEATS;
  const after = (n) => k >= B[n];
  const since = (n) => k - B[n];
  const ramp = (n, d) => clamp((k - B[n]) / d, 0, 1);
  const P = (x, y, z, spin) => { D.actPose = { x: O.x + x, y: y || 0, z: O.z + z, spin: spin || 0 }; };
  const once = (id, at, fn) => {
    if (!D._did['h_' + id] && k >= at) { D._did['h_' + id] = 1; fn(); }
  };

  /* ------------------------------------------------------- the world */
  D.scene.fog.near = 40; D.scene.fog.far = 260;
  D.scene.background.setHex(0x080b1c);
  const inside = after('stepIn');
  const lit = after('click');
  D.amb.intensity = inside ? (lit ? 0.62 : 0.085) : 0.30;
  D.amb.color.setHex(inside ? (lit ? 0xffeed2 : 0x33406a) : 0x4a5a92);
  D.keyLight.intensity = inside ? 0.10 : 0.30;
  D.keyLight.color.setHex(0x9fb4ff);

  /* the fire from the last scene has no business being in his hallway */
  once('cool', 0, () => {
    D.embers.visible = false;
    for (const f of D.flames) f.m.visible = false;
    for (const s2 of D.spirals) s2.visible = false;
    D.confetti.visible = false;
    D.model.eyeL.pupilG.visible = true; D.model.eyeR.pupilG.visible = true;
    D.model.eyeL.white.material.color.setHex(0xffffff);
    D.model.eyeR.white.material.color.setHex(0xffffff);
    D.card('BONUS');
  });
  once('cardOff', 3.4, () => D.card(null));

  /* the porch light comes on when he gets near, as porch lights do */
  const pk = clamp((k - B.gate) / 2.2, 0, 1);
  U.porchLight.intensity = pk * 1.1;
  U.porchBulb.material.color.setHSL(0.11, 0.55, 0.20 + pk * 0.62);

  /* ---------------------------------------------------- the two doors */
  const dOpen = ramp('doorOpen', 1.5);
  U.door.rotation.y = -easeOutBack(dOpen) * 1.75;
  const bOpen = ramp('bdoorOpen', 1.1);
  U.bdoor.rotation.y = -easeOutBack(bOpen) * 1.95;

  /* --------------------------------------------------------- the light */
  U.swLever.rotation.z = lit ? -0.55 : 0.55;
  const flick = lit ? clamp(since('click') / 0.35, 0, 1) : 0;
  /* a tube light does not come on cleanly — it stutters twice first */
  const stut = lit && since('click') < 0.45
    ? (Math.sin(since('click') * 62) > 0 ? 1 : 0.15) : 1;
  U.hallLight.intensity = flick * 1.5 * stut;
  U.hallBulb.material.color.setHSL(0.11, 0.45, 0.18 + flick * stut * 0.72);
  U.roomLight.intensity = 1.2;

  /* --------------------------------------------------- Baldi's blocking */
  let mv = 'hstand', px = 0, pz = 34, spin = Math.PI;
  if (!after('walk')) { mv = 'hstand'; pz = 36; }
  else if (!after('atDoor')) {
    mv = 'hwalk'; pz = lerp(36, 17.4, ramp('walk', B.atDoor - B.walk));
  } else if (!after('stepIn')) {
    mv = k >= B.doorOpen ? 'hpush' : 'hstand'; pz = 17.4;
  } else if (!after('toSwitch')) {
    mv = 'hwalk'; pz = lerp(17.4, 12.6, ramp('stepIn', B.toSwitch - B.stepIn));
  } else if (!after('atSwitch')) {
    const e = ramp('toSwitch', B.atSwitch - B.toSwitch);
    mv = 'hwalk'; pz = lerp(12.6, 11.2, e); px = lerp(0, 3.5, e);
    spin = lerp(Math.PI, Math.PI / 2, e);
  } else if (!after('downHall')) {
    mv = 'hreach'; px = 3.5; pz = 11.2; spin = Math.PI / 2;
  } else if (!after('atBDoor')) {
    const e = ramp('downHall', B.atBDoor - B.downHall);
    mv = 'hwalk'; px = lerp(3.5, 0, Math.min(1, e * 2)); pz = lerp(11.2, -2.6, e);
    spin = lerp(Math.PI / 2, Math.PI, Math.min(1, e * 2.5));
  } else if (!after('notice')) {
    mv = k >= B.bdoorOpen ? 'hpush' : 'hstand'; pz = -2.6;
  } else if (!after('round')) {
    /* he takes two steps in and stops dead, because they are looking at him */
    mv = k < B.notice + 2.6 ? 'hwalk' : 'hstand';
    pz = lerp(-2.6, -13.5, clamp((k - B.notice) / 2.6, 0, 1));
  } else if (!after('atDesk')) {
    const e = ramp('round', B.atDesk - B.round);
    mv = 'hwalk';
    px = Math.sin(e * Math.PI) * 3.4 + lerp(0, 0.4, e);   // he arcs round the corner
    pz = lerp(-13.5, -18.4, e);
  } else if (!after('lunge')) {
    mv = after('tremble') ? 'hshake' : (after('lean') ? 'hlean' : 'hstand');
    px = 0.4; pz = -18.4;
  } else if (!after('caught')) {
    mv = 'hgrab'; px = 0.4; pz = lerp(-18.4, -19.6, ramp('lunge', 1.2));
  } else {
    mv = 'hsqueeze'; px = 0.4; pz = -18.6;
  }
  P(px, 0, pz, spin);
  D.move = mv; D.homeMove = mv;

  /* -------------------------------------------------------- the girls */
  const girls = U.girls;
  const CH = 0.5;                                   // the chair's x
  const seatY = -0.07;             /* hips land exactly on the seat at this scale */
  const GS = 0.74;                 /* they are children, and the chair is not theirs */
  for (let i = 0; i < 3; i++) {
    const gr = girls[i];
    const off = (i - 1) * 1.22;
    const caught = k >= B.notice;
    const taken = (i === 1) && k >= B.caught;        // the cat one gets it
    gr.root.visible = true;

    if (taken) {
      /* --- held up in front of him, being squeezed --- */
      const s2 = since('caught');
      const held = clamp(s2 / 0.45, 0, 1);
      /* the squeeze itself: hard pumps with a ring-out after each one.
         Volume is preserved, so everything that goes in at the sides has to
         come back out of the top of her. */
      let sq = 1;
      if (k >= B.squeeze) {
        const s3 = since('squeeze');
        const pump = Math.max(0, Math.sin(s3 * 5.2));
        sq = 1 + pump * 0.46 + Math.sin(s3 * 19) * 0.06 * Math.exp(-s3 * 0.35);
      } else {
        sq = 1 + Math.sin(s2 * 12) * 0.12 * Math.exp(-s2 * 2);
      }
      gr.squash(sq, Math.sin(k * 7) * 0.10);
      gr.root.scale.multiplyScalar(GS);        /* she is still a small child */
      /* He does not hold her at arm's length, he hugs her — which is worse.
         Anchor her hips at his chest rather than her feet, so squeezing her
         sends her head up past his instead of through the ceiling. */
      const CHEST_Y = 4.30;
      gr.root.rotation.y = Math.PI;                  // clutched facing outward
      gr.root.position.set(
        lerp(CH + off, 0.4, held),
        lerp(2.4, CHEST_Y - 3.3 * GS * sq, easeOutBack(held)),
        lerp(-23.8, -19.55, held));
      gr.setMood(k >= B.shout ? 'surprised' : 'plead');
      gr.flail(k * 1.0, 1);
      gr.wobble(k, 2.2);
      continue;
    }

    /* --- on the chair, three to a seat --- */
    const lean = caught ? 0.05 : 0.42;
    const shove = Math.sin(k * 1.6 + i * 2.1) * 0.05;   // still elbowing each other
    /* the middle one has climbed up on the seat to get at the page, which is
       exactly why she is the one who gets picked up */
    const mid = i === 1 ? 1 : 0;
    let bx = CH + off, by = seatY + mid * 0.34, bz = -24.4 + mid * 0.55 + Math.abs(off) * 0.18;
    let ry = off * 0.20;                                /* they face the desk, which is +z */

    if (k >= B.cling && i !== 1) {
      /* the other two come round and hang off his legs */
      const e = clamp((k - B.cling) / 1.6, 0, 1);
      const side = i === 0 ? -1 : 1;
      bx = lerp(CH + off, 0.4 + side * 1.55, easeOutBack(e));
      bz = lerp(-24.4, -17.9, easeOutBack(e));
      by = lerp(seatY, 0, e);
      ry = lerp(off * 0.20, Math.PI + side * 0.45, e);
      gr.setMood('plead');
      gr.legL.rotation.set(-0.5, 0, -0.2); gr.legR.rotation.set(-0.5, 0, 0.2);
      gr.armL.g.rotation.set(-2.5, 0, -0.5); gr.armR.g.rotation.set(-2.5, 0, 0.5);
      gr.torso.rotation.set(-0.25, 0, 0);
      gr.head.rotation.set(-0.45, 0, Math.sin(k * 6 + i) * 0.10);
      gr.root.position.set(bx, by, bz);
      gr.root.rotation.set(0, ry, 0);
      gr.root.scale.setScalar(GS);
      gr.wobble(k, 1.6);
      continue;
    }

    gr.root.position.set(bx, by + (caught ? 0 : Math.sin(k * 3 + i * 2) * 0.03), bz);
    gr.root.rotation.set(0, ry + shove, 0);
    gr.root.scale.setScalar(GS);

    /* legs dangle off the front of a chair that is far too tall for them */
    const kick = Math.sin(k * 2.6 + i * 1.7) * 0.16;
    gr.legL.rotation.set(-1.15 + kick, 0, -0.07);
    gr.legR.rotation.set(-1.15 - kick, 0, 0.07);

    if (!caught) {
      /* scribbling: both arms out over the desk, one of them working hard */
      gr.torso.rotation.set(lean, 0, Math.sin(k * 2 + i) * 0.04);
      const scrib = i === 1 ? Math.sin(k * 13) * 0.22 : Math.sin(k * 3 + i) * 0.05;
      gr.armL.g.rotation.set(-1.35 + scrib * 0.4, 0, -0.45);
      gr.armR.g.rotation.set(-1.45 - scrib, 0, 0.40);
      gr.armL.fore.rotation.x = -0.55;
      gr.armR.fore.rotation.x = -0.65 + scrib * 0.5;
      gr.head.rotation.set(0.42, Math.sin(k * 1.7 + i) * 0.10, 0);
      gr.setMood('happy');
    } else {
      /* --- caught.  Heads come up, and the eyes do the rest. --- */
      const e = clamp((k - B.notice) / 0.22, 0, 1);      // the snap is fast
      const settle = clamp((k - B.notice) / 1.4, 0, 1);
      gr.torso.rotation.set(lerp(0.42, 0.06, e), 0, 0);
      gr.head.rotation.set(lerp(0.42, -0.18, e),
                           Math.sin(k * 0.9 + i) * 0.06, Math.sin(k * 5 + i * 2) * 0.03);
      /* hands whipped behind the back, which fools nobody */
      const hide = easeOutBack(settle);
      gr.armL.g.rotation.set(lerp(-1.35, 0.75, hide), 0, lerp(-0.45, -0.30, hide));
      gr.armR.g.rotation.set(lerp(-1.45, 0.75, hide), 0, lerp(0.40, 0.30, hide));
      gr.armL.fore.rotation.x = lerp(-0.55, -1.5, hide);
      gr.armR.fore.rotation.x = lerp(-0.65, -1.5, hide);
      gr.setMood(k >= B.redEyes ? 'plead' : 'innocent');
      /* a tiny nervous bob, so the freeze does not look like a bug */
      gr.root.position.y = by + Math.sin(k * 8 + i * 2) * 0.018;
    }
    gr.wobble(k, caught ? 0.7 : 1.4);
  }
  /* blinks and the face texture */
  for (const gr of girls) gr.update(dt, { idle: false, t: k, wob: 0 });

  /* -------------------------------------------------------- sparkles */
  const sp = U.sparkles, st = U.spState;
  sp.visible = k >= B.sparkle && k < B.redEyes;
  if (sp.visible) {
    const Dm = new THREE.Object3D();
    for (let i = 0; i < st.length; i++) {
      const s2 = st[i];
      s2.life -= dt;
      if (s2.life <= 0) {
        const g3 = girls[i % 3];
        s2.x = g3.root.position.x + rand(-1.4, 1.4);
        s2.y = 3.2 + rand(-0.4, 1.5);
        s2.z = g3.root.position.z + rand(-0.5, 0.9);
        s2.life = rand(0.5, 1.3); s2.max = s2.life;
        s2.sp = rand(0.7, 1.6); s2.s = rand(0.5, 1.2);
      }
      const a = s2.life / s2.max;
      Dm.position.set(s2.x, s2.y + (1 - a) * s2.sp, s2.z);
      Dm.rotation.set(0, 0, (1 - a) * 3);
      Dm.scale.setScalar(s2.s * Math.sin(a * Math.PI) * 1.4);
      Dm.updateMatrix(); sp.setMatrixAt(i, Dm.matrix);
    }
    sp.instanceMatrix.needsUpdate = true;
  }

  /* ------------------------------------------------- the insert shot */
  const showPage = k >= B.insert && k < B.backOn;
  U.insert.visible = showPage;
  if (showPage) {
    /* the page trembles a little more the longer he looks at it */
    const g4 = clamp((k - B.readIt) / 3.0, 0, 1);
    U.bigPage.position.x = Math.sin(k * 34) * 0.10 * g4;
    U.bigPage.position.y = Math.sin(k * 41) * 0.08 * g4;
  }

  /* ------------------------------------------------------ the rage */
  const rageK = clamp((k - B.redEyes) / 5.0, 0, 1) * (k >= B.cling ? 0.85 : 1);
  D.rageK = rageK;
  U.rage.visible = rageK > 0.02;
  U.rage.material.opacity = rageK * 0.46 * (0.78 + Math.sin(k * 11) * 0.22);
  if (rageK > 0.02) {
    /* the room does not get brighter, it gets redder and darker in the
       corners — flooding it with light would wash the whole shot out */
    D.amb.color.setHex(0xffb49a);
    D.amb.intensity = 0.62 - rageK * 0.24;
    U.roomLight.color.setHex(0xffa070);
    U.roomLight.intensity = 1.2 - rageK * 0.38 + (k >= B.boilOver ? Math.sin(k * 17) * 0.18 : 0);
  }
  if (k >= B.tremble) D.shakeT = Math.max(D.shakeT || 0, 0.05 + rageK * 0.16);

  /* ------------------------------------------------------ the beats */
  once('knock', B.doorOpen, () => { DJAudio.clank(Audio1.ctx.currentTime, 320); });
  once('creak', B.bdoorOpen, () => { DJAudio.clank(Audio1.ctx.currentTime, 260); });
  once('switch', B.click, () => {
    DJAudio.clank(Audio1.ctx.currentTime, 5200);
    DJAudio.impact();
  });
  once('gasp', B.notice, () => { DJAudio.impact(); D.hitStop(0.16); });
  once('spark', B.sparkle, () => DJAudio.riser(1.6));
  once('cardCute', B.notice + 0.3, () => D.card('THREE OF THEM'));
  once('cardCute2', B.notice + 3.4, () => D.card(null));
  once('page', B.insert, () => { DJAudio.impact(); D.hitStop(0.22); });
  once('read', B.readIt, () => { DJAudio.riser(3.4); });
  once('red', B.redEyes, () => { DJAudio.impact(); D.shakeT = 0.5; });
  once('boil', B.boilOver, () => { DJAudio.riser(3.0); });
  once('snap', B.lunge, () => { DJAudio.whoosh(); D.hitStop(0.10); });
  once('got', B.caught, () => { DJAudio.impact(); D.shakeT = 0.7; D.hitStop(0.18); });
  once('sq1', B.squeeze, () => DJAudio.impact());
  once('endc', B.endCard, () => D.card('TO BE CONFISCATED'));

  /* the on-screen shout, which is the whole reason the scene exists */
  if (k >= B.shout && k < B.cling + 2) {
    const e = clamp((k - B.shout) / 0.25, 0, 1);
    const wob = Math.sin(k * 24) * 3 * (1 - clamp((k - B.shout) / 3, 0, 1));
    D.fx('<div class="hmShout" style="transform:translate(-50%,0) scale(' +
         (0.6 + e * 0.4).toFixed(3) + ') rotate(' + wob.toFixed(2) + 'deg)">' +
         (k >= B.shout2
           ? '<span class="wide">ｇｉｖｅ ｂａｃｋ ｍｙ ｂｏｏｋ</span>'
           : 'STUPID ANIME GIRL!!!!') + '</div>');
  } else if (D._hmFx) { D.fx(''); D._hmFx = 0; }
  if (k >= B.shout && k < B.cling + 2) D._hmFx = 1;
}


/* =========================================================================
   Part 5l — FNF
   A second game bolted onto the side of the first one: the title crawl, the
   menu, freeplay, the options screen, and the state machine that walks
   between them.  Everything here is DOM and canvas; only the stage is 3D.
   ========================================================================= */

const FNF_WACKY = [
  ['no anime', 'in my schoolhouse'],
  ['seven notebooks', 'no mistakes'],
  ['get out', 'of my school'],
  ['bring your friend', 'i want to see him'],
  ['im so glad', 'you came to play'],
  ['detention', 'is not a punishment'],
  ['wow', 'you got it right'],
  ['please learn', 'how to count'],
  ['baldis basics', 'in education and learning'],
  ['she drew a heart', 'on my worksheet'],
  ['dfjk', 'or the arrow keys'],
  ['the ruler', 'is for measuring']
];

const FNF = {
  state: 'off',
  opt: {
    /* gameplay */
    down: false, middle: false, oppNotes: true, ghost: false, resetOff: false,
    offset: 0,
    /* visuals */
    splash: true, splashA: 0.6, hud: true, timeBar: 'TIME LEFT', flash: true,
    zoom: true, scoreZoom: true, hpAlpha: 1.0, fps: false,
    /* graphics */
    lowQ: false, aa: true, framerate: 60
  },
  best: {},

  /* ------------------------------------------------------------- enter */
  open() {
    if (typeof stopMusic === 'function') stopMusic();
    Audio1.init(); Audio1.resume();
    G.mode = 'fnf'; G.running = false;
    UI.el('menu').classList.add('hidden');
    UI.el('modeScreen').classList.add('hidden');
    UI.el('modeSelect').classList.add('hidden');
    UI.el('hud').classList.add('hidden');
    UI.el('fnf').classList.add('on');
    this.drawArt();
    this.applyOpt();
    this.beat = -1; this.sick = 0;
    this.wacky = FNF_WACKY[Math.floor(Math.random() * FNF_WACKY.length)];
    this.cred = [];
    this.t0 = Audio1.ctx.currentTime;
    this.bpm = 102; this.beatLen = 60 / 102;
    this.skipped = false;
    this.logoK = 0;
    this.go('intro');
    FNFMenuMusic.start();
  },
  close() {
    FNFMenuMusic.stop();
    if (FNFPlay.active) FNFPlay.stop();
    UI.el('fnf').classList.remove('on');
    this.state = 'off';
    /* the options screen is allowed to change the render scale, so put the
       rest of the game back the way it found it */
    PIXSCALE = 2.4;
    if (typeof resize === 'function') resize();
    if (G.renderer) G.renderer.setClearColor(0x0a0d09);
    if (typeof returnToTitle === 'function') returnToTitle();
  },

  go(s) {
    this.state = s;
    for (const id of ['fnfIntro', 'fnfMenu', 'fnfFree', 'fnfOpt', 'fnfPlay'])
      UI.el(id).classList.toggle('on', id === 'fnf' + s[0].toUpperCase() + s.slice(1));
    if (s === 'menu') this.buildMenu();
    if (s === 'free') this.buildFree();
    if (s === 'opt') this.buildOpt();
  },

  /* ================================================== the title crawl */
  setCred(lines) { this.cred = lines.slice(); UI.el('fnfCred').textContent = this.cred.join('\n'); },
  addCred(l) { this.cred.push(l); UI.el('fnfCred').textContent = this.cred.join('\n'); },

  introBeat(n) {
    const ng = UI.el('fnfNg');
    switch (n) {
      case 2: this.setCred(['Baldi Engine by']); break;
      case 4: this.addCred('Claude'); this.addCred('one HTML file, no downloads'); break;
      case 5: this.setCred([]); break;
      case 6: this.setCred(['Not associated', 'with']); break;
      case 8: this.addCred('newgrounds'); ng.classList.add('on'); break;
      case 9: this.setCred([]); ng.classList.remove('on'); break;
      case 10: this.setCred([this.wacky[0]]); break;
      case 12: this.addCred(this.wacky[1]); break;
      case 13: this.setCred([]); break;
      case 14: this.addCred('Friday'); break;
      case 15: this.addCred('Night'); break;
      case 16: this.addCred('Funkin'); break;
      case 17: this.skipIntro(); break;
    }
  },
  skipIntro() {
    if (this.skipped) return;
    this.skipped = true;
    this.setCred([]);
    UI.el('fnfNg').classList.remove('on');
    UI.el('fnfLogo').classList.add('on');
    UI.el('fnfEnter').classList.add('on');
    const f = UI.el('fnfFlash');
    f.style.transition = 'none'; f.style.opacity = '1';
    setTimeout(() => { f.style.transition = 'opacity .9s'; f.style.opacity = '0'; }, 30);
    FNFAudio.confirm(Audio1.ctx.currentTime);
  },

  /* ====================================================== the main menu */
  buildMenu() {
    const items = ['freeplay', 'credits', 'options'];
    this.mItems = items;
    this.mSel = 0;
    const box = UI.el('fnfItems');
    box.innerHTML = '';
    for (const it of items) {
      const d = document.createElement('div');
      d.className = 'fnfItem';
      d.textContent = it.toUpperCase();
      box.appendChild(d);
    }
    this.paintMenu();
  },
  paintMenu() {
    const ch = UI.el('fnfItems').children;
    for (let i = 0; i < ch.length; i++) {
      ch[i].classList.toggle('dim', i !== this.mSel);
      ch[i].classList.remove('gone');
    }
  },
  menuMove(d) {
    this.mSel = (this.mSel + d + this.mItems.length) % this.mItems.length;
    this.paintMenu();
    FNFAudio.menuBlip(Audio1.ctx.currentTime, d < 0);
  },
  menuPick() {
    if (this.confirming) return;
    this.confirming = 1;
    const pick = this.mItems[this.mSel];
    const ch = UI.el('fnfItems').children;
    FNFAudio.confirm(Audio1.ctx.currentTime);
    /* the real thing: a magenta wash flickering, the chosen item flickering
       white, and everything else fading out under it */
    const mg = UI.el('fnfMagenta');
    let n = 0;
    const flick = setInterval(() => {
      n++;
      mg.style.opacity = (n % 2) ? '0.85' : '0';
      ch[this.mSel].style.visibility = (n % 2) ? 'hidden' : 'visible';
      for (let i = 0; i < ch.length; i++) if (i !== this.mSel) ch[i].classList.add('gone');
      if (n > 16) {
        clearInterval(flick);
        mg.style.opacity = '0';
        ch[this.mSel].style.visibility = 'visible';
        this.confirming = 0;
        if (pick === 'freeplay') this.go('free');
        else if (pick === 'options') this.go('opt');
        else this.showCredits();
      }
    }, 62);
  },
  showCredits() {
    this.go('opt');
    UI.el('fnfOptHead').textContent = 'CREDITS';
    this.optCredits = 1;
    const L = UI.el('fnfOptList');
    L.innerHTML = '';
    const rows = [
      'BALDI NIGHT FUNKIN\'', '',
      'engine, art, charts, music  —  Claude',
      'Baldi\'s Basics  —  Micah "mystman12" McGonigal',
      'Friday Night Funkin\'  —  ninjamuffin99, PhantomArcade,',
      'evilsk8r, KawaiSprite',
      'menu and options modelled on Psych Engine',
      'ShadowMario, Riveren',
      '', 'not associated with any of them', '', 'ESC to go back'
    ];
    for (const r of rows) {
      const d = document.createElement('div');
      d.className = 'fnfOpt' + (r === rows[0] ? ' sel' : '');
      d.textContent = r || ' ';
      L.appendChild(d);
    }
    UI.el('fnfOptDesc').textContent = 'Everything here is drawn and synthesised at runtime.';
  },

  /* ========================================================= freeplay */
  buildFree() {
    this.fSel = this.fSel || 0;
    this.fDiff = this.fDiff == null ? 2 : this.fDiff;
    const box = UI.el('fnfSongs');
    box.innerHTML = '';
    for (const s of FNF_SONGS) {
      const row = document.createElement('div');
      row.className = 'fnfSong';
      const nm = document.createElement('div');
      nm.className = 'nm'; nm.textContent = s.name;
      const ic = fnfIcon(s.icon === 'baldiMad' ? 'baldiMad' : 'baldi', s.icon === 'baldiMad');
      row.appendChild(nm); row.appendChild(ic);
      box.appendChild(row);
    }
    this.paintFree();
  },
  paintFree() {
    const rows = UI.el('fnfSongs').children;
    for (let i = 0; i < rows.length; i++) rows[i].classList.toggle('sel', i === this.fSel);
    const s = FNF_SONGS[this.fSel];
    const d = FNF_DIFFS[this.fDiff];
    UI.el('fnfDiff').textContent = '< ' + d + ' >';
    const best = this.best['fnf_' + s.id + '_' + d] || 0;
    UI.el('fnfScore').innerHTML =
      '<div class="big">PERSONAL BEST: ' + best + '</div>' +
      '<div class="sm">' + s.bpm + ' BPM &middot; ' + d + '</div>' +
      '<div class="sm">' + s.blurb + '</div>';
    this.freeTint = s.colour;
  },
  freeMove(d) {
    this.fSel = (this.fSel + d + FNF_SONGS.length) % FNF_SONGS.length;
    this.paintFree();
    FNFAudio.menuBlip(Audio1.ctx.currentTime, d < 0);
  },
  freeDiff(d) {
    this.fDiff = (this.fDiff + d + FNF_DIFFS.length) % FNF_DIFFS.length;
    this.paintFree();
    FNFAudio.menuBlip(Audio1.ctx.currentTime, d > 0);
  },
  toFreeplay() {
    if (FNFPlay.active) FNFPlay.stop();
    this.go('free');
    FNFMenuMusic.start();
    this.paintFree();
  },
  playSong(song, diff) {
    FNFMenuMusic.stop();
    this.go('play');
    FNFPlay.start(song, diff);
  }
};

/* ======================================================== the options
   The real Psych Engine list, in the real submenus, doing the real things.
   Every one of these is read somewhere in the game. */
const FNF_OPTS = {
  Gameplay: [
    ['down', 'Downscroll', 'bool', 'Notes fall from the top instead of rising from the bottom.'],
    ['middle', 'Middlescroll', 'bool', 'Puts your notes in the centre and hides the opponent\'s.'],
    ['oppNotes', 'Opponent Notes', 'bool', 'Show the notes Baldi is singing.'],
    ['ghost', 'Ghost Tapping', 'bool', 'Pressing a key with no note there costs you nothing.'],
    ['resetOff', 'Disable Reset Button', 'bool', 'Stops R restarting the song mid-run.'],
    ['offset', 'Rating Offset', 'num', 'Shifts every hit window. Raise it if you feel early.', -30, 30, 1]
  ],
  Visuals: [
    ['splash', 'Note Splashes', 'bool', 'The burst you get for a SICK! hit.'],
    ['splashA', 'Note Splash Opacity', 'num', 'How strong that burst is.', 0, 1, 0.1],
    ['hud', 'Hide HUD', 'boolInv', 'Hides the health bar, score and time bar.'],
    ['timeBar', 'Time Bar', 'list', 'What the bar along the top counts.',
      ['TIME LEFT', 'TIME ELAPSED', 'SONG NAME', 'DISABLED']],
    ['hpAlpha', 'Health Bar Opacity', 'num', 'How solid the health bar is.', 0.2, 1, 0.1],
    ['zoom', 'Camera Zooms', 'bool', 'The camera bounces on every beat.'],
    ['scoreZoom', 'Score Text Grow on Hit', 'bool', 'The score line pops when you hit a note.'],
    ['flash', 'Flashing Lights', 'bool', 'Turn this off if flashing images are a problem for you.'],
    ['fps', 'FPS Counter', 'bool', 'Shows the frame rate in the corner.']
  ],
  Graphics: [
    ['lowQ', 'Low Quality', 'bool', 'Drops the stage detail for a smoother frame rate.'],
    ['aa', 'Anti-Aliasing', 'bool', 'Smooths the edges of the 3D stage.'],
    ['framerate', 'Framerate', 'num', 'Cap on frames per second.', 30, 240, 10]
  ],
  Controls: [
    ['_k0', 'Note Left', 'key', 'D  or  Left Arrow'],
    ['_k1', 'Note Down', 'key', 'F  or  Down Arrow'],
    ['_k2', 'Note Up', 'key', 'J  or  Up Arrow'],
    ['_k3', 'Note Right', 'key', 'K  or  Right Arrow'],
    ['_kp', 'Pause', 'key', 'ESC'],
    ['_kr', 'Reset', 'key', 'R']
  ]
};

Object.assign(FNF, {
  buildOpt() {
    this.optCredits = 0;
    this.optCat = this.optCat || 0;
    this.oSel = 0;
    this.optCats = Object.keys(FNF_OPTS);
    UI.el('fnfOptHead').textContent = 'OPTIONS  —  < ' + this.optCats[this.optCat] + ' >';
    this.paintOpt();
  },
  paintOpt() {
    if (this.optCredits) return;
    const cat = this.optCats[this.optCat];
    const list = FNF_OPTS[cat];
    UI.el('fnfOptHead').textContent = 'OPTIONS  —  < ' + cat + ' >';
    const L = UI.el('fnfOptList');
    L.innerHTML = '';
    list.forEach((o, i) => {
      const d = document.createElement('div');
      d.className = 'fnfOpt' + (i === this.oSel ? ' sel' : '');
      d.innerHTML = o[1] + ' <span class="val">' + this.optVal(o) + '</span>';
      L.appendChild(d);
    });
    UI.el('fnfOptDesc').textContent = list[this.oSel][3] +
      '   —   A/D changes it, Q/E changes category, ESC goes back';
  },
  optVal(o) {
    const v = this.opt[o[0]];
    if (o[2] === 'bool') return v ? 'ON' : 'OFF';
    if (o[2] === 'boolInv') return v ? 'OFF' : 'ON';
    if (o[2] === 'list') return String(v);
    if (o[2] === 'key') return o[3];
    if (o[2] === 'num') return (o[6] < 1 ? v.toFixed(1) : String(v));
    return String(v);
  },
  optChange(dir) {
    if (this.optCredits) return;
    const o = FNF_OPTS[this.optCats[this.optCat]][this.oSel];
    if (o[2] === 'bool' || o[2] === 'boolInv') this.opt[o[0]] = !this.opt[o[0]];
    else if (o[2] === 'list') {
      const arr = o[4], i = arr.indexOf(this.opt[o[0]]);
      this.opt[o[0]] = arr[(i + dir + arr.length) % arr.length];
    } else if (o[2] === 'num') {
      const [, , , , lo, hi, stp] = o;
      let v = this.opt[o[0]] + dir * stp;
      v = Math.round(clamp(v, lo, hi) * 100) / 100;
      this.opt[o[0]] = v;
    } else return;
    FNFAudio.menuBlip(Audio1.ctx.currentTime, dir > 0);
    this.paintOpt();
    this.applyOpt();
  },
  applyOpt() {
    if (G.renderer) G.renderer.setPixelRatio(1);
    PIXSCALE = this.opt.lowQ ? 2.6 : (this.opt.aa ? 1.35 : 1.9);
    if (typeof resize === 'function') resize();
  },

  /* ============================================================ input */
  key(code, down) {
    if (this.state === 'off') return false;
    if (this.state === 'play') {
      if (down && code === 'KeyR' && !this.opt.resetOff && FNFPlay.active && !FNFPlay.done) {
        FNFPlay.stop(); this.playSong(FNFPlay.song, FNFPlay.diff); return true;
      }
      return FNFPlay.key(code, down);
    }
    if (!down) return true;
    const up = (code === 'KeyW' || code === 'ArrowUp');
    const dn = (code === 'KeyS' || code === 'ArrowDown');
    const lt = (code === 'KeyA' || code === 'ArrowLeft');
    const rt = (code === 'KeyD' || code === 'ArrowRight');
    const ok = (code === 'Enter' || code === 'Space');

    if (this.state === 'intro') {
      if (ok) { if (!this.skipped) this.skipIntro(); else this.go('menu'); }
      else if (code === 'Escape') this.close();
      return true;
    }
    if (this.state === 'menu') {
      if (up) this.menuMove(-1);
      else if (dn) this.menuMove(1);
      else if (ok) this.menuPick();
      else if (code === 'Escape') this.close();
      return true;
    }
    if (this.state === 'free') {
      if (up) this.freeMove(-1);
      else if (dn) this.freeMove(1);
      else if (lt) this.freeDiff(-1);
      else if (rt) this.freeDiff(1);
      else if (ok) this.playSong(FNF_SONGS[this.fSel], FNF_DIFFS[this.fDiff]);
      else if (code === 'Escape') this.go('menu');
      return true;
    }
    if (this.state === 'opt') {
      if (code === 'Escape') {
        if (this.optCredits) { this.optCredits = 0; }
        this.go('menu'); return true;
      }
      if (this.optCredits) return true;
      const list = FNF_OPTS[this.optCats[this.optCat]];
      if (up) { this.oSel = (this.oSel - 1 + list.length) % list.length; this.paintOpt(); FNFAudio.menuBlip(Audio1.ctx.currentTime, 1); }
      else if (dn) { this.oSel = (this.oSel + 1) % list.length; this.paintOpt(); FNFAudio.menuBlip(Audio1.ctx.currentTime, 0); }
      else if (lt) this.optChange(-1);
      else if (rt) this.optChange(1);
      else if (code === 'KeyQ') { this.optCat = (this.optCat - 1 + this.optCats.length) % this.optCats.length; this.buildOpt(); }
      else if (code === 'KeyE') { this.optCat = (this.optCat + 1) % this.optCats.length; this.buildOpt(); }
      return true;
    }
    return true;
  },

  /* ============================================================= tick */
  update(dt) {
    const ctx = Audio1.ctx;
    if (!ctx) return;
    const t = ctx.currentTime - this.t0;
    const b = Math.floor(t / this.beatLen);
    if (b !== this.beat) {
      this.beat = b;
      if (this.state === 'intro' && !this.skipped) { this.sick++; this.introBeat(this.sick); }
      this.logoK = 1;
      if (this.state === 'menu' || this.state === 'free') this.menuBop = 1;
    }
    this.logoK = Math.max(0, this.logoK - dt * 3.4);
    this.menuBop = Math.max(0, (this.menuBop || 0) - dt * 3.2);

    if (this.state === 'intro') {
      const L = UI.el('fnfLogo');
      const s = 1 + this.logoK * 0.055;
      L.style.transform = 'scale(' + s.toFixed(3) + ') rotate(' + (-2 + this.logoK * 1.4).toFixed(2) + 'deg)';
      const E = UI.el('fnfEnter');
      E.style.opacity = this.skipped ? (0.55 + 0.45 * Math.abs(Math.sin(t * 2.2))).toFixed(2) : '0';
    }
    if (this.state === 'menu') {
      const ch = UI.el('fnfItems').children;
      for (let i = 0; i < ch.length; i++) {
        const sel = i === this.mSel;
        const s = sel ? 1 + this.menuBop * 0.05 : 0.92;
        ch[i].style.transform = 'scale(' + s.toFixed(3) + ')';
      }
      this.scrollBg(dt);
    }
    if (this.state === 'free') {
      const rows = UI.el('fnfSongs').children;
      for (let i = 0; i < rows.length; i++) {
        const off = (i - this.fSel);
        rows[i].style.transform = 'translateX(' + (Math.abs(off) * 3.5) + '%)';
      }
      this.scrollBg(dt);
    }
    if (this.state === 'play') {
      FNFPlay.update(dt);
      if (FNFPlay.scene) {
        const sz = G.renderer.getSize(new THREE.Vector2());
        FNFPlay.camera.aspect = sz.x / sz.y;
        FNFPlay.camera.updateProjectionMatrix();
        G.renderer.setClearColor(0x1a1522);
        G.renderer.render(FNFPlay.scene, FNFPlay.camera);
      }
    }
  },

  scrollBg(dt) {
    this.bgX = (this.bgX || 0) + dt * 9;
    for (const id of ['fnfMenuBg', 'fnfFreeBg']) {
      const c = UI.el(id);
      if (c) c.style.transform = 'translateX(' + (-(this.bgX % 40)).toFixed(1) + 'px) scale(1.12)';
    }
  }
});

/* ============================================================== artwork
   The logo, the little "not newgrounds" block, and the yellow sketch the
   menu sits on.  All drawn once into canvases at open(). */
Object.assign(FNF, {
  drawArt() {
    if (this._art) return;
    this._art = 1;

    /* ---- the logo ---- */
    (function (c) {
      const x = c.getContext('2d'), W = c.width, H = c.height;
      x.clearRect(0, 0, W, H);
      const word = (txt, cy, size, rot, fill) => {
        x.save();
        x.translate(W / 2, cy);
        x.rotate(rot);
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.font = 'bold ' + size + 'px "Comic Sans MS", "Chalkboard SE", cursive';
        x.lineJoin = 'round'; x.lineCap = 'round';
        x.lineWidth = size * 0.30; x.strokeStyle = '#12121a'; x.strokeText(txt, 0, 0);
        x.lineWidth = size * 0.16; x.strokeStyle = '#ffffff'; x.strokeText(txt, 0, 0);
        const g = x.createLinearGradient(0, -size / 2, 0, size / 2);
        g.addColorStop(0, fill[0]); g.addColorStop(1, fill[1]);
        x.fillStyle = g; x.fillText(txt, 0, 0);
        x.restore();
      };
      word('FRIDAY', 118, 118, -0.055, ['#fff6cf', '#f6c73c']);
      word('NIGHT', 268, 158, 0.030, ['#fff6cf', '#f0a52c']);
      word("FUNKIN'", 452, 196, -0.020, ['#ffffff', '#e8622c']);
      /* the mod ribbon */
      x.save();
      x.translate(W / 2, 600); x.rotate(-0.045);
      x.fillStyle = '#12121a';
      x.fillRect(-330, -40, 660, 80);
      x.fillStyle = '#2f6f3a'; x.fillRect(-322, -32, 644, 64);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = 'bold 46px "Comic Sans MS", cursive';
      x.fillStyle = '#fff6cf'; x.fillText("BALDI'S BASICS MOD", 0, 2);
      x.restore();
    })(UI.el('fnfLogo'));

    /* ---- press enter ---- */
    (function (c) {
      const x = c.getContext('2d'), W = c.width;
      x.clearRect(0, 0, W, c.height);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = 'bold 96px "Comic Sans MS", cursive';
      x.lineJoin = 'round'; x.lineWidth = 26; x.strokeStyle = '#12121a';
      const msg = 'PRESS ENTER TO BEGIN';
      /* squeeze to fit rather than clip, since the font is whatever the
         machine happens to have */
      const wide = x.measureText(msg).width;
      const sc = Math.min(1, (W - 60) / wide);
      x.save(); x.translate(W / 2, 100); x.scale(sc, 1);
      x.strokeText(msg, 0, 0);
      x.fillStyle = '#ffffff'; x.fillText(msg, 0, 0);
      x.restore();
    })(UI.el('fnfEnter'));

    /* ---- the "not newgrounds" block ---- */
    (function (c) {
      const x = c.getContext('2d');
      x.clearRect(0, 0, c.width, c.height);
      x.fillStyle = '#ffffff'; x.fillRect(0, 24, 480, 74);
      x.fillStyle = '#12121a';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = 'bold 52px "Comic Sans MS", cursive';
      x.fillText('newgrounds', 240, 62);
      x.fillStyle = '#f6a02c'; x.fillRect(0, 24, 480, 8);
      x.fillRect(0, 90, 480, 8);
    })(UI.el('fnfNg'));

    /* ---- the yellow sketch behind both menus ---- */
    const bg = this.sketchBg();
    for (const id of ['fnfMenuBg', 'fnfFreeBg']) {
      const c = UI.el(id);
      c.getContext('2d').drawImage(bg, 0, 0, c.width, c.height);
    }
  },

  sketchBg() {
    const W = 640, H = 360, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    /* a deterministic scribble, so it is the same drawing every time */
    let seed = 20260826;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    x.fillStyle = '#f2cf3c'; x.fillRect(0, 0, W, H);
    const wash = x.createLinearGradient(0, 0, W, H);
    wash.addColorStop(0, 'rgba(255,240,160,.45)');
    wash.addColorStop(0.5, 'rgba(255,255,255,0)');
    wash.addColorStop(1, 'rgba(190,140,40,.30)');
    x.fillStyle = wash; x.fillRect(0, 0, W, H);

    /* loose pencil strokes, the way the real menu art looks */
    const pencil = (x0, y0, x1, y1, w, a) => {
      x.globalAlpha = a; x.lineWidth = w; x.lineCap = 'round';
      x.strokeStyle = '#8a6a1c';
      x.beginPath();
      x.moveTo(x0, y0);
      const mx = (x0 + x1) / 2 + (rnd() - 0.5) * 60, my = (y0 + y1) / 2 + (rnd() - 0.5) * 60;
      x.quadraticCurveTo(mx, my, x1, y1);
      x.stroke();
      x.globalAlpha = 1;
    };
    for (let i = 0; i < 60; i++)
      pencil(rnd() * W, rnd() * H, rnd() * W, rnd() * H, 0.6 + rnd() * 1.6, 0.10 + rnd() * 0.16);

    /* two big sketched heads, one either side, like the original */
    const head = (cx2, cy, r, mad) => {
      x.save(); x.translate(cx2, cy);
      x.strokeStyle = '#7a5a12'; x.globalAlpha = 0.38; x.lineWidth = 3.2; x.lineJoin = 'round';
      for (let p = 0; p < 3; p++) {                     /* gone over three times */
        x.beginPath();
        for (let a = 0; a <= 32; a++) {
          const an = a / 32 * Math.PI * 2;
          const rr = r * (1 + (rnd() - 0.5) * 0.05);
          const px = Math.cos(an) * rr, py = Math.sin(an) * rr * 1.12;
          a ? x.lineTo(px, py) : x.moveTo(px, py);
        }
        x.closePath(); x.stroke();
      }
      x.lineWidth = 3.6;
      for (const ex of [-r * 0.36, r * 0.36]) {
        x.beginPath(); x.ellipse(ex, -r * 0.12, r * 0.15, r * 0.19, 0, 0, Math.PI * 2); x.stroke();
        x.beginPath(); x.ellipse(ex + (mad ? (ex < 0 ? 3 : -3) : 0), -r * 0.10, r * 0.05, r * 0.07, 0, 0, Math.PI * 2);
        x.fillStyle = '#7a5a12'; x.fill();
      }
      x.lineWidth = 5; x.lineCap = 'round';
      x.beginPath();
      if (mad) { x.moveTo(-r * 0.62, -r * 0.62); x.lineTo(-r * 0.20, -r * 0.36);
                 x.moveTo(r * 0.62, -r * 0.62); x.lineTo(r * 0.20, -r * 0.36); }
      else { x.moveTo(-r * 0.60, -r * 0.50); x.lineTo(-r * 0.18, -r * 0.58);
             x.moveTo(r * 0.60, -r * 0.50); x.lineTo(r * 0.18, -r * 0.58); }
      x.stroke();
      x.lineWidth = 4;
      x.beginPath();
      if (mad) x.ellipse(0, r * 0.46, r * 0.30, r * 0.18, 0, 0, Math.PI * 2);
      else x.arc(0, r * 0.30, r * 0.26, 0.15 * Math.PI, 0.85 * Math.PI);
      x.stroke();
      x.globalAlpha = 1; x.restore();
    };
    head(112, 178, 82, 1);
    head(524, 168, 72, 0);

    /* a few sketched arrows scattered about */
    for (let i = 0; i < 7; i++) {
      const px = 40 + rnd() * (W - 80), py = 40 + rnd() * (H - 80), s = 12 + rnd() * 16;
      x.save(); x.translate(px, py); x.rotate(rnd() * Math.PI * 2);
      x.globalAlpha = 0.20; x.strokeStyle = '#7a5a12'; x.lineWidth = 3; x.lineJoin = 'round';
      x.beginPath();
      x.moveTo(-s, 0); x.lineTo(-s * 0.15, -s * 0.9); x.lineTo(-s * 0.15, -s * 0.38);
      x.lineTo(s, -s * 0.38); x.lineTo(s, s * 0.38); x.lineTo(-s * 0.15, s * 0.38);
      x.lineTo(-s * 0.15, s * 0.9); x.closePath(); x.stroke();
      x.globalAlpha = 1; x.restore();
    }

    /* hatching in the corners and a vignette */
    x.globalAlpha = 0.13; x.strokeStyle = '#6a4a10'; x.lineWidth = 2;
    for (let i = 0; i < 40; i++) {
      x.beginPath(); x.moveTo(-20 + i * 6, H); x.lineTo(-60 + i * 6, H - 70); x.stroke();
      x.beginPath(); x.moveTo(W + 20 - i * 6, 0); x.lineTo(W + 60 - i * 6, 74); x.stroke();
    }
    x.globalAlpha = 1;
    const vg = x.createRadialGradient(W / 2, H / 2, H * 0.30, W / 2, H / 2, H * 0.92);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(90,60,10,.40)');
    x.fillStyle = vg; x.fillRect(0, 0, W, H);
    return c;
  }
});

/* ========================================================= menu music
   Freaky Menu is 102 BPM and eight bars long, and so is this. */
const FNFMenuMusic = {
  on: false,
  BAR: [
    { ch: 'Am', bass: 'A1', mel: 'A4 .  C5 .  E5 .  .  .  D5 .  C5 .  A4 .  .  . ' },
    { ch: 'F',  bass: 'F1', mel: 'F4 .  A4 .  C5 .  .  .  A4 .  G4 .  F4 .  .  . ' },
    { ch: 'C',  bass: 'C2', mel: 'C5 .  E5 .  G5 .  .  .  E5 .  D5 .  C5 .  .  . ' },
    { ch: 'G',  bass: 'G1', mel: 'G4 .  B4 .  D5 .  .  .  B4 .  A4 .  G4 .  B4 . ' },
    { ch: 'Am', bass: 'A1', mel: 'A4 .  C5 .  E5 .  A5 .  G5 .  E5 .  C5 .  .  . ' },
    { ch: 'F',  bass: 'F1', mel: 'F5 .  E5 .  C5 .  A4 .  F4 .  .  .  .  .  .  . ' },
    { ch: 'Dm', bass: 'D2', mel: 'D5 .  F5 .  A5 .  F5 .  E5 .  D5 .  .  .  .  . ' },
    { ch: 'E',  bass: 'E1', mel: 'E5 .  .  .  D5 .  C5 .  B4 .  .  .  .  .  E5 . ' }
  ],
  K: 'X...X.X.X...X...',
  S: '....S.......S...',
  H: 'h.h.h.hHh.h.h.hH',

  start() {
    if (this.on) return;
    Audio1.init(); Audio1.resume();
    FNFAudio.start(Audio1.ctx.currentTime);
    this.on = true;
    this.step = 0;
    this.next = Audio1.ctx.currentTime + 0.12;
    this.beat = 60 / 102; this.st = this.beat / 4;
    this.mel = this.BAR.map(b => bar16(b.mel));
    this.timer = setInterval(() => this.pump(), 25);
  },
  stop() {
    if (!this.on) return;
    this.on = false;
    clearInterval(this.timer); this.timer = null;
    FNFAudio.stop();
  },
  pump() {
    if (!this.on || !FNFAudio.running) return;
    const ctx = Audio1.ctx;
    while (this.next < ctx.currentTime - 0.012) { this.next += this.st; this.step++; }
    while (this.next < ctx.currentTime + 0.20) {
      this.hit(this.step, this.next);
      this.next += this.st; this.step++;
    }
  },
  hit(gs, t) {
    const b = Math.floor(gs / 16) % 8, s = gs % 16;
    const B = this.BAR[b], A = FNFAudio;
    const chord = CH[B.ch] || CH.Am;
    if (this.K[s] !== '.') { A.kick(t, 0.40); A.bass(t, hz(midi(B.bass)), this.st * 3, 0.20); }
    if (this.S[s] !== '.') { A.snare(t, 0.20); A.clap(t, 0.10); }
    if (this.H[s] !== '.') A.hat(t, this.H[s] === 'H' ? 0.075 : 0.045, this.H[s] === 'H');
    if (s % 4 === 2) A.stab(t, chord.map(m => m + 12), this.st * 2, 0.036);
    if (s % 2 === 1) A.arp(t, hz(chord[(s >> 1) % 3] + 24), this.st * 0.8, 0.016);
    const nm = this.mel[b][s];
    if (nm && nm !== '.' && nm !== '-') {
      let len = 1;
      for (let k = s + 1; k < 16 && (this.mel[b][k] === '.' || this.mel[b][k] === '-'); k++) len++;
      A.lead(t, hz(midi(nm)), this.st * len * 0.9, 0.055);
    }
    if (s === 0 && b === 0) A.crash(t, 0.08);
  }
};


/* =========================================================================
   Part 5m — FNF: the stage
   Baldi's schoolhouse, shot flat-on the way an FNF stage is: a backdrop,
   two singers facing each other, and a girlfriend on a speaker stack in the
   middle keeping time.  The camera slides between them and bops on the beat.
   ========================================================================= */

const FNF_LANE_COL = [0xc24b99, 0x00ffff, 0x12fa05, 0xf9393f];   /* the real ones */

function makeFNFStage() {
  const g = new THREE.Group();
  const M = c => new THREE.MeshLambertMaterial({ color: c });
  const B = c => new THREE.MeshBasicMaterial({ color: c });

  /* ---------------- the room ---------------- */
  const FLOORY = 0;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), (function () {
    const { c, x } = cv(64, 64);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      x.fillStyle = (i + j) % 2 ? '#b9b09a' : '#8e8672';
      x.fillRect(i * 8, j * 8, 8, 8);
    }
    x.globalAlpha = 0.16;
    for (let i = 0; i < 220; i++) {
      x.fillStyle = Math.random() < 0.5 ? '#000' : '#fff';
      x.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);
    }
    return new THREE.MeshLambertMaterial({ map: texFrom(c, 14, 8) });
  })());
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, FLOORY, -6); g.add(floor);

  /* the back wall — school green below, cream above, with a rail */
  const wall = box(120, 40, 1.2, M(0xd6c9a4)); wall.position.set(0, 20, -22); g.add(wall);
  const dado = box(120, 9, 1.5, M(0x5f7f5a)); dado.position.set(0, 4.5, -21.7); g.add(dado);
  const rail = box(120, 0.7, 1.9, M(0x8a6a3c)); rail.position.set(0, 9.2, -21.6); g.add(rail);
  const skirt = box(120, 1.4, 1.9, M(0x4a5f46)); skirt.position.set(0, 0.7, -21.6); g.add(skirt);

  /* the chalkboard, with the sum he was marking */
  const bFrame = box(34, 15, 0.9, M(0x6b4a2f)); bFrame.position.set(0, 15.5, -21.0); g.add(bFrame);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(32, 13), (function () {
    const { c, x } = cv(512, 208);
    x.fillStyle = '#2f4a35'; x.fillRect(0, 0, 512, 208);
    const gr = x.createRadialGradient(256, 90, 20, 256, 104, 300);
    gr.addColorStop(0, 'rgba(255,255,255,.10)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 512, 208);
    x.globalAlpha = 0.10; x.strokeStyle = '#fff'; x.lineWidth = 6;
    for (let i = 0; i < 26; i++) {
      x.beginPath();
      x.moveTo(Math.random() * 512, Math.random() * 208);
      x.lineTo(Math.random() * 512, Math.random() * 208); x.stroke();
    }
    x.globalAlpha = 1;
    x.fillStyle = '#f2f0e2'; x.font = 'bold 54px "Comic Sans MS", cursive';
    x.textAlign = 'center';
    x.fillText('NO ANIME', 256, 74);
    x.font = 'bold 40px "Comic Sans MS", cursive';
    x.fillText('IN MY SCHOOLHOUSE', 256, 132);
    x.strokeStyle = '#f2f0e2'; x.lineWidth = 7; x.lineCap = 'round';
    x.beginPath(); x.moveTo(120, 168); x.lineTo(392, 168); x.stroke();
    return new THREE.MeshLambertMaterial({ map: texFrom(c, 1, 1) });
  })());
  board.position.set(0, 15.5, -20.4); g.add(board);
  for (const cx of [-13, -9.4, 12]) {
    const ch = box(1.5, 0.5, 0.5, M(0xf4f2e6)); ch.position.set(cx, 8.4, -20.6); g.add(ch);
  }
  const duster = box(2.4, 1.0, 0.9, M(0x3a3a44)); duster.position.set(-6, 8.7, -20.6); g.add(duster);

  /* clock, always at the same time */
  const clock = new THREE.Mesh(new THREE.CircleGeometry(3.0, 22), (function () {
    const { c, x } = cv(128, 128);
    x.fillStyle = '#f6f3e6'; x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#2b2b33'; x.lineWidth = 6; x.stroke();
    x.lineWidth = 4;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      x.beginPath();
      x.moveTo(64 + Math.sin(a) * 50, 64 - Math.cos(a) * 50);
      x.lineTo(64 + Math.sin(a) * 56, 64 - Math.cos(a) * 56); x.stroke();
    }
    x.lineWidth = 7; x.lineCap = 'round';
    x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + 26, 64 - 14); x.stroke();
    x.lineWidth = 5;
    x.beginPath(); x.moveTo(64, 64); x.lineTo(64, 64 - 44); x.stroke();
    return new THREE.MeshLambertMaterial({ map: texFrom(c, 1, 1) });
  })());
  clock.position.set(23, 20.5, -20.9); g.add(clock);

  /* lockers down both sides */
  for (let i = 0; i < 12; i++) {
    const lx = (i < 6 ? -1 : 1) * (24 + (i % 6) * 6.4);
    const lk = box(6.0, 13, 3.2, M(0x3f6f7a));
    lk.position.set(lx, 6.5, -19.5); g.add(lk);
    const vent = box(3.4, 0.35, 0.4, M(0x2b4e57)); vent.position.set(lx, 11.4, -17.8); g.add(vent);
    const hd = box(0.5, 1.3, 0.4, M(0xcfcfd6)); hd.position.set(lx + 1.9, 6.2, -17.8); g.add(hd);
    const split = box(0.22, 13, 0.4, M(0x2b4e57)); split.position.set(lx, 6.5, -17.85); g.add(split);
  }

  /* strip lights, so there is something to bloom */
  for (const lx of [-30, 0, 30]) {
    const tube = box(14, 0.8, 2.4, B(0xfff6d8)); tube.position.set(lx, 33, -12); g.add(tube);
  }

  /* the speaker stack the girlfriend sits on */
  const spk = new THREE.Group(); spk.position.set(0, 0, -14); g.add(spk);
  for (let i = 0; i < 2; i++) {
    const cab = box(7.6, 5.2, 5.6, M(0x1c1c22));
    cab.position.set(0, 2.6 + i * 5.3, 0); spk.add(cab);
    for (const cy of [-1.1, 1.1]) {
      const cone = new THREE.Mesh(new THREE.CircleGeometry(1.55, 16), M(0x2e2e38));
      cone.position.set(0, 2.6 + i * 5.3 + cy, 2.85); spk.add(cone);
      const dust = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12), M(0x4a4a58));
      dust.position.set(0, 2.6 + i * 5.3 + cy, 2.92); spk.add(dust);
    }
  }
  const spkTop = box(8.2, 0.5, 6.2, M(0x2a2a34)); spkTop.position.set(0, 10.5, 0); spk.add(spkTop);

  /* Everything built so far is scenery.  Gather it into one group now so
     the game-over screen can switch the whole schoolhouse off and leave her
     alone in the dark, which is the entire point of that screen. */
  const env = new THREE.Group();
  while (g.children.length) env.add(g.children[0]);
  g.add(env);

  /* ---------------- the cast ---------------- */
  const baldi = makeBaldi();
  baldi.root.position.set(-15.5, 0, -6);
  baldi.root.scale.setScalar(2.35);
  baldi.root.rotation.y = 0.42;                 /* turned in towards her */
  g.add(baldi.root);

  const girl = makeAnimeGirl('normal');
  girl.root.position.set(15.5, 0, -6);
  girl.root.scale.setScalar(2.00);
  girl.root.rotation.y = -0.42;
  g.add(girl.root);

  const gf = makeAnimeGirl('cat');
  gf.root.position.set(0, 10.75, -14);
  gf.root.scale.setScalar(1.15);
  g.add(gf.root);

  /* a hard key on each singer so they read against the backdrop */
  const amb = new THREE.AmbientLight(0x9fa4d0, 0.62); g.add(amb);
  const keyL = new THREE.PointLight(0xffd0e8, 0.85, 60, 2); keyL.position.set(-16, 20, 8); g.add(keyL);
  const keyR = new THREE.PointLight(0xd0e8ff, 0.85, 60, 2); keyR.position.set(16, 20, 8); g.add(keyR);
  const fill = new THREE.DirectionalLight(0xfff0e0, 0.55); fill.position.set(0, 20, 26); g.add(fill);
  const rim = new THREE.DirectionalLight(0x7a6ad0, 0.40); rim.position.set(0, 8, -20); g.add(rim);

  /* a lamp for the game over screen, off until it is needed */
  const deathKey = new THREE.PointLight(0x7ea8ff, 0, 70, 2);
  deathKey.position.set(6, 22, 16); g.add(deathKey);
  const deathFill = new THREE.PointLight(0x2a2f6a, 0, 60, 2);
  deathFill.position.set(-10, 6, 6); g.add(deathFill);

  g.userData = { baldi: baldi, girl: girl, gf: gf, spk: spk, amb: amb, env: env,
                 keyL: keyL, keyR: keyR, fill: fill, rim: rim,
                 deathKey: deathKey, deathFill: deathFill,
                 board: board, clock: clock };
  return g;
}

/* -------------------------------------------------------------- posing
   Four sing poses per character plus an idle bop, all authored as target
   angles and eased into — the same trick the dance floor uses. */
const FNF_POSE_B = {
  /* [torsoZ, headZ, headX, armLx, armLz, armRx, armRz, foreL, foreR, lean] */
  idle:  [0, 0, -0.05, -0.10, -0.22, -0.10, 0.22, -0.15, -0.15, 0],
  left:  [0.20, -0.26, -0.06, -2.30, -0.95, -0.30, 0.30, -0.35, -0.20, -1.5],
  down:  [0, 0.02, 0.42, -0.55, -0.55, -0.55, 0.55, -1.30, -1.30, 0],
  up:    [0, 0, -0.55, -2.85, -0.42, -2.85, 0.42, -0.25, -0.25, 0],
  right: [-0.20, 0.26, -0.06, -0.30, -0.30, -2.30, 0.95, -0.20, -0.35, 1.5]
};

function poseBaldi(m, name, k, beatK, angry) {
  const P = FNF_POSE_B[name] || FNF_POSE_B.idle;
  const e = 1 - Math.exp(-k * 26);
  const R = m.__fnf || (m.__fnf = { v: FNF_POSE_B.idle.slice(), bob: 0 });
  for (let i = 0; i < P.length; i++) R.v[i] = lerp(R.v[i], P[i], e);
  const v = R.v;
  const bop = name === 'idle' ? Math.abs(Math.sin(beatK * Math.PI)) : 1;
  m.torso.rotation.set(0.04, 0.0, v[0]);
  m.head.rotation.set(v[2] - (1 - bop) * 0.06, 0, v[1]);
  m.armL.g.rotation.set(v[3], 0, v[4]);
  m.armR.g.rotation.set(v[5], 0, v[6]);
  m.armL.fore.rotation.x = v[7];
  m.armR.fore.rotation.x = v[8];
  m.root.position.x = -15.5 + v[9];
  m.root.position.y = (name === 'down' ? -0.55 : 0) + (1 - bop) * 0.30;
  const sq = name === 'down' ? 0.94 : 1;
  m.root.scale.set(2.35 * (2 - sq) * 0.99, 2.35 * sq, 2.35);
  void angry;
}

const FNF_POSE_G = {
  idle:  [0, 0, 0, -0.10, -0.16, -0.10, 0.16, 0, 0, 0],
  left:  [0.18, -0.24, -0.04, -2.20, -1.00, -0.28, 0.28, -0.40, -0.20, 1.3],
  down:  [0, 0.02, 0.40, -0.50, -0.60, -0.50, 0.60, -1.40, -1.40, 0],
  up:    [0, 0, -0.50, -2.80, -0.36, -2.80, 0.36, -0.30, -0.30, 0],
  right: [-0.18, 0.24, -0.04, -0.28, -0.28, -2.20, 1.00, -0.20, -0.40, -1.3]
};

function poseGirl(rig, name, k, beatK, mood) {
  const P = FNF_POSE_G[name] || FNF_POSE_G.idle;
  const e = 1 - Math.exp(-k * 26);
  const R = rig.__fnf || (rig.__fnf = { v: FNF_POSE_G.idle.slice() });
  for (let i = 0; i < P.length; i++) R.v[i] = lerp(R.v[i], P[i], e);
  const v = R.v;
  const bop = name === 'idle' ? Math.abs(Math.sin(beatK * Math.PI)) : 1;
  rig.torso.rotation.set(0.03, 0, v[0]);
  rig.head.rotation.set(v[2] - (1 - bop) * 0.05, 0, v[1]);
  rig.armL.g.rotation.set(v[3], 0, v[4]);
  rig.armR.g.rotation.set(v[5], 0, v[6]);
  rig.armL.fore.rotation.x = v[7];
  rig.armR.fore.rotation.x = v[8];
  rig.legL.rotation.set(name === 'down' ? -0.18 : 0, 0, 0);
  rig.legR.rotation.set(name === 'down' ? -0.18 : 0, 0, 0);
  rig.root.position.x = 15.5 + v[9];
  rig.root.position.y = (name === 'down' ? -0.45 : 0) + (1 - bop) * 0.26;
  const sq = name === 'down' ? 0.93 : 1;
  rig.root.scale.set(2.00 * (2 - sq) * 0.99, 2.00 * sq, 2.00);
  rig.setMood(mood);
  rig.wobble(beatK * 2 + (rig.__c = (rig.__c || 0) + 0.016), 1);
}


/* =========================================================================
   Part 5n — FNF: the songs
   Two tracks, written out rather than generated.  The chart and the melody
   are authored together, so the notes you are hitting are the tune.

   Chart notation — one character per sixteenth, sixteen to a bar:
     .          rest
     0 1 2 3    a note in that lane   (left, down, up, right)
     -          hold: extends whatever started before it
     a b c      two at once: 0+1, 0+2, 0+3
     d e f                   1+2, 1+3, 2+3
     h i                     0+1+2, 1+2+3
     g          all four
   ========================================================================= */

const LANE_PAIR = { a: [0, 1], b: [0, 2], c: [0, 3], d: [1, 2], e: [1, 3], f: [2, 3],
                    h: [0, 1, 2], i: [1, 2, 3], g: [0, 1, 2, 3] };

/* --------------------------------------------------------------- the kit */
const FNFAudio = {
  running: false, style: 'full',

  start(songT0) {
    Audio1.init(); Audio1.resume();
    const ctx = Audio1.ctx;
    this.ctx = ctx;
    this.bus = ctx.createGain(); this.bus.gain.value = 0.9;

    /* a short bright plate so nothing sounds like it is in a cupboard */
    const cv2 = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.1), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) * 0.55;
      }
    }
    cv2.buffer = buf;
    this.wet = ctx.createGain(); this.wet.gain.value = 0.30;
    this.wet.connect(cv2); cv2.connect(Audio1.master || ctx.destination);

    /* the eighth-note delay every FNF track has on the lead */
    this.dly = ctx.createDelay(1.0);
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const dlyLo = ctx.createBiquadFilter(); dlyLo.type = 'lowpass'; dlyLo.frequency.value = 3200;
    this.dly.connect(dlyLo); dlyLo.connect(fb); fb.connect(this.dly);
    this.dlyG = ctx.createGain(); this.dlyG.gain.value = 0.24;
    this.dly.connect(this.dlyG); this.dlyG.connect(this.bus);

    /* the amp the supersaws go through */
    const ws = ctx.createWaveShaper();
    const cu = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; cu[i] = Math.tanh(x * 2.1) * 0.94; }
    ws.curve = cu; ws.oversample = '2x';
    const amLo = ctx.createBiquadFilter(); amLo.type = 'lowpass'; amLo.frequency.value = 7200;
    ws.connect(amLo); amLo.connect(this.bus);
    this.drive = ws;

    this.bus.connect(Audio1.master || ctx.destination);
    /* Tone drives the instruments if it loaded; the hand-rolled kit is the
       fallback, and either way the voices below stay on raw Web Audio */
    this.rack = (typeof FNFTone !== 'undefined' && FNFTone.init()) ? FNFTone : this;
    this.running = true;
    this.t0 = songT0;
  },
  stop() {
    this.running = false;
    try { if (this.bus) this.bus.disconnect(); if (this.wet) this.wet.disconnect();
          if (this.dlyG) this.dlyG.disconnect(); if (this.drive) this.drive.disconnect(); } catch (e) {}
    this.bus = null;
  },
  send(node, amt) { if (amt > 0 && this.wet) { const g = this.ctx.createGain(); g.gain.value = amt; node.connect(g); g.connect(this.wet); } },

  noise(t, dur, type, freq, vol, q) {
    if (!this.bus) return null;
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = Audio1.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    if (q) f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.bus);
    s.start(t); s.stop(t + dur + 0.02);
    return g;
  },

  kick(t, vol) {
    if (!this.bus) return;
    const ctx = this.ctx, v = vol == null ? 0.62 : vol;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(168, t);
    o.frequency.exponentialRampToValueAtTime(43, t + 0.10);
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.30);
    o.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + 0.33);
    this.noise(t, 0.014, 'highpass', 2600, v * 0.42);       // beater click
  },
  snare(t, vol) {
    if (!this.bus) return;
    const ctx = this.ctx, v = vol == null ? 0.40 : vol;
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(330, t);
    o.frequency.exponentialRampToValueAtTime(168, t + 0.055);
    const g = ctx.createGain();
    g.gain.setValueAtTime(v * 0.65, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 0.15);
    const n = this.noise(t, 0.135, 'highpass', 1750, v, 0.7);
    this.send(n, 0.30);
  },
  hat(t, vol, open) {
    const n = this.noise(t, open ? 0.16 : 0.028, 'highpass', 8600, (vol == null ? 0.16 : vol));
    if (open) this.send(n, 0.14);
  },
  clap(t, vol) {
    for (let i = 0; i < 3; i++)
      this.noise(t + i * 0.011, 0.07, 'bandpass', 1500, (vol || 0.26) * (1 - i * 0.2), 1.6);
  },
  crash(t, vol) {
    const n = this.noise(t, 1.5, 'highpass', 5200, (vol == null ? 0.20 : vol));
    this.send(n, 0.55);
  },

  /* a fat detuned sub — the thing that makes an FNF track move */
  bass(t, f, dur, vol) {
    if (!this.bus) return;
    const ctx = this.ctx, v = vol == null ? 0.30 : vol;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.006);
    g.gain.setValueAtTime(v, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 5;
    lp.frequency.setValueAtTime(Math.min(4200, f * 9), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(90, f * 2.2), t + dur * 0.8);
    for (const [ty, det, mul] of [['sawtooth', -7, 1], ['sawtooth', 7, 1], ['sine', 0, 0.5]]) {
      const o = ctx.createOscillator(); o.type = ty;
      o.frequency.value = f * mul; o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    }
    lp.connect(g); g.connect(this.bus);
  },
  /* seven-saw stab, the chorus chord sound */
  stab(t, midis, dur, vol) {
    if (!this.bus) return;
    const ctx = this.ctx, v = (vol == null ? 0.085 : vol);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3.5;
    lp.frequency.setValueAtTime(6200, t);
    lp.frequency.exponentialRampToValueAtTime(1500, t + dur);
    for (const m of midis) {
      for (const det of [-14, -5, 5, 14]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = hz(m); o.detune.value = det;
        o.connect(lp); o.start(t); o.stop(t + dur + 0.04);
      }
    }
    lp.connect(g); g.connect(this.drive || this.bus);
    this.send(g, 0.34);
  },
  /* the hook.  Square-ish, delayed, sits right on top of everything */
  lead(t, f, dur, vol) {
    if (!this.bus) return;
    const ctx = this.ctx, v = vol == null ? 0.10 : vol;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.010);
    g.gain.setValueAtTime(v * 0.85, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = 5400; lp.Q.value = 1.2;
    for (const [ty, det, mul, amp] of [['square', -6, 1, 1], ['sawtooth', 8, 1, 0.5], ['square', 0, 2, 0.16]]) {
      const o = ctx.createOscillator(); o.type = ty;
      o.frequency.value = f * mul; o.detune.value = det;
      const a = ctx.createGain(); a.gain.value = amp;
      o.connect(a); a.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    }
    lp.connect(g); g.connect(this.bus);
    this.send(g, 0.26);
    if (this.dly) { const d = ctx.createGain(); d.gain.value = 0.5; g.connect(d); d.connect(this.dly); }
  },
  arp(t, f, dur, vol) {
    if (!this.bus) return;
    const ctx = this.ctx, v = vol == null ? 0.045 : vol;
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + dur + 0.02);
    this.send(g, 0.30);
  },
  riser(t, dur) {
    if (!this.bus) return;
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = Audio1.noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3.5;
    f.frequency.setValueAtTime(320, t);
    f.frequency.exponentialRampToValueAtTime(7200, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + dur * 0.92);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.10);
    s.connect(f); f.connect(g); g.connect(this.bus);
    s.start(t); s.stop(t + dur + 0.2);
    this.send(g, 0.5);
  },

  /* ---------------------------------------------------------- the voices
     Two characters, two very different throats.  Both are one oscillator
     pair through a pair of formant peaks — which is the cheapest thing that
     still reads as a mouth rather than a beep. */
  formant(t, f, dur, vol, cfg) {
    if (!this.bus) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(vol, t + cfg.atk);
    out.gain.setValueAtTime(vol * 0.9, t + dur * 0.55);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    out.connect(this.bus);
    this.send(out, cfg.send);

    /* the vowel peaks, in series — they are EQ, not resonators, so running
       them in parallel would just triple the level and lose the vowel */
    const chain = ctx.createBiquadFilter(); chain.type = 'lowpass';
    chain.frequency.setValueAtTime(cfg.lp, t);
    chain.frequency.exponentialRampToValueAtTime(cfg.lp * 0.55, t + dur);
    chain.Q.value = 1;
    let tail = chain;
    for (const [fq, q, gn] of cfg.form) {
      const bp = ctx.createBiquadFilter(); bp.type = 'peaking';
      bp.frequency.value = fq; bp.Q.value = q; bp.gain.value = gn;
      tail.connect(bp); tail = bp;
    }
    tail.connect(out);

    for (const [ty, mul, det, amp] of cfg.osc) {
      const o = ctx.createOscillator(); o.type = ty;
      o.frequency.setValueAtTime(f * mul * cfg.bend, t);
      o.frequency.exponentialRampToValueAtTime(f * mul, t + cfg.bendT);
      o.detune.value = det;
      if (cfg.vib) {
        const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = cfg.vib;
        const lg = ctx.createGain(); lg.gain.value = cfg.vibA;
        lfo.connect(lg); lg.connect(o.detune); lfo.start(t); lfo.stop(t + dur + 0.05);
      }
      const a = ctx.createGain(); a.gain.value = amp;
      o.connect(a); a.connect(chain); o.start(t); o.stop(t + dur + 0.05);
    }
  },
  /* Baldi: low, buzzy, and he is not enjoying himself */
  voiceBaldi(t, f, dur) {
    this.formant(t, f * 0.5, Math.max(0.09, Math.min(dur, 0.42)), 0.115, {
      atk: 0.012, send: 0.20, lp: 2600, bend: 0.86, bendT: 0.045, vib: 5.5, vibA: 14,
      osc: [['sawtooth', 1, -9, 1], ['square', 1, 11, 0.45], ['sawtooth', 2, 0, 0.13]],
      form: [[520, 6, 11], [1180, 7, 8], [2450, 5, -6]]
    });
  },
  /* the anime girl: an octave up, breathy, and far too pleased about it */
  voiceGirl(t, f, dur) {
    this.formant(t, f, Math.max(0.08, Math.min(dur, 0.38)), 0.095, {
      atk: 0.008, send: 0.34, lp: 5200, bend: 1.10, bendT: 0.035, vib: 6.8, vibA: 20,
      osc: [['triangle', 1, 0, 1], ['sine', 2, 6, 0.30], ['sawtooth', 1, -8, 0.14]],
      form: [[760, 7, 12], [1900, 8, 9], [3100, 6, 4]]
    });
    this.noise(t, 0.05, 'bandpass', 3800, 0.020, 2.2);       // a little breath
  },
  miss(t) {
    if (!this.bus) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.20);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.10, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    o.connect(lp); lp.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + 0.24);
    this.noise(t, 0.12, 'bandpass', 340, 0.075, 1.2);
  },
  menuBlip(t, up) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(up ? 620 : 480, t);
    o.frequency.exponentialRampToValueAtTime(up ? 880 : 340, t + 0.055);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.055, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(Audio1.master || ctx.destination);
    o.start(t); o.stop(t + 0.11);
  },
  confirm(t) {
    const ctx = this.ctx;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime([523, 659, 784][i], t + i * 0.055);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.06, t + i * 0.055);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.055 + 0.20);
      o.connect(g); g.connect(Audio1.master || ctx.destination);
      o.start(t + i * 0.055); o.stop(t + i * 0.055 + 0.22);
    }
  }
};

/* =========================================================================
   The two songs.

   A section is one musical idea: who is singing it, the chart, the chords
   underneath, the lead line on top, and which drum groove is running.
   Everything is measured in bars of sixteen sixteenths.
   ========================================================================= */

/* drum grooves, one character per sixteenth */
const FNF_GROOVE = {
  none:  { k: '................', s: '................', h: '................' },
  soft:  { k: 'X.......X.......', s: '................', h: '..h...h...h...h.' },
  half:  { k: 'X.......X.......', s: '....S.......S...', h: 'h.h.h.h.h.h.h.h.' },
  four:  { k: 'X...X...X...X...', s: '....S.......S...', h: 'h.h.h.h.h.h.h.h.' },
  trap:  { k: 'X.....X...X.....', s: '....S.......S...', h: 'hhh.hhh.hhh.hhhh' },
  drive: { k: 'X..X..X.X..X..X.', s: '....S.......S...', h: 'hhhhhhhhhhhhhhhh' },
  boss:  { k: 'X.XX..X.X.XX..X.', s: '....S...S...S..S', h: 'hhhhhhhhhhhhhhhh' },
  fill:  { k: 'X.......X...X.X.', s: '....S...S.S.SSSS', h: 'h.h.h.h.........' }
};

const CH = {                                   /* chord voicings, as MIDI */
  Am: [57, 60, 64], F: [53, 57, 60], G: [55, 59, 62], E: [52, 56, 59],
  Dm: [50, 53, 57], C: [48, 52, 55], Bb: [46, 50, 53], Em: [52, 55, 59],
  Fm: [53, 56, 60], Gm: [55, 58, 62], Bdim: [47, 50, 53], Csus: [48, 53, 55]
};
const CH_ROOT = { Am: 33, F: 29, G: 31, E: 28, Dm: 26, C: 24, Bb: 22, Em: 28,
                  Fm: 29, Gm: 31, Bdim: 23, Csus: 24 };

/* ---------------------------------------------------------- 1 · DETENTION
   156 BPM, A minor.  He starts it, she answers, and halfway through he stops
   the song to tell her exactly what the problem is. */
const SONG_DETENTION = {
  id: 'detention', name: 'DETENTION', bpm: 156, colour: 0x2f6f3a, icon: 'baldi',
  blurb: 'He caught you with a book. Sit down.',
  sections: [
    { who: 'o', groove: 'none', ch: ['Am'], vol: 0,
      pat: ['................'],
      mel: ['-  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . '] },

    /* the bell */
    { who: 'o', groove: 'soft', ch: ['Am', 'Am'], crash: 1,
      pat: ['0.......2.......',
            '3.......1.......'],
      mel: ['A4 .  .  .  .  .  .  .  E5 .  .  .  .  .  .  . ',
            'C5 .  .  .  .  .  .  .  B4 .  .  .  .  .  .  . '] },

    { who: 'o', groove: 'half', ch: ['Am', 'F', 'G', 'E'],
      pat: ['0.1.2.3.........',
            '3.2.1.0.........',
            '0.1.2.3.2.1.....',
            '3-------........'],
      mel: ['A4 .  B4 .  C5 .  E5 .  .  .  .  .  .  .  .  . ',
            'F5 .  E5 .  C5 .  A4 .  .  .  .  .  .  .  .  . ',
            'A4 .  B4 .  C5 .  E5 .  D5 .  B4 .  .  .  .  . ',
            'E5 .  .  .  .  .  .  .  .  .  .  .  .  .  .  . '] },

    { who: 'p', groove: 'half', ch: ['Am', 'F', 'G', 'E'],
      pat: ['0.1.2.3.........',
            '3.2.1.0.........',
            '0.1.2.3.2.1.0...',
            '3-------..0.1.2.'],
      mel: ['A4 .  B4 .  C5 .  E5 .  .  .  .  .  .  .  .  . ',
            'F5 .  E5 .  C5 .  A4 .  .  .  .  .  .  .  .  . ',
            'A4 .  B4 .  C5 .  E5 .  D5 .  B4 .  A4 .  .  . ',
            'E5 .  .  .  .  .  .  .  .  .  C5 .  D5 .  E5 . '] },

    /* verse 2 — he starts doubling up */
    { who: 'o', groove: 'four', ch: ['Am', 'Am', 'F', 'G'],
      pat: ['0.0.2.2.1.1.3.3.',
            '0.2.1.3.0.2.1.3.',
            'a...d...f...c...',
            '3.2.1.0.1.2.3...'],
      mel: ['A4 .  A4 .  E5 .  E5 .  C5 .  C5 .  G5 .  G5 . ',
            'A4 .  E5 .  C5 .  G5 .  A4 .  E5 .  C5 .  G5 . ',
            'F5 .  .  .  A5 .  .  .  C6 .  .  .  A5 .  .  . ',
            'G5 .  F5 .  E5 .  D5 .  E5 .  F5 .  G5 .  .  . '] },

    { who: 'p', groove: 'four', ch: ['Am', 'Am', 'F', 'G'],
      pat: ['0.0.2.2.1.1.3.3.',
            '0.2.1.3.0.2.1.3.',
            'a...d...f...c...',
            '3.2.1.0.1.2.3.g.'],
      mel: ['A4 .  A4 .  E5 .  E5 .  C5 .  C5 .  G5 .  G5 . ',
            'A4 .  E5 .  C5 .  G5 .  A4 .  E5 .  C5 .  G5 . ',
            'F5 .  .  .  A5 .  .  .  C6 .  .  .  A5 .  .  . ',
            'G5 .  F5 .  E5 .  D5 .  E5 .  F5 .  G5 .  A5 . '] },

    /* chorus */
    { who: 'o', groove: 'drive', ch: ['Am', 'F', 'C', 'G'], crash: 1, stab: 1,
      pat: ['0.2.0.2.1.3.1.3.',
            '3.1.3.1.2.0.2.0.',
            '0123012301230123',
            'g.......f...c...'],
      mel: ['A5 .  E5 .  A5 .  E5 .  C5 .  G5 .  C5 .  G5 . ',
            'F5 .  C5 .  F5 .  C5 .  A4 .  E5 .  A4 .  E5 . ',
            'C5 .  E5 .  G5 .  C6 .  G5 .  E5 .  C5 .  G4 . ',
            'G5 .  .  .  .  .  .  .  B5 .  .  .  D6 .  .  . '] },

    { who: 'p', groove: 'drive', ch: ['Am', 'F', 'C', 'G'], stab: 1,
      pat: ['0.2.0.2.1.3.1.3.',
            '3.1.3.1.2.0.2.0.',
            '0123012301230123',
            '3210321032103210'],
      mel: ['A5 .  E5 .  A5 .  E5 .  C5 .  G5 .  C5 .  G5 . ',
            'F5 .  C5 .  F5 .  C5 .  A4 .  E5 .  A4 .  E5 . ',
            'C5 .  E5 .  G5 .  C6 .  G5 .  E5 .  C5 .  G4 . ',
            'G5 .  F5 .  E5 .  D5 .  C5 .  B4 .  A4 .  G4 . '] },

    /* trading fours */
    { who: 'x', groove: 'trap', ch: ['Dm', 'Am', 'Bb', 'E'], arp: 1,
      pat: ['0.1.2.3.........',
            '........3.2.1.0.',
            '0.1.2.3.........',
            '........g...g.g.'],
      side: ['oooooooo........',
             '........pppppppp',
             'oooooooo........',
             '........pppppppp'],
      mel: ['D5 .  F5 .  A5 .  D6 .  .  .  .  .  .  .  .  . ',
            '.  .  .  .  .  .  .  .  C6 .  A5 .  E5 .  A4 . ',
            'Bb4 . D5 .  F5 .  Bb5 . .  .  .  .  .  .  .  . ',
            '.  .  .  .  .  .  .  .  E5 .  .  .  E5 .  E5 . '] },

    /* he stops playing.  Two bars of nothing but a held chord, and then he
       comes over to the desk. */
    { who: 'o', groove: 'soft', ch: ['Am', 'Bdim'], quiet: 1,
      pat: ['0.......1.......',
            '2.......3.......'],
      mel: ['A4 .  .  .  .  .  .  .  B4 .  .  .  .  .  .  . ',
            'C5 .  .  .  .  .  .  .  -  .  .  .  .  .  .  . '] },

    /* ================= THE MID-SONG CUTSCENE ================= */
    { who: 'o', groove: 'none', ch: ['Am', 'Am', 'F', 'F', 'Bdim', 'Bdim', 'E', 'E'],
      cut: {
        id: 'detention',
        lines: [
          { t: 1.4, s: 'Do you know what this is?' },
          { t: 4.6, s: "It's ANIME." },
          { t: 7.4, s: 'In MY schoolhouse.', mad: 1 },
          { t: 10.4, s: "Let's play a different game.", roar: 1 }
        ]
      },
      pat: ['................', '................', '................', '................',
            '................', '................', '................', '................'],
      mel: ['-  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . '] },

    /* the drop */
    { who: 'o', groove: 'boss', ch: ['Am', 'Am', 'F', 'G'], crash: 1, stab: 1, arp: 1,
      pat: ['g...0.1.2.3.g...',
            '0.2.1.3.0.2.1.3.',
            'c...b...e...d...',
            '3.2.1.0.g...g.g.'],
      mel: ['A4 .  A4 .  C5 .  E5 .  A5 .  .  .  A5 .  .  . ',
            'A5 .  E5 .  C5 .  G5 .  A5 .  E5 .  C5 .  G5 . ',
            'F5 .  .  .  A5 .  .  .  C6 .  .  .  F6 .  .  . ',
            'G5 .  F5 .  E5 .  D5 .  G5 .  .  .  G5 .  G5 . '] },

    { who: 'p', groove: 'boss', ch: ['Am', 'Am', 'F', 'G'], stab: 1, arp: 1,
      pat: ['g...0.1.2.3.g...',
            '0.2.1.3.0.2.1.3.',
            'c...b...e...d...',
            '0123321001233210'],
      mel: ['A4 .  A4 .  C5 .  E5 .  A5 .  .  .  A5 .  .  . ',
            'A5 .  E5 .  C5 .  G5 .  A5 .  E5 .  C5 .  G5 . ',
            'F5 .  .  .  A5 .  .  .  C6 .  .  .  F6 .  .  . ',
            'A5 .  G5 .  F5 .  E5 .  D5 .  C5 .  B4 .  A4 . '] },

    /* second chorus, up a fifth in feel */
    { who: 'o', groove: 'boss', ch: ['Dm', 'Bb', 'F', 'C'], crash: 1, stab: 1, arp: 1,
      pat: ['0123012301230123',
            'a...f...d...c...',
            '3.1.2.0.3.1.2.0.',
            'g...g...g...g...'],
      mel: ['D5 .  F5 .  A5 .  D6 .  A5 .  F5 .  D5 .  A4 . ',
            'Bb5 . .  .  D6 .  .  .  F6 .  .  .  D6 .  .  . ',
            'C6 .  A5 .  F5 .  C5 .  F5 .  A5 .  C6 .  F6 . ',
            'C6 .  .  .  E6 .  .  .  G6 .  .  .  C6 .  .  . '] },

    { who: 'p', groove: 'boss', ch: ['Dm', 'Bb', 'F', 'C'], stab: 1, arp: 1,
      pat: ['0123012301230123',
            'a...f...d...c...',
            '3.1.2.0.3.1.2.0.',
            '0.1.2.3.g...g.g.'],
      mel: ['D5 .  F5 .  A5 .  D6 .  A5 .  F5 .  D5 .  A4 . ',
            'Bb5 . .  .  D6 .  .  .  F6 .  .  .  D6 .  .  . ',
            'C6 .  A5 .  F5 .  C5 .  F5 .  A5 .  C6 .  F6 . ',
            'F5 .  A5 .  C6 .  F6 .  C6 .  .  .  C6 .  C6 . '] },

    /* both of them at once, half a bar each */
    { who: 'x', groove: 'boss', ch: ['Am', 'E', 'Am', 'E'], stab: 1, arp: 1,
      pat: ['0.2.1.3.0.2.1.3.',
            '3.1.2.0.3.1.2.0.',
            'a.f.a.f.d.c.d.c.',
            'g...g...g...gggg'],
      side: ['oooooooopppppppp',
             'oooooooopppppppp',
             'oooopppposososos',
             'oooopppposospppp'],
      mel: ['A5 .  E5 .  C5 .  A4 .  A5 .  E5 .  C5 .  A4 . ',
            'E6 .  B5 .  G#5 . E5 .  E6 .  B5 .  G#5 . E5 . ',
            'A5 .  C6 .  E6 .  A6 .  G6 .  E6 .  C6 .  A5 . ',
            'A5 .  .  .  C6 .  .  .  E6 .  .  .  A6 A6 A6 A6'] },

    /* last time round */
    { who: 'o', groove: 'boss', ch: ['Am', 'F', 'G', 'E'], crash: 1, stab: 1, arp: 1,
      pat: ['0.2.0.2.1.3.1.3.',
            '0123321001233210',
            'c...b...e...d...',
            'g...g...g...g...'],
      mel: ['A5 .  E5 .  A5 .  E5 .  C5 .  G5 .  C5 .  G5 . ',
            'C6 .  B5 .  A5 .  G5 .  F5 .  E5 .  D5 .  C5 . ',
            'G5 .  .  .  B5 .  .  .  D6 .  .  .  G6 .  .  . ',
            'E6 .  .  .  E6 .  .  .  E6 .  .  .  E6 .  .  . '] },

    { who: 'p', groove: 'boss', ch: ['Am', 'F', 'G', 'E'], stab: 1, arp: 1,
      pat: ['0.2.0.2.1.3.1.3.',
            '0123321001233210',
            'c...b...e...d...',
            '0123012332103210'],
      mel: ['A5 .  E5 .  A5 .  E5 .  C5 .  G5 .  C5 .  G5 . ',
            'C6 .  B5 .  A5 .  G5 .  F5 .  E5 .  D5 .  C5 . ',
            'G5 .  .  .  B5 .  .  .  D6 .  .  .  G6 .  .  . ',
            'A5 .  C6 .  E6 .  A6 .  A6 .  E6 .  C6 .  A5 . '] },

    { who: 'o', groove: 'fill', ch: ['Am', 'Am'], crash: 1,
      pat: ['0.......g.......',
            'g...............'],
      mel: ['A4 .  .  .  .  .  .  .  A5 .  .  .  .  .  .  . ',
            'A4 .  .  .  .  .  .  .  .  .  .  .  .  .  .  . '] }
  ]
};

/* ---------------------------------------------------------- 2 · EXPULSION
   178 BPM, D minor.  The one he means, and the cutscene is where he stops
   pretending it is about the notebooks. */
const SONG_EXPULSION = {
  id: 'expulsion', name: 'EXPULSION', bpm: 178, colour: 0x8a1f24, icon: 'baldiMad',
  blurb: 'No more warnings. Out of my schoolhouse.',
  sections: [
    { who: 'o', groove: 'none', ch: ['Dm'], vol: 0,
      pat: ['................'],
      mel: ['-  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . '] },

    { who: 'o', groove: 'soft', ch: ['Dm', 'Dm'], riser: 1,
      pat: ['g...............',
            '................'],
      mel: ['D4 .  .  .  .  .  .  .  .  .  .  .  .  .  .  . ',
            '-  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . '] },

    { who: 'o', groove: 'drive', ch: ['Dm', 'Bb', 'F', 'C'], crash: 1, stab: 1,
      pat: ['0.1.2.3.3.2.1.0.',
            '2.3.0.1.1.0.3.2.',
            '0.0.1.1.2.2.3.3.',
            'g...c...b...e...'],
      mel: ['D5 .  E5 .  F5 .  A5 .  A5 .  F5 .  E5 .  D5 . ',
            'F5 .  Bb5 . D5 .  F5 .  F5 .  D5 .  Bb4 . F4 . ',
            'A4 .  A4 .  C5 .  C5 .  F5 .  F5 .  A5 .  A5 . ',
            'C6 .  .  .  A5 .  .  .  F5 .  .  .  C5 .  .  . '] },

    { who: 'p', groove: 'drive', ch: ['Dm', 'Bb', 'F', 'C'], stab: 1,
      pat: ['0.1.2.3.3.2.1.0.',
            '2.3.0.1.1.0.3.2.',
            '0.0.1.1.2.2.3.3.',
            'g...c...b...e.g.'],
      mel: ['D5 .  E5 .  F5 .  A5 .  A5 .  F5 .  E5 .  D5 . ',
            'F5 .  Bb5 . D5 .  F5 .  F5 .  D5 .  Bb4 . F4 . ',
            'A4 .  A4 .  C5 .  C5 .  F5 .  F5 .  A5 .  A5 . ',
            'C6 .  .  .  A5 .  .  .  F5 .  .  .  C5 .  D6 . '] },

    /* the jack section — same lane, hammered */
    { who: 'x', groove: 'boss', ch: ['Dm', 'Dm', 'Gm', 'E'], arp: 1,
      pat: ['0000....2222....',
            '....1111....3333',
            '0000....2222....',
            '....g...g...g.g.'],
      side: ['oooooooo........',
             '........pppppppp',
             'oooooooo........',
             '........pppppppp'],
      mel: ['D5 .  .  .  .  .  .  .  A5 .  .  .  .  .  .  . ',
            '.  .  .  .  F5 .  .  .  .  .  .  .  D6 .  .  . ',
            'G5 .  .  .  .  .  .  .  D6 .  .  .  .  .  .  . ',
            '.  .  .  .  E5 .  .  .  A5 .  .  .  D6 .  E6 . '] },

    { who: 'o', groove: 'boss', ch: ['Dm', 'F', 'Gm', 'E'], crash: 1, stab: 1, arp: 1,
      pat: ['0123012301230123',
            '3210321032103210',
            '0.2.1.3.0.2.1.3.',
            'g...g...g...g...'],
      mel: ['D5 .  F5 .  A5 .  D6 .  A5 .  F5 .  D5 .  A4 . ',
            'C6 .  A5 .  F5 .  C5 .  F5 .  A5 .  C6 .  F6 . ',
            'G5 .  D6 .  Bb5 . G5 .  D5 .  A5 .  F5 .  D5 . ',
            'A5 .  .  .  C6 .  .  .  E6 .  .  .  A6 .  .  . '] },

    { who: 'p', groove: 'boss', ch: ['Dm', 'F', 'Gm', 'E'], stab: 1, arp: 1,
      pat: ['0123012301230123',
            '3210321032103210',
            '0.2.1.3.0.2.1.3.',
            '0123321001233210'],
      mel: ['D5 .  F5 .  A5 .  D6 .  A5 .  F5 .  D5 .  A4 . ',
            'C6 .  A5 .  F5 .  C5 .  F5 .  A5 .  C6 .  F6 . ',
            'G5 .  D6 .  Bb5 . G5 .  D5 .  A5 .  F5 .  D5 . ',
            'D6 .  C6 .  Bb5 . A5 .  G5 .  F5 .  E5 .  D5 . '] },

    /* breakdown: almost nothing */
    { who: 'x', groove: 'half', ch: ['Bb', 'Bb', 'E', 'E'], quiet: 1,
      pat: ['0-------........',
            '........3-------',
            '1---2---3---0---',
            '................'],
      side: ['oooooooo........',
             '........pppppppp',
             'oooooooooooooooo',
             '................'],
      mel: ['Bb4 . .  .  .  .  .  .  .  .  .  .  .  .  .  . ',
            '.  .  .  .  .  .  .  .  F5 .  .  .  .  .  .  . ',
            'D5 .  .  .  E5 .  .  .  F5 .  .  .  A5 .  .  . ',
            '-  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . '] },

    { who: 'o', groove: 'soft', ch: ['E', 'E'], quiet: 1,
      pat: ['0.......3.......',
            '................'],
      mel: ['E5 .  .  .  .  .  .  .  A5 .  .  .  .  .  .  . ',
            '-  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . '] },

    /* ================= THE MID-SONG CUTSCENE ================= */
    { who: 'o', groove: 'none', ch: ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'E', 'E'],
      cut: {
        id: 'expulsion',
        lines: [
          { t: 1.2, s: 'I have been very patient with you.' },
          { t: 4.2, s: 'No more warnings.' },
          { t: 6.6, s: 'No more detention.', mad: 1 },
          { t: 9.4, s: 'GET OUT OF MY SCHOOL.', roar: 1 }
        ]
      },
      pat: ['................', '................', '................', '................',
            '................', '................', '................', '................'],
      mel: ['-  .  .  .  .  .  .  .  .  .  .  .  .  .  .  . '] },

    /* phase two */
    { who: 'o', groove: 'boss', ch: ['Dm', 'Dm', 'Gm', 'E'], crash: 1, stab: 1, arp: 1,
      pat: ['g...g...0123g...',
            '0.1.2.3.3.2.1.0.',
            'a...d...f...c...',
            'g...g...g...g.g.'],
      mel: ['D5 .  .  .  D6 .  .  .  D5 F5 A5 D6 D6 .  .  . ',
            'D5 .  E5 .  F5 .  A5 .  A5 .  F5 .  E5 .  D5 . ',
            'G5 .  .  .  Bb5 . .  .  D6 .  .  .  G6 .  .  . ',
            'E6 .  .  .  E6 .  .  .  E6 .  .  .  E6 .  E6 . '] },

    { who: 'p', groove: 'boss', ch: ['Dm', 'Dm', 'Gm', 'E'], stab: 1, arp: 1,
      pat: ['g...g...0123g...',
            '0.1.2.3.3.2.1.0.',
            'a...d...f...c...',
            '0123321001233210'],
      mel: ['D5 .  .  .  D6 .  .  .  D5 F5 A5 D6 D6 .  .  . ',
            'D5 .  E5 .  F5 .  A5 .  A5 .  F5 .  E5 .  D5 . ',
            'G5 .  .  .  Bb5 . .  .  D6 .  .  .  G6 .  .  . ',
            'D6 .  C6 .  Bb5 . A5 .  G5 .  F5 .  E5 .  D5 . '] },

    /* the finale — runs on both sides */
    { who: 'o', groove: 'boss', ch: ['Dm', 'Bb', 'F', 'E'], crash: 1, stab: 1, arp: 1,
      pat: ['0123012332103210',
            'c.c.b.b.e.e.d.d.',
            '0.1.2.3.0.1.2.3.',
            'g...g...g...g.g.'],
      mel: ['D5 .  F5 .  A5 .  D6 .  D6 .  A5 .  F5 .  D5 . ',
            'Bb5 . .  .  D6 .  .  .  F6 .  .  .  D6 .  .  . ',
            'F5 .  A5 .  C6 .  F6 .  C6 .  A5 .  F5 .  C5 . ',
            'A5 .  .  .  C6 .  .  .  E6 .  .  .  A6 .  A6 . '] },

    { who: 'p', groove: 'boss', ch: ['Dm', 'Bb', 'F', 'E'], stab: 1, arp: 1,
      pat: ['0123012332103210',
            'c.c.b.b.e.e.d.d.',
            '0.1.2.3.0.1.2.3.',
            '0123321001233210'],
      mel: ['D5 .  F5 .  A5 .  D6 .  D6 .  A5 .  F5 .  D5 . ',
            'Bb5 . .  .  D6 .  .  .  F6 .  .  .  D6 .  .  . ',
            'F5 .  A5 .  C6 .  F6 .  C6 .  A5 .  F5 .  C5 . ',
            'D6 .  C6 .  Bb5 . A5 .  G5 .  F5 .  E5 .  D5 . '] },

    { who: 'x', groove: 'boss', ch: ['Dm', 'E', 'Dm', 'E'], crash: 1, stab: 1, arp: 1,
      pat: ['0.2.1.3.0.2.1.3.',
            '3.1.2.0.3.1.2.0.',
            'a.f.a.f.d.c.d.c.',
            'g...g...g...gggg'],
      side: ['oooooooopppppppp',
             'oooooooopppppppp',
             'oooopppposososos',
             'oooopppposospppp'],
      mel: ['D5 .  A5 .  F5 .  D6 .  D5 .  A5 .  F5 .  D6 . ',
            'A5 .  E5 .  C6 .  A4 .  A5 .  E5 .  C6 .  A4 . ',
            'D5 .  F5 .  A5 .  D6 .  E6 .  C6 .  A5 .  E5 . ',
            'D6 .  .  .  A5 .  .  .  F5 .  .  .  D6 D6 D6 D6'] },

    /* and once more, faster */
    { who: 'o', groove: 'boss', ch: ['Gm', 'Dm', 'Bb', 'E'], crash: 1, stab: 1, arp: 1,
      pat: ['0000222211113333',
            '0123012301230123',
            'c...b...e...d...',
            'g.g.g.g.g.g.g.g.'],
      mel: ['G5 .  .  .  D6 .  .  .  Bb5 . .  .  F6 .  .  . ',
            'D5 .  F5 .  A5 .  D6 .  F6 .  D6 .  A5 .  F5 . ',
            'Bb5 . .  .  D6 .  .  .  F6 .  .  .  Bb6 . .  . ',
            'E6 .  E6 .  E6 .  E6 .  E6 .  E6 .  E6 .  E6 . '] },

    { who: 'p', groove: 'boss', ch: ['Gm', 'Dm', 'Bb', 'E'], stab: 1, arp: 1,
      pat: ['0000222211113333',
            '0123012301230123',
            'c...b...e...d...',
            '0123321001233210'],
      mel: ['G5 .  .  .  D6 .  .  .  Bb5 . .  .  F6 .  .  . ',
            'D5 .  F5 .  A5 .  D6 .  F6 .  D6 .  A5 .  F5 . ',
            'Bb5 . .  .  D6 .  .  .  F6 .  .  .  Bb6 . .  . ',
            'D6 .  C6 .  Bb5 . A5 .  G5 .  F5 .  E5 .  D5 . '] },

    { who: 'p', groove: 'fill', ch: ['Dm', 'Dm'], crash: 1,
      pat: ['g...............',
            'g...............'],
      mel: ['D6 .  .  .  .  .  .  .  .  .  .  .  .  .  .  . ',
            'D4 .  .  .  .  .  .  .  .  .  .  .  .  .  .  . '] }
  ]
};

const FNF_SONGS = [SONG_DETENTION, SONG_EXPULSION];
const FNF_DIFFS = ['EASY', 'NORMAL', 'HARD', 'BALDI'];

/* =========================================================================
   Compiling a song into notes and into a backing track
   ========================================================================= */

const DIFF_SPEED = { EASY: 1.35, NORMAL: 1.65, HARD: 2.05, BALDI: 2.45 };

function fnfBuild(song, diff) {
  const beat = 60 / song.bpm, step = beat / 4;
  const notes = [];
  let bar = 0;
  const plan = [];                       /* one entry per bar, for the band */
  const cuts = [];                       /* the mid-song breaks */

  for (const S of song.sections) {
    const nb = S.pat.length;
    if (S.cut) cuts.push({ t0: bar * 16 * step, t1: (bar + nb) * 16 * step,
                           bars: nb, cfg: S.cut });
    for (let b = 0; b < nb; b++) {
      plan.push({ S: S, barIn: b, bar: bar + b,
                  ch: S.ch[b % S.ch.length],
                  mel: bar16(S.mel[b % S.mel.length]) });
      const row = S.pat[b];
      const sideRow = S.side ? S.side[b % S.side.length] : null;
      for (let s = 0; s < 16; s++) {
        const c = row[s];
        if (!c || c === '.' || c === '-') continue;

        /* thinning for the easier charts */
        if (diff === 'EASY' && s % 4 !== 0) continue;
        if (diff === 'NORMAL' && s % 2 !== 0) continue;

        let lanes = LANE_PAIR[c] ? LANE_PAIR[c].slice() : [parseInt(c, 10)];
        if (isNaN(lanes[0])) continue;
        if (diff === 'EASY') lanes = lanes.slice(0, 1);
        if (diff === 'NORMAL' && lanes.length > 2) lanes = lanes.slice(0, 2);

        /* how long is the hold?  count the dashes after it */
        let hold = 0;
        for (let k = s + 1; k < 16 && row[k] === '-'; k++) hold++;

        const sc = sideRow ? sideRow[s] : null;
        let sides;
        if (sc === 'o') sides = [0];
        else if (sc === 'p') sides = [1];
        else if (sc === 's') sides = [0, 1];
        else sides = [S.who === 'p' ? 1 : 0];

        const tt = (bar + b) * 16 * step + s * step;
        const m = midi(plan[plan.length - 1].mel[s]);
        for (const side of sides) {
          for (const lane of lanes) {
            notes.push({ t: tt, lane: lane, side: side, len: hold * step,
                         midi: m, hit: 0, miss: 0, held: 0, gone: 0 });
          }
          /* BALDI difficulty stacks an extra note on the off-beats */
          if (diff === 'BALDI' && s % 4 === 2 && lanes.length === 1) {
            notes.push({ t: tt, lane: (lanes[0] + 2) % 4, side: side, len: 0,
                         midi: m, hit: 0, miss: 0, held: 0, gone: 0 });
          }
        }
      }
    }
    bar += nb;
  }
  notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
  /* de-duplicate: the same lane and side on the same step is one note */
  const out = [];
  for (const n of notes) {
    const p = out[out.length - 1];
    if (p && p.side === n.side && p.lane === n.lane && Math.abs(p.t - n.t) < 0.001) continue;
    out.push(n);
  }
  return {
    song: song, diff: diff, notes: out, plan: plan, cuts: cuts,
    bpm: song.bpm, beat: beat, step: step, bars: bar,
    dur: bar * 16 * step, speed: DIFF_SPEED[diff] || 3.0
  };
}

/* ------------------------------------------------------------- the band */
Object.assign(FNFAudio, {
  play(chart, t0) {
    this.start(t0);
    this.chart = chart;
    this.step = 0;
    this.next = t0;
    this.timer = setInterval(() => this.pump(), 25);
  },
  end() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stop();
  },
  pump() {
    if (!this.running || !this.chart) return;
    const ctx = this.ctx, C = this.chart;
    const total = C.bars * 16;
    /* a stalled frame must not fire a whole bar at once */
    while (this.next < ctx.currentTime - 0.012 && this.step < total) {
      this.next += C.step; this.step++;
    }
    while (this.next < ctx.currentTime + 0.20 && this.step < total) {
      this.bandHit(this.step, this.next);
      this.next += C.step; this.step++;
    }
  },

  bandHit(gs, t) {
    const C = this.chart, P = C.plan[Math.floor(gs / 16)];
    if (!P) return;
    const A = this.rack || this;
    const S = P.S, s = gs % 16;
    const G = FNF_GROOVE[S.groove] || FNF_GROOVE.four;
    const lvl = S.quiet ? 0.55 : 1;
    const chord = CH[P.ch] || CH.Am, root = CH_ROOT[P.ch] || 33;
    const lastBar = P.barIn === S.pat.length - 1;
    const big = S.groove === 'drive' || S.groove === 'boss';

    if (S.vol === 0) return;

    /* --------------------------------- the mid-song break
       Drums out, one held chord per bar, a heartbeat under it and a riser
       across the back half.  The last beat is silence, so the drop lands. */
    if (S.cut) {
      const nb = S.pat.length;
      if (s === 0) {
        if (P.barIn === 0) { A.crash(t, 0.20); this.riser(t, C.beat * 1.2); }
        if (A.pad) A.pad(t, chord.map(m => m - 12), C.beat * 4 * 0.98, 0.085);
        if (P.barIn < nb - 1) A.bass(t, hz(root), C.beat * 3.4, 0.20);
      }
      /* a slow pulse that speeds up as he loses his temper */
      const heat = P.barIn / Math.max(1, nb - 1);
      const every = heat > 0.62 ? 4 : 8;
      if (s % every === 0 && P.barIn < nb - 1) A.kick(t, 0.20 + heat * 0.30);
      if (P.barIn === nb - 2 && s === 0) this.riser(t, C.beat * 4 * 1.9);
      if (P.barIn === nb - 1 && s === 0) { A.crash(t, 0.10); }
      /* the last half-bar drops to nothing */
      if (P.barIn === nb - 1 && s >= 8) return;
      const cm = P.mel[s];
      if (cm && cm !== '.' && cm !== '-' && A.bell) A.bell(t, hz(midi(cm) + 12), C.beat, 0.05);
      return;
    }

    /* --------------------------------- drums */
    if (G.k[s] !== '.') A.kick(t, 0.60 * lvl);
    if (G.s[s] !== '.') { A.snare(t, 0.34 * lvl); A.clap(t, 0.16 * lvl); }
    if (G.h[s] !== '.') A.hat(t, (G.h[s] === 'H' ? 0.13 : 0.075) * lvl, G.h[s] === 'H');
    /* one open hat right before the bar turns over, every bar */
    if (s === 14 && big) A.hat(t, 0.11 * lvl, true);
    if (s === 0 && S.crash && P.barIn === 0) A.crash(t, 0.17);
    if (s === 0 && S.riser && P.barIn === 0) this.riser(t, C.beat * 4 * S.pat.length * 0.92);

    /* a tom fill across the last beat of every section */
    if (lastBar && s >= 12 && A.tom && big) {
      A.tom(t, [50, 47, 45, 41][s - 12], 0.75 * lvl);
      if (s === 15) A.snare(t + C.step * 0.5, 0.30 * lvl);
    }

    /* --------------------------------- bass */
    if (G.k[s] !== '.') A.bass(t, hz(root), C.step * 3.2, 0.30 * lvl);
    else if (s % 8 === 6 && S.groove !== 'none' && S.groove !== 'soft')
      A.bass(t, hz(root + 12), C.step * 1.4, 0.16 * lvl);

    /* --------------------------------- chords */
    if (S.stab && (s === 2 || s === 6 || s === 10 || s === 14))
      A.stab(t, chord.map(m => m + 12), C.step * 2.2, 0.070 * lvl);
    /* a pad holds the harmony under the loud sections so the drops have
       something to sit on instead of just being drums and a lead */
    if (s === 0 && big && A.pad)
      A.pad(t, chord.map(m => m - 12), C.beat * 4 * 0.98, 0.050 * lvl);
    if (S.arp) A.arp(t, hz(chord[s % 3] + 24), C.step * 0.9, 0.030 * lvl);

    /* --------------------------------- the lead line */
    const nm = P.mel[s];
    if (nm && nm !== '.' && nm !== '-') {
      const m = midi(nm);
      if (m != null) {
        let len = 1;
        for (let k = s + 1; k < 16 && (P.mel[k] === '.' || P.mel[k] === '-'); k++) len++;
        A.lead(t, hz(m), C.step * len * 0.92, 0.105 * lvl);
        /* and a bell two octaves up on the downbeats, for the sparkle */
        if (A.bell && S.stab && (s === 0 || s === 8))
          A.bell(t, hz(m + 24), C.step * len * 1.2, 0.045 * lvl);
      }
    }
  },

  /* --------------------------------------------------------------- speech
     One blip per word through his throat, dropping in pitch across the line
     the way a sentence does, with a hard accent on anything in capitals. */
  speak(text, t0) {
    if (!this.running) return;
    const words = String(text).replace(/[^A-Za-z' ]/g, ' ').split(/\s+/).filter(Boolean);
    let t = t0 == null ? this.ctx.currentTime : t0;
    const base = 128;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const shout = w.length > 1 && w === w.toUpperCase();
      const drop = 1 - (i / Math.max(1, words.length)) * 0.30;
      const syl = Math.max(1, Math.min(3, Math.ceil(w.length / 3)));
      for (let sy = 0; sy < syl; sy++) {
        const f = base * drop * (1 + (sy % 2 ? 0.16 : 0)) * (shout ? 1.35 : 1);
        this.voiceBaldi(t, f, shout ? 0.20 : 0.13);
        t += shout ? 0.115 : 0.082;
      }
      t += shout ? 0.075 : 0.045;
    }
  },
  roar(t0) {
    if (!this.bus) return;
    const ctx = this.ctx, t = t0 == null ? ctx.currentTime : t0;
    for (let i = 0; i < 7; i++)
      this.voiceBaldi(t + i * 0.055, 96 * (1 + i * 0.11), 0.42);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.5);
    o.frequency.exponentialRampToValueAtTime(48, t + 1.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    o.connect(lp); lp.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + 1.4);
    this.noise(t, 0.7, 'bandpass', 520, 0.09, 1.1);
  },

  /* the opponent always sings; the player only sings if you hit the note */
  sing(side, m, dur, t) {
    if (!this.running) return;
    const f = hz(m == null ? 57 : m);
    const tt = t == null ? this.ctx.currentTime : t;
    if (side === 0) this.voiceBaldi(tt, f, Math.max(0.10, dur || 0.16));
    else this.voiceGirl(tt, f, Math.max(0.10, dur || 0.16));
  }
});


/* =========================================================================
   Part 5o — FNF: the game
   The notefield, the judging, the health bar and the camera.  Timing comes
   off the audio clock, never off requestAnimationFrame, so the arrows and
   the music cannot drift apart.
   ========================================================================= */

/* Psych Engine's defaults, in milliseconds */
const FNF_WIN = { sick: 45, good: 90, bad: 135, safe: 166.67 };
const FNF_RATE = [
  { n: 'SICK!', w: FNF_WIN.sick, score: 350, mod: 1.00, splash: 1, col: '#3cf0ff' },
  { n: 'GOOD',  w: FNF_WIN.good, score: 200, mod: 0.67, splash: 0, col: '#5ff05f' },
  { n: 'BAD',   w: FNF_WIN.bad,  score: 100, mod: 0.34, splash: 0, col: '#f0a63c' },
  { n: 'SHIT',  w: FNF_WIN.safe, score: 50,  mod: 0.00, splash: 0, col: '#f05f5f' }
];
const FNF_KEYS = [
  ['KeyD', 'ArrowLeft'], ['KeyF', 'ArrowDown'], ['KeyJ', 'ArrowUp'], ['KeyK', 'ArrowRight']
];
const LANE_NAME = ['left', 'down', 'up', 'right'];

/* ---------------------------------------------------------- arrow sprites
   Drawn once into an atlas: four arrows in the four canonical colours, plus
   a grey outline version for the strums and a white one for the press. */
let FNF_ATLAS = null;
function fnfAtlas() {
  if (FNF_ATLAS) return FNF_ATLAS;
  const S = 128, c = document.createElement('canvas');
  c.width = S * 4; c.height = S * 3;
  const x = c.getContext('2d');

  const shape = (k) => {                       /* an arrow pointing left */
    x.beginPath();
    x.moveTo(-40, 0); x.lineTo(-6, -36); x.lineTo(-6, -15);
    x.lineTo(40, -15); x.lineTo(40, 15); x.lineTo(-6, 15);
    x.lineTo(-6, 36); x.closePath();
  };
  const rot = [0, Math.PI / 2, -Math.PI / 2, Math.PI];   /* L D U R */

  for (let row = 0; row < 3; row++) {
    for (let l = 0; l < 4; l++) {
      x.save();
      x.translate(l * S + S / 2, row * S + S / 2);
      x.rotate(rot[l]);
      const col = row === 0 ? '#3c3c48' : (row === 1 ? '#ffffff' : null);
      const base = ['#c24b99', '#00ffff', '#12fa05', '#f9393f'][l];
      shape();
      if (row === 2) {
        const g = x.createLinearGradient(0, -40, 0, 40);
        g.addColorStop(0, base);
        g.addColorStop(0.55, base);
        g.addColorStop(1, '#ffffff');
        x.fillStyle = g;
      } else x.fillStyle = col;
      x.fill();
      x.lineWidth = 9; x.strokeStyle = row === 0 ? '#22222c' : '#1a1a22';
      x.lineJoin = 'round'; x.stroke();
      if (row === 2) {                          /* an inner highlight */
        x.globalAlpha = 0.5; x.lineWidth = 3; x.strokeStyle = '#ffffff';
        x.stroke(); x.globalAlpha = 1;
      }
      x.restore();
    }
  }
  FNF_ATLAS = { c: c, S: S };
  return FNF_ATLAS;
}

const FNFPlay = {
  active: false,

  start(song, diff) {
    this.chart = fnfBuild(song, diff);
    this.song = song; this.diff = diff;
    const C = this.chart;

    if (!this.scene) {
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x1a1522);
      this.stage = makeFNFStage();
      this.scene.add(this.stage);
      this.camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.5, 400);
    }
    const U = this.stage.userData;
    U.baldi.__fnf = null; U.girl.__fnf = null;

    this.cv = UI.el('fnfNotes');
    this.cx = this.cv.getContext('2d');

    this.score = 0; this.combo = 0; this.maxCombo = 0;
    this.hits = [0, 0, 0, 0]; this.misses = 0; this.totalJudged = 0;
    this.accNum = 0; this.accDen = 0;
    this.health = 1;
    this.dead = false; this.done = false; this.paused = false;
    if (FNFDeath.active) FNFDeath.stop();
    FNFDeathMusic.stop();
    this.pauseSel = 0;
    this.notes = C.notes;
    this.cursor = 0;
    this.pressed = [0, 0, 0, 0];
    this.strumLit = [0, 0, 0, 0];
    this.oppLit = [0, 0, 0, 0];
    this.splashes = [];
    this.pops = [];
    this.holdFx = [[], [], [], []];
    this.sing = [{ n: 'idle', t: 9 }, { n: 'idle', t: 9 }];
    this.camX = 0; this.camZoom = 1; this.hudZoom = 1;
    this.cuts = C.cuts || []; this.inCut = null; this.hudA = 1;
    this.cutRage = 0; this.cutLine = null; this.cutShake = 0; this.cutSpoken = {};
    this.lastBeat = -1;
    this.camSide = 0;
    this.songT = -3 * C.beat;                       /* the countdown */
    this.countStep = -1;
    this.active = true;

    Audio1.init(); Audio1.resume();
    const now = Audio1.ctx.currentTime + 0.14;
    this.t0 = now + 4 * C.beat;                     /* four beats of count-in */
    this.countT0 = now;
    FNFAudio.play(C, this.t0);
    this.resize();
    UI.el('fnfRes').classList.remove('on');
    UI.el('fnfPause').classList.remove('on');
  },

  stop() {
    this.active = false;
    if (FNFDeath.active) FNFDeath.stop();
    FNFDeathMusic.stop();
    FNFAudio.end();
  },

  resize() {
    if (!this.cv) return;
    const w = window.innerWidth, h = window.innerHeight;
    this.cv.width = Math.min(1600, w); this.cv.height = Math.round(this.cv.width * h / w);
    this.W = this.cv.width; this.H = this.cv.height;
  },

  /* ------------------------------------------------------------- input */
  key(code, down) {
    if (!this.active) return false;
    if (this.dead) return FNFDeath.key(code, down);
    if (code === 'Escape' && down) {
      if (this.done) { FNF.toFreeplay(); return true; }
      this.paused = !this.paused;
      UI.el('fnfPause').classList.toggle('on', this.paused);
      if (this.paused) { Audio1.ctx.suspend(); } else { Audio1.ctx.resume(); }
      return true;
    }
    if (this.paused) {
      if (!down) return true;
      if (code === 'KeyW' || code === 'ArrowUp') { this.pauseMove(-1); }
      else if (code === 'KeyS' || code === 'ArrowDown') { this.pauseMove(1); }
      else if (code === 'Enter' || code === 'Space') { this.pausePick(); }
      return true;
    }
    if (this.done) {
      if (down && (code === 'Enter' || code === 'Space' || code === 'Escape')) FNF.toFreeplay();
      return true;
    }
    for (let l = 0; l < 4; l++) {
      if (FNF_KEYS[l].indexOf(code) < 0) continue;
      if (down) { if (!this.pressed[l]) this.tap(l); this.pressed[l] = 1; }
      else this.pressed[l] = 0;
      return true;
    }
    return false;
  },
  pauseMove(d) {
    const it = UI.el('fnfPause').querySelectorAll('.pitem');
    this.pauseSel = (this.pauseSel + d + it.length) % it.length;
    it.forEach((e, i) => e.classList.toggle('sel', i === this.pauseSel));
    FNFAudio.menuBlip(Audio1.ctx.currentTime, d < 0);
  },
  pausePick() {
    const s = this.pauseSel;
    this.paused = false;
    UI.el('fnfPause').classList.remove('on');
    Audio1.ctx.resume();
    if (s === 1) { this.stop(); FNF.playSong(this.song, this.diff); }
    else if (s === 2) { this.stop(); FNF.toFreeplay(); }
  },

  tap(lane) {
    /* read the clock here rather than using the frame's copy: a keypress
       lands between frames, and at 60 fps that is 16 ms of free error */
    const C = this.chart;
    const now = (Audio1.ctx ? Audio1.ctx.currentTime - this.t0 : this.songT)
                - FNF.opt.offset / 1000;
    this.strumLit[lane] = 0.14;
    let best = null, bestD = 1e9;
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.t - now > 0.35) break;
      if (n.side !== 1 || n.hit || n.miss || n.lane !== lane) continue;
      const d = Math.abs(n.t - now) * 1000;
      if (d < bestD && d <= FNF_WIN.safe) { best = n; bestD = d; }
    }
    if (best) { this.judge(best, bestD); return; }
    /* nothing there — a ghost tap, and this chart does not forgive them */
    if (!FNF.opt.ghost) this.penalty(true);
  },

  judge(n, d) {
    let r = FNF_RATE[FNF_RATE.length - 1];
    for (const R of FNF_RATE) if (d <= R.w) { r = R; break; }
    n.hit = 1;
    this.hits[FNF_RATE.indexOf(r)]++;
    this.score += Math.round(r.score * (1 + Math.min(this.combo, 50) * 0.004));
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.accNum += r.mod; this.accDen++;
    this.health = Math.min(2, this.health + 0.023);
    this.sing[1] = { n: LANE_NAME[n.lane], t: 0 };
    this.strumLit[n.lane] = 0.16;
    FNFAudio.sing(1, n.midi, Math.max(0.14, n.len || 0.16));
    this.pop(r);
    if (r.splash && FNF.opt.splash) this.splashes.push({ lane: n.lane, t: 0 });
  },

  penalty(ghost) {
    this.combo = 0;
    this.misses++;
    this.accDen++;
    this.health = Math.max(0, this.health - (ghost ? 0.028 : 0.0475));
    FNFAudio.miss(Audio1.ctx.currentTime);
    this.pop({ n: 'MISS', col: '#ff4d6a' });
    if (this.health <= 0) this.die();
  },

  pop(r) {
    this.pops.push({ txt: r.n, col: r.col, t: 0, combo: this.combo, miss: r.n === 'MISS' });
    if (this.pops.length > 4) this.pops.shift();
  },

  die() {
    if (this.dead) return;
    this.dead = true;
    /* not a results screen — the game over is its own thing, with its own
       animation, its own music and its own way out */
    FNFDeath.start(this);
  },

  finish(won) {
    this.done = true;
    const acc = this.accDen ? (this.accNum / this.accDen) * 100 : 0;
    let rank = 'N/A';
    if (this.accDen) {
      if (this.misses === 0 && this.hits[1] + this.hits[2] + this.hits[3] === 0) rank = 'PERFECT!!';
      else if (this.misses === 0) rank = 'FULL COMBO';
      else if (acc >= 90) rank = 'SICK';
      else if (acc >= 80) rank = 'GREAT';
      else if (acc >= 70) rank = 'GOOD';
      else if (acc >= 60) rank = 'MEH';
      else rank = 'BAD';
    }
    const key = 'fnf_' + this.song.id + '_' + this.diff;
    const prev = (FNF.best[key] || 0);
    if (won && this.score > prev) FNF.best[key] = this.score;
    const el = UI.el('fnfRes');
    el.innerHTML =
      '<h2>' + (won ? 'CLEARED' : 'GAME OVER') + '</h2>' +
      '<div class="row">' + this.song.name + ' &middot; ' + this.diff + '</div>' +
      '<div class="row">SCORE ' + this.score + '</div>' +
      '<div class="row">ACCURACY ' + acc.toFixed(2) + '%</div>' +
      '<div class="row">SICK ' + this.hits[0] + ' &middot; GOOD ' + this.hits[1] +
        ' &middot; BAD ' + this.hits[2] + ' &middot; SHIT ' + this.hits[3] + '</div>' +
      '<div class="row">MISSES ' + this.misses + ' &middot; MAX COMBO ' + this.maxCombo + '</div>' +
      '<div class="row">' + rank + '</div>' +
      '<div class="go">ENTER to go back to Freeplay</div>';
    el.classList.add('on');
    if (won) FNFAudio.confirm(Audio1.ctx.currentTime);
  },

  /* -------------------------------------------------------------- tick */
  update(dt) {
    if (!this.active) return;
    if (this.dead) { FNFDeath.update(dt); return; }
    const C = this.chart;
    if (this.paused) { this.render(); return; }

    const ctx = Audio1.ctx;
    this.songT = ctx.currentTime - this.t0;

    /* the count-in */
    if (this.songT < 0) {
      const cs = Math.floor((this.songT + 4 * C.beat) / C.beat);
      if (cs !== this.countStep && cs >= 0 && cs < 4) {
        this.countStep = cs;
        FNFAudio.hat(ctx.currentTime, 0.10, false);
        FNFAudio.kick(ctx.currentTime, cs === 3 ? 0.5 : 0.28);
      }
    }

    if (!this.done && this.songT > C.dur + 1.6) { this.finish(true); }

    /* --- the mid-song break --- */
    const cut = this.cuts.length
      ? this.cuts.find(c => this.songT >= c.t0 - 0.35 && this.songT < c.t1) : null;
    this.inCut = cut || null;
    if (cut) this.tickCut(dt, cut, this.songT - cut.t0);
    /* the HUD is what disappears: arrows, health bar, score, all of it */
    this.hudA = lerp(this.hudA, cut ? 0 : 1, 1 - Math.exp(-dt * (cut ? 4.5 : 6.5)));
    if (this.hudA < 0.004) this.hudA = 0;

    /* beat events */
    const beatN = Math.floor(this.songT / C.beat);
    if (beatN !== this.lastBeat) {
      this.lastBeat = beatN;
      if (FNF.opt.zoom) { this.camZoom += 0.022; this.hudZoom += 0.035; }
    }
    this.camZoom = lerp(this.camZoom, 1, 1 - Math.exp(-dt * 7));
    this.hudZoom = lerp(this.hudZoom, 1, 1 - Math.exp(-dt * 9));

    /* opponent notes fire themselves */
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.t > this.songT + 0.001) break;
      if (n.side === 0 && !n.hit) {
        n.hit = 1;
        this.oppLit[n.lane] = 0.16;
        this.sing[0] = { n: LANE_NAME[n.lane], t: 0 };
        this.camSide = 0;
        FNFAudio.sing(0, n.midi, Math.max(0.14, n.len || 0.18));
      }
    }
    /* the player's notes expire */
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.t - this.songT > 0.4) break;
      if (n.side === 1 && !n.hit && !n.miss && (this.songT - n.t) * 1000 > FNF_WIN.safe) {
        n.miss = 1;
        this.penalty(false);
      }
      if (n.side === 1 && n.hit) this.camSide = 1;
    }
    /* advance the cursor past everything long gone */
    while (this.cursor < this.notes.length &&
           this.notes[this.cursor].t + this.notes[this.cursor].len < this.songT - 0.6) this.cursor++;

    /* holds: keep the key down and it keeps paying */
    for (const n of this.notes) {
      if (!n.hit || !n.len || n.gone) continue;
      const end = n.t + n.len;
      if (this.songT > end) { n.gone = 1; continue; }
      if (this.songT < n.t) continue;
      if (n.side === 0) { this.oppLit[n.lane] = 0.10; this.sing[0] = { n: LANE_NAME[n.lane], t: 0 }; }
      else if (this.pressed[n.lane]) {
        this.strumLit[n.lane] = 0.10;
        this.sing[1] = { n: LANE_NAME[n.lane], t: 0 };
        this.health = Math.min(2, this.health + dt * 0.05);
        this.score += Math.round(dt * 120);
      }
    }

    for (let l = 0; l < 4; l++) {
      this.strumLit[l] = Math.max(0, this.strumLit[l] - dt);
      this.oppLit[l] = Math.max(0, this.oppLit[l] - dt);
    }
    for (const s of this.splashes) s.t += dt;
    this.splashes = this.splashes.filter(s => s.t < 0.38);
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter(p => p.t < 1.1);

    this.tickStage(dt);
    this.render();
  },

  /* =====================================================================
     The mid-song cutscene.  The song never stops — the chart simply has no
     notes here and the arrangement drops to a held chord — so the HUD goes
     away, the camera comes off the play framing and onto him, he says his
     piece, loses his temper, and the HUD comes back on the drop.
     ===================================================================== */
  tickCut(dt, cut, k) {
    const cfg = cut.cfg, lines = cfg.lines;
    const span = cut.t1 - cut.t0;

    /* which line is up */
    let li = -1;
    for (let i = 0; i < lines.length; i++) if (k >= lines[i].t) li = i;
    const L = li >= 0 ? lines[li] : null;
    this.cutLine = L;
    this.cutLineK = L ? k - L.t : 0;
    this.cutLineI = li;

    /* say it, once */
    if (L && !this.cutSpoken[li]) {
      this.cutSpoken[li] = 1;
      if (L.roar) { FNFAudio.roar(); this.cutShake = 1.0; }
      else { FNFAudio.speak(L.s); this.cutShake = L.mad ? 0.45 : 0.18; }
    }
    /* his temper, climbing line by line */
    let want = 0;
    if (L) want = L.roar ? 1 : (L.mad ? 0.62 : 0.24);
    this.cutRage = lerp(this.cutRage, want, 1 - Math.exp(-dt * 3.0));
    this.cutShake = Math.max(0, this.cutShake - dt * 1.5);
    /* and the last bar, where he winds up for the drop */
    this.cutEnd = clamp((k - (span - 2.2)) / 2.2, 0, 1);
  },

  cutStage(dt, k, cut) {
    const U = this.stage.userData;
    const B = U.baldi, rage = this.cutRage, end = this.cutEnd || 0;
    const talking = this.cutLine && this.cutLineK < (this.cutLine.roar ? 1.5 : 1.9);

    /* he turns out of the duet and squares up to the camera */
    const turn = clamp(k / 0.9, 0, 1);
    B.setMood(3);
    B.update(dt, { speed: 0, anger: 0.85 + rage * 0.15 });
    B.root.rotation.y = lerp(0.42, 0.02, turn);
    const rise = rage * 0.55 + end * 0.5;
    const sh = this.cutShake;
    B.root.position.set(
      -15.5 + lerp(0, 2.4, turn) + Math.sin(k * 47) * 0.22 * (rage * 0.5 + sh),
      Math.abs(Math.sin(k * 39)) * 0.16 * rage,
      -6 + lerp(0, 3.5, turn));
    const puff = 1 + rage * 0.10 + end * 0.14;
    B.root.scale.set(2.35 * puff, 2.35 * (1 + rage * 0.05 + end * 0.10), 2.35 * puff);
    B.torso.rotation.set(0.06 - end * 0.30 + rage * 0.05, 0, Math.sin(k * 31) * 0.03 * rage);
    B.head.rotation.set(-0.06 - end * 0.42 + Math.sin(k * 53) * 0.05 * rage,
                        0, Math.sin(k * 37) * 0.06 * rage);
    /* the ruler comes up as he goes */
    const arm = lerp(-0.15, -2.55, Math.max(rage * 0.5, end));
    B.armR.g.rotation.set(arm, 0, 0.30 + rage * 0.35);
    B.armL.g.rotation.set(-0.15 - rage * 0.75, 0, -0.30 - rage * 0.45);
    B.armR.fore.rotation.x = -0.25 - rage * 0.55;
    B.armL.fore.rotation.x = -0.25 - rage * 0.75;

    /* the mouth: he is speaking, so flap it, and hold it open for the roar */
    const talkO = B.calmMouth.children[1];
    const angry = rage > 0.30;
    B.calmMouth.visible = !angry;
    B.madMouth.visible = angry;
    if (B.calmMouth.children[0]) B.calmMouth.children[0].visible = false;
    if (talkO) {
      talkO.visible = !angry;
      const o = talking ? 0.35 + 0.65 * Math.abs(Math.sin(k * 26)) : 0.06;
      talkO.scale.set(1.35, 0.30 + o * 1.15, 0.5);
    }
    if (angry) {
      const o = talking ? 0.5 + 0.5 * Math.abs(Math.sin(k * 22)) : 0.15;
      B.madMouth.scale.set(1.05 + o * 0.35, 1.05 + o * 1.0, 1);
    }
    /* eyes go bloodshot as he winds up */
    const rd = Math.max(rage, end);
    B.eyeL.white.material.color.setRGB(1, lerp(1, 0.22, rd), lerp(1, 0.22, rd));
    B.eyeR.white.material.color.setRGB(1, lerp(1, 0.22, rd), lerp(1, 0.22, rd));
    const bul = 1 + rd * 0.35 + sh * 0.15;
    B.eyeL.g.scale.setScalar(bul); B.eyeR.g.scale.setScalar(bul);
    B.eyeL.pupilG.scale.setScalar(lerp(1, 0.40, rd));
    B.eyeR.pupilG.scale.setScalar(lerp(1, 0.40, rd));

    /* she backs off; the girlfriend stops dancing and watches */
    const g = U.girl;
    poseGirl(g, 'idle', dt, ((this.songT / this.chart.beat) % 2 + 2) % 2,
             rage > 0.5 ? 'surprised' : 'normal');
    g.root.position.x = 15.5 + rage * 2.6;
    g.root.rotation.y = -0.42 - rage * 0.25;
    g.update(dt, { idle: false, t: this.songT, wob: 0 });
    U.gf.head.rotation.set(-0.12, -0.5, 0);

    /* the room goes red behind him */
    U.amb.color.setHex(0x9fa4d0);
    U.amb.intensity = 0.62 - rd * 0.24;
    U.keyL.color.setRGB(1, lerp(0.82, 0.20, rd), lerp(0.91, 0.16, rd));
    U.keyL.intensity = 0.85 + rd * 1.5 + Math.sin(k * 24) * 0.15 * rd;
    U.keyR.intensity = 0.5 - rd * 0.3;
    U.rim.color.setRGB(lerp(0.48, 1, rd), lerp(0.42, 0.10, rd), lerp(0.82, 0.10, rd));
    U.rim.intensity = 0.4 + rd * 0.9;

    /* camera: in on him, then back off for the swing */
    const cam = this.camera;
    const bx = B.root.position.x;
    const inK = clamp(k / 1.1, 0, 1);
    const wide = end;
    const cx2 = lerp(lerp(this.camX, bx + 3.2, inK), bx + 7.5, wide);
    const cy = lerp(lerp(13.0, 13.6, inK), 12.6, wide);
    const cz = lerp(lerp(20, 11.5, inK), 21.0, wide);
    cam.position.set(cx2 + Math.sin(k * 43) * 0.5 * sh,
                     cy + Math.cos(k * 51) * 0.4 * sh, cz);
    cam.lookAt(bx, 12.4 + rise, -6);
    cam.fov = lerp(lerp(55, 44, inK), 52, wide);
    cam.updateProjectionMatrix();
    this.camX = cx2;
  },

  tickStage(dt) {
    const U = this.stage.userData, C = this.chart;
    if (this.inCut) { this.cutStage(dt, this.songT - this.inCut.t0, this.inCut); return; }
    if (this.cutRage > 0) {                                /* put the room back */
      this.cutRage = Math.max(0, this.cutRage - dt * 2.2);
      U.keyL.color.setHex(0xffd0e8); U.rim.color.setHex(0x7a6ad0);
      U.rim.intensity = 0.40; this.cutEnd = 0;
      U.baldi.root.scale.setScalar(2.35);
      U.baldi.eyeL.white.material.color.setRGB(1, 1, 1);
      U.baldi.eyeR.white.material.color.setRGB(1, 1, 1);
      U.baldi.eyeL.pupilG.scale.setScalar(1); U.baldi.eyeR.pupilG.scale.setScalar(1);
      U.baldi.root.rotation.y = 0.42;
      U.girl.root.rotation.y = -0.42;
    }
    const beatK = ((this.songT / C.beat) % 2 + 2) % 2;      /* two-beat sway */
    for (let i = 0; i < 2; i++) {
      this.sing[i].t += dt;
      if (this.sing[i].t > C.beat * 0.85) this.sing[i].n = 'idle';
    }
    const mad = this.health < 0.75 || this.combo > 24;
    /* his own update() writes arms, torso and head, so it has to run first
       and let the pose overwrite it — the other way round and he goes limp */
    U.baldi.setMood(3);
    U.baldi.update(dt, { speed: 0, anger: mad ? 1 : 0.85 });
    poseBaldi(U.baldi, this.sing[0].n, dt, beatK, mad);
    const gmood = this.health > 1.4 ? 'happy' : (this.health < 0.5 ? 'pain' : 'normal');
    poseGirl(U.girl, this.sing[1].n, dt, beatK, gmood);
    U.girl.update(dt, { idle: false, t: this.songT, wob: 0 });

    /* the girlfriend on the speakers, keeping time and nothing else */
    const gf = U.gf;
    const bp = Math.abs(Math.sin(beatK * Math.PI));
    gf.root.rotation.y = Math.sin(beatK * Math.PI) * 0.30;
    gf.root.position.y = 10.75 + (1 - bp) * 0.22;
    gf.root.scale.set(1.15 * (1.02 - bp * 0.02), 1.15 * (0.98 + bp * 0.02), 1.15);
    gf.head.rotation.z = Math.sin(beatK * Math.PI) * 0.16;
    gf.armL.g.rotation.set(-0.5 - bp * 0.5, 0, -0.7);
    gf.armR.g.rotation.set(-0.5 - (1 - bp) * 0.5, 0, 0.7);
    gf.update(dt, { idle: false, t: this.songT, wob: 0 });
    U.spk.scale.set(1 + (1 - bp) * 0.03, 1 - (1 - bp) * 0.03, 1);

    /* camera: slide to whoever is singing, and bop */
    const want = this.camSide === 0 ? -10.5 : 10.5;
    this.camX = lerp(this.camX, want, 1 - Math.exp(-dt * 3.4));
    const z = FNF.opt.zoom ? this.camZoom : 1;
    const cam = this.camera;
    cam.fov = 55 / z;
    cam.position.set(this.camX, 13.0, 20);
    cam.lookAt(this.camX * 0.75, 9.6, -6);
    cam.updateProjectionMatrix();
    U.keyL.intensity = 0.85 + (this.sing[0].n !== 'idle' ? 0.5 : 0);
    U.keyR.intensity = 0.85 + (this.sing[1].n !== 'idle' ? 0.5 : 0);
    U.amb.intensity = 0.62 - (1 - this.health / 2) * 0.12;
  }
};

/* ================================================================ drawing
   Everything on top of the stage is one canvas.  Arrows come out of a small
   atlas, so a screen full of notes is a screen full of drawImage calls and
   nothing else. */
Object.assign(FNFPlay, {
  render() {
    const x = this.cx, W = this.W, H = this.H, C = this.chart;
    if (!x) return;
    x.clearRect(0, 0, W, H);
    const A = fnfAtlas();

    const down = FNF.opt.down;
    const SZ = Math.round(H * 0.155);                 /* one arrow */
    const GAP = SZ * 1.05;
    const strumY = down ? H - SZ * 1.05 : SZ * 0.80;
    const PPS = 0.45 * C.speed * 1000 * (H / 720);    /* pixels per second */
    const dir = down ? 1 : -1;

    const mid = FNF.opt.middle;
    const oppX = mid ? -9999 : W * 0.262 - GAP * 1.5;
    const plX = mid ? W * 0.5 - GAP * 1.5 : W * 0.738 - GAP * 1.5;

    const HA = this.hudA == null ? 1 : this.hudA;
    x.save();
    x.globalAlpha = HA;
    x.translate(W / 2, strumY);
    x.scale(this.hudZoom, this.hudZoom);
    x.translate(-W / 2, -strumY);

    /* ---- the strums ---- */
    const drawArrow = (row, lane, cx2, cy, sz, alpha) => {
      x.globalAlpha = (alpha == null ? 1 : alpha) * HA;
      x.drawImage(A.c, lane * A.S, row * A.S, A.S, A.S, cx2 - sz / 2, cy - sz / 2, sz, sz);
      x.globalAlpha = HA;
    };
    for (let l = 0; l < 4; l++) {
      if (!mid && FNF.opt.oppNotes) {
        const lit = this.oppLit[l] > 0;
        drawArrow(lit ? 2 : 0, l, oppX + l * GAP + SZ / 2, strumY, SZ * (lit ? 1.12 : 1), lit ? 1 : 0.82);
      }
      const lit2 = this.strumLit[l] > 0;
      const press = this.pressed[l];
      drawArrow(lit2 ? 2 : (press ? 1 : 0), l, plX + l * GAP + SZ / 2, strumY,
                SZ * (lit2 ? 1.12 : 1), lit2 ? 1 : (press ? 0.95 : 0.82));
    }

    /* ---- the notes ---- */
    const t = this.songT;
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      const dy = (n.t - t) * PPS;
      if (dy * -dir > H * 1.4) continue;
      if (dy > H * 1.6) break;
      if (n.side === 0 && (mid || !FNF.opt.oppNotes)) continue;
      if (n.hit && (!n.len || t > n.t + n.len)) continue;
      if (n.miss && !n.len) { if (t - n.t > 0.45) continue; }
      const bx = (n.side === 0 ? oppX : plX) + n.lane * GAP + SZ / 2;
      let by = strumY - dy * dir;

      /* the tail first, so the head sits on top of it */
      if (n.len > 0) {
        const tailLen = n.len * PPS;
        const tw = SZ * 0.30;
        let top = by, bot = by + tailLen * dir;
        if (n.hit && t > n.t) {                        /* eaten as it is held */
          const eaten = Math.min(n.len, t - n.t) * PPS;
          if (down) bot = strumY; else top = strumY;
          if (dir > 0) top = Math.max(top, strumY); else bot = Math.min(bot, strumY);
          void eaten;
        }
        x.globalAlpha = (n.miss ? 0.3 : 0.86) * HA;
        x.fillStyle = ['#8f3671', '#00b7b7', '#0fb005', '#b52a2e'][n.lane];
        const y0 = Math.min(top, bot), y1 = Math.max(top, bot);
        x.fillRect(bx - tw / 2, y0, tw, Math.max(0, y1 - y0));
        x.fillStyle = ['#c24b99', '#00ffff', '#12fa05', '#f9393f'][n.lane];
        x.fillRect(bx - tw / 2, y0, tw * 0.34, Math.max(0, y1 - y0));
        x.globalAlpha = HA;
      }
      if (n.hit && n.len) continue;                    /* head is gone, tail stays */
      drawArrow(2, n.lane, bx, by, SZ, n.miss ? 0.30 : 1);
    }

    /* ---- note splashes ---- */
    for (const s of this.splashes) {
      const k = s.t / 0.38;
      const r = SZ * (0.55 + k * 1.15);
      x.save();
      x.globalAlpha = (1 - k) * 0.9 * HA;
      x.translate(plX + s.lane * GAP + SZ / 2, strumY);
      x.rotate(k * 1.4);
      x.strokeStyle = ['#f79ad6', '#9ff5ff', '#b7ff9a', '#ffb0b3'][s.lane];
      x.lineWidth = SZ * 0.10 * (1 - k);
      x.lineCap = 'round';
      for (let a = 0; a < 8; a++) {
        const an = a / 8 * Math.PI * 2;
        x.beginPath();
        x.moveTo(Math.cos(an) * r * 0.45, Math.sin(an) * r * 0.45);
        x.lineTo(Math.cos(an) * r, Math.sin(an) * r);
        x.stroke();
      }
      x.restore();
    }
    x.restore();

    if (FNF.opt.hud && HA > 0.004) { this.drawHUD(x, W, H, HA); }
    if (HA > 0.004) this.drawPops(x, W, H, SZ, HA);
    if (this.songT < 0) this.drawCount(x, W, H);
    if (this.inCut) this.drawDialog(x, W, H);
  },

  drawHUD(x, W, H, HA) {
    x.save(); x.globalAlpha = HA == null ? 1 : HA;
    const down = FNF.opt.down;
    const barY = down ? H * 0.115 : H * 0.885;
    const barW = W * 0.52, barH = Math.max(14, H * 0.030);
    const bx = W / 2 - barW / 2;
    const k = clamp(1 - this.health / 2, 0, 1);        /* left side = opponent */

    x.globalAlpha = FNF.opt.hpAlpha * (HA == null ? 1 : HA);
    x.fillStyle = '#000';
    x.fillRect(bx - 5, barY - barH / 2 - 5, barW + 10, barH + 10);
    x.fillStyle = '#f9393f'; x.fillRect(bx, barY - barH / 2, barW, barH);
    x.fillStyle = '#66ff33'; x.fillRect(bx + barW * k, barY - barH / 2, barW * (1 - k), barH);
    x.globalAlpha = HA == null ? 1 : HA;

    /* the two icons, which change face as the bar moves */
    const isz = barH * 2.6;
    this.icon(x, bx + barW * k - isz * 1.02, barY - isz / 2, isz, 'baldi', this.health > 1.4);
    this.icon(x, bx + barW * k + isz * 0.06, barY - isz / 2, isz, 'girl', this.health < 0.6);

    /* the score line */
    const fs = Math.max(13, Math.round(H * 0.028));
    x.font = 'bold ' + fs + 'px "Consolas","DejaVu Sans Mono",monospace';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const acc = this.accDen ? (this.accNum / this.accDen) * 100 : 0;
    const txt = 'Score: ' + this.score + '  |  Misses: ' + this.misses +
                '  |  Accuracy: ' + acc.toFixed(2) + '%';
    const ty = barY + (down ? -1 : 1) * (barH / 2 + fs * 1.1);
    x.lineWidth = 5; x.strokeStyle = '#000'; x.strokeText(txt, W / 2, ty);
    x.fillStyle = '#fff'; x.fillText(txt, W / 2, ty);

    /* the time bar */
    if (FNF.opt.timeBar !== 'DISABLED') {
      const p = clamp(this.songT / this.chart.dur, 0, 1);
      const tw = W * 0.36, tx = W / 2 - tw / 2, tyy = down ? H - 26 : 16;
      x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(tx - 3, tyy - 3, tw + 6, 16);
      x.fillStyle = '#ffe14a'; x.fillRect(tx, tyy, tw * p, 10);
      x.font = 'bold ' + Math.round(fs * 0.8) + 'px "Consolas",monospace';
      x.fillStyle = '#fff';
      const rem = Math.max(0, this.chart.dur - this.songT);
      const lab = FNF.opt.timeBar === 'SONG NAME' ? this.song.name
        : (Math.floor(rem / 60) + ':' + String(Math.floor(rem % 60)).padStart(2, '0'));
      x.strokeStyle = '#000'; x.lineWidth = 4;
      x.strokeText(lab, W / 2, tyy + 5); x.fillText(lab, W / 2, tyy + 5);
    }
    x.restore();
  },

  icon(x, px, py, sz, who, alt) {
    const key = who + (alt ? '1' : '0');
    this._ico = this._ico || {};
    if (!this._ico[key]) this._ico[key] = fnfIcon(who, alt);
    x.drawImage(this._ico[key], px, py, sz, sz);
  },

  drawPops(x, W, H, SZ, HA) {
    const cxp = FNF.opt.middle ? W * 0.30 : W * 0.5;
    for (const p of this.pops) {
      const k = p.t / 1.1;
      const up = -Math.sin(Math.min(1, p.t * 3.2) * Math.PI) * SZ * 0.55;
      x.save();
      x.globalAlpha = clamp((1 - k) * 2.2, 0, 1) * (HA == null ? 1 : HA);
      x.translate(cxp, H * 0.545 + up);
      const pop = 1 + Math.max(0, 0.28 - p.t) * 1.6;
      x.scale(pop, pop);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = 'bold ' + Math.round(H * 0.075) + 'px "Comic Sans MS", cursive';
      x.lineWidth = Math.round(H * 0.012); x.lineJoin = 'round';
      x.strokeStyle = '#1b1b22'; x.strokeText(p.txt, 0, 0);
      x.fillStyle = p.col; x.fillText(p.txt, 0, 0);
      if (!p.miss && p.combo >= 10) {
        x.font = 'bold ' + Math.round(H * 0.052) + 'px "Comic Sans MS", cursive';
        x.lineWidth = Math.round(H * 0.009);
        x.strokeStyle = '#1b1b22'; x.strokeText(String(p.combo), 0, H * 0.075);
        x.fillStyle = '#fff'; x.fillText(String(p.combo), 0, H * 0.075);
      }
      x.restore();
    }
  },

  drawCount(x, W, H) {
    const C = this.chart;
    const k = (this.songT + 4 * C.beat) / C.beat;
    const i = Math.floor(k);
    if (i < 0 || i > 3) return;
    const f = k - i;
    const words = ['3', '2', '1', 'GO!'];
    x.save();
    x.globalAlpha = clamp((1 - f) * 1.6, 0, 1);
    x.translate(W / 2, H * 0.46);
    const s = 1 + (1 - f) * 0.25;
    x.scale(s, s);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'bold ' + Math.round(H * 0.16) + 'px "Comic Sans MS", cursive';
    x.lineWidth = Math.round(H * 0.024); x.lineJoin = 'round';
    x.strokeStyle = '#1b1b22'; x.strokeText(words[i], 0, 0);
    x.fillStyle = i === 3 ? '#9ff56a' : '#fff'; x.fillText(words[i], 0, 0);
    x.restore();
  }
});

/* the health-bar heads, drawn small and flat like real FNF icons */
function fnfIcon(who, alt) {
  const S = 150, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.clearRect(0, 0, S, S);
  if (who === 'baldi' || who === 'baldiMad') {
    const mad = alt || who === 'baldiMad';
    x.fillStyle = '#e8cba4';
    x.beginPath(); x.ellipse(75, 74, 54, 60, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#c8a97f';
    x.beginPath(); x.ellipse(24, 74, 11, 17, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(126, 74, 11, 17, 0, 0, Math.PI * 2); x.fill();
    for (const ex of [54, 96]) {
      x.fillStyle = mad ? '#ffdada' : '#fff';
      x.beginPath(); x.ellipse(ex, 62, 17, 20, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#2b2b33'; x.lineWidth = 4; x.stroke();
      x.fillStyle = '#151520';
      x.beginPath(); x.ellipse(ex + (mad ? (ex < 75 ? 4 : -4) : 0), 64, mad ? 5 : 7, mad ? 6 : 9, 0, 0, Math.PI * 2); x.fill();
    }
    x.strokeStyle = '#3a2a20'; x.lineWidth = 8; x.lineCap = 'round';
    x.beginPath();
    if (mad) { x.moveTo(38, 30); x.lineTo(66, 44); x.moveTo(112, 30); x.lineTo(84, 44); }
    else { x.moveTo(40, 36); x.lineTo(66, 32); x.moveTo(110, 36); x.lineTo(84, 32); }
    x.stroke();
    x.fillStyle = '#6b1f22';
    if (mad) { x.beginPath(); x.ellipse(75, 108, 24, 16, 0, 0, Math.PI * 2); x.fill(); }
    else { x.lineWidth = 7; x.strokeStyle = '#6b1f22';
           x.beginPath(); x.arc(75, 96, 18, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke(); }
    x.fillStyle = '#2e6b38'; x.fillRect(28, 130, 94, 22);
  } else {
    const cvs = document.createElement('canvas'); cvs.width = cvs.height = 256;
    drawAnimeFace(cvs, alt ? 'pain' : 'happy', false, {});
    x.save();
    x.beginPath(); x.ellipse(75, 78, 56, 60, 0, 0, Math.PI * 2); x.clip();
    x.drawImage(cvs, 8, 18, 134, 134);
    x.restore();
    x.fillStyle = '#3d2b2a';
    x.beginPath(); x.ellipse(75, 40, 60, 34, 0, Math.PI, 0); x.fill();
    x.fillRect(16, 40, 16, 62); x.fillRect(118, 40, 16, 62);
    x.beginPath(); x.moveTo(20, 44); x.lineTo(75, 24); x.lineTo(130, 44);
    x.lineTo(122, 62); x.lineTo(75, 44); x.lineTo(28, 62); x.closePath(); x.fill();
    x.fillStyle = '#2c3654'; x.fillRect(34, 134, 82, 20);
    x.fillStyle = '#c9384a'; x.fillRect(68, 134, 14, 18);
  }
  return c;
}

/* ============================================================ the dialogue
   The box every mod puts at the bottom of the screen: it slides up, the
   speaker's name sits on a tab, and the line types itself out. */
Object.assign(FNFPlay, {
  drawDialog(x, W, H) {
    const cut = this.inCut;
    if (!cut) return;
    const k = this.songT - cut.t0;
    const span = cut.t1 - cut.t0;
    const L = this.cutLine;

    /* black bars, the way a cutscene always announces itself */
    const barK = clamp(k / 0.55, 0, 1) * clamp((span - k) / 0.9, 0, 1);
    if (barK > 0.002) {
      x.fillStyle = '#000';
      const bh = H * 0.085 * barK;
      x.fillRect(0, 0, W, bh);
      x.fillRect(0, H - bh, W, bh);
    }
    /* the red wash he brings with him */
    if (this.cutRage > 0.02) {
      const g = x.createRadialGradient(W * 0.34, H * 0.5, H * 0.1, W * 0.34, H * 0.5, H * 1.1);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(150,10,10,' + (this.cutRage * 0.34).toFixed(3) + ')');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    }
    if (!L) return;

    const lk = this.cutLineK;
    const slide = easeOutBack(clamp(lk / 0.26, 0, 1));
    const outK = clamp(((L.roar ? 2.6 : 2.4) - lk) / 0.3, 0, 1);
    const a = slide * outK;
    if (a <= 0.01) return;

    const boxH = Math.round(H * 0.20);
    const boxW = Math.round(W * 0.80);
    const bx = Math.round((W - boxW) / 2);
    const by = Math.round(H * 0.735) + Math.round((1 - slide) * boxH * 0.9);

    x.save();
    x.globalAlpha = a;
    /* the box: a hard black border, a chalkboard-green fill */
    x.fillStyle = '#12121a';
    x.fillRect(bx - 6, by - 6, boxW + 12, boxH + 12);
    const g2 = x.createLinearGradient(0, by, 0, by + boxH);
    g2.addColorStop(0, L.roar ? '#5a1418' : '#2f4a35');
    g2.addColorStop(1, L.roar ? '#3a0c0e' : '#1f3324');
    x.fillStyle = g2; x.fillRect(bx, by, boxW, boxH);
    x.strokeStyle = L.roar ? '#ff6a5a' : '#8fc79a';
    x.lineWidth = 3; x.strokeRect(bx + 5, by + 5, boxW - 10, boxH - 10);

    /* the name tab */
    x.fillStyle = '#12121a';
    x.fillRect(bx + 22, by - Math.round(H * 0.052), Math.round(W * 0.17), Math.round(H * 0.052) + 8);
    x.fillStyle = L.roar ? '#ff8a6a' : '#ffe14a';
    x.textAlign = 'left'; x.textBaseline = 'middle';
    x.font = 'bold ' + Math.round(H * 0.036) + 'px "Comic Sans MS", cursive';
    x.fillText('BALDI', bx + 34, by - Math.round(H * 0.026));

    /* the line, typing itself out one character at a time */
    const chars = Math.floor(clamp(lk / 0.028, 0, L.s.length));
    const shown = L.s.slice(0, chars);
    x.font = 'bold ' + Math.round(H * (L.roar ? 0.070 : 0.055)) + 'px "Comic Sans MS", cursive';
    x.textAlign = 'center';
    const jitter = L.roar ? Math.sin(this.songT * 47) * 3 : 0;
    x.lineWidth = Math.round(H * 0.016); x.lineJoin = 'round'; x.strokeStyle = '#0c0c12';
    x.strokeText(shown, W / 2 + jitter, by + boxH / 2);
    x.fillStyle = L.roar ? '#fff0d0' : '#f2f0e2';
    x.fillText(shown, W / 2 + jitter, by + boxH / 2);
    x.restore();
  }
});


/* =========================================================================
   Part 5p — FNF: the Tone.js rack
   The band moves onto real synths with real effect chains.  Tone shares the
   game's existing AudioContext, so `Tone.now()` and the note scheduler are
   reading the same clock and nothing drifts.

   What stays on raw Web Audio: the two character voices (a formant chain
   Tone has no equivalent for), the miss sound, and the menu blips — all
   one-shots where the extra layer would only cost latency.
   ========================================================================= */

const FNFTone = {
  ready: false, failed: false,

  init() {
    if (this.ready || this.failed) return this.ready;
    if (typeof Tone === 'undefined') { this.failed = true; return false; }
    try {
      Audio1.init();
      if (!Audio1.ctx) { this.failed = true; return false; }
      /* share the context rather than letting Tone open a second one */
      if (Tone.getContext().rawContext !== Audio1.ctx) Tone.setContext(Audio1.ctx);

      const T = Tone;

      /* ---------------- the master chain ---------------- */
      const limiter = new T.Limiter(-0.8);
      const glue = new T.Compressor({ threshold: -19, ratio: 3.2, attack: 0.005, release: 0.12, knee: 8 });
      const eq = new T.EQ3({ low: 2.5, mid: -1.5, high: 2.5, lowFrequency: 210, highFrequency: 3400 });
      const master = new T.Gain(0.72);
      master.connect(eq); eq.connect(glue); glue.connect(limiter);
      limiter.connect(Audio1.master);
      this.master = master;

      /* ---------------- sends ---------------- */
      const reverb = new T.Reverb({ decay: 1.9, preDelay: 0.012, wet: 1 });
      const revSend = new T.Gain(0); revSend.connect(reverb); reverb.connect(master);
      reverb.generate().then(() => { revSend.gain.value = 0.30; }).catch(() => {});
      this.revSend = revSend;

      const delay = new T.PingPongDelay({ delayTime: 0.24, feedback: 0.30, wet: 1 });
      const dlyLo = new T.Filter(3400, 'lowpass');
      const dlySend = new T.Gain(0.22);
      dlySend.connect(delay); delay.connect(dlyLo); dlyLo.connect(master);
      this.dlySend = dlySend;

      /* ---------------- busses ----------------
         The synth bus is ducked by every kick.  That pump is most of what
         makes a track like this feel like it is moving. */
      const drumBus = new T.Gain(1.0); drumBus.connect(master);
      const bassBus = new T.Gain(0.9); bassBus.connect(master);
      const duck = new T.Gain(1.0);
      const synthBus = new T.Gain(0.9);
      synthBus.connect(duck); duck.connect(master);
      this.drumBus = drumBus; this.bassBus = bassBus; this.synthBus = synthBus; this.duck = duck;

      /* ---------------- drums ---------------- */
      const kickDrive = new T.Distortion(0.22); kickDrive.connect(drumBus);
      this.kickS = new T.MembraneSynth({
        pitchDecay: 0.038, octaves: 6.5,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.30, sustain: 0.004, release: 0.16, attackCurve: 'exponential' }
      }).connect(kickDrive);
      this.kickS.volume.value = -3;

      const snHP = new T.Filter(1650, 'highpass'); snHP.connect(drumBus);
      this.snareN = new T.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.135, sustain: 0.0, release: 0.02 }
      }).connect(snHP);
      this.snareN.volume.value = -9;
      const snSend = new T.Gain(0.22); snHP.connect(snSend); snSend.connect(revSend);
      this.snareB = new T.MembraneSynth({
        pitchDecay: 0.018, octaves: 2.4,
        envelope: { attack: 0.001, decay: 0.10, sustain: 0.0, release: 0.03 }
      }).connect(drumBus);
      this.snareB.volume.value = -15;

      const hatHP = new T.Filter(8200, 'highpass'); hatHP.connect(drumBus);
      this.hatN = new T.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.0008, decay: 0.028, sustain: 0.0, release: 0.01 }
      }).connect(hatHP);
      this.hatN.volume.value = -20;
      this.hatOpen = new T.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.16, sustain: 0.0, release: 0.05 }
      }).connect(hatHP);
      this.hatOpen.volume.value = -22;

      const clapBP = new T.Filter({ frequency: 1500, type: 'bandpass', Q: 1.6 });
      clapBP.connect(drumBus); clapBP.connect(revSend);
      this.clapN = new T.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.001, decay: 0.075, sustain: 0.0, release: 0.02 }
      }).connect(clapBP);
      this.clapN.volume.value = -16;

      const crashHP = new T.Filter(4600, 'highpass');
      crashHP.connect(drumBus); crashHP.connect(revSend);
      this.crashN = new T.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.002, decay: 1.5, sustain: 0.0, release: 0.5 }
      }).connect(crashHP);
      this.crashN.volume.value = -22;

      const tomF = new T.Filter(2600, 'lowpass'); tomF.connect(drumBus);
      this.tomS = new T.MembraneSynth({
        pitchDecay: 0.06, octaves: 3.2,
        envelope: { attack: 0.001, decay: 0.28, sustain: 0.0, release: 0.1 }
      }).connect(tomF);
      this.tomS.volume.value = -11;

      /* ---------------- bass ---------------- */
      this.bassS = new T.MonoSynth({
        oscillator: { type: 'fatsawtooth', count: 3, spread: 26 },
        envelope: { attack: 0.004, decay: 0.20, sustain: 0.60, release: 0.09 },
        filter: { Q: 3.4, type: 'lowpass', rolloff: -24 },
        filterEnvelope: { attack: 0.004, decay: 0.16, sustain: 0.24, release: 0.08,
                          baseFrequency: 110, octaves: 3.1 }
      }).connect(bassBus);
      this.bassS.volume.value = -8;
      this.subS = new T.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 0.18, sustain: 0.7, release: 0.08 }
      }).connect(bassBus);
      this.subS.volume.value = -10;

      /* ---------------- chords ---------------- */
      const chorus = new T.Chorus({ frequency: 1.1, delayTime: 3.4, depth: 0.5, wet: 0.42 }).start();
      const stabF = new T.Filter({ frequency: 4200, type: 'lowpass', Q: 1.2 });
      stabF.connect(chorus); chorus.connect(synthBus); chorus.connect(revSend);
      this.stabS = new T.PolySynth(T.Synth, {
        oscillator: { type: 'fatsawtooth', count: 4, spread: 32 },
        envelope: { attack: 0.006, decay: 0.20, sustain: 0.10, release: 0.15 }
      }).connect(stabF);
      this.stabS.volume.value = -17;
      this.stabS.maxPolyphony = 24;

      /* a slow pad underneath the loud sections */
      const padF = new T.Filter({ frequency: 2200, type: 'lowpass', Q: 0.8 });
      padF.connect(synthBus); padF.connect(revSend);
      this.padS = new T.PolySynth(T.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 40 },
        envelope: { attack: 0.35, decay: 0.6, sustain: 0.55, release: 0.9 }
      }).connect(padF);
      this.padS.volume.value = -26;
      this.padS.maxPolyphony = 16;

      /* ---------------- lead ---------------- */
      const leadF = new T.Filter({ frequency: 5400, type: 'lowpass', Q: 1.1 });
      const leadDrive = new T.Distortion(0.10);
      leadF.connect(leadDrive); leadDrive.connect(synthBus);
      leadDrive.connect(dlySend); leadDrive.connect(revSend);
      this.leadS = new T.PolySynth(T.Synth, {
        oscillator: { type: 'fatsquare', count: 3, spread: 16 },
        envelope: { attack: 0.007, decay: 0.11, sustain: 0.62, release: 0.11 }
      }).connect(leadF);
      this.leadS.volume.value = -15;
      this.leadS.maxPolyphony = 12;

      /* a bell-ish counter-line an octave up */
      this.bellS = new T.PolySynth(T.FMSynth, {
        harmonicity: 3.01, modulationIndex: 8,
        oscillator: { type: 'sine' }, modulation: { type: 'square' },
        envelope: { attack: 0.002, decay: 0.4, sustain: 0.0, release: 0.3 },
        modulationEnvelope: { attack: 0.002, decay: 0.14, sustain: 0.0, release: 0.1 }
      }).connect(synthBus);
      this.bellS.volume.value = -24;
      this.bellS.maxPolyphony = 12;
      this.bellS.connect(revSend); this.bellS.connect(dlySend);

      /* ---------------- arp ---------------- */
      const arpF = new T.Filter({ frequency: 3800, type: 'bandpass', Q: 1.4 });
      arpF.connect(synthBus); arpF.connect(revSend);
      this.arpS = new T.PolySynth(T.Synth, {
        oscillator: { type: 'square' },
        envelope: { attack: 0.002, decay: 0.055, sustain: 0.0, release: 0.04 }
      }).connect(arpF);
      this.arpS.volume.value = -27;
      this.arpS.maxPolyphony = 12;

      this.ready = true;
      return true;
    } catch (e) {
      this.failed = true;
      return false;
    }
  },

  /* ---------------------------------------------------------- safety
     A Tone voice keeps a state timeline, and scheduling an event at or
     before the last one on that voice throws.  The song scheduler runs a
     quarter of a second ahead, so anything that wants to play "now" — a
     sting, a stinger on death — is already behind what is queued.  Every
     trigger goes through here, which nudges it just past the last event on
     that instrument instead of blowing up. */
  mono(key, t) {
    const L = this._last || (this._last = {});
    const v = Math.max(t, (L[key] || 0) + 0.0012);
    L[key] = v;
    return v;
  },

  /* every kick pulls the synth bus down and lets it back up */
  pump(t, amt) {
    if (!this.duck) return;
    const g = this.duck.gain;
    try {
      g.cancelScheduledValues(t);
      g.setValueAtTime(1 - (amt == null ? 0.42 : amt), t);
      g.linearRampToValueAtTime(1, t + 0.16);
    } catch (e) {}
  },

  /* ---- the same interface the hand-rolled kit exposes ---- */
  kick(t, vol) {
    const v = vol == null ? 0.6 : vol, tt = this.mono('k', t);
    try { this.kickS.triggerAttackRelease('C1', 0.22, tt, Math.min(1, v * 1.4)); } catch (e) {}
    this.pump(tt, 0.40 * Math.min(1, v * 1.6));
  },
  snare(t, vol) {
    const v = vol == null ? 0.34 : vol;
    try { this.snareN.triggerAttackRelease(0.13, this.mono('sn', t), Math.min(1, v * 2.2)); } catch (e) {}
    try { this.snareB.triggerAttackRelease('A2', 0.08, this.mono('sb', t), Math.min(1, v * 1.6)); } catch (e) {}
  },
  hat(t, vol, open) {
    const v = vol == null ? 0.08 : vol;
    try {
      if (open) this.hatOpen.triggerAttackRelease(0.16, this.mono('ho', t), Math.min(1, v * 5));
      else this.hatN.triggerAttackRelease(0.026, this.mono('hc', t), Math.min(1, v * 6));
    } catch (e) {}
  },
  clap(t, vol) {
    const v = vol == null ? 0.16 : vol;
    try {
      for (let i = 0; i < 3; i++)
        this.clapN.triggerAttackRelease(0.06, this.mono('cl', t + i * 0.011),
                                        Math.min(1, v * 3 * (1 - i * 0.22)));
    } catch (e) {}
  },
  crash(t, vol) {
    try { this.crashN.triggerAttackRelease(1.4, this.mono('cr', t),
            Math.min(1, (vol == null ? 0.17 : vol) * 3.4)); } catch (e) {}
  },
  tom(t, midiN, vol) {
    try { this.tomS.triggerAttackRelease(Tone.Frequency(midiN, 'midi'), 0.24,
            this.mono('tm', t), vol == null ? 0.7 : vol); } catch (e) {}
  },
  bass(t, f, dur, vol) {
    const v = Math.min(1, (vol == null ? 0.3 : vol) * 2.4);
    try { this.bassS.triggerAttackRelease(f, Math.max(0.06, dur), this.mono('ba', t), v); } catch (e) {}
    try { this.subS.triggerAttackRelease(f / 2, Math.max(0.06, dur), this.mono('su', t), v * 0.8); } catch (e) {}
  },
  stab(t, midis, dur, vol) {
    const v = Math.min(1, (vol == null ? 0.07 : vol) * 7);
    try { this.stabS.triggerAttackRelease(midis.map(m => Tone.Frequency(m, 'midi')),
            Math.max(0.06, dur), this.mono('st', t), v); } catch (e) {}
  },
  pad(t, midis, dur, vol) {
    const v = Math.min(1, (vol == null ? 0.05 : vol) * 7);
    try { this.padS.triggerAttackRelease(midis.map(m => Tone.Frequency(m, 'midi')),
            Math.max(0.2, dur), this.mono('pd', t), v); } catch (e) {}
  },
  lead(t, f, dur, vol) {
    const v = Math.min(1, (vol == null ? 0.10 : vol) * 6);
    try { this.leadS.triggerAttackRelease(f, Math.max(0.05, dur), this.mono('ld', t), v); } catch (e) {}
  },
  bell(t, f, dur, vol) {
    try { this.bellS.triggerAttackRelease(f, Math.max(0.08, dur), this.mono('be', t),
            Math.min(1, (vol == null ? 0.05 : vol) * 8)); } catch (e) {}
  },
  arp(t, f, dur, vol) {
    try { this.arpS.triggerAttackRelease(f, Math.max(0.03, dur), this.mono('ar', t),
            Math.min(1, (vol == null ? 0.03 : vol) * 10)); } catch (e) {}
  },
  /* the riser stays on raw Web Audio — a swept noise band is two nodes there
     and a whole AutoFilter graph here, for exactly the same sound */
  riser(t, dur) { FNFAudio.riser(t, dur); }
};


/* =========================================================================
   Part 5q — FNF: the game over
   Built to the shape of Psych Engine's GameOverSubstate:

     health hits zero  →  everything stops, the loss sound plays at once
     firstDeath        →  a one-shot animation, camera unhooks and drifts in
     deathLoop         →  loops, and the game over music starts underneath
     ENTER             →  deathConfirm, music stops, the end sting plays,
                          0.7 s later a 2 s fade to black, then the retry
     ESC               →  straight back to Freeplay
   ========================================================================= */

const DEATH = { first: 1.45, confirmHold: 0.70, fade: 2.00 };

const FNFDeath = {
  active: false,

  start(play) {
    this.play = play;
    this.active = true;
    this.t = 0;
    this.phase = 'first';
    this.isEnding = false;
    this.loopStarted = false;
    this.camK = 0.32;

    const U = play.stage.userData;
    this.U = U;
    /* she is alone: no schoolhouse, no Baldi, no girlfriend */
    U.env.visible = false;
    U.baldi.root.visible = false;
    U.gf.root.visible = false;
    U.spk.visible = false;
    U.amb.intensity = 0.10;
    U.amb.color.setHex(0x2a3060);
    U.keyL.intensity = 0; U.keyR.intensity = 0;
    U.fill.intensity = 0; U.rim.intensity = 0;
    U.deathKey.intensity = 3.4;
    U.deathFill.intensity = 1.3;
    play.scene.background = new THREE.Color(0x05060f);

    /* the camera lets go of the play framing and creeps in on her */
    this.camFrom = play.camera.position.clone();
    this.girl = U.girl;
    this.girl.__fnf = null;
    this.girl.reset();
    this.girl.setMood('pain');

    FNFAudio.end();                          /* the song stops dead */
    this.lossSfx();
    UI.el('fnfRes').classList.remove('on');
    UI.el('fnfPause').classList.remove('on');
  },

  stop() {
    this.active = false;
    if (this.loop) { clearInterval(this.loop); this.loop = null; }
    const U = this.U;
    if (U) {
      U.env.visible = true;
      U.baldi.root.visible = true;
      U.gf.root.visible = true;
      U.spk.visible = true;
      U.amb.intensity = 0.62; U.amb.color.setHex(0x9fa4d0);
      U.keyL.intensity = 0.85; U.keyR.intensity = 0.85;
      U.fill.intensity = 0.55; U.rim.intensity = 0.40;
      U.deathKey.intensity = 0; U.deathFill.intensity = 0;
      U.girl.root.scale.setScalar(2.0);
      U.girl.root.rotation.set(0, -0.42, 0);
      U.girl.reset();
      U.girl.setMood('normal');
    }
    if (this.play && this.play.scene) this.play.scene.background = new THREE.Color(0x1a1522);
    UI.el('fnfFade').classList.remove('on');
    UI.el('fnfFade').style.opacity = '0';
  },

  /* ------------------------------------------------------------- input */
  key(code, down) {
    if (!this.active || !down) return false;
    if (this.isEnding) return true;
    if (code === 'Enter' || code === 'Space') { this.confirm(); return true; }
    if (code === 'Escape') {
      this.stop();
      if (this.play) this.play.stop();
      FNF.toFreeplay();
      return true;
    }
    return true;
  },

  confirm() {
    if (this.isEnding) return;
    this.isEnding = true;
    this.phase = 'confirm';
    this.t = 0;
    if (this.loop) { clearInterval(this.loop); this.loop = null; }
    FNFDeathMusic.stop();
    this.endSting();
    this.girl.setMood('ko');
  },

  /* -------------------------------------------------------------- tick */
  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const g = this.girl;

    if (this.phase === 'first' && this.t >= DEATH.first) {
      this.phase = 'loop'; this.t = 0;
      g.setMood('ko');
      FNFDeathMusic.start();
      this.loopStarted = true;
    }
    if (this.phase === 'confirm' && !this.faded && this.t >= DEATH.confirmHold) {
      this.faded = 1;
      const f = UI.el('fnfFade');
      f.classList.add('on');
      f.style.transition = 'opacity ' + DEATH.fade + 's linear';
      f.style.opacity = '1';
    }
    if (this.phase === 'confirm' && this.t >= DEATH.confirmHold + DEATH.fade) {
      const play = this.play;
      this.faded = 0;
      this.stop();
      play.stop();
      FNF.playSong(play.song, play.diff);
      return;
    }

    this.pose(dt);
    this.camera(dt);
    this.draw();
  },

  /* ---- the three animations ---- */
  pose(dt) {
    const g = this.girl, t = this.t;
    let kneel = 0, fall = 0, slump = 0, spin = 0, up = 0, sx = 1, sy = 1;

    if (this.phase === 'first') {
      /* a hard recoil on the first frame that rings out, knees give way
         almost straight away, and she lands with a bounce so it reads as
         weight rather than as a model being moved down the screen */
      const ring = Math.exp(-t * 5.5) * Math.sin(t * 21) * 0.42;
      const push = Math.exp(-t * 3.2) * 0.52;
      const drop = easeOutBounce(clamp((t - 0.18) / 0.95, 0, 1));
      kneel = drop;
      fall = (ring + push) * (1 - drop * 0.65);
      slump = clamp((t - 0.72) / 0.60, 0, 1);
      /* squashed at the moment of impact */
      const land = Math.max(0, 0.20 - Math.abs(t - 1.02) * 1.6);
      sy = 1 - land;
      sx = 1 / Math.sqrt(sy);
      g.setMood(t > 0.42 ? 'dizzy' : 'pain');
    } else if (this.phase === 'loop') {
      kneel = 1; slump = 1;
      /* slow breathing, with a twitch every few bars */
      const br = Math.sin(t * 1.55);
      const tw = Math.max(0, Math.sin(t * 0.42 - 1.2) - 0.985) * 60;
      sy = 1 + br * 0.018 + tw * 0.02;
      sx = 1 / Math.sqrt(sy);
      slump = 1 - br * 0.05 - tw * 0.10;
      spin = Math.sin(t * 0.5) * 0.05 + tw * 0.08;
    } else {
      /* confirm: she snaps upright, then gets yanked off the top of frame */
      const k = clamp(t / 0.34, 0, 1);
      const lift = clamp((t - 0.30) / 1.5, 0, 1);
      kneel = 1 - lift;
      slump = (1 - k) * 1.0 - lift * 0.8;
      up = Math.pow(lift, 2.1) * 46;
      sy = 1 + lift * 1.5;
      sx = 1 / (1 + lift * 1.1);
      spin = lift * 0.6;
    }

    const hipDrop = kneel * 2.9;
    g.root.position.set(15.5 + fall * 1.6, -hipDrop + up, -6 + kneel * 1.2);
    g.root.rotation.set(kneel * 0.12, -0.42 + spin, fall * 0.22 + spin * 0.5);
    g.root.scale.set(2.0 * sx, 2.0 * sy, 2.0 * sx);

    /* knees folded under her, torso hinged forward, arms hanging dead */
    g.legL.rotation.set(-kneel * 1.62, 0, -0.10 - kneel * 0.10);
    g.legR.rotation.set(-kneel * 1.62, 0, 0.10 + kneel * 0.10);
    g.torso.rotation.set(slump * 0.66 + kneel * 0.10, 0, fall * -0.16);
    /* the head hangs at first, then comes up over a second and a half so the
       face is doing something other than pointing at the floor */
    const look = this.phase === 'loop' ? clamp(this.t / 1.6, 0, 1) : 0;
    g.head.rotation.set(slump * 0.60 - look * 0.52,
                        Math.sin(this.t * 0.7) * 0.05 * slump, fall * 0.20);
    const hang = 0.35 + slump * 0.55;
    g.armL.g.rotation.set(hang * 0.25, 0, -0.30 - slump * 0.16);
    g.armR.g.rotation.set(hang * 0.25, 0, 0.30 + slump * 0.16);
    g.armL.fore.rotation.x = -0.30 - slump * 0.55;
    g.armR.fore.rotation.x = -0.30 - slump * 0.55;
    /* the hair keeps moving after she has stopped */
    g.wobble(this.t * 0.7, this.phase === 'first' ? 2.4 : 0.9);
    g.update(dt, { idle: false, t: this.t, wob: 0 });
  },

  camera(dt) {
    const cam = this.play.camera;
    const gp = this.girl.root.position;
    /* FlxCamera.follow(..., LOCKON, 0.01): it never quite gets there */
    this.camK = lerp(this.camK, 1, 1 - Math.exp(-dt * 1.05));
    const wantX = gp.x + 0.6, wantY = 8.0, wantZ = 17.5;
    cam.position.set(
      lerp(this.camFrom.x, wantX, this.camK),
      lerp(this.camFrom.y, wantY, this.camK),
      lerp(this.camFrom.z, wantZ, this.camK));
    cam.lookAt(gp.x, 4.6 + (this.phase === 'confirm' ? gp.y * 0.5 : 0), -5);
    cam.fov = lerp(55, 48, this.camK);
    cam.updateProjectionMatrix();
    this.U.deathKey.position.set(gp.x + 4.5, 13, 14);
    this.U.deathFill.position.set(gp.x - 7, 4, 8);
  },

  draw() {
    const P = this.play, x = P.cx, W = P.W, H = P.H;
    if (!x) return;
    x.clearRect(0, 0, W, H);
    /* a cold vignette, so the black around her is not flat */
    const vg = x.createRadialGradient(W * 0.62, H * 0.52, H * 0.14, W * 0.62, H * 0.52, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(2,3,12,.85)');
    x.fillStyle = vg; x.fillRect(0, 0, W, H);

    if (!this.loopStarted) return;
    const a = clamp(this.phase === 'loop' ? this.t / 0.9 : 1, 0, 1) *
              (this.isEnding ? clamp(1 - this.t / 0.5, 0, 1) : 1);
    if (a <= 0) return;
    x.save();
    x.globalAlpha = a;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const fs = Math.round(H * 0.052);
    x.font = 'bold ' + fs + 'px "Comic Sans MS", cursive';
    x.lineWidth = fs * 0.28; x.lineJoin = 'round'; x.strokeStyle = '#05060f';
    const pulse = 0.72 + 0.28 * Math.abs(Math.sin(this.t * 1.9));
    x.strokeText('BLUE BALLED', W * 0.5, H * 0.115);
    x.fillStyle = 'rgba(' + Math.round(126 * pulse + 40) + ',' +
                  Math.round(168 * pulse + 40) + ',255,1)';
    x.fillText('BLUE BALLED', W * 0.5, H * 0.115);

    x.font = 'bold ' + Math.round(H * 0.030) + 'px "Consolas","DejaVu Sans Mono",monospace';
    x.lineWidth = Math.round(H * 0.012);
    const hint = 'ENTER to retry     ESC to quit';
    x.strokeText(hint, W * 0.5, H * 0.90);
    x.fillStyle = '#cfd8ff'; x.fillText(hint, W * 0.5, H * 0.90);
    x.restore();
  },

  /* ---------------------------------------------------- the two stings */
  lossSfx() {
    const ctx = Audio1.ctx, t = ctx.currentTime;
    /* her, going down: the voice bent a fifth flat over a third of a second */
    FNFAudio.start(t);
    FNFAudio.voiceGirl(t, 520, 0.55);
    FNFAudio.voiceGirl(t + 0.16, 330, 0.5);
    FNFAudio.voiceGirl(t + 0.34, 196, 0.7);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + 0.9);
    o.connect(lp); lp.connect(g); g.connect(Audio1.master);
    o.start(t); o.stop(t + 1.05);
    FNFAudio.noise(t, 0.5, 'lowpass', 900, 0.10);
    FNFAudio.crash(t, 0.10);
  },
  endSting() {
    const A = FNFAudio.rack || FNFAudio;
    const t = Audio1.ctx.currentTime;
    A.crash(t, 0.16);
    const notes = [57, 60, 64, 69];
    for (let i = 0; i < notes.length; i++)
      A.lead(t + i * 0.085, hz(notes[i] + 12), 0.26, 0.13);
    A.stab(t, [57, 60, 64], 0.9, 0.10);
    A.stab(t + 0.34, [57, 61, 64, 69], 1.4, 0.11);
    A.kick(t, 0.55);
    A.kick(t + 0.34, 0.5);
  }
};

/* ------------------------------------------------------- the loop music
   Slow, minor, and a little bit broken.  Eight bars at 76 BPM. */
const FNFDeathMusic = {
  on: false,
  BAR: [
    { ch: 'Am', bass: 'A1', mel: 'A4 .  .  .  .  .  C5 .  .  .  .  .  B4 .  .  . ' },
    { ch: 'F',  bass: 'F1', mel: 'A4 .  .  .  .  .  .  .  G4 .  .  .  .  .  .  . ' },
    { ch: 'C',  bass: 'C2', mel: 'G4 .  .  .  .  .  E4 .  .  .  .  .  G4 .  .  . ' },
    { ch: 'G',  bass: 'G1', mel: 'D5 .  .  .  .  .  .  .  B4 .  .  .  .  .  .  . ' },
    { ch: 'Am', bass: 'A1', mel: 'E5 .  .  .  .  .  D5 .  .  .  .  .  C5 .  .  . ' },
    { ch: 'F',  bass: 'F1', mel: 'C5 .  .  .  .  .  .  .  A4 .  .  .  .  .  .  . ' },
    { ch: 'Dm', bass: 'D2', mel: 'F4 .  .  .  .  .  A4 .  .  .  .  .  D5 .  .  . ' },
    { ch: 'E',  bass: 'E1', mel: 'E5 .  .  .  .  .  .  .  .  .  .  .  B4 .  .  . ' }
  ],

  start() {
    if (this.on) return;
    Audio1.init(); Audio1.resume();
    if (!FNFAudio.running) FNFAudio.start(Audio1.ctx.currentTime);
    FNFAudio.rack = (typeof FNFTone !== 'undefined' && FNFTone.init()) ? FNFTone : FNFAudio;
    this.on = true;
    this.step = 0;
    this.beat = 60 / 76; this.st = this.beat / 4;
    this.next = Audio1.ctx.currentTime + 0.15;
    this.mel = this.BAR.map(b => bar16(b.mel));
    this.timer = setInterval(() => this.pump(), 30);
  },
  stop() {
    if (!this.on) return;
    this.on = false;
    clearInterval(this.timer); this.timer = null;
  },
  pump() {
    if (!this.on) return;
    const ctx = Audio1.ctx;
    while (this.next < ctx.currentTime - 0.02) { this.next += this.st; this.step++; }
    while (this.next < ctx.currentTime + 0.25) {
      this.hit(this.step, this.next);
      this.next += this.st; this.step++;
    }
  },
  hit(gs, t) {
    const b = Math.floor(gs / 16) % 8, s = gs % 16;
    const B = this.BAR[b], A = FNFAudio.rack || FNFAudio;
    const chord = CH[B.ch] || CH.Am;
    if (s === 0) {
      if (A.pad) A.pad(t, chord.map(m => m - 12), this.beat * 4 * 0.98, 0.075);
      A.bass(t, hz(midi(B.bass)), this.beat * 3.6, 0.16);
    }
    /* a heartbeat, slowing down */
    if (s === 0 || s === 3) A.kick(t, s === 0 ? 0.24 : 0.14);
    if (s === 8 && b % 2 === 1) A.hat(t, 0.030, false);
    const nm = this.mel[b][s];
    if (nm && nm !== '.' && nm !== '-') {
      let len = 1;
      for (let k = s + 1; k < 16 && (this.mel[b][k] === '.' || this.mel[b][k] === '-'); k++) len++;
      if (A.bell) A.bell(t, hz(midi(nm)), this.st * len * 1.1, 0.055);
      else A.lead(t, hz(midi(nm)), this.st * len * 0.9, 0.05);
    }
  }
};


/* =========================================================================
   Part 5qa — a pixel font, and the tools for drawing in pixels.

   BALDI SANS MODE is meant to look like a 1990s RPG that someone made in
   an afternoon, so nothing in it should be anti-aliased.  That rules out
   the browser's own text rendering: fillText always smooths the edges, and
   a web font would need a network the shipped file does not have.

   So the letters here are a real bitmap font — five across, seven down,
   one glyph at a time, painted as squares.  Every glyph is packed into
   seven characters, five bits a row.
   ========================================================================= */

const PIX_ORDER = ' !\"#%' + String.fromCharCode(39) + '()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]_abcdefghijklmnopqrstuvwxyz∞♥';
const PIX_DATA  = '0000000044444040::000000:O::O:00IJ48CC0044000000248884208422248004E>E400044O440000000<<8000O000000000<<011248@@0>ACEIA>04<4444>0>A1248O0O2421A>026:BO220O@N11A>068@NAA>0O1248880>AA>AA>0>AA?12<00<<0<<0000<<0<<8248@842000O0O00084212480>A124040>AGEG@>0>AAOAAA0NAANAAN0>A@@@A>0NAAAAAN0O@@N@@O0O@@N@@@0>A@GAA>0AAAOAAA0O44444O072222B<0ABDHDBA0@@@@@@O0AKEAAAA0AIECAAA0>AAAAA>0NAAN@@@0>AAAEB>1NAANDBA0?@@>11N0O4444440AAAAAA>0AAAA::40AAAAEKA0AA:4:AA0AA:44440O1248@O0>88888>0>22222>00000000O00>1?A?0@@NAAAN000>@@A>011?AAA?000>AO@>0698L888000>AA?1>@@NAAAA040<444>0404444B<@@BDHDB0<44444>000JEEEE000NAAAA000>AAA>000NAAN@@00?AA?1100FI@@@000?@>1N088L8896000AAAC=000AAA:4000AAEE:000A:4:A000AAA?1>00O248O000KEK0000:OO>400';
const PIX_W = 5, PIX_H = 8, PIX_GAP = 1;   /* the eighth row is where p, g and y hang */

/* char -> seven row bitmasks, worked out once and kept */
const PIX_GLYPH = {};
(function () {
  for (let i = 0; i < PIX_ORDER.length; i++) {
    const rows = [];
    for (let r = 0; r < PIX_H; r++) rows.push(PIX_DATA.charCodeAt(i * PIX_H + r) - 48);
    PIX_GLYPH[PIX_ORDER.charAt(i)] = rows;
  }
})();

/* how wide a string comes out at a given pixel size */
function pxWidth(str, s) {
  s = s || 1;
  return str.length ? str.length * (PIX_W + PIX_GAP) * s - PIX_GAP * s : 0;
}
function pxHeight(s) { return PIX_H * (s || 1); }

/* Draw text.  x,y is the top-left unless `align` says otherwise, and the
   whole thing lands on whole pixels so nothing ever smears. */
function pxText(x, str, px, py, s, col, o) {
  o = o || {};
  s = s || 1;
  str = String(str);
  const w = pxWidth(str, s);
  let ox = Math.round(px), oy = Math.round(py);
  if (o.align === 'center') ox = Math.round(px - w / 2);
  else if (o.align === 'right') ox = Math.round(px - w);
  if (o.baseline === 'middle') oy = Math.round(py - PIX_H * s / 2);
  if (o.shadow) {
    x.fillStyle = o.shadow;
    pxBlit(x, str, ox + s, oy + s, s);
  }
  x.fillStyle = col || '#fff';
  pxBlit(x, str, ox, oy, s);
  return w;
}
function pxBlit(x, str, ox, oy, s) {
  for (let i = 0; i < str.length; i++) {
    const rows = PIX_GLYPH[str.charAt(i)];
    if (rows) {
      const gx = ox + i * (PIX_W + PIX_GAP) * s;
      for (let r = 0; r < PIX_H; r++) {
        const bits = rows[r];
        if (!bits) continue;
        let run = 0;
        for (let c = 0; c <= PIX_W; c++) {
          const on = c < PIX_W && (bits & (1 << (PIX_W - 1 - c)));
          if (on) run++;
          else if (run) {
            x.fillRect(gx + (c - run) * s, oy + r * s, run * s, s);
            run = 0;
          }
        }
      }
    }
  }
}

/* ------------------------------------------------------------------------
   Sprites.  A picture is rows of characters and a palette; '.' is nothing.
   Written out the way you would draw it on squared paper.
   ------------------------------------------------------------------------ */
function pxSprite(rows, pal) {
  return { rows: rows, pal: pal, w: rows[0].length, h: rows.length };
}
function pxDraw(x, sp, cx, cy, s, o) {
  o = o || {};
  const ox = Math.round(cx - sp.w * s / 2), oy = Math.round(cy - sp.h * s / 2);
  const swap = o.swap;
  for (let r = 0; r < sp.h; r++) {
    const row = sp.rows[r];
    let run = 0, key = null;
    for (let c = 0; c <= sp.w; c++) {
      const ch = c < sp.w ? row.charAt(c) : '.';
      const k = ch === '.' ? null : ch;
      if (k === key) { if (k) run++; continue; }
      if (key && run) {
        const col = (swap && swap[key]) || sp.pal[key];
        if (col) { x.fillStyle = col; x.fillRect(ox + (c - run) * s, oy + r * s, run * s, s); }
      }
      key = k; run = k ? 1 : 0;
    }
  }
}

/* a hard-edged block, always on whole pixels */
function pxRect(x, px, py, w, h, col) {
  if (w <= 0 || h <= 0) return;
  x.fillStyle = col;
  x.fillRect(Math.round(px), Math.round(py), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}
/* a one-pixel outline */
function pxFrame(x, px, py, w, h, col, t) {
  t = t || 1;
  px = Math.round(px); py = Math.round(py); w = Math.round(w); h = Math.round(h);
  x.fillStyle = col;
  x.fillRect(px, py, w, t); x.fillRect(px, py + h - t, w, t);
  x.fillRect(px, py, t, h); x.fillRect(px + w - t, py, t, h);
}


/* =========================================================================
   Part 5r — BALDI SANS MODE: the art, in pixels.

   Everything here is drawn as squares on whole coordinates: no curves, no
   gradients, no anti-aliasing.  The soul and the blaster are real sprites
   written out as rows of characters; the rulers and desks are built from
   blocks, because they have to work at any length.
   ========================================================================= */

const SANS_PAL = {
  bg: '#000000', ink: '#ffffff', box: '#ffffff',
  soul: '#ff0000', soulBlue: '#00a2e8',
  wood: '#e8c88a', woodDark: '#b8944f', woodEdge: '#7a5c28',
  blue: '#3b8cff', orange: '#ff9a2e',
  sweater: '#18c21c', sweaterDark: '#0f8c12',
  skin: '#e8cba4', skinDark: '#c8a97f',
  eye: '#8dff5a', hp: '#ffe14a', kr: '#c060ff', dmg: '#ff2d2d'
};

/* -------------------------------------------------------------- the soul
   Sixteen across, sixteen down, exactly like the one it is named after. */
const SP_SOUL = pxSprite([
  '................',
  '................',
  '...###....###...',
  '..#####..#####..',
  '.###############',
  '.###############',
  '.###############',
  '.###############',
  '..#############.',
  '...###########..',
  '....#########...',
  '.....#######....',
  '......#####.....',
  '.......###......',
  '........#.......',
  '................'
], { '#': SANS_PAL.soul });

/* the pieces it comes apart into — six chunks, not a spray of dust */
const SP_SHARD = [
  pxSprite(['.###..', '#####.', '######', '.#####', '..###.', '...#..'], { '#': SANS_PAL.soul }),
  pxSprite(['###..', '#####', '####.', '.##..'],                          { '#': SANS_PAL.soul }),
  pxSprite(['..##', '####', '####', '.##.'],                              { '#': SANS_PAL.soul }),
  pxSprite(['#####', '.###.', '..#..'],                                   { '#': SANS_PAL.soul }),
  pxSprite(['##.', '###', '###', '.#.'],                                  { '#': SANS_PAL.soul }),
  pxSprite(['.##.', '####', '.##.'],                                      { '#': SANS_PAL.soul })
];

function drawSoul(x, px, py, sz, blue, alpha) {
  const s = Math.max(1, Math.round(sz / 16));
  const a = alpha == null ? 1 : alpha;
  if (a < 0.5) return;                        /* blink: on or off, never faint */
  pxDraw(x, SP_SOUL, px, py, s, blue ? { '#': SANS_PAL.soulBlue } : null);
}

function drawShards(x, px, py, sz, k) {
  const s = Math.max(2, Math.round(sz / 7));
  if (k > 1.15) return;
  /* the last of it flickers out rather than fading, which has no in-between */
  if (k > 0.85 && Math.floor(k * 40) % 2) return;
  for (let i = 0; i < SP_SHARD.length; i++) {
    const a = (i / SP_SHARD.length) * Math.PI * 2 + 0.4;
    const d = k * 70 * (0.6 + (i % 3) * 0.3);
    pxDraw(x, SP_SHARD[i], Math.round(px + Math.cos(a) * d),
           Math.round(py + Math.sin(a) * d + k * k * 110), s);
  }
}

/* ------------------------------------------------------------ the rulers
   What used to be bones.  Blocks only: a body, a dark strip along the
   bottom, a light strip along the top, one-pixel graduations, and a hard
   outline.  Built along its length so it reads at any size. */
function drawRuler(x, cx, cy, len, w, ang, tint) {
  const vertical = Math.abs(ang) > 0.1;
  const L = Math.max(2, Math.round(len)), H = Math.max(2, Math.round(w));
  const bw = vertical ? H : L, bh = vertical ? L : H;
  const px = Math.round(cx - bw / 2), py = Math.round(cy - bh / 2);

  const body = tint === 'blue' ? SANS_PAL.blue : tint === 'orange' ? SANS_PAL.orange : SANS_PAL.wood;
  const dark = tint === 'blue' ? '#1d5aa8' : tint === 'orange' ? '#b8641a' : SANS_PAL.woodDark;
  const edge = tint ? '#0d1a30' : SANS_PAL.woodEdge;
  const mark = tint ? 'rgba(255,255,255,.85)' : SANS_PAL.woodEdge;

  x.fillStyle = body; x.fillRect(px, py, bw, bh);
  /* the shading strips run along the ruler, whichever way it lies */
  const band = Math.max(1, Math.round(H * 0.22));
  x.fillStyle = dark;
  if (vertical) x.fillRect(px + bw - band, py, band, bh);
  else x.fillRect(px, py + bh - band, bw, band);
  /* the graduations, one pixel each */
  const step = Math.max(5, Math.round(H * 0.62));
  const tall = Math.max(2, Math.round(H * 0.42)), shrt = Math.max(1, Math.round(H * 0.24));
  x.fillStyle = mark;
  let n = 0;
  for (let p = step; p < (vertical ? bh : bw) - 1; p += step, n++) {
    const d = (n % 4 === 0) ? tall : shrt;
    if (vertical) x.fillRect(px + 1, py + p, d, 1);
    else x.fillRect(px + p, py + 1, 1, d);
  }
  pxFrame(x, px, py, bw, bh, edge, 1);
}

/* -------------------------------------------------------- the blaster
   Sans fires a floating skull.  Baldi fires his own head, and the jaw
   drops open as it charges. */
const SP_BLAST = pxSprite([
    '..............................',
    '.........oooooooooooo.........',
    '.......oossssssssssssoo.......',
    '.....oossssssssssssssssoo.....',
    '...oobbbbssssssssssssbbbboo...',
    '..ossbbbbkbbssssssbbkbbbbsso..',
    '..osssskkkkksssssskkkkksssso..',
    '.osssskkkkkkksssskkkkkkksssso.',
    'odddsskEEEEEksssskkKKKKkssdddo',
    'odddsskEEEEEksssskkKKKKkssdddo',
    'odddsskEEEEEksssskkKKKKkssdddo',
    'odddsskEEEEEksssskkKKKKkssdddo',
    'odddsskEEEEEksssskkkkkkkssdddo',
    'odddssskkkkkssdddskkkkksssdddo',
    '.oosssssskssssdddssskssssssoo.',
    '...ooooooooooodddoooooooooo...',
    '..............................'
  ],
  { o: '#5a4630', s: SANS_PAL.skin, d: SANS_PAL.skinDark,
    b: '#a8702a', k: '#141414', E: SANS_PAL.eye, K: '#ffffff' });

const SP_JAW = pxSprite([
    '.oooooooooooooooooooooooooooo.',
    '.ossKKKsKKKsKKKsKKKsKKKsKKKso.',
    '.ossKKKsKKKsKKKsKKKsKKKsKKKso.',
    '.osssssssssssssssssssssssssso.',
    '.oossssssssssssssssssssssssoo.',
    '...oossssssssssssssssssssoo...',
    '.....oooossssssssssssoooo.....',
    '.........oooooooooooo.........',
    '..............................'
  ],
  { o: '#5a4630', s: SANS_PAL.skin, K: '#fdfdf5' });

function drawBlaster(x, cx, cy, s, ang, open, charge) {
  const k = Math.max(1, Math.round(s * 3));
  const gape = Math.round(open * 9) * k;         /* the jaw drops as it charges */
  x.save();
  x.translate(Math.round(cx), Math.round(cy));
  x.rotate(ang);
  if (gape > 0) pxRect(x, -13 * k, 7 * k, 26 * k, gape + k, '#4a1010');
  pxDraw(x, SP_JAW, 0, 12 * k + gape, k);
  pxDraw(x, SP_BLAST, 0, -k, k, charge > 0.5 ? null : { E: '#2c5a1c' });
  x.restore();
}

/* The beam.  Hard bands, no gradient — its width is the whole animation,
   so it is drawn at exactly the width the blaster says it is. */
function drawBeam(x, cx, cy, ang, len, w, age, hold) {
  if (w < 1) return;
  x.save();
  x.translate(Math.round(cx), Math.round(cy));
  x.rotate(ang);
  const h = Math.max(1, Math.round(w / 2));
  pxRect(x, 0, -h, len, h * 2, '#c8f5a8');
  pxRect(x, 0, -Math.round(h * 0.66), len, Math.round(h * 1.32), '#e8ffd8');
  pxRect(x, 0, -Math.round(h * 0.34), len, Math.max(2, Math.round(h * 0.68)), '#ffffff');
  /* the flare at the muzzle, for the first moment only */
  if (age != null && age < 0.13) {
    const f = Math.round(h * (1.6 - age * 6));
    if (f > 1) pxRect(x, -f, -f, f * 2, f * 2, '#ffffff');
  }
  x.restore();
}

/* ------------------------------------------------------------- the desk
   The blue-soul platforms: a lid, a lip, and two legs. */
function drawDesk(x, cx, cy, w, h) {
  const bw = Math.max(4, Math.round(w)), bh = Math.max(3, Math.round(h));
  const px = Math.round(cx - bw / 2), py = Math.round(cy - bh / 2);
  pxRect(x, px, py, bw, bh, SANS_PAL.wood);
  pxRect(x, px, py + bh - Math.max(1, (bh * 0.34) | 0), bw, Math.max(1, (bh * 0.34) | 0), SANS_PAL.woodDark);
  pxFrame(x, px, py, bw, bh, '#6a5228', 1);
  const leg = Math.max(2, Math.round(bh * 0.36));
  pxRect(x, px + 3, py + bh, leg, Math.round(bh * 0.9), '#5f6a72');
  pxRect(x, px + bw - 3 - leg, py + bh, leg, Math.round(bh * 0.9), '#5f6a72');
}

/* ================================================================= BALDI
   The man himself, as a sprite: short, slumped, hands in the sweater, the
   grin that never leaves.  Four faces, swapped by what he is doing. */
const BALDI_PAL = {
  o: '#8a6a44', s: SANS_PAL.skin, d: SANS_PAL.skinDark, b: '#a8702a',
  w: '#ffffff', W: '#ffffff', k: '#101010', e: SANS_PAL.eye,
  E: SANS_PAL.eye, m: '#7a3038', t: '#fdfdf5', T: '#fdfdf5',
  g: SANS_PAL.sweater, G: SANS_PAL.sweaterDark, l: '#2b3ad8', f: '#ff8c1a',
  c: '#bfe8ff'
};

/* the head and the body, drawn as pixels: a round skull with ears, brows
   that drop when he means it, and one eye that lights up. */
function baldiHead(lit, teeth) {
  const brow = lit ? BALDI_BROW_LIT : BALDI_BROW_CALM;
  const eyes = lit ? BALDI_EYES_LIT : BALDI_EYES_CALM;
  const mouth = teeth ? BALDI_MOUTH_TEETH : BALDI_MOUTH_CALM;
  return pxSprite(BALDI_SKULL_TOP.concat(brow, eyes, BALDI_NOSE, mouth, BALDI_SKULL_BOT),
                  BALDI_PAL);
}
const BALDI_SKULL_TOP  = [
    '...........oooo...........',
    '.......oooossssoooo.......',
    '......osssssssssssso......',
    '....oossssssssssssssoo....',
    '...osssssbbssssbbssssso...'
  ];
const BALDI_BROW_LIT   = [
    '..osbbbssssssssssssbbbso..',
    '..osbbbbbbssssssbbbbbbso..'
  ];
const BALDI_BROW_CALM  = [
    '..ossbbbbbbssssbbbbbbsso..',
    '..ossbbbbssssssssbbbbsso..'
  ];
const BALDI_EYES_LIT   = [
    '.ossssWWWWssssssWWWWsssso.',
    '.osssWWWWWWssssWWWWWWssso.',
    'oddssWWWWWWssssWWWWWWssddo',
    'odddsWWEEEWssssWWkkkWsdddo',
    'odddsWWEEEWssssWWkkkWsdddo',
    'odddsWWEEEWssssWWkkkWsdddo',
    'odddsWWWWWWssssWWWWWWsdddo',
    'oodsssWWWWssddssWWWWsssdoo',
    '..osssssssssddssssssssso..'
  ];
const BALDI_EYES_CALM  = [
    '.ossssWWWWssssssWWWWsssso.',
    '.osssWWWWWWssssWWWWWWssso.',
    'oddssWWWWWWssssWWWWWWssddo',
    'odddsWWkkkWssssWWkkkWsdddo',
    'odddsWWkkkWssssWWkkkWsdddo',
    'odddsWWkkkWssssWWkkkWsdddo',
    'odddsWWWWWWssssWWWWWWsdddo',
    'oodsssWWWWssddssWWWWsssdoo',
    '..osssssssssddssssssssso..'
  ];
const BALDI_NOSE       = [
    '..osssmmssssssssssmmssso..'
  ];
const BALDI_MOUTH_TEETH= [
    '...osssmTTTTTTTTTTmssso...',
    '....oosmmmmmmmmmmmmsoo....',
    '......osssssssssssso......'
  ];
const BALDI_MOUTH_CALM = [
    '...osssmmmmmmmmmmmmssso...',
    '....oosmmmmmmmmmmmmsoo....',
    '......osssssssssssso......'
  ];
const BALDI_SKULL_BOT  = [
    '.......oooossssoooo.......',
    '...........oooo...........'
  ];
const SP_HEAD = {
  calm: baldiHead(0, 0), calmT: baldiHead(0, 1),
  lit:  baldiHead(1, 0), litT:  baldiHead(1, 1)
};

const SP_BODY = pxSprite([
    '.....oooooooooooooooooooo.....',
    '....oggggggggggggggggggggo....',
    '...oggggggggggggggggggggggo...',
    '...oggggggggggggggggggggggo...',
    '...oggggggggggggggggggggggo...',
    'oooggggggggggggggggggggggggooo',
    'oggggggggggggggggggggggggggggo',
    'oggggggggggggggggggggggggggggo',
    'oggggggggGGGGGGGGGGGGggggggggo',
    'oggggggggGGGGGGGGGGGGggggggggo',
    'oggggggggGGGGGGGGGGGGggggggggo',
    'oggggggggGGGGGGGGGGGGggggggggo',
    'oggggggggGGGGGGGGGGGGggggggggo',
    'oggggggggGGGGGGGGGGGGggggggggo',
    'oggggggggggggggggggggggggggggo',
    'oooGGGGGGGGGGGGGGGGGGGGGGGGooo',
    '...oooooooooooooooooooooooo...',
    '.........llll....llll.........',
    '.........llll....llll.........',
    '.........llll....llll.........',
    '.........llll....llll.........',
    '.......fffffff..fffffff.......',
    '.......fffffff..fffffff.......',
    '.......fffffff..fffffff.......',
    '..............................'
  ], BALDI_PAL);

const SP_SWEAT = pxSprite([
  '..c..',
  '.ccc.',
  'ccccc',
  'ccccc',
  '.ccc.'
], BALDI_PAL);

function drawBaldiSans(x, cx, cy, s, o) {
  o = o || {};
  const t = o.t || 0;
  const k = Math.max(1, Math.round(s * 2.4));      /* pixels per sprite dot */
  const bob = Math.round(Math.sin(t * 2.1) * 2) * k;
  const lit = (o.lit || 0) > 0.5;
  x.save();
  x.translate(Math.round(cx), Math.round(cy) + bob);
  if (o.shake) x.translate(Math.round((Math.random() - 0.5) * o.shake),
                           Math.round((Math.random() - 0.5) * o.shake));
  /* head and body meet with a pixel of overlap, so he reads as one figure */
  pxDraw(x, SP_BODY, 0, 12 * k, k);
  const head = lit ? (o.teeth ? SP_HEAD.litT : SP_HEAD.lit)
                   : (o.teeth ? SP_HEAD.calmT : SP_HEAD.calm);
  const float = Math.round(Math.sin(t * 1.6)) * k;
  pxDraw(x, head, 0, -11 * k + float, k);
  if ((o.sweat || 0) > 0.5) pxDraw(x, SP_SWEAT, 15 * k, -13 * k + float, k);
  x.restore();
}


/* =========================================================================
   Part 5s — BALDI SANS MODE
   The bad-time fight, rebuilt from scratch in Baldi's schoolhouse.  Bones
   are rulers, the blasters are his own head, the platforms are desks, and
   KARMA is DETENTION — but the rules are the rules: one damage a hit, a
   poison that keeps taking, and a box you cannot leave.

   Everything is on one canvas at a virtual 640x480, scaled to fit, so the
   geometry is identical on any screen.
   ========================================================================= */

const SV_W = 640, SV_H = 480;
const SV_MAXHP = 92;
const SV_BONE = 14;      /* every ruler is fourteen across, as in the original */

/* What is in your bag.  Two birthday cakes and that is the lot — they are
   for the round you know is coming.  Ten cakes underneath them, and a bar
   you will never run out of, because using anything costs you the turn and
   that is the price the small one makes you keep paying. */
const SV_ITEMS = [
  { name: 'Birthday Cake', heal: 100, n: 2,
    use: '* You eat the Birthday Cake.\n* Somebody wrote GET WELL SOON on it.' },
  { name: 'Cake',          heal: 50,  n: 10,
    use: '* You eat the Cake.\n* It tastes like the last day of term.' },
  { name: 'Chocolate bar', heal: 22,  n: Infinity,
    use: '* You eat the Chocolate bar.\n* There is always another one.' }
];

/* -------------------------------------------------------------------------
   The movement system, lifted straight out of the project you sent.

   These are not tuned-by-feel numbers — they are the constants the original
   declares in its own PlayerMovement group, and the rules below are its own
   rules, down to the quirks:

     * no diagonal normalisation, so moving corner-ways really is 1.41x fast
     * holding CANCEL halves your speed
     * gravity is not one number.  It changes with how fast you are already
       going, which is what gives the jump its hang at the top
     * above 240 px/s of fall NO band matches, so gravity stops applying and
       the fall coasts.  That is in the original too, and it is load-bearing
     * releasing the jump key clips the rise to 30 px/s, once, on the frame
       you let go
   ------------------------------------------------------------------------- */
const SV_MOVE = {
  SPEED: 150,           /* HeartSpeed                                       */
  SPEED_SLOW: 75,       /* ... while CANCEL (X / Shift) is held             */
  JUMP: 180,            /* HEART_JUMP_STRENGTH                              */
  CUTOFF: 30,           /* HEART_JUMPHOLD_CUTOFF                            */
  MINHOLD: 0.05,        /* ... which cannot bite until the jump is this old  */
  MAXFALL: 750,         /* MaxFallSpeed, until an attack says otherwise     */
  HALF: 8,              /* the heart is 16x16 ...                           */
  HIT: 2,               /* ... but its hitbox is only 4x4                   */
  INSET: 5,             /* the border sits 5px inside the stated zone       */
  SNAP: 8.05,           /* how it settles onto a desk                       */
  SLAM: 330,            /* land harder than this and it costs you           */
  ZONE_SPEED: 480,      /* the box resizes at a flat 480 px/s an edge       */
  /* gravity by how fast you are moving along it — the whole feel is here */
  grav(v) {
    if (v < 240 && v > 15)   return 540;   /* falling: heavy               */
    if (v <= 15 && v > -30)  return 180;   /* the apex: floaty            */
    if (v <= -30 && v > -120) return 450;  /* rise running out: heavy     */
    if (v <= -120)           return 180;   /* just launched: floaty       */
    return 0;                              /* past 240 nothing applies    */
  },
  /* DETENTION drains faster the more of it you are carrying */
  krStep(kr) {
    if (kr >= 40) return 0.033;
    if (kr >= 30) return 0.066;
    if (kr >= 20) return 0.166;
    if (kr >= 10) return 0.5;
    return 1;
  }
};

/* the four buttons, and what he says to each */
const SV_LINES = [
  ['it\'s a beautiful day outside.', 'birds are singing, flowers are blooming...',
   'on days like these, students like you...', 'should be doing their MATH HOMEWORK.'],
  ['seven notebooks.', 'that\'s all i asked for.'],
  ['huh. you\'re still going.'],
  ['you know, i keep a ruler in every classroom.', 'just in case.'],
  ['you\'re not even trying to answer them any more.'],
  ['do you think even the worst student can change?'],
  ['heh. that\'s a nice expression you\'ve got there.'],
  ['okay. i give up.', 'i can\'t beat you.', '...just kidding.'],
  ['alright. that\'s enough of that.']
];

const SansFight = {
  active: false,

  open() {
    if (typeof stopMusic === 'function') stopMusic();
    Audio1.init(); Audio1.resume();
    G.mode = 'sans'; G.running = false;
    ['menu', 'modeScreen', 'modeSelect', 'hud'].forEach(id => UI.el(id).classList.add('hidden'));
    UI.el('sans').classList.add('on');
    this.cv = UI.el('svCanvas');
    this.x = this.cv.getContext('2d');
    this.resize();
    this.reset();
    SansSong.build();
    this.t0 = Audio1.ctx.currentTime;
  },
  close() {
    SansSong.stop();
    this.active = false;
    UI.el('sans').classList.remove('on');
    UI.el('svFlash').style.opacity = '0';
    if (typeof returnToTitle === 'function') returnToTitle();
  },

  /* The dialogue box is the same box the menu uses — wide enough for a
     whole line of the bitmap font, which is not true of a narrow one. */
  textBox() {
    this.box.tx = 320; this.box.ty = 321;
    this.box.tw = 575; this.box.th = 140;
  },

  reset() {
    this.active = true;
    this.t = 0;
    this.phase = 'intro';          /* intro | menu | act | attack | dead | win */
    this.phaseT = 0;
    this.turn = -1; this.lineIdx = 0;
    this.hp = SV_MAXHP; this.kr = 0;
    this.dmgFlash = 0; this.iframe = 0;
    this.shake = 0; this.flash = 0;
    this.lit = 0; this.sweat = 0; this.baldiX = SV_W / 2; this.baldiDodge = 0;
    this.menuSel = 0; this.subSel = 0; this.menuMode = 'top';
    this.bag = SV_ITEMS.map(it => ({ name: it.name, heal: it.heal, n: it.n, use: it.use }));
    this.line = 0; this.lineChar = 0; this.lines = SV_LINES[0];
    this.bullets = [];
    this.desks = [];
    this.box = { x: 320, y: 321, w: 575, h: 140, tx: 320, ty: 321, tw: 575, th: 140 };
    this.soul = { x: SV_W / 2, y: 300, vx: 0, vy: 0, blue: 0, ground: 0,
                  ang: 90 };                 /* which way is down, in degrees */
    this.keys = {}; this.pkeys = {};
    this.krT = 0; this.dmgT = -9; this.slamDmg = 0;
    this.shatter = -1;
    this.attackName = null; this.prog = null; this.pc = 0; this.acc = 0;
    this.V = {}; this.maxFall = SV_MOVE.MAXFALL; this.black = 0; this.slam = 0;
    this.zoneSpeed = SV_MOVE.ZONE_SPEED;
    this.result = null;
  },

  /* The fight is painted at exactly 640x480 into its own buffer and then
     blown up with the smoothing turned off, so a pixel stays a pixel all
     the way to the screen instead of being blurred into one. */
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.cv.width = Math.min(1280, Math.max(320, w));
    this.cv.height = Math.round(this.cv.width * h / w);
    if (!this.buf) {
      this.buf = document.createElement('canvas');
      this.buf.width = SV_W; this.buf.height = SV_H;
      this.bx = this.buf.getContext('2d');
    }
    /* a whole-number blow-up wherever one fits, so no pixel is wider than
       its neighbour; below 1:1 there is nothing to be done about it */
    let k = Math.min(this.cv.width / SV_W, this.cv.height / SV_H);
    if (k >= 1) k = Math.floor(k * 2) / 2;          /* halves still look even */
    this.S = k;
    this.OX = Math.round((this.cv.width - SV_W * k) / 2);
    this.OY = Math.round((this.cv.height - SV_H * k) / 2);
    this.x.imageSmoothingEnabled = false;
    this.bx.imageSmoothingEnabled = false;
  },

  /* ------------------------------------------------------------- input */
  key(code, down) {
    if (!this.active) return false;
    if (code === 'Escape' && down) { this.close(); return true; }
    this.keys = this.keys || {};
    const was = this.keys[code];
    this.keys[code] = down;
    /* CANCEL is the slow walk while you are dodging, and only the back
       button once you are in the menu */
    if (code === 'KeyX' || code === 'ShiftLeft' || code === 'ShiftRight')
      this.keys['cancel'] = down;

    /* Catch the press here rather than noticing it on the next frame.  A
       quick tap can start and finish inside one frame, and a poll that only
       looks at what is held right now never sees it at all — which is the
       jump that "just did not happen". */
    if (down && !was) {
      const d = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd',
                  ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' }[code];
      if (d) { this.press = this.press || {}; this.press[d] = 1; }
    }
    if (!down) return true;

    if (this.phase === 'intro' || this.phase === 'act') {
      if (code === 'KeyZ' || code === 'Enter' || code === 'Space') this.advanceLine();
      return true;
    }
    if (this.phase === 'menu') {
      if (this.menuMode === 'top') {
        if (code === 'ArrowLeft' || code === 'KeyA') { this.menuSel = (this.menuSel + 3) % 4; this.blip(); }
        else if (code === 'ArrowRight' || code === 'KeyD') { this.menuSel = (this.menuSel + 1) % 4; this.blip(); }
        else if (code === 'KeyZ' || code === 'Enter' || code === 'Space') this.pickMenu();
      } else {
        if (code === 'KeyX' || code === 'Backspace') { this.menuMode = 'top'; this.blip(); }
        else if (code === 'KeyZ' || code === 'Enter' || code === 'Space') this.pickSub();
        else if (this.menuMode === 'item' && this.bag.length > 1 &&
                 (code === 'ArrowUp' || code === 'ArrowDown' ||
                  code === 'ArrowLeft' || code === 'ArrowRight')) {
          const d = (code === 'ArrowUp' || code === 'ArrowLeft') ? -1 : 1;
          this.subSel = (this.subSel + d + this.bag.length) % this.bag.length;
          this.blip();
        }
      }
      return true;
    }
    if (this.phase === 'dead' || this.phase === 'win') {
      if (code === 'KeyZ' || code === 'Enter' || code === 'Space') {
        if (this.phase === 'dead') this.reset();
        else this.close();
      }
      return true;
    }
    return true;
  },
  /* Combat sounds go straight to the game's own effects bus rather than the
     song's, so they still work when the music has stopped — which is exactly
     the moment you most need to hear that you died. */
  sfx(kind) {
    Audio1.init();
    const ctx = Audio1.ctx;
    if (!ctx) return;
    const out = Audio1.sfxGain || Audio1.master || ctx.destination;
    const t = ctx.currentTime;
    const tone = (type, f0, f1, dur, vol, filt) => {
      const o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let last = o;
      if (filt) { const f = ctx.createBiquadFilter(); f.type = 'lowpass';
                  f.frequency.value = filt; o.connect(f); last = f; }
      last.connect(g); g.connect(out);
      o.start(t); o.stop(t + dur + 0.02);
    };
    const noise = (dur, type, freq, vol, q) => {
      const sN = ctx.createBufferSource(); sN.buffer = Audio1.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
      if (q) f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      sN.connect(f); f.connect(g); g.connect(out);
      sN.start(t); sN.stop(t + dur + 0.02);
    };
    if (kind === 'hurt') { tone('square', 300, 90, 0.24, 0.13, 1400); noise(0.16, 'bandpass', 520, 0.09, 1.2); }
    else if (kind === 'blip') tone('square', 620, 880, 0.055, 0.05);
    else if (kind === 'select') { tone('square', 523, 523, 0.06, 0.06); tone('square', 784, 784, 0.10, 0.05); }
    else if (kind === 'swing') { noise(0.20, 'highpass', 2200, 0.10); tone('sawtooth', 900, 180, 0.20, 0.07, 2600); }
    else if (kind === 'blast') { noise(0.55, 'highpass', 900, 0.16); tone('sawtooth', 260, 60, 0.5, 0.10, 1800); }
    else if (kind === 'heal') { for (let i = 0; i < 3; i++) tone('sine', [523, 659, 784][i], [523, 659, 784][i], 0.28, 0.06); }
    else if (kind === 'shatter') { noise(0.9, 'highpass', 1800, 0.20); tone('square', 180, 40, 0.8, 0.12, 900); }
    else if (kind === 'warn') tone('square', 1100, 1100, 0.05, 0.045);
    else if (kind === 'stab') { noise(0.14, 'lowpass', 900, 0.13); tone('square', 220, 70, 0.13, 0.09, 1200); }
    else if (kind === 'charge') { noise(0.22, 'bandpass', 1800, 0.05, 3); tone('sawtooth', 90, 300, 0.22, 0.035, 1400); }
    else if (kind === 'charge2') { tone('square', 500, 1500, 0.09, 0.055, 3000); }
    else if (kind === 'slam') { noise(0.30, 'lowpass', 500, 0.18); tone('sine', 150, 40, 0.34, 0.14); }
  },
  blip() { this.sfx('blip'); },

  advanceLine() {
    const full = this.lines[this.line] || '';
    if (this.lineChar < full.length) { this.lineChar = full.length; return; }
    this.line++;
    this.lineChar = 0;
    if (this.line >= this.lines.length) {
      if (this.phase === 'intro') { SansSong.start(); }
      this.startAttack();
    }
  },

  pickMenu() {
    const s = this.menuSel;
    this.blip();
    if (s === 0) { this.menuMode = 'fight'; this.swing = 0; this.swingDir = 1; this.sfx('select'); }
    else if (s === 3) { this.toDialogue(); }
    else { this.menuMode = s === 1 ? 'act' : 'item'; this.subSel = 0; }
  },
  pickSub() {
    if (this.menuMode === 'fight') {
      /* the swing bar: how close to centre you stopped it */
      const acc = 1 - Math.abs(this.swing);
      this.lastHit = acc;
      this.menuMode = 'top';
      /* he dodges every time but the last */
      if (this.turn >= SANS_ORDER.length - 1) { this.win(acc); return; }
      this.baldiDodge = 1;
      this.flash = 0.25;
      this.sfx('swing');
      this.toDialogue();
      return;
    }
    if (this.menuMode === 'item') {
      const it = this.bag[this.subSel];
      if (!it || it.n <= 0) { this.blip(); return; }
      if (isFinite(it.n)) it.n -= 1;
      this.hp = Math.min(SV_MAXHP, this.hp + it.heal);
      /* healing pays off the DETENTION you were carrying, too */
      this.kr = Math.max(0, this.kr - it.heal);
      this.flash = 0.15;
      this.sfx('heal');
      this.itemLine = it.use + '\n* You recovered ' + it.heal + ' HP!';
      if (isFinite(it.n) && it.n <= 0) this.bag.splice(this.subSel, 1);
      if (this.subSel >= this.bag.length) this.subSel = Math.max(0, this.bag.length - 1);
      this.menuMode = 'top';
      this.toItemText();
      return;
    }
    this.menuMode = 'top';
    this.toDialogue();
  },
  /* eating something gets its own line before he takes his turn */
  toItemText() {
    this.textBox();
    this.lines = this.itemLine.split('\n');
    this.line = 0; this.lineChar = 0;
    this.phase = 'act'; this.phaseT = 0;
    this.ateThisTurn = 1;
  },
  toDialogue() {
    this.textBox();
    this.lineIdx = (this.lineIdx || 0) + 1;
    this.lines = SV_LINES[Math.min(this.lineIdx, SV_LINES.length - 1)];
    this.line = 0; this.lineChar = 0;
    this.phase = 'act'; this.phaseT = 0;
  },

  win(acc) {
    this.phase = 'win'; this.phaseT = 0;
    this.result = { acc: acc, hp: this.hp };
    this.sfx('select');
    SansSong.stop();
  },

  /* -------------------------------------------------------------- hurt */
  /* One damage and six DETENTION a hit, and the window between hits is a
     single frame — 0.033 s — exactly as the original has it.  Being clipped
     by a wall of rulers is meant to cost you the whole wall. */
  hurt(dmg, kr) {
    if (this.phase !== 'attack') return;
    if (this.t - this.dmgT < 0.033) return;
    this.dmgT = this.t;
    this.hp -= (dmg == null ? 1 : dmg);
    this.kr += (kr == null ? 6 : kr);
    this.iframe = 0.12;                         /* just for the blink */
    this.dmgFlash = 0.5;
    this.shake = 8;
    this.sfx('hurt');
    if (this.hp <= 0) this.die();
  },
  die() {
    this.hp = 0;
    this.phase = 'dead'; this.phaseT = 0;
    this.shatter = 0;
    this.sfx('shatter');
    SansSong.stop();
  }
};

/* =========================================================================
   The attack interpreter.

   The scripts that came in with the build are a little language: a delay,
   a command, and up to eight arguments.  It has variables ($Name), integer
   maths, labels and six kinds of jump, and the game commands sit alongside
   them.  Running the real programs is the only way for every round to be
   the round you actually get, so that is what this does — instruction for
   instruction, in the original 640x480 coordinates.
   ========================================================================= */

const SansVM = {
  cache: {},
  parse(name) {
    if (this.cache[name]) return this.cache[name];
    const rows = SANS_SCRIPTS[name].split(';').map(r => r.split('|'));
    const labels = {};
    for (let i = 0; i < rows.length; i++) {
      const c = rows[i][1];
      if (c && c.charAt(0) === ':') labels[c.slice(1)] = i;
    }
    return (this.cache[name] = { rows: rows, labels: labels });
  }
};

Object.assign(SansFight, {
  /* --- reading an argument: $Name is a variable, anything else a number --- */
  v(a) {
    if (a == null || a === '') return 0;
    if (a.charAt && a.charAt(0) === '$') return this.V[a.slice(1)] || 0;
    const n = parseFloat(a);
    return isNaN(n) ? 0 : n;
  },
  /* A jump target is either a label or a line number — and the line numbers
     in these scripts are one-based, so they need shifting to index the rows
     array.  Getting this wrong makes every looping attack loop forever. */
  target(a) {
    const t = (a && a.charAt && a.charAt(0) === '$') ? this.v(a) : a;
    if (this.prog.labels[t] != null) return this.prog.labels[t];
    const n = parseInt(t, 10);
    return isNaN(n) ? this.pc : n - 1;
  },

  startAttack() {
    this.turn++;
    let pick = SANS_ORDER[Math.min(this.turn, SANS_ORDER.length - 1)];
    if (Array.isArray(pick)) pick = pick[Math.floor(Math.random() * pick.length)];
    this.attackName = pick;
    this.prog = SansVM.parse(pick);
    this.pc = 0; this.acc = 0; this.V = {};
    this.tlPaused = 0;
    this.bullets.length = 0;
    this.desks.length = 0;
    this.phase = 'attack'; this.phaseT = 0;
    this.sweat = this.turn >= 15 ? 1 : 0;
    this.black = 0;
    this.rearm();
  },
  endAttack() {
    this.bullets.length = 0; this.desks.length = 0;
    this.soul.blue = 0; this.soul.ang = 90;
    this.soul.vx = 0; this.soul.vy = 0;
    this.slamDmg = 0; this.black = 0;
    this.zone(33, 251, 608, 391, 0);
    this.phase = 'menu'; this.phaseT = 0;
    this.menuMode = 'top'; this.menuSel = 0;
  },

  /* Forget that a key was already down.  Wanted whenever the soul is put
     somewhere new — a teleport, a mode change, the far side of a blackout —
     because otherwise a jump key you never let go of reads as "still held"
     and the first jump of the new round silently does not happen. */
  rearm() {
    this.pkeys = {};
    this.jumpBuf = 0;
  },

  /* the combat zone is stored the way the scripts state it: l, t, r, b */
  zone(l, t, r, b, resume) {
    this.box.tx = (l + r) / 2; this.box.ty = (t + b) / 2;
    this.box.tw = r - l; this.box.th = b - t;
    this.zoneResume = resume ? 1 : 0;
  },
  zoneNow(l, t, r, b) {
    this.zone(l, t, r, b, 0);
    this.box.x = this.box.tx; this.box.y = this.box.ty;
    this.box.w = this.box.tw; this.box.h = this.box.th;
  },

  runVM(dt) {
    if (this.tlPaused) return;
    this.acc += dt;
    let guard = 0;
    while (this.pc < this.prog.rows.length && guard++ < 4000) {
      const row = this.prog.rows[this.pc];
      /* The delay can be a variable, not just a number — the finale times
         its slams with $Wait1 and $Wait2 and slows them down as he tires.
         parseFloat gives NaN on those, which fell through to a zero delay
         and ran the whole 38-slam sequence inside one frame. */
      const need = this.v(row[0]);
      if (this.acc < need) break;
      this.acc -= need;
      this.pc++;
      this.exec(row);
      if (this.tlPaused || this.phase !== 'attack') break;
    }
  },

  exec(row) {
    const c = row[1], A = row;
    const v = a => this.v(a);
    const V = this.V;
    switch (c) {
      /* ---------------- maths ---------------- */
      case 'SET':   V[A[2]] = v(A[3]); return;
      case 'ADD':   V[A[2]] = v(A[3]) + v(A[4]); return;
      case 'SUB':   V[A[2]] = v(A[3]) - v(A[4]); return;
      case 'MUL':   V[A[2]] = v(A[3]) * v(A[4]); return;
      case 'DIV':   V[A[2]] = v(A[4]) ? v(A[3]) / v(A[4]) : 0; return;
      case 'MOD':   V[A[2]] = v(A[4]) ? v(A[3]) % v(A[4]) : 0; return;
      case 'FLOOR': V[A[2]] = Math.floor(v(A[3])); return;
      case 'RND':   V[A[2]] = Math.floor(Math.random() * v(A[3])); return;
      case 'SIN':   V[A[2]] = Math.sin(v(A[3]) * Math.PI / 180); return;
      case 'COS':   V[A[2]] = Math.cos(v(A[3]) * Math.PI / 180); return;
      case 'ANGLE': V[A[2]] = Math.atan2(v(A[6]) - v(A[4]), v(A[5]) - v(A[3]))
                              * 180 / Math.PI; return;

      /* ---------------- jumps ---------------- */
      case 'JMPABS': this.pc = this.target(A[2]); return;
      /* relative jumps count from the JMPREL row itself, and pc has
         already moved past it */
      case 'JMPREL': this.pc = this.pc - 1 + v(A[2]); return;
      case 'JMPZ':  if (v(A[3]) === 0) this.pc = this.target(A[2]); return;
      case 'JMPNZ': if (v(A[3]) !== 0) this.pc = this.target(A[2]); return;
      case 'JMPE':  if (v(A[3]) === v(A[4])) this.pc = this.target(A[2]); return;
      case 'JMPNE': if (v(A[3]) !== v(A[4])) this.pc = this.target(A[2]); return;
      case 'JMPL':  if (v(A[3]) <  v(A[4])) this.pc = this.target(A[2]); return;
      case 'JMPNL': if (v(A[3]) >= v(A[4])) this.pc = this.target(A[2]); return;
      case 'JMPG':  if (v(A[3]) >  v(A[4])) this.pc = this.target(A[2]); return;
      case 'JMPNG': if (v(A[3]) <= v(A[4])) this.pc = this.target(A[2]); return;

      /* ---------------- the box ---------------- */
      case 'CombatZoneResize':
        this.zone(v(A[2]), v(A[3]), v(A[4]), v(A[5]), A[6] === 'TLResume'); return;
      case 'CombatZoneResizeInstant':
        this.zoneNow(v(A[2]), v(A[3]), v(A[4]), v(A[5])); return;
      case 'CombatZoneSpeed': this.zoneSpeed = v(A[2]); return;
      case 'TLPause': this.tlPaused = 1; return;

      /* ---------------- the soul ---------------- */
      case 'HeartTeleport':
        this.soul.x = v(A[2]); this.soul.y = v(A[3]);
        this.soul.vx = 0; this.soul.vy = 0;
        this.rearm(); return;
      case 'HeartMode':
        this.soul.blue = v(A[2]) ? 1 : 0;
        this.soul.ang = 90;                    /* down is down again */
        this.soul.vx = 0; this.soul.vy = 0;
        this.rearm(); return;
      /* signed: 0 pins you in the air, and a negative one floats you up */
      case 'HeartMaxFallSpeed': this.maxFall = v(A[2]); return;
      case 'GetHeartPos': V[A[2]] = this.soul.x; V[A[3]] = this.soul.y; return;

      /* ---------------- what he throws ---------------- */
      case 'BoneV':  this.bone(1, v(A[2]), v(A[3]), v(A[4]), v(A[5]), v(A[6]), v(A[7])); return;
      case 'BoneH':  this.bone(0, v(A[2]), v(A[3]), v(A[4]), v(A[5]), v(A[6]), v(A[7])); return;
      case 'BoneVRepeat': this.boneRep(1, A); return;
      case 'BoneHRepeat': this.boneRep(0, A); return;
      /* BoneStab dir, size, warn, hold.  `size` is the THICKNESS of the
         ruler, not how much of the box it leaves — it slides in from that
         wall at size*10 px/s, holds, and slides back out.  The red square
         you get first is exactly the footprint it is about to occupy. */
      case 'BoneStab':
        this.bullets.push({ k: 'stab', dir: v(A[2]) | 0, size: v(A[3]),
                            warn: v(A[4]), hold: v(A[5]) || 0.33,
                            kr: 6, t: 0, phase: 0, off: 0 });
        this.sfx('warn'); return;
      case 'SineBones': this.sine(v(A[2]), v(A[3]), v(A[4]), v(A[5])); return;
      /* GasterBlaster size, fromX, fromY, toX, toY, angle, wait, beam.

         It does not just appear and fire.  It comes in from wherever it was
         spawned, eases into the spot, turns to face the way it is going to
         shoot, sits there for `wait` seconds, opens up, and only then is
         there a beam — which is what makes it something you can read. */
      case 'GasterBlaster': {
        const size = v(A[2]) | 0;
        this.bullets.push({
          /* Three sizes, and the small one is genuinely small: the beam is
             35 x (height / imageHeight), and size 0 never scales the height
             at all.  Treating it like size 1 made those blasters twice the
             head they should be, with twice the beam. */
          k: 'blaster', size: size,
          scale: size >= 2 ? 3 : size === 1 ? 2 : 1,
          px: size >= 2 ? 5 : size === 1 ? 4 : 2,
          x: v(A[3]), y: v(A[4]),                 /* where it comes in */
          tx: v(A[5]), ty: v(A[6]),               /* where it is going */
          deg: 90, tdeg: v(A[7]),                 /* it starts facing down */
          ang: Math.PI / 2,
          wait: v(A[8]) || 0, beam: v(A[9]) || 0,
          st: 0, tm: 0, beamT: -1, bw: 0, drift: 0, kr: 10
        });
        this.sfx('charge');
        return;
      }
      /* x,y is the desk's top-left in the scripts; we keep the centre.

         The seventh argument is the one that matters on platforms4: with it
         set the desk does not leave — it turns round at the wall and comes
         back, which is the whole reason that round is standable. */
      case 'Platform':
        this.desks.push({ x: v(A[2]) + v(A[4]) / 2, y: v(A[3]), w: v(A[4]),
                          dir: v(A[5]) | 0, speed: v(A[6]),
                          bounce: v(A[7]) > 0 ? 1 : 0, h: 10 });
        return;
      case 'PlatformRepeat': {
        const n = v(A[7]) || 1, sp = v(A[8]) || 0;
        const d = v(A[5]) | 0;
        const dx = [1, 0, -1, 0][d], dy = [0, 1, 0, -1][d];
        for (let i = 0; i < n; i++)
          this.desks.push({ x: v(A[2]) + v(A[4]) / 2 - dx * sp * i,
                            y: v(A[3]) - dy * sp * i,
                            w: v(A[4]), dir: d, speed: v(A[6]), h: 10 });
        return;
      }

      /* ---------------- him ---------------- */
      case 'SansBody': this.pose = A[2]; return;
      case 'SansHead': this.face = A[2]; return;
      /* he slams, and which way is down changes.  You are thrown along the
         new gravity at the current fall cap — that is the whole trick. */
      case 'SansSlam': {
        const dir = v(A[2]) | 0;
        this.slam = 0.45; this.slamDir = dir;
        const S = this.soul;
        S.blue = 1; S.ang = dir * 90; this.slamDmg = 1;
        this.rearm();
        const a = S.ang * Math.PI / 180;
        S.vx = Math.round(Math.cos(a)) * this.maxFall;
        S.vy = Math.round(Math.sin(a)) * this.maxFall;
        this.sfx('swing'); return;
      }
      case 'SansSlamDamage': this.slamDmg = v(A[2]) ? 1 : 0; return;
      case 'SansX': this.baldiX = v(A[2]); return;
      case 'SansText': this.sansText = A[2]; this.sansTextT = 1.4; return;
      case 'SansSweat': this.sweat = 1; return;
      case 'SansAnimation': case 'SansTorso':
      case 'SansRepeat': case 'SansEndRepeat': return;

      /* ---------------- dressing ---------------- */
      /* BlackScreen is not decoration.  In the original, switching it on
         hides the play area, silences the music AND destroys every bullet
         and platform on the board — it is the wipe between the rounds of a
         multi attack.  Without it those rounds stack on top of each other
         until the box is a wall of rulers you cannot survive. */
      case 'BlackScreen':
        this.black = v(A[2]) ? 1 : 0;
        if (this.black) {
          this.bullets.length = 0;
          this.desks.length = 0;
          this.flash = 0.28;
        } else this.rearm();
        return;
      case 'Sound':
        if (A[2] === 'Flash') this.sfx('warn');
        else if (A[2] === 'Ding') this.sfx('select');
        else this.sfx('blip');
        return;
      case 'EndAttack': this.endAttack(); return;
      default: return;                 /* labels and anything unrecognised */
    }
  },

  /* vertical bones are tall and travel sideways; horizontal ones the reverse */
  /* type: 0 plain, 1 blue (only bites if you move), 2 orange (only if you
     stand still) — the original's own three, on instance variable 4. */
  bone(vertical, x, y, len, dir, speed, type) {
    this.bullets.push({ k: 'bone', vert: !!vertical, x: x, y: y, len: len,
                        dir: dir | 0, speed: speed, type: (type | 0) || 0,
                        kr: 6, life: 60 });
  },
  boneRep(vertical, A) {
    const v = a => this.v(a);
    const n = v(A[7]) || 1, sp = v(A[8]) || 0, d = v(A[5]) | 0;
    const dx = [1, 0, -1, 0][d], dy = [0, 1, 0, -1][d];
    for (let i = 0; i < n; i++)
      this.bone(vertical, v(A[2]) - dx * sp * i, v(A[3]) - dy * sp * i,
                v(A[4]), d, v(A[6]), v(A[9]));
  },
  /* SineBones count, spacing, speed, height.  Not floating bones — pairs,
     one down from the ceiling and one up from the floor, with a 39px gap
     between them that snakes as it crosses.  A negative spacing enters from
     the left; a positive one from the right. */
  sine(count, spacing, speed, height) {
    const B = this.box;
    const l = B.x - B.w / 2, r = B.x + B.w / 2;
    const t = B.y - B.h / 2, b = B.y + B.h / 2;
    for (let i = 0; i < count; i++) {
      const x = (spacing > 0 ? r : l) + spacing * i;
      const dir = spacing > 0 ? 2 : 0;
      const wob = Math.round(Math.sin(i / 3) * 28);
      const y1 = t + 6, h1 = height + wob;
      const y2 = y1 + h1 + 39;
      this.bone(1, x, y1, h1, dir, speed, 0);
      this.bone(1, x, y2, (b - 5) - y2, dir, speed, 0);
    }
  }
});

/* =========================================================================
   The tick: the soul, the bullets, and what happens when they meet
   ========================================================================= */
Object.assign(SansFight, {
  update(dt) {
    if (!this.active) return;
    dt = Math.min(dt, 0.05);
    this.t += dt; this.phaseT += dt;
    this.iframe = Math.max(0, this.iframe - dt);
    this.dmgFlash = Math.max(0, this.dmgFlash - dt * 2);
    this.shake *= Math.exp(-dt * 6);
    this.flash = Math.max(0, this.flash - dt * 2.4);
    this.baldiDodge = Math.max(0, this.baldiDodge - dt * 1.4);

    /* DETENTION: capped at 40, never quite lethal, and it takes a point
       faster the more of it you have — the original's own ladder. */
    if (this.kr > 40) this.kr = 40;
    if (this.kr >= this.hp) this.kr = Math.max(0, this.hp - 1);
    if (this.kr > 0 && this.hp > 1 && this.phase !== 'dead' && this.phase !== 'win') {
      this.krT += dt;
      const step = SV_MOVE.krStep(this.kr);
      while (this.krT >= step && this.kr > 0 && this.hp > 1) {
        this.krT -= step; this.kr -= 1; this.hp -= 1;
      }
    } else this.krT = 0;

    /* the box does not ease — every edge travels at a flat 480 px/s */
    const B = this.box, sp = (this.zoneSpeed || SV_MOVE.ZONE_SPEED) * dt;
    const edge = (cur, tgt) => cur + clamp(tgt - cur, -sp, sp);
    let l = edge(B.x - B.w / 2, B.tx - B.tw / 2), r = edge(B.x + B.w / 2, B.tx + B.tw / 2);
    let t0 = edge(B.y - B.h / 2, B.ty - B.th / 2), b0 = edge(B.y + B.h / 2, B.ty + B.th / 2);
    B.x = (l + r) / 2; B.w = r - l;
    B.y = (t0 + b0) / 2; B.h = b0 - t0;

    if (this.phase === 'intro' || this.phase === 'act') this.tickText(dt);
    else if (this.phase === 'menu') this.tickMenu(dt);
    else if (this.phase === 'attack') this.tickAttack(dt);
    else if (this.phase === 'dead') this.shatter += dt * 0.55;

    /* his eye lights while he is working */
    const want = this.phase === 'attack' ? 1 : 0;
    this.lit = lerp(this.lit, want, 1 - Math.exp(-dt * 5));
    this.render();

    /* Remember this frame's keys for the next one — every frame, whatever
       the phase.  Doing it only inside the attack froze the record at
       whatever was held when the last round ended, so a key still down when
       the next round began looked like it had never been released and the
       first jump of the round simply did not happen. */
    const K = this.keys || {};
    this.pkeys = {
      u: !!(K['ArrowUp'] || K['KeyW']), d: !!(K['ArrowDown'] || K['KeyS']),
      l: !!(K['ArrowLeft'] || K['KeyA']), r: !!(K['ArrowRight'] || K['KeyD'])
    };
    this.press = null;                 /* the latch lasts exactly one frame */
  },

  /* Everything goes up when the window does.  Without this, alt-tabbing
     while a key is down means the keyup never arrives, the key reads as
     held forever, and no jump ever fires again for the rest of the fight. */
  blur() {
    this.keys = {};
    this.pkeys = {};
    this.press = null;
  },

  tickText(dt) {
    const full = this.lines[this.line] || '';
    this.lineChar = Math.min(full.length, this.lineChar + dt * 34);
  },

  tickMenu(dt) {
    if (this.menuMode === 'fight') {
      this.swing += this.swingDir * dt * 1.9;
      if (this.swing > 1) { this.swing = 1; this.swingDir = -1; }
      if (this.swing < -1) { this.swing = -1; this.swingDir = 1; }
    }
  },

  tickAttack(dt) {
    this.runVM(dt);
    /* the board is empty while the screen is out, so nothing to collide */
    /* a resize that carried TLResume releases the script when it lands */
    if (this.tlPaused && this.zoneResume) {
      const B = this.box;
      if (Math.abs(B.w - B.tw) < 0.01 && Math.abs(B.h - B.th) < 0.01 &&
          Math.abs(B.x - B.tx) < 0.01 && Math.abs(B.y - B.ty) < 0.01) {
        this.tlPaused = 0; this.zoneResume = 0;
      }
    } else if (this.tlPaused) this.tlPaused = 0;

    this.slam = Math.max(0, (this.slam || 0) - dt * 2.2);
    this.sansTextT = Math.max(0, (this.sansTextT || 0) - dt);
    this.tickSoul(dt);
    this.tickBullets(dt);
    /* the script has run out and nothing is left on screen */
    if (this.pc >= this.prog.rows.length && !this.bullets.length && !this.black)
      this.endAttack();
  },

  /* ----------------------------------------------------------------------
     The soul.  This is the original's PlayerMovement group, rule for rule.

     Read order matters: the cancel key sets the speed, then RED or BLUE
     runs, then the walls.  In BLUE everything is expressed along the
     gravity vector, because SansSlam can turn gravity sideways or upside
     down and every rule has to keep working when it does.
     -------------------------------------------------------------------- */
  tickSoul(dt) {
    const S = this.soul, K = this.keys || {}, P = this.pkeys || {};
    const M = SV_MOVE;
    const U = !!(K['ArrowUp'] || K['KeyW']),    D = !!(K['ArrowDown'] || K['KeyS']);
    const L = !!(K['ArrowLeft'] || K['KeyA']),  R = !!(K['ArrowRight'] || K['KeyD']);
    const pU = !!P['u'], pD = !!P['d'], pL = !!P['l'], pR = !!P['r'];
    this.moving = U || D || L || R;

    const speed = K['cancel'] ? M.SPEED_SLOW : M.SPEED;

    if (!S.blue) {
      /* RED: straight offsets, opposite keys cancel, and no normalising —
         so a diagonal really does carry you 1.41x as fast. */
      S.vy = 0;
      if (U !== D) S.vy = U ? -speed : speed;
      S.vx = 0;
      if (L !== R) S.vx = L ? -speed : speed;

    } else {
      /* BLUE.  gx,gy is whichever way down happens to be. */
      const a = S.ang * Math.PI / 180;
      const gx = Math.round(Math.cos(a)), gy = Math.round(Math.sin(a));
      const along = () => S.vx * gx + S.vy * gy;
      const setAlong = v => { const d = v - along(); S.vx += gx * d; S.vy += gy * d; };

      /* the jump key is whichever one points away from the floor */
      const jump  = gy > 0 ? U : gy < 0 ? D : gx > 0 ? L : R;
      const pjump = gy > 0 ? pU : gy < 0 ? pD : gx > 0 ? pL : pR;
      const grounded = this.checkSolid(0, 0);

      /* A press is remembered for a moment, so hitting jump a hair before
         you land still jumps instead of being swallowed. */
      const P = this.press || {};
      const tapped = gy > 0 ? P.u : gy < 0 ? P.d : gx > 0 ? P.l : P.r;
      if (tapped || (jump && !pjump)) this.jumpBuf = 0.18;
      this.jumpBuf = Math.max(0, (this.jumpBuf || 0) - dt);
      if (this.jumpBuf > 0 && grounded) {
        this.jumpBuf = 0; this.jumpT = 0;
        /* If the key is already back up — a tap so quick it began and ended
           inside one frame — that is a short hop, not a held one. */
        this.jumpCut = jump ? 0 : 1;
        S.vx -= gx * M.JUMP; S.vy -= gy * M.JUMP;
      }
      this.jumpT = (this.jumpT || 0) + dt;

      /* Letting go clips the rise to 30px/s.  How high you get is how long
         you held, and that whole range matters: bonegap wants a 14-24px hop
         to sit in the gap, which is a 4-to-9 frame press.  The only thing
         M.MINHOLD does is stop a press shorter than three frames clipping at
         once and vanishing — above that the curve is the original's. */
      if (!jump && pjump) this.jumpCut = 1;
      if (this.jumpCut && this.jumpT >= M.MINHOLD) {
        this.jumpCut = 0;
        if (along() < -M.CUTOFF) setAlong(-M.CUTOFF);
      }

      /* gravity, but only in mid-air, and only inside its own speed band */
      if (!this.checkSolid(gx * 0.2, gy * 0.2)) {
        S.ground = 0;
        const g = M.grav(along());
        S.vx += gx * g * dt; S.vy += gy * g * dt;
        const cap = this.maxFall;
        if (along() > cap) setAlong(cap);
      } else {
        /* standing on something: kill the fall and take the landing */
        const hit = along();
        if (hit > 0) {
          if (hit > M.SLAM) {
            this.shake = Math.min(14, hit / 30);
            this.sfx('slam');
            if (this.slamDmg) this.hurt(1, 0);
          }
          setAlong(0);
        }
        S.ground = 1;
      }

      /* and the axis across gravity is yours to steer, on top of whatever
         the desk under you is doing */
      const px = -gy, py = gx;                          /* the across axis */
      let cx = 0, cy = 0;
      const d = this.deskUnder(gx, gy);
      if (d) {
        const dvx = [1, 0, -1, 0][d.dir] * d.speed, dvy = [0, 1, 0, -1][d.dir] * d.speed;
        cx = dvx; cy = dvy;
        /* settle onto the top of it */
        if (gy > 0) S.y = d.y - M.SNAP;
        else if (gy < 0) S.y = d.y + d.h + M.SNAP;
        else if (gx > 0) S.x = d.x - d.w / 2 - M.SNAP;
        else S.x = d.x + d.w / 2 + M.SNAP;
        const along2 = (S.vx - dvx) * gx + (S.vy - dvy) * gy;
        if (along2 > 0) { S.vx -= gx * along2; S.vy -= gy * along2; }
        S.ground = 1;
      }
      let lat = 0;
      if (px) { if (L !== R) lat = L ? -speed : speed; }
      else    { if (U !== D) lat = U ? -speed : speed; }
      const keep = S.vx * gx + S.vy * gy;        /* read it before writing */
      S.vx = cx + Math.abs(px) * lat + gx * keep;
      S.vy = cy + Math.abs(py) * lat + gy * keep;
    }

    S.x += S.vx * dt;
    S.y += S.vy * dt;

    /* the border sits five pixels inside the stated zone, and the heart is
       sixteen across, so thirteen is how close its middle can get */
    const B = this.box, r = M.INSET + M.HALF;
    const l0 = B.x - B.w / 2 + r, r0 = B.x + B.w / 2 - r;
    const t0 = B.y - B.h / 2 + r, b0 = B.y + B.h / 2 - r;
    if (S.x < l0) { S.x = l0; if (S.vx < 0) S.vx = 0; }
    if (S.x > r0) { S.x = r0; if (S.vx > 0) S.vx = 0; }
    if (S.y < t0) { S.y = t0; if (S.vy < 0) S.vy = 0; }
    if (S.y > b0) { S.y = b0; if (S.vy > 0) S.vy = 0; }

  },

  /* Is there floor at this offset?  The walls always count; a desk only
     counts from above, so you can jump up through one. */
  /* Is there FLOOR here?  Only the wall that gravity points into counts —
     the ones beside you are walls, not ground.

     The original tests the heart against all four border pieces at once,
     and Construct counts merely touching as overlapping, so hugging a side
     wall there reads as standing on it: gravity switches off and the jump
     never lands, which is why it climbs forever.  Not reproducing that. */
  checkSolid(ox, oy) {
    const S = this.soul, B = this.box, M = SV_MOVE;
    const x = S.x + (ox || 0), y = S.y + (oy || 0), r = M.INSET + M.HALF;
    const a = S.ang * Math.PI / 180;
    const gx = Math.round(Math.cos(a)), gy = Math.round(Math.sin(a));
    if (gy > 0 && y >= B.y + B.h / 2 - r) return 1;
    if (gy < 0 && y <= B.y - B.h / 2 + r) return 1;
    if (gx > 0 && x >= B.x + B.w / 2 - r) return 1;
    if (gx < 0 && x <= B.x - B.w / 2 + r) return 1;
    return this.deskUnder(gx, gy, ox, oy) ? 1 : 0;
  },

  deskUnder(gx, gy, ox, oy) {
    const S = this.soul, M = SV_MOVE;
    const x = S.x + (ox || 0), y = S.y + (oy || 0);
    for (const d of this.desks) {
      const dvx = [1, 0, -1, 0][d.dir] * d.speed, dvy = [0, 1, 0, -1][d.dir] * d.speed;
      const rel = (S.vx - dvx) * gx + (S.vy - dvy) * gy;
      if (rel < 0) continue;                 /* rising through it: no floor */
      if (gy > 0) {
        if (Math.abs(x - d.x) < d.w / 2 + M.HALF &&
            y + M.HALF >= d.y - 2 && y + M.HALF <= d.y + d.h + 4) return d;
      } else if (gy < 0) {
        if (Math.abs(x - d.x) < d.w / 2 + M.HALF &&
            y - M.HALF <= d.y + d.h + 2 && y - M.HALF >= d.y - 4) return d;
      } else if (gx > 0) {
        if (Math.abs(y - d.y - d.h / 2) < d.h / 2 + M.HALF &&
            x + M.HALF >= d.x - d.w / 2 - 2 && x + M.HALF <= d.x + d.w / 2 + 4) return d;
      } else {
        if (Math.abs(y - d.y - d.h / 2) < d.h / 2 + M.HALF &&
            x - M.HALF <= d.x + d.w / 2 + 2 && x - M.HALF >= d.x - d.w / 2 - 4) return d;
      }
    }
    return null;
  },

  /* Blue only bites when you move, orange only when you do not.

     And a bullet only carries its full DETENTION the first time it gets
     you — after that the original drops it from 6 to 2, so brushing one
     ruler is expensive but not four times as expensive. */
  bite(b, type) {
    if (type === 1 && !this.moving) return;
    if (type === 2 && this.moving) return;
    const before = this.hp;
    this.hurt(1, b && b.kr != null ? b.kr : 6);
    if (b && this.hp < before && b.kr >= 3) b.kr = 2;
  },

  tickBullets(dt) {
    const S = this.soul, B = this.box;
    const TH = SV_BONE;                     /* a ruler is fourteen across */
    for (let i = this.desks.length - 1; i >= 0; i--) {
      const d = this.desks[i];
      const dx = [1, 0, -1, 0][d.dir], dy = [0, 1, 0, -1][d.dir];
      d.x += dx * d.speed * dt; d.y += dy * d.speed * dt;
      if (d.bounce) {
        /* it turns round at the edge of the zone rather than leaving */
        const l = B.x - B.w / 2, r = B.x + B.w / 2;
        const tp = B.y - B.h / 2, bm = B.y + B.h / 2;
        if (d.dir === 0 && d.x + d.w / 2 >= r) { d.dir = 2; d.x = r - d.w / 2; }
        else if (d.dir === 2 && d.x - d.w / 2 <= l) { d.dir = 0; d.x = l + d.w / 2; }
        else if (d.dir === 1 && d.y + d.h >= bm) { d.dir = 3; d.y = bm - d.h; }
        else if (d.dir === 3 && d.y <= tp) { d.dir = 1; d.y = tp; }
        continue;
      }
      /* only gone once it has passed the edge it was heading for */
      if ((d.dir === 0 && d.x - d.w / 2 > SV_W) ||
          (d.dir === 2 && d.x + d.w / 2 < 0) ||
          (d.dir === 1 && d.y > SV_H) ||
          (d.dir === 3 && d.y + d.h < 0)) this.desks.splice(i, 1);
    }
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];

      if (b.k === 'bone') {
        const dx = [1, 0, -1, 0][b.dir], dy = [0, 1, 0, -1][b.dir];
        b.x += dx * b.speed * dt; b.y += dy * b.speed * dt;
        b.life -= dt;
        /* A ruler goes when it passes the edge it is travelling towards —
           and ONLY that edge.  A repeat lays its rulers out behind the first
           one, so most of a wave starts far off the opposite side; culling
           on distance threw those away before they ever arrived, which is
           why a wave of eight pairs turned up as two. */
        const bw = b.vert ? TH : b.len, bh = b.vert ? b.len : TH;
        if (b.life <= 0 ||
            (b.dir === 0 && b.x > SV_W) ||
            (b.dir === 2 && b.x + bw < 0) ||
            (b.dir === 1 && b.y > SV_H) ||
            (b.dir === 3 && b.y + bh < 0)) { this.bullets.splice(i, 1); continue; }
        /* the bone is a box, and what it has to hit is the 4x4 hitbox in
           the middle of the heart — not the 16x16 sprite around it */
        const hw = b.vert ? TH / 2 : b.len / 2;
        const hh = b.vert ? b.len / 2 : TH / 2;
        const cx = b.x + hw, cy = b.y + hh;      /* x,y is the top-left */
        if (Math.abs(S.x - cx) < hw + SV_MOVE.HIT &&
            Math.abs(S.y - cy) < hh + SV_MOVE.HIT) this.bite(b, b.type);

      } else if (b.k === 'stab') {
        b.t += dt;
        const IN = 5, EDGE = 8, sz = b.size;
        const l = B.x - B.w / 2, r = B.x + B.w / 2;
        const tp = B.y - B.h / 2, bt = B.y + B.h / 2;
        if (b.t < b.warn) {
          /* the red footprint: exactly where the ruler will land */
          const th = Math.max(2, sz - 3);
          b.warnRect = b.dir === 0 ? [r - th - EDGE, tp + EDGE, r - EDGE, bt - EDGE]
                     : b.dir === 2 ? [l + EDGE, tp + EDGE, l + th + EDGE, bt - EDGE]
                     : b.dir === 1 ? [l + EDGE, bt - th - EDGE, r - EDGE, bt - EDGE]
                     :               [l + EDGE, tp + EDGE, r - EDGE, tp + th + EDGE];
          continue;
        }
        /* it slides in at ten times its own thickness, holds, slides out */
        if (!b.went) { b.went = 1; this.sfx('stab'); this.shake = 4; }
        const sp = sz * 10;
        if (b.phase === 0) {
          b.off = Math.min(sz, b.off + sp * dt);
          if (b.off >= sz) { b.phase = 1; b.hold_t = 0; }
        } else if (b.phase === 1) {
          b.hold_t += dt;
          if (b.hold_t >= b.hold) b.phase = 2;
        } else {
          b.off -= sp * dt;
          if (b.off <= -8) { this.bullets.splice(i, 1); continue; }
        }
        const o = b.off, ext = 8;               /* it overhangs the border */
        let x0, y0, x1, y1;
        if (b.dir === 0)      { x1 = r + ext; x0 = r - IN - o; y0 = tp; y1 = bt; }
        else if (b.dir === 2) { x0 = l - ext; x1 = l + IN + o; y0 = tp; y1 = bt; }
        else if (b.dir === 1) { y1 = bt + ext; y0 = bt - IN - o; x0 = l; x1 = r; }
        else                  { y0 = tp - ext; y1 = tp + IN + o; x0 = l; x1 = r; }
        b.rect = [x0, y0, x1, y1]; b.warnRect = null;
        const h = SV_MOVE.HIT;
        if (S.x + h > x0 && S.x - h < x1 && S.y + h > y0 && S.y - h < y1) this.bite(b, 0);

      } else if (b.k === 'blaster') {
        /* ENTER -> WAIT -> the jaw -> FIRE -> back out again */
        const EASE = 10, SNAP = 3;
        if (b.st === 0) {
          const to = (cur, tgt) =>
            Math.abs(cur - tgt) >= SNAP ? cur + (tgt - cur) * dt * EASE : tgt;
          b.x = to(b.x, b.tx); b.y = to(b.y, b.ty);
          b.deg = to(b.deg, b.tdeg);
          b.ang = b.deg * Math.PI / 180;
          if (b.x === b.tx && b.y === b.ty && b.deg === b.tdeg) {
            b.st = 1; b.tm = b.wait;
          }
        } else if (b.st === 1) {                 /* holding, aimed at you */
          b.tm -= dt;
          if (b.tm <= 0) { b.st = 2; b.tm = 0.1; this.sfx('charge2'); }
        } else if (b.st === 2) {                 /* the jaw drops */
          b.tm -= dt;
          if (b.tm <= 0) { b.st = 3; b.beamT = 0; this.shake = b.scale * 3; this.sfx('blast'); }
        } else {                                 /* firing, and recoiling */
          b.beamT += dt;
          b.drift += 900 * dt;
          b.x -= Math.cos(b.ang) * b.drift * dt;
          b.y -= Math.sin(b.ang) * b.drift * dt;
        }

        /* the beam snaps open, holds, then shuts */
        const full = 35 * b.scale;
        if (b.beamT < 0) b.bw = 0;
        else if (b.beamT < 0.1333) b.bw = full * (b.beamT / 0.1333);
        else if (b.beamT < 0.1333 + b.beam) b.bw = full;
        else b.bw *= Math.pow(0.8, dt * 30);
        /* only cull once it has actually opened and shut again */
        if (b.beamT > 0.1333 + b.beam && b.bw <= 2) { this.bullets.splice(i, 1); continue; }

        /* Once it starts shutting it stops biting.  The original drops the
           beam's damage to zero the moment it begins to fade, so a beam you
           can see thinning out is already harmless — which is not what a
           shrinking hitbox does on its own. */
        const lethal = b.beamT >= 0 && b.beamT < 0.1333 + b.beam + 0.05;
        if (lethal && b.bw > 4) {
          /* the beam starts at the mouth, not at the middle of the skull */
          const off = 12 * b.px;
          const dx = S.x - (b.x + Math.cos(b.ang) * off);
          const dy = S.y - (b.y + Math.sin(b.ang) * off);
          const cs = Math.cos(-b.ang), sn = Math.sin(-b.ang);
          const lx = dx * cs - dy * sn, ly = dx * sn + dy * cs;
          if (lx > -4 && lx < 900 && Math.abs(ly) < b.bw / 2 + SV_MOVE.HIT)
            this.bite(b, 0);
        }
      }
    }
  }
});

/* =========================================================================
   Drawing.  Everything is laid out at 640x480 and scaled, so the fight is
   the same fight on a phone and on a monitor.
   ========================================================================= */
Object.assign(SansFight, {
  render() {
    if (!this.x) return;
    if (!this.buf) this.resize();
    const x = this.bx;                      /* everything lands in the buffer */
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#000';
    x.fillRect(0, 0, SV_W, SV_H);
    x.save();
    /* the shake moves by whole pixels, never a fraction of one */
    if (this.shake > 0.2) x.translate(Math.round((Math.random() - 0.5) * this.shake),
                                      Math.round((Math.random() - 0.5) * this.shake));

    const ending = this.phase === 'dead' || this.phase === 'win';
    if (this.black && !ending) {
      /* nothing but the strip at the bottom, which is the point */
      this.drawUI(x);
      x.restore();
      this.blit();
      return;
    }
    if (!ending) {
      this.drawBaldi(x);
      this.drawBox(x);
      this.drawBullets(x);
      /* the soul is only loose in the box while he is attacking — in the
         menu it rides the cursor instead */
      if (this.phase === 'attack') this.drawSoulNow(x);
    } else if (this.phase === 'dead') {
      /* nothing but the pieces of you, on black */
      drawShards(x, this.soul.x, this.soul.y, 18, clamp(this.shatter, 0, 1.4));
    }
    this.drawUI(x);
    x.restore();

    this.blit();
  },

  /* up onto the screen, one square at a time */
  blit() {
    const d = this.x;
    d.imageSmoothingEnabled = false;
    d.setTransform(1, 0, 0, 1, 0, 0);
    d.fillStyle = '#000';
    d.fillRect(0, 0, this.cv.width, this.cv.height);
    d.drawImage(this.buf, this.OX, this.OY,
                Math.round(SV_W * this.S), Math.round(SV_H * this.S));

    const f = UI.el('svFlash');
    if (f) f.style.opacity = (this.flash * 0.7).toFixed(3);
  },

  drawBaldi(x) {
    const dodge = this.baldiDodge;
    const px = SV_W / 2 + Math.sin(dodge * 9) * 70 * dodge;
    drawBaldiSans(x, px, 110, 1.7, {
      t: this.t, lit: this.lit, sweat: this.sweat,
      teeth: this.lit > 0.5, tilt: Math.sin(this.t * 0.9) * 0.05,
      shake: 0
    });
  },

  drawBox(x) {
    const B = this.box;
    pxFrame(x, Math.round(B.x - B.w / 2) - 2, Math.round(B.y - B.h / 2) - 2,
            Math.round(B.w) + 4, Math.round(B.h) + 4, SANS_PAL.box, 5);
  },

  drawBullets(x) {
    const B = this.box, TH = SV_BONE;
    x.save();
    x.beginPath();
    x.rect(B.x - B.w / 2 + 2, B.y - B.h / 2 + 2, B.w - 4, B.h - 4);
    x.clip();
    for (const d of this.desks) drawDesk(x, d.x, d.y + d.h / 2, d.w, d.h);
    for (const b of this.bullets) {
      if (b.k === 'bone') {
        const cx = b.x + (b.vert ? TH : b.len) / 2;
        const cy = b.y + (b.vert ? b.len : TH) / 2;
        drawRuler(x, cx, cy, b.len, TH, b.vert ? Math.PI / 2 : 0,
                  b.type === 1 ? 'blue' : b.type === 2 ? 'orange' : 0);
      } else if (b.k === 'stab') {
        if (b.warnRect) {
          const [wx0, wy0, wx1, wy1] = b.warnRect;
          const on = Math.sin(b.t * 34) > 0;
          pxRect(x, wx0, wy0, wx1 - wx0, wy1 - wy0, on ? '#8c1010' : '#3a0808');
          pxFrame(x, wx0, wy0, wx1 - wx0, wy1 - wy0, on ? '#ff4040' : '#a02020', 2);
        } else if (b.rect) {
          const [x0, y0, x1, y1] = b.rect;
          const w = x1 - x0, h = y1 - y0;
          /* one broad ruler lying along the wall it came out of */
          const side = b.dir === 0 || b.dir === 2;
          drawRuler(x, (x0 + x1) / 2, (y0 + y1) / 2,
                    side ? h : w, side ? w : h,
                    side ? Math.PI / 2 : 0, 0);
        }
      }
    }
    x.restore();
    for (const b of this.bullets) {
      if (b.k !== 'blaster') continue;
      /* the jaw stays shut until it is aimed and about to go */
      const open = b.st >= 3 ? 1 : b.st === 2 ? 1 - b.tm / 0.1 : 0;
      const lit = b.st === 0 ? 0 : 1;
      /* the sprite faces down, so turning it by -90 points it along `ang` */
      const off = 12 * b.px;
      if (b.bw > 1)
        drawBeam(x, b.x + Math.cos(b.ang) * off, b.y + Math.sin(b.ang) * off,
                 b.ang, 900, b.bw, b.beamT, b.beam);
      drawBlaster(x, b.x, b.y, b.px / 3, b.ang - Math.PI / 2, open, lit);
    }
  },

  drawSoulNow(x) {
    const S = this.soul;
    const blink = this.iframe > 0 ? (Math.sin(this.iframe * 40) > 0 ? 0.25 : 1) : 1;
    drawSoul(x, S.x, S.y, 17, S.blue, blink);
  },

  /* ------------------------------------------------------------- the UI
     Every letter here is the bitmap font: five across, seven down, painted
     as squares.  Scale 2 is the body text, 3 is the headings. */
  drawUI(x) {
    const bottom = 411;
    x.save();

    /* dialogue, when he is talking */
    if (this.phase === 'intro' || this.phase === 'act') {
      const B = this.box;
      const first = Math.max(0, this.line - 2);
      for (let i = first; i <= this.line && i < this.lines.length; i++) {
        const ln = i === this.line
          ? this.lines[i].slice(0, Math.floor(this.lineChar)) : this.lines[i];
        pxText(x, ln, B.x - B.w / 2 + 32, B.y - B.h / 2 + 24 + (i - first) * 24, 2, '#fff');
      }
      pxText(x, 'Z', B.x + B.w / 2 - 20, B.y + B.h / 2 - 20, 2, '#7a7a7a');
    }

    /* the health strip */
    pxText(x, 'YOU', 150, bottom, 2, '#fff');
    pxText(x, 'LV 19', 205, bottom, 2, '#fff');
    pxText(x, 'HP', 285, bottom, 2, '#fff');

    const bw = 90, bx = 315, bh = 16, by0 = bottom - 1;
    const hpK = clamp(this.hp / SV_MAXHP, 0, 1);
    const krK = clamp((this.hp + this.kr) / SV_MAXHP, 0, 1);
    pxRect(x, bx, by0, bw, bh, '#7a0000');
    pxRect(x, bx, by0, bw * krK, bh, SANS_PAL.kr);      /* DETENTION */
    pxRect(x, bx, by0, bw * hpK, bh, SANS_PAL.hp);
    pxText(x, Math.ceil(this.hp) + ' / ' + SV_MAXHP, bx + bw + 10, bottom, 2, '#fff');
    if (this.kr > 0.2) pxText(x, 'DT', bx + bw + 108, bottom, 2, SANS_PAL.kr);

    /* the four buttons */
    if (this.phase === 'menu' || this.phase === 'attack' || this.phase === 'act') {
      const names = ['FIGHT', 'ACT', 'ITEM', 'MERCY'];
      const w = 110, gap = 12;
      const total = names.length * w + (names.length - 1) * gap;
      let px = SV_W / 2 - total / 2;
      for (let i = 0; i < names.length; i++) {
        const on = this.phase === 'menu' && this.menuMode === 'top' && i === this.menuSel;
        const col = on ? SANS_PAL.hp : '#ff8c1a';
        pxFrame(x, px, 436, w, 26, col, 3);
        pxText(x, names[i], px + w / 2 + 8, 442, 2, col, { align: 'center' });
        if (on) drawSoul(x, px + 16, 449, 16, 0, 1);
        px += w + gap;
      }
    }

    /* the swing bar */
    if (this.phase === 'menu' && this.menuMode === 'fight') {
      const bw2 = 300, bx2 = SV_W / 2 - bw2 / 2, by = 320;
      pxFrame(x, bx2, by - 26, bw2, 52, '#fff', 3);
      pxRect(x, bx2 + 3, by - 23, bw2 - 6, 46, '#3a2a10');
      pxRect(x, SV_W / 2 - 22, by - 23, 44, 46, '#5a4418');   /* the sweet spot */
      const px2 = SV_W / 2 + this.swing * (bw2 / 2 - 12);
      drawRuler(x, px2, by, 44, 12, Math.PI / 2, 0);
      pxText(x, 'Z TO SWING', SV_W / 2, by + 40, 2, '#fff', { align: 'center' });
    }

    if (this.phase === 'menu' && (this.menuMode === 'act' || this.menuMode === 'item')) {
      if (this.menuMode === 'act') {
        pxText(x, '* Check', 100, 285, 2, '#fff');
        drawSoul(x, 85, 291, 16, 0, 1);
      } else if (!this.bag.length) {
        pxText(x, '* Your bag is empty.', 85, 285, 2, '#8a8a8a');
      } else {
        for (let i = 0; i < this.bag.length; i++) {
          const it = this.bag[i], yy = 278 + i * 26, on = i === this.subSel;
          pxText(x, '* ' + it.name, 100, yy, 2, on ? '#fff' : '#9a9a9a');
          pxText(x, !isFinite(it.n) ? '∞' : 'x' + it.n, 330, yy,
                 2, on ? '#fff' : '#9a9a9a');
          pxText(x, 'heals ' + it.heal, 420, yy, 2, on ? '#ffe14a' : '#6f6f6f');
          if (on) drawSoul(x, 85, yy + 7, 16, 0, 1);
        }
      }
      pxText(x, this.menuMode === 'item' && this.bag.length > 1
        ? 'ARROWS choose   Z use   X back'
        : 'Z to use   X to go back', 100, 366, 2, '#8a8a8a');
    }

    pxText(x, this.phase === 'attack'
      ? 'ARROWS move   X walk slowly   ESC quit'
      : 'ARROWS move   Z confirm   X back   ESC quit', 12, SV_H - 14, 1, '#6a6a6a');

    /* the ends */
    if (this.phase === 'dead') {
      x.globalAlpha = clamp(this.shatter - 0.6, 0, 1);
      pxText(x, 'GAME OVER', SV_W / 2, 132, 5, '#fff', { align: 'center' });
      pxText(x, "don't lose hope. try again.", SV_W / 2, 190, 2, '#fff', { align: 'center' });
      pxText(x, 'Z to try again    ESC to leave', SV_W / 2, 228, 2, SANS_PAL.hp, { align: 'center' });
      x.globalAlpha = 1;
    }
    if (this.phase === 'win') {
      pxText(x, 'YOU WIN', SV_W / 2, 132, 5, '#fff', { align: 'center' });
      pxText(x, '"...welp. i\'m going to grandma\'s."', SV_W / 2, 190, 2, '#fff', { align: 'center' });
      pxText(x, 'HP LEFT  ' + Math.ceil(this.hp) + ' / ' + SV_MAXHP, SV_W / 2, 222, 2, '#fff', { align: 'center' });
      pxText(x, 'Z to leave', SV_W / 2, 260, 2, SANS_PAL.hp, { align: 'center' });
    }
    x.restore();
  }
});


/* =========================================================================
   Part 5t — SCHOOLOVANIA
   The fight music.  Not the original — an original, built to the same
   shape: D minor, 120 BPM, a walking bass that never lets up, a lead that
   climbs the same way, and a middle section that opens right out.

   Runs on the Tone.js rack the FNF mode set up, with the same lookahead
   scheduler, so the attack timeline and the music share one clock.
   ========================================================================= */

const SV_BPM = 120;

/* the bass figure the whole thing is built on — it changes root, not shape */
const SV_BASS = {
  a: 'D2 D2 .  D3 .  D2 .  A2 .  .  Bb2 . .  C3 .  . ',
  b: 'C2 C2 .  C3 .  C2 .  G2 .  .  A2 .  .  Bb2 . . ',
  c: 'Bb1 Bb1 . Bb2 . Bb1 . F2 .  .  G2 .  .  A2 .  . ',
  d: 'A1 A1 .  A2 .  A1 .  E2 .  .  F2 .  .  G2 .  . ',
  e: 'D2 .  .  D2 .  .  D2 .  A2 .  .  A2 .  .  .  . ',
  f: 'F2 F2 .  F3 .  F2 .  C3 .  .  D3 .  .  E3 .  . '
};

/* one entry per four-bar phrase */
const SV_SECTIONS = [
  /* ---- the opening riff, everyone knows the shape of it ---- */
  { n: 'intro', bars: 4, groove: 'lo', bass: ['a', 'a', 'b', 'c'],
    lead: ['D5 D5 .  D6 .  A5 .  .  Ab5 . G5 .  F5 .  D5 F5',
           'G5 .  .  .  .  .  .  .  .  .  .  .  .  .  .  . ',
           'C5 C5 .  C6 .  G5 .  .  Gb5 . F5 .  Eb5 . C5 Eb5',
           'F5 .  .  .  .  .  .  .  .  .  .  .  .  .  .  . '] },

  { n: 'riff2', bars: 4, groove: 'mid', bass: ['a', 'a', 'b', 'c'], stab: 1,
    lead: ['D5 D5 .  D6 .  A5 .  .  Ab5 . G5 .  F5 .  D5 F5',
           'G5 .  F5 .  D5 .  F5 .  G5 .  A5 .  Bb5 . A5 . ',
           'C5 C5 .  C6 .  G5 .  .  Gb5 . F5 .  Eb5 . C5 Eb5',
           'F5 .  Eb5 . C5 .  Eb5 . F5 .  G5 .  A5 .  C6 . '] },

  /* ---- the climb ---- */
  { n: 'climb', bars: 4, groove: 'drive', bass: ['d', 'd', 'c', 'b'], stab: 1, arp: 1,
    lead: ['A5 .  A5 .  Bb5 . A5 .  G5 .  A5 .  Bb5 . C6 . ',
           'D6 .  .  .  C6 .  Bb5 . A5 .  G5 .  F5 .  E5 . ',
           'F5 .  F5 .  G5 .  F5 .  E5 .  F5 .  G5 .  A5 . ',
           'Bb5 . .  .  A5 .  G5 .  F5 .  E5 .  D5 .  C5 . '] },

  /* ---- the big one ---- */
  { n: 'hookA', bars: 4, groove: 'boss', bass: ['a', 'a', 'b', 'c'], stab: 1, arp: 1, crash: 1,
    lead: ['D6 .  .  A5 .  .  D6 .  E6 .  F6 .  E6 .  D6 . ',
           'C6 .  .  G5 .  .  C6 .  D6 .  E6 .  D6 .  C6 . ',
           'Bb5 . .  F5 .  .  Bb5 . C6 .  D6 .  C6 .  Bb5 . ',
           'A5 .  Bb5 . C6 .  D6 .  E6 .  F6 .  G6 .  A6 . '] },

  { n: 'hookB', bars: 4, groove: 'boss', bass: ['f', 'f', 'd', 'a'], stab: 1, arp: 1,
    lead: ['F6 .  E6 .  D6 .  C6 .  Bb5 . A5 .  G5 .  F5 . ',
           'A5 .  .  .  D6 .  .  .  F6 .  .  .  A6 .  .  . ',
           'G6 .  F6 .  E6 .  D6 .  C6 .  Bb5 . A5 .  G5 . ',
           'F5 .  A5 .  D6 .  F6 .  A6 .  .  .  A6 A6 A6 A6'] },

  /* ---- it opens out: half time, wide chords ---- */
  { n: 'wide', bars: 4, groove: 'half', bass: ['e', 'e', 'e', 'e'], pad: 1, stab: 1,
    lead: ['D6 .  .  .  .  .  .  .  C6 .  .  .  .  .  .  . ',
           'Bb5 . .  .  .  .  .  .  A5 .  .  .  .  .  .  . ',
           'F5 .  .  .  A5 .  .  .  D6 .  .  .  .  .  .  . ',
           'E6 .  .  .  .  .  .  .  .  .  .  .  .  .  .  . '] },

  /* ---- and comes back twice as mean ---- */
  { n: 'rage', bars: 4, groove: 'boss', bass: ['a', 'b', 'c', 'd'], stab: 1, arp: 1, crash: 1,
    lead: ['D6 D6 D6 .  A5 .  D6 .  F6 .  E6 .  D6 .  A5 . ',
           'C6 C6 C6 .  G5 .  C6 .  E6 .  D6 .  C6 .  G5 . ',
           'Bb5 Bb5 Bb5 . F5 . Bb5 . D6 .  C6 .  Bb5 . F5 . ',
           'A5 A5 A5 .  E5 .  A5 .  C6 .  D6 .  E6 .  G6 . '] },

  { n: 'finale', bars: 4, groove: 'boss', bass: ['a', 'a', 'c', 'd'], stab: 1, arp: 1, crash: 1,
    lead: ['D6 .  F6 .  A6 .  D7 .  A6 .  F6 .  D6 .  A5 . ',
           'D6 D6 .  D7 .  A6 .  .  Ab6 . G6 .  F6 .  D6 F6',
           'Bb5 . D6 .  F6 .  Bb6 . A6 .  G6 .  F6 .  D6 . ',
           'A5 .  C6 .  E6 .  A6 .  G6 .  E6 .  C6 .  A5 . '] },

  /* ---- the last stand ---- */
  { n: 'last', bars: 4, groove: 'boss', bass: ['a', 'b', 'c', 'd'], stab: 1, arp: 1, crash: 1,
    lead: ['D6 .  .  A5 .  .  D6 .  E6 .  F6 .  E6 .  D6 . ',
           'C6 .  .  G5 .  .  C6 .  D6 .  E6 .  D6 .  C6 . ',
           'Bb5 . .  F5 .  .  Bb5 . C6 .  D6 .  C6 .  Bb5 . ',
           'A5 .  .  .  .  .  .  .  A5 A5 A5 A5 A5 A5 A5 A5'] }
];

const SV_GROOVE = {
  lo:    { k: 'X.......X.......', s: '................', h: '..h...h...h...h.' },
  mid:   { k: 'X.....X...X.....', s: '....S.......S...', h: 'h.h.h.h.h.h.h.h.' },
  drive: { k: 'X..X..X.X..X..X.', s: '....S.......S...', h: 'hhhhhhhhhhhhhhhh' },
  boss:  { k: 'X.XX..X.X.XX..X.', s: '....S...S...S..S', h: 'hhhhhhhhhhhhhhhh' },
  half:  { k: 'X.......X.......', s: '........S.......', h: '....h.......h...' }
};

const SV_CHORD = {
  a: [50, 53, 57], b: [48, 52, 55], c: [46, 50, 53],
  d: [45, 48, 52], e: [50, 57, 62], f: [53, 57, 60]
};

const SansSong = {
  on: false,

  build() {
    /* flatten the sections into a bar-by-bar plan, the same shape the FNF
       scheduler reads, so one clock drives music and attacks alike */
    const beat = 60 / SV_BPM, step = beat / 4;
    const plan = [];
    for (const S of SV_SECTIONS) {
      for (let b = 0; b < S.bars; b++) {
        plan.push({ S: S, barIn: b,
                    bass: bar16(SV_BASS[S.bass[b % S.bass.length]]),
                    lead: bar16(S.lead[b % S.lead.length]),
                    ch: SV_CHORD[S.bass[b % S.bass.length]] || SV_CHORD.a });
      }
    }
    this.plan = plan;
    this.beat = beat; this.st = step;
    this.bars = plan.length;
    this.dur = plan.length * 4 * beat;
    return this;
  },

  start(t0) {
    if (this.on) return;
    if (!this.plan) this.build();
    Audio1.init(); Audio1.resume();
    FNFAudio.start(t0 || Audio1.ctx.currentTime);
    FNFAudio.rack = (typeof FNFTone !== 'undefined' && FNFTone.init()) ? FNFTone : FNFAudio;
    this.on = true;
    this.step = 0;
    this.t0 = t0 || (Audio1.ctx.currentTime + 0.12);
    this.next = this.t0;
    this.timer = setInterval(() => this.pump(), 25);
  },
  stop() {
    if (!this.on) return;
    this.on = false;
    clearInterval(this.timer); this.timer = null;
    FNFAudio.stop();
  },
  time() {
    if (!this.on || !Audio1.ctx) return 0;
    return Audio1.ctx.currentTime - this.t0;
  },
  pump() {
    if (!this.on) return;
    const ctx = Audio1.ctx, total = this.bars * 16;
    while (this.next < ctx.currentTime - 0.012) { this.next += this.st; this.step++; }
    while (this.next < ctx.currentTime + 0.20) {
      this.hit(this.step % total, this.next);
      this.next += this.st; this.step++;
    }
  },

  hit(gs, t) {
    const P = this.plan[Math.floor(gs / 16)];
    if (!P) return;
    const A = FNFAudio.rack || FNFAudio;
    const S = P.S, s = gs % 16;
    const G = SV_GROOVE[S.groove] || SV_GROOVE.mid;
    const big = S.groove === 'boss' || S.groove === 'drive';

    if (G.k[s] !== '.') A.kick(t, 0.55);
    if (G.s[s] !== '.') { A.snare(t, 0.30); A.clap(t, 0.14); }
    if (G.h[s] !== '.') A.hat(t, 0.070, false);
    if (s === 14 && big) A.hat(t, 0.10, true);
    if (s === 0 && S.crash && P.barIn === 0) A.crash(t, 0.16);

    /* the bass line is the engine of the whole thing */
    const bn = P.bass[s];
    if (bn && bn !== '.' && bn !== '-') {
      const m = midi(bn);
      if (m != null) {
        let len = 1;
        for (let k = s + 1; k < 16 && (P.bass[k] === '.' || P.bass[k] === '-'); k++) len++;
        A.bass(t, hz(m), this.st * len * 0.92, 0.30);
      }
    }
    if (S.stab && (s === 2 || s === 6 || s === 10 || s === 14))
      A.stab(t, P.ch.map(m => m + 24), this.st * 2.1, 0.062);
    if (S.pad && s === 0 && A.pad) A.pad(t, P.ch.map(m => m + 12), this.beat * 4 * 0.98, 0.055);
    if (S.arp) A.arp(t, hz(P.ch[s % 3] + 36), this.st * 0.85, 0.026);

    const ln = P.lead[s];
    if (ln && ln !== '.' && ln !== '-') {
      const m = midi(ln);
      if (m != null) {
        let len = 1;
        for (let k = s + 1; k < 16 && (P.lead[k] === '.' || P.lead[k] === '-'); k++) len++;
        A.lead(t, hz(m), this.st * len * 0.94, 0.115);
        if (A.bell && big && (s === 0 || s === 8)) A.bell(t, hz(m + 12), this.st * len, 0.038);
      }
    }
  }
};


/* =========================================================================
   Part 5u — the attack scripts, exactly as they are in the original
   Twenty-four programs decoded straight out of the build that was sent
   in.  Rows are separated by ';' and fields by '|'; the first field of
   every row is how long to wait before running it.
   ========================================================================= */

const SANS_SCRIPTS = {"bluebone":"0|CombatZoneResize|133|251|508|391|TLResume;0|HeartTeleport|320|376;0|HeartMode|1;0|TLPause;0.2|BoneV|503|286|100|2|300|1;0.23333|BoneV|503|366|20|2|300|0;0.5|BoneV|503|286|100|2|300|1;0.23333|BoneV|503|366|20|2|300|0;0.5|BoneV|503|286|100|2|300|1;0.23333|BoneV|503|366|20|2|300|0;0.93333|BoneV|128|366|20|0|300|0;0.4|BoneV|128|286|100|0|300|1;0.33333|BoneV|128|366|20|0|300|0;0.4|BoneV|128|286|100|0|300|1;0.33333|BoneV|128|366|20|0|300|0;0.4|BoneV|128|286|100|0|300|1;1.66666|EndAttack","bonegap1":"0|CombatZoneResize|133|251|508|391|TLResume;0|HeartTeleport|320|376;0|HeartMode|1;0|TLPause;0.2|BoneVRepeat|128|257|95|0|180|8|120;0|BoneVRepeat|128|366|20|0|180|8|120;0|BoneVRepeat|503|257|95|2|180|8|120;0|BoneVRepeat|503|366|20|2|180|8|120;6.4|EndAttack","bonegap1fast":"0|CombatZoneResize|133|251|508|391|TLResume;0|HeartTeleport|320|376;0|HeartMode|1;0|TLPause;0.4|BoneVRepeat|128|257|95|0|210|8|133;0|BoneVRepeat|128|366|20|0|210|8|133;0|BoneVRepeat|503|257|95|2|210|8|133;0|BoneVRepeat|503|366|20|2|210|8|133;6|EndAttack","bonegap2":"0|CombatZoneResize|133|251|508|391|TLResume;0|HeartTeleport|320|376;0|HeartMode|1;0|TLPause;0|SET|Total|0;0|:Begin;0|JMPNL|End|$Total|150;0|RND|Choice|4;0|MUL|Jump|$Choice|3;0|ADD|Jump|$Jump|1;0|JMPREL|$Jump;0|SET|HeightB|20;0|ADD|Total|$Total|9;0|JMPREL|9;0|SET|HeightB|30;0|ADD|Total|$Total|11;0|JMPREL|6;0|SET|HeightB|40;0|ADD|Total|$Total|19;0|JMPREL|3;0|SET|HeightB|60;0|ADD|Total|$Total|25;0|RND|RndSpeed|3;0|SUB|RndSpeed|$RndSpeed|1;0|MUL|RndSpeed|$RndSpeed|2;0|JMPNE|SkipZeroSpeed|$HeightB|40;0|SET|RndSpeed|0;0|:SkipZeroSpeed;0|SUB|HeightT|111|$HeightB;0|SUB|YB|386|$HeightB;0|ADD|X|$Total|32;0|JMPNE|BoneL|$HeightB|60;0|SET|RndSpeed|-1;0|:BoneL;0|ADD|SpeedL|8|$RndSpeed;0|MUL|XL|$X|$SpeedL;0|SUB|XL|320|$XL;0|MUL|SpeedL|$SpeedL|30;0|JMPE|BoneR|$HeightB|60;0|MUL|RndSpeed|$RndSpeed|-1;0|:BoneR;0|ADD|SpeedR|8|$RndSpeed;0|MUL|XR|$X|$SpeedR;0|ADD|XR|320|$XR;0|MUL|SpeedR|$SpeedR|30;0|BoneV|$XL|257|$HeightT|0|$SpeedL;0|BoneV|$XL|$YB|$HeightB|0|$SpeedL;0|BoneV|$XR|257|$HeightT|2|$SpeedR;0|BoneV|$XR|$YB|$HeightB|2|$SpeedR;0|MUL|Jump|$Choice|2;0|ADD|Jump|$Jump|1;0|JMPREL|$Jump;0|ADD|Total|$Total|15;0|JMPREL|6;0|ADD|Total|$Total|17;0|JMPREL|4;0|ADD|Total|$Total|19;0|JMPREL|2;0|ADD|Total|$Total|25;0|JMPABS|Begin;0|:End;7|EndAttack","boneslideh":"0|CombatZoneResize|133|251|508|391|TLResume;0|HeartTeleport|320|376;0|HeartMode|1;0|TLPause;0.5|BoneVRepeat|128|366|20|0|120|8|76;0|BoneVRepeat|513|257|107|2|120|8|76;7.2|EndAttack","boneslidev":"0|CombatZoneResize|241|226|406|391|TLResume;0|HeartTeleport|320|304;0|HeartMode|0;0|TLPause;0.2|BoneHRepeat|130|-10|200|1|300|7|183;0|BoneHRepeat|330|650|200|3|300|7|183;5.76666|EndAttack","bonestab1":"0|CombatZoneResize|241|226|406|391|TLResume;0|HeartTeleport|320|304;0|HeartMode|0;0|TLPause;0|SET|Loop|9;0|JMPZ|26|$Loop;0|SUB|Loop|$Loop|1;0|RND|Direction|4;0|ADD|Jump|$Direction|1;0|JMPREL|$Jump;0|JMPREL|4;0|JMPREL|5;0|JMPREL|6;0|JMPREL|7;0|SansBody|HandRight;0|JMPREL|7;0|SansBody|HandDown;0|JMPREL|5;0|SansBody|HandLeft;0|JMPREL|3;0|SansBody|HandUp;0|JMPREL|1;0.26666|SansSlam|$Direction;0.2|BoneStab|$Direction|25|0.4|0.33333;0.6|JMPABS|6;0|EndAttack","bonestab2":"0|CombatZoneResize|241|226|406|391|TLResume;0|HeartTeleport|320|304;0|HeartMode|0;0|TLPause;0|SET|Loop|9;0|JMPZ|26|$Loop;0|SUB|Loop|$Loop|1;0|RND|Direction|4;0|ADD|Jump|$Direction|1;0|JMPREL|$Jump;0|JMPREL|4;0|JMPREL|5;0|JMPREL|6;0|JMPREL|7;0|SansBody|HandRight;0|JMPREL|7;0|SansBody|HandDown;0|JMPREL|5;0|SansBody|HandLeft;0|JMPREL|3;0|SansBody|HandUp;0|JMPREL|1;0.26666|SansSlam|$Direction;0.2|BoneStab|$Direction|25|0.3|0.2;0.43333|JMPABS|6;0|EndAttack","bonestab3":"0|CombatZoneResize|241|226|406|391|TLResume;0|HeartTeleport|320|304;0|HeartMode|0;0|TLPause;0|SET|Loop|9;0|JMPZ|26|$Loop;0|SUB|Loop|$Loop|1;0|RND|Direction|4;0|ADD|Jump|$Direction|1;0|JMPREL|$Jump;0|JMPREL|4;0|JMPREL|5;0|JMPREL|6;0|JMPREL|7;0|SansBody|HandRight;0|JMPREL|7;0|SansBody|HandDown;0|JMPREL|5;0|SansBody|HandLeft;0|JMPREL|3;0|SansBody|HandUp;0|JMPREL|1;0.26666|SansSlam|$Direction;0.2|BoneStab|$Direction|29|0.4|0;0.23333|JMPABS|6;0|EndAttack","final":"0|CombatZoneResize|241|226|406|391|TLResume;0|HeartTeleport|320|304;0|HeartMode|0;0|TLPause;0|SansSweat|0;0|SET|I|0;0.3|RND|Direction|4;0|ADD|Jump|$Direction|1;0|JMPREL|$Jump;0|JMPREL|4;0|JMPREL|5;0|JMPREL|6;0|JMPREL|7;0|SansBody|HandRight;0|JMPREL|7;0|SansBody|HandDown;0|JMPREL|5;0|SansBody|HandLeft;0|JMPREL|3;0|SansBody|HandUp;0|JMPREL|1;0.26666|SansSlam|$Direction;0.2|BoneStab|$Direction|29|0.4|0;0|ADD|I|$I|1;0|JMPL|7|$I|4;0|BoneHRepeat|130|-10|200|1|300|3|183;0|BoneHRepeat|330|650|200|3|300|3|183;0.5|HeartMode|0;2|SansBody|HandLeft;0.2|SansSlam|2;0.3|SansBody|HandRight;0.2|HeartMaxFallSpeed|450;0|SansSlam|0;0|CombatZoneResizeInstant|241|226|449|391;0|CombatZoneSpeed|900;0|CombatZoneResize|241|226|650|391;0.33333|HeartMaxFallSpeed|-300;0|SansAnimation|Idle;0|SansRepeat;0|CombatZoneResize|-10|226|650|391;0.3|CombatZoneSpeed|30;0|CombatZoneResize|-10|264|650|369;0.9|GetHeartPos|HeartX|HeartY;0|HeartTeleport|40|$HeartY;0|HeartMaxFallSpeed|0;0|SansSlam|0;0|DIV|Deg|180|$pi;0|SET|I|0;0|DIV|Ang|$I|2;0|MUL|Ang|$Ang|$Deg;0|SIN|Sine|$Ang;0|MUL|Sine|$Sine|25;0|FLOOR|Sine|$Sine;0|MUL|X|$I|60;0|ADD|X|$X|634;0|SET|Y|270;0|ADD|H|30|$Sine;0|BoneV|$X|$Y|$H|2|900;0|ADD|Y|$Y|$H;0|ADD|Y|$Y|34;0|SUB|H|364|$Y;0|BoneV|$X|$Y|$H|2|900;0|ADD|I|$I|1;0|JMPL|49|$I|44;0|ADD|X|$X|360;0|BoneVRepeat|$X|270|50|2|900|3|15;0|ADD|X|$X|330;0|BoneVRepeat|$X|314|50|2|900|3|15;0|ADD|X|$X|300;0|BoneVRepeat|$X|270|50|2|900|3|15;0|ADD|X|$X|300;0|BoneVRepeat|$X|314|50|2|900|3|15;0|ADD|X|$X|270;0|BoneVRepeat|$X|270|50|2|900|3|15;0|ADD|X|$X|270;0|BoneVRepeat|$X|314|50|2|900|3|15;0|ADD|X|$X|240;0|BoneVRepeat|$X|270|50|2|900|3|15;0|ADD|X|$X|330;0|BoneVRepeat|$X|314|50|2|900|3|15;0|ADD|X|$X|270;0|BoneVRepeat|$X|270|50|2|900|3|15;0|ADD|X|$X|390;0|SET|I|0;0|MUL|X2|$I|30;0|ADD|X2|$X2|$X;0|ADD|H|10|$I;0|BoneV|$X2|270|$H|2|900;0|SUB|Y|365|$H;0|BoneV|$X2|$Y|$H|2|900;0|ADD|I|$I|1;0|JMPL|85|$I|24;0|SET|I|0;8|HeartMaxFallSpeed|330;0|SansSlam|0;0|CombatZoneSpeed|540;0|CombatZoneResize|-10|264|410|369;0.9|SansEndRepeat;0|SansHead|Default;0|SansTorso|Default;0|SansBody|HandLeft;0.2|BoneStab|0|50|0.4|1;0.9|BlackScreen|1;0|Sound|Flash;0.4|BlackScreen|0;0|Sound|Flash;0|CombatZoneResizeInstant|239|226|404|391;0|HeartTeleport|320|376;0|HeartMode|1;0|SansAnimation|HeadBob;0.03333|BoneStab|1|48|0.6|1;0|BoneStab|3|48|0.6|1;0.9|BlackScreen|1;0|Sound|Flash;0.1|BlackScreen|0;0|Sound|Flash;0|HeartTeleport|262|240;0|SansSlam|3;0.03333|BoneStab|2|48|0.6|1;0|BoneStab|3|48|0.6|1;0.9|BlackScreen|1;0|Sound|Flash;0.1|BlackScreen|0;0|Sound|Flash;0|HeartTeleport|391|376;0|SansSlam|0;0.03333|BoneStab|0|48|0.6|1;0|BoneStab|1|48|0.6|1;0.9|BlackScreen|1;0|Sound|Flash;0.1|BlackScreen|0;0|Sound|Flash;0|HeartTeleport|262|240;0|SansSlam|2;0|SansX|320;0.03333|BoneStab|2|48|0.6|1;0.7|HeartMode|0;0|SET|gt|0;0|SET|gin|1;0|MUL|Ang|$gt|-10;0|COS|X|$Ang;0|SIN|Y|$Ang;0|MUL|EndX|$X|150;0|MUL|EndY|$Y|150;0|MUL|X|$EndX|3;0|MUL|Y|$EndY|3;0|ADD|X|$X|320;0|ADD|Y|$Y|306;0|ADD|EndX|$EndX|320;0|ADD|EndY|$EndY|306;0|ADD|Ang|$Ang|180;0|GasterBlaster|0|$X|$Y|$EndX|$EndY|$Ang|0.5|0;0|ADD|gt|$gt|$gin;0|JMPNL|156|$gin|1.7;0|ADD|gin|$gin|0.015;0.06666|JMPL|140|$gt|190;1|SansHead|BlueEye;0|HeartMaxFallSpeed|750;0|SansBody|HandRight;0|SansSlamDamage|1;0|SET|I|0;0|SET|Direction|0;0|SET|LastDir|2;0|SET|Wait1|0.13333;0|SET|Wait2|0.13333;0|JMPNE|168|$Direction|$LastDir;0|SUB|Direction|$Direction|2;0|JMPNL|170|$Direction|0;0|ADD|Direction|$Direction|4;0|JMPL|172|$Direction|4;0|SUB|Direction|$Direction|4;0|MUL|Jump|$Direction|2;0|ADD|Jump|$Jump|1;0|JMPREL|$Jump;0|SansBody|HandRight;0|JMPREL|6;0|SansBody|HandDown;0|JMPREL|4;0|SansBody|HandLeft;0|JMPREL|2;0|SansBody|HandUp;$Wait1|SansSlam|$Direction;$Wait2|SET|LastDir|$Direction;0|MOD|Odd|$I|2;0|JMPZ|187|$Odd;0|RND|Direction|4;0|JMPNE|191|$I|21;0|HeartMaxFallSpeed|480;0|SET|Wait1|0.2;0|SET|Wait2|0.2;0|JMPNE|194|$I|25;0|SansHead|Default;0|SansSweat|1;0|JMPNE|200|$I|33;0|SansHead|Tired1;0|SansSweat|2;0|HeartMaxFallSpeed|330;0|SET|Wait1|0.5;0|SET|Wait2|1.1;0|JMPNE|203|$I|33;0|JMPE|186|$Direction|1;0|JMPE|186|$Direction|$LastDir;0|JMPNE|206|$I|35;0|HeartMaxFallSpeed|240;0|SET|Direction|3;0|JMPNE|210|$I|36;0|SansHead|Tired2;0|SansSweat|3;0|HeartMaxFallSpeed|60;0|ADD|I|$I|1;0|JMPL|166|$I|38;1.5|SansAnimation|Tired;2.4|EndAttack","intro":"0|SansAnimation;0|SansHead|ClosedEyes;0|SansText|ready?;0|BlackScreen|1;0|Sound|Flash;0.06666|BlackScreen|0;0|Sound|Flash;0|CombatZoneResizeInstant|239|226|404|391;0|HeartTeleport|320|304;0|HeartMode|0;0|SansBody|HandDown;0|SansHead|BlueEye;0|Sound|GasterBlaster|1.4;0.26666|SansSlam|1;0.5|SansBody|HandUp;0|SansHead|NoEyes;0|BoneStab|1|54|0.16666|1;0.7|HeartMode|0;0|SansBody|HandRight;0|Sound|Ding;0.4|Sound|GasterBlaster|1.4;0.4|SineBones|20|-24|360|25;1.1|SansAnimation;0|GasterBlaster|1|0|0|189|246|0|0.333|0.26666;0|GasterBlaster|1|0|0|259|166|90|0.333|0.26666;0|GasterBlaster|1|640|480|449|366|180|0.333|0.26666;0|GasterBlaster|1|640|480|379|446|270|0.333|0.26666;0.9|GasterBlaster|1|0|0|189|176|45|0.333|0.26666;0|GasterBlaster|1|640|0|449|176|135|0.333|0.26666;0|GasterBlaster|1|640|480|449|436|225|0.333|0.26666;0|GasterBlaster|1|0|480|189|436|315|0.333|0.26666;0.9|GasterBlaster|1|0|0|189|246|0|0.333|0.26666;0|GasterBlaster|1|0|0|259|166|90|0.333|0.26666;0|GasterBlaster|1|640|480|449|366|180|0.333|0.26666;0|GasterBlaster|1|640|480|379|446|270|0.333|0.26666;0.7|GasterBlaster|2|0|240|139|306|0|0.666|0.5;0|GasterBlaster|2|640|240|499|306|180|0.666|0.5;3|SansHead|Default;0|SansText|here we go.;0|EndAttack","multi1":"0|CombatZoneResize|133|251|508|391|TLResume;0|HeartTeleport|320|304;0|HeartMode|1;0|TLPause;0|SET|Loop|5;0|:RndAttack;0|BlackScreen|1;0|Sound|Flash;0.4|BlackScreen|0;0|Sound|Flash;0|JMPZ|End|$Loop;0|SUB|Loop|$Loop|1;0|RND|Jump|5;0|ADD|Jump|$Jump|1;0|JMPREL|$Jump;0|JMPABS|Attack0;0|JMPABS|Attack1;0|JMPABS|Attack2;0|JMPABS|Attack3;0|JMPABS|Attack4;0|:Attack0;0|CombatZoneResizeInstant|121|276|526|391;0|HeartMode|1;0|HeartTeleport|320|376;0|BoneVRepeat|128|341|45|0|240|4|16;0|BoneV|64|286|100|0|240;0|BoneVRepeat|512|341|45|2|240|4|16;0|BoneV|576|286|100|2|240;0.9|JMPABS|RndAttack;0|:Attack1;0|CombatZoneResizeInstant|121|276|526|391;0|HeartMode|1;0|HeartTeleport|320|376;0|BoneV|128|286|100|0|240|1;0|BoneV|56|366|20|0|240|0;0|BoneV|24|286|100|0|240|0;0|BoneV|512|286|100|2|240|1;0|BoneV|584|366|20|2|240|0;0|BoneV|616|286|100|2|240|0;1.1|JMPABS|RndAttack;0|:Attack2;0|CombatZoneResizeInstant|171|276|476|391;0|HeartMode|1;0|HeartTeleport|320|376;0|SET|Total|0;0|SET|Loop2|0;0|:Attack2Begin;0|RND|Choice|3;0|ADD|HeightB|$Choice|2;0|MUL|HeightB|$HeightB|10;0|SET|RndSpeed|0;0|JMPZ|SkipRndSpeed|$Loop2;0|RND|RndSpeed|3;0|SUB|RndSpeed|$RndSpeed|1;0|MUL|RndSpeed|$RndSpeed|2;0|:SkipRndSpeed;0|SUB|HeightT|86|$HeightB;0|SUB|YB|386|$HeightB;0|MUL|X|$Loop2|22;0|ADD|X|$X|25;0|ADD|X|$X|$Total;0|ADD|SpeedL|6|$RndSpeed;0|MUL|XL|$X|$SpeedL;0|SUB|XL|320|$XL;0|MUL|SpeedL|$SpeedL|30;0|MUL|RndSpeed|$RndSpeed|-1;0|ADD|SpeedR|6|$RndSpeed;0|MUL|XR|$X|$SpeedR;0|ADD|XR|320|$XR;0|MUL|SpeedR|$SpeedR|30;0|BoneV|$XL|282|$HeightT|0|$SpeedL;0|BoneV|$XL|$YB|$HeightB|0|$SpeedL;0|BoneV|$XR|282|$HeightT|2|$SpeedR;0|BoneV|$XR|$YB|$HeightB|2|$SpeedR;0|MUL|TotalInc|$Choice|5;0|ADD|Total|$Total|$TotalInc;0|ADD|Loop2|$Loop2|1;0|JMPL|Attack2Begin|$Loop2|4;1.9|JMPABS|RndAttack;0|:Attack3;0|CombatZoneResizeInstant|171|276|476|391;0|HeartMode|1;0|HeartTeleport|320|376;0|BoneVRepeat|200|282|70|0|150|3|125;0|BoneVRepeat|200|371|15|0|150|3|125;0|BoneVRepeat|440|282|70|2|150|3|125;0|BoneVRepeat|440|371|15|2|150|3|125;1.7|JMPABS|RndAttack;0|:Attack4;0|CombatZoneResizeInstant|121|276|526|391;0|HeartMode|1;0|RND|Side|2;0|JMPZ|Attack4Other|$Side;0|HeartTeleport|506|376;0|BoneVRepeat|200|331|55|0|360|11|24;0|BoneVRepeat|-64|371|15|0|360|10|24;1.5|JMPABS|RndAttack;0|:Attack4Other;0|HeartTeleport|149|376;0|BoneVRepeat|440|331|55|2|360|11|24;0|BoneVRepeat|704|371|15|2|360|10|24;1.5|JMPABS|RndAttack;0|:End;0|CombatZoneResizeInstant|33|251|608|391;0|EndAttack","multi2":"0|HeartTeleport|320|304;0|SET|Loop|5;0|:RndAttack;0|BlackScreen|1;0|Sound|Flash;0.4|BlackScreen|0;0|Sound|Flash;0|JMPZ|End|$Loop;0|SUB|Loop|$Loop|1;0|RND|Jump|4;0|ADD|Jump|$Jump|1;0|JMPREL|$Jump;0|JMPABS|Attack5;0|JMPABS|Attack6;0|JMPABS|Attack7;0|JMPABS|Attack8;0|:Attack5;0|CombatZoneResizeInstant|121|276|526|391;0|HeartMode|1;0|HeartTeleport|330|304;0|Platform|309|314|41|0|0;0|Platform|309|354|41|0|0;0|BoneVRepeat|121|364|30|2|0|25|16;0|RND|Side|2;0|JMPZ|Attack5Other|$Side;0|BoneV|521|280|35|2|240;0|BoneV|1|319|65|0|240;1.5|JMPABS|RndAttack;0|:Attack5Other;0|BoneV|119|280|35|0|240;0|BoneV|639|319|65|2|240;1.5|JMPABS|RndAttack;0|:Attack6;0|CombatZoneResizeInstant|241|226|406|391;0|HeartMode|0;0|HeartTeleport|320|304;0|RND|Rot|2;0|JMPZ|Attack6Other|$Rot;0|GasterBlaster|1|191|306|191|306|0|0.6|0.26666;0|GasterBlaster|1|321|166|321|166|90|0.6|0.26666;0|GasterBlaster|1|449|306|449|306|180|0.6|0.26666;0|GasterBlaster|1|321|446|321|446|270|0.6|0.26666;1.2|JMPABS|RndAttack;0|:Attack6Other;0|GasterBlaster|1|191|176|191|176|45|0.66666|0.26666;0|GasterBlaster|1|451|176|451|176|135|0.66666|0.26666;0|GasterBlaster|1|451|436|451|436|225|0.66666|0.26666;0|GasterBlaster|1|191|436|191|436|315|0.66666|0.26666;1.2|JMPABS|RndAttack;0|:Attack7;0|CombatZoneResizeInstant|179|226|404|391;0|HeartMode|0;0|RND|Side|2;0|JMPZ|Attack7Other|$Side;0|HeartTeleport|382|304;0|SineBones|16|-20|300|55;1.7|JMPABS|RndAttack;0|:Attack7Other;0|HeartTeleport|267|304;0|SineBones|16|20|300|55;1.7|JMPABS|RndAttack;0|:Attack8;0|CombatZoneResizeInstant|121|276|526|391;0|HeartMode|1;0|RND|Side|2;0|JMPZ|Attack8Other|$Side;0|HeartTeleport|489|376;0|BoneVRepeat|345|364|20|0|120|6|76;0|BoneVRepeat|297|280|82|2|120|6|76;1.9|JMPABS|RndAttack;0|:Attack8Other;0|HeartTeleport|168|376;0|BoneVRepeat|297|364|20|2|120|6|76;0|BoneVRepeat|345|280|82|0|120|6|76;1.9|JMPABS|RndAttack;0|:End;0|CombatZoneResizeInstant|33|251|608|391;0|EndAttack","multi3":"0|CombatZoneResize|239|226|404|391|TLResume;0|HeartTeleport|320|304;0|HeartMode|0;0|TLPause;0|SET|Loop|5;0|:RndAttack;0|BlackScreen|1;0|Sound|Flash;0.13333|BlackScreen|0;0|Sound|Flash;0|JMPZ|End|$Loop;0|SUB|Loop|$Loop|1;0|RND|Jump|9;0|ADD|Jump|$Jump|1;0|JMPREL|$Jump;0|JMPABS|Attack0;0|JMPABS|Attack1;0|JMPABS|Attack2;0|JMPABS|Attack3;0|JMPABS|Attack4;0|JMPABS|Attack5;0|JMPABS|Attack6;0|JMPABS|Attack7;0|JMPABS|Attack8;0|:Attack0;0|CombatZoneResizeInstant|121|276|526|391;0|HeartMode|1;0|HeartTeleport|320|376;0|BoneVRepeat|128|341|45|0|240|4|16;0|BoneV|64|286|100|0|240;0|BoneVRepeat|512|341|45|2|240|4|16;0|BoneV|576|286|100|2|240;0.9|JMPABS|RndAttack;0|:Attack1;0|CombatZoneResizeInstant|121|276|526|391;0|HeartMode|1;0|HeartTeleport|320|376;0|BoneV|128|286|100|0|240|1;0|BoneV|56|366|20|0|240|0;0|BoneV|24|286|100|0|240|0;0|BoneV|512|286|100|2|240|1;0|BoneV|584|366|20|2|240|0;0|BoneV|616|286|100|2|240|0;1.1|JMPABS|RndAttack;0|:Attack2;0|CombatZoneResizeInstant|171|276|476|391;0|HeartMode|1;0|HeartTeleport|320|376;0|SET|Total|0;0|SET|Loop2|0;0|:Attack2Begin;0|RND|Choice|3;0|ADD|HeightB|$Choice|2;0|MUL|HeightB|$HeightB|10;0|SET|RndSpeed|0;0|JMPZ|SkipRndSpeed|$Loop2;0|RND|RndSpeed|3;0|SUB|RndSpeed|$RndSpeed|1;0|MUL|RndSpeed|$RndSpeed|2;0|:SkipRndSpeed;0|SUB|HeightT|86|$HeightB;0|SUB|YB|386|$HeightB;0|MUL|X|$Loop2|22;0|ADD|X|$X|25;0|ADD|X|$X|$Total;0|ADD|SpeedL|6|$RndSpeed;0|MUL|XL|$X|$SpeedL;0|SUB|XL|320|$XL;0|MUL|SpeedL|$SpeedL|30;0|MUL|RndSpeed|$RndSpeed|-1;0|ADD|SpeedR|6|$RndSpeed;0|MUL|XR|$X|$SpeedR;0|ADD|XR|320|$XR;0|MUL|SpeedR|$SpeedR|30;0|BoneV|$XL|282|$HeightT|0|$SpeedL;0|BoneV|$XL|$YB|$HeightB|0|$SpeedL;0|BoneV|$XR|282|$HeightT|2|$SpeedR;0|BoneV|$XR|$YB|$HeightB|2|$SpeedR;0|MUL|TotalInc|$Choice|5;0|ADD|Total|$Total|$TotalInc;0|ADD|Loop2|$Loop2|1;0|JMPL|Attack2Begin|$Loop2|4;1.9|JMPABS|RndAttack;0|:Attack3;0|CombatZoneResizeInstant|171|276|476|391;0|HeartMode|1;0|HeartTeleport|320|376;0|BoneVRepeat|200|282|70|0|150|3|125;0|BoneVRepeat|200|371|15|0|150|3|125;0|BoneVRepeat|440|282|70|2|150|3|125;0|BoneVRepeat|440|371|15|2|150|3|125;1.7|JMPABS|RndAttack;0|:Attack4;0|CombatZoneResizeInstant|121|276|526|391;0|HeartMode|1;0|RND|Side|2;0|JMPZ|Attack4Other|$Side;0|HeartTeleport|506|376;0|BoneVRepeat|200|331|55|0|360|11|24;0|BoneVRepeat|-64|371|15|0|360|10|24;1.5|JMPABS|RndAttack;0|:Attack4Other;0|HeartTeleport|149|376;0|BoneVRepeat|440|331|55|2|360|11|24;0|BoneVRepeat|704|371|15|2|360|10|24;1.5|JMPABS|RndAttack;0|:Attack5;0|CombatZoneResizeInstant|121|276|526|391;0|HeartMode|1;0|HeartTeleport|330|304;0|Platform|309|314|41|0|0;0|Platform|309|354|41|0|0;0|BoneVRepeat|121|364|30|2|0|25|16;0|RND|Side|2;0|JMPZ|Attack5Other|$Side;0|BoneV|521|280|35|2|240;0|BoneV|1|319|65|0|240;1.5|JMPABS|RndAttack;0|:Attack5Other;0|BoneV|119|280|35|0|240;0|BoneV|639|319|65|2|240;1.5|JMPABS|RndAttack;0|:Attack6;0|CombatZoneResizeInstant|241|226|406|391;0|HeartMode|0;0|HeartTeleport|320|304;0|RND|Rot|2;0|JMPZ|Attack6Other|$Rot;0|GasterBlaster|1|191|306|191|306|0|0.6|0.26666;0|GasterBlaster|1|321|166|321|166|90|0.6|0.26666;0|GasterBlaster|1|449|306|449|306|180|0.6|0.26666;0|GasterBlaster|1|321|446|321|446|270|0.6|0.26666;1.2|JMPABS|RndAttack;0|:Attack6Other;0|GasterBlaster|1|191|176|191|176|45|0.66666|0.26666;0|GasterBlaster|1|451|176|451|176|135|0.66666|0.26666;0|GasterBlaster|1|451|436|451|436|225|0.66666|0.26666;0|GasterBlaster|1|191|436|191|436|315|0.66666|0.26666;1.2|JMPABS|RndAttack;0|:Attack7;0|CombatZoneResizeInstant|179|226|404|391;0|HeartMode|0;0|RND|Side|2;0|JMPZ|Attack7Other|$Side;0|HeartTeleport|382|304;0|SineBones|16|-20|300|55;1.7|JMPABS|RndAttack;0|:Attack7Other;0|HeartTeleport|267|304;0|SineBones|16|20|300|55;1.7|JMPABS|RndAttack;0|:Attack8;0|CombatZoneResizeInstant|121|276|526|391;0|HeartMode|1;0|RND|Side|2;0|JMPZ|Attack8Other|$Side;0|HeartTeleport|489|376;0|BoneVRepeat|345|364|20|0|120|6|76;0|BoneVRepeat|297|280|82|2|120|6|76;1.9|JMPABS|RndAttack;0|:Attack8Other;0|HeartTeleport|168|376;0|BoneVRepeat|297|364|20|2|120|6|76;0|BoneVRepeat|345|280|82|0|120|6|76;1.9|JMPABS|RndAttack;0|:End;0|CombatZoneResizeInstant|33|251|608|391;0|EndAttack","platformblaster":"0|CombatZoneResize|133|251|508|391|TLResume;0|HeartTeleport|320|376;0|HeartMode|1;0|TLPause;0|PlatformRepeat|552|346|51|2|120|8|140;0|PlatformRepeat|-20|306|51|0|120|8|160;0|SET|Loop|5;0|SUB|Loop|$Loop|1;0|RND|Y|3;0|MUL|Y|$Y|40;0|ADD|Y|$Y|285;0|GasterBlaster|0|0|0|73|$Y|0|0.56666|0.1;0.9|RND|Y|3;0|MUL|Y|$Y|40;0|ADD|Y|$Y|285;0|GasterBlaster|0|640|0|563|$Y|180|0.56666|0.1;0.9|JMPNZ|8|$Loop;0|EndAttack","platformblasterfast":"0|CombatZoneResize|133|251|508|391|TLResume;0|HeartTeleport|320|376;0|HeartMode|1;0|TLPause;0|PlatformRepeat|552|346|51|2|120|8|140;0|PlatformRepeat|-20|306|51|0|120|8|160;0|SET|Loop|6;0|SUB|Loop|$Loop|1;0|RND|Y|3;0|MUL|Y|$Y|40;0|ADD|Y|$Y|285;0|GasterBlaster|0|0|0|73|$Y|0|0.56666|0.1;0.7|RND|Y|3;0|MUL|Y|$Y|40;0|ADD|Y|$Y|285;0|GasterBlaster|0|640|0|563|$Y|180|0.56666|0.1;0.7|JMPNZ|8|$Loop;0|EndAttack","platforms1":"0|CombatZoneResize|133|251|508|391|TLResume;0|HeartTeleport|320|376;0|HeartMode|1;0|TLPause;0|Platform|15|346|61|0|120;0.4|BoneVRepeat|133|356|40|0|120|41|15;1.2|Platform|-61|346|61|0|150;1.7|Platform|-61|346|61|0|180;1|BoneV|133|257|45|0|210;0|BoneV|119|257|45|0|210;0|BoneV|105|257|45|0|210;2.3|BoneV|133|257|95|0|270;1.7|EndAttack","platforms2":"0|CombatZoneResize|133|251|508|391|TLResume;0|HeartTeleport|320|376;0|HeartMode|1;0|TLPause;0|Platform|640|346|51|2|150;0.4|BoneVRepeat|508|356|40|2|120|58|15;0.4|Platform|640|296|51|2|150;0.5|Platform|640|346|51|2|150;0.4|BoneV|508|316|70|2|150;0.4|Platform|640|296|31|2|60;0.6|Platform|640|326|51|2|150;0.7|Platform|640|336|51|2|150;0.3|BoneV|508|257|45|2|150;0.4|Platform|640|316|51|2|150;0.3|BoneV|508|257|55|2|150;0.7|BoneV|508|257|35|2|150;1.5|BoneV|133|257|95|0|90;0.7|BoneV|508|276|110|2|240;2.5|EndAttack","platforms3":"0|CombatZoneResize|133|251|508|391|TLResume;0|HeartTeleport|320|376;0|HeartMode|1;0|TLPause;0|PlatformRepeat|513|346|121|2|120|5|220;0|PlatformRepeat|-71|306|161|0|120|4|280;0|SET|Loop|16;0|JMPZ|22|$Loop;0|SUB|Loop|$Loop|1;0|RND|Jump|3;0|ADD|Jump|$Jump|1;0|JMPREL|$Jump;0|JMPREL|3;0|JMPREL|4;0|JMPREL|5;0|BoneV|517|257|45|2|120;0.5|JMPABS|8;0|BoneV|125|306|40|0|120;0.5|JMPABS|8;0|BoneV|517|349|35|2|120;0.5|JMPABS|8;0|EndAttack","platforms4":"0|CombatZoneResize|113|231|548|391|TLResume;0|HeartTeleport|320|376;0|HeartMode|1;0|TLPause;0|Platform|151|336|41|0|90|1;0|HeartTeleport|175|327;0|BoneVRepeat|528|366|40|0|60|60|15;0|BoneVRepeat|283|267|40|3|90|11|85;0|BoneVRepeat|363|331|40|1|120|13|95;0|BoneVRepeat|443|248|40|3|90|11|85;7.3|EndAttack","platforms4hard":"0|CombatZoneResize|113|231|548|391|TLResume;0|HeartTeleport|320|376;0|HeartMode|1;0|TLPause;0|Platform|151|336|31|0|90|1;0|HeartTeleport|175|327;0|BoneVRepeat|528|366|40|0|60|60|15;0|BoneVRepeat|283|268|40|3|90|12|65;0|BoneVRepeat|363|325|40|1|120|11|90;0|BoneVRepeat|443|268|40|3|90|12|65;7.3|EndAttack","randomblaster1":"0|CombatZoneResize|121|186|526|391|TLResume;0|HeartTeleport|320|304;0|HeartMode|0;0|TLPause;0.5|SET|Loop|15;0|SUB|Loop|$Loop|1;0|RND|Ang|360;0|COS|X|$Ang;0|SIN|Y|$Ang;0|MUL|EndX|$X|200;0|MUL|EndY|$Y|200;0|MUL|X|$X|400;0|MUL|Y|$Y|300;0|GetHeartPos|HeartX|HeartY;0|ADD|EndX|$EndX|$HeartX;0|ADD|EndY|$EndY|$HeartY;0|ADD|X|$X|$HeartX;0|ADD|Y|$Y|$HeartY;0|JMPNL|21|$EndX|50;0|SET|EndX|50;0|JMPNG|23|$EndX|590;0|SET|EndX|590;0|JMPNL|25|$EndY|40;0|SET|EndY|40;0|JMPNG|27|$EndY|440;0|SET|EndY|440;0|ANGLE|Ang|$EndX|$EndY|$HeartX|$HeartY;0|GasterBlaster|0|$X|$Y|$EndX|$EndY|$Ang|0.46666|0.03333;0.53333|JMPNZ|6|$Loop;0|EndAttack","randomblaster2":"0|CombatZoneResize|121|186|526|391|TLResume;0|HeartTeleport|320|304;0|HeartMode|0;0|TLPause;0.4|SET|Loop|12;0|SUB|Loop|$Loop|1;0|RND|Ang|360;0|COS|X|$Ang;0|SIN|Y|$Ang;0|MUL|EndX|$X|200;0|MUL|EndY|$Y|200;0|MUL|X|$X|400;0|MUL|Y|$Y|300;0|GetHeartPos|HeartX|HeartY;0|ADD|EndX|$EndX|$HeartX;0|ADD|EndY|$EndY|$HeartY;0|ADD|X|$X|$HeartX;0|ADD|Y|$Y|$HeartY;0|JMPNL|21|$EndX|50;0|SET|EndX|50;0|JMPNG|23|$EndX|590;0|SET|EndX|590;0|JMPNL|25|$EndY|40;0|SET|EndY|40;0|JMPNG|27|$EndY|440;0|SET|EndY|440;0|ANGLE|Ang|$EndX|$EndY|$HeartX|$HeartY;0|GasterBlaster|1|$X|$Y|$EndX|$EndY|$Ang|0.66666|0.03333;0.66666|JMPNZ|6|$Loop;0|EndAttack","spare":"0|CombatZoneResize|133|251|508|391|TLResume;0|HeartTeleport|320|376;0|HeartMode|1;0|TLPause;0.3|EndAttack"};

/* the order they come at you in, read out of the event sheet */
const SANS_ORDER = [
  'intro', 'bonegap1', 'bluebone', 'bonegap2', 'platforms1', 'platforms2',
  'platforms3', 'platforms4', 'platformblaster', 'platforms4hard',
  'bonegap1fast', 'boneslideh', 'bonegap2', 'platformblasterfast',
  ['bonegap1fast', 'bonegap2', 'boneslideh', 'platformblasterfast'],
  'multi1', 'randomblaster1', 'multi2', 'bonestab1', 'bonestab2',
  'randomblaster2', 'boneslidev', 'multi3', 'bonestab3',
  ['bonestab3', 'multi3', 'randomblaster2'],
  'final'
];


/* =========================================================================
   Part 6 — bootstrap, chapter flow, player controller, main loop
   ========================================================================= */

let PIXSCALE = 2.4;
let mmCtx = null;

function initRenderer() {
  const canvas = document.getElementById('view');
  G.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  G.renderer.setPixelRatio(1);
  G.renderer.setClearColor(0x0a0d09);
  G.camera = new THREE.PerspectiveCamera(72, 1, 0.08, 220);
  resize();
  window.addEventListener('resize', resize);
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  G.renderer.setSize(Math.max(160, Math.floor(w / PIXSCALE)), Math.max(120, Math.floor(h / PIXSCALE)), false);
  const c = G.renderer.domElement;
  c.style.width = w + 'px'; c.style.height = h + 'px';
  G.camera.aspect = w / h;
  G.camera.updateProjectionMatrix();
  if (typeof FNFPlay !== 'undefined' && FNFPlay.active) FNFPlay.resize();
  if (typeof SansFight !== 'undefined' && SansFight.active) SansFight.resize();
}

/* ---------------------------------------------------------------- title */
/* The title screen is a real 3D shot: Baldi standing in a white void on the
   left, ruler up, swaying gently. The chalkboard and lettering are DOM on
   top of it, so they stay crisp at any resolution. */
function buildMenuScene() {
  const sc = new THREE.Scene();
  sc.background = new THREE.Color(0xffffff);
  sc.add(new THREE.AmbientLight(0xffffff, 0.82));
  const d1 = new THREE.DirectionalLight(0xffffff, 0.55); d1.position.set(0.4, 1, 0.7); sc.add(d1);
  const d2 = new THREE.DirectionalLight(0xdfe6ff, 0.22); d2.position.set(-0.6, 0.3, -0.4); sc.add(d2);
  const m = makeBaldi();
  m.root.position.set(0, 0, 0);
  sc.add(m.root);
  G.menu = { scene: sc, model: m, t: 0 };
}

/* The ruler hangs off the forearm, so its angle is whatever the arm happens
   to be doing.  On the title screen the angle is the whole point, so this
   works backwards: pick the direction the blade should point on screen, and
   solve for the local rotation that produces it. */
const _tq = { z: new THREE.Vector3(), x: new THREE.Vector3(), y: new THREE.Vector3(),
              m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Quaternion() };
function aimTitleRuler(m, t) {
  const sway = Math.sin(t * 0.55) * 0.05;
  /* up and out to his right, leaning very slightly back from the camera */
  _tq.z.set(0.62, 0.78, -0.06 + sway).normalize();
  /* and rolled so the printed face is the one you can read */
  _tq.x.set(0, 0, 1);
  _tq.x.addScaledVector(_tq.z, -_tq.x.dot(_tq.z)).normalize();
  _tq.y.crossVectors(_tq.z, _tq.x).normalize();
  _tq.m.makeBasis(_tq.x, _tq.y, _tq.z);
  _tq.q.setFromRotationMatrix(_tq.m);
  m.armR.fore.updateWorldMatrix(true, false);
  m.armR.fore.getWorldQuaternion(_tq.p);
  m.ruler.quaternion.copy(_tq.p.invert().multiply(_tq.q));
  /* slide it back down its own length so he is gripping it a third of the
     way up, with some blade below the fist — that is what the box art does */
  if (!m.__rulerHome) m.__rulerHome = m.ruler.position.clone();
  _tq.y.set(0, 0, 1).applyQuaternion(m.ruler.quaternion);
  m.ruler.position.copy(m.__rulerHome).addScaledVector(_tq.y, -0.62);
}

function updateMenuScene(dt) {
  if (!G.menu) return;
  G.menu.t += dt;
  const m = G.menu.model, t = G.menu.t;
  m.setMood(0); m.mood = 0;
  m.update(dt, { speed: 0, anger: 0 });
  m.root.rotation.y = 0.10 + Math.sin(t * 0.55) * 0.07;
  m.root.position.y = Math.sin(t * 1.1) * 0.06;
  // he watches whoever is reading the menu
  const look = new THREE.Vector3(Math.sin(t * 0.8) * 2.6, 4.6 + Math.sin(t * 0.6) * 0.8, 11);
  m.update(0, { speed: 0, anger: 0, lookAt: look });

  /* The box-art pose: right arm out and bent, ruler held up across him at a
     diagonal; left arm hanging.  This runs after update() because update()
     writes the arms itself and would otherwise put them straight back. */
  const br = Math.sin(t * 1.1) * 0.03;                 // he breathes
  m.armR.g.rotation.set(-0.26 + br, 0, 1.02);         // out to the side
  m.armR.fore.rotation.set(-0.60, 0, 0);              // elbow bent up
  m.armL.g.rotation.set(-0.10 + br, 0, -0.17);        // the other one hangs
  m.armL.fore.rotation.set(-0.16, 0, 0);
  m.legL.rotation.set(0, 0, -0.02);
  m.legR.rotation.set(0, 0, 0.02);
  m.torso.rotation.set(0, 0, 0);
  m.torso.position.y = 3.05;
  aimTitleRuler(m, t);

  const cam = G.camera;
  cam.fov = 40; cam.updateProjectionMatrix();
  cam.rotation.order = 'YXZ';
  cam.position.set(3.4, 4.3, 12.5);
  cam.lookAt(new THREE.Vector3(3.4, 3.7, 0));
  G.renderer.setClearColor(0xffffff);
  G.renderer.render(G.menu.scene, cam);
}

/* ------------------------------------------------------------ custom mode */
/* A card per character with its own counter. Nothing here is a chapter — it
   drops you straight into the whole school with exactly the line-up you set. */
function drawRosterPortrait(cv2, key) {
  const x = cv2.getContext('2d'), W = cv2.width, H = cv2.height, cx = W / 2;
  x.clearRect(0, 0, W, H);
  const ink = (w) => { x.strokeStyle = '#101010'; x.lineWidth = w; };
  const head = (col, r, y) => { x.fillStyle = col; x.beginPath();
    x.ellipse(cx, y, r, r * 1.12, 0, 0, TAU); x.fill(); ink(3); x.stroke(); };
  const eyes = (y, sp, r) => { [-1, 1].forEach(s => {
    x.fillStyle = '#fff'; x.beginPath(); x.ellipse(cx + s * sp, y, r, r * 1.25, 0, 0, TAU); x.fill();
    ink(2.5); x.stroke();
    x.fillStyle = '#111'; x.beginPath(); x.ellipse(cx + s * sp, y + 2, r * 0.42, r * 0.5, 0, 0, TAU); x.fill(); }); };

  if (key === 'weird') {
    /* the same portrait as Baldi, drawn by somebody who was not looking */
    x.fillStyle = '#5fbf2e'; x.beginPath();
    x.moveTo(cx - 24, 60); x.lineTo(cx + 21, 63); x.lineTo(cx + 25, 100);
    x.lineTo(cx - 19, 98); x.closePath(); x.fill();
    x.save(); x.translate(cx, 40); x.rotate(-0.16); x.translate(-cx, -40);
    head('#e6d9a8', 28, 40); x.restore();
    /* one eye far too big, the other far too small, neither pointing at you */
    x.fillStyle = '#fff'; x.beginPath(); x.ellipse(cx - 12, 35, 14, 16, 0, 0, TAU); x.fill();
    ink(2.5); x.stroke();
    x.fillStyle = '#111'; x.beginPath(); x.ellipse(cx - 17, 40, 5, 6, 0, 0, TAU); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.ellipse(cx + 13, 44, 7, 8, 0, 0, TAU); x.fill();
    ink(2.5); x.stroke();
    x.fillStyle = '#111'; x.beginPath(); x.ellipse(cx + 16, 41, 3, 3.5, 0, 0, TAU); x.fill();
    /* three hairs */
    x.strokeStyle = '#3a2a1e'; x.lineWidth = 3; x.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      x.beginPath(); x.moveTo(cx - 6 + i * 6, 16);
      x.quadraticCurveTo(cx - 12 + i * 10, 6 + i * 2, cx - 2 + i * 9, 4 + i * 3); x.stroke();
    }
    x.strokeStyle = '#a8702a'; x.lineWidth = 4;
    x.beginPath(); x.moveTo(cx - 22, 24); x.lineTo(cx - 6, 31); x.stroke();
    x.beginPath(); x.moveTo(cx + 22, 27); x.lineTo(cx + 8, 30); x.stroke();
    /* a grin that goes on too long */
    x.strokeStyle = '#101010'; x.lineWidth = 3;
    x.beginPath(); x.arc(cx, 52, 13, 0.10 * Math.PI, 0.82 * Math.PI); x.stroke();
    /* the cloud */
    x.fillStyle = 'rgba(159,212,74,.55)';
    for (const [px, py, pr] of [[cx - 28, 88, 9], [cx - 34, 79, 6], [cx - 22, 96, 5]]) {
      x.beginPath(); x.arc(px, py, pr, 0, TAU); x.fill();
    }
    x.fillStyle = '#d8621f'; x.fillRect(cx - 20, 100, 18, 8); x.fillRect(cx + 2, 100, 20, 8);
  } else if (key === 'baldi') {
    x.fillStyle = '#18c21c'; x.fillRect(cx - 22, 60, 44, 40);
    head('#e8cba4', 26, 40); eyes(38, 11, 8);
    x.strokeStyle = '#a8702a'; x.lineWidth = 4; x.lineCap = 'round';
    x.beginPath(); x.moveTo(cx - 20, 22); x.lineTo(cx - 5, 28); x.stroke();
    x.beginPath(); x.moveTo(cx + 20, 22); x.lineTo(cx + 5, 28); x.stroke();
    x.strokeStyle = '#101010'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(cx - 12, 58); x.lineTo(cx + 12, 58); x.stroke();
    x.fillStyle = '#e0c188'; x.fillRect(cx + 24, 40, 6, 52);
  } else if (key === 'principal') {
    x.fillStyle = '#2f3d55'; x.fillRect(cx - 22, 60, 44, 40);
    x.fillStyle = '#fff'; x.fillRect(cx - 6, 60, 12, 30);
    x.fillStyle = '#a32626'; x.fillRect(cx - 3, 62, 6, 26);
    head('#e8cba4', 24, 40);
    x.fillStyle = '#6b3f1d'; x.beginPath(); x.ellipse(cx, 26, 24, 12, 0, Math.PI, TAU); x.fill();
    eyes(40, 10, 7);
    ink(2.5); x.beginPath(); x.arc(cx - 10, 40, 9, 0, TAU); x.stroke();
    x.beginPath(); x.arc(cx + 10, 40, 9, 0, TAU); x.stroke();
  } else if (key === 'playtime') {
    x.fillStyle = '#f472c0'; x.beginPath(); x.moveTo(cx - 14, 58);
    x.lineTo(cx + 14, 58); x.lineTo(cx + 26, 100); x.lineTo(cx - 26, 100); x.closePath(); x.fill();
    head('#f7dcb8', 24, 38);
    x.fillStyle = '#f2ce54'; x.beginPath(); x.ellipse(cx, 30, 26, 20, 0, Math.PI, TAU); x.fill();
    [-1, 1].forEach(s => { x.beginPath(); x.ellipse(cx + s * 30, 44, 9, 15, 0, 0, TAU); x.fill(); });
    eyes(40, 10, 8);
  } else if (key === 'bully') {
    x.fillStyle = '#c94f3a'; x.fillRect(cx - 26, 58, 52, 42);
    x.fillStyle = '#f0e0c0'; x.fillRect(cx - 26, 72, 52, 10);
    head('#e8cba4', 24, 38);
    x.fillStyle = '#2f4f7f'; x.beginPath(); x.ellipse(cx, 28, 25, 14, 0, Math.PI, TAU); x.fill();
    x.fillRect(cx - 25, 26, 50, 6);
    eyes(42, 10, 7);
  } else if (key === 'sweep') {
    x.fillStyle = '#2f8ad6'; x.fillRect(cx - 5, 16, 10, 62);
    x.fillStyle = '#1f6fb0'; x.fillRect(cx - 26, 74, 52, 10);
    x.fillStyle = '#e8d26a'; x.fillRect(cx - 24, 82, 48, 16);
    eyes(40, 11, 9);
    ink(3); x.beginPath(); x.arc(cx, 54, 9, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
  } else if (key === 'crafters') {
    x.fillStyle = '#8a6238'; x.fillRect(cx - 4, 56, 8, 44);
    x.fillStyle = '#6d4b9e'; x.fillRect(cx - 9, 50, 18, 12);
    x.fillStyle = '#3fa85a'; x.beginPath(); x.ellipse(cx, 34, 24, 20, 0, 0, TAU); x.fill(); ink(3); x.stroke();
    x.fillStyle = '#7a1d2b'; x.beginPath(); x.ellipse(cx + 4, 44, 17, 8, 0, 0, TAU); x.fill();
    eyes(22, 11, 9);
  } else if (key === 'prize') {
    x.fillStyle = '#dfe4ea'; x.fillRect(cx - 20, 44, 40, 42);
    x.fillStyle = '#d23a3a'; x.fillRect(cx - 20, 58, 40, 8);
    x.fillStyle = '#2f6fd0'; x.fillRect(cx - 20, 74, 40, 6);
    x.fillStyle = '#2b2f36'; x.beginPath(); x.arc(cx, 94, 11, 0, TAU); x.fill();
    x.fillStyle = '#dfe4ea'; x.fillRect(cx - 17, 20, 34, 24); ink(3); x.strokeRect(cx - 17, 20, 34, 24);
    x.fillStyle = '#1b2430'; x.fillRect(cx - 14, 26, 28, 10);
    eyes(31, 8, 6);
    x.strokeStyle = '#b9c2cc'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx, 20); x.lineTo(cx, 10); x.stroke();
    x.fillStyle = '#d23a3a'; x.beginPath(); x.arc(cx, 8, 4, 0, TAU); x.fill();
  } else if (key === 'chalkles') {
    x.fillStyle = '#243b2c'; x.fillRect(6, 12, W - 12, H - 30);
    x.strokeStyle = '#f4f4e8'; x.lineWidth = 3; x.lineCap = 'round';
    x.beginPath(); x.arc(cx, 52, 24, 0, TAU); x.stroke();
    x.fillStyle = '#f4f4e8';
    [-1, 1].forEach(s => { x.beginPath(); x.ellipse(cx + s * 9, 46, 4, 5, 0, 0, TAU); x.fill(); });
    x.beginPath(); x.arc(cx, 54, 12, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
  } else if (key === 'cloudy') {
    x.fillStyle = '#f2f6ff';
    [[0, 52, 24], [-18, 60, 16], [18, 60, 16], [-10, 42, 14], [10, 42, 14]].forEach(c => {
      x.beginPath(); x.arc(cx + c[0], c[1], c[2], 0, TAU); x.fill(); });
    x.fillStyle = '#d93b3b'; x.fillRect(cx - 8, 22, 16, 8);
    x.strokeStyle = '#2f6fd0'; x.lineWidth = 4;
    x.beginPath(); x.moveTo(cx - 22, 18); x.lineTo(cx + 22, 18); x.stroke();
    eyes(50, 10, 8);
    x.fillStyle = '#5a6478'; x.beginPath(); x.arc(cx, 68, 5, 0, TAU); x.fill();
  } else if (key === 'beans') {
    x.fillStyle = '#8fd14f'; x.beginPath(); x.ellipse(cx, 58, 24, 32, 0, 0, TAU); x.fill(); ink(3); x.stroke();
    x.fillStyle = '#2f6fd0'; x.beginPath(); x.ellipse(cx, 34, 25, 14, 0, Math.PI, TAU); x.fill();
    x.fillRect(cx - 25, 32, 50, 6);
    eyes(48, 10, 8);
    x.fillStyle = '#ff8fc8'; x.beginPath(); x.arc(cx + 16, 70, 9, 0, TAU); x.fill();
  }
}

function buildRoster() {
  if (!G.customCounts) {
    G.customCounts = {};
    for (const r of ROSTER) G.customCounts[r.key] = r.def;
  }
  const grid = UI.el('rosterGrid');
  grid.innerHTML = '';
  for (const r of ROSTER) {
    const card = document.createElement('div');
    card.className = 'rcard';
    card.id = 'rc_' + r.key;
    const cvs = document.createElement('canvas'); cvs.width = 72; cvs.height = 110;
    card.appendChild(cvs);
    drawRosterPortrait(cvs, r.key);
    const nm = document.createElement('div'); nm.className = 'rname'; nm.textContent = r.name;
    card.appendChild(nm);
    const row = document.createElement('div'); row.className = 'rrow';
    const minus = document.createElement('button'); minus.className = 'stepBtn'; minus.textContent = '−';
    const val = document.createElement('span'); val.className = 'rnum'; val.id = 'rn_' + r.key;
    const plus = document.createElement('button'); plus.className = 'stepBtn'; plus.textContent = '+';
    minus.onclick = () => { setCount(r.key, (G.customCounts[r.key] || 0) - 1); Audio1.init(); Audio1.tone(330, .07, .08, 'square'); };
    plus.onclick  = () => { setCount(r.key, (G.customCounts[r.key] || 0) + 1); Audio1.init(); Audio1.tone(560, .07, .08, 'square'); };
    row.appendChild(minus); row.appendChild(val); row.appendChild(plus);
    card.appendChild(row);
    grid.appendChild(card);
  }
  refreshRoster();
}
function setCount(key, v) {
  G.customCounts[key] = clamp(Math.round(v), 0, ROSTER_MAX);
  refreshRoster();
}
function refreshRoster() {
  let total = 0;
  for (const r of ROSTER) {
    const n = clamp(Math.round(G.customCounts[r.key] || 0), 0, ROSTER_MAX);
    G.customCounts[r.key] = n; total += n;
    const el = UI.el('rn_' + r.key); if (el) el.textContent = n;
    const card = UI.el('rc_' + r.key); if (card) card.classList.toggle('off', n === 0);
  }
  UI.el('modeTotal').textContent = total + ' character' + (total === 1 ? '' : 's') + ' in the school';
  UI.el('modeStart').disabled = false;
}

/* ---------------------------------------------------------------- chapters */
function buildChapterList() {
  const list = UI.el('chapList');
  list.innerHTML = '';
  // every chapter is pickable — progress doesn't survive a page reload, so
  // there's no sense making anyone replay their way back to where they were
  CHAPTERS.forEach((ch, i) => {
    if (ch.hidden) return;
    const row = document.createElement('button');
    row.className = 'chapRow';
    const state = i < G.maxChapter ? '✔ CLEARED' : (i === G.maxChapter ? '▶ NEXT UP' : 'JUMP IN');
    row.innerHTML =
      '<span class="num">' + ch.n + '</span>' +
      '<span><span class="nm">' + ch.name + '</span><span class="ds">' + ch.sub + '</span></span>' +
      '<span class="st">' + state + '<br>' + ch.notebooks + ' notebooks</span>';
    row.onclick = () => { UI.el('chapters').classList.add('hidden'); showChapterCard(i); };
    list.appendChild(row);
  });
}
function showChapterCard(i) {
  const ch = CHAPTERS[i];
  G.pendingChapter = i;
  UI.el('ccNum').textContent = ch.n;
  UI.el('ccName').textContent = ch.name;
  UI.el('ccSub').textContent = ch.sub;
  const castNames = { principal: 'Principal of the Thing', playtime: 'Playtime', bully: 'It\'s a Bully',
    sweep: 'Gotta Sweep', crafters: 'Arts and Crafters', prize: '1st Prize', chalkles: 'Chalkles',
    cloudy: 'Cloudy Copter', beans: 'Beans' };
  const who = ch.cast.map(k => castNames[k]).join(' · ');
  UI.el('ccGoal').innerHTML =
    'COLLECT ' + ch.notebooks + ' NOTEBOOK' + (ch.notebooks > 1 ? 'S' : '') +
    (ch.allExits ? ' · THEN REACH ALL FOUR EXITS' : ' · THEN REACH AN EXIT') +
    (who ? '<br><span style="color:#bcd;font-size:14px">Also in school: Baldi · ' + who + '</span>'
         : '<br><span style="color:#bcd;font-size:14px">Also in school: Baldi</span>');
  UI.el('chapterCard').classList.remove('hidden');
}

/* ---------------------------------------------------------------- new game */
function newGame(chapterIndex) {
  G.chapter = chapterIndex;
  const ch = CHAPTERS[G.chapter];
  G.total = ch.notebooks;
  G.unlockedZones = ch.zones;
  Map1.unlocked = ch.zones;
  G.notebooks = 0; G.wrongs = 0; G.detentions = 0; G.elapsed = 0; G.time = 0;
  G.exitsReached = 0; G.blind = 0; G.gums = []; G.jets = []; G.baldiLeftPad = false;
  G.friendlyBaldi = false; Campaign.active = false; G.loadFactor = 1;
  Confiscate.stop();
  UI.el('confCheat').classList.add('hidden');
  UI.el('objBar').classList.add('hidden');
  UI.el('djTitle').classList.remove('on'); UI.el('lyric').textContent = '';
  UI.el('djSkip').classList.add('hidden');
  UI.el('fade').classList.remove('on'); UI.el('fadeText').textContent = '';
  Audio1.forestAmbient(false);
  Map1.forest = null; Map1.forestLOD = null;
  G.props = []; G.ents = {}; G.cast = []; G.alarmProp = null;
  G.seenCells = new Uint8Array(MW * MH);

  G.scene = new THREE.Scene();
  const fogCol = ch.sunny ? 0x8fc9ef : ch.dark ? 0x05060a : 0x0a0d09;
  G.scene.background = new THREE.Color(fogCol);
  G.scene.fog = new THREE.Fog(fogCol, ch.sunny ? 46 : ch.dark ? 14 : 26,
                                      ch.sunny ? 165 : ch.dark ? 60 : 96);
  G.renderer.setClearColor(fogCol);

  const amb = ch.sunny ? 0.80 : ch.dark ? 0.34 : 0.58;
  G.scene.add(new THREE.AmbientLight(0xffffff, amb));
  G.scene.add(new THREE.HemisphereLight(0xfff6e2, 0x4a5040, ch.dark ? 0.18 : 0.32));
  const dir = new THREE.DirectionalLight(0xfff3d8, ch.dark ? 0.14 : 0.26);
  dir.position.set(0.4, 1, 0.25); G.scene.add(dir);
  const dir2 = new THREE.DirectionalLight(0xd8e0ff, 0.14);
  dir2.position.set(-0.5, 0.3, -0.6); G.scene.add(dir2);

  generateMap();
  if (ch.campaign) carveBusLot();
  const built = buildWorld(G.scene);
  G.props = built.props;
  // hide the barricades for zones already open
  for (const g of Map1.gates) if (g.mesh) g.mesh.visible = g.zone > G.unlockedZones;

  const p = G.player;
  const start = cellCenter(22, 49);         // just inside the main south entrance
  p.x = start.x + CS / 2; p.z = start.z;
  p.yaw = 0; p.pitch = 0;
  p.stamina = 100; p.staminaLock = 0; p.items = [null, null, null]; p.sel = 0;
  G.gasHit = 0;
  p.energy = 0; p.brokeRule = 0; p.stuck = 0; p.bob = 0; p.stepAcc = 0;

  placeContent();
  spawnEntities();

  buildSlots();
  UI.el('nbCount').innerHTML = '0/' + G.total + '<small>NOTEBOOKS</small>';
  UI.el('chapTag').textContent = ch.n ? ('CHAPTER ' + ch.n + ' — ' + ch.name) : ch.name;
  /* nobody is angry on a field trip — the meter would only be confusing */
  UI.el('angerWrap').style.display = ch.campaign ? 'none' : '';
  UI.el('exitTag').classList.toggle('hidden', !ch.allExits);
  UI.el('exitTag').textContent = 'EXITS 0/4';
  updateAngerBar();
  UI.el('hud').classList.remove('hidden');
  ['gameover', 'win', 'detention', 'pauseHint', 'menu', 'loading', 'chapters', 'chapterCard', 'chapterEnd']
    .forEach(id => UI.el(id).classList.add('hidden'));
  UI.el('mathPad').classList.add('hidden');
  UI.el('ropeUI').classList.add('hidden');
  UI.el('dialogue').classList.add('hidden');

  mmCtx = UI.el('mmCanvas').getContext('2d');
  G.camera.fov = 72; G.camera.updateProjectionMatrix();
  G.running = true;
  Audio1.init(); Audio1.resume(); Audio1.startAmbient();
  // the schoolhouse tune runs under Chapter 1 until you fumble a problem
  Music.stop(true);
  if (ch.n === 1) Music.play();

  if (ch.campaign) {
    G.mode = 'play';
    Campaign.start();
    requestLock();
  } else if (ch.confiscate) {
    G.mode = 'play';
    Confiscate.start();
    requestLock();
  } else if (ch.intro) { Intro.start(); }
  else {
    G.mode = 'play';
    UI.say('Find ' + G.total + ' notebooks, then reach an exit.', 3400);
    requestLock();
  }
}

/* ---------------------------------------------------------------- input */
let pointerLocked = false;
/* Pointer lock is not always ours to have — an embedded frame may simply not
   be allowed it.  Rather than trapping the player behind a click-to-resume
   card that can never succeed, the game notices and switches to dragging the
   mouse to look, with Q and E to turn.  Everything stays playable. */
let lockDenied = false;
/* where the cursor is, as a fraction of the window, so the view can keep
   turning once the mouse runs out of desk */
let curX = 0.5, curIn = false, lastMX = null, lastMY = null;
function requestLock() {
  if (lockDenied) return;
  const c = document.getElementById('view');
  if (!c.requestPointerLock) { goDragMode(); return; }
  try { c.requestPointerLock(); } catch (e) { goDragMode(); }
}
function goDragMode() {
  if (lockDenied) return;
  lockDenied = true;
  G.paused = false;
  UI.el('pauseHint').classList.add('hidden');
  const h = UI.el('lookHint');
  if (h) h.classList.remove('hidden');
}
/* Browsers refuse a programmatic pointer lock that isn't tied to a click, so
   after a menu closes we ask once and, if it didn't take, put up a
   click-to-continue card rather than stranding the player. */
function resumeLock() {
  requestLock();
  setTimeout(() => {
    if (lockDenied) return;
    if (!pointerLocked && G.running && G.mode === 'play') {
      G.paused = true;
      UI.el('pauseHint').classList.remove('hidden');
    }
  }, 400);
}
function initInput() {
  document.addEventListener('pointerlockerror', () => goDragMode());
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === document.getElementById('view');
    if (lockDenied) return;
    if (!pointerLocked && G.running && G.mode === 'play') {
      G.paused = true; UI.el('pauseHint').classList.remove('hidden');
    } else if (pointerLocked) {
      G.paused = false; UI.el('pauseHint').classList.add('hidden');
    }
  });
  document.addEventListener('mousemove', e => {
    if (lockDenied) {
      curX = e.clientX / Math.max(1, window.innerWidth);
      curIn = true;
    }
    if (G.mode !== 'play' && G.mode !== 'intro') return;
    const p = G.player;
    if (pointerLocked) {
      p.yaw -= e.movementX * 0.0022;
      p.pitch = clamp(p.pitch - e.movementY * 0.0022, -1.25, 1.25);
      return;
    }
    if (!lockDenied) return;
    /* No lock, no button to hold: just move the mouse.  movementX is there
       without a lock in every current browser, but fall back to differencing
       clientX so this cannot go dead anywhere. */
    let dx = e.movementX, dy = e.movementY;
    if (dx == null || dy == null) {
      dx = lastMX == null ? 0 : e.clientX - lastMX;
      dy = lastMY == null ? 0 : e.clientY - lastMY;
    }
    lastMX = e.clientX; lastMY = e.clientY;
    p.yaw -= dx * 0.0026;
    p.pitch = clamp(p.pitch - dy * 0.0026, -1.25, 1.25);
  });
  document.addEventListener('mouseleave', () => { curIn = false; lastMX = lastMY = null; });
  document.addEventListener('mouseenter', () => { lastMX = lastMY = null; });
  document.addEventListener('mousedown', e => {
    if (!G.running) return;
    if (G.mode === 'intro') { Intro.skip(); return; }
    if (!lockDenied && !pointerLocked && (G.mode === 'play' || G.paused)) { requestLock(); return; }
    if (G.mode === 'play' && e.button === 0) useItem();
  });
  window.addEventListener('wheel', e => {
    if (G.mode !== 'play') return;
    G.player.sel = (G.player.sel + (e.deltaY > 0 ? 1 : 2)) % 3;
    refreshSlots();
  }, { passive: true });

  window.addEventListener('keydown', e => {
    G.keys[e.code] = true;
    /* FNF owns the whole keyboard while it is up, Escape included */
    if (G.mode === 'fnf') { if (FNF.key(e.code, true)) e.preventDefault(); return; }
    if (G.mode === 'sans') { if (SansFight.key(e.code, true)) e.preventDefault(); return; }
    if (e.code === 'Escape') {
      if (G.mode === 'dj') { DJ.skip(); e.preventDefault(); }
      return;
    }
    if (G.mode === 'math') { return; }   // the input box owns Enter — see below
    if (e.code === 'Space') {
      e.preventDefault();
      if (G.mode === 'rope') ropeJump();
      else if (G.mode === 'detention') G.detTime -= 0.35;
      else if (G.mode === 'intro') Intro.skip();
      else if (Campaign.active && Campaign.phase === 'talk') Campaign.lineT = 99;
    }
    if (e.code === 'KeyM' && G.mode === 'dj') {
      /* swap the band over without missing a beat */
      G.musicStyle = DJAudio.style = (DJAudio.style === 'rock' ? 'orig' : 'rock');
      DJ.card(DJAudio.style === 'rock' ? 'ROCK / METAL' : 'ORIGINAL');
      clearTimeout(DJ._styleCard);
      DJ._styleCard = setTimeout(() => DJ.card(null), 1600);
      return;
    }
    if (e.code === 'KeyK' && Confiscate.active && Confiscate.phase === 'hunt') {
      Confiscate.grabAll(); return;
    }
    if (G.mode !== 'play') return;
    if (e.code === 'KeyE') useItem();
    if (e.code === 'Digit1') { G.player.sel = 0; refreshSlots(); }
    if (e.code === 'Digit2') { G.player.sel = 1; refreshSlots(); }
    if (e.code === 'Digit3') { G.player.sel = 2; refreshSlots(); }
    if (e.code === 'KeyR') {
      if (G.restartArm > 0) { UI.el('prompt').classList.add('hidden'); newGame(G.chapter); }
      else { G.restartArm = 2.0; UI.toast('PRESS R AGAIN TO RESTART THIS CHAPTER', 2000); }
    }
    if (e.code === 'KeyM') {
      const mm = UI.el('minimap');
      mm.style.display = mm.style.display === 'none' ? '' : 'none';
    }
  });
  window.addEventListener('keyup', e => {
    G.keys[e.code] = false;
    if (G.mode === 'fnf') FNF.key(e.code, false);
    if (G.mode === 'sans') SansFight.key(e.code, false);
  });

  /* a key held when the window goes away never sends its keyup */
  window.addEventListener('blur', () => { if (SansFight.active) SansFight.blur(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && SansFight.active) SansFight.blur();
  });

  UI.el('padBtn').onclick = () => Math1.submit();
  UI.el('answer').onkeydown = e => {
    if (e.key !== 'Enter') return;
    e.preventDefault(); e.stopPropagation();
    Math1.submit();
  };

  UI.el('startBtn').onclick = () => {
    Audio1.init(); Audio1.resume();
    UI.el('menu').classList.add('hidden');
    showChapterCard(Math.min(G.maxChapter, CHAPTERS.length - 1));
  };
  G.loudScare = true;
  UI.el('loudBtn').onclick = () => {
    G.loudScare = !G.loudScare;
    UI.el('loudBtn').textContent = G.loudScare ? 'OPTIONS' : 'QUIET MODE';
    UI.el('loudWarn').innerHTML = G.loudScare
      ? 'HEADPHONE WARNING — the jumpscare is <b>VERY LOUD</b>'
      : 'Quiet mode on — the jumpscare is toned down. Click OPTIONS to restore.';
    Audio1.init(); Audio1.resume();
    Audio1.tone(G.loudScare ? 880 : 440, 0.12, 0.10, 'square');
  };
  UI.el('selectBtn').onclick = () => {
    Audio1.init(); Audio1.resume();
    UI.el('menu').classList.add('hidden');
    buildChapterList();
    UI.el('chapters').classList.remove('hidden');
  };
  UI.el('modeBtn').onclick = () => {
    Audio1.init(); Audio1.resume();
    UI.el('menu').classList.add('hidden');
    UI.el('modeSelect').classList.remove('hidden');
  };
  UI.el('modeSelBack').onclick = () => {
    UI.el('modeSelect').classList.add('hidden');
    UI.el('menu').classList.remove('hidden');
  };
  UI.el('mcCustom').onclick = () => {
    UI.el('modeSelect').classList.add('hidden');
    buildRoster();
    UI.el('modeScreen').classList.remove('hidden');
  };
  const launchMode = pred => {
    Audio1.init(); Audio1.resume();
    UI.el('modeSelect').classList.add('hidden');
    UI.el('loading').classList.remove('hidden');
    const idx = CHAPTERS.findIndex(pred);
    setTimeout(() => newGame(idx), 40);
  };
  UI.el('confCheat').onclick = () => { Confiscate.grabAll(); };
  const setStyle = st => {
    G.musicStyle = st;
    DJAudio.style = st;
    UI.el('msOrig').classList.toggle('on', st === 'orig');
    UI.el('msRock').classList.toggle('on', st === 'rock');
    Audio1.init(); Audio1.resume();
    Audio1.tone(st === 'rock' ? 110 : 660, 0.12, 0.10, st === 'rock' ? 'sawtooth' : 'square');
  };
  UI.el('msOrig').onclick = () => setStyle('orig');
  UI.el('msRock').onclick = () => setStyle('rock');
  UI.el('mcCamp').onclick = () => launchMode(c => c.campaign);
  UI.el('mcConf').onclick = () => launchMode(c => c.confiscate);
  UI.el('mcFnf').onclick = () => FNF.open();
  UI.el('mcSans').onclick = () => SansFight.open();
  UI.el('modeBack').onclick = () => {
    UI.el('modeScreen').classList.add('hidden');
    UI.el('modeSelect').classList.remove('hidden');
  };
  UI.el('modeNone').onclick = () => { for (const r of ROSTER) G.customCounts[r.key] = 0; refreshRoster(); };
  UI.el('modeOne').onclick  = () => { for (const r of ROSTER) G.customCounts[r.key] = 1; refreshRoster(); };
  UI.el('modeMax').onclick  = () => { for (const r of ROSTER) G.customCounts[r.key] = ROSTER_MAX; refreshRoster(); };
  UI.el('modeStart').onclick = () => {
    UI.el('modeScreen').classList.add('hidden');
    UI.el('loading').classList.remove('hidden');
    const idx = CHAPTERS.findIndex(c => c.custom);
    setTimeout(() => newGame(idx), 40);
  };
  UI.el('chapBack').onclick = () => {
    UI.el('chapters').classList.add('hidden');
    UI.el('menu').classList.remove('hidden');
  };
  UI.el('ccBtn').onclick = () => {
    UI.el('chapterCard').classList.add('hidden');
    UI.el('loading').classList.remove('hidden');
    setTimeout(() => newGame(G.pendingChapter), 40);
  };
  UI.el('retryBtn').onclick = () => { UI.el('gameover').classList.add('hidden'); newGame(G.chapter); };
  UI.el('goMenu').onclick = () => { UI.el('gameover').classList.add('hidden'); returnToTitle(); };
  UI.el('ceNext').onclick = () => {
    UI.el('chapterEnd').classList.add('hidden');
    const nxt = Math.min(G.chapter + 1, CHAPTERS.length - 1);
    showChapterCard(nxt);
  };
  UI.el('ceMenu').onclick = () => { UI.el('chapterEnd').classList.add('hidden'); toChapterSelect(); };
  UI.el('winBtn').onclick = () => { UI.el('win').classList.add('hidden'); toChapterSelect(); };
}
function toChapterSelect() {
  G.running = false;
  UI.el('hud').classList.add('hidden');
  Audio1.stopAmbient(); Audio1.sweepLoop(false);
  buildChapterList();
  UI.el('chapters').classList.remove('hidden');
}

/* ---------------------------------------------------------------- player */
function applyCamera() {
  const p = G.player;
  const eye = 4.15 + Math.sin(G.bobPhase || 0) * 0.12 * p.bob;
  G.camera.position.set(p.x, eye, p.z);
  G.camera.rotation.order = 'YXZ';
  G.camera.rotation.y = p.yaw;
  G.camera.rotation.x = p.pitch;
  G.camera.rotation.z = Math.sin(G.bobPhase || 0) * 0.011 * p.bob + (G.shake || 0) * (Math.random() - 0.5);
}

function updatePlayer(dt) {
  const p = G.player, k = G.keys;
  if (G.mode !== 'play') { p.running = false; applyCamera(); return; }

  p.stuck = Math.max(0, (p.stuck || 0) - dt);
  UI.el('stuckOverlay').style.opacity = p.stuck > 0 ? 0.9 : 0;

  /* turning from the keyboard — always available */
  if (k['KeyQ']) p.yaw += dt * 2.1;
  if (k['KeyE']) p.yaw -= dt * 2.1;
  /* and without a pointer lock the mouse eventually hits the side of the
     window, so the outer sixth of the screen keeps the turn going */
  if (lockDenied && curIn) {
    const edge = 0.17;
    if (curX < edge) p.yaw += dt * 2.3 * Math.pow((edge - curX) / edge, 1.5);
    else if (curX > 1 - edge) p.yaw -= dt * 2.3 * Math.pow((curX - (1 - edge)) / edge, 1.5);
  }
  if (k['KeyR'] && !k['ShiftLeft']) p.pitch = lerp(p.pitch, 0, 1 - Math.exp(-dt * 8));

  let fx = 0, fz = 0;
  if (!p.stuck) {
    if (k['KeyW'] || k['ArrowUp']) fz += 1;
    if (k['KeyS'] || k['ArrowDown']) fz -= 1;
    if (k['KeyA'] || k['ArrowLeft']) fx -= 1;
    if (k['KeyD'] || k['ArrowRight']) fx += 1;
  }
  const len = Math.hypot(fx, fz);
  if (len > 0) { fx /= len; fz /= len; }

  p.energy = Math.max(0, (p.energy || 0) - dt);
  const wantRun = (k['ShiftLeft'] || k['ShiftRight']) && len > 0;
  const canRun = p.energy > 0 || (p.stamina > 0 && p.staminaLock <= 0);
  p.running = wantRun && canRun;

  /* walking through one of Weird Baldi's clouds slows you right down */
  const gas = 1 - clamp(G.gasHit || 0, 0, 1) * 0.42;
  const speed = (p.running ? 13.4 : 8.2) * (G.loadFactor || 1) * gas;
  if (p.running && p.energy <= 0) {
    p.stamina -= dt * 26;
    if (p.stamina <= 0) { p.stamina = 0; p.staminaLock = 1.6; p.running = false; }
  } else if (p.energy > 0) p.stamina = 100;
  else {
    p.staminaLock = Math.max(0, p.staminaLock - dt);
    if (p.staminaLock <= 0) p.stamina = Math.min(100, p.stamina + dt * (len > 0 ? 12 : 22));
  }
  p.brokeRule = p.running ? 1.2 : Math.max(0, (p.brokeRule || 0) - dt);

  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
  const dx = (fx * cy - fz * sy) * speed * dt;
  const dz = (-fx * sy - fz * cy) * speed * dt;

  const R = 0.92;
  // Safety net: if we've somehow ended up overlapping a desk, a crate or a
  // wall (a teleport, a shove, a barricade closing), slide straight back out
  // instead of freezing on the spot.
  if (blockedAt(p.x, p.z, R) || blockedByProp(p.x, p.z, R)) {
    const free = freeSpotNear(p.x, p.z, R, 12);
    p.x = free.x; p.z = free.z;
  }
  const nx = p.x + dx, nz = p.z + dz;
  if (!blockedAt(nx, p.z, R) && !blockedByProp(nx, p.z, R)) p.x = nx;
  if (!blockedAt(p.x, nz, R) && !blockedByProp(p.x, nz, R)) p.z = nz;

  for (const bu of ((G.lists && G.lists.bully) || [])) {
    if (bu.state !== 'block') continue;
    const d = Math.hypot(p.x - bu.x, p.z - bu.z);
    if (d < 1.9) {
      const a = Math.atan2(p.x - bu.x, p.z - bu.z);
      p.x = bu.x + Math.sin(a) * 1.9; p.z = bu.z + Math.cos(a) * 1.9;
    }
  }

  const moved = Math.hypot(dx, dz);
  p.stepAcc += moved;
  if (p.stepAcc > (p.running ? 3.4 : 4.2)) { p.stepAcc = 0; Audio1.footstep(p.running ? 1.3 : 1); }
  p.bob = lerp(p.bob, moved > 0.001 ? 1 : 0, 1 - Math.exp(-dt * 8));
  G.bobPhase = (G.bobPhase || 0) + moved * (p.running ? 1.5 : 1.15);

  applyCamera();

  UI.el('staminaBar').style.width = (p.energy > 0 ? 100 : p.stamina) + '%';
  UI.el('staminaWrap').className = p.energy > 0 ? '' : (p.stamina < 18 ? 'empty' : (p.stamina < 45 ? 'low' : ''));

  const c = worldToCell(p.x, p.z);
  for (let y = c.y - 6; y <= c.y + 6; y++) for (let x = c.x - 6; x <= c.x + 6; x++) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
    if ((x - c.x) * (x - c.x) + (y - c.y) * (y - c.y) > 40) continue;
    G.seenCells[y * MW + x] = 1;
  }

  checkPickups();
  checkExits();
}

function checkPickups() {
  const p = G.player;
  for (const n of G.nbList) {
    if (n.taken) continue;
    n.mesh.rotation.y += 0.02;
    n.mesh.position.y = 1.9 + Math.sin(G.time * 2.4) * 0.16;
    if (Math.hypot(n.x - p.x, n.z - p.z) < 2.8) {
      n.taken = true; G.scene.remove(n.mesh);
      Audio1.pickup(); Math1.open(G.notebooks);
      return;
    }
  }
  for (let i = G.groundItems.length - 1; i >= 0; i--) {
    const it = G.groundItems[i];
    it.mesh.rotation.y += 0.03;
    it.mesh.position.y = 1.1 + Math.sin(G.time * 3 + i) * 0.12;
    if (Math.hypot(it.x - p.x, it.z - p.z) < 2.4) {
      if (giveItem(it.kind)) { G.scene.remove(it.mesh); G.groundItems.splice(i, 1); }
    }
  }
  const pr = UI.el('prompt');
  let shown = false;
  // looking at a notebook you can't quite walk into
  for (const n of G.nbList) {
    if (n.taken) continue;
    if (distToPlayer(n.x, n.z) < 8 && playerSees(n.x, n.z, 0.5)) {
      pr.classList.remove('hidden'); shown = true;
      pr.textContent = 'PRESS E TO TAKE THE NOTEBOOK';
      break;
    }
  }
  const m = nearestMachine();
  if (!shown) {
  if (m && distToPlayer(m.x, m.z) < 4.2) {
    pr.classList.remove('hidden'); shown = true;
    pr.textContent = p.items.indexOf('quarter') >= 0
      ? 'Select the QUARTER and press E — buy a BSODA'
      : 'BSODA MACHINE — needs a quarter';
  }
  }
  // locked barricade hint
  if (!shown) {
    for (const g of Map1.gates) {
      if (g.zone <= G.unlockedZones) continue;
      if (Math.hypot(g.wx - p.x, g.wz - p.z) < 4.0) {
        pr.classList.remove('hidden'); shown = true;
        pr.textContent = 'CLOSED — this wing opens in Chapter ' + g.zone;
        break;
      }
    }
  }
  if (!shown) pr.classList.add('hidden');

  if (G.alarmProp) {
    G.alarmProp.t -= 1 / 60;
    G.alarmProp.m.rotation.z = Math.sin(G.time * 40) * 0.25;
    if (G.alarmProp.t <= 0) { G.scene.remove(G.alarmProp.m); G.alarmProp = null; }
  }
}

function checkExits() {
  if (G.friendlyBaldi) return;          // the field trip has its own objectives
  const p = G.player;
  const ch = CHAPTERS[G.chapter];
  for (const e of Map1.exits) {
    if (e.zone > G.unlockedZones) continue;
    if (Math.hypot(e.wx - p.x, e.wz - p.z) > 3.2) { e.near = false; continue; }
    if (G.notebooks < G.total) {
      UI.el('prompt').classList.remove('hidden');
      UI.el('prompt').textContent = 'LOCKED — collect all notebooks first (' +
        G.notebooks + '/' + G.total + ')';
      return;
    }
    if (ch.allExits) {
      if (!e.used) {
        e.used = true; G.exitsReached++;
        UI.el('exitTag').textContent = 'EXITS ' + G.exitsReached + '/4';
        Audio1.correct();
        if (G.exitsReached >= 4) { chapterCleared(); return; }
        UI.say('Exit ' + G.exitsReached + ' of 4. Keep going!', 3000);
        // bounce the player back inside so they must run to the next one
        const back = e.dir === 'S' ? [0, -4] : e.dir === 'N' ? [0, 4] : e.dir === 'W' ? [4, 0] : [-4, 0];
        p.x += back[0]; p.z += back[1];
        for (const b of baldis()) b.anger += 1.2;
        updateAngerBar();
      }
    } else { chapterCleared(); return; }
  }
}

/* ---------------------------------------------------------------- endings */
function chapterCleared() {
  if (G.mode === 'win' || G.mode === 'chapterend') return;
  G.running = false;
  Audio1.stopAmbient(); Audio1.sweepLoop(false); Music.stop(true); Audio1.winFanfare();
  document.exitPointerLock && document.exitPointerLock();
  UI.el('hud').classList.add('hidden');
  const chNow = CHAPTERS[G.chapter];
  if (!chNow.custom) {
    G.maxChapter = Math.max(G.maxChapter, Math.min(G.chapter + 1, CHAPTERS.length - 2));
  }

  if (chNow.custom) {
    G.mode = 'win';
    const total = ROSTER.reduce((n, r) => n + (G.customCounts[r.key] || 0), 0);
    UI.el('winSub').innerHTML =
      'You got out with <b>' + total + '</b> character' + (total === 1 ? '' : 's') +
      ' in the school.<br>Time: <b>' + fmtTime(G.elapsed) + '</b>' +
      ' &nbsp;·&nbsp; Wrong answers: ' + G.wrongs;
    UI.el('win').classList.remove('hidden');
  } else if (G.chapter >= CHAPTERS.length - 2) {
    G.mode = 'win';
    UI.el('winSub').innerHTML =
      'You cleared every chapter of Here School.<br>' +
      'Final exam time: <b>' + fmtTime(G.elapsed) + '</b> &nbsp;·&nbsp; Wrong answers: ' + G.wrongs +
      ' &nbsp;·&nbsp; Detentions: ' + G.detentions + '<br>' +
      '<span style="color:#9f9">Baldi is still in there somewhere.</span>';
    UI.el('win').classList.remove('hidden');
  } else {
    G.mode = 'chapterend';
    const nxt = CHAPTERS[G.chapter + 1];
    UI.el('ceSub').innerHTML =
      CHAPTERS[G.chapter].name + ' cleared in <b>' + fmtTime(G.elapsed) + '</b>.<br>' +
      'Wrong answers: ' + G.wrongs + ' &nbsp;·&nbsp; Detentions: ' + G.detentions + '<br><br>' +
      '<span style="color:#ffe14d">NEXT: CHAPTER ' + nxt.n + ' — ' + nxt.name + '</span><br>' +
      '<span style="font-size:15px;color:#bcd">' + nxt.sub + '</span>';
    UI.el('chapterEnd').classList.remove('hidden');
  }
}

function returnToTitle() {
  G.running = false; G.paused = false; G.mode = 'menu';
  G.friendlyBaldi = false; Campaign.active = false; G.loadFactor = 1;
  Audio1.forestAmbient(false);
  UI.el('fade').classList.remove('on'); UI.el('fadeText').textContent = '';
  UI.el('objBar').classList.add('hidden');
  UI.el('win').querySelector('h2').textContent = 'YOU GRADUATED!';
  Audio1.stopAmbient(); Audio1.sweepLoop(false); Music.stop(true);
  document.exitPointerLock && document.exitPointerLock();
  ['hud', 'gameover', 'win', 'chapterEnd', 'chapterCard', 'chapters', 'detention',
   'pauseHint', 'mathPad', 'ropeUI', 'dialogue', 'loading', 'modeSelect', 'modeScreen',
   'objBar', 'djSkip'].forEach(id => UI.el(id).classList.add('hidden'));
  DJ.active = false; DJAudio.stop(); Confiscate.stop();
  UI.el('djTitle').classList.remove('on'); UI.el('lyric').textContent = '';
  UI.el('prompt').classList.add('hidden');
  UI.el('subtitle').style.opacity = 0;
  UI.el('toast').style.opacity = 0;
  UI.el('menu').classList.remove('hidden');
}

function caught(who) {
  if (G.mode === 'over') return;
  G.mode = 'over'; G.running = false;
  Audio1.stopAmbient(); Audio1.sweepLoop(false); Music.stop(true);
  document.exitPointerLock && document.exitPointerLock();
  ['hud', 'mathPad', 'ropeUI', 'dialogue', 'detention', 'pauseHint', 'objBar']
    .forEach(id => UI.el(id).classList.add('hidden'));

  const b = who || nearestBaldi() || G.ents.baldi, bm = b.model, p = G.player;

  /* --- he is simply THERE, filling the screen, on the very first frame --- */
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  b.x = p.x + fx * 2.0; b.z = p.z + fz * 2.0;
  bm.root.position.set(b.x, 0, b.z);
  bm.root.rotation.set(0, Math.atan2(p.x - b.x, p.z - b.z), 0);
  bm.setMood(3); bm.mood = 3; bm.anger = 1;
  bm.slapT = 0;
  for (let i = 0; i < 30; i++) bm.update(0.05, { speed: 0, anger: 1 });   // settle into full rage

  const oldPix = PIXSCALE;
  PIXSCALE = 5.0; resize();
  G.scene.fog = null;                       // nothing may tint or hide him
  G.scene.background = new THREE.Color(0x000000);
  G.renderer.setClearColor(0x000000);
  const glare = new THREE.PointLight(0xfff2e2, 1.15, 26);
  const fill = new THREE.AmbientLight(0xffffff, 0.40);
  G.scene.add(glare); G.scene.add(fill);

  Audio1.jumpscare(G.loudScare !== false);

  // no coloured overlay of any kind — the face IS the jumpscare
  const flash = UI.el('jumpFlash');
  flash.style.transition = 'none';
  flash.style.background = '#fff';
  flash.style.opacity = '0';

  const headPos = new THREE.Vector3();
  const startT = performance.now();
  const HOLD = 1.7;

  const step = () => {
    const t = (performance.now() - startT) / 1000;
    G0.t += 0.016;

    bm.mood = 3;
    bm.update(0.016, { speed: 0, anger: 1 });
    bm.eyeL.pupilG.position.x = bm.eyeR.pupilG.position.x = 0;
    bm.eyeL.pupilG.position.y = bm.eyeR.pupilG.position.y = 0;
    bm.head.getWorldPosition(headPos);

    // already in your face on frame one, then creeping closer
    const dist = 2.88 - Math.min(t, HOLD) * 0.20;
    const dir = new THREE.Vector3(Math.sin(bm.root.rotation.y), 0, Math.cos(bm.root.rotation.y));
    const aim = headPos.clone(); aim.y -= 0.10;
    G.camera.position.copy(headPos).addScaledVector(dir, dist);
    G.camera.position.y = headPos.y - 0.04;
    G.camera.lookAt(aim);

    const sh = t < 0.25 ? 0.11 : (t < 0.7 ? 0.06 : 0.03);
    G.camera.rotation.z += (Math.random() - 0.5) * sh * 2.0;
    G.camera.rotation.x += (Math.random() - 0.5) * sh;
    G.camera.rotation.y += (Math.random() - 0.5) * sh;
    G.camera.position.x += (Math.random() - 0.5) * sh * 0.35;
    G.camera.position.y += (Math.random() - 0.5) * sh * 0.35;

    G.camera.fov = 74 + Math.sin(t * 40) * 2.0;
    G.camera.updateProjectionMatrix();

    // one hard white blink on impact — after that it is nothing but his face
    flash.style.opacity = '0';

    G.renderer.render(G.scene, G.camera);

    if (t < HOLD) requestAnimationFrame(step);
    else {
      flash.style.opacity = '0';
      G.scene.remove(glare); G.scene.remove(fill);
      PIXSCALE = oldPix; resize();
      G.camera.fov = 72; G.camera.updateProjectionMatrix();
      returnToTitle();
    }
  };
  step();
}
function fmtTime(s) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return m + ':' + (r < 10 ? '0' : '') + r;
}

function revealAround() {
  if (!G.seenCells) return;
  const c = worldToCell(G.player.x, G.player.z);
  for (let y = c.y - 6; y <= c.y + 6; y++) for (let x = c.x - 6; x <= c.x + 6; x++) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
    if ((x - c.x) * (x - c.x) + (y - c.y) * (y - c.y) > 40) continue;
    G.seenCells[y * MW + x] = 1;
  }
}

/* ---------------------------------------------------------------- minimap */
function drawMinimap() {
  if (!mmCtx) return;
  const x = mmCtx, S = 3, W = MW * S, H = MH * S;
  x.clearRect(0, 0, W, H);
  x.fillStyle = '#0d120d'; x.fillRect(0, 0, W, H);
  for (let cy = 0; cy < MH; cy++) for (let cx = 0; cx < MW; cx++) {
    if (!G.seenCells[cy * MW + cx]) continue;
    const v = Map1.at(cx, cy);
    const F = Map1.forest;
    if (v === W_WALL) {
      if (F && F.water[cy * MW + cx]) { x.fillStyle = '#2d5f86'; x.fillRect(cx * S, cy * S, S, S); }
      else if (F) { x.fillStyle = '#1c3a1c'; x.fillRect(cx * S, cy * S, S, S); }
      continue;
    }
    if (F) { x.fillStyle = '#59824c'; x.fillRect(cx * S, cy * S, S, S); continue; }
    if (Map1.locked(cx, cy)) { x.fillStyle = '#8a7220'; x.fillRect(cx * S, cy * S, S, S); continue; }
    x.fillStyle = v === W_ROOM ? '#4e6b4a' : (v === W_EXIT ? '#3ad14f' : '#93a58c');
    x.fillRect(cx * S, cy * S, S, S);
  }
  for (const n of G.nbList) {
    if (n.taken || !G.seenCells[n.cell.y * MW + n.cell.x]) continue;
    x.fillStyle = '#ffe14d'; x.fillRect(n.cell.x * S - 1, n.cell.y * S - 1, S + 2, S + 2);
  }
  for (const e of Map1.exits) {
    if (e.zone > G.unlockedZones) continue;
    x.fillStyle = e.used ? '#2a6b34' : (G.notebooks >= G.total ? '#5cff7a' : '#c0392b');
    x.fillRect(e.x * S - 1, e.y * S - 1, S + 3, S + 2);
  }
  const b = nearestBaldi();
  if (b && b.awake && CHAPTERS[G.chapter].warn) {
    const c = worldToCell(b.x, b.z);
    x.fillStyle = (Math.floor(G.time * 4) % 2) ? '#ff3b3b' : '#8b1a1a';
    x.fillRect(c.x * S - 1, c.y * S - 1, S + 2, S + 2);
  }
  const p = worldToCell(G.player.x, G.player.z);
  x.fillStyle = '#4db8ff';
  x.fillRect(p.x * S - 1, p.y * S - 1, S + 2, S + 2);
  x.strokeStyle = '#4db8ff'; x.lineWidth = 1.5;
  x.beginPath();
  x.moveTo(p.x * S + 1.5, p.y * S + 1.5);
  x.lineTo(p.x * S + 1.5 - Math.sin(G.player.yaw) * 7, p.y * S + 1.5 - Math.cos(G.player.yaw) * 7);
  x.stroke();
}

/* ---------------------------------------------------------------- loop */
let lastT = performance.now();
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  let dt = (now - lastT) / 1000;
  lastT = now;
  dt = Math.min(dt, 0.05);
  G0.t += dt;

  if (G.mode === 'fnf') { FNF.update(dt); return; }
  if (G.mode === 'sans') { SansFight.update(dt); return; }
  if (G.mode === 'dj') {
    DJ.update(dt);
    if (DJ.active && DJ.scene) {
      const sz = G.renderer.getSize(new THREE.Vector2());
      DJ.camera.aspect = sz.x / sz.y;
      DJ.camera.updateProjectionMatrix();
      G.renderer.render(DJ.scene, DJ.camera);
    }
    return;
  }
  if (G.mode === 'cut') {
    /* a scripted fade — no player, no pausing, just the clock running out */
    if (Confiscate.active) Confiscate.update(dt);
    if (G.scene) G.renderer.render(G.scene, G.camera);
    return;
  }
  if (!G.running) {
    if (!UI.el('menu').classList.contains('hidden')) { updateMenuScene(dt); return; }
    if (G.scene) G.renderer.render(G.scene, G.camera);
    return;
  }
  if (!G.scene) return;
  if (G.paused && G.mode === 'play') { G.renderer.render(G.scene, G.camera); return; }

  G.time += dt;
  if (G.mode === 'play') G.elapsed += dt;
  UI.tick(dt);
  Math1.tickFace(dt);
  G.shake = Math.max(0, (G.shake || 0) - dt * 0.4);
  G.restartArm = Math.max(0, (G.restartArm || 0) - dt);

  // chalk-dust blindness
  G.blind = Math.max(0, G.blind - dt);
  UI.el('blindOverlay').style.opacity = G.blind > 0 ? clamp(G.blind / 1.2, 0, 0.94) : 0;

  revealAround();
  if (Map1.forestLOD) updateForestLOD(G.player.x, G.player.z);
  if (G.mode === 'intro') {
    Intro.update(dt);
    applyCamera();
    updateDoors(dt);
    drawMinimap();
    G.renderer.render(G.scene, G.camera);
    return;
  }

  if (G.mode === 'detention') {
    G.detTime -= dt;
    UI.el('detTime').textContent = Math.max(0, Math.ceil(G.detTime));
    if (G.detTime <= 0) {
      UI.el('detention').classList.add('hidden');
      G.mode = 'play'; resumeLock();
      UI.say('You may go. Watch your step.', 2400);
    }
  }
  if (G.mode === 'rope') updateRope(dt);

  updatePlayer(dt);
  updateDoors(dt);
  updateBaldi(dt);
  updatePrincipal(dt);
  updatePlaytime(dt);
  updateBully(dt);
  updateSweep(dt);
  updateCrafters(dt);
  updatePrize(dt);
  updateChalkles(dt);
  updateCloudy(dt);
  updateBeans(dt);
  updateWeird(dt);
  updateGas(dt);
  updateGums(dt);
  updateJets(dt);
  if (Campaign.active) Campaign.update(dt);
  if (Confiscate.active) Confiscate.update(dt);

  const b = nearestBaldi();
  if (b && b.awake && G.scene.fog && G.mode === 'play' && !G.friendlyBaldi) {
    const ch = CHAPTERS[G.chapter];
    const d = distToPlayer(b.x, b.z);
    const t = clamp(1 - d / 55, 0, 1);
    const farBase = ch.dark ? 60 : 96, farNear = ch.dark ? 32 : 46;
    G.scene.fog.far = lerp(farBase, farNear, t * angerNorm());
    const col = new THREE.Color(ch.dark ? 0x05060a : 0x0a0d09).lerp(new THREE.Color(0x2a0606), t * 0.6);
    G.scene.fog.color.copy(col);
    G.scene.background.copy(col);
  }

  drawMinimap();
  G.renderer.render(G.scene, G.camera);
}

/* ---------------------------------------------------------------- boot */
function boot() {
  initMats();
  buildTextures();
  initRenderer();
  initInput();
  buildMenuScene();
  drawBaldiFace(UI.el('goFace'));
  frame();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

