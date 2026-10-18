'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { generateKeyPairSync, createHash, sign } = require('node:crypto');
const { newer, verifyManifest, extract, githubFetch } = require('../src/updates');
const { trustedPublicURL, SharedAssets } = require('../src/shared-assets');
const hash = value => createHash('sha256').update(value).digest('hex');
// Tiny stored-entry ZIP writer, including deliberately invalid paths for extraction tests.
function fixtureZip(files) {
  const local = [], central = []; let offset = 0;
  for (const [name, value] of Object.entries(files)) {
    const n = Buffer.from(name), body = Buffer.from(value), h = Buffer.alloc(30), c = Buffer.alloc(46);
    h.writeUInt32LE(0x04034b50); h.writeUInt16LE(20,4); h.writeUInt32LE(body.length,18); h.writeUInt32LE(body.length,22); h.writeUInt16LE(n.length,26);
    c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20,4); c.writeUInt16LE(20,6); c.writeUInt32LE(body.length,20); c.writeUInt32LE(body.length,24); c.writeUInt16LE(n.length,28); c.writeUInt32LE(offset,42);
    local.push(h,n,body); central.push(c,n); offset += h.length+n.length+body.length;
  }
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(central.length/2,8); end.writeUInt16LE(central.length/2,10); end.writeUInt32LE(Buffer.concat(central).length,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,...central,end]);
}
(async () => {
  assert.equal(newer('1.10.0','1.9.9'),true); assert.equal(newer('1.5.0','1.5.0'),false); assert.equal(newer('1.4.9','1.5.0'),false); assert.equal(newer('../x','1.0.0'),false);
  for (const url of ['http://huntera.com.br/main.js','http://127.0.0.1/a.js','https://evil.test/a.js','https://huntera.com.br.evil.test/a.js','https://huntera.com.br:8443/a.js']) assert.equal(trustedPublicURL(new URL(url)),false,url);
  assert.equal(trustedPublicURL(new URL('https://grf.robrowser.com/data/map.gat')),true);
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'astria-update-'));
  let network=0;
  const shared=new SharedAssets(path.join(directory,'cache'),{ fetch:async()=>{network++;throw new Error('Unexpected private network request');} });
  assert.equal(await shared.lookup(new Request('http://127.0.0.1/private.png')),null); assert.equal(network,0);
  const { publicKey, privateKey }=generateKeyPairSync('ed25519');
  const files={'Astria.exe':'fixture exe','resources/app.asar':'fixture asar','portable.flag':'portable'};
  const zipFiles=Object.fromEntries(Object.entries(files).map(([p,v])=>['Astria-Portable-1.5.0/'+p,v]));
  const zip=fixtureZip(zipFiles);
  const manifest={schema:1,version:'1.5.0',platform:'win32',arch:'x64',asset:'Astria-Portable-1.5.0.zip',size:zip.length,sha256:hash(zip),files:Object.entries(files).map(([p,v])=>({path:p,size:Buffer.byteLength(v),sha256:hash(v)}))};
  const signed=m=>{const bytes=Buffer.from(JSON.stringify(m));return [bytes,sign(null,bytes,privateKey).toString('base64'),publicKey];};
  assert.equal(verifyManifest(...signed(manifest)).version,'1.5.0');
  assert.throws(()=>verifyManifest(Buffer.from('{}'),signed(manifest)[1],publicKey),/Assinatura/);
  assert.throws(()=>verifyManifest(...signed({...manifest,files:[...manifest.files,{path:'Save/Profile/config.json',size:1,sha256:hash('x')}]})),/autorizado/);
  assert.throws(()=>verifyManifest(...signed({...manifest,files:[...manifest.files,{...manifest.files[0],path:'astria.exe'}]})),/autorizado/);
  assert.throws(()=>verifyManifest(...signed({...manifest,files:[{...manifest.files[0],path:'../Astria.exe'}]})),/autorizado/);
  assert.throws(()=>verifyManifest(...signed({...manifest,size:400*1024*1024})),/inválido/);
  const zipPath=path.join(directory,'valid.zip');fs.writeFileSync(zipPath,zip);
  await extract(zipPath,path.join(directory,'valid'),manifest);
  assert.equal(fs.readFileSync(path.join(directory,'valid','Astria.exe'),'utf8'),files['Astria.exe']);
  for (const [name, body] of Object.entries({ traversal:fixtureZip({...zipFiles,'Astria-Portable-1.5.0/../outside.txt':'x'}), save:fixtureZip({...zipFiles,'Astria-Portable-1.5.0/Save/Profile/config.json':'x'}), missing:fixtureZip({'Astria-Portable-1.5.0/Astria.exe':'fixture exe'}), tampered:fixtureZip({...zipFiles,'Astria-Portable-1.5.0/Astria.exe':'wrong exe!!'}) })) {
    const file=path.join(directory,name+'.zip');fs.writeFileSync(file,body);await assert.rejects(extract(file,path.join(directory,name),manifest));
  }
  assert.equal(fs.existsSync(path.join(directory,'outside.txt')),false);
  await assert.rejects(githubFetch('https://evil.test/update.zip',100,()=>{throw new Error('should not fetch');}),/autorizado/);
  await assert.rejects(githubFetch('https://github.com/a/b',100,async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}})),/autorizado/);
  console.log('PASS: signed updates, anti-downgrade version check, tamper detection, bounded extraction, traversal/private-path rejection, update host restrictions and shared-cache host isolation');
})().catch(error=>{console.error(error);process.exitCode=1;});
