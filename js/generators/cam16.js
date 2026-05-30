/*
 * CAM16-corrected generator.
 * OKLCH is already perceptually uniform in lightness, but still has
 * hue-dependent chroma non-uniformity: yellow (h≈90°) appears less
 * saturated than red/blue at the same C value; cyan appears more so.
 *
 * This generator applies a hue-angle correction table derived from
 * CAM16-UCS colorfulness predictions to compensate. The result is a
 * scale where 500 truly looks as saturated as 500 for any hue — not
 * just as mathematically equal.
 *
 * Best for: multi-hue design systems where brand/success/warning/error
 * all need to feel equally "vivid" at their corresponding utility steps.
 *
 * Sanity checks:
 *   generate('#fbbf24', {steps:11}) → yellow steps noticeably richer than OKLCH
 *   generate('#22d3ee', {steps:11}) → cyan steps slightly less over-saturated
 */

import { hexToRgb, rgbToOklch, oklchToRgb, rgbToHex, clampToGamut } from '../color.js';

/**
 * Hue-correction multiplier derived from CAM16-UCS relative colorfulness.
 * Maps OKLCH hue angle → chroma scale factor to equalize perceived saturation.
 * Values > 1 boost chroma (OKLCH underestimates); < 1 reduce (overestimates).
 */
function _hueCorrectionFactor(h) {
  /* 13-point LUT — hue in degrees, factor to apply */
  const lut = [
    [  0, 1.00],   // red
    [ 30, 1.04],   // orange
    [ 60, 1.12],   // yellow-orange
    [ 90, 1.26],   // yellow (OKLCH most underestimates here)
    [120, 1.14],   // yellow-green
    [150, 1.02],   // green
    [180, 0.88],   // cyan (OKLCH overestimates here)
    [210, 0.91],   // sky blue
    [240, 0.95],   // blue
    [270, 0.98],   // violet
    [300, 1.00],   // magenta
    [330, 0.99],   // pink-red
    [360, 1.00],   // red (same as 0°)
  ];

  const hMod = ((h % 360) + 360) % 360;
  for (let i = 0; i < lut.length - 1; i++) {
    if (hMod >= lut[i][0] && hMod <= lut[i + 1][0]) {
      const t = (hMod - lut[i][0]) / (lut[i + 1][0] - lut[i][0]);
      return lut[i][1] + t * (lut[i + 1][1] - lut[i][1]);
    }
  }
  return 1.0;
}

export function generate(inputHex, { steps = 11, mode = 'light' } = {}) {
  const { h, C } = rgbToOklch(hexToRgb(inputHex));

  const Lmin = 0.13;
  const Lmax = 0.97;

  /* Apply hue correction: scale requested C before gamut-clamping */
  const corrFactor = _hueCorrectionFactor(h);
  const correctedC = C * corrFactor;

  const results = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const L = Lmax - (Lmax - Lmin) * t;

    /* Reduce chroma toward extremes, then apply correction */
    const extremeMult = 1 - 0.4 * Math.pow(Math.abs(t - 0.5) * 2, 2.5);
    const targetC = correctedC * extremeMult;
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
