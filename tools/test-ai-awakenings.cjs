'use strict';
const fs = require('fs'),
  path = require('path'),
  http = require('http'),
  assert = require('assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'),
  out = path.resolve(root, '../ai-test');
const core = fs
  .readFileSync(path.join(__dirname, 'test-core-combat.cjs'), 'utf8')
  .match(/const hook = `([\s\S]*?)`;/)[1];
const ai = fs
  .readFileSync(path.join(__dirname, 'test-ai-server.cjs'), 'utf8')
  .match(/core \+\s*`([\s\S]*?)`;/)[1];
const kits = fs
  .readFileSync(path.join(__dirname, 'test-ai-character-kits.cjs'), 'utf8')
  .match(/const extra = `([\s\S]*?)`;/)[1];
let html = fs
  .readFileSync(path.join(root, 'jujutsu-multiplayer.html'), 'utf8')
  .replace('<head>', '<head><script>requestAnimationFrame=function(){return 0;};</script>');
let i = html.lastIndexOf('</script>');
html = html.slice(0, i) + core + ai + kits + html.slice(i);
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
  const errors = [],
    report = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    page.on('pageerror', (e) => {
      errors.push(e.message);
      console.error(e.message);
    });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => window.__kits);
    await page.clock.install();
    for (const id of ['gojo', 'yuji', 'hakari', 'choso', 'megumi', 'mahito', 'todo', 'naoya'])
      for (let slot = 0; slot < (id === 'naoya' ? 1 : 4); slot++) {
        const r = await page.evaluate(
          ({ id, slot }) => {
            const { e, t } = __kits.fixture(id),
              k = JJAIKITS.init(e);
            t.hp = t.maxHp = 100000;
            k.charge = 99;
            const notReady = JJAIKITS.awaken(e, t);
            k.charge = 100;
            const before = __kits.globals();
            delete before.fx;
            const start = JJAIKITS.awaken(e, t),
              startType = e.action?.type;
            __kits.tick(e, t, id === 'naoya' ? 60 : 200);
            const awake = JJAIKITS.awakened(e);
            let cast, type, damage, cd;
            if (id === 'naoya') {
              cast = !!start;
              type = startType;
              damage = 100000 - t.hp;
              cd = 0;
            } else {
              const dist = {
                gojo: [12, 15, 20, 12],
                yuji: [12, 4, 20, 12],
                hakari: [14, 4, 12, 8],
                choso: [15, 10, 12, 12],
                megumi: [12, 12, 8, 12],
                mahito: [4, 5, 6, 8],
                todo: [5, 5, 5, 5]
              }[id][slot];
              e.action = null;
              e.react = null;
              e.iframes = 0;
              __ai.place(e, 0, 0, 0);
              __ai.place(t, 0, 0, dist);
              t.anchorT = t.lockT = t.stunT = t.frameT = 0;
              t.cineHold = t.tdHold = false;
              cast = JJAICOMBAT.skill(e, t, slot);
              type = e.action?.type;
              cd = JJAIKITS.cooldown(e, slot);
              const hp = t.hp;
              __kits.tick(
                e,
                t,
                (id === 'mahito' && slot === 3) || (id === 'megumi' && slot === 3) ? 950 : 500
              );
              damage = hp - t.hp;
            }
            const after = __kits.globals();
            delete after.fx;
            const remaining = k.remaining,
              charge = JJAIKITS.charge(e),
              finite = e.pos.toArray().every(Number.isFinite);
            JJAIKITS.reset(e);
            const ended = !JJAIKITS.awakened(e);
            return {
              id,
              slot,
              notReady,
              start,
              startType,
              awake,
              cast,
              type,
              damage,
              cd,
              remaining,
              charge,
              ended,
              finite,
              isolated: JSON.stringify(before) === JSON.stringify(after),
              before,
              after
            };
          },
          { id, slot }
        );
        report.push(r);
        console.log(JSON.stringify({ ...r, before: undefined, after: undefined }));
        fs.writeFileSync(
          path.join(out, 'awakening-results.json'),
          JSON.stringify({ skills: report, errors }, null, 2)
        );
        assert.ok(
          !r.notReady && r.start && r.awake && r.cast && r.ended && r.finite,
          `${id} awakening/slot ${slot}`
        );
        assert.ok(r.damage > 0, `${id} awakened slot ${slot} must hit`);
        assert.ok(r.isolated, `${id} changes human state`);
      }
    assert.deepEqual(errors, []);
    console.log('AWAKENINGS PASSED: all existing awakened kits, isolation and cooldowns');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
