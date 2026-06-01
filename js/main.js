/* Entry point — wires everything together */

import { initState, getState, getStepLabels, subscribe } from './state.js';
import { generateBrand, generateAlias, generateMapped, hexHueName } from './generators/tokens.js';
import { formatColor } from './color.js';
import { copyToClipboard } from './utils.js';
import { initToast, showToast } from './ui/toast.js';
import { addPalette, getAll as getAllPalettes, replaceAllPalettes } from './saved-palettes.js';
import { getAllFonts, addFontPair, replaceAllFonts } from './saved-fonts.js';
import { initSwatches } from './ui/swatches.js';
import { initPreviews }  from './ui/previews-v2.js';
import { initThemeToggle } from './ui/theme-toggle.js';
import { initSidebar, syncFromState } from './ui/sidebar.js';
import { initMyPalettes, renderMyPalettes, getPreviewData } from './ui/my-palettes.js';
import { undoRandom } from './ui/sidebar.js';
import { initMyFonts, renderMyFonts } from './ui/my-fonts.js';
import { initColorInspector } from './ui/color-inspector.js';
import { initColorWheel }     from './ui/color-wheel.js';
import { initContrastGrid }   from './ui/contrast-grid.js';
import { initImageImport }    from './ui/image-import.js';
import { getTypography }      from './typography-state.js';
import { initTypography }     from './typography-state.js';
import { initFontsTab }       from './ui/fonts-tab.js';

/* ─── View switching ─── */
let _activeView = 'generate';

function showView(view) {
  _activeView = view;
  const isGenerate = view === 'generate';

  document.getElementById('app-shell').style.display       = isGenerate ? '' : 'none';
  document.getElementById('my-palettes-shell').style.display = isGenerate ? 'none' : '';

  document.querySelector('[data-view="generate"]')?.classList.toggle('nav-link--active', isGenerate);
  document.querySelector('[data-view="my-palettes"]')?.classList.toggle('nav-link--active', !isGenerate);

  // Hide algorithm picker when on My Palettes (irrelevant there)
  const genPicker = document.getElementById('gen-picker');
  if (genPicker) genPicker.style.visibility = isGenerate ? '' : 'hidden';

  // Mobile nav only relevant on generate view
  const mobileNav = document.getElementById('mobile-nav');
  if (mobileNav) mobileNav.style.display = isGenerate ? '' : 'none';

  if (!isGenerate) {
    renderMyPalettes();
    renderMyFonts();
  }
}

async function main() {
  initToast();
  initState();
  initTypography();
  initThemeToggle();
  initSidebar();
  initSwatches();
  initPreviews();
  initExportModal();
  initColorInspector();
  initColorWheel();
  initContrastGrid();
  initImageImport();
  initFontsTab();
  initNavLinks();
  initTopbarSave();
  initFontSave();
  initImportExport();
  initMyPalettes({
    onNavigateToGenerate: () => showView('generate'),
    onSyncState:          syncFromState,
  });
  initMyFonts({
    onNavigateToGenerate: () => showView('generate'),
  });
  initMobileNav();
  initShareBtn();
  initCopyPalette();
  initShortcutsPanel();
  initGlobalKeyboard();
}

function initNavLinks() {
  document.querySelectorAll('[data-view]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      showView(link.dataset.view);
    });
  });
}

function initMobileNav() {
  const sidebar   = document.querySelector('.sidebar');
  const backdrop  = document.getElementById('mobile-backdrop');
  const handle    = document.getElementById('sidebar-handle');
  const isMobile  = () => window.matchMedia('(max-width: 768px)').matches;

  /* ── Sheet open / close ────────────────────────────────────── */
  function openSheet(sidebarTabId) {
    if (!isMobile()) return;

    // Switch sidebar tab to the requested panel
    const tabBtn = document.querySelector(`.tab[data-tab="${sidebarTabId}"]`);
    if (tabBtn && !tabBtn.classList.contains('tab--active')) tabBtn.click();

    // Show the tab-appropriate pinned random button
    const btnColors = document.getElementById('mobile-random-colors');
    const btnFonts  = document.getElementById('mobile-random-fonts');
    const isColors  = sidebarTabId === 'brand';
    if (btnColors) btnColors.style.display = isColors ? '' : 'none';
    if (btnFonts)  btnFonts.style.display  = isColors ? 'none' : '';

    sidebar?.classList.add('mobile-sheet--open');
    backdrop?.classList.add('is-visible');
    document.body.style.overflow = 'hidden';
  }

  function closeSheet() {
    sidebar?.classList.remove('mobile-sheet--open');
    backdrop?.classList.remove('is-visible');
    document.body.style.overflow = '';
    // deactivate all sheet-opening nav buttons
    document.querySelectorAll('.mobile-nav-btn[data-mobile-tab="colors"],'
      + '.mobile-nav-btn[data-mobile-tab="fonts"]').forEach(b => {
      b.classList.remove('mobile-nav-btn--active');
    });
  }

  /* ── Backdrop tap closes sheet ─────────────────────────────── */
  backdrop?.addEventListener('click', closeSheet);

  /* ── Bottom-pinned random buttons (tab-specific) ───────────── */
  document.getElementById('mobile-random-colors')?.addEventListener('click', () => {
    document.getElementById('random-btn')?.click();
  });
  document.getElementById('mobile-random-fonts')?.addEventListener('click', () => {
    document.getElementById('random-fonts-btn')?.click();
  });

  /* ── Bottom nav buttons ────────────────────────────────────── */
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.mobileTab;

      if (tab === 'random') {
        // Generate both colors and fonts
        document.getElementById('random-btn')?.click();
        document.getElementById('random-fonts-btn')?.click();
        return;
      }
      if (tab === 'export') {
        document.getElementById('export-btn')?.click();
        return;
      }

      // Toggle: tap same open tab → close
      const isOpen = sidebar?.classList.contains('mobile-sheet--open');
      const currentTabId = tab === 'colors' ? 'brand' : 'fonts';
      if (isOpen && btn.classList.contains('mobile-nav-btn--active')) {
        closeSheet();
        return;
      }

      // Deactivate other sheet btns, activate this one
      document.querySelectorAll('.mobile-nav-btn[data-mobile-tab="colors"],'
        + '.mobile-nav-btn[data-mobile-tab="fonts"]').forEach(b => b.classList.remove('mobile-nav-btn--active'));
      btn.classList.add('mobile-nav-btn--active');

      openSheet(currentTabId);
    });
  });

  /* ── Drag-to-close on sheet handle ────────────────────────── */
  if (handle && sidebar) {
    let startY = 0, startTranslate = 0, dragging = false;

    handle.addEventListener('pointerdown', e => {
      dragging   = true;
      startY     = e.clientY;
      startTranslate = 0;
      sidebar.style.transition = 'none';
      handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dy = Math.max(0, e.clientY - startY);   // only downward
      sidebar.style.transform = `translateY(${dy}px)`;
      startTranslate = dy;
      // Fade backdrop proportionally
      const pct = Math.min(dy / 200, 1);
      if (backdrop) backdrop.style.opacity = String(1 - pct);
    });

    handle.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;
      sidebar.style.transition = '';
      sidebar.style.transform  = '';
      if (backdrop) backdrop.style.opacity = '';
      if (startTranslate > 90) closeSheet();
    });

    handle.addEventListener('pointercancel', () => {
      dragging = false;
      sidebar.style.transition = '';
      sidebar.style.transform  = '';
      if (backdrop) backdrop.style.opacity = '';
    });
  }
}

/* Export modal — Figma 3-layer token JSON */

const LAYER_META = {
  brand:  { desc: 'Primitive color palettes — Brand collection',         file: 'brand.json' },
  alias:  { desc: 'Semantic color groups — Alias collection',            file: 'alias.json' },
  mapped: { desc: 'Component semantic tokens — Mapped collection',       file: 'mapped.json' },
};

function initExportModal() {
  const openBtn      = document.getElementById('export-btn');
  const overlay      = document.getElementById('export-modal');
  const closeBtn     = document.getElementById('modal-close');
  const output       = document.getElementById('export-output');
  const copyBtn      = document.getElementById('copy-export-btn');
  const downloadBtn  = document.getElementById('download-export-btn');
  const visualBtn    = document.getElementById('visual-toggle-btn');
  const codeView     = document.getElementById('export-code-view');
  const visualView   = document.getElementById('export-visual-view');
  const layerDesc    = document.getElementById('modal-layer-desc');
  let currentTab  = 'brand';
  let visualMode  = false;

  if (!overlay) return;

  function open() {
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (visualMode) renderVisual(); else renderTokenExport(currentTab);
    closeBtn?.focus();
    overlay.addEventListener('keydown', trapFocus);
  }

  function close() {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
    overlay.removeEventListener('keydown', trapFocus);
    openBtn?.focus();
  }

  function setVisualMode(on) {
    visualMode = on;
    visualBtn?.classList.toggle('is-active', on);
    codeView.style.display  = on ? 'none' : '';
    visualView.style.display = on ? '' : 'none';
    copyBtn.style.display     = on ? 'none' : '';
    downloadBtn.style.display = on ? 'none' : '';
    if (on) {
      if (layerDesc) layerDesc.textContent = 'Brand → Alias → Mapped dependency chain';
      renderVisual();
    } else {
      renderTokenExport(currentTab);
    }
  }

  openBtn?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.style.display !== 'none') close(); });

  overlay.querySelectorAll('.modal-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.modal-tab').forEach(b => b.classList.remove('modal-tab--active'));
      btn.classList.add('modal-tab--active');
      currentTab = btn.dataset.exportTab;
      if (!visualMode) renderTokenExport(currentTab);
    });
  });

  visualBtn?.addEventListener('click', () => setVisualMode(!visualMode));

  copyBtn?.addEventListener('click', async () => {
    await copyToClipboard(output.value);
    showToast('Copied to clipboard');
  });

  downloadBtn?.addEventListener('click', () => {
    const meta = LAYER_META[currentTab];
    const blob = new Blob([output.value], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = meta?.file ?? `${currentTab}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${meta?.file ?? currentTab + '.json'}`);
  });

  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    const focusable = [...overlay.querySelectorAll('button, [tabindex="0"], select, textarea, input')].filter(el => !el.disabled);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function renderTokenExport(tab) {
    if (!output) return;
    const { palettes } = getState();
    const meta = LAYER_META[tab];
    if (layerDesc) layerDesc.textContent = meta?.desc ?? '';
    let obj;
    if (tab === 'brand')       obj = generateBrand(palettes);
    else if (tab === 'alias')  obj = generateAlias(palettes);
    else if (tab === 'mapped') obj = generateMapped(palettes);
    output.value = JSON.stringify(obj, null, 2);
  }

  function renderVisual() {
    if (!visualView) return;
    const { palettes } = getState();
    visualView.innerHTML = buildVisualHTML(palettes);
  }

  // Re-render whichever view is active when the palette changes
  subscribe('palette-change', () => {
    if (overlay.style.display === 'none') return;
    if (visualMode) renderVisual();
    else renderTokenExport(currentTab);
  });
}

/* ── Visual hierarchy builder ────────────────────────────────────────────── */

// Scope label → CSS class suffix
function scopeCls(scope) {
  return { TEXT_FILL: 'text', FRAME_FILL: 'frame', SHAPE_FILL: 'shape',
           EFFECT_COLOR: 'effect', STROKE: 'stroke', ALL_SCOPES: 'all' }[scope] ?? 'all';
}

function buildVisualHTML(palettes) {
  // Generate all 3 layers
  const brandData  = generateBrand(palettes);
  const aliasData  = generateAlias(palettes);
  const mappedData = generateMapped(palettes);

  // ── Flatten alias tokens ────────────────────────────────────────────────
  // aliasFlat: { 'Primary/100': { hex, targetBrand, scopes } }
  const aliasFlat = {};
  const ALIAS_GROUPS = ['Primary','Neutral','Success','Error','Info','Warning'];
  for (const grp of ALIAS_GROUPS) {
    const g = aliasData[grp]; if (!g) continue;
    for (const [step, tok] of Object.entries(g)) {
      if (tok.$type !== 'color') continue;
      aliasFlat[`${grp}/${step}`] = {
        hex:         tok.$value.hex,
        targetBrand: tok.$extensions?.['com.figma.aliasData']?.targetVariableName,
        scopes:      tok.$extensions?.['com.figma.scopes'] ?? [],
      };
    }
  }

  // ── Flatten mapped tokens ───────────────────────────────────────────────
  // mappedFlat: { 'Text/action': { hex, targetAlias, scope } }
  const mappedFlat = {};
  const MAPPED_GROUPS = ['Text','Surface','Icon','Effects','Borders & Dividers'];
  for (const grp of MAPPED_GROUPS) {
    const g = mappedData[grp]; if (!g) continue;
    for (const [name, tok] of Object.entries(g)) {
      if (tok.$type !== 'color') continue;
      mappedFlat[`${grp}/${name}`] = {
        hex:         tok.$value.hex,
        targetAlias: tok.$extensions?.['com.figma.aliasData']?.targetVariableName,
        scope:       tok.$extensions?.['com.figma.scopes']?.[0] ?? '',
      };
    }
  }

  // ── Build reverse lookup: aliasKey → [mapped tokens] ───────────────────
  const aliasToMapped = {};
  for (const [fullName, tok] of Object.entries(mappedFlat)) {
    const key = tok.targetAlias; if (!key) continue;
    (aliasToMapped[key] ??= []).push({ fullName, ...tok });
  }

  // ── Build reverse lookup: brandKey → [alias tokens] ────────────────────
  const brandToAlias = {};
  for (const [fullName, tok] of Object.entries(aliasFlat)) {
    const key = tok.targetBrand; if (!key) continue;
    (brandToAlias[key] ??= []).push({ fullName, ...tok });
  }

  // ── Color families to render — hue name detected from current palette ──
  const hue = (pal) => {
    const scale = palettes[pal]?.scale?.light ?? [];
    return scale.length ? hexHueName(scale[Math.floor(scale.length / 2)]) : pal;
  };

  const FAMILIES = [
    { family: hue('brand'),   aliasGroup: 'Primary', label: 'Primary', palKey: 'brand'   },
    { family: 'Gray',         aliasGroup: 'Neutral', label: 'Neutral', palKey: 'neutral' },
    { family: hue('success'), aliasGroup: 'Success', label: 'Success', palKey: 'success' },
    { family: hue('error'),   aliasGroup: 'Error',   label: 'Error',   palKey: 'error'   },
    { family: hue('info'),    aliasGroup: 'Info',     label: 'Info',   palKey: 'info'    },
    { family: hue('warning'), aliasGroup: 'Warning', label: 'Warning', palKey: 'warning' },
  ];

  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Scope badge HTML
  const scopeBadge = (scope) =>
    scope ? `<span class="th-scope th-scope--${scopeCls(scope)}">${esc(scope)}</span>` : '';

  // Token card HTML
  const brandCard = (name, hex) => `
    <div class="th-token th-token--brand">
      <span class="th-swatch" style="background:${esc(hex)}"></span>
      <div class="th-token-info">
        <span class="th-token-name">${esc(name)}</span>
        <span class="th-token-hex">${esc(hex)}</span>
      </div>
    </div>`;

  const aliasCard = (name, hex, ref, scopes) => `
    <div class="th-token th-token--alias">
      <span class="th-swatch" style="background:${esc(hex)}"></span>
      <div class="th-token-info">
        <span class="th-token-name">${esc(name)}</span>
        <span class="th-token-hex">${esc(hex)}</span>
        <span class="th-token-ref">← ${esc(ref)}</span>
        ${scopeBadge(scopes[0] ?? '')}
      </div>
    </div>`;

  const mappedCard = (name, hex, ref, scope) => `
    <div class="th-token th-token--mapped">
      <span class="th-swatch" style="background:${esc(hex)}"></span>
      <div class="th-token-info">
        <span class="th-token-name">${esc(name)}</span>
        <span class="th-token-ref">← ${esc(ref)}</span>
        ${scopeBadge(scope)}
      </div>
    </div>`;

  let html = `
    <div class="th-header-row">
      <div class="th-col-label th-col-label--brand"><span class="th-col-label-num">01</span> Brand</div>
      <div></div>
      <div class="th-col-label th-col-label--alias"><span class="th-col-label-num">02</span> Alias</div>
      <div></div>
      <div class="th-col-label th-col-label--mapped"><span class="th-col-label-num">03</span> Mapped</div>
    </div>`;

  for (const { family, aliasGroup, label } of FAMILIES) {
    const familyColors = brandData.Colors[family];
    if (!familyColors) continue;

    // Pick the mid-scale step as the section accent color
    const steps = Object.keys(familyColors);
    const midHex = familyColors[steps[Math.floor(steps.length / 2)]]?.$value?.hex ?? '#888';

    // Count total mapped tokens in this family
    const mappedCount = steps.reduce((acc, step) => {
      const brandName = `Colors/${family}/${step}`;
      const aliases = brandToAlias[brandName] ?? [];
      return acc + aliases.reduce((a, at) => a + (aliasToMapped[at.fullName]?.length ?? 0), 0);
    }, 0);

    html += `
      <div class="th-section">
        <div class="th-section-header" style="--sc:${esc(midHex)}">
          <span class="th-section-dot"></span>
          ${esc(label)} <span style="color:oklch(38% 0.008 265);font-weight:400">/ ${esc(family)}</span>
          <span class="th-section-count">${mappedCount} mapped</span>
        </div>`;

    for (const [step, brandTok] of Object.entries(familyColors)) {
      const brandName  = `Colors/${family}/${step}`;
      const brandHex   = brandTok.$value.hex;
      const aliasArr   = brandToAlias[brandName] ?? [];
      // For families with 1:1 mapping we always have 0 or 1 alias
      const aliasEntry = aliasArr[0] ?? null;
      const mappedArr  = aliasEntry ? (aliasToMapped[aliasEntry.fullName] ?? []) : [];
      const unused     = !aliasEntry || mappedArr.length === 0;

      html += `
        <div class="th-row${unused ? ' th-row--unused' : ''}">
          <div class="th-cell">
            ${brandCard(brandName, brandHex)}
          </div>
          <div class="th-connector${aliasEntry ? ' th-connector--active' : ''}">→</div>
          <div class="th-cell">
            ${aliasEntry
              ? aliasCard(aliasEntry.fullName, aliasEntry.hex, brandName, aliasEntry.scopes)
              : `<span class="th-empty">—</span>`}
          </div>
          <div class="th-connector${mappedArr.length ? ' th-connector--active' : ''}">
            ${mappedArr.length ? '→' : ''}
          </div>
          <div class="th-cell">
            ${mappedArr.length
              ? mappedArr.map(m => mappedCard(m.fullName, m.hex, m.targetAlias, m.scope)).join('')
              : `<span class="th-empty">Not referenced</span>`}
          </div>
        </div>`;
    }

    html += `</div>`; // end .th-section
  }

  return html;
}

/* ─── Topbar Save button ─── */

function initTopbarSave() {
  const picker     = document.getElementById('save-picker');
  const openBtn    = document.getElementById('topbar-save-btn');
  const input      = document.getElementById('save-popover-input');
  const confirmBtn = document.getElementById('save-popover-confirm');
  const cancelBtn  = document.getElementById('save-popover-cancel');
  if (!picker || !openBtn || !input) return;

  function defaultName() {
    return `Palette ${getAllPalettes().length + 1}`;
  }

  function open() {
    input.value = defaultName();
    picker.classList.add('save-picker--open');
    openBtn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => { input.focus(); input.select(); });
  }

  function close() {
    picker.classList.remove('save-picker--open');
    openBtn.setAttribute('aria-expanded', 'false');
  }

  function save() {
    const name  = input.value.trim() || defaultName();
    const state = getState();
    const { previewColors, previewRows } = getPreviewData();
    addPalette({ name, state, previewColors, previewRows });
    close();
    showToast(`"${name}" saved`);
  }

  openBtn.addEventListener('click', e => {
    e.stopPropagation();
    picker.classList.contains('save-picker--open') ? close() : open();
  });

  confirmBtn.addEventListener('click', save);
  cancelBtn.addEventListener('click', close);

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); save(); }
    if (e.key === 'Escape') close();
  });

  document.addEventListener('click', e => {
    if (!picker.contains(e.target)) close();
  });
}


/* ─── Font pair Save (sidebar footer popover) ─── */
function initFontSave() {
  const picker     = document.getElementById('save-fonts-picker');
  const openBtn    = document.getElementById('save-fonts-btn');
  const input      = document.getElementById('save-fonts-input');
  const confirmBtn = document.getElementById('save-fonts-confirm');
  const cancelBtn  = document.getElementById('save-fonts-cancel');
  if (!picker || !openBtn || !input) return;

  function defaultName() {
    return `Font Pair ${getAllFonts().length + 1}`;
  }

  function open() {
    input.value = defaultName();
    picker.classList.add('save-picker--open');
    openBtn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => { input.focus(); input.select(); });
  }

  function close() {
    picker.classList.remove('save-picker--open');
    openBtn.setAttribute('aria-expanded', 'false');
  }

  function save() {
    const name = input.value.trim() || defaultName();
    addFontPair({ name, typo: getTypography() });
    close();
    showToast(`"${name}" saved`);
  }

  openBtn.addEventListener('click', e => {
    e.stopPropagation();
    picker.classList.contains('save-picker--open') ? close() : open();
  });

  confirmBtn.addEventListener('click', save);
  cancelBtn.addEventListener('click', close);

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); save(); }
    if (e.key === 'Escape') close();
  });

  document.addEventListener('click', e => {
    if (!picker.contains(e.target)) close();
  });
}

/* ─── Import / Export library as file ─── */
function initImportExport() {
  const exportBtn   = document.getElementById('mp-export-btn');
  const importBtn   = document.getElementById('mp-import-btn');
  const importInput = document.getElementById('mp-import-input');

  /* Export — serialize both stores to a single JSON file */
  exportBtn?.addEventListener('click', () => {
    const data = {
      avil:          1,
      exportedAt:    Date.now(),
      colorPalettes: getAllPalettes(),
      fontPairs:     getAllFonts(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `avil-library-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Library exported');
  });

  /* Import — open file picker */
  importBtn?.addEventListener('click', () => importInput?.click());

  /* Process picked file */
  importInput?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      let colorCount = 0;
      let fontCount  = 0;

      if (Array.isArray(data.colorPalettes)) {
        const existingIds = new Set(getAllPalettes().map(p => p.id));
        const toAdd = data.colorPalettes.filter(p => p.id && !existingIds.has(p.id));
        if (toAdd.length) {
          replaceAllPalettes([...toAdd, ...getAllPalettes()]);
          colorCount = toAdd.length;
        }
      }

      if (Array.isArray(data.fontPairs)) {
        const existingIds = new Set(getAllFonts().map(f => f.id));
        const toAdd = data.fontPairs.filter(f => f.id && !existingIds.has(f.id));
        if (toAdd.length) {
          replaceAllFonts([...toAdd, ...getAllFonts()]);
          fontCount = toAdd.length;
        }
      }

      renderMyPalettes();
      renderMyFonts();

      const parts = [];
      if (colorCount) parts.push(`${colorCount} palette${colorCount !== 1 ? 's' : ''}`);
      if (fontCount)  parts.push(`${fontCount} font pair${fontCount !== 1 ? 's' : ''}`);
      showToast(parts.length ? `Imported ${parts.join(' · ')}` : 'Nothing new to import');

    } catch {
      showToast('Import failed — invalid file');
    }

    /* Reset so the same file can be picked again */
    importInput.value = '';
  });
}

/* ─── Share link ─── */
function initShareBtn() {
  document.getElementById('share-btn')?.addEventListener('click', async () => {
    // Force-flush any pending hash save before copying
    history.replaceState(null, '', '#' + (await import('./utils.js').then(m => m.encodeState(getState()))));
    await copyToClipboard(location.href);
    showToast('Link copied to clipboard');
  });
}

/* ─── Copy current palette ─── */
function initCopyPalette() {
  document.getElementById('copy-palette-btn')?.addEventListener('click', async () => {
    const state  = getState();
    const { focusedPalette, palettes, steps, format, theme } = state;
    const palette = palettes[focusedPalette];
    if (!palette) return;
    const { formatColor } = await import('./color.js');
    const { getStepLabels } = await import('./state.js');
    const scale  = palette.scale[theme] || palette.scale.light || [];
    const labels = getStepLabels(steps);
    const lines  = scale.map((hex, i) => `${focusedPalette}-${labels[i]}: ${formatColor(hex, format)}`);
    await copyToClipboard(lines.join('\n'));
    showToast(`Copied ${focusedPalette} palette`);
  });
}

/* ─── Keyboard shortcuts panel ─── */
function initShortcutsPanel() {
  const btn     = document.getElementById('shortcuts-btn');
  const panel   = document.getElementById('shortcuts-panel');
  const closeEl = document.getElementById('shortcuts-close');
  if (!btn || !panel) return;

  function openPanel() {
    panel.style.display = 'flex';
    closeEl?.focus();
  }
  function closePanel() {
    panel.style.display = 'none';
    btn.focus();
  }

  btn.addEventListener('click', openPanel);
  closeEl?.addEventListener('click', closePanel);
  panel.addEventListener('click', e => { if (e.target === panel) closePanel(); });
  document.addEventListener('keydown', e => {
    if (e.key === '?' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      openPanel();
    }
    if (e.key === 'Escape' && panel.style.display !== 'none') closePanel();
  });
}

/* ─── Global keyboard shortcuts ─── */
function initGlobalKeyboard() {
  document.addEventListener('keydown', e => {
    // Ctrl/Cmd+Z — undo last random
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      const tag = document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return; // don't steal from text fields
      e.preventDefault();
      if (undoRandom()) showToast('Undo');
    }
  });
}

main();
