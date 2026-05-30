/*
 * Duotone generator.
 * Interpolates between two hue poles across the lightness scale.
 * The input hue anchors the center; lights lean +55° (toward warm),
 * darks lean −55° (toward cool). Crossover uses a smooth S-curve.
 *
 * Creates palettes that transition between distinct color temperatures —
 * a "warm highlight / cool shadow" effect used in artistic and editorial
 * design systems. Every palette feels unique compared to a single-hue ramp.
 *
 * Sanity checks:
 *   generate('#3b82f6', {steps:11}) → blue-indigo lights fading to teal darks
 *   generate('#ef4444', {steps:11}) → warm coral lights shifting to cool crimson darks
 */

import { hexToRgb, rgbToOklch, oklchToRgb, rgbToHex, clampToGamut } from '../color.js';

export function generate(inputHex, { steps = 11, mode = 'light' } = {}) {
  const { h: baseH, C } = rgbToOklch(hexToRgb(inputHex));

  const Lmin = 0.13;
  const Lmax = 0.97;

  /* The two hue poles — lights get hueA, darks get hueB */
  const spread = 55;
  const hueA = (baseH + spread + 360) % 360;
  const hueB = (baseH - spread + 360) % 360;

  /* Shortest-arc delta from A to B on the hue circle */
  const delta = ((hueB - hueA) + 540) % 360 - 180;

  const results = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const L = Lmax - (Lmax - Lmin) * t;

    /* Smoothstep blend: eases in/out so the crossover isn't abrupt */
    const blend = t * t * (3 - 2 * t);
    const h = (hueA + delta * blend + 360) % 360;

    /* Chroma envelope: reduce at both extremes, slightly boost around mid */
    const chromaMult = 0.88 + 0.12 * Math.sin(Math.PI * t) - 0.35 * Math.pow(Math.abs(t - 0.5) * 2, 3);
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
