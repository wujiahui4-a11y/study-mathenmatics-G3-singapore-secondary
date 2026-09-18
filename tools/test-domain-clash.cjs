/* Real clash module, isolated browser contexts, queued peer transport and Three.js.
   No network, WebGL or npm install required. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
(async()=>{
  const THREE=await import('data:text/javascript;base64,'+Buffer.from(read('jujutsu/three.module.min.js')).toString('base64'));
  const source=read('jujutsu/domain-clash.js');
  class Element {constructor(){this.style={};this.nodes={};}appendChild(){}querySelector(s){return this.nodes[s]??=new Element();}}
  function room(chars=['gojo','yuji','naoya'],distance=12){
    const clients=[],queue=[],packets=[];let drop=()=>false;
    chars.forEach((char,i)=>{
      const id=String.fromCharCode(97+i),events={},c={THREE,console,Math,Date,Map,Set,
        document:{createElement:()=>new Element(),body:new Element()},keys:{},CHARS:{gojo:{},yuji:{},naoya:{}},
        scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),JJMAP:{id:'jjs'},opened:[],
        player:{char,rig:{},pos:new THREE.Vector3(i*distance,0,0),vel:new THREE.Vector3(),dead:false,action:null,iframes:0},
        MPJJ:{active:true,id,code:'TEST',fighters:{},relay:{pub(m){packets.push(m);queue.push(m);}}},
        gameInputActive:()=>!c.paused,typingInUI:e=>!!e.typing,
        clearMovement(){c.keys={};},JJFIGHT:{clearInput(){}},JJFX:{letterbox(){}},JJSTAGE:{hud(){}},
        stepAction(a){if(!a.open&&a.t>=1.6){a.open=true;c.opened.push(a.type);}},
        updatePlayer(dt){const a=c.player.action;if(a){a.t+=dt;c.stepAction(a,dt);if(a.t>=a.dur)c.player.action=null;}},
        hurtPlayer(){return true;},switchChar(id){c.player.char=id;c.player.rig={};c.player.action=null;},updateCamera(){},
        addEventListener(n,f){(events[n]??=[]).push(f);}
      };
      c.window=c;c.events=events;vm.createContext(c);vm.runInContext(source,c);clients.push(c);
    });
    for(const c of clients)for(const peer of clients)if(peer!==c)c.MPJJ.fighters[peer.MPJJ.id]={char:peer.player.char,e:peer.player};
    function flush(){let guard=0;while(queue.length){assert.ok(++guard<1000,'bounded transport');const m=queue.shift();for(const c of clients)if(c.MPJJ.id!==m.id&&!drop(m,c))c.JJDOMAINCLASH.receive(JSON.parse(JSON.stringify(m)));}}
    function tick(t){for(let i=0;i<Math.ceil(t/.02);i++){for(const c of clients)c.updatePlayer(.02);flush();}}
    function cast(i){const c=clients[i];c.player.action={type:c.player.char==='gojo'?'aw_domain':'s4',t:0,dur:4.8};}
    function key(i,repeat=false,up=true){const c=clients[i],e={code:'Space',repeat,preventDefault(){this.prevented=true;},stopImmediatePropagation(){}};c.JJDOMAINCLASH.input(e);if(up)for(const f of c.events.keyup)f({code:'Space'});flush();return e;}
    function active(){cast(0);cast(1);tick(1.3);for(const c of clients)assert.equal(c.JJDOMAINCLASH.audit().match?.phase,'active');assert.ok(clients.every(c=>c.opened.length===0));}
    tick(.02);return {clients,queue,packets,flush,tick,cast,key,active,drop(fn){drop=fn;}};
  }
  for(const winner of [0,1]){
    const r=room();r.active();const [a,b,s]=r.clients;
    assert.equal(a.hurtPlayer(1),false,'participants protected');assert.equal(s.hurtPlayer(1),true,'spectator unchanged');
    assert.equal(r.key(2).prevented,undefined,'spectator can jump');
    r.key(winner,false,false);r.tick(.1);r.key(winner,true,false);r.tick(.1);r.key(winner,false,false);
    assert.equal(a.JJDOMAINCLASH.audit().match.scores[r.clients[winner].MPJJ.id],1,'hold and OS repeat count once');
    for(const f of r.clients[winner].events.keyup)f({code:'Space'});
    for(let n=0;n<10;n++){r.tick(.1);r.key(winner);if(n<3)r.key(1-winner);}
    const m=a.JJDOMAINCLASH.audit().match;
    a.JJDOMAINCLASH.receive({t:'dc-press',id:'c',duel:m.id,room:'TEST',map:'jjs',count:80});
    a.JJDOMAINCLASH.receive({t:'dc-press',id:'b',duel:m.id,room:'TEST',map:'jjs',count:1000});
    b.JJDOMAINCLASH.receive({t:'dc-state',id:'c',duel:m.id,room:'TEST',map:'jjs',rev:999,phase:'active',left:1,scores:{a:100,b:0}});
    assert.deepEqual(a.JJDOMAINCLASH.audit().match.scores,m.scores,'unknown participant and flood rejected');
    const old=r.packets.find(p=>p.t==='dc-state');b.JJDOMAINCLASH.receive(old);
    assert.deepEqual(JSON.parse(JSON.stringify(b.JJDOMAINCLASH.audit().match.scores)),JSON.parse(JSON.stringify(m.scores)),'stale and forged snapshots rejected');
    r.tick(5);
    for(const c of r.clients){assert.equal(c.JJDOMAINCLASH.locked(),false);assert.equal(c.JJDOMAINCLASH.audit().match,null);}
    r.tick(2);assert.deepEqual(r.clients[winner].opened,[winner===0?'aw_domain':'s4']);assert.deepEqual(r.clients[1-winner].opened,[]);
    assert.equal(a.JJDOMAINCLASH.audit().result,b.JJDOMAINCLASH.audit().result,'single shared result');
    b.JJDOMAINCLASH.receive(r.packets.find(p=>p.t==='dc-start'));assert.equal(b.JJDOMAINCLASH.audit().match,null,'finished contest cannot replay');
  }
  console.log('PASS both winners, spectator, Space release/repeat, score validation, shared result, winner-only activation');

  {const r=room();r.active();r.tick(6);assert.equal(r.clients[0].JJDOMAINCLASH.audit().match.overtime,true);r.tick(3.3);assert.ok(r.clients.every(c=>!c.player.action&&!c.JJDOMAINCLASH.locked()&&c.opened.length===0));}
  for(const [chars,distance] of [[['gojo','gojo'],12],[['gojo','yuji'],140]]){const r=room(chars,distance);r.cast(0);r.cast(1);r.tick(3.4);assert.ok(r.clients.every(c=>c.opened.length===1&&!c.JJDOMAINCLASH.audit().match));}
  {const r=room();r.cast(0);r.tick(3.4);assert.equal(r.clients[0].opened.length,1,'uncontested cast resumes');}
  {const r=room();r.clients[0].MPJJ.active=false;r.cast(0);r.tick(1.7);assert.equal(r.clients[0].opened.length,1,'offline cast has no wait');}
  console.log('PASS overtime draw, same domain, separated domains, uncontested and offline casts');

  for(const cause of ['pause','death','switch','room','disconnect']){
    const r=room();r.active();const [a,b]=r.clients;
    if(cause==='pause')b.paused=true;
    if(cause==='death')b.player.dead=true;
    if(cause==='switch')b.switchChar('naoya');
    if(cause==='room'){b.MPJJ.code='OTHER';delete a.MPJJ.fighters.b;}
    if(cause==='disconnect'){delete a.MPJJ.fighters.b;delete b.MPJJ.fighters.a;r.drop(()=>true);}
    r.tick(4);assert.ok(!a.JJDOMAINCLASH.locked()&&!b.JJDOMAINCLASH.locked(),cause+' cannot strand casters');
    if(cause!=='disconnect'){r.tick(2);assert.equal(a.opened.length,1,cause+' opponent wins');assert.equal(b.opened.length,0);}
  }
  {const r=room();let dropped=false;r.drop(m=>m.t==='dc-start'&&!dropped&&(dropped=true));r.active();assert.ok(dropped,'start retry delivered');}
  {const r=room();r.active();r.drop(m=>m.t==='dc-press');for(let i=0;i<7;i++){r.tick(.1);r.key(1);}r.drop(()=>false);r.tick(.1);r.key(1);assert.equal(r.clients[0].JJDOMAINCLASH.audit().match.scores.b,8,'cumulative count survives packet loss');}
  console.log('PASS pause, death, switch, room change, disconnect, start retry, cumulative packet recovery');
  assert.ok(read('jujutsu/base.html').includes('JJDOMAINCLASH.input(e)'));
  assert.ok(read('jujutsu/mp.js').includes('JJDOMAINCLASH.receive(m)'));
  for(const f of ['jujutsu-multiplayer.html','jujutsu-parts/p5.js'])assert.ok(read(f).includes(source.trim()),f+' current clash build');
  console.log('PASS input, transport and generated build hooks');
})().catch(e=>{console.error(e);process.exitCode=1;});
