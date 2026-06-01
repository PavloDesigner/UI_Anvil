/* My Palettes view — save, load, rename, delete */

import { icon } from '../icons.js';
import { getAll, addPalette, removePalette, renamePalette } from '../saved-palettes.js';
import {
  getState, setMethod, setSteps, setTheme, setFormat, setHarmony,
  setShowSecondaryBrand, setShowTertiaryBrand, setPaletteInput,
} from '../state.js';
import { showToast } from './toast.js';
import { showTooltip, hideTooltip, flashCopied } from './tooltip.js';
import { copyToClipboard } from '../utils.js';

const METHOD_LABELS = {
  tailwind:         'Tailwind',
  apca:             'APCA',
  radix:            'Radix',
  oklch:            'OKLCH',
  material:         'Material 3',
  accessible:       'Accessible',
  'neutral-tinted': 'Neutral Tinted',
  'split-tone':     'Split-Tone',
  p3:               'P3 Wide Gamut',
  cam16:            'CAM16',
  duotone:          'Duotone',
};

/* Callbacks injected by main.js */
let _navigateToGenerate = () => {};
let _syncSidebarState   = () => {};

export function initMyPalettes(opts = {}) {
  _navigateToGenerate = opts.onNavigateToGenerate || (() => {});
  _syncSidebarState   = opts.onSyncState          || (() => {});

  document.getElementById('mp-save-btn')?.addEventListener('click', handleSave);

  // Hex tooltip on preview swatches — event delegation on the grid container
  const grid = document.getElementById('mp-grid');
  if (grid) {
    grid.addEventListener('mouseover', e => {
      const swatch = e.target.closest('.mp-swatch');
      if (!swatch) return;
      const hex = swatch.dataset.color;
      if (hex) showTooltip(swatch, hex, hex);
    });
    grid.addEventListener('mouseout', e => {
      if (e.target.closest('.mp-swatch')) hideTooltip();
    });
    /* Click a preview swatch to copy its color */
    grid.addEventListener('click', async e => {
      const swatch = e.target.closest('.mp-swatch');
      if (!swatch) return;
      const hex = swatch.dataset.color;
      if (!hex) return;
      await copyToClipboard(hex.toUpperCase());
      flashCopied(hex);
      showToast(`Copied ${hex.toUpperCase()}`);
    });
  }
}

/* Render the full grid from localStorage */
export function renderMyPalettes() {
  const grid  = document.getElementById('mp-grid');
  const empty = document.getElementById('mp-empty');
  const count = document.getElementById('mp-count');
  if (!grid) return;

  const list = getAll();

  if (count) _updateCount(count, list.length);

  // Remove existing real cards (keep any pending new-card forms)
  grid.querySelectorAll('.mp-card:not(.mp-card--new)').forEach(c => c.remove());

  const hasCards = list.length > 0 || grid.querySelector('.mp-card--new');
  if (empty) empty.style.display = hasCards ? 'none' : 'flex';
  grid.style.display = hasCards ? 'grid' : 'none';

  list.forEach(entry => grid.appendChild(buildCard(entry)));
}

/* ─── Save flow ─── */
function handleSave() {
  const grid  = document.getElementById('mp-grid');
  const empty = document.getElementById('mp-empty');
  if (!grid) return;

  // If form already open, just focus it
  const existing = grid.querySelector('.mp-card--new');
  if (existing) { existing.querySelector('.mp-new-input')?.focus(); return; }

  const list = getAll();
  const defaultName = `Palette ${list.length + 1}`;

  // Unhide grid if empty
  if (empty) empty.style.display = 'none';
  grid.style.display = 'grid';

  const { previewColors, previewRows } = getPreviewData();
  const hasRows = !!(previewRows?.length);

  /* Form card */
  const formCard = document.createElement('div');
  formCard.className = 'mp-card mp-card--new';
  formCard.innerHTML = `
    <div class="mp-card-preview${hasRows ? ' mp-card-preview--multi' : ''}">${_buildStrip({ previewColors, previewRows })}</div>
    <div class="mp-card-new-body">
      <input class="mp-new-input" type="text" maxlength="60"
        placeholder="${_esc(defaultName)}" aria-label="Palette name">
      <div class="mp-new-actions">
        <button class="btn btn--primary btn--sm mp-new-confirm">Save</button>
        <button class="mp-new-cancel">Cancel</button>
      </div>
    </div>`;

  const firstReal = grid.querySelector('.mp-card:not(.mp-card--new)');
  firstReal ? grid.insertBefore(formCard, firstReal) : grid.appendChild(formCard);

  const input = formCard.querySelector('.mp-new-input');
  input.focus();

  function confirm() {
    const name = input.value.trim() || defaultName;
    const entry = addPalette({ name, state: getState(), previewColors, previewRows });
    const realCard = buildCard(entry);
    grid.replaceChild(realCard, formCard);
    requestAnimationFrame(() => realCard.classList.add('mp-card--visible'));
    _refreshCount();
    showToast(`"${name}" saved`);
  }

  function cancel() {
    formCard.remove();
    _refreshCount();
    const remaining = getAll();
    const hasNew = !!grid.querySelector('.mp-card--new');
    if (remaining.length === 0 && !hasNew) {
      if (empty) empty.style.display = 'flex';
      grid.style.display = 'none';
    }
  }

  formCard.querySelector('.mp-new-confirm').addEventListener('click', confirm);
  formCard.querySelector('.mp-new-cancel').addEventListener('click', cancel);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); confirm(); }
    if (e.key === 'Escape') cancel();
  });
}

/* ─── Card builder ─── */
function buildCard(entry) {
  const card = document.createElement('div');
  card.className = 'mp-card';
  card.dataset.id = entry.id;

  const label   = METHOD_LABELS[entry.method] || entry.method;
  const dateStr = new Date(entry.savedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  const hasRows = !!(entry.previewRows?.length);
  card.innerHTML = `
    <div class="mp-card-preview${hasRows ? ' mp-card-preview--multi' : ''}">${_buildStrip(entry)}</div>
    <div class="mp-card-body">
      <div class="mp-card-name" title="Click to rename">${_esc(entry.name)}</div>
      <div class="mp-card-meta">${_esc(label)} · ${entry.steps} steps</div>
      <div class="mp-card-date">${dateStr}</div>
    </div>
    <div class="mp-card-actions">
      <button class="mp-card-load" aria-label="Load ${_esc(entry.name)}">Load</button>
      <div class="mp-card-icon-btns">
        <button class="mp-card-export icon-btn" aria-label="Export ${_esc(entry.name)}" title="Export">
          ${icon('download', { size: 14 })}
        </button>
        <button class="mp-card-delete icon-btn" aria-label="Delete ${_esc(entry.name)}" title="Delete">
          ${icon('trash-2', { size: 14 })}
        </button>
      </div>
    </div>`;

  requestAnimationFrame(() => card.classList.add('mp-card--visible'));

  /* Load */
  card.querySelector('.mp-card-load').addEventListener('click', e => {
    e.stopPropagation();
    _loadPalette(entry);
  });

  /* Export */
  card.querySelector('.mp-card-export').addEventListener('click', e => {
    e.stopPropagation();
    _exportEntry({ colorPalettes: [entry], fontPairs: [] },
      'palette-' + _slug(entry.name));
  });

  /* Delete */
  card.querySelector('.mp-card-delete').addEventListener('click', e => {
    e.stopPropagation();
    card.classList.add('mp-card--removing');
    card.addEventListener('animationend', () => {
      card.remove();
      removePalette(entry.id);
      _refreshCount();
      showToast('Palette deleted');
    }, { once: true });
  });

  /* Rename — click name */
  card.querySelector('.mp-card-name').addEventListener('click', () => {
    _startRename(card.querySelector('.mp-card-name'), entry.id);
  });

  return card;
}

/* ─── Rename in-place ─── */
function _startRename(nameEl, id) {
  if (nameEl.querySelector('input')) return;
  const prev = nameEl.textContent;
  nameEl.innerHTML = '';

  const input = document.createElement('input');
  input.type      = 'text';
  input.value     = prev;
  input.className = 'mp-rename-input';
  input.maxLength = 60;
  nameEl.appendChild(input);
  input.focus();
  input.select();

  function commit() {
    const next = input.value.trim() || prev;
    renamePalette(id, next);
    nameEl.textContent = next;
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { nameEl.textContent = prev; }
  });
}

/* ─── Load palette into state ─── */
function _loadPalette(entry) {
  const s = entry.state;

  /* Restore palette inputs */
  const NAMES = ['brand','brand2','brand3','neutral','success','warning','info','error'];
  NAMES.forEach(name => {
    const p = s.palettes[name];
    if (!p) return;
    setPaletteInput(name, p.input);
    const hexEl    = document.getElementById(`hex-${name}`);
    const pickerEl = document.getElementById(`picker-${name}`);
    const swatchEl = document.getElementById(`swatch-preview-${name}`);
    if (hexEl)    hexEl.value          = p.input;
    if (pickerEl) pickerEl.value       = p.input;
    if (swatchEl) swatchEl.style.background = p.input;
  });

  /* Restore scalar state — each call triggers regen/apply internally */
  setMethod(s.method);
  setSteps(s.steps);
  setTheme(s.theme  || 'dark');
  setFormat(s.format || 'hex');
  setHarmony(s.harmony || 'auto');
  setShowSecondaryBrand(s.showSecondaryBrand ?? false);
  setShowTertiaryBrand(s.showTertiaryBrand   ?? false);

  /* Sync gen-picker trigger label */
  const triggerName = document.getElementById('gen-trigger-name');
  const genMenu     = document.getElementById('gen-menu');
  if (triggerName) triggerName.textContent = METHOD_LABELS[s.method] || s.method;
  if (genMenu) {
    genMenu.querySelectorAll('.gen-option').forEach(o => {
      const active = o.dataset.value === s.method;
      o.classList.toggle('gen-option--active', active);
      o.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  /* Sync harmony label */
  const harmonyLabel = document.getElementById('harmony-current-label');
  if (harmonyLabel) {
    const HARMONY_NAMES = {
      auto: 'Auto', mono: 'Mono', analogous: 'Analogous',
      complementary: 'Complementary', 'split-complementary': 'Split',
      triadic: 'Triadic', tetradic: 'Tetradic', square: 'Square',
    };
    harmonyLabel.textContent = HARMONY_NAMES[s.harmony] || 'Auto';
  }

  /* Full sidebar sync (step btns, format btns, visibility, inputs) */
  _syncSidebarState();

  /* Navigate back and notify */
  _navigateToGenerate();
  showToast(`"${entry.name}" loaded`);
}

/* ─── Helpers ─── */

/** Sample evenly-spaced colours from a scale */
function _sample(scale, picks = 7) {
  if (!scale?.length) return [];
  const n = scale.length;
  return Array.from({ length: picks }, (_, i) => {
    const idx = Math.round(i * (n - 1) / (picks - 1));
    return scale[Math.min(idx, n - 1)];
  });
}

/**
 * Build preview data from current state.
 * Always includes P (brand) and N (neutral) rows; adds S/T when active.
 * @returns {{ previewColors: string[], previewRows: Array<{label:string,colors:string[]}> }}
 */
export function getPreviewData() {
  const state = getState();

  const brandColors   = _sample(state.palettes.brand?.scale?.light);
  const neutralColors = _sample(state.palettes.neutral?.scale?.light);

  const rows = [{ label: 'P', colors: brandColors }];

  if (state.showSecondaryBrand) {
    const s = _sample(state.palettes.brand2?.scale?.light);
    if (s.length) rows.push({ label: 'S', colors: s });
  }
  if (state.showTertiaryBrand) {
    const t = _sample(state.palettes.brand3?.scale?.light);
    if (t.length) rows.push({ label: 'T', colors: t });
  }
  if (neutralColors.length) {
    rows.push({ label: 'N', colors: neutralColors });
  }

  return { previewColors: brandColors, previewRows: rows };
}

/**
 * Render the inner HTML of a .mp-card-preview element.
 * Accepts either a legacy flat color array or an entry/data object with
 * previewRows (multi-row) and/or previewColors (single strip fallback).
 */
function _buildStrip(colorsOrEntry) {
  // Legacy: called with a raw flat colour array
  if (Array.isArray(colorsOrEntry)) {
    if (!colorsOrEntry.length) return '<div class="mp-preview-empty"></div>';
    return colorsOrEntry.map(c =>
      `<div class="mp-swatch" style="background:${_esc(c)}" data-color="${_esc(c)}"></div>`
    ).join('');
  }

  // Object with previewRows → multi-row strip
  const rows = colorsOrEntry?.previewRows;
  if (rows?.length) {
    return rows.map(({ label, colors }) => {
      const swatches = (colors || []).map(c =>
        `<div class="mp-swatch" style="background:${_esc(c)}" data-color="${_esc(c)}"></div>`
      ).join('');
      return `<div class="mp-preview-row"><div class="mp-preview-label">${_esc(label)}</div>${swatches}</div>`;
    }).join('');
  }

  // Fallback to flat previewColors
  const colors = colorsOrEntry?.previewColors || [];
  if (!colors.length) return '<div class="mp-preview-empty"></div>';
  return colors.map(c =>
    `<div class="mp-swatch" style="background:${_esc(c)}" data-color="${_esc(c)}"></div>`
  ).join('');
}

function _refreshCount() {
  const count = document.getElementById('mp-count');
  if (count) _updateCount(count, getAll().length);
}

function _updateCount(el, n) {
  el.textContent = n === 0 ? 'No palettes saved' : n === 1 ? '1 saved' : `${n} saved`;
}

function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _slug(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

export function _exportEntry(data, filename) {
  const payload = { avil: 1, exportedAt: Date.now(), ...data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `avil-${filename}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
