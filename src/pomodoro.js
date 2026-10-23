import { $, clamp, ico, store } from './utils.js';
import { sound, syncAudioUI } from './audio.js';

/* =====================================================================
   13. Pomodoro suite
   ===================================================================== */
export const pomo={dur:Object.assign({focus:25,short:5,long:15,every:4},store.get('dur',{})),mode:'focus',running:false,endAt:0,left:0,
  autoNext:store.get('autoNext',false),dim:store.get('dim',true),lock:store.get('lock',true),count:0};
{const s=store.get('sessions',{date:'',count:0});pomo.count=s.date===new Date().toDateString()?s.count:0;}
pomo.left=pomo.dur.focus*60000;
// townspeople can't be picked during a running focus session; they're the break-time reward
export const npcLocked=()=>pomo.running&&pomo.mode==='focus'&&pomo.lock;
const MODE_LABEL={focus:'focus',short:'short break',long:'long break'},MODE_COLOR={focus:'#ffb46b',short:'#8fd6c4',long:'#9ec0ff'};
const fmt=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
export function renderPomo(){
  const left=pomo.running?pomo.endAt-Date.now():pomo.left,total=pomo.dur[pomo.mode]*60000;
  $('pTime').textContent=$('miniTime').textContent=fmt(left);$('pLabel').textContent=MODE_LABEL[pomo.mode];
  $('ringProg').style.strokeDashoffset=326.73*(1-clamp(left/total,0,1));$('ringProg').style.stroke=MODE_COLOR[pomo.mode];
  const pi=pomo.running?'pause':'play';if($('pPlay').dataset.i!==pi){$('pPlay').dataset.i=pi;$('pPlay').innerHTML=ico(pi);}
  document.querySelectorAll('#pTabs button').forEach(b=>b.classList.toggle('on',b.dataset.mode===pomo.mode));
  const inCycle=pomo.count%pomo.dur.every;
  $('pDots').innerHTML=Array.from({length:pomo.dur.every},(_,i)=>`<i class="${i<inCycle||(inCycle===0&&pomo.count>0&&pomo.mode==='long')?'done':''}"></i>`).join('')+`<span>&nbsp;#${pomo.count+1} · ${pomo.count} today</span>`;
  document.title=pomo.running?`${fmt(left)} · ${MODE_LABEL[pomo.mode]} — Pomodio`:'Pomodio — Pixel Park Sanctuary';
  document.body.classList.toggle('focusing',pomo.running&&pomo.mode==='focus'&&pomo.dim);
}
export function setMode(m,autostart=false){pomo.mode=m;pomo.running=false;pomo.left=pomo.dur[m]*60000;if(autostart)togglePomo();renderPomo();}
export function togglePomo(){
  if(pomo.running){pomo.left=pomo.endAt-Date.now();pomo.running=false;}
  else{pomo.endAt=Date.now()+pomo.left;pomo.running=true;if(pomo.mode==='focus'&&sound.autoPaused){sound.autoPaused=false;sound.setMusic(true);syncAudioUI();}}
  renderPomo();
}
export function finishPomo(natural){
  const was=pomo.mode;let next;
  if(was==='focus'){
    if(natural){pomo.count++;store.set('sessions',{date:new Date().toDateString(),count:pomo.count});}
    next=natural&&pomo.count%pomo.dur.every===0?'long':'short';
    if(natural&&sound.autoPause&&sound.musicOn){sound.setMusic(false);sound.autoPaused=true;syncAudioUI();}
  }else next='focus';
  if(natural){sound.chime(was);toast(was==='focus'?(next==='long'?'Focus complete — enjoy a long break 🌸':'Focus complete — take a short break ☕'):'Break over — back to focus 📖');}
  setMode(next,natural&&pomo.autoNext);
}
setInterval(()=>{if(pomo.running&&pomo.endAt-Date.now()<=0)finishPomo(true);else renderPomo();},250);
let toastT;export function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),4200);}
