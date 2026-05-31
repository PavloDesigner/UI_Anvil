/* Sidebar controls */

import {
  getState, subscribe,
  setPaletteInput, toggleLock, setMethod, setSteps,
  setFormat, setHarmony, setPrecise, setShowSecondaryBrand, setShowTertiaryBrand,
} from '../state.js';
import { parseColorInput, rgbToHsl, hexToRgb, hslToRgb, rgbToHex } from '../color.js';
import { debounce } from '../utils.js';
import { showToast } from './toast.js';
import { showTooltip, hideTooltip } from './tooltip.js';

export function initSidebar() {
  initTabs();
  initPaletteInputs();
  initBottomControls();
  initSecondaryBrand();
  initTertiaryBrand();
  initAutoSuggest();
  initHarmonyPicker();
  syncFromState();
  subscribe('init', syncFromState);
  subscribe('lock-change', syncLockUI);
  subscribe('secondary-brand-change', show => {
    const btn = document.getElementById('strip-btn-brand2');
    if (btn) btn.style.display = show ? '' : 'none';
    const addTert = document.getElementById('add-tertiary-btn');
    if (addTert) addTert.style.display = show ? '' : 'none';
  });
  subscribe('tertiary-brand-change', show => {
    const btn = document.getElementById('strip-btn-brand3');
    if (btn) btn.style.display = show ? '' : 'none';
  });
}

/* Tab switching */
function initTabs() {
  document.querySelectorAll('.tab:not(.tab--stub)').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => { t.classList.remove('tab--active'); t.setAttribute('aria-selected','false'); });
      tab.classList.add('tab--active');
      tab.setAttribute('aria-selected','true');
      const id = tab.dataset.tab;
      document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
      const panel = document.getElementById(`tab-${id}`);
      if (panel) panel.style.display = 'block';
    });
  });
}

/* Wire all palette input rows */
function initPaletteInputs() {
  const PALETTES = ['brand','brand2','brand3','neutral','success','warning','info','error'];

  PALETTES.forEach(name => {
    const hexIn  = document.getElementById(`hex-${name}`);
    const picker = document.getElementById(`picker-${name}`);
    const swatch = document.querySelector(`#swatch-preview-${name}`)?.parentElement;
    const lockBtn= document.getElementById(`lock-${name}`);
    const eyeBtn = document.querySelector(`[data-palette="${name}"].eyedropper-btn`);

    if (!hexIn) return;

    // Sync picker to hex input
    if (picker) {
      picker.addEventListener('input', debounce(e => {
        const hex = e.target.value;
        hexIn.value = hex;
        hexIn.classList.remove('hex-input--error');
        setPaletteInput(name, hex);
        updateSwatchPreview(name, hex);
      }, 16));
    }

    // Click swatch → open native color picker
    if (swatch) {
      swatch.addEventListener('click', () => picker?.click());
      // Hex tooltip — read live value so it stays accurate after edits
      swatch.addEventListener('mouseenter', () => {
        const hex = hexIn?.value?.trim();
        if (hex) showTooltip(swatch, hex, hex);
      });
      swatch.addEventListener('mouseleave', hideTooltip);
    }

    // Hex input: validate on blur, live on input
    hexIn.addEventListener('input', debounce(e => {
      const parsed = parseColorInput(e.target.value);
      if (parsed) {
        hexIn.classList.remove('hex-input--error');
        if (picker) picker.value = parsed;
        setPaletteInput(name, parsed);
        updateSwatchPreview(name, parsed);
      }
    }, 120));

    hexIn.addEventListener('blur', e => {
      const parsed = parseColorInput(e.target.value);
      if (!parsed) {
        hexIn.classList.add('hex-input--error');
      } else {
        hexIn.value = parsed;
        hexIn.classList.remove('hex-input--error');
      }
    });

    // Paste: parse any format
    hexIn.addEventListener('paste', e => {
      setTimeout(() => {
        const parsed = parseColorInput(hexIn.value);
        if (parsed) {
          hexIn.value = parsed;
          hexIn.classList.remove('hex-input--error');
          if (picker) picker.value = parsed;
          setPaletteInput(name, parsed);
          updateSwatchPreview(name, parsed);
        }
      }, 0);
    });

    // Lock
    if (lockBtn) {
      lockBtn.addEventListener('click', () => {
        toggleLock(name);
      });
    }

    // Eyedropper
    if (eyeBtn) {
      if ('EyeDropper' in window) {
        eyeBtn.addEventListener('click', async () => {
          try {
            const dropper = new EyeDropper();
            const { sRGBHex } = await dropper.open();
            hexIn.value = sRGBHex;
            hexIn.classList.remove('hex-input--error');
            if (picker) picker.value = sRGBHex;
            setPaletteInput(name, sRGBHex);
            updateSwatchPreview(name, sRGBHex);
          } catch { /* cancelled */ }
        });
      } else {
        eyeBtn.style.opacity = '0.3';
        eyeBtn.style.cursor = 'not-allowed';
        eyeBtn.title = 'EyeDropper not supported in this browser';
      }
    }
  });
}

function updateSwatchPreview(name, hex) {
  const el = document.getElementById(`swatch-preview-${name}`);
  if (el) el.style.background = hex;
}

/* ─── Generator picker metadata ─── */
const GENERATORS_META = [
  { value: 'tailwind',        name: 'Tailwind',        desc: 'HSL lightness curve · Tailwind-compatible stops'                  },
  { value: 'apca',            name: 'APCA',            desc: 'Equal perceptual contrast steps via APCA'                         },
  { value: 'radix',           name: 'Radix',           desc: 'Semantic 12-step scale · Radix UI compatible'                     },
  { value: 'oklch',           name: 'OKLCH',           desc: 'Uniform lightness ramp in OKLCH color space'                      },
  { value: 'material',        name: 'Material 3',      desc: 'HCT tonal palette · Material Design 3'                            },
  { value: 'accessible',      name: 'Accessible',      desc: 'WCAG contrast-locked steps · AA at 600, AAA at 700',  badge: 'New' },
  { value: 'neutral-tinted',  name: 'Neutral Tinted',  desc: 'Near-neutral with brand hue tint · surface tokens',   badge: 'New' },
  { value: 'split-tone',      name: 'Split-Tone',      desc: 'Warm lights + cool darks · photography-inspired depth', badge: 'New' },
  { value: 'p3',              name: 'P3 Wide Gamut',   desc: 'Display P3 chroma ceiling · vivid on wide-gamut screens', badge: 'New' },
  { value: 'cam16',           name: 'CAM16',           desc: 'Hue-corrected OKLCH · perceptually equal saturation',  badge: 'New' },
  { value: 'duotone',         name: 'Duotone',         desc: 'Two-hue interpolation · warm highlights, cool shadows', badge: 'New' },
];

function initGenPicker() {
  const picker   = document.getElementById('gen-picker');      // fp-picker wrapper
  const trigger  = document.getElementById('gen-trigger');
  const menu     = document.getElementById('gen-menu');        // fp-dropdown panel
  const trigName = document.getElementById('gen-trigger-name');
  if (!picker || !trigger || !menu) return;

  // Build scale-option items
  GENERATORS_META.forEach(g => {
    const opt = document.createElement('button');
    opt.className = 'scale-option';
    opt.dataset.value = g.value;
    opt.setAttribute('role', 'option');
    opt.setAttribute('aria-selected', 'false');
    opt.innerHTML = `<span class="scale-option-name">${g.name}${g.badge ? ` <span class="gen-option-badge">${g.badge}</span>` : ''}</span><span class="scale-option-desc">${g.desc}</span>`;
    opt.addEventListener('click', () => {
      setMethod(g.value);
      _selectGenOption(g.value);
      _closeGenPicker();
    });
    menu.appendChild(opt);
  });

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    if (!picker.classList.contains('fp-picker--open')) _positionGenDropdown();
    const open = picker.classList.toggle('fp-picker--open');
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  document.addEventListener('click', e => {
    if (!picker.contains(e.target)) _closeGenPicker();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') _closeGenPicker();
  });

  _selectGenOption(getState().method);

  function _positionGenDropdown() {
    const r = trigger.getBoundingClientRect();
    menu.style.top    = 'auto';
    menu.style.bottom = (window.innerHeight - r.top + 4) + 'px';
    menu.style.left   = r.left + 'px';
    menu.style.width  = r.width + 'px';
  }
  function _closeGenPicker() {
    picker.classList.remove('fp-picker--open');
    trigger.setAttribute('aria-expanded', 'false');
  }
  function _selectGenOption(value) {
    const meta = GENERATORS_META.find(g => g.value === value) || GENERATORS_META[0];
    if (trigName) trigName.textContent = meta.name;
    menu.querySelectorAll('.scale-option').forEach(o => {
      const active = o.dataset.value === value;
      o.classList.toggle('scale-option--active', active);
      o.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  // Expose for syncFromState
  initGenPicker._selectGenOption = _selectGenOption;
}

/* Bottom controls */
function initBottomControls() {
  initGenPicker();

  // Steps
  document.querySelectorAll('.step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.step-btn').forEach(b => b.classList.remove('step-btn--active'));
      btn.classList.add('step-btn--active');
      setSteps(Number(btn.dataset.steps));
    });
  });

  // Format
  document.querySelectorAll('.format-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('format-btn--active'));
      btn.classList.add('format-btn--active');
      setFormat(btn.dataset.format);
    });
  });

  // Precise mode toggle
  const preciseToggle = document.getElementById('precise-toggle');
  if (preciseToggle) {
    preciseToggle.addEventListener('change', () => setPrecise(preciseToggle.checked));
  }

  // Random
  const randomBtn = document.getElementById('random-btn');
  if (randomBtn) {
    randomBtn.addEventListener('click', doRandom);
  }

  // Spacebar
  document.addEventListener('keydown', e => {
    if (e.key === ' ' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      doRandom();
    }
  });
}

/* Canonical hues for status palettes — vary sat/lightness only */
const CANONICAL_HUES = { success: 140, warning: 38, info: 215, error: 8 };

/* ─── Undo stack (up to 20 snapshots of palette inputs) ─── */
const _undoStack = [];
const UNDO_LIMIT = 20;

function _pushUndo() {
  const snap = {};
  const { palettes } = getState();
  for (const [name, p] of Object.entries(palettes)) snap[name] = p.input;
  _undoStack.push(snap);
  if (_undoStack.length > UNDO_LIMIT) _undoStack.shift();
}

export function undoRandom() {
  if (!_undoStack.length) return false;
  const snap = _undoStack.pop();
  for (const [name, hex] of Object.entries(snap)) {
    setPaletteInput(name, hex);
    const hexIn  = document.getElementById(`hex-${name}`);
    const picker = document.getElementById(`picker-${name}`);
    if (hexIn)  hexIn.value  = hex;
    if (picker) picker.value = hex;
    updateSwatchPreview(name, hex);
  }
  return true;
}

/* Harmony-to-hue-offset table (brand=0, brand2=1, brand3=2, neutral=3) */
const HARMONY_NAMES   = ['brand', 'brand2', 'brand3', 'neutral'];
function harmonyOffsets(h) {
  switch (h) {
    case 'mono':                return [0,   0,   0,   0];
    case 'analogous':           return [0,  30, -30,  15];
    case 'complementary':       return [0, 180, 200, -20];
    case 'split-complementary': return [0, 150, 210,   0];
    case 'triadic':             return [0, 120, 240,  60];
    case 'tetradic':            return [0,  60, 180, 240];
    case 'square':              return [0,  90, 180, 270];
    default:                    return null; // auto — no fixed relationship
  }
}

/**
 * When the user picks a new harmony, rotate all unlocked non-status palette
 * hues to satisfy the harmonic relationship.
 * Anchor = first locked palette (or brand if nothing is locked).
 * Saturation + lightness of each palette are preserved — only hue rotates.
 */
function _applyHarmony(harmonyValue) {
  const offs = harmonyOffsets(harmonyValue);
  if (!offs) return; // 'auto' → nothing to enforce

  const { palettes } = getState();

  // Determine anchor: first locked palette in the harmony group, else brand
  let anchorHue = null, anchorOffset = 0;
  for (let i = 0; i < HARMONY_NAMES.length; i++) {
    const p = palettes[HARMONY_NAMES[i]];
    if (p?.locked) {
      const rgb = hexToRgb(p.input);
      if (rgb) { anchorHue = rgbToHsl(rgb).h; anchorOffset = offs[i] ?? 0; break; }
    }
  }
  if (anchorHue === null) {
    // No locks → anchor to brand's current hue
    const rgb = hexToRgb(palettes.brand?.input || '#5eb1cb');
    anchorHue = rgb ? rgbToHsl(rgb).h : 0;
    anchorOffset = offs[0];
  }

  const baseH = ((anchorHue - anchorOffset) + 720) % 360;

  HARMONY_NAMES.forEach((name, i) => {
    const p = palettes[name];
    if (!p || p.locked) return;

    const rgb = hexToRgb(p.input);
    if (!rgb) return;
    const { s, l } = rgbToHsl(rgb); // keep saturation + lightness
    const newH     = (baseH + offs[i] + 360) % 360;
    const newRgb   = hslToRgb({ h: newH, s, l });
    const hex      = rgbToHex({ r: Math.round(newRgb.r), g: Math.round(newRgb.g), b: Math.round(newRgb.b) });

    setPaletteInput(name, hex);
    const hexIn  = document.getElementById(`hex-${name}`);
    const picker = document.getElementById(`picker-${name}`);
    if (hexIn)  hexIn.value  = hex;
    if (picker) picker.value = hex;
    updateSwatchPreview(name, hex);
  });
}

function doRandom() {
  _pushUndo();
  const state = getState();
  const { harmony } = state;
  const palettes = state.palettes;

  // Determine baseH anchored to any locked palette (or random if none locked)
  let baseH;
  if (offs) {
    let anchorHue = null, anchorOffset = 0;
    for (let i = 0; i < HARMONY_NAMES.length; i++) {
      const p = palettes[HARMONY_NAMES[i]];
      if (p?.locked) {
        const rgb = hexToRgb(p.input);
        if (rgb) { anchorHue = rgbToHsl(rgb).h; anchorOffset = offs[i] ?? 0; break; }
      }
    }
    baseH = anchorHue !== null
      ? ((anchorHue - anchorOffset) + 720) % 360
      : Math.random() * 360;
  } else {
    baseH = Math.random() * 360; // auto mode: each palette picks its own random hue
  }

  // brand=0, brand2=1, brand3=2, neutral=3, then status palettes
  const names = ['brand','brand2','brand3','neutral','success','warning','info','error'];
  names.forEach((name, i) => {
    const p = palettes[name];
    if (!p || p.locked) return;

    let h;
    if (CANONICAL_HUES[name] !== undefined) {
      h = (CANONICAL_HUES[name] + (Math.random() * 30 - 15) + 360) % 360;
    } else if (!offs) {
      h = Math.random() * 360; // auto
    } else {
      h = (baseH + (offs[Math.min(i, offs.length - 1)] || 0) + 360) % 360;
    }

    const s = name === 'neutral' ? 4 + Math.random() * 8 : 58 + Math.random() * 30;
    const l = 40 + Math.random() * 20;
    const rgb = hslToRgb({ h, s, l });
    const hex = rgbToHex({ r: Math.round(rgb.r), g: Math.round(rgb.g), b: Math.round(rgb.b) });

    setPaletteInput(name, hex);

    const hexIn  = document.getElementById(`hex-${name}`);
    const picker = document.getElementById(`picker-${name}`);
    if (hexIn) hexIn.value = hex;
    if (picker) picker.value = hex;
    updateSwatchPreview(name, hex);
  });
}

/* Secondary brand */
function initSecondaryBrand() {
  const addBtn     = document.getElementById('add-secondary-btn');
  const removeBtn  = document.getElementById('remove-brand2');
  const secondaryRow = document.getElementById('brand-secondary-row');

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (secondaryRow) secondaryRow.style.display = '';
      addBtn.style.display = 'none';
      const addTert = document.getElementById('add-tertiary-btn');
      if (addTert) addTert.style.display = '';
      setShowSecondaryBrand(true);
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      if (secondaryRow) secondaryRow.style.display = 'none';
      if (addBtn) addBtn.style.display = '';
      // also hide tertiary if it was open
      const tertiaryRow = document.getElementById('brand-tertiary-row');
      if (tertiaryRow) tertiaryRow.style.display = 'none';
      const addTert = document.getElementById('add-tertiary-btn');
      if (addTert) addTert.style.display = 'none';
      setShowSecondaryBrand(false);
      setShowTertiaryBrand(false);
    });
  }
}

/* Tertiary brand */
function initTertiaryBrand() {
  const addBtn     = document.getElementById('add-tertiary-btn');
  const removeBtn  = document.getElementById('remove-brand3');
  const tertiaryRow = document.getElementById('brand-tertiary-row');

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (tertiaryRow) tertiaryRow.style.display = '';
      addBtn.style.display = 'none';
      setShowTertiaryBrand(true);
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      if (tertiaryRow) tertiaryRow.style.display = 'none';
      if (addBtn) addBtn.style.display = '';
      setShowTertiaryBrand(false);
    });
  }
}

/* Harmony picker — visual card-based selector */
const HARMONIES = [
  {
    value: 'auto',
    label: 'Auto',
    desc: 'Each palette gets an independent random hue for maximum variety.',
    svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="11" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
      <circle cx="16" cy="5" r="2.5" fill="var(--accent,#5eb1cb)"/>
      <circle cx="25.5" cy="21" r="2.5" fill="var(--secondary,#a78bfa)"/>
      <circle cx="6.5" cy="21" r="2.5" fill="var(--tertiary,#f97316)"/>
    </svg>`,
  },
  {
    value: 'analogous',
    label: 'Analogous',
    desc: 'Uses colors that sit next to each other on the color wheel, creating a harmonious and natural look.',
    svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="11" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
      <path d="M10.6 7.5 A11 11 0 0 1 21.4 7.5" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" fill="none"/>
      <circle cx="16" cy="5" r="2.5" fill="var(--accent,#5eb1cb)"/>
      <circle cx="21.4" cy="7.5" r="2.2" fill="var(--secondary,#a78bfa)" opacity="0.9"/>
      <circle cx="10.6" cy="7.5" r="2.2" fill="var(--tertiary,#f97316)" opacity="0.9"/>
    </svg>`,
  },
  {
    value: 'complementary',
    label: 'Complementary',
    desc: 'Uses colors opposite each other on the color wheel to create bold contrast and energy.',
    svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="11" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
      <line x1="16" y1="5" x2="16" y2="27" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
      <circle cx="16" cy="5" r="2.5" fill="var(--accent,#5eb1cb)"/>
      <circle cx="16" cy="27" r="2.5" fill="var(--secondary,#a78bfa)"/>
      <circle cx="19" cy="27" r="1.8" fill="var(--tertiary,#f97316)" opacity="0.8"/>
    </svg>`,
  },
  {
    value: 'split-complementary',
    label: 'Split-complementary',
    desc: 'Uses a base color and two neighbors of its opposite for contrast with less tension.',
    svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="11" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
      <line x1="16" y1="5" x2="21.4" y2="24.5" stroke="currentColor" stroke-width="1" stroke-opacity="0.25"/>
      <line x1="16" y1="5" x2="10.6" y2="24.5" stroke="currentColor" stroke-width="1" stroke-opacity="0.25"/>
      <circle cx="16" cy="5" r="2.5" fill="var(--accent,#5eb1cb)"/>
      <circle cx="21.4" cy="24.5" r="2.2" fill="var(--secondary,#a78bfa)"/>
      <circle cx="10.6" cy="24.5" r="2.2" fill="var(--tertiary,#f97316)"/>
    </svg>`,
  },
  {
    value: 'triadic',
    label: 'Triadic',
    desc: 'Uses three evenly spaced colors on the color wheel for a vibrant and balanced mix.',
    svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="11" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
      <polygon points="16,5 25.5,21 6.5,21" stroke="currentColor" stroke-width="1" stroke-opacity="0.3" fill="none"/>
      <circle cx="16" cy="5" r="2.5" fill="var(--accent,#5eb1cb)"/>
      <circle cx="25.5" cy="21" r="2.2" fill="var(--secondary,#a78bfa)"/>
      <circle cx="6.5" cy="21" r="2.2" fill="var(--tertiary,#f97316)"/>
    </svg>`,
  },
  {
    value: 'tetradic',
    label: 'Tetradic',
    desc: 'Uses two pairs of opposite colors for rich contrast and color variety in designs.',
    svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="11" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
      <polygon points="16,5 24.5,20.5 16,27 7.5,20.5" stroke="currentColor" stroke-width="1" stroke-opacity="0.3" fill="none"/>
      <circle cx="16" cy="5" r="2.5" fill="var(--accent,#5eb1cb)"/>
      <circle cx="24.5" cy="20.5" r="2.2" fill="var(--secondary,#a78bfa)"/>
      <circle cx="16" cy="27" r="2.2" fill="var(--tertiary,#f97316)"/>
      <circle cx="7.5" cy="20.5" r="1.8" fill="currentColor" opacity="0.4"/>
    </svg>`,
  },
  {
    value: 'square',
    label: 'Square',
    desc: 'Uses four evenly spaced colors on the wheel for a bold and dynamic palette.',
    svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="11" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
      <polygon points="16,5 27,16 16,27 5,16" stroke="currentColor" stroke-width="1" stroke-opacity="0.3" fill="none"/>
      <circle cx="16" cy="5" r="2.5" fill="var(--accent,#5eb1cb)"/>
      <circle cx="27" cy="16" r="2.2" fill="var(--secondary,#a78bfa)"/>
      <circle cx="16" cy="27" r="2.2" fill="var(--tertiary,#f97316)"/>
      <circle cx="5" cy="16" r="1.8" fill="currentColor" opacity="0.4"/>
    </svg>`,
  },
  {
    value: 'mono',
    label: 'Monochrome',
    desc: 'All scales share the same hue — only saturation and lightness vary.',
    svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="11" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
      <circle cx="16" cy="5" r="2.5" fill="var(--accent,#5eb1cb)"/>
      <circle cx="16" cy="5" r="2.5" fill="var(--accent,#5eb1cb)" opacity="0.6" transform="translate(0,5)"/>
      <circle cx="16" cy="5" r="2.5" fill="var(--accent,#5eb1cb)" opacity="0.35" transform="translate(0,10)"/>
    </svg>`,
  },
];

const HARMONY_LABELS = Object.fromEntries(HARMONIES.map(h => [h.value, h.label]));

function initHarmonyPicker() {
  const wrap     = document.getElementById('harmony-picker-wrap'); // fp-picker wrapper
  const trigger  = document.getElementById('harmony-trigger');
  const dropdown = document.getElementById('harmony-picker');      // fp-dropdown panel
  const labelEl  = document.getElementById('harmony-current-label');
  if (!wrap || !trigger || !dropdown) return;

  // Build scale-option items (no SVG cards)
  HARMONIES.forEach(h => {
    const opt = document.createElement('button');
    opt.className = 'scale-option';
    opt.dataset.value = h.value;
    opt.setAttribute('role', 'option');
    opt.setAttribute('aria-selected', 'false');
    opt.innerHTML = `<span class="scale-option-name">${h.label}</span><span class="scale-option-desc">${h.desc}</span>`;
    opt.addEventListener('click', () => {
      setHarmony(h.value);
      if (labelEl) labelEl.textContent = h.label;
      dropdown.querySelectorAll('.scale-option').forEach(o =>
        o.classList.toggle('scale-option--active', o.dataset.value === h.value));
      closePicker();
      _applyHarmony(h.value);   // rotate all unlocked palettes to the new harmony
    });
    dropdown.appendChild(opt);
  });

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    if (!wrap.classList.contains('fp-picker--open')) _positionHarmonyDropdown();
    const open = wrap.classList.toggle('fp-picker--open');
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  document.addEventListener('click', e => {
    if (!wrap.contains(e.target)) closePicker();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePicker();
  });

  function _positionHarmonyDropdown() {
    const r = trigger.getBoundingClientRect();
    dropdown.style.top    = 'auto';
    dropdown.style.bottom = (window.innerHeight - r.top + 4) + 'px';
    dropdown.style.left   = r.left + 'px';
    dropdown.style.width  = r.width + 'px';
  }
  function closePicker() {
    wrap.classList.remove('fp-picker--open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  function syncHarmony() {
    const { harmony } = getState();
    dropdown.querySelectorAll('.scale-option').forEach(o =>
      o.classList.toggle('scale-option--active', o.dataset.value === harmony));
    if (labelEl) labelEl.textContent = HARMONY_LABELS[harmony] || harmony;
  }
  syncHarmony();
  subscribe('init', syncHarmony);
}

/* Auto-suggest status colors from brand */
function initAutoSuggest() {
  const btn = document.getElementById('auto-suggest-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const { palettes } = getState();
    const brandHex = palettes.brand.input;
    const { h: brandH, s: brandS } = rgbToHsl(hexToRgb(brandHex));

    const nudge = (hue, baseS) => {
      const h = (hue + 360) % 360;
      // Nudge saturation toward brand character
      const s = baseS * 0.5 + brandS * 0.5;
      const l = 48 + Math.random() * 6;
      const rgb = hslToRgb({ h, s: Math.min(100, s), l });
      return rgbToHex({ r: Math.round(rgb.r), g: Math.round(rgb.g), b: Math.round(rgb.b) });
    };

    const suggestions = {
      success: nudge(140, 70),
      warning: nudge(40,  80),
      info:    nudge(210, 75),
      error:   nudge(10,  72),
    };

    for (const [name, hex] of Object.entries(suggestions)) {
      if (palettes[name]?.locked) continue;
      setPaletteInput(name, hex);
      const hexIn = document.getElementById(`hex-${name}`);
      const picker = document.getElementById(`picker-${name}`);
      if (hexIn) hexIn.value = hex;
      if (picker) picker.value = hex;
      updateSwatchPreview(name, hex);
    }
    showToast('Status colors updated from brand');
  });
}

/* Sync UI from state (used on init + hash restore + palette load) */
export function syncFromState() {
  const { palettes, method, steps, format, harmony, precise, showSecondaryBrand, showTertiaryBrand } = getState();

  // Precise toggle
  const preciseToggle = document.getElementById('precise-toggle');
  if (preciseToggle) preciseToggle.checked = !!precise;

  // Method — sync gen-picker (scale-option style)
  const menu = document.getElementById('gen-menu');
  const triggerName = document.getElementById('gen-trigger-name');
  if (menu && triggerName) {
    const meta = GENERATORS_META.find(g => g.value === method) || GENERATORS_META[0];
    triggerName.textContent = meta.name;
    menu.querySelectorAll('.scale-option').forEach(o => {
      const active = o.dataset.value === method;
      o.classList.toggle('scale-option--active', active);
      o.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  // Steps
  document.querySelectorAll('.step-btn').forEach(b => {
    b.classList.toggle('step-btn--active', Number(b.dataset.steps) === steps);
  });

  // Format
  document.querySelectorAll('.format-btn').forEach(b => {
    b.classList.toggle('format-btn--active', b.dataset.format === format);
  });

  // Show/hide secondary & tertiary rows + strip buttons
  const secondaryRow = document.getElementById('brand-secondary-row');
  const tertiaryRow  = document.getElementById('brand-tertiary-row');
  const addSecBtn    = document.getElementById('add-secondary-btn');
  const addTertBtn   = document.getElementById('add-tertiary-btn');
  const stripBrand2  = document.getElementById('strip-btn-brand2');
  const stripBrand3  = document.getElementById('strip-btn-brand3');

  if (secondaryRow) secondaryRow.style.display  = showSecondaryBrand ? '' : 'none';
  if (addSecBtn)    addSecBtn.style.display      = showSecondaryBrand ? 'none' : '';
  if (addTertBtn)   addTertBtn.style.display     = showSecondaryBrand && !showTertiaryBrand ? '' : 'none';
  if (tertiaryRow)  tertiaryRow.style.display    = showTertiaryBrand  ? '' : 'none';
  if (stripBrand2)  stripBrand2.style.display    = showSecondaryBrand ? '' : 'none';
  if (stripBrand3)  stripBrand3.style.display    = showTertiaryBrand  ? '' : 'none';

  // Palette inputs
  for (const [name, p] of Object.entries(palettes)) {
    const hexIn = document.getElementById(`hex-${name}`);
    const picker = document.getElementById(`picker-${name}`);
    if (hexIn) hexIn.value = p.input;
    if (picker) picker.value = p.input;
    updateSwatchPreview(name, p.input);
  }
}

function syncLockUI({ name, locked }) {
  const lockBtn = document.getElementById(`lock-${name}`);
  if (lockBtn) lockBtn.classList.toggle('lock-btn--locked', locked);
}
