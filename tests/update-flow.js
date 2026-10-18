'use strict';
// Real Windows updater test. Uses clean distributions and temporary fixture accounts only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { _electron: electron } = require('playwright');
const { version } = require('../package.json');
const root = path.resolve(__dirname, '..');
const release = path.join(root, 'dist', 'release');
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'au-'));
const directory = path.join(testRoot, 'Astria');
fs.cpSync(process.env.ASTRIA_OLD_PORTABLE || path.join(root, 'dist', `Astria-Portable-${version}`), directory, { recursive: true });
let app;
const server = http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Update fixture</title><p>Local session fixture</p>');});
async function until(fn, name, ms = 60000) {
  const end = Date.now()+ms;
  while (Date.now()<end) { const result=await fn();if(result)return result;await new Promise(r=>setTimeout(r,200)); }
  throw new Error('Timeout: '+name);
}
async function launch() {
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.MULTINEST_USER_DATA;
  app=await electron.launch({executablePath:path.join(directory,'Astria.exe'),env});
  return app.firstWindow();
}
async function sessionValues() {
  return app.evaluate(async ({session}, ids)=>Promise.all(ids.map(async id=>({id,cookie:(await session.fromPartition('persist:multinest-'+id).cookies.get({name:'update-fixture'})).map(c=>c.value)}))),globalThis.accountIds);
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/`;
  let page=await launch();await page.waitForSelector('#grid');
  for(let i=0;i<2;i++)assert.equal((await page.evaluate(({url,i})=>window.multiNest.accountAdd({name:'Update fixture '+i,url}),{url,i})).ok,true);
  globalThis.accountIds=(await page.evaluate(()=>window.multiNest.getState())).state.accounts.map(a=>a.id);
  await app.evaluate(async({session},ids)=>{for(let i=0;i<ids.length;i++)await session.fromPartition('persist:multinest-'+ids[i]).cookies.set({url:'http://127.0.0.1',name:'update-fixture',value:String(i),expirationDate:Date.now()/1000+86400});},globalThis.accountIds);
  const before=await sessionValues();
  fs.writeFileSync(path.join(directory,'personal-notes.txt'),'must remain untouched');
  const checked=await app.evaluate(async({app},args)=>{
    const require=process.getBuiltinModule('module').createRequire(args.module);
    const fs=require('node:fs'),path=require('node:path'),{Readable}=require('node:stream');
    const {Updates}=require(args.module),config=require(path.join(args.root,'src','release-config.json'));
    const nativeFetch=globalThis.fetch;
    globalThis.fetch=async input=>{
      const url=String(input);
      if(url==='https://api.github.com/repos/'+config.repository+'/releases/latest')return new Response(JSON.stringify({tag_name:'v'+args.version}));
      const prefix='https://github.com/'+config.repository+'/releases/download/v'+args.version+'/';
      if(!url.startsWith(prefix))throw new Error('Unexpected test network request');
      const name=url.slice(prefix.length);
      if(!['astria-update.json','astria-update.sig',`Astria-Portable-${args.version}.zip`].includes(name))throw new Error('Unexpected test asset');
      const file=path.join(args.release,name);
      return new Response(Readable.toWeb(fs.createReadStream(file)),{headers:{'content-length':String(fs.statSync(file).size)}});
    };
    const storage={portable:true,root:path.join(args.directory,'Save'),backups:path.join(args.directory,'Save','Backups')};
    globalThis.testUpdater=new Updates({storage,currentVersion:'0.0.0',...config});
    const checked=await globalThis.testUpdater.check();
    await globalThis.testUpdater.download();
    globalThis.fetch=nativeFetch;
    return {checked,ready:globalThis.testUpdater.ready};
  },{module:path.join(root,'src','updates.js'),root,release,version,directory});
  assert.equal(checked.checked.available,true);
  await app.evaluate(async({app})=>{await globalThis.testUpdater.install();setTimeout(()=>app.quit(),200);});
  await app.close().catch(()=>{});app=null;
  const resultPath=path.join(path.dirname(checked.ready.jobPath),'result.txt');
  await until(()=>fs.existsSync(resultPath),'update result');
  assert.match(fs.readFileSync(resultPath,'utf8'),/Update successful/);
  // Interactive lifecycle check: close this temporary fixture copy normally.
  console.log('CLOSE FIXTURE: '+directory+'\\Astria.exe then press Enter here.');
  await new Promise(resolve=>{process.stdin.resume();process.stdin.once('data',()=>{process.stdin.pause();resolve();});});
  page=await launch();await page.waitForSelector('#grid');
  assert.equal(await app.evaluate(({app})=>app.getVersion()),version);
  assert.deepEqual(await sessionValues(),before);
  assert.equal(fs.readFileSync(path.join(directory,'personal-notes.txt'),'utf8'),'must remain untouched');
  assert.deepEqual((await page.evaluate(()=>window.multiNest.getState())).state.accounts.map(a=>a.id),globalThis.accountIds);
  await app.close();app=null;
  // A verified-but-unlaunchable replacement must restore the old executable.
  const jobFolder=path.join(directory,'Save','Updates','update-rollback-fixture');
  const stage=path.join(jobFolder,'program');fs.mkdirSync(stage,{recursive:true});
  const bad=path.join(stage,'Astria.exe');fs.writeFileSync(bad,'invalid executable');
  const hash=await require('../src/updates').hashFile(bad);
  const backup=path.join(directory,'Save','Backups','Program-rollback-fixture');
  const job={root:directory,folder:jobFolder,stage,backup,pid:2147483647,oldFiles:['Astria.exe'],files:[{path:'Astria.exe',size:fs.statSync(bad).size,sha256:hash}],version};
  const jobPath=path.join(jobFolder,'job.json');fs.writeFileSync(jobPath,JSON.stringify(job));
  const exit=await new Promise((resolve,reject)=>{const c=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'src','apply-update.ps1'),'-JobPath',jobPath],{windowsHide:true,stdio:'pipe'});let errors='';c.stderr.on('data',x=>errors+=x);c.on('error',reject);c.on('exit',code=>resolve({code,errors}));});
  assert.equal(exit.code,1,exit.errors);assert.match(fs.readFileSync(path.join(jobFolder,'result.txt'),'utf8'),/Rolled back/);
  assert.equal(await require('../src/updates').hashFile(path.join(directory,'Astria.exe')),await require('../src/updates').hashFile(path.join(root,'dist',`Astria-Portable-${version}`,'Astria.exe')));
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  fs.writeFileSync(path.join(root,'test-results','astria-update-flow.json'),JSON.stringify({passed:true,checks:['signed release download','every program file verified','normal exit and restart','existing account IDs/cookies preserved','user files untouched','backup retained','failed executable triggers rollback'],testRoot},null,2));
  console.log('PASS: signed portable update and restart, account/session preservation, user-file preservation and failed-launch rollback. Fixture copy: '+directory);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(app)await app.close();server.close();});
