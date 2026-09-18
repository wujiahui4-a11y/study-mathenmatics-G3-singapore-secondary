'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {create}=require('./test-opening.cjs'),root=path.resolve(__dirname,'..'),art=require('./opening-art.cjs')(root);
const bySource=new Map(Object.entries(art).map(([id,m])=>[m.src,{id,...m}]));
class ReadyImage{set src(v){this.asset=bySource.get(v);assert.ok(this.asset);this.width=this.asset.width;this.height=this.asset.height;this.complete=true;this.onload?.();}}
class BrokenImage{set src(v){this.onerror?.();}}
class HangingImage{set src(v){}}
(async()=>{
  const r=create({film:true,Image:ReadyImage,art}),o=r.c.JJOPENING,f=r.c.JJOPENINGFILM;
  assert.equal(f.status().loaded,9);assert.equal(o.audit().duration,48);assert.equal(o.active,true);
  for(let i=0;i<48*24;i++)o.renderAt(i/24);
  const seen=new Set(f.audit().seen);
  for(const [id,m] of Object.entries(art)){
    if(m.cols===1)continue;
    for(let i=0;i<m.cols*m.rows;i++)assert.ok(seen.has(id+':'+i),id+' frame '+i+' appears');
  }
  assert.equal(seen.size,44,'44 distinct animation cels');assert.equal(f.audit().shot,22,'23 shots rendered');
  o.renderAt(7.01);const a=f.audit().frames['yuji-run'];o.renderAt(7.15);assert.notEqual(f.audit().frames['yuji-run'],a,'running changes pose, not just camera');
  r.key('KeyG');assert.equal(o.active,false);assert.equal(r.raf.size,0);
  console.log('PASS nine assets, 44 cels, 23 shots, running pose changes, and skip');
  const broken=create({film:true,Image:BrokenImage,art});assert.equal(broken.c.JJOPENINGFILM.status().failed,9);broken.tick(.5);assert.ok(broken.c.JJOPENING.audit().time>0);broken.key('KeyG');assert.equal(broken.c.JJOPENING.active,false);
  const pending=create({film:true,Image:HangingImage,art});pending.tick(1);assert.equal(pending.c.JJOPENING.audit().time,0);pending.key('KeyG');assert.equal(pending.c.JJOPENING.active,false,'skip while decoding');
  const timeout=create({film:true,Image:HangingImage,art});timeout.tick(6.5);assert.ok(timeout.c.JJOPENING.audit().time>0,'bounded asset wait');timeout.tick(49);assert.equal(timeout.c.JJOPENING.active,false);
  const reduced=create({film:true,Image:ReadyImage,art,reduced:true});reduced.tick(49);assert.equal(reduced.c.JJOPENING.active,false);
  console.log('PASS decode failure, loading skip, asset timeout, reduced motion and completion');
  for(const file of ['jujutsu-multiplayer.html','jujutsu-parts/p5.js']){
    const built=fs.readFileSync(path.join(root,file),'utf8');assert.ok(built.includes('/* OPENING_ART_BEGIN */'));
    const uploadBytes=Buffer.byteLength(JSON.stringify({repository_full_name:'wujiahui4-a11y/study-mathenmatics-G3-singapore-secondary',content:built,encoding:'utf-8'}));
    assert.ok(uploadBytes<16*1024*1024-32*1024,file+' exceeds GitHub connector upload budget: '+uploadBytes);
    assert.ok(built.includes(fs.readFileSync(path.join(root,'jujutsu/opening-film.js'),'utf8').trim()));
    for(const m of Object.values(art))assert.ok(built.includes(m.src),file+' embeds '+m.file);
  }
  assert.ok(Object.values(art).filter(m=>m.cols>1).every(m=>m.alpha),'all sprite sheets retain transparency');
  console.log('PASS portable embedded WebP assets, transparent sprites and GitHub upload size budget');
  if(process.argv.includes('--render')){
    const {Canvas,Image}=require(process.env.OPENING_CANVAS_MODULE||'skia-canvas');
    const actual=create({film:true,Image,art,render:true,unlocked:true});await actual.c.JJOPENINGFILM.ready;assert.equal(actual.c.JJOPENINGFILM.status().loaded,9,'real image decoding');
    const dir=path.join(root,'work/opening-film');fs.mkdirSync(dir,{recursive:true});const frame=new Canvas(1280,720),sheet=new Canvas(1280,1080),sc=sheet.getContext('2d');
    const times=[3,7,10,13.6,16.9,19,25,28.5,31,35,40.5,46.5];
    for(let i=0;i<times.length;i++){actual.c.JJOPENING.renderAt(times[i],frame.getContext('2d'));await fs.promises.writeFile(path.join(dir,'shot-'+String(i+1).padStart(2,'0')+'.png'),await frame.toBuffer('png'));sc.drawImage(frame,(i%3)*1280/3,Math.floor(i/3)*270,1280/3,240);}
    await fs.promises.writeFile(path.join(dir,'contact.png'),await sheet.toBuffer('png'));
    const motion=new Canvas(1280,360),mc=motion.getContext('2d');for(let i=0;i<8;i++){actual.c.JJOPENING.renderAt(7+i/12,frame.getContext('2d'));mc.drawImage(frame,i%4*320,Math.floor(i/4)*180,320,180);}await fs.promises.writeFile(path.join(dir,'run-cycle.png'),await motion.toBuffer('png'));
    console.log('RENDERED twelve shots and eight consecutive running frames in work/opening-film/');
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
