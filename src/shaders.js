import * as THREE from 'three';
import { scene } from './renderer.js';
import { GD, GW, GX0, GZ0 } from './ground.js';

/* =====================================================================
   4. Shaders for water, ground fog and particles
   ===================================================================== */
export const waters=[];
export function makeWater({deep='#1f5a73',shallow='#3f8fa6',opacity=1,flow=[0,0],glow=0}={}){
  const m=new THREE.ShaderMaterial({transparent:opacity<1,depthWrite:opacity>=1,
    uniforms:{uTime:{value:0},uRain:{value:0},uOpacity:{value:opacity},uGlow:{value:0},uGlowK:{value:glow},
      uDeep:{value:new THREE.Color(deep)},uShallow:{value:new THREE.Color(shallow)},uSky:{value:new THREE.Color('#9fd0ff')},
      uLamp:{value:new THREE.Color(0,0,0)},uTint:{value:new THREE.Color(1,1,1)},uFlow:{value:new THREE.Vector2(...flow)}},
    vertexShader:`varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform float uTime,uRain,uOpacity,uGlow,uGlowK;uniform vec3 uDeep,uShallow,uSky,uLamp,uTint;uniform vec2 uFlow;varying vec3 vW;
    float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){
      vec2 p=floor(vW.xz*8.)/8.;vec2 q=p+uFlow*uTime;
      float w1=sin(q.x*2.1+uTime*1.3+sin(q.y*1.7+uTime*.7)*1.5);
      float w2=sin(q.y*2.7-uTime*1.1+sin(q.x*1.3)*1.2);
      float wv=(w1+w2)*.5;
      vec3 col=mix(uDeep,uShallow,.5+.3*wv);
      col=mix(col,uSky,.3);
      float hl=step(.83,wv*.5+.5+(h21(p)-.5)*.16);
      col+=hl*(uSky*.35+uLamp);
      vec2 cell=floor(p/1.1);vec2 f=p-cell*1.1;vec2 c=vec2(h21(cell),h21(cell+7.))*.7+.2;
      float ph=fract(uTime*.85+h21(cell+3.));float ring=1.-smoothstep(0.,.07,abs(length(f-c)-ph*.5));
      col+=ring*(1.-ph)*uRain*.55*(uSky+.25);
      col+=uGlow*uGlowK*vec3(.18,.42,.55);
      col=floor(col*14.)/14.;
      gl_FragColor=vec4(col*uTint,uOpacity);}`});
  waters.push(m);return m;
}
const NOISE_GLSL=`float hh(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=vn(p)*a;p*=2.03;a*=.5;}return s;}`;
export const fogMats=[];
for(const [y,k] of [[.35,1],[.95,.8],[1.7,.55]]){
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{uTime:{value:0},uAmt:{value:0},uK:{value:k},uOff:{value:y*13.},uColor:{value:new THREE.Color('#dfe6ee')}},
    vertexShader:`varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:NOISE_GLSL+`uniform float uTime,uAmt,uK,uOff;uniform vec3 uColor;varying vec3 vW;
    void main(){vec2 p=vW.xz*.11+vec2(uTime*.035+uOff,uTime*.013);float n=fbm(p+fbm(p*1.6+uTime*.02));
      float a=smoothstep(.35,.85,n)*uAmt*uK;vec2 e=smoothstep(vec2(0.),vec2(4.),vec2(${(GW/2).toFixed(1)},${(GD/2).toFixed(1)})-abs(vW.xz-vec2(${(GX0+GW/2).toFixed(1)},${(GZ0+GD/2).toFixed(1)})));a*=e.x*e.y;
      a=floor(a*10.)/10.;gl_FragColor=vec4(uColor,a);}`});
  const p=new THREE.Mesh(new THREE.PlaneGeometry(GW,GD).rotateX(-Math.PI/2),m);p.position.set(0,y,GZ0+GD/2);p.renderOrder=5;scene.add(p);fogMats.push(m);
}
const PT_VS=`attribute vec3 aColor;attribute float aSize;attribute float aAlpha;varying vec3 vC;varying float vA;uniform float uScale;
void main(){vC=aColor;vA=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=max(1.,aSize*uScale/-mv.z);}`;
const PT_FS=`uniform float uSoft,uTintAmt;uniform vec3 uTint;varying vec3 vC;varying float vA;
void main(){float d=length(gl_PointCoord-.5);float a=uSoft>.5?smoothstep(.5,.05,d):1.;a*=vA;if(a<.01)discard;
  gl_FragColor=vec4(vC*mix(vec3(1.),uTint,uTintAmt),a);}`;
export const clouds=[];
export class PointCloud{
  constructor(n,{additive=false,soft=false,tint=true}={}){
    this.n=n;this.pos=new Float32Array(n*3);this.col=new Float32Array(n*3);this.size=new Float32Array(n);this.alpha=new Float32Array(n);
    const g=this.geo=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(this.pos,3));g.setAttribute('aColor',new THREE.BufferAttribute(this.col,3));
    g.setAttribute('aSize',new THREE.BufferAttribute(this.size,1));g.setAttribute('aAlpha',new THREE.BufferAttribute(this.alpha,1));
    this.mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,
      uniforms:{uScale:{value:1},uSoft:{value:soft?1:0},uTint:{value:new THREE.Color(1,1,1)},uTintAmt:{value:tint?1:0}},vertexShader:PT_VS,fragmentShader:PT_FS});
    this.obj=new THREE.Points(g,this.mat);this.obj.frustumCulled=false;this.obj.renderOrder=6;scene.add(this.obj);clouds.push(this);
  }
  setColor(i,c){this.col[i*3]=c.r;this.col[i*3+1]=c.g;this.col[i*3+2]=c.b;}
  commit(){for(const k of ['position','aColor','aSize','aAlpha'])this.geo.attributes[k].needsUpdate=true;}
}
