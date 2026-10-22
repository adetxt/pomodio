import * as THREE from 'three';
import { scene } from './renderer.js';

/* =====================================================================
   5. Lights
   ===================================================================== */
export const hemi=new THREE.HemisphereLight('#c4e0ff','#73705a',1.5);scene.add(hemi);
export const sun=new THREE.DirectionalLight('#ffffff',3);
sun.castShadow=true;sun.shadow.mapSize.set(3072,3072);
Object.assign(sun.shadow.camera,{left:-50,right:50,top:50,bottom:-50,near:1,far:240});
sun.shadow.bias=-.0004;sun.shadow.normalBias=.03;
sun.target.position.set(0,0,-4);scene.add(sun,sun.target);
export const lamps=[];
// Lamp & fountain lights. Real PointLights run the full PBR path for every lit pixel (even at intensity 0), so instead
// the lit materials get a diffuse-only point-light loop (same falloff as three's), skipped entirely by day.
export const lampU={uLampP:{value:[]},uLampC:{value:[]},uLampOn:{value:0}};
export function addLampLight(x,y,z,dist,decay,hex){
  const col=new THREE.Color(hex),c=new THREE.Vector4(0,0,0,decay);lampU.uLampP.value.push(new THREE.Vector4(x,y,z,dist));lampU.uLampC.value.push(c);
  return {set(i){c.set(col.r*i,col.g*i,col.b*i,decay);}};
}
export function litByLamps(sh){
  Object.assign(sh.uniforms,lampU);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vLampW,vLampN;')
    .replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvLampW=(modelMatrix*vec4(transformed,1.)).xyz;vLampN=mat3(modelMatrix)*objectNormal;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
#define LAMP_N ${lampU.uLampP.value.length}
uniform vec4 uLampP[LAMP_N],uLampC[LAMP_N];uniform float uLampOn;varying vec3 vLampW,vLampN;`)
    .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
if(uLampOn>0.){
#ifdef FLAT_SHADED
  vec3 ln=normalize(cross(dFdx(vLampW),dFdy(vLampW)));
#else
  vec3 ln=normalize(vLampN)*faceDirection;
#endif
  for(int i=0;i<LAMP_N;i++){vec3 d=uLampP[i].xyz-vLampW;float dl=length(d);
    float att=pow2(saturate(1.-pow4(dl/uLampP[i].w)))/max(pow(dl,uLampC[i].w),.01);
    reflectedLight.directDiffuse+=saturate(dot(ln,d/dl))*att*uLampC[i].rgb*BRDF_Lambert(diffuseColor.rgb);}
}`);
}
