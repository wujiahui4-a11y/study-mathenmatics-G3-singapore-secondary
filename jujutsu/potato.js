/* Local low-end graphics: a bounded, incremental cache of nearby scenery.
   Authoritative collision and destruction remain independent of rendering. */
(function () {
  'use strict';
  const KEY = 'jj.potatoMode', CELL = 48, RADIUS = 2, RANGE = 120, BUDGET = 3;
  const resident = new Map(), materials = new Map();
  let enabled = false, sourceRoot = null, nearby = null, catalog = null;
  let cellX = NaN, cellZ = NaN, queue = [], job = null, builds = 0, evictions = 0;
  let triangles = 0, selected = 0, savedGraphics = null, lastWorkMs = 0;
  try { enabled = localStorage.getItem(KEY) === '1'; } catch (_) {}
  const P = window.JJPOTATO = {
    get enabled() { return enabled; }, setEnabled, clear, invalidate,
    audit: () => ({ enabled, builds, evictions, triangles, selected,
      cells: catalog ? Object.keys(catalog).length : 0,
      residentCells: resident.size, pending: queue.length + (job ? 1 : 0),
      meshes: nearby ? nearby.children.reduce((n, g) => n + g.children.length, 0) : 0,
      center: [(cellX + .5) * CELL, (cellZ + .5) * CELL], range: RANGE,
      budgetMs: BUDGET, lastWorkMs, pixelRatio: renderer.getPixelRatio(),
      shadows: renderer.shadowMap.enabled,
      fullTriangles: window.JJJJS && JJJJS.data.visual ? JJJJS.data.visual.triangles : 0 })
  };
  const panel = document.createElement('label');
  panel.id = 'jjPotatoSetting';
  panel.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin:12px 0';
  panel.innerHTML = '<input id="jjPotatoMode" type="checkbox" aria-label="Potato Mode (Fast Mode)"> <span>Potato Mode (Fast Mode)</span><small>For smaller devices: loads nearby scenery gradually, lowers resolution and turns off shadows. Distant areas load as you move.</small>';
  const mapPicker = document.getElementById('jjTrainingMap');
  if (mapPicker) mapPicker.parentElement.after(panel);
  const toggle = panel.querySelector('input');
  toggle.checked = enabled;
  toggle.addEventListener('change', () => setEnabled(toggle.checked));
  function graphics() {
    if (enabled && !savedGraphics) {
      savedGraphics = { ratio: typeof potatoAtBoot !== 'undefined' && potatoAtBoot ? Math.min(devicePixelRatio, 1.5) : renderer.getPixelRatio(),
        shadows: typeof potatoAtBoot !== 'undefined' && potatoAtBoot ? true : renderer.shadowMap.enabled };
      renderer.setPixelRatio(Math.min(devicePixelRatio, .75));
      renderer.shadowMap.enabled = false;
    } else if (!enabled && savedGraphics) {
      renderer.setPixelRatio(savedGraphics.ratio);
      renderer.shadowMap.enabled = savedGraphics.shadows;
      renderer.shadowMap.needsUpdate = true;
      savedGraphics = null;
    }
  }
  function setEnabled(value) {
    const next = !!value;
    if (next !== enabled) { clear(); enabled = next; }
    toggle.checked = enabled;
    graphics();
    if (!enabled && window.JJJJS && JJJJS.loadTextures) JJJJS.loadTextures();
    try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch (_) {}
  }
  function dispose(group) {
    group.removeFromParent();
    group.traverse(m => { if (m.geometry) m.geometry.dispose(); });
  }
  function clear() {
    cancelJob();
    if (nearby) dispose(nearby);
    materials.forEach(m => m.dispose()); materials.clear(); resident.clear();
    sourceRoot = nearby = catalog = null; queue = []; job = null;
    cellX = cellZ = NaN; triangles = selected = 0;
  }
  function evict(key) {
    const cell = resident.get(key);
    if (!cell) return;
    triangles -= cell.triangles; selected -= cell.selected;
    dispose(cell.group); resident.delete(key); evictions++;
  }
  function schedule() {
    const wanted = new Map();
    for (let x = cellX - RADIUS; x <= cellX + RADIUS; x++)
      for (let z = cellZ - RADIUS; z <= cellZ + RADIUS; z++)
        wanted.set(x + ',' + z, { key: x + ',' + z, x, z });
    for (const key of resident.keys()) if (!wanted.has(key)) evict(key);
    if (job && !wanted.has(job.cell.key)) cancelJob();
    queue = [...wanted.values()].filter(c => !resident.has(c.key) && (!job || job.cell.key !== c.key))
      .sort((a, b) => (a.x-cellX)**2 + (a.z-cellZ)**2 - (b.x-cellX)**2 - (b.z-cellZ)**2);
  }
  function invalidate(id) {
    if (!enabled || !sourceRoot) return;
    const p = JJJJS.data.parts[id], origin = JJJJS.data.origin;
    let minX = -Infinity, maxX = Infinity, minZ = -Infinity, maxZ = Infinity;
    if (p) {
      // Include decal offsets on the edge of a part's oriented box.
      const ex = (Math.abs(p[3])*p[12] + Math.abs(p[4])*p[13] + Math.abs(p[5])*p[14])/2 + .15;
      const ez = (Math.abs(p[9])*p[12] + Math.abs(p[10])*p[13] + Math.abs(p[11])*p[14])/2 + .15;
      minX = Math.floor((p[0]-origin[0]-ex)/CELL); maxX = Math.floor((p[0]-origin[0]+ex)/CELL);
      minZ = Math.floor((p[2]-origin[2]-ez)/CELL); maxZ = Math.floor((p[2]-origin[2]+ez)/CELL);
    }
    const affected = c => c.x >= minX && c.x <= maxX && c.z >= minZ && c.z <= maxZ;
    for (const [key, c] of resident) if (affected(c)) evict(key);
    if (job && affected(job.cell)) cancelJob();
    schedule();
  }
  function prepare() {
    const J = JJJJS;
    if (sourceRoot === J.root) return;
    clear(); sourceRoot = J.root;
    const data = J.data.visual.catalog;
    if (!data || data.size !== CELL) throw new Error('Rebuild JJS data to include its nearby-area catalog.');
    catalog = data.cells;
    sourceRoot.updateMatrixWorld(true);
    // Dispose earlier full-mode GPU uploads; keep CPU geometry for gameplay.
    const textures = new Set();
    sourceRoot.traverse(m => {
      if (!m.isMesh) return;
      if (m.geometry) m.geometry.dispose();
      for (const mat of Array.isArray(m.material) ? m.material : [m.material])
        for (const key of ['map', 'normalMap', 'specularMap']) if (mat[key]) textures.add(mat[key]);
    });
    textures.forEach(t => t.dispose());
    nearby = new THREE.Group(); nearby.name = 'JJS nearby areas (Potato Mode)'; sourceRoot.add(nearby);
  }
  function lowMaterial(source) {
    if (materials.has(source)) return materials.get(source);
    if (source.map && JJJJS.loadTexture) JJJJS.loadTexture(source.map);
    const m = new THREE.MeshLambertMaterial({ color: source.color, map: source.map,
      vertexColors: source.vertexColors, transparent: source.transparent, opacity: source.opacity,
      alphaTest: source.alphaTest, depthWrite: source.depthWrite, side: source.side,
      polygonOffset: source.polygonOffset, polygonOffsetFactor: source.polygonOffsetFactor,
      polygonOffsetUnits: source.polygonOffsetUnits });
    if (source.customProgramCacheKey() === 'jjs-plastic-atlas') {
      m.onBeforeCompile = source.onBeforeCompile;
      m.customProgramCacheKey = source.customProgramCacheKey;
    }
    materials.set(source, m); return m;
  }
  function clip(poly, axis, bound, lower) {
    if (!poly.length) return poly;
    const result = [];
    let a = poly[poly.length-1], da = lower ? a[axis]-bound : bound-a[axis];
    for (const b of poly) {
      const db = lower ? b[axis]-bound : bound-b[axis];
      if ((da >= 0) !== (db >= 0)) {
        const u = da/(da-db); result.push(a.map((v, i) => v+(b[i]-v)*u));
      }
      if (db >= 0) result.push(b);
      a = b; da = db;
    }
    return result;
  }
  function* buildCell(cell) {
    const J = JJJJS, meshes = J.visualMeshes, count = meshes.length;
    const refs = catalog[cell.key] || [], batches = new Map();
    const lowX = cell.x*CELL, lowZ = cell.z*CELL, highX = lowX+CELL, highZ = lowZ+CELL;
    const pos = new THREE.Vector3(), normal = new THREE.Vector3();
    let work = 0;
    function append(m, indices, world, normalMatrix) {
      const a = m.geometry.attributes, tri = [];
      for (const i of indices) {
        pos.fromBufferAttribute(a.position, i).applyMatrix4(world);
        if (a.normal) normal.fromBufferAttribute(a.normal, i).applyMatrix3(normalMatrix).normalize();
        else normal.set(0, 1, 0);
        tri.push([pos.x,pos.y,pos.z,normal.x,normal.y,normal.z,
          a.uv ? a.uv.getX(i) : 0, a.uv ? a.uv.getY(i) : 0,
          a.color ? a.color.getX(i) : 1, a.color ? a.color.getY(i) : 1, a.color ? a.color.getZ(i) : 1]);
      }
      let poly = clip(tri, 0, lowX, true);
      poly = clip(poly, 0, highX, false); poly = clip(poly, 2, lowZ, true); poly = clip(poly, 2, highZ, false);
      if (poly.length < 3) return;
      if (!batches.has(m.material)) batches.set(m.material, {position:[], normal:[], uv:[], color:[]});
      const b = batches.get(m.material);
      for (let i = 1; i < poly.length-1; i++) for (const v of [poly[0],poly[i],poly[i+1]]) {
        b.position.push(v[0],v[1],v[2]); b.normal.push(v[3],v[4],v[5]);
        b.uv.push(v[6],v[7]); b.color.push(v[8],v[9],v[10]);
      }
    }
    const normals = meshes.map(m => new THREE.Matrix3().getNormalMatrix(m.matrixWorld));
    for (const ref of refs) {
      const mi = ref % count, t = (ref-mi)/count*3, m = meshes[mi], idx = m.geometry.index.array;
      if (!(idx[t] === idx[t+1] && idx[t] === idx[t+2]))
        append(m, [idx[t],idx[t+1],idx[t+2]], m.matrixWorld, normals[mi]);
      if (++work % 32 === 0) yield;
    }
    // Live fragments and signs use the same cells and damage invalidation.
    const originals = new Set(meshes), box = new THREE.Box3();
    for (const child of sourceRoot.children) {
      if (child === nearby || originals.has(child) || !child.visible) continue;
      child.updateMatrixWorld(true); box.setFromObject(child);
      if (box.max.x < lowX || box.min.x > highX || box.max.z < lowZ || box.min.z > highZ) continue;
      const extra = []; child.traverseVisible(m => { if (m.isMesh && !Array.isArray(m.material)) extra.push(m); });
      for (const m of extra) {
        const g = m.geometry, idx = g.index, n = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
        for (let t = 0, length = idx ? idx.count : g.attributes.position.count; t < length; t += 3) {
          append(m, idx ? [idx.getX(t),idx.getX(t+1),idx.getX(t+2)] : [t,t+1,t+2], m.matrixWorld, n);
          if (++work % 32 === 0) yield;
        }
      }
    }
    // Finish one material at a time; partial jobs never enter the scene.
    const group = new THREE.Group(); group.name = 'JJS cell ' + cell.key;
    let total = 0, completed = false;
    try {
      for (const [material, arrays] of batches) {
        const geo = new THREE.BufferGeometry();
        for (const name of ['position','normal','uv','color'])
          geo.setAttribute(name, new THREE.Float32BufferAttribute(arrays[name], name === 'uv' ? 2 : 3));
        geo.computeBoundingSphere();
        const m = new THREE.Mesh(geo, lowMaterial(material)); m.matrixAutoUpdate = false;
        group.add(m); total += arrays.position.length/9; yield;
      }
      completed = true;
      return { ...cell, group, triangles: total, selected: refs.length };
    } finally {
      // Cancellation must release any buffers completed before yielding.
      if (!completed) dispose(group);
    }
  }
  function pruneMaterials() {
    const used = new Set(), maps = new Set();
    for (const cell of resident.values()) cell.group.traverse(m => {
      if (m.material) { used.add(m.material); if (m.material.map) maps.add(m.material.map); }
    });
    for (const [source, material] of materials) if (!used.has(material)) {
      material.dispose(); materials.delete(source);
      if (material.map && !maps.has(material.map)) material.map.dispose();
    }
  }
  function cancelJob() { if (job) { job.iterator.return(); job = null; } }
  function advance() {
    const start = performance.now();
    do {
      if (!job) {
        const cell = queue.shift(); if (!cell) break;
        job = { cell, iterator: buildCell(cell) };
      }
      const result = job.iterator.next();
      if (result.done) {
        const cell = result.value;
        nearby.add(cell.group); resident.set(cell.key, cell);
        triangles += cell.triangles; selected += cell.selected; builds++; job = null;
        pruneMaterials();
      }
    } while (performance.now()-start < BUDGET);
    lastWorkMs = performance.now()-start;
  }
  const fog = new THREE.Fog(0xb4d7ec, 45, 90), render = renderer.render;
  renderer.render = function (s, c) {
    if (!enabled || s !== scene || !window.JJJJS || !JJJJS.root || !JJJJS.visualMeshes.length)
      return render.apply(this, arguments);
    prepare();
    const x = Math.floor(player.pos.x/CELL), z = Math.floor(player.pos.z/CELL);
    if (x !== cellX || z !== cellZ) { cellX = x; cellZ = z; schedule(); }
    advance();
    const hidden = [];
    for (const child of sourceRoot.children) if (child !== nearby && child.visible) {
      child.visible = false; hidden.push(child);
    }
    const oldFog = s.fog;
    if (oldFog) fog.color.copy(oldFog.color);
    s.fog = fog;
    try { return render.apply(this, arguments); }
    finally { s.fog = oldFog; hidden.forEach(child => { child.visible = true; }); }
  };
  graphics();
})();
