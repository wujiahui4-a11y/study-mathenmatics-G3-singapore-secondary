/* =======================================================================
   GOJO — AWAKENING
   A meter that fills while you fight, an entrance when it breaks, and a
   different Gojo on the other side of it: blindfold off, six eyes lit,
   cursed energy standing off him, and the four techniques he does not
   bother with until somebody is worth it.

     1  LAPSE: BLUE              a point of attraction, then the collapse
     2  REVERSAL: RED            repulsion, thrown forward as a wall
     3  HOLLOW PURPLE            blue into red, and everything between
     4  DOMAIN: UNLIMITED VOID   too much information to move against

   The meter, the entrance and all four techniques are shared over the
   network by mp.js, so the other screens see the same fight.

   The entrance plays Final Encore (the full version sitting on main).
   The thirty-four seconds of the awakened kit stay that long — the song
   is three minutes and a bit, which is not a fight — and it fades when
   the meter runs out, when he goes down, or when the last awakened Gojo
   in the room drops the state.

   The track sits on that Gojo. Anyone close enough hears it, louder the
   closer they are, and from the side he is standing on. Walk away and it
   falls off; walk back in and it is still the same song, not a restart.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX) return;

  var AW = window.JJAW = {
    charge: 0, max: 100, ready: false,
    active: false, t: 0, dur: 34,
    cine: false, ct: 0, cineStage: 0,
    aura: null, orbs: null,
    gain: gain, awaken: awaken, isAwake: function () { return AW.active; },
    setLook: setLook, remote: remoteAwaken, theme: theme
  };

  /* how much a hit is worth: taking one is worth more than landing one,
     which is what keeps a losing fight interesting */
  var GAIN_DEALT = .55, GAIN_TAKEN = .95, GAIN_IDLE = 1.15;

  /* ----------------------------------------------------------- the song */
  var SONG_FILE = 'Final_Encore_Full_Version.mp3';
  var SONG_HOST = 'https://raw.githubusercontent.com/wujiahui4-a11y/' +
    'study-mathenmatics-G3-singapore-secondary/main/Final_Encore_Full_Version.mp3';
  var SONG_VOL = .62;
  /* full volume inside this, silent past this. the domain is thirty-four
     metres, so anyone standing in it can still hear him */
  var HEAR_NEAR = 8, HEAR_FAR = 48;
  var songEl = null, songIds = {}, songFade = 0, songTriedHost = false, songArmed = false;
  var songGraph = null, songWant = 0;

  function songUrl() {
    var href = '';
    try { href = String(location.href || ''); } catch (e) {}
    if (/googleusercontent|script\.google|^about:|^blob:/i.test(href)) return SONG_HOST;
    try {
      if (/\/jujutsu-parts\//.test(href)) return new URL('../' + SONG_FILE, href).href;
      return new URL(SONG_FILE, href).href;
    } catch (e) {
      return SONG_FILE;
    }
  }

  function ensureSong() {
    if (songEl) return songEl;
    var a = new Audio();
    a.preload = 'auto';
    a.loop = false;
    a.crossOrigin = 'anonymous';
    a.volume = 1;
    a.src = songUrl();
    a.addEventListener('error', function () {
      if (songTriedHost) return;
      songTriedHost = true;
      a.src = SONG_HOST;
      a.load();
      if (Object.keys(songIds).length) {
        var p = a.play();
        if (p && p.catch) p.catch(function () {});
      }
    });
    songEl = a;
    attachSong(a);
    return a;
  }

  /* the element is the clock; the graph puts it on him in the world */
  function attachSong(a) {
    if (songGraph) return songGraph;
    var ac = null;
    try { ac = audio(); } catch (e) {}
    if (!ac) return null;
    try {
      var src = ac.createMediaElementSource(a);
      var gain = ac.createGain();
      var panner = ac.createPanner();
      panner.panningModel = 'equalpower';
      panner.distanceModel = 'linear';
      panner.refDistance = 1000;
      panner.maxDistance = 10000;
      panner.rolloffFactor = 0;
      panner.coneInnerAngle = 360;
      gain.gain.value = 0;
      src.connect(panner);
      panner.connect(gain);
      gain.connect(ac.destination);
      songGraph = { ac: ac, src: src, gain: gain, panner: panner };
    } catch (e) {
      songGraph = null;
    }
    return songGraph;
  }

  function armSong() {
    if (songArmed) return;
    songArmed = true;
    try { audio(); } catch (e) {}
    ensureSong();
  }
  window.addEventListener('pointerdown', armSong);
  window.addEventListener('keydown', armSong);

  function playSong(restart) {
    var a = ensureSong();
    attachSong(a);
    songFade = 0;
    if (restart) {
      try { a.pause(); } catch (e) {}
      try { a.currentTime = 0; } catch (e) {}
    }
    if (a.paused) {
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    }
  }

  function fadeSong() {
    if (!songEl || songEl.paused) return;
    songFade = 1;
  }

  function hearGain(dist) {
    if (dist <= HEAR_NEAR) return 1;
    if (dist >= HEAR_FAR) return 0;
    return 1 - (dist - HEAR_NEAR) / (HEAR_FAR - HEAR_NEAR);
  }

  function songSource() {
    var best = null, bestD = 1e9, pos, d;
    if (songIds.local && (AW.cine || AW.active) && player && player.pos) {
      return { pos: player.pos, dist: 0, id: 'local' };
    }
    var fs = window.MPJJ && window.MPJJ.fighters;
    if (fs) {
      for (var id in songIds) {
        if (id === 'local') continue;
        var f = fs[id];
        if (!f || !f.e || !f.e.pos) continue;
        pos = f.e.pos;
        d = player.pos.distanceTo(pos);
        if (d < bestD) { bestD = d; best = { pos: pos, dist: d, id: id }; }
      }
    }
    return best;
  }

  function setListener(ac, from) {
    var l = ac.listener;
    var p = player.pos;
    var fx = Math.sin(player.facing), fz = Math.cos(player.facing);
    if (l.positionX) {
      l.positionX.value = p.x;
      l.positionY.value = p.y + 3.4;
      l.positionZ.value = p.z;
      l.forwardX.value = fx;
      l.forwardY.value = 0;
      l.forwardZ.value = fz;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else if (l.setPosition) {
      l.setPosition(p.x, p.y + 3.4, p.z);
      l.setOrientation(fx, 0, fz, 0, 1, 0);
    }
    if (!from || !songGraph || !songGraph.panner) return;
    var pan = songGraph.panner;
    var x = from.x, y = from.y + 3.2, z = from.z;
    if (pan.positionX) {
      pan.positionX.value = x;
      pan.positionY.value = y;
      pan.positionZ.value = z;
    } else if (pan.setPosition) {
      pan.setPosition(x, y, z);
    }
  }

  function stepSong(dt) {
    var src = Object.keys(songIds).length ? songSource() : null;
    var want = 0;
    if (songFade) {
      songWant = Math.max(0, songWant - dt * .9);
      want = songWant;
      if (want <= .02) {
        try { songEl.pause(); songEl.currentTime = 0; } catch (e) {}
        songFade = 0;
        songWant = 0;
        want = 0;
      }
    } else if (src) {
      want = SONG_VOL * hearGain(src.dist);
      songWant = want;
      if (songEl && songEl.paused && want > 0.01) playSong(false);
    } else {
      want = 0;
      songWant = 0;
    }
    if (songGraph && songGraph.gain) {
      songGraph.gain.gain.value = want;
      if (songGraph.ac && src) setListener(songGraph.ac, src.pos);
    } else if (songEl) {
      songEl.volume = Math.max(0, Math.min(1, want));
    }
  }

  /* on: a Gojo in the room just started the entrance. off: that Gojo
     is no longer awakened. A new entrance restarts the track so the
     cut lands on the first beat; walking into range of one that is
     already running does not. */
  function theme(on, id) {
    id = id || 'local';
    if (on) {
      var first = !songIds[id];
      songIds[id] = 1;
      if (first) playSong(true);
      else playSong(false);
    } else {
      delete songIds[id];
      if (!Object.keys(songIds).length) fadeSong();
    }
  }

  AW.hearGain = hearGain;
  AW.songSource = songSource;
  AW.HEAR_NEAR = HEAR_NEAR;
  AW.HEAR_FAR = HEAR_FAR;
  AW.debugHear = function () {
    var src = songSource();
    var g = songGraph && songGraph.gain ? songGraph.gain.gain.value
      : (songEl ? songEl.volume : 0);
    return {
      ids: Object.keys(songIds),
      src: src ? { id: src.id, dist: +src.dist.toFixed(2), x: src.pos.x, z: src.pos.z } : null,
      hear: src ? hearGain(src.dist) : 0,
      vol: +g.toFixed(3),
      t: songEl ? +songEl.currentTime.toFixed(2) : 0,
      paused: !songEl || songEl.paused
    };
  };

  /* ------------------------------------------------------------ the look */
  function findBlindfold(rig) {
    if (!rig || !rig.head || rig.blindfold) return;
    rig.head.children.forEach(function (c) {
      var p = c.geometry && c.geometry.parameters;
      if (p && Math.abs(p.width - .96) < 1e-6 && Math.abs(c.position.y - .58) < 1e-6) rig.blindfold = c;
    });
  }

  function addSixEyes(rig) {
    if (!rig || !rig.head || rig.sixEyes) return;
    var g = new THREE.Group();
    [-1, 1].forEach(function (s) {
      var e = new THREE.Mesh(new THREE.BoxGeometry(.24, .13, .06),
        new THREE.MeshBasicMaterial({ color: 0xbdefff, toneMapped: false }));
      e.position.set(s * .21, .57, .47);
      e.rotation.z = -s * .08;
      g.add(e);
      var iris = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .07),
        new THREE.MeshBasicMaterial({ color: 0x2ea8ff, toneMapped: false }));
      iris.position.set(s * .21, .57, .48);
      g.add(iris);
      var glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: FX.T.star, color: 0x5cc8ff, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
      }));
      glow.scale.setScalar(1.25);
      glow.position.set(s * .21, .57, .52);
      g.add(glow);
    });
    g.visible = false;
    rig.head.add(g);
    rig.sixEyes = g;
  }

  /* blindfold off, eyes lit — or back again */
  function setLook(rig, on) {
    if (!rig || !rig.head) return;
    findBlindfold(rig);
    if (!rig.blindfold && !rig.sixEyes) return;      // not a Gojo
    addSixEyes(rig);
    if (rig.blindfold) rig.blindfold.visible = !on;
    if (rig.sixEyes) rig.sixEyes.visible = !!on;
  }

  /* every Gojo rig built from here on is ready to be awakened */
  var _makeAnimeRig = makeAnimeRig;
  makeAnimeRig = function (cfg) {
    var r = _makeAnimeRig(cfg);
    if (cfg && cfg.gojo) { findBlindfold(r); addSixEyes(r); }
    return r;
  };

  /* ------------------------------------------------------------- the bar */
  var bar = null;
  function buildBar() {
    if (bar) return;
    var css = document.createElement('style');
    css.textContent = [
      '#jjAwake{position:fixed;left:50%;bottom:124px;transform:translateX(-50%);width:300px;',
      '  z-index:9;pointer-events:none;font-family:"Finger Paint","Segoe UI",cursive;display:none}',
      '#jjAwake .row{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:3px}',
      '#jjAwake .lbl{font-size:10px;letter-spacing:4px;color:#dce9ff;text-shadow:0 1px 4px #000}',
      '#jjAwake .hint{font-size:10px;letter-spacing:2px;color:#8fa4c8;text-shadow:0 1px 4px #000}',
      '#jjAwake .track{height:9px;border:1.5px solid #fff;border-radius:4px;background:rgba(0,0,0,.42);',
      '  overflow:hidden;position:relative}',
      '#jjAwake .fill{height:100%;width:0%;background:linear-gradient(90deg,#1f4bd8,#5aa8ff 60%,#dff0ff);',
      '  transition:width .12s linear}',
      '#jjAwake .pips{position:absolute;inset:0;background:repeating-linear-gradient(90deg,',
      '  rgba(0,0,0,0) 0 28px, rgba(0,0,0,.45) 28px 30px)}',
      '#jjAwake.ready .hint{color:#fff;animation:jjAwPulse .85s infinite}',
      '#jjAwake.ready .track{border-color:#bfe4ff;box-shadow:0 0 16px #3a7dff,0 0 40px rgba(58,125,255,.6)}',
      '#jjAwake.ready .fill{background:linear-gradient(90deg,#7fd0ff,#fff 60%,#7fd0ff);',
      '  animation:jjAwSheen 1.1s infinite}',
      '#jjAwake.on .lbl{color:#fff}',
      '#jjAwake.on .track{border-color:#e6d4ff;box-shadow:0 0 18px #8b5cff,0 0 44px rgba(139,92,255,.55)}',
      '#jjAwake.on .fill{background:linear-gradient(90deg,#4a1fd8,#9b6bff 55%,#f0e4ff)}',
      '@keyframes jjAwPulse{50%{opacity:.25}}',
      '@keyframes jjAwSheen{50%{filter:brightness(1.45)}}',
      /* the entrance card */
      '#jjAwCard{position:fixed;left:0;right:0;top:31%;text-align:center;z-index:15;pointer-events:none;',
      '  font-family:"Finger Paint","Segoe UI",cursive;opacity:0}',
      '#jjAwCard.on{opacity:1}',
      '#jjAwCard .k{font-size:15px;letter-spacing:14px;color:#9fd8ff;text-shadow:0 0 18px #3a7dff}',
      '#jjAwCard .n{font-size:52px;letter-spacing:8px;color:#fff;line-height:1.1;',
      '  text-shadow:0 0 26px #3a7dff,0 0 70px #3a7dff,0 3px 0 #0b1020}',
      '#jjAwCard .s{font-size:13px;letter-spacing:9px;color:#cfe2ff;margin-top:6px;text-shadow:0 1px 6px #000}',
      '#jjAwCard.slam .n{animation:jjSlam .42s cubic-bezier(.15,.9,.2,1)}',
      '@keyframes jjSlam{0%{transform:scale(2.4);opacity:0;filter:blur(9px)}',
      '  60%{transform:scale(.94);opacity:1;filter:blur(0)}100%{transform:scale(1)}}',
      '#jjAwSay{position:fixed;left:0;right:0;bottom:17%;text-align:center;z-index:15;pointer-events:none;',
      '  font-family:"Finger Paint","Segoe UI",cursive;font-size:23px;letter-spacing:2px;color:#fff;',
      '  text-shadow:0 2px 10px #000,0 0 26px rgba(58,125,255,.75);opacity:0;transition:opacity .18s}',
      '#jjAwSay.on{opacity:1}'
    ].join('');
    document.head.appendChild(css);

    bar = document.createElement('div');
    bar.id = 'jjAwake';
    bar.innerHTML = '<div class="row"><span class="lbl">AWAKENING</span>' +
      '<span class="hint">CHARGING</span></div>' +
      '<div class="track"><div class="fill"></div><div class="pips"></div></div>';
    document.body.appendChild(bar);

    var card = document.createElement('div');
    card.id = 'jjAwCard';
    card.innerHTML = '<div class="k">AWAKENING</div><div class="n">GOJO SATORU</div>' +
      '<div class="s">SIX EYES &middot; LIMITLESS</div>';
    document.body.appendChild(card);

    var say = document.createElement('div');
    say.id = 'jjAwSay';
    document.body.appendChild(say);
  }

  function renderBar() {
    buildBar();
    var running = window.JJNAOYA && window.JJNAOYA.busy();
    bar.style.display = started && !running ? 'block' : 'none';
    if (!started || running) return;
    var frac = AW.active ? (1 - AW.t / AW.dur) : (AW.charge / AW.max);
    bar.querySelector('.fill').style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
    bar.classList.toggle('ready', AW.ready && !AW.active);
    bar.classList.toggle('on', AW.active);
    bar.querySelector('.lbl').textContent = AW.active ? 'AWAKENED' : 'AWAKENING';
    bar.querySelector('.hint').textContent = AW.active
      ? Math.ceil(AW.dur - AW.t) + 's'
      : (AW.ready ? 'PRESS F' : Math.floor(AW.charge) + '%');
  }

  function gain(n) {
    if (AW.active || AW.cine) return;
    if (window.JJNAOYA && window.JJNAOYA.busy()) return;
    var was = AW.ready;
    AW.charge = Math.min(AW.max, AW.charge + n);
    AW.ready = AW.charge >= AW.max;
    if (AW.ready && !was) {
      if (window.JJNOTICE) window.JJNOTICE('AWAKENING READY \u2014 PRESS F', '#9fd8ff');
      FX.ring(new THREE.Vector3(player.pos.x, .1, player.pos.z), 0x3a7dff, { maxR: 7, life: .6 });
      try { sfx.raise(); } catch (e) {}
    }
  }

  /* =====================================================================
     THE ENTRANCE
     Three and a half seconds: the pressure drops, the blindfold comes off,
     the energy goes up, the card lands. Untouchable throughout.
     ================================================================== */
  var SAY = [
    { t: .45, s: 'Stand back.' },
    { t: 3.70, s: "Nah, I'd win." }
  ];
  var CINE_DUR = 5.4;

  function awaken() {
    if (!AW.ready || AW.active || AW.cine || player.dead) return;
    if (typeof started !== 'undefined' && !started) return;
    /* the spawn entrance owns the camera, and this one needs it */
    if (window.MPJJ && window.MPJJ.cs && window.MPJJ.cs.active) return;
    /* Naoya's awakening is a run and a finish, not a state to sit in */
    if (player.char === 'naoya') {
      if (window.JJNAOYA && window.JJNAOYA.awaken()) {
        AW.charge = 0; AW.ready = false;
        renderBar();               // his run owns the frame; the bar steps out
      }
      return;
    }
    if (player.char !== 'gojo') return;
    AW.cine = true;
    AW.ct = 0;
    AW.cineStage = 0;
    AW.said = 0;
    AW.charge = 0;
    AW.ready = false;
    player.action = null;
    player.vel.set(0, 0, 0);
    player.iframes = Math.max(player.iframes, 4.4);
    buildBar();
    hud(false);
    FX.letterbox(true);
    FX.flash('#ffffff', .55, .35);
    FX.mangaLines(true, .9);
    document.getElementById('jjAwCard').classList.remove('on', 'slam');
    if (window.MPJJ && window.MPJJ.relay) {
      window.MPJJ.relay.pub({ t: 'cast', id: window.MPJJ.id, k: 'awaken' });
    }
    theme(true, 'local');
  }

  function say(text) {
    var s = document.getElementById('jjAwSay');
    s.textContent = text;
    s.classList.remove('on');
    void s.offsetWidth;
    s.classList.add('on');
  }

  var AN = window.JJANIM;

  /* the camera, given as marks around him rather than absolute points */
  function gshot(t, marks) {
    var i = 0;
    while (i < marks.length - 1 && t >= marks[i + 1].t) i++;
    var a = marks[i], b = marks[Math.min(i + 1, marks.length - 1)];
    var k = b === a ? 0 : FX.ease.out(Math.min(1, Math.max(0, (t - a.t) / Math.max(.001, b.t - a.t))));
    function m(f) { return a[f] + (b[f] - a[f]) * k; }
    var yaw = player.facing + m('yaw'), dist = m('d'), h = m('h'), ly = m('ly');
    var px = player.pos.x + Math.sin(yaw) * dist;
    var pz = player.pos.z + Math.cos(yaw) * dist;
    if (AN) AN.camTo(px, player.pos.y + h, pz, player.pos.x, player.pos.y + ly, player.pos.z, AW.dt || 1 / 60, m('k'));
    else { camera.position.set(px, player.pos.y + h, pz); camera.lookAt(player.pos.x, player.pos.y + ly, player.pos.z); }
    AW.orbit = yaw;
  }

  function stepCine(dt) {
    AW.dt = dt;
    /* the reveal is worth a couple of frames of nothing */
    if (AW.freeze > 0) { AW.freeze -= dt; return; }
    AW.ct += dt;
    var t = AW.ct, p = player, r = p.rig;
    p.vel.set(0, 0, 0);
    p.pos.y = 0;
    p.iframes = Math.max(p.iframes, 1.5);

    while (AW.said < SAY.length && t >= SAY[AW.said].t) say(SAY[AW.said++].s);

    /* ---- the pressure drops ---- */
    if (AW.cineStage < 1) {
      AW.cineStage = 1;
      FX.cracks(p.pos.clone(), 11, 13);
      FX.dust(p.pos.clone(), 9, 0xc3ccdc, 6, 3);
      FX.ring(new THREE.Vector3(p.pos.x, .1, p.pos.z), 0x3a7dff, { maxR: 14, life: .9 });
      FX.tint('#050a18', .3, 2.4);
      addShake(.35);
      if (AN) { AW.sm = AN.smoother(r); AW.sm.snap(); AW.smear = {}; AN.camRelease(); }
    }
    /* everything in the air being drawn in toward him */
    if (t < 2.5 && Math.random() < .85) {
      FX.mote(p.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), 0x6fb4ff, 7 + Math.sin(t * 3) * 3, .45);
    }
    if (t > .7 && t < 2.5 && Math.random() < dt * 9) {
      FX.debris(p.pos.clone().add(new THREE.Vector3((Math.random() - .5) * 9, 0, (Math.random() - .5) * 9)), 1, 5, 0x53596b);
    }

    /* ---- light leaking out from under it ---- */
    if (t >= 1.85 && t < 2.55) {
      var leak = (t - 1.85) / .7;
      if (r.blindfold) {
        r.blindfold.position.y = .58 - leak * .1;
        r.blindfold.rotation.x = leak * .22;
      }
      if (Math.random() < .8) {
        FX.streaks(p.pos.clone().add(new THREE.Vector3((Math.random() - .5) * .9, 4.3, .5)),
          0x9fd8ff, 1, 4 + leak * 8, .7);
      }
      if (Math.random() < .35) {
        FX.ring(p.pos.clone().add(new THREE.Vector3(0, 4.3, .4)), 0x9fd8ff,
          { maxR: .8, from: 4, life: .3, ground: false, opacity: .55 });
      }
    }

    /* ---- off ---- */
    if (AW.cineStage < 2 && t >= 2.55) {
      AW.cineStage = 2;
      setLook(r, true);
      if (r.blindfold) { r.blindfold.position.y = .58; r.blindfold.rotation.x = 0; }
      FX.flash('#ffffff', .95, .32);
      FX.cross(p.pos.clone().add(new THREE.Vector3(0, 4.3, 0)), 0xffffff, 7, .38);
      FX.impact(p.pos.clone().add(new THREE.Vector3(0, 4.3, 0)), 0x9fd8ff, 1.9);
      FX.speedRing(p.pos.clone().add(new THREE.Vector3(0, 4.3, 0)), 0x6fb4ff, 9, .45);
      FX.rings(p.pos.clone().add(new THREE.Vector3(0, 2, 0)), 0x3a7dff, 3, { maxR: 16, life: .6, ground: false });
      FX.debris(p.pos.clone(), 12, 14);
      FX.mangaLines(true, .35);
      addShake(.8);
      AW.freeze = .22;                              // hold the reveal
      if (AN) AN.camKick(1.4);
      try { sfx.frame(); } catch (e) {}
      if (!AW.aura) AW.aura = FX.aura(function () { return player.pos; }, 0x3a7dff);
    }

    /* ---- the column ---- */
    if (AW.cineStage < 3 && t >= 3.45) {
      AW.cineStage = 3;
      FX.beam(p.pos.clone(), new THREE.Vector3(0, 1, 0), 64, 0x4a8dff, { radius: 1.7, life: 1.3 });
      FX.beam(p.pos.clone(), new THREE.Vector3(0, 1, 0), 64, 0xffffff, { radius: .55, life: 1.15 });
      FX.rings(new THREE.Vector3(p.pos.x, .12, p.pos.z), 0x6fb4ff, 4, { maxR: 24, life: .85, gap: 70 });
      FX.debris(p.pos.clone(), 16, 18);
      FX.dust(p.pos.clone(), 12, 0xd6e2f2, 12, 4.5);
      FX.flash('#bfe0ff', .5, .5);
      FX.zoom(-13, .8);
      addShake(1);
      AW.freeze = .12;
      if (AN) AN.camKick(1.1);
      try { sfx.raise(); } catch (e) {}
    }
    if (AW.cineStage < 4 && t >= 4.3) {             // the card
      AW.cineStage = 4;
      document.getElementById('jjAwCard').classList.add('on', 'slam');
      if (AN) AN.camKick(.5);
    }

    /* a steady lift of cursed energy the whole way through */
    if (Math.random() < .55) {
      FX.streaks(p.pos.clone().add(new THREE.Vector3(
        (Math.random() - .5) * 3, .4 + Math.random() * 4.6, (Math.random() - .5) * 3)),
        0x6fb4ff, 1, 6 + (t > 3.45 ? 9 : 0), 1);
    }

    posesCine(r, t);
    if (AN && AW.sm) {
      var e = AW.sm.step(dt);
      AN.life(r, t, .9);
      AN.smear(r, e, AW.smear, dt, 0x6fb4ff, 26);
    }
    r.root.position.copy(p.pos);
    r.root.rotation.y = p.facing;

    if (t >= CINE_DUR) endCine();
  }

  /* Head down, hand to the blindfold, the pull, and then open.

     The version before this one moved an arm and left the rest of the body
     standing to attention, which is what made it read as a mannequin with
     one working joint. Every stage here moves the whole figure: the hips
     take the weight, the shoulders counter the spine, the head leads or
     trails, and each stage dips against itself before it goes. */
  function posesCine(r, t) {
    resetPose(r);
    var E = FX.ease.out, W = AN ? AN.weight : null;

    if (t < .85) {                                  /* holding it in */
      var k = E(t / .85);
      r.spine.rotation.x = .1 + .3 * k;             // curling over
      r.spine.rotation.y = -.06 * k;
      r.neck.rotation.x = .52 * k;
      r.neck.rotation.y = -.1 * k;
      r.shoulderL.rotation.x = -.12 - .22 * k; r.shoulderR.rotation.x = -.12 - .2 * k;
      r.shoulderL.rotation.z = .16 * k; r.shoulderR.rotation.z = -.16 * k;
      r.elbowL.rotation.x = -.24 - .42 * k; r.elbowR.rotation.x = -.24 - .38 * k;
      r.hipL.rotation.x = -.1 * k; r.hipR.rotation.x = -.08 * k;
      r.kneeL.rotation.x = .55 * k; r.kneeR.rotation.x = .48 * k;
      r.ankleL.rotation.x = -.14 * k; r.ankleR.rotation.x = -.12 * k;
      r.hips.position.y = r.hipsBaseY - .55 * k;    // sinking into the ground
      if (W) W(r, -.5 * k, 1);

    } else if (t < 1.85) {                          /* the hand goes up */
      var u = (t - .85) / 1;
      /* it dips before it rises: the anticipation that makes it a movement
         rather than a transition */
      var dip = u < .22 ? Math.sin(u / .22 * Math.PI) : 0;
      var k2 = E(Math.max(0, (u - .12) / .88));
      r.spine.rotation.x = .4 - .5 * k2 + dip * .16;
      r.hips.rotation.y = -.26 * k2;                // hips lag the shoulders
      r.spine.rotation.y = -.06 - .6 * k2;          // torso turns into it
      r.spine.rotation.z = .06 * k2;
      r.neck.rotation.x = .3 - .44 * k2 + dip * .06;
      r.neck.rotation.y = -.1 + .34 * k2;           // head follows the hand
      r.neck.rotation.z = -.1 * k2;
      r.shoulderR.rotation.x = -.32 + .28 * dip - 2.3 * k2;
      r.shoulderR.rotation.z = -.16 - .3 * k2;
      r.elbowR.rotation.x = -.62 + .2 * dip - 1.15 * k2;
      r.shoulderL.rotation.x = -.34 - .34 * k2;     // the other arm counters
      r.shoulderL.rotation.z = .16 + .3 * k2;
      r.elbowL.rotation.x = -.66 - .3 * k2;
      r.hipL.rotation.x = -.1 - .12 * k2; r.hipR.rotation.x = -.08 + .06 * k2;
      r.kneeL.rotation.x = .3 - .12 * k2; r.kneeR.rotation.x = .26 - .18 * k2;
      r.hips.position.y = r.hipsBaseY - .55 + .4 * k2 + dip * -.16;
      if (W) W(r, -.5 + 1 * k2, 1);                 // weight crosses over

    } else if (t < 2.55) {                          /* and pulls */
      var k3 = E((t - 1.85) / .7);
      r.spine.rotation.x = -.06 - .16 * k3;         // chest opens
      r.spine.rotation.y = -.66 + .4 * k3;
      r.hips.rotation.y = -.26 + .34 * k3;
      r.spine.rotation.z = .06 - .04 * k3;
      r.neck.rotation.x = -.14 - .16 * k3;
      r.neck.rotation.y = .24 - .16 * k3;
      r.shoulderR.rotation.x = -2.62 + .3 * k3;     // elbow leads the pull
      r.shoulderR.rotation.z = -.46 + .52 * k3;
      r.elbowR.rotation.x = -1.77 + .22 * k3;
      r.shoulderL.rotation.x = -.68 - .3 * k3;
      r.shoulderL.rotation.z = .46 - .12 * k3;
      r.elbowL.rotation.x = -.96 - .26 * k3;
      r.hipL.rotation.x = -.22 + .16 * k3; r.hipR.rotation.x = -.02 - .14 * k3;
      r.kneeL.rotation.x = .18; r.kneeR.rotation.x = .08;
      r.hips.position.y = r.hipsBaseY - .12 + .06 * k3;
      if (W) W(r, .5 - .9 * k3, 1);                 // and forward onto it

    } else if (t < 3.45) {                          /* it comes off */
      var u4 = (t - 2.55) / .9;
      /* one hard frame first — chin up, chest out, arm thrown wide — so the
         hold has a silhouette worth holding */
      var snap = Math.min(1, u4 / .12);
      var settle = E(Math.max(0, (u4 - .12) / .88));
      r.spine.rotation.x = -.42 * snap + .2 * settle;
      r.spine.rotation.y = -.18 + .18 * settle;
      r.neck.rotation.x = -.72 * snap + .2 * settle;
      r.neck.rotation.y = .08 - .08 * settle;
      r.shoulderR.rotation.x = -2.32 + .5 * snap + 1.2 * settle;
      r.shoulderR.rotation.z = .06 + .5 * snap - .5 * settle;
      r.elbowR.rotation.x = -1.55 + .5 * snap + .74 * settle;
      r.shoulderL.rotation.x = -.98 + .3 * snap + .18 * settle;
      r.shoulderL.rotation.z = .34 - .2 * snap - .1 * settle;
      r.elbowL.rotation.x = -1.22 + .4 * snap + .3 * settle;
      r.hipL.rotation.x = -.06 - .1 * snap; r.hipR.rotation.x = -.16 - .08 * snap;
      r.kneeL.rotation.x = .18 - .14 * snap; r.kneeR.rotation.x = .08 - .06 * snap;
      r.hips.position.y = r.hipsBaseY - .06 + .38 * snap - .16 * settle;
      if (W) W(r, -.45 + .45 * settle, 1);

    } else {                                        /* open */
      var k5 = E(Math.min(1, (t - 3.45) / 1));
      var rise = Math.sin(Math.min(1, (t - 3.45) / 1.4) * Math.PI);
      r.spine.rotation.x = -.12 - .16 * k5;         // arching back
      r.neck.rotation.x = -.34 - .16 * k5;
      r.shoulderR.rotation.x = -.62 - .5 * k5;
      r.shoulderR.rotation.z = .06 - .78 * k5;      // arms thrown open
      r.elbowR.rotation.x = -.81 + .55 * k5;
      r.shoulderL.rotation.x = -.5 - .5 * k5;
      r.shoulderL.rotation.z = .04 + .78 * k5;
      r.elbowL.rotation.x = -.62 + .4 * k5;
      r.hipL.rotation.x = -.16 * k5; r.hipR.rotation.x = -.16 * k5;
      r.kneeL.rotation.x = .04; r.kneeR.rotation.x = .02;
      r.ankleL.rotation.x = .35 * rise; r.ankleR.rotation.x = .35 * rise;
      r.hips.position.y = r.hipsBaseY + .04 + .45 * rise;   // up onto the toes
    }
  }

  /* a cutscene wants the frame to itself */
  function hud(show) {
    ['hud', 'crosshair', 'jjScore', 'jjFeed', 'jjSwap', 'jjAwake', 'jjNotice'].forEach(function (id) {
      var n = document.getElementById(id);
      if (n) n.style.visibility = show ? '' : 'hidden';
    });
  }

  function endCine() {
    AW.cine = false;
    AW.active = true;
    AW.t = 0;
    hud(true);
    FX.letterbox(false);
    document.getElementById('jjAwCard').classList.remove('on');
    document.getElementById('jjAwSay').classList.remove('on');
    setLook(player.rig, true);
    if (!AW.aura) AW.aura = FX.aura(function () { return player.pos; }, 0x3a7dff);
    swapMoves(true);
    player.iframes = Math.max(player.iframes, .6);
    showSplash('AWAKENED', 'SIX EYES \u00b7 LIMITLESS', '#3a7dff');
  }

  /* Naoya's side calls this when his run and its finish are over */
  AW.finish = function () {
    AW.charge = 0;
    AW.ready = false;
    renderBar();
  };

  function endAwake() {
    AW.active = false;
    AW.t = 0;
    AW.charge = 0;
    AW.ready = false;
    if (AW.aura) { AW.aura.stop(); AW.aura = null; }
    setLook(player.rig, false);
    swapMoves(false);
    theme(false, 'local');
    FX.ring(new THREE.Vector3(player.pos.x, .1, player.pos.z), 0x6fb4ff, { maxR: 8, life: .7 });
    if (window.JJNOTICE) window.JJNOTICE('AWAKENING ENDED', '#8fa4c8');
  }

  /* ------------------------------------------------------- the moves bar */
  var BASE_MOVES = null;
  var AW_MOVES = [
    { key: 'LMB', lbl: 'Punch', cd: 'm1', max: .32 },
    { key: 'Q', lbl: 'Dash', cd: 'dash', max: 1 },
    { key: '1', lbl: 'Lapse: Blue', cd: 'awBlue', max: 7 },
    { key: '2', lbl: 'Reversal: Red', cd: 'awRed', max: 9 },
    { key: '3', lbl: 'Hollow Purple', cd: 'awPurple', max: 18 },
    { key: '4', lbl: 'Unlimited Void', cd: 'awDomain', max: 30 },
    { key: 'R', lbl: 'Limitless', cd: 'limitless', max: CD.limitless }
  ];
  function swapMoves(on) {
    if (!BASE_MOVES) BASE_MOVES = CHARS.gojo.moves;
    CHARS.gojo.moves = on ? AW_MOVES : BASE_MOVES;
    CHARS.gojo.sub = on ? 'AWAKENED \u2014 SIX EYES' : 'THE HONORED ONE \u2014 LIMITLESS';
    if (player.char === 'gojo') {
      try { buildMovesBar(); } catch (e) {}
      var sub = document.querySelector('#charCard .sub');
      if (sub) sub.textContent = CHARS.gojo.sub;
    }
  }

  cds.awBlue = 0; cds.awRed = 0; cds.awPurple = 0; cds.awDomain = 0;

  /* =====================================================================
     THE FOUR TECHNIQUES
     ================================================================== */
  function ready(cdKey) {
    return AW.active && !AW.cine && player.char === 'gojo' && !player.dead &&
      !busy() && cds[cdKey] <= 0;
  }
  function start(type, dur, cdKey, cdVal, name, sub) {
    cds[cdKey] = cdVal;
    player.action = { type: type, t: 0, dur: dur, stage: 0 };
    if (name) showSplash(name, sub || '', '#8fb8ff');
    return player.action;
  }
  function handPos(side) {
    var h = side < 0 ? player.rig.handL : player.rig.handR;
    var v = new THREE.Vector3();
    player.rig.root.updateMatrixWorld(true);
    h.getWorldPosition(v);
    return v;
  }
  function aimDir() {
    return new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing)).normalize();
  }
  /* everything that can be hit, us excluded */
  function targets() {
    return enemies.filter(function (e) { return e && !e.dead; });
  }

  /* --------------------------------------------------- 1 · LAPSE: BLUE */
  function castBlue() {
    if (!ready('awBlue')) return;
    start('aw_blue', 1.55, 'awBlue', 7, 'LAPSE: BLUE', 'ATTRACTION');
    try { sfx.whoosh(); } catch (e) {}
  }

  function stepBlue(a, dt) {
    var p = player;
    if (a.t < .38) {                                   // gathering
      if (!a.orb) a.orb = FX.orb(0x2f7bff, 1.05);
      var h = handPos(1);
      a.orb.set(h);
      a.orb.step(dt, .35 + a.t / .38 * .65);
      if (Math.random() < .9) FX.mote(h, 0x59a8ff, 4.5, .28);
      return;
    }
    if (!a.fired) {                                    // released
      a.fired = 1;
      a.dir = aimDir();
      a.pos = handPos(1).add(a.dir.clone().multiplyScalar(1.2));
      FX.speedRing(a.pos.clone(), 0x59a8ff, 6, .3);
      FX.cross(a.pos.clone(), 0x9fd8ff, 3, .22);
      addShake(.2);
    }
    if (a.done) return;

    /* it drifts forward and drags everything in with it */
    a.pos.addScaledVector(a.dir, 21 * dt);
    a.orb.set(a.pos);
    a.orb.step(dt, 1);
    if (Math.random() < .85) FX.mote(a.pos.clone(), 0x8fd0ff, 7.5, .3);
    /* the space around a point of attraction folds toward it */
    if (Math.random() < .5) {
      FX.ring(a.pos.clone(), 0x59a8ff, { maxR: .6, from: 7, life: .32, ground: false, opacity: .8 });
    }

    a.pull = (a.pull || 0) + dt;
    var list = targets(), i, e, d, dist;
    for (i = 0; i < list.length; i++) {
      e = list[i];
      d = a.pos.clone().sub(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)));
      dist = d.length();
      if (dist > 19) continue;
      d.normalize();
      /* knockback pointing at the orb is a pull, and it travels to the
         other clients as an ordinary hit, so they get dragged too */
      if (a.pull > .22) {
        e.damage(2, d.clone().multiplyScalar(15 + (1 - dist / 19) * 13),
          { react: 'pummel', reactDur: .3, noFrameBonus: true, spark: 0x59a8ff });
      }
    }
    if (a.pull > .22) a.pull = 0;

    var hit = null;
    for (i = 0; i < list.length; i++) {
      if (list[i].pos.clone().add(new THREE.Vector3(0, 2.4, 0)).distanceTo(a.pos) < 3.1) { hit = list[i]; break; }
    }
    if (hit || a.t > 1.32) collapseBlue(a);
  }

  function collapseBlue(a) {
    if (a.done) return;
    a.done = 1;
    var at = a.pos.clone();
    if (a.orb) { a.orb.dispose(); a.orb = null; }
    /* everything falls in, then the point lets go */
    FX.flash('#cfe4ff', .3, .25);
    FX.cross(at, 0x9fd8ff, 6, .28);
    FX.impact(at, 0x59a8ff, 2.2);
    FX.rings(at, 0x2f7bff, 3, { maxR: 17, life: .55, ground: false, gap: 45 });
    FX.ring(new THREE.Vector3(at.x, .1, at.z), 0x59a8ff, { maxR: 16, life: .6 });
    FX.dust(new THREE.Vector3(at.x, 0, at.z), 9, 0xd2ddef, 10, 3.4);
    FX.debris(new THREE.Vector3(at.x, 0, at.z), 9, 14);
    FX.zoom(9, .4);
    addShake(.7);
    hitstop(.07);
    try { sfx.hit(); } catch (e) {}

    targets().forEach(function (e) {
      var c = e.pos.clone().add(new THREE.Vector3(0, 2.4, 0));
      var dist = c.distanceTo(at);
      if (dist > 15) return;
      var away = c.sub(at).normalize().multiplyScalar(24 * (1.2 - dist / 15 * .7));
      away.y = Math.max(away.y, 13);
      e.damage(26 * (1.15 - dist / 15 * .45), away,
        { react: 'gut', reactDur: .55, spark: 0x59a8ff, side: 1 });
    });
  }

  /* ---------------------------------------------- 2 · REVERSAL: RED */
  function castRedMax() {
    if (!ready('awRed')) return;
    start('aw_red', 1.35, 'awRed', 9, 'REVERSAL: RED', 'REPULSION');
    try { sfx.whoosh(); } catch (e) {}
  }

  function stepRedMax(a, dt) {
    if (a.t < .45) {                                   // winding up
      if (!a.orb) a.orb = FX.orb(0xff3b4d, 1.25);
      var h = handPos(-1);
      a.orb.set(h);
      a.orb.step(dt, .3 + a.t / .45 * .7);
      if (Math.random() < .95) FX.mote(h, 0xff6270, 5.5, .26);
      if (Math.random() < .3) FX.streaks(h, 0xff8a94, 1, 6, .8);
      return;
    }
    if (!a.fired) {
      a.fired = 1;
      a.dir = aimDir();
      a.from = handPos(-1).add(a.dir.clone().multiplyScalar(1.4));
      if (a.orb) { a.orb.dispose(); a.orb = null; }

      /* a wall of repulsion thrown forward: a front that keeps going,
         rather than one ball getting bigger */
      FX.wave(a.from, a.dir, 0xff3b4d, { steps: 6, r0: 9, grow: 2.4, reach: 5.5 });
      FX.cross(a.from.clone(), 0xffb3ba, 7, .3);
      FX.impact(a.from.clone(), 0xff3b4d, 2.4);
      FX.speedRing(a.from.clone(), 0xff6270, 11, .35);
      FX.flash('#ffd9dd', .32, .3);
      FX.mangaLines(true, .3);
      FX.zoom(11, .45);
      FX.cracks(player.pos.clone().addScaledVector(a.dir, 6), 8, 15);
      FX.dust(player.pos.clone().addScaledVector(a.dir, 4), 10, 0xe4d3d6, 13, 3.6);
      FX.debris(player.pos.clone().addScaledVector(a.dir, 7), 12, 17);
      addShake(1);
      hitstop(.08);
      try { sfx.hit(); } catch (e) {}

      /* everything in the cone in front is thrown */
      targets().forEach(function (e) {
        var to = e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)).sub(a.from);
        var along = to.dot(a.dir);
        if (along < -1 || along > 30) return;
        var side = to.clone().addScaledVector(a.dir, -along).length();
        if (side > 4.5 + along * .32) return;
        var kb = a.dir.clone().multiplyScalar(46 - along * .5);
        kb.y = 19;
        e.damage(34 - along * .35, kb, { react: 'stagger', reactDur: .7, spark: 0xff3b4d });
      });
    }
  }

  /* ---------------------------------------------- 3 · HOLLOW PURPLE */
  function castPurple() {
    if (!ready('awPurple')) return;
    start('aw_purple', 2.75, 'awPurple', 18, 'HOLLOW PURPLE', 'IMAGINARY MASS');
    FX.letterbox(true);
    FX.tint('#1a0b2e', .3, 2.6);
    try { sfx.raise(); } catch (e) {}
  }

  function stepPurple(a, dt) {
    var t = a.t;
    /* 0.00 – 0.85  blue in one hand, red in the other */
    if (t < .85) {
      if (!a.blue) { a.blue = FX.orb(0x2f7bff, .95); a.red = FX.orb(0xff3b4d, .95); }
      var L = handPos(-1), R = handPos(1);
      a.blue.set(L); a.red.set(R);
      var e = .3 + t / .85 * .7;
      a.blue.step(dt, e); a.red.step(dt, e);
      if (Math.random() < .9) { FX.mote(L, 0x59a8ff, 5, .26); FX.mote(R, 0xff6270, 5, .26); }
      if (a.stage < 1) { a.stage = 1; FX.zoom(-7, .8); }
      return;
    }
    /* 0.85 – 1.35  they are brought together */
    if (t < 1.35) {
      var k = (t - .85) / .5;
      var mid = handPos(-1).lerp(handPos(1), .5).add(aimDir().clone().multiplyScalar(1.1 * k));
      var spin = k * 14;
      var off = new THREE.Vector3(Math.cos(spin), Math.sin(spin) * .6, Math.sin(spin))
        .multiplyScalar(1.5 * (1 - k) + .18);
      a.blue.set(mid.clone().add(off));
      a.red.set(mid.clone().sub(off));
      a.blue.step(dt, 1); a.red.step(dt, 1);
      FX.mote(mid, 0x9b4dff, 5.5, .22);
      if (Math.random() < .4) FX.streaks(mid, 0xc39bff, 1, 9, 1);
      addShake(.12);
      return;
    }
    /* 1.35  the two cancel into something that should not exist */
    if (a.stage < 2) {
      a.stage = 2;
      var m = handPos(-1).lerp(handPos(1), .5).add(aimDir().clone().multiplyScalar(1.6));
      a.blue.dispose(); a.red.dispose();
      a.blue = a.red = null;
      a.core = FX.orb(0x9b4dff, 1.9);
      a.core.set(m);
      a.mid = m;
      FX.flash('#e6d4ff', .55, .3);
      FX.cross(m, 0xd9b3ff, 8, .35);
      FX.rings(m, 0x9b4dff, 3, { maxR: 13, life: .5, ground: false, gap: 40 });
      FX.zoom(-14, .5);
      addShake(.8);
      hitstop(.12);
      try { sfx.frame(); } catch (e) {}
      return;
    }
    /* 1.35 – 1.75  it is held, barely */
    if (t < 1.75) {
      a.mid = handPos(-1).lerp(handPos(1), .5).add(aimDir().clone().multiplyScalar(1.6));
      a.core.set(a.mid);
      a.core.step(dt, 1 + (t - 1.35) * .8);
      FX.mote(a.mid, 0xc39bff, 7, .2);
      addShake(.25);
      return;
    }
    /* 1.75  fired */
    if (a.stage < 3) {
      a.stage = 3;
      var dir = aimDir();
      var from = a.mid.clone();
      var LEN = 120;
      a.core.dispose(); a.core = null;

      FX.beam(from, dir, LEN, 0x9b4dff, { radius: 3.6, life: 1.05 });
      FX.beam(from, dir, LEN, 0xffffff, { radius: 1.25, life: .95 });
      beamShot(dir);                     // step aside and watch it go
      FX.flash('#f2e6ff', .85, .5);
      FX.mangaLines(true, .55);
      FX.zoom(16, .6);
      addShake(1.6);
      hitstop(.14);
      try { sfx.hit(); } catch (e) {}

      /* scorch the ground it passed over */
      for (var i = 0; i < 14; i++) {
        var at = from.clone().addScaledVector(dir, 5 + i * 7);
        (function (at, i) {
          setTimeout(function () {
            FX.ring(new THREE.Vector3(at.x, .1, at.z), 0x9b4dff, { maxR: 11, life: .55 });
            FX.cracks(new THREE.Vector3(at.x, 0, at.z), 4, 9, 0x2a1240);
            FX.dust(new THREE.Vector3(at.x, 0, at.z), 4, 0xcdbde4, 9, 3.4);
            if (i % 3 === 0) FX.debris(new THREE.Vector3(at.x, 0, at.z), 5, 16);
          }, i * 16);
        })(at, i);
      }

      /* anything on the line is erased */
      targets().forEach(function (e) {
        var to = e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)).sub(from);
        var along = to.dot(dir);
        if (along < -2 || along > LEN) return;
        if (to.clone().addScaledVector(dir, -along).length() > 6.2) return;
        var kb = dir.clone().multiplyScalar(52);
        kb.y = 24;
        e.damage(72, kb, { react: 'stagger', reactDur: .9, spark: 0x9b4dff });
        FX.heavyHit(e.pos.clone().add(new THREE.Vector3(0, 2.8, 0)), 0x9b4dff, 1.7);
      });
      FX.letterbox(false);
    }
  }

  /* ------------------------------------- 4 · DOMAIN: UNLIMITED VOID */
  var DOM = { r: 34, lock: 2.3, life: 5.2 };
  function castDomain() {
    if (!ready('awDomain')) return;
    start('aw_domain', 3.1, 'awDomain', 30, 'DOMAIN EXPANSION', 'UNLIMITED VOID');
    FX.letterbox(true);
    try { sfx.raise(); } catch (e) {}
  }

  function stepDomain(a, dt) {
    var t = a.t, p = player;
    if (t < .75) {                                    // the sign
      if (a.stage < 1) {
        a.stage = 1;
        FX.tint('#05060f', .55, 3);
        FX.converge(p.pos.clone().add(new THREE.Vector3(0, 3, 0)), 0x6fb4ff, 22, 12, .6);
        FX.zoom(-9, .8);
      }
      if (Math.random() < .7) FX.mote(p.pos.clone().add(new THREE.Vector3(0, 3, 0)), 0x8fd0ff, 9, .45);
      return;
    }
    if (a.stage < 2) {                                // it opens
      a.stage = 2;
      a.center = p.pos.clone();
      FX.dome(new THREE.Vector3(a.center.x, 1, a.center.z), DOM.r, 0xbfd8ff, DOM.life);
      FX.flash('#ffffff', .95, .6);
      FX.rings(new THREE.Vector3(a.center.x, .15, a.center.z), 0xdfefff, 4, { maxR: DOM.r * 1.1, life: .8, gap: 60 });
      FX.cracks(a.center.clone(), 14, 24, 0x0b1024);
      FX.debris(a.center.clone(), 16, 15);
      FX.zoom(18, .8);
      addShake(1.4);
      hitstop(.16);
      try { sfx.frame(); } catch (e) {}
      if (window.MPJJ && window.MPJJ.relay) {
        window.MPJJ.relay.pub({ t: 'dom', id: window.MPJJ.id, k: 'void',
          x: Math.round(a.center.x * 10) / 10, z: Math.round(a.center.z * 10) / 10,
          y: Math.round(player.facing * 100) / 100,
          r: DOM.r, d: DOM.lock, dur: 8.2 });
      }
      /* everything inside is held still and fed more than it can take */
      targets().forEach(function (e) {
        if (e.pos.distanceTo(a.center) > DOM.r) return;
        e.stunT = Math.max(e.stunT || 0, DOM.lock);
        e.lockT = Math.max(e.lockT || 0, DOM.lock);
        e.damage(20, null, { react: 'pummel', reactDur: DOM.lock, spark: 0xbfd8ff, noFrameBonus: true });
      });
      a.tick = 0;
      return;
    }
    /* held open: information keeps arriving */
    a.tick = (a.tick || 0) + dt;
    if (a.tick > .42) {
      a.tick = 0;
      targets().forEach(function (e) {
        if (e.pos.distanceTo(a.center) > DOM.r) return;
        e.stunT = Math.max(e.stunT || 0, .5);
        e.damage(5, null, { react: 'pummel', reactDur: .35, noFrameBonus: true, spark: 0xbfd8ff });
        FX.streaks(e.pos.clone().add(new THREE.Vector3(0, 3, 0)), 0xbfd8ff, 2, 8, .9);
      });
    }
    if (Math.random() < .8) {
      var a2 = Math.random() * Math.PI * 2, rr = Math.random() * DOM.r;
      FX.streaks(new THREE.Vector3(a.center.x + Math.cos(a2) * rr, .5 + Math.random() * 14, a.center.z + Math.sin(a2) * rr),
        0x9fd8ff, 1, 5, 1.1);
    }
    if (t > 2.9) FX.letterbox(false);
  }

  /* ---------------------------------------- caught inside somebody's domain
     The domain is opened on the caster's screen; this is what it does to
     everyone else's. Being held is an action, so movement and casting are
     already locked out and the pose travels to the other clients. */
  function enterVoid(dur) {
    if (player.dead || AW.cine) return;
    player.action = { type: 'void', t: 0, dur: dur, stage: 0 };
    player.vel.set(0, 0, 0);
    FX.tint('#060a18', .62, dur + .4);
    FX.flash('#ffffff', .8, .5);
    FX.mangaLines(true, .4);
    FX.zoom(-10, .7);
    addShake(.9);
    showSplash('UNLIMITED VOID', 'TOO MUCH TO PROCESS', '#bfd8ff');
    if (window.JJNOTICE) window.JJNOTICE('CAUGHT IN A DOMAIN', '#bfd8ff');
  }
  AW.enterVoid = enterVoid;

  function stepVoid(a, dt) {
    player.vel.x *= .02; player.vel.z *= .02;
    a.tick = (a.tick || 0) + dt;
    if (Math.random() < .9) {
      FX.streaks(player.pos.clone().add(new THREE.Vector3(
        (Math.random() - .5) * 5, .4 + Math.random() * 5.5, (Math.random() - .5) * 5)),
        0xbfd8ff, 1, 6, 1.1);
    }
    if (a.tick > .3) {
      a.tick = 0;
      FX.ring(player.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), 0x9fd8ff,
        { maxR: .8, from: 9, life: .4, ground: false, opacity: .55 });
    }
  }

  /* =====================================================================
     WIRING
     ================================================================== */
  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    switch (a.type) {
      case 'aw_blue': return stepBlue(a, dt);
      case 'aw_red': return stepRedMax(a, dt);
      case 'aw_purple': return stepPurple(a, dt);
      case 'aw_domain': return stepDomain(a, dt);
      case 'void': return stepVoid(a, dt);
    }
    return _stepAction(a, dt);
  };

  /* poses for the four, so they read from the outside too */
  var _poseAction = poseAction;
  poseAction = function (r, a) {
    var k = Math.min(1, a.t / a.dur), E = FX.ease.out;
    switch (a.type) {
      case 'aw_blue': {
        resetPose(r);
        var g = a.t < .38 ? E(a.t / .38) : 1;
        r.shoulderR.rotation.x = -1.15 - .75 * g;
        r.shoulderR.rotation.z = -.32 * g;
        r.elbowR.rotation.x = -.5 + .42 * g;
        r.shoulderL.rotation.x = -.4 - .25 * g;
        r.elbowL.rotation.x = -.9;
        r.spine.rotation.y = -.3 * g;
        r.neck.rotation.y = .18 * g;
        if (a.t > .38) { r.spine.rotation.x = -.12; r.hips.position.y = r.hipsBaseY - .06; }
        return;
      }
      case 'aw_red': {
        resetPose(r);
        var w = a.t < .45 ? E(a.t / .45) : 1;
        var push = a.t >= .45 ? E(Math.min(1, (a.t - .45) / .18)) : 0;
        r.shoulderL.rotation.x = -.6 - 1.05 * w + .35 * push;
        r.shoulderL.rotation.z = .45 * w - .35 * push;
        r.elbowL.rotation.x = -1.35 * w + 1.2 * push;
        r.shoulderR.rotation.x = -.3 - .3 * w;
        r.elbowR.rotation.x = -1.1 * w;
        r.spine.rotation.y = .42 * w - .7 * push;
        r.spine.rotation.x = .12 * w - .2 * push;
        r.hipL.rotation.x = -.25 * push;
        r.hips.position.y = r.hipsBaseY - .2 * w + .1 * push;
        player.visYaw = -.2 * w + .35 * push;
        return;
      }
      case 'aw_purple': {
        resetPose(r);
        if (a.t < .85) {                       // hands apart, holding both
          var o = E(a.t / .85);
          r.shoulderL.rotation.x = -1.35 * o; r.shoulderL.rotation.z = .8 * o;
          r.shoulderR.rotation.x = -1.35 * o; r.shoulderR.rotation.z = -.8 * o;
          r.elbowL.rotation.x = -.5 * o; r.elbowR.rotation.x = -.5 * o;
          r.spine.rotation.x = -.1 * o;
          r.neck.rotation.x = -.12 * o;
        } else if (a.t < 1.75) {               // brought together in front
          var c = E((a.t - .85) / .9);
          r.shoulderL.rotation.x = -1.35 - .35 * c; r.shoulderL.rotation.z = .8 - .62 * c;
          r.shoulderR.rotation.x = -1.35 - .35 * c; r.shoulderR.rotation.z = -.8 + .62 * c;
          r.elbowL.rotation.x = -.5 - .35 * c; r.elbowR.rotation.x = -.5 - .35 * c;
          r.spine.rotation.x = -.1 - .12 * c;
          r.hips.position.y = r.hipsBaseY - .18 * c;
          r.kneeL.rotation.x = .3 * c; r.kneeR.rotation.x = .3 * c;
        } else {                               // the shove
          var f = E(Math.min(1, (a.t - 1.75) / .2));
          r.shoulderL.rotation.x = -1.7 + .25 * f; r.shoulderL.rotation.z = .18 - .1 * f;
          r.shoulderR.rotation.x = -1.7 + .25 * f; r.shoulderR.rotation.z = -.18 + .1 * f;
          r.elbowL.rotation.x = -.85 + .8 * f; r.elbowR.rotation.x = -.85 + .8 * f;
          r.spine.rotation.x = -.22 + .3 * f;
          r.hips.position.y = r.hipsBaseY - .18 + .18 * f;
          r.kneeL.rotation.x = .3 - .2 * f; r.kneeR.rotation.x = .3 - .2 * f;
        }
        return;
      }
      case 'awakening': {
        /* what the other clients play while somebody is taking the
           blindfold off in front of them */
        posesCine(r, a.t);
        return;
      }
      case 'void': {
        /* held upright by information, arms slack, head back */
        resetPose(r);
        var v = Math.min(1, a.t * 5);
        var tr = Math.sin(a.t * 27) * .035 * v;
        r.neck.rotation.x = -.62 * v + tr;
        r.spine.rotation.x = -.2 * v;
        r.spine.rotation.z = tr;
        r.shoulderL.rotation.x = .38 * v; r.shoulderR.rotation.x = .38 * v;
        r.shoulderL.rotation.z = -.3 * v; r.shoulderR.rotation.z = .3 * v;
        r.elbowL.rotation.x = -.22 * v; r.elbowR.rotation.x = -.22 * v;
        r.hipL.rotation.x = .1 * v; r.hipR.rotation.x = -.1 * v;
        r.kneeL.rotation.x = .3 * v; r.kneeR.rotation.x = .26 * v;
        r.hips.position.y = r.hipsBaseY + .22 * v;      // lifted off the floor
        return;
      }
      case 'aw_domain': {
        resetPose(r);
        var s = a.t < .75 ? E(a.t / .75) : 1;
        var open = a.t >= .75 ? E(Math.min(1, (a.t - .75) / .35)) : 0;
        /* the sign: both hands together at the chest, then thrown open */
        r.shoulderL.rotation.x = -1.5 * s + .2 * open;
        r.shoulderR.rotation.x = -1.5 * s + .2 * open;
        r.shoulderL.rotation.z = .55 * s - 1.15 * open;
        r.shoulderR.rotation.z = -.55 * s + 1.15 * open;
        r.elbowL.rotation.x = -1.5 * s + 1.25 * open;
        r.elbowR.rotation.x = -1.5 * s + 1.25 * open;
        r.neck.rotation.x = .15 * s - .55 * open;
        r.spine.rotation.x = .12 * s - .28 * open;
        r.hips.position.y = r.hipsBaseY - .22 * s + .3 * open;
        return;
      }
    }
    return _poseAction(r, a);
  };

  /* the awakened Gojo has a different 1-4; R and the punch are unchanged */
  var _castRed = castRed, _castRapid = castRapid, _castTwofold = castTwofold, _castPalm = castPalm;
  castRed = function () { return AW.active ? castBlue() : _castRed(); };
  castRapid = function () { return AW.active ? castRedMax() : _castRapid(); };
  castTwofold = function () { return AW.active ? castPurple() : _castTwofold(); };
  castPalm = function () { return AW.active ? castDomain() : _castPalm(); };

  window.addEventListener('keydown', function (e) {
    if (e.code !== 'KeyF' || e.repeat || !started) return;
    awaken();
  });

  /* the menu lists the controls, so it should list these too */
  function listControls() {
    var box = document.querySelector('#menu .controls');
    if (!box) return;
    var add = document.createElement('div');
    add.style.cssText = 'margin-top:7px;padding-top:7px;border-top:1px solid rgba(120,160,255,.25)';
    add.innerHTML =
      '<span class="cn" style="color:#c7a6ff">AWAKENED GOJO</span> &mdash; <b>F</b> awaken when the bar fills ' +
      '&nbsp;&middot;&nbsp; <b>1</b> Lapse: Blue &nbsp;&middot;&nbsp; <b>2</b> Reversal: Red ' +
      '&nbsp;&middot;&nbsp; <b>3</b> Hollow Purple &nbsp;&middot;&nbsp; <b>4</b> Unlimited Void<br>' +
      '<b>C</b> takes 8 seconds out of combat &mdash; getting hit starts the wait again';
    box.appendChild(add);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', listControls);
  else listControls();

  /* An interrupted technique — knocked out of it, killed, framed — would
     otherwise leave its orbs hanging in the air. */
  var held = null;
  function cleanup(a) {
    ['orb', 'blue', 'red', 'core'].forEach(function (k) {
      if (a[k] && a[k].dispose) { a[k].dispose(); a[k] = null; }
    });
    /* Purple and the domain put the bars up on the way in and take them down
       on the way out; being knocked out of one in between would leave them */
    FX.letterbox(false);
    FX.tint('#000000', 0);
  }

  /* --------------------------------------------------------- per frame */
  var _updatePlayer = updatePlayer;
  updatePlayer = function (dt) {
    if (AW.cine) { stepSong(dt); renderBar(); return; } // the entrance owns the frame
    _updatePlayer(dt);
    if (held && held !== player.action) { cleanup(held); held = null; }
    if (player.action && player.action.type.indexOf('aw_') === 0) held = player.action;
    if (AW.active) {
      AW.t += dt;
      /* awakened Gojo recovers faster and dashes more often */
      player.hp = Math.min(player.maxHp, player.hp + dt * 2.6);
      player.dashCh = Math.min(2, player.dashCh + dt / 1.5);
      if (AW.t >= AW.dur) endAwake();
    } else if (player.char === 'gojo' && !player.dead) {
      gain(GAIN_IDLE * dt);
    }
    stepSong(dt);
    renderBar();
  };

  /* A beam fired straight away from a chase camera is a bright dot. For the
     second it is alive the camera steps out to one side, which is where an
     anime would have put it anyway, and eases back. */
  var SHOT = { t: 0, dur: 0, dir: null, side: 1, from: null };
  function beamShot(dir) {
    SHOT.t = 0; SHOT.dur = 1.35;
    SHOT.dir = dir.clone();
    SHOT.side = Math.random() < .5 ? 1 : -1;
    SHOT.from = player.pos.clone();
  }
  function stepShot(dt) {
    SHOT.t += dt;
    var k = SHOT.t / SHOT.dur;
    if (k >= 1) { SHOT.dur = 0; return; }
    /* in over three frames, hold, out over the last third */
    var mix = Math.min(1, k / .09) * (k > .66 ? 1 - (k - .66) / .34 : 1);
    var d = SHOT.dir, right = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(SHOT.side);
    var base = SHOT.from;
    var want = base.clone()
      .addScaledVector(right, 13)
      .addScaledVector(d, 7)
      .add(new THREE.Vector3(0, 5.5 + SHOT.t * 1.2, 0));
    var look = base.clone().addScaledVector(d, 26).add(new THREE.Vector3(0, 3, 0));
    camera.position.lerp(want, mix);
    var here = new THREE.Vector3();
    camera.getWorldDirection(here);
    var target = camera.position.clone().addScaledVector(here, 20);
    camera.lookAt(target.lerp(look, mix));
  }

  /* the entrance runs on real time, off the camera pass, so a hitstop in
     the middle of it cannot stretch it */
  var _updateCamera = updateCamera;
  updateCamera = function (dt) {
    if (AW.cine) {
      stepCine(dt);
      cineCamera();
      shakeMag = Math.max(0, shakeMag - dt * 2.2);
      return;
    }
    var r = _updateCamera(dt);
    if (SHOT.dur > 0) stepShot(dt);
    return r;
  };

  function cineCamera() {
    var t = AW.ct;
    /* Marks are relative to the way he is facing: yaw 0 is nose on, PI is
       where the chase camera lives, which is where this has to end. */
    gshot(t, [
      { t: 0,    yaw: 1.15, d: 11.5, h: 1.6, ly: 3.2, k: 26 },
      { t: .85,  yaw: .95,  d: 9.0,  h: 2.0, ly: 3.4, k: 30 },
      { t: 1.85, yaw: .45,  d: 5.2,  h: 4.3, ly: 4.35, k: 36 },
      { t: 2.55, yaw: .30,  d: 3.9,  h: 4.4, ly: 4.35, k: 60 },
      { t: 2.9,  yaw: -.15, d: 6.4,  h: 4.2, ly: 4.0, k: 30 },
      { t: 3.45, yaw: -.55, d: 8.0,  h: 3.4, ly: 3.4, k: 26 },
      { t: 4.3,  yaw: Math.PI - 1.5, d: 12.5, h: 5.2, ly: 3.2, k: 20 },
      { t: 5.4,  yaw: Math.PI, d: 12.0, h: 5.6, ly: 3.0, k: 18 }
    ]);
    if (window.MPJJ && window.MPJJ.cs) window.MPJJ.cs.orbit = AW.orbit;
  }

  /* charge from being hit */
  var _hurtPlayer = hurtPlayer;
  hurtPlayer = function (amount, knock) {
    var before = player.hp;
    _hurtPlayer(amount, knock);
    if (player.hp < before) gain((before - player.hp) * GAIN_TAKEN);
  };

  /* charge from landing one, for anything the game handles locally */
  var _enemyDamage = Enemy.prototype.damage;
  Enemy.prototype.damage = function (amount, knock, opts) {
    _enemyDamage.call(this, amount, knock, opts);
    gain(amount * GAIN_DEALT);
  };

  /* death drops the awakening */
  var _stepDeath = null;
  addFx({ t: 1e9, update: function () {
    if (player.dead && AW.active) endAwake();
    if (player.dead && AW.cine) {
      AW.cine = false; FX.letterbox(false); hud(true);
      theme(false, 'local');
    }
    return true;
  } });

  /* ------------------------------------------------- other players' Gojo */
  function remoteAwaken(fighter, on) {
    if (!fighter || !fighter.e) return;
    setLook(fighter.e.rig, on);
    if (on && !fighter.aura) {
      fighter.aura = FX.aura(function () { return fighter.e.pos; }, 0x3a7dff);
    } else if (!on && fighter.aura) {
      fighter.aura.stop();
      fighter.aura = null;
    }
    theme(!!on, fighter.id || 'remote');
  }

  renderBar();
})();
