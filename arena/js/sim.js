/* Skill Arena — authoritative arena simulation.
   Exactly one peer (the room host, or you in a solo match) runs this.
   Everyone else just renders the snapshots it produces. */
(function (SA) {
  'use strict';

  var CFG = SA.CFG;
  var KIND_BULLET = 0, KIND_PELLET = 1, KIND_GRENADE = 2, KIND_TURRET = 3;

  function Sim(world) {
    this.world = world;
    this.players = {};
    this.order = [];
    this.bullets = [];
    this.mines = [];
    this.turrets = [];
    this.pickups = [];
    this.events = [];
    this.tick = 0;
    this.time = 0;
    this.nextId = 1;
    this.orderCounter = 1;
    this.pickupTimer = 4;
    this.rnd = Math.random;
  }

  Sim.prototype.event = function (e) { if (this.events.length < 40) this.events.push(e); };

  /* ------------------------------------------------------------- players */
  Sim.prototype.addPlayer = function (opt) {
    var p = {
      id: opt.id,
      name: (opt.name || 'Player').slice(0, 12),
      colorIdx: opt.colorIdx == null ? 0 : opt.colorIdx,
      isBot: !!opt.isBot,
      x: 0, y: 0, vx: 0, vy: 0, angle: 0,
      hp: CFG.BASE_HP, shield: 0,
      alive: true, respawnAt: 0,
      level: 1, kills: 0, deaths: 0, killsThisLevel: 0,
      skills: {}, order: {}, actives: [], st: null,
      fireT: 0, cds: {}, dashT: 0, dashVx: 0, dashVy: 0,
      iFrames: 1.2, cloakT: 0, slowT: 0, slowAmt: 0,
      poisonT: 0, poisonDps: 0, poisonBy: null,
      lastHitBy: null, lastHitAt: -99, lastDamageAt: -99,
      pendingCards: null, pickDeadline: 0, queuedLevels: 0,
      input: { ax: 0, ay: 0, an: 0, s: 0, presses: [], dash: 0 },
      bot: opt.isBot ? { think: 0, wx: 0, wy: 0, targetId: null, strafe: Math.random() < 0.5 ? 1 : -1, react: 0, aimErr: 0.14 } : null,
      lastSeen: this.time
    };
    SA.recomputeStats(p);
    p.hp = p.st.maxHp;
    var sp = this.world.randomSpawn(this.alivePlayers(), 600);
    p.x = sp.x; p.y = sp.y;
    this.players[p.id] = p;
    this.order.push(p.id);
    return p;
  };

  Sim.prototype.removePlayer = function (id) {
    delete this.players[id];
    var i = this.order.indexOf(id);
    if (i >= 0) this.order.splice(i, 1);
  };

  Sim.prototype.alivePlayers = function () {
    var out = [];
    for (var i = 0; i < this.order.length; i++) {
      var p = this.players[this.order[i]];
      if (p && p.alive) out.push(p);
    }
    return out;
  };

  Sim.prototype.humanCount = function () {
    var n = 0;
    for (var i = 0; i < this.order.length; i++) if (!this.players[this.order[i]].isBot) n++;
    return n;
  };

  Sim.prototype.setInput = function (id, inp) {
    var p = this.players[id];
    if (!p) return;
    p.lastSeen = this.time;
    p.input.ax = inp.ax || 0;
    p.input.ay = inp.ay || 0;
    p.input.an = inp.an || 0;
    p.input.s = inp.s || 0;
    if (inp.d) p.input.dash = 1;
    if (inp.u && inp.u.length) {
      for (var i = 0; i < inp.u.length; i++) p.input.presses.push(inp.u[i]);
    }
  };

  /* --------------------------------------------------------------- combat */
  Sim.prototype.spawnBullet = function (owner, angle, o) {
    o = o || {};
    var st = owner.st;
    var speed = o.speed != null ? o.speed : st.bulletSpeed;
    var b = {
      id: this.nextId++,
      owner: owner.id,
      colorIdx: owner.colorIdx,
      x: owner.x + Math.cos(angle) * (CFG.PLAYER_R + 6),
      y: owner.y + Math.sin(angle) * (CFG.PLAYER_R + 6),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: o.radius != null ? o.radius : st.bulletR,
      dmg: o.dmg != null ? o.dmg : st.dmg,
      life: o.life != null ? o.life : st.bulletLife,
      pierce: o.pierce != null ? o.pierce : st.pierce,
      bounce: o.bounce != null ? o.bounce : st.bounce,
      homing: o.homing != null ? o.homing : st.homing,
      kind: o.kind || KIND_BULLET,
      fuse: !!o.fuse,
      blastDmg: o.blastDmg || 0,
      blastR: o.blastR || 0,
      slowHit: st.slowHit,
      poison: st.poison,
      lifesteal: st.lifesteal,
      knock: st.knock,
      hit: {}
    };
    /* do not let a bullet spawn inside a wall */
    if (this.world.solidAt(b.x, b.y)) { b.x = owner.x; b.y = owner.y; }
    this.bullets.push(b);
    return b;
  };

  Sim.prototype.spawnMine = function (owner, dmg, radius) {
    var mine = { id: this.nextId++, owner: owner.id, colorIdx: owner.colorIdx, x: owner.x, y: owner.y, dmg: dmg, r: radius, arm: 0.6, life: 26 };
    this.mines.push(mine);
    var mineCount = 0;
    for (var i = this.mines.length - 1; i >= 0; i--) {
      if (this.mines[i].owner === owner.id && ++mineCount > 3) { this.mines.splice(i, 1); break; }
    }
  };

  Sim.prototype.spawnTurret = function (owner, life, dmg) {
    var t = {
      id: this.nextId++, owner: owner.id, colorIdx: owner.colorIdx,
      x: owner.x, y: owner.y, angle: owner.angle, hp: 60, life: life, dmg: dmg, fireT: 0
    };
    var count = 0;
    for (var i = this.turrets.length - 1; i >= 0; i--) {
      if (this.turrets[i].owner === owner.id && ++count >= 2) { this.turrets.splice(i, 1); }
    }
    this.turrets.push(t);
  };

  Sim.prototype.fireBeam = function (p, dmg) {
    var maxLen = 1200;
    var x1 = p.x + Math.cos(p.angle) * maxLen;
    var y1 = p.y + Math.sin(p.angle) * maxLen;
    /* stop the beam at the first wall */
    var steps = Math.ceil(maxLen / 8), hitX = x1, hitY = y1;
    for (var i = 1; i <= steps; i++) {
      var t = i / steps;
      var sx = p.x + (x1 - p.x) * t, sy = p.y + (y1 - p.y) * t;
      if (this.world.solidAt(sx, sy)) { hitX = sx; hitY = sy; break; }
    }
    var list = this.alivePlayers();
    for (var j = 0; j < list.length; j++) {
      var e = list[j];
      if (e.id === p.id) continue;
      if (pointSegDist(e.x, e.y, p.x, p.y, hitX, hitY) < CFG.PLAYER_R + 8) {
        this.damage(e, dmg, p, { knock: 40 });
      }
    }
    this.event({ t: 'beam', x0: p.x | 0, y0: p.y | 0, x1: hitX | 0, y1: hitY | 0, c: p.colorIdx });
    this.event({ t: 'sfx', s: 'shoot', x: p.x | 0, y: p.y | 0 });
  };

  Sim.prototype.explode = function (x, y, radius, dmg, attacker, knock) {
    var list = this.alivePlayers();
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (attacker && e.id === attacker.id) continue;
      var d = SA.dist(x, y, e.x, e.y);
      if (d > radius) continue;
      var falloff = 1 - (d / radius) * 0.55;
      this.damage(e, dmg * falloff, attacker, { knock: knock || 220, fromX: x, fromY: y });
    }
    for (var j = this.turrets.length - 1; j >= 0; j--) {
      var t = this.turrets[j];
      if (attacker && t.owner === attacker.id) continue;
      if (SA.dist(x, y, t.x, t.y) < radius) { t.hp -= dmg; }
    }
    this.event({ t: 'boom', x: x | 0, y: y | 0, r: radius | 0 });
    this.event({ t: 'sfx', s: 'explode', x: x | 0, y: y | 0 });
  };

  Sim.prototype.heal = function (p, amount) {
    p.hp = Math.min(p.st.maxHp, p.hp + amount);
  };

  Sim.prototype.damage = function (target, amount, attacker, o) {
    o = o || {};
    if (!target.alive || amount <= 0) return;
    if (target.iFrames > 0) return;

    /* thorns bounce a slice straight back before anything else */
    if (target.st.thorns > 0 && attacker && attacker.id !== target.id && attacker.alive && !o.noReflect) {
      this.damage(attacker, amount * target.st.thorns, target, { noReflect: true });
    }

    var left = amount;
    if (target.shield > 0) {
      var absorbed = Math.min(target.shield, left);
      target.shield -= absorbed;
      left -= absorbed;
    }
    target.hp -= left;
    target.lastDamageAt = this.time;
    if (attacker && attacker.id !== target.id) {
      target.lastHitBy = attacker.id;
      target.lastHitAt = this.time;
      if (attacker.st && attacker.st.lifesteal > 0) this.heal(attacker, amount * attacker.st.lifesteal);
    }

    if (o.knock) {
      var fx = o.fromX != null ? o.fromX : (attacker ? attacker.x : target.x);
      var fy = o.fromY != null ? o.fromY : (attacker ? attacker.y : target.y);
      var a = Math.atan2(target.y - fy, target.x - fx);
      target.vx += Math.cos(a) * o.knock;
      target.vy += Math.sin(a) * o.knock;
    }

    this.event({ t: 'hit', x: target.x | 0, y: target.y | 0, d: Math.round(amount), c: attacker ? attacker.colorIdx : 0 });

    if (target.hp <= 0) this.kill(target, attacker);
  };

  Sim.prototype.kill = function (target, attacker) {
    target.alive = false;
    target.hp = 0;
    target.shield = 0;
    target.deaths++;
    target.respawnAt = this.time + CFG.RESPAWN_TIME;
    target.poisonT = 0;
    target.slowT = 0;
    target.cloakT = 0;

    /* the poisoner still gets the credit if the victim bleeds out */
    if (!attacker && target.lastHitBy && this.time - target.lastHitAt < 6) {
      attacker = this.players[target.lastHitBy];
    }

    this.event({ t: 'boom', x: target.x | 0, y: target.y | 0, r: 46, small: 1 });

    if (attacker && attacker.id !== target.id && this.players[attacker.id]) {
      attacker.kills++;
      this.event({
        t: 'kill', a: attacker.name, b: target.name,
        ca: attacker.colorIdx, cb: target.colorIdx, ai: attacker.id, bi: target.id
      });
      this.addProgress(attacker);
    } else {
      this.event({ t: 'kill', a: null, b: target.name, cb: target.colorIdx, bi: target.id });
    }
  };

  /* one kill of progress; 1 kill for level 2, then 2, 4, 8 ... */
  Sim.prototype.addProgress = function (p) {
    p.killsThisLevel++;
    var guard = 0;
    while (p.level < CFG.MAX_LEVEL && p.killsThisLevel >= SA.killsForLevel(p.level) && guard++ < 20) {
      p.killsThisLevel -= SA.killsForLevel(p.level);
      p.level++;
      p.queuedLevels++;
      SA.recomputeStats(p);
      this.heal(p, p.st.maxHp * 0.35);
      this.event({ t: 'lvl', id: p.id, name: p.name, level: p.level, c: p.colorIdx });
    }
    this.offerIfNeeded(p);
  };

  Sim.prototype.offerIfNeeded = function (p) {
    if (p.pendingCards || p.queuedLevels <= 0) return;
    p.queuedLevels--;
    var cards = SA.rollCards(p, this.rnd);
    if (!cards.length) { p.pendingCards = null; return; }
    if (p.isBot) {
      this.pickSkill(p.id, cards[Math.floor(this.rnd() * cards.length)]);
      return;
    }
    p.pendingCards = cards;
    p.pickDeadline = this.time + CFG.PICK_TIME;
    this.event({ t: 'offer', id: p.id, cards: cards, level: p.level });
  };

  Sim.prototype.pickSkill = function (id, skillId) {
    var p = this.players[id];
    if (!p) return;
    var def = SA.SKILL_BY_ID[skillId];
    if (!def) return;
    /* humans may only take a skill that is actually on offer, which also makes
       a repeated "pick" message (they are re-sent until acknowledged) a no-op */
    if (!p.isBot && (!p.pendingCards || p.pendingCards.indexOf(skillId) < 0)) return;
    if ((p.skills[skillId] || 0) >= def.max) return;
    p.skills[skillId] = (p.skills[skillId] || 0) + 1;
    if (!p.order[skillId]) p.order[skillId] = this.orderCounter++;
    SA.recomputeStats(p);
    if (skillId === 'shield') p.shield = p.st.shieldMax;
    if (skillId === 'vitality') this.heal(p, 30);
    p.pendingCards = null;
    this.event({ t: 'took', id: p.id, skill: skillId, name: p.name, c: p.colorIdx });
    this.offerIfNeeded(p);
  };

  /* ----------------------------------------------------------------- step */
  Sim.prototype.step = function (dt) {
    this.time += dt;
    this.tick++;
    var i, p;

    for (i = 0; i < this.order.length; i++) {
      p = this.players[this.order[i]];
      if (!p) continue;
      if (p.isBot) this.botThink(p, dt);
      this.stepPlayer(p, dt);
    }
    this.stepBullets(dt);
    this.stepMines(dt);
    this.stepTurrets(dt);
    this.stepPickups(dt);
  };

  Sim.prototype.stepPlayer = function (p, dt) {
    var st = p.st;

    if (!p.alive) {
      if (this.time >= p.respawnAt) {
        var sp = this.world.randomSpawn(this.alivePlayers(), 520);
        p.x = sp.x; p.y = sp.y;
        p.alive = true;
        p.hp = st.maxHp;
        p.shield = st.shieldMax;
        p.vx = p.vy = 0;
        p.iFrames = 1.4;
        p.input.presses.length = 0;
        this.event({ t: 'spawn', x: p.x | 0, y: p.y | 0, c: p.colorIdx });
      }
      return;
    }

    p.iFrames = Math.max(0, p.iFrames - dt);
    p.cloakT = Math.max(0, p.cloakT - dt);
    p.fireT = Math.max(0, p.fireT - dt);
    for (var k in p.cds) if (p.cds[k] > 0) p.cds[k] = Math.max(0, p.cds[k] - dt);

    if (p.slowT > 0) { p.slowT -= dt; if (p.slowT <= 0) p.slowAmt = 0; }

    if (p.poisonT > 0) {
      p.poisonT -= dt;
      var by = p.poisonBy ? this.players[p.poisonBy] : null;
      this.damage(p, p.poisonDps * dt, by, { noReflect: true, silent: true });
      if (!p.alive) return;
    }

    if (st.regen > 0 && p.hp < st.maxHp) this.heal(p, st.regen * dt);
    if (st.shieldMax > 0 && this.time - p.lastDamageAt > 3.2 && p.shield < st.shieldMax) {
      p.shield = Math.min(st.shieldMax, p.shield + st.shieldRegen * dt);
    }

    /* auto pick when the card timer runs out so nobody stalls the room */
    if (p.pendingCards && this.time > p.pickDeadline) {
      this.pickSkill(p.id, p.pendingCards[Math.floor(this.rnd() * p.pendingCards.length)]);
    }

    var inp = p.input;
    p.angle = inp.an;

    /* ability presses (edge triggered) */
    while (inp.presses.length) {
      var slot = inp.presses.shift();
      this.useAbility(p, slot);
    }
    if (inp.dash) { inp.dash = 0; this.useDash(p); }

    /* movement */
    var speed = st.speed * (1 - p.slowAmt);
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashVx; p.vy = p.dashVy;
    } else {
      var ax = inp.ax, ay = inp.ay;
      var m = Math.hypot(ax, ay);
      if (m > 1) { ax /= m; ay /= m; }
      var targetVx = ax * speed, targetVy = ay * speed;
      /* knockback decays instead of being overwritten instantly */
      p.vx = SA.lerp(p.vx, targetVx, Math.min(1, dt * 12));
      p.vy = SA.lerp(p.vy, targetVy, Math.min(1, dt * 12));
    }

    var nx = p.x + p.vx * dt;
    var ny = p.y + p.vy * dt;
    var res = this.world.collideCircle(nx, ny, CFG.PLAYER_R);
    if (Math.abs(res.x - nx) > 0.01) p.vx *= 0.2;
    if (Math.abs(res.y - ny) > 0.01) p.vy *= 0.2;
    p.x = res.x; p.y = res.y;

    /* shooting */
    if (inp.s && p.fireT <= 0) {
      this.shoot(p);
      p.fireT = st.fireDelay;
    }
  };

  Sim.prototype.shoot = function (p) {
    var st = p.st;
    var n = 1 + st.extraShots;
    for (var i = 0; i < n; i++) {
      var off = n === 1 ? 0 : (i / (n - 1) - 0.5) * st.spread * (n + 1);
      this.spawnBullet(p, p.angle + off, {});
    }
    p.cloakT = 0;
    this.event({ t: 'shot', x: p.x | 0, y: p.y | 0, a: Math.round(p.angle * 100), c: p.colorIdx });
  };

  Sim.prototype.useDash = function (p) {
    if (!p.skills.dash) return;
    if ((p.cds.dash || 0) > 0) return;
    var r = p.skills.dash;
    p.cds.dash = SA.SKILL_BY_ID.dash.cd(r);
    SA.SKILL_BY_ID.dash.use(this, p, r);
  };

  Sim.prototype.useAbility = function (p, slot) {
    var id = p.actives[slot];
    if (!id) return;
    if ((p.cds[id] || 0) > 0) return;
    var def = SA.SKILL_BY_ID[id];
    var r = p.skills[id];
    p.cds[id] = def.cd(r);
    def.use(this, p, r);
  };

  Sim.prototype.stepBullets = function (dt) {
    var list = this.alivePlayers();
    for (var i = this.bullets.length - 1; i >= 0; i--) {
      var b = this.bullets[i];
      b.life -= dt;
      if (b.life <= 0) {
        if (b.fuse) this.explode(b.x, b.y, b.blastR, b.blastDmg, this.players[b.owner], 250);
        this.bullets.splice(i, 1);
        continue;
      }

      if (b.homing > 0) {
        var best = null, bestD = 420 + b.homing * 90;
        for (var h = 0; h < list.length; h++) {
          var t = list[h];
          if (t.id === b.owner || t.cloakT > 0) continue;
          var d = SA.dist(b.x, b.y, t.x, t.y);
          if (d < bestD) { bestD = d; best = t; }
        }
        if (best) {
          var want = Math.atan2(best.y - b.y, best.x - b.x);
          var cur = Math.atan2(b.vy, b.vx);
          var na = SA.angLerp(cur, want, Math.min(1, dt * (2.2 + b.homing * 1.4)));
          var sp = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
        }
      }

      /* move on each axis so a bounce knows which wall it touched */
      var stepX = b.vx * dt, stepY = b.vy * dt;
      var hitWall = false;
      b.x += stepX;
      if (this.world.solidAt(b.x, b.y)) {
        if (b.bounce > 0) { b.x -= stepX; b.vx = -b.vx; b.bounce--; hitWall = true; }
        else { this.bulletEnd(b, i); continue; }
      }
      b.y += stepY;
      if (this.world.solidAt(b.x, b.y)) {
        if (b.bounce > 0) { b.y -= stepY; b.vy = -b.vy; b.bounce--; hitWall = true; }
        else { this.bulletEnd(b, i); continue; }
      }
      if (hitWall) this.event({ t: 'spark', x: b.x | 0, y: b.y | 0, c: b.colorIdx });

      /* player hits */
      var removed = false;
      for (var j = 0; j < list.length; j++) {
        var e = list[j];
        if (e.id === b.owner || b.hit[e.id]) continue;
        if (SA.dist2(b.x, b.y, e.x, e.y) > (CFG.PLAYER_R + b.r) * (CFG.PLAYER_R + b.r)) continue;
        b.hit[e.id] = 1;
        var attacker = this.players[b.owner];
        if (b.fuse) {
          this.explode(b.x, b.y, b.blastR, b.blastDmg, attacker, 260);
          removed = true;
          break;
        }
        this.damage(e, b.dmg, attacker, { knock: b.knock, fromX: b.x, fromY: b.y });
        if (e.alive) {
          if (b.slowHit > 0) { e.slowAmt = Math.max(e.slowAmt, b.slowHit); e.slowT = 1.3; }
          if (b.poison > 0) { e.poisonDps = Math.max(e.poisonDps, b.poison); e.poisonT = 3; e.poisonBy = b.owner; }
        }
        if (b.pierce > 0) { b.pierce--; b.dmg *= 0.82; }
        else { removed = true; break; }
      }

      /* turret hits */
      if (!removed) {
        for (var k = this.turrets.length - 1; k >= 0; k--) {
          var tu = this.turrets[k];
          if (tu.owner === b.owner) continue;
          if (SA.dist2(b.x, b.y, tu.x, tu.y) > 22 * 22) continue;
          tu.hp -= b.dmg;
          removed = true;
          this.event({ t: 'spark', x: b.x | 0, y: b.y | 0, c: b.colorIdx });
          break;
        }
      }

      if (removed) this.bulletEnd(b, i);
    }
  };

  Sim.prototype.bulletEnd = function (b, i) {
    if (b.fuse) this.explode(b.x, b.y, b.blastR, b.blastDmg, this.players[b.owner], 250);
    else this.event({ t: 'spark', x: b.x | 0, y: b.y | 0, c: b.colorIdx });
    this.bullets.splice(i, 1);
  };

  Sim.prototype.stepMines = function (dt) {
    var list = this.alivePlayers();
    for (var i = this.mines.length - 1; i >= 0; i--) {
      var m = this.mines[i];
      m.arm -= dt; m.life -= dt;
      if (m.life <= 0) { this.mines.splice(i, 1); continue; }
      if (m.arm > 0) continue;
      for (var j = 0; j < list.length; j++) {
        var e = list[j];
        if (e.id === m.owner) continue;
        if (SA.dist(m.x, m.y, e.x, e.y) < m.r * 0.55) {
          this.explode(m.x, m.y, m.r, m.dmg, this.players[m.owner], 300);
          this.mines.splice(i, 1);
          break;
        }
      }
    }
  };

  Sim.prototype.stepTurrets = function (dt) {
    var list = this.alivePlayers();
    for (var i = this.turrets.length - 1; i >= 0; i--) {
      var t = this.turrets[i];
      t.life -= dt;
      t.fireT -= dt;
      if (t.life <= 0 || t.hp <= 0) {
        this.event({ t: 'boom', x: t.x | 0, y: t.y | 0, r: 40, small: 1 });
        this.turrets.splice(i, 1);
        continue;
      }
      var owner = this.players[t.owner];
      var best = null, bestD = 520;
      for (var j = 0; j < list.length; j++) {
        var e = list[j];
        if (e.id === t.owner || e.cloakT > 0) continue;
        var d = SA.dist(t.x, t.y, e.x, e.y);
        if (d < bestD && this.world.losClear(t.x, t.y, e.x, e.y)) { bestD = d; best = e; }
      }
      if (!best) continue;
      t.angle = SA.angLerp(t.angle, Math.atan2(best.y - t.y, best.x - t.x), Math.min(1, dt * 6));
      if (t.fireT <= 0) {
        t.fireT = 0.42;
        this.bullets.push({
          id: this.nextId++, owner: t.owner, colorIdx: t.colorIdx,
          x: t.x + Math.cos(t.angle) * 18, y: t.y + Math.sin(t.angle) * 18,
          vx: Math.cos(t.angle) * 560, vy: Math.sin(t.angle) * 560,
          r: 4.5, dmg: t.dmg, life: 1.1, pierce: 0, bounce: 0, homing: 0,
          kind: KIND_TURRET, fuse: false, blastDmg: 0, blastR: 0,
          slowHit: 0, poison: 0, lifesteal: owner ? owner.st.lifesteal : 0, knock: 30, hit: {}
        });
      }
    }
  };

  Sim.prototype.stepPickups = function (dt) {
    this.pickupTimer -= dt;
    if (this.pickupTimer <= 0 && this.pickups.length < 6) {
      this.pickupTimer = 7 + this.rnd() * 6;
      var sp = this.world.randomSpawn(null, 0);
      this.pickups.push({ id: this.nextId++, x: sp.x, y: sp.y, type: this.rnd() < 0.75 ? 0 : 1 });
    }
    var list = this.alivePlayers();
    for (var i = this.pickups.length - 1; i >= 0; i--) {
      var pk = this.pickups[i];
      for (var j = 0; j < list.length; j++) {
        var e = list[j];
        if (SA.dist(pk.x, pk.y, e.x, e.y) > CFG.PLAYER_R + 14) continue;
        if (pk.type === 0) {
          if (e.hp >= e.st.maxHp) continue;
          this.heal(e, 45);
        } else {
          e.shield = Math.min(e.st.shieldMax + 25, e.shield + 35);
          e.iFrames = Math.max(e.iFrames, 0.3);
        }
        this.event({ t: 'sfx', s: 'pickup', x: pk.x | 0, y: pk.y | 0 });
        this.pickups.splice(i, 1);
        break;
      }
    }
  };

  /* ------------------------------------------------------------------ bots */
  Sim.prototype.botThink = function (p, dt) {
    if (!p.alive) { p.input.ax = p.input.ay = 0; p.input.s = 0; return; }
    var ai = p.bot;
    ai.think -= dt;
    ai.react -= dt;

    if (ai.think <= 0) {
      ai.think = 0.28 + this.rnd() * 0.25;
      var list = this.alivePlayers();
      var best = null, bestD = 1e9;
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (e.id === p.id) continue;
        if (e.cloakT > 0) continue;
        var d = SA.dist(p.x, p.y, e.x, e.y);
        var vis = this.world.losClear(p.x, p.y, e.x, e.y);
        var score = d + (vis ? 0 : 900);
        if (score < bestD) { bestD = score; best = e; }
      }
      ai.targetId = best ? best.id : null;
      if (this.rnd() < 0.25) ai.strafe *= -1;
    }

    var target = ai.targetId ? this.players[ai.targetId] : null;
    if (target && !target.alive) target = null;

    var moveX = 0, moveY = 0;
    if (target) {
      var dx = target.x - p.x, dy = target.y - p.y;
      var dist = Math.hypot(dx, dy) || 1;
      var see = this.world.losClear(p.x, p.y, target.x, target.y);
      var want = 250;
      var toward = (dist > want || !see) ? 1 : -0.7;
      var ang = Math.atan2(dy, dx);
      moveX = Math.cos(ang) * toward + Math.cos(ang + Math.PI / 2) * ai.strafe * (see ? 0.85 : 0.2);
      moveY = Math.sin(ang) * toward + Math.sin(ang + Math.PI / 2) * ai.strafe * (see ? 0.85 : 0.2);

      var aimErr = ai.aimErr * (1 + Math.min(1, dist / 700));
      /* lead the shot a little so bots are not trivially dodged */
      var lead = dist / p.st.bulletSpeed;
      var aimAng = Math.atan2(target.y + target.vy * lead * 0.7 - p.y, target.x + target.vx * lead * 0.7 - p.x);
      p.input.an = aimAng + (this.rnd() - 0.5) * aimErr;
      p.input.s = (see && dist < 620 && ai.react <= 0) ? 1 : 0;
      if (see && ai.react <= 0 && this.rnd() < 0.02) ai.react = 0.35 + this.rnd() * 0.5;

      if (see) {
        if (p.skills.dash && this.rnd() < 0.01) p.input.dash = 1;
        if (p.actives.length && this.rnd() < 0.02 && dist < 430) {
          p.input.presses.push(Math.floor(this.rnd() * p.actives.length));
        }
      }
    } else {
      if (!ai.wx || SA.dist(p.x, p.y, ai.wx, ai.wy) < 70) {
        var sp = this.world.randomSpawn(null, 0);
        ai.wx = sp.x; ai.wy = sp.y;
      }
      var wa = Math.atan2(ai.wy - p.y, ai.wx - p.x);
      moveX = Math.cos(wa); moveY = Math.sin(wa);
      p.input.an = SA.angLerp(p.input.an, wa, Math.min(1, dt * 4));
      p.input.s = 0;
    }

    /* very light wall avoidance: try the wanted heading, else fan out */
    var heading = Math.atan2(moveY, moveX);
    var probe = 62;
    for (var k = 0; k < 6; k++) {
      var a2 = heading + (k === 0 ? 0 : (k % 2 ? 1 : -1) * 0.5 * Math.ceil(k / 2));
      if (!this.world.solidAt(p.x + Math.cos(a2) * probe, p.y + Math.sin(a2) * probe)) { heading = a2; break; }
    }
    p.input.ax = Math.cos(heading);
    p.input.ay = Math.sin(heading);
  };

  Sim.prototype.fillBots = function (count) {
    var have = 0, i;
    for (i = 0; i < this.order.length; i++) if (this.players[this.order[i]].isBot) have++;
    var used = {};
    for (i = 0; i < this.order.length; i++) used[this.players[this.order[i]].name] = 1;
    while (have < count) {
      var name = null;
      for (var tries = 0; tries < 30 && !name; tries++) {
        var cand = SA.BOT_NAMES[Math.floor(Math.random() * SA.BOT_NAMES.length)];
        if (!used[cand]) name = cand;
      }
      if (!name) name = 'Bot' + (have + 1);
      used[name] = 1;
      this.addPlayer({
        id: 'bot_' + SA.uid(), name: name, isBot: true,
        colorIdx: Math.floor(Math.random() * SA.COLORS.length)
      });
      have++;
    }
    /* trim extras */
    for (i = this.order.length - 1; i >= 0 && have > count; i--) {
      var p = this.players[this.order[i]];
      if (p && p.isBot) { this.removePlayer(p.id); have--; }
    }
  };

  /* ------------------------------------------------------------- snapshots */
  Sim.prototype.drainEvents = function () {
    var e = this.events;
    this.events = [];
    return e;
  };

  Sim.prototype.snapshot = function (evs) {
    var p, i, arr = [];
    for (i = 0; i < this.order.length; i++) {
      p = this.players[this.order[i]];
      if (!p) continue;
      var flags = (p.alive ? 1 : 0) | (p.cloakT > 0 ? 2 : 0) | (p.dashT > 0 ? 4 : 0) |
        (p.isBot ? 8 : 0) | (p.iFrames > 0 ? 16 : 0) | (p.slowT > 0 ? 32 : 0) | (p.poisonT > 0 ? 64 : 0);
      arr.push([
        p.id, Math.round(p.x), Math.round(p.y), Math.round(p.angle * 100),
        Math.round(p.hp), Math.round(p.st.maxHp), Math.round(p.shield),
        p.level, p.kills, flags, p.colorIdx, p.killsThisLevel
      ]);
    }
    var b = [];
    for (i = 0; i < this.bullets.length; i++) {
      var bu = this.bullets[i];
      b.push(bu.id % 100000, Math.round(bu.x), Math.round(bu.y), Math.round(bu.r), bu.kind, bu.colorIdx,
        Math.round(Math.atan2(bu.vy, bu.vx) * 100));
    }
    var m = [];
    for (i = 0; i < this.mines.length; i++) m.push(Math.round(this.mines[i].x), Math.round(this.mines[i].y), this.mines[i].colorIdx);
    var tu = [];
    for (i = 0; i < this.turrets.length; i++) {
      var t = this.turrets[i];
      tu.push(Math.round(t.x), Math.round(t.y), Math.round(t.angle * 100), t.colorIdx);
    }
    var pk = [];
    for (i = 0; i < this.pickups.length; i++) pk.push(Math.round(this.pickups[i].x), Math.round(this.pickups[i].y), this.pickups[i].type);

    return {
      t: 's', k: this.tick, tm: Math.round(this.time * 1000),
      p: arr, b: b, m: m, u: tu, pk: pk, ev: evs || this.drainEvents()
    };
  };

  Sim.prototype.roster = function () {
    var out = [];
    for (var i = 0; i < this.order.length; i++) {
      var p = this.players[this.order[i]];
      if (!p) continue;
      out.push([p.id, p.name, p.colorIdx, p.isBot ? 1 : 0]);
    }
    return { t: 'r', p: out };
  };

  /* skills of one player, sent to that player only */
  Sim.prototype.playerState = function (id) {
    var p = this.players[id];
    if (!p) return null;
    var cds = {};
    for (var k in p.cds) if (p.cds[k] > 0.02) cds[k] = Math.round(p.cds[k] * 10) / 10;
    return {
      id: id, level: p.level, kills: p.kills, ktl: p.killsThisLevel,
      skills: p.skills, actives: p.actives, cds: cds, cards: p.pendingCards,
      cardEnds: p.pendingCards ? Math.round((p.pickDeadline - this.time) * 10) / 10 : 0,
      hp: Math.round(p.hp), maxHp: Math.round(p.st.maxHp), shield: Math.round(p.shield),
      shieldMax: Math.round(p.st.shieldMax), alive: p.alive, spd: Math.round(p.st.speed),
      respawnIn: p.alive ? 0 : Math.max(0, Math.round((p.respawnAt - this.time) * 10) / 10),
      killedBy: p.lastHitBy && this.players[p.lastHitBy] ? this.players[p.lastHitBy].name : null
    };
  };

  /* the wire form drops anything the receiver can work out for itself */
  SA.fillYou = function (you) {
    you.need = SA.killsForLevel(you.level);
    you.cdMax = {};
    for (var id in you.skills) {
      var d = SA.SKILL_BY_ID[id];
      if (d && d.cd) you.cdMax[id] = d.cd(you.skills[id]);
    }
    return you;
  };

  function pointSegDist(px, py, x0, y0, x1, y1) {
    var dx = x1 - x0, dy = y1 - y0;
    var len2 = dx * dx + dy * dy;
    if (len2 < 0.0001) return SA.dist(px, py, x0, y0);
    var t = SA.clamp(((px - x0) * dx + (py - y0) * dy) / len2, 0, 1);
    return SA.dist(px, py, x0 + dx * t, y0 + dy * t);
  }

  SA.Sim = Sim;
  SA.KINDS = { BULLET: KIND_BULLET, PELLET: KIND_PELLET, GRENADE: KIND_GRENADE, TURRET: KIND_TURRET };

})(window.SA);
