/* Browser integration: Todo's models, real damage, variants, cameras and peers. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http'),
  assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'),
  out = path.resolve(process.env.DESTRUCTION_ARTIFACT_DIR || path.join(root, '../destruction-test'));
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
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', (e) => {
      errors.push(e.message);
      console.error('PAGE', e.message);
    });
    await page.goto(base + '/__test');
    await page.waitForFunction(() => window.__tt);
    await page.clock.install();
    await page.evaluate(async () => {
      JJMAP.load('jjs');
      await JJJJS.ready;
      __tt.reset();
      JJDESTRUCT.update(0.01);
    });
    report.intact = await page.evaluate(() => ({ map: JJJJS.audit(), destruction: JJDESTRUCT.audit() }));
    assert.ok(report.intact.destruction.eligible > 12000);
    report.wall = await page.evaluate(() => {
      const D = JJJJS.data,
        V = (...a) => new __tt.THREE.Vector3(...a);
      const allowed = new Set(D.breakable);
      for (let id = 4000; id < D.parts.length; id++) {
        const p = D.parts[id];
        if (
          !allowed.has(id) ||
          !(p[21] & 1) ||
          p[22] ||
          Math.min(p[12], p[14]) > 4 ||
          p[13] < 12 ||
          Math.max(p[12], p[14]) < 24 ||
          p[1] < 25 ||
          p[1] > 100 ||
          p[16] > p[15] + 0.15
        )
          continue;
        const axis = p[12] < p[14] ? 0 : 2,
          local = (x, z) => (axis === 0 ? V(x, 0, z) : V(z, 0, x)),
          matrix = JJJJS.transform(p),
          at = V(0, 0, 0).applyMatrix4(matrix),
          from = local(5, 0).applyMatrix4(matrix),
          to = local(-5, 0).applyMatrix4(matrix),
          before = JJJJS.ray(from, to, 0.2);
        if (before < 0.05 || before > 0.65) continue;
        const stamp = performance.now();
        JJDESTRUCT.hit(at, 4.5);
        const ms = performance.now() - stamp;
        const after = JJJJS.ray(from, to, 0.2),
          snapshot = JJDESTRUCT.snapshot();
        if (after < 0.98 || !snapshot.some((s) => s.id === id)) {
          __tt.player.pos.set(900, 100, 900);
          for (const e of __tt.enemies) e.pos.set(900, 100, 900);
          JJDESTRUCT.restoreAll();
          continue;
        }
        window.__wall = { id, axis, at: at.toArray(), from: from.toArray(), to: to.toArray() };
        const sideFrom = local(5, 10).applyMatrix4(matrix),
          sideTo = local(-5, 10).applyMatrix4(matrix);
        return {
          id,
          before,
          after,
          side: JJJJS.ray(sideFrom, sideTo, 0.2),
          ms,
          fragments: snapshot.find((s) => s.id === id).f.length,
          at: at.toArray()
        };
      }
      throw new Error('No real wall produced a passable hole');
    });
    assert.ok(report.wall.after > 0.98);
    assert.ok(report.wall.side < 0.8);
    assert.ok(report.wall.fragments > 0);
    console.log('WALL', report.wall);
    report.geometry = await page.evaluate(() => {
      const id = __wall.id,
        mesh = JJJJS.root.getObjectByName('JJS fractured part ' + id);
      const exterior = mesh.children.filter((m) => JJJJS.visualMeshes.some((s) => s.material === m.material));
      const uv = exterior.flatMap((m) => Array.from(m.geometry.attributes.uv.array));
      const original = JJJJS.visualMeshes.flatMap((m) => {
        const o = m.userData.owners,
          idx = m.geometry.index.array,
          out = [];
        for (let t = 0; t < o.length; t++)
          if (o[t] === id + 1) out.push(idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]);
        return out;
      });
      return {
        exterior: exterior.length,
        texture: exterior.some((m) => m.material.map),
        uvSpread: Math.max(...uv) - Math.min(...uv),
        originalHidden: original.every((i) => i === 0),
        triangles: mesh.children.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0)
      };
    });
    assert.ok(report.geometry.texture);
    assert.ok(report.geometry.uvSpread > 0);
    assert.ok(report.geometry.originalHidden);
    report.walkThrough = await page.evaluate(() => {
      const p = new __tt.THREE.Vector3(...__wall.at).add(new __tt.THREE.Vector3(0, -2.5, 0));
      const before = p.clone();
      JJJJS.collide(p, 0.8);
      return p.distanceTo(before);
    });
    assert.ok(report.walkThrough < 0.05, 'The full player capsule fits through the opening');
    // Save exactly the same camera before/after; render the actual textured city.
    await page.evaluate(() => {
      __tt.hide();
      __tt.player.pos.set(900, 100, 900);
      __tt.player.rig.root.visible = false;
      for (const e of __tt.enemies) {
        e.pos.set(900, 100, 900);
        e.rig.root.visible = false;
      }
      JJDESTRUCT.restoreAll();
      const mat = JJJJS.transform(JJJJS.data.parts[__wall.id]);
      window.__view = new __tt.THREE.Vector3(...(__wall.axis === 0 ? [20, 8, 15] : [15, 8, 20]))
        .applyMatrix4(mat)
        .toArray();
      __tt.draw(__view, __wall.at);
    });
    await page.screenshot({ path: path.join(out, 'jjs-destruction-before.png') });
    await page.evaluate(() => {
      JJDESTRUCT.update(0.2);
      JJDESTRUCT.hit(new __tt.THREE.Vector3(...__wall.at), 7);
      JJDESTRUCT.update(0.1);
      __tt.draw(__view, __wall.at);
    });
    await page.screenshot({ path: path.join(out, 'jjs-destruction-after.png') });
    report.core = await page.evaluate(() => {
      const protect = new Set(
        JJJJS.data.parts.map((_, i) => i).filter((i) => !JJJJS.data.breakable.includes(i))
      );
      return { damagedCore: JJDESTRUCT.snapshot().filter((s) => protect.has(s.id)).length };
    });
    assert.equal(report.core.damagedCore, 0);
    report.restoration = await page.evaluate(() => {
      const V = __tt.THREE.Vector3;
      __tt.player.pos.copy(new V(...__wall.at)).y -= 2.5;
      JJDESTRUCT.update(31);
      const deferred = JJDESTRUCT.snapshot().some((s) => s.id === __wall.id);
      __tt.player.pos.set(900, 100, 900);
      JJDESTRUCT.update(2);
      let exact = true;
      for (const m of JJJJS.visualMeshes) {
        const o = m.userData.owners,
          a = m.geometry.index.array,
          b = m.userData.originalIndex;
        for (let t = 0; t < o.length; t++)
          if (o[t] === __wall.id + 1)
            for (let i = 0; i < 3; i++) if (a[t * 3 + i] !== b[t * 3 + i]) exact = false;
      }
      return {
        deferred,
        restored: !JJDESTRUCT.snapshot().some((s) => s.id === __wall.id),
        exact,
        ray: JJJJS.ray(new V(...__wall.from), new V(...__wall.to), 0.2),
        debris: JJDESTRUCT.audit().debris
      };
    });
    assert.ok(report.restoration.deferred);
    assert.ok(report.restoration.restored && report.restoration.exact);
    assert.ok(report.restoration.ray < 0.8);
    assert.equal(report.restoration.debris, 0);
    report.sign = await page.evaluate(() => {
      const id = 1760,
        p = JJJJS.data.parts[id],
        V = __tt.THREE.Vector3;
      const at = new V(p[0], p[1] - JJJJS.data.origin[1], p[2]);
      JJDESTRUCT.update(0.2);
      JJDESTRUCT.hit(at, 7);
      __tt.scene.updateMatrixWorld(true);
      const normal = new V(p[5], p[8], p[11]),
        ray = new __tt.THREE.Raycaster(at.clone().addScaledVector(normal, 4), normal.clone().negate(), 0, 8);
      const crossing = ray.intersectObjects(JJJJS.root.children, true);
      ray.ray.origin.add(new V(p[3], p[6], p[9]).multiplyScalar(10));
      const edge = ray.intersectObjects(JJJJS.root.children, true);
      return {
        parts: JJDESTRUCT.snapshot().filter((s) => [1760, 1765, 1769].includes(s.id)).length,
        crossing: crossing.length,
        edge: edge.length
      };
    });
    console.log('SIGN', report.sign);
    assert.equal(report.sign.parts, 3);
    assert.equal(report.sign.crossing, 0, 'Artwork has the same opening as the supporting part');
    assert.ok(report.sign.edge > 0, 'Artwork and frame survive outside the hole');
    await page.evaluate(() => JJDESTRUCT.restoreAll());
    report.floor = await page.evaluate(() => {
      const D = JJJJS.data,
        V = __tt.THREE.Vector3;
      for (const id of D.breakable) {
        const p = D.parts[id];
        if (
          p[22] ||
          !(p[21] & 1) ||
          p[12] < 16 ||
          p[14] < 16 ||
          p[13] > 2 ||
          p[7] < 0.99 ||
          p[1] < 45 ||
          p[1] > 140
        )
          continue;
        const at = new V(p[0], p[1] - D.origin[1] + p[13] / 2, p[2]),
          before = JJJJS.floor(at, at.y + 0.05);
        if (Math.abs(before - at.y) > 0.05) continue;
        JJDESTRUCT.update(0.2);
        JJDESTRUCT.hit(at, 6);
        const after = JJJJS.floor(at, at.y + 0.05);
        if (after < before - 3) {
          __tt.player.pos.copy(at);
          __tt.player.onGround = false;
          __tt.player.vel.set(0, 0, 0);
          for (let i = 0; i < 12; i++) __tt.tick(0.025);
          return { id, before, after: Number.isFinite(after) ? after : null, playerY: __tt.player.pos.y };
        }
        JJDESTRUCT.restoreAll();
      }
      throw new Error('No breakable floor found');
    });
    assert.ok(report.floor.playerY < report.floor.before - 0.2);
    // A real fourth punch must break a wall even when no enemy is hit.
    report.combat = await page.evaluate(() => {
      JJDESTRUCT.restoreAll();
      __tt.reset();
      const V = __tt.THREE.Vector3,
        at = new V(...__wall.at),
        dir = __tt.camForward();
      __tt.player.pos.copy(at).addScaledVector(dir, -3.3).y -= 2.7;
      __tt.player.comboN = 3;
      __tt.cds.m1 = 0;
      JJDESTRUCT.update(0.2);
      __tt.punch();
      const m1 = JJDESTRUCT.snapshot().some((s) => s.id === __wall.id);
      __tt.player.pos.set(900, 100, 900);
      JJDESTRUCT.restoreAll();
      JJDESTRUCT.update(0.2);
      __tt.red(__wall.at);
      const red = JJDESTRUCT.snapshot().some((s) => s.id === __wall.id);
      JJDESTRUCT.restoreAll();
      __tt.player.pos.copy(at).y -= 2.4;
      JJDESTRUCT.update(0.2);
      __tt.step(
        {
          type: 'mh_heart',
          t: 0.7,
          dur: 2,
          stage: 0,
          dir: new V(0, 0, 1),
          events: {},
          origin: at.clone(),
          hits: new Set()
        },
        0.025
      );
      const mahito = JJDESTRUCT.snapshot().some((s) => s.id === __wall.id);
      return { m1, red, mahito };
    });
    console.log('COMBAT', report.combat);
    assert.ok(report.combat.m1 && report.combat.red && report.combat.mahito);
    report.budgets = await page.evaluate(() => {
      __tt.player.pos.set(900, 100, 900);
      JJDESTRUCT.restoreAll();
      JJDESTRUCT.configure({ rebuild: 0 });
      let peak = 0;
      for (let i = 0; i < 18; i++) {
        JJDESTRUCT.update(0.15);
        const stamp = performance.now();
        JJDESTRUCT.hit(
          new __tt.THREE.Vector3(...__wall.at).add(new __tt.THREE.Vector3(0, i % 4, (i - 8) * 2)),
          8
        );
        peak = Math.max(peak, performance.now() - stamp);
      }
      return { ...JJDESTRUCT.audit(), peak };
    });
    assert.ok(
      report.budgets.parts <= 160 && report.budgets.fragments <= 5000 && report.budgets.debris <= 192
    );
    console.log('BUDGETS', report.budgets);
    // Two separate pages, using the real multiplayer router and a recorded relay.
    const peer = await browser.newPage();
    peer.on('pageerror', (e) => errors.push(e.message));
    await peer.goto(base + '/__test');
    await peer.waitForFunction(() => window.__tt);
    await peer.clock.install();
    await page.evaluate(() => {
      __tt.player.pos.set(900, 100, 900);
      JJDESTRUCT.restoreAll();
      JJDESTRUCT.newRoom();
      MPJJ.active = true;
      MPJJ.joined = true;
      MPJJ.code = 'TEST';
      MPJJ.map = 'jjs';
      MPJJ.id = 'host';
      MPJJ.host = true;
      window.__packets = [];
      MPJJ.relay = { pub: (m) => __packets.push(JSON.parse(JSON.stringify(m))) };
      JJDESTRUCT.update(0.2);
    });
    await peer.evaluate(() => {
      MPJJ.active = true;
      MPJJ.joined = true;
      MPJJ.code = 'TEST';
      MPJJ.id = 'guest';
      MPJJ.host = false;
      window.__packets = [];
      MPJJ.relay = { pub: (m) => __packets.push(JSON.parse(JSON.stringify(m))) };
      MPJJ.receive({ t: 'map', id: 'host', host: true, map: 'jjs' });
    });
    const deliver = async (from, to) => {
      const packets = await from.evaluate(() => __packets.splice(0));
      await to.evaluate((ps) => ps.forEach((m) => MPJJ.receive(m)), packets);
      return packets;
    };
    await page.evaluate(() => {
      MPJJ.receive({ t: 'hi', id: 'guest', n: 'Guest', c: 'todo', map: 'jjs', host: false });
      JJDESTRUCT.hit(new __tt.THREE.Vector3(...__wall.at), 5);
    });
    const packets = await deliver(page, peer);
    const hostSnap = await page.evaluate(() => JJDESTRUCT.snapshot().map(({ id, f }) => ({ id, f })));
    assert.deepEqual(
      await peer.evaluate(() => JJDESTRUCT.snapshot().map(({ id, f }) => ({ id, f }))),
      hostSnap
    );
    await peer.evaluate((ps) => ps.forEach((m) => MPJJ.receive(m)), packets);
    assert.deepEqual(
      await peer.evaluate(() => JJDESTRUCT.snapshot().map(({ id, f }) => ({ id, f }))),
      hostSnap
    );
    assert.equal(await peer.evaluate(() => JJDESTRUCT.configure({ enabled: false })), false);
    const oldPackets = packets;
    await peer.evaluate((at) => {
      __tt.player.pos.set(...at);
      JJDESTRUCT.update(0.3);
      JJDESTRUCT.hit(new __tt.THREE.Vector3(...at).add(new __tt.THREE.Vector3(0, 0, 3)), 4);
    }, report.wall.at);
    await page.evaluate((at) => {
      MPJJ.fighters.guest.e.pos.set(...at);
      JJDESTRUCT.update(0.3);
    }, report.wall.at);
    await deliver(peer, page);
    await deliver(page, peer);
    assert.deepEqual(
      await peer.evaluate(() => JJDESTRUCT.snapshot().map(({ id, f }) => ({ id, f }))),
      await page.evaluate(() => JJDESTRUCT.snapshot().map(({ id, f }) => ({ id, f })))
    );
    // Recover from a missed update/late join via full snapshot.
    await peer.evaluate(() => {
      JJDESTRUCT.newRoom();
      MPJJ.receive({ t: 'map', id: 'host', host: true, map: 'jjs' });
    });
    await page.evaluate(() => JJDESTRUCT.syncTo('guest'));
    await deliver(page, peer);
    assert.deepEqual(
      await peer.evaluate(() => JJDESTRUCT.snapshot().map(({ id, f }) => ({ id, f }))),
      await page.evaluate(() => JJDESTRUCT.snapshot().map(({ id, f }) => ({ id, f })))
    );
    const invalid = await peer.evaluate(() => {
      const before = JSON.stringify(JJDESTRUCT.snapshot());
      MPJJ.receive({
        t: 'ds-begin',
        id: 'intruder',
        map: 'jjs',
        epoch: 'bad',
        rev: 900,
        ids: [],
        settings: { enabled: false, rebuild: 0 }
      });
      return before === JSON.stringify(JJDESTRUCT.snapshot());
    });
    assert.ok(invalid);
    await page.evaluate(() => {
      JJMAP.load('plate');
      JJMAP.load('jjs');
      JJDESTRUCT.syncTo('guest');
    });
    await deliver(page, peer);
    await peer.evaluate((ps) => ps.forEach((m) => MPJJ.receive(m)), oldPackets);
    assert.equal(await peer.evaluate(() => JJDESTRUCT.audit().parts), 0);
    report.multiplayer =
      'Host/guest geometry matches; duplicate packets, guest settings, invalid authority, late join, missed-update recovery and stale map generation checked';
    await peer.close();
    await page.evaluate(() => {
      MPJJ.active = false;
      MPJJ.joined = false;
      MPJJ.relay = null;
      JJMAP.load('plate');
    });
    assert.equal(
      await page.evaluate(() => __tt.scene.getObjectByName('JJS pooled voxel rubble') === undefined),
      true
    );
    assert.deepEqual(errors, []);
    report.errors = errors;
    fs.writeFileSync(path.join(out, 'destruction-tests.json'), JSON.stringify(report, null, 2));
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
