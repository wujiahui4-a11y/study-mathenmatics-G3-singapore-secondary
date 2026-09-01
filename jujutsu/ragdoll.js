/* =======================================================================
   RAGDOLL
   Dying used to burst the body into loose boxes and delete the rig. Now
   the rig goes limp instead: the hips carry the momentum of whatever
   killed you, the body tumbles, the joints swing on springs with no
   muscle behind them, and it lands and settles into a heap that stays
   there until the respawn.

   The joints keep their parent chain, the way a Roblox ragdoll keeps its
   ball sockets, so the body can flop as hard as it likes without ever
   coming apart.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;

  var G = 34;                    // same gravity the living use
  var HIP_REST = .82;            // how high the hips sit once it is down

  /* every joint the sim drives, with how freely it swings and where it
     ends up once there is nothing holding it */
  var JOINTS = [
    { n: 'spine', k: 13, d: 5.5, x: .22, z: 0, sx: .5, i: .6 },
    { n: 'neck', k: 9, d: 4.4, x: .34, z: 0, sx: .9, i: 1.5 },
    { n: 'shoulderL', k: 5, d: 3.4, x: .75, z: .55, sx: 1.5, i: 2.6 },
    { n: 'shoulderR', k: 5, d: 3.4, x: .75, z: -.55, sx: 1.5, i: 2.6 },
    { n: 'elbowL', k: 6, d: 3.0, x: -.62, z: 0, sx: 1.4, i: 2.2 },
    { n: 'elbowR', k: 6, d: 3.0, x: -.62, z: 0, sx: 1.4, i: 2.2 },
    { n: 'hipL', k: 8, d: 4.2, x: -.28, z: .22, sx: 1.1, i: 1.7 },
    { n: 'hipR', k: 8, d: 4.2, x: -.16, z: -.3, sx: 1.1, i: 1.7 },
    { n: 'kneeL', k: 9, d: 3.6, x: .62, z: 0, sx: 1.2, i: 1.9 },
    { n: 'kneeR', k: 9, d: 3.6, x: .48, z: 0, sx: 1.2, i: 1.9 }
  ];

  /* recover: seconds to lie there before getting back up. Left out, the
     body stays down — which is what dying means. */
  function start(ent, knock, recover) {
    if (!ent || !ent.rig || ent.rag) return;
    var rig = ent.rig;
    var hips = ent.pos.clone();
    hips.y += rig.hipsBaseY;

    var v = (knock || ent.vel || new THREE.Vector3()).clone();
    v.y = Math.max(v.y, 4 + Math.random() * 4);
    var speed = Math.hypot(v.x, v.z);

    var rag = ent.rag = {
      hips: hips,
      vel: v,
      rot: new THREE.Euler(0, ent.facing || 0, 0),
      /* spun by whatever direction it was hit from */
      av: new THREE.Vector3(
        (Math.random() - .5) * 3 + speed * .09,
        (Math.random() - .5) * 4,
        (Math.random() - .5) * 3),
      down: false, restT: 0, t: 0, j: {}, recover: recover || 0
    };
    JOINTS.forEach(function (d) {
      var cur = rig[d.n];
      rag.j[d.n] = {
        x: cur ? cur.rotation.x : 0, z: cur ? cur.rotation.z : 0,
        vx: (Math.random() - .5) * 9, vz: (Math.random() - .5) * 6
      };
    });
    if (rig.body) rig.body.rotation.set(0, 0, 0);
    if (rig.root.parent !== scene) scene.add(rig.root);
    if (ent.hpSpr) ent.hpSpr.visible = false;
    ent.ragKeep = true;
  }

  function stop(ent) {
    if (!ent || !ent.rag) return;
    ent.rag = null;
    ent.ragKeep = false;
    if (ent.rig) {
      ent.rig.root.rotation.set(0, 0, 0);
      if (ent.rig.body) ent.rig.body.rotation.set(0, 0, 0);
      try { resetPose(ent.rig); } catch (e) {}
    }
    if (ent.hpSpr) ent.hpSpr.visible = true;
  }

  function step(ent, dt) {
    var rag = ent.rag, rig = ent.rig;
    if (!rag || !rig) return;
    rag.t += dt;

    /* --- the body itself --- */
    rag.vel.y -= G * dt;
    rag.hips.addScaledVector(rag.vel, dt);

    rag.rot.x += rag.av.x * dt;
    rag.rot.y += rag.av.y * dt;
    rag.rot.z += rag.av.z * dt;

    /* the hips ride high while it is upright and low once it is over */
    var tip = Math.min(1, Math.abs(Math.sin(rag.rot.x)) + Math.abs(Math.sin(rag.rot.z)));
    var floor = rig.hipsBaseY * (1 - tip) + HIP_REST * tip;

    if (rag.hips.y <= floor) {
      rag.hips.y = floor;
      var hit = -rag.vel.y;
      if (hit > 3) {
        rag.vel.y = hit * .22;                       // one loose bounce
        rag.av.multiplyScalar(.55);
        rag.av.x += (Math.random() - .5) * 4;
        if (FX && hit > 8) {
          FX.dust(new THREE.Vector3(rag.hips.x, 0, rag.hips.z), 4, 0xd2d8e4, 5, 2.2);
        }
        JOINTS.forEach(function (d) {
          var j = rag.j[d.n];
          j.vx += (Math.random() - .5) * 11;
          j.vz += (Math.random() - .5) * 7;
        });
      } else {
        rag.vel.y = 0;
        rag.down = true;
      }
      /* scraping along the floor */
      var f = Math.pow(rag.down ? .02 : .3, dt);
      rag.vel.x *= f; rag.vel.z *= f;
      rag.av.multiplyScalar(Math.pow(.08, dt));
    }

    if (typeof collideWorld === 'function') collideWorld(rag.hips, 1);

    /* Somebody else's body is simulated here so it flops on this screen
       too, but where it ends up belongs to them: their broadcast pulls it
       into place, gently enough not to fight the tumble. */
    if (rag.pull) {
      var g = Math.min(1, dt * (rag.down ? 9 : 3.6));
      rag.hips.x += (rag.pull.x - rag.hips.x) * g;
      rag.hips.z += (rag.pull.z - rag.hips.z) * g;
      /* follow them up too, so a body thrown into the air is in the air on
         every screen rather than lying down early */
      if (rag.pull.y != null) {
        var wantY = rag.pull.y + floor;
        if (rag.pull.y > .3 || rag.hips.y < wantY) {
          rag.hips.y += (wantY - rag.hips.y) * Math.min(1, dt * 2.6);
          if (rag.hips.y > floor + .2) rag.down = false;
        }
      }
    }

    /* once it is down it keeps tipping until it is lying on its side */
    if (rag.down) {
      rag.restT += dt;
      var lie = rag.rot.x > 0 ? Math.PI / 2 : -Math.PI / 2;
      rag.rot.x += (lie - rag.rot.x) * Math.min(1, dt * 3.4);
      rag.rot.z += (0 - rag.rot.z) * Math.min(1, dt * 2.6);
      rag.av.multiplyScalar(Math.pow(.02, dt));
    }

    /* --- the joints, on springs with nothing driving them --- */
    var loose = rag.down ? 1 : 1.7;                  // flails harder in the air
    JOINTS.forEach(function (d) {
      var j = rag.j[d.n], part = rig[d.n];
      if (!part) return;
      j.vx += (d.x - j.x) * d.k * dt;
      j.vz += (d.z - j.z) * d.k * dt;
      /* gravity pulls the limb toward whichever way is down for the body */
      j.vx += Math.sin(rag.rot.x) * d.sx * 7 * dt;
      /* and the limb is left behind whenever the body turns under it —
         this is the part that makes it read as loose rather than carved */
      j.vx -= rag.av.x * d.i * 2.2 * dt;
      j.vz -= rag.av.z * d.i * 1.6 * dt;
      if (!rag.down) {
        j.vx += (Math.random() - .5) * 34 * dt * loose;
        j.vz += (Math.random() - .5) * 22 * dt * loose;
      }
      var damp = Math.pow(rag.down ? .02 : .42, dt);
      j.vx *= damp; j.vz *= damp;
      j.x += j.vx * dt;
      j.z += j.vz * dt;
      part.rotation.x = j.x;
      part.rotation.z = j.z;
    });

    /* a body that is only winded gets up again */
    if (rag.recover && rag.restT > rag.recover && !ent.dead) {
      stop(ent);
      if (ent === player) { player.iframes = Math.max(player.iframes, .7); }
      else { ent.stunT = Math.max(ent.stunT || 0, .5); }
      if (FX) FX.dust(new THREE.Vector3(rag.hips.x, 0, rag.hips.z), 3, 0xd2d8e4, 4, 2);
      return;
    }

    /* the body carries its owner's position with it, so the chase camera
       keeps watching the corpse rather than the spot it died on — except
       for a body that belongs to another client, whose position is theirs */
    if (!rag.pull) {
      ent.pos.x = rag.hips.x;
      ent.pos.z = rag.hips.z;
      /* the height goes out with it, so the other clients can put the body
         where it actually is rather than flat on the floor */
      ent.pos.y = Math.max(0, rag.hips.y - floor);
    }

    /* --- write it out --- */
    var q = new THREE.Quaternion().setFromEuler(rag.rot);
    var off = new THREE.Vector3(0, rig.hipsBaseY, 0).applyQuaternion(q);
    rig.root.quaternion.copy(q);
    rig.root.position.copy(rag.hips).sub(off);
    if (rig.body) rig.body.rotation.set(0, 0, 0);
    if (rig.hips) rig.hips.position.y = rig.hipsBaseY;
  }

  /* one tick for every body on the field, living or otherwise */
  addFx({ t: 1e9, update: function (dt) {
    if (player.rag) step(player, dt);
    for (var i = 0; i < enemies.length; i++) if (enemies[i].rag) step(enemies[i], dt);
    return true;
  } });

  /* ------------------------------------------------------------- hooks */

  /* the corpse stays put instead of bursting into boxes */
  Enemy.prototype.die = function () {
    this.dead = true;
    this.respawnT = 5;
    this.unframe(false);
    this.lockT = 0; this.anchorT = 0; this.flung = false;
    this.react = null;
    try { sfx.hurt(); } catch (e) {}
    if (FX) {
      FX.impact(this.pos.clone().add(new THREE.Vector3(0, 3, 0)), 0xff5f6d, 1.3);
      FX.dust(new THREE.Vector3(this.pos.x, 0, this.pos.z), 5, 0xd2d8e4, 6, 2.4);
    }
    start(this, this.vel);
  };

  var _respawn = Enemy.prototype.respawn;
  Enemy.prototype.respawn = function () {
    stop(this);
    return _respawn.call(this);
  };

  /* a ragdoll is not standing anywhere, so nothing should be able to walk
     into it or hit it */
  var _enemyUpdate = Enemy.prototype.update;
  Enemy.prototype.update = function (dt) {
    if (this.rag) {
      if (this.dead) {
        this.respawnT -= dt;
        if (this.respawnT <= 0) this.respawn();
      }
      return;
    }
    return _enemyUpdate.call(this, dt);
  };

  /* the player goes limp the same way, and the chase camera keeps
     watching the body */
  var _updatePlayer = updatePlayer;
  var wasDead = false;
  updatePlayer = function (dt) {
    if (player.dead && !player.rag) {
      start(player, player.vel);
      player.deathT = Math.max(player.deathT, 3.4);
    }
    _updatePlayer(dt);
    if (wasDead && !player.dead) stop(player);
    wasDead = player.dead;
  };

  window.JJRAG = { start: start, stop: stop, step: step };
})();
