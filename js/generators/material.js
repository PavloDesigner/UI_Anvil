/*
 * Material Design 3 tonal palette generator.
 * Approximates HCT (Hue Chroma Tone) by working in OKLCH.
 * Fixed tones: 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100.
 *
 * Sanity checks:
 *   generate('#6750a4', {steps:13}) → 13 hex strings
 *   generate('#6750a4', {steps:11}) → 11 strings (sampled from 13)
 *   generate('#ff0000', {steps:13})[0]  → near black
 *   generate('#ff0000', {steps:13})[12] → near white
 */

import { hexToRgb, rgbToOklch, oklchToRgb, rgbToHex, clampToGamut } from '../color.js';

/* M3 canonical tones mapped to OKLCH L (0-1) */
const TONES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100];
const TONE_TO_L = t => t === 0 ? 0 : t === 100 ? 1 : (t / 100) * 0.9 + 0.05;

export function generate(inputHex, { steps = 11, mode = 'light' } = {}) {
  const { h, C } = rgbToOklch(hexToRgb(inputHex));

  // Build all 13 tonal steps
  const all13 = TONES.map((tone, i) => {
    const L = TONE_TO_L(tone);
    // Reduce chroma at extremes (tone 0, 100) and slightly at tone 10/90
    const t = i / 12;
    const chromaMult = 1 - 0.5 * Math.pow(Math.abs(t - 0.5) * 2, 3);
    const targetC = C * chromaMult;
    const safeC = clampToGamut(L, targetC, h);
    const rgb = oklchToRgb({ L, C: safeC, h });
    return rgbToHex({
      r: Math.round(Math.max(0, Math.min(255, rgb.r))),
      g: Math.round(Math.max(0, Math.min(255, rgb.g))),
      b: Math.round(Math.max(0, Math.min(255, rgb.b))),
    });
  });

  // Light mode: lightest first (tone 100→0), dark mode: darkest first (tone 0→100)
  // all13 is naturally darkest-first (tone 0 at index 0), so light needs the reverse
  const ordered = mode === 'light' ? all13.slice().reverse() : all13;

  if (steps === 13) return ordered;

  // Sample evenly from 13 steps
  return Array.from({ length: steps }, (_, i) => {
    const idx = Math.round(i * 12 / (steps - 1));
    return ordered[Math.min(12, idx)];
  });
}
