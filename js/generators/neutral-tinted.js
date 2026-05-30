/*
 * Neutral-Tinted generator.
 * Near-neutral scale with just enough chroma to feel intentional rather
 * than mechanical. Chroma stays at 0.005–0.030 OKLCH, hue locked to
 * the input color's hue.
 *
 * Produces the kind of subtly warm/cool grays used by Radix, Linear,
 * Figma, and Vercel — grays that feel brand-aware without being colorful.
 * Best for: surface tokens, border tokens, neutral text scales.
 *
 * Sanity checks:
 *   generate('#ef4444', {steps:11}) → 11 warm-gray hex strings
 *   generate('#3b82f6', {steps:11}) → 11 cool-gray hex strings
 *   results[0] is near-white, results[10] is near-black (light mode)
 */

import { hexToRgb, rgbToOklch, oklchToRgb, rgbToHex, clampToGamut } from '../color.js';

export function generate(inputHex, { steps = 11, mode = 'light' } = {}) {
  const { h } = rgbToOklch(hexToRgb(inputHex));

  const Lmin = 0.11;
  const Lmax = 0.985;

  /* Chroma envelope: near-zero at both ends, gentle peak at midpoint */
  const C_peak = 0.028;

  const results = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const L = Lmax - (Lmax - Lmin) * t;

    /* Soft arch: drops to near-zero at extremes */
    const arch = 1 - Math.pow(Math.abs(t - 0.5) * 2, 1.6);
    const targetC = C_peak * Math.max(0.18, arch);
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
