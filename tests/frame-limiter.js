'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const native=new Map(),timers=new Map(),errors=[];let next=0,receive,now=0,requests=0;
const window={requestAnimationFrame:callback=>{requests++;native.set(++next,callback);return next;},cancelAnimationFrame:id=>native.delete(id),setTimeout:(callback,delay)=>{timers.set(++next,{callback,time:now+delay});return next;},clearTimeout:id=>timers.delete(id),performance:{now:()=>now}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/game-preload.js'),'utf8'),{window,process:{argv:['--astria-fps=15']},require:()=>({contextBridge:{executeInMainWorld:({func,args})=>func(...args)},ipcRenderer:{on:(_channel,callback)=>{receive=callback;}}})});
const request=window.requestAnimationFrame,cancel=window.cancelAnimationFrame;
function advance(time){now=time;for(const [id,timer] of [...timers])if(timer.time<=time+.001){timers.delete(id);timer.callback();}for(const id of [...native.keys()]){const callback=native.get(id);native.delete(id);try{callback?.(time);}catch(error){errors.push(error);}}}
for(const hz of [60,144])for(const fps of [1,5,10,15,30,0]){
  now=0;requests=0;receive({},fps);let count=0,handle;
  function draw(){count++;handle=request(draw);}
  handle=request(draw);
  for(let i=0;i<hz;i++)advance(i*1000/hz);
  if(hz===60||!fps)assert.equal(count,fps||hz,'cached request function respects '+(fps||'uncapped')+' FPS');
  else assert.ok(count<=fps&&count>=Math.floor(fps*.9),'animation budget on a high-refresh display');
  if(fps)assert.ok(requests<=fps+2,'low FPS must not wake on every display frame: '+requests+' requests for '+fps+' FPS');
  cancel(handle);assert.equal(native.size,0,'no empty background scheduler');assert.equal(timers.size,0,'no empty pacing timer');
}
receive({},1);let resumed=0,waiting;
function draw(){resumed++;waiting=request(draw);}
waiting=request(draw);advance(2000);assert.equal(timers.size,1,'power-saving loop sleeps between budgets');
receive({},0);assert.equal(timers.size,0,'maximum performance cancels the pending sleep immediately');
advance(2020);assert.equal(resumed,2,'maximum performance resumes without waiting for the previous budget');cancel(waiting);
let called=0;
const id=request(()=>called++);cancel(String(id));advance(1000);assert.equal(called,0,'cancel accepts a numeric handle');
const canceled=request(()=>called++);cancel(canceled);
request(()=>{throw new Error('fixture');});request(()=>called++);advance(1100);
assert.equal(called,1,'one failing callback does not prevent another callback');
assert.equal(errors.length,1,'native callback errors are reported without affecting other callbacks');
let second;request(()=>cancel(second));second=request(()=>called++);advance(1200);
assert.equal(called,1,'a callback can cancel another pending callback in the same frame');
assert.throws(()=>request(null),error=>error.name==='TypeError');
assert.equal(Object.keys(window).length,5,'preload exposes no host API');
console.log('PASS: 1/5/10/15/30 FPS, fewer scheduler wakeups at 60/144 Hz, immediate uncapped resume, cancellation and error isolation');
