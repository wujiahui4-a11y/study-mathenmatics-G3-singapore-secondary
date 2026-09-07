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
  .match(/core\s*\+\s*`([\s\S]*?)`;/)[1];
let html = fs
  .readFileSync(path.join(root, 'jujutsu-multiplayer.html'), 'utf8')
  .replace('<head>', '<head><script>requestAnimationFrame=function(){return 0;};</script>');
const end = html.lastIndexOf('</script>');
html = html.slice(0, end) + core + ai + html.slice(end);
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html;charset=utf-8');
  res.end(html);
});
async function drain(page, filter) {
  return page.evaluate((filter) => {
    const all = __packets.splice(0);
    return filter ? all.filter((m) => m.t === filter) : all;
  }, filter);
}
async function deliver(page, packets) {
  await page.evaluate((messages) => messages.forEach((m) => MPJJ.receive(m)), packets);
}
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
    const host = await browser.newPage(),
      guest = await browser.newPage();
    for (const p of [host, guest]) {
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto('http://127.0.0.1:' + server.address().port);
      await p.waitForFunction(() => window.__ai);
      await p.clock.install();
    }
    const hello = await host.evaluate(() => {
      MPJJ.host = true;
      __fight.online();
      __ai.start(4, 112);
      __ai.isolate();
      __fight.player.pos.set(-80, 0, -80);
      return { t: 'hi2', id: MPJJ.id, n: 'HOST', c: 'gojo', host: true, map: 'plate' };
    });
    await guest.evaluate(() => {
      __fight.reset();
      MPJJ.host = false;
      __fight.online();
    });
    await deliver(guest, [hello, ...(await drain(host))]);
    report.join = await guest.evaluate(() => ({
      authority: JJAISERVER.authority,
      count: JJAISERVER.bots.length,
      remote: JJAISERVER.bots.every((e) => e.ai.remote)
    }));
    assert.equal(report.join.count, 4);
    assert.ok(report.join.remote && !report.join.authority);
    assert.match(await guest.locator('#jjAIHud .aiCount').innerText(), /^4 AI FIGHTERS/);
    const guestState = await guest.evaluate(() => {
      __fight.tick(6);
      return __packets.filter((m) => m.t === 's').at(-1);
    });
    await deliver(host, [guestState]);
    await host.evaluate(() => {
      const e = JJAISERVER.bots[0];
      __ai.place(e, 0, 0, 3.5);
      e.facing = Math.PI;
      e.blocking = false;
      __fight.tick(8, 0.02, true);
    });
    const poses = await drain(host, 'ai-state');
    await deliver(guest, poses);
    await guest.evaluate(() => {
      __fight.tick(30, 0.02, true);
      __fight.punch();
      __fight.tick(16, 0.02, true);
    });
    const hits = await drain(guest, 'ai-hit-bot');
    assert.ok(hits.length > 0, 'A real guest M1 produces a host-directed AI hit');
    await deliver(host, hits);
    report.guestHit = await host.evaluate(() => ({
      hp: JJAISERVER.bots[0].hp,
      target: JJAISERVER.bots[0].ai.target?.net?.id
    }));
    assert.ok(report.guestHit.hp < 99);
    assert.equal(report.guestHit.target, guestState.id);
    await deliver(
      host,
      hits.map((m) => ({ ...m, seq: m.seq + 1000 }))
    );
    assert.equal(
      await host.evaluate(() => JJAISERVER.bots[0].hp),
      report.guestHit.hp,
      'The same swing cannot damage a bot twice'
    );
    // Guests cannot run AI decisions or overwrite the authoritative actors.
    const forged = { ...poses.at(-1), id: guestState.id, seq: 100000 };
    await deliver(host, [forged]);
    assert.ok(await host.evaluate(() => JJAISERVER.authority));
    // Actual human guard state is respected by the owning browser.
    const defense = await guest.evaluate(() => {
      JJFIGHT.reset();
      __fight.player.action = null;
      __fight.player.pos.set(0, 0, 0);
      __fight.player.hp = 100;
      __fight.player.stunT = 0;
      JJFIGHT.guard(true);
      __fight.tick(6);
      return __packets.filter((m) => m.t === 's').at(-1);
    });
    await deliver(host, [defense]);
    await host.evaluate((id) => {
      __ai.isolate();
      const e = JJAISERVER.bots[0],
        t = MPJJ.fighters[id].e;
      __ai.place(e, 0, 0, 3.5);
      t.pos.set(0, 0, 0);
      e.ai.target = t;
      JJAICOMBAT.m1(e, t);
      __fight.tick(16, 0.02, true);
    }, guestState.id);
    await deliver(guest, await drain(host));
    report.guard = await guest.evaluate(() => __fight.player.hp);
    assert.equal(report.guard, 100);
    await deliver(host, await drain(guest));
    assert.equal(await host.evaluate(() => JJAISERVER.bots[0].ai.confirm), false);
    // A kill acknowledgement starts revenge only on the host, exactly once.
    const vulnerable = await guest.evaluate(() => {
      JJFIGHT.guard(false);
      __fight.player.hp = 1;
      __fight.player.stunT = 0;
      __fight.tick(6);
      return __packets.filter((m) => m.t === 's').at(-1);
    });
    await deliver(host, [vulnerable]);
    await host.evaluate((id) => {
      const e = JJAISERVER.bots[0],
        t = MPJJ.fighters[id].e;
      e.action = null;
      e.ai.m1CD = 0;
      e.ai.revenge = 'human:' + id;
      e.ai.target = t;
      __ai.place(e, 0, 0, 2);
      JJAICOMBAT.m1(e, t);
      __fight.tick(16, 0.02, true);
    }, guestState.id);
    await deliver(guest, await drain(host));
    const ack = await drain(guest, 'ai-hit-result');
    assert.ok(ack.some((m) => m.dead));
    await deliver(host, ack);
    await deliver(host, ack);
    report.revenge = await host.evaluate(() => {
      const e = JJAISERVER.bots[0];
      return {
        kills: e.ai.kills,
        taunt: !!e.ai.taunt,
        victimDead: e.ai.taunt && MPJJ.fighters[e.ai.taunt.victim.slice(6)].e.dead
      };
    });
    assert.deepEqual(report.revenge, { kills: 1, taunt: true, victimDead: true });
    await host.evaluate(() => __fight.tick(190, 0.02, true));
    assert.ok(await host.evaluate(() => JJAISERVER.bots[0].ai.history.includes('walk away after revenge')));
    // Snapshot ordering, death poses, knockdown protection, and every technique pose.
    await host.evaluate(() => {
      const e = JJAISERVER.bots[1];
      e.ai.lastAttacker = JJAISERVER.bots[0].ai.id;
      e.die();
      __fight.tick(8, 0.02, true);
    });
    const deadStates = await drain(host, 'ai-state');
    await deliver(guest, deadStates);
    report.death = await guest.evaluate(() => {
      __fight.tick(1, 0.02, true);
      const e = JJAISERVER.bots[1];
      return {
        dead: e.dead,
        hips: e.rig.hips.rotation.x,
        finite: e.rig.hips.position.toArray().every(Number.isFinite)
      };
    });
    assert.ok(report.death.dead && report.death.finite && Math.abs(report.death.hips) > 0.1);
    await deliver(guest, poses);
    assert.ok(await guest.evaluate(() => JJAISERVER.bots[1].dead), 'Old snapshots cannot resurrect actors');
    await host.evaluate(() => {
      const e = JJAISERVER.bots[2];
      JJFIGHT.actors.startFall(e, new __fight.THREE.Vector3(1, 10, 0), { down: 1.3, variant: 'up' });
      __fight.tick(8, 0.02, true);
    });
    await deliver(guest, await drain(host, 'ai-state'));
    assert.ok(await guest.evaluate(() => !!JJAISERVER.bots[2].bcFall));
    // A new epoch replaces, rather than duplicates, the old population.
    await host.evaluate(() => {
      JJAISERVER.start(8, { seed: 815 });
      __ai.isolate();
      __fight.tick(8, 0.02, true);
    });
    await deliver(guest, await drain(host, 'ai-state'));
    assert.equal(await guest.evaluate(() => JJAISERVER.bots.length), 8);
    // A late join learns the same actors through the normal hello/snapshot exchange.
    const late = await browser.newPage();
    late.on('pageerror', (e) => errors.push(e.message));
    await late.goto('http://127.0.0.1:' + server.address().port);
    await late.waitForFunction(() => window.__ai);
    await late.evaluate(() => {
      __fight.reset();
      MPJJ.host = false;
      __fight.online();
    });
    await deliver(late, [hello]);
    const lateHello = await late.evaluate(() => ({
      t: 'hi',
      id: MPJJ.id,
      n: 'LATE',
      c: 'gojo',
      host: false,
      map: 'plate'
    }));
    await deliver(host, [lateHello]);
    await deliver(late, await drain(host, 'ai-state'));
    assert.equal(await late.evaluate(() => JJAISERVER.bots.length), 8);
    await late.evaluate(() => __fight.tick(610, 0.02, true));
    assert.equal(await late.evaluate(() => JJAISERVER.active), false, 'Disconnected hosts expire');
    await host.evaluate(() => JJAISERVER.stop());
    await deliver(guest, await drain(host));
    assert.equal(await guest.evaluate(() => JJAISERVER.active), false);
    await guest.evaluate(() => JJAISERVER.newRoom());
    const newHello = { ...hello, id: 'replacement-host' };
    await deliver(guest, [newHello]);
    const newState = {
      ...deadStates.at(-1),
      id: 'replacement-host',
      epoch: 'replacement-host-1',
      seq: 1,
      bots: deadStates.at(-1).bots.map((b, i) => ({ ...b, id: 'ai:replacement-host-1:' + i }))
    };
    await deliver(guest, [newState]);
    assert.ok(
      await guest.evaluate(() => JJAISERVER.active),
      'Joining a different room clears the previous host identity'
    );
    report.lifecycle = { newEpoch: 8, lateJoin: 8, timeout: true, hostStop: true, rejoin: true };
    // The bot cast channel sends the real move type and pose. World effects
    // on the guest are visual only; damage still requires the owning peer.
    await guest.evaluate(() => {
      JJAISERVER.newRoom();
      __fight.reset();
      MPJJ.host = false;
      __fight.online();
    });
    await deliver(guest, [hello]);
    await host.evaluate(() => {
      JJAISERVER.start(14, { seed: 812 });
      __ai.isolate();
    });
    await deliver(guest, await drain(host));
    const characters = await host.evaluate(() => JJAISERVER.bots.map((e) => e.char));
    report.characterSkills = [];
    for (const char of characters)
      for (let slot = 0; slot < 5; slot++) {
        const cast = await host.evaluate(
          ({ char, slot }) => {
            __ai.isolate();
            const e = JJAISERVER.bots.find((e) => e.char === char),
              t = JJAISERVER.bots.find((t) => t !== e);
            JJAIKITS.reset(e);
            __ai.place(e, 0, 0, 0);
            __ai.place(t, 0, 0, 3);
            e.ai.target = t;
            t.hp = t.maxHp = 10000;
            __fight.player.pos.set(120, 0, 120);
            const ok = JJAICOMBAT.skill(e, t, slot);
            __fight.tick(18, 0.02, true);
            return { ok, id: e.ai.id, type: e.action?.type, mode: e.ai.mode };
          },
          { char, slot }
        );
        assert.ok(cast.ok, char + ' network cast');
        const packets = await drain(host);
        await deliver(guest, packets);
        await deliver(guest, packets);
        const mirror = await guest.evaluate(({ id }) => {
          __fight.tick(4, 0.02, true);
          const e = JJAISERVER.bots.find((e) => e.ai.id === id);
          let finite = true;
          e.rig.root.traverse((o) => {
            if (![...o.rotation.toArray().slice(0, 3), ...o.position.toArray()].every(Number.isFinite))
              finite = false;
          });
          return { type: e.action?.type, mode: e.ai.mode, finite };
        }, cast);
        assert.equal(mirror.type, cast.type);
        assert.equal(mirror.mode, cast.mode);
        assert.ok(mirror.finite, char + ' remote pose');
        report.characterSkills.push({ char, slot, ...mirror });
      }
    const targetState = await guest.evaluate(() => {
      __fight.reset();
      __fight.player.iframes = 0;
      __fight.tick(8, 0.02);
      return __packets.filter((m) => m.t === 's').at(-1);
    });
    await deliver(host, [targetState]);
    await host.evaluate((id) => {
      __ai.isolate();
      const e = JJAISERVER.bots.find((e) => e.char === 'yuji'),
        t = MPJJ.fighters[id].e;
      JJAIKITS.reset(e);
      __ai.place(e, 0, 0, -4);
      t.pos.set(0, 0, 0);
      t.dead = false;
      t.hp = 100;
      t.iframes = 0;
      e.ai.target = t;
      JJAICOMBAT.skill(e, t, 0);
      __fight.tick(50, 0.02, true);
    }, targetState.id);
    const realSkillPackets = await drain(host);
    await deliver(guest, realSkillPackets);
    report.characterDamage = await guest.evaluate(() => __fight.player.hp);
    assert.ok(report.characterDamage <= 60.1, 'Both actual Divergent Fist hits reach the remote player');
    await deliver(guest, realSkillPackets);
    assert.equal(
      await guest.evaluate(() => __fight.player.hp),
      report.characterDamage,
      'Duplicate skill packets cannot damage twice'
    );
    report.errors = errors;
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'ai-network-tests.json'), JSON.stringify(report, null, 2));
    console.log('AI Server two-browser synchronization passed', JSON.stringify(report));
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
