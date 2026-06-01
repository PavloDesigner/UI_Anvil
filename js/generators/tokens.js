/* Figma Design Token JSON generator — 3-layer (Brand / Alias / Mapped) */

// ── Hue detection ────────────────────────────────────────────────────────────

// Returns the approximate color family name for a given hex, e.g. "Teal", "Indigo"
export function hexHueName(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.06) return 'Gray';

  let hue;
  if (max === r)      hue = ((g - b) / d % 6) * 60;
  else if (max === g) hue = ((b - r) / d + 2) * 60;
  else                hue = ((r - g) / d + 4) * 60;
  if (hue < 0) hue += 360;

  if (hue < 15 || hue >= 345) return 'Red';
  if (hue < 45)  return 'Orange';
  if (hue < 65)  return 'Yellow';
  if (hue < 90)  return 'Lime';
  if (hue < 150) return 'Green';
  if (hue < 195) return 'Teal';
  if (hue < 255) return 'Blue';
  if (hue < 285) return 'Indigo';
  if (hue < 320) return 'Purple';
  return 'Pink';
}

// Representative hex of a scale: the mid-scale step
function midHex(scale) {
  return scale[Math.floor(scale.length / 2)] ?? '#888888';
}

// ── Primitives ───────────────────────────────────────────────────────────────

function hexToComponents(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function mkColor(hex, varId, extra = {}) {
  return {
    $type: 'color',
    $value: { colorSpace: 'srgb', components: hexToComponents(hex), alpha: 1, hex: hex.toUpperCase() },
    $extensions: { 'com.figma.variableId': varId, ...extra },
  };
}

function mkNumber(value, varId, extra = {}) {
  return {
    $type: 'number',
    $value: value,
    $extensions: { 'com.figma.variableId': varId, ...extra },
  };
}

// Map 5-step Figma labels (100–500) to indices in an n-step scale
// at 10%, 30%, 50%, 70%, 90% of scale length
function fiveIdx(n) {
  return [0.1, 0.3, 0.5, 0.7, 0.9].map(f => Math.min(Math.round(f * (n - 1)), n - 1));
}

// Get the hex for a 5-step Alias label (100/200/300/400/500) from a scale array
function get5(scale, step) {
  if (!scale?.length) return '#000000';
  const si = [100, 200, 300, 400, 500].indexOf(step);
  return scale[fiveIdx(scale.length)[si]] ?? '#000000';
}

// Get a neutral step hex (50/100/…/900/1000) from the neutral scale array
// Neutral has 11 steps: indices 0–10 → labels 50,100,…,900,950(→1000)
function getNeutral(neutralScale, step) {
  if (!neutralScale?.length) return '#000000';
  const LABELS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  const i = LABELS.indexOf(step);
  return neutralScale[Math.min(i < 0 ? 0 : i, neutralScale.length - 1)];
}


// ── Layer 1 — Brand ──────────────────────────────────────────────────────────

export function generateBrand(palettes) {
  const ls = name => palettes[name]?.scale?.light ?? [];

  // Detect hue family name from each palette's representative color
  const COLOR_PALS = ['brand', 'success', 'error', 'info', 'warning'];
  const Colors = {};

  for (const pal of COLOR_PALS) {
    const scale = ls(pal);
    if (!scale.length) continue;
    const fname = hexHueName(midHex(scale));
    const idx = fiveIdx(scale.length);
    Colors[fname] = {};
    [100, 200, 300, 400, 500].forEach((step, si) => {
      Colors[fname][String(step)] = mkColor(
        scale[idx[si]],
        `VariableID:brand/${pal}/${step}`,
      );
    });
  }

  // Neutral — always Gray, full 50–1000 range
  const neutralScale = ls('neutral');
  if (neutralScale.length) {
    const n = neutralScale.length;
    const GRAY = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
    Colors['Gray'] = {};
    GRAY.forEach((step, i) => {
      Colors['Gray'][String(step)] = mkColor(
        neutralScale[Math.min(i, n - 1)],
        `VariableID:brand/neutral/${step}`,
      );
    });
    Colors['Gray']['1000'] = mkColor(neutralScale[n - 1], 'VariableID:brand/neutral/1000');
  }

  return {
    Colors,
    $extensions: { 'com.figma.modeName': 'Mode 1' },
  };
}


// ── Layer 2 — Alias ──────────────────────────────────────────────────────────

export function generateAlias(palettes) {
  const ls = name => palettes[name]?.scale?.light ?? [];
  const ALL  = { 'com.figma.scopes': ['ALL_SCOPES'] };

  function aliasColor(hex, varId, targetName) {
    return mkColor(hex, varId, {
      ...ALL,
      'com.figma.aliasData': {
        targetVariableId:      `VariableID:brand/${targetName.toLowerCase().replace(/\//g, '_')}`,
        targetVariableName:    targetName,
        targetVariableSetId:   'VariableCollectionId:brand',
        targetVariableSetName: 'Brand',
      },
    });
  }

  const out = {};

  // 5-step color groups — brand path derived from detected hue name
  const GROUPS = ['brand', 'success', 'error', 'info', 'warning'];
  const ALIAS_NAMES = { brand: 'Primary', success: 'Success', error: 'Error', info: 'Info', warning: 'Warning' };

  for (const pal of GROUPS) {
    const scale = ls(pal);
    if (!scale.length) continue;
    const aliasName  = ALIAS_NAMES[pal];
    const hueName    = hexHueName(midHex(scale));      // e.g. "Teal", "Indigo", "Green"
    const idx        = fiveIdx(scale.length);
    out[aliasName]   = {};
    [100, 200, 300, 400, 500].forEach((step, si) => {
      out[aliasName][String(step)] = aliasColor(
        scale[idx[si]],
        `VariableID:alias/${aliasName.toLowerCase()}/${step}`,
        `Colors/${hueName}/${step}`,
      );
    });
  }

  // Neutral
  const neutralScale = ls('neutral');
  if (neutralScale.length) {
    const n = neutralScale.length;
    out['Neutral'] = {};
    const GRAY_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
    GRAY_STEPS.forEach((step, i) => {
      out['Neutral'][String(step)] = aliasColor(
        neutralScale[Math.min(i, n - 1)],
        `VariableID:alias/neutral/${step}`,
        `Colors/Gray/${step}`,
      );
    });
    out['Neutral']['1000'] = aliasColor(neutralScale[n - 1], 'VariableID:alias/neutral/1000', 'Colors/Gray/1000');
    out['Neutral']['black'] = mkColor('#000000', 'VariableID:alias/neutral/black', ALL);
    out['Neutral']['white'] = mkColor('#FFFFFF', 'VariableID:alias/neutral/white', ALL);
  }

  // Border-radius
  const RADII = { xs: 2, sm: 4, md: 8, lg: 16, xl: 24, '2xl': 32, Round: 999 };
  out['Border-radius'] = {};
  for (const [name, value] of Object.entries(RADII)) {
    out['Border-radius'][name] = mkNumber(value, `VariableID:alias/radius/${name}`, {
      'com.figma.scopes': ['CORNER_RADIUS'],
      ...(name !== 'Round' ? {
        'com.figma.aliasData': {
          targetVariableId:      `VariableID:brand/scale/${value}`,
          targetVariableName:    `Scale/${value}`,
          targetVariableSetId:   'VariableCollectionId:brand',
          targetVariableSetName: 'Brand',
        },
      } : {}),
    });
  }

  // Border-width
  const WIDTHS = { S: 1, M: 2, L: 4 };
  out['Border-width'] = {};
  for (const [name, value] of Object.entries(WIDTHS)) {
    out['Border-width'][name] = mkNumber(value, `VariableID:alias/border-width/${name}`, {
      'com.figma.scopes': ['STROKE_FLOAT'],
      'com.figma.aliasData': {
        targetVariableId:      `VariableID:brand/scale/${value}`,
        targetVariableName:    `Scale/${value}`,
        targetVariableSetId:   'VariableCollectionId:brand',
        targetVariableSetName: 'Brand',
      },
    });
  }

  out.$extensions = { 'com.figma.modeName': 'Mode 1' };
  return out;
}


// ── Layer 3 — Mapped ─────────────────────────────────────────────────────────

export function generateMapped(palettes) {
  const ls = name => palettes[name]?.scale?.light ?? [];

  const brand   = ls('brand');
  const neutral = ls('neutral');
  const success = ls('success');
  const error   = ls('error');
  const info    = ls('info');
  const warning = ls('warning');

  const b  = s => get5(brand,   s);
  const n  = s => getNeutral(neutral, s);
  const sc = s => get5(success, s);
  const er = s => get5(error,   s);
  const inf = s => get5(info,   s);
  const w  = s => get5(warning, s);

  function mapped(hex, varId, scope, targetName) {
    return mkColor(hex, varId, {
      'com.figma.scopes': [scope],
      'com.figma.aliasData': {
        targetVariableId:      `VariableID:alias/${targetName.toLowerCase().replace(/\//g, '_')}`,
        targetVariableName:    targetName,
        targetVariableSetId:   'VariableCollectionId:alias',
        targetVariableSetName: 'Alias',
      },
    });
  }

  const T = 'TEXT_FILL';
  const F = 'FRAME_FILL';
  const S = 'SHAPE_FILL';
  const E = 'EFFECT_COLOR';
  const K = 'STROKE';

  return {
    Text: {
      headings:       mapped(n(50),   'VariableID:mapped/text/headings',       T, 'Neutral/50'),
      body:           mapped(n(50),   'VariableID:mapped/text/body',           T, 'Neutral/50'),
      dark:           mapped(n(900),  'VariableID:mapped/text/dark',           T, 'Neutral/900'),
      'body-dark':    mapped(n(300),  'VariableID:mapped/text/body-dark',      T, 'Neutral/300'),
      action:         mapped(b(300),  'VariableID:mapped/text/action',         T, 'Primary/300'),
      'action-hover': mapped(b(200),  'VariableID:mapped/text/action-hover',   T, 'Primary/200'),
      disabled:       mapped(n(500),  'VariableID:mapped/text/disabled',       T, 'Neutral/500'),
      info:           mapped(inf(300),'VariableID:mapped/text/info',           T, 'Info/300'),
      success:        mapped(sc(300), 'VariableID:mapped/text/success',        T, 'Success/300'),
      error:          mapped(er(300), 'VariableID:mapped/text/error',          T, 'Error/300'),
      warning:        mapped(w(300),  'VariableID:mapped/text/warning',        T, 'Warning/300'),
    },

    Surface: {
      page:                   mapped(n(1000), 'VariableID:mapped/surface/page',                   F, 'Neutral/1000'),
      primary:                mapped(n(900),  'VariableID:mapped/surface/primary',                F, 'Neutral/900'),
      secondary:              mapped(n(800),  'VariableID:mapped/surface/secondary',              F, 'Neutral/800'),
      tertiary:               mapped(n(700),  'VariableID:mapped/surface/tertiary',               F, 'Neutral/700'),
      action:                 mapped(b(400),  'VariableID:mapped/surface/action',                 F, 'Primary/400'),
      'action-hover':         mapped(b(400),  'VariableID:mapped/surface/action-hover',           F, 'Primary/400'),
      'action-active':        mapped(b(300),  'VariableID:mapped/surface/action-active',          F, 'Primary/300'),
      'action-error':         mapped(er(300), 'VariableID:mapped/surface/action-error',           F, 'Error/300'),
      'action-error-faded':   mapped(er(500), 'VariableID:mapped/surface/action-error-faded',     F, 'Error/500'),
      'action-info':          mapped(inf(300),'VariableID:mapped/surface/action-info',            F, 'Info/300'),
      'action-info-faded':    mapped(inf(500),'VariableID:mapped/surface/action-info-faded',      F, 'Info/500'),
      'action-success':       mapped(sc(300), 'VariableID:mapped/surface/action-success',         F, 'Success/300'),
      'action-success-faded': mapped(sc(500), 'VariableID:mapped/surface/action-success-faded',   F, 'Success/500'),
      'action-warning':       mapped(w(300),  'VariableID:mapped/surface/action-warning',         F, 'Warning/300'),
      'action-warning-faded': mapped(w(500),  'VariableID:mapped/surface/action-warning-faded',   F, 'Warning/500'),
    },

    Icon: {
      default:  mapped(n(200),  'VariableID:mapped/icon/default',  S, 'Neutral/200'),
      primary:  mapped(n(50),   'VariableID:mapped/icon/primary',  S, 'Neutral/50'),
      dark:     mapped(n(900),  'VariableID:mapped/icon/dark',     S, 'Neutral/900'),
      disabled: mapped(n(500),  'VariableID:mapped/icon/disabled', S, 'Neutral/500'),
      info:     mapped(inf(300),'VariableID:mapped/icon/info',     S, 'Info/300'),
      success:  mapped(sc(300), 'VariableID:mapped/icon/success',  S, 'Success/300'),
      error:    mapped(er(300), 'VariableID:mapped/icon/error',    S, 'Error/300'),
      warning:  mapped(w(300),  'VariableID:mapped/icon/warning',  S, 'Warning/300'),
    },

    Effects: {
      'glow-primary-light':    mapped(b(200), 'VariableID:mapped/effects/glow-primary-light',    E, 'Primary/200'),
      'glow-primary-dark':     mapped(b(400), 'VariableID:mapped/effects/glow-primary-dark',     E, 'Primary/400'),
      'outline-primary-dark':  mapped(b(400), 'VariableID:mapped/effects/outline-primary-dark',  E, 'Primary/400'),
      'outline-primary-light': mapped(b(300), 'VariableID:mapped/effects/outline-primary-light', E, 'Primary/300'),
      'outline-gray':          mapped(n(600), 'VariableID:mapped/effects/outline-gray',          E, 'Neutral/600'),
    },

    'Borders & Dividers': {
      primary:          mapped(b(300),  'VariableID:mapped/borders/primary',         K, 'Primary/300'),
      'primary-hover':  mapped(b(200),  'VariableID:mapped/borders/primary-hover',   K, 'Primary/200'),
      default:          mapped(n(600),  'VariableID:mapped/borders/default',         K, 'Neutral/600'),
      disabled:         mapped(n(600),  'VariableID:mapped/borders/disabled',        K, 'Neutral/600'),
      hover:            mapped(n(400),  'VariableID:mapped/borders/hover',           K, 'Neutral/400'),
      info:             mapped(inf(300),'VariableID:mapped/borders/info',            K, 'Info/300'),
      success:          mapped(sc(300), 'VariableID:mapped/borders/success',         K, 'Success/300'),
      error:            mapped(er(300), 'VariableID:mapped/borders/error',           K, 'Error/300'),
      highlight:        mapped(w(100),  'VariableID:mapped/borders/highlight',       K, 'Warning/100'),
    },

    $extensions: { 'com.figma.modeName': 'Mode 1' },
  };
}
