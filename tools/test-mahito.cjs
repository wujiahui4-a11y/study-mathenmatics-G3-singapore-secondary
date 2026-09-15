/* Perfection behavior and rendered voxel model integration checks. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http'),
  assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'),
  out = path.resolve(process.env.MAHITO_ARTIFACT_DIR || path.join(root, '../mahito-test'));
fs.mkdirSync(out, { recursive: true });
const hooks = `window.__mt={THREE,scene,camera,renderer,player,enemies,cds,keys,CHARS,makeAnimeRig,addCrate,crates,
 tick(dt=.025){updatePlayer(dt);for(let i=fx.length-1;i>=0;i--)if(!fx[i].update(dt))fx.splice(i,1);updateHUD(dt);},
 fxOnly(dt=.025){for(let i=fx.length-1;i>=0;i--)if(!fx[i].update(dt))fx.splice(i,1);},
 reset(){JJMAHITO.cleanup();started=false;switchChar('mahito',true);started=true;menu.style.display='none';
  player.dead=false;player.hp=player.maxHp=100;player.iframes=0;player.action=null;player.react=null;player.frameT=0;player.attackT=0;player.comboN=0;player.blocking=false;
  player.pos.set(0,0,0);player.vel.set(0,0,0);player.onGround=true;player.facing=0;camYaw=Math.PI;player.__jjsLast=null;clearMovement();
  for(const key in cds)cds[key]=0;
  for(const e of enemies){JJGORE.clear(e);if(window.JJRAG)JJRAG.stop(e);e.dead=false;e.hp=e.maxHp=1000;e.mhConsumed=false;e.pos.set(85,0,85);e.vel.set(0,0,0);e.react=null;e.cineHold=false;e.stunT=0;e.iframes=0;e.blocking=false;e.rig.body.position.set(0,0,0);e.rig.body.scale.set(1,1,1);}
 }, target(x=0,z=4,y=0,hp=1000){const e=enemies.find(e=>!e.net);e.pos.set(x,y,z);e.rig.root.position.copy(e.pos);e.hp=e.maxHp=hp;return e;},
 draw(pos,look){scene.updateMatrixWorld(true);camera.position.set(...pos);camera.lookAt(...look);camera.updateProjectionMatrix();renderer.render(scene,camera);},
 hide(){document.querySelectorAll('body > :not(canvas):not(script)').forEach(e=>e.style.visibility='hidden');},hurt:(d,k)=>hurtPlayer(d,k),punch:()=>punch(),dash:()=>doDash()};`;
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/__test') {
    let s = fs.readFileSync(path.join(root, 'jujutsu-multiplayer.html'), 'utf8');
    s = s.replace('<head>', '<head><script>requestAnimationFrame=function(){return 0;};</script>');
    const end = s.lastIndexOf('</script>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(s.slice(0, end) + hooks + s.slice(end));
    return;
  }
  const f = path.resolve(root, '.' + decodeURIComponent(pathname));
  if (!f.startsWith(root + path.sep) || !fs.existsSync(f)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader(
    'Content-Type',
    f.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8'
  );
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
      console.error('PAGE:', e.message);
    });
    await page.goto(base + '/__test');
    await page.waitForFunction(() => !!window.__mt);
    await page.clock.install();
    const tick = async (seconds) => {
      for (let i = 0; i < Math.ceil(seconds / 0.025); i++) await page.evaluate(() => __mt.tick(0.025));
    };
    await page.evaluate(() => {
      __mt.reset();
      __mt.tick();
    });
    report.voxel = await page.evaluate(() => {
      let cells = 0,
        triangles = 0,
        meshes = 0,
        bad = [];
      __mt.player.rig.root.traverse((o) => {
        if (o.isMesh) {
          meshes++;
          triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
          if (!o.geometry.userData.voxel) bad.push(o.name);
          cells += o.geometry.userData.cells || 0;
        }
      });
      return { cells, triangles, meshes, bad };
    });
    assert.deepEqual(report.voxel.bad, []);
    assert.ok(report.voxel.cells > 10000);
    await page.evaluate(() => {
      __mt.hide();
      __mt.enemies.forEach((e) => (e.rig.root.visible = false));
      __mt.draw([4.5, 4.5, 8], [0, 3.2, 0]);
    });
    await page.screenshot({ path: path.join(out, 'mahito-voxel.png') });
    await page.evaluate(() =>
      document.querySelectorAll('body > :not(canvas):not(script)').forEach((e) => (e.style.visibility = ''))
    );
    report.damage = [];
    for (const [key, expected, awake, x, z, y] of [
      ['mh_stock', 12, false, 0, 4, 0],
      ['mh_air', 10, false, 0, 4, 0],
      ['mh_fire', 12, false, 0, 8, 0],
      ['mh_focus', 10, false, 0, 4, 0],
      ['mh_black', 12, false, 0, 4, 0],
      ['mh_chain', 3, false, 0, 9, 0],
      ['mh_home', 18, false, 0, 5, 0],
      ['mh_repel', 14, false, 0, 8, 0],
      ['mh_ride', 14, false, 0, 8, 0],
      ['mh_blade_dash', 6.5, false, 0, 10, 0],
      ['mh_club_dash', 8.5, false, 0, 6, 0],
      ['mh_awblack', 10, true, 0, 10, 0],
      ['mh_drill', 35, true, 0, 4, 0],
      ['mh_heart', 45, true, 0, 5, 0],
      ['mh_spike', 25, true, 8, 0, 0]
    ]) {
      await page.evaluate(
        ({ key, awake, x, z, y }) => {
          __mt.reset();
          if (awake) {
            JJMAHITO.active = true;
            JJMAHITO.remaining = 60;
          }
          __mt.target(x, z, y);
          if (key === 'mh_air') {
            __mt.player.onGround = false;
            __mt.player.pos.y = 2;
          }
          if (!JJMAHITO.start(key)) throw Error('Cast rejected: ' + key);
        },
        { key, awake, x, z, y }
      );
      await tick(key === 'mh_heart' ? 5 : key === 'mh_spike' ? 4 : 3.8);
      const damage = await page.evaluate(() => 1000 - __mt.enemies.find((e) => !e.net).hp);
      assert.ok(Math.abs(damage - expected) < 0.02, key + ': expected ' + expected + ', got ' + damage);
      report.damage.push({ key, damage });
      console.log(key + ' passed');
    }
    await page.evaluate(() => {
      __mt.reset();
      JJMAHITO.cast(3);
    });
    await tick(0.25);
    await page.keyboard.press('Digit3');
    assert.equal(await page.evaluate(() => __mt.player.action.type), 'mh_black');
    await page.evaluate(() => {
      __mt.reset();
      JJMAHITO.cast(4);
      __mt.cds.mh3 = 8;
    });
    await tick(0.3);
    await page.keyboard.press('Digit3');
    assert.equal(await page.evaluate(() => __mt.player.action.type), 'mh_ride');
    assert.ok(await page.evaluate(() => __mt.cds.mh3 > 7));
    for (const [mode, key] of [
      [0, 'mh_focus'],
      [1, 'mh_chain'],
      [2, 'mh_home']
    ]) {
      await page.evaluate((mode) => {
        __mt.reset();
        for (let i = 0; i < mode; i++) JJMAHITO.special();
        JJMAHITO.cast(3);
      }, mode);
      assert.equal(await page.evaluate(() => __mt.player.action.type), key);
    }
    report.variants = 'Timed Black Flash, Body Repel ride, and all three arm modes';
    await page.evaluate(() => {
      __mt.reset();
      __mt.target(0, 4);
      const e = __mt.enemies.find((e) => !e.net);
      e.blocking = true;
      e.facing = Math.PI;
      JJMAHITO.start('mh_focus');
    });
    await tick(1.3);
    assert.equal(await page.evaluate(() => __mt.enemies.find((e) => !e.net).hp), 1000);
    await page.evaluate(() => {
      __mt.reset();
      __mt.target(0, 4);
      const e = __mt.enemies.find((e) => !e.net);
      e.blocking = true;
      e.facing = Math.PI;
      JJMAHITO.start('mh_stock');
    });
    await tick(1.2);
    assert.equal(await page.evaluate(() => __mt.enemies.find((e) => !e.net).hp), 994);
    report.blocking = 'Focus Strike is blockable; Stockpile second hit breaks through';
    await page.evaluate(() => {
      __mt.reset();
      JJMAHITO.charge = 100;
      __mt.player.hp = 40;
      if (!JJMAHITO.awaken()) throw Error('Awakening failed');
    });
    assert.equal(await page.evaluate(() => __mt.player.hp), 85);
    await tick(2.3);
    assert.ok(await page.evaluate(() => JJMAHITO.active && JJMAHITO.remaining < 60));
    await page.keyboard.press('KeyX');
    assert.equal(await page.evaluate(() => JJMAHITO.basePage), true);
    await page.keyboard.press('KeyX');
    assert.equal(await page.evaluate(() => JJMAHITO.basePage), false);
    await page.evaluate(() => {
      __mt.player.action = null;
      __mt.target(0, 5);
      JJMAHITO.start('mh_idle');
    });
    await tick(2.3);
    assert.equal(await page.evaluate(() => __mt.enemies.find((e) => !e.net).hp), 985);
    await page.evaluate(() => {
      __mt.player.action = null;
      __mt.player.react = null;
      __mt.player.pos.set(0, 0, 0);
      __mt.target(0, 5);
      __mt.cds.mha1 = 0;
      JJMAHITO.start('mh_idle');
    });
    await tick(2.5);
    assert.ok(await page.evaluate(() => __mt.enemies.find((e) => !e.net).hp <= 0));
    assert.equal(await page.evaluate(() => __mt.cds.mha1), 0);
    report.awakening = '45 HP heal, 60-second first awakening, kit switching and second-touch execution';
    await page.evaluate(() => {
      __mt.reset();
      JJMAHITO.active = true;
      JJMAHITO.remaining = 60;
      JJMAHITO.mode = 2;
      __mt.target(0, 15);
      JJMAHITO.cast(2);
    });
    await tick(0.35);
    await page.keyboard.press('Digit2');
    await tick(0.1);
    assert.equal(await page.evaluate(() => __mt.enemies.find((e) => !e.net).hp), 987);
    await page.keyboard.press('KeyR');
    await tick(0.1);
    assert.equal(await page.evaluate(() => __mt.enemies.find((e) => !e.net).hp), 983);
    assert.equal(await page.evaluate(() => __mt.enemies.find((e) => !e.net).cineHold), false);
    report.grab = 'Force Grab catches at range, slams on 2, throws on R and releases the target';
    for (const key of ['mh_air', 'mh_focus', 'mh_black', 'mh_home', 'mh_blade_dash']) {
      await page.evaluate((key) => {
        __mt.reset();
        const e = __mt.target(0, 4, 0, 1);
        JJFIN.play(e, key, new __mt.THREE.Vector3(0, 0, 1));
      }, key);
      await tick(1.5);
      await page.clock.runFor(7500);
      assert.ok(await page.evaluate(() => !JJFIN.busy()));
    }
    await tick(8);
    await page.evaluate(() => {
      __mt.reset();
      __mt.target(0, 4, 0, 1);
      JJMAHITO.start('mh_focus');
    });
    await tick(0.6);
    assert.equal(await page.evaluate(() => __mt.player.action.type), 'mh_fin');
    await tick(1.5);
    await page.clock.runFor(1800);
    assert.ok(await page.evaluate(() => __mt.enemies.find((e) => !e.net).dead));
    assert.ok(await page.evaluate(() => JJMAHITO.items.length >= 1));
    await page.evaluate(() => {
      __mt.player.pos.copy(JJMAHITO.items[0].g.position);
      __mt.player.action = null;
      JJMAHITO.pickup();
      JJMAHITO.special();
    });
    assert.equal(await page.evaluate(() => JJMAHITO.reserves.length), 1);
    await page.evaluate(() => {
      JJMAHITO.withdraw();
    });
    assert.ok(await page.evaluate(() => !!JJMAHITO.held));
    report.finishers =
      'All five named finishers run; lethal Focus Strike drops retrievable/storable soul items';
    await page.evaluate(() => {
      __mt.reset();
      JJMAHITO.active = true;
      JJMAHITO.remaining = 60;
      __mt.target(0, 7);
      JJMAHITO.start('mh_domain');
    });
    await tick(2.6);
    assert.ok(await page.evaluate(() => !!JJMAHITO.domain));
    await tick(10);
    assert.ok(await page.evaluate(() => __mt.enemies.find((e) => !e.net).hp <= 0));
    await tick(5);
    assert.equal(await page.evaluate(() => JJMAHITO.domain), null);
    report.domain = 'Domain drains soul integrity, executes at zero and cleans up after 14 seconds';
    await page.evaluate(() => {
      __mt.reset();
      JJMAHITO.active = true;
      JJMAHITO.remaining = 0.1;
      __mt.tick(0.2);
    });
    assert.equal(await page.evaluate(() => JJMAHITO.active), false);
    assert.equal(await page.evaluate(() => JJMAHITO.secondAwakening), false);
    // Interruption and targeting checks cover paths that a stationary damage
    // dummy alone would not detect.
    await page.evaluate(() => {
      __mt.reset();
      JJMAHITO.active = true;
      JJMAHITO.remaining = 60;
      __mt.target(0, 12);
      JJMAHITO.start('mh_grab');
    });
    await tick(0.25);
    await page.evaluate(() => __mt.hurt(5, new __mt.THREE.Vector3(1, 0, 0)));
    await tick(0.1);
    assert.equal(await page.evaluate(() => __mt.enemies.find((e) => !e.net).cineHold), false);
    assert.notEqual(await page.evaluate(() => __mt.player.action && __mt.player.action.type), 'mh_grab');
    await page.evaluate(() => {
      __mt.reset();
      __mt.target(0, -5);
      JJMAHITO.start('mh_fire');
    });
    await tick(2);
    assert.equal(await page.evaluate(() => __mt.enemies.find((e) => !e.net).hp), 1000);
    await page.evaluate(() => {
      __mt.reset();
      JJMAHITO.reserves = ['human', 'flesh'];
      __mt.target(0, 8);
      __mt.keys.Digit2 = true;
      JJMAHITO.start('mh_fire');
    });
    await tick(2.5);
    assert.equal(await page.evaluate(() => __mt.enemies.find((e) => !e.net).hp), 980);
    assert.equal(await page.evaluate(() => JJMAHITO.reserves.length), 0);
    report.recovery =
      'Grab interruption releases victim; bullets reject rear targets; held Soul Fire consumes reserves for extra shots';
    await page.evaluate(() => {
      __mt.reset();
      JJMAHITO.active = true;
      JJMAHITO.remaining = 5.9;
    });
    assert.equal(await page.evaluate(() => JJMAHITO.awaken()), false);
    assert.equal(await page.evaluate(() => __mt.cds.mha1), 0);
    for (const key of ['mh_idle', 'mh_drill', 'mh_grab']) {
      await page.evaluate((key) => {
        __mt.reset();
        JJMAHITO.active = true;
        JJMAHITO.remaining = 60;
        const e = __mt.target(0, 4);
        e.iframes = 5;
        JJMAHITO.start(key);
      }, key);
      await tick(2.4);
      assert.equal(await page.evaluate(() => __mt.enemies.find((e) => !e.net).hp), 1000);
      assert.equal(await page.evaluate(() => __mt.enemies.find((e) => !e.net).cineHold), false);
      assert.equal(await page.evaluate(() => JJMAHITO.marks.size), 0);
    }
    await page.evaluate(() => {
      __mt.reset();
      const e = __mt.target();
      e.mhConsumed = true;
      e.dead = true;
    });
    await tick(0.025);
    await page.evaluate(() => {
      const e = __mt.enemies.find((e) => !e.net);
      e.respawn();
    });
    await tick(0.025);
    assert.equal(await page.evaluate(() => __mt.enemies.find((e) => !e.net).mhConsumed), false);
    await page.evaluate(() => {
      __mt.reset();
      window.__crate = __mt.addCrate(0, 9);
      JJMAHITO.cast(4);
    });
    await tick(1.2);
    assert.equal(await page.evaluate(() => __crate.visible), false);
    await tick(12);
    assert.equal(await page.evaluate(() => __crate.visible), true);
    await page.evaluate(() => {
      __mt.reset();
      JJMAHITO.active = true;
      JJMAHITO.remaining = 60;
      JJMAHITO.start('mh_domain');
    });
    await tick(2.5);
    await page.evaluate(() => __mt.player.pos.set(40, 0, 0));
    await tick(0.025);
    assert.ok(await page.evaluate(() => __mt.player.pos.distanceTo(JJMAHITO.domain.origin) <= 26.01));
    report.edgeCases =
      'Invincible targets cannot be marked or grabbed; Black Flash needs six awakening seconds; respawn clears soul execution; crates break and restore; domain contains its caster';
    const peer = await browser.newPage();
    peer.on('pageerror', (e) => errors.push(e.message));
    await peer.goto(base + '/__test');
    await peer.waitForFunction(() => !!window.__mt);
    await peer.evaluate(() => {
      __mt.reset();
      MPJJ.active = true;
      MPJJ.id = 'peer';
      MPJJ.relay = {
        connected: true,
        pub(m) {
          window.__packets.push(m);
        }
      };
      window.__packets = [];
      __mt.player.pos.set(0, 0, 6);
      __mt.player.iframes = 0;
    });
    await page.evaluate(() => {
      __mt.reset();
      window.__packets = [];
      MPJJ.active = true;
      MPJJ.id = 'caster';
      MPJJ.relay = {
        connected: true,
        pub(m) {
          window.__packets.push(m);
        }
      };
      MPJJ.receive({ t: 's', id: 'peer', n: 'PEER', c: 'yuji', x: 0, z: 6, h: 0, y: 314, hp: 100, mx: 100 });
      JJMAHITO.mode = 2;
      JJMAHITO.cast(3);
    });
    await tick(1);
    const packets = await page.evaluate(() => window.__packets);
    assert.equal(packets.filter((m) => m.t === 'cast' && m.k === 'mh_home').length, 1);
    assert.equal(
      packets.filter((m) => m.t === 'hit').reduce((s, m) => s + m.d, 0),
      18
    );
    await peer.evaluate((p) => p.forEach((m) => MPJJ.receive(m)), packets);
    assert.equal(await peer.evaluate(() => __mt.player.hp), 82);
    await peer.evaluate(() => {
      for (let i = 0; i < 100; i++) __mt.fxOnly(0.025);
    });
    assert.equal(await peer.evaluate(() => __mt.player.hp), 82, 'visual replay must not repeat damage');
    assert.equal(await peer.evaluate(() => MPJJ.fighters.caster.e.rig.mh.mode), 2);
    await page.evaluate(() => {
      __mt.player.action = null;
      __mt.player.react = null;
      JJMAHITO.active = true;
      JJMAHITO.remaining = 60;
      __mt.cds.mha2 = 0;
      window.__packets = [];
      JJMAHITO.start('mh_grab');
    });
    await tick(0.25);
    await peer.evaluate(
      (p) => p.forEach((m) => MPJJ.receive(m)),
      await page.evaluate(() => window.__packets)
    );
    assert.ok(await peer.evaluate(() => !!JJMAHITO.grabbed));
    for (let i = 0; i < 5; i++) await peer.keyboard.press('Space');
    await page.evaluate(
      (p) => p.forEach((m) => MPJJ.receive(m)),
      await peer.evaluate(() => window.__packets)
    );
    await tick(0.1);
    assert.equal(await page.evaluate(() => MPJJ.fighters.peer.e.cineHold), false);
    assert.equal(await peer.evaluate(() => JJMAHITO.grabbed), null);
    await tick(8);
    await page.evaluate(() => {
      JJMAHITO.cleanup();
      __mt.player.action = null;
      __mt.player.react = null;
      __mt.player.pos.set(0, 12, 0);
      const e = MPJJ.fighters.peer.e;
      e.dead = false;
      e.hp = 1;
      e.pos.set(0, 12, 4);
      e.iframes = 0;
      window.__packets = [];
      e.damage(10, new __mt.THREE.Vector3(0, -3, 0), { fin: true, finSkill: 'mh_air' });
    });
    const finPackets = await page.evaluate(() => window.__packets);
    assert.equal(finPackets.find((m) => m.t === 'fin').h, 12);
    await peer.evaluate((p) => {
      __mt.player.pos.set(0, 12, 4);
      __mt.player.hp = 1;
      __mt.player.iframes = 0;
      p.forEach((m) => MPJJ.receive(m));
    }, finPackets);
    assert.equal(await peer.evaluate(() => __mt.player.dead), false);
    await page.evaluate(() => (window.__packets = []));
    await tick(1.4);
    await page.clock.runFor(1500);
    await peer.evaluate(
      (p) => {
        p.forEach((m) => MPJJ.receive(m));
        __mt.tick(0.025);
      },
      await page.evaluate(() => window.__packets)
    );
    assert.equal(await peer.evaluate(() => __mt.player.dead), true);
    assert.ok(
      await peer.evaluate(() => !!__mt.player.__flatBody),
      'remote Aerial Stockpile must flatten its victim'
    );
    report.multiplayer =
      'One cast announcement, exact damage once, synchronized club model, five-jump grab escape, and elevated finisher with correct remote death effect';
    await peer.close();
    await page.evaluate(() => {
      MPJJ.active = false;
      __mt.reset();
      JJMAHITO.active = true;
      JJMAHITO.remaining = 60;
      __mt.target(5, 8);
      JJMAHITO.start('mh_spike');
    });
    await tick(1.2);
    await page.evaluate(() => {
      __mt.hide();
      __mt.draw([14, 12, 18], [0, 2.8, 8]);
    });
    await page.screenshot({ path: path.join(out, 'mahito-spike-wrath.png') });
    await page.evaluate(() => {
      __mt.reset();
      JJMAHITO.active = true;
      JJMAHITO.remaining = 60;
      JJMAHITO.start('mh_domain');
    });
    await tick(2.8);
    await page.evaluate(() => {
      __mt.hide();
      __mt.draw([0, 7, -19], [0, 8, 8]);
    });
    await page.screenshot({ path: path.join(out, 'mahito-domain.png') });
    for (const entry of ['/jujutsu-multiplayer.html', '/jujutsu-parts/index.local.html']) {
      const smoke = await browser.newPage();
      smoke.on('pageerror', (e) => errors.push(e.message));
      await smoke.goto(base + entry);
      await smoke.waitForFunction(() => !!window.MPJJ);
      await smoke.evaluate(() => __game.switchChar('mahito', true));
      await smoke.click('#menuFight');
      assert.equal(await smoke.evaluate(() => __game.player.rig.mh.mode), 0);
      await smoke.keyboard.press('KeyR');
      assert.equal(await smoke.evaluate(() => JJMAHITO.mode), 1);
      await smoke.close();
    }
    assert.deepEqual(errors, []);
    report.errors = errors;
    fs.writeFileSync(path.join(out, 'mahito-tests.json'), JSON.stringify(report, null, 2));
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
