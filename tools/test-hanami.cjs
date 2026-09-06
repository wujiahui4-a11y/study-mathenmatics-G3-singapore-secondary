/* Browser integration checks; npm install --no-save playwright, then
   node tools/test-hanami.cjs. Uses installed Chrome, or HANAMI_BROWSER.
   Test-only hooks are injected by this local server, never into a build. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const artifacts = path.resolve(process.env.HANAMI_ARTIFACT_DIR || path.join(root, 'work', 'hanami-test-results'));
fs.mkdirSync(artifacts, { recursive: true });
const hooks = `
window.__ht={THREE,scene,camera,renderer,player,enemies,cds,CHARS,JOINTS,
  pose:(r,a)=>poseAction(r,a),rig:()=>makeAnimeRig(CHARS.hanami.cfg),
  hurt:(n,k)=>hurtPlayer(n,k),
  frame(dt,actors=false){updatePlayer(dt);if(actors)for(const e of enemies)e.update(dt);
    for(let i=fx.length-1;i>=0;i--)if(!fx[i].update(dt))fx.splice(i,1);updateHUD(dt);},
  swap(id){started=false;switchChar(id,true);started=true;},
  reset(){started=true;menu.style.display='none';player.dead=false;player.hp=player.maxHp;
    player.react=null;player.action=null;player.frameT=0;player.iframes=0;player.attackT=0;
    player.pos.set(0,0,0);player.vel.set(0,0,0);player.onGround=true;player.facing=0;camYaw=Math.PI;
    for(const k in cds)cds[k]=0;
    for(const e of enemies){if(window.JJGORE)JJGORE.clear(e);if(window.JJRAG)JJRAG.stop(e);
      e.pos.set(85,0,85);e.rig.root.position.copy(e.pos);e.vel.set(0,0,0);e.dead=false;e.hp=e.maxHp=1000;e.react=null;e.stunT=0;e.anchorT=0;e.lockT=0;e.__death=null;resetPose(e.rig);e.rig.body.rotation.set(0,0,0);}
  },
  target(x=0,z=6,y=0,hp=1000){let e=enemies.find(e=>!e.net);e.pos.set(x,y,z);e.rig.root.position.copy(e.pos);e.hp=e.maxHp=hp;e.dead=false;e.vel.set(0,0,0);return e;},
  draw(pos,look){scene.updateMatrixWorld(true);camera.position.set(...pos);camera.lookAt(...look);camera.updateProjectionMatrix();renderer.render(scene,camera);},
  hud(on){document.querySelectorAll('body > :not(canvas):not(script)').forEach(e=>e.style.visibility=on?'':'hidden');},
  get fxCount(){return fx.length;}
};`;
const server = http.createServer((req,res)=>{
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  if(pathname==='/__test'){
    let html=fs.readFileSync(path.join(root,'jujutsu-multiplayer.html'),'utf8');
    html=html.replace('<head>','<head><script>window.requestAnimationFrame=function(){return 0;};</script>');
    const end=html.lastIndexOf('</script>');html=html.slice(0,end)+hooks+html.slice(end);
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;
  }
  const file=path.resolve(root,'.'+(pathname==='/'?'/jujutsu-multiplayer.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,...(process.env.HANAMI_BROWSER?{executablePath:process.env.HANAMI_BROWSER}:{channel:'chrome'}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const errors=[], report={checks:[]};
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    page.on('pageerror',e=>errors.push(e.message));
    await page.clock.install();
    await page.goto(url+'/__test');await page.waitForFunction(()=>!!window.__ht,{timeout:30000});
    async function simulate(seconds,actors=false){for(let n=0;n<Math.ceil(seconds/.05);n++){
      await page.evaluate(({actors})=>window.__ht.frame(.05,actors),{actors});await page.clock.runFor(50);
    }}
    async function reset(){await simulate(5);await page.evaluate(()=>{__ht.reset();__ht.swap('hanami');__ht.frame(.01);});}
    await page.evaluate(()=>{__ht.reset();__ht.swap('hanami');__ht.frame(.01);});
    const roster=await page.evaluate(()=>({count:Object.keys(__ht.CHARS).length,keys:__ht.CHARS.hanami.moves.map(m=>m.key),portrait:__ht.CHARS.hanami.portrait.length}));
    assert.equal(roster.count,14);assert.deepEqual(roster.keys,['LMB','Q','1','2','3','4','R']);assert.ok(roster.portrait>100);
    report.roster=roster;
    const voxel=await page.evaluate(()=>{
      let meshes=0,triangles=0,cells=0;
      __ht.player.rig.root.traverse(o=>{if(!o.isMesh)return;meshes++;
        const g=o.geometry;if(!g.userData.voxel)throw Error('Non-voxel character geometry: '+o.name);
        const positions=g.attributes.position.array,normals=g.attributes.normal.array,grid=g.userData.grid;
        for(const n of positions)if(Math.abs(n/grid-Math.round(n/grid))>1e-4)throw Error('Vertex outside voxel grid');
        for(let i=0;i<normals.length;i+=3)if(Math.abs(normals[i])+Math.abs(normals[i+1])+Math.abs(normals[i+2])!==1)throw Error('Smoothed character face');
        triangles+=g.index.count/3;cells+=g.userData.cells;
      });return {meshes,triangles,cells,grid:.08};
    });assert.ok(voxel.meshes>20&&voxel.meshes<45);report.voxel=voxel;
    await page.evaluate(()=>{__ht.hud(false);for(const e of __ht.enemies)e.rig.root.visible=false;__ht.player.rig.root.rotation.y=-.2;__ht.camera.fov=34;__ht.draw([8,5.6,12],[0,3.6,0]);});
    await page.screenshot({path:path.join(artifacts,'hanami-model.png')});
    console.log('Model and roster rendered.');
    // Real key input, actual wrapped damage, cooldowns and full recovery.
    for(const [key,code,expected] of [['hn1','Digit1',34],['hn2','Digit2',30],['hn3','Digit3',32],['hn4','Digit4',38],['hnr','KeyR',10]]){
      await reset();await page.evaluate(()=>__ht.target());
      await page.keyboard.press(code);
      const first=await page.evaluate(()=>({type:__ht.player.action?.type,cd:__ht.cds[__ht.player.action?.type]}));
      assert.equal(first.type,key);assert.ok(first.cd>0);
      await simulate(2.3);
      const actual=await page.evaluate(()=>({damage:1000-__ht.enemies[0].hp,action:__ht.player.action?.type||null}));
      assert.equal(actual.damage,expected,key+' damage');assert.equal(actual.action,null,key+' recovers');
      await page.keyboard.press(code);assert.equal(await page.evaluate(()=>__ht.player.action),null,key+' respects cooldown');
      report.checks.push({key,damage:actual.damage,cooldown:true,recovery:true});
      console.log(key+': damage, cooldown and recovery passed.');
    }
    // Frontal lanes must include overlapping bodies, exclude behind and airborne misses.
    for(const key of ['hn1','hn2','hn3','hn4']){
      await reset();await page.evaluate(key=>{__ht.target(0,0);JJHANAMI.cast(key);},key);await simulate(2.3);
      assert.ok(await page.evaluate(()=>__ht.enemies[0].hp<1000),key+' point blank');
      await reset();await page.evaluate(key=>{__ht.target(0,-8);JJHANAMI.cast(key);},key);await simulate(2.3);
      assert.equal(await page.evaluate(()=>__ht.enemies[0].hp),1000,key+' behind');
      await reset();await page.evaluate(key=>{__ht.target(0,6,20);JJHANAMI.cast(key);},key);await simulate(2.3);
      assert.equal(await page.evaluate(()=>__ht.enemies[0].hp),1000,key+' high target');
    }
    report.checks.push({collision:'point blank, rear, airborne and swept buds'});
    await reset();await page.evaluate(()=>{__ht.target(0,29);JJHANAMI.cast('hn2');});await simulate(2.3);
    assert.equal(await page.evaluate(()=>1000-__ht.enemies[0].hp),30,'all three buds complete their full flight');
    // The source of each killing hit must select its corresponding finisher.
    for(const [key,name] of [['hn1','FOREST COFFIN'],['hn2','PARASITIC BLOOM'],['hn3','RETURN TO EARTH'],['hn4','LAST FLOWERING']]){
      await reset();await simulate(8);
      await page.evaluate(key=>{__ht.reset();__ht.target(0,6,0,1);JJHANAMI.cast(key);},key);
      await simulate(key==='hn4'?1.05:.65);
      const fin=await page.evaluate(key=>({name:JJFIN.nameOf(key),action:__ht.player.action?.fin}),key);
      assert.equal(fin.name,name);assert.equal(fin.action,'hanami_'+key);
      await simulate(4);
      assert.equal(await page.evaluate(()=>__ht.enemies[0].dead),true,key+' finishes target');
      report.checks.push({finisher:name,lethalHit:true});
    }
    assert.equal(await page.evaluate(()=>JJFIN.nameOf('hnr')),null);
    // Defensive field, cast interruption, switching and zero persistent props.
    await reset();await page.evaluate(()=>JJHANAMI.cast('hnr'));await simulate(.65);
    const guarded=await page.evaluate(()=>{__ht.player.hp=100;__ht.hurt(20,new __ht.THREE.Vector3());return __ht.player.hp;});
    assert.equal(guarded,87);
    await page.evaluate(()=>__ht.swap('gojo'));assert.equal(await page.evaluate(()=>JJHANAMI.props.filter(e=>e.owner).length),0);
    await reset();await page.evaluate(()=>{JJHANAMI.cast('hn4');__ht.frame(.1);__ht.player.action=null;});await simulate(3);
    assert.equal(await page.evaluate(()=>JJHANAMI.props.length),0);
    report.checks.push({fieldReduction:'35%',switchCleanup:true,interruptionCleanup:true});
    // All network poses must be reconstructible with only the serialized fields.
    const poses=await page.evaluate(()=>{
      const r=__ht.rig(),out=[];
      for(const key of Object.keys(JJHANAMI.kit))for(const t of [.15,.4,.7,1]){
        __ht.pose(r,{type:key,t,dur:JJHANAMI.kit[key].dur});
        for(const j of __ht.JOINTS)if(![r[j].rotation.x,r[j].rotation.y,r[j].rotation.z].every(Number.isFinite))throw Error('NaN '+key);
        out.push(r.spine.rotation.x+r.shoulderR.rotation.x+r.shoulderL.rotation.z);
      }return out;
    });assert.ok(new Set(poses.map(x=>x.toFixed(3))).size>12);
    const remote=await browser.newPage({viewport:{width:960,height:720}});remote.on('pageerror',e=>errors.push(e.message));
    await remote.clock.install();await remote.goto(url+'/__test');await remote.waitForFunction(()=>!!window.__ht);
    await remote.evaluate(()=>{__ht.reset();MPJJ.active=true;MPJJ.id='watcher';MPJJ.receive({t:'hi2',id:'caster',n:'Hanami',c:'hanami'});});
    for(const key of Object.keys({hn1:1,hn2:1,hn3:1,hn4:1,hnr:1})){
      await reset();await page.evaluate(()=>{window.__sent=[];MPJJ.active=true;MPJJ.id='caster';MPJJ.relay={pub:m=>__sent.push(m)};});
      await page.evaluate(key=>JJHANAMI.cast(key),key);await simulate(.15);
      const packets=await page.evaluate(()=>__sent.splice(0));
      assert.equal(packets.filter(p=>p.t==='cast'&&p.k===key).length,1,key+' single announcement');
      const result=await remote.evaluate(({packets,key})=>{
        const before=JJHANAMI.props.length,hp=__ht.player.hp;
        // Deliver state first, then the cast, as a late packet would be replayed.
        packets.filter(p=>p.t==='s').forEach(p=>MPJJ.receive(p));packets.filter(p=>p.t==='cast').forEach(p=>MPJJ.receive(p));
        for(let i=0;i<24;i++)__ht.frame(.05);
        return {props:JJHANAMI.props.length-before,hpBefore:hp,hpAfter:__ht.player.hp,char:MPJJ.fighters.caster.char};
      },{packets,key});
      assert.ok(result.props>0,key+' remote VFX');assert.equal(result.hpAfter,result.hpBefore,key+' remote is visual only');assert.equal(result.char,'hanami');
      await remote.evaluate(()=>{for(let i=0;i<130;i++)__ht.frame(.05);});
      assert.equal(await remote.evaluate(()=>JJHANAMI.props.length),0,key+' remote cleanup');
      await page.evaluate(()=>{MPJJ.active=false;MPJJ.relay=null;});
    }
    report.checks.push({multiplayer:'5 casts announced once, replayed without duplicate damage, cleaned up'});
    for(const key of ['hn1','hn2','hn3','hn4']){
      const finRemote=await remote.evaluate(key=>{
        const p=__ht.player,hp=p.hp,e=MPJJ.fighters.caster.e;p.action=null;
        JJFIN.remote(e,key,e.pos,new __ht.THREE.Vector3(0,0,1),true);
        __ht.pose(e.rig,{type:'hafin',t:.65,dur:2,fin:'hanami_'+key});
        const rotation=e.rig.spine.rotation.x+e.rig.shoulderL.rotation.x+e.rig.shoulderR.rotation.x;
        for(let i=0;i<10;i++)__ht.frame(.05);
        return {hp:p.hp,before:hp,action:p.action,rotation,props:JJHANAMI.props.length};
      },key);
      assert.equal(finRemote.hp,finRemote.before);assert.equal(finRemote.action,null);assert.ok(Math.abs(finRemote.rotation)>.05);assert.ok(finRemote.props>0);
      await remote.evaluate(()=>{for(let i=0;i<130;i++)__ht.frame(.05);});
    }
    report.checks.push({remoteFinishers:'4 named poses and effects; spectator control and health preserved'});
    // A consistent front three-quarter view and the four technique shapes.
    await reset();await simulate(15);await page.evaluate(()=>{__ht.hud(false);for(const e of __ht.enemies)e.rig.root.visible=false;__ht.player.rig.root.rotation.y=-.2;__ht.camera.fov=34;__ht.draw([8,5.6,12],[0,3.6,0]);});
    await page.screenshot({path:path.join(artifacts,'hanami-model.png')});
    for(const [key,time] of [['hn1',.8],['hn2',.82],['hn3',.67],['hn4',1.12],['hnr',.9]]){
      await reset();await page.evaluate(key=>{__ht.target();JJHANAMI.cast(key);},key);await simulate(time);
      await page.evaluate(()=>__ht.draw([19,14,25],[0,2.7,10]));await page.screenshot({path:path.join(artifacts,key+'.png')});
    }
    // Actual generated entry points also boot without the test injection.
    for(const entry of ['/jujutsu-multiplayer.html','/jujutsu-parts/index.local.html']){
      const smoke=await browser.newPage();smoke.on('pageerror',e=>errors.push(e.message));await smoke.goto(url+entry);
      await smoke.locator('.roster-card[data-char="hanami"]').waitFor();await smoke.locator('.roster-card[data-char="hanami"]').click();
      assert.equal(await smoke.evaluate(()=>__game.player.char),'hanami');await smoke.close();
    }
    assert.deepEqual(errors,[],'browser runtime errors');report.errors=errors;
    fs.writeFileSync(path.join(artifacts,'hanami-test-results.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally {await browser.close();server.close();}
}
main().catch(error=>{console.error(error);server.close();process.exitCode=1;});
