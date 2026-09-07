/* Local graphics preference: upload only a moving window of JJS scenery.
   Full CPU map data remains available for collision and shared destruction. */
(function () {
  'use strict';
  const KEY = 'jj.potatoMode',
    CELL = 48,
    RANGE = 144;
  const grid = new Map();
  let enabled = false,
    sourceRoot = null,
    nearby = null,
    dirty = true;
  let cellX = NaN,
    cellZ = NaN,
    builds = 0,
    selected = 0,
    triangles = 0;
  try {
    enabled = localStorage.getItem(KEY) === '1';
  } catch (_) {}
  const P = (window.JJPOTATO = {
    get enabled() {
      return enabled;
    },
    setEnabled,
    clear,
    invalidate,
    audit: () => ({
      enabled,
      builds,
      triangles,
      selected,
      cells: grid.size,
      meshes: nearby ? nearby.children.length : 0,
      center: [cellX, cellZ],
      range: RANGE,
      fullTriangles: window.JJJJS && JJJJS.data.visual ? JJJJS.data.visual.triangles : 0
    })
  });
  const panel = document.createElement('label');
  panel.id = 'jjPotatoSetting';
  panel.style.cssText =
    'display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:9px;margin:12px 0;color:#d6e7cd;font:600 13px Arial;cursor:pointer';
  panel.innerHTML =
    '<input id="jjPotatoMode" type="checkbox" aria-label="Potato Mode (Fast Mode)" style="accent-color:#98cc67;width:17px;height:17px"> <span>Potato Mode (Fast Mode)</span><small style="flex-basis:100%;text-align:center;font-weight:400;color:#a4b6a0">Shows nearby JJS areas as you move. Turn off to see the full map.</small>';
  const mapPicker = document.getElementById('jjTrainingMap');
  if (mapPicker) mapPicker.parentElement.after(panel);
  const toggle = panel.querySelector('input');
  toggle.checked = enabled;
  toggle.addEventListener('change', () => setEnabled(toggle.checked));
  function setEnabled(value) {
    const next = !!value;
    if (next !== enabled) {
      clear();
      enabled = next;
    }
    toggle.checked = enabled;
    try {
      localStorage.setItem(KEY, enabled ? '1' : '0');
    } catch (_) {}
  }
  function clear() {
    if (nearby) {
      nearby.removeFromParent();
      nearby.children.forEach((m) => m.geometry.dispose());
    }
    nearby = null;
    sourceRoot = null;
    grid.clear();
    dirty = true;
    cellX = cellZ = NaN;
    selected = triangles = 0;
  }
  function invalidate(id) {
    if (!enabled || !sourceRoot) return;
    const p = JJJJS.data.parts[id];
    if (!p) {
      dirty = true;
      return;
    }
    const origin = JJJJS.data.origin;
    const ex = (Math.abs(p[3]) * p[12] + Math.abs(p[4]) * p[13] + Math.abs(p[5]) * p[14]) / 2;
    const ez = (Math.abs(p[9]) * p[12] + Math.abs(p[10]) * p[13] + Math.abs(p[11]) * p[14]) / 2;
    if (Math.abs(p[0] - origin[0] - cellX) <= RANGE + ex && Math.abs(p[2] - origin[2] - cellZ) <= RANGE + ez)
      dirty = true;
  }
  function prepare() {
    const J = JJJJS;
    if (sourceRoot === J.root) return;
    clear();
    sourceRoot = J.root;
    const meshes = J.visualMeshes,
      count = meshes.length,
      origin = J.data.origin;
    const textures = new Set();
    meshes.forEach((m, mi) => {
      const p = m.geometry.attributes.position,
        idx = m.userData.originalIndex;
      for (let t = 0; t < idx.length; t += 3) {
        const xs = [
          p.getX(idx[t]) - origin[0],
          p.getX(idx[t + 1]) - origin[0],
          p.getX(idx[t + 2]) - origin[0]
        ];
        const zs = [
          p.getZ(idx[t]) - origin[2],
          p.getZ(idx[t + 1]) - origin[2],
          p.getZ(idx[t + 2]) - origin[2]
        ];
        const ref = (t / 3) * count + mi;
        for (let x = Math.floor(Math.min(...xs) / CELL); x <= Math.floor(Math.max(...xs) / CELL); x++)
          for (let z = Math.floor(Math.min(...zs) / CELL); z <= Math.floor(Math.max(...zs) / CELL); z++) {
            const key = x + ',' + z;
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key).push(ref);
          }
      }
      // Dispose GPU buffers from an earlier full-mode frame while retaining
      // the CPU attributes used by collision, destruction and this catalog.
      m.geometry.dispose();
      for (const key of ['map', 'normalMap', 'specularMap'])
        if (m.material[key]) textures.add(m.material[key]);
    });
    textures.forEach((t) => t.dispose());
    const originals = new Set(meshes);
    sourceRoot.traverse((m) => {
      if (m.isMesh && !originals.has(m) && m.geometry) m.geometry.dispose();
    });
    nearby = new THREE.Group();
    nearby.name = 'JJS nearby areas (Potato Mode)';
    sourceRoot.add(nearby);
  }
  function clip(poly, axis, bound, lower) {
    if (!poly.length) return poly;
    const result = [];
    let a = poly[poly.length - 1],
      da = lower ? a[axis] - bound : bound - a[axis];
    for (const b of poly) {
      const db = lower ? b[axis] - bound : bound - b[axis];
      if (da >= 0 !== db >= 0) {
        const u = da / (da - db);
        result.push(a.map((v, i) => v + (b[i] - v) * u));
      }
      if (db >= 0) result.push(b);
      a = b;
      da = db;
    }
    return result;
  }
  function rebuild(x, z) {
    const J = JJJJS,
      meshes = J.visualMeshes,
      count = meshes.length,
      refs = new Set(),
      batches = new Map();
    const lowX = x - RANGE,
      highX = x + RANGE,
      lowZ = z - RANGE,
      highZ = z + RANGE;
    for (let a = Math.floor(lowX / CELL); a <= Math.floor(highX / CELL); a++)
      for (let b = Math.floor(lowZ / CELL); b <= Math.floor(highZ / CELL); b++)
        for (const ref of grid.get(a + ',' + b) || []) refs.add(ref);
    function append(m, indices, world, normalMatrix) {
      const g = m.geometry,
        a = g.attributes,
        tri = [];
      for (const i of indices) {
        const pos = new THREE.Vector3().fromBufferAttribute(a.position, i).applyMatrix4(world);
        const n = a.normal
          ? new THREE.Vector3().fromBufferAttribute(a.normal, i).applyMatrix3(normalMatrix).normalize()
          : new THREE.Vector3(0, 1, 0);
        tri.push([
          ...pos.toArray(),
          ...n.toArray(),
          a.uv ? a.uv.getX(i) : 0,
          a.uv ? a.uv.getY(i) : 0,
          a.color ? a.color.getX(i) : 1,
          a.color ? a.color.getY(i) : 1,
          a.color ? a.color.getZ(i) : 1
        ]);
      }
      let poly = clip(tri, 0, lowX, true);
      poly = clip(poly, 0, highX, false);
      poly = clip(poly, 2, lowZ, true);
      poly = clip(poly, 2, highZ, false);
      if (poly.length < 3) return;
      if (!batches.has(m.material)) batches.set(m.material, []);
      const out = batches.get(m.material);
      for (let i = 1; i < poly.length - 1; i++) out.push(poly[0], poly[i], poly[i + 1]);
    }
    sourceRoot.updateMatrixWorld(true);
    const normals = meshes.map((m) => new THREE.Matrix3().getNormalMatrix(m.matrixWorld));
    for (const ref of refs) {
      const mi = ref % count,
        t = ((ref - mi) / count) * 3,
        m = meshes[mi],
        idx = m.geometry.index.array;
      if (idx[t] === idx[t + 1] && idx[t] === idx[t + 2]) continue;
      append(m, [idx[t], idx[t + 1], idx[t + 2]], m.matrixWorld, normals[mi]);
    }
    // Include surviving destruction fragments and SurfaceGui planes in the
    // same moving window, including damage received while the area was far away.
    const original = new Set(meshes),
      box = new THREE.Box3();
    for (const child of sourceRoot.children) {
      if (child === nearby || original.has(child) || !child.visible) continue;
      box.setFromObject(child);
      if (box.max.x < lowX || box.min.x > highX || box.max.z < lowZ || box.min.z > highZ) continue;
      child.traverseVisible((m) => {
        if (!m.isMesh || Array.isArray(m.material) || !m.geometry.attributes.position) return;
        const g = m.geometry,
          idx = g.index,
          n = new THREE.Matrix3().getNormalMatrix(m.matrixWorld),
          length = idx ? idx.count : g.attributes.position.count;
        for (let t = 0; t < length; t += 3)
          append(
            m,
            idx ? [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)] : [t, t + 1, t + 2],
            m.matrixWorld,
            n
          );
        g.dispose(); // only the clipped replacement needs GPU buffers in Fast Mode
      });
    }
    nearby.children.slice().forEach((m) => {
      nearby.remove(m);
      m.geometry.dispose();
    });
    triangles = 0;
    for (const [material, verts] of batches) {
      const geo = new THREE.BufferGeometry(),
        pos = [],
        normal = [],
        uv = [],
        color = [];
      for (const v of verts) {
        pos.push(...v.slice(0, 3));
        normal.push(...v.slice(3, 6));
        uv.push(...v.slice(6, 8));
        color.push(...v.slice(8, 11));
      }
      for (const [name, array, size] of [
        ['position', pos, 3],
        ['normal', normal, 3],
        ['uv', uv, 2],
        ['color', color, 3]
      ])
        geo.setAttribute(name, new THREE.Float32BufferAttribute(array, size));
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, material);
      m.receiveShadow = true;
      nearby.add(m);
      triangles += verts.length / 3;
    }
    nearby.updateMatrixWorld(true);
    cellX = x;
    cellZ = z;
    selected = refs.size;
    dirty = false;
    builds++;
  }
  const fog = new THREE.Fog(0xb4d7ec, 55, 95),
    render = renderer.render;
  renderer.render = function (s, c) {
    if (!enabled || s !== scene || !window.JJJJS || !JJJJS.root || !JJJJS.visualMeshes.length)
      return render.apply(this, arguments);
    prepare();
    const x = (Math.floor(player.pos.x / CELL) + 0.5) * CELL,
      z = (Math.floor(player.pos.z / CELL) + 0.5) * CELL;
    if (dirty || x !== cellX || z !== cellZ) rebuild(x, z);
    const hidden = [];
    for (const child of sourceRoot.children)
      if (child !== nearby && child.visible) {
        child.visible = false;
        hidden.push(child);
      }
    const oldFog = s.fog;
    fog.color.copy(oldFog ? oldFog.color : new THREE.Color(0xb4d7ec));
    s.fog = fog;
    try {
      return render.apply(this, arguments);
    } finally {
      s.fog = oldFog;
      hidden.forEach((child) => (child.visible = true));
    }
  };
})();
