'use strict';
(() => {
  function hsvToHex(h, s, v) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(1, s)); v = Math.max(0, Math.min(1, v));
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    const rgb = h < 60 ? [c,x,0] : h < 120 ? [x,c,0] : h < 180 ? [0,c,x] : h < 240 ? [0,x,c] : h < 300 ? [x,0,c] : [c,0,x];
    return '#' + rgb.map(value => Math.round((value + m) * 255).toString(16).padStart(2, '0')).join('');
  }
  function hexToHsv(hex) {
    if (!/^#[a-f\d]{6}$/i.test(hex)) return null;
    const [r,g,b] = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255);
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max-min;
    const h = !d ? 0 : max === r ? 60 * (((g-b)/d+6)%6) : max === g ? 60*((b-r)/d+2) : 60*((r-g)/d+4);
    return {h,s:max?d/max:0,v:max};
  }
  const api = { hsvToHex, hexToHsv };
  if (typeof module !== 'undefined') module.exports = api;
  else window.AstriaColor = api;
})();
