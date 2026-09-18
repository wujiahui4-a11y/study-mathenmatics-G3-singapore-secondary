'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
(async()=>{
 const THREE=await import('data:text/javascript;base64,'+Buffer.from(read('jujutsu/three.module.min.js')).toString('base64'));
 const raster=process.argv.includes('--render')?require(process.env.OPENING_CANVAS_MODULE||'skia-canvas'):null;
 const base=read('jujutsu/base.html'),combat=read('jujutsu/battleground-combat.js');
 function client(id='a',char='ryu') {
  const events={},effects=[],packets=[],nodes=new Map(),calls=[],hits=[];
  class Element {
   constructor(tag){this.style={};this.children=[];this.dataset={};this.classList={toggle(){},add(){},remove(){}};this.tagName=tag;if(raster&&tag==='canvas')this.canvas=new raster.Canvas(1280,720);}
   set width(n){if(this.canvas)this.canvas.width=n;}get width(){return this.canvas?.width||1280;}set height(n){if(this.canvas)this.canvas.height=n;}get height(){return this.canvas?.height||720;}
   set id(x){this._id=x;nodes.set(x,this);}get id(){return this._id;}
   appendChild(c){this.children.push(c);return c;}setAttribute(){}addEventListener(){}remove(){}
   querySelector(s){return this.children[s]||(this.children[s]=new Element(s));}
   getContext(){return this.canvas?this.canvas.getContext('2d'):new Proxy({measureText:()=>({width:10})},{get:(o,k)=>o[k]||(()=>{})});}
  }
  class Enemy {
   constructor(c='gojo',z=4){this.char=c;this.hp=this.maxHp=100;this.pos=new THREE.Vector3(0,0,z);this.vel=new THREE.Vector3();this.facing=Math.PI;this.stunT=this.iframes=0;this.dead=false;}
   damage(n,k,o={}){if(this.dead)return false;hits.push({e:this,n,k:k.clone(),o});this.hp=Math.max(0,this.hp-n);this.dead=this.hp===0;this.vel.copy(k);return true;}
   update(){}drawBars(){}respawn(){}applyReact(){}
  }
  const FX=new Proxy({ease:{out:x=>1-(1-x)**3},T:{},orb:()=>({set(){},step(){},dispose(){}}),billboard:()=>new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial()),aura:()=>({stop(){}})},
    {get:(o,k)=>o[k]||(()=>{})});
  const c={THREE,console,Math,Date,Set,Map,Number,String,Array,Uint8Array,Enemy,JJFX:FX,
   document:{createElement:t=>new Element(t),body:new Element('body'),getElementById:id=>nodes.get(id)},
   Image:raster?.Image||class {set src(v){this.srcValue=v;}},JJRYUART:require('./ryu-art.cjs')(root),matchMedia:()=>({matches:false}),
   addEventListener:(n,f)=>(events[n]||=[]).push(f),
   setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},
   CHARS:{gojo:{cfg:{face:true,skin:0xe8b98f,torso:0x222233,pants:0x222233,shoes:0x101010}},yuta:{cfg:{face:true,skin:0xe8b98f,torso:0xffffff,pants:0x222233,shoes:0x101010}}},
   cds:{m1:0},scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(50,16/9,.1,500),renderer:{render(world,cam){c.frameWorld=world;c.frameCamera=cam;}},
   started:true,paused:false,keys:{},camYaw:Math.PI,camPitch:.2,
   gameInputActive:()=>c.started&&!c.paused,typingInUI:()=>false,
   boxMesh:(w,h,d,color)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color})),
   buildCharList(){},buildMovesBar(){},makePortrait(){},clearMovement(){c.keys={};},
   addFx:f=>effects.push(f),addShake(){},hitstop(){},sfx:new Proxy({},{get:()=>()=>{}}),tone(){},noiseBurst(){},
   stepAction(){},poseAction(){},updateCamera(){},updateHUD(){},
   JJAW:{charge:0,ready:false},JJMAP:{id:'plate'},JJDESTRUCT:{settings:{enabled:false},hit:(...args)=>calls.push(args)},
   MPJJ:{active:true,code:'ROOM',id,host:id==='a',fighters:{},relay:{pub:m=>packets.push(m)}},
   camForward:()=>c.aim.clone(),aim:new THREE.Vector3(0,0,1),
   busy:()=>!!c.player.action||c.JJFIGHT.locked(),
   hurtPlayer(n,k,o){if(c.player.dead||c.player.iframes>0)return false;c.player.hp=Math.max(0,c.player.hp-n);c.player.dead=c.player.hp===0;if(k)c.player.vel.copy(k);return true;},
   updatePlayer(dt){const p=c.player;p.iframes=Math.max(0,p.iframes-dt);p.stunT=Math.max(0,p.stunT-dt);for(const k in c.cds)c.cds[k]=Math.max(0,c.cds[k]-dt);
    if(p.action){const a=p.action;a.t+=dt;c.stepAction(a,dt);if(p.action===a&&a.t>=a.dur)p.action=null;}
    p.pos.addScaledVector(p.vel,dt);p.rig.root.position.copy(p.pos);p.rig.root.rotation.y=p.facing;if(p.action)c.poseAction(p.rig,p.action);
   },
   switchChar(id){c.player.char=id;c.player.rig=c.makeAnimeRig(c.CHARS[id].cfg);c.player.action=null;}
  };
  c.window=c;vm.createContext(c);
  vm.runInContext(base.slice(base.indexOf('function makeAnimeRig(cfg)'),base.indexOf('const GOJO_CFG')),c);
  c.player=new Enemy(char,0);c.player.facing=0;c.player.char=char;c.player.rig=c.makeAnimeRig(c.CHARS.gojo.cfg);c.player.action=null;c.player.onGround=true;c.player.animT=0;
  c.enemies=[];c.JJFIGHT={locked:()=>c.player.blocking||c.player.stunT>0||c.JJRYUREWORK?.locked(),clearInput(){c.player.blocking=false;},blockFX:e=>{e.blockedCount=(e.blockedCount||0)+1;},
   actors:{visible:()=>!c.wall,sweepMove:(e,v)=>{if(c.wall)return 0;e.pos.add(v);return v.length();},startFall:(e,k)=>{e.bcFall=true;e.vel.copy(k);}}};
  c.dir=y=>new THREE.Vector3(Math.sin(y),0,Math.cos(y));
  vm.runInContext(combat.slice(combat.indexOf('  function blocked('),combat.indexOf('  function blockFX(')),c);c.JJFIGHT.blocked=c.blocked;
  vm.runInContext(read('jujutsu/yuta.js'),c);vm.runInContext(read('jujutsu/ryu.js'),c);
  c.player.rig=c.makeAnimeRig(c.CHARS[char].cfg);c.player.rig.__char=char;
  c.core=()=>false;c.cancel=()=>{};c.startFall=(e,k)=>{e.bcFall=true;e.vel.copy(k);};c.blockFX=c.JJFIGHT.blockFX;c.guardHeld=false;c.queued=0;
  vm.runInContext('(function(){'+combat.slice(combat.indexOf('  function metadata(opts)'),combat.indexOf('  function pack(a)'))+'})();',c);
  vm.runInContext(read('jujutsu/ryu-rework.js'),c);vm.runInContext(read('jujutsu/ryu-cinematic.js'),c);
  c.scene.add(c.player.rig.root);
  return {c,effects,packets,events,calls,hits,nodes,tick(dt){c.updatePlayer(dt);for(const e of c.enemies)e.update(dt);for(let j=effects.length-1;j>=0;j--)if(!effects[j].update(dt))effects.splice(j,1);c.updateCamera(dt);}};
 }
 function room(chars=['ryu','yuta','gojo'],positions=[0,4,70]) {
  const list=chars.map((s,i)=>client(String.fromCharCode(97+i),s));let dropped=()=>false;const all=[];
  list.forEach((r,i)=>{r.c.player.pos.z=positions[i];if(i===2)r.c.player.pos.x=35;r.c.player.facing=i===0?0:Math.PI;});
  for(const r of list)for(const other of list)if(r!==other){const e=new r.c.Enemy(other.c.player.char);e.net={id:other.c.MPJJ.id};e.rig=r.c.makeAnimeRig(r.c.CHARS[e.char].cfg);e.rig.__char=e.char;r.c.scene.add(e.rig.root);r.c.enemies.push(e);r.c.MPJJ.fighters[e.net.id]={id:e.net.id,char:e.char,e};}
  function sync(){for(const r of list)for(const other of list)if(r!==other){const f=r.c.MPJJ.fighters[other.c.MPJJ.id];if(!f)continue;const p=other.c.player;f.e.hp=p.hp;f.e.maxHp=p.maxHp;f.e.dead=p.dead;f.e.pos.copy(p.pos);f.e.facing=p.facing;f.e.blocking=p.blocking;f.e.iframes=p.iframes;f.action=p.action?{type:p.action.type,t:p.action.t,dur:p.action.dur}:null;r.c.JJRYUREWORK.remoteState(f,other.c.JJRYUREWORK.pack());}}
  function pump(){for(let n=0;n<6;n++){const out=list.flatMap(r=>r.packets.splice(0));if(!out.length)break;for(const m of out){all.push(m);if(dropped(m))continue;for(const r of list)if(r.c.MPJJ.id!==m.id)r.c.JJRYUREWORK.receive(JSON.parse(JSON.stringify(m)));}}}
  sync();
  return {list,all,sync,pump,drop:f=>{dropped=f;},tick(secs,dt=.02){for(let i=0;i<Math.ceil(secs/dt);i++){for(const r of list)r.tick(dt);sync();pump();}}};
 }
 const fresh=()=>{const r=client();r.c.MPJJ.active=false;r.tick(.02);return r;};
 const tick=(r,t)=>{for(let i=0;i<Math.ceil(t/.02);i++)r.tick(.02);};
 {
  const r=fresh(),c=r.c,S=c.JJRYUREWORK;
  for(const id of ['r1','r2','r3','r4']){assert.equal(S.cast(id),true);const heat=S.heat;assert.equal(S.cast(id),false);assert.equal(S.heat,heat);tick(r,2);}
  assert.equal(S.heat,80);c.cds.r1=0;S.cast('r1');tick(r,2);assert.equal(S.heat,100);
  c.JJRYUFX.look(c.player.rig,100,null);assert.equal(c.player.rig.ryuExtras.loose.visible,true);assert.ok(c.player.rig.ryuPompadour.every(m=>!m.visible));
  assert.equal(S.cast('rx_brush'),true);tick(r,.5);assert.equal(c.player.rig.ryuExtras.brush.visible,true);assert.equal(S.heat,100);tick(r,1.3);assert.equal(S.heat,0);assert.equal(c.player.rig.ryuExtras.loose.visible,false);
  console.log('PASS skill-driven heat, cap, failed-cast gate, opened hair, visible brush, reset');
 }
 for(const [target,hp,expect,phase]of [['yuta',100,50,2],['gojo',100,50,0],['yuta',35,35,2]]) {
  const r=room(['ryu',target,'gojo']);const [a,b]=r.list.map(x=>x.c);b.player.hp=hp;r.sync();a.JJAW.charge=99;assert.equal(a.JJRYUREWORK.cast('rx_awake'),false);
  a.JJAW.charge=100;assert.equal(a.JJRYUREWORK.cast('rx_awake'),true);r.pump();r.tick(.5);assert.ok(a.player.rig.ryuExtras.pointer.visible,'actual index finger shown');r.tick(4.9);
  assert.equal(b.player.hp,expect);assert.equal(a.JJRYUREWORK.phase,phase);assert.equal(r.list[2].c.player.hp,100);
  const packet=r.all.find(m=>m.t==='ry-beam-hit');if(packet){b.JJRYUREWORK.receive(packet);assert.equal(b.player.hp,expect,'duplicate beam cannot damage twice');}
 }
 console.log('PASS G charge/finger/beam, receiver-owned HP clamp, confirmed Yuta-only second phase');
 {
  const r=fresh(),c=r.c,S=c.JJRYUREWORK;S.phase=2;S.remaining=60;
  for(const z of [4,-4]){const e=new c.Enemy('gojo',z);e.rig=c.makeAnimeRig(c.CHARS.gojo.cfg);c.enemies.push(e);}
  S.cast('rx1');tick(r,1.3);assert.ok(c.enemies.every(e=>e.hp===78));assert.ok(r.hits.every(h=>h.k.length()>110&&h.o.death==='ragdoll'));
  c.enemies.forEach(e=>{e.hp=100;e.bcFall=null;e.iframes=0;});S.cast('rx2');tick(r,1.7);assert.ok(c.enemies.every(e=>e.hp===82));assert.equal(r.calls.length,0);
  c.JJMAP.id='jjs';tick(r,.02);S.phase=2;S.remaining=60;c.JJDESTRUCT.settings.enabled=true;c.cds.rx2=0;S.cast('rx2');tick(r,1.7);assert.equal(r.calls.at(-1)[2],'ryu-lift');
 }
 console.log('PASS front kick, rear punch, long launch, AoE knock-up and destruction switch');
 {
  const r=fresh(),c=r.c,S=c.JJRYUREWORK;S.phase=2;S.remaining=60;
  const e=new c.Enemy('gojo',4);e.rig=c.makeAnimeRig(c.CHARS.gojo.cfg);c.enemies.push(e);
  S.cast('rx3');tick(r,4);assert.equal(e.hp,60);assert.equal(c.player.hp,90);assert.equal(S.locked(),false);
 }
 for(const kind of ['rx3','rx4']) {
  const r=room(),[a,b,watch]=r.list.map(x=>x.c);a.JJRYUREWORK.phase=2;a.JJRYUREWORK.remaining=60;r.sync();
  assert.equal(a.JJRYUREWORK.cast(kind),true);r.tick(.3);assert.ok(a.JJRYUREWORK.cine&&b.JJRYUREWORK.cine);assert.equal(watch.JJRYUREWORK.cine,null);
  const flash=new Set();for(let i=0;i<700;i++){r.tick(.02);const f=a.JJRYUFX.audit().flashFrame;if(f>=0)flash.add(f);}
  assert.equal(b.player.hp,kind==='rx4'?20:60);assert.equal(a.player.hp,90);assert.equal(watch.player.hp,100);
  if(kind==='rx4')assert.equal(flash.size,12,'all generated Black Flash frames used');
  for(const c of [a,b,watch])assert.equal(c.JJRYUREWORK.locked(),false);
  const before=b.player.hp;for(const m of r.all.filter(m=>m.t==='ry-cine'||m.t==='ry-end'))b.JJRYUREWORK.receive(m);assert.equal(b.player.hp,before);
 }
 console.log('PASS both paired moves in three-client room, all 12 flash frames, exact percentages, spectator camera, deduplication');
 {
  const r=fresh(),c=r.c,S=c.JJRYUREWORK;S.phase=2;S.remaining=60;
  const e=new c.Enemy('gojo',4);e.rig=c.makeAnimeRig(c.CHARS.gojo.cfg);c.enemies.push(e);S.cast('rx4');tick(r,.1);const z=c.player.pos.z;c.aim.set(1,0,0);tick(r,1.8);
  assert.equal(e.hp,100,'Best Dessert only targets online players');assert.ok(c.player.pos.x>1);assert.ok(c.player.pos.z>z);
 }
 for(const cause of ['guard','wall','disconnect','pause','death','switch','drop']) {
  const r=room(),[a,b]=r.list.map(x=>x.c);a.JJRYUREWORK.phase=2;a.JJRYUREWORK.remaining=60;r.sync();
  if(cause==='guard')b.player.blocking=true;
  if(cause==='wall')a.wall=true;
  a.JJRYUREWORK.cast('rx4');r.tick(.4);
  if(cause==='disconnect'){delete a.MPJJ.fighters.b;delete b.MPJJ.fighters.a;}
  if(cause==='pause')b.paused=true;
  if(cause==='death')b.player.dead=true;
  if(cause==='switch')b.switchChar('ryu');
  if(cause==='drop')r.drop(()=>true);
  r.tick(3);
  assert.equal(a.JJRYUREWORK.locked(),false,cause+' caster released');assert.equal(b.JJRYUREWORK.locked(),false,cause+' victim released');
  assert.equal(a.player.hp,100);assert.equal(b.player.hp,100);
 }
 console.log('PASS guard/wall rejection, death/swap/pause/disconnect/packet loss cleanup without damage');
 {
  const r=room(),[a,b]=r.list.map(x=>x.c);a.JJRYUREWORK.phase=2;a.JJRYUREWORK.remaining=60;r.sync();let n=0;r.drop(m=>m.t==='ry-cine'&&n++<2);
  a.JJRYUREWORK.cast('rx3');r.tick(4);assert.equal(b.player.hp,60,'start retry repairs packet loss');
 }
 {
  const r=fresh(),c=r.c;for(const [kind,k]of Object.entries(c.JJRYUREWORK.kit))for(let t=0;t<k.dur;t+=.05){c.JJRYUFX.pose(c.player.rig,{type:kind,t,dur:k.dur});c.player.rig.root.traverse(o=>{assert.ok(o.position.toArray().every(Number.isFinite));assert.ok(o.rotation.toArray().slice(0,3).every(Number.isFinite));});}
 }
 console.log('PASS retry recovery and finite joint transforms across every skill animation');
 if(raster){
  const dir=path.join(root,'work/ryu-review');fs.mkdirSync(dir,{recursive:true});
  const image=await new Promise((resolve,reject)=>{const im=new raster.Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=fs.readFileSync(path.join(root,'jujutsu/ryu-art/dessert-void.webp'));});
  const frames=[];
  async function render(c,label){
   c.updateCamera(0);c.renderer.render(c.scene,c.camera);const world=c.frameWorld,cam=c.frameCamera,canvas=new raster.Canvas(1280,720),g=canvas.getContext('2d');
   if(world!==c.scene)g.drawImage(image,0,0,1280,720);else {g.fillStyle='#172532';g.fillRect(0,0,1280,720);g.fillStyle='#263342';g.fillRect(0,520,1280,200);}
   world.updateMatrixWorld(true);cam.updateMatrixWorld(true);const triangles=[],light=new THREE.Vector3(.3,1,1).normalize();
   world.traverseVisible(o=>{if(!o.isMesh||!o.geometry?.attributes.position)return;const geo=o.geometry,pos=geo.attributes.position,idx=geo.index,mat=Array.isArray(o.material)?o.material[0]:o.material;if(!mat?.visible||mat.opacity===0)return;
    for(let i=0;i<(idx?idx.count:pos.count);i+=3){const p=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(pos,idx?idx.getX(i+j):i+j).applyMatrix4(o.matrixWorld));const normal=p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).normalize();if(mat.side!==THREE.DoubleSide&&normal.dot(cam.position.clone().sub(p[0]))<=0)continue;const q=p.map(v=>v.project(cam));if(q.some(v=>v.z<-1||v.z>1))continue;
     const color=(mat.color||new THREE.Color(0xffffff)).clone().multiplyScalar(mat.isMeshBasicMaterial?1:.62+.38*Math.max(0,normal.dot(light))).getStyle();triangles.push({q,z:q.reduce((s,v)=>s+v.z,0),color,alpha:mat.opacity??1});}
   });
   triangles.sort((a,b)=>b.z-a.z);for(const t of triangles){g.globalAlpha=t.alpha;g.fillStyle=t.color;g.beginPath();t.q.forEach((p,i)=>g[i?'lineTo':'moveTo']((p.x+1)*640,(1-p.y)*360));g.closePath();g.fill();}g.globalAlpha=1;
   const overlay=c.document.getElementById('jjRyuCinema');if(overlay?.style.display!=='none'&&overlay?.canvas)g.drawImage(overlay.canvas,0,0);
   await fs.promises.writeFile(path.join(dir,label+'.png'),await canvas.toBuffer('png'));frames.push(canvas);
  }
  const r=room(),c=r.list[0].c;c.JJRYUREWORK.phase=2;c.JJRYUREWORK.remaining=60;r.sync();c.JJRYUREWORK.cast('rx4');r.tick(.3);
  await new Promise(resolve=>setTimeout(resolve,50));
  for(const [i,t]of [1.1,2.3,3.8,5.9,7.3,8.7,9.6,11.9].entries()){c.JJRYUREWORK.cine.t=t;c.JJRYUFX.posePair(c.JJRYUREWORK.cine);await render(c,'cut-'+(i+1));}
  const a=fresh();a.c.JJAW.charge=100;a.c.JJRYUREWORK.cast('rx_awake');tick(a,.5);await render(a.c,'finger');
  a.c.JJRYUREWORK.cleanup();a.c.JJRYUREWORK.heat=100;a.c.JJRYUREWORK.cast('rx_brush');tick(a,.7);a.c.camera.position.set(6,6,9);a.c.camera.lookAt(new THREE.Vector3(0,4,0));await render(a.c,'brush');
  const contact=new raster.Canvas(1280,1080),cg=contact.getContext('2d');frames.forEach((f,i)=>cg.drawImage(f,(i%3)*1280/3,Math.floor(i/3)*270,1280/3,240));await fs.promises.writeFile(path.join(dir,'contact.png'),await contact.toBuffer('png'));
  console.log('RENDERED software previews from actual rig transforms and game cameras in work/ryu-review (not a WebGL browser test)');
 }
 const packed=require('./compact-jjs.cjs')(read('jujutsu/jjs-data.js'));
 const dec=packed.slice(packed.indexOf('var bytes='),packed.indexOf('  return JSON.parse'))+'globalThis.out=bytes;';const x={Uint8Array};vm.createContext(x);vm.runInContext(dec,x);
 const original=Buffer.from(read('jujutsu/jjs-data.js').match(/atob\('([^']+)'/)[1],'base64');assert.ok(Buffer.from(x.out).equals(original),'lossless map encoding');
 for(const f of ['jujutsu-multiplayer.html','jujutsu-parts/p5.js']){const content=read(f);assert.ok(content.includes(read('jujutsu/ryu-rework.js').trim()));assert.ok(content.includes(read('jujutsu/ryu-cinematic.js').trim()));
  const size=Buffer.byteLength(JSON.stringify({repository_full_name:'wujiahui4-a11y/study-mathenmatics-G3-singapore-secondary',content,encoding:'utf-8'}));assert.ok(size<16*1024*1024-32768,f+' upload size '+size);}
 console.log('PASS lossless map bytes and both builds under GitHub request limit');
})().catch(e=>{console.error(e);process.exitCode=1;});
