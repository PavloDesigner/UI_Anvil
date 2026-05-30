/* My Fonts — save, load, rename, delete font pairs */

import { icon } from '../icons.js';
import { getAllFonts, addFontPair, removeFontPair, renameFontPair } from '../saved-fonts.js';
import {
  getTypography, setHeadingFont, setBodyFont,
  setScaleMethod, setBaseSize, setTypoSteps,
} from '../typography-state.js';
import { loadGoogleFont } from './fonts-tab.js';
import { showToast } from './toast.js';
import { SCALE_METHODS } from '../generators/type-scale.js';
import { _exportEntry } from './my-palettes.js';

let _navigateToGenerate = () => {};

export function initMyFonts(opts = {}) {
  _navigateToGenerate = opts.onNavigateToGenerate || (() => {});
  document.getElementById('mf-save-btn')?.addEventListener('click', handleSave);
}

/* Render the full font grid */
export function renderMyFonts() {
  const grid  = document.getElementById('mf-grid');
  const empty = document.getElementById('mf-empty');
  const count = document.getElementById('mf-count');
  if (!grid) return;

  const list = getAllFonts();
  if (count) _updateCount(count, list.length);

  grid.querySelectorAll('.mf-card:not(.mf-card--new)').forEach(c => c.remove());

  const hasCards = list.length > 0 || grid.querySelector('.mf-card--new');
  if (empty) empty.style.display = hasCards ? 'none' : 'flex';
  grid.style.display = hasCards ? 'grid' : 'none';

  list.forEach(entry => grid.appendChild(buildCard(entry)));
}

/* ─── Save flow (triggered by mf-save-btn in My Library view) ─── */
function handleSave() {
  const grid  = document.getElementById('mf-grid');
  const empty = document.getElementById('mf-empty');
  if (!grid) return;

  const existing = grid.querySelector('.mf-card--new');
  if (existing) { existing.querySelector('.mf-new-input')?.focus(); return; }

  const list = getAllFonts();
  const defaultName = `Font Pair ${list.length + 1}`;

  if (empty) empty.style.display = 'none';
  grid.style.display = 'grid';

  const typo = getTypography();
  const formCard = document.createElement('div');
  formCard.className = 'mf-card mf-card--new';
  formCard.innerHTML = `
    <div class="mf-card-preview">
      <span class="mf-preview-h" style="font-family:'${_esc(typo.heading)}',serif">${_esc(typo.heading)}</span>
      <span class="mf-preview-b" style="font-family:'${_esc(typo.body)}',sans-serif">${_esc(typo.body)}</span>
    </div>
    <div class="mf-card-new-body">
      <input class="mp-new-input mf-new-input" type="text" maxlength="60"
        placeholder="${_esc(defaultName)}" aria-label="Font pair name">
      <div class="mp-new-actions">
        <button class="btn btn--primary btn--sm mf-new-confirm">Save</button>
        <button class="mp-new-cancel">Cancel</button>
      </div>
    </div>`;

  const firstReal = grid.querySelector('.mf-card:not(.mf-card--new)');
  firstReal ? grid.insertBefore(formCard, firstReal) : grid.appendChild(formCard);

  const input = formCard.querySelector('.mf-new-input');
  input.focus();

  function confirm() {
    const name  = input.value.trim() || defaultName;
    const entry = addFontPair({ name, typo: getTypography() });
    const realCard = buildCard(entry);
    grid.replaceChild(realCard, formCard);
    requestAnimationFrame(() => realCard.classList.add('mf-card--visible'));
    _refreshCount();
    showToast(`"${name}" saved`);
  }

  function cancel() {
    formCard.remove();
    _refreshCount();
    const remaining = getAllFonts();
    const hasNew = !!grid.querySelector('.mf-card--new');
    if (remaining.length === 0 && !hasNew) {
      if (empty) empty.style.display = 'flex';
      grid.style.display = 'none';
    }
  }

  formCard.querySelector('.mf-new-confirm').addEventListener('click', confirm);
  formCard.querySelector('.mp-new-cancel').addEventListener('click', cancel);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); confirm(); }
    if (e.key === 'Escape') cancel();
  });
}

/* ─── Card builder ─── */
function buildCard(entry) {
  const card = document.createElement('div');
  card.className = 'mf-card';
  card.dataset.id = entry.id;

  const scaleName = SCALE_METHODS[entry.scaleMethod]?.name || entry.scaleMethod || '—';
  const dateStr   = new Date(entry.savedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  card.innerHTML = `
    <div class="mf-card-preview">
      <span class="mf-preview-h" style="font-family:'${_esc(entry.heading)}',serif">${_esc(entry.heading)}</span>
      <span class="mf-preview-b" style="font-family:'${_esc(entry.body)}',sans-serif">${_esc(entry.body)}</span>
    </div>
    <div class="mp-card-body">
      <div class="mp-card-name" title="Click to rename">${_esc(entry.name)}</div>
      <div class="mp-card-meta">${_esc(scaleName)} · ${entry.baseSize}px</div>
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

  requestAnimationFrame(() => card.classList.add('mf-card--visible'));

  card.querySelector('.mp-card-load').addEventListener('click', e => {
    e.stopPropagation();
    _loadFontPair(entry);
  });

  card.querySelector('.mp-card-export').addEventListener('click', e => {
    e.stopPropagation();
    _exportEntry({ colorPalettes: [], fontPairs: [entry] },
      'fonts-' + _slug(entry.name));
  });

  card.querySelector('.mp-card-delete').addEventListener('click', e => {
    e.stopPropagation();
    card.classList.add('mp-card--removing');
    card.addEventListener('animationend', () => {
      card.remove();
      removeFontPair(entry.id);
      _refreshCount();
      showToast('Font pair deleted');
    }, { once: true });
  });

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
    renameFontPair(id, next);
    nameEl.textContent = next;
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { nameEl.textContent = prev; }
  });
}

/* ─── Load font pair into state ─── */
function _loadFontPair(entry) {
  loadGoogleFont(entry.heading, [400, 700]);
  loadGoogleFont(entry.body,    [300, 400, 500, 700]);
  setHeadingFont(entry.heading);
  setBodyFont(entry.body);
  if (entry.scaleMethod) setScaleMethod(entry.scaleMethod);
  if (entry.baseSize)    setBaseSize(entry.baseSize);
  if (entry.steps)       setTypoSteps(entry.steps);
  _navigateToGenerate();
  showToast(`"${entry.name}" loaded`);
}

/* ─── Helpers ─── */
function _refreshCount() {
  const count = document.getElementById('mf-count');
  if (count) _updateCount(count, getAllFonts().length);
}

function _updateCount(el, n) {
  el.textContent = n === 0 ? 'No pairs saved' : n === 1 ? '1 saved' : `${n} saved`;
}

function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _slug(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}
