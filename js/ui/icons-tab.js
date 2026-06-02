/* Icons tab — search & pick any icon library (powered by Iconify collections) */

import { loadCollections, getIconLib, setIconLib, subscribeIcon, fetchSampleIcon } from '../icon-state.js';

let _all = [];
let _io = null;   // IntersectionObserver for lazy sample loading

export function initIconsTab() {
  const panel = document.getElementById('tab-icons');
  if (!panel) return;

  panel.innerHTML = `
    <div class="icons-tab">
      <p class="icons-tab-desc">
        Swap the icon set used across the UI preview. Browse every open-source
        library on <a href="https://www.shadcn.io/icons/libraries" target="_blank" rel="noopener">shadcn.io/icons</a>
        and many more, via Iconify.
      </p>
      <div class="icon-search-wrap">
        <svg class="icon-search-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input type="text" class="icon-search" id="icon-search" placeholder="Search 150+ libraries…" autocomplete="off" spellcheck="false">
      </div>
      <div class="icon-lib-count" id="icon-lib-count">Loading libraries…</div>
      <div class="icon-lib-list" id="icon-lib-list"></div>
    </div>`;

  const input   = panel.querySelector('#icon-search');
  const listEl  = panel.querySelector('#icon-lib-list');
  const countEl = panel.querySelector('#icon-lib-count');

  _io = new IntersectionObserver(onVisible, { root: listEl, rootMargin: '120px' });

  loadCollections().then(cols => {
    _all = cols;
    renderList(listEl, countEl, '');
  });

  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => renderList(listEl, countEl, input.value.trim().toLowerCase()), 120);
  });

  subscribeIcon(() => syncActive(listEl));
}

function filterLibs(q) {
  if (!q) return _all;
  return _all.filter(c =>
    c.label.toLowerCase().includes(q) ||
    c.prefix.toLowerCase().includes(q) ||
    (c.category && c.category.toLowerCase().includes(q)) ||
    (c.author && c.author.toLowerCase().includes(q)));
}

function renderList(listEl, countEl, q) {
  const libs = filterLibs(q);
  countEl.textContent = `${libs.length} ${libs.length === 1 ? 'library' : 'libraries'}`;

  if (_io) _io.disconnect();
  listEl.innerHTML = libs.map(c => `
    <div class="icon-lib-card" data-lib="${c.prefix}" role="button" tabindex="0"
         aria-pressed="false" title="${esc(c.label)}">
      <div class="icon-lib-top">
        <span class="icon-lib-name">${esc(c.label)}</span>
        <a class="icon-lib-link" href="${esc(c.page)}" target="_blank" rel="noopener"
           title="Open ${esc(c.label)} on Iconify" aria-label="Open ${esc(c.label)} library in a new tab">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
        </a>
        <span class="icon-lib-check" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </span>
      </div>
      <div class="icon-lib-bottom">
        <span class="icon-lib-meta">${c.total.toLocaleString()} icons${c.category ? ' · ' + esc(c.category) : ''}</span>
        <div class="icon-lib-samples" data-prefix="${c.prefix}" data-samples="${esc((c.samples || []).slice(0, 4).join(','))}">
          ${(c.samples || []).slice(0, 4).map(() => `<span class="icon-lib-sample"></span>`).join('')}
        </div>
      </div>
    </div>`).join('');

  listEl.querySelectorAll('.icon-lib-card').forEach(card => {
    const select = () => setIconLib(card.dataset.lib);
    card.addEventListener('click', e => { if (e.target.closest('.icon-lib-link')) return; select(); });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
    });
    // Don't trigger selection when opening the external link
    card.querySelector('.icon-lib-link')?.addEventListener('click', e => e.stopPropagation());
    const samples = card.querySelector('.icon-lib-samples');
    if (samples && samples.dataset.samples) _io.observe(samples);
  });

  syncActive(listEl);
}

function onVisible(entries) {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const holder = entry.target;
    _io.unobserve(holder);
    if (holder.dataset.loaded) continue;
    holder.dataset.loaded = '1';
    const prefix = holder.dataset.prefix;
    const names = holder.dataset.samples.split(',').filter(Boolean);
    const slots = holder.querySelectorAll('.icon-lib-sample');
    names.forEach(async (name, i) => {
      const svg = await fetchSampleIcon(prefix, name);
      if (slots[i] && svg) slots[i].innerHTML = svg;
    });
  }
}

function syncActive(listEl) {
  const cur = getIconLib();
  listEl.querySelectorAll('.icon-lib-card').forEach(c => {
    const on = c.dataset.lib === cur;
    c.classList.toggle('icon-lib-card--active', on);
    c.setAttribute('aria-pressed', String(on));
  });
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
