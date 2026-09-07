/* Import Roblox Studio's Export Selection OBJ/MTL, retaining its actual
   vertices, UVs, normals and PNGs. No downloads or runtime asset requests.
   Usage: node tools/import-jjs-obj.cjs path/to/jjsmap.obj */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const file=path.resolve(process.argv[2]),dir=path.dirname(file),text=fs.readFileSync(file,'utf8');
const mtlFile=text.match(/^mtllib (.+)$/m)[1].trim(),mtls=new Map(),textures={},textureHashes=new Map(),textureInfo={};let m;
function image(name){
 if(!name)return null;const absolute=path.resolve(dir,name);if(!absolute.startsWith(dir+path.sep))throw Error('Texture outside export folder');
 const bytes=fs.readFileSync(absolute),hash=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,24);
 if(!textures[hash])textures[hash]='data:image/png;base64,'+bytes.toString('base64');textureInfo[hash]={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};textureHashes.set(name,hash);return hash;
}
for(const line of fs.readFileSync(path.join(dir,mtlFile),'utf8').split(/\r?\n/)){
 const words=line.trim().split(/\s+/),key=words.shift();if(key==='newmtl'){m={name:words.join(' '),color:[1,1,1],alpha:1,ns:0};mtls.set(m.name,m);}
 else if(m){if(key==='Kd')m.color=words.map(Number);else if(key==='d')m.alpha=Number(words[0]);else if(key==='Ns')m.ns=Number(words[0]);else if(key==='map_Kd')m.map=image(words.join(' '));else if(key==='map_Bump'||key==='bump')m.normal=image(words.join(' '));else if(key==='map_Ns')m.specular=image(words.join(' '));}
}
const positions=[],normals=[],uvs=[],groups=new Map(),names=new Set(),objects=new Map();let material=null,name='',discarded=0,triangles=0,meshTriangles=0;
const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
function pack(array,type){const a=type==='index'?new Uint32Array(array):new Float32Array(array);return Buffer.from(a.buffer).toString('base64');}
for(const line of text.split(/\r?\n/)){
 const words=line.trim().split(/\s+/),key=words.shift();
 if(key==='v')positions.push(words.map(Number));else if(key==='vn')normals.push(words.map(Number));else if(key==='vt')uvs.push(words.map(Number));else if(key==='g'||key==='o')name=words.join(' ');else if(key==='usemtl'){material=mtls.get(words.join(' '));if(!material)throw Error('Missing material '+words.join(' '));}
 else if(key==='f'){
  if(!material)throw Error('Face without material');
  const vertices=words.map(w=>w.split('/').map(Number));
  if(vertices.some(v=>Math.abs(positions[v[0]-1][1])>10000)){discarded+=vertices.length-2;continue;}
  if(material.alpha<=0)continue;
  const groupKey=JSON.stringify([material.map,material.normal,material.specular,material.alpha,material.ns]);
  if(!groups.has(groupKey))groups.set(groupKey,{material:{map:material.map,normal:material.normal,specular:material.specular,alpha:material.alpha,ns:material.ns},position:[],normal:[],uv:[],color:[],index:[],owner:[],lookup:new Map()});
  const group=groups.get(groupKey),indices=[];names.add(name);
  if(!objects.has(name))objects.set(name,{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],color:material.color});
  const object=objects.get(name);for(const v of vertices)for(let a=0;a<3;a++){object.min[a]=Math.min(object.min[a],positions[v[0]-1][a]);object.max[a]=Math.max(object.max[a],positions[v[0]-1][a]);}
  for(const v of vertices){
   const lookup=v.join('/')+'/'+material.color.join(',');let index=group.lookup.get(lookup);
   if(index==null){index=group.position.length/3;group.lookup.set(lookup,index);const p=positions[v[0]-1];group.position.push(...p);group.normal.push(...(normals[v[2]-1]||[0,1,0]));group.uv.push(...(uvs[v[1]-1]||[0,0]).slice(0,2));group.color.push(...material.color);for(let a=0;a<3;a++){bounds.min[a]=Math.min(bounds.min[a],p[a]);bounds.max[a]=Math.max(bounds.max[a],p[a]);}}
   indices.push(index);
  }
  for(let i=1;i<indices.length-1;i++){group.index.push(indices[0],indices[i],indices[i+1]);group.owner.push(name);triangles++;if(/Reimu/i.test(name))meshTriangles++;}
 }
}
// Match each exported object to the original Studio part by its world bounds.
// The OBJ exporter renames objects, so sequential names are not stable IDs.
const source=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.resolve(__dirname,'../jujutsu/jjs/source.json.gz'))));
const parts=source.parts.filter(p=>!p.path.startsWith('Workspace.Map.Data.')),buckets=new Map(),owners=new Map(),used=new Set();
parts.forEach((p,id)=>{const key=p.cf.slice(0,3).map(x=>Math.floor(x)).join(',');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push({p,id});});
for(const [name,o] of objects){
 const center=o.min.map((x,i)=>(x+o.max[i])/2),extent=o.min.map((x,i)=>(o.max[i]-x)/2);let best=null,score=Infinity;
 for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const item of buckets.get([Math.floor(center[0])+x,Math.floor(center[1])+y,Math.floor(center[2])+z].join(','))||[]){
  if(used.has(item.id))continue;const p=item.p,e=[0,0,0];for(let a=0;a<3;a++)for(let j=0;j<3;j++)e[a]+=Math.abs(p.cf[3+a*3+j])*p.size[j]/2;
  const error=Math.max(...center.map((v,i)=>Math.abs(v-p.cf[i])),...extent.map((v,i)=>Math.abs(v-e[i])));
  if(error>.12)continue;const s=error+o.color.reduce((sum,v,i)=>sum+Math.abs(v-p.color[i]),0)*.02;if(s<score){best=item.id;score=s;}
 }
 if(best!==null){owners.set(name,best+1);used.add(best);}
}
// Studio emits decal artwork as additional planar objects. Match these to a
// source part's face (allowing a second object per part), or the poster would
// remain suspended across the hole after its backing was fractured.
let attachedObjects=0;
for(const [name,o] of objects){
 if(owners.has(name))continue;
 const center=o.min.map((x,i)=>(x+o.max[i])/2),extent=o.min.map((x,i)=>(o.max[i]-x)/2);
 let best=null,score=Infinity;
 parts.forEach((p,id)=>{
  if(!used.has(id))return;
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
   const c=p.cf.slice(0,3),e=[0,0,0];
   for(let a=0;a<3;a++){
    c[a]+=p.cf[3+a*3+axis]*p.size[axis]/2*sign;
    for(let j=0;j<3;j++)if(j!==axis)e[a]+=Math.abs(p.cf[3+a*3+j])*p.size[j]/2;
   }
   const error=Math.max(...center.map((v,i)=>Math.abs(v-c[i])),...extent.map((v,i)=>Math.abs(v-e[i])));
   if(error<.12&&error<score){best=id;score=error;}
  }
 });
 if(best!==null){owners.set(name,best+1);attachedObjects++;}
}
const visual={version:2,source:path.basename(file),scale:1,bounds,triangles,meshTriangles,sourceGroups:names.size,matchedObjects:owners.size,attachedObjects,discardedPoolTriangles:discarded,textureFiles:textureHashes.size,textures,textureInfo,groups:Array.from(groups.values()).map(g=>({material:g.material,position:pack(g.position),normal:pack(g.normal),uv:pack(g.uv),color:pack(g.color),index:pack(g.index,'index'),owner:pack(g.owner.map(n=>owners.get(n)||0),'index')}))};
if(!meshTriangles)throw Error('The original Reimu mesh is missing from this export');
const out=path.resolve(__dirname,'../jujutsu/jjs/visual.json.gz');fs.writeFileSync(out,zlib.gzipSync(JSON.stringify(visual),{level:9}));
console.log(JSON.stringify({triangles,meshTriangles,sourceGroups:names.size,matchedObjects:owners.size,materialGroups:visual.groups.length,textureFiles:visual.textureFiles,uniqueTextures:Object.keys(textures).length,discardedPoolTriangles:discarded,bytes:fs.statSync(out).size,bounds},null,2));
