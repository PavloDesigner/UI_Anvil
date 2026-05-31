/* Central state store with pub/sub */

import { generate as tailwindGen      } from './generators/tailwind.js';
import { generate as apcaGen          } from './generators/apca.js';
import { generate as radixGen         } from './generators/radix.js';
import { generate as oklchGen         } from './generators/oklch.js';
import { generate as materialGen      } from './generators/material.js';
import { generate as accessibleGen    } from './generators/accessible.js';
import { generate as neutralTintedGen } from './generators/neutral-tinted.js';
import { generate as splitToneGen     } from './generators/split-tone.js';
import { generate as p3Gen            } from './generators/p3.js';
import { generate as cam16Gen         } from './generators/cam16.js';
import { generate as duotoneGen       } from './generators/duotone.js';
import { encodeState, debounce }        from './utils.js';
import { hexToRgb, rgbToHsl, hslToRgb, rgbToHex } from './color.js';

const GENERATORS = {
  tailwind:         tailwindGen,
  apca:             apcaGen,
  radix:            radixGen,
  oklch:            oklchGen,
  material:         materialGen,
  accessible:       accessibleGen,
  'neutral-tinted': neutralTintedGen,
  'split-tone':     splitToneGen,
  p3:               p3Gen,
  cam16:            cam16Gen,
  duotone:          duotoneGen,
};

/* Step labels for N-step scales */
export function getStepLabels(n) {
  const presets = {
    5:  ['100','300','500','700','900'],
    9:  ['100','200','300','400','500','600','700','800','900'],
    10: ['50','100','200','300','400','500','600','700','800','900'],
    11: ['50','100','200','300','400','500','600','700','800','900','950'],
    12: ['50','100','200','300','400','500','600','700','800','900','950','1000'],
  };
  if (presets[n]) return presets[n];
  return Array.from({ length: n }, (_, i) => String(Math.round((i / (n - 1)) * 900 + 50)));
}

const DEFAULT_STATE = {
  method: 'tailwind',
  steps: 11,
  theme: 'dark',
  format: 'hex',
  harmony: 'auto',
  precise: false,
  focusedPalette: 'brand',
  showSecondaryBrand: false,
  showTertiaryBrand: false,
  palettes: {
    brand:   { input: '#5eb1cb', locked: false, scale: { light: [], dark: [] } },
    brand2:  { input: '#a78bfa', locked: false, scale: { light: [], dark: [] } },
    brand3:  { input: '#f97316', locked: false, scale: { light: [], dark: [] } },
    neutral: { input: '#71717a', locked: false, scale: { light: [], dark: [] } },
    success: { input: '#22c55e', locked: false, scale: { light: [], dark: [] } },
    warning: { input: '#f59e0b', locked: false, scale: { light: [], dark: [] } },
    info:    { input: '#3b82f6', locked: false, scale: { light: [], dark: [] } },
    error:   { input: '#ef4444', locked: false, scale: { light: [], dark: [] } },
  },
};

let _state = deepClone(DEFAULT_STATE);
const _listeners = new Map();

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

export function getState() { return _state; }

export function subscribe(event, fn) {
  if (!_listeners.has(event)) _listeners.set(event, new Set());
  _listeners.get(event).add(fn);
  return () => _listeners.get(event).delete(fn);
}

function emit(event, data) {
  (_listeners.get(event) || new Set()).forEach(fn => fn(data));
  (_listeners.get('*') || new Set()).forEach(fn => fn({ event, data }));
}

/* Regenerate one or all palette scales */
export function regenerate(paletteName = null) {
  const gen = GENERATORS[_state.method];
  const opts = { steps: _state.steps };
  const names = paletteName ? [paletteName] : Object.keys(_state.palettes);

  for (const name of names) {
    const p = _state.palettes[name];
    if (!p) continue;
    p.scale.light = gen(p.input, { ...opts, mode: 'light' });
    p.scale.dark  = gen(p.input, { ...opts, mode: 'dark'  });
    if (_state.precise) {
      p.scale.light = _reshapeAroundInput(p.scale.light, p.input);
      p.scale.dark  = _reshapeAroundInput(p.scale.dark,  p.input);
    }
  }
}

/**
 * Rebuild an entire scale so that p.input falls exactly at the closest step.
 * Endpoints (index 0 and N-1) are kept from the algorithm's output so the
 * range stays realistic. Every step in between is re-interpolated in HSL
 * space — left segment (scale[0] → input) and right segment (input → scale[N-1]).
 */
function _reshapeAroundInput(scale, inputHex) {
  const n = scale.length;
  if (n < 2) return scale;
  const inputLower = inputHex.toLowerCase();
  if (scale.some(c => c.toLowerCase() === inputLower)) return scale; // already exact

  // Find anchor index k — step whose luminance is closest to the input
  const inputLum = _hexLum(inputHex);
  let k = 0, minDist = Infinity;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(_hexLum(scale[i]) - inputLum);
    if (d < minDist) { minDist = d; k = i; }
  }

  // HSL helpers
  function toHSL(hex) { return rgbToHsl(hexToRgb(hex)); }
  function fromHSL({ h, s, l }) {
    const rgb = hslToRgb({ h, s, l });
    return rgbToHex({ r: Math.round(rgb.r), g: Math.round(rgb.g), b: Math.round(rgb.b) });
  }
  // Short-arc hue lerp
  function lerpHue(a, b, t) {
    let d = b - a;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return (a + d * t + 360) % 360;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpHSL(a, b, t) {
    return { h: lerpHue(a.h, b.h, t), s: lerp(a.s, b.s, t), l: lerp(a.l, b.l, t) };
  }

  const result   = new Array(n);
  const hslFirst = toHSL(scale[0]);
  const hslLast  = toHSL(scale[n - 1]);
  const hslIn    = toHSL(inputHex);

  // Anchor + endpoints are fixed
  result[0]     = scale[0];
  result[k]     = inputHex;
  result[n - 1] = scale[n - 1];

  // Left segment: indices 1 … k-1
  for (let i = 1; i < k; i++) {
    result[i] = fromHSL(lerpHSL(hslFirst, hslIn, i / k));
  }

  // Right segment: indices k+1 … n-2
  for (let i = k + 1; i < n - 1; i++) {
    result[i] = fromHSL(lerpHSL(hslIn, hslLast, (i - k) / (n - 1 - k)));
  }

  return result;
}

/* Write all CSS variables to :root */
export function applyCSS() {
  const root = document.documentElement;
  const labels = getStepLabels(_state.steps);
  const theme = _state.theme;
  const isDark = theme === 'dark';

  /* Step-labeled palette vars — all palettes */
  const paletteMap = { brand:'brand', brand2:'brand2', brand3:'brand3', neutral:'neutral', success:'success', warning:'warning', info:'info', error:'error' };
  for (const [cssName, stateName] of Object.entries(paletteMap)) {
    const p = _state.palettes[stateName];
    if (!p) continue;
    const scale = p.scale[theme] || p.scale.light;
    if (!scale?.length) continue;
    scale.forEach((hex, i) => root.style.setProperty(`--color-${cssName}-${labels[i]}`, hex));
  }

  /* Semantic surface / border / text vars — index-based so any step count works */
  const ns = _state.palettes.neutral.scale[theme] || _state.palettes.neutral.scale.light;
  if (ns?.length) {
    const n = ns.length;
    const bsIdx  = Math.min(2, n - 1);
    const bdIdx  = Math.min(3, n - 1);
    const bstIdx = Math.min(4, n - 1);
    const tsIdx  = Math.max(0, Math.min(isDark ? Math.round(n * 0.75) : Math.round(n * 0.55), n - 2));
    const tmIdx  = Math.max(0, Math.min(isDark ? Math.round(n * 0.55) : Math.round(n * 0.37), n - 3));

    root.style.setProperty('--surface-page',   ns[0]);
    root.style.setProperty('--surface-card',   isDark ? ns[Math.min(1, n - 1)] : '#ffffff');
    root.style.setProperty('--surface-raised', ns[Math.min(1, n - 1)]);
    root.style.setProperty('--surface-inset',  ns[isDark ? 0 : Math.min(1, n - 1)]);
    root.style.setProperty('--border-subtle',  ns[bsIdx]);
    root.style.setProperty('--border-default', ns[bdIdx]);
    root.style.setProperty('--border-strong',  ns[bstIdx]);
    root.style.setProperty('--text-primary',   ns[n - 1]);
    root.style.setProperty('--text-secondary', ns[tsIdx]);
    root.style.setProperty('--text-muted',     ns[tmIdx]);
    root.style.setProperty('--text-inverse',   ns[isDark ? Math.min(1, n - 1) : 0]);
  }

  /* Secondary brand semantic vars — only when explicitly added */
  if (_state.showSecondaryBrand) {
    const b2s = _state.palettes.brand2.scale[theme] || _state.palettes.brand2.scale.light;
    if (b2s?.length) {
      const n = b2s.length;
      const aIdx  = Math.min(isDark ? Math.round(n * 0.72) : Math.round(n * 0.45), n - 1);
      root.style.setProperty('--secondary',        b2s[aIdx]);
      root.style.setProperty('--secondary-subtle', b2s[isDark ? Math.min(1, n - 1) : 0]);
      root.style.setProperty('--secondary-border', b2s[isDark ? Math.min(3, n - 1) : Math.min(2, n - 1)]);
      root.style.setProperty('--secondary-fg',     _hexNeedsLightText(b2s[aIdx]) ? '#ffffff' : '#111111');
    }
  } else {
    root.style.removeProperty('--secondary');
    root.style.removeProperty('--secondary-subtle');
    root.style.removeProperty('--secondary-border');
    root.style.removeProperty('--secondary-fg');
  }

  /* Tertiary brand semantic vars — only when explicitly added */
  if (_state.showTertiaryBrand) {
    const b3s = _state.palettes.brand3.scale[theme] || _state.palettes.brand3.scale.light;
    if (b3s?.length) {
      const n = b3s.length;
      const aIdx  = Math.min(isDark ? Math.round(n * 0.72) : Math.round(n * 0.45), n - 1);
      root.style.setProperty('--tertiary',        b3s[aIdx]);
      root.style.setProperty('--tertiary-subtle', b3s[isDark ? Math.min(1, n - 1) : 0]);
      root.style.setProperty('--tertiary-border', b3s[isDark ? Math.min(3, n - 1) : Math.min(2, n - 1)]);
      root.style.setProperty('--tertiary-fg',     _hexNeedsLightText(b3s[aIdx]) ? '#ffffff' : '#111111');
    }
  } else {
    root.style.removeProperty('--tertiary');
    root.style.removeProperty('--tertiary-subtle');
    root.style.removeProperty('--tertiary-border');
    root.style.removeProperty('--tertiary-fg');
  }

  /* Accent / brand semantic vars */
  const bs = _state.palettes.brand.scale[theme] || _state.palettes.brand.scale.light;
  if (bs?.length) {
    const n = bs.length;
    const aIdx  = Math.min(isDark ? Math.round(n * 0.72) : Math.round(n * 0.45), n - 1);
    const ahIdx = Math.min(isDark ? Math.round(n * 0.81) : Math.round(n * 0.54), n - 1);

    root.style.setProperty('--accent',        bs[aIdx]);
    root.style.setProperty('--accent-hover',  bs[ahIdx]);
    root.style.setProperty('--accent-subtle', bs[isDark ? Math.min(1, n - 1) : 0]);
    root.style.setProperty('--accent-border', bs[isDark ? Math.min(3, n - 1) : Math.min(2, n - 1)]);
    root.style.setProperty('--accent-fg',     _hexNeedsLightText(bs[aIdx]) ? '#ffffff' : '#111111');

    /* Marketing dark-bento backgrounds — brand palette's darkest steps */
    const bgIdx    = isDark ? 0       : n - 1;
    const raiseIdx = isDark ? 1       : n - 2;
    const hoverIdx = isDark ? 2       : n - 3;
    root.style.setProperty('--mkt-dark-bg',           bs[bgIdx]);
    root.style.setProperty('--mkt-dark-bg-raise',     bs[raiseIdx]);
    root.style.setProperty('--mkt-dark-bg-hover',     bs[hoverIdx]);
    root.style.setProperty('--mkt-dark-border',       bs[raiseIdx]);
    root.style.setProperty('--mkt-dark-border-raise', bs[hoverIdx]);
    root.style.setProperty('--mkt-dark-divider',      bs[raiseIdx]);
  }

  /* Marketing dark-bento text — lightest neutral steps for legibility on dark surfaces */
  if (ns?.length) {
    const n = ns.length;
    root.style.setProperty('--mkt-dark-text',     ns[isDark ? n - 1 : 0]);
    root.style.setProperty('--mkt-dark-text-sec', ns[isDark ? Math.max(n - 3, 0) : Math.min(2, n - 1)]);
    root.style.setProperty('--mkt-dark-muted',    ns[isDark ? Math.max(n - 6, 0) : Math.min(4, n - 1)]);
  }

  /* Status semantic vars + fg */
  for (const name of ['success', 'warning', 'info', 'error']) {
    const sc = _state.palettes[name].scale[theme] || _state.palettes[name].scale.light;
    if (!sc?.length) continue;
    const n = sc.length;
    const surfIdx = isDark ? Math.min(1, n - 1) : 0;
    const bordIdx = isDark ? Math.min(Math.round(n * 0.3), n - 1) : Math.min(2, n - 1);
    const textIdx = isDark ? n - 1 : Math.min(Math.round(n * 0.8), n - 1);
    const iconIdx = isDark ? Math.max(n - 2, 0) : Math.min(Math.round(n * 0.6), n - 1);
    const midIdx  = Math.min(Math.round(n * 0.45), n - 1);

    root.style.setProperty(`--${name}-surface`, sc[surfIdx]);
    root.style.setProperty(`--${name}-border`,  sc[bordIdx]);
    root.style.setProperty(`--${name}-text`,    sc[textIdx]);
    root.style.setProperty(`--${name}-icon`,    sc[iconIdx]);
    root.style.setProperty(`--${name}-fg`,      _hexNeedsLightText(sc[midIdx]) ? '#ffffff' : '#111111');
  }
}

function _hexLum(hex) {
  const h = hex.replace('#', '').padEnd(6, '0');
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lin = c => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function _hexNeedsLightText(hex) { return _hexLum(hex) < 0.35; }

/* Batch DOM writes via rAF */
let _rafPending = false;
export function scheduleApply() {
  if (_rafPending) return;
  _rafPending = true;
  requestAnimationFrame(() => {
    _rafPending = false;
    applyCSS();
    emit('palette-change', _state);
  });
}

/* URL hash serialization — debounced */
const _saveHash = debounce(() => {
  history.replaceState(null, '', '#' + encodeState(_state));
}, 400);

/* State mutations */
export function setMethod(method) {
  _state.method = method;
  regenerate();
  scheduleApply();
  _saveHash();
}

export function setSteps(steps) {
  _state.steps = steps;
  regenerate();
  scheduleApply();
  _saveHash();
}

export function setTheme(theme) {
  _state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  applyCSS();
  emit('theme-change', theme);
  _saveHash();
}

export function setFormat(format) {
  /* oklch format removed — fall back to hex */
  _state.format = format === 'oklch' ? 'hex' : format;
  emit('format-change', _state.format);
  _saveHash();
}

export function setHarmony(harmony) {
  _state.harmony = harmony;
  _saveHash();
}

export function setFocusedPalette(name) {
  _state.focusedPalette = name;
  emit('focus-change', name);
}

export function setPaletteInput(name, hex) {
  if (!_state.palettes[name]) return;
  _state.palettes[name].input = hex;
  regenerate(name);
  scheduleApply();
  _saveHash();
}

/* Rotate all (unlocked) palette hues by deltaDeg — preserves harmony */
export function rotatePaletteHues(deltaDeg) {
  for (const p of Object.values(_state.palettes)) {
    if (!p || p.locked) continue;
    p.input = _rotateHex(p.input, deltaDeg);
  }
  regenerate();
  scheduleApply();
  _saveHash();
}

/* Apply totalDeg rotation from a snapshot — no compounding rounding errors.
   Use this during drag: call with (snapshot, cumulativeTotal) each frame. */
export function rotatePaletteHuesFromSnapshot(snapshot, totalDeg) {
  for (const [name, p] of Object.entries(_state.palettes)) {
    if (!p || p.locked) continue;
    const base = snapshot[name];
    if (!base) continue;
    p.input = _rotateHex(base, totalDeg);
  }
  regenerate();
  scheduleApply();
  _saveHash();
}

function _rotateHex(hex, deltaDeg) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const { h, s, l } = rgbToHsl(rgb);
  const newH = ((h + deltaDeg) % 360 + 360) % 360;
  const { r, g, b } = hslToRgb({ h: newH, s, l });
  return rgbToHex({
    r: Math.round(Math.max(0, Math.min(255, r))),
    g: Math.round(Math.max(0, Math.min(255, g))),
    b: Math.round(Math.max(0, Math.min(255, b))),
  });
}

export function toggleLock(name) {
  if (!_state.palettes[name]) return;
  _state.palettes[name].locked = !_state.palettes[name].locked;
  emit('lock-change', { name, locked: _state.palettes[name].locked });
}

export function setPrecise(val) {
  _state.precise = !!val;
  regenerate();
  scheduleApply();
  emit('precise-change', _state.precise);
}

export function setShowSecondaryBrand(show) {
  _state.showSecondaryBrand = show;
  scheduleApply();
  _saveHash();
  emit('secondary-brand-change', show);
}

export function setShowTertiaryBrand(show) {
  _state.showTertiaryBrand = show;
  scheduleApply();
  _saveHash();
  emit('tertiary-brand-change', show);
}

/* Initialize from URL hash or defaults */
export function initState(hashOverride = null) {
  const hash = hashOverride || location.hash;
  if (hash && hash.length > 1) {
    const { decodeState } = await_import_hack();
    const decoded = decodeState(hash.slice(1));
    if (decoded) {
      _state.method              = decoded.method              || _state.method;
      _state.steps               = decoded.steps               || _state.steps;
      _state.theme               = decoded.theme               || _state.theme;
      _state.format              = decoded.format              || _state.format;
      _state.harmony             = decoded.harmony             || _state.harmony;
      _state.showSecondaryBrand  = decoded.showSecondaryBrand  ?? false;
      _state.showTertiaryBrand   = decoded.showTertiaryBrand   ?? false;
      _state.precise             = decoded.precise             ?? false;
      for (const [k, v] of Object.entries(decoded.palettes || {})) {
        if (_state.palettes[k]) {
          _state.palettes[k].input  = v.input  || _state.palettes[k].input;
          _state.palettes[k].locked = v.locked || false;
        }
      }
    }
  }
  regenerate();
  document.documentElement.setAttribute('data-theme', _state.theme);
  applyCSS();
  emit('init', _state);
}

/* workaround: inline hash decode to avoid circular import */
function await_import_hack() {
  return {
    decodeState(raw) {
      try {
        const payload = JSON.parse(atob(raw.padEnd(Math.ceil(raw.length / 4) * 4, '=')));
        return {
          method:             payload.m,
          steps:              payload.s,
          theme:              payload.t,
          format:             payload.f,
          harmony:            payload.h,
          showSecondaryBrand: !!payload.sb,
          showTertiaryBrand:  !!payload.tb,
          precise:            !!payload.pr,
          palettes: Object.fromEntries(
            Object.entries(payload.p || {}).map(([k, v]) => [k, { input: v.i, locked: !!v.l }])
          ),
        };
      } catch { return null; }
    }
  };
}
