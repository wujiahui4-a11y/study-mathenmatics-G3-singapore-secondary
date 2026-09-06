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
const positions=[],normals=[],uvs=[],groups=new Map(),names=new Set();let material=null,name='',discarded=0,triangles=0,meshTriangles=0;
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
  if(!groups.has(groupKey))groups.set(groupKey,{material:{map:material.map,normal:material.normal,specular:material.specular,alpha:material.alpha,ns:material.ns},position:[],normal:[],uv:[],color:[],index:[],lookup:new Map()});
  const group=groups.get(groupKey),indices=[];names.add(name);
  for(const v of vertices){
   const lookup=v.join('/')+'/'+material.color.join(',');let index=group.lookup.get(lookup);
   if(index==null){index=group.position.length/3;group.lookup.set(lookup,index);const p=positions[v[0]-1];group.position.push(...p);group.normal.push(...(normals[v[2]-1]||[0,1,0]));group.uv.push(...(uvs[v[1]-1]||[0,0]).slice(0,2));group.color.push(...material.color);for(let a=0;a<3;a++){bounds.min[a]=Math.min(bounds.min[a],p[a]);bounds.max[a]=Math.max(bounds.max[a],p[a]);}}
   indices.push(index);
  }
  for(let i=1;i<indices.length-1;i++){group.index.push(indices[0],indices[i],indices[i+1]);triangles++;if(/Reimu/i.test(name))meshTriangles++;}
 }
}
const visual={version:1,source:path.basename(file),scale:1,bounds,triangles,meshTriangles,sourceGroups:names.size,discardedPoolTriangles:discarded,textureFiles:textureHashes.size,textures,textureInfo,groups:Array.from(groups.values()).map(g=>({material:g.material,position:pack(g.position),normal:pack(g.normal),uv:pack(g.uv),color:pack(g.color),index:pack(g.index,'index')}))};
if(!meshTriangles)throw Error('The original Reimu mesh is missing from this export');
const out=path.resolve(__dirname,'../jujutsu/jjs/visual.json.gz');fs.writeFileSync(out,zlib.gzipSync(JSON.stringify(visual),{level:9}));
console.log(JSON.stringify({triangles,meshTriangles,sourceGroups:names.size,materialGroups:visual.groups.length,textureFiles:visual.textureFiles,uniqueTextures:Object.keys(textures).length,discardedPoolTriangles:discarded,bytes:fs.statSync(out).size,bounds},null,2));
