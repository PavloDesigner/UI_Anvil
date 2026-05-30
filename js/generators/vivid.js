/*
 * Vivid: Maximum-chroma OKLCH generator.
 * At each lightness stop, binary-searches for the highest C value
 * that still fits in the sRGB gamut. Produces the most saturated
 * palette achievable for any given hue.
 *
 * Sanity checks:
 *   generate('#ef4444', {steps:11}) → 11 hex strings, deeply saturated reds
 *   generate('#3b82f6', {steps:11}) → vivid blues across the full range
 *   generate('#000000', {steps:11}) → graceful fallback to near-neutral dark
 */

import { hexToRgb, rgbToOklch, oklchToRgb, rgbToHex, clampToGamut } from '../color.js';

export function generate(inputHex, { steps = 11, mode = 'light' } = {}) {
  const { h } = rgbToOklch(hexToRgb(inputHex));

  const Lmin = 0.14;
  const Lmax = 0.95;
  const results = [];

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const L = Lmax - (Lmax - Lmin) * t;

    // Push C to the highest value that still fits in sRGB gamut.
    // 0.5 is a safe upper bound — real sRGB max C is ≈ 0.37.
    const maxC = clampToGamut(L, 0.5, h);

    const rgb = oklchToRgb({ L, C: maxC, h });
    results.push(rgbToHex({
      r: Math.round(Math.max(0, Math.min(255, rgb.r))),
      g: Math.round(Math.max(0, Math.min(255, rgb.g))),
      b: Math.round(Math.max(0, Math.min(255, rgb.b))),
    }));
  }

  return mode === 'dark' ? results.slice().reverse() : results;
}
