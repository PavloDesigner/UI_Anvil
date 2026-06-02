/* ───────────────────────────────────────────────────────────────────────────
   Icon library switcher (dynamic)
   ---------------------------------------------------------------------------
   Lucide ships inline as the offline default. Every other library is pulled
   live from the Iconify API (https://api.iconify.design) — the same open-source
   sets catalogued at https://www.shadcn.io/icons/libraries and many more
   (150+ collections: Tabler, Phosphor, Heroicons, Material, Bootstrap, …).

     · /collections                         → the full searchable library list
     · /search?query=…&prefix=…             → resolve our icon set in any library
     · /{prefix}/{name}.svg                 → fetch a single icon

   Any icon a library doesn't have falls back to its Lucide equivalent.
   ─────────────────────────────────────────────────────────────────────────── */

const API = 'https://api.iconify.design';

/* Bundled Lucide paths for the preview's icon set (ISC licensed) */
const LUCIDE = {
  flame:    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  trophy:   '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  grid:     '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  live:     '<circle cx="12" cy="12" r="2"/><path d="M4.93 19.07a10 10 0 0 1 0-14.14M19.07 4.93a10 10 0 0 1 0 14.14M7.76 16.24a6 6 0 0 1 0-8.49M16.24 7.76a6 6 0 0 1 0 8.49"/>',
  bolt:     '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  target:   '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  gem:      '<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>',
  award:    '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
  chevronR: '<path d="m9 18 6-6-6-6"/>',
  chevronL: '<path d="m15 18-6-6 6-6"/>',
  play:     '<path d="M6 3v18l15-9Z" fill="currentColor" stroke="none"/>',
};
const ICON_NAMES = Object.keys(LUCIDE);

/* Search keywords used to resolve our icon set inside an arbitrary library */
const KEYWORDS = {
  flame:    ['flame', 'fire'],
  sparkles: ['sparkles', 'sparkle', 'stars'],
  trophy:   ['trophy', 'award'],
  grid:     ['layout-grid', 'grid', 'squares-four', 'squares', 'apps'],
  live:     ['broadcast', 'signal', 'live', 'rss'],
  bolt:     ['bolt', 'lightning', 'flash', 'zap'],
  target:   ['target', 'focus', 'crosshair', 'bullseye'],
  gem:      ['diamond', 'gem', 'crystal'],
  award:    ['medal', 'award', 'trophy'],
  chevronR: ['chevron-right', 'caret-right', 'arrow-right-s', 'arrow-right'],
  chevronL: ['chevron-left', 'caret-left', 'arrow-left-s', 'arrow-left'],
  play:     ['play-filled', 'play-fill', 'play-circle', 'play'],
};

function lucideSvg(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LUCIDE[name] || ''}</svg>`;
}
function lucideSet() {
  const set = {};
  for (const n of ICON_NAMES) set[n] = lucideSvg(n);
  return set;
}

/* ── Network helpers ─────────────────────────────────────────────────────── */
async function fetchSvg(prefix, name) {
  const res = await fetch(`${API}/${prefix}/${name}.svg?height=24&width=24`);
  if (!res.ok) throw new Error('svg ' + res.status);
  const txt = await res.text();
  if (!txt.includes('<svg')) throw new Error('not svg');
  return txt;
}
export async function fetchSampleIcon(prefix, name) {
  try { return await fetchSvg(prefix, name); } catch { return ''; }
}

async function searchName(prefix, keyword) {
  const url = `${API}/search?query=${encodeURIComponent(keyword)}&prefix=${encodeURIComponent(prefix)}&limit=24`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const hits = (data.icons || []).filter(i => i.startsWith(prefix + ':')).map(i => i.slice(prefix.length + 1));
  if (!hits.length) return null;
  // Prefer an exact / closest name match, else first hit
  return hits.find(n => n === keyword) || hits.find(n => n.endsWith('-' + keyword) || n.startsWith(keyword + '-')) || hits[0];
}

const _nameCache = {}; // `${prefix}:${logical}` -> resolved name | null
async function resolveName(prefix, logical) {
  const key = `${prefix}:${logical}`;
  if (key in _nameCache) return _nameCache[key];
  for (const kw of KEYWORDS[logical]) {
    try {
      const found = await searchName(prefix, kw);
      if (found) return (_nameCache[key] = found);
    } catch {}
  }
  return (_nameCache[key] = null);
}

/* ── Icon sets (cached per library prefix) ───────────────────────────────── */
const _cache = { lucide: lucideSet() };

export async function ensureIconSet(prefix) {
  if (_cache[prefix]) return _cache[prefix];
  const entries = await Promise.all(ICON_NAMES.map(async n => {
    const resolved = await resolveName(prefix, n);
    if (!resolved) return [n, lucideSvg(n)];
    try { return [n, await fetchSvg(prefix, resolved)]; }
    catch { return [n, lucideSvg(n)]; }
  }));
  return (_cache[prefix] = Object.fromEntries(entries));
}

/* ── Collections list (the searchable library catalogue) ─────────────────── */
/* Keep ONLY general-purpose UI icon sets. Iconify groups collections into
   categories — the UI buckets ("UI 24px", "UI 16px / 32px", "UI Other …")
   plus "Material" are the interface icon libraries. Everything else
   (Logos, Emoji, Flags / Maps, Programming, Thematic, Archive, uncategorised)
   is dropped. We also skip multi-colour sets (can't inherit currentColor) and
   any stray brand/logo/flag variant living inside a UI category. */
const ALLOW_CATEGORY = c => {
  const cat = c.category || '';
  return cat.startsWith('UI') || cat === 'Material';
};
const EXCLUDE_NAME = /\b(brands?|logos?|flags?|emoji)\b/i;
function isUiLibrary(c) {
  if (c.prefix === 'lucide') return true;
  if (c.palette) return false;                       // multi-colour, can't tint
  if (!ALLOW_CATEGORY(c)) return false;              // UI buckets only
  if (EXCLUDE_NAME.test(c.label) || EXCLUDE_NAME.test(c.prefix)) return false;
  return true;
}

let _collections = null;
export async function loadCollections() {
  if (_collections) return _collections;
  try {
    const res = await fetch(`${API}/collections`);
    const data = await res.json();
    _collections = Object.entries(data).map(([prefix, c]) => ({
      prefix,
      label: c.name || prefix,
      total: c.total || 0,
      category: c.category || '',
      author: (c.author && c.author.name) || '',
      url: (c.author && c.author.url) || '',
      page: `https://icon-sets.iconify.design/${prefix}/`,
      license: (c.license && (c.license.title || c.license.spdx)) || '',
      samples: c.samples || [],
      palette: !!c.palette,
    }))
      .filter(isUiLibrary)
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    _collections = [];
  }
  // Ensure Lucide is present & first
  if (!_collections.some(c => c.prefix === 'lucide')) {
    _collections.unshift({
      prefix: 'lucide', label: 'Lucide', total: ICON_NAMES.length, category: 'General',
      author: 'Lucide', url: 'https://lucide.dev', page: 'https://icon-sets.iconify.design/lucide/',
      license: 'ISC', samples: ['flame', 'trophy', 'play'], palette: false,
    });
  }
  return _collections;
}

/* ── State ───────────────────────────────────────────────────────────────── */
let _current = 'lucide';
let _set = _cache.lucide;
const _listeners = new Set();

export function getIconLib() { return _current; }
export function subscribeIcon(fn) { _listeners.add(fn); return () => _listeners.delete(fn); }
function emit() { _listeners.forEach(fn => fn(_current)); }

export async function setIconLib(prefix) {
  if (prefix === _current) return;
  _current = prefix;
  try { localStorage.setItem('anvil-icon-lib', prefix); } catch {}
  emit();                            // optimistic: show selection immediately
  _set = await ensureIconSet(prefix);
  emit();                            // re-render preview once icons are ready
}

export function initIcons() {
  let saved = 'lucide';
  try { saved = localStorage.getItem('anvil-icon-lib') || 'lucide'; } catch {}
  if (saved && saved !== 'lucide') {
    _current = saved;
    ensureIconSet(saved).then(set => { _set = set; emit(); });
  }
}

/* Inner SVG markup for the current library (no wrapper) */
export function iconInner(name) {
  return (_set && _set[name]) || lucideSvg(name);
}

/* Synchronous icon markup for the current library (inlines from cache) */
export function iconSvg(name, cls = '') {
  return `<span class="csg-svg${cls ? ' ' + cls : ''}" data-icon="${name}" aria-hidden="true">${iconInner(name)}</span>`;
}
