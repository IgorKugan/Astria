'use strict';
const dns = require('node:dns/promises');
const https = require('node:https');
const { isIP } = require('node:net');
const { Readable, pipeline } = require('node:stream');
const zlib = require('node:zlib');
const publicAgent = new https.Agent({ keepAlive: true, maxSockets: 4, maxTotalSockets: 4, proxyEnv: {} });

function publicIPv4(address) {
  if (isIP(address) !== 4) return false;
  const [a,b,c] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    a === 100 && b >= 64 && b <= 127 || a === 169 && b === 254 ||
    a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 168 || b === 0 && (c === 0 || c === 2) || b === 88 && c === 99) ||
    a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) || a === 203 && b === 0 && c === 113);
}
function publicURL(input) {
  const url = input instanceof URL ? input : new URL(input);
  const host = url.hostname.toLowerCase();
  return url.protocol === 'https:' && !url.port && !url.username && !url.password &&
    !/\.(?:localhost|local|internal|lan|home|test|invalid)$/.test(host) &&
    (isIP(host) ? publicIPv4(host) : host.includes('.') && /^[a-z\d.-]+$/.test(host));
}
async function publicFetch(input, options = {}, { lookup = dns.lookup, request = https.request } = {}) {
  const url = new URL(input);
  if (!publicURL(url)) throw new Error('Public assets require a public HTTPS address.');
  // Resolve IPv4 and pin the checked result in the socket lookup. A second DNS
  // lookup cannot redirect the Node downloader to a LAN or metadata service.
  // IPv6-only and local sites continue through Chromium's normal networking.
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some(entry => !publicIPv4(entry.address))) throw new Error('Non-public asset address rejected.');
  const address = addresses[0].address;
  const headers = Object.fromEntries(new Headers(options.headers));
  headers['accept-encoding'] = 'identity';
  delete headers.cookie; delete headers.authorization; delete headers['proxy-authorization'];
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: 'GET', headers, family: 4, rejectUnauthorized: true, agent: publicAgent,
      signal: options.signal || AbortSignal.timeout(30000),
      lookup: (_hostname, settings, done) => done(null, settings.all ? [{ address, family: 4 }] : address, 4)
    }, response => {
      let stream = response;
      const responseHeaders = new Headers();
      for (let index = 0; index < response.rawHeaders.length; index += 2) responseHeaders.append(response.rawHeaders[index], response.rawHeaders[index + 1]);
      const encoding = (responseHeaders.get('content-encoding') || '').toLowerCase();
      if (encoding && encoding !== 'identity') {
        const decoder = encoding === 'gzip' ? zlib.createGunzip() : encoding === 'br' ? zlib.createBrotliDecompress() : encoding === 'deflate' ? zlib.createInflate() : null;
        if (!decoder) { response.destroy(); reject(new Error('Unsupported public asset encoding.')); return; }
        pipeline(response, decoder, () => {});
        stream = decoder;
        responseHeaders.delete('content-encoding'); responseHeaders.delete('content-length');
      }
      const noBody = [204,205,304].includes(response.statusCode);
      if (noBody) response.resume();
      resolve(new Response(noBody ? null : Readable.toWeb(stream), { status: response.statusCode, headers: responseHeaders }));
    });
    req.on('error', reject);
    req.end();
  });
}
module.exports = { publicFetch, publicIPv4, publicURL };
