/**
 * Color Wheel — plots brand palette hues on a schematic hue ring.
 * Shows primary (P), secondary (S), tertiary (T), and neutral (N) dots
 * at their actual hue positions, connected by harmony geometry lines.
 *
 * Drag interaction: rotate all palette hues simultaneously.
 * Uses a snapshot + cumulative float to avoid integer-rounding drift on
 * low-saturation colors (e.g. the neutral which has ~4% HSL saturation).
 */

import { subscribe, getState, rotatePaletteHuesFromSnapshot } from '../state.js';
import { hexToRgb, rgbToHsl }                                 from '../color.js';

let _canvas  = null;
let _infoEl  = null;
let _redraw  = null;      // stored so pointerup can force a final redraw

/* ── Drag state ── */
let _isDragging    = false;
let _prevAngle     = null;
let _dragSnapshot  = null;  // { paletteName: inputHex } captured on pointerdown
let _totalRotation = 0;     // accumulated float degrees from drag start

export function initColorWheel() {
  _canvas = document.getElementById('color-wheel-canvas');
  _infoEl = document.getElementById('color-wheel-info');
  if (!_canvas) return;

  _redraw = () => {
    const state  = getState();
    const colors = _activeColors(
      state,
      _isDragging ? _dragSnapshot : null,
      _totalRotation,
    );
    _draw(_canvas, colors);
    _renderInfo(_infoEl, colors);
  };

  subscribe('palette-change',         _redraw);
  subscribe('secondary-brand-change', _redraw);
  subscribe('tertiary-brand-change',  _redraw);
  subscribe('init',                   _redraw);
  _redraw();

  _initDrag(_canvas);
}

/* ─── Data ─── */

/**
 * Build the color list for drawing.
 * When a drag is active, compute hue from (snapshotHue + totalRotation) in
 * floating-point so ALL dots — including low-saturation neutral — track the
 * pointer precisely, regardless of whether the hex integer has ticked over yet.
 */
function _activeColors(state, snapshot, totalDeg) {
  const colors = [];

  const pick = (paletteName, label, primary, neutral) => {
    const hex = state.palettes[paletteName]?.input;
    if (!hex) return;

    let h;
    if (snapshot && snapshot[paletteName] && !state.palettes[paletteName]?.locked) {
      /* Visual position = snapshot hue + total float rotation */
      const baseRgb = hexToRgb(snapshot[paletteName]);
      h = baseRgb
        ? ((rgbToHsl(baseRgb).h + totalDeg) % 360 + 360) % 360
        : rgbToHsl(hexToRgb(hex)).h;
    } else {
      h = rgbToHsl(hexToRgb(hex)).h;
    }

    colors.push({ hue: h, hex, label, primary, neutral: !!neutral });
  };

  pick('brand',   'P', true);
  if (state.showSecondaryBrand) pick('brand2', 'S', false);
  if (state.showTertiaryBrand)  pick('brand3', 'T', false);
  if (state.palettes.neutral?.input) pick('neutral', 'N', false, true);

  return colors;
}

/* ─── Drag interaction ─── */
function _initDrag(canvas) {
  canvas.style.cursor = 'grab';

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
    _isDragging   = true;
    _prevAngle    = _angleTo(_center(canvas), e);
    _totalRotation = 0;

    /* Snapshot all current palette inputs */
    const state  = getState();
    _dragSnapshot = {};
    for (const [name, p] of Object.entries(state.palettes)) {
      _dragSnapshot[name] = p.input;
    }
  });

  canvas.addEventListener('pointermove', e => {
    if (!_isDragging) return;

    const angle = _angleTo(_center(canvas), e);
    let delta   = angle - _prevAngle;

    /* Normalise to (−180, +180] to handle the ±180° wrap */
    if (delta >  180) delta -= 360;
    if (delta < -180) delta += 360;

    _prevAngle      = angle;
    _totalRotation += delta;

    if (Math.abs(_totalRotation) < 0.05) return;  // ignore pure jitter

    /* Apply from snapshot — no compounding integer-rounding error */
    rotatePaletteHuesFromSnapshot(_dragSnapshot, _totalRotation);
    _syncInputUI();
  });

  const endDrag = () => {
    _isDragging = false;
    canvas.style.cursor = 'grab';
    _dragSnapshot  = null;
    _totalRotation = 0;
    /* Force one more redraw with actual hex-based hues */
    _redraw?.();
  };

  canvas.addEventListener('pointerup',     endDrag);
  canvas.addEventListener('pointercancel', endDrag);
}

/* Sync the visible hex inputs / color pickers / swatch previews after rotation */
function _syncInputUI() {
  const state = getState();
  const NAMES = ['brand','brand2','brand3','neutral','success','warning','info','error'];
  for (const name of NAMES) {
    const p = state.palettes[name];
    if (!p) continue;
    const hexEl    = document.getElementById(`hex-${name}`);
    const pickerEl = document.getElementById(`picker-${name}`);
    const swatchEl = document.getElementById(`swatch-preview-${name}`);
    if (hexEl)    hexEl.value               = p.input;
    if (pickerEl) pickerEl.value            = p.input;
    if (swatchEl) swatchEl.style.background = p.input;
  }
}

/* ─── Drawing ─── */
function _draw(canvas, colors) {
  const dpr  = Math.min(window.devicePixelRatio || 1, 3);
  const css  = canvas.clientWidth || 190;
  const size = css * dpr;

  if (canvas.width !== size || canvas.height !== size) {
    canvas.width  = size;
    canvas.height = size;
  }

  const ctx    = canvas.getContext('2d');
  const cx     = size / 2;
  const cy     = size / 2;
  const outer  = size * 0.455;
  const inner  = size * 0.30;
  const mid    = (outer + inner) / 2;

  ctx.clearRect(0, 0, size, size);

  /* ── Hue ring — single conic gradient, zero segment seams ── */
  const conic = ctx.createConicGradient(-Math.PI / 2, cx, cy);
  for (let i = 0; i <= 360; i++) {
    conic.addColorStop(i / 360, `hsl(${i},72%,57%)`);
  }
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI * 2, false);
  ctx.arc(cx, cy, inner, 0, Math.PI * 2, true);
  ctx.fillStyle = conic;
  ctx.fill('evenodd');

  /* ── Subtle inner-edge darkening for depth ── */
  const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  grad.addColorStop(0,   'rgba(0,0,0,0.28)');
  grad.addColorStop(0.3, 'rgba(0,0,0,0)');
  grad.addColorStop(1,   'rgba(0,0,0,0.14)');
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI * 2, false);
  ctx.arc(cx, cy, inner, 0, Math.PI * 2, true);
  ctx.fillStyle = grad;
  ctx.fill('evenodd');

  /* Separate brand dots (P/S/T) from neutral */
  const brandColors  = colors.filter(c => !c.neutral);
  const neutralColor = colors.find(c => c.neutral);

  /* ── Geometry: lines / triangle between brand dots only ── */
  if (brandColors.length >= 2) {
    const pts = brandColors.map(c => _pt(cx, cy, mid, c.hue));
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    if (brandColors.length === 3) ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth   = 1.5 * dpr;
    ctx.setLineDash([4 * dpr, 3 * dpr]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* ── Neutral indicator — small tick on the inner edge ── */
  if (neutralColor) {
    const tickR   = inner + 1.5 * dpr;
    const tickLen = size * 0.055;
    const { x: tx, y: ty }   = _pt(cx, cy, tickR + tickLen / 2, neutralColor.hue);
    const { x: tx0, y: ty0 } = _pt(cx, cy, tickR,               neutralColor.hue);
    const { x: tx1, y: ty1 } = _pt(cx, cy, tickR + tickLen,     neutralColor.hue);

    ctx.beginPath();
    ctx.moveTo(tx0, ty0);
    ctx.lineTo(tx1, ty1);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth   = 2.2 * dpr;
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.lineCap     = 'butt';

    ctx.beginPath();
    ctx.arc(tx, ty, 3 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = neutralColor.hex;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tx, ty, 3 * dpr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth   = 1.4 * dpr;
    ctx.stroke();
  }

  /* ── Brand color dots (P / S / T) ── */
  brandColors.forEach((c, i) => {
    const { x, y } = _pt(cx, cy, mid, c.hue);
    const r = (i === 0 ? 5.8 : 4.5) * dpr;

    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
    const { r: cr, g: cg, b: cb } = hexToRgb(c.hex);
    glow.addColorStop(0, `rgba(${cr},${cg},${cb},0.5)`);
    glow.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = c.hex;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = i === 0 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.75)';
    ctx.lineWidth   = 1.8 * dpr;
    ctx.stroke();
  });
}

/* ─── Info row ─── */
function _renderInfo(el, colors) {
  if (!el) return;

  const brandColors  = colors.filter(c => !c.neutral);
  const neutralColor = colors.find(c => c.neutral);

  const chips = brandColors.map(c =>
    `<span class="cw-chip" style="--cw-col:${c.hex}">${c.label} ${Math.round(c.hue)}°</span>`
  ).join('<span class="cw-dot">·</span>');

  const neutralChip = neutralColor
    ? `<span class="cw-chip cw-chip--neutral" style="--cw-col:${neutralColor.hex}">N ${Math.round(neutralColor.hue)}°</span>`
    : '';

  let deltas = '';
  if (brandColors.length >= 2) {
    const parts = [];
    for (let i = 1; i < brandColors.length; i++) {
      let d = Math.abs(brandColors[i].hue - brandColors[0].hue);
      if (d > 180) d = 360 - d;
      parts.push(`△${Math.round(d)}°`);
    }
    deltas = `<span class="cw-delta">${parts.join(' · ')}</span>`;
  }

  el.innerHTML = chips
    + (neutralChip ? `<span class="cw-dot">·</span>${neutralChip}` : '')
    + (deltas ? `<br>${deltas}` : '');
}

/* ─── Helpers ─── */
function _pt(cx, cy, r, hue) {
  const a = (hue - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function _center(canvas) {
  const r = canvas.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function _angleTo(center, e) {
  return Math.atan2(e.clientY - center.y, e.clientX - center.x) * 180 / Math.PI;
}
