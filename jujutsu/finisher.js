/* =======================================================================
   FINISHERS — ONE PER SKILL
   Not one per fighter, and not a cutscene.

   The rule is simple: when a *skill* is the thing that would have taken
   somebody out, it does not just take them out — it finishes them, in
   the way that skill finishes people, and it finishes them differently
   from every other skill in the game. One for each ability on each
   fighter's bar.

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

  var F = { cd: 0, live: 0, remote: false };

  /* Whether the body this finisher is being performed with is ours. A
     finisher that moves and poses the caster may only do that on the
     screen of whoever threw it: everybody else is watching a copy of him
     that arrives in the state packet, and taking their own body over to
     replay it would leave them standing in somebody else's fight. */
  function mine() { return !F.remote; }
  var COOLDOWN = 7;              // often enough to see, rare enough to mean something

  var FIN = window.JJFIN = {
    on: function () { return F.live > 0; },
    busy: function () { return F.live > 0; },
    ready: function () { return F.cd <= 0; },
    play: play
  };

  /* ------------------------------------------------------------- helpers */
  function up(y) { return new THREE.Vector3(0, y, 0); }
  /* the one easing the cuts use; it lives up here so every one of them can
     reach it rather than each carrying its own copy */
  function E2(x) { return FX.ease.out(x); }
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
      /* The gored check is about OUR copy of them: a body already taken
         apart here must not be taken apart twice. Another player's body
         has not been touched — what we have is a proxy, and the finisher
         just gored that. Asking for the style anyway is the only way they
         ever find out how they died, and without it every finisher landed
         on a real player as a plain ragdoll on their own screen. */
      var named = style && style !== 'ragdoll';
      e.damage(9999, kb, {
        noFrameBonus: true, fin: false, spark: 0xffffff,
        death: (named && (e.net || !e.__gored)) ? style : null
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

    /* 4 · Twenty Four Frames — he does not hit them with the last one.
       The twenty four panes he printed them into stack up, the stack
       closes, and what is left is one blank frame where somebody was. */
    n4: { name: 'CUT FROM THE FILM', color: '#9fd8ff', hold: 1.2, run: function (e, d, p, G) {
      var panes = [];
      var side = new THREE.Vector3(-d.z, 0, d.x);
      for (var i = 0; i < 12; i++) {
        (function (n) {
          setTimeout(function () {
            if (typeof scene === 'undefined') return;
            var a = n / 12 * TAU;
            /* the game's own glass frame, which is the thing his whole
               technique puts people inside */
            var m = makeGlassPane();
            m.scale.setScalar(.62);
            m.position.copy(p).add(new THREE.Vector3(
              Math.cos(a) * 7, (n % 3 - 1) * 1.4, Math.sin(a) * 7));
            m.lookAt(p);
            scene.add(m);
            panes.push({ m: m, from: m.position.clone() });
            FX.streaks(m.position.clone(), 0x9fd8ff, 1, 9, .5);
          }, n * 34);
        })(i);
      }
      /* the stack closes on them */
      var t = 0;
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        addFx({ t: .55, update: function (dt) {
          this.t -= dt; t += dt;
          var k = Math.min(1, t / .55);
          panes.forEach(function (q) {
            q.m.position.lerpVectors(q.from, p, k * k);
            q.m.lookAt(p);
            q.m.scale.setScalar(.62 * (1 - k * .35));
          });
          return this.t > 0;
        } });
      }, 440);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        panes.forEach(function (q) {
          glassShards(q.m.position.clone(), 5);
          scene.remove(q.m);
          q.m.traverse(function (o) { if (o.isMesh) o.material.dispose(); });
        });
        FX.flash('#dff0ff', .5, .28);
        if (typeof hitstop === 'function') hitstop(.16);
        FX.cross(p, 0xffffff, 7, .26);
        try { sfx.shatter(); } catch (er) {}
        /* removed from the second: nothing falls over */
        G.erase(e, { color: 0x9fd8ff });
        addShake(2);
      }, 1030);
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
    /* 1 · Shutter — one door in, then two of them, flat, clamp */
    h1: { name: 'CUT IN HALF', color: '#ffcc4d', hold: 1.35, run: function (e, d, p, G) {
      var HK = window.JJHAKARI;
      function make() { return (HK && HK.makeDoor) ? HK.makeDoor() : new THREE.Group(); }
      var incoming = make();
      var side = new THREE.Vector3(-d.z, 0, d.x);
      if (side.lengthSq() < .01) side.set(1, 0, 0);
      side.normalize();
      var mid = new THREE.Vector3(p.x, 3.3, p.z);
      var root = new THREE.Group();
      root.add(incoming);
      root.position.copy(mid).addScaledVector(d, -9);
      root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
      scene.add(root);
      try { sfx.shatter(); } catch (err) {}

      var t = 0, hit = false, split = false, opened = false, clamp = false, cut = false;
      var top = null, bot = null;
      var GAP = 2.5;
      function pair(open) {
        if (!top || !bot) return;
        /* flat, but tipped toward the camera so the 777 still reads */
        top.rotation.x = -Math.PI / 2 + .4;
        bot.rotation.x = -Math.PI / 2 + .4;
        top.position.y = open;
        bot.position.y = -open;
        if (HK) {
          HK.pulseDoor(top, t * 3);
          HK.pulseDoor(bot, t * 3);
          HK.rattleDoor(top, .04);
          HK.rattleDoor(bot, .04);
        }
      }
      addFx({ t: 2.5, update: function (dt) {
        this.t -= dt; t += dt;
        if (incoming && HK) HK.pulseDoor(incoming, t * 3);
        if (t < .22) {                                 // in, standing
          root.position.addScaledVector(d, dt * 38);
          if (HK) HK.rattleDoor(incoming, .03);
          if (Math.random() < .8) FX.streaks(root.position.clone(), 0xffe08a, 2, 14, 1.3);
        } else if (!hit) {
          hit = true;
          root.position.copy(mid).addScaledVector(d, .35);
          FX.impact(p, 0xffcc4d, 2.6);
          FX.rings(p, 0xffcc4d, 2, { maxR: 10, life: .4, ground: false, gap: 34 });
          if (window.JJHITS) window.JJHITS.react(e, 'crumple', .9);
          addShake(1.2);
          if (typeof hitstop === 'function') hitstop(.1);
        }
        if (t > .22 && t < .44) {
          /* the last door goes over — it is a floor now */
          var k = (t - .22) / .22;
          var u = k * k * (3 - 2 * k);
          incoming.rotation.x = (-Math.PI / 2 + .4) * u;
          if (HK) HK.rattleDoor(incoming, .05);
        }
        if (t >= .44 && !split) {
          split = true;
          if (HK && HK.dropDoor) HK.dropDoor(incoming);
          incoming = null;
          top = make();
          bot = make();
          root.add(top);
          root.add(bot);
          pair(.2);
          FX.speedRing(mid, 0xffe08a, 6, .25);
          try { sfx.whoosh(); } catch (err) {}
        }
        if (t >= .44 && t < .7) {
          /* two horizontal doors, they come apart */
          var k = Math.min(1, (t - .44) / .26);
          var u = 1 - Math.pow(1 - k, 3);
          pair(.2 + GAP * u);
          if (!opened && k > .05) {
            opened = true;
            FX.streaks(mid.clone().add(up(2)), 0xffcc4d, 4, 10, 1);
            FX.streaks(mid.clone().add(up(-2)), 0xffcc4d, 4, 10, 1);
          }
        }
        if (t >= .7 && t < .78) pair(.2 + GAP);
        if (t >= .78 && t < 1.0) {
          /* and they clamp, still flat */
          var k = (t - .78) / .22;
          var u = k * k * k;
          pair((.2 + GAP) * (1 - u));
          if (Math.random() < .7) FX.streaks(mid, 0xffe08a, 2, 10, 1);
          if (!clamp && k > .12) {
            clamp = true;
            try { sfx.whoosh(); } catch (err) {}
          }
        }
        if (t >= 1.0 && !cut) {
          cut = true;
          pair(-.1);
          FX.flash('#fff3d0', .55, .25);
          FX.impact(mid, 0xffcc4d, 3.4);
          FX.cross(mid, 0xffe08a, 8, .3);
          FX.rings(mid, 0xffcc4d, 3, { maxR: 12, life: .5, ground: false, gap: 34 });
          FX.cutLine(
            mid.clone().addScaledVector(side, -4.2),
            mid.clone().addScaledVector(side, 4.2),
            0xffe08a, 1.2, .4);
          FX.debris(mid.clone(), 14, 16, 0x8b93a2);
          FX.debris(mid.clone(), 6, 12, 0xffcc4d);
          if (typeof hitstop === 'function') hitstop(.16);
          G.halve(e, { dir: d, power: 1.3, color: 0xffe08a, stand: .3 });
          addShake(2.2);
          try { sfx.sever(); } catch (err) {}
        }
        if (t > 1.0) {
          var bounce = Math.min(1, (t - 1.0) / .2);
          pair(-.1 + bounce * .7);
          root.position.y -= dt * 8;
          root.position.addScaledVector(d, dt * 2);
        }
        if (this.t <= 0) {
          if (HK && HK.dropDoor) {
            if (incoming) HK.dropDoor(incoming);
            if (top) HK.dropDoor(top);
            if (bot) HK.dropDoor(bot);
          }
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

    /* 4 · Fever Breaker — the second kick decides where they land, and
       here it puts them through both doors on the way */
    h4: { name: 'SENT THROUGH', color: '#ffd964', hold: .9, run: function (e, d, p, G) {
      FX.speedRing(p, 0xffe08a, 12, .34);
      FX.impact(p, 0xffd964, 2.4);
      if (typeof hitstop === 'function') hitstop(.13);
      addShake(1.4);
      var doors = [];
      var HKA = window.JJHAKARI;
      if (HKA && HKA.makeDoor) {
        for (var i = 0; i < 2; i++) {
          var dr = HKA.makeDoor();
          dr.position.copy(p).addScaledVector(d, 5 + i * 5);
          dr.rotation.y = Math.atan2(d.x, d.z);
          scene.add(dr);
          doors.push(dr);
        }
      }
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.mangaLines(.8, .3);
        FX.flash('#fff3c8', .4, .22);
        doors.forEach(function (dr, i) {
          setTimeout(function () {
            if (typeof scene === 'undefined') return;
            if (HKA && HKA.burstDoor) HKA.burstDoor(dr, d);
            addShake(1);
          }, i * 140);
        });
        G.fling(e, d.clone().multiplyScalar(52).setY(16), new THREE.Vector3(0, 0, 9));
        addShake(2);
      }, 560);
    } },

    /* ========== HAKARI, IN FEVER ==========
       The four he only has while the song is playing. */

    /* 1 · the container — he runs it down and goes through it */
    ha1: { name: 'THROUGH THE BOX', color: '#ffd964', hold: 2.5, run: function (e, d, p, G) {
      var FV = window.JJFEVER;
      var LEN = FV && FV.BOX ? FV.BOX.len : 15.5;
      var TALL = FV && FV.BOX ? FV.BOX.tall : 6.2;
      /* the container stops on them, broadside, and he arrives at it */
      var box = FV && FV.buildContainer ? FV.buildContainer()
        : new THREE.Mesh(new THREE.BoxGeometry(LEN, TALL, 5.6),
            new THREE.MeshStandardMaterial({ color: 0xd83a3a, roughness: .82, metalness: .25 }));
      var piv = new THREE.Group();
      piv.add(box);
      piv.rotation.y = Math.atan2(d.x, d.z);          // broadside to him
      piv.position.copy(p).addScaledVector(d, 3.2);
      piv.position.y = TALL / 2;
      scene.add(piv);
      /* they are pinned against the far side of it, out of sight */
      var behind = piv.position.clone().addScaledVector(d, 3.4);
      FX.impact(p, 0xffd964, 2.4);
      FX.rings(new THREE.Vector3(piv.position.x, .12, piv.position.z), 0xffd964, 3,
        { maxR: 16, life: .6, gap: 40 });
      FX.dust(new THREE.Vector3(piv.position.x, 0, piv.position.z), 10, 0xcfc3a8, 18, 5);
      addShake(2);

      /* Fourteen punches, walking down the length of it, each one folding
         the steel a little further in. The box keeps its ribs and rails,
         so what deforms reads as a container being beaten flat. */
      var n = 0, PUNCH = 14;
      var iv = setInterval(function () {
        if (n >= PUNCH || typeof scene === 'undefined') { clearInterval(iv); return; }
        var k = n / PUNCH;
        var alongX = (k - .5) * LEN * .8;
        var at = piv.localToWorld(new THREE.Vector3(alongX, (Math.random() - .5) * 2, -2.9));
        box.scale.z = Math.max(.24, box.scale.z - .052);
        box.scale.y = Math.min(1.35, box.scale.y + .016);
        box.children.forEach(function (c) {
          c.rotation.x += (Math.random() - .5) * .16;
          c.position.y += (Math.random() - .5) * .12;
        });
        FX.impact(at, 0xffe08a, 1.3 + k);
        FX.debris(at, 6, 13, 0x6a6e78);
        FX.streaks(at, 0xffd964, 2, 11, .6);
        if (n % 3 === 0) FX.mangaLines(.35, .12);
        addShake(.5 + k);
        if (typeof hitstop === 'function' && n % 4 === 3) hitstop(.03);
        n++;
      }, 92);

      /* and the last one goes through it and into their head */
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        clearInterval(iv);
        FX.mangaLines(1, .34);
        FX.speedRing(p.clone(), 0xffe08a, 15, .34);
        FX.cross(behind.clone().add(up(1.4)), 0xffffff, 10, .3);
        FX.flash('#fff3c8', .4, .2);
        if (typeof hitstop === 'function') hitstop(.22);
        /* the fist comes out the far side */
        var arm = new THREE.Mesh(new THREE.CylinderGeometry(.26, .3, 4.4, 8),
          new THREE.MeshLambertMaterial({ color: 0xe8b98e }));
        arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
        arm.position.copy(piv.position).lerp(behind, .55).add(up(1.2));
        scene.add(arm);
        FX.impact(piv.position.clone(), 0xffd964, 3.8);
        FX.debris(piv.position.clone(), 26, 26, 0x6a6e78);
        FX.blood(behind.clone().add(up(1.2)), d, 18, 2.2);
        FX.blood(behind.clone().add(up(1.2)), up(1), 10, 1.6);
        addShake(3.2);
        setTimeout(function () {
          if (typeof scene === 'undefined') return;
          scene.remove(arm); arm.material.dispose();
          scene.remove(piv);
          piv.traverse(function (o) { if (o.isMesh) o.material.dispose(); });
          /* and out, a long way, with the box behind them */
          FX.speedRing(behind.clone().add(up(1.4)), 0xffe08a, 12, .3);
          G.fling(e, d.clone().multiplyScalar(78).setY(20), new THREE.Vector3(2, 1, 14));
          addShake(2.2);
        }, 430);
      }, 1420);
    } },

    /* 1j · dropped from above — nothing survives being under it */
    ha1j: { name: 'UNDER THE BOX', color: '#ffd964', hold: 1.7, run: function (e, d, p, G) {
      var FV = window.JJFEVER;
      var TALL = FV && FV.BOX ? FV.BOX.tall : 6.2;
      var box = FV && FV.buildContainer ? FV.buildContainer()
        : new THREE.Mesh(new THREE.BoxGeometry(15.5, TALL, 5.6),
            new THREE.MeshStandardMaterial({ color: 0x2fae62, roughness: .82, metalness: .25 }));
      var piv = new THREE.Group();
      piv.add(box);
      piv.rotation.y = Math.random() * Math.PI;
      piv.position.copy(p).add(up(34));
      scene.add(piv);
      /* and he comes down on top of it */
      FX.mangaLines(.7, .3);
      var t = 0, hit = false;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        var k = Math.min(1, t / .55);
        piv.position.y = p.y + TALL / 2 + 34 * (1 - k * k);
        piv.rotation.z = (1 - k) * 1.2;
        if (Math.random() < dt * 30) {
          FX.streaks(piv.position.clone().add(new THREE.Vector3(
            (Math.random() - .5) * 14, 0, (Math.random() - .5) * 5)), 0xffd964, 2, 16, .8);
        }
        if (k < 1) return true;
        if (!hit) {
          hit = true;
          FX.flash('#fff3c8', .6, .3);
          if (typeof hitstop === 'function') hitstop(.22);
          FX.impact(p.clone(), 0xffd964, 5);
          FX.rings(new THREE.Vector3(p.x, .12, p.z), 0xffd964, 6, { maxR: 34, life: .95, gap: 42 });
          FX.cracks(new THREE.Vector3(p.x, .1, p.z), 26, 36, 0x2a2418);
          FX.debris(new THREE.Vector3(p.x, .2, p.z), 34, 30, 0x6a6e78);
          FX.dust(new THREE.Vector3(p.x, 0, p.z), 20, 0xcfc3a8, 26, 7);
          addShake(4);
          /* into pieces, under fifteen metres of steel */
          G.dice(e, { dir: up(1), power: 2.4, cubes: 28 });
          return true;
        }
        /* it settles, and then it is gone */
        if (t < 1.35) return true;
        scene.remove(piv);
        piv.traverse(function (o) { if (o.isMesh) o.material.dispose(); });
        FX.dust(new THREE.Vector3(p.x, 0, p.z), 10, 0xcfc3a8, 16, 4);
        return false;
      } });
    } },

    /* 2 · five seconds, and every one of them is a hole */
    ha2: { name: 'FULL OF HOLES', color: '#ffd964', hold: 6.4, run: function (e, d, p, G) {
      FX.speedRing(p, 0xffe08a, 12, .3);
      FX.impact(p, 0xffd964, 2);
      if (typeof hitstop === 'function') hitstop(.16);
      var FV = window.JJFEVER;
      if (FV && FV.holeMode) {
        FV.holeMode(e, 5, function () {
          if (typeof scene === 'undefined') return;
          FX.mangaLines(.8, .3);
          FX.blood(p.clone(), d, 16, 2);
          G.sever(e, { dir: d, power: 1.9, cubes: 10 });
          addShake(2.4);
        });
      } else {
        setTimeout(function () {
          if (typeof scene === 'undefined') return;
          G.sever(e, { dir: d, power: 1.9 });
        }, 700);
      }
    } },

    /* 3 · whoever he was dragging. One of them goes up; two of them are
       put together. */
    ha3: { name: 'DRAGGED', color: '#ffd964', hold: 2.4, run: function (e, d, p, G) {
      var FV = window.JJFEVER;
      var pair = (FV && FV.drag ? FV.drag : []).filter(function (x) { return x && !x.dead; });
      var other = null;
      for (var i = 0; i < pair.length; i++) if (pair[i] !== e) { other = pair[i]; break; }

      if (!other) {
        /* --- One of them. Thrown up, and he goes up after them: the
           whole beat happens in the air, and they come apart there. --- */
        var TOP = 26;                       // how far up they are thrown
        var THEIR_Y = p.y + 2 + TOP;        // where their feet end up
        var HIS_Y = THEIR_Y + 4.6;          // and he has to be over them
        var UPTIME = .62, CHASE = .62, HANG = .34;
        FX.speedRing(p, 0xffe08a, 12, .32);
        FX.mangaLines(.7, .28);
        if (typeof hitstop === 'function') hitstop(.1);
        addShake(1.8);

        /* they go */
        var t = 0, diced = false;
        addFx({ t: 1e9, update: function (dt) {
          t += dt;
          if (!e || e.dead || typeof scene === 'undefined') return false;
          var k = Math.min(1, t / UPTIME);
          e.anchorT = .3;
          e.anchorPos.copy(p).add(up(2 + TOP * (1 - (1 - k) * (1 - k))));
          e.pos.lerp(e.anchorPos, Math.min(1, dt * 16));
          e.vel.set(0, 0, 0);
          if (Math.random() < dt * 26) {
            FX.streaks(e.pos.clone().add(up(2)), 0xffd964, 2, 14, .8);
          }
          /* held at the top until he arrives */
          return t < UPTIME + CHASE + HANG + .25;
        } });

        /* and he goes after them, and comes down through them */
        var FV = window.JJFEVER;
        if (mine() && FV && FV.perform) {
          FV.perform(UPTIME + CHASE + HANG + 1.1, function (a, dt, pl) {
            /* crouch, then launch */
            if (a.stage === 0 && a.t > UPTIME * .55) {
              a.stage = 1;
              /* enough to clear the top of them, from wherever he is */
              pl.vel.y = Math.sqrt(2 * 32 * Math.max(4, HIS_Y - pl.pos.y + 2));
              pl.pos.y = Math.max(pl.pos.y, .1);
              FX.rings(new THREE.Vector3(pl.pos.x, .12, pl.pos.z), 0xffd964, 3,
                { maxR: 14, life: .5, gap: 40 });
              FX.dust(new THREE.Vector3(pl.pos.x, 0, pl.pos.z), 8, 0xcfc3a8, 14, 4);
              addShake(1.2);
            }
            /* he holds his height over them while he winds up */
            if (a.stage === 1 && (pl.pos.y >= HIS_Y || pl.vel.y <= 0)) {
              a.stage = 2;
              a.hangT = a.t;
              FX.speedRing(pl.pos.clone().add(up(2)), 0xffe08a, 13, .3);
              FX.mangaLines(.8, .3);
            }
            if (a.stage === 2) {
              pl.vel.y = 0;
              pl.pos.y = HIS_Y;
              if (e && !e.dead) {
                /* face them */
                var to = e.pos.clone().sub(pl.pos).setY(0);
                if (to.lengthSq() > .01) pl.facing = Math.atan2(to.x, to.z);
              }
              if (a.t > a.hangT + HANG) {
                a.stage = 3;
                /* THE PUNCH, straight down through them */
                if (!diced && e && !e.dead) {
                  diced = true;
                  var hitAt = e.pos.clone().add(up(2.4));
                  FX.flash('#fff3c8', .55, .26);
                  FX.impact(hitAt, 0xffd964, 4.2);
                  FX.cross(hitAt, 0xffffff, 11, .32);
                  FX.speedRing(hitAt, 0xffe08a, 16, .34);
                  FX.mangaLines(1, .34);
                  FX.blood(hitAt, new THREE.Vector3(0, -1, 0), 20, 2.4);
                  if (typeof hitstop === 'function') hitstop(.24);
                  addShake(4);
                  e.anchorT = 0;
                  /* and there they come apart, in the air */
                  G.dice(e, { dir: new THREE.Vector3(0, -1, 0), power: 2.4, cubes: 28 });
                }
                pl.vel.y = -52;
              }
            }
            /* he lands */
            if (a.stage === 3 && pl.pos.y <= .2) {
              a.stage = 4;
              pl.pos.y = 0; pl.vel.y = 0;
              FX.rings(new THREE.Vector3(pl.pos.x, .12, pl.pos.z), 0xffd964, 4,
                { maxR: 22, life: .8, gap: 42 });
              FX.cracks(new THREE.Vector3(pl.pos.x, .1, pl.pos.z), 14, 20, 0x2a2418);
              FX.dust(new THREE.Vector3(pl.pos.x, 0, pl.pos.z), 12, 0xcfc3a8, 18, 5);
              addShake(2.4);
            }
          }, function (r, a, out) {
            /* the pose: throw, launch, wind up over the head, drive down */
            if (a.stage === 0) {                       // the throw
              var k = out(Math.min(1, a.t / (UPTIME * .55)));
              r.shoulderL.rotation.x = -2.9 * k; r.shoulderR.rotation.x = -2.9 * k;
              r.spine.rotation.x = -.3 * k;
              r.neck.rotation.x = -.5 * k;
              r.hipL.rotation.x = .3 * k; r.hipR.rotation.x = .3 * k;
              r.kneeL.rotation.x = .7 * k; r.kneeR.rotation.x = .7 * k;
              r.hips.position.y = r.hipsBaseY - .45 * k;
            } else if (a.stage <= 1) {                 // going up after them
              r.shoulderL.rotation.x = -2.9; r.shoulderR.rotation.x = -2.9;
              r.spine.rotation.x = -.24;
              r.neck.rotation.x = -.45;
              r.hipL.rotation.x = -.8; r.kneeL.rotation.x = 1.5;
              r.hipR.rotation.x = -.4; r.kneeR.rotation.x = 1.1;
            } else if (a.stage === 2) {                // the wind-up
              var w = out(Math.min(1, (a.t - (a.hangT || 0)) / HANG));
              r.shoulderL.rotation.x = -2.9 + .5 * w;
              r.shoulderR.rotation.x = -2.9 - .8 * w;
              r.shoulderR.rotation.z = -.5 * w;
              r.elbowR.rotation.x = -1.5 * w;
              r.spine.rotation.x = -.24 - .3 * w;
              r.spine.rotation.y = -.5 * w;
              r.neck.rotation.x = .3 * w;
              r.hipL.rotation.x = -.9; r.kneeL.rotation.x = 1.6;
              r.hipR.rotation.x = -.5; r.kneeR.rotation.x = 1.2;
            } else {                                   // the drive down
              var f = out(Math.min(1, (a.t - (a.hangT || 0) - HANG) / .2));
              r.shoulderR.rotation.x = 2.6 * f - 3.7 * (1 - f);
              r.shoulderL.rotation.x = -2.4 + 1.2 * f;
              r.elbowR.rotation.x = -1.5 * (1 - f);
              r.spine.rotation.x = -.54 + 1.1 * f;
              r.neck.rotation.x = .3 - .7 * f;
              r.hipL.rotation.x = -.6 + .5 * f; r.kneeL.rotation.x = 1.2 - .8 * f;
              r.hipR.rotation.x = -.3 + .3 * f; r.kneeR.rotation.x = .9 - .6 * f;
            }
          }, 'ha3one');
        } else {
          /* no fever module: at least finish them */
          setTimeout(function () {
            if (typeof scene === 'undefined' || !e || diced) return;
            diced = true;
            e.anchorT = 0;
            G.dice(e, { dir: new THREE.Vector3(0, -1, 0), power: 2.2, cubes: 26 });
            addShake(3);
          }, 1100);
        }
        return;
      }

      /* --- Two of them, and three beats: their heads are put together,
         then the heads come off, then what is left of them is closed. He
         has one in each hand for all of it. --- */
      var pair = [e, other];
      var mid = p.clone().lerp(other.pos.clone(), .5).add(up(2.8));
      var side = new THREE.Vector3(-d.z, 0, d.x);
      if (side.lengthSq() < .01) side.set(1, 0, 0);
      side.normalize();
      var SMASH = .74, PULL = .44, CLOSE = .5;
      var beheaded = false, crushed = false;
      var FV2 = window.JJFEVER;

      function hold(x, i, gap, lift) {
        if (!x || x.dead) return;
        x.anchorT = .3;
        x.anchorPos.copy(mid).addScaledVector(side, (i ? 1 : -1) * gap).add(up(lift || 0));
        x.pos.lerp(x.anchorPos, .55);
        x.vel.set(0, 0, 0);
        x.stunT = Math.max(x.stunT || 0, .5);
      }

      FX.speedRing(mid.clone(), 0xffe08a, 12, .3);
      addShake(1.6);

      var tt = 0;
      addFx({ t: 1e9, update: function (dt) {
        if (typeof scene === 'undefined') return false;
        tt += dt;
        /* 1 · in, until the two heads meet */
        if (tt < SMASH) {
          var k = tt / SMASH;
          var gap = 3.2 - 2.85 * k * k;
          pair.forEach(function (x, i) { hold(x, i, gap, 0); });
          if (Math.random() < dt * 20) {
            FX.streaks(mid.clone(), 0xffd964, 2, 12, .7);
            addShake(.4);
          }
          return true;
        }
        /* the smash itself */
        if (!beheaded) {
          beheaded = true;
          FX.flash('#fff3c8', .45, .22);
          FX.cross(mid.clone(), 0xffffff, 10, .3);
          FX.impact(mid.clone(), 0xffd964, 3.6);
          FX.mangaLines(.9, .32);
          if (typeof hitstop === 'function') hitstop(.22);
          FX.blood(mid.clone(), side.clone(), 16, 2.2);
          FX.blood(mid.clone(), side.clone().negate(), 16, 2.2);
          addShake(3.4);
        }
        /* 2 · and their heads come off as he pulls them apart */
        if (tt < SMASH + PULL) {
          var q = (tt - SMASH) / PULL;
          pair.forEach(function (x, i) { hold(x, i, .35 + 3.4 * q, 0); });
          if (!crushed && q > .5) {
            crushed = true;
            pair.forEach(function (x) {
              if (!x || x.dead || !window.JJGORE) return;
              try {
                window.JJGORE.sever(x, {
                  dir: new THREE.Vector3(0, 1, 0), power: 2, cubes: 14
                });
              } catch (err) {}
            });
            FX.speedRing(mid.clone(), 0xffe08a, 14, .3);
            addShake(2.6);
          }
          return true;
        }
        /* 3 · and then he closes what is left of them together */
        if (tt < SMASH + PULL + CLOSE) {
          var c = (tt - SMASH - PULL) / CLOSE;
          pair.forEach(function (x, i) { hold(x, i, 3.75 - 3.6 * c * c, 0); });
          return true;
        }
        FX.impact(mid.clone(), 0xffd964, 4);
        FX.cross(mid.clone(), 0xffffff, 9, .28);
        FX.blood(mid.clone(), up(1), 20, 2.6);
        FX.debris(mid.clone(), 14, 16, 0x5e0714);
        if (typeof hitstop === 'function') hitstop(.2);
        addShake(3.6);
        pair.forEach(function (x) { if (x) x.anchorT = 0; });
        return false;
      } });

      /* and he is doing it, with an arm out to each of them */
      if (mine() && FV2 && FV2.perform) {
        FV2.perform(SMASH + PULL + CLOSE + .3, function (a, dt, pl) {
          var to = mid.clone().sub(pl.pos).setY(0);
          if (to.lengthSq() > .01) pl.facing = Math.atan2(to.x, to.z);
          pl.vel.set(0, 0, 0);
        }, function (r, a, out) {
          var k;
          if (a.t < SMASH) {                        // arms coming together
            k = out(a.t / SMASH);
            r.shoulderL.rotation.x = -1.5; r.shoulderR.rotation.x = -1.5;
            r.shoulderL.rotation.z = 1.3 - 1.05 * k;
            r.shoulderR.rotation.z = -1.3 + 1.05 * k;
            r.elbowL.rotation.x = -.3; r.elbowR.rotation.x = -.3;
            r.spine.rotation.x = .1 + .2 * k;
            r.hips.position.y = r.hipsBaseY - .3 * k;
          } else if (a.t < SMASH + PULL) {          // and back apart
            k = out((a.t - SMASH) / PULL);
            r.shoulderL.rotation.x = -1.5; r.shoulderR.rotation.x = -1.5;
            r.shoulderL.rotation.z = .25 + 1.15 * k;
            r.shoulderR.rotation.z = -.25 - 1.15 * k;
            r.elbowL.rotation.x = -.3 + .2 * k; r.elbowR.rotation.x = -.3 + .2 * k;
            r.spine.rotation.x = .3 - .5 * k;
            r.neck.rotation.x = -.2 * k;
            r.hips.position.y = r.hipsBaseY - .3 + .3 * k;
          } else {                                   // and together again
            k = out((a.t - SMASH - PULL) / CLOSE);
            r.shoulderL.rotation.x = -1.5; r.shoulderR.rotation.x = -1.5;
            r.shoulderL.rotation.z = 1.4 - 1.2 * k;
            r.shoulderR.rotation.z = -1.4 + 1.2 * k;
            r.elbowL.rotation.x = -.1 - .3 * k; r.elbowR.rotation.x = -.1 - .3 * k;
            r.spine.rotation.x = -.2 + .5 * k;
            r.hips.position.y = r.hipsBaseY - .35 * k;
          }
        }, 'ha3two');
      }
    } },

    /* 4 · out, and a long way out */
    ha4: { name: 'OUT OF THE PARK', color: '#ffd964', hold: .9, run: function (e, d, p, G) {
      FX.rings(new THREE.Vector3(p.x, .12, p.z), 0xffd964, 5, { maxR: 26, life: .8, gap: 40 });
      FX.cracks(new THREE.Vector3(p.x, .1, p.z), 16, 24, 0x2a2418);
      FX.impact(p, 0xffd964, 3.4);
      FX.cross(p, 0xffffff, 9, .3);
      FX.mangaLines(.9, .3);
      if (typeof hitstop === 'function') hitstop(.2);
      addShake(3);
      var go = d.clone().multiplyScalar(120); go.y = 44;
      G.fling(e, go, new THREE.Vector3(1, 3, 8));
      /* the white line they leave behind them */
      var t = 0;
      addFx({ t: 3.4, update: function (dt) {
        this.t -= dt; t += dt;
        if (!e || !e.pos) return false;
        var at = e.pos.clone().add(up(2.4));
        FX.streaks(at, 0xffffff, 2, 6, .7);
        var m = FX.billboard(FX.T.smoke, 0xffffff, .5);
        m.scale.setScalar(4.5);
        m.position.copy(at);
        scene.add(m);
        var tt = 0;
        addFx({ t: .7, update: function (dd) {
          this.t -= dd; tt += dd;
          FX.faceCam(m, 0);
          m.scale.setScalar(4.5 + tt * 5);
          m.material.opacity = .5 * (this.t / .7);
          if (this.t <= 0) { scene.remove(m); m.material.dispose(); return false; }
          return true;
        } });
        return this.t > 0;
      } });
    } },

    /* =================================================================
       MEGUMI
       Not one of these is Megumi doing something. He opens a shadow and
       something comes out of it and does the thing — so every one of
       these is a shikigami finishing somebody, built out of the same
       models the moves are, and he stands there while it happens.
       ================================================================ */

    /* 1 · the two of them, from both sides at once */
    mg1: { name: 'TAKEN DOWN', color: '#7b7bb8', hold: 1.9, run: function (e, d, p, G) {
      var MG = window.JJMEGUMI;
      var side = new THREE.Vector3(-d.z, 0, d.x);
      var made = [];
      if (MG && MG.pool) MG.pool(new THREE.Vector3(p.x, 0, p.z), 7, 1.4);
      FX.impact(p, 0x7b7bb8, 2);
      addShake(1.4);

      /* one comes in from each side, and they meet on them */
      [-1, 1].forEach(function (s, i) {
        if (!MG || !MG.buildDog) return;
        var dog = MG.buildDog(i === 1);
        var from = p.clone().addScaledVector(side, s * 16).add(up(-2.6));
        dog.position.copy(from);
        dog.rotation.y = Math.atan2(-s * side.x, -s * side.z);
        scene.add(dog);
        made.push(dog);
        var t = 0, bound = 0, bit = false;
        addFx({ t: 1e9, update: function (dt) {
          t += dt; bound += dt * 17;
          var k = Math.min(1, t / .45);
          dog.position.lerpVectors(from, p.clone().addScaledVector(side, s * 2.2).add(up(-2.6)), k);
          dog.position.y = -2.6 + Math.abs(Math.sin(bound)) * .6;
          if (dog.__legs) dog.__legs.forEach(function (l, n) {
            l.rotation.x = Math.sin(bound + (n < 2 ? 0 : Math.PI)) * 1;
          });
          if (MG.wisp && Math.random() < dt * 16) MG.wisp(dog.position.clone().add(up(1)), 1);
          if (k >= 1 && !bit) {
            bit = true;
            FX.impact(p.clone(), i ? 0xa9b6e8 : 0x7b7bb8, 2.2);
            FX.slash(p.clone(), side.clone().multiplyScalar(s), 0xe8ecf5, 5, .18);
            FX.blood(p.clone(), side.clone().multiplyScalar(s), 10, 1.6);
            addShake(1.2);
            if (typeof hitstop === 'function') hitstop(.07);
          }
          /* and they pull, in opposite directions */
          if (bit) {
            dog.position.addScaledVector(side, s * dt * 5);
            if (e && !e.dead) {
              e.anchorT = .3;
              e.anchorPos.copy(p).add(up(-1.4));
              e.pos.lerp(e.anchorPos, Math.min(1, dt * 8));
            }
          }
          return t < 1.5;
        } });
      });

      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.mangaLines(.9, .3);
        FX.cross(p.clone(), 0xffffff, 8, .28);
        FX.impact(p.clone(), 0x7b7bb8, 3.2);
        if (typeof hitstop === 'function') hitstop(.2);
        if (e) e.anchorT = 0;
        G.dice(e, { dir: side, power: 2, cubes: 22 });
        addShake(2.8);
        made.forEach(function (dog) { if (MG && MG.dismiss) MG.dismiss(dog, dog.position.clone()); });
      }, 1500);
    } },

    /* 2 · up into the dark, and the sky comes down on them */
    mg2: { name: 'OUT OF THE SKY', color: '#a9b6e8', hold: 2.1, run: function (e, d, p, G) {
      var MG = window.JJMEGUMI;
      var TOP = 24;
      FX.speedRing(p, 0xa9b6e8, 12, .3);
      addShake(1.4);

      /* it takes them up */
      var bird = (MG && MG.buildNue) ? MG.buildNue() : null;
      if (bird) {
        bird.position.copy(p).add(up(3.4));
        bird.rotation.y = Math.atan2(-d.x, -d.z);
        scene.add(bird);
      }
      var t = 0, dropped = false, flap = 0;
      addFx({ t: 1e9, update: function (dt) {
        t += dt; flap += dt * 11;
        var lift = Math.min(1, t / .7);
        if (bird) {
          bird.position.copy(p).add(up(3.4 + TOP * lift));
          if (bird.__wings) bird.__wings.forEach(function (w, i) {
            w.rotation.z = Math.sin(flap) * .7 * (i ? -1 : 1);
          });
          if (MG.wisp && Math.random() < dt * 20) MG.wisp(bird.position.clone(), 1);
        }
        if (e && !e.dead && !dropped) {
          e.anchorT = .3;
          e.anchorPos.copy(p).add(up(TOP * lift));
          e.pos.lerp(e.anchorPos, Math.min(1, dt * 10));
          e.vel.set(0, 0, 0);
        }
        if (!dropped && t > .95) {
          dropped = true;
          /* the lightning, straight down the line they are on */
          var at = new THREE.Vector3(p.x, 0, p.z);
          for (var b = 0; b < 9; b++) {
            var bolt = FX.billboard(FX.T.bolt, b % 2 ? 0xa9b6e8 : 0xffffff, 1);
            var a1 = at.clone().add(new THREE.Vector3(
              (Math.random() - .5) * 5, TOP + 4 + Math.random() * 4, (Math.random() - .5) * 5));
            var a2 = at.clone().add(new THREE.Vector3(
              (Math.random() - .5) * 4, .3, (Math.random() - .5) * 4));
            var len = FX.orientAlong(bolt, a1, a2);
            bolt.scale.set(len, len * .26, 1);
            scene.add(bolt);
            (function (bolt) {
              var bt = .3;
              addFx({ t: bt, update: function (dd) {
                this.t -= dd;
                bolt.material.opacity = Math.max(0, this.t / bt);
                if (this.t <= 0) { scene.remove(bolt); bolt.material.dispose(); return false; }
                return true;
              } });
            })(bolt);
          }
          FX.flash('#e6edff', .6, .3);
          FX.mangaLines(1, .34);
          if (typeof hitstop === 'function') hitstop(.22);
          addShake(3.4);
          if (e) e.anchorT = 0;
          G.burn(e, { dir: new THREE.Vector3(0, -1, 0) });
          FX.rings(new THREE.Vector3(p.x, .12, p.z), 0xa9b6e8, 4, { maxR: 20, life: .8, gap: 44 });
        }
        if (t < 1.9) return true;
        if (bird && MG && MG.dismiss) MG.dismiss(bird, bird.position.clone());
        return false;
      } });
    } },

    /* 3 · the ground opens, and it does not give them back */
    mg3: { name: 'SWALLOWED', color: '#7b7bb8', hold: 1.8, run: function (e, d, p, G) {
      var MG = window.JJMEGUMI;
      var at = new THREE.Vector3(p.x, 0, p.z);
      if (MG && MG.pool) MG.pool(at.clone(), 9, 1.5);
      FX.cracks(at.clone(), 12, 16, 0x1a1a24);
      addShake(1.6);

      var snake = (MG && MG.buildSnake) ? MG.buildSnake() : null;
      if (snake) {
        snake.position.set(at.x, -12, at.z);
        snake.rotation.y = Math.atan2(-d.x, -d.z);
        snake.rotation.x = -1.2;
        scene.add(snake);
      }
      var t = 0, shut = false;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (snake) {
          if (t < .5) {
            var k = t / .5;
            snake.position.y = -12 + k * 14;
            snake.rotation.x = -1.2 + k * .7;
            if (snake.__jaw) snake.__jaw.rotation.x = k * 1.3;
          } else if (!shut) {
            shut = true;
            if (snake.__jaw) snake.__jaw.rotation.x = .05;
            FX.impact(at.clone().add(up(3)), 0x7b7bb8, 3.4);
            FX.blood(at.clone().add(up(3)), d.clone(), 16, 2);
            FX.mangaLines(.9, .3);
            if (typeof hitstop === 'function') hitstop(.2);
            addShake(2.6);
            /* it takes them, and there is nothing to fall over */
            G.erase(e, { dir: d, power: 1.6 });
          } else {
            /* and goes back down with them */
            snake.position.y -= dt * 13;
            snake.rotation.x += dt * .9;
            if (MG.wisp && Math.random() < dt * 26) MG.wisp(snake.position.clone(), 1);
          }
        }
        if (t < 1.5) return true;
        if (snake) {
          scene.remove(snake);
          snake.traverse(function (o) { if (o.isMesh) o.material.dispose(); });
        }
        FX.rings(at.clone(), 0x7b7bb8, 3, { maxR: 14, life: .7, gap: 46 });
        return false;
      } });
    } },

    /* 4 · nine metres of it, and they are underneath */
    mg4: { name: 'UNDERFOOT', color: '#cfe2f2', hold: 1.6, run: function (e, d, p, G) {
      var MG = window.JJMEGUMI;
      var at = new THREE.Vector3(p.x, 0, p.z);
      if (MG && MG.pool) MG.pool(at.clone(), 14, 1.3);
      addShake(1.2);

      var el = (MG && MG.buildElephant) ? MG.buildElephant() : null;
      if (el) {
        el.position.set(at.x, 34, at.z);
        el.rotation.y = Math.atan2(-d.x, -d.z);
        scene.add(el);
      }
      /* they are held where it is going to land */
      var t = 0, landed = false;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (e && !e.dead && !landed) {
          e.anchorT = .3;
          e.anchorPos.copy(at).add(up(.2));
          e.pos.lerp(e.anchorPos, Math.min(1, dt * 10));
          e.vel.set(0, 0, 0);
        }
        if (el && !landed) {
          var k = Math.min(1, t / .62);
          el.position.y = 34 * (1 - k * k);
          if (Math.random() < dt * 26) {
            FX.streaks(el.position.clone().add(up(2)), 0xbfc6d4, 2, 16, .8);
          }
          if (k >= 1) {
            landed = true;
            el.position.y = 0;
            FX.flash('#e8eef6', .5, .26);
            FX.impact(at.clone(), 0xcfe2f2, 4.4);
            FX.rings(at.clone(), 0x9fb0c8, 6, { maxR: 34, life: .95, gap: 42 });
            FX.cracks(at.clone(), 24, 34, 0x1a1a24);
            FX.debris(at.clone(), 30, 28, 0x2a2a38);
            FX.dust(at.clone(), 18, 0xbfc6d4, 24, 6);
            FX.mangaLines(1, .32);
            if (typeof hitstop === 'function') hitstop(.24);
            addShake(4);
            if (e) e.anchorT = 0;
            G.flatten(e, { dir: new THREE.Vector3(0, -1, 0), power: 2 });
          }
        }
        if (t < 1.4) return true;
        if (el && MG && MG.dismiss) MG.dismiss(el, el.position.clone().add(up(4)));
        return false;
      } });
    } },

    /* R · they go under it, and the shadow keeps what it is given */
    mgr: { name: 'INTO THE SHADOW', color: '#7b7bb8', hold: 2, run: function (e, d, p, G) {
      var MG = window.JJMEGUMI;
      var at = new THREE.Vector3(p.x, 0, p.z);
      if (MG && MG.pool) MG.pool(at.clone(), 8, 1.6);
      FX.speedRing(p, 0x7b7bb8, 11, .3);
      addShake(1);

      /* a great many of them, all going over the same spot */
      var n = 0;
      var iv = setInterval(function () {
        if (n++ > 16 || typeof scene === 'undefined') { clearInterval(iv); return; }
        if (!MG || !MG.buildRabbit) return;
        var r = MG.buildRabbit();
        var a = Math.random() * Math.PI * 2;
        var from = at.clone().add(new THREE.Vector3(Math.cos(a) * 13, 0, Math.sin(a) * 13));
        var to = at.clone().add(new THREE.Vector3(Math.cos(a) * -13, 0, Math.sin(a) * -13));
        r.position.copy(from);
        r.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
        scene.add(r);
        (function (r, from, to) {
          var t = 0, hop = 0, life = .55;
          addFx({ t: life, update: function (dt) {
            this.t -= dt; t += dt; hop += dt * 26;
            r.position.lerpVectors(from, to, t / life);
            r.position.y = Math.abs(Math.sin(hop)) * 1.6;
            if (this.t <= 0) {
              scene.remove(r);
              r.traverse(function (o) { if (o.isMesh) o.material.dispose(); });
              return false;
            }
            return true;
          } });
        })(r, from, to);
        FX.impact(at.clone().add(up(1.2)), 0x7b7bb8, .9);
        if (e && !e.dead) {
          e.anchorT = .3;
          e.anchorPos.copy(at).add(up(.4 - n * .06));
          e.pos.lerp(e.anchorPos, .4);
        }
        addShake(.4);
      }, 80);

      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        clearInterval(iv);
        FX.mangaLines(.9, .3);
        FX.impact(at.clone(), 0x7b7bb8, 3.4);
        FX.rings(at.clone(), 0x7b7bb8, 4, { maxR: 18, life: .8, gap: 44 });
        if (typeof hitstop === 'function') hitstop(.2);
        addShake(2.6);
        if (e) e.anchorT = 0;
        /* the swarm clears and the floor is empty */
        G.erase(e, { dir: d, power: 1.4 });
      }, 1450);
    } },

    /* =================================================================
       MEGUMI AWAKENED
       The four awakened moves are a chain — each one is the one before
       it merged into something further along — so their finishers are
       built the same way. Not one hit and a body: three beats, and the
       thing that lands in the third could not have landed in the first.
       They run to about three seconds, which is long enough to have
       parts and short enough that nobody is waiting through it.
       ============================================================== */

    /* the caster's part, when it is our body he is standing in. On every
       other screen he arrives in his own packets, so this does nothing */
    /* 1 · TOTALITY — one hound, three passes, and it never leaves the
       ground until the last one */
    ga1: { name: 'RUN TO GROUND', color: '#4fd8ff', hold: 2.6, run: function (e, d, p, G) {
      var GD = window.JJGARDEN, MG = window.JJMEGUMI;
      var ARC = (GD && GD.ARC) || 0x4fd8ff, ARC2 = (GD && GD.ARC2) || 0x9fe8ff;
      var side = new THREE.Vector3(-d.z, 0, d.x).normalize();
      var floor = new THREE.Vector3(p.x, 0, p.z);

      /* one pass of it: in from twenty out, through them, and gone */
      function pass(travel, life, delay, onHit) {
        setTimeout(function () {
          if (typeof scene === 'undefined' || !GD || !GD.buildTotality) { if (onHit) onHit(null, travel); return; }
          var g = GD.buildTotality();
          var from = floor.clone().addScaledVector(travel, -20);
          var to = floor.clone().addScaledVector(travel, 20);
          g.position.copy(from);
          g.rotation.y = Math.atan2(travel.x, travel.z);
          scene.add(g);
          if (MG && MG.pool) MG.pool(new THREE.Vector3(from.x, 0, from.z), 6, .5);
          var t = 0, bound = 0, hit = false;
          addFx({ t: 1e9, update: function (dt) {
            t += dt; bound += dt * 21;
            var k = Math.min(1, t / life);
            g.position.lerpVectors(from, to, k);
            g.position.y = Math.abs(Math.sin(bound)) * .8;
            if (g.__legs) g.__legs.forEach(function (l, n) {
              l.rotation.x = Math.sin(bound + (n % 2 ? Math.PI : 0)) * 1.1;
            });
            if (GD.arc && Math.random() < dt * 12) {
              GD.arc(g.position.clone().add(up(1.8)), travel.clone().negate(),
                { reach: 6, depth: 1, life: .18 });
            }
            if (!hit && k >= .5) { hit = true; if (onHit) onHit(g, travel); }
            if (k >= 1) {
              if (MG && MG.dismiss) MG.dismiss(g, g.position.clone()); else scene.remove(g);
              return false;
            }
            return true;
          } });
        }, delay);
      }

      FX.speedRing(p, ARC2, 12, .3);
      if (MG && MG.pool) MG.pool(floor.clone(), 8, 2.4);
      addShake(1.2);

      /* BEAT ONE — through the back of the legs. They go down on a knee */
      pass(d.clone().negate(), .62, 0, function (g, tr) {
        FX.impact(p.clone().add(up(-1.6)), ARC, 2.2);
        FX.slash(p.clone().add(up(-1.4)), tr, 0xe8ecf5, 5, .16);
        FX.blood(p.clone().add(up(-1.4)), tr, 9, 1.4);
        if (typeof hitstop === 'function') hitstop(.06);
        addShake(1);
        if (e && !e.dead) {
          e.anchorT = .5;
          e.anchorPos.copy(floor).add(up(1.1));
          e.stunT = Math.max(e.stunT || 0, .6);
        }
      });

      /* BEAT TWO — back across the other way, and now they are flat */
      pass(side.clone(), .58, 850, function (g, tr) {
        FX.impact(p.clone().add(up(-.8)), ARC2, 2.8);
        FX.slash(p.clone().add(up(-.8)), tr, 0xffffff, 7, .18);
        FX.blood(p.clone().add(up(-.8)), tr, 13, 1.9);
        FX.mangaLines(.7, .24);
        if (typeof hitstop === 'function') hitstop(.09);
        addShake(1.8);
        if (e && !e.dead) {
          e.anchorT = .5;
          e.anchorPos.copy(floor).addScaledVector(tr, 3.2).add(up(.5));
        }
      });

      /* BEAT THREE — straight up out of the floor under them. Under where
         they ARE: the second pass skids them sideways, and a shadow that
         opens where they used to be is a shadow that misses. */
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        var spot = (e && !e.dead) ? new THREE.Vector3(e.pos.x, 0, e.pos.z) : floor.clone();
        if (MG && MG.pool) MG.pool(spot.clone(), 5.5, 1.2);
        FX.rings(new THREE.Vector3(spot.x, .12, spot.z), ARC, 3,
          { maxR: 12, life: .5, gap: 44 });
        var g = (GD && GD.buildTotality) ? GD.buildTotality() : null;
        if (g) {
          g.position.set(spot.x, -9, spot.z);
          g.rotation.y = Math.atan2(-d.x, -d.z);
          g.rotation.x = -1.15;                       // nose up, out of the ground
          scene.add(g);
        }
        var t = 0, bit = false;
        addFx({ t: 1e9, update: function (dt) {
          t += dt;
          if (g) g.position.y = -9 + 34 * t;
          if (GD && GD.arc && Math.random() < dt * 26) {
            GD.arc(new THREE.Vector3(spot.x, Math.max(0, (g ? g.position.y : 0) + 1), spot.z),
              new THREE.Vector3((Math.random() - .5), 1, (Math.random() - .5)),
              { reach: 9, depth: 2, life: .24 });
          }
          if (e && !e.dead && !bit) {
            e.anchorT = .4;
            e.anchorPos.copy(spot).add(up(Math.max(0, 34 * t - 7)));
            e.pos.lerp(e.anchorPos, Math.min(1, dt * 14));
            e.vel.set(0, 0, 0);
          }
          if (!bit && t > .34) {
            bit = true;
            var hitAt = spot.clone().add(up(6));
            FX.flash('#cdf0ff', .5, .26);
            FX.impact(hitAt, ARC2, 4);
            FX.cross(hitAt, 0xffffff, 10, .3);
            FX.speedRing(hitAt, ARC, 16, .34);
            FX.mangaLines(1, .32);
            if (typeof hitstop === 'function') hitstop(.2);
            addShake(3.4);
            if (e) e.anchorT = 0;
            G.dice(e, { dir: up(1), power: 2.2, cubes: 24 });
          }
          if (t > .9) {
            if (g) { if (MG && MG.dismiss) MG.dismiss(g, g.position.clone()); else scene.remove(g); }
            return false;
          }
          return true;
        } });
      }, 1750);

      /* and he is the one doing it: point, sign, and drive it down */
      if (mine() && window.JJFEVER && window.JJFEVER.perform) {
        window.JJFEVER.perform(2.7, function (a, dt, pl) {
          var to = floor.clone().sub(pl.pos).setY(0);
          if (to.lengthSq() > .01) pl.facing = Math.atan2(to.x, to.z);
          pl.vel.set(0, 0, 0);
        }, null, 'mgaOne');
      }
    } },

    /* 2 · CHIMERA — three different things share a body, so they take
       hold of them in three places and then disagree about where to go */
    ga2: { name: 'PULLED THREE WAYS', color: '#9fe8ff', hold: 2.75, run: function (e, d, p, G) {
      var GD = window.JJGARDEN, MG = window.JJMEGUMI;
      var ARC = (GD && GD.ARC) || 0x4fd8ff, ARC2 = (GD && GD.ARC2) || 0x9fe8ff;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      var TOP = 13;
      var lift = 0, made = [];

      function chimeraAt(ang, dist, y) {
        var away = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
        var at = floor.clone().addScaledVector(away, dist).add(up(y));
        var c = (GD && GD.buildChimera) ? GD.buildChimera() : null;
        if (!c) return null;
        c.position.copy(at);
        c.rotation.y = Math.atan2(-away.x, -away.z);
        scene.add(c);
        made.push(c);
        if (MG && MG.pool) MG.pool(new THREE.Vector3(at.x, 0, at.z), 5, 1.2);
        return c;
      }
      /* the tongue is the part that reaches: stretch it from the body to
         wherever they are, every frame */
      function reach(c, target) {
        if (!c || !c.__tongue) return;
        var len = c.position.distanceTo(target);
        var seg = Math.max(.6, len / c.__tongue.length);
        c.__tongue.forEach(function (m, i) {
          m.position.z = 2 + seg * i;
          m.scale.z = seg / 1.2;
        });
        var to = target.clone().sub(c.position);
        c.rotation.y = Math.atan2(to.x, to.z);
        c.rotation.x = -Math.asin(Math.max(-1, Math.min(1, to.y / Math.max(.01, len))));
      }

      FX.speedRing(p, ARC2, 13, .32);
      addShake(1.3);

      /* Everything in this stands on the FAR side of them. The first cut
         of it put one of the three on the caster's own side, at fourteen
         units — which is where the chase camera lives, so the last beat
         played from inside a chimera's ribs. */
      var far = Math.atan2(d.z, d.x);

      /* BEAT ONE — the tongue comes out of a shadow and takes them off
         their feet, in toward the jaws */
      var lead = chimeraAt(far, 15, 1.4);
      var t1 = 0, caught = false;
      addFx({ t: 1e9, update: function (dt) {
        t1 += dt;
        if (!e || e.dead || typeof scene === 'undefined') return false;
        var tgt = e.pos.clone().add(up(2.4));
        if (lead) {
          if (lead.__wings) lead.__wings.forEach(function (w, i) {
            w.rotation.z = Math.sin(t1 * 12) * .6 * (i ? -1 : 1);
          });
          if (lead.__jaw) lead.__jaw.rotation.x = .4 + Math.sin(t1 * 7) * .25;
          reach(lead, tgt);
        }
        if (!caught && t1 > .28) {
          caught = true;
          FX.impact(tgt.clone(), 0x5e2038, 2);
          FX.blood(tgt.clone(), d.clone().negate(), 8, 1.3);
          if (typeof hitstop === 'function') hitstop(.06);
          addShake(1.1);
        }
        /* and it hauls them in */
        if (caught && lead) {
          var pull = lead.position.clone().sub(e.pos).setY(0);
          if (pull.length() > 5) pull.normalize(); else pull.set(0, 0, 0);
          e.anchorT = .4;
          e.anchorPos.copy(e.pos).addScaledVector(pull, dt * 17).add(up(0));
          e.anchorPos.y = Math.max(0, e.pos.y);
          e.pos.lerp(e.anchorPos, Math.min(1, dt * 12));
          e.vel.set(0, 0, 0);
          if (GD && GD.arc && Math.random() < dt * 9) {
            GD.arc(tgt.clone(), new THREE.Vector3((Math.random() - .5), .6, (Math.random() - .5)),
              { reach: 6, depth: 1, life: .18 });
          }
        }
        return t1 < .88;
      } });

      /* BEAT TWO — the wings, and the jaws, and they are off the floor */
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.speedRing(p.clone(), ARC, 15, .3);
        FX.mangaLines(.8, .26);
        addShake(1.6);
        var t2 = 0, shakes = 0;
        addFx({ t: 1e9, update: function (dt) {
          t2 += dt;
          if (!e || e.dead || typeof scene === 'undefined') return false;
          lift = Math.min(1, t2 / .5);
          if (lead) {
            lead.position.y = 1.4 + TOP * lift;
            if (lead.__wings) lead.__wings.forEach(function (w, i) {
              w.rotation.z = Math.sin(t2 * 20) * .9 * (i ? -1 : 1);
            });
            if (lead.__jaw) lead.__jaw.rotation.x = .12 + Math.abs(Math.sin(t2 * 14)) * .5;
            reach(lead, e.pos.clone().add(up(2.4)));
          }
          e.anchorT = .4;
          /* shaken side to side in the jaws */
          var wob = Math.sin(t2 * 26) * .9 * lift;
          e.anchorPos.set(floor.x + wob, TOP * lift, floor.z - wob * .6);
          e.pos.lerp(e.anchorPos, Math.min(1, dt * 15));
          e.vel.set(0, 0, 0);
          if (t2 > .5 && shakes < 4 && t2 > .5 + shakes * .13) {
            shakes++;
            var at2 = e.pos.clone().add(up(2.4));
            FX.impact(at2, shakes % 2 ? ARC2 : 0x5e2038, 1.6);
            FX.blood(at2, new THREE.Vector3(wob, 0, 0), 7, 1.2);
            addShake(.8);
          }
          return t2 < .92;
        } });
      }, 900);

      /* BEAT THREE — three of them, one hold each, and they pull */
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        var three = [];
        for (var i = -1; i <= 1; i++) {
          var c = chimeraAt(far + i * 1.9, 19, TOP - 1);
          if (c) three.push(c);
        }
        FX.flash('#cdf0ff', .4, .22);
        FX.mangaLines(1, .3);
        addShake(2);
        var t3 = 0, torn = false;
        addFx({ t: 1e9, update: function (dt) {
          t3 += dt;
          if (typeof scene === 'undefined') return false;
          var tgt = e && !e.dead ? e.pos.clone().add(up(2.4)) : floor.clone().add(up(TOP));
          three.forEach(function (c, i) {
            reach(c, tgt);
            /* each of them backs off, and they are all holding on */
            var away = c.position.clone().sub(floor).setY(0).normalize();
            c.position.addScaledVector(away, dt * (torn ? 22 : 3.4));
            if (c.__jaw) c.__jaw.rotation.x = .1;
          });
          if (e && !e.dead && !torn) {
            e.anchorT = .4;
            e.anchorPos.set(floor.x, TOP, floor.z);
            e.pos.lerp(e.anchorPos, Math.min(1, dt * 12));
            e.vel.set(0, 0, 0);
            if (GD && GD.arc && Math.random() < dt * 20) {
              GD.arc(tgt.clone(), new THREE.Vector3((Math.random() - .5), (Math.random() - .5), (Math.random() - .5)),
                { reach: 8, depth: 2, life: .2 });
            }
          }
          if (!torn && t3 > .55) {
            torn = true;
            FX.flash('#ffffff', .6, .26);
            FX.impact(tgt.clone(), 0xffffff, 4.2);
            FX.cross(tgt.clone(), 0xffffff, 11, .3);
            FX.blood(tgt.clone(), new THREE.Vector3(1, 0, 0), 24, 2.6);
            FX.mangaLines(1, .34);
            if (typeof hitstop === 'function') hitstop(.22);
            addShake(3.6);
            if (e) e.anchorT = 0;
            G.dice(e, { dir: new THREE.Vector3(1, .2, 0), power: 2.6, cubes: 28 });
          }
          if (t3 > 1.15) {
            made.forEach(function (c) {
              if (MG && MG.dismiss) MG.dismiss(c, c.position.clone()); else scene.remove(c);
            });
            return false;
          }
          return true;
        } });
      }, 1850);

      if (mine() && window.JJFEVER && window.JJFEVER.perform) {
        window.JJFEVER.perform(2.85, function (a, dt, pl) {
          var to = floor.clone().sub(pl.pos).setY(0);
          if (to.lengthSq() > .01) pl.facing = Math.atan2(to.x, to.z);
          pl.vel.set(0, 0, 0);
        }, null, 'mgaTwo');
      }
    } },

    /* 3 · TOAD — every other shikigami closes the distance itself. This
       one closes it with them on the end of the tongue, and then there
       is nowhere left to be brought to except the mouth */
    ga3: { name: 'REELED IN', color: '#5e2038', hold: 3.05, run: function (e, d, p, G) {
      var GD = window.JJGARDEN, MG = window.JJMEGUMI;
      var ARC = (GD && GD.ARC) || 0x4fd8ff, ARC2 = (GD && GD.ARC2) || 0x9fe8ff;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      /* it sits on the far side of them and pulls towards itself, which
         is away from the camera — so nothing it does covers the shot */
      var stand = floor.clone().addScaledVector(d, 11);
      var g = (GD && GD.buildToad) ? GD.buildToad() : null;
      var mouth = function () {
        return stand.clone().add(up(1.8)).addScaledVector(d, -3.4);
      };

      if (MG && MG.pool) MG.pool(new THREE.Vector3(stand.x, 0, stand.z), 9, 3.4);
      if (g) {
        g.position.set(stand.x, -7, stand.z);
        g.rotation.y = Math.atan2(-d.x, -d.z);
        scene.add(g);
      }
      FX.speedRing(p, 0x5e2038, 12, .3);
      addShake(1.2);

      var t = 0, phase = 0, beat2 = 0, slams = 0;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined') return false;
        if (g) g.position.y = Math.min(0, -7 + 26 * t);

        /* BEAT ONE — the tongue is round them and they are coming */
        if (phase === 0) {
          if (t > .3 && g && g.__jaw) g.__jaw.rotation.x = .9;
          if (t > .3 && e && !e.dead) {
            var want = mouth().clone().addScaledVector(d, -5);
            e.anchorT = .4;
            e.anchorPos.copy(want);
            e.pos.lerp(want, Math.min(1, dt * 3.4));
            e.vel.set(0, 0, 0);
            e.stunT = Math.max(e.stunT || 0, .5);
            if (g && GD && GD.tongueAt) GD.tongueAt(g, mouth(), e.pos.clone().add(up(1.6)));
            if (Math.random() < dt * 12) {
              FX.blood(e.pos.clone().add(up(1.8)), d.clone().negate(), 3, .9);
            }
          }
          if (t > .95) {
            phase = 1; beat2 = t;
            FX.mangaLines(.7, .24);
            if (typeof hitstop === 'function') hitstop(.08);
          }
          return true;
        }

        /* BEAT TWO — it whips them off the floor, twice */
        if (phase === 1) {
          var k = (t - beat2) / .5;
          if (e && !e.dead) {
            var side = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(Math.sin(k * 9) * 5);
            e.anchorT = .4;
            e.anchorPos.copy(mouth()).addScaledVector(d, -4).add(side);
            e.anchorPos.y = Math.max(0, 3 + Math.sin(k * 9) * 3);
            e.pos.lerp(e.anchorPos, Math.min(1, dt * 12));
            e.vel.set(0, 0, 0);
            if (g && GD && GD.tongueAt) GD.tongueAt(g, mouth(), e.pos.clone().add(up(1.4)));
          }
          if (slams < 2 && k > .18 + slams * .34) {
            slams++;
            var hit = e && !e.dead ? e.pos.clone() : floor.clone();
            FX.impact(hit.clone().add(up(1)), 0x5e2038, 2.6);
            FX.cracks(new THREE.Vector3(hit.x, .06, hit.z), 9, 13, 0x2a1018);
            FX.blood(hit.clone().add(up(1)), up(1), 11, 1.7);
            FX.dust(new THREE.Vector3(hit.x, 0, hit.z), 8, 0xb9bfc9, 11, 3);
            addShake(1.8);
            if (typeof hitstop === 'function') hitstop(.08);
          }
          if (t > beat2 + .95) { phase = 2; beat2 = t; }
          return true;
        }

        /* BEAT THREE — and into the mouth */
        if (phase === 2) {
          if (e && !e.dead) {
            e.anchorT = .4;
            e.anchorPos.copy(mouth());
            e.pos.lerp(e.anchorPos, Math.min(1, dt * 7));
            e.vel.set(0, 0, 0);
            if (g && GD && GD.tongueAt) GD.tongueAt(g, mouth(), e.pos.clone().add(up(1.2)));
            if (GD && GD.arc && Math.random() < dt * 16) {
              GD.arc(e.pos.clone().add(up(1.6)),
                new THREE.Vector3((Math.random() - .5), .7, (Math.random() - .5)),
                { reach: 8, depth: 2, life: .2 });
            }
          }
          if (t > beat2 + .55) {
            phase = 3;
            var at = mouth();
            if (g && g.__jaw) g.__jaw.rotation.x = 0;
            if (g && GD && GD.tongueIn) GD.tongueIn(g);
            FX.flash('#ffd9dd', .5, .26);
            FX.impact(at.clone(), 0xffffff, 4);
            FX.cross(at.clone(), ARC2, 10, .3);
            FX.blood(at.clone(), d.clone().negate(), 24, 2.6);
            FX.bloodRings && FX.bloodRings(at.clone(), 4, { maxR: 18, life: .8, gap: 40 });
            FX.mangaLines(1, .34);
            if (typeof hitstop === 'function') hitstop(.24);
            addShake(3.6);
            if (e) e.anchorT = 0;
            G.sever(e, { dir: d.clone().negate(), power: 2.6, cubes: 20 });
          }
          return true;
        }

        /* and it takes what is left back down with it */
        if (t > beat2 + 1.15) {
          if (g) {
            if (MG && MG.pool) MG.pool(new THREE.Vector3(stand.x, 0, stand.z), 8, 1);
            var s2 = 0;
            addFx({ t: 1e9, update: function (dd) {
              s2 += dd;
              g.position.y = -18 * s2;
              if (s2 > .8) {
                scene.remove(g);
                g.traverse(function (o) { if (o.isMesh && o.material) o.material.dispose(); });
                return false;
              }
              return true;
            } });
          }
          return false;
        }
        return true;
      } });

      if (mine() && window.JJFEVER && window.JJFEVER.perform) {
        window.JJFEVER.perform(3.15, function (a, dt, pl) {
          var to = floor.clone().sub(pl.pos).setY(0);
          if (to.lengthSq() > .01) pl.facing = Math.atan2(to.x, to.z);
          pl.vel.set(0, 0, 0);
        }, null, 'mgaThree');
      }
    } },

    /* =================================================================
       THE TWO MERGES
       Neither has a key of its own — you get here by throwing the one
       before it — so the ending has to be worth the second press.
       ============================================================== */

    /* 1+2 · DIVINE CHIMERA — it does not stop for them the first time,
       and the second time is not a pass, it is a hold */
    gv1: { name: 'RUN THROUGH', color: '#9fe8ff', hold: 3.1, run: function (e, d, p, G) {
      var GD = window.JJGARDEN, MG = window.JJMEGUMI;
      var ARC = (GD && GD.ARC) || 0x4fd8ff, ARC2 = (GD && GD.ARC2) || 0x9fe8ff;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      var side = new THREE.Vector3(-d.z, 0, d.x).normalize();
      var g = (GD && GD.buildDivineChimera) ? GD.buildDivineChimera() : null;
      var from = floor.clone().addScaledVector(d, -22);
      if (g) {
        g.position.copy(from);
        g.rotation.y = Math.atan2(d.x, d.z);
        scene.add(g);
      }
      if (MG && MG.pool) MG.pool(new THREE.Vector3(from.x, 0, from.z), 9, 1);
      FX.speedRing(p, ARC2, 13, .3);
      addShake(1.3);

      var t = 0, phase = 0, mark = 0, leg = 0, carried = false;
      addFx({ t: 1e9, update: function (dt) {
        t += dt; leg += dt * 24;
        if (typeof scene === 'undefined') return false;
        if (g) {
          if (g.__legs) g.__legs.forEach(function (l, n) {
            l.rotation.x = Math.sin(leg + (n % 2 ? Math.PI : 0)) * 1.15;
          });
          if (g.__wings) g.__wings.forEach(function (w, i) {
            w.rotation.z = Math.sin(t * 14) * .6 * (i ? -1 : 1);
          });
        }

        /* BEAT ONE — it comes through them at speed and carries them */
        if (phase === 0) {
          if (g) {
            g.position.addScaledVector(d, 40 * dt);
            g.position.y = Math.abs(Math.sin(leg * .6)) * .9;
          }
          if (!carried && (!g || g.position.distanceTo(floor) < 3)) {
            carried = true;
            FX.impact(p.clone(), 0xffffff, 3.6);
            FX.slash(p.clone(), d, 0xe8ecf5, 9, .2);
            FX.blood(p.clone(), d, 14, 2);
            FX.mangaLines(.8, .26);
            addShake(2.4);
            if (typeof hitstop === 'function') hitstop(.1);
          }
          if (carried && e && !e.dead && g) {
            /* riding the front of it */
            e.anchorT = .4;
            e.anchorPos.copy(g.position).addScaledVector(d, 3).add(up(2.4));
            e.pos.lerp(e.anchorPos, Math.min(1, dt * 14));
            e.vel.set(0, 0, 0);
            if (GD && GD.arc && Math.random() < dt * 22) {
              GD.arc(e.pos.clone(), d.clone(), { reach: 12, depth: 2, life: .2 });
            }
          }
          if (t > 1.0) { phase = 1; mark = t; }
          return true;
        }

        /* BEAT TWO — it plants, and puts them under a foot */
        if (phase === 1) {
          var here = g ? g.position.clone() : floor.clone();
          if (t - mark < .3 && g) {
            g.position.addScaledVector(d, Math.max(0, 40 - (t - mark) * 150) * dt);
          }
          if (t - mark > .28 && t - mark < .34) {
            FX.rings(new THREE.Vector3(here.x, .12, here.z), ARC, 4, { maxR: 20, life: .7, gap: 40 });
            FX.dust(new THREE.Vector3(here.x, 0, here.z), 12, 0xcfd6e6, 16, 5);
            FX.cracks(new THREE.Vector3(here.x, .08, here.z), 16, 22, 0x101020);
            addShake(3);
            if (typeof hitstop === 'function') hitstop(.14);
          }
          if (e && !e.dead) {
            e.anchorT = .4;
            e.anchorPos.copy(here).addScaledVector(d, 3.6);
            e.anchorPos.y = Math.max(0, 1.6 - (t - mark) * 3.4);
            e.pos.lerp(e.anchorPos, Math.min(1, dt * 12));
            e.vel.set(0, 0, 0);
            e.stunT = Math.max(e.stunT || 0, .6);
            if (Math.random() < dt * 10) {
              FX.blood(e.pos.clone().add(up(1)), up(1), 4, 1.1);
            }
          }
          if (g && g.__jaw) g.__jaw.rotation.x = .5 + Math.sin(t * 12) * .3;
          if (t > mark + .95) {
            phase = 2; mark = t;
            /* the jaws take hold */
            var jat = e && !e.dead ? e.pos.clone().add(up(1.6)) : floor.clone().add(up(1.6));
            FX.impact(jat, ARC2, 3);
            FX.blood(jat, side.clone(), 12, 1.8);
            addShake(1.8);
          }
          return true;
        }

        /* BEAT THREE — and it runs again, with them, and lets go */
        if (phase === 2) {
          if (g) {
            g.position.addScaledVector(d, 46 * dt);
            g.position.y = Math.abs(Math.sin(leg * .7)) * 1.1;
          }
          if (e && !e.dead && g) {
            e.anchorT = .4;
            e.anchorPos.copy(g.position).addScaledVector(d, 3).add(up(2.6));
            e.pos.lerp(e.anchorPos, Math.min(1, dt * 16));
            e.vel.set(0, 0, 0);
            if (Math.random() < dt * 30) {
              FX.streaks(e.pos.clone(), 0x8b0f22, 2, 14, .7);
              FX.blood(e.pos.clone(), d.clone().negate(), 4, 1.2);
            }
          }
          if (t > mark + .62) {
            phase = 3;
            var out2 = e && !e.dead ? e.pos.clone() : floor.clone().add(up(2));
            FX.flash('#dff4ff', .55, .28);
            FX.impact(out2, 0xffffff, 4.2);
            FX.cross(out2, ARC2, 11, .3);
            FX.speedRing(out2, ARC, 18, .34);
            FX.mangaLines(1, .34);
            if (GD && GD.arc) {
              for (var b = 0; b < 8; b++) {
                GD.arc(out2.clone(),
                  new THREE.Vector3(Math.cos(b / 8 * TAU), .3, Math.sin(b / 8 * TAU)),
                  { reach: 20, depth: 3, life: .42 });
              }
            }
            if (typeof hitstop === 'function') hitstop(.22);
            addShake(3.8);
            if (e) e.anchorT = 0;
            G.dice(e, { dir: d, power: 2.6, cubes: 26 });
          }
          return true;
        }

        if (t > mark + 1.5) {
          if (g) {
            if (MG && MG.dismiss) MG.dismiss(g, g.position.clone().add(up(2)));
            else scene.remove(g);
          }
          return false;
        }
        if (g) g.position.addScaledVector(d, 30 * dt);
        return true;
      } });

      if (mine() && window.JJFEVER && window.JJFEVER.perform) {
        window.JJFEVER.perform(3.2, function (a, dt, pl) {
          var to = floor.clone().sub(pl.pos).setY(0);
          if (to.lengthSq() > .01) pl.facing = Math.atan2(to.x, to.z);
          pl.vel.set(0, 0, 0);
        }, null, 'mgaVone');
      }
    } },

    /* 2+3 · GREAT MAW — a mouth that size does not bite twice */
    gv2: { name: 'TAKEN WHOLE', color: '#4fd8ff', hold: 3.15, run: function (e, d, p, G) {
      var GD = window.JJGARDEN, MG = window.JJMEGUMI;
      var ARC = (GD && GD.ARC) || 0x4fd8ff, ARC2 = (GD && GD.ARC2) || 0x9fe8ff;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      var stand = floor.clone().addScaledVector(d, 13);
      var g = (GD && GD.buildMaw) ? GD.buildMaw() : null;
      var mouth = function () {
        return stand.clone().add(up(4.6)).addScaledVector(d, -5.4);
      };

      if (MG && MG.pool) MG.pool(new THREE.Vector3(stand.x, 0, stand.z), 13, 3.6);
      FX.cracks(new THREE.Vector3(stand.x, .05, stand.z), 14, 20, 0x101020);
      if (g) {
        g.position.set(stand.x, -14, stand.z);
        g.rotation.y = Math.atan2(-d.x, -d.z);
        scene.add(g);
      }
      FX.speedRing(p, ARC2, 14, .32);
      addShake(1.6);

      var t = 0, phase = 0, mark = 0, flap = 0;
      addFx({ t: 1e9, update: function (dt) {
        t += dt; flap += dt * 9;
        if (typeof scene === 'undefined') return false;
        if (g) {
          g.position.y = Math.min(0, -14 + 30 * t);
          if (g.__wings) g.__wings.forEach(function (w, i) {
            w.rotation.z = Math.sin(flap) * .55 * (i ? -1 : 1);
          });
        }

        /* BEAT ONE — the tongue, and they leave the floor */
        if (phase === 0) {
          if (t > .5 && g) {
            if (g.__jaw) g.__jaw.rotation.x = 1.1;
            if (g.__inner) g.__inner.rotation.x = .6;
          }
          if (t > .5 && e && !e.dead) {
            e.anchorT = .4;
            e.anchorPos.copy(floor).add(up(Math.min(7, (t - .5) * 11)));
            e.pos.lerp(e.anchorPos, Math.min(1, dt * 10));
            e.vel.set(0, 0, 0);
            e.stunT = Math.max(e.stunT || 0, .5);
            if (g && GD && GD.tongueAt) GD.tongueAt(g, mouth(), e.pos.clone().add(up(1.6)));
          }
          if (t > .5 && t < .58) {
            FX.impact(p.clone(), 0x5e2038, 2.6);
            FX.blood(p.clone(), d.clone().negate(), 9, 1.4);
            addShake(1.4);
            if (typeof hitstop === 'function') hitstop(.07);
          }
          if (t > 1.05) { phase = 1; mark = t; FX.mangaLines(.8, .26); }
          return true;
        }

        /* BEAT TWO — held in front of it while the arcs climb them */
        if (phase === 1) {
          var hold = mouth().clone().addScaledVector(d, -6);
          if (e && !e.dead) {
            e.anchorT = .4;
            e.anchorPos.copy(hold);
            e.pos.lerp(hold, Math.min(1, dt * 6));
            e.vel.set(0, 0, 0);
            if (g && GD && GD.tongueAt) GD.tongueAt(g, mouth(), e.pos.clone().add(up(1.6)));
            if (GD && GD.arc && Math.random() < dt * 26) {
              GD.arc(e.pos.clone().add(up(Math.random() * 3)),
                new THREE.Vector3((Math.random() - .5), (Math.random() - .5), (Math.random() - .5)),
                { reach: 11, depth: 2, life: .22 });
            }
            if (Math.random() < dt * 12) FX.blood(e.pos.clone().add(up(1.6)), up(1), 3, .9);
          }
          if (t > mark + .9) { phase = 2; mark = t; }
          return true;
        }

        /* BEAT THREE — in, and shut, and gone */
        if (phase === 2) {
          if (e && !e.dead) {
            e.anchorT = .4;
            e.anchorPos.copy(mouth());
            e.pos.lerp(e.anchorPos, Math.min(1, dt * 9));
            e.vel.set(0, 0, 0);
            if (g && GD && GD.tongueAt) GD.tongueAt(g, mouth(), e.pos.clone().add(up(1.2)));
          }
          if (t > mark + .5) {
            phase = 3; mark = t;
            var at = mouth();
            if (g) {
              if (g.__jaw) g.__jaw.rotation.x = 0;
              if (g.__inner) g.__inner.rotation.x = 0;
            }
            if (g && GD && GD.tongueIn) GD.tongueIn(g);
            FX.flash('#dff4ff', .7, .3);
            FX.impact(at.clone(), 0xffffff, 4.6);
            FX.cross(at.clone(), ARC2, 12, .32);
            FX.speedRing(at.clone(), ARC, 20, .36);
            FX.mangaLines(1, .36);
            if (GD && GD.arc) {
              for (var b = 0; b < 10; b++) {
                GD.arc(at.clone(),
                  new THREE.Vector3(Math.cos(b / 10 * TAU), .2 + Math.random() * .6, Math.sin(b / 10 * TAU)),
                  { reach: 24, depth: 3, life: .5 });
              }
            }
            if (typeof hitstop === 'function') hitstop(.26);
            addShake(4.2);
            if (e) e.anchorT = 0;
            /* nothing comes back out of it */
            G.erase(e, { color: ARC2, dir: d, power: 2.2 });
          }
          return true;
        }

        /* and it goes back down, and the floor is empty */
        if (t > mark + .5) {
          if (g) {
            if (MG && MG.pool) MG.pool(new THREE.Vector3(stand.x, 0, stand.z), 12, 1.2);
            FX.rings(new THREE.Vector3(stand.x, .12, stand.z), ARC, 4, { maxR: 22, life: .8, gap: 44 });
            var s3 = 0;
            addFx({ t: 1e9, update: function (dd) {
              s3 += dd;
              g.position.y = -26 * s3;
              if (s3 > .9) {
                scene.remove(g);
                g.traverse(function (o) { if (o.isMesh && o.material) o.material.dispose(); });
                return false;
              }
              return true;
            } });
          }
          return false;
        }
        return true;
      } });

      if (mine() && window.JJFEVER && window.JJFEVER.perform) {
        window.JJFEVER.perform(3.25, function (a, dt, pl) {
          var to = floor.clone().sub(pl.pos).setY(0);
          if (to.lengthSq() > .01) pl.facing = Math.atan2(to.x, to.z);
          pl.vel.set(0, 0, 0);
        }, null, 'mgaVtwo');
      }
    } },

    /* 4 · CHIMERA SHADOW GARDEN — inside it every surface is a shadow, so
       there is no direction for anything to not come from */
    gdom: { name: 'IN THE GARDEN', color: '#d8365e', hold: 3.2, run: function (e, d, p, G) {
      var GD = window.JJGARDEN, MG = window.JJMEGUMI;
      var ARC = (GD && GD.ARC) || 0x4fd8ff, ARC2 = (GD && GD.ARC2) || 0x9fe8ff;
      var GRID = (GD && GD.GRID) || 0xd8365e;
      var floor = new THREE.Vector3(p.x, 0, p.z);

      /* BEAT ONE — the floor under them lights, and every shadow within
         reach of them opens at once */
      FX.rings(new THREE.Vector3(floor.x, .1, floor.z), GRID, 4, { maxR: 20, life: 1.1, gap: 36 });
      FX.tint('#12040b', .45, .5);
      addShake(1.2);
      var opened = [];
      for (var i = 0; i < 10; i++) {
        var a = i / 10 * TAU;
        var at = floor.clone().add(new THREE.Vector3(Math.cos(a) * (5 + Math.random() * 7), 0,
          Math.sin(a) * (5 + Math.random() * 7)));
        opened.push(at);
        if (MG && MG.pool) MG.pool(at, 2.4 + Math.random() * 1.6, 3.2);
      }
      var crack = (GD && GD.crackle)
        ? GD.crackle(function () { return e && !e.dead ? e.pos.clone() : null; },
            function () { return !!e && !e.dead; })
        : null;
      var t0 = 0;
      addFx({ t: 1e9, update: function (dt) {
        t0 += dt;
        if (!e || e.dead) return false;
        e.anchorT = .4;
        e.anchorPos.copy(floor).add(up(.2));
        e.pos.lerp(e.anchorPos, Math.min(1, dt * 8));
        e.vel.set(0, 0, 0);
        e.stunT = Math.max(e.stunT || 0, .4);
        return t0 < 3;
      } });

      /* BEAT TWO — and then they come out. One after another, from ten
         directions, and none of them stops for the last one */
      var STRIKE = [
        function (at, away) {                       // the hound
          var g = (GD && GD.buildTotality) ? GD.buildTotality() : (MG && MG.buildDog ? MG.buildDog(false) : null);
          return { obj: g, y: 0, speed: 34, color: ARC };
        },
        function () {                               // the serpent
          return { obj: MG && MG.buildSnake ? MG.buildSnake() : null, y: 2.2, speed: 40, color: 0x7b7bb8 };
        },
        function () {                               // the chimera itself
          return { obj: GD && GD.buildChimera ? GD.buildChimera() : null, y: 3.4, speed: 30, color: ARC2 };
        },
        function () {                               // Nue
          return { obj: MG && MG.buildNue ? MG.buildNue() : null, y: 6.5, speed: 36, color: 0xa9b6e8 };
        }
      ];
      var shots = 8;
      for (var s = 0; s < shots; s++) {
        (function (n) {
          setTimeout(function () {
            if (typeof scene === 'undefined') return;
            var ang = (n / shots) * TAU + .7;
            var away = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
            var spec = STRIKE[n % STRIKE.length]();
            var from = floor.clone().addScaledVector(away, 17).add(up(spec.y));
            var to = floor.clone().addScaledVector(away, -13).add(up(spec.y));
            var o = spec.obj;
            if (o) {
              o.position.copy(from);
              o.rotation.y = Math.atan2(-away.x, -away.z);
              scene.add(o);
            }
            if (MG && MG.pool) MG.pool(new THREE.Vector3(from.x, 0, from.z), 4, .6);
            var t = 0, hit = false, life = 30 / spec.speed;
            addFx({ t: 1e9, update: function (dt) {
              t += dt;
              var k = Math.min(1, t / life);
              if (o) {
                o.position.lerpVectors(from, to, k);
                if (o.__wings) o.__wings.forEach(function (w, i) {
                  w.rotation.z = Math.sin(t * 22) * .8 * (i ? -1 : 1);
                });
                if (o.__legs) o.__legs.forEach(function (l, j) {
                  l.rotation.x = Math.sin(t * 24 + (j % 2 ? Math.PI : 0)) * 1.1;
                });
                if (o.__segs) o.__segs.forEach(function (sg, j) {
                  sg.position.x = Math.sin(t * 16 - j * .6) * .5;
                });
              }
              if (!hit && k >= .5) {
                hit = true;
                var at = floor.clone().add(up(spec.y + 1.4));
                FX.impact(at, spec.color, 2 + (n % 3) * .4);
                FX.slash(at, away.clone().negate(), 0xe8ecf5, 6, .16);
                FX.blood(at, away.clone().negate(), 8, 1.4);
                if (GD && GD.arc) {
                  GD.arc(at.clone(), away.clone().negate(), { reach: 12, depth: 2, life: .26 });
                }
                if (typeof hitstop === 'function') hitstop(.05);
                addShake(.9 + n * .12);
                if (e && !e.dead) {
                  e.anchorT = .4;
                  e.anchorPos.copy(floor).add(up(Math.min(6, n * .8)));
                  e.pos.lerp(e.anchorPos, .5);
                }
              }
              if (k >= 1) {
                if (o) { if (MG && MG.dismiss) MG.dismiss(o, o.position.clone()); else scene.remove(o); }
                return false;
              }
              return true;
            } });
          }, 1000 + n * 120);
        })(s);
      }

      /* BEAT THREE — everything goes back into the floor, and the last
         thing in the garden is the one that adapted */
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        if (crack) crack.stop();
        opened.forEach(function (at) { if (MG && MG.pool) MG.pool(at, 3.4, .8); });
        FX.mangaLines(1, .34);
        FX.speedRing(floor.clone().add(up(3)), ARC2, 20, .4);
        addShake(1.8);

        var m = (GD && GD.buildMahoraga) ? GD.buildMahoraga() : null;
        if (m) {
          m.position.set(floor.x, 34, floor.z);
          m.rotation.y = Math.atan2(-d.x, -d.z);
          m.rotation.x = Math.PI;                    // coming down head first
          scene.add(m);
        }
        var t2 = 0, split = false;
        addFx({ t: 1e9, update: function (dt) {
          t2 += dt;
          if (typeof scene === 'undefined') return false;
          if (m) {
            m.position.y = 34 - 78 * t2;
            if (m.__wheel) m.__wheel.rotation.z += dt * 26;
          }
          if (GD && GD.arc && Math.random() < dt * 40) {
            GD.arc(new THREE.Vector3(floor.x, Math.max(1, m ? m.position.y : 10), floor.z),
              new THREE.Vector3((Math.random() - .5), (Math.random() - .5) * .4, (Math.random() - .5)).normalize(),
              { reach: 16, depth: 3, life: .3 });
          }
          if (!split && t2 > .42) {
            split = true;
            FX.flash('#ffffff', .8, .34);
            FX.tint('#2a0410', .6, .4);
            /* the whole floor grid answers it */
            for (var i = 0; i < 7; i++) {
              FX.ring(new THREE.Vector3(floor.x, .12 + i * .02, floor.z), GRID,
                { maxR: 12 + i * 6, life: .8 + i * .06 });
            }
            for (i = 0; i < 16; i++) {
              GD && GD.arc && GD.arc(new THREE.Vector3(floor.x, 2, floor.z),
                new THREE.Vector3(Math.cos(i / 16 * TAU), .2 + Math.random() * .5, Math.sin(i / 16 * TAU)),
                { reach: 30, depth: 3, life: .6 });
            }
            FX.cracks(new THREE.Vector3(floor.x, .1, floor.z), 26, 34, 0x2a0410);
            FX.debris(new THREE.Vector3(floor.x, 0, floor.z), 22, 26, 0x1a1a2c);
            if (typeof hitstop === 'function') hitstop(.28);
            addShake(4.6);
            if (e) e.anchorT = 0;
            G.erase(e, { color: GRID, dir: up(-1), power: 2.4 });
          }
          if (t2 > 1.05) {
            if (m) {
              scene.remove(m);
              m.traverse(function (o) { if (o.isMesh && o.material) o.material.dispose(); });
            }
            return false;
          }
          return true;
        } });
      }, 2100);

      if (mine() && window.JJFEVER && window.JJFEVER.perform) {
        window.JJFEVER.perform(3.3, function (a, dt, pl) {
          var to = floor.clone().sub(pl.pos).setY(0);
          if (to.lengthSq() > .01) pl.facing = Math.atan2(to.x, to.z);
          pl.vel.set(0, 0, 0);
        }, null, 'mgaFour');
      }
    } },

    /* F · Idle Death Gamble — the machine pays out, with them in it */
    hdom: { name: 'PAID OUT', color: '#ffd84a', hold: 1.3, run: function (e, d, p, G) {
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

    /* R · Door Guard — they swung, the doors were up, and the fist that
       comes back through arrives with both of them */
    hr: { name: 'ANSWERED', color: '#ffd964', hold: .8, run: function (e, d, p, G) {
      var HKA = window.JJHAKARI;
      var dr = null;
      if (HKA && HKA.makeDoor) {
        dr = HKA.makeDoor();
        dr.position.copy(p).addScaledVector(d, -3);
        dr.rotation.y = Math.atan2(d.x, d.z);
        scene.add(dr);
      }
      FX.impact(p, 0xffcc4d, 1.8);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.speedRing(p, 0xffe08a, 11, .3);
        FX.cross(p, 0xffffff, 6, .22);
        FX.mangaLines(.7, .26);
        if (typeof hitstop === 'function') hitstop(.15);
        if (dr && HKA.burstDoor) HKA.burstDoor(dr, d.clone().negate());
        G.sever(e, { dir: d, power: 2.1 });
        addShake(2.2);
      }, 440);
    } },

    /* =================================================================
       MAHITO
       He does not kill anybody. He RESHAPES them, and what he leaves is
       whatever the soul settled into when he let go of it — so not one
       of these is a blow. Every one is a shape they end up in.
       ============================================================== */

    /* 1 · the hand stays on. A touch that is not taken off again does
       not stop at a wound: the body keeps being told what to be until
       there is nothing left that answers to a shape */
    t1: { name: 'UNMADE', color: '#6fe0cf', hold: 2.1, run: function (e, d, p, G) {
      var MH = window.JJMAHITO;
      var SOUL = (MH && MH.SOUL) || 0x6fe0cf, SOUL2 = (MH && MH.SOUL2) || 0xc6fbf1;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      if (MH && MH.palm) MH.palm(p.clone(), d.clone().negate(), 3.6);
      FX.flash('#c6fbf1', .4, .22);
      FX.impact(p.clone(), SOUL, 2.6);
      addShake(1.4);
      if (typeof hitstop === 'function') hitstop(.12);

      /* the seams go in and keep going in */
      var t = 0, n = 0;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined') return false;
        var at = (e && !e.dead ? e.pos.clone() : floor.clone()).add(up(2.4));
        if (t > n * .13) {
          n++;
          if (MH && MH.knot) MH.knot(at.clone(), 3, 1.4 + Math.random() * 1.4, .34);
          FX.mote(at.clone().add(new THREE.Vector3(
            (Math.random() - .5) * 2, (Math.random() - .5) * 2, (Math.random() - .5) * 2)),
            SOUL2, 1.6, .26);
          if (window.JJHITS) window.JJHITS.flash(e && e.rig, SOUL2, .5);
        }
        /* and the shape gets worse the whole time */
        if (e && !e.dead && MH && MH.warp) MH.warp(e, .35 + t * .5, .4);
        if (e && !e.dead) {
          e.anchorT = .4;
          e.anchorPos.copy(floor).add(up(.2 + Math.sin(t * 9) * .3));
          e.pos.lerp(e.anchorPos, Math.min(1, dt * 8));
          e.vel.set(0, 0, 0);
        }
        return t < 1.7;
      } });

      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        var at = (e && !e.dead ? e.pos.clone() : floor.clone()).add(up(2.2));
        FX.flash('#ffffff', .6, .28);
        FX.converge(at.clone(), SOUL, 34, 12, .5);
        if (MH && MH.knot) MH.knot(at.clone(), 14, 3, .5);
        if (MH && MH.meat) MH.meat(at.clone(), 18, 13);
        FX.mangaLines(1, .32);
        if (typeof hitstop === 'function') hitstop(.22);
        addShake(3.2);
        if (e) { e.anchorT = 0; if (MH && MH.unwarp) MH.unwarp(e.rig); }
        /* folded in on itself, which is what a shape with nobody holding
           it does */
        G.implode(e, { at: at, color: SOUL, dir: d, cubes: 16 });
      }, 1750);
    } },

    /* 2 · they do not get killed by one. They get made into one, and
       then it walks off, which is worse */
    t2: { name: 'ONE OF THEM NOW', color: '#8a3a4c', hold: 2.5, run: function (e, d, p, G) {
      var MH = window.JJMAHITO;
      var SOUL = (MH && MH.SOUL) || 0x6fe0cf;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      var side = new THREE.Vector3(-d.z, 0, d.x).normalize();
      FX.speedRing(p.clone(), SOUL, 12, .3);
      addShake(1.2);

      /* BEAT ONE — three of them come in and take hold */
      var made = [];
      for (var i = -1; i <= 1; i++) {
        (function (n) {
          setTimeout(function () {
            if (typeof scene === 'undefined' || !MH || !MH.buildTransfigured) return;
            var g = MH.buildTransfigured();
            var from = floor.clone().addScaledVector(side, n * 9).addScaledVector(d, 6);
            g.position.copy(from);
            g.rotation.y = Math.atan2(floor.x - from.x, floor.z - from.z);
            scene.add(g);
            made.push(g);
            var t = 0, run = 0;
            addFx({ t: 1e9, update: function (dt) {
              t += dt; run += dt * 19;
              if (typeof scene === 'undefined') return false;
              var want = floor.clone().addScaledVector(side, n * 2.4);
              g.position.lerp(want, Math.min(1, dt * 4.4));
              g.position.y = Math.abs(Math.sin(run)) * .4;
              if (g.__legs) g.__legs.forEach(function (l, j) {
                l.rotation.x = Math.sin(run * (1 + j * .2) + j * 1.7) * 1;
              });
              if (g.__arms) g.__arms.forEach(function (a2, j) {
                a2.rotation.x = .4 + Math.sin(run * .8 + j) * .7;
              });
              if (MH.seam && Math.random() < dt * 12) {
                MH.seam(g.position.clone().add(up(3)),
                  floor.clone().add(up(1.4 + Math.random() * 2)), { n: 5, life: .3 });
              }
              return t < 2.2;
            } });
          }, 60 + (n + 1) * 130);
        })(i);
      }
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.impact(p.clone(), 0x8a3a4c, 2.4);
        FX.blood(p.clone(), side.clone(), 12, 1.7);
        if (typeof hitstop === 'function') hitstop(.08);
        addShake(1.6);
        if (e && !e.dead) {
          e.anchorT = .5;
          e.anchorPos.copy(floor).add(up(.8));
          e.stunT = Math.max(e.stunT || 0, 1);
        }
      }, 620);

      /* BEAT TWO — and it is done to them where they stand */
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        var at = (e && !e.dead ? e.pos.clone() : floor.clone()).add(up(2.4));
        FX.flash('#c6fbf1', .4, .24);
        if (MH && MH.knot) MH.knot(at.clone(), 10, 2.4, .5);
        if (MH && MH.warp) MH.warp(e, .9, 1.2);
        if (MH && MH.meat) MH.meat(at.clone(), 10, 11);
        FX.mangaLines(.8, .28);
        addShake(2.2);
        if (typeof hitstop === 'function') hitstop(.12);
      }, 1350);

      /* BEAT THREE — the shape stops being theirs, and leaves */
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        var at = (e && !e.dead ? e.pos.clone() : floor.clone());
        FX.flash('#ffffff', .5, .26);
        if (MH && MH.knot) MH.knot(at.clone().add(up(2.4)), 12, 3, .55);
        if (MH && MH.meat) MH.meat(at.clone().add(up(2.2)), 16, 14);
        FX.debris(new THREE.Vector3(at.x, .1, at.z), 12, 14, 0x55202f);
        if (typeof hitstop === 'function') hitstop(.2);
        addShake(3);
        if (e) { e.anchorT = 0; if (MH && MH.unwarp) MH.unwarp(e.rig); }
        G.erase(e, { color: SOUL, dir: d, power: 1.6 });
        /* one more of them walks away from where somebody was standing */
        if (MH && MH.buildTransfigured) {
          var g = MH.buildTransfigured();
          g.position.copy(at); g.position.y = 0;
          g.rotation.y = Math.atan2(-d.x, -d.z);
          scene.add(g);
          made.push(g);
          var t = 0, run = 0;
          addFx({ t: 1e9, update: function (dt) {
            t += dt; run += dt * 15;
            if (typeof scene === 'undefined') return false;
            g.position.addScaledVector(d, -7 * dt);
            g.position.y = Math.abs(Math.sin(run)) * .4;
            if (g.__legs) g.__legs.forEach(function (l, j) {
              l.rotation.x = Math.sin(run * (1 + j * .2) + j * 1.7) * 1;
            });
            g.traverse(function (o) {
              if (o.isMesh && o.material && o.material.transparent === false && t > 1.1) {
                o.material.transparent = true;
              }
              if (o.isMesh && o.material && t > 1.1) o.material.opacity = Math.max(0, 1 - (t - 1.1) / .7);
            });
            if (t > 1.8) {
              made.forEach(function (m) {
                scene.remove(m);
                m.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
              });
              return false;
            }
            return true;
          } });
        }
      }, 2400);
    } },

    /* 3 · the arm opens out, and so do they */
    t3: { name: 'OPENED FROM THE SHOULDER', color: '#d6ccbb', hold: 1.6, run: function (e, d, p, G) {
      var MH = window.JJMAHITO;
      var SOUL2 = (MH && MH.SOUL2) || 0xc6fbf1;
      var side = new THREE.Vector3(-d.z, 0, d.x).normalize();
      var blade = (MH && MH.buildBlade) ? MH.buildBlade() : null;
      if (blade) {
        blade.position.copy(p).addScaledVector(d, -7).add(up(1.4));
        blade.rotation.y = Math.atan2(d.x, d.z);
        blade.rotation.z = -1.1;
        scene.add(blade);
      }
      FX.speedRing(p.clone(), SOUL2, 13, .3);
      addShake(1.2);

      /* it comes down through them on a diagonal, and does not stop */
      var t = 0, cut = false;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined') return false;
        if (blade) {
          var k = Math.min(1, t / .55);
          blade.position.copy(p).addScaledVector(d, -7 + 12 * k).add(up(1.4 - k * .8));
          blade.rotation.z = -1.1 + k * 2.2;
          if (MH && MH.seam && Math.random() < dt * 26) {
            MH.seam(blade.position.clone(), blade.position.clone().add(new THREE.Vector3(
              (Math.random() - .5) * 5, (Math.random() - .5) * 4, (Math.random() - .5) * 5)),
              { n: 3, life: .2 });
          }
        }
        if (!cut && t > .42) {
          cut = true;
          FX.flash('#fff6ea', .55, .26);
          FX.slash(p.clone(), side.clone().add(up(.8)).normalize(), 0xfff2e2, 18, .3);
          FX.slash(p.clone().add(up(-.5)), side.clone(), SOUL2, 14, .24);
          if (MH && MH.seam) {
            MH.seam(p.clone().addScaledVector(side, -9).add(up(2.4)),
              p.clone().addScaledVector(side, 9).add(up(-2.4)), { n: 16, life: .6 });
          }
          FX.blood(p.clone(), side.clone(), 22, 2.4);
          FX.mangaLines(1, .32);
          if (typeof hitstop === 'function') hitstop(.2);
          addShake(3.4);
          /* the diagonal it came down on is the line they come apart on */
          G.halve(e, { dir: side.clone(), power: 2.4 });
          if (MH && MH.meat) MH.meat(p.clone(), 12, 13);
        }
        if (t > .95) {
          if (blade) {
            scene.remove(blade);
            blade.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
          }
          return false;
        }
        return true;
      } });
    } },

    /* 4 · it does not hit them. It takes them in, and closes over the
       place where they were */
    t4: { name: 'PART OF IT', color: '#8a3a4c', hold: 2.6, run: function (e, d, p, G) {
      var MH = window.JJMAHITO;
      var SOUL = (MH && MH.SOUL) || 0x6fe0cf, SOUL2 = (MH && MH.SOUL2) || 0xc6fbf1;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      var mass = (MH && MH.buildIsomer) ? MH.buildIsomer() : null;
      var from = floor.clone().addScaledVector(d, -20);
      if (mass) {
        mass.position.copy(from); mass.position.y = -3;
        mass.rotation.y = Math.atan2(d.x, d.z);
        scene.add(mass);
      }
      FX.cracks(new THREE.Vector3(floor.x, .06, floor.z), 14, 18, 0x2a1220);
      FX.tint('#160a12', .45, 1.4);
      addShake(1.6);

      var t = 0, phase = 0, mark = 0, churn = 0;
      addFx({ t: 1e9, update: function (dt) {
        t += dt; churn += dt * 3.4;
        if (typeof scene === 'undefined') return false;
        if (mass) {
          mass.position.y = Math.min(0, -3 + 12 * t);
          if (mass.__hands) mass.__hands.forEach(function (a2, i) {
            a2.rotation.x = (a2.__base ? a2.__base.x : 0) + Math.sin(churn * 2 + i) * .6;
            a2.rotation.z = (a2.__base ? a2.__base.z : 0) + Math.cos(churn * 1.7 + i * .7) * .5;
          });
          if (mass.__faces) mass.__faces.forEach(function (f, i) {
            f.scale.y = 1 + Math.sin(churn * 4 + i * 2) * .2;
          });
        }

        /* BEAT ONE — it rolls up behind them and the hands get a hold */
        if (phase === 0) {
          if (mass) mass.position.addScaledVector(d, 24 * dt);
          if (mass && mass.position.distanceTo(floor) < 6.5) {
            phase = 1; mark = t;
            FX.impact(p.clone(), SOUL2, 3.4);
            if (MH && MH.knot) MH.knot(p.clone(), 8, 2.6, .5);
            FX.blood(p.clone(), d.clone(), 12, 1.8);
            if (typeof hitstop === 'function') hitstop(.1);
            addShake(2.4);
          } else if (t > 1.1) { phase = 1; mark = t; }
          return true;
        }

        /* BEAT TWO — they are pulled off the floor into the middle of it */
        if (phase === 1) {
          var into = (mass ? mass.position.clone() : floor.clone()).add(up(3.4));
          if (e && !e.dead) {
            e.anchorT = .4;
            e.anchorPos.copy(into);
            e.pos.lerp(into, Math.min(1, dt * 5));
            e.vel.set(0, 0, 0);
            e.stunT = Math.max(e.stunT || 0, .8);
            if (MH && MH.warp) MH.warp(e, .8, 1.2);
            if (MH && MH.knot && Math.random() < dt * 18) {
              MH.knot(e.pos.clone().add(up(1.6)), 2, 1.8, .3);
            }
            if (Math.random() < dt * 12) FX.blood(e.pos.clone().add(up(1.6)), d.clone(), 4, 1);
          }
          if (t > mark + .95) { phase = 2; mark = t; }
          return true;
        }

        /* BEAT THREE — and it closes, and there is one more face in it */
        if (phase === 2) {
          phase = 3; mark = t;
          var at = mass ? mass.position.clone().add(up(3)) : p.clone();
          FX.flash('#c6fbf1', .6, .3);
          FX.converge(at.clone(), SOUL, 40, 14, .55);
          if (MH && MH.knot) MH.knot(at.clone(), 16, 4, .6);
          if (MH && MH.meat) MH.meat(at.clone(), 22, 15);
          FX.rings(new THREE.Vector3(at.x, .12, at.z), SOUL, 4, { maxR: 22, life: .8, gap: 42 });
          FX.mangaLines(1, .34);
          if (typeof hitstop === 'function') hitstop(.24);
          addShake(3.8);
          if (e) { e.anchorT = 0; if (MH && MH.unwarp) MH.unwarp(e.rig); }
          G.erase(e, { color: SOUL, dir: d, power: 2 });
          return true;
        }

        /* and it rolls on, one bigger than it was */
        if (mass) mass.position.addScaledVector(d, 16 * dt);
        if (t > mark + 1.1) {
          if (mass) {
            if (MH && MH.meat) MH.meat(mass.position.clone().add(up(2.6)), 14, 12);
            scene.remove(mass);
            mass.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
          }
          return false;
        }
        return true;
      } });
    } },

    /* R · he stops holding his own shape for a moment, and while his
       hands are soft he puts them through theirs */
    tr: { name: 'WRONG SHAPE', color: '#c6fbf1', hold: 1.5, run: function (e, d, p, G) {
      var MH = window.JJMAHITO;
      var SOUL = (MH && MH.SOUL) || 0x6fe0cf, SOUL2 = (MH && MH.SOUL2) || 0xc6fbf1;
      var side = new THREE.Vector3(-d.z, 0, d.x).normalize();
      FX.impact(p.clone(), SOUL, 2.2);
      if (MH && MH.knot) MH.knot(p.clone(), 5, 2, .4);
      addShake(1.2);

      /* four seams, from four sides, all through the same body */
      [0, .1, .2, .3].forEach(function (ms, i) {
        setTimeout(function () {
          if (typeof scene === 'undefined') return;
          var a = i / 4 * TAU + .4;
          var from = p.clone().add(new THREE.Vector3(Math.cos(a) * 8, (i - 1.5) * 1.4, Math.sin(a) * 8));
          var to = p.clone().add(new THREE.Vector3(Math.cos(a) * -8, (1.5 - i) * 1.4, Math.sin(a) * -8));
          if (MH && MH.seam) MH.seam(from, to, { n: 12, life: .45 });
          FX.impact(p.clone(), i % 2 ? SOUL2 : SOUL, 1.8);
          FX.blood(p.clone(), new THREE.Vector3(Math.cos(a), .2, Math.sin(a)), 8, 1.4);
          if (window.JJHITS) window.JJHITS.flash(e && e.rig, SOUL2, .7);
          if (MH && MH.warp) MH.warp(e, .3 + i * .18, .8);
          addShake(.9);
          if (typeof hitstop === 'function') hitstop(.05);
        }, ms * 1000);
      });

      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.flash('#c6fbf1', .5, .26);
        FX.cross(p.clone(), SOUL2, 9, .28);
        if (MH && MH.knot) MH.knot(p.clone(), 10, 2.6, .5);
        if (MH && MH.meat) MH.meat(p.clone(), 14, 13);
        FX.mangaLines(.9, .3);
        if (typeof hitstop === 'function') hitstop(.18);
        addShake(2.8);
        if (e && MH && MH.unwarp) MH.unwarp(e.rig);
        /* cut apart along every one of the four lines at once */
        G.sever(e, { dir: side, power: 2.4, cubes: 18 });
      }, 1150);
    } },

    /* =================================================================
       AOI TODO
       The technique is a clap and an exchange, so none of these is a
       combo — each one is a place he put somebody, and then what was
       already waiting there.
       ============================================================== */

    /* 1 · the marker goes straight up. So do they */
    b1: { name: 'CLAPPED', color: '#ffb347', hold: 2.0, run: function (e, d, p, G) {
      var TD = window.JJTODO;
      var GOLD = (TD && TD.GOLD) || 0xffb347, HOT = (TD && TD.HOT) || 0xfff0d8;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      var TOP = 20;
      if (TD && TD.clap) TD.clap(p.clone(), 1.3);
      FX.mangaLines(.7, .24);

      /* up they go, on the swap rather than on a hit */
      var t = 0, over = false, driven = false;
      var high = floor.clone().add(up(TOP));
      if (TD && TD.swapFx) TD.swapFx(floor.clone().add(up(1)), high.clone());
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined') return false;
        if (e && !e.dead && !driven) {
          var k = Math.min(1, t / .5);
          e.anchorT = .3;
          e.anchorPos.copy(floor).add(up(2 + TOP * (1 - (1 - k) * (1 - k))));
          e.pos.lerp(e.anchorPos, Math.min(1, dt * 14));
          e.vel.set(0, 0, 0);
          if (Math.random() < dt * 20) FX.streaks(e.pos.clone().add(up(2)), GOLD, 2, 12, .7);
        }
        /* and he arrives above them, because that is where the second
           marker went */
        if (!over && t > .62) {
          over = true;
          var his = high.clone().add(up(6));
          if (TD && TD.clap) TD.clap(his.clone(), .9, false);
          if (TD && TD.swapFx) TD.swapFx(floor.clone().add(up(1)), his);
          if (TD && TD.arrive) TD.arrive(his, 1.2);
          FX.speedRing(his.clone(), HOT, 14, .3);
        }
        /* the elbow, straight down the line they came up */
        if (over && !driven && t > .95) {
          driven = true;
          var at = e && !e.dead ? e.pos.clone().add(up(2.4)) : high.clone();
          FX.flash('#fff3d8', .6, .28);
          FX.cross(at.clone(), 0xffffff, 12, .3);
          FX.impact(at.clone(), HOT, 4.4);
          FX.blood(at.clone(), new THREE.Vector3(0, -1, 0), 20, 2.4);
          FX.mangaLines(1, .34);
          if (typeof hitstop === 'function') hitstop(.22);
          addShake(3.6);
          if (e) e.anchorT = 0;
          /* and the floor stops them */
          setTimeout(function () {
            if (typeof scene === 'undefined') return;
            FX.rings(new THREE.Vector3(floor.x, .12, floor.z), GOLD, 5,
              { maxR: 26, life: .9, gap: 40 });
            FX.cracks(new THREE.Vector3(floor.x, .1, floor.z), 22, 28, 0x3a2a18);
            FX.dust(new THREE.Vector3(floor.x, 0, floor.z), 14, 0xd8c8a8, 18, 5);
            addShake(3.4);
            if (typeof hitstop === 'function') hitstop(.16);
            G.flatten(e, { crater: 13 });
          }, 320);
        }
        return t < 1.6;
      } });
    } },

    /* 2 · back and forth between two places, faster than a body is meant
       to arrive anywhere */
    b2: { name: 'TRADED', color: '#fff0d8', hold: 2.4, run: function (e, d, p, G) {
      var TD = window.JJTODO;
      var GOLD = (TD && TD.GOLD) || 0xffb347, HOT = (TD && TD.HOT) || 0xfff0d8;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      var side = new THREE.Vector3(-d.z, 0, d.x).normalize();
      var A = floor.clone().addScaledVector(side, -7);
      var B = floor.clone().addScaledVector(side, 7);
      if (TD && TD.clap) TD.clap(p.clone(), 1.2);

      var n = 0, t = 0, next = .3;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined') return false;
        if (t > next && n < 9) {
          /* each trade sooner than the last one */
          var here = n % 2 ? A : B, there = n % 2 ? B : A;
          n++;
          next = t + Math.max(.055, .3 - n * .03);
          if (TD && TD.swapFx) TD.swapFx(here.clone().add(up(1)), there.clone().add(up(1)));
          if (TD && TD.clap) TD.clap(floor.clone().add(up(2.4)), .45, false);
          if (e && !e.dead) {
            e.anchorT = .3;
            e.anchorPos.copy(there).add(up(1.6));
            e.pos.copy(e.anchorPos);
            e.vel.set(0, 0, 0);
            FX.impact(e.pos.clone().add(up(1)), n % 2 ? GOLD : HOT, 2 + n * .2);
            FX.blood(e.pos.clone().add(up(1.4)), side.clone().multiplyScalar(n % 2 ? 1 : -1), 6 + n, 1.4);
            if (window.JJHITS) window.JJHITS.flash(e.rig, HOT, .6);
          }
          FX.dust(new THREE.Vector3(there.x, 0, there.z), 5, 0xd8c8a8, 8, 3);
          addShake(.7 + n * .18);
          if (typeof hitstop === 'function') hitstop(.03);
        }
        /* and the last arrival does not finish arriving */
        if (n >= 9 && t > next) {
          var at = (e && !e.dead ? e.pos.clone() : floor.clone()).add(up(1.8));
          FX.flash('#fff3d8', .55, .26);
          FX.cross(at.clone(), 0xffffff, 11, .3);
          FX.impact(at.clone(), HOT, 4);
          FX.rings(at.clone(), GOLD, 4, { maxR: 18, life: .7, ground: false, gap: 36 });
          FX.mangaLines(1, .32);
          if (typeof hitstop === 'function') hitstop(.2);
          addShake(3.4);
          if (e) e.anchorT = 0;
          G.dice(e, { dir: side, power: 2.6, cubes: 26 });
          return false;
        }
        return t < 2.4;
      } });
    } },

    /* 3 · everything stops, and then one of them arrives */
    b3: { name: 'ONE PUNCH', color: '#fff0d8', hold: 1.7, run: function (e, d, p, G) {
      var TD = window.JJTODO;
      var GOLD = (TD && TD.GOLD) || 0xffb347, HOT = (TD && TD.HOT) || 0xfff0d8;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      /* the wind-up: the air goes in rather than out */
      FX.converge(p.clone(), GOLD, 26, 11, .6);
      FX.mangaLines(.5, .5);
      FX.zoom(-7, .5);
      if (typeof hitstop === 'function') hitstop(.12);
      addShake(.6);
      if (e && !e.dead) { e.anchorT = .7; e.anchorPos.copy(e.pos); e.stunT = Math.max(e.stunT || 0, 1); }

      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        var at = (e && !e.dead ? e.pos.clone().add(up(2.5)) : p.clone());
        /* and then all of it at once */
        FX.flash('#ffffff', .85, .3);
        FX.wave(at.clone(), d, GOLD, { steps: 6, gap: 22, reach: 5, r0: 4, grow: 2.6 });
        FX.cross(at.clone(), 0xffffff, 16, .34);
        FX.impact(at.clone(), HOT, 6);
        FX.speedRing(at.clone(), GOLD, 24, .4);
        FX.rings(at.clone(), HOT, 4, { maxR: 26, life: .8, ground: false, gap: 30 });
        FX.blood(at.clone(), d, 26, 2.8);
        FX.mangaLines(1, .4);
        FX.cracks(new THREE.Vector3(floor.x, .1, floor.z), 24, 30, 0x3a2a18);
        FX.dust(new THREE.Vector3(floor.x, 0, floor.z), 16, 0xd8c8a8, 22, 6);
        if (typeof hitstop === 'function') hitstop(.3);
        addShake(5);
        if (e) e.anchorT = 0;
        G.sever(e, { dir: d, power: 3.2, cubes: 18 });
        /* the half that is left goes a long way */
        setTimeout(function () {
          if (typeof scene === 'undefined') return;
          var far = floor.clone().addScaledVector(d, 40).add(up(6));
          FX.cross(far, 0xffffff, 8, .3);
          FX.impact(far, GOLD, 2.4);
          FX.dust(new THREE.Vector3(far.x, 0, far.z), 8, 0xd8c8a8, 12, 4);
        }, 420);
      }, 780);
    } },

    /* 4 · not one after another. All of them, on the same frame */
    b4: { name: 'FROM EVERY SIDE', color: '#ffb347', hold: 2.3, run: function (e, d, p, G) {
      var TD = window.JJTODO;
      var GOLD = (TD && TD.GOLD) || 0xffb347, HOT = (TD && TD.HOT) || 0xfff0d8;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      var N = 8, made = [];
      /* a marker on every side of them, laid down one at a time */
      for (var i = 0; i < N; i++) {
        (function (n) {
          setTimeout(function () {
            if (typeof scene === 'undefined') return;
            var a = n / N * TAU + .3;
            var at = floor.clone().add(new THREE.Vector3(Math.cos(a) * 6, 1.2, Math.sin(a) * 6));
            if (TD && TD.marker) made.push(TD.marker(at));
            FX.mote(at.clone(), GOLD, 1.8, .3);
            addShake(.35);
          }, 60 + n * 70);
        })(i);
      }

      /* and then every one of them at once */
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        if (TD && TD.clap) TD.clap(floor.clone().add(up(2.4)), 1.6);
        FX.mangaLines(1, .36);
        for (var n = 0; n < N; n++) {
          (function (n) {
            var a = n / N * TAU + .3;
            var from = floor.clone().add(new THREE.Vector3(Math.cos(a) * 6, 0, Math.sin(a) * 6));
            var into = floor.clone().add(up(2.2));
            if (TD && TD.swapFx) TD.swapFx(from.clone().add(up(1)), into.clone());
            setTimeout(function () {
              if (typeof scene === 'undefined') return;
              FX.impact(into.clone(), n % 2 ? HOT : GOLD, 2.6);
              FX.cross(into.clone(), HOT, 6, .16);
              FX.blood(into.clone(), new THREE.Vector3(-Math.cos(a), .2, -Math.sin(a)), 7, 1.4);
              if (window.JJHITS) window.JJHITS.flash(e && e.rig, HOT, .6);
              addShake(1);
              if (e && !e.dead) {
                e.anchorT = .4;
                e.anchorPos.copy(floor).add(up(1.4 + n * .34));
                e.pos.lerp(e.anchorPos, .6);
                e.vel.set(0, 0, 0);
              }
            }, 40 + n * 45);
          })(n);
        }
        made.forEach(function (m) { if (TD && TD.dropMarker) TD.dropMarker(m); });
        made.length = 0;
      }, 660);

      /* and the drop, from directly overhead, with both hands */
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        var over = floor.clone().add(up(16));
        if (TD && TD.clap) TD.clap(over.clone(), 1.2, false);
        if (TD && TD.swapFx) TD.swapFx(floor.clone().add(up(2)), over);
        FX.speedRing(over.clone(), HOT, 16, .3);
        setTimeout(function () {
          if (typeof scene === 'undefined') return;
          FX.flash('#fff3d8', .7, .3);
          FX.impact(floor.clone().add(up(2)), HOT, 5);
          FX.rings(new THREE.Vector3(floor.x, .12, floor.z), GOLD, 6,
            { maxR: 30, life: 1, gap: 38 });
          FX.cracks(new THREE.Vector3(floor.x, .1, floor.z), 26, 34, 0x3a2a18);
          FX.dust(new THREE.Vector3(floor.x, 0, floor.z), 18, 0xd8c8a8, 24, 6);
          FX.debris(new THREE.Vector3(floor.x, .1, floor.z), 18, 22, 0x8b7c62);
          FX.mangaLines(1, .38);
          if (typeof hitstop === 'function') hitstop(.26);
          addShake(4.6);
          if (e) e.anchorT = 0;
          G.flatten(e, { crater: 16 });
        }, 340);
      }, 1500);
    } },

    /* R · he was standing there a moment ago, and what was coming for
       him is still on its way */
    br: { name: 'WHERE HE WAS', color: '#d45a1e', hold: 1.9, run: function (e, d, p, G) {
      var TD = window.JJTODO;
      var GOLD = (TD && TD.GOLD) || 0xffb347, HOT = (TD && TD.HOT) || 0xfff0d8;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      /* the place he left, marked, so it is clear what is about to happen */
      var spot = floor.clone().addScaledVector(d, -9);
      var mk = (TD && TD.marker) ? TD.marker(spot.clone().add(up(1.2))) : null;
      if (TD && TD.pillar) TD.pillar(spot.clone(), GOLD, .6);
      FX.mangaLines(.6, .24);

      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        /* and they are put in it */
        if (TD && TD.clap) TD.clap(floor.clone().add(up(2.4)), 1.2);
        if (TD && TD.swapFx) TD.swapFx(floor.clone().add(up(1)), spot.clone().add(up(1)));
        if (TD && TD.dropMarker) TD.dropMarker(mk);
        if (e && !e.dead) {
          e.anchorT = .8;
          e.anchorPos.copy(spot).add(up(.4));
          e.pos.copy(e.anchorPos);
          e.vel.set(0, 0, 0);
          e.stunT = Math.max(e.stunT || 0, 1.2);
        }
        if (TD && TD.arrive) TD.arrive(spot, 1.3);
        addShake(1.6);
      }, 520);

      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        /* whatever he stepped out of the way of lands on them instead */
        var at = spot.clone().add(up(2.2));
        FX.flash('#ffe6c0', .6, .28);
        FX.converge(at.clone(), 0xd45a1e, 30, 12, .4);
        FX.cross(at.clone(), 0xffffff, 12, .3);
        FX.impact(at.clone(), HOT, 5);
        FX.rings(at.clone(), GOLD, 4, { maxR: 20, life: .7, ground: false, gap: 32 });
        FX.debris(new THREE.Vector3(spot.x, .1, spot.z), 16, 18, 0x8b7c62);
        FX.cracks(new THREE.Vector3(spot.x, .1, spot.z), 18, 22, 0x3a2a18);
        FX.blood(at.clone(), d.clone().negate(), 20, 2.4);
        FX.mangaLines(1, .34);
        if (typeof hitstop === 'function') hitstop(.24);
        addShake(4);
        if (e) e.anchorT = 0;
        G.dice(e, { dir: d.clone().negate(), power: 2.6, cubes: 24 });
      }, 1350);
    } },

    /* =================================================================
       HIROMI HIGURUMA
       He does not kill anybody either. He hands down a sentence and it
       is carried out, so every one of these is a proceeding: the charge
       is read, the finding is made, and then the thing happens.
       ============================================================== */

    /* 1 · the black sword. One cut, and the line stays in the air a
       moment longer than they do */
    j1: { name: 'SENTENCED', color: '#f2f4f8', hold: 1.9, run: function (e, d, p, G) {
      var HG = window.JJHIGURUMA;
      var INK = (HG && HG.INK) || 0x14141a, EDGE = (HG && HG.EDGE) || 0xf2f4f8;
      var BRASS = (HG && HG.BRASS) || 0xd8a441;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      /* the charge is put to them first: the seal, and everything stops */
      if (HG && HG.stamp) HG.stamp(floor, 9);
      FX.converge(p.clone(), BRASS, 22, 10, .55);
      FX.zoom(-6, .5);
      FX.mangaLines(.5, .45);
      if (typeof hitstop === 'function') hitstop(.12);
      if (e && !e.dead) { e.anchorT = .8; e.anchorPos.copy(e.pos); e.stunT = Math.max(e.stunT || 0, 1.2); }

      /* the blade comes up in both hands */
      var sw = (HG && HG.buildSword) ? HG.buildSword() : null;
      if (sw) {
        sw.position.copy(p).addScaledVector(d, -3.4).add(up(3));
        sw.rotation.y = Math.atan2(d.x, d.z);
        sw.rotation.z = .3;
        scene.add(sw);
      }
      var t = 0, cut = false;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined') return false;
        if (sw) {
          var k = Math.min(1, t / .6);
          /* over the head, then straight down through the middle */
          sw.position.copy(p).addScaledVector(d, -3.4 + 3.4 * k).add(up(3 + 5 * (1 - k)));
          sw.rotation.z = .3 - k * .3;
          sw.rotation.x = -.6 + k * 1.9;
        }
        if (!cut && t > .62) {
          cut = true;
          var at = (e && !e.dead ? e.pos.clone().add(up(2.6)) : p.clone());
          FX.flash('#ffffff', .55, .24);
          FX.slash(at.clone(), new THREE.Vector3(0, -1, 0), INK, 24, .34);
          FX.slash(at.clone(), new THREE.Vector3(0, -1, 0), EDGE, 18, .24);
          /* the line, which outlasts them */
          FX.cutLine(at.clone().add(up(7)), at.clone().add(up(-3)), EDGE, 1.6, .8);
          FX.blood(at.clone(), new THREE.Vector3(0, -1, 0), 24, 2.6);
          FX.mangaLines(1, .34);
          if (typeof hitstop === 'function') hitstop(.26);
          addShake(3.6);
          if (e) e.anchorT = 0;
          setTimeout(function () {
            if (typeof scene === 'undefined') return;
            G.halve(e, { dir: new THREE.Vector3(1, 0, 0), power: 2.4 });
          }, 200);
        }
        if (t > 1.35) {
          if (sw) {
            scene.remove(sw);
            sw.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
          }
          return false;
        }
        return true;
      } });
    } },

    /* 2 · three raps, and each one is bigger than the last */
    j2: { name: 'CASE CLOSED', color: '#d8a441', hold: 2.4, run: function (e, d, p, G) {
      var HG = window.JJHIGURUMA;
      var BRASS = (HG && HG.BRASS) || 0xd8a441, OAK_D = (HG && HG.OAK_D) || 0x4e3320;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      [0, .62, 1.32].forEach(function (ms, i) {
        setTimeout(function () {
          if (typeof scene === 'undefined') return;
          var size = .7 + i * .9;
          var at = (e && !e.dead ? new THREE.Vector3(e.pos.x, 0, e.pos.z) : floor.clone());
          var g = (HG && HG.buildGavel) ? HG.buildGavel(size) : null;
          if (g) {
            g.position.copy(at).add(up(20 + i * 8));
            g.rotation.z = .4;
            scene.add(g);
          }
          var t = 0, hit = false;
          addFx({ t: 1e9, update: function (dt) {
            t += dt;
            if (typeof scene === 'undefined') return false;
            if (g) {
              g.position.y = Math.max(2 * size, (20 + i * 8) - (150 + i * 60) * t * t);
              g.rotation.z = .4 * Math.max(0, 1 - t * 6);
            }
            if (!hit && (!g || g.position.y <= 2.1 * size)) {
              hit = true;
              if (HG && HG.stamp) HG.stamp(at, 8 + i * 6);
              FX.flash('#ffe9c0', .3 + i * .16, .2);
              FX.impact(at.clone().add(up(1.6)), BRASS, 3 + i * 1.4);
              FX.rings(new THREE.Vector3(at.x, .12, at.z), BRASS, 3 + i,
                { maxR: 14 + i * 9, life: .6, gap: 36 });
              FX.cracks(new THREE.Vector3(at.x, .1, at.z), 14 + i * 6, 18 + i * 8, OAK_D);
              FX.dust(new THREE.Vector3(at.x, 0, at.z), 10 + i * 5, 0xd6c8ae, 14 + i * 6, 5);
              FX.debris(new THREE.Vector3(at.x, .1, at.z), 8 + i * 5, 12 + i * 6, OAK_D);
              addShake(2 + i * 1.2);
              if (typeof hitstop === 'function') hitstop(.1 + i * .06);
              if (e && !e.dead) {
                e.anchorT = .5;
                e.anchorPos.set(at.x, 0, at.z);
                e.pos.lerp(e.anchorPos, .7);
                e.stunT = Math.max(e.stunT || 0, .8);
                FX.blood(e.pos.clone().add(up(1.4)), up(1), 9 + i * 5, 1.6);
              }
              /* and on the third, that is the finding */
              if (i === 2) {
                FX.mangaLines(1, .34);
                if (e) e.anchorT = 0;
                G.flatten(e, { crater: 17 });
              }
            }
            if (t > .9) {
              if (g) {
                scene.remove(g);
                g.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
              }
              return false;
            }
            return true;
          } });
        }, ms * 1000);
      });
    } },

    /* 3 · every sheet of it, on them, and then all of it pulled at once */
    j3: { name: 'ENTERED INTO EVIDENCE', color: '#f2ecd9', hold: 2.3, run: function (e, d, p, G) {
      var HG = window.JJHIGURUMA;
      var PAPER = (HG && HG.PAPER) || 0xf2ecd9, BRASS = (HG && HG.BRASS) || 0xd8a441;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      FX.streaks(p.clone(), PAPER, 8, 16, .9);
      addShake(1);

      /* the blizzard: it keeps arriving for a second and a half */
      var t = 0, n = 0;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined') return false;
        var body = (e && !e.dead ? e.pos.clone() : floor.clone()).add(up(2.2));
        if (t > n * .045) {
          n++;
          if (HG && HG.sheet) {
            var a = Math.random() * TAU, r = 7 + Math.random() * 5;
            HG.sheet(body.clone().add(new THREE.Vector3(
              Math.cos(a) * r, (Math.random() - .5) * 6, Math.sin(a) * r)),
              body.clone().add(new THREE.Vector3(
                Math.cos(a) * .8, (Math.random() - .5) * 2.2, Math.sin(a) * .8)), .9);
          }
          if (n % 5 === 0) {
            FX.impact(body.clone(), PAPER, 1.6);
            addShake(.5);
          }
        }
        if (e && !e.dead) {
          e.anchorT = .4;
          e.anchorPos.copy(floor).add(up(.4 + Math.min(3, t * 2)));
          e.pos.lerp(e.anchorPos, Math.min(1, dt * 7));
          e.vel.set(0, 0, 0);
          e.stunT = Math.max(e.stunT || 0, .6);
        }
        return t < 1.45;
      } });

      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        var body = (e && !e.dead ? e.pos.clone() : floor.clone().add(up(3)));
        /* and every one of them goes back out, taking a piece with it */
        for (var i = 0; i < 40; i++) {
          var a = Math.random() * TAU, r = 14 + Math.random() * 10;
          if (HG && HG.sheet) {
            HG.sheet(body.clone(), body.clone().add(new THREE.Vector3(
              Math.cos(a) * r, (Math.random() - .3) * 10, Math.sin(a) * r)), .8);
          }
        }
        FX.flash('#fffaf0', .5, .26);
        FX.cross(body.clone(), 0xffffff, 11, .28);
        FX.rings(body.clone(), BRASS, 4, { maxR: 20, life: .7, ground: false, gap: 34 });
        FX.blood(body.clone(), new THREE.Vector3(1, 0, 0), 22, 2.4);
        FX.mangaLines(1, .34);
        if (typeof hitstop === 'function') hitstop(.22);
        addShake(3.4);
        if (e) e.anchorT = 0;
        G.dice(e, { dir: d, power: 2.4, cubes: 26 });
      }, 1550);
    } },

    /* 4 · the whole court, and what it decides */
    j4: { name: 'THE VERDICT', color: '#bfd4ff', hold: 3.0, run: function (e, d, p, G) {
      var HG = window.JJHIGURUMA;
      var BRASS = (HG && HG.BRASS) || 0xd8a441, OAK_D = (HG && HG.OAK_D) || 0x4e3320;
      var LAW = (HG && HG.LAW) || 0xbfd4ff, LAW2 = (HG && HG.LAW2) || 0xeaf2ff;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      var side = new THREE.Vector3(-d.z, 0, d.x).normalize();
      var stand = floor.clone().addScaledVector(d, 13).addScaledVector(side, 7);
      var j = (HG && HG.buildJudge) ? HG.buildJudge() : null;
      if (j) {
        j.position.set(stand.x, -18, stand.z);
        j.rotation.y = Math.atan2(floor.x - stand.x, floor.z - stand.z);
        scene.add(j);
      }
      FX.cracks(new THREE.Vector3(stand.x, .06, stand.z), 14, 18, OAK_D);
      FX.tint('#0d1420', .4, 1.6);
      addShake(2);

      var t = 0, held = false, read = false, done = false;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined') return false;
        if (j) j.position.y = Math.min(0, -18 + 30 * t);

        /* BEAT ONE — they are held for it */
        if (!held && t > .7) {
          held = true;
          if (HG && HG.stamp) HG.stamp(floor, 11);
          FX.rings(new THREE.Vector3(floor.x, .12, floor.z), BRASS, 3,
            { maxR: 18, life: .7, gap: 40 });
          addShake(1.4);
        }
        if (e && !e.dead && !done) {
          e.anchorT = .5;
          e.anchorPos.copy(floor).add(up(.4));
          e.pos.lerp(e.anchorPos, Math.min(1, dt * 7));
          e.vel.set(0, 0, 0);
          e.stunT = Math.max(e.stunT || 0, 1.4);
        }

        /* BEAT TWO — the finding, as a column standing on them */
        if (!read && t > 1.35) {
          read = true;
          if (HG && HG.column) HG.column(floor, 1.7, 7);
          FX.flash('#eaf2ff', .5, .3);
          FX.converge(floor.clone().add(up(2.4)), LAW, 34, 13, .6);
          FX.mangaLines(.8, .3);
          addShake(2.4);
          if (typeof hitstop === 'function') hitstop(.12);
          if (e && !e.dead) FX.blood(e.pos.clone().add(up(2.4)), up(1), 8, 1.4);
        }

        /* BEAT THREE — and the gavel behind it */
        if (read && !done && t > 2.3) {
          done = true;
          if (j) {
            if (j.__arms && j.__arms[1]) j.__arms[1].rotation.x = -1.5;
            if (j.__gavel) j.__gavel.rotation.z = -1.2;
          }
          setTimeout(function () {
            if (typeof scene === 'undefined') return;
            FX.flash('#ffffff', .8, .32);
            FX.impact(floor.clone().add(up(2)), LAW2, 6);
            FX.rings(new THREE.Vector3(floor.x, .12, floor.z), BRASS, 6,
              { maxR: 30, life: 1, gap: 36 });
            FX.cracks(new THREE.Vector3(floor.x, .1, floor.z), 26, 34, OAK_D);
            FX.dust(new THREE.Vector3(floor.x, 0, floor.z), 18, 0xd6c8ae, 24, 6);
            FX.debris(new THREE.Vector3(floor.x, .1, floor.z), 18, 20, OAK_D);
            FX.mangaLines(1, .38);
            if (typeof hitstop === 'function') hitstop(.28);
            addShake(4.6);
            if (e) e.anchorT = 0;
            G.erase(e, { color: LAW2, dir: d, power: 2 });
            /* and the seal, on an empty floor */
            if (HG && HG.stamp) HG.stamp(floor, 16);
          }, 260);
        }

        if (t > 3.4) {
          if (j) {
            var s2 = 0;
            addFx({ t: 1e9, update: function (dd) {
              s2 += dd;
              j.position.y = -26 * s2;
              if (s2 > .9) {
                scene.remove(j);
                j.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
                return false;
              }
              return true;
            } });
          }
          return false;
        }
        return true;
      } });
    } },

    /* R · the dock, and they are on the wrong side of it */
    jr: { name: 'HELD IN CONTEMPT', color: '#7a5230', hold: 1.8, run: function (e, d, p, G) {
      var HG = window.JJHIGURUMA;
      var BRASS = (HG && HG.BRASS) || 0xd8a441, OAK_D = (HG && HG.OAK_D) || 0x4e3320;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      var side = new THREE.Vector3(-d.z, 0, d.x).normalize();
      FX.impact(p.clone(), BRASS, 2.4);
      FX.cross(p.clone(), BRASS, 5, .18);
      addShake(1.2);
      if (e && !e.dead) { e.anchorT = .8; e.anchorPos.copy(floor).add(up(.4)); e.stunT = Math.max(e.stunT || 0, 1.4); }

      /* four of them, boxing the body in, one at a time */
      [0, .18, .36, .54].forEach(function (ms, i) {
        setTimeout(function () {
          if (typeof scene === 'undefined') return;
          var a = i / 4 * TAU + .4;
          var at = floor.clone().add(new THREE.Vector3(Math.cos(a) * 4.6, 0, Math.sin(a) * 4.6));
          var face = floor.clone().sub(at).setY(0).normalize();
          if (HG && HG.buildDock) HG.buildDock(at, face, true);
          FX.dust(new THREE.Vector3(at.x, 0, at.z), 6, 0xd6c8ae, 10, 4);
          addShake(1);
          if (typeof hitstop === 'function') hitstop(.05);
        }, ms * 1000);
      });

      /* and the last one comes up underneath */
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        var at = (e && !e.dead ? new THREE.Vector3(e.pos.x, 0, e.pos.z) : floor.clone());
        if (HG && HG.buildDock) HG.buildDock(at, d.clone(), true);
        if (HG && HG.stamp) HG.stamp(at, 12);
        FX.flash('#ffe9c0', .55, .26);
        FX.impact(at.clone().add(up(2)), BRASS, 4.4);
        FX.rings(new THREE.Vector3(at.x, .12, at.z), BRASS, 4,
          { maxR: 20, life: .7, gap: 36 });
        FX.cracks(new THREE.Vector3(at.x, .1, at.z), 20, 24, OAK_D);
        FX.debris(new THREE.Vector3(at.x, .1, at.z), 18, 20, OAK_D);
        FX.blood(at.clone().add(up(2.2)), up(1), 20, 2.4);
        FX.mangaLines(1, .32);
        if (typeof hitstop === 'function') hitstop(.24);
        addShake(3.8);
        if (e) e.anchorT = 0;
        G.dice(e, { dir: side, power: 2.6, cubes: 24 });
      }, 1000);
    } },

    /* =================================================================
       YUTA OKKOTSU
       Five cuts, and the last one is the only one that is more than a
       cut. He is a boy with a sword who puts far too much into it, so
       every one of these ends somebody with the part that got away.
       ============================================================== */

    /* 1 · three cuts, each one further past the end of the sword */
    o1: { name: 'CUT DOWN', color: '#eafcff', hold: 1.8, run: function (e, d, p, G) {
      var YT = window.JJYUTA;
      var CE = (YT && YT.CE) || 0x8fe6ff, CE2 = (YT && YT.CE2) || 0xeafcff;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      var side = new THREE.Vector3(-d.z, 0, d.x).normalize();
      var kat = (YT && YT.buildKatana) ? YT.buildKatana() : null;
      if (kat) {
        kat.position.copy(p).addScaledVector(side, -5).add(up(2.4));
        kat.rotation.y = Math.atan2(d.x, d.z);
        kat.rotation.z = 1.5;
        scene.add(kat);
      }
      FX.mangaLines(.6, .4);
      FX.zoom(-5, .4);
      if (e && !e.dead) { e.anchorT = .8; e.anchorPos.copy(e.pos); e.stunT = Math.max(e.stunT || 0, 1); }

      var t = 0, n = 0;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined') return false;
        if (n < 3 && t > .28 + n * .3) {
          var i = n++;
          var ax = i === 0 ? side.clone()
            : (i === 1 ? side.clone().add(up(1)).normalize() : new THREE.Vector3(0, -1, 0));
          var at2 = (e && !e.dead ? e.pos.clone().add(up(2.6)) : p.clone());
          if (kat) {
            kat.position.copy(at2).addScaledVector(ax, -4);
            kat.rotation.z = 1.5 - i * 1.2;
          }
          FX.slash(at2.clone(), ax, i < 2 ? CE2 : 0xffffff, 16 + i * 4, .26);
          if (YT && YT.spill) YT.spill(at2.clone(), ax, 26 + i * 8, 12 + i * 4, CE);
          FX.cutLine(at2.clone().addScaledVector(ax, -9), at2.clone().addScaledVector(ax, 9),
            CE2, 1 + i * .4, .45);
          FX.blood(at2.clone(), ax, 12 + i * 5, 1.8 + i * .3);
          addShake(1.8 + i * .8);
          if (typeof hitstop === 'function') hitstop(.08 + i * .05);
        }
        if (t > 1.25) {
          var at3 = (e && !e.dead ? e.pos.clone().add(up(2.4)) : p.clone());
          FX.flash('#ffffff', .6, .28);
          FX.cross(at3.clone(), 0xffffff, 13, .3);
          if (YT && YT.spill) YT.spill(at3.clone(), d, 40, 22, CE);
          FX.cracks(new THREE.Vector3(floor.x, .1, floor.z), 24, 30, 0x59636e);
          FX.mangaLines(1, .36);
          if (typeof hitstop === 'function') hitstop(.24);
          addShake(4);
          if (e) e.anchorT = 0;
          G.sever(e, { dir: side, power: 2.8, cubes: 20 });
          if (kat) {
            scene.remove(kat);
            kat.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
          }
          return false;
        }
        return true;
      } });
    } },

    /* 2 · the thrust does not stop at them, and neither does he */
    o2: { name: 'RUN CLEAN THROUGH', color: '#eafcff', hold: 1.7, run: function (e, d, p, G) {
      var YT = window.JJYUTA;
      var CE = (YT && YT.CE) || 0x8fe6ff, CE2 = (YT && YT.CE2) || 0xeafcff;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      var kat = (YT && YT.buildKatana) ? YT.buildKatana() : null;
      if (kat) {
        kat.position.copy(p).addScaledVector(d, -6).add(up(2.4));
        kat.rotation.y = Math.atan2(d.x, d.z);
        kat.rotation.x = -Math.PI / 2;
        scene.add(kat);
      }
      FX.converge(p.clone(), CE, 20, 9, .45);
      FX.mangaLines(.5, .34);
      if (e && !e.dead) { e.anchorT = .8; e.anchorPos.copy(e.pos); e.stunT = Math.max(e.stunT || 0, 1.2); }

      var t = 0, went = false, out2 = false;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined') return false;
        /* it goes in, it is held there, and then it keeps going */
        if (kat) {
          var k = t < .5 ? E2(t / .5) : 1;
          kat.position.copy(p).addScaledVector(d, -6 + 8 * k).add(up(2.4));
        }
        if (!went && t > .5) {
          went = true;
          var at = (e && !e.dead ? e.pos.clone().add(up(2.5)) : p.clone());
          FX.cutLine(at.clone().addScaledVector(d, -4), at.clone().addScaledVector(d, 30), CE2, 1.4, .6);
          FX.impact(at.clone(), CE2, 3.4);
          FX.blood(at.clone(), d, 18, 2.2);
          if (YT && YT.spill) YT.spill(at.clone(), d, 34, 6, CE);
          if (typeof hitstop === 'function') hitstop(.2);
          addShake(2.8);
        }
        /* and then he turns it, which is the part that ends them */
        if (went && !out2 && t > 1.15) {
          out2 = true;
          var at2 = (e && !e.dead ? e.pos.clone().add(up(2.5)) : p.clone());
          var side = new THREE.Vector3(-d.z, 0, d.x).normalize();
          FX.flash('#ffffff', .6, .28);
          FX.slash(at2.clone(), side, 0xffffff, 22, .3);
          if (YT && YT.spill) YT.spill(at2.clone(), side, 30, 16, CE);
          FX.cross(at2.clone(), CE2, 12, .3);
          FX.blood(at2.clone(), side, 24, 2.6);
          FX.mangaLines(1, .34);
          if (typeof hitstop === 'function') hitstop(.24);
          addShake(4);
          if (e) e.anchorT = 0;
          G.sever(e, { dir: side, power: 2.6, cubes: 18 });
        }
        if (t > 1.5) {
          if (kat) {
            scene.remove(kat);
            kat.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
          }
          return false;
        }
        return true;
      } });
    } },

    /* 3 · up, and then up again, and there is no third one */
    o3: { name: 'STRAIGHT UP', color: '#8fe6ff', hold: 2.2, run: function (e, d, p, G) {
      var YT = window.JJYUTA;
      var CE = (YT && YT.CE) || 0x8fe6ff, CE2 = (YT && YT.CE2) || 0xeafcff;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      var UP = new THREE.Vector3(0, 1, 0);
      var TOP = 22;
      FX.mangaLines(.7, .26);

      var t = 0, n = 0, last = false;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined') return false;
        /* three rising cuts, and they get further off the floor each time */
        if (n < 3 && t > .2 + n * .34) {
          var i = n++;
          var at = (e && !e.dead ? e.pos.clone().add(up(1.4)) : floor.clone().add(up(2)));
          FX.slash(at.clone(), UP, i < 2 ? CE2 : 0xffffff, 15 + i * 4, .24);
          FX.cutLine(at.clone().add(up(-2)), at.clone().add(up(18 + i * 6)), CE2, 1 + i * .3, .4);
          if (YT && YT.spill) YT.spill(at.clone(), UP, 22 + i * 8, 9 + i * 3, CE);
          FX.blood(at.clone(), UP, 11 + i * 5, 1.8);
          addShake(1.6 + i * .7);
          if (typeof hitstop === 'function') hitstop(.07 + i * .04);
          if (e && !e.dead) {
            e.anchorT = .4;
            e.anchorPos.copy(floor).add(up(3 + i * 6.5));
            e.pos.lerp(e.anchorPos, .7);
            e.vel.set(0, 0, 0);
          }
        }
        /* and the last one goes all the way through, from underneath */
        if (!last && t > 1.5) {
          last = true;
          var high = (e && !e.dead ? e.pos.clone().add(up(1)) : floor.clone().add(up(TOP)));
          FX.flash('#ffffff', .65, .3);
          FX.cutLine(high.clone().add(up(-6)), high.clone().add(up(30)), 0xffffff, 1.8, .6);
          if (YT && YT.spill) YT.spill(high.clone(), UP, 44, 20, CE);
          FX.cross(high.clone(), CE2, 13, .32);
          FX.blood(high.clone(), UP, 24, 2.6);
          FX.mangaLines(1, .36);
          if (typeof hitstop === 'function') hitstop(.26);
          addShake(4.2);
          if (e) e.anchorT = 0;
          G.sever(e, { dir: UP, power: 2.6, cubes: 22 });
        }
        return t < 2.0;
      } });
    } },

    /* 4 · the X, and then the same X again on the other diagonal, which
       makes eight pieces out of four */
    o4: { name: 'EIGHT PIECES', color: '#eafcff', hold: 2.0, run: function (e, d, p, G) {
      var YT = window.JJYUTA;
      var CE = (YT && YT.CE) || 0x8fe6ff, CE2 = (YT && YT.CE2) || 0xeafcff;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      var side = new THREE.Vector3(-d.z, 0, d.x).normalize();
      if (e && !e.dead) { e.anchorT = .9; e.anchorPos.copy(floor).add(up(1.4)); e.stunT = Math.max(e.stunT || 0, 1.4); }
      FX.mangaLines(.6, .3);

      var t = 0, n = 0;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined') return false;
        /* four cuts, forty five degrees apart, each on its own frame */
        if (n < 4 && t > .22 + n * .22) {
          var i = n++;
          var a = i * (Math.PI / 4);
          var ax = side.clone().multiplyScalar(Math.cos(a))
            .add(new THREE.Vector3(0, Math.sin(a), 0)).normalize();
          var at = (e && !e.dead ? e.pos.clone().add(up(2.4)) : floor.clone().add(up(2.4)));
          FX.slash(at.clone(), ax, i % 2 ? CE : CE2, 16, .24);
          FX.cutLine(at.clone().addScaledVector(ax, -12), at.clone().addScaledVector(ax, 12),
            CE2, 1.1, .45);
          if (YT && YT.spill) YT.spill(at.clone(), ax, 24, 10, CE);
          FX.blood(at.clone(), ax, 10, 1.7);
          addShake(1.6);
          if (typeof hitstop === 'function') hitstop(.07);
        }
        if (t > 1.2) {
          var at2 = (e && !e.dead ? e.pos.clone().add(up(2.4)) : floor.clone().add(up(2.4)));
          FX.flash('#ffffff', .6, .28);
          FX.cross(at2.clone(), 0xffffff, 14, .32);
          FX.lattice(at2.clone(), d, 3, 3, 4, 4, CE2, { stagger: 18, life: .45, width: .3 });
          if (YT && YT.spill) YT.spill(at2.clone(), d, 30, 18, CE);
          FX.blood(at2.clone(), side, 24, 2.6);
          FX.mangaLines(1, .34);
          if (typeof hitstop === 'function') hitstop(.24);
          addShake(4);
          if (e) e.anchorT = 0;
          G.dice(e, { dir: side, power: 2.6, cubes: 30 });
          return false;
        }
        return true;
      } });
    } },

    /* R · the special. He does not cut faster or from a better angle. He
       stops holding any of it back, and the road goes with them */
    or: { name: 'NOTHING HELD BACK', color: '#ffffff', hold: 2.5, run: function (e, d, p, G) {
      var YT = window.JJYUTA;
      var CE = (YT && YT.CE) || 0x8fe6ff, CE2 = (YT && YT.CE2) || 0xeafcff;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      var side = new THREE.Vector3(-d.z, 0, d.x).normalize();
      /* the wind-up: everything goes IN, and the frame goes quiet */
      FX.converge(p.clone(), CE, 40, 18, .9);
      FX.zoom(-9, .8);
      FX.mangaLines(.4, .8);
      FX.tint('#08161e', .5, 1.2);
      if (typeof hitstop === 'function') hitstop(.18);
      if (e && !e.dead) { e.anchorT = 1.2; e.anchorPos.copy(e.pos); e.stunT = Math.max(e.stunT || 0, 1.8); }

      var kat = (YT && YT.buildKatana) ? YT.buildKatana() : null;
      if (kat) {
        kat.position.copy(p).addScaledVector(side, -7).add(up(5));
        kat.rotation.y = Math.atan2(d.x, d.z);
        kat.rotation.z = 1.9;
        kat.scale.setScalar(1.6);
        scene.add(kat);
      }
      var t = 0, cut = false;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined') return false;
        if (kat && !cut) {
          /* held over the shoulder, shaking, while it builds */
          kat.position.copy(p).addScaledVector(side, -7 + Math.sin(t * 30) * .1).add(up(5));
          if (Math.random() < dt * 30) {
            var w = new THREE.Vector3();
            kat.getWorldPosition(w);
            FX.mote(w.clone().add(new THREE.Vector3(
              (Math.random() - .5) * 4, (Math.random() - .5) * 5, (Math.random() - .5) * 4)), CE2, 2, .3);
          }
        }
        if (!cut && t > 1.0) {
          cut = true;
          var at = (e && !e.dead ? e.pos.clone().add(up(2.6)) : p.clone());
          if (kat) { kat.position.copy(at).addScaledVector(side, 5); kat.rotation.z = -1.1; }
          /* and then all sixty metres of it at once */
          FX.flash('#ffffff', 1, .4);
          FX.slash(at.clone(), side, 0xffffff, 40, .4);
          FX.slash(at.clone().add(up(-1.2)), side, CE2, 32, .32);
          if (YT && YT.spill) {
            YT.spill(at.clone(), d, 64, 30, CE);
            YT.spill(at.clone(), d, 44, 16, CE2);
          }
          for (var i = 0; i < 9; i++) {
            var k = i / 8 - .5;
            FX.cutLine(at.clone().addScaledVector(side, k * 30),
              at.clone().addScaledVector(side, k * 30).addScaledVector(d, 62),
              i % 2 ? CE2 : 0xffffff, 1.6, .8);
          }
          FX.speedRing(at.clone(), CE2, 36, .5);
          FX.rings(at.clone(), CE, 5, { maxR: 32, life: 1, ground: false, gap: 30 });
          FX.cracks(new THREE.Vector3(floor.x + d.x * 16, .1, floor.z + d.z * 16), 28, 40, 0x59636e);
          FX.dust(new THREE.Vector3(floor.x + d.x * 12, 0, floor.z + d.z * 12), 20, 0xcfd8e0, 28, 7);
          FX.blood(at.clone(), side, 30, 3);
          FX.mangaLines(1, .5);
          if (typeof hitstop === 'function') hitstop(.36);
          addShake(6);
          if (e) e.anchorT = 0;
          G.halve(e, { dir: side, power: 3.2 });
          /* and a very long way down the road, a very small flash */
          setTimeout(function () {
            if (typeof scene === 'undefined') return;
            var far = floor.clone().addScaledVector(d, 62).add(up(4));
            FX.cross(far, 0xffffff, 9, .35);
            FX.impact(far, CE2, 2.6);
            FX.dust(new THREE.Vector3(far.x, 0, far.z), 10, 0xcfd8e0, 14, 5);
          }, 380);
        }
        if (t > 1.9) {
          if (kat) {
            scene.remove(kat);
            kat.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
          }
          return false;
        }
        return true;
      } });
    } },

    /* =================================================================
       KOKICHI MUTA
       He is not in the room and he never was. Everything that kills
       anybody here is built out of nothing on the spot, spends itself,
       and comes apart — because he never keeps a body he cannot
       afford to lose. Every one of these ends with the weapon in
       pieces on the floor beside them.
       ============================================================== */

    /* helper the five share: something assembles, and it is loud about it */
    /* 1 · the cannon walks its shots in, and the last one is not ranging */
    k1: { name: 'SHELLED', color: '#ffd23d', hold: 2, run: function (e, d, p, G) {
      var MU = window.JJMUTA;
      var WARN = (MU && MU.WARN) || 0xd8c24a, HOT = (MU && MU.HOT) || 0xff8a3d;
      var side = new THREE.Vector3(-d.z, 0, d.x).normalize();
      var floor = new THREE.Vector3(p.x, 0, p.z);
      /* it is built behind him, far too big, and pointed at one person */
      var gun = (MU && MU.buildCannon) ? MU.buildCannon() : null;
      var muzzle = p.clone().addScaledVector(d, -13).add(up(4.4));
      if (gun) {
        gun.position.copy(muzzle);
        gun.rotation.y = Math.atan2(d.x, d.z);
        gun.scale.setScalar(2.3);
        scene.add(gun);
        if (MU.assemble) MU.assemble(gun, .8);
      }
      FX.mangaLines(.5, .5);
      FX.zoom(-6, .5);
      if (e && !e.dead) { e.anchorT = 1.4; e.anchorPos.copy(e.pos); e.stunT = Math.max(e.stunT || 0, 1.8); }

      var t = 0, n = 0;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined') return false;
        var at = (e && !e.dead ? e.pos.clone().add(up(2.6)) : p.clone().add(up(2.6)));
        if (gun) gun.lookAt(at);
        /* three ranging shells, each landing nearer than the last */
        if (n < 3 && t > .85 + n * .3) {
          var i = n++;
          var miss = at.clone().addScaledVector(side, (i % 2 ? 1 : -1) * (7 - i * 3));
          miss.y = .2;
          if (gun) gun.position.copy(muzzle).addScaledVector(d, -1.2);
          if (MU && MU.exhaust) MU.exhaust(muzzle.clone().addScaledVector(d, 5), d, 9);
          FX.cutLine(muzzle.clone(), miss.clone(), WARN, .5, .16);
          FX.impact(miss.clone(), HOT, 2.6 + i);
          FX.cracks(miss.clone(), 6 + i * 3, 9 + i * 4, 0x3a3f46);
          FX.debris(miss.clone(), 8, 10 + i * 4, 0x6a7078);
          FX.dust(miss.clone(), 8, 0x9aa0a8, 10, 4);
          addShake(1 + i * .5);
        }
        if (gun && t > .85) {
          gun.position.lerp(muzzle, Math.min(1, dt * 7));   // the recoil, walked back out
        }
        /* and then the one that was aimed */
        if (t > 1.85) {
          FX.cutLine(muzzle.clone(), at.clone(), 0xffffff, 1.6, .3);
          FX.flash('#ffe9a8', .7, .3);
          FX.impact(at.clone(), WARN, 6);
          FX.rings(at.clone(), HOT, 4, { maxR: 16, life: .6, ground: false, gap: 34 });
          if (MU && MU.sparks) MU.sparks(at.clone(), 26);
          FX.cracks(floor.clone(), 20, 26, 0x3a3f46);
          FX.blood(at.clone(), d, 26, 2.8);
          FX.mangaLines(1, .36);
          if (typeof hitstop === 'function') hitstop(.26);
          addShake(4.4);
          if (e) e.anchorT = 0;
          G.sever(e, { dir: d, power: 3, cubes: 22 });
          if (gun && MU.scrap) MU.scrap(gun, gun.position.clone());
          return false;
        }
        return true;
      } });
    } },

    /* 2 · the fist goes out on the chain, comes back, and goes out again */
    k2: { name: 'ON THE CHAIN', color: '#b2793f', hold: 2.1, run: function (e, d, p, G) {
      var MU = window.JJMUTA;
      var COP = (MU && MU.COP) || 0xb2793f, WARN = (MU && MU.WARN) || 0xd8c24a;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      var home = p.clone().addScaledVector(d, -2).add(up(3));
      var fist = (MU && MU.buildFist) ? MU.buildFist() : null;
      if (fist) {
        fist.position.copy(home);
        fist.rotation.y = Math.atan2(d.x, d.z);
        fist.scale.setScalar(1.7);
        scene.add(fist);
        if (MU.assemble) MU.assemble(fist, .6);
      }
      FX.mangaLines(.5, .4);
      if (e && !e.dead) { e.anchorT = 1.6; e.anchorPos.copy(e.pos); e.stunT = Math.max(e.stunT || 0, 2); }

      var t = 0, hits = 0;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined') return false;
        var at = (e && !e.dead ? e.pos.clone().add(up(2.4)) : p.clone().add(up(2.4)));
        /* two throws out and back, then one from straight above */
        var k, from = home;
        if (t < .7) { if (fist) fist.position.copy(home); }
        else if (t < 1.15) {
          k = E2(Math.min(1, (t - .7) / .28));
          if (t - .7 > .28) k = 1 - E2(Math.min(1, (t - .98) / .17));
          if (fist) fist.position.lerpVectors(home, at, k);
        } else if (t < 1.6) {
          k = E2(Math.min(1, (t - 1.15) / .26));
          if (t - 1.15 > .26) k = 1 - E2(Math.min(1, (t - 1.41) / .19));
          if (fist) fist.position.lerpVectors(home, at, k);
        } else {
          k = E2(Math.min(1, (t - 1.6) / .34));
          from = at.clone().add(up(15));
          if (fist) fist.position.lerpVectors(from, new THREE.Vector3(at.x, .8, at.z), k);
        }
        if (fist) {
          fist.rotation.z += dt * 5;
          if (t < 1.6) MU.chain(home.clone(), fist.position.clone());
        }
        if (hits < 2 && t > .98 + hits * .45) {
          hits++;
          FX.impact(at.clone(), COP, 3);
          FX.shockwave(at.clone(), 0xffffff, 1.4);
          FX.blood(at.clone(), d, 14, 2);
          if (MU && MU.sparks) MU.sparks(at.clone(), 10);
          if (typeof hitstop === 'function') hitstop(.11);
          addShake(2.2);
        }
        /* the last one does not stop at the body; it stops at the road */
        if (t > 1.94) {
          FX.flash('#ffe9a8', .6, .28);
          FX.impact(new THREE.Vector3(at.x, .6, at.z), WARN, 6);
          FX.rings(new THREE.Vector3(at.x, .12, at.z), COP, 4, { maxR: 17, life: .7, gap: 32 });
          FX.cracks(new THREE.Vector3(at.x, .1, at.z), 22, 26, 0x3a3f46);
          FX.debris(new THREE.Vector3(at.x, .1, at.z), 18, 22, 0x6a7078);
          FX.dust(new THREE.Vector3(at.x, 0, at.z), 16, 0x9aa0a8, 18, 6);
          FX.mangaLines(1, .34);
          if (typeof hitstop === 'function') hitstop(.26);
          addShake(4.4);
          if (e) e.anchorT = 0;
          G.flatten(e, { crater: 20 });
          if (fist && MU.scrap) MU.scrap(fist, fist.position.clone());
          return false;
        }
        return true;
      } });
    } },

    /* 3 · it goes in, it is held there turning, and it comes out the back */
    k3: { name: 'DRILLED', color: '#8a939c', hold: 2.3, run: function (e, d, p, G) {
      var MU = window.JJMUTA;
      var PALE = (MU && MU.PALE) || 0xc3cad1, WARN = (MU && MU.WARN) || 0xd8c24a;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      var drill = (MU && MU.buildDrill) ? MU.buildDrill() : null;
      var start = p.clone().addScaledVector(d, -7).add(up(2.6));
      if (drill) {
        drill.position.copy(start);
        drill.rotation.y = Math.atan2(d.x, d.z);
        drill.scale.setScalar(1.9);
        scene.add(drill);
        if (MU.assemble) MU.assemble(drill, .7);
      }
      FX.mangaLines(.5, .5);
      FX.zoom(-5, .5);
      if (e && !e.dead) { e.anchorT = 1.8; e.anchorPos.copy(e.pos); e.stunT = Math.max(e.stunT || 0, 2.2); }

      var t = 0, tick = 0, spin = 0;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined') return false;
        var at = (e && !e.dead ? e.pos.clone().add(up(2.4)) : p.clone().add(up(2.4)));
        spin += dt * (t < .8 ? 14 : 46);
        if (drill) {
          if (drill.__bit) drill.__bit.rotation.z = spin;
          /* in over half a second, then held, then all the way through */
          var k = t < .8 ? 0
            : (t < 1.15 ? E2((t - .8) / .35)
              : (t < 1.95 ? 1 : 1 + E2(Math.min(1, (t - 1.95) / .3)) * .9));
          drill.position.lerpVectors(start, at, Math.min(1, k));
          if (k > 1) drill.position.copy(at).addScaledVector(d, (k - 1) * 9);
          drill.position.y += Math.sin(t * 40) * .06;      // it does not sit still
        }
        /* while it is in, it throws everything it takes out */
        if (t > 1.1 && t < 1.95 && (tick -= dt) <= 0) {
          tick = .07;
          FX.blood(at.clone(), d.clone().negate(), 5, 2.6);
          if (MU && MU.sparks) MU.sparks(at.clone().addScaledVector(d, -.6), 3);
          FX.mote(at.clone(), PALE, 1.4, .16);
          addShake(.5);
        }
        if (t > 2.2) {
          var out = at.clone().addScaledVector(d, 8);
          FX.flash('#ffffff', .6, .3);
          FX.cutLine(at.clone(), out, PALE, 1.2, .26);
          FX.impact(out, WARN, 4.4);
          FX.blood(out, d, 28, 3);
          if (MU && MU.sparks) MU.sparks(out, 22);
          FX.cracks(floor.clone(), 18, 22, 0x3a3f46);
          FX.mangaLines(1, .36);
          if (typeof hitstop === 'function') hitstop(.26);
          addShake(4);
          if (e) e.anchorT = 0;
          G.erase(e, { dir: d, color: PALE });
          if (drill && MU.scrap) MU.scrap(drill, drill.position.clone());
          return false;
        }
        return true;
      } });
    } },

    /* 4 · four pods in a ring, and none of them is saving anything */
    k4: { name: 'ORDNANCE', color: '#ff8a3d', hold: 2.2, run: function (e, d, p, G) {
      var MU = window.JJMUTA;
      var HOT = (MU && MU.HOT) || 0xff8a3d, WARN = (MU && MU.WARN) || 0xd8c24a;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      var pods = [];
      for (var i = 0; i < 4; i++) {
        var a = i / 4 * TAU + .4;
        var pod = (MU && MU.buildPod) ? MU.buildPod() : null;
        if (!pod) break;
        pod.position.copy(p).add(new THREE.Vector3(Math.cos(a) * 9, 8 + (i % 2) * 2.5, Math.sin(a) * 9));
        pod.scale.setScalar(1.5);
        scene.add(pod);
        if (MU.assemble) MU.assemble(pod, .55);
        pods.push(pod);
      }
      FX.mangaLines(.5, .5);
      if (e && !e.dead) { e.anchorT = 1.8; e.anchorPos.copy(e.pos); e.stunT = Math.max(e.stunT || 0, 2.2); }

      var t = 0, fired = 0, salvo = 0;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined') return false;
        var at = (e && !e.dead ? e.pos.clone().add(up(2.4)) : p.clone().add(up(2.4)));
        for (var j = 0; j < pods.length; j++) pods[j].lookAt(at);
        /* twelve, three at a time, arcing in over the top */
        if (fired < 12 && t > .75 + salvo * .22) {
          salvo++;
          for (var k2 = 0; k2 < 3 && fired < 12; k2++) {
            var src = pods[fired % pods.length].position.clone();
            var apex = src.clone().lerp(at, .5).add(up(5 + Math.random() * 4));
            var land = at.clone().add(new THREE.Vector3(
              (Math.random() - .5) * 5, (Math.random() - .5) * 2, (Math.random() - .5) * 5));
            FX.cutLine(src, apex, HOT, .5, .12);
            FX.cutLine(apex, land, HOT, .5, .14);
            FX.impact(land, HOT, 2.4);
            FX.flame(land.clone(), 2.2, .35);
            FX.blood(land.clone(), d, 5, 1.4);
            fired++;
          }
          if (MU && MU.sparks) MU.sparks(at.clone(), 6);
          addShake(1.1);
        }
        /* and then every tube left, at once */
        if (t > 1.95) {
          FX.flash('#ffb070', .8, .38);
          for (var m = 0; m < pods.length; m++) {
            FX.cutLine(pods[m].position.clone(), at.clone(), 0xffe9a8, 1.3, .26);
          }
          FX.impact(at.clone(), WARN, 7);
          FX.fire(at.clone(), 18, 1.8, 4, 1);
          FX.flame(at.clone(), 6, .9);
          FX.rings(new THREE.Vector3(at.x, .12, at.z), HOT, 5, { maxR: 20, life: .8, gap: 32 });
          FX.scorch(new THREE.Vector3(at.x, 0, at.z), 7, 34);
          FX.cracks(floor.clone(), 22, 28, 0x3a3f46);
          FX.mangaLines(1, .36);
          if (typeof hitstop === 'function') hitstop(.26);
          addShake(4.6);
          if (e) e.anchorT = 0;
          G.burn(e, { dir: d });
          for (var q = 0; q < pods.length; q++) {
            if (MU.scrap) MU.scrap(pods[q], pods[q].position.clone());
          }
          return false;
        }
        return true;
      } });
    } },

    /* R · the whole frame, up to speed, and then it is not a frame any
       more — it is every part of it going through one person at once */
    kr: { name: 'SCRAPPED', color: '#d8c24a', hold: 2.8, run: function (e, d, p, G) {
      var MU = window.JJMUTA;
      var WARN = (MU && MU.WARN) || 0xd8c24a, HOT = (MU && MU.HOT) || 0xff8a3d;
      var GUN = (MU && MU.GUN) || 0x4a5058;
      var floor = new THREE.Vector3(p.x, 0, p.z);
      var frame = (MU && MU.buildFrame) ? MU.buildFrame() : null;
      if (frame) {
        frame.position.copy(p);
        frame.rotation.y = Math.atan2(d.x, d.z);
        scene.add(frame);
        if (MU.assemble) MU.assemble(frame, 1);
      }
      FX.tint('#1a1408', .45, 1.4);
      FX.converge(p.clone(), WARN, 34, 15, .9);
      FX.zoom(-9, .8);
      FX.mangaLines(.4, .9);
      if (typeof hitstop === 'function') hitstop(.18);
      if (e && !e.dead) { e.anchorT = 2.4; e.anchorPos.copy(e.pos); e.stunT = Math.max(e.stunT || 0, 2.8); }

      var t = 0, spin = 0, tick = 0, torn = false;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined') return false;
        var at = (e && !e.dead ? e.pos.clone().add(up(2.6)) : p.clone().add(up(2.6)));
        /* it spins up, and it keeps spinning up */
        spin += dt * Math.min(30, t * 13);
        if (frame && !torn) {
          frame.rotation.y = Math.atan2(d.x, d.z) + spin;
          frame.position.copy(p).lerp(new THREE.Vector3(at.x, p.y, at.z), Math.min(1, (t - 1) * .8));
        }
        if (t > 1 && (tick -= dt) <= 0) {
          tick = .09;
          var a = Math.random() * TAU;
          if (MU && MU.sparks) {
            MU.sparks(p.clone().add(new THREE.Vector3(Math.cos(a) * 7, 1 + Math.random() * 6, Math.sin(a) * 7)), 3);
          }
          FX.mote(at.clone(), WARN, 1.6, .16);
          addShake(.6);
        }
        /* and then he lets go of all of it, in one direction */
        if (!torn && t > 2.3) {
          torn = true;
          FX.flash('#ffe9a8', .8, .34);
          FX.shockwave(at.clone(), 0xffffff, 2.4);
          for (var i = 0; i < 14; i++) {
            var a2 = i / 14 * TAU;
            var from = at.clone().add(new THREE.Vector3(Math.cos(a2) * 10, Math.sin(a2) * 6, Math.sin(a2) * 10));
            FX.cutLine(from, at.clone(), i % 2 ? WARN : GUN, 1.1, .24);
          }
          FX.impact(at.clone(), WARN, 8);
          FX.rings(new THREE.Vector3(at.x, .12, at.z), HOT, 6, { maxR: 26, life: .9, gap: 30 });
          FX.cracks(new THREE.Vector3(at.x, .1, at.z), 30, 36, 0x3a3f46);
          FX.debris(new THREE.Vector3(at.x, .1, at.z), 26, 30, 0x6a7078);
          FX.dust(new THREE.Vector3(at.x, 0, at.z), 22, 0x9aa0a8, 26, 8);
          FX.blood(at.clone(), d, 30, 3.2);
          FX.mangaLines(1.2, .4);
          if (typeof hitstop === 'function') hitstop(.3);
          addShake(5.4);
          if (e) e.anchorT = 0;
          G.dice(e, { dir: d, power: 3, cubes: 34 });
          if (frame && MU.scrap) MU.scrap(frame, at.clone());
        }
        return t < 2.9;
      } });
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
    } },

    /* =================================================================
       CHOSO — everything he does is a line with the pressure behind it,
       so none of these are a spray. They are a hole, a bore, a weight,
       a burst, a rise and a draw.
       ============================================================== */

    /* 1 · Piercing Blood, tapped — one shot, and it goes all the way
       through. The tell is what comes out of the far side. */
    c1: { name: 'PIERCED', color: '#d4143c', hold: .8, run: function (e, d, p, G) {
      var thr = p.clone().addScaledVector(d, 26);
      FX.bloodBeam(p.clone().addScaledVector(d, -4), d, 32, { radius: .55, life: .34 });
      FX.bloodCut(p.clone().addScaledVector(d, -6), thr, .5, .3);
      FX.bloodBurst(p.clone(), 2.2, d.clone());
      if (typeof hitstop === 'function') hitstop(.12);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        /* the jet out of the back of them, which is the whole picture */
        FX.blood(p.clone(), d.clone(), 12, 2.4);
        FX.bloodThreads(p.clone().addScaledVector(d, 4), 7, 22, 1.6);
        FX.tint('#40040f', .4, .22);
        G.sever(e, { dir: d, power: 1.5, cubes: 6, color: 0x8b0f2a });
        addShake(1.5);
      }, 420);
    } },

    /* 1h · the held stream — it does not stop, so neither does this.
       He bores through them and there is nothing to fall over. */
    c1s: { name: 'BORED THROUGH', color: '#d4143c', hold: 1.4, run: function (e, d, p, G) {
      var n = 0;
      var iv = setInterval(function () {
        if (n++ > 13 || typeof scene === 'undefined') { clearInterval(iv); return; }
        FX.bloodBeam(p.clone().addScaledVector(d, -7), d, 16,
          { radius: .36 + Math.random() * .12, life: .14 });
        FX.blood(p.clone(), d.clone(), 3, 1.1);
        FX.bloodMote(p.clone(), 1.2, .22);
        addShake(.3);
      }, 90);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.tint('#40040f', .5, .28);
        if (typeof hitstop === 'function') hitstop(.14);
        FX.bloodRings(p.clone(), 3, { maxR: 11, life: .5, gap: 40 });
        G.erase(e, { color: 0x4e0512 });
        addShake(1.8);
      }, 1300);
    } },

    /* 2 · Blood Meteorite — the mass comes down and they are under it */
    c2: { name: 'UNDER IT', color: '#8b0f2a', hold: 1, run: function (e, d, p, G) {
      var mass = FX.bloodMass(3.2);
      mass.position.copy(p).add(up(34));
      scene.add(mass);
      var t = 0;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        var k = Math.min(1, t / .62);
        mass.position.y = p.y + 34 * (1 - k * k);
        mass.rotation.x += dt * 5; mass.rotation.y += dt * 4;
        if (Math.random() < .6) FX.bloodMote(mass.position.clone(), 1.6, .3);
        if (k < 1) return true;
        scene.remove(mass);
        return false;
      } });
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.tint('#40040f', .55, .28);
        if (typeof hitstop === 'function') hitstop(.16);
        FX.bloodBurst(new THREE.Vector3(p.x, .4, p.z), 6, up(1));
        FX.cracks(new THREE.Vector3(p.x, .1, p.z), 14, 20, 0x1c0106, 0x5a3038);
        FX.blood(p.clone(), up(1), 16, 3);
        G.flatten(e, { color: 0x8b0f2a });
        addShake(2.6);
      }, 640);
    } },

    /* 3 · Supernova — a star goes in before it goes out. The orbs close
       on them, the light is pulled in, and then it is not. */
    c3: { name: 'SUPERNOVA', color: '#d4143c', hold: 1.3, run: function (e, d, p, G) {
      for (var i = 0; i < 18; i++) {
        (function (n) {
          var a = n * TAU / 18, ring = n % 3;
          var from = p.clone().add(new THREE.Vector3(
            Math.cos(a) * 11, (ring - 1) * 5, Math.sin(a) * 11));
          setTimeout(function () {
            if (typeof scene === 'undefined') return;
            FX.bloodThreads(from, 2, 16, .9);
            FX.bloodMote(from.clone(), 1.4, .5);
          }, n * 34);
        })(i);
      }
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        /* held small and dark for a beat — that is what sells the burst */
        FX.tint('#0e0104', .8, .2);
        FX.bloodBurst(p.clone(), 2, up(1));
        if (typeof hitstop === 'function') hitstop(.2);
      }, 800);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.bloodRings(p.clone(), 6, { maxR: 34, life: .9, gap: 44 });
        FX.bloodThreads(p.clone(), 16, 30, 1.6);
        FX.debris(new THREE.Vector3(p.x, .2, p.z), 20, 22, 0x1c0106);
        G.dice(e, { dir: d, power: 1.9, cubes: 26, color: 0x8b0f2a });
        addShake(3);
      }, 1000);
    } },

    /* 4 · Flowing Red Scale — the pressure is raised, and it is raised
       inside them. Nothing hits them; they go from the inside out. */
    c4: { name: 'BURST', color: '#ff2a4a', hold: 1.1, run: function (e, d, p, G) {
      var n = 0;
      var iv = setInterval(function () {
        if (n++ > 8 || typeof scene === 'undefined') { clearInterval(iv); return; }
        /* the swell: rings tight on the body, getting faster */
        FX.bloodRings(p.clone(), 1, { maxR: 2 + n * .5, life: .22 });
        FX.bloodMote(p.clone(), 1 + n * .18, .2);
        addShake(.2 + n * .12);
      }, 95);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.tint('#48060f', .6, .32);
        if (typeof hitstop === 'function') hitstop(.15);
        for (var i = 0; i < 10; i++) {
          var a = Math.random() * TAU, e2 = Math.random() * Math.PI - Math.PI / 2;
          FX.blood(p.clone(), new THREE.Vector3(
            Math.cos(a) * Math.cos(e2), Math.sin(e2), Math.sin(a) * Math.cos(e2)), 5, 2);
        }
        G.sever(e, { dir: d, power: 2.1, cubes: 14, color: 0x8b0f2a, spread: 1 });
        addShake(2.2);
      }, 900);
    } },

    /* R · Blood Edge — one draw, low and level, and the top of them is
       still standing on it for a moment afterwards */
    cr: { name: 'OPENED', color: '#d4143c', hold: .9, run: function (e, d, p, G) {
      var side = new THREE.Vector3(-d.z, 0, d.x);
      FX.bloodCut(p.clone().addScaledVector(side, -5), p.clone().addScaledVector(side, 5),
        1.2, .34);
      if (typeof hitstop === 'function') hitstop(.13);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.blood(p.clone(), side.clone(), 9, 2);
        FX.blood(p.clone(), side.clone().negate(), 9, 2);
        FX.tint('#40040f', .45, .24);
        /* level, and it stands there a beat longer than the others do */
        G.halve(e, { dir: d, power: 1.1, tilt: 0, color: 0x8b0f2a, stand: .5 });
        addShake(1.4);
      }, 400);
    } },

    /* ============ CHOSO, WITH THE CURSE HALF OUT ============
       The four he only has while the mark is open. Same rule: each ends
       in the way that particular technique ends people. */

    /* 1 · Convergence — it is already through them before the sound is */
    ca1: { name: 'BEFORE THE SOUND', color: '#c8203c', hold: .8, run: function (e, d, p, G) {
      FX.bloodBeam(p.clone().addScaledVector(d, -9), d, 60, { radius: 1.1, life: .32 });
      FX.bloodCut(p.clone().addScaledVector(d, -9), p.clone().addScaledVector(d, 50), .9, .28);
      FX.bloodBurst(p.clone(), 2.4, d.clone());
      if (typeof hitstop === 'function') hitstop(.14);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        /* the hole opens after the shot, not with it */
        FX.blood(p.clone(), d.clone(), 14, 2.6);
        FX.bloodThreads(p.clone().addScaledVector(d, 5), 10, 26, 1.8);
        FX.tint('#40040f', .45, .24);
        G.sever(e, { dir: d, power: 2.2, cubes: 8 });
        addShake(1.8);
      }, 380);
    } },

    /* 2 · the bombardment — the last one is the one that stays on top */
    ca2: { name: 'BURIED', color: '#8b0f2a', hold: 1.25, run: function (e, d, p, G) {
      var n = 0;
      var iv = setInterval(function () {
        if (n++ > 4 || typeof scene === 'undefined') { clearInterval(iv); return; }
        var q = p.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 5, 0, (Math.random() - .5) * 5));
        FX.bloodBurst(new THREE.Vector3(q.x, .5, q.z), 3.4, up(1));
        FX.debris(new THREE.Vector3(q.x, .1, q.z), 9, 15, 0x1c0106);
        addShake(.7);
      }, 150);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        var mass = FX.bloodMass(3.6);
        mass.position.copy(p).add(up(30));
        scene.add(mass);
        var t = 0;
        addFx({ t: 1e9, update: function (dt) {
          t += dt;
          var k = Math.min(1, t / .45);
          mass.position.y = p.y + 30 * (1 - k * k);
          mass.rotation.x += dt * 6;
          if (k < 1) return true;
          scene.remove(mass);
          FX.tint('#40040f', .6, .3);
          if (typeof hitstop === 'function') hitstop(.17);
          FX.bloodBurst(new THREE.Vector3(p.x, .4, p.z), 7, up(1));
          FX.cracks(new THREE.Vector3(p.x, .1, p.z), 15, 22, 0x1c0106, 0x5a3038);
          G.flatten(e, { color: 0x8b0f2a, crater: 11 });
          addShake(2.8);
          return false;
        } });
      }, 780);
    } },

    /* 3 · the saw — it does not stop, so it goes all the way across */
    ca3: { name: 'SAWN IN HALF', color: '#c8203c', hold: 1, run: function (e, d, p, G) {
      var side = new THREE.Vector3(-d.z, 0, d.x);
      var from = p.clone().addScaledVector(side, -8);
      var to = p.clone().addScaledVector(side, 8);
      /* the blade coming across, drawn as it goes rather than all at once */
      var n = 0;
      var iv = setInterval(function () {
        if (n++ > 9 || typeof scene === 'undefined') { clearInterval(iv); return; }
        var k = n / 9;
        var here = from.clone().lerp(to, k);
        FX.bloodBurst(here, 1.6, side.clone());
        FX.bloodThreads(here, 3, 14, .8);
        FX.bloodCut(from.clone(), here, .8, .2);
        addShake(.35);
      }, 55);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.bloodCut(from.clone(), to.clone(), 1.4, .34);
        FX.tint('#40040f', .5, .26);
        if (typeof hitstop === 'function') hitstop(.16);
        FX.blood(p.clone(), side.clone(), 11, 2.2);
        FX.blood(p.clone(), side.clone().negate(), 11, 2.2);
        /* level, and the top of them goes with the blade */
        G.halve(e, { dir: side, power: 1.6, tilt: 0, color: 0x8b0f2a, stand: .3 });
        addShake(2);
      }, 620);
    } },

    /* 4 · the pillar — they are already on top of it, and it goes */
    ca4: { name: 'TAKEN WITH IT', color: '#8b0f2a', hold: 1.35, run: function (e, d, p, G) {
      /* the stone under them webs over first */
      var n = 0;
      var iv = setInterval(function () {
        if (n++ > 11 || typeof scene === 'undefined') { clearInterval(iv); return; }
        var a2 = Math.random() * TAU;
        var at = p.clone().add(new THREE.Vector3(
          Math.cos(a2) * 2.6, -2 - Math.random() * 4, Math.sin(a2) * 2.6));
        FX.bloodCut(at, at.clone().add(up(3 + Math.random() * 4)), .45, .5);
        FX.bloodMote(at, 1.3, .5);
        if (n % 3 === 0) addShake(.3);
      }, 80);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.tint('#40040f', .6, .34);
        if (typeof hitstop === 'function') hitstop(.18);
        FX.bloodBurst(p.clone(), 7, up(1));
        FX.bloodThreads(p.clone(), 24, 32, 1.7);
        FX.bloodRings(p.clone(), 5, { maxR: 26, life: .85, gap: 40 });
        FX.debris(new THREE.Vector3(p.x, p.y - 3, p.z), 22, 24, 0x4a4f5c);
        FX.dust(new THREE.Vector3(p.x, 1, p.z), 12, 0xb9bfc9, 14, 5);
        /* the column goes and they go with it */
        G.sever(e, { dir: up(1), power: 2.2, cubes: 14 });
        addShake(3);
      }, 1180);
    } }
  };

  /* what each one leaves behind, for the kill that lands at the end */
  var STYLE = {
    red: 'sever', rapid: 'flat', tf: 'ragdoll', palm: 'flat', lim: 'gone',
    aw_blue: 'gone', aw_red: 'dice', aw_purple: 'gone', aw_domain: 'ragdoll',
    n1: 'dice', n2: 'sever', n3: 'ragdoll', n4: 'gone', nr: 'sever', nrf: 'sever',
    y1: 'sever', y2: 'dice', y3: 'sever', y4: 'flat', yr: 'burn',
    h1: 'sever', h2: 'dice', h3: 'flat', h4: 'ragdoll', hr: 'sever', hdom: 'burn',
    ha1: 'ragdoll', ha1j: 'dice', ha2: 'sever', ha3: 'dice', ha4: 'ragdoll',
    s1: 'dice', s2: 'sever', s3: 'burn', s4: 'dice',
    c1: 'sever', c1s: 'gone', c2: 'flat', c3: 'dice', c4: 'sever', cr: 'sever',
    ca1: 'sever', ca2: 'flat', ca3: 'sever', ca4: 'sever',
    mg1: 'dice', mg2: 'burn', mg3: 'gone', mg4: 'flat', mgr: 'gone',
    ga1: 'dice', ga2: 'dice', ga3: 'sever', gv1: 'dice', gv2: 'gone', gdom: 'gone',
    t1: 'gone', t2: 'gone', t3: 'sever', t4: 'gone', tr: 'sever',
    b1: 'flat', b2: 'dice', b3: 'sever', b4: 'flat', br: 'dice',
    j1: 'sever', j2: 'flat', j3: 'dice', j4: 'gone', jr: 'dice',
    o1: 'sever', o2: 'sever', o3: 'sever', o4: 'dice', or: 'gone',
    k1: 'sever', k2: 'flat', k3: 'gone', k4: 'burn', kr: 'dice'
  };

  /* =====================================================================
     WHAT MEGUMI IS DOING WHILE IT HAPPENS
     He never touches anybody: the shikigami do it and he stands there
     and calls them. So his four awakened finishers pose him in three
     beats each — the call, the hold, and the hand that closes it — and
     the poses go in the shared table by name so every other screen can
     play them off nothing but the name and the clock.
     ================================================================== */
  (function registerPoses() {
    var FV = window.JJFEVER;
    if (!FV || !FV.finPose) return;

    function sign(r, k) {                     // both hands together, in front
      r.shoulderL.rotation.x = -1.1 * k; r.shoulderR.rotation.x = -1.1 * k;
      r.shoulderL.rotation.z = .5 * k; r.shoulderR.rotation.z = -.5 * k;
      r.elbowL.rotation.x = -1.5 * k; r.elbowR.rotation.x = -1.5 * k;
    }
    function stance(r, k) {                   // weight down, feet apart
      r.hipL.rotation.x = -.16 * k; r.hipR.rotation.x = .1 * k;
      r.kneeL.rotation.x = .3 * k; r.kneeR.rotation.x = .22 * k;
      r.hips.position.y = r.hipsBaseY - .22 * k;
    }

    /* 1 · point it at them, close the sign, drive it into the floor */
    FV.finPose.mgaOne = function (r, a, out) {
      var t = a.t, k;
      stance(r, 1);
      if (t < .85) {                          // the arm out, following the run
        k = out(Math.min(1, t / .3));
        r.shoulderR.rotation.x = -1.55 * k;
        r.shoulderR.rotation.z = -.2 * k + Math.sin(t * 3) * .25 * k;
        r.elbowR.rotation.x = -.14;
        r.shoulderL.rotation.x = -.2 * k;
        r.spine.rotation.y = -.2 * k;
        r.neck.rotation.y = .2 * k;
      } else if (t < 1.75) {                  // the sign
        k = out(Math.min(1, (t - .85) / .28));
        sign(r, k);
        r.shoulderR.rotation.x = -1.55 + .45 * k;
        r.spine.rotation.x = .12 * k;
        r.spine.rotation.y = -.2 + .2 * k;
        r.neck.rotation.x = .12 * k;
      } else {                                // and both hands down, hard
        k = out(Math.min(1, (t - 1.75) / .22));
        sign(r, 1 - k);
        r.shoulderL.rotation.x = -1.1 + 2.0 * k;
        r.shoulderR.rotation.x = -1.1 + 2.0 * k;
        r.shoulderL.rotation.z = .5 - .34 * k;
        r.shoulderR.rotation.z = -.5 + .34 * k;
        r.elbowL.rotation.x = -1.5 + 1.4 * k;
        r.elbowR.rotation.x = -1.5 + 1.4 * k;
        r.spine.rotation.x = .12 + .38 * k;
        r.neck.rotation.x = .12 + .3 * k;
        r.hips.position.y = r.hipsBaseY - .22 - .3 * k;
        r.kneeL.rotation.x = .3 + .5 * k; r.kneeR.rotation.x = .22 + .5 * k;
      }
    };

    /* 2 · a hand across to call it, the same hand up as it lifts them,
       and then both arms opened wide, which is the pull */
    FV.finPose.mgaTwo = function (r, a, out) {
      var t = a.t, k;
      stance(r, 1);
      if (t < .9) {                           // the sweep
        k = out(Math.min(1, t / .26));
        r.shoulderR.rotation.x = -1.5 * k;
        r.shoulderR.rotation.z = -1.2 + 1.05 * k;
        r.elbowR.rotation.x = -.3 * k;
        r.shoulderL.rotation.x = -.3 * k;
        r.spine.rotation.y = .35 - .5 * k;
        r.neck.rotation.y = -.1 * k;
      } else if (t < 1.85) {                  // and it goes up, and so does he
        k = out(Math.min(1, (t - .9) / .34));
        r.shoulderR.rotation.x = -1.5 - 1.2 * k;
        r.shoulderR.rotation.z = -.15;
        r.shoulderL.rotation.x = -.3 - 2.0 * k;
        r.elbowR.rotation.x = -.3 + .3 * k;
        r.spine.rotation.x = -.16 * k;
        r.neck.rotation.x = -.42 * k;
        r.hips.position.y = r.hipsBaseY - .22 + .18 * k;
      } else {                                // both arms opened, and held
        k = out(Math.min(1, (t - 1.85) / .2));
        r.shoulderL.rotation.x = -2.3 + .9 * k;
        r.shoulderR.rotation.x = -2.7 + 1.3 * k;
        r.shoulderL.rotation.z = 1.35 * k;
        r.shoulderR.rotation.z = -1.35 * k;
        r.elbowL.rotation.x = -.1; r.elbowR.rotation.x = -.1;
        r.spine.rotation.x = -.16 - .1 * k;
        r.neck.rotation.x = -.42 + .2 * k;
      }
    };

    /* 3 · the toad: a hand out for the tongue, drawn back while it reels
       them in, and closed when the mouth does */
    FV.finPose.mgaThree = function (r, a, out) {
      var t = a.t, k;
      stance(r, 1);
      if (t < .95) {                          // the hand out
        k = out(Math.min(1, t / .26));
        r.shoulderR.rotation.x = -1.62 * k;
        r.shoulderR.rotation.z = -.28 * k;
        r.elbowR.rotation.x = -.16 * k;
        r.shoulderL.rotation.x = -.6 * k;
        r.elbowL.rotation.x = -1.4 * k;
        r.spine.rotation.x = -.18 * k;
        r.neck.rotation.x = -.3 * k;
      } else if (t < 2.0) {                   // drawn back, in time with it
        k = out(Math.min(1, (t - .95) / .4));
        var pull = Math.sin((t - .95) * 7) * .12;
        r.shoulderR.rotation.x = -1.62 + .5 * k + pull;
        r.shoulderR.rotation.z = -.28 + .5 * k;
        r.elbowR.rotation.x = -.16 - 1.5 * k;
        r.shoulderL.rotation.x = -.6 - .2 * k;
        r.elbowL.rotation.x = -1.4;
        r.spine.rotation.x = -.18 + .3 * k;
        r.neck.rotation.x = -.3 + .1 * k;
        r.hips.position.y = r.hipsBaseY - .22 - .2 * k;
      } else {                                // and the fist shuts
        k = out(Math.min(1, (t - 2.0) / .2));
        r.shoulderR.rotation.x = -1.12 - .5 * k;
        r.shoulderR.rotation.z = .22 - .4 * k;
        r.elbowR.rotation.x = -1.66 + .3 * k;
        r.shoulderL.rotation.x = -.8 - .4 * k;
        r.elbowL.rotation.x = -1.4 - .3 * k;
        r.spine.rotation.x = .12 - .3 * k;
        r.neck.rotation.x = -.2 - .2 * k;
        r.hips.position.y = r.hipsBaseY - .42 - .12 * k;
      }
    };

    /* 1+2 · the merge, thrown away from him and followed through */
    FV.finPose.mgaVone = function (r, a, out) {
      var t = a.t, k;
      stance(r, 1);
      if (t < 1.0) {                          // both hands brought together
        k = out(Math.min(1, t / .3));
        sign(r, k);
        r.spine.rotation.x = .16 * k;
        r.neck.rotation.x = -.12 * k;
        r.hips.position.y = r.hipsBaseY - .22 - .2 * k;
      } else if (t < 1.95) {                  // and sent, arm following it
        k = out(Math.min(1, (t - 1.0) / .22));
        r.shoulderL.rotation.x = -1.1 - .6 * k;
        r.shoulderR.rotation.x = -1.1 - 1.1 * k;
        r.shoulderL.rotation.z = .5 - 1.0 * k;
        r.shoulderR.rotation.z = -.5 + .9 * k;
        r.elbowL.rotation.x = -1.5 + 1.3 * k;
        r.elbowR.rotation.x = -1.5 + 1.4 * k;
        r.spine.rotation.x = .16 - .56 * k;
        r.neck.rotation.x = -.12 - .28 * k;
        r.hips.position.y = r.hipsBaseY - .42 + .3 * k;
      } else {                                // held, watching it come back
        k = out(Math.min(1, (t - 1.95) / .3));
        r.shoulderL.rotation.x = -1.7 + .9 * k;
        r.shoulderR.rotation.x = -2.2 + 1.3 * k;
        r.shoulderL.rotation.z = -.5 + .8 * k;
        r.shoulderR.rotation.z = .4 - .7 * k;
        r.elbowL.rotation.x = -.2 - .5 * k;
        r.elbowR.rotation.x = -.1 - .6 * k;
        r.spine.rotation.x = -.4 + .34 * k;
        r.neck.rotation.x = -.4 + .24 * k;
        r.hips.position.y = r.hipsBaseY - .12 - .24 * k;
      }
    };

    /* 2+3 · the mouth: opened wide, held open, and shut */
    FV.finPose.mgaVtwo = function (r, a, out) {
      var t = a.t, k;
      stance(r, 1);
      if (t < 1.05) {                         // both arms opened
        k = out(Math.min(1, t / .32));
        r.shoulderL.rotation.x = -1.6 * k; r.shoulderR.rotation.x = -1.6 * k;
        r.shoulderL.rotation.z = 1.4 * k; r.shoulderR.rotation.z = -1.4 * k;
        r.elbowL.rotation.x = -.12; r.elbowR.rotation.x = -.12;
        r.spine.rotation.x = -.24 * k;
        r.neck.rotation.x = -.42 * k;
      } else if (t < 2.0) {                   // and held there, shaking
        var shake = Math.sin((t - 1.05) * 16) * .05;
        r.shoulderL.rotation.x = -1.6 + shake; r.shoulderR.rotation.x = -1.6 - shake;
        r.shoulderL.rotation.z = 1.4 + shake; r.shoulderR.rotation.z = -1.4 - shake;
        r.elbowL.rotation.x = -.12; r.elbowR.rotation.x = -.12;
        r.spine.rotation.x = -.24;
        r.neck.rotation.x = -.42;
      } else {                                // shut, both hands at once
        k = out(Math.min(1, (t - 2.0) / .2));
        r.shoulderL.rotation.x = -1.6 + 1.15 * k;
        r.shoulderR.rotation.x = -1.6 + 1.15 * k;
        r.shoulderL.rotation.z = 1.4 - 1.3 * k;
        r.shoulderR.rotation.z = -1.4 + 1.3 * k;
        r.elbowL.rotation.x = -.12 - 1.4 * k;
        r.elbowR.rotation.x = -.12 - 1.4 * k;
        r.spine.rotation.x = -.24 + .56 * k;
        r.neck.rotation.x = -.42 + .56 * k;
        r.hips.position.y = r.hipsBaseY - .22 - .34 * k;
        r.kneeL.rotation.x = .3 + .5 * k; r.kneeR.rotation.x = .22 + .5 * k;
      }
    };

    /* 4 · both arms out over the whole floor, dropped while it runs, and
       one hand closed at the end of it */
    FV.finPose.mgaFour = function (r, a, out) {
      var t = a.t, k;
      stance(r, 1);
      if (t < 1.0) {                          // the floor opened
        k = out(Math.min(1, t / .34));
        r.shoulderL.rotation.x = -1.5 * k; r.shoulderR.rotation.x = -1.5 * k;
        r.shoulderL.rotation.z = 1.4 * k; r.shoulderR.rotation.z = -1.4 * k;
        r.elbowL.rotation.x = -.12; r.elbowR.rotation.x = -.12;
        r.spine.rotation.x = -.14 * k;
        r.neck.rotation.x = -.2 * k;
      } else if (t < 2.1) {                   // he lets it happen
        k = out(Math.min(1, (t - 1.0) / .34));
        r.shoulderL.rotation.x = -1.5 + 1.25 * k;
        r.shoulderR.rotation.x = -1.5 + 1.25 * k;
        r.shoulderL.rotation.z = 1.4 - 1.15 * k;
        r.shoulderR.rotation.z = -1.4 + 1.15 * k;
        r.elbowL.rotation.x = -.12 - .3 * k; r.elbowR.rotation.x = -.12 - .3 * k;
        r.spine.rotation.x = -.14 + .1 * k;
        r.spine.rotation.y = Math.sin(t * 2.2) * .07;
        r.neck.rotation.x = -.2 + .1 * k;
      } else {                                // and closes his hand
        k = out(Math.min(1, (t - 2.1) / .26));
        r.shoulderR.rotation.x = -.25 - 2.3 * k + 3.1 * k * Math.max(0, (t - 2.44) / .3);
        r.shoulderR.rotation.z = -.25 + .1 * k;
        r.elbowR.rotation.x = -.42 - .9 * k;
        r.shoulderL.rotation.x = -.25 - .3 * k;
        r.spine.rotation.x = -.04 - .12 * k;
        r.neck.rotation.x = -.1 - .28 * k;
        r.hips.position.y = r.hipsBaseY - .22 - .18 * k;
      }
    };
  })();

  /* =====================================================================
     WHICH SKILL DID IT
     The action the player is in the middle of, which for a punch is
     nothing at all — so a punch can never be a finisher.
     ================================================================== */
  /* hafin is the action a finisher takes over the caster with — it is a
     finisher playing, never a skill that could arm another one */
  var NOT_A_SKILL = { m1: 1, kb: 1, void: 1, nrush: 1, yaw: 1, awaken: 1, hafin: 1 };
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
    /* the caster is somebody else and arrives in their own packets — this
       screen draws the effects and nothing else */
    F.remote = true;
    try { cut.run(ent, d, p, onMe ? NO_KIT : realKit()); } catch (err) {}
    F.remote = false;
  };

  /* the effect list, for anything that wants to know what a skill does */
  FIN.styleOf = function (skill) { return STYLE[skill] || 'ragdoll'; };
  FIN.nameOf = function (skill) { return CUT[skill] ? CUT[skill].name : null; };
})();
