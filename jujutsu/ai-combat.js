/* Bot actions use the player's hit windows, guard angles, poses and collision.
   Actor state is independent: bot attacks never borrow the player's cooldowns. */
(function () {
  'use strict';
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z),
    F = (y) => V(Math.sin(y), 0, Math.cos(y));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n)),
    C = JJFIGHT,
    world = C.actors;
  const traits = {
    gojo: ['beam', 'launch'],
    naoya: ['rush', 'blade'],
    yuji: ['rush', 'launch'],
    hakari: ['rush', 'launch'],
    choso: ['beam', 'snare'],
    megumi: ['snare', 'rush'],
    mahito: ['launch', 'rush'],
    todo: ['swap', 'launch'],
    higuruma: ['launch', 'rush'],
    yuta: ['blade', 'beam'],
    muta: ['beam', 'rush'],
    ryu: ['beam', 'launch'],
    nanami: ['blade', 'rush'],
    hanami: ['snare', 'beam']
  };
  const colors = {
    gojo: 0xff635f,
    naoya: 0xc7e6ff,
    yuji: 0xff7861,
    hakari: 0x91e09c,
    choso: 0xb92943,
    megumi: 0x8e7bab,
    mahito: 0xc6e5dd,
    todo: 0xf5dbb3,
    higuruma: 0xd9bd70,
    yuta: 0xb4d5ff,
    muta: 0x8bd6f0,
    ryu: 0xd5a4fa,
    nanami: 0xf2d778,
    hanami: 0xa3c47e
  };
  const A = (window.JJAICOMBAT = {
    m1,
    dash,
    skill,
    tick,
    pose,
    turn,
    traits,
    free,
    readyGuard,
    guard,
    hitTargets,
    techFX
  });
  function free(e) {
    return (
      !e.dead &&
      !e.rag &&
      !e.bcFall &&
      e.stunT <= 0 &&
      e.frameT <= 0 &&
      !e.cineHold &&
      !e.tdHold &&
      !e.mhConsumed &&
      !(e.anchorT > 0) &&
      !(e.lockT > 0)
    );
  }
  function turn(e, t, dt, rate = 12) {
    const yaw = typeof t === 'number' ? t : Math.atan2(t.x - e.pos.x, t.z - e.pos.z);
    let d = yaw - e.facing;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    e.facing += d * Math.min(1, dt * rate);
  }
  function set(e, a) {
    e.action = a;
    e.blocking = false;
    e.ai.guardT = 0;
    e.vel.x = e.vel.z = 0;
    e.ai.history.push(a.type + (a.kind ? ' ' + a.kind : '') + (a.variant ? ' ' + a.variant : ''));
    if (e.ai.history.length > 36) e.ai.history.shift();
    return true;
  }
  function readyGuard(e) {
    return free(e) && !e.action;
  }
  function guard(e, duration = 0.35) {
    if (!readyGuard(e)) return false;
    e.blocking = true;
    e.ai.guardT = duration;
    return true;
  }
  function m1(e, target, variant = 'normal') {
    const b = e.ai;
    if (!free(e) || e.action || e.blocking || b.m1CD > 0) return false;
    const n = b.comboReset > 0 ? b.combo : 0,
      p = world.profile(e.char, b.mode),
      last = n === 3;
    const start = (last ? 0.18 : 0.12 + n * 0.015) * (p.pace || 1),
      dur = start + 0.16 + (last ? 0.26 : 0.12);
    b.m1CD = dur;
    b.combo = (n + 1) % 4;
    b.comboReset = 1.2;
    turn(e, target.pos, 1);
    b.confirm = false;
    return set(e, {
      type: 'bc_m1',
      t: 0,
      dur,
      start,
      active: 0.16,
      n,
      side: n % 2 ? 1 : -1,
      variant: last ? variant : 'normal',
      dir: F(e.facing),
      hits: new Set(),
      mode: b.mode,
      id: ++b.serial
    });
  }
  function dash(e, target, kind = 'front', side = 1) {
    const b = e.ai;
    if (!free(e) || e.blocking) return false;
    if (
      e.action &&
      !(e.action.type === 'bc_m1' && e.action.n < 3 && e.action.t >= e.action.start + e.action.active)
    )
      return false;
    if (e.char === 'naoya') {
      if (b.charges < 1) return false;
      b.charges--;
      const d = target.pos.clone().sub(e.pos).setY(0).normalize();
      if (kind === 'back') d.negate();
      if (kind === 'side') d.set(d.z * side, 0, -d.x * side);
      e.iframes = Math.max(e.iframes || 0, 0.17);
      return set(e, { type: 'ai_naoya_dash', t: 0, dur: 0.3, dir: d, kind, side });
    }
    if ((kind === 'front' ? b.frontCD : b.evadeCD) > 0) return false;
    const conf = C.dashConfig[kind === 'side' ? 'side' : kind];
    if (kind === 'front') b.frontCD = 4.5;
    else b.evadeCD = 2;
    const center = target.pos.clone(),
      rad = clamp(Math.hypot(e.pos.x - center.x, e.pos.z - center.z), 3.6, 8);
    const d = center.clone().sub(e.pos).setY(0).normalize();
    if (kind === 'back') d.negate();
    if (kind === 'side') d.set(d.z * side, 0, -d.x * side);
    b.combo = 0;
    b.comboReset = 0;
    return set(e, {
      type: 'bc_dash',
      t: 0,
      dur: conf.dur,
      kind,
      side,
      dir: d,
      center,
      rad,
      angle: Math.atan2(e.pos.x - center.x, e.pos.z - center.z),
      origin: e.pos.clone(),
      strikeAt: null,
      hits: new Set(),
      mode: b.mode,
      id: ++b.serial
    });
  }
  function skill(e, target, slot = 0) {
    const b = e.ai;
    if (!free(e) || e.blocking || b.techCD[slot] > 0) return false;
    if (e.action && !(e.action.type === 'bc_m1' && e.action.t >= e.action.start + 0.16 && e.action.n < 3))
      return false;
    const kind = traits[e.char][slot],
      beam = kind === 'beam' || kind === 'snare';
    const aim = target.pos.clone().addScaledVector(target.vel || V(), beam ? 0.18 : 0.08);
    aim.y = e.pos.y;
    const d = aim.sub(e.pos).normalize();
    turn(e, Math.atan2(d.x, d.z), 1);
    b.techCD[slot] = slot ? 9 : 7;
    b.comboReset = 1.2;
    return set(e, {
      type: 'ai_skill',
      t: 0,
      dur: beam ? 0.82 : 0.68,
      start: beam ? 0.34 : 0.24,
      kind,
      slot,
      dir: d,
      hits: new Set(),
      mode: b.mode,
      id: ++b.serial,
      variant: kind === 'launch' ? 'up' : 'normal',
      n: 3
    });
  }
  function hitTargets(e, a, range = 5.1, width = 2.2) {
    const right = V(a.dir.z, 0, -a.dir.x),
      result = [];
    for (const t of JJAISERVER.actors()) {
      if (
        t === e ||
        t.dead ||
        t.iframes > 0 ||
        t.rag ||
        t.bcFall ||
        t.action?.type === 'bc_fall' ||
        t.cineHold ||
        t.tdHold ||
        t.mhConsumed
      )
        continue;
      const off = t.pos.clone().sub(e.pos),
        along = off.dot(a.dir);
      if (
        along < 0.15 ||
        along > range ||
        Math.abs(off.dot(right)) > width ||
        Math.abs(off.y) > (a.variant === 'down' ? 5 : 3)
      )
        continue;
      if (!world.visible(e.pos.clone().add(V(0, 2.7, 0)), t.pos.clone().add(V(0, 2.7, 0)))) continue;
      result.push(t);
    }
    return result;
  }
  function impact(e, a, isDash = false) {
    const last = a.type === 'bc_m1' && a.n === 3,
      tech = a.type === 'ai_skill',
      p = world.profile(e.char, a.mode);
    const range = tech ? (a.kind === 'beam' ? 28 : a.kind === 'snare' ? 15 : 5.8) : isDash ? 5.8 : p.reach;
    const list = hitTargets(e, a, range, tech && ['beam', 'snare'].includes(a.kind) ? 1.45 : 2.35);
    for (const t of list) {
      if (a.hits.has(t)) continue;
      a.hits.add(t);
      const knock = a.dir
        .clone()
        .multiplyScalar(last ? (a.variant === 'up' ? 3 : 27) : tech ? 8 : 2.6)
        .setY(
          last
            ? a.variant === 'up'
              ? 24
              : a.variant === 'down'
                ? -17
                : 9
            : tech && a.kind === 'launch'
              ? 14
              : 0.35
        );
      const meta = {
        source: e.pos.clone(),
        guardable: true,
        breakGuard: a.variant === 'down' || (e.char === 'mahito' && a.mode === 2 && a.n >= 2),
        stun: tech ? 0.7 : 0.6,
        down: last ? 1.35 : 0,
        variant: a.variant || 'normal',
        id: a.id,
        kind: isDash ? 'dash' : tech ? 'tech' : 'm1'
      };
      const damage = isDash ? 3.25 : tech ? (a.slot ? 12 : 9) : p.damage;
      const hit = JJAISERVER.hit(e, t, damage, knock, meta);
      if (hit) {
        e.ai.confirm = true;
        e.ai.lastHit = JJAISERVER.time;
      }
      if (hit && e.pos.distanceTo(player.pos) < 110)
        JJFX.ring(t.pos.clone().add(V(0, 2.8, 0)), colors[e.char], {
          maxR: last ? 2 : 1.1,
          life: 0.2,
          ground: false,
          axis: a.dir
        });
    }
    if (last && !a.worldHit) {
      a.worldHit = true;
      e.ai.m1CD = Math.max(e.ai.m1CD, 1.5);
      JJDESTRUCT?.hit(
        e.pos
          .clone()
          .add(V(0, 2.6, 0))
          .addScaledVector(a.dir, 3.3),
        3.2
      );
    }
  }
  function techFX(e, a) {
    if (e.pos.distanceTo(player.pos) > 125) return;
    const color = colors[e.char],
      range = a.kind === 'beam' ? 22 : a.kind === 'snare' ? 12 : 4;
    if (a.kind === 'beam' || a.kind === 'blade')
      JJFX.slash(e.pos.clone().add(V(0, 2.8, 0)), a.dir, color, range, 0.24);
    if (a.kind === 'snare') {
      const g = new THREE.Group(),
        mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.5 + i * 0.13, 0.4), mat);
        m.position.copy(e.pos).addScaledVector(a.dir, 3 + i * 1.6);
        m.position.y += 0.6;
        m.rotation.z = i % 2 ? 0.4 : -0.4;
        g.add(m);
      }
      scene.add(g);
      let t = 0;
      addFx({
        update(dt) {
          t += dt;
          g.scale.y = Math.min(1, t * 12);
          if (t < 0.6) return true;
          scene.remove(g);
          g.children.forEach((m) => m.geometry.dispose());
          mat.dispose();
          return false;
        }
      });
    }
  }
  function tick(e, dt) {
    const b = e.ai,
      a = e.action;
    for (const k of ['m1CD', 'frontCD', 'evadeCD', 'comboReset', 'guardT']) b[k] = Math.max(0, b[k] - dt);
    b.techCD = b.techCD.map((n) => Math.max(0, n - dt));
    b.charges = Math.min(2, b.charges + dt / 2.2);
    if (b.guardT <= 0) e.blocking = false;
    if (!a) return;
    if (!free(e)) {
      e.action = null;
      e.blocking = false;
      return;
    }
    a.t += dt;
    if (a.type === 'bc_m1') {
      if (a.t < a.start && b.target && !b.target.dead) {
        turn(e, b.target.pos, dt);
        a.dir.copy(F(e.facing));
      }
      if (a.t >= a.start && a.t - dt <= a.start + 0.16) impact(e, a);
      if (a.n === 3 && a.t >= a.start + 0.16 && !a.hits.size) a.dur = Math.max(a.dur, 1.1);
    } else if (a.type === 'ai_naoya_dash') {
      world.sweepMove(e, a.dir.clone().multiplyScalar(41 * Math.min(dt, Math.max(0, 0.3 - (a.t - dt)))));
      if (b.target) turn(e, b.target.pos, dt);
    } else if (a.type === 'bc_dash') {
      const c = C.dashConfig[a.kind],
        old = clamp((a.t - dt) / c.travel, 0, 1),
        now = clamp(a.t / c.travel, 0, 1);
      if (a.strikeAt === null && a.t <= c.travel + dt) {
        const distance = c.distance * ((1 - old) ** 2 - (1 - now) ** 2);
        let offset;
        if (a.kind === 'side') {
          const angle = a.angle + ((a.side * c.distance) / a.rad) * (1 - (1 - now) ** 2),
            goal = a.center.clone().add(V(Math.sin(angle) * a.rad, 0, Math.cos(angle) * a.rad));
          goal.y = e.pos.y;
          offset = goal.sub(e.pos);
          if (offset.length() > distance * 1.3) offset.setLength(distance * 1.3);
        } else offset = a.dir.clone().multiplyScalar(distance);
        const moved = world.sweepMove(e, offset);
        if (b.target) turn(e, b.target.pos, dt, 15);
        if (
          a.kind === 'front' &&
          ((a.t > 0.08 && hitTargets(e, a, 5.8).length) || moved < distance * 0.3 || a.t >= c.travel)
        ) {
          a.strikeAt = a.t + 0.08;
          a.dur = a.strikeAt + 0.22;
        }
      }
      if (a.kind === 'front' && a.strikeAt !== null && a.t >= a.strikeAt) impact(e, a, true);
    } else if (a.type === 'ai_skill') {
      if (a.kind === 'rush' && a.t < 0.24) world.sweepMove(e, a.dir.clone().multiplyScalar(25 * dt));
      if (a.t >= a.start && !a.fired) {
        a.fired = true;
        techFX(e, a);
        if (
          a.kind === 'swap' &&
          b.target &&
          e.pos.distanceTo(b.target.pos) < 14 &&
          world.visible(e.pos, b.target.pos) &&
          !JJAINAV.occupied(b.target.pos) &&
          !JJAINAV.occupied(e.pos)
        ) {
          JJAISERVER.swap(e, b.target);
          if (b.target) turn(e, b.target.pos, 1);
          a.dir.copy(F(e.facing));
        }
        impact(e, a);
      }
    }
    if (e.action === a && a.t >= a.dur) e.action = null;
  }
  function pose(e) {
    const a = e.action,
      r = e.rig;
    r.__travel = e.vel;
    resetPose(r);
    r.body.rotation.set(0, 0, 0);
    if (e.dead) {
      C.pose(r, { type: 'bc_fall', t: 1, dur: 20, stage: 1, rest: 20, side: 1, variant: 'normal' });
      r.root.position.copy(e.pos);
      r.root.rotation.y = e.facing;
      return;
    }
    const speed = Math.hypot(e.vel.x, e.vel.z);
    applyLocomotion(
      r,
      e.animT,
      e.ai.gait,
      Math.min(1, speed / 2.2),
      clamp((speed - 6.8) / 6.7, 0, 1),
      e.onGround,
      e.vel.y
    );
    if (a) {
      if (a.type === 'ai_skill') {
        C.pose(r, {
          ...a,
          type: 'bc_m1',
          start: a.start,
          active: 0.16,
          n: 3,
          variant: a.kind === 'launch' ? 'up' : 'normal'
        });
      } else if (a.type === 'ai_naoya_dash') C.pose(r, { ...a, type: 'bc_dash', strikeAt: null });
      else if (/^pk_/.test(a.type)) JJMOVE.pose(r, a);
      else if (/^bc_/.test(a.type)) C.pose(r, a);
    }
    if (e.blocking && !a) C.guardPose(r, e.animT, e.bcGuardHit || 0);
    if (e.react && !a && !e.blocking) e.applyReact(0);
    r.root.position.copy(e.pos);
    r.root.rotation.y = e.facing;
  }
})();
