import * as THREE from 'three';
import { rand } from './utils.js';
import { state } from './state.js';
import { busHeadway } from './activity.js';
import { renderer, scene } from './renderer.js';
import { GW, GX0 } from './ground.js';
import { BUS_STOPS, buildings } from './city.js';
import { vehicles } from './nav.js';
import { agents } from './citizens.js';

/* =====================================================================
   9b. Traffic: a red double-decker looping the avenue, serving both stops
   ===================================================================== */
const L=6.4,WD=2.05,H=3.3,DOOR=L/2-.8,VMAX=5,ACC=2.2,DEC=3.2;
const ROAD={z0:-15.35,z1:-10.65}; // asphalt between the bike lanes
// eastbound keeps to the park-side lane, westbound to the avenue side; each pulls up with its front door at its stop
const LEGS=[{dir:1,z:-11.85,stop:BUS_STOPS.find(s=>s.node==='BUS')},{dir:-1,z:-14.15,stop:BUS_STOPS.find(s=>s.node==='BUSN')}];
const EDGE=GW/2+L/2+.5;

// the bus drives in and out through the diorama's sides, so it's clipped at the edges
renderer.localClippingEnabled=true;
const clip=[new THREE.Plane(new THREE.Vector3(1,0,0),-GX0),new THREE.Plane(new THREE.Vector3(-1,0,0),GX0+GW)];
const mat=o=>new THREE.MeshStandardMaterial({roughness:.7,side:THREE.DoubleSide,clippingPlanes:clip,clipShadows:true,...o});
const red=mat({color:'#c8282b',roughness:.55}),cream=mat({color:'#f2e6cf'}),tyre=mat({color:'#1e1e24',roughness:.9}),roofM=mat({color:'#b12226'});
const glass=mat({color:'#24303c',roughness:.2,emissive:'#ffd9a0',emissiveIntensity:0}),lamp=mat({color:'#fff6d8',emissive:'#ffe7b0',emissiveIntensity:.4});
const sign=mat({color:'#1a1a1a',emissive:'#ffb43a',emissiveIntensity:.5});
buildings.push({mat:glass,k:1,th:.5}); // windows light up at dusk with the houses
const bus=new THREE.Group();
function part(geo,m,x,y,z,shadow){const p=new THREE.Mesh(geo,m);p.position.set(x,y,z);if(shadow)p.castShadow=true;bus.add(p);}
part(new THREE.BoxGeometry(L,H-.45,WD),red,0,.35+(H-.45)/2,0,true);
part(new THREE.BoxGeometry(L-.1,.1,WD-.1),roofM,0,H-.05,0);
part(new THREE.BoxGeometry(L+.02,.12,WD+.02),cream,0,1.86,0);
part(new THREE.BoxGeometry(L-1.6,.55,WD+.03),glass,-.55,1.28,0); // lower deck (behind the door)
part(new THREE.BoxGeometry(L-.5,.6,WD+.03),glass,0,2.45,0); // upper deck
part(new THREE.BoxGeometry(.04,.85,WD-.3),glass,L/2+.01,1.25,0); // windscreen
part(new THREE.BoxGeometry(.04,.6,WD-.3),glass,L/2+.01,2.45,0);
part(new THREE.BoxGeometry(.05,.2,1.2),sign,L/2+.02,2.02,0); // destination blind
part(new THREE.BoxGeometry(.8,1.35,.04),glass,DOOR,1.03,WD/2+.01); // door on the kerb side
for(const z of [-.7,.7])part(new THREE.BoxGeometry(.05,.14,.24),lamp,L/2+.02,.62,z);
const wheel=new THREE.CylinderGeometry(.36,.36,.28,10).rotateX(Math.PI/2);
for(const x of [-L/2+1.1,L/2-1.25])for(const z of [-1,1])part(wheel,tyre,x,.36,z*(WD/2-.1));
scene.add(bus);

const car={len:L,x:-EDGE,active:false};vehicles.push(car);
let leg=0,x=-EDGE,v=VMAX,dwell=0,served=false,away=0,waiting=true,initialized=false,headwayVariation=1;
function placeBus(){const g=LEGS[leg];bus.position.set(x,0,g.z);bus.rotation.y=g.dir>0?0:Math.PI;car.x=x;car.active=!waiting;bus.visible=!waiting;}
placeBus();
export function updateTraffic(dt){
  if(!initialized){initialized=true;away=busHeadway(state.hour)>90?0:.9;}
  if(waiting){
    // Accumulate service progress so moving the time slider immediately
    // adjusts frequency; an old daytime timeout cannot trigger a night bus.
    away+=dt/(busHeadway(state.hour)*headwayVariation);
    if(away<1)return;
    waiting=false;away=0;x=-LEGS[leg].dir*EDGE;v=VMAX;served=false;placeBus();
  }
  const g=LEGS[leg],d=g.dir;
  if(dwell>0){dwell-=dt;return;}
  let vt=VMAX;
  // ease into the stop so the door lines up with the shelter
  if(!served){const ds=(g.stop.x-d*DOOR-x)*d;
    if(ds<.05&&v<.3){served=true;dwell=rand(4,7);v=0;return;}
    vt=Math.min(vt,Math.sqrt(2*DEC*Math.max(0,ds)));}
  // give way to anyone on the road ahead (pedestrians on a crossing, a cat dashing across)
  const front=x+d*L/2;
  for(const a of agents){if(!a.group.visible||a.z<ROAD.z0||a.z>ROAD.z1)continue;const ahead=(a.x-front)*d;
    if(ahead>-.6&&ahead<8)vt=Math.min(vt,Math.sqrt(2*DEC*Math.max(0,ahead-1.2)));}
  v=Math.min(vt,v+ACC*dt);x+=d*v*dt;
  if(x*d>EDGE){waiting=true;away=0;leg=1-leg;headwayVariation=rand(.85,1.15);}
  placeBus();
}
