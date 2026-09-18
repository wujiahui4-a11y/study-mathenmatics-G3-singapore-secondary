const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
(async () => {
  const root = path.resolve(__dirname, '..');
  const THREE = await import(require('node:url').pathToFileURL(path.join(root, 'jujutsu/three.module.min.js')).href);
  const base = fs.readFileSync(path.join(root, 'jujutsu/base.html'), 'utf8'), gojo = fs.readFileSync(path.join(root, 'jujutsu/gojo.js'), 'utf8');
  const c = vm.createContext({THREE, FX: {T: {star: new THREE.Texture()}}});
  vm.runInContext(base.slice(base.indexOf('function boxMesh('), base.indexOf('const JOINTS =')), c);
  vm.runInContext(gojo.slice(gojo.indexOf('  function findBlindfold('), gojo.indexOf('  /* every Gojo rig')), c);
  const cfg = {gojo: true, torso: 0x11142a, pants: 0x11142a, skin: 0xf2d3c2, shoes: 0x121212};
  for (let n = 0; n < 3; n++) {
    const rig = c.makeAnimeRig(cfg), normal = rig.head.children.filter(m => m.userData.gojoHair);
    assert.ok(normal.length >= 12); c.setLook(rig, true);
    assert.ok(normal.every(m => !m.visible)); assert.equal(rig.blindfold.visible, false); assert.equal(rig.sixEyes.visible, true);
    const loose = rig.looseHair; assert.ok(loose.visible); assert.equal(loose.children.length, 2);
    const locks = loose.children.find(m => m.isInstancedMesh); assert.equal(locks.count, 22);
    const bounds = new THREE.Box3().setFromObject(loose); assert.ok(bounds.max.x - bounds.min.x > 1.1, 'Awakened hair spreads beyond the crown');
    c.setLook(rig, false); assert.ok(normal.every(m => m.visible)); assert.equal(loose.visible, false);
    c.setLook(rig, true); assert.equal(rig.looseHair, loose, 'Repeated awakening reuses geometry');
  }
  console.log('PASS: Gojo loose hair, spread bounds, two draw groups, normal-look restoration and repeated awakening reuse.');
})().catch(e => {console.error(e); process.exitCode = 1;});
