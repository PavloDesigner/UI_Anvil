/*
 * Display P3 wide-gamut generator.
 * Finds the maximum chroma that fits within the Display P3 gamut at each
 * lightness stop — roughly 25–35% wider than sRGB. The hex output is the
 * nearest sRGB approximation; the colors push to the sRGB edge and beyond.
 *
 * On P3 displays, exporting as oklch() CSS values renders the full P3
 * range. On sRGB screens the colors look like vivid sRGB — no breakage.
 *
 * Sanity checks:
 *   generate('#ef4444', {steps:11}) → vivid reds, more saturated than Vivid in mid-range
 *   generate('#22c55e', {steps:11}) → deeper greens leveraging P3 green gamut
 */

import { hexToRgb, rgbToOklch, rgbToHex } from '../color.js';

/* ── P3 gamut helpers (inline — no XYZ export needed from color.js) ── */

function _linearize(v) {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function _delinearize(v) {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(1, c)) * 255;
}

/** OKLch → linear sRGB (unclipped — values may be outside [0,1]) */
function _oklchToLinear(L, C, h) {
  const rad = h * Math.PI / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const ll = l_ * l_ * l_, mm = m_ * m_ * m_, ss = s_ * s_ * s_;
  return {
    r: +4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss,
    g: -1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss,
    b: -0.0041960863 * ll - 0.7034186147 * mm + 1.7076147010 * ss,
  };
}

/** Linear sRGB → XYZ D65 */
function _linToXYZ(r, g, b) {
  return {
    x: 0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    y: 0.2126729 * r + 0.7151522 * g + 0.0721750 * b,
    z: 0.0193339 * r + 0.1191920 * g + 0.9503041 * b,
  };
}

/** XYZ D65 → linear Display P3 */
function _xyzToLinP3(x, y, z) {
  return {
    r:  2.4934969 * x - 0.9313836 * y - 0.4027108 * z,
    g: -0.8294890 * x + 1.7626641 * y + 0.0236247 * z,
    b:  0.0358458 * x - 0.0761724 * y + 0.9568845 * z,
  };
}

/** Is this OKLch color inside Display P3? */
function _inP3(L, C, h) {
  const lin = _oklchToLinear(L, C, h);
  const { x, y, z } = _linToXYZ(lin.r, lin.g, lin.b);
  const p3 = _xyzToLinP3(x, y, z);
  const eps = 0.0005;
  return (
    p3.r >= -eps && p3.r <= 1 + eps &&
    p3.g >= -eps && p3.g <= 1 + eps &&
    p3.b >= -eps && p3.b <= 1 + eps
  );
}

/** Binary-search for highest C that fits inside P3 at given L, h */
function _clampToP3(L, C_start, h) {
  /* P3 allows roughly 1.4× the chroma of sRGB at many hues */
  let lo = 0, hi = Math.min(C_start * 1.5, 0.55);
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (_inP3(L, mid, h)) lo = mid; else hi = mid;
  }
  return lo;
}

/* ── Generator ── */

export function generate(inputHex, { steps = 11, mode = 'light' } = {}) {
  const { h, C } = rgbToOklch(hexToRgb(inputHex));

  const Lmin = 0.14;
  const Lmax = 0.95;
  const results = [];

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const L = Lmax - (Lmax - Lmin) * t;

    /* Push to the P3 gamut boundary at this L */
    const maxC = _clampToP3(L, 0.55, h);

    /* Recover sRGB hex: oklch → linear sRGB → gamma → clip → hex */
    const lin = _oklchToLinear(L, maxC, h);
    results.push(rgbToHex({
      r: Math.round(_delinearize(lin.r)),
      g: Math.round(_delinearize(lin.g)),
      b: Math.round(_delinearize(lin.b)),
    }));
  }

  return mode === 'dark' ? results.slice().reverse() : results;
}
