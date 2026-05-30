/*
 * Fonts sidebar tab — font pickers + type scale controls.
 * Handles lazy Google Fonts loading via <link> injection.
 */

import { icon } from '../icons.js';
import { GOOGLE_FONTS } from '../data/google-fonts.js';
import {
  getTypography, setHeadingFont, setBodyFont,
  setScaleMethod, setBaseSize, setTypoSteps,
  setHeadingLocked, setBodyLocked,
  subscribeTypography,
} from '../typography-state.js';
import { SCALE_METHODS, buildScaleData } from '../generators/type-scale.js';

/* ─── Google Fonts loader ─── */
const _loadedKeys = new Set();

export function loadGoogleFont(family, weights = [400]) {
  const key = `${family}|${[...weights].sort().join(',')}`;
  if (_loadedKeys.has(key)) return;
  _loadedKeys.add(key);
  const id = 'gf-' + family.replace(/\s+/g, '-').toLowerCase();
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id   = id;
  link.rel  = 'stylesheet';
  const wStr = [...new Set(weights)].sort((a, b) => a - b).join(';');
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${wStr}&display=swap`;
  document.head.appendChild(link);
}

/* Apply heading/body font as CSS custom properties on :root */
export function applyFontVars(heading, body) {
  const r = document.documentElement;
  r.style.setProperty('--font-heading-family', `'${heading}', Georgia, serif`);
  r.style.setProperty('--font-body-family',    `'${body}', system-ui, sans-serif`);
}

/* Apply type-scale steps as CSS custom properties so preview tabs stay live */
export function applyTypoVars(t) {
  const scale = buildScaleData(t.scaleMethod, t.baseSize, t.steps, t.baseStep);
  const bi  = t.baseStep;
  const get = i => (scale[Math.max(0, Math.min(scale.length - 1, i))] || scale[0]).px;
  const r   = document.documentElement;
  r.style.setProperty('--type-xs',   get(bi - 2) + 'px');
  r.style.setProperty('--type-sm',   get(bi - 1) + 'px');
  r.style.setProperty('--type-base', get(bi)     + 'px');
  r.style.setProperty('--type-md',   get(bi + 1) + 'px');
  r.style.setProperty('--type-lg',   get(bi + 2) + 'px');
  r.style.setProperty('--type-xl',   get(bi + 3) + 'px');
}

/* ─── Init ─── */
export function initFontsTab() {
  const state = getTypography();
  loadGoogleFont(state.heading, [400, 700]);
  loadGoogleFont(state.body,    [300, 400, 500, 700]);
  applyFontVars(state.heading, state.body);
  applyTypoVars(state);

  _buildUI();
  _buildFontsFooter();
  _wireTabSwitch();
  _wireRandomFonts();

  subscribeTypography(s => {
    applyFontVars(s.heading, s.body);
    applyTypoVars(s);
    _syncUI(s);
  });
}

/* ─── Build the main tab UI (pickers only) ─── */
function _buildUI() {
  const panel = document.getElementById('tab-fonts');
  if (!panel) return;
  const state = getTypography();

  panel.innerHTML = `
<div class="fonts-tab">

  <!-- Heading font -->
  <div class="fp-row">
    <div class="fp-label">Heading</div>
    ${_pickerHTML('heading', state.heading)}
    <button class="icon-btn lock-btn${state.headingLocked ? ' lock-btn--locked' : ''}"
            id="lock-heading"
            aria-label="${state.headingLocked ? 'Unlock' : 'Lock'} heading font"
            title="${state.headingLocked ? 'Unlock heading from random' : 'Lock heading — skip during random'}">
      ${icon('lock',      { size: 13, cls: 'icon-lock' })}
      ${icon('lock-open', { size: 13, cls: 'icon-unlock' })}
    </button>
  </div>

  <!-- Body font -->
  <div class="fp-row">
    <div class="fp-label">Body</div>
    ${_pickerHTML('body', state.body)}
    <button class="icon-btn lock-btn${state.bodyLocked ? ' lock-btn--locked' : ''}"
            id="lock-body"
            aria-label="${state.bodyLocked ? 'Unlock' : 'Lock'} body font"
            title="${state.bodyLocked ? 'Unlock body from random' : 'Lock body — skip during random'}">
      ${icon('lock',      { size: 13, cls: 'icon-lock' })}
      ${icon('lock-open', { size: 13, cls: 'icon-unlock' })}
    </button>
  </div>

</div>`;

  _wireFontPicker('heading', setHeadingFont);
  _wireFontPicker('body',    setBodyFont);

  /* Lock buttons */
  document.getElementById('lock-heading')?.addEventListener('click', () => {
    setHeadingLocked(!getTypography().headingLocked);
  });
  document.getElementById('lock-body')?.addEventListener('click', () => {
    setBodyLocked(!getTypography().bodyLocked);
  });
}

/* ─── Build the fonts footer (Scale + Base + Steps) ─── */
function _buildFontsFooter() {
  const container = document.getElementById('fonts-footer-settings');
  if (!container) return;
  const state = getTypography();

  container.innerHTML = `
    <!-- Scale method -->
    <div class="setting-row setting-row--scale">
      <span class="setting-label">Scale</span>
      <div class="fp-picker scale-picker scale-picker--footer" id="scale-picker">
        <button class="fp-trigger scale-trigger scale-trigger--footer" id="scale-trigger">
          <span class="fp-trigger-name" id="scale-name">${SCALE_METHODS[state.scaleMethod]?.name || state.scaleMethod}</span>
          ${_chevron()}
        </button>
        <div class="fp-dropdown scale-dropdown scale-dropdown--footer" id="scale-dropdown">
          ${Object.entries(SCALE_METHODS).map(([k, m]) => `
            <button class="scale-option ${k === state.scaleMethod ? 'scale-option--active' : ''}" data-method="${k}">
              <span class="scale-option-name">${m.name}</span>
              <span class="scale-option-desc">${m.desc}</span>
            </button>`).join('')}
        </div>
      </div>
    </div>

    <!-- Base size -->
    <div class="setting-row">
      <span class="setting-label">Base</span>
      <div class="base-size-ctrl">
        <button class="base-size-btn base-size-minus" aria-label="Decrease base size">−</button>
        <span class="base-size-val" id="base-size-val">${state.baseSize}</span>
        <span class="base-size-unit">px</span>
        <button class="base-size-btn base-size-plus" aria-label="Increase base size">+</button>
      </div>
    </div>

    <!-- Typography steps -->
    <div class="setting-row">
      <span class="setting-label">Steps</span>
      <div class="steps-control" role="group" aria-label="Type scale steps">
        ${[5,7,9,11].map(n =>
          `<button class="step-btn ${n === state.steps ? 'step-btn--active' : ''}" data-type-steps="${n}">${n}</button>`
        ).join('')}
      </div>
    </div>`;

  _wireScalePicker();
  _wireScaleControls();
}

/* ─── Show/hide the right footer on tab switch ─── */
function _wireTabSwitch() {
  const colorsFooter = document.getElementById('sidebar-footer-colors');
  const fontsFooter  = document.getElementById('sidebar-footer-fonts');
  if (!colorsFooter || !fontsFooter) return;

  function update() {
    const onFonts = document.querySelector('[data-tab="fonts"]')?.classList.contains('tab--active') ||
                    document.querySelector('[data-tab="fonts"]')?.getAttribute('aria-selected') === 'true';
    colorsFooter.style.display = onFonts ? 'none' : '';
    fontsFooter.style.display  = onFonts ? ''     : 'none';
  }

  /* Listen for tab clicks */
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => requestAnimationFrame(update));
  });

  update();
}

/* ─── Random fonts button ─── */
function _wireRandomFonts() {
  const btn = document.getElementById('random-fonts-btn');
  if (!btn) return;

  const SERIF_FONTS    = GOOGLE_FONTS.filter(f => f.category === 'serif');
  const SANS_FONTS     = GOOGLE_FONTS.filter(f => f.category === 'sans-serif');
  const DISPLAY_FONTS  = GOOGLE_FONTS.filter(f => f.category === 'display');

  function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function randomize() {
    const typo = getTypography();
    const headingPool = [...SERIF_FONTS, ...DISPLAY_FONTS];

    if (!typo.headingLocked) {
      const h = randomFrom(headingPool);
      if (h) {
        loadGoogleFont(h.family, h.weights || [400, 700]);
        setHeadingFont(h.family);
      }
    }
    if (!typo.bodyLocked) {
      const b = randomFrom(SANS_FONTS);
      if (b) {
        loadGoogleFont(b.family, b.weights || [300, 400, 500]);
        setBodyFont(b.family);
      }
    }
  }

  btn.addEventListener('click', randomize);

  /* Space shortcut — only when Fonts tab is active */
  document.addEventListener('keydown', e => {
    if (e.code !== 'Space') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const fontsFooter = document.getElementById('sidebar-footer-fonts');
    if (fontsFooter?.style.display === 'none' || fontsFooter?.style.display === '') {
      /* only intercept when fonts footer is visible */
      if (fontsFooter?.style.display !== 'none' && fontsFooter?.style.display !== '') return;
    }
    if (fontsFooter && fontsFooter.style.display !== 'none') {
      e.preventDefault();
      randomize();
    }
  });
}

function _pickerHTML(role, current) {
  return `
    <div class="fp-picker font-picker--${role}" id="${role}-fp">
      <button class="fp-trigger" id="${role}-fp-trigger" aria-haspopup="listbox" aria-expanded="false">
        <span class="fp-trigger-name" id="${role}-fp-name"
              style="font-family:'${current}',sans-serif">${current}</span>
        ${_chevron()}
      </button>
      <div class="fp-dropdown font-dropdown" id="${role}-fp-dropdown" role="listbox">
        <div class="fp-search-wrap">
          ${icon('search', { size: 12 })}
          <input class="fp-search" type="text" placeholder="Search fonts…" autocomplete="off"
                 aria-label="Search fonts">
        </div>
        <div class="fp-cats">
          <button class="fp-cat fp-cat--active" data-cat="all">All</button>
          <button class="fp-cat" data-cat="sans-serif">Sans</button>
          <button class="fp-cat" data-cat="serif">Serif</button>
          <button class="fp-cat" data-cat="display">Display</button>
          <button class="fp-cat" data-cat="monospace">Mono</button>
        </div>
        <label class="fp-cyr-toggle" title="Show only fonts with Cyrillic script support">
          <input type="checkbox" class="fp-cyr-check" id="${role}-fp-cyr" autocomplete="off">
          <span class="fp-cyr-box"></span>
          <span class="fp-cyr-label">Кириллица</span>
        </label>
        <div class="fp-list" id="${role}-fp-list" role="group"></div>
      </div>
    </div>`;
}

function _chevron() {
  return icon('chevron-down', { size: 11, cls: 'fp-chevron', sw: 2.5 });
}

/* ─── Wire font picker ─── */
function _wireFontPicker(role, setter) {
  const container = document.getElementById(`${role}-fp`);
  const trigger   = document.getElementById(`${role}-fp-trigger`);
  const dropdown  = document.getElementById(`${role}-fp-dropdown`);
  const list      = document.getElementById(`${role}-fp-list`);
  const nameEl    = document.getElementById(`${role}-fp-name`);
  const searchIn  = dropdown.querySelector('.fp-search');
  const catBtns   = dropdown.querySelectorAll('.fp-cat');
  const cyrCheck  = document.getElementById(`${role}-fp-cyr`);
  if (!container) return;

  let activeCat    = 'all';
  let query        = '';
  let cyrillicOnly = false;
  let _visible     = 120;        // how many items are currently rendered
  const BATCH_SIZE = 80;         // how many more to render on scroll
  let _currentSelected = '';
  let _ioSentinel = null;

  function filtered() {
    return GOOGLE_FONTS.filter(f => {
      const catOk   = activeCat === 'all' || f.category === activeCat;
      const cyrOk   = !cyrillicOnly || f.cyrillic === true;
      const queryOk = !query || f.family.toLowerCase().includes(query.toLowerCase());
      return catOk && cyrOk && queryOk;
    });
  }

  function _makeItem(font, selected) {
    const isActive = font.family === selected;
    const btn = document.createElement('button');
    btn.className = 'fp-item' + (isActive ? ' fp-item--active' : '');
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    btn.dataset.family = font.family;
    btn.innerHTML =
      `<span class="fp-item-name" style="font-family:'${font.family}',sans-serif">${font.family}</span>` +
      `<span class="fp-item-cat">${font.cyrillic ? '<span class="fp-item-cyr">Кир</span>' : ''}${_catShort(font.category)}</span>`;
    btn.addEventListener('click', () => {
      loadGoogleFont(font.family, font.weights || [400, 700]);
      setter(font.family);
      nameEl.textContent       = font.family;
      nameEl.style.fontFamily  = `'${font.family}',sans-serif`;
      close();
    });
    return btn;
  }

  function renderList(selected, resetScroll = true) {
    _currentSelected = selected;
    if (resetScroll) _visible = 120;

    // Disconnect any existing sentinel observer
    if (_ioSentinel) { _ioSentinel.disconnect(); _ioSentinel = null; }

    list.innerHTML = '';
    const fonts  = filtered();
    const slice  = fonts.slice(0, _visible);

    // Load font previews for the visible slice
    _batchLoadForPreview(slice.map(f => f.family));

    const frag = document.createDocumentFragment();
    slice.forEach(font => frag.appendChild(_makeItem(font, selected)));

    // Sentinel for infinite scroll when there are more fonts
    if (fonts.length > _visible) {
      const sentinel = document.createElement('div');
      sentinel.className  = 'fp-list-more';
      sentinel.textContent = `Showing ${_visible} of ${fonts.length} — scroll for more`;
      frag.appendChild(sentinel);

      _ioSentinel = new IntersectionObserver(entries => {
        if (!entries[0].isIntersecting) return;
        _ioSentinel.disconnect();
        _ioSentinel = null;
        _visible += BATCH_SIZE;
        renderList(_currentSelected, false);
      }, { root: list, rootMargin: '0px 0px 120px 0px' });

      // Observe after mount
      requestAnimationFrame(() => _ioSentinel?.observe(sentinel));
    }

    list.appendChild(frag);

    /* Scroll active item into view on first open */
    if (resetScroll) {
      requestAnimationFrame(() => {
        list.querySelector('.fp-item--active')?.scrollIntoView({ block: 'nearest' });
      });
    }
  }

  function _positionDropdown() {
    const r = trigger.getBoundingClientRect();
    dropdown.style.top    = (r.bottom + 4) + 'px';
    dropdown.style.bottom = 'auto';
    dropdown.style.left   = r.left + 'px';
    dropdown.style.width  = r.width + 'px';
  }

  function open() {
    _positionDropdown();
    container.classList.add('fp-picker--open');
    trigger.setAttribute('aria-expanded', 'true');
    query = ''; searchIn.value = '';
    activeCat = 'all';
    cyrillicOnly = cyrCheck?.checked ?? false;
    catBtns.forEach(b => b.classList.toggle('fp-cat--active', b.dataset.cat === 'all'));
    const state = getTypography();
    renderList(role === 'heading' ? state.heading : state.body);
    requestAnimationFrame(() => searchIn.focus());
  }

  function close() {
    container.classList.remove('fp-picker--open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    container.classList.contains('fp-picker--open') ? close() : open();
  });

  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      activeCat = btn.dataset.cat;
      catBtns.forEach(b => b.classList.toggle('fp-cat--active', b.dataset.cat === activeCat));
      const state = getTypography();
      renderList(role === 'heading' ? state.heading : state.body);
    });
  });

  cyrCheck?.addEventListener('change', () => {
    cyrillicOnly = cyrCheck.checked;
    const state = getTypography();
    renderList(role === 'heading' ? state.heading : state.body);
  });

  searchIn.addEventListener('input', () => {
    query = searchIn.value;
    const state = getTypography();
    renderList(role === 'heading' ? state.heading : state.body);
  });

  searchIn.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  /* Close on outside click */
  document.addEventListener('click', e => {
    if (!container.contains(e.target)) close();
  });
}

/* ─── Wire scale method picker ─── */
function _wireScalePicker() {
  const picker   = document.getElementById('scale-picker');
  const trigger  = document.getElementById('scale-trigger');
  const dropdown = document.getElementById('scale-dropdown');
  const nameEl   = document.getElementById('scale-name');
  if (!picker) return;

  function _positionScaleDropdown() {
    const r = trigger.getBoundingClientRect();
    dropdown.style.top    = 'auto';
    dropdown.style.bottom = (window.innerHeight - r.top + 4) + 'px';
    dropdown.style.left   = r.left + 'px';
    dropdown.style.width  = r.width + 'px';
  }

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    if (!picker.classList.contains('fp-picker--open')) _positionScaleDropdown();
    picker.classList.toggle('fp-picker--open');
  });

  picker.querySelectorAll('.scale-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const method = btn.dataset.method;
      setScaleMethod(method);
      nameEl.textContent = SCALE_METHODS[method]?.name || method;
      picker.querySelectorAll('.scale-option').forEach(b =>
        b.classList.toggle('scale-option--active', b.dataset.method === method));
      picker.classList.remove('fp-picker--open');
    });
  });

  document.addEventListener('click', e => {
    if (!picker.contains(e.target)) picker.classList.remove('fp-picker--open');
  });
}

/* ─── Wire base size + steps ─── */
function _wireScaleControls() {
  const valEl = document.getElementById('base-size-val');

  document.querySelector('.base-size-minus')?.addEventListener('click', () => {
    setBaseSize(getTypography().baseSize - 1);
    if (valEl) valEl.textContent = getTypography().baseSize;
  });
  document.querySelector('.base-size-plus')?.addEventListener('click', () => {
    setBaseSize(getTypography().baseSize + 1);
    if (valEl) valEl.textContent = getTypography().baseSize;
  });

  document.querySelectorAll('[data-type-steps]').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = parseInt(btn.dataset.typeSteps);
      setTypoSteps(n);
      document.querySelectorAll('[data-type-steps]').forEach(b =>
        b.classList.toggle('step-btn--active', parseInt(b.dataset.typeSteps) === n));
    });
  });
}

/* ─── Sync UI from state ─── */
function _syncUI(state) {
  const hName = document.getElementById('heading-fp-name');
  const bName = document.getElementById('body-fp-name');
  const sName = document.getElementById('scale-name');
  const bsVal = document.getElementById('base-size-val');

  if (hName) { hName.textContent = state.heading; hName.style.fontFamily = `'${state.heading}',sans-serif`; }
  if (bName) { bName.textContent = state.body;    bName.style.fontFamily = `'${state.body}',sans-serif`; }
  if (sName) sName.textContent = SCALE_METHODS[state.scaleMethod]?.name || state.scaleMethod;
  if (bsVal) bsVal.textContent = state.baseSize;

  /* Sync lock button states */
  const hLock = document.getElementById('lock-heading');
  const bLock = document.getElementById('lock-body');
  if (hLock) hLock.classList.toggle('lock-btn--locked', !!state.headingLocked);
  if (bLock) bLock.classList.toggle('lock-btn--locked', !!state.bodyLocked);
}

/* ─── Batch-load fonts for name preview (low-res, 400 only) ─── */
let _batchTimer = null;
const _batchQueue = new Set();

function _batchLoadForPreview(families) {
  families.forEach(f => _batchQueue.add(f));
  clearTimeout(_batchTimer);
  _batchTimer = setTimeout(() => {
    const pending = [..._batchQueue].filter(f => {
      const id = 'gf-' + f.replace(/\s+/g, '-').toLowerCase();
      return !document.getElementById(id);
    });
    _batchQueue.clear();
    if (!pending.length) return;
    for (let i = 0; i < pending.length; i += 50) {
      const chunk = pending.slice(i, i + 50);
      const link  = document.createElement('link');
      link.rel    = 'stylesheet';
      link.href   = 'https://fonts.googleapis.com/css2?' +
        chunk.map(f => `family=${encodeURIComponent(f)}:wght@400`).join('&') +
        '&display=swap';
      chunk.forEach(f => {
        const id  = 'gf-' + f.replace(/\s+/g, '-').toLowerCase();
        link.id   = id;
      });
      document.head.appendChild(link);
    }
  }, 60);
}

function _catShort(cat) {
  const MAP = { 'sans-serif': 'sans', serif: 'serif', display: 'display', monospace: 'mono' };
  return MAP[cat] || cat;
}
