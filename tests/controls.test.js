import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chromium=process.env.CHROME_BIN||'/usr/bin/chromium';
const options={timeout:15000,skip:!existsSync(chromium)&&'Set CHROME_BIN to run timer browser regressions'};
let observations;
async function inspectTimer(){
  if(observations)return observations;
  const profile=await mkdtemp(join(tmpdir(),'pomodio-timer-'));
  // Real markup and timer/audio/state modules; three is unused by this UI-only
  // harness, so no CDN or WebGL context is required for timer regression tests.
  const html=(await readFile(new URL('../index.html',import.meta.url),'utf8'))
    .replace(/<script type="importmap">[\s\S]*?<\/script>/,'<script type="importmap">{"imports":{"three":"data:text/javascript,export{}"}}</script>')
    .replace('<script type="module" src="/src/main.js"></script>','<script type="module" src="/harness.js"></script>');
  const script=`
    try {
      let now=1000000;Date.now=()=>now;
      const timer=await import('/src/pomodoro.js');
      const {pomo,setMode,togglePomo,renderPomo}=timer;
      const reset=timer.resetPomo;
      const results=[];
      for(const mode of ['focus','short','long']){
        setMode(mode);togglePomo();now+=10000;
        pomo.count=3;reset();renderPomo();
        results.push({mode,running:pomo.running,left:pomo.endAt-now,total:pomo.dur[mode]*60000,count:pomo.count,text:document.getElementById('pTime').textContent});
      }
      setMode('short');togglePomo();now+=10000;togglePomo();reset();
      const paused={running:pomo.running,left:pomo.left,endAt:pomo.endAt};
      setMode('focus');pomo.left=750000;renderPomo();
      const ring=document.getElementById('miniRingProg');
      const half={main:document.getElementById('ringProg').style.strokeDashoffset,mini:ring?.style.strokeDashoffset,array:ring?.getAttribute('stroke-dasharray'),text:document.getElementById('miniTime').textContent};
      setMode('long');
      const switched={offset:ring?.style.strokeDashoffset,color:ring?.style.stroke,mainColor:document.getElementById('ringProg').style.stroke};
      const weather=await import('/src/state.js');
      weather.setWeather('storm');weather.setDynamicWeather(true);
      const before={...weather.W},changed=weather.advanceDynamicWeather(721);
      const dynamic={changed,current:weather.state.weather,enabled:weather.state.dynamicWeather,noSnap:Object.keys(before).every(k=>before[k]===weather.W[k]),stored:JSON.parse(localStorage.getItem('pomodio.dynamicWeather'))};
      weather.setWeather('clear');
      const manual={current:weather.state.weather,enabled:weather.state.dynamicWeather,changed:weather.advanceDynamicWeather(99999),stored:JSON.parse(localStorage.getItem('pomodio.dynamicWeather'))};
      const pre=document.createElement('pre');pre.id='test-result';pre.textContent=JSON.stringify({results,paused,half,switched,dynamic,manual});document.body.append(pre);
    } catch(e) {const pre=document.createElement('pre');pre.id='test-error';pre.textContent=e.stack;document.body.append(pre);}
  `;
  const server=createServer(async(req,res)=>{
    if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
    if(req.url==='/harness.js'){res.setHeader('Content-Type','text/javascript');res.end(script);return;}
    if(!/^\/src\/[\w-]+\.js$/.test(req.url)){res.writeHead(404).end();return;}
    try{res.setHeader('Content-Type','text/javascript');res.end(await readFile(new URL('..'+req.url,import.meta.url)));}
    catch{res.writeHead(404).end();}
  });
  let browser;
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    browser=spawn(chromium,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run',`--user-data-dir=${profile}`,'--remote-debugging-pipe'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
    let id=0,buffer='';const pending=new Map();
    browser.stdio[4].on('data',chunk=>{
      buffer+=chunk;let end;
      while((end=buffer.indexOf('\0'))>=0){
        const message=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);
        if(message.id){pending.get(message.id)?.(message);pending.delete(message.id);}
      }
    });
    const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
      const requestId=++id,timer=setTimeout(()=>reject(new Error(method+' timed out')),10000);
      pending.set(requestId,m=>{clearTimeout(timer);m.error?reject(new Error(JSON.stringify(m.error))):resolve(m.result);});
      browser.stdio[3].write(JSON.stringify({id:requestId,method,params,sessionId})+'\0');
    });
    const {targetId}=await send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`},sessionId);
    const {result:dom,exceptionDetails}=await send('Runtime.evaluate',{
      expression:`new Promise(resolve=>{const poll=()=>{if(document.getElementById('test-result')||document.getElementById('test-error'))resolve(document.body.innerHTML);else setTimeout(poll,10);};poll();})`,
      awaitPromise:true,returnByValue:true,
    },sessionId);
    assert.equal(exceptionDetails,undefined);
    const output=dom.value;
    await send('Browser.close');
    const result=output.match(/<pre id="test-result">([^<]*)<\/pre>/);
    assert.ok(result,output.match(/<pre id="test-error">([^<]*)/)?.[1]||'Timer harness did not finish');
    observations=JSON.parse(result[1]);return observations;
  }finally{
    if(browser&&browser.exitCode===null)browser.kill('SIGKILL');
    await new Promise(resolve=>server.close(resolve));
    await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});
  }
}
test('reset restarts each running interval at its full duration without changing session count',options,async()=>{
  const {results}=await inspectTimer();
  for(const result of results){
    assert.equal(result.running,true,result.mode+' should keep running after reset');
    assert.equal(result.left,result.total);assert.equal(result.count,3);
  }
  assert.deepEqual(results.map(r=>r.text),['25:00','05:00','15:00']);
});
test('resetting a paused interval restores its duration and clears its old deadline',options,async()=>{
  const {paused}=await inspectTimer();
  assert.equal(paused.running,false);assert.equal(paused.left,300000);assert.equal(paused.endAt,0);
});
test('compact progress stays in sync with the full ring and resets on mode changes',options,async()=>{
  const {half,switched}=await inspectTimer();
  assert.equal(half.text,'12:30');assert.equal(half.mini,half.main);
  assert.equal(half.array,'326.73');assert.equal(switched.offset,'0');assert.equal(switched.color,switched.mainColor);
});

test('dynamic weather advances without snapping effects and manual selection stops it',options,async()=>{
  const {dynamic,manual}=await inspectTimer();
  assert.deepEqual(dynamic,{changed:true,current:'rain',enabled:true,noSnap:true,stored:true});
  assert.deepEqual(manual,{current:'clear',enabled:false,changed:false,stored:false});
});
