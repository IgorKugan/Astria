'use strict';
const resolutions = { '720p': {width:1280,height:720}, '768p': {width:1366,height:768}, '900p': {width:1600,height:900}, '1080p': {width:1920,height:1080} };
function frameBudget(account, { active = false, loaded = 1, rest = false, ultraBackground = false } = {}) {
  let fps = 0;
  if (account.activity === 'eco') fps = account.ecoFPS || 15;
  else if (account.activity === 'adaptive') {
    const secondary = loaded >= 8 ? 5 : loaded >= 4 ? 10 : 15;
    fps = active ? 60 : Math.min(account.ecoFPS || 15, secondary);
  }
  if (rest) fps = Math.min(fps || 2, 2);
  if (ultraBackground) fps = Math.min(fps || 1, 1);
  return fps;
}
function resolutionBounds(preset, panel) {
  const size = Object.hasOwn(resolutions, preset) ? resolutions[preset] : null;
  if (!size) return null;
  const scale = Math.min(panel.width / size.width, panel.height / size.height);
  const width = Math.round(size.width * scale), height = Math.round(size.height * scale);
  return {x: panel.x + Math.floor((panel.width-width)/2), y: panel.y + Math.floor((panel.height-height)/2), width, height};
}
module.exports = { resolutions, frameBudget, resolutionBounds };
