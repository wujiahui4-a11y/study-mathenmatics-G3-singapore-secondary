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
const ai = fs
  .readFileSync(path.join(__dirname, 'test-ai-server.cjs'), 'utf8')
  .match(/core \+\s*`([\s\S]*?)`;/)[1];
const extra = `
window.__kits={
  fixture(id) {
    __ai.start(16,812); __ai.isolate();
    const e=JJAISERVER.bots.find(e=>e.char===id), t=JJAISERVER.bots.find(t=>t!==e);
    __ai.place(e,0,0,0); __ai.place(t,0,0,4);
    e.ai.target=t; t.hp=t.maxHp=10000;
    __fight.player.pos.set(120,0,120); __fight.player.iframes=0;
    for(const b of JJAISERVER.bots) if(b!==e && b!==t) { b.pos.set(300,0,300); b.iframes=999; }
    return {e,t};
  },
  fx(dt) { for(let i=fx.length-1;i>=0;i--) if(!fx[i].update(dt))fx.splice(i,1); },
  tick(e,t,n=1) { for(let i=0;i<n;i++) {
    JJAISERVER.time+=.02; e.update(.02);
    t.stunT=Math.max(0,t.stunT-.02);t.iframes=Math.max(0,t.iframes-.02);
    if(!t.anchorT&&!t.lockT&&!t.cineHold&&!t.tdHold){t.pos.addScaledVector(t.vel,.02);t.vel.multiplyScalar(.85);}
    this.fx(.02);
  } },
  globals(){return {hp:player.hp,cd:{...cds},pos:player.pos.toArray(),char:player.char,action:player.action?.type,
    mode:JJMAHITO.mode,scale:JJCHOSO.scale,charge:JJAW.charge,yaw:camYaw,fx:fx.length};},
  playerCast(id,slot){ __fight.reset(id); for(const k in cds)cds[k]=0; JJCHARCAST[id].cast[slot]();return player.action?.type||'special'; }
};`;
let html = fs
  .readFileSync(path.join(root, 'jujutsu-multiplayer.html'), 'utf8')
  .replace('<head>', '<head><script>requestAnimationFrame=function(){return 0;};</script>');
const end = html.lastIndexOf('</script>');
html = html.slice(0, end) + core + ai + extra + html.slice(end);
const server = http.createServer((q, r) => {
  r.setHeader('Content-Type', 'text/html;charset=utf-8');
  r.end(html);
});
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const errors = [],
    report = { skills: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => window.__kits);
    await page.clock.install();
    const ids = await page.evaluate(() => Object.keys(JJCHARCAST));
    for (const id of ids) {
      for (let slot = 0; slot < 5; slot++) {
        const r = await page.evaluate(
          ({ id, slot }) => {
            const { e, t } = __kits.fixture(id),
              before = __kits.globals();
            const distance =
              {
                naoya: [3, 4, 4, 4, 12],
                choso: [12, 8, 8, 8, 7],
                megumi: [8, 13, 8, 8, 4],
                yuta: [10, 12, 7, 7, 12],
                higuruma: [9, 7, 12, 7, 4],
                muta: [12, 8, 10, 12, 4],
                ryu: [12, 12, 14, 4, 12],
                nanami: [8, 6, 8, 12, 8],
                gojo: [8, 4, 3, 4, 12]
              }[id]?.[slot] || 4;
            __ai.place(t, 0, 0, distance);
            const name = JJAIKITS.menu(e)[slot].lbl,
              hp = t.hp;
            const ok = JJAICOMBAT.skill(e, t, slot),
              type = e.action?.type || 'special';
            const cd = JJAIKITS.cooldown(e, slot),
              second = JJAICOMBAT.skill(e, t, slot);
            __kits.tick(e, t, 250);
            const after = __kits.globals();
            delete before.fx;
            delete after.fx;
            const damage = hp - t.hp;
            let finite = e.pos.toArray().every(Number.isFinite);
            e.rig.root.traverse((o) => {
              if (
                ![...o.position.toArray(), ...o.rotation.toArray().slice(0, 3), ...o.scale.toArray()].every(
                  Number.isFinite
                )
              )
                finite = false;
            });
            const casts = e.ai.kit.casts.slice();
            return {
              id,
              slot,
              name,
              ok,
              type,
              cd,
              second,
              damage,
              finite,
              casts,
              isolated: JSON.stringify(before) === JSON.stringify(after)
            };
          },
          { id, slot }
        );
        report.skills.push(r);
        console.log(JSON.stringify(r));
        assert.ok(r.ok, `${id} slot ${slot + 1} must cast`);
        assert.notEqual(r.type, 'ai_skill');
        assert.ok(r.finite, `${id} finite`);
        assert.ok(r.isolated, `${id} must restore the human state`);
        assert.ok(!r.second, `${id} cooldown must prevent a second cast`);
      }
    }
    for (const [id, slot, damage] of [
      ['yuji', 0, 40],
      ['yuji', 1, 52],
      ['hanami', 0, 34],
      ['todo', 2, 22]
    ])
      assert.equal(
        report.skills.find((x) => x.id === id && x.slot === slot).damage,
        damage,
        'Original damage and timed variants'
      );
    report.counters = await page.evaluate(() =>
      ['hakari', 'todo'].map((id) => {
        const { e, t } = __kits.fixture(id);
        JJAICOMBAT.skill(e, t, 4);
        __kits.tick(e, t, 12);
        e.iframes = 0;
        const hp = e.hp;
        const hit = JJAISERVER.hit(t, e, 10, new __fight.THREE.Vector3(0, 0, -2), {
          guardable: true,
          source: t.pos.clone(),
          id: 99
        });
        const counter = !!(e.action?.counter || e.action?.sprung);
        __kits.tick(e, t, 60);
        return { id, hit, counter, protected: hp === e.hp, damage: 10000 - t.hp };
      })
    );
    assert.ok(report.counters.every((c) => c.counter && !c.hit && c.protected && c.damage > 0));
    report.sameCharacter = await page.evaluate(() => {
      const { e, t } = __kits.fixture('choso');
      const b = JJAISERVER.bots.find((x) => x !== e && x !== t);
      b.char = 'choso';
      JJAIKITS.init(b);
      JJAICOMBAT.skill(e, t, 3);
      return {
        first: JJAIKITS.cooldown(e, 3),
        second: JJAIKITS.cooldown(b, 3),
        human: JJCHOSO.scale,
        distinct: e.ai.kit.cd !== b.ai.kit.cd && e.ai.kit.states !== b.ai.kit.states
      };
    });
    assert.ok(
      report.sameCharacter.first > 0 &&
        report.sameCharacter.second === 0 &&
        report.sameCharacter.human === 0 &&
        report.sameCharacter.distinct
    );
    report.delayed = await page.evaluate(() => {
      const { e, t } = __kits.fixture('megumi');
      JJAICOMBAT.skill(e, t, 0);
      __kits.tick(e, t, 20);
      const roots = e.ai.kit.roots.size;
      JJAISERVER.stop(false);
      const hp = __fight.player.hp;
      __kits.fx(0.3);
      return { roots, clean: !e.ai.kit, hpUnchanged: hp === __fight.player.hp };
    });
    assert.ok(report.delayed.roots > 0 && report.delayed.clean && report.delayed.hpUnchanged);
    report.errors = errors;
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'ai-character-kits.json'), JSON.stringify(report, null, 2));
    console.log(
      'PASS: ' + report.skills.length + ' real character moves, actor isolation, cooldowns and cleanup'
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
