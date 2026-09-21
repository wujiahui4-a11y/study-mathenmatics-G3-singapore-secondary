/* Illustrated opening director. Generated cels change at 8–12 fps while the
   camera, foreground, light and particles move continuously at render rate. */
(function(){
  'use strict';
  const W=1280,H=720,INK='#090f1c',WHITE='#f4f6ee',BLUE='#8edfff',GOLD='#efe764';
  const cuts=[0,6,12,18,24,30,38,44,48],names=['SIGNAL','CITY IN MOTION','LIMITLESS','BREAK THE LINE','FRAME BY FRAME','DOMAIN COLLISION','WHITE WIND','JUJUTSU BATTLEGROUND'];
  const shots=[0,2.5,6,8.5,10.5,12,14.5,16.2,18,20,22.5,24,26,28,30,32,34,36,38,40,42,44,46,48];
  const manifest=window.JJOPENINGART||{},images={},seen=new Set(),used=new Map();let settled=0,failed=0,lastShot=0;
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),ease=k=>1-(1-clamp(k))**3,lerp=(a,b,k)=>a+(b-a)*k;
  const hash=n=>{const v=Math.sin(n*91.17+18.37)*44857.72;return v-Math.floor(v);};
  const ready=Promise.allSettled(Object.entries(manifest).map(([id,m])=>new Promise(resolve=>{
    if(typeof Image==='undefined'){failed++;settled++;resolve();return;}
    const img=new Image();let done=false;
    const finish=ok=>{if(done)return;done=true;settled++;if(ok&&img.width&&img.height)images[id]=img;else failed++;resolve();};
    img.onload=()=>finish(true);img.onerror=()=>finish(false);img.src=m.src;if(img.complete&&img.width)finish(true);
  })));
  const F=window.JJOPENINGFILM={duration:48,cuts,names,shots,ready,render,
    status:()=>({total:Object.keys(manifest).length,loaded:Object.keys(images).length,pending:Object.keys(manifest).length-settled,failed}),
    audit:()=>({shot:lastShot,frames:Object.fromEntries(used),seen:[...seen]})};
  function path(c,p,color,width){c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(width){c.strokeStyle=color;c.lineWidth=width;c.stroke();}else{c.closePath();c.fillStyle=color;c.fill();}}
  function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
  function text(c,s,x,y,size=20,color=WHITE,align='left'){c.fillStyle=color;c.font='700 '+size+'px Arial,sans-serif';c.textAlign=align;c.fillText(s,x,y);}
  function ring(c,x,y,r,col,width=2,ys=.6,rot=0){c.save();c.translate(x,y);c.rotate(rot);c.scale(1,ys);c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.strokeStyle=col;c.lineWidth=width;c.stroke();c.restore();}
  function backdrop(c,id,scale=1,x=0,y=0){
    const image=images[id];rect(c,0,0,W,H,INK);if(!image)return;
    const s=Math.max(W/image.width,H/image.height)*scale;
    c.drawImage(image,(W-image.width*s)/2+x,(H-image.height*s)/2+y,image.width*s,image.height*s);
  }
  function camera(c,zoom,x=0,y=0,roll=0){c.translate(W/2+x,H/2+y);c.rotate(roll);c.scale(zoom,zoom);c.translate(-W/2,-H/2);}
  function cel(c,id,index,x,ground,h,flip=false,opacity=1){
    const im=images[id],m=manifest[id];if(!im||!m)return false;
    const count=m.cols*m.rows,i=clamp(Math.floor(index),0,count-1),sw=im.width/m.cols,sh=im.height/m.rows,dw=h*sw/sh;
    used.set(id,i);seen.add(id+':'+i);c.save();c.globalAlpha*=opacity;c.translate(x,ground);c.scale(flip?-1:1,1);
    c.drawImage(im,(i%m.cols)*sw,Math.floor(i/m.cols)*sh,sw,sh,-dw/2,-h,dw,h);c.restore();return true;
  }
  function actor(c,id,x,y,h,t,mode='run',flip=false,opacity=1,reduced=false){
    let frame;
    if(mode==='run')frame=Math.floor(t*(reduced?3:12))%8;
    else if(mode==='cast'){
      const phase=t%3.5;frame=phase<.9?Math.floor(phase/.9*6):phase<2.65?5:Math.min(7,6+Math.floor((phase-2.65)*2.4));
    }else if(mode==='kick')frame=[0,0,1,2,3,3,4,5,6,7,7,7][Math.floor(t*(reduced?3:8))%12];
    else frame=0;
    cel(c,id,frame,x,y,h,flip,opacity);
  }
  function particles(c,t,color=WHITE,speed=55,count=32){
    c.save();c.globalAlpha=.44;c.fillStyle=color;
    for(let i=0;i<count;i++){const x=((hash(i)*W-t*speed*(.3+hash(i+50)))%W+W)%W,y=(hash(i+10)*H+Math.sin(t*.8+i)*12);const n=.7+hash(i+60)*2.5;c.fillRect(x,y,n*2,n);}
    c.restore();
  }
  function rain(c,t){c.save();c.globalAlpha=.14;for(let i=0;i<50;i++){const x=hash(i+6)*W,y=(hash(i+30)*H+t*260)%H;path(c,[[x,y],[x-9,y+27]],BLUE,1);}c.restore();}
  function foreground(c,t,speed=220){
    for(let i=0;i<5;i++){const x=((i*360-t*speed)%1800+1800)%1800-260;rect(c,x,0,11,730,INK);path(c,[[x-85,30],[x+95,58]],INK,9);}
    path(c,[[0,675],[W,659]],'#0b1018',22);
  }
  function streaks(c,t,color=WHITE,alpha=.3){c.save();c.globalAlpha=alpha;for(let i=0;i<21;i++){const x=((hash(i)*W-t*(180+hash(i+1)*500))%1600+1600)%1600-250;path(c,[[x,hash(i+90)*H],[x+75+hash(i)*170,hash(i+90)*H-8]],color,1+hash(i)*2);}c.restore();}
  function wind(c,t,x,y,size){c.save();for(let i=0;i<9;i++){c.save();c.translate(x,y);c.rotate(t*.65+i*.33);c.scale(1,.3+i*.035);c.beginPath();c.arc(0,0,size+i*18,i*.13,4.3+i*.17);c.strokeStyle=WHITE;c.lineWidth=1.5+(i%3)*1.5;c.globalAlpha=.48+i*.045;c.stroke();c.restore();}c.restore();}
  function caption(c,u,title,sub,color=WHITE){
    // Short lower-third introductions; the image stays the primary content.
    const a=Math.min(ease(u/.35),clamp((2.8-u)/.4));if(a<=0)return;
    c.save();c.globalAlpha=a;const x=54+(1-a)*-22;rect(c,x-12,535,510,77,'#090f1ccf');rect(c,x-12,535,3,77,color);text(c,title,x+9,566,27,color);text(c,sub,x+10,591,12,WHITE);c.restore();
  }
  function shade(c){const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,'#080d1c70');g.addColorStop(.35,'#080d1c00');g.addColorStop(.68,'#080d1c00');g.addColorStop(1,'#080d1c95');c.fillStyle=g;c.fillRect(0,0,W,H);}
  function render(c,seconds,reduced=false){
    const t=clamp(seconds,0,47.999),n=Math.max(0,cuts.findIndex((v,i)=>t>=v&&t<cuts[i+1])),u=t-cuts[n];
    lastShot=Math.max(0,shots.findIndex((v,i)=>t>=v&&t<shots[i+1]));const shotTime=t-shots[lastShot],m=reduced?t*.15:t;
    c.save();c.globalAlpha=1;c.lineCap='round';c.lineJoin='round';
    if(n===0){
      const close=u>=2.5;backdrop(c,'city',close?1.38+u*.014:1.09+u*.023,close?90-u*24:-u*14,close?85:30-u*14);
      c.save();camera(c,close?1.04:1,0,0,close?-.012:0);
      actor(c,'yuji-run',close?330+u*62:290+u*75,close?726:620,close?465:116,m,'run',false,1,reduced);c.restore();
      if(close)foreground(c,m,110);particles(c,m,GOLD,18,34);
      if(u<2.5)caption(c,u,'THE CITY IS AWAKE','A NEW ROUND BEGINS',GOLD);
    }else if(n===1){
      const close=u>=4.5,front=u<2.5;
      backdrop(c,'alley',front?1.12+u*.035:1.48,front?-45-u*12:Math.sin(m*.3)*90,front?-20:65);
      c.save();camera(c,close?1.95:1,close?-250:0,close?325:0,front?-.018:.022);
      actor(c,'yuji-run',720+Math.sin(m*.8)*55,694,505,m,'run',false,1,reduced);c.restore();
      streaks(c,m,BLUE,.18);rain(c,m);if(!close)foreground(c,m,290);
    }else if(n===2){
      const wide=u>=4.2;backdrop(c,'domain',1.6,-290,180);rect(c,0,0,W,H,'#06112a80');
      for(let i=0;i<8;i++)ring(c,830,355,135+i*36+Math.sin(m*.9)*8,BLUE,1.2,.75,m*.04+i*.06);
      if(!wide){const frame=u<.8?0:u<2.5?1:u<3.2?2:3;c.save();camera(c,1+u*.023,-u*9,10);cel(c,'gojo-face',frame,870,790,800);c.restore();}
      else{actor(c,'gojo-cast',772,699,592,u-4.2,'cast',false,1,reduced);wind(c,m,870,290,90+ease((u-4.2)/1.2)*100);}
      particles(c,m,BLUE,34);caption(c,u,'GOJO','THE SPACE BETWEEN',BLUE);
    }else if(n===3){
      const stage=u<2?0:u<4.5?1:2;backdrop(c,'alley',stage===1?1.65:1.2,Math.sin(m*.6)*90,stage===1?170:25);
      c.save();camera(c,stage===1?1.75:1,stage===1?-245:0,stage===1?275:0,stage===2?-.045:0);
      const x=stage===0?lerp(390,700,u/2):stage===1?730:730+(u-4.5)*210;
      actor(c,'yuji-run',x,707,545,m,'run',false,1,reduced);c.restore();
      streaks(c,m*1.5,GOLD,.3);particles(c,m,GOLD,200,26);if(stage!==1)foreground(c,m,320);caption(c,u,'YUJI','KEEP MOVING FORWARD',GOLD);
    }else if(n===4){
      const close=u>=2&&u<4;backdrop(c,'city',1.65,((m*95)%210)-105,130);
      c.save();camera(c,close?1.8:1,close?-140:0,close?315:0,-.018);
      for(let i=3;i>=0;i--)actor(c,'naoya-run',760-i*100+Math.sin(m*.65)*85,709-i*3,548,m-i*.045,'run',false,i===0?1:.1+(3-i)*.08,reduced);
      c.restore();streaks(c,m*2,GOLD,.36);foreground(c,m,470);caption(c,u,'NAOYA','FRAME BY FRAME',GOLD);
    }else if(n===5){
      const s=Math.floor(u/2);backdrop(c,'domain',s===0?1.02+u*.02:s===3?1.12:1.42,s===1?230:s===2?-260:0,s===0?0:95);
      c.save();if(s===1)camera(c,1.32,170,165,-.02);if(s===2)camera(c,1.32,-190,165,.02);
      actor(c,'gojo-cast',340,693,475,u,'cast',false,1,reduced);actor(c,'sukuna-cast',975,693,475,u+.25,'cast',false,1,reduced);
      for(let i=0;i<4;i++){ring(c,360,384,115+i*29+Math.sin(m+i)*6,BLUE,2,.86,m*.15+i*.5);ring(c,955,384,115+i*29+Math.cos(m+i)*6,'#ffbd70',2,.86,-m*.15+i*.5);}
      c.restore();if(u>5.5){wind(c,m,648,352,40+ease((u-5.5)/2)*175);path(c,[[690,43],[618,217],[675,369],[618,507],[655,678]],WHITE,2+Math.sin(m*3));}
      particles(c,m,WHITE,95,45);if(u<2.5)caption(c,u,'DOMAIN COLLISION','TWO BARRIERS. ONE WINNER.',WHITE);
    }else if(n===6){
      const close=u>=2&&u<4;backdrop(c,'alley',1.25,90,45);rect(c,0,0,W,H,'#0d15226b');
      wind(c,m,800,345,220);c.save();camera(c,close?1.48:1,close?-200:0,close?185:0,close?-.018:0);
      actor(c,'animegirl-kick',814+Math.sin(m)*12,711,568,u,'kick',true,1,reduced);c.restore();
      wind(c,m+.8,865,370,130);particles(c,m,WHITE,135,50);
      caption(c,u,window.JJANIMEGIRL?.unlocked?'STUPID ANIME GIRL':'A SECRET IN THE WIND','WHITE WIND / TSUNDERE',WHITE);
    }else{
      backdrop(c,'city',1.13-u*.018,0,-10-u*9);
      actor(c,'gojo-cast',380,721,340,m,'cast',false,1,reduced);actor(c,'yuji-run',663,720,332,m,'run',false,1,reduced);actor(c,'naoya-run',932,721,332,m,'run',false,1,reduced);
      if(u>=1){const k=ease((u-1)/.7);c.save();c.globalAlpha=k;rect(c,0,180,W,204,'#08101ed9');text(c,'JUJUTSU',640,265,91,GOLD,'center');text(c,'BATTLEGROUND',640,339,66,WHITE,'center');c.restore();}
      particles(c,m,GOLD,65,45);if(u>3.2){c.globalAlpha=clamp((u-3.2)/.8);rect(c,0,0,W,H,INK);c.globalAlpha=1;}
    }
    shade(c);
    // Fast dark occlusion at shot changes, not white flashes. Motion remains
    // continuous within each shot; only the film's final beat is a title card.
    if(shotTime<.12&&lastShot>0&&!reduced){const x=lerp(-250,1530,ease(shotTime/.12));path(c,[[x-180,0],[x+80,0],[x-90,H],[x-350,H]],INK);}
    const bar=reduced?34:30+Math.sin(m*.18)*3;rect(c,0,0,W,bar,INK);rect(c,0,H-bar,W,bar,INK);
    c.restore();return n;
  }
})();
