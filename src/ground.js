import * as THREE from 'three';
import { TAU, hash2, hexRGB, jit, lerp, makeCanvas, pixTex, repTex } from './utils.js';
import { scene } from './renderer.js';
import { soilC } from './textures.js';
import { LOOP, PATHS } from './layout.js';
export { LOOP, PATHS } from './layout.js';

/* =====================================================================
   3. Ground: one pixel-art canvas painted from the city layout
   ===================================================================== */
export const GX0=-36,GZ0=-34,GW=72,GD=60,PPU=16;
export const ZEBRA_X=[-27.5,-6,6,25.5],COURT={x0:27,x1:34,z0:-7,z1:-.5};
const TY={GRASS:1,GRAVEL:2,ASPH:3,BIKE:4,WALK:5,PROM:6,PLAZA:7,CURB:8,ZEBRA:9,LINE:10,QUAY:11,BED:12,STONE:13,COBBLE:14,COURT:15};
function sdRoundBox(x,z,bx,bz,r){const qx=Math.abs(x)-(bx-r),qz=Math.abs(z)-(bz-r);return Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(Math.max(qx,qz),0)-r;}
function zoneAt(x,z){
  if(z>=25.6)return TY.CURB;
  if(z>=16.2){if(z>=17.6&&z<18.8)return TY.PROM;if(z>=23.8&&z<25)return TY.BIKE;return TY.GRASS;}
  if(z>=14.5)return TY.QUAY;
  if(z>=10)return TY.BED;
  if(z>=8)return z<8.2?TY.CURB:TY.PROM;
  if(z<-20)return TY.WALK;
  if(z<-16.5)return z>-16.7?TY.CURB:TY.WALK;
  const zebra=ZEBRA_X.some(zx=>Math.abs(x-zx)<1.2);
  if(z<-9.5){
    if(zebra&&z>-16.4&&z<-9.6&&Math.floor((z+16.5)/.5)%2===0)return TY.ZEBRA;
    if(Math.abs(z+15.25)<.07||Math.abs(z+10.75)<.07)return TY.ZEBRA;
    if(z<-15.3||z>=-10.7)return TY.BIKE;
    if(Math.abs(z+13)<.09&&((x+48)%2)<1.1&&!zebra)return TY.LINE;
    return TY.ASPH;
  }
  if(z<-8)return z<-9.3?TY.CURB:TY.WALK;
  if(x<-31)return TY.WALK;
  if(x<-24)return x>-24.2?TY.CURB:TY.COBBLE;
  if(x<-13)return x>-13.2?TY.CURB:TY.WALK;
  if(x>24){if(x<24.2)return TY.CURB;if(x>=COURT.x0&&x<COURT.x1&&z>=COURT.z0&&z<COURT.z1)return TY.COURT;
    if(Math.abs(x-25.5)<.6||Math.abs(z-1.8)<.6)return TY.GRAVEL;return TY.GRASS;}
  if(x>13)return x<13.2?TY.CURB:TY.PLAZA;
  if(Math.abs(sdRoundBox(x,z,LOOP.bx,LOOP.bz,LOOP.r))<LOOP.hw)return TY.GRAVEL;
  const rr=Math.hypot(x,z);if(rr<3.6)return rr>3.42?TY.CURB:TY.STONE;
  return TY.GRASS;
}
const STUBS=[[-6,-6.4,-6,-8],[6,-6.4,6,-8],[0,6.4,0,8],[-11.2,0,-13,0],[11.2,0,13,0]];
const BIKE_GLYPH=["...#..##.","..###.#..",".#.#.#.#.","#..#.#..#",".##...##."];
const PALG={};
for(const [k,v] of Object.entries({
  [TY.GRASS]:['#5f9f45','#6aad4c','#57923f','#74b553'],[TY.GRAVEL]:['#d4be93','#c9b286','#dcc8a0','#bea77c'],
  [TY.ASPH]:['#4b4d58','#474953','#51535e'],[TY.BIKE]:['#3e8e78','#3a866f','#44957f'],[TY.WALK]:['#bdb8b0','#b5b0a8','#c4bfb7'],
  [TY.PROM]:['#cfae86','#c4a37c','#d6b78f'],[TY.PLAZA]:['#b56a52','#ab604a','#bf735a'],[TY.CURB]:['#ddd9d0','#d2cec5'],
  [TY.ZEBRA]:['#eeece6','#e6e3dc'],[TY.LINE]:['#ecc94b','#e3c044'],[TY.QUAY]:['#aba69d','#a39e95'],[TY.BED]:['#24384a','#213444'],
  [TY.STONE]:['#c8c2b6','#beb8ac','#d2ccc0'],[TY.COBBLE]:['#9d978e','#a7a198','#938d84'],[TY.COURT]:['#3d7f95','#3a7a8f']}))PALG[k]=v.map(hexRGB);
const FLOWER_SPECKS=['#f4efd8','#f6c84f','#f29bb8'].map(hexRGB);
function groundColor(t,px,py){
  const h=hash2(px,py),P=PALG[t];let c=P[Math.floor(h*P.length)];
  switch(t){
    case TY.GRASS:{const n=hash2(px>>1,py>>1);c=P[Math.floor((n*.6+h*.4)*P.length)];
      if(h>.986)c=FLOWER_SPECKS[Math.floor(hash2(px+7,py)*3)];else if(h>.94&&hash2(px,py-1)<.5)c=[135,196,95];break;}
    case TY.GRAVEL:if(h>.93)c=[168,147,108];else if(h>.88)c=[232,216,180];break;
    case TY.ASPH:if(h>.975)c=[94,96,107];else if(h<.02)c=[62,64,74];break;
    case TY.WALK:if(px%16===0||py%16===0)c=[161,156,148];else c=jit(c,Math.round((hash2(px>>4,py>>4)-.5)*14));break;
    case TY.PROM:{const off=((py>>2)&1)*4;if(py%4===0||(px+off)%8===0)c=[168,141,106];else c=jit(c,Math.round((hash2((px+off)>>3,py>>2)-.5)*16));break;}
    case TY.PLAZA:{const bx=px>>3,by=py>>3,vert=(bx+by)&1,lx=px%8,ly=py%8; // basket-weave pavers
      if(vert?lx===0||lx===4:ly===0||ly===4)c=[138,77,60];else c=jit(c,Math.round((hash2(bx*2+vert+(vert?lx>>2:ly>>2)*7,by)-.5)*14));break;}
    case TY.COBBLE:{const off=((py>>2)&1)*2;if(py%4===0||(px+off)%4===0)c=[118,112,104];else c=jit(c,Math.round((hash2((px+off)>>2,py>>2)-.5)*20)+(py%4===1?8:0));break;}
    case TY.COURT:{const x=GX0+(px+.5)/PPU,z=GZ0+(py+.5)/PPU,cz=(COURT.z0+COURT.z1)/2,cx=(COURT.x0+COURT.x1)/2,e=.07;
      const line=x<COURT.x0+e+.05||x>COURT.x1-e-.05||z<COURT.z0+e+.05||z>COURT.z1-e-.05||Math.abs(x-cx)<e||Math.abs(Math.hypot(x-cx,z-cz)-1.1)<e
        ||(Math.abs(z-cz)<1.1&&(Math.abs(x-COURT.x0-2)<e||Math.abs(x-COURT.x1+2)<e))||(Math.abs(Math.abs(z-cz)-1.1)<e&&(x<COURT.x0+2||x>COURT.x1-2));
      if(line)c=[240,236,226];else if(Math.abs(z-cz)<1.1&&(x<COURT.x0+2||x>COURT.x1-2))c=[196,96,72];break;}
    case TY.QUAY:if(px%32===0||py%16===0)c=[134,130,122];else c=jit(c,Math.round((hash2(px>>5,py>>4)-.5)*12));break;
    case TY.STONE:{const x=GX0+(px+.5)/PPU,z=GZ0+(py+.5)/PPU,r=Math.hypot(x,z),ring=Math.floor(r*2.2),a=Math.atan2(z,x);
      const seg=Math.floor((a+Math.PI)/TAU*(8+ring*6));
      if((r*2.2)%1<.12||((a+Math.PI)/TAU*(8+ring*6))%1<.06)c=[166,160,148];else c=jit(c,Math.round((hash2(ring,seg)-.5)*16));break;}
  }
  return c;
}
const ROUGH={[TY.COURT]:170,[TY.GRASS]:255,[TY.GRAVEL]:235,[TY.BED]:255,[TY.ASPH]:150,[TY.BIKE]:160,[TY.CURB]:185};
function buildGround(){
  const W=GW*PPU,H=GD*PPU,typ=new Uint8Array(W*H);
  for(let py=0;py<H;py++){const z=GZ0+(py+.5)/PPU;for(let px=0;px<W;px++)typ[py*W+px]=zoneAt(GX0+(px+.5)/PPU,z);}
  const stamp=(x,z,r,ty,only)=>{const cx=(x-GX0)*PPU,cz=(z-GZ0)*PPU,rp=r*PPU;
    for(let py=Math.max(0,Math.floor(cz-rp));py<=Math.min(H-1,Math.ceil(cz+rp));py++)
      for(let px=Math.max(0,Math.floor(cx-rp));px<=Math.min(W-1,Math.ceil(cx+rp));px++){
        const dx=px+.5-cx,dz=py+.5-cz;if(dx*dx+dz*dz<=rp*rp){const i=py*W+px;if(!only||only.includes(typ[i]))typ[i]=ty;}}};
  for(const p of PATHS)for(const q of p.pts)stamp(q.x,q.z,.55,TY.GRAVEL,[TY.GRASS]);
  for(const [x0,z0,x1,z1] of STUBS){const n=Math.ceil(Math.hypot(x1-x0,z1-z0)/.15);for(let i=0;i<=n;i++)stamp(lerp(x0,x1,i/n),lerp(z0,z1,i/n),.62,TY.GRAVEL,[TY.GRASS]);}
  for(const lz of [-10.1,-15.9,24.4])for(let x=-33;x<=33;x+=6){if(ZEBRA_X.some(zx=>Math.abs(x-zx)<2))continue;
    const ox=Math.round((x-GX0)*PPU)-4,oz=Math.round((lz-GZ0)*PPU)-2;
    BIKE_GLYPH.forEach((row,j)=>[...row].forEach((ch,i)=>{if(ch==='#')typ[(oz+j)*W+ox+i]=TY.ZEBRA;}));}
  const c=makeCanvas(W,H),g=c.getContext('2d'),im=g.createImageData(W,H),d=im.data;
  const rc=makeCanvas(W,H),rg=rc.getContext('2d'),rim=rg.createImageData(W,H),rd=rim.data;
  for(let py=0;py<H;py++)for(let px=0;px<W;px++){const i=py*W+px,t=typ[i],col=groundColor(t,px,py),k=i*4;
    d[k]=col[0];d[k+1]=col[1];d[k+2]=col[2];d[k+3]=255;const r=ROUGH[t]??175;rd[k]=rd[k+1]=rd[k+2]=r;rd[k+3]=255;}
  g.putImageData(im,0,0);rg.putImageData(rim,0,0);
  const rough=new THREE.CanvasTexture(rc);rough.magFilter=rough.minFilter=THREE.NearestFilter;rough.generateMipmaps=false;
  return {map:pixTex(c),rough};
}
const groundTex=buildGround();
export const groundMat=new THREE.MeshStandardMaterial({map:groundTex.map,roughnessMap:groundTex.rough,roughness:1,metalness:0});
const ground=new THREE.Mesh(new THREE.PlaneGeometry(GW,GD).rotateX(-Math.PI/2),groundMat);
ground.position.set(GX0+GW/2,0,GZ0+GD/2);ground.receiveShadow=true;scene.add(ground);
{ // diorama slab with soil strata
  const soil=new THREE.MeshStandardMaterial({map:repTex(soilC,GW/4,.75),roughness:1});
  const soilZ=new THREE.MeshStandardMaterial({map:repTex(soilC,GD/4,.75),roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:'#2a2030'});
  const slab=new THREE.Mesh(new THREE.BoxGeometry(GW,3,GD),[soilZ,soilZ,dark,dark,soil,soil]);
  slab.position.set(ground.position.x,-1.52,ground.position.z);slab.receiveShadow=true;scene.add(slab);
}
