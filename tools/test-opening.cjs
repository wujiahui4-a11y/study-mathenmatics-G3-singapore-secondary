/* Opening lifecycle and full drawing timeline. Optional --render uses
   OPENING_CANVAS_MODULE (or installed skia-canvas) for actual PNG contact sheets. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),source=read('jujutsu/opening.js');
const render=process.argv.includes('--render'),Canvas=render?require(process.env.OPENING_CANVAS_MODULE||'skia-canvas').Canvas:null;
function create(options={}){
  let now=0,next=0,draws=0;const raf=new Map(),events={},nodes=[],labels=[],audioInstances=[];
  const doc={hidden:false,activeElement:null,createElement:tag=>new Element(tag),querySelector:()=>actions,addEventListener:(n,f)=>(events[n]??=[]).push(f)};
  class Element{
    constructor(tag){this.tagName=tag.toUpperCase();this.style={};this.children=[];this.attrs={};this.events={};this.isConnected=true;this.inert=false;nodes.push(this);
      if(tag==='canvas'){
        this.real=Canvas&&options.render?new Canvas(1280,720):{width:1280,height:720};
        Object.defineProperties(this,{width:{get:()=>this.real.width,set:v=>this.real.width=v},height:{get:()=>this.real.height,set:v=>this.real.height=v}});
        const raw=Canvas&&options.render?this.real.getContext('2d'):new Proxy({canvas:this.real,createLinearGradient:()=>({addColorStop(){}})},{get:(t,k)=>k in t?t[k]:()=>{}});
        this.context=new Proxy(raw,{get:(target,key)=>{const v=target[key];return typeof v==='function'?(...args)=>{if(options.badDrawing)throw Error('test render failure');for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n),key+' finite');if(key==='fillText')labels.push(args[0]);draws++;return v.apply(target,args);}:v;},set:(target,key,v)=>{target[key]=v;return true;}});
      }
    }
    setAttribute(k,v){this.attrs[k]=v;}appendChild(e){this.children.push(e);return e;}getContext(){return options.noCanvas?null:this.context;}
    addEventListener(n,f){(this.events[n]??=[]).push(f);}focus(){doc.activeElement=this;}
    click(){for(const f of this.events.click||[])f({preventDefault(){},stopPropagation(){}});}
  }
  const body=doc.body=new Element('body'),head=doc.head=new Element('head'),menu=new Element('section'),menuFight=new Element('button'),actions=new Element('div');doc.activeElement=body;
  class Param{constructor(){this.value=0;}setValueAtTime(v){assert.ok(Number.isFinite(v));this.value=v;}exponentialRampToValueAtTime(v){assert.ok(v>0&&Number.isFinite(v));}setTargetAtTime(v){assert.ok(v>=0&&Number.isFinite(v));}}
  class Audio{
    constructor(){this.state='suspended';this.currentTime=0;this.destination={};this.oscillators=[];audioInstances.push(this);}
    resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
    createGain(){return {gain:new Param(),connect(){},disconnect(){}};}
    createOscillator(){const o={frequency:new Param(),connect(){},disconnect(){},start(){},stop(at){if(at===undefined){this.stopped=true;this.onended?.();}else this.until=at;}};this.oscillators.push(o);return o;}
  }
  const c={console,Math,Set,Array,String,Number,document:doc,performance:{now:()=>now},started:false,menu,menuFight,keys:{},AudioContext:options.noAudio?undefined:Audio,
    MPJJ:{active:false},JJANIMEGIRL:{unlocked:!!options.unlocked},matchMedia:()=>({matches:!!options.reduced}),Image:options.Image,JJOPENINGART:options.art,
    clearMovement(){c.keys={};},refreshMouseUI(){c.refreshed=true;},gameInputActive:()=>c.started,
    requestAnimationFrame:f=>{raf.set(++next,f);return next;},cancelAnimationFrame:id=>raf.delete(id),
    addEventListener:(n,f)=>(events[n]??=[]).push(f)};c.window=c;
  vm.createContext(c);if(options.film)vm.runInContext(read('jujutsu/opening-film.js'),c);vm.runInContext(source,c);
  function tick(seconds,dt=1/30){for(let i=0;i<Math.ceil(seconds/dt);i++){now+=dt*1000;for(const ac of audioInstances){ac.currentTime+=dt;for(const o of ac.oscillators)if(!o.stopped&&o.until<=ac.currentTime){o.stopped=true;o.onended?.();}}
    const callbacks=[...raf.values()];raf.clear();for(const f of callbacks)f(now);}}
  function key(code,extra={}){const e={code,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};c.JJOPENING.input(e);return e;}
  const emit=(n,e={})=>{for(const f of events[n]||[])f(e);};
  return {c,doc,nodes,labels,audioInstances,tick,key,emit,raf,drawCount:()=>draws};
}
module.exports={create};
if(require.main===module)(async()=>{
  const r=create(),o=r.c.JJOPENING;
  assert.equal(o.active,true);assert.equal(r.c.menu.inert,true);assert.equal(r.c.gameInputActive(),false);assert.equal(r.audioInstances.length,0,'no autoplay audio');
  r.tick(.5);assert.ok(o.audit().time>.4);assert.ok(r.drawCount()>100);assert.equal(r.key('Digit1').stopped,true);assert.equal(r.key('Space').stopped,true);
  assert.equal(r.key('KeyG',{repeat:true}).stopped,true);assert.equal(o.active,true,'held G does not skip');
  const g=r.key('KeyG');assert.equal(g.stopped,true);assert.equal(o.active,false);assert.equal(r.c.started,false,'skip returns to menu');assert.equal(r.c.menu.inert,false);assert.equal(r.raf.size,0);
  assert.equal(r.key('KeyG',{repeat:true}).stopped,true,'skip cannot leak into awakening');r.emit('keyup',{code:'KeyG'});assert.equal(r.key('KeyG').stopped,undefined,'fresh G restored');
  assert.equal(r.doc.activeElement,r.c.menuFight);o.skip();assert.equal(o.play(),true);r.c.started=true;assert.equal(r.c.gameInputActive(),false);o.skip();assert.equal(r.c.gameInputActive(),true);assert.equal(o.play(),false,'no replay during combat');
  console.log('PASS autoplay, input lock, immediate G skip, held-key isolation, focus and gameplay restoration');

  for(const seconds of [1,8,14,20,26,33,40,46]){const s=create();s.tick(seconds);assert.equal(s.c.JJOPENING.active,true);s.key('KeyG');assert.equal(s.raf.size,0,'skip chapter '+seconds);}
  const full=create();full.tick(49);assert.equal(full.c.JJOPENING.active,false);assert.equal(full.raf.size,0);assert.equal(full.c.started,false);
  assert.equal(new Set(full.labels.filter(x=>/^[0-9]{2} \/ /.test(x))).size,8,'all eight chapters render');
  assert.ok(!full.labels.includes('STUPID ANIME GIRL'),'secret identity stays hidden');const unlocked=create({unlocked:true});unlocked.c.JJOPENING.renderAt(40);assert.ok(unlocked.labels.includes('STUPID ANIME GIRL'));
  const hidden=create();hidden.tick(2);const before=hidden.c.JJOPENING.audit().time;hidden.doc.hidden=true;hidden.emit('visibilitychange');hidden.tick(80);assert.equal(hidden.c.JJOPENING.audit().time,before);hidden.doc.hidden=false;hidden.emit('visibilitychange');hidden.tick(.2);assert.ok(hidden.c.JJOPENING.audit().time<before+.3);
  const reduced=create({reduced:true});reduced.tick(48.5);assert.equal(reduced.c.JJOPENING.active,false);
  assert.equal(create({noCanvas:true}).c.JJOPENING.active,false);assert.equal(create({badDrawing:true}).c.JJOPENING.active,false,'render failure releases menu');
  console.log('PASS every scene, natural completion, secret identity, hidden-tab timing, reduced motion and render fallback');

  const a=create();const sound=a.nodes.find(n=>n.textContent==='SOUND: OFF');sound.click();await new Promise(resolve=>setImmediate(resolve));a.tick(3);
  assert.equal(a.c.JJOPENING.audit().sound,true);assert.ok(a.audioInstances[0].oscillators.length>8,'original score synthesized');assert.ok(a.c.JJOPENING.audit().voices<=23);
  a.key('KeyG');assert.equal(a.audioInstances[0].state,'closed');assert.equal(a.c.JJOPENING.audit().voices,0);assert.ok(a.audioInstances[0].oscillators.every(v=>v.stopped));
  const race=create();race.nodes.find(n=>n.textContent==='SOUND: OFF').click();race.key('KeyG');await new Promise(resolve=>setImmediate(resolve));assert.equal(race.c.JJOPENING.audit().sound,false,'skip wins audio-resume race');
  const replayRace=create();replayRace.nodes.find(n=>n.textContent==='SOUND: OFF').click();replayRace.key('KeyG');replayRace.c.JJOPENING.play();await new Promise(resolve=>setImmediate(resolve));assert.equal(replayRace.c.JJOPENING.audit().sound,false,'old resume cannot enable sound on a new playback');
  const silent=create({noAudio:true});silent.nodes.find(n=>n.textContent==='SOUND: OFF').click();await new Promise(resolve=>setImmediate(resolve));assert.equal(silent.c.JJOPENING.active,true);silent.nodes.find(n=>n.textContent==='SKIP OPENING · G').click();assert.equal(silent.c.JJOPENING.active,false,'click skip works without sound');
  console.log('PASS opt-in audio, bounded voices, skip cleanup, async race, unavailable audio and touch button');

  const base=read('jujutsu/base.html');assert.ok(base.indexOf('JJOPENING.input(e)')<base.indexOf('JJDOMAINCLASH.input(e)'));assert.ok(base.includes('JJOPENING.active) { clock.getDelta(); return; }'));
  for(const f of ['jujutsu-multiplayer.html','jujutsu-parts/p5.js'])assert.ok(read(f).includes(source.trim()),f+' current opening');
  if(vm.SourceTextModule)new vm.SourceTextModule(read('jujutsu-parts/p5.js'));
  console.log('PASS earliest input gate, paused world clock, both generated builds and full module syntax');
  if(render){
    fs.mkdirSync(path.join(root,'work/opening'),{recursive:true});
    const sheet=new Canvas(1280,720),sc=sheet.getContext('2d'),art=create({unlocked:true,render:true}),frame=new Canvas(1280,720);
    const samples=[4,8,14,20,26,33,40,46];
    for(let i=0;i<samples.length;i++){art.c.JJOPENING.renderAt(samples[i],frame.getContext('2d'));await fs.promises.writeFile(path.join(root,'work/opening/scene-'+(i+1)+'.png'),await frame.toBuffer('png'));sc.drawImage(frame,(i%4)*320,Math.floor(i/4)*360,320,180);art.c.JJOPENING.renderAt(samples[i]+1,frame.getContext('2d'));sc.drawImage(frame,(i%4)*320,Math.floor(i/4)*360+180,320,180);}
    await fs.promises.writeFile(path.join(root,'work/opening/contact.png'),await sheet.toBuffer('png'));
    console.log('RENDERED work/opening/contact.png and eight full-size frames');
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
