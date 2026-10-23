import { lerp } from './utils.js';
import { LOOP, PATHS } from './ground.js';

/* =====================================================================
   7. Navigation graph (sidewalks, crossings, park paths)
   ===================================================================== */
export const NODES={};
function node(id,x,z,area){NODES[id]={id,x,z,area,adj:[]};return id;}
function edge(a,b,cross=false){NODES[a].adj.push({to:b,cross});NODES[b].adj.push({to:a,cross});}
function chain(ids){for(let i=1;i<ids.length;i++)edge(ids[i-1],ids[i]);}
export const nearestNode=(x,z,filter)=>{let best=null,bd=1e9;for(const n of Object.values(NODES)){if(filter&&!filter(n))continue;const d=Math.hypot(n.x-x,n.z-z);if(d<bd){bd=d;best=n.id;}}return best;};
// jogging loop polyline (rounded rectangle)
const LOOP_PTS=(()=>{const {bx,bz,r}=LOOP,a=bx-r,b=bz-r,pts=[],step=.2;
  const line=(x0,z0,x1,z1)=>{const n=Math.ceil(Math.hypot(x1-x0,z1-z0)/step);for(let i=0;i<n;i++)pts.push({x:lerp(x0,x1,i/n),z:lerp(z0,z1,i/n)});};
  const arc=(cx,cz,t0)=>{const n=Math.ceil(r*Math.PI/2/step);for(let i=0;i<n;i++){const t=t0+i/n*Math.PI/2;pts.push({x:cx+Math.cos(t)*r,z:cz+Math.sin(t)*r});}};
  line(-a,-bz,a,-bz);arc(a,-b,-Math.PI/2);line(bx,-b,bx,b);arc(a,b,0);line(a,bz,-a,bz);arc(-a,b,Math.PI/2);line(-bx,b,-bx,-b);arc(-a,-b,Math.PI);return pts;})();
export const LOOP_LEN=LOOP_PTS.length*.2;
export function loopAt(s){const n=LOOP_PTS.length,f=((s/.2)%n+n)%n,i=Math.floor(f),t=f-i,p=LOOP_PTS[i],q=LOOP_PTS[(i+1)%n];
  return {x:lerp(p.x,q.x,t),z:lerp(p.z,q.z,t),tx:q.x-p.x,tz:q.z-p.z};}
{
  const loopIds=[];for(let i=0;i<LOOP_PTS.length;i+=7)loopIds.push(node('L'+i,LOOP_PTS[i].x,LOOP_PTS[i].z,'park'));
  chain(loopIds);edge(loopIds[loopIds.length-1],loopIds[0]);
  const toLoop=id=>{const n=NODES[id];const near=loopIds.map(l=>[l,Math.hypot(NODES[l].x-n.x,NODES[l].z-n.z)]).sort((a,b)=>a[1]-b[1]).slice(0,2);near.forEach(([l])=>edge(id,l));};
  const ring=[];for(let k=0;k<8;k++){const t=k*Math.PI/4;ring.push(node('R'+k,Math.cos(t)*2.95,Math.sin(t)*2.95,'fountain'));}chain(ring);edge('R7','R0');
  for(const p of PATHS){const ids=[.3,.6].map((t,j)=>{const q=p.pts[Math.round(t*(p.pts.length-1))];return node(p.id+j,q.x,q.z,'park');});
    const end=p.pts[p.pts.length-1],eid=node(p.id+'end',end.x,end.z,'park'),st=p.pts[0];
    edge(nearestNode(st.x,st.z,n=>n.area==='fountain'),ids[0]);chain([...ids,eid]);toLoop(eid);}
  chain([node('S1',-14.75,-8.75,'walk'),node('S2',-6,-8.75,'walk'),node('S3',0,-8.75,'walk'),node('S4',6,-8.75,'walk'),node('S5',14.75,-8.75,'walk'),node('BUS',17.3,-8.75,'bus'),node('S6',22.5,-8.75,'walk')]);
  chain([node('F1',-22.5,-17.7,'avenue'),node('F2',-14.75,-17.7,'avenue'),node('BUSN',-13.5,-17.7,'bus'),node('F3',-6,-17.7,'avenue'),node('F4',0,-17.7,'avenue'),node('F5',6,-17.7,'avenue'),node('F6',10,-17.7,'cafe'),node('F7',14.75,-17.7,'avenue'),node('F8',22.5,-17.7,'avenue')]);
  edge('S2','F3',true);edge('S4','F5',true);
  chain(['S1',node('W1',-14.75,-4,'walk'),node('W2',-14.75,0,'walk'),node('W3',-14.75,4,'walk'),node('P2',-14.75,9,'prom')]);
  chain([node('P1',-22.5,9,'prom'),'P2',node('P3',-7,9,'prom'),node('P4',0,9,'prom'),node('P5',7,9,'prom'),node('P6',14.75,9,'prom'),node('P7',22.5,9,'prom')]);
  chain(['S5',node('E1',14.75,-4,'plaza'),node('E2',14.75,0,'plaza'),node('E3',14.75,4,'plaza'),'P6']);
  chain(['E2',node('E4',19.5,-1,'plaza'),node('E5',20,4.5,'plaza'),'E3']);edge('E4','BUS');
  chain([node('Sa',-34,-8.75,'walk'),node('Sb',-27.5,-8.75,'walk'),node('Sc',-21,-8.75,'walk'),'S1']);
  chain(['S6',node('Sd',25.5,-8.75,'walk'),node('Se',34,-8.75,'walk')]);
  chain([node('Fa',-34,-17.7,'avenue'),node('Fb',-27.5,-17.7,'avenue'),'F1']);chain(['F8',node('Fc',25.5,-17.7,'avenue'),node('Fd',34,-17.7,'avenue')]);
  edge('Sb','Fb',true);edge('Sd','Fc',true);
  chain([node('Pa',-34,9,'prom'),node('Pm',-27.5,9,'prom'),'P1']);chain(['P7',node('Pg',25.5,9,'prom'),node('Pb',34,9,'prom')]);
  chain(['Sb',node('M1',-27.4,-5.5,'market'),node('M2',-27.4,-1,'market'),node('M3',-27.4,3.5,'market'),'Pm']);
  chain(['Sd',node('G1',25.5,-4,'garden'),node('G2',25.5,1.8,'garden'),node('G3',25.5,6,'garden'),'Pg']);edge('G2',node('G4',31,1.8,'garden'));edge('E4','G2');
  node('Pbr',-4,9,'prom');edge('P3','Pbr');edge('Pbr','P4');
  chain(['Pbr',node('BR',-4,12.3,'bridge'),node('SBb',-4,18.2,'south')]);
  chain([node('SB1',-34,18.2,'south'),node('SB2',-20,18.2,'south'),'SBb',node('SB3',10,18.2,'south'),node('SB4',24,18.2,'south'),node('SB5',34,18.2,'south')]);
  edge('SB3',node('GZ',12,21.2,'south'));
  for(const [id,x,z,out] of [['GN1',-6,-7.3,'S2'],['GN2',6,-7.3,'S4'],['GS',0,7.3,'P4'],['GW',-12.2,0,'W2'],['GE',12.2,0,'E2']]){node(id,x,z,'park');edge(id,out);toLoop(id);}
}
export function dijkstra(s,t){
  const dist={},prev={},Q=new Set(Object.keys(NODES));for(const k of Q)dist[k]=Infinity;dist[s]=0;
  while(Q.size){let u=null;for(const k of Q)if(u===null||dist[k]<dist[u])u=k;Q.delete(u);if(u===t||dist[u]===Infinity)break;
    for(const e of NODES[u].adj){if(!Q.has(e.to))continue;const alt=dist[u]+Math.hypot(NODES[u].x-NODES[e.to].x,NODES[u].z-NODES[e.to].z);if(alt<dist[e.to]){dist[e.to]=alt;prev[e.to]=u;}}}
  const path=[];let u=t;while(u!==undefined){path.unshift(u);u=prev[u];}return path[0]===s?path:[s,t];
}
export const isCross=(a,b)=>NODES[a].adj.some(e=>e.to===b&&e.cross);
// vehicles on the avenue ({x,len}, kept current by traffic.js); pedestrians hold at a crossing while one is close
export const vehicles=[];
export const crossingClear=x=>vehicles.every(v=>v.active===false||Math.abs(v.x-x)>v.len/2+3);
