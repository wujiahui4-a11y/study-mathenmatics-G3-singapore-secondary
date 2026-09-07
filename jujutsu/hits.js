/* =======================================================================
   GETTING HIT
   The game shipped with five flinches — head, gut, stab, pummel and
   stagger — and combat.js added the throw. They were only ever played on
   the dummies and on other people's fighters: nothing hurting you locally
   ever asked your own body to react to it.

   Two things happen here.

   One: eight more reactions, for the hits that had nothing to play.
   Being cut open is not being punched in the head. Being set on fire is
   not being punched in the gut. Being caught in a lattice of cuts is a
   body jerking once per cut and then not moving again.

   Two: every reaction, old and new, gets a layer of ring-out on top —
   the head carrying on past where it was snapped to, the arms trailing,
   the knees giving a little and taking the weight back. A flinch that
   arrives and stops dead reads as a frame of animation. A flinch that
   overshoots and settles reads as a body.

   And all of it now plays on the player too, in every mode, driven by
   the same table the dummies use.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX) return;

  var H = window.JJHITS = {};

  /* =====================================================================
     THE NEW REACTIONS
     Each is written the way the originals are: k is how far through it is,
     snap arrives in two frames, env leaves over the whole duration.
     ================================================================== */
  var EXTRA = {

    /* cut open. The body opens along the line of the cut first — that is
       the whole read — and only then folds around it. */
    slash: function (r, k, env, snap, side, t) {
      var open = Math.min(1, k / .22), fold = k > .3 ? (k - .3) / .7 : 0;
      var e = snap * env;
      r.spine.rotation.z = (.55 * open - .35 * fold) * side * e;
      r.spine.rotation.y = -.4 * open * side * e;
      r.spine.rotation.x = (-.3 * open + .95 * fold) * e;
      r.neck.rotation.z = .4 * open * side * e;
      r.neck.rotation.x = (-.45 * open + .8 * fold) * e;
      /* the arm on the cut side is thrown wide, the other comes across it */
      r.shoulderR.rotation.x = (-1.5 * open + .6 * fold) * e;
      r.shoulderR.rotation.z = (-1.15 * open + .8 * fold) * e;
      r.shoulderL.rotation.x = (-.5 * open - .9 * fold) * e;
      r.shoulderL.rotation.z = (.4 * open + .1 * fold) * e;
      r.elbowL.rotation.x = -1.5 * fold * e;
      r.elbowR.rotation.x = (-.2 * open - .9 * fold) * e;
      r.hipL.rotation.x = -.3 * fold * e; r.hipR.rotation.x = -.2 * fold * e;
      r.kneeL.rotation.x = .75 * fold * e; r.kneeR.rotation.x = .5 * fold * e;
      r.hips.position.y = r.hipsBaseY - (.12 * open + .5 * fold) * e;
    },

    /* caught in the lattice. One jerk per cut, each in its own direction,
       each dying inside a tenth of a second — and then nothing, because
       by the last one there is nothing holding it together. */
    dismantle: function (r, k, env, snap, side, t) {
      var CUTS = 6;
      var n = Math.min(CUTS - 1, Math.floor(k * CUTS));
      var j = (k * CUTS) % 1;
      var hit = Math.exp(-j * 11);                     // the jerk itself
      var dying = 1 - k;                               // less left every time
      var a = Math.sin(n * 12.9898) * 43758.5453;
      a = a - Math.floor(a);                           // one angle per cut
      var ax = Math.cos(a * 6.283), az = Math.sin(a * 6.283);
      var m = hit * dying * snap * 1.25;
      r.spine.rotation.x = (.25 + ax * .8) * m;
      r.spine.rotation.z = az * .7 * m;
      r.spine.rotation.y = ax * .5 * m;
      r.neck.rotation.x = (-.2 + az * .9) * m;
      r.neck.rotation.z = -ax * .8 * m;
      r.shoulderL.rotation.x = (-.6 + az * 1.5) * m;
      r.shoulderR.rotation.x = (-.6 - az * 1.5) * m;
      r.shoulderL.rotation.z = (.3 - ax * .9) * m;
      r.shoulderR.rotation.z = (-.3 - ax * .9) * m;
      r.elbowL.rotation.x = -1 * m; r.elbowR.rotation.x = -.8 * m;
      r.hipL.rotation.x = -.5 * m * .6; r.hipR.rotation.x = .3 * m * .6;
      r.kneeL.rotation.x = .9 * Math.abs(m); r.kneeR.rotation.x = .7 * Math.abs(m);
      /* and it sinks the whole way through, because the legs are going */
      r.hips.position.y = r.hipsBaseY - (.2 + k * .9) * snap;
    },

    /* on fire: arms up over the face, turning away from it, and the body
       shaking hard enough that nothing else in the pose stays put */
    burn: function (r, k, env, snap, side, t) {
      var e = snap * env;
      var shiver = Math.sin(t * 41) * .12 * env;
      r.spine.rotation.x = (.35 + shiver) * e;
      r.spine.rotation.y = -.5 * side * e + shiver;
      r.spine.rotation.z = shiver * 1.6;
      r.neck.rotation.x = -.3 * e + shiver * 2;
      r.neck.rotation.z = .3 * side * e;
      /* both arms up in front of the face and beating at it */
      r.shoulderL.rotation.x = (-2.3 + Math.sin(t * 23) * .35) * e;
      r.shoulderR.rotation.x = (-2.4 + Math.cos(t * 21) * .35) * e;
      r.shoulderL.rotation.z = (.75 + shiver) * e;
      r.shoulderR.rotation.z = (-.75 - shiver) * e;
      r.elbowL.rotation.x = (-1.9 + Math.sin(t * 26) * .3) * e;
      r.elbowR.rotation.x = (-1.95 + Math.cos(t * 24) * .3) * e;
      r.hipL.rotation.x = -.4 * e; r.hipR.rotation.x = -.15 * e;
      r.kneeL.rotation.x = (.7 + k * .5) * e; r.kneeR.rotation.x = (.5 + k * .5) * e;
      r.hips.position.y = r.hipsBaseY - (.3 + k * .55) * e;
    },

    /* the legs simply stop holding them up */
    crumple: function (r, k, env, snap, side, t) {
      var fall = Math.min(1, k / .6), stay = snap;
      var give = fall * fall * (3 - 2 * fall);         // gone, then all at once
      r.spine.rotation.x = (.3 + 1.05 * give) * stay;
      r.spine.rotation.z = .18 * side * give * stay;
      r.neck.rotation.x = (.2 + .55 * give) * stay;
      /* the hands go out to catch a floor that is arriving too fast */
      r.shoulderL.rotation.x = (-.5 - 1.5 * give) * stay;
      r.shoulderR.rotation.x = (-.5 - 1.4 * give) * stay;
      r.shoulderL.rotation.z = (.5 * give) * stay;
      r.shoulderR.rotation.z = (-.5 * give) * stay;
      r.elbowL.rotation.x = -.5 * give * stay; r.elbowR.rotation.x = -.45 * give * stay;
      r.hipL.rotation.x = -1.25 * give * stay; r.hipR.rotation.x = -1.1 * give * stay;
      r.kneeL.rotation.x = 2.1 * give * stay; r.kneeR.rotation.x = 1.95 * give * stay;
      r.hips.position.y = r.hipsBaseY - 1.5 * give * stay;
    },

    /* the head goes first and everything else finds out late */
    whip: function (r, k, env, snap, side, t) {
      var head = Math.exp(-k * 5) * Math.cos(k * 17) * env;
      var lag = Math.exp(-Math.max(0, k - .08) * 5) * Math.cos(Math.max(0, k - .08) * 15) * env;
      r.neck.rotation.z = 1.05 * side * head;
      r.neck.rotation.x = -.5 * Math.abs(head);
      r.neck.rotation.y = .45 * side * head;
      r.spine.rotation.z = .42 * side * lag;
      r.spine.rotation.y = .3 * side * lag;
      r.spine.rotation.x = -.2 * Math.abs(lag);
      r.shoulderL.rotation.x = -.7 * lag; r.shoulderR.rotation.x = .7 * lag;
      r.shoulderL.rotation.z = -.4 * side * lag; r.shoulderR.rotation.z = -.4 * side * lag;
      r.elbowL.rotation.x = -.5 * Math.abs(lag); r.elbowR.rotation.x = -.5 * Math.abs(lag);
      r.hips.position.y = r.hipsBaseY - .18 * Math.abs(lag);
    },

    /* spun off a glancing hit, arms trailing behind the turn */
    spin: function (r, k, env, snap, side, t) {
      var turn = Math.sin(Math.min(1, k / .8) * Math.PI) * env;
      r.spine.rotation.y = 1.6 * side * turn;
      r.spine.rotation.z = .3 * side * turn;
      r.spine.rotation.x = -.25 * turn;
      r.neck.rotation.y = .8 * side * turn;
      r.neck.rotation.x = -.3 * turn;
      r.shoulderL.rotation.x = -1.45 * turn; r.shoulderR.rotation.x = -1.3 * turn;
      r.shoulderL.rotation.z = -.55 * turn; r.shoulderR.rotation.z = .55 * turn;
      r.elbowL.rotation.x = -.5 * turn; r.elbowR.rotation.x = -.45 * turn;
      r.hipL.rotation.x = -.4 * turn; r.kneeR.rotation.x = .7 * turn;
      r.hips.position.y = r.hipsBaseY - .22 * turn;
    },

    /* held, and shaking — a domain, a lock, more coming in than can go out */
    shock: function (r, k, env, snap, side, t) {
      var q = snap * (.7 + .3 * env);
      var tr = Math.sin(t * 47) * .07 * q, tr2 = Math.cos(t * 53) * .06 * q;
      r.spine.rotation.x = -.35 * q + tr;
      r.spine.rotation.z = tr2 * 1.4;
      r.neck.rotation.x = -.65 * q + tr * 2;
      r.neck.rotation.z = tr2 * 2.2;
      r.shoulderL.rotation.x = -.4 * q + tr * 3;
      r.shoulderR.rotation.x = -.4 * q - tr * 3;
      r.shoulderL.rotation.z = -.85 * q; r.shoulderR.rotation.z = .85 * q;
      r.elbowL.rotation.x = -.35 * q; r.elbowR.rotation.x = -.35 * q;
      r.hipL.rotation.x = -.2 * q + tr; r.hipR.rotation.x = -.15 * q - tr;
      r.kneeL.rotation.x = .35 * q; r.kneeR.rotation.x = .3 * q;
      r.hips.position.y = r.hipsBaseY + .18 * q;       // pulled off their heels
    },

    /* taken off the ground: arched over the fist, everything hanging */
    uplift: function (r, k, env, snap, side, t) {
      var up = Math.min(1, k / .3), fall = k > .5 ? (k - .5) / .5 : 0;
      var e = snap;
      r.spine.rotation.x = (-.95 * up + .8 * fall) * e;
      r.spine.rotation.z = .2 * side * up * e;
      r.neck.rotation.x = (-.75 * up + .95 * fall) * e;
      r.shoulderL.rotation.x = (-2.5 * up + 1.9 * fall) * e;
      r.shoulderR.rotation.x = (-2.45 * up + 1.85 * fall) * e;
      r.shoulderL.rotation.z = -.5 * up * e; r.shoulderR.rotation.z = .5 * up * e;
      r.elbowL.rotation.x = -.3 * e; r.elbowR.rotation.x = -.35 * e;
      r.hipL.rotation.x = (-.85 * up + .6 * fall) * e;
      r.hipR.rotation.x = (-.65 * up + .5 * fall) * e;
      r.kneeL.rotation.x = (1.15 * up + .5 * fall) * e;
      r.kneeR.rotation.x = (.95 * up + .7 * fall) * e;
      r.hips.position.y = r.hipsBaseY - .1 * up + .3 * fall;
    }
  };

  /* =====================================================================
     THE RING OUT
     Laid over whatever pose the reaction left, so every flinch in the
     game — the five that were already here included — carries past the
     frame it was snapped to and settles instead of stopping.
     ================================================================== */
  function ringOut(r, rc) {
    var q = Math.exp(-rc.t * 6.5);                     // dies away inside a beat
    var side = rc.side || 1;
    var w = Math.sin(rc.t * 29) * q * .19 * side;
    var v = Math.cos(rc.t * 24) * q * .14;
    r.neck.rotation.z += w * 1.35;
    r.neck.rotation.x += v * .9;
    r.spine.rotation.z += w * .5;
    r.spine.rotation.x += v * .4;
    r.shoulderL.rotation.z += -w * .85;
    r.shoulderR.rotation.z += -w * .85;
    r.shoulderL.rotation.x += v * 1.5;
    r.shoulderR.rotation.x += -v * 1.4;
    r.elbowL.rotation.x += -Math.abs(v) * 1.1;
    r.elbowR.rotation.x += -Math.abs(v) * 1.0;
    /* the knees take the weight back over the same beat */
    var dip = Math.abs(q * Math.sin(rc.t * 21)) * .3;
    r.kneeL.rotation.x += dip; r.kneeR.rotation.x += dip * .8;
    r.hips.position.y -= dip * .45;
  }

  var _applyReact = Enemy.prototype.applyReact;
  Enemy.prototype.applyReact = function (dt) {
    var rc = this.react;
    if (!rc) return;
    var fn = EXTRA[rc.type];
    if (!fn) {                                        // one of the originals
      _applyReact.call(this, dt);
      if (this.react) ringOut(this.rig, this.react);
      return;
    }
    rc.t += dt;
    if (rc.t >= rc.dur) { this.react = null; return; }
    var k = rc.t / rc.dur;
    fn(this.rig, k, 1 - k * k * (3 - 2 * k), Math.min(1, rc.t * 15), rc.side || 1, this.animT);
    ringOut(this.rig, rc);
  };

  /* =====================================================================
     PUTTING ONE ON SOMEBODY
     ================================================================== */
  function react(ent, type, dur, side) {
    if (!ent) return;
    var rc = { type: type, t: 0, dur: dur || .5, side: side || (Math.random() < .5 ? -1 : 1) };
    if (ent === player) {
      if (player.dead) return;
      if (player.action && player.action.type === 'kb') return;   // the throw animates itself
      player.react = rc;
    } else {
      if (ent.dead) return;
      ent.react = rc;
    }
  }
  H.react = react;

  /* an attack that wants a particular reaction out of the next thing it
     hurts the player with — hurtPlayer never took options */
  var pending = null;
  H.next = function (type, dur) { pending = { type: type, dur: dur || .5, at: nowS() }; };
  function nowS() { return (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000; }

  /* =====================================================================
     THE FLASH
     A body that has just been hit goes white for two frames. It is the
     cheapest hit confirm there is and the game never had it.
     ================================================================== */
  var flashing = [];
  function flash(rig, color, power) {
    if (!rig || !rig.root) return;
    var mats = [];
    rig.root.traverse(function (o) {
      if (o.isMesh && o.material && o.material.emissive) mats.push(o.material);
    });
    if (!mats.length) return;
    if (flashing.length > 6) flashing.shift();
    var st = { mats: mats, t: 0, dur: .12 + .1 * (power || 1),
      keep: mats.map(function (m) { return m.emissive.getHex(); }) };
    flashing.push(st);
    mats.forEach(function (m) { m.emissive.setHex(color == null ? 0xffffff : color); });
  }
  addFx({ t: 1e9, update: function (dt) {
    for (var i = flashing.length - 1; i >= 0; i--) {
      var f = flashing[i];
      f.t += dt;
      var k = 1 - f.t / f.dur;
      for (var j = 0; j < f.mats.length; j++) {
        f.mats[j].emissiveIntensity = Math.max(0, k) * 1.15;
        if (k <= 0) f.mats[j].emissive.setHex(f.keep[j]);
      }
      if (k <= 0) flashing.splice(i, 1);
    }
    return true;
  } });
  H.flash = flash;

  /* =====================================================================
     WIRING — enemies
     ================================================================== */
  var _damage = Enemy.prototype.damage;
  Enemy.prototype.damage = function (amount, knock, opts) {
    opts = opts || {};
    var was = this.hp;
    _damage.call(this, amount, knock, opts);
    if (this.dead && was <= 0) return;
    var power = Math.min(1.8, .5 + amount / 30);
    flash(this.rig, opts.spark || 0xffffff, power);
    /* a cut bleeds, and it bleeds along the way the cut went */
    if (opts.react === 'slash' || opts.react === 'dismantle' || opts.bleed) {
      var d = knock ? knock.clone().setY(.4).normalize() : new THREE.Vector3(0, 1, 0);
      FX.blood(this.pos.clone().add(new THREE.Vector3(0, 2.7, 0)), d, 5 + Math.round(amount / 8), 1.1);
    }
    if (opts.react === 'burn') {
      FX.fire(this.pos.clone().add(new THREE.Vector3(0, 2, 0)), 5, 1, 2, .6);
    }
  };

  /* =====================================================================
     WIRING — the player, in every mode
     ================================================================== */
  var _hurtPlayer = hurtPlayer;
  var alt = 0;
  hurtPlayer = function (amount, knock) {
    var before = player.hp, wasDead = player.dead;
    _hurtPlayer(amount, knock);
    if (player.dead && !wasDead) { pending = null; return; }
    if (player.hp === before) { pending = null; return; }   // shrugged off
    if (player.action && player.action.type === 'kb') { pending = null; return; }

    var power = knock ? knock.length() : 0;
    var type, dur;
    if (pending && nowS() - pending.at < .5) {
      type = pending.type; dur = pending.dur;
    } else if (power < 4) {
      type = (alt++ % 2) ? 'head' : 'pummel'; dur = .34;
    } else if (power < 10) {
      type = (alt++ % 2) ? 'gut' : 'whip'; dur = .44;
    } else {
      type = (alt++ % 2) ? 'stagger' : 'crumple'; dur = .6;
    }
    pending = null;
    react(player, type, dur, knock && knock.x < 0 ? -1 : 1);
    flash(player.rig, 0xff6a72, Math.min(1.6, .6 + amount / 26));
    if (type === 'slash' || type === 'dismantle') {
      FX.blood(player.pos.clone().add(new THREE.Vector3(0, 2.7, 0)),
        knock ? knock.clone().setY(.4).normalize() : new THREE.Vector3(0, 1, 0), 6, 1.2);
    }
  };
})();
