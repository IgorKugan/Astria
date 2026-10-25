'use strict';
// Render the vector source and embed PNG images at Windows taskbar/icon sizes.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
if (!process.versions.electron) {
  const { spawnSync } = require('node:child_process');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(require('electron'), [__filename], { env, stdio: 'inherit', windowsHide: true });
  process.exit(result.status ?? 1);
}
const { app, BrowserWindow } = require('electron');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 512, height: 512, useContentSize: true, frame: false, show: false, transparent: true, backgroundColor: '#00000000', webPreferences: { offscreen: true, sandbox: true, backgroundThrottling: false } });
  const svg = fs.readFileSync(path.join(root, 'docs/brand/astria-star-ray.svg'), 'utf8');
  await window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<style>html,body{margin:0;width:512px;height:512px;background:transparent}svg{display:block}</style>' + svg));
  await window.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const image = await window.webContents.capturePage();
  // A bright center catches incomplete offscreen paints before shipping an empty icon.
  const pixel = image.toBitmap(), center = (256 * image.getSize().width + 256) * 4;
  if (!pixel.subarray(center, center + 3).every(channel => channel > 200)) throw new Error('Star center was not rendered');
  fs.writeFileSync(path.join(root, 'docs/brand/astria-512.png'), image.toPNG());
  fs.writeFileSync(path.join(root, 'docs/brand/astria-256.png'), image.resize({ width: 256, height: 256, quality: 'best' }).toPNG());
  const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
  const images = sizes.map(size => image.resize({ width: size, height: size, quality: 'best' }).toPNG());
  const header = Buffer.alloc(6 + sizes.length * 16); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16;
    header[entry] = size === 256 ? 0 : size; header[entry + 1] = header[entry];
    header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(images[index].length, entry + 8); header.writeUInt32LE(offset, entry + 12);
    offset += images[index].length;
  });
  fs.writeFileSync(path.join(root, 'src/astria.ico'), Buffer.concat([header, ...images]));
  console.log('Rendered star-ray logo and nine Windows icon sizes.');
  window.destroy(); app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
