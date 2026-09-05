/* =======================================================================
   THE DASH
   Rebuilt on the one from The Strongest Battlegrounds, for Gojo, Yuji and
   Hakari. Naoya keeps his — two charges, any direction, no commitment —
   because that is his whole gimmick and this is not.

   What that game actually does, and what this now does:

     · Q, and the direction comes from what you are holding. Nothing or W
       is a forward dash, S is a back dash, A or D is a side dash.
     · Forward and back share one cooldown. The side dash has its own,
       much shorter one. That split is the whole design: the forward dash
       is a commitment you spend, the side dash is the tool you fight
       with, and they never take each other's cooldown away.
     · Forward and back cover about half as much ground again as a side
       dash does.
     · A side dash gets shorter as your health goes, so it stops being a
       way to run a fight out once you are losing it.
     · It is a commitment. For the length of it you are moving where you
       pointed and nowhere else, and it has its own animation — three of
       them, one per direction, rather than a run cycle sliding sideways.
     · It cancels the recovery of a move, not its start. Throw something,
       and once it is past the point where it can miss you can leave
       early — which is where the combos in that game come from.
     · And it can be cancelled *into* a move, so a dash that closes the
       distance can be spent on an ability the moment it lands you.

   The numbers are that game's, brought down to the size of this arena:
   its five and two seconds are four and one point seven here, because
   this is a smaller map with a faster kit, and its four and a half tiles
   against three is kept as fourteen metres against nine and a half.

   Each of the three does it in their own way, which is the last thing
   that game does: same system, different animation and different colour
   coming off it.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX) return;
  var E = FX.ease;

  /* forward and back share a track; the side dash has its own */
  var KIND = {
    fwd:  { line: true,  cd: 4.0, dist: 14.0, time: .30 },
    back: { line: true,  cd: 4.0, dist: 12.5, time: .28 },
    side: { line: false, cd: 1.7, dist: 9.5,  time: .24 }
  };

  /* same system, three different fighters doing it */
  var STYLE = {
    gojo: {
      color: 0x4a7dff, trail: 0x9fd8ff, ghosts: 5, iframes: .20,
      glide: .0, dust: false,
      /* space stops applying to him rather than him running through it */
      open: function (at, dir) {
        FX.speedRing(at, 0x6fb4ff, 7, .3);
        FX.ring(new THREE.Vector3(at.x, .1, at.z), 0x4a7dff, { maxR: 5, life: .3 });
        FX.mote(at, 0x9fd8ff, 4, .3);
      },
      shut: function (at, dir) {
        FX.ring(at, 0x6fb4ff, { maxR: 4, life: .25, ground: false, axis: dir });
      }
    },
    yuji: {
      color: 0xff8a9a, trail: 0xffd0da, ghosts: 4, iframes: .15,
      glide: .0, dust: true,
      /* no technique: it is a man running, so the floor knows about it */
      open: function (at, dir) {
        FX.dust(new THREE.Vector3(at.x, 0, at.z), 6, 0xc9bda6, 7, 2.4);
        FX.cracks(new THREE.Vector3(at.x, 0, at.z), 3, 3.4, 0x2a2018);
        FX.slash(at.clone().addScaledVector(dir, -1), dir.clone().negate(), 0xffd0da, 3, .2);
      },
      shut: function (at, dir) {
        FX.dust(new THREE.Vector3(at.x, 0, at.z), 4, 0xc9bda6, 6, 2.2);
      }
    },
    hakari: {
      color: 0xffd964, trail: 0xffe27a, ghosts: 4, iframes: .17,
      glide: .22, dust: false,
      /* the parlour floor is polished, and he is still on it */
      open: function (at, dir) {
        FX.speedRing(at, 0xffd964, 8, .3);
        FX.ring(new THREE.Vector3(at.x, .1, at.z), 0xffe27a, { maxR: 6, life: .35 });
      },
      shut: function (at, dir) {
        FX.ring(new THREE.Vector3(at.x, .1, at.z), 0xffd964, { maxR: 4.4, life: .3 });
        FX.streaks(at, 0xffe27a, 3, 8, .9);
      }
    }
  };

  var D = window.JJDASH = {
    line: 0, side: 0,             // the two cooldowns, counting down
    last: null,
    mine: function () { return !!STYLE[player.char]; }
  };

  /* =====================================================================
     WHICH DASH
     Read straight off what is held, against where the camera is looking.
     ================================================================== */
  function want() {
    var fwd = camForward();
    var right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    var mv = new THREE.Vector3();
    if (keys['KeyW']) mv.add(fwd);
    if (keys['KeyS']) mv.sub(fwd);
    if (keys['KeyD']) mv.add(right);
    if (keys['KeyA']) mv.sub(right);
    if (mv.lengthSq() === 0) return { kind: 'fwd', dir: fwd.clone(), side: 0 };
    mv.normalize();
    var along = mv.dot(fwd);
    if (along > .45) return { kind: 'fwd', dir: mv, side: 0 };
    if (along < -.45) return { kind: 'back', dir: mv, side: 0 };
    return { kind: 'side', dir: mv, side: mv.dot(right) >= 0 ? 1 : -1 };
  }

  function coolOf(kind) { return KIND[kind].line ? D.line : D.side; }

  /* =====================================================================
     WHAT A DASH IS ALLOWED TO INTERRUPT
     Its start is a commitment, its recovery is not. Anything with a
     camera on it is neither.
     ================================================================== */
  var UNCANCELLABLE = {
    kb: 1, void: 1, nrush: 1, yaw: 1, awaken: 1, dash: 1,
    aw_domain: 1, h4: 1, s4: 1
  };
  function canCancel() {
    var a = player.action;
    if (!a) return true;
    if (UNCANCELLABLE[a.type]) return false;
    /* past the point where it could still miss: the recovery is yours */
    return a.t > a.dur * .55;
  }

  /* =====================================================================
     THE DASH ITSELF
     ================================================================== */
  function dash() {
    if (player.dead || player.frameT > 0) return false;
    if (window.JJFIN && window.JJFIN.on()) return false;
    var w = want();
    var k = KIND[w.kind];
    if (coolOf(w.kind) > 0) return false;
    if (!canCancel()) return false;

    var st = STYLE[player.char] || STYLE.gojo;
    var dist = k.dist;
    /* a side dash gets shorter as the health does — you do not get to run
       a fight out on the thing you were winning it with */
    if (!k.line) dist *= .62 + .38 * Math.max(0, player.hp / player.maxHp);

    if (k.line) D.line = k.cd; else D.side = k.cd;
    D.last = w.kind;

    var was = player.action;
    player.action = {
      type: 'dash', t: 0, dur: k.time,
      kind: w.kind, side: w.side, speed: dist / k.time,
      dx: w.dir.x, dz: w.dir.z, st: player.char,
      cancelled: was ? was.type : null
    };
    player.visYaw = 0;
    player.dashT = 0;                       // the old driver stays out of it
    player.iframes = Math.max(player.iframes, st.iframes);
    player.comboN = 0;
    player.vel.x = 0;
    player.vel.z = 0;

    var at = player.pos.clone().add(new THREE.Vector3(0, 2.4, 0));
    FX.trail(player.rig, st.trail, st.ghosts, 34, .42);
    FX.zoom(-4, .26);
    try { st.open(at, w.dir); } catch (e) {}
    try { sfx.dash(); } catch (e) {}
    /* the one it broke out of gets a note of its own */
    if (was && FX) FX.streaks(at, st.trail, 4, 11, .9);
    return true;
  }

  /* the old dash stays exactly where it was for Naoya */
  var _doDash = doDash;
  doDash = function () {
    if (!D.mine()) return _doDash();
    dash();
  };

  /* =====================================================================
     THE THREE POSES
     A dash is not a run cycle played sideways. Forward is a body thrown
     ahead of its own feet; back is a skid with the weight behind it; a
     side dash keeps the shoulders where they were and takes the legs
     across underneath.
     ================================================================== */
  function poseDash(r, a) {
    resetPose(r);
    if (r.body) r.body.rotation.set(0, 0, 0);
    var k = Math.min(1, a.t / Math.max(.001, a.dur));
    var out = E.out(Math.min(1, k / .3));            // snaps into it
    var back = k > .62 ? (k - .62) / .38 : 0;        // and comes out of it
    var hold = out * (1 - back * .82);
    var s = a.side || 1;

    if (a.kind === 'fwd') {
      r.spine.rotation.x = .62 * hold;
      r.neck.rotation.x = -.5 * hold;
      r.shoulderL.rotation.x = 1.5 * hold;           // arms left behind
      r.shoulderR.rotation.x = 1.35 * hold;
      r.shoulderL.rotation.z = -.3 * hold;
      r.shoulderR.rotation.z = .3 * hold;
      r.elbowL.rotation.x = -.45 * hold;
      r.elbowR.rotation.x = -.4 * hold;
      r.hipL.rotation.x = -1.15 * hold;              // one knee up and through
      r.kneeL.rotation.x = 1.5 * hold;
      r.hipR.rotation.x = .85 * hold;                // the other trailing
      r.kneeR.rotation.x = .5 * hold;
      r.hips.position.y = r.hipsBaseY - .42 * hold;
    } else if (a.kind === 'back') {
      r.spine.rotation.x = -.55 * hold;
      r.neck.rotation.x = .42 * hold;
      r.shoulderL.rotation.x = -1.5 * hold;          // hands up in front
      r.shoulderR.rotation.x = -1.45 * hold;
      r.shoulderL.rotation.z = .5 * hold;
      r.shoulderR.rotation.z = -.5 * hold;
      r.elbowL.rotation.x = -.9 * hold;
      r.elbowR.rotation.x = -.95 * hold;
      r.hipL.rotation.x = -.95 * hold;               // feet skidding out ahead
      r.kneeL.rotation.x = .35 * hold;
      r.hipR.rotation.x = -.6 * hold;
      r.kneeR.rotation.x = .8 * hold;
      r.hips.position.y = r.hipsBaseY - .55 * hold;
    } else {
      /* the shoulders stay pointed where they were looking */
      r.spine.rotation.z = -.42 * s * hold;
      r.spine.rotation.y = .3 * s * hold;
      r.neck.rotation.z = .28 * s * hold;
      r.neck.rotation.y = -.35 * s * hold;
      r.shoulderL.rotation.z = (.5 - .95 * (s > 0 ? 1 : 0)) * hold;
      r.shoulderR.rotation.z = (-.5 + .95 * (s < 0 ? 1 : 0)) * hold;
      r.shoulderL.rotation.x = -.7 * hold;
      r.shoulderR.rotation.x = -.65 * hold;
      r.elbowL.rotation.x = -1.05 * hold;
      r.elbowR.rotation.x = -1 * hold;
      /* the lead leg goes across and the trailing one pushes off */
      r.hipL.rotation.z = -.55 * s * hold;
      r.hipR.rotation.z = -.55 * s * hold;
      r.hipL.rotation.x = -.5 * hold;
      r.kneeL.rotation.x = .95 * hold;
      r.hipR.rotation.x = .3 * hold;
      r.kneeR.rotation.x = .35 * hold;
      r.hips.position.y = r.hipsBaseY - .48 * hold;
    }
  }

  /* =====================================================================
     WIRING
     ================================================================== */
  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    if (a.type !== 'dash') return _stepAction(a, dt);
    var st = STYLE[a.st] || STYLE.gojo;
    /* it moves itself. Driving the velocity instead would hand it to the
       movement code's drag, which eats a fifth of it every frame — and
       the world collision still runs afterwards either way. */
    var step = a.speed * dt;
    player.pos.x += a.dx * step;
    player.pos.z += a.dz * step;
    player.vel.x = 0;
    player.vel.z = 0;
    if (st.dust && player.onGround && Math.random() < dt * 26) {
      FX.dust(new THREE.Vector3(player.pos.x, 0, player.pos.z), 1, 0xc9bda6, 4, 1.8);
    }
    if (Math.random() < dt * 22) {
      FX.streaks(player.pos.clone().add(new THREE.Vector3(0, 1.4 + Math.random() * 2.2, 0)),
        st.trail, 1, 8, .8);
    }
    if (a.t + dt >= a.dur && !a.shut) {
      a.shut = 1;
      var at = player.pos.clone().add(new THREE.Vector3(0, 2.2, 0));
      try { st.shut(at, new THREE.Vector3(a.dx, 0, a.dz)); } catch (e) {}
      /* whoever keeps sliding, keeps sliding */
      player.vel.x = a.dx * a.speed * st.glide;
      player.vel.z = a.dz * a.speed * st.glide;
    }
  };

  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (a.type === 'dash') { poseDash(r, a); return; }
    return _poseAction(r, a);
  };

  /* A dash is an action, which is what puts the pose on everybody else's
     screen. But an action is what `busy()` is, and `busy` is a const arrow
     in the original that cannot be wrapped — so leaving a dash early into
     a move is done by taking the action out from under the cast instead.
     A capture phase listener runs before the game's own, which is the
     whole trick: by the time its handler asks, there is nothing to be
     busy with. */
  var OUT = { Digit1: 1, Digit2: 1, Digit3: 1, Digit4: 1, KeyR: 1, KeyF: 1 };
  function leaveEarly() {
    var a = player.action;
    if (!a || a.type !== 'dash') return;
    if (a.t < a.dur * .35) return;                 // not out of the start of it
    player.action = null;
    player.visYaw = 0;
    if (player.rig && player.rig.body) player.rig.body.rotation.set(0, 0, 0);
  }
  window.addEventListener('keydown', function (e) {
    if (!D.mine() || e.repeat) return;
    if (OUT[e.code]) leaveEarly();
  }, true);
  window.addEventListener('mousedown', function (e) {
    if (!D.mine() || e.button !== 0) return;
    leaveEarly();
  }, true);

  /* the two cooldowns, and the readout */
  /* =====================================================================
     THE RUNNING TRAIL
     Every fighter left afterimages behind them at a run. That is Naoya's
     — he is the one who is faster than the frame rate — and on everybody
     else it was just smearing the screen. The trail is spawned inside the
     game's own update off a timer, so the timer is held under the line it
     fires at rather than the call being taken out of a file that is meant
     to stay untouched. Every deliberate afterimage — the dash, Limitless,
     the teleports — is a direct call and is not affected.

     The timer is zeroed rather than driven far negative, because the game
     adds to it and never resets it on a fighter swap: park it at minus a
     billion as somebody else and Naoya inherits that number when you
     switch to him, and his trail never comes back. From zero, one frame of
     `dt` is still well under the gap it fires at, and he starts clean.
     ================================================================== */
  var _updatePlayer = updatePlayer;
  updatePlayer = function (dt) {
    if (player.char !== 'naoya') player.ghostAcc = 0;
    _updatePlayer(dt);
    if (!D.mine() || player.dead) return;
    if (D.line > 0) D.line = Math.max(0, D.line - dt);
    if (D.side > 0) D.side = Math.max(0, D.side - dt);
    /* the bar shows the dash you would get for what you are holding right
       now — hold nothing and it is the forward one, hold A and it is the
       side one — so two cooldowns explain themselves in one box. The
       game's own recharge runs first and is written over here. */
    var w = KIND[want().kind];
    var left = w.line ? D.line : D.side;
    player.dashCh = left <= 0 ? 1 : 1 - left / w.cd;
  };

  /* switching to Naoya hands the charges back; switching away takes them */
  var _switchChar = switchChar;
  switchChar = function (id, quiet) {
    _switchChar(id, quiet);
    if (STYLE[player.char]) { D.line = 0; D.side = 0; player.dashCh = 1; }
  };

  /* somebody else's dash, on their copy of them: the pose comes down the
     wire with the action, so all this owes them is the ground effect */
  D.remote = function (charId, pos, yaw, kind) {
    var st = STYLE[charId] || STYLE.gojo;
    var dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    var at = pos.clone().add(new THREE.Vector3(0, 2.2, 0));
    try { st.open(at, dir); } catch (e) {}
    FX.streaks(at, st.trail, 4, 12, .9);
  };
})();
