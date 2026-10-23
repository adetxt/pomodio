import './style.css';
import * as THREE from 'three';
import { $, clamp, ico } from './utils.js';
import { W, state } from './state.js';
import { camAz, camRight, camera, passCloud, passH, passV, quad, quadCam, quadScene, renderer, resize, rtBlur, rtCloud, rtScene, scene, updateCamera } from './renderer.js';
import { boat, staticBillboards, trees } from './city.js';
import { sound } from './audio.js';
import { SPRITE_TILT, agents, marker } from './citizens.js';
import { updateTraffic } from './traffic.js';
import { updateParticles } from './particles.js';
import { drawBolt, env, localHour, updateEnvironment } from './weather.js';
import { selected, tod, todIcon, updateCard } from './ui.js';

/* =====================================================================
   15. Main loop
   ===================================================================== */
addEventListener('resize',resize);resize();
let last=performance.now(),clock=0,todUi=0;
let cardT=0,shadowT=0,due=0;
const _hand=new THREE.Vector3(),_col2=new THREE.Vector3();
function frame(now){
  // cap at 60fps (30 while focusing): high-refresh displays would otherwise render 120+ frames/s
  const focusing=document.body.classList.contains('focusing');
  if(now<due-1){requestAnimationFrame(frame);return;}
  due=Math.max(due+1000/(focusing?30:60),now);
  const dt=clamp((now-last)/1000,0,.05);last=now;clock+=dt;
  if(state.live)state.hour=localHour();
  todUi-=dt;if(todUi<0){todUi=.25;if(document.activeElement!==tod)tod.value=state.hour;const hh=Math.floor(state.hour),mm=Math.floor((state.hour-hh)*60);
    $('todText').textContent=`${String(hh%24).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;const ti=todIcon(state.hour);if($('todIcon').dataset.i!==ti){$('todIcon').dataset.i=ti;$('todIcon').innerHTML=ico(ti);}}
  updateCamera();
  updateEnvironment(dt,clock);
  for(const tr of trees){const w=.012+W.wind*.045;tr.crown.rotation.z=Math.sin(clock*1.3+tr.ph)*w;tr.crown.rotation.x=Math.sin(clock*1.05+tr.ph*1.7)*w*.7;}
  boat.position.y=.05+Math.sin(clock*1.2)*.03;boat.rotation.z=Math.sin(clock*.9)*.03;
  for(const a of agents){a.update(dt);a.billboard();}
  updateTraffic(dt);
  for(const a of agents)if(a.leash){const o=a.owner,arr=a.leash.geometry.attributes.position.array;
    _hand.set(o.x+camRight.x*.28*o.facing,.62,o.z+camRight.z*.28*o.facing);_col2.set(a.x+camRight.x*.32*a.facing,a.anim==='sit'?.42:.36,a.z+camRight.z*.32*a.facing);
    arr[0]=_hand.x;arr[1]=_hand.y;arr[2]=_hand.z;arr[3]=_col2.x;arr[4]=_col2.y;arr[5]=_col2.z;a.leash.geometry.attributes.position.needsUpdate=true;}
  for(const m of staticBillboards)m.rotation.set(SPRITE_TILT,camAz,0);
  if(selected){marker.visible=selected.group.visible;marker.position.set(selected.x,selected.group.position.y+(selected.kind==='dog'?.95:selected.anim==='sit'?1.45:1.75)+Math.sin(clock*5)*.06,selected.z);
    marker.rotation.set(0,camAz,0);cardT-=dt;if(cardT<0){cardT=.25;updateCard();}}
  updateParticles(dt,clock,env);
  drawBolt(dt);
  sound.update(dt,env);
  const dimT=focusing?1:0;passV.uniforms.uDim.value+=(dimT-passV.uniforms.uDim.value)*Math.min(1,dt*1.5);
  passV.uniforms.uTime.value=clock;
  shadowT-=dt;if(shadowT<0){shadowT=1/15;renderer.shadowMap.needsUpdate=true;}
  renderer.setRenderTarget(rtScene);renderer.render(scene,camera);
  quad.material=passH;passH.uniforms.tDiffuse.value=rtScene.texture;renderer.setRenderTarget(rtBlur);renderer.render(quadScene,quadCam);
  quad.material=passCloud;renderer.setRenderTarget(rtCloud);renderer.render(quadScene,quadCam);
  quad.material=passV;passV.uniforms.tDiffuse.value=rtBlur.texture;renderer.setRenderTarget(null);renderer.render(quadScene,quadCam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
