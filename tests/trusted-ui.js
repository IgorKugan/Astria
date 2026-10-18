'use strict';
const assert=require('node:assert/strict');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {isInterfaceURL}=require('../src/trusted-ui');
for(const folder of ['Astria~1','Astria cópia']){
  const file=path.join(os.tmpdir(),folder,'resources','app.asar','src','index.html');
  const encoded=pathToFileURL(file).href;
  assert.equal(isInterfaceURL(encoded,file),true);
  assert.equal(isInterfaceURL(encoded.replace(/%7E/gi,'~'),file),true);
  for(const bad of [encoded+'?url=other',encoded+'#other',encoded.replace('index.html','other.html'),'https://example.com/index.html','file://remote-server/share/index.html'])assert.equal(isInterfaceURL(bad,file),false,bad);
}
console.log('PASS: trusted interface paths support tilde/Unicode encoding and reject other files, origins, fragments and queries');
