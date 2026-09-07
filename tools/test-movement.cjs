'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http'),
  assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'),
  out = path.resolve(process.env.MOVEMENT_ARTIFACT_DIR || path.join(root, '../movement-test'));
fs.mkdirSync(out, { recursive: true });
const hook = `
window.__mv={THREE,player,keys,cds,scene,camera,renderer,poseAction,CHARS,
 select(id){JJMOVE.cancel('select');started=false;switchChar(id,true);started=true;menu.style.display='none';},
 tick(n=1,dt=.02){for(let i=0;i<n;i++){updatePlayer(dt);updateHUD(dt);for(let j=fx.length-1;j>=0;j--)if(!fx[j].update(dt))fx.splice(j,1);}},
 reset(x=0,y=0,z=0,ground=true){JJMOVE.cancel('reset');JJTODO.cleanup();JJMAHITO.cleanup();JJAW.cine=false;JJAW.active=false;JJFIN.stop?.();
 started=false;switchChar('gojo',true);started=true;menu.style.display='none';player.dead=false;player.react=null;player.action=null;player.frameT=player.stunT=player.attackT=player.dashT=0;player.blocking=false;player.iframes=0;player.hp=player.maxHp=100;
 player.pos.set(x,y,z);player.vel.set(0,0,0);player.facing=0;player.onGround=ground;player.__jjsLast=null;camYaw=Math.PI;clearMovement();for(const k in cds)cds[k]=0;JJDASH.line=JJDASH.side=0;
 for(const e of enemies){e.pos.set(60,0,60);e.rig.root.visible=false;}for(let i=0;i<60;i++)JJMOVE.beforeStep(.02);player.rig.root.position.copy(player.pos);},
 fixture(roof=false){JJMOVE.cancel('fixture');JJMAP.load('jjs');const D=JJJJS.data;if(!this.original)this.original={parts:D.parts,visual:D.visual,decals:D.decals,guis:D.guis,breakable:D.breakable};
 const part=(x,y,z,sx,sy,sz,angle=0)=>[x+D.origin[0],y+D.origin[1],z+D.origin[2],Math.cos(angle),0,Math.sin(angle),0,1,0,-Math.sin(angle),0,Math.cos(angle),sx,sy,sz,.57,.62,.66,0,0,0,3,0];
 Object.assign(D,{visual:null,decals:[],guis:[],breakable:[],parts:[part(0,-.5,0,100,1,100),part(0,1.75,5,12,3.5,1.5),part(0,4,16,20,8,8),part(-5,6,0,1,12,20),part(15,4,0,1,8,12,Math.PI/6)]});
 if(roof)D.parts.push(part(0,8.6,5,12,.5,10));JJJJS.build();},
 restore(){JJMOVE.cancel('restore');Object.assign(JJJJS.data,this.original);JJJJS.build();},
 state(){return {mode:JJMOVE.state,action:player.action?.type,pos:player.pos.toArray(),vel:player.vel.toArray(),ground:player.onGround,hp:player.hp,iframes:player.iframes,cd:JJMOVE.cooldowns};},
 hurt(){hurtPlayer(10,new THREE.Vector3(0,0,-8));},
 draw(at=[15,12,-5],look=[0,5,12]){player.rig.root.position.copy(player.pos);player.rig.root.rotation.y=player.facing;camera.position.set(...at);camera.lookAt(...look);scene.updateMatrixWorld(true);renderer.render(scene,camera);},
 online(){MPJJ.active=true;MPJJ.joined=true;MPJJ.host=true;MPJJ.name='TEST';MPJJ.relay={connected:true,pub(m){window.__packets.push(m);}};window.__packets=[];},
 offline(){MPJJ.active=false;MPJJ.joined=false;MPJJ.relay=null;}
};`;
const server = http.createServer((req, res) => {
  let h = fs
    .readFileSync(path.join(root, 'jujutsu-multiplayer.html'), 'utf8')
    .replace('<head>', '<head><script>requestAnimationFrame=function(){return 0;};</script>');
  const i = h.lastIndexOf('</script>');
  res.setHeader('Content-Type', 'text/html;charset=utf-8');
  res.end(h.slice(0, i) + hook + h.slice(i));
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
      console.error('PAGE', e.message);
    });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => window.__mv && window.JJMOVE);
    await page.clock.install();
    await page.evaluate(() => {
      __mv.fixture();
      __mv.reset(0, 0, 1.8);
    });
    await page.keyboard.down('KeyW');
    await page.evaluate(() => __mv.tick(1));
    assert.equal((await page.evaluate(() => __mv.state())).mode, 'pk_vault');
    await page.evaluate(() => {
      __mv.tick(14);
      __mv.draw([13, 10, -3], [0, 3, 5]);
    });
    await page.screenshot({ path: path.join(out, 'vault.png') });
    await page.evaluate(() => __mv.tick(24));
    await page.keyboard.up('KeyW');
    report.vault = await page.evaluate(() => __mv.state());
    assert.equal(report.vault.mode, 'free');
    assert.ok(report.vault.pos[2] > 6.7);
    assert.ok(report.vault.ground);
    await page.evaluate(() => {
      __mv.fixture(true);
      __mv.reset(0, 0, 1.8);
    });
    await page.keyboard.down('KeyW');
    await page.evaluate(() => __mv.tick(1));
    assert.equal((await page.evaluate(() => __mv.state())).mode, 'free', 'Low ceiling prevents auto-vault');
    await page.keyboard.up('KeyW');
    await page.evaluate(() => {
      __mv.fixture();
      __mv.reset(0, 3, 9.8, false);
    });
    await page.keyboard.press('Space');
    assert.equal((await page.evaluate(() => __mv.state())).mode, 'pk_grab');
    await page.evaluate(() => __mv.tick(12));
    assert.equal((await page.evaluate(() => __mv.state())).mode, 'pk_hang');
    await page.evaluate(() => __mv.draw());
    await page.screenshot({ path: path.join(out, 'ledge-hang.png') });
    const hanging = await page.evaluate(() => __mv.state());
    await page.keyboard.down('KeyD');
    await page.evaluate(() => __mv.tick(12));
    await page.keyboard.up('KeyD');
    await page.evaluate(() => __mv.tick(12));
    report.shimmy = await page.evaluate(() => __mv.state());
    assert.ok(report.shimmy.pos[0] < hanging.pos[0] - 0.7);
    assert.equal(report.shimmy.mode, 'pk_hang');
    await page.keyboard.press('Space');
    await page.evaluate(() => {
      __mv.tick(18);
      __mv.draw();
    });
    await page.screenshot({ path: path.join(out, 'ledge-climb.png') });
    await page.evaluate(() => __mv.tick(24));
    report.climb = await page.evaluate(() => __mv.state());
    assert.ok(report.climb.pos[1] >= 7.98 && report.climb.pos[2] > 12.7);
    assert.equal(report.climb.mode, 'free');
    assert.ok(report.climb.ground);
    await page.evaluate(() => __mv.reset(0, 3, 9.8, false));
    await page.keyboard.press('Space');
    await page.evaluate(() => __mv.tick(12));
    await page.keyboard.press('KeyS');
    await page.evaluate(() => __mv.tick(6));
    report.drop = await page.evaluate(() => __mv.state());
    assert.equal(report.drop.mode, 'free');
    assert.ok(report.drop.vel[1] < 0);
    await page.evaluate(() => __mv.reset(-2.5, 3, 0, false));
    await page.keyboard.down('KeyD');
    await page.keyboard.press('KeyQ');
    await page.keyboard.up('KeyD');
    assert.equal((await page.evaluate(() => __mv.state())).mode, 'pk_kick');
    await page.evaluate(() => {
      __mv.tick(5);
      __mv.draw([9, 9, -12], [-1, 5, 0]);
    });
    await page.screenshot({ path: path.join(out, 'wall-kick.png') });
    await page.evaluate(() => __mv.tick(16));
    report.kick = await page.evaluate(() => __mv.state());
    assert.ok(report.kick.pos[0] > 3);
    assert.ok(report.kick.pos[1] > 3);
    assert.equal(report.kick.iframes, 0);
    await page.evaluate(() => __mv.reset(25, 3, 25, false));
    await page.keyboard.down('KeyD');
    await page.keyboard.press('KeyQ');
    await page.keyboard.up('KeyD');
    assert.equal(
      (await page.evaluate(() => __mv.state())).action,
      'dash',
      'No nearby wall falls back to existing dash'
    );
    await page.evaluate(() => __mv.reset(0, 3, 9.8, false));
    await page.keyboard.press('Space');
    await page.evaluate(() => __mv.tick(12));
    await page.evaluate(() => {
      JJJJS.setFragments(2, []);
      __mv.tick(1);
    });
    report.destroyed = await page.evaluate(() => __mv.state());
    assert.equal(report.destroyed.mode, 'free');
    assert.ok(report.destroyed.vel[1] < 0);
    await page.evaluate(() => {
      JJJJS.setFragments(2, null);
      __mv.reset(0, 3, 9.8, false);
    });
    await page.keyboard.press('Space');
    await page.evaluate(() => __mv.tick(12));
    await page.evaluate(() => __mv.hurt());
    assert.equal((await page.evaluate(() => __mv.state())).mode, 'free', 'Damage releases the ledge');
    await page.evaluate(() => __mv.reset(0, 3, 9.8, false));
    await page.keyboard.press('Space');
    await page.evaluate(() => __mv.tick(12));
    await page.locator('#jjTop-settings').click();
    await page.evaluate(() => __mv.tick(1));
    assert.equal((await page.evaluate(() => __mv.state())).mode, 'free', 'Menu releases traversal');
    await page.locator('#jjMenuClose').click();
    await page.evaluate(() => __mv.reset(0, 3, 9.8, false));
    await page.keyboard.press('Space');
    await page.evaluate(() => __mv.tick(12));
    await page.evaluate(() => {
      __mv.online();
      __mv.tick(8);
    });
    report.network = await page.evaluate(() => __packets.filter((m) => m.t === 's').at(-1));
    assert.equal(report.network.ac, 'pk_hang');
    assert.ok(Number.isFinite(report.network.mvx));
    const peer = await browser.newPage();
    peer.on('pageerror', (e) => errors.push(e.message));
    await peer.goto('http://127.0.0.1:' + server.address().port);
    await peer.waitForFunction(() => window.__mv && window.JJMOVE);
    await peer.evaluate((packet) => {
      __mv.fixture();
      __mv.reset(25, 0, 25);
      __mv.online();
      MPJJ.receive(packet);
      __mv.tick(8);
    }, report.network);
    report.peer = await peer.evaluate((id) => {
      const f = MPJJ.fighters[id];
      return {
        action: f.action.type,
        hp: f.e.hp,
        finite: f.e.rig.hips.position.toArray().every(Number.isFinite),
        shoulder: f.e.rig.shoulderL.rotation.x
      };
    }, report.network.id);
    assert.equal(report.peer.action, 'pk_hang');
    assert.equal(report.peer.hp, 100);
    assert.ok(report.peer.finite);
    await peer.close();
    await page.evaluate(() => __mv.offline());
    report.poses = await page.evaluate(() => {
      const r = __mv.player.rig,
        result = [];
      for (const type of ['pk_vault', 'pk_hang', 'pk_shimmy', 'pk_climb', 'pk_kick']) {
        JJMOVE.pose(r, { type, t: 0.16, dur: 0.7, side: 1 });
        const a = r.shoulderL.rotation.x;
        JJMOVE.pose(r, { type, t: 0.46, dur: 0.7, side: -1 });
        result.push({
          type,
          finite: r.hips.position.toArray().every(Number.isFinite),
          change: Math.abs(r.shoulderL.rotation.x - a) + Math.abs(r.spine.rotation.z)
        });
      }
      return result;
    });
    assert.ok(report.poses.every((x) => x.finite));
    await page.evaluate(() => {
      JJMAP.load('plate');
      __mv.tick(1);
    });
    assert.equal((await page.evaluate(() => __mv.state())).mode, 'free', 'Map change clears traversal');
    await page.evaluate(() => {
      JJMAP.load('jjs');
      __mv.restore();
      __mv.reset(0, 0, 0);
    });
    report.city = await page.evaluate(() => {
      const V = (...a) => new __mv.THREE.Vector3(...a),
        candidates = [];
      for (const b of JJJJS.originals.values()) {
        if (b.h[1] < 2 || b.h[0] < 3 || b.h[2] < 1 || b.minY < -5 || b.maxY > 75) continue;
        for (const axis of [0, 2])
          for (const sign of [-1, 1]) {
            const n = V(b.r[axis], b.r[3 + axis], b.r[6 + axis]).multiplyScalar(sign);
            if (Math.abs(n.y) > 0.1) continue;
            const p = V(b.x, b.maxY - 5, b.z).addScaledVector(n, b.h[axis] + 2.1);
            const ledge = JJMOVE.findLedge(p, n.clone().negate(), 3.8);
            if (ledge) {
              candidates.push({
                id: b.id,
                pos: p.toArray(),
                face: Math.atan2(-n.x, -n.z),
                hang: ledge.hang.toArray()
              });
              if (candidates.length >= 3) return candidates;
            }
          }
      }
      return candidates;
    });
    assert.ok(report.city.length >= 1, 'Real imported city must have usable ledges');
    const c = report.city[0];
    await page.evaluate((c) => {
      __mv.reset(...c.pos, false);
      __mv.player.facing = c.face;
    }, c);
    await page.keyboard.press('Space');
    await page.evaluate(() => __mv.tick(12));
    assert.equal((await page.evaluate(() => __mv.state())).mode, 'pk_hang');
    await page.evaluate(() => {
      const p = __mv.player.pos,
        y = __mv.player.facing;
      __mv.draw(
        [p.x - Math.sin(y) * 14 + Math.cos(y) * 6, p.y + 9, p.z - Math.cos(y) * 14 - Math.sin(y) * 6],
        [p.x, p.y + 4, p.z]
      );
    });
    await page.screenshot({ path: path.join(out, 'jjs-parkour.png') });
    report.roster = await page.evaluate(() => Object.keys(__mv.CHARS).map(id => {
      __mv.select(id);
      const r=__mv.player.rig;
      for(const type of ['pk_vault','pk_grab','pk_hang','pk_shimmy','pk_climb','pk_kick']) {
        for(const side of [-1,1]) {
          JJMOVE.pose(r,{type,t:.21,dur:.7,side});
          r.root.updateMatrixWorld(true);
          let finite=true;
          r.root.traverse(o=>{if(!o.matrixWorld.elements.every(Number.isFinite))finite=false;});
          if(!finite)throw Error(id+' has an invalid '+type+' pose');
        }
      }
      return id;
    }));
    assert.deepEqual(errors, []);
    report.errors = errors;
    fs.writeFileSync(path.join(out, 'movement-tests.json'), JSON.stringify(report, null, 2));
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
