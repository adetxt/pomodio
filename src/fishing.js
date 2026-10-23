// Fishing state is separate from its meshes so time and outcomes can be tested
// without a renderer. A missed bite is always followed by a successful catch.
const wait=random=>8+random()*10;
export function createFishing(random=Math.random){return {phase:'waiting',elapsed:0,duration:wait(random),catches:0,missed:false};}
export function resetFishing(f,random=Math.random){f.phase='waiting';f.elapsed=0;f.duration=wait(random);}
export function advanceFishing(f,dt,random=Math.random){
  f.elapsed+=dt;
  if(f.elapsed<f.duration)return;
  f.elapsed=0;
  switch(f.phase){
    case 'waiting':f.phase='bite';f.duration=1.4;break;
    case 'bite':
      if(!f.missed&&random()>.82){f.missed=true;f.phase='waiting';f.duration=wait(random);}
      else{f.phase='reel';f.duration=2.4;}
      break;
    case 'reel':f.phase='caught';f.duration=3.2;f.catches++;f.missed=false;break;
    default:f.phase='waiting';f.duration=wait(random);
  }
}
