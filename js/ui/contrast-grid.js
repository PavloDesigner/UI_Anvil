/* Contrast Grid — pick fg palette × bg palette, check all step combinations */

import { getState, getStepLabels, subscribe } from '../state.js';

/* ─── State ─── */
let _mode      = 'wcag2';
let _threshold = 4.5;
let _fgPal     = 'brand';
let _bgPal     = 'neutral';
let _open      = false;

/* ─── Palette list ─── */
const PALETTE_META = [
  { id: 'brand',   label: 'Primary'   },
  { id: 'brand2',  label: 'Secondary', cond: 'showSecondaryBrand' },
  { id: 'brand3',  label: 'Tertiary',  cond: 'showTertiaryBrand'  },
  { id: 'neutral', label: 'Neutral'   },
  { id: 'success', label: 'Success'   },
  { id: 'warning', label: 'Warning'   },
  { id: 'info',    label: 'Info'      },
  { id: 'error',   label: 'Error'     },
];

/* ─── Colour math ─── */
function _hexToRgb(hex) {
  const h = hex.replace('#', '').padEnd(6, '0');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function _lin(v) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function _lum([r, g, b]) {
  return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b);
}

function wcag2(fg, bg) {
  const L1 = _lum(_hexToRgb(fg)), L2 = _lum(_hexToRgb(bg));
  const li = Math.max(L1, L2), da = Math.min(L1, L2);
  return (li + 0.05) / (da + 0.05);
}

function apca(fgHex, bgHex) {
  const [tr, tg, tb] = _hexToRgb(fgHex);
  const [br, bg, bb] = _hexToRgb(bgHex);
  const Yt = 0.2126729*_lin(tr) + 0.7151522*_lin(tg) + 0.0721750*_lin(tb);
  const Yb = 0.2126729*_lin(br) + 0.7151522*_lin(bg) + 0.0721750*_lin(bb);
  const dMin = 0.0005, scl = 1.14, lo = 0.022, loOff = 0.027, loClip = 0.1;
  const tL  = Yt > dMin ? Math.pow(Yt, 0.57) : Yt/12.82051+lo;
  const bL  = Yb > dMin ? Math.pow(Yb, 0.56) : Yb/12.82051+lo;
  const tLR = Yt > dMin ? Math.pow(Yt, 0.62) : Yt/12.82051+lo;
  const bLR = Yb > dMin ? Math.pow(Yb, 0.65) : Yb/12.82051+lo;
  let S;
  if (Yb >= Yt) { S = (bL-tL)*scl;  if (S < loClip)  return 0; return (S-loOff)*100; }
  else           { S = (bLR-tLR)*scl; if (S > -loClip) return 0; return (S+loOff)*100; }
}

/* ─── Thresholds ─── */
const THRESHOLDS = {
  wcag2: [
    { value: 3,   label: '3+',   desc: 'AA · Large text & UI graphics'  },
    { value: 4.5, label: '4.5+', desc: 'AA · Normal-size text'           },
    { value: 7,   label: '7+',   desc: 'AAA · Enhanced contrast'         },
    { value: 0,   label: 'All',  desc: 'Show all color combinations'     },
  ],
  apca: [
    { value: 15, label: '15+', desc: 'Decorative / non-text elements'  },
    { value: 30, label: '30+', desc: 'Large bold UI elements'           },
    { value: 45, label: '45+', desc: 'Large body text (18px+ bold)'     },
    { value: 60, label: '60+', desc: 'Small text · UI elements'         },
    { value: 75, label: '75+', desc: 'Body text (14px+)'               },
    { value: 90, label: '90+', desc: 'Fluent body reading'              },
    { value: 0,  label: 'All', desc: 'Show all color combinations'      },
  ],
};
const DEFAULT_THR = { wcag2: 4.5, apca: 60 };

/* ─── Init ─── */
export function initContrastGrid() {
  document.getElementById('contrast-btn')?.addEventListener('click',  _open_);
  document.getElementById('cg-close')?.addEventListener('click',     _close_);
  document.getElementById('cg-overlay')?.addEventListener('click',   e => {
    if (e.target === document.getElementById('cg-overlay')) _close_();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && _open) _close_(); });
  subscribe('palette-change', () => { if (_open) _render(); });
  subscribe('theme-change',   () => { if (_open) _render(); });
  subscribe('init',           () => { if (_open) _render(); });
}

function _open_() {
  _open = true;
  document.getElementById('cg-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  _render();
}

function _close_() {
  _open = false;
  document.getElementById('cg-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

/* ─── Render ─── */
function _render() {
  _renderPairSelectors();
  _renderModeBtns();
  _renderThresholdBtns();
  _renderGrid();
}

/* Fg / Bg palette selectors */
function _renderPairSelectors() {
  const state = getState();
  const options = PALETTE_META.filter(m => !m.cond || state[m.cond]);

  // Guard: if active palette was removed, fallback
  if (!options.find(p => p.id === _fgPal)) _fgPal = options[0]?.id || 'brand';
  if (!options.find(p => p.id === _bgPal)) _bgPal = options[1]?.id || 'neutral';

  _buildTabRow('cg-fg-tabs', options, _fgPal, id => { _fgPal = id; _renderGrid(); _renderPairSelectors(); });
  _buildTabRow('cg-bg-tabs', options, _bgPal, id => { _bgPal = id; _renderGrid(); _renderPairSelectors(); });
}

function _buildTabRow(wrId, options, active, onSelect) {
  const wrap = document.getElementById(wrId);
  if (!wrap) return;
  wrap.innerHTML = options.map(p =>
    `<button class="cg-pal-btn${p.id === active ? ' cg-pal-btn--active' : ''}"
             data-pal="${p.id}">${p.label}</button>`
  ).join('');
  wrap.querySelectorAll('.cg-pal-btn').forEach(btn => {
    btn.onclick = () => onSelect(btn.dataset.pal);
  });
}

function _renderModeBtns() {
  document.querySelectorAll('.cg-mode-btn').forEach(btn => {
    btn.classList.toggle('cg-mode-btn--active', btn.dataset.mode === _mode);
    btn.onclick = () => {
      _mode = btn.dataset.mode;
      _threshold = DEFAULT_THR[_mode];
      _renderModeBtns();
      _renderThresholdBtns();
      _renderGrid();
    };
  });
}

function _renderThresholdBtns() {
  const wrap    = document.getElementById('cg-thresholds');
  const desc    = document.getElementById('cg-threshold-desc');
  const labelEl = document.getElementById('cg-threshold-label');
  if (!wrap) return;

  const list = THRESHOLDS[_mode];
  if (!list.some(t => t.value === _threshold)) _threshold = DEFAULT_THR[_mode];
  if (labelEl) labelEl.textContent = _mode === 'wcag2' ? 'Contrast ratio' : 'APCA Lc';

  wrap.innerHTML = list.map(t =>
    `<button class="cg-thr-btn${t.value === _threshold ? ' cg-thr-btn--active' : ''}"
             data-value="${t.value}" data-desc="${_esc(t.desc)}">${_esc(t.label)}</button>`
  ).join('');

  wrap.querySelectorAll('.cg-thr-btn').forEach(btn => {
    btn.onclick = () => {
      _threshold = Number(btn.dataset.value);
      if (desc) desc.textContent = btn.dataset.desc;
      _renderThresholdBtns();
      _renderGrid();
    };
  });
  const act = list.find(t => t.value === _threshold);
  if (desc && act) desc.textContent = act.desc;
}

function _renderGrid() {
  const container = document.getElementById('cg-grid-wrap');
  if (!container) return;

  const state  = getState();
  const theme  = state.theme;
  const labels = getStepLabels(state.steps);

  const fgPalette = state.palettes[_fgPal];
  const bgPalette = state.palettes[_bgPal];
  if (!fgPalette || !bgPalette) return;

  const fgScale = fgPalette.scale[theme] || fgPalette.scale.light || [];
  const bgScale = bgPalette.scale[theme] || bgPalette.scale.light || [];

  if (!fgScale.length || !bgScale.length) {
    container.innerHTML = '<div class="cg-empty">No colors to compare.</div>';
    return;
  }

  const getVal = _mode === 'wcag2'
    ? (fg, bg) => wcag2(fg, bg)
    : (fg, bg) => Math.abs(apca(fg, bg));
  const passes = v => _threshold === 0 || v >= _threshold;
  const fmt    = v => _mode === 'wcag2' ? v.toFixed(1) : Math.round(v).toString();

  // Cell size: fill available width comfortably
  const nCols    = bgScale.length;
  const cellSize = Math.max(24, Math.min(42, Math.floor(520 / (nCols + 1))));

  let html = `<div class="cg-grid" style="--cs:${cellSize}px">`;

  /* Header row — background palette */
  html += '<div class="cg-row cg-row--header">';
  html += '<div class="cg-corner"></div>';
  bgScale.forEach((hex, i) => {
    html += `<div class="cg-head-cell" title="${labels[i]} · ${hex}">
      <div class="cg-swatch" style="background:${hex}"></div>
      <span>${labels[i]}</span>
    </div>`;
  });
  html += '</div>';

  /* Data rows — foreground palette */
  let total = 0, passing = 0;
  fgScale.forEach((fgHex, fi) => {
    html += '<div class="cg-row">';
    html += `<div class="cg-side-cell" title="${labels[fi]} · ${fgHex}">
      <div class="cg-swatch" style="background:${fgHex}"></div>
      <span>${labels[fi]}</span>
    </div>`;

    bgScale.forEach((bgHex, bi) => {
      total++;
      if (fgHex.toLowerCase() === bgHex.toLowerCase()) {
        html += `<div class="cg-cell cg-cell--self" style="background:${bgHex}"></div>`;
        return;
      }
      const val = getVal(fgHex, bgHex);
      const ok  = passes(val);
      if (ok) {
        passing++;
        html += `<div class="cg-cell cg-cell--pass"
                   style="background:${bgHex};color:${fgHex}"
                   title="fg:${labels[fi]} bg:${labels[bi]} = ${fmt(val)}"
                   >${fmt(val)}</div>`;
      } else {
        html += `<div class="cg-cell cg-cell--fail"
                   style="background:${bgHex}"
                   title="fg:${labels[fi]} bg:${labels[bi]} = ${fmt(val)}"
                   ></div>`;
      }
    });

    html += '</div>';
  });

  html += '</div>';
  const pct = total ? Math.round(passing / total * 100) : 0;
  html += `<div class="cg-stats">${passing} of ${total} pairs pass (${pct}%)</div>`;

  container.innerHTML = html;
}

function _esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
