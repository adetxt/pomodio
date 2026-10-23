import * as THREE from 'three';
import { clamp, lerp, rand, smoothstep } from './utils.js';
import { PRESETS, W, state } from './state.js';
import { boltCv, boltG, camAz, camDist, passH, passV, scene } from './renderer.js';
import { groundMat } from './ground.js';
import { fogMats, waters } from './shaders.js';
import { hemi, lampU, lamps, sun } from './lights.js';
import { buildings, fountainLight, puddleMat } from './city.js';
import { sound } from './audio.js';
import { setRaining, spriteMats } from './citizens.js';

/* =====================================================================
   11. Time of day & weather
   ===================================================================== */
const SKY=[
  [0,'#0a0f2c','#1f2457','#7f95ff',.55,'#3a4a8a','#141626',.5,'#5d6aa8',0],
  [4.8,'#121a42','#3a3466','#8f9cff',.45,'#45508a','#1a1a2a',.5,'#6670aa',0],
  [6.2,'#6b84c4','#f4b9b4','#ffc39b',.9,'#9fb4ef','#6a5560',.85,'#c9c0dc',.45],
  [8,'#78b2ec','#d7ebf7','#fff0dc',1.8,'#b6d4f5','#6f7058',1,'#f2f0f4',.85],
  [12,'#4b9ff0','#c3e6ff','#ffffff',2.5,'#c4e0ff','#73705a',1.05,'#ffffff',1],
  [15.5,'#5aa3ea','#e2eecd','#fff2d8',2.2,'#c0daf5','#76705a',1,'#fffaf0',1],
  [17.6,'#6d7fc5','#ffb877','#ffa24e',2.1,'#ffc8a0','#7a5038',.8,'#ffe0b8',.75],
  [18.8,'#3c3a7c','#f07d6a','#ff7a4a',.85,'#c28ab0','#4a3040',.7,'#d8a8b8',.35],
  [20,'#141a48','#3a2f68','#8f9cff',.5,'#4a5090','#1a1a2a',.55,'#7078b0',.04],
  [24,'#0a0f2c','#1f2457','#7f95ff',.55,'#3a4a8a','#141626',.5,'#5d6aa8',0],
].map(k=>({h:k[0],top:new THREE.Color(k[1]),bot:new THREE.Color(k[2]),sun:new THREE.Color(k[3]),sunI:k[4],hs:new THREE.Color(k[5]),hg:new THREE.Color(k[6]),hI:k[7],tint:new THREE.Color(k[8]),day:k[9]}));
const SK={top:new THREE.Color(),bot:new THREE.Color(),sun:new THREE.Color(),hs:new THREE.Color(),hg:new THREE.Color(),tint:new THREE.Color(),sunI:0,hI:0,day:0};
function sampleSky(h){let i=0;while(i<SKY.length-2&&h>=SKY[i+1].h)i++;const a=SKY[i],b=SKY[i+1],t=clamp((h-a.h)/(b.h-a.h),0,1);
  for(const k of ['top','bot','sun','hs','hg','tint'])SK[k].lerpColors(a[k],b[k],t);SK.sunI=lerp(a.sunI,b.sunI,t);SK.hI=lerp(a.hI,b.hI,t);SK.day=lerp(a.day,b.day,t);}
const GREY=new THREE.Color('#8a90a0'),GREY_TOP=new THREE.Color('#6b7382'),_c1=new THREE.Color(),_c2=new THREE.Color(),_c3=new THREE.Color(),_c4=new THREE.Color(),_v=new THREE.Vector3(),_rgb={r:0,g:0,b:0};
const HAZE=new THREE.Color('#e6e9ef'),FOG_DAY=new THREE.Color('#dfe4ea'),LAMP_GLOW=new THREE.Color('#ffb060'),WHITE=new THREE.Color('#ffffff');
const MOON_DIR=new THREE.Vector3(-.35,.85,.42).normalize();
let flash=0,boltLife=0,boltPath=null,nextStrike=rand(4,9);
export const localHour=()=>{const d=new Date();return d.getHours()+d.getMinutes()/60+d.getSeconds()/3600;};
export const env={hour:12,day:1,night:0,golden:0,tint:new THREE.Color(1,1,1),petals:1};
export function updateEnvironment(dt,t){
  const T=PRESETS[state.weather],k=Math.min(1,dt*.45);
  for(const key of Object.keys(T))W[key]+=(T[key]-W[key])*k;
  state.wet=clamp(state.wet+(W.rain>.15?dt*W.rain*.12:-dt*.018),0,1);
  if(W.rain>.22)setRaining(true);else if(W.rain<.1)setRaining(false);
  const h=state.hour;sampleSky(h);
  const c=W.cloud,st=W.storm;
  const mist=.55*Math.exp(-(((h-6.6)/1.15)**2))*(1-W.rain);
  const fogEff=clamp(W.fog+mist*.75,0,1);
  // sky
  _c1.copy(SK.top).lerp(GREY_TOP,c*.92).multiplyScalar(1-st*.45);_c2.copy(SK.bot).lerp(GREY,c*.9).multiplyScalar(1-st*.4);
  _c2.lerp(_c3.copy(_c1).lerp(HAZE,.5),fogEff*.4);
  _c1.getRGB(_rgb,THREE.SRGBColorSpace);passV.uniforms.uTop.value.set(_rgb.r,_rgb.g,_rgb.b);
  _c2.getRGB(_rgb,THREE.SRGBColorSpace);passV.uniforms.uBot.value.set(_rgb.r,_rgb.g,_rgb.b);
  scene.fog.color.copy(_c2).lerp(FOG_DAY,.3*SK.day);
  scene.fog.near=camDist+lerp(250,-32,fogEff);scene.fog.far=camDist+lerp(450,65,fogEff); // relative to the orbit target so zooming keeps the haze
  // sun / moon
  const th=(h-6)/12*Math.PI,el=Math.sin(th),sunD=_v.set(Math.cos(th)*.9,Math.max(el,.16),.45).normalize();
  const moonMix=smoothstep(.12,-.1,el);sunD.lerp(MOON_DIR,moonMix).normalize();
  sun.position.copy(sun.target.position).addScaledVector(sunD,90);
  sun.color.copy(SK.sun);sun.intensity=SK.sunI*1.3*(1-.9*c)*(1-.3*st)+flash*3;
  hemi.color.copy(SK.hs).lerp(GREY,c*.75);hemi.groundColor.copy(SK.hg);hemi.intensity=SK.hI*1.5*(1+.2*c)*(1-.3*st)+flash*2.5;
  const light=SK.day*(1-.5*c)-.15*st;
  env.hour=h;env.day=SK.day;env.night=smoothstep(.35,.05,light);env.golden=Math.exp(-(((h-17.7)/1)**2))*(1-c);
  env.tint.copy(SK.tint).lerp(GREY,c*.4).multiplyScalar(1-st*.2).addScalar(flash*.6);env.petals=W.petals;
  for(const m of spriteMats)m.color.copy(env.tint);
  // lamps (staggered on/off thresholds, a couple of flickery ones)
  for(const L of lamps){const on=light<L.th?1:0;L.level+=(on-L.level)*Math.min(1,dt*(on?.9:.6));let lv=L.level;
    if(L.flaky&&lv>.5){if(Math.random()<dt*.7)L.flick=rand(.05,.4);L.flick+=(1-L.flick)*dt*6;lv*=L.flick;}
    L.glassMat.emissiveIntensity=lv*2.6;L.halo.material.opacity=lv*(.5+fogEff*.3);L.light?.set(lv*13);}
  for(const b of buildings)b.mat.emissiveIntensity=(b.shop?.3:0)+smoothstep(b.th+.15,b.th-.25,light)*b.k*1.3;
  fountainLight.set(env.night*9);lampU.uLampOn.value=env.night+lamps.reduce((s,L)=>s+L.level,0);
  // water
  for(const m of waters){const u=m.uniforms;u.uTime.value=t;u.uRain.value=W.rain;u.uSky.value.copy(_c2).lerp(_c1,.4);u.uLamp.value.copy(LAMP_GLOW).multiplyScalar(env.night*.55);u.uTint.value.copy(env.tint);u.uGlow.value=env.night;}
  puddleMat.uniforms.uOpacity.value=state.wet*.75;
  // wet ground glossiness
  groundMat.roughness=lerp(1,.3,state.wet);groundMat.color.setRGB(1-.3*state.wet,1-.28*state.wet,1-.22*state.wet);
  // ground fog
  for(const m of fogMats){m.uniforms.uTime.value=t;m.uniforms.uAmt.value=fogEff*.6;m.uniforms.uColor.value.copy(_c2).lerp(WHITE,.35).multiplyScalar(.6+.4*SK.day);}
  // lightning
  if(W.storm>.5){nextStrike-=dt;if(nextStrike<0){strike();nextStrike=rand(5,14);}}
  flash=Math.max(0,flash-dt*3.2);
  passV.uniforms.uFlash.value=flash;passV.uniforms.uStars.value=env.night*(1-c)*.9;
  passV.uniforms.uExposure.value=lerp(1.05,.92,c);passV.uniforms.uSat.value=lerp(1.14,.74,c);
  // pixel clouds: warm-tinted by the sun, bluish at night, grey/dark with weather
  const cu=passV.uniforms;cu.uCloud.value=W.sky;cu.uPan.value=camAz;
  _c3.copy(WHITE).lerp(SK.sun,.4*(1-c)).multiplyScalar(lerp(.1,1,SK.day)).lerp(_c4.set('#2c3366'),(1-SK.day)*.55);
  _c3.lerp(_c4.set('#a3a8b4').multiplyScalar(lerp(.2,1,SK.day)),c*.85).multiplyScalar(1-st*.5);
  _c4.copy(_c3).multiplyScalar(.7).lerp(_c2,.3);
  _c3.getRGB(_rgb,THREE.SRGBColorSpace);cu.uCloudLit.value.set(_rgb.r,_rgb.g,_rgb.b);
  _c4.getRGB(_rgb,THREE.SRGBColorSpace);cu.uCloudShade.value.set(_rgb.r,_rgb.g,_rgb.b);passH.uniforms.uAmount.value=passV.uniforms.uAmount.value=state.tilt;
}
function strike(){
  flash=1;setTimeout(()=>{flash=Math.max(flash,.8);},110);setTimeout(()=>{flash=Math.max(flash,.5);},260);
  const w=boltCv.width,h=boltCv.height;let x=rand(w*.15,w*.85),y=0;boltPath=[[x,y]];
  while(y<h*rand(.3,.5)){x+=rand(-40,40);y+=rand(18,42);boltPath.push([x,y]);}boltLife=1;
  sound.thunder(rand(.5,2.6),rand(.6,1));
}
export function drawBolt(dt){
  if(boltLife<=0)return;boltLife-=dt*3;boltG.clearRect(0,0,boltCv.width,boltCv.height);if(boltLife<=0)return;
  boltG.save();boltG.globalAlpha=Math.max(0,boltLife);boltG.strokeStyle='#f2f6ff';boltG.shadowColor='#9ec9ff';boltG.shadowBlur=18;boltG.lineWidth=3;
  boltG.beginPath();boltPath.forEach(([x,y],i)=>i?boltG.lineTo(x,y):boltG.moveTo(x,y));boltG.stroke();boltG.lineWidth=1.2;boltG.stroke();boltG.restore();
}
