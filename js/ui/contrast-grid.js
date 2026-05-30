/* Contrast Grid — WCAG 2 & APCA side-by-side, no paywall */

import { getState, getStepLabels, subscribe } from '../state.js';

/* ─── State ─── */
let _mode      = 'wcag2';   // 'wcag2' | 'apca'
let _threshold = 4.5;        // WCAG 2 default
let _palette   = 'brand';
let _open      = false;

/* ─── Colour math ─── */
function _hexToRgb(hex) {
  const h = hex.replace('#', '').padEnd(6, '0');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function _linearize(v) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function _wcagLum([r, g, b]) {
  return 0.2126 * _linearize(r) + 0.7152 * _linearize(g) + 0.0722 * _linearize(b);
}

/** WCAG 2.1 contrast ratio (1–21) */
function wcag2(fgHex, bgHex) {
  const L1 = _wcagLum(_hexToRgb(fgHex));
  const L2 = _wcagLum(_hexToRgb(bgHex));
  const li = Math.max(L1, L2), da = Math.min(L1, L2);
  return (li + 0.05) / (da + 0.05);
}

/** APCA-W3 0.0.98G — returns signed Lc (-108..+106) */
function apca(fgHex, bgHex) {
  const [tr, tg, tb] = _hexToRgb(fgHex);
  const [br, bg, bb] = _hexToRgb(bgHex);

  const Ytxt = 0.2126729 * _linearize(tr) + 0.7151522 * _linearize(tg) + 0.0721750 * _linearize(tb);
  const Ybg  = 0.2126729 * _linearize(br) + 0.7151522 * _linearize(bg) + 0.0721750 * _linearize(bb);

  const dMin = 0.0005;
  const scl  = 1.14, lo = 0.022, loOff = 0.027, loClip = 0.1;

  const tLow  = Ytxt > dMin ? Math.pow(Ytxt, 0.57) : Ytxt / 12.82051 + lo;
  const bLow  = Ybg  > dMin ? Math.pow(Ybg,  0.56) : Ybg  / 12.82051 + lo;
  const tLowR = Ytxt > dMin ? Math.pow(Ytxt, 0.62) : Ytxt / 12.82051 + lo;
  const bLowR = Ybg  > dMin ? Math.pow(Ybg,  0.65) : Ybg  / 12.82051 + lo;

  let Sapc;
  if (Ybg >= Ytxt) {
    Sapc = (bLow - tLow) * scl;
    if (Sapc < loClip) return 0;
    return (Sapc - loOff) * 100;
  } else {
    Sapc = (bLowR - tLowR) * scl;
    if (Sapc > -loClip) return 0;
    return (Sapc + loOff) * 100;
  }
}

/* ─── Threshold definitions ─── */
const THRESHOLDS = {
  wcag2: [
    { value: 3,   label: '3+',   desc: 'AA · Large text & UI graphics' },
    { value: 4.5, label: '4.5+', desc: 'AA · Normal-size text' },
    { value: 7,   label: '7+',   desc: 'AAA · Enhanced contrast' },
    { value: 0,   label: 'All',  desc: 'Show all color combinations' },
  ],
  apca: [
    { value: 15, label: '15+', desc: 'Decorative / non-text' },
    { value: 30, label: '30+', desc: 'Large bold UI elements' },
    { value: 45, label: '45+', desc: 'Large body text (18px+ bold)' },
    { value: 60, label: '60+', desc: 'Small text · UI elements' },
    { value: 75, label: '75+', desc: 'Body text (14px+)' },
    { value: 90, label: '90+', desc: 'Fluent body reading' },
    { value: 0,  label: 'All', desc: 'Show all color combinations' },
  ],
};

const DEFAULT_THRESHOLD = { wcag2: 4.5, apca: 60 };

/* ─── Init ─── */
export function initContrastGrid() {
  const openBtn  = document.getElementById('contrast-btn');
  const closeBtn = document.getElementById('cg-close');
  const overlay  = document.getElementById('cg-overlay');

  openBtn?.addEventListener('click', _open_);
  closeBtn?.addEventListener('click', _close_);
  overlay?.addEventListener('click', e => { if (e.target === overlay) _close_(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && _open) _close_(); });

  subscribe('palette-change', () => { if (_open) _render(); });
  subscribe('theme-change',   () => { if (_open) _render(); });
  subscribe('init',           () => { if (_open) _render(); });
}

function _open_() {
  _open = true;
  const overlay = document.getElementById('cg-overlay');
  if (overlay) overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  _render();
}

function _close_() {
  _open = false;
  const overlay = document.getElementById('cg-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}

/* ─── Main render ─── */
function _render() {
  _renderSidebar();
  _renderGrid();
}

function _renderSidebar() {
  _renderModeBtns();
  _renderThresholdBtns();
  _renderPaletteTabs();
}

function _renderModeBtns() {
  document.querySelectorAll('.cg-mode-btn').forEach(btn => {
    btn.classList.toggle('cg-mode-btn--active', btn.dataset.mode === _mode);
  });
  // Wire click (idempotent via delegation — safe to re-run)
  document.querySelectorAll('.cg-mode-btn').forEach(btn => {
    btn.onclick = () => {
      _mode = btn.dataset.mode;
      _threshold = DEFAULT_THRESHOLD[_mode];
      _renderSidebar();
      _renderGrid();
    };
  });
}

function _renderThresholdBtns() {
  const wrap = document.getElementById('cg-thresholds');
  const desc = document.getElementById('cg-threshold-desc');
  const labelEl = document.getElementById('cg-threshold-label');
  if (!wrap) return;

  const list = THRESHOLDS[_mode];
  // Ensure threshold is valid for this mode
  if (!list.some(t => t.value === _threshold)) _threshold = DEFAULT_THRESHOLD[_mode];

  if (labelEl) labelEl.textContent = _mode === 'wcag2' ? 'Contrast ratio' : 'APCA Lc';

  wrap.innerHTML = list.map(t => `
    <button class="cg-thr-btn${t.value === _threshold ? ' cg-thr-btn--active' : ''}"
            data-value="${t.value}" data-desc="${_esc(t.desc)}">
      ${_esc(t.label)}
    </button>`).join('');

  wrap.querySelectorAll('.cg-thr-btn').forEach(btn => {
    btn.onclick = () => {
      _threshold = Number(btn.dataset.value);
      if (desc) desc.textContent = btn.dataset.desc;
      _renderThresholdBtns();
      _renderGrid();
    };
  });

  const active = list.find(t => t.value === _threshold);
  if (desc && active) desc.textContent = active.desc;
}

function _renderPaletteTabs() {
  const wrap = document.getElementById('cg-palette-tabs');
  if (!wrap) return;
  const state = getState();

  const palettes = [
    { id: 'brand',   label: 'Brand' },
    ...(state.showSecondaryBrand ? [{ id: 'brand2',  label: 'Secondary' }] : []),
    ...(state.showTertiaryBrand  ? [{ id: 'brand3',  label: 'Tertiary' }]  : []),
    { id: 'neutral', label: 'Neutral' },
    { id: 'success', label: 'Success' },
    { id: 'warning', label: 'Warning' },
    { id: 'info',    label: 'Info' },
    { id: 'error',   label: 'Error' },
  ];

  // If current _palette no longer exists, reset
  if (!palettes.find(p => p.id === _palette)) _palette = 'brand';

  wrap.innerHTML = palettes.map(p => `
    <button class="cg-pal-btn${p.id === _palette ? ' cg-pal-btn--active' : ''}"
            data-pal="${p.id}">${p.label}</button>`).join('');

  wrap.querySelectorAll('.cg-pal-btn').forEach(btn => {
    btn.onclick = () => {
      _palette = btn.dataset.pal;
      _renderPaletteTabs();
      _renderGrid();
    };
  });
}

function _renderGrid() {
  const container = document.getElementById('cg-grid-wrap');
  if (!container) return;

  const state   = getState();
  const palette = state.palettes[_palette];
  if (!palette) return;

  const theme  = state.theme;
  const scale  = palette.scale[theme] || palette.scale.light || [];
  const labels = getStepLabels(scale.length);

  if (!scale.length) {
    container.innerHTML = '<div class="cg-empty">No palette generated yet.</div>';
    return;
  }

  const n       = scale.length;
  const getVal  = _mode === 'wcag2'
    ? (fg, bg) => wcag2(fg, bg)
    : (fg, bg) => Math.abs(apca(fg, bg));
  const passes  = v => _threshold === 0 || v >= _threshold;
  const fmt     = v => _mode === 'wcag2' ? v.toFixed(1) : Math.round(v).toString();

  /* Build grid: top-left cell + header row + body rows */
  const cellSize = Math.max(28, Math.min(38, Math.floor((window.innerWidth * 0.65) / (n + 1))));

  let html = `<div class="cg-grid" style="--n:${n};--cs:${cellSize}px">`;

  /* ── Header row ── */
  html += '<div class="cg-row cg-row--header">';
  html += '<div class="cg-corner"></div>';
  scale.forEach((color, i) => {
    html += `<div class="cg-head-cell" title="${labels[i]} · ${color}">
      <div class="cg-swatch" style="background:${color}"></div>
      <span>${labels[i]}</span>
    </div>`;
  });
  html += '</div>';

  /* ── Data rows ── */
  scale.forEach((fgColor, fi) => {
    html += '<div class="cg-row">';

    /* Left label */
    html += `<div class="cg-side-cell" title="${labels[fi]} · ${fgColor}">
      <div class="cg-swatch" style="background:${fgColor}"></div>
      <span>${labels[fi]}</span>
    </div>`;

    /* Cells */
    scale.forEach((bgColor, bi) => {
      const val = getVal(fgColor, bgColor);
      const ok  = passes(val);
      if (fi === bi) {
        /* Same color — diagonal */
        html += `<div class="cg-cell cg-cell--self" style="background:${bgColor}"></div>`;
      } else if (ok) {
        html += `<div class="cg-cell cg-cell--pass"
                  style="background:${bgColor};color:${fgColor}"
                  title="fg:${labels[fi]} bg:${labels[bi]} = ${fmt(val)}"
                  >${fmt(val)}</div>`;
      } else {
        html += `<div class="cg-cell cg-cell--fail"
                  style="background:${bgColor}"
                  title="fg:${labels[fi]} bg:${labels[bi]} = ${fmt(val)}"
                  ></div>`;
      }
    });

    html += '</div>';
  });

  html += '</div>';

  /* Stats */
  let total = 0, passing = 0;
  scale.forEach(fg => scale.forEach(bg => {
    if (fg === bg) return;
    total++;
    if (passes(getVal(fg, bg))) passing++;
  }));
  const pct = total ? Math.round(passing / total * 100) : 0;

  html += `<div class="cg-stats">${passing} of ${total} pairs pass · ${pct}%</div>`;

  container.innerHTML = html;
}

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
