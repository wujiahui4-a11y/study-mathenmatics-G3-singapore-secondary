'use strict';
const fs=require('node:fs'),path=require('node:path');
module.exports=root=>Object.fromEntries(['dessert-void','black-flash'].map(id=>{
  const bytes=fs.readFileSync(path.join(root,'jujutsu/ryu-art',id+'.webp'));
  if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error('Invalid Ryu artwork '+id);
  return [id,'data:image/webp;base64,'+bytes.toString('base64')];
}));
