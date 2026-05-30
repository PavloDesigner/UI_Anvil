/* Entry point — wires everything together */

import { initState, getState, getStepLabels, subscribe } from './state.js';
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
import { initMyFonts, renderMyFonts } from './ui/my-fonts.js';
import { initColorInspector } from './ui/color-inspector.js';
import { initColorWheel }     from './ui/color-wheel.js';
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

  /* ── Mobile random bar — fires both colors + fonts random ─── */
  document.getElementById('mobile-random-action')?.addEventListener('click', () => {
    document.getElementById('random-btn')?.click();
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

/* Export modal */
function initExportModal() {
  const openBtn  = document.getElementById('export-btn');
  const overlay  = document.getElementById('export-modal');
  const closeBtn = document.getElementById('modal-close');
  const output   = document.getElementById('export-output');
  const copyBtn  = document.getElementById('copy-export-btn');
  let currentTab = 'css';

  if (!overlay) return;

  function open() {
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    renderExport(currentTab);
    closeBtn?.focus();
    overlay.addEventListener('keydown', trapFocus);
  }

  function close() {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
    overlay.removeEventListener('keydown', trapFocus);
    openBtn?.focus();
  }

  openBtn?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.style.display !== 'none') close(); });

  document.querySelectorAll('.modal-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-tab').forEach(b => b.classList.remove('modal-tab--active'));
      btn.classList.add('modal-tab--active');
      currentTab = btn.dataset.exportTab;
      renderExport(currentTab);
    });
  });

  copyBtn?.addEventListener('click', async () => {
    await copyToClipboard(output.value);
    showToast('Copied to clipboard');
  });

  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    const focusable = [...overlay.querySelectorAll('button, [tabindex="0"], select, textarea, input')].filter(el => !el.disabled);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

function renderExport(tab) {
  const output = document.getElementById('export-output');
  if (!output) return;
  const state = getState();
  const { palettes, steps, theme } = state;
  const labels = getStepLabels(steps);
  const paletteNames = ['brand','neutral','success','warning','info','error'];

  if (tab === 'css') {
    const lightVars = buildCSSVars(paletteNames, palettes, labels, 'light');
    const darkVars  = buildCSSVars(paletteNames, palettes, labels, 'dark');
    output.value = `:root {\n${lightVars}}\n\n[data-theme="dark"] {\n${darkVars}}`;
  } else if (tab === 'tailwind') {
    const lines = paletteNames.flatMap(name => {
      const p = palettes[name];
      const scale = p.scale.light;
      return [`    ${name}: {`, ...scale.map((hex, i) => `      ${labels[i]}: '${hex}',`), '    },'];
    });
    output.value = `module.exports = {\n  theme: {\n    extend: {\n      colors: {\n${lines.join('\n')}\n      }\n    }\n  }\n}`;
  } else if (tab === 'json') {
    const obj = {};
    paletteNames.forEach(name => {
      const p = palettes[name];
      const scale = p.scale.light;
      obj[name] = {};
      scale.forEach((hex, i) => { obj[name][labels[i]] = hex; });
    });
    output.value = JSON.stringify(obj, null, 2);
  } else if (tab === 'scss') {
    const lines = paletteNames.flatMap(name => {
      const p = palettes[name];
      const scale = p.scale.light;
      return scale.map((hex, i) => `$color-${name}-${labels[i]}: ${hex};`);
    });
    output.value = lines.join('\n');
  }
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

function buildCSSVars(names, palettes, labels, mode) {
  return names.flatMap(name => {
    const p = palettes[name];
    const scale = p.scale[mode] || p.scale.light;
    return scale.map((hex, i) => `  --color-${name}-${labels[i]}: ${hex};\n`);
  }).join('');
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

main();
