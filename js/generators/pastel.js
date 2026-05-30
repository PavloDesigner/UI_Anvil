/*
 * Pastel / Tints generator.
 * High-lightness, low-chroma scale. Lightness stays in the upper register
 * (0.97→0.68), chroma is capped at 40% of the input and follows a bell
 * curve peaking around step 400–500.
 *
 * Inspired by modern consumer SaaS palettes (Linear, Vercel, Loom).
 * Best for: soft backgrounds, subtle tints, light-mode consumer apps.
 *
 * Sanity checks:
 *   generate('#ef4444', {steps:11}) → 11 light pinkish-red strings
 *   generate('#3b82f6', {steps:11}) → 11 soft blue strings, never dark
 */

import { hexToRgb, rgbToOklch, oklchToRgb, rgbToHex, clampToGamut } from '../color.js';

export function generate(inputHex, { steps = 11, mode = 'light' } = {}) {
  const { h, C } = rgbToOklch(hexToRgb(inputHex));

  /* Lightness range stays high — never goes near true dark */
  const Lmin = 0.68;
  const Lmax = 0.975;

  /* Chroma: capped at 40% of input, bell-curve peak near t=0.4 */
  const C_cap = C * 0.40;

  const results = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const L = Lmax - (Lmax - Lmin) * t;

    /* Bell-curve chroma: 0 at lightest, peaks near t=0.4, drops at darkest */
    const peak = Math.exp(-5 * Math.pow(t - 0.40, 2));
    const chromaMult = Math.max(0.04, peak);
    const targetC = C_cap * chromaMult;
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
