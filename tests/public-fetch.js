'use strict';
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {PassThrough}=require('node:stream');
const zlib=require('node:zlib');
const {publicFetch,publicIPv4,publicURL}=require('../src/public-fetch');
for(const ip of ['0.0.0.0','10.1.2.3','100.64.0.1','127.0.0.1','169.254.169.254','172.16.0.1','172.31.255.255','192.168.0.1','192.0.2.1','198.18.0.1','198.51.100.1','203.0.113.1','224.0.0.1','255.255.255.255','::1','::ffff:127.0.0.1'])assert.equal(publicIPv4(ip),false,ip);
assert.equal(publicIPv4('8.8.8.8'),true);
for(const url of ['https://127.0.0.1/a.png','https://[::1]/a.png','https://game.local/a.png','https://localhost/a.png','http://cdn.example.com/a.png','https://u:p@cdn.example.com/a.png'])assert.equal(publicURL(url),false,url);
(async()=>{
  let calls=0;
  await assert.rejects(publicFetch('https://cdn.example.com/a.png',{}, {lookup:async()=>[{address:'127.0.0.1',family:4}],request:()=>{calls++;}}),/Non-public/);
  assert.equal(calls,0,'private DNS results never open a socket');
  await assert.rejects(publicFetch('https://cdn.example.com/a.png',{}, {lookup:async()=>[{address:'8.8.8.8',family:4},{address:'192.168.0.1',family:4}],request:()=>{calls++;}}),/Non-public/);
  let lookups=0;
  const response=await publicFetch('https://cdn.example.com/a.png',{headers:{cookie:'secret',authorization:'secret',accept:'image/png'}},{lookup:async()=>{lookups++;return[{address:'8.8.8.8',family:4}];},request:(url,options,callback)=>{
    calls++;assert.equal(url.hostname,'cdn.example.com');assert.equal(options.rejectUnauthorized,true);assert.equal(options.headers.cookie,undefined);assert.equal(options.headers.authorization,undefined);
    options.lookup(url.hostname,{},(error,address,family)=>{assert.equal(error,null);assert.equal(address,'8.8.8.8');assert.equal(family,4);});
    const req=new EventEmitter();req.end=()=>{const res=new PassThrough();res.statusCode=200;res.rawHeaders=['Content-Type','image/png','Cache-Control','public,max-age=3600','Content-Encoding','gzip'];callback(res);res.end(zlib.gzipSync('public image fixture'));};return req;
  }});
  assert.equal(await response.text(),'public image fixture');assert.equal(response.headers.has('content-encoding'),false);assert.equal(lookups,1,'socket uses the checked DNS address without a second lookup');
  console.log('PASS: generic public HTTPS assets, DNS pinning, private/loopback blocking, anonymous requests, TLS checks and gzip decoding');
})().catch(error=>{console.error(error);process.exitCode=1;});
