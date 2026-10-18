'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SharedAssets, candidate, lifetime, cacheKey } = require('../src/shared-assets');
const request = (url = 'https://game.test/assets/map.png', headers = {}) => new Request(url, { headers });
const publicResponse = () => new Response('public asset', { headers: { 'content-type': 'image/png', 'cache-control': 'public,max-age=3600' } });
assert.equal(candidate(request()), true);
assert.equal(candidate(request('https://cdn.example.com/data/map.gat')), true);
assert.equal(candidate(request('https://cdn.example.com/data/names.txt')), false);
assert.equal(lifetime(new Response('map', { headers: { 'content-type': 'application/octet-stream' } }), request('https://cdn.example.com/data/map.gat')), 0, 'no site-specific freshness exceptions');
for (const suffix of ['api/sprite.png', 'config.js', 'runtime-config.js', 'assets/avatar.png', 'assets/map.png?token=secret', 'assets/map.png?account=1', 'assets/%GG.png']) assert.equal(candidate(request('https://game.test/' + suffix)), false, suffix);
for (const headers of [{ authorization: 'secret' }, { range: 'bytes=0-1' }, { 'cache-control': 'no-cache' }]) assert.equal(candidate(request(undefined, headers)), false);
assert.equal(lifetime(publicResponse()), 3600000);
for (const headers of [{ 'cache-control': 'private,max-age=3600' }, { 'cache-control': 'no-store' }, { vary: 'Cookie' }, { vary: '*' }, { 'set-cookie': 'id=private' }, { 'content-type': 'application/json' }]) {
  const response = publicResponse(); for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  assert.equal(lifetime(response), 0);
}
assert.equal(cacheKey(request(undefined, { cookie: 'a' })), cacheKey(request(undefined, { cookie: 'b' })), 'anonymous assets do not depend on profile cookie');
assert.notEqual(cacheKey(request(undefined, { origin: 'https://a.test' })), cacheKey(request(undefined, { origin: 'https://b.test' })), 'CORS variants remain separate');
(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'astria-public-'));
  let network = 0, forwarded = 0;
  const cache = new SharedAssets(directory, { allowURL: () => true, fetch: async (_url, options) => {
    network++; assert.equal(options.credentials, 'omit');
    assert.equal(options.headers.has('cookie'), false); assert.equal(options.headers.has('authorization'), false);
    await new Promise(resolve => setTimeout(resolve, 15)); return publicResponse();
  } });
  const forward = () => { forwarded++; return new Response('private'); };
  const results = await Promise.all([cache.serve(request(undefined, { cookie: 'a' }), forward), cache.serve(request(undefined, { cookie: 'b' }), forward)]);
  for (const result of results) assert.equal(await result.text(), 'public asset');
  assert.equal(network, 1); assert.equal(forwarded, 0);
  assert.equal(cache.stats.hits, 1);
  const reloaded = new SharedAssets(directory, { allowURL: () => true, fetch: () => { throw new Error('cache was not moved/persisted'); } });
  assert.equal(await (await reloaded.serve(request(), forward)).text(), 'public asset');
  const metaPath = path.join(directory, cacheKey(request()) + '.json');
  const meta = JSON.parse(fs.readFileSync(metaPath)); meta.expires = 0; fs.writeFileSync(metaPath, JSON.stringify(meta));
  assert.equal(await (await cache.serve(request(), forward)).text(), 'public asset');
  assert.equal(network, 2, 'expired assets refresh');
  await cache.serve(request('https://game.test/api/info.png'), forward);
  assert.equal(network, 2); assert.equal(forwarded, 1);
  const privateCache = new SharedAssets(path.join(directory, 'private'), { allowURL: () => true, fetch: async () => new Response('secret', { headers: { 'content-type': 'image/png', 'cache-control': 'private,max-age=3600' } }) });
  assert.equal(await (await privateCache.serve(request(), forward)).text(), 'private');
  assert.equal(fs.readdirSync(privateCache.directory).length, 0, 'private responses never enter shared files');
  const bounded = new SharedAssets(path.join(directory, 'bounded'), { allowURL: () => true, maxDisk: 24, fetch: async () => publicResponse() });
  for (const name of ['one', 'two', 'three']) {
    const result = await bounded.serve(request('https://game.test/assets/' + name + '.png'), forward);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    await result.text();
  }
  assert.equal(bounded.stats.bytes, 24, 'old public files are evicted at the disk limit');
  console.log('PASS: public-only anonymous cache, concurrent deduplication, persistence, expiry, CORS variants and credential exclusions');
})().catch(error => { console.error(error); process.exitCode = 1; });
