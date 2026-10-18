'use strict';
const ROOT_FILES = new Set(('Astria.exe chrome_100_percent.pak chrome_200_percent.pak d3dcompiler_47.dll dxcompiler.dll dxil.dll ffmpeg.dll icudtl.dat libEGL.dll libGLESv2.dll LICENSE LICENSE.electron.txt LICENSES.chromium.html resources.pak snapshot_blob.bin v8_context_snapshot.bin vk_swiftshader.dll vk_swiftshader_icd.json vulkan-1.dll portable.flag LEIA-ME.txt').split(' '));
// Update archives may replace program files only, never Save or arbitrary paths.
function packagePath(name) {
  return typeof name === 'string' && (ROOT_FILES.has(name) || /^locales\/[a-zA-Z0-9-]+\.pak$/.test(name) || name === 'resources/app.asar');
}
module.exports = { packagePath };
