/* =======================================================================
   FINISHERS — ONE PER SKILL
   Not one per fighter, and not a cutscene.

   The rule is simple: when a *skill* is the thing that would have taken
   somebody out, it does not just take them out — it finishes them, in
   the way that skill finishes people, and it finishes them differently
   from every other skill in the game. Twenty four of them, one for each
   ability on each fighter's bar.

   Three things this is deliberately NOT:

     · It is not the basic punch. A jab that happens to land last is not
       a finisher, so `m1` never triggers one — and because a punch runs
       off `attackT` rather than off an action, it excludes itself.
     · It is not a cutscene. Nobody is taken anywhere, the camera is
       never taken away, the letterbox never comes in and you never stop
       playing. The longest of them is under two and a half seconds.
     · It is not Naoya's awakening. That cut is his and it stays exactly
       where it was — this file does not touch it.

   What each one is: a short, specific, readable end. Hakari's shutter
   comes down, turns flat and takes them across the middle. Hollow Purple
   leaves the bottom half of them standing in the road. Limitless does
   not leave anything at all. The Divine Flame leaves ash.

   The health lock still holds: the target is pinned at one health for as
   long as the finisher runs, so the beat plays out on somebody who is
   still there, and the kill lands at the end of it.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX) return;
  var GORE = window.JJGORE;
  var TAU = Math.PI * 2;

  var F = { cd: 0, live: 0 };
  var COOLDOWN = 7;              // often enough to see, rare enough to mean something

  var FIN = window.JJFIN = {
    on: function () { return F.live > 0; },
    busy: function () { return F.live > 0; },
    ready: function () { return F.cd <= 0; },
    play: play
  };

  /* ------------------------------------------------------------- helpers */
  function up(y) { return new THREE.Vector3(0, y, 0); }
  function at(e, y) { return e.pos.clone().add(up(y == null ? 2.8 : y)); }
  function flat(v) { var c = v.clone(); c.y = 0; return c.lengthSq() < .01 ? new THREE.Vector3(0, 0, 1) : c.normalize(); }

  /* the word, and nothing else on screen: a finisher should read without
     stopping the game to explain itself */
  function say(text, color) {
    if (window.JJNOTICE) window.JJNOTICE(text, color || '#fff');
  }

  /* hold them where they are for the length of it, without freezing the
     rig — a body that stops mid-animation reads as a dropped frame */
  function pin(e, secs) {
    if (!e) return;
    if (GORE) GORE.hold(e);
    F.live++;
    var home = e.pos ? e.pos.clone() : null;
    var t = 0;
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (e !== player && home && !e.dead) {
        e.pos.x += (home.x - e.pos.x) * Math.min(1, dt * 9);
        e.pos.z += (home.z - e.pos.z) * Math.min(1, dt * 9);
        if (e.vel) e.vel.set(0, 0, 0);
        e.stunT = Math.max(e.stunT || 0, .3);
      }
      if (t < secs) return true;
      if (GORE) GORE.release(e);
      F.live = Math.max(0, F.live - 1);
      return false;
    } });
  }

  /* the kill, once the beat has played */
  function finish(e, style, dir, delay) {
    setTimeout(function () {
      if (typeof scene === 'undefined' || !e || e.dead) return;
      if (GORE) {
        GORE.release(e);
        if (!e.__gored && style && style !== 'ragdoll') GORE.mark(e, style);
      }
      var kb = (dir || new THREE.Vector3(0, 0, 1)).clone().multiplyScalar(14);
      kb.y = 8;
      e.damage(9999, kb, {
        noFrameBonus: true, fin: false, spark: 0xffffff,
        death: (!e.__gored && style && style !== 'ragdoll') ? style : null
      });
    }, (delay || 0) * 1000);
  }

  /* =====================================================================
     THE KIT A FINISHER IS HANDED
     The real one on the screen of whoever threw it, and on every screen
     watching it happen. A set of blanks on the screen of the person it
     is being thrown *at*, because their own body is taken apart by the
     hit that arrives at the end of it — not by a replay of somebody
     else's effect landing on them while they are still alive.
     ================================================================== */
  function realKit() {
    return {
      sever: function (e, o) { if (GORE) GORE.sever(e, o); },
      dice: function (e, o) { if (GORE) GORE.dice(e, o); },
      burn: function (e, o) { if (GORE) GORE.burn(e, o); },
      halve: function (e, o) { if (GORE) GORE.halve(e, o); },
      flatten: function (e, o) { if (GORE) GORE.flatten(e, o); },
      erase: function (e, o) { if (GORE) GORE.erase(e, o); },
      implode: function (e, o) { if (GORE) GORE.implode(e, o); },
      unrag: function (e) { if (window.JJRAG) { try { window.JJRAG.stop(e); } catch (err) {} } },
      fling: function (e, v, spin) {
        if (!window.JJRAG) return;
        try { window.JJRAG.start(e, v); } catch (err) {}
        if (e.rag && spin) e.rag.av.copy(spin);
      }
    };
  }
  var NO_KIT = {
    sever: function () {}, dice: function () {}, burn: function () {},
    halve: function () {}, flatten: function () {}, erase: function () {},
    implode: function () {}, unrag: function () {}, fling: function () {}
  };

  /* =====================================================================
     THE TWENTY FOUR
     Each is (victim, dir, at) and each owns its own second and a half.
     `hold` is how long the target is pinned before the kill lands.
     ================================================================== */
  var CUT = {

    /* ---------------------------------------------------------- GOJO */
    /* 1 · Reversal: Red — repulsion has nowhere to put them but outward */
    red: { name: 'BLOWN APART', color: '#ff3b4d', hold: .55, run: function (e, d, p, G) {
      FX.impact(p, 0xff3b4d, 3.4);
      FX.rings(p, 0xff3344, 4, { maxR: 20, life: .5, ground: false, gap: 34 });
      FX.zoom(9, .3);
      setTimeout(function () {
        G.sever(e, { dir: d, power: 2.4 });
        FX.flash('#ffd9dd', .35, .25);
        addShake(1.6);
      }, 240);
    } },

    /* 2 · Rapid Punches — a hundred of them, and then the floor */
    rapid: { name: 'PUMMELLED', color: '#9fd8ff', hold: .95, run: function (e, d, p, G) {
      var n = 0;
      var iv = setInterval(function () {
        if (n++ > 13 || typeof scene === 'undefined') { clearInterval(iv); return; }
        var q = p.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 1.6, (Math.random() - .5) * 2, (Math.random() - .5) * 1.6));
        FX.impact(q, 0x9fd8ff, .9);
        FX.blood(q, new THREE.Vector3((Math.random() - .5), .3, (Math.random() - .5)), 2, .8);
        if (window.JJHITS) window.JJHITS.flash(e.rig, 0xffffff, .8);
        addShake(.22);
      }, 55);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.cross(p, 0xffffff, 6, .22);
        G.flatten(e, { crater: 9 });
      }, 800);
    } },

    /* 3 · Twofold Kick — up, and not coming back down in this scene */
    tf: { name: 'LAUNCHED', color: '#bfe6ff', hold: .5, run: function (e, d, p, G) {
      FX.slash(p, d, 0xbfe6ff, 7, .22);
      FX.impact(p, 0xbfe6ff, 2.4);
      FX.speedRing(p, 0xdfefff, 12, .35);
      addShake(1.2);
      var v = d.clone().multiplyScalar(22);
      v.y = 62;
      G.fling(e, v, new THREE.Vector3(9, 3, 7));
      /* and a long way up, a very small flash */
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        var far = p.clone().add(up(64)).addScaledVector(d, 30);
        FX.cross(far, 0xffffff, 9, .4);
        FX.impact(far, 0xbfe6ff, 2);
      }, 1200);
    } },

    /* 4 · Palm Barrage — pressed down until there is no more down */
    palm: { name: 'PRESSED FLAT', color: '#7fd4ff', hold: .8, run: function (e, d, p, G) {
      [0, .16, .32, .48].forEach(function (ms, i) {
        setTimeout(function () {
          if (typeof scene === 'undefined') return;
          FX.ring(p.clone().add(up(-i * .5)), 0x7fd4ff,
            { maxR: 7 - i, life: .3, ground: false });
          FX.impact(p.clone().add(up(-i * .5)), 0xcfeaff, 1.2);
          addShake(.4 + i * .2);
        }, ms * 1000);
      });
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        G.flatten(e, { crater: 11 });
        FX.rings(new THREE.Vector3(p.x, .12, p.z), 0x7fd4ff, 3, { maxR: 16, life: .6, gap: 40 });
      }, 640);
    } },

    /* R · Limitless — the space between them and anything else stops
       being crossable, and then so do they */
    lim: { name: 'ERASED', color: '#6fa8ff', hold: .7, run: function (e, d, p, G) {
      FX.converge(p, 0x6fa8ff, 30, 14, .55);
      FX.speedRing(p, 0x6fa8ff, 9, .3);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        G.erase(e, { color: 0x6fa8ff });
        FX.flash('#dfefff', .3, .35);
      }, 520);
    } },

    /* ---- Gojo awakened ---- */
    /* 1 · Lapse: Blue — everything within nineteen metres, them included */
    aw_blue: { name: 'DRAWN IN', color: '#3a7dff', hold: 1.3, run: function (e, d, p, G) {
      var pt = p.clone().add(up(2.4));
      FX.converge(pt, 0x3a7dff, 40, 16, 1);
      FX.rings(pt, 0x59a8ff, 3, { maxR: 10, life: .6, ground: false, gap: 60 });
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        G.implode(e, { at: pt, color: 0x3a7dff, dir: d, cubes: 12 });
      }, 380);
    } },

    /* 2 · Reversal: Red — held against the front of it and torn up */
    aw_red: { name: 'TORN APART', color: '#ff3344', hold: 1, run: function (e, d, p, G) {
      FX.wave(p, d, 0xff3344, { steps: 4, gap: 30, reach: 3, r0: 5, grow: 2 });
      FX.cross(p, 0xffd0d4, 7, .28);
      addShake(1.4);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.flash('#ffd9dd', .45, .3);
          G.sever(e, { dir: d, power: 3, cubes: 14 });
        FX.debris(new THREE.Vector3(p.x, 0, p.z), 20, 24, 0x8b93a2);
        addShake(2);
      }, 560);
    } },

    /* 3 · Hollow Purple — the half of them it went through is not there */
    aw_purple: { name: 'HALVED', color: '#8b5cff', hold: 1.1, run: function (e, d, p, G) {
      FX.beam(p.clone().addScaledVector(d, -14).add(up(.3)), d, 60, 0x8b5cff,
        { radius: 3.4, life: .7 });
      FX.beam(p.clone().addScaledVector(d, -14).add(up(.3)), d, 60, 0xffffff,
        { radius: 1.3, life: .6 });
      FX.flash('#e6d8ff', .55, .3);
      addShake(2.4);
      if (typeof hitstop === 'function') hitstop(.12);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        /* the top of them goes with the beam; the legs are still standing */
        G.halve(e, { dir: d, eraseTop: true, color: 0x8b5cff, stand: .5 });
        FX.rings(p, 0x9b4dff, 3, { maxR: 18, life: .6, ground: false, gap: 40 });
      }, 260);
    } },

    /* 4 · Unlimited Void — nothing touched them at all */
    aw_domain: { name: 'SHUT DOWN', color: '#bfd8ff', hold: 1.4, run: function (e, d, p, G) {
      if (window.JJHITS) window.JJHITS.react(e, 'shock', 1.2);
      var n = 0;
      var iv = setInterval(function () {
        if (n++ > 16 || typeof scene === 'undefined') { clearInterval(iv); return; }
        FX.mote(p.clone().add(up(Math.random() * 2)), 0xbfd8ff, 4, .4);
        FX.streaks(p.clone(), 0xdfefff, 1, 7, .8);
      }, 60);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.flash('#ffffff', .5, .4);
        FX.impact(p, 0xbfd8ff, 2.2);
        G.fling(e, new THREE.Vector3(0, 2, 0));         // the lights simply go out
      }, 1150);
    } },

    /* --------------------------------------------------------- NAOYA */
    /* 1 · Projection Breaker — twenty four frames, and none of them move */
    n1: { name: 'FRAMED', color: '#9fd8ff', hold: .9, run: function (e, d, p, G) {
      FX.speedRing(p, 0xdfefff, 8, .3);
      FX.ring(p, 0x9fd8ff, { maxR: 5, life: .4, ground: false, axis: d });
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.flash('#eaf6ff', .5, .25);
        FX.cross(p, 0xffffff, 7, .3);
        try { sfx.shatter(); } catch (err) {}
        /* a body that has been stopped does not break, it shatters */
        G.sever(e, { dir: d, power: .6, cubes: 22 });
        FX.streaks(p, 0xcfeaff, 16, 20, 1.4);
        addShake(1.2);
      }, 700);
    } },

    /* 2 · Tanto — one cut, across the middle, and he walks on */
    n2: { name: 'CUT IN TWO', color: '#dfefff', hold: .7, run: function (e, d, p, G) {
      var side = new THREE.Vector3(-d.z, 0, d.x);
      FX.cutLine(p.clone().addScaledVector(side, -5), p.clone().addScaledVector(side, 5),
        0xffffff, 1.2, .35);
      if (typeof hitstop === 'function') hitstop(.1);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        G.halve(e, { dir: d, power: 1.1, stand: .45 });
      }, 420);
    } },

    /* 3 · You're Not Toji — the kick that ends the conversation */
    n3: { name: 'PUT THROUGH IT', color: '#9be7ff', hold: .55, run: function (e, d, p, G) {
      FX.slash(p, d, 0xcfefff, 6, .2);
      FX.impact(p, 0x9be7ff, 2.6);
      FX.speedRing(p, 0xdfefff, 11, .32);
      addShake(1.5);
      if (typeof hitstop === 'function') hitstop(.09);
      var v = d.clone().multiplyScalar(74); v.y = 13;
      G.fling(e, v, new THREE.Vector3(2, 5, 14));
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        var far = p.clone().addScaledVector(d, 26);
        FX.debris(new THREE.Vector3(far.x, 0, far.z), 16, 20, 0x8b93a2);
        FX.cracks(new THREE.Vector3(far.x, 0, far.z), 8, 14);
        addShake(1.1);
      }, 430);
    } },

    /* R · the double teleport — behind them, and behind them again */
    nr: { name: 'NEVER SAW IT', color: '#bfe6ff', hold: .8, run: function (e, d, p, G) {
      [0, .2, .4].forEach(function (ms, i) {
        setTimeout(function () {
          if (typeof scene === 'undefined') return;
          var side = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar((i - 1) * 2.4);
          FX.impact(p.clone().add(side), 0xbfe6ff, 1.6);
          FX.slash(p.clone().add(side), d, 0xdfefff, 4, .16);
          FX.trail(e.rig, 0x9fd8ff, 2, 24, .4);
          addShake(.5);
        }, ms * 1000);
      });
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        G.sever(e, { dir: d, power: 1.4 });
      }, 620);
    } },
    nrf: { name: 'NEVER SAW IT', color: '#bfe6ff', hold: .8, run: function (e, d, p, G) {
      CUT.nr.run(e, d, p, G);
    } },

    /* ---------------------------------------------------------- YUJI */
    /* 1 · Divergent Fist — the second one arrives after the body has left */
    y1: { name: 'HIT TWICE', color: '#ff8a5c', hold: .85, run: function (e, d, p, G) {
      FX.impact(p, 0xffd9a8, 1.8);
      FX.cross(p, 0xffffff, 4, .18);
      addShake(.7);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        /* and half a second later, the rest of it */
        FX.flash('#ffe6c0', .5, .25);
        FX.impact(p, 0xff8a5c, 3.6);
        FX.rings(p, 0xff9a6a, 3, { maxR: 14, life: .5, ground: false, gap: 34 });
        if (typeof hitstop === 'function') hitstop(.12);
        G.sever(e, { dir: d, power: 2.2 });
        addShake(2);
      }, 560);
    } },

    /* 2 · Black Flash — a hundredth of a second, and black line work */
    y2: { name: 'BLACK FLASH', color: '#ff2a4a', hold: .9, run: function (e, d, p, G) {
      if (window.JJYUJI && window.JJYUJI.blackFlash) window.JJYUJI.blackFlash(p.clone());
      FX.flash('#000000', 1, .09);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.flash('#ffffff', .9, .28);
        for (var i = 0; i < 8; i++) {
          var a = i / 8 * TAU;
          FX.cutLine(p.clone(), p.clone().add(new THREE.Vector3(
            Math.cos(a) * 11, Math.sin(a) * 9, (Math.random() - .5) * 5)), 0x14060a, 1.3, .45);
        }
        if (typeof hitstop === 'function') hitstop(.16);
        G.sever(e, { dir: d, power: 2, cubes: 16 });
        addShake(2.6);
      }, 110);
    } },

    /* 3 · Manji Kick — it takes them up and it takes them apart */
    y3: { name: 'SPUN APART', color: '#ff9fb0', hold: 1, run: function (e, d, p, G) {
      FX.slash(p, d, 0xffd0da, 7, .22);
      FX.speedRing(p, 0xffb0bd, 10, .35);
      var v = d.clone().multiplyScalar(6); v.y = 26;
      G.fling(e, v, new THREE.Vector3(0, 16, 6));
      addShake(1);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        var air = p.clone().add(up(5.4));
        FX.impact(air, 0xff9fb0, 2.6);
        G.unrag(e);
        G.sever(e, { dir: d, power: 1.7 });
        addShake(1.4);
      }, 620);
    } },

    /* 4 · Crushing Blow — all of his weight, and the floor under it */
    y4: { name: 'DRIVEN DOWN', color: '#ffb0bd', hold: .8, run: function (e, d, p, G) {
      FX.streaks(p.clone().add(up(3)), 0xffd0da, 6, 16, 1.2);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.cross(new THREE.Vector3(p.x, 1.4, p.z), 0xffffff, 7, .3);
        FX.impact(new THREE.Vector3(p.x, 1.2, p.z), 0xff9fb0, 4);
        FX.rings(new THREE.Vector3(p.x, .12, p.z), 0xffb0bd, 4, { maxR: 18, life: .7, gap: 40 });
        FX.debris(new THREE.Vector3(p.x, 0, p.z), 18, 20, 0x5a4a44);
        if (typeof hitstop === 'function') hitstop(.14);
        G.flatten(e, { crater: 16 });
        addShake(2.4);
      }, 480);
    } },

    /* R · Surge — everything at once, out of him and through them */
    yr: { name: 'BURNED OUT', color: '#ff7f9a', hold: 1, run: function (e, d, p, G) {
      FX.rings(p, 0xff9fb0, 3, { maxR: 12, life: .5, ground: false, gap: 40 });
      FX.fire(p, 8, 1.2, 2.4, .7);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.flash('#ffd0da', .4, .3);
        G.burn(e, { dir: d });
        addShake(1.4);
      }, 640);
    } },

    /* -------------------------------------------------------- HAKARI */
    /* 1 · Shutter — the same train door, thrown, then laid through them */
    h1: { name: 'CUT IN HALF', color: '#ffcc4d', hold: 1.25, run: function (e, d, p, G) {
      var HK = window.JJHAKARI;
      var door = (HK && HK.makeDoor) ? HK.makeDoor() : new THREE.Group();
      /* facing lives on the root so flattening the door cannot wipe it */
      var root = new THREE.Group();
      var spin = new THREE.Group();
      spin.add(door);
      root.add(spin);
      root.position.copy(p).addScaledVector(d, -9).add(up(3.2));
      root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
      scene.add(root);
      try { sfx.shatter(); } catch (err) {}

      var t = 0, hit = false, cut = false;
      addFx({ t: 2.4, update: function (dt) {
        this.t -= dt; t += dt;
        if (HK) HK.pulseDoor(door, t * 3);
        if (t < .3) {                                 // in, hard
          root.position.addScaledVector(d, dt * 30);
          if (HK) HK.rattleDoor(door, .03);
          if (Math.random() < .8) FX.streaks(root.position.clone(), 0xffe08a, 2, 14, 1.3);
        } else if (!hit) {
          hit = true;
          FX.impact(p, 0xffcc4d, 3.2);
          FX.cross(p, 0xffe08a, 7, .28);
          FX.rings(p, 0xffcc4d, 3, { maxR: 13, life: .5, ground: false, gap: 34 });
          FX.debris(p.clone(), 8, 12, 0x8b93a2);
          FX.debris(p.clone(), 5, 10, 0xffcc4d);
          if (window.JJHITS) window.JJHITS.react(e, 'crumple', .8);
          addShake(1.6);
          if (typeof hitstop === 'function') hitstop(.12);
        }
        if (t > .3 && t < .78) {
          /* and over it goes, until it is lying across their middle */
          var k = (t - .3) / .48;
          var u = k * k * (3 - 2 * k);
          spin.rotation.x = -Math.PI / 2 * u;
          root.position.y = 3.2 + Math.sin(u * Math.PI) * 1.2;
          if (HK) HK.rattleDoor(door, .07 * (1 - k));
        }
        if (t >= .78 && !cut) {
          cut = true;
          FX.flash('#fff3d0', .55, .25);
          FX.cutLine(
            p.clone().add(new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(4)).add(up(3.3)),
            p.clone().add(new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(-4)).add(up(3.3)),
            0xffe08a, 1.2, .4);
          FX.debris(p.clone().add(up(3.2)), 12, 16, 0x8b93a2);
          if (typeof hitstop === 'function') hitstop(.14);
          G.halve(e, { dir: d, power: 1.3, color: 0xffe08a, stand: .3 });
          addShake(2);
          try { sfx.sever(); } catch (err) {}
        }
        if (t > .78) {                                // the door falls past them
          root.position.y -= dt * 9;
          root.position.addScaledVector(d, dt * 3);
          spin.rotation.x -= dt * .4;
        }
        if (this.t <= 0) {
          if (HK && HK.dropDoor) HK.dropDoor(door);
          scene.remove(root);
          return false;
        }
        return true;
      } });
    } },

    /* 2 · Ball Barrage — the other half of the machine, all of it */
    h2: { name: 'RIDDLED', color: '#ffe08a', hold: 1.05, run: function (e, d, p, G) {
      var n = 0;
      var iv = setInterval(function () {
        if (n++ > 18 || typeof scene === 'undefined') { clearInterval(iv); return; }
        var q = p.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 2, (Math.random() - .5) * 2.6, (Math.random() - .5) * 2));
        FX.impact(q, 0xffe08a, .8);
        FX.blood(q, d.clone().setY(.2), 2, .8);
        FX.debris(q, 1, 8, 0xf2e2a0);
        addShake(.2);
      }, 48);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.flash('#fff3d0', .4, .25);
        G.sever(e, { dir: d, power: 1.1, cubes: 20 });
        addShake(1.4);
      }, 900);
    } },

    /* 3 · Gachinko — three of his own, and then the floor */
    h3: { name: 'FLOORED', color: '#ffd964', hold: 1.05, run: function (e, d, p, G) {
      [0, .22, .44].forEach(function (ms, i) {
        setTimeout(function () {
          if (typeof scene === 'undefined') return;
          FX.impact(p, 0xffcc4d, 1.4 + i * .6);
          FX.cross(p, 0xffffff, 3.4 + i, .2);
          FX.blood(p, d.clone().setY(.3), 3, 1);
          if (window.JJHITS) window.JJHITS.react(e, i === 2 ? 'crumple' : 'whip', .35);
          addShake(.7 + i * .4);
          if (typeof hitstop === 'function') hitstop(.06);
        }, ms * 1000);
      });
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.cracks(new THREE.Vector3(p.x, 0, p.z), 12, 18, 0x2a2418);
        FX.debris(new THREE.Vector3(p.x, 0, p.z), 14, 16, 0x5c5240);
        G.flatten(e, { crater: 13 });
        addShake(2.2);
      }, 760);
    } },

    /* 4 · Idle Death Gamble — the machine pays out, with them in it */
    h4: { name: 'PAID OUT', color: '#ffd84a', hold: 1.3, run: function (e, d, p, G) {
      var n = 0;
      var iv = setInterval(function () {
        if (n++ > 24 || typeof scene === 'undefined') { clearInterval(iv); return; }
        var m = FX.billboard(FX.T.star, n % 3 ? 0xffd84a : 0xfff0c0, 1);
        m.scale.setScalar(.8 + Math.random() * .8);
        m.position.copy(p).add(new THREE.Vector3(
          (Math.random() - .5) * 3, Math.random() * 3, (Math.random() - .5) * 3));
        scene.add(m);
        var vy = 6 + Math.random() * 7;
        var vx = (Math.random() - .5) * 9, vz = (Math.random() - .5) * 9;
        addFx({ t: 2, update: function (dt) {
          this.t -= dt;
          vy -= 26 * dt;
          m.position.x += vx * dt; m.position.z += vz * dt; m.position.y += vy * dt;
          if (m.position.y < .4) { m.position.y = .4; vy = Math.abs(vy) * .4; }
          m.material.opacity = Math.min(1, this.t / .5);
          if (this.t <= 0) { scene.remove(m); m.material.dispose(); return false; }
          return true;
        } });
      }, 42);
      FX.rings(p, 0xffd84a, 3, { maxR: 14, life: .6, ground: false, gap: 50 });
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.flash('#ffd84a', .8, .4);
        G.burn(e, { dir: d });
        addShake(1.8);
        try { sfx.frame(); } catch (err) {}
      }, 1100);
    } },

    /* R · Overwhelm — shoulder first, and out the other side */
    hr: { name: 'RUN THROUGH', color: '#ffd964', hold: .6, run: function (e, d, p, G) {
      FX.speedRing(p, 0xffd964, 10, .3);
      FX.impact(p, 0xffcc4d, 2.8);
      FX.slash(p, d, 0xffe08a, 6, .2);
      addShake(1.6);
      if (typeof hitstop === 'function') hitstop(.1);
      var v = d.clone().multiplyScalar(56); v.y = 9;
      G.fling(e, v, new THREE.Vector3(4, 2, 11));
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.blood(p.clone().addScaledVector(d, 6), d, 12, 1.5);
        FX.cracks(new THREE.Vector3(p.x + d.x * 12, 0, p.z + d.z * 12), 7, 12, 0x2a2418);
      }, 380);
    } },

    /* -------------------------------------------------------- SUKUNA */
    /* 1 · Dismantle — the net, and the cubes it cut them into */
    s1: { name: 'DISMANTLED', color: '#ff2a4a', hold: .9, run: function (e, d, p, G) {
      FX.lattice(p, d, 4, 6, 4, 4, 0xffffff, { stagger: 22, life: .5, width: .34 });
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.flash('#ffffff', .45, .2);
        if (typeof hitstop === 'function') hitstop(.12);
        G.dice(e, { dir: d, power: 1.3, cubes: 20 });
        addShake(1.8);
      }, 560);
    } },

    /* 2 · Cleave — one cut, and it does not need a second */
    s2: { name: 'CLEAVED', color: '#d4143c', hold: .7, run: function (e, d, p, G) {
      var side = new THREE.Vector3(-d.z, 0, d.x);
      FX.cutLine(p.clone().addScaledVector(side, -4).add(up(3)),
        p.clone().addScaledVector(side, 4).add(up(-3)), 0xffffff, 1.4, .4);
      if (typeof hitstop === 'function') hitstop(.13);
      FX.flash('#ffffff', .5, .2);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        /* across the body rather than around it: one diagonal */
        G.halve(e, { dir: d, power: 1.5, tilt: .5, color: 0xd4143c, stand: .28 });
        addShake(1.6);
      }, 380);
    } },

    /* 3 · Fuga — there is nothing left to fall over */
    s3: { name: 'BURNED TO ASH', color: '#ff8a3a', hold: 1.1, run: function (e, d, p, G) {
      FX.fire(p, 14, 1.6, 3.4, 1);
      FX.flame(p.clone(), 5, .8);
      FX.scorch(new THREE.Vector3(p.x, 0, p.z), 6, 30);
      addShake(1.4);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.flash('#ffb070', .5, .35);
        G.burn(e, { dir: d });
      }, 760);
    } },

    /* 4 · Malevolent Shrine — the sure hit, on one person, all at once */
    s4: { name: 'CUT TO PIECES', color: '#ff2a4a', hold: 1.3, run: function (e, d, p, G) {
      var n = 0;
      var iv = setInterval(function () {
        if (n++ > 10 || typeof scene === 'undefined') { clearInterval(iv); return; }
        var a = Math.random() * TAU;
        FX.cutLine(p.clone().add(new THREE.Vector3(Math.cos(a) * 4, Math.sin(a) * 4, 0)),
          p.clone().add(new THREE.Vector3(-Math.cos(a) * 4, -Math.sin(a) * 4, 0)),
          n % 3 ? 0xffffff : 0xd4143c, .6, .3);
        FX.blood(p.clone(), new THREE.Vector3(Math.cos(a), Math.sin(a), .3), 3, 1);
        addShake(.4);
      }, 90);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.flash('#ffffff', .6, .3);
        if (typeof hitstop === 'function') hitstop(.15);
        G.dice(e, { dir: d, power: 1.6, cubes: 30 });
        addShake(2.4);
      }, 1050);
    } }
  };

  /* what each one leaves behind, for the kill that lands at the end */
  var STYLE = {
    red: 'sever', rapid: 'flat', tf: 'ragdoll', palm: 'flat', lim: 'gone',
    aw_blue: 'gone', aw_red: 'dice', aw_purple: 'gone', aw_domain: 'ragdoll',
    n1: 'dice', n2: 'sever', n3: 'ragdoll', nr: 'sever', nrf: 'sever',
    y1: 'sever', y2: 'dice', y3: 'sever', y4: 'flat', yr: 'burn',
    h1: 'sever', h2: 'dice', h3: 'flat', h4: 'burn', hr: 'ragdoll',
    s1: 'dice', s2: 'sever', s3: 'burn', s4: 'dice'
  };

  /* =====================================================================
     WHICH SKILL DID IT
     The action the player is in the middle of, which for a punch is
     nothing at all — so a punch can never be a finisher.
     ================================================================== */
  var NOT_A_SKILL = { m1: 1, kb: 1, void: 1, nrush: 1, yaw: 1, awaken: 1 };
  var lastSkill = null, lastAt = 0;

  function nowS() { return (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000; }

  /* a projectile can land after its cast is over, so the last skill is
     remembered for a moment after it finishes */
  addFx({ t: 1e9, update: function (dt) {
    var a = player.action;
    if (a && a.type && !NOT_A_SKILL[a.type] && CUT[a.type]) {
      lastSkill = a.type;
      lastAt = nowS();
    }
    if (F.cd > 0) F.cd = Math.max(0, F.cd - dt);
    return true;
  } });

  function skillNow() {
    var a = player.action;
    if (a && a.type && CUT[a.type] && !NOT_A_SKILL[a.type]) return a.type;
    if (lastSkill && nowS() - lastAt < 2.2) return lastSkill;
    return null;
  }

  /* =====================================================================
     RUNNING ONE
     ================================================================== */
  function play(e, skill, dir) {
    var cut = CUT[skill];
    if (!cut || !e) return false;
    var d = flat(dir || e.pos.clone().sub(player.pos));
    var p = at(e, 2.8);
    F.cd = COOLDOWN;
    say(cut.name, cut.color);
    FX.zoom(-4, .25);
    pin(e, cut.hold);
    try { cut.run(e, d, p, realKit()); } catch (err) {}
    return true;
  }

  function armed(e, amount, opts) {
    if (F.cd > 0 || F.live > 0) return false;
    if (!e || e.dead || player.dead) return false;
    if (opts && opts.fin === false) return false;
    if (e.pos.distanceTo(player.pos) > 40) return false;
    if (GORE && (GORE.isHeld(e) || GORE.isHeld(player))) return false;
    /* Naoya's awakening owns both bodies while it runs; it is not this */
    if (window.JJNAOYA && window.JJNAOYA.busy()) return false;
    /* the hit has to be the one that finishes them, and it has to be a
       skill that threw it */
    if (e.hp - amount > 0) return false;
    return !!skillNow();
  }

  /* patched on the first frame rather than at load, so it sits on top of
     mp.js's own hook and sees hits on other players too */
  var patched = false;
  addFx({ t: 1e9, update: function () {
    if (patched) return true;
    patched = true;
    var _dmg = Enemy.prototype.damage;
    Enemy.prototype.damage = function (amount, knock, opts) {
      if (!armed(this, amount, opts)) return _dmg.call(this, amount, knock, opts);
      var e = this, skill = skillNow();
      var dir = knock ? flat(knock) : flat(e.pos.clone().sub(player.pos));
      /* leave them on one health: the finisher needs somebody to play on */
      _dmg.call(this, Math.max(0, this.hp - 1), knock, opts);
      play(e, skill, dir);
      finish(e, STYLE[skill] === 'gone' ? 'sever' : (STYLE[skill] || 'ragdoll'),
        dir, CUT[skill].hold + .05);
      /* and every other screen plays the same beat on their copy of them */
      if (e.net && window.MPJJ && window.MPJJ.relay) {
        window.MPJJ.relay.pub({
          t: 'fin', id: window.MPJJ.id, to: e.net.id, k: skill,
          x: Math.round(e.pos.x * 10) / 10, z: Math.round(e.pos.z * 10) / 10,
          dx: Math.round(dir.x * 100) / 100, dz: Math.round(dir.z * 100) / 100
        });
      }
      return;
    };
    return true;
  } });

  /* somebody else's finisher, played on our copy of whoever it caught —
     visuals only, because the kill arrives as its own hit */
  FIN.remote = function (ent, skill, pos, dir, onMe) {
    var cut = CUT[skill];
    if (!cut || !ent) return;
    var d = flat(dir || new THREE.Vector3(0, 0, 1));
    var p = (pos || ent.pos).clone().add(up(2.8));
    say(cut.name, cut.color);
    FX.zoom(-3, .25);
    try { cut.run(ent, d, p, onMe ? NO_KIT : realKit()); } catch (err) {}
  };

  /* the effect list, for anything that wants to know what a skill does */
  FIN.styleOf = function (skill) { return STYLE[skill] || 'ragdoll'; };
  FIN.nameOf = function (skill) { return CUT[skill] ? CUT[skill].name : null; };
})();
