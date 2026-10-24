import test from 'node:test';
import assert from 'node:assert/strict';

// These assertions catch skipped weather stages, rapid changes, long stalls,
// catch-up bursts after sleep, and frame-rate-dependent fades.
import * as weather from '../src/weather-cycle.js';
const available=()=>assert.equal(typeof weather.createWeatherCycle,'function','weather scheduler is available');
test('dynamic weather stays put for 5–12 minutes before taking a neighboring step',()=>{
  available();
  const neighbors={clear:['overcast'],overcast:['clear','drizzle','fog'],fog:['overcast'],drizzle:['overcast','rain'],rain:['drizzle','storm'],storm:['rain']};
  for(const initial of Object.keys(neighbors))for(const value of [0,.25,.5,.75,.999999]){
    const random=()=>value,cycle=weather.createWeatherCycle(initial,random);
    for(let i=0;i<40;i++){
      assert.ok(cycle.remaining>=300&&cycle.remaining<=720);
      const before=cycle.weather;
      assert.equal(weather.advanceWeatherCycle(cycle,cycle.remaining-.01,random),false);
      assert.equal(cycle.weather,before);
      assert.equal(weather.advanceWeatherCycle(cycle,.02,random),true);
      assert.ok(neighbors[before].includes(cycle.weather),`${before} -> ${cycle.weather}`);
    }
  }
});
test('a clearing storm passes through rain, drizzle and overcast before clear',()=>{
  available();
  const cycle=weather.createWeatherCycle('storm',()=>.5),seen=[];
  for(let i=0;i<4;i++){
    weather.advanceWeatherCycle(cycle,cycle.remaining,()=>.5);seen.push(cycle.weather);
  }
  assert.deepEqual(seen,['rain','drizzle','overcast','clear']);
});
test('returning after a long sleep makes at most one change and starts a fresh hold',()=>{
  available();
  const cycle=weather.createWeatherCycle('storm',()=>.5);
  weather.advanceWeatherCycle(cycle,36000,()=>.5);
  assert.equal(cycle.weather,'rain');
  assert.ok(cycle.remaining>=300);
  assert.equal(weather.advanceWeatherCycle(cycle,1,()=>.5),false);
});
test('weather blends gradually and consistently across frame rates',()=>{
  assert.equal(typeof weather.blendWeather,'function');
  const fine={rain:1,cloud:1},coarse={...fine},target={rain:0,cloud:0};
  weather.blendWeather(coarse,target,1,true);
  assert.ok(coarse.rain>.85&&coarse.rain<1);
  for(let i=0;i<60;i++)weather.blendWeather(fine,target,1/60,true);
  assert.ok(Math.abs(fine.rain-coarse.rain)<1e-10);
  weather.blendWeather(coarse,target,29,true);
  assert.ok(coarse.rain<.03);
});
