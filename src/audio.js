import { $, clamp, ico, lerp, pick, rand, randInt, smoothstep, store } from './utils.js';
import { W } from './state.js';

/* =====================================================================
   12. Procedural sound engine (Web Audio)
   ===================================================================== */
const mtof=m=>440*Math.pow(2,(m-69)/12);
const PROGS=[
  [{r:38,n:[53,57,60,64]},{r:43,n:[53,59,64,69]},{r:36,n:[52,59,62,67]},{r:45,n:[55,60,64,71]}],
  [{r:41,n:[52,57,60,64]},{r:40,n:[50,55,59,62]},{r:38,n:[50,53,57,60]},{r:36,n:[48,52,55,59]}],
  [{r:45,n:[55,60,64,67]},{r:41,n:[52,57,60,64]},{r:36,n:[52,55,59,62]},{r:43,n:[50,55,59,64]}],
];
const PENTA=[72,74,76,79,81,84,86,88];
export const CHANNELS=[['music','Lo-fi music'],['vinyl','Tape texture'],['park','Birds & leaves'],['fountain','Fountain'],['rain','Rain'],['thunder','Thunder'],['city','City murmur']];
const CH_BASE={music:.55,vinyl:.55,park:.6,fountain:.4,rain:.9,thunder:1,city:.55};
class SoundEngine{
  constructor(){
    this.ctx=null;
    this.levels=Object.assign({master:.7,music:.75,vinyl:.1,park:.7,fountain:.2,rain:.45,thunder:.5,city:.18},store.get('levels',{}));
    this.muted=store.get('muted',false);this.musicOn=store.get('musicOn',true);this.autoPause=store.get('autoPause',true);this.autoPaused=false;
  }
  init(){
    if(this.ctx){this.ctx.resume();return;}
    try{
      const ctx=this.ctx=new (window.AudioContext||window.webkitAudioContext)();
      const comp=ctx.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=3;comp.connect(ctx.destination);
      // Start silent so loops cannot burst at the default unity gain before
      // applyLevels fades in the saved mix (or keeps muted entry silent).
      this.out=ctx.createGain();this.out.gain.value=0;this.out.connect(comp);
      this.muffle=ctx.createBiquadFilter();this.muffle.type='lowpass';this.muffle.frequency.value=18000;this.muffle.connect(this.out);
      this.ch={};for(const [k] of CHANNELS){const g=ctx.createGain();g.gain.value=0;g.connect(k==='rain'||k==='thunder'?this.out:this.muffle);this.ch[k]=g;}
      this.chimeBus=ctx.createGain();this.chimeBus.gain.value=.9;this.chimeBus.connect(this.out);
      // shared reverb
      const ir=ctx.createBuffer(2,ctx.sampleRate*2.8,ctx.sampleRate);
      for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2.6);}
      this.verb=ctx.createConvolver();this.verb.buffer=ir;const vg=ctx.createGain();vg.gain.value=.32;this.verb.connect(vg);vg.connect(this.muffle);
      this.white=this.noise(3,'white');this.pink=this.noise(3,'pink');this.brown=this.noise(5,'brown');
      this.buildMusic();this.buildAmbience();this.applyLevels();
      this.ready=true;
    }catch(e){console.warn('Audio unavailable:',e);this.ctx=null;}
  }
  noise(sec,kind){const ctx=this.ctx,n=Math.floor(ctx.sampleRate*sec),b=ctx.createBuffer(1,n,ctx.sampleRate),d=b.getChannelData(0);let l=0,b0=0,b1=0,b2=0;
    for(let i=0;i<n;i++){const w=Math.random()*2-1;
      if(kind==='brown'){l=(l+.02*w)/1.02;d[i]=l*3.5;}
      else if(kind==='pink'){b0=.99765*b0+w*.099046;b1=.963*b1+w*.2965164;b2=.57*b2+w*1.0526913;d[i]=(b0+b1+b2+w*.1848)*.18;}
      else d[i]=w;}
    return b;}
  loop(buf,nodes,dest){const s=this.ctx.createBufferSource();s.buffer=buf;s.loop=true;let n=s;for(const x of nodes){n.connect(x);n=x;}n.connect(dest);s.start(0,rand(0,buf.duration));return s;}
  filt(type,f,q=.7){const b=this.ctx.createBiquadFilter();b.type=type;b.frequency.value=f;b.Q.value=q;return b;}
  gain(v){const g=this.ctx.createGain();g.gain.value=v;return g;}
  applyLevels(){if(!this.ctx)return;const t=this.ctx.currentTime;
    this.out.gain.setTargetAtTime(this.muted?0:this.levels.master,t,.08);
    for(const [k] of CHANNELS)this.ch[k].gain.setTargetAtTime(this.levels[k]*CH_BASE[k],t,.1);
    store.set('levels',this.levels);store.set('muted',this.muted);}
  // ---------- lo-fi music ----------
  buildMusic(){
    const ctx=this.ctx;
    this.epBus=this.gain(1);const epLP=this.filt('lowpass',2600);const trem=this.gain(.88);
    const tl=ctx.createOscillator();tl.frequency.value=4.2;const tg=this.gain(.12);tl.connect(tg);tg.connect(trem.gain);tl.start();
    this.epBus.connect(epLP);epLP.connect(trem);trem.connect(this.ch.music);const send=this.gain(.35);this.epBus.connect(send);send.connect(this.verb);
    this.wow=ctx.createOscillator();this.wow.frequency.value=.45;this.wowG=this.gain(7);this.wow.connect(this.wowG);this.wow.start();
    this.bassBus=this.gain(1);const bl=this.filt('lowpass',280);this.bassBus.connect(bl);bl.connect(this.ch.music);
    this.drumBus=this.gain(.75);const dl=this.filt('lowpass',4200);this.drumBus.connect(dl);dl.connect(this.ch.music);
    this.melBus=this.gain(1);const dly=ctx.createDelay(1);dly.delayTime.value=.62;const fb=this.gain(.33),dlp=this.filt('lowpass',2400);
    this.melBus.connect(this.ch.music);this.melBus.connect(dly);dly.connect(dlp);dlp.connect(fb);fb.connect(dly);dlp.connect(this.ch.music);const ms=this.gain(.5);this.melBus.connect(ms);ms.connect(this.verb);
    this.bpm=72;this.step=0;this.bar=0;this.prog=PROGS[0];this.nextTime=ctx.currentTime+.15;
    this.timer=setInterval(()=>this.schedule(),25);
  }
  schedule(){
    const ctx=this.ctx,spb=60/this.bpm/4;
    while(this.nextTime<ctx.currentTime+.15){
      if(this.musicOn)this.playStep(this.step%16,this.nextTime,spb);
      this.nextTime+=spb;this.step++;
      if(this.step%16===0){this.bar++;if(this.bar%8===0)this.prog=pick(PROGS);}
    }
  }
  playStep(s,t,spb){
    const tt=t+(s%2?spb*.18:0),ch=this.prog[this.bar%4];
    if(s===0){ch.n.forEach((m,i)=>this.ep(tt+i*.018,m,rand(.55,.75),spb*14));this.bassNote(tt,ch.r,spb*6);}
    if(s===10&&Math.random()<.55)ch.n.slice(1).forEach((m,i)=>this.ep(tt+i*.015,m,rand(.3,.45),spb*4));
    if(s===8&&Math.random()<.5)this.bassNote(tt,ch.r+(Math.random()<.5?7:12),spb*3);
    if(s===0||s===10||(s===7&&Math.random()<.3))this.kick(tt);
    if(s===4||s===12)this.snare(tt);
    if(s%2===0&&Math.random()<.85)this.hat(tt,s%4===2?.5:.3);
    if(s%2===0&&Math.random()<.13){const pool=PENTA.filter(m=>ch.n.some(c=>(c-m)%12===0)||Math.random()<.5);this.chimeNote(tt,pick(pool.length?pool:PENTA));}
  }
  ep(t,m,v,dur){const ctx=this.ctx,f=mtof(m),c=ctx.createOscillator(),mo=ctx.createOscillator(),mg=ctx.createGain(),a=ctx.createGain();
    c.frequency.value=f;mo.frequency.value=f;mg.gain.setValueAtTime(f*2*v,t);mg.gain.exponentialRampToValueAtTime(f*.25+1,t+.7);
    mo.connect(mg);mg.connect(c.frequency);this.wowG.connect(c.detune);
    a.gain.setValueAtTime(0,t);a.gain.linearRampToValueAtTime(.1*v,t+.01);a.gain.exponentialRampToValueAtTime(.04*v,t+.6);a.gain.setTargetAtTime(.0001,t+dur,.3);
    c.connect(a);a.connect(this.epBus);c.start(t);mo.start(t);c.stop(t+dur+1.8);mo.stop(t+dur+1.8);
    c.onended=()=>{try{this.wowG.disconnect(c.detune);}catch{}};}
  bassNote(t,m,dur){const ctx=this.ctx,o=ctx.createOscillator(),o2=ctx.createOscillator(),a=ctx.createGain();o.frequency.value=mtof(m);o2.type='triangle';o2.frequency.value=mtof(m);
    const g2=this.gain(.3);o2.connect(g2);g2.connect(a);o.connect(a);a.connect(this.bassBus);
    a.gain.setValueAtTime(0,t);a.gain.linearRampToValueAtTime(.32,t+.02);a.gain.exponentialRampToValueAtTime(.15,t+.4);a.gain.setTargetAtTime(.0001,t+dur,.12);
    o.start(t);o2.start(t);o.stop(t+dur+.8);o2.stop(t+dur+.8);}
  kick(t){const ctx=this.ctx,o=ctx.createOscillator(),a=ctx.createGain();o.frequency.setValueAtTime(120,t);o.frequency.exponentialRampToValueAtTime(42,t+.13);
    a.gain.setValueAtTime(.55,t);a.gain.exponentialRampToValueAtTime(.001,t+.36);o.connect(a);a.connect(this.drumBus);o.start(t);o.stop(t+.4);}
  snare(t){const ctx=this.ctx,s=ctx.createBufferSource();s.buffer=this.white;const bp=this.filt('bandpass',1700,.8),a=ctx.createGain();
    a.gain.setValueAtTime(.16,t);a.gain.exponentialRampToValueAtTime(.001,t+.2);s.connect(bp);bp.connect(a);a.connect(this.drumBus);s.start(t,rand(0,2));s.stop(t+.22);
    const o=ctx.createOscillator(),b=ctx.createGain();o.frequency.value=185;b.gain.setValueAtTime(.08,t);b.gain.exponentialRampToValueAtTime(.001,t+.08);o.connect(b);b.connect(this.drumBus);o.start(t);o.stop(t+.1);}
  hat(t,v){const ctx=this.ctx,s=ctx.createBufferSource();s.buffer=this.white;const hp=this.filt('highpass',7200),a=ctx.createGain();
    a.gain.setValueAtTime(.05*v,t);a.gain.exponentialRampToValueAtTime(.001,t+.045);s.connect(hp);hp.connect(a);a.connect(this.drumBus);s.start(t,rand(0,2));s.stop(t+.06);}
  chimeNote(t,m){const ctx=this.ctx,f=mtof(m),c=ctx.createOscillator(),mo=ctx.createOscillator(),mg=ctx.createGain(),a=ctx.createGain();
    c.frequency.value=f;mo.frequency.value=f*3.5;mg.gain.setValueAtTime(f*.8,t);mg.gain.exponentialRampToValueAtTime(1,t+.9);mo.connect(mg);mg.connect(c.frequency);
    a.gain.setValueAtTime(0,t);a.gain.linearRampToValueAtTime(.05,t+.005);a.gain.exponentialRampToValueAtTime(.0001,t+1.6);
    c.connect(a);a.connect(this.melBus);c.start(t);mo.start(t);c.stop(t+1.7);mo.stop(t+1.7);}
  setMusic(on){this.musicOn=on;store.set('musicOn',on);}
  // ---------- ambience ----------
  buildAmbience(){
    const ctx=this.ctx;
    // Soft tape hiss + rumble, without synthetic vinyl clicks and pops.
    // Keep the stored "vinyl" key to preserve existing mixer settings.
    this.loop(this.white,[this.filt('highpass',5200),this.gain(.035)],this.ch.vinyl);
    this.loop(this.brown,[this.filt('lowpass',70),this.gain(.35)],this.ch.vinyl);
    // fountain
    this.fountainG=this.gain(1);this.fountainG.connect(this.ch.fountain);
    this.loop(this.white,[this.filt('bandpass',1400,.6),this.gain(.22)],this.fountainG);
    this.loop(this.pink,[this.filt('lowpass',600),this.gain(.35)],this.fountainG);
    // leaves rustle
    this.leafG=this.gain(.02);this.loop(this.pink,[this.filt('bandpass',2400,.45),this.leafG],this.ch.park);
    // rain layers
    this.rainSoft=this.gain(0);this.loop(this.white,[this.filt('highpass',450),this.filt('lowpass',6500),this.rainSoft],this.ch.rain);
    this.rainHeavy=this.gain(0);this.loop(this.brown,[this.filt('lowpass',1200),this.rainHeavy],this.ch.rain);
    this.rainPatter=this.gain(0);this.loop(this.pink,[this.filt('bandpass',3600,.8),this.rainPatter],this.ch.rain);
    // city murmur
    this.cityG=this.gain(.4);this.loop(this.brown,[this.filt('lowpass',380),this.cityG],this.ch.city);
    this.loop(this.pink,[this.filt('bandpass',600,.5),this.gain(.05)],this.cityG);
  }
  chirp(){const ctx=this.ctx,t=ctx.currentTime,n=randInt(2,6),base=rand(2300,4300),pan=ctx.createStereoPanner();pan.pan.value=rand(-.85,.85);
    pan.connect(this.ch.park);const sv=this.gain(.25);pan.connect(sv);sv.connect(this.verb);
    const gap=rand(.07,.14);for(let i=0;i<n;i++){const t0=t+i*gap,o=ctx.createOscillator(),a=ctx.createGain(),f=base*rand(.92,1.08);
      o.frequency.setValueAtTime(f,t0);o.frequency.exponentialRampToValueAtTime(f*rand(1.2,1.6),t0+.035);o.frequency.exponentialRampToValueAtTime(f*rand(.7,.9),t0+.08);
      a.gain.setValueAtTime(0,t0);a.gain.linearRampToValueAtTime(.05,t0+.01);a.gain.exponentialRampToValueAtTime(.0005,t0+.09);o.connect(a);a.connect(pan);o.start(t0);o.stop(t0+.1);}}
  cricket(){const ctx=this.ctx,t=ctx.currentTime,pan=ctx.createStereoPanner();pan.pan.value=rand(-.8,.8);pan.connect(this.ch.park);const f=rand(4100,4600);
    for(let i=0;i<3;i++){const t0=t+i*.055,o=ctx.createOscillator(),a=ctx.createGain();o.frequency.value=f;a.gain.setValueAtTime(0,t0);a.gain.linearRampToValueAtTime(.018,t0+.006);
      a.gain.exponentialRampToValueAtTime(.0005,t0+.035);o.connect(a);a.connect(pan);o.start(t0);o.stop(t0+.04);}}
  bloop(){const ctx=this.ctx,t=ctx.currentTime,o=ctx.createOscillator(),a=ctx.createGain(),f=rand(380,900);o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*1.8,t+.05);
    a.gain.setValueAtTime(0,t);a.gain.linearRampToValueAtTime(.025,t+.008);a.gain.exponentialRampToValueAtTime(.0005,t+.07);o.connect(a);a.connect(this.fountainG);o.start(t);o.stop(t+.08);}
  drip(){const ctx=this.ctx,t=ctx.currentTime,o=ctx.createOscillator(),a=ctx.createGain(),pan=ctx.createStereoPanner(),f=rand(1600,3200);pan.pan.value=rand(-.9,.9);
    o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*.6,t+.05);a.gain.setValueAtTime(.03,t);a.gain.exponentialRampToValueAtTime(.0005,t+.06);
    o.connect(a);a.connect(pan);pan.connect(this.ch.rain);o.start(t);o.stop(t+.07);}
  carPass(){const ctx=this.ctx,t=ctx.currentTime,o=ctx.createOscillator(),lp=this.filt('lowpass',230),a=ctx.createGain(),pan=ctx.createStereoPanner();
    o.type='sawtooth';o.frequency.setValueAtTime(rand(55,80),t);o.frequency.linearRampToValueAtTime(rand(45,60),t+4.5);
    a.gain.setValueAtTime(0,t);a.gain.linearRampToValueAtTime(.05,t+2.1);a.gain.linearRampToValueAtTime(0,t+4.6);
    const dir=Math.random()<.5?1:-1;pan.pan.setValueAtTime(-.9*dir,t);pan.pan.linearRampToValueAtTime(.9*dir,t+4.6);
    o.connect(lp);lp.connect(a);a.connect(pan);pan.connect(this.ch.city);o.start(t);o.stop(t+4.7);}
  meow(){if(!this.ready)return;const ctx=this.ctx,t=ctx.currentTime,o=ctx.createOscillator(),f1=this.filt('bandpass',900,4),f2=this.filt('bandpass',2600,5),a=ctx.createGain(),b=rand(480,640);
    o.type='sawtooth';o.frequency.setValueAtTime(b,t);o.frequency.linearRampToValueAtTime(b*1.45,t+.18);o.frequency.exponentialRampToValueAtTime(b*.78,t+.6);
    f1.frequency.setValueAtTime(700,t);f1.frequency.linearRampToValueAtTime(1500,t+.2);f1.frequency.linearRampToValueAtTime(850,t+.6);
    a.gain.setValueAtTime(0,t);a.gain.linearRampToValueAtTime(.22,t+.06);a.gain.setValueAtTime(.22,t+.38);a.gain.exponentialRampToValueAtTime(.001,t+.65);
    const g2=this.gain(.45);o.connect(f1);o.connect(f2);f1.connect(a);f2.connect(g2);g2.connect(a);a.connect(this.ch.park);o.start(t);o.stop(t+.7);}
  bikeBell(p=0){if(!this.ready)return;const ctx=this.ctx,t=ctx.currentTime,pan=ctx.createStereoPanner();pan.pan.value=clamp(p,-1,1)*.8;pan.connect(this.ch.city);
    for(const dt of [0,.17])[[2650,.06],[4120,.03],[6200,.012]].forEach(([f,v])=>{const o=ctx.createOscillator(),a=ctx.createGain();o.frequency.value=f;
      a.gain.setValueAtTime(v,t+dt);a.gain.exponentialRampToValueAtTime(.0002,t+dt+.7);o.connect(a);a.connect(pan);o.start(t+dt);o.stop(t+dt+.75);});}
  thunder(delay,strength){if(!this.ready)return;const ctx=this.ctx,t=ctx.currentTime+delay,s=ctx.createBufferSource();s.buffer=this.brown;
    const lp=this.filt('lowpass',900),a=ctx.createGain(),peak=.9*strength;
    lp.frequency.setValueAtTime(delay<1?1400:700,t);lp.frequency.exponentialRampToValueAtTime(110,t+3.5);
    a.gain.setValueAtTime(0,t);a.gain.linearRampToValueAtTime(peak,t+(delay<1?.04:.3));a.gain.exponentialRampToValueAtTime(peak*.35,t+.9);
    a.gain.linearRampToValueAtTime(peak*.6,t+1.5);a.gain.exponentialRampToValueAtTime(.001,t+5.5);
    s.connect(lp);lp.connect(a);a.connect(this.ch.thunder);const sv=this.gain(.4);a.connect(sv);sv.connect(this.verb);s.start(t,rand(0,1));s.stop(t+6);}
  bell(t,m,v){const ctx=this.ctx,f=mtof(m),c=ctx.createOscillator(),mo=ctx.createOscillator(),mg=ctx.createGain(),a=ctx.createGain();
    c.frequency.value=f;mo.frequency.value=f*3.5;mg.gain.setValueAtTime(f*1.1,t);mg.gain.exponentialRampToValueAtTime(1,t+1.4);mo.connect(mg);mg.connect(c.frequency);
    a.gain.setValueAtTime(0,t);a.gain.linearRampToValueAtTime(v,t+.01);a.gain.exponentialRampToValueAtTime(.0001,t+2.8);
    c.connect(a);a.connect(this.chimeBus);const sv=this.gain(.5);a.connect(sv);sv.connect(this.verb);c.start(t);mo.start(t);c.stop(t+3);mo.stop(t+3);}
  chime(kind){if(!this.ready)return;const t=this.ctx.currentTime+.05;(kind==='focus'?[72,76,79,84]:[84,79,76,72]).forEach((m,i)=>this.bell(t+i*.3,m,.22));}
  update(dt,e){
    if(!this.ready)return;const t=this.ctx.currentTime,r=W.rain;
    const birdRate=(.25+1.6*Math.exp(-(((e.hour-7)/1.8)**2)))*e.day*(1-r)*(1-W.storm);if(Math.random()<birdRate*dt)this.chirp();
    if(Math.random()<e.night*(1-r)*1.8*dt)this.cricket();
    if(Math.random()<3*dt)this.bloop();
    if(Math.random()<r*5*dt)this.drip();
    if(Math.random()<(.02+.05*e.day)*dt)this.carPass();
    this.rainSoft.gain.setTargetAtTime(Math.min(r,.5)*.32,t,.4);this.rainHeavy.gain.setTargetAtTime(r*r*.55,t,.4);this.rainPatter.gain.setTargetAtTime(r*.12,t,.4);
    this.leafG.gain.setTargetAtTime(.012+W.wind*.05*(.6+.4*Math.sin(t*.7)*Math.sin(t*.23)),t,.3);
    this.cityG.gain.setTargetAtTime(.25+.45*e.day,t,1);
    this.muffle.frequency.setTargetAtTime(lerp(18000,1500,smoothstep(.3,1,r)),t,.6);
  }
}
export const sound=new SoundEngine();
export function syncAudioUI(){$('muteBtn').innerHTML=ico(sound.muted?'mute':'volume');$('muteBtn').classList.toggle('on',sound.muted);$('musicBtn').classList.toggle('on',sound.musicOn);
  $('musicBtn').querySelector('span').textContent=sound.musicOn?'Music':sound.autoPaused?'Paused':'Music off';
  $('musicBtn').title=sound.autoPaused?'Music paused when focus ended — resumes with your next focus session':'Lo-fi music on/off';}
