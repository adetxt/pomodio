import * as THREE from 'three';
import { $, clamp, ico, pick, store } from './utils.js';
import { PRESETS, W, state } from './state.js';
import { camera, canvasEl, resize } from './renderer.js';
import { CHANNELS, sound, syncAudioUI } from './audio.js';
import { ROLE_MOOD, ROLE_TITLE, marker, pickables, raining } from './citizens.js';
import { env } from './weather.js';
import { finishPomo, pomo, renderPomo, setMode, togglePomo } from './pomodoro.js';

/* =====================================================================
   14. UI wiring
   ===================================================================== */
document.querySelectorAll('#pTabs button').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('pPlay').onclick=togglePomo;$('pSkip').onclick=()=>finishPomo(false);$('pReset').onclick=()=>setMode(pomo.mode);
$('pCfgBtn').onclick=()=>{$('pCfg').hidden=!$('pCfg').hidden;$('pCfgBtn').classList.toggle('open',!$('pCfg').hidden);};
$('pMin').onclick=()=>{$('pomo').classList.toggle('mini');$('pMin').innerHTML=ico($('pomo').classList.contains('mini')?'expand':'minus');};
for(const [id,key,min,max] of [['dFocus','focus',1,180],['dShort','short',1,60],['dLong','long',1,90],['dEvery','every',2,12]]){
  const el=$(id);el.value=pomo.dur[key];
  el.onchange=()=>{pomo.dur[key]=clamp(Math.round(+el.value)||pomo.dur[key],min,max);el.value=pomo.dur[key];store.set('dur',pomo.dur);
    if(!pomo.running&&key===pomo.mode)pomo.left=pomo.dur[key]*60000;renderPomo();};
}
$('pAutoNext').checked=pomo.autoNext;$('pAutoNext').onchange=e=>{pomo.autoNext=e.target.checked;store.set('autoNext',pomo.autoNext);};
$('pDim').checked=pomo.dim;$('pDim').onchange=e=>{pomo.dim=e.target.checked;store.set('dim',pomo.dim);renderPomo();};
// time of day
export const tod=$('tod');
function setLive(v){state.live=v;$('liveBtn').classList.toggle('on',v);}
tod.oninput=()=>{setLive(false);state.hour=+tod.value;};
$('liveBtn').onclick=()=>setLive(!state.live);
export function todIcon(h){return h<5||h>=20.5?'moon':h<7.5||(h>=16.8&&h<19.5)?'sunrise':h<16.8?'sun':'moon';}
// weather
function setWeather(w){state.weather=w;store.set('weather',w);document.querySelectorAll('#weatherRow button').forEach(b=>b.classList.toggle('on',b.dataset.w===w));}
document.querySelectorAll('#weatherRow button').forEach(b=>b.onclick=()=>setWeather(b.dataset.w));
// sound
$('mixer').innerHTML=CHANNELS.map(([k,n])=>`<label>${n}<input type="range" min="0" max="1" step="0.01" data-ch="${k}"></label>`).join('')+
  `<label class="chk"><input type="checkbox" id="autoPause">Pause music when focus ends</label>`;
document.querySelectorAll('#mixer input[data-ch]').forEach(el=>{el.value=sound.levels[el.dataset.ch];el.oninput=()=>{sound.levels[el.dataset.ch]=+el.value;sound.applyLevels();};});
$('autoPause').checked=sound.autoPause;$('autoPause').onchange=e=>{sound.autoPause=e.target.checked;store.set('autoPause',sound.autoPause);};
$('vol').value=sound.levels.master;$('vol').oninput=e=>{sound.levels.master=+e.target.value;if(sound.muted){sound.muted=false;}sound.applyLevels();syncAudioUI();};
$('muteBtn').onclick=()=>{sound.muted=!sound.muted;sound.applyLevels();syncAudioUI();};
$('musicBtn').onclick=()=>{sound.autoPaused=false;sound.setMusic(!sound.musicOn);syncAudioUI();};
$('mixBtn').onclick=()=>{$('mixer').hidden=!$('mixer').hidden;$('mixBtn').classList.toggle('on',!$('mixer').hidden);};
$('tilt').value=state.tilt;$('tilt').oninput=e=>{state.tilt=+e.target.value;store.set('tilt',state.tilt);};
const RES=[1,.75,.5],syncRes=()=>{$('resBtn').textContent=Math.round(state.res*100)+'%';};
$('resBtn').onclick=()=>{state.res=RES[(RES.indexOf(state.res)+1)%RES.length];store.set('res',state.res);syncRes();resize();};syncRes();
function toggleUI(){document.body.classList.toggle('clean');$('showUi').hidden=!document.body.classList.contains('clean');}
$('hideBtn').onclick=toggleUI;$('showUi').onclick=toggleUI;
function enter(muted){if(muted){sound.muted=true;}sound.init();sound.applyLevels();syncAudioUI();$('splash').remove();}
$('enterBtn').onclick=()=>enter(false);$('enterQuiet').onclick=()=>enter(true);
addEventListener('keydown',e=>{
  if(e.target.closest&&e.target.closest('input,textarea'))return;
  if(e.code==='Space'){e.preventDefault();togglePomo();}
  else if(e.key==='h'||e.key==='H')toggleUI();
  else if(e.key==='m'||e.key==='M'){sound.muted=!sound.muted;sound.applyLevels();syncAudioUI();}
  else if(e.key==='Escape')closeCard();
});
// deep link: #t=18.5&w=rain
{const q=new URLSearchParams(location.hash.slice(1));if(q.has('t')){setLive(false);state.hour=clamp(+q.get('t'),0,24);}if(q.has('w')&&PRESETS[q.get('w')]){setWeather(q.get('w'));Object.assign(W,PRESETS[q.get('w')]);}}
setLive(state.live);setWeather(state.weather);syncAudioUI();renderPomo();
// filled-track sliders
const paintRange=el=>el.style.setProperty('--p',((el.value-el.min)/(el.max-el.min)*100)+'%');
document.addEventListener('input',e=>{if(e.target.type==='range')paintRange(e.target);});
document.querySelectorAll('input[type=range]').forEach(paintRange);
// NPC picking + inspection card
export let selected=null;const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();let downAt=null;
canvasEl.addEventListener('pointerdown',e=>{downAt=[e.clientX,e.clientY];});
canvasEl.addEventListener('pointerup',e=>{
  if(!downAt||Math.hypot(e.clientX-downAt[0],e.clientY-downAt[1])>5)return;
  ndc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);ray.setFromCamera(ndc,camera);
  const hit=ray.intersectObjects(pickables.filter(p=>p.parent.visible),false)[0];
  if(hit){selected=hit.object.userData.agent;$('card').hidden=false;updateCard();
    if(selected.kind==='cat'){sound.meow();selected.say(pick(['💕','😼','🐾']),1.5);}else selected.say(pick(['💬','♪','🌸']),1.5);}else closeCard();
});
function closeCard(){selected=null;$('card').hidden=true;marker.visible=false;}
$('cardClose').onclick=closeCard;
function moodOf(a){
  if(a.kind==='dog')return raining?'🐾 Splashing in puddles':ROLE_MOOD.dog;
  if(a.kind==='cat')return a.sheltered?'😾 Sulking until it stops':raining?'🙀 Deeply offended by the rain':a.anim==='sleep'?'😴 Purring in its sleep':a.mood;
  if(a.sheltered)return '☕ Cozy, waiting out the rain';
  if(raining&&a.anim==='run')return '😮 Dashing for shelter';
  if(raining&&a.umb)return '☂ Snug under an umbrella';
  if(raining&&a.role==='jogger')return '💪 Soggy but determined';
  if(raining&&a.role==='cyclist')return '🌧 Damp but grinning';
  if(env.night>.6)return a.role==='patron'?'🌙 Night-owl cozy':'🌙 Dreamy';
  if(env.golden>.5)return '🌇 Golden-hour glow';
  return ROLE_MOOD[a.role]||'🙂 Content';
}
const portrait=$('cardPortrait').getContext('2d');
export function updateCard(){
  const a=selected;if(!a)return;
  $('cardName').textContent=a.name;$('cardRole').textContent=ROLE_TITLE[a.role]||a.role;$('cardAct').textContent=a.label;$('cardMood').textContent=moodOf(a);
  const pet=a.kind==='dog'||a.kind==='cat';$('cardTrack').textContent=pet?`${a.track} (allegedly)`:a.track;$('cardSteps').textContent=Math.floor(a.steps).toLocaleString()+(pet?' paw-steps':'');
  $('cardEnergy').style.width=Math.round(clamp(a.energy-(a.steps-5000)/60000,.1,1)*100)+'%';
  const s=a.sheet;portrait.imageSmoothingEnabled=false;portrait.clearRect(0,0,64,96);
  const sc=Math.min(64/s.fw,96/s.fh),w=s.fw*sc,h=s.fh*sc;portrait.drawImage(s.canvas,a.frame*s.fw,0,s.fw,s.fh,(64-w)/2,96-h-4,w,h);
}
