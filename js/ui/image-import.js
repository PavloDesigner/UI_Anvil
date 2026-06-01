/* Extract dominant colors from an image and apply to palette inputs */

import { getState, setPaletteInput, setShowSecondaryBrand, setShowTertiaryBrand } from '../state.js';
import { rgbToHex, rgbToHsl } from '../color.js';
import { showToast } from './toast.js';

let _extracted = [];      // [{ hex, rgb, pop }]
let _assignment = null;   // { brand, brand2, brand3, neutral }
let _open = false;

/* ─── Init ─── */
export function initImageImport() {
  const openBtn   = document.getElementById('image-import-btn');
  const overlay   = document.getElementById('img-overlay');
  const closeBtn  = document.getElementById('img-close');
  const fileInput = document.getElementById('img-file-input');
  const dropZone  = document.getElementById('img-dropzone');
  const applyBtn  = document.getElementById('img-apply-btn');

  openBtn?.addEventListener('click', _open_);
  closeBtn?.addEventListener('click', _close_);
  overlay?.addEventListener('click', e => { if (e.target === overlay) _close_(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && _open) _close_(); });

  /* Browse to pick a file */
  dropZone?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) _handleFile(file);
    fileInput.value = '';
  });

  /* Drag/drop inside the panel */
  ['dragenter', 'dragover'].forEach(ev =>
    dropZone?.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add('img-dropzone--active'); }));
  ['dragleave', 'drop'].forEach(ev =>
    dropZone?.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.remove('img-dropzone--active'); }));
  dropZone?.addEventListener('drop', e => {
    const file = e.dataTransfer?.files?.[0];
    if (file) _handleFile(file);
  });

  applyBtn?.addEventListener('click', _applyAssignment);

  /* "Choose another" reuses the same hidden file input */
  document.getElementById('img-change-btn')?.addEventListener('click', () => fileInput?.click());

  /* Global drag-drop — drop an image anywhere on the app to open the panel */
  _initGlobalDrop();
}

function _open_() {
  _open = true;
  document.getElementById('img-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  _renderEmpty();
}

function _close_() {
  _open = false;
  document.getElementById('img-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

/* ─── Global drag-and-drop overlay ─── */
function _initGlobalDrop() {
  const hint = document.getElementById('global-drop-hint');
  let dragDepth = 0;

  const isImageDrag = e =>
    Array.from(e.dataTransfer?.types || []).includes('Files');

  window.addEventListener('dragenter', e => {
    if (!isImageDrag(e)) return;
    e.preventDefault();
    dragDepth++;
    if (hint) hint.style.display = 'flex';
  });
  window.addEventListener('dragover', e => {
    if (isImageDrag(e)) e.preventDefault();
  });
  window.addEventListener('dragleave', e => {
    if (!isImageDrag(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0 && hint) hint.style.display = 'none';
  });
  window.addEventListener('drop', e => {
    dragDepth = 0;
    if (hint) hint.style.display = 'none';
    if (!isImageDrag(e)) return;
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      _open_();
      _handleFile(file);
    }
  });
}

/* ─── File → image → extraction ─── */
function _handleFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Please drop an image file');
    return;
  }
  if (!_open) _open_();

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    try {
      _extracted = _extractColors(img, 8);
      _assignment = _autoAssign(_extracted);
      // Build a persistent data-URL thumbnail so it survives the object-URL revoke
      _renderResult(_thumbDataUrl(img));
    } catch (err) {
      showToast('Could not read image colors');
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  img.onerror = () => { showToast('Could not load image'); URL.revokeObjectURL(url); };
  img.src = url;
}

/* Small square data-URL thumbnail from a loaded image (cover-cropped) */
function _thumbDataUrl(img, size = 96) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const s = Math.min(img.width, img.height);
  const sx = (img.width - s) / 2, sy = (img.height - s) / 2;
  ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
  try { return canvas.toDataURL('image/png'); } catch { return ''; }
}

/* ─── Color extraction (median cut) ─── */
function _extractColors(img, count) {
  /* Downscale to ≤100px for speed */
  const maxDim = 100;
  const scale  = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width  * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);

  const data = ctx.getImageData(0, 0, w, h).data;
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 125) continue;                       // skip transparent
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // skip near-pure white/black (usually background/edges) for cleaner buckets
    if (r > 248 && g > 248 && b > 248) continue;
    if (r < 8 && g < 8 && b < 8) continue;
    pixels.push([r, g, b]);
  }
  if (!pixels.length) return [];

  /* Median-cut into `count` buckets */
  let buckets = [pixels];
  while (buckets.length < count) {
    let maxRange = -1, maxIdx = -1, maxCh = 0;
    buckets.forEach((bucket, bi) => {
      if (bucket.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let lo = 255, hi = 0;
        for (const p of bucket) { if (p[c] < lo) lo = p[c]; if (p[c] > hi) hi = p[c]; }
        const range = hi - lo;
        if (range > maxRange) { maxRange = range; maxIdx = bi; maxCh = c; }
      }
    });
    if (maxIdx < 0 || maxRange <= 0) break;
    const bucket = buckets[maxIdx];
    bucket.sort((a, b) => a[maxCh] - b[maxCh]);
    const mid = bucket.length >> 1;
    buckets.splice(maxIdx, 1, bucket.slice(0, mid), bucket.slice(mid));
  }

  /* Average each bucket → representative color */
  let colors = buckets.map(bucket => {
    let sr = 0, sg = 0, sb = 0;
    for (const p of bucket) { sr += p[0]; sg += p[1]; sb += p[2]; }
    const n = bucket.length;
    const rgb = { r: Math.round(sr / n), g: Math.round(sg / n), b: Math.round(sb / n) };
    return { rgb, hex: rgbToHex(rgb), pop: n };
  });

  /* Drop near-duplicates (within small RGB distance) */
  colors = _dedupe(colors).sort((a, b) => b.pop - a.pop);
  return colors;
}

function _dedupe(colors, minDist = 24) {
  const out = [];
  for (const c of colors) {
    const dup = out.find(o =>
      Math.abs(o.rgb.r - c.rgb.r) + Math.abs(o.rgb.g - c.rgb.g) + Math.abs(o.rgb.b - c.rgb.b) < minDist);
    if (dup) { dup.pop += c.pop; continue; }
    out.push({ ...c });
  }
  return out;
}

/* ─── Auto-assign extracted colors to palette roles ─── */
function _vibrance(rgb) {
  const { s, l } = rgbToHsl(rgb);
  // Reward saturation; penalise extreme lightness
  return s * (1 - Math.abs(l - 55) / 60);
}

function _autoAssign(colors) {
  if (!colors.length) return null;

  const scored = colors.map(c => ({ ...c, hsl: rgbToHsl(c.rgb), vib: _vibrance(c.rgb) }));

  /* Neutral = lowest saturation */
  const neutral = [...scored].sort((a, b) => a.hsl.s - b.hsl.s)[0];

  /* Brand candidates = most vibrant, excluding the neutral pick */
  const vivid = scored.filter(c => c !== neutral).sort((a, b) => b.vib - a.vib);

  const chosen = [];
  const hueFarEnough = (h) =>
    chosen.every(c => {
      let d = Math.abs(c.hsl.h - h);
      if (d > 180) d = 360 - d;
      return d > 24;
    });

  for (const c of vivid) {
    if (chosen.length >= 3) break;
    if (hueFarEnough(c.hsl.h)) chosen.push(c);
  }
  // Backfill if not enough distinct hues
  for (const c of vivid) {
    if (chosen.length >= 3) break;
    if (!chosen.includes(c)) chosen.push(c);
  }

  return {
    brand:   chosen[0]?.hex || colors[0].hex,
    brand2:  chosen[1]?.hex || null,
    brand3:  chosen[2]?.hex || null,
    neutral: neutral?.hex   || null,
  };
}

/* ─── Render ─── */
function _renderEmpty() {
  const result = document.getElementById('img-result');
  if (result) result.style.display = 'none';
  const dz = document.getElementById('img-dropzone');
  if (dz) dz.style.display = 'flex';
}

function _renderResult(thumbUrl) {
  const dz     = document.getElementById('img-dropzone');
  const result = document.getElementById('img-result');
  const thumb  = document.getElementById('img-thumb');
  const swRow  = document.getElementById('img-swatches');
  const slots  = document.getElementById('img-slots');
  if (!result) return;

  if (dz) dz.style.display = 'none';
  result.style.display = 'block';
  if (thumb) thumb.style.backgroundImage = `url('${thumbUrl}')`;

  /* Extracted swatch row — click sets as Primary */
  if (swRow) {
    swRow.innerHTML = _extracted.map(c =>
      `<button class="img-swatch" style="background:${c.hex}" data-hex="${c.hex}"
               title="${c.hex} — click to set as Primary">
         <span class="img-swatch-hex">${c.hex.toUpperCase()}</span>
       </button>`
    ).join('');
    swRow.querySelectorAll('.img-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        _assignment = { ..._assignment, brand: btn.dataset.hex };
        _renderSlots();
        showToast('Primary set — review and Apply');
      });
    });
  }

  _renderSlots();
}

function _renderSlots() {
  const slots = document.getElementById('img-slots');
  if (!slots || !_assignment) return;
  const rows = [
    { key: 'brand',   label: 'Primary'   },
    { key: 'brand2',  label: 'Secondary' },
    { key: 'brand3',  label: 'Tertiary'  },
    { key: 'neutral', label: 'Neutral'   },
  ];
  slots.innerHTML = rows.map(r => {
    const hex = _assignment[r.key];
    return `
      <div class="img-slot">
        <span class="img-slot-sw" style="background:${hex || 'transparent'};
              ${hex ? '' : 'border:1px dashed oklch(35% 0.01 265)'}"></span>
        <span class="img-slot-label">${r.label}</span>
        <span class="img-slot-hex">${hex ? hex.toUpperCase() : '—'}</span>
      </div>`;
  }).join('');
}

/* ─── Apply ─── */
function _applyAssignment() {
  if (!_assignment) return;
  const { brand, brand2, brand3, neutral } = _assignment;

  if (brand)   _setInput('brand',   brand);
  if (neutral) _setInput('neutral', neutral);

  if (brand2) {
    setShowSecondaryBrand(true);
    _setInput('brand2', brand2);
  }
  if (brand3) {
    setShowTertiaryBrand(true);
    _setInput('brand3', brand3);
  }

  // Sync sidebar visibility for secondary/tertiary rows
  _syncBrandRows();

  showToast('Palette applied from image');
  _close_();
}

function _setInput(name, hex) {
  setPaletteInput(name, hex);
  const hexIn  = document.getElementById(`hex-${name}`);
  const picker = document.getElementById(`picker-${name}`);
  const swatch = document.getElementById(`swatch-preview-${name}`);
  if (hexIn)  hexIn.value  = hex;
  if (picker) picker.value = hex;
  if (swatch) swatch.style.background = hex;
}

function _syncBrandRows() {
  const state = getState();
  const secRow  = document.getElementById('brand-secondary-row');
  const tertRow = document.getElementById('brand-tertiary-row');
  const addSec  = document.getElementById('add-secondary-btn');
  const addTert = document.getElementById('add-tertiary-btn');
  if (secRow)  secRow.style.display  = state.showSecondaryBrand ? '' : 'none';
  if (tertRow) tertRow.style.display = state.showTertiaryBrand  ? '' : 'none';
  if (addSec)  addSec.style.display  = state.showSecondaryBrand ? 'none' : '';
  if (addTert) addTert.style.display = state.showSecondaryBrand && !state.showTertiaryBrand ? '' : 'none';
}
