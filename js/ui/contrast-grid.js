/* Contrast Grid — WCAG 2 & APCA, all palettes combined */

import { getState, getStepLabels, subscribe } from '../state.js';

/* ─── State ─── */
let _mode      = 'wcag2';
let _threshold = 4.5;
let _palette   = 'all';   // 'all' or a specific palette id
let _open      = false;

/* ─── Palette metadata ─── */
const PALETTE_META = [
  { id: 'brand',   abbr: 'P',  label: 'Primary'   },
  { id: 'brand2',  abbr: 'S',  label: 'Secondary', conditional: 'showSecondaryBrand' },
  { id: 'brand3',  abbr: 'T',  label: 'Tertiary',  conditional: 'showTertiaryBrand'  },
  { id: 'neutral', abbr: 'N',  label: 'Neutral'   },
  { id: 'success', abbr: 'Su', label: 'Success'   },
  { id: 'warning', abbr: 'W',  label: 'Warning'   },
  { id: 'info',    abbr: 'In', label: 'Info'      },
  { id: 'error',   abbr: 'E',  label: 'Error'     },
];

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

/** APCA-W3 0.0.98G — absolute Lc */
function apca(fgHex, bgHex) {
  const [tr, tg, tb] = _hexToRgb(fgHex);
  const [br, bg, bb] = _hexToRgb(bgHex);
  const Ytxt = 0.2126729*_linearize(tr) + 0.7151522*_linearize(tg) + 0.0721750*_linearize(tb);
  const Ybg  = 0.2126729*_linearize(br) + 0.7151522*_linearize(bg) + 0.0721750*_linearize(bb);
  const dMin = 0.0005, scl = 1.14, lo = 0.022, loOff = 0.027, loClip = 0.1;
  const tL  = Ytxt > dMin ? Math.pow(Ytxt, 0.57) : Ytxt/12.82051+lo;
  const bL  = Ybg  > dMin ? Math.pow(Ybg,  0.56) : Ybg /12.82051+lo;
  const tLR = Ytxt > dMin ? Math.pow(Ytxt, 0.62) : Ytxt/12.82051+lo;
  const bLR = Ybg  > dMin ? Math.pow(Ybg,  0.65) : Ybg /12.82051+lo;
  let S;
  if (Ybg >= Ytxt) { S = (bL  - tL)  * scl; if (S < loClip) return 0; return (S - loOff)*100; }
  else             { S = (bLR - tLR) * scl; if (S > -loClip) return 0; return (S + loOff)*100; }
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
    { value: 15, label: '15+', desc: 'Decorative / non-text elements' },
    { value: 30, label: '30+', desc: 'Large bold UI elements'          },
    { value: 45, label: '45+', desc: 'Large body text (18px+ bold)'    },
    { value: 60, label: '60+', desc: 'Small text · UI elements'        },
    { value: 75, label: '75+', desc: 'Body text (14px+)'              },
    { value: 90, label: '90+', desc: 'Fluent body reading'             },
    { value: 0,  label: 'All', desc: 'Show all color combinations'     },
  ],
};
const DEFAULT_THRESHOLD = { wcag2: 4.5, apca: 60 };

/* ─── Build the flat colour list for the current view ─── */
function _buildColorList(state) {
  const theme = state.theme;
  const labels = getStepLabels(state.steps);

  if (_palette !== 'all') {
    const p = state.palettes[_palette];
    const scale = (p?.scale[theme] || p?.scale.light || []);
    return scale.map((hex, i) => ({ hex, label: labels[i], palId: _palette }));
  }

  // 'all' — flatten every active palette
  const activeMeta = PALETTE_META.filter(m =>
    !m.conditional || state[m.conditional]
  );

  const colors = [];
  activeMeta.forEach(({ id, abbr }) => {
    const p = state.palettes[id];
    const scale = p?.scale[theme] || p?.scale.light || [];
    scale.forEach((hex, i) => {
      colors.push({ hex, label: `${abbr}·${labels[i]}`, palId: id, abbr });
    });
  });
  return colors;
}

/* ─── Init ─── */
export function initContrastGrid() {
  const openBtn = document.getElementById('contrast-btn');
  const closeBtn= document.getElementById('cg-close');
  const overlay = document.getElementById('cg-overlay');

  openBtn?.addEventListener('click',  _open_);
  closeBtn?.addEventListener('click', _close_);
  overlay?.addEventListener('click',  e => { if (e.target === overlay) _close_(); });
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

/* ─── Render ─── */
function _render() {
  _renderModeBtns();
  _renderThresholdBtns();
  _renderPaletteTabs();
  _renderGrid();
}

function _renderModeBtns() {
  document.querySelectorAll('.cg-mode-btn').forEach(btn => {
    btn.classList.toggle('cg-mode-btn--active', btn.dataset.mode === _mode);
    btn.onclick = () => {
      _mode = btn.dataset.mode;
      _threshold = DEFAULT_THRESHOLD[_mode];
      _render();
    };
  });
}

function _renderThresholdBtns() {
  const wrap    = document.getElementById('cg-thresholds');
  const desc    = document.getElementById('cg-threshold-desc');
  const labelEl = document.getElementById('cg-threshold-label');
  if (!wrap) return;

  const list = THRESHOLDS[_mode];
  if (!list.some(t => t.value === _threshold)) _threshold = DEFAULT_THRESHOLD[_mode];
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
  const active = list.find(t => t.value === _threshold);
  if (desc && active) desc.textContent = active.desc;
}

function _renderPaletteTabs() {
  const wrap  = document.getElementById('cg-palette-tabs');
  if (!wrap) return;
  const state = getState();

  const options = [
    { id: 'all', label: 'All' },
    ...PALETTE_META
      .filter(m => !m.conditional || state[m.conditional])
      .map(m => ({ id: m.id, label: m.label })),
  ];

  if (!options.find(p => p.id === _palette)) _palette = 'all';

  wrap.innerHTML = options.map(p =>
    `<button class="cg-pal-btn${p.id === _palette ? ' cg-pal-btn--active' : ''}"
             data-pal="${p.id}">${p.label}</button>`
  ).join('');

  wrap.querySelectorAll('.cg-pal-btn').forEach(btn => {
    btn.onclick = () => { _palette = btn.dataset.pal; _renderPaletteTabs(); _renderGrid(); };
  });
}

function _renderGrid() {
  const container = document.getElementById('cg-grid-wrap');
  if (!container) return;

  const state  = getState();
  const colors = _buildColorList(state);

  if (!colors.length) {
    container.innerHTML = '<div class="cg-empty">No colors to compare.</div>';
    return;
  }

  const getVal = _mode === 'wcag2'
    ? (fg, bg) => wcag2(fg.hex, bg.hex)
    : (fg, bg) => Math.abs(apca(fg.hex, bg.hex));
  const passes = v => _threshold === 0 || v >= _threshold;
  const fmt    = v => _mode === 'wcag2' ? v.toFixed(1) : Math.round(v).toString();

  const n        = colors.length;
  const cellSize = Math.max(20, Math.min(36, Math.floor(560 / (n + 1))));

  let html = `<div class="cg-grid" style="--n:${n};--cs:${cellSize}px">`;

  /* Header row */
  html += '<div class="cg-row cg-row--header">';
  html += '<div class="cg-corner"></div>';
  colors.forEach(c => {
    html += `<div class="cg-head-cell" title="${c.label} · ${c.hex}">
      <div class="cg-swatch" style="background:${c.hex}"></div>
      <span>${c.label}</span>
    </div>`;
  });
  html += '</div>';

  /* Data rows */
  let total = 0, passing = 0;
  colors.forEach((fgC, fi) => {
    html += '<div class="cg-row">';
    html += `<div class="cg-side-cell" title="${fgC.label} · ${fgC.hex}">
      <div class="cg-swatch" style="background:${fgC.hex}"></div>
      <span>${fgC.label}</span>
    </div>`;

    colors.forEach((bgC, bi) => {
      if (fi === bi) {
        html += `<div class="cg-cell cg-cell--self" style="background:${bgC.hex}"></div>`;
        return;
      }
      const val = getVal(fgC, bgC);
      const ok  = passes(val);
      total++;
      if (ok) {
        passing++;
        html += `<div class="cg-cell cg-cell--pass"
                   style="background:${bgC.hex};color:${fgC.hex}"
                   title="fg:${fgC.label} bg:${bgC.label} = ${fmt(val)}"
                   >${fmt(val)}</div>`;
      } else {
        html += `<div class="cg-cell cg-cell--fail"
                   style="background:${bgC.hex}"
                   title="fg:${fgC.label} bg:${bgC.label} = ${fmt(val)}"
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
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
