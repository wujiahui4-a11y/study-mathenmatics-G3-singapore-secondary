'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.JJS_ARTIFACT_DIR||path.join(root,'work/jjs-test'));
fs.mkdirSync(out,{recursive:true});
const hook=`window.__jt={THREE,scene,camera,renderer,player,enemies,keys,CHARS,collideWorld,worldFloor,resolveActorWorld,updateCamera,swap(id){started=false;switchChar(id,true);started=true;},
 reset(){started=true;menu.style.display='none';player.action=null;player.dead=false;player.hp=player.maxHp;player.react=null;player.frameT=0;player.__jjsLast=null;player.vel.set(0,0,0);player.onGround=false;},
 tick(dt){updatePlayer(dt);for(let i=fx.length-1;i>=0;i--)if(!fx[i].update(dt))fx.splice(i,1);},
 draw(pos,look){camera.position.set(...pos);camera.lookAt(...look);camera.updateProjectionMatrix();scene.updateMatrixWorld(true);renderer.render(scene,camera);},
 hide(){document.querySelectorAll('body > :not(canvas):not(script)').forEach(e=>e.style.visibility='hidden');}
};`;
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/__test'){
  let html=fs.readFileSync(path.join(root,'jujutsu-multiplayer.html'),'utf8');html=html.replace('<head>','<head><script>requestAnimationFrame=function(){return 0;};</script>');const end=html.lastIndexOf('</script>');html=html.slice(0,end)+hook+html.slice(end);res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;
 }
 const file=path.resolve(root,'.'+decodeURIComponent(pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'application/octet-stream');fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errors=[],report={};
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/__test');await page.waitForFunction(()=>!!window.__jt);
  await page.click('#jjTab-settings');
  await page.click('#jjSettings-general');
  await page.selectOption('#jjTrainingMap','jjs');
  assert.equal(await page.locator('#jjMaps button.on').getAttribute('data-map'),'jjs','training and lobby selections agree');
  await page.evaluate(()=>JJJJS.ready);
  report.audit=await page.evaluate(()=>JJMAP.audit());assert.equal(report.audit.parts,13499);assert.equal(report.audit.spawns,9);assert.ok(report.audit.drawGroups<120);assert.ok(report.audit.exportedTextures>=100);assert.equal(report.audit.customMeshTriangles,9999);
  const expected=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'jujutsu/jjs/source.json.gz')))).parts.filter(p=>!p.path.startsWith('Workspace.Map.Data.'));
  const exported=await page.evaluate(()=>JJJJS.data.parts.map(p=>p.slice(0,18)));
  assert.deepEqual(exported,expected.map(p=>[...p.cf,...p.size,...p.color]));report.exactGeometry='All 13,499 transforms, dimensions and colors match the Studio export exactly';
  report.spawns=await page.evaluate(()=>Array.from({length:9},(_,i)=>{const p=JJMAP.spawn(i),y=JJMAP.floor(p,p.y+.05),before={...p};JJMAP.collide(p,1);return {...p,support:y,shift:Math.hypot(p.x-before.x,p.z-before.z)};}));
  for(const p of report.spawns){assert.ok(Number.isFinite(p.y));assert.ok(Math.abs(p.support-p.y)<.03);assert.ok(p.shift<.1,'spawn obstructed');}
  report.surfaces=await page.evaluate(()=>{
   const h=__jt,D=JJJJS.data,out={};
   for(const kind of ['roof','underground']){
    const candidates=D.parts.filter(p=>p[12]>12&&p[14]>12&&p[13]<3&&p[7]>.99&&(kind==='roof'?p[1]>45&&p[1]<140:p[1]<8&&p[1]>-80));
    for(const a of candidates){const p={x:a[0],y:a[1]-D.origin[1]+a[13]/2,z:a[2]},y=JJMAP.floor(p,p.y+.04),c=JJMAP.ceiling(p,y+.1);if(!Number.isFinite(y)||Math.abs(y-p.y)>.1||c-y<6)continue;
     h.reset();h.player.pos.set(p.x,y+3,p.z);for(let i=0;i<80;i++)h.tick(.025);out[kind]={point:p,expected:y,actual:h.player.pos.y,onGround:h.player.onGround};break;
    }
   }return out;
  });
  for(const kind of ['roof','underground']){assert.ok(report.surfaces[kind],kind+' test location');assert.ok(Math.abs(report.surfaces[kind].actual-report.surfaces[kind].expected)<.06,kind+' landing height');assert.ok(report.surfaces[kind].onGround);}
  report.elevatedHanami=await page.evaluate(point=>{__jt.reset();__jt.swap('hanami');__jt.player.pos.set(point.x,point.y,point.z);JJHANAMI.cast('hn3');for(let i=0;i<25;i++)__jt.tick(.025);const props=JJHANAMI.props.filter(p=>p.owner&&!p.dead);return {height:point.y,propHeights:props.map(p=>p.group.position.y)};},report.surfaces.roof.point);
  assert.ok(report.elevatedHanami.propHeights.some(y=>Math.abs(y-report.elevatedHanami.height)<3),'Hanami branch follows rooftop height');
  report.wall=await page.evaluate(()=>{
   const D=JJJJS.data,p=D.parts.find(p=>(p[21]&1)&&p[12]<2&&p[13]>10&&p[14]>15&&p[1]>25&&p[1]<90);
   const from=new __jt.THREE.Vector3(p[0]+p[3]*8,p[1]-D.origin[1],p[2]+p[9]*8),to=new __jt.THREE.Vector3(p[0]-p[3]*8,p[1]-D.origin[1],p[2]-p[9]*8);
   return {fraction:JJJJS.ray(from,to,.3)};
  });assert.ok(report.wall.fraction<.7&&report.wall.fraction>0);
  await page.evaluate(()=>{__jt.reset();const p=JJMAP.spawn(2);__jt.player.pos.set(p.x,p.y,p.z);});
  await page.keyboard.down('KeyW');await page.evaluate(()=>{for(let i=0;i<120;i++)__jt.tick(1/60);});await page.keyboard.up('KeyW');
  const moved=await page.evaluate(()=>({y:__jt.player.pos.y,ground:__jt.player.onGround,pos:__jt.player.pos.toArray()}));assert.ok(Number.isFinite(moved.y));report.movement=moved;
  await page.evaluate(()=>{__jt.reset();__jt.player.pos.set(0,-200,0);__jt.tick(.016);});assert.ok(await page.evaluate(()=>__jt.player.pos.y>-100),'void respawn');
  const peer=await browser.newPage();peer.on('pageerror',e=>errors.push(e.message));await peer.goto(base+'/__test');await peer.waitForFunction(()=>!!window.__jt);
  await peer.evaluate(()=>{MPJJ.active=true;MPJJ.id='guest';MPJJ.host=false;MPJJ.receive({t:'map',id:'host',map:'jjs'});});assert.equal(await peer.evaluate(()=>JJMAP.id),'jjs');
  await peer.evaluate(()=>{MPJJ.host=true;MPJJ.receive({t:'map',id:'guest',map:'plate'});});assert.equal(await peer.evaluate(()=>JJMAP.id),'jjs');report.multiplayer='Host map selection synchronized; guests cannot change host map';await peer.close();
  await page.evaluate(()=>{__jt.hide();__jt.player.rig.root.visible=false;for(const e of __jt.enemies)e.rig.root.visible=false;__jt.camera.fov=58;__jt.draw([420,410,580],[0,20,80]);});
  await page.screenshot({path:path.join(out,'jjs-overview.png')});
  await page.evaluate(()=>{__jt.camera.fov=70;__jt.draw([37,79,47],[17,2,-14]);});
  await page.screenshot({path:path.join(out,'jjs-source-view.png')});
  report.render=await page.evaluate(()=>__jt.renderer.info.render);
  await page.evaluate(()=>{for(let i=0;i<3;i++){JJMAP.load('plate');JJMAP.load('jjs');}JJMAP.load('plate');});assert.equal(await page.evaluate(()=>__jt.scene.getObjectByName('JJS')===undefined),true);
  assert.equal(await page.evaluate(()=>__jt.worldFloor(new __jt.THREE.Vector3(0,15,0),15)),0);report.cleanup='Repeated map switching disposes the city and restores flat-floor mode';
  const smoke=await browser.newPage();smoke.on('pageerror',e=>errors.push(e.message));await smoke.goto(base+'/jujutsu-parts/index.local.html?map=jjs');await smoke.waitForFunction(()=>window.JJMAP&&JJMAP.id==='jjs'&&window.MPJJ);assert.equal(await smoke.evaluate(()=>MPJJ.map),'jjs');await smoke.close();
  assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync(path.join(out,'jjs-tests.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
