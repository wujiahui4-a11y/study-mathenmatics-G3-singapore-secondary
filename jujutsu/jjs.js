/* JJS: original Studio geometry, one Roblox stud per game unit.
   Rendering batches parts; collision uses their original oriented boxes. */
(function () {
  'use strict';
  if (typeof JJS_DATA === 'undefined') return;
  var D=JJS_DATA, CELL=24, HEIGHT=5.1, STEP=1.15, EPS=.015;
  var root=null, boxes=[], buckets=new Map(), resources=[], textures=new Map();
  var originals=new Map(), fragments=new Map();
  var pending=[], matrix=new THREE.Matrix4(), color=new THREE.Color();
  var J=window.JJJJS={data:D,build:build,clear:clear,floor:floor,ceiling:ceiling,collide:collide,spawn:spawn,ray:ray,HEIGHT:HEIGHT,STEP:STEP};
  function own(o){resources.push(o);return o;}
  function rgba(a){return 'rgb('+a.map(function(x){return Math.round(x*255);}).join(',')+')';}
  function linear(a){return new THREE.Color().setRGB(a[0],a[1],a[2],THREE.SRGBColorSpace);}
  function transform(p){return new THREE.Matrix4().set(p[3],p[4],p[5],p[0]-D.origin[0],p[6],p[7],p[8],p[1]-D.origin[1],p[9],p[10],p[11],p[2]-D.origin[2],0,0,0,1);}
  function clear(){
    if(window.JJDESTRUCT)JJDESTRUCT.clear();
    if(root)scene.remove(root);
    resources.forEach(function(o){o.dispose();});resources=[];textures.clear();
    root=null;J.root=null;J.visualMeshes=[];boxes=[];buckets.clear();pending=[];originals.clear();fragments.clear();
  }
  function texture(uri){
    var source=D.assets[uri]||(D.visual&&D.visual.textures[uri]);if(!source)return null;
    if(textures.has(uri))return textures.get(uri);
    var tex=own(new THREE.Texture());tex.colorSpace=THREE.SRGBColorSpace;
    var img=new Image(), promise=new Promise(function(resolve){img.onload=function(){tex.image=img;tex.needsUpdate=true;resolve(true);};img.onerror=function(){resolve(false);};});
    img.src=source;pending.push(promise);textures.set(uri,tex);return tex;
  }
  function material(p){
    var name=D.materials[p[20]],neon=name==='Neon';
    if(neon)return own(new THREE.MeshBasicMaterial({color:0xffffff,transparent:p[18]>0,opacity:1-p[18],depthWrite:p[18]<.05,toneMapped:false}));
    var m=own(new THREE.MeshStandardMaterial({color:0xffffff,roughness:name==='Metal'||name==='DiamondPlate'?.48:.92,metalness:name==='Metal'?.18:0,transparent:p[18]>0,opacity:1-p[18],depthWrite:p[18]<.05,vertexColors:false}));
    if(neon){m.emissive.set(0xffffff);m.emissiveIntensity=.35;}
    return m;
  }
  function build(){
    clear();root=new THREE.Group();root.name='JJS';scene.add(root);
    if(D.visual){
      D.parts.forEach(function(p,id){if(p[21]&1)addBox(p,id);});
      buildVisual();D.guis.forEach(addGui);
      J.root=root;J.ready=Promise.all(pending);J.partCount=D.parts.length;J.drawGroups=D.visual.groups.length;return root;
    }
    var groups=new Map(),geo=own(new THREE.BoxGeometry(1,1,1));
    D.parts.forEach(function(p,id){
      if(p[21]&1)addBox(p,id);
      if(p[18]>=1||p[22])return;
      var key=p[20]+'/'+p[18]+'/'+p[19];
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push({p:p,id:id});
    });
    groups.forEach(function(list){
      var mesh=new THREE.InstancedMesh(geo,material(list[0].p),list.length);
      mesh.name='JJS '+D.materials[list[0].p[20]];mesh.castShadow=true;mesh.receiveShadow=true;
      list.forEach(function(item,i){var p=item.p;matrix.copy(transform(p)).scale(new THREE.Vector3(p[12],p[13],p[14]));mesh.setMatrixAt(i,matrix);color.setRGB(p[15],p[16],p[17],THREE.SRGBColorSpace);mesh.setColorAt(i,color);});
      mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();
      own(mesh);root.add(mesh);
    });
    D.decals.forEach(addDecal);D.guis.forEach(addGui);
    J.root=root;J.ready=Promise.all(pending);J.partCount=D.parts.length;J.drawGroups=groups.size;
    return root;
  }
  function unpack(encoded,integer){
    var raw=atob(encoded),bytes=new Uint8Array(raw.length);for(var i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    return integer?new Uint32Array(bytes.buffer):new Float32Array(bytes.buffer);
  }
  function buildVisual(){
    J.visualMeshes=[];
    D.visual.groups.forEach(function(g,i){
      var geo=own(new THREE.BufferGeometry());
      geo.setAttribute('position',new THREE.BufferAttribute(unpack(g.position),3));geo.setAttribute('normal',new THREE.BufferAttribute(unpack(g.normal),3));geo.setAttribute('uv',new THREE.BufferAttribute(unpack(g.uv),2));geo.setAttribute('color',new THREE.BufferAttribute(unpack(g.color),3));geo.setIndex(new THREE.BufferAttribute(unpack(g.index,true),1));geo.computeBoundingSphere();
      var p=g.material,map=texture(p.map),normal=texture(p.normal),specular=texture(p.specular);
      [map,normal,specular].forEach(function(t){if(t){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}});
      var info=D.visual.textureInfo[p.map],atlas=info&&info.height>=info.width*8;
      // Studio's plastic surface atlas uses out-of-range vertical UVs for
      // smooth faces. Repeating it paints studs across otherwise smooth walls.
      if(atlas){map.wrapT=THREE.ClampToEdgeWrapping;map.colorSpace=THREE.NoColorSpace;if(normal)normal.wrapT=THREE.ClampToEdgeWrapping;}
      if(normal)normal.colorSpace=THREE.NoColorSpace;if(specular)specular.colorSpace=THREE.NoColorSpace;
      var mat=own(new THREE.MeshPhongMaterial({color:0xffffff,vertexColors:true,map:map,normalMap:normal,specularMap:specular,normalScale:new THREE.Vector2(1,-1),specular:0x222222,shininess:Math.max(1,p.ns),transparent:p.alpha<1,opacity:p.alpha,alphaTest:map?.025:0,depthWrite:p.alpha>=.99}));
      if(atlas){mat.onBeforeCompile=function(shader){shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',THREE.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;','sampledDiffuseColor.rgb *= 2.0; diffuseColor *= sampledDiffuseColor;'));};mat.customProgramCacheKey=function(){return 'jjs-plastic-atlas';};}
      var mesh=new THREE.Mesh(geo,mat);mesh.name='JJS exported surfaces '+i;mesh.userData.originalIndex=geo.index.array.slice();mesh.userData.owners=g.owner?unpack(g.owner,true):null;J.visualMeshes.push(mesh);mesh.position.set(-D.origin[0],-D.origin[1],-D.origin[2]);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
    });
  }
  // Roblox NormalId to an outward-facing plane: local right, up and normal.
  var FACES={Front:[[ -1,0,0],[0,1,0],[0,0,-1],2,0,1],Back:[[1,0,0],[0,1,0],[0,0,1],2,0,1],Right:[[0,0,-1],[0,1,0],[1,0,0],0,2,1],Left:[[0,0,1],[0,1,0],[-1,0,0],0,2,1],Top:[[1,0,0],[0,0,-1],[0,1,0],1,0,2],Bottom:[[1,0,0],[0,0,1],[0,-1,0],1,0,2]};
  function face(part,side,mat){
    var p=D.parts[part],f=FACES[side];if(!p||!f)return;
    var size=p.slice(12,15),r=f[0],u=f[1],n=f[2],offset=size[f[3]]/2+.012;
    var basis=new THREE.Matrix4().set(r[0],u[0],n[0],n[0]*offset,r[1],u[1],n[1],n[1]*offset,r[2],u[2],n[2],n[2]*offset,0,0,0,1);
    var m=new THREE.Mesh(own(new THREE.PlaneGeometry(size[f[4]],size[f[5]])),mat);m.matrixAutoUpdate=false;m.matrix.multiplyMatrices(transform(p),basis);m.userData.jjsPart=part;root.add(m);return m;
  }
  function addDecal(d){
    if(d.transparency>=1)return;var tex=texture(d.texture);if(!tex)return;
    if(d.tile){tex=own(tex.clone());var p=D.parts[d.part],f=FACES[d.face];tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(p[12+f[4]]/d.tile[0],p[12+f[5]]/d.tile[1]);tex.offset.set(d.tile[2]/d.tile[0],d.tile[3]/d.tile[1]);}
    face(d.part,d.face,own(new THREE.MeshStandardMaterial({map:tex,color:linear(d.color),transparent:true,opacity:1-d.transparency,depthWrite:false,roughness:.9,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2})));
  }
  function addGui(g){
    if(!g.enabled)return;var p=D.parts[g.part],f=FACES[g.face];if(!p||!f)return;
    var width=g.sizing==='PixelsPerStud'?p[12+f[4]]*g.pixelsPerStud:g.canvas[0];
    var height=g.sizing==='PixelsPerStud'?p[12+f[5]]*g.pixelsPerStud:g.canvas[1];
    var cv=document.createElement('canvas');var scale=Math.min(1,2048/Math.max(width,height));cv.width=Math.max(1,Math.round(width*scale));cv.height=Math.max(1,Math.round(height*scale));
    var ctx=cv.getContext('2d'),tex=own(new THREE.CanvasTexture(cv));tex.colorSpace=THREE.SRGBColorSpace;
    var images=new Map();
    function draw(){
      ctx.clearRect(0,0,cv.width,cv.height);ctx.save();ctx.scale(scale,scale);
      var rects=[{x:0,y:0,w:width,h:height,visible:true}];
      g.children.forEach(function(c){var a=rects[c.parent],w=a.w*c.size[0]+c.size[1],h=a.h*c.size[2]+c.size[3];rects.push(c.abs?{x:c.abs[0],y:c.abs[1],w:c.abs[2],h:c.abs[3],visible:a.visible&&c.visible}:{x:a.x+a.w*c.pos[0]+c.pos[1]-w*c.anchor[0],y:a.y+a.h*c.pos[2]+c.pos[3]-h*c.anchor[1],w:w,h:h,visible:a.visible&&c.visible});});
      g.children.map(function(c,i){return {c:c,r:rects[i+1],i:i};}).sort(function(a,b){return a.c.z-b.c.z||a.i-b.i;}).forEach(function(item){
        var c=item.c,r=item.r;if(!r.visible)return;ctx.save();ctx.translate(r.x+r.w/2,r.y+r.h/2);ctx.rotate((c.absoluteRotation==null?c.rotation:c.absoluteRotation)*Math.PI/180);ctx.translate(-r.w/2,-r.h/2);
        if(c.alpha<1){ctx.globalAlpha=1-c.alpha;ctx.fillStyle=rgba(c.bg);ctx.fillRect(0,0,r.w,r.h);}
        var im=images.get(c.image);if(im&&im.complete&&im.naturalWidth){ctx.globalAlpha=1-(c.imageAlpha||0);ctx.drawImage(im,0,0,r.w,r.h);}
        if(c.text){
          var text=c.rich?c.text.replace(/<[^>]+>/g,''):c.text,lines=text.split('\n'),size=c.scaled?Math.min(r.h/lines.length*.8,r.w/Math.max(1,text.length)*1.7):c.textSize;
          ctx.font=(/Bold|Black|Heavy/.test(c.font)?'700 ':'400 ')+Math.max(1,size)+'px '+(/Mono|Code/.test(c.font)?'monospace':'Arial');ctx.fillStyle=rgba(c.textColor);ctx.globalAlpha=1-c.textAlpha;ctx.textBaseline='middle';ctx.textAlign=c.xAlign.toLowerCase();
          var x=c.xAlign==='Left'?0:c.xAlign==='Right'?r.w:r.w/2;
          var y=c.yAlign==='Top'?size/2:c.yAlign==='Bottom'?r.h-size*(lines.length-.5):r.h/2-size*(lines.length-1)/2;
          lines.forEach(function(line,i){ctx.fillText(line,x,y+i*size,r.w);});
        }ctx.restore();
      });ctx.restore();tex.needsUpdate=true;
    }
    g.children.forEach(function(c){if(!D.assets[c.image]||images.has(c.image))return;var img=new Image();images.set(c.image,img);pending.push(new Promise(function(resolve){img.onload=function(){draw();resolve(true);};img.onerror=function(){images.delete(c.image);resolve(false);};}));img.src=D.assets[c.image];});
    draw();face(g.part,g.face,own(new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3})));
  }
  function addBox(p,id){
    var b={id:id,x:p[0]-D.origin[0],y:p[1]-D.origin[1],z:p[2]-D.origin[2],r:p.slice(3,12),h:[p[12]/2,p[13]/2,p[14]/2]};
    var e=[0,0,0];for(var a=0;a<3;a++)for(var j=0;j<3;j++)e[a]+=Math.abs(b.r[a*3+j])*b.h[j];
    b.minX=b.x-e[0];b.maxX=b.x+e[0];b.minY=b.y-e[1];b.maxY=b.y+e[1];b.minZ=b.z-e[2];b.maxZ=b.z+e[2];if(typeof id==='number'){boxes.push(b);originals.set(id,b);}b.cells=[];
    for(var x=Math.floor(b.minX/CELL);x<=Math.floor(b.maxX/CELL);x++)for(var z=Math.floor(b.minZ/CELL);z<=Math.floor(b.maxZ/CELL);z++){
      var k=x+','+z;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(b);b.cells.push(k);
    }return b;
  }
  function nearby(x,z,r){
    if(!r)return (buckets.get(Math.floor(x/CELL)+','+Math.floor(z/CELL))||[]).filter(function(b){return !b.disabled;});
    var seen=new Set(),out=[];
    for(var a=Math.floor((x-r)/CELL);a<=Math.floor((x+r)/CELL);a++)for(var c=Math.floor((z-r)/CELL);c<=Math.floor((z+r)/CELL);c++){
      var list=buckets.get(a+','+c)||[];for(var i=0;i<list.length;i++)if(!list[i].disabled&&!seen.has(list[i].id)){seen.add(list[i].id);out.push(list[i]);}
    }return out;
  }
  function surfaceY(b,x,z,upper,limit){
    var dx=x-b.x,dz=z-b.z,result=upper?-Infinity:Infinity;
    for(var a=0;a<3;a++){
      var nx=b.r[a],ny=b.r[3+a],nz=b.r[6+a];if(Math.abs(ny)<.55)continue;
      var sign=(ny>0?1:-1)*(upper?1:-1);nx*=sign;ny*=sign;nz*=sign;
      var y=b.y+(b.h[a]-nx*dx-nz*dz)/ny;
      if(upper?y>limit+EPS:y<limit-EPS)continue;
      var inside=true;for(var j=0;j<3;j++)if(j!==a){var local=dx*b.r[j]+(y-b.y)*b.r[3+j]+dz*b.r[6+j];if(Math.abs(local)>b.h[j]+EPS){inside=false;break;}}
      if(inside)result=upper?Math.max(result,y):Math.min(result,y);
    }return result;
  }
  function floor(pos,limit){
    var top=-Infinity,list=nearby(pos.x,pos.z,0);if(limit==null)limit=pos.y+STEP;
    for(var i=0;i<list.length;i++){var b=list[i];if(pos.x<b.minX-EPS||pos.x>b.maxX+EPS||pos.z<b.minZ-EPS||pos.z>b.maxZ+EPS||b.minY>limit+EPS)continue;top=Math.max(top,surfaceY(b,pos.x,pos.z,true,limit));}
    return top;
  }
  function ceiling(pos,limit){
    var low=Infinity,list=nearby(pos.x,pos.z,0);
    for(var i=0;i<list.length;i++){var b=list[i];if(pos.x<b.minX-EPS||pos.x>b.maxX+EPS||pos.z<b.minZ-EPS||pos.z>b.maxZ+EPS||b.maxY<limit-EPS)continue;low=Math.min(low,surfaceY(b,pos.x,pos.z,false,limit));}return low;
  }
  function collide(pos,radius){
    if(pos.pos)pos=pos.pos;if(!Number.isFinite(pos.x)||!Number.isFinite(pos.y))return;
    radius=radius||1;pos.x=Math.max(D.bounds.min[0]+radius,Math.min(D.bounds.max[0]-radius,pos.x));pos.z=Math.max(D.bounds.min[2]+radius,Math.min(D.bounds.max[2]-radius,pos.z));
    var list=nearby(pos.x,pos.z,radius+1),sample=[radius,HEIGHT/2,HEIGHT-radius];
    for(var pass=0;pass<3;pass++)for(var i=0;i<list.length;i++){
      var b=list[i];if(b.maxY<=pos.y+STEP+EPS||b.minY>=pos.y+HEIGHT-EPS||pos.x+radius<b.minX||pos.x-radius>b.maxX||pos.z+radius<b.minZ||pos.z-radius>b.maxZ)continue;
      for(var k=0;k<sample.length;k++){
        var dx=pos.x-b.x,dy=pos.y+sample[k]-b.y,dz=pos.z-b.z;
        var l=[dx*b.r[0]+dy*b.r[3]+dz*b.r[6],dx*b.r[1]+dy*b.r[4]+dz*b.r[7],dx*b.r[2]+dy*b.r[5]+dz*b.r[8]],delta=[];
        for(var a=0;a<3;a++)delta[a]=l[a]-Math.max(-b.h[a],Math.min(b.h[a],l[a]));
        var q=delta[0]*delta[0]+delta[1]*delta[1]+delta[2]*delta[2];if(q>=radius*radius)continue;
        if(q<1e-10){var axis=-1,depth=Infinity;for(a=0;a<3;a++)if(Math.abs(b.r[3+a])<.55&&b.h[a]-Math.abs(l[a])<depth){axis=a;depth=b.h[a]-Math.abs(l[a]);}if(axis<0)continue;delta=[0,0,0];delta[axis]=(l[axis]>=0?1:-1)*(depth+radius+EPS);}
        else {var length=Math.sqrt(q),amount=(radius-length+EPS)/length;for(a=0;a<3;a++)delta[a]*=amount;}
        var wx=b.r[0]*delta[0]+b.r[1]*delta[1]+b.r[2]*delta[2],wy=b.r[3]*delta[0]+b.r[4]*delta[1]+b.r[5]*delta[2],wz=b.r[6]*delta[0]+b.r[7]*delta[1]+b.r[8]*delta[2];
        if(Math.abs(wy)>Math.hypot(wx,wz))continue;pos.x+=wx;pos.z+=wz;
      }
    }
  }
  function spawn(index){
    var n=index==null?Math.floor(Math.random()*D.spawns.length):Math.abs(index)%D.spawns.length,s=D.spawns[n],p={x:s.cf[0]-D.origin[0],y:s.cf[1]-D.origin[1],z:s.cf[2]-D.origin[2]};
    var y=floor(p,p.y+2);p.y=Number.isFinite(y)?y:p.y;return p;
  }
  // Broad phase samples the segment's spatial cells; the slab test uses the
  // original oriented part, for camera obstruction and fast movement.
  function ray(from,to,radius){
    var dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,length=Math.hypot(dx,dy,dz),seen=new Set(),hit=1;
    var n=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/(CELL/2)));
    for(var s=0;s<=n;s++){
      var list=nearby(from.x+dx*s/n,from.z+dz*s/n,radius||0);
      for(var i=0;i<list.length;i++){
        var b=list[i];if(seen.has(b.id))continue;seen.add(b.id);
        var o=[from.x-b.x,from.y-b.y,from.z-b.z],v=[dx,dy,dz],near=0,far=hit,inside=true;
        for(var a=0;a<3;a++){
          var origin=o[0]*b.r[a]+o[1]*b.r[3+a]+o[2]*b.r[6+a],dir=v[0]*b.r[a]+v[1]*b.r[3+a]+v[2]*b.r[6+a],h=b.h[a]+(radius||0);
          if(Math.abs(origin)>h)inside=false;
          if(Math.abs(dir)<1e-9){if(Math.abs(origin)>h){near=Infinity;break;}}
          else{var t1=(-h-origin)/dir,t2=(h-origin)/dir;near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2));}
        }
        if(!inside&&near<=far&&near>=0&&near<hit)hit=near;
      }
    }return Math.max(0,hit-(length>0?.1/length:0));
  }
  J.transform=transform;
  J.originals=originals;
  J.setFragments=function(id,list){
    var old=fragments.get(id)||[];
    old.forEach(function(b){b.cells.forEach(function(k){var a=buckets.get(k),i=a.indexOf(b);if(i>=0)a.splice(i,1);});});fragments.delete(id);
    var original=originals.get(id);if(!original)return;original.disabled=!!list;
    if(!list)return;
    var source=D.parts[id],out=[];
    list.forEach(function(f,i){var p=source.slice(),c=[(f[0]+f[3])/2,(f[1]+f[4])/2,(f[2]+f[5])/2];
      for(var a=0;a<3;a++){p[a]+=source[3+a*3]*c[0]+source[4+a*3]*c[1]+source[5+a*3]*c[2];p[12+a]=f[a+3]-f[a];}
      out.push(addBox(p,id+':'+i));
    });fragments.set(id,out);
  };
  J.audit=function(){return {parts:D.parts.length,colliders:boxes.length,drawGroups:J.drawGroups,spawns:D.spawns.length,scale:D.scale,origin:D.origin,visualExport:D.visual?D.visual.source:null,exportedTextures:D.visual?Object.keys(D.visual.textures).length:0,customMeshTriangles:D.visual?D.visual.meshTriangles:0,customMeshes:D.meshes.length};};
})();
