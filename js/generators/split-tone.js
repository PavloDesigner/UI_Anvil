/*
 * Split-Tone generator.
 * Applies opposing hue shifts to the light and dark ends of the scale,
 * mimicking photography split-toning. Lights shift +22° (warm), darks
 * shift −22° (cool) relative to the input hue, crossing smoothly through
 * the base hue at the midpoint.
 *
 * Creates palettes with visual depth that single-hue ramps can't achieve.
 * Popular in editorial, luxury, and distinctive brand design systems.
 *
 * Sanity checks:
 *   generate('#3b82f6', {steps:11}) → blue with warm-shifted lights, cool darks
 *   generate('#22c55e', {steps:11}) → green with warm highlights, cool shadows
 */

import { hexToRgb, rgbToOklch, oklchToRgb, rgbToHex, clampToGamut } from '../color.js';

export function generate(inputHex, { steps = 11, mode = 'light' } = {}) {
  const { h: baseH, C } = rgbToOklch(hexToRgb(inputHex));

  const Lmin = 0.13;
  const Lmax = 0.97;

  /* Hue shift magnitude in degrees.
     Lights get +shift (toward warm), darks get −shift (toward cool). */
  const shift = 22;

  /* Pre-compute hue endpoints using shortest-arc interpolation */
  const hLight = (baseH + shift + 360) % 360;
  const hDark  = (baseH - shift + 360) % 360;
  /* Shortest delta from hLight to hDark on the circle */
  const hDelta = ((hDark - hLight) + 540) % 360 - 180;

  const results = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const L = Lmax - (Lmax - Lmin) * t;

    /* Smooth S-curve blend so the crossover isn't linear */
    const blend = t * t * (3 - 2 * t); // smoothstep
    const h = (hLight + hDelta * blend + 360) % 360;

    /* Reduce chroma toward extremes */
    const chromaMult = 1 - 0.35 * Math.pow(Math.abs(t - 0.5) * 2, 2.5);
    const safeC = clampToGamut(L, C * Math.max(0.05, chromaMult), h);

    const rgb = oklchToRgb({ L, C: safeC, h });
    results.push(rgbToHex({
      r: Math.round(Math.max(0, Math.min(255, rgb.r))),
      g: Math.round(Math.max(0, Math.min(255, rgb.g))),
      b: Math.round(Math.max(0, Math.min(255, rgb.b))),
    }));
  }

  return mode === 'dark' ? results.slice().reverse() : results;
}
