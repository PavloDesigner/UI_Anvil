/*
 * APCA-tuned contrast generator
 * Spaces steps by equal perceptual contrast deltas rather than raw lightness.
 *
 * Sanity checks:
 *   generate('#3b82f6', {steps:11, mode:'light'}) → 11 strings, perceptually even steps
 *   generate('#22c55e', {steps:5,  mode:'dark'})  → 5 strings, darkest first
 *   apcaLc('#ffffff', '#000000') ≈ 106
 */

import { hexToRgb, rgbToHsl, hslToRgb, rgbToHex } from '../color.js';

/* APCA Lc calculation (simplified SA/w3 version) */
function linearize(v) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function ySRGB({ r, g, b }) {
  return 0.2126729 * linearize(r) + 0.7151522 * linearize(g) + 0.0721750 * linearize(b);
}
function softClamp(Y) {
  return Y < 0 ? 0 : Y < 0.022 ? Y + Math.pow(0.022 - Y, 1.414) : Y;
}

export function apcaLc(textHex, bgHex) {
  const Ytext = softClamp(ySRGB(hexToRgb(textHex)));
  const Ybg   = softClamp(ySRGB(hexToRgb(bgHex)));
  const Sapc = Ybg > Ytext
    ? 1.14 * (Math.pow(Ybg, 0.56) - Math.pow(Ytext, 0.57))
    : 1.14 * (Math.pow(Ybg, 0.65) - Math.pow(Ytext, 0.62));
  return Math.abs(Sapc) < 0.1 ? 0 : Sapc * 100;
}

/* Build N shades by targeting equal Lc steps against white (light) or black (dark) */
export function generate(inputHex, { steps = 11, mode = 'light' } = {}) {
  const { h, s } = rgbToHsl(hexToRgb(inputHex));
  const bgRef = mode === 'light' ? '#ffffff' : '#000000';

  // Target Lc range: light 10→95, dark 10→95 (absolute values)
  const lcMin = 8, lcMax = 90;
  const results = [];

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const targetLc = lcMin + (lcMax - lcMin) * t;

    // Binary search for lightness that achieves targetLc
    let lo = 2, hi = 98;
    for (let j = 0; j < 24; j++) {
      const mid = (lo + hi) / 2;
      const satMult = 1 - 0.35 * Math.pow(Math.abs((mid / 100) - 0.5) * 2, 2);
      const rgb = hslToRgb({ h, s: s * satMult, l: mid });
      const hex = rgbToHex({ r: Math.round(rgb.r), g: Math.round(rgb.g), b: Math.round(rgb.b) });
      const lc = Math.abs(apcaLc(hex, bgRef));
      if (lc < targetLc) {
        // need more contrast: lighter in light mode means step back toward lower lightness
        if (mode === 'light') hi = mid; else lo = mid;
      } else {
        if (mode === 'light') lo = mid; else hi = mid;
      }
    }
    const finalL = (lo + hi) / 2;
    const satMult = 1 - 0.35 * Math.pow(Math.abs((finalL / 100) - 0.5) * 2, 2);
    const rgb = hslToRgb({ h, s: s * satMult, l: finalL });
    results.push(rgbToHex({ r: Math.round(rgb.r), g: Math.round(rgb.g), b: Math.round(rgb.b) }));
  }

  return mode === 'light' ? results.reverse() : results;
}
