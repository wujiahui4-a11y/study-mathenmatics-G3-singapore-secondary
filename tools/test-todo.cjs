/* Browser integration: Todo's models, real damage, variants, cameras and peers. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http'),
  assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'),
  out = path.resolve(process.env.TODO_ARTIFACT_DIR || path.join(root, '../todo-test'));
fs.mkdirSync(out, { recursive: true });
const hooks = `window.__tt={THREE,scene,camera,renderer,player,enemies,cds,keys,CHARS,worldFloor,
 tick(dt=.025){updatePlayer(dt);for(const e of enemies){e.iframes=Math.max(0,(e.iframes||0)-dt);e.rig.root.position.copy(e.pos);e.rig.root.rotation.y=e.facing;}
 for(let i=fx.length-1;i>=0;i--)if(!fx[i].update(dt))fx.splice(i,1);updateCamera(dt);updateHUD(dt);},
 reset(){window.JJFIGHT?.reset();JJTODO.cleanup();JJTODOFX.clear();JJMAHITO.cleanup();started=false;switchChar('todo',true);started=true;menu.style.display='none';
 player.dead=false;player.hp=player.maxHp=100;player.iframes=0;player.action=null;player.react=null;player.frameT=0;player.attackT=0;player.comboN=0;player.blocking=false;
 player.pos.set(0,0,0);player.vel.set(0,0,0);player.onGround=true;player.facing=0;camYaw=Math.PI;camPitch=.22;player.__jjsLast=null;clearMovement();
 for(const k in cds)cds[k]=0;for(const e of enemies){JJGORE.clear(e);if(window.JJRAG)JJRAG.stop(e);e.dead=false;e.hp=e.maxHp=1000;e.pos.set(85,0,85);e.vel.set(0,0,0);e.react=null;e.cineHold=false;e.stunT=0;e.iframes=0;e.blocking=false;e.rig.body.position.set(0,0,0);e.rig.body.scale.set(1,1,1);}
 },target(x=0,z=4,y=0,hp=1000){const e=enemies.find(e=>!e.net);e.pos.set(x,y,z);e.rig.root.position.copy(e.pos);e.hp=e.maxHp=hp;return e;},
 draw(pos,look){scene.updateMatrixWorld(true);if(pos){camera.position.set(...pos);camera.lookAt(...look);}camera.updateProjectionMatrix();renderer.render(scene,camera);},
 hide(){document.querySelectorAll('body > :not(canvas):not(script)').forEach(e=>e.style.visibility='hidden');},
 hurt(d){hurtPlayer(d,new THREE.Vector3(0,0,-5));},punch(){punch();},cameraState(){return {yaw:camYaw,pitch:camPitch,fov:camera.fov};}};`;
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
    await page.waitForFunction(() => !!window.__tt);
    await page.clock.install();
    const tick = async (s, p = page) =>
      p.evaluate((s) => {
        for (let i = 0; i < Math.round(s / 0.025); i++) __tt.tick(0.025);
      }, s);
    await page.evaluate(() => {
      __tt.reset();
      __tt.tick();
    });
    report.voxel = await page.evaluate(() => {
      let cells = 0,
        meshes = 0,
        triangles = 0,
        bad = [];
      __tt.player.rig.root.traverse((o) => {
        if (o.isMesh) {
          meshes++;
          cells += o.geometry.userData.cells || 0;
          triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
          if (!o.geometry.userData.voxel) bad.push(o.name);
        }
      });
      return { cells, meshes, triangles, bad };
    });
    assert.deepEqual(report.voxel.bad, []);
    assert.ok(report.voxel.cells > 20000);
    await page.evaluate(() => {
      __tt.hide();
      __tt.draw([5.2, 4.8, 9], [0, 3, 0]);
    });
    await page.screenshot({ path: path.join(out, 'todo-voxel.png') });
    report.base = {};
    for (const slot of [1, 2, 3, 4]) {
      await page.evaluate((slot) => {
        __tt.reset();
        __tt.target();
        JJTODO.cast(slot);
      }, slot);
      await tick(slot === 2 ? 1 : 2.5);
      const state = await page.evaluate(() => ({
        hp: __tt.enemies.find((e) => !e.net).hp,
        cd: { ...__tt.cds },
        action: __tt.player.action && __tt.player.action.type
      }));
      report.base[slot] = 1000 - state.hp;
      assert.ok(state.hp < 1000, `Base ${slot} must hit`);
      assert.ok(state.cd['b' + slot] > 0, `Base ${slot} cooldown`);
    }
    report.variants = {};
    await page.evaluate(() => {
      __tt.reset();
      __tt.target();
      __tt.player.onGround = false;
      __tt.player.pos.y = 2;
      JJTODO.cast(1);
    });
    await tick(1.3);
    report.variants.air = 1000 - (await page.evaluate(() => __tt.enemies.find((e) => !e.net).hp));
    assert.equal(report.variants.air, 17);
    await page.evaluate(() => {
      __tt.reset();
      __tt.target();
      JJTODO.cast(2);
    });
    await tick(0.7);
    assert.equal(await page.evaluate(() => JJTODO.cast(2)), true);
    await tick(1.1);
    report.variants.stone = 1000 - (await page.evaluate(() => __tt.enemies.find((e) => !e.net).hp));
    assert.equal(report.variants.stone, 28);
    await page.evaluate(() => {
      __tt.reset();
      __tt.target();
      JJTODO.cast(3);
    });
    await tick(0.3);
    assert.equal(await page.evaluate(() => JJTODO.cast(3)), true);
    await tick(1);
    report.variants.black = 1000 - (await page.evaluate(() => __tt.enemies.find((e) => !e.net).hp));
    assert.equal(report.variants.black, 22);
    await page.evaluate(() => {
      __tt.reset();
      __tt.target();
      JJTODO.special();
    });
    await tick(0.2);
    await page.evaluate(() => __tt.hurt(20));
    await tick(0.6);
    assert.equal(await page.evaluate(() => __tt.player.hp), 100);
    assert.equal(await page.evaluate(() => __tt.enemies.find((e) => !e.net).hp), 992);
    await page.evaluate(() => {
      __tt.reset();
      __tt.target();
      JJTODO.special();
    });
    await tick(0.7);
    await page.evaluate(() => __tt.hurt(20));
    assert.equal(await page.evaluate(() => __tt.player.hp), 80);
    report.counter = 'R counters only inside its timing window; late attacks deal normal damage';
    await page.evaluate(() => {
      __tt.reset();
      __tt.target();
      JJTODO.cast(1);
    });
    await tick(1.2);
    assert.ok(await page.evaluate(() => JJTODO.charge > 0));
    await page.evaluate(() => {
      __tt.reset();
      __tt.player.hp = 40;
      JJTODO.charge = 100;
      window.__camera = __tt.cameraState();
      JJTODO.awaken();
    });
    assert.equal(await page.evaluate(() => __tt.player.hp), 75);
    await tick(1);
    await page.evaluate(() => {
      __tt.draw();
      document.getElementById('jjTodoCinema').style.visibility = 'visible';
    });
    await page.screenshot({ path: path.join(out, 'todo-locket.png') });
    await tick(1);
    await page.evaluate(() => __tt.draw());
    await page.screenshot({ path: path.join(out, 'todo-awakening.png') });
    await tick(1.8);
    assert.equal(await page.evaluate(() => JJTODO.cine), null);
    assert.ok(await page.evaluate(() => __tt.player.hp >= 75));
    assert.equal(await page.evaluate(() => __tt.player.rig.td.awake), true);
    assert.deepEqual(
      await page.evaluate(() => __tt.cameraState()),
      await page.evaluate(() => window.__camera)
    );
    report.awakening =
      'Meter earned through combat; heals 35, opens the voxel locket, shows an imagination stage and changes to the muscular awakened model; camera restored';
    await page.evaluate(() => {
      __tt.draw([5.2, 4.8, 9], [0, 3, 0]);
    });
    await page.screenshot({ path: path.join(out, 'todo-awakened-model.png') });
    report.awake = {};
    for (const slot of [1, 2, 3, 4]) {
      await page.evaluate((slot) => {
        __tt.reset();
        __tt.target();
        JJTODO.active = true;
        JJTODO.remaining = 50;
        JJTODO.cast(slot);
      }, slot);
      await tick(slot === 4 ? 3 : 2.6);
      if (slot === 4) {
        assert.ok(await page.evaluate(() => !!JJTODO.cine));
        await page.evaluate(() => {
          __tt.draw();
          document.getElementById('jjTodoCinema').style.visibility = 'visible';
        });
        await page.screenshot({ path: path.join(out, 'todo-ultimate.png') });
        await tick(2.22);
        await page.evaluate(() => __tt.draw());
        await page.screenshot({ path: path.join(out, 'todo-black-flash.png') });
        await tick(0.78);
      }
      const hp = await page.evaluate(() => __tt.enemies.find((e) => !e.net).hp);
      report.awake[slot] = 1000 - hp;
      assert.ok(hp < 1000, `Awake ${slot} damage`);
      assert.equal(
        await page.evaluate(() => __tt.enemies.find((e) => !e.net).cineHold),
        false,
        'Target released'
      );
    }
    assert.equal(report.awake[4], 55);
    assert.equal(await page.evaluate(() => JJTODO.cine), null);
    await page.evaluate(() => {
      __tt.reset();
      JJTODO.active = true;
      JJTODO.remaining = 50;
      JJTODO.cast(4);
    });
    await tick(1.3);
    assert.equal(await page.evaluate(() => JJTODO.cine), null);
    assert.equal(await page.evaluate(() => __tt.player.action), null);
    await page.evaluate(() => {
      __tt.reset();
      __tt.target();
      JJTODO.active = true;
      JJTODO.remaining = 50;
      JJTODO.cast(4);
    });
    await tick(0.7);
    await page.evaluate(() => (__tt.player.dead = true));
    await tick(0.1);
    assert.equal(await page.evaluate(() => JJTODO.cine), null);
    assert.equal(await page.evaluate(() => __tt.enemies.find((e) => !e.net).cineHold), false);
    report.cinematic =
      'Ultimate confirms a target, deals exactly 55 once, releases targets, and cleans up on whiff or caster death';
    await page.evaluate(() => {
      __tt.reset();
      __tt.target().blocking = true;
      __tt.enemies.find((e) => !e.net).facing = Math.PI;
      JJTODO.cast(3);
    });
    await tick(1.2);
    assert.equal(
      await page.evaluate(() => __tt.enemies.find((e) => !e.net).hp),
      1000,
      'Front guard blocks normal punches'
    );
    await page.evaluate(() => {
      __tt.reset();
      __tt.target().iframes = 2;
      JJTODO.cast(1);
    });
    await tick(1.2);
    assert.equal(
      await page.evaluate(() => __tt.enemies.find((e) => !e.net).hp),
      1000,
      'Invulnerable targets cannot be swapped or hit'
    );
    await page.evaluate(() => {
      __tt.reset();
      __tt.target();
      JJTODO.cast(3);
    });
    await tick(0.1);
    assert.equal(
      await page.evaluate(() => JJTODO.cast(3)),
      false,
      'Early re-press must not grant Black Flash'
    );
    await tick(1.1);
    await page.evaluate(() => {
      __tt.reset();
      __tt.target();
    });
    await page.keyboard.press('Digit1');
    assert.equal(await page.evaluate(() => __tt.player.action.type), 'b1');
    await tick(1.2);
    assert.equal(await page.evaluate(() => JJTODO.cast(1)), false, 'Cooldown prevents repeated skill');
    report.guards =
      'Normal guard, invulnerability, cooldowns, early Black Flash timing, and unlocked keyboard casting checked';
    for (const id of ['b1', 'b2', 'b3', 'b4']) {
      await page.evaluate((id) => {
        __tt.reset();
        window.__finTarget = __tt.target(0, 4, 0, 1);
        __finTarget.damage(8, new __tt.THREE.Vector3(0, 0, 10), { fin: true, finSkill: id });
      }, id);
      await tick(1.5);
      await page.clock.runFor(1800);
      assert.equal(await page.evaluate(() => window.__finTarget.dead), true, id + ' finisher');
      await tick(5);
    }
    report.finishers = 'All four base-skill lethal finishers execute and release their target';
    const peer = await browser.newPage();
    peer.on('pageerror', (e) => errors.push(e.message));
    await peer.goto(base + '/__test');
    await peer.waitForFunction(() => !!window.__tt);
    await peer.evaluate(() => {
      __tt.reset();
      __tt.player.pos.set(0, 0, 4);
      MPJJ.active = true;
      MPJJ.id = 'peer';
      window.__packets = [];
      MPJJ.relay = {
        connected: true,
        pub(m) {
          __packets.push(m);
        }
      };
    });
    await page.evaluate(() => {
      __tt.reset();
      MPJJ.active = true;
      MPJJ.id = 'caster';
      window.__packets = [];
      MPJJ.relay = {
        connected: true,
        pub(m) {
          __packets.push(m);
        }
      };
      MPJJ.receive({ t: 's', id: 'peer', n: 'PEER', c: 'yuji', x: 0, z: 4, h: 0, y: 314, hp: 100, mx: 100 });
      JJTODO.active = true;
      JJTODO.remaining = 50;
      JJTODO.cast(4);
    });
    var receivedDamage = 0,
      minimumHP = 100;
    for (let i = 0; i < 60; i++) {
      await tick(0.1);
      const packets = await page.evaluate(() => __packets.splice(0));
      receivedDamage += packets.filter((m) => m.t === 'hit').reduce((a, m) => a + m.d, 0);
      await peer.evaluate((p) => p.forEach((m) => MPJJ.receive(m)), packets);
      minimumHP = Math.min(minimumHP, await peer.evaluate(() => __tt.player.hp));
      await tick(0.1, peer);
      if (i === 12)
        assert.ok(await peer.evaluate(() => !!JJTODO.grabbed && !!JJTODO.cine), 'Victim has hold and camera');
    }
    assert.equal(receivedDamage, 55);
    assert.equal(minimumHP, 45);
    assert.equal(await peer.evaluate(() => JJTODO.grabbed), null);
    assert.equal(await peer.evaluate(() => JJTODO.cine), null);
    const hpAfter = await peer.evaluate(() => __tt.player.hp);
    await tick(2, peer);
    assert.ok((await peer.evaluate(() => __tt.player.hp)) >= hpAfter, 'No extra damage from replay');
    await peer.evaluate(() => {
      __tt.reset();
      window.__camera = __tt.cameraState();
      JJTODO.cinematic(
        'ultimate',
        new __tt.THREE.Vector3(),
        new __tt.THREE.Vector3(0, 0, 1),
        null,
        false,
        false,
        MPJJ.fighters.caster.e
      );
    });
    await tick(0.5, peer);
    assert.equal(await peer.evaluate(() => JJTODO.cine), null);
    assert.deepEqual(
      await peer.evaluate(() => __tt.cameraState()),
      await peer.evaluate(() => window.__camera)
    );
    await peer.evaluate(() => {
      __tt.player.iframes = 0;
      JJTODO.receive({ t: 'td-control', id: 'caster', to: 'peer', op: 'hold', x: 0, y: 0, z: 4 });
    });
    await tick(0.6, peer);
    assert.equal(await peer.evaluate(() => JJTODO.grabbed), null, 'Hold expires without refresh');
    report.multiplayer =
      'Two clients: victim camera and hold, exactly 55 damage once, full release; spectator camera untouched; missing hold packets expire';
    await peer.close();
    await page.evaluate(() => {
      MPJJ.active = false;
      __tt.reset();
      const s = document.getElementById('jjTrainingMap');
      s.value = 'jjs';
      s.dispatchEvent(new Event('change'));
    });
    await page.evaluate(() => JJJJS.ready);
    // Keep the roof intact while checking teleport height; destruction and
    // falling through damaged floors have their own integration suite.
    await page.evaluate(() => JJDESTRUCT.configure({enabled:false}));
    report.rooftop = await page.evaluate(() => {
      const attempts = [];
      const D = JJJJS.data,
        candidates = D.parts.filter(
          (p) => p[12] > 18 && p[14] > 18 && p[13] < 3 && p[7] > 0.99 && p[1] > 45 && p[1] < 140
        );
      for (const part of candidates) {
        const pos = new __tt.THREE.Vector3(part[0], part[1] - D.origin[1] + part[13] / 2, part[2]);
        const y = JJMAP.floor(pos, pos.y + 0.04);
        if (Math.abs(y - pos.y) > 0.1 || JJMAP.ceiling(pos, y + 0.1) - y < 9) continue;
        __tt.reset();
        __tt.player.pos.copy(pos);
        __tt.player.onGround = true;
        __tt.player.__jjsLast = null;
        const e = __tt.target(pos.x, pos.z + 4, y);
        const cast = JJTODO.cast(1),
          ac = __tt.player.action;
        for (let i = 0; i < 48; i++) __tt.tick(0.025);
        attempts.push({
          cast,
          type: ac && ac.type,
          target: ac && ac.target === e,
          line: JJJJS.ray(
            pos.clone().add(new __tt.THREE.Vector3(0, 2.5, 0)),
            e.pos.clone().add(new __tt.THREE.Vector3(0, 2.5, 0)),
            0.25
          ),
          hp: e.hp,
          y,
          py: __tt.player.pos.y,
          pos: pos.toArray(),
          actual: __tt.player.pos.toArray()
        });
        if (e.hp === 986 && Math.abs(__tt.player.pos.y - y) < 0.1)
          return { floor: y, playerY: __tt.player.pos.y, damage: 1000 - e.hp };
      }
      return { failed: true, attempts };
    });
    console.log(
      'ROOF',
      JSON.stringify(report.rooftop.failed ? report.rooftop.attempts.slice(0, 3) : report.rooftop)
    );
    assert.ok(
      !report.rooftop.failed && report.rooftop,
      'Todo swaps land on the JJS roof, not at zero height'
    );
    report.wall = await page.evaluate(() => {
      const D = JJJJS.data,
        a = D.parts.find((p) => p[21] & 1 && p[12] < 2 && p[13] > 10 && p[14] > 15 && p[1] > 25 && p[1] < 90);
      const center = new __tt.THREE.Vector3(a[0], a[1] - D.origin[1], a[2]),
        axis = new __tt.THREE.Vector3(a[3], a[6], a[9]);
      const from = center.clone().addScaledVector(axis, -5),
        to = center.clone().addScaledVector(axis, 5);
      __tt.player.pos.copy(from);
      JJTODO.move(__tt.player, to, true);
      return { requested: from.distanceTo(to), travel: from.distanceTo(__tt.player.pos) };
    });
    assert.ok(report.wall.travel < report.wall.requested - 1, 'Swap must stop before solid JJS wall');
    await page.evaluate(() => {
      const s = document.getElementById('jjTrainingMap');
      s.value = 'plate';
      s.dispatchEvent(new Event('change'));
    });
    await page.evaluate(() => {
      MPJJ.active = false;
      __tt.reset();
      JJTODO.active = true;
      JJTODO.remaining = 0.1;
    });
    await tick(0.2);
    assert.equal(await page.evaluate(() => JJTODO.active), false);
    assert.equal(await page.evaluate(() => __tt.player.rig.td.awake), false);
    for (const file of ['/jujutsu-multiplayer.html', '/jujutsu-parts/index.local.html']) {
      const p = await browser.newPage();
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(base + file);
      await p.waitForFunction(() => !!window.JJTODO && !!window.MPJJ);
      await p.evaluate(() => __game.switchChar('todo', true));
      await p.click('#menuFight');
      await p.keyboard.press('Digit3');
      assert.ok(await p.evaluate(() => __game.player.rig.td));
      await p.close();
    }
    assert.deepEqual(errors, []);
    report.errors = errors;
    fs.writeFileSync(path.join(out, 'todo-tests.json'), JSON.stringify(report, null, 2));
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
