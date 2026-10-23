import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clamp } from './utils.js';
import { state } from './state.js';

/* =====================================================================
   1. Renderer, camera, tilt-shift post-processing
   ===================================================================== */
export const canvasEl=document.getElementById('scene');
export const renderer=new THREE.WebGLRenderer({canvas:canvasEl,antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate=false; // refreshed at 15Hz from the main loop
renderer.setClearColor(0x000000,0);

export const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0x8899aa,400,600);
// Narrow-FOV perspective from far away keeps the miniature look; the slight convergence keeps the ground reading as a
// rectangle while orbiting (an orthographic view shears it into a parallelogram that the eye reads as a trapezium).
const CAM_DIST=240;
export const camera=new THREE.PerspectiveCamera(10,1,10,1000);
export const controls=new OrbitControls(camera,canvasEl);
controls.target.set(0,0,-3.5);
camera.position.setFromSpherical(new THREE.Spherical(CAM_DIST,0.98,0.42)).add(controls.target);
Object.assign(controls,{enableDamping:true,dampingFactor:0.08,minPolarAngle:0.62,maxPolarAngle:1.22,minAzimuthAngle:-1.15,maxAzimuthAngle:1.15,
  minDistance:CAM_DIST/4.5,maxDistance:CAM_DIST/.8,rotateSpeed:0.45,zoomSpeed:2.4,screenSpacePanning:false});
// camera follow: keep the target on the diorama and track the view azimuth for billboards
export const camRight=new THREE.Vector3(1,0,0);
export let camAz=0,camDist=CAM_DIST;
const _off=new THREE.Vector3();
export function updateCamera(){
  controls.update();
  _off.copy(camera.position).sub(controls.target);controls.target.x=clamp(controls.target.x,-30,30);controls.target.z=clamp(controls.target.z,-26,20);controls.target.y=0;
  camera.position.copy(controls.target).add(_off);
  camAz=Math.atan2(_off.x,_off.z);camDist=_off.length();camRight.setFromMatrixColumn(camera.matrixWorld,0);
}

export const rtScene=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
export const rtBlur=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
// clouds are drawn on a coarse block grid, so they render one texel per block and get sampled back unfiltered
export const rtCloud=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
const QUAD_VS=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
export const passH=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,
  uniforms:{tDiffuse:{value:null},uRes:{value:new THREE.Vector2()},uAmount:{value:.7},uFocus:{value:.5},uBand:{value:.14}},
  vertexShader:QUAD_VS,
  fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 uRes;uniform float uAmount,uFocus,uBand;varying vec2 vUv;
  void main(){float amt=smoothstep(uBand,uBand+.4,abs(vUv.y-uFocus))*uAmount;float r=amt*6.5;
    if(r<.05){gl_FragColor=texture2D(tDiffuse,vUv);return;}
    vec4 s=vec4(0.);float ws=0.;
    for(int i=-6;i<=6;i++){float fi=float(i);float w=exp(-fi*fi/16.);s+=texture2D(tDiffuse,vUv+vec2(fi*r/uRes.x,0.))*w;ws+=w;}
    gl_FragColor=s/ws;}`});
export const passV=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,
  uniforms:{tDiffuse:{value:null},tCloud:{value:rtCloud.texture},uCloudRes:{value:new THREE.Vector2()},uRes:{value:new THREE.Vector2()},uAmount:{value:.7},uFocus:{value:.5},uBand:{value:.14},
    uExposure:{value:1},uFlash:{value:0},uDim:{value:0},uStars:{value:0},uTime:{value:0},uSat:{value:1.12},
    uTop:{value:new THREE.Vector3(.3,.6,.9)},uBot:{value:new THREE.Vector3(.8,.9,1)},
    uCloud:{value:.3},uPan:{value:0},uPix:{value:4},uCloudLit:{value:new THREE.Vector3(1,1,1)},uCloudShade:{value:new THREE.Vector3(.8,.8,.85)}},
  vertexShader:QUAD_VS,
  fragmentShader:`uniform sampler2D tDiffuse,tCloud;uniform vec2 uRes,uCloudRes;uniform float uAmount,uFocus,uBand,uExposure,uFlash,uDim,uStars,uTime,uSat,uPix;uniform vec3 uTop,uBot;varying vec2 vUv;
  vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
  vec3 toSRGB(vec3 c){return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}
  float ch(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
  float h12(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}
  void main(){
    float amt=smoothstep(uBand,uBand+.4,abs(vUv.y-uFocus))*uAmount;float r=amt*6.5;
    vec4 s;
    if(r<.05)s=texture2D(tDiffuse,vUv);
    else{s=vec4(0.);float ws=0.;
      for(int i=-6;i<=6;i++){float fi=float(i);float w=exp(-fi*fi/16.);s+=texture2D(tDiffuse,vUv+vec2(0.,fi*r/uRes.y))*w;ws+=w;}
      s/=ws;}
    float a=clamp(s.a,0.,1.);
    vec3 col=toSRGB(aces(max(s.rgb,0.)*uExposure));
    float l=dot(col,vec3(.299,.587,.114));col=mix(vec3(l),col,uSat);
    vec3 bg=mix(uBot,uTop,smoothstep(.05,1.,vUv.y));
    if(a<.999){
      vec4 cl=texture2D(tCloud,(floor(gl_FragCoord.xy/uPix)+.5)/uCloudRes);
      vec2 sp=floor(gl_FragCoord.xy/2.);float st=step(.9975,ch(sp));
      bg+=st*uStars*(.55+.45*sin(uTime*1.7+ch(sp+3.)*40.))*smoothstep(.25,.8,vUv.y)*(1.-cl.a);
      bg=mix(bg,cl.rgb,cl.a);
    }
    col=col+bg*(1.-a);
    vec2 q=vUv-.5;float v=dot(q,q);
    col*=1.-v*.55;
    col*=1.-uDim*(.3+v*1.1);
    col=mix(col,vec3(.9,.94,1.),uFlash*.55);
    col+=(h12(gl_FragCoord.xy+floor(fract(uTime*7.)*64.))-.5)*.022;
    gl_FragColor=vec4(col,1.);}`});
const pu=passV.uniforms;
export const passCloud=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,
  uniforms:{uCanvas:{value:new THREE.Vector2()},uTime:pu.uTime,uCloud:pu.uCloud,uPan:pu.uPan,uPix:pu.uPix,uTop:pu.uTop,uBot:pu.uBot,uCloudLit:pu.uCloudLit,uCloudShade:pu.uCloudShade},
  vertexShader:QUAD_VS,
  fragmentShader:`uniform vec2 uCanvas;uniform float uTime,uCloud,uPan,uPix;uniform vec3 uTop,uBot,uCloudLit,uCloudShade;
  float h1(float n){return fract(sin(n*127.1+.3)*43758.5453);}
  // Pixel-art cumulus: flat-bottomed clusters of round puffs evaluated on a coarse block grid.
  vec2 puff(vec2 q,float i,float w,float h){
    if(q.y<0.)return vec2(0.);float inside=0.,lite=0.;
    for(int k=0;k<5;k++){float fk=float(k),u=fk/4.-.5;
      vec2 c=vec2(u*w*.8+(h1(i*7.+fk)-.5)*w*.1,0.);
      float r=h*mix(.6,1.,h1(i*11.+fk))*(1.-abs(u)*.95);
      vec2 d=q-c;if(dot(d,d)<r*r){inside=1.;if(length(d-vec2(-r*.3,r*.42))<r*.45)lite=1.;}}
    return vec2(inside,lite);}
  const int NC=16;
  vec4 clouds(vec3 sky){
    vec2 res=uCanvas/uPix,b=floor(gl_FragCoord.xy);vec4 o=vec4(0.);
    float count=mix(5.,float(NC),uCloud);
    for(int j=0;j<NC;j++){float i=float(j);if(i>=count)break;
      float depth=(i+.5)/float(NC);
      float w=floor(mix(14.,30.,depth)*mix(.85,1.15,h1(i+1.))*mix(1.,1.3,uCloud)),h=floor(w*.34);
      float span=res.x+w*2.;
      float cx=floor(mod(h1(i+3.)*span+uTime*mix(.35,1.2,depth)+uPan*mix(12.,36.,depth),span)-w);
      float cy=floor(mix(.16,.94,h1(i+4.))*res.y);
      vec2 q=b-vec2(cx,cy);
      if(abs(q.x)>w*.62||q.y<0.||q.y>h*1.05)continue;
      vec2 sh=puff(q,i,w,h);if(sh.x<.5)continue;
      float rim=1.-puff(q+vec2(0.,1.),i,w,h).x,band=max(1.,floor(h*.24));
      vec3 base=mix(uCloudLit,uCloudShade,.4);
      vec3 c=q.y<band?uCloudShade:(q.y<band+1.&&mod(b.x+b.y,2.)<1.?uCloudShade:base);
      if(sh.y>.5)c=uCloudLit;
      if(rim>.5)c=uCloudLit*1.08+.04;
      o=vec4(mix(c,sky,(1.-depth)*.4),1.);
    }
    return o;}
  void main(){float y=(floor(gl_FragCoord.y)+.5)*uPix/uCanvas.y;gl_FragColor=clouds(mix(uBot,uTop,smoothstep(.05,1.,y)));}`});
export const quadScene=new THREE.Scene(),quadCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
export const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),passH);quad.frustumCulled=false;quadScene.add(quad);

export const bufSize=new THREE.Vector2(); // scene render-target size
const canvasSize=new THREE.Vector2();
export function resize(){
  const w=innerWidth,h=innerHeight,a=w/h;
  renderer.setSize(w,h,false);
  const vh=Math.max(23,44/a);
  camera.aspect=a;camera.fov=2*Math.atan(vh/CAM_DIST)*180/Math.PI;camera.updateProjectionMatrix(); // vh = half-height framed at the target
  renderer.getDrawingBufferSize(canvasSize);
  // the scene renders at state.res of the canvas; below full size it's upscaled unfiltered for crisp pixels
  bufSize.copy(canvasSize).multiplyScalar(clamp(state.res,.25,1)).floor().max(new THREE.Vector2(1,1));
  const f=state.res<1?THREE.NearestFilter:THREE.LinearFilter;if(rtBlur.texture.magFilter!==f){rtBlur.texture.magFilter=f;rtBlur.dispose();}
  rtScene.setSize(bufSize.x,bufSize.y);rtBlur.setSize(bufSize.x,bufSize.y);
  passH.uniforms.uRes.value.copy(canvasSize);passV.uniforms.uRes.value.copy(canvasSize); // blur radius in canvas pixels, independent of state.res
  const pix=pu.uPix.value=3*renderer.getPixelRatio();
  pu.uCloudRes.value.set(Math.ceil(canvasSize.x/pix),Math.ceil(canvasSize.y/pix));rtCloud.setSize(pu.uCloudRes.value.x,pu.uCloudRes.value.y);
  passCloud.uniforms.uCanvas.value.copy(canvasSize);
  boltCv.width=w;boltCv.height=h;
}
export const boltCv=document.getElementById('bolt'),boltG=boltCv.getContext('2d');
