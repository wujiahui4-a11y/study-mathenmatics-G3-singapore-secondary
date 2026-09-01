/* =======================================================================
   WHAT IS LEFT AFTERWARDS

   Until now everything died the same way: the body went limp and lay
   there. Three ways now, and the choice belongs to whatever killed you.

     ragdoll     the old one, still the default
     dismember   the rig comes apart at the joints. Not a puff of debris
                 standing in for a body — the actual limbs, cut off where
                 the cut landed, thrown, and then left on the floor.
     burn        it chars from the inside, stands a moment longer than it
                 should, and goes down as a black husk with embers in it.

   And a lock, so that a finisher gets to finish: while it is held, the
   target cannot be taken below one point of health by anything.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof Enemy === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX) return;

  var G = window.JJGORE = { parts: [], embers: [] };
  var GRAV = 42, MAX_PARTS = 260;

  /* =====================================================================
     THE LOCK
     ================================================================== */
  function lock(ent, on) {
    if (!ent) return;
    if (on) { ent.__hpLock = (ent.__hpLock || 0) + 1; }
    else { ent.__hpLock = Math.max(0, (ent.__hpLock || 0) - 1); }
  }
  function locked(ent) { return !!(ent && ent.__hpLock > 0); }
  G.lock = lock;
  G.locked = locked;

  /* nothing gets to kill a held target; it stops at one and waits */
  var _damage = Enemy.prototype.damage;
  Enemy.prototype.damage = function (amount, knock, opt) {
    if (locked(this) && this.hp - amount < 1) {
      amount = Math.max(0, this.hp - 1);
      if (amount <= 0) {                     /* still show the hit landing */
        var o = opt || {};
        if (o.spark != null) FX.impact(this.pos.clone().add(new THREE.Vector3(0, 3, 0)), o.spark, 1.2);
        if (o.react) {
          this.react = { type: o.react, t: 0, dur: o.reactDur || .3, side: o.side || 1 };
        }
        return;
      }
    }
    return _damage.call(this, amount, knock, opt);
  };
  var _hurt = typeof hurtPlayer === 'function' ? hurtPlayer : null;
  if (_hurt) {
    hurtPlayer = function (amount, knock) {
      if (locked(player) && player.hp - amount < 1) amount = Math.max(0, player.hp - 1);
      return _hurt(amount, knock);
    };
  }

  /* =====================================================================
     PIECES
     A rig is a tree of joints with boxes hung off them. To take it apart
     you group the boxes by the joint that carries them, lift each group
     out with the joint's world transform, and from then on they are
     objects in the world with nothing holding them together.
     ================================================================== */
  var LIMBS = [
    { j: 'head', cut: 'neck', mass: .8 },
    { j: 'neck', cut: 'neck', mass: .5 },
    { j: 'spine', cut: 'waist', mass: 2.2 },
    { j: 'hips', cut: 'waist', mass: 1.8 },
    { j: 'shoulderL', stop: 'elbowL', cut: 'shoulder', mass: .7 },
    { j: 'elbowL', cut: 'elbow', mass: .5 },
    { j: 'shoulderR', stop: 'elbowR', cut: 'shoulder', mass: .7 },
    { j: 'elbowR', cut: 'elbow', mass: .5 },
    { j: 'hipL', stop: 'kneeL', cut: 'hip', mass: 1 },
    { j: 'kneeL', cut: 'knee', mass: .8 },
    { j: 'hipR', stop: 'kneeR', cut: 'hip', mass: 1 },
    { j: 'kneeR', cut: 'knee', mass: .8 }
  ];

  /* the meshes a joint carries, stopping before the next joint down */
  function ownMeshes(node, stopNode) {
    var out = [];
    (function walk(o) {
      for (var i = 0; i < o.children.length; i++) {
        var c = o.children[i];
        if (c === stopNode) continue;
        if (c.isMesh) out.push(c);
        else if (c.isGroup || c.isObject3D) {
          /* a nested joint of its own belongs to whoever owns it */
          if (isJoint(c)) continue;
          walk(c);
        }
      }
    })(node);
    return out;
  }
  var jointSet = null;
  function isJoint(o) { return jointSet ? jointSet.has(o) : false; }

  function buildJointSet(rig) {
    jointSet = new Set();
    LIMBS.forEach(function (L) { if (rig[L.j]) jointSet.add(rig[L.j]); });
  }

  /* a stump: the raw red where the limb used to carry on */
  function stump(parent, size) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(size * 1.5, size * .5, size * 1.5),
      new THREE.MeshStandardMaterial({
        color: 0xb01422, roughness: .35, emissive: 0x6a0810, emissiveIntensity: .9
      }));
    parent.add(m);
    return m;
  }

  function bloodPool(pos, r) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      color: 0x4a0610, transparent: true, opacity: .84,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, .09, pos.z);
    m.scale.set(r, r, 1);
    m.renderOrder = 2;
    scene.add(m);
    G.parts.push({
      o: m, v: new THREE.Vector3(), av: new THREE.Vector3(),
      rest: 99, t: 1e9, fade: 0, bounce: 0
    });
  }

  function addPart(group, vel, spin, opt) {
    opt = opt || {};
    scene.add(group);
    G.parts.push({
      o: group, v: vel, av: spin,
      rest: 0, t: opt.life == null ? 1e9 : opt.life, fade: opt.fade || 0,
      bounce: opt.bounce == null ? .28 : opt.bounce
    });
    while (G.parts.length > MAX_PARTS) {
      var old = G.parts.shift();
      scene.remove(old.o);
    }
  }

  /* take the body apart. dir is the way the cut was travelling. */
  function dismember(ent, dir, opt) {
    opt = opt || {};
    var rig = ent.rig;
    if (!rig || !rig.root || ent.__gone) return;
    ent.__gone = true;
    rig.root.updateMatrixWorld(true);
    buildJointSet(rig);

    var d = (dir || new THREE.Vector3(0, 0, 1)).clone().setY(0);
    if (d.lengthSq() < .001) d.set(0, 0, 1);
    d.normalize();
    var side = new THREE.Vector3(d.z, 0, -d.x);
    var centre = ent.pos.clone().add(new THREE.Vector3(0, 3, 0));

    for (var i = 0; i < LIMBS.length; i++) {
      var L = LIMBS[i];
      var node = rig[L.j];
      if (!node) continue;
      var meshes = ownMeshes(node, L.stop ? rig[L.stop] : null);
      if (!meshes.length) continue;

      var g = new THREE.Group();
      node.getWorldPosition(g.position);
      node.getWorldQuaternion(g.quaternion);
      var sc = node.getWorldScale(new THREE.Vector3());
      g.scale.copy(sc);

      for (var m = 0; m < meshes.length; m++) {
        var src = meshes[m];
        var cl = new THREE.Mesh(src.geometry, src.material);
        src.matrixWorld.decompose(cl.position, cl.quaternion, cl.scale);
        g.worldToLocal(cl.position);
        var pq = node.getWorldQuaternion(new THREE.Quaternion()).invert();
        cl.quaternion.premultiply(pq);
        cl.castShadow = true;
        g.add(cl);
      }
      stump(g, L.mass > 1.4 ? .95 : .6);

      /* thrown along the cut — short, so the pieces stay where you can see them */
      var here = g.position.clone().sub(centre);
      var up = 2.4 + Math.random() * 3.2 + Math.max(0, here.y) * .25;
      var vel = d.clone().multiplyScalar(1.4 + Math.random() * 2.6)
        .addScaledVector(side, (Math.random() - .5) * 3.4)
        .add(new THREE.Vector3(0, up, 0));
      var spin = new THREE.Vector3(
        (Math.random() - .5) * 8, (Math.random() - .5) * 8, (Math.random() - .5) * 8);
      addPart(g, vel, spin, { bounce: .2 });

      FX.impact(g.position.clone(), 0xb01020, 1.1);
    }

    finish(ent);
    bloodPool(ent.pos, 3.6);
    bloodPool(ent.pos.clone().addScaledVector(d, 1.6), 2.2);
    /* the cut itself, where the body used to be */
    if (FX.worldCut) {
      FX.worldCut(centre.clone().addScaledVector(d, -10), d, {
        len: 24, h: 9, thick: 2, color: 0xffffff, echo: 0xb01020, life: .6
      });
    }
    for (var k = 0; k < 4; k++) {
      var at = centre.clone().add(new THREE.Vector3(
        (Math.random() - .5) * 2, (Math.random() - .5) * 3, (Math.random() - .5) * 2));
      FX.slash(at, d, k % 2 ? 0xffffff : 0xff2a4a, 8, .26);
    }
    FX.cross(centre, 0xffffff, 5, .26);
    FX.impact(centre, 0xb01020, 2.8);
    FX.streaks(centre, 0xb01020, 10, 8, 1.2);
    if (!opt.quiet) { addShake(1.2); hitstop(.12); }
  }
  G.dismember = dismember;

  /* =====================================================================
     BURNING
     ================================================================== */
  function burn(ent, opt) {
    opt = opt || {};
    var rig = ent.rig;
    if (!rig || !rig.root || ent.__gone) return;
    ent.__gone = true;

    /* the rig stays whole; it just stops being a person and starts
       being a thing that is on fire */
    var body = rig.root;
    var mats = [];
    body.traverse(function (o) {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      if (o.material.emissive) o.material.emissive.setHex(0x2a0600);
      mats.push(o.material);
    });
    if (ent.hpSpr) ent.hpSpr.visible = false;

    var at = ent.pos.clone();
    var t = 0, dur = opt.dur == null ? 2.2 : opt.dur;
    var down = false;
    addFx({ t: dur + .6, update: function (dt) {
      t += dt;
      var k = Math.min(1, t / dur);
      for (var i = 0; i < mats.length; i++) {
        var c = mats[i].color;
        c.multiplyScalar(1 - dt * 1.9);              /* to black, from the inside */
        if (mats[i].emissive) {
          mats[i].emissive.setRGB(Math.max(0, .5 - k * .5), Math.max(0, .12 - k * .14), 0);
        }
      }
      if (Math.random() < .9) {
        FX.mote(at.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 2, .4 + Math.random() * 5, (Math.random() - .5) * 2)),
          Math.random() < .4 ? 0xff8a2a : 0xffd070, 5, .5);
      }
      if (!down && t > dur * .62) {                  /* the knees go first */
        down = true;
        if (window.JJRAG) { try { window.JJRAG.start(ent, new THREE.Vector3(0, -1, 0), 0); } catch (e) {} }
      }
      this.t -= dt;
      return this.t > 0;
    } });

    FX.impact(at.clone().add(new THREE.Vector3(0, 3, 0)), 0xff6a2a, 2.6);
    FX.rings(new THREE.Vector3(at.x, .1, at.z), 0xff8a3a, 3, { maxR: 7, life: .6, gap: 60 });
    embers(at, 3.5);
    finish(ent, true);
  }
  G.burn = burn;

  function embers(at, dur) {
    var t = 0;
    addFx({ t: dur, update: function (dt) {
      t += dt;
      this.t -= dt;
      if (Math.random() < .5) {
        var m = FX.billboard(FX.T.star, Math.random() < .5 ? 0xff7a2a : 0xffc060, 1);
        m.scale.setScalar(.25 + Math.random() * .3);
        m.position.set(at.x + (Math.random() - .5) * 3, .3, at.z + (Math.random() - .5) * 3);
        scene.add(m);
        var up = 1.6 + Math.random() * 2.6, life = 1.4;
        addFx({ t: life, update: function (d) {
          this.t -= d;
          m.position.y += up * d;
          m.position.x += (Math.random() - .5) * d * 2;
          m.material.opacity = this.t / life;
          if (this.t <= 0) { scene.remove(m); m.material.dispose(); return false; }
          return true;
        } });
      }
      return this.t > 0;
    } });
  }

  /* the bookkeeping every death needs, whichever kind it was */
  function finish(ent, keepRig) {
    ent.dead = true;
    ent.respawnT = Math.max(ent.respawnT || 0, 5.5);
    ent.hp = 0;
    ent.__hpLock = 0;
    if (ent.unframe) { try { ent.unframe(false); } catch (e) {} }
    if (ent.hpSpr) ent.hpSpr.visible = false;
    if (!keepRig && ent.rig) scene.remove(ent.rig.root);
    if (window.JJRAG && window.JJRAG.stop && !keepRig) {
      try { window.JJRAG.stop(ent); } catch (e) {}
    }
  }

  /* a body that came apart does not stand back up in one piece */
  var _respawn = Enemy.prototype.respawn;
  Enemy.prototype.respawn = function () {
    if (this.__gone) {
      this.__gone = false;
      if (this.rig && this.rig.root && !this.rig.root.parent) scene.add(this.rig.root);
      if (this.rig) {
        this.rig.root.traverse(function (o) {
          if (o.isMesh && o.material && o.material.__gore) o.material.__gore = false;
        });
      }
    }
    return _respawn.call(this);
  };

  /* =====================================================================
     WHAT A KILLING BLOW ASKS FOR
     A move sets the manner of death before it lands; the death reads it.
     ================================================================== */
  G.mark = function (ent, how, dir) {
    if (!ent) return;
    ent.__deathBy = how;
    ent.__deathDir = dir ? dir.clone() : null;
  };

  var _die = Enemy.prototype.die;
  Enemy.prototype.die = function () {
    var how = this.__deathBy;
    this.__deathBy = null;
    if (how === 'cut') { dismember(this, this.__deathDir); return; }
    if (how === 'burn') { burn(this); return; }
    return _die.call(this);
  };

  /* =====================================================================
     THE PIECES, ONCE THEY ARE ON THE FLOOR
     ================================================================== */
  addFx({ t: 1e9, update: function (dt) {
    var d = Math.min(dt, .05);
    for (var i = G.parts.length - 1; i >= 0; i--) {
      var p = G.parts[i];
      if (p.rest < 3) {
        p.v.y -= GRAV * d;
        p.o.position.addScaledVector(p.v, d);
        p.o.rotation.x += p.av.x * d;
        p.o.rotation.y += p.av.y * d;
        p.o.rotation.z += p.av.z * d;
        if (p.o.position.y < .35) {
          p.o.position.y = .35;
          if (Math.abs(p.v.y) > 2) {
            p.v.y = -p.v.y * p.bounce;
            p.v.x *= .62; p.v.z *= .62;
            p.av.multiplyScalar(.5);
            FX.dust(p.o.position.clone(), 2, 1.2);
          } else {
            p.v.set(0, 0, 0);
            p.av.multiplyScalar(.7);
            p.rest += d * 4;
            if (p.rest >= 3) {                       /* and it lies where it fell */
              p.o.rotation.x = Math.round(p.o.rotation.x / (Math.PI / 2)) * (Math.PI / 2);
              p.o.rotation.z = Math.round(p.o.rotation.z / (Math.PI / 2)) * (Math.PI / 2);
              p.o.position.y = .3;
            }
          }
        }
      }
      if (p.t < 1e8) {
        p.t -= d;
        if (p.t <= 0) { scene.remove(p.o); G.parts.splice(i, 1); }
      }
    }
    return true;
  } });

  /* a fresh round should not start in last round's mess */
  G.clear = function () {
    G.parts.forEach(function (p) { scene.remove(p.o); });
    G.parts.length = 0;
  };

  /* the player dies the same ways, and the pieces stay until they stand up */
  addFx({ t: 1e9, update: function () {
    if (player.dead && !player.__gone && player.__deathBy) {
      var how = player.__deathBy;
      player.__deathBy = null;
      var dir = player.__deathDir;
      if (how === 'cut') dismember(player, dir);
      else if (how === 'burn') burn(player);
    }
    if (!player.dead && player.__gone) {
      player.__gone = false;
      if (player.rig && player.rig.root && !player.rig.root.parent) scene.add(player.rig.root);
    }
    return true;
  } });
})();
