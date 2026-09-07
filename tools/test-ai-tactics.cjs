'use strict';
const fs = require('fs'),
  path = require('path'),
  http = require('http'),
  assert = require('assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'),
  out = path.resolve(root, '../ai-test');
fs.mkdirSync(out, { recursive: true });
const core = fs
  .readFileSync(path.join(__dirname, 'test-core-combat.cjs'), 'utf8')
  .match(/const hook = `([\s\S]*?)`;/)[1];
const ai = fs
  .readFileSync(path.join(__dirname, 'test-ai-server.cjs'), 'utf8')
  .match(/core \+\s*`([\s\S]*?)`;/)[1];
const extra = `
window.__tactics={
 yaw(y){camYaw=y;},
 setup(n=3){__ai.start(n,721);__ai.isolate();player.pos.set(80,0,80);return JJAISERVER.bots;},
 world(parts,breakable=[]){JJMAP.load('jjs');const D=JJJJS.data;this.saved={parts:D.parts,visual:D.visual,decals:D.decals,guis:D.guis,breakable:D.breakable};
 const p=(x,y,z,sx,sy,sz)=>[x+D.origin[0],y+D.origin[1],z+D.origin[2],1,0,0,0,1,0,0,0,1,sx,sy,sz,.6,.62,.66,0,0,0,3,0];
 Object.assign(D,{parts:parts.map(a=>p(...a)),visual:null,decals:[],guis:[],breakable});JJJJS.build();
 // Mark the destructible fixture's render object the same way as imported
 // Studio attachments; collision still comes from the real oriented boxes.
 for(const id of breakable){const a=parts[id],mesh=new THREE.Mesh(new THREE.BoxGeometry(a[3],a[4],a[5]),new THREE.MeshStandardMaterial());mesh.position.set(a[0],a[1],a[2]);mesh.userData.jjsPart=id;JJJJS.root.add(mesh);}
 JJAISERVER.onMap();},
 restore(){JJDESTRUCT.clear();Object.assign(JJJJS.data,this.saved);JJJJS.build();JJMAP.load('plate');},
 step(e,t,n){for(let i=0;i<n;i++){JJAISERVER.time+=.02;JJAINAV.step(.02);e.update(.02);if(t){t.stunT=Math.max(0,t.stunT-.02);t.iframes=Math.max(0,t.iframes-.02);}for(let j=fx.length-1;j>=0;j--)if(!fx[j].update(.02))fx.splice(j,1);}},
};`;
let html = fs
  .readFileSync(path.join(root, 'jujutsu-multiplayer.html'), 'utf8')
  .replace('<head>', '<head><script>requestAnimationFrame=function(){return 0;};</script>');
const tail = html.lastIndexOf('</script>');
html = html.slice(0, tail) + core + ai + extra + html.slice(tail);
const server = http.createServer((q, r) => {
  r.setHeader('content-type', 'text/html;charset=utf-8');
  r.end(html);
});
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const report = {},
    errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (e) => {
      errors.push(e.message);
      console.error(e.message);
    });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => window.__tactics);
    await page.clock.install();
    async function test(name, fn, arg) {
      report[name] = await page.evaluate(fn, arg);
      console.log(name, JSON.stringify(report[name]));
      fs.writeFileSync(
        path.join(out, 'tactics-results.json'),
        JSON.stringify({ ...report, errors }, null, 2)
      );
      return report[name];
    }
    let r = await test('controls', () => {
      __fight.reset('todo'); JJTODO.charge=100;
      window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF',key:'f',bubbles:true}));
      const blocked=__fight.player.blocking, stayedNormal=!JJTODO.active;
      window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyF',key:'f',bubbles:true}));
      window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyG',key:'g',bubbles:true}));
      return {blocked,stayedNormal,awakened:JJTODO.active,type:__fight.player.action?.type};
    });
    assert.ok(r.blocked&&r.stayedNormal&&r.awakened);assert.equal(r.type,'td_awaken');
    r = await test('population', () => {
      __fight.reset();
      __fight.player.pos.set(300, 50, 300);
      JJAISERVER.start(100, { seed: 321, difficulty: 'mixed' });
      const bots = JJAISERVER.bots,
        first = bots.map((e) => e.pos.toArray()),
        levels = {};
      let far = 0;
      for (const [i, e] of bots.entries()) {
        levels[e.ai.level] = (levels[e.ai.level] || 0) + 1;
        const p = JJMAP.spawn(i);
        far = Math.max(far, e.pos.distanceTo(new __fight.THREE.Vector3(p.x, p.y, p.z)));
      }
      const names = new Set(bots.map((e) => e.ai.name)).size;
      __fight.player.pos.set(-500, 70, -500);
      bots[0].die();
      bots[0].respawn();
      const respawn = bots[0].pos.distanceTo(new __fight.THREE.Vector3(...first[0]));
      const times = [];
      for (let i = 0; i < 80; i++) {
        const t = performance.now();
        __fight.tick(1, 0.02, true);
        times.push(performance.now() - t);
      }
      times.sort((a, b) => a - b);
      return {
        count: bots.length,
        names,
        levels,
        spawnRadius: far,
        respawnOffset: respawn,
        active: bots.filter((e) => e.ai.target || e.dead).length,
        median: times[40],
        p95: times[76],
        finite: bots.every((e) => e.pos.toArray().every(Number.isFinite))
      };
    });
    assert.equal(r.count, 100);
    assert.equal(r.names, 100);
    assert.deepEqual(r.levels, { noob: 34, middle: 33, pro: 33 });
    assert.ok(r.spawnRadius <= 11 && r.respawnOffset <= 11);
    assert.ok(r.active >= 90 && r.finite);
    r = await test('evasive', () => {
      __tactics.setup(2);
      __fight.reset('gojo');
      const p = __fight.player,
        V = __fight.THREE.Vector3;
      JJFIGHT.actors.startFall(p, new V(0, 5, 10), { down: 1.35 });
      p.action.t = 0.2;
      const initial = p.pos.clone(),
        ok = JJFIGHT.evasive(p, new V(1, 0, 0));
      __fight.tick(20, 0.02);
      const moved = p.pos.distanceTo(initial),
        cd = p.evasiveCD;
      JJFIGHT.actors.startFall(p, new V(), { down: 1.35 });
      p.action.t = 0.2;
      const repeat = JJFIGHT.evasive(p, new V(1, 0, 0));
      __fight.tick(1260, 0.02);
      JJFIGHT.actors.startFall(p, new V(), { down: 1.35 });
      p.action.t = 0.2;
      const ready = JJFIGHT.canEvasive(p);
      p.cineHold = true;
      const held = JJFIGHT.evasive(p, new V());
      p.cineHold = false;
      p.dead = true;
      const dead = JJFIGHT.evasive(p, new V());
      p.dead = false;
      const e = JJAISERVER.bots[0];
      e.iframes = 0;
      e.evasiveCD = 0;
      e.hp = 100;
      JJFIGHT.actors.startFall(e, new V(0, 4, 2), { down: 1.35 });
      e.bcFall.t = 0.2;
      const bot = JJFIGHT.evasive(e, new V(-1, 0, 0));
      return { ok, moved, cd, repeat, ready, held, dead, bot, botCD: e.evasiveCD };
    });
    assert.ok(r.ok && r.bot && r.moved > 8);
    assert.ok(r.cd > 24 && r.botCD === 25);
    assert.ok(!r.repeat && r.ready && !r.held && !r.dead);
    r = await test('steering', () => {
      JJAISERVER.stop();
      const traces = [];
      for (const kind of ['front', 'side']) {
        __fight.reset('gojo');
        if (kind === 'side') __fight.keys.KeyD = true;
        __fight.doDash();
        __fight.tick(4, 0.02);
        const p = __fight.player,
          mid = p.pos.clone();
        __tactics.yaw(Math.PI / 2);
        __fight.tick(4, 0.02);
        const d = p.pos.clone().sub(mid);
        traces.push({ kind, d: d.toArray(), dir: p.action?.dir?.toArray() });
      }
      return traces;
    });
    assert.ok(Math.abs(r[0].d[0]) > 2 && Math.abs(r[0].d[2]) < 0.1);
    assert.ok(Math.abs(r[1].d[2]) > 2 && Math.abs(r[1].d[0]) < 0.1);
    r = await test('stunCombo', () => {
      __tactics.setup(2);
      __fight.reset('todo');
      const e = JJAISERVER.bots[0],
        p = __fight.player;
      e.hp = e.maxHp = 1000;
      e.ai.think = 1e6;
      __ai.place(e, 0, 0, 3.5);
      const stun = [];
      for (let n = 0; n < 3; n++) {
        __fight.punch();
        while (p.action?.type === 'bc_m1' && p.action.t < p.action.start + 0.005)
          __fight.tick(1, 0.01, true);
        stun.push(e.stunT);
        if (n < 2) while (p.action) __fight.tick(1, 0.01, true);
      }
      const counter = JJAICOMBAT.m1(e, p);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1', bubbles: true }));
      const skill = p.action?.type;
      __fight.tick(45, 0.01, true);
      return { stun, counter, skill, hp: p.hp, enemyAction: e.action?.type };
    });
    assert.ok(r.stun.every((n) => n > 0.45));
    assert.equal(r.counter, false);
    assert.equal(r.skill, 'b1');
    assert.equal(r.hp, 100);
    r = await test('retaliationAndTeams', () => {
      const [a, b, t] = __tactics.setup(3),
        V = __fight.THREE.Vector3;
      __ai.place(a, 0, 0, 0);
      __ai.place(b, 5, 0, 0);
      __ai.place(t, 0, 0, 8);
      for (const e of [a, b]) {
        JJAIBEHAVIOR.init(e, 'pro');
        e.ai.profile = { ...e.ai.profile, team: 1 };
        e.ai.revenge = JJAISERVER.actorId(t);
        e.ai.revengeUntil = 100;
        e.ai.target = t;
      }
      JJAIBEHAVIOR.plan(a, t, true, 8);
      const teamed = JJAISERVER.friendly(a, b) && JJAISERVER.friendly(b, a);
      JJAIBEHAVIOR.killed(t, a);
      const both = a.ai.taunt && b.ai.taunt;
      a.ai.walkAwayUntil = 999;
      a.ai.socialAction = {};
      a.ai.think = 999;
      a.ai.profile = { ...a.ai.profile, redirect: 1 };
      a.ai.revenge = JJAISERVER.actorId(t);
      __fight.player.pos.set(0, 0, 3);
      a.damage(3, new V(), { stun: 0.5 });
      const retaliate =
        a.ai.target === __fight.player && !a.ai.taunt && !a.ai.socialAction && a.ai.walkAwayUntil === 0;
      const redirected = a.ai.revenge === JJAISERVER.actorId(__fight.player);
      __fight.player.pos.set(230, 9, 0);
      a.ai.target = __fight.player;
      a.ai.pursuitUntil = 100;
      const chase = JJAIBEHAVIOR.choose(a) === __fight.player;
      return { teamed, both: !!both, retaliate, redirected, chase };
    });
    assert.ok(Object.values(r).every(Boolean));
    r = await test('retreatAndDetection', () => {
      const [e, t] = __tactics.setup(2);
      JJAIBEHAVIOR.init(e, 'pro');
      e.ai.profile = { ...e.ai.profile, retreat: 1, dodge: 1 };
      __ai.place(e, 0, 0, 0);
      __ai.place(t, 0, 0, 10);
      e.hp = 15;
      e.ai.target = t;
      JJAISERVER.time = 0.1;
      JJAIBEHAVIOR.plan(e, t, true, 10);
      const retreat = e.ai.state,
        front = e.action?.kind;
      e.action = null;
      e.ai.retreatUntil = 0;
      e.hp = 100;
      e.ai.frontCD = e.ai.evadeCD = 0;
      e.ai.retreatCheck = 999;
      t.facing = Math.PI;
      t.action = { type: 'red', t: 0, dur: 1, id: 93, dir: new __fight.THREE.Vector3(0, 0, -1) };
      JJAIBEHAVIOR.defense(e);
      JJAISERVER.time += 0.3;
      t.action.t = 0.3;
      const dodge = JJAIBEHAVIOR.defense(e);
      return { retreat, front, dodge, kind: e.action?.kind, history: e.ai.history };
    });
    assert.equal(r.retreat, 'retreating');
    assert.equal(r.front, 'front');
    assert.ok(r.dodge && r.kind === 'side');
    r = await test('stairs', () => {
      const [e, t] = __tactics.setup(2);
      const parts = [
        [0, -0.5, 0, 120, 1, 120],
        [0, 7, -8, 25, 14, 1]
      ];
      // Twelve ordinary half-unit stair risers; upper landing is six units up.
      for (let i = 0; i < 12; i++) {
        parts.push([12, 0.25 + i * 0.25, -5 + i * 0.8, 5, 0.5 + i * 0.5, 0.8]);
        parts.push([12, 7 + i * 0.5, -5 + i * 0.8, 5, 1, 0.8]);
      }
      parts.push([12, 5.5, 10, 10, 1, 10]);
      parts.push([8.5, 7, 0, 1, 14, 18], [15.5, 7, 0, 1, 14, 18]);
      __tactics.world(parts);
      __ai.isolate();
      __ai.place(e, 12, 0, -7);
      __ai.place(t, 12, 6, 9);
      e.ai.target = t;
      e.ai.pursuitUntil = 100;
      e.ai.pickAt = 100;
      e.ai.think = 0;
      t.hp = t.maxHp = 10000;
      for (const k in e.ai.kit?.cd || {}) e.ai.kit.cd[k] = 999;
      let maxY = 0;
      for (let i = 0; i < 700; i++) {
        __tactics.step(e, t, 1);
        maxY = Math.max(maxY, e.pos.y);
      }
      const result = {
        maxY,
        pos: e.pos.toArray(),
        distance: e.pos.distanceTo(t.pos),
        target: e.ai.target === t,
        history: e.ai.history.slice(-12)
      };
      __tactics.restore();
      return result;
    });
    assert.ok(r.maxY >= 5.8 && r.distance < 9 && r.target);
    r = await test('crater', () => {
      const [e, t] = __tactics.setup(2);
      __tactics.world([
        [0, -3.5, 0, 80, 1, 80],
        [-23, -1.5, 0, 34, 3, 80],
        [23, -1.5, 0, 34, 3, 80],
        [0, -1.5, -23, 12, 3, 34],
        [0, -1.5, 23, 12, 3, 34]
      ]);
      __ai.isolate();
      __ai.place(e, 0, -3, 0);
      __ai.place(t, 15, 0, 0);
      t.hp = t.maxHp = 10000;
      e.ai.target = t;
      e.ai.pursuitUntil = e.ai.pickAt = 100;
      e.ai.think = 0;
      for (let i = 0; i < 650; i++) __tactics.step(e, t, 1);
      const result = {
        pos: e.pos.toArray(),
        distance: e.pos.distanceTo(t.pos),
        target: e.ai.target === t,
        history: e.ai.history.slice(-15)
      };
      __tactics.restore();
      return result;
    });
    assert.ok(r.pos[1] > -1 && r.distance < 10 && r.target);
    r = await test('breach', () => {
      const [e, t] = __tactics.setup(2);
      __tactics.world(
        [
          [0, -0.5, 0, 80, 1, 80],
          [0, 5, 3, 24, 10, 1]
        ],
        [1]
      );
      __ai.isolate();
      __ai.place(e, 0, 0, 0);
      __ai.place(t, 0, 0, 10);
      e.ai.goal = t.pos.clone();
      e.ai.target = t;
      JJAISERVER.time = 0.1;
      const can = JJDESTRUCT.canBreak(1),
        before = JJDESTRUCT.audit().revision,
        started = JJAIBEHAVIOR.escape(e);
      for (let i = 0; i < 4; i++) {
        __tactics.step(e, t, 24);
        __ai.place(e, 0, 0, 0);
        e.ai.goal = t.pos.clone();
        JJAIBEHAVIOR.escape(e);
      }
      const result = {
        can,
        started,
        before,
        after: JJDESTRUCT.audit().revision,
        history: e.ai.history.slice(-10)
      };
      __tactics.restore();
      return result;
    });
    assert.ok(r.can && r.started && r.after > r.before);
    assert.deepEqual(errors, []);
    console.log('TACTICS PASSED');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
