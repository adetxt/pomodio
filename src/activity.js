// Daily demand uses the same hour as the sky and the time slider. Values are
// fractions of the existing cast, interpolated smoothly across midnight.
const HOURS=[0,4,5.5,7,9,12,15,18,20,22,24];
const PROFILES={
  pedestrian:[.12,.05,.14,.75,.95,.8,.85,1,.6,.25,.12],
  patron:    [.08,0,0,.75,1,.7,.8,.9,.55,.25,.08],
  reader:    [0,0,0,.2,.7,1,.95,.6,.1,0,0],
  rester:    [0,0,0,.15,.6,.95,1,.65,.1,0,0],
  picnic:    [0,0,0,0,.2,1,.85,.7,.05,0,0],
  chatter:   [.05,0,0,.15,.5,.65,.8,1,.65,.15,.05],
  canal:     [.05,0,.1,.4,.65,.85,.9,1,.5,.1,.05],
  fisher:    [0,0,.4,1,.8,.65,.65,1,.2,0,0],
  shopper:   [0,0,0,.2,.85,1,.8,.4,0,0,0],
  gardener:  [0,0,.15,.85,1,.55,.7,.3,0,0,0],
  player:    [0,0,0,.15,.4,.65,.9,1,.35,0,0],
  jogger:    [0,0,.3,1,.65,.3,.4,.9,.35,.05,0],
  cyclist:   [.05,.02,.15,.9,1,.55,.65,1,.4,.15,.05],
  walker:    [.05,0,.2,.9,.65,.6,.65,1,.45,.1,.05],
  cat:       [1,1,1,1,1,1,1,1,1,1,1],
};
const wrap=h=>((h%24)+24)%24;
function sample(values,hour){
  const h=wrap(hour);let i=0;while(i<HOURS.length-2&&h>=HOURS[i+1])i++;
  const t=(h-HOURS[i])/(HOURS[i+1]-HOURS[i]),s=t*t*(3-2*t);
  return values[i]+(values[i+1]-values[i])*s;
}
export const activityLevel=(role,hour)=>sample(PROFILES[role]||PROFILES.pedestrian,hour);
export function presenceFor(role,hour,rank){
  const level=activityLevel(role,hour);
  // Different ranks stagger the cast. The agent eases toward this definite
  // target in seconds, so nobody stays half-transparent for an entire hour.
  return level>0&&level>=rank?1:0;
}
// Seconds offstage between trips, rather than implausibly changing bus speed.
export const busHeadway=hour=>sample([150,190,100,10,12,30,28,9,45,95,150],hour);
export function pedestrianDestination(hour,choice){
  const h=wrap(hour);
  const areas=h<5.5||h>=22?['avenue','bus','cafe']:
    h<10?['bus','cafe','avenue','garden']:h<16?['market','cafe','fountain','garden','south']:
    h<21?['prom','cafe','plaza','south','fountain']:['avenue','cafe','bus'];
  return areas[Math.min(areas.length-1,Math.floor(choice*areas.length))];
}
