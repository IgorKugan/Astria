// Reused from the user's Macro Maker extension; version 2 files remain compatible.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./macro-keys'));
  else root.AstriaMacroCore = factory(root.AstriaMacroKeys);
})(typeof globalThis === 'object' ? globalThis : this, function (keys) {
'use strict';
// Macro format + checks. Same file format as the Windows Macro Maker (version 2).
const { keyDef, makeCombo, comboText, comboEqual } = keys;

const STEP_TYPES = ["key", "mouse", "move", "scroll", "text", "wait"];
const TYPE_LABEL = { key: "Tecla", mouse: "Clique", move: "Mover mouse", scroll: "Rolar", text: "Digitar texto", wait: "Esperar" };
const MAX_STEPS = 1000;
const MAX_TEXT = 5000;
const COORD = 100000;

function fmtNum(v) {
  if (Number.isInteger(v)) return String(v);
  return String(+v.toFixed(3)).replace(".", ",");
}

function parseNum(value, label, lo, hi, integer = false) {
  let n = typeof value === "string" ? Number(value.trim().replace(",", ".")) : value;
  if (typeof n !== "number" || value === "" || value === null || !Number.isFinite(n)) throw new Error(`${label}: precisa ser um número.`);
  if (n < lo || n > hi) throw new Error(`${label}: precisa estar entre ${fmtNum(lo)} e ${fmtNum(hi)}.`);
  if (integer && !Number.isInteger(n)) throw new Error(`${label}: precisa ser um número inteiro.`);
  return integer ? n : Math.round(n * 10000) / 10000;
}

const choice = (v, label, opts, def) => {
  v = v ?? def;
  if (!opts.includes(v)) throw new Error(`${label}: valor inválido.`);
  return v;
};

function defaultStep(type) {
  const s = { type, enabled: true, after: 0.2 };
  if (type === "key") Object.assign(s, { action: "tap", key: "Space", mods: [], hold: 0.05 });
  if (type === "mouse") Object.assign(s, { action: "click", button: "left", at_point: true, x: 0, y: 0, glide: 0 });
  if (type === "move") Object.assign(s, { x: 0, y: 0, glide: 0.2, after: 0.1 });
  if (type === "scroll") Object.assign(s, { direction: "down", amount: 3, at_point: false, x: 0, y: 0 });
  if (type === "text") Object.assign(s, { text: "", char_delay: 0.02 });
  if (type === "wait") Object.assign(s, { seconds: 1, random: 0, after: 0 });
  return s;
}

function cleanStep(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Passo inválido.");
  if (!STEP_TYPES.includes(raw.type)) throw new Error("Tipo de passo desconhecido.");
  const d = defaultStep(raw.type);
  const g = (k) => (raw[k] === undefined ? d[k] : raw[k]);
  const s = { type: raw.type, enabled: !!g("enabled"), after: parseNum(g("after"), "Esperar depois", 0, 86400) };
  if (s.type === "key") {
    const c = makeCombo(g("key"), g("mods"));
    Object.assign(s, { action: choice(g("action"), "Ação", ["tap", "down", "up"], "tap"), key: c.key, mods: c.mods,
      hold: parseNum(g("hold"), "Segurar por", 0, 60) });
  } else if (["mouse", "move", "scroll"].includes(s.type)) {
    if (s.type === "mouse") Object.assign(s, { action: choice(g("action"), "Clique", ["click", "double", "down", "up"], "click"),
      button: choice(g("button"), "Botão", ["left", "right", "middle"], "left") });
    if (s.type === "scroll") Object.assign(s, { direction: choice(g("direction"), "Direção", ["up", "down"], "down"),
      amount: parseNum(g("amount"), "Quantidade", 1, 100, true) });
    s.at_point = s.type === "move" ? true : !!g("at_point");
    s.x = parseNum(g("x"), "X", -COORD, COORD, true);
    s.y = parseNum(g("y"), "Y", -COORD, COORD, true);
    if (s.type !== "scroll") s.glide = parseNum(g("glide"), "Deslizar", 0, 10);
  } else if (s.type === "text") {
    const t = g("text");
    if (typeof t !== "string") throw new Error("Texto inválido.");
    if (t.length > MAX_TEXT) throw new Error(`Texto longo demais (máx. ${MAX_TEXT}).`);
    Object.assign(s, { text: t, char_delay: parseNum(g("char_delay"), "Intervalo entre letras", 0, 5) });
  } else if (s.type === "wait") {
    Object.assign(s, { seconds: parseNum(g("seconds"), "Tempo", 0, 86400), random: parseNum(g("random"), "Extra aleatório", 0, 86400), after: 0 });
  }
  return s;
}

function legacyStep(r) {
  if (r.kind === "key") { const c = makeCombo(...splitCombo(r.key)); return { type: "key", key: c.key, mods: c.mods, after: r.after ?? 0.25 }; }
  if (r.kind === "click") return { type: "mouse", button: r.button || "left", x: r.x, y: r.y, after: r.after ?? 0.25 };
  if (r.kind === "wait") return { type: "wait", seconds: r.after ?? 1 };
  throw new Error("Passo desconhecido em arquivo antigo.");
}

function splitCombo(text) {
  const parts = String(text || "").split("+").map((p) => p.trim());
  const key = parts.pop();
  return [key, parts];
}

function newProfile() {
  return { app: "Macro Maker", version: 2, steps: [], repeat: 0, loop_delay: 0.5, start_delay: 2,
    target: { mode: "chrome", site: "" } };
}

function cleanProfile(data) {
  if (!data || typeof data !== "object") throw new Error("Isto não é um arquivo de macro.");
  const raw = Array.isArray(data.steps) ? data.steps : [];
  if (raw.length > MAX_STEPS) throw new Error(`No máximo ${MAX_STEPS} passos.`);
  const legacy = data.version === 1 || raw.some((r) => r && "kind" in r);
  if (!legacy && (data.version ?? 2) !== 2) throw new Error("Arquivo feito por uma versão mais nova.");
  const steps = raw.map((r, i) => {
    try { return cleanStep(legacy ? legacyStep(r) : r); } catch (e) { throw new Error(`Passo ${i + 1}: ${e.message}`); }
  });
  const t = data.target && typeof data.target === "object" ? data.target : {};
  return { ...newProfile(), steps,
    repeat: parseNum(legacy ? data.cycles ?? 0 : data.repeat ?? 0, "Repetições", 0, 1e7, true),
    loop_delay: parseNum(legacy ? data.cycle_delay ?? 0.5 : data.loop_delay ?? 0.5, "Pausa entre repetições", 0, 86400),
    start_delay: parseNum(data.start_delay ?? 2, "Atraso para começar", 0, 600),
    target: { mode: t.mode === "screen" ? "screen" : "chrome", site: typeof t.site === "string" ? t.site.slice(0, 300) : "" } };
}

function describeStep(s) {
  const where = () => (s.at_point ? `em ${s.x}, ${s.y}` : "onde o mouse estiver");
  const glide = () => (s.glide && s.at_point ? `  (desliza ${fmtNum(s.glide)} s)` : "");
  const btn = { left: "esquerdo", right: "direito", middle: "do meio" }[s.button];
  switch (s.type) {
    case "key":
      if (s.action === "down") return `Segurar  ${comboText(s)}`;
      if (s.action === "up") return `Soltar  ${comboText(s)}`;
      return `Apertar  ${comboText(s)}` + (s.hold >= 0.1 ? `  (segura ${fmtNum(s.hold)} s)` : "");
    case "mouse":
      return ({ click: `Clique ${btn}`, double: `Clique duplo ${btn}`, down: `Segurar botão ${btn}`, up: `Soltar botão ${btn}` })[s.action] +
        `  ${where()}${glide()}`;
    case "move": return `Mover mouse para ${s.x}, ${s.y}${glide()}`;
    case "scroll": return `Rolar para ${s.direction === "up" ? "cima" : "baixo"} ${s.amount}  ${where()}`;
    case "text": {
      const t = s.text.replace(/\r/g, "").replace(/\n/g, " ⏎ ");
      return t ? `Digitar  "${t.length > 40 ? t.slice(0, 39) + "…" : t}"` : "Digitar  (vazio)";
    }
    case "wait":
      return s.random ? `Esperar ${fmtNum(s.seconds)} a ${fmtNum(+(s.seconds + s.random).toFixed(4))} s` : `Esperar ${fmtNum(s.seconds)} s`;
  }
  return s.type;
}

function findProblems(profile, hotkeys, viewport) {
  const out = [];
  profile.steps.forEach((s, i) => {
    if (!s.enabled) return;
    for (const [name, label] of [["toggle", "Iniciar / Parar"], ["stop", "Parada de emergência"]]) {
      const hk = hotkeys[name];
      if (s.type === "key" && keyDef(s.key) === keyDef(hk.key))
        out.push([i, `O passo ${i + 1} usa ${comboText(s)}, que faz parte do atalho de ${label} (${comboText(hk)}). ` +
          "O macro iria parar sozinho. Troque o passo ou o atalho."]);
      if (s.type === "mouse" && s.button === "middle" && hk.key === "Middle Mouse")
        out.push([i, `O passo ${i + 1} usa o botão do meio, que é o atalho de ${label}.`]);
    }
    if (viewport && ["mouse", "move", "scroll"].includes(s.type) && s.at_point &&
        !(s.x >= 0 && s.y >= 0 && s.x < viewport[0] && s.y < viewport[1]))
      out.push([i, `O passo ${i + 1} aponta para ${s.x}, ${s.y}, que está fora da parte visível da página ` +
        `(${viewport[0]} × ${viewport[1]}). Escolha o ponto de novo.`]);
  });
  return out;
}

const DEFAULT_HOTKEYS = { toggle: { key: "F8", mods: [] }, stop: { key: "F10", mods: [] } };

function hostOf(url) {
  try {
    const h = new URL(url).hostname;
    return h.startsWith("www.") ? h.slice(4) : h;
  } catch { return ""; }
}

const canControl = (url) => /^(https?|file):/.test(url || "");

return { STEP_TYPES, TYPE_LABEL, MAX_STEPS, MAX_TEXT, fmtNum, parseNum, defaultStep, cleanStep, newProfile, cleanProfile, describeStep, findProblems, DEFAULT_HOTKEYS, hostOf, canControl };
});
