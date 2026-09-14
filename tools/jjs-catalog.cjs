'use strict';

// Build the triangle lookup once on the build machine, not on a small device.
module.exports = function catalog(visual, origin, size = 48) {
  const cells = new Map(), count = visual.groups.length;
  const floats = s => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
  const ints = s => { const b = Buffer.from(s, 'base64'); return new Uint32Array(b.buffer, b.byteOffset, b.length / 4); };
  visual.groups.forEach((g, mi) => {
    const p = floats(g.position), idx = ints(g.index);
    for (let t = 0; t < idx.length; t += 3) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (let j = 0; j < 3; j++) {
        const v = idx[t + j] * 3, x = p[v] - origin[0], z = p[v + 2] - origin[2];
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      }
      for (let x = Math.floor(minX / size); x <= Math.floor(maxX / size); x++)
        for (let z = Math.floor(minZ / size); z <= Math.floor(maxZ / size); z++) {
          const key = x + ',' + z;
          if (!cells.has(key)) cells.set(key, []);
          cells.get(key).push(t / 3 * count + mi);
        }
    }
  });
  return { size, cells: Object.fromEntries(cells) };
};
