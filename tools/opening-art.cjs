'use strict';
const fs=require('node:fs'),path=require('node:path');
module.exports=function openingArt(root){
  const dir=path.join(root,'jujutsu/opening-art'),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
  return Object.fromEntries(Object.entries(manifest).map(([id,m])=>{
    if(!/^[a-z0-9-]+\.webp$/.test(m.file)||!Number.isInteger(m.cols)||!Number.isInteger(m.rows))throw Error('Invalid opening asset '+id);
    const bytes=fs.readFileSync(path.join(dir,m.file));
    if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error('Invalid WebP '+id);
    return [id,{...m,src:'data:image/webp;base64,'+bytes.toString('base64')}];
  }));
};
