/* Incremental A* over live floors, with swept walk, vault and ledge links.
   Search and steering are separate, following Red Blob Games and Reynolds. */
(function () {
  'use strict';
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z),
    STEP = 4,
    R = 0.9,
    H = 5.1;
  const jobs = [],
    cache = new Map();
  let root = null,
    revision = -1,
    stamp = 0,
    expanded = 0;
  const N = (window.JJAINAV = {
    request,
    step,
    clear,
    walk,
    link,
    segment,
    occupied,
    steer,
    audit: () => ({ jobs: jobs.length, cached: cache.size, expanded, revision })
  });
  const city = () => window.JJMAP?.id === 'jjs';
  function occupied(p) {
    return city() ? JJJJS.occupied(p, R, H) : Math.abs(p.x) > ARENA - 2 || Math.abs(p.z) > ARENA - 2;
  }
  function segment(a, b) {
    const n = Math.max(1, Math.ceil(a.distanceTo(b) / 0.65));
    for (let i = 1; i <= n; i++) if (occupied(a.clone().lerp(b, i / n))) return false;
    return true;
  }
  function walk(a, b) {
    if (Math.abs(a.y - b.y) > 1.2) return false;
    const n = Math.max(1, Math.ceil(a.distanceTo(b) / 1.1));
    let y = a.y;
    for (let i = 1; i <= n; i++) {
      const p = a.clone().lerp(b, i / n);
      p.y = worldFloor(p, y + 1.15);
      if (!Number.isFinite(p.y) || Math.abs(p.y - y) > 1.2 || occupied(p)) return false;
      y = p.y;
    }
    return Math.abs(y - b.y) < 1.2;
  }
  function support(p) {
    const y = worldFloor(p, p.y + 0.15);
    return Number.isFinite(y) && Math.abs(y - p.y) < 0.2 && !occupied(p);
  }
  function link(from, direction) {
    if (!city()) return null;
    const d = direction.clone().setY(0).normalize();
    const vault = JJMOVE.findVault(from, d);
    if (vault)
      return {
        type: 'pk_vault',
        from: from.clone(),
        path: vault.path.map((p) => p.clone()),
        end: vault.path.at(-1).clone(),
        dur: 0.68
      };
    const a = from.clone().add(V(0, 2.6, 0)),
      hit = JJJJS.trace(a, a.clone().addScaledVector(d, 4.5));
    if (!hit || Math.abs(hit.normal.y) > 0.18 || hit.normal.dot(d) > -0.65) return null;
    const normal = hit.normal.clone().setY(0).normalize(),
      inside = hit.point.clone().addScaledVector(normal, -0.6);
    const cap = JJJJS.trace(V(inside.x, from.y + 7.8, inside.z), V(inside.x, from.y + 3.4, inside.z));
    if (!cap || cap.normal.y < 0.9) return null;
    const height = cap.point.y - from.y;
    if (height < 3.6 || height > 7.6) return null;
    const edge = V(hit.point.x, cap.point.y, hit.point.z),
      hang = edge.clone().addScaledVector(normal, 1.12);
    hang.y -= 5.2;
    const stand = edge.clone().addScaledVector(normal, -1.35);
    stand.y += 0.04;
    const lift = hang.clone();
    lift.y = stand.y + 0.04;
    const path = [from.clone(), hang, lift, stand];
    if (!support(stand) || !path.slice(1).every((p, i) => segment(path[i], p))) return null;
    return { type: 'pk_climb', from: from.clone(), path, end: stand.clone(), dur: 1.05, normal, id: hit.id };
  }
  function clear() {
    jobs.length = 0;
    cache.clear();
    root = window.JJJJS?.root;
    revision = window.JJDESTRUCT?.audit().revision || 0;
  }
  const key = (p) => Math.round(p.x / STEP) + ',' + Math.round(p.z / STEP) + ',' + Math.round(p.y * 4);
  const h = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) + Math.abs(a.y - b.y) * 1.4;
  class Heap {
    constructor() {
      this.a = [];
    }
    push(n) {
      const a = this.a;
      let i = a.length;
      a.push(n);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[p].f <= n.f) break;
        a[i] = a[p];
        i = p;
      }
      a[i] = n;
    }
    pop() {
      const a = this.a,
        top = a[0],
        last = a.pop();
      if (a.length) {
        let i = 0;
        while (i * 2 + 1 < a.length) {
          let c = i * 2 + 1;
          if (c + 1 < a.length && a[c + 1].f < a[c].f) c++;
          if (a[c].f >= last.f) break;
          a[i] = a[c];
          i = c;
        }
        a[i] = last;
      }
      return top;
    }
  }
  function neighbors(p) {
    const tag = key(p);
    if (cache.has(tag)) return cache.get(tag);
    const list = [];
    for (const [x, z] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1]
    ]) {
      const q = p.clone().add(V(x * STEP, 0, z * STEP));
      q.y = worldFloor(q, p.y + 1.15);
      if (Number.isFinite(q.y) && Math.abs(q.x) < 1000 && Math.abs(q.z) < 1000 && !occupied(q)) {
        if (walk(p, q)) {
          list.push({ p: q, cost: p.distanceTo(q) });
          continue;
        }
        if (p.y - q.y > 1.2 && p.y - q.y <= 8) {
          const edge = q.clone();
          edge.y = p.y;
          if (segment(p, edge) && segment(edge, q)) {
            list.push({
              p: q,
              cost: p.distanceTo(q) + 3,
              link: {
                type: 'drop',
                from: p.clone(),
                path: [p.clone(), edge, q.clone()],
                end: q.clone(),
                dur: 0.65
              }
            });
            continue;
          }
        }
      }
      if (x === 0 || z === 0) {
        const l = link(p, V(x, 0, z));
        if (l) list.push({ p: l.end, cost: p.distanceTo(l.end) + 5, link: l });
      }
    }
    if (cache.size > 3500) cache.delete(cache.keys().next().value);
    cache.set(tag, list);
    return list;
  }
  function request(from, goal, done, owner) {
    for (let i = jobs.length - 1; i >= 0; i--) if (jobs[i].owner === owner) jobs.splice(i, 1);
    if (walk(from, goal)) {
      done([{ p: goal.clone() }], true);
      return;
    }
    const direct = link(from, goal.clone().sub(from));
    if (direct && h(direct.end, goal) < h(from, goal) - 1 && walk(direct.end, goal)) {
      done([{ p: direct.end, link: direct }, { p: goal.clone() }], true);
      return;
    }
    if (jobs.length >= 20) {
      done([], false);
      return;
    }
    const n = { p: from.clone(), g: 0, f: h(from, goal), prev: null },
      heap = new Heap();
    heap.push(n);
    jobs.push({
      owner,
      goal: goal.clone(),
      done,
      heap,
      best: n,
      nodes: new Map([[key(from), n]]),
      closed: new Set(),
      count: 0
    });
  }
  function finish(j, success) {
    const route = [];
    let n = j.best;
    while (n.prev) {
      route.push({ p: n.p.clone(), link: n.link });
      n = n.prev;
    }
    route.reverse();
    j.done(route, success);
  }
  function step(dt) {
    stamp += dt;
    if (stamp > 0.25) {
      stamp = 0;
      const rev = window.JJDESTRUCT?.audit().revision || 0;
      if (root !== window.JJJJS?.root || revision !== rev) clear();
    }
    const deadline = performance.now() + 2.5;
    let budget = 55;
    while (jobs.length && budget-- && performance.now() < deadline) {
      const j = jobs.shift();
      let n = j.heap.pop();
      if (!n) {
        finish(j, false);
        continue;
      }
      const tag = key(n.p);
      if (j.closed.has(tag)) {
        jobs.push(j);
        continue;
      }
      j.closed.add(tag);
      j.count++;
      expanded++;
      if (h(n.p, j.goal) < h(j.best.p, j.goal)) j.best = n;
      if (h(n.p, j.goal) < 6 && walk(n.p, j.goal)) {
        j.best = { p: j.goal, prev: n };
        finish(j, true);
        continue;
      }
      if (j.count >= 1500) {
        finish(j, false);
        continue;
      }
      for (const e of neighbors(n.p)) {
        if (n.p.distanceTo(j.nodes.values().next().value.p) > 130) continue;
        const k = key(e.p),
          g = n.g + e.cost,
          old = j.nodes.get(k);
        if (j.closed.has(k) || (old && g >= old.g)) continue;
        const next = { p: e.p, g, f: g + h(e.p, j.goal) * 1.12, prev: n, link: e.link };
        j.nodes.set(k, next);
        j.heap.push(next);
      }
      jobs.push(j);
    }
  }
  function steer(actor, goal, others) {
    let desired = goal.clone().sub(actor.pos).setY(0);
    if (desired.lengthSq() < 0.01) return desired;
    desired.normalize();
    for (const other of others) {
      if (other === actor || other.dead) continue;
      const away = actor.pos.clone().sub(other.pos).setY(0),
        n = away.length();
      if (n > 0.05 && n < 2.8) desired.addScaledVector(away, (2.8 - n) / (n * 3));
    }
    desired.normalize();
    const ahead = actor.pos.clone().addScaledVector(desired, 2);
    if (!occupied(ahead)) return desired;
    let best = null,
      score = -Infinity;
    for (const angle of [0.55, -0.55, 1, -1, 1.5, -1.5]) {
      const d = desired.clone().applyAxisAngle(V(0, 1, 0), angle),
        p = actor.pos.clone().addScaledVector(d, 2);
      if (!occupied(p)) {
        const n = d.dot(goal.clone().sub(actor.pos).setY(0).normalize());
        if (n > score) {
          score = n;
          best = d;
        }
      }
    }
    return best || V();
  }
})();
