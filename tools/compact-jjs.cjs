'use strict';
// Base85 carries the existing gzip bytes losslessly, with less text overhead.
// It contains no quotes, slash or backslash, so it is safe in an inline script.
const alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~';
module.exports=function compactJJS(source){
  const pattern=/var binary=atob\('([A-Za-z0-9+/=]+)'\),bytes=new Uint8Array\(binary.length\);\s*for\(var i=0;i<binary.length;i\+\+\)bytes\[i\]=binary.charCodeAt\(i\);/;
  const match=source.match(pattern);if(!match)throw Error('Expected packed JJS bytes');
  const bytes=Buffer.from(match[1],'base64'),chunks=[];
  for(let i=0;i<bytes.length;i+=4){let value=0;for(let j=0;j<4;j++)value=value*256+(bytes[i+j]||0);let word='';for(let j=0;j<5;j++){word=alphabet[value%85]+word;value=Math.floor(value/85);}chunks.push(word);}
  const text=chunks.join('');
  const decoder="var bytes=(function(){var s='"+text+"',a='"+alphabet+"',out=new Uint8Array("+bytes.length+");for(var i=0,p=0;i<s.length;i+=5){var n=0;for(var j=0;j<5;j++)n=n*85+a.indexOf(s[i+j]);for(j=3;j>=0;j--){if(p+j<out.length)out[p+j]=n%256;n=Math.floor(n/256);}p+=4;}return out;})();";
  return source.replace(pattern,()=>decoder);
};
