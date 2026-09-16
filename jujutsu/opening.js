/* SIGNAL / CITY / SORCERERS — an original 64-second opening.
   All art is drawn here; the score is synthesized. No video, song or external
   assets are loaded. The game clock pauses behind this separate canvas. */
(function () {
  'use strict';
  const LENGTH=64,W=1280,H=720,INK='#10131e',PAPER='#eaf24a',WHITE='#f6f7e9',BLUE='#77dcff',ORANGE='#f57e4b';
  const CUTS=[0,7,15,23,31,39,47,56,64];
  const NAMES=['SIGNAL','CITY IN MOTION','LIMITLESS','BREAK THE LINE','FRAME BY FRAME','DOMAIN COLLISION','WHITE WIND','JUJUTSU BATTLEGROUND'];
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n)),ease=n=>1-Math.pow(1-clamp(n),3);
  const mix=(a,b,k)=>a+(b-a)*k,seed=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  const panel=document.createElement('section');panel.id='jjOpening';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Jujutsu Battleground opening');panel.setAttribute('aria-modal','true');
  panel.style.cssText='position:fixed;inset:0;z-index:21000;background:#10131e;color:#f6f7e9;display:none;overflow:hidden;isolation:isolate';
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;canvas.setAttribute('aria-label','Animated city and sorcerer opening');canvas.style.cssText='position:absolute;width:100%;height:100%;object-fit:contain';panel.appendChild(canvas);
  const controls=document.createElement('div');controls.style.cssText='position:absolute;right:clamp(12px,3vw,40px);bottom:clamp(14px,3vh,32px);display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end';panel.appendChild(controls);
  const style=document.createElement('style');style.textContent='#jjOpening button{border:1px solid #f6f7e96b;background:#10131eed;color:#f6f7e9;padding:11px 16px;font:700 12px system-ui;letter-spacing:1px;cursor:pointer}#jjOpening button:hover,#jjOpening button:focus-visible{background:#eaf24a;color:#10131e;outline:2px solid #f6f7e9;outline-offset:3px}#jjOpening [data-skip]{border-color:#eaf24a;color:#eaf24a}';document.head.appendChild(style);
  function button(label){const b=document.createElement('button');b.type='button';b.textContent=label;controls.appendChild(b);return b;}
  const soundButton=button('SOUND: OFF'),skipButton=button('SKIP OPENING · G');skipButton.setAttribute('data-skip','');
  const progress=document.createElement('div');progress.style.cssText='position:absolute;left:0;bottom:0;height:3px;background:#eaf24a;width:0;pointer-events:none';panel.appendChild(progress);
  const status=document.createElement('span');status.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)';status.setAttribute('aria-live','polite');panel.appendChild(status);document.body.appendChild(panel);
  let ctx=canvas.getContext('2d',{alpha:false}),active=false,time=0,last=0,frameId=0,lastPaint=-1,chapter=-1,swallowG=false;
  let previousFocus=null,inertMenu=false,previousMenuInert=false,sound=false,audioCtx=null,bus=null,lastBeat=-1,audioGeneration=0;
  const voices=new Set(),reduced=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const O=window.JJOPENING={get active(){return active;},play,skip:()=>finish('skip'),input,renderAt,
    audit:()=>({active,time,duration:LENGTH,chapter,sound,reduced,voices:voices.size})};
  const priorInput=gameInputActive;gameInputActive=function(){return !active&&priorInput();};

  function polygon(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
  function line(points,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
  function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
  function disc(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,Math.PI*2);ctx.fill();}
  function ring(x,y,r,color,width=2,squash=1,angle=0){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(1,squash);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(0,0,Math.max(1,r),0,Math.PI*2);ctx.stroke();ctx.restore();}
  function words(text,x,y,size,color,align='left',max=1100){ctx.fillStyle=color;ctx.font='900 '+size+'px Arial, sans-serif';ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(text,x,y,max);}
  function label(text,x,y,color=INK){ctx.fillStyle=color;ctx.font='700 15px monospace';ctx.textAlign='left';ctx.fillText(text,x,y);}
  function stripe(t,color,background){rect(0,0,W,H,background);for(let i=0;i<9;i++){const x=(i*206-t*36)%1800-240;polygon([[x,0],[x+55,0],[x-185,H],[x-240,H]],color);}}
  function skyline(t,base=610,color=INK,scale=1){
    for(let i=-2;i<23;i++){
      const x=i*78*scale-(t*26*scale%(78*scale)),h=(60+seed(i+90)*215)*scale,w=(36+seed(i+14)*37)*scale;
      rect(x,base-h,w,h+130,color);rect(x+w*.25,base-h-12*scale,w*.45,12*scale,color);
      if(i%3===0)line([[x+w*.5,base-h],[x+w*.5,base-h-35*scale]],color,2*scale);
    }
  }
  function windows(t,base=610,color=PAPER){for(let i=0;i<18;i++)for(let j=0;j<5;j++){if(seed(i*9+j)>.5)rect(i*78-(t*26%78)+10,base-35-j*22,8,3,color);}}
  function tunnels(t,color,centerX=750,centerY=360){
    for(let i=0;i<19;i++){const angle=i/19*Math.PI*2;line([[centerX+Math.cos(angle)*80,centerY+Math.sin(angle)*60],[centerX+Math.cos(angle)*1400,centerY+Math.sin(angle)*900]],color,i%3===0?4:1);}
    for(let i=0;i<7;i++){const r=((i/7+t*.16)%1)**2;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.strokeRect(centerX-r*950,centerY-r*600,r*1900,r*1200);}
  }
  function speedlines(t,color,count=22){for(let i=0;i<count;i++){const x=(seed(i+5)*1800-t*(100+seed(i)*260))%1800;const xx=(x+1800)%1800-260;rect(xx,seed(i+200)*630+35,60+seed(i+20)*170,1+seed(i)*3,color);}}

  // An articulated poster figure: hips, knees, shoulders and elbows carry
  // the walk, sprint, casting and upperkick poses; clothing follows the joints.
  function fighter(kind,x,y,size,t,mode='run',facing=1,color=INK,accent=WHITE){
    ctx.save();ctx.translate(x,y);ctx.scale(size*facing,size);
    const moving=mode==='walk'||mode==='run',s=moving?Math.sin(t*(mode==='run'?10:5)):Math.sin(t*2)*.12;
    const bob=moving?Math.abs(Math.cos(t*(mode==='run'?10:5)))*5:Math.sin(t*2)*2;
    ctx.translate(0,-bob);const lean=mode==='run'?.21:mode==='cast'?-.06:0;ctx.rotate(lean);
    function limb(x,y,len,a,w,c){const end=[x+Math.sin(a)*len,y+Math.cos(a)*len];line([[x,y],end],c,w);return end;}
    const kick=mode==='kick'?Math.sin(clamp((t%2.4)/1.7)*Math.PI):0;
    for(const side of [-1,1]){
      let a=s*side*(mode==='run'?.88:.38),bend=Math.max(0,-s*side)*1.3+.16;
      if(side===1&&mode==='kick'){a=-kick*2.4;bend=.2;}
      const knee=limb(side*10,-100,48,a,20,color),foot=limb(...knee,45,a+bend,16,color);
      polygon([[foot[0]-9,foot[1]-5],[foot[0]+9,foot[1]-5],[foot[0]+19,foot[1]+7],[foot[0]-10,foot[1]+7]],color);
    }
    polygon([[-25,-173],[19,-177],[28,-115],[19,-91],[-21,-91],[-31,-121]],color);
    polygon([[-24,-169],[-13,-162],[-11,-113],[-27,-111]],accent);
    if(kind==='animegirl'){
      polygon([[-21,-109],[22,-109],[38,-56],[-38,-56]],color);line([[-37,-57],[37,-57]],WHITE,4);
      for(let i=-2;i<=2;i++)line([[i*7,-101],[i*12,-62]],'#555862',1.4);
    }
    for(const side of [-1,1]){
      const cast=mode==='cast'&&side===1,angle=cast?-2.12:-s*side*.95+.13*side;
      const elbow=limb(side*22,-164,39,angle,17,color),hand=limb(...elbow,35,cast?-2.8:angle-(moving?1.05:.25),13,color);
      disc(...hand,8,color);if(cast){line([[hand[0]-3,hand[1]],[hand[0]-6,hand[1]-23]],accent,4);line([[hand[0]+3,hand[1]],[hand[0]+2,hand[1]-21]],accent,4);}
    }
    rect(-7,-198,15,25,color);
    polygon([[-21,-231],[5,-237],[22,-222],[21,-211],[29,-204],[20,-200],[17,-187],[-6,-187],[-20,-204]],color);
    const hair=kind==='gojo'?WHITE:kind==='naoya'?'#d8ba76':kind==='yuji'||kind==='sukuna'?ORANGE:color;
    polygon([[-24,-210],[-30,-230],[-19,-227],[-22,-247],[-9,-237],[-1,-253],[8,-239],[22,-244],[20,-230],[29,-232],[22,-218],[1,-221],[-10,-210]],hair);
    if(kind==='gojo')line([[-9,-211],[20,-210]],accent===WHITE?PAPER:accent,5);else line([[10,-210],[19,-208]],accent,2);
    if(kind==='sukuna'){line([[10,-201],[18,-198]],accent,2);line([[-4,-213],[-1,-203]],accent,2);}
    polygon([[-26,-180],[18,-188],[26,-170],[-24,-166]],color);
    if(kind==='animegirl'){
      const tail=Math.sin(t*6)*7;polygon([[-21,-224],[-38,-210],[-33+tail,-154],[-16,-179]],color);
      polygon([[14,-226],[36,-218],[39-tail,-167],[21,-183]],color);
      line([[-21,-179],[21,-179]],WHITE,8);polygon([[-14,-176],[-40,-164],[-88+tail,-171],[-46,-152],[-12,-164]],WHITE);
    }
    ctx.restore();
  }
  function gojoPortrait(t){
    ctx.save();ctx.translate(888+Math.sin(t*.5)*9,405);ctx.rotate(-.08);
    polygon([[-188,315],[-127,59],[-63,20],[67,25],[155,100],[210,315]],INK);
    polygon([[-84,-168],[56,-194],[112,-139],[95,-5],[43,70],[-34,42],[-90,-43]],WHITE);
    polygon([[-84,-107],[-114,-168],[-106,-232],[-74,-216],[-53,-273],[-19,-242],[14,-286],[42,-243],[91,-270],[92,-228],[133,-216],[99,-165],[117,-152],[42,-156],[-14,-127]],WHITE);
    polygon([[-100,-109],[95,-116],[102,-65],[-86,-45]],INK);
    line([[14,-75],[55,-84],[66,-79]],BLUE,7);line([[31,-20],[55,-14]],INK,4);
    polygon([[-107,20],[-11,58],[85,9],[110,119],[-133,130]],INK);
    line([[-119,74],[-87,186]],BLUE,5);
    ctx.restore();
  }
  function wind(t,cx,cy,r){
    for(let i=0;i<7;i++){ctx.save();ctx.translate(cx,cy);ctx.rotate(t*.55+i*.35);ctx.scale(1,.35+i*.055);ctx.strokeStyle=WHITE;ctx.lineWidth=i%2?3:6;ctx.beginPath();ctx.arc(0,0,r+i*24,.15+i*.1,Math.PI*1.4+i*.1);ctx.stroke();ctx.restore();}
    for(let i=0;i<20;i++){const a=i*2.4+t*.5;line([[cx+Math.cos(a)*r,cy+Math.sin(a)*r*.5],[cx+Math.cos(a)*(r+30),cy+Math.sin(a)*(r+30)*.5]],WHITE,2);}
  }

  function drawScene(n,u,t){
    const motion=reduced?u*.12:t;
    if(n===0){
      rect(0,0,W,H,INK);const k=ease(u/3);
      disc(810,325,245*k,PAPER);ring(810,325,265,BLUE,1,.92,-.2);
      skyline(motion,635,'#242936',1.35);skyline(motion*1.6,680,INK,.72);
      line([[0,482],[195*k,482],[260*k,412],[383*k,412],[457*k,494],[650*k,494]],PAPER,3);
      fighter('gojo',mix(310,595,ease(u/7)),635,1.05,motion,'walk',1,INK,BLUE);
      label('TRANSMISSION / 001',64,126,BLUE);words('THE CITY',64,239,100,WHITE);words('IS AWAKE.',64,331,100,WHITE);
      label('A NEW ROUND BEGINS',65,376,PAPER);
    }else if(n===1){
      rect(0,0,W,H,PAPER);tunnels(motion,'#bfca36',775,310);
      for(let i=0;i<10;i++){const k=(i/10+motion*.045)%1,h=75+k*k*660;const side=i%2?-1:1;
        polygon([[775+side*h*.4,310-h*.08],[775+side*h*.9,310-h*.7],[775+side*h*1.9,310+h],[775+side*h*.62,310+h]],i%3?INK:'#626c35');}
      polygon([[0,560],[1280,465],[1280,720],[0,720]],INK);speedlines(motion,WHITE,12);
      fighter('yuji',780,644,1.72,motion,'run',1,WHITE,INK);
      polygon([[44,71],[674,71],[619,321],[44,350]],INK);
      ctx.save();ctx.translate(73,173);ctx.rotate(-.07);words('ONE CITY.',0,0,96,PAPER,'left',560);words('NO LIMITS.',0,95,90,WHITE,'left',565);ctx.restore();
    }else if(n===2){
      rect(0,0,W,H,BLUE);for(let i=0;i<11;i++)ring(852,354,90+i*40+Math.sin(motion*.7)*12,i%3?INK:WHITE,1.4,.88,motion*.08);
      polygon([[0,0],[575,0],[368,720],[0,720]],INK);gojoPortrait(motion);
      words('GOJO',60,241,138,WHITE, 'left',620);label('THE SPACE BETWEEN',67,294,BLUE);
      for(let i=0;i<3;i++)words('LIMITLESS',62-i*9,395+i*73,68,i===1?BLUE:'#333b4c','left',660);
      fighter('gojo',1080,682,1.4,motion,'cast',-1,INK,BLUE);
    }else if(n===3){
      stripe(motion,'#d8623f',ORANGE);polygon([[0,0],[640,0],[474,720],[0,720]],INK);
      words('BREAK',64,240,121,PAPER);words('THE LINE',62,345,103,WHITE,'left',735);
      for(let i=0;i<16;i++){const k=(seed(i)+motion*.18)%1;const x=660+k*650,y=seed(i+80)*640;
        ctx.save();ctx.translate(x,y);ctx.rotate(k*2+i);rect(-15,-10,20+seed(i)*40,12,INK);ctx.restore();}
      fighter('yuji',880,635,2.1,motion,u<3?'run':'kick',1,INK,WHITE);
      label('YUJI / KEEP MOVING FORWARD',66,473,ORANGE);line([[66,493],[360,493]],ORANGE,4);
    }else if(n===4){
      rect(0,0,W,H,INK);speedlines(motion*2,PAPER,32);
      for(let i=5;i>=0;i--){ctx.globalAlpha=.1+(5-i)*.15;fighter('naoya',770-i*83+Math.sin(motion*.5)*80,635-i*5,1.85,motion-i*.12,'run',1,i===0?WHITE:PAPER,INK);}ctx.globalAlpha=1;
      rect(53,108,388,34,PAPER);label('PROJECTION / 24 FRAMES',65,131,INK);
      words('NAOYA',53,267,108,WHITE);words('FRAME',53,346,67,PAPER);words('BY FRAME',53,414,67,PAPER);
      for(let i=0;i<24;i++)rect(64+i*20,480,13,i===Math.floor(motion*12)%24?42:12,PAPER);
    }else if(n===5){
      rect(0,0,W,H,INK);polygon([[0,0],[694,0],[558,720],[0,720]],BLUE);polygon([[694,0],[1280,0],[1280,720],[558,720]],ORANGE);
      for(let i=0;i<8;i++)ring(310,378,110+i*31+Math.sin(motion)*8,INK,2,.88,motion*.04);
      for(let i=0;i<4;i++){const y=280+i*55;polygon([[832-i*22,y],[1104+i*22,y],[1137+i*22,y+22],[806-i*22,y+22],[930,y-32]],INK);rect(871,y+20,16,55,INK);rect(1050,y+20,16,55,INK);}
      const seam=640+Math.sin(motion*2)*15;line([[seam+30,0],[seam-55,205],[seam+17,390],[seam-45,535],[seam-78,720]],WHITE,9);
      fighter('gojo',306,660,1.45,motion,'cast',1,INK,WHITE);fighter('sukuna',999,661,1.45,motion,'cast',-1,INK,WHITE);
      words('WHEN DOMAINS COLLIDE',640,115,64,INK,'center',1120);label('UNLIMITED VOID',65,187,INK);label('MALEVOLENT SHRINE',913,187,INK);
      ring(640,367,75+Math.sin(motion*1.8)*12,WHITE,4,.7,motion*.3);
    }else if(n===6){
      rect(0,0,W,H,INK);skyline(motion*.4,605,'#252d38',.8);wind(motion,846,361,230+Math.sin(motion*.9)*20);
      fighter('animegirl',868,653,1.9,motion,u<4?'cast':'kick',-1,WHITE,INK);
      // This is a teaser until the actual Reimu ritual has been completed.
      const known=!!window.JJANIMEGIRL?.unlocked;
      words(known?'WHITE WIND':'A SECRET',61,221,94,WHITE,'left',670);words(known?'STUPID ANIME GIRL':'IN THE WIND',63,300,known?44:70,WHITE,'left',630);
      label(known?'TSUNDERE / UNBOUND':'SOME FIGHTERS MUST BE FOUND.',67,364,WHITE);
      for(let i=0;i<6;i++){const y=426+i*19;line([[66,y],[400+i*26+Math.sin(motion+i)*18,y-28]],WHITE,1.5);}
    }else{
      rect(0,0,W,H,PAPER);skyline(motion*.5,693,INK,.62);
      disc(1044,194,113,INK);ring(1044,194,137,INK,2);
      const k=ease(u/2);ctx.save();ctx.translate(70,mix(340,231,k));ctx.transform(1,-.055,-.12,1,0,0);
      words('JUJUTSU',0,0,151,INK,'left',1100);words('BATTLEGROUND',0,111,102,INK,'left',1120);ctx.restore();
      label('YOUR FIGHT STARTS HERE.',74,423,INK);
      ['gojo','yuji','naoya'].forEach((c,i)=>fighter(c,489+i*160,687,.93,motion+i,'walk',1,INK,WHITE));
      line([[75,466],[75+1015*clamp(u/5),466]],INK,3);
      if(u>6){ctx.globalAlpha=clamp((u-6)/2);rect(0,0,W,H,INK);ctx.globalAlpha=1;}
    }
  }
  function renderAt(seconds,target){
    if(!ctx&&!target)return;const old=ctx;if(target)ctx=target;
    try{
      const t=clamp(seconds,0,LENGTH-.001),n=Math.max(0,CUTS.findIndex((x,i)=>t>=x&&t<CUTS[i+1])),u=t-CUTS[n];
      ctx.save();const c=ctx.canvas;ctx.setTransform(c.width/W,0,0,c.height/H,0,0);ctx.globalAlpha=1;
      drawScene(n,u,t);
      // One diagonal wipe at each chapter boundary, never a strobe.
      if(n>0&&u<.48&&!reduced){const k=ease(u/.48),x=mix(-190,W+240,k);polygon([[x-160,0],[x+30,0],[x-110,H],[x-300,H]],WHITE);}
      ctx.globalAlpha=.09;for(let i=0;i<110;i++)rect(seed(i+300)*W,seed(i+600)*H,seed(i)*25+1,1,WHITE);ctx.globalAlpha=1;
      rect(0,0,W,38,INK);rect(0,689,W,31,INK);label('JUJUTSU / OPENING SEQUENCE',32,25,WHITE);label(String(n+1).padStart(2,'0')+' / '+NAMES[n],32,710,WHITE);
      ctx.restore();return n;
    }finally{ctx=old;}
  }
  function note(freq,dur,type,gain,slide=0){
    if(!audioCtx||!bus||voices.size>22||document.hidden)return;
    const oscillator=audioCtx.createOscillator(),envelope=audioCtx.createGain(),at=audioCtx.currentTime;
    oscillator.type=type;oscillator.frequency.setValueAtTime(freq,at);if(slide)oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,freq+slide),at+dur);
    envelope.gain.setValueAtTime(.0001,at);envelope.gain.exponentialRampToValueAtTime(gain,at+.008);envelope.gain.exponentialRampToValueAtTime(.0001,at+dur);
    oscillator.connect(envelope);envelope.connect(bus);voices.add(oscillator);oscillator.onended=()=>{voices.delete(oscillator);oscillator.disconnect();envelope.disconnect();};oscillator.start(at);oscillator.stop(at+dur+.015);
  }
  function score(){
    if(!sound||!audioCtx||audioCtx.state!=='running')return;const step=Math.floor(time/.25);if(step===lastBeat)return;lastBeat=step;
    const melody=[0,7,12,10,3,7,15,12,0,5,10,7,3,2,7,5],base=[82.4069,65.4064,73.4162,61.7354][Math.floor(step/16)%4];
    if(step%2===0)note(base,.21,'triangle',.17);
    note(base*4*Math.pow(2,melody[step%16]/12),.12,'triangle',.035);
    if(step%4===0)note(128,.14,'sine',.32,-94);
    if(step%4===2){note(178,.08,'triangle',.07,-65);note(1500,.035,'sine',.012,-600);}
    if(step%2===1)note(4100,.025,'sine',.012,-500);
    bus.gain.setTargetAtTime(.22*Math.min(1,(LENGTH-time)/2),audioCtx.currentTime,.05);
  }
  async function toggleSound(){
    if(!active)return;
    if(sound){sound=false;stopSound();soundButton.textContent='SOUND: OFF';soundButton.setAttribute('aria-pressed','false');return;}
    const generation=++audioGeneration;
    try{
      const Constructor=window.AudioContext||window.webkitAudioContext;if(!Constructor){soundButton.textContent='SOUND UNAVAILABLE';return;}
      if(!audioCtx||audioCtx.state==='closed'){audioCtx=new Constructor();bus=audioCtx.createGain();bus.gain.value=.22;bus.connect(audioCtx.destination);}
      const ac=audioCtx;await ac.resume();if(generation!==audioGeneration||!active){if(ac===audioCtx)stopSound();return;}
      sound=true;lastBeat=-1;soundButton.textContent='SOUND: ON';soundButton.setAttribute('aria-pressed','true');
    }catch(_){if(generation===audioGeneration){sound=false;soundButton.textContent='SOUND UNAVAILABLE';}}
  }
  function stopSound(){
    audioGeneration++;
    sound=false;for(const v of voices){try{v.stop();}catch(_){}}voices.clear();
    if(bus&&audioCtx)bus.gain.setValueAtTime(0,audioCtx.currentTime);
    if(audioCtx){audioCtx.close().catch(()=>{});audioCtx=null;bus=null;}
  }
  function input(e){
    if(!active){if(swallowG&&e.code==='KeyG'){e.preventDefault();e.stopImmediatePropagation();return true;}return false;}
    if(e.ctrlKey||e.metaKey||e.altKey||/^F\d+$/.test(e.code))return false;
    if(e.code==='Tab')return false;
    // Keep keyboard activation of the accessible controls working.
    if((e.code==='Enter'||e.code==='Space')&&(e.target===skipButton||e.target===soundButton))return false;
    if(e.code==='KeyG'&&!e.repeat){swallowG=true;finish('skip');}
    e.preventDefault();e.stopImmediatePropagation();return true;
  }
  function frame(now){
    if(!active)return;const dt=Math.max(0,(now-last)/1000);last=now;
    try{
      if(!document.hidden){time=Math.min(LENGTH,time+Math.min(dt,1));if(time>=LENGTH){finish('complete');return;}
        if(now-lastPaint>=(reduced?100:1000/30)){const n=renderAt(time);lastPaint=now;if(chapter!==n){chapter=n;status.textContent=NAMES[n]+'. Press G to skip.';}progress.style.width=(time/LENGTH*100)+'%';}score();}
      frameId=requestAnimationFrame(frame);
    }catch(_){finish('render-error');}
  }
  function finish(reason){
    if(!active)return;active=false;cancelAnimationFrame(frameId);frameId=0;stopSound();panel.style.display='none';
    if(inertMenu){menu.inert=previousMenuInert;inertMenu=false;}
    clearMovement();if(typeof refreshMouseUI==='function')refreshMouseUI();
    const focus=previousFocus?.isConnected&&previousFocus!==document.body?previousFocus:menuFight;if(focus?.focus)focus.focus({preventScroll:true});
    status.textContent=reason==='complete'?'Opening complete.':'Opening skipped.';
  }
  function play(){
    if(active||started||window.MPJJ?.active||!ctx)return false;
    active=true;time=0;chapter=-1;last=performance.now();lastPaint=-1;lastBeat=-1;previousFocus=document.activeElement;
    if(typeof menu!=='undefined'&&menu){previousMenuInert=!!menu.inert;menu.inert=true;inertMenu=true;}
    clearMovement();panel.style.display='block';progress.style.width='0%';soundButton.textContent='SOUND: OFF';soundButton.setAttribute('aria-pressed','false');
    try{renderAt(0);skipButton.focus({preventScroll:true});frameId=requestAnimationFrame(frame);return true;}catch(_){finish('render-error');return false;}
  }
  skipButton.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();finish('skip');});
  soundButton.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();toggleSound();});
  panel.addEventListener('keydown',e=>{
    if(e.code==='Tab'){e.preventDefault();(document.activeElement===skipButton?soundButton:skipButton).focus();}
    e.stopPropagation();
  });
  for(const name of ['pointerdown','mousedown','mouseup','click','wheel'])panel.addEventListener(name,e=>e.stopPropagation());
  window.addEventListener('keyup',e=>{if(e.code==='KeyG'){swallowG=false;if(active){e.preventDefault();e.stopImmediatePropagation();}}},true);
  window.addEventListener('blur',()=>{swallowG=false;});
  document.addEventListener('visibilitychange',()=>{last=performance.now();if(audioCtx){if(document.hidden)audioCtx.suspend().catch(()=>{});else if(sound)audioCtx.resume().catch(()=>{});}});
  window.addEventListener('pagehide',()=>finish('closed'));
  const replay=document.createElement('button');replay.type='button';replay.setAttribute('data-opening-replay','');style.textContent+='#menu.is-pause [data-opening-replay]{display:none}';replay.textContent='WATCH OPENING';replay.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();play();});
  const actions=document.querySelector('#menu .menu-actions');if(actions)actions.appendChild(replay);
  play();
})();
