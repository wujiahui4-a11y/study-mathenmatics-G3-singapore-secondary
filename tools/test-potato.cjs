/* Browser integration: Todo's models, real damage, variants, cameras and peers. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http'),
  assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'),
  out = path.resolve(process.env.POTATO_ARTIFACT_DIR || path.join(root, '../potato-test'));
fs.mkdirSync(out, { recursive: true });
const hooks = `window.__tt={THREE,scene,camera,renderer,player,enemies,cds,keys,CHARS,worldFloor,camForward,
 tick(dt=.025){updatePlayer(dt);for(const e of enemies){e.iframes=Math.max(0,(e.iframes||0)-dt);e.rig.root.position.copy(e.pos);e.rig.root.rotation.y=e.facing;}
 for(let i=fx.length-1;i>=0;i--)if(!fx[i].update(dt))fx.splice(i,1);updateCamera(dt);updateHUD(dt);},
 reset(){JJTODO.cleanup();JJTODOFX.clear();JJMAHITO.cleanup();started=false;switchChar('todo',true);started=true;menu.style.display='none';
 player.dead=false;player.hp=player.maxHp=100;player.iframes=0;player.action=null;player.react=null;player.frameT=0;player.attackT=0;player.comboN=0;player.blocking=false;
 player.pos.set(0,0,0);player.vel.set(0,0,0);player.onGround=true;player.facing=0;camYaw=Math.PI;camPitch=.22;player.__jjsLast=null;clearMovement();
 for(const k in cds)cds[k]=0;for(const e of enemies){JJGORE.clear(e);if(window.JJRAG)JJRAG.stop(e);e.dead=false;e.hp=e.maxHp=1000;e.pos.set(85,0,85);e.vel.set(0,0,0);e.react=null;e.cineHold=false;e.stunT=0;e.iframes=0;e.blocking=false;e.rig.body.position.set(0,0,0);e.rig.body.scale.set(1,1,1);}
 },target(x=0,z=4,y=0,hp=1000){const e=enemies.find(e=>!e.net);e.pos.set(x,y,z);e.rig.root.position.copy(e.pos);e.hp=e.maxHp=hp;return e;},
 draw(pos,look){scene.updateMatrixWorld(true);if(pos){camera.position.set(...pos);camera.lookAt(...look);}camera.updateProjectionMatrix();renderer.render(scene,camera);},
 hide(){document.querySelectorAll('body > :not(canvas):not(script)').forEach(e=>e.style.visibility='hidden');},
 hurt(d){hurtPlayer(d,new THREE.Vector3(0,0,-5));},punch(){punch();},red(pos){explodeRed(new THREE.Vector3(...pos));},step(a,dt){stepAction(a,dt);},resolve(e,y,r){resolveActorWorld(e,y,r);},cameraState(){return {yaw:camYaw,pitch:camPitch,fov:camera.fov};}};`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost').pathname;
  if (url === '/__test') {
    let s = fs
      .readFileSync(path.join(root, 'jujutsu-multiplayer.html'), 'utf8')
      .replace('<head>', '<head><script>requestAnimationFrame=function(){return 0;};</script>');
    const i = s.lastIndexOf('</script>');
    res.setHeader('Content-Type', 'text/html');
    return res.end(s.slice(0, i) + hooks + s.slice(i));
  }
  const f = path.resolve(root, '.' + decodeURIComponent(url));
  if (!f.startsWith(root + path.sep) || !fs.existsSync(f)) {
    res.writeHead(404);
    return res.end();
  }
  res.setHeader('Content-Type', f.endsWith('.html') ? 'text/html' : 'text/javascript');
  fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const errors = [],
    report = {};
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (e) => {
      errors.push(e.message);
      console.error(e.message);
    });
    await page.goto(base + '/__test');
    await page.waitForFunction(() => window.__tt && window.JJPOTATO);
    assert.equal(await page.locator('#jjPotatoMode').isChecked(), false);
    await page.evaluate(async () => {
      JJMAP.load('jjs');
      await JJJJS.ready;
      __tt.reset();
      const sp = JJMAP.spawn(2);
      __tt.player.pos.set(sp.x, sp.y, sp.z);
      __tt.player.rig.root.visible = false;
      for (const e of __tt.enemies) e.rig.root.visible = false;
      window.__view = [sp.x + 18, sp.y + 16, sp.z + 25];
      window.__look = [sp.x, sp.y + 3, sp.z];
      __tt.draw(__view, __look);
      window.__full = __tt.renderer.info.render.triangles;
    });
    await page.screenshot({ path: path.join(out, 'potato-off.png') });
    await page.evaluate(() => (document.getElementById('menu').style.display = ''));
    await page.locator('#jjPotatoMode').check();
    await page.evaluate(() => (document.getElementById('menu').style.display = 'none'));
    report.nearby = await page.evaluate(() => {
      const t = performance.now();
      __tt.draw(__view, __look);
      const group = JJJJS.root.getObjectByName('JJS nearby areas (Potato Mode)'),
        a = JJPOTATO.audit();
      let outside = 0;
      group.traverse((m) => {
        if (!m.isMesh) return;
        const p = m.geometry.attributes.position;
        for (let i = 0; i < p.count; i++)
          if (
            Math.abs(p.getX(i) - a.center[0]) > a.range + 0.01 ||
            Math.abs(p.getZ(i) - a.center[1]) > a.range + 0.01
          )
            outside++;
      });
      window.__originalFog = __tt.scene.fog;
      window.__nearBuild = a.builds;
      return {
        fullDrawn: __full,
        fastDrawn: __tt.renderer.info.render.triangles,
        ms: performance.now() - t,
        outside,
        ...a
      };
    });
    assert.equal(report.nearby.outside, 0, 'Even giant floor triangles must be clipped to nearby bounds');
    assert.ok(report.nearby.triangles < report.nearby.fullTriangles * 0.6);
    assert.ok(report.nearby.fastDrawn < report.nearby.fullDrawn * 0.7);
    console.log('NEARBY', report.nearby);
    await page.screenshot({ path: path.join(out, 'potato-on.png') });
    report.movement = await page.evaluate(() => {
      const before = JJPOTATO.audit();
      __tt.draw(__view, __look);
      const stable = JJPOTATO.audit().builds === before.builds;
      const old = JJJJS.root
        .getObjectByName('JJS nearby areas (Potato Mode)')
        .children.map((m) => m.geometry);
      let released = 0;
      old.forEach((g) => g.addEventListener('dispose', () => released++));
      __tt.player.pos.x += 170;
      __tt.draw(
        [__tt.player.pos.x + 18, 17, __tt.player.pos.z + 25],
        [__tt.player.pos.x, 3, __tt.player.pos.z]
      );
      return { stable, released, old: old.length, before: before.center, after: JJPOTATO.audit().center };
    });
    assert.ok(report.movement.stable);
    assert.equal(report.movement.released, report.movement.old);
    assert.notDeepEqual(report.movement.before, report.movement.after);
    report.destruction = await page.evaluate(() => {
      const D = JJJJS.data,
        V = __tt.THREE.Vector3,
        p = D.parts[4211],
        at = new V(p[0], p[1] - D.origin[1], p[2]),
        matrix = JJJJS.transform(p);
      const from = new V(0, 0, 5).applyMatrix4(matrix),
        to = new V(0, 0, -5).applyMatrix4(matrix);
      __tt.player.pos.copy(at).y -= 2.5;
      const cam = at
        .clone()
        .add(new V(15, 10, 20))
        .toArray();
      __tt.draw(cam, at.toArray());
      const before = JJJJS.ray(from, to, 0.2),
        builds = JJPOTATO.audit().builds;
      JJDESTRUCT.hit(at, 7);
      __tt.draw(cam, at.toArray());
      __tt.scene.updateMatrixWorld(true);
      const ray = new __tt.THREE.Raycaster(from, to.clone().sub(from).normalize(), 0, 10);
      const group = JJJJS.root.getObjectByName('JJS nearby areas (Potato Mode)');
      const after = JJJJS.ray(from, to, 0.2),
        visibleHole = ray.intersectObjects(group.children, true).length === 0;
      const rebuilt = JJPOTATO.audit().builds > builds;
      // A far-away impact doesn't rebuild the current window. Visiting later
      // must show its authoritative damage instead of the old unbroken mesh.
      __tt.player.pos.set(250, 10, 220);
      __tt.draw([260, 25, 240], [250, 10, 220]);
      const distantBuild = JJPOTATO.audit().builds;
      JJDESTRUCT.update(0.2);
      JJDESTRUCT.hit(at.clone().add(new V(0, 0, 6)), 5);
      __tt.draw([260, 25, 240], [250, 10, 220]);
      const farStable = JJPOTATO.audit().builds === distantBuild;
      __tt.player.pos.copy(at).y -= 2.5;
      __tt.draw(cam, at.toArray());
      const returnHole =
        ray.intersectObjects(JJJJS.root.getObjectByName('JJS nearby areas (Potato Mode)').children, true)
          .length === 0;
      __tt.player.pos.set(900, 100, 900);
      for (const e of __tt.enemies) e.pos.set(900, 100, 900);
      JJDESTRUCT.restoreAll();
      __tt.player.pos.copy(at).y -= 2.5;
      __tt.draw(cam, at.toArray());
      const restored =
        ray.intersectObjects(JJJJS.root.getObjectByName('JJS nearby areas (Potato Mode)').children, true)
          .length > 0;
      return { before, after, visibleHole, rebuilt, farStable, returnHole, restored };
    });
    console.log('DESTRUCTION', report.destruction);
    assert.ok(
      report.destruction.before < 0.8 &&
        report.destruction.after > 0.98 &&
        report.destruction.visibleHole &&
        report.destruction.rebuilt &&
        report.destruction.farStable &&
        report.destruction.returnHole &&
        report.destruction.restored
    );
    report.personal = await page.evaluate(() => {
      const messages = [];
      MPJJ.active = true;
      MPJJ.id = 'guest';
      MPJJ.host = false;
      MPJJ.relay = { pub: (m) => messages.push(m) };
      JJPOTATO.setEnabled(false);
      JJPOTATO.setEnabled(true);
      MPJJ.active = false;
      MPJJ.relay = null;
      return { messages: messages.length, enabled: JJPOTATO.enabled };
    });
    assert.equal(report.personal.messages, 0);
    assert.ok(report.personal.enabled);
    await page.reload();
    await page.waitForFunction(() => window.__tt && window.JJPOTATO);
    assert.ok(await page.locator('#jjPotatoMode').isChecked());
    report.persistence = await page.evaluate(async () => {
      JJMAP.load('jjs');
      await JJJJS.ready;
      let fullCalls = 0;
      for (const m of JJJJS.visualMeshes) m.onBeforeRender = () => fullCalls++;
      __tt.draw([3, 20, 35], [0, 3, 0]);
      const fog = __tt.scene.fog,
        fast = JJPOTATO.audit().triangles;
      JJPOTATO.setEnabled(false);
      __tt.draw([3, 20, 35], [0, 3, 0]);
      const off = {
        fullCalls,
        nearby: !!JJJJS.root.getObjectByName('JJS nearby areas (Potato Mode)'),
        fogRestored: __tt.scene.fog === fog
      };
      return { fast, off };
    });
    assert.ok(report.persistence.fast > 0);
    assert.ok(report.persistence.off.fullCalls > 0);
    assert.equal(report.persistence.off.nearby, false);
    assert.ok(report.persistence.off.fogRestored);
    report.cleanup = await page.evaluate(() => {
      for (let i = 0; i < 3; i++) {
        JJPOTATO.setEnabled(true);
        __tt.draw([3, 20, 35], [0, 3, 0]);
        JJMAP.load('plate');
        JJMAP.load('jjs');
      }
      JJMAP.load('plate');
      __tt.draw([3, 20, 35], [0, 3, 0]);
      return {
        cells: JJPOTATO.audit().cells,
        meshes: JJPOTATO.audit().meshes,
        floor: __tt.worldFloor(new __tt.THREE.Vector3(0, 10, 0)),
        enabled: JJPOTATO.enabled
      };
    });
    assert.deepEqual(report.cleanup, { cells: 0, meshes: 0, floor: 0, enabled: true });
    const smoke = await browser.newPage();
    smoke.on('pageerror', (e) => errors.push(e.message));
    await smoke.addInitScript(() => localStorage.setItem('jj.potatoMode', '1'));
    await smoke.goto(base + '/jujutsu-parts/index.local.html?map=jjs');
    await smoke.waitForFunction(() => window.JJPOTATO && JJPOTATO.audit().triangles > 0);
    assert.ok(await smoke.locator('#jjPotatoMode').isChecked());
    await smoke.close();
    assert.deepEqual(errors, []);
    report.errors = errors;
    fs.writeFileSync(path.join(out, 'potato-tests.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
