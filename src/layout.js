// Shared path geometry, independent of rendering.
export const LOOP={bx:11.2,bz:6.4,r:2.5,hw:.65};
// Winding gravel paths: quadratic béziers from the fountain plaza out to the jogging loop.
function bez(p0,p1,p2,step=.15){const len=Math.hypot(p1[0]-p0[0],p1[1]-p0[1])+Math.hypot(p2[0]-p1[0],p2[1]-p1[1]);const n=Math.ceil(len/step),o=[];
  for(let i=0;i<=n;i++){const t=i/n,u=1-t;o.push({x:u*u*p0[0]+2*u*t*p1[0]+t*t*p2[0],z:u*u*p0[1]+2*u*t*p1[1]+t*t*p2[1]});}return o;}
export const PATHS=[
  {id:'N',pts:bez([0,-3.6],[1.3,-5],[0,-6.4])},{id:'S',pts:bez([0,3.6],[-1.3,5],[0,6.4])},
  {id:'W',pts:bez([-3.6,0],[-7.4,-1.4],[-11.2,0])},{id:'E',pts:bez([3.6,0],[7.4,1.4],[11.2,0])},
];
