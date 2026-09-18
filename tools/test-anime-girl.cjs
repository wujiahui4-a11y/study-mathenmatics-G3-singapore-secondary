/* Browser-independent regression checks for the secret kit. Uses the real Three
   geometry, base skeleton, character module and shared combat damage wrapper.
   This does not replace a visual/audio browser playtest. No npm dependencies. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
(async()=>{
  const THREE=await import('data:text/javascript;base64,'+Buffer.from(read('jujutsu/three.module.min.js')).toString('base64'));
  const base=read('jujutsu/base.html'),source=read('jujutsu/anime-girl.js');
  const snapshot=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'jujutsu/jjs/source.json.gz'))));
  const storage=new Map(),events={},nodes=[],effects=[],hits=[],breaks=[],tones=[],voices=[];
  class Element {
    constructor(tag){this.tagName=tag;this.style={};this.children=[];this.selectors=new Map();this.dataset={};nodes.push(this);}
    appendChild(e){this.children.push(e);return e;}
    querySelector(s){if(!this.selectors.has(s))this.selectors.set(s,new Element(s));return this.selectors.get(s);}
    addEventListener(name,cb){this[name]=cb;}
    focus(){}blur(){}
    getContext(){return {strokeText(){},fillText(){}};}
    set innerHTML(s){this.html=s;}get innerHTML(){return this.html;}
  }
  const document={createElement:t=>new Element(t),body:new Element('body')};
  class Enemy {
    constructor(){this.pos=new THREE.Vector3(0,0,4);this.vel=new THREE.Vector3();this.hp=this.maxHp=100;this.dead=false;this.facing=Math.PI;}
    damage(n,k,opts){hits.push({n,k:k.clone(),opts});this.hp=Math.max(0,this.hp-n);this.dead=this.hp<=0;this.vel.copy(k);return true;}
  }
  const ctx={THREE,document,console,Set,Map,Math,Number,String,Array,performance:{now:()=>clock},Enemy,
    CHARS:{gojo:{cfg:{face:true,torso:0x222222,pants:0x222222,shoes:0x222222,skin:0xccaa88}}},cds:{},scene:new THREE.Scene(),started:true,
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    boxMesh:(w,h,d,c)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshToonMaterial({color:c})),
    buildCharList(){ctx.roster=Object.keys(ctx.CHARS).filter(ctx.charAvailable);},
    gameInputActive:()=>!ctx.paused&&ctx.started,
    typingInUI:e=>!!e.target?.typing,
    clearMovement(){ctx.movementCleared=true;},setShiftLock(){},showSplash(){ctx.splashed=true;},
    addFx:e=>effects.push(e),addShake(){},hitstop(){},sfx:{whoosh(){},punch(){},tpDone(){}},
    tone:(...args)=>tones.push(args),noiseBurst(){},SpeechSynthesisUtterance:function(text){this.text=text;},speechSynthesis:{speak:u=>voices.push(u)},
    stepAction(){},poseAction(){},applyLocomotion(){},updateHUD(){},
    busy:()=>!!ctx.player.action,
    updatePlayer(dt){for(const k in ctx.cds)ctx.cds[k]=Math.max(0,ctx.cds[k]-dt);if(ctx.player.action){const a=ctx.player.action;a.t+=dt;ctx.stepAction(a,dt);if(ctx.player.action===a&&a.t>=a.dur)ctx.player.action=null;}},
    switchChar(id){if(!ctx.charAvailable(id)||ctx.player.char===id)return;ctx.player.char=id;ctx.player.rig=ctx.makeAnimeRig(ctx.CHARS[id].cfg);ctx.player.action=null;},
    addEventListener(n,f){(events[n]||=[]).push(f);},
    JJFIGHT:{locked:()=>!!ctx.player.blocking,clearInput(){},actors:{visible:()=>!ctx.wall}},
    JJMAP:{id:'plate'},JJJJS:{root:{},data:{origin:[0,20.309,0],meshes:snapshot.parts.filter(p=>p.mesh)}},
    JJDESTRUCT:{settings:{enabled:false},hit:(p,r)=>breaks.push({p,r})}
  };
  let clock=0;ctx.window=ctx;vm.createContext(ctx);
  vm.runInContext(base.slice(base.indexOf('function makeAnimeRig(cfg)'),base.indexOf('const GOJO_CFG')),ctx);
  vm.runInContext(base.slice(base.indexOf('function charAvailable(id)'),base.indexOf('function buildCharList()')),ctx);
  ctx.player={char:'gojo',pos:new THREE.Vector3(),vel:new THREE.Vector3(),facing:0,frameT:0,stunT:0,action:null,rig:ctx.makeAnimeRig(ctx.CHARS.gojo.cfg)};
  ctx.enemies=[new Enemy()];
  vm.runInContext(source,ctx);const S=ctx.JJANIMEGIRL;
  function tick(t,dt=.02){for(let n=0;n<Math.ceil(t/dt);n++){clock+=dt*1000;ctx.updatePlayer(dt);for(let j=effects.length-1;j>=0;j--)if(!effects[j].update(dt))effects.splice(j,1);ctx.updateHUD(dt);}}
  function key(code,key=code,typing=false){const e={code,key,target:{typing},preventDefault(){},stopImmediatePropagation(){this.stopped=true;}};for(const f of events.keydown){f(e);if(e.stopped)break;}}
  function reset(){tick(4);ctx.player.action=null;ctx.player.react=null;ctx.player.dead=false;ctx.player.blocking=false;ctx.player.stunT=0;ctx.player.pos.set(0,0,0);ctx.player.vel.set(0,0,0);ctx.player.facing=0;ctx.JJMAP.id='plate';ctx.wall=false;ctx.paused=false;ctx.enemies=[new Enemy()];for(const k in ctx.cds)ctx.cds[k]=0;S.charge=0;S.stamina=100;hits.length=breaks.length=0;}
  assert.equal(S.unlocked,false);assert.equal(ctx.roster.includes('animegirl'),false);
  ctx.switchChar('animegirl');assert.equal(ctx.player.char,'gojo','locked direct selection blocked');
  assert.equal(S.submitWord('baka'),false,'wrong map');
  ctx.JJMAP.id='jjs';const zone=S.unlockZone();assert.ok(zone.point.distanceTo(zone.center)>20,'derived from full-size imported Reimu');
  const place=()=>{ctx.player.pos.copy(zone.point);ctx.player.facing=Math.atan2(-zone.front.x,-zone.front.z);};
  place();ctx.player.facing+=Math.PI;assert.equal(S.submitWord('baka'),false,'must face model');
  place();ctx.player.pos.copy(zone.center).addScaledVector(zone.front,-30);assert.equal(S.submitWord('baka'),false,'behind model');
  place();ctx.player.pos.y+=20;assert.equal(S.submitWord('baka'),false,'vertical distance');
  place();ctx.player.pos.addScaledVector(zone.front,40);assert.equal(S.submitWord('baka'),false,'too far');
  place();assert.equal(S.submitWord('hello'),false,'wrong word');
  key('KeyB','b',true);key('KeyA','a',true);key('KeyK','k',true);key('KeyA','a',true);assert.equal(S.unlocked,false,'unrelated input ignored');
  key('KeyB','b');clock+=2000;key('KeyA','a');key('KeyK','k');key('KeyA','a');assert.equal(S.unlocked,false,'typing timeout');
  for(const c of 'baka')key('Key'+c.toUpperCase(),c);
  assert.equal(S.unlocked,true);assert.equal(storage.get(S.storageKey),'1');assert.ok(ctx.roster.includes('animegirl'));assert.equal(S.submitWord('baka'),false,'unlock once');
  ctx.switchChar('animegirl');assert.equal(ctx.player.char,'animegirl');reset();
  console.log('PASS unlock: map, front, facing, height, distance, word, input focus, persistence, roster');

  // Apply the real shared damage wrapper to exercise guard, stun and launches.
  const combat=read('jujutsu/battleground-combat.js');
  ctx.blocked=(e,m)=>m?.guardable&&!m.breakGuard&&e.blocking;
  ctx.blockFX=()=>{};ctx.startFall=(e,k)=>{e.bcFall=true;e.vel.copy(k);};
  vm.runInContext(combat.slice(combat.indexOf('  function metadata(opts)'),combat.indexOf('  const previousHurt = hurtPlayer;')),ctx);
  for(const [code,id,count,total] of [['Digit1','ag1',1,101],['Digit2','ag2',1,24],['Digit3','ag3',11,28],['Digit4','ag4',1,26]]){
    reset();key(code);assert.equal(ctx.player.action.type,id);assert.ok(ctx.cds[id]>0);assert.ok(S.stamina<100);tick(2.3);
    assert.equal(hits.length,count,id+' event count');assert.equal(hits.reduce((a,h)=>a+h.n,0),total,id+' damage');
    assert.equal(ctx.player.action,null,id+' recovery');key(code);assert.equal(ctx.player.action,null,id+' cooldown');
    if(id==='ag1'){assert.equal(ctx.enemies[0].dead,true);assert.ok(hits[0].k.z>=135,'strong fling');}
    if(id==='ag4')assert.ok(hits[0].k.y>=36,'upperkick');
    assert.ok(hits.every(h=>h.opts.spark===0xffffff&&h.opts.fin===false),'white wind and no cinematic finisher');
  }
  for(const id of ['ag1','ag2','ag3','ag4'])for(const mode of ['rear','wall','high','invulnerable','held']){
    reset();const e=ctx.enemies[0];if(mode==='rear')e.pos.z=-8;if(mode==='wall')ctx.wall=true;if(mode==='high')e.pos.y=20;if(mode==='invulnerable')e.iframes=1;if(mode==='held')e.cineHold=true;
    S.cast(id);tick(2.3);assert.equal(hits.length,0,id+' '+mode);
  }
  reset();ctx.enemies[0].blocking=true;S.cast('ag3');tick(2.3);assert.equal(hits.length,0,'punches respect guard');
  reset();ctx.enemies[0].blocking=true;S.cast('ag1');tick(.5);assert.equal(ctx.enemies[0].dead,true,'slap breaks guard');
  reset();S.stamina=0;assert.equal(S.cast('ag1'),false,'stamina gate');
  reset();ctx.paused=true;assert.equal(S.cast('ag1'),false,'pause gate');ctx.paused=false;
  reset();ctx.player.blocking=true;assert.equal(S.cast('ag1'),false,'guard gate');ctx.player.blocking=false;
  reset();S.cast('ag3');tick(.46);const n=hits.length;ctx.player.stunT=1;tick(1.7);assert.equal(hits.length,n,'stun cancels remaining punches');
  reset();S.cast('ag2');ctx.player.dead=true;tick(2);assert.equal(hits.length,0,'death cancels shout');
  console.log('PASS combat: five timelines, cooldowns, stamina, guard, hit deduplication, walls, interruption');

  reset();S.stamina=20;key('KeyR');tick(.55);assert.equal(S.charge,25);assert.ok(S.maxStamina>100);assert.ok(S.stamina>55);assert.equal(S.power,1.1875);
  tick(.5);ctx.cds.ag4=0;const power=S.power;S.cast('ag4');tick(.5);assert.equal(hits[0].n,26*power);assert.ok(ctx.cds.ag4<11,'charge improves cooldown');
  reset();for(let i=0;i<6;i++){ctx.cds.agr=0;S.cast('agr');tick(.81);}assert.ok(S.charge<=100);assert.ok(S.maxStamina<=150);assert.ok(S.stamina<=S.maxStamina);
  const before=S.charge;tick(2);assert.ok(S.charge<before,'meter cools off');ctx.switchChar('gojo');assert.equal(S.charge,0);assert.equal(S.stamina,100);
  ctx.switchChar('animegirl');reset();S.cast('ag2');tick(1.5);assert.equal(breaks.length,0,'destruction off');
  reset();ctx.JJDESTRUCT.settings.enabled=true;S.cast('ag2');tick(1.5);assert.equal(breaks.length,5);assert.ok(breaks[4].p.z-breaks[0].p.z>=32);assert.ok(breaks.every(x=>x.r<=18));ctx.JJDESTRUCT.settings.enabled=false;
  console.log('PASS Tsundere: R recovery, capacity, damage/cooldown boost, cap, decay, switch reset; destruction setting');

  reset();const r=ctx.player.rig;let meshCount=0;r.root.traverse(o=>{if(o.isMesh){meshCount++;assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));}});assert.ok(meshCount>=50);
  const signatures=new Set();for(const [id,k] of Object.entries(S.kit))for(const t of Array.from({length:25},(_,i)=>k.dur*i/24)){ctx.poseAction(r,{type:id,t,dur:k.dur});
    for(const joint of ['spine','neck','shoulderL','shoulderR','elbowL','elbowR','hipL','hipR','kneeL','kneeR'])assert.ok([r[joint].rotation.x,r[joint].rotation.y,r[joint].rotation.z].every(Number.isFinite));
    signatures.add([r.spine.rotation.y,r.shoulderR.rotation.x,r.hipR.rotation.x].join(','));}
  assert.ok(signatures.size>18,'distinct animated beats');
  assert.equal(r.agSkirt.length,12,'full pleated skirt');
  for(const name of ['Silver iris','Eye pupil','Eye upper glint','Eye lower glint']){let n=0;r.root.traverse(o=>{if(o.name===name)n++;});assert.equal(n,2,name+' on both eyes');}
  assert.ok(!r.root.getObjectByName('Charcoal trousers'),'trousers removed');
  assert.ok(tones.some(t=>t[0]>=1400&&t[1]<.3),'short bright shout layer');assert.ok(tones.every(t=>t[3]<=.035),'bounded synthesized gain');
  assert.ok(voices.some(u=>u.pitch===1.85&&u.volume<=.6),'sharper voice without added loudness');
  for(const id of Object.keys(S.kit)){reset();S.remote[id](new THREE.Vector3(),0,{tsundere:100});tick(.52);assert.equal(hits.length,0);assert.equal(breaks.length,0);assert.ok(S.props.size>0);
    for(const p of S.props)p.g.traverse(o=>{if(o.material?.color)assert.equal(o.material.color.getHex(),0xffffff,'all custom VFX white');});tick(4);assert.equal(S.props.size,0);}
  reset();S.cast('ag2');tick(.5);assert.ok(S.props.size>0);ctx.switchChar('gojo');assert.equal(S.props.size,0,'local effect cleanup');
  console.log('PASS real Three rig geometry, all joint keyframes, white-only remote VFX, no remote damage, bounded cleanup');
  // The intended standing point must be reachable in the actual imported map.
  const materials=[],parts=snapshot.parts.filter(p=>!p.path.startsWith('Workspace.Map.Data.')).map(p=>{
    let m=materials.indexOf(p.material);if(m<0){m=materials.length;materials.push(p.material);}
    return [...p.cf,...p.size,...p.color,p.transparency,p.reflectance,m,(p.collide?1:0)|(p.shadow?2:0),p.mesh?1:0];
  });
  const mapCtx={THREE,scene:new THREE.Scene(),JJS_DATA:{parts,materials,origin:[0,20.309,0],decals:[],guis:[],spawns:snapshot.spawns,meshes:snapshot.parts.filter(p=>p.mesh)},localStorage:ctx.localStorage};
  mapCtx.window=mapCtx;vm.createContext(mapCtx);vm.runInContext(read('jujutsu/jjs.js'),mapCtx);mapCtx.JJJJS.build();
  const standing=zone.point.clone();standing.y=mapCtx.JJJJS.floor(standing,standing.y+2);
  assert.ok(Number.isFinite(standing.y),'standing point has a floor');
  assert.ok(!mapCtx.JJJJS.occupied(standing,.85,5.1),'standing point is outside walls and donation box');
  place();ctx.player.pos.copy(standing);assert.ok(Math.abs(standing.y-zone.point.y)<7,'floor within ritual height');
  mapCtx.JJJJS.clear();
  console.log('PASS actual JJS collision: Reimu standing point has floor and clear space');

  // Exercise the real cast dispatcher and deduplicating network hit decoder.
  const mp=read('jujutsu/mp.js');ctx.JJFIGHT.remoteFX=()=>false;ctx.JJFX={};
  vm.runInContext(mp.slice(mp.indexOf('  function remoteFx('),mp.indexOf('  function redBlast(')),ctx);
  const packets=[];ctx.MP={relay:{pub:m=>packets.push(m)},id:'caster',lastCast:null};
  vm.runInContext(mp.slice(mp.indexOf('  function announceCasts()'),mp.indexOf('  /* remote fighters are driven')),ctx);
  ctx.received=new Set();ctx.clamp=(n,a,b)=>Math.max(a,Math.min(b,n));ctx.V=(...v)=>new THREE.Vector3(...v);
  let delivered=0;ctx.hurtPlayer=(n,k,o)=>{delivered++;assert.ok(o.combat);assert.ok(k.z>0);return true;};
  vm.runInContext(combat.slice(combat.indexOf('  function networkHit(m)'),combat.indexOf('  const previousEnemyUpdate')),ctx);
  ctx.switchChar('animegirl');
  for(const id of Object.keys(S.kit)){
    reset();packets.length=0;ctx.MP.lastCast=null;S.cast(id);ctx.announceCasts();ctx.announceCasts();
    assert.equal(packets.filter(p=>p.t==='cast').length,1,'cast announced once');
    ctx.player.action=null;ctx.remoteFx(id,new THREE.Vector3(),0,{tsundere:100});tick(.55);
    assert.equal(hits.length,0,'network replay cannot hit');tick(4);
  }
  const msg={id:'caster',d:26,kx:0,ky:36,kz:16,bc:{g:1,b:0,p:[0,0,0],st:.7,down:1.6,v:'up',id:1000000020,k:'animegirl'}};
  assert.equal(ctx.networkHit(msg),true);assert.equal(ctx.networkHit(msg),false);assert.equal(delivered,1);
  console.log('PASS multiplayer cast dispatch and duplicate hit rejection');

  // Exercise the actual damage -> death wrapper -> ragdoll path, not just a
  // mock launch vector. A tagged slap must never enter a special death effect.
  reset();ctx.JJFX=null;ctx.JJDESTRUCT.sweep=()=>{};ctx.damageNumber=ctx.spark=()=>{};
  Enemy.prototype.unframe=Enemy.prototype.drawBars=Enemy.prototype.respawn=Enemy.prototype.update=()=>{};
  vm.runInContext('Enemy.prototype.damage=function'+base.slice(base.indexOf('  damage(amount')+8,base.indexOf('  directDamage(n'))+';',ctx);
  vm.runInContext(read('jujutsu/ragdoll.js'),ctx);
  const deaths=read('jujutsu/gore.js');ctx.goreDeath=()=>{throw Error('intact slap reached a special death effect');};ctx.isHeld=()=>false;
  vm.runInContext('(function(){'+deaths.slice(deaths.indexOf('  function now()'),deaths.indexOf('  GORE.mark = mark;'))+
    deaths.slice(deaths.indexOf('  var _enemyDamage ='),deaths.indexOf('  var _enemyDirect ='))+
    deaths.slice(deaths.indexOf('  var _die = Enemy.prototype.die;'),deaths.indexOf('  var _respawn = Enemy.prototype.respawn;'))+'})();',ctx);
  vm.runInContext('(function(){'+combat.slice(combat.indexOf('  function metadata(opts)'),combat.indexOf('  const previousHurt = hurtPlayer;'))+'})();',ctx);
  const victim=ctx.enemies[0];victim.rig=ctx.makeAnimeRig(ctx.CHARS.gojo.cfg);victim.stunT=0;
  const parents=new Map();victim.rig.root.traverse(o=>parents.set(o,o.parent));
  S.cast('ag1');tick(.38);assert.equal(victim.dead,true);assert.ok(victim.rag,'actual ragdoll starts');
  assert.ok(victim.rag.vel.z>=135,'death handler preserves full launch speed');
  const z=victim.pos.z;for(let i=0;i<25;i++)ctx.JJRAG.step(victim,.02);
  assert.ok(victim.pos.z-z>60,'intact dummy travels far');assert.equal(victim.rig.root.visible,true);
  for(const [part,parent] of parents)if(part!==victim.rig.root)assert.equal(part.parent,parent,'joints stay attached');
  console.log('PASS actual slap death chain: intact rig, full momentum, 60+ unit flight');

  for(const file of ['jujutsu-multiplayer.html','jujutsu-parts/p5.js'])assert.ok(read(file).includes(source.trim()),file+' contains current module');
  const split=read('jujutsu-parts/p5.js');
  // vm.SourceTextModule parses the complete build without executing browser APIs.
  if(vm.SourceTextModule)new vm.SourceTextModule(split);
  assert.ok(read('jujutsu/mp.js').includes("case 'ag1': case 'ag2': case 'ag3': case 'ag4': case 'agr':"));
  console.log('PASS standalone and split build wiring');
})().catch(e=>{console.error(e);process.exitCode=1;});
