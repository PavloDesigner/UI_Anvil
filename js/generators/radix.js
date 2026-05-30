/*
 * Radix-inspired 12-step semantic scale
 * Each step has a defined semantic role.
 *
 * Sanity checks:
 *   generate('#3b82f6', {steps:12}) → 12 hex strings
 *   generate('#22c55e', {steps:9})  → 9 strings (sampled from 12)
 *   ROLES[0] === 'App background'
 */

import { hexToRgb, rgbToHsl, hslToRgb, rgbToHex } from '../color.js';

export const ROLES = [
  'App background',
  'Subtle background',
  'UI element background',
  'Hovered UI element bg',
  'Active / selected bg',
  'Subtle borders',
  'UI element border',
  'Hovered element border',
  'Solid background',
  'Hovered solid bg',
  'Low-contrast text',
  'High-contrast text',
];

/* Fixed lightness targets per semantic step (light mode) */
const LIGHTNESS_LIGHT = [97.5, 95, 91, 87, 82, 76, 68, 60, 50, 44, 36, 20];
const LIGHTNESS_DARK  = [8, 12, 16, 20, 24, 29, 35, 41, 52, 58, 66, 84];

export function generate(inputHex, { steps = 11, mode = 'light' } = {}) {
  const { h, s } = rgbToHsl(hexToRgb(inputHex));
  const lightness = mode === 'light' ? LIGHTNESS_LIGHT : LIGHTNESS_DARK;

  // Build all 12 steps
  const all12 = lightness.map((l, i) => {
    const t = i / 11;
    const satMult = 1 - 0.3 * Math.pow(Math.abs(t - 0.45) * 2, 2.5);
    const adjS = Math.max(0, Math.min(100, s * satMult));
    const rgb = hslToRgb({ h, s: adjS, l });
    return rgbToHex({ r: Math.round(rgb.r), g: Math.round(rgb.g), b: Math.round(rgb.b) });
  });

  if (steps === 12) return all12;

  // Sample evenly from 12 steps
  return Array.from({ length: steps }, (_, i) => {
    const idx = Math.round(i * 11 / (steps - 1));
    return all12[Math.min(11, idx)];
  });
}
