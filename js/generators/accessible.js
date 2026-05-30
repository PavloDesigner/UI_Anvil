/*
 * WCAG-locked contrast generator.
 * Each step is binary-searched to hit a specific WCAG 2.1 contrast ratio
 * against white (light mode) or black (dark mode).
 *
 * Ratios are logarithmically distributed from 1.08 → 18, so:
 *   step 50  ≈ 1.1:1  (subtle background tint)
 *   step 500 ≈ 4.4:1  (just below AA normal text)
 *   step 600 ≈ 5.8:1  (AA ✓)
 *   step 700 ≈ 7.7:1  (AAA ✓)
 *   step 950 ≈ 18:1   (maximum contrast)
 *
 * Sanity checks:
 *   generate('#3b82f6', {steps:11, mode:'light'}) → 11 strings, lightest first
 *   generate('#22c55e', {steps:5,  mode:'dark'})  → 5 strings, darkest first
 */

import { hexToRgb, rgbToOklch, oklchToRgb, rgbToHex, clampToGamut, contrastRatio } from '../color.js';

export function generate(inputHex, { steps = 11, mode = 'light' } = {}) {
  const { h, C } = rgbToOklch(hexToRgb(inputHex));
  const bgRef = mode === 'light' ? '#ffffff' : '#000000';

  /* Logarithmic contrast distribution: 1.08 → 18 */
  const logMin = Math.log(1.08);
  const logMax = Math.log(18);
  const results = [];

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const targetRatio = Math.exp(logMin + (logMax - logMin) * t);

    /* Binary search for OKLCH L that achieves targetRatio against bgRef */
    let lo = 0.02, hi = 0.98;
    for (let j = 0; j < 30; j++) {
      const mid = (lo + hi) / 2;
      const chromaMult = 1 - 0.4 * Math.pow(Math.abs(mid - 0.5) * 2, 2.5);
      const safeC = clampToGamut(mid, C * chromaMult, h);
      const rgb = oklchToRgb({ L: mid, C: safeC, h });
      const hex = rgbToHex({
        r: Math.round(Math.max(0, Math.min(255, rgb.r))),
        g: Math.round(Math.max(0, Math.min(255, rgb.g))),
        b: Math.round(Math.max(0, Math.min(255, rgb.b))),
      });
      const ratio = contrastRatio(hex, bgRef);

      if (mode === 'light') {
        /* Higher ratio = darker = lower L. Too low → need darker (lower L → hi=mid) */
        if (ratio < targetRatio) hi = mid; else lo = mid;
      } else {
        /* Higher ratio = lighter = higher L. Too low → need lighter (higher L → lo=mid) */
        if (ratio < targetRatio) lo = mid; else hi = mid;
      }
    }

    const finalL = (lo + hi) / 2;
    const chromaMult = 1 - 0.4 * Math.pow(Math.abs(finalL - 0.5) * 2, 2.5);
    const safeC = clampToGamut(finalL, C * chromaMult, h);
    const rgb = oklchToRgb({ L: finalL, C: safeC, h });
    results.push(rgbToHex({
      r: Math.round(Math.max(0, Math.min(255, rgb.r))),
      g: Math.round(Math.max(0, Math.min(255, rgb.g))),
      b: Math.round(Math.max(0, Math.min(255, rgb.b))),
    }));
  }

  /* Light mode: t=0→lightest (low contrast), t=1→darkest (high contrast) ✓
     Dark mode:  t=0→darkest (low contrast), t=1→lightest (high contrast) ✓ */
  return results;
}
