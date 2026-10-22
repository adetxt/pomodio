import * as THREE from 'three';

/* =====================================================================
   0. Utilities
   ===================================================================== */
export const clamp=(v,a,b)=>v<a?a:v>b?b:v;
export const lerp=(a,b,t)=>a+(b-a)*t;
export const smoothstep=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
export const rand=(a=0,b=1)=>a+Math.random()*(b-a);
export const randInt=(a,b)=>Math.floor(rand(a,b+1));
export const pick=a=>a[Math.floor(Math.random()*a.length)];
export const TAU=Math.PI*2;
export function hash2(x,y){let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967296;}
export const store={
  get(k,d){try{const v=localStorage.getItem('pomodio.'+k);return v==null?d:JSON.parse(v);}catch{return d;}},
  set(k,v){try{localStorage.setItem('pomodio.'+k,JSON.stringify(v));}catch{}}
};
export const hexRGB=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
export const jit=(c,k)=>[clamp(c[0]+k,0,255),clamp(c[1]+k,0,255),clamp(c[2]+k,0,255)];
export function shadeHex(h,k){const c=hexRGB(h);return '#'+c.map(v=>clamp(Math.round(v*k),0,255).toString(16).padStart(2,'0')).join('');}
export function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
export function pixTex(c,wrap=false){
  const t=new THREE.CanvasTexture(c);
  t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;t.colorSpace=THREE.SRGBColorSpace;
  if(wrap)t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
}
export function repTex(c,rx,ry){const t=pixTex(c,true);t.repeat.set(rx,ry);return t;}
// Paint a canvas pixel by pixel; fn returns [r,g,b] / [r,g,b,a] or null for transparent.
export function paint(w,h,fn){
  const c=makeCanvas(w,h),g=c.getContext('2d'),im=g.createImageData(w,h),d=im.data;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=fn(x,y);if(!v)continue;const i=(y*w+x)*4;d[i]=v[0];d[i+1]=v[1];d[i+2]=v[2];d[i+3]=v.length>3?v[3]:255;}
  g.putImageData(im,0,0);return c;
}
export function R(g,x,y,w,h,c){if(w<=0||h<=0)return;g.fillStyle=c;g.fillRect(x,y,w,h);}
export function L(g,x0,y0,x1,y1,c,t=1){
  g.fillStyle=c;let dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy;
  for(;;){g.fillRect(x0,y0,t,t);if(x0===x1&&y0===y1)break;const e2=2*err;if(e2>=dy){err+=dy;x0+=sx;}if(e2<=dx){err+=dx;y0+=sy;}}
}
// 1px dark outline around every opaque shape — the classic sprite look.
export function outline(c,col=[38,26,42]){
  const g=c.getContext('2d'),w=c.width,h=c.height,im=g.getImageData(0,0,w,h),d=im.data,src=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++)src[i]=d[i*4+3]>0?1:0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(src[i])continue;
    if((x>0&&src[i-1])||(x<w-1&&src[i+1])||(y>0&&src[i-w])||(y<h-1&&src[i+w])){d[i*4]=col[0];d[i*4+1]=col[1];d[i*4+2]=col[2];d[i*4+3]=255;}}
  g.putImageData(im,0,0);return c;
}
export const $=id=>document.getElementById(id);
export const ico=n=>`<svg class="i"><use href="#i-${n}"/></svg>`;
