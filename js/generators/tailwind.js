/*
 * Tailwind-style HSL lightness curve generator
 *
 * Sanity checks:
 *   generate('#ef4444', {steps:11, mode:'light'}) → 11 hex strings, first ~white, last ~dark red
 *   generate('#000000', {steps:11, mode:'dark'})  → 11 hex strings, ascending lightness
 *   generate('#ffffff', {steps:5,  mode:'light'}) → 5 strings, no crash
 */

import { hexToRgb, rgbToHsl, hslToRgb, rgbToHex } from '../color.js';

export function generate(inputHex, { steps = 11, mode = 'light' } = {}) {
  const { h, s } = rgbToHsl(hexToRgb(inputHex));

  // Lightness curve: ~97% (step 0) → ~8% (step n-1)
  const lightnessScale = buildLightnessScale(steps);

  return lightnessScale.map((l, i) => {
    // Reduce saturation at extremes
    const t = i / (steps - 1);
    const satMult = 1 - 0.45 * Math.pow(Math.abs(t - 0.5) * 2, 2.2);
    const adjS = Math.max(0, Math.min(100, s * satMult));

    const effectiveL = mode === 'dark' ? lightnessScale[steps - 1 - i] : l;
    const rgb = hslToRgb({ h, s: adjS, l: effectiveL });
    return rgbToHex({ r: Math.round(rgb.r), g: Math.round(rgb.g), b: Math.round(rgb.b) });
  });
}

function buildLightnessScale(steps) {
  const min = 8, max = 97;
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return max - (max - min) * t;
  });
}
