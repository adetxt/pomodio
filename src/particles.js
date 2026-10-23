import * as THREE from 'three';
import { TAU, clamp, pick, rand, randInt } from './utils.js';
import { W } from './state.js';
import { bufSize, camera, scene } from './renderer.js';
import { GD, GW, GX0, GZ0 } from './ground.js';
import { PointCloud, clouds } from './shaders.js';
import { trees } from './city.js';
import { agents } from './citizens.js';

/* =====================================================================
   10. Particles: petals & leaves, dust motes, fireflies, rain, splashes,
       fountain spray, coffee steam
   ===================================================================== */
const petals=new PointCloud(380),dust=new PointCloud(160,{additive:true,soft:true,tint:false}),flies=new PointCloud(70,{additive:true,soft:true,tint:false});
const spray=new PointCloud(260,{soft:true}),steam=new PointCloud(90,{soft:true});
const DEW=new THREE.Color('#dff4ff'),GOLD=new THREE.Color('#ffd98a');
const PETAL_COLS=['#f7c1d2','#f0a4bd','#ffe3ec','#e9873a','#f2b34c','#d9622b','#c8483e'].map(c=>new THREE.Color(c));
const blossomTrees=trees.filter(t=>t.type==='cherry'||t.type==='autumn');
const pState=[];
for(let i=0;i<petals.n;i++){pState.push({ph:rand(0,TAU),rest:0});respawnPetal(i,true);petals.size[i]=rand(.09,.15);}
function respawnPetal(i,init){const t=pick(blossomTrees),p=petals.pos,cherry=t.type==='cherry';
  p[i*3]=t.x+rand(-1.3,1.3)*t.s;p[i*3+1]=init?rand(.1,3.2):rand(1.6,3)*t.s;p[i*3+2]=t.z+rand(-1.1,1.1)*t.s;
  petals.setColor(i,PETAL_COLS[cherry?randInt(0,2):randInt(3,6)]);pState[i].rest=0;}
for(let i=0;i<dust.n;i++){dust.pos[i*3]=rand(-14,14);dust.pos[i*3+1]=rand(.2,4.5);dust.pos[i*3+2]=rand(-10,9);dust.size[i]=rand(.08,.16);dust.setColor(i,new THREE.Color('#ffe2a8'));}
for(let i=0;i<flies.n;i++){flies.pos[i*3]=rand(-10.5,10.5);flies.pos[i*3+1]=rand(.25,1.6);flies.pos[i*3+2]=rand(-5.6,5.6);flies.size[i]=rand(.12,.2);flies.setColor(i,new THREE.Color('#d8ff7a'));}
const flyPh=Array.from({length:flies.n},()=>rand(0,TAU));
const sprayV=new Float32Array(spray.n*3);
function respawnSpray(i){const top=i%3!==0,t=rand(0,TAU),p=spray.pos;
  if(top){p[i*3]=0;p[i*3+1]=2;p[i*3+2]=0;const s=rand(.35,.6);sprayV[i*3]=Math.cos(t)*s;sprayV[i*3+1]=rand(2.2,2.8);sprayV[i*3+2]=Math.sin(t)*s;}
  else{p[i*3]=Math.cos(t)*.92;p[i*3+1]=1.58;p[i*3+2]=Math.sin(t)*.92;sprayV[i*3]=Math.cos(t)*.35;sprayV[i*3+1]=.1;sprayV[i*3+2]=Math.sin(t)*.35;}
  spray.size[i]=rand(.07,.12);spray.alpha[i]=.85;spray.setColor(i,new THREE.Color('#d8f0ff'));}
for(let i=0;i<spray.n;i++){respawnSpray(i);for(let k=0;k<randInt(0,40);k++)stepSpray(i,.03);}
function stepSpray(i,dt){const p=spray.pos;sprayV[i*3+1]-=6.5*dt;p[i*3]+=sprayV[i*3]*dt;p[i*3+1]+=sprayV[i*3+1]*dt;p[i*3+2]+=sprayV[i*3+2]*dt;
  const r=Math.hypot(p[i*3],p[i*3+2]);if((p[i*3+1]<1.6&&r<.9&&sprayV[i*3+1]<0)||p[i*3+1]<.42)respawnSpray(i);}
const steamSources=agents.filter(a=>a.cup).map(a=>a.cup);
const steamLife=new Float32Array(steam.n).map(()=>rand(0,2.4));
const steamSrc=Array.from({length:steam.n},(_,i)=>i%steamSources.length);
for(let i=0;i<steam.n;i++){steam.size[i]=rand(.12,.2);steam.setColor(i,new THREE.Color('#ffffff'));}
// rain streaks
const RAIN_N=5200,rainPos=new Float32Array(RAIN_N*6),rainGeo=new THREE.BufferGeometry();
rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
const rainMat=new THREE.LineBasicMaterial({color:'#b4cbe8',transparent:true,opacity:.5,depthWrite:false});
const rainLines=new THREE.LineSegments(rainGeo,rainMat);rainLines.frustumCulled=false;rainLines.renderOrder=7;scene.add(rainLines);
const rainDrops=Array.from({length:RAIN_N},()=>({x:rand(GX0-6,GX0+GW+6),y:rand(0,30),z:rand(GZ0-4,GZ0+GD+4)}));
const SPLASH_N=240,splashes=new THREE.InstancedMesh(new THREE.RingGeometry(.06,.1,10).rotateX(-Math.PI/2),
  new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}),SPLASH_N);
splashes.frustumCulled=false;splashes.renderOrder=3;scene.add(splashes);
const splashLife=new Float32Array(SPLASH_N).fill(1);let splashI=0;const _m4=new THREE.Matrix4(),_col=new THREE.Color();
for(let i=0;i<SPLASH_N;i++){splashes.setMatrixAt(i,_m4.makeScale(0,0,0));splashes.setColorAt(i,_col.setRGB(0,0,0));}
function spawnSplash(x,z){const i=splashI++%SPLASH_N;splashLife[i]=0;splashes.userData[i]={x,z};}

export function updateParticles(dt,t,env){
  const scale=bufSize.y/(2*Math.tan(camera.fov*Math.PI/360)); // pixels per world unit at depth 1
  for(const c of clouds){c.mat.uniforms.uScale.value=scale;c.mat.uniforms.uTint.value.copy(env.tint);}
  // petals & leaves
  const wind=W.wind,act=Math.floor(petals.n*clamp(env.petals,0,1));
  for(let i=0;i<petals.n;i++){const p=petals.pos,s=pState[i];
    if(i>=act){petals.alpha[i]=Math.max(0,petals.alpha[i]-dt);if(p[i*3+1]>.05)p[i*3+1]-=dt*2;continue;}
    if(s.rest>0){s.rest-=dt;petals.alpha[i]=Math.min(1,s.rest);if(s.rest<=0)respawnPetal(i);continue;}
    petals.alpha[i]=Math.min(1,petals.alpha[i]+dt*2);
    const ph=s.ph+t*1.3;p[i*3]+=(wind*1.3+Math.sin(ph)*.45)*dt;p[i*3+1]+=(-.38-Math.sin(ph*1.7)*.12-W.rain*1.5)*dt;p[i*3+2]+=(Math.cos(ph*.8)*.35+wind*.35)*dt;
    if(p[i*3+1]<.04){p[i*3+1]=.04;s.rest=rand(4,10);}
    if(Math.abs(p[i*3])>GW/2||p[i*3+2]>GZ0+GD||p[i*3+2]<GZ0)respawnPetal(i);}
  petals.commit();
  // dust motes / morning dew glints
  const dawn=Math.exp(-(((env.hour-7)/1.4)**2)),dustA=env.day*(1-W.cloud)*(.25+.75*Math.max(env.golden,dawn))*(1-W.rain),dustCol=dawn>env.golden?DEW:GOLD;
  for(let i=0;i<dust.n;i++){const p=dust.pos;p[i*3]+=Math.sin(t*.3+i)*.08*dt+wind*.15*dt;p[i*3+1]+=Math.sin(t*.5+i*1.7)*.06*dt;p[i*3+2]+=Math.cos(t*.27+i*.7)*.08*dt;
    if(p[i*3]>14)p[i*3]=-14;dust.alpha[i]=dustA*(.4+.6*Math.sin(t*1.3+i*2.1)**2)*.85;dust.setColor(i,dustCol);}
  dust.commit();
  // fireflies
  const flyA=env.night*(1-W.rain)*(1-W.fog*.5);
  for(let i=0;i<flies.n;i++){const p=flies.pos,ph=flyPh[i]+t*.6;p[i*3]+=Math.sin(ph*1.3)*.35*dt;p[i*3+1]=clamp(p[i*3+1]+Math.cos(ph*1.7)*.18*dt,.2,1.8);p[i*3+2]+=Math.cos(ph)*.3*dt;
    if(Math.abs(p[i*3])>10.5)p[i*3]*=-.98;if(Math.abs(p[i*3+2])>5.6)p[i*3+2]*=-.98;
    flies.alpha[i]=flyA*Math.max(0,Math.sin(t*1.4+flyPh[i]*3))**3;}
  flies.commit();
  // fountain spray
  for(let i=0;i<spray.n;i++){stepSpray(i,dt);_col.setRGB(.82+env.night*.2,.93+env.night*.25,1+env.night*.5);spray.setColor(i,_col);}
  spray.mat.uniforms.uTintAmt.value=1-env.night*.7;spray.commit();
  // coffee steam
  for(let i=0;i<steam.n;i++){steamLife[i]+=dt;const src=steamSources[steamSrc[i]],life=steamLife[i];
    if(life>2.4){steamLife[i]=0;}
    const l=steamLife[i];steam.pos[i*3]=src.x+Math.sin(l*3+i)*.07;steam.pos[i*3+1]=.86+l*.38;steam.pos[i*3+2]=src.z+Math.cos(l*2+i)*.05;
    steam.alpha[i]=Math.sin(l/2.4*Math.PI)*.45;steam.size[i]=.1+l*.06;}
  steam.commit();
  // rain
  const active=Math.floor(RAIN_N*W.rain),vx=wind*5,vz=wind*1.6,vy=-20-W.rain*6,len=.55+W.rain*.35;
  const n=Math.hypot(vx,vy,vz),ux=vx/n*len,uy=vy/n*len,uz=vz/n*len;
  for(let i=0;i<active;i++){const d=rainDrops[i];d.x+=vx*dt;d.y+=vy*dt;d.z+=vz*dt;
    const inside=d.x>GX0&&d.x<GX0+GW&&d.z>GZ0&&d.z<GZ0+GD;
    if(d.y<(inside?0:-14)){if(inside&&Math.random()<.32)spawnSplash(d.x,d.z);d.x=rand(GX0-8,GX0+GW+4);d.y=rand(24,31);d.z=rand(GZ0-4,GZ0+GD+2);}
    const k=i*6;rainPos[k]=d.x;rainPos[k+1]=d.y;rainPos[k+2]=d.z;rainPos[k+3]=d.x-ux;rainPos[k+4]=d.y-uy;rainPos[k+5]=d.z-uz;}
  rainGeo.setDrawRange(0,active*2);rainGeo.attributes.position.needsUpdate=true;
  rainMat.opacity=.25+.35*W.rain;rainMat.color.copy(env.tint).multiplyScalar(.75).addScalar(.18);
  for(let i=0;i<SPLASH_N;i++){if(splashLife[i]>=1)continue;splashLife[i]=Math.min(1,splashLife[i]+dt*2.6);const l=splashLife[i],u=splashes.userData[i];
    _m4.makeScale(.5+l*2.2,1,.5+l*2.2);_m4.setPosition(u.x,.03,u.z);splashes.setMatrixAt(i,_m4);
    const b=(1-l)*.7;splashes.setColorAt(i,_col.setRGB(b*env.tint.r,b*env.tint.g,b*env.tint.b));
    if(l>=1)splashes.setMatrixAt(i,_m4.makeScale(0,0,0));}
  splashes.instanceMatrix.needsUpdate=true;splashes.instanceColor.needsUpdate=true;
}
