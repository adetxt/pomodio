import test from 'node:test';
import assert from 'node:assert/strict';
import { activityLevel, presenceFor, busHeadway, pedestrianDestination } from '../src/activity.js';
import { createFishing, advanceFishing } from '../src/fishing.js';

test('the town is much quieter at 3am than at midday',()=>{
  const roles=['pedestrian','patron','reader','rester','picnic','chatter','canal','fisher','shopper','gardener','player','jogger','cyclist','walker'];
  const count=h=>roles.reduce((n,role)=>n+Array.from({length:20},(_,i)=>presenceFor(role,h,(i+.5)/20)).reduce((a,b)=>a+b,0),0);
  assert.ok(count(3)<count(12)*.15);
  for(const role of ['fisher','picnic','shopper','gardener','player'])assert.equal(activityLevel(role,3),0,role);
});
test('different daily routines change the mix of activities',()=>{
  assert.ok(activityLevel('jogger',7)>activityLevel('jogger',12)*2);
  assert.ok(activityLevel('shopper',11)>activityLevel('shopper',21)*3);
  assert.ok(activityLevel('chatter',18)>activityLevel('chatter',7)*2);
  assert.ok(activityLevel('fisher',6.5)>activityLevel('fisher',23));
  assert.notEqual(presenceFor('pedestrian',8,.2),presenceFor('pedestrian',8,.95));
});
test('schedules wrap continuously at midnight and stay within bounds',()=>{
  for(const role of ['pedestrian','patron','cat','jogger','fisher']){
    assert.equal(activityLevel(role,0),activityLevel(role,24));
    assert.equal(activityLevel(role,-1),activityLevel(role,23));
    assert.ok(Math.abs(activityLevel(role,23.999)-activityLevel(role,.001))<.01);
    for(let h=0;h<24;h+=.1)for(const rank of [.1,.5,.9]){
      const p=presenceFor(role,h,rank);assert.ok(p>=0&&p<=1);
    }
  }
});
test('bus service is more frequent at rush hour and sparse overnight',()=>{
  assert.ok(busHeadway(8)<busHeadway(12));
  assert.ok(busHeadway(18)<busHeadway(12));
  assert.ok(busHeadway(3)>busHeadway(12)*4);
  assert.equal(busHeadway(0),busHeadway(24));
});
test('walking destinations follow morning errands, daytime shopping, and evening strolls',()=>{
  assert.equal(pedestrianDestination(8,.1),'bus');
  assert.equal(pedestrianDestination(12,.1),'market');
  assert.equal(pedestrianDestination(19,.1),'prom');
  assert.equal(pedestrianDestination(3,.1),'avenue');
});
test('anglers visibly reel and land fish repeatedly within a bounded wait',()=>{
  const f=createFishing(()=>.5),seen=new Set();
  for(let t=0;t<80;t+=.05){advanceFishing(f,.05,()=>.5);seen.add(f.phase);}
  assert.ok(seen.has('bite'));assert.ok(seen.has('reel'));assert.ok(seen.has('caught'));
  assert.ok(f.catches>=2);
});
test('a missed bite cannot prevent the next catch, even with unlucky randomness',()=>{
  const f=createFishing(()=>.99);
  for(let t=0;t<90;t+=.05)advanceFishing(f,.05,()=>.99);
  assert.ok(f.catches>=1);
});

test('leaving the quay cancels a cast without erasing landed fish',async()=>{
  const {resetFishing}=await import('../src/fishing.js');
  assert.equal(typeof resetFishing,'function');
  const f=createFishing(()=>.5);
  for(let t=0;t<20;t+=.05)advanceFishing(f,.05,()=>.5);
  assert.ok(f.catches>=1);
  const catches=f.catches;f.phase='reel';f.elapsed=1;f.duration=2.4;
  resetFishing(f,()=>.5);
  assert.equal(f.phase,'waiting');assert.equal(f.elapsed,0);assert.equal(f.catches,catches);
  for(let t=0;t<7;t+=.05)advanceFishing(f,.05,()=>.5);
  assert.equal(f.phase,'waiting','returning from shelter should begin a fresh wait');
});

test('residents settle fully present or absent instead of staying translucent for hours',()=>{
  for(const role of ['pedestrian','reader','fisher','cyclist'])for(const hour of [6.5,8,12,18,21])for(const rank of [.15,.5,.85]){
    const target=presenceFor(role,hour,rank);
    assert.ok(target===0||target===1,`${role} at ${hour} should have a definite attendance target`);
  }
});
