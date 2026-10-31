// Reused from the user's Macro Maker extension; no extension runtime is loaded.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AstriaMacroKeys = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
'use strict';
// Key table shared by every part of the extension.
// Key names are the same as the Windows Macro Maker, so macro files work in both.
// [name, code (KeyboardEvent.code), key, text, shifted, location, vk]

const T = [];
const add = (name, code, key, text = "", shifted = null, loc = 0, vk = 0) =>
  T.push({ name, code, key, text, shifted, loc, vk });

add("Esc", "Escape", "Escape", "", null, 0, 0x1b);
add("Enter", "Enter", "Enter", "\r", null, 0, 0x0d);
add("Space", "Space", " ", " ", null, 0, 0x20);
add("Tab", "Tab", "Tab", "", null, 0, 0x09);
add("Backspace", "Backspace", "Backspace", "", null, 0, 0x08);
add("Up", "ArrowUp", "ArrowUp", "", null, 0, 0x26);
add("Down", "ArrowDown", "ArrowDown", "", null, 0, 0x28);
add("Left", "ArrowLeft", "ArrowLeft", "", null, 0, 0x25);
add("Right", "ArrowRight", "ArrowRight", "", null, 0, 0x27);
add("Insert", "Insert", "Insert", "", null, 0, 0x2d);
add("Delete", "Delete", "Delete", "", null, 0, 0x2e);
add("Home", "Home", "Home", "", null, 0, 0x24);
add("End", "End", "End", "", null, 0, 0x23);
add("Page Up", "PageUp", "PageUp", "", null, 0, 0x21);
add("Page Down", "PageDown", "PageDown", "", null, 0, 0x22);
for (let i = 0; i < 26; i++) {
  const c = String.fromCharCode(97 + i);
  add(c.toUpperCase(), "Key" + c.toUpperCase(), c, c, c.toUpperCase(), 0, 65 + i);
}
")!@#$%^&*(".split("").forEach((s, d) => add(String(d), "Digit" + d, String(d), String(d), s, 0, 48 + d));
for (let n = 1; n <= 24; n++) add("F" + n, "F" + n, "F" + n, "", null, 0, 0x6f + n);
for (let d = 0; d <= 9; d++) add("Num " + d, "Numpad" + d, String(d), String(d), null, 3, 0x60 + d);
add("Num *", "NumpadMultiply", "*", "*", null, 3, 0x6a);
add("Num +", "NumpadAdd", "+", "+", null, 3, 0x6b);
add("Num -", "NumpadSubtract", "-", "-", null, 3, 0x6d);
add("Num .", "NumpadDecimal", ".", ".", null, 3, 0x6e);
add("Num /", "NumpadDivide", "/", "/", null, 3, 0x6f);
[[";", "Semicolon", ":", 0xba], ["=", "Equal", "+", 0xbb], [",", "Comma", "<", 0xbc], ["-", "Minus", "_", 0xbd],
 [".", "Period", ">", 0xbe], ["/", "Slash", "?", 0xbf], ["`", "Backquote", "~", 0xc0], ["[", "BracketLeft", "{", 0xdb],
 ["\\", "Backslash", "|", 0xdc], ["]", "BracketRight", "}", 0xdd], ["'", "Quote", '"', 0xde]]
  .forEach(([ch, code, sh, vk]) => add(ch, code, ch, ch, sh, 0, vk));
add("< >", "IntlBackslash", "\\", "\\", "|", 0, 0xe2);
add("OEM 8", "", "Unidentified", "", null, 0, 0xdf);
add("Shift", "ShiftLeft", "Shift", "", null, 1, 0x10);
add("Ctrl", "ControlLeft", "Control", "", null, 1, 0x11);
add("Alt", "AltLeft", "Alt", "", null, 1, 0x12);
add("Left Shift", "ShiftLeft", "Shift", "", null, 1, 0x10);
add("Right Shift", "ShiftRight", "Shift", "", null, 2, 0x10);
add("Left Ctrl", "ControlLeft", "Control", "", null, 1, 0x11);
add("Right Ctrl", "ControlRight", "Control", "", null, 2, 0x11);
add("Left Alt", "AltLeft", "Alt", "", null, 1, 0x12);
add("Right Alt", "AltRight", "Alt", "", null, 2, 0x12);
add("Left Win", "MetaLeft", "Meta", "", null, 1, 0x5b);
add("Right Win", "MetaRight", "Meta", "", null, 2, 0x5c);
add("Menu", "ContextMenu", "ContextMenu", "", null, 0, 0x5d);
add("Caps Lock", "CapsLock", "CapsLock", "", null, 0, 0x14);
add("Num Lock", "NumLock", "NumLock", "", null, 0, 0x90);
add("Scroll Lock", "ScrollLock", "ScrollLock", "", null, 0, 0x91);
add("Print Screen", "PrintScreen", "PrintScreen", "", null, 0, 0x2c);
add("Pause", "Pause", "Pause", "", null, 0, 0x13);
add("Clear", "Numpad5", "Clear", "", null, 3, 0x0c);
add("Middle Mouse", "", "", "", null, 0, 0x04);
add("Mouse Back", "", "", "", null, 0, 0x05);
add("Mouse Forward", "", "", "", null, 0, 0x06);
[["Volume Mute", "AudioVolumeMute", 0xad], ["Volume Down", "AudioVolumeDown", 0xae], ["Volume Up", "AudioVolumeUp", 0xaf],
 ["Play/Pause", "MediaPlayPause", 0xb3], ["Next Track", "MediaTrackNext", 0xb0], ["Previous Track", "MediaTrackPrevious", 0xb1],
 ["Stop Media", "MediaStop", 0xb2], ["Browser Back", "BrowserBack", 0xa6], ["Browser Forward", "BrowserForward", 0xa7],
 ["Browser Refresh", "BrowserRefresh", 0xa8], ["Browser Stop", "BrowserStop", 0xa9], ["Browser Search", "BrowserSearch", 0xaa],
 ["Browser Favorites", "BrowserFavorites", 0xab], ["Browser Home", "BrowserHome", 0xac], ["Mail", "LaunchMail", 0xb4],
 ["Media Select", "MediaSelect", 0xb5], ["Launch App 1", "LaunchApp1", 0xb6], ["Launch App 2", "LaunchApp2", 0xb7]]
  .forEach(([n, code, vk]) => add(n, code, code, "", null, 0, vk));

const KEYS = T;
const KEY_NAMES = T.map((k) => k.name);
const BY_NAME = new Map(T.map((k) => [k.name.toUpperCase().replace(/ /g, ""), k]));
const ALIASES = { CONTROL: "Ctrl", ESCAPE: "Esc", RETURN: "Enter", PGUP: "Page Up", PGDN: "Page Down",
  DEL: "Delete", INS: "Insert", WIN: "Left Win", WINDOWS: "Left Win", MOUSE4: "Mouse Back", MOUSE5: "Mouse Forward" };

function keyDef(name) {
  if (typeof name !== "string") return null;
  const norm = name.toUpperCase().replace(/ /g, "");
  return BY_NAME.get(norm) || (ALIASES[norm] && BY_NAME.get(ALIASES[norm].toUpperCase().replace(/ /g, ""))) || null;
}

// KeyboardEvent.code -> key name (generic modifiers map to their left/right names)
const CODE_TO_NAME = {};
for (const k of T) if (k.code && !(k.code in CODE_TO_NAME) && !["Shift", "Ctrl", "Alt", "Clear"].includes(k.name)) CODE_TO_NAME[k.code] = k.name;
CODE_TO_NAME.NumpadEnter = "Enter";
CODE_TO_NAME.NumpadEqual = "=";
const BUTTON_TO_NAME = { 1: "Middle Mouse", 3: "Mouse Back", 4: "Mouse Forward" };
const MOUSE_KEYS = { "Middle Mouse": "middle", "Mouse Back": "back", "Mouse Forward": "forward" };

const MOD_ORDER = ["Ctrl", "Alt", "Shift", "Win"];
const MOD_BIT = { Alt: 1, Ctrl: 2, Win: 4, Shift: 8 };
const MOD_OF_NAME = { Shift: "Shift", "Left Shift": "Shift", "Right Shift": "Shift", Ctrl: "Ctrl", "Left Ctrl": "Ctrl",
  "Right Ctrl": "Ctrl", Alt: "Alt", "Left Alt": "Alt", "Right Alt": "Alt", "Left Win": "Win", "Right Win": "Win" };
const MOD_KEY_NAME = { Ctrl: "Ctrl", Alt: "Alt", Shift: "Shift", Win: "Left Win" };
const HOTKEY_BLOCKED = { Esc: "Esc", Enter: "Enter", Tab: "Tab", Backspace: "Backspace",
  "Left Win": "A tecla Windows", "Right Win": "A tecla Windows" };

function modsOfEvent(e) {
  const m = [];
  if (e.ctrlKey) m.push("Ctrl");
  if (e.altKey) m.push("Alt");
  if (e.shiftKey) m.push("Shift");
  if (e.metaKey) m.push("Win");
  return m;
}

function normalizeMods(mods) {
  if (!Array.isArray(mods)) return [];
  const set = new Set(mods.map((m) => ({ CONTROL: "Ctrl", WINDOWS: "Win" }[String(m).toUpperCase()] ||
    MOD_ORDER.find((x) => x.toUpperCase() === String(m).toUpperCase()))));
  return MOD_ORDER.filter((m) => set.has(m));
}

function makeCombo(key, mods = []) {
  const d = keyDef(key);
  if (!d) throw new Error(`Tecla desconhecida: "${key}".`);
  const ms = normalizeMods(mods).filter((m) => m !== MOD_OF_NAME[d.name]);
  return { key: d.name, mods: ms };
}

const PT = { Space: "Espaço", Up: "Seta ↑", Down: "Seta ↓", Left: "Seta ←", Right: "Seta →",
  "Middle Mouse": "Botão do meio", "Mouse Back": "Mouse lateral 1", "Mouse Forward": "Mouse lateral 2",
  "Left Shift": "Shift esq.", "Right Shift": "Shift dir.", "Left Ctrl": "Ctrl esq.", "Right Ctrl": "Ctrl dir.",
  "Left Alt": "Alt esq.", "Right Alt": "Alt Gr", "Left Win": "Windows", "Right Win": "Windows dir.",
  "Page Up": "Page Up", "Page Down": "Page Down", "Caps Lock": "Caps Lock", Delete: "Delete" };
const keyLabel = (name) => PT[name] || name;
const comboText = (c) => [...(c.mods || []), keyLabel(c.key)].join(" + ");
const comboEqual = (a, b) => keyDef(a.key) === keyDef(b.key) &&
  [...a.mods].sort().join() === [...b.mods].sort().join();

function isPrintable(name) {
  const d = keyDef(name);
  return !!(d && d.text && d.text !== "\r");
}

// character -> [key name, needs shift]; main keyboard before numpad
const CHAR_KEYS = {};
for (const k of [...T].sort((a, b) => a.loc - b.loc)) {
  if (k.text && k.text !== "\r" && !(k.text in CHAR_KEYS)) CHAR_KEYS[k.text] = [k.name, false];
  if (k.shifted && k.shifted.length === 1 && !(k.shifted in CHAR_KEYS)) CHAR_KEYS[k.shifted] = [k.name, true];
}

// How the in-page hotkey listener recognises a hotkey key
function triggerOf(combo) {
  const d = keyDef(combo.key);
  if (!d) return null;
  const btn = { "Middle Mouse": 1, "Mouse Back": 3, "Mouse Forward": 4 }[d.name];
  if (btn !== undefined) return { button: btn };
  return { code: d.code, plain: isPrintable(d.name) && !combo.mods.some((m) => m === "Ctrl" || m === "Alt"),
    prevent: /^F\d+$/.test(d.name) };
}

return { KEYS, KEY_NAMES, keyDef, CODE_TO_NAME, BUTTON_TO_NAME, MOUSE_KEYS, MOD_ORDER, MOD_BIT, MOD_OF_NAME, MOD_KEY_NAME, HOTKEY_BLOCKED, modsOfEvent, normalizeMods, makeCombo, keyLabel, comboText, comboEqual, isPrintable, CHAR_KEYS, triggerOf };
});
