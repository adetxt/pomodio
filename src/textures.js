import * as THREE from 'three';
import { hash2, hexRGB, jit, makeCanvas, paint, pixTex } from './utils.js';

/* =====================================================================
   2. Procedural pixel textures
   ===================================================================== */
export function brickCanvas(base,seed=1){const B=hexRGB(base),M=jit(B,-36);
  return paint(32,32,(x,y)=>{const row=y>>2,off=(row&1)*4;if(y%4===3||(x+off)%8===7)return M;
    return jit(B,Math.round((hash2(((x+off)>>3)+seed*17,row+seed*31)-.5)*24+(hash2(x,y+seed)-.5)*8));});}
export function plasterCanvas(base,seed=1){const B=hexRGB(base);return paint(32,32,(x,y)=>jit(B,Math.round((hash2((x>>1)+seed,(y>>1))-.5)*12)));}
export function roofCanvas(base){const B=hexRGB(base);return paint(16,16,(x,y)=>{const off=((y>>2)&1)*2;
  if(y%4===0)return jit(B,-38);if((x+off)%4===0)return jit(B,-22);return jit(B,(y%4===1?16:0)+Math.round((hash2(x,y)-.5)*10));});}
export function leafCanvas(cols){const C=cols.map(hexRGB);return paint(32,32,(x,y)=>{const n=hash2(x>>1,y>>1)*.65+hash2(x,y)*.35;return C[Math.min(C.length-1,Math.floor(n*C.length))];});}
const woodC=paint(16,16,(x,y)=>{const B=hexRGB('#9a6a42');if(y%4===3)return jit(B,-40);return jit(B,Math.round((hash2(x>>2,y)-.5)*22+(y%4===0?12:0)));});
const stoneC=paint(16,16,(x,y)=>{const B=hexRGB('#b8b2a6');const off=((y>>3)&1)*4;if(y%8===7||(x+off)%8===7)return jit(B,-34);return jit(B,Math.round((hash2((x+off)>>3,y>>3)-.5)*22+(hash2(x,y)-.5)*8));});
const barkC=paint(8,16,(x,y)=>{const B=hexRGB('#6b4a33');return jit(B,Math.round((hash2(x,y>>1)-.5)*30)-(x===0?18:0));});
export const soilC=paint(32,32,(x,y)=>{if(y<3)return jit(hexRGB('#5f9f45'),Math.round((hash2(x,y)-.5)*20));if(y<5)return [74,58,40];
  const h=hash2(x>>1,y>>1);if(h>.94)return [150,140,128];const B=y<16?[118,86,58]:[96,70,50];return jit(B,Math.round((hash2(x,y)-.5)*18)-(y%9===0?10:0));});
export const flowerTopC=paint(16,16,(x,y)=>{const h=hash2(x,y);if(h>.8){const k=hash2(x+3,y+11);return hexRGB(k<.2?'#f05a6e':k<.4?'#f6c84f':k<.6?'#f4f0e0':k<.8?'#b77ce0':'#ff9ec0');}
  return jit(hexRGB(hash2(x>>1,y>>1)>.5?'#4f8f3c':'#3f7a33'),Math.round((h-.5)*16));});
export function checkerC(a,b){const A=hexRGB(a),B=hexRGB(b);return paint(16,16,(x,y)=>{const on=((x>>2)+(y>>2))&1;const c=on?A:B;return (x%4===0&&y%2===0)?jit(c,-18):c;});}
export function stripeC(a,b){const A=hexRGB(a),B=hexRGB(b);return paint(16,16,(x,y)=>jit((x>>2)&1?A:B,y<2?14:-Math.floor(y/3)));}
export const hedgeC=leafCanvas(['#2f6a35','#3a7d3e','#468c45','#2a5c30']);
export const metalMat=new THREE.MeshStandardMaterial({color:'#2f3a36',roughness:.55,metalness:.3});
export const woodMat=new THREE.MeshStandardMaterial({map:pixTex(woodC,true),roughness:.85});
export const stoneMat=new THREE.MeshStandardMaterial({map:pixTex(stoneC,true),roughness:.9});
export const barkMat=new THREE.MeshStandardMaterial({map:pixTex(barkC,true),roughness:1});
function glowCanvas(){const c=makeCanvas(64,64),g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);return c;}
export const glowTex=new THREE.CanvasTexture(glowCanvas());
