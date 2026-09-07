/* Real browser checks for menu input, responsive HUD, fighter kits and settings. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.env.STUDIO_UI_ARTIFACT_DIR || path.join(root, '../studio-ui-test'));
fs.mkdirSync(out, { recursive: true });
const hook = `window.__ui={player,cds,CHARS,scene,renderer,camera,
 start(){enterArenaLocal();},switch(id){started=false;switchChar(id,true);started=true;menu.style.display='none';player.action=null;player.attackT=0;player.dead=false;for(const k in cds)cds[k]=0;updateHUD(.01);},
 tick(){updateHUD(.01);},draw(){const s=JJMAP.spawn(2);player.pos.set(s.x,s.y,s.z);player.rig.root.position.copy(player.pos);player.rig.root.rotation.y=Math.PI;for(const e of enemies)e.rig.root.visible=false;camera.position.set(s.x+14,s.y+12,s.z+23);camera.lookAt(s.x,s.y+3,s.z);scene.updateMatrixWorld(true);renderer.render(scene,camera);},
 state(){return {started,active:gameInputActive(),char:player.char,action:player.action?.type,slots:cdEls.map(c=>({key:c.def.key,label:c.def.lbl,cd:c.def.cd}))};}};`;
const server = http.createServer((req, res) => {
  let s = fs
    .readFileSync(path.join(root, 'jujutsu-multiplayer.html'), 'utf8')
    .replace('<head>', '<head><script>requestAnimationFrame=function(){return 0;};</script>');
  const end = s.lastIndexOf('</script>');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(s.slice(0, end) + hook + s.slice(end));
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
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => window.JJSTUDIOUI && window.__ui);
    await page.screenshot({ path: path.join(out, 'studio-characters.png') });
    await page.locator('#jjTab-settings').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#jjTab-settings').getAttribute('aria-selected'), 'true');
    assert.equal(
      (await page.evaluate(() => __ui.state())).started,
      false,
      'Enter on a menu tab must not start training'
    );
    await page.locator('#jjPotatoMode').check();
    assert.equal(await page.evaluate(() => JJPOTATO.enabled), true);
    await page.screenshot({ path: path.join(out, 'studio-settings.png') });
    await page.locator('#jjSettings-general').click();
    await page.locator('#jjTrainingMap').selectOption('jjs');
    await page.evaluate(() => JJJJS.ready);
    await page.getByLabel('Debris quality').selectOption('64');
    assert.equal(await page.evaluate(() => JJDESTRUCT.settings.debris), 64);
    await page.locator('#jjTab-characters').click();
    await page.locator('#menuRoster [data-char=todo]').click();
    await page.locator('#menuFight').click();
    await page.evaluate(() => {
      __ui.tick();
      __ui.draw();
    });
    await page.screenshot({ path: path.join(out, 'studio-hud.png') });
    assert.equal(await page.locator('#jjTodoHud').isVisible(), true);
    assert.equal(await page.locator('#jjAwake').isVisible(), false);
    const before = await page.evaluate(() => __ui.state());
    assert.equal(before.char, 'todo');
    await page.locator('#moves [data-key="1"]').click();
    assert.equal(
      (await page.evaluate(() => __ui.state())).action,
      'b1',
      'Clicking the skill invokes the existing combat handler'
    );
    await page.locator('#jjTop-settings').click();
    assert.equal((await page.evaluate(() => __ui.state())).active, false);
    await page.locator('#jjSettings-general').click();
    await page.getByLabel('Rebuild delay').selectOption('60');
    assert.equal(await page.locator('#menu').isVisible(), true, 'Changing a select must not resume combat');
    assert.equal(await page.evaluate(() => JJDESTRUCT.settings.rebuild), 60);
    await page.locator('#jjMenuClose').click();
    assert.equal((await page.evaluate(() => __ui.state())).active, true);
    await page.locator('#jjTop-servers').click();
    assert.equal(await page.locator('#jjLobby').isVisible(), true);
    await page.locator('#jjBack').click();
    assert.equal(await page.locator('#menu').isVisible(), true);
    await page.locator('#jjMenuClose').click();
    report.navigation = 'Menu keyboard, skill click, settings, resume and multiplayer lobby passed';
    report.roster = await page.evaluate(() => {
      const result = [];
      for (const id of Object.keys(__ui.CHARS)) {
        __ui.switch(id);
        const slots = Array.from(document.querySelectorAll('#moves .move'));
        result.push({
          id,
          keys: slots.filter((e) => !e.classList.contains('jjUtility')).map((e) => e.dataset.key),
          allNamed: slots.every((e) =>
            e.getAttribute('aria-label').includes(e.querySelector('.name').textContent)
          )
        });
      }
      return result;
    });
    assert.ok(report.roster.every((r) => r.allNamed && r.keys.includes('1') && r.keys.includes('R')));
    await page.evaluate(() => {
      __ui.switch('todo');
      JJTODO.charge = 100;
      __ui.tick();
    });
    assert.match(await page.locator('#jjTodoHud').innerText(), /F \/ G/);
    await page.evaluate(() => {
      __ui.switch('mahito');
      JJMAHITO.charge = 100;
      __ui.tick();
    });
    assert.equal(await page.locator('#jjMahitoHud').isVisible(), true);
    assert.equal(await page.locator('#jjTodoHud').isVisible(), false);
    report.layouts = [];
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 390, height: 844 },
      { width: 844, height: 390 }
    ]) {
      await page.setViewportSize(viewport);
      await page.locator('#jjTop-settings').click();
      await page.locator('#jjSettings-performance').click();
      const checks = await page.evaluate(() => {
        const visibleInside = (sel) =>
          Array.from(document.querySelectorAll(sel))
            .filter((e) => e.getClientRects().length)
            .every((e) => {
              const r = e.getBoundingClientRect();
              return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1;
            });
        return {
          panel: visibleInside('#menu .menu-shell'),
          nav: visibleInside('#jjStudioTopbar'),
          toggle: visibleInside('#jjPotatoMode'),
          footer: visibleInside('#menuFight')
        };
      });
      assert.ok(Object.values(checks).every(Boolean), JSON.stringify({ viewport, checks }));
      await page.screenshot({ path: path.join(out, `studio-settings-${viewport.width}.png`) });
      await page.locator('#jjMenuClose').click();
      await page.evaluate(() => {
        __ui.tick();
        __ui.draw();
      });
      const hud = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll('#moves .move:not(.jjUtility),#jjMahitoHud,#jjStudioGauges')
        ).every((e) => {
          const r = e.getBoundingClientRect();
          return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
        })
      );
      assert.ok(hud, 'HUD must fit viewport ' + viewport.width);
      report.layouts.push({ viewport, ...checks, hud });
    }
    await page.reload();
    await page.waitForFunction(() => window.JJSTUDIOUI && window.__ui);
    assert.equal(await page.evaluate(() => JJPOTATO.enabled), true, 'Potato preference survives reload');
    report.errors = errors;
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'studio-ui-tests.json'), JSON.stringify(report, null, 2));
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
