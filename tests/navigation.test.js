import test from 'node:test';
import assert from 'node:assert/strict';
import { routeSteps } from '../src/nav.js';

// Check the actual motion between waypoints, including the first/last leg.
function assertDryRoute(start,steps){
  let p=start;
  for(const q of steps){
    if(q.t!=='move')continue;
    const samples=Math.ceil(Math.hypot(q.x-p.x,q.z-p.z)/.02);
    for(let i=0;i<=samples;i++){
      const t=samples?i/samples:0,x=p.x+(q.x-p.x)*t,z=p.z+(q.z-p.z)*t;
      assert.ok(z<=10||z>=14.24||(x>=-5.1&&x<=-2.9),`route walks on water at (${x.toFixed(2)}, ${z.toFixed(2)})`);
    }
    p=q;
  }
}

const homes=[-26,-12.5,16.5].map(x=>({x,z:14.45}));
const shelters=[{x:12,z:21.2},{x:17.65,z:-8},{x:-13.9,z:-19.55},{x:10,z:-19}];
for(const [label,reverse] of [['escaping rain',false],['returning to fish',true]]){
  test(`anglers stay on dry land when ${label}`,()=>{
    for(const home of homes)for(const shelter of shelters)for(const random of [()=>0,()=>.5,()=>.999]){
      const [start,end]=reverse?[shelter,home]:[home,shelter];
      const steps=routeSteps(start,end.x,end.z,{hurry:!reverse,random});
      assertDryRoute(start,steps);
      assert.deepEqual({x:steps.at(-1).x,z:steps.at(-1).z},end);
    }
  });
}

test('weather changes midway through a route keep anglers on land or the bridge',()=>{
  for(const home of homes){
    const steps=routeSteps(home,17.65,-8,{random:()=>.5});
    let p=home;
    for(const q of steps){
      if(q.t!=='move')continue;
      for(const t of [.1,.5,.9]){
        const start={x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t};
        assertDryRoute(start,routeSteps(start,home.x,home.z,{random:()=>.999}));
      }
      p=q;
    }
  }
});

test('hurrying anglers still wait for traffic when crossing the avenue',()=>{
  const steps=routeSteps(homes[0],-13.9,-19.55,{hurry:true,random:()=>.5});
  assert.ok(steps.some(s=>s.t==='wait'&&s.crossX!==undefined));
});
