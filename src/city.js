import * as THREE from 'three';
import { R, TAU, hash2, hexRGB, jit, makeCanvas, outline, paint, pick, pixTex, rand, repTex, shadeHex } from './utils.js';
import { scene } from './renderer.js';
import { barkMat, brickCanvas, checkerC, flowerTopC, glowTex, hedgeC, leafCanvas, metalMat, plasterCanvas, roofCanvas, stoneMat, stripeC, woodMat } from './textures.js';
import { COURT, GW, GX0 } from './ground.js';
import { makeWater } from './shaders.js';
import { addLampLight, lamps, litByLamps } from './lights.js';

/* =====================================================================
   6. City & park construction
   ===================================================================== */
export const buildings=[];
const WINDOW_LIT=['#ffd27a','#ffbf66','#ffe1a6','#ffc98a'];
function drawWindow(g,ge,x,y,w,h,o,r){
  if(o.shutters){R(g,x-5,y-1,3,h+2,o.shutters);R(g,x+w+2,y-1,3,h+2,o.shutters);}
  R(g,x-1,y-1,w+2,h+2,o.frame);R(g,x,y,w,h,'#2d4a5c');R(g,x+1,y+1,2,h-2,'#3f6479');R(g,x+w-4,y+1,2,3,'#7aa3b8');
  R(g,x+(w>>1),y,1,h,o.frame);R(g,x,y+(h>>1)-1,w,1,o.frame);
  R(g,x-2,y+h+1,w+4,2,shadeHex(o.frame,.82));
  if(r<.28){R(g,x-1,y+h+3,w+2,2,'#7a4f33');for(let i=0;i<w;i+=2)R(g,x+i,y+h+2,1,1,pick(['#f05a6e','#f6c84f','#ff9ec0','#4f8f3c']));}
  if(r>.3){const col=r>.93?'#9ec9ff':WINDOW_LIT[Math.floor(r*40)%4];ge.fillStyle=col;ge.fillRect(x,y,w,h);
    ge.fillStyle='#000';ge.fillRect(x+(w>>1),y,1,h);ge.fillRect(x,y+(h>>1)-1,w,1);
    if(r>.55&&r<.75){ge.fillStyle='#5a2e1a';ge.fillRect(x,y,3,h);}}
}
function makeFacade(w,h,o){
  const P=16,cw=Math.round(w*P),ch=Math.round(h*P),base=hexRGB(o.wall),mort=jit(base,-30);
  const c=paint(cw,ch,(x,y)=>{if(o.brick){const row=y>>2,off=(row&1)*4;if(y%4===3||(x+off)%8===7)return mort;
      return jit(base,Math.round((hash2((x+off)>>3,row+o.seed)-.5)*22));}
    return jit(base,Math.round((hash2((x>>1)+o.seed,y>>1)-.5)*10));});
  const g=c.getContext('2d'),e=makeCanvas(cw,ch),ge=e.getContext('2d');ge.fillStyle='#000';ge.fillRect(0,0,cw,ch);
  R(g,0,0,cw,3,o.trim);R(g,0,3,cw,1,shadeHex(o.trim,.7));
  const gf=48;R(g,0,ch-gf-2,cw,2,o.trim);
  const cols=Math.max(1,Math.round(w/2.3)),colW=cw/cols,floorH=Math.round(2.6*P),nF=Math.max(1,Math.floor((ch-gf-8)/floorH));
  for(let f=0;f<nF;f++){const wy=ch-gf-2-(f+1)*floorH+9;for(let i=0;i<cols;i++)drawWindow(g,ge,Math.round(i*colW+colW/2-6),wy,12,20,o,hash2(i+o.seed*7,f+3+o.seed));}
  if(o.shop){ // café shop front: big warm windows
    R(g,4,ch-40,cw-8,34,'#2a201c');
    for(let x=6;x<cw-6;x+=22){R(g,x,ch-38,18,26,'#5a3a26');R(g,x+1,ch-37,16,24,'#e9b874');R(g,x+2,ch-30,14,2,'#7a4a2a');R(g,x+4,ch-36,2,4,'#fff1c4');R(g,x+12,ch-36,2,4,'#fff1c4');
      ge.fillStyle='#ffb35c';ge.fillRect(x+1,ch-37,16,24);}
    const dx=Math.round(cw/2)-8;R(g,dx,ch-38,16,38,'#3d2a1f');R(g,dx+2,ch-36,12,18,'#e9b874');ge.fillStyle='#ffb35c';ge.fillRect(dx+2,ch-36,12,18);
  }else{
    const di=Math.floor(hash2(o.seed,9)*cols);
    for(let i=0;i<cols;i++){const cx=Math.round(i*colW+colW/2);
      if(i===di){R(g,cx-8,ch-36,16,36,o.trim);R(g,cx-6,ch-33,12,33,o.door);R(g,cx-5,ch-31,4,10,shadeHex(o.door,1.2));R(g,cx+1,ch-31,4,10,shadeHex(o.door,1.2));
        R(g,cx+3,ch-17,1,2,'#e8c547');R(g,cx-5,ch-37,10,3,'#ffe1a6');ge.fillStyle='#ffd27a';ge.fillRect(cx-5,ch-37,10,3);R(g,cx-9,ch-2,18,2,'#9a958d');}
      else drawWindow(g,ge,cx-7,ch-gf+12,14,22,o,hash2(i,o.seed+40));}
  }
  return {map:pixTex(c),emi:pixTex(e)};
}
const HOUSES=[
  {wall:'#b5583f',trim:'#efe6d2',frame:'#f4efe4',roof:'#5b4a5e',brick:true,door:'#2f5d50'},
  {wall:'#d8c7a0',trim:'#fff8e6',frame:'#ffffff',roof:'#8a4a3a',door:'#7a3a3a',shutters:'#5b8f7a'},
  {wall:'#7c9a8a',trim:'#efe6d2',frame:'#f3ede0',roof:'#3e4a5c',door:'#c9894a'},
  {wall:'#9b4a3c',trim:'#e8dcc4',frame:'#efe7d6',roof:'#463a42',brick:true,door:'#29405e'},
  {wall:'#e6b98a',trim:'#fff3dd',frame:'#ffffff',roof:'#5a6e8a',door:'#3d6b4f',shutters:'#c75b4a'},
  {wall:'#5f6e8c',trim:'#e9e2d2',frame:'#f0ead8',roof:'#2e3442',door:'#d9a441'},
  {wall:'#c66e52',trim:'#f2e6cf',frame:'#f6efe2',roof:'#4b3f3a',brick:true,door:'#365f73'},
];
function addBuilding(cx,cz,w,d,h,o,rotY=0){
  const grp=new THREE.Group();grp.position.set(cx,0,cz);grp.rotation.y=rotY;
  const fac=makeFacade(w,h,o);
  const sideC=o.brick?brickCanvas(o.wall,o.seed):plasterCanvas(o.wall,o.seed);
  const front=new THREE.MeshStandardMaterial({map:fac.map,emissiveMap:fac.emi,emissive:'#ffffff',emissiveIntensity:0,roughness:.9});
  const side=new THREE.MeshStandardMaterial({map:repTex(sideC,d/2,h/2),roughness:.95});
  const sideB=new THREE.MeshStandardMaterial({map:repTex(sideC,w/2,h/2),roughness:.95});
  const top=new THREE.MeshStandardMaterial({color:shadeHex(o.roof,.9),roughness:1});
  const box=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),[side,side,top,top,front,sideB]);
  box.position.y=h/2;box.castShadow=box.receiveShadow=true;grp.add(box);
  const roofMat=new THREE.MeshStandardMaterial({map:pixTex(roofCanvas(o.roof),true),roughness:.85});
  if(o.flat){
    const cor=new THREE.Mesh(new THREE.BoxGeometry(w+.3,.35,d+.3),new THREE.MeshStandardMaterial({color:o.trim,roughness:.9}));cor.position.y=h+.1;cor.castShadow=true;grp.add(cor);
  }else{
    const rh=Math.min(2.4,d*.38),sh=new THREE.Shape();sh.moveTo(-d/2-.25,0);sh.lineTo(d/2+.25,0);sh.lineTo(0,rh);sh.lineTo(-d/2-.25,0);
    const rg=new THREE.ExtrudeGeometry(sh,{depth:w+.2,bevelEnabled:false});rg.rotateY(Math.PI/2);rg.translate(-(w+.2)/2,0,0);
    const roof=new THREE.Mesh(rg,roofMat);roof.position.y=h;roof.castShadow=roof.receiveShadow=true;grp.add(roof);
  }
  if(hash2(o.seed,77)>.35){const ch=new THREE.Mesh(new THREE.BoxGeometry(.45,1.3,.45),side);ch.position.set((hash2(o.seed,5)-.5)*(w-1.2),h+.9,-d*.18);ch.castShadow=true;grp.add(ch);}
  scene.add(grp);
  buildings.push({mat:front,k:rand(.85,1.25),th:rand(.3,.5),shop:!!o.shop});
  return grp;
}
// North row (faces the park across the avenue)
{
  const segs=[[-36,-31.5],[-31.5,-27],[-27,-24],[-24,-19.5],[-19.5,-14.5],[-14.5,-10],[-10,-5],[-5,-.5],[-.5,6],[6,14,'cafe'],[14,18.5],[18.5,24],[24,28.5],[28.5,32],[32,36]];
  const heights=[7.4,8.6,6.4,8.2,6.6,9.4,7.2,8.8,6.2,0,7.6,9,6.8,8.4,7];
  segs.forEach(([a,b,kind],i)=>{
    if(kind==='cafe')return;
    addBuilding((a+b)/2,-23,b-a,6,heights[i],{...HOUSES[i%HOUSES.length],seed:i+1,flat:i%3===2});
  });
  // Skyline row behind the avenue houses
  [[-36,-28],[-28,-21],[-21,-13],[-13,-6],[-6,2],[2,9],[9,17],[17,25],[25,31],[31,36]].forEach(([a,b],i)=>
    addBuilding((a+b)/2,-30.5,b-a,6,[11,12.5,10.4,13,11.6,10.8,12.2,11,12.8,10.6][i],{...HOUSES[(i+2)%HOUSES.length],seed:40+i,flat:i%3!==1}));
  // West row (faces east onto the pedestrian street)
  [[-8,-3.5],[-3.5,1],[1,5],[5,8]].forEach(([a,b],i)=>
    addBuilding(-20.25,(a+b)/2,b-a,7.5,[5.6,5,6,5.2][i],{...HOUSES[(i+3)%HOUSES.length],seed:20+i,flat:i%2===1},Math.PI/2));
  // Far-west row facing the market square
  [[-8,-4],[-4,.5],[.5,4.5],[4.5,8]].forEach(([a,b],i)=>
    addBuilding(-33.5,(a+b)/2,b-a,5,[7,8.2,6.6,7.6][i],{...HOUSES[(i+5)%HOUSES.length],seed:30+i,flat:i%2===0},Math.PI/2));
}
// Café with a striped awning terrace
export const SHELTERS=[];
function textCanvas(w,h,bg,fg,text,size){const c=makeCanvas(w,h),g=c.getContext('2d');g.fillStyle=bg;g.fillRect(0,0,w,h);
  g.fillStyle=fg;g.font=`bold ${size}px ui-monospace,Menlo,monospace`;g.textAlign='center';g.textBaseline='middle';g.fillText(text,w/2,h/2+1);return c;}
{
  const o={wall:'#3f6b57',trim:'#f2e6cf',frame:'#f6efe2',roof:'#2e3a33',door:'#3d2a1f',seed:99,shop:true,flat:true};
  addBuilding(10,-23,8,6,6.4,o);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.2,.8),new THREE.MeshStandardMaterial({map:pixTex(outline(textCanvas(48,12,'#2b2219','#ffe1a6','CAFÉ ☕',9),[20,14,10])),emissive:'#ffcf8a',emissiveIntensity:.2}));
  sign.position.set(10,3.45,-19.98);scene.add(sign);buildings.push({mat:sign.material,k:1.4,th:.6});
  const awn=new THREE.Mesh(new THREE.PlaneGeometry(8,2.5),new THREE.MeshStandardMaterial({map:repTex(stripeC('#c8483e','#f3ead8'),8,1),side:THREE.DoubleSide,roughness:.9}));
  awn.rotation.x=-Math.PI/2+.42;awn.position.set(10,2.65,-18.85);awn.castShadow=true;awn.receiveShadow=true;scene.add(awn);
  const val=new THREE.Mesh(new THREE.PlaneGeometry(8,.3),awn.material);val.position.set(10,2.05,-17.7);scene.add(val);
  for(const tx of [7.4,10,12.6]){
    const top=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.06,12),new THREE.MeshStandardMaterial({color:'#f2ede2',roughness:.6}));top.position.set(tx,.72,-18.9);top.castShadow=true;scene.add(top);
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.72,6),metalMat);leg.position.set(tx,.36,-18.9);scene.add(leg);
    const cup=new THREE.Mesh(new THREE.CylinderGeometry(.06,.05,.1,8),new THREE.MeshStandardMaterial({color:'#ffffff'}));cup.position.set(tx+.12,.8,-18.85);scene.add(cup);
    for(const sx of [-.62,.62]){const ch=new THREE.Mesh(new THREE.BoxGeometry(.36,.06,.36),woodMat);ch.position.set(tx+sx,.45,-18.9);ch.castShadow=true;scene.add(ch);
      const bk=new THREE.Mesh(new THREE.BoxGeometry(.06,.45,.36),woodMat);bk.position.set(tx+sx*1.25,.68,-18.9);scene.add(bk);}
  }
  const planter=(x)=>{const p=new THREE.Mesh(new THREE.BoxGeometry(.7,.5,.5),woodMat);p.position.set(x,.25,-19.6);scene.add(p);
    const b=new THREE.Mesh(new THREE.IcosahedronGeometry(.42,0),new THREE.MeshStandardMaterial({map:pixTex(flowerTopC,true),flatShading:true}));b.position.set(x,.7,-19.6);scene.add(b);};
  planter(6.4);planter(13.6);
  SHELTERS.push({id:'cafe',label:'Waiting out the rain under the café awning',node:'F6',
    spots:[6.6,7.9,8.7,10.6,11.3,12.1,13.3].map((x,i)=>({x,z:i%2?-19.55:-18.25,fx:x,fz:-12}))});
}
// Lamps
function addLamp(x,z,light=true){
  const g=new THREE.Group();g.position.set(x,0,z);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.05,.08,2.6,6),metalMat);pole.position.y=1.3;pole.castShadow=true;g.add(pole);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.14,.18,.25,6),metalMat);base.position.y=.12;g.add(base);
  const glassMat=new THREE.MeshStandardMaterial({color:'#fff3d0',emissive:'#ffc46e',emissiveIntensity:0,roughness:.3});
  const head=new THREE.Mesh(new THREE.BoxGeometry(.3,.38,.3),glassMat);head.position.y=2.78;g.add(head);
  const cap=new THREE.Mesh(new THREE.ConeGeometry(.28,.22,4),metalMat);cap.position.y=3.08;cap.rotation.y=Math.PI/4;g.add(cap);
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:'#ffc477',blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:0,fog:false}));
  halo.position.y=2.78;halo.scale.set(3.2,3.2,1);g.add(halo);
  scene.add(g);lamps.push({glassMat,halo,light:light?addLampLight(x,2.6,z,10,1.6,'#ffc47a'):null,level:0,th:rand(.3,.46),flaky:Math.random()<.15,flick:1});
}
for(const a of [45,135,225,315]){const r=5.4,t=a*Math.PI/180;addLamp(Math.cos(t)*r,Math.sin(t)*r,true);}
for(const x of [-10,10])addLamp(x,-9.35,true);
for(const x of [-30,-16,-2,18,30])addLamp(x,-16.95,x===-2||x===18);
for(const x of [-30,-18,-9,0,9,18,30])addLamp(x,9.75,x===-9||x===9);
for(const x of [-22,22,30])addLamp(x,-9.35,false);
addLamp(-25,-3.5,true);addLamp(24.8,3.2,false);
for(const z of [-3,5])addLamp(-13.45,z,false);
for(const x of [-30,-16,4,16,28])addLamp(x,17.2,false);
addLamp(21,-1,false);
// Benches
function addBench(x,z,faceAngle){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=faceAngle;
  const seat=new THREE.Mesh(new THREE.BoxGeometry(1.6,.08,.46),woodMat);seat.position.set(0,.45,0);seat.castShadow=seat.receiveShadow=true;g.add(seat);
  const back=new THREE.Mesh(new THREE.BoxGeometry(1.6,.36,.06),woodMat);back.position.set(0,.78,-.22);back.rotation.x=-.12;back.castShadow=true;g.add(back);
  for(const lx of [-.7,.7]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.07,.45,.42),metalMat);leg.position.set(lx,.22,0);leg.castShadow=true;g.add(leg);}
  scene.add(g);
  const c=Math.cos(faceAngle),s=Math.sin(faceAngle),fx=Math.sin(faceAngle),fz=Math.cos(faceAngle);
  return [-.4,.4].map(lx=>({x:x+lx*c-.02*fx,z:z-lx*s-.02*fz,fx:x+lx*c+fx*3,fz:z-lx*s+fz*3}));
}
export const fountainSeats=[];
for(const a of [45,135,225,315]){const t=a*Math.PI/180,x=Math.cos(t)*4.35,z=Math.sin(t)*4.35;fountainSeats.push(...addBench(x,z,Math.atan2(-x,-z)));}
export const canalSeats=[...addBench(-12,9.45,0),...addBench(12,9.45,0)];
// Trees
const LEAF={round:leafCanvas(['#3f7d3a','#4f9444','#5fa64c','#78bb5a']),cherry:leafCanvas(['#e48aa8','#f0a4bd','#f7c1d2','#d97497']),
  autumn:leafCanvas(['#d9622b','#e9873a','#f2b34c','#b84a28']),pine:leafCanvas(['#25553a','#2f6a45','#3b7c50','#1f4a33'])};
const leafMats=Object.fromEntries(Object.entries(LEAF).map(([k,c])=>[k,new THREE.MeshStandardMaterial({map:pixTex(c,true),flatShading:true,roughness:1})]));
export const trees=[];
function addTree(x,z,type='round',s=1){
  const g=new THREE.Group();g.position.set(x,0,z);
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.11*s,.17*s,1.5*s,6),barkMat);trunk.position.y=.75*s;trunk.castShadow=true;g.add(trunk);
  const crown=new THREE.Group();crown.position.y=1.4*s;g.add(crown);
  if(type==='pine'){for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.ConeGeometry((1.1-i*.28)*s,1.25*s,7),leafMats.pine);m.position.y=(.3+i*.65)*s;m.castShadow=true;m.receiveShadow=true;crown.add(m);}}
  else for(const [bx,by,bz,r] of [[0,.6,0,1.05],[.55,.35,.2,.75],[-.5,.4,-.15,.8],[.05,1.15,-.05,.72]]){
    const m=new THREE.Mesh(new THREE.IcosahedronGeometry(r*s,1),leafMats[type]);m.position.set(bx*s,by*s,bz*s);m.rotation.set(rand(0,3),rand(0,3),0);
    m.castShadow=m.receiveShadow=true;crown.add(m);}
  scene.add(g);trees.push({crown,ph:rand(0,TAU),s,x,z,type});
}
export const PARK_TREES=[[-8.6,-3.3,'round',1.15],[-5.4,-4.5,'cherry',.95],[4.3,-4.6,'cherry',1],[9.9,-1.9,'round',1],[-9.3,3.9,'autumn',1.05],[9.4,1.95,'autumn',.9],
  [-11.9,-6.9,'round',1],[11.9,-6.9,'pine',1],[-11.9,6.9,'pine',.95],[11.9,6.9,'cherry',1]];
PARK_TREES.forEach(t=>addTree(...t));
[[-20,-17.4,'round',.9],[-9,-17.1,'round',.85],[1.5,-17.1,'cherry',.8],[16.5,-17.2,'round',.85],[22,-17.3,'autumn',.85],
 [20.2,-3.4,'round',.95],[21.6,5.2,'cherry',.95],[16.6,5.8,'autumn',.8],[-15.2,-6,'round',.75],[-15.1,6.5,'autumn',.7],
 [-32,20.5,'round',.9],[-24,22.5,'cherry',.9],[-19,20.2,'round',.85],[-8,22.6,'autumn',.85],[4,20.4,'round',.9],[22,22.4,'cherry',.9],
 [30,20.6,'pine',.9],[34,22.6,'round',.85],[-25.2,7,'autumn',.75],[-25.2,-7,'round',.75],[35.2,-4,'round',.9],[35,1,'pine',.85],[26.2,7.2,'cherry',.8]].forEach(t=>addTree(...t));
// Hedges around the park (with entrance gaps)
function hedge(x0,z0,x1,z1){const len=Math.hypot(x1-x0,z1-z0);
  const m=new THREE.Mesh(new THREE.BoxGeometry(len,.7,.55),new THREE.MeshStandardMaterial({map:repTex(hedgeC,len/2,.5),roughness:1}));
  m.position.set((x0+x1)/2,.35,(z0+z1)/2);m.rotation.y=-Math.atan2(z1-z0,x1-x0);m.castShadow=m.receiveShadow=true;scene.add(m);}
hedge(-13,-7.72,-7.2,-7.72);hedge(-4.8,-7.72,4.8,-7.72);hedge(7.2,-7.72,13,-7.72);
hedge(-13,7.72,-1.2,7.72);hedge(1.2,7.72,13,7.72);
hedge(-12.72,-7.72,-12.72,-1.2);hedge(-12.72,1.2,-12.72,7.72);hedge(12.72,-7.72,12.72,-1.2);hedge(12.72,1.2,12.72,7.72);
// Flowerbeds
function flowerbed(x,z,w,d){const top=new THREE.MeshStandardMaterial({map:repTex(flowerTopC,w,d),roughness:1});
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,.32,d),[stoneMat,stoneMat,top,stoneMat,stoneMat,stoneMat]);m.position.set(x,.16,z);m.castShadow=m.receiveShadow=true;scene.add(m);}
flowerbed(-2.7,5.1,1.7,.9);flowerbed(2.7,5.1,1.7,.9);flowerbed(-3.2,-6.95,2.2,.6);flowerbed(3.2,-6.95,2.2,.6);flowerbed(16.2,-1.2,1.4,1.4);
// Picnic blankets
function blanket(x,z,rot,a,b){const top=new THREE.MeshStandardMaterial({map:repTex(checkerC(a,b),1.5,1),roughness:1});
  const m=new THREE.Mesh(new THREE.BoxGeometry(1.9,.04,1.4),top);m.position.set(x,.02,z);m.rotation.y=rot;m.receiveShadow=true;scene.add(m);
  const bask=new THREE.Mesh(new THREE.BoxGeometry(.42,.26,.3),new THREE.MeshStandardMaterial({color:'#c79a5a',roughness:1}));bask.position.set(x+.55,.15,z-.4);bask.castShadow=true;scene.add(bask);
  const hdl=new THREE.Mesh(new THREE.TorusGeometry(.15,.025,4,10,Math.PI),bask.material);hdl.position.set(x+.55,.28,z-.4);scene.add(hdl);}
blanket(-6.4,3.25,.15,'#d24b4b','#f3ead8');blanket(5.8,3.35,-.2,'#4b7bd2','#f3ead8');
// Fountain
export let fountainLight;
{
  const basin=new THREE.Mesh(new THREE.CylinderGeometry(2.3,2.42,.5,28,1,true),stoneMat);basin.position.y=.25;basin.castShadow=true;basin.receiveShadow=true;scene.add(basin);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(2.3,.13,4,28),stoneMat);rim.rotation.x=-Math.PI/2;rim.position.y=.5;scene.add(rim);
  const water=new THREE.Mesh(new THREE.CircleGeometry(2.25,28).rotateX(-Math.PI/2),makeWater({deep:'#2a6d86',shallow:'#5fb0c4',glow:1}));water.position.y=.4;scene.add(water);
  const ped=new THREE.Mesh(new THREE.CylinderGeometry(.3,.45,1.05,10),stoneMat);ped.position.y=.9;ped.castShadow=true;scene.add(ped);
  const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.95,.45,.28,16),stoneMat);bowl.position.y=1.48;bowl.castShadow=true;scene.add(bowl);
  const bw=new THREE.Mesh(new THREE.CircleGeometry(.88,16).rotateX(-Math.PI/2),makeWater({deep:'#2a6d86',shallow:'#6fc0d4',glow:1}));bw.position.y=1.6;scene.add(bw);
  const sp=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,.4,6),stoneMat);sp.position.y=1.8;scene.add(sp);
  fountainLight=addLampLight(0,1.2,0,8,1.5,'#bfe6ff');
}
// Pond with lily pads and reeds
{
  const g=new THREE.Group();g.position.set(7.4,0,-3.2);
  const w=new THREE.Mesh(new THREE.CircleGeometry(1,28).rotateX(-Math.PI/2),makeWater({deep:'#24584f',shallow:'#4f9a86'}));w.scale.set(2.05,1,1.3);w.position.y=.04;g.add(w);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(1,.09,4,28),stoneMat);rim.rotation.x=-Math.PI/2;rim.scale.set(2.12,1.36,1);rim.position.y=.06;g.add(rim);
  const pad=new THREE.MeshStandardMaterial({color:'#4f9a3e',roughness:.8});
  for(const [px,pz] of [[-.8,.3],[.5,-.5],[1.1,.4],[-.2,.7]]){const p=new THREE.Mesh(new THREE.CircleGeometry(.18,8).rotateX(-Math.PI/2),pad);p.position.set(px,.06,pz);g.add(p);}
  const reed=new THREE.MeshStandardMaterial({color:'#3d6b34'});
  for(let i=0;i<9;i++){const a=rand(2.2,4.2),r=new THREE.Mesh(new THREE.BoxGeometry(.04,rand(.4,.8),.04),reed);r.position.set(Math.cos(a)*1.95,.3,Math.sin(a)*1.2);r.rotation.z=rand(-.2,.2);g.add(r);}
  scene.add(g);
}
// Canal, quay walls, railing, moored boat
export let boat;
{
  const water=new THREE.Mesh(new THREE.PlaneGeometry(GW,4.5).rotateX(-Math.PI/2),makeWater({deep:'#1d4e66',shallow:'#3b8aa3',flow:[.25,0]}));water.position.set(0,.03,12.25);scene.add(water);
  for(const z of [10.1,14.4]){const c=new THREE.Mesh(new THREE.BoxGeometry(GW,.24,.32),stoneMat);c.position.set(0,.12,z);c.castShadow=c.receiveShadow=true;scene.add(c);}
  const railMat=metalMat;
  for(const [x0,x1] of [[GX0,-5.3],[-2.7,GX0+GW]]){const rail=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,.05,.05),railMat);rail.position.set((x0+x1)/2,.85,10.02);scene.add(rail);}
  for(let x=GX0+.5;x<=GX0+GW-.5;x+=1.5){if(Math.abs(x+4)<1.4)continue;const p=new THREE.Mesh(new THREE.BoxGeometry(.05,.65,.05),railMat);p.position.set(x,.55,10.02);scene.add(p);}
  boat=new THREE.Group();
  const hull=new THREE.Mesh(new THREE.BoxGeometry(2.4,.32,.9),new THREE.MeshStandardMaterial({color:'#2f5d73',roughness:.8}));hull.position.y=.12;hull.castShadow=true;boat.add(hull);
  const trim=new THREE.Mesh(new THREE.BoxGeometry(2.45,.08,.95),new THREE.MeshStandardMaterial({color:'#f2e6cf'}));trim.position.y=.3;boat.add(trim);
  const bow=new THREE.Mesh(new THREE.ConeGeometry(.45,.6,4),hull.material);bow.rotation.z=-Math.PI/2;bow.rotation.x=Math.PI/4;bow.scale.set(1,1,.7);bow.position.set(1.45,.14,0);boat.add(bow);
  const seat=new THREE.Mesh(new THREE.BoxGeometry(.3,.06,.8),woodMat);seat.position.y=.3;boat.add(seat);
  boat.position.set(8,.05,13.3);scene.add(boat);
}
// Bus stops: one on the park-side sidewalk (eastbound), one on the avenue sidewalk (westbound)
export const BUS_STOPS=[];
function addBusStop(x,z,node,north){
  const rot=north?Math.PI:0,s=north?-1:1;
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;
  for(const [px,pz] of [[-1.6,-.8],[1.6,-.8],[-1.6,.8],[1.6,.8]]){const p=new THREE.Mesh(new THREE.BoxGeometry(.08,2.3,.08),metalMat);p.position.set(px,1.15,pz);p.castShadow=true;g.add(p);}
  const roof=new THREE.Mesh(new THREE.BoxGeometry(3.5,.12,1.9),new THREE.MeshStandardMaterial({color:'#36424a',roughness:.6}));roof.position.y=2.33;roof.castShadow=true;g.add(roof);
  const glass=new THREE.Mesh(new THREE.BoxGeometry(3.2,1.7,.04),new THREE.MeshStandardMaterial({color:'#9fd0e0',transparent:true,opacity:.28,roughness:.1}));glass.position.set(0,1.25,.8);g.add(glass);
  const ad=new THREE.Mesh(new THREE.BoxGeometry(.05,1.4,1.3),new THREE.MeshStandardMaterial({map:pixTex(paint(8,12,(x,y)=>y<4?[240,180,110]:y<8?[143,214,196]:[245,236,220])),emissive:'#ffffff',emissiveIntensity:.15}));
  ad.position.set(1.62,1.15,0);g.add(ad);buildings.push({mat:ad.material,k:.9,th:.6});
  const bench=new THREE.Mesh(new THREE.BoxGeometry(2.4,.08,.4),woodMat);bench.position.set(0,.45,.5);g.add(bench);
  scene.add(g);
  const poleX=x-2.1*s,poleZ=z-.85*s;
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,2.4,6),metalMat);pole.position.set(poleX,1.2,poleZ);scene.add(pole);
  const sg=new THREE.Mesh(new THREE.CircleGeometry(.32,12),new THREE.MeshStandardMaterial({map:pixTex(outline(textCanvas(16,16,'#2f6bd8','#ffffff','BUS',6))),side:THREE.DoubleSide}));
  sg.position.set(poleX,2.35,poleZ);scene.add(sg);
  SHELTERS.push({id:node,label:'Huddled at the bus stop until the rain eases',node,
    spots:[[-1.1,.45],[-.4,.5],[.35,.45],[1.05,.5],[-.8,-.2],[.6,-.25]].map(([dx,dz])=>({x:x+dx*s,z:z+dz*s,fx:x+dx*s,fz:z-5.5*s}))});
  BUS_STOPS.push({x,z,node,poleX,poleZ});
}
addBusStop(17.3,-8.45,'BUS',false);
addBusStop(-13.5,-19.05,'BUSN',true);
// Bike racks + parked bikes
export const staticBillboards=[];
function addRack(x,z){const r=new THREE.Mesh(new THREE.TorusGeometry(.32,.03,4,12,Math.PI),new THREE.MeshStandardMaterial({color:'#9aa3ad',metalness:.6,roughness:.4}));
  r.position.set(x,0,z);r.rotation.y=Math.PI/2;r.castShadow=true;scene.add(r);}
for(const z of [-5.4,-4.6,-3.8,-3])addRack(14.4,z);
// Canal footbridge (pedestrians walk over it via groundY)
const BRIDGE={x0:-5.1,x1:-2.9,z0:8.6,z1:16,top:.75,ramp:1.4};
export function groundY(x,z){
  if(x<BRIDGE.x0||x>BRIDGE.x1||z<BRIDGE.z0||z>BRIDGE.z1)return 0;
  return BRIDGE.top*Math.min(1,(z-BRIDGE.z0)/BRIDGE.ramp,(BRIDGE.z1-z)/BRIDGE.ramp);
}
{
  const deck=new THREE.Mesh(new THREE.BoxGeometry(2.2,.2,4.6),woodMat);deck.position.set(-4,.65,12.3);deck.castShadow=deck.receiveShadow=true;scene.add(deck);
  const rl=Math.hypot(BRIDGE.ramp,BRIDGE.top),ra=Math.atan2(BRIDGE.top,BRIDGE.ramp);
  for(const [zc,sgn] of [[BRIDGE.z0+BRIDGE.ramp/2,-1],[BRIDGE.z1-BRIDGE.ramp/2,1]]){
    const r=new THREE.Mesh(new THREE.BoxGeometry(2.2,.2,rl),woodMat);r.position.set(-4,BRIDGE.top/2-.1,zc);r.rotation.x=sgn*ra;r.castShadow=r.receiveShadow=true;scene.add(r);}
  for(const ax of [-5.05,-2.95]){
    const arch=new THREE.Mesh(new THREE.TorusGeometry(2.3,.2,6,18,Math.PI),stoneMat);arch.rotation.y=Math.PI/2;arch.position.set(ax,-1.72,12.3);arch.castShadow=true;scene.add(arch);
    const rail=new THREE.Mesh(new THREE.BoxGeometry(.06,.06,4.6),metalMat);rail.position.set(ax,1.3,12.3);scene.add(rail);
    for(let z=10.1;z<=14.6;z+=.9){const p=new THREE.Mesh(new THREE.BoxGeometry(.06,.55,.06),metalMat);p.position.set(ax,1.02,z);scene.add(p);}}
}
// South bank: benches facing the canal, a gazebo and a picnic
export const southSeats=[-18,-9,8,20].flatMap(x=>addBench(x,16.9,Math.PI));
{
  const g=new THREE.Group();g.position.set(12,0,21.2);
  const floor=new THREE.Mesh(new THREE.CylinderGeometry(2,2.1,.18,8),stoneMat);floor.position.y=.09;floor.receiveShadow=true;g.add(floor);
  for(let i=0;i<8;i++){const t=i/8*TAU,p=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,2.3,6),new THREE.MeshStandardMaterial({color:'#f2ead8',roughness:.8}));
    p.position.set(Math.cos(t)*1.8,1.3,Math.sin(t)*1.8);p.castShadow=true;g.add(p);}
  const roof=new THREE.Mesh(new THREE.ConeGeometry(2.4,1.2,8),new THREE.MeshStandardMaterial({map:pixTex(roofCanvas('#3f6b57'),true),roughness:.85,flatShading:true}));
  roof.position.y=3;roof.castShadow=true;g.add(roof);scene.add(g);
  SHELTERS.push({id:'gazebo',label:'Sheltering in the riverside gazebo',node:'GZ',
    spots:Array.from({length:8},(_,i)=>{const t=i/8*TAU+.3;return {x:12+Math.cos(t)*1.05,z:21.2+Math.sin(t)*1.05,fx:12+Math.cos(t)*3,fz:21.2+Math.sin(t)*3};})});
}
blanket(-14,21.3,.1,'#e0a83a','#f3ead8');
// Market square with striped stalls
const produceC=paint(16,8,(x,y)=>{const crate=x>>2;const base=hexRGB(['#d9483e','#f2a03a','#7cbf4a','#f2d34a'][crate]);
  if(y===0||x%4===0)return [122,84,52];return jit(base,(hash2(x,y)>.5?16:-14));});
export const STALLS=[-5.5,-1.5,2.5,6];
STALLS.forEach((z,i)=>{
  const g=new THREE.Group();g.position.set(-29,0,z);g.rotation.y=Math.PI/2;
  const counter=new THREE.Mesh(new THREE.BoxGeometry(1.8,.9,.8),woodMat);counter.position.y=.45;counter.castShadow=counter.receiveShadow=true;g.add(counter);
  const top=new THREE.Mesh(new THREE.BoxGeometry(1.7,.12,.7),new THREE.MeshStandardMaterial({map:repTex(produceC,1,1),roughness:.9}));top.position.y=.96;g.add(top);
  for(const px of [-.85,.85]){const p=new THREE.Mesh(new THREE.BoxGeometry(.07,2.2,.07),woodMat);p.position.set(px,1.1,-.42);p.castShadow=true;g.add(p);}
  const cols=[['#c8483e','#f3ead8'],['#3f6b57','#f3ead8'],['#e0a83a','#f3ead8'],['#4b7bd2','#f3ead8']][i];
  const awn=new THREE.Mesh(new THREE.PlaneGeometry(2.1,1.6),new THREE.MeshStandardMaterial({map:repTex(stripeC(...cols),2,1),side:THREE.DoubleSide,roughness:.9}));
  awn.rotation.x=-Math.PI/2+.45;awn.position.set(0,2.02,.12);awn.castShadow=true;g.add(awn);scene.add(g);
});
SHELTERS.push({id:'market',label:'Ducking under a market stall awning',node:'M2',
  spots:STALLS.flatMap(z=>[-.6,0,.6].map(dz=>({x:-28.15,z:z+dz,fx:-24,fz:z})))});
// Community garden & basketball court
const vegC=paint(16,16,(x,y)=>{if(y%4<2)return jit([92,64,42],Math.round((hash2(x,y)-.5)*16));const h=hash2(x,y);
  if(h>.86)return hexRGB(h>.95?'#e2452f':'#f29a38');return jit(hexRGB('#4f9a3e'),Math.round((h-.5)*24));});
for(const x of [27,29.6,32.2])for(const z of [3.3,5.8]){
  const top=new THREE.MeshStandardMaterial({map:repTex(vegC,2,1.4),roughness:1});
  const m=new THREE.Mesh(new THREE.BoxGeometry(2,.28,1.4),[woodMat,woodMat,top,woodMat,woodMat,woodMat]);m.position.set(x,.14,z);m.castShadow=m.receiveShadow=true;scene.add(m);}
addBuilding(34.6,5.6,2.4,2,2.6,{...HOUSES[2],seed:77});
for(const [hx,dir] of [[COURT.x0+.3,1],[COURT.x1-.3,-1]]){const cz=(COURT.z0+COURT.z1)/2;
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,2.8,6),metalMat);pole.position.set(hx,1.4,cz);pole.castShadow=true;scene.add(pole);
  const board=new THREE.Mesh(new THREE.BoxGeometry(.06,.75,1.1),new THREE.MeshStandardMaterial({color:'#f4f1ea'}));board.position.set(hx+dir*.15,2.75,cz);board.castShadow=true;scene.add(board);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.2,.025,4,12),new THREE.MeshStandardMaterial({color:'#e2652f'}));rim.rotation.x=Math.PI/2;rim.position.set(hx+dir*.4,2.5,cz);scene.add(rim);}
// Puddles (fade in as the ground gets wet)
export const puddleMat=makeWater({deep:'#3a4a5a',shallow:'#6a8090',opacity:0});
for(const [x,z,sx,sz] of [[-9,-12.4,1.2,.6],[3.5,-13.8,.9,.5],[15,-12.2,1,.55],[-3,-8.7,.7,.4],[-14.6,2.5,.6,.9],[4,9,.9,.45],[-10.5,9.1,.7,.4],
  [-11.4,-1.5,.5,.8],[8.2,-6.4,.8,.4],[0,-6.4,.6,.35],[19,1.5,.9,.6],[-18,-17.8,.8,.5],[11,-11.3,1,.5]]){
  const m=new THREE.Mesh(new THREE.CircleGeometry(1,14).rotateX(-Math.PI/2),puddleMat);m.scale.set(sx,1,sz);m.position.set(x,.015,z);m.renderOrder=2;scene.add(m);}
// every lit material picks up the lamp lights
scene.traverse(o=>{for(const m of [].concat(o.material||[]))if(m.isMeshStandardMaterial)m.onBeforeCompile=litByLamps;});
