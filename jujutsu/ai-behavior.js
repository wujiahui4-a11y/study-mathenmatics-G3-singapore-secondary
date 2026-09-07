/* Decisions operate on perceived actions and remembered rivals. Movement uses
   the live navigation graph; revenge never relocates an actor to its victim. */
(function () {
  'use strict';
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z),
    C = JJAICOMBAT,
    N = JJAINAV;
  const profiles = {
    noob: {
      reaction: 0.38,
      variance: 0.22,
      revenge: 0.18,
      redirect: 0.35,
      dodge: 0.2,
      guard: 0.28,
      retreat: 0.35,
      combo: 0.25,
      team: 0.25,
      turn: 6,
      speed: 11.5
    },
    middle: {
      reaction: 0.21,
      variance: 0.12,
      revenge: 0.52,
      redirect: 0.65,
      dodge: 0.55,
      guard: 0.65,
      retreat: 0.6,
      combo: 0.68,
      team: 0.55,
      turn: 13,
      speed: 12.5
    },
    pro: {
      reaction: 0.1,
      variance: 0.06,
      revenge: 0.88,
      redirect: 0.88,
      dodge: 0.86,
      guard: 0.93,
      retreat: 0.83,
      combo: 0.95,
      team: 0.85,
      turn: 26,
      speed: 13.5
    }
  };
  let S;
  const B = (window.JJAIBEHAVIOR = {
    profiles,
    configure(s) {
      S = s;
    },
    init,
    choose,
    plan,
    defense,
    damaged,
    killed,
    step,
    escape,
    friendly
  });
  const now = () => S.time,
    rnd = () => S.random(),
    id = (e) => S.actorId(e);
  function init(e, level = 'middle') {
    const b = e.ai,
      p = profiles[level] || profiles.middle;
    Object.assign(b, {
      level: profiles[level] ? level : 'middle',
      profile: p,
      react: p.reaction + rnd() * p.variance,
      grudge: p.revenge,
      allies: new Map(),
      grudges: new Map(),
      pursuitUntil: 0,
      retreatUntil: 0,
      retreatCheck: 0,
      dodgeAt: 0,
      breachAt: 0,
      escapeUntil: 0,
      scanAt: 0,
      awakeCheck: 0,
      teamAt: 0,
      fearUntil: 0
    });
  }
  function friendly(e, t) {
    return !!(e?.ai && t?.ai && e !== t && (e.ai.allies?.get(id(t)) || 0) > now());
  }
  function choose(e) {
    const b = e.ai;
    if (b.revenge && b.revengeUntil < now()) b.revenge = null;
    let best = null,
      bestScore = -Infinity;
    const candidates = S.actors(),
      crowds = new Map();
    for (const o of S.bots)
      if (o.ai.target && !o.dead) crowds.set(o.ai.target, (crowds.get(o.ai.target) || 0) + 1);
    for (const t of candidates) {
      if (
        t === e ||
        t.dead ||
        t.hp <= 0 ||
        t.mhConsumed ||
        friendly(e, t) ||
        (t === player && !gameInputActive())
      )
        continue;
      if (t === player && now() < b.peace && b.revenge !== id(t)) continue;
      const distance = e.pos.distanceTo(t.pos),
        memory = b.memory.get(id(t)),
        revenge = b.revenge === id(t);
      const recent = memory && now() - memory.attackedAt < 7;
      // A current chase survives occlusion and distance. An idle fighter uses
      // the arena roster to travel toward a fight, then requires sight to attack.
      let score = 100 - Math.min(distance, t === b.target ? 150 : 1000) * 0.25 + (100 - t.hp) * 0.07;
      score += (revenge ? 110 : 0) + (recent ? 100 : 0) + (memory?.anger || 0) * 2;
      score += t === b.target && now() < b.pursuitUntil ? 65 : 0;
      score -= (crowds.get(t) || 0) * (revenge ? 2 : 16);
      if (t === player) score -= 12;
      if (t.iframes > 1) score -= 25;
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    if (best && best !== b.target) b.pursuitUntil = now() + 35 + rnd() * 30;
    return best;
  }
  function damaged(e, source) {
    const b = e.ai,
      m = S.remember(e, source),
      sourceId = id(source);
    m.anger = Math.min(30, m.anger + 3);
    m.attackedAt = m.seen = now();
    m.pos.copy(source.pos);
    b.lastHurt = now();
    b.lastAttacker = sourceId;
    b.target = source;
    b.pursuitUntil = now() + 60;
    b.pickAt = now() + 0.7;
    b.think = 0;
    b.peace = 0;
    b.socialAction = b.taunt = null;
    b.walkAwayUntil = 0;
    b.pathT = 0;
    b.path = [];
    b.escapeUntil = 0;
    b.goal = source.pos.clone();
    b.state = 'fighting';
    b.allies.delete(sourceId);
    if (b.revenge && b.revenge !== sourceId && rnd() < b.profile.redirect) {
      b.grudges.set(b.revenge, now() + 180);
      b.revenge = sourceId;
      b.revengeUntil = now() + 180;
      b.history.push('revenge redirected to attacker');
    }
    JJAIKITS.cancel(e);
    e.action = null;
    e.blocking = false;
    b.guardT = 0;
  }
  function killed(victim, killer) {
    const victimId = id(victim);
    if (victim.ai) {
      const b = victim.ai;
      b.deaths++;
      b.target = null;
      b.path = [];
      b.goal = null;
      b.socialAction = b.taunt = null;
      b.retreatUntil = 0;
      b.escapeUntil = 0;
      if (killer && rnd() < b.grudge) {
        b.revenge = id(killer);
        b.grudges.set(b.revenge, now() + 240);
        b.revengeUntil = now() + 240;
        S.note(b.name + ' will return for revenge');
      } else b.revenge = null;
    }
    if (killer?.ai) {
      killer.ai.kills++;
      S.note(killer.ai.name + ' won a fight');
    }
    // Every member sharing the grudge completes it on the victim's death,
    // including assists, rather than only the bot delivering the last hit.
    const celebrating = S.bots.filter((e) => !e.dead && e !== victim && e.ai.revenge === victimId);
    for (const e of S.bots) {
      const b = e.ai;
      b.grudges?.delete(victimId);
      if (b.revenge === victimId && e !== victim) {
        b.revenge = null;
        b.target = null;
        b.goal = null;
        b.path = [];
        if (e.pos.distanceTo(victim.pos) < 90) {
          b.taunt = { pos: victim.pos.clone(), victim: victimId, t: 0, still: rnd() < 0.3 };
          b.state = 'revenge celebration';
          b.history.push('revenge complete with allies');
          JJAIKITS.cancel(e);
          e.action = null;
          for (const friend of celebrating)
            if (friend !== e) b.allies.set(id(friend), now() + 65 + rnd() * 30);
        }
        S.note(b.name + ' completed revenge');
      } else if (b.target === victim) {
        b.target = null;
        b.pickAt = 0;
        b.think = 0;
        b.goal = null;
      }
      if (b.memory.has(victimId)) b.memory.get(victimId).anger *= 0.25;
    }
    if (victim === player && killer?.ai) S.humanRival = id(killer);
  }
  function alliance(e) {
    const b = e.ai;
    if (now() < b.teamAt) return;
    b.teamAt = now() + 1.4 + rnd();
    for (const [who, until] of b.allies) if (until < now()) b.allies.delete(who);
    if (!b.revenge) return;
    for (const other of S.near(e.pos, 65)) {
      if (other === e || !other.ai || other.dead || other.ai.revenge !== b.revenge || friendly(e, other))
        continue;
      if (rnd() > b.profile.team) continue;
      b.allies.set(id(other), now() + 90);
      other.ai.allies.set(id(e), now() + 90);
      b.history.push('team up for shared revenge');
      other.ai.history.push('team up for shared revenge');
      b.socialAction = null;
      other.ai.socialAction = null;
    }
  }
  function threat(e) {
    let best = null,
      score = 0;
    for (const t of S.near(e.pos, 42)) {
      if (t === e || t.dead || friendly(e, t)) continue;
      const a = t.action || (t.net && MPJJ.fighters[t.net.id]?.action);
      if (!a || /^(pk_|bc_fall|bc_evasive|ai_awaken|.*awaken)/.test(a.type)) continue;
      const d = e.pos.clone().sub(t.pos),
        distance = d.length();
      if (
        Math.abs(d.y) > 7 ||
        !JJFIGHT.actors.visible(t.pos.clone().add(V(0, 3, 0)), e.pos.clone().add(V(0, 3, 0)))
      )
        continue;
      const direction =
        a.dir?.clone().setY(0).normalize() || V(Math.sin(t.facing), 0, Math.cos(t.facing));
      const along = d.dot(direction),
        side = Math.abs(d.x * direction.z - d.z * direction.x);
      const melee = a.type === 'bc_m1',
        dash = a.type === 'bc_dash';
      const area = /domain|void|shrine|gdom|mh_spike|ha4|ca4|hn4|elephant|aw_purple/.test(a.type);
      if (melee && (distance > 7 || along < -0.5)) continue;
      if (!melee && !area && (along < 0 || side > 4.5)) continue;
      if (dash && distance > 22) continue;
      if (!area && a.t > (a.start || 0.5) + 0.65) continue;
      const n = (area ? 3 : melee ? 1 : 2) / (1 + distance * 0.05);
      if (n > score) {
        score = n;
        best = { actor: t, action: a, area, melee, distance };
      }
    }
    return best;
  }
  function defense(e) {
    const b = e.ai,
      p = b.profile;
    if (!C.free(e)) return false;
    const danger = threat(e);
    if (!danger) {
      b.detected = null;
      return false;
    }
    const { actor: t, action: a, distance, area, melee } = danger;
    if (
      b.detected?.actor !== t ||
      b.detected?.type !== a.type ||
      b.detected?.id !== a.id ||
      a.t < (b.detected?.t || 0) - 0.05
    ) {
      b.detected = { actor: t, type: a.type, id: a.id, t: a.t, at: now() + b.react, responded: false };
      return false;
    }
    b.detected.t = a.t;
    if (now() < b.detected.at) return false;
    // A skilled defender tracks a visible flank, without an instant 180° guard.
    if (e.blocking) {
      C.turn(e, t.pos, b.react, p.turn);
      return true;
    }
    if (b.detected.responded || now() < b.dodgeAt || e.action) return false;
    b.detected.responded = true;
    if (!melee && rnd() < p.dodge) {
      if (C.dash(e, t, area ? 'back' : 'side', b.strafe)) {
        b.dodgeAt = now() + 0.55;
        b.goal = null;
        b.history.push('detected skill and dodged');
        return true;
      }
    }
    if (distance < 7 && !area && rnd() < p.guard) {
      C.turn(e, t.pos, b.react, p.turn);
      if (C.guard(e, 0.22 + rnd() * 0.28)) {
        b.goal = null;
        b.history.push('read and guard attack');
        return true;
      }
    }
    return false;
  }
  function fleeGoal(e, t) {
    const b = e.ai,
      away = e.pos.clone().sub(t.pos).setY(0).normalize();
    let best = null,
      bestScore = -Infinity;
    for (const angle of [0, 0.65, -0.65, 1.25, -1.25, 2.1, -2.1]) {
      const d = away.clone().applyAxisAngle(V(0, 1, 0), angle),
        p = e.pos.clone().addScaledVector(d, 22);
      p.y = worldFloor(p, e.pos.y + 7.6);
      if (!Number.isFinite(p.y) || N.occupied(p)) continue;
      const score = p.distanceTo(t.pos) + (p.y - e.pos.y) * 2 + (N.walk(e.pos, p) ? 6 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (!best) best = e.pos.clone().addScaledVector(away, 15);
    b.fleeGoal = best;
    b.fleePlan = now() + 1.2 + rnd();
    return best;
  }
  function plan(e, t, visible, distance) {
    const b = e.ai,
      p = b.profile;
    alliance(e);
    if (b.escapeUntil > now()) {
      b.goal = b.escapeGoal?.clone();
      b.state = 'escaping obstacle';
      return true;
    }
    const enemyAwake = JJAIKITS.awakened(t);
    if (now() > b.awakeCheck) {
      b.awakeCheck = now() + 0.8 + rnd();
      if (
        JJAIKITS.canAwaken(e) &&
        visible &&
        distance < 45 &&
        (enemyAwake || e.hp < 55 || rnd() < 0.45)
      ) {
        if (JJAIKITS.awaken(e, t)) {
          b.state = 'awakening';
          b.history.push('uses awakening');
          return true;
        }
      }
      if (enemyAwake && !JJAIKITS.awakened(e) && now() > b.fearUntil && rnd() < p.retreat) {
        b.fearTarget = id(t);
        b.fearUntil = now() + 45;
        b.retreatUntil = now() + 8;
      }
    }
    if (e.hp < 30 && now() > b.retreatCheck) {
      b.retreatCheck = now() + 8 + rnd() * 5;
      if (rnd() < p.retreat) {
        b.retreatUntil = now() + 7 + rnd() * 11;
        b.history.push('low health retreat');
      }
    }
    const fleeing =
      now() < b.retreatUntil || (enemyAwake && b.fearTarget === id(t) && now() < b.fearUntil);
    if (fleeing) {
      b.state = enemyAwake ? 'escaping awakening' : 'retreating';
      if (e.action) return true;
      e.blocking = false;
      b.guardT = 0;
      // Occasionally turn on a pursuer with the actual character's ranged kit.
      if (visible && distance < 30 && distance > 5 && now() > b.nextSkill && rnd() < p.combo * 0.24) {
        const slot = JJAIKITS.select(e, t, false, rnd);
        if (slot >= 0 && C.skill(e, t, slot)) {
          b.nextSkill = now() + 2;
          b.history.push('retreat ambush skill');
          return true;
        }
      }
      if (!b.fleeGoal || now() > b.fleePlan || e.pos.distanceTo(b.fleeGoal) < 3) fleeGoal(e, t);
      b.goal = b.fleeGoal.clone();
      if (e.onGround && N.walk(e.pos, b.goal) && distance < 50) {
        const moving = { pos: b.goal };
        if (b.frontCD <= 0 && C.dash(e, moving, 'front')) {
          b.history.push('retreat front dash');
          return true;
        }
        if (b.evadeCD <= 0 && rnd() < 0.55) {
          // A lateral dash aligned toward escape, rather than orbiting the pursuer.
          const d = b.goal.clone().sub(e.pos).setY(0).normalize();
          const aim = { pos: e.pos.clone().add(V(-d.z, 0, d.x).multiplyScalar(6)), travel: true };
          if (C.dash(e, aim, 'side', 1)) {
            e.action.travel = true;
            e.action.dir.copy(d);
            b.history.push('retreat side dash');
            return true;
          }
        }
      }
      C.turn(e, b.goal, 0.1, p.turn);
      return true;
    }
    if (b.fearTarget && !enemyAwake) b.fearTarget = null;
    if (defense(e)) return true;
    if (visible && t.blocking && distance < 8 && !e.action && !e.blocking && rnd() < p.dodge * 0.2) {
      if (C.dash(e, t, 'back')) {
        b.history.push('backstep against guard');
        b.plan = 'spacing skill';
        return true;
      }
    }
    return false;
  }
  function escape(e) {
    const b = e.ai;
    if (!b.goal || !C.free(e) || e.action || e.blocking) return false;
    const forward = b.goal.clone().sub(e.pos).setY(0).normalize();
    for (const angle of [0, 0.7, -0.7, 1.4, -1.4, Math.PI]) {
      const d = forward.clone().applyAxisAngle(V(0, 1, 0), angle),
        l = N.link(e.pos, d);
      if (l) {
        S.beginTraversal(e, l);
        b.stuck = 0;
        b.history.push('climbed out of obstacle');
        return true;
      }
    }
    if (now() > b.breachAt && window.JJMAP?.id === 'jjs') {
      const origin = e.pos.clone().add(V(0, 2.5, 0)),
        hit = JJJJS.trace(origin, origin.clone().addScaledVector(forward, 5));
      if (hit && JJDESTRUCT.canBreak(hit.id)) {
        b.breachAt = now() + 0.45;
        const mark = { pos: hit.point.clone().setY(e.pos.y), dead: false, hp: 100 };
        // Work through the normal four-hit chain to reach its wall-breaking
        // strike, with the player's ordinary windups and recovery windows.
        if (C.m1(e, mark)) {
          b.history.push('M1 attacks route obstacle');
          b.pathT = 0;
          return true;
        }
      }
    }
    // A short collision-tested detour keeps the target memory intact.
    let best = null;
    for (const angle of [1.3, -1.3, 2.3, -2.3, Math.PI]) {
      const p = e.pos.clone().addScaledVector(forward.clone().applyAxisAngle(V(0, 1, 0), angle), 4);
      p.y = worldFloor(p, e.pos.y + 1.05);
      if (Number.isFinite(p.y) && N.walk(e.pos, p)) {
        best = p;
        break;
      }
    }
    if (best) {
      b.escapeGoal = best;
      b.escapeUntil = now() + 0.75;
      b.goal = best;
      b.path = [];
      b.pathT = 0;
    }
    return !!best;
  }
  function step(e, dt) {
    const b = e.ai;
    e.evasiveCD = Math.max(0, (e.evasiveCD || 0) - dt);
    if ((e.rag || e.bcFall) && !e.dead) {
      const fall = e.rag || e.bcFall;
      if (fall !== b.observedFall) {
        b.observedFall = fall;
        b.evadeDecision = now() + b.react + 0.12;
        b.evadeAttempted = false;
      }
      if (!b.evadeAttempted && now() >= b.evadeDecision && JJFIGHT.canEvasive(e)) {
        b.evadeAttempted = true;
        const t = S.actor(b.lastAttacker) || b.target;
        if (t && e.pos.distanceTo(t.pos) < 20 && rnd() < b.profile.dodge) {
          const d = e.pos
            .clone()
            .sub(t.pos)
            .setY(0)
            .normalize()
            .applyAxisAngle(V(0, 1, 0), b.strafe * 0.7);
          if (JJFIGHT.evasive(e, d)) {
            b.think = 0;
            b.target = t;
            b.goal = t.pos.clone();
          }
        }
      }
    }
    if (
      e.blocking &&
      b.level === 'pro' &&
      b.target &&
      JJFIGHT.actors.visible(e.pos.clone().add(V(0, 3, 0)), b.target.pos.clone().add(V(0, 3, 0)))
    )
      C.turn(e, b.target.pos, dt, b.profile.turn);
  }
})();
