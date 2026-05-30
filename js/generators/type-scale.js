/*
 * Type scale generator.
 * Produces font-size steps, line-heights, and letter-spacings
 * from a chosen musical/mathematical ratio or a design-grid sequence.
 */

export const SCALE_METHODS = {
  'golden-ratio':     { name: 'Golden Ratio',    desc: '1.618 · dramatic contrast',   ratio: 1.618 },
  'perfect-fourth':   { name: 'Perfect Fourth',  desc: '1.333 · balanced elegance',   ratio: 1.333 },
  'augmented-fourth': { name: 'Aug. Fourth',     desc: '1.414 · strong contrast',     ratio: 1.414 },
  'major-third':      { name: 'Major Third',     desc: '1.250 · subtle & refined',    ratio: 1.250 },
  'minor-third':      { name: 'Minor Third',     desc: '1.200 · compact & dense',     ratio: 1.200 },
  'major-second':     { name: 'Major Second',    desc: '1.125 · minimal steps',       ratio: 1.125 },
  'perfect-fifth':    { name: 'Perfect Fifth',   desc: '1.500 · bold headlines',      ratio: 1.500 },
  'octave':           { name: 'Octave',          desc: '2.000 · maximum drama',       ratio: 2.000 },
  '8pt-grid':         { name: '8pt Grid',        desc: 'Design system multiples',     grid: true  },
  '4pt-grid':         { name: '4pt Grid',        desc: 'Dense 4px grid values',       grid: true  },
};

// Pre-defined grid sequences (px)
const GRID_8PT = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 112, 128];
const GRID_4PT = [10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80, 96];

/**
 * Generate raw px sizes for the scale.
 */
export function generateScale(method, baseSize, steps, baseStep) {
  const m = SCALE_METHODS[method];
  if (!m) return [];

  if (m.grid) {
    const grid = method === '8pt-grid' ? GRID_8PT : GRID_4PT;
    const baseIdx = grid.reduce((best, v, i) =>
      Math.abs(v - baseSize) < Math.abs(grid[best] - baseSize) ? i : best, 0);
    const start = Math.max(0, baseIdx - baseStep);
    const slice = grid.slice(start, start + steps);
    while (slice.length < steps) {
      slice.push(Math.round(slice[slice.length - 1] * 1.25));
    }
    return slice;
  }

  return Array.from({ length: steps }, (_, i) => {
    const exp  = i - baseStep;
    const px   = baseSize * Math.pow(m.ratio, exp);
    return Math.round(px * 1000) / 1000;
  });
}

export function pxToRem(px, base = 16) {
  return Math.round(px / base * 1000) / 1000;
}

/**
 * Perceptually optimal line-height for a given font size.
 * Larger text → tighter (headlines need less leading).
 * Smaller text → looser (body/caption needs more breathing room).
 */
export function lineHeightFor(px) {
  if (px >= 60) return 1.0;
  if (px >= 48) return 1.05;
  if (px >= 36) return 1.1;
  if (px >= 28) return 1.2;
  if (px >= 22) return 1.3;
  if (px >= 18) return 1.4;
  if (px >= 16) return 1.5;
  if (px >= 13) return 1.6;
  return 1.75;
}

/**
 * Optimal letter-spacing for a given font size.
 * Headlines → tighter (negative), small text → slightly wider.
 */
export function letterSpacingFor(px) {
  if (px >= 60) return -0.04;
  if (px >= 48) return -0.035;
  if (px >= 36) return -0.025;
  if (px >= 28) return -0.02;
  if (px >= 22) return -0.01;
  if (px >= 16) return 0;
  if (px >= 13) return 0.01;
  return 0.02;
}

/**
 * Semantic label for each step relative to the base.
 *   base → "base"
 *   below → sm, xs, 2xs, 3xs
 *   above → lg, xl, 2xl, 3xl, 4xl, 5xl, 6xl
 */
const BELOW = ['sm', 'xs', '2xs', '3xs', '4xs'];
const ABOVE = ['lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'];

export function stepLabel(i, baseStep) {
  const rel = i - baseStep;
  if (rel === 0)  return 'base';
  if (rel < 0)    return BELOW[Math.min(-rel - 1, BELOW.length - 1)];
  return ABOVE[Math.min(rel - 1, ABOVE.length - 1)];
}

/**
 * Build the complete annotated scale.
 * @returns {Array<{label,px,rem,lineHeight,letterSpacing}>}
 */
export function buildScaleData(method, baseSize, steps, baseStep) {
  const sizes = generateScale(method, baseSize, steps, baseStep);
  return sizes.map((px, i) => ({
    label:         stepLabel(i, baseStep),
    px:            Math.round(px * 100) / 100,
    rem:           pxToRem(px),
    lineHeight:    lineHeightFor(px),
    letterSpacing: letterSpacingFor(px),
  }));
}

/**
 * Emit CSS custom properties for the full scale.
 */
export function buildTypographyCSS(heading, body, scale) {
  const varLines = scale.map(s =>
    `  --text-${s.label}: ${s.rem}rem;  /* ${s.px}px · lh ${s.lineHeight} · ls ${s.letterSpacing >= 0 ? '+' : ''}${s.letterSpacing}em */`
  ).join('\n');

  return `:root {\n  --font-heading: '${heading}', Georgia, serif;\n  --font-body: '${body}', system-ui, sans-serif;\n\n${varLines}\n}`;
}
