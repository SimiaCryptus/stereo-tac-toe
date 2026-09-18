// Bootstrap: wire modules together and own the render loop.

import { CONFIG } from './config.js';
import { Input } from './input.js';
import { createDepthMap } from './depthMap.js';
import { Stereogram } from './stereogram.js';
import { Diagnostics } from './diagnostics.js';
import { Controls } from './controls.js';
import { MODES, createMode } from './modes/index.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const statusEl = document.getElementById('status');
const diagnosticsToggle = document.getElementById('diagnostics');
const resetBtn = document.getElementById('reset');
const modeSelect = document.getElementById('mode');
const blurbEl = document.getElementById('blurb');
const appearanceEl = document.getElementById('appearance-panel');
const gameSettingsEl = document.getElementById('game-settings');

// --- Auto resolution: 90% of the viewport unless the user overrides it ---

function viewportSize() {
  return {
    w: Math.max(160, Math.round(window.innerWidth * 0.9)),
    h: Math.max(120, Math.round(window.innerHeight * 0.9)),
  };
}

let autoResolution = true;

{
  const { w, h } = viewportSize();
  CONFIG.WIDTH = w;
  CONFIG.HEIGHT = h;
  canvas.width = w;
  canvas.height = h;
}

let depthBuffer = createDepthMap(CONFIG.WIDTH, CONFIG.HEIGHT);
const stereogram = new Stereogram(CONFIG.WIDTH, CONFIG.HEIGHT);
const diagnostics = new Diagnostics(CONFIG.WIDTH, CONFIG.HEIGHT);

let dirty = true;

function markDirty() {
  dirty = true;
}

// Reallocate everything that depends on canvas resolution.
function applyResolution(w, h) {
  w = Math.max(160, Math.round(w));
  h = Math.max(120, Math.round(h));
  if (w === CONFIG.WIDTH && h === CONFIG.HEIGHT) return;
  CONFIG.WIDTH = w;
  CONFIG.HEIGHT = h;
  canvas.width = w;
  canvas.height = h;
  depthBuffer = createDepthMap(w, h);
  stereogram.resize(w, h);
  diagnostics.resize(w, h);
  markDirty();
}

window.addEventListener('resize', () => {
  if (!autoResolution) return;
  const { w, h } = viewportSize();
  applyResolution(w, h);
});

// --- Mode list ---

let mode = null;

for (const M of MODES) {
  const opt = document.createElement('option');
  opt.value = M.id;
  opt.textContent = M.label;
  modeSelect.appendChild(opt);
}

// Pointer + keyboard routing to whichever mode is active.
const input = new Input(canvas, () => mode, markDirty);

// Appearance menu: stereogram / noise / depth / drawing / animation knobs.
// Game menu: mode picker plus only the active mode's settings.
const controls = new Controls({
  appearanceEl,
  gameEl: gameSettingsEl,
  onRedraw: markDirty,
  onPatternChange: () => {
    stereogram.rebuildPattern();
    markDirty();
  },
  onResize: (w, h) => {
    // Any explicit resize takes the canvas off auto-sizing.
    autoResolution = false;
    applyResolution(w, h);
  },
  getSize: () => ({ w: CONFIG.WIDTH, h: CONFIG.HEIGHT }),
  canvas,
});

function setMode(id) {
  const M = MODES.find((m) => m.id === id) || MODES[0];
  mode = createMode(M.id);
  modeSelect.value = M.id;
  if (blurbEl) blurbEl.textContent = M.help;
  controls.setMode(M.id);
  if (location.hash.slice(1) !== M.id) {
    history.replaceState(null, '', `#${M.id}`);
  }
  markDirty();
}

modeSelect.addEventListener('change', () => {
  setMode(modeSelect.value);
  // Drop focus so arrow keys drive the game, not the select.
  modeSelect.blur();
});

window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (id && id !== mode.constructor.id) setMode(id);
});

setMode(location.hash.slice(1) || MODES[0].id);

// --- Dropdown menus ---

const menus = [
  {
    btn: document.getElementById('appearance-btn'),
    panel: document.getElementById('appearance-panel'),
  },
  { btn: document.getElementById('game-btn'), panel: document.getElementById('game-panel') },
];

function closeMenus(except) {
  for (const m of menus) {
    if (m === except) continue;
    m.panel.hidden = true;
    m.btn.setAttribute('aria-expanded', 'false');
  }
}

for (const m of menus) {
  m.btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = m.panel.hidden;
    closeMenus(m);
    m.panel.hidden = !willOpen;
    m.btn.setAttribute('aria-expanded', String(willOpen));
    if (!willOpen) m.btn.blur();
  });
  m.panel.addEventListener('click', (e) => e.stopPropagation());
}

document.addEventListener('click', () => closeMenus(null));

// Render loop. Modes and the ribbon animator report whether anything
// changed; we only redraw when needed so a fused image stays steady.
let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (mode.update(dt, now / 1000)) dirty = true;
  if (!diagnosticsToggle.checked && stereogram.update(now)) dirty = true;

  if (dirty) {
    mode.render(depthBuffer, CONFIG.WIDTH, CONFIG.HEIGHT);

    if (diagnosticsToggle.checked) {
      diagnostics.drawDepth(ctx, depthBuffer);
    } else {
      stereogram.renderStereogram(ctx, depthBuffer);
    }

    statusEl.textContent = mode.statusText();
    dirty = false;
  }
  requestAnimationFrame(frame);
}

// --- Global controls ---

resetBtn.addEventListener('click', () => {
  mode.reset();
  resetBtn.blur();
  markDirty();
});

diagnosticsToggle.addEventListener('change', markDirty);

function inFormField(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMenus(null);
  if (inFormField(e)) return;
  if (e.key === 'd' || e.key === 'D') {
    diagnosticsToggle.checked = !diagnosticsToggle.checked;
    markDirty();
  } else if (e.key === 'r' || e.key === 'R') {
    mode.reset();
    markDirty();
  }
});

requestAnimationFrame(frame);
