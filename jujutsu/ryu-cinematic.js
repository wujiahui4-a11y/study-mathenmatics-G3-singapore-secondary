/* Original voxel choreography and generated energy plates. All participants
   use the same timeline; spectators retain their camera and see world poses. */
(function () {
  'use strict';
  if(!window.JJRYUREWORK)return;
  const S=JJRYUREWORK,V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),TAU=Math.PI*2;
  const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);};
  const FX=window.JJFX,props=new Set(),awakes=new Map();
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
  let ownAwake=null,stage=null,lastOverlay='',time=0;
  const F=window.JJRYUFX={look,tick,pose,posePair,awake,beam,steam,comb,strike,slam,trail,burn,
    cinematic,endCinema,finish,cleanup,cancelAwake,
    audit:()=>({props:props.size,awakes:awakes.size,overlay:lastOverlay,stage:!!stage,flashFrame:lastFrame})};
  let lastFrame=-1;
  function material(color,basic=false){return basic?new THREE.MeshBasicMaterial({color,toneMapped:false}):new THREE.MeshStandardMaterial({color,roughness:.75});}
  function box(parent,name,x,y,z,w,h,d,color,basic=false) {
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color,basic));m.name=name;m.position.set(x,y,z);parent.add(m);return m;
  }
  function dispose(g) {
    g.removeFromParent();const geos=new Set(),mats=new Set();g.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);});
    geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());
  }
  function effect(g,duration,step,end) {
    scene.add(g);const h={g,t:0,dead:false,stop(){if(this.dead)return;this.dead=true;props.delete(this);dispose(g);end?.();}};props.add(h);
    addFx({t:1e9,update(dt){if(h.dead)return false;h.t+=dt;step(h.t,dt,h);if(h.t>=duration)h.stop();return !h.dead;}});return h;
  }
  function sound(kind) {
    try {if(kind==='charge')tone(160,.25,'sine',.025,480);else if(kind==='brush')noiseBurst(.065,.012,2500);else {tone(90,.12,'sine',.045,38);noiseBurst(.08,.03,750);}}catch(_){}
  }
  function rigParts(r) {
    if(!r?.head||r.ryuExtras||!r.ryuPompadour)return;
    const loose=new THREE.Group();loose.name='Ryu fully opened hair';r.head.add(loose);
    for(let i=0;i<15;i++) {
      const a=i/15*TAU,spike=new THREE.Mesh(new THREE.ConeGeometry(.18,.65+(i%3)*.13,4),material(i%2?0x171b25:0x10131b));
      spike.position.set(Math.cos(a)*.46,1.05+Math.sin(a)*.12,Math.sin(a)*.36);
      spike.rotation.set(Math.sin(a)*.9,0,-Math.cos(a)*.9);loose.add(spike);
    }
    for(let i=0;i<5;i++) {
      const lock=box(loose,'Loose fringe',-.4+i*.2,.67,.43,.13,.58+(i%2)*.18,.16,0x171b25);
      lock.rotation.z=(i-2)*.18;lock.rotation.x=-.16;
    }
    const pointer=new THREE.Group();pointer.name='Ryu articulated pointing fingers';r.handR.add(pointer);
    box(pointer,'Extended index finger',-.07,-.23,.1,.095,.56,.105,0xe8b98f);
    const thumb=box(pointer,'Raised thumb',.17,.03,.06,.105,.27,.11,0xe8b98f);thumb.rotation.z=-.65;
    for(let i=0;i<3;i++)box(pointer,'Folded finger '+i,.03+i*.085,.025,-.05,.07,.13,.17,0xe8b98f);
    const brush=new THREE.Group();brush.name='Ryu hair brush';r.handR.add(brush);
    box(brush,'Brush handle',0,-.12,0,.12,.48,.12,0x4b3023);
    const paddle=box(brush,'Brush paddle',0,-.53,0,.38,.47,.16,0x7c5140);paddle.rotation.z=.04;
    for(let y=0;y<5;y++)for(let x=0;x<4;x++)box(brush,'Brush bristle',-.12+x*.08,-.37-y*.078,.11,.035,.035,.13,0xd5d3cd);
    const meter=new THREE.Group();meter.name='Ryu vertical output meter';r.root.add(meter);meter.position.set(1.5,4,0);
    box(meter,'Meter outline',0,0,0,.19,1.85,.03,0x080c12,true);
    box(meter,'Meter track',0,0,.025,.12,1.72,.025,0x333b46,true);
    const fill=box(meter,'Output fill',0,-.84,.05,.10,1.68,.025,0xffffff,true);
    fill.geometry.translate(0,.84,0);
    pointer.visible=brush.visible=loose.visible=false;
    r.ryuExtras={loose,pointer,brush,meter,fill};
  }
  function look(r,heat,a) {
    rigParts(r);const x=r?.ryuExtras;if(!x)return;
    r.ryuHeat=heat;
    const brushing=a?.type==='rx_brush',open=heat>=100&&!(brushing&&a.t>1.05);
    for(const p of r.ryuPompadour)p.visible=!open;
    x.loose.visible=open;x.pointer.visible=a?.type==='rx_awake'&&a.t<2.85;
    x.brush.visible=brushing&&a.t>.1&&a.t<1.58;
    const level=brushing?heat*(1-ease((a.t-.2)/1.3)):heat;
    x.fill.scale.y=Math.max(.001,level/100);x.meter.visible=!!started&&!S.cine&&!r.ryuStage;
    const parent=r.root.getWorldQuaternion(new THREE.Quaternion());x.meter.quaternion.copy(parent.invert()).multiply(camera.quaternion);
  }
  const priorRig=makeAnimeRig;
  makeAnimeRig=function(cfg){const r=priorRig(cfg);if(cfg?.ryu)rigParts(r);return r;};
  function smoke(at,size=.6) {
    const g=new THREE.Group();
    const m=new THREE.Mesh(new THREE.SphereGeometry(size,7,5),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.3,depthWrite:false,toneMapped:false}));g.add(m);g.position.copy(at);
    effect(g,.9,(t,dt)=>{g.position.y+=dt*1.4;g.position.x+=dt*.2;g.scale.setScalar(1+t*1.8);m.material.opacity=.3*(1-t/.9);});
  }
  function steam(pos){for(let i=0;i<7;i++)smoke(pos.clone().add(V(Math.sin(i*2)*.6,5.5,Math.cos(i*2)*.4)),.35);}
  function tick(e,dt,heat,action) {
    time+=dt;if(!alive(e))return;
    look(e.rig,heat,e===player?player.action:action);
    e.rySmoke=(e.rySmoke||0)+dt;
    if(heat>=100&&e.rySmoke>.18){e.rySmoke=0;smoke(e.pos.clone().add(V(Math.sin(time*3)*.4,6,0)),.22);}
  }
  function alive(e){return e&&!e.dead&&e.rig;}
  function comb(pos){sound('brush');smoke(pos.clone().add(V(0,5.7,0)),.18);}
  function strike(pos,d){FX?.ring(pos.clone().add(V(0,2.8,0)),0xffffff,{maxR:3.5,life:.28,ground:false,axis:d});sound('hit');}
  function slam(pos){sound('hit');FX?.ring(pos.clone().add(V(0,.12,0)),0xffffff,{maxR:18,life:.8});FX?.ring(pos.clone().add(V(0,.18,0)),0xd9e7ef,{maxR:14,life:.55});}
  function trail(e) {
    let t=0,acc=0,last=e.pos.clone().add(V(0,2.5,0));
    addFx({t:1e9,update(dt){t+=dt;acc+=dt;if(acc>.055){acc=0;const now=e.pos.clone().add(V(0,2.5,0));FX?.cutLine(last,now,0xffffff,.5,.35);last=now;}return t<1.35&&!!e.rig;}});
  }
  function burn(e) {
    // A white energy coating and steam communicate beam contact without wounds.
    let t=0,acc=0;addFx({t:1e9,update(dt){t+=dt;acc+=dt;if(acc>.13){acc=0;smoke(e.pos.clone().add(V(Math.sin(t*12)*.65,2+t,Math.cos(t*9)*.4)),.25);}return t<1.5&&alive(e);}});
  }
  function awake(e,a) {
    if(awakes.has(a.event))return;
    const c={e,a,t:0,event:a.event,own:e===player,origin:e.pos.clone(),dir:a.dir.clone(),saved:null};
    if(c.own){c.saved={fov:camera.fov,yaw:camYaw,pitch:camPitch};ownAwake=c;sound('charge');}
    const g=new THREE.Group(),orb=new THREE.Mesh(new THREE.SphereGeometry(1,18,12),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,toneMapped:false}));g.add(orb);
    c.effect=effect(g,5.2,(t)=>{
      c.t=t;if(!alive(e)||(c.own&&player.action?.event!==c.event)){c.effect.stop();return;}
      g.visible=t<2.8;g.position.copy(JJRYU.muzzle(e.rig,e.pos,c.dir));g.scale.setScalar(.12+ease(t/2.8)*2.7);
      if(t<2.8&&Math.floor(t*8)!==c.ring){c.ring=Math.floor(t*8);FX?.ring(g.position.clone(),0xc8e8ff,{from:3,maxR:.3,life:.3,ground:false});}
    },()=>{awakes.delete(c.event);if(ownAwake===c){ownAwake=null;camera.fov=c.saved.fov;camera.updateProjectionMatrix();camYaw=c.saved.yaw;camPitch=c.saved.pitch;}});
    awakes.set(c.event,c);
  }
  function cancelAwake(event){awakes.get(event)?.effect.stop();}
  function beam(from,d) {
    const g=new THREE.Group();g.position.copy(from);g.quaternion.setFromUnitVectors(V(0,1,0),d.clone().normalize());
    const layers=[];
    for(const [r,c,opacity] of [[8.5,0x8bd8ff,.25],[5.4,0xcbeeff,.55],[3,0xffffff,.9]]) {
      const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,180,22,1,true),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));
      m.position.y=90;layers.push({m,opacity});g.add(m);
    }
    effect(g,1.9,(t)=>{const grow=ease(t/.24),fade=1-ease((t-1.35)/.55);g.scale.set(grow,Math.max(.02,grow),grow);for(const {m,opacity} of layers)m.material.opacity=opacity*fade;});
    sound('hit');
  }
  function reset(r){resetPose(r);r.body.rotation.set(0,0,0);}
  function punchPose(r,t,side=1,hold=false) {
    reset(r);const k=hold?1:Math.pow(Math.max(0,Math.sin(t*19)),.7);
    const arm=side>0?'R':'L',other=side>0?'L':'R';
    r.spine.rotation.y=.12*side*k;r.spine.rotation.x=.08;
    r['shoulder'+arm].rotation.set(-1.05-1*k,-side*.28,-side*.2);
    r['elbow'+arm].rotation.x=-1.2*(1-k);
    r['shoulder'+other].rotation.x=-.5;r['elbow'+other].rotation.x=-1.5;
    r.hipL.rotation.x=-.22;r.hipR.rotation.x=.28;r.kneeL.rotation.x=.15;
  }
  function pose(r,a) {
    if(!a||!S.kit[a.type])return false;
    const t=a.t;reset(r);
    if(a.type==='rx_brush') {
      const lift=ease(t/.28)*(1-ease((t-1.45)/.25)),stroke=Math.sin(t*13)*.18;
      r.shoulderR.rotation.set(-1.72*lift,0,-.2*lift);r.elbowR.rotation.x=(-1.85+stroke)*lift;
      r.neck.rotation.x=.12*lift;r.spine.rotation.z=-.05*lift;r.shoulderL.rotation.x=-.3;r.elbowL.rotation.x=-.6;
    } else if(a.type==='rx_awake') {
      const k=ease(t/.65),release=ease((t-2.8)/.24);
      r.shoulderR.rotation.set(-Math.PI/2*k,0,-.18*k);r.elbowR.rotation.x=-.08;
      r.shoulderL.rotation.x=.25;r.elbowL.rotation.x=-.2;
      r.neck.rotation.x=-.09*ease(t/2.8)+release*.16;r.spine.rotation.x=-.08-.16*release;
      r.hipL.rotation.x=.2;r.hipR.rotation.x=-.28;r.kneeR.rotation.x=.4;
    } else if(a.type==='rx1') {
      if(t<.53){const k=Math.sin(clamp(t/.5)*Math.PI);r.hipR.rotation.x=-1.7*k;r.kneeR.rotation.x=.3*(1-k);r.spine.rotation.x=-.3*k;r.shoulderL.rotation.x=-.5;r.shoulderR.rotation.x=.6;}
      else {punchPose(r,(t-.5)*1.3,-1,true);r.body.rotation.y=Math.PI*ease((t-.48)/.2);}
    } else if(a.type==='rx2') {
      const k=ease(t/.6),out=ease((t-.65)/.7);
      r.hips.position.y=r.hipsBaseY-.9*k*(1-out);r.spine.rotation.x=.95*k*(1-out);
      r.shoulderR.rotation.x=t<.4?-2.3*ease(t/.4):-.5;r.elbowR.rotation.x=-.15;
      r.hipL.rotation.x=-.45*k;r.hipR.rotation.x=.5*k;r.kneeL.rotation.x=.85*k;r.kneeR.rotation.x=.65*k;
    } else if(a.type==='rx3'||a.type==='rx4') {
      const wind=ease(t/.8);r.spine.rotation.x=.35;r.spine.rotation.y=-.3*wind;
      r.shoulderR.rotation.x=.3+wind*.65;r.elbowR.rotation.x=-1.3;
      r.shoulderL.rotation.x=-.85;r.elbowL.rotation.x=-1;
      r.hipL.rotation.x=Math.sin(t*16)*.55;r.hipR.rotation.x=-r.hipL.rotation.x;r.kneeL.rotation.x=Math.max(0,-Math.sin(t*16))*.6;r.kneeR.rotation.x=Math.max(0,Math.sin(t*16))*.6;
    }
    look(r,r===player.rig?S.heat:r.ryuHeat||0,a);return true;
  }
  const priorPose=poseAction;
  poseAction=function(r,a){if(pose(r,a))return;return priorPose(r,a);};
  function pairPose(r,kind,t,victim) {
    if(kind==='rx3'){punchPose(r,t,victim?-1:1,t>.9);r.neck.rotation.y=(victim?-1:1)*.3;return;}
    const freeze=(t>=2&&t<2.65)||(t>=5.65&&t<6.3)||t>=6.3;
    punchPose(r,t+(victim?.13:0),victim?-1:1,freeze);
    if(t>=9.2) {
      r.shoulderR.rotation.x=-1.15;r.shoulderL.rotation.x=-1.45;r.elbowL.rotation.x=-.25;r.elbowR.rotation.x=-.55;
      r.spine.rotation.y=victim?.32:-.32;r.neck.rotation.x=-.18;r.neck.rotation.y=victim?.3:-.25;
      if(t>11.5){const k=ease((t-11.5)/.8);r.body.rotation.z=(victim?-1:1)*1.5*k;r.hips.position.y=r.hipsBaseY-1.9*k;r.shoulderL.rotation.z=k;r.shoulderR.rotation.z=-k;r.kneeL.rotation.x=.4*k;}
    } else if(t>=2&&t<2.65&&!victim)r.neck.rotation.y=.55;
    else if(t>=5.65&&t<6.3&&victim)r.neck.rotation.y=-.55;
  }
  function posePair(c) {
    for(const [i,e] of [c.caster,c.victim].entries()) {
      pairPose(e.rig,c.kind,c.t,!!i);e.rig.root.position.copy(e.pos);e.rig.root.rotation.y=e.facing;
      if(e.rig.ryuExtras)e.rig.ryuExtras.meter.visible=false;
    }
    if((c.kind==='rx3'&&c.t>.85)||(c.kind==='rx4'&&(c.t<2||(c.t>2.65&&c.t<5.65)))) {
      const beat=Math.floor(c.t*6);
      if(c.beat!==beat){c.beat=beat;strike(c.p.clone().addScaledVector(c.d,1.4).add(V(0,1.6,0)),c.d);}
    }
  }
  function cinematic(c) {
    c.cameraSaved=c.own?{fov:camera.fov,yaw:camYaw,pitch:camPitch}:null;
    if(c.kind==='rx3') {
      const g=new THREE.Group();
      for(let i=0;i<15;i++){const a=i/15*TAU,m=box(g,'Floating impact fragment',Math.cos(a)*4,1+(i%4)*.75,Math.sin(a)*4,.5+(i%3)*.35,.5,.65,0x6c7785);m.rotation.set(i*.3,i,.2);}
      g.position.copy(c.p);c.debris=effect(g,2.6,(t,dt)=>{g.rotation.y+=dt*.15;for(const [i,m]of g.children.entries())m.position.y+=Math.sin(t*3+i)*dt*.4;});
    }
  }
  function endCinema(c) {
    c.debris?.stop();
    if(c.own){clearStage();overlay.style.display='none';lastOverlay='';lastFrame=-1;
      camera.fov=c.cameraSaved.fov;camera.updateProjectionMatrix();camYaw=c.cameraSaved.yaw;camPitch=c.cameraSaved.pitch;}
  }
  function finish(c){FX?.ring(c.p.clone().add(V(0,.15,0)),0xffffff,{maxR:5,life:.55});}
  function cleanup(){for(const p of [...props])p.stop();awakes.clear();ownAwake=null;clearStage();overlay.style.display='none';}

  const images={},textures={};
  for(const [key,src]of Object.entries(window.JJRYUART||{})) {
    const im=new Image();im.onload=()=>{images[key]=im;const tex=new THREE.Texture(im);tex.colorSpace=THREE.SRGBColorSpace;tex.needsUpdate=true;textures[key]=tex;};im.src=src;
  }
  const overlay=document.createElement('canvas');overlay.id='jjRyuCinema';overlay.setAttribute('aria-hidden','true');
  overlay.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:66;display:none';document.body.appendChild(overlay);
  const ctx=overlay.getContext('2d');
  function cupcake(x,y,scale,flip) {
    ctx.save();ctx.translate(x,y);ctx.scale(scale*(flip?-1:1),scale);
    ctx.fillStyle='#8a522f';ctx.beginPath();ctx.moveTo(-55,0);ctx.lineTo(55,0);ctx.lineTo(40,80);ctx.lineTo(-40,80);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#d29554';ctx.lineWidth=3;for(let i=-3;i<=3;i++){ctx.beginPath();ctx.moveTo(i*13,5);ctx.lineTo(i*10,73);ctx.stroke();}
    ctx.fillStyle='#fff3d9';for(const [cx,cy,r]of [[-30,-10,32],[0,-20,40],[30,-10,31],[0,-52,25]]){ctx.beginPath();ctx.arc(cx,cy,r,0,TAU);ctx.fill();}
    ctx.fillStyle='#de5046';ctx.beginPath();ctx.arc(0,-77,12,0,TAU);ctx.fill();ctx.restore();
  }
  function drawOverlay(c) {
    const w=overlay.width=1280,h=overlay.height=720,t=c?.t||0;
    ctx.clearRect(0,0,w,h);lastFrame=-1;
    if(!c){overlay.style.display=ownAwake?'block':'none';if(ownAwake){ctx.fillStyle='#000';ctx.fillRect(0,0,w,45);ctx.fillRect(0,h-45,w,45);}return;}
    overlay.style.display='block';lastOverlay='letterbox';
    ctx.fillStyle='#050609';ctx.fillRect(0,0,w,50);ctx.fillRect(0,h-50,w,50);
    if(c.kind==='rx3'&&t<.88){lastOverlay='cupcakes';ctx.fillRect(0,0,w,h);const k=ease(t/.88);cupcake(180+920*k,330,1.15,false);cupcake(1100-920*k,415,1.15,true);}
    if(c.kind==='rx4'&&t>=6.3&&t<8.3) {
      lastOverlay='black-flash';ctx.fillStyle='#070102';ctx.fillRect(0,0,w,h);
      const im=images['black-flash'];lastFrame=reduced?5:Math.min(11,Math.floor((t-6.3)*6));
      // Measured cell boundaries: generated rows are not exactly equal height.
      if(im){const xs=[0,483,966,1449,1931],ys=[0,250,511,814],col=lastFrame%4,row=Math.floor(lastFrame/4),inset=5;
        ctx.drawImage(im,xs[col]+inset,ys[row]+inset,xs[col+1]-xs[col]-2*inset,ys[row+1]-ys[row]-2*inset,0,0,w,h);}
    }
    if(c.kind==='rx4'&&t>=8.3&&t<9.2){lastOverlay='white-fade';const k=(t-8.3)/.9;ctx.fillStyle='rgba(255,255,255,'+(k<.5?ease(k*2):1-ease((k-.5)*2))+')';ctx.fillRect(0,0,w,h);}
  }
  function clearStage(){if(!stage)return;dispose(stage.root);stage=null;}
  function finalStage(c) {
    if(!stage||stage.event!==c.event) {
      clearStage();const world=new THREE.Scene(),root=new THREE.Group();world.add(root);
      world.background=textures['dessert-void']||new THREE.Color(0x100206);
      world.add(new THREE.AmbientLight(0xffffff,2.1));const key=new THREE.DirectionalLight(0xffeee2,3.8);key.position.set(3,7,6);world.add(key);
      const rigs=[c.caster,c.victim].map(e=>{const id=e.char||e.rig.__char||'gojo',r=makeAnimeRig(CHARS[id]?.cfg||CHARS.gojo.cfg);r.__char=id;r.ryuStage=true;root.add(r.root);return r;});
      stage={event:c.event,world,root,rigs,camera:new THREE.PerspectiveCamera(43,camera.aspect,.1,120)};
    }
    stage.world.background=textures['dessert-void']||stage.world.background;
    const drift=ease((c.t-10.1)/1.4)*1.7;
    stage.rigs.forEach((r,i)=>{pairPose(r,'rx4',c.t,!!i);r.root.position.set(i?1.15+drift:-1.15-drift,0,0);r.root.rotation.y=i?-Math.PI/2:Math.PI/2;if(r.ryuExtras){look(r,100,null);r.ryuExtras.meter.visible=false;}});
    const pull=ease((c.t-10.1)/1.4),cam=stage.camera;cam.aspect=camera.aspect;cam.position.set(0,4.3,8+3.6*pull);cam.lookAt(V(0,c.t>11.5?2.4:3.9,0));cam.updateProjectionMatrix();return stage;
  }
  const priorRender=renderer.render.bind(renderer);
  renderer.render=function(world,cam) {
    const c=S.cine;
    if(world===scene&&c?.kind==='rx4'&&c.t>=9.2){const st=finalStage(c);return priorRender(st.world,st.camera);}
    return priorRender(world,cam);
  };
  const priorCamera=updateCamera;
  updateCamera=function(dt) {
    priorCamera(dt);const c=S.cine,w=ownAwake;drawOverlay(c);
    if(!c&&!w)return;
    let origin,d,at,lookAt,fov;
    if(c) {
      origin=c.p;d=c.d;const side=V(d.z,0,-d.x),mid=origin.clone().addScaledVector(d,1.4);
      if(c.kind==='rx4'&&c.t>=2&&c.t<2.65) {
        const head=c.caster.rig.head;head.updateWorldMatrix(true,false);lookAt=head.localToWorld(V(0,.5,0));
        const forward=V(0,0,1).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()));
        at=lookAt.clone().addScaledVector(forward,3.5).addScaledVector(side,.65).add(V(0,.08,0));fov=32;
      } else if(c.kind==='rx4'&&c.t>=5.65&&c.t<6.3) {
        const head=c.victim.rig.head;head.updateWorldMatrix(true,false);lookAt=head.localToWorld(V(0,.5,0));
        const forward=V(0,0,1).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()));
        at=lookAt.clone().addScaledVector(forward,3.5).addScaledVector(side,-.65).add(V(0,.08,0));fov=32;
      } else {
        const orbit=reduced?0:Math.sin(c.t*.7)*.55;
        at=mid.clone().addScaledVector(side,8+orbit).addScaledVector(d,4).add(V(0,4.7,0));lookAt=mid.clone().add(V(0,3.4,0));fov=49;
      }
    } else {
      origin=w.origin;d=w.dir;const side=V(d.z,0,-d.x);
      if(w.t<1){at=origin.clone().addScaledVector(d,4.6).addScaledVector(side,3).add(V(0,5,0));lookAt=origin.clone().addScaledVector(d,1).add(V(0,4.8,0));fov=43;}
      else if(w.t<2.8){at=origin.clone().addScaledVector(d,5.2).addScaledVector(side,2.6).add(V(0,5.4,0));lookAt=origin.clone().add(V(0,5.6,0));fov=43-ease((w.t-1)/1.8)*8;}
      else {at=origin.clone().addScaledVector(d,-7).addScaledVector(side,11).add(V(0,9,0));lookAt=origin.clone().addScaledVector(d,25).add(V(0,5.2,0));fov=60;}
    }
    camera.position.copy(at);camera.lookAt(lookAt);camera.fov=fov;camera.updateProjectionMatrix();
  };
  const priorHUD=updateHUD;
  updateHUD=function(dt){priorHUD(dt);if(player.char!=='ryu')return;const bar=document.getElementById('jjAwake');if(bar&&S.phase===2){bar.style.display=gameInputActive()?'block':'none';bar.querySelector('.fill').style.width=(S.remaining/60*100)+'%';bar.querySelector('.lbl').textContent='DESSERT · SECOND PHASE';bar.querySelector('.hint').textContent=Math.ceil(S.remaining)+'s';}}
})();
