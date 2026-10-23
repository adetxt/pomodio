import * as THREE from 'three';
import { TAU, clamp, pick, pixTex, rand, randInt } from './utils.js';
import { state } from './state.js';
import { pedestrianDestination, presenceFor } from './activity.js';
import { advanceFishing, createFishing, resetFishing } from './fishing.js';
import { camAz, camRight, scene } from './renderer.js';
import { COURT, GW, GX0 } from './ground.js';
import { BUS_STOPS, PARK_TREES, SHELTERS, STALLS, canalSeats, fountainSeats, groundY, southSeats, staticBillboards } from './city.js';
import { LOOP_LEN, NODES, crossingClear, dijkstra, isCross, loopAt, nearestNode } from './nav.js';
import { PX, UMBRELLAS, bikeSheet, bubbleTex, catSheet, dogSheet, markerTex, personParams, personSheet } from './sprites.js';
import { sound } from './audio.js';

/* =====================================================================
   9. Citizens: agents with simple step queues
   ===================================================================== */
const NAMES=['Mia','Theo','Hana','Jun','Lola','Sami','Iris','Noor','Felix','Ada','Kai','Rosa','Omar','Yuki','Elio','Maren','Zoe','Ravi','Ines','Bo','Cleo','Arlo','Suki','Nils',
  'Vera','Tomás','Lin','Priya','Odette','Ezra','Wren','Malik','Juno','Pia','Leon','Aiko','Fern','Remy','Sol','Tess','Hugo','Mira','Nico','Ama','Otto','Lea','Dev','Ilse'];
const DOG_NAMES=['Biscuit','Mochi','Pepper','Waffles','Noodle','Clover','Toast'];
const TRACKS=['rainy window study','matcha at 3am','sunday laundromat','tape deck daydream','the last tram home','cardigan weather','kettle on, lights low','moss & morning',
  'bookshop cat nap','polaroid summer','slow bus to nowhere','fog over the canal','sakura in the gutter','late night ramen','soft focus','paper lantern','cloud bakery',
  'headphones in the park','vinyl & velvet','amber hour'];
const ARTISTS=['tape owl','sleepy kettle','moss & mono','lofi lantern','quiet tram','cassette fox','velvet hum','paper moon club'];
export const ROLE_TITLE={cat:'Neighbourhood Cat',shopper:'Market Shopper',gardener:'Community Gardener',player:'Hoop Dreamer',jogger:'Jogger',cyclist:'Cyclist',reader:'Bench Reader',rester:'Shade Napper',picnic:'Picnicker',walker:'Dog Walker',dog:'Very Good Dog',
  pedestrian:'Pedestrian',patron:'Café Regular',chatter:'Neighbour',canal:'Canal Watcher',fisher:'Angler'};
export const ROLE_MOOD={cat:'😼 Smug',shopper:'🍎 Peckish',gardener:'🌱 Grounded',player:'🏀 Competitive',jogger:'⚡ Energized',cyclist:'🚲 Breezy',reader:'📖 Absorbed',rester:'😌 Serene',picnic:'🌸 Content',walker:'🐕 Cheerful',dog:'🦴 Ecstatic',
  pedestrian:'🙂 Easygoing',patron:'☕ Caffeinated',chatter:'💬 Chatty',canal:'🌊 Pensive',fisher:'🎣 Patient'};
const usedNames=new Set();
function uniqueName(list){for(let i=0;i<20;i++){const n=pick(list);if(!usedNames.has(n)){usedNames.add(n);return n;}}return pick(list);}
const GEO={person:planeGeo(16*PX,24*PX),bike:planeGeo(24*PX,24*PX),dog:planeGeo(16*PX,12*PX),umbrella:planeGeo(24*PX,18*PX),cat:planeGeo(16*PX*.85,12*PX*.85),bubble:planeGeo(.72,.72),marker:planeGeo(.42,.34)};
function planeGeo(w,h){const g=new THREE.PlaneGeometry(w,h);g.translate(0,h/2,0);return g;}
const blobGeo=new THREE.CircleGeometry(.32,12).rotateX(-Math.PI/2);
const blobMat=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.26,depthWrite:false});
export const spriteMats=[],agents=[],pickables=[];
export let raining=false;
export const SPRITE_TILT=-.26;

class Agent{
  constructor(o){
    Object.assign(this,{role:o.role,kind:o.kind||'person',name:o.name,sheet:o.sheet,params:o.params||{},umbrellaOK:!!o.umbrella,shelterSeeker:!!o.seeker,
      queue:[],cur:null,anim:'idle',facing:1,animT:rand(0,10),frame:0,steps:randInt(1400,9000),label:'Enjoying the park',
      track:`“${pick(TRACKS)}” — ${pick(ARTISTS)}`,energy:rand(.45,.95),sheltered:false,spot:null,atHome:false,bubbleT:0,bubbleDur:0,sipT:rand(2,6),sip:false});
    this.tex=pixTex(this.sheet.canvas);this.tex.repeat.set(1/this.sheet.frames,1);
    this.mat=new THREE.MeshBasicMaterial({map:this.tex,alphaTest:.05,transparent:true,side:THREE.DoubleSide});spriteMats.push(this.mat);
    this.group=new THREE.Group();scene.add(this.group);
    this.sprite=new THREE.Mesh(this.kind==='cat'?GEO.cat:this.kind==='dog'?GEO.dog:this.kind==='cyclist'?GEO.bike:GEO.person,this.mat);this.sprite.rotation.order='YXZ';
    this.sprite.userData.agent=this;this.group.add(this.sprite);pickables.push(this.sprite);
    this.blob=new THREE.Mesh(blobGeo,blobMat);this.blob.position.y=.015;this.blob.renderOrder=1;
    if(this.kind==='cyclist')this.blob.scale.set(2.2,1,.9);if(this.kind==='dog')this.blob.scale.set(1.3,1,.7);if(this.kind==='cat')this.blob.scale.set(1,1,.55);this.group.add(this.blob);
    this.bubbleMat=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,fog:false});
    this.bubble=new THREE.Mesh(GEO.bubble,this.bubbleMat);this.bubble.visible=false;this.bubble.renderOrder=8;this.group.add(this.bubble);
    if(this.umbrellaOK){this.umb=new THREE.Mesh(GEO.umbrella,new THREE.MeshBasicMaterial({map:pick(UMBRELLAS),alphaTest:.05,transparent:true,side:THREE.DoubleSide}));
      spriteMats.push(this.umb.material);this.umb.rotation.order='YXZ';this.umb.visible=false;this.umb.position.y=.62;this.umbS=0;this.group.add(this.umb);}
    agents.push(this);
  }
  get x(){return this.group.position.x;} get z(){return this.group.position.z;}
  setXZ(x,z){this.group.position.x=x;this.group.position.z=z;}
  faceDir(dx,dz){const s=dx*camRight.x+dz*camRight.z;if(Math.abs(s)>.01)this.facing=s>0?1:-1;}
  addSteps(d){this.steps+=d*(this.kind==='dog'||this.kind==='cat'?4.2:1.9);}
  say(e,dur=2.6){this.bubbleMat.map=bubbleTex(e);this.bubbleMat.needsUpdate=true;this.bubble.visible=true;this.bubbleT=0;this.bubbleDur=dur;}
  interrupt(delay){const y=this.group.position.y,a=this.anim==='walk'||this.anim==='run'?'idle':this.anim;
    this.queue.length=0;this.cur={t:'wait',dur:delay,anim:a,y,label:this.label};this.begin(this.cur);}
  begin(s){
    if(s.label)this.label=s.label;
    if(s.t==='move'){this.anim=s.anim||'walk';this.group.position.y=groundY(this.x,this.z);}
    else if(s.t==='wait'){this.anim=s.anim||'idle';this.group.position.y=s.y||0;if(s.faceX!==undefined)this.faceDir(s.faceX-this.x,s.faceZ-this.z);if(s.bubble)this.say(s.bubble);}
  }
  runQueue(dt){
    if(!this.cur){if(!this.queue.length)this.think();this.cur=this.queue.shift();if(!this.cur)return;this.begin(this.cur);}
    const s=this.cur;
    if(s.t==='move'){const dx=s.x-this.x,dz=s.z-this.z,d=Math.hypot(dx,dz),sp=s.speed*dt;
      if(d<=sp){this.setXZ(s.x,s.z);this.addSteps(d);this.cur=null;}else{this.setXZ(this.x+dx/d*sp,this.z+dz/d*sp);this.addSteps(sp);this.faceDir(dx,dz);}this.group.position.y=groundY(this.x,this.z);}
    else if(s.t==='wait'){s.dur-=dt;if(s.bubbles&&!this.bubble.visible&&Math.random()<dt*.09)this.say(pick(s.bubbles));if(s.dur<=0&&(s.crossX===undefined||crossingClear(s.crossX)))this.cur=null;}
    else if(s.t==='fn'){this.cur=null;s.fn();}
  }
  think(){BRAINS[this.role]?.(this);}
  update(dt){
    // Stable ranks give every resident their own arrival/departure time. Dogs
    // share their owner's presence, so neither a dog nor its leash is orphaned.
    let target=this.owner?this.owner.presence:presenceFor(this.role,state.hour,this.scheduleRank??.5);
    // A clock change can wake someone who faded out midway across the avenue.
    // Let the bus pass before bringing that resident back into the roadway.
    if(this.presence<=.02&&this.z>=-15.35&&this.z<=-10.65&&!crossingClear(this.x))target=0;
    this.presence=this.owner||this.presence===undefined?target:this.presence+(target-this.presence)*Math.min(1,dt*2);
    this.group.visible=this.presence>.02;
    this.mat.opacity=this.presence;this.bubbleMat.opacity=this.presence;
    if(this.umb)this.umb.material.opacity=this.presence;
    this.blob.visible=this.presence>.5;
    if(this.leash){this.leash.visible=this.group.visible&&this.owner.group.visible;this.leash.material.opacity=this.presence;}
    if(!this.group.visible){
      if(this.shelterSeeker){
        if(this.spot||this.sheltered)releaseShelter(this);
        this.queue.length=0;this.cur=null;
      }
      this.bubble.visible=false;
      if(this.rod){if(this.rod.g.visible)resetFishing(this.rod.fishing);this.rod.g.visible=false;}
      return;
    }
    if(this.custom)this.custom(dt);else this.runQueue(dt);
    if(this.kind==='cyclist')this.group.visible=this.presence>.02&&Math.abs(this.x)<GW/2+.2;
    this.animate(dt);
    if(this.bubble.visible){this.bubbleT+=dt;const t=this.bubbleT,sc=t<.25?1.1*Math.sin(t/.25*Math.PI/2):t>this.bubbleDur-.2?Math.max(.01,(this.bubbleDur-t)/.2):1;
      this.bubble.scale.setScalar(sc);if(t>this.bubbleDur)this.bubble.visible=false;}
    if(this.umb){const want=raining&&!this.sheltered&&this.anim!=='sit';this.umbS=clamp(this.umbS+(want?dt*5:-dt*5),0,1);
      this.umb.visible=this.umbS>0;this.umb.scale.set(this.umbS,this.umbS,1);}
    if(this.rod)updateRod(this,dt);
    this.blob.position.y=-this.group.position.y+.015;
  }
  animate(dt){
    this.animT+=dt;let f=0;
    if(this.kind==='person'){
      switch(this.anim){
        case 'walk':f=2+Math.floor(this.animT*7)%4;break;
        case 'run':f=8+Math.floor(this.animT*9)%2;break;
        case 'sit':this.sipT-=dt;if(this.sipT<0){this.sip=!this.sip;this.sipT=this.sip?rand(1,2):rand(3,7);}f=this.sip?7:6;break;
        default:f=Math.floor(this.animT*1.6)%2;
      }
    }else if(this.kind==='cyclist')f=Math.floor(this.animT*6)%2;
    else if(this.kind==='cat'){const a=this.anim;f=a==='walk'?Math.floor(this.animT*7)%2:a==='run'?Math.floor(this.animT*12)%2:a==='sleep'?3:a==='groom'?(Math.floor(this.animT*1.5)%2?4:2):2;}
    else f=this.anim==='trot'?Math.floor(this.animT*8)%2:this.anim==='sit'?2:3;
    if(f!==this.frame){this.frame=f;this.tex.offset.x=f/this.sheet.frames;}
    const sit=this.anim==='sit';
    this.bubble.position.y=this.kind==='cat'?(this.anim==='sleep'?.5:.65):this.kind==='dog'?.75:this.kind==='cyclist'?1.5:sit?1.22:1.48;
  }
  billboard(){
    this.sprite.rotation.set(SPRITE_TILT,camAz,0);this.sprite.scale.x=this.facing;
    this.bubble.rotation.set(0,camAz,0);
    if(this.umb){this.umb.rotation.set(SPRITE_TILT,camAz,0);this.umb.position.x=Math.sin(camAz)*.06;this.umb.position.z=Math.cos(camAz)*.06;}
  }
}
// ---- planning helpers ----
function routeSteps(a,tx,tz,o={}){
  const speed=o.speed||rand(1,1.25),anim=o.anim||'walk',label=o.label||'Strolling',steps=[];
  if(Math.hypot(tx-a.x,tz-a.z)<2.2){steps.push({t:'move',x:tx,z:tz,speed,anim,label});return steps;}
  const from=nearestNode(a.x,a.z),to=nearestNode(tx,tz),ids=from===to?[from]:dijkstra(from,to);
  ids.forEach((id,i)=>{const n=NODES[id];
    if(i>0&&isCross(ids[i-1],id)){steps.push({t:'wait',dur:o.hurry?0:rand(1,2.2),anim:'idle',label:'Looking both ways at the crossing',crossX:n.x});
      steps.push({t:'move',x:n.x+rand(-.3,.3),z:n.z,speed:speed*1.1,anim,label:o.hurry?label:'Crossing the street'});}
    else steps.push({t:'move',x:n.x+rand(-.2,.2),z:n.z+rand(-.2,.2),speed,anim,label});});
  steps.push({t:'move',x:tx,z:tz,speed,anim,label});
  return steps;
}
// nearest shelter that still has a free spot (falls back to the nearest one when every shelter is full)
function nearestShelter(x,z){const by=SHELTERS.map(s=>[s,Math.hypot(NODES[s.node].x-x,NODES[s.node].z-z)]).sort((a,b)=>a[1]-b[1]);
  return (by.find(([s])=>s.spots.some(p=>!p.taken))||by[0])[0];}
function goShelter(a){
  const sh=nearestShelter(a.x,a.z);let spot;
  if(a.kind==='cat'){const p=pick(sh.spots);spot={x:p.x+rand(-.35,.35),z:p.z+rand(-.3,.3),fx:p.fx,fz:p.fz};} // cats squeeze in beside people
  else{spot=sh.spots.find(s=>!s.taken)||pick(sh.spots);spot.taken=true;}
  a.spot=spot;a.shelter=sh;a.atHome=false;a.say(a.kind==='cat'?'🙀':'☔',1.6);
  a.queue.push(...routeSteps(a,spot.x,spot.z,{hurry:true,anim:'run',speed:a.kind==='cat'?rand(2.8,3.3):rand(2.3,2.8),label:a.kind==='cat'?'Sprinting away from the rain!':'Running for cover!'}));
  a.queue.push({t:'fn',fn:()=>{a.sheltered=true;}});
}
function releaseShelter(a){if(a.spot){a.spot.taken=false;a.spot=null;}a.sheltered=false;}
// lawn wandering for dog walkers
const LAWN_OBS=[[0,0,5],[7.4,-3.2,2.5],[-6.4,3.25,1.4],[5.8,3.35,1.4],[-2.7,5.1,1.1],[2.7,5.1,1.1],[8.4,4.6,1],[-7.6,-2.6,.8],[-8.6,4.4,.8],...PARK_TREES.map(t=>[t[0],t[1],.8])];
function segHitsCircle(x0,z0,x1,z1,cx,cz,r){const dx=x1-x0,dz=z1-z0,l=dx*dx+dz*dz||1,t=clamp(((cx-x0)*dx+(cz-z0)*dz)/l,0,1);return Math.hypot(x0+dx*t-cx,z0+dz*t-cz)<r;}
function lawnTarget(x,z){
  for(let i=0;i<30;i++){const tx=rand(-10,10),tz=rand(-5.4,5.4);
    if(LAWN_OBS.some(([cx,cz,r])=>Math.hypot(tx-cx,tz-cz)<r))continue;
    if(LAWN_OBS.slice(0,2).some(([cx,cz,r])=>segHitsCircle(x,z,tx,tz,cx,cz,r)))continue;
    return {x:tx,z:tz};}
  return {x:x>0?8:-8,z:z>0?-.8:.8};
}
// ---- role brains ----
function homeBrain(a){
  if(raining){
    if(a.sheltered)a.queue.push({t:'wait',dur:rand(6,14),anim:'idle',label:a.shelter.label,faceX:a.spot.fx,faceZ:a.spot.fz,bubbles:['☕','💬','☔','♪']});
    else goShelter(a);
    return;
  }
  if(a.spot||a.sheltered)releaseShelter(a);
  const h=a.home;
  if(!a.atHome){a.queue.push(...routeSteps(a,h.x,h.z,{label:`Heading back to ${h.place}`}));a.queue.push({t:'fn',fn:()=>{a.atHome=true;if(a.home.pose==='sit')a.say(pick(a.home.bubbles));}});return;}
  a.queue.push({t:'wait',dur:rand(15,40),anim:h.pose,y:h.y,faceX:h.fx,faceZ:h.fz,label:pick(h.labels),bubbles:h.bubbles});
}
const BRAINS={
  reader:homeBrain,rester:homeBrain,picnic:homeBrain,chatter:homeBrain,canal:homeBrain,fisher:homeBrain,shopper:homeBrain,gardener:homeBrain,player:homeBrain,
  cat(a){
    if(raining){if(a.sheltered)a.queue.push({t:'wait',dur:rand(6,14),anim:'sit',label:'Glaring at the rain from cover',bubbles:['💢','💤','🐾']});else goShelter(a);return;}
    if(a.spot||a.sheltered)releaseShelter(a);
    const h=a.home;
    const nocturnal=state.hour<6||state.hour>=20;
    if(!a.atHome){a.queue.push(...routeSteps(a,h.x,h.z,{speed:rand(.7,.9),label:'Trotting back to its favourite spot'}));a.queue.push({t:'fn',fn:()=>{a.atHome=true;}});return;}
    if(h.wander&&Math.random()<(nocturnal?.85:.45)){const p=catWanderTarget(h);
      a.queue.push({t:'move',x:p.x,z:p.z,speed:rand(.55,.85),anim:'walk',label:nocturnal?'Patrolling the quiet streets':pick(['Prowling around','Investigating a leaf','Patrolling the territory','Stalking a petal'])});
      a.queue.push({t:'wait',dur:rand(3,8),anim:pick(['sit','groom']),label:pick(['Grooming a paw','Sitting like a loaf of bread','Judging passers-by']),bubbles:['🐾','💕','😼']});
      a.queue.push({t:'move',x:h.x,z:h.z,speed:rand(.55,.85),anim:'walk',label:'Strolling back to its favourite spot'});return;}
    a.queue.push({t:'wait',dur:nocturnal?rand(3,8):rand(10,30),anim:nocturnal?'sit':h.pose,y:h.y,faceX:h.fx,faceZ:h.fz,label:nocturnal?'Listening for tiny nighttime footsteps':pick(h.labels),bubbles:nocturnal?['👀','🐾']:h.bubbles});
  },
  patron(a){const h=a.home;a.queue.push({t:'wait',dur:rand(15,40),anim:'sit',y:h.y,faceX:h.fx,faceZ:h.fz,label:pick(h.labels),bubbles:h.bubbles});},
  walker(a){const p=lawnTarget(a.x,a.z),dn=a.dog.name;
    a.queue.push({t:'move',x:p.x,z:p.z,speed:rand(.85,1.05),anim:'walk',label:raining?`Walking ${dn} under an umbrella`:`Walking ${dn} across the lawn`});
    a.queue.push({t:'wait',dur:rand(2,5),anim:'idle',label:pick([`Letting ${dn} sniff the flowers`,`Throwing a stick for ${dn}`,'Chatting with a fellow dog owner']),
      bubbles:['🐕','🌸','💬'],bubble:Math.random()<.4?'🐕':undefined});},
  pedestrian(a){
    const n=NODES[a.node],period=Math.floor(state.hour/3);
    if(!a.destination||a.destination===a.node||a.tripPeriod!==period){
      const area=pedestrianDestination(state.hour,Math.random());
      const destinations=Object.values(NODES).filter(p=>p.area===area&&p.id!==a.node);
      a.destination=destinations.length?pick(destinations).id:pick(n.adj).to;a.tripPeriod=period;
    }
    const path=dijkstra(a.node,a.destination),e=n.adj.find(e=>e.to===path[1])||pick(n.adj);
    const nx=NODES[e.to],sp=raining?rand(1.25,1.45):rand(.95,1.2);
    const area={walk:'Strolling along the park',avenue:'Window shopping on the avenue',cafe:'Passing the café',bus:'Walking by the bus stop',
      prom:'Walking along the canal',plaza:'Crossing the plaza',market:'Browsing the market stalls',garden:'Wandering through the community garden',bridge:'Crossing the canal bridge',south:'Strolling the south bank',park:'Wandering the gravel paths',fountain:'Circling the fountain'}[nx.area];
    if(e.cross)a.queue.push({t:'wait',dur:rand(1,2.4),anim:'idle',label:'Looking both ways at the crossing',crossX:nx.x});
    const late=state.hour<5.5||state.hour>=22;
    a.queue.push({t:'move',x:nx.x+rand(-.25,.25),z:nx.z+rand(-.25,.25),speed:sp,anim:'walk',label:e.cross?'Crossing the street':late?'Making their way home through the quiet town':state.hour<10&&NODES[a.destination].area==='bus'?'Heading to the bus for the morning commute':area});
    a.queue.push({t:'fn',fn:()=>{a.prev=a.node;a.node=e.to;}});
    const r=Math.random();
    if(nx.area==='fountain'&&r<.3)a.queue.push({t:'wait',dur:rand(3,6),anim:'idle',label:'Admiring the fountain',faceX:0,faceZ:0,bubble:pick(['🌸','✨','💬'])});
    else if(nx.area==='cafe'&&r<.35)a.queue.push({t:'wait',dur:rand(3,5),anim:'idle',label:'Reading the café chalkboard',faceX:10,faceZ:-21,bubble:'☕'});
    else if(nx.area==='bus'&&r<.3){const st=BUS_STOPS.find(b=>b.node===nx.id);a.queue.push({t:'wait',dur:rand(3,6),anim:'idle',label:'Checking the bus timetable',faceX:st.poleX,faceZ:st.poleZ});}
    else if(nx.area==='prom'&&r<.2)a.queue.push({t:'wait',dur:rand(3,6),anim:'idle',label:'Watching ripples on the canal',faceX:nx.x,faceZ:13,bubble:'♪'});
    else if(r<.05&&!raining)a.queue.push({t:'wait',dur:rand(2,4),anim:'idle',label:'Humming along to their headphones',bubble:'♪'});
  },
};
// ---- spawn the cast ----
function makePerson(role,params,opts={}){
  const P=personParams(params);return new Agent({role,params:P,sheet:personSheet(P),name:uniqueName(NAMES),...opts});
}
function homeAgent(role,seat,{pose='sit',y=.3,place,labels,bubbles,item}){
  const a=makePerson(role,{item},{seeker:true});
  a.home={x:seat.x,z:seat.z,fx:seat.fx,fz:seat.fz,pose,y,place,labels,bubbles};a.setXZ(seat.x,seat.z);a.atHome=true;
  a.group.position.y=pose==='sit'?y:0;a.anim=pose;a.faceDir(seat.fx-seat.x,seat.fz-seat.z);return a;
}
// bench readers & resters around the fountain
[[0,'reader'],[3,'reader'],[4,'rester'],[5,'reader'],[6,'rester']].forEach(([i,role])=>{
  const s=fountainSeats[i];
  homeAgent(role,s,role==='reader'?{place:'the fountain bench',item:'book',labels:['Reading a paperback by the fountain','Lost in a mystery novel','Underlining a favourite line'],bubbles:['📖','♪','☕']}
    :{place:'the fountain bench',item:'cup',labels:['Resting on a sunny bench','Listening to the fountain','Sipping iced tea'],bubbles:['☕','🌸','♪']});
});
homeAgent('canal',canalSeats[1],{place:'the canal bench',item:'cup',labels:['Watching boats on the canal','Feeding imaginary ducks','Enjoying the breeze off the water'],bubbles:['♪','☕','🌸']});
// shade resters under trees
homeAgent('rester',{x:-7.55,z:-2.55,fx:-4,fz:2},{y:-.08,place:'the big oak',labels:['Napping in the tree shade','Daydreaming under the oak'],bubbles:['💤','🌸','♪']});
homeAgent('rester',{x:-8.5,z:4.55,fx:-4,fz:6},{y:-.08,place:'the maple tree',item:'book',labels:['Reading in the maple shade','Watching leaves drift down'],bubbles:['📖','🍂','🌸']});
// picnics
for(const [bx,bz] of [[-6.4,3.25],[5.8,3.35]]){
  homeAgent('picnic',{x:bx-.5,z:bz,fx:bx+3,fz:bz},{y:-.06,place:'the picnic blanket',item:'cup',labels:['Sipping lemonade on a picnic blanket','Sharing sandwiches','Planning the weekend'],bubbles:['🌸','☕','💬','♪']});
  homeAgent('picnic',{x:bx+.45,z:bz+.1,fx:bx-3,fz:bz},{y:-.06,place:'the picnic blanket',item:Math.random()<.5?'book':'cup',labels:['Chatting on the picnic blanket','Snacking on strawberries','Laughing at a story'],bubbles:['💬','🌸','♪']});
}
// conversation clusters
for(const [cx,cz,n,place] of [[19.3,2.2,3,'the plaza'],[8.4,4.6,2,'the lawn'],[-4,9.15,2,'the promenade']]){
  for(let i=0;i<n;i++){const t=i/n*TAU+.4,x=cx+Math.cos(t)*.6,z=cz+Math.sin(t)*.35;
    homeAgent('chatter',{x,z,fx:cx,fz:cz},{pose:'idle',y:0,place,labels:['Catching up with neighbours','Swapping playlist tips','Gossiping about the café’s new pastry','Planning a picnic'],bubbles:['💬','♪','🌸','☕','😄']});}
}
// café patrons (sheltered by the awning)
[[7.4,-.62],[7.4,.62],[10,-.62],[12.6,-.62],[12.6,.62]].forEach(([tx,sx])=>{
  const a=makePerson('patron',{item:'cup'});const x=tx+sx;
  a.home={x,z:-18.9,fx:tx,fz:-18.9,y:.3,labels:['Sipping a flat white','Nibbling a croissant','People-watching from the terrace','Sketching the park'],bubbles:['☕','💬','♪','📖']};
  a.setXZ(x,-18.9);a.group.position.y=.3;a.anim='sit';a.faceDir(tx-x,0);a.cup={x:tx+.12,z:-18.85};
});
// joggers
for(let i=0;i<3;i++){
  const a=makePerson('jogger',{style:'band',shorts:true,shirt:pick(['#e8735f','#7cc4a4','#6a9fd8','#f2b84b'])});
  a.s=rand(0,LOOP_LEN);a.dir=i===1?-1:1;a.v=rand(2,2.5);a.off=rand(-.25,.25);a.laps=randInt(1,4);a.anim='run';
  a.custom=function(dt){this.s+=this.v*this.dir*dt;const p=loopAt(this.s);const nl=Math.hypot(p.tx,p.tz)||1,nx=-p.tz/nl,nz=p.tx/nl;
    const px=this.x,pz=this.z;this.setXZ(p.x+nx*this.off,p.z+nz*this.off);this.addSteps(Math.hypot(this.x-px,this.z-pz)*.7);
    this.faceDir(p.tx*this.dir,p.tz*this.dir);this.laps=1+Math.floor(Math.abs(this.s)/LOOP_LEN);
    this.label=raining?`Jogging through the rain (lap ${this.laps})`:`Jogging the gravel loop — lap ${this.laps}`;
    if(!this.bubble.visible&&Math.random()<dt*.025)this.say(pick(['♪','⚡','💦']));};
}
// cyclists
for(let i=0;i<6;i++){
  const P=personParams({style:'cap',bikeCol:pick(['#d95d5d','#2f6bd8','#f2b84b','#5e9e6e','#e88aa8']),basket:Math.random()<.4});
  const a=new Agent({role:'cyclist',kind:'cyclist',params:P,sheet:bikeSheet(P),name:uniqueName(NAMES)});
  a.lane=i>=4?24.4:i%2?-15.9:-10.1;a.v=(i%2?-1:1)*rand(3,3.8);a.setXZ(rand(GX0,GX0+GW),a.lane);a.bellT=rand(5,30);a.anim='ride';
  a.custom=function(dt){let x=this.x+this.v*dt;const hw=GW/2+2;if(x>hw)x=-hw;if(x<-hw)x=hw;this.setXZ(x,this.lane);this.addSteps(Math.abs(this.v*dt)*.5);
    this.facing=this.v>0?(camRight.x>0?1:-1):(camRight.x>0?-1:1);this.group.visible=Math.abs(x)<GW/2+.2;
    this.label=raining?'Pedalling home through the rain':this.lane>0?'Riding the riverside bike path':this.v>0?'Cruising the park-side bike lane':'Riding the avenue bike lane';
    this.bellT-=dt;if(this.bellT<0){this.bellT=rand(14,40);if(this.group.visible){sound.bikeBell(x/24);this.say('🔔',1.4);}}};
}
// dog walkers & dogs
for(let i=0;i<2;i++){
  const w=makePerson('walker',{},{umbrella:true});const p=lawnTarget(0,0);w.setXZ(p.x,p.z);
  const DP={fur:pick(['#c8894a','#f2e6d0','#3a2f2a','#d9b27c','#8a8a8a']),ear:pick(['#7a4f2a','#2a2228','#c8a070'])};
  const d=new Agent({role:'dog',kind:'dog',params:DP,sheet:dogSheet(DP),name:uniqueName(DOG_NAMES)});
  d.owner=w;w.dog=d;d.setXZ(p.x+.6,p.z+.3);d.track=`“${pick(['the squeaky toy song','zoomies at dusk','belly rub blues','the mailman suite'])}” — ${pick(ARTISTS)}`;
  d.sniffT=0;d.sniff={x:.6,z:.3};d.idleT=0;
  d.custom=function(dt){const o=this.owner;
    this.sniffT-=dt;if(this.sniffT<0){this.sniffT=rand(1.5,4);const t=rand(0,TAU),r=rand(.5,1.1);this.sniff={x:Math.cos(t)*r,z:Math.sin(t)*r*.6};}
    const moving=o.anim==='walk',tx=o.x+(moving?-Math.sign(o.facing)*camRight.x*.7:this.sniff.x),tz=o.z+(moving?-Math.sign(o.facing)*camRight.z*.7+.25:this.sniff.z);
    const dx=tx-this.x,dz=tz-this.z,dd=Math.hypot(dx,dz);
    if(dd>.1){const sp=Math.min(dd*3,2.6)*dt;this.setXZ(this.x+dx/dd*sp,this.z+dz/dd*sp);this.addSteps(sp);this.faceDir(dx,dz);this.anim='trot';this.idleT=0;}
    else{this.idleT+=dt;this.anim=this.idleT>2.5?'sit':'idle';}
    this.label=moving?`Trotting happily beside ${o.name}`:this.anim==='sit'?`Sitting politely for ${o.name}`:'Sniffing every single blade of grass';
    if(!this.bubble.visible&&Math.random()<dt*.04)this.say(pick(['🐕','🦴','💕']));};
  const leash=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:'#3a2a30',transparent:true}));
  leash.frustumCulled=false;scene.add(leash);d.leash=leash;
}
// pedestrians
for(const s of [southSeats[1],southSeats[4]])homeAgent('canal',s,{place:'the south bank bench',item:Math.random()<.5?'book':'cup',labels:['Watching boats drift by','Reading by the water','Counting ripples'],bubbles:['♪','📖','🌸']});
// anglers sitting on the south quay wall, rods out over the canal
const rodMat=new THREE.MeshStandardMaterial({color:'#6b4a2e',roughness:.8}),bobberMat=new THREE.MeshStandardMaterial({color:'#e2452f',roughness:.5});
const lineMat=new THREE.LineBasicMaterial({color:'#e8e4da',transparent:true,opacity:.75});
const fishMat=new THREE.MeshStandardMaterial({color:'#a8cfbd',roughness:.5}),finMat=new THREE.MeshStandardMaterial({color:'#5b9389'});
const eyeMat=new THREE.MeshBasicMaterial({color:'#1e2832'});
const ROD_BUTT=new THREE.Vector3(0,.55,-.05),ROD_TIP=new THREE.Vector3(0,1.75,-1.9);
for(const x of [-26,-12.5,16.5]){
  const a=homeAgent('fisher',{x,z:14.45,fx:x,fz:10},{y:.12,place:'the quay',labels:['Waiting for a bite','Watching the bobber','Re-baiting the hook','Telling the one about the giant carp'],bubbles:['🎣','🐟','💤','♪']});
  const g=new THREE.Group(),dir=ROD_TIP.clone().sub(ROD_BUTT);
  const rod=new THREE.Mesh(new THREE.CylinderGeometry(.015,.03,dir.length(),5).translate(0,dir.length()/2,0),rodMat);
  rod.position.copy(ROD_BUTT);rod.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());rod.castShadow=true;g.add(rod);
  const bob=new THREE.Mesh(new THREE.SphereGeometry(.07,6,4),bobberMat);g.add(bob);
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([ROD_TIP,new THREE.Vector3()]),lineMat);line.frustumCulled=false;g.add(line);
  // A chunky little fish actually leaves the water and dangles from the line.
  const fish=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(.2,.36,.12),fishMat);fish.add(body);
  const tail=new THREE.Mesh(new THREE.BoxGeometry(.3,.13,.1),finMat);tail.position.y=-.22;fish.add(tail);
  for(const z of [-.065,.065]){const eye=new THREE.Mesh(new THREE.BoxGeometry(.045,.045,.015),eyeMat);eye.position.set(.055,.1,z);fish.add(eye);}
  fish.visible=false;g.add(fish);
  const ripple=new THREE.Mesh(new THREE.RingGeometry(.16,.2,16),new THREE.MeshBasicMaterial({color:'#e3f5ea',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
  ripple.rotation.x=-Math.PI/2;g.add(ripple);
  a.group.add(g);a.rod={g,mesh:rod,restAngle:rod.rotation.x,bob,line,fish,ripple,fishing:createFishing(),t:rand(0,TAU)};
}
const rodTip=new THREE.Vector3(),rodAxis=new THREE.Vector3(1,0,0);
function updateRod(a,dt){
  const r=a.rod;r.g.visible=a.atHome&&!a.sheltered&&!raining&&a.anim==='sit'&&a.presence>.5;
  if(!r.g.visible){
    // Leaving for shelter cancels the cast; returning starts at the water.
    if(r.fishing.phase!=='waiting'||r.fishing.elapsed>0)resetFishing(r.fishing);return;
  }
  const f=r.fishing,was=f.phase;r.t+=dt;advanceFishing(f,dt);
  if(f.phase!==was){
    if(f.phase==='bite')a.say('!',1.2);
    if(f.phase==='caught')a.say('🐟',3);
    if(was==='bite'&&f.phase==='waiting')a.say('💦',1.6);
  }
  const t=f.elapsed/f.duration,nib=f.phase==='bite'?(Math.sin(r.t*20)*.5+.5):0;
  // Keep rod, line and water props in the same unrotated space; only the
  // rod mesh tilts so its bobber never floats above the canal when it twitches.
  const lift=f.phase==='reel'?Math.sin(t*Math.PI/2)*.5:f.phase==='caught'?.5:0;
  r.mesh.rotation.x=r.restAngle+lift+nib*.035;
  const surface=.05-a.group.position.y;
  r.bob.visible=f.phase==='waiting'||f.phase==='bite';
  r.bob.position.set(0,surface+Math.sin(r.t*1.8)*.015-nib*.09,-2.2);
  r.fish.visible=f.phase==='reel'||f.phase==='caught';
  const reel=f.phase==='caught'?1:t;
  // Lift the catch beside the angler's silhouette, so it remains visible
  // from either camera orbit instead of disappearing behind their sprite.
  r.fish.position.set(camRight.x*reel*.7+Math.sin(r.t*13)*.06,surface+reel*1.4,-2.2+reel*1.25+camRight.z*reel*.7);
  r.fish.rotation.z=Math.sin(r.t*18)*.28;
  r.ripple.position.set(0,surface+.01,-2.2);
  r.ripple.scale.setScalar(.8+(r.t*2%1)*2);
  r.ripple.material.opacity=(f.phase==='bite'?.55:f.phase==='reel'&&t<.4?.4:0)*(1-r.t*2%1);
  const tip=rodTip.copy(ROD_TIP).sub(ROD_BUTT).applyAxisAngle(rodAxis,lift+nib*.035).add(ROD_BUTT);
  const end=r.fish.visible?r.fish.position:r.bob.position,p=r.line.geometry.attributes.position;
  p.setXYZ(0,tip.x,tip.y,tip.z);p.setXYZ(1,end.x,end.y+(r.fish.visible?.18:.04),end.z);p.needsUpdate=true;
  a.label=f.phase==='bite'?'A bite! Getting ready to reel in':f.phase==='reel'?'Reeling in a wriggling fish!':f.phase==='caught'?`Landed a fish! ${f.catches} caught today`:`Watching the bobber · ${f.catches} fish caught`;
}
homeAgent('picnic',{x:-14.5,z:21.3,fx:-11,fz:21.3},{y:-.06,place:'the riverside picnic',item:'cup',labels:['Picnicking by the river','Sharing a thermos of tea'],bubbles:['☕','🌸','💬']});
homeAgent('picnic',{x:-13.5,z:21.4,fx:-17,fz:21.3},{y:-.06,place:'the riverside picnic',item:'book',labels:['Reading aloud on a blanket','Napping in the sun'],bubbles:['📖','💤','🌸']});
STALLS.slice(0,3).forEach(z=>homeAgent('shopper',{x:-27.5,z:z+rand(-.3,.3),fx:-31,fz:z},{pose:'idle',y:0,place:'the market',
  labels:['Browsing the fruit stall','Haggling over tomatoes','Sniffing fresh bread','Picking out flowers'],bubbles:['🍎','💬','🌸','🥖']}));
for(const [x,z,fz] of [[27,4.55,3.3],[31.8,4.55,5.8]])homeAgent('gardener',{x,z,fx:x+.5,fz},{pose:'idle',y:0,place:'the garden beds',
  labels:['Watering the tomatoes','Pulling weeds','Admiring the carrots'],bubbles:['🌱','🍅','💧']});
for(const [x,z] of [[29,-4.2],[31.5,-3]])homeAgent('player',{x,z,fx:COURT.x0,fz:(COURT.z0+COURT.z1)/2},{pose:'idle',y:0,place:'the court',
  labels:['Shooting hoops','Practising free throws','Trash-talking (kindly)'],bubbles:['🏀','💬','💦']});
// neighbourhood cats
const CAT_NAMES=['Miso','Tofu','Pumpkin','Luna','Socks','Pickles','Biscotti','Saffron','Bean','Olive'];
const CAT_COATS=[{coat:'tabby',fur:'#e8913a',acc:'#b8642a',chest:'#f6e2c4'},{coat:'solid',fur:'#2b2630',chest:'#2b2630'},{coat:'solid',fur:'#f2ede4',chest:'#ffffff'},
  {coat:'tabby',fur:'#8d8f99',acc:'#62646e',chest:'#c9cbd2'},{coat:'calico',fur:'#f2ede4',acc:'#e0913a',acc2:'#2b2630',chest:'#ffffff'},{coat:'solid',fur:'#26222c',chest:'#f4f1ea'},
  {coat:'tabby',fur:'#c9a77c',acc:'#8a6a48',chest:'#f2e6d0'}];
function catWanderTarget(h){
  for(let i=0;i<12;i++){const t=rand(0,TAU),d=rand(.6,h.wander),x=h.x+Math.cos(t)*d,z=h.z+Math.sin(t)*d;
    if(Math.hypot(x,z)<2.7||((x-7.4)/2.25)**2+((z+3.2)/1.5)**2<1||(z>9.9&&z<14.6)||z<-19.9||(x<-28.5&&x>-29.6)||Math.abs(x)>GW/2-.5)continue;
    return {x,z};}
  return {x:h.x,z:h.z};
}
CAT_COATS.forEach((coat,i)=>{
  const home=[
    {...fountainSeats[1],pose:'sleep',y:.45,wander:0,labels:['Sunbathing on a bench','Napping beside a stranger','Purring in the sun'],bubbles:['💤','💕']},
    {x:10,z:-19.75,fx:10,fz:-12,pose:'sleep',y:0,wander:1.4,labels:['Napping in the café doorway','Waiting for croissant crumbs'],bubbles:['💤','☕','🐟']},
    {x:5.05,z:-3,fx:7.4,fz:-3.2,pose:'sit',y:0,wander:1.2,labels:['Watching the koi very intently','Plotting against the pond'],bubbles:['🐟','👀','💭']},
    {x:-27.9,z:.6,fx:-31,fz:.6,pose:'sit',y:0,wander:1.6,labels:['Eyeing the fish stall','Charming the stallkeepers'],bubbles:['🐟','💕','😼']},
    {x:-2,z:21,fx:0,fz:12,pose:'sleep',y:0,wander:2.5,labels:['Sunbathing on the riverbank','Watching boats drift by'],bubbles:['💤','🌸']},
    {x:-14.8,z:2,fx:-12,fz:2,pose:'groom',y:0,wander:2.5,labels:['Grooming on the sidewalk','Inspecting the hedge'],bubbles:['🐾','💕']},
    {x:30.4,z:4.55,fx:29.6,fz:3.3,pose:'sit',y:0,wander:1.5,labels:['Supervising the gardeners','Hunting a butterfly'],bubbles:['🦋','🌱','😼']},
  ][i];
  const P={...coat,eye:pick(['#9bd84a','#f2c94c','#6fc3f0'])};
  const a=new Agent({role:'cat',kind:'cat',params:P,sheet:catSheet(P),name:uniqueName(CAT_NAMES),seeker:true});
  a.home=home;a.setXZ(home.x,home.z);a.atHome=true;a.anim=home.pose;a.group.position.y=home.y;a.faceDir(home.fx-home.x,home.fz-home.z);
  a.mood=pick(['😼 Smug','😺 Curious','😸 Content','😽 Affectionate','😾 Aloof']);
  a.track=`“${pick(['purr in C minor','window sill afternoons','3am zoomies','cardboard box dreams','the red dot étude'])}” — ${pick(ARTISTS)}`;
});
const PED_START=['S2','F3','F7','P3','P5','E2','W2','R2','S4','F5','Fb','M2','G2','SB2','SB4','Pa','Se','BR'];
PED_START.forEach((id,i)=>{const a=makePerson('pedestrian',{},{umbrella:true});const n=NODES[id];a.node=id;a.setXZ(n.x,n.z);if(i%3===0)a.queue.push({t:'wait',dur:rand(0,3),anim:'idle'});});
// Evenly spaced within each role: a small cast still gets a useful range of
// schedules, without all three anglers or all café patrons leaving together.
for(const role of new Set(agents.map(a=>a.role))){
  const cast=agents.filter(a=>a.role===role);
  cast.forEach((a,i)=>{a.scheduleRank=(i+.5)/cast.length;});
}
// selection marker
export const marker=new THREE.Mesh(GEO.marker,new THREE.MeshBasicMaterial({map:markerTex,alphaTest:.5,side:THREE.DoubleSide,fog:false}));marker.visible=false;scene.add(marker);
// parked bikes (static billboards)
for(const z of [-5.4,-3.8]){const P={bikeCol:pick(['#d95d5d','#2f6bd8','#5e9e6e']),basket:Math.random()<.5};
  const m=new THREE.Mesh(GEO.bike,new THREE.MeshBasicMaterial({map:pixTex(bikeSheet(P,false).canvas),alphaTest:.5,side:THREE.DoubleSide}));
  m.material.map.repeat.set(.5,1);m.rotation.order='YXZ';m.position.set(14.7,0,z);scene.add(m);staticBillboards.push(m);spriteMats.push(m.material);}

export function setRaining(v){
  if(raining===v)return;raining=v;
  for(const a of agents){if(a.shelterSeeker)a.interrupt(rand(.2,v?2.5:4));else if(a.umb&&v&&Math.random()<.5)a.say('☂',1.4);}
}
