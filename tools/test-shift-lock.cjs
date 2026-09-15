/* Browser input integration: PLAYWRIGHT_MODULE may point to a bundled Playwright.
   Run node tools/build-jujutsu.js, then node tools/test-shift-lock.cjs. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const hooks = `
window.__st={camera,renderer,player,keys,
  reset(){clearMovement();player.action=null;player.attackT=0;player.dead=false;player.react=null;
    player.frameT=0;player.stunT=0;player.vel.set(0,0,0);player.pos.set(0,0,0);player.onGround=true;},
  tick(){for(let i=0;i<50;i++)updatePlayer(.02);},
  draw(){for(let i=0;i<30;i++)updateCamera(.02);scene.updateMatrixWorld(true);renderer.render(scene,camera);},
  state(){return {locked:document.pointerLockElement===renderer.domElement,yaw:camYaw,pitch:camPitch,
    facing:player.facing,shoulder:camShoulder,speed:Math.hypot(player.vel.x,player.vel.z),sprinting,
    dragging:JJSHIFT.dragging,punches:this.punches};},punches:0,
  online(){MPJJ.relay={pub(){}};MPJJ.code='TEST';MPJJ.name='TEST';MPJJ.host=true;
    document.getElementById('jjLobby').style.display='flex';document.getElementById('jjRoomBox').style.display='block';}
};
const testPunch=punch;punch=function(){__st.punches++;return testPunch.apply(this,arguments);};`;
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/__test') {
    let html = fs.readFileSync(path.join(root, 'jujutsu-multiplayer.html'), 'utf8');
    html = html.replace('<head>', '<head><script>requestAnimationFrame=function(){return 0;};</script>');
    const end = html.lastIndexOf('</script>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html.slice(0, end) + hooks + html.slice(end)); return;
  }
  const file = path.resolve(root, '.' + decodeURIComponent(pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8');
  fs.createReadStream(file).pipe(res);
});
const angle = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [], report = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/__test'); await page.waitForFunction(() => !!window.__st);
    await page.click('#menuFight');
    const state = () => page.evaluate(() => __st.state());
    const waitLock = on => page.waitForFunction(on => !!document.pointerLockElement === on, on);
    assert.equal((await state()).locked, false);
    assert.equal(await page.locator('#jjShiftLock').getAttribute('aria-pressed'), 'false');
    const initial = await state();
    await page.mouse.move(750, 500); await page.mouse.move(810, 500);
    assert.equal((await state()).yaw, initial.yaw, 'free cursor must not turn camera');
    await page.mouse.down({ button: 'right' }); await page.mouse.move(900, 520);
    assert.ok(Math.abs((await state()).yaw - initial.yaw) > .1, 'right drag turns camera');
    await page.mouse.up({ button: 'right' });
    const released = await state(); await page.mouse.move(960, 520);
    assert.equal((await state()).yaw, released.yaw, 'release right mouse stops orbiting');
    assert.equal(released.dragging, false);
    report.push('Free cursor and right-mouse orbit/release work in training');

    await page.keyboard.down('ShiftLeft'); await waitLock(true);
    await page.keyboard.down('ShiftLeft'); // native repeat must not toggle back
    assert.equal((await state()).locked, true); await page.keyboard.up('ShiftLeft');
    assert.equal(await page.locator('#jjShiftLock').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#crosshair').isVisible(), true);
    const beforeLook = await state(); await page.mouse.move(1040, 530);
    assert.ok(Math.abs((await state()).yaw - beforeLook.yaw) > .01, 'locked mouse turns camera');
    await page.evaluate(() => { __st.reset(); __game.setCam(1, .2); });
    await page.keyboard.down('KeyA'); await page.evaluate(() => { __st.tick(); __st.draw(); }); await page.keyboard.up('KeyA');
    const strafe = await state();
    assert.ok(angle(strafe.facing, 1 + Math.PI) < .01, 'locked strafe faces the camera direction');
    assert.ok(strafe.shoulder > 1.6, 'locked camera moves over shoulder');
    await page.keyboard.press('ShiftRight'); await waitLock(false);
    assert.equal(await page.locator('#menu').isVisible(), false, 'unlock keeps game running');
    assert.equal(await page.locator('#crosshair').isVisible(), false);
    const punches = (await state()).punches;
    await page.mouse.click(900, 540);
    assert.equal((await state()).locked, false, 'click must not recapture free cursor');
    assert.equal((await state()).punches, punches + 1, 'unlocked left click still attacks');
    await page.evaluate(() => { __st.reset(); __game.setCam(1, .2); });
    await page.keyboard.down('KeyA'); await page.evaluate(() => { __st.tick(); __st.draw(); }); await page.keyboard.up('KeyA');
    const freeWalk = await state();
    assert.ok(angle(freeWalk.facing, 1 + Math.PI) > 1, 'unlocked walking turns character toward movement');
    assert.ok(freeWalk.shoulder < .01, 'unlocked camera recenters');
    report.push('Both Shift keys toggle; repeats ignored; camera, facing and reticle follow actual lock');

    await page.evaluate(() => __st.reset());
    await page.keyboard.down('KeyW'); await page.evaluate(() => __st.tick());
    assert.ok((await state()).speed < 7.3, 'single W walks');
    await page.keyboard.up('KeyW');
    await page.evaluate(() => __st.reset());
    await page.keyboard.press('KeyW'); await page.keyboard.down('KeyW'); await page.evaluate(() => __st.tick());
    assert.ok((await state()).speed > 13, 'double W sprints'); await page.keyboard.up('KeyW');
    assert.equal((await state()).sprinting, false);
    report.push('Double-tap W sprints until released');

    const beforeButton = (await state()).punches;
    await page.click('#jjShiftLock'); await waitLock(true);
    assert.equal((await state()).punches, beforeButton, 'lock button must not attack');
    await page.keyboard.press('Escape'); await waitLock(false);
    assert.equal(await page.locator('#menu').isVisible(), false, 'first Escape releases cursor');
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#menu').isVisible(), true);
    await page.click('#jjOnline'); await page.locator('#jjName').fill('');
    await page.locator('#jjName').focus(); await page.keyboard.down('Shift'); await page.keyboard.type('abc'); await page.keyboard.up('Shift');
    assert.equal((await state()).locked, false, 'typing Shift in lobby must not capture mouse');
    await page.click('#jjBack'); await page.click('#menuFight');
    await page.keyboard.down('KeyW'); await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal(await page.evaluate(() => __st.keys.KeyW), false, 'focus loss clears held movement');
    await page.keyboard.up('KeyW');
    report.push('HUD buttons, Escape/menu, lobby typing and focus-loss cleanup work');

    await page.evaluate(() => __st.online()); await page.click('#jjFight');
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => MPJJ.active), true);
    assert.equal((await state()).locked, false, 'online entry respects free cursor');
    await page.click('#jjShiftLock'); await waitLock(true);
    await page.keyboard.press('ShiftLeft'); await waitLock(false);
    // Let the multiplayer watchdog run; it previously re-covered every unlock.
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#jjLook').isVisible(), false);
    assert.equal(await page.locator('#menu').isVisible(), false);
    const onlineYaw = (await state()).yaw;
    await page.mouse.move(900, 500); await page.mouse.down({ button: 'right' }); await page.mouse.move(1000, 510); await page.mouse.up({ button: 'right' });
    assert.ok(Math.abs((await state()).yaw - onlineYaw) > .1);
    report.push('Online entry, toggle and free-camera mode share the training controls without an overlay');
    await page.close();

    const denied = await browser.newPage(); denied.on('pageerror', e => errors.push(e.message));
    await denied.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = () => Promise.reject(new DOMException('Blocked by frame', 'SecurityError')); });
    await denied.goto(base + '/__test'); await denied.waitForFunction(() => !!window.__st); await denied.click('#menuFight');
    await denied.keyboard.press('Shift'); await denied.waitForFunction(() => JJSHIFT.blocked);
    assert.equal(await denied.locator('#jjShiftLock').getAttribute('aria-pressed'), 'false');
    assert.equal(await denied.locator('#menu').isVisible(), false);
    const deniedYaw = await denied.evaluate(() => __st.state().yaw);
    await denied.mouse.move(700, 350); await denied.mouse.down({ button: 'right' }); await denied.mouse.move(800, 350); await denied.mouse.up({ button: 'right' });
    assert.ok(Math.abs(await denied.evaluate(() => __st.state().yaw) - deniedYaw) > .1);
    report.push('Browser-denied lock reports OFF and preserves right-drag fallback without uncaught errors');
    await denied.close();

    for (const entry of ['/jujutsu-multiplayer.html', '/jujutsu-parts/index.local.html']) {
      const smoke = await browser.newPage(); smoke.on('pageerror', e => errors.push(e.message));
      await smoke.goto(base + entry); await smoke.waitForFunction(() => !!window.MPJJ);
      await smoke.click('#menuFight'); await smoke.click('#jjShiftLock');
      await smoke.waitForFunction(() => JJSHIFT.active); await smoke.keyboard.press('Shift');
      await smoke.waitForFunction(() => !document.pointerLockElement);
      assert.equal(await smoke.locator('#menu').isVisible(), false); await smoke.close();
    }
    report.push('Standalone and split production builds pass real pointer-lock smoke tests');
    assert.deepEqual(errors, []); console.log(JSON.stringify({ passed: report, errors }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
