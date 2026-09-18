/* Procedural blade ribbons, ten-division diagrams, blue cursed energy,
   and original non-graphic Black Flash impact animation. */
(function(){
  'use strict';
  if(!window.JJNANAMIX)return;
  const S=JJNANAMIX,V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),TAU=Math.PI*2;
  const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);};
  const FX=window.JJFX,reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
  const effects=new Set();let clock=0,lastPanel='';
  const F=window.JJNANAMIFX={look,tick,poseM1,mark,impact,finish,evade,ignite,cinematic,pairPose,endCinema,cleanup,
    audit:()=>({effects:effects.size,panel:lastPanel}),pose};
  const mat=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
  function dispose(root){root.removeFromParent();root.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});}
  function effect(root,dur,step){scene.add(root);const h={root,t:0,dead:false,stop(){if(this.dead)return;this.dead=true;effects.delete(this);dispose(root);}};effects.add(h);
    addFx({t:1e9,update(dt){if(h.dead)return false;h.t+=dt;step(h.t,dt);if(h.t>=dur)h.stop();return !h.dead;}});return h;}
  function box(root,x,y,z,w,h,d,color){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));m.position.set(x,y,z);root.add(m);return m;}
  function energyRig(r){
    if(!r?.nanamiBlade||r.nxEnergy)return;
    const g=new THREE.Group();g.name='Nanami blue cursed energy';r.nanamiBlade.add(g);
    for(let i=0;i<14;i++){
      const flame=new THREE.Mesh(new THREE.ConeGeometry(.09+(i%3)*.025,.45+(i%4)*.1,5),mat(i%3===0?0xe1ffff:i%2?0x168dff:0x57dfff,.6));
      flame.position.set(Math.sin(i*2.4)*.26,.12,.55+(i/14)*2.3);flame.rotation.x=Math.sin(i)*.3;g.add(flame);
    }
    g.visible=false;r.nxEnergy=g;
    const aura=new THREE.Group();aura.name='Nanami flowing charge aura';r.root.add(aura);
    const shell=new THREE.Mesh(new THREE.CylinderGeometry(.75,1.15,5.3,12,1,true),mat(0x38a8ff,.08));shell.position.y=2.9;aura.add(shell);
    for(let i=0;i<9;i++){const m=new THREE.Mesh(new THREE.ConeGeometry(.09,.7,4),mat(i%2?0x69dfff:0x1287ff,.45));m.userData.angle=i/9*TAU;aura.add(m);}
    aura.visible=false;r.nxChargeAura=aura;
  }
  const previousRig=makeAnimeRig;makeAnimeRig=function(cfg){const r=previousRig(cfg);if(cfg?.nanami)energyRig(r);return r;};
  function look(e){energyRig(e.rig);if(!e.rig?.nxEnergy)return;e.rig.nxEnergy.visible=(e.nxOvertime||0)>0&&!e.dead;}
  function arc(pos,yaw,spin=false,n=0){
    const g=new THREE.Group(),points=[],colors=[],segments=64,span=spin?TAU:Math.PI*1.25;
    for(let i=0;i<segments;i++){
      const a=i/segments*span,b=(i+1)/segments*span,r=spin?4.1:3.7,width=spin?.4:.26;
      for(const [angle,rad]of [[a,r-width],[a,r],[b,r],[a,r-width],[b,r],[b,r-width]]){
        points.push(Math.cos(angle)*rad,0,Math.sin(angle)*rad);const f=.3+.7*i/segments;colors.push(f,f,f);
      }
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xd8f7ff,vertexColors:true,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));g.add(m);
    g.position.copy(pos).add(V(0,2.9,0));g.rotation.set(spin?.04:(n%2?.5:-.5),yaw+(n%2?-.8:.6),0);
    effect(g,.28,t=>{m.material.opacity=.7*(1-t/.28);g.scale.setScalar(1+t*.55);});
  }
  function mark(e,perfect=false,height=2.6){
    const g=new THREE.Group();g.name=perfect?'Ratio diagram 7:3':'Neutral horizontal ratio diagram';
    box(g,0,0,0,4.0,.035,.02,0xffffff);
    for(let i=0;i<=10;i++)box(g,-2+i*.4,0,.008,.035,i===0||i===10?.36:.21,.025,perfect&&i===7?0xff2d46:0xffffff);
    const circle=new THREE.Mesh(new THREE.RingGeometry(.11,.145,24),mat(0xffffff));circle.position.x=-2.3;g.add(circle);
    if(perfect){box(g,.8,0,.025,.065,.55,.04,0xff2446);const ring=new THREE.Mesh(new THREE.RingGeometry(.22,.25,32),mat(0xff2446));ring.position.x=.8;g.add(ring);}
    effect(g,.9,t=>{g.position.copy(e.pos).add(V(0,height,0));g.quaternion.copy(camera.quaternion);g.scale.setScalar(.8+.2*ease(t/.12));
      g.traverse(o=>{if(o.material){o.material.transparent=true;o.material.opacity=1-ease((t-.55)/.35);}});});
  }
  function impact(pos,perfect=false,lethal=false){
    FX?.ring(pos.clone(),0xffffff,{maxR:perfect?5:2.2,life:.24,ground:false});
    if(!perfect&&!lethal){FX?.cross(pos.clone(),0xd2f6ff,2.6,.17);return;}
    const g=new THREE.Group();g.position.copy(pos);
    for(let i=0;i<(lethal?14:7);i++){
      const points=[],a=i/7*TAU;
      for(let j=0;j<7;j++){const r=.3+j*.65,turn=a+Math.sin(j*2.1+i)*.24;points.push(V(Math.cos(turn)*r,Math.sin(turn)*r,Math.sin(i+j)*.25));}
      const path=new THREE.CatmullRomCurve3(points);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(path,14,.10,4,false),mat(0xe11c36)));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(path,14,.065,4,false),mat(0x030308)));
    }
    effect(g,.48,t=>{g.quaternion.copy(camera.quaternion);g.rotation.z+=t*.4;g.scale.setScalar(.6+ease(t/.3)*1.1);g.traverse(o=>{if(o.material){o.material.transparent=true;o.material.opacity=1-ease((t-.25)/.23);}});});
    if(!reduced){addShake(lethal?.65:.32);FX?.flash('#ffffff',.22,.10);}
    try{tone(70,.16,'sawtooth',.035,32);noiseBurst(.1,.035,1500);}catch(_){}
  }
  function ignite(e){FX?.ring(e.pos.clone().add(V(0,.1,0)),0x75ddff,{maxR:4.5,life:.6});look(e);}
  function evade(pos){FX?.speedRing(pos.clone().add(V(0,2.8,0)),0xccf4ff,5,.2);}
  function finish(e,kind,perfect){
    // The intact fighter remains visible. Only cursed-energy shards disperse.
    const g=new THREE.Group();g.position.copy(e.pos).add(V(0,2.5,0));
    for(let i=0;i<24;i++){const a=i*2.4,r=.3+(i%5)*.16,m=new THREE.Mesh(new THREE.OctahedronGeometry(.09+(i%4)*.035),mat(perfect?0xd6faff:0xa3d9ff));
      m.position.set(Math.cos(a)*r,(i%7-3)*.32,Math.sin(a)*r);m.userData.v=V(Math.cos(a)*6,2+(i%6),Math.sin(a)*6);g.add(m);}
    effect(g,.85,(t,dt)=>g.children.forEach(m=>{m.position.addScaledVector(m.userData.v,dt);m.scale.setScalar(1-t/.85);m.rotation.y+=dt*5;}));
  }
  function tick(e,dt,a){
    clock+=dt;look(e);const r=e.rig;if(!r?.nanamiBlade)return;
    if(!e.nxHold){r.body.position.set(0,0,0);r.root.visible=true;}
    if(r.nxEnergy?.visible)r.nxEnergy.children.forEach((m,i)=>{m.scale.y=.65+.45*Math.sin(clock*13+i*1.7);m.rotation.z=Math.sin(clock*7+i)*.2;});
    r.nxChargeAura.visible=a?.type==='nx_charge'&&!e.dead;
    if(r.nxChargeAura.visible)r.nxChargeAura.children.slice(1).forEach((m,i)=>{const a=m.userData.angle+clock*.8;m.position.set(Math.cos(a)*.9,.4+(clock*3+i*.57)%5.2,Math.sin(a)*.9);m.scale.y=.7+.5*Math.sin(clock*5+i);});
    if(a?.type==='nx_charge'){
      e.nxAura=(e.nxAura||0)+dt;if(e.nxAura>.11){e.nxAura=0;FX?.mote(e.pos.clone().add(V(Math.sin(clock*9)*.8,1+(clock*3)%4,Math.cos(clock*9)*.8)),0x59cfff,2.8,.4);}
    }
    if(a?.type==='nx1'&&a.t>.14&&a.t<1.18){const beat=Math.floor(a.t*9);if(e.nxTrailBeat!==beat||e.nxTrailAction!=='nx1'){e.nxTrailBeat=beat;e.nxTrailAction='nx1';arc(e.pos,e.facing,true);}}
    else if(a?.type==='bc_m1'&&a.t>=(a.start||.12)&&a.t<(a.start||.12)+.17){
      const key='m1:'+a.n;if(e.nxTrailAction!==key||a.t<(e.nxLastAttackTime||0)){e.nxTrailAction=key;arc(e.pos,e.facing,false,a.n||0);}
    }else if(a?.type==='nx2'&&a.t<.2){const beat=Math.floor(a.t*12);if(e.nxDrawBeat!==beat){e.nxDrawBeat=beat;arc(e.pos,e.facing,false,1);}}
    else{e.nxTrailAction=null;e.nxDrawBeat=null;if(!a)r.nanamiBlade.rotation.set(1.05,0,0);}
    e.nxLastAttackTime=a?.t||0;
  }
  function reset(r){resetPose(r);r.body.rotation.set(0,0,0);if(r.nanamiBlade)r.nanamiBlade.rotation.set(Math.PI/2,0,0);}
  function poseM1(r,a){
    if(!r.nanamiBlade||a.type!=='bc_m1')return false;reset(r);
    const k=ease((a.t-(a.start||.12)*.35)/.19),out=1-ease((a.t-(a.start||.12)-.17)/.15),s=a.n%2?1:-1;
    r.spine.rotation.y=s*(.8-1.55*k)*out;r.neck.rotation.y=-r.spine.rotation.y*.5;
    r.shoulderR.rotation.set((-1.8+.55*k)*out,-.45*s,(.7*s-1.4*s*k)*out);r.elbowR.rotation.x=-.5*(1-k);
    r.shoulderL.rotation.set(-.85,0,-.35);r.elbowL.rotation.x=-1.5;
    r.hipL.rotation.x=-.2;r.hipR.rotation.x=.2;r.kneeL.rotation.x=.25;
    if(a.n===3){r.shoulderR.rotation.x=(-2.7+2.5*k)*out;r.spine.rotation.x=.35*k*out;}return true;
  }
  function drawPose(r){
    r.spine.rotation.y=-.9;r.neck.rotation.y=.75;r.spine.rotation.x=.05;
    r.shoulderR.rotation.set(-1.15,-.6,-.8);r.elbowR.rotation.x=-.18;
    r.shoulderL.rotation.set(-1.9,0,.75);r.elbowL.rotation.x=-1.6;
    r.hipL.rotation.x=-.35;r.hipR.rotation.x=.4;r.kneeR.rotation.x=.35;
  }
  function pose(r,a){
    if(!r.nanamiBlade||!a?.type?.startsWith('nx'))return false;reset(r);const t=a.t;
    if(a.type==='nx1'){
      r.body.rotation.y=TAU*ease((t-.1)/1.1)*1.35;r.spine.rotation.x=.14;
      r.shoulderR.rotation.set(-1.3,0,-1.2);r.elbowR.rotation.x=-.15;
      r.nanamiBlade.rotation.z=-TAU*t*2.4;r.shoulderL.rotation.set(-.7,0,.7);
      r.hipL.rotation.x=Math.sin(t*12)*.5;r.hipR.rotation.x=-r.hipL.rotation.x;r.kneeL.rotation.x=Math.max(0,-Math.sin(t*12))*.4;
    }else if(a.type==='nx_charge'){
      const k=ease(t/.22);r.spine.rotation.y=.85*k;r.neck.rotation.y=-.65*k;
      r.shoulderR.rotation.set(-1.95*k,0,-.7*k);r.elbowR.rotation.x=-1.05*k;
      r.shoulderL.rotation.set(-.95*k,0,.38*k);r.elbowL.rotation.x=-1.1*k;
      r.hips.position.y-=.16*k;r.hipL.rotation.x=-.2;r.hipR.rotation.x=.22;
    }else if(a.type==='nx2')drawPose(r);
    else if(a.type==='nx3'){
      if(t<.37){const k=Math.sin(clamp(t/.37)*Math.PI);r.shoulderL.rotation.x=-.7-1.15*k;r.elbowL.rotation.x=-1.3*(1-k);r.spine.rotation.y=.38*k;}
      else{const right=t<.71,k=Math.sin(clamp((t-(right?.37:.71))/.34)*Math.PI),leg=right?'R':'L';r['hip'+leg].rotation.x=-1.65*k;r['knee'+leg].rotation.x=.25*(1-k);r.spine.rotation.x=-.24*k;}
      r.shoulderR.rotation.x=.45;r.elbowR.rotation.x=-.8;
    }else if(a.type==='nx4'){
      r.shoulderR.rotation.set(-1.35,0,-.3);r.elbowR.rotation.x=-1.3;r.shoulderL.rotation.set(-.9,0,.45);r.elbowL.rotation.x=-1.6;
      r.spine.rotation.y=.4;r.neck.rotation.y=-.4;r.hipL.rotation.x=-.24;r.kneeL.rotation.x=.25;
    }else if(a.type==='nxr'){
      const k=ease(t/.4);r.shoulderR.rotation.set(-1.6*k,0,-.25*k);r.elbowR.rotation.x=-1.1*k;
      r.shoulderL.rotation.set(-1.35*k,0,.75*k);r.elbowL.rotation.x=-1.4*k;r.neck.rotation.x=.15*k;
    }
    return true;
  }
  const previousPose=poseAction;poseAction=function(r,a){if(pose(r,a))return;return previousPose(r,a);};
  function cinematic(c){if(c.own)c.cameraSaved={fov:camera.fov,yaw:camYaw,pitch:camPitch};}
  function pairPose(c){
    const r=c.caster.rig,v=c.victim.rig,t=c.t;reset(r);reset(v);
    r.root.position.copy(c.caster.pos);r.root.rotation.y=c.caster.facing;v.root.position.copy(c.victim.pos);v.root.rotation.y=c.victim.facing;
    if(c.k==='ratio'){
      drawPose(r);if(t>.95){const k=ease((t-.95)/.35);r.spine.rotation.y=-.9+1.8*k;r.shoulderR.rotation.set(-1.2,0,-1.2+1.8*k);r.elbowR.rotation.x=-.25;
        r.hipL.rotation.x=-.55;r.hipR.rotation.x=.65;r.kneeR.rotation.x=.45;}
      v.spine.rotation.x=-.18;v.shoulderL.rotation.z=-.2;v.shoulderR.rotation.z=.2;
    }else if(c.k==='counter'){
      r.root.visible=t<.09||t>.26;const fall=ease((t-.26)/.72),upright=ease((t-.68)/.44);
      r.body.position.y=t>.26?(1-fall)*9+5.4*(1-upright):0;
      r.body.rotation.z=t>.26?Math.PI*(1-upright):0;r.shoulderR.rotation.set(-2.45+2.1*ease((t-1.02)/.25),0,-.2);r.elbowR.rotation.x=-.2;
      r.hipL.rotation.x=-.45;r.hipR.rotation.x=.6;r.kneeR.rotation.x=.5;v.neck.rotation.y=-2.2*ease(t/.4);
      if(!c.marked&&t>.3){c.marked=true;mark(c.victim,false,5.2);}
    }else{
      const fall=ease(t/.5);v.hips.position.y=v.hipsBaseY-1.8*fall;v.body.rotation.x=-Math.PI/2*fall;v.body.position.y=.6*fall;
      r.hips.position.y=r.hipsBaseY-.75;r.spine.rotation.x=.4;r.hipL.rotation.x=-.45;r.kneeL.rotation.x=1.3;r.hipR.rotation.x=.65;r.kneeR.rotation.x=1;
      r.shoulderR.rotation.x=-2.7+2.65*ease((t-1.25)/.3);r.elbowR.rotation.x=-.2;
      if(t>.5&&t<1.5){c.fire=(c.fire||0)+.02;if(c.fire>.08){c.fire=0;r.handR.updateWorldMatrix(true,false);FX?.mote(r.handR.getWorldPosition(V()),0x43c7ff,4,.35);}}
    }
    if(!c.struck&&t>c.dur-.25){c.struck=true;impact(c.victim.pos.clone().add(V(0,c.k==='finish3'?1:2.8,0)),c.k==='ratio',c.victim.hp<=({ratio:28,counter:24,finish3:7}[c.k]));}
  }
  const overlay=document.createElement('canvas');overlay.id='jjNanamiCinema';overlay.setAttribute('aria-hidden','true');
  overlay.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:67;display:none';document.body.appendChild(overlay);
  const ctx=overlay.getContext('2d');
  function diagram(g,w,ratio,perfect){
    g.strokeStyle='#f6fcff';g.lineWidth=3;g.beginPath();g.moveTo(-w/2,0);g.lineTo(w/2,0);g.stroke();
    for(let i=0;i<=10;i++){g.strokeStyle=perfect&&i===7?'#ff2848':'#f6fcff';g.lineWidth=perfect&&i===7?5:3;const h=i===0||i===10?23:perfect&&i===7?38:16;
      g.beginPath();g.moveTo(-w/2+w*i/10,-h);g.lineTo(-w/2+w*i/10,h);g.stroke();}
    g.strokeStyle='#fff';g.lineWidth=2;g.beginPath();g.arc(-w/2-24,0,8,0,TAU);g.stroke();
    g.fillStyle=perfect?'#ff3f58':'#d8f5ff';g.font='600 27px system-ui';g.textAlign='center';g.fillText(ratio+':'+(10-ratio),perfect?w*.2:0,-58);
  }
  function draw(c){
    const a=player.action,charging=player.char==='nanami'&&a?.type==='nx_charge';
    if(!c&&!charging){overlay.style.display='none';lastPanel='';return;}
    overlay.width=1280;overlay.height=720;overlay.style.display='block';ctx.clearRect(0,0,1280,720);
    if(charging){lastPanel='charge';ctx.fillStyle='rgba(3,12,23,.86)';ctx.fillRect(340,522,600,150);ctx.save();ctx.translate(640,610);diagram(ctx,430,a.ratio,a.ratio===7);ctx.restore();
      ctx.fillStyle='#bfedff';ctx.textAlign='center';ctx.font='16px system-ui';ctx.fillText(a.ratio===7?'7:3 LOCKED · RELEASE 2':'HOLD 2 · ADJUST RATIO',640,655);return;}
    lastPanel=c.k;ctx.fillStyle='#000';ctx.fillRect(0,0,1280,44);ctx.fillRect(0,676,1280,44);
    if(c.k==='finish3'&&c.t>.5&&c.t<1.35){ctx.fillStyle='#80ddff';ctx.font='600 30px system-ui';ctx.textAlign='center';ctx.fillText('咒力',640,105);}
    if(c.k==='ratio'){
      const t=c.t;if(t<1.22){ctx.fillStyle='#020204';ctx.fillRect(0,0,1280,720);ctx.save();ctx.translate(640,360);
        ctx.globalAlpha=ease(t/.16);ctx.rotate(reduced?0:-TAU*(1-ease(t/.62)));ctx.scale(.7+.3*ease(t/.62),.7+.3*ease(t/.62));diagram(ctx,880,7,true);ctx.restore();
        if(t>.65){const k=ease((t-.65)/.4);ctx.save();ctx.translate(640,360);ctx.strokeStyle='#da1534';ctx.lineWidth=7;
          for(let i=0;i<18;i++){const a=i/18*TAU;ctx.beginPath();for(let j=0;j<5;j++){const r=(70+j*86)*k,x=Math.cos(a+(j%2?.09:-.09))*r,y=Math.sin(a+(j%2?.09:-.09))*r*.7;ctx[j?'lineTo':'moveTo'](x,y);}ctx.stroke();}ctx.restore();}}
      if(t>=1.16&&t<1.48){const alpha=.72*Math.sin((t-1.16)/.32*Math.PI);ctx.fillStyle='rgba(255,255,255,'+alpha+')';ctx.fillRect(0,0,1280,720);}
    }
  }
  function endCinema(c){if(c.own){overlay.style.display='none';lastPanel='';camera.fov=c.cameraSaved.fov;camera.updateProjectionMatrix();camYaw=c.cameraSaved.yaw;camPitch=c.cameraSaved.pitch;}}
  function cleanup(){for(const h of [...effects])h.stop();overlay.style.display='none';lastPanel='';}
  const previousCamera=updateCamera;
  updateCamera=function(dt){previousCamera(dt);if((S.cine||S.reservation)&&!gameInputActive())S.cleanup();const c=S.cine;draw(c);if(!c)return;
    const targetY=c.k==='finish3'?1.7:c.k==='counter'?3.1+6*(1-ease((c.t-.26)/.85)):3.1;
    const mid=c.q.clone().add(V(0,targetY,0)),side=V(c.d.z,0,-c.d.x);
    camera.position.copy(mid).addScaledVector(side,c.k==='counter'?13:7.5).addScaledVector(c.d,4).add(V(0,c.k==='counter'?2.5:1.4,0));
    camera.lookAt(mid);camera.fov=c.k==='ratio'?42:c.k==='counter'?52:48;camera.updateProjectionMatrix();
  };
})();
