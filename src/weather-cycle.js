// Active weather fronts move one step at a time, with a bias to keep moving
// in the same direction rather than oscillating between two presets.
const NEIGHBORS={
  clear:[['overcast',1]],
  overcast:[['clear',1],['drizzle',1],['fog',.15]],
  fog:[['overcast',1]],
  drizzle:[['overcast',1],['rain',1]],
  rain:[['drizzle',1],['storm',.6]],
  storm:[['rain',1]],
};
const HOLD={clear:[480,720],overcast:[300,540],fog:[300,540],drizzle:[300,480],rain:[300,540],storm:[300,420]};
function hold(weather,random){const [min,max]=HOLD[weather];return min+random()*(max-min);}
export function createWeatherCycle(weather,random=Math.random){
  return {weather,previous:null,remaining:hold(weather,random)};
}
export function advanceWeatherCycle(cycle,dt,random=Math.random){
  cycle.remaining-=Math.max(0,dt);
  if(cycle.remaining>0)return false;
  const options=NEIGHBORS[cycle.weather].map(([weather,weight])=>[weather,weight*(weather===cycle.previous ? .2 : 1)]);
  let draw=random()*options.reduce((sum,[,weight])=>sum+weight,0);
  let next=options.at(-1)[0];
  for(const [weather,weight] of options){draw-=weight;if(draw<0){next=weather;break;}}
  cycle.previous=cycle.weather;cycle.weather=next;
  // Discard overdue time: returning to a background tab must not fast-forward
  // through an entire front or immediately trigger another change.
  cycle.remaining=hold(next,random);
  return true;
}
export function blendWeather(current,target,dt,dynamic=false){
  const k=1-Math.exp(-Math.max(0,dt)*(dynamic?1/8:.45));
  for(const key of Object.keys(target))current[key]+=(target[key]-current[key])*k;
}
