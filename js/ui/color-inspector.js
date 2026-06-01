/**
 * Color Inspector — hover any element in the preview canvas to see its palette name.
 *
 * Palette-mapped colors (e.g. "Neutral 600", "Success 200") always surface,
 * even neutrals that would otherwise be filtered out by the saturation check.
 * Unknown saturated colors surface as hex-only.
 *
 * Checks per element (priority order):
 *   backgroundColor · SVG fill · SVG stroke · border colors · outline · box-shadow
 *
 * Pass 1 — first candidate that maps to a known palette token  (label shown)
 *           ↳ skips near-black (lum < 0.04) to avoid collisions with the SVG
 *             default fill (black) and dark-mode extreme scale steps
 * Pass 2 — first candidate that passes the saturation/interest filter (hex only)
 */

import { showTooltip, hideTooltip, flashCopied } from './tooltip.js';
import { subscribe, getState, getStepLabels } from '../state.js';
import { copyToClipboard } from '../utils.js';
import { showToast } from './toast.js';

let _canvas     = null;
let _varMap     = new Map();  // hex → "Neutral 600"
let _lastEl     = null;
let _currentHex = null;       // hex currently under the pointer (for click-copy)

/* ─── Init ─── */
export function initColorInspector() {
  _canvas = document.getElementById('preview-canvas');
  if (!_canvas) return;

  _rebuildVarMap();
  subscribe('palette-change', _rebuildVarMap);
  subscribe('theme-change',   _rebuildVarMap);

  _canvas.addEventListener('mouseover', _onOver);
  _canvas.addEventListener('mouseleave', _onLeave);
  _canvas.addEventListener('click', _onClick);
  _canvas.style.cursor = 'default';
}

/* ─── Event handlers ─── */
function _onOver(e) {
  let el    = e.target;
  let found = null;

  while (el && el !== _canvas) {
    const c = _extractColor(el);
    if (c) { found = { el, color: c }; break; }
    el = el.parentElement;
  }

  if (found?.el === _lastEl) return;
  _lastEl = found?.el ?? null;

  if (!found) { _currentHex = null; hideTooltip(); return; }

  const hex      = _toHex(found.color.r, found.color.g, found.color.b);
  const varLabel = _varMap.get(hex.toLowerCase());
  const label    = varLabel ? `${hex}  ·  ${varLabel}` : hex;

  _currentHex = hex;
  _canvas.style.cursor = 'pointer';   // signal the hovered color is copyable
  showTooltip(found.el, label, hex);
}

function _onLeave() {
  _lastEl = null;
  _currentHex = null;
  _canvas.style.cursor = 'default';
  hideTooltip();
}

/* Click a colored element in the preview to copy its hex */
async function _onClick(e) {
  // Don't hijack real controls (form inputs, the typography Copy-CSS button)
  if (e.target.closest('input, textarea, select, .typo-copy-btn')) return;
  if (!_currentHex) return;
  const val = _currentHex.toUpperCase();
  await copyToClipboard(val);
  flashCopied(_currentHex);
  showToast(`Copied ${val}`);
}

/* ─── Color extraction ─── */
function _extractColor(el) {
  const style      = getComputedStyle(el);
  const candidates = [];

  const push = (c) => { if (c && c.a >= 0.15) candidates.push(c); };

  // 1. Background
  push(_parseRgba(style.backgroundColor));

  // 2. SVG fill / stroke — getComputedStyle resolves CSS inheritance,
  //    so child <path>/<circle> elements report their effective fill.
  const fill = style.fill;
  if (fill && fill !== 'none') push(_parseRgba(fill));

  const stroke = style.stroke;
  if (stroke && stroke !== 'none') push(_parseRgba(stroke));

  // 3. Borders — guard by width: avoids picking up borders with width 0
  for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
    if (parseFloat(style[`border${side}Width`]) > 0)
      push(_parseRgba(style[`border${side}Color`]));
  }

  // 4. Outline — guard by style/width: browsers default outlineColor to the
  //    element's text color even when no outline is visible, causing false positives
  if (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0)
    push(_parseRgba(style.outlineColor));

  // 5. Box-shadow — catches ring-* utilities (e.g. "0 0 0 2px rgb(59,130,246)")
  //    Use _parseAllRgba to handle multiple comma-separated shadow layers
  const shadow = style.boxShadow;
  if (shadow && shadow !== 'none') {
    for (const c of _parseAllRgba(shadow)) {
      if (c.a >= 0.15) candidates.push(c);
    }
  }

  // 6. Text color — only when meaningfully colored (not default white/black).
  //    Pre-filtering with _isInteresting keeps noise out: neutral white/dark
  //    body copy is skipped; brand-blue headings, success-green labels, etc. pass.
  const tc = _parseRgba(style.color);
  if (tc && tc.a >= 0.15 && _isInteresting(tc)) candidates.push(tc);

  // Pass 1: palette-matched — skip near-black (lum < 0.04) because:
  //   • SVG fill defaults to rgb(0,0,0) and would match the darkest scale step
  //   • Dark-mode step-50 values are near-black and collide with card backgrounds
  for (const c of candidates) {
    const hex = _toHex(c.r, c.g, c.b).toLowerCase();
    const lum = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
    if (_varMap.has(hex) && lum > 0.04) return c;
  }

  // Pass 2: unknown but visually interesting (saturated / mid-luminance)
  for (const c of candidates) {
    if (_isInteresting(c)) return c;
  }

  return null;
}

/* ─── Parsers ─── */
function _parseRgba(str) {
  if (!str) return null;
  const m = str.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([0-9.]+))?\s*\)/);
  if (!m) return null;
  return {
    r: parseInt(m[1]),
    g: parseInt(m[2]),
    b: parseInt(m[3]),
    a: m[4] !== undefined ? parseFloat(m[4]) : 1,
  };
}

/** Extract every rgb/rgba colour from a string (e.g. a multi-layer box-shadow). */
function _parseAllRgba(str) {
  if (!str) return [];
  const re = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([0-9.]+))?\s*\)/g;
  const out = [];
  let m;
  while ((m = re.exec(str)) !== null) {
    out.push({
      r: parseInt(m[1]),
      g: parseInt(m[2]),
      b: parseInt(m[3]),
      a: m[4] !== undefined ? parseFloat(m[4]) : 1,
    });
  }
  return out;
}

function _isInteresting({ r, g, b }) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === 0) return false;
  const sat = (max - min) / max;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (sat > 0.12) return true;
  if (sat > 0.04 && lum > 0.08 && lum < 0.80) return true;
  return false;
}

/* ─── Utilities ─── */
function _toHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/**
 * '--color-neutral-600'  → 'Neutral 600'
 * '--color-brand2-400'   → 'Brand 2 400'
 * '--accent'             → 'Accent'
 * '--success-icon'       → 'Success Icon'
 */
function _varToLabel(varName) {
  const m = varName.match(/^--color-([a-z]+?)(\d*)[-](\d+)$/);
  if (m) {
    const base   = m[1].charAt(0).toUpperCase() + m[1].slice(1);
    const suffix = m[2] ? ` ${m[2]}` : '';
    return `${base}${suffix} ${m[3]}`;
  }
  return varName.replace(/^--/, '').split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/* ─── Var map: enumerate every active palette token ─── */
function _rebuildVarMap() {
  _varMap = new Map();
  const root   = getComputedStyle(document.documentElement);
  const state  = getState();
  const labels = getStepLabels(state.steps);

  const palettes = ['brand', 'neutral', 'success', 'warning', 'info', 'error'];
  if (state.showSecondaryBrand) palettes.push('brand2');
  if (state.showTertiaryBrand)  palettes.push('brand3');

  for (const name of palettes) {
    for (const label of labels) {
      _addFromVar(root, `--color-${name}-${label}`);
    }
  }

  // Semantic aliases
  for (const v of [
    '--accent', '--accent-hover', '--secondary', '--tertiary',
    '--success-icon', '--warning-icon', '--error-icon', '--info-icon',
  ]) {
    _addFromVar(root, v);
  }
}

function _addFromVar(root, varName) {
  const val = root.getPropertyValue(varName).trim();
  if (!val) return;
  let hex = null;
  if (val.startsWith('#')) {
    hex = val.toLowerCase();
  } else {
    const p = _parseRgba(val);
    if (p) hex = _toHex(p.r, p.g, p.b).toLowerCase();
  }
  if (hex) _varMap.set(hex, _varToLabel(varName));
}
