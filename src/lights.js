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
