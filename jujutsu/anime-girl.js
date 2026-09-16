/* Secret fighter: Stupid Anime Girl. Original voxel art and joint animation.
   White ribbons represent wind. Cast clocks own hits; remote clocks only draw. */
(function () {
  'use strict';
  const ID = 'animegirl', KEY = 'jj.secret.animegirl.v1', WHITE = 0xffffff;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const dir = y => V(Math.sin(y), 0, Math.cos(y));
  let unlocked = false, sequence = 1000000000, seenRig = null;
  try { unlocked = localStorage.getItem(KEY) === '1'; } catch (_) {}
  const KIT = {
    ag1: { name: 'Slap', cd: 18, dur: 1.05, cost: 30, events: [.38] },
    ag2: { name: 'Baka', cd: 16, dur: 1.65, cost: 35, events: [.46, .64, .82, 1, 1.18] },
    ag3: { name: 'Continuous Punch', cd: 10, dur: 2.05, cost: 25, events: [.3, .44, .58, .72, .86, 1, 1.14, 1.28, 1.42, 1.56, 1.7] },
    ag4: { name: 'Tsundere Kick', cd: 11, dur: 1.2, cost: 25, events: [.42] },
    agr: { name: 'Tsundere', cd: 2.5, dur: .8, cost: 0, events: [.48] }
  };
  const S = window.JJANIMEGIRL = { kit: KIT, cast, remote: {}, props: new Set(),
    charge: 0, stamina: 100, get unlocked() { return unlocked; },
    get maxStamina() { return 100 + S.charge * .5; },
    get power() { return 1 + S.charge * .0075; },
    submitWord, unlockZone, storageKey: KEY };
  const cfg = { animegirl: true, face: false, skin: 0xf1d2b5, torso: 0xf5f5f5, pants: 0x353535, shoes: 0x222222 };

  // Keep the standard articulated skeleton, rebuild its visible voxel surfaces.
  const oldRig = makeAnimeRig;
  makeAnimeRig = function (c) {
    const r = oldRig(c);
    if (!c?.animegirl) return r;
    const meshes = [], geos = new Set(), mats = new Set();
    r.root.traverse(o => { if (o.isMesh) meshes.push(o); });
    meshes.forEach(o => { o.removeFromParent(); geos.add(o.geometry); mats.add(o.material); });
    geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose());
    r.__char = ID;
    const palette = new Map();
    function box(parent, name, p, size, color) {
      if (!palette.has(color)) palette.set(color, new THREE.MeshToonMaterial({ color }));
      const m = new THREE.Mesh(new THREE.BoxGeometry(...size), palette.get(color));
      m.name = name; m.position.set(...p); m.castShadow = true; parent.add(m); return m;
    }
    const ink = 0x252525, hair = 0x363636, lightHair = 0x505050, gray = 0xbcbcbc;
    box(r.hips, 'Skirt waistband', [0,.35,0], [1,.7,.6], ink);
    r.agSkirt = [];
    // Overlapping opaque pleats form a knee-length skirt around the hips.
    for (let i=0;i<12;i++) {
      const a=i/12*Math.PI*2, panel=new THREE.Group();
      panel.rotation.y=a;panel.position.set(Math.sin(a)*.48,.28,Math.cos(a)*.34);r.hips.add(panel);
      const pleat=box(panel,'Charcoal skirt pleat',[0,-.62,.1],[.44,1.42,.14],i%2?ink:0x3c3c3c);
      pleat.rotation.x=-.2; r.agSkirt.push(panel);
      box(panel,'White skirt hem',[0,-1.27,.24],[.44,.1,.15],WHITE);
    }
    box(r.spine, 'White long sleeve jacket', [0,.52,0], [1.28,1.1,.68], WHITE);
    box(r.spine, 'Jacket hem', [0,0,.01], [1.34,.18,.72], gray);
    for (const s of [-1,1]) {
      const lapel = box(r.spine, 'Charcoal collar', [s*.2,.94,.38], [.3,.36,.08], ink);
      lapel.rotation.z = s*.42;
    }
    box(r.spine, 'White scarf knot', [0,.8,.44], [.2,.2,.14], WHITE);
    r.agScarf = new THREE.Group(); r.agScarf.position.set(0,.72,.42); r.spine.add(r.agScarf);
    box(r.agScarf, 'Scarf tail', [.09,-.27,0], [.18,.64,.08], gray);
    box(r.neck, 'Neck', [0,.1,0], [.28,.26,.28], cfg.skin);
    box(r.head, 'Face', [0,.48,0], [.92,.94,.86], cfg.skin);
    box(r.head, 'Dark hair cap', [0,1,0], [1.08,.32,1.02], hair);
    box(r.head, 'Back hair', [0,.55,-.44], [1.02,.94,.24], hair);
    for (let i = 0; i < 5; i++) {
      box(r.head, 'Stepped fringe', [-.44+i*.22,.88-(i%2)*.07,.48], [.24,.28+(i%2)*.14,.16], i%2?hair:lightHair);
    }
    r.agTails = [];
    for (const s of [-1,1]) {
      box(r.head, 'Almond eye white', [s*.225,.53,.451], [.28,.22,.035], WHITE);
      box(r.head, 'Eye inner corner', [s*.105,.52,.452], [.045,.12,.034], WHITE);
      box(r.head, 'Upper eyelash', [s*.225,.65,.47], [.3,.045,.04], ink);
      const lash=box(r.head,'Outer eyelash',[s*.385,.655,.47],[.09,.035,.04],ink);lash.rotation.z=s*.3;
      box(r.head, 'Iris outline', [s*.225,.535,.476], [.15,.205,.026], ink);
      box(r.head, 'Silver iris', [s*.225,.525,.494], [.115,.15,.024], 0x8c9ba3);
      box(r.head, 'Eye pupil', [s*.225,.55,.51], [.065,.115,.02], ink);
      box(r.head, 'Eye upper glint', [s*.225-.035,.593,.529], [.05,.045,.013], WHITE);
      box(r.head, 'Eye lower glint', [s*.225+.03,.477,.524], [.026,.026,.012], WHITE);
      const brow = box(r.head, 'Determined brow', [s*.22,.68,.47], [.27,.055,.05], ink); brow.rotation.z=s*.14;
      const tail = new THREE.Group(); tail.position.set(s*.56,.75,-.12); r.head.add(tail);
      box(tail, 'White hair tie', [s*.05,0,0], [.25,.22,.3], WHITE);
      for (let j=0;j<4;j++) box(tail, 'Stepped twin tail', [s*(.15+j*.055),-.27-j*.3,-.04], [.35-j*.04,.38,.34], j%2?lightHair:hair);
      r.agTails.push(tail);
      const side = s<0?'L':'R';
      box(r['shoulder'+side], 'Jacket upper sleeve', [0,-.49,0], [.46,1,.46], WHITE);
      box(r['elbow'+side], 'Jacket lower sleeve', [0,-.42,0], [.4,.84,.4], WHITE);
      box(r['elbow'+side], 'Gray cuff', [0,-.83,0], [.42,.13,.42], gray);
      box(r['elbow'+side], 'Hand', [0,-1.02,.02], [.34,.26,.3], cfg.skin);
      box(r['hip'+side], 'Opaque tights upper', [0,-.59,0], [.36,1.18,.4], ink);
      box(r['knee'+side], 'Opaque tights lower', [0,-.55,0], [.32,1.1,.36], ink);
      box(r['ankle'+side], 'White sneaker', [0,-.11,.14], [.48,.24,.8], WHITE);
      box(r['ankle'+side], 'Sneaker sole', [0,-.24,.14], [.5,.08,.82], gray);
    }
    r.agMouth=box(r.head,'Shout mouth',[0,.28,.45],[.18,.055,.04],ink);
    return r;
  };
  CHARS[ID] = { name: 'STUPID ANIME GIRL', shortName: 'Stupid Anime Girl', sub: 'SECRET — WHITE WIND', cfg, glow: '#ffffff',
    secret: true, isUnlocked: () => unlocked, moves: [
      {key:'LMB',lbl:'Punch',cd:'m1',max:.3},{key:'Q',lbl:'Dash',cd:'dash',max:1},
      ...Object.entries(KIT).map(([key,k],i) => { cds[key]=0; return {key:i===4?'R':String(i+1),lbl:k.name,cd:key,max:k.cd}; })
    ] };
  // Portrait faces the camera; dispose its temporary resources after rendering.
  try {
    const pr = new THREE.WebGLRenderer({alpha:true,antialias:true}); pr.setSize(160,160);
    const sc = new THREE.Scene(), r = makeAnimeRig(cfg), cam = new THREE.PerspectiveCamera(32,1,.1,30);
    r.root.rotation.y=-.18; sc.add(r.root,new THREE.HemisphereLight(WHITE,0x777777,2));
    const light=new THREE.DirectionalLight(WHITE,2);light.position.set(-3,8,5);sc.add(light);
    cam.position.set(.2,5.6,5);cam.lookAt(0,5.05,0);pr.render(sc,cam);
    CHARS[ID].portrait=pr.domElement.toDataURL();
    const gs=new Set(),ms=new Set();r.root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});
    gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());pr.dispose();
  } catch (_) { CHARS[ID].portrait=''; }
  buildCharList();

  function dispose(p) {
    if(p.dead)return;p.dead=true;p.g.removeFromParent();
    const gs=new Set(),ms=new Set(),ts=new Set();
    p.g.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material){ms.add(o.material);if(o.material.map)ts.add(o.material.map);}});
    gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());S.props.delete(p);
  }
  function effect(g,life,update,local) {
    // Bounded meshes even when many peers cast at once.
    if(S.props.size>=64)dispose(S.props.values().next().value);
    scene.add(g);const p={g,t:0,dead:false,local};S.props.add(p);
    addFx({update(dt){if(p.dead)return false;p.t+=dt;if(p.t>=life){dispose(p);return false;}
      update(p.t/life,p.t);g.traverse(o=>{if(o.material)o.material.opacity=1-ease((p.t/life-.5)*2);});return true;}});
  }
  function wind(at,d,radius,length,local,vertical=false) {
    const g=new THREE.Group();g.position.copy(at);g.quaternion.setFromUnitVectors(V(0,0,1),d);
    const mat=new THREE.MeshBasicMaterial({color:WHITE,side:THREE.DoubleSide,transparent:true,depthWrite:false,toneMapped:false});
    const count=window.JJPOTATO?.enabled?3:6;
    for(let i=0;i<count;i++) {
      const pts=[];
      for(let j=0;j<=20;j++) {const t=j/20,a=i/count*Math.PI*2+t*Math.PI*1.3;
        pts.push(V(Math.cos(a)*radius*(.25+t*.75),Math.sin(a)*radius*(.25+t*.75),t*length));}
      const m=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),20,.045+radius*.012,3,false),mat);g.add(m);
    }
    effect(g,.58,(k)=>{g.scale.setScalar(.45+k*.85);g.position.copy(at).addScaledVector(d,k*(vertical?2:5));g.rotateZ(.06);},local);
  }
  function shoutText(at,local) {
    const cv=document.createElement('canvas');cv.width=512;cv.height=160;const c=cv.getContext('2d');
    c.font='900 100px sans-serif';c.textAlign='center';c.lineWidth=10;c.strokeStyle='#222';c.fillStyle='#fff';c.strokeText('BAKA!',256,112);c.fillText('BAKA!',256,112);
    const tex=new THREE.CanvasTexture(cv),m=new THREE.SpriteMaterial({map:tex,color:WHITE,transparent:true,depthWrite:false});
    const sp=new THREE.Sprite(m);sp.position.copy(at);sp.scale.set(8,2.5,1);
    effect(sp,.85,k=>{sp.position.y=at.y+k*2;sp.scale.set(8+k*2,2.5+k*.6,1);},local);
  }
  function shoutAudio() {
    // Browser voice is optional; the visual shout and synthesized whoosh always play.
    sfx.whoosh();
    // Bright, short formants add bite without increasing peak volume.
    if(typeof tone==='function'){
      tone(1450,.14,'sine',.035,600);
      tone(1750,.24,'triangle',.025,450,.11);
    }
    if(typeof noiseBurst==='function')noiseBurst(.16,.025,2200,'bandpass');
    try {if(window.speechSynthesis&&!speechSynthesis.speaking){const u=new SpeechSynthesisUtterance('Baka!');u.lang='ja-JP';u.rate=1.35;u.pitch=1.85;u.volume=.6;speechSynthesis.speak(u);}} catch (_) {}
  }
  function visual(key,i,from,d,local,power=1) {
    const at=from.clone().add(V(0,3,0)),right=V(d.z,0,-d.x);
    if(key==='ag1')wind(at.clone().addScaledVector(d,3),d,3*power,5,local);
    if(key==='ag2') {wind(at.clone().addScaledVector(d,2+i*8*power),d,(4+i*1.4)*power,8,local);if(i===0){shoutText(from.clone().add(V(0,7,0)),local);if(local)shoutAudio();}}
    if(key==='ag3')wind(at.clone().addScaledVector(right,i%2?-.75:.75).addScaledVector(d,1.5),d,i===10?2.6:.55,i===10?6:3,local);
    if(key==='ag4')wind(at.clone().addScaledVector(d,2),V(0,1,0),2.5*power,6,local,true);
    if(key==='agr')wind(from.clone().add(V(0,.2,0)),V(0,1,0),2.6,5,local,true);
  }

  function cast(key) {
    const k=KIT[key];
    if(!k||player.char!==ID||!unlocked||!gameInputActive()||player.dead||player.react||player.frameT>0||busy()||window.JJFIGHT?.locked()||cds[key]>0)return false;
    if(key==='agr'&&S.charge>=100&&S.stamina>=S.maxStamina)return false;
    if(S.stamina<k.cost){window.JJNOTICE?.('Not enough stamina — press R to build Tsundere.','#ffffff');return false;}
    const power=S.power;
    S.stamina-=k.cost;cds[key]=k.cd/(key==='agr'?1:1+S.charge*.003);
    player.action={type:key,t:0,dur:k.dur,stage:0,origin:player.pos.clone(),dir:dir(player.facing),power,hits:new Set(),serial:sequence+=20};
    sfx.whoosh();return true;
  }
  function targets(a,range,width) {
    return enemies.filter(e=>{
      if(!e||e.dead||e.hp<=0||e.iframes>0||e.rag||e.bcFall||e.cineHold||e.tdHold||e.mhConsumed||window.JJGORE?.isHeld(e))return false;
      const delta=e.pos.clone().sub(a.origin),along=delta.dot(a.dir),across=Math.abs(delta.x*a.dir.z-delta.z*a.dir.x);
      if(along<-.5||along>range||across>width||Math.abs(delta.y)>5)return false;
      return !window.JJFIGHT||JJFIGHT.actors.visible(a.origin.clone().add(V(0,2.6,0)),e.pos.clone().add(V(0,2.6,0)));
    });
  }
  function hit(e,a,index,amount,power,up,down,breakGuard=false) {
    const before=e.hp;
    e.damage(amount,a.dir.clone().multiplyScalar(power).add(V(0,up,0)),{
      spark:WHITE,fin:false,death:'ragdoll',noFrameBonus:true,react:down?'blow':'stagger',reactDur:down?.65:.2,
      combat:{id:a.serial+index,kind:'animegirl',guardable:true,breakGuard,source:a.origin.clone(),stun:down?.7:.24,down,variant:up>20?'up':'normal'}
    });
    if(e.hp<before){sfx.punch();if(typeof hitstop==='function')hitstop(a.type==='ag3'?.018:.055);addShake(a.type==='ag3'?.09:.7);}
  }
  const oldStep=stepAction;
  stepAction=function(a,dt) {
    if(!KIT[a.type])return oldStep(a,dt);
    if(player.dead||player.react||player.stunT>0){player.action=null;return;}
    player.vel.x*=Math.exp(-dt*16);player.vel.z*=Math.exp(-dt*16);
    const k=KIT[a.type];
    while(a.stage<k.events.length&&a.t>=k.events[a.stage]) {
      const i=a.stage++,power=a.power;
      visual(a.type,i,a.origin,a.dir,true,power);
      if(a.type==='agr'){S.charge=clamp(S.charge+25,0,100);S.stamina=Math.min(S.maxStamina,S.stamina+35);continue;}
      if(a.type==='ag1')for(const e of targets(a,5.5,2.8))hit(e,a,i,Math.max(e.hp,e.maxHp||100)+1,135*power,36,1.5,true);
      if(a.type==='ag2') {
        const range=(10+i*8)*power;
        // A travelling wave makes a large swath, using bounded host-owned hits.
        if(window.JJDESTRUCT?.settings.enabled)JJDESTRUCT.hit(a.origin.clone().addScaledVector(a.dir,range-3).add(V(0,4,0)),Math.min(18,10+i*1.6));
        for(const e of targets(a,range,5+i*1.8))if(!a.hits.has(e)){a.hits.add(e);hit(e,a,i,24*power,76*power,22,1.3,true);}
      }
      if(a.type==='ag3')for(const e of targets(a,6,2.8))hit(e,a,i,(i===10?8:2)*power,i===10?28:0,i===10?12:0,i===10?1:0);
      if(a.type==='ag4')for(const e of targets(a,6,3))hit(e,a,i,26*power,16*power,36*power,1.6);
    }
  };

  // Anticipation / contact / follow-through / recovery keyframes, in seconds.
  const POSES={
    ag1:[[0,{}],[.26,{spine:[-.1,-.65,-.1],hips:[0,-.25,0],shoulderR:[-.45,0,-1.4],elbowR:[-1.15,0,0],shoulderL:[-.7,0,.3],kneeL:[.32,0,0],height:-.16}],
      [.39,{spine:[.14,.65,.1],shoulderR:[-1.6,0,.8],elbowR:[-.05,0,0],hips:[0,.35,0],hipR:[.28,0,0]}],[.62,{spine:[.1,.45,0],shoulderR:[-1.3,0,1.15]}],[1.05,{}]],
    ag2:[[0,{}],[.32,{spine:[-.32,0,0],neck:[-.24,0,0],shoulderL:[.25,0,.4],shoulderR:[.25,0,-.4],elbowL:[-1.7,0,0],elbowR:[-1.7,0,0],height:-.12}],
      [.46,{spine:[.38,0,0],neck:[-.18,0,0],shoulderL:[-.6,0,.45],shoulderR:[-.6,0,-.45],elbowL:[-1.8,0,0],elbowR:[-1.8,0,0],hipL:[-.3,0,-.15],kneeL:[.4,0,0],height:-.22,mouth:1}],
      [1.2,{spine:[.3,0,0],neck:[-.18,0,0],shoulderL:[-.6,0,.4],shoulderR:[-.6,0,-.4],elbowL:[-1.8,0,0],elbowR:[-1.8,0,0],mouth:1}],[1.65,{}]],
    ag4:[[0,{}],[.27,{spine:[.25,-.25,0],hipR:[-1.05,0,.1],kneeR:[1.65,0,0],kneeL:[.4,0,0],shoulderL:[-.8,0,.4],shoulderR:[.4,0,-.6],height:-.3}],
      [.43,{spine:[-.48,.2,-.15],hipR:[-2.7,0,.1],kneeR:[.06,0,0],ankleR:[.35,0,0],shoulderL:[.4,0,.7],shoulderR:[-.6,0,-.6],height:.22}],
      [.65,{spine:[-.25,.1,0],hipR:[-1.6,0,.12],kneeR:[.65,0,0],height:.1}],[1.2,{}]],
    agr:[[0,{}],[.24,{spine:[.18,0,0],neck:[.2,0,0],shoulderL:[-.8,0,.4],shoulderR:[-.8,0,-.4],elbowL:[-1.7,0,0],elbowR:[-1.7,0,0],height:-.18}],
      [.49,{spine:[-.1,0,.05],neck:[-.22,.18,0],shoulderL:[-.9,0,-.5],shoulderR:[-1.05,0,.5],elbowL:[-1.7,0,0],elbowR:[-1.7,0,0],height:.05}],[.8,{}]]
  };
  POSES.ag3=[[0,{}],[.2,{shoulderL:[-.7,0,.18],shoulderR:[-.7,0,-.18],elbowL:[-1.6,0,0],elbowR:[-1.6,0,0],height:-.15}]];
  KIT.ag3.events.forEach((t,i)=>{const side=i%2?'L':'R',other=i%2?'R':'L',p={spine:[.13,(i%2?1:-1)*.36,0],hips:[0,(i%2?-1:1)*.16,0],height:-.12,kneeL:[.25,0,0],kneeR:[.2,0,0]};
    p['shoulder'+side]=[-1.62,0,0];p['elbow'+side]=[-.05,0,0];p['shoulder'+other]=[-.6,0,0];p['elbow'+other]=[-1.7,0,0];POSES.ag3.push([t,p]);});
  POSES.ag3.push([2.05,{}]);
  function accessories(r,t,weight=1,mouth=0) {
    if(!r.agTails)return;
    r.agTails.forEach((p,i)=>{p.rotation.x=Math.sin(t*7+i)*.12*weight;p.rotation.z=(i?1:-1)*(.07+Math.sin(t*5)*.06*weight);});
    r.agScarf.rotation.x=Math.sin(t*8)*.22*weight;r.agMouth.scale.y=1+mouth*5;
    r.agSkirt?.forEach((p,i)=>{p.rotation.x=Math.sin(t*6+i*.7)*.035*weight;});
  }
  const oldPose=poseAction;
  poseAction=function(r,a) {
    if(!a||!POSES[a.type])return oldPose(r,a);
    resetPose(r);r.body.rotation.set(0,0,0);
    const seq=POSES[a.type];let i=1;while(i<seq.length-1&&a.t>seq[i][0])i++;
    const [t0,p0]=seq[i-1],[t1,p1]=seq[i],w=ease((a.t-t0)/(t1-t0));
    JOINTS.forEach(j=>{const x=p0[j]||[0,0,0],y=p1[j]||[0,0,0];r[j].rotation.set(...x.map((v,k)=>v+(y[k]-v)*w));});
    r.hips.position.y=r.hipsBaseY+(p0.height||0)*(1-w)+(p1.height||0)*w;
    accessories(r,a.t,2,(p0.mouth||0)*(1-w)+(p1.mouth||0)*w);
  };
  const oldLocomotion=applyLocomotion;
  applyLocomotion=function(r,t,gait,move,run,grounded,vy) {
    oldLocomotion(r,t,gait,move,run,grounded,vy);if(r.__char!==ID)return;
    accessories(r,t,1+move);
    if(grounded&&move<.05){r.neck.rotation.y=.12;r.shoulderL.rotation.set(-.85,0,-.45);r.shoulderR.rotation.set(-.95,0,.45);r.elbowL.rotation.x=r.elbowR.rotation.x=-1.65;r.hipL.rotation.z=-.08;}
  };
  Object.keys(KIT).forEach(key=>{S.remote[key]=function(pos,yaw,f){
    let t=0,index=0;const d=dir(yaw),origin=pos.clone(),power=1+clamp(f?.tsundere||0,0,100)*.0075;
    addFx({update(dt){t+=dt;while(index<KIT[key].events.length&&t>=KIT[key].events[index])visual(key,index++,origin,d,false,power);return t<KIT[key].dur;}});
  };});

  const meter=document.createElement('div');meter.id='jjTsundere';meter.style.cssText='display:none;position:fixed;bottom:132px;left:50%;transform:translateX(-50%);width:min(340px,80vw);padding:8px 12px;background:#171717e8;color:#fff;border:1px solid #eee;font:700 12px system-ui;z-index:35;pointer-events:none';
  meter.innerHTML='<div data-label></div><progress aria-label="Tsundere" max="100" value="0" style="width:100%;accent-color:white"></progress><div data-stamina></div>';
  document.body.appendChild(meter);
  const oldHUD=updateHUD;
  updateHUD=function(dt){oldHUD(dt);meter.style.display=started&&player.char===ID?'block':'none';
    if(player.char===ID){meter.querySelector('[data-label]').textContent='TSUNDERE '+Math.round(S.charge)+'% · R to charge';meter.querySelector('progress').value=S.charge;
      meter.querySelector('[data-stamina]').textContent='STAMINA '+Math.ceil(S.stamina)+' / '+Math.round(S.maxStamina)+' · SKILLS ×'+S.power.toFixed(2);}};
  const oldUpdate=updatePlayer;
  updatePlayer=function(dt){
    if(player.rig!==seenRig||player.dead){S.charge=0;S.stamina=100;seenRig=player.rig;for(const p of S.props)if(p.local)dispose(p);}
    if(player.char===ID&&!player.dead&&gameInputActive()){
      if(!player.action)S.charge=Math.max(0,S.charge-dt*1.5);
      S.stamina=Math.min(S.maxStamina,S.stamina+dt*(10+S.charge*.12));
      if(player.action&&KIT[player.action.type]&&(player.react||player.stunT>0))player.action=null;
    }
    oldUpdate(dt);updateHint();
  };
  const oldSwitch=switchChar;
  switchChar=function(id,quiet){const before=player.char,result=oldSwitch(id,quiet);
    if(before!==player.char){S.charge=0;S.stamina=100;seenRig=player.rig;for(const p of S.props)if(p.local)dispose(p);}return result;};
  window.addEventListener('keydown',e=>{
    if(player.char!==ID||e.repeat||e.ctrlKey||e.metaKey||e.altKey||typingInUI(e))return;
    const key={Digit1:'ag1',Digit2:'ag2',Digit3:'ag3',Digit4:'ag4',KeyR:'agr'}[e.code];
    if(key){cast(key);e.preventDefault();e.stopImmediatePropagation();}
  },true);

  // The actual imported model supplies the front plane (Roblox local -Z).
  function unlockZone() {
    const data=window.JJJJS?.data,model=data?.meshes.find(m=>m.path==='Workspace.Map.Core.Reimu');
    if(!model)return null;
    const c=model.cf,front=V(-c[5],0,-c[11]).normalize();
    const center=V(c[0]-data.origin[0],c[1]-data.origin[1],c[2]-data.origin[2]);
    const point=center.clone().addScaledVector(front,model.size[2]/2+5);point.y=center.y-model.size[1]/2+1;
    return {center,front,point,halfWidth:model.size[0]/2,frontEdge:model.size[2]/2};
  }
  function atReimu() {
    if(!gameInputActive()||player.dead||player.action||player.react||player.frameT>0||window.JJMAP?.id!=='jjs'||!window.JJJJS?.root)return false;
    const z=unlockZone();if(!z)return false;
    const delta=player.pos.clone().sub(z.center),along=delta.dot(z.front),side=Math.abs(delta.x*z.front.z-delta.z*z.front.x);
    return along>=z.frontEdge+1&&along<=z.frontEdge+12&&side<=z.halfWidth*.7&&Math.abs(player.pos.y-z.point.y)<7&&dir(player.facing).dot(z.front)<-.55;
  }
  function submitWord(word) {
    if(unlocked||String(word).trim().toLowerCase()!=='baka'||!atReimu())return false;
    unlocked=true;try{localStorage.setItem(KEY,'1');}catch(_){}
    closeWord();buildCharList();
    showSplash('SECRET CHARACTER UNLOCKED','Stupid Anime Girl · Open Characters to select','#ffffff');
    window.JJNOTICE?.('Stupid Anime Girl unlocked! Open Characters.','#ffffff');sfx.tpDone();return true;
  }
  const hint=document.createElement('button');hint.id='jjReimuHint';hint.type='button';hint.textContent='东方project博丽灵梦 · Enter to speak';
  hint.style.cssText='display:none;position:fixed;left:50%;top:68%;transform:translateX(-50%);z-index:40;padding:10px;background:#202020ec;color:#fff;border:1px solid white';document.body.appendChild(hint);
  const form=document.createElement('form');form.id='jjReimuWord';form.style.cssText='display:none;position:fixed;left:50%;top:68%;transform:translateX(-50%);z-index:70;padding:12px;background:#202020;color:white;border:1px solid white';
  form.innerHTML='<label>Say something to 博丽灵梦 <input aria-label="Say something to Reimu" maxlength="32" autocomplete="off" spellcheck="false"></label> <button type="submit">Say</button> <button type="button" data-close>Cancel</button><div role="status"></div>';
  document.body.appendChild(form);const input=form.querySelector('input');
  function openWord(){if(unlocked||!atReimu())return;clearMovement();window.JJFIGHT?.clearInput();setShiftLock(false);form.style.display='block';hint.style.display='none';input.value='';input.focus();}
  function closeWord(){form.style.display='none';input.blur();}
  hint.onclick=openWord;form.querySelector('[data-close]').onclick=closeWord;
  form.onsubmit=e=>{e.preventDefault();if(!submitWord(input.value))form.querySelector('[role=status]').textContent='No response.';};
  form.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();closeWord();}});
  let wordBuffer='',lastWordAt=0;
  function updateHint(){const near=!unlocked&&atReimu();hint.style.display=near&&form.style.display==='none'?'block':'none';if(!near&&form.style.display!=='none')closeWord();}
  window.addEventListener('keydown',e=>{
    if(typingInUI(e)||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
    if(unlocked||!atReimu()){wordBuffer='';return;}
    if(e.code==='Enter'){openWord();e.preventDefault();e.stopImmediatePropagation();return;}
    const now=performance.now();if(now-lastWordAt>1800)wordBuffer='';lastWordAt=now;
    if(/^[a-z]$/i.test(e.key)){wordBuffer=(wordBuffer+e.key.toLowerCase()).slice(-4);
      // Consume the ritual's letters so B/A do not guard or walk away.
      if('baka'.includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();}
      if(wordBuffer==='baka')submitWord(wordBuffer);
    }
  },true);
})();
