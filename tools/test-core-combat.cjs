'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http'),
  assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'),
  out = path.resolve(root, '../combat-test');
fs.mkdirSync(out, { recursive: true });
const hook = `
window.__fight={THREE,player,enemies,keys,cds,scene,camera,renderer,CHARS,poseAction,punch,doDash,hurtPlayer,
 reset(id='gojo',x=0,y=0,z=0){window.JJFIGHT?.reset();JJMOVE.cancel('test');JJTODO.cleanup();JJMAHITO.cleanup();JJRAG.stop(player);JJGORE.clear(player);JJAW.cine=JJAW.active=false;MPJJ.cs.active=false;
 started=false;switchChar(id,true);started=true;menu.style.display='none';player.dead=false;player.hp=player.maxHp=100;player.iframes=0;player.action=player.react=null;player.stunT=player.frameT=player.attackT=player.dashT=0;player.comboN=0;player.comboReset=0;player.blocking=false;player.dashCh=id==='naoya'?2:1;player.facing=0;player.visYaw=0;player.pos.set(x,y,z);player.vel.set(0,0,0);player.onGround=y===0;player.__jjsLast=null;camYaw=Math.PI;camPitch=.22;clearMovement();for(const k in cds)cds[k]=0;JJDASH.line=JJDASH.side=0;
 for(const e of enemies){JJRAG.stop(e);JJGORE.clear(e);e.bcFall=null;e.dead=false;e.hp=e.maxHp=1000;e.stunT=e.iframes=e.frameT=e.anchorT=e.lockT=0;e.react=null;e.flung=false;e.cineHold=false;e.mhConsumed=false;e.tdHold=null;e.vel.set(0,0,0);e.pos.set(80,0,80);e.onGround=true;e.blocking=false;e.rig.root.visible=true;e.rig.body.rotation.set(0,0,0);e.rig.root.rotation.set(0,0,0);}player.rig.root.position.copy(player.pos);},
 target(x=0,y=0,z=3.5,block=false){const e=enemies.find(e=>!e.net);e.pos.set(x,y,z);e.spawn.copy(e.pos);e.facing=Math.PI;e.blocking=block;e.rig.root.position.copy(e.pos);e.rig.root.rotation.y=e.facing;return e;},
 tick(n=1,dt=.02,foes=false){for(let i=0;i<n;i++){updatePlayer(dt);if(foes)for(const e of enemies)e.update(dt);updateHUD(dt);for(let j=fx.length-1;j>=0;j--)if(!fx[j].update(dt))fx.splice(j,1);}},
 draw(){player.rig.root.position.copy(player.pos);player.rig.root.rotation.y=player.facing;for(const e of enemies){e.rig.root.position.copy(e.pos);e.rig.root.rotation.y=e.facing;}camera.position.copy(player.pos).add(new THREE.Vector3(10,8,9));camera.lookAt(player.pos.clone().add(new THREE.Vector3(0,3,2)));scene.updateMatrixWorld(true);renderer.render(scene,camera);},
 state(){return {char:player.char,action:player.action?.type,combo:player.comboN,cd:cds.m1,stun:player.stunT,block:player.blocking,pos:player.pos.toArray(),vel:player.vel.toArray(),charge:player.dashCh,dashT:player.dashT,iframes:player.iframes,dir:player.dashDir?.toArray(),hp:player.hp};},
 online(){MPJJ.active=MPJJ.joined=true;MPJJ.cs.active=false;window.__packets=[];MPJJ.relay={connected:true,pub(m){__packets.push(m);}};},
 offline(){MPJJ.active=MPJJ.joined=false;MPJJ.relay=null;}
};
__fight.fixture=function(){JJMAP.load('jjs');const D=JJJJS.data;this.original={parts:D.parts,visual:D.visual,decals:D.decals,guis:D.guis,breakable:D.breakable};
 const part=(x,y,z,sx,sy,sz)=>[x+D.origin[0],y+D.origin[1],z+D.origin[2],1,0,0,0,1,0,0,0,1,sx,sy,sz,.57,.62,.66,0,0,0,3,0];
 Object.assign(D,{visual:null,decals:[],guis:[],breakable:[],parts:[part(0,-.5,0,100,1,100),part(0,5,2.5,18,10,.25),part(24,3.5,0,16,1,16),part(-24,7.25,0,16,.5,16)]});JJJJS.build();};
__fight.restore=function(){Object.assign(JJJJS.data,this.original);JJJJS.build();JJMAP.load('plate');};
`;
const baseline = process.argv.includes('--baseline');
const file = process.env.COMBAT_GAME_FILE || path.join(root, 'jujutsu-multiplayer.html');
let html = fs
  .readFileSync(file, 'utf8')
  .replace('<head>', '<head><script>requestAnimationFrame=function(){return 0;};</script>');
const tail = html.lastIndexOf('</script>');
html = html.slice(0, tail) + hook + html.slice(tail);
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html;charset=utf-8');
  res.end(html);
});
async function naoya(page) {
  return page.evaluate(() => {
    const traces = [];
    for (const direction of [[], ['KeyW'], ['KeyS'], ['KeyA'], ['KeyD'], ['KeyW', 'KeyA']]) {
      __fight.reset('naoya');
      for (const k of direction) __fight.keys[k] = true;
      __fight.doDash();
      const samples = [__fight.state()];
      for (let i = 0; i < 120; i++) {
        __fight.tick();
        if ([0, 7, 14, 49, 99, 119].includes(i)) samples.push(__fight.state());
      }
      traces.push({ direction, samples });
    }
    __fight.reset('naoya');
    __fight.doDash();
    __fight.doDash();
    traces.push({ double: __fight.state() });
    return traces;
  });
}
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => window.__fight);
    await page.clock.install();
    await page.evaluate(() => JJMAP.load('plate'));
    const traces = await naoya(page);
    if (baseline) {
      fs.writeFileSync(path.join(out, 'naoya-before.json'), JSON.stringify(traces, null, 2));
      console.log('Captured Naoya dash baseline');
      return;
    }
    const before = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/naoya-dash.json')));
    assert.deepEqual(
      JSON.parse(JSON.stringify(traces)),
      before,
      'Naoya dash must match the original trajectory, charges, cooldown and invincibility'
    );
    const report = { naoya: 'Exact match: six directions and double dash' };
    report.roster = await page.evaluate(() =>
      Object.keys(__fight.CHARS).map((id) => {
        __fight.reset(id);
        const e = __fight.target();
        const hp = e.hp;
        const started = __fight.punch();
        const immediate = e.hp;
        __fight.tick(4);
        const windup = e.hp;
        __fight.tick(12);
        const hit = e.hp;
        __fight.tick(30);
        const once = e.hp;
        return {
          id,
          started,
          immediate: hp - immediate,
          windup: hp - windup,
          damage: hp - hit,
          once: hp - once,
          action: __fight.player.action?.type
        };
      })
    );
    assert.ok(
      report.roster.every(
        (x) => x.started && x.immediate === 0 && x.windup === 0 && x.damage > 0 && x.once === x.damage
      ),
      'All 14 characters have timed, single-hit M1 windows'
    );
    report.characterTraits = await page.evaluate(() => {
      const modes = [];
      for (const mode of [0, 1, 2]) {
        __fight.reset('mahito');
        JJMAHITO.mode = mode;
        const e = __fight.target(0, 0, 3.5, mode === 2);
        __fight.player.comboN = 2;
        __fight.player.comboReset = 1;
        __fight.punch();
        __fight.tick(20);
        modes.push({ mode, damage: 1000 - e.hp, charge: JJMAHITO.charge });
      }
      __fight.reset('todo');
      __fight.target();
      __fight.punch();
      __fight.tick(20);
      return { modes, todoCharge: JJTODO.charge };
    });
    assert.deepEqual(
      report.characterTraits.modes.map((m) => m.damage),
      [3, 2, 4]
    );
    assert.ok(
      report.characterTraits.modes.every((m) => m.charge > 0) && report.characterTraits.todoCharge > 0
    );
    await page.evaluate(() => {
      __fight.reset('mahito');
      JJMAHITO.reserves = ['human', 'flesh'];
    });
    await page.keyboard.down('KeyB');
    await page.mouse.move(635, 400);
    await page.mouse.down();
    await page.evaluate(() => __fight.tick(30));
    await page.mouse.up();
    await page.keyboard.up('KeyB');
    assert.equal(
      await page.evaluate(() => JJMAHITO.reserves.length),
      1,
      'B + one held click withdraws exactly one reserve'
    );
    report.combo = await page.evaluate(() => {
      __fight.reset();
      const e = __fight.target();
      const types = [];
      for (let i = 0; i < 4; i++) {
        __fight.punch();
        types.push(__fight.player.action.n);
        __fight.tick(24);
      }
      return { types, damage: 1000 - e.hp, down: !!e.bcFall, cool: __fight.cds.m1 };
    });
    assert.deepEqual(report.combo.types, [0, 1, 2, 3]);
    assert.equal(report.combo.damage, 12);
    assert.ok(report.combo.down && report.combo.cool > 1);
    report.guard = await page.evaluate(() => {
      __fight.reset();
      let e = __fight.target(0, 0, 3.5, true);
      __fight.punch();
      __fight.tick(23);
      const front = 1000 - e.hp;
      __fight.reset();
      e = __fight.target(0, 0, 3.5, true);
      e.facing = 0;
      __fight.punch();
      __fight.tick(23);
      const rear = 1000 - e.hp;
      __fight.reset();
      e = __fight.target(0, 0, -3);
      __fight.punch();
      __fight.tick(23);
      const behindAttacker = 1000 - e.hp;
      return { front, rear, behindAttacker };
    });
    assert.equal(report.guard.front, 0);
    assert.equal(report.guard.rear, 3);
    assert.equal(report.guard.behindAttacker, 0);
    report.variants = await page.evaluate(() => {
      const result = {};
      for (const variant of ['up', 'down']) {
        __fight.reset('gojo', 0, variant === 'down' ? 2 : 0, 0);
        const e = __fight.target(0, 0, 3.5, variant === 'down');
        __fight.player.comboN = 3;
        __fight.player.comboReset = 1;
        __fight.keys.Space = variant === 'up';
        __fight.punch();
        const kind = __fight.player.action.variant;
        __fight.tick(14);
        result[variant] = { kind, damage: 1000 - e.hp, vy: e.vel.y, down: !!e.bcFall, guard: e.blocking };
        __fight.keys.Space = false;
      }
      return result;
    });
    assert.equal(report.variants.up.kind, 'up');
    assert.ok(report.variants.up.vy > 15);
    assert.equal(report.variants.down.kind, 'down');
    assert.equal(report.variants.down.damage, 3);
    assert.ok(report.variants.down.down && !report.variants.down.guard);
    report.miss = await page.evaluate(() => {
      __fight.reset();
      __fight.player.comboN = 3;
      __fight.player.comboReset = 1;
      __fight.punch();
      __fight.tick(25);
      const miss = __fight.player.action;
      __fight.punch();
      return { type: miss.type, dur: miss.dur, n: miss.n, cd: __fight.cds.m1 };
    });
    assert.ok(report.miss.dur >= 1 && report.miss.cd > 1, 'Fourth-hit whiff leaves punishable recovery');
    await page.evaluate(() => __fight.reset());
    await page.keyboard.down('KeyB');
    assert.equal((await page.evaluate(() => __fight.state())).block, true);
    report.selfGuard = await page.evaluate(() => {
      const p = __fight.player;
      __fight.hurtPlayer(3, new __fight.THREE.Vector3(0, 0, -5));
      const front = p.hp;
      __fight.hurtPlayer(3, new __fight.THREE.Vector3(0, 0, 5));
      return { front, rear: p.hp, block: p.blocking, stun: p.stunT };
    });
    assert.equal(report.selfGuard.front, 100);
    assert.equal(report.selfGuard.rear, 97);
    assert.ok(!report.selfGuard.block && report.selfGuard.stun > 0);
    await page.keyboard.up('KeyB');
    report.interrupt = await page.evaluate(() => {
      __fight.reset();
      const e = __fight.target();
      __fight.punch();
      __fight.tick(3);
      __fight.hurtPlayer(3, new __fight.THREE.Vector3(0, 0, -2));
      __fight.tick(14);
      return {
        target: 1000 - e.hp,
        stun: __fight.player.stunT,
        punch: __fight.punch(),
        dash: __fight.doDash(),
        block: JJFIGHT.guard(true)
      };
    });
    assert.equal(report.interrupt.target, 0);
    assert.equal(report.interrupt.punch, false);
    assert.equal(report.interrupt.dash, false);
    assert.equal(report.interrupt.block, false);
    report.dash = await page.evaluate(() => {
      const result = {};
      for (const kind of ['front', 'side', 'back']) {
        __fight.reset();
        if (kind === 'side') __fight.keys.KeyA = true;
        if (kind === 'back') __fight.keys.KeyS = true;
        __fight.doDash();
        const start = __fight.player.pos.clone();
        __fight.tick(42);
        result[kind] = {
          distance: start.distanceTo(__fight.player.pos),
          cd: JJFIGHT.audit(),
          iframe: __fight.player.iframes
        };
      }
      __fight.reset();
      let e = __fight.target(0, 0, 9);
      __fight.doDash();
      __fight.tick(45);
      result.hit = { damage: 1000 - e.hp, pos: __fight.player.pos.toArray() };
      __fight.reset();
      e = __fight.target(0, 0, 9, true);
      __fight.doDash();
      __fight.tick(45);
      result.blocked = 1000 - e.hp;
      __fight.reset();
      __fight.keys.KeyA = true;
      __fight.doDash();
      __fight.tick(24);
      __fight.keys.KeyA = false;
      result.independent = __fight.doDash();
      return result;
    });
    assert.ok(report.dash.front.distance > report.dash.side.distance);
    assert.equal(report.dash.hit.damage, 3.25);
    assert.equal(report.dash.blocked, 0);
    assert.ok(report.dash.independent);
    assert.equal(report.dash.side.iframe, 0);
    // A side or back dash is an evade, so it can be cancelled into an attack
    // once past its commit window. The front dash is itself a strike and has
    // to stay committed. Skills go through each character's own key handler,
    // which runs after JJFIGHT.input, so this checks the real key path rather
    // than calling the cast function directly.
    report.evadeCancel = await page.evaluate(() => {
      const result = {};
      const press = (code) =>
        window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
      for (const kind of ['side', 'back', 'front']) {
        __fight.reset();
        if (kind === 'side') __fight.keys.KeyA = true;
        if (kind === 'back') __fight.keys.KeyS = true;
        __fight.doDash();
        __fight.keys.KeyA = __fight.keys.KeyS = false;
        __fight.tick(8);
        __fight.punch();
        const punched = __fight.player.action?.type;
        // the swing has to land, not merely relabel the action
        const f = new __fight.THREE.Vector3(
          Math.sin(__fight.player.facing), 0, Math.cos(__fight.player.facing));
        const e = __fight.enemies.find((e) => !e.net);
        e.pos.copy(__fight.player.pos).addScaledVector(f, 3);
        // its spawn has to come with it, or the AI walks it home mid-swing
        e.spawn.copy(e.pos);
        e.vel.set(0, 0, 0);
        const before = e.hp;
        for (let i = 0; i < 60; i++) { __fight.tick(1, 0.02, true); if (!__fight.player.action) break; }
        const damage = before - e.hp;   // read it before the next reset heals him
        __fight.reset();
        if (kind === 'side') __fight.keys.KeyA = true;
        if (kind === 'back') __fight.keys.KeyS = true;
        __fight.doDash();
        __fight.keys.KeyA = __fight.keys.KeyS = false;
        __fight.tick(8);
        press('Digit1');
        const skill = __fight.player.action?.type;
        // and a tap inside the commit window is queued rather than eaten
        __fight.reset();
        if (kind === 'side') __fight.keys.KeyA = true;
        if (kind === 'back') __fight.keys.KeyS = true;
        __fight.doDash();
        __fight.keys.KeyA = __fight.keys.KeyS = false;
        __fight.tick(1);
        __fight.punch();
        __fight.tick(20);
        result[kind] = { punched, damage, skill, queued: __fight.player.action?.type };
      }
      __fight.reset();
      return result;
    });
    for (const kind of ['side', 'back']) {
      assert.equal(report.evadeCancel[kind].punched, 'bc_m1', kind + ' dash cancels into M1');
      assert.ok(report.evadeCancel[kind].damage > 0, kind + ' dash cancelled into a real swing');
      assert.equal(report.evadeCancel[kind].skill, 'red', kind + ' dash cancels into a skill');
      assert.equal(report.evadeCancel[kind].queued, 'bc_m1', kind + ' dash queues an early M1 tap');
    }
    assert.equal(report.evadeCancel.front.punched, 'bc_dash', 'The front dash stays committed');
    assert.equal(report.evadeCancel.front.skill, 'bc_dash', 'The front dash is not skill-cancellable');
    await page.evaluate(() => __fight.reset());
    await page.mouse.move(635, 400);
    await page.mouse.down();
    await page.evaluate(() => __fight.tick(94));
    await page.mouse.up();
    report.hold = await page.evaluate(() => ({
      combo: __fight.player.comboN,
      cd: __fight.cds.m1,
      history: JJFIGHT.audit().history.slice(-8)
    }));
    assert.ok(
      report.hold.history.some((x) => x === 'm1 4 normal'),
      'Holding M1 continues the combo'
    );
    await page.evaluate(() => __fight.reset());
    await page.mouse.down();
    await page.evaluate(() => __fight.tick(2));
    await page.keyboard.down('Space');
    await page.evaluate(() => __fight.tick(82));
    await page.keyboard.up('Space');
    await page.mouse.up();
    assert.ok(
      await page.evaluate(() => JJFIGHT.audit().history.slice(-4).includes('m1 4 up')),
      'Holding Space during a real M1 chain produces an uppercut without jumping between swings'
    );
    await page.evaluate(() => {
      __fight.reset();
      __fight.player.comboN = 3;
      __fight.player.comboReset = 1;
      __fight.target();
      __fight.punch();
      __fight.tick(14);
      __fight.draw();
    });
    await page.screenshot({ path: path.join(out, 'fourth-hit.png') });
    report.recovery = await page.evaluate(() => {
      __fight.tick(160, 0.02, true);
      const e = __fight.enemies.find((e) => !e.net);
      const rested = { fall: !!e.bcFall, y: e.pos.y, finite: e.pos.toArray().every(Number.isFinite) };
      // A knockdown grants the victim 0.3s of iframes on standing up, and
      // enemies have no clock of their own — base.html only ticks the
      // player's down. Left running, that 0.3 stays on them for the rest of
      // the round and every combat hit is refused while skills sail past the
      // gate, so a dummy becomes permanently punch-proof after one combo.
      rested.iframes = +(e.iframes || 0).toFixed(3);
      __fight.player.pos.set(0, 0, 0);
      __fight.player.facing = 0;
      __fight.player.action = null;
      __fight.player.comboN = 0;
      __fight.cds.m1 = 0;
      e.pos.set(0, 0, 3);
      e.vel.set(0, 0, 0);
      const before = e.hp;
      for (let swing = 0; swing < 2; swing++) {
        __fight.punch();
        for (let i = 0; i < 40; i++) {
          __fight.tick(1, 0.02, true);
          if (!__fight.player.action && __fight.cds.m1 <= 0) break;
        }
      }
      rested.punchAfterGetup = before - e.hp;
      return rested;
    });
    assert.ok(!report.recovery.fall && report.recovery.finite && report.recovery.y >= 0);
    assert.equal(report.recovery.iframes, 0, 'Knockdown iframes expire once the victim is up');
    assert.ok(
      report.recovery.punchAfterGetup > 0,
      'M1 still lands on somebody who has got back up from a knockdown'
    );
    await page.evaluate(() => __fight.reset());
    await page.keyboard.down('KeyB');
    await page.evaluate(() => {
      __fight.tick(5);
      __fight.draw();
    });
    await page.screenshot({ path: path.join(out, 'guard.png') });
    await page.locator('#jjTop-settings').click();
    await page.evaluate(() => __fight.tick(1));
    assert.equal(
      (await page.evaluate(() => __fight.state())).block,
      false,
      'Opening settings releases guard'
    );
    await page.keyboard.up('KeyB');
    await page.locator('#jjMenuClose').click();
    report.poses = await page.evaluate(() =>
      Object.keys(__fight.CHARS).map((id) => {
        __fight.reset(id);
        const r = __fight.player.rig;
        for (const type of ['bc_m1', 'bc_dash', 'bc_fall'])
          for (const v of ['normal', 'up', 'down']) {
            JJFIGHT.pose(r, {
              type,
              t: 0.2,
              dur: 0.6,
              start: 0.18,
              active: 0.16,
              n: 3,
              variant: v,
              kind: 'side',
              side: -1,
              mode: 0,
              stage: 1
            });
            r.root.updateMatrixWorld(true);
            r.root.traverse((o) => {
              if (!o.matrixWorld.elements.every(Number.isFinite))
                throw Error(id + ' ' + type + ' invalid pose');
            });
          }
        return id;
      })
    );
    // Incoming hits must resolve guard/stun on the owning client, once per swing.
    report.network = await page.evaluate(() => {
      __fight.reset();
      __fight.online();
      JJFIGHT.guard(true);
      const hit = {
        t: 'hit',
        id: 'peer',
        to: MPJJ.id,
        d: 3,
        kx: 0,
        ky: 0.35,
        kz: -2.6,
        bc: { g: 1, b: 0, p: [0, 0, 3], st: 0.6, down: 0, v: 'normal', id: 1, k: 'm1' }
      };
      MPJJ.receive(hit);
      const blockedHP = __fight.player.hp;
      JJFIGHT.guard(false);
      hit.bc.id = 2;
      MPJJ.receive(hit);
      const hitHP = __fight.player.hp;
      MPJJ.receive(hit);
      const duplicateHP = __fight.player.hp;
      __fight.reset();
      __fight.online();
      JJFIGHT.guard(true);
      hit.bc = { ...hit.bc, id: 3, b: 1, down: 1.35, v: 'down' };
      hit.ky = -17;
      MPJJ.receive(hit);
      const down = __fight.player.action?.type;
      hit.bc.id = 4;
      MPJJ.receive(hit);
      const knockedHP = __fight.player.hp;
      __fight.tick(4);
      const packet = __packets.filter((x) => x.t === 's').at(-1);
      __fight.offline();
      return { blockedHP, hitHP, duplicateHP, knockedHP, down, packet };
    });
    assert.equal(report.network.blockedHP, 100);
    assert.equal(report.network.hitHP, 97);
    assert.equal(report.network.duplicateHP, 97);
    assert.equal(report.network.knockedHP, 97, 'Core hits cannot hit an already knocked-down victim');
    assert.equal(report.network.down, 'bc_fall');
    assert.equal(report.network.packet.ac, 'bc_fall');
    assert.ok(report.network.packet.bcPose);
    const peer = await browser.newPage();
    peer.on('pageerror', (e) => errors.push(e.message));
    await peer.goto('http://127.0.0.1:' + server.address().port);
    await peer.waitForFunction(() => window.__fight);
    report.peer = await peer.evaluate((packet) => {
      __fight.reset();
      __fight.online();
      MPJJ.receive(packet);
      __fight.tick(2);
      const f = MPJJ.fighters[packet.id];
      return {
        type: f.action.type,
        stage: f.action.stage,
        hip: f.e.rig.hips.rotation.x,
        finite: f.e.rig.hips.position.toArray().every(Number.isFinite)
      };
    }, report.network.packet);
    assert.equal(report.peer.type, 'bc_fall');
    assert.ok(report.peer.finite && Math.abs(report.peer.hip) > 0.1);
    // Produce a real attack packet against the second client's live guard state.
    const defender = await peer.evaluate(() => {
      JJMAP.load('plate');
      __fight.reset('yuji', 0, 0, 3.5);
      __fight.player.facing = Math.PI;
      __fight.online();
      JJFIGHT.guard(true);
      __fight.tick(4);
      return __packets.filter((m) => m.t === 's').at(-1);
    });
    report.outgoing = await page.evaluate((state) => {
      __fight.reset();
      __fight.online();
      MPJJ.receive(state);
      __fight.tick(4);
      const foe = MPJJ.fighters[state.id].e;
      const before = foe.hp;
      __fight.punch();
      __fight.tick(12);
      const hits = __packets.filter((m) => m.t === 'hit');
      return { predicted: before - foe.hp, hits, pose: __packets.filter((m) => m.t === 's').at(-1) };
    }, defender);
    assert.equal(report.outgoing.predicted, 0);
    assert.equal(report.outgoing.hits.length, 1);
    assert.equal(report.outgoing.hits[0].bc.k, 'm1');
    assert.equal(report.outgoing.pose.ac, 'bc_m1');
    assert.equal(
      await peer.evaluate((hit) => {
        MPJJ.receive(hit);
        return __fight.player.hp;
      }, report.outgoing.hits[0]),
      100,
      'Owner confirms frontal guard on a real outgoing M1'
    );
    const rearHit = await page.evaluate((id) => {
      __fight.reset();
      __fight.online();
      const f = MPJJ.fighters[id];
      f.e.pos.set(0, 0, 3.5);
      f.e.hp = 100;
      f.e.blocking = true;
      f.e.facing = 0;
      f.e.bcFall = null;
      f.action = null;
      __fight.punch();
      __fight.tick(12);
      return __packets.filter((m) => m.t === 'hit').at(-1);
    }, defender.id);
    assert.equal(
      await peer.evaluate((hit) => {
        __fight.player.facing = 0;
        MPJJ.receive(hit);
        return __fight.player.hp;
      }, rearHit),
      97,
      'A rear M1 bypasses the owning client guard'
    );
    await page.evaluate(() => __fight.offline());
    await peer.close();
    report.world = await page.evaluate(() => {
      __fight.fixture();
      const result = {};
      for (const air of [false, true]) {
        __fight.reset('gojo', 0, air ? 2 : 0, 0);
        __fight.doDash();
        __fight.tick(15, 0.06);
        result[air ? 'airDashZ' : 'groundDashZ'] = __fight.player.pos.z;
      }
      __fight.reset();
      const behind = __fight.target(0, 0, 4);
      __fight.punch();
      __fight.tick(24);
      result.wallDamage = 1000 - behind.hp;
      __fight.reset('gojo', -24, 0, 0);
      const roof = __fight.target(-24, 0, 3.5);
      __fight.player.comboN = 3;
      __fight.player.comboReset = 1;
      __fight.keys.Space = true;
      __fight.punch();
      __fight.tick(12);
      __fight.keys.Space = false;
      let max = roof.pos.y;
      for (let i = 0; i < 130; i++) {
        __fight.tick(1, 0.02, true);
        max = Math.max(max, roof.pos.y);
      }
      result.ceilingMaxY = max;
      result.ceilingRecovered = !roof.bcFall;
      __fight.reset('gojo', 24, 4, 0);
      __fight.player.onGround = true;
      const platform = __fight.target(24, 4, 3.5);
      __fight.player.comboN = 3;
      __fight.player.comboReset = 1;
      __fight.keys.Space = true;
      __fight.punch();
      __fight.tick(12);
      __fight.keys.Space = false;
      __fight.tick(180, 0.02, true);
      result.platformY = platform.pos.y;
      result.platformRecovered = !platform.bcFall;
      __fight.restore();
      return result;
    });
    assert.ok(
      report.world.groundDashZ < 1.7 && report.world.airDashZ < 1.7,
      'Ground and air dashes stop before a thin wall'
    );
    assert.equal(report.world.wallDamage, 0);
    assert.ok(
      report.world.ceilingMaxY <= 1.91 && report.world.ceilingRecovered,
      'Uppercut respects ceiling and recovers'
    );
    assert.ok(
      Math.abs(report.world.platformY - 4) < 0.05 && report.world.platformRecovered,
      'Knockdown recovers on the elevated platform'
    );
    report.errors = errors;
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'combat-tests.json'), JSON.stringify(report, null, 2));
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
