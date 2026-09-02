/* =======================================================================
   COMBAT FEEL
   Three changes to the fight itself, plus a pass over the hit effects:

     · the dash covers real ground instead of a nudge
     · a heavy hit throws you, and the throw is animated and shared, so
       every screen sees the same tumble
     · you cannot swap fighter mid brawl — pressing C starts an eight
       second wind-down, and being hit puts you back in combat and
       restarts it

   Everything is applied by wrapping the game's own functions, so the
   original stays readable and this file can be lifted out.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;

  var C = window.JJCOMBAT = {
    dash: { speed: 41, time: .30, iframes: .17 },
    switchWait: 8,
    swPending: null,           // the fighter you asked to become
    swT: 0,                    // seconds left before the swap happens
    swHit: 0,                  // flashes the timer red when combat resets it
    combatT: 0                 // >0 means recently hit
  };

  /* resetPose only clears the joints. Whatever leans the whole body has to
     clear it again itself — the enemies already decay it, and the flung
     ragdoll accumulates into it deliberately, so clearing it here would
     flatten the tumble the game already had. */

  /* =====================================================================
     DASH — a real burst of ground, held for a fraction of a second
     The old dash was a single velocity impulse against a drag of 10, so
     it died in about two metres. This drives the velocity for the length
     of the dash instead, which is what makes it read as a dash.
     ================================================================== */
  var _doDash = doDash;
  doDash = function () {
    if (player.dead || busy() || player.dashCh < 1) return;
    var fwd = camForward();
    var right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    var mv = new THREE.Vector3();
    if (keys['KeyW']) mv.add(fwd);
    if (keys['KeyS']) mv.sub(fwd);
    if (keys['KeyD']) mv.add(right);
    if (keys['KeyA']) mv.sub(right);
    if (mv.lengthSq() === 0) mv.copy(fwd);
    mv.normalize();

    player.dashCh -= 1;
    player.dashDir = mv;
    player.dashT = C.dash.time;
    player.iframes = Math.max(player.iframes, C.dash.iframes);
    player.vel.x = mv.x * C.dash.speed;
    player.vel.z = mv.z * C.dash.speed;
    try { sfx.dash(); } catch (e) {}

    var tint = player.char === 'naoya' ? 0x9fd8ff : 0x4a7dff;
    var mid = player.pos.clone().add(new THREE.Vector3(0, 2.6, 0));
    if (FX) {
      FX.speedRing(mid, tint, 7, .3);
      FX.trail(player.rig, tint, 5, 42, .40);
      FX.ring(new THREE.Vector3(player.pos.x, .1, player.pos.z), tint,
        { maxR: 5, life: .32, ground: true });
      FX.dust(player.pos.clone(), 4, 0xc9d3e2, 5, 2);
      FX.slash(mid.clone().addScaledVector(mv, -1.2), mv.clone().negate(), tint, 3.4, .22);
      FX.zoom(-5, .3);
    } else {
      ghostAfterimage(player.rig, tint);
    }
  };

  /* =====================================================================
     KNOCKBACK
     A heavy hit becomes an action, which means the game already does the
     hard parts for us: movement is locked out, the cast is interrupted,
     the pose runs through poseAction and — because mp.js broadcasts the
     current action every tick — the other clients play the same tumble.
     ================================================================== */
  var KB_MIN = 17;             // impulse below this is only a flinch

  function launch(power) {
    var dur = Math.min(1.25, .62 + power / 90);
    player.action = { type: 'kb', t: 0, dur: dur, land: 0, pw: Math.min(2, power / 40) };
    player.visYaw = 0;
    player.onGround = false;
    player.dashT = 0;
    player.comboN = 0;
  }

  var _hurtPlayer = hurtPlayer;
  hurtPlayer = function (amount, knock) {
    if (player.dead || player.iframes > 0) return;
    var before = player.hp;
    _hurtPlayer(amount, knock);
    if (player.hp === before && !player.dead) return;      // shrugged off

    /* being hit is what "in combat" means: a pending fighter swap goes
       back to the full wait */
    C.combatT = C.switchWait;
    if (C.swPending) { C.swT = C.switchWait; C.swHit = .8; }

    var power = knock ? knock.length() : 0;
    var at = player.pos.clone().add(new THREE.Vector3(0, 2.9, 0));
    if (FX) FX.heavyHit(at, 0xff5f6d, Math.min(1.6, .7 + power / 55));
    if (power >= KB_MIN && !player.dead && player.frameT <= 0) {
      launch(power);
      if (FX) {
        FX.zoom(7, .32);
        FX.mangaLines(true, .35);
      }
    }
  };

  /* the same treatment for anything the player hits */
  var _enemyDamage = Enemy.prototype.damage;
  Enemy.prototype.damage = function (amount, knock, opts) {
    var was = this.hp;
    _enemyDamage.call(this, amount, knock, opts);
    if (this.dead && was <= 0) return;
    var power = knock ? knock.length() : 0;
    var at = this.pos.clone().add(new THREE.Vector3(0, 2.9, 0));
    if (FX) FX.heavyHit(at, (opts && opts.spark) || 0xffd76a, Math.min(1.7, .6 + power / 55));
    if (power >= KB_MIN) {
      this.react = { type: 'blow', t: 0, dur: Math.min(1.2, .6 + power / 90),
        side: (opts && opts.side) || 1 };
      if (FX) FX.dust(new THREE.Vector3(this.pos.x, 0, this.pos.z), 5, 0xd7dde8, 7, 2.4);
    }
  };

  /* the flung pose, for dummies and for other players' rigs */
  var _applyReact = Enemy.prototype.applyReact;
  Enemy.prototype.applyReact = function (dt) {
    if (!this.react || this.react.type !== 'blow') return _applyReact.call(this, dt);
    var rc = this.react;
    rc.t += dt;
    if (rc.t >= rc.dur) { this.react = null; return; }
    poseBlown(this.rig, rc.t / rc.dur, rc.side || 1);
  };

  /* Arched over the impact, arms and legs trailing, then a heavy landing
     and a scramble back up. One curve drives all of it so it reads as a
     single move rather than three poses. */
  function poseBlown(r, k, side) {
    if (!r) return;
    var air = Math.min(1, k / .55);
    var land = k > .55 ? (k - .55) / .45 : 0;
    var snap = Math.min(1, k * 12);
    var recover = 1 - land;

    if (r.body) {
      r.body.rotation.x = (-.95 * air + 1.15 * land) * recover + .34 * land;
      r.body.rotation.z = .28 * side * snap * recover;
    }
    r.spine.rotation.x = -.55 * snap * recover + .5 * land;
    r.spine.rotation.y = .3 * side * snap * recover;
    r.neck.rotation.x = -.5 * snap * recover + .32 * land;
    r.neck.rotation.z = .3 * side * snap * recover;

    /* arms whipped behind on the way out, thrown forward on the landing */
    r.shoulderL.rotation.x = (-2.1 * air + 1.5 * land) * snap;
    r.shoulderR.rotation.x = (-2.05 * air + 1.45 * land) * snap;
    r.shoulderL.rotation.z = (-.65 + .3 * land) * snap;
    r.shoulderR.rotation.z = (.65 - .3 * land) * snap;
    r.elbowL.rotation.x = (-.35 - .7 * land) * snap;
    r.elbowR.rotation.x = (-.3 - .75 * land) * snap;

    r.hipL.rotation.x = (-.75 * air + .55 * land) * snap;
    r.hipR.rotation.x = (-.5 * air + .35 * land) * snap;
    r.kneeL.rotation.x = (.95 * air + .55 * land) * snap;
    r.kneeR.rotation.x = (.7 * air + .95 * land) * snap;
    r.hips.position.y = r.hipsBaseY - (.15 * air + .55 * land) * snap;
  }
  window.JJPOSE = { blown: poseBlown };

  /* the player's own tumble, driven as an action */
  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    if (a.type !== 'kb') return _stepAction(a, dt);
    var k = a.t / a.dur;
    /* leave the ground on the way out, scrape along on the way down */
    if (!player.onGround && player.vel.y < 0 && player.pos.y <= .05 && !a.land) {
      a.land = 1;
      if (FX) {
        FX.dust(new THREE.Vector3(player.pos.x, 0, player.pos.z), 7, 0xd7dde8, 9, 3);
        FX.ring(new THREE.Vector3(player.pos.x, .1, player.pos.z), 0xbcc6d8,
          { maxR: 6 * a.pw, life: .4, ground: true });
        FX.cracks(player.pos.clone(), 4, 5 * a.pw);
      }
      addShake(.25);
    }
    if (k > .1 && k < .6 && Math.random() < .4 && FX) {
      FX.streaks(player.pos.clone().add(new THREE.Vector3(0, 2, 0)), 0xff7f8c, 1, 9, .7);
    }
  };

  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (a.type !== 'kb') return _poseAction(r, a);
    poseBlown(r, Math.min(1, a.t / a.dur), a.side || 1);
  };

  /* =====================================================================
     FIGHTER SWAP — eight seconds out of combat
     ================================================================== */
  var _switchChar = switchChar;
  switchChar = function (id, quiet) {
    if (!CHARS[id]) return;
    if (!started) return _switchChar(id, true);
    if (window.JJAW && window.JJAW.active) {
      notice('CANNOT SWITCH WHILE AWAKENED', '#ff6b7f');
      return;
    }
    if (id === player.char) {                    // pressing back cancels
      if (C.swPending) { C.swPending = null; renderSwap(); }
      return;
    }
    if (C.swPending === id) { C.swPending = null; renderSwap(); return; }
    C.swPending = id;
    C.swT = C.switchWait;
    C.swHit = 0;
    renderSwap();
    notice('SWITCHING TO ' + CHARS[id].name.split(' ')[0] + ' \u2014 STAY OUT OF COMBAT', '#9fd8ff');
  };

  function doSwap() {
    var id = C.swPending;
    C.swPending = null;
    renderSwap();
    if (!id || !CHARS[id]) return;
    var tint = id === 'naoya' ? 0x9fd8ff : 0x3a7dff;
    if (FX) {
      FX.trail(player.rig, tint, 3, 40, .5);
      FX.cross(player.pos.clone().add(new THREE.Vector3(0, 3, 0)), tint, 4, .3);
      FX.ring(new THREE.Vector3(player.pos.x, .1, player.pos.z), tint, { maxR: 8, life: .45 });
      FX.flash('#dfefff', .35, .3);
    }
    _switchChar(id);
  }

  /* ---------------------------------------------------------------- HUD */
  var swapEl = null, noticeEl = null;
  function buildHud() {
    if (swapEl) return;
    var css = document.createElement('style');
    css.textContent = [
      '#jjSwap{position:fixed;left:50%;bottom:186px;transform:translateX(-50%);z-index:9;',
      '  display:none;pointer-events:none;text-align:center;font-family:"Finger Paint","Segoe UI",cursive}',
      '#jjSwap .lbl{font-size:11px;letter-spacing:3px;color:#cfe2ff;text-shadow:0 1px 4px #000}',
      '#jjSwap .num{font-size:26px;letter-spacing:2px;color:#fff;text-shadow:0 0 14px #3a7dff,0 1px 4px #000;',
      '  line-height:1.1}',
      '#jjSwap .track{width:190px;height:5px;margin:4px auto 0;border:1.5px solid #fff;border-radius:3px;',
      '  background:rgba(0,0,0,.4);overflow:hidden}',
      '#jjSwap .fill{height:100%;width:0%;background:#9fd8ff;transition:width .1s linear}',
      '#jjSwap.hit .num{color:#ff8b98;text-shadow:0 0 16px #ff2f45,0 1px 4px #000}',
      '#jjSwap.hit .fill{background:#ff6b7f}',
      '#jjSwap.hit{animation:jjShake .28s}',
      '@keyframes jjShake{0%,100%{transform:translateX(-50%)}',
      '  25%{transform:translateX(-50%) translateX(-7px)}75%{transform:translateX(-50%) translateX(7px)}}',
      '#jjNotice{position:fixed;left:50%;top:19%;transform:translateX(-50%);z-index:11;',
      '  font-family:"Finger Paint","Segoe UI",cursive;font-size:15px;letter-spacing:3px;',
      '  text-shadow:0 1px 6px #000;opacity:0;transition:opacity .25s;pointer-events:none;white-space:nowrap}'
    ].join('');
    document.head.appendChild(css);
    swapEl = document.createElement('div');
    swapEl.id = 'jjSwap';
    swapEl.innerHTML = '<div class="lbl">SWITCHING FIGHTER</div><div class="num">8.0</div>' +
      '<div class="track"><div class="fill"></div></div>';
    document.body.appendChild(swapEl);
    noticeEl = document.createElement('div');
    noticeEl.id = 'jjNotice';
    document.body.appendChild(noticeEl);
  }

  var noticeT = 0;
  function notice(text, color) {
    buildHud();
    noticeEl.textContent = text;
    noticeEl.style.color = color || '#fff';
    noticeEl.style.opacity = '1';
    noticeT = 2.2;
  }
  window.JJNOTICE = notice;

  function renderSwap() {
    buildHud();
    swapEl.style.display = C.swPending ? 'block' : 'none';
    if (C.swPending) {
      swapEl.querySelector('.lbl').textContent = 'SWITCHING TO ' + CHARS[C.swPending].name.split(' ')[0];
    }
  }

  function stepSwap(dt) {
    if (noticeT > 0) {
      noticeT -= dt;
      if (noticeT <= 0 && noticeEl) noticeEl.style.opacity = '0';
    }
    if (C.combatT > 0) C.combatT = Math.max(0, C.combatT - dt);
    if (C.swHit > 0) {
      C.swHit -= dt;
      if (swapEl) swapEl.classList.add('hit');
      if (C.swHit <= 0 && swapEl) swapEl.classList.remove('hit');
    }
    if (!C.swPending) return;
    C.swT -= dt;
    if (swapEl) {
      swapEl.querySelector('.num').textContent = Math.max(0, C.swT).toFixed(1);
      swapEl.querySelector('.fill').style.width = (100 - C.swT / C.switchWait * 100) + '%';
    }
    if (C.swT <= 0) doSwap();
  }

  /* =====================================================================
     PER FRAME
     ================================================================== */
  var _updatePlayer = updatePlayer;
  updatePlayer = function (dt) {
    /* a dash drives the velocity itself; the movement code would otherwise
       drag it back to walking pace within two frames */
    var dashing = player.dashT > 0 && !player.dead;
    if (dashing) {
      player.dashT -= dt;
      player.vel.x = player.dashDir.x * C.dash.speed;
      player.vel.z = player.dashDir.z * C.dash.speed;
    }
    var kb = player.action && player.action.type === 'kb' ? player.vel.clone() : null;
    var wasThrown = !!kb;

    _updatePlayer(dt);

    /* the throw leans the whole body, and nothing else would straighten it */
    if (wasThrown && !(player.action && player.action.type === 'kb') && player.rig.body) {
      player.rig.body.rotation.set(0, 0, 0);
    }

    if (dashing && player.dashT > 0) {
      player.vel.x = player.dashDir.x * C.dash.speed;
      player.vel.z = player.dashDir.z * C.dash.speed;
      if (Math.random() < .6 && FX) {
        FX.streaks(player.pos.clone().add(new THREE.Vector3(0, 1.6 + Math.random() * 2, 0)),
          player.char === 'naoya' ? 0x9fd8ff : 0x6f9cff, 1, 7, .8);
      }
    }
    /* being thrown keeps its momentum instead of being dragged to a stop */
    if (kb) {
      var decay = Math.pow(.30, dt);
      player.vel.x = kb.x * decay;
      player.vel.z = kb.z * decay;
    }
    stepSwap(dt);
  };

  /* =====================================================================
     THE EFFECTS PASS
     The game's own three helpers are re-pointed at the kit, which upgrades
     every existing move at once: a torus becomes a ring with a hard edge,
     round sparks become streaks that follow their own velocity, and the
     Red explosion stops being a sphere that inflates.
     ================================================================== */
  if (FX) {
    ringWave = function (pos, color, maxR, life, up) {
      FX.ring(pos.clone(), color, { maxR: maxR || 10, life: life || .5, ground: !up });
    };

    spark = function (pos, color, n, spd, size) {
      FX.streaks(pos.clone(), color, n || 6, spd || 14, (size || 1.4) * .7);
      if ((n || 6) >= 14) FX.impact(pos.clone(), color, Math.min(1.6, (n || 6) / 18));
    };

    /* Reversal: Red, rebuilt — a cross frame, a shock front and rubble,
       with the original's damage untouched */
    explodeRed = function (pos) {
      try { sfx.redBoom(); } catch (e) {}
      addShake(1);
      hitstop(.09);
      FX.flash('#ffd9dd', .28, .3);
      FX.cross(pos.clone(), 0xffd0d4, 8, .32);
      FX.impact(pos.clone(), 0xff3b4d, 2.6);
      FX.rings(pos.clone(), 0xff3344, 3, { maxR: 19, life: .55, ground: false, gap: 42 });
      FX.ring(new THREE.Vector3(pos.x, .1, pos.z), 0xff7788, { maxR: 21, life: .65 });
      FX.dust(new THREE.Vector3(pos.x, 0, pos.z), 10, 0xe4d3d6, 13, 3.8);
      FX.debris(new THREE.Vector3(pos.x, 0, pos.z), 11, 17);
      FX.cracks(new THREE.Vector3(pos.x, 0, pos.z), 8, 12);
      FX.zoom(8, .4);
      FX.mangaLines(true, .28);

      enemiesNear(pos, 15).forEach(function (e) {
        var d = e.pos.clone().add(new THREE.Vector3(0, 2.5, 0)).sub(pos);
        var dist = d.length();
        var kb = d.normalize().multiplyScalar(46 * (1.25 - dist / 15 * .6));
        kb.y = Math.max(kb.y, 15);
        e.damage(32, kb, { color: '#ff5566', spark: 0xff3344 });
      });
      crates.forEach(function (c) {
        var d = c.mesh.position.clone().sub(pos);
        if (d.length() < 15) {
          c.vel.add(d.normalize().multiplyScalar(30).setY(18));
          c.av.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
        }
      });
    };
  }

})();
