/* Swatch strip renderer */

import { getState, getStepLabels, subscribe, setFocusedPalette } from '../state.js';
import { formatColor } from '../color.js';
import { copyToClipboard } from '../utils.js';
import { showToast } from './toast.js';
import { showTooltip, hideTooltip } from './tooltip.js';
import { ROLES } from '../generators/radix.js';

let stripEl;

export function initSwatches() {
  stripEl = document.getElementById('swatch-strip');

  // Palette selector buttons
  document.querySelectorAll('.strip-palette-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.strip-palette-btn').forEach(b => b.classList.remove('strip-palette-btn--active'));
      btn.classList.add('strip-palette-btn--active');
      setFocusedPalette(btn.dataset.palette);
      renderStrip();
    });
  });

  subscribe('palette-change', renderStrip);
  subscribe('format-change', renderStrip);
  subscribe('theme-change', renderStrip);
  subscribe('focus-change', renderStrip);
  subscribe('init', renderStrip);

  renderStrip();
}

function renderStrip() {
  if (!stripEl) return;
  const state = getState();
  const { focusedPalette, palettes, steps, format, theme, method } = state;
  const palette = palettes[focusedPalette];
  if (!palette) return;

  const scale = palette.scale[theme] || palette.scale.light || [];
  const labels = getStepLabels(steps);

  // Find "active" step closest to input color
  const inputLower = palette.input.toLowerCase();
  let activeIdx = -1;

  // 1 — exact hex match
  for (let i = 0; i < scale.length; i++) {
    if (scale[i].toLowerCase() === inputLower) { activeIdx = i; break; }
  }

  // 2 — closest by relative luminance
  if (activeIdx === -1) {
    const inputLum = _lum(_rgb(palette.input));
    let minDist = Infinity;
    for (let i = 0; i < scale.length; i++) {
      const d = Math.abs(_lum(_rgb(scale[i])) - inputLum);
      if (d < minDist) { minDist = d; activeIdx = i; }
    }
  }

  if (activeIdx === -1) activeIdx = Math.floor(steps / 2);

  stripEl.innerHTML = '';

  scale.forEach((hex, i) => {
    const btn = document.createElement('button');
    btn.className = 'swatch' + (i === activeIdx ? ' swatch--active' : '');
    btn.setAttribute('role', 'listitem');
    btn.setAttribute('aria-label', `${focusedPalette} ${labels[i]}, ${hex}, click to copy`);

    const colorDiv = document.createElement('div');
    colorDiv.className = 'swatch-color';
    colorDiv.style.backgroundColor = hex;
    colorDiv.style.color = needsLightText(hex) ? '#fff' : '#000';

    const stepDiv = document.createElement('div');
    stepDiv.className = 'swatch-step';
    stepDiv.textContent = labels[i];

    const valDiv = document.createElement('div');
    valDiv.className = 'swatch-value';
    valDiv.textContent = formatColor(hex, format);

    btn.appendChild(colorDiv);
    btn.appendChild(stepDiv);
    btn.appendChild(valDiv);

    // Hex tooltip — shown for all methods; Radix also appends the semantic role
    const formatted   = formatColor(hex, format);
    const tooltipText = method === 'radix' && ROLES[i]
      ? `${formatted}  ·  ${ROLES[i]}`
      : formatted;

    btn.addEventListener('mouseenter', () => showTooltip(btn, tooltipText, hex));
    btn.addEventListener('mouseleave', hideTooltip);
    btn.addEventListener('focus',      () => showTooltip(btn, tooltipText, hex));
    btn.addEventListener('blur',       hideTooltip);

    btn.addEventListener('click', async () => {
      const val = formatColor(hex, format);
      await copyToClipboard(val);
      showToast(`Copied ${val}`);
    });

    btn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
    });

    stripEl.appendChild(btn);
  });
}

/* ─── Colour helpers ─── */
function _rgb(hex) {
  const h = hex.replace('#', '').padEnd(6, '0');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function _lum({ r, g, b }) {
  const lin = v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function needsLightText(hex) { return _lum(_rgb(hex)) < 0.35; }

