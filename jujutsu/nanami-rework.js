/* Nanami's skill controller. Hit ownership stays with the victim; paired
   sequences reserve both actors, retry their timeline, and expire safely. */
(function(){
  'use strict';
  if(!window.JJNANAMI||!window.JJFIGHT)return;
  const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const dir=y=>V(Math.sin(y),0,Math.cos(y)),fx=(k,...a)=>window.JJNANAMIFX?.[k]?.(...a);
  const K=[{type:'nx1',cd:'w1',wait:7,dur:1.4},{type:'nx_charge',cd:'w2',wait:9,dur:3.5},
    {type:'nx3',cd:'w3',wait:10,dur:1.25},{type:'nx4',cd:'w4',wait:16,dur:1.5},{type:'nxr',cd:'wr',wait:24,dur:.85}];
  const PAIR={ratio:{dur:1.7,damage:28},counter:{dur:1.55,damage:24},finish3:{dur:2.15,damage:7}};
  const S=window.JJNANAMIX={cast,release,input,pack,remoteState,receive,strikeM1,cleanup,tryCounter,
    locked:()=>!!player.nxHold||(!player.ai&&!!S.reservation),sessions:new Map(),cine:null,reservation:null,
    poseM1:(r,a)=>fx('poseM1',r,a),audit:()=>({sessions:S.sessions.size,held:S.locked(),overtime:player.nxOvertime||0,charge:player.action?.ratio||0})};
  let time=0,serial=0,context='',rig=player.rig,character=player.char;
  const done=new Set(),outgoing=new Map();
  S.sentHit=(e,m)=>{if(e.net&&Number.isSafeInteger(m.id))outgoing.set(m.id,{to:e.net.id,at:time});};
  const online=()=>!!window.MPJJ?.active&&!!MPJJ.relay&&!player.ai;
  const self=()=>online()?MPJJ.id:'local';
  const scope=()=>(online()?MPJJ.code:'offline')+'|'+(window.JJMAP?.id||'');
  const send=m=>{if(online())MPJJ.relay.pub({...m,id:self(),room:MPJJ.code,map:window.JJMAP?.id});};
  const token=()=>self()+':n:'+Date.now().toString(36)+':'+(++serial).toString(36);
  const actor=id=>id===self()?player:window.MPJJ?.fighters?.[id]?.e;
  const alive=e=>!!e&&!e.dead&&e.hp>0;
  const free=e=>alive(e)&&!(e.iframes>0)&&!e.rag&&!e.bcFall&&!e.cineHold&&!e.nxHold;
  const visible=(a,b)=>JJFIGHT.actors.visible(a.clone().add(V(0,2.5,0)),b.clone().add(V(0,2.5,0)));
  const point=p=>Array.isArray(p)&&p.length===3&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<1e5);
  const remember=id=>{done.add(id);if(done.size>256)done.delete(done.values().next().value);};
  function cast(slot){
    const k=K[slot];if(!k||player.char!=='nanami'||!gameInputActive()||!alive(player)||busy()||player.react||S.locked()||JJFIGHT.locked()||cds[k.cd]>0)return false;
    JJFIGHT.clearInput();cds[k.cd]=k.wait;
    player.action={type:k.type,t:0,dur:k.dur,stage:0,dir:dir(player.facing),facing:player.facing,event:token(),hits:new Set(),ratio:5};
    return true;
  }
  function release(){
    const a=player.action;if(a?.type!=='nx_charge'||S.locked())return false;
    a.type='nx2';a.ratio=a.t>=.65?7:5+Math.floor(clamp(a.t/.65)*2);a.perfect=a.ratio===7;a.t=0;a.dur=.7;a.stage=0;
    a.dir.copy(dir(player.facing));a.facing=player.facing;return true;
  }
  function input(e){
    if(S.locked()&&/^(Key[WASDQRFGE]|Space|Digit[1-4])$/.test(e.code)){e.preventDefault();e.stopImmediatePropagation();return true;}
    if(player.char!=='nanami'||!gameInputActive()||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return false;
    const n=e.code==='KeyR'?4:/^Digit[1-4]$/.test(e.code)?+e.code.slice(-1)-1:-1;
    if(n<0)return false;cast(n);e.preventDefault();e.stopImmediatePropagation();return true;
  }
  function candidates(a,reach,cone=-.1){
    return enemies.filter(e=>free(e)&&Math.abs(e.pos.y-player.pos.y)<5&&visible(player.pos,e.pos)).filter(e=>{
      const v=e.pos.clone().sub(player.pos).setY(0),d=v.length();return d<=reach&&(d<.3||v.normalize().dot(a.dir)>=cone);
    }).sort((a,b)=>a.pos.distanceToSquared(player.pos)-b.pos.distanceToSquared(player.pos));
  }
  function meta(a,kind,perfect=false,down=0){return {id:Date.now()*1000+(++serial%1000),kind:'nanami-'+kind,guardable:true,breakGuard:false,
    source:player.pos.clone(),stun:.58,down,variant:'normal',nanami:{kind,perfect:!!perfect}};}
  function hit(e,n,k,m){return e.damage(n,k,{combat:m,stun:m.stun,fin:false,bleed:false,death:'ragdoll',noFrameBonus:true,
    spark:0xdff7ff,react:m.down?'blow':'stagger',reactDur:.28});}
  function outcome(e,m,lethal,origin){
    const p=e.pos.clone(),head=m.nanami.kind==='counter';
    if(m.nanami.kind==='trio')e.vel.set(0,0,0);
    fx('mark',e,!!m.nanami.perfect,head?5:2.6);
    fx('impact',p.clone().add(V(0,head?4.9:2.7,0)),!!m.nanami.perfect,lethal);
    if(lethal)fx('finish',e,m.nanami.kind,!!m.nanami.perfect);
    if(e===player||!e.net)send({t:'nx-impact',event:origin||token(),target:e===player?self():'',p:p.toArray(),k:m.nanami.kind,perfect:!!m.nanami.perfect,lethal:!!lethal,head});
  }
  function strikeM1(a){
    const perfect=(player.nxOvertime||0)>0,last=a.n===3;
    if(last&&!a.worldHit){a.worldHit=true;cds.m1=Math.max(cds.m1,1.5);window.JJDESTRUCT?.hit(player.pos.clone().addScaledVector(a.dir,3.3),3.2);}
    for(const e of candidates(a,6.3,.05)){
      if(a.hits.has(e))continue;a.hits.add(e);
      const m=meta(a,'m1',perfect,last?1.2:0),k=a.dir.clone().multiplyScalar(last?23:2).setY(last?8:.2);
      const hp=e.hp;hit(e,perfect?6:3,k,m);if(e.hp<hp||(e.net&&!JJFIGHT.blocked(e,m)))a.contact=true;
    }
  }
  function begin(kind,e,attack){
    const a=player.action;if(!a||!PAIR[kind]||!free(e))return false;
    if(player.ai){a.confirm=true;hit(e,PAIR[kind].damage,a.dir.clone().multiplyScalar(18).setY(8),meta(a,kind,kind==='ratio',1.4));a.dur=a.t+.25;return true;}
    if(e.net){a.pending={kind,e,attack,since:time,sent:time};a.dur=a.t+1.3;request(a);}
    else installLocal(kind,e);
    return true;
  }
  function request(a){const p=a.pending;send({t:'nx-request',event:a.event,to:p.e.net.id,k:p.kind,p:player.pos.toArray(),d:a.dir.toArray(),attack:p.attack});}
  function installLocal(kind,e){
    const a=player.action,m={event:a.event,by:self(),to:e.net?.id||'dummy',k:kind,p:player.pos.toArray(),q:e.pos.toArray(),d:a.dir.toArray(),time:0};
    const c=install(m,player,e);if(!c)return false;
    a.pending=null;a.confirm=true;a.dur=a.t+c.dur+.2;c.packet={...m,t:'nx-pair'};send(c.packet);return true;
  }
  function install(m,caster,victim){
    if(done.has(m.event)||S.sessions.has(m.event)||!alive(caster)||!alive(victim)||caster.nxHold||victim.nxHold)return null;
    const c={...m,caster,victim,p:V(...m.p),q:V(...m.q),d:V(...m.d).setY(0).normalize(),t:m.time||0,dur:PAIR[m.k].dur,
      own:caster===player||victim===player,local:caster===player,seen:time,sent:-1,saved:[],last:-1};
    for(const e of [caster,victim]){c.saved.push({e,rig:e.rig,char:e.char,iframes:e.iframes||0});e.nxHold=m.event;e.cineHold=true;e.blocking=false;e.react=null;e.vel.set(0,0,0);}
    S.sessions.set(c.event,c);if(c.own){S.cine=c;S.reservation=null;JJFIGHT.clearInput();clearMovement();}fx('cinematic',c);return c;
  }
  function unlock(c){
    for(const s of c.saved)if(s.e.nxHold===c.event){const e=s.e;e.nxHold=null;e.cineHold=false;e.iframes=Math.max(0,s.iframes-c.t);e.rig.root.visible=true;
      e.rig.body.position.set(0,0,0);e.vel.set(0,0,0);if(e===player){player.action=null;JJFIGHT.clearInput();clearMovement();}}
    if(S.cine===c)S.cine=null;fx('endCinema',c);
  }
  function finish(c,complete,broadcast=true){
    if(c.done)return;c.done=true;S.sessions.delete(c.event);remember(c.event);unlock(c);
    if(complete){
      const m={id:Date.now()*1000+(++serial%1000),kind:'nanami-'+c.k,guardable:false,source:c.caster.pos.clone(),stun:.7,down:1.5,variant:'normal',nanami:{kind:c.k,perfect:c.k==='ratio'}};
      const k=c.d.clone().multiplyScalar(c.k==='finish3'?0:22).setY(c.k==='finish3'?0:9),n=PAIR[c.k].damage;
      if(c.victim===player){const hp=player.hp;hurtPlayer(n,k,{combat:m,fin:false,bleed:false,death:'ragdoll',noFrameBonus:true});window.MPJJ?.confirmOwnedHit?.(c.by,hp);}
      else if(!c.victim.net)hit(c.victim,n,k,m);
    }
    if(broadcast&&c.own)send({t:complete?'nx-end':'nx-cancel',event:c.event,to:c.to});
  }
  function unreserve(){if(!S.reservation)return;S.reservation=null;player.cineHold=false;player.nxHold=null;if(player.action?.type==='nx_hold')player.action=null;}
  function stepPairs(dt){
    if(S.reservation){const r=S.reservation;if(time-r.seen>1.1||!online()||!alive(actor(r.by))||!alive(player)||!gameInputActive())unreserve();
      else{player.pos.copy(r.pos);player.vel.set(0,0,0);player.action={type:'nx_hold',t:0,dur:2};}}
    for(const c of [...S.sessions.values()]){
      const broken=c.saved.some(s=>!alive(s.e)||s.e.rig!==s.rig||s.e.char!==s.char);
      const left=online()&&(actor(c.by)!==c.caster||(c.victim.net&&actor(c.to)!==c.victim));
      if(broken||left||(c.own&&!gameInputActive())||((!c.local||c.victim.net)&&time-c.seen>1.25)){finish(c,false);continue;}
      c.t+=dt;if(c.local&&time-c.sent>.14){c.sent=time;send({...c.packet,time:c.t});}
      for(const e of [c.caster,c.victim]){e.iframes=Math.max(.15,e.iframes||0);e.stunT=0;e.react=null;e.vel.set(0,0,0);}
      c.victim.pos.copy(c.q);c.caster.pos.copy(c.p);
      if(c.k==='counter'&&c.t>.22){const back=c.q.clone().addScaledVector(c.d,-2.4);c.caster.pos.copy(back);}
      c.caster.facing=Math.atan2(c.d.x,c.d.z);if(c.k!=='counter')c.victim.facing=c.caster.facing+Math.PI;
      if(c.victim===player)player.action={type:'nx_hold',t:c.t,dur:c.dur+.2};fx('pairPose',c);
      if(c.t>=c.dur)finish(c,true);
    }
  }
  function tryCounter(target,source,attack){
    const a=target?.action;
    if(target?.char!=='nanami'||a?.type!=='nx4'||a.t<.1||a.t>1.3||a.pending||a.confirm||!alive(source)||source===target||target.nxHold)return false;
    if(target.pos.distanceTo(source.pos)>42||!visible(target.pos,source.pos))return false;
    if(target!==player)return false; // AI's actor scope invokes this through its defend delegate.
    a.dir.copy(dir(source.facing));a.facing=Math.atan2(a.dir.x,a.dir.z);
    if(!begin('counter',source,attack))return false;fx('evade',target.pos.clone());return true;
  }
  function incomingSource(opts,k){
    const id=opts?.combat?.attacker;if(id){const e=actor(id)||enemies.find(e=>e.ai?.id===id);if(e)return e;}
    if(opts?.aiSource){const e=enemies.find(e=>e.ai?.id===opts.aiSource);if(e)return e;}
    const p=opts?.combat?.source||(k?player.pos.clone().sub(k):null);if(!p)return null;
    return enemies.filter(alive).sort((a,b)=>a.pos.distanceToSquared(p)-b.pos.distanceToSquared(p))[0]||null;
  }
  const previousHurt=hurtPlayer;
  hurtPlayer=function(n,k,o){
    if(S.locked())return false;
    if(n>0&&tryCounter(player,incomingSource(o,k),o?.combat?.id))return false;
    const hp=player.hp,r=previousHurt(n,k,o);if(player.hp<hp&&o?.combat?.nanami)outcome(player,o.combat,player.dead);
    return r;
  };
  const previousDamage=Enemy.prototype.damage;
  Enemy.prototype.damage=function(n,k,o={}){
    if(this.nxHold)return false;
    if(this.net&&Number.isSafeInteger(o.combat?.id))outgoing.set(o.combat.id,{to:this.net.id,at:time});
    const hp=this.hp,r=previousDamage.call(this,n,k,o);
    if(!this.net&&this.hp<hp&&o.combat?.nanami)outcome(this,o.combat,this.dead);
    return r;
  };
  function step(a,dt){
    if(a.pending){player.vel.x=player.vel.z=0;if(time-a.pending.since>1.1){a.pending=null;a.dur=a.t+.1;}else if(time-a.pending.sent>.14){a.pending.sent=time;request(a);}return;}
    if(a.confirm)return;
    if(player.dead||player.stunT>0||!gameInputActive()){player.action=null;return;}
    const t=a.t;player.vel.x=player.vel.z=0;
    if(a.type==='nx_charge'){a.ratio=t>=.65?7:5+Math.floor(clamp(t/.65)*2);if(t>=3||(player.ai&&t>=.85))release();return;}
    if(a.type==='nx1'){
      if(t>.15&&t<1.18){JJFIGHT.actors.sweepMove(player,a.dir.clone().multiplyScalar(8*dt));
        for(const e of candidates(a,6.4,-1))if(!a.hits.has(e)){a.hits.add(e);hit(e,18,a.dir.clone().multiplyScalar(6).setY(1),meta(a,'spin'));}}
    }else if(a.type==='nx2'){
      if(t<=.24){const before=player.pos.clone();JJFIGHT.actors.sweepMove(player,a.dir.clone().multiplyScalar(105*dt));
        // Sample the swept lane so the instantaneous-looking draw cannot tunnel past a fighter.
        for(const e of enemies){if(!free(e)||a.hits.has(e)||Math.abs(e.pos.y-player.pos.y)>4||!visible(before,e.pos))continue;
          const line=player.pos.clone().sub(before),len=line.lengthSq(),u=len?clamp(e.pos.clone().sub(before).dot(line)/len):0;
          if(e.pos.distanceTo(before.clone().addScaledVector(line,u))>4.3)continue;
          a.hits.add(e);const m=meta(a,'draw',a.perfect,a.perfect?1.4:0);
          if(JJFIGHT.blocked(e,m)){JJFIGHT.blockFX(e);a.dur=t+.15;break;}
          if(a.perfect){if(begin('ratio',e))break;}else hit(e,16,a.dir.clone().multiplyScalar(8).setY(1),m);
        }}
    }else if(a.type==='nx3'){
      for(const [i,at]of [.20,.52,.86].entries())if(a.stage<=i&&t>=at){a.stage=i+1;
        const e=candidates(a,6,.05)[0];if(!e)continue;
        if(i===2&&e.hp<=7&&!JJFIGHT.blocked(e,{guardable:true,source:player.pos})){if(begin('finish3',e))return;}
        hit(e,i===2?7:5,V(),{...meta(a,'trio'),stun:.65});}
    }else if(a.type==='nxr'&&!a.stage&&t>=.55){a.stage=1;player.nxOvertime=16;fx('ignite',player);}
  }
  const previousStep=stepAction;
  stepAction=function(a,dt){if(a?.type?.startsWith('nx')&&a.type!=='nx_hold')return step(a,dt);return previousStep(a,dt);};
  function pack(){const a=player.action;return player.char==='nanami'?{o:Math.ceil((player.nxOvertime||0)*10),r:a?.ratio||5,p:!!a?.perfect}:null;}
  function remoteState(f,m){if(f.char!=='nanami'||!m)return;f.e.nxOvertime=clamp(+m.o||0,0,160)/10;if(f.action){f.action.ratio=clamp(+m.r||5,5,7);f.action.perfect=m.p===true;}fx('look',f.e);}
  function receive(m){
    if(typeof m?.t!=='string'||!m.t.startsWith('nx-'))return false;
    if(!online()||m.id===self()||m.room!==MPJJ.code||m.map!==window.JJMAP?.id||typeof m.event!=='string'||m.event.length>130)return true;
    const f=MPJJ.fighters[m.id],e=f?.e;if(!e)return true;
    if(m.t==='nx-impact'){
      if(!point(m.p)||done.has(m.event)||e.pos.distanceTo(V(...m.p))>12||!['m1','spin','draw','trio','ratio','counter','finish3'].includes(m.k))return true;
      const target=m.target===m.id?e:{pos:V(...m.p)};
      remember(m.event);fx('mark',target,m.perfect===true,m.head?5:2.6);fx('impact',V(...m.p).add(V(0,2.7,0)),m.perfect===true,m.lethal===true);if(m.lethal)fx('finish',target,m.k,m.perfect===true);return true;
    }
    if(m.t==='nx-pair-ack'){const c=S.sessions.get(m.event);if(c?.local&&c.to===m.id&&m.to===self())c.seen=time;return true;}
    if(m.t==='nx-end'||m.t==='nx-cancel'){
      const c=S.sessions.get(m.event);if(c&&(m.id===c.by||m.id===c.to)){if(m.t==='nx-cancel')finish(c,false,false);else if(m.id===c.by&&c.t>=c.dur-.25)finish(c,true,false);}
      if(S.reservation?.event===m.event&&S.reservation.by===m.id)unreserve();return true;
    }
    if(m.t==='nx-ack'){
      const a=player.action;if(a?.event!==m.event||a.pending?.e.net.id!==m.id||m.to!==self())return true;
      if(m.ok)installLocal(a.pending.kind,a.pending.e);else{a.pending=null;a.dur=a.t+.12;}return true;
    }
    if(f.char!=='nanami'||!alive(e))return true;
    if(m.t==='nx-request'){
      if(m.to!==self()||!PAIR[m.k]||!point(m.p)||!point(m.d)||done.has(m.event))return true;
      if(S.reservation?.event===m.event&&S.reservation.by===m.id){S.reservation.seen=time;send({t:'nx-ack',event:m.event,to:m.id,ok:true});return true;}
      const p=V(...m.p),d=V(...m.d),recent=outgoing.get(m.attack),counter=m.k==='counter';
      const validCast=counter?recent?.to===m.id&&time-recent.at<2:m.k==='ratio'?['nx2','nx_charge'].includes(f.action?.type):f.action?.type==='nx3';
      const ok=!!validCast&&free(player)&&!S.locked()&&gameInputActive()&&p.distanceTo(e.pos)<8&&p.distanceTo(player.pos)<(counter?43:8)&&d.length()>.9&&d.length()<1.1&&visible(p,player.pos)&&
        (counter||!JJFIGHT.blocked(player,{guardable:true,source:p}));
      if(ok){S.reservation={event:m.event,by:m.id,seen:time,pos:player.pos.clone()};player.cineHold=true;player.action={type:'nx_hold',t:0,dur:2};JJFIGHT.clearInput();clearMovement();}
      send({t:'nx-ack',event:m.event,to:m.id,ok});return true;
    }
    if(m.t==='nx-pair'){
      if(!PAIR[m.k]||!point(m.p)||!point(m.q)||!point(m.d)||done.has(m.event)||!Number.isFinite(m.time)||m.time<0||m.time>PAIR[m.k].dur+.25)return true;
      const old=S.sessions.get(m.event);if(old){if(old.by===m.id&&old.to===m.to&&old.k===m.k&&m.time>=old.last&&m.time<old.t+.8){old.last=m.time;old.seen=time;old.t=Math.max(old.t,m.time);if(old.victim===player)send({t:'nx-pair-ack',event:m.event,to:m.id});}return true;}
      const victim=actor(m.to);if(!alive(victim)||e.pos.distanceTo(V(...m.p))>45||V(...m.q).distanceTo(victim.pos)>10||V(...m.d).length()<.9||V(...m.d).length()>1.1)return true;
      if(victim===player&&!(S.reservation?.event===m.event&&S.reservation.by===m.id))return true;
      if(victim!==player&&(victim.cineHold||e.cineHold))return true;
      if(victim===player){S.reservation=null;player.cineHold=false;}
      const c=install({...m,by:m.id},e,victim);if(c&&victim===player)send({t:'nx-pair-ack',event:m.event,to:m.id});return true;
    }
    return true;
  }
  function cleanup(){
    for(const c of [...S.sessions.values()])finish(c,false);
    if(S.reservation)send({t:'nx-cancel',event:S.reservation.event,to:S.reservation.by});unreserve();
    if(player.action?.type?.startsWith('nx'))player.action=null;player.nxOvertime=0;outgoing.clear();fx('cleanup');
  }
  const previousUpdate=updatePlayer;
  updatePlayer=function(dt){
    time+=dt;if(rig!==player.rig||character!==player.char||context!==scope()){cleanup();rig=player.rig;character=player.char;context=scope();}
    if(player.dead&&(player.nxOvertime||S.cine||S.reservation))cleanup();
    previousUpdate(dt);stepPairs(dt);
    if(player.char==='nanami'){player.nxOvertime=Math.max(0,(player.nxOvertime||0)-dt);fx('tick',player,dt,player.action);}
    for(const f of Object.values(window.MPJJ?.fighters||{}))if(f.char==='nanami')fx('tick',f.e,dt,f.action);
    for(const [id,v]of outgoing)if(time-v.at>3)outgoing.delete(id);
  };
  const previousEnemyUpdate=Enemy.prototype.update;
  Enemy.prototype.update=function(dt){if(this.nxHold)return;const r=previousEnemyUpdate.call(this,dt);if(this.char==='nanami'&&!this.net){this.nxOvertime=Math.max(0,(this.nxOvertime||0)-dt);fx('tick',this,dt,this.action);}return r;};
  const previousSwitch=switchChar;switchChar=function(){cleanup();const r=previousSwitch.apply(this,arguments);rig=player.rig;character=player.char;return r;};
  window.addEventListener('keyup',e=>{if(e.code==='Digit2')release();},true);
  window.addEventListener('blur',()=>{if(player.action?.type==='nx_charge')release();if(S.cine||S.reservation)cleanup();});
  context=scope();
  window.JJCHARCAST.nanami.defend=source=>tryCounter(player,enemies.find(e=>e.rig===source?.rig)||null);
})();
