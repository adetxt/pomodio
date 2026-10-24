import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Render the real engine with Chromium's Web Audio implementation, without
// depending on audio hardware or replacing AudioParam automation with mocks.
const chromium=process.env.CHROME_BIN||'/usr/bin/chromium';
const browserTest={timeout:15000,skip:!existsSync(chromium)&&'Set CHROME_BIN to run Web Audio regression tests'};
async function renderTape(muted){
  const profile=await mkdtemp(join(tmpdir(),'pomodio-audio-'));
  const html=`<!doctype html><script type="importmap">{"imports":{"three":"data:text/javascript,export{}"}}</script>
    <body><script type="module">
    import { sound } from '/src/audio.js';
    try {
      let seed=12345;
      Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
      window.AudioContext=class extends OfflineAudioContext {
        constructor(){super(1,32000,16000);}
      };
      Object.keys(sound.levels).forEach(k=>sound.levels[k]=0);
      sound.levels.master=.7;sound.levels.vinyl=.1;
      sound.musicOn=false;sound.muted=${muted};
      sound.init();clearInterval(sound.timer);
      if(!sound.ready)throw new Error('Audio initialization failed');
      const audio=await sound.ctx.startRendering();
      let peak=0,steadyPeak=0;
      audio.getChannelData(0).forEach((v,i)=>{
        peak=Math.max(peak,Math.abs(v));
        if(i>=16000)steadyPeak=Math.max(steadyPeak,Math.abs(v));
      });
      document.body.textContent='RESULT:'+JSON.stringify({peak,steadyPeak});
    }catch(e){document.body.textContent='ERROR:'+e.stack;}
    </script></body>`;
  const server=createServer(async(req,res)=>{
    if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
    if(!['/src/audio.js','/src/utils.js','/src/state.js'].includes(req.url)){res.writeHead(404).end();return;}
    res.setHeader('Content-Type','text/javascript');
    res.end(await readFile(new URL('..'+req.url,import.meta.url)));
  });
  let browser;
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    browser=spawn(chromium,[
      '--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
      '--no-first-run','--remote-debugging-pipe',`--user-data-dir=${profile}`,
    ],{stdio:['ignore','ignore','ignore','pipe','pipe']});
    let id=0,buffer='';const pending=new Map(),events=new Map();
    browser.stdio[4].on('data',chunk=>{
      buffer+=chunk;
      let end;
      while((end=buffer.indexOf('\0'))>=0){
        const message=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);
        if(message.id){pending.get(message.id)?.(message);pending.delete(message.id);}
        else events.get(message.method)?.(message);
      }
    });
    const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
      const requestId=++id,timer=setTimeout(()=>reject(new Error(method+' timed out')),10000);
      pending.set(requestId,m=>{clearTimeout(timer);m.error?reject(new Error(JSON.stringify(m.error))):resolve(m.result);});
      browser.stdio[3].write(JSON.stringify({id:requestId,method,params,sessionId})+'\0');
    });
    const {targetId}=await send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
    await send('Page.enable',{},sessionId);
    const loaded=new Promise(resolve=>events.set('Page.loadEventFired',resolve));
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`},sessionId);
    await loaded;
    const {result,exceptionDetails}=await send('Runtime.evaluate',{
      expression:`new Promise(resolve=>{const poll=()=>{const text=document.body.textContent;
        if(text.startsWith('RESULT:')||text.startsWith('ERROR:'))resolve(text);else setTimeout(poll,10);};poll();})`,
      awaitPromise:true,returnByValue:true,
    },sessionId);
    assert.equal(exceptionDetails,undefined);
    assert.ok(result.value.startsWith('RESULT:'),result.value);
    await send('Browser.close');
    return JSON.parse(result.value.slice(7));
  }finally{
    if(browser&&browser.exitCode===null){browser.kill('SIGKILL');await new Promise(resolve=>browser.once('exit',resolve));}
    await new Promise(resolve=>server.close(resolve));
    await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});
  }
}

test('tape texture stays quiet without repeated impulse pops',browserTest,async()=>{
  const {peak,steadyPeak}=await renderTape(false);
  assert.ok(steadyPeak>0,'the softer tape texture should remain audible');
  // At the default mix the quiet texture stays below -40 dBFS, including
  // its fade-in. The old vinyl impulses exceeded this in the steady section.
  assert.ok(steadyPeak<.01,`unexpected tape pop: peak ${steadyPeak}`);
  assert.ok(peak<.01,`unexpected startup burst: peak ${peak}`);
});

test('entering muted produces no startup burst',browserTest,async()=>{
  const {peak}=await renderTape(true);
  assert.equal(peak,0);
});
