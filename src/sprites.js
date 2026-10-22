import * as THREE from 'three';
import { L, R, TAU, hexRGB, jit, makeCanvas, outline, paint, pick, pixTex, shadeHex } from './utils.js';

/* =====================================================================
   8. Pixel-art sprite sheets (people, bikes, dogs, umbrellas, bubbles)
   ===================================================================== */
export const PX=.06;
const SKIN=['#f6d2b8','#eab792','#cf9670','#a86b48','#7a4a30','#ffe1cc'];
const HAIR=['#2b1d16','#5a3825','#d9a441','#a8432c','#ece4d6','#3b3b56','#e783a8','#6fa8d6','#1f1f2a'];
const SHIRT=['#e8735f','#f2b84b','#7cc4a4','#6a9fd8','#c58ad8','#f2f0e6','#e88aa8','#5e9e6e','#ffcf8a','#8fb8ff','#d95d5d','#4b6584'];
const PANTS=['#3b4a6b','#2e2e38','#6b5040','#4f6b5a','#7a6a92','#9c8b6e','#2f4858'];
export function personParams(o={}){return Object.assign({skin:pick(SKIN),hair:pick(HAIR),shirt:pick(SHIRT),pants:pick(PANTS),shoe:pick(['#2a2228','#5a3a2a','#e8e4da','#8a2f2f']),
  style:pick(['short','long','bun','curly','short','cap','beanie']),cap:pick(['#d95d5d','#4b6584','#f2b84b','#5e9e6e','#e88aa8']),shorts:false,item:null,
  bookCol:pick(['#c8483e','#3e6bc8','#e0b040','#4a9a6a']),glasses:Math.random()<.2},o);}
function drawPerson(g,ox,f,P){
  const sit=f===6||f===7,run=f===8||f===9,walk=f>=2&&f<=5;
  let bob=0;if(f===1||(walk&&(f===3||f===5))||f===9)bob=1;
  const y0=(sit?4:0)+bob,sk=P.skin,sh=P.shirt,shD=shadeHex(sh,.78),pa=P.pants,paD=shadeHex(pa,.75);
  const sw=walk?[1,0,-1,0][f-2]:0;
  if(!sit){if(run)R(g,ox+4,y0+10+(f===8?1:-1),2,4,shD);else{R(g,ox+4,y0+10-sw,2,5,shD);R(g,ox+4,y0+15-sw,2,1,sk);}}
  if(sit){R(g,ox+5,y0+16,8,2,pa);R(g,ox+11,22,2,1,P.shorts?sk:pa);R(g,ox+11,23,3,1,P.shoe);}
  else{let lo=0,ro=0;if(walk){lo=sw;ro=-sw;}if(run){lo=f===8?2:-2;ro=-lo;}
    const leg=(x,o,c)=>{R(g,x,y0+16,3,3,c);const st=y0+19;R(g,x+o,st,3,22-st,P.shorts?sk:c);R(g,x+o,22,3+(o>0?1:0),2,P.shoe);};
    leg(ox+5,lo,paD);leg(ox+8,ro,pa);}
  R(g,ox+5,y0+9,6,7,sh);R(g,ox+5,y0+9,1,7,shD);R(g,ox+5,y0+15,6,1,shD);
  if(sit){R(g,ox+9,y0+10,2,3,sh);R(g,ox+10,y0+12,3,2,sh);R(g,ox+12,y0+12,1,2,sk);
    if(P.item==='book'){const yy=y0+11-(f===7?1:0);R(g,ox+11,yy,4,4,P.bookCol);R(g,ox+12,yy+1,2,2,'#f4efe0');}
    if(P.item==='cup'){const yy=y0+10-(f===7?2:0);R(g,ox+12,yy,2,3,'#f5f2ea');R(g,ox+12,yy,2,1,'#7b4a2a');}}
  else if(run){R(g,ox+10,y0+10,2,2,sh);R(g,ox+11,y0+12,2,2,sh);R(g,ox+12,y0+13,1,1,sk);}
  else{R(g,ox+10,y0+10+sw,2,5,sh);R(g,ox+10,y0+15+sw,2,1,sk);}
  R(g,ox+5,y0+2,7,7,sk);R(g,ox+9,y0+5,1,1,'#2a1d1d');R(g,ox+11,y0+5,1,1,'#2a1d1d');R(g,ox+10,y0+7,1,1,shadeHex(sk,.85));
  if(P.glasses){R(g,ox+8,y0+5,4,1,'#2a2a2a');R(g,ox+9,y0+5,1,1,'#9ec9ff');}
  const hr=P.hair;
  switch(P.style){
    case 'long':R(g,ox+5,y0+1,7,2,hr);R(g,ox+4,y0+2,3,8,hr);break;
    case 'bun':R(g,ox+5,y0+1,7,2,hr);R(g,ox+5,y0+3,2,2,hr);R(g,ox+3,y0+1,3,3,hr);break;
    case 'curly':R(g,ox+4,y0+0,8,3,hr);R(g,ox+4,y0+3,2,3,hr);R(g,ox+12,y0+1,1,1,hr);break;
    case 'cap':R(g,ox+5,y0+1,7,2,P.cap);R(g,ox+10,y0+3,3,1,P.cap);R(g,ox+5,y0+3,2,2,hr);break;
    case 'beanie':R(g,ox+5,y0+0,7,3,P.cap);R(g,ox+5,y0+3,1,2,hr);break;
    case 'band':R(g,ox+5,y0+1,7,2,hr);R(g,ox+5,y0+3,2,2,hr);R(g,ox+5,y0+3,7,1,P.cap);break;
    default:R(g,ox+5,y0+1,7,2,hr);R(g,ox+5,y0+3,2,2,hr);
  }
}
export function personSheet(P){const c=makeCanvas(16*10,24),g=c.getContext('2d');for(let f=0;f<10;f++)drawPerson(g,f*16,f,P);return {canvas:outline(c),frames:10,fw:16,fh:24};}
function ringPx(g,cx,cy,r,c){g.fillStyle=c;for(let a=0;a<48;a++){const t=a/48*TAU;g.fillRect(Math.round(cx+Math.cos(t)*r),Math.round(cy+Math.sin(t)*r),1,1);}}
function drawBike(g,ox,f,P,rider=true){
  const fc=P.bikeCol;
  for(const cx of [5,18]){ringPx(g,ox+cx,18,4,'#262630');for(const [sx,sy] of (f?[[1,1],[-1,-1],[1,-1],[-1,1]]:[[0,1],[0,-1],[1,0],[-1,0]]))L(g,ox+cx,18,ox+cx+sx*3,18+sy*3,'#a8aeb8');}
  L(g,ox+5,18,ox+11,18,fc);L(g,ox+11,18,ox+9,12,fc);L(g,ox+9,12,ox+16,12,fc);L(g,ox+16,12,ox+18,18,fc);L(g,ox+11,18,ox+16,12,fc);
  L(g,ox+16,12,ox+16,10,fc);L(g,ox+15,10,ox+18,10,'#333');R(g,ox+7,11,4,1,'#2a2a2a');
  if(P.basket)R(g,ox+17,11,4,3,'#c8a36a');
  if(!rider)return;
  const knee=f?[13,13]:[12,15],foot=f?[12,18]:[10,17];
  L(g,ox+9,11,ox+knee[0],knee[1],P.pants,2);L(g,ox+knee[0],knee[1],ox+foot[0],foot[1],P.pants,2);R(g,ox+foot[0],foot[1]+1,3,1,P.shoe);
  L(g,ox+9,10,ox+12,5,P.shirt,3);L(g,ox+13,6,ox+16,10,P.shirt,2);R(g,ox+16,10,1,1,P.skin);
  R(g,ox+11,0,5,5,P.skin);R(g,ox+11,0,5,2,P.cap);R(g,ox+11,2,1,2,P.hair);R(g,ox+14,2,1,1,'#2a1d1d');
}
export function bikeSheet(P,rider=true){const c=makeCanvas(48,24),g=c.getContext('2d');drawBike(g,0,0,P,rider);drawBike(g,24,1,P,rider);return {canvas:outline(c),frames:2,fw:24,fh:24};}
function drawDog(g,ox,f,P){
  const fur=P.fur,d=shadeHex(fur,.75),ear=P.ear;
  if(f===2){R(g,ox+4,5,6,4,fur);R(g,ox+3,8,4,3,d);R(g,ox+9,7,1,4,fur);R(g,ox+10,7,1,4,d);R(g,ox+9,1,5,4,fur);R(g,ox+13,3,2,2,fur);
    R(g,ox+14,3,1,1,'#222');R(g,ox+9,1,2,3,ear);R(g,ox+12,2,1,1,'#222');R(g,ox+9,5,2,1,'#d84a4a');R(g,ox+1,9,2,1,fur);return;}
  const s=f===0?1:f===1?-1:0;
  R(g,ox+3,4,9,4,fur);R(g,ox+3,7,9,1,d);
  R(g,ox+4+s,8,1,3,d);R(g,ox+6-s,8,1,3,fur);R(g,ox+9-s,8,1,3,d);R(g,ox+11+s,8,1,3,fur);
  R(g,ox+11,1,4,4,fur);R(g,ox+14,3,2,2,fur);R(g,ox+15,3,1,1,'#222');R(g,ox+13,2,1,1,'#222');R(g,ox+11,1,2,3,ear);R(g,ox+11,5,1,2,'#d84a4a');
  if(f===3){R(g,ox+1,1,1,2,fur);R(g,ox+2,3,1,1,fur);}else R(g,ox+1,3+(f===1?1:0),2,1,fur);
}
function drawCat(g,ox,f,P){
  const fur=P.fur,d=shadeHex(fur,.78),ch=P.chest,eye=P.eye;
  const marks=(x,y,w)=>{if(P.coat==='tabby')for(let i=x;i<x+w;i+=2)R(g,ox+i,y,1,2,P.acc);
    if(P.coat==='calico'){R(g,ox+x,y,2,2,P.acc);R(g,ox+x+3,y,2,1,P.acc2);}};
  if(f<=1){ // walk
    R(g,ox+3,5,8,3,fur);marks(4,5,6);R(g,ox+4,7,6,1,d);
    for(const [lx,dark] of (f?[[4,1],[5,0],[9,1],[10,0]]:[[3,1],[6,0],[8,1],[11,0]]))R(g,ox+lx,8,1,3,dark?d:fur);
    R(g,ox+10,2,4,4,fur);R(g,ox+10,1,1,1,fur);R(g,ox+13,1,1,1,fur);R(g,ox+11,5,2,1,ch);
    R(g,ox+12,3,1,1,eye);R(g,ox+14,4,1,1,'#e88a9a');
    R(g,ox+2,4,1,2,fur);R(g,ox+1,2,1,2,fur);R(g,ox+2,1,1,1,fur);
  }else if(f===3){ // curled up asleep
    R(g,ox+3,7,9,4,fur);R(g,ox+2,8,1,2,fur);R(g,ox+12,8,1,2,fur);marks(4,7,7);
    R(g,ox+9,5,4,3,fur);R(g,ox+9,4,1,1,fur);R(g,ox+12,4,1,1,fur);R(g,ox+10,6,2,1,d);R(g,ox+3,10,8,1,d);
  }else{ // 2 = sit, 4 = groom
    R(g,ox+4,8,3,3,d);R(g,ox+5,5,5,5,fur);R(g,ox+8,6,2,4,ch);marks(5,6,3);
    R(g,ox+8,10,1,1,fur);R(g,ox+9,10,1,1,d);R(g,ox+7,11,4,1,fur);R(g,ox+2,10,4,1,fur);R(g,ox+2,9,1,1,fur);
    if(f===2){R(g,ox+7,1,5,4,fur);R(g,ox+7,0,1,1,fur);R(g,ox+11,0,1,1,fur);R(g,ox+9,2,1,1,eye);R(g,ox+11,2,1,1,eye);R(g,ox+10,3,1,1,'#e88a9a');R(g,ox+9,4,3,1,ch);}
    else{R(g,ox+8,2,5,4,fur);R(g,ox+8,1,1,1,fur);R(g,ox+12,1,1,1,fur);R(g,ox+10,3,2,1,d);R(g,ox+12,5,1,1,'#e88a9a');R(g,ox+11,5,1,3,fur);}
  }
}
export function catSheet(P){const c=makeCanvas(80,12),g=c.getContext('2d');for(let f=0;f<5;f++)drawCat(g,f*16,f,P);return {canvas:outline(c),frames:5,fw:16,fh:12};}
export function dogSheet(P){const c=makeCanvas(64,12),g=c.getContext('2d');for(let f=0;f<4;f++)drawDog(g,f*16,f,P);return {canvas:outline(c),frames:4,fw:16,fh:12};}
function umbrellaTex(a,b){
  const A=hexRGB(a),B=hexRGB(b);
  const c=paint(24,18,(x,y)=>{const cx=11.5,cy=9;
    if(y<=9){const dx=(x-cx)/11.5,dy=(y-cy)/8.6;if(dx*dx+dy*dy<=1){if(y===9&&(x%6===0||x%6===5))return null;
      const seg=Math.floor((Math.atan2(y-cy,x-cx)+Math.PI)/(Math.PI/6));return jit(seg%2?A:B,y<4?18:0);}}
    if(x===12&&y>9&&y<17)return [70,50,44];if(y===17&&(x===11||x===10))return [70,50,44];if(x===10&&y===16)return [70,50,44];return null;});
  return pixTex(outline(c));
}
export const UMBRELLAS=[['#e8735f','#f3ead8'],['#f2b84b','#e8735f'],['#6a9fd8','#f3ead8'],['#7cc4a4','#2f6a5a'],['#c58ad8','#f6c84f'],['#e88aa8','#ffffff']].map(([a,b])=>umbrellaTex(a,b));
const BUBBLES={};
export function bubbleTex(e){
  if(BUBBLES[e])return BUBBLES[e];
  const c=makeCanvas(64,64),g=c.getContext('2d');
  g.fillStyle='#261a2a';g.fillRect(4,2,56,44);g.fillRect(2,4,60,40);g.fillRect(24,46,14,4);g.fillRect(28,50,6,6);
  g.fillStyle='#fffaf0';g.fillRect(6,4,52,40);g.fillRect(4,6,56,36);g.fillRect(26,44,10,4);g.fillRect(30,48,2,4);
  g.font='28px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#2a2030';g.fillText(e,32,25);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return BUBBLES[e]=t;
}
export const markerTex=pixTex(outline(paint(10,8,(x,y)=>{const hw=4-Math.floor(y*4/6);return y<6&&Math.abs(x-4.5)<=hw+.5?(y<2?[255,226,140]:[255,180,107]):null;})));
