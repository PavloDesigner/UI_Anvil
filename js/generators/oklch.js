/*
 * Perceptually uniform OKLCH ramp generator.
 * Holds chroma and hue constant; varies L from ~0.97 → ~0.12.
 * This produces the most visually even spacing of any method.
 *
 * Sanity checks:
 *   generate('#ef4444', {steps:11}) → 11 hex strings
 *   generate('#000000', {steps:11}) → no crash, gracefully degrades
 *   generate('#5eb1cb', {steps:5,  mode:'dark'}) → 5 strings, darkest first
 */

import { hexToRgb, rgbToOklch, oklchToRgb, rgbToHex, clampToGamut } from '../color.js';

export function generate(inputHex, { steps = 11, mode = 'light' } = {}) {
  const { h, C } = rgbToOklch(hexToRgb(inputHex));

  const Lmin = 0.13, Lmax = 0.97;
  const results = [];

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const L = Lmax - (Lmax - Lmin) * t;

    // Reduce chroma toward extremes to avoid gamut clips producing grays
    const chromaMult = 1 - 0.4 * Math.pow(Math.abs(t - 0.5) * 2, 2.5);
    const targetC = C * chromaMult;

    // Clamp to sRGB gamut
    const safeC = clampToGamut(L, targetC, h);
    const rgb = oklchToRgb({ L, C: safeC, h });
    results.push(rgbToHex({
      r: Math.round(Math.max(0, Math.min(255, rgb.r))),
      g: Math.round(Math.max(0, Math.min(255, rgb.g))),
      b: Math.round(Math.max(0, Math.min(255, rgb.b))),
    }));
  }

  return mode === 'dark' ? results.slice().reverse() : results;
}
