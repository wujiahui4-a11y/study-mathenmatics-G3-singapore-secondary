/* Ryu's output meter and Dessert phase. The victim owns hit acceptance and HP.
   Paired cinematics require a reservation/ack, carry room + event identities,
   and expire without damage if either participant disappears. */
(function () {
  'use strict';
  if (!window.JJRYU) return;
  const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
  const clamp = (x,a=0,b=1) => Math.max(a,Math.min(b,x));
  const dir = y => V(Math.sin(y),0,Math.cos(y));
  const KIT = {
    rx_brush:{name:'Tidy Hair',cd:4,dur:1.7},
    rx_awake:{name:'Granite Blast',cd:0,dur:5.2},
    rx1:{name:'Larp Me',cd:9,dur:1.2},
    rx2:{name:'Hate Me',cd:15,dur:1.65},
    rx3:{name:'Dessert Exchange',cd:18,dur:1.2},
    rx4:{name:'Best Dessert',cd:32,dur:1.85}
  };
  const DURATION = {rx3:2.6,rx4:12.3};
  const S = window.JJRYUREWORK = {
    heat:0,phase:0,remaining:0,cine:null,reservation:null,beam:null,
    cast,input,usedSkill,receive,cleanup,remoteState,pack,
    locked:()=>!!S.reservation || !!S.cine,
    kit:KIT,sessions:new Map(),
    audit:()=>({heat:S.heat,phase:S.phase,remaining:S.remaining,
      reserved:!!S.reservation,events:[...S.sessions.values()].map(c=>({event:c.event,kind:c.kind,t:c.t,own:c.own})),
      completed:completed.size,beam:S.beam?.qualified||false})
  };
  let clock=0,serial=0,scope='',lastRig=player.rig,lastChar=player.char;
  const completed=new Set(),beamHits=new Map(),baseMoves=CHARS.ryu.moves.slice();
  const baseCasts=window.JJCHARCAST.ryu.cast.slice();
  const online=()=>!!window.MPJJ?.active && !!MPJJ.relay;
  const myId=()=>online()?MPJJ.id:'local';
  const room=()=>(online()?MPJJ.code:'offline')+'|'+(window.JJMAP?.id||'');
  const send=m=>{if(online())MPJJ.relay.pub({...m,id:myId(),room:MPJJ.code,map:window.JJMAP?.id});};
  const token=()=>myId()+':'+Date.now().toString(36)+':'+(++serial).toString(36);
  const validToken=s=>typeof s==='string'&&s.length>0&&s.length<120;
  const validPoint=p=>Array.isArray(p)&&p.length===3&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<1e5);
  const actor=id=>id===myId()?player:window.MPJJ?.fighters?.[id]?.e;
  const charFor=id=>id===myId()?player.char:window.MPJJ?.fighters?.[id]?.char;
  const remember=id=>{completed.add(id);if(completed.size>256)completed.delete(completed.values().next().value);};
  const alive=e=>!!e&&!e.dead&&e.hp>0;
  const available=e=>alive(e)&&!(e.iframes>0)&&!e.rag&&!e.bcFall&&!e.cineHold;
  const visible=(a,b)=>!window.JJFIGHT || JJFIGHT.actors.visible(a.clone().add(V(0,2.6,0)),b.clone().add(V(0,2.6,0)));
  const canCast=()=>player.char==='ryu'&&!player.ai&&gameInputActive()&&alive(player)&&!busy()&&!player.react&&!S.locked()&&!window.JJFIGHT?.locked();
  const fx=(name,...args)=>window.JJRYUFX?.[name]?.(...args);

  function refresh() {
    const special={key:'R',lbl:'Tidy Hair',cd:'rx_brush',max:4};
    CHARS.ryu.moves=S.phase===2
      ? [...baseMoves.slice(0,2),...[1,2,3,4].map(n=>({key:String(n),lbl:KIT['rx'+n].name,cd:'rx'+n,max:KIT['rx'+n].cd})),special]
      : [...baseMoves.slice(0,6),special];
    if(player.char==='ryu')buildMovesBar();
  }
  Object.keys(KIT).forEach(k=>{cds[k]=0;});
  refresh();
  function usedSkill() {
    if(player.char!=='ryu'||player.ai)return;
    S.heat=clamp(S.heat+20,0,100);
  }
  function setPhase2() {
    S.phase=2;S.remaining=60;S.heat=100;
    for(const k of ['rx1','rx2','rx3','rx4'])cds[k]=0;
    refresh();fx('steam',player.pos.clone());
    window.JJNOTICE?.('DESSERT · SECOND AWAKENING','#ffffff');
  }
  function cast(id) {
    if(!canCast())return false;
    if(/^r[1-4]$/.test(id)) {
      const i=+id[1]-1;
      if(S.phase===2)return cast('rx'+(i+1));
      const before=player.action;baseCasts[i]();return !!player.action&&player.action!==before;
    }
    const conf=KIT[id];if(!conf||cds[id]>0)return false;
    if(id==='rx_brush'&&S.heat<=0)return false;
    if(id==='rx_awake'&&(S.phase!==0||!window.JJAW||JJAW.charge<100))return false;
    if(/^rx[1-4]$/.test(id)&&S.phase!==2)return false;
    const a=player.action={type:id,t:0,dur:conf.dur,stage:0,dir:dir(player.facing),facing:player.facing,
      origin:player.pos.clone(),event:token(),hit:new Set(),serial:Date.now()*1000+(++serial%1000)};
    cds[id]=conf.cd;
    if(id!=='rx_brush')usedSkill();
    if(id==='rx_awake') {
      JJAW.charge=0;JJAW.ready=false;S.phase=1;
      S.beam={event:a.event,qualified:false,ended:false,until:clock+7,targets:new Set()};
      fx('awake',player,a);
      send({t:'ry-awake',event:a.event,p:a.origin.toArray(),d:a.dir.toArray()});
    }
    return true;
  }
  function input(e) {
    if(S.locked()&&/^(Key[WASDQRFGE]|Space|Digit[1-4])$/.test(e.code)) {
      e.preventDefault();e.stopImmediatePropagation();return true;
    }
    if(player.char!=='ryu'||!gameInputActive()||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return false;
    const id=e.code==='KeyR'?'rx_brush':e.code==='KeyG'?'rx_awake':/^Digit[1-4]$/.test(e.code)?'r'+e.code.slice(-1):null;
    if(!id)return false;cast(id);e.preventDefault();e.stopImmediatePropagation();return true;
  }
  function candidates(a,range,cone,playersOnly=false) {
    return enemies.filter(e=>available(e)&&(!playersOnly||!!e.net)&&Math.abs(e.pos.y-player.pos.y)<5&&visible(player.pos,e.pos))
      .filter(e=>{const v=e.pos.clone().sub(player.pos).setY(0),l=v.length();return l<=range&&(l<.2||v.normalize().dot(a.dir)>=cone);})
      .sort((a,b)=>a.pos.distanceToSquared(player.pos)-b.pos.distanceToSquared(player.pos));
  }
  function meta(a,down=0,breakGuard=false) {
    return {id:a.serial++,kind:a.type,guardable:true,breakGuard,source:player.pos.clone(),stun:.55,down,variant:'normal'};
  }
  function hit(e,amount,k,m) {
    return e.damage(amount,k,{combat:m,fin:false,death:'ragdoll',noFrameBonus:true,spark:0xffffff,
      react:m.down?'blow':'stagger',reactDur:.5,stun:m.stun});
  }
  function laneContains(pos,from,d) {
    const offset=pos.clone().add(V(0,2.5,0)).sub(from),along=offset.dot(d);
    return along>=-2&&along<=180&&offset.addScaledVector(d,-along).length()<=9.5;
  }
  function beamFire(a) {
    const from=JJRYU.muzzle(player.rig,player.pos,a.dir),d=a.dir.clone();
    // A level, wide column includes feet-to-head targets without aiming through the floor.
    d.y=0;d.normalize();a.beamFrom=from;a.beamDir=d;
    fx('beam',from,d);
    send({t:'ry-beam',event:a.event,p:from.toArray(),d:d.toArray()});
    for(const e of enemies) {
      if(!available(e)||!laneContains(e.pos,from,d))continue;
      if(e.net) {
        S.beam.targets.add(e.net.id);
        send({t:'ry-beam-hit',to:e.net.id,event:a.event,p:from.toArray(),d:d.toArray()});
      } else {
        const n=Math.max(0,e.hp-50);
        if(n)hit(e,n,d.clone().multiplyScalar(10).setY(5),{...meta(a),guardable:false,breakGuard:true});
        fx('burn',e);if(e.char==='yuta'||e.rig?.__char==='yuta')S.beam.qualified=true;
      }
    }
  }
  function brush(a) {
    if(a.stage<1&&a.t>=1.45){a.stage=1;S.heat=0;fx('comb',player.pos.clone());}
  }
  function awaken(a) {
    player.vel.x=player.vel.z=0;
    if(a.stage<1&&a.t>=2.8){a.stage=1;beamFire(a);}
    if(a.stage<2&&a.t>=5.05) {
      a.stage=2;if(S.beam)S.beam.ended=true;
      if(S.beam?.qualified)setPhase2();else S.phase=0;
    }
  }
  function larp(a) {
    for(const [i,at] of [.27,.76].entries()) {
      if(a.stage>i||a.t<at)continue;
      a.stage=i+1;
      const d=a.dir.clone().multiplyScalar(i?-1:1),q={...a,dir:d};
      fx('strike',player.pos.clone().addScaledVector(d,2),d);
      for(const e of candidates(q,7,.05)) {
        if(a.hit.has(e))continue;a.hit.add(e);
        const k=d.clone().multiplyScalar(112).setY(17),m=meta(a,1.85);
        const blocked=window.JJFIGHT?.blocked(e,m);hit(e,22,k,m);
        if(!blocked){fx('trail',e);send({t:'ry-trail',event:a.event,to:e.net?.id,p:e.pos.toArray(),d:d.toArray()});}
      }
    }
  }
  function hate(a) {
    if(a.stage||a.t<.62)return;a.stage=1;
    fx('slam',player.pos.clone());
    if(window.JJDESTRUCT?.settings.enabled&&window.JJMAP?.id==='jjs')JJDESTRUCT.hit(player.pos.clone(),18,'ryu-lift');
    for(const e of candidates({...a,dir:a.dir},18,-1)) {
      const d=e.pos.clone().sub(player.pos).setY(0);if(d.lengthSq()<.01)d.copy(a.dir);
      hit(e,18,d.normalize().multiplyScalar(12).setY(26),{...meta(a,1.9,true),variant:'up'});
    }
    send({t:'ry-slam',event:a.event,p:player.pos.toArray()});
  }
  function dash(a,dt) {
    if(a.confirm)return;
    if(a.pending) {
      player.vel.x=player.vel.z=0;
      if(clock-a.pending.sent>.18){request(a);a.pending.sent=clock;}
      if(clock-a.pending.at>1.05){a.pending=null;a.dur=a.t+.15;}
      return;
    }
    const travel=a.type==='rx4'?1.5:.75;
    if(a.t>travel){player.vel.x=player.vel.z=0;return;}
    const target=typeof camForward==='function'?camForward().setY(0).normalize():a.dir;
    if(a.type==='rx4')a.dir.lerp(target,Math.min(1,dt*5)).normalize();
    a.facing=Math.atan2(a.dir.x,a.dir.z);
    const speed=a.type==='rx4'?3+27*Math.pow(1-clamp(a.t/travel),2):34*(1-.6*clamp(a.t/travel));
    window.JJFIGHT?.actors.sweepMove(player,a.dir.clone().multiplyScalar(speed*dt));
    player.vel.x=player.vel.z=0;
    const e=candidates(a,4.7,.25,a.type==='rx4')[0];
    if(!e)return;
    const m={guardable:true,source:player.pos.clone()};
    if(window.JJFIGHT?.blocked(e,m)) {JJFIGHT.blockFX(e);a.dur=a.t+.2;return;}
    if(e.net) {
      a.pending={target:e,at:clock,sent:clock};a.dur=a.t+1.2;request(a);
    } else beginLocal(a,e);
  }
  function request(a) {
    send({t:'ry-grab-request',event:a.event,to:a.pending.target.net.id,k:a.type,p:player.pos.toArray(),d:a.dir.toArray()});
  }
  function beginLocal(a,e,point) {
    const p=player.pos.clone(),d=a.dir.clone(),q=point||e.pos.clone();
    const c=install({event:a.event,kind:a.type,by:myId(),to:e.net?.id||'dummy:'+enemies.indexOf(e),
      p:p.toArray(),q:q.toArray(),d:d.toArray(),time:0},player,e);
    if(!c)return;
    a.pending=null;a.confirm=true;a.dur=a.t+DURATION[a.type]+.2;
    c.packet={t:'ry-cine',event:c.event,k:c.kind,to:c.to,p:c.p.toArray(),q:c.q.toArray(),d:c.d.toArray(),time:0};
    send(c.packet);
  }
  function hold(c,e) {
    if(!e)return;
    c.saved.push({e,iframes:e.iframes||0,action:e.action,rig:e.rig,char:e.char});
    e.ryuHold=c.event;e.cineHold=true;e.vel?.set(0,0,0);e.react=null;e.blocking=false;
    if(e===player){window.JJFIGHT?.clearInput();clearMovement();}
  }
  function install(m,caster,victim) {
    if(completed.has(m.event))return null;
    const exists=S.sessions.get(m.event);if(exists)return exists;
    if(!alive(caster)||!alive(victim)||caster.ryuHold||victim.ryuHold)return null;
    const own=caster===player||victim===player;
    if(own&&S.cine)return null;
    const c={...m,p:V(...m.p),q:V(...m.q),d:V(...m.d).setY(0).normalize(),caster,victim,
      t:clamp(m.time||0,0,DURATION[m.kind]),dur:DURATION[m.kind],saved:[],own,seen:clock,sent:-1,local:m.by===myId(),done:false};
    if(c.d.lengthSq()<.9)return null;
    hold(c,caster);hold(c,victim);S.sessions.set(c.event,c);
    if(own){S.cine=c;S.reservation=null;}fx('cinematic',c);return c;
  }
  function unlock(c) {
    for(const old of c.saved)if(old.e.ryuHold===c.event) {
      const e=old.e;e.ryuHold=null;e.cineHold=false;e.vel?.set(0,0,0);
      e.iframes=Math.max(0,old.iframes-c.t);
      if(e===player){if(player.action?.confirm||player.action?.type==='rx_hold')player.action=null;window.JJFIGHT?.clearInput();clearMovement();}
    }
    if(S.cine===c)S.cine=null;
    fx('endCinema',c);
  }
  function applyEnd(e,percent,d,source,by) {
    const amount=(e.maxHp||100)*percent,k=d.clone().multiplyScalar(13).setY(8);
    const combat={id:Date.now()*1000+(++serial%1000),kind:'ry-dessert',guardable:false,breakGuard:true,source:source.clone(),stun:.7,down:1.9,variant:'normal'};
    if(e===player){const hp=player.hp;hurtPlayer(amount,k,{combat,fin:false,death:'ragdoll',noFrameBonus:true});window.MPJJ?.confirmOwnedHit?.(by,hp);}
    else if(!e.net)hit(e,amount,k,combat);
  }
  function finish(c,done,notify=true) {
    if(c.done)return;c.done=true;S.sessions.delete(c.event);remember(c.event);unlock(c);
    if(done) {
      const d=c.d.clone();
      if(c.caster===player)applyEnd(player,.1,d.clone().negate(),c.victim.pos,c.to);
      if(c.victim===player||!c.victim.net)applyEnd(c.victim,c.kind==='rx4'?.8:.4,d,c.caster.pos,c.by);
      fx('finish',c);
    }
    if(notify&&(c.local||c.own))send({t:done?'ry-end':'ry-cancel',event:c.event,to:c.to});
  }
  function releaseReservation() {
    if(!S.reservation)return;
    S.reservation=null;
    if(player.action?.type==='rx_hold')player.action=null;
    player.cineHold=false;player.ryuHold=null;player.vel.set(0,0,0);
  }
  function cleanup(reason='reset') {
    for(const c of [...S.sessions.values()])finish(c,false);
    if(S.reservation)send({t:'ry-cancel',event:S.reservation.event,to:S.reservation.by});
    releaseReservation();
    if(player.action?.type?.startsWith('rx'))player.action=null;
    S.heat=0;S.phase=0;S.remaining=0;S.beam=null;beamHits.clear();fx('cleanup',reason);refresh();
  }
  function stepSessions(dt) {
    if(S.reservation) {
      const r=S.reservation;
      if(clock-r.seen>1.1||!online()||!alive(actor(r.by))||player.dead||!gameInputActive())releaseReservation();
      else {player.pos.copy(r.pos);player.vel.set(0,0,0);player.action={type:'rx_hold',t:0,dur:2};}
    }
    for(const c of [...S.sessions.values()]) {
      const broken=!alive(c.caster)||!alive(c.victim)||c.saved.some(o=>o.e.rig!==o.rig||o.e.char!==o.char);
      const departed=online()&&(actor(c.by)!==c.caster||(c.victim.net&&actor(c.to)!==c.victim));
      if(broken||departed||(c.own&&!gameInputActive())||((!c.local||c.victim.net)&&clock-c.seen>1.4)){finish(c,false);continue;}
      c.t+=dt;
      if(c.local&&clock-c.sent>=.18) {c.sent=clock;send({...c.packet,time:c.t});}
      for(const e of [c.caster,c.victim]) {
        e.vel?.set(0,0,0);e.iframes=Math.max(e.iframes||0,.15);e.stunT=0;e.react=null;
      }
      if(c.victim===player)player.action={type:'rx_hold',t:c.t,dur:c.dur+.5};
      const side=V(c.d.z,0,-c.d.x),drift=c.kind==='rx4'?clamp((c.t-10.1)/1.4)*1.8:0;
      c.caster.pos.copy(c.p).addScaledVector(side,-drift);
      c.victim.pos.copy(c.p).addScaledVector(c.d,2.8).addScaledVector(side,drift);
      c.caster.facing=Math.atan2(c.d.x,c.d.z);c.victim.facing=c.caster.facing+Math.PI;
      fx('posePair',c);
      if(c.t>=c.dur)finish(c,true);
    }
  }
  function receive(m) {
    if(typeof m?.t!=='string'||!m.t.startsWith('ry-'))return false;
    if(!online()||m.room!==MPJJ.code||m.map!==window.JJMAP?.id||m.id===myId()||!validToken(m.event))return true;
    const f=MPJJ.fighters[m.id],e=f?.e;
    if(!f||!alive(e))return true;
    if(m.t==='ry-cine-ack') {
      const c=S.sessions.get(m.event);
      if(c?.local&&c.to===m.id&&m.to===myId())c.seen=clock;
      return true;
    }
    if(m.t==='ry-cancel'||m.t==='ry-end') {
      const c=S.sessions.get(m.event);
      if(c&&(m.id===c.by||m.id===c.to)) {
        if(m.t==='ry-cancel')finish(c,false,false);
        else if(m.id===c.by&&c.t>=c.dur-.35){c.t=c.dur;finish(c,true,false);}
      }
      if(S.reservation?.event===m.event&&S.reservation.by===m.id)releaseReservation();return true;
    }
    if(m.t==='ry-grab-ack') {
      const a=player.action;
      if(a?.event!==m.event||a.pending?.target.net.id!==m.id||m.to!==myId())return true;
      if(!m.ok){a.pending=null;a.dur=a.t+.15;return true;}
      if(!validPoint(m.p)||V(...m.p).distanceTo(player.pos)>9)return true;
      beginLocal(a,a.pending.target,V(...m.p));return true;
    }
    if(m.t==='ry-beam-confirm') {
      if(m.to===myId()&&S.beam?.event===m.event&&S.beam.targets.has(m.id)&&f.char==='yuta'&&clock<S.beam.until) {
        S.beam.qualified=true;if(S.beam.ended&&S.phase===0)setPhase2();
      }return true;
    }
    if(f.char!=='ryu')return true;
    if(m.t==='ry-grab-request') {
      if(m.to!==myId()||!DURATION[m.k]||!validPoint(m.p)||!validPoint(m.d)||completed.has(m.event))return true;
      if(S.reservation?.event===m.event&&S.reservation.by===m.id) {
        S.reservation.seen=clock;send({t:'ry-grab-ack',event:m.event,to:m.id,ok:true,p:S.reservation.pos.toArray()});return true;
      }
      const p=V(...m.p),d=V(...m.d).setY(0),relative=player.pos.clone().sub(p).setY(0);
      const ok=available(player)&&!S.locked()&&gameInputActive()&&f.ryu?.phase===2&&
        d.length()>.8&&d.length()<1.2&&p.distanceTo(e.pos)<7&&p.distanceTo(player.pos)<=7&&
        (relative.length()<.2||relative.normalize().dot(d.normalize())>.05)&&visible(p,player.pos)&&
        !window.JJFIGHT?.blocked(player,{guardable:true,source:p});
      if(ok){S.reservation={by:m.id,event:m.event,kind:m.k,pos:player.pos.clone(),seen:clock};
        player.action={type:'rx_hold',t:0,dur:2};player.vel.set(0,0,0);player.cineHold=true;window.JJFIGHT?.clearInput();clearMovement();}
      else if(player.blocking)window.JJFIGHT?.blockFX(player);
      send({t:'ry-grab-ack',event:m.event,to:m.id,ok,p:player.pos.toArray()});return true;
    }
    if(m.t==='ry-cine') {
      if(!DURATION[m.k]||!validPoint(m.p)||!validPoint(m.q)||!validPoint(m.d)||completed.has(m.event)||
        !Number.isFinite(m.time)||m.time<0||m.time>DURATION[m.k]+.3)return true;
      const old=S.sessions.get(m.event);
      if(old) {
        if(old.by!==m.id||old.to!==m.to||old.kind!==m.k||m.time<old.lastTime||m.time>old.t+1)return true;
        old.lastTime=m.time;old.seen=clock;old.t=Math.max(old.t,m.time);
        if(old.victim===player)send({t:'ry-cine-ack',event:m.event,to:m.id});
        return true;
      }
      const v=actor(m.to);if(!alive(v)||e.pos.distanceTo(V(...m.p))>12||V(...m.p).distanceTo(V(...m.q))>8)return true;
      if(v===player&&!(S.reservation?.event===m.event&&S.reservation.by===m.id))return true;
      if(v!==player&&(v.cineHold||e.cineHold||f.ryu?.phase!==2))return true;
      if(v===player){player.cineHold=false;S.reservation=null;}
      const installed=install({event:m.event,kind:m.k,by:m.id,to:m.to,p:m.p,q:m.q,d:m.d,time:m.time},e,v);
      if(installed&&v===player)send({t:'ry-cine-ack',event:m.event,to:m.id});
      return true;
    }
    if(m.t==='ry-awake') {
      if(!validPoint(m.p)||!validPoint(m.d)||e.pos.distanceTo(V(...m.p))>10||beamHits.has(m.event))return true;
      beamHits.set(m.event,{at:clock,from:m.id});fx('awake',e,{dir:V(...m.d).normalize(),t:0,dur:5.2,event:m.event});return true;
    }
    if(m.t==='ry-beam'||m.t==='ry-beam-hit') {
      if(!validPoint(m.p)||!validPoint(m.d)||V(...m.p).distanceTo(e.pos)>12||V(...m.d).length()<.9||V(...m.d).length()>1.1)return true;
      const d=V(...m.d).normalize(),p=V(...m.p);
      let b=beamHits.get(m.event);
      if(!b){b={at:clock,from:m.id};beamHits.set(m.event,b);}
      if(b.from!==m.id||clock-b.at>7)return true;
      if(m.t==='ry-beam'&&!b.fx){b.fx=true;fx('beam',p,d);}
      if(m.t==='ry-beam-hit'&&m.to===myId()) {
        if(b.accepted){send({t:'ry-beam-confirm',event:m.event,to:m.id});return true;}
        if(b.rejected)return true;
        if(!available(player)||S.locked()||!laneContains(player.pos,p,d)){b.rejected=true;return true;}
        const n=Math.max(0,player.hp-50);
        if(n)hurtPlayer(n,d.clone().multiplyScalar(10).setY(5),{combat:{guardable:false,breakGuard:true,source:p,stun:.7},death:'ragdoll'});
        b.accepted=true;fx('burn',player);send({t:'ry-beam-confirm',event:m.event,to:m.id});
      }return true;
    }
    if(m.t==='ry-slam'&&validPoint(m.p)&&e.pos.distanceTo(V(...m.p))<10&&!completed.has(m.event+':slam')) {
      remember(m.event+':slam');fx('slam',V(...m.p));return true;
    }
    if(m.t==='ry-trail'&&validPoint(m.p)&&e.pos.distanceTo(V(...m.p))<15&&!completed.has(m.event+':'+m.to)) {
      remember(m.event+':'+m.to);const target=actor(m.to);if(target)fx('trail',target);return true;
    }
    return true;
  }
  function pack(){return player.char==='ryu'?{heat:Math.round(S.heat),phase:S.phase,left:Math.ceil(S.remaining)}:null;}
  function remoteState(f,m) {
    if(f.char!=='ryu'||!m)return;
    f.ryu={heat:clamp(+m.heat||0,0,100),phase:[0,1,2].includes(m.phase)?m.phase:0,left:clamp(+m.left||0,0,60)};
    fx('look',f.e.rig,f.ryu.heat,f.action);
  }
  const priorStep=stepAction;
  stepAction=function(a,dt) {
    if(player.ai||!KIT[a.type])return priorStep(a,dt);
    if(player.dead||player.char!=='ryu'||(player.stunT>0&&!a.confirm)||!gameInputActive()){player.action=null;return;}
    if(a.type==='rx_brush')brush(a);
    if(a.type==='rx_awake')awaken(a);
    if(a.type==='rx1')larp(a);
    if(a.type==='rx2')hate(a);
    if(a.type==='rx3'||a.type==='rx4')dash(a,dt);
  };
  const priorUpdate=updatePlayer;
  updatePlayer=function(dt) {
    clock+=dt;
    if(lastRig!==player.rig||lastChar!==player.char||scope!==room()) {
      cleanup('context');lastRig=player.rig;lastChar=player.char;scope=room();
    }
    if(player.dead&&(S.heat||S.phase||S.cine))cleanup('death');
    const before=player.action;
    priorUpdate(dt);
    if(before?.type==='rx_awake'&&player.action!==before&&before.stage<2){S.phase=0;S.beam=null;fx('cancelAwake',before.event);}
    stepSessions(dt);
    if(player.char==='ryu') {
      if(S.phase===2&&!S.cine){S.remaining=Math.max(0,S.remaining-dt);if(!S.remaining){S.phase=0;refresh();}}
      const a=player.action;
      if(a&&KIT[a.type]&&!a.confirm){player.facing=a.facing;player.rig.root.rotation.y=a.facing;}
      fx('look',player.rig,S.heat,a);fx('tick',player,dt,S.heat);
    }
    for(const f of Object.values(window.MPJJ?.fighters||{}))if(f.char==='ryu'&&f.ryu)fx('tick',f.e,dt,f.ryu.heat,f.action);
    for(const [id,b] of beamHits)if(clock-b.at>8)beamHits.delete(id);
    if(S.beam?.ended&&clock>S.beam.until)S.beam=null;
  };
  const priorEnemy=Enemy.prototype.update;
  Enemy.prototype.update=function(dt){if(this.ryuHold&&this.cineHold){this.vel?.set(0,0,0);return;}return priorEnemy.call(this,dt);};
  const priorDamage=Enemy.prototype.damage;
  Enemy.prototype.damage=function(n,k,o){if(this.ryuHold)return false;return priorDamage.call(this,n,k,o);};
  const priorHurt=hurtPlayer;
  hurtPlayer=function(n,k,o){if(S.locked())return false;return priorHurt(n,k,o);};
  const priorSwitch=switchChar;
  switchChar=function(){const rig=player.rig,r=priorSwitch.apply(this,arguments);if(rig!==player.rig){cleanup('switch');lastRig=player.rig;lastChar=player.char;}return r;};
  window.addEventListener('blur',()=>{if(S.cine||S.reservation)cleanup('blur');});
  window.addEventListener('mousedown',e=>{if(S.locked()&&e.button===0){e.preventDefault();e.stopImmediatePropagation();}},true);
  scope=room();
})();
