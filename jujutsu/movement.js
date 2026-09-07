/* Parkour adapted from the connected Studio's Wall_Parkour, LedgeGrab and
   Vault scripts. All joint animation below is original procedural animation. */
(function () {
  'use strict';
  const J = JJJJS,
    V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const R = 0.92,
    HEIGHT = 5.1,
    REACH = 5.2;
  const smooth = (x) => {
    x = Math.max(0, Math.min(1, x));
    return x * x * (3 - 2 * x);
  };
  const forward = () => V(Math.sin(player.facing), 0, Math.cos(player.facing));
  const parkour = (a) => !!a && /^pk_/.test(a.type);
  let state = null,
    vaultCD = 0,
    grabCD = 0,
    kickCD = 0,
    lastWall = null;
  const history = [];
  const M = (window.JJMOVE = {
    driving: () => !!state && player.action === state.action,
    get state() {
      return state ? state.action.type : 'free';
    },
    get cooldowns() {
      return { vault: vaultCD, grab: grabCD, kick: kickCD };
    },
    cancel,
    beforeStep,
    locomotion,
    audit: () => ({ state: M.state, history: history.slice(), grounded: player.onGround }),
    // Queries are also useful to map authors: all results use live collision.
    findLedge,
    findVault,
    tryGrab,
    tryVault,
    tryKick
  });
  function log(event) {
    history.push(event);
    if (history.length > 20) history.shift();
  }
  function inWorld() {
    return window.JJMAP && JJMAP.id === 'jjs' && J.root;
  }
  function interrupted() {
    return (
      player.dead ||
      player.rag ||
      player.react ||
      player.frameT > 0 ||
      player.stunT > 0 ||
      player.blocking ||
      player.dashT > 0 ||
      window.JJFIN?.on() ||
      window.MPJJ?.cs?.active ||
      window.JJAW?.cine ||
      window.JJNAOYA?.busy() ||
      window.JJTODO?.grabbed ||
      window.JJMAHITO?.grabbed
    );
  }
  function available() {
    return gameInputActive() && inWorld() && !interrupted() && !player.action && player.attackT <= 0;
  }
  function clearAt(p) {
    return !J.occupied(p, R, HEIGHT);
  }
  function clearSegment(a, b) {
    const steps = Math.max(1, Math.ceil(a.distanceTo(b) / 0.25));
    for (let i = 1; i <= steps; i++) if (!clearAt(a.clone().lerp(b, i / steps))) return false;
    return true;
  }
  function clearPath(path) {
    return path.slice(1).every((p, i) => clearSegment(path[i], p));
  }
  function supported(p) {
    // Both sides of the feet need support, including at the top of a climb.
    for (const [x, z] of [
      [0, 0],
      [0.35, 0],
      [-0.35, 0],
      [0, 0.35],
      [0, -0.35]
    ]) {
      const y = J.floor(V(p.x + x, p.y, p.z + z), p.y + 0.12);
      if (!Number.isFinite(y) || Math.abs(y - p.y) > 0.2) return false;
    }
    return clearAt(p);
  }
  function wallAlive(s) {
    if (!inWorld() || J.root !== s.root) return false;
    const a = s.edge
      .clone()
      .addScaledVector(s.normal, 0.35)
      .add(V(0, -0.12, 0));
    const b = s.edge
      .clone()
      .addScaledVector(s.normal, -0.35)
      .add(V(0, -0.12, 0));
    const h = J.trace(a, b);
    return !!h && h.normal.dot(s.normal) > 0.6;
  }
  function findLedge(pos = player.pos, dir = forward(), range = 3.8) {
    if (!inWorld()) return null;
    const from = pos.clone().add(V(0, 2.7, 0)),
      hit = J.trace(from, from.clone().addScaledVector(dir, range));
    if (!hit || Math.abs(hit.normal.y) > 0.18 || hit.normal.dot(dir) > -0.55) return null;
    const normal = hit.normal.clone();
    normal.y = 0;
    normal.normalize();
    const inside = hit.point.clone().addScaledVector(normal, -0.55);
    const top = J.trace(V(inside.x, pos.y + 7.5, inside.z), V(inside.x, pos.y + 3.4, inside.z));
    if (!top || top.normal.y < 0.9) return null;
    const edge = V(hit.point.x, top.point.y, hit.point.z);
    const hang = edge.clone().addScaledVector(normal, 1.08);
    hang.y -= REACH;
    const stand = edge.clone().addScaledVector(normal, -1.25);
    stand.y += 0.04;
    if (hang.distanceTo(pos) > 4.2 || !clearAt(hang) || !supported(stand)) return null;
    const floor = J.floor(hang, hang.y + 0.1);
    if (Number.isFinite(floor) && hang.y - floor < 0.2) return null;
    return { edge, normal, hang, stand, id: hit.id, root: J.root };
  }
  function findVault(pos = player.pos, dir = camForward()) {
    if (!inWorld()) return null;
    const from = pos.clone().add(V(0, 1.4, 0)),
      hit = J.trace(from, from.clone().addScaledVector(dir, 2.8));
    if (!hit || Math.abs(hit.normal.y) > 0.18 || hit.normal.dot(dir) > -0.8) return null;
    const normal = hit.normal.clone();
    normal.y = 0;
    normal.normalize();
    const inside = hit.point.clone().addScaledVector(normal, -0.3);
    const cap = J.trace(V(inside.x, pos.y + 3.9, inside.z), V(inside.x, pos.y + 1.2, inside.z));
    if (!cap || cap.normal.y < 0.95 || cap.point.y - pos.y > 3.8) return null;
    const edge = V(hit.point.x, cap.point.y, hit.point.z);
    for (let depth = 1.5; depth <= 5.5; depth += 0.5) {
      const end = edge.clone().addScaledVector(normal, -depth);
      const y = J.floor(end, cap.point.y + 0.12);
      if (!Number.isFinite(y) || y > cap.point.y - 0.5 || y < pos.y - 1.2) continue;
      end.y = y + 0.04;
      if (!supported(end)) continue;
      const lift = pos.clone();
      lift.y = cap.point.y + 0.1;
      const over = end.clone();
      over.y = lift.y;
      const path = [pos.clone(), lift, over, end];
      if (clearPath(path)) return { path, edge, normal, root: J.root, id: hit.id };
    }
    return null;
  }
  function begin(type, dur, data = {}) {
    const action = { type, t: 0, dur, side: data.side || 0 };
    state = { ...data, action, root: J.root, rig: player.rig, char: player.char };
    player.action = action;
    player.vel.set(0, 0, 0);
    player.dashT = 0;
    player.onGround = false;
    player.visYaw = 0;
    keys.Space = false;
    log(type);
    try {
      sfx.whoosh();
    } catch (_) {}
    return true;
  }
  function cancel(reason = 'cancel') {
    if (!state) return;
    if (player.action === state.action) player.action = null;
    state = null;
    grabCD = Math.max(grabCD, 0.35);
    vaultCD = Math.max(vaultCD, 0.4);
    player.onGround = false;
    player.__jjsLast = player.pos.clone();
    if (player.rig?.body) player.rig.body.rotation.set(0, 0, 0);
    log(reason);
  }
  function tryVault() {
    if (!available() || !player.onGround || vaultCD > 0 || !keys.KeyW) return false;
    const candidate = findVault();
    if (!candidate) return false;
    vaultCD = 0.9;
    return begin('pk_vault', 0.68, candidate);
  }
  function tryGrab() {
    if (!available() || player.onGround || grabCD > 0) return false;
    const ledge = findLedge();
    if (!ledge || !clearSegment(player.pos, ledge.hang)) return false;
    return begin('pk_grab', 0.2, { ...ledge, from: player.pos.clone() });
  }
  function tryKick() {
    if (!available() || player.onGround || kickCD > 0 || !!keys.KeyA === !!keys.KeyD) return false;
    const inputSide = keys.KeyD ? 1 : -1,
      dir = camForward(),
      right = V(-dir.z, 0, dir.x).multiplyScalar(inputSide);
    const from = player.pos.clone().add(V(0, 2.7, 0)),
      hit = J.trace(from, from.clone().addScaledVector(right, 4));
    if (!hit || Math.abs(hit.normal.y) > 0.18 || hit.normal.dot(right) > -0.7 || hit.id === lastWall)
      return false;
    const normal = hit.normal.clone();
    normal.y = 0;
    normal.normalize();
    const side = normal.dot(V(Math.cos(player.facing), 0, -Math.sin(player.facing))) > 0 ? -1 : 1;
    kickCD = 0.5;
    lastWall = hit.id;
    return begin('pk_kick', 0.36, {
      side,
      normal,
      velocity: normal
        .clone()
        .multiplyScalar(28)
        .add(V(0, 13, 0))
    });
  }
  function climb() {
    if (!state || state.action.type !== 'pk_hang' || !wallAlive(state) || !supported(state.stand))
      return false;
    const up = player.pos.clone();
    up.y = state.stand.y + 0.1;
    const path = [player.pos.clone(), up, state.stand.clone()];
    if (!clearPath(path)) return false;
    return begin('pk_climb', 0.72, { ...state, path });
  }
  function drop() {
    if (!state) return;
    const normal = state.normal?.clone() || V();
    cancel('drop');
    player.vel.copy(normal.multiplyScalar(2));
    player.vel.y = -2;
    grabCD = 0.6;
  }
  function shimmy(side) {
    if (!state || state.action.type !== 'pk_hang') return false;
    const tangent = V(state.normal.z, 0, -state.normal.x).multiplyScalar(side);
    const next = player.pos.clone().addScaledVector(tangent, 1.2);
    let candidate = findLedge(next, state.normal.clone().negate(), 2.6);
    // A second probe turns around an outside corner if the adjacent face has
    // support. The swept body check still rejects a gap or blocked route.
    if (!candidate) {
      const around = next.clone().addScaledVector(state.normal, -1.3);
      candidate = findLedge(around, tangent.clone().negate(), 2.6);
    }
    if (
      !candidate ||
      Math.abs(candidate.edge.y - state.edge.y) > 0.65 ||
      !clearSegment(player.pos, candidate.hang)
    )
      return false;
    return begin('pk_shimmy', 0.35, { ...candidate, side, from: player.pos.clone() });
  }
  function beforeStep(dt) {
    vaultCD = Math.max(0, vaultCD - dt);
    grabCD = Math.max(0, grabCD - dt);
    kickCD = Math.max(0, kickCD - dt);
    if (player.onGround && !state) lastWall = null;
    if (
      state &&
      (player.action !== state.action ||
        state.rig !== player.rig ||
        state.char !== player.char ||
        !gameInputActive() ||
        interrupted() ||
        !inWorld() ||
        J.root !== state.root)
    )
      cancel('interrupted');
    if (!state) tryVault();
  }
  function moveTo(p, dt) {
    if (!clearSegment(player.pos, p)) {
      cancel('blocked');
      player.vel.set(0, 0, 0);
      return false;
    }
    player.vel.copy(p).sub(player.pos).divideScalar(Math.max(dt, 0.001));
    player.pos.copy(p);
    player.__jjsLast = p.clone();
    return true;
  }
  function pathPoint(path, t) {
    const segments = path.length - 1,
      at = Math.min(segments - 0.000001, Math.max(0, t) * segments),
      i = Math.floor(at);
    return path[i].clone().lerp(path[i + 1], smooth(at - i));
  }
  const oldStep = stepAction;
  stepAction = function (a, dt) {
    if (!parkour(a)) return oldStep(a, dt);
    if (!state || a !== state.action) return;
    const s = state,
      kind = a.type;
    if (kind !== 'pk_kick' && !wallAlive(s)) {
      cancel('support lost');
      player.vel.set(0, -1, 0);
      return;
    }
    if (s.normal && kind !== 'pk_kick') player.facing = Math.atan2(-s.normal.x, -s.normal.z);
    if (kind === 'pk_hang') {
      player.vel.set(0, 0, 0);
      if (keys.KeyS) {
        drop();
        return;
      }
      if (!!keys.KeyA !== !!keys.KeyD) shimmy(keys.KeyD ? 1 : -1);
      return;
    }
    if (kind === 'pk_kick') {
      // A short push followed by gravity; no invincibility or combat damage.
      s.velocity.y -= 34 * dt;
      const target = player.pos.clone().addScaledVector(s.velocity, dt);
      if (!moveTo(target, dt)) return;
    } else if (kind === 'pk_grab' || kind === 'pk_shimmy') {
      if (!moveTo(s.from.clone().lerp(s.hang, smooth(a.t / a.dur)), dt)) return;
    } else if (!moveTo(pathPoint(s.path, Math.min(1, a.t / a.dur)), dt)) return;
    if (a.t + 1e-6 >= a.dur) {
      if (kind === 'pk_grab' || kind === 'pk_shimmy') {
        begin('pk_hang', 3600, { ...s, from: undefined });
        player.vel.set(0, 0, 0);
      } else {
        const velocity = kind === 'pk_kick' ? s.velocity.clone() : s.normal.clone().multiplyScalar(-5);
        cancel('finished');
        player.vel.copy(velocity);
        if (kind !== 'pk_kick') {
          const end = s.path[s.path.length - 1];
          if (supported(end)) {
            player.pos.copy(end);
            player.onGround = true;
            player.vel.y = 0;
          }
        }
      }
    }
  };
  const oldDash = doDash;
  doDash = function () {
    if (state) return;
    if (tryKick()) return;
    return oldDash.apply(this, arguments);
  };
  // Space is edge-triggered in air, leaving grounded jumping and
  // combat-owned air variants with their owners.
  window.addEventListener(
    'keydown',
    (e) => {
      if (typingInUI(e) || !gameInputActive() || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.code === 'KeyA' || e.code === 'KeyD') && keys.KeyQ && !e.repeat) {
        keys[e.code] = true;
        if (tryKick()) {
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
      }
      if (e.code === 'Space' && !e.repeat) {
        if (state?.action.type === 'pk_hang') {
          climb();
          e.preventDefault();
          e.stopImmediatePropagation();
        } else if (tryGrab()) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }
      if (state && e.code === 'KeyS') {
        drop();
        keys.KeyS = true;
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );
  const oldHurt = hurtPlayer;
  hurtPlayer = function () {
    const hp = player.hp;
    const result = oldHurt.apply(this, arguments);
    if (player.hp < hp) cancel('hit');
    return result;
  };
  // Some character cinematics bypass the base movement update completely.
  // Release their handhold before those owners take control of the actor.
  const oldUpdate = updatePlayer;
  updatePlayer = function (dt) {
    if (state && (interrupted() || player.action !== state.action || !gameInputActive()))
      cancel('interrupted');
    return oldUpdate(dt);
  };
  const oldSwitch = switchChar;
  switchChar = function (id) {
    if (id !== player.char) cancel('character');
    return oldSwitch.apply(this, arguments);
  };
  window.addEventListener('blur', () => cancel('focus'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancel('hidden');
  });

  // Hand-authored joint poses: anticipation, contact, weight transfer, release.
  const P = {
    coil: {
      spine: [-0.28, 0, 0],
      shoulderL: [-1.3, 0, -0.28],
      shoulderR: [-1.3, 0, 0.28],
      elbowL: [-0.85, 0, 0],
      elbowR: [-0.85, 0, 0],
      hipL: [-0.65, 0, 0],
      hipR: [-0.45, 0, 0],
      kneeL: [1.1, 0, 0],
      kneeR: [0.8, 0, 0],
      height: -0.15
    },
    plant: {
      spine: [-0.5, -0.18, 0],
      shoulderL: [-1.7, 0, -0.24],
      shoulderR: [-1.45, 0, 0.24],
      elbowL: [-0.15, 0, 0],
      elbowR: [-0.28, 0, 0],
      hipL: [-1.45, 0, -0.28],
      hipR: [-0.95, 0, 0.25],
      kneeL: [1.95, 0, 0],
      kneeR: [1.55, 0, 0],
      height: -0.2
    },
    over: {
      spine: [-0.32, 0.27, -0.16],
      shoulderL: [-0.45, 0, -0.8],
      shoulderR: [0.5, 0, 0.75],
      elbowL: [-0.55, 0, 0],
      elbowR: [-1.2, 0, 0],
      hipL: [-0.95, 0, -0.4],
      hipR: [-0.45, 0, 0.4],
      kneeL: [1.6, 0, 0],
      kneeR: [1.1, 0, 0],
      height: -0.1
    },
    hang: {
      spine: [0.1, 0, 0],
      shoulderL: [-2.7, 0, -0.12],
      shoulderR: [-2.7, 0, 0.12],
      elbowL: [-0.32, 0, 0],
      elbowR: [-0.32, 0, 0],
      hipL: [-0.38, 0, -0.1],
      hipR: [-0.2, 0, 0.1],
      kneeL: [0.7, 0, 0],
      kneeR: [0.45, 0, 0],
      neck: [-0.18, 0, 0]
    },
    catch: {
      spine: [-0.12, 0, 0],
      shoulderL: [-2.85, 0, -0.2],
      shoulderR: [-2.85, 0, 0.2],
      elbowL: [-0.12, 0, 0],
      elbowR: [-0.12, 0, 0],
      hipL: [-0.8, 0, 0],
      hipR: [-0.45, 0, 0],
      kneeL: [1.1, 0, 0],
      kneeR: [0.85, 0, 0],
      height: -0.2
    },
    pull: {
      spine: [-0.36, 0, 0],
      shoulderL: [-2.1, 0, -0.2],
      shoulderR: [-2.1, 0, 0.2],
      elbowL: [-1.2, 0, 0],
      elbowR: [-1.2, 0, 0],
      hipL: [-1.45, 0, -0.2],
      hipR: [-0.42, 0, 0.12],
      kneeL: [1.95, 0, 0],
      kneeR: [0.9, 0, 0]
    },
    press: {
      spine: [-0.5, 0.16, 0],
      shoulderL: [-1, 0, -0.28],
      shoulderR: [-1, 0, 0.28],
      elbowL: [-0.12, 0, 0],
      elbowR: [-0.12, 0, 0],
      hipL: [-1.2, 0, 0],
      hipR: [-0.35, 0, 0],
      kneeL: [1.7, 0, 0],
      kneeR: [0.5, 0, 0],
      height: -0.1
    },
    land: {
      spine: [-0.24, 0, 0],
      shoulderL: [-0.45, 0, -0.3],
      shoulderR: [-0.4, 0, 0.3],
      elbowL: [-0.8, 0, 0],
      elbowR: [-0.9, 0, 0],
      hipL: [-0.3, 0, 0],
      hipR: [-0.22, 0, 0],
      kneeL: [0.6, 0, 0],
      kneeR: [0.5, 0, 0],
      height: -0.16
    },
    kickCoil: {
      spine: [-0.18, 0.35, 0.24],
      shoulderL: [-1.2, 0, -0.5],
      shoulderR: [-1.4, 0, 0.3],
      elbowL: [-0.95, 0, 0],
      elbowR: [-1.1, 0, 0],
      hipL: [-0.3, 0, -0.2],
      hipR: [-1.2, 0, 0.8],
      kneeL: [0.6, 0, 0],
      kneeR: [1.7, 0, 0]
    },
    kickPush: {
      spine: [-0.15, -0.15, -0.35],
      shoulderL: [-0.5, 0, -0.7],
      shoulderR: [-0.35, 0, 0.6],
      elbowL: [-0.5, 0, 0],
      elbowR: [-0.7, 0, 0],
      hipL: [-0.7, 0, -0.1],
      hipR: [-0.18, 0, 0.65],
      kneeL: [1.25, 0, 0],
      kneeR: [0.08, 0, 0]
    },
    air: {
      spine: [-0.12, 0, 0],
      shoulderL: [-0.6, 0, -0.38],
      shoulderR: [-0.35, 0, 0.42],
      elbowL: [-0.8, 0, 0],
      elbowR: [-1, 0, 0],
      hipL: [-0.55, 0, 0],
      hipR: [0.15, 0, 0],
      kneeL: [0.8, 0, 0],
      kneeR: [0.45, 0, 0]
    }
  };
  const sequences = {
    pk_vault: [
      [0, 'coil'],
      [0.2, 'plant'],
      [0.48, 'over'],
      [0.8, 'land'],
      [1, 'land']
    ],
    pk_grab: [
      [0, 'catch'],
      [1, 'hang']
    ],
    pk_climb: [
      [0, 'hang'],
      [0.25, 'pull'],
      [0.58, 'press'],
      [0.84, 'land'],
      [1, 'land']
    ],
    pk_kick: [
      [0, 'kickCoil'],
      [0.2, 'kickPush'],
      [0.65, 'air'],
      [1, 'air']
    ]
  };
  function grip(r, side, target, weight) {
    const sh = r['shoulder' + side],
      el = r['elbow' + side],
      hand = r['hand' + side];
    r.root.updateMatrixWorld(true);
    const p = sh.parent.worldToLocal(r.root.localToWorld(target.clone()));
    const delta = p.clone().sub(sh.position),
      axis = delta.clone().normalize();
    const l1 = el.position.length(),
      l2 = Math.max(0.5, (hand?.position.length() || 1.2) - 0.12);
    const distance = Math.max(0.05, Math.min(l1 + l2 - 0.005, delta.length()));
    const goal = sh.position.clone().addScaledVector(axis, distance);
    const pole = V(side === 'L' ? -1 : 1, -0.2, -0.5);
    pole.addScaledVector(axis, -pole.dot(axis)).normalize();
    const along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance);
    const elbow = sh.position
      .clone()
      .addScaledVector(axis, along)
      .addScaledVector(pole, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
    const q = new THREE.Quaternion().setFromUnitVectors(
      V(0, -1, 0),
      elbow.clone().sub(sh.position).normalize()
    );
    const qe = new THREE.Quaternion().setFromUnitVectors(
      V(0, -1, 0),
      goal.sub(elbow).normalize().applyQuaternion(q.clone().invert())
    );
    sh.quaternion.slerp(q, weight);
    el.quaternion.slerp(qe, weight);
  }
  function pose(r, a) {
    resetPose(r);
    if (r.body) r.body.rotation.set(0, 0, 0);
    let seq = sequences[a.type] || [
        [0, 'hang'],
        [1, 'hang']
      ],
      t = Math.min(1, a.t / Math.max(0.01, a.dur));
    let i = 0;
    while (i < seq.length - 2 && t > seq[i + 1][0]) i++;
    const p = P[seq[i][1]],
      q = P[seq[i + 1][1]],
      w = smooth((t - seq[i][0]) / (seq[i + 1][0] - seq[i][0]));
    for (const j of JOINTS) {
      const x = p[j] || [0, 0, 0],
        y = q[j] || [0, 0, 0];
      r[j].rotation.set(...x.map((v, k) => lerp(v, y[k], w)));
    }
    r.hips.position.y = r.hipsBaseY + lerp(p.height || 0, q.height || 0, w);
    if (a.type === 'pk_hang') {
      r.spine.rotation.z = Math.sin(a.t * 2.6) * 0.025;
      r.kneeL.rotation.x += Math.sin(a.t * 3) * 0.07;
    }
    if (a.type === 'pk_shimmy') {
      const side = a.side || 1,
        k = Math.sin(t * Math.PI);
      r.spine.rotation.z = side * k * 0.16;
      r['shoulder' + (side > 0 ? 'R' : 'L')].rotation.z += side * k * 0.55;
      r.hips.rotation.z = -side * k * 0.12;
      r.kneeL.rotation.x += k * 0.18;
    }
    if (a.type === 'pk_kick' && a.side < 0) {
      for (const joint of ['shoulder', 'elbow', 'hip', 'knee', 'ankle']) {
        const left = r[joint + 'L'].rotation.clone(),
          right = r[joint + 'R'].rotation;
        r[joint + 'L'].rotation.set(right.x, -right.y, -right.z);
        right.set(left.x, -left.y, -left.z);
      }
      r.spine.rotation.y *= -1;
      r.spine.rotation.z *= -1;
    }
    if (['pk_hang', 'pk_grab', 'pk_shimmy'].includes(a.type)) {
      for (const side of ['L', 'R']) {
        const shift =
          a.type === 'pk_shimmy' && side === (a.side > 0 ? 'L' : 'R')
            ? -a.side * Math.sin(t * Math.PI) * 0.3
            : 0;
        grip(
          r,
          side,
          V((side === 'L' ? -0.6 : 0.6) + shift, REACH + 0.03, 1.08),
          a.type === 'pk_grab' ? smooth(t) : 1
        );
      }
    }
    if (r.td) {
      r.td.sash.forEach((g, i) => (g.rotation.x = Math.sin(a.t * 12 - i) * 0.13));
    }
  }
  const oldPose = poseAction;
  poseAction = function (r, a) {
    if (parkour(a)) {
      pose(r, a);
      return;
    }
    return oldPose(r, a);
  };
  M.pose = pose;

  const animStates = new WeakMap();
  function locomotion(r, t, gait, move, run, onGround, vy) {
    let st = animStates.get(r);
    if (!st) {
      st = { ground: onGround, time: t, land: 0, side: 0, forward: 1 };
      animStates.set(r, st);
    }
    const dt = Math.max(0, Math.min(0.05, t - st.time));
    st.time = t;
    if (onGround && !st.ground) st.land = 0.22;
    st.ground = onGround;
    st.land = Math.max(0, st.land - dt);
    const velocity = r === player.rig ? player.vel : r.__travel;
    if (velocity && Math.hypot(velocity.x, velocity.z) > 0.2) {
      const yaw = r === player.rig ? player.facing : r.root.rotation.y,
        sp = Math.hypot(velocity.x, velocity.z);
      const blend = 1 - Math.exp(-dt * 15);
      st.side = lerp(st.side, (velocity.x * Math.cos(yaw) - velocity.z * Math.sin(yaw)) / sp, blend);
      st.forward = lerp(st.forward, (velocity.x * Math.sin(yaw) + velocity.z * Math.cos(yaw)) / sp, blend);
    }
    const w = smooth(move),
      speed = smooth(run),
      br = Math.sin(t * 2.1);
    const phase = gait * 0.63,
      beat = Math.sin(phase),
      other = -beat;
    r.spine.rotation.set(
      0.03 + br * 0.018 - w * (0.1 + speed * 0.18),
      Math.sin(t * 0.6) * 0.025 * (1 - w) + beat * w * 0.075,
      -st.side * w * (0.08 + speed * 0.08)
    );
    r.neck.rotation.set(-r.spine.rotation.x * 0.55, -r.spine.rotation.y * 0.5, -r.spine.rotation.z * 0.5);
    r.hips.rotation.set(0, -beat * w * 0.085, st.side * w * 0.04);
    r.hips.position.y =
      r.hipsBaseY - br * 0.016 * (1 - w) - (1 - Math.abs(Math.cos(phase))) * w * (0.045 + speed * 0.065);
    for (const [side, cycle] of [
      ['L', beat],
      ['R', other]
    ]) {
      const mirror = side === 'L' ? -1 : 1,
        amp = 0.5 + speed * 0.45;
      r['hip' + side].rotation.set(
        -cycle * amp * w * st.forward,
        0,
        -cycle * w * st.side * 0.42 + mirror * 0.035 * (1 - w)
      );
      r['knee' + side].rotation.x =
        0.06 + Math.max(0, Math.cos(phase + (side === 'R' ? Math.PI : 0))) * w * (0.55 + speed * 0.7);
      r['ankle' + side].rotation.x = -(r['hip' + side].rotation.x + r['knee' + side].rotation.x) * 0.4;
      r['shoulder' + side].rotation.set(
        0.04 + cycle * w * (0.4 + speed * 0.35),
        0,
        mirror * (0.08 + speed * 0.07)
      );
      r['elbow' + side].rotation.x = -0.2 - speed * w * 0.8 - Math.max(0, -cycle) * w * 0.3;
    }
    if (!onGround) {
      const up = smooth((vy + 2) / 12);
      r.spine.rotation.x = lerp(-0.13, 0.08, up);
      r.shoulderL.rotation.set(-0.55, 0, -0.38);
      r.shoulderR.rotation.set(-0.55, 0, 0.38);
      r.elbowL.rotation.x = r.elbowR.rotation.x = -0.7;
      r.hipL.rotation.x = lerp(-0.25, -0.75, up);
      r.hipR.rotation.x = 0.18;
      r.kneeL.rotation.x = lerp(0.45, 1.05, up);
      r.kneeR.rotation.x = 0.5;
    } else if (st.land > 0) {
      const weight = Math.sin((Math.PI * st.land) / 0.22);
      r.hips.position.y -= weight * 0.2;
      r.spine.rotation.x -= weight * 0.14;
      r.hipL.rotation.x -= weight * 0.2;
      r.hipR.rotation.x -= weight * 0.2;
      r.kneeL.rotation.x += weight * 0.45;
      r.kneeR.rotation.x += weight * 0.45;
    }
  }
  const help = document.createElement('div');
  help.className = 'kit-row';
  help.id = 'jjParkourHelp';
  help.innerHTML =
    '<strong>Parkour · JJS map</strong><br>Walk forward into a low barrier to vault. In the air, press <b>Space</b> near a ledge to grab. While hanging, <b>A / D</b> moves sideways, <b>Space</b> climbs, and <b>S</b> drops. In the air beside a wall, hold <b>A or D</b> toward it and press <b>Q</b> to kick away. <b>W W</b> sprints; <b>Shift</b> toggles mouse lock.';
  document.querySelector('#menu .ctrl-kits')?.prepend(help);
  const hint = document.createElement('div');
  hint.id = 'jjParkourHint';
  hint.style.cssText =
    'position:fixed;left:50%;top:65%;transform:translateX(-50%);color:white;background:#191919c9;padding:8px 12px;border-radius:4px;z-index:10;font:12px Arial;text-align:center;pointer-events:none;display:none;max-width:90vw';
  document.body.appendChild(hint);
  const oldHUD = updateHUD;
  updateHUD = function (dt) {
    oldHUD(dt);
    const hang = state && ['pk_hang', 'pk_shimmy', 'pk_grab'].includes(state.action.type);
    hint.style.display = hang && gameInputActive() ? 'block' : 'none';
    hint.textContent = 'A / D · move along ledge  |  Space · climb  |  S · drop';
  };
})();
