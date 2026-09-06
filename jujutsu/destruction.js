/* Localized voxel destruction. Studio's Core is protected. Only marked source
   parts with matched exported surfaces are split. The room host owns geometry;
   peers receive bounded part snapshots, never infer damage from replayed VFX. */
(function () {
  'use strict';
  if (!window.JJJJS) return;
  const J = JJJJS,
    D = J.data,
    V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const MAX_PARTS = 160,
    MAX_FRAGMENTS = 128,
    MAX_TOTAL = 5000,
    MAX_DEBRIS = 192,
    GRID = 32;
  const states = new Map(),
    refs = new Map(),
    attached = new Map(),
    grid = new Map(),
    rates = new Map();
  let sourceRoot = null,
    time = 0,
    serial = 0,
    epoch = '',
    hostId = null,
    room = null,
    lastRevision = 0;
  let total = 0,
    pool = null,
    debris = [],
    debrisCursor = 0,
    syncClock = 0,
    requestClock = -1;
  let lastImpact = -1,
    lastPoint = V(1e6, 1e6, 1e6);
  const retiredEpochs = new Set();
  const settings = { enabled: true, rebuild: 30, debris: 192 };
  const X = (window.JJDESTRUCT = {
    hit,
    sweep,
    clear,
    update,
    receive,
    syncTo,
    settings,
    configure,
    restoreAll,
    newRoom,
    audit: () => ({
      parts: states.size,
      fragments: total,
      debris: debris.length,
      eligible: refs.size,
      revision: serial,
      epoch,
      limits: { parts: MAX_PARTS, fragments: MAX_TOTAL, debris: MAX_DEBRIS }
    }),
    snapshot: () =>
      Array.from(states.values(), (s) => ({
        id: s.id,
        f: s.f.map((a) => a.slice()),
        left: Math.max(0, s.until - time)
      }))
  });
  const online = () => !!(window.MPJJ && (MPJJ.active || MPJJ.joined) && MPJJ.relay);
  const authority = () => !online() || MPJJ.host;
  const enabled = () => settings.enabled && window.JJMAP && JJMAP.id === 'jjs' && J.root;
  function send(m) {
    if (online()) MPJJ.relay.pub(Object.assign({ id: MPJJ.id, map: 'jjs', epoch }, m));
  }
  function newRoom() {
    clear();
    hostId = null;
    room = null;
    lastRevision = 0;
    retiredEpochs.clear();
  }
  function clear() {
    if (epoch) retiredEpochs.add(epoch);
    if (retiredEpochs.size > 32) retiredEpochs.delete(retiredEpochs.values().next().value);
    for (const s of states.values()) restore(s.id);
    if (pool) {
      scene.remove(pool);
      pool.geometry.dispose();
      pool.material.dispose();
      pool.dispose();
    }
    pool = null;
    debris = [];
    debrisCursor = 0;
    states.clear();
    refs.clear();
    attached.clear();
    grid.clear();
    rates.clear();
    total = 0;
    sourceRoot = null;
    serial = 0;
    X.rubbleRevision = -1;
    lastRevision = 0;
    syncClock = 0;
    lastImpact = -1;
    requestClock = -1;
    epoch = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }
  function prepare() {
    if (sourceRoot === J.root) return;
    sourceRoot = J.root;
    if (!sourceRoot) return;
    const allowed = new Set(D.breakable || []);
    (J.visualMeshes || []).forEach((m, mi) => {
      const owners = m.userData.owners;
      if (!owners) return;
      for (let t = 0; t < owners.length; t++) {
        const id = owners[t] - 1;
        if (!allowed.has(id)) continue;
        if (!refs.has(id)) refs.set(id, []);
        refs.get(id).push([mi, t * 3]);
      }
    });
    for (const m of J.root.children) {
      const id = m.userData.jjsPart;
      if (!allowed.has(id)) continue;
      if (!attached.has(id)) attached.set(id, []);
      attached.get(id).push(m);
      if (!refs.has(id)) refs.set(id, []);
    }
    for (const [id, list] of refs) {
      // Complex custom meshes remain intact; their enclosing box isn't a valid
      // solid volume to voxelize. Original rectangular walls retain exact UVs.
      if (D.parts[id][22] || list.length > 80) {
        refs.delete(id);
        continue;
      }
      const p = D.parts[id],
        b = J.originals.get(id) || bounds(p);
      for (let x = Math.floor(b.minX / GRID); x <= Math.floor(b.maxX / GRID); x++)
        for (let z = Math.floor(b.minZ / GRID); z <= Math.floor(b.maxZ / GRID); z++) {
          const k = x + ',' + z;
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(id);
        }
    }
  }
  function bounds(p) {
    const e = [0, 0, 0];
    for (let a = 0; a < 3; a++)
      for (let j = 0; j < 3; j++) e[a] += (Math.abs(p[3 + a * 3 + j]) * p[12 + j]) / 2;
    return {
      minX: p[0] - D.origin[0] - e[0],
      maxX: p[0] - D.origin[0] + e[0],
      minZ: p[2] - D.origin[2] - e[2],
      maxZ: p[2] - D.origin[2] + e[2]
    };
  }
  function local(id, pos) {
    return pos.clone().applyMatrix4(J.transform(D.parts[id]).invert()).toArray();
  }
  function initial(id) {
    const p = D.parts[id];
    return [-p[12] / 2, -p[13] / 2, -p[14] / 2, p[12] / 2, p[13] / 2, p[14] / 2];
  }
  function distance(f, c) {
    let q = 0;
    for (let a = 0; a < 3; a++) q += Math.pow(Math.max(f[a] - c[a], 0, c[a] - f[a + 3]), 2);
    return q;
  }
  // Split only the intersecting branch. Retain untouched siblings as large
  // cuboids; don't turn the whole city into individual cubes in advance.
  function carve(list, c, r, cell) {
    let work = 0,
      removed = [];
    const out = [],
      r2 = r * r;
    function cut(f) {
      if (++work > 8192) throw new Error('capacity');
      if (distance(f, c) > r2) {
        out.push(f);
        return;
      }
      let far = 0,
        axis = 0;
      for (let a = 0; a < 3; a++) {
        far += Math.pow(Math.max(Math.abs(f[a] - c[a]), Math.abs(f[a + 3] - c[a])), 2);
        if (f[a + 3] - f[a] > f[axis + 3] - f[axis]) axis = a;
      }
      if (far <= r2 || f[axis + 3] - f[axis] <= cell) {
        if (removed.length < 64) removed.push(f);
        return;
      }
      const mid = (f[axis] + f[axis + 3]) / 2,
        l = f.slice(),
        h = f.slice();
      l[axis + 3] = mid;
      h[axis] = mid;
      cut(l);
      cut(h);
      if (out.length > MAX_FRAGMENTS) throw new Error('capacity');
    }
    try {
      list.forEach(cut);
    } catch (e) {
      return null;
    }
    return removed.length ? { f: out, removed } : null;
  }
  function hideOriginal(id, hidden) {
    for (const [mi, t] of refs.get(id) || []) {
      const mesh = J.visualMeshes[mi],
        a = mesh.geometry.index.array,
        src = mesh.userData.originalIndex;
      for (let i = 0; i < 3; i++) a[t + i] = hidden ? 0 : src[t + i];
      mesh.geometry.index.needsUpdate = true;
    }
    for (const child of J.root.children) if (child.userData.jjsPart === id) child.visible = !hidden;
  }
  function clip(poly, axis, bound, lower) {
    const result = [];
    if (!poly.length) return result;
    let a = poly[poly.length - 1],
      da = lower ? a[axis] - bound : bound - a[axis];
    for (const b of poly) {
      const db = lower ? b[axis] - bound : bound - b[axis];
      if (da >= -1e-7 !== db >= -1e-7) {
        const u = da / (da - db);
        result.push(a.map((v, i) => v + (b[i] - v) * u));
      }
      if (db >= -1e-7) result.push(b);
      a = b;
      da = db;
    }
    return result;
  }
  function renderPart(s) {
    if (s.mesh) {
      J.root.remove(s.mesh);
      s.mesh.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      s.cap.dispose();
    }
    const group = new THREE.Group(),
      p = D.parts[s.id],
      inv = J.transform(p).invert(),
      batch = new Map(),
      extraMaterials = new Map();
    // Export positions are in Studio coordinates; local parts are in game units.
    for (const [mi, t] of refs.get(s.id) || []) {
      const mesh = J.visualMeshes[mi],
        g = mesh.geometry,
        idx = mesh.userData.originalIndex,
        verts = [];
      for (let j = 0; j < 3; j++) {
        const v = idx[t + j],
          pos = V()
            .fromBufferAttribute(g.attributes.position, v)
            .sub(V(...D.origin))
            .applyMatrix4(inv);
        const n = V().fromBufferAttribute(g.attributes.normal, v).transformDirection(inv),
          uv = g.attributes.uv,
          col = g.attributes.color;
        verts.push([
          ...pos.toArray(),
          ...n.toArray(),
          uv.getX(v),
          uv.getY(v),
          col.getX(v),
          col.getY(v),
          col.getZ(v)
        ]);
      }
      if (!batch.has(mi)) batch.set(mi, []);
      const target = batch.get(mi);
      for (const f of s.f) {
        let poly = verts;
        for (let a = 0; a < 3 && poly.length; a++) {
          // Exported decals sit slightly outside the part's outer face.
          // Keep that offset only on fragments touching the same outer face.
          const fullLow = -p[12 + a] / 2,
            fullHigh = p[12 + a] / 2;
          const min = Math.min(...verts.map((v) => v[a])),
            max = Math.max(...verts.map((v) => v[a]));
          const planar = max - min < 0.002;
          if (!(planar && min < fullLow && min > fullLow - 0.13 && Math.abs(f[a] - fullLow) < 1e-6))
            poly = clip(poly, a, f[a], true);
          if (!(planar && max > fullHigh && max < fullHigh + 0.13 && Math.abs(f[a + 3] - fullHigh) < 1e-6))
            poly = clip(poly, a, f[a + 3], false);
        }
        for (let i = 1; i < poly.length - 1; i++) target.push(poly[0], poly[i], poly[i + 1]);
      }
    }
    // SurfaceGui/decals can sit on invisible carrier parts omitted by OBJ.
    // Clip those planes in their two surface axes, preserving the artwork UVs.
    for (const [number, m] of (attached.get(s.id) || []).entries()) {
      const g = m.geometry,
        idx = g.index,
        verts = [],
        key = 'surface' + number,
        localMatrix = inv.clone().multiply(m.matrix);
      extraMaterials.set(key, m.material);
      batch.set(key, verts);
      for (let t = 0; t < (idx ? idx.count : g.attributes.position.count); t += 3) {
        const tri = [];
        for (let j = 0; j < 3; j++) {
          const i = idx ? idx.getX(t + j) : t + j,
            pos = V().fromBufferAttribute(g.attributes.position, i).applyMatrix4(localMatrix),
            n = V().fromBufferAttribute(g.attributes.normal, i).transformDirection(localMatrix),
            uv = g.attributes.uv;
          tri.push([...pos.toArray(), ...n.toArray(), uv.getX(i), uv.getY(i), 1, 1, 1]);
        }
        const normal = tri[0].slice(3, 6),
          axis = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
        for (const f of s.f) {
          const face = tri[0][axis],
            edge = normal[axis] < 0 ? f[axis] : f[axis + 3];
          if (Math.abs(face - edge) > 0.05) continue;
          let poly = tri;
          for (let a = 0; a < 3 && poly.length; a++)
            if (a !== axis) {
              poly = clip(poly, a, f[a], true);
              poly = clip(poly, a, f[a + 3], false);
            }
          for (let i = 1; i < poly.length - 1; i++) verts.push(poly[0], poly[i], poly[i + 1]);
        }
      }
    }
    function make(vertices, mat) {
      if (!vertices.length) return;
      const geo = new THREE.BufferGeometry(),
        pos = [],
        normal = [],
        uv = [],
        color = [];
      for (const v of vertices) {
        pos.push(...v.slice(0, 3));
        normal.push(...v.slice(3, 6));
        uv.push(...v.slice(6, 8));
        color.push(...v.slice(8, 11));
      }
      for (const [name, a, n] of [
        ['position', pos, 3],
        ['normal', normal, 3],
        ['uv', uv, 2],
        ['color', color, 3]
      ])
        geo.setAttribute(name, new THREE.Float32BufferAttribute(a, n));
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }
    for (const [mi, verts] of batch) make(verts, extraMaterials.get(mi) || J.visualMeshes[mi].material);
    const caps = [],
      full = initial(s.id),
      rgb = new THREE.Color().setRGB(p[15], p[16], p[17], THREE.SRGBColorSpace).toArray();
    for (const f of p[18] >= 1 ? [] : s.f)
      for (let axis = 0; axis < 3; axis++)
        for (let sign = -1; sign <= 1; sign += 2) {
          const face = sign < 0 ? f[axis] : f[axis + 3];
          if (Math.abs(face - (sign < 0 ? full[axis] : full[axis + 3])) < 1e-6) continue;
          const u = (axis + 1) % 3,
            v = (axis + 2) % 3;
          // Drop completely shared faces. Partially shared faces are harmless
          // internal surfaces; they are never drawn over exported exterior faces.
          if (
            s.f.some(
              (b) =>
                b !== f &&
                Math.abs((sign < 0 ? b[axis + 3] : b[axis]) - face) < 1e-6 &&
                b[u] <= f[u] &&
                b[u + 3] >= f[u + 3] &&
                b[v] <= f[v] &&
                b[v + 3] >= f[v + 3]
            )
          )
            continue;
          const vs = [];
          for (const corner of [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1]
          ]) {
            const pos = [0, 0, 0],
              n = [0, 0, 0];
            pos[axis] = face;
            pos[u] = f[u + 3 * corner[0]];
            pos[v] = f[v + 3 * corner[1]];
            n[axis] = sign;
            vs.push([...pos, ...n, 0, 0, ...rgb]);
          }
          const order = sign > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
          order.forEach((i) => caps.push(vs[i]));
        }
    s.cap = new THREE.MeshPhongMaterial({ vertexColors: true, color: 0xbcb8b0, shininess: 2 });
    make(caps, s.cap);
    group.name = 'JJS fractured part ' + s.id;
    group.matrixAutoUpdate = false;
    group.matrix.copy(J.transform(p));
    J.root.add(group);
    s.mesh = group;
    hideOriginal(s.id, true);
    J.setFragments(s.id, s.f);
  }
  function restore(id) {
    const s = states.get(id);
    if (!s) return;
    if (s.mesh) {
      J.root.remove(s.mesh);
      s.mesh.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      s.cap.dispose();
    }
    hideOriginal(id, false);
    J.setFragments(id, null);
    total -= s.f.length;
    states.delete(id);
  }
  function setPart(id, f, left) {
    let s = states.get(id);
    if (!s) {
      s = { id, f: [] };
      states.set(id, s);
    }
    total -= s.f.length;
    s.f = f;
    total += f.length;
    s.until = time + left;
    renderPart(s);
    return s;
  }
  function occupied(id) {
    const f = initial(id),
      actors = [player, ...enemies];
    return actors.some((e) => {
      if (e.dead || !e.pos) return false;
      const c = local(id, e.pos.clone().add(V(0, 2.5, 0)));
      // Conservative capsule bound defers nearby walls too, preventing a
      // moving fighter from being trapped while the original part returns.
      return distance(f, c) < 3.8 * 3.8;
    });
  }
  function restoreAll() {
    if (!authority()) return false;
    prepare();
    const restored = [];
    for (const s of states.values())
      if (!occupied(s.id)) {
        restored.push({ id: s.id, f: null });
        restore(s.id);
      } else s.until = time;
    if (restored.length) publish(restored);
    return true;
  }
  function validHit(m) {
    return (
      Array.isArray(m.p) &&
      m.p.length === 3 &&
      m.p.every((n) => Number.isFinite(n) && Math.abs(n) < 3000) &&
      Number.isFinite(m.r) &&
      m.r >= 1 &&
      m.r <= 18
    );
  }
  function hit(pos, radius = 4) {
    if (!enabled()) return false;
    prepare();
    const m = {
      p: pos.toArray ? pos.toArray() : [pos.x, pos.y, pos.z],
      r: Math.max(1, Math.min(18, radius))
    };
    if (!validHit(m)) return false;
    // Coalesce overlapping multihit frames, keeping large finishers distinct.
    if (time - lastImpact < 0.1 && lastPoint.distanceTo(V(...m.p)) < 1.5 && radius <= 5) return false;
    lastImpact = time;
    lastPoint.set(...m.p);
    if (!authority()) {
      if (!hostId || time - requestClock < 0.1) return false;
      requestClock = time;
      send({ t: 'ds-hit', ...m });
      return true;
    }
    return applyImpact(m);
  }
  function sweep(from, to, radius = 4) {
    if (!enabled()) return false;
    const length = from.distanceTo(to);
    if (length < 0.01) return false;
    const fraction = J.ray(from, to, 0.2);
    if (fraction >= 1 - 0.1 / length - 1e-5) return false;
    return hit(from.clone().lerp(to, Math.min(1, fraction + 0.2 / length)), radius);
  }
  function applyImpact(m) {
    if (!enabled() || !validHit(m)) return false;
    prepare();
    const point = V(...m.p),
      ids = new Set(),
      candidates = [];
    for (let x = Math.floor((point.x - m.r) / GRID); x <= Math.floor((point.x + m.r) / GRID); x++)
      for (let z = Math.floor((point.z - m.r) / GRID); z <= Math.floor((point.z + m.r) / GRID); z++)
        for (const id of grid.get(x + ',' + z) || []) ids.add(id);
    for (const id of ids) {
      const s = states.get(id),
        c = local(id, point),
        f = s ? s.f : [initial(id)];
      const q = Math.min(...f.map((b) => distance(b, c)));
      if (q <= m.r * m.r) candidates.push({ id, c, q });
    }
    candidates.sort((a, b) => a.q - b.q || a.id - b.id);
    const changes = [],
      bits = [];
    for (const { id, c } of candidates) {
      if (changes.length >= 32) break;
      const s = states.get(id);
      if (!s && states.size >= MAX_PARTS) continue;
      let carved = null;
      for (const scale of [1, 1.6, 2.5]) {
        carved = carve(s ? s.f : [initial(id)], c, m.r, Math.max(1.25, m.r * 0.22) * scale);
        if (carved) break;
      }
      if (!carved || total - (s ? s.f.length : 0) + carved.f.length > MAX_TOTAL) continue;
      const left = settings.rebuild || 1e9;
      setPart(id, carved.f, left);
      changes.push({ id, f: carved.f, left });
      if (bits.length < 40)
        for (const b of carved.removed.slice(0, Math.min(4, 40 - bits.length))) bits.push({ id, b });
    }
    if (!changes.length) return false;
    spawnDebris(bits, point);
    publish(changes, { p: m.p, r: m.r });
    return true;
  }
  function poolMesh() {
    if (pool) return;
    pool = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 2 }),
      MAX_DEBRIS
    );
    pool.name = 'JJS pooled voxel rubble';
    pool.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    pool.frustumCulled = false;
    pool.count = 0;
    scene.add(pool);
  }
  function spawnDebris(bits, point) {
    if (!settings.debris || !bits.length) return;
    poolMesh();
    for (const { id, b } of bits) {
      const p = D.parts[id],
        pos = V((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2).applyMatrix4(J.transform(p));
      const vel = pos.clone().sub(point);
      if (vel.lengthSq() < 0.01) vel.set(0.3, 1, 0.4);
      vel.normalize().multiplyScalar(7 + Math.random() * 11);
      vel.y = Math.max(vel.y, 5) + Math.random() * 7;
      const item = {
        pos,
        vel,
        life: 2.6 + Math.random() * 0.7,
        age: 0,
        rotation: new THREE.Euler(Math.random(), Math.random(), Math.random()),
        size: V(...[0, 1, 2].map((a) => Math.min(2, b[a + 3] - b[a]) * 0.8)),
        color: new THREE.Color().setRGB(p[15], p[16], p[17], THREE.SRGBColorSpace)
      };
      if (debris.length < settings.debris) debris.push(item);
      else debris[debrisCursor++ % settings.debris] = item;
    }
  }
  function publish(parts, impact) {
    ++serial;
    if (!online() || !MPJJ.host) return;
    // Small per-part packets avoid giant bursts on the existing MQTT relay.
    send({
      t: 'ds-begin',
      rev: serial,
      settings: { enabled: settings.enabled, rebuild: settings.rebuild },
      ids: Array.from(states.keys())
    });
    for (const item of parts) send({ t: 'ds-part', rev: serial, item });
    if (impact) send({ t: 'ds-rubble', rev: serial, ...impact });
  }
  function syncTo(to) {
    if (!online() || !MPJJ.host || !J.root) return;
    prepare();
    send({
      t: 'ds-begin',
      to,
      rev: serial,
      settings: { enabled: settings.enabled, rebuild: settings.rebuild },
      ids: Array.from(states.keys())
    });
    for (const s of states.values())
      send({ t: 'ds-part', to, rev: serial, item: { id: s.id, f: s.f, left: Math.max(0, s.until - time) } });
  }
  function receive(m) {
    if (!m || typeof m.t !== 'string') return false;
    if ((m.t === 'hi' || m.t === 'hi2' || m.t === 'map') && m.host && !MPJJ.host) {
      if (hostId !== m.id) {
        clear();
        hostId = m.id;
        epoch = '';
        lastRevision = 0;
      }
    }
    if (!m.t.startsWith('ds-')) return false;
    if (!online() || m.id === MPJJ.id || m.map !== 'jjs' || JJMAP.id !== 'jjs' || (m.to && m.to !== MPJJ.id))
      return true;
    prepare();
    if (m.t === 'ds-hit') {
      if (!MPJJ.host || m.epoch !== epoch || !validHit(m) || !settings.enabled) return true;
      const f = MPJJ.fighters[m.id],
        old = rates.get(m.id) || -1;
      if (!f || f.e.dead || f.e.hp <= 0 || time - old < 0.12 || f.e.pos.distanceTo(V(...m.p)) > 180)
        return true;
      rates.set(m.id, time);
      applyImpact(m);
      return true;
    }
    if (MPJJ.host || m.id !== hostId) return true;
    if (m.t === 'ds-begin') {
      if (typeof m.epoch !== 'string' || retiredEpochs.has(m.epoch)) return true;
      if (
        !Number.isInteger(m.rev) ||
        m.rev < 0 ||
        !Array.isArray(m.ids) ||
        m.ids.length > MAX_PARTS ||
        !m.ids.every((id) => refs.has(id))
      )
        return true;
      if (epoch !== m.epoch) {
        clear();
        prepare();
        epoch = m.epoch;
        lastRevision = 0;
      }
      if (m.rev < lastRevision) return true;
      lastRevision = m.rev;
      const keep = new Set(m.ids);
      for (const id of states.keys()) if (!keep.has(id)) restore(id);
      if (m.settings && typeof m.settings.enabled === 'boolean' && [0, 30, 60].includes(m.settings.rebuild))
        Object.assign(settings, { enabled: m.settings.enabled, rebuild: m.settings.rebuild });
      refreshUI();
      return true;
    }
    if (m.epoch !== epoch || m.rev !== lastRevision) return true;
    if (m.t === 'ds-part') {
      const i = m.item;
      if (!i || !refs.has(i.id)) return true;
      if (i.f === null) {
        restore(i.id);
        return true;
      }
      const full = initial(i.id);
      if (
        !Array.isArray(i.f) ||
        i.f.length > MAX_FRAGMENTS ||
        !Number.isFinite(i.left) ||
        i.left < 0 ||
        i.left > 1e9
      )
        return true;
      if (
        !i.f.every(
          (f) =>
            Array.isArray(f) &&
            f.length === 6 &&
            f.every(Number.isFinite) &&
            [0, 1, 2].every(
              (a) => f[a] >= full[a] - 1e-5 && f[a + 3] <= full[a + 3] + 1e-5 && f[a + 3] > f[a]
            )
        )
      )
        return true;
      const old = states.get(i.id);
      if ((!old && states.size >= MAX_PARTS) || total - (old ? old.f.length : 0) + i.f.length > MAX_TOTAL)
        return true;
      // Repeated snapshot packets don't rebuild GPU geometry unnecessarily.
      if (old && JSON.stringify(old.f) === JSON.stringify(i.f)) {
        old.until = time + i.left;
        return true;
      }
      setPart(i.id, i.f, i.left);
      return true;
    }
    if (m.t === 'ds-rubble' && validHit(m) && X.rubbleRevision !== m.rev) {
      X.rubbleRevision = m.rev;
      const bits = [];
      for (const s of states.values())
        if (bits.length < 20 && distance(initial(s.id), local(s.id, V(...m.p))) < m.r * m.r)
          bits.push({ id: s.id, b: [-0.5, -0.5, -0.5, 0.5, 0.5, 0.5] });
      spawnDebris(bits, V(...m.p));
    }
    return true;
  }
  function update(dt) {
    time += dt;
    if (online() && room !== MPJJ.code) {
      room = MPJJ.code;
      syncClock = 0;
    }
    if (!J.root) return;
    prepare();
    syncClock += dt;
    if (authority()) {
      const changed = [];
      for (const s of states.values())
        if (time >= s.until) {
          if (occupied(s.id)) {
            s.until = time + 1;
            continue;
          }
          changed.push({ id: s.id, f: null });
          restore(s.id);
          if (changed.length >= 4) break;
        }
      if (changed.length) publish(changed);
      // The relay is QoS 0. Periodic complete snapshots repair dropped packets
      // and include players who joined while the host was still in the menu.
      if (syncClock >= 8) {
        syncClock = 0;
        syncTo();
      }
    }
    if (pool) {
      const matrix = new THREE.Matrix4(),
        q = new THREE.Quaternion();
      debris = debris.filter((b) => {
        b.age += dt;
        return b.age < b.life;
      });
      debris.forEach((b, i) => {
        b.vel.y -= 28 * dt;
        b.pos.addScaledVector(b.vel, dt);
        const floor = J.floor(b.pos, b.pos.y + 1);
        if (Number.isFinite(floor) && b.pos.y < floor + b.size.y / 2) {
          b.pos.y = floor + b.size.y / 2;
          b.vel.y = Math.abs(b.vel.y) * 0.22;
          b.vel.x *= 0.7;
          b.vel.z *= 0.7;
        }
        b.rotation.x += dt * b.vel.z * 0.3;
        b.rotation.z += dt * b.vel.x * 0.3;
        q.setFromEuler(b.rotation);
        const fade = Math.min(1, (b.life - b.age) / 0.45);
        matrix.compose(b.pos, q, b.size.clone().multiplyScalar(fade));
        pool.setMatrixAt(i, matrix);
        pool.setColorAt(i, b.color);
      });
      pool.count = debris.length;
      pool.instanceMatrix.needsUpdate = true;
      if (pool.instanceColor) pool.instanceColor.needsUpdate = true;
    }
  }
  function configure(next) {
    if (next.debris != null && [0, 64, 192].includes(next.debris)) {
      settings.debris = next.debris;
      debris = debris.slice(0, next.debris);
    }
    if (!authority()) {
      refreshUI();
      return false;
    }
    if (typeof next.enabled === 'boolean') settings.enabled = next.enabled;
    if ([0, 30, 60].includes(next.rebuild)) {
      settings.rebuild = next.rebuild;
      for (const s of states.values()) s.until = time + (settings.rebuild || 1e9);
    }
    publish([]);
    syncTo();
    refreshUI();
    return true;
  }
  const panel = document.createElement('div');
  panel.id = 'jjDestruction';
  panel.style.cssText =
    'display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:8px;color:#b8c6d4;font:12px Arial';
  panel.innerHTML =
    '<label>JJS destruction <select aria-label="JJS destruction"><option value="on">On</option><option value="off">Off</option></select></label> <label>Rebuild <select aria-label="Rebuild delay"><option value="30">30 seconds</option><option value="60">60 seconds</option><option value="0">Never</option></select></label> <label>Debris <select aria-label="Debris quality"><option value="192">High</option><option value="64">Low</option><option value="0">Off</option></select></label> <button type="button">Restore map</button><span style="flex-basis:100%;text-align:center">Final punches and heavy attacks break the city. Occupied pieces rebuild when clear.</span>';
  const pick = document.getElementById('jjTrainingMap');
  if (pick) pick.parentElement.after(panel);
  const controls = panel.querySelectorAll('select');
  for (const c of controls)
    c.style.cssText =
      'background:#111c27;color:#d4e3ef;border:1px solid #52667e;padding:5px;border-radius:4px';
  controls[0].onchange = () => configure({ enabled: controls[0].value === 'on' });
  controls[1].onchange = () => configure({ rebuild: +controls[1].value });
  controls[2].onchange = () => configure({ debris: +controls[2].value });
  panel.querySelector('button').onclick = restoreAll;
  function refreshUI() {
    controls[0].value = settings.enabled ? 'on' : 'off';
    controls[1].value = settings.rebuild;
    controls[2].value = settings.debris;
    controls[0].disabled = controls[1].disabled = panel.querySelector('button').disabled = !authority();
  }
  // Actual gameplay hooks, not cosmetic broadcasts. A fourth M1 can break a
  // wall on a whiff. Heavy confirmed hits work for every existing character.
  const beforePunch = punch;
  punch = function () {
    const n = player.comboN,
      cool = cds.m1;
    const result = beforePunch();
    if (n === 3 && player.comboN === 0 && cds.m1 > cool)
      hit(
        player.pos
          .clone()
          .add(V(0, 2.7, 0))
          .addScaledVector(camForward(), 3.3),
        3.2
      );
    return result;
  };
  const beforeDamage = Enemy.prototype.damage;
  Enemy.prototype.damage = function (amount, knock, opts) {
    const hp = this.hp,
      pos = this.pos.clone(),
      blocked = this.blocking;
    const result = beforeDamage.call(this, amount, knock, opts);
    if (!blocked && this.hp < hp && (amount >= 12 || (knock && knock.length() > 18)))
      hit(pos.add(V(0, 1.8, 0)), amount >= 40 ? 10 : amount >= 25 ? 6 : 3.6);
    return result;
  };
  const beforeStep = stepAction;
  stepAction = function (a, dt) {
    const result = beforeStep(a, dt);
    const profile = profiles[a.type];
    if (profile && a.t >= profile[0] && !a.dsImpact) {
      a.dsImpact = true;
      if (!profile[3] || a.confirm)
        hit(
          player.pos
            .clone()
            .add(V(0, profile[4] ?? 2.4, 0))
            .addScaledVector(a.dir || camForward(), profile[2]),
          profile[1]
        );
    }
    return result;
  };
  const profiles = {
    b1: [0.47, 4, 3],
    td_air: [0.57, 4, 3],
    td_stone: [0.47, 4, 3],
    b3: [0.49, 4, 3],
    td_black: [0.49, 6, 3],
    tda3: [0.38, 5, 4],
    tda4: [5.1, 12, 3, true, 0.6],
    mh_stock: [0.65, 4, 3],
    mh_air: [0.6, 5, 3],
    mh_black: [0.46, 6, 3],
    mh_home: [0.64, 5, 4],
    mh_club_dash: [0.22, 5, 4],
    mh_spike: [1.1, 8, 0, false, 0.1],
    mh_heart: [0.65, 8, 4],
    mh_drill: [0.5, 5, 4]
  };
  const beforeRed = explodeRed;
  explodeRed = function (pos) {
    hit(pos, 13);
    return beforeRed(pos);
  };
  const beforeUpdate = updatePlayer;
  updatePlayer = function (dt) {
    update(dt);
    const result = beforeUpdate(dt);
    refreshUI();
    return result;
  };
  // High-speed knockback through walls, only simulated by the actor's owner.
  const beforeResolve = resolveActorWorld;
  resolveActorWorld = function (actor) {
    if (
      enabled() &&
      actor &&
      actor.pos &&
      actor.vel &&
      !actor.net &&
      (actor.react || actor.rag || actor.stunT > 0) &&
      actor.vel.length() > 20
    ) {
      const from = actor.pos.clone().add(V(0, 2.5, 0)),
        to = from.clone().addScaledVector(actor.vel, 0.08),
        length = from.distanceTo(to);
      if (length > 0.1) {
        const f = J.ray(from, to, 0.4);
        if (f < 1 - 0.1 / length - 1e-5) hit(from.lerp(to, f), Math.min(7, actor.vel.length() / 9));
      }
    }
    return beforeResolve.apply(this, arguments);
  };
})();
