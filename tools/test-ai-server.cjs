'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http'),
  assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'),
  out = path.resolve(root, '../ai-test');
fs.mkdirSync(out, { recursive: true });
const core = fs
  .readFileSync(path.join(__dirname, 'test-core-combat.cjs'), 'utf8')
  .match(/const hook = `([\s\S]*?)`;/)[1];
const hooks =
  core +
  `
window.__ai={
 spin(){camYaw+=.14;keys.KeyW=true;__fight.tick(1,.02,true);},
 start(n=12,seed=812){JJAISERVER.stop(false);__fight.reset();JJMAP.load('plate');JJAISERVER.start(n,{seed});},
 isolate(){for(const [i,e]of JJAISERVER.bots.entries()){JJRAG.stop(e);JJGORE.clear(e);e.bcFall=null;e.dead=false;e.hp=e.maxHp=100;e.iframes=e.stunT=e.frameT=e.anchorT=e.lockT=0;e.action=e.react=null;e.blocking=false;e.pos.set(50+i*4,0,50);e.vel.set(0,0,0);Object.assign(e.ai,{goal:null,path:[],pathT:0,pathPending:0,target:null,think:1e6,m1CD:0,frontCD:0,evadeCD:0,combo:0,comboReset:0,techCD:[0,0],peace:0,confirm:false,socialAction:null,taunt:null,history:[]});}__fight.player.iframes=0;},
 fixture(){JJMAP.load('jjs');const D=JJJJS.data;this.original={parts:D.parts,visual:D.visual,decals:D.decals,guis:D.guis,breakable:D.breakable};
 const p=(x,y,z,sx,sy,sz)=>[x+D.origin[0],y+D.origin[1],z+D.origin[2],1,0,0,0,1,0,0,0,1,sx,sy,sz,.57,.62,.66,0,0,0,3,0];Object.assign(D,{visual:null,decals:[],guis:[],breakable:[],parts:[p(0,-.5,0,400,1,400),p(0,6,-25,1,12,20),p(0,3,12,14,6,10),p(-25,1.6,5,12,3.2,1.5)]});JJJJS.build();JJAISERVER.onMap();},
 restore(){Object.assign(JJJJS.data,this.original);JJJJS.build();JJMAP.load('plate');JJAISERVER.onMap();},
 place(e,x,y,z){e.pos.set(x,y,z);e.spawn.copy(e.pos);e.vel.set(0,0,0);e.onGround=true;e.__jjsLast=null;e.rig.root.position.copy(e.pos);},
 draw(at=[22,16,25],look=[0,3,0]){__fight.camera.position.set(...at);__fight.camera.lookAt(...look);__fight.scene.updateMatrixWorld(true);__fight.renderer.render(__fight.scene,__fight.camera);}
};`;
let html = fs
  .readFileSync(path.join(root, 'jujutsu-multiplayer.html'), 'utf8')
  .replace('<head>', '<head><script>requestAnimationFrame=function(){return 0;};</script>');
const end = html.lastIndexOf('</script>');
html = html.slice(0, end) + hooks + html.slice(end);
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html;charset=utf-8');
  res.end(html);
});
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
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
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => window.__ai);
    await page.clock.install();
    await page.locator('#jjAIQuick').click();
    await page.screenshot({ path: path.join(out, 'ai-server-menu.png') });
    await page.locator('#jjAIJoin').click();
    report.entry = await page
      .evaluate(() => ({
        count: JJAISERVER.bots.length,
        chars: new Set(JJAISERVER.bots.map((e) => e.char)).size,
        active: JJAISERVER.active,
        inputs: gameInputActive?.()
      }))
      .catch(async () =>
        page.evaluate(() => ({
          count: JJAISERVER.bots.length,
          chars: new Set(JJAISERVER.bots.map((e) => e.char)).size,
          active: JJAISERVER.active
        }))
      );
    assert.equal(report.entry.count, 12);
    assert.equal(report.entry.chars, 12);
    assert.ok(report.entry.active);
    report.brawl = await page.evaluate(() => {
      __ai.start(12, 812);
      __fight.player.iframes = 99;
      const initial = JJAISERVER.bots.map((e) => e.pos.clone());
      for (let i = 0; i < 2400; i++) __fight.tick(1, 0.025, true);
      return {
        moved: JJAISERVER.bots.filter((e, i) => e.pos.distanceTo(initial[i]) > 5).length,
        injured: JJAISERVER.bots.filter((e) => e.hp < 98).length,
        kills: JJAISERVER.bots.reduce((s, e) => s + e.ai.kills, 0),
        histories: JJAISERVER.bots.flatMap((e) => e.ai.history),
        states: JJAISERVER.audit()
      };
    });
    console.log(
      'BRAWL',
      JSON.stringify({ moved: report.brawl.moved, injured: report.brawl.injured, kills: report.brawl.kills })
    );
    assert.ok(report.brawl.moved >= 8);
    assert.ok(report.brawl.injured > 0 || report.brawl.kills > 0, 'Bots must actually fight each other');
    assert.ok(report.brawl.kills > 0);
    assert.ok(report.brawl.histories.includes('side dash + rotation + M1'));
    assert.ok(report.brawl.histories.includes('hit-confirm technique'));
    await page.evaluate(() => __ai.draw());
    await page.screenshot({ path: path.join(out, 'ai-brawl.png') });
    report.flank = await page.evaluate(() => {
      __ai.start(2);
      __ai.isolate();
      const [e, t] = JJAISERVER.bots;
      __ai.place(e, 0, 0, 3.8);
      __ai.place(t, 0, 0, 0);
      e.ai.target = t;
      e.facing = Math.PI;
      t.facing = 0;
      JJAICOMBAT.guard(t, 10);
      const initial = e.pos.clone();
      const began = JJAICOMBAT.dash(e, t, 'side', 1);
      __fight.tick(22, 0.02, true);
      const end = e.pos.toArray(),
        facing = e.facing;
      JJAICOMBAT.m1(e, t);
      __fight.tick(16, 0.02, true);
      return {
        began,
        distance: e.pos.distanceTo(initial),
        end,
        facing,
        damage: 100 - t.hp,
        cd: e.ai.evadeCD
      };
    });
    console.log('FLANK', report.flank);
    assert.ok(report.flank.began && report.flank.distance > 4);
    assert.ok(report.flank.end[2] < 0, 'Side dash turns around the opponent');
    assert.ok(report.flank.damage > 0, 'Rotated M1 bypasses rear guard');
    report.combo = await page.evaluate(() => {
      __ai.start(2);
      __ai.isolate();
      const [e, t] = JJAISERVER.bots;
      __ai.place(e, 0, 0, 0);
      __ai.place(t, 0, 0, 3.5);
      e.ai.target = t;
      const hits = [];
      for (let n = 0; n < 4; n++) {
        JJAICOMBAT.m1(e, t, n === 3 ? 'up' : 'normal');
        __fight.tick(23, 0.02, true);
        hits.push(t.hp);
        if (n < 3) {
          __ai.place(t, 0, 0, 3.5);
          t.stunT = 0;
          t.iframes = 0;
        }
      }
      return { hits, down: !!t.bcFall, vy: t.vel.y, history: e.ai.history };
    });
    assert.ok(report.combo.hits[3] < report.combo.hits[0]);
    assert.ok(report.combo.down);
    report.playerHit = await page.evaluate(() => {
      __ai.start(1);
      __ai.isolate();
      const e = JJAISERVER.bots[0];
      __ai.place(e, 0, 0, 3.5);
      e.facing = Math.PI;
      e.ai.target = __fight.player;
      JJFIGHT.guard(true);
      JJAICOMBAT.m1(e, __fight.player);
      __fight.tick(16, 0.02, true);
      const front = __fight.player.hp;
      e.action = null;
      e.ai.m1CD = 0;
      JJFIGHT.guard(false);
      __fight.player.facing = Math.PI;
      JJAICOMBAT.m1(e, __fight.player);
      __fight.tick(16, 0.02, true);
      return { front, hit: __fight.player.hp };
    });
    assert.equal(report.playerHit.front, 100);
    assert.ok(report.playerHit.hit < 99);
    await page.evaluate(() => {
      __ai.start(8, 551);
      __ai.isolate();
      __fight.player.pos.set(0, 0, 0);
      JJAISERVER.bots.forEach((e, i) => {
        __ai.place(e, (i - 3.5) * 2, 0, 8);
        e.ai.social = i < 4 ? 1 : 0;
        e.ai.lastHurt = -20;
      });
    });
    await page.keyboard.down('KeyB');
    await page.evaluate(() => __fight.tick(4, 0.02, true));
    await page.keyboard.up('KeyB');
    await page.evaluate(() => __fight.tick(5, 0.02, true));
    await page.keyboard.down('KeyB');
    await page.evaluate(() => __fight.tick(4, 0.02, true));
    await page.keyboard.up('KeyB');
    report.signals = await page.evaluate(() => {
      const response = JJAISERVER.bots.filter((e) => e.ai.socialAction).length,
        ignored = JJAISERVER.bots.filter((e) => e.ai.history.some((x) => x.includes('ignored'))).length;
      const actions = JJAISERVER.bots.filter((e) => e.ai.socialAction).map((e) => e.ai.socialAction.kind);
      __fight.tick(100, 0.02, true);
      return { response, ignored, actions, finished: JJAISERVER.bots.every((e) => !e.ai.socialAction) };
    });
    console.log('SIGNALS', report.signals);
    assert.ok(report.signals.response > 0 && report.signals.ignored > 0 && report.signals.finished);
    report.revenge = await page.evaluate(() => {
      __ai.start(1);
      __ai.isolate();
      const e = JJAISERVER.bots[0];
      __ai.place(e, 0, 0, 3.5);
      e.ai.grudge = 1;
      e.damage(150, new __fight.THREE.Vector3(0, 1, 2), { stun: 0.3 });
      const remembered = e.ai.revenge;
      e.respawn();
      e.iframes = 0;
      e.ai.think = 1e6;
      __ai.place(e, 0, 0, 2);
      e.ai.target = __fight.player;
      __fight.player.hp = 1;
      __fight.player.iframes = 0;
      JJAISERVER.hit(e, __fight.player, 3, new __fight.THREE.Vector3(0, 0.3, -2), {
        guardable: true,
        source: e.pos.clone(),
        stun: 0.6,
        id: 999,
        kind: 'm1'
      });
      const taunt = !!e.ai.taunt;
      let blocks = 0,
        prior = false,
        signs = [];
      for (let i = 0; i < 200; i++) {
        __fight.tick(1, 0.02, true);
        if (e.blocking && !prior) blocks++;
        prior = e.blocking;
        if (e.ai.taunt) signs.push(e.pos.z);
      }
      return {
        remembered,
        taunt,
        blocks,
        motion: Math.max(...signs) - Math.min(...signs),
        walkAway: e.ai.state === 'walking away',
        awayDistance: e.pos.distanceTo(new __fight.THREE.Vector3(0, 0, 0)),
        history: e.ai.history
      };
    });
    console.log('REVENGE', report.revenge);
    assert.ok(report.revenge.remembered?.startsWith('human:'));
    assert.ok(report.revenge.taunt && report.revenge.blocks >= 3 && report.revenge.motion > 0.1);
    assert.ok(report.revenge.walkAway && report.revenge.awayDistance > 7);
    report.navigation = await page.evaluate(() => {
      __ai.start(1);
      __ai.fixture();
      __ai.isolate();
      const e = JJAISERVER.bots[0];
      __ai.place(e, -12, 0, -25);
      e.ai.goal = new __fight.THREE.Vector3(12, 0, -25);
      let maxZ = 0;
      for (let i = 0; i < 650; i++) {
        __fight.tick(1, 0.02, true);
        maxZ = Math.max(maxZ, Math.abs(e.pos.z + 25));
      }
      const around = { x: e.pos.x, detour: maxZ, finite: e.pos.toArray().every(Number.isFinite) };
      __ai.isolate();
      __ai.place(e, 0, 0, 3.8);
      e.ai.goal = new __fight.THREE.Vector3(0, 6, 12);
      __fight.tick(200, 0.02, true);
      const climb = { pos: e.pos.toArray(), grounded: e.onGround, history: e.ai.history.slice() };
      __ai.isolate();
      __ai.place(e, -25, 0, 1.9);
      e.ai.goal = new __fight.THREE.Vector3(-25, 0, 9);
      __fight.tick(180, 0.02, true);
      const vault = { pos: e.pos.toArray(), grounded: e.onGround, history: e.ai.history.slice() };
      __ai.restore();
      return { around, climb, vault };
    });
    console.log('NAVIGATION', report.navigation);
    assert.ok(report.navigation.around.x > 9 && report.navigation.around.detour > 9);
    assert.ok(report.navigation.climb.pos[1] > 5.9 && report.navigation.climb.history.includes('pk_climb'));
    assert.ok(report.navigation.vault.pos[2] > 7 && report.navigation.vault.history.includes('pk_vault'));
    assert.ok(report.navigation.climb.grounded && Math.abs(report.navigation.climb.pos[1] - 6) < 0.1);
    assert.ok(report.navigation.vault.grounded && Math.abs(report.navigation.vault.pos[1]) < 0.1);
    report.lifecycle = await page.evaluate(() => {
      const before = __fight.enemies.filter((e) => !e.ai).length;
      JJAISERVER.stop();
      const restored = __fight.enemies.length;
      for (let i = 0; i < 3; i++) {
        JJAISERVER.start(4);
        JJAISERVER.stop();
      }
      return {
        restored,
        after: __fight.enemies.length,
        bots: JJAISERVER.bots.length,
        active: JJAISERVER.active,
        nav: JJAINAV.audit()
      };
    });
    assert.equal(report.lifecycle.after, report.lifecycle.restored);
    assert.equal(report.lifecycle.bots, 0);
    assert.equal(report.lifecycle.nav.jobs, 0);
    report.spin = await page.evaluate(() => {
      __ai.start(4, 551);
      __ai.isolate();
      const p = __fight.player;
      JJAISERVER.bots.forEach((e, i) => {
        __ai.place(e, (i - 1.5) * 3, 0, 8);
        e.ai.social = i < 2 ? 1 : 0;
        e.ai.lastHurt = -20;
      });
      for (let i = 0; i < 80; i++) {
        __ai.spin();
      }
      __fight.keys.KeyW = false;
      return {
        responses: JJAISERVER.audit().events.filter((x) => x.message.includes('walking spin')).length,
        ignored: JJAISERVER.bots.filter((e) => e.ai.history.includes('ignored walking spin')).length
      };
    });
    assert.ok(report.spin.responses > 0 && report.spin.ignored > 0);
    report.techniques = await page.evaluate(() => {
      __ai.start(14, 831);
      __ai.isolate();
      const all = [];
      for (const e of JJAISERVER.bots) {
        __ai.place(e, 0, 0, 0);
        const t = JJAISERVER.bots.find((o) => o !== e);
        __ai.place(t, 0, 0, 3.5);
        e.ai.target = t;
        for (let slot = 0; slot < 2; slot++) {
          e.action = null;
          e.blocking = false;
          e.stunT = 0;
          e.ai.techCD = [0, 0];
          e.ai.target = t;
          t.hp = 100;
          t.dead = false;
          t.stunT = 0;
          t.bcFall = null;
          const used = JJAICOMBAT.skill(e, t, slot);
          let finite = true;
          for (let i = 0; i < 44; i++) {
            JJAICOMBAT.tick(e, 0.02);
            JJAICOMBAT.pose(e);
            e.rig.root.traverse((o) => {
              if (
                ![...o.position.toArray(), ...o.rotation.toArray().slice(0, 3), ...o.scale.toArray()].every(
                  Number.isFinite
                )
              )
                finite = false;
            });
          }
          all.push({ char: e.char, slot, used, finite });
        }
        __ai.place(e, 90, 0, 90);
        __ai.place(t, 85, 0, 85);
      }
      return all;
    });
    assert.equal(new Set(report.techniques.map((x) => x.char)).size, 14);
    assert.ok(report.techniques.every((x) => x.used && x.finite));
    // Use the real selector and imported city, not just synthetic obstacles.
    await page.evaluate(() => {
      JJAISERVER.stop();
      document.getElementById('jjOnline').click();
    });
    await page.locator('#jjMaps button[data-map="jjs"]').click();
    await page.locator('#jjAICount').selectOption('16');
    await page.locator('#jjAIJoin').click();
    report.city = await page.evaluate(() => {
      const initial = JJAISERVER.bots.map((e) => e.pos.clone()),
        costs = [];
      __fight.player.iframes = 99;
      for (let i = 0; i < 650; i++) {
        const a = performance.now();
        __fight.tick(1, 0.02, true);
        costs.push(performance.now() - a);
      }
      costs.sort((a, b) => a - b);
      return {
        map: JJMAP.id,
        count: JJAISERVER.bots.length,
        moved: JJAISERVER.bots.filter((e, i) => e.pos.distanceTo(initial[i]) > 5).length,
        finite: JJAISERVER.bots.every((e) => e.pos.toArray().every(Number.isFinite)),
        medianUpdateMs: costs[325],
        p95UpdateMs: costs[617],
        navigation: JJAINAV.audit()
      };
    });
    console.log('JJS CITY', report.city);
    assert.equal(report.city.map, 'jjs');
    assert.equal(report.city.count, 16);
    assert.ok(report.city.moved >= 10 && report.city.finite);
    // The local menu pauses combat and its social clocks.
    report.pause = await page.evaluate(() => {
      document.getElementById('menu').style.display = 'flex';
      const time = JJAISERVER.time,
        positions = JJAISERVER.bots.map((e) => e.pos.clone());
      __fight.tick(60, 0.02, true);
      return {
        time: time === JJAISERVER.time,
        positions: JJAISERVER.bots.every((e, i) => e.pos.distanceTo(positions[i]) === 0)
      };
    });
    assert.ok(report.pause.time && report.pause.positions);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.getElementById('jjOnline').click());
    await page.locator('#jjAIJoin').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, 'ai-server-mobile.png') });
    report.mobile = await page.locator('#jjAIJoin').evaluate((e) => {
      const r = e.getBoundingClientRect();
      return {
        width: innerWidth,
        inside: r.left >= 0 && r.right <= innerWidth,
        visible: r.top >= 0 && r.bottom <= innerHeight
      };
    });
    assert.ok(report.mobile.inside && report.mobile.visible);
    report.errors = errors;
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'ai-tests.json'), JSON.stringify(report, null, 2));
    console.log('AI Server integration passed');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
