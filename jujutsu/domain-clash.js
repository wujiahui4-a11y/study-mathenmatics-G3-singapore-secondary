/* Gojo / Sukuna domain contest. One of the two casters coordinates scores;
   spectators only render snapshots. Existing domain code runs only on victory.
   The room still uses the game's peer relay, not an authoritative server. */
(function () {
  'use strict';
  const KINDS = { aw_domain: 'void', s4: 'shrine' };
  const V = (p) => new THREE.Vector3(...p);
  const WAIT = 1.5, ROUND = 6, OVERTIME = 3, RANGE = 102;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  let clock=0,serial=0,scope='',pending=null,match=null,spaceHeld=false,lastTap=-10;
  let sentAt=-10,view=null,resultUntil=0,resultText='';
  const offers=new Map(),retired=new Set();
  const C=window.JJDOMAINCLASH={receive,input,press,cancel,gate,
    locked:()=>!!pending,
    audit:()=>({pending:pending?.kind||null,match:match?{id:match.id,leader:match.leader,phase:match.phase,left:match.left,scores:{...match.scores},pair:match.pair.map(p=>({...p})),overtime:match.overtime}:null,result:resultText})};
  const online=()=>!!window.MPJJ?.active;
  const localId=()=>MPJJ.id;
  const context=()=>online()?MPJJ.code+'|'+JJMAP.id:'';
  const send=m=>{if(online()&&MPJJ.relay)MPJJ.relay.pub({...m,id:localId(),room:MPJJ.code,map:JJMAP.id});};
  const remember=id=>{retired.add(id);if(retired.size>128)retired.delete(retired.values().next().value);};
  const actor=id=>id===localId()?player:MPJJ.fighters[id]?.e;
  const charFor=id=>id===localId()?player.char:MPJJ.fighters[id]?.char;
  const mine=()=>match?.pair.find(p=>p.id===localId());
  const isLeader=()=>match?.leader===localId();
  const validPoint=p=>Array.isArray(p)&&p.length===3&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<4000);
  const validToken=t=>typeof t==='string'&&t.length>0&&t.length<100;
  function validOffer(o){
    return o&&validToken(o.token)&&validPoint(o.p)&&['void','shrine'].includes(o.kind)&&
      !!actor(o.id)&&charFor(o.id)===(o.kind==='void'?'gojo':'yuji')&&!actor(o.id).dead;
  }
  const overlap=(a,b)=>a.kind!==b.kind&&V(a.p).distanceTo(V(b.p))<=RANGE;
  function publishOffer(){if(pending)send({t:'dc-offer',token:pending.token,kind:pending.kind,p:pending.p});}
  function pairOf(a,b){return [a,b].sort((x,y)=>x.id<y.id?-1:1).map(o=>({id:o.id,token:o.token,kind:o.kind,p:o.p.slice()}));}
  const matchId=pair=>pair.map(p=>p.id+':'+p.token).join('|');
  function offer(a){
    const kind=KINDS[a.type],p=player.pos.toArray(),token=localId()+'-'+Date.now().toString(36)+'-'+(++serial).toString(36);
    pending={a,kind,p,token,rig:player.rig,char:player.char,at:clock,dur:a.dur};
    offers.set(localId(),{id:localId(),kind,p,token,seen:clock});
    publishOffer();sentAt=clock;tryStart();
  }
  function tryStart(){
    if(!pending||match)return;
    const own=offers.get(localId());
    for(const peer of [...offers.values()].sort((a,b)=>a.id.localeCompare(b.id))){
      if(peer.id===localId()||clock-peer.seen>WAIT||!validOffer(peer)||!overlap(own,peer))continue;
      const pair=pairOf(own,peer);
      if(pair[0].id!==localId())continue;
      install(pair);send({t:'dc-start',pair,duel:match.id});break;
    }
  }
  function install(pair){
    match={id:matchId(pair),leader:pair[0].id,pair,phase:'waiting',left:2.5,scores:{},ready:new Set(),seq:0,rx:-1,seen:clock,elapsed:0,overtime:false};
    pair.forEach(p=>{match.scores[p.id]=0;});
    if(mine()){match.ready.add(localId());spaceHeld=false;lastTap=-10;clearMovement();window.JJFIGHT?.clearInput();
      window.JJFX?.letterbox(false);window.JJSTAGE?.hud(true);}
    makeView();render();
  }
  function startSnapshot(){
    if(!match)return;
    send({t:'dc-state',duel:match.id,rev:++match.seq,phase:match.phase,left:match.left,scores:{...match.scores},overtime:match.overtime});
  }
  function validPair(pair){
    if(!Array.isArray(pair)||pair.length!==2||!pair.every(p=>p&&typeof p.id==='string')||pair[0].id>=pair[1].id)return false;
    return pair.every(p=>{const o=offers.get(p.id);return validOffer(p)&&o&&o.token===p.token&&o.kind===p.kind&&clock-o.seen<=2.5&&V(o.p).distanceTo(V(p.p))<.01;})&&overlap(pair[0],pair[1]);
  }
  function release(winner,reason){
    if(!match)return;
    const m=match,part=mine();remember(m.id);m.pair.forEach(p=>{remember(p.token);offers.delete(p.id);});
    if(part&&pending){
      const p=pending;pending=null;
      if(winner===localId()&&!player.dead&&player.char===p.char&&player.rig===p.rig&&player.action===p.a){
        Object.assign(p.a,{t:0,dur:p.dur,stage:0,sk:0,__domainApproved:true});
        player.iframes=Math.max(player.iframes||0,1);
      }else if(player.action===p.a){player.action=null;player.iframes=0;player.vel.set(0,0,0);}
      clearMovement();spaceHeld=false;window.JJSTAGE?.hud(true);window.JJFX?.letterbox(false);
    }
    const won=m.pair.find(p=>p.id===winner);
    resultText=won?(won.kind==='void'?'UNLIMITED VOID':'MALEVOLENT SHRINE')+' WINS':reason==='draw'?'DRAW — BOTH DOMAINS CANCELLED':'DOMAIN CLASH CANCELLED';
    resultUntil=clock+2;match=null;destroyView();render();
  }
  function finish(winner,reason){if(!isLeader())return;send({t:'dc-end',duel:match.id,winner,reason});release(winner,reason);}
  function restoreSingle(){
    if(!pending)return;const p=pending;pending=null;offers.delete(localId());remember(p.token);
    send({t:'dc-withdraw',token:p.token});
    p.a.__domainApproved=true;p.a.t=0;p.a.dur=p.dur;render();
  }
  function cancel(reason='cancelled'){
    if(match&&mine()){
      const other=match.pair.find(p=>p.id!==localId());
      if(isLeader())finish(other.id,reason);
      else {send({t:'dc-forfeit',duel:match.id});release(other.id,reason);}
    }else if(pending){
      send({t:'dc-withdraw',token:pending.token});remember(pending.token);offers.delete(localId());
      if(player.action===pending.a)player.action=null;pending=null;
      window.JJSTAGE?.hud(true);window.JJFX?.letterbox(false);
    }
    spaceHeld=false;render();
  }
  function receive(m){
    if(typeof m?.t!=='string'||!m.t.startsWith('dc-'))return false;
    if(!online()||m.room!==MPJJ.code||m.map!==JJMAP.id||m.id===localId())return true;
    if(m.t==='dc-offer'){
      const o={id:m.id,token:m.token,kind:m.kind,p:m.p,seen:clock};
      if(validOffer(o)&&!retired.has(o.token)){offers.set(m.id,o);tryStart();}return true;
    }
    if(m.t==='dc-withdraw'){
      if(offers.get(m.id)?.token===m.token){offers.delete(m.id);remember(m.token);}return true;
    }
    if(m.t==='dc-start'){
      if(retired.has(m.duel))return true;
      if(match){if(match.id===m.duel&&m.id===match.leader&&mine())send({t:'dc-ready',duel:m.duel});return true;}
      if(!validPair(m.pair)||m.id!==m.pair[0].id||m.duel!==matchId(m.pair))return true;
      const own=m.pair.find(p=>p.id===localId());
      if(own&&(!pending||pending.token!==own.token))return true;
      install(m.pair);if(own)send({t:'dc-ready',duel:match.id});return true;
    }
    if(!match||m.duel!==match.id)return true;
    const part=match.pair.find(p=>p.id===m.id);
    if(m.t==='dc-ready'&&isLeader()&&part){match.ready.add(m.id);return true;}
    if(m.t==='dc-press'&&isLeader()&&part){score(m.id,m.count);return true;}
    if(m.t==='dc-forfeit'&&isLeader()&&part){finish(match.pair.find(p=>p.id!==m.id).id,'forfeit');return true;}
    if(m.id!==match.leader)return true;
    if(m.t==='dc-state'){
      if(!Number.isSafeInteger(m.rev)||m.rev<=match.rx||!['waiting','countdown','active'].includes(m.phase)||
        !Number.isFinite(m.left)||m.left<0||m.left>ROUND||!m.scores||
        !match.pair.every(p=>Number.isInteger(m.scores[p.id])&&m.scores[p.id]>=match.scores[p.id]&&m.scores[p.id]<=130))return true;
      match.rx=m.rev;match.seen=clock;match.phase=m.phase;match.left=m.left;match.scores={...m.scores};match.overtime=!!m.overtime;render();return true;
    }
    if(m.t==='dc-end'&&(m.winner===''||match.pair.some(p=>p.id===m.winner))){release(m.winner,m.reason);return true;}
    return true;
  }
  function score(id,count){
    if(!match||match.phase!=='active'||!Number.isInteger(count)||count<=match.scores[id])return false;
    // Allow normal tapping and short network bursts; reject repeats/replays/floods.
    if(count>Math.min(130,Math.floor(match.elapsed*14)+2))return false;
    match.scores[id]=count;startSnapshot();render();return true;
  }
  let localCount=0,lastMatch='';
  function press(){
    if(!mine()||match.phase!=='active'||!gameInputActive()||player.dead||clock-lastTap<.075)return false;
    if(lastMatch!==match.id){localCount=0;lastMatch=match.id;}
    lastTap=clock;localCount=Math.max(localCount,match.scores[localId()])+1;
    if(isLeader())return score(localId(),localCount);
    send({t:'dc-press',duel:match.id,count:localCount});return true;
  }
  function input(e){
    if(!pending||typingInUI(e)||e.ctrlKey||e.metaKey||e.altKey)return false;
    if(!/^(Space|Digit[1-4]|Key[RFGQEXC])$/.test(e.code))return false;
    if(e.code==='Space'&&!e.repeat&&!spaceHeld){spaceHeld=true;press();}
    keys.Space=false;e.preventDefault();e.stopImmediatePropagation();return true;
  }
  window.addEventListener('keyup',e=>{if(e.code==='Space'){spaceHeld=false;keys.Space=false;}});
  window.addEventListener('blur',()=>{spaceHeld=false;});
  function gate(a,dt){
    if(!KINDS[a.type]||a.__domainApproved||player.ai||!online())return false;
    if(!pending)offer(a);
    if(pending.a!==a)return false;
    a.t=.55;a.dur=Math.max(a.dur,15);player.vel.set(0,0,0);player.iframes=Math.max(player.iframes||0,.2);
    if(!match&&clock-pending.at>=WAIT){restoreSingle();return false;}
    return true;
  }
  function update(dt){
    clock+=Math.max(0,Math.min(.25,dt));
    if(scope!==context()){
      cancel('room changed');if(match){match=null;destroyView();}offers.clear();retired.clear();scope=context();render();
    }
    if(pending&&(player.dead||player.rig!==pending.rig||player.char!==pending.char||player.action!==pending.a||!gameInputActive()))cancel('forfeit');
    if(pending&&!match&&clock-sentAt>.3){publishOffer();sentAt=clock;tryStart();}
    for(const [id,o] of offers)if(id!==localId()&&clock-o.seen>3)offers.delete(id);
    if(match){
      if(isLeader()){
        const gone=match.pair.find(p=>!actor(p.id)||actor(p.id).dead||charFor(p.id)!==(p.kind==='void'?'gojo':'yuji'));
        if(gone){finish(match.pair.find(p=>p.id!==gone.id).id,'forfeit');return;}
        match.left-=dt;
        if(match.phase==='waiting'&&match.ready.size===2){match.phase='countdown';match.left=1;}
        else if(match.phase==='waiting'&&match.left<=0){finish('','connection');return;}
        else if(match.phase==='countdown'&&match.left<=0){match.phase='active';match.left=ROUND;match.elapsed=0;spaceHeld=false;}
        else if(match.phase==='active'){
          match.elapsed+=dt;
          if(match.left<=0){const [a,b]=match.pair,d=match.scores[a.id]-match.scores[b.id];
            if(d===0&&!match.overtime){match.overtime=true;match.left=OVERTIME;}
            else {finish(d===0?'':d>0?a.id:b.id,d===0?'draw':'score');return;}}
        }
        if(clock-sentAt>.12){if(match.phase==='waiting')send({t:'dc-start',pair:match.pair,duel:match.id});startSnapshot();sentAt=clock;}
      }else if(clock-match.seen>3){
        // A disconnected coordinator cannot leave a participant frozen forever.
        if(mine())release(!actor(match.leader)?localId():'','connection');else{match=null;destroyView();}return;
      }
      animateView();render();
    }else if(clock>=resultUntil)render();
  }
  const oldStep=stepAction;stepAction=function(a,dt){if(gate(a,dt))return;return oldStep(a,dt);};
  const oldUpdate=updatePlayer;updatePlayer=function(dt){update(dt);return oldUpdate(dt);};
  const oldHurt=hurtPlayer;hurtPlayer=function(n,k,o){if(pending)return false;return oldHurt(n,k,o);};
  const oldSwitch=switchChar;switchChar=function(id,quiet){if(id!==player.char&&CHARS[id])cancel('forfeit');return oldSwitch(id,quiet);};
  const oldCamera=updateCamera;updateCamera=function(dt){
    if(mine()){
      const center=V(match.pair[0].p).lerp(V(match.pair[1].p),.5),d=V(match.pair[1].p).sub(V(match.pair[0].p)).setY(0);
      const size=clamp(d.length()*.6+12,16,55);if(d.lengthSq()<.01)d.set(0,0,1);d.normalize();
      camera.position.lerp(center.clone().add(new THREE.Vector3(d.z*size,10,-d.x*size)),Math.min(1,dt*6));
      camera.lookAt(center.clone().add(new THREE.Vector3(0,3,0)));return;
    }return oldCamera(dt);
  };
  const ui=document.createElement('section');ui.id='jjDomainClash';ui.style.cssText='display:none;position:fixed;left:50%;top:18%;transform:translateX(-50%);width:min(520px,88vw);padding:18px;background:#10141dec;border:2px solid #fff;color:#fff;text-align:center;font:700 18px system-ui;z-index:120;pointer-events:none';
  ui.innerHTML='<div data-title>DOMAIN CLASH</div><div data-prompt></div><div style="height:12px;background:#ef6870;margin:12px 0"><div data-fill style="height:100%;width:50%;background:#94d8ff"></div></div><div data-score></div>';
  document.body.appendChild(ui);
  function render(){
    ui.style.display=match||pending||clock<resultUntil?'block':'none';
    ui.querySelector('[data-title]').textContent=match?'DOMAIN CLASH':pending?'DOMAIN EXPANSION':resultText;
    ui.querySelector('[data-prompt]').textContent=match?(match.phase==='active'?(mine()?'TAP SPACE REPEATEDLY':'DOMAIN CLASH IN PROGRESS')+(match.overtime?' · OVERTIME':'')+' · '+Math.max(0,match.left).toFixed(1)+'s':match.phase==='countdown'?'GET READY · '+Math.ceil(match.left):'DOMAINS COLLIDING'):pending?'Gathering the barrier…':'';
    const go=match?.pair.find(p=>p.kind==='void'),su=match?.pair.find(p=>p.kind==='shrine');
    const a=go?match.scores[go.id]:0,b=su?match.scores[su.id]:0;
    ui.querySelector('[data-fill]').style.width=(a+b?a/(a+b)*100:50)+'%';
    ui.querySelector('[data-score]').textContent=match?'GOJO '+a+' — '+b+' SUKUNA':'';
  }
  function makeView(){
    destroyView();view=new THREE.Group();scene.add(view);
    match.pair.forEach(p=>{const g=new THREE.Group();g.position.copy(V(p.p)).add(new THREE.Vector3(0,3,0));view.add(g);
      const color=p.kind==='void'?0x94d8ff:0xff6970;
      for(let i=0;i<3;i++){const mesh=new THREE.Mesh(new THREE.TorusGeometry(4+i*.5,.09,5,40),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false}));mesh.rotation.x=i*Math.PI/3;g.add(mesh);}
    });
  }
  function animateView(){if(!view)return;view.children.forEach((g,i)=>{g.rotation.y=clock*(i?-.8:.8);g.scale.setScalar(1+Math.sin(clock*6+i)*.08);});}
  function destroyView(){if(!view)return;view.removeFromParent();view.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});view=null;}
})();
