/* Execute the existing player skills for another actor. Every callback keeps its
   caster, targets and character state; the local player's bindings are restored
   before returning, including when a skill throws or deals damage. */
(function () {
  'use strict';
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const registry = window.JJCHARCAST;
  registry.gojo = {
    cast: [castRed, castRapid, castTwofold, castPalm, castLimitless],
    scope: [...(registry.gojo?.scope || []), JJVOID],
    awakeEnd: () => JJVOID.close()
  };
  const states = Object.values(registry)
    .flatMap((r) => [r.state, ...(r.scope || [])])
    .filter(Boolean);
  if (window.JJAW) states.push(JJAW);
  const snapshot = (o) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v !== 'function'));
  function clone(v) {
    if (!v || typeof v !== 'object') return v;
    if (v.isVector3) return v.clone();
    if (v instanceof Map) return new Map([...v].map(([k, x]) => [k, clone(x)]));
    if (v instanceof Set) return new Set([...v].map(clone));
    if (Array.isArray(v)) return v.map(clone);
    if (Object.getPrototypeOf(v) === Object.prototype)
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)]));
    return v;
  }
  const templates = states.map((s) => clone(snapshot(s)));
  const baseCD = { ...cds };
  const menus = Object.fromEntries(
    Object.entries(CHARS).map(([id, c]) => [
      id,
      ['1', '2', '3', '4', 'R'].map((key) => ({ ...c.moves.find((m) => m.key === key) }))
    ])
  );
  // Maximum useful distances, in menu order (1–4, R). Buffs/counters are
  // selected before a combo or in response to an incoming attack.
  const ranges = {
    gojo: [32, 6, 3.5, 5, 24],
    naoya: [5, 5, 6, 22, 25],
    yuji: [7, 9, 8, 7, 10],
    hakari: [14, 26, 7, 10, 8],
    choso: [32, 26, 16, 22, 8],
    megumi: [28, 26, 25, 24, 10],
    higuruma: [8, 12, 24, 18, 10],
    yuta: [18, 24, 12, 13, 24],
    muta: [34, 28, 16, 30, 9],
    ryu: [34, 25, 30, 8, 32],
    nanami: [8, 10, 17, 25, 15],
    hanami: [16, 23, 10, 22, 10],
    mahito: [8, 25, 8, 20, 18],
    todo: [12, 28, 7, 8, 8]
  };
  const minimum = {
    yuta: [7.5, 9, 5, 5, 0],
    muta: [7, 0, 7, 0, 0],
    higuruma: [6, 0, 7, 0, 0],
    megumi: [0, 9, 0, 0, 0],
    nanami: [6, 0, 0, 0, 0],
    ryu: [0, 0, 7, 0, 0]
  };
  const awakeCDs = {
    gojo: ['awBlue', 'awRed', 'awPurple', 'awDomain'],
    yuji: ['s1', 's2', 's3', 's4'],
    hakari: ['ha1', 'ha2', 'ha3', 'ha4'],
    choso: ['ca1', 'ca2', 'ca3', 'ca4'],
    megumi: ['ga1', 'ga2', 'ga3', 'gdom'],
    mahito: ['mha1', 'mha2', 'mha3', 'mha4'],
    todo: ['tda1', 'tda2', 'tda3', 'tda4'],
    naoya: ['n1', 'n2', 'n3', 'n4']
  };
  const awakeRanges = {
    gojo: [30, 40, 50, 28, 24],
    yuji: [34, 9, 45, 30, 10],
    hakari: [28, 9, 28, 14, 8],
    choso: [36, 28, 24, 28, 8],
    megumi: [30, 28, 24, 28, 10],
    mahito: [8, 12, 15, 25, 10],
    todo: [12, 14, 10, 11, 8]
  };
  const awakeDur = {
    gojo: 34,
    yuji: 30,
    hakari: 30,
    choso: 26,
    megumi: 30,
    mahito: 60,
    todo: 50,
    naoya: 20
  };
  function menu(e) {
    const base = menus[e.char],
      k = init(e);
    if (!k.awake || !awakeCDs[e.char]) return base;
    return base.map((m, i) => (i < 4 ? { ...m, cd: awakeCDs[e.char][i], lbl: awakeCDs[e.char][i] } : m));
  }
  function charge(e) {
    if (!e?.ai) return 0;
    const k = init(e);
    if (k.awake) return 0;
    const own = k.states[states.indexOf(registry[e.char].state)],
      aw = k.states[states.indexOf(JJAW)];
    return Math.min(100, Math.max(k.charge, own?.charge || 0, aw?.charge || 0));
  }
  function gain(e, n) {
    if (!e?.ai || e.dead || !awakeDur[e.char]) return;
    const k = init(e);
    if (!k.awake) k.charge = Math.min(100, k.charge + Math.max(0, n));
  }
  function awakened(e) {
    if (!e || e.dead) return false;
    if (e.ai) return e.ai.remote ? !!e.ai.awakeRemote : !!e.ai.kit?.awake;
    if (e.net) {
      const f = MPJJ.fighters[e.net.id];
      return !!(f?.awakened || f?.aw || f?.fever);
    }
    return !!(
      JJAW.active ||
      JJAW.cine ||
      JJAW.yuji ||
      JJAW.choso ||
      JJAW.megumi ||
      JJHAKARI.fever > 0 ||
      (e.char === 'mahito' && JJMAHITO.active) ||
      (e.char === 'todo' && JJTODO.active) ||
      JJNAOYA.rushing()
    );
  }
  function canAwaken(e) {
    return (
      !!awakeDur[e.char] &&
      charge(e) >= 100 &&
      !init(e).awake &&
      JJAICOMBAT.free(e) &&
      !e.action &&
      !e.blocking &&
      !e.react
    );
  }
  function syncAwake(e, remaining) {
    const on = remaining > 0;
    if (e.char === 'gojo') {
      JJAW.active = on;
      JJAW.cine = false;
      JJAW.t = awakeDur.gojo - remaining;
    }
    if (e.char === 'yuji') {
      JJAW.yuji = JJAW.sukuna = on;
      JJAW.yujiT = remaining;
    }
    if (e.char === 'choso') {
      JJAW.choso = on;
      JJAW.chosoT = remaining;
    }
    if (e.char === 'megumi') {
      JJAW.megumi = on;
      JJAW.megumiT = remaining;
    }
    if (e.char === 'hakari') JJHAKARI.fever = remaining;
    if (e.char === 'mahito') {
      JJMAHITO.active = on;
      JJMAHITO.remaining = remaining;
      JJMAHITO.basePage = false;
    }
    if (e.char === 'todo') {
      JJTODO.active = on;
      JJTODO.remaining = remaining;
      JJTODOVOX.awake(e.rig, on && !(e.action?.type === 'td_awaken' && e.action.t < 2.55));
    }
  }
  function awaken(e, t) {
    if (!canAwaken(e)) return false;
    const k = init(e);
    k.target = t;
    k.charge = 0;
    k.awake = true;
    k.remaining = awakeDur[e.char];
    run(e, () => {
      JJAW.charge = 0;
      JJAW.ready = false;
      if (e.char === 'mahito') {
        JJMAHITO.charge = 100;
        JJMAHITO.awaken();
      } else if (e.char === 'todo') {
        JJTODO.charge = 100;
        JJTODO.awaken();
      } else {
        e.action = {
          type: e.char === 'naoya' ? 'ai_nrush' : 'ai_awaken',
          t: 0,
          dur: e.char === 'naoya' ? 20 : 1.4,
          dir: V(Math.sin(e.facing), 0, Math.cos(e.facing)),
          hits: new Map()
        };
        const color = new THREE.Color(CHARS[e.char].glow).getHex();
        JJFX.ring(e.pos.clone().add(V(0, 0.15, 0)), color, { maxR: 9, life: 1.1 });
        JJFX.dust(e.pos.clone(), 8, 0xdacfc0, 7, 3);
        k.aura = JJFX.aura(() => e.pos, color);
      }
      syncAwake(e, k.remaining);
      e.iframes = Math.max(e.iframes || 0, e.action?.type === 'td_awaken' ? 3.7 : 1.4);
      e.hp = Math.min(e.maxHp, e.hp + (e.char === 'todo' || e.char === 'mahito' ? 0 : 25));
      for (const key of awakeCDs[e.char]) k.cd[key] = 0;
      if (e.char === 'gojo') JJAW.setLook(e.rig, true);
    });
    announce(e, 5, null);
    e.ai.goal = null;
    e.ai.guardT = 0;
    e.blocking = false;
    JJAISERVER.castEvent(e, { type: 'ai_awaken', id: ++e.ai.serial });
    return true;
  }
  function endAwake(e) {
    const k = init(e);
    run(e, () => {
      syncAwake(e, 0);
      registry[e.char].awakeEnd?.();
      if (e.char === 'gojo') JJAW.setLook(e.rig, false);
    });
    k.aura?.stop();
    k.aura = null;
    k.awake = false;
    k.remaining = 0;
    k.charge = 0;
    const own = k.states[states.indexOf(registry[e.char].state)],
      aw = k.states[states.indexOf(JJAW)];
    if (own && 'charge' in own) own.charge = 0;
    aw.charge = 0;
    aw.ready = false;
  }
  function remoteAwake(e, on) {
    const k = init(e);
    if (k.remoteSetup && k.awake === on) return;
    k.remoteSetup = true;
    k.awake = on;
    k.remaining = on ? 30 : 0;
    run(e, () => syncAwake(e, k.remaining));
    if (e.char === 'gojo') JJAW.setLook(e.rig, on);
    if (e.char === 'todo') JJTODOVOX.awake(e.rig, on);
    if (on && !k.aura) k.aura = JJFX.aura(() => e.pos, new THREE.Color(CHARS[e.char].glow).getHex());
    else if (!on && k.aura) {
      k.aura.stop();
      k.aura = null;
    }
  }
  function rush(e, a, dt) {
    const k = init(e),
      t = k.target;
    if (!t || t.dead) {
      e.action = null;
      return;
    }
    const want = t.pos
      .clone()
      .addScaledVector(t.vel || V(), 0.12)
      .sub(e.pos)
      .setY(0)
      .normalize();
    a.dir.lerp(want, Math.min(1, dt * 4.5)).normalize();
    JJFIGHT.actors.sweepMove(e, a.dir.clone().multiplyScalar(54 * dt));
    e.facing = Math.atan2(a.dir.x, a.dir.z);
    e.vel.x = e.vel.z = 0;
    if (
      e.pos.distanceTo(t.pos) < 5 &&
      (a.hits.get(t) || -10) < a.t - 0.8 &&
      JJFIGHT.actors.visible(e.pos.clone().add(V(0, 3, 0)), t.pos.clone().add(V(0, 3, 0)))
    ) {
      a.hits.set(t, a.t);
      JJAISERVER.hit(e, t, 8, a.dir.clone().multiplyScalar(12).setY(3), {
        source: e.pos.clone(),
        guardable: true,
        stun: 0.5,
        kind: 'skill',
        skill: true,
        id: ++e.ai.serial
      });
    }
    if (Math.floor(a.t * 12) !== Math.floor((a.t - dt) * 12) && e.pos.distanceTo(player.pos) < 120)
      ghostAfterimage(e.rig, 0xcde9ff, 0.2);
  }
  let current = null;
  const K = (window.JJAIKITS = {
    init,
    reset,
    cancel,
    cast,
    tick,
    pose,
    run,
    outside,
    select,
    variant,
    isSkill,
    menu: menu,
    cooldown: (e, slot) => init(e).cd[menu(e)[slot]?.cd] || 0,
    defend,
    remotePose,
    pack,
    unpack,
    damageScale,
    awaken,
    awakened,
    canAwaken,
    gain,
    charge,
    remoteAwake
  });
  function init(e) {
    if (e.ai.kit?.char === e.char) return e.ai.kit;
    if (e.ai.kit) reset(e);
    const k = (e.ai.kit = {
      char: e.char,
      charge: 0,
      awake: false,
      remaining: 0,
      aura: null,
      cd: Object.fromEntries(Object.keys(baseCD).map((key) => [key, 0])),
      states: templates.map(clone),
      keys: {},
      proxies: new WeakMap(),
      timers: new Set(),
      effects: [],
      roots: new Set(),
      active: true,
      last: null,
      target: null,
      hits: 0,
      casts: [],
      floor: 0
    });
    for (const [key, value] of Object.entries({
      visYaw: e.facing,
      gait: 0,
      attackT: 0,
      attackArm: 0,
      comboN: 0,
      comboReset: 0,
      ghostAcc: 0,
      dashCh: 2,
      rWindow: 0,
      vis24: 0,
      proj: 0
    }))
      if (e[key] === undefined) e[key] = value;
    return k;
  }
  function reset(e) {
    const k = e.ai.kit;
    if (!k) return;
    const char = e.char;
    e.char = k.char;
    cancel(e);
    e.char = char;
    if (k.awake) endAwake(e);
    k.aura?.stop();
    k.active = false;
    k.timers.clear();
    k.effects.length = 0;
    // Spell roots are owned by this incarnation, never by another fighter.
    for (const root of k.roots) if (root !== e.rig.root) root.removeFromParent();
    k.roots.clear();
    e.ai.kit = null;
  }
  function loadState(o, data) {
    for (const key of Object.keys(o)) if (typeof o[key] !== 'function' && !(key in data)) delete o[key];
    Object.assign(o, data);
  }
  function enter(e) {
    const k = init(e),
      parent = current;
    const indexes = [
      states.indexOf(registry[e.char].state),
      ...(registry[e.char].scope || []).map((o) => states.indexOf(o)),
      states.indexOf(window.JJAW)
    ].filter((i, n, all) => i >= 0 && all.indexOf(i) === n);
    const saved = {
      player,
      enemies,
      cds,
      keys,
      camYaw,
      camPitch,
      cursorTarget,
      aimPoint,
      addFx,
      addShake,
      hitstop,
      showSplash,
      startShatter,
      buildMovesBar,
      notice: window.JJNOTICE,
      timeout: window.setTimeout,
      clearTimeout: window.clearTimeout,
      add: scene.add,
      active: MPJJ.active,
      states: indexes.map((i) => snapshot(states[i])),
      ui: [],
      moves: CHARS[e.char].moves,
      locked: JJFIGHT.locked,
      cameraPos: camera.position.clone(),
      cameraQuat: camera.quaternion.clone(),
      cameraFov: camera.fov,
      background: scene.background,
      fog: scene.fog
    };
    const undoNaoya = registry.naoya.isolate();
    const candidates = JJAISERVER.actors().filter((t) => t !== e && !JJAISERVER.friendly(e, t));
    player = e;
    enemies = candidates.map((t) => targetProxy(e, t));
    cds = k.cd;
    keys = k.keys;
    camYaw = e.facing + Math.PI;
    camPitch = 0;
    indexes.forEach((i) => loadState(states[i], k.states[i]));
    JJFIGHT.locked = () =>
      e.dead || e.rag || e.frameT > 0 || e.stunT > 0 || e.blocking || e.cineHold || e.tdHold;
    cursorTarget = (cone = 0.94, distance = 60) => {
      const t = k.target;
      if (!t || t.dead || t.pos.distanceTo(e.pos) > distance) return null;
      return targetProxy(e, t);
    };
    aimPoint = (distance = 50) => {
      const delta = (k.target?.pos || e.pos).clone().sub(e.pos).clampLength(0, distance);
      return e.pos.clone().add(delta);
    };
    addShake = hitstop = showSplash = startShatter = buildMovesBar = window.JJNOTICE = () => {};
    for (const [o, names] of [
      [window.JJFX, ['flash', 'tint', 'zoom', 'mangaLines', 'letterbox']],
      [window.JJANIM, ['camKick', 'camRelease', 'camTo']],
      [window.JJSTAGE, ['hide', 'show', 'hud']],
      [window.JJAW, ['theme']]
    ]) {
      if (!o) continue;
      for (const name of names)
        if (typeof o[name] === 'function') {
          saved.ui.push([o, name, o[name]]);
          o[name] = () => {};
        }
    }
    MPJJ.active = false;
    scene.add = function (...objects) {
      for (const obj of objects) k.roots.add(obj);
      return saved.add.apply(this, objects);
    };
    addFx = function (effect) {
      // A character's effects share one actor context per simulation frame.
      // This keeps 100 fighters from rebuilding target proxies for every mote.
      k.effects.push(effect);
      return effect;
    };
    window.setTimeout = function (fn, ms = 0, ...args) {
      if (typeof fn !== 'function') return 0;
      const job = { t: Math.max(0, ms / 1000), fn: () => fn(...args) };
      k.timers.add(job);
      return job;
    };
    window.clearTimeout = function (job) {
      if (!k.timers.delete(job)) saved.clearTimeout(job);
    };
    const frame = {
      e,
      leave() {
        indexes.forEach((i, n) => {
          k.states[i] = snapshot(states[i]);
          loadState(states[i], saved.states[n]);
        });
        player = saved.player;
        enemies = saved.enemies;
        cds = saved.cds;
        keys = saved.keys;
        camYaw = saved.camYaw;
        camPitch = saved.camPitch;
        cursorTarget = saved.cursorTarget;
        aimPoint = saved.aimPoint;
        addFx = saved.addFx;
        CHARS[e.char].moves = saved.moves;
        JJFIGHT.locked = saved.locked;
        addShake = saved.addShake;
        hitstop = saved.hitstop;
        showSplash = saved.showSplash;
        startShatter = saved.startShatter;
        buildMovesBar = saved.buildMovesBar;
        window.JJNOTICE = saved.notice;
        window.setTimeout = saved.timeout;
        window.clearTimeout = saved.clearTimeout;
        scene.add = saved.add;
        MPJJ.active = saved.active;
        for (const [o, name, fn] of saved.ui) o[name] = fn;
        camera.position.copy(saved.cameraPos);
        camera.quaternion.copy(saved.cameraQuat);
        if (camera.fov !== saved.cameraFov) {
          camera.fov = saved.cameraFov;
          camera.updateProjectionMatrix();
        }
        scene.background = saved.background;
        scene.fog = saved.fog;
        undoNaoya();
        current = parent;
      }
    };
    current = frame;
    return frame;
  }
  function run(e, fn) {
    if (current?.e === e) return fn();
    if (current) return outside(() => run(e, fn));
    enter(e);
    try {
      return fn();
    } finally {
      current.leave();
    }
  }
  function outside(fn) {
    if (!current) return fn();
    const e = current.e;
    current.leave();
    try {
      return fn();
    } finally {
      enter(e);
    }
  }
  function targetProxy(source, target) {
    const k = init(source);
    if (k.proxies.has(target)) return k.proxies.get(target);
    const human = !target.ai && !target.net;
    if (human) {
      target.anchorPos ||= target.pos.clone();
      target.lockPos ||= target.pos.clone();
      for (const key of ['anchorT', 'lockT', 'stunT', 'frameT', 'proj']) target[key] ||= 0;
    }
    function damage(amount, knock, opts = {}, direct = false) {
      return outside(() => {
        if (!k.active || target.dead || source.dead) return false;
        const meta = {
          source: source.pos.clone(),
          guardable: !direct && opts.guardable !== false,
          breakGuard: !!opts.breakGuard,
          stun: opts.stun ?? 0.35,
          down: 0,
          variant: 'normal',
          kind: 'skill',
          id: ++source.ai.serial,
          skill: true,
          opts
        };
        const hit = JJAISERVER.hit(source, target, amount, knock || V(), meta);
        if (hit) {
          source.ai.confirm = true;
          source.ai.lastHit = JJAISERVER.time;
          k.hits++;
        }
        return hit;
      });
    }
    const proxy = new Proxy(target, {
      get(t, key) {
        if (key === 'damage') return damage;
        if (key === 'directDamage')
          return (n, color, kill = false) =>
            damage(kill ? n : Math.min(n, Math.max(0, t.hp - 1)), V(), { color }, true);
        if (key === 'drawBars' && human) return () => {};
        if (key === 'die' && human) return () => damage(t.hp, V(), {}, true);
        if (key === 'enterFrame' && human) return () => outside(() => framePlayer());
        if (key === 'unframe' && human) return () => outside(() => unframePlayer());
        if (key === 'applyProj' && human)
          return (amount) =>
            outside(() => {
              player.proj = Math.min(100, (player.proj || 0) + amount);
              if (player.proj >= 100) framePlayer();
            });
        if (key === 'net') return null; // control/damage use the AI authority channel
        const value = Reflect.get(t, key);
        return typeof value === 'function' ? value.bind(t) : value;
      },
      set(t, key, value) {
        Reflect.set(t, key, value);
        if (['anchorT', 'lockT', 'cineHold', 'tdHold', 'mhConsumed'].includes(key)) {
          t.__aiHeldBy = value ? source : t.__aiHeldBy;
        }
        return true;
      }
    });
    k.proxies.set(target, proxy);
    return proxy;
  }
  function isSkill(a) {
    return !!a?.aiCharacterSkill;
  }
  function announce(e, slot, before) {
    const k = init(e),
      a = e.action;
    if (a && a !== before) {
      a.aiCharacterSkill = true;
      a.aiSlot = slot;
      a.id = ++e.ai.serial;
      k.last = a;
      e.ai.history.push('skill ' + (menu(e)[slot]?.lbl || a.type) + ' [' + a.type + ']');
      if (e.ai.history.length > 64) e.ai.history.shift();
      k.casts.push(a.type);
      if (k.casts.length > 64) k.casts.shift();
      JJAISERVER.castEvent?.(e, a);
    }
    const state = k.states[states.indexOf(registry[e.char].state)];
    e.ai.mode = state?.mode || 0;
  }
  function cast(e, target, slot) {
    const k = init(e),
      reg = registry[e.char];
    if (!reg?.cast[slot] || K.cooldown(e, slot) > 0 || e.dead) return false;
    const before = e.action;
    const cancelM1 =
      before?.type === 'bc_m1' && before.n < 3 && e.ai.confirm && before.t >= before.start + 0.16;
    const cancelDash = before?.type === 'bc_dash' && before.kind !== 'front' && before.t >= 0.1;
    if (before && !cancelM1 && !cancelDash) return false;
    k.target = target;
    k.floor = worldFloor(e.pos, e.pos.y + 0.2);
    e.facing = Math.atan2(target.pos.x - e.pos.x, target.pos.z - e.pos.z);
    e.rig.root.position.copy(e.pos);
    e.rig.root.rotation.y = e.facing;
    e.rig.root.updateMatrixWorld(true);
    e.action = null;
    const priorCD = K.cooldown(e, slot),
      priorMode = e.ai.mode;
    run(e, () => (k.awake && slot < 4 && reg.awakeCast ? reg.awakeCast[slot] : reg.cast[slot])());
    // Bots commit to an arm stance before changing it again.
    if (e.char === 'mahito' && slot === 4) k.cd.mhMode = 3;
    announce(e, slot, before);
    const success = !!e.action || K.cooldown(e, slot) > priorCD || e.ai.mode !== priorMode;
    if (!success) e.action = before;
    else {
      e.blocking = false;
      e.ai.guardT = 0;
      e.ai.comboReset = 1.2;
      e.ai.goal = null;
    }
    return success;
  }
  function variant(e) {
    const a = e.action,
      k = init(e),
      type = a?.type;
    if (!isSkill(a) || a.aiVariant) return false;
    let fn;
    if (e.char === 'todo' && a.type === 'b3' && a.t >= 0.26 && a.t <= 0.4) fn = () => JJTODO.cast(3);
    if (e.char === 'todo' && a.type === 'b2' && a.t > 0.3 && a.t < 0.6) fn = () => JJTODO.cast(2);
    if (e.char === 'mahito' && a.type === 'mh_focus' && a.t >= 0.23 && a.t <= 0.36)
      fn = () => JJMAHITO.cast(3);
    if (
      e.char === 'mahito' &&
      a.type === 'mh_repel' &&
      a.t >= 0.34 &&
      a.t <= 0.56 &&
      k.target?.pos.distanceTo(e.pos) > 9
    )
      fn = () => JJMAHITO.cast(3);
    if (!fn) return false;
    a.aiVariant = true;
    run(e, fn);
    if (e.action !== a || e.action?.type !== type) {
      announce(e, a.aiSlot, null);
      return true;
    }
    return false;
  }
  function cancel(e) {
    const k = e.ai.kit;
    if (!k) return;
    const a = k.last;
    if (a)
      run(e, () => {
        if (a.type === 'aw_domain') JJVOID.close();
        registry[e.char].release?.(a);
        if (a.aura?.stop) a.aura.stop();
        if (a.doors) for (const door of a.doors) door.removeFromParent();
      });
    outside(() => {
      for (const t of JJAISERVER.actors())
        if (t.__aiHeldBy === e) {
          t.anchorT = t.lockT = 0;
          t.cineHold = t.tdHold = t.mhConsumed = false;
          t.__aiHeldBy = null;
          JJAISERVER.skillControl?.(e, t, false);
        }
    });
    k.last = null;
    if (e.rig.tanto) e.rig.tanto.visible = false;
    e.visYaw = 0;
  }
  function tick(e, dt) {
    tickAction(e, dt);
    const k = init(e);
    if (k.effects.length)
      run(e, () => {
        for (let i = k.effects.length - 1; i >= 0; i--)
          if (!k.effects[i].update(dt)) k.effects.splice(i, 1);
      });
  }
  function tickAction(e, dt) {
    const k = init(e);
    if (k.last && k.last !== e.action) cancel(e);
    for (const key of Object.keys(k.cd)) k.cd[key] = Math.max(0, k.cd[key] - dt);
    if (e.rWindow > 0) {
      e.rWindow = Math.max(0, e.rWindow - dt);
      if (!e.rWindow && k.cd.nr <= 0) k.cd.nr = CD.nr;
    }
    for (const job of [...k.timers]) {
      job.t -= dt;
      if (job.t <= 0) {
        k.timers.delete(job);
        run(e, job.fn);
      }
    }
    if (e.dead) {
      if (k.awake) endAwake(e);
      return;
    }
    if (k.awake) {
      if (e.char === 'hakari' || e.char === 'gojo')
        e.hp = Math.min(e.maxHp, e.hp + dt * (e.char === 'hakari' ? 11 : 2.6));
      k.remaining = Math.max(0, k.remaining - dt);
      run(e, () => {
        syncAwake(e, k.remaining);
        registry[e.char].awakeIdle?.(dt);
      });
      if (!k.remaining) endAwake(e);
    } else gain(e, dt * 1.15);
    if (registry[e.char].idle) run(e, () => registry[e.char].idle(dt));
    const a = e.action;
    if (!isSkill(a)) return;
    const before = e.pos.clone(),
      targets = JJAISERVER.actors()
        .filter((t) => t !== e)
        .map((t) => [t, t.pos.clone()]);
    a.t += dt;
    if (a.type === 'ai_awaken') {
      if (a.t >= a.dur) e.action = null;
    } else if (a.type === 'ai_nrush') {
      rush(e, a, dt);
    } else run(e, () => stepAction(a, dt));
    if (e.action && e.action !== a) announce(e, a.aiSlot, a);
    // Older skills directly change position. Sweep their horizontal movement
    // through the same colliders used by dash and parkour.
    const desired = e.pos.clone();
    e.pos.x = before.x;
    e.pos.z = before.z;
    JJFIGHT.actors.sweepMove(e, desired.clone().sub(before).setY(0));
    e.pos.y = desired.y;
    for (const [t, pos] of targets) {
      const held = t.__aiHeldBy === e && (t.anchorT > 0 || t.lockT > 0 || t.cineHold || t.tdHold);
      if (held || t.pos.distanceToSquared(pos) > 0.01) JJAISERVER.skillControl?.(e, t, !!held);
    }
    variant(e);
    if (e.action === a && a.t >= a.dur) {
      e.action = null;
      cancel(e);
    }
    e.rig.root.updateMatrixWorld(true);
    for (const root of k.roots) if (!root.parent) k.roots.delete(root);
  }
  function pose(e) {
    if (e.action?.type === 'ai_awaken') {
      const r = e.rig,
        t = e.action.t / e.action.dur,
        k = Math.sin(Math.min(1, t) * Math.PI);
      r.spine.rotation.x = -0.16 * k;
      r.neck.rotation.x = -0.28 * k;
      r.shoulderL.rotation.set(-1.6 * k, 0, 0.3 * k);
      r.shoulderR.rotation.set(-1.6 * k, 0, -0.3 * k);
      r.elbowL.rotation.x = r.elbowR.rotation.x = -1.8 * k;
      r.hips.position.y = r.hipsBaseY - 0.2 * k;
      return;
    }
    if (e.action?.type === 'ai_nrush')
      return JJFIGHT.pose(e.rig, { type: 'bc_dash', kind: 'front', t: 0.1, dur: 0.4, strikeAt: null });
    run(e, () => poseAction(e.rig, e.action));
  }
  function remotePose(e) {
    if (e.char === 'mahito')
      JJMAHITO.remoteState(e.rig, e.ai.mode, !!e.ai.awakeRemote, e.action?.type, e.blocking);
    pose(e);
  }
  function select(e, target, combo = false, random = Math.random) {
    const distance = e.pos.distanceTo(target.pos),
      k = init(e);
    const options = [],
      reach = k.awake ? awakeRanges[e.char] || ranges[e.char] : ranges[e.char];
    for (let slot = 0; slot < 5; slot++) {
      if (
        K.cooldown(e, slot) > 0 ||
        distance > reach[slot] ||
        distance < (k.awake ? 0 : minimum[e.char]?.[slot] || 0)
      )
        continue;
      if (
        !k.awake &&
        e.char === 'choso' &&
        slot === 3 &&
        k.states[states.indexOf(registry.choso.state)].scale > 2
      )
        continue;
      if ((e.char === 'hakari' || e.char === 'todo') && slot === 4 && !target.action) continue;
      if (e.char === 'mahito' && slot === 4 && (combo || random() > 0.25)) continue;
      const melee = reach[slot] <= 12;
      options.push({
        slot,
        score: random() + (combo && melee ? 1 : 0) + (!combo && distance > 10 && !melee ? 0.6 : 0)
      });
    }
    options.sort((a, b) => b.score - a.score);
    return options[0]?.slot ?? -1;
  }
  function defend(e, source) {
    if (!e.ai || e.dead) return false;
    return run(e, () => {
      if (e.char === 'hakari' && JJHAKARI.guardUp()) return JJHAKARI.springGuard(source.pos);
      return registry[e.char].defend?.(source) || false;
    });
  }
  function damageScale(e) {
    if (e.char !== 'hanami') return 1;
    const field = init(e).states[states.indexOf(registry.hanami.state)].field;
    return field && !field.dead && e.pos.distanceTo(field.group.position) < 10.5 ? 0.65 : 1;
  }
  const fields = [
    'stage',
    'n',
    'counter',
    'trigger',
    'sprung',
    'sprungAt',
    'variant',
    'aiSlot',
    'facing',
    'fin',
    'finN',
    'locked',
    'miss',
    'k1',
    'k2',
    'hop',
    'second',
    'thrust',
    'stabbed',
    'hit',
    'grabbed',
    'dashed',
    'lunged',
    'mode',
    'toss',
    'black',
    'riding',
    'confirm'
  ];
  function pack(a) {
    return isSkill(a) ? Object.fromEntries(fields.map((k) => [k, a[k]])) : null;
  }
  function unpack(a, data) {
    if (!a || !data) return;
    a.aiCharacterSkill = true;
    for (const k of fields) if (['number', 'boolean', 'string'].includes(typeof data[k])) a[k] = data[k];
    a.dir = V(Math.sin(a.facing || 0), 0, Math.cos(a.facing || 0));
  }
})();
