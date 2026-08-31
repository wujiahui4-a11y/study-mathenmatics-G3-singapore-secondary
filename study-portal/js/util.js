/* Study Portal — shared helpers (math, rng, ids, audio) */
window.SA = window.SA || {};
(function (SA) {
  'use strict';

  SA.CFG = {
    TILE: 64,
    COLS: 50,
    ROWS: 38,
    PLAYER_R: 17,
    BASE_HP: 100,
    BASE_SPEED: 235,
    BASE_DMG: 17,
    BASE_FIRE_DELAY: 0.33,
    BULLET_SPEED: 620,
    BULLET_LIFE: 1.15,
    BULLET_R: 5,
    RESPAWN_TIME: 3,
    SNAP_HZ: 15,
    INPUT_HZ: 20,
    PICK_TIME: 12,
    MAX_LEVEL: 12
  };
  SA.CFG.WORLD_W = SA.CFG.COLS * SA.CFG.TILE;
  SA.CFG.WORLD_H = SA.CFG.ROWS * SA.CFG.TILE;

  SA.COLORS = [
    '#4d8bff', '#ff5f5f', '#39d98a', '#ffb020', '#c47bff',
    '#00cfd1', '#ff7ac0', '#9ad34a', '#ff8a3d', '#7f8cff'
  ];

  SA.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  SA.lerp = function (a, b, t) { return a + (b - a) * t; };
  SA.dist = function (ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); };
  SA.dist2 = function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
  SA.now = function () { return performance.now() / 1000; };

  SA.angLerp = function (a, b, t) {
    var d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  };

  /* deterministic rng so every peer builds the same map from the room code */
  SA.rng = function (seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  SA.hash = function (str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  var CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alike characters
  SA.roomCode = function () {
    var out = '';
    var buf = new Uint8Array(6);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (var i = 0; i < 6; i++) out += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
    return out;
  };

  SA.uid = function () {
    return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
  };

  SA.pickRandom = function (arr, rnd) { return arr[Math.floor((rnd || Math.random)() * arr.length)]; };

  SA.BOT_NAMES = ['Alex', 'Mia', 'Ravi', 'Chen', 'Zara', 'Leo', 'Nur', 'Kai', 'Ivy', 'Tom',
    'Sara', 'Deng', 'Ana', 'Yuki', 'Omar', 'Elle'];

  /* ------------------------------------------------------------------ audio
     Everything is synthesised, so the page stays a single small download. */
  SA.Sound = (function () {
    var ctx = null, enabled = false, master = null;

    function ensure() {
      if (ctx) return ctx;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
      return ctx;
    }

    function blip(freq, dur, type, vol, slideTo) {
      if (!enabled) return;
      var c = ensure(); if (!c) return;
      if (c.state === 'suspended') c.resume();
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, c.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), c.currentTime + dur);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(vol || 0.25, c.currentTime + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(c.currentTime + dur + 0.02);
    }

    function noise(dur, vol, freq) {
      if (!enabled) return;
      var c = ensure(); if (!c) return;
      var len = Math.floor(c.sampleRate * dur);
      var buf = c.createBuffer(1, len, c.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = c.createBufferSource(); src.buffer = buf;
      var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 900;
      var g = c.createGain(); g.gain.value = vol || 0.3;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    }

    return {
      set: function (on) { enabled = !!on; if (on) ensure(); },
      isOn: function () { return enabled; },
      shoot: function () { blip(620, 0.07, 'square', 0.09, 260); },
      hit: function () { blip(320, 0.05, 'sawtooth', 0.08, 180); },
      hurt: function () { blip(180, 0.14, 'sawtooth', 0.14, 90); },
      kill: function () { blip(740, 0.1, 'square', 0.16, 980); setTimeout(function () { blip(980, 0.12, 'square', 0.14, 1240); }, 80); },
      levelup: function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { blip(f, 0.16, 'triangle', 0.17); }, i * 85); }); },
      explode: function () { noise(0.45, 0.4, 620); },
      dash: function () { blip(300, 0.16, 'sine', 0.12, 780); },
      pickup: function () { blip(880, 0.09, 'triangle', 0.14, 1180); }
    };
  })();

})(window.SA);
