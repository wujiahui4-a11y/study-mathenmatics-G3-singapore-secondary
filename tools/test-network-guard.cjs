'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
(async()=>{
 const THREE=await import('data:text/javascript;base64,'+Buffer.from(read('jujutsu/three.module.min.js')).toString('base64'));
 const combat=read('jujutsu/battleground-combat.js'),mp=read('jujutsu/mp.js');
 const V=(...p)=>new THREE.Vector3(...p),messages=[];
 class Enemy{damage(){}drawBars(){}}
 const ctx={THREE,Enemy,console,Math,Number,Set,Map,V,clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),dir:y=>V(Math.sin(y),0,Math.cos(y)),
  player:{pos:V(),vel:V(),hp:100,maxHp:100,facing:0,stunT:0,iframes:0,blocking:false,char:'ryu'},
  MP:{id:'attacker',relay:{pub:m=>messages.push(m)}},round2:n=>Math.round(n*100)/100,
  MPJJ:{fighters:{attacker:{e:{pos:V(0,0,4)}}}},
  JJFIGHT:{},JJAW:{gain(){}},core:()=>false,cancel(){},startFall(){},guardHeld:true,queued:0,
  blockFX:e=>{e.blocks=(e.blocks||0)+1;},hurtPlayer(n){ctx.player.hp-=n;return true;}
 };
 ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(combat.slice(combat.indexOf('  function blocked('),combat.indexOf('  function blockFX(')),ctx);ctx.JJFIGHT.blocked=ctx.blocked;ctx.JJFIGHT.blockFX=ctx.blockFX;
 vm.runInContext(combat.slice(combat.indexOf('  const previousHurt ='),combat.indexOf('  function pack(a)')),ctx);
 vm.runInContext('const C=JJFIGHT;const received=new Set();'+combat.slice(combat.indexOf('  C.hitData ='),combat.indexOf('  const previousEnemyUpdate')),ctx);
 ctx.JJFIGHT.networkHit=ctx.networkHit;
 vm.runInContext(mp.slice(mp.indexOf('  var _enemyDamage ='),mp.indexOf('  var _enemyProj =')),ctx);
 const target=new Enemy();Object.assign(target,{net:{id:'victim'},pos:V(0,0,4),hp:100,dead:false,facing:Math.PI,blocking:true,stunT:0});
 // The actual legacy sender now attaches source + guard metadata.
 target.damage(14,V(0,4,12),{react:'stagger'});const msg=messages.pop();assert.equal(msg.bc.g,1);assert.equal(msg.bc.b,0);assert.deepEqual([...msg.bc.p],[0,0,0]);assert.ok(Number.isSafeInteger(msg.bc.id));assert.equal(target.hp,100,'blocked prediction does not lower proxy health');
 // Victim faces the attacker at z=0.
 ctx.player.pos.set(0,0,4);ctx.player.facing=Math.PI;ctx.player.blocking=true;ctx.player.hp=100;
 assert.equal(ctx.networkHit(msg),false);assert.equal(ctx.player.hp,100);assert.equal(ctx.player.blocks,1);
 assert.equal(ctx.networkHit(msg),false);assert.equal(ctx.player.blocks,1,'duplicate block not replayed');
 // The same attack bypasses guard from behind; deliberate guard breaks retain it.
 const rear={...msg,bc:{...msg.bc,id:msg.bc.id+1,p:[0,0,8]}};assert.equal(ctx.networkHit(rear),true);assert.equal(ctx.player.hp,86);
 ctx.player.blocking=true;ctx.player.stunT=0;
 const breaker={...msg,bc:{...msg.bc,id:msg.bc.id+2,b:1}};assert.equal(ctx.networkHit(breaker),true);assert.equal(ctx.player.hp,72);
 // Compatibility with old peers lacking bc still uses their known position.
 ctx.player.blocking=true;ctx.player.stunT=0;ctx.MPJJ.fighters.attacker.e.pos.set(0,0,0);
 assert.equal(ctx.networkHit({id:'attacker',d:10,kx:0,ky:0,kz:10}),false);assert.equal(ctx.player.hp,72);
 const forged={...msg,bc:{...msg.bc,id:msg.bc.id+3,p:[NaN,0,0]}};assert.equal(ctx.networkHit(forged),false);
 console.log('PASS actual MP sender/receiver: legacy skill guard, proxy prediction, front/rear, guard break, old-peer fallback, duplicate and invalid hits');
 // Exercise the real debris integrator: large chunks rise only 2.2 units,
 // hover at a fixed height, then resume gravity and expire within the pool.
 const destruction=read('jujutsu/destruction.js'),d={THREE,V,Math,Map,Set,scene:new THREE.Scene(),MAX_DEBRIS:192,settings:{debris:192},
  D:{parts:[[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,.5,.55,.6]]},J:{root:{},transform:()=>new THREE.Matrix4(),floor:()=>0},
  online:()=>false,authority:()=>false,prepare(){},states:new Map(),time:0,pool:null,debris:[],debrisCursor:0,syncClock:0,room:null};
 vm.createContext(d);vm.runInContext(destruction.slice(destruction.indexOf('  function poolMesh()'),destruction.indexOf('  function publish('))+destruction.slice(destruction.indexOf('  function update(dt)'),destruction.indexOf('  function configure(')),d);
 vm.runInContext("spawnDebris([{id:0,b:[-4,0,-4,4,8,4]},{id:0,b:[-1,0,-1,1,2,1]}],V(),true);",d);
 assert.ok(d.debris[0].size.x>6);assert.ok(d.debris[1].size.x<=2);
 for(let i=0;i<30;i++)d.update(.02);const y=d.debris[0].pos.y;assert.ok(Math.abs(y-6.2)<.01);
 for(let i=0;i<30;i++)d.update(.02);assert.equal(d.debris[0].pos.y,y,'slab holds in midair');
 for(let i=0;i<35;i++)d.update(.02);assert.ok(d.debris[0].pos.y<y,'slab falls after hold');
 for(let i=0;i<150;i++)d.update(.02);assert.equal(d.debris.length,0);
 console.log('PASS real destruction chunks: deliberate large slabs, low rise, hover, drop, bounded cleanup');
})().catch(e=>{console.error(e);process.exitCode=1;});
