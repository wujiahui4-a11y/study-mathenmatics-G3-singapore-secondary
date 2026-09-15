/* Shared combat adapted from the connected Studio's GojoService,
   ItadoriService, BlockService, HitboxService and MovementController.
   Animation is authored here for our voxel rigs; no Roblox assets required. */
(function () {
  'use strict';
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z),
    clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const ease = (n) => {
    n = clamp(n, 0, 1);
    return n * n * (3 - 2 * n);
  };
  const dir = (y) => V(Math.sin(y), 0, Math.cos(y));
  const core = (a) => a && /^bc_/.test(a.type);
  const styles = {
    gojo: { stance: 0.14, twist: 0.36, color: 0xe8f4ff },
    naoya: { stance: 0.24, twist: 0.28, pace: 0.92, damage: 2, color: 0xcfe4ff },
    yuji: { stance: 0.3, twist: 0.5, color: 0xffdbc6 },
    hakari: { stance: 0.4, twist: 0.5, color: 0xffe9ac },
    choso: { stance: 0.22, twist: 0.38, color: 0xebccd0 },
    megumi: { stance: 0.2, twist: 0.35, color: 0xdbe5fa },
    mahito: { stance: 0.32, twist: 0.54, color: 0xe5f6ef },
    todo: { stance: 0.5, twist: 0.62, pace: 1.05, color: 0xffe1b3 },
    higuruma: { stance: 0.17, twist: 0.45, weapon: true, color: 0xe5dac1 },
    yuta: { stance: 0.24, twist: 0.5, weapon: true, color: 0xe3e8ff },
    muta: { stance: 0.26, twist: 0.32, color: 0xe1e8ea },
    ryu: { stance: 0.4, twist: 0.58, color: 0xf0dcff },
    nanami: { stance: 0.18, twist: 0.4, weapon: true, color: 0xf7e7bb },
    hanami: { stance: 0.5, twist: 0.6, pace: 1.07, color: 0xe2eccb }
  };
  const D = {
    front: { cd: 4.5, dur: 0.76, travel: 0.48, distance: 19 },
    back: { cd: 2, dur: 0.4, travel: 0.4, distance: 11 },
    side: { cd: 2, dur: 0.4, travel: 0.4, distance: 10 }
  };
  let held = false,
    queued = 0,
    guardHeld = false,
    noJump = 0,
    sequence = 0,
    frontCD = 0,
    evadeCD = 0,
    seenChar = player.char,
    seenRig = player.rig;
  const received = new Set(),
    history = [];
  const C = (window.JJFIGHT = {
    styles,
    dashConfig: D,
    reset,
    guard,
    clearInput,
    beforeStep,
    motion,
    locked,
    driving: () => player.action?.type === 'bc_fall',
    punch: startM1,
    dash: startDash,
    evasive,
    canEvasive,
    evasiveCooldown: 25,
    pose: poseCore,
    guardPose,
    blocked,
    blockFX,
    networkHit,
    pack,
    unpack,
    actors: { profile, sweepMove, startFall, stepFall, visible },
    audit: () => ({
      frontCD,
      evadeCD,
      ragdollCD: player.evasiveCD || 0,
      held,
      guardHeld,
      combo: player.comboN,
      history: history.slice(-24)
    })
  });
  function log(event) {
    history.push(event);
    if (history.length > 40) history.shift();
  }
  function taken() {
    return (
      player.dead ||
      player.rag ||
      player.frameT > 0 ||
      window.MPJJ?.cs?.active ||
      window.JJAW?.cine ||
      window.JJFIN?.on() ||
      window.JJNAOYA?.busy() ||
      window.JJTODO?.grabbed ||
      window.JJMAHITO?.grabbed
    );
  }
  function locked() {
    return taken() || player.stunT > 0 || player.blocking;
  }
  // A side or back dash is an evade, not a commitment. After a tenth of a
  // second — by which point the eased travel curve has already carried you
  // about 45% of the distance — it can be cancelled straight into M1 or into
  // a skill, so dodging is a way into an attack rather than a pause before
  // one. The front dash is left alone: it IS an attack, and cancelling it
  // would throw away the strike it exists for.
  const EVADE_COMMIT = 0.1;
  const isEvade = (a) => core(a) && a.type === 'bc_dash' && a.kind !== 'front';
  const evadeOpen = (a) => isEvade(a) && a.t >= EVADE_COMMIT;
  C.evadeOpen = () => evadeOpen(player.action);
  function clearInput() {
    held = false;
    queued = 0;
    guardHeld = false;
    player.blocking = false;
  }
  function cancel() {
    if (core(player.action)) player.action = null;
    player.attackT = 0;
    player.visYaw = 0;
    if (player.rig?.body) player.rig.body.rotation.set(0, 0, 0);
  }
  function reset() {
    clearInput();
    cancel();
    frontCD = evadeCD = noJump = 0;
    player.stunT = 0;
    player.comboN = 0;
    player.comboReset = 0;
    player.bcGuardHit = 0;
    player.evasiveCD = 0;
  }
  function guard(on) {
    guardHeld = !!on;
    if (!on) {
      player.blocking = false;
      return false;
    }
    if (
      !gameInputActive() ||
      taken() ||
      player.stunT > 0 ||
      player.action ||
      player.dashT > 0 ||
      player.attackT > 0
    )
      return false;
    player.blocking = true;
    queued = 0;
    return true;
  }
  function motion() {
    const a = player.action;
    return {
      attackWalk: a?.type === 'bc_m1',
      stunned: player.stunT > 0 || !!player.rag,
      speed: player.blocking ? (keys.KeyS ? 2.4 : 3.4) : a?.type === 'bc_m1' ? 4.8 : null,
      noJump: player.blocking || player.stunT > 0 || noJump > 0 || core(a)
    };
  }
  function beforeStep() {
    if (!gameInputActive() || taken()) {
      clearInput();
      return;
    }
    if (guardHeld && !player.blocking) guard(true);
    if (
      !player.blocking &&
      (!player.action || evadeOpen(player.action)) &&
      (held || queued > 0) &&
      cds.m1 <= 0
    )
      startM1();
  }
  function profile(id = player.char, mode = window.JJMAHITO?.mode || 0) {
    const p = { ...(styles[id] || styles.gojo), damage: styles[id]?.damage || 3, reach: 5.1 };
    if (id === 'mahito') {
      if (mode === 1) {
        p.damage = 2;
        p.pace = 0.9;
        p.weapon = true;
      }
      if (mode === 2) {
        p.damage = 4;
        p.pace = 1.12;
        p.reach = 5.6;
      }
    }
    return p;
  }
  function startM1() {
    if (!gameInputActive() || taken() || player.stunT > 0) return false;
    if (player.blocking) {
      if (player.char === 'mahito') return JJMAHITO.withdraw();
      return false;
    }
    if (player.action) {
      if (evadeOpen(player.action)) cancel();
      else {
        // held over from a dash that has not opened yet, or from the tail of
        // a swing, so the input is not simply dropped on the floor
        if (
          isEvade(player.action) ||
          (player.action.type === 'bc_m1' && player.action.t > player.action.dur - 0.16)
        )
          queued = 0.2;
        return false;
      }
    }
    if (cds.m1 > 0) return false;
    const n = player.comboReset > 0 ? player.comboN : 0,
      p = profile(),
      last = n === 3;
    const variant = last ? (!player.onGround ? 'down' : keys.Space ? 'up' : 'normal') : 'normal';
    const start = (last ? 0.18 : 0.12 + n * 0.015) * (p.pace || 1),
      active = 0.16,
      dur = start + active + (last ? 0.26 : 0.12);
    player.action = {
      type: 'bc_m1',
      t: 0,
      dur,
      start,
      active,
      n,
      variant,
      side: n % 2 ? 1 : -1,
      mode: player.char === 'mahito' ? JJMAHITO.mode : 0,
      dir: camForward(),
      hits: new Set(),
      contact: false,
      id: ++sequence
    };
    player.facing = Math.atan2(player.action.dir.x, player.action.dir.z);
    player.comboN = (n + 1) % 4;
    player.comboReset = 1.2;
    cds.m1 = dur;
    player.attackT = 0;
    noJump = Math.max(noJump, 0.5);
    queued = 0;
    try {
      sfx.whoosh();
    } catch (_) {}
    log('m1 ' + (n + 1) + ' ' + variant);
    return true;
  }
  function direction() {
    const f = camForward(),
      r = V(-f.z, 0, f.x),
      v = V();
    if (keys.KeyW) v.add(f);
    if (keys.KeyS) v.sub(f);
    if (keys.KeyD) v.add(r);
    if (keys.KeyA) v.sub(r);
    if (v.lengthSq() < 0.01) v.copy(f);
    v.normalize();
    const along = v.dot(f);
    return {
      kind: along > 0.45 ? 'front' : along < -0.45 ? 'back' : 'side',
      side: v.dot(r) >= 0 ? 1 : -1,
      dir: v
    };
  }
  function startDash() {
    if (player.rag || player.action?.type === 'bc_fall') return evasive(player, direction().dir);
    if (!gameInputActive() || locked()) return false;
    const a = player.action,
      w = direction(),
      p = D[w.kind];
    if ((w.kind === 'front' ? frontCD : evadeCD) > 0) return false;
    if (a) {
      if (a.type !== 'bc_m1' || a.n === 3 || a.t < a.start + a.active) return false;
      cancel();
    }
    if (w.kind === 'front') frontCD = p.cd;
    else evadeCD = p.cd;
    player.action = {
      type: 'bc_dash',
      t: 0,
      dur: p.dur,
      kind: w.kind,
      side: w.side,
      dir: w.dir,
      startPos: player.pos.clone(),
      distance: 0,
      hits: new Set(),
      id: ++sequence,
      strikeAt: null,
      mode: player.char === 'mahito' ? JJMAHITO.mode : 0
    };
    player.dashT = 0;
    player.attackT = 0;
    player.vel.x = player.vel.z = 0;
    player.visYaw = 0;
    queued = 0;
    noJump = Math.max(noJump, p.dur);
    player.comboN = 0;
    player.comboReset = 0;
    try {
      sfx.dash();
    } catch (_) {}
    dashFX(player.pos, w.dir);
    log('dash ' + w.kind);
    return true;
  }
  // The live old binding includes Naoya's charge driver and the parkour hook.
  // All other characters use the new shared directional dash implementation.
  const previousDash = doDash;
  doDash = function () {
    if (player.rag || player.action?.type === 'bc_fall') return evasive(player, direction().dir);
    if (player.char === 'naoya') return previousDash.apply(this, arguments);
    if (window.JJMOVE?.driving()) return false;
    if (window.JJMOVE?.tryKick()) return true;
    return startDash();
  };
  punch = startM1;
  function visible(a, b) {
    if (!window.JJMAP || JJMAP.id !== 'jjs') return true;
    const length = a.distanceTo(b);
    return length < 0.1 || JJJJS.ray(a, b, 0.02) + 0.101 / length >= 1;
  }
  function candidates(a, wide = false) {
    const d = a.dir || dir(player.facing),
      right = V(d.z, 0, -d.x),
      p = profile(player.char, a.mode),
      result = [];
    for (const e of enemies) {
      if (
        e.dead ||
        e.hp <= 0 ||
        e.iframes > 0 ||
        e.rag ||
        e.bcFall ||
        e.mhConsumed ||
        e.cineHold ||
        e.tdHold
      )
        continue;
      const offset = e.pos.clone().sub(player.pos),
        along = offset.dot(d),
        side = Math.abs(offset.dot(right));
      const height = offset.y;
      if (along < 0.25 || along > (wide ? 5.8 : p.reach) || side > (wide ? 2.65 : 2.2)) continue;
      if (a.variant === 'down' ? height > 2 || height < -5 : Math.abs(height) > (wide ? 3.2 : 2.7))
        continue;
      if (!visible(player.pos.clone().add(V(0, 2.7, 0)), e.pos.clone().add(V(0, 2.6, 0)))) continue;
      result.push(e);
    }
    return result;
  }
  function blocked(actor, meta) {
    if (
      !meta?.guardable ||
      meta.breakGuard ||
      !actor.blocking ||
      actor.dead ||
      actor.rag ||
      actor.bcFall ||
      actor.stunT > 0
    )
      return false;
    const toward = meta.source?.clone().sub(actor.pos).setY(0);
    return !!toward && toward.lengthSq() > 0.001 && dir(actor.facing || 0).dot(toward.normalize()) > 0;
  }
  function blockFX(actor) {
    actor.bcGuardHit = 0.18;
    const f = dir(actor.facing || 0),
      at = actor.pos
        .clone()
        .add(V(0, 3.2, 0))
        .addScaledVector(f, 1);
    JJFX.ring(at, 0xffecc6, { maxR: 1.15, life: 0.18, ground: false, axis: f });
    try {
      sfx.punch();
    } catch (_) {}
    if (actor === player) addShake(0.055);
  }
  function impact(at, d, color, heavy) {
    // Retain the glowing contact ring; no blue spokes or energy-ball burst.
    JJFX.ring(at, color, { maxR: heavy ? 2 : 1.15, life: heavy ? 0.25 : 0.17, ground: false, axis: d });
    try {
      sfx.punch();
    } catch (_) {}
    hitstop(heavy ? 0.045 : 0.025);
    addShake(heavy ? 0.13 : 0.045);
  }
  function dashFX(pos, d) {
    JJFX.dust(pos.clone(), 3, 0xbec4c7, 3.5, 1.1);
    JJFX.slash(
      pos
        .clone()
        .add(V(0, 1.9, 0))
        .addScaledVector(d, -1),
      d.clone().negate(),
      0xe8edf0,
      2.1,
      0.13
    );
  }
  function strike(a, dash = false) {
    const p = profile(player.char, a.mode),
      last = !dash && a.n === 3;
    if (last && !a.worldHit) {
      a.worldHit = true;
      cds.m1 = Math.max(cds.m1, 1.5);
      window.JJDESTRUCT?.hit(
        player.pos
          .clone()
          .add(V(0, a.variant === 'down' ? 0.6 : 2.6, 0))
          .addScaledVector(a.dir, 3.3),
        3.2
      );
    }
    for (const e of candidates(a, dash || last)) {
      if (a.hits.has(e)) continue;
      a.hits.add(e);
      const power = last ? (a.variant === 'up' ? 3 : a.variant === 'down' ? 1 : 27) : dash ? 6 : 2.6;
      const y = last ? (a.variant === 'up' ? 24 : a.variant === 'down' ? -17 : 9) : 0.35;
      const knock = a.dir.clone().multiplyScalar(power).setY(y);
      const meta = {
        guardable: true,
        breakGuard: a.variant === 'down' || (player.char === 'mahito' && a.mode === 2 && a.n >= 2),
        source: player.pos.clone(),
        stun: last ? 0.65 : 0.5,
        down: last ? 1.35 : 0,
        variant: a.variant || 'normal',
        id: a.id,
        kind: dash ? 'dash' : 'm1'
      };
      const amount = dash ? 3.25 : p.damage;
      const hp = e.hp;
      e.damage(amount, knock, {
        combat: meta,
        stun: meta.stun,
        react: last ? 'blow' : 'stagger',
        reactDur: 0.35,
        side: a.side,
        noFrameBonus: player.char !== 'naoya',
        fin: false,
        spark: p.color
      });
      if (e.hp < hp || (e.net && !blocked(e, meta))) a.contact = true;
      if (!blocked(e, meta)) impact(e.pos.clone().add(V(0, 2.8, 0)), a.dir, p.color, last);
    }
  }
  function sweepMove(actor, offset) {
    const from = actor.pos.clone(),
      next = from.clone().add(offset);
    if (window.JJMAP?.id === 'jjs') {
      const a = from.clone().add(V(0, 2.5, 0)),
        b = next.clone().add(V(0, 2.5, 0));
      const length = a.distanceTo(b),
        f = length > 1e-5 ? Math.min(1, JJJJS.ray(a, b, 0.8) + 0.1 / length) : 1;
      next.lerpVectors(from, next, f);
    }
    actor.pos.copy(next);
    collideWorld(actor.pos, 0.95);
    actor.__jjsLast = actor.pos.clone();
    return from.distanceTo(actor.pos);
  }
  function startFall(actor, knock, meta) {
    actor.blocking = false;
    actor.react = null;
    actor.vel.copy(knock);
    actor.onGround = false;
    const a = {
      type: 'bc_fall',
      t: 0,
      dur: 20,
      stage: 0,
      side: knock.x < 0 ? -1 : 1,
      variant: meta.variant || 'normal',
      rest: meta.down || 1.35
    };
    if (actor === player) {
      cancel();
      player.action = a;
      player.dashT = 0;
      queued = 0;
      guardHeld = false;
    } else {
      actor.bcFall = a;
      actor.flung = false;
      actor.lockT = actor.anchorT = 0;
    }
  }
  // One eligibility rule and cooldown for local players and authoritative bots.
  // Grabs, death finishers and cutscene holds are not ragdoll escapes.
  function canEvasive(actor) {
    const fall = actor.bcFall || (actor.action?.type === 'bc_fall' && actor.action) || actor.rag;
    return (
      !!fall &&
      !actor.dead &&
      actor.hp > 0 &&
      (actor.evasiveCD || 0) <= 0 &&
      (fall.t || 0) >= 0.12 &&
      !actor.cineHold &&
      !actor.tdHold &&
      !actor.mhConsumed &&
      !(actor.anchorT > 0) &&
      !(actor.lockT > 0) &&
      !(actor.frameT > 0) &&
      !actor.__aiLocalHold &&
      !actor.__aiNetHold &&
      !window.JJGORE?.isHeld(actor) &&
      (actor !== player ||
        (!window.MPJJ?.cs?.active &&
          !window.JJAW?.cine &&
          !window.JJNAOYA?.busy() &&
          !window.JJTODO?.grabbed &&
          !window.JJMAHITO?.grabbed))
    );
  }
  function evasive(actor, travel) {
    if (!canEvasive(actor) || (actor === player && !gameInputActive())) return false;
    const d = (travel || dir(actor.facing).negate()).clone().setY(0);
    if (d.lengthSq() < 0.001) d.copy(dir(actor.facing).negate());
    d.normalize();
    if (actor.ai) window.JJAIKITS?.cancel(actor);
    window.JJRAG?.stop(actor);
    actor.bcFall = null;
    actor.react = null;
    actor.flung = false;
    actor.stunT = actor.attackT = actor.frameT = 0;
    actor.evasiveCD = C.evasiveCooldown;
    actor.iframes = Math.max(actor.iframes || 0, 0.38);
    actor.blocking = false;
    actor.comboN = actor.comboReset = 0;
    actor.vel.set(0, Math.max(0, Math.min(6, actor.vel.y)), 0);
    actor.action = { type: 'bc_evasive', t: 0, dur: 0.36, dir: d, side: 1, id: ++sequence };
    resetPose(actor.rig);
    actor.rig.body.rotation.set(0, 0, 0);
    if (actor === player) {
      clearInput();
      player.dashT = 0;
    }
    if (actor.ai) {
      actor.ai.combo = actor.ai.comboReset = 0;
      actor.ai.history.push('ragdoll evasive');
    }
    dashFX(actor.pos, d);
    return true;
  }
  C.stepEvasive = function (actor, a, dt) {
    const old = clamp((a.t - dt) / a.dur, 0, 1),
      now = clamp(a.t / a.dur, 0, 1);
    sweepMove(actor, a.dir.clone().multiplyScalar(9 * ((1 - old) ** 2 - (1 - now) ** 2)));
  };
  function stepFall(actor, a, dt) {
    if (a.stage === 0) {
      const previous = actor.pos.y;
      actor.vel.y -= 34 * dt;
      sweepMove(actor, V(actor.vel.x * dt, 0, actor.vel.z * dt));
      actor.pos.y += actor.vel.y * dt;
      if (window.JJMAP?.id === 'jjs' && actor.vel.y > 0) {
        const ceiling = JJMAP.ceiling(actor.pos, previous + JJJJS.HEIGHT - 0.025);
        if (actor.pos.y + JJJJS.HEIGHT > ceiling) {
          actor.pos.y = ceiling - JJJJS.HEIGHT;
          actor.vel.y = 0;
        }
      }
      const floor = worldFloor(actor.pos, Math.max(previous, actor.pos.y) + 0.1);
      if (actor.vel.y <= 0 && Number.isFinite(floor) && actor.pos.y <= floor + 0.03) {
        actor.pos.y = floor;
        actor.vel.y = 0;
        actor.onGround = true;
        a.stage = 1;
        a.t = 0;
        JJFX.dust(actor.pos.clone(), 4, 0xbcc2c4, 4, 1.5);
      } else if (window.JJMAP?.id === 'jjs' && actor.pos.y < JJMAP.killY) {
        const sp = JJMAP.spawn();
        actor.pos.set(sp.x, sp.y, sp.z);
        actor.vel.set(0, 0, 0);
        a.stage = 1;
        a.t = 0;
      }
      actor.vel.x *= Math.exp(-dt * 1.8);
      actor.vel.z *= Math.exp(-dt * 1.8);
    } else if (a.stage === 1) {
      const floor = worldFloor(actor.pos, actor.pos.y + 0.15);
      if (!Number.isFinite(floor) || floor < actor.pos.y - 0.3) {
        a.stage = 0;
        a.t = 0;
        actor.onGround = false;
        return;
      }
      actor.vel.set(0, 0, 0);
      if (a.t >= Math.max(0.45, a.rest - 0.4)) {
        a.stage = 2;
        a.t = 0;
      }
    } else if (a.t >= 0.38) {
      if (actor === player) player.action = null;
      else actor.bcFall = null;
      actor.stunT = 0;
      actor.iframes = Math.max(actor.iframes || 0, 0.3);
      actor.onGround = true;
      resetPose(actor.rig);
      actor.rig.body.rotation.set(0, 0, 0);
      log('recovered');
    }
    actor.__jjsLast = actor.pos.clone();
  }
  const previousStep = stepAction;
  stepAction = function (a, dt) {
    if (!core(a)) return previousStep(a, dt);
    if (a.type === 'bc_fall') {
      stepFall(player, a, dt);
      return;
    }
    if (a.type === 'bc_evasive') {
      C.stepEvasive(player, a, dt);
      return;
    }
    if (player.stunT > 0 || taken()) {
      cancel();
      return;
    }
    if (a.type === 'bc_m1') {
      if (a.t < a.start) a.dir.copy(dir(player.facing));
      if (a.t >= a.start && a.t - dt <= a.start + a.active) strike(a);
      if (a.n === 3 && a.t >= a.start + a.active && !a.checked) {
        a.checked = true;
        if (!a.contact) {
          a.dur = Math.max(a.dur, 1.1);
          log('fourth-hit miss recovery');
        }
      }
      return;
    }
    const conf = D[a.kind],
      old = clamp((a.t - dt) / conf.travel, 0, 1),
      now = clamp(a.t / conf.travel, 0, 1);
    if (a.strikeAt === null && a.t <= conf.travel + dt) {
      const target = camForward();
      if (a.kind === 'back') target.negate();
      if (a.kind === 'side') target.set(-target.z * a.side, 0, target.x * a.side);
      a.dir.copy(target); // mouse/camera steering is immediate throughout travel
      player.facing = Math.atan2(camForward().x, camForward().z);
      const distance = conf.distance * (Math.pow(1 - old, 2) - Math.pow(1 - now, 2));
      const moved = sweepMove(player, a.dir.clone().multiplyScalar(distance));
      a.distance += moved;
      player.vel.x = player.vel.z = 0;
      if (
        a.kind === 'front' &&
        ((a.t > 0.08 && candidates(a, true).length) || moved < distance * 0.35 || a.t >= conf.travel)
      ) {
        a.strikeAt = a.t + 0.08;
        a.dur = a.strikeAt + 0.22;
      }
    }
    if (a.kind === 'front' && a.strikeAt !== null && a.t >= a.strikeAt && a.t - dt <= a.strikeAt + 0.12)
      strike(a, true);
  };
  function metadata(opts) {
    return opts?.combat || null;
  }
  const previousDamage = Enemy.prototype.damage;
  Enemy.prototype.damage = function (amount, knock, opts = {}) {
    const meta = metadata(opts);
    if (this.dead || (meta && (this.iframes > 0 || this.bcFall || this.rag))) return false;
    const block = blocked(this, meta);
    if (block && !this.net) {
      blockFX(this);
      return false;
    }
    if (meta?.breakGuard) this.blocking = false;
    const hp = this.hp;
    const result = previousDamage.call(
      this,
      amount,
      knock,
      block ? { ...opts, predictBlocked: true } : opts
    );
    if (this.hp < hp && meta) {
      this.stunT = Math.max(this.stunT || 0, meta.stun || 0);
      this.blocking = false;
      if (!this.net && meta.down && !this.dead) startFall(this, knock, meta);
      if (player.char === 'mahito' && !JJMAHITO.active)
        JJMAHITO.charge = Math.min(100, JJMAHITO.charge + Math.min(hp, amount) * 0.65);
      if (player.char === 'todo' && !JJTODO.active)
        JJTODO.charge = Math.min(100, JJTODO.charge + Math.min(hp, amount) * 0.85);
    }
    return result;
  };
  const previousHurt = hurtPlayer;
  hurtPlayer = function (amount, knock, opts) {
    if (!Number.isFinite(amount) || amount <= 0 || player.dead || player.iframes > 0) return false;
    const meta =
      opts?.combat ||
      (!opts && knock && Math.hypot(knock.x, knock.z) > 0.01
        ? { guardable: true, source: player.pos.clone().sub(knock), stun: 0.5 }
        : null);
    if (meta && (player.rag || player.action?.type === 'bc_fall')) return false;
    if (blocked(player, meta)) {
      blockFX(player);
      return false;
    }
    if (opts?.death) window.JJGORE?.mark(player, opts.death);
    if (opts?.react) window.JJHITS?.next(opts.react, opts.reactDur || 0.4);
    const hp = player.hp;
    previousHurt(amount, knock, opts);
    if (player.hp >= hp) return false;
    guardHeld = false;
    player.blocking = false;
    queued = 0;
    player.comboN = 0;
    player.comboReset = 0;
    player.attackT = 0;
    player.stunT = Math.max(player.stunT || 0, meta?.stun ?? opts?.stun ?? 0.3);
    if (core(player.action)) cancel();
    if (meta) {
      player.dashT = 0;
      if (meta.down && !player.dead) startFall(player, knock || V(), meta);
    }
    return true;
  };
  function pack(a) {
    return a
      ? {
          n: a.n ?? 0,
          v: a.variant || 'normal',
          k: a.kind || '',
          s: a.side || 1,
          mode: a.mode || 0,
          start: a.start || 0,
          active: a.active || 0,
          stage: a.stage || 0,
          rest: a.rest || 0,
          strike: a.strikeAt ?? -1
        }
      : null;
  }
  function unpack(a, m) {
    if (!core(a) || !m || typeof m !== 'object') return;
    a.n = clamp(Math.floor(+m.n || 0), 0, 3);
    a.variant = ['up', 'down'].includes(m.v) ? m.v : 'normal';
    a.kind = ['front', 'back', 'side'].includes(m.k) ? m.k : 'front';
    a.side = m.s === -1 ? -1 : 1;
    a.mode = clamp(Math.floor(+m.mode || 0), 0, 2);
    a.start = clamp(+m.start || 0.12, 0.05, 0.5);
    a.active = clamp(+m.active || 0.16, 0.05, 0.3);
    a.stage = clamp(Math.floor(+m.stage || 0), 0, 2);
    a.rest = clamp(+m.rest || 1.35, 0.4, 3);
    a.strikeAt = Number.isFinite(m.strike) && m.strike >= 0 ? clamp(m.strike, 0, 2) : null;
  }
  C.hitData = (meta) =>
    meta
      ? {
          g: meta.guardable ? 1 : 0,
          b: meta.breakGuard ? 1 : 0,
          p: meta.source.toArray(),
          st: meta.stun,
          down: meta.down,
          v: meta.variant,
          id: meta.id,
          k: meta.kind
        }
      : null;
  function networkHit(m) {
    const h = m.bc;
    let meta = null;
    if (h) {
      if (
        !Array.isArray(h.p) ||
        h.p.length !== 3 ||
        !h.p.every((n) => Number.isFinite(n) && Math.abs(n) < 1e5) ||
        !Number.isSafeInteger(h.id)
      )
        return false;
      const tag = m.id + ':' + h.id;
      if (received.has(tag)) return false;
      received.add(tag);
      if (received.size > 512) received.delete(received.values().next().value);
      meta = {
        guardable: h.g === 1,
        breakGuard: h.b === 1,
        source: V(...h.p),
        stun: clamp(+h.st || 0, 0, 1.5),
        down: clamp(+h.down || 0, 0, 2),
        variant: ['up', 'down'].includes(h.v) ? h.v : 'normal'
      };
    }
    if (!Number.isFinite(m.d) || m.d <= 0) return false;
    const values = [m.kx || 0, m.ky || 0, m.kz || 0];
    if (!values.every(Number.isFinite)) return false;
    const k = V(...values),
      result = hurtPlayer(m.d, k, {
        combat: meta,
        stun: h ? meta.stun : 0.3,
        react: m.rk,
        reactDur: m.rd,
        death: m.dth
      });
    if (result) {
      if (m.pin) player.pinned = Math.max(player.pinned || 0, clamp(m.pin / 100, 0, 5));
      if (m.psn) player.psn = Math.max(player.psn || 0, clamp(m.psn / 10, 0, 30));
    }
    return result;
  }
  const previousEnemyUpdate = Enemy.prototype.update;
  Enemy.prototype.update = function (dt) {
    // Enemies never had an iframes clock. base.html ticks iframes down inside
    // updatePlayer and nowhere else, so the 0.3 that stepFall grants an enemy
    // on getting back up stayed on them for the rest of the round. Everything
    // that reads iframes as "leave them alone" — the M1 candidate search, the
    // guard-aware damage gate below, Mahito's transfiguration, Todo's swap —
    // then skipped that enemy permanently, while skills calling damage()
    // without combat metadata went straight past the gate and still landed.
    // One knockdown was enough to make a dummy unpunchable for good.
    if (this.iframes > 0) this.iframes = Math.max(0, this.iframes - dt);
    if (this.bcFall && !this.net && !this.dead) {
      const a = this.bcFall;
      a.t += dt;
      stepFall(this, a, dt);
      if (this.bcFall) poseCore(this.rig, a);
      this.rig.root.position.copy(this.pos);
      this.rig.root.rotation.y = this.facing;
      return;
    }
    const r = previousEnemyUpdate.call(this, dt);
    if (this.blocking && !this.dead && !this.react && !this.bcFall)
      guardPose(this.rig, this.animT, this.bcGuardHit || 0);
    this.bcGuardHit = Math.max(0, (this.bcGuardHit || 0) - dt);
    return r;
  };
  const previousRespawn = Enemy.prototype.respawn;
  Enemy.prototype.respawn = function () {
    this.bcFall = null;
    this.blocking = false;
    this.bcGuardHit = 0;
    this.evasiveCD = 0;
    return previousRespawn.apply(this, arguments);
  };
  const previousUpdate = updatePlayer;
  updatePlayer = function (dt) {
    if (seenChar !== player.char || seenRig !== player.rig) {
      reset();
      seenChar = player.char;
      seenRig = player.rig;
    }
    frontCD = Math.max(0, frontCD - dt);
    evadeCD = Math.max(0, evadeCD - dt);
    player.evasiveCD = Math.max(0, (player.evasiveCD || 0) - dt);
    queued = Math.max(0, queued - dt);
    noJump = Math.max(0, noJump - dt);
    player.stunT = Math.max(0, (player.stunT || 0) - dt);
    player.bcGuardHit = Math.max(0, (player.bcGuardHit || 0) - dt);
    if (taken()) {
      clearInput();
      if (core(player.action)) cancel();
    }
    if (!gameInputActive()) {
      clearInput();
      if (core(player.action) && player.action.type !== 'bc_fall') cancel();
    }
    const wasDead = player.dead;
    previousUpdate(dt);
    if (wasDead && !player.dead) player.evasiveCD = 0;
    if (player.blocking && !player.action && !taken())
      guardPose(player.rig, player.animT, player.bcGuardHit);
    if (player.char !== 'naoya') {
      const w = direction().kind,
        cd = w === 'front' ? frontCD : evadeCD;
      player.dashCh = clamp(1 - cd / D[w].cd, 0, 1);
    }
  };
  C.input = function (e) {
    const a = player.action;
    if (
      /^(Digit[1-4]|KeyR)$/.test(e.code) &&
      a?.type === 'bc_m1' &&
      a.n < 3 &&
      a.contact &&
      a.t >= a.start &&
      !locked()
    )
      cancel();
    if (/^(Digit[1-4]|Key[RFGEX])$/.test(e.code) && evadeOpen(player.action) && !locked()) cancel();
    if (e.code === 'KeyQ' && (player.rag || player.action?.type === 'bc_fall')) {
      evasive(player, direction().dir);
      e.preventDefault();
      e.stopImmediatePropagation();
      return true;
    }
    if (e.code === 'KeyF') {
      guard(true);
      e.preventDefault();
      e.stopImmediatePropagation();
      return true;
    }
    if (/^(Digit[1-4]|Key[RFGEX])$/.test(e.code) && locked()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return true;
    }
    return false;
  };
  window.addEventListener(
    'mousedown',
    (e) => {
      if (
        e.button === 0 &&
        gameInputActive() &&
        !typingInUI(e) &&
        (e.target === renderer.domElement || document.pointerLockElement === renderer.domElement)
      )
        held = true;
    },
    true
  );
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) held = false;
  });
  window.addEventListener(
    'keyup',
    (e) => {
      if (e.code === 'KeyF') guard(false);
    },
    true
  );
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInput();
  });
  const previousSwitch = switchChar;
  switchChar = function () {
    const old = player.char,
      result = previousSwitch.apply(this, arguments);
    if (player.char !== old) {
      reset();
      seenChar = player.char;
      seenRig = player.rig;
    }
    return result;
  };
  C.remoteFX = function (type, pos, yaw) {
    if (!/^bc_/.test(type)) return false;
    if (type === 'bc_dash' || type === 'bc_evasive') dashFX(pos, dir(yaw));
    return true;
  };

  function guardPose(r, time = 0, hit = 0) {
    const p = styles[r.__char] || styles.gojo,
      recoil = Math.sin(clamp(hit / 0.18, 0, 1) * Math.PI) * 0.12;
    r.spine.rotation.set(-0.1 - recoil, p.stance * 0.3, 0);
    r.neck.rotation.set(0.08, -p.stance * 0.3, 0);
    r.shoulderL.rotation.set(-1.15, 0, 0.3);
    r.shoulderR.rotation.set(-1.05, 0, -0.3);
    r.elbowL.rotation.set(-1.95, 0, 0);
    r.elbowR.rotation.set(-2.05, 0, 0);
    r.hips.position.y -= 0.08 + recoil * 0.3;
    r.kneeL.rotation.x += 0.12;
    r.kneeR.rotation.x += 0.12;
    r.spine.rotation.x += Math.sin(time * 2.4) * 0.012;
  }
  function poseCore(r, a) {
    resetPose(r);
    if (r.body) r.body.rotation.set(0, 0, 0);
    const p = profile(r.__char || player.char, a.mode),
      t = a.t;
    if (a.type === 'bc_evasive') {
      const k = ease(t / a.dur),
        roll = Math.sin(k * Math.PI);
      r.hips.position.y = r.hipsBaseY - roll * 1.15;
      r.spine.rotation.x = -roll * 0.75;
      r.shoulderL.rotation.z = roll * 1.1;
      r.shoulderR.rotation.z = -roll * 1.1;
      r.hipL.rotation.x = -roll * 1.1;
      r.kneeL.rotation.x = roll * 1.9;
      r.hipR.rotation.x = roll * 0.6;
      r.kneeR.rotation.x = roll * 1.2;
      return;
    }
    if (a.type === 'bc_fall') {
      const rise = a.stage === 2 ? ease(t / 0.38) : 0,
        tip = a.stage === 0 ? ease(t / 0.24) : 1;
      r.hips.position.y = lerp(r.hipsBaseY, 0.85, tip * (1 - rise));
      r.hips.rotation.set(-1.4 * tip * (1 - rise), 0, 0.13 * a.side * (1 - rise));
      r.spine.rotation.x = 0.25 * (1 - rise);
      for (const [s, n] of [
        ['L', 0],
        ['R', 1]
      ]) {
        const wave = a.stage === 0 ? Math.sin(t * 11 + n * 2) * 0.26 : 0;
        r['shoulder' + s].rotation.set(
          -0.4 + wave,
          0,
          (s === 'L' ? -1 : 1) * (0.55 + 0.15 * tip) * (1 - rise)
        );
        r['elbow' + s].rotation.x = -0.65;
        r['hip' + s].rotation.x = (-0.3 + wave) * (1 - rise);
        r['knee' + s].rotation.x = (0.65 + wave) * (1 - rise);
      }
      r.neck.rotation.x = 0.2 * (1 - rise);
      return;
    }
    if (a.type === 'bc_dash') {
      const dur = D[a.kind]?.dur || 0.4,
        k = clamp(t / dur, 0, 1),
        hold = ease(k / 0.13) * (1 - ease((k - 0.65) / 0.35));
      if (a.kind === 'front' && a.strikeAt !== null && t >= a.strikeAt - 0.09) {
        const at = Math.max(0, t - a.strikeAt + 0.12);
        poseCore(r, {
          type: 'bc_m1',
          t: at,
          dur: 0.4,
          start: 0.12,
          active: 0.12,
          n: 1,
          variant: 'normal',
          mode: a.mode
        });
        return;
      }
      const side = a.kind === 'side' ? a.side : 0,
        back = a.kind === 'back';
      r.hips.position.y -= hold * (back ? 0.35 : 0.28);
      r.spine.rotation.set((back ? -0.3 : 0.35) * hold, side * 0.15 * hold, -side * 0.35 * hold);
      r.neck.rotation.x = -r.spine.rotation.x * 0.65;
      r.shoulderL.rotation.set((back ? -1.1 : 0.6) * hold, 0, -0.3 * hold);
      r.shoulderR.rotation.set((back ? -1.1 : 0.8) * hold, 0, 0.3 * hold);
      r.elbowL.rotation.x = -0.85;
      r.elbowR.rotation.x = -0.75;
      r.hipL.rotation.set(-0.9 * hold, 0, -side * 0.35 * hold);
      r.hipR.rotation.set(0.55 * hold, 0, -side * 0.45 * hold);
      r.kneeL.rotation.x = 1.2 * hold;
      r.kneeR.rotation.x = 0.5 * hold;
      return;
    }
    const start = a.start || 0.13,
      active = a.active || 0.16;
    const wind = 1 - ease(t / start),
      out = ease((t - start * 0.45) / (start * 0.65)),
      recover = ease((t - start - active) / Math.max(0.08, a.dur - start - active));
    const extension = out * (1 - recover),
      side = a.n % 2 ? 'R' : 'L',
      mirror = side === 'L' ? -1 : 1;
    guardPose(r, 0, 0);
    r.hips.rotation.y = -mirror * p.twist * 0.4 * extension;
    r.hips.position.y = r.hipsBaseY - 0.06 - 0.12 * wind;
    r.spine.rotation.y = mirror * p.twist * (wind * 0.65 - extension);
    r.spine.rotation.x = -0.08 - extension * 0.12;
    r.neck.rotation.y = -r.spine.rotation.y * 0.7;
    r['shoulder' + side].rotation.set(
      lerp(-0.7, -1.64, extension),
      mirror * (p.weapon ? 0.35 : 0.06) * extension,
      -mirror * 0.12 * extension
    );
    r['elbow' + side].rotation.x = lerp(-1.8, -0.06, extension);
    r['hip' + side].rotation.x = -0.12 - extension * 0.2;
    r.kneeL.rotation.x = 0.16 + wind * 0.16;
    r.kneeR.rotation.x = 0.18 + wind * 0.12;
    if (a.n === 2) {
      r.spine.rotation.y = -mirror * 0.65 * extension;
      r['shoulder' + side].rotation.z = -mirror * 0.68 * extension;
      r['elbow' + side].rotation.x = -0.85;
    }
    if (a.n === 3) {
      if (a.variant === 'up') {
        r.hips.position.y -= 0.3 * wind;
        r.spine.rotation.x = 0.18 * wind - 0.24 * extension;
        r.shoulderR.rotation.set(lerp(0.3, -2.55, extension), 0, 0.15);
        r.elbowR.rotation.x = lerp(-1.6, -0.4, extension);
        r.hipR.rotation.x = -0.4 * extension;
      } else if (a.variant === 'down') {
        r.spine.rotation.x = -0.45 * extension;
        r.shoulderL.rotation.set(lerp(-2.6, -0.8, extension), 0, 0.1);
        r.shoulderR.rotation.set(lerp(-2.6, -0.8, extension), 0, -0.1);
        r.elbowL.rotation.x = r.elbowR.rotation.x = lerp(-0.55, -0.1, extension);
        r.hipL.rotation.x = -0.85;
        r.kneeL.rotation.x = 1.1;
        r.kneeR.rotation.x = 0.55;
      } else {
        r.spine.rotation.y = 0.75 * (wind * 0.4 - extension);
        r.shoulderR.rotation.set(lerp(0.55, -1.75, extension), 0, 0.24);
        r.elbowR.rotation.x = lerp(-1.1, -0.05, extension);
        r.hipL.rotation.x = -0.32 * extension;
        r.kneeL.rotation.x = 0.4 * extension;
      }
    }
    if (p.weapon && a.variant === 'normal') {
      r.shoulderR.rotation.z -= extension * 0.45;
      r.elbowR.rotation.x = -0.3 - extension * 0.25;
    }
  }
  const previousPose = poseAction;
  poseAction = function (r, a) {
    if (core(a)) return poseCore(r, a);
    return previousPose(r, a);
  };
  const help = document.createElement('div');
  help.className = 'kit-row';
  help.id = 'jjCombatHelp';
  help.innerHTML =
    '<strong>Combat · all fighters</strong><br><b>Left mouse</b>: four-hit combo; hold to continue. Hold <b>Space</b> during the combo for a fourth-hit uppercut; jump before hit four for a downslam. <b>F</b>: hold frontal guard. Downslams and attacks from behind bypass guard. <b>Q</b>: forward dash strike; <b>A/D + Q</b>: side dash; <b>S + Q</b>: back dash. Side and back dashes cancel straight into an attack or a skill; the forward dash stays committed. <b>Q while ragdolled</b>: evasive recovery (25s cooldown). <b>G</b>: awaken. Turn the camera to steer dashes. Naoya keeps his two-charge dash.';
  document.querySelector('#menu .ctrl-kits')?.prepend(help);
  const status = document.createElement('div');
  status.id = 'jjCombatStatus';
  status.style.cssText =
    'position:fixed;left:50%;bottom:140px;transform:translateX(-50%);font:12px Arial;color:#fff;background:#17191ed9;padding:5px 9px;border-radius:3px;pointer-events:none;display:none;z-index:10';
  document.body.appendChild(status);
  const oldHUD = updateHUD;
  updateHUD = function (dt) {
    oldHUD(dt);
    const a = player.action;
    const text = player.blocking
      ? 'GUARD · front only'
      : a?.type === 'bc_m1'
        ? 'COMBO ' +
          (a.n + 1) +
          ' / 4' +
          (a.n === 3
            ? ' · ' + (a.variant === 'up' ? 'UPPERCUT' : a.variant === 'down' ? 'DOWNSLAM' : 'FINISHER')
            : '')
        : a?.type === 'bc_fall'
          ? (player.evasiveCD || 0) > 0
            ? 'KNOCKED DOWN · EVASIVE ' + Math.ceil(player.evasiveCD) + 's'
            : 'Q · RAGDOLL EVASIVE READY'
          : player.stunT > 0
            ? 'STUNNED'
            : player.evasiveCD > 0
              ? 'EVASIVE · ' + Math.ceil(player.evasiveCD) + 's'
              : '';
    status.style.display = text && gameInputActive() ? 'block' : 'none';
    status.textContent = text;
  };
})();
