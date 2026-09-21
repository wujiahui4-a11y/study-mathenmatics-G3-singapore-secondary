'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
(async()=>{
 const THREE=await import('data:text/javascript;base64,'+Buffer.from(read('jujutsu/three.module.min.js')).toString('base64'));
 const raster=process.argv.includes('--render')?require(process.env.OPENING_CANVAS_MODULE||'skia-canvas'):null;
 const base=read('jujutsu/base.html'),combat=read('jujutsu/battleground-combat.js');
 function client(id='a',char='nanami') {
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
   round2:n=>Math.round(n*100)/100,
   document:{createElement:t=>new Element(t),body:new Element('body'),getElementById:id=>nodes.get(id)},
   Image:raster?.Image||class {set src(v){this.srcValue=v;}},matchMedia:()=>({matches:false}),
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
   MPJJ:{confirmOwnedHit:(by,hp)=>{if(c.player.hp<hp&&c.player.dead)c.ko=(c.ko||0)+1;},active:true,code:'ROOM',id,host:id==='a',fighters:{},relay:{pub:m=>packets.push(m)}},
   camForward:()=>c.aim.clone(),aim:new THREE.Vector3(0,0,1),
   busy:()=>!!c.player.action||c.JJFIGHT.locked(),
   hurtPlayer(n,k,o){if(c.player.dead||c.player.iframes>0)return false;c.player.hp=Math.max(0,c.player.hp-n);c.player.dead=c.player.hp===0;if(k)c.player.vel.copy(k);return true;},
   updatePlayer(dt){const p=c.player;p.iframes=Math.max(0,p.iframes-dt);p.stunT=Math.max(0,p.stunT-dt);for(const k in c.cds)c.cds[k]=Math.max(0,c.cds[k]-dt);
    if(p.action){const a=p.action;a.t+=dt;c.stepAction(a,dt);if(p.action===a&&a.t>=a.dur)p.action=null;}
    p.pos.addScaledVector(p.vel,dt);p.rig.root.position.copy(p.pos);p.rig.root.rotation.y=p.facing;if(p.action)c.poseAction(p.rig,p.action);
   },
   switchChar(id){c.player.char=id;c.player.rig=c.makeAnimeRig(c.CHARS[id].cfg);c.player.action=null;}
  };
  c.window=c;c.V=(...p)=>new THREE.Vector3(...p);c.clamp=(n,a,b)=>Math.max(a,Math.min(b,n));vm.createContext(c);
  vm.runInContext(base.slice(base.indexOf('function makeAnimeRig(cfg)'),base.indexOf('const GOJO_CFG')),c);
  c.player=new Enemy(char,0);c.player.facing=0;c.player.char=char;c.player.rig=c.makeAnimeRig(c.CHARS.gojo.cfg);c.player.action=null;c.player.onGround=true;c.player.animT=0;
  c.enemies=[];c.JJFIGHT={locked:()=>c.player.blocking||c.player.stunT>0||c.JJNANAMIX?.locked(),clearInput(){c.player.blocking=false;},blockFX:e=>{e.blockedCount=(e.blockedCount||0)+1;},
   actors:{visible:()=>!c.wall,sweepMove:(e,v)=>{if(c.wall)return 0;e.pos.add(v);return v.length();},startFall:(e,k)=>{e.bcFall=true;e.vel.copy(k);}}};
  c.dir=y=>new THREE.Vector3(Math.sin(y),0,Math.cos(y));
  vm.runInContext(combat.slice(combat.indexOf('  function blocked('),combat.indexOf('  function blockFX(')),c);c.JJFIGHT.blocked=c.blocked;
  vm.runInContext(read('jujutsu/yuta.js'),c);vm.runInContext(read('jujutsu/nanami.js'),c);
  c.player.rig=c.makeAnimeRig(c.CHARS[char].cfg);c.player.rig.__char=char;
  c.core=()=>false;c.cancel=()=>{};c.startFall=(e,k)=>{e.bcFall=true;e.vel.copy(k);};c.blockFX=c.JJFIGHT.blockFX;c.guardHeld=false;c.queued=0;
  vm.runInContext('(function(){'+combat.slice(combat.indexOf('  function metadata(opts)'),combat.indexOf('  function pack(a)'))+'})();',c);
  c.MP=c.MPJJ;c.JJAW.gain=()=>{};
  vm.runInContext('const C=JJFIGHT;const received=new Set();'+combat.slice(combat.indexOf('  C.hitData ='),combat.indexOf('  const previousEnemyUpdate')),c);c.JJFIGHT.networkHit=c.networkHit;
  vm.runInContext(read('jujutsu/mp.js').slice(read('jujutsu/mp.js').indexOf('  var _enemyDamage ='),read('jujutsu/mp.js').indexOf('  var _enemyProj =')),c);
  vm.runInContext(read('jujutsu/nanami-rework.js'),c);vm.runInContext(read('jujutsu/nanami-vfx.js'),c);
  vm.runInContext(combat.slice(combat.indexOf('  function strike(a,'),combat.indexOf('  function sweepMove(')),c);
  c.scene.add(c.player.rig.root);
  return {c,effects,packets,events,calls,hits,nodes,tick(dt){c.updatePlayer(dt);for(const e of c.enemies)e.update(dt);for(let j=effects.length-1;j>=0;j--)if(!effects[j].update(dt))effects.splice(j,1);c.updateCamera(dt);}};
 }
 function room(chars=['nanami','yuta','gojo'],positions=[0,4,70]) {
  const list=chars.map((s,i)=>client(String.fromCharCode(97+i),s));let dropped=()=>false;const all=[];
  list.forEach((r,i)=>{r.c.player.pos.z=positions[i];if(i===2)r.c.player.pos.x=35;r.c.player.facing=i===0?0:Math.PI;});
  for(const r of list)for(const other of list)if(r!==other){const e=new r.c.Enemy(other.c.player.char);e.net={id:other.c.MPJJ.id};e.rig=r.c.makeAnimeRig(r.c.CHARS[e.char].cfg);e.rig.__char=e.char;r.c.scene.add(e.rig.root);r.c.enemies.push(e);r.c.MPJJ.fighters[e.net.id]={id:e.net.id,char:e.char,e};}
  function sync(){for(const r of list)for(const other of list)if(r!==other){const f=r.c.MPJJ.fighters[other.c.MPJJ.id];if(!f)continue;const p=other.c.player;f.e.hp=p.hp;f.e.maxHp=p.maxHp;f.e.dead=p.dead;f.e.pos.copy(p.pos);f.e.facing=p.facing;f.e.blocking=p.blocking;f.e.iframes=p.iframes;f.action=p.action?{type:p.action.type,t:p.action.t,dur:p.action.dur}:null;r.c.JJNANAMIX.remoteState(f,other.c.JJNANAMIX.pack());}}
  function pump(){for(let n=0;n<6;n++){const out=list.flatMap(r=>r.packets.splice(0));if(!out.length)break;for(const m of out){all.push(m);if(dropped(m))continue;for(const r of list)if(r.c.MPJJ.id!==m.id){const msg=JSON.parse(JSON.stringify(m));if(msg.t==='hit'&&msg.to===r.c.MPJJ.id)r.c.JJFIGHT.networkHit(msg);else r.c.JJNANAMIX.receive(msg);}}}}
  sync();
  return {list,all,sync,pump,drop:f=>{dropped=f;},tick(secs,dt=.02){for(let i=0;i<Math.ceil(secs/dt);i++){for(const r of list)r.tick(dt);sync();pump();}}};
 }

 const step=(r,t)=>{for(let i=0;i<Math.ceil(t/.02);i++)r.tick(.02);};
 const fresh=()=>{const r=client();r.c.MPJJ.active=false;r.tick(.02);return r;};
 function observations(r){const notes=[];for(const name of ['mark','impact','finish']){const old=r.c.JJNANAMIFX[name];r.c.JJNANAMIFX[name]=(...args)=>{notes.push({name,args});return old(...args);};}return notes;}
 function melee(c,n=0){const a={type:'bc_m1',t:.16,dur:.4,start:.12,active:.16,n,dir:new THREE.Vector3(0,0,1),hits:new Set()};c.player.action=a;c.strike(a);return a;}
 {
  const r=fresh(),c=r.c;assert.ok(c.player.rig.nanamiBlade);assert.ok(c.player.rig.nanamiBlade.children.length>30);
  const e=new c.Enemy('gojo',4);e.rig=c.makeAnimeRig(c.CHARS.gojo.cfg);c.enemies.push(e);const notes=observations(r);
  assert.equal(c.JJNANAMIX.cast(0),true);assert.equal(c.JJNANAMIX.cast(0),false);step(r,1.5);
  assert.equal(e.hp,82);assert.ok(c.player.pos.z>7);assert.ok(notes.some(n=>n.name==='mark'&&n.args[1]===false));
  c.player.pos.set(0,0,0);e.pos.set(0,0,4);e.stunT=e.iframes=0;melee(c);assert.equal(e.hp,79);
  c.player.action=null;c.JJNANAMIX.cast(4);step(r,1);assert.ok(c.player.nxOvertime>15);assert.ok(c.player.rig.nxEnergy.visible);
  melee(c);assert.equal(e.hp,73);assert.ok(notes.some(n=>n.name==='mark'&&n.args[1]===true));
  console.log('PASS equipped detailed blade, spin movement, neutral ratio, blade M1, R buff and 7:3 M1');
 }
 for(const hold of [.2,.8,2]){
  const r=room(),[a,b,w]=r.list.map(x=>x.c);assert.equal(a.JJNANAMIX.cast(1),true);r.tick(hold);assert.equal(a.JJNANAMIX.release(),true);
  assert.equal(a.player.action.perfect,hold>=.65);r.tick(3);
  assert.equal(b.player.hp,hold<.65?84:72);assert.equal(a.player.hp,100);assert.equal(w.player.hp,100);assert.equal(w.JJNANAMIX.cine,null);
  assert.equal(a.JJNANAMIX.locked(),false);assert.equal(b.JJNANAMIX.locked(),false);
  const hp=b.player.hp;for(const m of r.all)b.JJNANAMIX.receive(m);assert.equal(b.player.hp,hp);
 }
 console.log('PASS tap dash, easy sticky 7:3, receiver-owned damage, paired scene, spectators and duplicate rejection');
 {
  const r=room(),[a,b]=r.list.map(x=>x.c);a.JJNANAMIX.cast(2);r.tick(1.4);
  assert.equal(b.player.hp,83);assert.equal(b.player.vel.length(),0);assert.ok(!b.player.bcFall);assert.ok(b.player.stunT>0);
  const fin=room(),[x,y]=fin.list.map(v=>v.c);y.player.hp=17;fin.sync();x.JJNANAMIX.cast(2);fin.tick(3.8);
  assert.equal(y.player.hp,0);assert.equal(y.ko,1);assert.equal(x.player.hp,100);assert.equal(x.JJNANAMIX.locked(),false);
  console.log('PASS punch/kick/kick is stun-only and its confirmed finisher awards one KO');
 }
 {
  const r=room(),[a,b]=r.list.map(x=>x.c);a.JJNANAMIX.cast(3);r.tick(.2);
  const target=b.MPJJ.fighters.a.e;target.damage(15,new THREE.Vector3(0,0,-10),{react:'stagger'});r.pump();r.tick(2.2);
  assert.equal(a.player.hp,100,'counter rejects original hit');assert.equal(b.player.hp,76,'counter returns one strike');
  assert.equal(a.JJNANAMIX.locked(),false);assert.equal(b.JJNANAMIX.locked(),false);assert.equal(a.player.rig.root.visible,true);assert.equal(a.player.rig.body.position.length(),0);
  console.log('PASS counter to legacy skill, attacker proof, overhead return, paired cleanup');
 }
 for(const cause of ['guard','wall','disconnect','pause','death','switch','map','drop']){
  const r=room(),[a,b]=r.list.map(x=>x.c);a.JJNANAMIX.cast(1);r.tick(.8);
  if(cause==='guard')b.player.blocking=true;if(cause==='wall')a.wall=b.wall=true;
  r.sync();a.JJNANAMIX.release();r.tick(.2);
  if(cause==='disconnect'){delete a.MPJJ.fighters.b;delete b.MPJJ.fighters.a;}
  if(cause==='pause')b.paused=true;if(cause==='death')b.player.dead=true;if(cause==='switch')b.switchChar('nanami');
  if(cause==='map')b.JJMAP.id='jjs';if(cause==='drop')r.drop(()=>true);
  r.tick(2.5);assert.equal(a.JJNANAMIX.locked(),false,cause+' caster');assert.equal(b.JJNANAMIX.locked(),false,cause+' victim');assert.equal(b.player.hp,100,cause+' no damage');
 }
 {
  const r=room(),[a,b]=r.list.map(x=>x.c);let count=0;r.drop(m=>m.t==='nx-pair'&&count++<2);a.JJNANAMIX.cast(1);r.tick(.8);a.JJNANAMIX.release();r.tick(3);assert.equal(b.player.hp,72);
 }
 console.log('PASS block/wall rejection, dropped-start recovery, disconnect/pause/death/swap/map/loss release');
 {
  const r=fresh(),c=r.c;for(const type of ['nx1','nx_charge','nx2','nx3','nx4','nxr'])for(let t=0;t<1.6;t+=.04){c.poseAction(c.player.rig,{type,t,dur:1.6});c.player.rig.root.traverse(o=>assert.ok([...o.position.toArray(),...o.rotation.toArray().slice(0,3)].every(Number.isFinite)));}
  for(let n=0;n<4;n++)for(let t=0;t<.6;t+=.03)c.JJNANAMIX.poseM1(c.player.rig,{type:'bc_m1',t,start:.12,active:.16,dur:.45,n});
  assert.equal(c.JJNANAMIX.cast(1),true);step(r,3.1);assert.equal(c.player.action.type,'nx2','hold automatically releases');
 }
 console.log('PASS finite blade/limb poses and automatic charge release');

 if(raster){
  const dir=path.join(root,'work/nanami-review');fs.mkdirSync(dir,{recursive:true});
  const frames=[];
  async function render(c,label){
   for(const e of [c.player,...c.enemies])if(!e.nxHold){e.rig.root.position.copy(e.pos);e.rig.root.rotation.y=e.facing;}
   c.updateCamera(0);c.renderer.render(c.scene,c.camera);const world=c.frameWorld,cam=c.frameCamera,canvas=new raster.Canvas(1280,720),g=canvas.getContext('2d');
   {g.fillStyle='#172532';g.fillRect(0,0,1280,720);g.fillStyle='#263342';g.fillRect(0,520,1280,200);}
   world.updateMatrixWorld(true);cam.updateMatrixWorld(true);const triangles=[],light=new THREE.Vector3(.3,1,1).normalize();
   world.traverseVisible(o=>{if(!o.isMesh||!o.geometry?.attributes.position)return;const geo=o.geometry,pos=geo.attributes.position,idx=geo.index,mat=Array.isArray(o.material)?o.material[0]:o.material;if(!mat?.visible||mat.opacity===0)return;
    for(let i=0;i<(idx?idx.count:pos.count);i+=3){const p=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(pos,idx?idx.getX(i+j):i+j).applyMatrix4(o.matrixWorld));const normal=p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).normalize();if(mat.side!==THREE.DoubleSide&&normal.dot(cam.position.clone().sub(p[0]))<=0)continue;const q=p.map(v=>v.project(cam));if(q.some(v=>v.z<-1||v.z>1))continue;
     const color=(mat.color||new THREE.Color(0xffffff)).clone().multiplyScalar(mat.isMeshBasicMaterial?1:.62+.38*Math.max(0,normal.dot(light))).getStyle();triangles.push({q,z:q.reduce((s,v)=>s+v.z,0),color,alpha:mat.opacity??1});}
   });
   triangles.sort((a,b)=>b.z-a.z);for(const t of triangles){g.globalAlpha=t.alpha;g.fillStyle=t.color;g.beginPath();t.q.forEach((p,i)=>g[i?'lineTo':'moveTo']((p.x+1)*640,(1-p.y)*360));g.closePath();g.fill();}g.globalAlpha=1;
   const overlay=c.document.getElementById('jjNanamiCinema');if(overlay?.style.display!=='none'&&overlay?.canvas)g.drawImage(overlay.canvas,0,0);
   await fs.promises.writeFile(path.join(dir,label+'.png'),await canvas.toBuffer('png'));frames.push(canvas);
  }

  const r=fresh(),c=r.c;c.camera.position.set(8,6,10);c.camera.lookAt(new THREE.Vector3(0,3.1,0));
  await render(c,'blade-idle');
  for(const [label,type,t]of [['blade-m1','bc_m1',.21],['spin','nx1',.54],['charge','nx_charge',.75],['draw','nx2',.12],['counter-stance','nx4',.4]]){
   c.player.action={type,t,start:.12,active:.16,dur:1.5,n:1,ratio:7};
   if(type==='bc_m1')c.JJNANAMIX.poseM1(c.player.rig,c.player.action);else c.poseAction(c.player.rig,c.player.action);
   c.JJNANAMIFX.tick(c.player,.02,c.player.action);await render(c,label);
  }
  const paired=room(),a=paired.list[0].c;a.JJNANAMIX.cast(1);paired.tick(.8);a.JJNANAMIX.release();paired.tick(.1);
  for(const [label,t]of [['ratio-turn',.3],['ratio-impact',.94],['ratio-finish',1.55]]){a.JJNANAMIX.cine.t=t;a.JJNANAMIFX.pairPose(a.JJNANAMIX.cine);await render(a,label);}
  const counter=room(),[x,y]=counter.list.map(v=>v.c);x.JJNANAMIX.cast(3);counter.tick(.2);y.MPJJ.fighters.a.e.damage(10,new THREE.Vector3(0,0,-1),{});counter.pump();counter.tick(.54);
  await render(x,'aerial-counter');
  const contact=new raster.Canvas(1280,Math.ceil(frames.length/3)*270),g=contact.getContext('2d');frames.forEach((f,i)=>g.drawImage(f,(i%3)*1280/3,Math.floor(i/3)*270,1280/3,240));await fs.promises.writeFile(path.join(dir,'contact.png'),await contact.toBuffer('png'));
  console.log('RENDERED Nanami software previews using actual rigs and cameras (not a live browser playtest)');
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
