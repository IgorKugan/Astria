'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const native=new Map(),errors=[];let next=0,receive;
const window={requestAnimationFrame:callback=>{native.set(++next,callback);return next;},cancelAnimationFrame:id=>native.delete(id),setTimeout:callback=>errors.push(callback)};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/game-preload.js'),'utf8'),{window,process:{argv:['--astria-fps=15']},require:()=>({contextBridge:{executeInMainWorld:({func,args})=>func(...args)},ipcRenderer:{on:(_channel,callback)=>{receive=callback;}}})});
const request=window.requestAnimationFrame,cancel=window.cancelAnimationFrame;
function advance(time){for(const id of [...native.keys()]){const callback=native.get(id);native.delete(id);try{callback?.(time);}catch(error){errors.push(error);}}}
for(const fps of [10,15,30,0]){
  receive({},fps);let count=0,handle;
  function draw(){count++;handle=request(draw);}
  handle=request(draw);
  for(let i=0;i<60;i++)advance(i*1000/60);
  assert.equal(count,fps||60,'cached request function respects '+(fps||'uncapped')+' FPS');
  cancel(handle);assert.equal(native.size,0,'no empty background scheduler');
}
let called=0;
const id=request(()=>called++);cancel(String(id));advance(1000);assert.equal(called,0,'cancel accepts a numeric handle');
const canceled=request(()=>called++);cancel(canceled);
request(()=>{throw new Error('fixture');});request(()=>called++);advance(1100);
assert.equal(called,1,'one failing callback does not prevent another callback');
assert.equal(errors.length,1,'native callback errors are reported without affecting other callbacks');
let second;request(()=>cancel(second));second=request(()=>called++);advance(1200);
assert.equal(called,1,'a callback can cancel another pending callback in the same frame');
assert.throws(()=>request(null),error=>error.name==='TypeError');
assert.equal(Object.keys(window).length,3,'preload exposes no host API');
console.log('PASS: exact animation budgets, uncapped drawing, cached callbacks, cancellation and error isolation');
