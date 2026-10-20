'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {_electron:electron}=require('playwright');
const root=path.resolve(__dirname,'..'),profiles=fs.mkdtempSync(path.join(os.tmpdir(),'astria-startup-'));
let application,page;
const requests=[],held=new Map();
function reply(res,id){res.setHeader('content-type','text/html');res.end('<!doctype html><title>Startup fixture</title><h1>'+id+'</h1><script>document.cookie="fixture='+id+';Max-Age=86400;Path=/";localStorage.setItem("fixture","'+id+'");</script>');}
const server=http.createServer((req,res)=>{
 const id=new URL(req.url,'http://localhost').searchParams.get('id');
 if(!id){res.writeHead(404);res.end();return;}
 requests.push(id);
 if(id==='front'||id==='background-1'){held.set(id,res);res.on('close',()=>{if(held.get(id)===res)held.delete(id);});}
 else reply(res,id);
});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){const end=Date.now()+30000;while(Date.now()<end){const v=await fn();if(v)return v;await delay(50);}throw Error('Startup timeout: '+label);}
async function launch(accounts,timeout){
 const profile=path.join(profiles,String(Date.now()));fs.mkdirSync(profile);
 const base='http://127.0.0.1:'+server.address().port;
 fs.writeFileSync(path.join(profile,'config.json'),JSON.stringify({activeWorkspaceId:'main',selectedAccountId:'front',workspaces:[{id:'main',name:'Main',layout:'focus'},{id:'other',name:'Other',layout:'auto'}],accounts:accounts.map(a=>({...a,name:a.id,url:base+'/?id='+a.id})),preferences:{language:'en'}}));
 const env={...process.env,MULTINEST_USER_DATA:profile,ASTRIA_INITIAL_LOAD_MS:String(timeout)};delete env.ELECTRON_RUN_AS_NODE;
 application=await electron.launch({executablePath:process.env.MULTINEST_TEST_EXE||require('electron'),args:process.env.MULTINEST_TEST_EXE?['--user-data-dir='+profile]:[root],env});
 page=await application.firstWindow();await page.waitForSelector('#grid .panel');
}
function release(id){const res=held.get(id);assert.ok(res,'pending fixture '+id);held.delete(id);reply(res,id);}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 await launch([
  {id:'background-1',activity:'always',workspaceId:'other'},
  {id:'background-2',activity:'always',workspaceId:'other'},
  {id:'front',activity:'always',workspaceId:'main'},
  {id:'cold-visible',activity:'visible',workspaceId:'main'},
  {id:'late',activity:'always',workspaceId:'other'},
  {id:'paused',activity:'suspended',workspaceId:'main'}
 ],10000);
 await until(()=>held.has('front'),'visible navigation');
 assert.equal(requests[0],'front','visible account starts ahead of earlier Always active accounts');
 await delay(150);assert.deepEqual(requests,['front'],'no hidden profile starts while foreground is held');
 assert.equal(await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),true,'UI is visible while the site loads');
 assert.equal((await page.evaluate(()=>window.multiNest.accountRename('front','Responsive'))).ok,true,'UI actions respond during navigation');
 assert.equal((await page.evaluate(()=>window.multiNest.accountActivity('background-2','suspended'))).ok,true);
 release('front');await until(()=>held.has('background-1'),'first background profile');
 assert.deepEqual(requests,['front','background-1'],'hidden accounts load one at a time');
 await page.evaluate(()=>window.multiNest.accountSelect('cold-visible'));
 await until(()=>requests.includes('cold-visible'),'foreground selection bypasses a stalled hidden page');
 assert.ok(held.has('background-1'),'selecting foreground did not require the hidden navigation to finish');
 release('background-1');await until(()=>requests.includes('late'),'remaining Always active account');
 assert.ok(!requests.includes('background-2'),'suspending a queued account cancels its load');
 assert.ok(!requests.includes('paused'),'suspended account never starts');
 await until(async()=>await application.evaluate(({webContents})=>webContents.getAllWebContents().filter(w=>/^http:/.test(w.getURL())&&!w.isLoading()).length)===4,'all requested profiles finish');
 const stored=await application.evaluate(async({webContents})=>Promise.all(webContents.getAllWebContents().filter(w=>/^http:/.test(w.getURL())).map(w=>w.executeJavaScript('({id:new URL(location.href).searchParams.get("id"),cookie:document.cookie,value:localStorage.getItem("fixture")})'))));
 for(const value of stored){assert.equal(value.cookie,'fixture='+value.id);assert.equal(value.value,value.id);}
 await application.close();application=null;
 requests.length=0;
 await launch([{id:'front',activity:'always',workspaceId:'main'},{id:'hang-background',activity:'always',workspaceId:'other'}],1500);
 await until(()=>requests.includes('hang-background'),'bounded fallback for hung foreground');
 assert.ok(held.has('front'),'other account starts even when visible navigation never finishes');
 await application.close();application=null;
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});fs.writeFileSync(path.join(root,'test-results','astria-startup.json'),JSON.stringify({passed:true,checks:['visible account first','responsive window during loading','hidden profiles serialized','queued suspension respected','foreground selection bypasses slow background','separate fixture cookies and localStorage','Always active accounts still open','hung site cannot block startup indefinitely']},null,2));
 console.log('PASS: prioritized startup, responsive UI, serialized background profiles, queued cancellation, isolated storage and slow-site fallback');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(application)await application.close();for(const res of held.values())res.destroy();server.close();});
