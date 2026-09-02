/* =======================================================================
   COMING APART
   Three ways to stop being alive, and one rule that has to hold while a
   finisher is running.

   Dying limp is the default and it stays: ragdoll.js does that. But a
   body cut by Dismantle does not flop — it falls into the pieces it was
   cut into, and they stay on the ground. A body the Divine Flame caught
   does not flop either — it burns down to a husk, and that stays too.

   The separation is real. The rig is not scaled to nothing and swapped
   for a puff: every mesh in it is copied into the piece it belongs to,
   each piece is given the world transform its joint had at the moment of
   the cut, and from there the pieces are ten independent bodies with
   their own momentum. The head lands where the head was thrown. The cut
   faces are real geometry, so a piece looked at from the wrong end is
   open.

     sever(ent)   ten pieces, the cut faces, and the blood
     dice(ent)    the same, plus the cubes Dismantle actually leaves
     burn(ent)    a husk, charred where it stood

   And the lock: an entity in JJGORE.hold() cannot be taken below one
   health and cannot die, however hard it is hit. A finisher holds both
   fighters for as long as it runs, which is why the last punch of one
   can be thrown at somebody who was already on two health.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX) return;

  var TAU = Math.PI * 2;
  var G = 34;
  var MEAT = 0x7c0e1e, MEAT_D = 0x3d0510, CHAR = 0x14100f;

  var GORE = window.JJGORE = {};

  /* =====================================================================
     THE HEALTH LOCK
     Held entities take damage on the bar and then stop at one. Nothing
     else in the game has to know: every path that hurts anybody goes
     through one of these four.
     ================================================================== */
  var held = [];
  function isHeld(ent) { return held.indexOf(ent) >= 0; }
  GORE.hold = function (ent) { if (ent && !isHeld(ent)) held.push(ent); };
  GORE.release = function (ent) {
    var i = held.indexOf(ent);
    if (i >= 0) held.splice(i, 1);
  };
  GORE.isHeld = isHeld;

  /* how much of a hit is allowed to land on somebody being held */
  function clamp(ent, hp, amount) {
    if (!isHeld(ent)) return amount;
    return Math.max(0, Math.min(amount, hp - 1));
  }

  var _hurtPlayer = hurtPlayer;
  hurtPlayer = function (amount, knock) {
    if (isHeld(player)) {
      amount = clamp(player, player.hp, amount);
      if (amount <= 0) {
        /* the knock still arrives — being held is not being invulnerable */
        if (knock && player.frameT <= 0 && player.iframes <= 0) player.vel.add(knock);
        return;
      }
    }
    return _hurtPlayer(amount, knock);
  };

  var _enemyDamage = Enemy.prototype.damage;
  Enemy.prototype.damage = function (amount, knock, opts) {
    if (opts && opts.death) mark(this, opts.death);
    if (isHeld(this)) amount = clamp(this, this.hp, amount);
    return _enemyDamage.call(this, amount, knock, opts);
  };

  var _enemyDirect = Enemy.prototype.directDamage;
  Enemy.prototype.directDamage = function (n, color, canKill) {
    if (isHeld(this)) { n = clamp(this, this.hp, n); if (n <= 0) return; }
    return _enemyDirect.call(this, n, color, canKill);
  };

  /* =====================================================================
     WHAT KILLED THEM
     An attack says how the body should go, and the answer only counts for
     a few seconds — a body punched down four seconds after a fire hit is
     not on fire.
     ================================================================== */
  function now() { return (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000; }
  function mark(ent, style) { if (ent) ent.__death = { s: style, t: now() }; }
  function styleOf(ent) {
    var d = ent && ent.__death;
    if (!d || now() - d.t > 3) return null;
    return d.s;
  }
  GORE.mark = mark;

  /* =====================================================================
     THE PIECES
     Every piece is the meshes of one joint, copied into a group that
     starts life with that joint's world transform. Copied rather than
     moved, because the rig is respawned in a few seconds and has to be
     whole when it is.
     ================================================================== */
  var PARTS = [
    /* node        stop at                        cut width, depth, where */
    { n: 'neck', stop: [], w: .5, d: .5, up: 0, m: 1.0, name: 'head' },
    { n: 'spine', stop: ['neck', 'shoulderL', 'shoulderR'], w: 1.3, d: .66, up: 1.1, m: 2.4 },
    { n: 'hips', stop: ['spine', 'hipL', 'hipR'], w: 1.1, d: .62, up: .76, m: 2.0 },
    { n: 'shoulderL', stop: ['elbowL'], w: .5, d: .5, up: 0, m: .8 },
    { n: 'shoulderR', stop: ['elbowR'], w: .5, d: .5, up: 0, m: .8 },
    { n: 'elbowL', stop: [], w: .38, d: .38, up: 0, m: .6 },
    { n: 'elbowR', stop: [], w: .38, d: .38, up: 0, m: .6 },
    { n: 'hipL', stop: ['kneeL'], w: .62, d: .6, up: 0, m: 1.3 },
    { n: 'hipR', stop: ['kneeR'], w: .62, d: .6, up: 0, m: 1.3 },
    { n: 'kneeL', stop: [], w: .5, d: .48, up: 0, m: 1.0 },
    { n: 'kneeR', stop: [], w: .5, d: .48, up: 0, m: 1.0 }
  ];

  var pieces = [];               // every loose piece on the field
  var _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  var _inv = new THREE.Matrix4(), _rel = new THREE.Matrix4();

  /* copy the meshes belonging to one joint into a world space group */
  function carve(rig, part) {
    var node = rig[part.n];
    if (!node) return null;
    var stops = [];
    part.stop.forEach(function (s) { if (rig[s]) stops.push(rig[s]); });

    var g = new THREE.Group();
    node.updateMatrixWorld(true);
    node.matrixWorld.decompose(_v, _q, _s);
    g.position.copy(_v);
    g.quaternion.copy(_q);
    _inv.copy(node.matrixWorld).invert();

    var found = 0;
    (function walk(o) {
      for (var i = 0; i < o.children.length; i++) {
        var c = o.children[i];
        if (stops.indexOf(c) >= 0) continue;
        if (c.isSprite) continue;                     // the health bar is not a body part
        if (c.isMesh && c.visible) {
          var m = new THREE.Mesh(c.geometry, c.material.clone());
          _rel.multiplyMatrices(_inv, c.matrixWorld);
          _rel.decompose(m.position, m.quaternion, m.scale);
          m.castShadow = true;
          g.add(m);
          found++;
        }
        walk(c);
      }
    })(node);
    if (!found) return null;

    /* the cut face: what you see when you look into the piece */
    var cap = new THREE.Mesh(new THREE.BoxGeometry(part.w, .1, part.d),
      new THREE.MeshStandardMaterial({ color: MEAT, roughness: .55 }));
    cap.position.y = part.up;
    g.add(cap);
    var bone = new THREE.Mesh(new THREE.BoxGeometry(part.w * .3, .14, part.d * .3),
      new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: .8 }));
    bone.position.y = part.up + .03;
    g.add(bone);
    g.__cut = new THREE.Vector3(0, part.up, 0);
    return g;
  }

  /* one loose body part, from the cut to wherever it stops */
  function drop(ent, g, vel, spin, mass) {
    g.__rest = false;
    scene.add(g);
    pieces.push({
      ent: ent, g: g, vel: vel, av: spin, m: mass || 1,
      rest: 0, down: false, t: 0, bleed: .5
    });
  }

  function stepPieces(dt) {
    for (var i = pieces.length - 1; i >= 0; i--) {
      var p = pieces[i], g = p.g;
      p.t += dt;
      if (!p.down) {
        p.vel.y -= G * dt;
        g.position.addScaledVector(p.vel, dt);
        g.rotation.x += p.av.x * dt;
        g.rotation.y += p.av.y * dt;
        g.rotation.z += p.av.z * dt;
        if (typeof collideWorld === 'function') collideWorld(g.position, .6);
        /* it bleeds while it is still in the air */
        p.bleed -= dt;
        if (p.bleed <= 0 && p.t < 1.4) {
          p.bleed = .07 + Math.random() * .1;
          FX.blood(g.position.clone().add(g.__cut ? g.__cut.clone().multiplyScalar(.5) : new THREE.Vector3()),
            new THREE.Vector3(0, -.4, 0), 1, .8);
        }
        var floor = .34 + p.m * .06;
        if (g.position.y <= floor) {
          g.position.y = floor;
          var hit = -p.vel.y;
          if (hit > 5) {                              // one wet bounce, and no more
            p.vel.y = hit * .17;
            p.vel.x *= .5; p.vel.z *= .5;
            p.av.multiplyScalar(.4);
            FX.blood(g.position.clone(), new THREE.Vector3(0, 1, 0), 3, 1);
            FX.dust(new THREE.Vector3(g.position.x, 0, g.position.z), 2, 0xb9a9a2, 3, 1.6);
          } else {
            p.vel.set(0, 0, 0);
            p.down = true;
            /* it settles onto whichever face it landed on */
            p.lie = {
              x: Math.round(g.rotation.x / (Math.PI / 2)) * (Math.PI / 2),
              z: Math.round(g.rotation.z / (Math.PI / 2)) * (Math.PI / 2)
            };
            FX.decal(FX.T.blood, new THREE.Vector3(g.position.x, 0, g.position.z),
              .8 + Math.random() * 1.1, 0x6d0616, .9, 40);
          }
        }
      } else {
        p.rest += dt;
        g.rotation.x += (p.lie.x - g.rotation.x) * Math.min(1, dt * 5);
        g.rotation.z += (p.lie.z - g.rotation.z) * Math.min(1, dt * 5);
      }
      /* pieces do not tidy themselves away: they are cleared when whoever
         they came off respawns */
      if (p.gone) {
        p.fade = (p.fade || 0) + dt;
        g.traverse(function (o) {
          if (!o.isMesh) return;
          o.material.transparent = true;
          o.material.opacity = Math.max(0, 1 - p.fade / .6);
        });
        if (p.fade > .6) {
          scene.remove(g);
          g.traverse(function (o) { if (o.isMesh && o.material) o.material.dispose(); });
          pieces.splice(i, 1);
        }
      }
    }
  }

  /* everything that came off one body, taken away again */
  function clearPieces(ent) {
    for (var i = 0; i < pieces.length; i++) if (pieces[i].ent === ent) pieces[i].gone = true;
    if (ent.__husk) { ent.__husk.gone = true; }
    ent.__goreHide = false;
    ent.__gored = false;
    if (ent.rig && ent.rig.root) ent.rig.root.visible = true;
  }
  GORE.clear = clearPieces;

  /* =====================================================================
     SEVERED
     ================================================================== */
  function sever(ent, opts) {
    opts = opts || {};
    if (!ent || !ent.rig || ent.__gored) return;
    ent.__gored = true;
    var rig = ent.rig;
    rig.root.updateMatrixWorld(true);

    var dir = (opts.dir || new THREE.Vector3(0, 0, 1)).clone().setY(0);
    if (dir.lengthSq() < .01) dir.set(0, 0, 1);
    dir.normalize();
    var power = opts.power == null ? 1 : opts.power;
    var centre = ent.pos.clone().add(new THREE.Vector3(0, 2.6, 0));

    PARTS.forEach(function (part, i) {
      var g = carve(rig, part);
      if (!g) return;
      /* every piece is thrown away from the middle of them, along the cut,
         and the further from the middle the harder it goes */
      var away = g.position.clone().sub(centre);
      if (away.lengthSq() < .01) away.set((Math.random() - .5), .4, (Math.random() - .5));
      away.normalize();
      var v = away.multiplyScalar((3 + Math.random() * 7) * power)
        .addScaledVector(dir, (2 + Math.random() * 6) * power);
      v.y += 3 + Math.random() * 7 * power;
      drop(ent, g, v, new THREE.Vector3(
        (Math.random() - .5) * 12, (Math.random() - .5) * 12, (Math.random() - .5) * 12), part.m);
      /* the cut itself, drawn where the piece came away */
      if (i % 2 === 0) {
        FX.blood(g.position.clone(), dir.clone().setY(.5), 5, 1.3);
      }
    });

    /* Dismantle does not cut a body into limbs, it cuts it into cubes.
       This is that, and it is why a body caught by the lattice leaves a
       heap rather than a shape. */
    if (opts.cubes) {
      var skin = 0xf6cba4;
      for (var c = 0; c < (opts.cubes === true ? 16 : opts.cubes); c++) {
        var s = .3 + Math.random() * .45;
        var m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s),
          new THREE.MeshStandardMaterial({
            color: Math.random() < .5 ? MEAT : (Math.random() < .5 ? MEAT_D : skin), roughness: .7
          }));
        var gg = new THREE.Group();
        gg.add(m);
        gg.position.copy(centre).add(new THREE.Vector3(
          (Math.random() - .5) * 1.6, (Math.random() - .5) * 3.4, (Math.random() - .5) * 1.6));
        drop(ent, gg, new THREE.Vector3(
          (Math.random() - .5) * 16 * power, 4 + Math.random() * 12 * power, (Math.random() - .5) * 16 * power),
          new THREE.Vector3((Math.random() - .5) * 16, (Math.random() - .5) * 16, (Math.random() - .5) * 16), .4);
      }
    }

    hideBody(ent);
    FX.blood(centre.clone(), dir.clone().setY(.3), 16, 1.7);
    FX.impact(centre.clone(), 0xff2a4a, 2.2);
    FX.decal(FX.T.blood, new THREE.Vector3(ent.pos.x, 0, ent.pos.z), 3.4, 0x54040f, .95, 40);
    FX.cracks(new THREE.Vector3(ent.pos.x, 0, ent.pos.z), 5, 5, 0x2a0a10);
    try { sfx.sever(); } catch (e) {}
    addShake(.9);
    if (typeof hitstop === 'function') hitstop(.09);
  }
  GORE.sever = sever;
  GORE.dice = function (ent, opts) {
    opts = opts || {};
    opts.cubes = opts.cubes == null ? true : opts.cubes;
    sever(ent, opts);
  };

  /* =====================================================================
     BURNED
     The body chars where it stands, drops, and stays there as a husk.
     ================================================================== */
  function burn(ent, opts) {
    opts = opts || {};
    if (!ent || !ent.rig || ent.__gored) return;
    ent.__gored = true;
    var rig = ent.rig;
    rig.root.updateMatrixWorld(true);

    /* the whole body copied in one piece, because it is not coming apart */
    var g = new THREE.Group();
    rig.root.matrixWorld.decompose(_v, _q, _s);
    g.position.copy(_v); g.quaternion.copy(_q);
    _inv.copy(rig.root.matrixWorld).invert();
    var mats = [];
    rig.root.traverse(function (c) {
      if (!c.isMesh || !c.visible || c.isSprite) return;
      var m = new THREE.Mesh(c.geometry, c.material.clone());
      _rel.multiplyMatrices(_inv, c.matrixWorld);
      _rel.decompose(m.position, m.quaternion, m.scale);
      m.castShadow = true;
      g.add(m);
      mats.push(m.material);
    });
    scene.add(g);
    hideBody(ent);

    var at = ent.pos.clone();
    FX.fire(at.clone().add(new THREE.Vector3(0, 2.4, 0)), 16, 1.5, 3.4, 1.1);
    FX.scorch(new THREE.Vector3(at.x, 0, at.z), 4.2, 40);
    try { sfx.fire(); } catch (e) {}

    var t = 0, tip = (Math.random() < .5 ? 1 : -1) * (Math.PI / 2);
    var husk = { gone: false };
    ent.__husk = husk;
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      /* it goes black from the inside out over the first second and a half */
      var k = Math.min(1, t / 1.5);
      for (var i = 0; i < mats.length; i++) {
        mats[i].color.lerp(new THREE.Color(CHAR), Math.min(1, dt * 2.4));
        if (mats[i].emissive) {
          mats[i].emissive.setHex(0xff4a10);
          mats[i].emissiveIntensity = Math.max(0, (1 - k) * .9 + Math.sin(t * 9) * .08 * (1 - k));
        }
      }
      /* fire on it while it burns, then only smoke */
      if (t < 3.4 && Math.random() < dt * 22) {
        FX.flame(g.position.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 1.6, Math.random() * 4.2, (Math.random() - .5) * 1.6)),
          1 + Math.random() * 1.6, .5 + Math.random() * .4);
      } else if (t < 9 && Math.random() < dt * 5) {
        FX.dust(g.position.clone().add(new THREE.Vector3(0, 2 + Math.random() * 2, 0)), 1, 0x24201e, 2, 2.4);
      }
      /* and it goes down, once there is not enough of it left to stand */
      if (t > .9) {
        g.rotation.x += (tip - g.rotation.x) * Math.min(1, dt * (t > 1.6 ? 3.4 : 1.1));
        g.position.y = Math.max(-.4, g.position.y - dt * 1.4);
        if (t > 1.2 && !husk.landed) {
          husk.landed = true;
          FX.dust(new THREE.Vector3(g.position.x, 0, g.position.z), 6, 0x2a2422, 6, 2.6);
          addShake(.2);
        }
      }
      if (husk.gone) {
        husk.fade = (husk.fade || 0) + dt;
        for (var j = 0; j < mats.length; j++) {
          mats[j].transparent = true;
          mats[j].opacity = Math.max(0, 1 - husk.fade / .6);
        }
        if (husk.fade > .6) {
          scene.remove(g);
          mats.forEach(function (m) { m.dispose(); });
          return false;
        }
      }
      return true;
    } });
    addShake(.6);
  }
  GORE.burn = burn;

  /* the rig itself steps out of shot — mp.js puts a remote body back on
     screen every packet, so it is held down here rather than set once */
  function hideBody(ent) {
    ent.__goreHide = true;
    if (ent.rig && ent.rig.root) ent.rig.root.visible = false;
    if (ent.hpSpr) ent.hpSpr.visible = false;
  }

  addFx({ t: 1e9, update: function (dt) {
    stepPieces(dt);
    if (player.__goreHide && player.rig) player.rig.root.visible = false;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e && e.__goreHide && e.rig) { e.rig.root.visible = false; if (e.hpSpr) e.hpSpr.visible = false; }
    }
    return true;
  } });

  /* =====================================================================
     DYING THE OTHER TWO WAYS
     ================================================================== */
  function goreDeath(ent, style, dir) {
    if (style === 'burn') burn(ent, { dir: dir });
    else sever(ent, { dir: dir, power: style === 'dice' ? 1.3 : 1, cubes: style === 'dice' });
    /* a body that comes apart on one screen and flops on every other one
       is two different deaths. Ours goes out; theirs comes in. */
    if (ent === player && window.MPJJ && window.MPJJ.active && window.MPJJ.relay) {
      var d = dir || new THREE.Vector3(0, 0, 1);
      window.MPJJ.relay.pub({
        t: 'gore', id: window.MPJJ.id, s: style,
        dx: Math.round(d.x * 10) / 10, dz: Math.round(d.z * 10) / 10
      });
    }
  }
  GORE.kill = goreDeath;

  /* somebody else's body, going the way theirs went */
  GORE.remote = function (ent, style, dir) {
    if (!ent || ent.__gored) return;
    ent.dead = true;
    /* long enough for the pieces to be looked at: a body that is put back
       together on the next frame was never taken apart */
    ent.respawnT = Math.max(ent.respawnT || 0, 9);
    goreDeath(ent, style || 'sever', dir);
  };

  var _die = Enemy.prototype.die;
  Enemy.prototype.die = function () {
    var style = styleOf(this);
    var was = this.vel ? this.vel.clone() : null;
    _die.call(this);                                  // the ragdoll, the bars, the respawn clock
    if (!style) return;
    if (this.rag) { this.rag.vel.multiplyScalar(.2); }  // the limp body is not the shot any more
    this.respawnT = Math.max(this.respawnT, 9);
    goreDeath(this, style, was);
  };

  var _respawn = Enemy.prototype.respawn;
  Enemy.prototype.respawn = function () {
    clearPieces(this);
    this.__death = null;
    return _respawn.call(this);
  };

  /* the player goes the same way, and is put back together on respawn */
  var _updatePlayer = updatePlayer;
  var wasDead = false;
  updatePlayer = function (dt) {
    if (player.dead && !player.__gored) {
      var style = styleOf(player);
      if (style) {
        /* let ragdoll.js start its body first: everything downstream — the
           camera, the position that goes out on the wire — reads from it */
        if (!player.rag && window.JJRAG) {
          try { window.JJRAG.start(player, player.vel); } catch (e) {}
        }
        player.deathT = Math.max(player.deathT || 0, 5);
        goreDeath(player, style, player.vel);
      }
    }
    if (wasDead && !player.dead) { clearPieces(player); player.__death = null; }
    wasDead = player.dead;
    return _updatePlayer(dt);
  };

  /* =====================================================================
     THE SOUNDS THE GAME NEVER HAD
     sukuna.js and naoya.js already ask for these; they have been quietly
     failing into a catch since the day they were written.
     ================================================================== */
  if (typeof sfx === 'object' && typeof noiseBurst === 'function' && typeof tone === 'function') {
    if (!sfx.slash) sfx.slash = function () {
      noiseBurst(.09, .16, 3200, 'highpass');
      tone(1800, .1, 'sawtooth', .06, -1400);
    };
    if (!sfx.hit) sfx.hit = function () {
      noiseBurst(.1, .18, 900);
      tone(110, .1, 'square', .12, -60);
    };
    if (!sfx.blast) sfx.blast = function () {
      noiseBurst(.55, .34, 600);
      tone(60, .6, 'sawtooth', .2, -30);
      tone(180, .3, 'square', .09, -140);
    };
    if (!sfx.fire) sfx.fire = function () {
      noiseBurst(.7, .3, 420);
      tone(240, .5, 'sawtooth', .07, -180);
    };
    if (!sfx.sever) sfx.sever = function () {
      noiseBurst(.14, .2, 2600, 'highpass');
      noiseBurst(.3, .16, 500);
      tone(90, .3, 'sawtooth', .12, -50);
    };
  }
})();
